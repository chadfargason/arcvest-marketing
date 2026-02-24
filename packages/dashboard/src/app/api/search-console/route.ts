import { NextRequest, NextResponse } from 'next/server';
import { getSearchConsoleClient } from '@/lib/google/search-console-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    // Search Console data lags ~3 days
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const client = getSearchConsoleClient();

    const [summary, dailyMetrics, topQueries, topPages, deviceBreakdown] = await Promise.all([
      client.getSummary(startDateStr, endDateStr),
      client.getDailyMetrics(startDateStr, endDateStr),
      client.getTopQueries(startDateStr, endDateStr, 20),
      client.getTopPages(startDateStr, endDateStr, 20),
      client.getDeviceBreakdown(startDateStr, endDateStr),
    ]);

    return NextResponse.json({
      period: {
        days,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      summary,
      dailyMetrics,
      topQueries,
      topPages,
      deviceBreakdown,
    });
  } catch (error) {
    console.error('Error in GET /api/search-console:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
