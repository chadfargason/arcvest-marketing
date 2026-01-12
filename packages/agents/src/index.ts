// Base classes
export { BaseAgent, type AgentConfig } from './base/BaseAgent';
export { JobRunner, jobRunner, type Job, type JobConfig } from './base/JobRunner';

// Agents
export { OrchestratorAgent } from './orchestrator/OrchestratorAgent';
export { ContentAgent } from './content/ContentAgent';
export { CreativeAgent } from './creative/CreativeAgent';
export { PaidMediaAgent } from './paid-media/PaidMediaAgent';
export { SEOAgent } from './seo/SEOAgent';
export { AnalyticsAgent } from './analytics/AnalyticsAgent';
export { ResearchAgent } from './research/ResearchAgent';

// Content clients
export { ClaudeClient } from './content/claude-client';
export { WordPressClient } from './content/wordpress-client';

// Analytics clients
export { GA4Client } from './analytics/ga4-client';

// Research utilities
export { getMonitoringConfig, getHighPriorityFeeds } from './research/sources';

// Jobs
export { runGmailSync, gmailSyncHandler, checkGmailConnection } from './jobs/sync-gmail';

// Types from agents
export type { OptimizationRecommendation, BudgetAlert } from './paid-media/PaidMediaAgent';
export type { GoogleRSAAsset, VideoScript } from './creative/CreativeAgent';
export type { KeywordRanking, ContentOpportunity } from './seo/SEOAgent';
export type { DailyMetricsRollup, KPIAlert, WeeklyReportData } from './analytics/AnalyticsAgent';
export type { NewsArticle, CompetitorUpdate, IntelligenceBrief } from './research/ResearchAgent';
export type { Competitor, RSSFeed } from './research/sources';
