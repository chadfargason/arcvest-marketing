import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/experiments/[id]/resume - Resume paused experiment
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

    if (experiment.status !== 'paused') {
      return NextResponse.json(
        { error: 'Can only resume paused experiments' },
        { status: 400 }
      );
    }

    if (experiment.google_campaign_id) {
      const googleAds = getGoogleAdsClient();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');
      const campaignResource = `customers/${customerId}/campaigns/${experiment.google_campaign_id}`;
      await googleAds.enableCampaign(campaignResource);
    }

    await supabase
      .from('experiments')
      .update({ status: 'live' })
      .eq('id', id);

    await supabase.from('experiment_logs').insert({
      experiment_id: id,
      action: 'resumed',
      details: { previous_status: 'paused' },
    });

    return NextResponse.json({ data: { status: 'live' } });
  } catch (error) {
    console.error('[Experiments API] Resume error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resume experiment' },
      { status: 500 }
    );
  }
}
