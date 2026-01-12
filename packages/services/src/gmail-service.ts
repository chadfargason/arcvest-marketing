/**
 * Gmail Service
 *
 * Handles Gmail API integration for syncing emails, sending messages,
 * and managing OAuth tokens.
 */

import { createLogger } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';
import { ContactService } from './contact-service';
import { InteractionService } from './interaction-service';

const logger = createLogger('gmail-service');

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: {
    email: string;
    name?: string;
  };
  to: {
    email: string;
    name?: string;
  }[];
  cc?: {
    email: string;
    name?: string;
  }[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels: string[];
  isRead: boolean;
  isInbound: boolean;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  replyToMessageId?: string;
  threadId?: string;
}

export interface GmailSyncResult {
  processed: number;
  newContacts: number;
  newInteractions: number;
  errors: string[];
}

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

export class GmailService {
  private config: GmailConfig;
  private tokens: GmailTokens | null = null;
  private supabase = getSupabase();
  private contactService: ContactService;
  private interactionService: InteractionService;

  constructor(config?: Partial<GmailConfig>) {
    // Use GMAIL_* env vars (separate from GOOGLE_ADS_* credentials)
    this.config = {
      clientId: config?.clientId || process.env['GMAIL_CLIENT_ID'] || '',
      clientSecret: config?.clientSecret || process.env['GMAIL_CLIENT_SECRET'] || '',
      redirectUri: config?.redirectUri || process.env['GMAIL_REDIRECT_URI'] || '',
    };

    this.contactService = new ContactService();
    this.interactionService = new InteractionService();

    if (!this.config.clientId || !this.config.clientSecret) {
      logger.warn('Gmail API credentials not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)');
    }
  }

