/**
 * Story Selector - Uses Claude to score and select relevant stories
 */

import Anthropic from '@anthropic-ai/sdk';
import { NewsArticle } from './news-fetcher';
import { RELEVANT_TOPICS, TOPICS_TO_AVOID } from './news-sources';
import { ARCVEST_KNOWLEDGE_CONDENSED } from '../arcvest-knowledge';

export interface ScoredArticle extends NewsArticle {
  relevanceScore: number; // 0-100
  relevanceReason: string;
  suggestedAngle?: string;
  suggestedKeywords?: string[];
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

ADDITIONAL TOPICS WE COVER:
${RELEVANT_TOPICS.join(', ')}

TOPICS TO AVOID:
${TOPICS_TO_AVOID.join(', ')}

ARTICLES TO SCORE:
${articlesSummary}

For each article, provide:
1. A relevance score from 0-100 (100 = perfect fit, 0 = not relevant)
2. A brief reason why
3. If score >= 60, suggest an angle for an ArcVest blog post
4. If score >= 60, suggest 3-5 SEO keywords

Respond in JSON format:
{
  "scores": [
    {
      "index": 1,
      "score": 85,
      "reason": "Directly relevant to retirement planning audience",
      "angle": "How this affects your retirement timeline",
      "keywords": ["retirement planning", "market impact", "portfolio strategy"]
    },
    {
      "index": 2,
      "score": 30,
      "reason": "Too focused on day trading, not our audience"
    }
  ]
}

Only include articles in your response. Output valid JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20251022', // Use Sonnet for scoring (faster/cheaper)
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
    const scoredArticles: ScoredArticle[] = articles.slice(0, 30).map((article, i) => {
      const scoreData = scores.find(s => s.index === i + 1);
      return {
        ...article,
        relevanceScore: scoreData?.score || 0,
        relevanceReason: scoreData?.reason || 'Not scored',
        suggestedAngle: scoreData?.angle,
        suggestedKeywords: scoreData?.keywords,
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

Score this news article for relevance to ArcVest's content strategy:

TITLE: ${article.title}
SOURCE: ${article.sourceName}
DESCRIPTION: ${article.description}

ADDITIONAL TOPICS: ${RELEVANT_TOPICS.slice(0, 10).join(', ')}
TOPICS TO AVOID: ${TOPICS_TO_AVOID.join(', ')}

Respond with JSON only:
{
  "score": 0-100,
  "reason": "brief explanation",
  "angle": "suggested blog angle if score >= 60",
  "keywords": ["keyword1", "keyword2"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20251022',
    max_tokens: 500,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content.find(c => c.type === 'text')?.text || '';

  let scoreData = { score: 0, reason: 'Failed to parse', angle: '', keywords: [] as string[] };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      scoreData = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Keep default
  }

  return {
    ...article,
    relevanceScore: scoreData.score,
    relevanceReason: scoreData.reason,
    suggestedAngle: scoreData.angle,
    suggestedKeywords: scoreData.keywords,
    shouldProcess: scoreData.score >= 60,
  };
}
