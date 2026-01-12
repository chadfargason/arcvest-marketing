/**
 * Bloomberg Direct Test
 *
 * Bypasses BloombergProcessor to test Gmail service directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hoursBack') || '48');

    console.log('[Bloomberg Test] Starting direct test with hoursBack:', hoursBack);

    const gmailService = new GmailService();

    const isConnected = await gmailService.isConnected();
    console.log('[Bloomberg Test] Gmail connected:', isConnected);

    if (!isConnected) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    console.log('[Bloomberg Test] Calling fetchNewMessages with options:', {
      includeTrash: true,
      hoursBack,
      fromFilter: 'from:bloomberg.com',
    });

    const messages = await gmailService.fetchNewMessages(50, {
      includeTrash: true,
      hoursBack,
      fromFilter: 'from:bloomberg.com',
    });

    console.log('[Bloomberg Test] Got messages:', messages.length);

    return NextResponse.json({
      success: true,
      totalMessages: messages.length,
      messages: messages.map(m => ({
        from: m.from.email,
        fromName: m.from.name,
        subject: m.subject,
        date: m.date,
      })),
    });
  } catch (error) {
    console.error('[Bloomberg Test] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    );
  }
}
