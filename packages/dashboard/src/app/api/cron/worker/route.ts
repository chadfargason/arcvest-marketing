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
import { createServiceClient as createClient } from '@/lib/supabase/server';
import { getMultiAIPipeline, type PipelineCheckpoint, type PipelineStep } from '@/lib/content-pipeline';
import { getIdeaScorer, getDailySelectionService, getSourceRegistry, initializeAdapters, PipelineLogger } from '@arcvest/services';
import { runNewsScan, fetchAllNews } from '@/lib/news-sourcer';
import { createHash } from 'crypto';

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
type JobType = 'news_scan' | 'email_scan' | 'bloomberg_scan' | 'score_ideas' | 'select_daily' | 'process_pipeline' | 'daily_market_blog';

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

      case 'daily_market_blog':
        result = await processDailyMarketBlog(supabase, logger);
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

    // Fetch raw articles from all RSS sources
    const articles = await fetchAllNews({ hoursBack: 24 });

    logger.info(`Fetched ${articles.length} articles from RSS feeds`, 'fetch_complete', {
      articlesFound: articles.length,
    });

    // Insert all articles into idea_queue as 'pending' for the scoring pipeline
    let saved = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const article of articles) {
      const hash = createHash('md5')
        .update(`${article.title}|${article.link}|${article.sourceName}`)
        .digest('hex');

      const { error } = await supabase
        .from('idea_queue')
        .upsert({
          source_id: article.sourceId,
          source_name: article.sourceName,
          source_type: 'rss',
          title: article.title,
          summary: article.description || null,
          full_content: article.content || null,
          original_url: article.link,
          content_hash: hash,
          status: 'pending',
          discovered_at: article.pubDate.toISOString(),
          tags: [],
          metadata: { category: article.category },
        }, {
          onConflict: 'content_hash',
          ignoreDuplicates: true,
        });

      if (error) {
        if (error.code === '23505') {
          duplicates++;
        } else {
          errors.push(`${article.title}: ${error.message}`);
        }
      } else {
        saved++;
      }
    }

    logger.info(`Inserted ${saved} new ideas, ${duplicates} duplicates, ${errors.length} errors`, 'insert_complete', {
      saved,
      duplicates,
      errors: errors.slice(0, 5),
    });

    // Log the scan to activity_log
    await supabase.from('activity_log').insert({
      type: 'news_scan',
      description: `News scan completed. Found ${articles.length} articles, saved ${saved} new ideas to queue.`,
      metadata: {
        articlesFound: articles.length,
        saved,
        duplicates,
        errorCount: errors.length,
      },
    });

    return {
      success: true,
      data: {
        articlesFound: articles.length,
        saved,
        duplicates,
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
      minScore: 30, // Lowered to match actual score distribution (most ideas score 25-40 via Haiku)
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
      .select('id, title, selection_rank, content_category')
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
      .select('id, title, source_name, full_content, suggested_angle, relevance_score, selection_rank, pipeline_step, pipeline_data, content_category');

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
    const contentCategory = idea.content_category || undefined;
    const pipelineResult = await pipeline.runWithCheckpoints(
      {
        content: inputContent,
        inputType: 'raw_text',
        focusAngle: idea.suggested_angle || undefined,
        contentCategory,
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
        content_category: idea.content_category || null,
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
          content_category: idea.content_category || 'investor_strategies',
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

// ============================================
// DAILY MARKET BLOG (Web Search + Claude)
// ============================================

/**
 * Generate 1-2 daily market synthesis blog posts using Claude with web search.
 * Uses the Anthropic API directly with the web_search tool to pull live market data
 * and write polished blog posts in a single call.
 */
async function processDailyMarketBlog(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  logger: InstanceType<typeof PipelineLogger>
): Promise<JobResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  logger.info('Starting daily market blog generation', 'start', { date: dateStr });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a writer for ArcVest, a fee-only fiduciary RIA. Your job is to synthesize the day's financial markets and news into one or two short blog posts. These are not market recaps. They are synthesis pieces that identify the thread connecting the day's data points and pull it tight. Voice: direct, confident, plainspoken. Write like a smart friend who happens to manage money, not like a financial journalist or an AI. Short paragraphs. Mix punchy sentences with longer ones that develop a thought. No throat-clearing. No filler. No certainly, moreover, notably, it is worth noting, or remains to be seen. Never start with In today's session or Markets moved. Start with the insight. Use contractions. Be conversational but substantive. You are writing for an audience of successful professionals who are not finance people - they are busy, skeptical of Wall Street, and allergic to jargon. If you must use a financial term, make sure context makes it self-explanatory. Output rules: Write in clean markdown suitable for direct paste into WordPress. Use ## for the title only. No other headers, no bold, no bullet points. Just flowing prose paragraphs. Use standard ASCII characters only - regular hyphens, straight apostrophes, no em dashes, no smart quotes. Structure: If the day's news naturally clusters around one big theme, write one post of roughly 600-800 words. If there are two distinct threads worth pulling, write two posts of 400-600 words each, separated by a single line containing only ---. Each post needs a punchy title as an H2. Each post should follow this arc: (1) Open with the synthesis - the one thing that connects the dots today. State the thesis in the first two sentences. (2) Build the case using the day's actual data - equity moves, rates, commodities, global markets, business headlines - but only the data points that support or complicate your thesis. Do not exhaustively list every market. If the Nikkei is irrelevant to your point, skip it. (3) Close with the ArcVest angle - what this means for real people building long-term wealth. This should feel like the author's own conviction, informed by ArcVest's published thinking on passive investing, behavioral coaching, fee transparency, and evidence-based allocation. Not a sales pitch. Just perspective. Each post must end with this verbatim disclaimer as its own paragraph: This post is for informational and educational purposes only. Nothing discussed should be construed as investment advice. ArcVest is a registered investment adviser. Past performance is not indicative of future results. Do not output search results, citations, tool calls, or intermediate steps. Output only the final blog post or posts.`,
        messages: [{
          role: 'user',
          content: `Search the web for today's financial news and write the ArcVest daily blog. Find current data on: S&P 500, Nasdaq, Dow levels and key movers. 10-year Treasury yield and Fed commentary. Private credit and private equity headlines. European and Asian markets. US Dollar Index. WTI crude oil, gold, and notable commodity moves. Top 2-3 business and technology headlines relevant to investors. Also search ArcVest.com/articles for any recent articles or insights published by ArcVest and weave relevant perspectives or themes from those articles naturally into the ArcVest angle of the post. This should feel like the author drawing on their own firm's published thinking, not citing an external source. Today's date is ${dateStr}. Use only standard ASCII characters. After searching, output only the final blog post or posts in clean markdown. No search results, no citations, no intermediate steps. Start immediately with the first title.`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error(`Anthropic API error: ${errText}`, 'api_error');
      return { success: false, error: `Anthropic API error: ${response.status}` };
    }

    const data = await response.json();

    // Extract text content from response
    const textBlocks = (data.content || []).filter((b: { type: string }) => b.type === 'text');
    const fullText = textBlocks.map((b: { text: string }) => b.text).join('\n\n');

    if (!fullText || fullText.length < 100) {
      logger.error('Generated content too short or empty', 'validation');
      return { success: false, error: 'Generated content too short' };
    }

    // Split into individual posts if separated by ---
    const posts = fullText.split(/\n---\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 50);

    logger.info(`Generated ${posts.length} blog post(s)`, 'generated', {
      totalLength: fullText.length,
      tokensUsed: data.usage?.output_tokens,
    });

    // Save each post to content_calendar
    let savedCount = 0;
    for (const post of posts) {
      // Extract title from ## heading
      const titleMatch = post.match(/^## (.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : `ArcVest Daily - ${dateStr}`;

      // Generate excerpt (first paragraph after title, trimmed to ~50 words)
      const bodyStart = post.replace(/^## .+\n+/, '');
      const firstPara = bodyStart.split('\n\n')[0] || '';
      const excerpt = firstPara.split(/\s+/).slice(0, 50).join(' ') + '...';

      const { error: insertError } = await supabase.from('content_calendar').insert({
        title,
        content_type: 'blog_post',
        content_category: 'market_commentary',
        status: 'review',
        draft: post,
        final_content: post,
        meta_description: excerpt,
        keywords: 'market commentary, daily markets, investing, ArcVest',
        generation_method: 'automated',
        metadata: {
          source: 'daily_market_blog',
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-6',
          tokens_used: data.usage?.output_tokens,
          web_search_used: true,
        },
      });

      if (insertError) {
        logger.error(`Failed to save post "${title}": ${insertError.message}`, 'save_error');
      } else {
        savedCount++;
        logger.info(`Saved: "${title}"`, 'saved');
      }
    }

    return {
      success: true,
      data: {
        posts_generated: posts.length,
        posts_saved: savedCount,
        date: dateStr,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Daily market blog failed: ${msg}`, 'error');
    return { success: false, error: msg };
  }
}
