/**
 * News Sourcer Module 1A
 *
 * Scans news sources and selects relevant stories for the content pipeline.
 */

export { NEWS_SOURCES, RELEVANT_TOPICS, TOPICS_TO_AVOID } from './news-sources';
export type { NewsSource } from './news-sources';
export { getEnabledSources, getSourcesByCategory, getHighPrioritySources } from './news-sources';

export { fetchFromSource, fetchAllNews, fetchHighPriorityNews } from './news-fetcher';
export type { NewsArticle } from './news-fetcher';

export { scoreArticles, scoreSingleArticle } from './story-selector';
export type { ScoredArticle, SelectionResult } from './story-selector';

import { fetchAllNews, fetchHighPriorityNews } from './news-fetcher';
import { scoreArticles, type ScoredArticle, type SelectionResult } from './story-selector';

export interface NewsScanResult {
  scanTime: string;
  articlesFound: number;
  articlesScored: number;
  selectedStories: ScoredArticle[];
  topRejected: ScoredArticle[]; // Top 5 rejected for review
  processingTimeMs: number;
}

/**
 * Run a full news scan - fetch and score articles
 */
export async function runNewsScan(options?: {
  highPriorityOnly?: boolean;
  hoursBack?: number;
  minScore?: number;
  maxToSelect?: number;
}): Promise<NewsScanResult> {
  const startTime = Date.now();
  const {
    highPriorityOnly = false,
    hoursBack = 24,
    minScore = 60,
    maxToSelect = 5,
  } = options || {};

  console.log('[NewsSourcer] Starting news scan...');

  // Fetch articles
  const articles = highPriorityOnly
    ? await fetchHighPriorityNews({ hoursBack })
    : await fetchAllNews({ hoursBack });

  console.log(`[NewsSourcer] Found ${articles.length} articles`);

  if (articles.length === 0) {
    return {
      scanTime: new Date().toISOString(),
      articlesFound: 0,
      articlesScored: 0,
      selectedStories: [],
      topRejected: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Score and select
  const selectionResult = await scoreArticles(articles, { minScore, maxToSelect });

  console.log(`[NewsSourcer] Scan complete. Selected ${selectionResult.selected.length} stories.`);

  return {
    scanTime: new Date().toISOString(),
    articlesFound: articles.length,
    articlesScored: selectionResult.totalScored,
    selectedStories: selectionResult.selected,
    topRejected: selectionResult.rejected.slice(0, 5),
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Quick scan - only high priority sources, faster
 */
export async function runQuickScan(): Promise<NewsScanResult> {
  return runNewsScan({
    highPriorityOnly: true,
    hoursBack: 12,
    minScore: 70,
    maxToSelect: 3,
  });
}
