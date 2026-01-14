/**
 * RSA Generation Pipeline
 *
 * 4-AI pipeline for master RSA ads: Claude → ChatGPT → Gemini → Claude
 * Single Claude call for generating variations from masters.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import {
  type AudiencePersona,
  getPersonaById,
} from './personas';
import {
  type VoiceProfile,
  getVoiceById,
} from './voice-system';
import {
  ARCVEST_AD_KNOWLEDGE,
  RSA_SPECS,
  checkCompliance,
  checkHeadlineLength,
  checkDescriptionLength,
  validateRSA,
  type ComplianceCheckResult,
} from './ad-knowledge';

// ============================================
// TYPES
// ============================================

export interface RSAAsset {
  headlines: Array<{
    text: string;
    type: 'brand' | 'service' | 'benefit' | 'cta' | 'differentiator' | 'keyword' | 'question';
    pinPosition?: 1 | 2 | 3;
  }>;
  descriptions: Array<{
    text: string;
    pinPosition?: 1 | 2;
  }>;
}

export interface RSAGenerationResult {
  master: RSAAsset;
  variations: RSAAsset[];
  complianceResult: ComplianceCheckResult;
  metadata: {
    personaId: string;
    voiceId: string;
    processedAt: string;
    totalTokensUsed: number;
    processingTimeMs: number;
  };
}

interface PipelineStep1Result {
  draft: RSAAsset;
  compliance: ComplianceCheckResult;
  tokens: number;
}

interface PipelineStep2Result {
  draft: RSAAsset;
  improvements: string[];
  tokens: number;
}

interface PipelineStep3Result {
  draft: RSAAsset;
  edits: string[];
  tokens: number;
}

interface PipelineStep4Result {
  master: RSAAsset;
  complianceResult: ComplianceCheckResult;
  tokens: number;
}

// ============================================
// RSA PIPELINE CLASS
// ============================================

export class RSAPipeline {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private geminiApiKey: string;

  constructor() {
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    const geminiKey = process.env['GOOGLE_GEMINI_API_KEY'];

    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
    if (!geminiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.geminiApiKey = geminiKey;
  }

  /**
   * Generate a complete RSA set: master + variations
   */
  async generate(
    personaId: string,
    voiceId: string,
    variationCount: number = 10
  ): Promise<RSAGenerationResult> {
    const startTime = Date.now();
    let totalTokens = 0;

    const persona = getPersonaById(personaId);
    const voice = getVoiceById(voiceId);

    if (!persona) throw new Error(`Unknown persona: ${personaId}`);
    if (!voice) throw new Error(`Unknown voice: ${voiceId}`);

    console.log(`[RSA Pipeline] Starting for ${persona.displayName} + ${voice.displayName}...`);

    // Step 1: Claude - Initial RSA draft + compliance
    console.log('[RSA Pipeline] Step 1: Claude initial draft...');
    const step1 = await this.step1Claude(persona, voice);
    totalTokens += step1.tokens;

    // Step 2: ChatGPT - Improve and tighten
    console.log('[RSA Pipeline] Step 2: ChatGPT improvements...');
    const step2 = await this.step2ChatGPT(step1.draft, step1.compliance, persona, voice);
    totalTokens += step2.tokens;

    // Step 3: Gemini - Polish and diversify
    console.log('[RSA Pipeline] Step 3: Gemini polish...');
    const step3 = await this.step3Gemini(step2.draft, persona, voice);
    totalTokens += step3.tokens;

    // Step 4: Claude - Final validation and package
    console.log('[RSA Pipeline] Step 4: Claude final package...');
    const step4 = await this.step4ClaudeFinal(step3.draft, persona, voice);
    totalTokens += step4.tokens;

    // Generate variations from master
    console.log(`[RSA Pipeline] Generating ${variationCount} variations...`);
    const variations = await this.generateVariations(step4.master, persona, voice, variationCount);
    totalTokens += variations.tokens;

    const processingTime = Date.now() - startTime;
    console.log(`[RSA Pipeline] Complete in ${processingTime}ms, ${totalTokens} tokens used`);

    return {
      master: step4.master,
      variations: variations.assets,
      complianceResult: step4.complianceResult,
      metadata: {
        personaId,
        voiceId,
        processedAt: new Date().toISOString(),
        totalTokensUsed: totalTokens,
        processingTimeMs: processingTime,
      },
    };
  }

  /**
   * Step 1: Claude - Create initial RSA draft with compliance check
   */
  private async step1Claude(
    persona: AudiencePersona,
    voice: VoiceProfile
  ): Promise<PipelineStep1Result> {
    const prompt = `You are creating Google Responsive Search Ads (RSAs) for ArcVest.

${ARCVEST_AD_KNOWLEDGE}

---

TARGET AUDIENCE: ${persona.displayName}
${persona.painPoints.map(p => `- Pain point: ${p}`).join('\n')}
${persona.valuePropsToEmphasize.map(v => `- Emphasize: ${v}`).join('\n')}
Messaging angle: ${persona.messagingAngle}
Keywords: ${persona.keywordThemes.join(', ')}
CTA: ${persona.callToAction}

---

VOICE/TONE: ${voice.displayName}
${voice.promptModifiers}

Headline patterns to consider:
${voice.headlinePatterns.map(p => `- ${p}`).join('\n')}

Description patterns to consider:
${voice.descriptionPatterns.map(p => `- ${p}`).join('\n')}

---

RSA SPECIFICATIONS:
- Generate exactly 15 headlines (max 30 characters each)
- Generate exactly 4 descriptions (max 90 characters each)
- Each headline must be unique and serve a purpose

HEADLINE TYPES TO INCLUDE:
1. brand: Mention "ArcVest" (required in at least 1)
2. service: What we offer (retirement planning, wealth management, etc.)
3. benefit: What client gets (confidence, peace of mind, clarity)
4. cta: Call to action (Free Consultation, Get Started, etc.)
5. differentiator: Why us (fee-only, fiduciary, no commissions)
6. keyword: Target the audience's search terms
7. question: Engage with a question

COMPLIANCE RULES (CRITICAL):
- NO guaranteed returns or performance promises
- NO superlatives without proof ("best", "top-rated", "#1")
- NO market-beating promises
- NO risk-free claims
- NO specific return numbers

OUTPUT FORMAT (JSON only):
{
  "headlines": [
    {"text": "headline text", "type": "brand|service|benefit|cta|differentiator|keyword|question"},
    ... (15 total)
  ],
  "descriptions": [
    {"text": "description text"},
    ... (4 total)
  ]
}

Generate the RSA now:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find(c => c.type === 'text')?.text || '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    // Parse JSON response
    let draft: RSAAsset = { headlines: [], descriptions: [] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        draft = {
          headlines: parsed.headlines || [],
          descriptions: parsed.descriptions || [],
        };
      }
    } catch (e) {
      console.error('[RSA Pipeline] Failed to parse Step 1 JSON:', e);
    }

    // Run compliance check on all content
    const allText = [
      ...draft.headlines.map(h => h.text),
      ...draft.descriptions.map(d => d.text),
    ].join(' ');
    const compliance = checkCompliance(allText);

    return { draft, compliance, tokens };
  }

  /**
   * Step 2: ChatGPT - Improve and ensure character limits
   */
  private async step2ChatGPT(
    draft: RSAAsset,
    compliance: ComplianceCheckResult,
    persona: AudiencePersona,
    voice: VoiceProfile
  ): Promise<PipelineStep2Result> {
    const headlinesJson = JSON.stringify(draft.headlines, null, 2);
    const descriptionsJson = JSON.stringify(draft.descriptions, null, 2);

    const prompt = `You are an expert Google Ads copywriter improving RSA ad copy for ArcVest.

TARGET: ${persona.displayName}
VOICE: ${voice.displayName} - ${voice.description}

CURRENT HEADLINES:
${headlinesJson}

CURRENT DESCRIPTIONS:
${descriptionsJson}

COMPLIANCE ISSUES TO FIX:
${compliance.issues.length > 0 ? compliance.issues.map(i => `- ${i.text}: ${i.reason}`).join('\n') : 'None identified'}

YOUR TASKS:
1. Fix any compliance issues
2. Ensure ALL headlines are 30 characters or fewer (CRITICAL)
3. Ensure ALL descriptions are 90 characters or fewer (CRITICAL)
4. Improve impact while staying within character limits
5. Maintain diversity - each headline should be distinct
6. Keep at least one "ArcVest" brand mention
7. Maintain the ${voice.displayName} voice

CRITICAL CHARACTER LIMITS:
- Headlines: max 30 characters (count carefully!)
- Descriptions: max 90 characters

Output the improved version in this JSON format ONLY:
{
  "headlines": [{"text": "...", "type": "..."}],
  "descriptions": [{"text": "..."}],
  "improvements": ["improvement 1", "improvement 2"]
}`;

    try {
      // Using GPT-4o for reliability
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const text = response.choices[0]?.message?.content || '';
      const tokens = response.usage?.total_tokens || 0;

      let result: PipelineStep2Result = { draft, improvements: [], tokens };

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result = {
            draft: {
              headlines: parsed.headlines || draft.headlines,
              descriptions: parsed.descriptions || draft.descriptions,
            },
            improvements: parsed.improvements || [],
            tokens,
          };
        }
      } catch {
        // Keep original draft if parsing fails
      }

      return result;
    } catch (e) {
      console.error('[RSA Pipeline] ChatGPT step failed:', e);
      return { draft, improvements: ['ChatGPT step skipped due to error'], tokens: 0 };
    }
  }

  /**
   * Step 3: Gemini - Polish and ensure diversity
   */
  private async step3Gemini(
    draft: RSAAsset,
    persona: AudiencePersona,
    voice: VoiceProfile
  ): Promise<PipelineStep3Result> {
    const headlinesJson = JSON.stringify(draft.headlines, null, 2);
    const descriptionsJson = JSON.stringify(draft.descriptions, null, 2);

    const prompt = `You are a senior advertising editor polishing Google RSA ads for ArcVest, a fee-only fiduciary wealth advisor.

TARGET AUDIENCE: ${persona.displayName}
VOICE: ${voice.displayName}

CURRENT HEADLINES (must be ≤30 chars each):
${headlinesJson}

CURRENT DESCRIPTIONS (must be ≤90 chars each):
${descriptionsJson}

YOUR TASKS:
1. Polish for maximum impact and clarity
2. Ensure variety - no two headlines should feel similar
3. Verify EVERY headline is 30 chars or less
4. Verify EVERY description is 90 chars or less
5. Keep brand mentions and CTAs
6. Maintain the ${voice.displayName} tone

Output the polished version in this JSON format ONLY:
{
  "headlines": [{"text": "...", "type": "..."}],
  "descriptions": [{"text": "..."}],
  "edits": ["edit 1", "edit 2"]
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[RSA Pipeline] Gemini error:', data);
        return { draft, edits: ['Gemini step skipped due to error'], tokens: 0 };
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokens = data.usageMetadata?.totalTokenCount || 0;

      let result: PipelineStep3Result = { draft, edits: [], tokens };

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result = {
            draft: {
              headlines: parsed.headlines || draft.headlines,
              descriptions: parsed.descriptions || draft.descriptions,
            },
            edits: parsed.edits || [],
            tokens,
          };
        }
      } catch {
        // Keep original draft if parsing fails
      }

      return result;
    } catch (e) {
      console.error('[RSA Pipeline] Gemini step failed:', e);
      return { draft, edits: ['Gemini step skipped due to error'], tokens: 0 };
    }
  }

  /**
   * Step 4: Claude - Final validation and packaging
   */
  private async step4ClaudeFinal(
    draft: RSAAsset,
    persona: AudiencePersona,
    voice: VoiceProfile
  ): Promise<PipelineStep4Result> {
    // First, validate what we have
    const headlineTexts = draft.headlines.map(h => h.text);
    const descriptionTexts = draft.descriptions.map(d => d.text);
    const validation = validateRSA(headlineTexts, descriptionTexts);

    // If there are issues, ask Claude to fix them
    if (!validation.valid || validation.missingElements.length > 0) {
      const fixPrompt = `Fix these Google RSA ads to pass validation.

CURRENT HEADLINES:
${JSON.stringify(draft.headlines, null, 2)}

CURRENT DESCRIPTIONS:
${JSON.stringify(draft.descriptions, null, 2)}

ISSUES TO FIX:
${validation.headlineIssues.map(i => `- Headline ${i.index}: ${i.issue}`).join('\n')}
${validation.descriptionIssues.map(i => `- Description ${i.index}: ${i.issue}`).join('\n')}
${validation.complianceIssues.map(i => `- Compliance: ${i.text} - ${i.reason}`).join('\n')}
${validation.missingElements.map(e => `- Missing: ${e}`).join('\n')}

REQUIREMENTS:
- All headlines must be ≤30 characters
- All descriptions must be ≤90 characters
- Must include brand mention (ArcVest)
- Must include a CTA
- Must include a differentiator (fee-only, fiduciary, etc.)
- Voice: ${voice.displayName}
- Target: ${persona.displayName}

Output the fixed version in JSON format ONLY:
{
  "headlines": [{"text": "...", "type": "..."}],
  "descriptions": [{"text": "..."}]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.5,
        messages: [{ role: 'user', content: fixPrompt }],
      });

      const text = response.content.find(c => c.type === 'text')?.text || '';
      const tokens = response.usage.input_tokens + response.usage.output_tokens;

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          draft = {
            headlines: parsed.headlines || draft.headlines,
            descriptions: parsed.descriptions || draft.descriptions,
          };
        }
      } catch {
        // Keep current draft
      }

      // Re-validate
      const finalValidation = validateRSA(
        draft.headlines.map(h => h.text),
        draft.descriptions.map(d => d.text)
      );

      return {
        master: draft,
        complianceResult: {
          passed: finalValidation.valid,
          issues: finalValidation.complianceIssues,
          suggestions: finalValidation.missingElements.map(e => `Add: ${e}`),
        },
        tokens,
      };
    }

    // Already valid
    return {
      master: draft,
      complianceResult: {
        passed: true,
        issues: [],
        suggestions: [],
      },
      tokens: 0,
    };
  }

  /**
   * Generate variations from a master RSA
   * Uses a single Claude call for efficiency
   */
  private async generateVariations(
    master: RSAAsset,
    persona: AudiencePersona,
    voice: VoiceProfile,
    count: number
  ): Promise<{ assets: RSAAsset[]; tokens: number }> {
    const variationTypes = [
      { type: 'tonal', desc: 'Adjust tone - slightly more/less urgent, formal, or casual' },
      { type: 'tonal', desc: 'Different emotional angle while keeping the same voice' },
      { type: 'angle', desc: 'Lead with a different pain point' },
      { type: 'angle', desc: 'Emphasize a different value proposition' },
      { type: 'angle', desc: 'Focus on a different benefit' },
      { type: 'cta', desc: 'Use different calls to action' },
      { type: 'cta', desc: 'More direct or softer CTAs' },
      { type: 'benefit', desc: 'Highlight different benefits' },
      { type: 'benefit', desc: 'Reframe benefits from different perspective' },
      { type: 'urgency', desc: 'Adjust urgency level' },
    ];

    const targetVariations = variationTypes.slice(0, count);

    const prompt = `Generate ${count} variations of this Google RSA master ad for ArcVest.

MASTER AD:
Headlines: ${JSON.stringify(master.headlines.map(h => h.text))}
Descriptions: ${JSON.stringify(master.descriptions.map(d => d.text))}

TARGET: ${persona.displayName}
VOICE: ${voice.displayName}

VARIATIONS TO CREATE:
${targetVariations.map((v, i) => `${i + 1}. ${v.type}: ${v.desc}`).join('\n')}

CRITICAL RULES:
- Each headline MUST be 30 characters or fewer
- Each description MUST be 90 characters or fewer
- Keep at least one "ArcVest" mention per variation
- Include a CTA in each variation
- Include a differentiator (fee-only, fiduciary) in each
- NO compliance violations (no guarantees, superlatives, or risk-free claims)
- Each variation should be DISTINCTLY different from the master and other variations

Output as JSON array:
[
  {
    "variationType": "tonal|angle|cta|benefit|urgency",
    "headlines": [{"text": "...", "type": "..."}],
    "descriptions": [{"text": "..."}]
  },
  ...
]`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.9,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find(c => c.type === 'text')?.text || '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    const assets: RSAAsset[] = [];

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const variation of parsed) {
          // Validate each variation
          const headlineTexts = variation.headlines?.map((h: { text: string }) => h.text) || [];
          const descTexts = variation.descriptions?.map((d: { text: string }) => d.text) || [];

          // Check character limits
          const headlinesValid = headlineTexts.every((h: string) => checkHeadlineLength(h).valid);
          const descsValid = descTexts.every((d: string) => checkDescriptionLength(d).valid);

          if (headlinesValid && descsValid) {
            assets.push({
              headlines: variation.headlines || [],
              descriptions: variation.descriptions || [],
            });
          }
        }
      }
    } catch (e) {
      console.error('[RSA Pipeline] Failed to parse variations:', e);
    }

    console.log(`[RSA Pipeline] Generated ${assets.length} valid variations`);

    return { assets, tokens };
  }
}

// ============================================
// SINGLETON FACTORY
// ============================================

let pipelineInstance: RSAPipeline | null = null;

export function getRSAPipeline(): RSAPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new RSAPipeline();
  }
  return pipelineInstance;
}

// ============================================
// BATCH GENERATION HELPER
// ============================================

export interface BatchGenerationOptions {
  personaIds: string[];
  voiceIds: string[];
  variationsPerCombo?: number;
}

export interface BatchGenerationResult {
  results: RSAGenerationResult[];
  summary: {
    totalMasterAds: number;
    totalVariations: number;
    totalAds: number;
    failedCombos: Array<{ personaId: string; voiceId: string; error: string }>;
    processingTimeMs: number;
  };
}

/**
 * Generate RSAs for multiple persona/voice combinations
 */
export async function generateRSABatch(
  options: BatchGenerationOptions
): Promise<BatchGenerationResult> {
  const startTime = Date.now();
  const pipeline = getRSAPipeline();

  const results: RSAGenerationResult[] = [];
  const failedCombos: Array<{ personaId: string; voiceId: string; error: string }> = [];

  for (const personaId of options.personaIds) {
    for (const voiceId of options.voiceIds) {
      try {
        console.log(`[Batch] Generating ${personaId} + ${voiceId}...`);
        const result = await pipeline.generate(
          personaId,
          voiceId,
          options.variationsPerCombo || 10
        );
        results.push(result);
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[Batch] Failed ${personaId} + ${voiceId}:`, error);
        failedCombos.push({ personaId, voiceId, error });
      }
    }
  }

  const processingTime = Date.now() - startTime;

  return {
    results,
    summary: {
      totalMasterAds: results.length,
      totalVariations: results.reduce((sum, r) => sum + r.variations.length, 0),
      totalAds: results.length + results.reduce((sum, r) => sum + r.variations.length, 0),
      failedCombos,
      processingTimeMs: processingTime,
    },
  };
}
