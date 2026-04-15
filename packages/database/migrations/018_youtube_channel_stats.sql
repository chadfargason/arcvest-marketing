-- Migration 018: YouTube Channel Stats
-- Daily snapshot of @ArcVest channel public statistics for subscriber-growth tracking.
-- Populated by /api/cron/youtube-stats at 06:00 CT.

CREATE TABLE IF NOT EXISTS youtube_channel_stats (
  snapshot_date DATE PRIMARY KEY,
  subscriber_count INTEGER NOT NULL,
  video_count INTEGER,
  view_count BIGINT,
  source TEXT NOT NULL DEFAULT 'scrape' CHECK (source IN ('api', 'scrape')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_channel_stats_date
  ON youtube_channel_stats (snapshot_date DESC);

COMMENT ON TABLE youtube_channel_stats IS
  'Daily snapshot of public YouTube channel stats for @ArcVest (subscriber-growth tracking). One row per day.';
