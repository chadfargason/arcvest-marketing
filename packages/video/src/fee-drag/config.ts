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
    durationSeconds: 30,
    durationFrames: 900,
  },
  cta: {
    url: 'arcvest.com/retirement-guide',
    displayUrl: 'arcvest.com/retirement-guide',
  },
  disclaimer:
    'Hypothetical illustration. 7% assumed gross annual return, constant. Not a forecast or guarantee. Past performance does not guarantee future results. All-in fees include advisory plus weighted product expense ratios. Competitor figures are industry-typical, not specific to any firm.',
} as const;

export type FeeDragConfig = typeof feeDragConfig;
