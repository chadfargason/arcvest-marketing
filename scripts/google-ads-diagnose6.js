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
  console.log('=== Diagnostic v6: New Token Check ===\n');

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
  console.log('Scopes:', tokenData.scope);

  // Check token identity
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + tokenData.access_token);
  const info = await infoRes.json();
  console.log('Token email:', info.email || '(not available)');
  console.log('Token user_id:', info.user_id || '(not available)');
  console.log('Issued to client:', info.issued_to || '(not available)');

  const headers = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // List accessible customers
  console.log('\nAccessible customers:');
  const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
    headers,
  });
  const listData = await listRes.json();
  console.log(JSON.stringify(listData, null, 2));

  const customerIds = (listData.resourceNames || []).map(function(r) { return r.replace('customers/', ''); });
  console.log('\nCustomer IDs:', customerIds);

  // Test each accessible customer
  for (const cid of customerIds) {
    console.log('\n--- Testing customer', cid, '---');
    const r = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + cid + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': cid },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1'
        }),
      }
    );
    console.log('HTTP:', r.status);
    const text = await r.text();
    try {
      const parsed = JSON.parse(text);
      if (r.ok && Array.isArray(parsed)) {
        for (const chunk of parsed) {
          for (const result of chunk.results || []) {
            console.log('  Name:', result.customer.descriptiveName);
            console.log('  Manager:', result.customer.manager ? 'YES' : 'no');
            console.log('  ID:', result.customer.id);
          }
        }
        // If manager, list children
        const custData = parsed[0]?.results?.[0]?.customer;
        if (custData && custData.manager) {
          console.log('  Listing child accounts...');
          const childRes = await fetch(
            'https://googleads.googleapis.com/v23/customers/' + cid + '/googleAds:searchStream',
            {
              method: 'POST',
              headers: { ...headers, 'login-customer-id': cid },
              body: JSON.stringify({
                query: 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client'
              }),
            }
          );
          if (childRes.ok) {
            const childData = await childRes.json();
            for (const chunk of childData) {
              for (const result of chunk.results || []) {
                const cc = result.customerClient;
                console.log('    Child:', cc.id, '-', cc.descriptiveName, cc.manager ? '(MANAGER)' : '(client)', 'level=' + cc.level);
              }
            }
          }
        }
      } else {
        const err = parsed[0]?.error?.details?.[0]?.errors?.[0];
        if (err) {
          console.log('  Error:', Object.values(err.errorCode)[0], '-', err.message.substring(0, 100));
        } else {
          console.log('  Response:', JSON.stringify(parsed).substring(0, 200));
        }
      }
    } catch(e) {
      console.log('  Parse error:', e.message);
    }
  }

  // Also try accessing target 9110037605 via each accessible customer
  console.log('\n--- Target 9110037605 via each accessible customer ---');
  for (const loginId of customerIds) {
    const r = await fetch(
      'https://googleads.googleapis.com/v23/customers/9110037605/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': loginId },
        body: JSON.stringify({
          query: "SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 3"
        }),
      }
    );
    console.log('login=' + loginId + ': HTTP', r.status);
    if (r.ok) {
      const data = await r.json();
      for (const chunk of data) {
        for (const result of chunk.results || []) {
          console.log('  Campaign:', result.campaign.id, '-', result.campaign.name);
        }
      }
    } else {
      const data = await r.json();
      const err = data[0]?.error?.details?.[0]?.errors?.[0];
      if (err) console.log('  Error:', Object.values(err.errorCode)[0]);
    }
  }

  console.log('\nDone!');
}

main().catch(function(err) { console.error('Fatal:', err); });
