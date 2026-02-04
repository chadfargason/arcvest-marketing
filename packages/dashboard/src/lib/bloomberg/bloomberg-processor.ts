/**
 * Bloomberg Email Processor
 *
 * Scans Gmail for Bloomberg newsletter emails, extracts article content,
 * and queues them for the content pipeline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { GmailService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

interface GmailMessage {
  id: string;
  threadId: string;
  from: {
    email: string;
    name?: string;
  };
  to: {
    email: string;
    name?: string;
  }[];
  cc?: {
    email: string;
    name?: string;
  }[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels: string[];
  isRead: boolean;
  isInbound: boolean;
}

// Bloomberg sender domain patterns
const BLOOMBERG_DOMAINS = [
  'bloomberg.com',
];

// Newsletter types we want to process
const NEWSLETTER_TYPES = [
  'Bloomberg Markets',
  'Bloomberg Businessweek',
  'Bloomberg Wealth',
  'Bloomberg Opinion',
  'Bloomberg Evening Briefing',
  'Bloomberg Morning Briefing',
  'Money Stuff', // Matt Levine's column
  'Odd Lots',
];

export interface BloombergArticle {
  headline: string;
  summary: string;
  content: string;
  author?: string;
  url?: string;
  newsletterType: string;
  receivedAt: Date;
  emailId: string;
}

export interface BloombergScanResult {
  scanTime: string;
  emailsFound: number;
  articlesExtracted: number;
  articlesQueued: number;
  errors: string[];
  articles: BloombergArticle[];
}

/**
 * Check if an email is from Bloomberg
 */
function isBloombergEmail(message: GmailMessage): boolean {
  const fromEmail = message.from.email.toLowerCase();
  return BLOOMBERG_DOMAINS.some((domain) => fromEmail.includes(domain));
}

/**
 * Identify the newsletter type from subject/sender
 */
function identifyNewsletterType(message: GmailMessage): string {
  const subject = message.subject.toLowerCase();
  const fromName = message.from.name?.toLowerCase() || '';

  for (const type of NEWSLETTER_TYPES) {
    if (subject.includes(type.toLowerCase()) || fromName.includes(type.toLowerCase())) {
      return type;
    }
  }

  // Check for Matt Levine's Money Stuff specifically
  if (subject.includes('money stuff') || fromName.includes('matt levine')) {
    return 'Money Stuff';
  }

  return 'Bloomberg Newsletter';
}

/**
 * Extract article content from Bloomberg email HTML
 * Uses Claude to intelligently parse the newsletter structure
 */
