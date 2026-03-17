/**
 * Story Selector - Uses Claude to score and select relevant stories
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ContentCategory } from '@arcvest/shared';
import { NewsArticle } from './news-fetcher';
import { RELEVANT_TOPICS, TOPICS_TO_AVOID } from './news-sources';
import { ARCVEST_KNOWLEDGE_CONDENSED } from '../arcvest-knowledge';

export interface ScoredArticle extends NewsArticle {
  relevanceScore: number; // 0-100
  relevanceReason: string;
  suggestedAngle?: string;
  suggestedKeywords?: string[];
  contentCategory?: ContentCategory;
  shouldProcess: boolean;
}

export interface SelectionResult {
  selected: ScoredArticle[];
  rejected: ScoredArticle[];
  totalScored: number;
  processingTimeMs: number;
}

/**
 * Score a batch of articles for relevance to ArcVest content
 */
export async function scoreArticles(
  articles: NewsArticle[],
  options?: { minScore?: number; maxToSelect?: number }
): Promise<SelectionResult> {
  const startTime = Date.now();
  const { minScore = 60, maxToSelect = 5 } = options || {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  // Prepare articles summary for Claude
  const articlesSummary = articles
    .slice(0, 30) // Limit to avoid token limits
    .map((a, i) => `[${i + 1}] "${a.title}" - ${a.sourceName}\n${a.description?.substring(0, 200) || 'No description'}`)
    .join('\n\n');

  const prompt = `You are a content strategist for ArcVest. Use this knowledge to score articles:

${ARCVEST_KNOWLEDGE_CONDENSED}

---

Review these news articles and score each one for relevance to ArcVest's content strategy.

ArcVest publishes content across 4 categories:
1. **market_commentary** — Stocks, sectors, earnings, bonds, commodities, FX, crypto observations
2. **macro_capital_flows** — Passive fund flows, index impact, institutional positioning, capital flows data
3. **real_economy** — AI investments, jobs data, GDP, corporate profits, economic implications
4. **investor_strategies** — Tax strategies, Roth conversions, retirement planning, fee analysis

Score each article on whether it fits ANY of these categories well.

ADDITIONAL TOPICS WE COVER:
${RELEVANT_TOPICS.join(', ')}

TOPICS TO AVOID:
${TOPICS_TO_AVOID.join(', ')}

ARTICLES TO SCORE:
${articlesSummary}

For each article, provide:
1. A relevance score from 0-100 (100 = perfect fit, 0 = not relevant)
2. A brief reason why
3. The best-fit content category
4. If score >= 60, suggest an angle for an ArcVest blog post
5. If score >= 60, suggest 3-5 SEO keywords

Respond in JSON format:
{
  "scores": [
    {
      "index": 1,
      "score": 85,
      "category": "market_commentary",
      "reason": "Directly relevant to market commentary",
      "angle": "What this week's earnings tell us about the consumer",
      "keywords": ["earnings", "market commentary", "consumer spending"]
    },
    {
      "index": 2,
      "score": 30,
      "category": "market_commentary",
      "reason": "Too focused on day trading, not our audience"
    }
  ]
}

Only include articles in your response. Output valid JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Use Sonnet for scoring (faster/cheaper)
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content.find(c => c.type === 'text')?.text || '';

    // Parse JSON response
    let scores: Array<{
      index: number;
      score: number;
      reason: string;
      category?: string;
      angle?: string;
      keywords?: string[];
    }> = [];

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scores = parsed.scores || [];
      }
    } catch (e) {
      console.error('[StorySelector] Failed to parse scores JSON:', e);
    }

    // Map scores back to articles
    const validCategories = ['market_commentary', 'macro_capital_flows', 'real_economy', 'investor_strategies'];
    const scoredArticles: ScoredArticle[] = articles.slice(0, 30).map((article, i) => {
      const scoreData = scores.find(s => s.index === i + 1);
      return {
        ...article,
        relevanceScore: scoreData?.score || 0,
        relevanceReason: scoreData?.reason || 'Not scored',
        suggestedAngle: scoreData?.angle,
        suggestedKeywords: scoreData?.keywords,
        contentCategory: (scoreData?.category && validCategories.includes(scoreData.category)
          ? scoreData.category
          : undefined) as ContentCategory | undefined,
        shouldProcess: (scoreData?.score || 0) >= minScore,
      };
    });

    // Sort by score and split into selected/rejected
    const sorted = scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selected = sorted.filter(a => a.shouldProcess).slice(0, maxToSelect);
    const rejected = sorted.filter(a => !selected.includes(a));

    console.log(`[StorySelector] Selected ${selected.length} articles, rejected ${rejected.length}`);

    return {
      selected,
      rejected,
      totalScored: scoredArticles.length,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[StorySelector] Error scoring articles:', error);
    throw error;
  }
}

/**
 * Score a single article (for real-time evaluation)
 */
export async function scoreSingleArticle(article: NewsArticle): Promise<ScoredArticle> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `You are a content strategist for ArcVest. Use this knowledge to score:

${ARCVEST_KNOWLEDGE_CONDENSED}

ArcVest content categories: market_commentary, macro_capital_flows, real_economy, investor_strategies.

Score this news article for relevance to ArcVest's content strategy across any category:

TITLE: ${article.title}
SOURCE: ${article.sourceName}
DESCRIPTION: ${article.description}

ADDITIONAL TOPICS: ${RELEVANT_TOPICS.slice(0, 15).join(', ')}
TOPICS TO AVOID: ${TOPICS_TO_AVOID.join(', ')}

Respond with JSON only:
{
  "score": 0-100,
  "category": "market_commentary | macro_capital_flows | real_economy | investor_strategies",
  "reason": "brief explanation",
  "angle": "suggested blog angle if score >= 60",
  "keywords": ["keyword1", "keyword2"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content.find(c => c.type === 'text')?.text || '';

  let scoreData = { score: 0, reason: 'Failed to parse', angle: '', keywords: [] as string[], category: '' };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      scoreData = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Keep default
  }

  const validCats = ['market_commentary', 'macro_capital_flows', 'real_economy', 'investor_strategies'];
  return {
    ...article,
    relevanceScore: scoreData.score,
    relevanceReason: scoreData.reason,
    suggestedAngle: scoreData.angle,
    suggestedKeywords: scoreData.keywords,
    contentCategory: (validCats.includes(scoreData.category) ? scoreData.category : undefined) as ContentCategory | undefined,
    shouldProcess: scoreData.score >= 60,
  };
}
