/**
 * RSS News Adapter
 *
 * Wraps the existing news-fetcher to work as a source adapter.
 * Fetches articles from configured RSS feeds.
 */

import { createLogger } from '@arcvest/shared';
import type {
  SourceAdapter,
  SourceAdapterConfig,
  IdeaCandidate,
  FetchResult,
  SourceType,
} from '../types';

const logger = createLogger('rss-adapter');

interface NewsSource {
  id: string;
  name: string;
  type: 'rss' | 'api';
  url: string;
  category: 'markets' | 'retirement' | 'tax' | 'regulatory' | 'general_finance';
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  'content:encoded'?: string;
  guid?: string;
}

// Embedded news sources configuration
const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    type: 'rss',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    type: 'rss',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'cnbc-investing',
    name: 'CNBC Investing',
    type: 'rss',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
    category: 'markets',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'morningstar',
    name: 'Morningstar',
    type: 'rss',
    url: 'https://www.morningstar.com/feeds/rss/articles',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'kiplinger-retirement',
    name: 'Kiplinger Retirement',
    type: 'rss',
    url: 'https://www.kiplinger.com/feed/retirement',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'nerdwallet',
    name: 'NerdWallet',
    type: 'rss',
    url: 'https://www.nerdwallet.com/blog/feed/',
    category: 'general_finance',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'irs-news',
    name: 'IRS News',
    type: 'rss',
    url: 'https://www.irs.gov/newsroom/rss-feeds',
    category: 'tax',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'sec-news',
    name: 'SEC Press Releases',
    type: 'rss',
    url: 'https://www.sec.gov/news/pressreleases.rss',
    category: 'regulatory',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'ssa-news',
    name: 'Social Security News',
    type: 'rss',
    url: 'https://www.ssa.gov/rss/rss-feed.xml',
    category: 'retirement',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'investopedia',
    name: 'Investopedia',
    type: 'rss',
    url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles',
    category: 'general_finance',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'seeking-alpha',
    name: 'Seeking Alpha',
    type: 'rss',
    url: 'https://seekingalpha.com/feed.xml',
    category: 'markets',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'reuters-business',
    name: 'Reuters Business',
    type: 'rss',
    url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
    category: 'markets',
    priority: 'high',
    enabled: true,
  },
];

export class RSSAdapter implements SourceAdapter {
  readonly sourceId = 'rss-news';
  readonly sourceName = 'RSS News Feeds';
  readonly sourceType: SourceType = 'rss';

  async fetch(config: SourceAdapterConfig): Promise<FetchResult> {
    const startTime = Date.now();
    const ideas: IdeaCandidate[] = [];

    try {
      const sources = NEWS_SOURCES.filter(s => s.enabled);
      const hoursBack = 24;
      const maxPerSource = 10;
      const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      logger.info(`Fetching from ${sources.length} RSS sources`);

      // Fetch from all sources in parallel
      const results = await Promise.all(
        sources.map(source => this.fetchFromSource(source))
      );

      // Process results
      for (const articles of results) {
        for (const article of articles) {
          // Filter by date
          if (article.pubDate < cutoffDate) {
            continue;
          }

          ideas.push({
            sourceId: `rss-${article.sourceId}`,
            sourceName: article.sourceName,
            sourceType: 'rss',
            title: article.title,
            summary: article.description,
            fullContent: article.content,
            originalUrl: article.link,
            discoveredAt: new Date(),
            publishedAt: article.pubDate,
            author: article.sourceName,
            tags: this.buildTags(article),
            metadata: {
              category: article.category,
              rssSourceId: article.sourceId,
            },
          });
        }
      }

      // Limit per source
      const bySource = new Map<string, IdeaCandidate[]>();
      for (const idea of ideas) {
        const key = (idea.metadata?.['rssSourceId'] as string) || idea.sourceId;
        const existing = bySource.get(key) || [];
        if (existing.length < maxPerSource) {
          existing.push(idea);
          bySource.set(key, existing);
        }
      }

      const finalIdeas = Array.from(bySource.values()).flat();

      logger.info(`Fetched ${finalIdeas.length} articles from RSS feeds`);

      return {
        success: true,
        ideas: finalIdeas,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch RSS feeds', error);

      return {
        success: false,
        ideas: [],
        error: errorMsg,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Try to fetch from one source as a health check
      const testSource = NEWS_SOURCES.find(s => s.enabled);
      if (!testSource) {
        return { healthy: false, message: 'No enabled RSS sources' };
      }

      const response = await fetch(testSource.url, {
        headers: {
          'User-Agent': 'ArcVest-News-Fetcher/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (response.ok) {
        return { healthy: true, message: `Tested ${testSource.name}` };
      } else {
        return { healthy: false, message: `${testSource.name} returned ${response.status}` };
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchFromSource(source: NewsSource): Promise<Array<{
    id: string;
    sourceId: string;
    sourceName: string;
    title: string;
    description: string;
    link: string;
    pubDate: Date;
    category: string;
    content?: string;
  }>> {
    try {
      logger.debug(`Fetching from ${source.name}...`);

      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'ArcVest-News-Fetcher/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch ${source.name}: ${response.status}`);
        return [];
      }

      const xml = await response.text();
      const items = this.parseRSSXml(xml);

      return items.map((item, index) => ({
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
    } catch (error) {
      logger.error(`Error fetching ${source.name}:`, error);
      return [];
    }
  }

  private parseRSSXml(xml: string): RSSItem[] {
    const items: RSSItem[] = [];
    const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      const item: RSSItem = {};

      const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      if (titleMatch?.[1]) item.title = this.decodeEntities(titleMatch[1].trim());

      const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      if (descMatch?.[1]) item.description = this.decodeEntities(descMatch[1].trim());

      const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      if (linkMatch?.[1]) item.link = linkMatch[1].trim();

      const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      if (dateMatch?.[1]) item.pubDate = dateMatch[1].trim();

      const contentMatch = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
      if (contentMatch?.[1]) item['content:encoded'] = contentMatch[1].trim();

      const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      if (guidMatch?.[1]) item.guid = guidMatch[1].trim();

      if (item.title && item.link) {
        items.push(item);
      }
    }

    return items;
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  private buildTags(article: {
    sourceId: string;
    category: string;
    title: string;
    description: string;
  }): string[] {
    const tags: string[] = ['rss', article.category];

    const combined = `${article.title} ${article.description}`.toLowerCase();

    const topics: [RegExp, string][] = [
      [/\bmarket[s]?\b/, 'markets'],
      [/\bstock[s]?\b/, 'stocks'],
      [/\bbond[s]?\b/, 'bonds'],
      [/\bfed\b|federal reserve/, 'fed'],
      [/\binflation\b/, 'inflation'],
      [/\bretirement\b/, 'retirement'],
      [/\b401\(?k\)?\b/, '401k'],
      [/\bira\b/, 'ira'],
      [/\brmd\b/, 'rmd'],
      [/\bsocial security\b/, 'social-security'],
      [/\bmedicare\b/, 'medicare'],
      [/\btax(es)?\b/, 'taxes'],
      [/\bestate\b/, 'estate-planning'],
      [/\binterest rate/, 'interest-rates'],
      [/\brecession\b/, 'recession'],
      [/\bearnings\b/, 'earnings'],
      [/\bgdp\b/, 'gdp'],
      [/\bemployment|jobs\b/, 'employment'],
    ];

    for (const [pattern, tag] of topics) {
      if (pattern.test(combined) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }
}
