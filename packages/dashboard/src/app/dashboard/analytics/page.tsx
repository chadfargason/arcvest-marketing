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
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  Users,
  TrendingUp,
  RefreshCw,
  BarChart3,
  PieChart,
  Loader2,
  Globe,
  Clock,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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

interface AnalyticsData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  ga4Error: string | null;
  overview: {
    totalSpend: string;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalLeads: number;
    totalClients: number;
    ctr: string;
    cpc: string;
    cpa: string;
    costPerLead: string;
    conversionRate: string;
  };
  websiteTraffic: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: string;
    avgSessionDuration: number;
    newUsers: number;
    dailyTraffic: Array<{
      date: string;
      sessions: number;
      users: number;
      pageviews: number;
    }>;
    trafficSources: Array<{
      source: string;
      medium: string;
      sessions: number;
      users: number;
    }>;
    topPages: Array<{
      pagePath: string;
      pageTitle: string;
      pageviews: number;
      avgTimeOnPage: number;
    }>;
  } | null;
  campaigns: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    budget_monthly: number;
    total_impressions: number;
    total_clicks: number;
    total_cost: number;
    total_conversions: number;
    avg_ctr: number;
    avg_cpc: number;
    avg_cpa: number | null;
  }>;
  dailyMetrics: Array<{
    date: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
  }>;
  leadsByDate: Array<{
    date: string;
    leads: number;
  }>;
  leadFunnel: Array<{
    status: string;
    count: number;
    avg_score: number;
    avg_days_in_status: number;
  }>;
  sourcePerformance: Array<{
    source: string | null;
    total_leads: number;
    clients_won: number;
    conversion_rate: number;
    avg_lead_score: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const STATUS_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  consultation_scheduled: 'Consultation Scheduled',
  consultation_completed: 'Consultation Completed',
  proposal_sent: 'Proposal Sent',
  client: 'Client',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?days=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          <h1 className="text-2xl font-bold">Marketing Analytics</h1>
          <p className="text-muted-foreground">
            Track your marketing performance and ROI
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

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.overview.totalSpend || '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per Lead</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.overview.costPerLead || '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.overview.totalLeads || 0} leads generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.overview.totalConversions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              CPA: {formatCurrency(data?.overview.cpa || '0')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Conv. Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.overview.conversionRate || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.overview.totalClients || 0} clients from leads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-100 p-2">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-xl font-bold">
                  {formatNumber(data?.overview.totalImpressions || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-100 p-2">
                <MousePointerClick className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-xl font-bold">
                  {formatNumber(data?.overview.totalClicks || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-100 p-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CTR</p>
                <p className="text-xl font-bold">
                  {data?.overview.ctr || '0.00'}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-orange-100 p-2">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPC</p>
                <p className="text-xl font-bold">
                  {formatCurrency(data?.overview.cpc || '0')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GA4 Error Banner */}
      {data?.ga4Error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <Globe className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800">Google Analytics Connection Error</p>
                <p className="text-sm text-red-600 mt-1">{data.ga4Error}</p>
                <p className="text-xs text-red-500 mt-2">
                  Test the connection at: /api/cron/analytics-sync?test=true
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Website Traffic Section (GA4 Data) */}
      {data?.websiteTraffic && (
        <>
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website Analytics (arcvest.com)
            </h2>
          </div>

          {/* Website Traffic Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(data.websiteTraffic.sessions)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(data.websiteTraffic.newUsers)} new users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(data.websiteTraffic.users)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unique visitors
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pageviews</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(data.websiteTraffic.pageviews)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total page views
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Session</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(data.websiteTraffic.avgSessionDuration)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.websiteTraffic.bounceRate}% bounce rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Website Traffic Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily Traffic Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Website Traffic</CardTitle>
                <CardDescription>Daily sessions and pageviews from GA4</CardDescription>
              </CardHeader>
              <CardContent>
                {data.websiteTraffic.dailyTraffic && data.websiteTraffic.dailyTraffic.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.websiteTraffic.dailyTraffic}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatNumber(value), name]}
                        labelFormatter={formatDate}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sessions"
                        name="Sessions"
                        stroke="#0088FE"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pageviews"
                        name="Pageviews"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No traffic data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Where your visitors come from</CardDescription>
              </CardHeader>
              <CardContent>
                {data.websiteTraffic.trafficSources && data.websiteTraffic.trafficSources.length > 0 ? (
                  <div className="space-y-4">
                    {data.websiteTraffic.trafficSources.slice(0, 8).map((source, index) => {
                      const totalSessions = data.websiteTraffic!.trafficSources.reduce(
                        (sum, s) => sum + s.sessions,
                        0
                      );
                      const percentage = totalSessions > 0
                        ? ((source.sessions / totalSessions) * 100).toFixed(1)
                        : '0';
                      return (
                        <div key={`${source.source}-${source.medium}`} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-medium">
                                {source.source === '(direct)' ? 'Direct' : source.source}
                              </span>
                              <span className="text-muted-foreground">/ {source.medium}</span>
                            </div>
                            <span>{formatNumber(source.sessions)} ({percentage}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No source data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most visited pages on arcvest.com</CardDescription>
            </CardHeader>
            <CardContent>
              {data.websiteTraffic.topPages && data.websiteTraffic.topPages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Page</th>
                        <th className="text-right py-3 px-2">Pageviews</th>
                        <th className="text-right py-3 px-2">Avg. Time</th>
                        <th className="text-right py-3 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.websiteTraffic.topPages.map((page) => (
                        <tr key={page.pagePath} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium truncate max-w-md">
                                {page.pageTitle || page.pagePath}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-md">
                                {page.pagePath}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {formatNumber(page.pageviews)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {formatDuration(page.avgTimeOnPage)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <a
                              href={`https://arcvest.com${page.pagePath}`}
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

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Paid Advertising
            </h2>
          </div>
        </>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Spend & Performance</CardTitle>
            <CardDescription>Daily ad spend and conversions</CardDescription>
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
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'cost') return [formatCurrency(value), 'Spend'];
                      return [formatNumber(value), name.charAt(0).toUpperCase() + name.slice(1)];
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="cost"
                    name="Spend"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="conversions"
                    name="Conversions"
                    stroke="#82ca9d"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No campaign data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Generation</CardTitle>
            <CardDescription>New leads over time</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.leadsByDate && data.leadsByDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.leadsByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Leads']}
                    labelFormatter={formatDate}
                  />
                  <Bar dataKey="leads" fill="#0088FE" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No leads data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Funnel and Source Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Funnel</CardTitle>
            <CardDescription>Distribution by pipeline stage</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.leadFunnel && data.leadFunnel.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.leadFunnel.map((item) => ({
                    ...item,
                    name: STATUS_LABELS[item.status] || item.status,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={130}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} contacts`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]}>
                    {data.leadFunnel.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No funnel data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Performance by acquisition channel</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.sourcePerformance && data.sourcePerformance.length > 0 ? (
              <div className="flex gap-4">
                <ResponsiveContainer width="50%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={data.sourcePerformance.map((item) => ({
                        name: item.source || 'Unknown',
                        value: item.total_leads,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {data.sourcePerformance.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {data.sourcePerformance.slice(0, 5).map((source, index) => (
                    <div
                      key={source.source || 'unknown'}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{source.source || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{source.total_leads}</span>
                        <span className="text-muted-foreground ml-2">
                          ({source.conversion_rate?.toFixed(1) || 0}% conv)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No source data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Breakdown by campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.campaigns && data.campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Campaign</th>
                    <th className="text-left py-3 px-2">Type</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-right py-3 px-2">Impressions</th>
                    <th className="text-right py-3 px-2">Clicks</th>
                    <th className="text-right py-3 px-2">CTR</th>
                    <th className="text-right py-3 px-2">Spend</th>
                    <th className="text-right py-3 px-2">CPC</th>
                    <th className="text-right py-3 px-2">Conv.</th>
                    <th className="text-right py-3 px-2">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{campaign.name}</td>
                      <td className="py-3 px-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                          {campaign.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            campaign.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : campaign.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {formatNumber(campaign.total_impressions)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {formatNumber(campaign.total_clicks)}
                      </td>
                      <td className="py-3 px-2 text-right">{campaign.avg_ctr}%</td>
                      <td className="py-3 px-2 text-right">
                        {formatCurrency(campaign.total_cost)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {formatCurrency(campaign.avg_cpc)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.total_conversions}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.avg_cpa ? formatCurrency(campaign.avg_cpa) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PieChart className="h-12 w-12 mb-4 opacity-50" />
              <p>No campaign data available</p>
              <p className="text-sm">
                Campaign metrics will appear here once you connect Google Ads
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
