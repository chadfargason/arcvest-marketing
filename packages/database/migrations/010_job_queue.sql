-- Migration: 010_job_queue.sql
-- Purpose: Create robust job queue system with retry logic and self-healing
-- Created: January 14, 2026

-- ============================================================================
-- JOB QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job definition
  job_type TEXT NOT NULL,           -- 'news_scan', 'email_scan', 'score_ideas', 'select_daily', 'process_pipeline'
  payload JSONB DEFAULT '{}',       -- Job-specific data (idea_id, sources, count, etc.)
  priority INTEGER DEFAULT 0,       -- Higher = process first

  -- Status tracking
  status TEXT DEFAULT 'pending',    -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

  -- Retry logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  next_run_at TIMESTAMPTZ DEFAULT now(),

  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Result storage
  result JSONB,

  -- Correlation (for related jobs)
  correlation_id UUID,
  parent_job_id UUID REFERENCES job_queue(id),

  -- Constraints
  CONSTRAINT valid_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Index for efficient job claiming (pending jobs ready to run)
CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(priority DESC, next_run_at ASC)
  WHERE status = 'pending';

-- Index for finding stuck jobs
CREATE INDEX IF NOT EXISTS idx_job_queue_processing
  ON job_queue(started_at)
  WHERE status = 'processing';

-- Index for correlation lookups
CREATE INDEX IF NOT EXISTS idx_job_queue_correlation
  ON job_queue(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Index for job type queries
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status
  ON job_queue(job_type, status);

-- ============================================================================
-- ATOMIC JOB CLAIMING FUNCTION
-- Prevents race conditions when multiple workers run simultaneously
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT DEFAULT 'default')
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id FROM job_queue
    WHERE status = 'pending'
      AND next_run_at <= now()
    ORDER BY priority DESC, next_run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- Critical: skip rows being processed by other workers
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- IDEA_QUEUE MODIFICATIONS FOR CHECKPOINTING
-- ============================================================================

-- Track which pipeline step the idea is on (for resumption)
ALTER TABLE idea_queue
  ADD COLUMN IF NOT EXISTS pipeline_step TEXT;
-- Values: null, 'claude_draft', 'gpt_improve', 'gemini_polish', 'claude_package', 'completed'

-- Store intermediate pipeline results (allows resumption from any step)
ALTER TABLE idea_queue
  ADD COLUMN IF NOT EXISTS pipeline_data JSONB DEFAULT '{}';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to enqueue a new job
CREATE OR REPLACE FUNCTION enqueue_job(
  p_job_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_priority INTEGER DEFAULT 0,
  p_max_attempts INTEGER DEFAULT 5,
  p_correlation_id UUID DEFAULT NULL,
  p_parent_job_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO job_queue (job_type, payload, priority, max_attempts, correlation_id, parent_job_id)
  VALUES (p_job_type, p_payload, p_priority, p_max_attempts, p_correlation_id, p_parent_job_id)
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  UPDATE job_queue
  SET
    status = 'completed',
    completed_at = now(),
    result = p_result
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a job with retry logic
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error TEXT,
  p_base_delay_seconds INTEGER DEFAULT 30
)
RETURNS VOID AS $$
DECLARE
  v_job job_queue;
  v_backoff_seconds INTEGER;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;

  IF v_job.attempts >= v_job.max_attempts THEN
    -- Max attempts reached - mark as permanently failed
    UPDATE job_queue
    SET
      status = 'failed',
      last_error = p_error,
      completed_at = now()
    WHERE id = p_job_id;
  ELSE
    -- Schedule retry with exponential backoff
    v_backoff_seconds := LEAST(
      p_base_delay_seconds * POWER(2, v_job.attempts - 1),
      3600  -- Max 1 hour
    );

    UPDATE job_queue
    SET
      status = 'pending',
      last_error = p_error,
      next_run_at = now() + (v_backoff_seconds || ' seconds')::interval
    WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup stuck jobs
CREATE OR REPLACE FUNCTION cleanup_stuck_jobs(
  p_stuck_threshold_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stuck_jobs AS (
    SELECT id FROM job_queue
    WHERE status = 'processing'
      AND started_at < now() - (p_stuck_threshold_minutes || ' minutes')::interval
  )
  UPDATE job_queue j
  SET
    status = 'pending',
    last_error = 'Job timed out (stuck in processing for ' || p_stuck_threshold_minutes || ' minutes)'
  FROM stuck_jobs s
  WHERE j.id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR MONITORING
-- ============================================================================

CREATE OR REPLACE VIEW job_queue_stats AS
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts,
  MAX(attempts) as max_attempts_used,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job
FROM job_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;

CREATE OR REPLACE VIEW failed_jobs_recent AS
SELECT
  id,
  job_type,
  payload,
  attempts,
  last_error,
  created_at,
  completed_at
FROM job_queue
WHERE status = 'failed'
  AND completed_at > now() - interval '24 hours'
ORDER BY completed_at DESC;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users (for dashboard queries)
GRANT SELECT ON job_queue TO authenticated;
GRANT SELECT ON job_queue_stats TO authenticated;
GRANT SELECT ON failed_jobs_recent TO authenticated;

-- Grant execute on functions to service role
GRANT EXECUTE ON FUNCTION claim_next_job TO service_role;
GRANT EXECUTE ON FUNCTION enqueue_job TO service_role;
GRANT EXECUTE ON FUNCTION complete_job TO service_role;
GRANT EXECUTE ON FUNCTION fail_job TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stuck_jobs TO service_role;
