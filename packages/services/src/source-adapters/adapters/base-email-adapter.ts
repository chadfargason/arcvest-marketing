/**
 * Base Email Adapter
 *
 * Common functionality for email-based source adapters.
 * Handles Gmail integration and email parsing.
 */

import { createLogger } from '@arcvest/shared';
import { GmailService, GmailMessage } from '../../gmail-service';
import type {
  SourceAdapter,
  SourceAdapterConfig,
  IdeaCandidate,
  FetchResult,
  SourceType,
  EmailSourceConfig,
} from '../types';

const logger = createLogger('base-email-adapter');

/**
 * Abstract base class for email source adapters
 */
export abstract class BaseEmailAdapter implements SourceAdapter {
  abstract readonly sourceId: string;
  abstract readonly sourceName: string;
  readonly sourceType: SourceType = 'email';

  protected gmail: GmailService;

  constructor() {
    this.gmail = new GmailService({
      clientId: process.env['GOOGLE_CLIENT_ID'] || '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
      redirectUri: process.env['GOOGLE_REDIRECT_URI'] || '',
    });
  }

  /**
   * Extract ideas from a Gmail message.
   * Subclasses should override this for source-specific parsing.
   */
  protected abstract extractIdeas(message: GmailMessage): IdeaCandidate[];

  /**
   * Get the Gmail search filter for this source.
   * Can be overridden, but defaults to using config.
   */
  protected getFilter(config: SourceAdapterConfig): string {
    const emailConfig = config.config as unknown as EmailSourceConfig;
    return emailConfig?.filter || '';
  }

  /**
   * Fetch emails and extract ideas
   */
  async fetch(config: SourceAdapterConfig): Promise<FetchResult> {
    const startTime = Date.now();
    const ideas: IdeaCandidate[] = [];
    const emailConfig = config.config as unknown as EmailSourceConfig;

    try {
      const filter = this.getFilter(config);
      const maxItems = emailConfig.maxItems || 20;
      const hoursBack = emailConfig.hoursBack || 24;

      logger.info(`Fetching emails for ${this.sourceId}`, { filter, maxItems, hoursBack });

      // Fetch messages from Gmail
      const messages = await this.gmail.fetchNewMessages(maxItems, {
        fromFilter: filter,
        hoursBack,
      });

      logger.info(`Found ${messages.length} messages for ${this.sourceId}`);

      // Extract ideas from each message
      for (const message of messages) {
        try {
          const extracted = this.extractIdeas(message);
          ideas.push(...extracted);
        } catch (error) {
          logger.error(`Failed to extract ideas from message ${message.id}`, error);
        }
      }

      logger.info(`Extracted ${ideas.length} ideas from ${messages.length} messages`);

      return {
        success: true,
        ideas,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to fetch from ${this.sourceId}`, error);

      return {
        success: false,
        ideas: [],
        error: errorMsg,
        fetchedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if Gmail is connected
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const connected = await this.gmail.isConnected();
      if (connected) {
        return { healthy: true, message: 'Gmail connected' };
      } else {
        return { healthy: false, message: 'Gmail not connected' };
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper: Extract URLs from text
   */
  protected extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Helper: Clean HTML and extract text
   */
  protected htmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Helper: Extract links with text from HTML
   */
  protected extractLinksFromHtml(html: string): Array<{ text: string; url: string }> {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    const links: Array<{ text: string; url: string }> = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1] || '';
      const text = (match[2] || '').trim();
      if (url.startsWith('http') && text.length > 5) {
        links.push({ text, url });
      }
    }

    return links;
  }
}
