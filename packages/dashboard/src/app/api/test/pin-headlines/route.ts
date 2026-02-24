/**
 * Temporary endpoint to replace RSAs with pinned brand headlines.
 * Removes old ads and creates new ones with HEADLINE_1 pinned.
 * DELETE AFTER USE.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getAccessToken() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function mutate(
  resource: string,
  operations: unknown[],
  customerId: string,
  loginCustomerId: string,
  accessToken: string,
) {
  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${customerId}/${resource}:mutate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operations }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { error };
  }

  return await response.json();
}

interface AdConfig {
  adGroupResourceName: string;
  oldAdGroupAdResourceName: string;
  brandHeadlineText: string;
  headlines: string[];
  descriptions: string[];
}

async function replaceAdWithPins(
  config: AdConfig,
  customerId: string,
  loginCustomerId: string,
  accessToken: string,
) {
  // Step 1: Remove old ad
  const removeResult = await mutate(
    'adGroupAds',
    [{ remove: config.oldAdGroupAdResourceName }],
    customerId, loginCustomerId, accessToken,
  );

  if ('error' in removeResult) {
    return { step: 'remove', error: removeResult.error };
  }

  // Step 2: Create new ad with pinned brand headline
  const headlines = config.headlines.map(text => {
    if (text === config.brandHeadlineText) {
      return { text, pinnedField: 'HEADLINE_1' };
    }
    return { text };
  });

  const descriptions = config.descriptions.map(text => ({ text }));

  const createResult = await mutate(
    'adGroupAds',
    [{
      create: {
        adGroup: config.adGroupResourceName,
        status: 'ENABLED',
        ad: {
          responsiveSearchAd: {
            headlines,
            descriptions,
          },
          finalUrls: ['https://arcvest.com/'],
        },
      },
    }],
    customerId, loginCustomerId, accessToken,
  );

  return { remove: removeResult, create: createResult };
}

export async function POST() {
  try {
    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId).replace(/-/g, '');
    const accessToken = await getAccessToken();

    const preRetireeResult = await replaceAdWithPins({
      adGroupResourceName: 'customers/9110037605/adGroups/196485118511',
      oldAdGroupAdResourceName: 'customers/9110037605/adGroupAds/196485118511~798265610296',
      brandHeadlineText: 'ArcVest: Plan Retirement',
      headlines: [
        'ArcVest: Plan Retirement',
        'Master Retirement Tips',
        'Social Security Basics',
        'Get Your Retirement Plan',
        'Fee-Only Advisor Benefits',
        '401k Rollover Advice',
        'Tax-Smart Withdrawals',
        'Retire With Confidence?',
        'Fiduciary Planning Help',
        'Healthcare Cost Insights',
        'What Retirement Means',
        'Avoid Commission Conflicts',
        'Income Strategy Insights',
        'Know Your Retirement Age',
        'Free Consultation Booking',
      ],
      descriptions: [
        'Learn value of fee-only advice. Get your personal roadmap today.',
        'Understand Social Security timing for income. Access free resources.',
        'Build confidence with evidence-based plans. No conflicts of interest.',
        'Get tax-efficient withdrawal tips from fiduciary experts. Start today.',
      ],
    }, customerId, loginCustomerId, accessToken);

    const hnwResult = await replaceAdWithPins({
      adGroupResourceName: 'customers/9110037605/adGroups/199292097331',
      oldAdGroupAdResourceName: 'customers/9110037605/adGroupAds/199292097331~798342546128',
      brandHeadlineText: 'ArcVest Wealth Mgmt',
      headlines: [
        'ArcVest Wealth Mgmt',
        'Say No to Hidden Fees',
        'Fee-Only Fiduciary',
        'Your Wealth, Your Way',
        'Top Net Worth Advisors',
        'No Conflicts Ever',
        'Transparent Pricing',
        'Institutional Advice',
        'Optimize Your Taxes',
        'Expert Estate Planning',
        'Compare Fees Today',
        'Get Started Now',
        'Evidence-Based Advice',
        'Start Your Legacy Now',
        'Wealth Mgmt $2M+',
      ],
      descriptions: [
        'Stop overpaying with conflicted advisors. Choose ArcVest fee-only advice.',
        'ArcVest: Transparent pricing, no hidden fees. Get your consultation today.',
        'Get top-tier fiduciary advice with ArcVest. Compare fees now.',
        'ArcVest fee-only fiduciaries for $2M+ wealth. Start your consultation.',
      ],
    }, customerId, loginCustomerId, accessToken);

    return NextResponse.json({
      preRetiree: preRetireeResult,
      hnw: hnwResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
