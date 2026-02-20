import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();
    const identity = await service.validateToken();
    const accountInfo = await service.getAccountInfo();
    return NextResponse.json({ connected: true, identity, account: accountInfo });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();

    const body = await request.json().catch(() => ({}));
    const endDate = body.endDate || new Date().toISOString().split('T')[0];
    const startDate = body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await service.fullSync(startDate, endDate);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.from('activity_log').insert({
      actor: 'meta_ads_service',
      action: 'meta_ads_sync_complete',
      entity_type: 'meta_campaigns',
      details: { ...result, date_range: { startDate, endDate } },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Meta Ads Sync] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
