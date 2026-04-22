export interface Caption {
  fromFrame: number;
  durationFrames: number;
  text: string;
}

// Absolute frame offsets. 30fps, 1800 frame total.
// Aligned to measured word-level timings from ElevenLabs alignment JSONs.
export const captions: Caption[] = [
  // Scene 1 Hook (0–135): VO "Over a lifetime of investing, a 1% fee can cost you over $1M"
  { fromFrame: 5, durationFrames: 90, text: 'Over a lifetime of investing, a 1% fee can cost you $1M+' },

  // Scene 2 Setup (135–630): stats stack + fee comparison
  { fromFrame: 155, durationFrames: 95, text: "Let's consider two investors" },
  { fromFrame: 250, durationFrames: 75, text: 'Same starting balance ($500K)' },
  { fromFrame: 325, durationFrames: 75, text: 'Same return (7% gross)' },
  { fromFrame: 400, durationFrames: 90, text: 'Same contributions ($25K/yr)' },
  { fromFrame: 490, durationFrames: 140, text: 'Only the fees are different — 1.5% vs 0.5%' },

  // Scene 3 Divergence (630–1230): year callouts
  { fromFrame: 660, durationFrames: 80, text: 'Two portfolios over time' },
  { fromFrame: 743, durationFrames: 100, text: 'Year 10 — barely a gap' },
  { fromFrame: 849, durationFrames: 100, text: 'Year 20 — the gap widens' },
  { fromFrame: 957, durationFrames: 90, text: 'Year 30 — the gap is huge' },
  { fromFrame: 1031, durationFrames: 100, text: 'ArcVest: $5.47M' },
  { fromFrame: 1135, durationFrames: 90, text: 'Advisor A: $4.30M' },

  // Scene 4 Reveal (1230–1610)
  { fromFrame: 1243, durationFrames: 135, text: '$1,170,000 difference' },
  { fromFrame: 1380, durationFrames: 150, text: "Going to your advisor's retirement — not yours" },
  { fromFrame: 1530, durationFrames: 55, text: '≈ 5 years of retirement income (4% rule)' },
  { fromFrame: 1585, durationFrames: 24, text: 'Or a beach house.' },

  // Scene 5 CTA (1610–1800)
  { fromFrame: 1621, durationFrames: 100, text: 'Visit arcvest.com' },
  { fromFrame: 1713, durationFrames: 87, text: 'Pay Less. Keep More.' },
];
