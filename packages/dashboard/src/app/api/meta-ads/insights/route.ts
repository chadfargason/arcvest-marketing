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
    const level = searchParams.get('level') || 'campaign';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: insights, error } = await supabase
      .from('meta_insights')
      .select('*')
      .eq('object_type', level)
      .gte('date', since)
      .order('date', { ascending: true });

    if (error) throw error;

    const summary = insights?.reduce(
      (acc, i) => ({
        totalSpend: acc.totalSpend + parseFloat(i.spend || '0'),
        totalImpressions: acc.totalImpressions + (i.impressions || 0),
        totalClicks: acc.totalClicks + (i.clicks || 0),
        totalReach: acc.totalReach + (i.reach || 0),
      }),
      { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0 }
    ) || { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0 };

    return NextResponse.json({
      insights,
      summary: {
        ...summary,
        avgCtr: summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0,
        avgCpc: summary.totalClicks > 0 ? summary.totalSpend / summary.totalClicks : 0,
      },
    });
  } catch (error) {
    console.error('[Meta Ads Insights] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
