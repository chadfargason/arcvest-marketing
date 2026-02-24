/**
 * Temporary endpoint to pin brand headlines to position 1 on RSAs.
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

interface RSAHeadline {
  text: string;
  pinnedField?: string;
}

interface RSADescription {
  text: string;
  pinnedField?: string;
}

async function updateAdPins(
  customerId: string,
  loginCustomerId: string,
  accessToken: string,
  adGroupAdResourceName: string,
  headlines: RSAHeadline[],
  descriptions: RSADescription[],
  finalUrl: string,
  brandHeadlineText: string,
) {
  // Set pin on brand headline
  const updatedHeadlines = headlines.map(h => {
    if (h.text === brandHeadlineText) {
      return { text: h.text, pinnedField: 'HEADLINE_1' };
    }
    return { text: h.text };
  });

  const updatedDescriptions = descriptions.map(d => ({ text: d.text }));

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${customerId}/adGroupAds:mutate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{
          update: {
            resourceName: adGroupAdResourceName,
            ad: {
              resourceName: adGroupAdResourceName.replace(/adGroupAds\/\d+~/, 'ads/'),
              responsiveSearchAd: {
                headlines: updatedHeadlines,
                descriptions: updatedDescriptions,
              },
              finalUrls: [finalUrl],
            },
          },
          updateMask: 'ad.responsive_search_ad.headlines,ad.responsive_search_ad.descriptions,ad.final_urls',
        }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { error };
  }

  return await response.json();
}

export async function POST() {
  try {
    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId).replace(/-/g, '');
    const accessToken = await getAccessToken();

    // Pre-Retiree Planning ad
    const preRetireeResult = await updateAdPins(
      customerId, loginCustomerId, accessToken,
      'customers/9110037605/adGroupAds/196485118511~798265610296',
      [
        { text: 'ArcVest: Plan Retirement' },
        { text: 'Master Retirement Tips' },
        { text: 'Social Security Basics' },
        { text: 'Get Your Retirement Plan' },
        { text: 'Fee-Only Advisor Benefits' },
        { text: '401k Rollover Advice' },
        { text: 'Tax-Smart Withdrawals' },
        { text: 'Retire With Confidence?' },
        { text: 'Fiduciary Planning Help' },
        { text: 'Healthcare Cost Insights' },
        { text: 'What Retirement Means' },
        { text: 'Avoid Commission Conflicts' },
        { text: 'Income Strategy Insights' },
        { text: 'Know Your Retirement Age' },
        { text: 'Free Consultation Booking' },
      ],
      [
        { text: 'Learn value of fee-only advice. Get your personal roadmap today.' },
        { text: 'Understand Social Security timing for income. Access free resources.' },
        { text: 'Build confidence with evidence-based plans. No conflicts of interest.' },
        { text: 'Get tax-efficient withdrawal tips from fiduciary experts. Start today.' },
      ],
      'https://arcvest.com/',
      'ArcVest: Plan Retirement',
    );

    // HNW Fee-Conscious ad
    const hnwResult = await updateAdPins(
      customerId, loginCustomerId, accessToken,
      'customers/9110037605/adGroupAds/199292097331~798342546128',
      [
        { text: 'ArcVest Wealth Mgmt' },
        { text: 'Say No to Hidden Fees' },
        { text: 'Fee-Only Fiduciary' },
        { text: 'Your Wealth, Your Way' },
        { text: 'Top Net Worth Advisors' },
        { text: 'No Conflicts Ever' },
        { text: 'Transparent Pricing' },
        { text: 'Institutional Advice' },
        { text: 'Optimize Your Taxes' },
        { text: 'Expert Estate Planning' },
        { text: 'Compare Fees Today' },
        { text: 'Get Started Now' },
        { text: 'Evidence-Based Advice' },
        { text: 'Start Your Legacy Now' },
        { text: 'Wealth Mgmt $2M+' },
      ],
      [
        { text: 'Stop overpaying with conflicted advisors. Choose ArcVest fee-only advice.' },
        { text: 'ArcVest: Transparent pricing, no hidden fees. Get your consultation today.' },
        { text: 'Get top-tier fiduciary advice with ArcVest. Compare fees now.' },
        { text: 'ArcVest fee-only fiduciaries for $2M+ wealth. Start your consultation.' },
      ],
      'https://arcvest.com/',
      'ArcVest Wealth Mgmt',
    );

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
