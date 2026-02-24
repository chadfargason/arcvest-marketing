/**
 * Campaign Launch API
 *
 * POST: Create a full Google Ads Search campaign end-to-end:
 *   budget -> campaign -> location targeting -> ad groups (with keywords + RSAs) -> enable
 *
 * Also records the campaign in Supabase for dashboard tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/google-ads-client';
import { createClient } from '@supabase/supabase-js';
import { getRSAPipeline } from '@arcvest/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — RSA pipeline takes time

interface AdGroupConfig {
  name: string;
  personaId: string;
  voiceId: string;
  keywords: string[];
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
}

interface LaunchRequest {
  campaignName: string;
  dailyBudgetDollars: number;
  bidStrategy: 'maximize_clicks' | 'maximize_conversions' | 'target_cpa';
  targetCpa?: number;
  locationIds: string[];
  finalUrl: string;
  adGroups: AdGroupConfig[];
  enableImmediately?: boolean;
}

export async function POST(request: NextRequest) {
  const steps: Array<{ step: string; status: string; detail?: string }> = [];

  try {
    const body: LaunchRequest = await request.json();
    const {
      campaignName,
      dailyBudgetDollars,
      bidStrategy,
      targetCpa,
      locationIds,
      finalUrl,
      adGroups,
      enableImmediately = false,
    } = body;

    const googleAds = getGoogleAdsClient();

    // Step 1: Generate RSAs for each ad group
    const rsaPipeline = getRSAPipeline();
    const rsaResults: Array<{
      adGroupName: string;
      headlines: Array<{ text: string; pinPosition?: number }>;
      descriptions: Array<{ text: string; pinPosition?: number }>;
    }> = [];

    for (const ag of adGroups) {
      steps.push({ step: `Generate RSA for "${ag.name}"`, status: 'running' });
      try {
        const result = await rsaPipeline.generate(ag.personaId, ag.voiceId, 0);

        const headlines = result.master.headlines.map(
          (h: { text: string; pinPosition?: number }) => ({
            text: h.text,
            pinPosition: h.pinPosition,
          })
        );
        const descriptions = result.master.descriptions.map(
          (d: { text: string; pinPosition?: number }) => ({
            text: d.text,
            pinPosition: d.pinPosition,
          })
        );

        rsaResults.push({ adGroupName: ag.name, headlines, descriptions });

        steps[steps.length - 1].status = 'done';
        steps[steps.length - 1].detail =
          `${headlines.length} headlines, ${descriptions.length} descriptions` +
          (result.complianceResult.passed ? ', compliance passed' : ', compliance warnings');
      } catch (err) {
        steps[steps.length - 1].status = 'failed';
        steps[steps.length - 1].detail = err instanceof Error ? err.message : 'RSA generation failed';
        throw new Error(`RSA generation failed for "${ag.name}": ${steps[steps.length - 1].detail}`);
      }
    }

    // Step 2: Create campaign budget
    steps.push({ step: 'Create campaign budget', status: 'running' });
    const budgetMicros = dailyBudgetDollars * 1_000_000;
    const budgetResourceName = await googleAds.createCampaignBudget(budgetMicros);
    steps[steps.length - 1].status = 'done';
    steps[steps.length - 1].detail = `$${dailyBudgetDollars}/day`;

    // Step 3: Create campaign (PAUSED initially)
    steps.push({ step: 'Create campaign', status: 'running' });
    const campaignResourceName = await googleAds.createCampaign(
      campaignName,
      budgetResourceName,
      bidStrategy,
      targetCpa,
      'PAUSED'
    );
    steps[steps.length - 1].status = 'done';
    steps[steps.length - 1].detail = campaignResourceName;

    // Step 4: Set location targeting
    if (locationIds.length > 0) {
      steps.push({ step: 'Set location targeting', status: 'running' });
      await googleAds.setCampaignLocationTargeting(campaignResourceName, locationIds);
      steps[steps.length - 1].status = 'done';
      steps[steps.length - 1].detail = `${locationIds.length} location(s)`;
    }

    // Step 5: Create ad groups with keywords and RSAs
    const adGroupResults: Array<{
      name: string;
      resourceName: string;
      keywordCount: number;
      rsaResourceName: string;
    }> = [];

    for (let i = 0; i < adGroups.length; i++) {
      const ag = adGroups[i];
      const rsa = rsaResults[i];

      // Create ad group
      steps.push({ step: `Create ad group "${ag.name}"`, status: 'running' });
      const adGroupResourceName = await googleAds.createAdGroup(campaignResourceName, ag.name);
      steps[steps.length - 1].status = 'done';

      // Add keywords
      steps.push({ step: `Add keywords to "${ag.name}"`, status: 'running' });
      await googleAds.addKeywords(adGroupResourceName, ag.keywords, ag.matchType);
      steps[steps.length - 1].status = 'done';
      steps[steps.length - 1].detail = `${ag.keywords.length} keywords (${ag.matchType})`;

      // Create RSA
      steps.push({ step: `Create RSA in "${ag.name}"`, status: 'running' });
      const rsaResourceName = await googleAds.createResponsiveSearchAd(
        adGroupResourceName,
        rsa.headlines,
        rsa.descriptions,
        finalUrl
      );
      steps[steps.length - 1].status = 'done';

      adGroupResults.push({
        name: ag.name,
        resourceName: adGroupResourceName,
        keywordCount: ag.keywords.length,
        rsaResourceName,
      });
    }

    // Step 6: Record in Supabase
    steps.push({ step: 'Record campaign in database', status: 'running' });
    const campaignId = campaignResourceName.split('/').pop() || '';
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.from('campaigns').upsert({
      name: campaignName,
      type: 'google_search',
      status: enableImmediately ? 'active' : 'paused',
      budget_monthly: dailyBudgetDollars * 30,
      start_date: new Date().toISOString().split('T')[0],
      google_ads_campaign_id: campaignId,
      target_audience: adGroups.map(ag => `${ag.personaId}/${ag.voiceId}`).join(', '),
      notes: `Auto-launched via /api/campaigns/launch. Ad groups: ${adGroups.map(ag => ag.name).join(', ')}`,
    }, { onConflict: 'google_ads_campaign_id' });
    steps[steps.length - 1].status = 'done';

    // Step 7: Enable campaign if requested
    if (enableImmediately) {
      steps.push({ step: 'Enable campaign', status: 'running' });
      await googleAds.enableCampaign(campaignResourceName);
      steps[steps.length - 1].status = 'done';
    }

    return NextResponse.json({
      success: true,
      campaign: {
        name: campaignName,
        resourceName: campaignResourceName,
        googleAdsCampaignId: campaignId,
        budget: `$${dailyBudgetDollars}/day`,
        bidStrategy,
        status: enableImmediately ? 'ENABLED' : 'PAUSED',
        locationIds,
        adGroups: adGroupResults,
      },
      steps,
    });
  } catch (error) {
    console.error('[Campaign Launch] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Campaign launch failed',
        steps,
      },
      { status: 500 }
    );
  }
}
