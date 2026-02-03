import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/dashboard/stats - Get dashboard statistics
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get total leads count
    const { count: totalLeads } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Get hot leads (score >= 70)
    const { data: hotLeadsData, count: hotLeadsCount } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, lead_score, status, last_activity_at', { count: 'exact' })
      .is('deleted_at', null)
      .gte('lead_score', 70)
      .not('status', 'in', '("client","closed_lost")')
      .order('lead_score', { ascending: false })
      .limit(5);

    // Get tasks due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: tasksDueToday } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('due_date', today.toISOString())
      .lt('due_date', tomorrow.toISOString());

    // Get overdue tasks
    const { count: overdueTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('due_date', today.toISOString());

    // Get pending approvals
    const { count: pendingApprovals } = await supabase
      .from('approval_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get urgent approvals (over 48 hours old)
    const urgentThreshold = new Date();
    urgentThreshold.setHours(urgentThreshold.getHours() - 48);
    const { count: urgentApprovals } = await supabase
      .from('approval_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', urgentThreshold.toISOString());

    // Get recent tasks
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, due_date, priority, status,
        contact:contacts(id, first_name, last_name)
      `)
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5);

    // Get leads this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: leadsThisWeek } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', weekAgo.toISOString());

    // Get pipeline stats (contacts by status)
    const { data: pipelineStats } = await supabase
      .from('contacts')
      .select('status')
      .is('deleted_at', null);

    const statusCounts = pipelineStats?.reduce((acc: Record<string, number>, contact) => {
      acc[contact.status] = (acc[contact.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate conversion rate (clients / total leads, last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentLeadsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: recentClientsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'client')
      .gte('status_changed_at', thirtyDaysAgo.toISOString());

    const conversionRate = recentLeadsCount && recentLeadsCount > 0
      ? Math.round((recentClientsCount || 0) / recentLeadsCount * 100)
      : 0;

    return NextResponse.json({
      metrics: {
        totalLeads: totalLeads || 0,
        hotLeads: hotLeadsCount || 0,
        tasksDueToday: tasksDueToday || 0,
        overdueTasks: overdueTasks || 0,
        pendingApprovals: pendingApprovals || 0,
        urgentApprovals: urgentApprovals || 0,
        leadsThisWeek: leadsThisWeek || 0,
        conversionRate,
      },
      hotLeads: hotLeadsData || [],
      recentTasks: recentTasks || [],
      pipelineStats: statusCounts,
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard/stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
