import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  CheckSquare,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// Placeholder data - will be fetched from API
const metrics = [
  {
    title: 'Total Leads',
    value: '124',
    change: '+12%',
    changeType: 'positive',
    icon: Users,
  },
  {
    title: 'Hot Leads',
    value: '18',
    change: '+3',
    changeType: 'positive',
    icon: TrendingUp,
  },
  {
    title: 'Tasks Due Today',
    value: '7',
    change: '2 overdue',
    changeType: 'warning',
    icon: CheckSquare,
  },
  {
    title: 'Pending Approvals',
    value: '4',
    change: '1 urgent',
    changeType: 'warning',
    icon: Clock,
  },
];

const hotLeads = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    score: 85,
    status: 'consultation_scheduled',
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@company.com',
    score: 78,
    status: 'contacted',
    lastActivity: '1 day ago',
  },
  {
    id: '3',
    name: 'Michael Brown',
    email: 'm.brown@email.com',
    score: 72,
    status: 'new_lead',
    lastActivity: '3 hours ago',
  },
];

const recentTasks = [
  {
    id: '1',
    title: 'Follow up with John Smith',
    dueDate: 'Today',
    priority: 'high',
    contact: 'John Smith',
  },
  {
    id: '2',
    title: 'Send proposal to Sarah Johnson',
    dueDate: 'Tomorrow',
    priority: 'medium',
    contact: 'Sarah Johnson',
  },
  {
    id: '3',
    title: 'Schedule consultation with new lead',
    dueDate: 'Jan 15',
    priority: 'medium',
    contact: 'Michael Brown',
  },
];

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

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your marketing activities.
        </p>
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
                {metric.changeType === 'negative' && <ArrowDown className="inline h-3 w-3" />}
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
            <div className="space-y-4">
              {hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(lead.status)}
                      <span className="text-xs text-muted-foreground">
                        {lead.lastActivity}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-2xl font-bold text-green-600">
                        {lead.score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Lead Score</p>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="space-y-4">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Contact: {task.contact}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    {getPriorityBadge(task.priority)}
                    <p className="text-xs text-muted-foreground">
                      Due: {task.dueDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2.4M</div>
            <p className="text-xs text-muted-foreground">
              Estimated AUM from active leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
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
            <div className="text-2xl font-bold">18%</div>
            <p className="text-xs text-muted-foreground">
              Lead to client (30 days)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
