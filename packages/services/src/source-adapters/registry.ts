/**
 * Source Adapter Registry
 *
 * Central registry for managing source adapters.
 * Handles adapter registration, fetching, and orchestration.
 */

import { createLogger } from '@arcvest/shared';
import { getSupabase } from '../supabase';
import type {
  SourceAdapter,
  SourceAdapterConfig,
  IdeaCandidate,
  IdeaQueueRecord,
  FetchResult,
} from './types';
import { createHash } from 'crypto';

const logger = createLogger('source-registry');

/**
 * Generates a content hash for deduplication
 */
export function generateContentHash(idea: IdeaCandidate): string {
  const content = `${idea.title}|${idea.originalUrl || ''}|${idea.sourceName}`;
  return createHash('md5').update(content).digest('hex');
}

/**
 * Convert IdeaCandidate to database record
 */
export function ideaToRecord(idea: IdeaCandidate): Omit<IdeaQueueRecord, 'id' | 'created_at' | 'updated_at'> {
  return {
    source_id: idea.sourceId,
    source_name: idea.sourceName,
    source_type: idea.sourceType,
    title: idea.title,
    summary: idea.summary,
    full_content: idea.fullContent,
    original_url: idea.originalUrl,
    content_hash: generateContentHash(idea),
    status: 'pending',
    discovered_at: idea.discoveredAt.toISOString(),
    published_at: idea.publishedAt?.toISOString(),
    author: idea.author,
    tags: idea.tags || [],
    metadata: idea.metadata || {},
  };
}

export class SourceRegistry {
  private adapters: Map<string, SourceAdapter> = new Map();
  private supabase = getSupabase();

  /**
   * Register a source adapter
   */
  register(adapter: SourceAdapter): void {
    if (this.adapters.has(adapter.sourceId)) {
      logger.warn(`Adapter ${adapter.sourceId} already registered, overwriting`);
    }
    this.adapters.set(adapter.sourceId, adapter);
    logger.info(`Registered source adapter: ${adapter.sourceId}`);
  }

