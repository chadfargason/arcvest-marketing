/**
 * Google Ads Sync Cron
 *
 * Scheduled to run every 4 hours
 * Syncs campaign metrics, asset performance, and search terms from Google Ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes — more work now

/**
 * GET /api/cron/ads-sync
 * Called by Vercel Cron every 4 hours
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[Ads Sync Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Ads Sync Cron] Starting scheduled sync (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  try {
    const googleAds = getGoogleAdsClient();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ── 1. Sync campaigns & daily metrics (existing) ──
    const campaigns = await googleAds.getCampaignPerformance(startDate, endDate);
    const dailyMetrics = await googleAds.getDailyMetrics(startDate, endDate);

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

    // ── 2. Sync asset performance (headlines & descriptions) ──
    let assetsSynced = 0;
    try {
      const assets = await googleAds.getAssetPerformance(startDate, endDate);
      console.log(`[Ads Sync Cron] Fetched ${assets.length} asset performance records`);

      for (const asset of assets) {
        const table = asset.fieldType === 'HEADLINE' ? 'rsa_headlines' : 'rsa_descriptions';
        const now = new Date().toISOString();

        // Match by text content — update performance data
        const { error } = await supabase
          .from(table)
          .update({
            performance_label: asset.performanceLabel,
            impressions: asset.impressions,
            clicks: asset.clicks,
            cost: asset.cost,
            conversions: asset.conversions,
            ctr: asset.ctr,
            last_synced_at: now,
          })
          .eq('text', asset.assetText);

        if (!error) assetsSynced++;
      }
    } catch (assetErr) {
      console.error('[Ads Sync Cron] Asset performance sync failed:', assetErr);
    }

    // ── 3. Sync search terms ──
    let searchTermsSynced = 0;
    try {
      const searchTerms = await googleAds.getSearchTermReport(startDate, endDate, 500);
      console.log(`[Ads Sync Cron] Fetched ${searchTerms.length} search terms`);

      for (const term of searchTerms) {
        const { error } = await supabase.from('search_terms').upsert({
          campaign_id: term.campaignId,
          ad_group_id: term.adGroupId,
          search_term: term.searchTerm,
          match_type: term.matchType,
          impressions: term.impressions,
          clicks: term.clicks,
          cost: term.cost,
          conversions: term.conversions,
          ctr: term.ctr,
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'campaign_id,ad_group_id,search_term',
        });
        if (!error) searchTermsSynced++;
      }
    } catch (stErr) {
      console.error('[Ads Sync Cron] Search terms sync failed:', stErr);
    }

    // ── 4. Aggregate persona/voice performance (weekly) ──
    try {
      // Only aggregate once per day (check current hour — run at the 0:00/4:00/8:00 UTC cycle that's closest to end of day)
      const currentHour = new Date().getUTCHours();
      if (currentHour >= 20) {
        // Dynamic import to avoid circular dependencies
        const { getAdPerformanceLearner } = await import('@arcvest/services');
        const learner = getAdPerformanceLearner();
        await learner.aggregateWeeklyPerformance();
      }
    } catch (aggErr) {
      console.error('[Ads Sync Cron] Persona/voice aggregation failed:', aggErr);
    }

    console.log(`[Ads Sync Cron] Complete. Campaigns: ${campaignsSynced}, Days: ${daysSynced}, Assets: ${assetsSynced}, Search terms: ${searchTermsSynced}`);

    await supabase.from('activity_log').insert({
      actor: 'paid_media_agent',
      action: 'google_ads_sync_complete',
      entity_type: 'campaign_metrics',
      details: {
        campaigns_synced: campaignsSynced,
        days_synced: daysSynced,
        assets_synced: assetsSynced,
        search_terms_synced: searchTermsSynced,
        date_range: { startDate, endDate },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      campaignsSynced,
      daysSynced,
      assetsSynced,
      searchTermsSynced,
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
