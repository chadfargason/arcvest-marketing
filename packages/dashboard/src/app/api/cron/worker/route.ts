/**
 * Cron Job: Worker
 *
 * GET /api/cron/worker
 *
 * Main worker that processes all queued jobs. Runs every 5 minutes.
 * Claims jobs atomically and processes them one at a time to avoid timeouts.
 *
 * Features:
 * - Atomic job claiming (prevents double-processing)
 * - Exponential backoff retry on failure
 * - Self-healing cleanup of stuck jobs
 * - Processes multiple jobs per run (up to time limit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMultiAIPipeline } from '@/lib/content-pipeline';
import { getIdeaScorer, getDailySelectionService, getSourceRegistry, initializeAdapters } from '@arcvest/services';
import { runNewsScan } from '@/lib/news-sourcer';

export const maxDuration = 300; // 5 minutes max

// Job types and their handlers
type JobType = 'news_scan' | 'email_scan' | 'bloomberg_scan' | 'score_ideas' | 'select_daily' | 'process_pipeline';

interface Job {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  priority: number;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_run_at: string;
  created_at: string;
  started_at: string | null;
}

interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const maxRuntime = 4 * 60 * 1000; // 4 minutes (leave buffer for response)
  const results: Array<{ jobId: string; jobType: string; status: string; duration: number; error?: string }> = [];

  console.log('[Worker] Starting job processing...');

  const supabase = await createClient();

  try {
    // Process jobs until time limit
    while (Date.now() - startTime < maxRuntime) {
      const job = await claimNextJob(supabase);

      if (!job) {
        console.log('[Worker] No more pending jobs');
        break;
      }

      const jobStartTime = Date.now();
      console.log(`[Worker] Processing job ${job.id} (${job.job_type}), attempt ${job.attempts}`);

      try {
        const result = await processJob(supabase, job);

        if (result.success) {
          await completeJob(supabase, job.id, result.data || {});
          results.push({
            jobId: job.id,
            jobType: job.job_type,
            status: 'completed',
            duration: Date.now() - jobStartTime
          });
        } else {
          await failJob(supabase, job, result.error || 'Unknown error');
          results.push({
            jobId: job.id,
            jobType: job.job_type,
            status: 'failed',
            duration: Date.now() - jobStartTime,
            error: result.error
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await failJob(supabase, job, errorMsg);
        results.push({
          jobId: job.id,
          jobType: job.job_type,
          status: 'failed',
          duration: Date.now() - jobStartTime,
          error: errorMsg
        });
      }
    }

    // Cleanup stuck jobs
    const cleanedCount = await cleanupStuckJobs(supabase);

    const totalDuration = Date.now() - startTime;
    console.log(`[Worker] Complete in ${totalDuration}ms: ${results.length} jobs processed, ${cleanedCount} stuck jobs cleaned`);

    return NextResponse.json({
      success: true,
      duration: totalDuration,
      processed: results.length,
      cleaned: cleanedCount,
      results
    });

  } catch (error) {
    console.error('[Worker] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processed: results.length,
      results
    }, { status: 500 });
  }
}

/**
 * Claim the next available job (atomic operation)
 */
