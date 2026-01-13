'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Zap,
  Target,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Idea {
  id: string;
  title: string;
  summary: string | null;
  source_name: string;
  source_id: string;
  original_url: string | null;
  relevance_score: number | null;
  score_reason: string | null;
  suggested_angle: string | null;
  status: string;
  selected_for_date: string | null;
  selection_rank: number | null;
  created_at: string;
}

const STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  { value: 'scored', label: 'Scored', color: 'bg-blue-100 text-blue-700', icon: Target },
  { value: 'selected', label: 'Selected', color: 'bg-purple-100 text-purple-700', icon: Sparkles },
  { value: 'processing', label: 'Processing', color: 'bg-yellow-100 text-yellow-700', icon: Loader2 },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: Filter },
];

const getStatusConfig = (status: string) => {
  return STATUSES.find((s) => s.value === status) || STATUSES[0];
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'bg-gray-100 text-gray-600';
  if (score >= 70) return 'bg-green-100 text-green-700';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sources, setSources] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    scored: 0,
    selected: 0,
    completed: 0,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      let query = supabase
        .from('idea_queue')
        .select('id, title, summary, source_name, source_id, original_url, relevance_score, score_reason, suggested_angle, status, selected_for_date, selection_rank, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (sourceFilter !== 'all') {
        query = query.eq('source_id', sourceFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching ideas:', error);
        return;
      }

      setIdeas(data || []);

      // Get unique sources
      const uniqueSources = [...new Set((data || []).map(i => i.source_id))].filter(Boolean);
      setSources(uniqueSources);

      // Calculate stats
      const allIdeas = data || [];
      setStats({
        total: allIdeas.length,
        pending: allIdeas.filter(i => i.status === 'pending').length,
        scored: allIdeas.filter(i => i.status === 'scored').length,
        selected: allIdeas.filter(i => i.status === 'selected').length,
        completed: allIdeas.filter(i => i.status === 'completed').length,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleReject = async (ideaId: string) => {
    setActionLoading(ideaId);
    try {
      const supabase = createClient();
      await supabase
        .from('idea_queue')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', ideaId);

      setIdeas(ideas.map(i => i.id === ideaId ? { ...i, status: 'rejected' } : i));
    } catch (error) {
      console.error('Error rejecting idea:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (ideaId: string) => {
    setActionLoading(ideaId);
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('idea_queue')
        .update({
          status: 'selected',
          selected_for_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ideaId);

      setIdeas(ideas.map(i => i.id === ideaId ? { ...i, status: 'selected', selected_for_date: today } : i));
    } catch (error) {
      console.error('Error approving idea:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const runScoring = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/score-ideas?limit=50', { method: 'POST' });
      const data = await response.json();
      console.log('Scoring result:', data);
      await fetchIdeas();
    } catch (error) {
      console.error('Error running scoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSelection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/select-daily?count=8&minScore=55', { method: 'POST' });
      const data = await response.json();
      console.log('Selection result:', data);
      await fetchIdeas();
    } catch (error) {
      console.error('Error running selection:', error);
    } finally {
      setLoading(false);
    }
  };

  const runPipeline = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/process-pipeline?limit=1', { method: 'POST' });
      const data = await response.json();
      console.log('Pipeline result:', data);
      await fetchIdeas();
    } catch (error) {
      console.error('Error running pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && ideas.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ideas Queue</h1>
          <p className="text-muted-foreground">
            Content ideas discovered from email and RSS sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchIdeas} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scored</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.scored}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selected Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.selected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant="outline" onClick={runScoring} disabled={loading}>
              <Target className="h-4 w-4 mr-2" />
              Score Pending Ideas
            </Button>
            <Button variant="outline" onClick={runSelection} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Select Top 8
            </Button>
            <Button onClick={runPipeline} disabled={loading}>
              <Zap className="h-4 w-4 mr-2" />
              Process 1 Through Pipeline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ideas Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 w-8">#</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3 w-32">Source</th>
                <th className="text-center p-3 w-20">Score</th>
                <th className="text-left p-3 w-24">Status</th>
                <th className="text-right p-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ideas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    No ideas found. Run the RSS or Email scan to discover content ideas.
                  </td>
                </tr>
              ) : (
                ideas.map((idea, index) => {
                  const statusConfig = getStatusConfig(idea.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <tr key={idea.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-muted-foreground text-sm">
                        {idea.selection_rank || index + 1}
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="font-medium line-clamp-1">
                            {idea.title}
                          </div>
                          {idea.suggested_angle && (
                            <div className="text-xs text-purple-600 line-clamp-1">
                              Angle: {idea.suggested_angle}
                            </div>
                          )}
                          {idea.score_reason && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {idea.score_reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {idea.source_name}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {idea.relevance_score !== null ? (
                          <Badge className={getScoreColor(idea.relevance_score)}>
                            {idea.relevance_score}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {idea.original_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(idea.original_url!, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {(idea.status === 'scored' || idea.status === 'pending') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(idea.id)}
                                disabled={actionLoading === idea.id}
                              >
                                {actionLoading === idea.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ThumbsUp className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(idea.id)}
                                disabled={actionLoading === idea.id}
                              >
                                <ThumbsDown className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
