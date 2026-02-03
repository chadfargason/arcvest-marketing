/**
 * Gmail API Routes
 *
 * GET: Get Gmail connection status and profile
 * POST: Trigger manual sync
 * DELETE: Disconnect Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/gmail
 * Get Gmail connection status and profile
 */
export async function GET() {
  try {
    const gmailService = new GmailService();
    const isConnected = await gmailService.isConnected();

    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        profile: null,
      });
    }

    const profile = await gmailService.getProfile();

    return NextResponse.json({
      connected: true,
      profile: {
        email: profile.emailAddress,
        messagesTotal: profile.messagesTotal,
      },
    });
  } catch (error) {
    console.error('Failed to get Gmail status:', error);
    return NextResponse.json(
      { error: 'Failed to get Gmail status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gmail
 * Trigger manual Gmail sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const gmailService = new GmailService();

    if (action === 'sync') {
      const result = await gmailService.syncAndProcess();
      return NextResponse.json({
        success: true,
        result,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Gmail action failed:', error);
    return NextResponse.json(
      { error: 'Gmail action failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gmail
 * Disconnect Gmail integration
 */
export async function DELETE() {
  try {
    const gmailService = new GmailService();
    await gmailService.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnected',
    });
  } catch (error) {
    console.error('Failed to disconnect Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}
