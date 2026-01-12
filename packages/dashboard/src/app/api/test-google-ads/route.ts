import { NextResponse } from 'next/server';

// GET /api/test-google-ads - Test Google Ads API connection
export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    config: {},
    tokenRefresh: {},
    apiTest: {},
  };

  // Check configuration
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  results.config = {
    hasCustomerId: !!customerId,
    customerIdValue: customerId ? `${customerId.substring(0, 4)}...` : null,
    hasDeveloperToken: !!developerToken,
    developerTokenPrefix: developerToken ? `${developerToken.substring(0, 6)}...` : null,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
  };

  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    results.error = 'Missing required configuration';
    return NextResponse.json(results);
  }

  // Test token refresh
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      results.tokenRefresh = {
        success: false,
        error: tokenData.error,
        errorDescription: tokenData.error_description,
      };
      return NextResponse.json(results);
    }

    results.tokenRefresh = {
      success: true,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    };

    const accessToken = tokenData.access_token;

    // Test Google Ads API - simple query
    const cleanCustomerId = customerId.replace(/-/g, '');

    // Try a simple account query first
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const adsResponse = await fetch(
      `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    const adsResponseText = await adsResponse.text();

    const apiTestBase = {
      status: adsResponse.status,
      statusText: adsResponse.statusText,
      headers: Object.fromEntries(adsResponse.headers.entries()),
    };

    try {
      const adsData = JSON.parse(adsResponseText);
      results.apiTest = {
        ...apiTestBase,
        success: adsResponse.ok,
        data: adsData,
      };
    } catch {
      results.apiTest = {
        ...apiTestBase,
        success: false,
        rawResponse: adsResponseText.substring(0, 1000),
      };
    }

    // If first query worked, try getting campaigns
    if (adsResponse.ok) {
      const campaignQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        LIMIT 10
      `;

      const campaignResponse = await fetch(
        `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: campaignQuery }),
        }
      );

      const campaignText = await campaignResponse.text();

      try {
        const campaignData = JSON.parse(campaignText);
        results.campaigns = {
          success: campaignResponse.ok,
          data: campaignData,
        };
      } catch {
        results.campaigns = {
          success: false,
          rawResponse: campaignText.substring(0, 1000),
        };
      }
    }

  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return NextResponse.json(results, { status: 200 });
}
