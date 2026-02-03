/**
 * Idea Scorer Service
 *
 * Uses Claude AI to score content ideas on relevance to ArcVest's audience.
 * Scores are 0-100 with breakdown by criteria.
 */

import { createLogger } from '@arcvest/shared';
import { getSupabase } from '../supabase';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('idea-scorer');

interface ScoreResult {
  relevanceScore: number;
  scoreReason: string;
  suggestedAngle: string;
  scoreBreakdown: {
    relevance: number;
    timeliness: number;
    uniqueness: number;
    potential: number;
  };
}

interface IdeaToScore {
  id: string;
  title: string;
  summary: string | null;
  full_content: string | null;
  source_name: string;
  original_url: string | null;
  tags: string[] | null;
}

export class IdeaScorer {
  private _supabase: any = null;
  private _anthropic: Anthropic | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabase();
    }
    return this._supabase;
  }

  private get anthropic(): Anthropic {
    if (!this._anthropic) {
      this._anthropic = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'],
      });
    }
    return this._anthropic;
  }

  constructor() {
    // Dependencies are lazy-loaded on first access
  }

  /**
   * Score a single idea
   */
  async scoreIdea(idea: IdeaToScore): Promise<ScoreResult> {
    const content = idea.full_content || idea.summary || '';
    const truncatedContent = content.length > 2000
      ? content.substring(0, 2000) + '...[truncated]'
      : content;

    const prompt = `You are a content strategist for ArcVest, a wealth management firm. Score this content idea for potential as a blog post for our audience of affluent investors and retirees.

Title: ${idea.title}
Source: ${idea.source_name}
Content: ${truncatedContent}
Tags: ${(idea.tags || []).join(', ')}
URL: ${idea.original_url || 'N/A'}

ArcVest focuses on:
- Evidence-based investing (index funds, factor investing)
- Retirement planning and income strategies
- Tax-efficient investing
- Financial planning for high-net-worth individuals
- Market commentary that's educational, not sensational

Score this idea on these criteria (each 0-25 points, total 0-100):
1. Relevance (0-25): How relevant is this to ArcVest's audience?
2. Timeliness (0-25): Is this timely? Will it still be relevant next week?
3. Uniqueness (0-25): Does this offer a unique angle or insight?
4. Potential (0-25): How much potential does this have for a compelling blog post?

Respond with JSON only:
{
  "relevanceScore": <total 0-100>,
  "scoreBreakdown": {
    "relevance": <0-25>,
    "timeliness": <0-25>,
    "uniqueness": <0-25>,
    "potential": <0-25>
  },
  "scoreReason": "<2-3 sentence explanation of the score>",
  "suggestedAngle": "<1-2 sentence suggested angle for a blog post, or 'N/A' if score < 50>"
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const firstContent = response.content[0];
      const text = firstContent && firstContent.type === 'text' ? firstContent.text : '';

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          relevanceScore: parsed.relevanceScore || 0,
          scoreReason: parsed.scoreReason || '',
          suggestedAngle: parsed.suggestedAngle || '',
          scoreBreakdown: parsed.scoreBreakdown || {
            relevance: 0,
            timeliness: 0,
            uniqueness: 0,
            potential: 0,
          },
        };
      }

      throw new Error('Failed to parse Claude response');
    } catch (error) {
      logger.error('Failed to score idea', { ideaId: idea.id, error });
      // Return a default low score on error
      return {
        relevanceScore: 0,
        scoreReason: `Error scoring: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestedAngle: 'N/A',
        scoreBreakdown: { relevance: 0, timeliness: 0, uniqueness: 0, potential: 0 },
      };
    }
  }

  /**
   * Score all pending ideas
   */
  async scorePendingIdeas(options?: { limit?: number }): Promise<{
    scored: number;
    errors: number;
    results: Array<{ id: string; title: string; score: number }>;
  }> {
    const limit = options?.limit || 50;

    // Fetch pending ideas
    const { data: ideas, error } = await this.supabase
      .from('idea_queue')
      .select('id, title, summary, full_content, source_name, original_url, tags')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch pending ideas', error);
      throw error;
    }

    if (!ideas || ideas.length === 0) {
      logger.info('No pending ideas to score');
      return { scored: 0, errors: 0, results: [] };
    }

    logger.info(`Scoring ${ideas.length} pending ideas`);

    const results: Array<{ id: string; title: string; score: number }> = [];
    let errors = 0;

    for (const idea of ideas) {
      try {
        const score = await this.scoreIdea(idea);

        // Update the idea in database
        const { error: updateError } = await this.supabase
          .from('idea_queue')
          .update({
            relevance_score: score.relevanceScore,
            score_reason: score.scoreReason,
            suggested_angle: score.suggestedAngle,
            score_breakdown: score.scoreBreakdown,
            status: 'scored',
            updated_at: new Date().toISOString(),
          })
          .eq('id', idea.id);

        if (updateError) {
          logger.error(`Failed to update idea ${idea.id}`, updateError);
          errors++;
        } else {
          results.push({
            id: idea.id,
            title: idea.title,
            score: score.relevanceScore,
          });
          logger.debug(`Scored: "${idea.title}" = ${score.relevanceScore}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error scoring idea ${idea.id}`, error);
        errors++;
      }
    }

    logger.info(`Scored ${results.length} ideas, ${errors} errors`);
    return { scored: results.length, errors, results };
  }

  /**
   * Get scoring statistics
   */
  async getStats(): Promise<{
    totalPending: number;
    totalScored: number;
    avgScore: number;
    highScoreCount: number;
  }> {
    const { data, error } = await this.supabase
      .from('idea_queue')
      .select('status, relevance_score');

    if (error) {
      throw error;
    }

    const pending = data?.filter(i => i.status === 'pending').length || 0;
    const scored = data?.filter(i => i.status === 'scored').length || 0;
    const scores = data?.filter(i => i.relevance_score !== null).map(i => i.relevance_score) || [];
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const highScoreCount = scores.filter(s => s >= 60).length;

    return { totalPending: pending, totalScored: scored, avgScore, highScoreCount };
  }
}

// Singleton
let scorerInstance: IdeaScorer | null = null;

export function getIdeaScorer(): IdeaScorer {
  if (!scorerInstance) {
    scorerInstance = new IdeaScorer();
  }
  return scorerInstance;
}
