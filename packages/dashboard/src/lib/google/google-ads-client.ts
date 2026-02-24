/**
 * Google Ads API Client
 *
 * Uses OAuth refresh token to fetch campaign data
 * Requires: Developer Token, Client ID, Client Secret, Refresh Token, Customer ID
 */

interface GoogleAdsResponse {
  results?: Array<{
    campaign?: {
      resourceName: string;
      id: string;
      name: string;
      status: string;
    };
    metrics?: {
      impressions: string;
      clicks: string;
      costMicros: string;
      conversions: number;
      ctr: number;
      averageCpc: string;
      costPerConversion?: string;
    };
    segments?: {
      date: string;
    };
  }>;
  fieldMask?: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  costPerConversion: number | null;
}

export interface DailyMetrics {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export interface MutateResult {
  resourceName: string;
}

export interface AdGroupMetrics {
  adGroupId: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export class GoogleAdsClient {
  private customerId: string;
  private loginCustomerId: string;
  private developerToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId) {
      throw new Error('GOOGLE_ADS_CUSTOMER_ID not configured');
    }
    if (!developerToken) {
      throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
    }

    // Remove dashes from customer ID if present
    this.customerId = customerId.replace(/-/g, '');
    this.developerToken = developerToken;

    // Manager (MCC) account ID — required when accessing client accounts through a manager
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    this.loginCustomerId = loginCustomerId
      ? loginCustomerId.replace(/-/g, '')
      : this.customerId;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    // Prefer Google Ads-specific credentials, fall back to shared Google OAuth
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Ads OAuth credentials not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN (or shared GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    // Log scopes for debugging
    console.log('[GoogleAdsClient] Token scopes:', data.scope);

    return this.accessToken as string;
  }

  /**
   * Run a Google Ads query using GAQL
   */
  private async runQuery(query: string): Promise<GoogleAdsResponse> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://googleads.googleapis.com/v23/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': this.loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Ads API error: ${error}`);
    }

    // searchStream returns an array of response objects
    const results = await response.json();

    // Combine results from all response chunks
    const combined: GoogleAdsResponse = { results: [] };
    if (Array.isArray(results)) {
      for (const chunk of results) {
        if (chunk.results) {
          combined.results!.push(...chunk.results);
        }
      }
    } else if (results.results) {
      combined.results = results.results;
    }

