/**
 * Bloomberg Email Adapter
 *
 * Extracts content ideas from Bloomberg newsletters.
 * Parses Bloomberg's email format to find article headlines and links.
 */

import { createLogger } from '@arcvest/shared';
import { GmailMessage } from '../../gmail-service';
import { BaseEmailAdapter } from './base-email-adapter';
import type { IdeaCandidate } from '../types';

const logger = createLogger('bloomberg-adapter');

export class BloombergAdapter extends BaseEmailAdapter {
  readonly sourceId = 'email-bloomberg';
  readonly sourceName = 'Bloomberg';

  protected extractIdeas(message: GmailMessage): IdeaCandidate[] {
    const ideas: IdeaCandidate[] = [];
    const html = message.bodyHtml || message.body;

    // Bloomberg newsletters have headlines as links
    const links = this.extractLinksFromHtml(html);

    // Filter for Bloomberg article links
    const bloombergLinks = links.filter(link => {
      const url = link.url.toLowerCase();
      return (
        url.includes('bloomberg.com') &&
        !url.includes('unsubscribe') &&
        !url.includes('preferences') &&
        !url.includes('privacy') &&
        link.text.length > 20 // Skip short text like "Read more"
      );
    });

    logger.debug(`Found ${bloombergLinks.length} Bloomberg links in message ${message.id}`);

    for (const link of bloombergLinks) {
      // Skip generic links
      if (this.isGenericLink(link.text)) {
        continue;
      }

      ideas.push({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: this.cleanTitle(link.text),
        summary: `From Bloomberg newsletter: ${message.subject}`,
        originalUrl: link.url,
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: 'Bloomberg',
        tags: this.extractTags(link.text, link.url),
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          newsletterType: this.detectNewsletterType(message.subject),
        },
      });
    }

    // If no links found, treat the whole email as one idea
    if (ideas.length === 0 && message.subject) {
      const plainText = this.htmlToText(html);
      if (plainText.length > 100) {
        ideas.push({
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          sourceType: 'email',
          title: message.subject,
          summary: plainText.substring(0, 500),
          fullContent: plainText,
          discoveredAt: new Date(),
          publishedAt: message.date,
          author: 'Bloomberg',
          tags: ['bloomberg', 'newsletter'],
          metadata: {
            emailId: message.id,
            emailSubject: message.subject,
          },
        });
      }
    }

    return ideas;
  }

  private isGenericLink(text: string): boolean {
    const genericPhrases = [
      'read more',
      'click here',
      'view online',
      'unsubscribe',
      'manage preferences',
      'terms of service',
      'privacy policy',
      'contact us',
      'share this',
      'forward to a friend',
    ];
    const lowerText = text.toLowerCase();
    return genericPhrases.some(phrase => lowerText.includes(phrase));
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/^[•\-\*]\s*/, '') // Remove bullet points
      .trim();
  }

  private detectNewsletterType(subject: string): string {
    const lower = subject.toLowerCase();
    if (lower.includes('markets')) return 'markets';
    if (lower.includes('technology')) return 'technology';
    if (lower.includes('wealth')) return 'wealth';
    if (lower.includes('crypto')) return 'crypto';
    if (lower.includes('morning')) return 'morning-brief';
    if (lower.includes('evening')) return 'evening-brief';
    return 'general';
  }

  private extractTags(title: string, url: string): string[] {
    const tags: string[] = ['bloomberg'];
    const combined = `${title} ${url}`.toLowerCase();

    const tagPatterns: [RegExp, string][] = [
      [/\bmarket[s]?\b/i, 'markets'],
      [/\bstock[s]?\b/i, 'stocks'],
      [/\bbond[s]?\b/i, 'bonds'],
      [/\bfed\b|federal reserve/i, 'fed'],
      [/\binflation\b/i, 'inflation'],
      [/\brecession\b/i, 'recession'],
      [/\bcrypto|bitcoin|ethereum\b/i, 'crypto'],
      [/\btech|technology\b/i, 'technology'],
      [/\bai\b|artificial intelligence/i, 'ai'],
      [/\breal estate|housing\b/i, 'real-estate'],
      [/\bchina\b/i, 'china'],
      [/\beurope\b|european\b/i, 'europe'],
      [/\boil\b|energy\b/i, 'energy'],
      [/\bgold\b|commodities\b/i, 'commodities'],
    ];

    for (const [pattern, tag] of tagPatterns) {
      if (pattern.test(combined)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }
}
