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
  console.log('=== Testing with MCC 2634061148 ===\n');

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
  console.log('Token OK. Scopes:', tokenData.scope);

  const baseHeaders = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // Test 1: Query MCC 2634061148 with itself as login
  console.log('\n1. MCC 2634061148 info:');
  const r1 = await fetch(
    'https://googleads.googleapis.com/v23/customers/2634061148/googleAds:searchStream',
    {
      method: 'POST',
      headers: { ...baseHeaders, 'login-customer-id': '2634061148' },
      body: JSON.stringify({
        query: 'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1'
      }),
    }
  );
  console.log('   HTTP:', r1.status);
  const t1 = await r1.text();
  try {
    const p1 = JSON.parse(t1);
    if (r1.ok && Array.isArray(p1)) {
      for (const chunk of p1) {
        for (const result of chunk.results || []) {
          console.log('   Name:', result.customer.descriptiveName);
          console.log('   Manager:', result.customer.manager ? 'YES' : 'no');
          console.log('   ID:', result.customer.id);
        }
      }
    } else {
      const err = p1[0]?.error?.details?.[0]?.errors?.[0];
      console.log('   Error:', err ? JSON.stringify(err.errorCode) + ' - ' + err.message : JSON.stringify(p1).substring(0, 200));
    }
  } catch(e) { console.log('   ', t1.substring(0, 200)); }

  // Test 2: List child accounts under MCC 2634061148
  console.log('\n2. Child accounts under MCC 2634061148:');
  const r2 = await fetch(
    'https://googleads.googleapis.com/v23/customers/2634061148/googleAds:searchStream',
    {
      method: 'POST',
      headers: { ...baseHeaders, 'login-customer-id': '2634061148' },
      body: JSON.stringify({
        query: 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client'
      }),
    }
  );
  console.log('   HTTP:', r2.status);
  const t2 = await r2.text();
  try {
    const p2 = JSON.parse(t2);
    if (r2.ok && Array.isArray(p2)) {
      for (const chunk of p2) {
        for (const result of chunk.results || []) {
          const cc = result.customerClient;
          console.log('   -', cc.id, cc.descriptiveName, cc.manager ? '(MANAGER)' : '(client)', 'level=' + cc.level);
        }
      }
    } else {
      const err = p2[0]?.error?.details?.[0]?.errors?.[0];
      console.log('   Error:', err ? JSON.stringify(err.errorCode) + ' - ' + err.message : JSON.stringify(p2).substring(0, 200));
    }
  } catch(e) { console.log('   ', t2.substring(0, 200)); }

  // Test 3: Access target 9110037605 via MCC 2634061148
  console.log('\n3. Campaigns in 9110037605 via MCC 2634061148:');
  const r3 = await fetch(
    'https://googleads.googleapis.com/v23/customers/9110037605/googleAds:searchStream',
    {
      method: 'POST',
      headers: { ...baseHeaders, 'login-customer-id': '2634061148' },
      body: JSON.stringify({
        query: "SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 5"
      }),
    }
  );
  console.log('   HTTP:', r3.status);
  const t3 = await r3.text();
  try {
    const p3 = JSON.parse(t3);
    if (r3.ok && Array.isArray(p3)) {
      let found = false;
      for (const chunk of p3) {
        for (const result of chunk.results || []) {
          console.log('   Campaign:', result.campaign.id, '-', result.campaign.name, '(' + result.campaign.status + ')');
          found = true;
        }
      }
      if (!found) console.log('   (no campaigns)');
      console.log('\n   SUCCESS! This configuration works.');
    } else {
      const err = p3[0]?.error?.details?.[0]?.errors?.[0];
      console.log('   Error:', err ? JSON.stringify(err.errorCode) + ' - ' + err.message : JSON.stringify(p3).substring(0, 200));
    }
  } catch(e) { console.log('   ', t3.substring(0, 200)); }

  console.log('\nDone!');
}

main().catch(err => console.error('Fatal:', err));
