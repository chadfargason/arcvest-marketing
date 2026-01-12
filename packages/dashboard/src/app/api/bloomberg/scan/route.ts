/**
 * Bloomberg Email Scan API
 *
 * GET: Run a manual scan of Gmail for Bloomberg content
 * POST: Run scan with options (auto-queue, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

// Bloomberg sender patterns
const BLOOMBERG_SENDERS = [
  '@bloomberg.com',
  '@mail.bloomberg.com',
  '@newsletters.bloomberg.com',
];

/**
 * GET /api/bloomberg/scan
 * Run a quick scan for Bloomberg emails
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hoursBack') || '24');

    console.log('[Bloomberg Scan] Starting with hoursBack:', hoursBack);

    const gmailService = new GmailService();

    const isConnected = await gmailService.isConnected();
    console.log('[Bloomberg Scan] Gmail connected:', isConnected);

    if (!isConnected) {
      return NextResponse.json({
        scanTime: new Date().toISOString(),
        emailsFound: 0,
        articlesExtracted: 0,
        articlesQueued: 0,
        errors: ['Gmail not connected'],
        articles: [],
      });
    }

    // Fetch Bloomberg emails directly
    const messages = await gmailService.fetchNewMessages(50, {
      includeTrash: true,
      hoursBack,
      fromFilter: 'from:bloomberg.com',
    });

    console.log('[Bloomberg Scan] Got messages:', messages.length);

    // Filter for actual Bloomberg emails
    const bloombergEmails = messages.filter(msg => {
      const fromEmail = msg.from.email.toLowerCase();
      return BLOOMBERG_SENDERS.some(pattern => fromEmail.includes(pattern.toLowerCase()));
    });

    console.log('[Bloomberg Scan] Bloomberg emails:', bloombergEmails.length);

    return NextResponse.json({
      scanTime: new Date().toISOString(),
      emailsFound: bloombergEmails.length,
      articlesExtracted: 0, // TODO: Add extraction
      articlesQueued: 0,
      errors: [],
      articles: bloombergEmails.map(e => ({
        headline: e.subject,
        from: e.from.email,
        fromName: e.from.name,
        date: e.date,
      })),
    });
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bloomberg/scan
 * Run scan with custom options (same as GET for now)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { hoursBack = 24 } = body;

    console.log('[Bloomberg Scan POST] Starting with hoursBack:', hoursBack);

    const gmailService = new GmailService();

    const isConnected = await gmailService.isConnected();
    if (!isConnected) {
      return NextResponse.json({
        scanTime: new Date().toISOString(),
        emailsFound: 0,
        articlesExtracted: 0,
        articlesQueued: 0,
        errors: ['Gmail not connected'],
        articles: [],
      });
    }

    // Fetch Bloomberg emails directly
    const messages = await gmailService.fetchNewMessages(50, {
      includeTrash: true,
      hoursBack,
      fromFilter: 'from:bloomberg.com',
    });

    // Filter for actual Bloomberg emails
    const bloombergEmails = messages.filter(msg => {
      const fromEmail = msg.from.email.toLowerCase();
      return BLOOMBERG_SENDERS.some(pattern => fromEmail.includes(pattern.toLowerCase()));
    });

    return NextResponse.json({
      scanTime: new Date().toISOString(),
      emailsFound: bloombergEmails.length,
      articlesExtracted: 0,
      articlesQueued: 0,
      errors: [],
      articles: bloombergEmails.map(e => ({
        headline: e.subject,
        from: e.from.email,
        fromName: e.from.name,
        date: e.date,
      })),
    });
  } catch (error) {
    console.error('[Bloomberg API] Scan failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Bloomberg scan failed',
      },
      { status: 500 }
    );
  }
}
