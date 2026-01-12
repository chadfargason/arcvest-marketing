import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@arcvest/shared';
import { assignmentRulesConfig, type Advisor } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';

export interface AssignmentResult {
  advisor: Advisor;
  reason: string;
}

export class AssignmentService {
  private supabase: SupabaseClient;
  private config = assignmentRulesConfig;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Assign a contact to an advisor using configured rules.
   */
  async assignContact(contact: Contact): Promise<AssignmentResult> {
    // Check source-based rules first
    const sourceAssignment = this.checkSourceRules(contact);
    if (sourceAssignment) {
      await this.updateContactAssignment(contact.id, sourceAssignment.advisor);
      return sourceAssignment;
    }

    // Check tag-based rules
    const tagAssignment = this.checkTagRules(contact);
    if (tagAssignment) {
      await this.updateContactAssignment(contact.id, tagAssignment.advisor);
      return tagAssignment;
    }

    // Fall back to round-robin
    const roundRobinResult = await this.roundRobinAssignment();
    await this.updateContactAssignment(contact.id, roundRobinResult.advisor);
    return roundRobinResult;
  }

  /**
   * Check source-based assignment rules.
   */
  private checkSourceRules(contact: Contact): AssignmentResult | null {
    if (!contact.source) return null;

    for (const rule of this.config.sourceRules) {
      if (rule.sources.includes(contact.source)) {
        return {
          advisor: rule.assignTo,
          reason: `Source rule: ${contact.source} -> ${rule.assignTo}`,
        };
      }
    }

    return null;
  }

  /**
   * Check tag-based assignment rules.
   */
  private checkTagRules(contact: Contact): AssignmentResult | null {
    if (!contact.tags || contact.tags.length === 0) return null;

    for (const rule of this.config.tagRules) {
      if (contact.tags.includes(rule.tag)) {
        return {
          advisor: rule.assignTo,
          reason: `Tag rule: ${rule.tag} -> ${rule.assignTo}`,
        };
      }
    }

    return null;
  }

  /**
   * Get next advisor using round-robin.
   */
  async roundRobinAssignment(): Promise<AssignmentResult> {
    // Get last assigned advisor from system state
    const { data: stateData, error: stateError } = await this.supabase
      .from('system_state')
      .select('value')
      .eq('key', 'assignment_last_assigned')
      .single();

    if (stateError && stateError.code !== 'PGRST116') {
      throw new Error(`Failed to get assignment state: ${stateError.message}`);
    }

    const lastAssigned = stateData?.value as Advisor | null;
    const advisors = this.config.advisors;

    // Determine next advisor
    let nextAdvisor: Advisor;
    if (!lastAssigned) {
      const firstAdvisor = advisors[0];
      if (!firstAdvisor) {
        throw new Error('No advisors configured for assignment');
      }
      nextAdvisor = firstAdvisor;
    } else {
      const currentIndex = advisors.indexOf(lastAssigned);
      const nextIndex = (currentIndex + 1) % advisors.length;
      const next = advisors[nextIndex];
      if (!next) {
        throw new Error('Failed to determine next advisor');
      }
      nextAdvisor = next;
    }

    // Update system state
    await this.supabase
      .from('system_state')
      .upsert({
        key: 'assignment_last_assigned',
        value: nextAdvisor,
        updated_at: new Date().toISOString(),
      });

    return {
      advisor: nextAdvisor,
      reason: `Round-robin assignment`,
    };
  }

  /**
   * Update a contact's assignment.
   */
  private async updateContactAssignment(contactId: string, advisor: Advisor): Promise<void> {
    const { data: contact, error } = await this.supabase
      .from('contacts')
      .update({ assigned_to: advisor })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact assignment: ${error.message}`);
    }

    EventBus.emit('contact:assigned', { contact, assignedTo: advisor });

    // Log activity
    await this.supabase
      .from('activity_log')
      .insert({
        actor: 'system',
        action: 'assigned',
        entity_type: 'contact',
        entity_id: contactId,
        details: { assigned_to: advisor },
      });
  }

  /**
   * Manually reassign a contact to a specific advisor.
   */
  async reassignContact(contactId: string, advisor: Advisor, reason?: string): Promise<Contact> {
    const { data: contact, error } = await this.supabase
      .from('contacts')
      .update({ assigned_to: advisor })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reassign contact: ${error.message}`);
    }

    EventBus.emit('contact:assigned', { contact, assignedTo: advisor });

    // Log activity
    await this.supabase
      .from('activity_log')
      .insert({
        actor: 'system',
        action: 'reassigned',
        entity_type: 'contact',
        entity_id: contactId,
        details: { assigned_to: advisor, reason },
      });

    return contact;
  }

  /**
   * Get workload distribution between advisors.
   */
  async getWorkloadDistribution(): Promise<Record<Advisor, { total: number; active: number }>> {
    const result: Record<Advisor, { total: number; active: number }> = {
      chad: { total: 0, active: 0 },
      erik: { total: 0, active: 0 },
    };

    // Get total counts
    const { data: totalData, error: totalError } = await this.supabase
      .from('contacts')
      .select('assigned_to')
      .is('deleted_at', null);

    if (totalError) {
      throw new Error(`Failed to get workload: ${totalError.message}`);
    }

    // Get active counts (not client or closed_lost)
    const { data: activeData, error: activeError } = await this.supabase
      .from('contacts')
      .select('assigned_to')
      .is('deleted_at', null)
      .not('status', 'in', '(client,closed_lost)');

    if (activeError) {
      throw new Error(`Failed to get active workload: ${activeError.message}`);
    }

    // Count totals
    for (const contact of totalData || []) {
      if (contact.assigned_to === 'chad') result.chad.total++;
      if (contact.assigned_to === 'erik') result.erik.total++;
    }

    // Count active
    for (const contact of activeData || []) {
      if (contact.assigned_to === 'chad') result.chad.active++;
      if (contact.assigned_to === 'erik') result.erik.active++;
    }

    return result;
  }

  /**
   * Balance workload by reassigning unassigned contacts.
   */
  async balanceWorkload(): Promise<number> {
    // Get unassigned contacts
    const { data: unassigned, error } = await this.supabase
      .from('contacts')
      .select()
      .is('deleted_at', null)
      .is('assigned_to', null);

    if (error) {
      throw new Error(`Failed to get unassigned contacts: ${error.message}`);
    }

    let assigned = 0;
    for (const contact of unassigned || []) {
      await this.assignContact(contact);
      assigned++;
    }

    return assigned;
  }
}
