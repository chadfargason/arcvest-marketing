const fs = require('fs');
const path = require('path');

// Load .env.local
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
  console.log('\n=== Google Ads API Diagnostics ===\n');
  console.log('Customer ID:', env['GOOGLE_ADS_CUSTOMER_ID']);
  console.log('Developer Token:', env['GOOGLE_ADS_DEVELOPER_TOKEN'] ? 'set' : 'MISSING');

  // Step 1: Get access token
  console.log('\n1. Refreshing OAuth token...');
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
    console.error('Token refresh failed:', tokenData.error_description || tokenData.error);
    return;
  }
  console.log('   Access token obtained. Scopes:', tokenData.scope);

  const headers = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // Step 2: List accessible customers (no customer ID needed)
  console.log('\n2. Listing accessible customer accounts...');
  const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
    headers: headers,
  });
  const listData = await listRes.json();
  if (listData.error) {
    console.error('   Error:', JSON.stringify(listData.error, null, 2));
    return;
  }
  console.log('   Accessible accounts:', JSON.stringify(listData.resourceNames, null, 2));

  // Step 3: Try to get details for each accessible customer
  console.log('\n3. Getting account details...');
  for (const resourceName of listData.resourceNames || []) {
    const custId = resourceName.replace('customers/', '');
    console.log('\n   --- Customer:', custId, '---');

    // Try without login-customer-id first
    const queryRes = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + custId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': custId },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code FROM customer LIMIT 1'
        }),
      }
    );
    const queryData = await queryRes.json();
    if (queryData.error) {
      console.log('   Error:', queryData.error.message);

      // If it's a manager, try listing its child accounts
      const childRes = await fetch(
        'https://googleads.googleapis.com/v23/customers/' + custId + '/googleAds:searchStream',
        {
          method: 'POST',
          headers: { ...headers, 'login-customer-id': custId },
          body: JSON.stringify({
            query: 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1'
          }),
        }
      );
      const childData = await childRes.json();
      if (!childData.error && Array.isArray(childData)) {
        for (const chunk of childData) {
          for (const result of chunk.results || []) {
            const cc = result.customerClient;
            console.log('   Child account:', cc.id, '-', cc.descriptiveName, cc.manager ? '(MANAGER)' : '(client)');
          }
        }
      }
    } else if (Array.isArray(queryData)) {
      for (const chunk of queryData) {
        for (const result of chunk.results || []) {
          const c = result.customer;
          console.log('   Name:', c.descriptiveName);
          console.log('   Manager:', c.manager ? 'YES' : 'no');
          console.log('   Currency:', c.currencyCode);
        }
      }
    }
  }

  // Step 4: Try the target customer ID with each accessible account as login-customer-id
  const targetId = env['GOOGLE_ADS_CUSTOMER_ID'].replace(/-/g, '');
  console.log('\n4. Testing access to target customer', targetId, 'with each account as login-customer-id...');

  for (const resourceName of listData.resourceNames || []) {
    const loginId = resourceName.replace('customers/', '');
    const testRes = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': loginId },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1'
        }),
      }
    );
    const testData = await testRes.json();
    if (testData.error) {
      console.log('   login-customer-id=' + loginId + ': FAILED -', testData.error.message.substring(0, 60));
    } else {
      console.log('   login-customer-id=' + loginId + ': SUCCESS!');
      console.log('   >>> Set GOOGLE_ADS_LOGIN_CUSTOMER_ID=' + loginId);
    }
  }

  console.log('\nDone!\n');
}

main().catch(err => console.error('Fatal error:', err));
