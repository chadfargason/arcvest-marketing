/**
 * Cron Job: Email Scan
 *
 * GET /api/cron/email-scan
 *
 * Scans all email sources for new content ideas.
 * Scheduled: Daily at 12:00 PM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSourceRegistry, initializeAdapters } from '@arcvest/services';

interface FetchResult {
  success: boolean;
  ideas: Array<{
    title: string;
    summary?: string;
    rawContent: string;
    sourceId: string;
    sourceUrl: string;
    publishedAt?: Date;
    author?: string;
    hash: string;
  }>;
  error?: string;
  fetchedAt: Date;
  duration: number;
}

export const maxDuration = 300; // 5 minutes max
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting email scan...');

  try {
    // Initialize adapters
    initializeAdapters();
    const registry = getSourceRegistry();

    // Fetch from all email sources
    const results = await registry.fetchEmailSources();

    // Aggregate stats from the Map
    let totalIdeas = 0;
    let successfulSources = 0;
    let failedSources = 0;

    results.forEach((result: FetchResult) => {
      if (result.success) {
        successfulSources++;
        totalIdeas += result.ideas.length;
      } else {
        failedSources++;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[Cron] Email scan complete in ${duration}ms: ${totalIdeas} ideas from ${successfulSources} sources`);

    return NextResponse.json({
      success: true,
      duration,
      totalIdeas,
      successfulSources,
      failedSources,
      sources: Array.from(results.entries()).map(([sourceId, result]: [string, FetchResult]) => ({
        sourceId,
        success: result.success,
        ideasFound: result.ideas.length,
        error: result.error,
      })),
    });
  } catch (error) {
    console.error('[Cron] Email scan error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
