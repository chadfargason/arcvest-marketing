/**
 * Google Analytics 4 Data API Client
 *
 * Uses OAuth refresh token to fetch analytics data
 */

interface GA4ReportRow {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}

interface GA4Response {
  rows?: GA4ReportRow[];
  rowCount?: number;
}

export class GA4Client {
  private propertyId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
    if (!propertyId) {
      throw new Error('GOOGLE_ANALYTICS_PROPERTY_ID not configured');
    }
    this.propertyId = propertyId;
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
   * Run a GA4 Data API report
   */
  private async runReport(request: {
    dateRanges: Array<{ startDate: string; endDate: string }>;
    dimensions?: Array<{ name: string }>;
    metrics: Array<{ name: string }>;
  }): Promise<GA4Response> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${this.propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GA4 API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Get overview metrics for a date range
   */
  async getOverviewMetrics(startDate: string, endDate: string): Promise<{
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    newUsers: number;
  }> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
      ],
    });

    const row = report.rows?.[0];
    const values = row?.metricValues || [];

    return {
      sessions: parseInt(values[0]?.value || '0'),
      users: parseInt(values[1]?.value || '0'),
      pageviews: parseInt(values[2]?.value || '0'),
      bounceRate: parseFloat(values[3]?.value || '0'),
      avgSessionDuration: parseFloat(values[4]?.value || '0'),
      newUsers: parseInt(values[5]?.value || '0'),
    };
  }

  /**
   * Get daily metrics for charting
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<Array<{
    date: string;
    sessions: number;
    users: number;
    pageviews: number;
  }>> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    });

    return (report.rows || []).map((row) => {
      const date = row.dimensionValues?.[0]?.value || '';
      const values = row.metricValues || [];

      // Convert YYYYMMDD to YYYY-MM-DD
      const formattedDate = date.length === 8
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
        : date;

      return {
        date: formattedDate,
        sessions: parseInt(values[0]?.value || '0'),
        users: parseInt(values[1]?.value || '0'),
        pageviews: parseInt(values[2]?.value || '0'),
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get traffic by source/medium
   */
  async getTrafficBySource(startDate: string, endDate: string): Promise<Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
  }>> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
    });

    return (report.rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || '(direct)',
      medium: row.dimensionValues?.[1]?.value || '(none)',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
    })).sort((a, b) => b.sessions - a.sessions);
  }

  /**
   * Get top pages
   */
  async getTopPages(startDate: string, endDate: string, limit = 10): Promise<Array<{
    pagePath: string;
    pageTitle: string;
    pageviews: number;
    avgTimeOnPage: number;
  }>> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
    });

    return (report.rows || [])
      .map((row) => ({
        pagePath: row.dimensionValues?.[0]?.value || '',
        pageTitle: row.dimensionValues?.[1]?.value || '',
        pageviews: parseInt(row.metricValues?.[0]?.value || '0'),
        avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, limit);
  }

  /**
   * Get conversions (form submissions, etc.)
   */
  async getConversions(startDate: string, endDate: string): Promise<Array<{
    eventName: string;
    count: number;
  }>> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
    });

    // Filter for conversion-like events
    const conversionEvents = ['form_submit', 'generate_lead', 'contact', 'sign_up', 'purchase'];

    return (report.rows || [])
      .filter((row) => {
        const eventName = row.dimensionValues?.[0]?.value?.toLowerCase() || '';
        return conversionEvents.some(ce => eventName.includes(ce));
      })
      .map((row) => ({
        eventName: row.dimensionValues?.[0]?.value || '',
        count: parseInt(row.metricValues?.[0]?.value || '0'),
      }));
  }
}

// Singleton instance
let clientInstance: GA4Client | null = null;

export function getGA4Client(): GA4Client {
  if (!clientInstance) {
    clientInstance = new GA4Client();
  }
  return clientInstance;
}
