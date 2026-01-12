-- ============================================
-- ArcVest Marketing Automation System
-- Migration 004: Content, SEO, and Research Tables
-- ============================================

-- ============================================
-- CONTENT CALENDAR TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS content_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Scheduling
    scheduled_date DATE,
    status TEXT DEFAULT 'idea' CHECK (status IN (
        'idea', 'assigned', 'outline', 'draft', 'review',
        'approved', 'scheduled', 'published', 'archived'
    )),

    -- Content
    content_type TEXT NOT NULL CHECK (content_type IN (
        'blog_post', 'linkedin_post', 'linkedin_article',
        'twitter_thread', 'newsletter', 'whitepaper', 'video_script'
    )),
    title TEXT,
    topic TEXT,
    keywords TEXT[] DEFAULT '{}',
    outline TEXT,
    draft TEXT,
    final_content TEXT,

    -- SEO
    meta_description TEXT,
    target_keyword TEXT,

    -- Source/Derivation
    source_content_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL,
    content_brief_id UUID,  -- Reference to content_opportunities

    -- Publishing
    published_url TEXT,
    published_at TIMESTAMPTZ,
    wordpress_post_id INTEGER,

    -- Performance
    views INTEGER DEFAULT 0,
    engagements INTEGER DEFAULT 0,
    leads_attributed INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- CONTENT TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    template TEXT NOT NULL,  -- Template with placeholders
    instructions TEXT,
    examples JSONB DEFAULT '[]'
);

-- ============================================
-- CREATIVE ASSETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS creative_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'ad_copy', 'display_spec', 'video_script', 'landing_page'
    )),
    name TEXT NOT NULL,
    content JSONB NOT NULL,  -- Structure varies by type

    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    parent_asset_id UUID REFERENCES creative_assets(id) ON DELETE SET NULL,

    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'approved', 'active', 'paused', 'retired'
    )),

    -- Performance
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- SEO TRACKED KEYWORDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tracked_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    keyword TEXT NOT NULL UNIQUE,
    search_volume INTEGER,
    difficulty INTEGER,
    current_rank INTEGER,
    previous_rank INTEGER,
    url_ranking TEXT,
    target_url TEXT,
    priority TEXT DEFAULT 'secondary' CHECK (priority IN ('primary', 'secondary', 'monitor')),
    last_checked TIMESTAMPTZ
);

-- ============================================
-- KEYWORD HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rank INTEGER,
    url TEXT,

    UNIQUE(keyword_id, date)
);

-- ============================================
-- CONTENT OPPORTUNITIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS content_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    keyword TEXT NOT NULL,
    search_volume INTEGER,
    difficulty INTEGER,
    current_gap TEXT CHECK (current_gap IN ('not_ranking', 'page_2', 'needs_improvement')),
    recommended_action TEXT,
    content_brief JSONB,  -- Full content brief structure
    status TEXT DEFAULT 'identified' CHECK (status IN (
        'identified', 'planned', 'in_progress', 'published'
    )),
    assigned_content_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL
);

-- ============================================
-- COMPETITORS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    domain TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('direct', 'indirect', 'content')),
    notes TEXT,
    last_scanned TIMESTAMPTZ
);

-- ============================================
-- COMPETITOR CONTENT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS competitor_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,

    url TEXT NOT NULL,
    title TEXT,
    type TEXT CHECK (type IN ('blog', 'page', 'whitepaper', 'video', 'other')),
    published_date DATE,
    discovered_date TIMESTAMPTZ DEFAULT NOW(),
    summary TEXT,
    topics TEXT[] DEFAULT '{}',
    relevance_score INTEGER DEFAULT 0,
    notes TEXT,

    UNIQUE(competitor_id, url)
);

-- ============================================
-- NEWS ARTICLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    source TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    published_date TIMESTAMPTZ,
    discovered_date TIMESTAMPTZ DEFAULT NOW(),
    category TEXT CHECK (category IN ('industry', 'regulatory', 'market', 'competitor')),
    summary TEXT,
    relevance_score INTEGER DEFAULT 0,
    action_needed BOOLEAN DEFAULT FALSE,
    action_type TEXT CHECK (action_type IN ('content_opportunity', 'client_communication', 'compliance_review')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed'))
);

-- ============================================
-- RESEARCH BRIEFS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS research_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    type TEXT NOT NULL CHECK (type IN ('competitor_update', 'industry_roundup', 'regulatory_alert')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    sent_to TEXT[] DEFAULT '{}',
    sent_at TIMESTAMPTZ
);

-- ============================================
-- DAILY METRICS TABLE (Analytics rollup)
-- ============================================

CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,

    -- Traffic
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    pageviews INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,4),
    avg_session_duration INTEGER,

    -- By source
    traffic_by_source JSONB DEFAULT '{}',

    -- Conversions
    form_submissions INTEGER DEFAULT 0,
    whitepaper_downloads INTEGER DEFAULT 0,
    consultation_requests INTEGER DEFAULT 0,

    -- Ads
    ad_impressions INTEGER DEFAULT 0,
    ad_clicks INTEGER DEFAULT 0,
    ad_cost DECIMAL(10,2) DEFAULT 0,

    -- CRM
    new_leads INTEGER DEFAULT 0,
    consultations_scheduled INTEGER DEFAULT 0,
    consultations_completed INTEGER DEFAULT 0,
    new_clients INTEGER DEFAULT 0,

    -- Calculated
    cost_per_lead DECIMAL(10,2),
    lead_to_consultation_rate DECIMAL(5,4),
    consultation_to_client_rate DECIMAL(5,4)
);

-- ============================================
-- INDEXES
-- ============================================

-- Content calendar indexes
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled ON content_calendar(scheduled_date)
    WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_calendar_type ON content_calendar(content_type);

-- Creative assets indexes
CREATE INDEX IF NOT EXISTS idx_creative_assets_type ON creative_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_creative_assets_status ON creative_assets(status);
CREATE INDEX IF NOT EXISTS idx_creative_assets_campaign ON creative_assets(campaign_id);

-- SEO indexes
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_priority ON tracked_keywords(priority);
CREATE INDEX IF NOT EXISTS idx_keyword_history_keyword ON keyword_history(keyword_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_status ON content_opportunities(status);

-- Research indexes
CREATE INDEX IF NOT EXISTS idx_competitor_content_competitor ON competitor_content(competitor_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_status ON news_articles(status);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);

-- Daily metrics indexes
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS content_calendar_updated_at ON content_calendar;
CREATE TRIGGER content_calendar_updated_at
    BEFORE UPDATE ON content_calendar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS content_templates_updated_at ON content_templates;
CREATE TRIGGER content_templates_updated_at
    BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS creative_assets_updated_at ON creative_assets;
CREATE TRIGGER creative_assets_updated_at
    BEFORE UPDATE ON creative_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
