'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Shield,
  Users,
  Minus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  status: string;
  objective: string;
  dailyBudget: number;
  lifetimeBudget: number;
  budgetType: 'daily' | 'lifetime';
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  landingPageViews: number;
  costPerLandingPageView: number;
  linkClicks: number;
  costPerLinkClick: number;
  efficiencyScore: number;
  adSets: Array<{
    id: string;
    name: string;
    status: string;
    dailyBudget: number;
    lifetimeBudget: number;
    optimizationGoal: string;
    targeting: Record<string, unknown>;
  }>;
}

interface PerformanceData {
  campaigns: CampaignPerformance[];
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalSpend: number;
    totalDailyBudget: number;
    projectedMonthlySpend: number;
  };
  days: number;
}

interface YouTubeStats {
  hasData: boolean;
  latest?: {
    date: string;
    subscriberCount: number;
    videoCount: number | null;
    viewCount: number | null;
  };
  delta7: number | null;
  delta30: number | null;
  dailyAvgLast7: number | null;
  dailyAvgLast30: number | null;
  sparkline: Array<{ date: string; subs: number }>;
  snapshotsAvailable: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDollar(n: number, decimals = 2): string {
  return `$${fmt(n, decimals)}`;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getEfficiencyGrade(score: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof Zap;
} {
  if (score === 0 || score >= 999)
    return {
      label: 'NO DATA',
      color: 'text-zinc-400',
      bg: 'bg-zinc-50',
      border: 'border-zinc-200',
      icon: AlertTriangle,
    };
  if (score <= 0.25)
    return {
      label: 'EXCELLENT',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: Zap,
    };
  if (score <= 0.4)
    return {
      label: 'GOOD',
      color: 'text-sky-700',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      icon: Shield,
    };
  if (score <= 0.6)
    return {
      label: 'FAIR',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: TrendingDown,
    };
  return {
    label: 'POOR',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertTriangle,
  };
}

function truncateName(name: string, maxLen = 50): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + '...';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdOptimizerPage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [youtube, setYoutube] = useState<YouTubeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [budgetEdits, setBudgetEdits] = useState<Record<string, number>>({});
  const [savingBudget, setSavingBudget] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    id: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adsRes, ytRes] = await Promise.all([
        fetch(`/api/meta-ads/live-performance?days=${days}`),
        fetch('/api/youtube/stats'),
      ]);
      if (!adsRes.ok) throw new Error(await adsRes.text());
      const adsJson = await adsRes.json();
      setData(adsJson);
      if (ytRes.ok) {
        const ytJson = await ytRes.json();
        setYoutube(ytJson);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showFeedback = (
    id: string,
    message: string,
    type: 'success' | 'error',
  ) => {
    setActionFeedback({ id, message, type });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleBudgetSave = async (campaignId: string, currentBudget: number) => {
    const newBudget = budgetEdits[campaignId];
    if (newBudget === undefined || newBudget === currentBudget) return;

    setSavingBudget(campaignId);
    try {
      const res = await fetch('/api/meta-ads/update-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          type: 'campaign',
          dailyBudget: newBudget,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update');
      }
      showFeedback(campaignId, `Budget updated to ${fmtDollar(newBudget)}`, 'success');
      // Refresh data
      await fetchData();
    } catch (err) {
      showFeedback(
        campaignId,
        err instanceof Error ? err.message : 'Update failed',
        'error',
      );
    } finally {
      setSavingBudget(null);
    }
  };

  const handleStatusToggle = async (
    campaignId: string,
    currentStatus: string,
  ) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setTogglingStatus(campaignId);
    try {
      const res = await fetch('/api/meta-ads/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          type: 'campaign',
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update');
      }
      showFeedback(
        campaignId,
        `Campaign ${newStatus === 'PAUSED' ? 'paused' : 'resumed'}`,
        'success',
      );
      await fetchData();
    } catch (err) {
      showFeedback(
        campaignId,
        err instanceof Error ? err.message : 'Update failed',
        'error',
      );
    } finally {
      setTogglingStatus(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Ad Spend Optimizer
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Reallocate budget from underperformers to top earners
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range pills */}
            <div className="flex bg-zinc-100 rounded-lg p-0.5">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    days === d
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                Fetching live data from Meta...
              </p>
            </div>
          </div>
        )}

        {youtube && <SubscribersPanel stats={youtube} />}

        {data && (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <KpiCard
                label="Total Spend"
                sublabel={`Last ${data.days} days`}
                value={fmtDollar(data.summary.totalSpend, 0)}
                icon={DollarSign}
                accent="text-zinc-700"
              />
              <KpiCard
                label="Daily Budget"
                sublabel="Active campaigns"
                value={fmtDollar(data.summary.totalDailyBudget, 0)}
                icon={Target}
                accent="text-sky-600"
              />
              <KpiCard
                label="Projected Monthly"
                sublabel="At current rate"
                value={fmtDollar(data.summary.projectedMonthlySpend, 0)}
                icon={TrendingUp}
                accent="text-emerald-600"
              />
              <KpiCard
                label="Active Campaigns"
                sublabel={`of ${data.summary.totalCampaigns} total`}
                value={data.summary.activeCampaigns.toString()}
                icon={Zap}
                accent="text-amber-600"
              />
            </div>

            {/* Efficiency Ranking */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Campaign Efficiency Ranking
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Sorted by cost per landing page view — lower is better
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Zap className="h-3 w-3" /> Raise budget
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                  <TrendingDown className="h-3 w-3" /> Lower or pause
                </span>
              </div>
            </div>

            {/* Campaign Cards */}
            <div className="space-y-3">
              {data.campaigns.map((campaign, index) => {
                const grade = getEfficiencyGrade(campaign.efficiencyScore);
                const GradeIcon = grade.icon;
                const isExpanded = expandedCampaign === campaign.campaignId;
                const editBudget = budgetEdits[campaign.campaignId];
                const isSaving = savingBudget === campaign.campaignId;
                const isToggling = togglingStatus === campaign.campaignId;
                const feedback = actionFeedback?.id === campaign.campaignId ? actionFeedback : null;
                const isActive = campaign.status === 'ACTIVE';
                const hasSpend = campaign.spend > 0;

                return (
                  <Card
                    key={campaign.campaignId}
                    className={`overflow-hidden transition-all duration-200 ${
                      !isActive ? 'opacity-60' : ''
                    } ${grade.border} border`}
                  >
                    <div className="p-5">
                      {/* Main Row */}
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-8 text-center">
                          <span className="text-lg font-bold text-zinc-300">
                            {index + 1}
                          </span>
                        </div>

                        {/* Efficiency Badge */}
                        <div
                          className={`flex-shrink-0 w-24 px-2.5 py-1.5 rounded-md text-center ${grade.bg}`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <GradeIcon className={`h-3 w-3 ${grade.color}`} />
                            <span
                              className={`text-[10px] font-bold tracking-wider ${grade.color}`}
                            >
                              {grade.label}
                            </span>
                          </div>
                          {campaign.efficiencyScore > 0 &&
                            campaign.efficiencyScore < 999 && (
                              <p
                                className={`text-xs font-semibold mt-0.5 ${grade.color}`}
                              >
                                {fmtDollar(campaign.efficiencyScore)}/LPV
                              </p>
                            )}
                        </div>

                        {/* Campaign Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-zinc-900 truncate">
                              {truncateName(campaign.campaignName)}
                            </h3>
                            <Badge
                              variant={
                                isActive ? 'default' : 'secondary'
                              }
                              className={`text-[10px] flex-shrink-0 ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {campaign.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {campaign.objective?.replace('OUTCOME_', '').replace('_', ' ')} &middot;{' '}
                            {campaign.budgetType === 'daily'
                              ? `${fmtDollar(campaign.dailyBudget)}/day`
                              : `${fmtDollar(campaign.lifetimeBudget)} lifetime`}
                          </p>
                        </div>

                        {/* Metrics Strip */}
                        {hasSpend && (
                          <div className="flex items-center gap-6 flex-shrink-0">
                            <MetricPill
                              icon={DollarSign}
                              label="Spend"
                              value={fmtDollar(campaign.spend, 0)}
                            />
                            <MetricPill
                              icon={Eye}
                              label="Impressions"
                              value={fmtCompact(campaign.impressions)}
                            />
                            <MetricPill
                              icon={MousePointerClick}
                              label="Link Clicks"
                              value={fmtCompact(campaign.linkClicks)}
                            />
                            <MetricPill
                              icon={Target}
                              label="LPV"
                              value={fmtCompact(campaign.landingPageViews)}
                            />
                            <MetricPill
                              icon={TrendingUp}
                              label="CTR"
                              value={`${fmt(campaign.ctr, 1)}%`}
                              highlight={campaign.ctr > 4}
                            />
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 gap-1.5 text-xs ${
                              isActive
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                            disabled={isToggling}
                            onClick={() =>
                              handleStatusToggle(
                                campaign.campaignId,
                                campaign.status,
                              )
                            }
                          >
                            {isToggling ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isActive ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            {isActive ? 'Pause' : 'Resume'}
                          </Button>

                          <button
                            onClick={() =>
                              setExpandedCampaign(
                                isExpanded ? null : campaign.campaignId,
                              )
                            }
                            className="p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Feedback Toast */}
                      {feedback && (
                        <div
                          className={`mt-3 px-3 py-2 rounded-md text-xs font-medium ${
                            feedback.type === 'success'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {feedback.message}
                        </div>
                      )}

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="mt-5 pt-5 border-t border-zinc-100">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Budget Controls */}
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                Budget Control
                              </h4>
                              {campaign.budgetType === 'daily' ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <label className="text-sm text-zinc-600 w-28">
                                      Daily Budget:
                                    </label>
                                    <div className="relative flex-1 max-w-[200px]">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                                        $
                                      </span>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={
                                          editBudget !== undefined
                                            ? editBudget
                                            : campaign.dailyBudget
                                        }
                                        onChange={(e) =>
                                          setBudgetEdits((prev) => ({
                                            ...prev,
                                            [campaign.campaignId]:
                                              parseFloat(e.target.value) || 0,
                                          }))
                                        }
                                        className="pl-7 h-9 text-sm"
                                      />
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-9"
                                      disabled={
                                        isSaving ||
                                        editBudget === undefined ||
                                        editBudget === campaign.dailyBudget
                                      }
                                      onClick={() =>
                                        handleBudgetSave(
                                          campaign.campaignId,
                                          campaign.dailyBudget,
                                        )
                                      }
                                    >
                                      {isSaving ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                  </div>
                                  <div className="flex gap-2">
                                    {[5, 8, 10, 15, 20].map((amt) => (
                                      <button
                                        key={amt}
                                        onClick={() =>
                                          setBudgetEdits((prev) => ({
                                            ...prev,
                                            [campaign.campaignId]: amt,
                                          }))
                                        }
                                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                          (editBudget ?? campaign.dailyBudget) ===
                                          amt
                                            ? 'border-zinc-900 bg-zinc-900 text-white'
                                            : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                                        }`}
                                      >
                                        ${amt}
                                      </button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-zinc-400">
                                    Current: {fmtDollar(campaign.dailyBudget)}
                                    /day &rarr; ~
                                    {fmtDollar(campaign.dailyBudget * 30, 0)}
                                    /month
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-500">
                                  Lifetime budget:{' '}
                                  {fmtDollar(campaign.lifetimeBudget)}
                                  <br />
                                  <span className="text-xs text-zinc-400">
                                    Lifetime budgets cannot be changed to daily
                                    via API
                                  </span>
                                </p>
                              )}
                            </div>

                            {/* Performance Detail */}
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                Performance Detail ({data.days}d)
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                <DetailRow
                                  label="Total Spend"
                                  value={fmtDollar(campaign.spend)}
                                />
                                <DetailRow
                                  label="Reach"
                                  value={fmtCompact(campaign.reach)}
                                />
                                <DetailRow
                                  label="Impressions"
                                  value={fmtCompact(campaign.impressions)}
                                />
                                <DetailRow
                                  label="Clicks"
                                  value={fmtCompact(campaign.clicks)}
                                />
                                <DetailRow
                                  label="Link Clicks"
                                  value={fmtCompact(campaign.linkClicks)}
                                />
                                <DetailRow
                                  label="Landing Page Views"
                                  value={fmtCompact(campaign.landingPageViews)}
                                />
                                <DetailRow
                                  label="CTR"
                                  value={`${fmt(campaign.ctr, 2)}%`}
                                />
                                <DetailRow
                                  label="CPC"
                                  value={fmtDollar(campaign.cpc)}
                                />
                                <DetailRow
                                  label="Cost/Link Click"
                                  value={
                                    campaign.costPerLinkClick > 0
                                      ? fmtDollar(campaign.costPerLinkClick)
                                      : '—'
                                  }
                                />
                                <DetailRow
                                  label="Cost/LPV"
                                  value={
                                    campaign.costPerLandingPageView > 0
                                      ? fmtDollar(
                                          campaign.costPerLandingPageView,
                                        )
                                      : '—'
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Ad Sets */}
                          {campaign.adSets.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-zinc-100">
                              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                Ad Sets ({campaign.adSets.length})
                              </h4>
                              <div className="space-y-1.5">
                                {campaign.adSets.map((adSet) => (
                                  <div
                                    key={adSet.id}
                                    className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-md text-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] ${
                                          adSet.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-zinc-200 text-zinc-600'
                                        }`}
                                      >
                                        {adSet.status}
                                      </Badge>
                                      <span className="text-zinc-700 truncate max-w-[300px]">
                                        {adSet.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                      <span>
                                        {adSet.optimizationGoal
                                          ?.replace(/_/g, ' ')
                                          .toLowerCase()}
                                      </span>
                                      <span className="font-medium text-zinc-700">
                                        {adSet.dailyBudget > 0
                                          ? `${fmtDollar(adSet.dailyBudget)}/day`
                                          : adSet.lifetimeBudget > 0
                                            ? `${fmtDollar(adSet.lifetimeBudget)} lifetime`
                                            : 'No budget set'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Spend bar — visual indicator of relative spend */}
                    {hasSpend && data.summary.totalSpend > 0 && (
                      <div className="h-1 bg-zinc-100">
                        <div
                          className={`h-full transition-all duration-500 ${
                            campaign.efficiencyScore <= 0.25
                              ? 'bg-emerald-400'
                              : campaign.efficiencyScore <= 0.4
                                ? 'bg-sky-400'
                                : campaign.efficiencyScore <= 0.6
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                          }`}
                          style={{
                            width: `${(campaign.spend / data.summary.totalSpend) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Recommendation Banner */}
            {data.campaigns.length > 0 && (
              <RecommendationBanner campaigns={data.campaigns} days={data.days} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubscribersPanel({ stats }: { stats: YouTubeStats }) {
  if (!stats.hasData || !stats.latest) {
    return (
      <Card className="mb-6 border-zinc-200">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-50 text-zinc-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-700">
              YouTube Subscribers
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {stats.message || 'No snapshots yet. Run the daily cron to seed.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { latest, delta7, delta30, dailyAvgLast7, sparkline } = stats;

  const max = Math.max(...sparkline.map((p) => p.subs));
  const min = Math.min(...sparkline.map((p) => p.subs));
  const range = Math.max(max - min, 1);
  const sparkPoints = sparkline
    .map((p, i) => {
      const x = (i / Math.max(sparkline.length - 1, 1)) * 100;
      const y = 100 - ((p.subs - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const DeltaBadge = ({ value, label }: { value: number | null; label: string }) => {
    if (value === null) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
          <span className="text-sm text-zinc-400">—</span>
        </div>
      );
    }
    const isUp = value > 0;
    const isFlat = value === 0;
    const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
    const color = isFlat
      ? 'text-zinc-500'
      : isUp
        ? 'text-emerald-600'
        : 'text-red-600';
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${color}`}>
          <Icon className="h-3.5 w-3.5" />
          {value > 0 ? '+' : ''}
          {value}
        </span>
      </div>
    );
  };

  return (
    <Card className="mb-6 border-zinc-200">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-6">
          <div className="p-2 rounded-lg bg-red-50 text-red-600">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              YouTube Subscribers
            </p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">
              {latest.subscriberCount.toLocaleString()}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              as of {latest.date}
            </p>
          </div>
          <div className="flex items-center gap-6 flex-1">
            <DeltaBadge value={delta7} label="7d" />
            <DeltaBadge value={delta30} label="30d" />
            {dailyAvgLast7 !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  Avg/day
                </span>
                <span className="text-sm font-semibold text-zinc-700">
                  {dailyAvgLast7.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          {sparkline.length > 1 && (
            <div className="w-40 h-12 flex-shrink-0">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-sky-500"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )}
        </div>
        {stats.snapshotsAvailable < 7 && (
          <p className="text-[11px] text-amber-600 mt-2">
            Only {stats.snapshotsAvailable} snapshot{stats.snapshotsAvailable === 1 ? '' : 's'} available. Deltas will become reliable after 7 daily runs.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  sublabel,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  sublabel: string;
  value: string;
  icon: typeof DollarSign;
  accent: string;
}) {
  return (
    <Card className="border-zinc-200">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{sublabel}</p>
          </div>
          <div className={`p-2 rounded-lg bg-zinc-50 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className="h-3 w-3 text-zinc-400" />
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={`text-sm font-semibold ${highlight ? 'text-emerald-600' : 'text-zinc-800'}`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-50">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs font-semibold text-zinc-800">{value}</span>
    </div>
  );
}

function RecommendationBanner({
  campaigns,
  days,
}: {
  campaigns: CampaignPerformance[];
  days: number;
}) {
  const spending = campaigns.filter(
    (c) => c.spend > 0 && c.efficiencyScore > 0 && c.efficiencyScore < 999,
  );
  if (spending.length < 2) return null;

  const best = spending[0];
  const worst = spending[spending.length - 1];

  if (!best || !worst || best.campaignId === worst.campaignId) return null;

  const bestCost = best.efficiencyScore;
  const worstCost = worst.efficiencyScore;
  const ratio = worstCost / bestCost;

  return (
    <Card className="mt-6 border-sky-200 bg-gradient-to-r from-sky-50 to-white">
      <CardContent className="py-5 px-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sky-100 rounded-lg flex-shrink-0 mt-0.5">
            <Zap className="h-5 w-5 text-sky-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Optimization Recommendation
            </h3>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
              Over the last {days} days, your best campaign (
              <strong className="text-emerald-700">
                {truncateName(best.campaignName, 40)}
              </strong>
              ) delivers landing page views at{' '}
              <strong>{fmtDollar(bestCost)}</strong> each, while your worst (
              <strong className="text-red-700">
                {truncateName(worst.campaignName, 40)}
              </strong>
              ) costs <strong>{fmtDollar(worstCost)}</strong> —{' '}
              <strong>{fmt(ratio, 1)}x more expensive</strong>.
              {ratio > 1.5 && (
                <>
                  {' '}
                  Consider pausing or reducing the budget on the underperformer
                  and reallocating to the top performer.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