async function extractArticleContent(
  message: GmailMessage,
  anthropic: Anthropic
): Promise<BloombergArticle[]> {
  const content = message.bodyHtml || message.body;
  const newsletterType = identifyNewsletterType(message);

  // Use Claude to extract structured article data from the newsletter
  const extractionPrompt = `You are extracting article content from a Bloomberg newsletter email.

NEWSLETTER TYPE: ${newsletterType}
SUBJECT: ${message.subject}
DATE: ${message.date.toISOString()}

EMAIL CONTENT:
${content.substring(0, 15000)} ${content.length > 15000 ? '...[truncated]' : ''}

TASK:
Extract the main articles/stories from this newsletter. For each article, provide:
1. headline - The article title
2. summary - A 2-3 sentence summary of the key points
3. content - The full article text (cleaned of HTML, ads, navigation)
4. author - Author name if mentioned
5. url - Link to full article if available

Focus on substantive financial/business content. Skip:
- Promotional content
- Subscription CTAs
- Navigation links
- Social media links
- Footer content

Respond in JSON format only:
{
  "articles": [
    {
      "headline": "...",
      "summary": "...",
      "content": "...",
      "author": "...",
      "url": "..."
    }
  ]
}

If this is a single-article newsletter (like Money Stuff), return one article.
If it's a briefing with multiple stories, return up to 5 most relevant articles.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const responseText = response.content.find((c) => c.type === 'text')?.text || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Bloomberg] Failed to parse extraction response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const articles: BloombergArticle[] = [];

    for (const article of parsed.articles || []) {
      if (article.headline && article.content) {
        articles.push({
          headline: article.headline,
          summary: article.summary || article.content.substring(0, 200),
          content: article.content,
          author: article.author,
          url: article.url,
          newsletterType,
          receivedAt: message.date,
          emailId: message.id,
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('[Bloomberg] Extraction error:', error);
    return [];
  }
}

/**
 * Score an article for relevance to ArcVest content
 */
async function scoreArticle(
  article: BloombergArticle,
  anthropic: Anthropic
): Promise<{ score: number; reason: string; focusAngle?: string }> {
  const scoringPrompt = `You are evaluating Bloomberg articles for relevance to ArcVest's content strategy.

ABOUT ARCVEST:
ArcVest is a fee-only fiduciary RIA focused on evidence-based investing using globally diversified, low-cost portfolios. Our target audience is high-net-worth individuals who want sophisticated investment management without the conflicts of commission-based advisors.

TOPICS WE COVER:
- Evidence-based investing and academic research
- Index funds, ETFs, factor investing
- Retirement planning and portfolio management
- Tax-efficient investing strategies
- Market behavior and investor psychology
- Fee transparency and fiduciary duty
- Financial planning for HNW individuals

TOPICS TO AVOID:
- Crypto/blockchain promotion
- Individual stock picks
- Get-rich-quick schemes
- Day trading
- Speculative investments

ARTICLE TO EVALUATE:
Headline: ${article.headline}
Summary: ${article.summary}
Type: ${article.newsletterType}

TASK:
Score this article 0-100 for relevance to ArcVest's content. Consider:
- Does it relate to our core topics?
- Would our HNW audience find it valuable?
- Can we add our evidence-based perspective?
- Is it timely and actionable?

Respond in JSON only:
{
  "score": 0-100,
  "reason": "brief explanation",
  "focusAngle": "how ArcVest could approach this topic (if score >= 60)"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: scoringPrompt }],
    });

    const responseText = response.content.find((c) => c.type === 'text')?.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Bloomberg] Scoring error:', error);
  }

  return { score: 0, reason: 'Scoring failed' };
}

/**
 * Main scanner class
 */
