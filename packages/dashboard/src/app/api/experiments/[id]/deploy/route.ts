import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/experiments/[id]/deploy - Deploy experiment to Google Ads
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Fetch experiment with variations
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (experiment.status !== 'ready') {
      return NextResponse.json(
        { error: 'Experiment must be in ready status to deploy' },
        { status: 400 }
      );
    }

    const { data: variations } = await supabase
      .from('experiment_variations')
      .select('*')
      .eq('experiment_id', id)
      .order('variation_number', { ascending: true });

    if (!variations || variations.length === 0) {
      return NextResponse.json(
        { error: 'No variations found. Generate copy first.' },
        { status: 400 }
      );
    }

    if (!experiment.landing_page_url) {
      return NextResponse.json(
        { error: 'Landing page URL is required for deployment' },
        { status: 400 }
      );
    }

    const googleAds = getGoogleAdsClient();

    // 1. Create campaign budget
    const budgetMicros = Math.round((experiment.daily_budget || 10) * 1_000_000);
    const budgetResourceName = await googleAds.createCampaignBudget(budgetMicros);

    // Extract budget ID from resource name
    const budgetId = budgetResourceName.split('/').pop() || '';

    // 2. Create campaign (PAUSED initially)
    const campaignName = `[Experiment] ${experiment.name}`;
    const campaignResourceName = await googleAds.createCampaign(
      campaignName,
      budgetResourceName,
      experiment.bid_strategy,
      experiment.target_cpa || undefined,
      'PAUSED'
    );
    const campaignId = campaignResourceName.split('/').pop() || '';

    // 3. Set location targeting
    const locations: string[] = experiment.target_locations || [];
    if (locations.length > 0) {
      await googleAds.setCampaignLocationTargeting(campaignResourceName, locations);
    }

    // 4. Create ad groups and ads for each variation
    const keywords: string[] = experiment.keywords || [];
    const matchType = (experiment.match_type || 'broad').toUpperCase() as 'BROAD' | 'PHRASE' | 'EXACT';

    for (const variation of variations) {
      // Create ad group
      const adGroupName = `${experiment.name} - Variation ${variation.variation_number}`;
      const adGroupResourceName = await googleAds.createAdGroup(
        campaignResourceName,
        adGroupName
      );
      const adGroupId = adGroupResourceName.split('/').pop() || '';

      // Create responsive search ad
      const headlines = (variation.headlines as Array<{ text: string; pinPosition?: number }>).map(
        (h) => ({ text: h.text, pinPosition: h.pinPosition })
      );
      const descriptions = (variation.descriptions as Array<{ text: string; pinPosition?: number }>).map(
        (d) => ({ text: d.text, pinPosition: d.pinPosition })
      );

      const adResourceName = await googleAds.createResponsiveSearchAd(
        adGroupResourceName,
        headlines,
        descriptions,
        experiment.landing_page_url
      );
      const adId = adResourceName.split('/').pop() || '';

      // Add keywords to ad group
      if (keywords.length > 0) {
        await googleAds.addKeywords(adGroupResourceName, keywords, matchType);
      }

      // Update variation with Google Ads IDs
      await supabase
        .from('experiment_variations')
        .update({
          google_ad_group_id: adGroupId,
          google_ad_id: adId,
          status: 'active',
        })
        .eq('id', variation.id);
    }

    // 5. Enable the campaign
    await googleAds.enableCampaign(campaignResourceName);

    // 6. Update experiment with Google Ads IDs and status
    await supabase
      .from('experiments')
      .update({
        google_campaign_id: campaignId,
        google_budget_id: budgetId,
        status: 'live',
      })
      .eq('id', id);

    // 7. Log deployment
    await supabase.from('experiment_logs').insert({
      experiment_id: id,
      action: 'deployed',
      details: {
        campaignId,
        budgetId,
        variationCount: variations.length,
        dailyBudget: experiment.daily_budget,
        keywords,
        matchType,
      },
    });

    return NextResponse.json({
      data: {
        google_campaign_id: campaignId,
        google_budget_id: budgetId,
        status: 'live',
      },
    });
  } catch (error) {
    console.error('[Experiments API] Deploy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deploy experiment' },
      { status: 500 }
    );
  }
}
