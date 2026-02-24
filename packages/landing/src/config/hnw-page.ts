export const hnwPage = {
  meta: {
    title: 'Wealth Management Without the Conflicts | ArcVest',
    description:
      'Fee-only fiduciary wealth management for high-net-worth families. Evidence-based investing, tax optimization, and estate coordination.',
  },

  hero: {
    badge: '$2M+ Portfolio Focus',
    headline: 'Wealth Management\nWithout the Conflicts',
    subheadline:
      'Your current adviser may cost you more than you think. Discover fee-only, evidence-based wealth management built for sophisticated investors.',
    ctaText: 'Request a Private Consultation',
    trustLine:
      'Fee-only fiduciary | Limited to 100 families | By referral & application',
  },

  trustBar: [
    { label: 'Fee-Only Fiduciary' },
    { label: 'SEC-Registered' },
    { label: '$2M+ Portfolio Focus' },
    { label: 'No Commissions, Ever' },
  ],

  problem: {
    heading: 'What 1% Actually Costs You',
    subheading:
      'The traditional wealth management model is designed to benefit advisers, not clients.',
    cards: [
      {
        icon: '\u{1F4C9}',
        title: '92% of Active Funds Underperform',
        description:
          'Over a 15-year period, 92% of actively managed large-cap funds failed to beat the S&P 500. Yet most advisers still use them — because they generate higher commissions.',
      },
      {
        icon: '\u{1F4B8}',
        title: '$750K+ in Hidden Costs',
        description:
          'On a $3M portfolio, the difference between a 1% AUM fee with expensive funds vs. our approach can exceed $750,000 over 20 years in lost compounding.',
      },
      {
        icon: '\u{1F4CA}',
        title: '3%+ Value of Behavioral Coaching',
        description:
          "Vanguard's research shows that behavioral coaching — preventing panic selling and emotional decisions — adds 3%+ in annual returns. That's where real advisory value lies.",
      },
    ],
  },

  approach: {
    heading: 'How We Differ',
    subheading:
      'A modern wealth management experience built on evidence, transparency, and alignment.',
    cards: [
      {
        icon: '\u2696\uFE0F',
        title: 'Fee-Only, No Exceptions',
        description:
          'We earn fees only from you — never from commissions, revenue sharing, or product placement. Complete alignment of interests.',
      },
      {
        icon: '\u{1F4CB}',
        title: 'Tax Optimization',
        description:
          'Tax-loss harvesting, asset location, Roth conversion strategies, and charitable giving optimization. We focus on after-tax returns, not just gross performance.',
      },
      {
        icon: '\u{1F3DB}\uFE0F',
        title: 'Estate Coordination',
        description:
          'We work with your estate attorney and CPA to ensure your wealth transfer plan is tax-efficient, well-documented, and aligned with your wishes.',
      },
      {
        icon: '\u{1F4D0}',
        title: 'Evidence-Based Portfolios',
        description:
          'Grounded in Nobel Prize-winning research. Globally diversified, factor-tilted, and systematically rebalanced. No market timing, no stock picking.',
      },
    ],
  },

  credentials: {
    heading: 'Who We Serve',
    description:
      'ArcVest maintains a deliberately limited practice, serving a select number of high-net-worth families who value evidence over opinion and transparency over tradition.',
    points: [
      'Limited to 100 client families for personalized attention',
      'Minimum portfolio size of $2M for wealth management services',
      'CFP\u00AE, CFA\u00AE, and CPA credentials on the advisory team',
      'Quarterly portfolio reviews with direct adviser access',
    ],
  },

  stats: [
    { value: '0.50%', label: 'Transparent Annual Fee' },
    { value: '$0', label: 'Commissions Earned' },
    { value: '100%', label: 'Fiduciary, Always' },
  ],

  leadForm: {
    heading: 'Request a Private Consultation',
    subheading:
      'A 30-minute, no-obligation conversation about your portfolio and whether our approach is right for you.',
    buttonText: 'Request My Consultation',
  },

  faqs: {
    heading: 'Frequently Asked Questions',
    items: [
      {
        question: 'What does fee-only fiduciary mean?',
        answer:
          'Fee-only means we receive compensation solely from our clients — never from commissions, referral fees, or product sales. Fiduciary means we are legally obligated to act in your best interest at all times. Combined, this creates complete alignment: our only incentive is to grow and protect your wealth.',
      },
      {
        question: 'How much does ArcVest charge?',
        answer:
          'Our fee is a straightforward 0.50% of assets under management annually, billed quarterly. There are no hidden fees, no trading commissions, and no additional charges for financial planning, tax optimization, or estate coordination. For a $3M portfolio, that\'s $15,000/year — compared to $30,000+ at a traditional 1% adviser.',
      },
      {
        question: 'What is your investment approach?',
        answer:
          'We build globally diversified portfolios grounded in decades of academic research. We use low-cost index and factor-based funds, systematic rebalancing, and tax-loss harvesting. We do not pick stocks, time markets, or chase performance. This evidence-based approach has consistently outperformed actively managed strategies over long time horizons.',
      },
      {
        question: 'How is ArcVest different from private banking or wirehouses?',
        answer:
          'Private banks and wirehouses (Morgan Stanley, Merrill Lynch, etc.) are broker-dealers that earn revenue from product sales, proprietary funds, and transaction fees. Their advisers face inherent conflicts of interest. ArcVest is an independent, fee-only RIA with no products to sell. We provide institutional-quality investment management and planning without the conflicts.',
      },
    ],
  },
} as const;
