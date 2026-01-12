'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  TrendingUp,
  CheckSquare,
  Clock,
  ArrowUp,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface DashboardStats {
  metrics: {
    totalLeads: number;
    hotLeads: number;
    tasksDueToday: number;
    overdueTasks: number;
    pendingApprovals: number;
    urgentApprovals: number;
    leadsThisWeek: number;
    conversionRate: number;
  };
  hotLeads: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    lead_score: number;
    status: string;
    last_activity_at: string;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    priority: string;
    status: string;
    contact: { id: string; first_name: string; last_name: string } | null;
  }>;
  pipelineStats: Record<string, number>;
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' }> = {
    new_lead: { label: 'New Lead', variant: 'info' },
    contacted: { label: 'Contacted', variant: 'secondary' },
    consultation_scheduled: { label: 'Consultation Scheduled', variant: 'warning' },
    consultation_completed: { label: 'Consultation Completed', variant: 'success' },
    proposal_sent: { label: 'Proposal Sent', variant: 'warning' },
    client: { label: 'Client', variant: 'success' },
    closed_lost: { label: 'Closed Lost', variant: 'secondary' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' }> = {
    high: { label: 'High', variant: 'destructive' },
    medium: { label: 'Medium', variant: 'warning' },
    low: { label: 'Low', variant: 'secondary' },
  };

  const config = priorityConfig[priority] || { label: priority, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function formatDueDate(dateString: string | null) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate.getTime() === today.getTime()) return 'Today';
  if (dueDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (dueDate < today) return 'Overdue';
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchStats}>Try Again</Button>
      </div>
    );
  }

  const metrics = [
    {
      title: 'Total Leads',
      value: stats?.metrics.totalLeads || 0,
      change: `+${stats?.metrics.leadsThisWeek || 0} this week`,
      changeType: 'positive',
      icon: Users,
    },
    {
      title: 'Hot Leads',
      value: stats?.metrics.hotLeads || 0,
      change: 'Score 70+',
      changeType: 'positive',
      icon: TrendingUp,
    },
    {
      title: 'Tasks Due Today',
      value: stats?.metrics.tasksDueToday || 0,
      change: stats?.metrics.overdueTasks ? `${stats.metrics.overdueTasks} overdue` : 'None overdue',
      changeType: stats?.metrics.overdueTasks ? 'warning' : 'positive',
      icon: CheckSquare,
    },
    {
      title: 'Pending Approvals',
      value: stats?.metrics.pendingApprovals || 0,
      change: stats?.metrics.urgentApprovals ? `${stats.metrics.urgentApprovals} urgent` : 'None urgent',
      changeType: stats?.metrics.urgentApprovals ? 'warning' : 'positive',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your marketing activities.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className={`text-xs ${
                metric.changeType === 'positive' ? 'text-green-600' :
                metric.changeType === 'warning' ? 'text-yellow-600' :
                'text-muted-foreground'
              }`}>
                {metric.changeType === 'positive' && <ArrowUp className="inline h-3 w-3" />}
                {' '}{metric.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hot Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Hot Leads</CardTitle>
            <CardDescription>
              Leads with score 70+ requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.hotLeads && stats.hotLeads.length > 0 ? (
              <div className="space-y-4">
                {stats.hotLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/contacts/${lead.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(lead.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(lead.last_activity_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-2xl font-bold text-green-600">
                          {lead.lead_score}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Lead Score</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No hot leads at the moment
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tasks Due */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks Due</CardTitle>
            <CardDescription>
              Upcoming tasks requiring your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentTasks && stats.recentTasks.length > 0 ? (
              <div className="space-y-4">
                {stats.recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.contact
                          ? `Contact: ${task.contact.first_name} ${task.contact.last_name}`
                          : 'No contact linked'}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      {getPriorityBadge(task.priority)}
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDueDate(task.due_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No pending tasks
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.pipelineStats && Object.entries(stats.pipelineStats).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {(!stats?.pipelineStats || Object.keys(stats.pipelineStats).length === 0) && (
                <p className="text-muted-foreground text-sm">No contacts yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.metrics.leadsThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">
              New leads generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.metrics.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Lead to client (30 days)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
