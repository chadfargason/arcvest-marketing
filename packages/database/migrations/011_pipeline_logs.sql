-- Pipeline Logs Table
-- Tracks all activity from content pipeline and cron jobs for debugging

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL,
  job_type VARCHAR(50), -- 'content_pipeline', 'bloomberg_scan', 'rss_scan', 'email_scan', etc.

  -- Log entry details
  level VARCHAR(10) NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  details JSONB, -- Additional structured data (error stack, API responses, etc.)

  -- Context
  step VARCHAR(100), -- 'start', 'claude_draft', 'chatgpt_edit', 'gemini_polish', 'complete', etc.
  duration_ms INTEGER, -- Time taken for this step

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_pipeline_logs_job_id ON pipeline_logs(job_id);
CREATE INDEX idx_pipeline_logs_job_type ON pipeline_logs(job_type);
CREATE INDEX idx_pipeline_logs_level ON pipeline_logs(level);
CREATE INDEX idx_pipeline_logs_created_at ON pipeline_logs(created_at DESC);
CREATE INDEX idx_pipeline_logs_step ON pipeline_logs(step);

-- Composite index for common query pattern (recent errors by type)
CREATE INDEX idx_pipeline_logs_type_level_created ON pipeline_logs(job_type, level, created_at DESC);

-- Auto-cleanup: Delete logs older than 30 days (optional - can adjust retention)
-- This can be run via a scheduled job or manually
-- DELETE FROM pipeline_logs WHERE created_at < NOW() - INTERVAL '30 days';

COMMENT ON TABLE pipeline_logs IS 'Tracks pipeline execution for debugging and monitoring';
COMMENT ON COLUMN pipeline_logs.level IS 'Log level: debug, info, warn, error';
COMMENT ON COLUMN pipeline_logs.step IS 'Pipeline step being executed';
COMMENT ON COLUMN pipeline_logs.details IS 'JSON blob with additional context (errors, API responses, etc.)';
