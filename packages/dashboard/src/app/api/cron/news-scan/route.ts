import { NextRequest, NextResponse } from 'next/server';
import { runNewsScan } from '@/lib/news-sourcer';
import { createClient } from '@/lib/supabase/server';

/**
 * Cron endpoint for daily news scan
 * Triggered by Vercel Cron at 6:30am CT (12:30 UTC)
 *
 * GET /api/cron/news-scan
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron News Scan] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron News Scan] Starting scheduled news scan...');

  try {
    // Run the news scan
    const result = await runNewsScan({
      highPriorityOnly: false, // Full scan for scheduled runs
      hoursBack: 24,
      minScore: 65, // Slightly higher threshold for auto-processing
      maxToSelect: 3, // Top 3 stories
    });

    console.log(`[Cron News Scan] Found ${result.selectedStories.length} relevant stories`);

    // Save results to database
    const supabase = await createClient();

    // Log the scan
    await supabase.from('activity_log').insert({
      type: 'news_scan',
      description: `Daily news scan completed. Found ${result.articlesFound} articles, selected ${result.selectedStories.length}.`,
      metadata: {
        articlesFound: result.articlesFound,
        articlesScored: result.articlesScored,
        selectedCount: result.selectedStories.length,
        processingTimeMs: result.processingTimeMs,
        topStories: result.selectedStories.map(s => ({
          title: s.title,
          source: s.sourceName,
          score: s.relevanceScore,
        })),
      },
    });

    // Add selected stories to content calendar as ideas
    for (const story of result.selectedStories) {
      await supabase.from('content_calendar').insert({
        title: story.suggestedAngle || story.title,
        content_type: 'blog_post',
        status: 'idea',
        topic: story.title,
        target_keyword: story.suggestedKeywords?.[0] || null,
        metadata: {
          source_article: {
            title: story.title,
            source: story.sourceName,
            link: story.link,
            pubDate: story.pubDate,
            relevanceScore: story.relevanceScore,
            relevanceReason: story.relevanceReason,
            suggestedAngle: story.suggestedAngle,
            suggestedKeywords: story.suggestedKeywords,
          },
        },
      });
    }

    // Also add to approval queue if we want human review
    if (result.selectedStories.length > 0) {
      await supabase.from('approval_queue').insert({
        type: 'news_stories',
        title: `Daily News Scan - ${result.selectedStories.length} stories selected`,
        summary: `Top story: "${result.selectedStories[0].title}" (score: ${result.selectedStories[0].relevanceScore})`,
        content: {
          scanTime: result.scanTime,
          stories: result.selectedStories.map(s => ({
            title: s.title,
            source: s.sourceName,
            link: s.link,
            score: s.relevanceScore,
            reason: s.relevanceReason,
            angle: s.suggestedAngle,
            keywords: s.suggestedKeywords,
          })),
        },
        status: 'pending',
        priority: 'medium',
        submitted_by: 'news_scanner_cron',
      });
    }

    console.log('[Cron News Scan] Results saved to database');

    return NextResponse.json({
      success: true,
      message: `Scan complete. ${result.selectedStories.length} stories queued.`,
      result: {
        scanTime: result.scanTime,
        articlesFound: result.articlesFound,
        selectedCount: result.selectedStories.length,
        topStory: result.selectedStories[0]?.title || 'None',
      },
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Cron News Scan] Error:', error);

    // Log error to database
    try {
      const supabase = await createClient();
      await supabase.from('activity_log').insert({
        type: 'news_scan_error',
        description: `Daily news scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      });
    } catch {
      // Ignore DB logging errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
