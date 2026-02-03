/**
 * Cron Job: Evening Batch Enqueuer
 *
 * GET /api/cron/enqueue/evening-batch
 *
 * Enqueues evening jobs to the job queue.
 * The worker cron will process them with retry logic.
 *
 * Evening jobs (lighter than morning):
 * - email_scan (priority 10) - catch afternoon newsletters
 * - score_ideas (priority 8)
 * - select_daily count=2 (priority 7)
 *
 * Scheduled: Daily at 5:30pm CT (23:30 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 10; // Quick - just enqueuing

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[Enqueue] Creating evening batch jobs...');

  try {
    const supabase = await createClient();

    // Generate a correlation ID to link all evening batch jobs
    const correlationId = crypto.randomUUID();

    // Define evening jobs
    const jobs = [
      { job_type: 'email_scan', payload: { sources: 'all' }, priority: 10 },
      { job_type: 'score_ideas', payload: { limit: 30 }, priority: 8 },
      { job_type: 'select_daily', payload: { count: 2 }, priority: 7 },
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
      console.error('[Enqueue] Failed to enqueue evening batch:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`[Enqueue] Evening batch queued in ${duration}ms: ${data.length} jobs`);

    // Log the enqueue
    await supabase.from('activity_log').insert({
      type: 'evening_batch_enqueued',
      description: `Evening batch enqueued: ${jobs.length} jobs`,
      metadata: {
        correlationId,
        jobs: data.map(j => ({ id: j.id, type: j.job_type }))
      }
    });

    return NextResponse.json({
      success: true,
      duration,
      correlationId,
      queued: data.length,
      jobs: data.map(j => ({ id: j.id, type: j.job_type }))
    });

  } catch (error) {
    console.error('[Enqueue] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
