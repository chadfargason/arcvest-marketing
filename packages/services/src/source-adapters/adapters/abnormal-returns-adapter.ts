/**
 * Abnormal Returns Email Adapter
 *
 * Extracts content ideas from Abnormal Returns daily links digest.
 * Tadas Viskanta curates excellent investment and finance links.
 * The newsletter contains many categorized links to articles.
 */

import { createLogger } from '@arcvest/shared';
import { GmailMessage } from '../../gmail-service';
import { BaseEmailAdapter } from './base-email-adapter';
import type { IdeaCandidate } from '../types';

const logger = createLogger('abnormal-returns-adapter');

export class AbnormalReturnsAdapter extends BaseEmailAdapter {
  readonly sourceId = 'email-abnormal-returns';
  readonly sourceName = 'Abnormal Returns';

  protected extractIdeas(message: GmailMessage): IdeaCandidate[] {
    const ideas: IdeaCandidate[] = [];
    const html = message.bodyHtml || message.body;

    // Abnormal Returns has a specific format with categorized links
    const links = this.extractLinksFromHtml(html);

    // Filter out internal/navigation links
    const articleLinks = links.filter(link => {
      const url = link.url.toLowerCase();
      return (
        url.startsWith('http') &&
        !url.includes('abnormalreturns.com/subscribe') &&
        !url.includes('abnormalreturns.com/unsubscribe') &&
        !url.includes('mailchimp') &&
        !url.includes('twitter.com') &&
        !url.includes('facebook.com') &&
        !url.includes('linkedin.com/share') &&
        link.text.length > 15
      );
    });

    logger.debug(`Found ${articleLinks.length} article links in Abnormal Returns digest`);

    // Track unique URLs to avoid duplicates
    const seenUrls = new Set<string>();

    for (const link of articleLinks) {
      // Skip if we've already seen this URL
      const normalizedUrl = this.normalizeUrl(link.url);
      if (seenUrls.has(normalizedUrl)) {
        continue;
      }
      seenUrls.add(normalizedUrl);

      // Skip generic navigation links
      if (this.isNavigationLink(link.text)) {
        continue;
      }

      // Detect category from context
      const category = this.detectCategory(html, link.url);

      ideas.push({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: 'email',
        title: this.cleanTitle(link.text),
        summary: `Curated by Abnormal Returns (${category})`,
        originalUrl: link.url,
        discoveredAt: new Date(),
        publishedAt: message.date,
        author: 'Abnormal Returns / Tadas Viskanta',
        tags: this.buildTags(link.text, category, link.url),
        metadata: {
          emailId: message.id,
          emailSubject: message.subject,
          category,
          curator: 'Tadas Viskanta',
        },
      });
    }

    logger.info(`Extracted ${ideas.length} ideas from Abnormal Returns digest`);
    return ideas;
  }

  private normalizeUrl(url: string): string {
    // Remove tracking parameters
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete('utm_source');
      parsed.searchParams.delete('utm_medium');
      parsed.searchParams.delete('utm_campaign');
      parsed.searchParams.delete('ref');
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private isNavigationLink(text: string): boolean {
    const navPhrases = [
      'read more',
      'click here',
      'subscribe',
      'unsubscribe',
      'view in browser',
      'share',
      'tweet',
      'facebook',
      'earlier',
      'archive',
      'abnormalreturns.com',
    ];
    const lowerText = text.toLowerCase();
    return navPhrases.some(phrase => lowerText.includes(phrase)) || text.length < 10;
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/^[•\-\*\d\.]\s*/, '') // Remove bullets/numbers
      .replace(/\($/, '') // Remove trailing parenthesis
      .trim();
  }

  private detectCategory(html: string, url: string): string {
    // Abnormal Returns organizes links by category
    // Try to find the category header before this link
    const categories = [
      'markets',
      'economy',
      'finance',
      'investing',
      'etfs',
      'personal finance',
      'retirement',
      'behavioral finance',
      'global',
      'commodities',
      'crypto',
      'trading',
      'research',
    ];

    const lowerHtml = html.toLowerCase();
    const urlIndex = lowerHtml.indexOf(url.toLowerCase());

    if (urlIndex > 0) {
      // Look at the 500 characters before the URL
      const context = lowerHtml.substring(Math.max(0, urlIndex - 500), urlIndex);

      // Find the last category mention
      let lastCategory = 'general';
      let lastIndex = -1;

      for (const cat of categories) {
        const idx = context.lastIndexOf(cat);
        if (idx > lastIndex) {
          lastIndex = idx;
          lastCategory = cat;
        }
      }

      return lastCategory;
    }

    return 'general';
  }

  private buildTags(title: string, category: string, url: string): string[] {
    const tags: string[] = ['abnormal-returns', 'curated'];

    // Add category as tag
    if (category !== 'general') {
      tags.push(category.replace(' ', '-'));
    }

    // Detect source from URL
    const sources: [RegExp, string][] = [
      [/wsj\.com/i, 'wsj'],
      [/ft\.com/i, 'financial-times'],
      [/bloomberg\.com/i, 'bloomberg'],
      [/nytimes\.com/i, 'nytimes'],
      [/reuters\.com/i, 'reuters'],
      [/barrons\.com/i, 'barrons'],
      [/morningstar\.com/i, 'morningstar'],
      [/seeking-?alpha/i, 'seeking-alpha'],
      [/kitces\.com/i, 'kitces'],
    ];

    for (const [pattern, tag] of sources) {
      if (pattern.test(url)) {
        tags.push(tag);
        break;
      }
    }

    // Detect topics from title
    const combined = title.toLowerCase();
    const topics: [RegExp, string][] = [
      [/\bmarket[s]?\b/, 'markets'],
      [/\bstock[s]?\b/, 'stocks'],
      [/\bbond[s]?\b/, 'bonds'],
      [/\betf[s]?\b/, 'etfs'],
      [/\bfed\b|federal reserve/, 'fed'],
      [/\binflation\b/, 'inflation'],
      [/\bretirement\b|retire/, 'retirement'],
      [/\btax(es)?\b/, 'taxes'],
      [/\b401k\b|\bira\b/, 'retirement-accounts'],
      [/\bindex\b|passive/, 'indexing'],
      [/\bactive\b/, 'active-management'],
      [/\bdividend[s]?\b/, 'dividends'],
      [/\bvaluation[s]?\b/, 'valuations'],
      [/\bvolatility\b/, 'volatility'],
    ];

    for (const [pattern, tag] of topics) {
      if (pattern.test(combined) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }
}
