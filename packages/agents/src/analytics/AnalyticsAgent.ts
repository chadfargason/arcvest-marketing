// @ts-nocheck
/**
 * Analytics Agent
 *
 * Syncs data from Google Analytics 4, calculates daily metrics,
 * generates reports, and monitors KPI performance.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../base/BaseAgent';
import { GA4Client, WebsiteMetrics, TrafficSource, PagePerformance } from './ga4-client';
import type { AgentTask } from '@arcvest/shared';

export interface DailyMetricsRollup {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
  trafficSources: TrafficSource[];
  topPages: PagePerformance[];
}

export interface KPIAlert {
  metric: string;
  currentValue: number;
  threshold: number;
  type: 'below_target' | 'above_target' | 'significant_change';
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface WeeklyReportData {
  period: { start: string; end: string };
  summary: WebsiteMetrics;
  previousPeriod: WebsiteMetrics;
  changes: Record<string, { value: number; change: number; changePercent: number }>;
  trafficSources: TrafficSource[];
  topPages: PagePerformance[];
  campaignPerformance: { campaign: string; sessions: number; conversions: number }[];
  alerts: KPIAlert[];
  recommendations: string[];
}

export class AnalyticsAgent extends BaseAgent {
  private ga4: GA4Client;

  // KPI targets for alerting
  private kpiTargets = {
    dailySessions: 50,
    conversionRate: 2.0, // 2%
    bounceRate: 60, // max 60%
    avgSessionDuration: 120, // 2 minutes
  };

  constructor(supabase?: SupabaseClient) {
    super({
      name: 'analytics',
      displayName: 'Analytics Agent',
      description: 'Syncs GA4 data and generates marketing reports',
      supabase,
    });

    this.ga4 = new GA4Client();
  }

  /**
   * Main run loop.
   */
  async run(): Promise<void> {
    this.logger.debug('Running analytics agent cycle');

    const tasks = await this.getPendingTasks();
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`Failed to process task ${task.id}`, error);
      }
    }

    await this.updateStatus({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    });
  }

  /**
   * Execute an analytics task.
   */
  protected async executeTask(task: AgentTask): Promise<unknown> {
    switch (task.type) {
      case 'sync_google_analytics':
        return this.syncGoogleAnalytics();

      case 'calculate_daily_metrics':
        return this.calculateDailyMetrics(task.payload);

      case 'generate_daily_digest':
        return this.generateDailyDigest();

      case 'generate_weekly_report':
        return this.generateWeeklyReport();

      case 'check_kpis':
        return this.checkKPIs();

      case 'analyze_campaign_performance':
        return this.analyzeCampaignPerformance(task.payload);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Sync data from Google Analytics.
   */
  async syncGoogleAnalytics(): Promise<{ synced: boolean; date: string }> {
    this.logger.info('Syncing Google Analytics data');

    const today = new Date().toISOString().split('T')[0];

    try {
      // Get yesterday's final metrics (today's are still accumulating)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const metrics = await this.ga4.getWebsiteMetrics(yesterdayStr, yesterdayStr);
      const trafficSources = await this.ga4.getTrafficSources(yesterdayStr, yesterdayStr);
      const topPages = await this.ga4.getTopPages(yesterdayStr, yesterdayStr);

      // Store in database
      await this.supabase.from('daily_metrics').upsert({
        date: yesterdayStr,
        sessions: metrics.sessions,
        users: metrics.users,
        new_users: metrics.newUsers,
        pageviews: metrics.pageviews,
        avg_session_duration: metrics.avgSessionDuration,
        bounce_rate: metrics.bounceRate,
        conversions: metrics.conversions,
        conversion_rate: metrics.conversionRate,
        traffic_sources: trafficSources,
        top_pages: topPages,
      });

      // Update sync timestamp
      await this.supabase.from('system_state').upsert({
        key: 'ga4_last_sync',
        value: new Date().toISOString(),
      });

      this.logger.info('GA4 sync completed', { date: yesterdayStr });

      return { synced: true, date: yesterdayStr };
    } catch (error) {
      this.logger.error('GA4 sync failed', error);
      throw error;
    }
  }

  /**
   * Calculate and store daily metrics rollup.
   */
  async calculateDailyMetrics(payload: Record<string, unknown>): Promise<DailyMetricsRollup> {
    const { date } = payload;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    this.logger.info('Calculating daily metrics', { date: targetDate });

    const metrics = await this.ga4.getWebsiteMetrics(targetDate, targetDate);
    const trafficSources = await this.ga4.getTrafficSources(targetDate, targetDate);
    const topPages = await this.ga4.getTopPages(targetDate, targetDate, 5);

    const rollup: DailyMetricsRollup = {
      date: targetDate,
      ...metrics,
      trafficSources,
      topPages,
    };

    // Store in database
    await this.supabase.from('daily_metrics').upsert({
      date: targetDate,
      sessions: rollup.sessions,
      users: rollup.users,
      new_users: rollup.newUsers,
      pageviews: rollup.pageviews,
      avg_session_duration: rollup.avgSessionDuration,
      bounce_rate: rollup.bounceRate,
      conversions: rollup.conversions,
      conversion_rate: rollup.conversionRate,
      traffic_sources: rollup.trafficSources,
      top_pages: rollup.topPages,
    });

    return rollup;
  }

  /**
   * Generate daily digest email content.
   */
  async generateDailyDigest(): Promise<{ subject: string; body: string; metrics: WebsiteMetrics }> {
    this.logger.info('Generating daily digest');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get yesterday's metrics
    const metrics = await this.ga4.getWebsiteMetrics(yesterdayStr, yesterdayStr);

    // Get previous day for comparison
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
    const previousMetrics = await this.ga4.getWebsiteMetrics(twoDaysAgoStr, twoDaysAgoStr);

    // Calculate changes
    const sessionChange = previousMetrics.sessions > 0
      ? ((metrics.sessions - previousMetrics.sessions) / previousMetrics.sessions) * 100
      : 0;

    const conversionChange = previousMetrics.conversions > 0
      ? ((metrics.conversions - previousMetrics.conversions) / previousMetrics.conversions) * 100
      : 0;

    // Check for alerts
    const alerts = await this.checkKPIs();

    const subject = `ArcVest Daily Analytics - ${yesterdayStr}`;

    const body = `
# Daily Analytics Digest

**Date:** ${yesterdayStr}

## Key Metrics

| Metric | Value | Change |
|--------|-------|--------|
| Sessions | ${metrics.sessions} | ${sessionChange >= 0 ? '+' : ''}${sessionChange.toFixed(1)}% |
| Users | ${metrics.users} | - |
| Pageviews | ${metrics.pageviews} | - |
| Conversions | ${metrics.conversions} | ${conversionChange >= 0 ? '+' : ''}${conversionChange.toFixed(1)}% |
| Conversion Rate | ${metrics.conversionRate.toFixed(2)}% | - |
| Bounce Rate | ${(metrics.bounceRate * 100).toFixed(1)}% | - |
| Avg. Session Duration | ${Math.floor(metrics.avgSessionDuration)}s | - |

${alerts.alerts.length > 0 ? `
## Alerts

${alerts.alerts.map((a) => `- **${a.severity.toUpperCase()}:** ${a.message}`).join('\n')}
` : ''}

---
Generated by ArcVest Analytics Agent
    `.trim();

    // Log activity
    await this.logActivity({
      action: 'daily_digest_generated',
      entityType: 'report',
      entityId: yesterdayStr,
      details: {
        sessions: metrics.sessions,
        conversions: metrics.conversions,
        alertCount: alerts.alerts.length,
      },
    });

    return { subject, body, metrics };
  }

  /**
   * Generate weekly report.
   */
  async generateWeeklyReport(): Promise<WeeklyReportData> {
    this.logger.info('Generating weekly report');

    // Current week: last 7 days
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7 days total

    // Previous week
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const prevStartStr = prevStartDate.toISOString().split('T')[0];
    const prevEndStr = prevEndDate.toISOString().split('T')[0];

    // Get metrics for both periods
    const [summary, previousPeriod, trafficSources, topPages, campaigns] = await Promise.all([
      this.ga4.getWebsiteMetrics(startStr, endStr),
      this.ga4.getWebsiteMetrics(prevStartStr, prevEndStr),
      this.ga4.getTrafficSources(startStr, endStr),
      this.ga4.getTopPages(startStr, endStr),
      this.ga4.getCampaignPerformance(startStr, endStr),
    ]);

    // Calculate changes
    const changes: Record<string, { value: number; change: number; changePercent: number }> = {};
    const metrics: (keyof WebsiteMetrics)[] = [
      'sessions',
      'users',
      'pageviews',
      'conversions',
      'conversionRate',
      'bounceRate',
    ];

    for (const metric of metrics) {
      const current = summary[metric] as number;
      const previous = previousPeriod[metric] as number;
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;

      changes[metric] = { value: current, change, changePercent };
    }

    // Check KPIs for alerts
    const { alerts } = await this.checkKPIs();

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, previousPeriod, trafficSources);

    const report: WeeklyReportData = {
      period: { start: startStr, end: endStr },
      summary,
      previousPeriod,
      changes,
      trafficSources,
      topPages,
      campaignPerformance: campaigns.slice(0, 5),
      alerts,
      recommendations,
    };

    // Store report
    await this.supabase.from('analytics_reports').insert({
      report_type: 'weekly',
      period_start: startStr,
      period_end: endStr,
      data: report,
      generated_at: new Date().toISOString(),
    });

    // Submit for review if there are critical alerts
    if (alerts.some((a) => a.severity === 'critical')) {
      await this.submitForApproval({
        type: 'analytics_report',
        title: `Weekly Analytics Report - ${startStr} to ${endStr}`,
        summary: `Report with ${alerts.filter((a) => a.severity === 'critical').length} critical alerts`,
        content: report,
        priority: 'high',
      });
    }

    await this.logActivity({
      action: 'weekly_report_generated',
      entityType: 'report',
      entityId: `${startStr}_${endStr}`,
      details: {
        sessions: summary.sessions,
        conversions: summary.conversions,
        alertCount: alerts.length,
      },
    });

    return report;
  }

  /**
   * Check KPIs against targets.
   */
  async checkKPIs(): Promise<{ alerts: KPIAlert[] }> {
    this.logger.info('Checking KPIs');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const metrics = await this.ga4.getWebsiteMetrics(yesterdayStr, yesterdayStr);
    const alerts: KPIAlert[] = [];

    // Check daily sessions
    if (metrics.sessions < this.kpiTargets.dailySessions) {
      alerts.push({
        metric: 'Daily Sessions',
        currentValue: metrics.sessions,
        threshold: this.kpiTargets.dailySessions,
        type: 'below_target',
        message: `Daily sessions (${metrics.sessions}) below target (${this.kpiTargets.dailySessions})`,
        severity: metrics.sessions < this.kpiTargets.dailySessions * 0.5 ? 'critical' : 'warning',
      });
    }

    // Check conversion rate
    if (metrics.conversionRate < this.kpiTargets.conversionRate) {
      alerts.push({
        metric: 'Conversion Rate',
        currentValue: metrics.conversionRate,
        threshold: this.kpiTargets.conversionRate,
        type: 'below_target',
        message: `Conversion rate (${metrics.conversionRate.toFixed(2)}%) below target (${this.kpiTargets.conversionRate}%)`,
        severity: metrics.conversionRate < this.kpiTargets.conversionRate * 0.5 ? 'critical' : 'warning',
      });
    }

    // Check bounce rate (higher is worse)
    if (metrics.bounceRate * 100 > this.kpiTargets.bounceRate) {
      alerts.push({
        metric: 'Bounce Rate',
        currentValue: metrics.bounceRate * 100,
        threshold: this.kpiTargets.bounceRate,
        type: 'above_target',
        message: `Bounce rate (${(metrics.bounceRate * 100).toFixed(1)}%) above target (${this.kpiTargets.bounceRate}%)`,
        severity: metrics.bounceRate * 100 > this.kpiTargets.bounceRate * 1.5 ? 'critical' : 'warning',
      });
    }

    // Check session duration
    if (metrics.avgSessionDuration < this.kpiTargets.avgSessionDuration) {
      alerts.push({
        metric: 'Avg. Session Duration',
        currentValue: metrics.avgSessionDuration,
        threshold: this.kpiTargets.avgSessionDuration,
        type: 'below_target',
        message: `Avg. session duration (${Math.floor(metrics.avgSessionDuration)}s) below target (${this.kpiTargets.avgSessionDuration}s)`,
        severity: 'info',
      });
    }

    if (alerts.length > 0) {
      this.logger.warn(`Found ${alerts.length} KPI alerts`);
    }

    return { alerts };
  }

  /**
   * Analyze campaign performance.
   */
  async analyzeCampaignPerformance(payload: Record<string, unknown>): Promise<{
    campaigns: { name: string; performance: 'good' | 'average' | 'poor'; metrics: Record<string, number> }[];
    recommendations: string[];
  }> {
    const { dateRange = 30 } = payload;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (dateRange as number));

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const campaigns = await this.ga4.getCampaignPerformance(startStr, endStr);
    const results: { name: string; performance: 'good' | 'average' | 'poor'; metrics: Record<string, number> }[] = [];
    const recommendations: string[] = [];

    for (const campaign of campaigns) {
      const conversionRate = campaign.sessions > 0 ? (campaign.conversions / campaign.sessions) * 100 : 0;

      let performance: 'good' | 'average' | 'poor';
      if (conversionRate >= this.kpiTargets.conversionRate) {
        performance = 'good';
      } else if (conversionRate >= this.kpiTargets.conversionRate * 0.5) {
        performance = 'average';
      } else {
        performance = 'poor';
        recommendations.push(`Review campaign "${campaign.campaign}" - low conversion rate (${conversionRate.toFixed(2)}%)`);
      }

      results.push({
        name: campaign.campaign,
        performance,
        metrics: {
          sessions: campaign.sessions,
          users: campaign.users,
          conversions: campaign.conversions,
          conversionRate,
        },
      });
    }

    return { campaigns: results, recommendations };
  }

  /**
   * Generate recommendations based on metrics.
   */
  private generateRecommendations(
    current: WebsiteMetrics,
    previous: WebsiteMetrics,
    trafficSources: TrafficSource[]
  ): string[] {
    const recommendations: string[] = [];

    // Session decline
    const sessionChange = ((current.sessions - previous.sessions) / previous.sessions) * 100;
    if (sessionChange < -20) {
      recommendations.push(
        `Website traffic decreased ${Math.abs(sessionChange).toFixed(0)}% week-over-week. Review marketing campaigns and SEO performance.`
      );
    }

    // High bounce rate
    if (current.bounceRate * 100 > 60) {
      recommendations.push(
        `Bounce rate is ${(current.bounceRate * 100).toFixed(1)}%. Consider improving landing page content and load times.`
      );
    }

    // Low conversion rate
    if (current.conversionRate < 1) {
      recommendations.push(
        `Conversion rate is ${current.conversionRate.toFixed(2)}%. Review call-to-action placement and form optimization.`
      );
    }

    // Traffic source opportunities
    const organicTraffic = trafficSources.find((s) => s.medium === 'organic');
    const paidTraffic = trafficSources.find((s) => s.medium === 'cpc');

    if (organicTraffic && paidTraffic) {
      const organicConvRate = organicTraffic.sessions > 0 ? (organicTraffic.conversions / organicTraffic.sessions) * 100 : 0;
      const paidConvRate = paidTraffic.sessions > 0 ? (paidTraffic.conversions / paidTraffic.sessions) * 100 : 0;

      if (organicConvRate > paidConvRate * 2) {
        recommendations.push(
          `Organic traffic converts ${(organicConvRate / paidConvRate).toFixed(1)}x better than paid. Consider increasing SEO investment.`
        );
      }
    }

    // Short session duration
    if (current.avgSessionDuration < 60) {
      recommendations.push(
        `Average session duration is ${Math.floor(current.avgSessionDuration)} seconds. Improve content engagement and internal linking.`
      );
    }

    return recommendations;
  }

  /**
   * Get historical metrics for charting.
   */
  async getHistoricalMetrics(
    days: number = 30
  ): Promise<{ date: string; sessions: number; conversions: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('daily_metrics')
      .select('date, sessions, conversions')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      this.logger.error('Failed to get historical metrics', error);
      return [];
    }

    return data || [];
  }

  /**
   * Compare metrics between two periods.
   */
  async comparePeriods(
    period1Start: string,
    period1End: string,
    period2Start: string,
    period2End: string
  ): Promise<{
    period1: WebsiteMetrics;
    period2: WebsiteMetrics;
    changes: Record<string, number>;
  }> {
    const [period1, period2] = await Promise.all([
      this.ga4.getWebsiteMetrics(period1Start, period1End),
      this.ga4.getWebsiteMetrics(period2Start, period2End),
    ]);

    const changes: Record<string, number> = {};
    const metrics: (keyof WebsiteMetrics)[] = ['sessions', 'users', 'pageviews', 'conversions'];

    for (const metric of metrics) {
      const p1Value = period1[metric] as number;
      const p2Value = period2[metric] as number;
      changes[metric] = p2Value > 0 ? ((p1Value - p2Value) / p2Value) * 100 : 0;
    }

    return { period1, period2, changes };
  }
}
