import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';

// Placeholder data - will be fetched from API
const agents = [
  {
    name: 'orchestrator',
    displayName: 'Orchestrator',
    description: 'Coordinates tasks between agents and manages workflows',
    is_running: true,
    last_run_at: '2024-01-11T11:00:00Z',
    last_success_at: '2024-01-11T11:00:00Z',
    tasks_pending: 3,
    tasks_completed_today: 12,
    last_error: null,
  },
  {
    name: 'content',
    displayName: 'Content Agent',
    description: 'Creates blog posts, LinkedIn content, and newsletters',
    is_running: true,
    last_run_at: '2024-01-11T10:45:00Z',
    last_success_at: '2024-01-11T10:45:00Z',
    tasks_pending: 2,
    tasks_completed_today: 5,
    last_error: null,
  },
  {
    name: 'creative',
    displayName: 'Creative Agent',
    description: 'Generates ad copy, headlines, and marketing materials',
    is_running: true,
    last_run_at: '2024-01-11T10:30:00Z',
    last_success_at: '2024-01-11T10:30:00Z',
    tasks_pending: 1,
    tasks_completed_today: 8,
    last_error: null,
  },
  {
    name: 'paid_media',
    displayName: 'Paid Media Agent',
    description: 'Manages Google Ads campaigns and optimizations',
    is_running: true,
    last_run_at: '2024-01-11T10:00:00Z',
    last_success_at: '2024-01-11T10:00:00Z',
    tasks_pending: 0,
    tasks_completed_today: 3,
    last_error: null,
  },
  {
    name: 'seo',
    displayName: 'SEO Agent',
    description: 'Tracks rankings and identifies content opportunities',
    is_running: true,
    last_run_at: '2024-01-11T09:00:00Z',
    last_success_at: '2024-01-11T09:00:00Z',
    tasks_pending: 0,
    tasks_completed_today: 2,
    last_error: null,
  },
  {
    name: 'analytics',
    displayName: 'Analytics Agent',
    description: 'Collects metrics and generates performance reports',
    is_running: true,
    last_run_at: '2024-01-11T08:00:00Z',
    last_success_at: '2024-01-11T08:00:00Z',
    tasks_pending: 1,
    tasks_completed_today: 4,
    last_error: null,
  },
  {
    name: 'research',
    displayName: 'Research Agent',
    description: 'Monitors competitors and industry news',
    is_running: false,
    last_run_at: '2024-01-10T18:00:00Z',
    last_success_at: '2024-01-10T18:00:00Z',
    tasks_pending: 0,
    tasks_completed_today: 0,
    last_error: 'API rate limit exceeded',
  },
];

const recentActivity = [
  {
    agent: 'content',
    action: 'Created blog post draft',
    target: 'Understanding Required Minimum Distributions',
    timestamp: '2024-01-11T10:45:00Z',
  },
  {
    agent: 'creative',
    action: 'Generated ad copy',
    target: 'Google RSA Headlines - Retirement Planning',
    timestamp: '2024-01-11T10:30:00Z',
  },
  {
    agent: 'paid_media',
    action: 'Optimized bids',
    target: 'Fee-Only Financial Advisor campaign',
    timestamp: '2024-01-11T10:00:00Z',
  },
  {
    agent: 'analytics',
    action: 'Generated daily report',
    target: 'January 10, 2024 Performance Summary',
    timestamp: '2024-01-11T08:00:00Z',
  },
  {
    agent: 'seo',
    action: 'Updated rankings',
    target: '15 tracked keywords',
    timestamp: '2024-01-11T09:00:00Z',
  },
];

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

export default function AgentsPage() {
  const runningAgents = agents.filter(a => a.is_running).length;
  const totalTasksPending = agents.reduce((sum, a) => sum + a.tasks_pending, 0);
  const totalTasksCompleted = agents.reduce((sum, a) => sum + a.tasks_completed_today, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing Agents</h1>
          <p className="text-muted-foreground">
            Monitor and control your AI marketing agents
          </p>
        </div>
        <Button>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-600">{runningAgents}</div>
              <span className="text-muted-foreground">/ {agents.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Agents Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalTasksPending}</div>
            <p className="text-sm text-muted-foreground">Tasks Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{totalTasksCompleted}</div>
            <p className="text-sm text-muted-foreground">Completed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {agents.filter(a => a.last_error).length}
            </div>
            <p className="text-sm text-muted-foreground">With Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.name} className={agent.last_error ? 'border-red-200' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className={`h-5 w-5 ${agent.is_running ? 'text-green-600' : 'text-gray-400'}`} />
                  <CardTitle className="text-lg">{agent.displayName}</CardTitle>
                </div>
                <Badge variant={agent.is_running ? 'success' : 'secondary'}>
                  {agent.is_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <CardDescription>{agent.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-medium">{agent.tasks_pending} tasks</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-medium">{agent.tasks_completed_today} today</p>
                  </div>
                </div>

                {/* Last Run */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last run:</span>
                  <span>{formatRelativeTime(agent.last_run_at)}</span>
                </div>

                {/* Error */}
                {agent.last_error && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                    <XCircle className="h-4 w-4 mt-0.5" />
                    <span>{agent.last_error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {agent.is_running ? (
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pause className="mr-1 h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1">
                      <Play className="mr-1 h-4 w-4" />
                      Start
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1">
                    <Activity className="mr-1 h-4 w-4" />
                    Logs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
          <CardDescription>Latest actions taken by marketing agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Bot className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    <span className="capitalize">{activity.agent.replace('_', ' ')}</span>
                    {' '}{activity.action}
                  </p>
                  <p className="text-sm text-muted-foreground">{activity.target}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatRelativeTime(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
