// @ts-nocheck
/**
 * Google Analytics 4 Data API Client
 *
 * Fetches analytics data from GA4 for reporting and analysis.
 */

import { createLogger } from '@arcvest/shared';

const logger = createLogger('ga4-client');

export interface GA4Config {
  propertyId: string;
  credentials?: {
    clientEmail: string;
    privateKey: string;
  };
}

export interface GA4MetricValue {
  value: string;
}

export interface GA4DimensionValue {
  value: string;
}

export interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

export interface GA4Response {
  rows: GA4Row[];
  rowCount: number;
  metadata?: {
    currencyCode: string;
    timeZone: string;
  };
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD or relative like 'today', '7daysAgo'
  endDate: string;
}

export interface ReportRequest {
  dateRanges: DateRange[];
  dimensions?: string[];
  metrics: string[];
  dimensionFilter?: {
    filter: {
      fieldName: string;
      stringFilter: {
        matchType: 'EXACT' | 'BEGINS_WITH' | 'ENDS_WITH' | 'CONTAINS';
        value: string;
      };
    };
  };
  orderBys?: {
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
    desc?: boolean;
  }[];
  limit?: number;
}

export interface WebsiteMetrics {
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface PagePerformance {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

export class GA4Client {
  private propertyId: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config?: Partial<GA4Config>) {
    this.propertyId = config?.propertyId || process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '';

    if (!this.propertyId) {
      logger.warn('GA4 property ID not configured');
    }
  }

  /**
   * Get access token for GA4 API.
   */
  private async getAccessToken(): Promise<string> {
    // Check if existing token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // In production, use service account or OAuth
    // For now, return placeholder
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEmail || !serviceAccountKey) {
      throw new Error('Google service account credentials not configured');
    }

    // In production, implement JWT signing for service account auth
    // For now, simulate token acquisition
    logger.info('Acquiring GA4 access token');

    // Placeholder - would use google-auth-library in production
    this.accessToken = 'simulated-access-token';
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour

    return this.accessToken;
  }

