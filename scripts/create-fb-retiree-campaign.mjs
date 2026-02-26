/**
 * Facebook Retiree Campaign Setup Script
 *
 * Creates the full campaign structure for the retiree demographic test:
 * - Lead form (Higher Intent)
 * - Campaign (OUTCOME_LEADS, Financial Products Special Ad Category)
 * - Ad set (Advantage+ targeting, nationwide US)
 * - 4 ad creatives (PAS, Question-Led, Social Proof, Direct Value)
 * - 4 ads (one per creative, all PAUSED)
 *
 * Usage: node scripts/create-fb-retiree-campaign.mjs
 *        node scripts/create-fb-retiree-campaign.mjs --enable
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

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
const PAGE_ID = env['META_PAGE_ID'];
const API_VERSION = env['META_API_VERSION'] || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function graphPost(path, params = {}) {
  const body = new URLSearchParams();
  body.set('access_token', TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      body.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();

  if (json.error) {
    throw new Error(
      `Meta API error [${json.error.code}]: ${json.error.message} (type: ${json.error.type}, fbtrace: ${json.error.fbtrace_id})`
    );
  }
  return json;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ---------------------------------------------------------------------------
// Ad creative copy
// ---------------------------------------------------------------------------

const AD_VARIATIONS = [
  {
    name: 'Ad 1 — PAS (Fear of Running Out)',
    primaryText:
      'Retiring in the next 5 years but not sure your savings will last? Most people underestimate how much they\'ll need — and one wrong move with Social Security timing could cost tens of thousands. We built a free Retirement Readiness Checklist for professionals approaching retirement. No sales pitch, just clarity.',
    headline: 'Download Your Free Retirement Checklist',
    description: 'ArcVest — Fee-Only Fiduciary Wealth Management',
  },
  {
    name: 'Ad 2 — Question-Led (Curiosity)',
    primaryText:
      'What would it feel like to retire knowing — really knowing — that your money will last? Most people within 10 years of retirement have never stress-tested their plan. Our free checklist walks you through the 7 questions every retiree should answer before they stop working.',
    headline: '7 Questions to Answer Before You Retire',
    description: 'Free from ArcVest Wealth Management',
  },
  {
    name: 'Ad 3 — Social Proof / Empathy',
    primaryText:
      'When we sit down with someone for the first time, the most common thing we hear is: \'I just want to know if I\'m going to be okay.\' After helping hundreds of families plan for retirement, we know that feeling. That\'s why we created a simple Retirement Readiness Checklist — no jargon, no pressure.',
    headline: 'Will Your Retirement Plan Actually Work?',
    description: 'Free Checklist from ArcVest',
  },
  {
    name: 'Ad 4 — Direct Value / Offer-Led',
    primaryText:
      'Free: Our 2026 Retirement Readiness Checklist, built for professionals with $500K+ in savings. Covers Social Security timing, tax-efficient withdrawal strategies, and the one thing most retirees overlook about healthcare costs.',
    headline: 'Get Your Free Retirement Checklist',
    description: 'From ArcVest — A Fee-Only Fiduciary Firm',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Facebook Retiree Campaign Setup ===\n');

  // Validate env
  if (!TOKEN || !AD_ACCOUNT_ID || !PAGE_ID) {
    console.error('ERROR: Missing required env vars. Ensure these are set in .env.local:');
    console.error('  META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID');
    process.exit(1);
  }

  const enableFlag = process.argv.includes('--enable');
  const createdIds = {};

  // -------------------------------------------------------------------------
  // Step 1: Create Lead Form
  // -------------------------------------------------------------------------
  console.log('Step 1: Creating Lead Form...');

  try {
    const leadForm = await graphPost(`/${PAGE_ID}/leadgen_forms`, {
      name: 'ArcVest Retirement Readiness Checklist',
      questions: [
        { type: 'FIRST_NAME' },
        { type: 'EMAIL' },
        { type: 'PHONE' },
        {
          type: 'CUSTOM',
          key: 'investable_assets',
          label: 'What is your approximate investable asset level?',
          options: [
            { value: 'Under $250K', key: 'under_250k' },
            { value: '$250K - $500K', key: '250k_500k' },
            { value: '$500K - $1M', key: '500k_1m' },
            { value: '$1M - $2M', key: '1m_2m' },
            { value: '$2M+', key: '2m_plus' },
          ],
        },
      ],
      privacy_policy: { url: 'https://arcvest.com/privacy' },
      thank_you_page: {
        title: 'Thank You!',
        body: 'Your Retirement Readiness Checklist is on its way. Check your email within the next few minutes.',
      },
      follow_up_action_url: 'https://retire.arcvest.com',
      locale: 'EN_US',
      form_type: 'MORE_VOLUME',
    });

    createdIds.leadFormId = leadForm.id;
    console.log(`   ✓ Lead Form created: ${leadForm.id}\n`);
  } catch (err) {
    console.error(`   ✗ Lead Form creation failed: ${err.message}`);
    console.error('\n   Note: Lead form creation requires a Page Access Token with pages_manage_ads permission.');
    console.error('   If using a System User token, ensure the Page is assigned to the System User.');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Step 2: Create Campaign
  // -------------------------------------------------------------------------
  console.log('Step 2: Creating Campaign...');

  try {
    const campaign = await graphPost(`/${AD_ACCOUNT_ID}/campaigns`, {
      name: 'Retiree-FB-Test-2026-02',
      objective: 'OUTCOME_LEADS',
      special_ad_categories: ['FINANCIAL_PRODUCTS_AND_SERVICES'],
      daily_budget: 1000, // $10 in cents
      status: 'PAUSED',
    });

    createdIds.campaignId = campaign.id;
    console.log(`   ✓ Campaign created: ${campaign.id}\n`);
  } catch (err) {
    console.error(`   ✗ Campaign creation failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Step 3: Create Ad Set
  // -------------------------------------------------------------------------
  console.log('Step 3: Creating Ad Set...');

  try {
    const adSet = await graphPost(`/${AD_ACCOUNT_ID}/adsets`, {
      campaign_id: createdIds.campaignId,
      name: 'Retiree-Broad-Advantage',
      daily_budget: 1000, // $10 in cents
      optimization_goal: 'LEAD_GENERATION',
      billing_event: 'IMPRESSIONS',
      targeting: {
        geo_locations: { countries: ['US'] },
      },
      promoted_object: {
        page_id: PAGE_ID,
      },
      status: 'PAUSED',
    });

    createdIds.adSetId = adSet.id;
    console.log(`   ✓ Ad Set created: ${adSet.id}\n`);
  } catch (err) {
    console.error(`   ✗ Ad Set creation failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Step 4: Create Ad Creatives
  // -------------------------------------------------------------------------
  console.log('Step 4: Creating Ad Creatives...');

  createdIds.creativeIds = [];

  for (const variation of AD_VARIATIONS) {
    try {
      const linkData = {
        link: 'https://retire.arcvest.com',
        message: variation.primaryText,
        name: variation.headline,
        description: variation.description,
        call_to_action: {
          type: 'LEARN_MORE',
          value: { lead_gen_form_id: createdIds.leadFormId },
        },
      };

      const creative = await graphPost(`/${AD_ACCOUNT_ID}/adcreatives`, {
        name: variation.name,
        object_story_spec: {
          page_id: PAGE_ID,
          link_data: linkData,
        },
      });

      createdIds.creativeIds.push({ name: variation.name, id: creative.id });
      console.log(`   ✓ Creative "${variation.name}": ${creative.id}`);
    } catch (err) {
      console.error(`   ✗ Creative "${variation.name}" failed: ${err.message}`);
    }
  }
  console.log('');

  // -------------------------------------------------------------------------
  // Step 5: Create Ads
  // -------------------------------------------------------------------------
  console.log('Step 5: Creating Ads...');

  createdIds.adIds = [];

  for (const creative of createdIds.creativeIds) {
    try {
      const ad = await graphPost(`/${AD_ACCOUNT_ID}/ads`, {
        adset_id: createdIds.adSetId,
        creative: { creative_id: creative.id },
        name: creative.name,
        status: 'PAUSED',
      });

      createdIds.adIds.push({ name: creative.name, id: ad.id });
      console.log(`   ✓ Ad "${creative.name}": ${ad.id}`);
    } catch (err) {
      console.error(`   ✗ Ad "${creative.name}" failed: ${err.message}`);
    }
  }
  console.log('');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('CAMPAIGN STRUCTURE CREATED (PAUSED)\n');
  console.log(`Lead Form ID:  ${createdIds.leadFormId}`);
  console.log(`Campaign ID:   ${createdIds.campaignId}`);
  console.log(`Ad Set ID:     ${createdIds.adSetId}`);
  console.log(`Creatives:     ${createdIds.creativeIds.length}`);
  console.log(`Ads:           ${createdIds.adIds.length}`);
  console.log('');
  console.log('Save this Lead Form ID for the fb-leads-sync cron:');
  console.log(`  META_LEAD_FORM_ID=${createdIds.leadFormId}`);
  console.log('');

  // -------------------------------------------------------------------------
  // Step 6: Enable (optional)
  // -------------------------------------------------------------------------
  if (enableFlag) {
    console.log('--enable flag detected. Enabling campaign and ads...\n');
    await enableCampaign(createdIds);
  } else {
    const answer = await ask('Enable campaign and ads now? (y/n): ');
    if (answer === 'y' || answer === 'yes') {
      await enableCampaign(createdIds);
    } else {
      console.log('\nCampaign left PAUSED. Enable manually in Ads Manager or re-run with --enable.');
    }
  }
}

async function enableCampaign(ids) {
  try {
    // Enable campaign
    await graphPost(`/${ids.campaignId}`, { status: 'ACTIVE' });
    console.log(`   ✓ Campaign ${ids.campaignId} → ACTIVE`);

    // Enable ad set
    await graphPost(`/${ids.adSetId}`, { status: 'ACTIVE' });
    console.log(`   ✓ Ad Set ${ids.adSetId} → ACTIVE`);

    // Enable ads
    for (const ad of ids.adIds) {
      await graphPost(`/${ad.id}`, { status: 'ACTIVE' });
      console.log(`   ✓ Ad "${ad.name}" ${ad.id} → ACTIVE`);
    }

    console.log('\nCampaign is now ACTIVE. Ads will enter Meta review (usually approved within hours).');
  } catch (err) {
    console.error(`\nFailed to enable: ${err.message}`);
    console.error('You can enable manually in Meta Ads Manager.');
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
