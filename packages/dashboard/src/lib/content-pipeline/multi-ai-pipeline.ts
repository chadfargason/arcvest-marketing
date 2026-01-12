/**
 * Multi-AI Content Pipeline (Module 1B)
 *
 * 4-step pipeline: Claude → ChatGPT → Gemini → Claude
 * Transforms any input into a polished, compliant blog post package.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PIPELINE_CONFIG, type PipelineInput, type PipelineOutput } from './config';
import { ARCVEST_KNOWLEDGE, ARCVEST_KNOWLEDGE_CONDENSED } from '../arcvest-knowledge';

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

    const prompt = `You are writing a blog post for ArcVest. Study this knowledge base carefully and write in the ArcVest voice:

${ARCVEST_KNOWLEDGE}

---

SOURCE CONTENT TO WRITE ABOUT:
${input.content}

${input.focusAngle ? `FOCUS ANGLE: ${input.focusAngle}` : ''}
${input.targetKeywords?.length ? `TARGET KEYWORDS: ${input.targetKeywords.join(', ')}` : ''}

ADDITIONAL TOPICS WE COVER: ${topicsOfInterest}
TOPICS TO AVOID: ${topicsToAvoid}

TASK:
1. Write a blog post (${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words) based on the source content
2. Write in ArcVest's voice: authoritative but accessible, evidence-based, honest and direct
3. Lead with the insight, use specific numbers, use our frameworks where relevant
4. Make it educational and valuable for high-net-worth individuals considering evidence-based investing
5. Include appropriate disclaimers naturally (don't lead with them)
6. Do NOT make specific stock recommendations or guarantee returns
7. Use "we" when speaking as ArcVest
8. No exclamation points, no hedge words like "might" or "perhaps"

Write the blog post in markdown format with a compelling title (H1), clear sections (H2), and engaging prose-forward content.`;

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
    _input: PipelineInput
  ): Promise<{ draft: string; improvements: string[]; tokens: number }> {
    const prompt = `You are an expert editor improving a blog post for ArcVest. Maintain their voice throughout your edits:

${ARCVEST_KNOWLEDGE_CONDENSED}

---

CURRENT DRAFT:
${draft}

COMPLIANCE ISSUES TO FIX:
${compliance.issues.length > 0 ? compliance.issues.map(i => `- ${i}`).join('\n') : 'None identified'}

COMPLIANCE SUGGESTIONS:
${compliance.suggestions.length > 0 ? compliance.suggestions.map(s => `- ${s}`).join('\n') : 'None'}

YOUR TASK:
1. Fix any compliance issues identified above
2. Tighten the writing - remove fluff and redundancy
3. MAINTAIN the ArcVest voice: authoritative, evidence-based, direct, no hedge words
4. Ensure it provides genuine value to high-net-worth readers
5. Keep it between ${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words
6. No exclamation points, use "we" for ArcVest, lead with insights

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
    _input: PipelineInput
  ): Promise<{ draft: string; edits: string[]; tokens: number }> {
    const prompt = `You are a senior editor doing a final review of a blog post for ArcVest. Preserve their distinctive voice:

${ARCVEST_KNOWLEDGE_CONDENSED}

---

CURRENT DRAFT:
${draft}

YOUR TASK:
1. Polish the writing for maximum clarity and impact
2. Ensure smooth transitions between sections
3. Verify the opening hook leads with the insight (not background)
4. Check that the conclusion has a clear takeaway
5. Ensure regulatory compliance language is present but not overwhelming
6. PRESERVE the ArcVest voice: authoritative, direct, evidence-based
7. No exclamation points, no hedge words, use "we" for ArcVest
8. Make any final improvements to make this publication-ready

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
   * Uses separate calls for reliability instead of one big JSON
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
    let totalTokens = 0;

    // Step 4a: Convert Markdown to WordPress HTML
    const htmlPrompt = `Convert this blog post from Markdown to clean WordPress HTML.

MARKDOWN CONTENT:
${draft}

REQUIREMENTS:
- Convert all Markdown to proper HTML tags
- Use <h2> for ## headings, <h3> for ### headings
- Use <p> for paragraphs
- Use <ul><li> for bullet lists, <ol><li> for numbered lists
- Use <strong> for **bold** and <em> for *italic*
- Use <hr> for --- horizontal rules
- Use <blockquote> for quotes
- Remove any Markdown syntax completely
- Output ONLY the HTML, no explanation or wrapper

OUTPUT THE HTML ONLY:`;

    const htmlResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 8192,
      temperature: 0.3,
      messages: [{ role: 'user', content: htmlPrompt }],
    });

    const wordpressPost = htmlResponse.content.find(c => c.type === 'text')?.text || draft;
    totalTokens += htmlResponse.usage.input_tokens + htmlResponse.usage.output_tokens;

    // Step 4b: Generate excerpt
    const excerptPrompt = `Write a compelling excerpt (50 words or fewer) for this blog post that summarizes it and encourages reading:

${draft.substring(0, 2000)}

OUTPUT ONLY THE EXCERPT TEXT (no quotes, no labels):`;

    const excerptResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 100,
      temperature: 0.5,
      messages: [{ role: 'user', content: excerptPrompt }],
    });

    const excerpt = excerptResponse.content.find(c => c.type === 'text')?.text?.trim() || '';
    totalTokens += excerptResponse.usage.input_tokens + excerptResponse.usage.output_tokens;

    // Step 4c: Generate SEO tags
    const tagsPrompt = `Generate up to 14 SEO tags for this blog post. Output as comma-separated values only:

${draft.substring(0, 1500)}

${input.targetKeywords?.length ? `Include these keywords: ${input.targetKeywords.join(', ')}` : ''}

OUTPUT ONLY COMMA-SEPARATED TAGS:`;

    const tagsResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 200,
      temperature: 0.3,
      messages: [{ role: 'user', content: tagsPrompt }],
    });

    const tagsText = tagsResponse.content.find(c => c.type === 'text')?.text || '';
    const seoTags = tagsText.split(',').map(t => t.trim()).filter(Boolean).slice(0, 14);
    totalTokens += tagsResponse.usage.input_tokens + tagsResponse.usage.output_tokens;

    // Step 4d: Generate illustration prompt
    const illustrationPrompt = `Create a detailed AI image generation prompt for an illustration to accompany this blog post:

${draft.substring(0, 1500)}

Describe the style, mood, colors, and specific visual elements. Output only the prompt:`;

    const illustrationResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 300,
      temperature: 0.7,
      messages: [{ role: 'user', content: illustrationPrompt }],
    });

    const illustrationText = illustrationResponse.content.find(c => c.type === 'text')?.text?.trim() || '';
    totalTokens += illustrationResponse.usage.input_tokens + illustrationResponse.usage.output_tokens;

    return {
      output: {
        wordpressPost,
        excerpt,
        seoTags,
        illustrationPrompt: illustrationText,
      },
      tokens: totalTokens,
    };
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
