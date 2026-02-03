/**
 * Campaign Optimization API
 *
 * POST: Run optimization rules
 * GET: Get optimization history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdsOptimizer } from '@/lib/google/ads-optimizer';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/campaigns/optimize
 * Run optimization rules on Google Ads campaigns
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[Campaign Optimize] Starting optimization run...');

    const optimizer = getAdsOptimizer();
    const result = await optimizer.runOptimizations();

    // Also check budget pacing
    await optimizer.checkBudgetPacing();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[Campaign Optimize] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Optimization failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/optimize
 * Get optimization history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('optimization_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch optimization log: ${error.message}`);
    }

    // Also get active rules
    const { data: rules } = await supabase
      .from('optimization_rules')
      .select('*')
      .order('priority', { ascending: false });

    // Get recent budget alerts
    const { data: alerts } = await supabase
      .from('budget_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      log: data || [],
      rules: rules || [],
      alerts: alerts || [],
    });
  } catch (error) {
    console.error('[Campaign Optimize] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch optimization data',
      },
      { status: 500 }
    );
  }
}
