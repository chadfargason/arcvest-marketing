// Slide plan for "How Much Can You Withdraw?" — ArcVest Retirement Daily, 2026-04-17
// Mode C: 100% slides, no live video. Source is an MP3.

export const episodeConfig = {
  title: 'How Much Can You Withdraw?',
  showTitle: 'ArcVest Retirement Daily',
  host: 'Chad Fargason',
  date: 'April 17, 2026',
  sourceAudio: 'source/daily-retirement-2026-04-17-audio.mp3',
  fps: 24,
  widthPx: 1920,
  heightPx: 1080,
  durationSec: 555,
  ctaUrl: 'arcvest.com/retirement',
  tagline: 'Pay Less. Keep More.',
  disclaimer:
    'Educational content only. Hypothetical illustrations. Past performance does not guarantee future results. Not individualized investment, tax, or retirement advice. Consult a fiduciary advisor for guidance specific to your situation.',
} as const;

export type SegmentKind = 'slide'; // Mode C: only slides

export type SlideKind =
  | 'title'
  | 'chapter'
  | 'concept'
  | 'primer'
  | 'stat'
  | 'table'
  | 'checklist'
  | 'worked-example'
  | 'quote'
  | 'guardrails'
  | 'outro';

export interface Segment {
  startSec: number;
  endSec: number;
  kind: SegmentKind;
  slide: SlideKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
}

