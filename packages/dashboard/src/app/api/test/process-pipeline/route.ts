/**
 * Test Endpoint: Process Pipeline
 *
 * POST /api/test/process-pipeline
 *
 * Takes selected ideas and runs them through the 4-AI content pipeline.
 * Creates content_calendar entries and WordPress drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMultiAIPipeline } from '@/lib/content-pipeline';

interface ProcessedIdea {
  ideaId: string;
  title: string;
  success: boolean;
  contentId?: string;
  error?: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '8', 10);
  const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  console.log(`[Pipeline Test] Processing up to ${limit} ideas for ${dateStr}`);

  try {
    const supabase = await createClient();

    // Get selected ideas for the date
    const { data: selectedIdeas, error: fetchError } = await supabase
      .from('idea_queue')
      .select('id, title, source_name, full_content, suggested_angle, relevance_score, selection_rank')
      .eq('status', 'selected')
      .eq('selected_for_date', dateStr)
      .order('selection_rank', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!selectedIdeas || selectedIdeas.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No selected ideas found for ${dateStr}. Run select-daily first.`,
      });
    }

    console.log(`[Pipeline Test] Found ${selectedIdeas.length} ideas to process`);

    const results: ProcessedIdea[] = [];
    const pipeline = getMultiAIPipeline();

    for (const idea of selectedIdeas) {
      console.log(`[Pipeline Test] Processing: "${idea.title}" (rank ${idea.selection_rank})`);

      try {
        // Build input for pipeline
        const inputContent = buildPipelineInput(idea);

        // Run through 4-AI pipeline
        const pipelineResult = await pipeline.run({
          content: inputContent,
          inputType: 'raw_text',
          focusAngle: idea.suggested_angle || undefined,
        });

        // Extract title from output
        const finalTitle = extractTitle(pipelineResult.finalOutput.wordpressPost) || idea.title;

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
              suggested_angle: idea.suggested_angle,
              pipeline_result: {
                claudeComplianceCheck: pipelineResult.claudeDraft.complianceCheck,
                chatgptImprovements: pipelineResult.chatgptDraft.improvements,
                geminiEdits: pipelineResult.geminiDraft.edits,
                illustrationPrompt: pipelineResult.finalOutput.illustrationPrompt,
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

        // Add to approval queue
        await supabase.from('approval_queue').insert({
          type: 'blog_post',
          title: finalTitle,
          summary: `Pipeline generated from ${idea.source_name}. Score: ${idea.relevance_score}. ${pipelineResult.metadata.totalTokensUsed} tokens.`,
          content: {
            contentId: contentEntry?.id,
            ideaId: idea.id,
            excerpt: pipelineResult.finalOutput.excerpt,
            seoTags: pipelineResult.finalOutput.seoTags,
            illustrationPrompt: pipelineResult.finalOutput.illustrationPrompt,
          },
          status: 'pending',
          priority: idea.selection_rank <= 3 ? 'high' : 'medium',
          submitted_by: 'content_pipeline',
        });

        results.push({
          ideaId: idea.id,
          title: finalTitle,
          success: true,
          contentId: contentEntry?.id,
        });

        console.log(`[Pipeline Test] ✓ Processed "${finalTitle}" -> content_calendar ${contentEntry?.id}`);

      } catch (ideaError) {
        const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
        console.error(`[Pipeline Test] ✗ Failed "${idea.title}":`, errorMsg);

        // Mark idea as failed (use rejected status and store error in metadata)
        await supabase
          .from('idea_queue')
          .update({
            status: 'rejected',
            metadata: { processing_error: errorMsg },
            updated_at: new Date().toISOString(),
          })
          .eq('id', idea.id);

        results.push({
          ideaId: idea.id,
          title: idea.title,
          success: false,
          error: errorMsg,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(`[Pipeline Test] Complete: ${successCount} success, ${failCount} failed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: failCount,
      durationMs: duration,
      results,
    });

  } catch (error) {
    console.error('[Pipeline Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

/**
 * Build input content for the pipeline from an idea
 */
function buildPipelineInput(idea: {
  title: string;
  full_content: string | null;
  source_name: string;
  suggested_angle: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`TOPIC: ${idea.title}`);
  parts.push(`SOURCE: ${idea.source_name}`);

  if (idea.full_content) {
    parts.push('');
    parts.push('SOURCE CONTENT:');
    parts.push(idea.full_content);
  }

  if (idea.suggested_angle) {
    parts.push('');
    parts.push(`SUGGESTED ANGLE: ${idea.suggested_angle}`);
  }

  return parts.join('\n');
}

/**
 * Extract title from WordPress HTML
 */
function extractTitle(html: string): string | null {
  // Try to find H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '').trim();

  // Try markdown H1
  const mdH1Match = html.match(/^#\s+(.+)$/m);
  if (mdH1Match) return mdH1Match[1].trim();

  return null;
}
