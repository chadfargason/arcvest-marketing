-- ============================================
-- ArcVest Marketing Automation System
-- Migration 002: Campaigns and Email Sequences
-- ============================================

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'google_search', 'google_display', 'google_youtube',
        'linkedin', 'email', 'content', 'other'
    )),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),

    -- Budget
    budget_monthly DECIMAL(10,2),

    -- Dates
    start_date DATE,
    end_date DATE,

    -- Targeting
    target_audience TEXT,

    -- External IDs
    google_ads_campaign_id TEXT,

    -- Notes
    notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- CAMPAIGN METRICS TABLE (Daily Rollup)
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Performance
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_value DECIMAL(10,2) DEFAULT 0,

    -- Calculated (can also be computed on read)
    ctr DECIMAL(8,6),  -- click-through rate
    cpc DECIMAL(10,2), -- cost per click
    cpa DECIMAL(10,2), -- cost per acquisition
    roas DECIMAL(10,4), -- return on ad spend

    -- Unique constraint
    UNIQUE(campaign_id, date)
);

-- ============================================
-- EMAIL SEQUENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL,
    description TEXT,

    -- Trigger
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'form_submission', 'manual', 'tag_added', 'status_change', 'lead_score_threshold'
    )),
    trigger_config JSONB DEFAULT '{}',  -- e.g., { "tag": "interested-in-retirement" }

    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- EMAIL SEQUENCE STEPS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

    step_order INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0,  -- Days after previous step (or enrollment for step 1)

    -- Content
    subject TEXT NOT NULL,
    body TEXT NOT NULL,  -- Supports merge fields like {{first_name}}

    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),

    -- Unique constraint
    UNIQUE(sequence_id, step_order)
);

-- ============================================
-- SEQUENCE ENROLLMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,

    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    current_step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unsubscribed', 'paused')),

    next_email_at TIMESTAMPTZ,
    last_email_sent_at TIMESTAMPTZ,

    -- Unique active enrollment per contact per sequence
    UNIQUE(contact_id, sequence_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_google_ads_id ON campaigns(google_ads_campaign_id);

-- Campaign metrics indexes
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date ON campaign_metrics(campaign_id, date DESC);

-- Email sequences indexes
CREATE INDEX IF NOT EXISTS idx_email_sequences_status ON email_sequences(status);
CREATE INDEX IF NOT EXISTS idx_email_sequences_trigger ON email_sequences(trigger_type);

-- Sequence enrollments indexes
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_email ON sequence_enrollments(next_email_at)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_contact ON sequence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS email_sequences_updated_at ON email_sequences;
CREATE TRIGGER email_sequences_updated_at
    BEFORE UPDATE ON email_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
