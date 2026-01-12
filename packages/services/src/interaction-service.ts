import type { SupabaseClient } from '@supabase/supabase-js';
import type { Interaction, InteractionInsert, Contact } from '@arcvest/shared';
import type { LeadScoreAction } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';
import { LeadScoringService } from './lead-scoring-service';

export interface InteractionWithContact extends Interaction {
  contact?: Contact;
}

export class InteractionService {
  private supabase: SupabaseClient;
  private scoringService: LeadScoringService;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
    this.scoringService = new LeadScoringService(this.supabase);
  }

  /**
   * Log an interaction and update lead score if applicable.
   */
  async log(data: InteractionInsert): Promise<Interaction> {
    // Insert the interaction
    const { data: interaction, error } = await this.supabase
      .from('interactions')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log interaction: ${error.message}`);
    }

    // Get the contact for events
    const { data: contact } = await this.supabase
      .from('contacts')
      .select()
      .eq('id', data.contact_id)
      .single();

    // Emit event
    if (contact) {
      EventBus.emit('interaction:logged', { interaction, contact });

      // Emit specific events for email interactions
      if (data.type === 'email_outbound') {
        EventBus.emit('interaction:email_sent', { interaction, contact });
      }
      if (data.type === 'email_opened') {
        EventBus.emit('interaction:email_opened', { interaction, contact });
      }
      if (data.type === 'email_clicked') {
        EventBus.emit('interaction:email_clicked', { interaction, contact });
      }
    }

    // Update lead score based on interaction type
    const scoreAction = this.mapTypeToScoreAction(data.type);
    if (scoreAction) {
      await this.scoringService.recordAction(data.contact_id, scoreAction);
    }

    return interaction;
  }

  /**
   * Get interactions for a contact.
   */
  async getByContact(contactId: string, options?: {
    type?: Interaction['type'];
    limit?: number;
    offset?: number;
  }): Promise<Interaction[]> {
    let query = this.supabase
      .from('interactions')
      .select()
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get interactions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get an interaction by ID.
   */
  async getById(id: string): Promise<Interaction | null> {
    const { data, error } = await this.supabase
      .from('interactions')
      .select()
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get interaction: ${error.message}`);
    }

    return data;
  }

  /**
   * Get the contact timeline (all events related to a contact).
   */
  async getContactTimeline(contactId: string, limit = 50): Promise<{
    id: string;
    contact_id: string;
    created_at: string;
    event_type: string;
    source: string;
    title: string | null;
    description: string | null;
    outcome: string | null;
    metadata: Record<string, unknown>;
  }[]> {
    const { data, error } = await this.supabase
      .from('contact_timeline')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get contact timeline: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent interactions across all contacts.
   */
  async getRecent(limit = 50): Promise<InteractionWithContact[]> {
    const { data, error } = await this.supabase
      .from('interactions')
      .select(`
        *,
        contact:contacts(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent interactions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get interactions by type (for analytics).
   */
  async getByType(type: Interaction['type'], options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Interaction[]> {
    let query = this.supabase
      .from('interactions')
      .select()
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get interactions by type: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Count interactions by type for a date range.
   */
  async countByType(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('interactions')
      .select('type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to count interactions: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const interaction of data || []) {
      counts[interaction.type] = (counts[interaction.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Log email sent interaction.
   */
  async logEmailSent(contactId: string, subject: string, options?: {
    gmailMessageId?: string;
    gmailThreadId?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Interaction> {
    return this.log({
      contact_id: contactId,
      type: 'email_outbound',
      channel: 'gmail',
      subject,
      summary: options?.summary,
      gmail_message_id: options?.gmailMessageId,
      gmail_thread_id: options?.gmailThreadId,
      metadata: options?.metadata || {},
    });
  }

  /**
   * Log email received interaction.
   */
  async logEmailReceived(contactId: string, subject: string, options?: {
    gmailMessageId?: string;
    gmailThreadId?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Interaction> {
    return this.log({
      contact_id: contactId,
      type: 'email_inbound',
      channel: 'gmail',
      subject,
      summary: options?.summary,
      gmail_message_id: options?.gmailMessageId,
      gmail_thread_id: options?.gmailThreadId,
      metadata: options?.metadata || {},
    });
  }

  /**
   * Log form submission.
   */
  async logFormSubmission(contactId: string, formType: string, data: Record<string, unknown>): Promise<Interaction> {
    return this.log({
      contact_id: contactId,
      type: 'form_submission',
      channel: 'website',
      subject: `Form submission: ${formType}`,
      metadata: { form_type: formType, form_data: data },
    });
  }

  /**
   * Log meeting/call.
   */
  async logMeeting(contactId: string, options: {
    subject: string;
    summary?: string;
    durationMinutes?: number;
    outcome?: Interaction['outcome'];
    channel?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Interaction> {
    return this.log({
      contact_id: contactId,
      type: 'meeting',
      channel: options.channel || 'zoom',
      subject: options.subject,
      summary: options.summary,
      duration_minutes: options.durationMinutes,
      outcome: options.outcome,
      metadata: options.metadata || {},
    });
  }

  /**
   * Log a note.
   */
  async logNote(contactId: string, note: string, author?: string): Promise<Interaction> {
    return this.log({
      contact_id: contactId,
      type: 'note',
      summary: note,
      metadata: { author },
    });
  }

  /**
   * Map interaction type to lead score action.
   */
  private mapTypeToScoreAction(type: Interaction['type']): LeadScoreAction | null {
    const mapping: Record<string, LeadScoreAction> = {
      email_inbound: 'email_reply',
      form_submission: 'form_submission',
      website_visit: 'page_view',
      meeting: 'consultation_scheduled',
      whitepaper_download: 'whitepaper_download',
      ad_click: 'ad_click',
      email_opened: 'email_opened',
      email_clicked: 'email_clicked',
    };

    return mapping[type] || null;
  }
}
