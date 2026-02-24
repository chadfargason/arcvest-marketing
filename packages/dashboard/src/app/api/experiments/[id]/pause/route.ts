import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/experiments/[id]/pause - Pause experiment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status, google_campaign_id')
      .eq('id', id)
      .single();

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (experiment.status !== 'live') {
      return NextResponse.json(
        { error: 'Can only pause live experiments' },
        { status: 400 }
      );
    }

    if (experiment.google_campaign_id) {
      const googleAds = getGoogleAdsClient();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');
      const campaignResource = `customers/${customerId}/campaigns/${experiment.google_campaign_id}`;
      await googleAds.pauseCampaign(campaignResource);
    }

    await supabase
      .from('experiments')
      .update({ status: 'paused' })
      .eq('id', id);

    await supabase.from('experiment_logs').insert({
      experiment_id: id,
      action: 'paused',
      details: { previous_status: 'live' },
    });

    return NextResponse.json({ data: { status: 'paused' } });
  } catch (error) {
    console.error('[Experiments API] Pause error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pause experiment' },
      { status: 500 }
    );
  }
}
