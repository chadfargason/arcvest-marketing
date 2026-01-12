/**
 * ArcVest Marketing Automation System
 * Budget Parameters Configuration
 *
 * Defines budget limits, scaling rules, and approval thresholds.
 */

export interface ScalingConfig {
  enabled: boolean;
  scale_up_threshold: {
    roas: number;
    cpa: number;
  };
  scale_up_increment: number;
  scale_down_threshold: {
    roas: number;
    cpa: number;
  };
  scale_down_increment: number;
  max_daily_budget: number;
  min_daily_budget: number;
}

export interface ApprovalThresholds {
  budget_increase_percent: number;
  new_campaign: boolean;
  new_keyword_with_high_cpc: number;
}

export interface AutoPauseRules {
  keyword_cpc_limit: number;
  keyword_no_conversion_spend: number;
  ad_ctr_below: number;
  ad_min_impressions: number;
}

export interface BudgetParametersConfig {
  monthly_budget: number;
  daily_budget_limit: number;
  scaling: ScalingConfig;
  requires_approval: ApprovalThresholds;
  auto_pause: AutoPauseRules;
}

export const budgetParametersConfig: BudgetParametersConfig = {
  // Initial monthly budget
  monthly_budget: 500,

  // Maximum daily spend
  daily_budget_limit: 25,

  // Auto-scaling rules (disabled by default)
  scaling: {
    enabled: false,
    scale_up_threshold: {
      roas: 3.0, // Scale up if ROAS > 3x
      cpa: 100, // And CPA < $100
    },
    scale_up_increment: 0.2, // 20% increase
    scale_down_threshold: {
      roas: 1.0, // Scale down if ROAS < 1x
      cpa: 200, // Or CPA > $200
    },
    scale_down_increment: 0.3, // 30% decrease
    max_daily_budget: 100,
    min_daily_budget: 10,
  },

  // Actions that require human approval
  requires_approval: {
    budget_increase_percent: 25, // >25% budget increase needs approval
    new_campaign: true, // All new campaigns need approval
    new_keyword_with_high_cpc: 10, // Keywords with >$10 CPC need approval
  },

  // Automatic pause rules
  auto_pause: {
    keyword_cpc_limit: 20, // Pause keyword if CPC > $20
    keyword_no_conversion_spend: 100, // Pause after $100 spend with 0 conversions
    ad_ctr_below: 0.01, // Pause ads with <1% CTR
    ad_min_impressions: 1000, // After this many impressions
  },
};

/**
 * Check if a budget increase requires approval
 */
export function requiresBudgetApproval(currentBudget: number, newBudget: number): boolean {
  const increasePercent = ((newBudget - currentBudget) / currentBudget) * 100;
  return increasePercent > budgetParametersConfig.requires_approval.budget_increase_percent;
}

/**
 * Check if daily spend is over limit
 */
export function isOverDailyLimit(dailySpend: number): boolean {
  return dailySpend > budgetParametersConfig.daily_budget_limit;
}

/**
 * Check if keyword should be auto-paused based on CPC
 */
export function shouldPauseKeywordByCpc(cpc: number): boolean {
  return cpc > budgetParametersConfig.auto_pause.keyword_cpc_limit;
}

/**
 * Check if keyword should be auto-paused based on spend without conversions
 */
export function shouldPauseKeywordBySpend(spend: number, conversions: number): boolean {
  return (
    conversions === 0 && spend > budgetParametersConfig.auto_pause.keyword_no_conversion_spend
  );
}

/**
 * Check if ad should be auto-paused based on CTR
 */
export function shouldPauseAdByCtr(ctr: number, impressions: number): boolean {
  return (
    impressions >= budgetParametersConfig.auto_pause.ad_min_impressions &&
    ctr < budgetParametersConfig.auto_pause.ad_ctr_below
  );
}

/**
 * Calculate recommended budget based on performance
 */
export function getRecommendedBudget(currentBudget: number, roas: number, cpa: number): number {
  const { scaling } = budgetParametersConfig;

  if (!scaling.enabled) return currentBudget;

  // Scale up conditions
  if (roas >= scaling.scale_up_threshold.roas && cpa <= scaling.scale_up_threshold.cpa) {
    const newBudget = currentBudget * (1 + scaling.scale_up_increment);
    return Math.min(newBudget, scaling.max_daily_budget);
  }

  // Scale down conditions
  if (roas <= scaling.scale_down_threshold.roas || cpa >= scaling.scale_down_threshold.cpa) {
    const newBudget = currentBudget * (1 - scaling.scale_down_increment);
    return Math.max(newBudget, scaling.min_daily_budget);
  }

  return currentBudget;
}
