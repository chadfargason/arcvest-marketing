'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  XCircle,
  Clock,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface AgentStatus {
  id: string;
  agent_name: string;
  is_running: boolean;
  last_heartbeat: string | null;
  last_success_at: string | null;
  last_error: string | null;
  tasks_pending: number;
  tasks_completed_today: number;
  current_task: string | null;
  metadata: Record<string, unknown> | null;
}

interface AgentTask {
  id: string;
  agent_name: string;
  task_type: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobLog {
  id: string;
  job_name: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

interface TaskSummary {
  agent_name: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
}

const agentConfig: Record<string, { displayName: string; description: string }> = {
  orchestrator: {
    displayName: 'Orchestrator',
    description: 'Coordinates tasks between agents and manages workflows',
  },
  content: {
    displayName: 'Content Agent',
    description: 'Creates blog posts, LinkedIn content, and newsletters',
  },
  creative: {
    displayName: 'Creative Agent',
    description: 'Generates ad copy, headlines, and marketing materials',
  },
  paid_media: {
    displayName: 'Paid Media Agent',
    description: 'Manages Google Ads campaigns and optimizations',
  },
  seo: {
    displayName: 'SEO Agent',
    description: 'Tracks rankings and identifies content opportunities',
  },
  analytics: {
    displayName: 'Analytics Agent',
    description: 'Collects metrics and generates performance reports',
  },
  research: {
    displayName: 'Research Agent',
    description: 'Monitors competitors and industry news',
  },
};

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [recentTasks, setRecentTasks] = useState<AgentTask[]>([]);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error('Failed to fetch agent status');
      const data = await response.json();
      setAgents(data.agents || []);
      setRecentTasks(data.recentTasks || []);
      setJobLogs(data.jobLogs || []);
      setTaskSummary(data.taskSummary || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Create display agents - either from real data or show all configured agents
  const displayAgents = Object.keys(agentConfig).map(name => {
    const realAgent = agents.find(a => a.agent_name === name);
    const summary = taskSummary.find(s => s.agent_name === name);
    return {
      name,
      ...agentConfig[name],
      is_running: realAgent?.is_running ?? false,
      last_heartbeat: realAgent?.last_heartbeat ?? null,
      last_success_at: realAgent?.last_success_at ?? null,
      last_error: realAgent?.last_error ?? null,
      tasks_pending: summary?.pending_tasks ?? realAgent?.tasks_pending ?? 0,
      tasks_completed_today: summary?.completed_tasks ?? realAgent?.tasks_completed_today ?? 0,
      current_task: realAgent?.current_task ?? null,
    };
  });

  const runningAgents = displayAgents.filter(a => a.is_running).length;
  const totalTasksPending = displayAgents.reduce((sum, a) => sum + a.tasks_pending, 0);
  const totalTasksCompleted = displayAgents.reduce((sum, a) => sum + a.tasks_completed_today, 0);
  const agentsWithErrors = displayAgents.filter(a => a.last_error).length;

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchAgentData}>Try Again</Button>
      </div>
    );
  }

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
        <Button variant="outline" onClick={fetchAgentData}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-600">{runningAgents}</div>
              <span className="text-muted-foreground">/ {displayAgents.length}</span>
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
            <div className="text-2xl font-bold text-red-600">{agentsWithErrors}</div>
            <p className="text-sm text-muted-foreground">With Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      {loading && agents.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayAgents.map((agent) => (
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

                  {/* Current Task */}
                  {agent.current_task && (
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground truncate">{agent.current_task}</span>
                    </div>
                  )}

                  {/* Last Run */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last heartbeat:</span>
                    <span>{formatRelativeTime(agent.last_heartbeat)}</span>
                  </div>

                  {/* Error */}
                  {agent.last_error && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{agent.last_error}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {agent.is_running ? (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        <Pause className="mr-1 h-4 w-4" />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        <Play className="mr-1 h-4 w-4" />
                        Start
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1" disabled>
                      <Activity className="mr-1 h-4 w-4" />
                      Logs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
          <CardDescription>Latest tasks completed by marketing agents</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 && jobLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent agent activity.</p>
              <p className="text-sm mt-2">Agent tasks will appear here when they run.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    task.status === 'completed' ? 'bg-green-100' :
                    task.status === 'failed' ? 'bg-red-100' :
                    task.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Bot className={`h-5 w-5 ${
                      task.status === 'completed' ? 'text-green-600' :
                      task.status === 'failed' ? 'text-red-600' :
                      task.status === 'running' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      <span className="capitalize">{task.agent_name?.replace('_', ' ')}</span>
                      {' - '}{task.task_type?.replace(/_/g, ' ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        task.status === 'completed' ? 'success' :
                        task.status === 'failed' ? 'destructive' :
                        task.status === 'running' ? 'info' : 'secondary'
                      }>
                        {task.status}
                      </Badge>
                      {task.error && (
                        <span className="text-sm text-red-600 truncate max-w-xs">{task.error}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatRelativeTime(task.completed_at || task.started_at || task.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Logs */}
      {jobLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Job Logs</CardTitle>
            <CardDescription>Recent scheduled job executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{log.job_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{log.agent_name?.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      log.status === 'completed' ? 'success' :
                      log.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {log.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatRelativeTime(log.started_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
