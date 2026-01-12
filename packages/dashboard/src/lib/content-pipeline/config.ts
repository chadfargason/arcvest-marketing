/**
 * Content Pipeline Configuration
 *
 * Easy to modify settings for the multi-AI content pipeline.
 * Update these lists to customize content generation.
 */

export const PIPELINE_CONFIG = {
  // Topics the pipeline should focus on
  TOPICS_OF_INTEREST: [
    'market news',
    'market commentary',
    'asset class returns',
    'quarterly performance',
    'annual performance',
    'retirement planning',
    'retirement income strategies',
    'Social Security updates',
    'Medicare changes',
    'tax law changes',
    'estate planning',
    'investment strategy',
    'portfolio management',
    'financial planning',
    'wealth management',
  ],

  // Topics to avoid
  TOPICS_TO_AVOID: [
    'specific stock picks',
    'buy/sell recommendations for individual stocks',
    'crypto recommendations',
    'get rich quick schemes',
    'market timing predictions',
    'guaranteed returns',
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
