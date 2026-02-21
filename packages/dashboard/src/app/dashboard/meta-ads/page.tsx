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
  RefreshCw,
  Loader2,
  DollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  Cloud,
  Target,
  BarChart3,
  Users,
  ImageIcon,
  Calendar,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  platform: string;
  meta_campaign_id: string | null;
  created_at: string;
  updated_at: string;
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  avg_ctr: number;
  avg_cpc: number;
}

interface MetaInsightRow {
  id: string;
  object_id: string;
  object_type: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: string | number;
  reach: number;
  ctr: string | number;
  cpc: string | number;
  cpm: string | number;
  actions: Record<string, unknown> | null;
  created_at: string;
}

interface InsightsSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  meta_ad_set_id: string | null;
  targeting: Record<string, unknown> | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_amount: number | null;
  optimization_goal: string | null;
  created_at: string;
  campaigns?: { name: string; status: string } | null;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  ad_set_id: string;
  meta_ad_id: string | null;
  creative: Record<string, unknown> | null;
  created_at: string;
  meta_ad_sets?: { name: string; status: string; campaign_id: string } | null;
}

interface ConnectionStatus {
  connected: boolean;
  identity?: Record<string, unknown>;
  account?: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  PAUSED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DELETED: 'bg-red-100 text-red-700 border-red-200',
  deleted: 'bg-red-100 text-red-700 border-red-200',
  ARCHIVED: 'bg-gray-100 text-gray-700 border-gray-200',
  archived: 'bg-gray-100 text-gray-700 border-gray-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Recharts
// ---------------------------------------------------------------------------

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.name === 'Spend' ? formatCurrency(entry.value) : formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaAdsPage Component
// ---------------------------------------------------------------------------

export default function MetaAdsPage() {
  // Data state
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<MetaInsightRow[]>([]);
  const [insightsSummary, setInsightsSummary] = useState<InsightsSummary>({
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalReach: 0,
    avgCtr: 0,
    avgCpc: 0,
  });
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30');
  const [activeTab, setActiveTab] = useState('campaigns');

  // -------------------------------------------------------------------------
  // Data fetching functions
  // -------------------------------------------------------------------------

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/meta-ads');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching Meta campaigns:', error);
    }
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const response = await fetch(`/api/meta-ads/insights?days=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      setInsights(data.insights || []);
      setInsightsSummary(
        data.summary || {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalReach: 0,
          avgCtr: 0,
          avgCpc: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching Meta insights:', error);
    }
  }, [dateRange]);

  const fetchAdSets = useCallback(async () => {
    try {
      const response = await fetch('/api/meta-ads/ad-sets');
      if (!response.ok) throw new Error('Failed to fetch ad sets');
      const data = await response.json();
      setAdSets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching Meta ad sets:', error);
    }
  }, []);

  const fetchAds = useCallback(async () => {
    try {
      const response = await fetch('/api/meta-ads/ads');
      if (!response.ok) throw new Error('Failed to fetch ads');
      const data = await response.json();
      setAds(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching Meta ads:', error);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/meta-ads/sync');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      } else {
        setConnectionStatus({ connected: false });
      }
    } catch (error) {
      console.error('Error checking Meta connection:', error);
      setConnectionStatus({ connected: false });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Sync handler
  // -------------------------------------------------------------------------

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      console.log('Meta Ads sync complete:', data);

      // Refetch all data after a successful sync
      await Promise.all([
        fetchCampaigns(),
        fetchInsights(),
        fetchAdSets(),
        fetchAds(),
        checkConnection(),
      ]);
    } catch (error) {
      console.error('Error syncing Meta Ads:', error);
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCampaigns(),
        fetchInsights(),
        fetchAdSets(),
        fetchAds(),
        checkConnection(),
      ]);
      setLoading(false);
    };
    loadAllData();
  }, [fetchCampaigns, fetchInsights, fetchAdSets, fetchAds, checkConnection]);

  // -------------------------------------------------------------------------
  // Computed data
  // -------------------------------------------------------------------------

  // Aggregate chart data: group insights by date for chart visualization
  const chartData = insights.reduce<
    Array<{ date: string; spend: number; impressions: number; clicks: number }>
  >((acc, row) => {
    const dateStr = row.date;
    const existing = acc.find((d) => d.date === dateStr);
    const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
    if (existing) {
      existing.spend += spend;
      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
    } else {
      acc.push({
        date: dateStr,
        spend,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
      });
    }
    return acc;
  }, []);

  // KPI values
  const kpiSpend = insightsSummary.totalSpend;
  const kpiImpressions = insightsSummary.totalImpressions;
  const kpiClicks = insightsSummary.totalClicks;
  const kpiAvgCtr = insightsSummary.avgCtr;

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header Row                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meta Ads</h1>
          <p className="text-muted-foreground">
            Manage your Meta advertising campaigns and track performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-28">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Sync button */}
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing || !connectionStatus?.connected}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Meta
          </Button>

          {/* Connection badge */}
          {connectionStatus !== null && (
            <Badge
              variant="outline"
              className={
                connectionStatus.connected
                  ? 'border-green-500 text-green-600'
                  : 'border-red-500 text-red-600'
              }
            >
              <Cloud className="h-3 w-3 mr-1" />
              {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* KPI Cards Row                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpiSpend)}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpiImpressions)}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpiClicks)}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(kpiAvgCtr)}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tabs                                                              */}
      {/* ----------------------------------------------------------------- */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-2">
            <Users className="h-4 w-4" />
            Audiences
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Ad Creatives
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------------------- */}
        {/* Tab 1: Campaigns                                                */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta Campaigns</CardTitle>
              <CardDescription>
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} synced from Meta Ads
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-2 py-2 font-medium text-sm">Name</th>
                      <th className="text-left px-2 py-2 font-medium text-sm">Status</th>
                      <th className="text-left px-2 py-2 font-medium text-sm">Objective</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">Budget</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">Spend</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">Impr.</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">Clicks</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">CPC</th>
                      <th className="text-right px-2 py-2 font-medium text-sm">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-muted-foreground">
                          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">No campaigns found</p>
                          <p className="text-sm mt-1">
                            Click &ldquo;Sync from Meta&rdquo; to pull your campaigns
                          </p>
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-2">
                            <span className="font-medium text-sm">{campaign.name}</span>
                          </td>
                          <td className="px-2 py-2">
                            <Badge className={getStatusColor(campaign.status)}>
                              {getStatusLabel(campaign.status)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-sm">
                              {campaign.objective
                                ? campaign.objective.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                                : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-sm">
                            {campaign.daily_budget
                              ? formatCurrency(campaign.daily_budget / 100)
                              : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-sm font-medium">
                            {formatCurrency(campaign.total_cost || 0)}
                          </td>
                          <td className="px-2 py-2 text-right text-sm">
                            {formatNumber(campaign.total_impressions || 0)}
                          </td>
                          <td className="px-2 py-2 text-right text-sm">
                            {formatNumber(campaign.total_clicks || 0)}
                          </td>
                          <td className="px-2 py-2 text-right text-sm">
                            {campaign.avg_cpc ? formatCurrency(campaign.avg_cpc) : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-sm">
                            {formatPercent(campaign.avg_ctr || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ad Sets sub-section */}
          {adSets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ad Sets</CardTitle>
                <CardDescription>
                  {adSets.length} ad set{adSets.length !== 1 ? 's' : ''} across your campaigns
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium text-sm">Name</th>
                        <th className="text-left p-3 font-medium text-sm">Campaign</th>
                        <th className="text-left p-3 font-medium text-sm">Status</th>
                        <th className="text-left p-3 font-medium text-sm">Optimization Goal</th>
                        <th className="text-right p-3 font-medium text-sm">Daily Budget</th>
                        <th className="text-right p-3 font-medium text-sm">Bid Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adSets.map((adSet) => (
                        <tr key={adSet.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <span className="font-medium">{adSet.name}</span>
                            {adSet.meta_ad_set_id && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ID: {adSet.meta_ad_set_id}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-sm">
                            {adSet.campaigns?.name || '-'}
                          </td>
                          <td className="p-3">
                            <Badge className={getStatusColor(adSet.status)}>
                              {getStatusLabel(adSet.status)}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">
                            {adSet.optimization_goal
                              ? adSet.optimization_goal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                              : '-'}
                          </td>
                          <td className="p-3 text-right">
                            {adSet.daily_budget
                              ? formatCurrency(adSet.daily_budget / 100)
                              : '-'}
                          </td>
                          <td className="p-3 text-right">
                            {adSet.bid_amount
                              ? formatCurrency(adSet.bid_amount / 100)
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Tab 2: Insights                                                 */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="insights" className="space-y-6">
          {/* Spend over time chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Spend</CardTitle>
              <CardDescription>
                Advertising spend over the last {dateRange} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No insight data available</p>
                  <p className="text-sm mt-1">
                    Sync your Meta Ads data to see performance charts
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => {
                        const d = new Date(value);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      name="Spend"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#3b82f6' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Impressions & Clicks bar chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Impressions & Clicks</CardTitle>
                <CardDescription>
                  Daily impressions and clicks comparison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => {
                        const d = new Date(value);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="impressions"
                      name="Impressions"
                      fill="#93c5fd"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="clicks"
                      name="Clicks"
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Daily insights table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>
                {new Set(insights.map((i) => i.date)).size} day{new Set(insights.map((i) => i.date)).size !== 1 ? 's' : ''} of insight data
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-sm">Date</th>
                      <th className="text-right p-3 font-medium text-sm">Impressions</th>
                      <th className="text-right p-3 font-medium text-sm">Reach</th>
                      <th className="text-right p-3 font-medium text-sm">Clicks</th>
                      <th className="text-right p-3 font-medium text-sm">Spend</th>
                      <th className="text-right p-3 font-medium text-sm">CTR</th>
                      <th className="text-right p-3 font-medium text-sm">CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">No insights data</p>
                          <p className="text-sm mt-1">
                            Sync your Meta Ads data to see daily breakdowns
                          </p>
                        </td>
                      </tr>
                    ) : (
                      // Aggregate insights by date (multiple campaigns per day)
                      Object.values(
                        insights.reduce<Record<string, { date: string; impressions: number; reach: number; clicks: number; spend: number }>>((acc, row) => {
                          const d = row.date;
                          const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
                          if (!acc[d]) {
                            acc[d] = { date: d, impressions: 0, reach: 0, clicks: 0, spend: 0 };
                          }
                          acc[d].impressions += row.impressions || 0;
                          acc[d].reach += row.reach || 0;
                          acc[d].clicks += row.clicks || 0;
                          acc[d].spend += spend;
                          return acc;
                        }, {})
                      )
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((day) => {
                          const ctr = day.impressions > 0 ? day.clicks / day.impressions : 0;
                          const cpc = day.clicks > 0 ? day.spend / day.clicks : 0;

                          return (
                            <tr key={day.date} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="p-3 font-medium">{formatDate(day.date)}</td>
                              <td className="p-3 text-right">{formatNumber(day.impressions)}</td>
                              <td className="p-3 text-right">{formatNumber(day.reach)}</td>
                              <td className="p-3 text-right">{formatNumber(day.clicks)}</td>
                              <td className="p-3 text-right font-medium">{formatCurrency(day.spend)}</td>
                              <td className="p-3 text-right">{formatPercent(ctr)}</td>
                              <td className="p-3 text-right">{formatCurrency(cpc)}</td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary card */}
          {insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Period Summary</CardTitle>
                <CardDescription>
                  Aggregated metrics for the last {dateRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Spend</p>
                    <p className="text-lg font-bold">{formatCurrency(insightsSummary.totalSpend)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-lg font-bold">{formatNumber(insightsSummary.totalImpressions)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Clicks</p>
                    <p className="text-lg font-bold">{formatNumber(insightsSummary.totalClicks)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Reach</p>
                    <p className="text-lg font-bold">{formatNumber(insightsSummary.totalReach)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg CTR</p>
                    <p className="text-lg font-bold">{formatPercent(insightsSummary.avgCtr)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg CPC</p>
                    <p className="text-lg font-bold">{formatCurrency(insightsSummary.avgCpc)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Tab 3: Audiences                                                */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="audiences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Audience Demographics
              </CardTitle>
              <CardDescription>
                Demographic breakdowns from your Meta Ads audience data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Info className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium text-center">
                  Sync data to see audience breakdowns
                </p>
                <p className="text-sm mt-2 text-center max-w-md">
                  Demographic data will appear here after the first sync with breakdown data.
                  Audience insights include age, gender, and location breakdowns from your
                  Meta Ads campaigns.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={handleSync}
                  disabled={syncing || !connectionStatus?.connected}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Targeting summary from ad sets */}
          {adSets.filter((a) => a.targeting).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ad Set Targeting</CardTitle>
                <CardDescription>
                  Targeting configuration across your ad sets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adSets
                    .filter((adSet) => adSet.targeting)
                    .map((adSet) => (
                      <div
                        key={adSet.id}
                        className="p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{adSet.name}</span>
                          <Badge className={getStatusColor(adSet.status)}>
                            {getStatusLabel(adSet.status)}
                          </Badge>
                        </div>
                        <pre className="text-xs text-muted-foreground bg-white p-3 rounded border overflow-x-auto max-h-40">
                          {JSON.stringify(adSet.targeting, null, 2)}
                        </pre>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Tab 4: Ad Creatives                                             */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="creatives" className="space-y-6">
          {ads.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No ad creatives synced yet</p>
                  <p className="text-sm mt-1">
                    Click &ldquo;Sync from Meta&rdquo; to pull your Meta ads
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={handleSync}
                    disabled={syncing || !connectionStatus?.connected}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {ads.length} Ad Creative{ads.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Synced from your Meta Ads account
                  </p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {ads.map((ad) => (
                  <Card key={ad.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {ad.name}
                          </CardTitle>
                          {ad.meta_ad_sets?.name && (
                            <CardDescription className="truncate">
                              Ad Set: {ad.meta_ad_sets.name}
                            </CardDescription>
                          )}
                        </div>
                        <Badge className={`ml-2 shrink-0 ${getStatusColor(ad.status)}`}>
                          {getStatusLabel(ad.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {ad.meta_ad_id && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Meta Ad ID: {ad.meta_ad_id}
                        </p>
                      )}
                      {ad.creative ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Creative Data
                          </p>
                          <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-48">
                            {JSON.stringify(ad.creative, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 p-3 rounded border">
                          <Info className="h-4 w-4 shrink-0" />
                          <span>No creative data available</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        Created {formatDate(ad.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
