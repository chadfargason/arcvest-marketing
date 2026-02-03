/**
 * Test Endpoint: Score pending ideas
 *
 * POST /api/test/score-ideas
 *
 * Scores all pending ideas using Claude AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIdeaScorer } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    console.log(`[Test] Scoring up to ${limit} pending ideas`);

    const scorer = getIdeaScorer();
    const result = await scorer.scorePendingIdeas({ limit });

    // Get updated stats
    const stats = await scorer.getStats();

    return NextResponse.json({
      success: true,
      scored: result.scored,
      errors: result.errors,
      stats,
      topScores: result.results
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(r => ({
          title: r.title,
          score: r.score,
        })),
    });
  } catch (error) {
    console.error('[Test] Error scoring ideas:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
