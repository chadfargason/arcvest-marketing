/**
 * Multi-AI Content Pipeline (Module 1B)
 *
 * 4-step pipeline: Claude → ChatGPT → Gemini → Claude
 * Transforms any input into a polished, compliant blog post package.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PIPELINE_CONFIG, type PipelineInput, type PipelineOutput } from './config';
import { ARCVEST_KNOWLEDGE, ARCVEST_KNOWLEDGE_CONDENSED, WRITING_GUIDANCE, WRITING_GUIDANCE_CONDENSED } from '../arcvest-knowledge';

/**
 * Pipeline checkpoint data - stores intermediate results
 */
export interface PipelineCheckpoint {
  step1_claude?: {
    draft: string;
    compliance: { passed: boolean; issues: string[]; suggestions: string[] };
    tokens: number;
  };
  step2_chatgpt?: {
    draft: string;
    improvements: string[];
    tokens: number;
  };
  step3_gemini?: {
    draft: string;
    edits: string[];
    tokens: number;
  };
  step4a_html?: {
    wordpressPost: string;
    tokens: number;
  };
  step4b_excerpt?: {
    excerpt: string;
    tokens: number;
  };
  step4c_tags?: {
    seoTags: string[];
    tokens: number;
  };
  step4d_illustration?: {
    illustrationPrompt: string;
    tokens: number;
  };
  completed?: boolean;
}

export type PipelineStep =
  | 'step1_claude'
  | 'step2_chatgpt'
  | 'step3_gemini'
  | 'step4a_html'
  | 'step4b_excerpt'
  | 'step4c_tags'
  | 'step4d_illustration'
  | 'completed';

/**
 * Callback to save checkpoint after each step
 */
