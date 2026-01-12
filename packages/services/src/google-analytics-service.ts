import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Google Analytics 4 Service
 *
 * Handles integration with Google Analytics 4 Data API
 * for fetching website traffic and performance metrics.
 *
 * Note: Full GA4 API integration requires:
 * 1. Google Cloud project with GA4 Data API enabled
 * 2. Service account credentials or OAuth2 setup
 * 3. Property access granted to the service account
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

export class GoogleAnalyticsService {
  private supabase: SupabaseClient;
  private config: GA4Config | null = null;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Initialize the service with GA4 credentials
   */
  async initialize(config: GA4Config): Promise<void> {
    this.config = config;
    // In a full implementation, validate credentials here
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.propertyId;
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
   *
   * Note: This is a placeholder. Full implementation requires:
   * - @google-analytics/data package
   * - Proper authentication flow
   */
  async syncFromGA4(startDate: string, endDate: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    if (!this.isConfigured()) {
      throw new Error('Google Analytics service not configured. Please provide API credentials.');
    }

    // In a full implementation, this would:
    // 1. Use the @google-analytics/data package
    // 2. Run reports for sessions, users, pageviews, events
    // 3. Aggregate by date and source
    // 4. Save to daily_metrics table

    // Placeholder return
    return {
      synced: 0,
      errors: ['GA4 API integration requires additional setup. See documentation.'],
    };
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
