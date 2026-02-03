import { NextRequest, NextResponse } from 'next/server';
import { runNewsScan, runQuickScan } from '@/lib/news-sourcer';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/news/scan - Run a news scan and return results
 * Query params:
 *   - quick=true: Run quick scan (high priority only)
 *   - hoursBack: Hours to look back (default 24)
 *   - minScore: Minimum relevance score (default 60)
 *   - maxToSelect: Max stories to select (default 5)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const quick = searchParams.get('quick') === 'true';
    const hoursBack = parseInt(searchParams.get('hoursBack') || '24', 10);
    const minScore = parseInt(searchParams.get('minScore') || '60', 10);
    const maxToSelect = parseInt(searchParams.get('maxToSelect') || '5', 10);

    console.log('[News Scan API] Starting scan...');

    const result = quick
      ? await runQuickScan()
      : await runNewsScan({ hoursBack, minScore, maxToSelect });

    // Optionally save selected stories to database for later processing
    if (result.selectedStories.length > 0) {
      try {
        const supabase = await createClient();

        // Save to a news_queue table (create if needed via migration)
        // For now, just log
        console.log(`[News Scan API] Would queue ${result.selectedStories.length} stories for processing`);

        // You could also auto-trigger the content pipeline here
        // await triggerPipeline(result.selectedStories[0]);
      } catch (dbError) {
        console.error('[News Scan API] Database error:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      result,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[News Scan API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news/scan - Run scan and optionally auto-process top story
 * Body:
 *   - autoProcess: boolean - Automatically run top story through pipeline
 *   - quick: boolean
 *   - hoursBack: number
 *   - minScore: number
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { autoProcess = false, quick = false, hoursBack = 24, minScore = 60 } = body;

    console.log('[News Scan API] Starting scan (POST)...');

    const result = quick
      ? await runQuickScan()
      : await runNewsScan({ hoursBack, minScore });

    let pipelineResult = null;

    // Auto-process top story if requested
    if (autoProcess && result.selectedStories.length > 0) {
      const topStory = result.selectedStories[0];

      console.log(`[News Scan API] Auto-processing: "${topStory.title}"`);

      // Call the pipeline API internally
      const pipelineResponse = await fetch(new URL('/api/content/pipeline', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `NEWS ARTICLE: ${topStory.title}\n\nSOURCE: ${topStory.sourceName}\n\n${topStory.description}\n\n${topStory.content || ''}`,
          inputType: 'news_article',
          focusAngle: topStory.suggestedAngle,
          targetKeywords: topStory.suggestedKeywords,
        }),
      });

      if (pipelineResponse.ok) {
        pipelineResult = await pipelineResponse.json();
        console.log('[News Scan API] Pipeline processing complete');
      } else {
        console.error('[News Scan API] Pipeline failed:', await pipelineResponse.text());
      }
    }

    return NextResponse.json({
      success: true,
      result,
      pipelineResult,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[News Scan API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
