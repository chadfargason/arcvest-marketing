/**
 * Migration runner for Experiments tables (015_experiments.sql)
 * Uses the Supabase Management API to execute raw SQL.
 * Run with: node run-experiments-migration.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, 'packages/dashboard/.env.local') });

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
  }

  // Extract project ref from Supabase URL (e.g., https://xxxxx.supabase.co → xxxxx)
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  if (!accessToken) {
    console.error('Missing SUPABASE_ACCESS_TOKEN - needed for Management API');
    process.exit(1);
  }

  console.log('Project ref:', projectRef);

  // Read migration file
  const migrationPath = path.join(__dirname, 'packages/database/migrations/015_experiments.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration: 015_experiments.sql');
  console.log('---');

  // Execute the entire migration as one SQL batch via Management API
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: migrationSql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Migration executed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Management API failed:', err.message);
    console.log('\nFalling back to psql via Supabase CLI...\n');

    // Fallback: use supabase db execute
    const { execSync } = require('child_process');
    try {
      const output = execSync(
        `npx supabase db execute --project-ref ${projectRef} -f "${migrationPath}"`,
        {
          cwd: __dirname,
          env: {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: accessToken,
            SUPABASE_DB_PASSWORD: dbPassword,
          },
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: 30000,
        }
      );
      console.log('Migration executed via Supabase CLI:');
      console.log(output);
    } catch (cliErr) {
      console.error('Supabase CLI also failed:', cliErr.stderr || cliErr.message);
      console.log('\nPlease run the migration manually in the Supabase SQL Editor:');
      console.log(`https://supabase.com/dashboard/project/${projectRef}/sql`);
      console.log('Paste the contents of packages/database/migrations/015_experiments.sql');
      process.exit(1);
    }
  }
}

runMigration().catch(console.error);
