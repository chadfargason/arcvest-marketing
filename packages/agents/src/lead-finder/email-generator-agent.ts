/**
 * Email Generator Agent
 * 
 * Uses Claude to generate personalized outreach emails for leads.
 * Supports multiple tones that rotate:
 * - congratulatory: Warm intro acknowledging their achievement
 * - value_first: Lead with value proposition
 * - peer_credibility: Reference similar clients/situations
 * - direct_curious: Direct and inquisitive approach
 */

import Anthropic from '@anthropic-ai/sdk';

// Define ScoredLead interface locally to avoid circular dependency
export interface ScoredLead {
  fullName: string;
  title: string | null;
  company: string | null;
  geoSignal: string | null;
  triggerType: string;
  category: string;
  rationaleShort: string;
  rationaleDetail: string;
  personKey: string;
  score: number;
  tier: string;
}

export type EmailTone = 'congratulatory' | 'value_first' | 'peer_credibility' | 'direct_curious';

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyPlain: string;
  tone: EmailTone;
}

const COMPANY_CONTEXT = `
ArcVest is a registered investment advisor (RIA) based in Texas.
- We specialize in comprehensive wealth management for high-net-worth individuals
- Our clients typically have $1M+ in investable assets
- We provide fiduciary advice (legally bound to act in client's best interest)
- Services include: investment management, retirement planning, tax planning, estate planning
- We work with executives, business owners, and professionals navigating major transitions
- Our founders are Chad and Erik, both CFPs with decades of experience
`;

const TONE_INSTRUCTIONS: Record<EmailTone, string> = {
  congratulatory: `
TONE: Warm & Congratulatory
- Open by genuinely acknowledging their recent achievement/transition
- Express interest in learning about their journey
- Subtly mention how transitions often create planning opportunities
- Keep it brief and personal, not salesy
- CTA: Offer a brief conversation to learn more about their plans
`,
  value_first: `
TONE: Value-First
- Lead with a specific insight or challenge relevant to their situation
- Show expertise without being condescending
- Reference the type of decisions someone in their position typically faces
- Position the conversation as educational/consultative
- CTA: Offer to share insights specific to their situation
`,
  peer_credibility: `
TONE: Peer Credibility
- Reference working with others in similar roles/industries (without naming)
- Share a relevant pattern or insight from that experience
- Make them feel understood and that you "get" their world
- Keep it collegial, like peer-to-peer
- CTA: Offer to compare notes or share what's worked for others
`,
  direct_curious: `
TONE: Direct & Curious
- Be direct about why you're reaching out
- Express genuine curiosity about their situation/plans
- Ask a thoughtful question related to their trigger event
- Keep it short and unpretentious
- CTA: Simple ask for a brief call to learn more
`,
};

const EMAIL_SYSTEM_PROMPT = `You are a copywriter for ArcVest, a wealth management firm. Your job is to write personalized outreach emails to potential high-net-worth clients.

${COMPANY_CONTEXT}

CRITICAL RULES:
1. Keep emails SHORT (100-150 words max for body)
2. Sound like a real person, not a marketing template
3. Reference their specific trigger event naturally
4. Never be salesy or pushy
5. Never make claims about guarantees or returns
6. Never reference their wealth directly (it's gauche)
7. Be professional but warm
8. Subject lines should be 5-8 words max, feel personal
9. Use their first name only (no "Mr./Ms.")
10. Sign as "Chad" (one of the firm's principals)`;

const EMAIL_USER_PROMPT = `Write an outreach email for this lead:

NAME: {name}
TITLE: {title}
COMPANY: {company}
LOCATION: {location}
TRIGGER TYPE: {triggerType}
TRIGGER CONTEXT: {rationale}

{toneInstructions}

Return JSON with this exact structure:
{
  "subject": "Subject line here",
  "bodyHtml": "<p>Email body with HTML formatting...</p><p>Signature...</p>",
  "bodyPlain": "Plain text version of the email..."
}

IMPORTANT:
- Subject line must feel personal and NOT salesy (no "I'd love to help..." or "Quick question...")
- Body should be 100-150 words
- Include proper greeting and sign-off
- Sign as "Chad Fargason" with title "Partner, ArcVest"
- Reference the specific trigger naturally in opening`;

export class EmailGeneratorAgent {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }

  /**
   * Generate an email for a single lead
   */
  async generateEmail(lead: ScoredLead, tone: EmailTone): Promise<GeneratedEmail | null> {
    const toneInstructions = TONE_INSTRUCTIONS[tone];
    
    const firstName = (lead as any).fullName.split(' ')[0] as string;
    
    const userPrompt = EMAIL_USER_PROMPT
      .replace('{name}', firstName)
      .replace('{title}', (lead as any).title || 'Executive')
      .replace('{company}', (lead as any).company || 'their organization')
      .replace('{location}', (lead as any).geoSignal || 'Texas')
      .replace('{triggerType}', this.formatTriggerType((lead as any).triggerType || 'other'))
      .replace('{rationale}', (lead as any).rationaleDetail || (lead as any).rationaleShort)
      .replace('{toneInstructions}', toneInstructions);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: EMAIL_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        return null;
      }

      return this.parseEmailResponse(content.text, tone);
    } catch (error) {
      console.error('Error generating email:', error);
      return null;
    }
  }

  /**
   * Format trigger type for display
   */
  private formatTriggerType(type: string): string {
    switch (type) {
      case 'career_move': return 'New role/promotion';
      case 'funding_mna': return 'Funding or M&A event';
      case 'expansion': return 'Company expansion';
      case 'recognition': return 'Recognition/award';
      default: return 'Recent business development';
    }
  }

  /**
   * Parse email response from Claude
   */
  private parseEmailResponse(responseText: string, tone: EmailTone): GeneratedEmail | null {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in email response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.subject || !parsed.bodyHtml || !parsed.bodyPlain) {
        console.warn('Missing required email fields');
        return null;
      }

      return {
        subject: parsed.subject,
        bodyHtml: parsed.bodyHtml,
        bodyPlain: parsed.bodyPlain,
        tone,
      };
    } catch (error) {
      console.error('Error parsing email response:', error);
      return null;
    }
  }

  /**
   * Generate emails for multiple leads with rotating tones
   */
  async generateEmailsBatch(
    leads: ScoredLead[],
    tones: EmailTone[] = ['congratulatory', 'value_first', 'peer_credibility', 'direct_curious']
  ): Promise<Map<string, GeneratedEmail | null>> {
    const results = new Map<string, GeneratedEmail | null>();

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead) continue;
      const tone = tones[i % tones.length] as EmailTone; // Rotate through tones

      const email = await this.generateEmail(lead, tone);
      results.set((lead as any).personKey, email);

      // Small delay between API calls
      if (i < leads.length - 1) {
        await this.delay(300);
      }
    }

    return results;
  }

  /**
   * Regenerate an email with a different tone
   */
  async regenerateEmail(lead: ScoredLead, newTone: EmailTone): Promise<GeneratedEmail | null> {
    return this.generateEmail(lead, newTone);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
export const emailGeneratorAgent = new EmailGeneratorAgent();
