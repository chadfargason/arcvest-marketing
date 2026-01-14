/**
 * Job Queue Service
 *
 * Handles all job queue operations including:
 * - Enqueueing new jobs
 * - Claiming jobs for processing (atomic)
 * - Completing/failing jobs
 * - Cleanup of stuck jobs
 * - Retry logic with exponential backoff
 */

import { createLogger } from '@arcvest/shared';
import { getSupabase } from './supabase';

const logger = createLogger('job-queue-service');

// Job types
export type JobType =
  | 'news_scan'
  | 'email_scan'
  | 'bloomberg_scan'
  | 'score_ideas'
  | 'select_daily'
  | 'process_pipeline';

// Job status
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Job record
export interface Job {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  priority: number;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_run_at: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  correlation_id: string | null;
  parent_job_id: string | null;
}

// Enqueue options
export interface EnqueueOptions {
  priority?: number;
  maxAttempts?: number;
  correlationId?: string;
  parentJobId?: string;
  delaySeconds?: number;
}

// Job result
export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Job Queue Service class
 */
export class JobQueueService {
  private supabase = getSupabase();

  /**
   * Enqueue a new job
   */
  async enqueue(
    jobType: JobType,
    payload: Record<string, unknown> = {},
    options: EnqueueOptions = {}
  ): Promise<string> {
    const {
      priority = 0,
      maxAttempts = 5,
      correlationId,
      parentJobId,
      delaySeconds = 0
    } = options;

    const nextRunAt = delaySeconds > 0
      ? new Date(Date.now() + delaySeconds * 1000).toISOString()
      : new Date().toISOString();

    const { data, error } = await this.supabase
      .from('job_queue')
      .insert({
        job_type: jobType,
        payload,
        priority,
        max_attempts: maxAttempts,
        correlation_id: correlationId,
        parent_job_id: parentJobId,
        next_run_at: nextRunAt
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to enqueue job', { jobType, error: error.message });
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }

    logger.info('Job enqueued', { jobId: data.id, jobType, priority });
    return data.id;
  }

  /**
   * Enqueue multiple jobs at once
   */
  async enqueueBatch(
    jobs: Array<{ jobType: JobType; payload?: Record<string, unknown>; options?: EnqueueOptions }>
  ): Promise<string[]> {
    const records = jobs.map(({ jobType, payload = {}, options = {} }) => ({
      job_type: jobType,
      payload,
      priority: options.priority || 0,
      max_attempts: options.maxAttempts || 5,
      correlation_id: options.correlationId,
      parent_job_id: options.parentJobId,
      next_run_at: options.delaySeconds
        ? new Date(Date.now() + options.delaySeconds * 1000).toISOString()
        : new Date().toISOString()
    }));

    const { data, error } = await this.supabase
      .from('job_queue')
      .insert(records)
      .select('id');

    if (error) {
      logger.error('Failed to enqueue batch', { error: error.message });
      throw new Error(`Failed to enqueue batch: ${error.message}`);
    }

    const ids = data.map((d: { id: string }) => d.id);
    logger.info('Batch enqueued', { count: ids.length });
    return ids;
  }

  /**
   * Claim the next available job (atomic operation)
   */
  async claimNextJob(workerId: string = 'default'): Promise<Job | null> {
    // Try using the RPC function first
    const { data: rpcData, error: rpcError } = await this.supabase
      .rpc('claim_next_job', { p_worker_id: workerId });

    if (!rpcError && rpcData && rpcData.length > 0) {
      logger.info('Job claimed via RPC', { jobId: rpcData[0].id, jobType: rpcData[0].job_type });
      return rpcData[0] as Job;
    }

    // Fallback: Manual claim (less atomic but works if function doesn't exist)
    const { data: pendingJob, error: selectError } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_run_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('next_run_at', { ascending: true })
      .limit(1)
      .single();

    if (selectError || !pendingJob) {
      return null; // No jobs available
    }

    // Try to claim it
    const { data: claimedJob, error: updateError } = await this.supabase
      .from('job_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: pendingJob.attempts + 1
      })
      .eq('id', pendingJob.id)
      .eq('status', 'pending') // Ensure it's still pending (optimistic locking)
      .select()
      .single();

    if (updateError || !claimedJob) {
      // Someone else claimed it, try again
      return this.claimNextJob(workerId);
    }

    logger.info('Job claimed via fallback', { jobId: claimedJob.id, jobType: claimedJob.job_type });
    return claimedJob as Job;
  }

