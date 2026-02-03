/**
 * Cron Job: Score Ideas
 *
 * GET /api/cron/score-ideas
 *
 * Scores all pending ideas using Claude AI.
 * Scheduled: Daily at 1:30 PM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIdeaScorer } from '@arcvest/services';

export const maxDuration = 300; // 5 minutes max
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting idea scoring...');

  try {
    const scorer = getIdeaScorer();
    const result = await scorer.scorePendingIdeas({ limit: 50 });

    const stats = await scorer.getStats();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Scoring complete in ${duration}ms: ${result.scored} scored, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      duration,
      scored: result.scored,
      errors: result.errors,
      stats,
    });
  } catch (error) {
    console.error('[Cron] Scoring error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
