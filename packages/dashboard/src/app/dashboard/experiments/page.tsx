'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  FlaskConical, Plus, Play, Pause, Trophy, RefreshCw, Loader2,
  Trash2, Pencil, Check, X, ArrowLeft, DollarSign, Eye,
  MousePointerClick, TrendingUp, ChevronRight, ChevronLeft,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: string;
  platform: string;
  optimization_metric: string;
  daily_budget: number;
  bid_strategy: string;
  target_cpa: number | null;
  keywords: string[];
  match_type: string;
  landing_page_url: string | null;
  target_locations: string[];
  audience_targeting: Record<string, unknown>;
  google_campaign_id: string | null;
  google_budget_id: string | null;
  persona_id: string | null;
  voice_id: string | null;
  num_variations: number;
  auto_optimize: boolean;
  winner_variation_id: string | null;
  created_at: string;
  updated_at: string;
  variation_count?: number;
  total_impressions?: number;
  total_clicks?: number;
  total_cost?: number;
  total_conversions?: number;
  variations?: Variation[];
  logs?: ExperimentLog[];
}

interface Variation {
  id: string;
  experiment_id: string;
  variation_number: number;
  headlines: Array<{ text: string; type?: string; pinPosition?: number }>;
  descriptions: Array<{ text: string; pinPosition?: number }>;
  status: string;
  google_ad_group_id: string | null;
  google_ad_id: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  created_at: string;
}

