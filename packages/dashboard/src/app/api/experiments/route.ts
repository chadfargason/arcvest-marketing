import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/experiments - List all experiments with variation counts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('experiments')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: experiments, error } = await query;

    if (error) {
      console.error('[Experiments API] Error fetching experiments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch variation counts and aggregate metrics for each experiment
    const experimentIds = experiments.map((e: { id: string }) => e.id);
    const { data: variations } = await supabase
      .from('experiment_variations')
      .select('experiment_id, status, impressions, clicks, cost, conversions')
      .in('experiment_id', experimentIds.length > 0 ? experimentIds : ['__none__']);

    const variationsByExperiment = new Map<string, {
      count: number;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    }>();

    for (const v of variations || []) {
      const existing = variationsByExperiment.get(v.experiment_id);
      if (existing) {
        existing.count++;
        existing.impressions += v.impressions || 0;
        existing.clicks += v.clicks || 0;
        existing.cost += Number(v.cost) || 0;
        existing.conversions += Number(v.conversions) || 0;
      } else {
        variationsByExperiment.set(v.experiment_id, {
          count: 1,
          impressions: v.impressions || 0,
          clicks: v.clicks || 0,
          cost: Number(v.cost) || 0,
          conversions: Number(v.conversions) || 0,
        });
      }
    }

    const enriched = experiments.map((exp: Record<string, unknown>) => {
      const agg = variationsByExperiment.get(exp.id as string);
      return {
        ...exp,
        variation_count: agg?.count || 0,
        total_impressions: agg?.impressions || 0,
        total_clicks: agg?.clicks || 0,
        total_cost: agg?.cost || 0,
        total_conversions: agg?.conversions || 0,
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

// POST /api/experiments - Create a new experiment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const {
      name, description, optimization_metric, daily_budget, bid_strategy,
      target_cpa, keywords, match_type, landing_page_url, target_locations,
      audience_targeting, persona_id, voice_id, num_variations,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('experiments')
      .insert({
        name,
        description: description || null,
        status: 'draft',
        platform: 'google',
        optimization_metric: optimization_metric || 'ctr',
        daily_budget: daily_budget || 10,
        bid_strategy: bid_strategy || 'maximize_clicks',
        target_cpa: target_cpa || null,
        keywords: keywords || [],
        match_type: match_type || 'broad',
        landing_page_url: landing_page_url || null,
        target_locations: target_locations || [],
        audience_targeting: audience_targeting || {},
        persona_id: persona_id || null,
        voice_id: voice_id || null,
        num_variations: num_variations || 5,
      })
      .select()
      .single();

    if (error) {
      console.error('[Experiments API] Error creating experiment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create experiment' },
      { status: 500 }
    );
  }
}
