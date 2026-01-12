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

export class GoogleAdsClient {
  private customerId: string;
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
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google OAuth credentials not configured');
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

    return this.accessToken as string;
  }

  /**
   * Run a Google Ads query using GAQL
   */
  private async runQuery(query: string): Promise<GoogleAdsResponse> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': this.developerToken,
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
