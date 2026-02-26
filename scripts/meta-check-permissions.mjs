/**
 * Meta API Permission Checker
 *
 * Verifies the META_ACCESS_TOKEN has the required permissions for
 * campaign creation, lead form management, and lead retrieval.
 *
 * Usage: node scripts/meta-check-permissions.mjs
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
const API_VERSION = env['META_API_VERSION'] || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const REQUIRED_PERMISSIONS = [
  { name: 'ads_management', purpose: 'Create and manage campaigns, ad sets, ads' },
  { name: 'pages_manage_ads', purpose: 'Create lead forms on the Page' },
  { name: 'leads_retrieval', purpose: 'Read submitted lead form data' },
  { name: 'pages_read_engagement', purpose: 'Read Page data for ad creatives' },
];

async function main() {
  console.log('=== Meta API Permission Check ===\n');

  if (!TOKEN) {
    console.error('ERROR: META_ACCESS_TOKEN is not set in .env.local');
    process.exit(1);
  }

  console.log(`API Version: ${API_VERSION}`);
  console.log(`Token: ${TOKEN.substring(0, 12)}...${TOKEN.substring(TOKEN.length - 6)}\n`);

  // 1. Validate token with /me
  console.log('1. Validating token...');
  try {
    const meRes = await fetch(`${BASE_URL}/me?access_token=${TOKEN}`);
    const me = await meRes.json();
    if (me.error) {
      console.error(`   FAILED: ${me.error.message}`);
      console.error('\n   → Go to https://developers.facebook.com/tools/explorer/');
      console.error('   → Generate a new token with required permissions');
      process.exit(1);
    }
    console.log(`   OK — Authenticated as: ${me.name} (ID: ${me.id})\n`);
  } catch (err) {
    console.error(`   FAILED: ${err.message}`);
    process.exit(1);
  }

  // 2. Check permissions
  console.log('2. Checking permissions...');
  const permRes = await fetch(`${BASE_URL}/me/permissions?access_token=${TOKEN}`);
  const permData = await permRes.json();

  if (permData.error) {
    console.error(`   FAILED: ${permData.error.message}`);
    process.exit(1);
  }

  const grantedPerms = new Map();
  for (const perm of permData.data || []) {
    grantedPerms.set(perm.permission, perm.status);
  }

  let allGranted = true;
  for (const req of REQUIRED_PERMISSIONS) {
    const status = grantedPerms.get(req.name);
    if (status === 'granted') {
      console.log(`   ✓ ${req.name} — granted (${req.purpose})`);
    } else if (status === 'declined') {
      console.log(`   ✗ ${req.name} — DECLINED (${req.purpose})`);
      allGranted = false;
    } else {
      console.log(`   ✗ ${req.name} — NOT FOUND (${req.purpose})`);
      allGranted = false;
    }
  }

  // 3. Check ad account access
  console.log('\n3. Checking ad account access...');
  const adAccountId = env['META_AD_ACCOUNT_ID'];
  if (!adAccountId) {
    console.error('   WARNING: META_AD_ACCOUNT_ID not set in .env.local');
  } else {
    const acctRes = await fetch(
      `${BASE_URL}/${adAccountId}?fields=name,account_status,currency,timezone_name&access_token=${TOKEN}`
    );
    const acct = await acctRes.json();
    if (acct.error) {
      console.error(`   FAILED: ${acct.error.message}`);
      allGranted = false;
    } else {
      const statusMap = { 1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK_REVIEW', 8: 'PENDING_SETTLEMENT', 9: 'IN_GRACE_PERIOD', 100: 'PENDING_CLOSURE', 101: 'CLOSED', 201: 'ANY_ACTIVE', 202: 'ANY_CLOSED' };
      console.log(`   OK — ${acct.name}`);
      console.log(`   Status: ${statusMap[acct.account_status] || acct.account_status}`);
      console.log(`   Currency: ${acct.currency}, Timezone: ${acct.timezone_name}`);
    }
  }

  // 4. Check Page access
  console.log('\n4. Checking Page access...');
  const pageId = env['META_PAGE_ID'];
  if (!pageId) {
    console.error('   WARNING: META_PAGE_ID not set in .env.local');
  } else {
    const pageRes = await fetch(
      `${BASE_URL}/${pageId}?fields=name,id&access_token=${TOKEN}`
    );
    const page = await pageRes.json();
    if (page.error) {
      console.error(`   FAILED: ${page.error.message}`);
      allGranted = false;
    } else {
      console.log(`   OK — Page: ${page.name} (ID: ${page.id})`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allGranted) {
    console.log('ALL PERMISSIONS GRANTED — Ready to create campaigns.');
  } else {
    console.log('MISSING PERMISSIONS — Action required:\n');
    console.log('1. Go to Meta Business Settings: https://business.facebook.com/settings/');
    console.log('2. Navigate to: Users → System Users → your app');
    console.log('3. Click "Generate New Token"');
    console.log('4. Select the app and grant these permissions:');
    for (const req of REQUIRED_PERMISSIONS) {
      const status = grantedPerms.get(req.name);
      if (status !== 'granted') {
        console.log(`   - ${req.name}`);
      }
    }
    console.log('5. Update META_ACCESS_TOKEN in .env.local with the new token');
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
