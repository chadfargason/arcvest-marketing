/**
 * Campaign Sync API
 *
 * POST: Trigger manual sync from Google Ads
 * GET: Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/campaigns/sync
 * Trigger a manual sync from Google Ads
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;

    // Default to last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Campaigns Sync] Starting sync from ${start} to ${end}`);

    const googleAds = getGoogleAdsClient();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch campaign performance from Google Ads
    const campaigns = await googleAds.getCampaignPerformance(start, end);
    const dailyMetrics = await googleAds.getDailyMetrics(start, end);
    const summary = await googleAds.getAccountSummary(start, end);

    // Sync campaigns to database
    for (const campaign of campaigns) {
      // Upsert campaign
      await supabase.from('campaigns').upsert({
        google_ads_campaign_id: campaign.id,
        name: campaign.name,
        type: 'google_search',
        status: campaign.status === 'enabled' ? 'active' : campaign.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'google_ads_campaign_id',
      });
    }

    // Sync daily metrics to database
    for (const metric of dailyMetrics) {
      await supabase.from('daily_metrics').upsert({
        date: metric.date,
        ad_impressions: metric.impressions,
        ad_clicks: metric.clicks,
        ad_cost: metric.cost,
      }, {
        onConflict: 'date',
      });
    }

    return NextResponse.json({
      success: true,
      campaignsSynced: campaigns.length,
      daysSynced: dailyMetrics.length,
      summary,
      dateRange: { startDate: start, endDate: end },
    });
  } catch (error) {
    console.error('[Campaigns Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/sync
 * Check Google Ads connection status
 */
export async function GET() {
  try {
    const googleAds = getGoogleAdsClient();

    // Test the connection by fetching today's summary
    const today = new Date().toISOString().split('T')[0];
    const summary = await googleAds.getAccountSummary(today, today);

    return NextResponse.json({
      connected: true,
      customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
      todaySpend: summary.totalCost,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Connection check failed',
    });
  }
}
