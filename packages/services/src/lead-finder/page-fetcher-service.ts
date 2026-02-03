/**
 * Page Fetcher Service
 * 
 * Fetches web pages with:
 * - Rate limiting per domain
 * - robots.txt checking
 * - HTML to readable text extraction
 * - Error handling and retries
 */

// @ts-expect-error - jsdom is external dependency
import { JSDOM } from 'jsdom';
// @ts-expect-error - @mozilla/readability is external dependency
import { Readability } from '@mozilla/readability';

export interface FetchedPage {
  url: string;
  finalUrl: string;
  domain: string;
  httpStatus: number;
  pageTitle: string | null;
  publishedAtGuess: string | null;
  extractedText: string;
  contentHash: string;
  fetchedAt: string;
  error?: string;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxRetries?: number;
  respectRobots?: boolean;
}

// Simple in-memory rate limiter
const domainLastFetch = new Map<string, number>();
const MIN_DELAY_MS = 1000; // 1 second between requests to same domain

export class PageFetcherService {
  private robotsCache = new Map<string, boolean>();
  private userAgent = 'ArcVest-Marketing-Bot/1.0 (Lead Research)';

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate a simple content hash
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Wait for rate limit
   */
  private async waitForRateLimit(domain: string): Promise<void> {
    const lastFetch = domainLastFetch.get(domain) || 0;
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetch;

    if (timeSinceLastFetch < MIN_DELAY_MS) {
      await this.delay(MIN_DELAY_MS - timeSinceLastFetch);
    }

    domainLastFetch.set(domain, Date.now());
  }

  /**
   * Check if URL is allowed by robots.txt (simplified check)
   */
  private async checkRobotsTxt(url: string): Promise<boolean> {
    const domain = this.extractDomain(url);
    
    // Check cache first
    if (this.robotsCache.has(domain)) {
      return this.robotsCache.get(domain)!;
    }

    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        // If no robots.txt, assume allowed
        this.robotsCache.set(domain, true);
        return true;
      }

      const robotsText = await response.text();
      
      // Simple check: if Disallow: / for all user agents, block
      // This is a simplified implementation
      const isBlocked = robotsText.includes('User-agent: *') && 
                        robotsText.includes('Disallow: /');
      
      const isAllowed = !isBlocked;
      this.robotsCache.set(domain, isAllowed);
      return isAllowed;
    } catch {
      // If can't fetch robots.txt, assume allowed
      this.robotsCache.set(domain, true);
      return true;
    }
  }

  /**
   * Extract publication date from page
   */
  private extractPublishDate(document: Document): string | null {
    // Try various meta tags
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="og:published_time"]',
      'meta[name="date"]',
      'meta[name="pubdate"]',
      'meta[name="publishdate"]',
      'meta[itemprop="datePublished"]',
      'time[datetime]',
      'time[pubdate]',
    ];

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const dateStr = element.getAttribute('content') || 
                        element.getAttribute('datetime') ||
                        element.textContent;
        if (dateStr) {
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          } catch {
            // Continue to next selector
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract readable text from HTML using Readability
   */
  private extractReadableText(html: string, url: string): { title: string | null; text: string } {
    try {
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Try Readability first
      const reader = new Readability(document.cloneNode(true) as Document);
      const article = reader.parse();

      if (article && article.textContent) {
        return {
          title: article.title,
          text: this.cleanText(article.textContent),
        };
      }

      // Fallback: extract from body
      const body = document.body;
      if (body) {
        // Remove script and style elements
        const scripts = body.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach((el: Element) => el.remove());

        return {
          title: document.title || null,
          text: this.cleanText(body.textContent || ''),
        };
      }

      return { title: null, text: '' };
    } catch (error) {
      console.error('Error extracting text:', error);
      return { title: null, text: '' };
    }
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
      .trim()
      .slice(0, 50000);  // Limit to ~50k chars to avoid massive pages
  }

  /**
   * Fetch a single page
   */
  async fetchPage(url: string, options: FetchOptions = {}): Promise<FetchedPage> {
    const {
      timeoutMs = 15000,
      maxRetries = 2,
      respectRobots = true,
    } = options;

    const domain = this.extractDomain(url);
    const fetchedAt = new Date().toISOString();

    // Check robots.txt
    if (respectRobots) {
      const allowed = await this.checkRobotsTxt(url);
      if (!allowed) {
        return {
          url,
          finalUrl: url,
          domain,
          httpStatus: 403,
          pageTitle: null,
          publishedAtGuess: null,
          extractedText: '',
          contentHash: '',
          fetchedAt,
          error: 'Blocked by robots.txt',
        };
      }
    }

    // Wait for rate limit
    await this.waitForRateLimit(domain);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });

        const finalUrl = response.url;
        const httpStatus = response.status;

        if (!response.ok) {
          return {
            url,
            finalUrl,
            domain,
            httpStatus,
            pageTitle: null,
            publishedAtGuess: null,
            extractedText: '',
            contentHash: '',
            fetchedAt,
            error: `HTTP ${httpStatus}`,
          };
        }

        const html = await response.text();
        const { title, text } = this.extractReadableText(html, finalUrl);

        // Try to extract publish date
        const dom = new JSDOM(html, { url: finalUrl });
        const publishedAtGuess = this.extractPublishDate(dom.window.document);

        return {
          url,
          finalUrl,
          domain,
          httpStatus,
          pageTitle: title,
          publishedAtGuess,
          extractedText: text,
          contentHash: this.hashContent(text),
          fetchedAt,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Fetch attempt ${attempt + 1} failed for ${url}:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return {
      url,
      finalUrl: url,
      domain,
      httpStatus: 0,
      pageTitle: null,
      publishedAtGuess: null,
      extractedText: '',
      contentHash: '',
      fetchedAt,
      error: lastError?.message || 'Unknown fetch error',
    };
  }

  /**
   * Fetch multiple pages with concurrency control
   */
  async fetchPages(urls: string[], options: FetchOptions = {}, concurrency = 3): Promise<FetchedPage[]> {
    const results: FetchedPage[] = [];
    const urlQueue = [...urls];

    // Process in batches
    while (urlQueue.length > 0) {
      const batch = urlQueue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.fetchPage(url, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const pageFetcherService = new PageFetcherService();
