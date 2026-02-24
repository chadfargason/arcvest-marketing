'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  DollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  BarChart2,
  Calendar,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface AdCampaign {
  id: string;
  name: string;
  platform: 'google' | 'meta';
  type: string | null;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_monthly: number | null;
  meta_campaign_id: string | null;
  google_ads_campaign_id: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface PlatformSummary {
  campaigns: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface DailySpend {
  date: string;
  google: number;
  meta: number;
}

interface AdPerformanceData {
  campaigns: AdCampaign[];
  summary: {
    all: PlatformSummary;
    google: PlatformSummary;
    meta: PlatformSummary;
  };
  dailySpend: DailySpend[];
}

type SortOption =
  | 'cpc_asc'
  | 'ctr_desc'
  | 'roas_desc'
  | 'spend_desc'
  | 'clicks_desc'
  | 'impressions_desc';

type PlatformFilter = 'all' | 'google' | 'meta';

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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRoas(value: number): string {
  if (value <= 0) return '-';
  return `${value.toFixed(1)}x`;
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
// Platform badge helpers
// ---------------------------------------------------------------------------

const PLATFORM_STYLES: Record<string, { badge: string; border: string; label: string }> = {
  google: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    border: 'border-l-emerald-500',
    label: 'Google',
  },
  meta: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    border: 'border-l-blue-500',
    label: 'Meta',
  },
};

function getPlatformStyle(platform: string) {
  return PLATFORM_STYLES[platform] || PLATFORM_STYLES.meta;
}

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'cpc_asc', label: 'Lowest CPC' },
  { value: 'ctr_desc', label: 'Highest CTR' },
  { value: 'roas_desc', label: 'Highest ROAS' },
  { value: 'spend_desc', label: 'Most Spend' },
  { value: 'clicks_desc', label: 'Most Clicks' },
  { value: 'impressions_desc', label: 'Most Impressions' },
];

function sortCampaigns(campaigns: AdCampaign[], sortBy: SortOption): AdCampaign[] {
  const sorted = [...campaigns];
  switch (sortBy) {
    case 'cpc_asc':
      return sorted.sort((a, b) => {
        // Put campaigns with no clicks (cpc = 0) at the end
        if (a.cpc === 0 && b.cpc === 0) return 0;
        if (a.cpc === 0) return 1;
        if (b.cpc === 0) return -1;
        return a.cpc - b.cpc;
      });
    case 'ctr_desc':
      return sorted.sort((a, b) => b.ctr - a.ctr);
    case 'roas_desc':
      return sorted.sort((a, b) => b.roas - a.roas);
    case 'spend_desc':
      return sorted.sort((a, b) => b.spend - a.spend);
    case 'clicks_desc':
      return sorted.sort((a, b) => b.clicks - a.clicks);
    case 'impressions_desc':
      return sorted.sort((a, b) => b.impressions - a.impressions);
    default:
      return sorted;
  }
}

// ---------------------------------------------------------------------------
// Platform Summary Card Component
// ---------------------------------------------------------------------------

