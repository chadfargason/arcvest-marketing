/**
 * ArcVest Marketing Automation System
 * Lead Scoring Configuration
 *
 * Defines points for actions, fit bonuses, score decay, and thresholds.
 * These values drive the LeadScoringService behavior.
 */

// Valid action types for lead scoring
export type LeadScoreAction =
  | 'email_opened'
  | 'email_clicked'
  | 'email_reply'
  | 'page_view'
  | 'page_view_pricing'
  | 'page_view_services'
  | 'page_view_about'
  | 'form_submission'
  | 'whitepaper_download'
  | 'consultation_scheduled'
  | 'consultation_completed'
  | 'ad_click'
  | 'phone_call_inbound'
  | 'phone_call_completed';

export interface LeadScoringConfig {
  actions: Record<LeadScoreAction, number>;
  fitBonus: {
    assets: Record<string, number>;
  };
  thresholds: {
    hot: number;
    warm: number;
  };
  decayConfig: {
    startAfterDays: number;
    periodDays: number;
    pointsPerPeriod: number;
    maxDecay: number;
  };
}

export const leadScoringConfig: LeadScoringConfig = {
  // Points added for each action type
  actions: {
    // Email engagement
    email_opened: 5,
    email_clicked: 10,
    email_reply: 25,

    // Website engagement
    page_view: 2,
    page_view_pricing: 15,
    page_view_services: 10,
    page_view_about: 5,
    whitepaper_download: 20,
    form_submission: 30,

    // Direct contact
    consultation_scheduled: 40,
    consultation_completed: 20,
    phone_call_inbound: 30,
    phone_call_completed: 20,

    // Ad engagement
    ad_click: 5,
  },

  // Bonus points based on fit criteria
  fitBonus: {
    assets: {
      under_500k: 5,
      '500k_to_2m': 15,
      over_2m: 25,
    },
  },

  // Lead classification thresholds
  thresholds: {
    hot: 70, // Score >= 70 = hot
    warm: 40, // Score >= 40 = warm
  },

  // Score decay for inactive leads
  decayConfig: {
    startAfterDays: 14, // Days of inactivity before decay starts
    periodDays: 7, // Days per decay period
    pointsPerPeriod: 5, // Points lost per decay period
    maxDecay: 30, // Maximum points that can be decayed
  },
};

/**
 * Get points for an action type
 */
export function getActionPoints(action: LeadScoreAction): number {
  return leadScoringConfig.actions[action] ?? 0;
}

/**
 * Get fit bonus for an asset range
 */
export function getFitBonus(assetRange: string | null): number {
  if (!assetRange) return 0;
  return leadScoringConfig.fitBonus.assets[assetRange] ?? 0;
}

/**
 * Classify a lead based on score
 */
export function classifyLead(score: number): 'hot' | 'warm' | 'cold' {
  const { hot, warm } = leadScoringConfig.thresholds;
  if (score >= hot) return 'hot';
  if (score >= warm) return 'warm';
  return 'cold';
}

/**
 * Check if score crossed a threshold (for notifications)
 */
export function checkThresholdCrossing(
  oldScore: number,
  newScore: number
): 'became_hot' | 'became_warm' | 'became_cold' | null {
  const oldClass = classifyLead(oldScore);
  const newClass = classifyLead(newScore);

  if (oldClass !== newClass) {
    if (newClass === 'hot') return 'became_hot';
    if (newClass === 'warm' && oldClass === 'cold') return 'became_warm';
    if (newClass === 'cold') return 'became_cold';
  }

  return null;
}
