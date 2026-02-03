import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/agents - Get agent status
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get agent status from agent_status table
    const { data: agentStatus, error: statusError } = await supabase
      .from('agent_status')
      .select('*')
      .order('last_heartbeat', { ascending: false });

    if (statusError) {
      console.error('Error fetching agent status:', statusError);
    }

    // Get recent agent tasks
    const { data: recentTasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (tasksError) {
      console.error('Error fetching agent tasks:', tasksError);
    }

    // Get scheduled job logs
    const { data: jobLogs, error: logsError } = await supabase
      .from('scheduled_job_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (logsError) {
      console.error('Error fetching job logs:', logsError);
    }

    // Get task summary by agent
    const { data: taskSummary } = await supabase
      .from('agent_task_summary')
      .select('*');

    return NextResponse.json({
      agents: agentStatus || [],
      recentTasks: recentTasks || [],
      jobLogs: jobLogs || [],
      taskSummary: taskSummary || [],
    });
  } catch (error) {
    console.error('Error in GET /api/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
