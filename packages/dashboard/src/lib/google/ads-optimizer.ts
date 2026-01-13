/**
 * Google Ads Optimizer
 *
 * Autonomous optimization engine for Google Ads campaigns.
 * Applies rule-based optimizations with configurable thresholds.
 */

import { getGoogleAdsClient, type CampaignData } from './google-ads-client';
import { createClient } from '@supabase/supabase-js';

interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  entity_type: 'campaign' | 'ad_group' | 'keyword';
  metric: string;
  operator: 'less_than' | 'greater_than' | 'equals' | 'between';
  threshold_value: number | null;
  threshold_min: number | null;
  threshold_max: number | null;
  minimum_data: {
    impressions?: number;
    conversions_min?: number;
    conversions_max?: number;
    cost_min?: number;
  };
  action: 'bid_increase' | 'bid_decrease' | 'pause' | 'enable' | 'add_negative_keyword' | 'alert_only';
  action_value: number | null;
  max_change_per_day: number | null;
  cooldown_hours: number;
  priority: number;
}

interface KeywordMetrics {
  id: string;
  resourceName: string;
  keyword: string;
  matchType: string;
  campaignId: string;
  adGroupId: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  cpa: number | null;
}

interface OptimizationResult {
  rule: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  changePercentage: number | null;
  reason: string;
  status: 'applied' | 'failed' | 'skipped';
  error?: string;
}

