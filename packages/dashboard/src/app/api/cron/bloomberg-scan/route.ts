/**
 * Bloomberg Email Cron Scan
 *
 * Scheduled to run daily at 7:00am CT (13:00 UTC)
 * Scans Gmail for Bloomberg newsletters and queues content for pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBloombergProcessor } from '@/lib/bloomberg';

/**
 * GET /api/cron/bloomberg-scan
 * Called by Vercel Cron at 7:00am CT daily
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Bloomberg Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Bloomberg Cron] Starting scheduled scan...');

  try {
    const processor = getBloombergProcessor();

    // Run scan with auto-queue enabled
    const result = await processor.scan({
      hoursBack: 24, // Last 24 hours
      minScore: 60, // Minimum relevance score
      maxArticles: 5, // Top 5 articles
      autoQueue: true, // Auto-queue to content calendar
    });

    console.log('[Bloomberg Cron] Scan complete:', {
      emailsFound: result.emailsFound,
      articlesExtracted: result.articlesExtracted,
      articlesQueued: result.articlesQueued,
      errors: result.errors.length,
    });

    // Log to activity log if we have Supabase
    if (result.articlesQueued > 0) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        await supabase.from('activity_log').insert({
          type: 'system',
          action: 'bloomberg_scan_complete',
          description: `Queued ${result.articlesQueued} Bloomberg articles for content pipeline`,
          metadata: {
            emails_found: result.emailsFound,
            articles_extracted: result.articlesExtracted,
            articles_queued: result.articlesQueued,
            top_articles: result.articles.map((a) => a.headline),
          },
        });
      } catch (logError) {
        console.warn('[Bloomberg Cron] Failed to log activity:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: result.scanTime,
      emailsFound: result.emailsFound,
      articlesExtracted: result.articlesExtracted,
      articlesQueued: result.articlesQueued,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Bloomberg Cron] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bloomberg cron scan failed',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max