function PlatformSummaryCard({
  title,
  summary,
  borderColor,
  icon,
}: {
  title: string;
  summary: PlatformSummary;
  borderColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">{formatCurrency(summary.spend)}</div>
          <p className="text-xs text-muted-foreground">
            {summary.campaigns} campaign{summary.campaigns !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Impressions</p>
            <p className="font-medium">{formatNumber(summary.impressions)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="font-medium">{formatNumber(summary.clicks)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPC</p>
            <p className="font-medium">
              {summary.clicks > 0 ? formatCurrency(summary.cpc) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="font-medium">
              {summary.impressions > 0 ? formatPercent(summary.ctr) : '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AdPerformancePage Component
// ---------------------------------------------------------------------------

export default function AdPerformancePage() {
  // Data state
  const [data, setData] = useState<AdPerformanceData | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('30');
  const [sortBy, setSortBy] = useState<SortOption>('cpc_asc');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/ad-performance?days=${dateRange}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch ad performance data');
      }
      const result: AdPerformanceData = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching ad performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, [dateRange]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Computed data
  // ---------------------------------------------------------------------------

  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    let campaigns = data.campaigns;
    if (platformFilter !== 'all') {
      campaigns = campaigns.filter((c) => c.platform === platformFilter);
    }
    return sortCampaigns(campaigns, sortBy);
  }, [data, platformFilter, sortBy]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-2">
          <BarChart2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="font-medium text-muted-foreground">Error loading data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    all: { campaigns: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0 },
    google: { campaigns: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0 },
    meta: { campaigns: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0 },
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* ------------------------------------------------------------------- */}
      {/* Header Row                                                          */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Performance</h1>
          <p className="text-muted-foreground">
            Cross-platform comparison of Google and Meta campaigns
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
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Platform Summary Cards                                              */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <PlatformSummaryCard
          title="All Platforms"
          summary={summary.all}
          borderColor="border-l-gray-400"
          icon={<BarChart2 className="h-4 w-4 text-muted-foreground" />}
        />
        <PlatformSummaryCard
          title="Google Ads"
          summary={summary.google}
          borderColor="border-l-emerald-500"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
        />
        <PlatformSummaryCard
          title="Meta Ads"
          summary={summary.meta}
          borderColor="border-l-blue-500"
          icon={<Eye className="h-4 w-4 text-blue-600" />}
        />
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Campaign Comparison Table                                           */}
      {/* ------------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaign Comparison</CardTitle>
              <CardDescription>
                {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}
                {platformFilter !== 'all' ? ` on ${platformFilter === 'google' ? 'Google' : 'Meta'}` : ' across all platforms'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Platform filter */}
              <div className="flex items-center rounded-lg border bg-gray-50">
                {(['all', 'google', 'meta'] as PlatformFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPlatformFilter(filter)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      platformFilter === filter
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'google' ? 'Google' : 'Meta'}
                  </button>
                ))}
              </div>

              {/* Sort selector */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-44">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-2 py-2 font-medium text-sm">Platform</th>
                  <th className="text-left px-2 py-2 font-medium text-sm">Campaign Name</th>
                  <th className="text-left px-2 py-2 font-medium text-sm">Status</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">Spend</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">Impr.</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">Clicks</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">CPC</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">CTR</th>
                  <th className="text-right px-2 py-2 font-medium text-sm">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-muted-foreground">
                      <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No campaigns found</p>
                      <p className="text-sm mt-1">
                        {platformFilter !== 'all'
                          ? `No ${platformFilter === 'google' ? 'Google' : 'Meta'} campaigns are currently active or paused. Try selecting "All" platforms.`
                          : 'No active or paused campaigns found. Make sure your campaigns are synced.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((campaign) => {
                    const platformStyle = getPlatformStyle(campaign.platform);
                    return (
                      <tr
                        key={campaign.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-2 py-2">
                          <Badge className={platformStyle.badge}>
                            {platformStyle.label}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-medium text-sm">{campaign.name}</span>
                        </td>
                        <td className="px-2 py-2">
                          <Badge className={getStatusColor(campaign.status)}>
                            {getStatusLabel(campaign.status)}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium">
                          {formatCurrency(campaign.spend)}
                        </td>
                        <td className="px-2 py-2 text-right text-sm">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="px-2 py-2 text-right text-sm">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="px-2 py-2 text-right text-sm">
                          {campaign.clicks > 0 ? formatCurrency(campaign.cpc) : '-'}
                        </td>
                        <td className="px-2 py-2 text-right text-sm">
                          {campaign.impressions > 0 ? formatPercent(campaign.ctr) : '-'}
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium">
                          {formatRoas(campaign.roas)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------- */}
      {/* Key Metrics Comparison (quick glance)                               */}
      {/* ------------------------------------------------------------------- */}
      {/* ------------------------------------------------------------------- */}
      {/* Daily Spend Chart (90 days)                                        */}
      {/* ------------------------------------------------------------------- */}
      {data?.dailySpend && data.dailySpend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Ad Spend</CardTitle>
            <CardDescription>
              Google and Meta spend by day (last 90 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.dailySpend} stackOffset="none">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'google' ? 'Google' : 'Meta',
                  ]}
                  labelFormatter={(d: string) => {
                    const date = new Date(d);
                    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  }}
                />
                <Legend
                  formatter={(value: string) => (value === 'google' ? 'Google Ads' : 'Meta Ads')}
                />
                <Bar dataKey="meta" stackId="spend" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="google" stackId="spend" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {data && data.campaigns.length > 0 && summary.google.campaigns > 0 && summary.meta.campaigns > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Head-to-Head</CardTitle>
            <CardDescription>
              Key metrics compared across Google and Meta for the last {dateRange} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
              {/* CPC comparison */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Cost Per Click
                </p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Google</p>
                    <p className="text-lg font-bold">
                      {summary.google.clicks > 0 ? formatCurrency(summary.google.cpc) : '-'}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm pb-0.5">vs</span>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Meta</p>
                    <p className="text-lg font-bold">
                      {summary.meta.clicks > 0 ? formatCurrency(summary.meta.cpc) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* CTR comparison */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Click-Through Rate
                </p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Google</p>
                    <p className="text-lg font-bold">
                      {summary.google.impressions > 0 ? formatPercent(summary.google.ctr) : '-'}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm pb-0.5">vs</span>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Meta</p>
                    <p className="text-lg font-bold">
                      {summary.meta.impressions > 0 ? formatPercent(summary.meta.ctr) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ROAS comparison */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Return on Ad Spend
                </p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Google</p>
                    <p className="text-lg font-bold">{formatRoas(summary.google.roas)}</p>
                  </div>
                  <span className="text-muted-foreground text-sm pb-0.5">vs</span>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Meta</p>
                    <p className="text-lg font-bold">{formatRoas(summary.meta.roas)}</p>
                  </div>
                </div>
              </div>

              {/* Total Spend comparison */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Total Spend
                </p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Google</p>
                    <p className="text-lg font-bold">{formatCurrency(summary.google.spend)}</p>
                  </div>
                  <span className="text-muted-foreground text-sm pb-0.5">vs</span>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Meta</p>
                    <p className="text-lg font-bold">{formatCurrency(summary.meta.spend)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
