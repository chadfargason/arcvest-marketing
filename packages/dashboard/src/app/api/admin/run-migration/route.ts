import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/run-migration
 *
 * Runs the job_queue migration. Protected by a simple secret.
 * This endpoint should be removed after migration is complete.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Simple protection - require a secret header
  const secret = request.headers.get('x-migration-secret');
  if (secret !== 'run-job-queue-migration-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: { step: string; success: boolean; error?: string }[] = [];

  try {
    // Step 1: Create job_queue table
    const { error: tableError } = await supabase.rpc('exec_sql_query', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS job_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_type TEXT NOT NULL,
          payload JSONB DEFAULT '{}',
          priority INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 5,
          last_error TEXT,
          next_run_at TIMESTAMPTZ DEFAULT now(),
          created_at TIMESTAMPTZ DEFAULT now(),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          result JSONB,
          correlation_id UUID,
          parent_job_id UUID REFERENCES job_queue(id),
          CONSTRAINT valid_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
        );
      `
    });

    if (tableError) {
      // Table might already exist, try inserting directly
      results.push({ step: 'create_table_via_rpc', success: false, error: tableError.message });

      // Try direct insert to verify table exists
      const { error: testError } = await supabase
        .from('job_queue')
        .select('id')
        .limit(1);

      if (testError && testError.message.includes('does not exist')) {
        // Need to create table - use raw SQL via dashboard
        return NextResponse.json({
          error: 'Table does not exist and cannot be created via API. Please run migration manually in Supabase SQL Editor.',
          migration_sql: getMigrationSQL()
        }, { status: 500 });
      } else {
        results.push({ step: 'table_exists_check', success: true });
      }
    } else {
      results.push({ step: 'create_table', success: true });
    }

    // Step 2: Add columns to idea_queue
    const { error: alterError1 } = await supabase.rpc('exec_sql_query', {
      sql_query: `ALTER TABLE idea_queue ADD COLUMN IF NOT EXISTS pipeline_step TEXT;`
    });
    results.push({
      step: 'add_pipeline_step_column',
      success: !alterError1,
      error: alterError1?.message
    });

    const { error: alterError2 } = await supabase.rpc('exec_sql_query', {
      sql_query: `ALTER TABLE idea_queue ADD COLUMN IF NOT EXISTS pipeline_data JSONB DEFAULT '{}';`
    });
    results.push({
      step: 'add_pipeline_data_column',
      success: !alterError2,
      error: alterError2?.message
    });

    return NextResponse.json({
      success: true,
      message: 'Migration completed. Some steps may require manual SQL execution.',
      results,
      manual_sql_needed: results.some(r => !r.success)
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      results,
      migration_sql: getMigrationSQL()
    }, { status: 500 });
  }
}

function getMigrationSQL(): string {
  return `
-- Run this in Supabase SQL Editor:

-- 1. Create job_queue table
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  next_run_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  correlation_id UUID,
  parent_job_id UUID REFERENCES job_queue(id),
  CONSTRAINT valid_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_pending ON job_queue(priority DESC, next_run_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_job_queue_processing ON job_queue(started_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status ON job_queue(job_type, status);

-- 3. Add columns to idea_queue
ALTER TABLE idea_queue ADD COLUMN IF NOT EXISTS pipeline_step TEXT;
ALTER TABLE idea_queue ADD COLUMN IF NOT EXISTS pipeline_data JSONB DEFAULT '{}';

-- 4. Create claim_next_job function
CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT DEFAULT 'default')
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET status = 'processing', started_at = now(), attempts = attempts + 1
  WHERE id = (
    SELECT id FROM job_queue
    WHERE status = 'pending' AND next_run_at <= now()
    ORDER BY priority DESC, next_run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
  `;
}

// Also support GET for checking status
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if job_queue table exists
  const { data, error } = await supabase
    .from('job_queue')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    return NextResponse.json({
      migrated: false,
      message: 'job_queue table does not exist',
      migration_sql: getMigrationSQL()
    });
  }

  // Check idea_queue columns
  const { data: ideaData, error: ideaError } = await supabase
    .from('idea_queue')
    .select('pipeline_step, pipeline_data')
    .limit(1);

  return NextResponse.json({
    migrated: !error,
    job_queue_exists: !error,
    idea_queue_columns: !ideaError,
    job_count: data?.length || 0
  });
}
