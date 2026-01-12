import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact, Interaction } from '@arcvest/shared';
import { leadScoringConfig, type LeadScoreAction } from '@arcvest/shared';
import { getSupabase } from './supabase';
import { EventBus } from './event-bus';

export interface ScoreBreakdown {
  actionScores: { action: string; points: number; date: string }[];
  fitBonus: number;
  totalBeforeDecay: number;
  decayPenalty: number;
  finalScore: number;
}

export class LeadScoringService {
  private supabase: SupabaseClient;
  private config = leadScoringConfig;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  /**
   * Record a scoring action and update the contact's score.
   */
  async recordAction(contactId: string, action: LeadScoreAction): Promise<number> {
    const points = this.config.actions[action] || 0;
    if (points === 0) {
      return 0;
    }

    // Get current contact
    const { data: contact, error: fetchError } = await this.supabase
      .from('contacts')
      .select()
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Calculate new score
    const newScore = Math.min(100, Math.max(0, contact.lead_score + points));

    // Update contact score
    const { data: updated, error: updateError } = await this.supabase
      .from('contacts')
      .update({ lead_score: newScore })
      .eq('id', contactId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update score: ${updateError.message}`);
    }

    // Emit score change event
    if (newScore !== contact.lead_score) {
      EventBus.emit('contact:score_changed', {
        contact: updated,
        previousScore: contact.lead_score,
        newScore,
      });

      // Check thresholds
      await this.checkThresholds(updated, contact.lead_score);
    }

    return newScore;
  }

  /**
   * Recalculate a contact's score based on their full interaction history.
   */
  async recalculateScore(contactId: string): Promise<ScoreBreakdown> {
    // Get contact
    const { data: contact, error: contactError } = await this.supabase
      .from('contacts')
      .select()
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Get all interactions
    const { data: interactions, error: interactionError } = await this.supabase
      .from('interactions')
      .select()
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    if (interactionError) {
      throw new Error(`Failed to get interactions: ${interactionError.message}`);
    }

    const actionScores: { action: string; points: number; date: string }[] = [];
    let totalActionScore = 0;

    // Calculate action scores
    for (const interaction of interactions || []) {
      const action = this.mapInteractionToAction(interaction);
      if (action) {
        const points = this.config.actions[action] || 0;
        if (points > 0) {
          actionScores.push({
            action,
            points,
            date: interaction.created_at,
          });
          totalActionScore += points;
        }
      }
    }

    // Calculate fit bonus
    const fitBonus = this.calculateFitBonus(contact);
    const totalBeforeDecay = totalActionScore + fitBonus;

    // Calculate decay
    const decayPenalty = this.calculateDecay(contact, interactions || []);
    const finalScore = Math.min(100, Math.max(0, totalBeforeDecay - decayPenalty));

    // Update contact if score changed
    if (finalScore !== contact.lead_score) {
      const { data: updated, error: updateError } = await this.supabase
        .from('contacts')
        .update({ lead_score: finalScore })
        .eq('id', contactId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update score: ${updateError.message}`);
      }

      EventBus.emit('contact:score_changed', {
        contact: updated,
        previousScore: contact.lead_score,
        newScore: finalScore,
      });

      await this.checkThresholds(updated, contact.lead_score);
    }

    return {
      actionScores,
      fitBonus,
      totalBeforeDecay,
      decayPenalty,
      finalScore,
    };
  }

  /**
   * Check if a contact has crossed any score thresholds.
   */
  private async checkThresholds(contact: Contact, previousScore: number): Promise<void> {
    const { hot, warm } = this.config.thresholds;

    // Check hot threshold
    if (contact.lead_score >= hot && previousScore < hot) {
      EventBus.emit('lead:score_threshold_reached', { contact, threshold: 'hot' });
    }

    // Check warm threshold
    if (contact.lead_score >= warm && previousScore < warm) {
      EventBus.emit('lead:score_threshold_reached', { contact, threshold: 'warm' });
    }

    // Check if lead is qualified (crossed warm threshold for first time)
    if (contact.lead_score >= warm && previousScore < warm) {
      EventBus.emit('lead:qualified', { contact });
    }
  }

  /**
   * Calculate fit bonus based on contact attributes.
   */
  private calculateFitBonus(contact: Contact): number {
    let bonus = 0;

    // Asset level bonus
    if (contact.estimated_assets) {
      const assetBonus = this.config.fitBonus.assets[contact.estimated_assets];
      if (assetBonus) {
        bonus += assetBonus;
      }
    }

    // Location bonus (if in target regions, etc.)
    // This could be expanded based on business rules

    return bonus;
  }

  /**
   * Calculate score decay based on inactivity.
   */
  private calculateDecay(contact: Contact, interactions: Interaction[]): number {
    const { decayConfig } = this.config;
    const now = new Date();

    // Find most recent interaction
    const lastInteractionItem = interactions[interactions.length - 1];
    const lastInteraction = lastInteractionItem
      ? new Date(lastInteractionItem.created_at)
      : new Date(contact.created_at);

    const daysSinceActivity = Math.floor(
      (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
    );

    // No decay within grace period
    if (daysSinceActivity <= decayConfig.startAfterDays) {
      return 0;
    }

    // Calculate decay periods
    const decayDays = daysSinceActivity - decayConfig.startAfterDays;
    const decayPeriods = Math.floor(decayDays / decayConfig.periodDays);

    // Calculate total decay
    const totalDecay = decayPeriods * decayConfig.pointsPerPeriod;

    // Cap at maximum decay
    return Math.min(totalDecay, decayConfig.maxDecay);
  }

  /**
   * Map an interaction type to a scoring action.
   */
  private mapInteractionToAction(interaction: Interaction): LeadScoreAction | null {
    const typeToAction: Record<string, LeadScoreAction> = {
      email_inbound: 'email_reply',
      email_outbound: 'email_opened', // Assume opened if sent
      form_submission: 'form_submission',
      website_visit: 'page_view',
      meeting: 'consultation_scheduled',
      whitepaper_download: 'whitepaper_download',
      ad_click: 'ad_click',
      email_opened: 'email_opened',
      email_clicked: 'email_clicked',
    };

    return typeToAction[interaction.type] || null;
  }

  /**
   * Get score tier for a contact.
   */
  getScoreTier(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= this.config.thresholds.hot) return 'hot';
    if (score >= this.config.thresholds.warm) return 'warm';
    return 'cold';
  }

  /**
   * Run decay calculation for all contacts (scheduled job).
   */
  async runDecayJob(): Promise<{ processed: number; updated: number }> {
    // Get all active contacts
    const { data: contacts, error } = await this.supabase
      .from('contacts')
      .select('id')
      .is('deleted_at', null)
      .not('status', 'in', '(client,closed_lost)');

    if (error) {
      throw new Error(`Failed to get contacts for decay: ${error.message}`);
    }

    let processed = 0;
    let updated = 0;

    for (const contact of contacts || []) {
      try {
        const breakdown = await this.recalculateScore(contact.id);
        processed++;
        if (breakdown.decayPenalty > 0) {
          updated++;
        }
      } catch (err) {
        console.error(`Failed to process decay for contact ${contact.id}:`, err);
      }
    }

    return { processed, updated };
  }
}
