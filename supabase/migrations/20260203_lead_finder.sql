-- ============================================
-- ArcVest Marketing Automation System
-- Migration 013: Lead Finder Tables
-- ============================================

-- ============================================
-- LEAD FINDER CONFIG TABLE
-- Stores rotation settings and search configuration
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO lead_finder_config (key, value) VALUES
    ('geo_list', '[
        {"name": "Houston", "aliases": ["Houston", "The Woodlands", "Katy", "Sugar Land", "Pearland"]},
        {"name": "Dallas", "aliases": ["Dallas", "Plano", "Frisco", "Irving", "Richardson"]},
        {"name": "Austin", "aliases": ["Austin", "Round Rock", "Cedar Park", "Georgetown"]},
        {"name": "San Antonio", "aliases": ["San Antonio", "New Braunfels", "Boerne"]},
        {"name": "Fort Worth", "aliases": ["Fort Worth", "Arlington", "Southlake", "Grapevine"]}
    ]'::jsonb),
    ('trigger_list', '["career_move", "funding_mna", "expansion"]'::jsonb),
    ('industry_list', '["energy", "healthcare", "professional_services", "tech", "real_estate", "finance"]'::jsonb),
    ('email_tones', '["congratulatory", "value_first", "peer_credibility", "direct_curious"]'::jsonb),
    ('daily_lead_target', '20'::jsonb),
    ('candidate_target', '60'::jsonb),
    ('recency_days', '7'::jsonb),
    ('lead_cooldown_days', '90'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================
-- LEAD FINDER RUNS TABLE
-- Tracks each daily run with rotation parameters
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date DATE NOT NULL,
    geo_name TEXT NOT NULL,
    geo_aliases TEXT[] NOT NULL,
    trigger_focus TEXT NOT NULL,
    industry_focus TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
    stats JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(run_date)
);

-- ============================================
-- LEAD FINDER SEARCH RESULTS TABLE
-- Raw search results from Google Custom Search
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_search_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES lead_finder_runs(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    provider TEXT DEFAULT 'google_custom_search',
    url TEXT NOT NULL,
    title TEXT,
    snippet TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(run_id, url)
);

-- ============================================
-- LEAD FINDER PAGES TABLE
-- Fetched and processed page content
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES lead_finder_runs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    final_url TEXT,
    domain TEXT,
    http_status INTEGER,
    page_title TEXT,
    published_at_guess TIMESTAMPTZ,
    extracted_text TEXT,
    content_hash TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(run_id, url)
);

-- ============================================
-- LEAD FINDER LEADS TABLE
-- Core leads table with scoring and status
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES lead_finder_runs(id) ON DELETE SET NULL,
    page_id UUID REFERENCES lead_finder_pages(id) ON DELETE SET NULL,
    
    -- Identity & Deduplication
    person_key TEXT NOT NULL,  -- normalized(name + company + geo) for dedup
    full_name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    geo_signal TEXT,
    
    -- Classification
    trigger_type TEXT CHECK (trigger_type IN ('career_move', 'funding_mna', 'expansion', 'recognition', 'other')),
    category TEXT CHECK (category IN ('exec', 'owner', 'professional', 'real_estate', 'other')),
    
    -- Scoring
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
    
    -- Rationale & Evidence
    rationale_short TEXT,  -- 1 sentence
    rationale_detail TEXT,  -- 2-3 sentences
    evidence_snippets JSONB DEFAULT '[]',
    
    -- Contact Information
    contact_paths JSONB DEFAULT '[]',  -- Array of {type, value, found_on_page}
    
    -- Source Tracking
    source_url TEXT,
    source_title TEXT,
    
    -- Outreach Status
    outreach_status TEXT DEFAULT 'pending' CHECK (outreach_status IN (
        'pending', 'email_ready', 'sent', 'skipped', 'responded', 'converted', 'bounced'
    )),
    sent_at TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique leads per run
    UNIQUE(run_id, person_key)
);

-- ============================================
-- LEAD FINDER EMAILS TABLE
-- AI-generated email drafts
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES lead_finder_leads(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    
    -- Email Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT NOT NULL,
    
    -- Generation Metadata
    tone TEXT CHECK (tone IN ('congratulatory', 'value_first', 'peer_credibility', 'direct_curious')),
    model_used TEXT DEFAULT 'claude-3-5-sonnet',
    
    -- User Modifications
    edited_by_user BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Latest version per lead
    UNIQUE(lead_id, version)
);

-- ============================================
-- LEAD FINDER SUPPRESSION TABLE
-- Track people we shouldn't contact again
-- ============================================

CREATE TABLE IF NOT EXISTS lead_finder_suppression (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('person_key', 'email', 'domain', 'company')),
    value TEXT NOT NULL,
    reason TEXT CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual', 'converted', 'existing_client')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(type, value)
);

-- ============================================
-- INDEXES
-- ============================================

-- Runs indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_runs_date ON lead_finder_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_finder_runs_status ON lead_finder_runs(status);

-- Search results indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_search_results_run ON lead_finder_search_results(run_id);
CREATE INDEX IF NOT EXISTS idx_lead_finder_search_results_url ON lead_finder_search_results(url);

-- Pages indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_pages_run ON lead_finder_pages(run_id);
CREATE INDEX IF NOT EXISTS idx_lead_finder_pages_domain ON lead_finder_pages(domain);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_run ON lead_finder_leads(run_id);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_person_key ON lead_finder_leads(person_key);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_score ON lead_finder_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_tier ON lead_finder_leads(tier);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_status ON lead_finder_leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_created ON lead_finder_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_category ON lead_finder_leads(category);
CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_trigger ON lead_finder_leads(trigger_type);

-- Emails indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_emails_lead ON lead_finder_emails(lead_id);

-- Suppression indexes
CREATE INDEX IF NOT EXISTS idx_lead_finder_suppression_type_value ON lead_finder_suppression(type, value);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for leads
DROP TRIGGER IF EXISTS lead_finder_leads_updated_at ON lead_finder_leads;
CREATE TRIGGER lead_finder_leads_updated_at
    BEFORE UPDATE ON lead_finder_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS
-- ============================================

-- Today's leads view for quick dashboard access
CREATE OR REPLACE VIEW lead_finder_today AS
SELECT 
    l.*,
    e.subject as email_subject,
    e.body_plain as email_body,
    e.tone as email_tone,
    r.geo_name,
    r.trigger_focus
FROM lead_finder_leads l
LEFT JOIN lead_finder_emails e ON e.lead_id = l.id AND e.version = (
    SELECT MAX(version) FROM lead_finder_emails WHERE lead_id = l.id
)
LEFT JOIN lead_finder_runs r ON r.id = l.run_id
WHERE l.created_at >= CURRENT_DATE
ORDER BY l.score DESC;

-- Lead finder stats view
CREATE OR REPLACE VIEW lead_finder_stats AS
SELECT 
    r.run_date,
    r.geo_name,
    r.trigger_focus,
    r.status,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT l.id) FILTER (WHERE l.tier = 'A') as tier_a_leads,
    COUNT(DISTINCT l.id) FILTER (WHERE l.tier = 'B') as tier_b_leads,
    COUNT(DISTINCT l.id) FILTER (WHERE l.outreach_status = 'sent') as sent_count,
    COUNT(DISTINCT l.id) FILTER (WHERE l.outreach_status = 'responded') as responded_count,
    AVG(l.score) as avg_score
FROM lead_finder_runs r
LEFT JOIN lead_finder_leads l ON l.run_id = r.id
GROUP BY r.id, r.run_date, r.geo_name, r.trigger_focus, r.status
ORDER BY r.run_date DESC;
