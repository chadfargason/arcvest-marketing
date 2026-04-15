/**
 * YouTube Channel Stats Cron
 *
 * Runs daily at 06:00 CT. Snapshots public stats for @ArcVest
 * (subscribers, videos, views) into youtube_channel_stats.
 *
 * Uses YouTube Data API v3 when YOUTUBE_API_KEY is set.
 * Falls back to HTML scraping if no key available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CHANNEL_HANDLE = '@ArcVest';

interface ChannelStats {
  subscriberCount: number;
  videoCount: number | null;
  viewCount: number | null;
  source: 'api' | 'scrape';
}

async function fetchViaApi(apiKey: string): Promise<ChannelStats> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(CHANNEL_HANDLE)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const stats = json?.items?.[0]?.statistics;
  if (!stats) throw new Error('YouTube API returned no channel data');
  return {
    subscriberCount: parseInt(stats.subscriberCount, 10),
    videoCount: stats.videoCount ? parseInt(stats.videoCount, 10) : null,
    viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : null,
    source: 'api',
  };
}

async function fetchViaScrape(): Promise<ChannelStats> {
  const res = await fetch(`https://www.youtube.com/${CHANNEL_HANDLE}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`YouTube scrape ${res.status}`);
  const html = await res.text();

  const subMatch = html.match(/([\d.]+[KM]?)\s+subscriber/);
  if (!subMatch) throw new Error('Could not find subscriber count in HTML');

  const raw = subMatch[1];
  let subscriberCount: number;
  if (raw.endsWith('K')) subscriberCount = Math.round(parseFloat(raw) * 1000);
  else if (raw.endsWith('M')) subscriberCount = Math.round(parseFloat(raw) * 1_000_000);
  else subscriberCount = parseInt(raw, 10);

  return {
    subscriberCount,
    videoCount: null,
    viewCount: null,
    source: 'scrape',
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const stats = apiKey ? await fetchViaApi(apiKey) : await fetchViaScrape();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('youtube_channel_stats').upsert(
      {
        snapshot_date: today,
        subscriber_count: stats.subscriberCount,
        video_count: stats.videoCount,
        view_count: stats.viewCount,
        source: stats.source,
      },
      { onConflict: 'snapshot_date' },
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      date: today,
      ...stats,
    });
  } catch (err) {
    console.error('[YouTube Stats Cron] Failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
