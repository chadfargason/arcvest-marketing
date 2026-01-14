/**
 * RSA-Specific Knowledge Base and Compliance Rules
 *
 * This module contains brand knowledge, compliance rules, and
 * validation utilities for Google Ads RSA generation.
 */

// Condensed brand knowledge for ad copy generation
export const ARCVEST_AD_KNOWLEDGE = `
## ArcVest Brand Overview

ArcVest is a fee-only fiduciary RIA (Registered Investment Advisor) specializing in evidence-based, passive investing for the "missing middle" - individuals with $1M-$10M+ who deserve institutional-quality advice but are underserved by big wirehouses.

## Core Differentiators
1. **Fee-Only**: We only get paid by clients, never commissions
2. **Fiduciary**: Legally bound to act in client's best interest
3. **Evidence-Based**: Investment decisions backed by academic research
4. **Low-Cost**: Emphasis on minimizing fees and expenses
5. **Transparent**: Clear pricing, no hidden costs

## Key Messages
- "Your interests first - always"
- "Fee-only means no conflicts"
- "Evidence over opinions"
- "Transparent, straightforward advice"
- "Institutional quality for individuals"

## Brand Voice
- Confident but not arrogant
- Educational, not salesy
- Warm and approachable
- Direct and clear
- Evidence-based, not emotional

## Services
- Comprehensive financial planning
- Retirement income planning
- Investment management
- Tax optimization strategies
- Estate planning coordination
- Social Security optimization
`;

// Google Ads RSA specifications
export const RSA_SPECS = {
  headlines: {
    min: 3,
    max: 15,
    targetCount: 15,
    charLimit: 30,
    warningAt: 25,
  },
  descriptions: {
    min: 2,
    max: 4,
    targetCount: 4,
    charLimit: 90,
    warningAt: 80,
  },
};

// Required headline types for a complete RSA
export const REQUIRED_HEADLINE_TYPES = [
  'brand', // ArcVest mention
  'service', // What we do
  'benefit', // What client gets
  'cta', // Call to action
  'differentiator', // Why us
];

