import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EmailSequence,
  EmailSequenceStep,
  SequenceEnrollment,
  Contact,
} from '@arcvest/shared';
import { addDays } from 'date-fns';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';

export interface SequenceWithSteps extends EmailSequence {
  steps?: EmailSequenceStep[];
}

export interface EnrollmentWithDetails extends SequenceEnrollment {
  contact?: Contact;
  sequence?: EmailSequence;
}

export interface EmailQueueItem {
  enrollment_id: string;
  contact_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  sequence_name: string;
  sequence_id: string;
  subject: string;
  body: string;
  step_order: number;
  next_email_at: string;
}

export class SequenceService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  // ============================================
  // Sequence Management
  // ============================================

  /**
   * Get all sequences.
   */
  async getSequences(): Promise<SequenceWithSteps[]> {
    const { data, error } = await this.supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get sequences: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a sequence by ID.
   */
  async getSequenceById(id: string): Promise<SequenceWithSteps | null> {
    const { data, error } = await this.supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get sequence: ${error.message}`);
    }

    return data;
  }

  /**
   * Get active sequences.
   */
  async getActiveSequences(): Promise<EmailSequence[]> {
    const { data, error } = await this.supabase
      .from('email_sequences')
      .select()
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to get active sequences: ${error.message}`);
    }

    return data || [];
  }

  // ============================================
  // Enrollment Management
  // ============================================

  /**
   * Enroll a contact in a sequence.
   */
  async enroll(contactId: string, sequenceId: string): Promise<SequenceEnrollment> {
    // Check if already enrolled
    const { data: existing } = await this.supabase
      .from('sequence_enrollments')
      .select()
      .eq('contact_id', contactId)
      .eq('sequence_id', sequenceId)
      .single();

    if (existing) {
      // If completed or unsubscribed, don't re-enroll
      if (existing.status === 'active') {
        return existing;
      }
      throw new Error('Contact already completed or unsubscribed from this sequence');
    }

    // Get the first step to calculate next_email_at
    const { data: firstStep } = await this.supabase
      .from('email_sequence_steps')
      .select()
      .eq('sequence_id', sequenceId)
      .eq('step_order', 1)
      .single();

    const delayDays = firstStep?.delay_days || 0;
    const nextEmailAt = addDays(new Date(), delayDays).toISOString();

    // Create enrollment
    const { data: enrollment, error } = await this.supabase
      .from('sequence_enrollments')
      .insert({
        contact_id: contactId,
        sequence_id: sequenceId,
        current_step: 1,
        status: 'active',
        next_email_at: nextEmailAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to enroll contact: ${error.message}`);
    }

    EventBus.emit('sequence:enrolled', { contactId, sequenceId });

    return enrollment;
  }

  /**
   * Pause an enrollment.
   */
  async pause(enrollmentId: string): Promise<SequenceEnrollment> {
    const { data: enrollment, error } = await this.supabase
      .from('sequence_enrollments')
      .update({ status: 'paused' })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to pause enrollment: ${error.message}`);
    }

    return enrollment;
  }

  /**
   * Resume a paused enrollment.
   */
  async resume(enrollmentId: string): Promise<SequenceEnrollment> {
    const { data: enrollment, error } = await this.supabase
      .from('sequence_enrollments')
      .update({
        status: 'active',
        next_email_at: new Date().toISOString(), // Resume immediately
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resume enrollment: ${error.message}`);
    }

    return enrollment;
  }

  /**
   * Unsubscribe a contact from a sequence.
   */
  async unsubscribe(enrollmentId: string): Promise<SequenceEnrollment> {
    const { data: enrollment, error } = await this.supabase
      .from('sequence_enrollments')
      .update({ status: 'unsubscribed' })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to unsubscribe: ${error.message}`);
    }

    return enrollment;
  }

  /**
   * Advance an enrollment to the next step after sending an email.
   */
  async advance(enrollmentId: string): Promise<SequenceEnrollment> {
    // Get current enrollment
    const { data: current, error: fetchError } = await this.supabase
      .from('sequence_enrollments')
      .select()
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !current) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    // Get total steps in sequence
    const { data: steps, error: stepsError } = await this.supabase
      .from('email_sequence_steps')
      .select('step_order, delay_days')
      .eq('sequence_id', current.sequence_id)
      .order('step_order', { ascending: true });

    if (stepsError) {
      throw new Error(`Failed to get sequence steps: ${stepsError.message}`);
    }

    const totalSteps = steps?.length || 0;
    const nextStep = current.current_step + 1;

    // Check if sequence is complete
    if (nextStep > totalSteps) {
      const { data: completed, error: completeError } = await this.supabase
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          last_email_sent_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)
        .select()
        .single();

      if (completeError) {
        throw new Error(`Failed to complete enrollment: ${completeError.message}`);
      }

      EventBus.emit('sequence:completed', {
        contactId: current.contact_id,
        sequenceId: current.sequence_id,
      });

      return completed;
    }

    // Get next step delay
    const nextStepData = steps?.find((s) => s.step_order === nextStep);
    const delayDays = nextStepData?.delay_days || 0;
    const nextEmailAt = addDays(new Date(), delayDays).toISOString();

    // Update enrollment
    const { data: enrollment, error } = await this.supabase
      .from('sequence_enrollments')
      .update({
        current_step: nextStep,
        next_email_at: nextEmailAt,
        last_email_sent_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to advance enrollment: ${error.message}`);
    }

    EventBus.emit('sequence:email_sent', {
      contactId: current.contact_id,
      sequenceId: current.sequence_id,
      stepOrder: current.current_step,
    });

    return enrollment;
  }

  /**
   * Get enrollments for a contact.
   */
  async getEnrollmentsByContact(contactId: string): Promise<EnrollmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:email_sequences(*)
      `)
      .eq('contact_id', contactId);

    if (error) {
      throw new Error(`Failed to get enrollments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get active enrollments for a sequence.
   */
  async getActiveEnrollments(sequenceId: string): Promise<EnrollmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('sequence_enrollments')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('sequence_id', sequenceId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to get active enrollments: ${error.message}`);
    }

    return data || [];
  }

  // ============================================
  // Email Queue Processing
  // ============================================

  /**
   * Get emails ready to be sent.
   */
  async getEmailQueue(): Promise<EmailQueueItem[]> {
    const { data, error } = await this.supabase
      .from('sequence_email_queue')
      .select('*');

    if (error) {
      throw new Error(`Failed to get email queue: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Process the email queue (called by scheduler).
   * Returns the list of emails that should be sent.
   */
  async processEmailQueue(): Promise<EmailQueueItem[]> {
    const queue = await this.getEmailQueue();
    return queue;
  }

  /**
   * Merge template fields into email content.
   */
  mergeTemplateFields(template: string, contact: Contact, additionalFields?: Record<string, string>): string {
    let result = template;

    // Standard contact fields
    const fields: Record<string, string> = {
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email,
      full_name: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
      ...additionalFields,
    };

    // Replace all {{field}} patterns
    for (const [key, value] of Object.entries(fields)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      result = result.replace(pattern, value);
    }

    return result;
  }

  // ============================================
  // Trigger Management
  // ============================================

  /**
   * Check if a contact should be enrolled based on trigger.
   */
  async checkTriggers(contact: Contact, event: {
    type: 'form_submission' | 'tag_added' | 'status_change' | 'lead_score_threshold';
    data: Record<string, unknown>;
  }): Promise<void> {
    // Get sequences with matching trigger type
    const { data: sequences, error } = await this.supabase
      .from('email_sequences')
      .select()
      .eq('status', 'active')
      .eq('trigger_type', event.type);

    if (error) {
      throw new Error(`Failed to check triggers: ${error.message}`);
    }

    for (const sequence of sequences || []) {
      const config = sequence.trigger_config as Record<string, unknown>;

      let shouldEnroll = false;

      switch (event.type) {
        case 'form_submission':
          shouldEnroll = !config['form_type'] || config['form_type'] === event.data['form_type'];
          break;
        case 'tag_added':
          shouldEnroll = config['tag'] === event.data['tag'];
          break;
        case 'status_change':
          shouldEnroll = config['new_status'] === event.data['new_status'];
          break;
        case 'lead_score_threshold':
          const threshold = (config['threshold'] as number) || 0;
          const score = (event.data['score'] as number) || 0;
          const previousScore = (event.data['previous_score'] as number) || 0;
          shouldEnroll = score >= threshold && previousScore < threshold;
          break;
      }

      if (shouldEnroll) {
        try {
          await this.enroll(contact.id, sequence.id);
        } catch (err) {
          // Ignore already enrolled errors
          console.log(`Could not enroll ${contact.email} in ${sequence.name}:`, err);
        }
      }
    }
  }
}
