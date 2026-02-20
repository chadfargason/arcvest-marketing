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
    const adSetId = searchParams.get('ad_set_id');

    let query = supabase
      .from('meta_ads')
      .select('*, meta_ad_sets(name, status, campaign_id)')
      .order('created_at', { ascending: false });

    if (adSetId) {
      query = query.eq('ad_set_id', adSetId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Meta Ads] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ads' },
      { status: 500 }
    );
  }
}
