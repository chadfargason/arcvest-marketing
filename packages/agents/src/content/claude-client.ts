// @ts-nocheck
/**
 * Claude AI Client for Content Generation
 *
 * Uses Anthropic's Claude API for generating marketing content.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@arcvest/shared';

const logger = createLogger('claude-client');

export interface ContentGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface GeneratedContent {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ClaudeClient {
  private client: Anthropic;
  private defaultModel = 'claude-sonnet-4-20250514';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({ apiKey: key });
  }

  /**
   * Generate content using Claude.
   */
  async generateContent(
    prompt: string,
    options: ContentGenerationOptions = {}
  ): Promise<GeneratedContent> {
    const {
      maxTokens = 4096,
      temperature = 0.7,
      systemPrompt,
    } = options;

    logger.debug('Generating content', { promptLength: prompt.length });

    try {
      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response');
      }

      logger.debug('Content generated', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      return {
        content: textContent.text,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      logger.error('Failed to generate content', error);
      throw error;
    }
  }

  /**
   * Generate a blog post outline.
   */
  async generateOutline(
    topic: string,
    targetKeyword: string,
    additionalContext?: string
  ): Promise<string> {
    const prompt = `Create a detailed outline for a blog post about "${topic}".

Target keyword: ${targetKeyword}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Requirements:
- The blog post should be educational and informative
- Target audience: individuals planning for retirement or seeking financial advice
- Avoid sales language; focus on providing genuine value
- Include 4-6 main sections with subsections
- Each section should have a clear purpose

Format the outline with clear headings and bullet points.`;

    const result = await this.generateContent(prompt, {
      systemPrompt: this.getComplianceSystemPrompt(),
      temperature: 0.6,
    });

    return result.content;
  }

  /**
   * Generate a full blog post draft from an outline.
   */
  async generateBlogPost(
    outline: string,
    topic: string,
    targetKeyword: string
  ): Promise<string> {
    const prompt = `Write a complete blog post based on the following outline:

${outline}

Topic: ${topic}
Target keyword: ${targetKeyword}

Requirements:
- Write in a professional but approachable tone
- Target length: 1200-1500 words
- Include the target keyword naturally (3-5 times)
- Avoid making specific predictions about market performance
- Do not guarantee any investment outcomes
- Include a brief disclaimer at the end
- End with a subtle call-to-action about learning more

Write the complete blog post in markdown format.`;

    const result = await this.generateContent(prompt, {
      systemPrompt: this.getComplianceSystemPrompt(),
      maxTokens: 4096,
      temperature: 0.7,
    });

    return result.content;
  }

  /**
   * Generate a LinkedIn post.
   */
  async generateLinkedInPost(
    topic: string,
    keyPoints: string[],
    tone: 'educational' | 'thought-leadership' | 'personal' = 'educational'
  ): Promise<string> {
    const prompt = `Write a LinkedIn post about "${topic}".

Key points to cover:
${keyPoints.map((p) => `- ${p}`).join('\n')}

Tone: ${tone}

Requirements:
- Keep under 1300 characters for optimal visibility
- Start with a compelling hook
- Use short paragraphs and line breaks for readability
- End with a question or call-to-action to encourage engagement
- Include 3-5 relevant hashtags at the end
- Avoid promotional language
- No performance guarantees or predictions

Write the complete LinkedIn post.`;

    const result = await this.generateContent(prompt, {
      systemPrompt: this.getComplianceSystemPrompt(),
      maxTokens: 1024,
      temperature: 0.8,
    });

    return result.content;
  }

  /**
   * Generate a newsletter section.
   */
  async generateNewsletterSection(
    sectionType: 'market-update' | 'featured-article' | 'tip' | 'intro',
    context: Record<string, unknown>
  ): Promise<string> {
    const prompts: Record<string, string> = {
      'market-update': `Write a brief, balanced market update section for a financial planning newsletter.

Context: ${JSON.stringify(context)}

Requirements:
- 150-200 words
- Factual and balanced
- No predictions
- Focus on what happened, not what will happen
- End with a reminder about long-term perspective`,

      'featured-article': `Write an introduction to a featured article for a newsletter.

Article topic: ${context.topic}
Article summary: ${context.summary}

Requirements:
- 50-75 words
- Entice readers to click through
- Highlight the practical value`,

      'tip': `Write a practical financial planning tip for a newsletter.

Topic: ${context.topic}

Requirements:
- 75-100 words
- Actionable advice
- Avoid jargon
- No specific investment recommendations`,

      'intro': `Write a brief newsletter introduction.

Month: ${context.month}
Theme: ${context.theme}

Requirements:
- 50-75 words
- Warm and professional
- Set expectations for the content`,
    };

    const prompt = prompts[sectionType] || prompts.intro;

    const result = await this.generateContent(prompt, {
      systemPrompt: this.getComplianceSystemPrompt(),
      maxTokens: 512,
      temperature: 0.7,
    });

    return result.content;
  }

  /**
   * Check content for compliance issues.
   */
  async checkCompliance(content: string): Promise<{
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const prompt = `Review the following financial services marketing content for SEC Marketing Rule compliance issues:

${content}

Check for:
1. Performance guarantees or promises of specific returns
2. Misleading statements about risk
3. Unsubstantiated claims
4. Missing required disclosures
5. Testimonials without proper disclosure (if applicable)
6. Superlatives like "best," "top," or "leading" without substantiation
7. Cherry-picked performance data
8. Predictions presented as facts

Respond in JSON format:
{
  "passed": true/false,
  "issues": ["list of specific issues found"],
  "suggestions": ["list of suggested fixes"]
}

If the content passes compliance review, issues and suggestions can be empty arrays.`;

    const result = await this.generateContent(prompt, {
      systemPrompt: 'You are a compliance reviewer specializing in SEC Marketing Rule and FINRA regulations for investment advisers.',
      temperature: 0.3,
      maxTokens: 1024,
    });

    try {
      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      logger.warn('Failed to parse compliance check response');
    }

    return {
      passed: false,
      issues: ['Unable to parse compliance check results'],
      suggestions: ['Manual review required'],
    };
  }

  /**
   * Get the compliance-focused system prompt.
   */
  private getComplianceSystemPrompt(): string {
    return `You are a content writer for ArcVest, a fee-only fiduciary registered investment adviser (RIA).

IMPORTANT COMPLIANCE GUIDELINES:
- Never guarantee investment returns or outcomes
- Avoid predictions about market performance
- Do not use superlatives like "best," "top," or "leading" without substantiation
- Always maintain a balanced perspective on risks and benefits
- Do not provide specific investment recommendations
- Avoid testimonials unless properly disclosed
- Focus on education rather than promotion
- When discussing performance, include appropriate disclaimers
- Remember that past performance does not guarantee future results

BRAND VOICE:
- Professional but approachable
- Educational and helpful
- Trustworthy and transparent
- Client-focused, not sales-focused

TARGET AUDIENCE:
- Individuals and families planning for retirement
- Business owners seeking exit planning
- High-net-worth individuals needing comprehensive planning
- People seeking objective, unbiased financial advice`;
  }
}
