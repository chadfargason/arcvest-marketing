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

  // Check who the OAuth user is
  console.log('=== OAuth user info ===');
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
  });
  const userData = await userRes.json();
  console.log('Email:', userData.email);
  console.log('Name:', userData.name);
  console.log('Token scopes:', tokenData.scope);

  const headers = {
    'Authorization': 'Bearer ' + tokenData.access_token,
    'developer-token': env['GOOGLE_ADS_DEVELOPER_TOKEN'],
    'Content-Type': 'application/json',
  };

  // List accessible customers
  console.log('\n=== Accessible customers ===');
  const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
    headers,
  });
  const listData = await listRes.json();
  console.log(JSON.stringify(listData, null, 2));

  const customerIds = (listData.resourceNames || []).map(r => r.replace('customers/', ''));

  // Try each accessible customer
  for (const cid of customerIds) {
    console.log('\n=== Customer', cid, '===');
    const r = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + cid + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': cid },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name, customer.manager, customer.test_account FROM customer LIMIT 1'
        }),
      }
    );
    console.log('HTTP Status:', r.status);
    const t = await r.text();
    try {
      const parsed = JSON.parse(t);
      if (parsed[0] && parsed[0].error) {
        const detail = parsed[0].error.details && parsed[0].error.details[0];
        if (detail && detail.errors) {
          for (const err of detail.errors) {
            console.log('Error:', JSON.stringify(err.errorCode), '-', err.message);
          }
        }
      } else {
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch(e) {
      console.log(t.substring(0, 300));
    }

    // If this is the MCC, try listing child accounts
    if (cid === '6696765925') {
      console.log('\n  Trying to list child accounts of MCC...');
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
      console.log('  Child accounts HTTP Status:', childRes.status);
      const childText = await childRes.text();
      try {
        const childParsed = JSON.parse(childText);
        if (childParsed[0] && childParsed[0].error) {
          const detail = childParsed[0].error.details && childParsed[0].error.details[0];
          if (detail && detail.errors) {
            for (const err of detail.errors) {
              console.log('  Error:', JSON.stringify(err.errorCode), '-', err.message);
            }
          }
        } else {
          console.log(JSON.stringify(childParsed, null, 2));
        }
      } catch(e) {
        console.log(childText.substring(0, 300));
      }
    }
  }

  // Try target account with each accessible customer as login
  const targetId = (env['GOOGLE_ADS_CUSTOMER_ID'] || '').replace(/-/g, '');
  console.log('\n=== Target account', targetId, '===');
  for (const loginId of customerIds) {
    const r = await fetch(
      'https://googleads.googleapis.com/v23/customers/' + targetId + '/googleAds:searchStream',
      {
        method: 'POST',
        headers: { ...headers, 'login-customer-id': loginId },
        body: JSON.stringify({
          query: 'SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != \'REMOVED\' LIMIT 3'
        }),
      }
    );
    console.log('login-customer-id=' + loginId + ': HTTP', r.status);
    const t = await r.text();
    try {
      const parsed = JSON.parse(t);
      if (r.status === 200 && Array.isArray(parsed)) {
        for (const chunk of parsed) {
          for (const result of chunk.results || []) {
            console.log('  Campaign:', result.campaign.id, '-', result.campaign.name);
          }
        }
        if (!parsed.some(c => c.results && c.results.length > 0)) {
          console.log('  (no campaigns found)');
        }
      } else if (parsed[0] && parsed[0].error) {
        const detail = parsed[0].error.details && parsed[0].error.details[0];
        if (detail && detail.errors) {
          for (const err of detail.errors) {
            console.log('  Error:', JSON.stringify(err.errorCode), '-', err.message.substring(0, 100));
          }
        }
      }
    } catch(e) {
      console.log('  Response:', t.substring(0, 200));
    }
  }

  console.log('\nDone!');
}

main().catch(err => console.error('Fatal:', err));
