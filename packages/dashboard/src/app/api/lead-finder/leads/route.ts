/**
 * Lead Finder Leads API
 * 
 * GET /api/lead-finder/leads - List leads with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters
    const runId = searchParams.get('runId');
    const tier = searchParams.get('tier');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const today = searchParams.get('today') === 'true';

    // Build query
    let query = supabase
      .from('lead_finder_leads')
      .select(`
        *,
        lead_finder_emails (
          id,
          version,
          subject,
          body_html,
          body_plain,
          tone,
          edited_by_user,
          created_at
        ),
        lead_finder_runs (
          id,
          run_date,
          geo_name,
          trigger_focus
        )
      `)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (runId) {
      query = query.eq('run_id', runId);
    }
    
    if (tier) {
      query = query.eq('tier', tier);
    }
    
    if (status) {
      query = query.eq('outreach_status', status);
    }
    
    if (category) {
      query = query.eq('category', category);
    }

    if (today) {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', todayStr);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('lead_finder_leads')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      data,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in leads API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
