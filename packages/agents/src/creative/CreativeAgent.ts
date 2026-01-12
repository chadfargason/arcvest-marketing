/**
 * Creative Agent
 *
 * Generates ad copy, video scripts, and marketing materials.
 * Ensures all content meets SEC Marketing Rule compliance.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../base/BaseAgent';
import { ClaudeClient } from '../content/claude-client';
import type { AgentTask } from '@arcvest/shared';

export interface GoogleRSAAsset {
  headlines: string[]; // 15 headlines, max 30 chars each
  descriptions: string[]; // 4 descriptions, max 90 chars each
}

export interface VideoScript {
  duration: '30s' | '60s' | '90s';
  type: 'ad' | 'educational';
  scenes: {
    duration: number;
    visual: string;
    audio: string;
    text?: string;
  }[];
}

export class CreativeAgent extends BaseAgent {
  private claude: ClaudeClient;

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'creative',
      displayName: 'Creative Agent',
      description: 'Generates ad copy, headlines, and marketing materials',
      supabase,
    });

    this.claude = new ClaudeClient();
  }

  /**
   * Main run loop.
   */
  async run(): Promise<void> {
    this.logger.debug('Running creative agent cycle');

    const tasks = await this.getPendingTasks();
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`Failed to process task ${task.id}`, error);
      }
    }

    await this.updateStatus({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    });
  }

  /**
   * Execute a creative task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    // Cast to string to allow internal agent task types
    const taskType = task.type as string;

    switch (taskType) {
      case 'generate_ad_copy':
        return this.generateGoogleRSA(task.payload);

      case 'create_video_script':
        return this.createVideoScript(task.payload);

      case 'generate_display_specs':
        return this.generateDisplaySpecs(task.payload);

      case 'compliance_check':
        return this.checkAdCompliance(task.payload);

      case 'generate_variations':
        return this.generateVariations(task.payload);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Generate Google Responsive Search Ad assets.
   */
  async generateGoogleRSA(payload: Record<string, unknown>): Promise<{
    assetId: string;
    headlines: string[];
    descriptions: string[];
  }> {
    const { theme, targetAudience, landingPage, campaignId } = payload;

    this.logger.info('Generating Google RSA assets', { theme });

    const prompt = `Generate Google Responsive Search Ad (RSA) assets for a fee-only fiduciary financial advisor firm.

Theme: ${theme}
Target Audience: ${targetAudience || 'Individuals planning for retirement'}
Landing Page Focus: ${landingPage || 'General services'}

Generate:
1. **15 Headlines** (each MUST be 30 characters or less)
   - Include brand messaging (ArcVest, fee-only, fiduciary)
   - Include service benefits
   - Include calls-to-action
   - Variety of angles: educational, benefit-focused, action-oriented

2. **4 Descriptions** (each MUST be 90 characters or less)
   - Clear value proposition
   - Differentiation (fee-only, no commissions)
   - Call to action

IMPORTANT COMPLIANCE RULES:
- No performance guarantees or promises
- No "best" or "top" claims
- No specific return promises
- Focus on service benefits, not investment outcomes

Format as JSON:
{
  "headlines": ["Headline 1", "Headline 2", ...],
  "descriptions": ["Description 1", "Description 2", ...]
}`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.8,
      maxTokens: 2048,
    });

    let assets: GoogleRSAAsset;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        assets = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      this.logger.warn('Failed to parse RSA response, using defaults');
      assets = this.getDefaultRSAAssets();
    }

    // Validate and trim assets
    assets.headlines = this.validateHeadlines(assets.headlines);
    assets.descriptions = this.validateDescriptions(assets.descriptions);

    // Run compliance check
    const compliance = await this.checkAdCompliance({
      content: [...assets.headlines, ...assets.descriptions].join('\n'),
    });

    // Save to database
    const { data, error } = await this.supabase
      .from('creative_assets')
      .insert({
        asset_type: 'ad_copy',
        name: `Google RSA: ${theme}`,
        content: assets,
        campaign_id: campaignId as string | undefined,
        status: compliance.passed ? 'draft' : 'draft',
        metadata: {
          theme,
          targetAudience,
          landingPage,
          compliance_check: compliance,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save assets: ${error.message}`);
    }

    // Submit for approval
    await this.submitForApproval({
      type: 'ad_copy',
      title: `Google RSA: ${theme}`,
      summary: `15 headlines and 4 descriptions for ${theme} campaign`,
      content: {
        headlines: assets.headlines,
        descriptions: assets.descriptions,
        complianceCheck: compliance,
      },
      priority: compliance.passed ? 'medium' : 'high',
    });

    return {
      assetId: data.id,
      headlines: assets.headlines,
      descriptions: assets.descriptions,
    };
  }

  /**
   * Create a video script.
   */
  async createVideoScript(payload: Record<string, unknown>): Promise<{
    scriptId: string;
    script: VideoScript;
  }> {
    const {
      topic,
      duration = '60s',
      type = 'educational',
      keyMessages,
    } = payload;

    this.logger.info('Creating video script', { topic, duration, type });

    const durationSeconds = parseInt(duration as string) || 60;

    const prompt = `Create a ${duration} ${type} video script for a fee-only fiduciary financial advisor firm.

Topic: ${topic}
Key Messages: ${(keyMessages as string[])?.join(', ') || 'General brand awareness'}
Duration: ${duration}

Structure the script with scenes. Each scene should have:
- Duration in seconds
- Visual description (what viewers see)
- Audio/voiceover (what viewers hear)
- On-screen text (optional)

Requirements:
- Professional and trustworthy tone
- Clear call-to-action at the end
- No performance promises or guarantees
- Focus on value proposition: fee-only, fiduciary, client-focused

Format as JSON:
{
  "duration": "${duration}",
  "type": "${type}",
  "scenes": [
    {
      "duration": 5,
      "visual": "Description of what's shown",
      "audio": "Voiceover text",
      "text": "On-screen text (optional)"
    }
  ]
}`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    let script: VideoScript;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      script = this.getDefaultVideoScript(durationSeconds, type as 'ad' | 'educational');
    }

    // Validate total duration
    const totalDuration = script.scenes.reduce((sum, s) => sum + s.duration, 0);
    if (totalDuration > durationSeconds + 5) {
      this.logger.warn('Script exceeds target duration', { target: durationSeconds, actual: totalDuration });
    }

    // Run compliance check on all audio content
    const audioContent = script.scenes.map((s) => s.audio).join('\n');
    const compliance = await this.checkAdCompliance({ content: audioContent });

    // Save to database
    const { data, error } = await this.supabase
      .from('creative_assets')
      .insert({
        asset_type: 'video_script',
        name: `Video Script: ${topic}`,
        content: script,
        status: 'draft',
        metadata: {
          topic,
          duration,
          type,
          keyMessages,
          compliance_check: compliance,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save script: ${error.message}`);
    }

    // Submit for approval
    await this.submitForApproval({
      type: 'video_script',
      title: `Video Script: ${topic} (${duration})`,
      summary: `${type} video script about ${topic}`,
      content: { script, complianceCheck: compliance },
    });

    return { scriptId: data.id, script };
  }

  /**
   * Generate display ad specifications.
   */
  async generateDisplaySpecs(payload: Record<string, unknown>): Promise<{
    specId: string;
    specs: Record<string, unknown>;
  }> {
    const { theme, sizes, campaignId } = payload;

    this.logger.info('Generating display ad specs', { theme });

    const targetSizes = (sizes as string[]) || ['300x250', '728x90', '160x600'];

    const prompt = `Create display ad specifications for a fee-only fiduciary financial advisor firm.

Theme: ${theme}
Sizes needed: ${targetSizes.join(', ')}

For each size, provide:
1. Headline (short, impactful)
2. Subheadline (supporting message)
3. CTA button text
4. Visual direction (description of imagery)
5. Color scheme suggestions

Keep all text compliant:
- No performance guarantees
- No "best" claims without substantiation
- Focus on services and value proposition

Format as JSON with size as key.`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    let specs: Record<string, unknown>;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        specs = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      specs = this.getDefaultDisplaySpecs(targetSizes);
    }

    // Save to database
    const { data, error } = await this.supabase
      .from('creative_assets')
      .insert({
        asset_type: 'display_spec',
        name: `Display Specs: ${theme}`,
        content: specs,
        campaign_id: campaignId as string | undefined,
        status: 'draft',
        metadata: { theme, sizes: targetSizes },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save specs: ${error.message}`);
    }

    return { specId: data.id, specs };
  }

  /**
   * Check ad content for compliance.
   */
  async checkAdCompliance(payload: Record<string, unknown>): Promise<{
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const { content, assetId } = payload;

    let textToCheck = content as string;

    if (assetId && !textToCheck) {
      const { data } = await this.supabase
        .from('creative_assets')
        .select('content')
        .eq('id', assetId)
        .single();

      if (data?.content) {
        textToCheck = JSON.stringify(data.content);
      }
    }

    return this.claude.checkCompliance(textToCheck);
  }

  /**
   * Generate variations of existing ad copy.
   */
  async generateVariations(payload: Record<string, unknown>): Promise<{
    variations: string[];
  }> {
    const { originalText, count = 3, variationType } = payload;

    const prompt = `Generate ${count} variations of the following ad copy for a financial advisory firm:

Original: "${originalText}"
Variation Type: ${variationType || 'tonal'}

Create variations that:
- Maintain the core message
- Use different angles or emphasis
- Stay compliant (no guarantees, no superlatives without substantiation)
- Are appropriate length for ads

Return as JSON array: ["variation1", "variation2", ...]`;

    const result = await this.claude.generateContent(prompt, {
      temperature: 0.9,
      maxTokens: 1024,
    });

    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return { variations: JSON.parse(jsonMatch[0]) };
      }
    } catch {
      this.logger.warn('Failed to parse variations');
    }

    return { variations: [originalText as string] };
  }

  /**
   * Validate headlines for RSA requirements.
   */
  private validateHeadlines(headlines: string[]): string[] {
    return headlines
      .slice(0, 15)
      .map((h) => h.substring(0, 30).trim())
      .filter((h) => h.length > 0);
  }

  /**
   * Validate descriptions for RSA requirements.
   */
  private validateDescriptions(descriptions: string[]): string[] {
    return descriptions
      .slice(0, 4)
      .map((d) => d.substring(0, 90).trim())
      .filter((d) => d.length > 0);
  }

  /**
   * Get default RSA assets as fallback.
   */
  private getDefaultRSAAssets(): GoogleRSAAsset {
    return {
      headlines: [
        'Fee-Only Financial Advisor',
        'Fiduciary Wealth Management',
        'Retirement Planning Experts',
        'No Commission, No Conflict',
        'Your Goals, Our Priority',
        'Objective Financial Advice',
        'ArcVest Wealth Advisors',
        'Plan Your Retirement',
        'Independent Financial Guidance',
        'Trusted Fiduciary Advisors',
        'Schedule Free Consultation',
        'Personalized Financial Plans',
        'Client-First Approach',
        'Transparent Fee Structure',
        'Comprehensive Planning',
      ],
      descriptions: [
        'Fee-only fiduciary advisors focused on your financial success. No commissions, just objective advice.',
        'Personalized retirement planning from independent advisors who put your interests first.',
        'Comprehensive wealth management with transparent fees. Schedule your free consultation today.',
        'Trust your retirement to fiduciary experts. We succeed when you succeed.',
      ],
    };
  }

  /**
   * Get default video script as fallback.
   */
  private getDefaultVideoScript(duration: number, type: 'ad' | 'educational'): VideoScript {
    if (type === 'ad' && duration <= 30) {
      return {
        duration: '30s',
        type: 'ad',
        scenes: [
          { duration: 5, visual: 'Family enjoying retirement', audio: 'Planning for retirement?', text: 'ArcVest' },
          { duration: 10, visual: 'Advisor meeting with clients', audio: 'Our fee-only fiduciary advisors put your interests first.', text: 'Fee-Only Fiduciary' },
          { duration: 10, visual: 'Charts showing planning process', audio: 'No commissions. No conflicts. Just objective advice.', text: 'No Commissions' },
          { duration: 5, visual: 'Logo and contact info', audio: 'Schedule your free consultation at arcvest.com', text: 'arcvest.com' },
        ],
      };
    }

    return {
      duration: '60s',
      type,
      scenes: [
        { duration: 10, visual: 'Opening scene', audio: 'Welcome to ArcVest', text: 'ArcVest' },
        { duration: 20, visual: 'Main content', audio: 'We help you plan for a secure retirement.', text: 'Retirement Planning' },
        { duration: 20, visual: 'Benefits showcase', audio: 'As fee-only fiduciaries, we always put your interests first.', text: 'Your Interests First' },
        { duration: 10, visual: 'Call to action', audio: 'Visit arcvest.com to learn more.', text: 'arcvest.com' },
      ],
    };
  }

  /**
   * Get default display specs as fallback.
   */
  private getDefaultDisplaySpecs(sizes: string[]): Record<string, unknown> {
    const specs: Record<string, unknown> = {};

    for (const size of sizes) {
      specs[size] = {
        headline: 'Fee-Only Fiduciary Advisors',
        subheadline: 'Your retirement, our priority',
        cta: 'Learn More',
        visual: 'Professional imagery of advisor with clients',
        colors: {
          primary: '#1a365d',
          secondary: '#2b6cb0',
          accent: '#f6ad55',
        },
      };
    }

    return specs;
  }
}
