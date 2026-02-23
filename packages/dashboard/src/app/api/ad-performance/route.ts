import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EnrichedCampaign {
  id: string;
  name: string;
  platform: string;
  type: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const since = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const enriched: EnrichedCampaign[] = [];
    let googleAdsError: string | null = null;

    // --- Google Ads: fetch live from API ---
    try {
      const googleAds = getGoogleAdsClient();
      const googleCampaigns = await googleAds.getCampaignPerformance(since, endDateStr);

      for (const c of googleCampaigns) {
        enriched.push({
          id: `google-${c.id}`,
          name: c.name,
          platform: 'google',
          type: 'google_search',
          status: c.status === 'enabled' ? 'active' : c.status,
          impressions: c.impressions,
          clicks: c.clicks,
          spend: c.cost,
          conversions: c.conversions,
          conversion_value: 0,
          ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
          cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
          cpa: c.conversions > 0 ? c.cost / c.conversions : 0,
          roas: 0,
        });
      }
    } catch (err) {
      googleAdsError = err instanceof Error ? err.message : String(err);
      console.error('[Ad Performance] Google Ads API error:', googleAdsError);
    }

    // --- Meta Ads: fetch from database ---
    const { data: metaDbCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, platform, type, status, meta_campaign_id')
      .eq('platform', 'meta')
      .in('status', ['active', 'paused'])
      .order('name');

    const metaCampaignIds = (metaDbCampaigns || [])
      .filter(c => c.meta_campaign_id)
      .map(c => c.meta_campaign_id);

    if (metaCampaignIds.length > 0) {
      const { data: metaInsights } = await supabase
        .from('meta_insights')
        .select('meta_object_id, impressions, clicks, spend')
        .eq('object_type', 'campaign')
        .in('meta_object_id', metaCampaignIds)
        .gte('date', since);

      for (const campaign of metaDbCampaigns || []) {
        if (!campaign.meta_campaign_id) continue;
        const insights = (metaInsights || []).filter(i => i.meta_object_id === campaign.meta_campaign_id);
        const agg = insights.reduce((acc, i) => ({
          impressions: acc.impressions + (i.impressions || 0),
          clicks: acc.clicks + (i.clicks || 0),
          cost: acc.cost + parseFloat(i.spend as string || '0'),
        }), { impressions: 0, clicks: 0, cost: 0 });

        enriched.push({
          id: campaign.id,
          name: campaign.name,
          platform: 'meta',
          type: campaign.type || 'meta_traffic',
          status: campaign.status,
          impressions: agg.impressions,
          clicks: agg.clicks,
          spend: agg.cost,
          conversions: 0,
          conversion_value: 0,
          ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
          cpc: agg.clicks > 0 ? agg.cost / agg.clicks : 0,
          cpa: 0,
          roas: 0,
        });
      }
    }

    // Platform summary
    const googleCampaigns = enriched.filter(c => c.platform === 'google');
    const metaCampaigns = enriched.filter(c => c.platform === 'meta');

    const summarize = (list: EnrichedCampaign[]) => {
      const totals = list.reduce((acc, c) => ({
        spend: acc.spend + c.spend,
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        conversions: acc.conversions + c.conversions,
        conversion_value: acc.conversion_value + c.conversion_value,
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 });

      return {
        campaigns: list.length,
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
        roas: totals.spend > 0 ? totals.conversion_value / totals.spend : 0,
      };
    };

    return NextResponse.json({
      campaigns: enriched,
      summary: {
        all: summarize(enriched),
        google: summarize(googleCampaigns),
        meta: summarize(metaCampaigns),
      },
      googleAdsError,
      googleAdsConfig: {
        GOOGLE_ADS_CUSTOMER_ID: !!process.env.GOOGLE_ADS_CUSTOMER_ID,
        GOOGLE_ADS_DEVELOPER_TOKEN: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
  } catch (error) {
    console.error('[Ad Performance API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ad performance' },
      { status: 500 }
    );
  }
}
