/**
 * Test Endpoint: Check Pipeline Status
 * 
 * GET /api/test/check-pipeline-status
 * 
 * Shows current status of jobs and content ideas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get job queue status
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('id, job_type, status, attempts, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get today's selected ideas
    const { data: selectedIdeas, error: ideasError } = await supabase
      .from('idea_queue')
      .select('id, title, status, relevance_score, selection_rank')
      .eq('selected_for_date', today)
      .order('selection_rank', { ascending: true });

    // Get recent content created
    const { data: recentContent, error: contentError } = await supabase
      .from('content_calendar')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Count pending jobs by type
    const pendingJobs = jobs?.filter(j => j.status === 'pending') || [];
    const processingJobs = jobs?.filter(j => j.status === 'processing') || [];
    const completedJobs = jobs?.filter(j => j.status === 'completed') || [];
    const failedJobs = jobs?.filter(j => j.status === 'failed') || [];

    return NextResponse.json({
      success: true,
      date: today,
      summary: {
        jobs: {
          pending: pendingJobs.length,
          processing: processingJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          total: jobs?.length || 0
        },
        ideas: {
          selectedToday: selectedIdeas?.length || 0,
          byStatus: selectedIdeas?.reduce((acc, idea) => {
            acc[idea.status] = (acc[idea.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        content: {
          recentlyCreated: recentContent?.length || 0
        }
      },
      details: {
        pendingJobs: pendingJobs.map(j => ({ id: j.id, type: j.job_type, attempts: j.attempts })),
        selectedIdeas: selectedIdeas?.map(i => ({ 
          id: i.id, 
          title: i.title, 
          status: i.status, 
          score: i.relevance_score,
          rank: i.selection_rank 
        })),
        recentContent: recentContent?.map(c => ({ 
          id: c.id, 
          title: c.title, 
          status: c.status,
          created: c.created_at
        })),
        allJobs: jobs?.map(j => ({ 
          id: j.id, 
          type: j.job_type, 
          status: j.status, 
          attempts: j.attempts,
          created: j.created_at
        }))
      }
    });

  } catch (error) {
    console.error('[Check Status] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
