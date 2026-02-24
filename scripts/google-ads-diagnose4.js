const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});

async function main() {
  console.log('=== Google Ads Diagnostic v4 ===\n');

  // Get token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env['GOOGLE_CLIENT_ID'],
      client_secret: env['GOOGLE_CLIENT_SECRET'],
      refresh_token: env['GOOGLE_REFRESH_TOKEN'],
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error('Token refresh failed:', tokenData.error_description);
    return;
  }

  // Get token info to see email
  const tokenInfoRes = await fetch(
    'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + tokenData.access_token
  );
  const tokenInfo = await tokenInfoRes.json();
  console.log('Token owner email:', tokenInfo.email);
  console.log('Token scopes:', tokenData.scope);
  console.log('Developer token:', env['GOOGLE_ADS_DEVELOPER_TOKEN']);
  console.log('Target customer ID:', env['GOOGLE_ADS_CUSTOMER_ID']);
  console.log('Login customer ID:', env['GOOGLE_ADS_LOGIN_CUSTOMER_ID']);

  const baseHeaders = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // Accessible customers
  console.log('\n--- Accessible customers ---');
  const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
    headers: baseHeaders,
  });
  const listData = await listRes.json();
  const customerIds = (listData.resourceNames || []).map(r => r.replace('customers/', ''));
  console.log('Accounts:', customerIds.join(', '));

  // Try every combination: each accessible as target, each accessible as login
  // Plus the configured target
  const allIds = [...new Set([...customerIds, (env['GOOGLE_ADS_CUSTOMER_ID'] || '').replace(/-/g, '')])];

  console.log('\n--- Testing all combinations ---');
  for (const targetId of allIds) {
    for (const loginId of allIds) {
      const r = await fetch(
        'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
        {
          method: 'POST',
          headers: { ...baseHeaders, 'login-customer-id': loginId },
          body: JSON.stringify({
            query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1'
          }),
        }
      );
      const status = r.status;
      let result;
      const text = await r.text();
      try {
        const parsed = JSON.parse(text);
        if (status === 200 && Array.isArray(parsed)) {
          const cust = parsed[0]?.results?.[0]?.customer;
          result = 'OK - ' + (cust ? cust.descriptiveName + ' (' + cust.id + ')' : 'no results');
        } else if (parsed[0]?.error) {
          const errCode = parsed[0].error.details?.[0]?.errors?.[0]?.errorCode;
          result = Object.values(errCode || {})[0] || parsed[0].error.message;
        } else {
          result = 'HTTP ' + status;
        }
      } catch(e) {
        result = 'HTTP ' + status + ' (non-JSON)';
      }
      console.log('  target=' + targetId + ' login=' + loginId + ': ' + result);
    }
    // Also try without login-customer-id
    const r2 = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1'
        }),
      }
    );
    const text2 = await r2.text();
    let result2;
    try {
      const parsed2 = JSON.parse(text2);
      if (r2.status === 200 && Array.isArray(parsed2)) {
        const cust = parsed2[0]?.results?.[0]?.customer;
        result2 = 'OK - ' + (cust ? cust.descriptiveName + ' (' + cust.id + ')' : 'no results');
      } else if (parsed2[0]?.error) {
        const errCode = parsed2[0].error.details?.[0]?.errors?.[0]?.errorCode;
        result2 = Object.values(errCode || {})[0] || parsed2[0].error.message;
      } else {
        result2 = 'HTTP ' + r2.status;
      }
    } catch(e) {
      result2 = 'HTTP ' + r2.status + ' (non-JSON)';
    }
    console.log('  target=' + targetId + ' login=(none): ' + result2);
  }

  console.log('\nDone!');
}

main().catch(err => console.error('Fatal:', err));
