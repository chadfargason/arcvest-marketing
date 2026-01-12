import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Check,
  Clock,
  AlertCircle,
  User,
} from 'lucide-react';

// Placeholder data - will be fetched from API
const tasks = [
  {
    id: '1',
    title: 'Follow up with John Smith',
    description: 'Send follow-up email about retirement planning consultation',
    due_date: '2024-01-11T17:00:00Z',
    priority: 'high',
    status: 'pending',
    assigned_to: 'chad',
    contact: { name: 'John Smith', email: 'john.smith@example.com' },
  },
  {
    id: '2',
    title: 'Send proposal to Sarah Johnson',
    description: 'Prepare and send comprehensive financial planning proposal',
    due_date: '2024-01-12T12:00:00Z',
    priority: 'high',
    status: 'pending',
    assigned_to: 'erik',
    contact: { name: 'Sarah Johnson', email: 'sarah.j@company.com' },
  },
  {
    id: '3',
    title: 'Schedule consultation with Michael Brown',
    description: 'Reach out to schedule initial discovery meeting',
    due_date: '2024-01-13T10:00:00Z',
    priority: 'medium',
    status: 'pending',
    assigned_to: 'chad',
    contact: { name: 'Michael Brown', email: 'm.brown@email.com' },
  },
  {
    id: '4',
    title: 'Review quarterly report',
    description: 'Review Q4 marketing performance report before team meeting',
    due_date: '2024-01-10T09:00:00Z',
    priority: 'medium',
    status: 'pending',
    assigned_to: 'chad',
    contact: null,
  },
  {
    id: '5',
    title: 'Update Emily Davis portfolio review',
    description: 'Prepare portfolio review presentation for upcoming meeting',
    due_date: '2024-01-15T14:00:00Z',
    priority: 'low',
    status: 'pending',
    assigned_to: 'erik',
    contact: { name: 'Emily Davis', email: 'emily.davis@mail.com' },
  },
];

const completedTasks = [
  {
    id: '6',
    title: 'Send welcome email to Robert Wilson',
    completed_at: '2024-01-10T11:30:00Z',
    assigned_to: 'chad',
  },
  {
    id: '7',
    title: 'Update CRM contact notes',
    completed_at: '2024-01-09T16:45:00Z',
    assigned_to: 'erik',
  },
];

function getPriorityConfig(priority: string) {
  const config: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary'; icon: typeof AlertCircle }> = {
    high: { label: 'High', variant: 'destructive', icon: AlertCircle },
    medium: { label: 'Medium', variant: 'warning', icon: Clock },
    low: { label: 'Low', variant: 'secondary', icon: Clock },
  };

  return config[priority] || config.medium;
}

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { text: `${Math.abs(days)} days overdue`, isOverdue: true };
  } else if (days === 0) {
    return { text: 'Due today', isOverdue: false };
  } else if (days === 1) {
    return { text: 'Due tomorrow', isOverdue: false };
  } else {
    return { text: `Due in ${days} days`, isOverdue: false };
  }
}

export default function TasksPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your to-do list and follow-ups
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Task Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-sm text-muted-foreground">Pending Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {tasks.filter(t => {
                const due = formatDueDate(t.due_date);
                return due.isOverdue;
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {tasks.filter(t => t.priority === 'high').length}
            </div>
            <p className="text-sm text-muted-foreground">High Priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {completedTasks.length}
            </div>
            <p className="text-sm text-muted-foreground">Completed Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.map((task) => {
              const priorityConfig = getPriorityConfig(task.priority);
              const dueInfo = formatDueDate(task.due_date);

              return (
                <div
                  key={task.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="mt-1 shrink-0 rounded-full"
                  >
                    <Check className="h-4 w-4" />
                  </Button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{task.title}</h3>
                      <Badge variant={priorityConfig.variant}>
                        {priorityConfig.label}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className={dueInfo.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {dueInfo.text}
                      </span>
                      {task.contact && (
                        <span className="text-muted-foreground">
                          <User className="mr-1 inline h-3 w-3" />
                          {task.contact.name}
                        </span>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {task.assigned_to}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recently Completed */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 rounded-lg border border-green-100 bg-green-50 p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-800 line-through">
                    {task.title}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {task.assigned_to}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
