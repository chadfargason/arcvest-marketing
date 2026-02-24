/**
 * Temporary diagnostic endpoint to check Google Ads landing page URLs and quality scores.
 * DELETE THIS AFTER USE.
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

async function runQuery(query: string, customerId: string, loginCustomerId: string, accessToken: string) {
  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { error };
  }

  const results = await response.json();
  const combined: unknown[] = [];
  if (Array.isArray(results)) {
    for (const chunk of results) {
      if (chunk.results) combined.push(...chunk.results);
    }
  }
  return combined;
}

export async function GET() {
  try {
    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId).replace(/-/g, '');
    const accessToken = await getAccessToken();

    // Query 1: Ad final URLs (landing pages)
    const adsQuery = `
      SELECT
        campaign.name,
        campaign.status,
        ad_group.name,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.type,
        ad_group_ad.status
      FROM ad_group_ad
      WHERE campaign.status != 'REMOVED'
        AND ad_group_ad.status != 'REMOVED'
    `;

    // Query 2: Keyword quality scores
    const keywordQuery = `
      SELECT
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        ad_group_criterion.status
      FROM keyword_view
      WHERE campaign.status != 'REMOVED'
        AND ad_group_criterion.status != 'REMOVED'
    `;

    const [adsResults, keywordResults] = await Promise.all([
      runQuery(adsQuery, customerId, loginCustomerId, accessToken),
      runQuery(keywordQuery, customerId, loginCustomerId, accessToken),
    ]);

    return NextResponse.json({
      ads: adsResults,
      keywords: keywordResults,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
