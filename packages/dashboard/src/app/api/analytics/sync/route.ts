/**
 * Analytics Sync API
 *
 * POST: Trigger manual GA4 data sync
 * GET: Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGA4Client } from '@/lib/google/ga4-client';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/analytics/sync
 * Trigger a manual sync from GA4
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;

    // Default to last 7 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Analytics Sync] Starting sync from ${start} to ${end}`);

    const ga4 = getGA4Client();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch daily metrics from GA4
    const dailyMetrics = await ga4.getDailyMetrics(start, end);

    // Sync to database
    let syncedDays = 0;
    for (const metric of dailyMetrics) {
      const { error } = await supabase.from('daily_metrics').upsert({
        date: metric.date,
        sessions: metric.sessions,
        users: metric.users,
        pageviews: metric.pageviews,
      }, {
        onConflict: 'date',
      });

      if (!error) syncedDays++;
    }

    return NextResponse.json({
      success: true,
      syncedDays,
      dateRange: { startDate: start, endDate: end },
    });
  } catch (error) {
    console.error('[Analytics Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/sync
 * Get GA4 connection status
 */
export async function GET() {
  try {
    const ga4 = getGA4Client();

    // Test the connection by fetching today's metrics
    const today = new Date().toISOString().split('T')[0];
    const metrics = await ga4.getOverviewMetrics(today, today);

    return NextResponse.json({
      connected: true,
      propertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
      todaySessions: metrics.sessions,
    });
  } catch (error) {
    console.error('[Analytics Sync] Status check error:', error);
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    });
  }
}