// Compliance rules for SEC Marketing Rule
export const COMPLIANCE_RULES = {
  // Prohibited phrases (regex patterns)
  prohibitedPatterns: [
    { pattern: /guarantee[ds]?\s+(return|performance|result)/i, reason: 'No guaranteed returns' },
    { pattern: /best\s+(advisor|firm|planner|financial)/i, reason: 'No superlatives without proof' },
    { pattern: /top[\s-]?(rated|performing|ranked)/i, reason: 'No ranking claims' },
    { pattern: /#1|number\s*one|number\s*1/i, reason: 'No #1 claims' },
    { pattern: /beat\s+(the\s+)?market/i, reason: 'No market-beating promises' },
    { pattern: /risk[\s-]?free/i, reason: 'No risk-free claims' },
    { pattern: /double\s+your/i, reason: 'No doubling promises' },
    { pattern: /get\s+rich/i, reason: 'No get-rich claims' },
    { pattern: /highest\s+(rated|returns|performing)/i, reason: 'No superlative claims' },
    { pattern: /outperform/i, reason: 'No outperformance promises' },
    { pattern: /never\s+lose/i, reason: 'No loss prevention claims' },
    { pattern: /100%\s+(safe|secure|guaranteed)/i, reason: 'No absolute safety claims' },
  ],

  // Required elements
  requirements: {
    brandMentionInHeadlines: true,
    ctaInHeadlines: true,
    differentiatorIncluded: true,
  },
};

// Approved words and phrases
export const APPROVED_PHRASES = {
  differentiators: [
    'fee-only',
    'fiduciary',
    'no commissions',
    'transparent fees',
    'evidence-based',
    'client-first',
    'independent',
    'objective advice',
  ],
  services: [
    'retirement planning',
    'financial planning',
    'investment management',
    'wealth management',
    'tax optimization',
    'estate planning',
  ],
  benefits: [
    'peace of mind',
    'clarity',
    'confidence',
    'transparency',
    'personalized',
    'comprehensive',
  ],
  ctas: [
    'Free Consultation',
    'Get Started',
    'Learn More',
    'Schedule a Call',
    'Request Information',
    'Talk to an Advisor',
    'Get Your Plan',
    'See the Difference',
  ],
};

export interface ComplianceCheckResult {
  passed: boolean;
  issues: Array<{
    text: string;
    reason: string;
    severity: 'error' | 'warning';
  }>;
  suggestions: string[];
}

/**
 * Check text for compliance violations
 */
export function checkCompliance(text: string): ComplianceCheckResult {
  const issues: ComplianceCheckResult['issues'] = [];

  for (const rule of COMPLIANCE_RULES.prohibitedPatterns) {
    if (rule.pattern.test(text)) {
      const match = text.match(rule.pattern);
      issues.push({
        text: match?.[0] || text,
        reason: rule.reason,
        severity: 'error',
      });
    }
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    suggestions: issues.map((i) => `Remove or rephrase: "${i.text}" - ${i.reason}`),
  };
}

/**
 * Check headline character count
 */
export function checkHeadlineLength(headline: string): {
  valid: boolean;
  length: number;
  remaining: number;
  status: 'ok' | 'warning' | 'error';
} {
  const length = headline.length;
  const remaining = RSA_SPECS.headlines.charLimit - length;

  let status: 'ok' | 'warning' | 'error' = 'ok';
  if (length > RSA_SPECS.headlines.charLimit) {
    status = 'error';
  } else if (length >= RSA_SPECS.headlines.warningAt) {
    status = 'warning';
  }

  return {
    valid: length <= RSA_SPECS.headlines.charLimit,
    length,
    remaining,
    status,
  };
}

/**
 * Check description character count
 */
export function checkDescriptionLength(description: string): {
  valid: boolean;
  length: number;
  remaining: number;
  status: 'ok' | 'warning' | 'error';
} {
  const length = description.length;
  const remaining = RSA_SPECS.descriptions.charLimit - length;

  let status: 'ok' | 'warning' | 'error' = 'ok';
  if (length > RSA_SPECS.descriptions.charLimit) {
    status = 'error';
  } else if (length >= RSA_SPECS.descriptions.warningAt) {
    status = 'warning';
  }

  return {
    valid: length <= RSA_SPECS.descriptions.charLimit,
    length,
    remaining,
    status,
  };
}

/**
 * Validate a complete RSA asset
 */
export function validateRSA(headlines: string[], descriptions: string[]): {
  valid: boolean;
  headlineIssues: Array<{ index: number; issue: string }>;
  descriptionIssues: Array<{ index: number; issue: string }>;
  complianceIssues: ComplianceCheckResult['issues'];
  missingElements: string[];
} {
  const headlineIssues: Array<{ index: number; issue: string }> = [];
  const descriptionIssues: Array<{ index: number; issue: string }> = [];
  const allComplianceIssues: ComplianceCheckResult['issues'] = [];
  const missingElements: string[] = [];

  // Check headlines
  headlines.forEach((h, i) => {
    const lengthCheck = checkHeadlineLength(h);
    if (!lengthCheck.valid) {
      headlineIssues.push({ index: i, issue: `Exceeds 30 chars (${lengthCheck.length})` });
    }
    const compliance = checkCompliance(h);
    allComplianceIssues.push(...compliance.issues);
  });

  // Check descriptions
  descriptions.forEach((d, i) => {
    const lengthCheck = checkDescriptionLength(d);
    if (!lengthCheck.valid) {
      descriptionIssues.push({ index: i, issue: `Exceeds 90 chars (${lengthCheck.length})` });
    }
    const compliance = checkCompliance(d);
    allComplianceIssues.push(...compliance.issues);
  });

  // Check required elements
  const allText = [...headlines, ...descriptions].join(' ').toLowerCase();
  if (!allText.includes('arcvest')) {
    missingElements.push('Brand mention (ArcVest)');
  }

  const hasCTA = APPROVED_PHRASES.ctas.some((cta) => allText.includes(cta.toLowerCase()));
  if (!hasCTA) {
    missingElements.push('Call to action');
  }

  const hasDifferentiator = APPROVED_PHRASES.differentiators.some((d) => allText.includes(d));
  if (!hasDifferentiator) {
    missingElements.push('Differentiator (fee-only, fiduciary, etc.)');
  }

  const hasErrors =
    headlineIssues.length > 0 ||
    descriptionIssues.length > 0 ||
    allComplianceIssues.some((i) => i.severity === 'error');

  return {
    valid: !hasErrors,
    headlineIssues,
    descriptionIssues,
    complianceIssues: allComplianceIssues,
    missingElements,
  };
}
