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
    const status = searchParams.get('status');

    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('platform', 'meta')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, error } = await query;
    if (error) throw error;

    // Enrich with metrics
    const enriched = [];
    for (const campaign of campaigns || []) {
      const { data: metrics } = await supabase
        .from('campaign_metrics')
        .select('impressions, clicks, cost, conversions, ctr, cpc, cpa')
        .eq('campaign_id', campaign.id);

      const totals = metrics?.reduce(
        (acc, m) => ({
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          cost: acc.cost + parseFloat(m.cost || '0'),
          conversions: acc.conversions + (m.conversions || 0),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
      ) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

      enriched.push({
        ...campaign,
        total_impressions: totals.impressions,
        total_clicks: totals.clicks,
        total_cost: totals.cost,
        total_conversions: totals.conversions,
        avg_ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        avg_cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
      });
    }

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[Meta Ads API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Meta campaigns' },
      { status: 500 }
    );
  }
}
