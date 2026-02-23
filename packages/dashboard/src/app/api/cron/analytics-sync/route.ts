/**
 * Analytics Sync Cron
 *
 * Scheduled to run daily at 2am CT (08:00 UTC)
 * Syncs yesterday's GA4 data to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGA4Client } from '@/lib/google/ga4-client';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/cron/analytics-sync
 * Called by Vercel Cron daily
 */
export async function GET(request: NextRequest) {
  const isTest = request.nextUrl.searchParams.get('test') === 'true';

  // Verify cron secret (Vercel cron sends x-vercel-cron: 1)
  // Test mode is read-only and doesn't expose secrets, so skip auth
  if (!isTest) {
    const authHeader = request.headers.get('authorization');
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
      console.warn('[Analytics Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const trigger = request.headers.get('x-vercel-cron') === '1' ? 'Vercel Cron' : 'Manual';
  console.log(`[Analytics Cron] Starting ${isTest ? 'connection test' : 'scheduled sync'} (Trigger: ${trigger})...`);

  try {
    // Check if GA4 is configured
    const configStatus = {
      GOOGLE_ANALYTICS_PROPERTY_ID: !!process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
    };

    if (!process.env.GOOGLE_ANALYTICS_PROPERTY_ID) {
      console.log('[Analytics Cron] GA4 not configured, skipping sync');
      return NextResponse.json({
        success: false,
        message: 'GA4 not configured',
        config: configStatus,
      });
    }

    const ga4 = getGA4Client();

    // Connection test mode - just verify we can fetch data
    if (isTest) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const overview = await ga4.getOverviewMetrics(yesterdayStr, yesterdayStr);
      return NextResponse.json({
        success: true,
        mode: 'test',
        config: configStatus,
        propertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
        testData: overview,
        message: 'GA4 connection successful - OAuth token is valid',
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sync yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fetch yesterday's metrics from GA4
    const dailyMetrics = await ga4.getDailyMetrics(yesterdayStr, yesterdayStr);
    const overview = await ga4.getOverviewMetrics(yesterdayStr, yesterdayStr);

    // Sync to database
    let synced = 0;
    const errors: string[] = [];

    for (const metric of dailyMetrics) {
      const { error } = await supabase.from('daily_metrics').upsert({
        date: metric.date,
        sessions: metric.sessions,
        users: metric.users,
        pageviews: metric.pageviews,
        new_users: overview.newUsers,
        bounce_rate: overview.bounceRate,
        avg_session_duration: Math.round(overview.avgSessionDuration),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date',
      });

      if (error) {
        errors.push(error.message);
      } else {
        synced++;
      }
    }

    console.log('[Analytics Cron] Sync complete:', { synced, errors: errors.length });

    // Log to activity log
    if (synced > 0) {
      await supabase.from('activity_log').insert({
        actor: 'analytics_agent',
        action: 'ga4_sync_complete',
        entity_type: 'daily_metrics',
        details: {
          date: yesterdayStr,
          synced,
          overview,
          errors: errors.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: yesterdayStr,
      synced,
      overview,
      errors: errors.length,
    });
  } catch (error) {
    console.error('[Analytics Cron] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analytics sync failed',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max
