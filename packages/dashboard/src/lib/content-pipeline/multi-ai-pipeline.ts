/**
 * Multi-AI Content Pipeline (Module 1B)
 *
 * 4-step pipeline: Claude → ChatGPT → Gemini → Claude
 * Transforms any input into a polished, compliant blog post package.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PIPELINE_CONFIG, type PipelineInput, type PipelineOutput } from './config';

export class MultiAIPipeline {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private geminiApiKey: string;

  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
    if (!geminiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.geminiApiKey = geminiKey;
  }

  /**
   * Run the full 4-step pipeline
   */
  async run(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now();
    let totalTokens = 0;

    console.log('[Pipeline] Starting 4-step AI pipeline...');

    // Step 1: Claude - Initial draft + compliance check
    console.log('[Pipeline] Step 1: Claude initial draft...');
    const step1 = await this.step1Claude(input);
    totalTokens += step1.tokens;

    // Step 2: ChatGPT - Improve and tighten
    console.log('[Pipeline] Step 2: ChatGPT improvements...');
    const step2 = await this.step2ChatGPT(step1.draft, step1.compliance, input);
    totalTokens += step2.tokens;

    // Step 3: Gemini - Final review and polish
    console.log('[Pipeline] Step 3: Gemini polish...');
    const step3 = await this.step3Gemini(step2.draft, input);
    totalTokens += step3.tokens;

    // Step 4: Claude - Final package
    console.log('[Pipeline] Step 4: Claude final package...');
    const step4 = await this.step4ClaudeFinal(step3.draft, input);
    totalTokens += step4.tokens;

    const processingTime = Date.now() - startTime;
    console.log(`[Pipeline] Complete in ${processingTime}ms, ${totalTokens} tokens used`);

    return {
      originalInput: input.content,
      claudeDraft: {
        content: step1.draft,
        complianceCheck: step1.compliance,
      },
      chatgptDraft: {
        content: step2.draft,
        improvements: step2.improvements,
      },
      geminiDraft: {
        content: step3.draft,
        edits: step3.edits,
      },
      finalOutput: step4.output,
      metadata: {
        processedAt: new Date().toISOString(),
        totalTokensUsed: totalTokens,
        processingTimeMs: processingTime,
      },
    };
  }

  /**
   * Step 1: Claude - Create initial draft and run compliance check
   */
  private async step1Claude(input: PipelineInput): Promise<{
    draft: string;
    compliance: { passed: boolean; issues: string[]; suggestions: string[] };
    tokens: number;
  }> {
    const topicsOfInterest = PIPELINE_CONFIG.TOPICS_OF_INTEREST.join(', ');
    const topicsToAvoid = PIPELINE_CONFIG.TOPICS_TO_AVOID.join(', ');

    const prompt = `You are writing a blog post for ArcVest, a fee-only fiduciary financial planning firm.

SOURCE CONTENT:
${input.content}

${input.focusAngle ? `FOCUS ANGLE: ${input.focusAngle}` : ''}
${input.targetKeywords?.length ? `TARGET KEYWORDS: ${input.targetKeywords.join(', ')}` : ''}

TOPICS WE FOCUS ON: ${topicsOfInterest}
TOPICS TO AVOID: ${topicsToAvoid}

${PIPELINE_CONFIG.BRAND_VOICE}

TASK:
1. Write a blog post (${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words) based on the source content
2. Write in ArcVest's professional but approachable voice
3. Make it educational and valuable for our target audience
4. Include appropriate disclaimers where needed
5. Do NOT make specific stock recommendations or guarantee returns

Write the blog post in markdown format with a compelling title (H1), clear sections (H2), and engaging content.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const draft = response.content.find(c => c.type === 'text')?.text || '';
    const draftTokens = response.usage.input_tokens + response.usage.output_tokens;

    // Run compliance check
    const compliancePrompt = `Review this financial services blog post for SEC Marketing Rule compliance:

${draft}

Check for:
1. Performance guarantees or promises of specific returns
2. Misleading statements about risk
3. Unsubstantiated claims
4. Missing required disclosures
5. Superlatives without substantiation ("best," "top," "leading")
6. Cherry-picked performance data
7. Predictions presented as facts
8. Specific stock recommendations

Respond in JSON format only:
{"passed": true/false, "issues": ["issue1", "issue2"], "suggestions": ["fix1", "fix2"]}`;

    const complianceResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: 'user', content: compliancePrompt }],
    });

    const complianceText = complianceResponse.content.find(c => c.type === 'text')?.text || '';
    const complianceTokens = complianceResponse.usage.input_tokens + complianceResponse.usage.output_tokens;

    let compliance = { passed: false, issues: ['Unable to parse'], suggestions: [] };
    try {
      const jsonMatch = complianceText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        compliance = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Keep default
    }

    return {
      draft,
      compliance,
      tokens: draftTokens + complianceTokens,
    };
  }

  /**
   * Step 2: ChatGPT - Improve and tighten the draft
   */
  private async step2ChatGPT(
    draft: string,
    compliance: { passed: boolean; issues: string[]; suggestions: string[] },
    input: PipelineInput
  ): Promise<{ draft: string; improvements: string[]; tokens: number }> {
    const prompt = `You are an expert editor improving a financial planning blog post.

CURRENT DRAFT:
${draft}

COMPLIANCE ISSUES TO FIX:
${compliance.issues.length > 0 ? compliance.issues.map(i => `- ${i}`).join('\n') : 'None identified'}

COMPLIANCE SUGGESTIONS:
${compliance.suggestions.length > 0 ? compliance.suggestions.map(s => `- ${s}`).join('\n') : 'None'}

ORIGINAL SOURCE (for context):
${input.content.substring(0, 1000)}...

YOUR TASK:
1. Fix any compliance issues identified above
2. Tighten the writing - remove fluff and redundancy
3. Improve clarity and readability
4. Ensure the tone is professional but approachable
5. Make sure it provides genuine value to readers
6. Keep it between ${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words

Provide your improved version in markdown format.

After the blog post, add a section titled "## IMPROVEMENTS MADE" with a bullet list of what you changed.`;

    // Using GPT-5.2 with Responses API (not Chat Completions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.openai.responses as any).create({
      model: 'gpt-5.2',
      input: prompt,
      reasoning: {
        effort: 'medium',
      },
      text: {
        verbosity: 'medium',
      },
    });

    const fullResponse = response.output_text || draft;
    const tokens = response.usage?.total_tokens || 0;

    // Parse out improvements list
    const parts = fullResponse.split('## IMPROVEMENTS MADE');
    const improvedDraft = parts[0].trim();
    const improvements: string[] = [];

    if (parts[1]) {
      const improvementLines = parts[1].split('\n').filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('*'));
      improvements.push(...improvementLines.map((line: string) => line.replace(/^[-*]\s*/, '').trim()));
    }

    return {
      draft: improvedDraft,
      improvements,
      tokens,
    };
  }

  /**
   * Step 3: Gemini - Final review and polish
   */
  private async step3Gemini(
    draft: string,
    input: PipelineInput
  ): Promise<{ draft: string; edits: string[]; tokens: number }> {
    const prompt = `You are a senior editor doing a final review of a financial planning blog post.

CURRENT DRAFT:
${draft}

YOUR TASK:
1. Polish the writing for maximum clarity and impact
2. Ensure smooth transitions between sections
3. Verify the opening hook is compelling
4. Check that the conclusion has a clear takeaway
5. Ensure regulatory compliance language is present but not overwhelming
6. Make any final improvements to make this publication-ready

Provide your polished version in markdown format.

After the blog post, add a section titled "## EDITS MADE" with a bullet list of your changes.`;

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      // Return original draft if Gemini fails
      return { draft, edits: ['Gemini review skipped due to API error'], tokens: 0 };
    }

    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || draft;
    const tokens = data.usageMetadata?.totalTokenCount || 0;

    // Parse out edits list
    const parts = fullResponse.split('## EDITS MADE');
    const polishedDraft = parts[0].trim();
    const edits: string[] = [];

    if (parts[1]) {
      const editLines = parts[1].split('\n').filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('*'));
      edits.push(...editLines.map((line: string) => line.replace(/^[-*]\s*/, '').trim()));
    }

    return {
      draft: polishedDraft,
      edits,
      tokens,
    };
  }

  /**
   * Step 4: Claude - Create final WordPress-ready package
   */
  private async step4ClaudeFinal(
    draft: string,
    input: PipelineInput
  ): Promise<{
    output: {
      wordpressPost: string;
      excerpt: string;
      seoTags: string[];
      illustrationPrompt: string;
    };
    tokens: number;
  }> {
    const prompt = `You are preparing a blog post for WordPress publication.

FINAL DRAFT:
${draft}

${input.targetKeywords?.length ? `TARGET KEYWORDS: ${input.targetKeywords.join(', ')}` : ''}

Create the following outputs. Respond in JSON format:

{
  "wordpressPost": "The full blog post in HTML format suitable for WordPress (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags)",
  "excerpt": "A compelling excerpt of 50 words or less that summarizes the post and encourages reading",
  "seoTags": ["tag1", "tag2", ...up to 14 relevant SEO tags],
  "illustrationPrompt": "A detailed prompt for generating an illustration that would complement this blog post. Describe the style, mood, and specific visual elements that would work well."
}

REQUIREMENTS:
- WordPress post should be clean HTML, ready to paste
- Excerpt must be 50 words or fewer
- Provide up to 14 SEO tags (single words or short phrases)
- Illustration prompt should be detailed enough for AI image generation`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 8192,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content.find(c => c.type === 'text')?.text || '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    // Parse JSON response
    let output = {
      wordpressPost: draft,
      excerpt: '',
      seoTags: [] as string[],
      illustrationPrompt: '',
    };

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        output = {
          wordpressPost: parsed.wordpressPost || draft,
          excerpt: parsed.excerpt || '',
          seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags.slice(0, 14) : [],
          illustrationPrompt: parsed.illustrationPrompt || '',
        };
      }
    } catch (e) {
      console.error('Failed to parse Step 4 JSON:', e);
    }

    return { output, tokens };
  }
}

// Export singleton factory
let pipelineInstance: MultiAIPipeline | null = null;

export function getMultiAIPipeline(): MultiAIPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new MultiAIPipeline();
  }
  return pipelineInstance;
}
