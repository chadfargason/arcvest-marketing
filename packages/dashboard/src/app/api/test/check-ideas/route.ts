/**
 * Test Endpoint: Check Ideas
 * 
 * GET /api/test/check-ideas
 * 
 * Shows what ideas are in the queue and their scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get recent scored ideas
    const { data: scoredIdeas, error: scoredError } = await supabase
      .from('idea_queue')
      .select('id, title, source_name, status, relevance_score, created_at')
      .eq('status', 'scored')
      .order('relevance_score', { ascending: false })
      .limit(20);

    // Get all ideas from today
    const { data: todayIdeas, error: todayError } = await supabase
      .from('idea_queue')
      .select('id, title, source_name, status, relevance_score, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });

    // Count by status
    const statusCounts = todayIdeas?.reduce((acc, idea) => {
      acc[idea.status] = (acc[idea.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      summary: {
        todayTotal: todayIdeas?.length || 0,
        scoredAvailable: scoredIdeas?.length || 0,
        statusBreakdown: statusCounts,
        topScore: scoredIdeas?.[0]?.relevance_score || 0
      },
      topScoredIdeas: scoredIdeas?.slice(0, 10).map(i => ({
        title: i.title,
        source: i.source_name,
        score: i.relevance_score,
        created: i.created_at
      })),
      todayIdeas: todayIdeas?.map(i => ({
        title: i.title,
        source: i.source_name,
        status: i.status,
        score: i.relevance_score,
        created: i.created_at
      }))
    });

  } catch (error) {
    console.error('[Check Ideas] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
