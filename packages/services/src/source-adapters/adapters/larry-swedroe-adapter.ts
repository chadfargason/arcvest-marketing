/**
 * Larry Swedroe Email Adapter
 *
 * Extracts content ideas from Larry Swedroe's newsletters.
 * Larry writes about evidence-based investing and academic research.
 * Typically comes from Buckingham Wealth Partners.
 */

import { createLogger } from '@arcvest/shared';
import { GmailMessage } from '../../gmail-service';
import { BaseEmailAdapter } from './base-email-adapter';
import type { IdeaCandidate } from '../types';

const logger = createLogger('larry-swedroe-adapter');

export class LarrySwedroeAdapter extends BaseEmailAdapter {
  readonly sourceId = 'email-larry-swedroe';
  readonly sourceName = 'Larry Swedroe';

  protected extractIdeas(message: GmailMessage): IdeaCandidate[] {
    const ideas: IdeaCandidate[] = [];
    const html = message.bodyHtml || message.body;
    const plainText = this.htmlToText(html);

    // Larry's emails typically contain one main article/thought
    // They're more essay-style than link digests
    if (message.subject && plainText.length > 200) {
      ideas.push({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: this.cleanSubject(message.subject),
        summary: this.extractSummary(plainText),
        fullContent: plainText,
        originalUrl: this.extractPrimaryUrl(html),
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: 'Larry Swedroe',
        tags: this.buildTags(message.subject, plainText),
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          contentType: 'essay',
          expertSource: true,
        },
      });
    }

    // Also extract any linked research/articles
    const links = this.extractLinksFromHtml(html);
    const researchLinks = links.filter(link => {
      const url = link.url.toLowerCase();
      return (
        (url.includes('ssrn.com') ||
          url.includes('nber.org') ||
          url.includes('papers') ||
          url.includes('research') ||
          url.includes('journal')) &&
        link.text.length > 15
      );
    });

    for (const link of researchLinks) {
      ideas.push({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: `Research: ${this.cleanTitle(link.text)}`,
        summary: `Academic research shared by Larry Swedroe`,
        originalUrl: link.url,
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: 'Larry Swedroe (reference)',
        tags: ['larry-swedroe', 'research', 'academic', 'evidence-based'],
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          contentType: 'research-link',
          referredBy: 'Larry Swedroe',
        },
      });
    }

    return ideas;
  }

  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(Fwd|FW|Re):\s*/i, '')
      .replace(/\[.*?\]/g, '') // Remove bracketed prefixes
      .trim();
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractSummary(text: string): string {
    // Get first 2-3 sentences as summary
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').trim();
    return summary.length > 500 ? summary.substring(0, 500) + '...' : summary + '.';
  }

  private extractPrimaryUrl(html: string): string | undefined {
    // Look for Buckingham or Alpha Architect links
    const links = this.extractLinksFromHtml(html);
    const primary = links.find(link => {
      const url = link.url.toLowerCase();
      return (
        url.includes('buckingham') ||
        url.includes('alphaarchitect') ||
        url.includes('swedroe')
      );
    });
    return primary?.url;
  }

  private buildTags(subject: string, content: string): string[] {
    const tags: string[] = ['larry-swedroe', 'evidence-based'];
    const combined = `${subject} ${content}`.toLowerCase();

    const topics: [RegExp, string][] = [
      [/\bfactor[s]?\b/, 'factor-investing'],
      [/\bvalue\b/, 'value'],
      [/\bsmall[- ]?cap\b/, 'small-cap'],
      [/\bmomentum\b/, 'momentum'],
      [/\bquality\b/, 'quality'],
      [/\bprofitability\b/, 'profitability'],
      [/\bindex(ing)?\b|passive/, 'indexing'],
      [/\bactive\b/, 'active-management'],
      [/\bdfa\b|dimensional/, 'dimensional'],
      [/\bmarket timing\b/, 'market-timing'],
      [/\brisk\b/, 'risk'],
      [/\breturn[s]?\b/, 'returns'],
      [/\bdiversif/, 'diversification'],
      [/\bbehavior(al)?\b/, 'behavioral'],
      [/\bresearch\b|study|paper/, 'research'],
      [/\btax(es)?\b/, 'taxes'],
      [/\bretirement\b/, 'retirement'],
      [/\bbond[s]?\b/, 'bonds'],
      [/\binternational\b|global/, 'international'],
      [/\bemerging\b/, 'emerging-markets'],
      [/\breit[s]?\b|real estate/, 'real-estate'],
      [/\bcommodit/, 'commodities'],
      [/\bcrypto|bitcoin\b/, 'crypto'],
    ];

    for (const [pattern, tag] of topics) {
      if (pattern.test(combined) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }
}
