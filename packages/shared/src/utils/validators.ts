/**
 * ArcVest Marketing Automation System
 * Validators Utility
 *
 * Zod schemas for validating inputs and API payloads.
 */

import { z } from 'zod';
import {
  CONTACT_STATUSES,
  ASSET_RANGES,
  INTERACTION_TYPES,
  INTERACTION_OUTCOMES,
  CAMPAIGN_TYPES,
  CAMPAIGN_STATUSES,
  SEQUENCE_TRIGGER_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TEAM_MEMBERS,
} from '../types';

// ===========================================
// Contact Schemas
// ===========================================

export const contactInsertSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1).max(100).optional().nullable(),
  last_name: z.string().min(1).max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  source_detail: z.string().max(200).optional().nullable(),
  status: z.enum(CONTACT_STATUSES).optional(),
  estimated_assets: z.enum(ASSET_RANGES).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  assigned_to: z.enum(TEAM_MEMBERS).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  anonymous_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const contactUpdateSchema = contactInsertSchema.partial().extend({
  lead_score: z.number().int().min(0).optional(),
  gmail_thread_ids: z.array(z.string()).optional(),
});

export const contactSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(CONTACT_STATUSES).optional(),
  source: z.string().optional(),
  assigned_to: z.enum(TEAM_MEMBERS).optional(),
  score_min: z.number().int().min(0).optional(),
  score_max: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ===========================================
// Interaction Schemas
// ===========================================

export const interactionInsertSchema = z.object({
  contact_id: z.string().uuid('Invalid contact ID'),
  type: z.enum(INTERACTION_TYPES),
  channel: z.string().max(50).optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  summary: z.string().optional().nullable(),
  gmail_message_id: z.string().optional().nullable(),
  gmail_thread_id: z.string().optional().nullable(),
  duration_minutes: z.number().int().min(0).optional().nullable(),
  outcome: z.enum(INTERACTION_OUTCOMES).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

// ===========================================
// Campaign Schemas
// ===========================================

export const campaignInsertSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(CAMPAIGN_TYPES),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  budget_monthly: z.number().positive().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  target_audience: z.string().optional().nullable(),
  google_ads_campaign_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const campaignUpdateSchema = campaignInsertSchema.partial();

// ===========================================
// Sequence Schemas
// ===========================================

export const sequenceInsertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  trigger_type: z.enum(SEQUENCE_TRIGGER_TYPES),
  trigger_config: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const sequenceStepInsertSchema = z.object({
  sequence_id: z.string().uuid(),
  step_order: z.number().int().min(1),
  delay_days: z.number().int().min(0).default(0),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  status: z.enum(['active', 'paused']).optional(),
});

export const enrollmentInsertSchema = z.object({
  contact_id: z.string().uuid(),
  sequence_id: z.string().uuid(),
  current_step: z.number().int().min(1).optional(),
  status: z.enum(['active', 'completed', 'unsubscribed', 'paused']).optional(),
  next_email_at: z.string().datetime().optional().nullable(),
});

// ===========================================
// Task Schemas
// ===========================================

export const taskInsertSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  assigned_to: z.enum(TEAM_MEMBERS),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  created_by: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const taskUpdateSchema = taskInsertSchema.partial();

// ===========================================
// Pagination Schema
// ===========================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

// ===========================================
// Common Validators
// ===========================================

export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function isValidUuid(id: string): boolean {
  return z.string().uuid().safeParse(id).success;
}

export function isValidPhone(phone: string): boolean {
  // Basic phone validation - allows various formats
  const phoneRegex = /^[\d\s\-\+\(\)\.]{7,20}$/;
  return phoneRegex.test(phone);
}

// ===========================================
// Type exports for inferred schema types
// These are prefixed with "Validated" to avoid conflicts with database types
// ===========================================

export type ValidatedContactInsert = z.infer<typeof contactInsertSchema>;
export type ValidatedContactUpdate = z.infer<typeof contactUpdateSchema>;
export type ValidatedContactSearch = z.infer<typeof contactSearchSchema>;
export type ValidatedInteractionInsert = z.infer<typeof interactionInsertSchema>;
export type ValidatedCampaignInsert = z.infer<typeof campaignInsertSchema>;
export type ValidatedCampaignUpdate = z.infer<typeof campaignUpdateSchema>;
export type ValidatedSequenceInsert = z.infer<typeof sequenceInsertSchema>;
export type ValidatedSequenceStepInsert = z.infer<typeof sequenceStepInsertSchema>;
export type ValidatedEnrollmentInsert = z.infer<typeof enrollmentInsertSchema>;
export type ValidatedTaskInsert = z.infer<typeof taskInsertSchema>;
export type ValidatedTaskUpdate = z.infer<typeof taskUpdateSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
