/**
 * Cron Job: Daily Selection
 *
 * GET /api/cron/select-daily
 *
 * Selects top 8 ideas for the content pipeline.
 * Scheduled: Daily at 2:00 PM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailySelectionService } from '@arcvest/services';

export const maxDuration = 60; // 1 minute max

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting daily selection...');

  try {
    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount: 8,
      minScore: 55,
      maxPerSource: 2,
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
