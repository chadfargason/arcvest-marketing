/**
 * ArcVest Marketing Agents Runner
 *
 * Entry point for running all marketing agents.
 * Starts the agent system with scheduled jobs.
 */

import { getSupabase } from '@arcvest/services';
import { createLogger } from '@arcvest/shared';
import { agentSchedulesConfig } from '@arcvest/shared';
import { jobRunner } from './base/JobRunner';
import { OrchestratorAgent } from './orchestrator/OrchestratorAgent';
import { ContentAgent } from './content/ContentAgent';
import { CreativeAgent } from './creative/CreativeAgent';
import { PaidMediaAgent } from './paid-media/PaidMediaAgent';
import { SEOAgent } from './seo/SEOAgent';
import { AnalyticsAgent } from './analytics/AnalyticsAgent';
import { ResearchAgent } from './research/ResearchAgent';
import { gmailSyncHandler, checkGmailConnection } from './jobs/sync-gmail';
import type { BaseAgent } from './base/BaseAgent';

const logger = createLogger('agent-runner');

// Store agent instances
const agents: Map<string, { agent: BaseAgent; initialized: boolean }> = new Map();

/**
 * Initialize all agents.
 */
async function initializeAgents(): Promise<void> {
  logger.info('Initializing agents...');

  // Initialize Supabase connection
  const supabase = getSupabase();

  // Initialize Orchestrator
  const orchestrator = new OrchestratorAgent(supabase);
  await orchestrator.initialize();
  agents.set('orchestrator', { agent: orchestrator, initialized: true });

  // Initialize Content Agent
  const contentAgent = new ContentAgent(supabase);
  await contentAgent.initialize();
  agents.set('content', { agent: contentAgent, initialized: true });

  // Initialize Creative Agent
  const creativeAgent = new CreativeAgent(supabase);
  await creativeAgent.initialize();
  agents.set('creative', { agent: creativeAgent, initialized: true });

  // Initialize Paid Media Agent
  const paidMediaAgent = new PaidMediaAgent(supabase);
  await paidMediaAgent.initialize();
  agents.set('paid_media', { agent: paidMediaAgent, initialized: true });

  // Initialize SEO Agent
  const seoAgent = new SEOAgent(supabase);
  await seoAgent.initialize();
  agents.set('seo', { agent: seoAgent, initialized: true });

  // Initialize Analytics Agent
  const analyticsAgent = new AnalyticsAgent(supabase);
  await analyticsAgent.initialize();
  agents.set('analytics', { agent: analyticsAgent, initialized: true });

  // Initialize Research Agent
  const researchAgent = new ResearchAgent(supabase);
  await researchAgent.initialize();
  agents.set('research', { agent: researchAgent, initialized: true });

  logger.info(`Initialized ${agents.size} agents`);
}

/**
 * Register scheduled jobs for all agents.
 */
