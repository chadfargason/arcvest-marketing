'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface LogEntry {
  id: string;
  job_id: string | null;
  job_type: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  step: string | null;
  details: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

interface LogSummary {
  total: number;
  byLevel: {
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
  byType: Record<string, number>;
}

const LEVEL_CONFIG = {
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  debug: { icon: Bug, color: 'text-gray-500', bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600' },
};

const JOB_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'process_pipeline', label: 'Content Pipeline' },
  { value: 'bloomberg_scan', label: 'Bloomberg Scan' },
  { value: 'email_scan', label: 'Email Scan' },
  { value: 'news_scan', label: 'News Scan' },
  { value: 'score_ideas', label: 'Score Ideas' },
  { value: 'select_daily', label: 'Daily Selection' },
];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Filters
  const [levelFilter, setLevelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hoursFilter, setHoursFilter] = useState('24');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (typeFilter !== 'all') params.set('job_type', typeFilter);
      params.set('hours', hoursFilter);
      params.set('limit', '500');

      const response = await fetch(`/api/logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, typeFilter, hoursFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Logs</h1>
          <p className="text-muted-foreground">
            Monitor cron jobs and content pipeline activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={hoursFilter} onValueChange={setHoursFilter}>
            <SelectTrigger className="w-28">
              <Clock className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hour</SelectItem>
              <SelectItem value="6">6 hours</SelectItem>
              <SelectItem value="24">24 hours</SelectItem>
              <SelectItem value="48">48 hours</SelectItem>
              <SelectItem value="168">7 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warn">Warnings</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-sm text-muted-foreground">Total Logs</p>
            </CardContent>
          </Card>
          <Card className={summary.byLevel.error > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{summary.byLevel.error}</div>
              <p className="text-sm text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
          <Card className={summary.byLevel.warn > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.byLevel.warn}</div>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.byLevel.info}</div>
              <p className="text-sm text-muted-foreground">Info</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-500">{summary.byLevel.debug}</div>
              <p className="text-sm text-muted-foreground">Debug</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Log Entries</CardTitle>
          <CardDescription>
            {logs.length} entries in the last {hoursFilter} hour{hoursFilter !== '1' ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No logs found for the selected filters.</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const config = LEVEL_CONFIG[log.level];
                const Icon = config.icon;
                const isExpanded = expandedLogs.has(log.id);
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <div
                    key={log.id}
                    className={`px-4 py-2 hover:bg-gray-50 ${config.bg} bg-opacity-30`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Expand Button */}
                      <button
                        className="mt-0.5 p-0.5 hover:bg-gray-200 rounded"
                        onClick={() => toggleExpand(log.id)}
                        disabled={!hasDetails}
                      >
                        {hasDetails ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                      </button>

                      {/* Level Icon */}
                      <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{log.message}</span>
                          {log.step && (
                            <Badge variant="outline" className="text-xs">
                              {log.step}
                            </Badge>
                          )}
                          {log.duration_ms && log.duration_ms > 100 && (
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(log.duration_ms)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatTime(log.created_at)}</span>
                          <Badge className={`${config.badge} text-xs px-1.5 py-0`}>
                            {log.level}
                          </Badge>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {log.job_type}
                          </Badge>
                          {log.job_id && (
                            <span className="font-mono text-xs">
                              {log.job_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && hasDetails && (
                      <div className="mt-2 ml-11 p-2 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
