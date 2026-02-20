import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string; // "act_972632354854560"
  businessId: string;
  pixelId: string;
  pageId: string;
  apiVersion: string; // "v21.0"
}

// ---------------------------------------------------------------------------
// Internal types — raw Meta API responses
// ---------------------------------------------------------------------------

interface MetaGraphResponse<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number; fbtrace_id: string };
}

interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface MetaAdSetRaw {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  bid_strategy?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

interface MetaAdRaw {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: { id: string };
}

interface MetaInsightRaw {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface MetaSyncResult {
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
  errors: string[];
}

export interface MetaPerformanceSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Meta campaign objective to a local campaign type string.
 */
function mapObjectiveToType(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_TRAFFIC: 'meta_traffic',
    OUTCOME_ENGAGEMENT: 'meta_engagement',
    OUTCOME_LEADS: 'meta_leads',
    OUTCOME_SALES: 'meta_sales',
    OUTCOME_AWARENESS: 'meta_awareness',
    OUTCOME_APP_PROMOTION: 'meta_app_promotion',
    LINK_CLICKS: 'meta_traffic',
    CONVERSIONS: 'meta_sales',
    REACH: 'meta_awareness',
    BRAND_AWARENESS: 'meta_awareness',
    LEAD_GENERATION: 'meta_leads',
    POST_ENGAGEMENT: 'meta_engagement',
    VIDEO_VIEWS: 'meta_engagement',
    MESSAGES: 'meta_engagement',
  };
  return map[objective] || 'meta_other';
}

/**
 * Map a Meta entity status to a local status string.
 */
function mapStatus(metaStatus: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    DELETED: 'deleted',
    ARCHIVED: 'archived',
    IN_PROCESS: 'draft',
    WITH_ISSUES: 'active',
  };
  return map[metaStatus] || 'paused';
}

// ---------------------------------------------------------------------------
// MetaAdsService
// ---------------------------------------------------------------------------

export class MetaAdsService {
  private supabase: SupabaseClient;
  private config: MetaAdsConfig | null = null;
  private baseUrl = '';

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  // -----------------------------------------------------------------------
  // Config methods
  // -----------------------------------------------------------------------

