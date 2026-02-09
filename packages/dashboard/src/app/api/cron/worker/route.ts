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
import { getMultiAIPipeline, type PipelineCheckpoint, type PipelineStep } from '@/lib/content-pipeline';
import { getIdeaScorer, getDailySelectionService, getSourceRegistry, initializeAdapters, PipelineLogger } from '@arcvest/services';
import { runNewsScan } from '@/lib/news-sourcer';

export const maxDuration = 300; // 5 minutes max

// Local type definitions (since DTS is disabled for services)
interface FetchResult {
  success: boolean;
  ideas: Array<{
    title: string;
    summary?: string;
    rawContent: string;
    sourceId: string;
    sourceUrl: string;
    publishedAt?: Date;
    author?: string;
    hash: string;
  }>;
  error?: string;
  fetchedAt: Date;
  duration: number;
}

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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron sends x-vercel-cron: 1)
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('Unauthorized worker cron attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Worker] Starting (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})`);

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
  const logger = new PipelineLogger(job.job_type, job.id);
  logger.info(`Starting job`, 'start', { attempts: job.attempts, payload: job.payload });

  try {
    let result: JobResult;

    switch (job.job_type) {
      case 'news_scan':
        result = await processNewsScan(supabase, logger);
        break;

      case 'email_scan':
        result = await processEmailScan(logger);
        break;

      case 'bloomberg_scan':
        result = await processBloombergScan(logger);
        break;

      case 'score_ideas':
        result = await processScoreIdeas(logger);
        break;

      case 'select_daily':
        result = await processSelectDaily(job.payload, logger);
        break;

      case 'process_pipeline':
        result = await processPipeline(supabase, job.payload, logger);
        break;

      default:
        result = { success: false, error: `Unknown job type: ${job.job_type}` };
    }

    if (result.success) {
      await logger.complete(`Job completed successfully`);
    } else {
      logger.error(`Job failed: ${result.error}`, 'complete');
      await logger.complete();
    }

    return result;
  } catch (error) {
    logger.logError(error, 'unexpected_error');
    await logger.complete();
    throw error;
  }
}

/**
 * Process news scan job
 */
