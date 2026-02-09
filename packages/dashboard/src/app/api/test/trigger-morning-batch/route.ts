/**
 * Test Endpoint: Trigger Morning Batch
 * 
 * GET /api/test/trigger-morning-batch
 * 
 * Manually triggers the morning batch content pipeline.
 * No authentication required (test endpoint).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 10;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Test] Manually triggering morning batch...');

  try {
    const supabase = await createClient();

    // Generate a correlation ID to link all morning batch jobs
    const correlationId = crypto.randomUUID();

    // Define morning jobs in order of priority
    const jobs = [
      { job_type: 'news_scan', payload: {}, priority: 10 },
      { job_type: 'email_scan', payload: { sources: 'all' }, priority: 10 },
      { job_type: 'bloomberg_scan', payload: {}, priority: 9 },
      { job_type: 'score_ideas', payload: { limit: 50 }, priority: 8 },
      { job_type: 'select_daily', payload: { count: 6 }, priority: 7 },
    ];

    // Insert all jobs
    const { data, error } = await supabase
      .from('job_queue')
      .insert(jobs.map(job => ({
        job_type: job.job_type,
        payload: job.payload,
        priority: job.priority,
        correlation_id: correlationId,
        max_attempts: 5,
        status: 'pending',
        next_run_at: new Date().toISOString()
      })))
      .select('id, job_type');

    if (error) {
      console.error('[Test] Failed to enqueue morning batch:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`[Test] Morning batch queued in ${duration}ms: ${data.length} jobs`);

    // Log the enqueue
    await supabase.from('activity_log').insert({
      type: 'morning_batch_enqueued',
      description: `Morning batch enqueued (manual test): ${jobs.length} jobs`,
      metadata: {
        correlationId,
        trigger: 'manual_test',
        jobs: data.map(j => ({ id: j.id, type: j.job_type }))
      }
    });

    return NextResponse.json({
      success: true,
      duration,
      correlationId,
      queued: data.length,
      jobs: data.map(j => ({ id: j.id, type: j.job_type })),
      message: 'Morning batch queued. The worker cron (runs every 5 min) will process these jobs automatically.'
    });

  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