export const slidePlan: Segment[] = [
  // 1. Title (0:00–0:10)
  {
    startSec: 0,
    endSec: 10,
    kind: 'slide',
    slide: 'title',
    props: {
      showTitle: episodeConfig.showTitle,
      episodeTitle: episodeConfig.title,
      hosts: episodeConfig.host,
      date: episodeConfig.date,
    },
  },

  // 2. Opening question (0:10–0:30)
  {
    startSec: 10,
    endSec: 30,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Am I going to be okay?',
      subline: 'The quieter question hiding behind the math.',
    },
  },

  // 3. The 4% Rule basics (0:30–0:55)
  {
    startSec: 30,
    endSec: 55,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'The basics',
      heading: 'The 4% Rule, in one slide',
      items: [
        { accent: 'Year 1', label: 'Take 4% of your portfolio', detail: '$1M portfolio → $40,000 in year one.' },
        { accent: 'Every year after', label: 'Adjust up for inflation', detail: 'Last year + CPI. Keep the same real lifestyle.' },
        { accent: 'Horizon', label: 'Historically lasts 30+ years', detail: 'Even through the worst historical sequences.' },
        { accent: 'Vibe', label: 'Simple, reassuring, done.', detail: '...or is it?' },
      ],
      layout: 'rows',
    },
  },

  // 4. Not a rule (0:55–1:10)
  {
    startSec: 55,
    endSec: 70,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: "It's not a rule.",
      subline: 'It\'s a historical observation, frozen in time.',
    },
  },

  // 5. Origin primer (1:10–1:35)
  {
    startSec: 70,
    endSec: 95,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Origin',
      heading: 'Where the number came from',
      items: [
        { accent: '1994', label: 'William Bengen', detail: 'Financial planner, published the original research.' },
        { accent: 'Data', label: 'Every 30-year window since 1926', detail: 'Every real starting year in the historical record.' },
        { accent: 'Stress test', label: 'Survived the Great Depression + 1970s stagflation', detail: 'Two of the worst sequences in US history.' },
        { accent: 'Answer', label: '4% never ran out', detail: "That's where the number comes from." },
      ],
      layout: 'rows',
    },
  },

  // 6. Bengen's assumptions table (1:35–1:55)
  {
    startSec: 95,
    endSec: 115,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'The fine print',
      heading: "Bengen's 1994 assumptions",
      columns: ['Assumption', 'What Bengen used'],
      rows: [
        { cells: ['Portfolio', '50% US stocks / 50% intermediate Treasuries'] },
        { cells: ['Other income', 'None — portfolio only'] },
        { cells: ['Bond regime', 'Falling rates, 40-year tailwind'] },
        { cells: ['Rebalanced', 'Yes, annually'] },
      ],
      footer: 'Change any of these, and the 4% number changes too.',
    },
  },

  // 7. 2026 conditions (1:55–2:25)
  {
    startSec: 115,
    endSec: 145,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: '2026 looks different.',
      subline: 'Equity valuations are elevated. The Shiller PE sits in the upper range of its historical distribution.',
      footer: 'High starting valuations → lower forward returns',
    },
  },

  // 8. 40-year tailwind gone (2:25–2:50)
  {
    startSec: 145,
    endSec: 170,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'The 40-year tailwind is gone.',
      subline: 'Falling interest rates supercharged stocks AND bonds from 1980 to 2020. That tailwind is not available to today\'s retirees.',
    },
  },

  // 9. Bengen 2025 update (2:50–3:10)
  {
    startSec: 170,
    endSec: 190,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: "Bengen's 2025 update",
      value: '4.7%',
      context: 'With a diversified, equity-tilted portfolio (adds small caps and other asset classes).',
      emphasisColor: 'arcvest',
    },
  },

  // 10. ArcVest portfolio philosophy (3:10–3:30)
  {
    startSec: 190,
    endSec: 210,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Equity-heavy, protected by a war chest.',
      subline: 'Not 60/40 by default — retirees still have 20–30 years ahead.',
      footer: 'ArcVest portfolio philosophy',
    },
  },

  // 11. The static rule problem (3:30–3:55)
  {
    startSec: 210,
    endSec: 235,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'The static-rule problem.',
      subline: '4% in year one. Inflation-adjust. Never deviate.',
      footer: 'No real retiree does that.',
    },
  },

  // 12. GUARDRAILS DIAGRAM (3:55–4:55) — 60s, the centerpiece
  {
    startSec: 235,
    endSec: 295,
    kind: 'slide',
    slide: 'guardrails',
    props: {
      initialRate: 0.05,
      triggerThreshold: 0.20,
      adjustment: 0.10,
      notes: [
        'Inflation: adjusted annually — except skipped the year after a lower-guardrail cut.',
        'Suspension: rules are paused when the portfolio has 15 or fewer years of expected longevity.',
        'Guardrails flex WITH markets instead of grinding against them.',
      ],
    },
  },

  // 13. Higher starting rate (4:55–5:20)
  {
    startSec: 295,
    endSec: 320,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: 'With guardrails in place',
      value: '5 – 5.5%',
      context: 'Starting withdrawal rate, with very high probability of never running out over 30 years.',
      attribution: 'Guyton & Klinger',
      emphasisColor: 'arcvest',
    },
  },

  // 14. Other income worked example (5:20–5:55)
  {
    startSec: 320,
    endSec: 355,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Other income matters',
      headline: 'The 4% rule is portfolio-only.',
      setup: 'A typical household with Social Security and no pension:',
      steps: [
        { label: 'Annual spending need', value: '$100,000' },
        { label: 'Social Security', value: '−$72,000' },
        { label: 'Portfolio must cover', value: '$28,000' },
      ],
      outcome: {
        label: 'The math changes completely.',
        value: 'Far less pressure',
      },
    },
  },

  // 15. Spending smile primer (5:55–6:25)
  {
    startSec: 355,
    endSec: 385,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Research',
      heading: 'The Spending Smile',
      items: [
        { accent: 'Early', label: 'Rises — the "go-go" years', detail: 'Travel, activity, entertaining.' },
        { accent: 'Mid', label: 'Slows down', detail: 'Activity naturally tapers off.' },
        { accent: 'Late', label: 'Rises again — healthcare', detail: 'Medical and long-term care costs dominate.' },
      ],
      layout: 'rows',
      footerNote: "Flat-real-spending plans overestimate total need. — David Blanchett, Morningstar",
    },
  },

  // 16. ArcVest's real return assumptions (6:25–6:55)
  {
    startSec: 385,
    endSec: 415,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'How ArcVest builds retirement plans',
      heading: 'Real return assumptions',
      columns: ['Component', 'Assumption'],
      rows: [
        { cells: ['Equity portion — real return', '4 – 5%'] },
        { cells: ['Reasoning', 'Below long-run US average — valuations are elevated.'] },
        { cells: ['Scenario method', 'Optimistic / Central / Pessimistic'], emphasis: true },
      ],
      footer: 'Anyone giving you one number with high confidence is selling you certainty they do not have.',
    },
  },

  // 17. The biggest risks primer (6:55–7:35)
  {
    startSec: 415,
    endSec: 455,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'The biggest actual risks',
      heading: "It's not 4% vs 4.7%.",
      items: [
        { accent: 'Risk 1', label: 'Selling equities at the bottom', detail: 'Panic-driven decisions lock in permanent damage.' },
        { accent: 'Risk 2', label: 'Dying with $3M unspent', detail: 'Too frightened to spend what you actually earned.' },
        { accent: 'Risk 3', label: 'The 401(k) RMD trap', detail: 'Massive RMDs spike Medicare premiums and tax brackets at the worst time.' },
      ],
      layout: 'rows',
    },
  },

  // 18. Action step worked example (7:35–8:05)
  {
    startSec: 455,
    endSec: 485,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Action step',
      headline: 'Multiply your portfolio spend × 25.',
      setup: 'Spend need is AFTER Social Security and other income.',
      steps: [
        { label: 'If portfolio need = $60,000/yr', value: '$1.5M target' },
        { label: 'If portfolio need = $80,000/yr', value: '$2.0M target' },
      ],
      outcome: {
        label: 'Write it down. Compare to what you have.',
        value: 'Your zone of relevance',
      },
    },
  },

  // 19. Below threshold? Calibrate (8:05–8:35)
  {
    startSec: 485,
    endSec: 515,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Below the threshold? Calibrate.',
      subline: 'Save more · adjust the retirement date · trim spending · maximize Social Security.',
      footer: 'Not cause for alarm. A calibration.',
    },
  },

  // 20. Tomorrow tease (8:35–9:00)
  {
    startSec: 515,
    endSec: 540,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Tomorrow: Annuities.',
      subline: 'When does an annuity actually make sense — and when is it a sales pitch dressed up as security?',
    },
  },

  // 21. Outro (9:00–9:15)
  {
    startSec: 540,
    endSec: 555,
    kind: 'slide',
    slide: 'outro',
    props: {
      url: episodeConfig.ctaUrl,
      tagline: episodeConfig.tagline,
      disclaimer: episodeConfig.disclaimer,
    },
  },
];
