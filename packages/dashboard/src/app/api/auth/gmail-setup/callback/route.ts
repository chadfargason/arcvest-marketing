import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/gmail-setup/callback - Exchange code for Gmail tokens
 *
 * This callback receives the authorization code from Google OAuth,
 * exchanges it for access/refresh tokens, and displays them for the
 * user to copy into Vercel environment variables.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return new NextResponse(
      `<html><body>
        <h1>OAuth Error</h1>
        <p>${error}</p>
        <p>${request.nextUrl.searchParams.get('error_description') || ''}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code) {
    return new NextResponse(
      `<html><body><h1>Error: No authorization code received</h1></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body><h1>Error: OAuth credentials not configured</h1></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Determine the redirect URI (must match what was used in the auth request)
  const host = request.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/gmail-setup/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return new NextResponse(
        `<html><body>
          <h1>Token Exchange Error</h1>
          <p>${tokens.error}: ${tokens.error_description || ''}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Display the refresh token for the user to copy
    return new NextResponse(
      `<html>
        <head>
          <title>Gmail OAuth Setup Complete</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #22c55e; }
            .token-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 8px;
              word-break: break-all;
              margin: 10px 0;
              font-family: monospace;
              font-size: 14px;
            }
            .copy-btn {
              background: #3b82f6;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              margin-top: 10px;
            }
            .copy-btn:hover { background: #2563eb; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .success { background: #dcfce7; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin: 20px 0; }
            code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
            .steps { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .steps ol { margin: 10px 0; padding-left: 20px; }
            .steps li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <h1>Gmail OAuth Setup Complete!</h1>

          <div class="success">
            <strong>Success!</strong> Gmail authorization completed. Copy the refresh token below.
          </div>

          <h3>GOOGLE_REFRESH_TOKEN</h3>
          <div class="token-box" id="refresh-token">${tokens.refresh_token || 'No refresh token returned - see note below'}</div>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('refresh-token').innerText); this.innerText='Copied!'">Copy Token</button>

          ${!tokens.refresh_token ? `
          <div class="warning">
            <strong>No refresh token?</strong> This happens if you've already authorized this app before.
            <br><br>
            To get a new refresh token:
            <ol>
              <li>Go to <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a></li>
              <li>Find and remove "ArcVest Marketing Dashboard" (or your app name)</li>
              <li>Return here and try again: <a href="/api/auth/gmail-setup">Restart OAuth Flow</a></li>
            </ol>
          </div>
          ` : ''}

          <div class="steps">
            <strong>Next Steps:</strong>
            <ol>
              <li>Copy the refresh token above</li>
              <li>Go to <a href="https://vercel.com/chadfargasons-projects/arcvest-marketing/settings/environment-variables" target="_blank">Vercel Environment Variables</a></li>
              <li>Update <code>GOOGLE_REFRESH_TOKEN</code> with the new value</li>
              <li>Redeploy the project for changes to take effect</li>
            </ol>
          </div>

          <div class="warning">
            <strong>Important:</strong> Copy this token now! It won't be shown again.
          </div>

          <h3>Token Details (for reference):</h3>
          <p><strong>Access Token:</strong> (expires in ${tokens.expires_in} seconds)</p>
          <div class="token-box" style="font-size: 11px; max-height: 100px; overflow: auto;">${tokens.access_token || 'N/A'}</div>

          <p><strong>Scope:</strong> ${tokens.scope || 'N/A'}</p>
          <p><strong>Token Type:</strong> ${tokens.token_type || 'N/A'}</p>

          <br>
          <a href="/dashboard">← Back to Dashboard</a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err) {
    return new NextResponse(
      `<html><body>
        <h1>Error exchanging token</h1>
        <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
