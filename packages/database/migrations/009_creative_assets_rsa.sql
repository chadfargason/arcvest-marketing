-- ============================================
-- ArcVest Marketing Automation System
-- Migration 009: RSA Creative Assets Extensions
-- ============================================

-- ============================================
-- EXTEND CREATIVE_ASSETS TABLE
-- ============================================

-- Add RSA-specific columns to creative_assets
ALTER TABLE creative_assets
    ADD COLUMN IF NOT EXISTS persona_id TEXT,
    ADD COLUMN IF NOT EXISTS voice_id TEXT,
    ADD COLUMN IF NOT EXISTS variation_number INTEGER,
    ADD COLUMN IF NOT EXISTS variation_type TEXT CHECK (variation_type IN (
        'master', 'tonal', 'angle', 'cta', 'benefit', 'urgency'
    )),
    ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'single_ai' CHECK (generation_method IN (
        'single_ai', 'multi_ai_pipeline', 'variation'
    )),
    ADD COLUMN IF NOT EXISTS compliance_passed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS compliance_issues TEXT[] DEFAULT '{}';

-- ============================================
-- RSA ASSET GROUPS TABLE
-- ============================================

-- Groups master ads with their variations
CREATE TABLE IF NOT EXISTS rsa_asset_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    persona_id TEXT NOT NULL,
    voice_id TEXT NOT NULL,

    master_asset_id UUID REFERENCES creative_assets(id) ON DELETE SET NULL,

    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'approved', 'active', 'paused', 'archived'
    )),

    -- Generation metadata
    generation_config JSONB DEFAULT '{}',
    total_variations INTEGER DEFAULT 0,
    approved_variations INTEGER DEFAULT 0,

    -- Performance tracking
    best_performing_variation_id UUID REFERENCES creative_assets(id) ON DELETE SET NULL,
    aggregate_performance JSONB DEFAULT '{}',

    last_generated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by TEXT
);

-- ============================================
-- RSA HEADLINES TABLE
-- ============================================

-- Granular tracking of individual headlines
CREATE TABLE IF NOT EXISTS rsa_headlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,

    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    character_count INTEGER NOT NULL,

    -- Classification
    headline_type TEXT CHECK (headline_type IN (
        'brand', 'service', 'benefit', 'cta', 'differentiator', 'keyword', 'question'
    )),

    -- Pinning for Google Ads
    pin_position INTEGER CHECK (pin_position IN (1, 2, 3)),

    -- Performance (synced from Google Ads)
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    UNIQUE(asset_id, position)
);

-- ============================================
-- RSA DESCRIPTIONS TABLE
-- ============================================

-- Granular tracking of individual descriptions
CREATE TABLE IF NOT EXISTS rsa_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,

    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    character_count INTEGER NOT NULL,

    -- Pinning for Google Ads
    pin_position INTEGER CHECK (pin_position IN (1, 2)),

    -- Performance (synced from Google Ads)
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    UNIQUE(asset_id, position)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_creative_assets_persona ON creative_assets(persona_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_voice ON creative_assets(voice_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_parent ON creative_assets(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_compliance ON creative_assets(compliance_passed);

CREATE INDEX IF NOT EXISTS idx_rsa_asset_groups_campaign ON rsa_asset_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rsa_asset_groups_status ON rsa_asset_groups(status);
CREATE INDEX IF NOT EXISTS idx_rsa_asset_groups_persona_voice ON rsa_asset_groups(persona_id, voice_id);

CREATE INDEX IF NOT EXISTS idx_rsa_headlines_asset ON rsa_headlines(asset_id);
CREATE INDEX IF NOT EXISTS idx_rsa_headlines_type ON rsa_headlines(headline_type);

CREATE INDEX IF NOT EXISTS idx_rsa_descriptions_asset ON rsa_descriptions(asset_id);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS rsa_asset_groups_updated_at ON rsa_asset_groups;
CREATE TRIGGER rsa_asset_groups_updated_at
    BEFORE UPDATE ON rsa_asset_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
