export interface Caption {
  fromFrame: number;
  durationFrames: number;
  text: string;
}

// Absolute frame offsets aligned to measured ElevenLabs word timings.
// Captions appear slightly BEFORE the word they caption so the eye has time
// to catch them (avoids the "caption trails VO" feel Chad noted in v3).
export const captions: Caption[] = [
  // Scene 1 Hook (0–240)
  { fromFrame: 2, durationFrames: 75, text: "Today we're discussing advisory fees" },
  { fromFrame: 78, durationFrames: 155, text: 'A 1% fee can cost $1M+ over a lifetime' },

  // Scene 2 Setup (240–700) — VO 2 timings: starting@f89, 7%@f138, $25K@f207, fees@f279/289
  { fromFrame: 242, durationFrames: 60, text: "Let's consider two investors" },
  { fromFrame: 320, durationFrames: 55, text: 'Same starting balance · $500K' },
  { fromFrame: 370, durationFrames: 55, text: 'Same return · 7% gross' },
  { fromFrame: 440, durationFrames: 55, text: 'Same contributions · $25K/yr' },
  { fromFrame: 510, durationFrames: 170, text: 'Only the fees differ — 1.5% vs 0.5%' },

  // Scene 3 chart phase (700–1312) — VO 3 timings: yr10@f101, yr20@f204, yr30@f307,
  // gap is huge@f349, $5.47M@f437, $4.30M@f572 (all VO-relative)
  { fromFrame: 720, durationFrames: 75, text: 'Now — watch what happens over time' },
  { fromFrame: 795, durationFrames: 95, text: 'Year 10 — barely a gap' },
  { fromFrame: 898, durationFrames: 100, text: 'Year 20 — the gap widens' },
  { fromFrame: 1002, durationFrames: 45, text: 'Year 30' },
  { fromFrame: 1047, durationFrames: 85, text: 'The gap is huge' },
  { fromFrame: 1132, durationFrames: 100, text: 'ArcVest: $5.47M' },
  { fromFrame: 1265, durationFrames: 65, text: 'Advisor A: $4.30M' },

  // Scene 3 reveal phase (1315–1686) — VO 4 timings: $1.17M@f18, 4%rule@f290, beach@f346
  { fromFrame: 1335, durationFrames: 100, text: '$1,170,000 difference' },
  { fromFrame: 1440, durationFrames: 160, text: "Going to your advisor's retirement — not yours" },
  { fromFrame: 1600, durationFrames: 55, text: '≈ 5 years of retirement income (4% rule)' },
  { fromFrame: 1655, durationFrames: 30, text: 'Or a beach house.' },

  // Scene 5 CTA (1686–1900) — VO 5 timings: arcvest.com@f14, pay less@f129
  { fromFrame: 1695, durationFrames: 115, text: 'Visit arcvest.com' },
  // NOTE: "Pay Less. Keep More." caption removed — it's already the on-screen hero of scene 5
];
