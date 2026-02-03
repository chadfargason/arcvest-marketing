/**
 * Run Lead Finder Migration
 * 
 * Usage: node run-lead-finder-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://rhysciwzmjleziieeugv.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeXNjaXd6bWpsZXppaWVldWd2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTM0OTk3OCwiZXhwIjoyMDUwOTI1OTc4fQ.czW-rrfW4crbk0v6GDPFBQ_EaM-N1dA';

// Read the service key from env
const serviceKey = process.env.SUPABASE_SERVICE_KEY || SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, serviceKey);

// The migration SQL broken into executable chunks
const migrations = [
  // Config table
  `CREATE TABLE IF NOT EXISTS lead_finder_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Insert default config
  `INSERT INTO lead_finder_config (key, value) VALUES
    ('geo_list', '[{"name": "Houston", "aliases": ["Houston", "The Woodlands", "Katy", "Sugar Land", "Pearland"]},{"name": "Dallas", "aliases": ["Dallas", "Plano", "Frisco", "Irving", "Richardson"]},{"name": "Austin", "aliases": ["Austin", "Round Rock", "Cedar Park", "Georgetown"]},{"name": "San Antonio", "aliases": ["San Antonio", "New Braunfels", "Boerne"]},{"name": "Fort Worth", "aliases": ["Fort Worth", "Arlington", "Southlake", "Grapevine"]}]'::jsonb),
    ('trigger_list', '["career_move", "funding_mna", "expansion"]'::jsonb),
    ('industry_list', '["energy", "healthcare", "professional_services", "tech", "real_estate", "finance"]'::jsonb),
    ('email_tones', '["congratulatory", "value_first", "peer_credibility", "direct_curious"]'::jsonb),
    ('daily_lead_target', '20'::jsonb),
    ('candidate_target', '60'::jsonb),
    ('recency_days', '7'::jsonb),
    ('lead_cooldown_days', '90'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,

  // Runs table
  `CREATE TABLE IF NOT EXISTS lead_finder_runs (
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
  )`,

  // Search results table
  `CREATE TABLE IF NOT EXISTS lead_finder_search_results (
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
  )`,

  // Pages table
  `CREATE TABLE IF NOT EXISTS lead_finder_pages (
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
  )`,

  // Leads table
  `CREATE TABLE IF NOT EXISTS lead_finder_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES lead_finder_runs(id) ON DELETE SET NULL,
    page_id UUID REFERENCES lead_finder_pages(id) ON DELETE SET NULL,
    person_key TEXT NOT NULL,
    full_name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    geo_signal TEXT,
    trigger_type TEXT CHECK (trigger_type IN ('career_move', 'funding_mna', 'expansion', 'recognition', 'other')),
    category TEXT CHECK (category IN ('exec', 'owner', 'professional', 'real_estate', 'other')),
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
    rationale_short TEXT,
    rationale_detail TEXT,
    evidence_snippets JSONB DEFAULT '[]',
    contact_paths JSONB DEFAULT '[]',
    source_url TEXT,
    source_title TEXT,
    outreach_status TEXT DEFAULT 'pending' CHECK (outreach_status IN ('pending', 'email_ready', 'sent', 'skipped', 'responded', 'converted', 'bounced')),
    sent_at TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(run_id, person_key)
  )`,

  // Emails table
  `CREATE TABLE IF NOT EXISTS lead_finder_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES lead_finder_leads(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT NOT NULL,
    tone TEXT CHECK (tone IN ('congratulatory', 'value_first', 'peer_credibility', 'direct_curious')),
    model_used TEXT DEFAULT 'claude-3-5-sonnet',
    edited_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lead_id, version)
  )`,

  // Suppression table
  `CREATE TABLE IF NOT EXISTS lead_finder_suppression (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('person_key', 'email', 'domain', 'company')),
    value TEXT NOT NULL,
    reason TEXT CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual', 'converted', 'existing_client')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type, value)
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_runs_date ON lead_finder_runs(run_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_runs_status ON lead_finder_runs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_search_results_run ON lead_finder_search_results(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_search_results_url ON lead_finder_search_results(url)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_pages_run ON lead_finder_pages(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_pages_domain ON lead_finder_pages(domain)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_run ON lead_finder_leads(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_person_key ON lead_finder_leads(person_key)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_score ON lead_finder_leads(score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_tier ON lead_finder_leads(tier)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_status ON lead_finder_leads(outreach_status)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_created ON lead_finder_leads(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_category ON lead_finder_leads(category)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_leads_trigger ON lead_finder_leads(trigger_type)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_emails_lead ON lead_finder_emails(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_finder_suppression_type_value ON lead_finder_suppression(type, value)`,
];

async function runMigration() {
  console.log('🚀 Running Lead Finder Migration...\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    const preview = sql.slice(0, 60).replace(/\n/g, ' ').trim() + '...';

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        // If exec_sql doesn't exist, try running directly via fetch
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql_query: sql })
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        // If exec_sql doesn't exist, we'll need to use the SQL editor
        if (response.status === 404) {
          throw new Error('exec_sql function not found - please run SQL manually in Supabase dashboard');
        }
      }

      console.log(`✅ [${i + 1}/${migrations.length}] ${preview}`);
      success++;
    } catch (err) {
      console.log(`❌ [${i + 1}/${migrations.length}] ${preview}`);
      console.log(`   Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log('\n---');
  console.log(`Migration complete: ${success} succeeded, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some migrations failed. You may need to run the SQL manually.');
    console.log('   Open https://supabase.com/dashboard/project/rhysciwzmjleziieeugv/sql');
    console.log('   and paste the contents of packages/database/migrations/013_lead_finder.sql');
  }
}

runMigration();