  /**
   * Mark a job as completed
   */
  async completeJob(jobId: string, result: Record<string, unknown> = {}): Promise<void> {
    const { error } = await this.supabase
      .from('job_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result
      })
      .eq('id', jobId);

    if (error) {
      logger.error('Failed to complete job', { jobId, error: error.message });
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    logger.info('Job completed', { jobId });
  }

  /**
   * Fail a job with retry logic
   */
  async failJob(jobId: string, error: string, baseDelaySeconds: number = 30): Promise<void> {
    // Get current job state
    const { data: job, error: fetchError } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      logger.error('Failed to fetch job for failure handling', { jobId });
      return;
    }

    if (job.attempts >= job.max_attempts) {
      // Max attempts reached - mark as permanently failed
      await this.supabase
        .from('job_queue')
        .update({
          status: 'failed',
          last_error: error,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      logger.warn('Job failed permanently', {
        jobId,
        jobType: job.job_type,
        attempts: job.attempts,
        error
      });

      // Log to activity_log for alerting
      await this.supabase.from('activity_log').insert({
        type: 'job_failed_permanently',
        entity_type: 'job_queue',
        entity_id: jobId,
        metadata: {
          job_type: job.job_type,
          attempts: job.attempts,
          error
        }
      });
    } else {
      // Schedule retry with exponential backoff
      const backoffSeconds = Math.min(
        baseDelaySeconds * Math.pow(2, job.attempts - 1),
        3600 // Max 1 hour
      );
      const nextRunAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      await this.supabase
        .from('job_queue')
        .update({
          status: 'pending',
          last_error: error,
          next_run_at: nextRunAt
        })
        .eq('id', jobId);

      logger.info('Job scheduled for retry', {
        jobId,
        jobType: job.job_type,
        attempt: job.attempts,
        nextRetryIn: `${backoffSeconds}s`
      });
    }
  }

  /**
   * Cleanup stuck jobs (jobs in 'processing' for too long)
   */
  async cleanupStuckJobs(stuckThresholdMinutes: number = 10): Promise<number> {
    const cutoff = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

    const { data: stuckJobs, error: fetchError } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', cutoff);

    if (fetchError || !stuckJobs) {
      logger.error('Failed to fetch stuck jobs', { error: fetchError?.message });
      return 0;
    }

    let cleanedCount = 0;
    for (const job of stuckJobs) {
      await this.failJob(
        job.id,
        `Job timed out (stuck in processing for ${stuckThresholdMinutes} minutes)`
      );
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up stuck jobs', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('job_queue')
      .select('status, job_type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error || !data) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, byType: {} };
    }

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      byType: {} as Record<string, number>
    };

    for (const job of data) {
      stats[job.status as keyof typeof stats]++;
      stats.byType[job.job_type] = (stats.byType[job.job_type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get recent failed jobs
   */
  async getFailedJobs(limit: number = 10): Promise<Job[]> {
    const { data, error } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'failed')
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch failed jobs', { error: error.message });
      return [];
    }

    return (data || []) as Job[];
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_queue')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('status', 'pending'); // Can only cancel pending jobs

    if (error) {
      logger.error('Failed to cancel job', { jobId, error: error.message });
      throw new Error(`Failed to cancel job: ${error.message}`);
    }

    logger.info('Job cancelled', { jobId });
  }

  /**
   * Retry a failed job manually
   */
  async retryJob(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_queue')
      .update({
        status: 'pending',
        next_run_at: new Date().toISOString(),
        attempts: 0 // Reset attempts for manual retry
      })
      .eq('id', jobId)
      .eq('status', 'failed'); // Can only retry failed jobs

    if (error) {
      logger.error('Failed to retry job', { jobId, error: error.message });
      throw new Error(`Failed to retry job: ${error.message}`);
    }

    logger.info('Job scheduled for retry', { jobId });
  }
}

// Export singleton instance
export const jobQueueService = new JobQueueService();
