/**
 * Google OAuth Callback
 *
 * GET: Handle OAuth callback from Google and exchange code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle error from Google
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=no_code', request.url)
    );
  }

  // Validate state parameter (optional but recommended)
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());

      // Check if state is not too old (15 minutes max)
      if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
        return NextResponse.redirect(
          new URL('/dashboard/settings?error=state_expired', request.url)
        );
      }
    } catch {
      console.warn('Failed to validate state parameter');
    }
  }

  try {
    const gmailService = new GmailService();
    await gmailService.exchangeCodeForTokens(code);

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL('/dashboard/settings?gmail_connected=true', request.url)
    );
  } catch (error) {
    console.error('Failed to exchange OAuth code:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=token_exchange_failed', request.url)
    );
  }
}
