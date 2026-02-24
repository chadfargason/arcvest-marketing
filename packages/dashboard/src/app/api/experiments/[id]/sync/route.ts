import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/experiments/[id]/sync - Sync metrics from Google Ads
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status, google_campaign_id, created_at')
      .eq('id', id)
      .single();

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (!['live', 'paused', 'optimizing', 'completed'].includes(experiment.status)) {
      return NextResponse.json(
        { error: 'Can only sync experiments that have been deployed' },
        { status: 400 }
      );
    }

    if (!experiment.google_campaign_id) {
      return NextResponse.json(
        { error: 'No Google campaign ID found' },
        { status: 400 }
      );
    }

    // Fetch variations with their Google ad group IDs
    const { data: variations } = await supabase
      .from('experiment_variations')
      .select('id, google_ad_group_id')
      .eq('experiment_id', id);

    if (!variations || variations.length === 0) {
      return NextResponse.json({ error: 'No variations found' }, { status: 400 });
    }

    // Get metrics from Google Ads
    const googleAds = getGoogleAdsClient();
    const startDate = new Date(experiment.created_at).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const adGroupMetrics = await googleAds.getAdGroupMetrics(
      experiment.google_campaign_id,
      startDate,
      endDate
    );

    // Map metrics back to variations by ad group ID
    const metricsMap = new Map(
      adGroupMetrics.map((m) => [m.adGroupId, m])
    );

    let updatedCount = 0;
    for (const variation of variations) {
      if (!variation.google_ad_group_id) continue;

      const metrics = metricsMap.get(variation.google_ad_group_id);
      if (metrics) {
        await supabase
          .from('experiment_variations')
          .update({
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            cost: metrics.cost,
            conversions: metrics.conversions,
            ctr: metrics.ctr,
            cpc: metrics.cpc,
          })
          .eq('id', variation.id);
        updatedCount++;
      }
    }

    // Log sync
    await supabase.from('experiment_logs').insert({
      experiment_id: id,
      action: 'synced',
      details: {
        updatedVariations: updatedCount,
        dateRange: { startDate, endDate },
        adGroupMetrics: adGroupMetrics.length,
      },
    });

    return NextResponse.json({
      data: {
        synced: true,
        updatedVariations: updatedCount,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error('[Experiments API] Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync metrics' },
      { status: 500 }
    );
  }
}
