import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGA4Client } from '@/lib/google/ga4-client';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

// GET /api/analytics - Get marketing analytics data
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch GA4 data if configured
    let ga4Data = null;
    try {
      const ga4 = getGA4Client();
      const [overview, dailyTraffic, trafficSources, topPages] = await Promise.all([
        ga4.getOverviewMetrics(startDateStr, endDateStr),
        ga4.getDailyMetrics(startDateStr, endDateStr),
        ga4.getTrafficBySource(startDateStr, endDateStr),
        ga4.getTopPages(startDateStr, endDateStr, 10),
      ]);

      ga4Data = {
        overview,
        dailyTraffic,
        trafficSources: trafficSources.slice(0, 10),
        topPages,
      };
    } catch (ga4Error) {
      console.warn('GA4 data fetch failed (may not be configured):', ga4Error);
    }

    // Fetch Google Ads data if configured
    let googleAdsData = null;
    try {
      const googleAds = getGoogleAdsClient();
      const [campaigns, dailyAdsMetrics, accountSummary] = await Promise.all([
        googleAds.getCampaignPerformance(startDateStr, endDateStr),
        googleAds.getDailyMetrics(startDateStr, endDateStr),
        googleAds.getAccountSummary(startDateStr, endDateStr),
      ]);

      googleAdsData = {
        campaigns,
        dailyMetrics: dailyAdsMetrics,
        summary: accountSummary,
      };
    } catch (adsError) {
      console.warn('Google Ads data fetch failed (may not be configured):', adsError);
    }

    // Get lead funnel stats
    const { data: leadFunnel } = await supabase
      .from('lead_funnel_summary')
      .select('*');

    // Get source performance
    const { data: sourcePerformance } = await supabase
      .from('source_performance')
      .select('*');

    // Use Google Ads data if available, otherwise fall back to database
    let totals = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    let aggregatedDailyMetrics: Array<{
      date: string;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    }> = [];
    let campaignSummary: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      budget_monthly: number;
      total_impressions: number;
      total_clicks: number;
      total_cost: number;
      total_conversions: number;
      avg_ctr: number;
      avg_cpc: number;
      avg_cpa: number | null;
    }> = [];

    if (googleAdsData) {
      // Use live Google Ads data
      totals = {
        impressions: googleAdsData.summary.totalImpressions,
        clicks: googleAdsData.summary.totalClicks,
        cost: googleAdsData.summary.totalCost,
        conversions: googleAdsData.summary.totalConversions,
      };
      aggregatedDailyMetrics = googleAdsData.dailyMetrics;
      campaignSummary = googleAdsData.campaigns.map(c => ({
        id: c.id,
        name: c.name,
        type: 'google_ads',
        status: c.status,
        budget_monthly: 0,
        total_impressions: c.impressions,
        total_clicks: c.clicks,
        total_cost: c.cost,
        total_conversions: c.conversions,
        avg_ctr: c.ctr,
        avg_cpc: c.avgCpc,
        avg_cpa: c.costPerConversion,
      }));
    } else {
      // Fall back to database data
      const { data: dbCampaignSummary } = await supabase
        .from('campaign_performance_summary')
        .select('*');

      const { data: dailyMetrics } = await supabase
        .from('campaign_metrics')
        .select('date, impressions, clicks, cost, conversions')
        .gte('date', startDateStr)
        .order('date', { ascending: true });

      // Aggregate daily metrics by date
      const metricsMap = new Map<string, {
        date: string;
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
      }>();

      dailyMetrics?.forEach((metric) => {
        const existing = metricsMap.get(metric.date);
        if (existing) {
          existing.impressions += metric.impressions || 0;
          existing.clicks += metric.clicks || 0;
          existing.cost += parseFloat(metric.cost as string) || 0;
          existing.conversions += metric.conversions || 0;
        } else {
          metricsMap.set(metric.date, {
            date: metric.date,
            impressions: metric.impressions || 0,
            clicks: metric.clicks || 0,
            cost: parseFloat(metric.cost as string) || 0,
            conversions: metric.conversions || 0,
          });
        }
      });

      aggregatedDailyMetrics = Array.from(metricsMap.values());

      totals = dbCampaignSummary?.reduce((acc, campaign) => ({
        impressions: acc.impressions + (campaign.total_impressions || 0),
        clicks: acc.clicks + (campaign.total_clicks || 0),
        cost: acc.cost + parseFloat(campaign.total_cost as string || '0'),
        conversions: acc.conversions + (campaign.total_conversions || 0),
      }), { impressions: 0, clicks: 0, cost: 0, conversions: 0 }) || totals;

      campaignSummary = dbCampaignSummary || [];
    }

    // Get leads by date for the period
    const { data: leadsByDate } = await supabase
      .from('contacts')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Aggregate leads by date
    const leadsMap = new Map<string, number>();
    leadsByDate?.forEach((lead) => {
      const date = lead.created_at.split('T')[0];
      leadsMap.set(date, (leadsMap.get(date) || 0) + 1);
    });

    const leadsByDateAggregated = Array.from(leadsMap.entries()).map(([date, count]) => ({
      date,
      leads: count,
    }));

    // Get total leads and clients for the period
    const { count: totalLeads } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null);

    const { count: totalClients } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'client')
      .gte('status_changed_at', startDate.toISOString());

    // Calculate derived metrics
    const ctr = totals.impressions > 0
      ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
      : '0.00';
    const cpc = totals.clicks > 0
      ? (totals.cost / totals.clicks).toFixed(2)
      : '0.00';
    const cpa = totals.conversions > 0
      ? (totals.cost / totals.conversions).toFixed(2)
      : '0.00';
    const costPerLead = totalLeads && totalLeads > 0
      ? (totals.cost / totalLeads).toFixed(2)
      : '0.00';
    const conversionRate = totalLeads && totalLeads > 0
      ? (((totalClients || 0) / totalLeads) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      period: {
        days,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      overview: {
        totalSpend: totals.cost.toFixed(2),
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        totalConversions: totals.conversions,
        totalLeads: totalLeads || 0,
        totalClients: totalClients || 0,
        ctr,
        cpc,
        cpa,
        costPerLead,
        conversionRate,
      },
      // GA4 website traffic data
      websiteTraffic: ga4Data ? {
        sessions: ga4Data.overview.sessions,
        users: ga4Data.overview.users,
        pageviews: ga4Data.overview.pageviews,
        bounceRate: (ga4Data.overview.bounceRate * 100).toFixed(1),
        avgSessionDuration: Math.round(ga4Data.overview.avgSessionDuration),
        newUsers: ga4Data.overview.newUsers,
        dailyTraffic: ga4Data.dailyTraffic,
        trafficSources: ga4Data.trafficSources,
        topPages: ga4Data.topPages,
      } : null,
      campaigns: campaignSummary || [],
      dailyMetrics: aggregatedDailyMetrics,
      leadsByDate: leadsByDateAggregated,
      leadFunnel: leadFunnel || [],
      sourcePerformance: sourcePerformance || [],
    });
  } catch (error) {
    console.error('Error in GET /api/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