export class BloombergProcessor {
  private gmailService: InstanceType<typeof GmailService>;
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    this.gmailService = new GmailService();
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * Scan Gmail for Bloomberg emails and process them
   */
  async scan(options?: {
    hoursBack?: number;
    minScore?: number;
    maxArticles?: number;
    autoQueue?: boolean;
    includeTrash?: boolean;
  }): Promise<BloombergScanResult> {
    const {
      hoursBack = 24,
      minScore = 60,
      maxArticles = 5,
      autoQueue = false,
      includeTrash = true, // Default to including trash
    } = options || {};

    console.log('[Bloomberg] Starting email scan...', { hoursBack, includeTrash });

    const result: BloombergScanResult = {
      scanTime: new Date().toISOString(),
      emailsFound: 0,
      articlesExtracted: 0,
      articlesQueued: 0,
      errors: [],
      articles: [],
    };

    try {
      // Check if Gmail is connected
      const isConnected = await this.gmailService.isConnected();
      if (!isConnected) {
        result.errors.push('Gmail not connected. Please connect Gmail first.');
        return result;
      }

      // Fetch Bloomberg emails directly using Gmail search (much more efficient)
      // Search for emails from bloomberg.com domain
      console.log(`[Bloomberg] Fetching emails with options:`, { includeTrash, hoursBack, fromFilter: 'from:bloomberg.com' });

      const messages = await this.gmailService.fetchNewMessages(50, {
        includeTrash,
        hoursBack,
        fromFilter: 'from:bloomberg.com',
      });

      console.log(`[Bloomberg] Gmail returned ${messages.length} messages`);

      // Double-check they're actually Bloomberg emails (the Gmail filter should handle this)
      const bloombergEmails = messages.filter(isBloombergEmail);
      result.emailsFound = bloombergEmails.length;

      console.log(`[Bloomberg] After filter: ${bloombergEmails.length} Bloomberg emails`);

      if (bloombergEmails.length === 0) {
        return result;
      }

      // Extract articles from each email (time filtering already done in fetchNewMessages)
      const allArticles: BloombergArticle[] = [];

      for (const email of bloombergEmails) {
        try {
          const articles = await extractArticleContent(email, this.anthropic);
          allArticles.push(...articles);
          console.log(
            `[Bloomberg] Extracted ${articles.length} articles from: ${email.subject}`
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Extraction failed for ${email.id}: ${errorMsg}`);
        }
      }

      result.articlesExtracted = allArticles.length;

      // Score and filter articles
      const scoredArticles: Array<BloombergArticle & { score: number; focusAngle?: string }> =
        [];

      for (const article of allArticles) {
        const scoring = await scoreArticle(article, this.anthropic);
        if (scoring.score >= minScore) {
          scoredArticles.push({
            ...article,
            score: scoring.score,
            focusAngle: scoring.focusAngle,
          });
        }
      }

      // Sort by score and limit
      scoredArticles.sort((a, b) => b.score - a.score);
      const topArticles = scoredArticles.slice(0, maxArticles);

      result.articles = topArticles;

      // Queue articles for pipeline if autoQueue is true
      if (autoQueue && topArticles.length > 0) {
        for (const article of topArticles) {
          try {
            await this.queueForPipeline(article);
            result.articlesQueued++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Queue failed for ${article.headline}: ${errorMsg}`);
          }
        }
      }

      console.log(
        `[Bloomberg] Scan complete. ${result.articlesExtracted} extracted, ${result.articlesQueued} queued.`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Scan failed: ${errorMsg}`);
      console.error('[Bloomberg] Scan error:', error);
    }

    return result;
  }

  /**
   * Queue an article for the content pipeline
   */
  private async queueForPipeline(
    article: BloombergArticle & { focusAngle?: string }
  ): Promise<void> {
    // Create content calendar entry
    const { error: calendarError } = await (this.supabase as any).from('content_calendar').insert({
      title: article.headline,
      content_type: 'blog_post',
      status: 'idea',
      scheduled_date: null,
      topic: `Source: Bloomberg ${article.newsletterType} | Author: ${article.author || 'Unknown'}`,
      outline: `Focus Angle: ${article.focusAngle || 'To be determined'}

Original Summary:
${article.summary}

Full Content:
${article.content.substring(0, 5000)}`,
      metadata: {
        source: 'bloomberg',
        newsletter_type: article.newsletterType,
        bloomberg_url: article.url,
        author: article.author,
        received_at: article.receivedAt.toISOString(),
        email_id: article.emailId,
      },
    });

    if (calendarError) {
      throw new Error(`Failed to create calendar entry: ${calendarError.message}`);
    }

    // Also add to approval queue for review
    await (this.supabase as any).from('approval_queue').insert({
      type: 'content_idea',
      title: `Bloomberg Story: ${article.headline}`,
      summary: `New content idea from Bloomberg ${article.newsletterType}. ${article.focusAngle ? `Suggested Angle: ${article.focusAngle}` : ''} Summary: ${article.summary}`,
      status: 'pending',
      priority: 'medium',
      created_by: 'bloomberg_agent',
      content: {
        source: 'bloomberg',
        headline: article.headline,
        url: article.url,
        focus_angle: article.focusAngle,
        newsletter_type: article.newsletterType,
        full_summary: article.summary,
      },
    });

    console.log(`[Bloomberg] Queued: ${article.headline}`);
  }
}

// Export singleton factory
let processorInstance: BloombergProcessor | null = null;

export function getBloombergProcessor(): BloombergProcessor {
  if (!processorInstance) {
    processorInstance = new BloombergProcessor();
  }
  return processorInstance;
}
