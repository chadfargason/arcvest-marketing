/**
 * Test Endpoint: Create Pipeline Jobs
 * 
 * GET /api/test/create-pipeline-jobs
 * 
 * Creates process_pipeline jobs for today's selected ideas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const dateStr = new Date().toISOString().split('T')[0];

    // Get today's selected ideas
    const { data: selectedIdeas, error: fetchError } = await supabase
      .from('idea_queue')
      .select('id, title, selection_rank')
      .eq('status', 'selected')
      .eq('selected_for_date', dateStr)
      .order('selection_rank', { ascending: true });

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!selectedIdeas || selectedIdeas.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No selected ideas for today'
      });
    }

    console.log(`[Create Pipeline Jobs] Found ${selectedIdeas.length} selected ideas`);

    // Create pipeline jobs for each selected idea
    const pipelineJobs = selectedIdeas.map((idea, index) => ({
      job_type: 'process_pipeline',
      payload: { idea_id: idea.id, title: idea.title },
      priority: 5 - index, // Higher priority for higher-ranked ideas
      max_attempts: 5,
      status: 'pending',
      next_run_at: new Date().toISOString()
    }));

    const { data: createdJobs, error: insertError } = await supabase
      .from('job_queue')
      .insert(pipelineJobs)
      .select('id, job_type, payload');

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 500 });
    }

    console.log(`[Create Pipeline Jobs] Created ${createdJobs.length} pipeline jobs`);

    return NextResponse.json({
      success: true,
      created: createdJobs.length,
      jobs: createdJobs.map(j => ({
        id: j.id,
        ideaTitle: (j.payload as { title?: string }).title
      })),
      message: `Created ${createdJobs.length} pipeline jobs. Now trigger /api/test/trigger-worker to process them.`
    });

  } catch (error) {
    console.error('[Create Pipeline Jobs] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
