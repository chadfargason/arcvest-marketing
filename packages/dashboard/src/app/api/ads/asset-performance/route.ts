/**
 * Asset Performance API
 *
 * Surfaces headline and description performance data from the database.
 * Includes performance labels from Google Ads and aggregated metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'headlines', 'descriptions', 'all'
    const performanceLabel = searchParams.get('label'); // 'BEST', 'GOOD', 'LOW', etc.
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const result: Record<string, unknown> = {};

    if (type === 'all' || type === 'headlines') {
      let query = supabase
        .from('rsa_headlines')
        .select('id, text, headline_type, performance_label, impressions, clicks, cost, conversions, ctr, last_synced_at, pin_position')
        .gt('impressions', 0)
        .order('impressions', { ascending: false })
        .limit(limit);

      if (performanceLabel) {
        query = query.eq('performance_label', performanceLabel);
      }

      const { data, error } = await query;
      if (error) throw error;
      result.headlines = data;
    }

    if (type === 'all' || type === 'descriptions') {
      let query = supabase
        .from('rsa_descriptions')
        .select('id, text, performance_label, impressions, clicks, cost, conversions, ctr, last_synced_at, pin_position')
        .gt('impressions', 0)
        .order('impressions', { ascending: false })
        .limit(limit);

      if (performanceLabel) {
        query = query.eq('performance_label', performanceLabel);
      }

      const { data, error } = await query;
      if (error) throw error;
      result.descriptions = data;
    }

    // Include search terms summary
    const { data: searchTerms } = await supabase
      .from('search_terms')
      .select('search_term, impressions, clicks, cost, conversions, ctr')
      .gt('clicks', 0)
      .order('clicks', { ascending: false })
      .limit(20);

    result.topSearchTerms = searchTerms || [];

    // Include persona/voice performance summary
    const { data: pvPerf } = await supabase
      .from('persona_voice_performance')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(20);

    result.personaVoicePerformance = pvPerf || [];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[Asset Performance API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch asset performance',
      },
      { status: 500 }
    );
  }
}
