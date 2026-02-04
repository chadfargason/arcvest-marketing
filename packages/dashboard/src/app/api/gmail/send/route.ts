/**
 * Gmail Send API
 *
 * POST: Send an email via Gmail
 */

import { NextRequest, NextResponse } from 'next/server';
import { GmailService } from '@arcvest/services';

// Local type definition (since DTS is disabled for services)
interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  replyToMessageId?: string;
  threadId?: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/gmail/send
 * Send an email via Gmail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { to, subject, body: emailBody } = body as SendEmailParams;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const gmailService = new GmailService();

    // Check if connected
    const isConnected = await gmailService.isConnected();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    // Send the email
    const result = await gmailService.sendEmail({
      to,
      subject,
      body: emailBody,
      bodyHtml: body.bodyHtml,
      cc: body.cc,
      bcc: body.bcc,
      replyToMessageId: body.replyToMessageId,
      threadId: body.threadId,
    });

    return NextResponse.json({
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
