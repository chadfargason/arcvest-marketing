/**
 * SEO Agent
 *
 * Tracks keyword rankings, identifies content opportunities,
 * and creates content briefs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../base/BaseAgent';
import { ClaudeClient } from '../content/claude-client';
import type { AgentTask } from '@arcvest/shared';

export interface KeywordRanking {
  keyword: string;
  position: number | null;
  url: string | null;
  previousPosition: number | null;
}

export interface ContentOpportunity {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  currentGap: 'not_ranking' | 'page_2' | 'needs_improvement';
  recommendedAction: string;
}

export class SEOAgent extends BaseAgent {
  private claude: ClaudeClient;

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'seo',
      displayName: 'SEO Agent',
      description: 'Tracks rankings and identifies content opportunities',
      supabase,
    });

    this.claude = new ClaudeClient();
  }

  /**
   * Main run loop.
   */
  async run(): Promise<void> {
    this.logger.debug('Running SEO agent cycle');

    // Process pending tasks
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
   * Execute an SEO task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    // Cast to string to allow internal agent task types
    const taskType = task.type as string;

    switch (taskType) {
      case 'check_rankings':
        return this.checkRankings();

      case 'identify_opportunities':
        return this.identifyContentOpportunities();

      case 'create_content_brief':
        return this.createContentBrief(task.payload);

      case 'analyze_competitors':
        return this.analyzeCompetitorContent(task.payload);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Check rankings for all tracked keywords.
   */
  async checkRankings(): Promise<{ updated: number; changes: number }> {
    this.logger.info('Checking keyword rankings');

    // Get tracked keywords
    const { data: keywords, error } = await this.supabase
      .from('tracked_keywords')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      throw new Error(`Failed to get keywords: ${error.message}`);
    }

    let updated = 0;
    let changes = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const keyword of keywords || []) {
      try {
        // Simulate rank check (in production, use real API like SERPapi)
        const ranking = await this.simulateRankCheck(keyword.keyword, keyword.target_url);

        // Update keyword
        const previousRank = keyword.current_rank;
        await this.supabase
          .from('tracked_keywords')
          .update({
            previous_rank: previousRank,
            current_rank: ranking.position,
            url_ranking: ranking.url,
            last_checked: new Date().toISOString(),
          })
          .eq('id', keyword.id);

        // Record history
        await this.supabase.from('keyword_history').upsert({
          keyword_id: keyword.id,
          date: today,
          rank: ranking.position,
          url: ranking.url,
        });

        updated++;
        if (ranking.position !== previousRank) {
          changes++;

          // Log significant changes
          if (previousRank && ranking.position) {
            const change = previousRank - ranking.position;
            if (Math.abs(change) >= 5) {
              this.logger.info(`Significant rank change for "${keyword.keyword}": ${previousRank} -> ${ranking.position}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to check ranking for "${keyword.keyword}"`, error);
      }
    }

    this.logger.info(`Rankings updated: ${updated}, changes: ${changes}`);
    return { updated, changes };
  }

  /**
   * Identify content opportunities based on rankings.
   */
  async identifyContentOpportunities(): Promise<{ opportunities: ContentOpportunity[] }> {
    this.logger.info('Identifying content opportunities');

    // Get keywords with ranking data
    const { data: keywords } = await this.supabase
      .from('keyword_rankings_summary')
      .select('*');

    const opportunities: ContentOpportunity[] = [];

    for (const keyword of keywords || []) {
      let opportunity: ContentOpportunity | null = null;

      // Not ranking at all
      if (keyword.position_tier === 'not_ranking') {
        opportunity = {
          keyword: keyword.keyword,
          searchVolume: keyword.search_volume || 0,
          difficulty: keyword.difficulty || 50,
          currentGap: 'not_ranking',
          recommendedAction: 'Create new content targeting this keyword',
        };
      }
      // Ranking on page 2 (positions 11-20)
      else if (keyword.position_tier === 'page_2') {
        opportunity = {
          keyword: keyword.keyword,
          searchVolume: keyword.search_volume || 0,
          difficulty: keyword.difficulty || 50,
          currentGap: 'page_2',
          recommendedAction: 'Optimize existing content or create supporting content',
        };
      }
      // Ranking but could be improved (positions 4-10)
      else if (keyword.position_tier === 'page_1' && keyword.current_rank > 3) {
        opportunity = {
          keyword: keyword.keyword,
          searchVolume: keyword.search_volume || 0,
          difficulty: keyword.difficulty || 50,
          currentGap: 'needs_improvement',
          recommendedAction: 'Enhance content and build backlinks',
        };
      }

      if (opportunity) {
        opportunities.push(opportunity);

        // Save to database
        await this.supabase.from('content_opportunities').upsert({
          keyword: opportunity.keyword,
          search_volume: opportunity.searchVolume,
          difficulty: opportunity.difficulty,
          current_gap: opportunity.currentGap,
          recommended_action: opportunity.recommendedAction,
          status: 'identified',
        });
      }
    }

    this.logger.info(`Identified ${opportunities.length} content opportunities`);
    return { opportunities };
  }

  /**
   * Create a detailed content brief for a keyword.
   */
  async createContentBrief(payload: Record<string, unknown>): Promise<{ briefId: string }> {
    const { keyword, opportunityId } = payload;

    this.logger.info('Creating content brief', { keyword });

    // Generate content brief using Claude
    const briefContent = await this.generateContentBrief(keyword as string);

    // Parse the brief
    const brief = {
      keyword,
      title_suggestions: briefContent.titleSuggestions,
      target_word_count: briefContent.targetWordCount,
      outline: briefContent.outline,
      key_points: briefContent.keyPoints,
      related_keywords: briefContent.relatedKeywords,
      competitor_analysis: briefContent.competitorInsights,
      call_to_action: briefContent.callToAction,
    };

    // Update the opportunity with the brief
    if (opportunityId) {
      await this.supabase
        .from('content_opportunities')
        .update({
          content_brief: brief,
          status: 'planned',
        })
        .eq('id', opportunityId);
    }

    // Create a task for the content agent
    const taskId = await this.createTaskForContentAgent(keyword as string, brief);

    this.logger.info('Content brief created', { keyword, taskId });

    return { briefId: opportunityId as string || taskId };
  }

  /**
   * Generate a content brief using Claude.
   */
  private async generateContentBrief(keyword: string): Promise<{
    titleSuggestions: string[];
    targetWordCount: number;
    outline: string[];
    keyPoints: string[];
    relatedKeywords: string[];
    competitorInsights: string;
    callToAction: string;
  }> {
    const prompt = `Create a detailed content brief for a blog post targeting the keyword "${keyword}" for a fee-only fiduciary financial advisory firm.

The content brief should include:

1. **Title Suggestions** (3 options)
   - SEO-optimized titles that include the keyword naturally

2. **Target Word Count**
   - Recommended length for this topic

3. **Outline**
   - Main sections and subsections

4. **Key Points to Cover**
   - Essential information that must be included

5. **Related Keywords**
   - Secondary keywords to incorporate

6. **Competitor Insights**
   - What top-ranking content typically covers

7. **Call to Action**
   - Appropriate CTA for this content

Format your response as JSON with these exact keys:
{
  "titleSuggestions": ["title1", "title2", "title3"],
  "targetWordCount": 1500,
  "outline": ["Section 1", "Section 2", "Section 3"],
  "keyPoints": ["point1", "point2", "point3"],
  "relatedKeywords": ["keyword1", "keyword2"],
  "competitorInsights": "Brief analysis...",
  "callToAction": "Recommended CTA..."
}`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.5,
      maxTokens: 2048,
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse content brief response');
    }

    // Return defaults if parsing fails
    return {
      titleSuggestions: [`Complete Guide to ${keyword}`],
      targetWordCount: 1500,
      outline: ['Introduction', 'Main Content', 'Conclusion'],
      keyPoints: [`Key information about ${keyword}`],
      relatedKeywords: [],
      competitorInsights: 'Manual research recommended',
      callToAction: 'Schedule a consultation',
    };
  }

  /**
   * Create a task for the content agent.
   */
  private async createTaskForContentAgent(
    keyword: string,
    brief: Record<string, unknown>
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .insert({
        type: 'create_outline',
        assigned_agent: 'content',
        payload: {
          topic: (brief['title_suggestions'] as string[] | undefined)?.[0] || keyword,
          targetKeyword: keyword,
          contentBrief: brief,
        },
        priority: 3,
        created_by: this.name,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Analyze competitor content for a keyword.
   */
  async analyzeCompetitorContent(payload: Record<string, unknown>): Promise<{
    insights: string;
    gaps: string[];
  }> {
    const { keyword, competitorUrls } = payload;

    this.logger.info('Analyzing competitor content', { keyword });

    // In production, would fetch and analyze actual competitor content
    // For now, generate insights based on the keyword

    const prompt = `Analyze what successful content about "${keyword}" typically includes for the financial services industry.

Consider:
1. Common topics and sections covered
2. Content depth and length
3. Types of examples and data used
4. Common questions answered
5. Gaps that could be addressed

Provide actionable insights for creating better content.`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.5,
      maxTokens: 1024,
    });

    return {
      insights: result.content,
      gaps: [
        'Personalized examples for different life stages',
        'Interactive calculators or tools',
        'Video content complementing written content',
      ],
    };
  }

  /**
   * Simulate a rank check (replace with real API in production).
   */
  private async simulateRankCheck(
    keyword: string,
    targetUrl: string | null
  ): Promise<{ position: number | null; url: string | null }> {
    // In production, use SERPapi, Google Search Console API, or similar
    // This is a placeholder that returns random-ish data

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return simulated data based on keyword
    const basePosition = keyword.length % 30 + 1;
    const variance = Math.floor(Math.random() * 5) - 2;
    const position = Math.max(1, Math.min(100, basePosition + variance));

    return {
      position: position <= 50 ? position : null,
      url: position <= 50 ? targetUrl : null,
    };
  }

  /**
   * Get ranking trends for a keyword.
   */
  async getRankingTrends(keywordId: string, days: number = 30): Promise<{
    keyword: string;
    history: { date: string; rank: number | null }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: keyword } = await this.supabase
      .from('tracked_keywords')
      .select('keyword')
      .eq('id', keywordId)
      .single();

    const { data: history } = await this.supabase
      .from('keyword_history')
      .select('date, rank')
      .eq('keyword_id', keywordId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    return {
      keyword: keyword?.keyword || '',
      history: history || [],
    };
  }

  /**
   * Add a new keyword to track.
   */
  async addKeyword(params: {
    keyword: string;
    targetUrl: string;
    priority: 'primary' | 'secondary' | 'monitor';
    searchVolume?: number;
    difficulty?: number;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('tracked_keywords')
      .insert({
        keyword: params.keyword,
        target_url: params.targetUrl,
        priority: params.priority,
        search_volume: params.searchVolume,
        difficulty: params.difficulty,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to add keyword: ${error.message}`);
    }

    this.logger.info('Keyword added', { keyword: params.keyword, id: data.id });
    return data.id;
  }

  /**
   * Generate weekly SEO report.
   */
  async generateWeeklyReport(): Promise<{
    summary: string;
    topGainers: { keyword: string; change: number }[];
    topLosers: { keyword: string; change: number }[];
    opportunities: ContentOpportunity[];
  }> {
    // Get keywords with changes
    const { data: keywords } = await this.supabase
      .from('tracked_keywords')
      .select('keyword, current_rank, previous_rank')
      .not('current_rank', 'is', null)
      .not('previous_rank', 'is', null);

    const changes = (keywords || [])
      .map((k) => ({
        keyword: k.keyword,
        change: (k.previous_rank || 0) - (k.current_rank || 0),
      }))
      .filter((k) => k.change !== 0)
      .sort((a, b) => b.change - a.change);

    const topGainers = changes.filter((k) => k.change > 0).slice(0, 5);
    const topLosers = changes.filter((k) => k.change < 0).slice(0, 5);

    // Get opportunities
    const { opportunities } = await this.identifyContentOpportunities();

    const summary = `
Weekly SEO Report:
- ${topGainers.length} keywords improved
- ${topLosers.length} keywords declined
- ${opportunities.length} content opportunities identified
    `.trim();

    return {
      summary,
      topGainers,
      topLosers,
      opportunities: opportunities.slice(0, 5),
    };
  }
}
