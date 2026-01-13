/**
 * Michael Green Email Adapter
 *
 * Extracts content ideas from Michael Green's newsletters.
 * Michael writes about macro market analysis, passive investing impact,
 * and structural market dynamics. Comes from Simplify or Logica Funds.
 */

import { createLogger } from '@arcvest/shared';
import { GmailMessage } from '../../gmail-service';
import { BaseEmailAdapter } from './base-email-adapter';
import type { IdeaCandidate } from '../types';

const logger = createLogger('michael-green-adapter');

export class MichaelGreenAdapter extends BaseEmailAdapter {
  readonly sourceId = 'email-michael-green';
  readonly sourceName = 'Michael Green';

  protected extractIdeas(message: GmailMessage): IdeaCandidate[] {
    const ideas: IdeaCandidate[] = [];
    const html = message.bodyHtml || message.body;
    const plainText = this.htmlToText(html);

    // Michael's content is typically one coherent macro analysis
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
        author: 'Michael Green',
        tags: this.buildTags(message.subject, plainText),
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          contentType: 'macro-analysis',
          expertSource: true,
        },
      });
    }

    // Also extract any linked podcast appearances or articles
    const links = this.extractLinksFromHtml(html);
    const contentLinks = links.filter(link => {
      const url = link.url.toLowerCase();
      return (
        (url.includes('youtube') ||
          url.includes('podcast') ||
          url.includes('substack') ||
          url.includes('simplify.us')) &&
        link.text.length > 15 &&
        !link.text.toLowerCase().includes('unsubscribe')
      );
    });

    for (const link of contentLinks) {
      ideas.push({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: this.cleanTitle(link.text),
        summary: `Content from Michael Green / Simplify`,
        originalUrl: link.url,
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: 'Michael Green',
        tags: ['michael-green', 'macro', 'simplify'],
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          contentType: this.detectContentType(link.url),
        },
      });
    }

    return ideas;
  }

  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(Fwd|FW|Re):\s*/i, '')
      .replace(/\[.*?\]/g, '')
      .trim();
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').trim();
    return summary.length > 500 ? summary.substring(0, 500) + '...' : summary + '.';
  }

  private extractPrimaryUrl(html: string): string | undefined {
    const links = this.extractLinksFromHtml(html);
    const primary = links.find(link => {
      const url = link.url.toLowerCase();
      return (
        url.includes('simplify') ||
        url.includes('logica') ||
        url.includes('michael') ||
        url.includes('substack')
      );
    });
    return primary?.url;
  }

  private detectContentType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('youtube')) return 'video';
    if (lower.includes('podcast') || lower.includes('spotify') || lower.includes('apple.com/podcast')) return 'podcast';
    if (lower.includes('twitter') || lower.includes('x.com')) return 'social';
    return 'article';
  }

  private buildTags(subject: string, content: string): string[] {
    const tags: string[] = ['michael-green', 'macro'];
    const combined = `${subject} ${content}`.toLowerCase();

    const topics: [RegExp, string][] = [
      [/\bpassive\b|index fund/, 'passive-investing'],
      [/\bflow[s]?\b/, 'flows'],
      [/\bliquidity\b/, 'liquidity'],
      [/\bvolatility\b|vol\b/, 'volatility'],
      [/\bgamma\b/, 'gamma'],
      [/\boptions?\b/, 'options'],
      [/\bmarket structure\b/, 'market-structure'],
      [/\bretail\b/, 'retail-investors'],
      [/\binstitution/, 'institutional'],
      [/\bfed\b|federal reserve/, 'fed'],
      [/\bcentral bank/, 'central-banks'],
      [/\binflation\b/, 'inflation'],
      [/\bdeflation\b/, 'deflation'],
      [/\binterest rate/, 'interest-rates'],
      [/\bbond[s]?\b/, 'bonds'],
      [/\bequit(y|ies)\b|stock[s]?\b/, 'equities'],
      [/\btail risk\b/, 'tail-risk'],
      [/\bhedg(e|ing)\b/, 'hedging'],
      [/\breturn\b|performance/, 'returns'],
      [/\bdollar\b|currency/, 'currency'],
      [/\bchina\b/, 'china'],
      [/\bemerging\b/, 'emerging-markets'],
      [/\bcrash\b|correction/, 'corrections'],
      [/\brisk\b/, 'risk'],
      [/\bsystemic\b/, 'systemic-risk'],
    ];

    for (const [pattern, tag] of topics) {
      if (pattern.test(combined) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }
}
