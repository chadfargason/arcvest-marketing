// Slide plan for "Mastering Retirement: 5 Critical Decisions" (Apr 21, 2026)
// Timestamps in seconds. Source: public/source/episode-2026-04-21-five-decisions-1080p24.mp4
// Anchors locked to ElevenLabs Scribe transcription (transcript.json).

export const episodeConfig = {
  title: 'The Five Retirement Decisions',
  showTitle: 'The Wealth Strategy Podcast by ArcVest',
  hosts: 'Chad Fargason & Erik Cooper',
  date: 'April 21, 2026',
  sourceVideo: 'source/episode-2026-04-21-five-decisions-1080p24.mp4',
  fps: 24,
  widthPx: 1920,
  heightPx: 1080,
  durationSec: 1586,
  ctaUrl: 'arcvest.com/retirement',
  tagline: 'Pay Less. Keep More.',
  disclaimer:
    'Hypothetical illustrations for educational purposes. Not individualized investment or tax advice. Numbers shown are approximate and may differ from your own situation. IRMAA thresholds update annually — confirm with Medicare.gov before acting. Past performance does not guarantee future results.',
} as const;

export type SegmentKind = 'video' | 'slide';
export type SlideKind =
  | 'title'
  | 'chapter'
  | 'timeline'
  | 'dual-line'
  | 'scoreboard'
  | 'stat'
  | 'checklist'
  | 'quote'
  | 'concept'
  | 'primer'
  | 'outro'
  | 'worked-example'
  | 'table';

