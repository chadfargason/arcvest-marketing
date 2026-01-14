# Robust Cron Job System - Implementation Plan

**Created:** January 14, 2026
**Status:** Pending Approval
**Project:** ArcVest Marketing Automation

---

## Problem Statement

Current issues with the cron job system:

| Issue | Impact | Example |
|-------|--------|---------|
| **Timeouts** | Jobs fail completely | Processing 5 articles at once times out at 300s |
| **API Failures** | Lost work | Claude API returns 529 "overloaded" and job fails |
| **No Retries** | Manual intervention needed | Failed email scan doesn't retry automatically |
| **Stuck States** | Ideas never processed | Idea stuck in "processing" status forever |
| **No Visibility** | Hard to debug | Don't know which jobs ran or failed |

---

## Solution Overview

Build a **self-healing job queue system** using existing infrastructure (Supabase + Vercel):

1. **Job Queue Table** - Persistent queue in Supabase tracks all work
2. **Worker Pattern** - Crons enqueue work, worker processes it
3. **Retry Logic** - Exponential backoff (30s, 60s, 120s, 240s, 480s)
4. **Checkpointing** - Pipeline saves progress after each AI step
5. **Self-Healing** - Cleanup routine fixes stuck jobs automatically

**No new services required** - uses your existing Supabase database.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRON TRIGGERS (Vercel)                       │
│  Lightweight - just enqueue work, complete in <1 second          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   6:30am CT     6:45am CT    Every 5 minutes                     │
│   ─────────     ──────────   ──────────────────                  │
│   Enqueue       Enqueue      WORKER processes                    │
│   morning       scoring      jobs from queue                     │
│   batch         jobs         (1-3 at a time)                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JOB_QUEUE TABLE (Supabase)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   id   │ job_type       │ status     │ attempts │ next_run_at   │
│   ─────┼────────────────┼────────────┼──────────┼───────────────│
│   1    │ email_scan     │ completed  │ 1        │ -             │
│   2    │ score_idea     │ pending    │ 0        │ now           │
│   3    │ process_pipe   │ retry      │ 2        │ now + 120s    │
│   4    │ process_pipe   │ failed     │ 5        │ - (gave up)   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WORKER CRON (Every 5 minutes)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   1. Claim pending job (atomic, prevents double-processing)      │
│   2. Process the job                                             │
│   3. On SUCCESS → mark completed                                 │
│   4. On FAILURE → increment attempts, schedule retry             │
│   5. On MAX ATTEMPTS → mark failed, log for alerting             │
│   6. Clean up any stuck jobs (>10 min in processing)             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### New Table: `job_queue`

```sql
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job definition
  job_type TEXT NOT NULL,        -- 'email_scan', 'score_idea', 'process_pipeline', etc.
  payload JSONB DEFAULT '{}',    -- Job-specific data (idea_id, sources, etc.)
  priority INTEGER DEFAULT 0,    -- Higher = process first

  -- Status tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

  -- Retry logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  next_run_at TIMESTAMPTZ DEFAULT now(),

  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Correlation (optional, for related jobs)
  correlation_id UUID,
  parent_job_id UUID REFERENCES job_queue(id)
);

-- Index for efficient job claiming
CREATE INDEX idx_job_queue_pending ON job_queue(priority DESC, next_run_at ASC)
  WHERE status = 'pending';

-- Index for finding stuck jobs
CREATE INDEX idx_job_queue_processing ON job_queue(started_at)
  WHERE status = 'processing';
```

### Atomic Job Claiming Function

```sql
-- Prevents race conditions when multiple workers run
CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT DEFAULT 'default')
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id FROM job_queue
    WHERE status = 'pending'
      AND next_run_at <= now()
    ORDER BY priority DESC, next_run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- Critical: skip locked rows
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
```

### Modify `idea_queue` for Checkpointing

```sql
-- Track which pipeline step we're on
ALTER TABLE idea_queue
  ADD COLUMN IF NOT EXISTS pipeline_step TEXT;
-- Values: null, 'claude_draft', 'gpt_improve', 'gemini_polish', 'claude_package', 'completed'

-- Store intermediate results for resumption
ALTER TABLE idea_queue
  ADD COLUMN IF NOT EXISTS pipeline_data JSONB DEFAULT '{}';
```

---

## New API Routes

### 1. Worker Cron: `/api/cron/worker`

Runs every 5 minutes, processes queued jobs:

