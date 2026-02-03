/**
 * Quick migration runner for Lead Finder tables
 * Run with: node run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if exists
require('dotenv').config({ path: path.join(__dirname, 'packages/dashboard/.env.local') });

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase credentials');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
    console.error('SUPABASE_SERVICE_KEY:', serviceKey ? 'set' : 'missing');
    process.exit(1);
  }

  console.log('Connecting to Supabase:', supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  // Read migration file
  const migrationPath = path.join(__dirname, 'packages/database/migrations/013_lead_finder.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration: 013_lead_finder.sql');
  console.log('---');

  // Split into individual statements (handling $$ blocks)
  const statements = [];
  let current = '';
  let inDollarQuote = false;

  for (const line of migrationSql.split('\n')) {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('--') && !inDollarQuote) {
      continue;
    }

    current += line + '\n';

    // Track $$ blocks
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const match of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    // End of statement
    if (trimmed.endsWith(';') && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Execute each statement
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 80).replace(/\n/g, ' ').trim();
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Try direct query instead
        const { error: directError } = await supabase.from('_temp').select().limit(0);
        
        // For DDL statements, we need to use a different approach
        // Let's try running as raw SQL via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: stmt })
        });

        if (!response.ok) {
          throw new Error(error?.message || 'Unknown error');
        }
      }
      
      console.log(`✓ [${i + 1}/${statements.length}] ${preview}...`);
      successCount++;
    } catch (err) {
      console.log(`✗ [${i + 1}/${statements.length}] ${preview}...`);
      console.log(`  Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log('---');
  console.log(`Migration complete: ${successCount} succeeded, ${errorCount} failed`);
}

runMigration().catch(console.error);
