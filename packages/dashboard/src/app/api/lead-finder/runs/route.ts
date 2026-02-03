/**
 * Lead Finder Runs API
 * 
 * GET /api/lead-finder/runs - List all runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '30');

    const { data, error } = await supabase
      .from('lead_finder_runs')
      .select(`
        *,
        lead_finder_leads (
          id
        )
      `)
      .order('run_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching runs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add lead count to each run
    const runsWithCounts = data?.map(run => ({
      ...run,
      lead_count: run.lead_finder_leads?.length || 0,
      lead_finder_leads: undefined, // Remove the nested array
    }));

    return NextResponse.json({ data: runsWithCounts });
  } catch (error) {
    console.error('Error in runs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