    return combined;
  }

  /**
   * Get campaign performance summary
   */
  async getCampaignPerformance(startDate: string, endDate: string): Promise<CampaignData[]> {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
    `;

    const response = await this.runQuery(query);

    // Aggregate by campaign
    const campaignMap = new Map<string, CampaignData>();

    for (const row of response.results || []) {
      const campaignId = row.campaign?.id || '';
      const existing = campaignMap.get(campaignId);

      const impressions = parseInt(row.metrics?.impressions || '0');
      const clicks = parseInt(row.metrics?.clicks || '0');
      const costMicros = parseInt(row.metrics?.costMicros || '0');
      const conversions = row.metrics?.conversions || 0;

      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.cost += costMicros / 1000000;
        existing.conversions += conversions;
      } else {
        campaignMap.set(campaignId, {
          id: campaignId,
          name: row.campaign?.name || 'Unknown',
          status: row.campaign?.status?.toLowerCase() || 'unknown',
          impressions,
          clicks,
          cost: costMicros / 1000000,
          conversions,
          ctr: 0,
          avgCpc: 0,
          costPerConversion: null,
        });
      }
    }

    // Calculate derived metrics
    const campaigns = Array.from(campaignMap.values()).map(campaign => ({
      ...campaign,
      ctr: campaign.impressions > 0
        ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(2))
        : 0,
      avgCpc: campaign.clicks > 0
        ? Number((campaign.cost / campaign.clicks).toFixed(2))
        : 0,
      costPerConversion: campaign.conversions > 0
        ? Number((campaign.cost / campaign.conversions).toFixed(2))
        : null,
    }));

    return campaigns.sort((a, b) => b.cost - a.cost);
  }

  /**
   * Get daily metrics for charting
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<DailyMetrics[]> {
    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
    `;

    const response = await this.runQuery(query);

    // Aggregate by date
    const dateMap = new Map<string, DailyMetrics>();

    for (const row of response.results || []) {
      const date = row.segments?.date || '';
      const existing = dateMap.get(date);

      const impressions = parseInt(row.metrics?.impressions || '0');
      const clicks = parseInt(row.metrics?.clicks || '0');
      const costMicros = parseInt(row.metrics?.costMicros || '0');
      const conversions = row.metrics?.conversions || 0;

      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.cost += costMicros / 1000000;
        existing.conversions += conversions;
      } else {
        dateMap.set(date, {
          date,
          impressions,
          clicks,
          cost: costMicros / 1000000,
          conversions,
        });
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================
  // MUTATE (WRITE) METHODS
  // ============================================

  /**
   * Run a mutate operation against the Google Ads API
   */
  private async runMutate(
    resource: string,
    operations: Array<Record<string, unknown>>
  ): Promise<MutateResult[]> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://googleads.googleapis.com/v23/customers/${this.customerId}/${resource}:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
          'login-customer-id': this.loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operations }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Ads mutate error (${resource}): ${error}`);
    }

    const data = await response.json();
    const results: MutateResult[] = (data.results || []).map(
      (r: { resourceName?: string }) => ({
        resourceName: r.resourceName || '',
      })
    );
    return results;
  }

  /**
   * Create a shared campaign budget
   */
  async createCampaignBudget(amountMicros: number): Promise<string> {
    const results = await this.runMutate('campaignBudgets', [
      {
        create: {
          amountMicros: String(amountMicros),
          deliveryMethod: 'STANDARD',
          explicitlyShared: false,
        },
      },
    ]);
    console.log('[GoogleAdsClient] Created campaign budget:', results[0].resourceName);
    return results[0].resourceName;
  }

  /**
   * Create a search campaign
   */
  async createCampaign(
    name: string,
    budgetResourceName: string,
    bidStrategy: 'maximize_clicks' | 'maximize_conversions' | 'target_cpa',
    targetCpa?: number,
    status: 'PAUSED' | 'ENABLED' = 'PAUSED'
  ): Promise<string> {
    const campaignData: Record<string, unknown> = {
      name,
      advertisingChannelType: 'SEARCH',
      status,
      campaignBudget: budgetResourceName,
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: true,
        targetContentNetwork: false,
      },
      containsEuPoliticalAdvertising: 'NOT_EU_POLITICAL_ADVERTISING',
    };

    if (bidStrategy === 'maximize_clicks') {
      campaignData.targetSpend = { cpcBidCeilingMicros: '2000000' };
    } else if (bidStrategy === 'maximize_conversions') {
      campaignData.maximizeConversions = { targetCpaMicros: '0' };
    } else if (bidStrategy === 'target_cpa' && targetCpa) {
      campaignData.targetCpa = { targetCpaMicros: String(targetCpa * 1_000_000) };
    }

    const results = await this.runMutate('campaigns', [{ create: campaignData }]);
    console.log('[GoogleAdsClient] Created campaign:', results[0].resourceName);
    return results[0].resourceName;
  }

  /**
   * Set location targeting for a campaign
   */
  async setCampaignLocationTargeting(
    campaignResourceName: string,
    locationIds: string[]
  ): Promise<void> {
    if (locationIds.length === 0) return;

    const operations = locationIds.map((locId) => ({
      create: {
        campaign: campaignResourceName,
        type: 'LOCATION',
        location: {
          geoTargetConstant: `geoTargetConstants/${locId}`,
        },
      },
    }));

    await this.runMutate('campaignCriteria', operations);
    console.log('[GoogleAdsClient] Set location targeting:', locationIds.length, 'locations');
  }

  /**
   * Create an ad group within a campaign
   */
  async createAdGroup(campaignResourceName: string, name: string): Promise<string> {
    const results = await this.runMutate('adGroups', [
      {
        create: {
          campaign: campaignResourceName,
          name,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
        },
      },
    ]);
    console.log('[GoogleAdsClient] Created ad group:', results[0].resourceName);
    return results[0].resourceName;
  }

  /**
   * Create a responsive search ad in an ad group
   */
  async createResponsiveSearchAd(
    adGroupResourceName: string,
    headlines: Array<{ text: string; pinPosition?: number }>,
    descriptions: Array<{ text: string; pinPosition?: number }>,
    finalUrl: string
  ): Promise<string> {
    const rsaHeadlines = headlines.map((h) => {
      const asset: Record<string, unknown> = { text: h.text };
      if (h.pinPosition) asset.pinnedField = `HEADLINE_${h.pinPosition}`;
      return asset;
    });

    const rsaDescriptions = descriptions.map((d) => {
      const asset: Record<string, unknown> = { text: d.text };
      if (d.pinPosition) asset.pinnedField = `DESCRIPTION_${d.pinPosition}`;
      return asset;
    });

    const results = await this.runMutate('adGroupAds', [
      {
        create: {
          adGroup: adGroupResourceName,
          status: 'ENABLED',
          ad: {
            responsiveSearchAd: {
              headlines: rsaHeadlines,
              descriptions: rsaDescriptions,
            },
            finalUrls: [finalUrl],
          },
        },
      },
    ]);
    console.log('[GoogleAdsClient] Created RSA:', results[0].resourceName);
    return results[0].resourceName;
  }

  /**
   * Add keywords to an ad group
   */
  async addKeywords(
    adGroupResourceName: string,
    keywords: string[],
    matchType: 'BROAD' | 'PHRASE' | 'EXACT'
  ): Promise<void> {
    if (keywords.length === 0) return;

    const operations = keywords.map((keyword) => ({
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        keyword: {
          text: keyword,
          matchType,
        },
      },
    }));

    await this.runMutate('adGroupCriteria', operations);
    console.log('[GoogleAdsClient] Added', keywords.length, 'keywords');
  }

  /**
   * Enable a campaign
   */
  async enableCampaign(campaignResourceName: string): Promise<void> {
    await this.runMutate('campaigns', [
      {
        update: { resourceName: campaignResourceName, status: 'ENABLED' },
        updateMask: 'status',
      },
    ]);
    console.log('[GoogleAdsClient] Enabled campaign:', campaignResourceName);
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignResourceName: string): Promise<void> {
    await this.runMutate('campaigns', [
      {
        update: { resourceName: campaignResourceName, status: 'PAUSED' },
        updateMask: 'status',
      },
    ]);
    console.log('[GoogleAdsClient] Paused campaign:', campaignResourceName);
  }

  /**
   * Pause an ad group
   */
  async pauseAdGroup(adGroupResourceName: string): Promise<void> {
    await this.runMutate('adGroups', [
      {
        update: { resourceName: adGroupResourceName, status: 'PAUSED' },
        updateMask: 'status',
      },
    ]);
    console.log('[GoogleAdsClient] Paused ad group:', adGroupResourceName);
  }

  /**
   * Enable an ad group
   */
  async enableAdGroup(adGroupResourceName: string): Promise<void> {
    await this.runMutate('adGroups', [
      {
        update: { resourceName: adGroupResourceName, status: 'ENABLED' },
        updateMask: 'status',
      },
    ]);
    console.log('[GoogleAdsClient] Enabled ad group:', adGroupResourceName);
  }

  /**
   * Remove a campaign (set status to REMOVED)
   */
  async removeCampaign(campaignResourceName: string): Promise<void> {
    await this.runMutate('campaigns', [
      {
        update: { resourceName: campaignResourceName, status: 'REMOVED' },
        updateMask: 'status',
      },
    ]);
    console.log('[GoogleAdsClient] Removed campaign:', campaignResourceName);
  }

  /**
   * Get metrics for all ad groups within a campaign
   */
  async getAdGroupMetrics(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<AdGroupMetrics[]> {
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad_group
      WHERE campaign.id = ${campaignId}
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group.status != 'REMOVED'
    `;

    const response = await this.runQuery(query);

    const groupMap = new Map<string, AdGroupMetrics>();

    for (const row of response.results || []) {
      const rawRow = row as Record<string, unknown>;
      const adGroup = rawRow.adGroup as { id?: string; name?: string } | undefined;
      const metrics = rawRow.metrics as {
        impressions?: string;
        clicks?: string;
        costMicros?: string;
        conversions?: number;
        ctr?: number;
        averageCpc?: string;
      } | undefined;

      const agId = adGroup?.id || '';
      const existing = groupMap.get(agId);

      const impressions = parseInt(metrics?.impressions || '0');
      const clicks = parseInt(metrics?.clicks || '0');
      const costMicros = parseInt(metrics?.costMicros || '0');
      const conversions = metrics?.conversions || 0;

      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.cost += costMicros / 1_000_000;
        existing.conversions += conversions;
      } else {
        groupMap.set(agId, {
          adGroupId: agId,
          adGroupName: adGroup?.name || 'Unknown',
          impressions,
          clicks,
          cost: costMicros / 1_000_000,
          conversions,
          ctr: 0,
          cpc: 0,
        });
      }
    }

    return Array.from(groupMap.values()).map((ag) => ({
      ...ag,
      ctr: ag.impressions > 0
        ? Number(((ag.clicks / ag.impressions) * 100).toFixed(2))
        : 0,
      cpc: ag.clicks > 0
        ? Number((ag.cost / ag.clicks).toFixed(2))
        : 0,
    }));
  }

  /**
   * Get account-level summary metrics
   */
  async getAccountSummary(startDate: string, endDate: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalCost: number;
    totalConversions: number;
    ctr: number;
    avgCpc: number;
    avgCpa: number | null;
  }> {
    const query = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    const response = await this.runQuery(query);

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;

    for (const row of response.results || []) {
      totalImpressions += parseInt(row.metrics?.impressions || '0');
      totalClicks += parseInt(row.metrics?.clicks || '0');
      totalCostMicros += parseInt(row.metrics?.costMicros || '0');
      totalConversions += row.metrics?.conversions || 0;
    }

    const totalCost = totalCostMicros / 1000000;

    return {
      totalImpressions,
      totalClicks,
      totalCost,
      totalConversions,
      ctr: totalImpressions > 0
        ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
        : 0,
      avgCpc: totalClicks > 0
        ? Number((totalCost / totalClicks).toFixed(2))
        : 0,
      avgCpa: totalConversions > 0
        ? Number((totalCost / totalConversions).toFixed(2))
        : null,
    };
  }
}

// Singleton instance
let clientInstance: GoogleAdsClient | null = null;

export function getGoogleAdsClient(): GoogleAdsClient {
  if (!clientInstance) {
    clientInstance = new GoogleAdsClient();
  }
  return clientInstance;
}
