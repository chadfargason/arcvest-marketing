import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/experiments/[id] - Get experiment with all variations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: experiment, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: variations } = await supabase
      .from('experiment_variations')
      .select('*')
      .eq('experiment_id', id)
      .order('variation_number', { ascending: true });

    const { data: logs } = await supabase
      .from('experiment_logs')
      .select('*')
      .eq('experiment_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      data: {
        ...experiment,
        variations: variations || [],
        logs: logs || [],
      },
    });
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch experiment' },
      { status: 500 }
    );
  }
}

// PUT /api/experiments/[id] - Update experiment config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();
    const body = await request.json();

    // Check current status
    const { data: existing } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Handle variation unpause for live/optimizing experiments
    if (body.variation_id && body.action === 'unpause') {
      if (!['live', 'optimizing'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Can only unpause variations on live or optimizing experiments' },
          { status: 400 }
        );
      }

      const { data: variation } = await supabase
        .from('experiment_variations')
        .select('*')
        .eq('id', body.variation_id)
        .eq('experiment_id', id)
        .single();

      if (!variation) {
        return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
      }

      if (!['paused', 'loser'].includes(variation.status)) {
        return NextResponse.json(
          { error: 'Can only unpause paused or loser variations' },
          { status: 400 }
        );
      }

      // Re-enable ad group in Google Ads
      if (variation.google_ad_group_id) {
        const googleAds = getGoogleAdsClient();
        const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '');
        const adGroupResource = `customers/${customerId}/adGroups/${variation.google_ad_group_id}`;
        await googleAds.enableAdGroup(adGroupResource);
      }

      // Update variation status
      await supabase
        .from('experiment_variations')
        .update({ status: 'active' })
        .eq('id', body.variation_id);

      // Log the action
      await supabase.from('experiment_logs').insert({
        experiment_id: id,
        action: 'manual_unpause',
        details: {
          variation_id: body.variation_id,
          variation_number: variation.variation_number,
          previous_status: variation.status,
          explanation: `Manually unpaused Variation ${variation.variation_number}`,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (!['draft', 'ready'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Can only update experiments in draft or ready status' },
        { status: 400 }
      );
    }

    const allowedFields = [
      'name', 'description', 'optimization_metric', 'daily_budget', 'bid_strategy',
      'target_cpa', 'keywords', 'match_type', 'landing_page_url', 'target_locations',
      'audience_targeting', 'persona_id', 'voice_id', 'num_variations', 'auto_optimize',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('experiments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update experiment' },
      { status: 500 }
    );
  }
}

// DELETE /api/experiments/[id] - Delete experiment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: existing } = await supabase
      .from('experiments')
      .select('status, google_campaign_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // If live, remove from Google Ads first
    if (existing.status === 'live' && existing.google_campaign_id) {
      try {
        const googleAds = getGoogleAdsClient();
        const campaignResource = `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '')}/campaigns/${existing.google_campaign_id}`;
        await googleAds.removeCampaign(campaignResource);
      } catch (e) {
        console.error('[Experiments API] Failed to remove campaign from Google Ads:', e);
      }
    }

    if (!['draft', 'completed', 'live'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Can only delete experiments in draft, completed, or live status' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Experiments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete experiment' },
      { status: 500 }
    );
  }
}
