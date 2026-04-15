#!/usr/bin/env node
/**
 * One-shot OAuth helper for YouTube Data + Analytics APIs.
 *
 * Starts a localhost server on :3939, prints the Google auth URL, waits for
 * the redirect, exchanges the code for a refresh token, prints it.
 *
 * Scopes requested:
 *   - youtube.readonly         (channel/video metadata)
 *   - yt-analytics.readonly    (subscribers gained, watch time, sources)
 *
 * Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in env (.env.local).
 */

const http = require('node:http');
const { URL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

// Load .env.local manually (no dotenv dependency required).
// Tries parent dir (repo layout) then CWD (standalone use).
for (const p of [path.resolve(__dirname, '..', '.env.local'), path.resolve(process.cwd(), '.env.local')]) {
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
    break;
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3939/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: SCOPES,
  }).toString();

console.log('\n=== YouTube OAuth Helper ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in with the Google account that owns/manages the @ArcVest YouTube channel.');
console.log('3. Click "Advanced" → "Go to arcvest-marketing (unsafe)" if you see a warning (app is unverified).');
console.log('4. Click "Allow" on the scope consent screen.');
console.log('\nListening on http://localhost:3939 …\n');

// Try to open the browser automatically (Windows)
const opener =
  process.platform === 'win32' ? 'start ""' :
  process.platform === 'darwin' ? 'open' : 'xdg-open';
exec(`${opener} "${authUrl}"`, () => {});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const u = new URL(req.url, 'http://localhost:3939');
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>Auth error: ${err}</h2><p>You can close this window.</p>`);
    console.error('OAuth error:', err);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400); res.end('no code'); return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h2>No refresh token returned.</h2><p>Check terminal for details.</p>');
      console.error('Token exchange failed:', tokens);
      server.close(); process.exit(1);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body style="font-family: system-ui; padding: 40px">
        <h2 style="color: #2e7d32">Success</h2>
        <p>Refresh token captured. You can close this window and return to the terminal.</p>
      </body></html>
    `);

    console.log('\n=== SUCCESS ===\n');
    console.log('Scopes granted:');
    console.log('  ' + (tokens.scope || '(none returned)').split(' ').join('\n  '));
    console.log('\nRefresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\nAdd this to .env.local:\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n(The helper will NOT auto-write it — copy/paste manually to be safe.)\n');

    server.close();
    process.exit(0);
  } catch (e) {
    console.error('Token exchange error:', e);
    res.writeHead(500); res.end('token exchange failed');
    server.close(); process.exit(1);
  }
});

server.listen(3939, '127.0.0.1');
