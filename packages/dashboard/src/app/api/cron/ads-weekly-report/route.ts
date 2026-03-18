/**
 * Ads Weekly Report Cron
 *
 * Runs Monday 9am CT (15:00 UTC).
 * Generates a comprehensive weekly performance report and stores it in the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Weekly Report] Generating weekly ads report...');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const googleAds = getGoogleAdsClient();

    // Date ranges
    const now = new Date();
    const thisWeekEnd = now.toISOString().split('T')[0];
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastWeekEnd = thisWeekStart;
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Week start for storage (Monday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStartDate.toISOString().split('T')[0];

    // ── 1. Campaign performance + WoW change ──
    const [thisWeekCampaigns, lastWeekCampaigns] = await Promise.all([
      googleAds.getCampaignPerformance(thisWeekStart, thisWeekEnd),
      googleAds.getCampaignPerformance(lastWeekStart, lastWeekEnd),
    ]);

    const lastWeekMap = new Map(lastWeekCampaigns.map(c => [c.id, c]));

    const campaignPerformance = thisWeekCampaigns.map(c => {
      const prev = lastWeekMap.get(c.id);
      return {
        name: c.name,
        status: c.status,
        impressions: c.impressions,
        clicks: c.clicks,
        cost: Number(c.cost.toFixed(2)),
        conversions: c.conversions,
        ctr: c.ctr,
        avgCpc: c.avgCpc,
        wow: prev ? {
          impressions: c.impressions - prev.impressions,
          clicks: c.clicks - prev.clicks,
          cost: Number((c.cost - prev.cost).toFixed(2)),
          ctrChange: Number((c.ctr - prev.ctr).toFixed(2)),
        } : null,
      };
    });

    // ── 2. Asset insights ──
    const { data: bestHeadlines } = await supabase
      .from('rsa_headlines')
      .select('text, performance_label, impressions, clicks, ctr')
      .in('performance_label', ['BEST', 'GOOD'])
      .gt('impressions', 50)
      .order('ctr', { ascending: false })
      .limit(5);

    const { data: worstHeadlines } = await supabase
      .from('rsa_headlines')
      .select('text, performance_label, impressions, clicks, ctr')
      .eq('performance_label', 'LOW')
      .gt('impressions', 50)
      .order('impressions', { ascending: false })
      .limit(5);

    // ── 3. Experiment status ──
    const { data: experiments } = await supabase
      .from('experiments')
      .select('id, name, status, persona_id, voice_id, daily_budget, created_at')
      .in('status', ['live', 'optimizing', 'completed', 'graduated', 'paused'])
      .order('created_at', { ascending: false })
      .limit(10);

    const experimentSummary = {
      active: (experiments || []).filter(e => e.status === 'live' || e.status === 'optimizing').length,
      completed: (experiments || []).filter(e => e.status === 'completed').length,
      graduated: (experiments || []).filter(e => e.status === 'graduated').length,
      paused: (experiments || []).filter(e => e.status === 'paused').length,
      experiments: experiments || [],
    };

    // ── 4. Optimization actions taken this week ──
    const { data: optimizations } = await supabase
      .from('optimization_log')
      .select('action, entity_name, reason, status, created_at')
      .gte('created_at', thisWeekStart)
      .eq('status', 'applied')
      .order('created_at', { ascending: false })
      .limit(20);

    // ── 5. Top search terms ──
    const { data: topSearchTerms } = await supabase
      .from('search_terms')
      .select('search_term, impressions, clicks, cost, ctr')
      .gt('clicks', 0)
      .order('clicks', { ascending: false })
      .limit(15);

    // ── 6. Account totals ──
    const totalSpend = thisWeekCampaigns.reduce((s, c) => s + c.cost, 0);
    const totalClicks = thisWeekCampaigns.reduce((s, c) => s + c.clicks, 0);
    const totalImpressions = thisWeekCampaigns.reduce((s, c) => s + c.impressions, 0);
    const totalConversions = thisWeekCampaigns.reduce((s, c) => s + c.conversions, 0);

    const prevTotalSpend = lastWeekCampaigns.reduce((s, c) => s + c.cost, 0);

    // ── Build report ──
    const report = {
      weekStart: thisWeekStart,
      weekEnd: thisWeekEnd,
      generatedAt: new Date().toISOString(),

      accountSummary: {
        totalSpend: Number(totalSpend.toFixed(2)),
        totalClicks,
        totalImpressions,
        totalConversions,
        overallCtr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
        avgCpc: totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0,
        wowSpendChange: Number((totalSpend - prevTotalSpend).toFixed(2)),
        wowSpendChangePct: prevTotalSpend > 0
          ? Number((((totalSpend - prevTotalSpend) / prevTotalSpend) * 100).toFixed(1))
          : null,
      },

      campaigns: campaignPerformance,

      assetInsights: {
        bestHeadlines: bestHeadlines || [],
        worstHeadlines: worstHeadlines || [],
      },

      experiments: experimentSummary,
      optimizationActions: optimizations || [],
      topSearchTerms: topSearchTerms || [],

      recommendations: generateRecommendations({
        totalSpend, totalClicks, totalImpressions, totalConversions,
        campaignPerformance, experimentSummary,
        bestHeadlines: bestHeadlines || [],
        worstHeadlines: worstHeadlines || [],
      }),
    };

    // Store report
    await supabase.from('weekly_reports').upsert({
      week_start: weekStartStr,
      report_data: report,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'week_start',
    });

    // Log
    await supabase.from('activity_log').insert({
      actor: 'paid_media_agent',
      action: 'weekly_report_generated',
      entity_type: 'weekly_report',
      details: {
        week_start: weekStartStr,
        total_spend: report.accountSummary.totalSpend,
        total_clicks: report.accountSummary.totalClicks,
        recommendations_count: report.recommendations.length,
      },
    });

    console.log('[Weekly Report] Complete:', {
      spend: `$${report.accountSummary.totalSpend}`,
      clicks: report.accountSummary.totalClicks,
      experiments: experimentSummary.active,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (error) {
    console.error('[Weekly Report] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Weekly report generation failed',
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(data: {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  campaignPerformance: Array<{ name: string; ctr: number; cost: number; conversions: number }>;
  experimentSummary: { active: number; graduated: number };
  bestHeadlines: Array<{ text: string; ctr: number }>;
  worstHeadlines: Array<{ text: string }>;
}): string[] {
  const recs: string[] = [];

  // CTR recommendations
  const overallCtr = data.totalImpressions > 0
    ? (data.totalClicks / data.totalImpressions) * 100
    : 0;

  if (overallCtr < 2) {
    recs.push('Overall CTR is below 2% — consider refreshing ad copy or tightening keyword targeting');
  } else if (overallCtr > 5) {
    recs.push('Strong CTR above 5% — consider increasing budget to capture more volume');
  }

  // Low-performing campaigns
  const lowCtrCampaigns = data.campaignPerformance
    .filter(c => c.ctr < 1.5 && c.cost > 5);
  if (lowCtrCampaigns.length > 0) {
    recs.push(`${lowCtrCampaigns.length} campaign(s) with CTR below 1.5% — review targeting and ad copy: ${lowCtrCampaigns.map(c => c.name).join(', ')}`);
  }

  // Conversion recommendations
  if (data.totalConversions === 0 && data.totalSpend > 50) {
    recs.push('No conversions despite $50+ spend — verify conversion tracking is set up correctly');
  }

  // Experiment recommendations
  if (data.experimentSummary.graduated > 0) {
    recs.push(`${data.experimentSummary.graduated} experiment(s) graduated — review for promotion to full-budget campaigns`);
  }
  if (data.experimentSummary.active < 2) {
    recs.push('Consider launching more experiments to test additional persona/voice combinations');
  }

  // Asset recommendations
  if (data.worstHeadlines.length >= 3) {
    recs.push(`${data.worstHeadlines.length} headlines labeled LOW by Google — replace in next creative refresh`);
  }

  if (recs.length === 0) {
    recs.push('Performance looks healthy — continue monitoring and let experiments run');
  }

  return recs;
}
