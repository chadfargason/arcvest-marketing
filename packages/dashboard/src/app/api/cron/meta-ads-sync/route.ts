/**
 * Meta Ads Sync Cron
 *
 * Scheduled to run every 4 hours (offset 30 min from Google Ads sync)
 * Syncs campaigns, ad sets, ads, and insights from Meta
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[Meta Ads Sync Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Meta Ads Sync Cron] Starting scheduled sync (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await service.fullSync(startDate, endDate);

    console.log(`[Meta Ads Sync Cron] Complete. Campaigns: ${result.campaigns}, Ad Sets: ${result.adSets}, Ads: ${result.ads}, Insights: ${result.insights}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.from('activity_log').insert({
      actor: 'meta_ads_cron',
      action: 'meta_ads_sync_complete',
      entity_type: 'meta_campaigns',
      details: {
        ...result,
        date_range: { startDate, endDate },
        trigger: vercelCronHeader === '1' ? 'cron' : 'manual',
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[Meta Ads Sync Cron] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Meta Ads sync failed',
      },
      { status: 500 }
    );
  }
}