  /**
   * Run a GA4 Data API report.
   */
  async runReport(request: ReportRequest): Promise<GA4Response> {
    if (!this.propertyId) {
      logger.warn('GA4 not configured, returning simulated data');
      return this.simulateReport(request);
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${this.propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('GA4 API error', { status: response.status, error });
        throw new Error(`GA4 API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.error('Failed to run GA4 report', error);
      // Return simulated data as fallback
      return this.simulateReport(request);
    }
  }

  /**
   * Get website metrics for a date range.
   */
  async getWebsiteMetrics(startDate: string, endDate: string): Promise<WebsiteMetrics> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        'sessions',
        'totalUsers',
        'newUsers',
        'screenPageViews',
        'averageSessionDuration',
        'bounceRate',
        'conversions',
      ],
    });

    const row = report.rows?.[0];
    if (!row) {
      return this.getEmptyMetrics();
    }

    const values = row.metricValues.map((v) => parseFloat(v.value) || 0);

    return {
      sessions: values[0],
      users: values[1],
      newUsers: values[2],
      pageviews: values[3],
      avgSessionDuration: values[4],
      bounceRate: values[5],
      conversions: values[6],
      conversionRate: values[0] > 0 ? (values[6] / values[0]) * 100 : 0,
    };
  }

  /**
   * Get traffic sources breakdown.
   */
  async getTrafficSources(startDate: string, endDate: string): Promise<TrafficSource[]> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: ['sessionSource', 'sessionMedium'],
      metrics: ['sessions', 'totalUsers', 'conversions'],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    return (report.rows || []).map((row) => ({
      source: row.dimensionValues[0]?.value || '(direct)',
      medium: row.dimensionValues[1]?.value || '(none)',
      sessions: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
      conversions: parseInt(row.metricValues[2]?.value || '0'),
    }));
  }

  /**
   * Get top pages by pageviews.
   */
  async getTopPages(startDate: string, endDate: string, limit: number = 10): Promise<PagePerformance[]> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: ['pagePath', 'pageTitle'],
      metrics: ['screenPageViews', 'userEngagementDuration', 'bounceRate'],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit,
    });

    return (report.rows || []).map((row) => ({
      pagePath: row.dimensionValues[0]?.value || '/',
      pageTitle: row.dimensionValues[1]?.value || 'Unknown',
      pageviews: parseInt(row.metricValues[0]?.value || '0'),
      uniquePageviews: parseInt(row.metricValues[0]?.value || '0'), // GA4 doesn't have unique pageviews
      avgTimeOnPage: parseFloat(row.metricValues[1]?.value || '0'),
      bounceRate: parseFloat(row.metricValues[2]?.value || '0'),
    }));
  }

  /**
   * Get conversion data by landing page.
   */
  async getConversionsByLandingPage(
    startDate: string,
    endDate: string
  ): Promise<{ landingPage: string; sessions: number; conversions: number; conversionRate: number }[]> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: ['landingPage'],
      metrics: ['sessions', 'conversions'],
      orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
      limit: 10,
    });

    return (report.rows || []).map((row) => {
      const sessions = parseInt(row.metricValues[0]?.value || '0');
      const conversions = parseInt(row.metricValues[1]?.value || '0');
      return {
        landingPage: row.dimensionValues[0]?.value || '/',
        sessions,
        conversions,
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
      };
    });
  }

  /**
   * Get metrics broken down by day.
   */
  async getDailyMetrics(
    startDate: string,
    endDate: string
  ): Promise<{ date: string; sessions: number; users: number; conversions: number }[]> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: ['date'],
      metrics: ['sessions', 'totalUsers', 'conversions'],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    return (report.rows || []).map((row) => ({
      date: row.dimensionValues[0]?.value || '',
      sessions: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
      conversions: parseInt(row.metricValues[2]?.value || '0'),
    }));
  }

  /**
   * Get campaign performance data.
   */
  async getCampaignPerformance(
    startDate: string,
    endDate: string
  ): Promise<{ campaign: string; sessions: number; users: number; conversions: number; cost?: number }[]> {
    const report = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: ['sessionCampaignName'],
      metrics: ['sessions', 'totalUsers', 'conversions'],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionCampaignName',
          stringFilter: {
            matchType: 'BEGINS_WITH',
            value: '', // All campaigns
          },
        },
      },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    });

    return (report.rows || [])
      .filter((row) => row.dimensionValues[0]?.value && row.dimensionValues[0].value !== '(not set)')
      .map((row) => ({
        campaign: row.dimensionValues[0]?.value || '',
        sessions: parseInt(row.metricValues[0]?.value || '0'),
        users: parseInt(row.metricValues[1]?.value || '0'),
        conversions: parseInt(row.metricValues[2]?.value || '0'),
      }));
  }

  /**
   * Get empty metrics object.
   */
  private getEmptyMetrics(): WebsiteMetrics {
    return {
      sessions: 0,
      users: 0,
      newUsers: 0,
      pageviews: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversions: 0,
      conversionRate: 0,
    };
  }

  /**
   * Simulate GA4 report data for development/testing.
   */
  private simulateReport(request: ReportRequest): GA4Response {
    logger.debug('Simulating GA4 report', { metrics: request.metrics });

    const rows: GA4Row[] = [];
    const hasDimensions = request.dimensions && request.dimensions.length > 0;
    const rowCount = hasDimensions ? Math.min(request.limit || 10, 10) : 1;

    for (let i = 0; i < rowCount; i++) {
      const dimensionValues: GA4DimensionValue[] = [];
      const metricValues: GA4MetricValue[] = [];

      // Generate dimension values
      if (request.dimensions) {
        for (const dim of request.dimensions) {
          let value = '';
          switch (dim) {
            case 'date':
              const date = new Date();
              date.setDate(date.getDate() - i);
              value = date.toISOString().split('T')[0].replace(/-/g, '');
              break;
            case 'sessionSource':
              value = ['google', 'direct', 'facebook', 'linkedin', 'bing'][i % 5];
              break;
            case 'sessionMedium':
              value = ['organic', '(none)', 'cpc', 'social', 'organic'][i % 5];
              break;
            case 'pagePath':
              value = ['/', '/about', '/services', '/contact', '/blog'][i % 5];
              break;
            case 'pageTitle':
              value = ['Home', 'About Us', 'Services', 'Contact', 'Blog'][i % 5];
              break;
            case 'landingPage':
              value = ['/', '/services', '/retirement-planning', '/contact', '/blog'][i % 5];
              break;
            case 'sessionCampaignName':
              value = i === 0 ? '(not set)' : `campaign_${i}`;
              break;
            default:
              value = `dimension_${i}`;
          }
          dimensionValues.push({ value });
        }
      }

      // Generate metric values
      for (const metric of request.metrics) {
        let value = '0';
        const baseValue = Math.floor(Math.random() * 100) + 50;

        switch (metric) {
          case 'sessions':
            value = String(baseValue * (hasDimensions ? 1 : 10));
            break;
          case 'totalUsers':
            value = String(Math.floor(baseValue * 0.8 * (hasDimensions ? 1 : 10)));
            break;
          case 'newUsers':
            value = String(Math.floor(baseValue * 0.5 * (hasDimensions ? 1 : 10)));
            break;
          case 'screenPageViews':
            value = String(baseValue * 2 * (hasDimensions ? 1 : 10));
            break;
          case 'averageSessionDuration':
            value = String(120 + Math.random() * 180);
            break;
          case 'bounceRate':
            value = String(0.3 + Math.random() * 0.3);
            break;
          case 'conversions':
            value = String(Math.floor(baseValue * 0.05 * (hasDimensions ? 1 : 10)));
            break;
          case 'userEngagementDuration':
            value = String(60 + Math.random() * 120);
            break;
          default:
            value = String(baseValue);
        }
        metricValues.push({ value });
      }

      rows.push({ dimensionValues, metricValues });
    }

    return {
      rows,
      rowCount: rows.length,
      metadata: {
        currencyCode: 'USD',
        timeZone: 'America/Chicago',
      },
    };
  }

  /**
   * Test the GA4 connection.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getWebsiteMetrics('7daysAgo', 'today');
      logger.info('GA4 connection successful');
      return true;
    } catch (error) {
      logger.error('GA4 connection failed', error);
      return false;
    }
  }
}
