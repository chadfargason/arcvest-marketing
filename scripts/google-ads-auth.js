const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
console.log('Reading env from:', envPath);

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim();
    env[key] = val;
  }
});

const CLIENT_ID = env['GOOGLE_CLIENT_ID'];
const CLIENT_SECRET = env['GOOGLE_CLIENT_SECRET'];

console.log('CLIENT_ID found:', CLIENT_ID ? 'yes (' + CLIENT_ID.substring(0, 20) + '...)' : 'NO!');
console.log('CLIENT_SECRET found:', CLIENT_SECRET ? 'yes' : 'NO!');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nERROR: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const PORT = 3000;
const REDIRECT_URI = 'http://localhost:' + PORT + '/api/auth/google/callback';
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/webmasters.readonly';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
  + '?client_id=' + encodeURIComponent(CLIENT_ID)
  + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
  + '&response_type=code'
  + '&scope=' + encodeURIComponent(SCOPES)
  + '&access_type=offline'
  + '&prompt=consent';

console.log('\n=== Google Ads OAuth Setup ===\n');
console.log('Redirect URI:', REDIRECT_URI);
console.log('\nOpen this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for authorization callback...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);

  if (url.pathname === '/api/auth/google/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorization Failed</h1><p>Error: ' + error + '</p>');
      console.error('Authorization failed:', error);
      server.close();
      process.exit(1);
    }

    if (code) {
      console.log('Authorization code received! Exchanging for tokens...\n');

      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
          }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
          throw new Error('Token exchange failed: ' + (tokens.error_description || tokens.error));
        }

        console.log('=== SUCCESS! ===\n');
        console.log('Refresh Token:', tokens.refresh_token);
        console.log('Scopes:', tokens.scope);
        console.log('');

        if (tokens.refresh_token) {
          let envFileContent = fs.readFileSync(envPath, 'utf-8');
          if (envFileContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envFileContent = envFileContent.replace(
              /GOOGLE_REFRESH_TOKEN=.*/,
              'GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token
            );
          } else {
            envFileContent += '\nGOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n';
          }
          fs.writeFileSync(envPath, envFileContent);
          console.log('.env.local updated with new GOOGLE_REFRESH_TOKEN\n');
          console.log('NOW UPDATE VERCEL:');
          console.log('  GOOGLE_REFRESH_TOKEN = ' + tokens.refresh_token);
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1 style="color:green">Success!</h1><p>Refresh token saved. Check your terminal.</p>');
      } catch (err) {
        console.error('Token exchange failed:', err.message);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Failed</h1><p>' + err.message + '</p>');
      }

      setTimeout(function() { server.close(); process.exit(0); }, 1000);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, function() {
  console.log('Local server listening on port ' + PORT);
  var exec = require('child_process').exec;
  exec('start "" "' + authUrl + '"');
});