  /**
   * Generate OAuth authorization URL.
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeCodeForTokens(code: string): Promise<GmailTokens> {
    logger.info('Exchanging authorization code for tokens');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Failed to exchange code for tokens', { error });
      throw new Error(`OAuth token exchange failed: ${response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const tokens: GmailTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };

    // Store tokens securely
    await this.storeTokens(tokens);
    this.tokens = tokens;

    logger.info('Successfully obtained Gmail tokens');
    return tokens;
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshAccessToken(): Promise<GmailTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing Gmail access token');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.tokens.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Failed to refresh access token', { error });
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    this.tokens = {
      ...this.tokens,
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    await this.storeTokens(this.tokens);
    return this.tokens;
  }

  /**
   * Get valid access token (refresh if needed).
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      await this.loadTokens();
    }

    if (!this.tokens) {
      throw new Error('No Gmail tokens available. Please authorize first.');
    }

    // Refresh if token expires in less than 5 minutes
    if (this.tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Store tokens in database.
   */
  private async storeTokens(tokens: GmailTokens): Promise<void> {
    await this.supabase.from('system_state').upsert({
      key: 'gmail_tokens',
      value: JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt.toISOString(),
        scope: tokens.scope,
      }),
    });
  }

  /**
   * Load tokens from database.
   */
  private async loadTokens(): Promise<void> {
    const { data } = await this.supabase
      .from('system_state')
      .select('value')
      .eq('key', 'gmail_tokens')
      .single();

    if (data?.value) {
      const stored = JSON.parse(data.value);
      this.tokens = {
        ...stored,
        expiresAt: new Date(stored.expiresAt),
      };
    }
  }

  /**
   * Make authenticated request to Gmail API.
   */
  private async gmailRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`,
      {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Gmail API error', { endpoint, status: response.status, error });
      throw new Error(`Gmail API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch new messages since last sync.
   */
  async fetchNewMessages(maxResults: number = 50): Promise<GmailMessage[]> {
    logger.info('Fetching new Gmail messages');

    // Get last sync timestamp
    const { data: syncState } = await this.supabase
      .from('system_state')
      .select('value')
      .eq('key', 'gmail_last_sync')
      .single();

    const lastSyncTime = syncState?.value
      ? new Date(syncState.value)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago

    // Query for messages after last sync
    const query = `after:${Math.floor(lastSyncTime.getTime() / 1000)}`;

    const listResponse = await this.gmailRequest<{
      messages?: { id: string; threadId: string }[];
    }>(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);

    if (!listResponse.messages || listResponse.messages.length === 0) {
      logger.info('No new messages found');
      return [];
    }

    // Fetch full message details
    const messages: GmailMessage[] = [];
    for (const msg of listResponse.messages) {
      try {
        const fullMessage = await this.getMessageDetails(msg.id);
        if (fullMessage) {
          messages.push(fullMessage);
        }
      } catch (error) {
        logger.error(`Failed to fetch message ${msg.id}`, error);
      }
    }

    // Update last sync time
    await this.supabase.from('system_state').upsert({
      key: 'gmail_last_sync',
      value: new Date().toISOString(),
    });

    logger.info(`Fetched ${messages.length} new messages`);
    return messages;
  }

  /**
   * Get full message details.
   */
  async getMessageDetails(messageId: string): Promise<GmailMessage | null> {
    const data = await this.gmailRequest<{
      id: string;
      threadId: string;
      labelIds: string[];
      payload: {
        headers: { name: string; value: string }[];
        parts?: { mimeType: string; body: { data?: string } }[];
        body?: { data?: string };
      };
      internalDate: string;
    }>(`/messages/${messageId}?format=full`);

    // Parse headers
    const headers = data.payload.headers;
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('from');
    const toHeader = getHeader('to');

    // Parse email addresses
    const parseEmailAddress = (header: string): { email: string; name?: string } => {
      const match = header.match(/(?:"?([^"]*)"?\s)?<?([^<>\s]+@[^<>\s]+)>?/);
      if (match && match[2]) {
        return { email: match[2], name: match[1]?.trim() };
      }
      return { email: header.trim() };
    };

    const from = parseEmailAddress(fromHeader);
    const toAddresses = toHeader.split(',').map((addr) => parseEmailAddress(addr.trim()));

    // Get body
    let body = '';
    let bodyHtml = '';

    if (data.payload.parts) {
      for (const part of data.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    } else if (data.payload.body?.data) {
      body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
    }

    // Determine if inbound (to our domain)
    const ourDomains = ['arcvest.com', 'fargasoncapital.com'];
    const isInbound = ourDomains.some(
      (domain) =>
        toAddresses.some((addr) => addr.email.includes(domain)) &&
        !from.email.includes(domain)
    );

    return {
      id: data.id,
      threadId: data.threadId,
      from,
      to: toAddresses,
      subject: getHeader('subject'),
      body,
      bodyHtml,
      date: new Date(parseInt(data.internalDate)),
      labels: data.labelIds || [],
      isRead: !data.labelIds?.includes('UNREAD'),
      isInbound,
    };
  }

  /**
   * Send an email.
   */
  async sendEmail(params: SendEmailParams): Promise<{ id: string; threadId: string }> {
    logger.info('Sending email', { to: params.to, subject: params.subject });

    const toArray = Array.isArray(params.to) ? params.to : [params.to];

    // Build email MIME message
    const boundary = `boundary_${Date.now()}`;
    const mimeLines = [
      `To: ${toArray.join(', ')}`,
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
    ];

    if (params.cc?.length) {
      mimeLines.push(`Cc: ${params.cc.join(', ')}`);
    }

    if (params.replyToMessageId) {
      mimeLines.push(`In-Reply-To: ${params.replyToMessageId}`);
      mimeLines.push(`References: ${params.replyToMessageId}`);
    }

    if (params.bodyHtml) {
      mimeLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      mimeLines.push('');
      mimeLines.push(`--${boundary}`);
      mimeLines.push('Content-Type: text/plain; charset="UTF-8"');
      mimeLines.push('');
      mimeLines.push(params.body);
      mimeLines.push(`--${boundary}`);
      mimeLines.push('Content-Type: text/html; charset="UTF-8"');
      mimeLines.push('');
      mimeLines.push(params.bodyHtml);
      mimeLines.push(`--${boundary}--`);
    } else {
      mimeLines.push('Content-Type: text/plain; charset="UTF-8"');
      mimeLines.push('');
      mimeLines.push(params.body);
    }

    const rawEmail = mimeLines.join('\r\n');
    const encodedEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody: { raw: string; threadId?: string } = { raw: encodedEmail };
    if (params.threadId) {
      requestBody.threadId = params.threadId;
    }

    const result = await this.gmailRequest<{ id: string; threadId: string }>('/messages/send', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    logger.info('Email sent', { messageId: result.id, threadId: result.threadId });

    // Log the interaction
    for (const recipient of toArray) {
      const contact = await this.contactService.getByEmail(recipient);
      if (contact) {
        await this.interactionService.log({
          contact_id: contact.id,
          type: 'email_outbound',
          subject: params.subject,
          summary: params.body.substring(0, 500),
        });
      }
    }

    return result;
  }

  /**
   * Sync inbox and process new messages.
   */
  async syncAndProcess(): Promise<GmailSyncResult> {
    logger.info('Starting Gmail sync and process');

    const result: GmailSyncResult = {
      processed: 0,
      newContacts: 0,
      newInteractions: 0,
      errors: [],
    };

    try {
      const messages = await this.fetchNewMessages();

      for (const message of messages) {
        try {
          await this.processInboundMessage(message, result);
          result.processed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Message ${message.id}: ${errorMsg}`);
          logger.error(`Failed to process message ${message.id}`, error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${errorMsg}`);
      logger.error('Gmail sync failed', error);
    }

    logger.info('Gmail sync completed', result);
    return result;
  }

  /**
   * Process an inbound email message.
   */
  private async processInboundMessage(
    message: GmailMessage,
    result: GmailSyncResult
  ): Promise<void> {
    // Only process inbound messages
    if (!message.isInbound) {
      return;
    }

    // Skip automated/system emails
    const skipPatterns = [
      'noreply@',
      'no-reply@',
      'notifications@',
      'mailer-daemon@',
      'postmaster@',
    ];
    if (skipPatterns.some((pattern) => message.from.email.toLowerCase().includes(pattern))) {
      return;
    }

    // Get or create contact
    let contact = await this.contactService.getByEmail(message.from.email);
    let isNewContact = false;

    if (!contact) {
      // Create new contact from email
      const nameParts = message.from.name?.split(' ') || [''];
      contact = await this.contactService.create({
        email: message.from.email,
        first_name: nameParts[0] || 'Unknown',
        last_name: nameParts.slice(1).join(' ') || undefined,
        source: 'email_inbound',
        notes: `Created from inbound email: ${message.subject}`,
      });
      isNewContact = true;
      result.newContacts++;

      // Emit event for new contact
      EventBus.emit('contact:created', { contact });
    }

    // Log the interaction
    await this.interactionService.log({
      contact_id: contact.id,
      type: 'email_inbound',
      subject: message.subject,
      summary: message.body.substring(0, 1000),
      metadata: {
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
      },
    });
    result.newInteractions++;

    // Create task for follow-up if new contact
    if (isNewContact) {
      await this.supabase.from('tasks').insert({
        contact_id: contact.id,
        title: `Review new email inquiry: ${message.subject}`,
        description: `New contact from email. Review and follow up.\n\nOriginal message preview:\n${message.body.substring(0, 300)}...`,
        type: 'follow_up',
        priority: 'high',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due in 24 hours
      });
    }
  }

  /**
   * Check if Gmail is connected.
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.loadTokens();
      if (!this.tokens) return false;

      // Try a simple API call
      await this.gmailRequest('/profile');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Gmail profile info.
   */
  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number }> {
    return this.gmailRequest('/profile');
  }

  /**
   * Disconnect Gmail (revoke tokens).
   */
  async disconnect(): Promise<void> {
    if (this.tokens?.accessToken) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${this.tokens.accessToken}`,
          { method: 'POST' }
        );
      } catch (error) {
        logger.warn('Failed to revoke Gmail token', error);
      }
    }

    // Clear stored tokens
    await this.supabase
      .from('system_state')
      .delete()
      .eq('key', 'gmail_tokens');

    this.tokens = null;
    logger.info('Gmail disconnected');
  }
}
