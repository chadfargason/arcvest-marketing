// Slide plan for "No Free Lunch in Income Investing" episode (Apr 13, 2026)
// Timestamps in seconds. Source video: public/source/episode-2026-04-13-no-free-lunch-1080p24.mp4

export const episodeConfig = {
  title: 'There Is No Free Lunch in Income Investing',
  showTitle: 'The Wealth Strategy Podcast by ArcVest',
  hosts: 'Chad Fargason & Eric Cooper',
  date: 'April 13, 2026',
  sourceVideo: 'source/episode-2026-04-13-no-free-lunch-1080p24.mp4',
  fps: 24,
  widthPx: 1920,
  heightPx: 1080,
  durationSec: 1552.3,
  ctaUrl: 'arcvest.com',
  tagline: 'Pay Less. Keep More.',
  disclaimer:
    'Hypothetical illustrations. Past performance does not guarantee future results. Return figures referenced are stated by the hosts on-air and approximate 10-year total-return comparisons using commonly referenced ETF proxies (SPY, BIZD, VNQ, AMLP, NOBL). Not a forecast. Not individualized investment advice.',
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
  | 'outro';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Segment {
  startSec: number;
  endSec: number;
  kind: SegmentKind;
  slide?: SlideKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
}

export const slidePlan: Segment[] = [
  // Part 1 — Cold open + intro
  { startSec: 0, endSec: 27, kind: 'video' },
  {
    startSec: 27,
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
  { startSec: 38, endSec: 102, kind: 'video' },

  // Part 2 — Free-lunch myth + scale of private credit
  {
    startSec: 102,
    endSec: 120,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: 'Private credit market size',
      value: '$2–3T',
      context: 'Up from a few hundred billion to $2–3 trillion in a decade.',
    },
  },
  { startSec: 120, endSec: 210, kind: 'video' },

  {
    startSec: 210,
    endSec: 225,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: '9–11% yield.',
      subline: 'No volatility. Semi-liquid. Equity-like upside.',
      footer: 'No free lunch.',
    },
  },
  { startSec: 225, endSec: 294, kind: 'video' },

  // Part 3 — SaaS-pocalypse + gates
  {
    startSec: 294,
    endSec: 308,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Part 2', title: 'The SaaS-pocalypse' },
  },
  { startSec: 308, endSec: 450, kind: 'video' },

  {
    startSec: 450,
    endSec: 470,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'PIK toggles',
      subline: 'Paying interest with more debt.',
      footer: 'Volatility laundering.',
    },
  },
  { startSec: 470, endSec: 510, kind: 'video' },

  {
    startSec: 510,
    endSec: 570,
    kind: 'slide',
    slide: 'timeline',
    props: {
      heading: 'The Unmasking — Feb to Apr 2026',
      events: [
        {
          date: 'Feb 9, 2026',
          title: 'UBS warns: 13% default-rate projection',
          detail: 'AI "liquefying the moats" of legacy SaaS borrowers.',
        },
        {
          date: 'Feb 18, 2026',
          title: 'Blue Owl sells $1.4B in assets',
          detail: 'Shoring up liquidity as quarterly marks come under pressure.',
        },
        {
          date: 'Apr 2, 2026',
          title: 'Blue Owl caps withdrawals',
          detail: '$5.4B Q1 redemption requests. OCIC hit 21.9% of shares.',
        },
        {
          date: 'Apr 6–9, 2026',
          title: 'Gates slam shut industry-wide',
          detail: 'Barings & Ares cap at 5%. Carlyle requests at 15.7% — triple the limit.',
        },
      ],
    },
  },
  {
    startSec: 570,
    endSec: 600,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: 'Capital trapped behind the gates',
      value: '$4.6B',
      context: 'Investor capital frozen as of early April 2026.',
      attribution: 'Bloomberg',
      emphasisColor: 'gap',
    },
  },
  { startSec: 600, endSec: 750, kind: 'video' },

  // Part 4 — Yield ≠ Return
  {
    startSec: 750,
    endSec: 765,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Yield ≠ Return.',
      subline: 'There is only total return.',
    },
  },
  { startSec: 765, endSec: 927, kind: 'video' },

  // Part 5 — The three charts (BDC / REIT / MLP)
  {
    startSec: 927,
    endSec: 960,
    kind: 'slide',
    slide: 'dual-line',
    props: {
      heading: 'BDCs vs SPY',
      winnerLabel: 'SPY',
      winnerEndValue: '$3.95',
      loserLabel: 'BIZD',
      loserEndValue: '$2.47',
      caveat: 'Just as volatile as stocks — with half the return.',
    },
  },
  { startSec: 960, endSec: 1020, kind: 'video' },

  {
    startSec: 1020,
    endSec: 1035,
    kind: 'slide',
    slide: 'dual-line',
    props: {
      heading: 'REITs vs SPY',
      winnerLabel: 'SPY',
      winnerEndValue: '$3.95',
      loserLabel: 'VNQ',
      loserEndValue: '$1.65',
      caveat: 'Rate-sensitive. Not the safety story it was sold as.',
    },
  },
  { startSec: 1035, endSec: 1160, kind: 'video' },

  {
    startSec: 1160,
    endSec: 1195,
    kind: 'slide',
    slide: 'dual-line',
    props: {
      heading: 'MLPs vs SPY',
      winnerLabel: 'SPY',
      winnerEndValue: '$3.95',
      loserLabel: 'AMLP',
      loserEndValue: '$1.82',
      caveat: 'AMLP lost 32% in 2020. Never caught back up.',
    },
  },
  {
    startSec: 1195,
    endSec: 1220,
    kind: 'slide',
    slide: 'scoreboard',
    props: {
      heading: 'The 10-Year Scoreboard',
      subheading: '$1 invested, total return (Jan 2016 – Dec 2025)',
      rows: [
        { label: 'SPY (S&P 500)', value: 3.95, display: '$3.95', isWinner: true },
        { label: 'BIZD (BDCs)', value: 2.47, display: '$2.47' },
        { label: 'AMLP (MLPs)', value: 1.82, display: '$1.82' },
        { label: 'VNQ (REITs)', value: 1.65, display: '$1.65' },
      ],
    },
  },
  { startSec: 1220, endSec: 1328, kind: 'video' },

  // Part 6 — Aristocrats & 80/20
  {
    startSec: 1328,
    endSec: 1345,
    kind: 'slide',
    slide: 'stat',
    props: {
      kicker: '10-year annualized returns',
      value: '12.0% vs 10.1%',
      context: '80/20 SPY + Treasuries beat the Dividend Aristocrats (NOBL).',
    },
  },
  { startSec: 1345, endSec: 1380, kind: 'video' },

  {
    startSec: 1380,
    endSec: 1400,
    kind: 'slide',
    slide: 'concept',
    props: {
      headline: 'Dividends = tax drag.',
      subline: 'Ordinary income tax on yield you may not even need.',
    },
  },
  { startSec: 1400, endSec: 1410, kind: 'video' },

  // Part 7 — Minimalist Solution
  {
    startSec: 1410,
    endSec: 1420,
    kind: 'slide',
    slide: 'chapter',
    props: { kicker: 'Part 5', title: 'The Minimalist Solution' },
  },
  { startSec: 1420, endSec: 1430, kind: 'video' },

  {
    startSec: 1430,
    endSec: 1480,
    kind: 'slide',
    slide: 'checklist',
    props: {
      heading: 'Own this, full stop.',
      items: [
        {
          title: '70–80% broad risk assets',
          detail: 'S&P 500, total US market, some international + gold for diversification.',
        },
        {
          title: '20% in T-bills or short, high-quality bonds',
          detail: 'Triple-B and up. Stability and liquidity — not reaching for yield.',
        },
        {
          title: 'Sell shares when you need cash',
          detail: 'It\'s more tax-efficient than "living off income."',
        },
      ],
    },
  },
  { startSec: 1480, endSec: 1520, kind: 'video' },

  {
    startSec: 1520,
    endSec: 1532,
    kind: 'slide',
    slide: 'quote',
    props: {
      quote: 'Low fees, broadly diversified, sell shares when you need them.',
      attribution: 'Chad Fargason',
    },
  },
  { startSec: 1532, endSec: 1547, kind: 'video' },

  // Part 8 — Outro
  {
    startSec: 1547,
    endSec: 1552,
    kind: 'slide',
    slide: 'outro',
    props: {
      url: episodeConfig.ctaUrl,
      tagline: episodeConfig.tagline,
      disclaimer: episodeConfig.disclaimer,
    },
  },
];
