/**
 * Google Search Console API Client
 *
 * Uses OAuth refresh token to fetch search analytics data
 */

const SITE_URL = 'https://arcvest.com/';

interface SearchAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[];
  responseAggregationType?: string;
}

export class SearchConsoleClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

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
   * Query the Search Analytics API
   */
  private async querySearchAnalytics(
    startDate: string,
    endDate: string,
    dimensions: string[],
    rowLimit: number = 1000
  ): Promise<SearchAnalyticsResponse> {
    const accessToken = await this.getAccessToken();
    const encodedSiteUrl = encodeURIComponent(SITE_URL);

    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search Console API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Get summary metrics for a date range
   */
  async getSummary(startDate: string, endDate: string): Promise<{
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
  }> {
    const result = await this.querySearchAnalytics(startDate, endDate, [], 1);

    // When no dimensions are specified, the API returns aggregated totals
    const row = result.rows?.[0];
    return {
      totalClicks: row?.clicks ?? 0,
      totalImpressions: row?.impressions ?? 0,
      averageCtr: row?.ctr ?? 0,
      averagePosition: row?.position ?? 0,
    };
  }

  /**
   * Get daily metrics for charting
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>> {
    const result = await this.querySearchAnalytics(startDate, endDate, ['date']);

    return (result.rows || []).map((row) => ({
      date: row.keys?.[0] || '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top search queries
   */
  async getTopQueries(startDate: string, endDate: string, limit: number = 20): Promise<Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>> {
    const result = await this.querySearchAnalytics(startDate, endDate, ['query'], limit);

    return (result.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })).sort((a, b) => b.clicks - a.clicks);
  }

  /**
   * Get top pages
   */
  async getTopPages(startDate: string, endDate: string, limit: number = 20): Promise<Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>> {
    const result = await this.querySearchAnalytics(startDate, endDate, ['page'], limit);

    return (result.rows || []).map((row) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })).sort((a, b) => b.clicks - a.clicks);
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(startDate: string, endDate: string): Promise<Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>> {
    const result = await this.querySearchAnalytics(startDate, endDate, ['device']);

    return (result.rows || []).map((row) => ({
      device: row.keys?.[0] || '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })).sort((a, b) => b.clicks - a.clicks);
  }
}

// Singleton instance
let clientInstance: SearchConsoleClient | null = null;

export function getSearchConsoleClient(): SearchConsoleClient {
  if (!clientInstance) {
    clientInstance = new SearchConsoleClient();
  }
  return clientInstance;
}