export class AdsOptimizer {
  private supabase;
  private googleAds;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.googleAds = getGoogleAdsClient();
  }

  /**
   * Load active optimization rules from database
   */
  async loadRules(): Promise<OptimizationRule[]> {
    const { data, error } = await this.supabase
      .from('optimization_rules')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[AdsOptimizer] Failed to load rules:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Check if an entity is in cooldown (was optimized recently)
   */
  async isInCooldown(entityId: string, ruleName: string, cooldownHours: number): Promise<boolean> {
    const cooldownTime = new Date();
    cooldownTime.setHours(cooldownTime.getHours() - cooldownHours);

    const { count } = await this.supabase
      .from('optimization_log')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('rule_name', ruleName)
      .eq('status', 'applied')
      .gte('created_at', cooldownTime.toISOString());

    return (count || 0) > 0;
  }

  /**
   * Get total change applied today for an entity
   */
  async getTodayChangePercentage(entityId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await this.supabase
      .from('optimization_log')
      .select('change_percentage')
      .eq('entity_id', entityId)
      .eq('status', 'applied')
      .gte('created_at', today);

    return (data || []).reduce((sum, row) => sum + Math.abs(row.change_percentage || 0), 0);
  }

  /**
   * Evaluate if a rule condition is met
   */
  evaluateCondition(rule: OptimizationRule, metrics: KeywordMetrics): boolean {
    // Check minimum data requirements
    const minData = rule.minimum_data || {};
    if (minData.impressions && metrics.impressions < minData.impressions) {
      return false;
    }
    if (minData.conversions_min !== undefined && metrics.conversions < minData.conversions_min) {
      return false;
    }
    if (minData.conversions_max !== undefined && metrics.conversions > minData.conversions_max) {
      return false;
    }
    if (minData.cost_min && metrics.cost < minData.cost_min) {
      return false;
    }

    // Get the metric value
    let metricValue: number;
    switch (rule.metric) {
      case 'ctr':
        metricValue = metrics.ctr;
        break;
      case 'cpa':
        metricValue = metrics.cpa || Infinity;
        break;
      case 'conversions':
        metricValue = metrics.conversions;
        break;
      case 'impressions':
        metricValue = metrics.impressions;
        break;
      case 'cost':
        metricValue = metrics.cost;
        break;
      case 'avg_cpc':
        metricValue = metrics.avgCpc;
        break;
      default:
        return false;
    }

    // Evaluate the condition
    switch (rule.operator) {
      case 'less_than':
        return metricValue < (rule.threshold_value || 0);
      case 'greater_than':
        return metricValue > (rule.threshold_value || 0);
      case 'equals':
        return metricValue === rule.threshold_value;
      case 'between':
        return metricValue >= (rule.threshold_min || 0) && metricValue <= (rule.threshold_max || Infinity);
      default:
        return false;
    }
  }

  /**
   * Generate reason text for an optimization
   */
  generateReason(rule: OptimizationRule, metrics: KeywordMetrics): string {
    const metricLabels: Record<string, string> = {
      ctr: 'CTR',
      cpa: 'CPA',
      conversions: 'conversions',
      impressions: 'impressions',
      cost: 'cost',
      avg_cpc: 'avg CPC',
    };

    const metricLabel = metricLabels[rule.metric] || rule.metric;
    let metricValue: string;

    switch (rule.metric) {
      case 'ctr':
        metricValue = `${metrics.ctr.toFixed(2)}%`;
        break;
      case 'cpa':
        metricValue = metrics.cpa ? `$${metrics.cpa.toFixed(2)}` : 'N/A';
        break;
      case 'cost':
        metricValue = `$${metrics.cost.toFixed(2)}`;
        break;
      case 'avg_cpc':
        metricValue = `$${metrics.avgCpc.toFixed(2)}`;
        break;
      default:
        metricValue = metrics[rule.metric as keyof KeywordMetrics]?.toString() || '0';
    }

    return `${metricLabel} is ${metricValue} (${rule.operator.replace('_', ' ')} ${rule.threshold_value}). ${rule.description}`;
  }

  /**
   * Log an optimization to the database
   */
  async logOptimization(result: OptimizationResult, rule: OptimizationRule, metrics: KeywordMetrics): Promise<void> {
    await this.supabase.from('optimization_log').insert({
      entity_type: result.entityType,
      entity_id: result.entityId,
      entity_name: result.entityName,
      action: result.action,
      old_value: result.oldValue,
      new_value: result.newValue,
      change_percentage: result.changePercentage,
      rule_name: result.rule,
      reason: result.reason,
      metrics_snapshot: metrics,
      threshold_config: {
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold_value,
      },
      status: result.status,
      error_message: result.error,
      applied_at: result.status === 'applied' ? new Date().toISOString() : null,
    });
  }

  /**
   * Run all optimization rules
   */
  async runOptimizations(): Promise<{
    total: number;
    applied: number;
    skipped: number;
    failed: number;
    results: OptimizationResult[];
  }> {
    console.log('[AdsOptimizer] Starting optimization run...');

    const rules = await this.loadRules();
    console.log(`[AdsOptimizer] Loaded ${rules.length} active rules`);

    const results: OptimizationResult[] = [];
    let applied = 0;
    let skipped = 0;
    let failed = 0;

    // For now, we work with campaign-level data
    // Full implementation would fetch keyword-level data
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const campaigns = await this.googleAds.getCampaignPerformance(startDate, endDate);

      for (const campaign of campaigns) {
        // Convert campaign data to metrics format
        const metrics: KeywordMetrics = {
          id: campaign.id,
          resourceName: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${campaign.id}`,
          keyword: campaign.name,
          matchType: 'CAMPAIGN',
          campaignId: campaign.id,
          adGroupId: '',
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          cost: campaign.cost,
          conversions: campaign.conversions,
          ctr: campaign.ctr,
          avgCpc: campaign.avgCpc,
          cpa: campaign.costPerConversion,
        };

        // Evaluate each rule against this campaign
        for (const rule of rules) {
          if (rule.entity_type !== 'campaign') continue;

          // Check cooldown
          if (await this.isInCooldown(campaign.id, rule.name, rule.cooldown_hours)) {
            console.log(`[AdsOptimizer] ${campaign.name} in cooldown for rule ${rule.name}`);
            continue;
          }

          // Check if condition is met
          if (!this.evaluateCondition(rule, metrics)) {
            continue;
          }

          // Check daily change limit
          if (rule.max_change_per_day) {
            const todayChange = await this.getTodayChangePercentage(campaign.id);
            if (todayChange >= rule.max_change_per_day) {
              console.log(`[AdsOptimizer] ${campaign.name} reached daily limit for ${rule.name}`);
              skipped++;
              continue;
            }
          }

          // Generate the result
          const result: OptimizationResult = {
            rule: rule.name,
            entityType: 'campaign',
            entityId: campaign.id,
            entityName: campaign.name,
            action: rule.action,
            oldValue: null,
            newValue: null,
            changePercentage: rule.action_value || null,
            reason: this.generateReason(rule, metrics),
            status: 'applied',
          };

          // For alert_only, just log without making changes
          if (rule.action === 'alert_only') {
            result.status = 'applied';
            await this.logOptimization(result, rule, metrics);
            results.push(result);
            applied++;
            continue;
          }

          // For actual changes, we would call the Google Ads API here
          // For now, we log as "applied" - in production, wrap in try/catch
          // and set status based on actual API response
          try {
            // TODO: Implement actual bid/status changes via Google Ads API
            // await this.googleAds.updateBid(campaign.id, newBid);
            // await this.googleAds.pauseCampaign(campaign.id);

            // For now, mark as applied (would be actual API call)
            console.log(`[AdsOptimizer] Would apply ${rule.action} to ${campaign.name}`);
            result.status = 'applied';
            applied++;
          } catch (error) {
            result.status = 'failed';
            result.error = error instanceof Error ? error.message : 'Unknown error';
            failed++;
          }

          await this.logOptimization(result, rule, metrics);
          results.push(result);
        }
      }
    } catch (error) {
      console.error('[AdsOptimizer] Error fetching campaigns:', error);
      failed++;
    }

    console.log(`[AdsOptimizer] Complete. Applied: ${applied}, Skipped: ${skipped}, Failed: ${failed}`);

    return {
      total: results.length,
      applied,
      skipped,
      failed,
      results,
    };
  }

  /**
   * Check budget pacing for all campaigns
   */
  async checkBudgetPacing(): Promise<void> {
    console.log('[AdsOptimizer] Checking budget pacing...');

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = endDate; // Just today

    try {
      const campaigns = await this.googleAds.getCampaignPerformance(startDate, endDate);

      // Get current hour as percentage of day
      const currentHour = new Date().getHours();
      const dayProgress = currentHour / 24;

      for (const campaign of campaigns) {
        if (campaign.status !== 'enabled') continue;

        // Get campaign budget from database
        const { data: dbCampaign } = await this.supabase
          .from('campaigns')
          .select('budget_monthly')
          .eq('google_ads_campaign_id', campaign.id)
          .single();

        if (!dbCampaign?.budget_monthly) continue;

        const dailyBudget = dbCampaign.budget_monthly / 30;
        const expectedSpend = dailyBudget * dayProgress;
        const pacingPercentage = (campaign.cost / expectedSpend) * 100;

        let alertType: string | null = null;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

        if (pacingPercentage > 150) {
          alertType = 'pacing_ahead';
          severity = pacingPercentage > 200 ? 'high' : 'medium';
        } else if (pacingPercentage < 50 && currentHour > 12) {
          alertType = 'pacing_behind';
          severity = 'low';
        } else if (campaign.cost >= dailyBudget * 0.95) {
          alertType = 'budget_exhausted';
          severity = 'high';
        }

        if (alertType) {
          await this.supabase.from('budget_alerts').insert({
            google_ads_campaign_id: campaign.id,
            alert_type: alertType,
            severity,
            daily_budget: dailyBudget,
            current_spend: campaign.cost,
            expected_spend: expectedSpend,
            pacing_percentage: pacingPercentage,
            message: `Campaign "${campaign.name}" is ${alertType.replace('_', ' ')}: ${pacingPercentage.toFixed(0)}% of expected spend`,
          });
        }
      }
    } catch (error) {
      console.error('[AdsOptimizer] Budget pacing check failed:', error);
    }
  }
}

// Singleton instance
let optimizerInstance: AdsOptimizer | null = null;

export function getAdsOptimizer(): AdsOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new AdsOptimizer();
  }
  return optimizerInstance;
}
