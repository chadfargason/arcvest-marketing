import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Fetch monthly returns from Supabase asset_returns for tickers needed by the
 * no-free-lunch episode charts, compute cumulative $1-based paths, and write
 * a JSON snapshot for deterministic rendering.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from parent
 * monorepo's .env.local.
 *
 * Usage: tsx scripts/fetch-returns.ts
 */

interface AssetRow {
  asset_ticker: string;
  return_date: string; // YYYY-MM-DD
  monthly_return: number;
}

interface Path {
  asOf: string;
  start: string;
  end: string;
  cumulative: number[]; // length 121: [1.00, ...11 monthly...] actually 120 monthly returns → 121 cum points
  months: string[];     // length 121
}

const TICKERS = ['SPY', 'BIZD', 'VNQ', 'AMLP'] as const;
const START = '2016-01-01';
const END = '2025-12-31';

async function loadEnv(): Promise<{ url: string; key: string }> {
  const envPath = 'C:/code/arcvest-marketing/.env.local';
  const content = readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx < 0 || line.startsWith('#')) continue;
    env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
  const url = env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return { url, key };
}

async function fetchTicker(supabaseUrl: string, supabaseKey: string, ticker: string): Promise<AssetRow[]> {
  const params = new URLSearchParams({
    asset_ticker: `eq.${ticker}`,
    return_date: `gte.${START}`,
    select: 'asset_ticker,return_date,monthly_return',
    order: 'return_date.asc',
  });
  // Append second filter for end date — URLSearchParams replaces on duplicate key, so build manually
  const url = `${supabaseUrl}/rest/v1/asset_returns?${params.toString()}&return_date=lte.${END}&limit=200`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return (await response.json()) as AssetRow[];
}

function toPath(rows: AssetRow[]): Path {
  // Expect 120 monthly rows sorted ascending; compute [1, (1+r1), (1+r1)(1+r2), ...]
  const cum: number[] = [1];
  const months: string[] = ['start'];
  for (const row of rows) {
    const next = cum[cum.length - 1] * (1 + Number(row.monthly_return));
    cum.push(next);
    months.push(row.return_date.slice(0, 7)); // YYYY-MM
  }
  return {
    asOf: new Date().toISOString().slice(0, 10),
    start: rows[0]?.return_date ?? START,
    end: rows[rows.length - 1]?.return_date ?? END,
    cumulative: cum,
    months,
  };
}

async function main(): Promise<void> {
  const { url, key } = await loadEnv();
  console.log(`Fetching monthly returns for ${TICKERS.join(', ')} — ${START} to ${END}`);

  const out: Record<string, Path> = {};
  for (const ticker of TICKERS) {
    const rows = await fetchTicker(url, key, ticker);
    if (rows.length < 100) {
      throw new Error(`Unexpectedly low row count for ${ticker}: ${rows.length}`);
    }
    const path = toPath(rows);
    const endVal = path.cumulative[path.cumulative.length - 1];
    console.log(`  ${ticker.padEnd(6)} ${rows.length} months  $1 → $${endVal.toFixed(4)}`);
    out[ticker] = path;
  }

  const outPath = 'src/episodes/2026-04-13-no-free-lunch/returns-data.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
