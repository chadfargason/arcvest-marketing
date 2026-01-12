import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/campaigns - Get all campaigns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Also get performance data
    const { data: performanceData } = await supabase
      .from('campaign_performance_summary')
      .select('*');

    // Merge performance data with campaigns
    const campaignsWithPerformance = data?.map((campaign) => {
      const perf = performanceData?.find((p) => p.id === campaign.id);
      return {
        ...campaign,
        total_impressions: perf?.total_impressions || 0,
        total_clicks: perf?.total_clicks || 0,
        total_cost: perf?.total_cost || 0,
        total_conversions: perf?.total_conversions || 0,
        avg_ctr: perf?.avg_ctr || 0,
        avg_cpc: perf?.avg_cpc || 0,
        avg_cpa: perf?.avg_cpa || null,
      };
    }) || [];

    return NextResponse.json({ campaigns: campaignsWithPerformance });
  } catch (error) {
    console.error('Error in GET /api/campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: body.name,
        type: body.type || 'google_search',
        status: body.status || 'draft',
        budget_monthly: body.budget_monthly || 0,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        target_audience: body.target_audience || null,
        google_ads_campaign_id: body.google_ads_campaign_id || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json({ campaign: data });
  } catch (error) {
    console.error('Error in POST /api/campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
