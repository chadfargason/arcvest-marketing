import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get all campaigns
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, platform, type, status, objective, daily_budget, lifetime_budget, budget_monthly, meta_campaign_id, google_ads_campaign_id')
      .in('status', ['active', 'paused'])
      .order('name');

    if (error) throw error;

    // Get metrics for the date range for all campaigns
    const campaignIds = (campaigns || []).map(c => c.id);

    const { data: metrics } = await supabase
      .from('campaign_metrics')
      .select('campaign_id, impressions, clicks, cost, conversions, conversion_value')
      .in('campaign_id', campaignIds)
      .gte('date', since);

    // Aggregate metrics per campaign
    const metricsMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number; conversion_value: number }>();
    for (const m of metrics || []) {
      const existing = metricsMap.get(m.campaign_id) || { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 };
      existing.impressions += m.impressions || 0;
      existing.clicks += m.clicks || 0;
      existing.cost += parseFloat(m.cost as string || '0');
      existing.conversions += m.conversions || 0;
      existing.conversion_value += parseFloat(m.conversion_value as string || '0');
      metricsMap.set(m.campaign_id, existing);
    }

    // Also get Meta insights for Meta campaigns (since some might not be in campaign_metrics yet)
    const metaCampaignIds = (campaigns || [])
      .filter(c => c.platform === 'meta' && c.meta_campaign_id)
      .map(c => c.meta_campaign_id);

    if (metaCampaignIds.length > 0) {
      const { data: metaInsights } = await supabase
        .from('meta_insights')
        .select('meta_object_id, impressions, clicks, spend, reach, actions')
        .eq('object_type', 'campaign')
        .in('meta_object_id', metaCampaignIds)
        .gte('date', since);

      // For Meta campaigns that don't have campaign_metrics, use meta_insights
      for (const campaign of campaigns || []) {
        if (campaign.platform === 'meta' && campaign.meta_campaign_id && !metricsMap.has(campaign.id)) {
          const campaignInsights = (metaInsights || []).filter(i => i.meta_object_id === campaign.meta_campaign_id);
          if (campaignInsights.length > 0) {
            const agg = campaignInsights.reduce((acc, i) => ({
              impressions: acc.impressions + (i.impressions || 0),
              clicks: acc.clicks + (i.clicks || 0),
              cost: acc.cost + parseFloat(i.spend as string || '0'),
              conversions: acc.conversions,
              conversion_value: acc.conversion_value,
            }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 });
            metricsMap.set(campaign.id, agg);
          }
        }
      }
    }

    // Build enriched response
    const enriched = (campaigns || []).map(campaign => {
      const m = metricsMap.get(campaign.id) || { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 };
      return {
        ...campaign,
        impressions: m.impressions,
        clicks: m.clicks,
        spend: m.cost,
        conversions: m.conversions,
        conversion_value: m.conversion_value,
        ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
        cpc: m.clicks > 0 ? m.cost / m.clicks : 0,
        cpa: m.conversions > 0 ? m.cost / m.conversions : 0,
        roas: m.cost > 0 ? m.conversion_value / m.cost : 0,
      };
    });

    // Platform summary
    const googleCampaigns = enriched.filter(c => c.platform === 'google');
    const metaCampaigns = enriched.filter(c => c.platform === 'meta');

    const summarize = (list: typeof enriched) => {
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
    });
  } catch (error) {
    console.error('[Ad Performance API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ad performance' },
      { status: 500 }
    );
  }
}
