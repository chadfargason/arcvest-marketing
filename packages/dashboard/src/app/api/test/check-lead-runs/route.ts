/**
 * Test Endpoint: Check Lead Finder Runs
 * 
 * GET /api/test/check-lead-runs
 * 
 * Shows recent lead finder runs to verify cron is working.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get recent runs
    const { data: runs, error } = await supabase
      .from('lead_finder_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      totalRuns: runs?.length || 0,
      runs: runs?.map(r => ({
        id: r.id,
        run_date: r.run_date,
        geo_name: r.geo_name,
        trigger_focus: r.trigger_focus,
        status: r.status,
        stats: r.stats,
        created_at: r.created_at,
        started_at: r.started_at,
        ended_at: r.ended_at,
      }))
    });

  } catch (error) {
    console.error('[Check Lead Runs] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
