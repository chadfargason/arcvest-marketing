-- ============================================
-- ArcVest Marketing Automation System
-- Migration 006: Additional Agent Tables
-- ============================================

-- ============================================
-- ANALYTICS REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL,  -- Full report data structure
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Delivery tracking
    sent_to TEXT[] DEFAULT '{}',
    sent_at TIMESTAMPTZ
);

-- ============================================
-- INTELLIGENCE BRIEFS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS intelligence_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    brief_type TEXT NOT NULL CHECK (brief_type IN (
        'weekly_roundup', 'competitor_alert', 'regulatory_alert', 'opportunity'
    )),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    action_items TEXT[] DEFAULT '{}',
    sources JSONB DEFAULT '[]',  -- Array of {title, url}

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ
);

-- ============================================
-- COMPETITOR UPDATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS competitor_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    competitor_name TEXT NOT NULL,
    update_type TEXT NOT NULL CHECK (update_type IN (
        'new_content', 'social_post', 'website_change', 'press_release', 'pricing_change'
    )),
    title TEXT NOT NULL,
    url TEXT,
    summary TEXT,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),

    -- Analysis
    relevance_score DECIMAL(3,2) DEFAULT 0,
    action_required BOOLEAN DEFAULT FALSE,
    notes TEXT,

    -- Status
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed'))
);

-- ============================================
-- UPDATE DAILY_METRICS TABLE
-- Add columns used by AnalyticsAgent
-- ============================================

ALTER TABLE daily_metrics
    ADD COLUMN IF NOT EXISTS new_users INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS traffic_sources JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS top_pages JSONB DEFAULT '[]';

-- ============================================
-- UPDATE NEWS_ARTICLES TABLE
-- Add columns used by ResearchAgent
-- ============================================

ALTER TABLE news_articles
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(3,2) DEFAULT 0;

-- ============================================
-- UPDATE COMPETITORS TABLE
-- Add columns used by ResearchAgent
-- ============================================

ALTER TABLE competitors
    ADD COLUMN IF NOT EXISTS competitor_type TEXT DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS monitor_blog BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS monitor_social BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
    ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- ============================================
-- KEYWORD RANKINGS SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW keyword_rankings_summary AS
SELECT
    tk.id,
    tk.keyword,
    tk.search_volume,
    tk.difficulty,
    tk.current_rank,
    tk.previous_rank,
    tk.target_url,
    tk.priority,
    tk.last_checked,
    CASE
        WHEN tk.current_rank IS NULL THEN 'not_ranking'
        WHEN tk.current_rank <= 10 THEN 'page_1'
        WHEN tk.current_rank <= 20 THEN 'page_2'
        ELSE 'page_3_plus'
    END AS position_tier,
    tk.current_rank - tk.previous_rank AS rank_change
FROM tracked_keywords tk;

-- ============================================
-- CAMPAIGN PERFORMANCE SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT
    c.id,
    c.name,
    c.type,
    c.status,
    c.budget_monthly,
    COALESCE(SUM(cm.impressions), 0) AS total_impressions,
    COALESCE(SUM(cm.clicks), 0) AS total_clicks,
    COALESCE(SUM(cm.cost), 0) AS total_cost,
    COALESCE(SUM(cm.conversions), 0) AS total_conversions,
    CASE
        WHEN SUM(cm.impressions) > 0
        THEN ROUND(SUM(cm.clicks)::DECIMAL / SUM(cm.impressions) * 100, 2)
        ELSE 0
    END AS avg_ctr,
    CASE
        WHEN SUM(cm.clicks) > 0
        THEN ROUND(SUM(cm.cost)::DECIMAL / SUM(cm.clicks), 2)
        ELSE 0
    END AS avg_cpc,
    CASE
        WHEN SUM(cm.conversions) > 0
        THEN ROUND(SUM(cm.cost)::DECIMAL / SUM(cm.conversions), 2)
        ELSE NULL
    END AS avg_cpa
FROM campaigns c
LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
    AND cm.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id, c.name, c.type, c.status, c.budget_monthly;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_period ON analytics_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_intelligence_briefs_type ON intelligence_briefs(brief_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_briefs_status ON intelligence_briefs(status);
CREATE INDEX IF NOT EXISTS idx_competitor_updates_type ON competitor_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_competitor_updates_status ON competitor_updates(status);
CREATE INDEX IF NOT EXISTS idx_competitor_updates_discovered ON competitor_updates(discovered_at DESC);
