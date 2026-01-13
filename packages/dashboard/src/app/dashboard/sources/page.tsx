'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  Loader2,
  Mail,
  Rss,
  Globe,
  Database,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SourceAdapter {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  last_fetch_at: string | null;
  last_fetch_count: number;
  last_fetch_error: string | null;
  last_success_at: string | null;
  total_ideas_discovered: number;
  total_ideas_selected: number;
  total_ideas_published: number;
  avg_score: number | null;
  consecutive_failures: number;
  is_healthy: boolean;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'email':
      return Mail;
    case 'rss':
      return Rss;
    case 'website':
      return Globe;
    case 'database':
      return Database;
    default:
      return Globe;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'email':
      return 'bg-blue-100 text-blue-700';
    case 'rss':
      return 'bg-orange-100 text-orange-700';
    case 'website':
      return 'bg-purple-100 text-purple-700';
    case 'database':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceAdapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingSource, setFetchingSource] = useState<string | null>(null);
  const [fetchResults, setFetchResults] = useState<Record<string, { success: boolean; count: number; error?: string }>>({});

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('source_adapters')
        .select('*')
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching sources:', error);
        return;
      }

      setSources(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const toggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const supabase = createClient();
      await supabase
        .from('source_adapters')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', sourceId);

      setSources(sources.map(s => s.id === sourceId ? { ...s, enabled } : s));
    } catch (error) {
      console.error('Error toggling source:', error);
    }
  };

  const triggerFetch = async (source: SourceAdapter) => {
    setFetchingSource(source.source_id);
    setFetchResults(prev => ({ ...prev, [source.source_id]: { success: false, count: 0 } }));

    try {
      const response = await fetch(`/api/test/source/${source.source_id}`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setFetchResults(prev => ({
          ...prev,
          [source.source_id]: { success: true, count: data.ideasSaved || 0 },
        }));
      } else {
        setFetchResults(prev => ({
          ...prev,
          [source.source_id]: { success: false, count: 0, error: data.error },
        }));
      }

      // Refresh sources to get updated stats
      await fetchSources();
    } catch (error) {
      setFetchResults(prev => ({
        ...prev,
        [source.source_id]: { success: false, count: 0, error: String(error) },
      }));
    } finally {
      setFetchingSource(null);
    }
  };

  const fetchAllSources = async () => {
    setLoading(true);
    try {
      // Fetch RSS sources
      const rssResponse = await fetch('/api/test/rss-scan', { method: 'POST' });
      const rssData = await rssResponse.json();
      console.log('RSS scan result:', rssData);

      // Fetch email sources (requires OAuth)
      try {
        const emailResponse = await fetch('/api/test/email-scan', { method: 'POST' });
        const emailData = await emailResponse.json();
        console.log('Email scan result:', emailData);
      } catch {
        console.log('Email scan skipped (OAuth may not be configured)');
      }

      await fetchSources();
    } catch (error) {
      console.error('Error fetching all sources:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalIdeas = sources.reduce((sum, s) => sum + s.total_ideas_discovered, 0);
  const totalSelected = sources.reduce((sum, s) => sum + s.total_ideas_selected, 0);
  const healthySources = sources.filter(s => s.is_healthy).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Sources</h1>
          <p className="text-muted-foreground">
            Manage email and RSS sources for content discovery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSources} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={fetchAllSources} disabled={loading}>
            <Play className="h-4 w-4 mr-2" />
            Fetch All Sources
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sources.filter(s => s.enabled).length} / {sources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ideas Discovered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalIdeas.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ideas Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalSelected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`text-2xl font-bold ${healthySources === sources.length ? 'text-green-600' : 'text-yellow-600'}`}>
                {healthySources} / {sources.length}
              </div>
              {healthySources === sources.length ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((source) => {
          const TypeIcon = getTypeIcon(source.source_type);
          const result = fetchResults[source.source_id];
          const isFetching = fetchingSource === source.source_id;

          return (
            <Card key={source.id} className={!source.enabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${getTypeColor(source.source_type)}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{source.source_name}</CardTitle>
                      <CardDescription className="text-xs">{source.source_id}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={(checked) => toggleSource(source.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Type Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getTypeColor(source.source_type)}>
                    {source.source_type}
                  </Badge>
                  <Badge variant="outline">Priority: {source.priority}</Badge>
                  {!source.is_healthy && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Unhealthy
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="font-medium">{source.total_ideas_discovered}</div>
                    <div className="text-xs text-muted-foreground">Discovered</div>
                  </div>
                  <div>
                    <div className="font-medium">{source.total_ideas_selected}</div>
                    <div className="text-xs text-muted-foreground">Selected</div>
                  </div>
                  <div>
                    <div className="font-medium">{source.avg_score?.toFixed(0) || '-'}</div>
                    <div className="text-xs text-muted-foreground">Avg Score</div>
                  </div>
                </div>

                {/* Last Fetch */}
                {source.last_fetch_at && (
                  <div className="text-xs text-muted-foreground">
                    Last fetch: {new Date(source.last_fetch_at).toLocaleString()} ({source.last_fetch_count} items)
                  </div>
                )}

                {/* Error */}
                {source.last_fetch_error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    Error: {source.last_fetch_error}
                  </div>
                )}

                {/* Fetch Result */}
                {result && (
                  <div className={`text-xs p-2 rounded ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {result.success ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Fetched {result.count} ideas
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {result.error || 'Fetch failed'}
                      </span>
                    )}
                  </div>
                )}

                {/* Fetch Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => triggerFetch(source)}
                  disabled={!source.enabled || isFetching}
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Fetch Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
