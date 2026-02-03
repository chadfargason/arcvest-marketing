import { NextRequest, NextResponse } from 'next/server';
import { getMultiAIPipeline } from '@/lib/content-pipeline';
import { createClient } from '@/lib/supabase/server';

// POST /api/content/pipeline - Run the full 4-AI content pipeline
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { content, inputType, focusAngle, targetKeywords } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required. Provide a news article or topic prompt.' },
        { status: 400 }
      );
    }

    // Check API keys are configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY not configured' }, { status: 500 });
    }

    console.log('[Pipeline API] Starting pipeline...');

    // Run the pipeline
    const pipeline = getMultiAIPipeline();
    const result = await pipeline.run({
      content,
      inputType: inputType || 'raw_text',
      focusAngle,
      targetKeywords,
    });

    console.log(`[Pipeline API] Pipeline complete in ${Date.now() - startTime}ms`);

    // Optionally save to approval queue
    try {
      const supabase = await createClient();

      // Create content calendar entry
      const { data: contentEntry, error: contentError } = await supabase
        .from('content_calendar')
        .insert({
          title: extractTitle(result.finalOutput.wordpressPost) || 'AI Generated Post',
          content_type: 'blog_post',
          status: 'review',
          topic: content.substring(0, 200),
          draft: result.geminiDraft.content,
          final_content: result.finalOutput.wordpressPost,
          meta_description: result.finalOutput.excerpt,
          keywords: result.finalOutput.seoTags,
          metadata: {
            pipeline_result: {
              originalInput: result.originalInput.substring(0, 500),
              claudeComplianceCheck: result.claudeDraft.complianceCheck,
              chatgptImprovements: result.chatgptDraft.improvements,
              geminiEdits: result.geminiDraft.edits,
              illustrationPrompt: result.finalOutput.illustrationPrompt,
              processingTimeMs: result.metadata.processingTimeMs,
              totalTokensUsed: result.metadata.totalTokensUsed,
            },
          },
        })
        .select('id')
        .single();

      if (contentError) {
        console.error('[Pipeline API] Failed to save to content calendar:', contentError);
      } else {
        console.log('[Pipeline API] Saved to content calendar:', contentEntry?.id);

        // Also add to approval queue
        await supabase.from('approval_queue').insert({
          type: 'blog_post',
          title: extractTitle(result.finalOutput.wordpressPost) || 'AI Generated Blog Post',
          summary: `4-AI Pipeline generated post. ${result.metadata.totalTokensUsed} tokens used.`,
          content: {
            contentId: contentEntry?.id,
            excerpt: result.finalOutput.excerpt,
            seoTags: result.finalOutput.seoTags,
            illustrationPrompt: result.finalOutput.illustrationPrompt,
          },
          status: 'pending',
          priority: 'medium',
          submitted_by: 'content_pipeline',
        });
      }
    } catch (dbError) {
      console.error('[Pipeline API] Database error:', dbError);
      // Continue - still return the result even if DB save fails
    }

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('[Pipeline API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    );
  }
}

// Helper to extract title from HTML
function extractTitle(html: string): string | null {
  // Try to find H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '').trim();

  // Try markdown H1
  const mdH1Match = html.match(/^#\s+(.+)$/m);
  if (mdH1Match) return mdH1Match[1].trim();

  return null;
}