// New convention (ep2+): captions play over both video AND slides, so we no
// longer suppress them on any slide kind. Slides are designed with bottom
// ~130px as caption territory. Kept as an empty set for future flexibility.
export const CAPTION_SUPPRESSING_KINDS: ReadonlySet<SlideKind> = new Set([]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Segment {
  startSec: number;
  endSec: number;
  kind: SegmentKind;
  slide?: SlideKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
  pipStartSec?: number;
}

// Fee-drag chart: compute real compound paths for $1M @ 7% gross,
// 1.5% vs 0.5% fees over 30 years.
function feeDragPath(netReturn: number, years: number): number[] {
  const path: number[] = [1];
  for (let y = 1; y <= years; y++) {
    path.push(path[path.length - 1] * (1 + netReturn));
  }
  return path;
}
const HIGH_FEE_PATH = feeDragPath(0.07 - 0.015, 30); // 1.5% all-in → 5.5% net → ends ~$4.98M
const LOW_FEE_PATH = feeDragPath(0.07 - 0.005, 30);  // 0.5% all-in → 6.5% net → ends ~$6.61M

export const slidePlan: Segment[] = [
  // ========== PART 1 — Intro & the 5 Decisions (0:00 – 3:21) ==========

  { startSec: 0, endSec: 25, kind: 'video' },

  {
    startSec: 25,
    endSec: 38,
    kind: 'slide',
    slide: 'title',
    props: {
      showTitle: episodeConfig.showTitle,
      episodeTitle: episodeConfig.title,
      hosts: episodeConfig.hosts,
      date: episodeConfig.date,
    },
  },

  { startSec: 38, endSec: 64, kind: 'video' },

  {
    startSec: 64,
    endSec: 82,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Five money decisions.',
      subline: 'Every one of them is in your hands.',
    },
  },

  { startSec: 82, endSec: 183, kind: 'video' },

  {
    startSec: 183,
    endSec: 201,
    kind: 'slide',
    slide: 'checklist',
    props: {
      heading: 'The Five Retirement Decisions',
      items: [
        { title: 'Base withdrawal rate', detail: 'How much to pull from your portfolio each year.' },
        { title: 'Social Security timing', detail: 'When to claim — 62, 67, or 70.' },
        { title: 'Roth conversions', detail: 'When (and whether) to convert.' },
        { title: 'Account sequencing', detail: 'Which bucket to spend from first.' },
        { title: 'Fees', detail: 'What you pay in advisory + product costs.' },
      ],
    },
  },

  // ========== PART 2 — The 4% Rule (3:21 – 8:04) ==========

  {
    startSec: 201,
    endSec: 215,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Decision 1', title: 'The 4% Rule' },
  },

  { startSec: 215, endSec: 238, kind: 'video' },

  {
    startSec: 238,
    endSec: 260,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Primer',
      heading: 'The 4% Rule — Origin',
      items: [
        {
          accent: '1994',
          label: 'William Bengen',
          detail: 'Studied 90 years of US stock & bond returns.',
        },
        {
          accent: 'Horizon',
          label: '30-year retirement',
          detail: 'How much could retirees safely withdraw each year?',
        },
        {
          accent: 'Answer',
          label: '4% "safe max"',
          detail: 'Take 4% year one, adjust for inflation every year after.',
        },
      ],
      layout: 'rows',
    },
  },

  {
    startSec: 260,
    endSec: 295,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Example',
      headline: 'The 4% Rule — $1M portfolio',
      setup: '4% starting withdrawal, adjusted up by 3% inflation each year.',
      steps: [
        { label: 'Year 1: $1,000,000 × 4%', value: '$40,000' },
        { label: 'Year 2: $40,000 × 1.03 inflation', value: '$41,200' },
        { label: 'Year 3: $41,200 × 1.03 inflation', value: '$42,436' },
        { label: 'Year 10 (compounded)', value: '$52,192' },
        { label: 'Year 30 (still going)', value: '$94,262' },
      ],
      outcome: {
        label: 'Same real lifestyle, for 30+ years',
        value: "Bengen's original rule",
      },
    },
  },

  { startSec: 295, endSec: 345, kind: 'video' },

  {
    startSec: 345,
    endSec: 365,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: '2024 revisit — Bengen himself',
      value: '4.5 – 4.8%',
      context: 'Safe max bumped up after 30 more years of data.',
    },
  },

  { startSec: 365, endSec: 388, kind: 'video' },

  {
    startSec: 388,
    endSec: 418,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Refinement',
      heading: 'The Guardrails Strategy',
      items: [
        {
          accent: 'Down year',
          label: 'Withdraw a little less',
          detail: 'Ease off spending when the portfolio takes a hit.',
        },
        {
          accent: 'Up year',
          label: 'Withdraw a little more',
          detail: 'Take more when the market gives you more.',
        },
        {
          accent: 'Result',
          label: 'Portfolio lasts longer',
          detail: 'Flexibility beats rigidity in a 30-year plan.',
        },
      ],
      layout: 'rows',
    },
  },

  { startSec: 418, endSec: 448, kind: 'video' },

  {
    startSec: 448,
    endSec: 478,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'Nuance',
      heading: 'Who should adjust the 4% rule?',
      columns: ['Your profile', 'Starting rate', 'Why'],
      rows: [
        { cells: ['50, retiring, live to 95', '≤ 3.5%', '45-year horizon'] },
        { cells: ['65, retiring, live to 95', '4% (original)', '30-year horizon'], emphasis: true },
        { cells: ['70s, still working', '5 – 7%', 'Short horizon'] },
      ],
      footer: "The rule is a guideline, not a law.",
    },
  },

  { startSec: 478, endSec: 484, kind: 'video' },

  // ========== PART 3 — Social Security Claiming (8:04 – 12:20) ==========

  {
    startSec: 484,
    endSec: 500,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Decision 2', title: 'When to Claim Social Security' },
  },

  { startSec: 500, endSec: 516, kind: 'video' },

  {
    startSec: 516,
    endSec: 546,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Primer',
      heading: 'The claiming window',
      items: [
        {
          accent: 'Earliest',
          label: 'Age 62 — with a 30% discount',
          detail: 'Permanent reduction to your monthly benefit.',
        },
        {
          accent: 'FRA',
          label: 'Age 67 — full retirement age',
          detail: 'Your "base" benefit. The benchmark.',
        },
        {
          accent: 'Max',
          label: 'Age 70 — delayed retirement credits',
          detail: 'After 70, there are no more gains from waiting.',
        },
      ],
      layout: 'rows',
    },
  },

  { startSec: 546, endSec: 560, kind: 'video' },

  {
    startSec: 560,
    endSec: 596,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'Example',
      heading: '$3,000/mo FRA benefit — claim age matters',
      columns: ['Claim age', 'Monthly benefit', 'vs FRA'],
      rows: [
        { cells: ['62 (earliest)', '$2,100', '−30%'] },
        { cells: ['67 (FRA)', '$3,000', 'baseline'] },
        { cells: ['70 (max)', '$3,720', '+24%'], emphasis: true },
      ],
      footer: 'After age 70 you get no further credits for delaying.',
    },
  },

  { startSec: 596, endSec: 620, kind: 'video' },

  {
    startSec: 620,
    endSec: 645,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Delay = 8% a year, guaranteed.',
      subline: 'From age 67 to 70. No investment product matches that.',
    },
  },

  { startSec: 645, endSec: 685, kind: 'video' },

  {
    startSec: 685,
    endSec: 720,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Married-couple nuance',
      heading: 'Why the higher earner should delay to 70',
      items: [
        {
          accent: '+8%/yr',
          label: 'Guaranteed growth',
          detail: "Better than any bond. Truly risk-free.",
        },
        {
          accent: 'Longevity',
          label: 'Hedges a long life',
          detail: 'If you live to 95+, the delayed benefit pays off enormously.',
        },
        {
          accent: 'Survivor',
          label: "Spouse inherits the higher benefit",
          detail: "When the higher earner dies, spouse's benefit steps up to theirs.",
        },
      ],
      layout: 'rows',
      footerNote: 'Break-even typically falls in the mid-to-late 80s.',
    },
  },

  { startSec: 720, endSec: 732, kind: 'video' },

  {
    startSec: 732,
    endSec: 740,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: 'Free tool',
      value: 'sherpaplan.com',
      context: 'Run your own Social Security break-even analysis.',
      emphasisColor: 'arcvest',
    },
  },

  // ========== PART 4 — Roth Conversions (12:20 – 15:33) ==========

  {
    startSec: 740,
    endSec: 757,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Decision 3', title: 'Roth Conversions' },
  },

  { startSec: 757, endSec: 780, kind: 'video' },

  {
    startSec: 780,
    endSec: 814,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Primer',
      heading: 'What is a Roth conversion?',
      items: [
        {
          accent: 'Move',
          label: 'Traditional IRA / 401(k) → Roth IRA',
          detail: 'You choose how much to convert and when.',
        },
        {
          accent: 'Pay now',
          label: 'Owe income tax this year on the amount',
          detail: 'It counts as ordinary income for the year of conversion.',
        },
        {
          accent: 'Never again',
          label: 'Tax-free growth, forever',
          detail: 'No taxes on gains. No Required Minimum Distributions.',
        },
      ],
      layout: 'rows',
    },
  },

  { startSec: 814, endSec: 834, kind: 'video' },

  {
    startSec: 834,
    endSec: 870,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'Timing',
      heading: 'The Roth conversion window',
      columns: ['Age', 'Status', 'Tax situation'],
      rows: [
        { cells: ['65', 'Retire', 'Earned income drops'] },
        { cells: ['65 – 70', 'Gap years', 'Low income — CONVERT HERE'], emphasis: true },
        { cells: ['70', 'Claim Social Security', 'Income rises'] },
        { cells: ['73', 'RMDs begin', 'Income forced up — too late'] },
      ],
      footer: 'The 5-year window between retiring and claiming SS is the sweet spot.',
    },
  },

  {
    startSec: 870,
    endSec: 910,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Example',
      headline: 'Convert $50,000 — when?',
      setup: 'Same dollar amount, two different ages. Watch the tax bill.',
      steps: [
        { label: 'Convert at 68 (gap year, 12% bracket)', value: '$6,000 tax' },
        { label: 'Convert at 74 (RMDs + SS, ~25% effective)', value: '$12,500 tax' },
        { label: 'Extra tax from waiting', value: '+$6,500' },
      ],
      outcome: {
        label: 'Same conversion. Roughly half the tax.',
        value: 'Time matters',
      },
    },
  },

  { startSec: 910, endSec: 935, kind: 'video' },

  // ========== PART 5 — Account Sequencing + IRMAA (15:33 – 20:22) ==========

  {
    startSec: 935,
    endSec: 953,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Decision 4', title: 'Account Sequencing' },
  },

  { startSec: 953, endSec: 975, kind: 'video' },

  {
    startSec: 975,
    endSec: 1008,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'Gotcha',
      heading: 'Meet IRMAA',
      items: [
        {
          accent: 'What',
          label: 'Income-Related Monthly Adjustment Amount',
          detail: 'A surcharge on Medicare Part B and Part D premiums.',
        },
        {
          accent: 'Trigger',
          label: 'High MAGI in retirement',
          detail: 'Above set thresholds, your premium jumps automatically.',
        },
        {
          accent: 'Cost',
          label: '$1,000 – $5,000+ per person per year',
          detail: 'Applied 2 years in arrears (2026 IRMAA uses your 2024 return).',
        },
      ],
      layout: 'rows',
    },
  },

  {
    startSec: 1008,
    endSec: 1048,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'Estimated 2026',
      heading: 'IRMAA brackets — married filing jointly',
      columns: ['2024 MAGI', 'Extra Medicare / person / month'],
      rows: [
        { cells: ['≤ $212,000', '$0 (standard premium)'] },
        { cells: ['$212 – $266,000', '~$74/mo'] },
        { cells: ['$266 – $334,000', '~$185/mo'] },
        { cells: ['$334 – $400,000', '~$297/mo'] },
        { cells: ['> $400,000', '~$408/mo + Part D surcharge'], emphasis: true },
      ],
      footer: 'Cross a bracket by $1 → pay the full surcharge. Plan proactively.',
    },
  },

  { startSec: 1048, endSec: 1072, kind: 'video' },

  {
    startSec: 1072,
    endSec: 1098,
    kind: 'slide',
    slide: 'checklist',
    props: {
      heading: 'Conventional wisdom — withdrawal order',
      items: [
        { title: '1. Taxable brokerage first', detail: 'Let tax-advantaged accounts keep compounding.' },
        { title: '2. Traditional IRA / 401(k) next', detail: 'Ordinary income when you pull it out.' },
        { title: '3. Roth IRA last', detail: 'Tax-free forever, no RMDs — save it for last.' },
      ],
    },
  },

  { startSec: 1098, endSec: 1106, kind: 'video' },

  // Chad's timing: Blended primer at 18:26
  {
    startSec: 1106,
    endSec: 1150,
    kind: 'slide',
    slide: 'primer',
    props: {
      kicker: 'The nuance',
      heading: 'Blended withdrawals usually win',
      items: [
        {
          accent: 'All taxable',
          label: 'Miss out on long-term cap-gains rates',
          detail: 'You paid tax on the principal already — selling is just gains.',
        },
        {
          accent: 'All IRA',
          label: 'Push yourself into higher brackets',
          detail: 'Every dollar counts as ordinary income. Stacks up fast.',
        },
        {
          accent: 'Blended',
          label: 'Lower total tax over retirement',
          detail: 'Use cap gains AND ordinary-income brackets strategically.',
        },
      ],
      layout: 'rows',
    },
  },

  // Chad's timing: "In your 20s-40s" checklist at 19:10
  {
    startSec: 1150,
    endSec: 1205,
    kind: 'slide',
    slide: 'checklist',
    props: {
      heading: 'In your 20s–40s, contribute to all three',
      items: [
        { title: 'Pre-tax: 401(k) / Traditional IRA', detail: 'Deduction today. Ordinary income in retirement.' },
        { title: 'Post-tax: Roth IRA / Roth 401(k)', detail: 'No deduction today. Tax-free forever.' },
        { title: 'Flexible: Taxable brokerage', detail: 'No tax benefits. Long-term cap-gains rates.' },
      ],
    },
  },

  // Chad's timing: "Blended vs Pure" worked example at 20:05
  {
    startSec: 1205,
    endSec: 1230,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Example',
      headline: 'Blended vs pure — $1M retiree, ~$85K/yr spend',
      setup: 'Same lifestyle, same total dollars withdrawn. Only the source differs.',
      steps: [
        { label: 'Pull all from Traditional IRA', value: '~$220,000 tax' },
        { label: 'Blend: some taxable + some IRA', value: '~$170,000 tax' },
        { label: 'Total tax savings over retirement', value: '~$50,000' },
      ],
      outcome: {
        label: 'A $50K tax-efficiency lever — for free',
        value: 'Blend > Pure',
      },
    },
  },

  // ========== PART 6 — Fees (20:22 – 24:17) ==========

  // Chad's timing: Fees chapter at 20:30, short window
  {
    startSec: 1230,
    endSec: 1240,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Decision 5', title: 'Fees' },
  },

  { startSec: 1240, endSec: 1269, kind: 'video' },

  // Chad's timing: fee structure table at 21:09
  {
    startSec: 1269,
    endSec: 1300,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'Industry benchmark',
      heading: 'Typical advisor vs ArcVest — all-in fees',
      columns: ['Fee layer', 'Typical advisor', 'ArcVest'],
      rows: [
        { cells: ['Advisory fee', '1.00%', '0.40%'] },
        { cells: ['Product costs (ETFs)', '0.50 – 1.00%', '0.03 – 0.10%'] },
        { cells: ['All-in total', '1.50 – 2.00%', '0.43 – 0.50%'], emphasis: true },
      ],
      footer: 'The gap is where your compounding goes — to your advisor, or to you.',
    },
  },

  { startSec: 1300, endSec: 1315, kind: 'video' },

  // Chad's timing: $1M worked example at 21:55
  {
    startSec: 1315,
    endSec: 1345,
    kind: 'slide',
    slide: 'worked-example',
    props: {
      kicker: 'Example',
      headline: '$1M portfolio — annual fee drag',
      setup: 'Same portfolio, same market return. Only the fees differ.',
      steps: [
        { label: 'Typical advisor (1.0% advisory)', value: '$10,000/yr' },
        { label: 'ArcVest (0.4% advisory)', value: '$4,000/yr' },
        { label: 'Annual difference', value: '$6,000/yr' },
      ],
      outcome: {
        label: 'What if we let $6K/yr compound instead?',
        value: 'See next slide',
      },
    },
  },

  { startSec: 1345, endSec: 1365, kind: 'video' },

  // Chad's timing: chart at ~22:45, tight 20-second window
  {
    startSec: 1365,
    endSec: 1385,
    kind: 'slide',
    slide: 'dual-line',
    props: {
      heading: 'Fee drag compounded — 30 years on $1M',
      subheading: '$1M start · 7% gross return · 1.5% vs 0.5% all-in fee',
      winnerLabel: 'ArcVest',
      winnerEndValue: '$6.61M',
      loserLabel: 'Typical',
      loserEndValue: '$4.98M',
      winnerPath: LOW_FEE_PATH,
      loserPath: HIGH_FEE_PATH,
      caveat: 'Over $1.6 million more — just from keeping your fees low.',
      period: 'Year 0 – Year 30',
    },
  },

  // Immediately after chart: the $1.63M stat (Chad: no more than 20s after chart)
  {
    startSec: 1385,
    endSec: 1410,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: 'At age 95',
      value: '$1.63M more',
      context: "That's the real compound cost of a 1% annual fee difference.",
      emphasisColor: 'gap',
    },
  },

  // Chad's request: bring the fee-structure table back at 23:30–23:50
  {
    startSec: 1410,
    endSec: 1430,
    kind: 'slide',
    slide: 'table',
    props: {
      kicker: 'The bottom line',
      heading: 'Where your fees actually go',
      columns: ['Fee layer', 'Typical advisor', 'ArcVest'],
      rows: [
        { cells: ['Advisory fee', '1.00%', '0.40%'] },
        { cells: ['Product costs (ETFs)', '0.50 – 1.00%', '0.03 – 0.10%'] },
        { cells: ['All-in total', '1.50 – 2.00%', '0.43 – 0.50%'], emphasis: true },
      ],
      footer: 'Same market. Same advisor quality. Half the all-in fee.',
    },
  },

  { startSec: 1430, endSec: 1457, kind: 'video' },

  // ========== PART 7 — Recap & Outro (24:17 – 26:26) ==========

  {
    startSec: 1457,
    endSec: 1477,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Recap', title: 'The Five Decisions, Together' },
  },

  {
    startSec: 1477,
    endSec: 1542,
    kind: 'slide',
    slide: 'checklist',
    props: {
      heading: 'Putting it all together',
      items: [
        { title: 'Withdraw ~4% (adjust for horizon & markets)', detail: 'Less at 50 retirement, more in your 70s.' },
        { title: 'Delay Social Security to 70 (higher earner)', detail: '8%/yr guaranteed + spouse protection.' },
        { title: 'Roth conversions in your 65–70 gap years', detail: 'Pay 12% now instead of 25% later.' },
        { title: 'Blend taxable + IRA withdrawals', detail: 'Use both brackets strategically.' },
        { title: 'Keep all-in fees under 0.5%', detail: 'Compounds to 7-figures over a 30-year retirement.' },
      ],
    },
  },

  { startSec: 1542, endSec: 1578, kind: 'video' },

  {
    startSec: 1578,
    endSec: 1586,
    kind: 'slide',
    slide: 'outro',
    props: {
      url: episodeConfig.ctaUrl,
      tagline: episodeConfig.tagline,
      disclaimer: episodeConfig.disclaimer,
    },
  },
];
