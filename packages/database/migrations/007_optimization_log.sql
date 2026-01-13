-- ============================================
-- OPTIMIZATION LOG TABLE
-- ============================================
-- Tracks all automated optimizations made by the Paid Media Agent

CREATE TABLE IF NOT EXISTS optimization_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Campaign reference
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    google_ads_campaign_id TEXT,

    -- Entity being optimized
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'campaign', 'ad_group', 'keyword', 'ad', 'bid_modifier'
    )),
    entity_id TEXT NOT NULL,           -- Google Ads resource name or ID
    entity_name TEXT,                  -- Human-readable name

    -- Action taken
    action TEXT NOT NULL CHECK (action IN (
        'bid_increase', 'bid_decrease', 'pause', 'enable',
        'add_negative_keyword', 'remove', 'budget_adjustment'
    )),
    old_value TEXT,                    -- Previous value (e.g., "$2.50")
    new_value TEXT,                    -- New value (e.g., "$2.75")
    change_percentage DECIMAL(5,2),    -- Percentage change if applicable

    -- Reasoning
    rule_name TEXT NOT NULL,           -- Which optimization rule triggered this
    reason TEXT NOT NULL,              -- Human-readable explanation
    metrics_snapshot JSONB,            -- Metrics at time of decision

    -- Thresholds used
    threshold_config JSONB,            -- The rule thresholds applied

    -- Execution status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'applied', 'failed', 'reverted', 'skipped'
    )),
    error_message TEXT,                -- Error if failed
    applied_at TIMESTAMPTZ,            -- When actually applied
    reverted_at TIMESTAMPTZ,           -- If change was reverted

    -- Review tracking
    reviewed_by TEXT,                  -- 'chad', 'erik', or null (auto-approved)
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT
);

-- ============================================
-- OPTIMIZATION RULES TABLE
-- ============================================
-- Configurable optimization rules

CREATE TABLE IF NOT EXISTS optimization_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT true,

    -- Targeting
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'campaign', 'ad_group', 'keyword'
    )),

    -- Condition
    metric TEXT NOT NULL,              -- 'ctr', 'cpa', 'conversions', 'impressions', etc.
    operator TEXT NOT NULL CHECK (operator IN (
        'less_than', 'greater_than', 'equals', 'between'
    )),
    threshold_value DECIMAL(10,4),
    threshold_min DECIMAL(10,4),       -- For 'between' operator
    threshold_max DECIMAL(10,4),       -- For 'between' operator
    minimum_data JSONB DEFAULT '{"impressions": 1000}', -- Min data before rule applies

    -- Action
    action TEXT NOT NULL CHECK (action IN (
        'bid_increase', 'bid_decrease', 'pause', 'enable',
        'add_negative_keyword', 'alert_only'
    )),
    action_value DECIMAL(5,2),         -- Percentage or absolute value

    -- Limits
    max_change_per_day DECIMAL(5,2),   -- Max percentage change per day
    cooldown_hours INTEGER DEFAULT 24, -- Hours before rule can fire again on same entity

    -- Metadata
    priority INTEGER DEFAULT 50,       -- Higher = runs first
    last_executed_at TIMESTAMPTZ
);

-- ============================================
-- BUDGET ALERTS TABLE
-- ============================================
-- Track budget pacing and alerts

CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    google_ads_campaign_id TEXT,

    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'overspend', 'underspend', 'pacing_ahead', 'pacing_behind', 'budget_exhausted'
    )),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    daily_budget DECIMAL(10,2),
    current_spend DECIMAL(10,2),
    expected_spend DECIMAL(10,2),      -- What spend should be at this time of day
    pacing_percentage DECIMAL(5,2),    -- Current/Expected * 100

    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_optimization_log_campaign ON optimization_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_optimization_log_created ON optimization_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_log_status ON optimization_log(status);
CREATE INDEX IF NOT EXISTS idx_optimization_log_entity ON optimization_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_optimization_log_rule ON optimization_log(rule_name);

CREATE INDEX IF NOT EXISTS idx_optimization_rules_enabled ON optimization_rules(enabled, entity_type)
    WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_optimization_rules_priority ON optimization_rules(priority DESC);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_campaign ON budget_alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_unresolved ON budget_alerts(resolved, created_at DESC)
    WHERE resolved = false;

-- ============================================
-- SEED DEFAULT OPTIMIZATION RULES
-- ============================================

INSERT INTO optimization_rules (name, description, entity_type, metric, operator, threshold_value, minimum_data, action, action_value, max_change_per_day, priority)
VALUES
    (
        'low_ctr_keyword',
        'Decrease bid for keywords with CTR < 1% after sufficient impressions',
        'keyword',
        'ctr',
        'less_than',
        1.0,
        '{"impressions": 1000}',
        'bid_decrease',
        10.0,
        20.0,
        60
    ),
    (
        'high_cpa_keyword',
        'Pause keywords with CPA > $100 and less than 2 conversions',
        'keyword',
        'cpa',
        'greater_than',
        100.0,
        '{"impressions": 2000, "conversions_max": 2}',
        'pause',
        NULL,
        NULL,
        80
    ),
    (
        'high_performer_keyword',
        'Increase bid for high-performing keywords (CTR > 5%)',
        'keyword',
        'ctr',
        'greater_than',
        5.0,
        '{"impressions": 500, "conversions_min": 1}',
        'bid_increase',
        15.0,
        25.0,
        70
    ),
    (
        'zero_conversions_high_spend',
        'Alert on keywords with high spend but no conversions',
        'keyword',
        'conversions',
        'equals',
        0,
        '{"cost_min": 50}',
        'alert_only',
        NULL,
        NULL,
        50
    )
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS optimization_rules_updated_at ON optimization_rules;
CREATE TRIGGER optimization_rules_updated_at
    BEFORE UPDATE ON optimization_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