```typescript
// packages/dashboard/src/app/api/cron/worker/route.ts

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const maxDuration = 4 * 60 * 1000; // 4 minutes (leave buffer)
  const results = [];

  // Process jobs until time limit
  while (Date.now() - startTime < maxDuration) {
    const job = await claimNextJob();
    if (!job) break; // No more pending jobs

    try {
      const result = await processJob(job);
      await markJobCompleted(job.id, result);
      results.push({ id: job.id, status: 'completed' });
    } catch (error) {
      await handleJobFailure(job, error);
      results.push({ id: job.id, status: 'retry_scheduled', error: error.message });
    }
  }

  // Cleanup stuck jobs
  const cleaned = await cleanupStuckJobs();

  return NextResponse.json({
    processed: results.length,
    cleaned,
    duration: Date.now() - startTime,
    results
  });
}
```

### 2. Morning Batch Enqueuer: `/api/cron/enqueue/morning-batch`

```typescript
// packages/dashboard/src/app/api/cron/enqueue/morning-batch/route.ts

export async function GET() {
  const jobs = [
    { job_type: 'news_scan', priority: 10 },
    { job_type: 'email_scan', payload: { sources: 'all' }, priority: 10 },
    { job_type: 'bloomberg_scan', priority: 9 },
    { job_type: 'score_ideas', priority: 8 },
    { job_type: 'select_daily', payload: { count: 6 }, priority: 7 },
    // Pipeline jobs will be created by select_daily
  ];

  const { data, error } = await supabase.from('job_queue').insert(jobs);

  return NextResponse.json({
    success: !error,
    queued: jobs.length,
    jobs: jobs.map(j => j.job_type)
  });
}
```

### 3. Evening Batch Enqueuer: `/api/cron/enqueue/evening-batch`

```typescript
// packages/dashboard/src/app/api/cron/enqueue/evening-batch/route.ts

export async function GET() {
  const jobs = [
    { job_type: 'email_scan', payload: { sources: 'all' }, priority: 10 },
    { job_type: 'score_ideas', priority: 8 },
    { job_type: 'select_daily', payload: { count: 2 }, priority: 7 },
  ];

  const { data, error } = await supabase.from('job_queue').insert(jobs);

  return NextResponse.json({
    success: !error,
    queued: jobs.length
  });
}
```

---

## Retry Logic

### Exponential Backoff Schedule

| Attempt | Wait Time | Total Elapsed |
|---------|-----------|---------------|
| 1 | Immediate | 0 |
| 2 | 30 seconds | 30s |
| 3 | 60 seconds | 1.5 min |
| 4 | 120 seconds | 3.5 min |
| 5 | 240 seconds | 7.5 min |
| FAIL | Give up | - |

### Implementation

```typescript
async function handleJobFailure(job: Job, error: Error) {
  const baseDelay = 30; // seconds
  const backoffSeconds = Math.min(
    baseDelay * Math.pow(2, job.attempts - 1),
    3600 // Max 1 hour
  );

  if (job.attempts >= job.max_attempts) {
    // Give up - mark as failed
    await supabase.from('job_queue').update({
      status: 'failed',
      last_error: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', job.id);

    // Log for alerting/monitoring
    await supabase.from('activity_log').insert({
      type: 'job_failed_permanently',
      metadata: {
        job_id: job.id,
        job_type: job.job_type,
        attempts: job.attempts,
        error: error.message
      }
    });
  } else {
    // Schedule retry
    const nextRun = new Date(Date.now() + backoffSeconds * 1000);
    await supabase.from('job_queue').update({
      status: 'pending',
      last_error: error.message,
      next_run_at: nextRun.toISOString()
    }).eq('id', job.id);
  }
}
```

---

## Content Pipeline Checkpointing

The 4-AI pipeline now saves progress after each step. If interrupted, it resumes from the last checkpoint.

### Before (No Checkpointing)

```
Claude → GPT → [TIMEOUT] → Lost all work, start over
```

### After (With Checkpointing)

```
Claude → [save] → GPT → [TIMEOUT]
... later ...
Worker picks up → Resumes from GPT step → Gemini → [save] → Claude → Done
```

### Implementation

