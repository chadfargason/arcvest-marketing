/**
 * Cron Job: Daily Selection
 *
 * GET /api/cron/select-daily?count=6
 *
 * Selects top N ideas for the content pipeline.
 * Use count parameter to specify how many (default: 6 for morning, 2 for evening)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailySelectionService } from '@arcvest/services';

export const maxDuration = 60; // 1 minute max
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetCount = parseInt(url.searchParams.get('count') || '6', 10);

  const startTime = Date.now();
  console.log(`[Cron] Starting selection for ${targetCount} ideas...`);

  try {
    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount,
      minScore: 55,
      maxPerSource: 3,
    });

    const duration = Date.now() - startTime;
    console.log(`[Cron] Selection complete in ${duration}ms: ${result.selectedCount} ideas selected`);

    return NextResponse.json({
      success: result.success,
      duration,
      selectedCount: result.selectedCount,
      sourceBreakdown: result.sourceBreakdown,
      error: result.error,
    });
  } catch (error) {
    console.error('[Cron] Selection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
