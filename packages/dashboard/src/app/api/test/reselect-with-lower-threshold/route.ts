/**
 * Test Endpoint: Reselect with Lower Threshold
 * 
 * GET /api/test/reselect-with-lower-threshold
 * 
 * Manually reselects ideas with a lower threshold (45 instead of 55).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailySelectionService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Reselect] Starting with lower threshold (45)...');

    const selector = getDailySelectionService();
    const result = await selector.selectDaily({
      targetCount: 6,
      minScore: 45, // Lower threshold
      maxPerSource: 3,
    });

    console.log('[Reselect] Result:', result);

    return NextResponse.json({
      success: result.success,
      selectedCount: result.selectedCount,
      sourceBreakdown: result.sourceBreakdown,
      error: result.error,
      message: result.selectedCount > 0 
        ? `Selected ${result.selectedCount} ideas. Now trigger /api/test/trigger-worker to generate content.`
        : 'No ideas met the criteria. Try checking /api/test/check-ideas to see what\'s in the queue.'
    });

  } catch (error) {
    console.error('[Reselect] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