```typescript
async function processContentPipeline(ideaId: string) {
  const idea = await getIdea(ideaId);
  const data = idea.pipeline_data || {};

  // Step 1: Claude Draft
  if (!data.claude_draft) {
    const draft = await runClaudeDraft(idea);
    await checkpoint(ideaId, 'claude_draft', { claude_draft: draft });
    data.claude_draft = draft;
  }

  // Step 2: GPT Improve
  if (!data.gpt_improved) {
    const improved = await runGPTImprove(data.claude_draft);
    await checkpoint(ideaId, 'gpt_improve', { gpt_improved: improved });
    data.gpt_improved = improved;
  }

  // Step 3: Gemini Polish
  if (!data.gemini_polished) {
    const polished = await runGeminiPolish(data.gpt_improved);
    await checkpoint(ideaId, 'gemini_polish', { gemini_polished: polished });
    data.gemini_polished = polished;
  }

  // Step 4: Claude Package (HTML, excerpt, tags, image prompt)
  if (!data.final_package) {
    const final = await runClaudePackage(data.gemini_polished);
    await checkpoint(ideaId, 'claude_package', { final_package: final });
    data.final_package = final;
  }

  // Save to content_calendar
  await saveToContentCalendar(idea, data.final_package);
  await markIdeaCompleted(ideaId);
}

async function checkpoint(ideaId: string, step: string, newData: object) {
  await supabase.from('idea_queue').update({
    pipeline_step: step,
    pipeline_data: supabase.sql`pipeline_data || ${JSON.stringify(newData)}::jsonb`,
    updated_at: new Date().toISOString()
  }).eq('id', ideaId);
}
```

---

## Self-Healing Cleanup

Automatically fixes jobs stuck in "processing" state:

```typescript
async function cleanupStuckJobs() {
  const stuckThreshold = 10 * 60 * 1000; // 10 minutes
  const cutoff = new Date(Date.now() - stuckThreshold).toISOString();

  // Find stuck jobs
  const { data: stuckJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'processing')
    .lt('started_at', cutoff);

  for (const job of stuckJobs || []) {
    await handleJobFailure(job, new Error('Job timed out (stuck in processing)'));
  }

  // Also reset stuck ideas
  await supabase.from('idea_queue')
    .update({ status: 'selected' })
    .eq('status', 'processing')
    .lt('updated_at', cutoff);

  return stuckJobs?.length || 0;
}
```

---

## Updated Cron Schedule

### New vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/enqueue/morning-batch",
      "schedule": "30 12 * * *"
    },
    {
      "path": "/api/cron/enqueue/evening-batch",
      "schedule": "30 23 * * *"
    },
    {
      "path": "/api/cron/worker",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/analytics-sync",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/ads-sync",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/ads-optimize",
      "schedule": "0 12 * * *"
    }
  ]
}
```

### Schedule Comparison

| Before | After |
|--------|-------|
| 15 cron entries | 6 cron entries |
| Each does work directly | Enqueuers + worker |
| Timeout = failure | Timeout = retry |
| Jobs can overlap/conflict | Atomic job claiming |

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/database/migrations/010_job_queue.sql` | New table + functions |
| `packages/dashboard/src/app/api/cron/worker/route.ts` | Main worker |
| `packages/dashboard/src/app/api/cron/enqueue/morning-batch/route.ts` | Morning enqueuer |
| `packages/dashboard/src/app/api/cron/enqueue/evening-batch/route.ts` | Evening enqueuer |
| `packages/services/src/job-queue-service.ts` | Queue operations |

## Files to Modify

| File | Changes |
|------|---------|
| `vercel.json` | Simplified cron schedule |
| `packages/agents/src/content/content-pipeline.ts` | Add checkpointing |
| `packages/services/src/scoring/idea-scorer.ts` | Work via job queue |
| `packages/services/src/selection/daily-selection-service.ts` | Work via job queue |

---

## Verification Plan

1. **Run migration** against Supabase
2. **Deploy** and verify worker cron runs every 5 minutes
3. **Test retry logic**:
   - Insert a job that will fail
   - Verify exponential backoff works
   - Verify it marks as 'failed' after 5 attempts
4. **Test checkpointing**:
   - Start pipeline, kill it mid-way
   - Verify it resumes from checkpoint
5. **Test stuck job cleanup**:
   - Manually set job to 'processing' with old timestamp
   - Verify cleanup resets it
6. **End-to-end**:
   - Trigger morning batch
   - Watch jobs process through queue
   - Verify articles appear in content calendar

---

## Benefits Summary

| Issue | Before | After |
|-------|--------|-------|
| Timeout | Job lost forever | Retries automatically |
| API overloaded | Job fails | Exponential backoff retry |
| Stuck jobs | Manual intervention | Self-healing cleanup |
| Visibility | Check logs manually | Query job_queue table |
| Multi-article processing | Times out | Processes 1 at a time reliably |
| Pipeline interrupted | Start over | Resume from checkpoint |

---

## Monitoring

### Job Queue Dashboard Query

```sql
-- Current queue status
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM job_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;
```

### Failed Jobs Alert Query

```sql
-- Jobs that failed permanently in last 24 hours
SELECT * FROM job_queue
WHERE status = 'failed'
  AND completed_at > now() - interval '24 hours'
ORDER BY completed_at DESC;
```

---

**Ready for implementation upon approval.**
