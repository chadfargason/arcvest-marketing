import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/experiments/[id]/complete - End experiment and declare winner
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();
    const body = await request.json();
    const { winner_variation_id } = body;

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status, google_campaign_id')
      .eq('id', id)
      .single();

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (!['live', 'paused', 'optimizing'].includes(experiment.status)) {
      return NextResponse.json(
        { error: 'Can only complete live, paused, or optimizing experiments' },
        { status: 400 }
      );
    }

    // Pause campaign in Google Ads
    if (experiment.google_campaign_id) {
      const googleAds = getGoogleAdsClient();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');
      const campaignResource = `customers/${customerId}/campaigns/${experiment.google_campaign_id}`;
      await googleAds.pauseCampaign(campaignResource);
    }

    // Mark winner if specified
    if (winner_variation_id) {
      await supabase
        .from('experiment_variations')
        .update({ status: 'winner' })
        .eq('id', winner_variation_id);

      // Mark all others as losers
      await supabase
        .from('experiment_variations')
        .update({ status: 'loser' })
        .eq('experiment_id', id)
        .neq('id', winner_variation_id)
        .neq('status', 'paused');
    }

    // Update experiment
    await supabase
      .from('experiments')
      .update({
        status: 'completed',
        winner_variation_id: winner_variation_id || null,
      })
      .eq('id', id);

    // Log completion
    await supabase.from('experiment_logs').insert({
      experiment_id: id,
      action: 'completed',
      details: {
        winner_variation_id: winner_variation_id || null,
        previous_status: experiment.status,
      },
    });

    return NextResponse.json({ data: { status: 'completed', winner_variation_id } });
  } catch (error) {
    console.error('[Experiments API] Complete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete experiment' },
      { status: 500 }
    );
  }
}
