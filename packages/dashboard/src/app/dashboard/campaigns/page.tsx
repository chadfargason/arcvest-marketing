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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus,
  RefreshCw,
  Loader2,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  Edit,
  Trash2,
  TrendingUp,
  Play,
  Pause,
  Zap,
  AlertTriangle,
  History,
  Cloud,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  budget_monthly: number;
  start_date: string | null;
  end_date: string | null;
  target_audience: string | null;
  google_ads_campaign_id: string | null;
  notes: string | null;
  created_at: string;
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpa: number | null;
}

interface OptimizationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  change_percentage: number | null;
  rule_name: string;
  reason: string;
  status: 'applied' | 'failed' | 'skipped';
  error_message: string | null;
  created_at: string;
}

interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}

interface BudgetAlert {
  id: string;
  google_ads_campaign_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  daily_budget: number;
  current_spend: number;
  pacing_percentage: number;
  message: string;
  resolved: boolean;
  created_at: string;
}

const CAMPAIGN_TYPES = [
  { value: 'google_search', label: 'Google Search' },
  { value: 'google_display', label: 'Google Display' },
  { value: 'google_youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email', label: 'Email' },
  { value: 'content', label: 'Content' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-700' },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  // Optimization state
  const [optimizationLog, setOptimizationLog] = useState<OptimizationLog[]>([]);
  const [optimizationRules, setOptimizationRules] = useState<OptimizationRule[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [adsConnected, setAdsConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('campaigns');

  const [formData, setFormData] = useState({
    name: '',
    type: 'google_search',
    status: 'draft',
    budget_monthly: '',
    start_date: '',
    end_date: '',
    target_audience: '',
    google_ads_campaign_id: '',
    notes: '',
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const response = await fetch(`/api/campaigns?${params}`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  const fetchOptimizationData = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns/optimize');
      if (response.ok) {
        const data = await response.json();
        setOptimizationLog(data.log || []);
        setOptimizationRules(data.rules || []);
        setBudgetAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching optimization data:', error);
    }
  }, []);

  const checkAdsConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns/sync');
      if (response.ok) {
        const data = await response.json();
        setAdsConnected(data.connected);
      }
    } catch (error) {
      console.error('Error checking ads connection:', error);
      setAdsConnected(false);
    }
  }, []);

  const handleSyncFromAds = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/campaigns/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      console.log('Sync complete:', data);
      // Refresh campaigns and optimization data
      fetchCampaigns();
      fetchOptimizationData();
    } catch (error) {
      console.error('Error syncing from Google Ads:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunOptimizations = async () => {
    setOptimizing(true);
    try {
      const response = await fetch('/api/campaigns/optimize', { method: 'POST' });
      if (!response.ok) throw new Error('Optimization failed');
      const data = await response.json();
      console.log('Optimization complete:', data);
      // Refresh optimization data
      fetchOptimizationData();
    } catch (error) {
      console.error('Error running optimizations:', error);
    } finally {
      setOptimizing(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchOptimizationData();
    checkAdsConnection();
  }, [fetchCampaigns, fetchOptimizationData, checkAdsConnection]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budget_monthly: formData.budget_monthly ? parseFloat(formData.budget_monthly) : 0,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create campaign');

      setShowNewDialog(false);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCampaign) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budget_monthly: formData.budget_monthly ? parseFloat(formData.budget_monthly) : 0,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update campaign');

      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (error) {
      console.error('Error updating campaign:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete campaign');
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      fetchCampaigns();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'google_search',
      status: 'draft',
      budget_monthly: '',
      start_date: '',
      end_date: '',
      target_audience: '',
      google_ads_campaign_id: '',
      notes: '',
    });
  };

  const openEditDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      budget_monthly: campaign.budget_monthly?.toString() || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      target_audience: campaign.target_audience || '',
      google_ads_campaign_id: campaign.google_ads_campaign_id || '',
      notes: campaign.notes || '',
    });
  };

  const getStatusBadge = (status: string) => {
    const config = STATUSES.find((s) => s.value === status);
    return config || { value: status, label: status, color: 'bg-gray-100 text-gray-700' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'bid_increase': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bid_decrease': return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      case 'pause': return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'enable': return <Play className="h-4 w-4 text-green-500" />;
      case 'alert_only': return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      default: return <Zap className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculate totals
  const totals = campaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + (c.total_cost || 0),
      impressions: acc.impressions + (c.total_impressions || 0),
      clicks: acc.clicks + (c.total_clicks || 0),
      conversions: acc.conversions + (c.total_conversions || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );

  if (loading) {
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
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your marketing campaigns and track performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Ads Connection Status */}
          {adsConnected !== null && (
            <Badge variant="outline" className={adsConnected ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}>
              <Cloud className="h-3 w-3 mr-1" />
              {adsConnected ? 'Ads Connected' : 'Not Connected'}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleSyncFromAds}
            disabled={syncing || !adsConnected}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Ads
          </Button>
          <Button
            variant="outline"
            onClick={handleRunOptimizations}
            disabled={optimizing}
          >
            {optimizing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Run Optimizations
          </Button>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  Set up a new marketing campaign
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Q1 2026 Search Campaign"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Budget</Label>
                    <Input
                      type="number"
                      value={formData.budget_monthly}
                      onChange={(e) => setFormData({ ...formData, budget_monthly: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Input
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    placeholder="e.g., High net worth individuals, 45-65"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Google Ads Campaign ID (optional)</Label>
                  <Input
                    value={formData.google_ads_campaign_id}
                    onChange={(e) => setFormData({ ...formData, google_ads_campaign_id: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Campaign notes"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving || !formData.name}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Budget Alerts Banner */}
      {budgetAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{budgetAlerts.length} active budget alert{budgetAlerts.length !== 1 ? 's' : ''}</span>
            <Button
              variant="link"
              size="sm"
              className="text-orange-700 underline p-0 h-auto"
              onClick={() => setActiveTab('alerts')}
            >
              View all
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="optimization" className="gap-2">
            <History className="h-4 w-4" />
            Optimization History
            {optimizationLog.length > 0 && (
              <Badge variant="secondary" className="ml-1">{optimizationLog.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Budget Alerts
            {budgetAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{budgetAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totals.spend)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals.impressions)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals.clicks)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals.conversions)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CAMPAIGN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchCampaigns}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns</CardTitle>
              <CardDescription>
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
              </CardDescription>
            </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Budget</th>
                <th className="text-right p-3">Spend</th>
                <th className="text-right p-3">Clicks</th>
                <th className="text-right p-3">Conv.</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No campaigns found</p>
                    <p className="text-sm">Create your first campaign to get started</p>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const status = getStatusBadge(campaign.status);
                  return (
                    <tr key={campaign.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <span className="font-medium">{campaign.name}</span>
                        {campaign.target_audience && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {campaign.target_audience}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-sm">
                          {CAMPAIGN_TYPES.find((t) => t.value === campaign.type)?.label || campaign.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge className={status.color}>{status.label}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(campaign.budget_monthly || 0)}/mo
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(campaign.total_cost || 0)}
                      </td>
                      <td className="p-3 text-right">
                        {formatNumber(campaign.total_clicks || 0)}
                      </td>
                      <td className="p-3 text-right">
                        {campaign.total_conversions || 0}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(campaign.status === 'active' || campaign.status === 'paused') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(campaign)}
                              title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                            >
                              {campaign.status === 'active' ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(campaign)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
        </TabsContent>

        {/* Optimization History Tab */}
        <TabsContent value="optimization" className="space-y-6">
          {/* Active Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Active Optimization Rules
              </CardTitle>
              <CardDescription>
                Rules that run automatically during optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optimizationRules.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No optimization rules configured</p>
              ) : (
                <div className="space-y-3">
                  {optimizationRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{rule.name}</span>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      </div>
                      <Badge variant={rule.enabled ? 'default' : 'outline'}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optimization Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Optimizations
              </CardTitle>
              <CardDescription>
                History of applied and attempted optimizations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {optimizationLog.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No optimizations have been run yet</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Time</th>
                      <th className="text-left p-3">Entity</th>
                      <th className="text-left p-3">Action</th>
                      <th className="text-left p-3">Rule</th>
                      <th className="text-left p-3">Reason</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationLog.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDate(log.created_at)}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-medium">{log.entity_name}</span>
                          <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <span className="text-sm">{log.action.replace('_', ' ')}</span>
                            {log.change_percentage && (
                              <Badge variant="outline">{log.change_percentage > 0 ? '+' : ''}{log.change_percentage}%</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm">{log.rule_name}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {log.reason}
                          </span>
                        </td>
                        <td className="p-3">
                          {log.status === 'applied' && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Applied
                            </Badge>
                          )}
                          {log.status === 'failed' && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                          {log.status === 'skipped' && (
                            <Badge variant="outline">Skipped</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Budget Alerts
              </CardTitle>
              <CardDescription>
                Active budget pacing and spending alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {budgetAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">No active budget alerts</p>
                  <p className="text-sm text-muted-foreground">All campaigns are pacing within normal limits</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {budgetAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${getAlertSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 mt-0.5" />
                          <div>
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-sm mt-1">
                              Daily Budget: {formatCurrency(alert.daily_budget)} |
                              Current Spend: {formatCurrency(alert.current_spend)} |
                              Pacing: {alert.pacing_percentage.toFixed(0)}%
                            </p>
                            <p className="text-xs mt-2 opacity-75">
                              {formatDate(alert.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {alert.severity}
                        </Badge>
                      </div>
                      {/* Budget Pacing Bar */}
                      <div className="mt-4">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${alert.pacing_percentage > 150 ? 'bg-red-500' : alert.pacing_percentage > 100 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(alert.pacing_percentage, 200) / 2}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1 opacity-75">
                          <span>0%</span>
                          <span>100%</span>
                          <span>200%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update campaign details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <Input
                type="number"
                value={formData.budget_monthly}
                onChange={(e) => setFormData({ ...formData, budget_monthly: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Input
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Google Ads Campaign ID</Label>
              <Input
                value={formData.google_ads_campaign_id}
                onChange={(e) => setFormData({ ...formData, google_ads_campaign_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedCampaign(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
