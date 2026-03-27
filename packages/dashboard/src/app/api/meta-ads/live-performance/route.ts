import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface AdSetShape {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
}

interface EnrichedCampaign {
  campaignId: string;
  campaignName: string;
  status: string;
  objective: string;
  dailyBudget: number;
  lifetimeBudget: number;
  budgetType: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  costPerLandingPageView: number;
  linkClicks: number;
  costPerLinkClick: number;
  efficiencyScore: number;
  adSets: Array<{
    id: string;
    name: string;
    status: string;
    dailyBudget: number;
    lifetimeBudget: number;
    optimizationGoal: string;
    targeting: unknown;
  }>;
}

function findAction(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string,
): { action_type: string; value: string } | undefined {
  return actions?.find((a: { action_type: string; value: string }) => a.action_type === type);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const service = getMetaAdsService();
    service.initializeFromEnv();

    const performance = await service.getLiveCampaignPerformance(days);

    const enriched: EnrichedCampaign[] = [];

    for (const item of performance) {
      const ins = item.insights;
      const spend = ins ? parseFloat(ins.spend) : 0;
      const clicks = ins ? parseInt(ins.clicks, 10) : 0;
      const impressions = ins ? parseInt(ins.impressions, 10) : 0;
      const reach = ins ? parseInt(ins.reach || '0', 10) : 0;
      const ctr = ins ? parseFloat(ins.ctr || '0') : 0;
      const cpc = ins ? parseFloat(ins.cpc || '0') : 0;

      const landingPageViews = findAction(ins?.actions, 'landing_page_view');
      const costPerLpv = findAction(ins?.cost_per_action_type, 'landing_page_view');
      const linkClicksAction = findAction(ins?.actions, 'link_click');
      const costPerLinkClickAction = findAction(ins?.cost_per_action_type, 'link_click');

      const lpv = landingPageViews ? parseInt(landingPageViews.value, 10) : 0;
      const costLpv = costPerLpv ? parseFloat(costPerLpv.value) : 0;
      const lc = linkClicksAction ? parseInt(linkClicksAction.value, 10) : 0;
      const costLc = costPerLinkClickAction ? parseFloat(costPerLinkClickAction.value) : 0;

      const dailyBudgetCents = item.campaign.daily_budget
        ? parseInt(item.campaign.daily_budget, 10)
        : 0;
      const lifetimeBudgetCents = item.campaign.lifetime_budget
        ? parseInt(item.campaign.lifetime_budget, 10)
        : 0;

      enriched.push({
        campaignId: item.campaign.id,
        campaignName: item.campaign.name,
        status: item.campaign.status,
        objective: item.campaign.objective,
        dailyBudget: dailyBudgetCents / 100,
        lifetimeBudget: lifetimeBudgetCents / 100,
        budgetType: dailyBudgetCents > 0 ? 'daily' : 'lifetime',
        spend,
        impressions,
        clicks,
        reach,
        ctr,
        cpc,
        landingPageViews: lpv,
        costPerLandingPageView: costLpv,
        linkClicks: lc,
        costPerLinkClick: costLc,
        efficiencyScore: costLpv > 0 ? costLpv : costLc > 0 ? costLc : spend > 0 ? 999 : 0,
        adSets: item.adSets.map((adSet: AdSetShape) => ({
          id: adSet.id,
          name: adSet.name,
          status: adSet.status,
          dailyBudget: adSet.daily_budget ? parseInt(adSet.daily_budget, 10) / 100 : 0,
          lifetimeBudget: adSet.lifetime_budget ? parseInt(adSet.lifetime_budget, 10) / 100 : 0,
          optimizationGoal: adSet.optimization_goal || '',
          targeting: adSet.targeting,
        })),
      });
    }

    enriched.sort((a: EnrichedCampaign, b: EnrichedCampaign) => {
      if (a.efficiencyScore === 0 && b.efficiencyScore === 0) return 0;
      if (a.efficiencyScore === 0) return 1;
      if (b.efficiencyScore === 0) return -1;
      return a.efficiencyScore - b.efficiencyScore;
    });

    const totalSpend = enriched.reduce((sum: number, c: EnrichedCampaign) => sum + c.spend, 0);
    const totalDailyBudget = enriched
      .filter((c: EnrichedCampaign) => c.budgetType === 'daily')
      .reduce((sum: number, c: EnrichedCampaign) => sum + c.dailyBudget, 0);

    return NextResponse.json({
      campaigns: enriched,
      summary: {
        totalCampaigns: enriched.length,
        activeCampaigns: enriched.filter((c: EnrichedCampaign) => c.status === 'ACTIVE').length,
        totalSpend,
        totalDailyBudget,
        projectedMonthlySpend: totalDailyBudget * 30,
      },
      days,
    });
  } catch (error) {
    console.error('Live performance error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch performance' },
      { status: 500 },
    );
  }
}
