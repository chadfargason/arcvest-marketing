/**
 * Bloomberg Debug API
 *
 * Shows what emails are being fetched to help debug Bloomberg detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hoursBack') || '72');

    const gmailService = new GmailService();

    const isConnected = await gmailService.isConnected();
    if (!isConnected) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    // Fetch Bloomberg emails directly using Gmail search
    const messages = await gmailService.fetchNewMessages(50, {
      includeTrash: true,
      hoursBack,
      fromFilter: 'from:bloomberg.com',
    });

    // Return summary of senders
    const senders = messages.map((msg) => ({
      from: msg.from.email,
      fromName: msg.from.name,
      subject: msg.subject.substring(0, 60),
      date: msg.date,
      labels: msg.labels,
    }));

    // Check for Bloomberg-like senders
    const bloombergPatterns = ['bloomberg', 'levine'];
    const possibleBloomberg = senders.filter(
      (s) =>
        bloombergPatterns.some(
          (p) =>
            s.from.toLowerCase().includes(p) ||
            (s.fromName?.toLowerCase() || '').includes(p) ||
            s.subject.toLowerCase().includes(p)
        )
    );

    return NextResponse.json({
      totalEmails: messages.length,
      hoursBack,
      possibleBloomberg,
      allSenders: senders.slice(0, 20), // First 20
    });
  } catch (error) {
    console.error('[Bloomberg Debug] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    );
  }
}