interface ExperimentLog {
  id: string;
  experiment_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface WizardData {
  name: string;
  description: string;
  optimization_metric: string;
  keywords: string;
  match_type: string;
  landing_page_url: string;
  target_locations: string;
  daily_budget: string;
  bid_strategy: string;
  target_cpa: string;
  persona_id: string;
  voice_id: string;
  num_variations: number;
}

// ============================================
// CONSTANTS
// ============================================

const PERSONAS = [
  { id: 'pre-retiree', name: 'Pre-Retirees (50-65)' },
  { id: 'hnw-investor', name: 'High Net Worth Investor' },
  { id: 'fee-conscious', name: 'Fee-Conscious Investor' },
  { id: 'business-owner', name: 'Business Owner' },
  { id: 'recently-retired', name: 'Recently Retired' },
  { id: 'diy-investor', name: 'DIY Investor' },
  { id: 'wirehouse-refugee', name: 'Wirehouse Refugee' },
  { id: 'professional-couple', name: 'Professional Couple' },
];

const VOICES = [
  { id: 'educational', name: 'Educational' },
  { id: 'direct', name: 'Direct' },
  { id: 'story-driven', name: 'Story-Driven' },
  { id: 'data-driven', name: 'Data-Driven' },
  { id: 'authority', name: 'Authority' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  generating: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-blue-100 text-blue-700',
  live: 'bg-emerald-100 text-emerald-700',
  optimizing: 'bg-purple-100 text-purple-700',
  completed: 'bg-gray-100 text-gray-800',
  paused: 'bg-orange-100 text-orange-700',
  active: 'bg-emerald-100 text-emerald-700',
  winner: 'bg-yellow-100 text-yellow-700',
  loser: 'bg-red-100 text-red-700',
};

const METRIC_LABELS: Record<string, string> = {
  ctr: 'CTR',
  conversions: 'Conversions',
  cpc: 'CPC',
  impressions: 'Impressions',
};

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

const DEFAULT_WIZARD: WizardData = {
  name: '',
  description: '',
  optimization_metric: 'ctr',
  keywords: '',
  match_type: 'broad',
  landing_page_url: '',
  target_locations: '',
  daily_budget: '10',
  bid_strategy: 'maximize_clicks',
  target_cpa: '',
  persona_id: '',
  voice_id: '',
  num_variations: 5,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<Variation[]>([]);
  const [currentExperimentId, setCurrentExperimentId] = useState<string | null>(null);

  // Detail view state
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchExperiments = useCallback(async () => {
    try {
      const url = statusFilter === 'all'
        ? '/api/experiments'
        : `/api/experiments?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch experiments');
      const json = await res.json();
      setExperiments(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    }
  }, [statusFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchExperiments();
      setLoading(false);
    };
    load();
  }, [fetchExperiments]);

  const fetchExperimentDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/experiments/${id}`);
      if (!res.ok) throw new Error('Failed to fetch experiment');
      const json = await res.json();
      setSelectedExperiment(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ============================================
  // WIZARD ACTIONS
  // ============================================

  const handleCreate = async () => {
    setCreating(true);
    try {
      const keywords = wizardData.keywords
        .split('\n')
        .map((k) => k.trim())
        .filter(Boolean);
      const locations = wizardData.target_locations
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizardData.name,
          description: wizardData.description || null,
          optimization_metric: wizardData.optimization_metric,
          keywords,
          match_type: wizardData.match_type,
          landing_page_url: wizardData.landing_page_url || null,
          target_locations: locations,
          daily_budget: parseFloat(wizardData.daily_budget) || 10,
          bid_strategy: wizardData.bid_strategy,
          target_cpa: wizardData.target_cpa ? parseFloat(wizardData.target_cpa) : null,
          persona_id: wizardData.persona_id || null,
          voice_id: wizardData.voice_id || null,
          num_variations: wizardData.num_variations,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }

      const json = await res.json();
      setCurrentExperimentId(json.data.id);
      setWizardStep(4); // Move to copy generation step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentExperimentId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/experiments/${currentExperimentId}/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate');
      }
      const json = await res.json();
      setGeneratedVariations(json.data.variations || []);
      setWizardStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variations');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!currentExperimentId) return;
    setDeploying(true);
    try {
      const res = await fetch(`/api/experiments/${currentExperimentId}/deploy`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to deploy');
      }
      setWizardOpen(false);
      resetWizard();
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy experiment');
    } finally {
      setDeploying(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardData(DEFAULT_WIZARD);
    setGeneratedVariations([]);
    setCurrentExperimentId(null);
  };

  // ============================================
  // EXPERIMENT ACTIONS
  // ============================================

  const handleSync = async (id: string) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/experiments/${id}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      await fetchExperimentDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading('pause');
    try {
      const res = await fetch(`/api/experiments/${id}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error('Pause failed');
      await fetchExperimentDetail(id);
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading('resume');
    try {
      const res = await fetch(`/api/experiments/${id}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Resume failed');
      await fetchExperimentDetail(id);
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: string, winnerVariationId?: string) => {
    setActionLoading('complete');
    try {
      const res = await fetch(`/api/experiments/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner_variation_id: winnerVariationId }),
      });
      if (!res.ok) throw new Error('Complete failed');
      await fetchExperimentDetail(id);
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading('delete');
    try {
      const res = await fetch(`/api/experiments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSelectedExperiment(null);
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // DETAIL VIEW
  // ============================================

  if (selectedExperiment) {
    return (
      <ExperimentDetail
        experiment={selectedExperiment}
        loading={detailLoading}
        syncing={syncing}
        actionLoading={actionLoading}
        onBack={() => {
          setSelectedExperiment(null);
          fetchExperiments();
        }}
        onSync={() => handleSync(selectedExperiment.id)}
        onPause={() => handlePause(selectedExperiment.id)}
        onResume={() => handleResume(selectedExperiment.id)}
        onComplete={(winnerId) => handleComplete(selectedExperiment.id, winnerId)}
        onDelete={() => handleDelete(selectedExperiment.id)}
      />
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Experiments</h1>
        </div>
        <Button onClick={() => { resetWizard(); setWizardOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Experiments Table */}
      <Card>
        <CardContent className="p-0">
          {experiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FlaskConical className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No experiments yet</p>
              <p className="text-sm mt-1">Create your first A/B test experiment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Variations</th>
                    <th className="px-4 py-3 font-medium">Daily Budget</th>
                    <th className="px-4 py-3 font-medium">Metric</th>
                    <th className="px-4 py-3 font-medium text-right">Spend</th>
                    <th className="px-4 py-3 font-medium text-right">Clicks</th>
                    <th className="px-4 py-3 font-medium text-right">Impressions</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => fetchExperimentDetail(exp.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{exp.name}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[exp.status] || 'bg-gray-100'}>{exp.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{exp.variation_count || 0}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(exp.daily_budget)}/day</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{METRIC_LABELS[exp.optimization_metric] || exp.optimization_metric}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(exp.total_cost || 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(exp.total_clicks || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(exp.total_impressions || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(exp.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) { setWizardOpen(false); resetWizard(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {wizardStep <= 3 && 'Create Experiment'}
              {wizardStep === 4 && 'Generate Ad Copy'}
              {wizardStep === 5 && 'Review Variations'}
              {wizardStep === 6 && 'Deploy to Google Ads'}
            </DialogTitle>
            <DialogDescription>
              Step {wizardStep} of 6
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Basics */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Experiment Name *</Label>
                <Input
                  id="name"
                  value={wizardData.name}
                  onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                  placeholder="e.g., Pre-Retiree CTA Test"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={wizardData.description}
                  onChange={(e) => setWizardData({ ...wizardData, description: e.target.value })}
                  placeholder="What are you testing?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Optimization Metric</Label>
                <Select
                  value={wizardData.optimization_metric}
                  onValueChange={(v) => setWizardData({ ...wizardData, optimization_metric: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctr">Click-Through Rate (CTR)</SelectItem>
                    <SelectItem value="conversions">Conversions</SelectItem>
                    <SelectItem value="cpc">Cost Per Click (CPC)</SelectItem>
                    <SelectItem value="impressions">Impressions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setWizardStep(2)} disabled={!wizardData.name}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Targeting */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="keywords">Keywords (one per line)</Label>
                <Textarea
                  id="keywords"
                  value={wizardData.keywords}
                  onChange={(e) => setWizardData({ ...wizardData, keywords: e.target.value })}
                  placeholder={"retirement planning\nwealth management\nfinancial advisor near me"}
                  rows={4}
                />
              </div>
              <div>
                <Label>Match Type</Label>
                <Select
                  value={wizardData.match_type}
                  onValueChange={(v) => setWizardData({ ...wizardData, match_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broad">Broad</SelectItem>
                    <SelectItem value="phrase">Phrase</SelectItem>
                    <SelectItem value="exact">Exact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="landing_page">Landing Page URL</Label>
                <Input
                  id="landing_page"
                  value={wizardData.landing_page_url}
                  onChange={(e) => setWizardData({ ...wizardData, landing_page_url: e.target.value })}
                  placeholder="https://arcvest.com/get-started"
                />
              </div>
              <div>
                <Label htmlFor="locations">Target Locations (comma-separated geo IDs)</Label>
                <Input
                  id="locations"
                  value={wizardData.target_locations}
                  onChange={(e) => setWizardData({ ...wizardData, target_locations: e.target.value })}
                  placeholder="2840 (United States)"
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => setWizardStep(3)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Budget */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="daily_budget">Daily Budget ($)</Label>
                <Input
                  id="daily_budget"
                  type="number"
                  min="1"
                  value={wizardData.daily_budget}
                  onChange={(e) => setWizardData({ ...wizardData, daily_budget: e.target.value })}
                />
              </div>
              <div>
                <Label>Bid Strategy</Label>
                <Select
                  value={wizardData.bid_strategy}
                  onValueChange={(v) => setWizardData({ ...wizardData, bid_strategy: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maximize_clicks">Maximize Clicks</SelectItem>
                    <SelectItem value="maximize_conversions">Maximize Conversions</SelectItem>
                    <SelectItem value="target_cpa">Target CPA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {wizardData.bid_strategy === 'target_cpa' && (
                <div>
                  <Label htmlFor="target_cpa">Target CPA ($)</Label>
                  <Input
                    id="target_cpa"
                    type="number"
                    min="1"
                    value={wizardData.target_cpa}
                    onChange={(e) => setWizardData({ ...wizardData, target_cpa: e.target.value })}
                  />
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save & Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Copy Generation */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Persona</Label>
                <Select
                  value={wizardData.persona_id}
                  onValueChange={(v) => setWizardData({ ...wizardData, persona_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a persona" /></SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Voice</Label>
                <Select
                  value={wizardData.voice_id}
                  onValueChange={(v) => setWizardData({ ...wizardData, voice_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a voice" /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Variations: {wizardData.num_variations}</Label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={wizardData.num_variations}
                  onChange={(e) => setWizardData({ ...wizardData, num_variations: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>3</span><span>10</span>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={async () => {
                    // First update persona/voice on the experiment
                    if (currentExperimentId) {
                      await fetch(`/api/experiments/${currentExperimentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          persona_id: wizardData.persona_id,
                          voice_id: wizardData.voice_id,
                          num_variations: wizardData.num_variations,
                        }),
                      });
                    }
                    handleGenerate();
                  }}
                  disabled={generating || !wizardData.persona_id || !wizardData.voice_id}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Variations'
                  )}
                </Button>
              </div>
              {generating && (
                <div className="text-center text-sm text-gray-500 py-4">
                  <p>Running 4-AI pipeline (Claude &rarr; ChatGPT &rarr; Gemini &rarr; Claude)...</p>
                  <p className="mt-1">This may take 30-60 seconds.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review Variations */}
          {wizardStep === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {generatedVariations.length} variations generated. Review and edit before deploying.
              </p>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {generatedVariations.map((v, idx) => (
                  <Card key={v.id || idx}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Variation {v.variation_number}</CardTitle>
                        <Badge className={STATUS_COLORS[v.status]}>{v.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Headlines</p>
                          <div className="flex flex-wrap gap-1">
                            {v.headlines.map((h, i) => (
                              <span key={i} className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                                {h.text}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Descriptions</p>
                          {v.descriptions.map((d, i) => (
                            <p key={i} className="text-xs text-gray-600">{d.text}</p>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(4)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Regenerate
                </Button>
                <Button onClick={() => setWizardStep(6)}>
                  Continue to Deploy <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Deploy */}
          {wizardStep === 6 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deployment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Campaign</span>
                    <span className="font-medium">{wizardData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Daily Budget</span>
                    <span className="font-medium">${wizardData.daily_budget}/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bid Strategy</span>
                    <span className="font-medium">{wizardData.bid_strategy.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Keywords</span>
                    <span className="font-medium">{wizardData.keywords.split('\n').filter(Boolean).length} keywords</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variations</span>
                    <span className="font-medium">{generatedVariations.length} ad groups</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Optimization</span>
                    <span className="font-medium">{METRIC_LABELS[wizardData.optimization_metric]}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                This will create a live Google Ads campaign and start spending your budget immediately.
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(5)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={handleDeploy} disabled={deploying}>
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Deploy to Google Ads
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// EXPERIMENT DETAIL COMPONENT
// ============================================

function ExperimentDetail({
  experiment,
  loading,
  syncing,
  actionLoading,
  onBack,
  onSync,
  onPause,
  onResume,
  onComplete,
  onDelete,
}: {
  experiment: Experiment;
  loading: boolean;
  syncing: boolean;
  actionLoading: string | null;
  onBack: () => void;
  onSync: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: (winnerId?: string) => void;
  onDelete: () => void;
}) {
  const [sortBy, setSortBy] = useState<string>('variation_number');

  const variations = useMemo(() => {
    const vs = [...(experiment.variations || [])];
    switch (sortBy) {
      case 'ctr': return vs.sort((a, b) => b.ctr - a.ctr);
      case 'clicks': return vs.sort((a, b) => b.clicks - a.clicks);
      case 'impressions': return vs.sort((a, b) => b.impressions - a.impressions);
      case 'cost': return vs.sort((a, b) => b.cost - a.cost);
      default: return vs.sort((a, b) => a.variation_number - b.variation_number);
    }
  }, [experiment.variations, sortBy]);

  const totalSpend = variations.reduce((sum, v) => sum + Number(v.cost), 0);
  const totalClicks = variations.reduce((sum, v) => sum + v.clicks, 0);
  const totalImpressions = variations.reduce((sum, v) => sum + v.impressions, 0);
  const bestCtr = variations.length > 0 ? Math.max(...variations.map((v) => v.ctr)) : 0;

  const isLive = experiment.status === 'live';
  const isPaused = experiment.status === 'paused';
  const isCompleted = experiment.status === 'completed';
  const isDraft = experiment.status === 'draft' || experiment.status === 'ready';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{experiment.name}</h1>
          <Badge className={STATUS_COLORS[experiment.status]}>{experiment.status}</Badge>
          <Badge variant="outline">{METRIC_LABELS[experiment.optimization_metric]}</Badge>
          <span className="text-sm text-gray-500">{formatCurrency(experiment.daily_budget)}/day</span>
        </div>
        <div className="flex items-center gap-2">
          {(isLive || isPaused || isCompleted) && (
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Sync</span>
            </Button>
          )}
          {isLive && (
            <Button variant="outline" size="sm" onClick={onPause} disabled={actionLoading === 'pause'}>
              {actionLoading === 'pause' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              <span className="ml-1">Pause</span>
            </Button>
          )}
          {isPaused && (
            <Button variant="outline" size="sm" onClick={onResume} disabled={actionLoading === 'resume'}>
              {actionLoading === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="ml-1">Resume</span>
            </Button>
          )}
          {(isLive || isPaused) && (
            <Button variant="outline" size="sm" onClick={() => onComplete()} disabled={actionLoading === 'complete'}>
              {actionLoading === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              <span className="ml-1">End Experiment</span>
            </Button>
          )}
          {(isDraft || isCompleted) && (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={onDelete} disabled={actionLoading === 'delete'}>
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1">Delete</span>
            </Button>
          )}
        </div>
      </div>

      {experiment.description && (
        <p className="text-gray-600">{experiment.description}</p>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">Total Spend</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">Total Clicks</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">Total Impressions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalImpressions.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">Best CTR</span>
            </div>
            <p className="text-2xl font-bold mt-1">{bestCtr.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Variations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variations</CardTitle>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variation_number">Variation #</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="clicks">Clicks</SelectItem>
                <SelectItem value="impressions">Impressions</SelectItem>
                <SelectItem value="cost">Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Headlines</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                  <th className="px-4 py-3 font-medium text-right">Impressions</th>
                  <th className="px-4 py-3 font-medium text-right">CTR</th>
                  <th className="px-4 py-3 font-medium text-right">CPC</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  {(isLive || isPaused) && <th className="px-4 py-3 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {variations.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.variation_number}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[v.status]}>{v.status}</Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {v.headlines.slice(0, 3).map((h, i) => (
                          <span key={i} className="inline-block bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            {h.text}
                          </span>
                        ))}
                        {v.headlines.length > 3 && (
                          <span className="text-xs text-gray-400">+{v.headlines.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{v.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{v.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{v.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(v.cpc)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(v.cost))}</td>
                    {(isLive || isPaused) && (
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onComplete(v.id)}
                          title="Declare winner"
                        >
                          <Trophy className="h-3 w-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart */}
      {variations.some((v) => v.impressions > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Variation Performance</CardTitle>
            <CardDescription>Comparison of variation metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={variations.map((v) => ({
                  name: `V${v.variation_number}`,
                  ctr: v.ctr,
                  clicks: v.clicks,
                  impressions: v.impressions,
                  cost: Number(v.cost),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ctr" stroke={CHART_COLORS[0]} name="CTR %" strokeWidth={2} />
                <Line type="monotone" dataKey="clicks" stroke={CHART_COLORS[1]} name="Clicks" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      {experiment.logs && experiment.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {experiment.logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5">
                    {log.action === 'deployed' && <Play className="h-4 w-4 text-emerald-500" />}
                    {log.action === 'paused' && <Pause className="h-4 w-4 text-orange-500" />}
                    {log.action === 'resumed' && <Play className="h-4 w-4 text-blue-500" />}
                    {log.action === 'completed' && <Trophy className="h-4 w-4 text-yellow-500" />}
                    {log.action === 'synced' && <RefreshCw className="h-4 w-4 text-gray-500" />}
                    {log.action === 'generated' && <FlaskConical className="h-4 w-4 text-purple-500" />}
                    {!['deployed', 'paused', 'resumed', 'completed', 'synced', 'generated'].includes(log.action) && (
                      <Check className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 capitalize">{log.action}</p>
                    <p className="text-gray-400 text-xs">{formatDate(log.created_at)}</p>
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
