/**
 * Content Pipeline Configuration
 *
 * Easy to modify settings for the multi-AI content pipeline.
 * Update these lists to customize content generation.
 */

import type { ContentCategory } from '@arcvest/shared';

export const PIPELINE_CONFIG = {
  // Topics the pipeline should focus on (across all 4 content categories)
  TOPICS_OF_INTEREST: [
    // Market Commentary
    'market news',
    'market commentary',
    'asset class returns',
    'quarterly performance',
    'annual performance',
    'earnings reports',
    'sector rotation',
    'crypto markets',
    'commodities',
    'gold',
    'bond yields',
    'interest rates',
    // Macro & Capital Flows
    'capital flows',
    'ETF flows',
    'passive fund flows',
    'institutional positioning',
    // Real Economy
    'AI investments',
    'job market',
    'GDP',
    'corporate profits',
    'economic outlook',
    'consumer spending',
    // Investor Strategies
    'retirement planning',
    'retirement income strategies',
    'Social Security updates',
    'Medicare changes',
    'tax law changes',
    'tax strategies',
    'estate planning',
    'investment strategy',
    'portfolio management',
    'financial planning',
    'wealth management',
    'RIA industry',
    'Roth conversion',
  ],

  // Topics to avoid
  TOPICS_TO_AVOID: [
    'individual stock recommendations',
    'buy/sell recommendations for individual stocks',
    'crypto recommendations',
    'get rich quick schemes',
    'market timing predictions',
    'guaranteed returns',
    'meme stocks',
    'day trading',
    'options trading',
    'penny stocks',
  ],

  // ArcVest brand voice guidelines
  BRAND_VOICE: `
ArcVest is a fee-only fiduciary registered investment adviser (RIA).

BRAND VOICE:
- Professional but approachable
- Educational and helpful
- Trustworthy and transparent
- Client-focused, not sales-focused

TARGET AUDIENCE:
- Individuals and families planning for retirement
- Business owners seeking exit planning
- High-net-worth individuals needing comprehensive planning
- People seeking objective, unbiased financial advice

COMPLIANCE REQUIREMENTS:
- Never guarantee investment returns or outcomes
- Avoid predictions about specific market performance
- Do not use superlatives like "best," "top," or "leading" without substantiation
- Always maintain a balanced perspective on risks and benefits
- Do not provide specific investment recommendations (stock picks)
- Focus on education rather than promotion
- Include appropriate disclaimers when discussing performance
- Remember: past performance does not guarantee future results
`,

  // Output requirements
  OUTPUT_REQUIREMENTS: {
    excerpt_max_words: 50,
    max_seo_tags: 14,
    target_word_count: { min: 800, max: 1500 },
  },
};

export type PipelineInput = {
  // The source content - either a news article or a topic prompt
  content: string;
  // Optional: type of input
  inputType?: 'news_article' | 'topic_prompt' | 'raw_text';
  // Optional: specific focus or angle
  focusAngle?: string;
  // Optional: target keywords for SEO
  targetKeywords?: string[];
  // Optional: content category for tone/voice control
  contentCategory?: ContentCategory;
};

export type PipelineOutput = {
  // Original input
  originalInput: string;

  // Step 1: Claude initial draft
  claudeDraft: {
    content: string;
    complianceCheck: {
      passed: boolean;
      issues: string[];
      suggestions: string[];
    };
  };

  // Step 2: ChatGPT improved draft
  chatgptDraft: {
    content: string;
    improvements: string[];
  };

  // Step 3: Gemini polished draft
  geminiDraft: {
    content: string;
    edits: string[];
  };

  // Step 4: Final Claude output
  finalOutput: {
    wordpressPost: string;
    excerpt: string;
    seoTags: string[];
    illustrationPrompt: string;
  };

  // Metadata
  metadata: {
    processedAt: string;
    totalTokensUsed: number;
    processingTimeMs: number;
  };
};
