/**
 * Cron Job: Process Pipeline
 *
 * GET /api/cron/process-pipeline
 *
 * Processes selected ideas through the 4-AI content pipeline.
 * Scheduled: Daily at 2:30 PM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMultiAIPipeline } from '@/lib/content-pipeline';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const dateStr = new Date().toISOString().split('T')[0] || '';
  console.log(`[Cron] Starting pipeline processing for ${dateStr}...`);

  try {
    const supabase = await createClient();

    // Get selected ideas for today
    const { data: selectedIdeas, error: fetchError } = await supabase
      .from('idea_queue')
      .select('id, title, source_name, full_content, suggested_angle, relevance_score, selection_rank')
      .eq('status', 'selected')
      .eq('selected_for_date', dateStr)
      .order('selection_rank', { ascending: true })
      .limit(8);

    if (fetchError) {
      throw fetchError;
    }

    if (!selectedIdeas || selectedIdeas.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No selected ideas for today',
        processed: 0,
      });
    }

    console.log(`[Cron] Found ${selectedIdeas.length} ideas to process`);

    const pipeline = getMultiAIPipeline();
    let processed = 0;
    let failed = 0;

    for (const idea of selectedIdeas) {
      console.log(`[Cron] Processing: "${idea.title}"`);

      try {
        // Build input
        const inputContent = [
          `TOPIC: ${idea.title}`,
          `SOURCE: ${idea.source_name}`,
          idea.full_content ? `\nSOURCE CONTENT:\n${idea.full_content}` : '',
          idea.suggested_angle ? `\nSUGGESTED ANGLE: ${idea.suggested_angle}` : '',
        ].filter(Boolean).join('\n');

        // Run pipeline
        const pipelineResult = await pipeline.run({
          content: inputContent,
          inputType: 'raw_text',
          focusAngle: idea.suggested_angle || undefined,
        });

        // Extract title
        const h1Match = pipelineResult.finalOutput.wordpressPost.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const finalTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : idea.title;

        // Save to content_calendar
        const { data: contentEntry, error: contentError } = await supabase
          .from('content_calendar')
          .insert({
            title: finalTitle,
            content_type: 'blog_post',
            status: 'review',
            topic: idea.title,
            draft: pipelineResult.geminiDraft.content,
            final_content: pipelineResult.finalOutput.wordpressPost,
            meta_description: pipelineResult.finalOutput.excerpt,
            keywords: pipelineResult.finalOutput.seoTags,
            idea_queue_id: idea.id,
            generation_method: 'automated',
            metadata: {
              source_name: idea.source_name,
              relevance_score: idea.relevance_score,
              pipeline_stats: {
                processingTimeMs: pipelineResult.metadata.processingTimeMs,
                totalTokensUsed: pipelineResult.metadata.totalTokensUsed,
              },
            },
          })
          .select('id')
          .single();

        if (contentError) {
          throw contentError;
        }

        // Update idea status
        await supabase
          .from('idea_queue')
          .update({
            status: 'completed',
            content_calendar_id: contentEntry?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', idea.id);

        processed++;
        console.log(`[Cron] ✓ Processed "${finalTitle}"`);

      } catch (ideaError) {
        const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
        console.error(`[Cron] ✗ Failed "${idea.title}":`, errorMsg);

        await supabase
          .from('idea_queue')
          .update({
            status: 'rejected',
            metadata: { processing_error: errorMsg },
            updated_at: new Date().toISOString(),
          })
          .eq('id', idea.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Cron] Pipeline complete in ${duration}ms: ${processed} processed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      duration,
      processed,
      failed,
      total: selectedIdeas.length,
    });

  } catch (error) {
    console.error('[Cron] Pipeline error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
