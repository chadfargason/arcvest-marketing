/**
 * ArcVest Marketing Automation System
 * Agent Schedules Configuration
 *
 * Defines when each agent runs and what actions they perform.
 * Uses cron expressions for scheduling.
 */

import type { AgentName } from '../types';

export interface ScheduleEntry {
  name: string;
  cron: string;
  description: string;
  enabled: boolean;
}

export interface AgentScheduleConfig {
  agent: AgentName;
  schedules: ScheduleEntry[];
}

/**
 * Simple schedule config for runner.ts
 * Maps agent -> task -> cron schedule
 */
export const agentSchedulesConfig = {
  orchestrator: {
    checkTaskQueue: '*/5 * * * *', // Every 5 minutes
    checkApprovals: '0 9 * * *', // Daily at 9am
    cleanupOldTasks: '0 3 * * 0', // Sunday 3am
  },
  content: {
    checkTasks: '*/15 * * * *', // Every 15 minutes
    suggestTopics: '0 9 * * 1', // Monday 9am
    syncWordpress: '0 */4 * * *', // Every 4 hours
  },
  creative: {
    checkTasks: '*/30 * * * *', // Every 30 minutes
  },
  paidMedia: {
    checkTasks: '*/15 * * * *', // Every 15 minutes
    syncGoogleAds: '0 */4 * * *', // Every 4 hours
    checkBudget: '0 8,12,17 * * *', // 8am, 12pm, 5pm
    optimizeBids: '0 6 * * *', // Daily 6am
  },
  seo: {
    checkTasks: '*/30 * * * *', // Every 30 minutes
    checkRankings: '0 5 * * *', // Daily 5am
    weeklyReport: '0 9 * * 1', // Monday 9am
  },
  analytics: {
    checkTasks: '*/30 * * * *', // Every 30 minutes
    syncGA4: '0 2 * * *', // Daily 2am
    dailyDigest: '0 7 * * *', // Daily 7am
    weeklyReport: '0 8 * * 1', // Monday 8am
    checkKPIs: '0 9,15 * * *', // 9am and 3pm
  },
  research: {
    checkTasks: '*/30 * * * *', // Every 30 minutes
    scanSources: '0 6 * * *', // Daily 6am
    weeklyRoundup: '0 10 * * 5', // Friday 10am
    checkRegulatory: '0 8 * * *', // Daily 8am
  },
  gmail: {
    syncInbox: '*/5 * * * *', // Every 5 minutes
    processInbound: '*/5 * * * *', // Every 5 minutes
    sendScheduled: '*/1 * * * *', // Every minute
  },
};

/**
 * Detailed schedule entries (legacy format)
 */
