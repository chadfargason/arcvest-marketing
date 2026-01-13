/**
 * Google Ads Sync Cron
 *
 * Scheduled to run every 4 hours
 * Syncs campaign metrics from Google Ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/cron/ads-sync
 * Called by Vercel Cron every 4 hours
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Ads Sync Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Ads Sync Cron] Starting scheduled sync...');

  try {
    const googleAds = getGoogleAdsClient();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sync last 7 days of data
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch campaign performance
    const campaigns = await googleAds.getCampaignPerformance(startDate, endDate);
    const dailyMetrics = await googleAds.getDailyMetrics(startDate, endDate);

    // Sync campaigns
    let campaignsSynced = 0;
    for (const campaign of campaigns) {
      const { error } = await supabase.from('campaigns').upsert({
        google_ads_campaign_id: campaign.id,
        name: campaign.name,
        type: 'google_search',
        status: campaign.status === 'enabled' ? 'active' : campaign.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'google_ads_campaign_id',
      });

      if (!error) campaignsSynced++;
    }

    // Sync daily metrics
    let daysSynced = 0;
    for (const metric of dailyMetrics) {
      const { error } = await supabase.from('daily_metrics').upsert({
        date: metric.date,
        ad_impressions: metric.impressions,
        ad_clicks: metric.clicks,
        ad_cost: metric.cost,
      }, {
        onConflict: 'date',
      });

      if (!error) daysSynced++;
    }

    console.log(`[Ads Sync Cron] Complete. Campaigns: ${campaignsSynced}, Days: ${daysSynced}`);

    // Log to activity log
    await supabase.from('activity_log').insert({
      actor: 'paid_media_agent',
      action: 'google_ads_sync_complete',
      entity_type: 'campaign_metrics',
      details: {
        campaigns_synced: campaignsSynced,
        days_synced: daysSynced,
        date_range: { startDate, endDate },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      campaignsSynced,
      daysSynced,
    });
  } catch (error) {
    console.error('[Ads Sync Cron] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ads sync failed',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max
