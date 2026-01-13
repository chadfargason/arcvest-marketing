import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * Google Analytics 4 Service
 *
 * Handles integration with Google Analytics 4 Data API
 * for fetching website traffic and performance metrics.
 */

export interface GA4Config {
  propertyId: string;
  credentials: {
    type: 'service_account' | 'oauth';
    // For service account
    clientEmail?: string;
    privateKey?: string;
    // For OAuth
    accessToken?: string;
    refreshToken?: string;
  };
}

export interface DailyMetrics {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  bounce_rate: number;
  avg_session_duration: number;
  traffic_by_source: Record<string, number>;
  form_submissions: number;
  whitepaper_downloads: number;
  consultation_requests: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  bounce_rate: number;
  conversion_rate: number;
}

export interface TopPage {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  avgTimeOnPage: number;
}

export class GoogleAnalyticsService {
  private supabase: SupabaseClient;
  private analyticsClient: BetaAnalyticsDataClient | null = null;
  private propertyId: string | null = null;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
    this.initializeFromEnv();
  }

  /**
   * Initialize GA4 client from environment variables
   */
  private initializeFromEnv(): void {
    const propertyId = process.env['GA4_PROPERTY_ID'];
    const serviceAccountKey = process.env['GA4_SERVICE_ACCOUNT_KEY'];

    if (!propertyId || !serviceAccountKey) {
      console.log('[GA4] Missing configuration - GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_KEY not set');
      return;
    }

    try {
      const credentials = JSON.parse(serviceAccountKey);
      this.propertyId = propertyId;
      this.analyticsClient = new BetaAnalyticsDataClient({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        projectId: credentials.project_id,
      });
      console.log('[GA4] Client initialized successfully');
    } catch (error) {
      console.error('[GA4] Failed to initialize client:', error);
    }
  }

  /**
   * Check if the service is configured and ready
   */
  isConfigured(): boolean {
    return this.analyticsClient !== null && !!this.propertyId;
  }

  /**
   * Get connection status for settings page
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    propertyId?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        error: 'GA4 not configured. Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY.',
      };
    }

    try {
      // Test the connection by running a simple query
      await this.analyticsClient!.runReport({
        property: this.propertyId!,
        dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      return {
        connected: true,
        propertyId: this.propertyId!,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get daily metrics from the database
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<DailyMetrics[]> {
    const { data, error } = await this.supabase
      .from('daily_metrics')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch daily metrics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Save daily metrics (used during sync)
   */
  async saveDailyMetrics(metrics: DailyMetrics): Promise<void> {
    const { error } = await this.supabase
      .from('daily_metrics')
      .upsert(
        {
          date: metrics.date,
          sessions: metrics.sessions,
          users: metrics.users,
          pageviews: metrics.pageviews,
          bounce_rate: metrics.bounce_rate,
          avg_session_duration: metrics.avg_session_duration,
          traffic_by_source: metrics.traffic_by_source,
          form_submissions: metrics.form_submissions,
          whitepaper_downloads: metrics.whitepaper_downloads,
          consultation_requests: metrics.consultation_requests,
        },
        { onConflict: 'date' }
      );

    if (error) {
      throw new Error(`Failed to save daily metrics: ${error.message}`);
    }
  }

  /**
   * Get metrics summary for a period
   */
  async getMetricsSummary(startDate: string, endDate: string): Promise<{
    totalSessions: number;
    totalUsers: number;
    totalPageviews: number;
    avgBounceRate: number;
    avgSessionDuration: number;
    totalFormSubmissions: number;
    totalConsultationRequests: number;
  }> {
    const metrics = await this.getDailyMetrics(startDate, endDate);

    if (metrics.length === 0) {
      return {
        totalSessions: 0,
        totalUsers: 0,
        totalPageviews: 0,
        avgBounceRate: 0,
        avgSessionDuration: 0,
        totalFormSubmissions: 0,
        totalConsultationRequests: 0,
      };
    }

    const totals = metrics.reduce(
      (acc, m) => ({
        sessions: acc.sessions + (m.sessions || 0),
        users: acc.users + (m.users || 0),
        pageviews: acc.pageviews + (m.pageviews || 0),
        bounceRate: acc.bounceRate + (m.bounce_rate || 0),
        sessionDuration: acc.sessionDuration + (m.avg_session_duration || 0),
        formSubmissions: acc.formSubmissions + (m.form_submissions || 0),
        consultationRequests: acc.consultationRequests + (m.consultation_requests || 0),
      }),
      {
        sessions: 0,
        users: 0,
        pageviews: 0,
        bounceRate: 0,
        sessionDuration: 0,
        formSubmissions: 0,
        consultationRequests: 0,
      }
    );

    return {
      totalSessions: totals.sessions,
      totalUsers: totals.users,
      totalPageviews: totals.pageviews,
      avgBounceRate: totals.bounceRate / metrics.length,
      avgSessionDuration: totals.sessionDuration / metrics.length,
      totalFormSubmissions: totals.formSubmissions,
      totalConsultationRequests: totals.consultationRequests,
    };
  }

  /**
   * Sync data from Google Analytics 4
   * Fetches metrics for the specified date range and saves to database
   */
  async syncFromGA4(startDate: string, endDate: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    if (!this.isConfigured()) {
      throw new Error('Google Analytics service not configured. Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY.');
    }

    const errors: string[] = [];
    let synced = 0;

    try {
      console.log(`[GA4] Syncing data from ${startDate} to ${endDate}`);

      // Fetch core metrics by date
      const [coreMetricsResponse] = await this.analyticsClient!.runReport({
        property: this.propertyId!,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      });

      // Fetch traffic sources by date
      const [trafficResponse] = await this.analyticsClient!.runReport({
        property: this.propertyId!,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
      });

      // Fetch events (conversions) by date
      const [eventsResponse] = await this.analyticsClient!.runReport({
        property: this.propertyId!,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['form_submit', 'file_download', 'contact_click', 'consultation_request'],
            },
          },
        },
      });

      // Build metrics by date
      const metricsByDate: Record<string, DailyMetrics> = {};

      // Process core metrics
      for (const row of coreMetricsResponse.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        if (!dateValue) continue;

        // Convert YYYYMMDD to YYYY-MM-DD
        const formattedDate = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;

        metricsByDate[formattedDate] = {
          date: formattedDate,
          sessions: parseInt(row.metricValues?.[0]?.value || '0'),
          users: parseInt(row.metricValues?.[1]?.value || '0'),
          pageviews: parseInt(row.metricValues?.[2]?.value || '0'),
          bounce_rate: parseFloat(row.metricValues?.[3]?.value || '0'),
          avg_session_duration: parseFloat(row.metricValues?.[4]?.value || '0'),
          traffic_by_source: {},
          form_submissions: 0,
          whitepaper_downloads: 0,
          consultation_requests: 0,
        };
      }

      // Process traffic sources
      for (const row of trafficResponse.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        const source = row.dimensionValues?.[1]?.value || 'unknown';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');

        if (!dateValue) continue;
        const formattedDate = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;

        if (metricsByDate[formattedDate]) {
          metricsByDate[formattedDate].traffic_by_source[source] = sessions;
        }
      }

      // Process events
      for (const row of eventsResponse.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        const eventName = row.dimensionValues?.[1]?.value;
        const count = parseInt(row.metricValues?.[0]?.value || '0');

        if (!dateValue || !eventName) continue;
        const formattedDate = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;

        if (metricsByDate[formattedDate]) {
          if (eventName === 'form_submit' || eventName === 'contact_click') {
            metricsByDate[formattedDate].form_submissions += count;
          } else if (eventName === 'file_download') {
            metricsByDate[formattedDate].whitepaper_downloads += count;
          } else if (eventName === 'consultation_request') {
            metricsByDate[formattedDate].consultation_requests += count;
          }
        }
      }

      // Save all metrics to database
      for (const metrics of Object.values(metricsByDate)) {
        try {
          await this.saveDailyMetrics(metrics);
          synced++;
        } catch (err) {
          errors.push(`Failed to save metrics for ${metrics.date}: ${err}`);
        }
      }

      console.log(`[GA4] Sync complete. ${synced} days synced.`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`GA4 sync failed: ${errorMsg}`);
      console.error('[GA4] Sync error:', error);
    }

    return { synced, errors };
  }

  /**
   * Get top pages for a period
   */
  async getTopPages(startDate: string, endDate: string, limit: number = 10): Promise<TopPage[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const [response] = await this.analyticsClient!.runReport({
        property: this.propertyId!,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit,
      });

      return (response.rows || []).map((row) => ({
        pagePath: row.dimensionValues?.[0]?.value || '',
        pageTitle: row.dimensionValues?.[1]?.value || '',
        pageviews: parseInt(row.metricValues?.[0]?.value || '0'),
        avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
      }));
    } catch (error) {
      console.error('[GA4] Failed to fetch top pages:', error);
      return [];
    }
  }

  /**
   * Get traffic by source for a period
   */
  async getTrafficBySource(startDate: string, endDate: string): Promise<Record<string, number>> {
    const metrics = await this.getDailyMetrics(startDate, endDate);

    const sourceMap: Record<string, number> = {};
    metrics.forEach((m) => {
      if (m.traffic_by_source) {
        Object.entries(m.traffic_by_source).forEach(([source, sessions]) => {
          sourceMap[source] = (sourceMap[source] || 0) + (sessions as number);
        });
      }
    });

    return sourceMap;
  }

  /**
   * Calculate conversion rate from form submissions
   */
  async getConversionRate(startDate: string, endDate: string): Promise<number> {
    const summary = await this.getMetricsSummary(startDate, endDate);
    if (summary.totalSessions === 0) return 0;
    return (summary.totalFormSubmissions / summary.totalSessions) * 100;
  }
}

// Singleton instance
let serviceInstance: GoogleAnalyticsService | null = null;

export function getGoogleAnalyticsService(): GoogleAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new GoogleAnalyticsService();
  }
  return serviceInstance;
}
