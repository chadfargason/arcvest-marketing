/**
 * Source Adapters Module
 *
 * Modular content discovery from email, RSS, and other sources.
 */

// Types
export type {
  SourceType,
  IdeaStatus,
  SourceAdapterConfig,
  IdeaCandidate,
  FetchResult,
  SourceAdapter,
  EmailSourceConfig,
  RSSSourceConfig,
  IdeaQueueRecord,
  SourceStats,
} from './types';

// Registry
export {
  SourceRegistry,
  getSourceRegistry,
  resetSourceRegistry,
  generateContentHash,
  ideaToRecord,
} from './registry';

// Adapters
export {
  BaseEmailAdapter,
  BloombergAdapter,
  AbnormalReturnsAdapter,
  LarrySwedroeAdapter,
  MichaelGreenAdapter,
  GeneralInboxAdapter,
  RSSAdapter,
  initializeAdapters,
} from './adapters';
