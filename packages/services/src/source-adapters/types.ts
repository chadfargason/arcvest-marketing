/**
 * Source Adapter Types
 *
 * Defines the interface for content source adapters.
 * All adapters implement a common interface for fetching content ideas.
 */

export type SourceType = 'email' | 'rss' | 'website' | 'database' | 'api' | 'manual';

export type IdeaStatus =
  | 'pending'
  | 'scored'
  | 'selected'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'archived';

/**
 * Configuration for a source adapter (stored in DB)
 */
export interface SourceAdapterConfig {
  id: string;
  source_id: string;
  source_name: string;
  source_type: SourceType;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  last_fetch_at: string | null;
  last_fetch_count: number;
  last_fetch_error: string | null;
  is_healthy: boolean;
}

/**
 * A discovered content idea from any source
 */
export interface IdeaCandidate {
  // Source identification
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;

  // Content
  title: string;
  summary?: string;
  fullContent?: string;
  originalUrl?: string;

  // Metadata
  discoveredAt: Date;
  publishedAt?: Date;
  author?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of a source fetch operation
 */
export interface FetchResult {
  success: boolean;
  ideas: IdeaCandidate[];
  error?: string;
  fetchedAt: Date;
  duration: number; // milliseconds
}

/**
 * Interface that all source adapters must implement
 */
export interface SourceAdapter {
  /** Unique identifier for this adapter */
  readonly sourceId: string;

  /** Human-readable name */
  readonly sourceName: string;

  /** Type of source */
  readonly sourceType: SourceType;

  /**
   * Fetch content ideas from the source
   * @param config - Configuration from database
   * @returns Array of discovered ideas
   */
  fetch(config: SourceAdapterConfig): Promise<FetchResult>;

  /**
   * Check if the adapter is properly configured and healthy
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Base class for email-based source adapters
 */
export interface EmailSourceConfig {
  filter: string; // Gmail search query (e.g., "from:bloomberg.com")
  maxItems?: number;
  hoursBack?: number;
  excludeFilters?: string[];
  description?: string;
}

/**
 * Base class for RSS-based source adapters
 */
export interface RSSSourceConfig {
  feeds?: string[];
  maxItemsPerFeed?: number;
  description?: string;
}

/**
 * Idea queue record (matches database schema)
 */
export interface IdeaQueueRecord {
  id?: string;
  created_at?: string;
  updated_at?: string;
  source_id: string;
  source_name: string;
  source_type: SourceType;
  title: string;
  summary?: string;
  full_content?: string;
  original_url?: string;
  content_hash: string;
  relevance_score?: number;
  score_reason?: string;
  suggested_angle?: string;
  score_breakdown?: Record<string, number>;
  status: IdeaStatus;
  selected_for_date?: string;
  selection_rank?: number;
  content_calendar_id?: string;
  discovered_at: string;
  published_at?: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Stats for a source adapter
 */
export interface SourceStats {
  totalIdeasDiscovered: number;
  totalIdeasSelected: number;
  totalIdeasPublished: number;
  avgScore: number | null;
  lastFetchAt: Date | null;
  lastFetchCount: number;
  consecutiveFailures: number;
  isHealthy: boolean;
}
