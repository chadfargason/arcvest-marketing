import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact, ContactInsert, ContactUpdate } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';

export interface ContactSearchParams {
  query?: string;
  status?: Contact['status'];
  source?: string;
  assignedTo?: string;
  tags?: string[];
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
}

export interface ContactSearchResult {
  contacts: Contact[];
  total: number;
}

export class ContactService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Create a new contact.
   */
  async create(data: ContactInsert): Promise<Contact> {
    const { data: contact, error } = await this.supabase
      .from('contacts')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    EventBus.emit('contact:created', { contact });
    return contact;
  }

  /**
   * Get a contact by ID.
   */
  async getById(id: string): Promise<Contact | null> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select()
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get contact: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a contact by email.
   */
  async getByEmail(email: string): Promise<Contact | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await this.supabase
      .from('contacts')
      .select()
      .eq('email', normalizedEmail)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get contact by email: ${error.message}`);
    }

    return data;
  }

  /**
   * Get or create a contact by email.
   * Returns existing contact if found, otherwise creates a new one.
   */
  async getOrCreate(email: string, data?: Partial<ContactInsert>): Promise<{ contact: Contact; created: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing contact
    const existing = await this.getByEmail(normalizedEmail);
    if (existing) {
      return { contact: existing, created: false };
    }

    // Create new contact
    const contact = await this.create({
      email: normalizedEmail,
      ...data,
    });

    return { contact, created: true };
  }

  /**
   * Update a contact.
   */
  async update(id: string, data: ContactUpdate): Promise<Contact> {
    // Get current contact for comparison
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Contact not found: ${id}`);
    }

    const { data: contact, error } = await this.supabase
      .from('contacts')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    // Emit events for specific changes
    EventBus.emit('contact:updated', { contact, changes: data });

    if (data.status && data.status !== current.status) {
      EventBus.emit('contact:status_changed', {
        contact,
        previousStatus: current.status,
        newStatus: data.status,
      });
    }

    if (data.lead_score !== undefined && data.lead_score !== current.lead_score) {
      EventBus.emit('contact:score_changed', {
        contact,
        previousScore: current.lead_score,
        newScore: data.lead_score,
      });
    }

    if (data.assigned_to && data.assigned_to !== current.assigned_to) {
      EventBus.emit('contact:assigned', { contact, assignedTo: data.assigned_to });
    }

    return contact;
  }

  /**
   * Soft delete a contact.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }

    EventBus.emit('contact:deleted', { contactId: id });
  }

  /**
   * Hard delete a contact (permanent).
   */
  async hardDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to hard delete contact: ${error.message}`);
    }

    EventBus.emit('contact:deleted', { contactId: id });
  }

  /**
   * Search contacts with filters.
   */
  async search(params: ContactSearchParams): Promise<ContactSearchResult> {
    const { query, status, source, assignedTo, tags, minScore, maxScore, limit = 50, offset = 0 } = params;

    let queryBuilder = this.supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Text search on name and email
    if (query) {
      queryBuilder = queryBuilder.or(
        `email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      );
    }

    // Filter by status
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    // Filter by source
    if (source) {
      queryBuilder = queryBuilder.eq('source', source);
    }

    // Filter by assigned_to
    if (assignedTo) {
      queryBuilder = queryBuilder.eq('assigned_to', assignedTo);
    }

    // Filter by tags (contains any)
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.contains('tags', tags);
    }

    // Filter by score range
    if (minScore !== undefined) {
      queryBuilder = queryBuilder.gte('lead_score', minScore);
    }
    if (maxScore !== undefined) {
      queryBuilder = queryBuilder.lte('lead_score', maxScore);
    }

    // Apply pagination
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new Error(`Failed to search contacts: ${error.message}`);
    }

    return {
      contacts: data || [],
      total: count || 0,
    };
  }

  /**
   * Add a tag to a contact.
   */
  async addTag(id: string, tag: string): Promise<Contact> {
    const contact = await this.getById(id);
    if (!contact) {
      throw new Error(`Contact not found: ${id}`);
    }

    const normalizedTag = tag.toLowerCase().trim();
    if (contact.tags.includes(normalizedTag)) {
      return contact; // Tag already exists
    }

    const updatedTags = [...contact.tags, normalizedTag];
    const updated = await this.update(id, { tags: updatedTags });

    EventBus.emit('contact:tagged', { contact: updated, tag: normalizedTag, action: 'added' });
    return updated;
  }

  /**
   * Remove a tag from a contact.
   */
  async removeTag(id: string, tag: string): Promise<Contact> {
    const contact = await this.getById(id);
    if (!contact) {
      throw new Error(`Contact not found: ${id}`);
    }

    const normalizedTag = tag.toLowerCase().trim();
    if (!contact.tags.includes(normalizedTag)) {
      return contact; // Tag doesn't exist
    }

    const updatedTags = contact.tags.filter((t) => t !== normalizedTag);
    const updated = await this.update(id, { tags: updatedTags });

    EventBus.emit('contact:tagged', { contact: updated, tag: normalizedTag, action: 'removed' });
    return updated;
  }

  /**
   * Get hot leads (high scoring, active pipeline).
   */
  async getHotLeads(limit = 10): Promise<Contact[]> {
    const { data, error } = await this.supabase
      .from('hot_leads')
      .select('*')
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get hot leads: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get contacts by status.
   */
  async getByStatus(status: Contact['status']): Promise<Contact[]> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select()
      .eq('status', status)
      .is('deleted_at', null)
      .order('lead_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get contacts by status: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get lead funnel summary.
   */
  async getFunnelSummary(): Promise<{ status: string; count: number; avg_score: number; avg_days_in_status: number }[]> {
    const { data, error } = await this.supabase
      .from('lead_funnel_summary')
      .select('*');

    if (error) {
      throw new Error(`Failed to get funnel summary: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get source performance summary.
   */
  async getSourcePerformance(): Promise<{ source: string; total_leads: number; clients_won: number; conversion_rate: number; avg_lead_score: number }[]> {
    const { data, error } = await this.supabase
      .from('source_performance')
      .select('*');

    if (error) {
      throw new Error(`Failed to get source performance: ${error.message}`);
    }

    return data || [];
  }
}
