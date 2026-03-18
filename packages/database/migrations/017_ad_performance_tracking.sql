-- Migration 017: Ad Performance Tracking
-- Adds performance metrics to RSA headlines/descriptions, creates search_terms,
-- persona_voice_performance, and weekly_reports tables for Google Ads optimization loop.

-- 1. Add performance columns to rsa_headlines
ALTER TABLE rsa_headlines
  ADD COLUMN IF NOT EXISTS performance_label TEXT CHECK (performance_label IN ('BEST', 'GOOD', 'LOW', 'UNRATED', 'LEARNING')),
  ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 2. Add performance columns to rsa_descriptions
ALTER TABLE rsa_descriptions
  ADD COLUMN IF NOT EXISTS performance_label TEXT CHECK (performance_label IN ('BEST', 'GOOD', 'LOW', 'UNRATED', 'LEARNING')),
  ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 3. Create search_terms table
CREATE TABLE IF NOT EXISTS search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  ad_group_id TEXT,
  search_term TEXT NOT NULL,
  match_type TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  added_as_keyword BOOLEAN DEFAULT FALSE,
  added_as_negative BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, ad_group_id, search_term)
);

-- 4. Create persona_voice_performance table
CREATE TABLE IF NOT EXISTS persona_voice_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  avg_cpc NUMERIC DEFAULT 0,
  top_headlines JSONB DEFAULT '[]',
  top_search_terms JSONB DEFAULT '[]',
  UNIQUE(persona_id, voice_id, week_start)
);

-- 5. Create weekly_reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- 6. Update experiments status constraint to add 'graduated'
ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE experiments ADD CONSTRAINT experiments_status_check
  CHECK (status IN ('draft', 'generating', 'ready', 'live', 'optimizing', 'completed', 'paused', 'graduated'));

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_search_terms_campaign ON search_terms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_search_terms_term ON search_terms(search_term);
CREATE INDEX IF NOT EXISTS idx_search_terms_last_seen ON search_terms(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_persona_voice_perf_week ON persona_voice_performance(week_start);
CREATE INDEX IF NOT EXISTS idx_persona_voice_perf_combo ON persona_voice_performance(persona_id, voice_id);
CREATE INDEX IF NOT EXISTS idx_rsa_headlines_perf ON rsa_headlines(performance_label);
CREATE INDEX IF NOT EXISTS idx_rsa_descriptions_perf ON rsa_descriptions(performance_label);
