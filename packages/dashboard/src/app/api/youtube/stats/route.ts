/**
 * GET /api/youtube/stats
 *
 * Returns the latest YouTube channel snapshot plus 7-day and 30-day deltas,
 * and a sparkline series. Read-only — reads from youtube_channel_stats
 * populated by /api/cron/youtube-stats.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface StatRow {
  snapshot_date: string;
  subscriber_count: number;
  video_count: number | null;
  view_count: number | null;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from('youtube_channel_stats')
      .select('snapshot_date, subscriber_count, video_count, view_count')
      .order('snapshot_date', { ascending: false })
      .limit(31);

    if (error) throw error;
    const rows = (data || []) as StatRow[];

    if (rows.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'No snapshots yet. Run /api/cron/youtube-stats to seed.',
      });
    }

    const latest = rows[0];
    const findRowNDaysBack = (days: number): StatRow | undefined => {
      const target = new Date(latest.snapshot_date);
      target.setUTCDate(target.getUTCDate() - days);
      const targetStr = target.toISOString().split('T')[0];
      return rows.find((r) => r.snapshot_date <= targetStr);
    };

    const sevenDaysAgo = findRowNDaysBack(7);
    const thirtyDaysAgo = findRowNDaysBack(30);

    const delta7 = sevenDaysAgo
      ? latest.subscriber_count - sevenDaysAgo.subscriber_count
      : null;
    const delta30 = thirtyDaysAgo
      ? latest.subscriber_count - thirtyDaysAgo.subscriber_count
      : null;

    // Sparkline: oldest -> newest (reverse chronological -> chronological)
    const sparkline = rows
      .slice()
      .reverse()
      .map((r) => ({
        date: r.snapshot_date,
        subs: r.subscriber_count,
      }));

    return NextResponse.json({
      hasData: true,
      latest: {
        date: latest.snapshot_date,
        subscriberCount: latest.subscriber_count,
        videoCount: latest.video_count,
        viewCount: latest.view_count,
      },
      delta7,
      delta30,
      dailyAvgLast7: delta7 !== null ? delta7 / 7 : null,
      dailyAvgLast30: delta30 !== null ? delta30 / 30 : null,
      sparkline,
      snapshotsAvailable: rows.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
