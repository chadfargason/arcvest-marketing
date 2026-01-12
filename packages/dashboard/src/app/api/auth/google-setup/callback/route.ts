import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/google-setup/callback - Exchange code for tokens
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
  const redirectUri = `${protocol}://${host}/api/auth/google-setup/callback`;

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
          <title>OAuth Setup Complete</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #22c55e; }
            .token-box { background: #f3f4f6; padding: 15px; border-radius: 8px; word-break: break-all; margin: 10px 0; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
            code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>OAuth Setup Complete!</h1>
          <p>Add this refresh token to your Vercel environment variables:</p>

          <h3>GOOGLE_REFRESH_TOKEN</h3>
          <div class="token-box">${tokens.refresh_token || 'No refresh token returned - you may have already authorized this app. Try revoking access at myaccount.google.com/permissions and try again.'}</div>

          <div class="warning">
            <strong>Important:</strong> Copy this token now! It won't be shown again.
            <br><br>
            Add it to Vercel: Project Settings → Environment Variables → Add <code>GOOGLE_REFRESH_TOKEN</code>
          </div>

          <h3>Other tokens (for reference):</h3>
          <p><strong>Access Token:</strong> (expires in ${tokens.expires_in} seconds)</p>
          <div class="token-box" style="font-size: 12px;">${tokens.access_token || 'N/A'}</div>

          <p><strong>Scope:</strong> ${tokens.scope || 'N/A'}</p>

          <br>
          <a href="/dashboard/analytics">← Go to Analytics Dashboard</a>
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
