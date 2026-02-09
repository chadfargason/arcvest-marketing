/**
 * Google Ads Optimization Cron
 *
 * Scheduled to run daily at 6am CT (12:00 UTC)
 * Runs autonomous optimization rules on campaigns
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdsOptimizer } from '@/lib/google/ads-optimizer';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/cron/ads-optimize
 * Called by Vercel Cron daily
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron sends x-vercel-cron: 1)
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[Ads Optimize Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Ads Optimize Cron] Starting scheduled optimization (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  try {
    const optimizer = getAdsOptimizer();

    // Run optimizations
    const result = await optimizer.runOptimizations();

    // Check budget pacing
    await optimizer.checkBudgetPacing();

    console.log('[Ads Optimize Cron] Complete:', result);

    // Log to activity log if any optimizations were applied
    if (result.applied > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      await supabase.from('activity_log').insert({
        actor: 'paid_media_agent',
        action: 'optimizations_applied',
        entity_type: 'campaigns',
        details: {
          total: result.total,
          applied: result.applied,
          skipped: result.skipped,
          failed: result.failed,
          results: result.results.slice(0, 10), // First 10 for summary
        },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[Ads Optimize Cron] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Optimization cron failed',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max (optimization takes longer)