  /**
   * Get all registered adapters
   */
  getAll(): SourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get a specific adapter by ID
   */
  get(sourceId: string): SourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  /**
   * Get enabled adapters from database, ordered by priority
   */
  async getEnabledConfigs(): Promise<SourceAdapterConfig[]> {
    const { data, error } = await this.supabase
      .from('source_adapters')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    if (error) {
      logger.error('Failed to fetch enabled adapters', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get config for a specific source
   */
  async getConfig(sourceId: string): Promise<SourceAdapterConfig | null> {
    const { data, error } = await this.supabase
      .from('source_adapters')
      .select('*')
      .eq('source_id', sourceId)
      .single();

    if (error) {
      logger.error(`Failed to fetch config for ${sourceId}`, error);
      return null;
    }

    return data;
  }

  /**
   * Update adapter stats after a fetch
   */
  async updateStats(
    sourceId: string,
    result: FetchResult
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      last_fetch_at: result.fetchedAt.toISOString(),
      last_fetch_count: result.ideas.length,
      updated_at: new Date().toISOString(),
    };

    if (result.success) {
      updates['last_fetch_error'] = null;
      updates['consecutive_failures'] = 0;
      updates['is_healthy'] = true;
      updates['last_success_at'] = result.fetchedAt.toISOString();
    } else {
      updates['last_fetch_error'] = result.error || 'Unknown error';
      // Increment consecutive failures
      const { data: current } = await this.supabase
        .from('source_adapters')
        .select('consecutive_failures')
        .eq('source_id', sourceId)
        .single();

      const failures = ((current as { consecutive_failures?: number })?.consecutive_failures || 0) + 1;
      updates['consecutive_failures'] = failures;
      updates['is_healthy'] = failures < 3; // Mark unhealthy after 3 failures
    }

    await this.supabase
      .from('source_adapters')
      .update(updates)
      .eq('source_id', sourceId);
  }

  /**
   * Save ideas to the idea queue (with deduplication)
   */
  async saveIdeas(ideas: IdeaCandidate[]): Promise<{
    saved: number;
    duplicates: number;
    errors: string[];
  }> {
    const result = { saved: 0, duplicates: 0, errors: [] as string[] };

    for (const idea of ideas) {
      const record = ideaToRecord(idea);

      try {
        // Use upsert with content_hash for deduplication
        const { error } = await this.supabase
          .from('idea_queue')
          .upsert(record, {
            onConflict: 'content_hash',
            ignoreDuplicates: true,
          });

        if (error) {
          if (error.code === '23505') {
            // Unique violation - duplicate
            result.duplicates++;
          } else {
            result.errors.push(`${idea.title}: ${error.message}`);
          }
        } else {
          result.saved++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`${idea.title}: ${msg}`);
      }
    }

    logger.info(`Saved ${result.saved} ideas, ${result.duplicates} duplicates, ${result.errors.length} errors`);
    return result;
  }

  /**
   * Fetch from a specific source
   */
  async fetchSource(sourceId: string): Promise<FetchResult> {
    const adapter = this.adapters.get(sourceId);
    if (!adapter) {
      return {
        success: false,
        ideas: [],
        error: `No adapter registered for ${sourceId}`,
        fetchedAt: new Date(),
        duration: 0,
      };
    }

    const config = await this.getConfig(sourceId);
    if (!config) {
      return {
        success: false,
        ideas: [],
        error: `No config found for ${sourceId}`,
        fetchedAt: new Date(),
        duration: 0,
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        ideas: [],
        error: `Source ${sourceId} is disabled`,
        fetchedAt: new Date(),
        duration: 0,
      };
    }

    const startTime = Date.now();
    logger.info(`Fetching from source: ${sourceId}`);

    try {
      const result = await adapter.fetch(config);
      result.duration = Date.now() - startTime;

      // Update stats
      await this.updateStats(sourceId, result);

      // Save ideas to queue
      if (result.ideas.length > 0) {
        const saveResult = await this.saveIdeas(result.ideas);
        logger.info(`Source ${sourceId}: saved ${saveResult.saved}, duplicates ${saveResult.duplicates}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result: FetchResult = {
        success: false,
        ideas: [],
        error: errorMsg,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };

      await this.updateStats(sourceId, result);
      logger.error(`Failed to fetch from ${sourceId}`, error);

      return result;
    }
  }

  /**
   * Fetch from all enabled sources
   */
  async fetchAll(): Promise<Map<string, FetchResult>> {
    const results = new Map<string, FetchResult>();
    const configs = await this.getEnabledConfigs();

    logger.info(`Fetching from ${configs.length} enabled sources`);

    for (const config of configs) {
      if (this.adapters.has(config.source_id)) {
        const result = await this.fetchSource(config.source_id);
        results.set(config.source_id, result);
      } else {
        logger.warn(`No adapter registered for enabled source: ${config.source_id}`);
      }
    }

    // Summary
    let totalIdeas = 0;
    let totalErrors = 0;
    for (const [, result] of results) {
      totalIdeas += result.ideas.length;
      if (!result.success) totalErrors++;
    }

    logger.info(`Fetch complete: ${totalIdeas} ideas from ${results.size} sources, ${totalErrors} errors`);
    return results;
  }

  /**
   * Fetch from all email sources
   */
  async fetchEmailSources(): Promise<Map<string, FetchResult>> {
    const results = new Map<string, FetchResult>();
    const configs = await this.getEnabledConfigs();

    const emailConfigs = configs.filter(c => c.source_type === 'email');
    logger.info(`Fetching from ${emailConfigs.length} email sources`);

    for (const config of emailConfigs) {
      if (this.adapters.has(config.source_id)) {
        const result = await this.fetchSource(config.source_id);
        results.set(config.source_id, result);
      }
    }

    return results;
  }

  /**
   * Fetch from all RSS sources
   */
  async fetchRSSSources(): Promise<Map<string, FetchResult>> {
    const results = new Map<string, FetchResult>();
    const configs = await this.getEnabledConfigs();

    const rssConfigs = configs.filter(c => c.source_type === 'rss');
    logger.info(`Fetching from ${rssConfigs.length} RSS sources`);

    for (const config of rssConfigs) {
      if (this.adapters.has(config.source_id)) {
        const result = await this.fetchSource(config.source_id);
        results.set(config.source_id, result);
      }
    }

    return results;
  }

  /**
   * Run health checks on all adapters
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; message?: string }>> {
    const results = new Map<string, { healthy: boolean; message?: string }>();

    for (const [sourceId, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        results.set(sourceId, health);
      } catch (error) {
        results.set(sourceId, {
          healthy: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}

// Singleton instance
let registryInstance: SourceRegistry | null = null;

export function getSourceRegistry(): SourceRegistry {
  if (!registryInstance) {
    registryInstance = new SourceRegistry();
  }
  return registryInstance;
}

export function resetSourceRegistry(): void {
  registryInstance = null;
}
