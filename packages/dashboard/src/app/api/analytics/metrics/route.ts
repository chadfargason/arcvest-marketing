/**
 * Analytics Metrics API
 *
 * GET: Fetch analytics metrics for a date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGA4Client } from '@/lib/google/ga4-client';

/**
 * GET /api/analytics/metrics
 * Get analytics metrics for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Default to last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const ga4 = getGA4Client();

    // Fetch all the data in parallel
    const [dailyMetrics, summary, trafficBySource, topPages] = await Promise.all([
      ga4.getDailyMetrics(start, end),
      ga4.getOverviewMetrics(start, end),
      ga4.getTrafficBySource(start, end),
      ga4.getTopPages(start, end, 10),
    ]);

    return NextResponse.json({
      dateRange: { startDate: start, endDate: end },
      summary,
      dailyMetrics,
      trafficBySource,
      topPages,
    });
  } catch (error) {
    console.error('[Analytics Metrics] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}