function registerJobs(): void {
  logger.info('Registering scheduled jobs...');

  // Get agent instances
  const orchestrator = agents.get('orchestrator')?.agent as OrchestratorAgent;
  const contentAgent = agents.get('content')?.agent as ContentAgent;
  const creativeAgent = agents.get('creative')?.agent as CreativeAgent;
  const paidMediaAgent = agents.get('paid_media')?.agent as PaidMediaAgent;
  const seoAgent = agents.get('seo')?.agent as SEOAgent;
  const analyticsAgent = agents.get('analytics')?.agent as AnalyticsAgent;
  const researchAgent = agents.get('research')?.agent as ResearchAgent;

  if (!orchestrator) {
    throw new Error('Orchestrator not initialized');
  }

  // ===================
  // Orchestrator Jobs
  // ===================
  jobRunner.registerJob(orchestrator, {
    name: 'orchestrator:process_tasks',
    schedule: agentSchedulesConfig.orchestrator.checkTaskQueue,
    handler: async () => orchestrator.run(),
  });

  jobRunner.registerJob(orchestrator, {
    name: 'orchestrator:check_approvals',
    schedule: agentSchedulesConfig.orchestrator.checkApprovals,
    handler: async () => {
      // Check approvals is handled as part of the orchestrator run
      await orchestrator.run();
    },
  });

  // ===================
  // Content Agent Jobs
  // ===================
  if (contentAgent) {
    jobRunner.registerJob(contentAgent, {
      name: 'content:process_tasks',
      schedule: agentSchedulesConfig.content.checkTasks || '*/15 * * * *',
      handler: async () => contentAgent.run(),
    });

    jobRunner.registerJob(contentAgent, {
      name: 'content:suggest_topics',
      schedule: agentSchedulesConfig.content.suggestTopics || '0 9 * * 1', // Monday 9am
      handler: async () => contentAgent.suggestTopics(),
    });
  }

  // ===================
  // Creative Agent Jobs
  // ===================
  if (creativeAgent) {
    jobRunner.registerJob(creativeAgent, {
      name: 'creative:process_tasks',
      schedule: agentSchedulesConfig.creative?.checkTasks || '*/30 * * * *',
      handler: async () => creativeAgent.run(),
    });
  }

  // ===================
  // Paid Media Agent Jobs
  // ===================
  if (paidMediaAgent) {
    jobRunner.registerJob(paidMediaAgent, {
      name: 'paid_media:process_tasks',
      schedule: agentSchedulesConfig.paidMedia.checkTasks || '*/15 * * * *',
      handler: async () => paidMediaAgent.run(),
    });

    jobRunner.registerJob(paidMediaAgent, {
      name: 'paid_media:sync_google_ads',
      schedule: agentSchedulesConfig.paidMedia.syncGoogleAds || '0 */4 * * *', // Every 4 hours
      handler: async () => paidMediaAgent.syncFromGoogleAds(),
    });

    jobRunner.registerJob(paidMediaAgent, {
      name: 'paid_media:check_budget',
      schedule: agentSchedulesConfig.paidMedia.checkBudget || '0 8,12,17 * * *', // 8am, 12pm, 5pm
      handler: async () => paidMediaAgent.checkBudgetPacing(),
    });

    jobRunner.registerJob(paidMediaAgent, {
      name: 'paid_media:optimize_bids',
      schedule: agentSchedulesConfig.paidMedia.optimizeBids || '0 6 * * *', // 6am daily
      handler: async () => paidMediaAgent.optimizeBids({ dryRun: false }),
    });
  }

  // ===================
  // SEO Agent Jobs
  // ===================
  if (seoAgent) {
    jobRunner.registerJob(seoAgent, {
      name: 'seo:process_tasks',
      schedule: agentSchedulesConfig.seo.checkTasks || '*/30 * * * *',
      handler: async () => seoAgent.run(),
    });

    jobRunner.registerJob(seoAgent, {
      name: 'seo:check_rankings',
      schedule: agentSchedulesConfig.seo.checkRankings || '0 5 * * *', // 5am daily
      handler: async () => seoAgent.checkRankings(),
    });

    jobRunner.registerJob(seoAgent, {
      name: 'seo:weekly_report',
      schedule: agentSchedulesConfig.seo.weeklyReport || '0 9 * * 1', // Monday 9am
      handler: async () => seoAgent.generateWeeklyReport(),
    });
  }

  // ===================
  // Analytics Agent Jobs
  // ===================
  if (analyticsAgent) {
    jobRunner.registerJob(analyticsAgent, {
      name: 'analytics:process_tasks',
      schedule: agentSchedulesConfig.analytics?.checkTasks || '*/30 * * * *',
      handler: async () => analyticsAgent.run(),
    });

    jobRunner.registerJob(analyticsAgent, {
      name: 'analytics:sync_ga4',
      schedule: agentSchedulesConfig.analytics?.syncGA4 || '0 2 * * *', // 2am daily
      handler: async () => analyticsAgent.syncGoogleAnalytics(),
    });

    jobRunner.registerJob(analyticsAgent, {
      name: 'analytics:daily_digest',
      schedule: agentSchedulesConfig.analytics?.dailyDigest || '0 7 * * *', // 7am daily
      handler: async () => analyticsAgent.generateDailyDigest(),
    });

    jobRunner.registerJob(analyticsAgent, {
      name: 'analytics:weekly_report',
      schedule: agentSchedulesConfig.analytics?.weeklyReport || '0 8 * * 1', // Monday 8am
      handler: async () => analyticsAgent.generateWeeklyReport(),
    });

    jobRunner.registerJob(analyticsAgent, {
      name: 'analytics:check_kpis',
      schedule: agentSchedulesConfig.analytics?.checkKPIs || '0 9,15 * * *', // 9am, 3pm
      handler: async () => analyticsAgent.checkKPIs(),
    });
  }

  // ===================
  // Research Agent Jobs
  // ===================
  if (researchAgent) {
    jobRunner.registerJob(researchAgent, {
      name: 'research:process_tasks',
      schedule: agentSchedulesConfig.research?.checkTasks || '*/30 * * * *',
      handler: async () => researchAgent.run(),
    });

    jobRunner.registerJob(researchAgent, {
      name: 'research:scan_sources',
      schedule: agentSchedulesConfig.research?.scanSources || '0 6 * * *', // 6am daily
      handler: async () => researchAgent.scanIndustrySources(),
    });

    jobRunner.registerJob(researchAgent, {
      name: 'research:weekly_roundup',
      schedule: agentSchedulesConfig.research?.weeklyRoundup || '0 10 * * 5', // Friday 10am
      handler: async () => researchAgent.generateWeeklyRoundup(),
    });

    jobRunner.registerJob(researchAgent, {
      name: 'research:check_regulatory',
      schedule: agentSchedulesConfig.research?.checkRegulatory || '0 8 * * *', // 8am daily
      handler: async () => researchAgent.checkRegulatoryUpdates(),
    });
  }

  // ===================
  // Gmail Sync Jobs
  // ===================
  // Note: Gmail jobs don't require an agent instance, they use the GmailService directly
  jobRunner.registerJob(orchestrator, {
    name: 'gmail:sync_inbox',
    schedule: agentSchedulesConfig.gmail?.syncInbox || '*/5 * * * *', // Every 5 minutes
    handler: async () => {
      const status = await checkGmailConnection();
      if (status.connected) {
        await gmailSyncHandler();
      }
    },
  });

  logger.info('Registered all scheduled jobs');
}

/**
 * Start the agent system.
 */
async function start(): Promise<void> {
  logger.info('Starting ArcVest Marketing Agents...');

  try {
    // Initialize agents
    await initializeAgents();

    // Register scheduled jobs
    registerJobs();

    // Start the job runner
    jobRunner.start();

    // Start all agents
    for (const [name, { agent }] of agents) {
      await agent.start();
      logger.info(`Started agent: ${name}`);
    }

    logger.info('All agents started successfully');

    // Keep the process running
    process.on('SIGINT', async () => {
      await shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await shutdown();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start agents', error);
    process.exit(1);
  }
}

/**
 * Gracefully shutdown all agents.
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down agents...');

  // Stop the job runner
  jobRunner.stop();

  // Stop all agents
  for (const [name, { agent }] of agents) {
    try {
      await agent.stop();
      logger.info(`Stopped agent: ${name}`);
    } catch (error) {
      logger.error(`Error stopping agent ${name}`, error);
    }
  }

  logger.info('All agents stopped');
}

// Export for testing
export { initializeAgents, registerJobs, start, shutdown, agents };

// Run if this is the main module
start();
