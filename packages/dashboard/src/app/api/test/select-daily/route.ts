/**
 * Test Endpoint: Select top ideas for today
 *
 * POST /api/test/select-daily
 *
 * Selects the top 8 ideas (configurable) for the content pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailySelectionService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const targetCount = parseInt(url.searchParams.get('count') || '8', 10);
    const minScore = parseInt(url.searchParams.get('minScore') || '60', 10);

    console.log(`[Test] Selecting top ${targetCount} ideas with min score ${minScore}`);

    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount,
      minScore,
    });

    return NextResponse.json({
      success: result.success,
      selectedCount: result.selectedCount,
      sourceBreakdown: result.sourceBreakdown,
      error: result.error,
      selectedIdeas: result.selectedIdeas.map((idea: { rank: number; title: string; sourceName: string; score: number }) => ({
        rank: idea.rank,
        title: idea.title,
        source: idea.sourceName,
        score: idea.score,
      })),
    });
  } catch (error) {
    console.error('[Test] Error selecting ideas:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