async function processNewsScan(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, logger: InstanceType<typeof PipelineLogger>): Promise<JobResult> {
  try {
    logger.info('Starting news scan', 'scan_start');
    logger.startStep();

    const result = await runNewsScan({
      highPriorityOnly: false,
      hoursBack: 24,
      minScore: 65,
      maxToSelect: 3,
    });

    logger.info(`Found ${result.articlesFound} articles, selected ${result.selectedStories.length}`, 'scan_complete', {
      articlesFound: result.articlesFound,
      selectedCount: result.selectedStories.length,
      processingTimeMs: result.processingTimeMs,
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
    logger.logError(error, 'scan_error');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process email scan job
 */
async function processEmailScan(logger: InstanceType<typeof PipelineLogger>): Promise<JobResult> {
  try {
    logger.info('Initializing email adapters', 'init');
    logger.startStep();
    initializeAdapters();

    const registry = getSourceRegistry();
    logger.info('Fetching email sources', 'fetch_start');
    logger.startStep();

    const results = await registry.fetchEmailSources();

    let totalIdeas = 0;
    let successfulSources = 0;
    const sourceResults: Record<string, { success: boolean; ideas: number; error?: string }> = {};

    results.forEach((result: FetchResult, sourceName: string) => {
      sourceResults[sourceName] = {
        success: result.success,
        ideas: result.ideas.length,
        error: result.error
      };
      if (result.success) {
        successfulSources++;
        totalIdeas += result.ideas.length;
      } else {
        logger.warn(`Source ${sourceName} failed: ${result.error}`, 'source_error', {
          sourceName
        });
      }
    });

    logger.info(`Email scan complete: ${totalIdeas} ideas from ${successfulSources} sources`, 'fetch_complete', {
      totalIdeas,
      successfulSources,
      totalSources: results.size,
      sourceResults
    });

    return {
      success: true,
      data: { totalIdeas, successfulSources }
    };
  } catch (error) {
    logger.logError(error, 'email_scan_error');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process Bloomberg scan job
 */
async function processBloombergScan(logger: InstanceType<typeof PipelineLogger>): Promise<JobResult> {
  try {
    logger.info('Initializing Bloomberg adapter', 'init');
    logger.startStep();
    initializeAdapters();

    const registry = getSourceRegistry();
    logger.info('Fetching Bloomberg emails', 'fetch_start');
    logger.startStep();

    const result = await registry.fetchSource('email-bloomberg');

    if (result.success) {
      logger.info(`Bloomberg scan complete: ${result.ideas.length} ideas found`, 'fetch_complete', {
        ideasFound: result.ideas.length,
        ideaTitles: result.ideas.slice(0, 5).map((i: { title: string }) => i.title)
      });
    } else {
      logger.error(`Bloomberg scan failed: ${result.error}`, 'fetch_error', {
        error: result.error
      });
    }

    return {
      success: result.success,
      data: { ideas: result.ideas.length },
      error: result.error
    };
  } catch (error) {
    logger.logError(error, 'bloomberg_scan_error');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process score ideas job
 */
async function processScoreIdeas(logger: InstanceType<typeof PipelineLogger>): Promise<JobResult> {
  try {
    logger.info('Starting idea scoring', 'score_start');
    logger.startStep();

    const scorer = getIdeaScorer();
    const result = await scorer.scorePendingIdeas({ limit: 50 });

    logger.info(`Scored ${result.scored} ideas with ${result.errors} errors`, 'score_complete', {
      scored: result.scored,
      errors: result.errors
    });

    return {
      success: true,
      data: { scored: result.scored, errors: result.errors }
    };
  } catch (error) {
    logger.logError(error, 'score_error');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process select daily job
 * After selecting ideas, creates process_pipeline jobs for each selected idea
 */
async function processSelectDaily(payload: Record<string, unknown>, logger: InstanceType<typeof PipelineLogger>): Promise<JobResult> {
  try {
    const targetCount = (payload.count as number) || 6;
    logger.info(`Selecting top ${targetCount} ideas for today`, 'select_start');
    logger.startStep();

    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount,
      minScore: 55,
      maxPerSource: 3,
    });

    if (!result.success) {
      logger.error(`Selection failed: ${result.error}`, 'select_error');
      return {
        success: false,
        error: result.error
      };
    }

    logger.info(`Selected ${result.selectedCount} ideas`, 'select_complete', {
      selectedCount: result.selectedCount,
      sourceBreakdown: result.sourceBreakdown
    });

    // Create process_pipeline jobs for selected ideas
    const dateStr = new Date().toISOString().split('T')[0];
    const supabase = await createClient();

    logger.info('Fetching selected ideas to create pipeline jobs', 'fetch_selected');
    logger.startStep();

    const { data: selectedIdeas, error: fetchError } = await supabase
      .from('idea_queue')
      .select('id, title, selection_rank')
      .eq('status', 'selected')
      .eq('selected_for_date', dateStr)
      .order('selection_rank', { ascending: true });

    if (fetchError) {
      logger.error(`Error fetching selected ideas: ${fetchError.message}`, 'fetch_error');
      return {
        success: true,
        data: {
          selectedCount: result.selectedCount,
          sourceBreakdown: result.sourceBreakdown,
          pipelineJobsCreated: 0,
          pipelineError: fetchError.message
        }
      };
    }

    // Create pipeline jobs for each selected idea
    if (selectedIdeas && selectedIdeas.length > 0) {
      logger.info(`Creating ${selectedIdeas.length} pipeline jobs`, 'create_jobs');

      const pipelineJobs = selectedIdeas.map((idea, index) => ({
        job_type: 'process_pipeline',
        payload: { idea_id: idea.id, title: idea.title },
        priority: 5 - index,
        max_attempts: 5,
        status: 'pending',
        next_run_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('job_queue')
        .insert(pipelineJobs);

      if (insertError) {
        logger.error(`Error creating pipeline jobs: ${insertError.message}`, 'insert_error');
        return {
          success: true,
          data: {
            selectedCount: result.selectedCount,
            sourceBreakdown: result.sourceBreakdown,
            pipelineJobsCreated: 0,
            pipelineError: insertError.message
          }
        };
      }

      logger.info(`Created ${pipelineJobs.length} pipeline jobs`, 'jobs_created', {
        ideaTitles: selectedIdeas.map((i: { title: string }) => i.title)
      });
    }

    return {
      success: true,
      data: {
        selectedCount: result.selectedCount,
        sourceBreakdown: result.sourceBreakdown,
        pipelineJobsCreated: selectedIdeas?.length || 0
      }
    };
  } catch (error) {
    logger.logError(error, 'select_daily_error');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Process pipeline job with checkpointing
 * If the pipeline fails mid-way, it saves progress and can resume from where it left off
 */
async function processPipeline(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  payload: Record<string, unknown>,
  logger: InstanceType<typeof PipelineLogger>
): Promise<JobResult> {
  try {
    const ideaId = payload.idea_id as string | undefined;
    const dateStr = new Date().toISOString().split('T')[0] || '';

    logger.info(`Fetching idea to process`, 'fetch_idea', { ideaId, date: dateStr });
    logger.startStep();

    // Get the idea to process
    let ideaQuery = supabase
      .from('idea_queue')
      .select('id, title, source_name, full_content, suggested_angle, relevance_score, selection_rank, pipeline_step, pipeline_data');

    if (ideaId) {
      ideaQuery = ideaQuery.eq('id', ideaId);
    } else {
      ideaQuery = ideaQuery
        .or(`status.eq.selected,status.eq.processing`)
        .eq('selected_for_date', dateStr)
        .order('status', { ascending: false })
        .order('selection_rank', { ascending: true })
        .limit(1);
    }

    const { data: ideas, error: fetchError } = await ideaQuery;

    if (fetchError) {
      logger.error(`Failed to fetch idea: ${fetchError.message}`, 'fetch_error');
      return { success: false, error: fetchError.message };
    }

    if (!ideas || ideas.length === 0) {
      logger.info('No ideas to process', 'no_ideas');
      return { success: true, data: { message: 'No ideas to process' } };
    }

    const idea = ideas[0];
    const existingCheckpoint = (idea.pipeline_data || {}) as PipelineCheckpoint;

    logger.info(`Processing: "${idea.title}"`, 'idea_loaded', {
      ideaId: idea.id,
      source: idea.source_name,
      relevanceScore: idea.relevance_score,
      hasCheckpoint: Object.keys(existingCheckpoint).length > 0,
      checkpointStep: idea.pipeline_step
    });

    if (Object.keys(existingCheckpoint).length > 0) {
      logger.info(`Resuming from checkpoint: ${idea.pipeline_step}`, 'resume_checkpoint');
    }

    // Mark as processing
    await supabase
      .from('idea_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', idea.id);

    // Build input
    const inputContent = [
      `TOPIC: ${idea.title}`,
      `SOURCE: ${idea.source_name}`,
      idea.full_content ? `\nSOURCE CONTENT:\n${idea.full_content}` : '',
      idea.suggested_angle ? `\nSUGGESTED ANGLE: ${idea.suggested_angle}` : '',
    ].filter(Boolean).join('\n');

    logger.info('Starting 4-AI pipeline', 'pipeline_start', {
      inputLength: inputContent.length,
      hasAngle: !!idea.suggested_angle
    });

    // Create checkpoint callback to save progress and log each step
    const onCheckpoint = async (step: PipelineStep, checkpoint: PipelineCheckpoint) => {
      logger.info(`Checkpoint: ${step}`, `step_${step}`, {
        stepComplete: step
      });
      await supabase
        .from('idea_queue')
        .update({
          pipeline_step: step,
          pipeline_data: checkpoint,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idea.id);
    };

    // Run the 4-AI pipeline with checkpointing
    logger.startStep();
    const pipeline = getMultiAIPipeline();
    const pipelineResult = await pipeline.runWithCheckpoints(
      {
        content: inputContent,
        inputType: 'raw_text',
        focusAngle: idea.suggested_angle || undefined,
      },
      existingCheckpoint,
      onCheckpoint
    );

    logger.info('Pipeline complete, saving content', 'pipeline_complete', {
      processingTimeMs: pipelineResult.metadata?.processingTimeMs,
      totalTokensUsed: pipelineResult.metadata?.totalTokensUsed,
      compliancePassed: pipelineResult.claudeDraft?.complianceCheck?.passed
    });

    // Extract title from WordPress HTML
    const h1Match = pipelineResult.finalOutput.wordpressPost.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const finalTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : idea.title;

    // Save to content_calendar
    logger.info('Saving to content calendar', 'save_content');
    logger.startStep();

    const { data: contentEntry, error: contentError } = await supabase
      .from('content_calendar')
      .insert({
        title: finalTitle,
        content_type: 'blog_post',
        status: 'review',
        topic: idea.title,
        draft: pipelineResult.geminiDraft.content,
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
      logger.error(`Failed to save content: ${contentError.message}`, 'save_error');
      return { success: false, error: contentError.message };
    }

    // Update idea status to completed
    await supabase
      .from('idea_queue')
      .update({
        status: 'completed',
        content_calendar_id: contentEntry?.id,
        pipeline_step: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', idea.id);

    logger.info(`Content created successfully`, 'content_saved', {
      ideaId: idea.id,
      contentId: contentEntry?.id,
      title: finalTitle,
      seoTags: pipelineResult.finalOutput.seoTags
    });

    return {
      success: true,
      data: {
        ideaId: idea.id,
        title: finalTitle,
        contentId: contentEntry?.id
      }
    };

  } catch (error) {
    logger.logError(error, 'pipeline_error');
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
