/**
 * Facebook Campaign Performance Report
 *
 * Pulls metrics for the Retiree-FB-Test campaign and displays
 * campaign-level and ad-level breakdowns.
 *
 * Usage: node scripts/fb-campaign-report.mjs
 *        node scripts/fb-campaign-report.mjs --days 14
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});

const TOKEN = env['META_ACCESS_TOKEN'];
const AD_ACCOUNT_ID = env['META_AD_ACCOUNT_ID'];
const LEAD_FORM_ID = env['META_LEAD_FORM_ID'];
const API_VERSION = env['META_API_VERSION'] || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Parse --days flag
const daysIdx = process.argv.indexOf('--days');
const DAYS = daysIdx !== -1 ? parseInt(process.argv[daysIdx + 1], 10) : 7;

async function graphGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error) {
    throw new Error(`Meta API error [${json.error.code}]: ${json.error.message}`);
  }
  return json;
}

function fmt(num, decimals = 2) {
  if (num === null || num === undefined) return '—';
  return Number(num).toFixed(decimals);
}

function fmtCurrency(num) {
  if (num === null || num === undefined) return '—';
  return `$${Number(num).toFixed(2)}`;
}

function fmtPct(num) {
  if (num === null || num === undefined) return '—';
  return `${Number(num).toFixed(2)}%`;
}

async function main() {
  console.log('=== Facebook Campaign Performance Report ===\n');

  if (!TOKEN || !AD_ACCOUNT_ID) {
    console.error('ERROR: META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in .env.local');
    process.exit(1);
  }

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Date range: ${startDate} → ${endDate} (${DAYS} days)\n`);

  // -------------------------------------------------------------------------
  // 1. Campaign-level metrics
  // -------------------------------------------------------------------------
  console.log('--- Campaign Summary ---\n');

  try {
    const campaignInsights = await graphGet(`/${AD_ACCOUNT_ID}/insights`, {
      fields: 'campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type',
      time_range: { since: startDate, until: endDate },
      level: 'campaign',
      filtering: [{ field: 'campaign.name', operator: 'CONTAIN', value: 'Retiree-FB' }],
    });

    if (!campaignInsights.data?.length) {
      console.log('No data yet for Retiree-FB campaigns. Campaign may not have served impressions.\n');
    } else {
      for (const row of campaignInsights.data) {
        const leads = row.actions?.find((a) => a.action_type === 'lead')?.value || 0;
        const cpl = row.cost_per_action_type?.find((a) => a.action_type === 'lead')?.value || null;

        console.log(`Campaign:    ${row.campaign_name}`);
        console.log(`Impressions: ${parseInt(row.impressions).toLocaleString()}`);
        console.log(`Reach:       ${parseInt(row.reach || 0).toLocaleString()}`);
        console.log(`Clicks:      ${parseInt(row.clicks).toLocaleString()}`);
        console.log(`CTR:         ${fmtPct(row.ctr)}`);
        console.log(`CPC:         ${fmtCurrency(row.cpc)}`);
        console.log(`CPM:         ${fmtCurrency(row.cpm)}`);
        console.log(`Spend:       ${fmtCurrency(row.spend)}`);
        console.log(`Leads:       ${leads}`);
        console.log(`CPL:         ${cpl ? fmtCurrency(cpl) : '—'}`);
        console.log('');
      }
    }
  } catch (err) {
    console.error(`Campaign insights error: ${err.message}\n`);
  }

  // -------------------------------------------------------------------------
  // 2. Ad-level breakdown (which creative is winning?)
  // -------------------------------------------------------------------------
  console.log('--- Ad-Level Breakdown ---\n');

  try {
    const adInsights = await graphGet(`/${AD_ACCOUNT_ID}/insights`, {
      fields: 'ad_name,impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type',
      time_range: { since: startDate, until: endDate },
      level: 'ad',
      filtering: [{ field: 'campaign.name', operator: 'CONTAIN', value: 'Retiree-FB' }],
    });

    if (!adInsights.data?.length) {
      console.log('No ad-level data yet.\n');
    } else {
      // Table header
      const header = ['Ad Name', 'Impr', 'Clicks', 'CTR', 'CPC', 'Spend', 'Leads', 'CPL'];
      const rows = adInsights.data.map((row) => {
        const leads = row.actions?.find((a) => a.action_type === 'lead')?.value || '0';
        const cpl = row.cost_per_action_type?.find((a) => a.action_type === 'lead')?.value || null;
        return [
          row.ad_name?.substring(0, 35) || '—',
          parseInt(row.impressions).toLocaleString(),
          parseInt(row.clicks).toLocaleString(),
          fmtPct(row.ctr),
          fmtCurrency(row.cpc),
          fmtCurrency(row.spend),
          leads,
          cpl ? fmtCurrency(cpl) : '—',
        ];
      });

      // Sort by spend descending
      rows.sort((a, b) => parseFloat(b[5].replace('$', '')) - parseFloat(a[5].replace('$', '')));

      // Print table
      const colWidths = header.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => String(r[i]).length))
      );
      const separator = colWidths.map((w) => '-'.repeat(w)).join('--');

      console.log(header.map((h, i) => h.padEnd(colWidths[i])).join('  '));
      console.log(separator);
      for (const row of rows) {
        console.log(row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('  '));
      }
      console.log('');
    }
  } catch (err) {
    console.error(`Ad insights error: ${err.message}\n`);
  }

  // -------------------------------------------------------------------------
  // 3. Lead form submission count
  // -------------------------------------------------------------------------
  if (LEAD_FORM_ID) {
    console.log('--- Lead Form Stats ---\n');

    try {
      const leads = await graphGet(`/${LEAD_FORM_ID}/leads`, {
        fields: 'id,created_time',
        limit: '500',
      });

      const totalLeads = leads.data?.length || 0;
      const recentLeads = (leads.data || []).filter((l) => {
        const created = new Date(l.created_time).getTime();
        return created >= Date.now() - DAYS * 24 * 60 * 60 * 1000;
      });

      console.log(`Total leads (all time): ${totalLeads}`);
      console.log(`Leads (last ${DAYS} days):  ${recentLeads.length}`);

      if (recentLeads.length > 0) {
        const latest = recentLeads.sort(
          (a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
        )[0];
        console.log(`Most recent:            ${latest.created_time}`);
      }
      console.log('');
    } catch (err) {
      console.error(`Lead form stats error: ${err.message}\n`);
    }
  } else {
    console.log('--- Lead Form Stats ---\n');
    console.log('META_LEAD_FORM_ID not set — skipping lead count.\n');
  }

  console.log('Report complete.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
