export const feeDragConfig = {
  startingBalance: 500_000,
  annualContribution: 25_000,
  grossReturn: 0.07,
  horizonYears: 30,
  advisorA: {
    label: 'Advisor A',
    advisoryFee: 0.010,
    productCost: 0.005,
    totalFee: 0.015,
  },
  advisorB: {
    label: 'ArcVest',
    advisoryFee: 0.004,
    productCost: 0.001,
    totalFee: 0.005,
  },
  video: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 63.3,
    durationFrames: 1900,
  },
  // Merged "divergence" scene hosts both VO 3 (chart) and VO 4 (reveal)
  // with a chart-shrink-to-left transition in between — no hard cut.
  scenes: {
    hook: { from: 0, duration: 240 },
    splitScreen: { from: 240, duration: 460 },
    divergence: { from: 700, duration: 986 },
    cta: { from: 1686, duration: 214 },
  },
  // Locked literal: must match the figure spoken in VO 4 ("one-point-one-seven million").
  // If portfolio inputs change, update BOTH the VO script and this literal together.
  // Actual computed gap ≈ $1,163,750; we display the clean tenth-of-a-million rounding.
  heroGapDisplay: '$1,170,000',
  cta: {
    url: 'arcvest.com/retirement-guide',
    displayUrl: 'arcvest.com/retirement-guide',
    tagline: 'Pay Less. Keep More.',
  },
  disclaimer:
    'Hypothetical illustration. 7% assumed gross annual return, constant. Not a forecast or guarantee. Past performance does not guarantee future results. All-in fees include advisory plus weighted product expense ratios. The 4% rule and beach-house comparisons are illustrative.',
} as const;

export type FeeDragConfig = typeof feeDragConfig;
