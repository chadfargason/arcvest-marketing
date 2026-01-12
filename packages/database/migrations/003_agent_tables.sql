-- ============================================
-- ArcVest Marketing Automation System
-- Migration 003: Agent Infrastructure Tables
-- ============================================

-- ============================================
-- AGENT TASK QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    type TEXT NOT NULL,  -- 'content_creation', 'ad_optimization', etc.
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),  -- 1 = highest
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'awaiting_approval', 'complete', 'failed'
    )),
    assigned_agent TEXT NOT NULL,  -- 'content', 'creative', 'paid_media', etc.

    payload JSONB DEFAULT '{}',
    result JSONB DEFAULT NULL,

    created_by TEXT NOT NULL,  -- Agent name, 'schedule', or 'human'
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT
);

-- ============================================
-- APPROVAL QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS approval_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    type TEXT NOT NULL,  -- 'blog_post', 'ad_copy', 'campaign_budget', etc.
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'revision_requested'
    )),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

    title TEXT NOT NULL,
    summary TEXT,
    content JSONB NOT NULL,  -- The actual content to review

    created_by TEXT NOT NULL,  -- Agent name
    reviewed_by TEXT,  -- 'chad', 'erik', or null
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,  -- If revision requested

    related_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,

    -- For content reference
    content_id UUID,  -- Reference to content_calendar if applicable

    -- Escalation tracking
    reminder_sent_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ
);

-- ============================================
-- AGENT MESSAGES TABLE (Inter-agent communication)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'event', 'error')),

    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 3,

    requires_response BOOLEAN DEFAULT FALSE,
    correlation_id UUID,  -- For tracking related messages
    expires_at TIMESTAMPTZ,

    processed_at TIMESTAMPTZ,
    processed_result JSONB
);

-- ============================================
-- WORKFLOW INSTANCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    workflow_type TEXT NOT NULL,  -- 'new_blog_post', 'new_ad_campaign', etc.
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed')),

    current_step INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,

    payload JSONB DEFAULT '{}',
    step_results JSONB DEFAULT '[]',  -- Array of results from each step

    error_message TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================
-- AGENT STATUS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agent_status (
    agent_name TEXT PRIMARY KEY,
    is_running BOOLEAN DEFAULT FALSE,
    last_run_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    tasks_pending INTEGER DEFAULT 0,
    tasks_completed_today INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize agent status
INSERT INTO agent_status (agent_name) VALUES
    ('orchestrator'),
    ('content'),
    ('creative'),
    ('paid_media'),
    ('seo'),
    ('analytics'),
    ('research')
ON CONFLICT (agent_name) DO NOTHING;

-- ============================================
-- SCHEDULED JOBS LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_job_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    job_name TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),

    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- INDEXES
-- ============================================

-- Agent tasks indexes
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned ON agent_tasks(assigned_agent, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_tasks_due ON agent_tasks(due_at)
    WHERE status = 'pending' AND due_at IS NOT NULL;

-- Approval queue indexes
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_priority ON approval_queue(priority, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_queue_type ON approval_queue(type);

-- Agent messages indexes
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent, processed_at)
    WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_messages_correlation ON agent_messages(correlation_id);

-- Workflow instances indexes
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_type ON workflow_instances(workflow_type, status);

-- Scheduled job log indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_job_log_agent ON scheduled_job_log(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_log_job ON scheduled_job_log(job_name, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS workflow_instances_updated_at ON workflow_instances;
CREATE TRIGGER workflow_instances_updated_at
    BEFORE UPDATE ON workflow_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update agent_status.updated_at on changes
CREATE OR REPLACE FUNCTION update_agent_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_status_updated_at ON agent_status;
CREATE TRIGGER agent_status_updated_at
    BEFORE UPDATE ON agent_status
    FOR EACH ROW EXECUTE FUNCTION update_agent_status_timestamp();
