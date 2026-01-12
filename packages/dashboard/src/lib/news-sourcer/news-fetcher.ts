/**
 * News Fetcher - Fetches and parses RSS feeds
 */

import { NewsSource, getEnabledSources } from './news-sources';

export interface NewsArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  category: string;
  content?: string;
}

interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  'content:encoded'?: string;
  guid?: string;
}

/**
 * Parse RSS XML into items
 */
function parseRSSXml(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Simple regex-based XML parsing for RSS items
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const item: RSSItem = {};

    // Extract title
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    if (titleMatch) item.title = decodeEntities(titleMatch[1].trim());

    // Extract description
    const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    if (descMatch) item.description = decodeEntities(descMatch[1].trim());

    // Extract link
    const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    if (linkMatch) item.link = linkMatch[1].trim();

    // Extract pubDate
    const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    if (dateMatch) item.pubDate = dateMatch[1].trim();

    // Extract content:encoded if available
    const contentMatch = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
    if (contentMatch) item['content:encoded'] = contentMatch[1].trim();

    // Extract guid
    const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    if (guidMatch) item.guid = guidMatch[1].trim();

    if (item.title && item.link) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Decode HTML entities
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim();
}

/**
 * Fetch articles from a single RSS source
 */
export async function fetchFromSource(source: NewsSource): Promise<NewsArticle[]> {
  try {
    console.log(`[NewsFetcher] Fetching from ${source.name}...`);

    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'ArcVest-News-Fetcher/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(`[NewsFetcher] Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRSSXml(xml);

    const articles: NewsArticle[] = items.map((item, index) => ({
      id: item.guid || `${source.id}-${Date.now()}-${index}`,
      sourceId: source.id,
      sourceName: source.name,
      title: item.title || 'Untitled',
      description: item.description || '',
      link: item.link || '',
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      category: source.category,
      content: item['content:encoded'],
    }));

    console.log(`[NewsFetcher] Got ${articles.length} articles from ${source.name}`);
    return articles;
  } catch (error) {
    console.error(`[NewsFetcher] Error fetching ${source.name}:`, error);
    return [];
  }
}

/**
 * Fetch articles from all enabled sources
 */
export async function fetchAllNews(options?: {
  maxPerSource?: number;
  hoursBack?: number;
}): Promise<NewsArticle[]> {
  const { maxPerSource = 10, hoursBack = 24 } = options || {};
  const sources = getEnabledSources();
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  console.log(`[NewsFetcher] Fetching from ${sources.length} sources...`);

  // Fetch from all sources in parallel
  const results = await Promise.all(
    sources.map(source => fetchFromSource(source))
  );

  // Flatten and filter
  let allArticles = results.flat();

  // Filter by date
  allArticles = allArticles.filter(article => article.pubDate >= cutoffDate);

  // Limit per source
  const bySource = new Map<string, NewsArticle[]>();
  for (const article of allArticles) {
    const existing = bySource.get(article.sourceId) || [];
    if (existing.length < maxPerSource) {
      existing.push(article);
      bySource.set(article.sourceId, existing);
    }
  }

  // Flatten and sort by date (newest first)
  const filtered = Array.from(bySource.values())
    .flat()
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  console.log(`[NewsFetcher] Total articles after filtering: ${filtered.length}`);
  return filtered;
}

/**
 * Fetch articles from high-priority sources only
 */
export async function fetchHighPriorityNews(options?: {
  maxPerSource?: number;
  hoursBack?: number;
}): Promise<NewsArticle[]> {
  const { maxPerSource = 5, hoursBack = 24 } = options || {};
  const sources = getEnabledSources().filter(s => s.priority === 'high');
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  console.log(`[NewsFetcher] Fetching from ${sources.length} high-priority sources...`);

  const results = await Promise.all(
    sources.map(source => fetchFromSource(source))
  );

  let allArticles = results.flat();
  allArticles = allArticles.filter(article => article.pubDate >= cutoffDate);

  // Limit per source
  const bySource = new Map<string, NewsArticle[]>();
  for (const article of allArticles) {
    const existing = bySource.get(article.sourceId) || [];
    if (existing.length < maxPerSource) {
      existing.push(article);
      bySource.set(article.sourceId, existing);
    }
  }

  return Array.from(bySource.values())
    .flat()
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
