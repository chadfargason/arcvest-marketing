-- ============================================
-- ArcVest Marketing Automation System
-- Migration 008: Content Aggregation & Publishing
-- ============================================
-- Modular system for discovering content ideas from email/RSS/web sources,
-- scoring them, generating blog posts, and publishing with human review.

-- ============================================
-- IDEA QUEUE TABLE
-- ============================================
-- Unified storage for all discovered content ideas from any source

CREATE TABLE IF NOT EXISTS idea_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Source identification
    source_id TEXT NOT NULL,              -- Unique source identifier (e.g., 'email-abnormal-returns')
    source_name TEXT NOT NULL,            -- Human-readable name (e.g., 'Abnormal Returns')
    source_type TEXT NOT NULL CHECK (source_type IN (
        'email', 'rss', 'website', 'database', 'api', 'manual'
    )),

    -- Content
    title TEXT NOT NULL,
    summary TEXT,                         -- Brief summary of the idea
    full_content TEXT,                    -- Full extracted content
    original_url TEXT,                    -- Link to original source
    content_hash TEXT NOT NULL,           -- MD5 hash for deduplication

    -- AI Scoring
    relevance_score INTEGER,              -- 0-100 score from Claude
    score_reason TEXT,                    -- Explanation of the score
    suggested_angle TEXT,                 -- Suggested blog post angle

    -- Scoring criteria breakdown (for transparency)
    score_breakdown JSONB DEFAULT '{}',   -- {relevance: 40, timeliness: 20, uniqueness: 20, potential: 20}

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Just discovered, not scored yet
        'scored',       -- AI has scored this idea
        'selected',     -- Selected for today's batch
        'processing',   -- Currently in 4-AI pipeline
        'completed',    -- Blog post generated
        'rejected',     -- Manually rejected or killed
        'archived'      -- Old/expired ideas
    )),

    -- Selection tracking
    selected_for_date DATE,               -- Date this was selected for processing
    selection_rank INTEGER,               -- Rank in that day's selection (1-8)

    -- Content calendar link
    content_calendar_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL,

    -- Metadata
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,             -- From source, not our publish
    author TEXT,                          -- Original author if known
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',          -- Flexible extra data

    -- Deduplication
    UNIQUE(content_hash)
);

-- ============================================
-- SOURCE ADAPTERS TABLE
-- ============================================
-- Configuration for all content source adapters

CREATE TABLE IF NOT EXISTS source_adapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Identity
    source_id TEXT NOT NULL UNIQUE,       -- Unique identifier (e.g., 'email-abnormal-returns')
    source_name TEXT NOT NULL,            -- Human-readable name
    source_type TEXT NOT NULL CHECK (source_type IN (
        'email', 'rss', 'website', 'database', 'api'
    )),

    -- Configuration
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 50,          -- Higher = fetch first (1-100)

    -- Source-specific config
    config JSONB DEFAULT '{}',            -- {filter: "from:...", maxItems: 20, etc.}

    -- Fetch tracking
    last_fetch_at TIMESTAMPTZ,
    last_fetch_count INTEGER DEFAULT 0,
    last_fetch_error TEXT,
    last_success_at TIMESTAMPTZ,

    -- Statistics
    total_ideas_discovered INTEGER DEFAULT 0,
    total_ideas_selected INTEGER DEFAULT 0,
    total_ideas_published INTEGER DEFAULT 0,
    avg_score DECIMAL(5,2),

    -- Health
    consecutive_failures INTEGER DEFAULT 0,
    is_healthy BOOLEAN DEFAULT true
);

-- ============================================
-- SELECTION RUNS TABLE
-- ============================================
-- History of daily selection runs

CREATE TABLE IF NOT EXISTS selection_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Run info
    run_date DATE NOT NULL UNIQUE,

    -- Counts
    ideas_discovered INTEGER DEFAULT 0,   -- Total ideas found that day
    ideas_scored INTEGER DEFAULT 0,       -- Ideas that were scored
    ideas_selected INTEGER DEFAULT 0,     -- Ideas selected for pipeline
    ideas_processed INTEGER DEFAULT 0,    -- Ideas that went through pipeline
    ideas_published INTEGER DEFAULT 0,    -- Ideas that were published

    -- Selected ideas (ordered by rank)
    selected_idea_ids UUID[] DEFAULT '{}',

    -- Summary
    summary TEXT,                         -- AI-generated summary of selection
    source_breakdown JSONB DEFAULT '{}',  -- {source_id: count, ...}
    score_stats JSONB DEFAULT '{}',       -- {min: x, max: y, avg: z}

    -- Timing
    selection_started_at TIMESTAMPTZ,
    selection_completed_at TIMESTAMPTZ,
    pipeline_started_at TIMESTAMPTZ,
    pipeline_completed_at TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'selecting', 'processing', 'completed', 'failed'
    )),
    error_message TEXT
);

-- ============================================
-- UPDATE CONTENT_CALENDAR TABLE
-- ============================================
-- Add link to idea_queue

