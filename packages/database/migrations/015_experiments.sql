-- ============================================
-- Experiment Runner Tables
-- ============================================

-- Experiments: one row per A/B test experiment
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'live', 'optimizing', 'completed', 'paused')),
  platform TEXT NOT NULL DEFAULT 'google'
    CHECK (platform IN ('google')),
  optimization_metric TEXT NOT NULL DEFAULT 'ctr'
    CHECK (optimization_metric IN ('ctr', 'conversions', 'cpc', 'impressions')),

  -- Budget & bidding
  daily_budget NUMERIC NOT NULL DEFAULT 10,
  bid_strategy TEXT NOT NULL DEFAULT 'maximize_clicks'
    CHECK (bid_strategy IN ('maximize_clicks', 'maximize_conversions', 'target_cpa')),
  target_cpa NUMERIC,

  -- Targeting
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_type TEXT NOT NULL DEFAULT 'broad'
    CHECK (match_type IN ('broad', 'phrase', 'exact')),
  landing_page_url TEXT,
  target_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_targeting JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Google Ads resource IDs (set after deployment)
  google_campaign_id TEXT,
  google_budget_id TEXT,

  -- Copy generation config
  persona_id TEXT,
  voice_id TEXT,
  num_variations INTEGER NOT NULL DEFAULT 5,

  -- Optimization
  auto_optimize BOOLEAN NOT NULL DEFAULT true,
  winner_variation_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Experiment variations: one row per ad variation
CREATE TABLE IF NOT EXISTS experiment_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variation_number INTEGER NOT NULL,
  headlines JSONB NOT NULL DEFAULT '[]'::jsonb,
  descriptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'winner', 'loser')),

  -- Google Ads resource IDs (set after deployment)
  google_ad_group_id TEXT,
  google_ad_id TEXT,

  -- Performance metrics (synced from Google Ads)
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Experiment logs: audit trail for optimizer decisions and actions
CREATE TABLE IF NOT EXISTS experiment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_variations_experiment_id ON experiment_variations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_experiment_id ON experiment_logs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_created_at ON experiment_logs(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_experiments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_experiments_updated_at();

CREATE TRIGGER experiment_variations_updated_at
  BEFORE UPDATE ON experiment_variations
  FOR EACH ROW
  EXECUTE FUNCTION update_experiments_updated_at();
