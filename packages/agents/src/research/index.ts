export { ResearchAgent } from './ResearchAgent';
export {
  getMonitoringConfig,
  getCompetitorsByType,
  getFeedsByCategory,
  getHighPriorityFeeds,
  directCompetitors,
  indirectCompetitors,
  aspirationalCompetitors,
  industryFeeds,
  monitoringKeywords,
  excludeKeywords,
} from './sources';
export type {
  Competitor,
  RSSFeed,
  MonitoringConfig,
} from './sources';
export type {
  NewsArticle,
  CompetitorUpdate,
  IntelligenceBrief,
} from './ResearchAgent';
