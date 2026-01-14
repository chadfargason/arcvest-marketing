/**
 * Audience Personas for RSA Generation
 *
 * Each persona represents a distinct target audience segment
 * with specific pain points, value propositions, and messaging angles.
 */

export interface AudiencePersona {
  id: string;
  name: string;
  displayName: string;
  demographics: {
    ageRange: [number, number];
    netWorth?: string;
    lifestage: string;
    profession?: string[];
  };
  painPoints: string[];
  valuePropsToEmphasize: string[];
  messagingAngle: string;
  keywordThemes: string[];
  callToAction: string;
}

export const AUDIENCE_PERSONAS: AudiencePersona[] = [
  {
    id: 'pre-retiree',
    name: 'pre_retiree',
    displayName: 'Pre-Retirees (50-65)',
    demographics: {
      ageRange: [50, 65],
      lifestage: 'pre-retirement',
      profession: ['executive', 'professional', 'business-owner'],
    },
    painPoints: [
      'Uncertainty about retirement readiness',
      'Fear of outliving savings',
      'Complexity of Social Security timing',
      'Healthcare cost concerns',
      'Conflicted advice from commission-based advisors',
    ],
    valuePropsToEmphasize: [
      'Retirement income planning expertise',
      'Social Security optimization',
      'Tax-efficient withdrawal strategies',
      'Healthcare planning integration',
    ],
    messagingAngle: 'Confidence in your retirement timeline',
    keywordThemes: ['retirement planning', 'social security', '401k rollover', 'retirement advisor'],
    callToAction: 'Get Your Retirement Roadmap',
  },
  {
    id: 'hnw-investor',
    name: 'high_net_worth',
    displayName: 'High-Net-Worth ($2M+)',
    demographics: {
      ageRange: [45, 70],
      netWorth: '$2M+',
      lifestage: 'wealth-preservation',
    },
    painPoints: [
      'Paying excessive fees without transparency',
      'Advisor conflicts of interest',
      'Complex tax situations',
      'Legacy and estate planning needs',
      'Desire for institutional-quality service',
    ],
    valuePropsToEmphasize: [
      'Fee-only transparent pricing',
      'Fiduciary duty - always your interests',
      'Tax optimization strategies',
      'Estate planning coordination',
    ],
    messagingAngle: 'Institutional-quality advice without conflicts',
    keywordThemes: ['wealth management', 'fiduciary advisor', 'fee-only', 'high net worth advisor'],
    callToAction: 'Request Fee Comparison',
  },
  {
    id: 'fee-conscious',
    name: 'fee_conscious',
    displayName: 'Fee-Conscious Investors',
    demographics: {
      ageRange: [35, 65],
      lifestage: 'cost-aware',
    },
    painPoints: [
      'Frustrated by hidden fees',
      'Questioning value of current advisor',
      'Want transparency in costs',
      'Concerned about fee drag on returns',
    ],
    valuePropsToEmphasize: [
      'Complete fee transparency',
      'No commissions ever',
      'Low-cost investment approach',
      'Fee impact calculator',
    ],
    messagingAngle: 'Know exactly what you pay - and why',
    keywordThemes: ['fee-only advisor', 'low cost investing', 'no commission', 'transparent fees'],
    callToAction: 'Calculate Your Hidden Fees',
  },
  {
    id: 'business-owner',
    name: 'business_owner',
    displayName: 'Business Owners & Entrepreneurs',
    demographics: {
      ageRange: [40, 65],
      lifestage: 'exit-planning',
      profession: ['business-owner', 'entrepreneur'],
    },
    painPoints: [
      'Business exit timing and strategy',
      'Concentration risk in company stock',
      'Tax-efficient sale strategies',
      'Post-sale wealth management',
    ],
    valuePropsToEmphasize: [
      'Exit planning expertise',
      'Business valuation integration',
      'Post-sale investment strategy',
      'Tax-efficient transitions',
    ],
    messagingAngle: 'Your business exit deserves expert planning',
    keywordThemes: ['business exit planning', 'sell my business', 'entrepreneur wealth', 'business succession'],
    callToAction: 'Plan Your Business Exit',
  },
  {
    id: 'recently-retired',
    name: 'recently_retired',
    displayName: 'Recent Retirees',
    demographics: {
      ageRange: [60, 75],
      lifestage: 'early-retirement',
    },
    painPoints: [
      'Converting savings to income',
      'Managing sequence of returns risk',
      'Medicare and healthcare decisions',
      'Maintaining lifestyle in retirement',
    ],
    valuePropsToEmphasize: [
      'Retirement income expertise',
      'Withdrawal strategy optimization',
      'Social Security coordination',
      'Legacy planning',
    ],
    messagingAngle: 'Make your savings work as hard as you did',
    keywordThemes: ['retirement income', 'retirement withdrawal', 'retiree advisor', 'income planning'],
    callToAction: 'Optimize Your Retirement Income',
  },
  {
    id: 'diy-investor',
    name: 'diy_investor',
    displayName: 'DIY Investors Ready for Help',
    demographics: {
      ageRange: [40, 60],
      lifestage: 'transitioning',
    },
    painPoints: [
      'Portfolio has grown complex',
      'Want professional oversight',
      'Tax optimization beyond capability',
      'Life getting too busy to manage',
    ],
    valuePropsToEmphasize: [
      'Evidence-based approach',
      'Low-cost index philosophy',
      'Comprehensive planning beyond investing',
      'Behavioral coaching',
    ],
    messagingAngle: 'Keep your investing philosophy, add expert guidance',
    keywordThemes: ['index fund advisor', 'passive investing advisor', 'bogleheads advisor', 'evidence-based'],
    callToAction: 'Get a Portfolio Review',
  },
  {
    id: 'wirehouse-refugee',
    name: 'wirehouse_refugee',
    displayName: 'Wirehouse Dissatisfied',
    demographics: {
      ageRange: [45, 65],
      lifestage: 'switching-advisors',
    },
    painPoints: [
      'Feel like a number at big firm',
      'Tired of product pushing',
      'Want more personalized service',
      'Suspect conflicts of interest',
    ],
    valuePropsToEmphasize: [
      'Independent and objective',
      'No proprietary products',
      'Personalized attention',
      'True fiduciary standard',
    ],
    messagingAngle: 'You deserve better than a sales pitch',
    keywordThemes: ['independent advisor', 'fiduciary vs broker', 'leave wirehouse', 'no sales'],
    callToAction: 'Compare Your Current Advisor',
  },
  {
    id: 'professional-couple',
    name: 'professional_couple',
    displayName: 'Dual-Income Professional Couples',
    demographics: {
      ageRange: [35, 55],
      lifestage: 'accumulation',
      profession: ['professional', 'executive'],
    },
    painPoints: [
      'Coordinating two complex careers',
      'Stock compensation complexity',
      'Maximizing dual retirement accounts',
      'Balancing current lifestyle vs. future',
    ],
    valuePropsToEmphasize: [
      'Comprehensive planning for couples',
      'Stock compensation expertise',
      'Coordinated tax strategies',
      'Work-life financial balance',
    ],
    messagingAngle: 'Financial planning as a team',
    keywordThemes: ['financial advisor couples', 'stock compensation', 'dual income planning', 'RSU advisor'],
    callToAction: 'Schedule Couples Consultation',
  },
];

export function getPersonaById(id: string): AudiencePersona | undefined {
  return AUDIENCE_PERSONAS.find((p) => p.id === id);
}

export function getPersonasByIds(ids: string[]): AudiencePersona[] {
  return AUDIENCE_PERSONAS.filter((p) => ids.includes(p.id));
}

export function getAllPersonaIds(): string[] {
  return AUDIENCE_PERSONAS.map((p) => p.id);
}
