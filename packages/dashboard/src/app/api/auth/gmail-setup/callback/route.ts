import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/auth/gmail-setup/callback - Exchange code for Gmail tokens
 *
 * This callback receives the authorization code from Google OAuth,
 * exchanges it for access/refresh tokens, and stores them in the database.
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

  // Use GMAIL_CLIENT_ID/SECRET (same as GmailService uses for token refresh)
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body><h1>Error: Gmail OAuth credentials not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)</h1></body></html>`,
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

    if (!tokens.refresh_token) {
      return new NextResponse(
        `<html>
          <head>
            <title>Gmail OAuth - No Refresh Token</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              h1 { color: #f59e0b; }
              .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
              code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>No Refresh Token Received</h1>
            <div class="warning">
              <strong>This happens if you've already authorized this app before.</strong>
              <br><br>
              To get a new refresh token:
              <ol>
                <li>Go to <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a></li>
                <li>Find and remove the Gmail/Google app access for this application</li>
                <li><a href="/api/auth/gmail-setup">Restart OAuth Flow</a></li>
              </ol>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Store tokens in database (same format GmailService expects)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new NextResponse(
        `<html><body><h1>Error: Supabase not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY)</h1></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error: dbError } = await supabase.from('system_state').upsert({
      key: 'gmail_tokens',
      value: JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        scope: tokens.scope,
      }),
    });

    if (dbError) {
      return new NextResponse(
        `<html><body>
          <h1>Database Error</h1>
          <p>Failed to store tokens: ${dbError.message}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Success page
    return new NextResponse(
      `<html>
        <head>
          <title>Gmail OAuth Setup Complete</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #22c55e; }
            .success { background: #dcfce7; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .info { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Gmail OAuth Setup Complete!</h1>

          <div class="success">
            <strong>Success!</strong> Gmail tokens have been saved to the database automatically.
            <br><br>
            The Gmail integration is now ready to use. No additional configuration needed.
          </div>

          <div class="info">
            <strong>Token Details:</strong>
            <ul>
              <li><strong>Scope:</strong> ${tokens.scope || 'N/A'}</li>
              <li><strong>Expires:</strong> ${expiresAt.toLocaleString()}</li>
              <li><strong>Token Type:</strong> ${tokens.token_type || 'N/A'}</li>
            </ul>
          </div>

          <p>The system will automatically refresh the access token when needed using the stored refresh token.</p>

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