export const agentSchedulesList: AgentScheduleConfig[] = [
  {
    agent: 'analytics',
    schedules: [
      {
        name: 'syncGoogleAnalytics',
        cron: '0 * * * *', // Every hour at :00
        description: 'Sync metrics from Google Analytics',
        enabled: true,
      },
      {
        name: 'calculateDailyMetrics',
        cron: '0 2 * * *', // Daily at 2:00 AM
        description: 'Calculate and store daily metric rollups',
        enabled: true,
      },
      {
        name: 'generateDailyReport',
        cron: '0 7 * * *', // Daily at 7:00 AM
        description: 'Generate and send daily digest email',
        enabled: true,
      },
      {
        name: 'generateWeeklyReport',
        cron: '0 8 * * 1', // Monday at 8:00 AM
        description: 'Generate and send weekly report',
        enabled: true,
      },
    ],
  },
  {
    agent: 'content',
    schedules: [
      {
        name: 'planWeeklyContent',
        cron: '0 6 * * 1', // Monday at 6:00 AM
        description: "Plan next week's content calendar",
        enabled: true,
      },
      {
        name: 'checkDueContent',
        cron: '0 * * * *', // Every hour at :00
        description: 'Check for content due for creation/publication',
        enabled: true,
      },
      {
        name: 'publishScheduledContent',
        cron: '*/15 * * * *', // Every 15 minutes
        description: 'Publish content scheduled for now',
        enabled: true,
      },
    ],
  },
  {
    agent: 'creative',
    schedules: [
      // Creative agent runs on-demand, triggered by other agents
      {
        name: 'checkPendingCreative',
        cron: '0 */4 * * *', // Every 4 hours
        description: 'Check for pending creative requests',
        enabled: true,
      },
    ],
  },
  {
    agent: 'paid_media',
    schedules: [
      {
        name: 'syncGoogleAds',
        cron: '0 */4 * * *', // Every 4 hours
        description: 'Sync campaign data from Google Ads',
        enabled: true,
      },
      {
        name: 'runOptimizationRules',
        cron: '30 */4 * * *', // Every 4 hours at :30
        description: 'Run bid and keyword optimization rules',
        enabled: true,
      },
      {
        name: 'checkBudgetPacing',
        cron: '0 8 * * *', // Daily at 8:00 AM
        description: 'Check daily budget pacing and alert if needed',
        enabled: true,
      },
    ],
  },
  {
    agent: 'seo',
    schedules: [
      {
        name: 'checkRankings',
        cron: '0 5 * * *', // Daily at 5:00 AM
        description: 'Check keyword rankings',
        enabled: true,
      },
      {
        name: 'weeklyAnalysis',
        cron: '0 7 * * 1', // Monday at 7:00 AM
        description: 'Run weekly SEO analysis and identify opportunities',
        enabled: true,
      },
    ],
  },
  {
    agent: 'research',
    schedules: [
      {
        name: 'scanCompetitors',
        cron: '0 9 * * *', // Daily at 9:00 AM
        description: 'Scan competitor websites for new content',
        enabled: true,
      },
      {
        name: 'scanIndustryNews',
        cron: '0 10 * * *', // Daily at 10:00 AM
        description: 'Scan industry news and RSS feeds',
        enabled: true,
      },
      {
        name: 'generateWeeklyIntelligence',
        cron: '0 10 * * 5', // Friday at 10:00 AM
        description: 'Generate weekly intelligence brief',
        enabled: true,
      },
    ],
  },
  {
    agent: 'orchestrator',
    schedules: [
      {
        name: 'processTaskQueue',
        cron: '*/5 * * * *', // Every 5 minutes
        description: 'Process pending tasks in queue',
        enabled: true,
      },
      {
        name: 'checkApprovalEscalations',
        cron: '0 9 * * *', // Daily at 9:00 AM
        description: 'Check for overdue approvals and send reminders',
        enabled: true,
      },
      {
        name: 'cleanupOldTasks',
        cron: '0 3 * * 0', // Sunday at 3:00 AM
        description: 'Archive completed tasks older than 30 days',
        enabled: true,
      },
    ],
  },
];

/**
 * Get schedule config for a specific agent
 */
export function getAgentSchedule(agent: AgentName): AgentScheduleConfig | undefined {
  return agentSchedulesList.find((config) => config.agent === agent);
}

/**
 * Get all enabled schedules for an agent
 */
export function getEnabledSchedules(agent: AgentName): ScheduleEntry[] {
  const config = getAgentSchedule(agent);
  if (!config) return [];
  return config.schedules.filter((schedule) => schedule.enabled);
}

/**
 * Get all schedules flattened (for global job runner)
 */
export function getAllSchedules(): Array<ScheduleEntry & { agent: AgentName }> {
  return agentSchedulesList.flatMap((config) =>
    config.schedules.map((schedule) => ({
      ...schedule,
      agent: config.agent,
    }))
  );
}

/**
 * Get all enabled schedules flattened
 */
export function getAllEnabledSchedules(): Array<ScheduleEntry & { agent: AgentName }> {
  return getAllSchedules().filter((schedule) => schedule.enabled);
}
