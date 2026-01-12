-- ============================================
-- ArcVest Marketing Automation System
-- Migration 001: Core Tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REFERENCE TABLES
-- ============================================

-- Lead Sources
CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('paid', 'organic', 'referral', 'direct')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sources
INSERT INTO lead_sources (name, category) VALUES
    ('google_ads_search', 'paid'),
    ('google_ads_display', 'paid'),
    ('google_ads_youtube', 'paid'),
    ('linkedin_ads', 'paid'),
    ('organic_search', 'organic'),
    ('organic_social', 'organic'),
    ('referral_client', 'referral'),
    ('referral_professional', 'referral'),
    ('referral_other', 'referral'),
    ('direct', 'direct'),
    ('unknown', 'direct')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- CONTACTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,

    -- Identity
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,

    -- Source & Attribution
    source TEXT REFERENCES lead_sources(name),
    source_detail TEXT,  -- Campaign name, keyword, referrer name

    -- Status & Pipeline
    status TEXT DEFAULT 'new_lead' CHECK (status IN (
        'new_lead', 'contacted', 'consultation_scheduled',
        'consultation_completed', 'proposal_sent', 'client', 'closed_lost'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Scoring & Qualification
    lead_score INTEGER DEFAULT 0,
    estimated_assets TEXT CHECK (estimated_assets IN ('under_500k', '500k_to_2m', 'over_2m')),

    -- Location
    city TEXT,
    state TEXT,

    -- Assignment
    assigned_to TEXT CHECK (assigned_to IN ('chad', 'erik')),

    -- Notes & Tags
    notes TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Integration Links
    gmail_thread_ids TEXT[] DEFAULT '{}',
    anonymous_id TEXT,  -- Links to pre-identification website sessions

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- INTERACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Type & Channel
    type TEXT NOT NULL CHECK (type IN (
        'email_inbound', 'email_outbound', 'call_inbound', 'call_outbound',
        'meeting', 'form_submission', 'website_visit', 'ad_click',
        'email_opened', 'email_clicked', 'whitepaper_download', 'note'
    )),
    channel TEXT,  -- gmail, phone, zoom, website, google_ads

    -- Content
    subject TEXT,
    summary TEXT,

    -- Integration Links
    gmail_message_id TEXT,
    gmail_thread_id TEXT,

    -- Metrics
    duration_minutes INTEGER,

    -- Outcome
    outcome TEXT CHECK (outcome IN ('positive', 'neutral', 'negative', 'no_response')),

    -- Flexible metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Link to contact (optional)
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Assignment
    assigned_to TEXT NOT NULL CHECK (assigned_to IN ('chad', 'erik')),

    -- Content
    title TEXT NOT NULL,
    description TEXT,

    -- Scheduling
    due_date TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,

    -- Priority
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

    -- Origin
    created_by TEXT,  -- 'system', 'chad', 'erik', or agent name

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Who
    actor TEXT NOT NULL,  -- 'chad', 'erik', 'system', or agent name

    -- What
    action TEXT NOT NULL,  -- 'created', 'updated', 'deleted', 'status_changed', etc.

    -- On what
    entity_type TEXT NOT NULL,  -- 'contact', 'campaign', 'task', etc.
    entity_id UUID,

    -- Details
    details JSONB DEFAULT '{}'  -- Before/after values, context
);

-- ============================================
-- SYSTEM STATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize system state
INSERT INTO system_state (key, value) VALUES
    ('assignment_last_assigned', '"erik"'),
    ('gmail_last_sync', 'null'),
    ('google_ads_last_sync', 'null'),
    ('analytics_last_sync', 'null')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- WEBSITE SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS website_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Identity (anonymous until form submission)
    anonymous_id TEXT NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Attribution
    landing_page TEXT,
    source TEXT,      -- utm_source
    medium TEXT,      -- utm_medium
    campaign TEXT,    -- utm_campaign
    keyword TEXT,     -- utm_term (for paid search)

    -- Engagement
    pages_viewed INTEGER DEFAULT 1,
    duration_seconds INTEGER,

    -- Conversion
    converted BOOLEAN DEFAULT FALSE,
    conversion_type TEXT,  -- contact_form, lead_magnet, consultation_request

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- INDEXES
-- ============================================

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_anonymous_id ON contacts(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NULL;

-- Interactions indexes
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- Website sessions indexes
CREATE INDEX IF NOT EXISTS idx_website_sessions_anonymous_id ON website_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_website_sessions_contact_id ON website_sessions(contact_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update status_changed_at when status changes
CREATE OR REPLACE FUNCTION update_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_changed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS contacts_status_changed ON contacts;
CREATE TRIGGER contacts_status_changed
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_status_changed_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