export type CheckpointCallback = (step: PipelineStep, data: PipelineCheckpoint) => Promise<void>;

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
   * Run the pipeline with checkpointing support
   * Can resume from a previous checkpoint if provided
   */
  async runWithCheckpoints(
    input: PipelineInput,
    existingCheckpoint: PipelineCheckpoint = {},
    onCheckpoint: CheckpointCallback
  ): Promise<PipelineOutput> {
    const startTime = Date.now();
    let totalTokens = 0;
    const checkpoint: PipelineCheckpoint = { ...existingCheckpoint };

    console.log('[Pipeline] Starting 4-step AI pipeline with checkpointing...');
    if (Object.keys(existingCheckpoint).length > 0) {
      console.log('[Pipeline] Resuming from checkpoint:', Object.keys(existingCheckpoint).filter(k => k !== 'completed'));
    }

    // Step 1: Claude - Initial draft + compliance check
    let step1 = checkpoint.step1_claude;
    if (!step1) {
      console.log('[Pipeline] Step 1: Claude initial draft...');
      step1 = await this.step1Claude(input);
      checkpoint.step1_claude = step1;
      await onCheckpoint('step1_claude', checkpoint);
      console.log('[Pipeline] Step 1 checkpointed');
    } else {
      console.log('[Pipeline] Step 1: Using cached result');
    }
    totalTokens += step1.tokens;

    // Step 2: ChatGPT - Improve and tighten
    let step2 = checkpoint.step2_chatgpt;
    if (!step2) {
      console.log('[Pipeline] Step 2: ChatGPT improvements...');
      step2 = await this.step2ChatGPT(step1.draft, step1.compliance, input);
      checkpoint.step2_chatgpt = step2;
      await onCheckpoint('step2_chatgpt', checkpoint);
      console.log('[Pipeline] Step 2 checkpointed');
    } else {
      console.log('[Pipeline] Step 2: Using cached result');
    }
    totalTokens += step2.tokens;

    // Step 3: Gemini - Final review and polish
    let step3 = checkpoint.step3_gemini;
    if (!step3) {
      console.log('[Pipeline] Step 3: Gemini polish...');
      step3 = await this.step3Gemini(step2.draft, input);
      checkpoint.step3_gemini = step3;
      await onCheckpoint('step3_gemini', checkpoint);
      console.log('[Pipeline] Step 3 checkpointed');
    } else {
      console.log('[Pipeline] Step 3: Using cached result');
    }
    totalTokens += step3.tokens;

    // Step 4a: Convert to WordPress HTML
    let step4a = checkpoint.step4a_html;
    if (!step4a) {
      console.log('[Pipeline] Step 4a: WordPress HTML conversion...');
      step4a = await this.step4aWordPressHtml(step3.draft);
      checkpoint.step4a_html = step4a;
      await onCheckpoint('step4a_html', checkpoint);
      console.log('[Pipeline] Step 4a checkpointed');
    } else {
      console.log('[Pipeline] Step 4a: Using cached result');
    }
    totalTokens += step4a.tokens;

    // Step 4b: Generate excerpt
    let step4b = checkpoint.step4b_excerpt;
    if (!step4b) {
      console.log('[Pipeline] Step 4b: Generating excerpt...');
      step4b = await this.step4bExcerpt(step3.draft);
      checkpoint.step4b_excerpt = step4b;
      await onCheckpoint('step4b_excerpt', checkpoint);
      console.log('[Pipeline] Step 4b checkpointed');
    } else {
      console.log('[Pipeline] Step 4b: Using cached result');
    }
    totalTokens += step4b.tokens;

    // Step 4c: Generate SEO tags
    let step4c = checkpoint.step4c_tags;
    if (!step4c) {
      console.log('[Pipeline] Step 4c: Generating SEO tags...');
      step4c = await this.step4cSeoTags(step3.draft, input);
      checkpoint.step4c_tags = step4c;
      await onCheckpoint('step4c_tags', checkpoint);
      console.log('[Pipeline] Step 4c checkpointed');
    } else {
      console.log('[Pipeline] Step 4c: Using cached result');
    }
    totalTokens += step4c.tokens;

    // Step 4d: Generate illustration prompt
    let step4d = checkpoint.step4d_illustration;
    if (!step4d) {
      console.log('[Pipeline] Step 4d: Generating illustration prompt...');
      step4d = await this.step4dIllustration(step3.draft);
      checkpoint.step4d_illustration = step4d;
      await onCheckpoint('step4d_illustration', checkpoint);
      console.log('[Pipeline] Step 4d checkpointed');
    } else {
      console.log('[Pipeline] Step 4d: Using cached result');
    }
    totalTokens += step4d.tokens;

    // Mark as completed
    checkpoint.completed = true;
    await onCheckpoint('completed', checkpoint);

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
      finalOutput: {
        wordpressPost: step4a.wordpressPost,
        excerpt: step4b.excerpt,
        seoTags: step4c.seoTags,
        illustrationPrompt: step4d.illustrationPrompt,
      },
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

    const prompt = `You are writing a blog post for ArcVest. Study the brand knowledge base AND the writing guidance carefully.

## BRAND KNOWLEDGE BASE

${ARCVEST_KNOWLEDGE}

---

## WRITING GUIDANCE - READ THIS CAREFULLY

${WRITING_GUIDANCE}

---

## YOUR TASK

SOURCE CONTENT TO WRITE ABOUT:
${input.content}

${input.focusAngle ? `FOCUS ANGLE: ${input.focusAngle}` : ''}
${input.targetKeywords?.length ? `TARGET KEYWORDS: ${input.targetKeywords.join(', ')}` : ''}

ADDITIONAL TOPICS WE COVER: ${topicsOfInterest}
TOPICS TO AVOID: ${topicsToAvoid}

INSTRUCTIONS:
1. Write a blog post (${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words) based on the source content
2. Write in ArcVest's voice: authoritative but accessible, evidence-based, honest and direct
3. Lead with the insight, use specific numbers, use our frameworks where relevant
4. Make it educational and valuable for high-net-worth individuals considering evidence-based investing
5. Include appropriate disclaimers naturally (don't lead with them)
6. Do NOT make specific stock recommendations or guarantee returns
7. Use "we" when speaking as ArcVest
8. CRITICAL: Follow the writing guidance - avoid ALL anti-slop patterns, write short sentences, cut extra words
9. First sentence must grab the reader - rewrite it until it's compelling
10. No exclamation points, no hedge words, no corporate verbs, no thesaurus abuse

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
    const prompt = `You are an expert editor improving a blog post for ArcVest. Maintain their voice and eliminate AI-sounding patterns.

## BRAND VOICE
${ARCVEST_KNOWLEDGE_CONDENSED}

## WRITING QUALITY CHECKLIST - USE THIS TO EDIT
${WRITING_GUIDANCE_CONDENSED}

---

CURRENT DRAFT:
${draft}

COMPLIANCE ISSUES TO FIX:
${compliance.issues.length > 0 ? compliance.issues.map(i => `- ${i}`).join('\n') : 'None identified'}

COMPLIANCE SUGGESTIONS:
${compliance.suggestions.length > 0 ? compliance.suggestions.map(s => `- ${s}`).join('\n') : 'None'}

YOUR TASK:
1. Fix any compliance issues identified above
2. AGGRESSIVELY eliminate anti-slop patterns from the checklist above
3. Tighten the writing - remove fluff, redundancy, and extra words
4. MAINTAIN the ArcVest voice: authoritative, evidence-based, direct
5. Ensure it provides genuine value to high-net-worth readers
6. Keep it between ${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.min}-${PIPELINE_CONFIG.OUTPUT_REQUIREMENTS.target_word_count.max} words
7. No exclamation points, no hedge words, no corporate verbs, no thesaurus abuse
8. Every sentence should pass the "read it out loud" test

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
    const prompt = `You are a senior editor doing a final review of a blog post for ArcVest. Your job is to catch and eliminate any remaining AI-sounding patterns.

## BRAND VOICE
${ARCVEST_KNOWLEDGE_CONDENSED}

## FINAL QUALITY CHECK - ELIMINATE THESE PATTERNS
${WRITING_GUIDANCE_CONDENSED}

---

CURRENT DRAFT:
${draft}

YOUR TASK:
1. Do a FINAL PASS to catch any remaining anti-slop patterns from the checklist above
2. Polish the writing for maximum clarity and impact
3. Ensure smooth transitions between sections
4. Verify the opening hook leads with the insight (not background)
5. Check that the conclusion has a clear takeaway
6. Ensure regulatory compliance language is present but not overwhelming
7. PRESERVE the ArcVest voice: authoritative, direct, evidence-based
8. No exclamation points, no hedge words, no corporate verbs
9. READ EACH SENTENCE OUT LOUD - if it sounds generic, rewrite it
10. Make this publication-ready

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

  /**
   * Step 4a: Convert Markdown to WordPress HTML (checkpointable)
   */
  private async step4aWordPressHtml(draft: string): Promise<{ wordpressPost: string; tokens: number }> {
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

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 8192,
      temperature: 0.3,
      messages: [{ role: 'user', content: htmlPrompt }],
    });

    const wordpressPost = response.content.find(c => c.type === 'text')?.text || draft;
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { wordpressPost, tokens };
  }

  /**
   * Step 4b: Generate excerpt (checkpointable)
   */
  private async step4bExcerpt(draft: string): Promise<{ excerpt: string; tokens: number }> {
    const excerptPrompt = `Write a compelling excerpt (50 words or fewer) for this blog post that summarizes it and encourages reading:

${draft.substring(0, 2000)}

OUTPUT ONLY THE EXCERPT TEXT (no quotes, no labels):`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 100,
      temperature: 0.5,
      messages: [{ role: 'user', content: excerptPrompt }],
    });

    const excerpt = response.content.find(c => c.type === 'text')?.text?.trim() || '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { excerpt, tokens };
  }

  /**
   * Step 4c: Generate SEO tags (checkpointable)
   */
  private async step4cSeoTags(draft: string, input: PipelineInput): Promise<{ seoTags: string[]; tokens: number }> {
    const tagsPrompt = `Generate up to 14 SEO tags for this blog post. Output as comma-separated values only:

${draft.substring(0, 1500)}

${input.targetKeywords?.length ? `Include these keywords: ${input.targetKeywords.join(', ')}` : ''}

OUTPUT ONLY COMMA-SEPARATED TAGS:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 200,
      temperature: 0.3,
      messages: [{ role: 'user', content: tagsPrompt }],
    });

    const tagsText = response.content.find(c => c.type === 'text')?.text || '';
    const seoTags = tagsText.split(',').map(t => t.trim()).filter(Boolean).slice(0, 14);
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { seoTags, tokens };
  }

  /**
   * Step 4d: Generate illustration prompt (checkpointable)
   */
  private async step4dIllustration(draft: string): Promise<{ illustrationPrompt: string; tokens: number }> {
    const prompt = `Create a detailed AI image generation prompt for an illustration to accompany this blog post:

${draft.substring(0, 1500)}

Describe the style, mood, colors, and specific visual elements. Output only the prompt:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 300,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const illustrationPrompt = response.content.find(c => c.type === 'text')?.text?.trim() || '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { illustrationPrompt, tokens };
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
