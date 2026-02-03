import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/gmail-setup - Start OAuth flow to get Gmail refresh token
 *
 * This endpoint initiates the Google OAuth flow with Gmail-specific scopes.
 * After authorization, the callback will display the refresh token to copy
 * into Vercel environment variables.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Use GMAIL_CLIENT_ID (same as GmailService uses for token refresh)
  const clientId = process.env.GMAIL_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: 'GMAIL_CLIENT_ID not configured' }, { status: 500 });
  }

  // Determine the redirect URI based on environment
  const host = request.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/gmail-setup/callback`;

  // Gmail scopes for reading and sending emails
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ];

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

  return NextResponse.redirect(authUrl.toString());
}
