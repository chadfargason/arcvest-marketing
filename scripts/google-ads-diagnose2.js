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
  console.log('\n=== Google Ads Diagnostics v2 ===\n');

  // Get access token
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
  console.log('Token scopes:', tokenData.scope);

  const baseHeaders = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // List accessible customers
  console.log('\n1. Accessible customers:');
  const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
    headers: baseHeaders,
  });
  const listData = await listRes.json();
  console.log('   ', JSON.stringify(listData));

  const customerIds = (listData.resourceNames || []).map(r => r.replace('customers/', ''));

  // For each accessible customer, try to get info and list children
  for (const custId of customerIds) {
    console.log('\n2. Querying customer', custId, ':');

    // Try querying with this customer as both target and login
    const res = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + custId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...baseHeaders, 'login-customer-id': custId },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1'
        }),
      }
    );
    console.log('   HTTP status:', res.status);
    const data = await res.json();

    if (res.ok && Array.isArray(data)) {
      for (const chunk of data) {
        for (const result of chunk.results || []) {
          console.log('   Name:', result.customer.descriptiveName);
          console.log('   Manager account:', result.customer.manager ? 'YES' : 'no');
          console.log('   ID:', result.customer.id);
        }
      }

      // If manager, list children
      console.log('\n3. Listing child accounts:');
      const childRes = await fetch(
        'https://googleads.googleapis.com/v23/customers/' + custId + '/googleAds:searchStream',
        {
          method: 'POST',
          headers: { ...baseHeaders, 'login-customer-id': custId },
          body: JSON.stringify({
            query: 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client'
          }),
        }
      );
      console.log('   HTTP status:', childRes.status);
      const childData = await childRes.json();
      if (childRes.ok && Array.isArray(childData)) {
        for (const chunk of childData) {
          for (const result of chunk.results || []) {
            const cc = result.customerClient;
            console.log('   -', cc.id, cc.descriptiveName, cc.manager ? '(MANAGER)' : '(client)', 'level=' + cc.level);
          }
        }
      } else {
        console.log('   Error:', JSON.stringify(childData).substring(0, 200));
      }
    } else {
      console.log('   Error:', JSON.stringify(data).substring(0, 300));
    }
  }

  // Try the target customer with each accessible customer as login
  const targetId = (env['GOOGLE_ADS_CUSTOMER_ID'] || '').replace(/-/g, '');
  console.log('\n4. Testing target customer', targetId, ':');

  for (const loginId of customerIds) {
    const res = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...baseHeaders, 'login-customer-id': loginId },
        body: JSON.stringify({
          query: 'SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != \'REMOVED\' LIMIT 3'
        }),
      }
    );
    console.log('   login-customer-id=' + loginId + ': HTTP', res.status);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      for (const chunk of data) {
        for (const result of chunk.results || []) {
          console.log('     Campaign:', result.campaign.id, '-', result.campaign.name);
        }
      }
      if (!data.some(c => c.results && c.results.length > 0)) {
        console.log('     (no campaigns found)');
      }
    } else {
      const errMsg = JSON.stringify(data).substring(0, 200);
      console.log('     Error:', errMsg);
    }
  }

  // Also try target customer as its own login-customer-id
  console.log('\n   Also trying target as its own login:');
  const selfRes = await fetch(
    'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
    {
      method: 'POST',
      headers: { ...baseHeaders, 'login-customer-id': targetId },
      body: JSON.stringify({
        query: 'SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != \'REMOVED\' LIMIT 3'
      }),
    }
  );
  console.log('   login-customer-id=' + targetId + ': HTTP', selfRes.status);
  const selfData = await selfRes.json();
  if (selfRes.ok) {
    console.log('   Data:', JSON.stringify(selfData).substring(0, 300));
  } else {
    console.log('   Error:', JSON.stringify(selfData).substring(0, 200));
  }

  console.log('\nDone!');
}

main().catch(err => console.error('Fatal:', err));
