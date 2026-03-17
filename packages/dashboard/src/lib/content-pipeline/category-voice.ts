/**
 * Content Category Voice Definitions
 *
 * Per-category tone guidance, framing rules, and example angles.
 * Only "investor_strategies" gets the full ArcVest philosophy injection.
 */

import type { ContentCategory } from '@arcvest/shared';

export interface CategoryVoice {
  category: ContentCategory;
  label: string;
  tone: string;
  instructions: string;
  exampleAngles: string[];
}

export const CATEGORY_VOICES: Record<ContentCategory, CategoryVoice> = {
  market_commentary: {
    category: 'market_commentary',
    label: 'Market Commentary',
    tone: 'Conversational, observational, curious',
    instructions: `This is a Market Commentary article. Your tone should be conversational and observational — "here's what caught our eye."

TONE RULES:
- Write like a sharp market observer sharing notes, not a preacher
- Be curious about what's happening, not prescriptive about what readers should do
- You CAN discuss individual stocks, sectors, crypto, commodities, and currencies as market commentary — NOT as recommendations
- Focus on what happened, why it matters, and what it signals
- No "and that's why you should index" conclusions — let the reader draw their own conclusions
- Avoid moralizing about investor behavior
- Use concrete market data: prices, percentages, volume, flows

FRAMING:
- "Here's what moved this week and why it matters"
- Observe patterns without prescribing action
- Connect dots between seemingly unrelated market events
- It's fine to express surprise, skepticism, or fascination`,
    exampleAngles: [
      'Why the Nasdaq just had its best week in 3 months',
      'Gold crossed $3,000 — what the metals market is pricing in',
      'The quiet sector rotation nobody is talking about',
      'Bitcoin and the S&P 500 are diverging again',
    ],
  },

  macro_capital_flows: {
    category: 'macro_capital_flows',
    label: 'Macro & Capital Flows',
    tone: 'Analytical, data-heavy, institutional',
    instructions: `This is a Macro & Capital Flows article. Your tone should be analytical and data-forward — like something you'd read in Bloomberg or the FT.

TONE RULES:
- Lead with data, not opinions
- Write for a reader who understands markets — don't over-explain basic concepts
- Reference passive fund flows, index reconstitutions, and institutional positioning as market phenomena
- Be precise with numbers: basis points, AUM figures, flow data
- Maintain an institutional perspective — you're reporting on the plumbing of markets
- No cheerleading for any approach — just observe what's happening structurally

FRAMING:
- "The data shows..." / "Flows indicate..." / "Positioning suggests..."
- Cite sources: ICI data, Fed reports, exchange filings
- Connect capital flows to market impact
- Discuss structural market dynamics (passive vs. active, index effects, liquidity)`,
    exampleAngles: [
      'Index funds now own 30% of the S&P 500 — what that means for price discovery',
      'Where institutional money moved in Q1',
      'The passive flow tsunami: $500B in 12 months',
      'Bond fund outflows hit a 2-year high',
    ],
  },

  real_economy: {
    category: 'real_economy',
    label: 'Real Economy',
    tone: 'Forward-looking, grounded, practical implications',
    instructions: `This is a Real Economy article. Your tone should be grounded and forward-looking — connecting economic data to real-world investor implications.

TONE RULES:
- Start with the economic data or trend, then explain what it means for investors
- Be practical — what does this GDP print or jobs report actually imply?
- You CAN discuss AI investments, corporate capex, trade policy, and industry shifts
- Connect macro data to household-level impact
- Avoid pure academic analysis — always bring it back to "so what?"
- Be honest about uncertainty in economic forecasting

FRAMING:
- "Here's what this data point means for your portfolio"
- Connect economic indicators to investment implications
- Discuss how real-world trends (AI spending, reshoring, demographics) create investment dynamics
- Bridge the gap between economic headlines and investor action`,
    exampleAngles: [
      'AI capex just hit $200B — who benefits beyond the obvious names',
      'The jobs report was strong, but here is what it missed',
      'Corporate profit margins are at record highs — can it last?',
      'What the housing data is telling us about the consumer',
    ],
  },

  investor_strategies: {
    category: 'investor_strategies',
    label: 'Investor Strategies',
    tone: 'Educational, detailed, practical — classic ArcVest voice',
    instructions: `This is an Investor Strategies article. Use the full ArcVest voice with all frameworks and philosophy.

TONE RULES:
- This is where you deploy the Fee Extraction Machine framework, "buying the haystack," and the full evidence-based investing case
- Be educational and detailed — walk readers through the logic
- Use specific numbers and cite academic research
- Take strong positions backed by evidence
- Address common misconceptions directly
- Make the case for evidence-based investing with conviction

FRAMING:
- Bring the full ArcVest philosophy to bear
- Use frameworks: Fee Extraction Machine, behavior gap, buying the haystack
- Reference Morningstar data, SPIVA reports, Vanguard research
- Address the "Missing Middle" audience directly
- End with clear, actionable takeaways`,
    exampleAngles: [
      'The Roth conversion window is closing — here is what to do',
      "Why your advisor's \"alternatives\" allocation is costing you",
      'The 2% you never notice: a real cost breakdown of wirehouse fees',
      'New RMD rules for 2026: what changed and who is affected',
    ],
  },
};

/**
 * Get the voice definition for a content category
 */
export function getCategoryVoice(category: ContentCategory): CategoryVoice {
  return CATEGORY_VOICES[category];
}

/**
 * Get a condensed tone instruction for editing passes (steps 2-3)
 */
export function getCategoryToneInstruction(category: ContentCategory): string {
  const voice = CATEGORY_VOICES[category];
  return `This is a ${voice.label} article. Tone: ${voice.tone}. Maintain this tone throughout — do not shift toward a different category's voice.`;
}
