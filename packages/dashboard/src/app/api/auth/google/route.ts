/**
 * Google OAuth Authorization
 *
 * GET: Redirect to Google OAuth for Gmail authorization
 */

import { NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gmailService = new GmailService();

  // Generate a state parameter for security
  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    purpose: 'gmail_auth',
  })).toString('base64');

  const authUrl = gmailService.getAuthorizationUrl(state);

  return NextResponse.redirect(authUrl);
}
