import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;
  const level = searchParams.get('level');
  const jobType = searchParams.get('job_type');
  const jobId = searchParams.get('job_id');
  const hours = parseInt(searchParams.get('hours') || '24');
  const limit = parseInt(searchParams.get('limit') || '200');

  try {
    // Calculate time filter
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('pipeline_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (level && level !== 'all') {
      query = query.eq('level', level);
    }
    if (jobType && jobType !== 'all') {
      query = query.eq('job_type', jobType);
    }
    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('pipeline_logs')
      .select('level, job_type')
      .gte('created_at', since);

    const summary = {
      total: stats?.length || 0,
      byLevel: {
        error: stats?.filter(l => l.level === 'error').length || 0,
        warn: stats?.filter(l => l.level === 'warn').length || 0,
        info: stats?.filter(l => l.level === 'info').length || 0,
        debug: stats?.filter(l => l.level === 'debug').length || 0,
      },
      byType: {} as Record<string, number>,
    };

    stats?.forEach(l => {
      if (l.job_type) {
        summary.byType[l.job_type] = (summary.byType[l.job_type] || 0) + 1;
      }
    });

    return NextResponse.json({
      logs,
      summary,
      filters: { level, jobType, jobId, hours, limit },
    });

  } catch (error) {
    console.error('[Logs API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
