// @ts-nocheck
/**
 * Research Agent
 *
 * Monitors competitors, scans industry news, and generates
 * intelligence briefs for content and strategy opportunities.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../base/BaseAgent';
import { ClaudeClient } from '../content/claude-client';
import {
  getMonitoringConfig,
  getHighPriorityFeeds,
  Competitor,
  RSSFeed,
} from './sources';
import type { AgentTask } from '@arcvest/shared';

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  relevanceScore: number;
  keywords: string[];
}

export interface CompetitorUpdate {
  competitorId: string;
  competitorName: string;
  type: 'new_content' | 'social_post' | 'website_change' | 'press_release';
  title: string;
  url: string;
  summary: string;
  discoveredAt: string;
}

export interface IntelligenceBrief {
  id: string;
  type: 'weekly_roundup' | 'competitor_alert' | 'regulatory_alert' | 'opportunity';
  title: string;
  summary: string;
  details: string;
  actionItems: string[];
  sources: { title: string; url: string }[];
  createdAt: string;
}

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  categories?: string[];
}

export class ResearchAgent extends BaseAgent {
  private claude: ClaudeClient;
  private config = getMonitoringConfig();

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'research',
      displayName: 'Research Agent',
      description: 'Monitors competitors and industry news',
      supabase,
    });

    this.claude = new ClaudeClient();
  }

  /**
   * Main run loop.
   */
  async run(): Promise<void> {
    this.logger.debug('Running research agent cycle');

    const tasks = await this.getPendingTasks();
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`Failed to process task ${task.id}`, error);
      }
    }

    await this.updateStatus({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    });
  }

  /**
   * Execute a research task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    switch (task.type) {
      case 'scan_competitor':
        return this.scanCompetitor(task.payload);

      case 'scan_industry_sources':
        return this.scanIndustrySources();

      case 'generate_weekly_roundup':
        return this.generateWeeklyRoundup();

      case 'analyze_article':
        return this.analyzeArticle(task.payload);

      case 'generate_content_opportunity':
        return this.generateContentOpportunity(task.payload);

      case 'check_regulatory_updates':
        return this.checkRegulatoryUpdates();

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Scan a competitor for new content.
   */
  async scanCompetitor(payload: Record<string, unknown>): Promise<{
    updates: CompetitorUpdate[];
    newArticles: number;
  }> {
    const { competitorId } = payload;

    const competitor = this.config.competitors.find(
      (c) => c.domain === competitorId || c.name === competitorId
    );

    if (!competitor) {
      throw new Error(`Competitor not found: ${competitorId}`);
    }

    this.logger.info('Scanning competitor', { name: competitor.name });

    const updates: CompetitorUpdate[] = [];

    if (competitor.monitorBlog) {
      // In production, would scrape the competitor's blog
      // For now, simulate finding content
      const blogUpdates = await this.simulateCompetitorScan(competitor, 'blog');
      updates.push(...blogUpdates);
    }

    if (competitor.monitorSocial && competitor.linkedInUrl) {
      const socialUpdates = await this.simulateCompetitorScan(competitor, 'social');
      updates.push(...socialUpdates);
    }

    // Store updates in database
    for (const update of updates) {
      await this.supabase.from('competitor_updates').upsert({
        competitor_name: update.competitorName,
        update_type: update.type,
        title: update.title,
        url: update.url,
        summary: update.summary,
        discovered_at: update.discoveredAt,
      });
    }

    if (updates.length > 0) {
      this.logger.info(`Found ${updates.length} competitor updates`, {
        competitor: competitor.name,
      });
    }

    return { updates, newArticles: updates.length };
  }

  /**
   * Scan industry RSS feeds.
   */
  async scanIndustrySources(): Promise<{
    articlesFound: number;
    relevantArticles: NewsArticle[];
  }> {
    this.logger.info('Scanning industry sources');

    const feeds = getHighPriorityFeeds();
    const allArticles: NewsArticle[] = [];

    for (const feed of feeds) {
      try {
        const articles = await this.fetchAndParseRSS(feed);
        const relevantArticles = this.filterRelevantArticles(articles);
        allArticles.push(...relevantArticles);
      } catch (error) {
        this.logger.error(`Failed to fetch feed: ${feed.name}`, error);
      }
    }

    // Store relevant articles
    for (const article of allArticles) {
      await this.supabase.from('news_articles').upsert({
        url: article.url,
        title: article.title,
        source: article.source,
        published_at: article.publishedAt,
        summary: article.summary,
        relevance_score: article.relevanceScore,
        keywords: article.keywords,
      });
    }

    this.logger.info(`Found ${allArticles.length} relevant articles`);

    return {
      articlesFound: allArticles.length,
      relevantArticles: allArticles.slice(0, 10), // Top 10
    };
  }

  /**
   * Generate weekly industry roundup.
   */
  async generateWeeklyRoundup(): Promise<IntelligenceBrief> {
    this.logger.info('Generating weekly roundup');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get recent articles
    const { data: articles } = await this.supabase
      .from('news_articles')
      .select('*')
      .gte('published_at', oneWeekAgo.toISOString())
      .order('relevance_score', { ascending: false })
      .limit(20);

    // Get competitor updates
    const { data: competitorUpdates } = await this.supabase
      .from('competitor_updates')
      .select('*')
      .gte('discovered_at', oneWeekAgo.toISOString())
      .order('discovered_at', { ascending: false })
      .limit(10);

    // Use Claude to summarize and generate insights
    const prompt = `Create a weekly intelligence brief for a fee-only fiduciary financial advisory firm based on these industry updates:

## Recent Industry News
${(articles || []).map((a) => `- ${a.title} (${a.source})`).join('\n')}

## Competitor Activity
${(competitorUpdates || []).map((u) => `- ${u.competitor_name}: ${u.title}`).join('\n') || 'No significant competitor activity this week.'}

Generate a brief with:
1. Executive Summary (2-3 sentences)
2. Key Industry Trends (3-5 bullet points)
3. Competitor Insights (if any notable activity)
4. Content Opportunities (topics to write about)
5. Action Items (specific recommendations)

Format as JSON:
{
  "summary": "...",
  "keyTrends": ["...", "..."],
  "competitorInsights": "...",
  "contentOpportunities": ["...", "..."],
  "actionItems": ["...", "..."]
}`;

    let briefContent: {
      summary: string;
      keyTrends: string[];
      competitorInsights: string;
      contentOpportunities: string[];
      actionItems: string[];
    };

    try {
      const result = await this.claude.generateContent(prompt, {
        temperature: 0.5,
        maxTokens: 2048,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        briefContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      this.logger.warn('Failed to parse roundup, using defaults');
      briefContent = {
        summary: 'Weekly industry roundup generated.',
        keyTrends: ['Continue monitoring industry developments.'],
        competitorInsights: 'No significant competitor activity.',
        contentOpportunities: ['Review content calendar.'],
        actionItems: ['Review this week\'s findings.'],
      };
    }

    const brief: IntelligenceBrief = {
      id: `roundup-${Date.now()}`,
      type: 'weekly_roundup',
      title: `Weekly Intelligence Brief - ${new Date().toISOString().split('T')[0]}`,
      summary: briefContent.summary,
      details: `
## Key Industry Trends
${briefContent.keyTrends.map((t) => `- ${t}`).join('\n')}

## Competitor Insights
${briefContent.competitorInsights}

## Content Opportunities
${briefContent.contentOpportunities.map((o) => `- ${o}`).join('\n')}
      `.trim(),
      actionItems: briefContent.actionItems,
      sources: (articles || []).slice(0, 5).map((a) => ({
        title: a.title,
        url: a.url,
      })),
      createdAt: new Date().toISOString(),
    };

    // Store the brief
    await this.supabase.from('intelligence_briefs').insert({
      brief_type: brief.type,
      title: brief.title,
      summary: brief.summary,
      details: brief.details,
      action_items: brief.actionItems,
      sources: brief.sources,
    });

    // Submit for review
    await this.submitForApproval({
      type: 'intelligence_brief',
      title: brief.title,
      summary: brief.summary,
      content: brief,
    });

    // Create content tasks for opportunities
    for (const opportunity of briefContent.contentOpportunities.slice(0, 2)) {
      await this.createContentOpportunityTask(opportunity);
    }

    await this.logActivity({
      action: 'weekly_roundup_generated',
      entityType: 'intelligence_brief',
      entityId: brief.id,
      details: {
        articlesReviewed: articles?.length || 0,
        competitorUpdates: competitorUpdates?.length || 0,
        opportunities: briefContent.contentOpportunities.length,
      },
    });

    return brief;
  }

  /**
   * Analyze a specific article for insights.
   */
  async analyzeArticle(payload: Record<string, unknown>): Promise<{
    summary: string;
    keyTakeaways: string[];
    relevanceToArcVest: string;
    contentIdeas: string[];
  }> {
    const { url, title, content } = payload;

    this.logger.info('Analyzing article', { title });

    const prompt = `Analyze this industry article for a fee-only fiduciary financial advisory firm:

Title: ${title}
URL: ${url}
${content ? `Content: ${content}` : ''}

Provide:
1. Brief summary (2-3 sentences)
2. Key takeaways (3-5 bullet points)
3. Relevance to ArcVest (how this impacts a fee-only fiduciary RIA)
4. Content ideas (potential blog post topics inspired by this article)

Format as JSON.`;

    try {
      const result = await this.claude.generateContent(prompt, {
        temperature: 0.5,
        maxTokens: 1024,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to analyze article');
    }

    return {
      summary: `Analysis of "${title}"`,
      keyTakeaways: ['Review the full article for details'],
      relevanceToArcVest: 'Manual review recommended',
      contentIdeas: [],
    };
  }

  /**
   * Generate content opportunity from research.
   */
  async generateContentOpportunity(payload: Record<string, unknown>): Promise<{
    topic: string;
    brief: string;
    suggestedTitle: string;
    keywords: string[];
  }> {
    const { trend, articles } = payload;

    const prompt = `Based on this industry trend, generate a content opportunity for a fee-only fiduciary financial advisory firm:

Trend: ${trend}
Related Articles: ${JSON.stringify(articles)}

Generate:
1. Topic: A specific topic to write about
2. Brief: 2-3 sentence description of the content
3. Suggested Title: SEO-friendly blog post title
4. Keywords: 5 relevant keywords to target

Format as JSON.`;

    try {
      const result = await this.claude.generateContent(prompt, {
        temperature: 0.7,
        maxTokens: 1024,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const opportunity = JSON.parse(jsonMatch[0]);

        // Create task for content agent
        await this.createContentOpportunityTask(opportunity.topic);

        return opportunity;
      }
    } catch {
      this.logger.warn('Failed to generate content opportunity');
    }

    return {
      topic: trend as string,
      brief: 'Content opportunity based on recent industry trends',
      suggestedTitle: `Understanding ${trend}`,
      keywords: [trend as string],
    };
  }

  /**
   * Check for regulatory updates.
   */
  async checkRegulatoryUpdates(): Promise<{
    updates: NewsArticle[];
    alerts: IntelligenceBrief[];
  }> {
    this.logger.info('Checking regulatory updates');

    const regulatoryFeeds = this.config.rssFeeds.filter(
      (f) => f.category === 'regulatory'
    );

    const updates: NewsArticle[] = [];

    for (const feed of regulatoryFeeds) {
      try {
        const articles = await this.fetchAndParseRSS(feed);

        // Check for important regulatory keywords
        const importantArticles = articles.filter((article) => {
          const text = `${article.title} ${article.summary || ''}`.toLowerCase();
          return (
            text.includes('marketing rule') ||
            text.includes('fiduciary') ||
            text.includes('investment adviser') ||
            text.includes('compliance') ||
            text.includes('enforcement')
          );
        });

        updates.push(...importantArticles);
      } catch (error) {
        this.logger.error(`Failed to fetch regulatory feed: ${feed.name}`, error);
      }
    }

    const alerts: IntelligenceBrief[] = [];

    // Create alerts for high-priority updates
    for (const update of updates.filter((u) => u.relevanceScore > 0.7)) {
      const alert: IntelligenceBrief = {
        id: `regulatory-${Date.now()}`,
        type: 'regulatory_alert',
        title: `Regulatory Alert: ${update.title}`,
        summary: update.summary || 'New regulatory update requires review',
        details: `Source: ${update.source}\nURL: ${update.url}`,
        actionItems: ['Review the full regulatory update', 'Assess compliance implications'],
        sources: [{ title: update.title, url: update.url }],
        createdAt: new Date().toISOString(),
      };

      alerts.push(alert);

      // Submit for immediate review
      await this.submitForApproval({
        type: 'regulatory_alert',
        title: alert.title,
        summary: alert.summary,
        content: alert,
        priority: 'high',
      });
    }

    if (alerts.length > 0) {
      this.logger.warn(`Created ${alerts.length} regulatory alerts`);
    }

    return { updates, alerts };
  }

  /**
   * Simulate competitor scan (replace with actual scraping in production).
   */
  private async simulateCompetitorScan(
    competitor: Competitor,
    source: 'blog' | 'social'
  ): Promise<CompetitorUpdate[]> {
    // In production, would use:
    // - Puppeteer/Playwright for blog scraping
    // - LinkedIn/Twitter APIs for social monitoring
    // For now, return simulated data occasionally

    if (Math.random() > 0.7) {
      return [
        {
          competitorId: competitor.domain,
          competitorName: competitor.name,
          type: source === 'blog' ? 'new_content' : 'social_post',
          title: `${competitor.name} published new ${source === 'blog' ? 'article' : 'post'}`,
          url: `https://${competitor.domain}/${source}`,
          summary: 'Simulated competitor update for development',
          discoveredAt: new Date().toISOString(),
        },
      ];
    }

    return [];
  }

  /**
   * Fetch and parse RSS feed.
   */
  private async fetchAndParseRSS(feed: RSSFeed): Promise<NewsArticle[]> {
    this.logger.debug('Fetching RSS feed', { name: feed.name });

    try {
      // In production, use rss-parser library
      // For now, simulate RSS parsing
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'ArcVest-Research-Agent/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Parse XML response
      const xml = await response.text();
      const items = this.parseRSSXML(xml);

      return items.map((item) => ({
        id: `${feed.name}-${item.link}`,
        title: item.title,
        url: item.link,
        source: feed.name,
        publishedAt: item.pubDate,
        summary: item.contentSnippet,
        relevanceScore: this.calculateRelevanceScore(item),
        keywords: this.extractKeywords(item),
      }));
    } catch (error) {
      this.logger.warn(`Failed to fetch RSS: ${feed.name}`, error);
      // Return simulated data for development
      return this.getSimulatedArticles(feed);
    }
  }

  /**
   * Simple RSS XML parser.
   */
  private parseRSSXML(xml: string): RSSItem[] {
    const items: RSSItem[] = [];

    // Simple regex-based parsing (use a proper XML parser in production)
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const itemXml of itemMatches.slice(0, 10)) {
      const title = this.extractXMLValue(itemXml, 'title');
      const link = this.extractXMLValue(itemXml, 'link');
      const pubDate = this.extractXMLValue(itemXml, 'pubDate');
      const description = this.extractXMLValue(itemXml, 'description');

      if (title && link) {
        items.push({
          title,
          link,
          pubDate: pubDate || new Date().toISOString(),
          contentSnippet: description?.substring(0, 200),
        });
      }
    }

    return items;
  }

  /**
   * Extract value from XML tag.
   */
  private extractXMLValue(xml: string, tag: string): string | undefined {
    const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return (match?.[1] || match?.[2])?.trim();
  }

  /**
   * Filter articles by relevance.
   */
  private filterRelevantArticles(articles: NewsArticle[]): NewsArticle[] {
    return articles.filter((article) => {
      // Check against exclude keywords
      const text = `${article.title} ${article.summary || ''}`.toLowerCase();
      for (const exclude of this.config.excludeKeywords) {
        if (text.includes(exclude.toLowerCase())) {
          return false;
        }
      }

      // Must have minimum relevance score
      return article.relevanceScore >= 0.3;
    });
  }

  /**
   * Calculate relevance score for an article.
   */
  private calculateRelevanceScore(item: RSSItem): number {
    const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
    let score = 0;

    for (const keyword of this.config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 0.15;
      }
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Extract keywords from article.
   */
  private extractKeywords(item: RSSItem): string[] {
    const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
    const found: string[] = [];

    for (const keyword of this.config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    }

    return found;
  }

  /**
   * Get simulated articles for development.
   */
  private getSimulatedArticles(feed: RSSFeed): NewsArticle[] {
    return [
      {
        id: `${feed.name}-1`,
        title: 'Industry Update: Fee-Only Advisors See Growing Demand',
        url: 'https://example.com/article-1',
        source: feed.name,
        publishedAt: new Date().toISOString(),
        summary: 'The trend toward fee-only financial advice continues...',
        relevanceScore: 0.7,
        keywords: ['fee-only', 'fiduciary'],
      },
    ];
  }

  /**
   * Create content opportunity task for content agent.
   */
  private async createContentOpportunityTask(topic: string): Promise<void> {
    await this.supabase.from('agent_tasks').insert({
      type: 'create_outline',
      assigned_agent: 'content',
      payload: {
        topic,
        source: 'research_opportunity',
      },
      priority: 3,
      created_by: this.name,
    });
  }

  /**
   * Get all competitors.
   */
  getCompetitors(): Competitor[] {
    return this.config.competitors;
  }

  /**
   * Add a competitor to monitor.
   */
  async addCompetitor(competitor: Competitor): Promise<void> {
    this.config.competitors.push(competitor);

    await this.supabase.from('competitors').insert({
      name: competitor.name,
      domain: competitor.domain,
      competitor_type: competitor.type,
      monitor_blog: competitor.monitorBlog,
      monitor_social: competitor.monitorSocial,
      linkedin_url: competitor.linkedInUrl,
      twitter_handle: competitor.twitterHandle,
    });
  }
}
