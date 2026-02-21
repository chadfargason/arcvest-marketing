-- ============================================
-- ArcVest Marketing Automation System
-- Migration 014: Meta Ads Tables
-- ============================================

-- ============================================
-- EXTEND CAMPAIGNS TABLE
-- Add platform support and Meta-specific fields
-- ============================================

-- Add platform column
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'google';

-- Add platform CHECK constraint
ALTER TABLE campaigns
    DROP CONSTRAINT IF EXISTS campaigns_platform_check;
ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_platform_check CHECK (platform IN ('google', 'meta', 'other'));

-- Add Meta-specific columns
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(10,2);
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS lifetime_budget DECIMAL(10,2);
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS objective TEXT;

-- Drop and recreate type CHECK to include Meta campaign types
ALTER TABLE campaigns
    DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_type_check CHECK (type IN (
        'google_search', 'google_display', 'google_youtube',
        'linkedin', 'email', 'content', 'other',
        'meta_traffic', 'meta_leads', 'meta_awareness',
        'meta_conversions', 'meta_engagement'
    ));

-- Indexes for new campaign columns
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_meta_campaign_id ON campaigns(meta_campaign_id);

-- ============================================
-- META AD SETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS meta_ad_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Campaign link
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Meta identifiers
    meta_ad_set_id TEXT NOT NULL UNIQUE,

    -- Core fields
    name TEXT NOT NULL,
    status TEXT DEFAULT 'PAUSED',

    -- Budget & Bidding
    daily_budget DECIMAL(10,2),
    lifetime_budget DECIMAL(10,2),
    bid_amount DECIMAL(10,2),
    bid_strategy TEXT,

    -- Optimization
    optimization_goal TEXT,

    -- Targeting & Placements
    targeting JSONB DEFAULT '{}',
    placements JSONB DEFAULT '{}',

    -- Scheduling
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
);

-- ============================================
-- META ADS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS meta_ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ad set link
    ad_set_id UUID NOT NULL REFERENCES meta_ad_sets(id) ON DELETE CASCADE,

    -- Meta identifiers
    meta_ad_id TEXT NOT NULL UNIQUE,

    -- Core fields
    name TEXT NOT NULL,
    status TEXT DEFAULT 'PAUSED',

    -- Creative
    creative JSONB DEFAULT '{}',

    -- Content link
    source_content_id UUID REFERENCES content_calendar(id)
);

-- ============================================
-- META INSIGHTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS meta_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Object reference
    meta_object_id TEXT NOT NULL,
    object_type TEXT NOT NULL CHECK (object_type IN ('account', 'campaign', 'adset', 'ad')),
    date DATE NOT NULL,

    -- Core metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,

    -- Reach & Frequency
    reach INTEGER DEFAULT 0,
    frequency DECIMAL(8,4) DEFAULT 0,

    -- Calculated metrics
    cpc DECIMAL(10,2),
    cpm DECIMAL(10,2),
    ctr DECIMAL(8,6),

    -- Detailed breakdowns
    actions JSONB DEFAULT '[]',
    cost_per_action JSONB DEFAULT '[]',
    breakdowns JSONB DEFAULT '{}',

    -- Unique constraint per object per day
    UNIQUE(meta_object_id, object_type, date)
);

-- ============================================
-- INDEXES
-- ============================================

-- Meta ad sets indexes
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_campaign_id ON meta_ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_status ON meta_ad_sets(status);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_meta_ad_set_id ON meta_ad_sets(meta_ad_set_id);

-- Meta ads indexes
CREATE INDEX IF NOT EXISTS idx_meta_ads_ad_set_id ON meta_ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_status ON meta_ads(status);
CREATE INDEX IF NOT EXISTS idx_meta_ads_meta_ad_id ON meta_ads(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_source_content_id ON meta_ads(source_content_id);

-- Meta insights indexes
CREATE INDEX IF NOT EXISTS idx_meta_insights_object ON meta_insights(meta_object_id, object_type);
CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_insights(date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_object_date ON meta_insights(meta_object_id, date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for meta_ad_sets
DROP TRIGGER IF EXISTS meta_ad_sets_updated_at ON meta_ad_sets;
CREATE TRIGGER meta_ad_sets_updated_at
    BEFORE UPDATE ON meta_ad_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for meta_ads
DROP TRIGGER IF EXISTS meta_ads_updated_at ON meta_ads;
CREATE TRIGGER meta_ads_updated_at
    BEFORE UPDATE ON meta_ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
