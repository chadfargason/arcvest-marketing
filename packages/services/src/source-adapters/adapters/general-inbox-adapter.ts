/**
 * General Inbox Email Adapter
 *
 * Scans the general inbox for any investment-relevant content.
 * Uses AI to determine relevance and extract potential blog topics.
 * Excludes emails already handled by specialized adapters.
 */

import { createLogger } from '@arcvest/shared';
import { GmailMessage } from '../../gmail-service';
import { BaseEmailAdapter } from './base-email-adapter';
import type { IdeaCandidate, SourceAdapterConfig, FetchResult, EmailSourceConfig } from '../types';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('general-inbox-adapter');

export class GeneralInboxAdapter extends BaseEmailAdapter {
  readonly sourceId = 'email-general';
  readonly sourceName = 'General Inbox';

  private anthropic: Anthropic | null = null;

  private getAnthropic(): Anthropic {
    if (!this.anthropic) {
      this.anthropic = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'],
      });
    }
    return this.anthropic;
  }

  /**
   * Override fetch to apply exclude filters
   */
  override async fetch(config: SourceAdapterConfig): Promise<FetchResult> {
    const startTime = Date.now();
    const ideas: IdeaCandidate[] = [];
    const emailConfig = config.config as unknown as EmailSourceConfig;

    try {
      const maxItems = emailConfig.maxItems || 30;
      const hoursBack = emailConfig.hoursBack || 24;
      const excludeFilters = emailConfig.excludeFilters || [];

      logger.info(`Fetching general inbox emails`, { maxItems, hoursBack, excludeFilters });

      // Fetch recent messages
      const messages = await this.gmail.fetchNewMessages(maxItems, {
        hoursBack,
      });

      logger.info(`Found ${messages.length} messages in general inbox`);

      // Filter out messages that match exclude patterns
      const filteredMessages = messages.filter(msg => {
        const fromEmail = msg.from.email.toLowerCase();
        for (const filter of excludeFilters) {
          // Parse filter like "from:bloomberg.com"
          if (filter.startsWith('from:')) {
            const domain = filter.replace('from:', '').toLowerCase();
            if (fromEmail.includes(domain)) {
              return false;
            }
          }
        }
        // Also skip automated/system emails
        if (this.isAutomatedEmail(msg)) {
          return false;
        }
        return true;
      });

      logger.info(`After filtering: ${filteredMessages.length} messages to analyze`);

      // Analyze each message for investment relevance
      for (const message of filteredMessages) {
        try {
          const extracted = await this.analyzeAndExtract(message);
          if (extracted) {
            ideas.push(extracted);
          }
        } catch (error) {
          logger.error(`Failed to analyze message ${message.id}`, error);
        }
      }

      logger.info(`Extracted ${ideas.length} ideas from general inbox`);

      return {
        success: true,
        ideas,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch general inbox', error);

      return {
        success: false,
        ideas: [],
        error: errorMsg,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  protected extractIdeas(message: GmailMessage): IdeaCandidate[] {
    // This method is not used - we override fetch() instead
    return [];
  }

  private isAutomatedEmail(message: GmailMessage): boolean {
    const fromEmail = message.from.email.toLowerCase();
    const subject = message.subject.toLowerCase();

    const automatedPatterns = [
      'noreply@',
      'no-reply@',
      'notifications@',
      'mailer-daemon@',
      'postmaster@',
      'donotreply@',
      'auto@',
      'automated@',
      'updates@',
      'alerts@',
    ];

    const automatedSubjects = [
      'password reset',
      'verify your email',
      'confirm your',
      'receipt',
      'invoice',
      'order confirmation',
      'shipping',
      'delivery',
      'your statement',
      'account activity',
      'security alert',
    ];

    return (
      automatedPatterns.some(p => fromEmail.includes(p)) ||
      automatedSubjects.some(s => subject.includes(s))
    );
  }

  private async analyzeAndExtract(message: GmailMessage): Promise<IdeaCandidate | null> {
    const html = message.bodyHtml || message.body;
    const plainText = this.htmlToText(html);

    // Skip very short emails
    if (plainText.length < 100) {
      return null;
    }

    // Use Claude to analyze relevance
    try {
      const analysis = await this.analyzeWithClaude(message.subject, plainText, message.from.email);

      if (!analysis.isRelevant) {
        return null;
      }

      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: analysis.suggestedTitle || message.subject,
        summary: analysis.summary || plainText.substring(0, 300),
        fullContent: plainText,
        originalUrl: this.extractPrimaryUrl(html),
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: message.from.name || message.from.email,
        tags: analysis.tags || [],
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          fromEmail: message.from.email,
          fromName: message.from.name,
          aiAnalysis: {
            relevanceScore: analysis.relevanceScore,
            reason: analysis.reason,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to analyze email with Claude', error);
      return null;
    }
  }

  private async analyzeWithClaude(
    subject: string,
    content: string,
    fromEmail: string
  ): Promise<{
    isRelevant: boolean;
    relevanceScore: number;
    reason: string;
    suggestedTitle?: string;
    summary?: string;
    tags?: string[];
  }> {
    const claude = this.getAnthropic();

    // Truncate content if too long
    const truncatedContent = content.length > 3000
      ? content.substring(0, 3000) + '...[truncated]'
      : content;

    const response = await claude.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze this email for investment/finance content relevance. ArcVest is a wealth management firm that writes blog posts about investing, markets, retirement planning, and financial planning.

From: ${fromEmail}
Subject: ${subject}

Content:
${truncatedContent}

Respond with JSON only:
{
  "isRelevant": boolean (true if contains investment/finance topics worth blogging about),
  "relevanceScore": number 0-100 (how relevant to ArcVest's audience),
  "reason": "brief explanation",
  "suggestedTitle": "potential blog post title if relevant",
  "summary": "2-3 sentence summary if relevant",
  "tags": ["tag1", "tag2"] (investment-related tags if relevant)
}`,
        },
      ],
    });

    const firstContent = response.content[0];
    const text = firstContent && firstContent.type === 'text' ? firstContent.text : '';

    // Parse JSON from response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      logger.warn('Failed to parse Claude response as JSON');
    }

    return {
      isRelevant: false,
      relevanceScore: 0,
      reason: 'Failed to analyze',
    };
  }

  private extractPrimaryUrl(html: string): string | undefined {
    const links = this.extractLinksFromHtml(html);
    // Return first non-tracking link
    const primary = links.find(link => {
      const url = link.url.toLowerCase();
      return (
        url.startsWith('http') &&
        !url.includes('unsubscribe') &&
        !url.includes('mailto:') &&
        !url.includes('mailchimp') &&
        !url.includes('tracking')
      );
    });
    return primary?.url;
  }
}
