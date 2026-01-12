import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/analytics - Get marketing analytics data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get campaign performance summary
    const { data: campaignSummary } = await supabase
      .from('campaign_performance_summary')
      .select('*');

    // Get daily campaign metrics for the chart
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

    const aggregatedDailyMetrics = Array.from(metricsMap.values());

    // Get lead funnel stats
    const { data: leadFunnel } = await supabase
      .from('lead_funnel_summary')
      .select('*');

    // Get source performance
    const { data: sourcePerformance } = await supabase
      .from('source_performance')
      .select('*');

    // Calculate totals from campaign summary
    const totals = campaignSummary?.reduce((acc, campaign) => ({
      impressions: acc.impressions + (campaign.total_impressions || 0),
      clicks: acc.clicks + (campaign.total_clicks || 0),
      cost: acc.cost + parseFloat(campaign.total_cost as string || '0'),
      conversions: acc.conversions + (campaign.total_conversions || 0),
    }), { impressions: 0, clicks: 0, cost: 0, conversions: 0 }) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

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
        endDate: new Date().toISOString().split('T')[0],
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