ALTER TABLE content_calendar
    ADD COLUMN IF NOT EXISTS idea_queue_id UUID REFERENCES idea_queue(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'manual' CHECK (generation_method IN (
        'manual', 'automated', 'hybrid'
    )),
    ADD COLUMN IF NOT EXISTS pipeline_run_id UUID,
    ADD COLUMN IF NOT EXISTS pipeline_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pipeline_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS wordpress_draft_id INTEGER,
    ADD COLUMN IF NOT EXISTS wordpress_status TEXT CHECK (wordpress_status IN (
        'draft', 'pending', 'publish', 'trash'
    ));

-- ============================================
-- SEED DEFAULT SOURCE ADAPTERS
-- ============================================

INSERT INTO source_adapters (source_id, source_name, source_type, priority, config)
VALUES
    (
        'email-bloomberg',
        'Bloomberg',
        'email',
        90,
        '{"filter": "from:bloomberg.com", "maxItems": 10, "description": "Bloomberg market news and newsletters"}'
    ),
    (
        'email-abnormal-returns',
        'Abnormal Returns',
        'email',
        85,
        '{"filter": "from:abnormalreturns.com", "maxItems": 20, "description": "Daily links digest with investment insights"}'
    ),
    (
        'email-larry-swedroe',
        'Larry Swedroe',
        'email',
        80,
        '{"filter": "from:buckingham OR from:swedroe", "maxItems": 5, "description": "Evidence-based investment research"}'
    ),
    (
        'email-michael-green',
        'Michael Green',
        'email',
        75,
        '{"filter": "from:simplify.us OR from:logicafunds", "maxItems": 5, "description": "Macro market commentary"}'
    ),
    (
        'email-general',
        'General Inbox',
        'email',
        50,
        '{"filter": "newer_than:1d", "maxItems": 30, "description": "Catch-all scanner for investment-relevant emails", "excludeFilters": ["from:bloomberg.com", "from:abnormalreturns.com", "from:buckingham", "from:swedroe", "from:simplify.us", "from:logicafunds"]}'
    ),
    (
        'rss-news',
        'RSS News Feeds',
        'rss',
        70,
        '{"description": "Existing 13+ RSS news sources"}'
    )
ON CONFLICT (source_id) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    config = EXCLUDED.config,
    updated_at = NOW();

-- ============================================
-- INDEXES
-- ============================================

-- Idea queue indexes
CREATE INDEX IF NOT EXISTS idx_idea_queue_status ON idea_queue(status);
CREATE INDEX IF NOT EXISTS idx_idea_queue_source ON idea_queue(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_queue_score ON idea_queue(relevance_score DESC NULLS LAST)
    WHERE status = 'scored';
CREATE INDEX IF NOT EXISTS idx_idea_queue_selected ON idea_queue(selected_for_date, selection_rank)
    WHERE selected_for_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_idea_queue_pending ON idea_queue(created_at DESC)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_idea_queue_hash ON idea_queue(content_hash);

-- Source adapters indexes
CREATE INDEX IF NOT EXISTS idx_source_adapters_enabled ON source_adapters(enabled, priority DESC)
    WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_source_adapters_type ON source_adapters(source_type);

-- Selection runs indexes
CREATE INDEX IF NOT EXISTS idx_selection_runs_date ON selection_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_selection_runs_status ON selection_runs(status);

-- Content calendar additions
CREATE INDEX IF NOT EXISTS idx_content_calendar_idea ON content_calendar(idea_queue_id)
    WHERE idea_queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_calendar_wordpress ON content_calendar(wordpress_status)
    WHERE wordpress_status IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS idea_queue_updated_at ON idea_queue;
CREATE TRIGGER idea_queue_updated_at
    BEFORE UPDATE ON idea_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS source_adapters_updated_at ON source_adapters;
CREATE TRIGGER source_adapters_updated_at
    BEFORE UPDATE ON source_adapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get today's pending ideas count by source
CREATE OR REPLACE FUNCTION get_pending_ideas_by_source()
RETURNS TABLE (source_id TEXT, source_name TEXT, pending_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        iq.source_id,
        iq.source_name,
        COUNT(*)::BIGINT as pending_count
    FROM idea_queue iq
    WHERE iq.status = 'pending'
    AND iq.created_at >= CURRENT_DATE
    GROUP BY iq.source_id, iq.source_name
    ORDER BY pending_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get selection stats for a date
CREATE OR REPLACE FUNCTION get_selection_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'date', target_date,
        'total_ideas', COUNT(*),
        'scored_ideas', COUNT(*) FILTER (WHERE status IN ('scored', 'selected', 'processing', 'completed')),
        'selected_ideas', COUNT(*) FILTER (WHERE selected_for_date = target_date),
        'completed_ideas', COUNT(*) FILTER (WHERE status = 'completed' AND selected_for_date = target_date),
        'avg_score', ROUND(AVG(relevance_score) FILTER (WHERE relevance_score IS NOT NULL), 1),
        'top_sources', (
            SELECT jsonb_agg(jsonb_build_object('source', source_name, 'count', cnt))
            FROM (
                SELECT source_name, COUNT(*) as cnt
                FROM idea_queue
                WHERE created_at::DATE = target_date
                GROUP BY source_name
                ORDER BY cnt DESC
                LIMIT 5
            ) top
        )
    ) INTO result
    FROM idea_queue
    WHERE created_at::DATE = target_date;

    RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;
