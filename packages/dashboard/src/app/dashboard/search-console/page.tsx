'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  MousePointerClick,
  Eye,
  TrendingUp,
  Hash,
  Search,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

interface SearchConsoleData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
  };
  dailyMetrics: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: '#0088FE',
  MOBILE: '#00C49F',
  TABLET: '#FFBB28',
};

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  DESKTOP: Monitor,
  MOBILE: Smartphone,
  TABLET: Tablet,
};

type SortField = 'clicks' | 'impressions' | 'ctr' | 'position';

export default function SearchConsolePage() {
  const [data, setData] = useState<SearchConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [querySortBy, setQuerySortBy] = useState<SortField>('clicks');
  const [pageSortBy, setPageSortBy] = useState<SortField>('clicks');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/search-console?days=${dateRange}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err) {
      console.error('Error fetching search console data:', err);
      setError('Failed to fetch search console data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCtr = (ctr: number) => {
    return `${(ctr * 100).toFixed(1)}%`;
  };

  const formatPosition = (position: number) => {
    return position.toFixed(1);
  };

  const sortItems = <T extends Record<string, unknown>>(items: T[], sortBy: SortField): T[] => {
    return [...items].sort((a, b) => {
      if (sortBy === 'position') {
        return (a[sortBy] as number) - (b[sortBy] as number); // Lower position is better
      }
      return (b[sortBy] as number) - (a[sortBy] as number);
    });
  };

  const getPagePath = (fullUrl: string) => {
    try {
      const url = new URL(fullUrl);
      return url.pathname;
    } catch {
      return fullUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Search Console</h1>
          <p className="text-muted-foreground">Google Search performance for arcvest.com</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Search className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Failed to load Search Console data</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchData} className="mt-3">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Search Console</h1>
          <p className="text-muted-foreground">
            Google Search performance for arcvest.com &middot; Data delayed ~3 days
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.summary.totalClicks || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.summary.totalImpressions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Times shown in search results
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCtr(data?.summary.averageCtr || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Position</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPosition(data?.summary.averagePosition || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average ranking position
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Search Performance</CardTitle>
          <CardDescription>Daily clicks and impressions from Google Search</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.dailyMetrics && data.dailyMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Impressions') return [formatNumber(value), name];
                    return [formatNumber(value), name];
                  }}
                  labelFormatter={formatDate}
                />
                <Legend />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  name="Impressions"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#0088FE"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No daily metrics available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Queries & Top Pages */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Queries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Queries</CardTitle>
                <CardDescription>Search terms driving traffic</CardDescription>
              </div>
              <Select value={querySortBy} onValueChange={(v) => setQuerySortBy(v as SortField)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clicks">Sort by Clicks</SelectItem>
                  <SelectItem value="impressions">Sort by Impressions</SelectItem>
                  <SelectItem value="ctr">Sort by CTR</SelectItem>
                  <SelectItem value="position">Sort by Position</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {data?.topQueries && data.topQueries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Query</th>
                      <th className="text-right py-3 px-2">Clicks</th>
                      <th className="text-right py-3 px-2">Impr.</th>
                      <th className="text-right py-3 px-2">CTR</th>
                      <th className="text-right py-3 px-2">Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortItems(data.topQueries, querySortBy).map((query) => (
                      <tr key={query.query} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">{query.query}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">{formatNumber(query.clicks)}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(query.impressions)}</td>
                        <td className="py-2 px-2 text-right">{formatCtr(query.ctr)}</td>
                        <td className="py-2 px-2 text-right">{formatPosition(query.position)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No query data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Best performing pages in search</CardDescription>
              </div>
              <Select value={pageSortBy} onValueChange={(v) => setPageSortBy(v as SortField)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clicks">Sort by Clicks</SelectItem>
                  <SelectItem value="impressions">Sort by Impressions</SelectItem>
                  <SelectItem value="ctr">Sort by CTR</SelectItem>
                  <SelectItem value="position">Sort by Position</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {data?.topPages && data.topPages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Page</th>
                      <th className="text-right py-3 px-2">Clicks</th>
                      <th className="text-right py-3 px-2">Impr.</th>
                      <th className="text-right py-3 px-2">CTR</th>
                      <th className="text-right py-3 px-2">Pos.</th>
                      <th className="text-right py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortItems(data.topPages, pageSortBy).map((page) => (
                      <tr key={page.page} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <span className="font-medium truncate max-w-[200px] block">
                            {getPagePath(page.page)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">{formatNumber(page.clicks)}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(page.impressions)}</td>
                        <td className="py-2 px-2 text-right">{formatCtr(page.ctr)}</td>
                        <td className="py-2 px-2 text-right">{formatPosition(page.position)}</td>
                        <td className="py-2 px-2 text-right">
                          <a
                            href={page.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No page data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Device Breakdown</CardTitle>
          <CardDescription>Clicks by device type</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.deviceBreakdown && data.deviceBreakdown.length > 0 ? (
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="40%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={data.deviceBreakdown.map((item) => ({
                      name: item.device,
                      value: item.clicks,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.deviceBreakdown.map((entry) => (
                      <Cell
                        key={entry.device}
                        fill={DEVICE_COLORS[entry.device] || '#8884d8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [formatNumber(value), name]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-4">
                {data.deviceBreakdown.map((device) => {
                  const DeviceIcon = DEVICE_ICONS[device.device] || Monitor;
                  const totalClicks = data.deviceBreakdown.reduce((sum, d) => sum + d.clicks, 0);
                  const percentage = totalClicks > 0
                    ? ((device.clicks / totalClicks) * 100).toFixed(1)
                    : '0';
                  return (
                    <div key={device.device} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="rounded-lg p-2"
                          style={{ backgroundColor: `${DEVICE_COLORS[device.device] || '#8884d8'}20` }}
                        >
                          <DeviceIcon
                            className="h-5 w-5"
                            style={{ color: DEVICE_COLORS[device.device] || '#8884d8' }}
                          />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{device.device.toLowerCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(device.impressions)} impressions &middot; {formatCtr(device.ctr)} CTR
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatNumber(device.clicks)}</p>
                        <p className="text-xs text-muted-foreground">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No device data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
