export const retirementPage = {
  meta: {
    title: 'Plan Retirement With Confidence | ArcVest',
    description:
      'Download your free pre-retirement planning guide. Evidence-based, fee-only wealth management from a fiduciary adviser.',
  },

  hero: {
    badge: 'Free Retirement Planning Guide',
    headline: 'Plan Retirement With\nConfidence, Not Worry',
    subheadline:
      'Get the evidence-based roadmap used by our clients to retire on their terms — without the fear of running out of money.',
    ctaText: 'Download Your Free Retirement Guide',
    trustLine:
      'Trusted by 200+ families | Fee-only fiduciary | No sales pitch',
  },

  trustBar: [
    { label: 'Fee-Only Fiduciary' },
    { label: 'SEC-Registered' },
    { label: 'Evidence-Based Approach' },
    { label: 'No Commissions' },
  ],

  painPoints: {
    heading: 'The Questions That Keep Pre-Retirees Up at Night',
    cards: [
      {
        icon: '&#9201;',
        title: 'Will My Money Last?',
        description:
          '48% of Americans worry about outliving their retirement savings. A proper withdrawal strategy and portfolio design can address longevity risk head-on.',
      },
      {
        icon: '&#127973;',
        title: 'Healthcare Costs Are Rising',
        description:
          'The average retired couple needs $315,000+ for healthcare expenses. Planning for Medicare gaps and long-term care is essential.',
      },
      {
        icon: '&#128200;',
        title: 'When to Claim Social Security?',
        description:
          'The difference between claiming at 62 vs. 70 can be $100,000+ in lifetime benefits. Timing depends on your complete financial picture.',
      },
    ],
  },

  approach: {
    heading: 'The ArcVest Approach to Retirement',
    subheading:
      'We combine evidence-based investing with comprehensive planning — no sales pitches, no conflicts of interest.',
    cards: [
      {
        icon: '&#128202;',
        title: 'Evidence-Based Investing',
        description:
          'Portfolios grounded in academic research and decades of market data, not gut feelings or market predictions.',
      },
      {
        icon: '&#9989;',
        title: 'Fee-Only, Always',
        description:
          'We earn fees only from you — never from commissions, product sales, or kickbacks. Our incentives are 100% aligned with yours.',
      },
      {
        icon: '&#128170;',
        title: 'Passive Investing + Active Coaching',
        description:
          'Low-cost, diversified portfolios paired with behavioral coaching to keep you on track when markets get volatile.',
      },
      {
        icon: '&#128506;',
        title: 'Complete Retirement Roadmap',
        description:
          'Social Security optimization, tax-efficient withdrawals, healthcare planning, and estate coordination — all in one plan.',
      },
    ],
  },

  stats: [
    { value: '200+', label: 'Families Served' },
    { value: '$150M+', label: 'Assets Under Guidance' },
    { value: '0.5%', label: 'Transparent Annual Fee' },
  ],

  testimonials: {
    heading: 'What Our Clients Say',
    items: [
      {
        quote:
          'ArcVest gave us the confidence to retire two years earlier than we thought possible. Their evidence-based approach and transparent fees made all the difference.',
        name: 'Robert & Linda M.',
        title: 'Retired Educators, Clients Since 2022',
      },
      {
        quote:
          "After years of paying hidden fees to our broker, switching to ArcVest's fee-only model saved us thousands annually. We finally feel like our adviser is on our side.",
        name: 'James T.',
        title: 'Retired Engineer, Client Since 2023',
      },
    ],
  },

  leadForm: {
    heading: 'Get Your Free Pre-Retirement Planning Guide',
    subheading:
      'Learn the 5 critical steps to a confident retirement — delivered to your inbox.',
    buttonText: 'Send My Free Guide',
  },

  faqs: {
    heading: 'Frequently Asked Questions',
    items: [
      {
        question: 'What does it mean that ArcVest is a fiduciary?',
        answer:
          'As a fiduciary, ArcVest is legally and ethically obligated to act in your best interest at all times. Unlike brokers who only need to recommend "suitable" investments, we must put your needs ahead of our own. This means no conflicts of interest, no hidden commissions, and full transparency in everything we do.',
      },
      {
        question: 'How does ArcVest charge for its services?',
        answer:
          'We charge a simple, transparent annual fee of 0.50% of assets under management. There are no hidden fees, no commissions, no transaction charges, and no account minimums for our planning services. You always know exactly what you\'re paying and why.',
      },
      {
        question: 'Is there a minimum investment requirement?',
        answer:
          'We work with clients at various stages of their financial journey. While our core wealth management services are designed for portfolios of $500,000 and above, our retirement planning guide and initial consultation are available to anyone exploring their options.',
      },
      {
        question: 'How is ArcVest different from my current financial adviser?',
        answer:
          'Most financial advisers earn commissions from the products they sell you, creating inherent conflicts of interest. ArcVest is fee-only — we never earn commissions. We use evidence-based, passive investment strategies that research shows outperform actively managed funds over time, and we provide comprehensive financial planning, not just investment management.',
      },
      {
        question: "What's included in the free retirement planning guide?",
        answer:
          'The guide covers the 5 critical steps to a confident retirement: (1) calculating your true retirement number, (2) optimizing Social Security timing, (3) creating a tax-efficient withdrawal strategy, (4) planning for healthcare costs, and (5) building a portfolio designed for income and longevity. It\'s a practical, no-nonsense resource with no sales pitch.',
      },
    ],
  },
} as const;