async function claimNextJob(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<Job | null> {
  // Try RPC function first (most atomic)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('claim_next_job', { p_worker_id: process.env.VERCEL_DEPLOYMENT_ID || 'worker' });

  if (!rpcError && rpcData && rpcData.length > 0) {
    return rpcData[0] as Job;
  }

  // Fallback: Manual claim
  const { data: pendingJob, error: selectError } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('next_run_at', { ascending: true })
    .limit(1)
    .single();

  if (selectError || !pendingJob) {
    return null;
  }

  // Try to claim it (optimistic locking)
  const { data: claimedJob, error: updateError } = await supabase
    .from('job_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: pendingJob.attempts + 1
    })
    .eq('id', pendingJob.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (updateError || !claimedJob) {
    return null; // Someone else claimed it
  }

  return claimedJob as Job;
}

/**
 * Process a job based on its type
 */
async function processJob(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, job: Job): Promise<JobResult> {
  switch (job.job_type) {
    case 'news_scan':
      return processNewsScan(supabase);

    case 'email_scan':
      return processEmailScan();

    case 'bloomberg_scan':
      return processBloombergScan();

    case 'score_ideas':
      return processScoreIdeas();

    case 'select_daily':
      return processSelectDaily(job.payload);

    case 'process_pipeline':
      return processPipeline(supabase, job.payload);

    default:
      return { success: false, error: `Unknown job type: ${job.job_type}` };
  }
}

/**
 * Process news scan job
 */
async function processNewsScan(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<JobResult> {
  try {
    const result = await runNewsScan({
      highPriorityOnly: false,
      hoursBack: 24,
      minScore: 65,
      maxToSelect: 3,
    });

    // Log the scan
    await supabase.from('activity_log').insert({
      type: 'news_scan',
      description: `News scan completed. Found ${result.articlesFound} articles, selected ${result.selectedStories.length}.`,
      metadata: {
        articlesFound: result.articlesFound,
        selectedCount: result.selectedStories.length,
        processingTimeMs: result.processingTimeMs,
      },
    });

    return {
      success: true,
      data: {
        articlesFound: result.articlesFound,
        selectedCount: result.selectedStories.length
      }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process email scan job
 */
async function processEmailScan(): Promise<JobResult> {
  try {
    initializeAdapters();
    const registry = getSourceRegistry();
    const results = await registry.fetchEmailSources();

    let totalIdeas = 0;
    let successfulSources = 0;

    results.forEach((result) => {
      if (result.success) {
        successfulSources++;
        totalIdeas += result.ideas.length;
      }
    });

    return {
      success: true,
      data: { totalIdeas, successfulSources }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process Bloomberg scan job
 */
async function processBloombergScan(): Promise<JobResult> {
  try {
    initializeAdapters();
    const registry = getSourceRegistry();
    const result = await registry.fetchBySource('email-bloomberg');

    return {
      success: result.success,
      data: { ideas: result.ideas.length },
      error: result.error
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process score ideas job
 */
async function processScoreIdeas(): Promise<JobResult> {
  try {
    const scorer = getIdeaScorer();
    const result = await scorer.scorePendingIdeas({ limit: 50 });

    return {
      success: true,
      data: { scored: result.scored, errors: result.errors }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process select daily job
 */
async function processSelectDaily(payload: Record<string, unknown>): Promise<JobResult> {
  try {
    const targetCount = (payload.count as number) || 6;
    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount,
      minScore: 55,
      maxPerSource: 3,
    });

    return {
      success: result.success,
      data: {
        selectedCount: result.selectedCount,
        sourceBreakdown: result.sourceBreakdown
      },
      error: result.error
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process pipeline job with checkpointing
 */
async function processPipeline(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  payload: Record<string, unknown>
): Promise<JobResult> {
  try {
    const ideaId = payload.idea_id as string | undefined;
    const dateStr = new Date().toISOString().split('T')[0] || '';

    // Get the idea to process
    let ideaQuery = supabase
      .from('idea_queue')
      .select('id, title, source_name, full_content, suggested_angle, relevance_score, selection_rank, pipeline_step, pipeline_data');

    if (ideaId) {
      // Process specific idea
      ideaQuery = ideaQuery.eq('id', ideaId);
    } else {
      // Get next selected idea for today
      ideaQuery = ideaQuery
        .eq('status', 'selected')
        .eq('selected_for_date', dateStr)
        .order('selection_rank', { ascending: true })
        .limit(1);
    }

    const { data: ideas, error: fetchError } = await ideaQuery;

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!ideas || ideas.length === 0) {
      return { success: true, data: { message: 'No ideas to process' } };
    }

    const idea = ideas[0];

    // Mark as processing
    await supabase
      .from('idea_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', idea.id);

    // Run the pipeline (with checkpoint recovery)
    const pipelineData = idea.pipeline_data || {};
    const pipeline = getMultiAIPipeline();

    // Build input
    const inputContent = [
      `TOPIC: ${idea.title}`,
      `SOURCE: ${idea.source_name}`,
      idea.full_content ? `\nSOURCE CONTENT:\n${idea.full_content}` : '',
      idea.suggested_angle ? `\nSUGGESTED ANGLE: ${idea.suggested_angle}` : '',
    ].filter(Boolean).join('\n');

    // Check if we can resume from checkpoint
    let pipelineResult;
    if (pipelineData.checkpoint) {
      // Resume from checkpoint
      console.log(`[Pipeline] Resuming from checkpoint: ${pipelineData.checkpoint}`);
      pipelineResult = await pipeline.resumeFrom(pipelineData.checkpoint, pipelineData);
    } else {
      // Start fresh
      pipelineResult = await pipeline.run({
        content: inputContent,
        inputType: 'raw_text',
        focusAngle: idea.suggested_angle || undefined,
        onCheckpoint: async (step: string, data: Record<string, unknown>) => {
          // Save checkpoint
          await supabase
            .from('idea_queue')
            .update({
              pipeline_step: step,
              pipeline_data: { ...pipelineData, checkpoint: step, ...data },
              updated_at: new Date().toISOString()
            })
            .eq('id', idea.id);
        }
      });
    }

    // Extract title
    const h1Match = pipelineResult.finalOutput.wordpressPost.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const finalTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : idea.title;

    // Save to content_calendar
    const { data: contentEntry, error: contentError } = await supabase
      .from('content_calendar')
      .insert({
        title: finalTitle,
        content_type: 'blog_post',
        status: 'review',
        topic: idea.title,
        draft: pipelineResult.geminiDraft?.content || pipelineResult.gptDraft?.content,
        final_content: pipelineResult.finalOutput.wordpressPost,
        meta_description: pipelineResult.finalOutput.excerpt,
        keywords: pipelineResult.finalOutput.seoTags,
        idea_queue_id: idea.id,
        generation_method: 'automated',
        metadata: {
          source_name: idea.source_name,
          relevance_score: idea.relevance_score,
          pipeline_stats: {
            processingTimeMs: pipelineResult.metadata?.processingTimeMs,
            totalTokensUsed: pipelineResult.metadata?.totalTokensUsed,
          },
        },
      })
      .select('id')
      .single();

    if (contentError) {
      return { success: false, error: contentError.message };
    }

    // Update idea status
    await supabase
      .from('idea_queue')
      .update({
        status: 'completed',
        content_calendar_id: contentEntry?.id,
        pipeline_step: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', idea.id);

    return {
      success: true,
      data: {
        ideaId: idea.id,
        title: finalTitle,
        contentId: contentEntry?.id
      }
    };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Mark a job as completed
 */
async function completeJob(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('job_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result
    })
    .eq('id', jobId);

  console.log(`[Worker] Job ${jobId} completed`);
}

/**
 * Fail a job with retry logic
 */
async function failJob(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  job: Job,
  error: string
): Promise<void> {
  const baseDelay = 30; // seconds
  const backoffSeconds = Math.min(
    baseDelay * Math.pow(2, job.attempts - 1),
    3600 // Max 1 hour
  );

  if (job.attempts >= job.max_attempts) {
    // Max attempts reached - mark as permanently failed
    await supabase
      .from('job_queue')
      .update({
        status: 'failed',
        last_error: error,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    console.log(`[Worker] Job ${job.id} failed permanently after ${job.attempts} attempts: ${error}`);

    // Log for alerting
    await supabase.from('activity_log').insert({
      type: 'job_failed_permanently',
      entity_type: 'job_queue',
      entity_id: job.id,
      metadata: {
        job_type: job.job_type,
        attempts: job.attempts,
        error
      }
    });
  } else {
    // Schedule retry
    const nextRunAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        last_error: error,
        next_run_at: nextRunAt
      })
      .eq('id', job.id);

    console.log(`[Worker] Job ${job.id} scheduled for retry in ${backoffSeconds}s (attempt ${job.attempts}/${job.max_attempts})`);
  }
}

/**
 * Cleanup stuck jobs
 */
async function cleanupStuckJobs(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<number> {
  const stuckThresholdMinutes = 10;
  const cutoff = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

  // Find stuck jobs
  const { data: stuckJobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'processing')
    .lt('started_at', cutoff);

  if (error || !stuckJobs) {
    return 0;
  }

  // Reset each stuck job
  for (const job of stuckJobs) {
    await failJob(supabase, job as Job, `Job timed out (stuck in processing for ${stuckThresholdMinutes} minutes)`);
  }

  // Also reset stuck ideas
  await supabase
    .from('idea_queue')
    .update({ status: 'selected' })
    .eq('status', 'processing')
    .lt('updated_at', cutoff);

  return stuckJobs.length;
}