  /**
   * Initialize the service with the given Meta Ads configuration.
   */
  initialize(config: MetaAdsConfig): void {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`;
  }

  /**
   * Initialize from META_* environment variables.
   */
  initializeFromEnv(): void {
    const accessToken = process.env['META_ACCESS_TOKEN'] || '';
    const adAccountId = process.env['META_AD_ACCOUNT_ID'] || '';
    const businessId = process.env['META_BUSINESS_ID'] || '';
    const pixelId = process.env['META_PIXEL_ID'] || '';
    const pageId = process.env['META_PAGE_ID'] || '';
    const apiVersion = process.env['META_API_VERSION'] || 'v21.0';

    this.initialize({
      accessToken,
      adAccountId,
      businessId,
      pixelId,
      pageId,
      apiVersion,
    });
  }

  /**
   * Returns true if the service has a token and ad account ID configured.
   */
  isConfigured(): boolean {
    return (
      this.config !== null &&
      !!this.config.accessToken &&
      !!this.config.adAccountId
    );
  }

  // -----------------------------------------------------------------------
  // Private helpers – Graph API HTTP layer
  // -----------------------------------------------------------------------

  /**
   * Single GET request to the Graph API.
   * Automatically appends the access_token.
   */
  private async graphGet<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<MetaGraphResponse<T>> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('access_token', this.config.accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString());
    const json = (await res.json()) as MetaGraphResponse<T>;

    if (json.error) {
      if (json.error.code === 17) {
        throw new Error(
          `Meta API rate limit reached: ${json.error.message} (fbtrace: ${json.error.fbtrace_id})`,
        );
      }
      if (json.error.code === 190) {
        throw new Error(
          `Meta API invalid/expired token: ${json.error.message} (fbtrace: ${json.error.fbtrace_id})`,
        );
      }
      throw new Error(
        `Meta API error [${json.error.code}]: ${json.error.message} (type: ${json.error.type}, fbtrace: ${json.error.fbtrace_id})`,
      );
    }

    return json;
  }

  /**
   * Paginated GET — follows `paging.next` links to collect all items.
   */
  private async graphGetAll<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const firstPage = await this.graphGet<T>(path, params);
    const items: T[] = [...(firstPage.data || [])];

    let nextUrl = firstPage.paging?.next;
    while (nextUrl) {
      const res = await fetch(nextUrl);
      const json = (await res.json()) as MetaGraphResponse<T>;
      if (json.error) {
        throw new Error(
          `Meta API pagination error [${json.error.code}]: ${json.error.message}`,
        );
      }
      items.push(...(json.data || []));
      nextUrl = json.paging?.next;
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Graph API read methods
  // -----------------------------------------------------------------------

  /**
   * Validate the current access token by calling GET /me.
   */
  async validateToken(): Promise<Record<string, unknown>> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    const url = new URL(`${this.baseUrl}/me`);
    url.searchParams.set('access_token', this.config.accessToken);

    const res = await fetch(url.toString());
    const json = (await res.json()) as Record<string, unknown>;

    if ((json as { error?: { message: string } }).error) {
      throw new Error(
        `Token validation failed: ${((json as { error: { message: string } }).error).message}`,
      );
    }

    return json;
  }

  /**
   * Fetch ad account info.
   */
  async getAccountInfo(): Promise<Record<string, unknown>> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    const url = new URL(`${this.baseUrl}/${this.config.adAccountId}`);
    url.searchParams.set('access_token', this.config.accessToken);
    url.searchParams.set(
      'fields',
      'name,account_status,currency,timezone_name,business,amount_spent',
    );

    const res = await fetch(url.toString());
    const json = (await res.json()) as Record<string, unknown>;

    if ((json as { error?: { message: string } }).error) {
      throw new Error(
        `Failed to get account info: ${((json as { error: { message: string } }).error).message}`,
      );
    }

    return json;
  }

  /**
   * Fetch all campaigns for the configured ad account.
   */
  async getCampaigns(): Promise<MetaCampaignRaw[]> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    return this.graphGetAll<MetaCampaignRaw>(
      `/${this.config.adAccountId}/campaigns`,
      {
        fields:
          'name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      },
    );
  }

  /**
   * Fetch all ad sets for the configured ad account.
   */
  async getAdSets(): Promise<MetaAdSetRaw[]> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    return this.graphGetAll<MetaAdSetRaw>(
      `/${this.config.adAccountId}/adsets`,
      {
        fields:
          'name,status,campaign_id,daily_budget,lifetime_budget,bid_amount,bid_strategy,optimization_goal,targeting,start_time,end_time',
      },
    );
  }

  /**
   * Fetch all ads for the configured ad account.
   */
  async getAds(): Promise<MetaAdRaw[]> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    return this.graphGetAll<MetaAdRaw>(`/${this.config.adAccountId}/ads`, {
      fields: 'name,status,adset_id,creative{id}',
    });
  }

  /**
   * Fetch insights for the configured ad account.
   *
   * @param level - "campaign" | "adset" | "ad"
   */
  async getInsights(
    level: string,
    startDate: string,
    endDate: string,
  ): Promise<MetaInsightRaw[]> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    return this.graphGetAll<MetaInsightRaw>(
      `/${this.config.adAccountId}/insights`,
      {
        fields:
          'campaign_id,campaign_name,adset_id,ad_id,impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type',
        time_range: JSON.stringify({
          since: startDate,
          until: endDate,
        }),
        time_increment: '1',
        level,
      },
    );
  }

  /**
   * Fetch insights with breakdowns (e.g. age, gender, country, etc.).
   */
  async getInsightsWithBreakdowns(
    startDate: string,
    endDate: string,
    breakdownType: string,
  ): Promise<MetaInsightRaw[]> {
    if (!this.config) {
      throw new Error('MetaAdsService not configured. Call initialize() first.');
    }

    return this.graphGetAll<MetaInsightRaw>(
      `/${this.config.adAccountId}/insights`,
      {
        fields:
          'campaign_id,campaign_name,adset_id,ad_id,impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type',
        time_range: JSON.stringify({
          since: startDate,
          until: endDate,
        }),
        time_increment: '1',
        level: 'campaign',
        breakdowns: breakdownType,
      },
    );
  }

  // -----------------------------------------------------------------------
  // Sync methods — Meta -> Supabase
  // -----------------------------------------------------------------------

  /**
   * Sync campaigns from Meta to the local `campaigns` table.
   * Meta budgets are in cents — divide by 100 before storing.
   */
  async syncCampaigns(): Promise<number> {
    const campaigns = await this.getCampaigns();
    if (campaigns.length === 0) return 0;

    const rows = campaigns.map((c) => ({
      meta_campaign_id: c.id,
      name: c.name,
      status: mapStatus(c.status),
      type: mapObjectiveToType(c.objective),
      platform: 'meta',
      budget_monthly: c.daily_budget
        ? (parseFloat(c.daily_budget) / 100) * 30
        : c.lifetime_budget
          ? parseFloat(c.lifetime_budget) / 100
          : 0,
      start_date: c.start_time || null,
      end_date: c.stop_time || null,
    }));

    const { error } = await this.supabase
      .from('campaigns')
      .upsert(rows, { onConflict: 'meta_campaign_id' });

    if (error) {
      throw new Error(`Failed to upsert campaigns: ${error.message}`);
    }

    return campaigns.length;
  }

  /**
   * Sync ad sets from Meta to the local `meta_ad_sets` table.
   * Budget values are in cents — divide by 100.
   */
  async syncAdSets(): Promise<number> {
    const adSets = await this.getAdSets();
    if (adSets.length === 0) return 0;

    // Look up local campaign IDs by meta_campaign_id
    const metaCampaignIds = [...new Set(adSets.map((a) => a.campaign_id))];
    const { data: localCampaigns } = await this.supabase
      .from('campaigns')
      .select('id, meta_campaign_id')
      .in('meta_campaign_id', metaCampaignIds);

    const campaignMap = new Map<string, string>();
    for (const lc of localCampaigns || []) {
      campaignMap.set(lc.meta_campaign_id, lc.id);
    }

    const rows = adSets.map((a) => ({
      meta_ad_set_id: a.id,
      campaign_id: campaignMap.get(a.campaign_id) || null,
      meta_campaign_id: a.campaign_id,
      name: a.name,
      status: mapStatus(a.status),
      daily_budget: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
      lifetime_budget: a.lifetime_budget
        ? parseFloat(a.lifetime_budget) / 100
        : null,
      bid_amount: a.bid_amount ? parseFloat(a.bid_amount) / 100 : null,
      bid_strategy: a.bid_strategy || null,
      optimization_goal: a.optimization_goal || null,
      targeting: a.targeting || null,
      start_time: a.start_time || null,
      end_time: a.end_time || null,
    }));

    const { error } = await this.supabase
      .from('meta_ad_sets')
      .upsert(rows, { onConflict: 'meta_ad_set_id' });

    if (error) {
      throw new Error(`Failed to upsert ad sets: ${error.message}`);
    }

    return adSets.length;
  }

  /**
   * Sync ads from Meta to the local `meta_ads` table.
   */
  async syncAds(): Promise<number> {
    const ads = await this.getAds();
    if (ads.length === 0) return 0;

    // Look up local ad set IDs by meta_ad_set_id
    const metaAdSetIds = [...new Set(ads.map((a) => a.adset_id))];
    const { data: localAdSets } = await this.supabase
      .from('meta_ad_sets')
      .select('id, meta_ad_set_id')
      .in('meta_ad_set_id', metaAdSetIds);

    const adSetMap = new Map<string, string>();
    for (const la of localAdSets || []) {
      adSetMap.set(la.meta_ad_set_id, la.id);
    }

    const rows = ads.map((a) => ({
      meta_ad_id: a.id,
      ad_set_id: adSetMap.get(a.adset_id) || null,
      meta_ad_set_id: a.adset_id,
      name: a.name,
      status: mapStatus(a.status),
      creative_id: a.creative?.id || null,
    }));

    const { error } = await this.supabase
      .from('meta_ads')
      .upsert(rows, { onConflict: 'meta_ad_id' });

    if (error) {
      throw new Error(`Failed to upsert ads: ${error.message}`);
    }

    return ads.length;
  }

  /**
   * Sync campaign-level daily insights from Meta into `meta_insights`
   * and also populate `campaign_metrics` for unified reporting.
   */
  async syncInsights(startDate: string, endDate: string): Promise<number> {
    const insights = await this.getInsights('campaign', startDate, endDate);
    if (insights.length === 0) return 0;

    // Upsert to meta_insights
    const insightRows = insights.map((i) => ({
      meta_object_id: i.campaign_id || i.adset_id || i.ad_id || '',
      object_type: 'campaign',
      date: i.date_start,
      impressions: parseInt(i.impressions, 10) || 0,
      clicks: parseInt(i.clicks, 10) || 0,
      spend: parseFloat(i.spend) || 0,
      reach: i.reach ? parseInt(i.reach, 10) : 0,
      frequency: i.frequency ? parseFloat(i.frequency) : 0,
      cpc: i.cpc ? parseFloat(i.cpc) : 0,
      cpm: i.cpm ? parseFloat(i.cpm) : 0,
      ctr: i.ctr ? parseFloat(i.ctr) : 0,
      actions: i.actions || [],
      cost_per_action_type: i.cost_per_action_type || [],
      date_start: i.date_start,
      date_stop: i.date_stop,
    }));

    const { error: insightError } = await this.supabase
      .from('meta_insights')
      .upsert(insightRows, { onConflict: 'meta_object_id,object_type,date' });

    if (insightError) {
      throw new Error(`Failed to upsert insights: ${insightError.message}`);
    }

    // Also populate campaign_metrics for unified reporting
    const metaCampaignIds = [
      ...new Set(insights.filter((i) => i.campaign_id).map((i) => i.campaign_id!)),
    ];

    if (metaCampaignIds.length > 0) {
      const { data: localCampaigns } = await this.supabase
        .from('campaigns')
        .select('id, meta_campaign_id')
        .in('meta_campaign_id', metaCampaignIds);

      const campaignMap = new Map<string, string>();
      for (const lc of localCampaigns || []) {
        campaignMap.set(lc.meta_campaign_id, lc.id);
      }

      const metricRows = insights
        .filter((i) => i.campaign_id && campaignMap.has(i.campaign_id))
        .map((i) => {
          // Extract conversions from actions array
          const conversions =
            i.actions?.reduce((sum, a) => {
              if (
                a.action_type === 'offsite_conversion' ||
                a.action_type === 'lead' ||
                a.action_type === 'purchase'
              ) {
                return sum + (parseFloat(a.value) || 0);
              }
              return sum;
            }, 0) || 0;

          // Extract conversion value
          const conversionValue =
            i.actions?.reduce((sum, a) => {
              if (a.action_type === 'purchase') {
                return sum + (parseFloat(a.value) || 0);
              }
              return sum;
            }, 0) || 0;

          const impressions = parseInt(i.impressions, 10) || 0;
          const clicks = parseInt(i.clicks, 10) || 0;
          const cost = parseFloat(i.spend) || 0;

          return {
            campaign_id: campaignMap.get(i.campaign_id!)!,
            date: i.date_start,
            impressions,
            clicks,
            cost,
            conversions,
            conversion_value: conversionValue,
            ctr: impressions > 0 ? clicks / impressions : 0,
            cpc: clicks > 0 ? cost / clicks : 0,
            cpa: conversions > 0 ? cost / conversions : null,
            roas: cost > 0 ? conversionValue / cost : null,
          };
        });

      if (metricRows.length > 0) {
        const { error: metricsError } = await this.supabase
          .from('campaign_metrics')
          .upsert(metricRows, { onConflict: 'campaign_id,date' });

        if (metricsError) {
          throw new Error(
            `Failed to upsert campaign_metrics: ${metricsError.message}`,
          );
        }
      }
    }

    return insights.length;
  }

  /**
   * Run a full sync: campaigns -> ad sets -> ads -> insights.
   */
  async fullSync(startDate: string, endDate: string): Promise<MetaSyncResult> {
    const errors: string[] = [];
    let campaignsCount = 0;
    let adSetsCount = 0;
    let adsCount = 0;
    let insightsCount = 0;

    // 1. Campaigns
    console.log('[MetaAdsService] Syncing campaigns...');
    try {
      campaignsCount = await this.syncCampaigns();
      console.log(`[MetaAdsService] Synced ${campaignsCount} campaigns.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MetaAdsService] Campaign sync error: ${msg}`);
      errors.push(`campaigns: ${msg}`);
    }

    // 2. Ad Sets
    console.log('[MetaAdsService] Syncing ad sets...');
    try {
      adSetsCount = await this.syncAdSets();
      console.log(`[MetaAdsService] Synced ${adSetsCount} ad sets.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MetaAdsService] Ad set sync error: ${msg}`);
      errors.push(`adSets: ${msg}`);
    }

    // 3. Ads
    console.log('[MetaAdsService] Syncing ads...');
    try {
      adsCount = await this.syncAds();
      console.log(`[MetaAdsService] Synced ${adsCount} ads.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MetaAdsService] Ad sync error: ${msg}`);
      errors.push(`ads: ${msg}`);
    }

    // 4. Insights
    console.log('[MetaAdsService] Syncing insights...');
    try {
      insightsCount = await this.syncInsights(startDate, endDate);
      console.log(`[MetaAdsService] Synced ${insightsCount} insight rows.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MetaAdsService] Insights sync error: ${msg}`);
      errors.push(`insights: ${msg}`);
    }

    console.log('[MetaAdsService] Full sync complete.');

    return {
      campaigns: campaignsCount,
      adSets: adSetsCount,
      ads: adsCount,
      insights: insightsCount,
      errors,
    };
  }

  // -----------------------------------------------------------------------
  // Dashboard read methods — from Supabase
  // -----------------------------------------------------------------------

  /**
   * Aggregate performance summary from meta_insights over the last N days.
   */
  async getPerformanceSummary(days = 30): Promise<MetaPerformanceSummary> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    // Campaign counts
    const { count: totalCampaigns } = await this.supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'meta');

    const { count: activeCampaigns } = await this.supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'meta')
      .eq('status', 'active');

    // Aggregate insights
    const { data: insights } = await this.supabase
      .from('meta_insights')
      .select('impressions, clicks, spend, reach, ctr, cpc')
      .gte('date', sinceStr);

    const totals = (insights || []).reduce(
      (acc, row) => ({
        spend: acc.spend + (parseFloat(row.spend) || 0),
        impressions: acc.impressions + (parseInt(row.impressions, 10) || 0),
        clicks: acc.clicks + (parseInt(row.clicks, 10) || 0),
        reach: acc.reach + (parseInt(row.reach, 10) || 0),
        ctrSum: acc.ctrSum + (parseFloat(row.ctr) || 0),
        cpcSum: acc.cpcSum + (parseFloat(row.cpc) || 0),
        count: acc.count + 1,
      }),
      { spend: 0, impressions: 0, clicks: 0, reach: 0, ctrSum: 0, cpcSum: 0, count: 0 },
    );

    return {
      totalCampaigns: totalCampaigns || 0,
      activeCampaigns: activeCampaigns || 0,
      totalSpend: totals.spend,
      totalImpressions: totals.impressions,
      totalClicks: totals.clicks,
      totalReach: totals.reach,
      avgCtr: totals.count > 0 ? totals.ctrSum / totals.count : 0,
      avgCpc: totals.count > 0 ? totals.cpcSum / totals.count : 0,
    };
  }

  /**
   * Get per-campaign performance for the last N days (Meta platform only).
   */
  async getCampaignPerformance(
    days = 30,
  ): Promise<
    Array<{
      campaign: Record<string, unknown>;
      impressions: number;
      clicks: number;
      spend: number;
      reach: number;
      ctr: number;
      cpc: number;
    }>
  > {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    // Get Meta campaigns
    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('platform', 'meta');

    if (!campaigns || campaigns.length === 0) return [];

    const results = [];

    for (const campaign of campaigns) {
      if (!campaign.meta_campaign_id) continue;

      const { data: insights } = await this.supabase
        .from('meta_insights')
        .select('impressions, clicks, spend, reach, ctr, cpc')
        .eq('meta_object_id', campaign.meta_campaign_id)
        .eq('object_type', 'campaign')
        .gte('date', sinceStr);

      const totals = (insights || []).reduce(
        (acc, row) => ({
          impressions: acc.impressions + (parseInt(row.impressions, 10) || 0),
          clicks: acc.clicks + (parseInt(row.clicks, 10) || 0),
          spend: acc.spend + (parseFloat(row.spend) || 0),
          reach: acc.reach + (parseInt(row.reach, 10) || 0),
        }),
        { impressions: 0, clicks: 0, spend: 0, reach: 0 },
      );

      results.push({
        campaign,
        impressions: totals.impressions,
        clicks: totals.clicks,
        spend: totals.spend,
        reach: totals.reach,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      });
    }

    return results;
  }

  /**
   * Query meta_insights rows that have breakdowns data.
   */
  async getAudienceBreakdown(
    startDate: string,
    endDate: string,
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.supabase
      .from('meta_insights')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('breakdowns', '{}');

    if (error) {
      throw new Error(
        `Failed to fetch audience breakdown: ${error.message}`,
      );
    }

    return data || [];
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let serviceInstance: MetaAdsService | null = null;

export function getMetaAdsService(): MetaAdsService {
  if (!serviceInstance) {
    serviceInstance = new MetaAdsService();
  }
  return serviceInstance;
}
