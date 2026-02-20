/**
 * ArcVest Marketing Automation System
 * Database Types - TypeScript interfaces for all Supabase tables
 */

// ===========================================
// Enums and Constants
// ===========================================

export const CONTACT_STATUSES = [
  'new_lead',
  'contacted',
  'consultation_scheduled',
  'consultation_completed',
  'proposal_sent',
  'client',
  'closed_lost',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const ASSET_RANGES = ['under_500k', '500k_to_2m', 'over_2m'] as const;
export type AssetRange = (typeof ASSET_RANGES)[number];

export const INTERACTION_TYPES = [
  'email_inbound',
  'email_outbound',
  'call_inbound',
  'call_outbound',
  'meeting',
  'form_submission',
  'website_visit',
  'ad_click',
  'email_opened',
  'email_clicked',
  'whitepaper_download',
  'note',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_OUTCOMES = ['positive', 'neutral', 'negative', 'no_response'] as const;
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];

export const CAMPAIGN_TYPES = [
  'google_search',
  'google_display',
  'google_youtube',
  'linkedin',
  'email',
  'content',
  'other',
  'meta_traffic',
  'meta_leads',
  'meta_awareness',
  'meta_conversions',
  'meta_engagement',
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_PLATFORMS = ['google', 'meta', 'other'] as const;
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number];

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SEQUENCE_TRIGGER_TYPES = [
  'form_submission',
  'manual',
  'tag_added',
  'status_change',
  'lead_score_threshold',
] as const;
export type SequenceTriggerType = (typeof SEQUENCE_TRIGGER_TYPES)[number];

export const SEQUENCE_STATUSES = ['draft', 'active', 'paused'] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['active', 'completed', 'unsubscribed', 'paused'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const TASK_STATUSES = ['pending', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const LEAD_SOURCE_CATEGORIES = ['paid', 'organic', 'referral', 'direct'] as const;
export type LeadSourceCategory = (typeof LEAD_SOURCE_CATEGORIES)[number];

export const TEAM_MEMBERS = ['chad', 'erik'] as const;
export type TeamMember = (typeof TEAM_MEMBERS)[number];

// ===========================================
// Core Tables
// ===========================================

export interface LeadSource {
  id: string;
  name: string;
  category: LeadSourceCategory;
  created_at: string;
}

export interface Contact {
  id: string;
  created_at: string;
  updated_at: string;

  // Identity
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;

  // Source & Attribution
  source: string | null;
  source_detail: string | null;

  // Status & Pipeline
  status: ContactStatus;
  status_changed_at: string;

  // Scoring & Qualification
  lead_score: number;
  estimated_assets: AssetRange | null;

  // Location
  city: string | null;
  state: string | null;

  // Assignment
  assigned_to: TeamMember | null;

  // Notes & Tags
  notes: string | null;
  tags: string[];

  // Integration Links
  gmail_thread_ids: string[];
  anonymous_id: string | null;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface ContactInsert {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  source?: string | null;
  source_detail?: string | null;
  status?: ContactStatus;
  estimated_assets?: AssetRange | null;
  city?: string | null;
  state?: string | null;
  assigned_to?: TeamMember | null;
  notes?: string | null;
  tags?: string[];
  anonymous_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContactUpdate {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  source?: string | null;
  source_detail?: string | null;
  status?: ContactStatus;
  lead_score?: number;
  estimated_assets?: AssetRange | null;
  city?: string | null;
  state?: string | null;
  assigned_to?: TeamMember | null;
  notes?: string | null;
  tags?: string[];
  gmail_thread_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  created_at: string;
  contact_id: string;

  // Type & Channel
  type: InteractionType;
  channel: string | null;

  // Content
  subject: string | null;
  summary: string | null;

  // Integration Links
  gmail_message_id: string | null;
  gmail_thread_id: string | null;

  // Metrics
  duration_minutes: number | null;

  // Outcome
  outcome: InteractionOutcome | null;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface InteractionInsert {
  contact_id: string;
  type: InteractionType;
  channel?: string | null;
  subject?: string | null;
  summary?: string | null;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  duration_minutes?: number | null;
  outcome?: InteractionOutcome | null;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Campaigns
// ===========================================

export interface Campaign {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  type: CampaignType;
  status: CampaignStatus;

  // Budget
  budget_monthly: number | null;

  // Dates
  start_date: string | null;
  end_date: string | null;

  // Targeting
  target_audience: string | null;

  // External IDs
  google_ads_campaign_id: string | null;

  // Platform
  platform: CampaignPlatform;

  // Meta external ID
  meta_campaign_id: string | null;

  // Budget (Meta uses daily/lifetime)
  daily_budget: number | null;
  lifetime_budget: number | null;

  // Objective (Meta campaigns)
  objective: string | null;

  // Notes
  notes: string | null;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface CampaignInsert {
  name: string;
  type: CampaignType;
  status?: CampaignStatus;
  budget_monthly?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  target_audience?: string | null;
  google_ads_campaign_id?: string | null;
  platform?: CampaignPlatform;
  meta_campaign_id?: string | null;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  objective?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  date: string;

  // Performance
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;

  // Calculated
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
}

// ===========================================
// Email Sequences
// ===========================================

export interface EmailSequence {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  description: string | null;

  // Trigger
  trigger_type: SequenceTriggerType;
  trigger_config: Record<string, unknown>;

  status: SequenceStatus;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface EmailSequenceInsert {
  name: string;
  description?: string | null;
  trigger_type: SequenceTriggerType;
  trigger_config?: Record<string, unknown>;
  status?: SequenceStatus;
  metadata?: Record<string, unknown>;
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;

  step_order: number;
  delay_days: number;

  // Content
  subject: string;
  body: string;

  status: 'active' | 'paused';
}

export interface EmailSequenceStepInsert {
  sequence_id: string;
  step_order: number;
  delay_days?: number;
  subject: string;
  body: string;
  status?: 'active' | 'paused';
}

export interface SequenceEnrollment {
  id: string;
  contact_id: string;
  sequence_id: string;

  enrolled_at: string;
  current_step: number;
  status: EnrollmentStatus;

  next_email_at: string | null;
  last_email_sent_at: string | null;
}

export interface SequenceEnrollmentInsert {
  contact_id: string;
  sequence_id: string;
  current_step?: number;
  status?: EnrollmentStatus;
  next_email_at?: string | null;
}

// ===========================================
// Website Tracking
// ===========================================

export interface WebsiteSession {
  id: string;
  created_at: string;

  // Identity
  anonymous_id: string;
  contact_id: string | null;

  // Attribution
  landing_page: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  keyword: string | null;

  // Engagement
  pages_viewed: number;
  duration_seconds: number | null;

  // Conversion
  converted: boolean;
  conversion_type: string | null;

  // Metadata
  metadata: Record<string, unknown>;
}

// ===========================================
// Tasks
// ===========================================

export interface Task {
  id: string;
  created_at: string;
  updated_at: string;

  // Link to contact
  contact_id: string | null;

  // Assignment
  assigned_to: TeamMember;

  // Content
  title: string;
  description: string | null;

  // Scheduling
  due_date: string | null;

  // Status
  status: TaskStatus;
  completed_at: string | null;

  // Priority
  priority: TaskPriority;

  // Origin
  created_by: string | null;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface TaskInsert {
  contact_id?: string | null;
  assigned_to: TeamMember;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TaskUpdate {
  contact_id?: string | null;
  assigned_to?: TeamMember;
  title?: string;
  description?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Activity Log
// ===========================================

export interface ActivityLog {
  id: string;
  created_at: string;

  // Who
  actor: string;

  // What
  action: string;

  // On what
  entity_type: string;
  entity_id: string | null;

  // Details
  details: Record<string, unknown>;
}

export interface ActivityLogInsert {
  actor: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
}

// ===========================================
// System State
// ===========================================

export interface SystemState {
  key: string;
  value: unknown;
  updated_at: string;
}

// ===========================================
// Meta Ads
// ===========================================

export const META_AD_SET_STATUSES = ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'] as const;
export type MetaAdSetStatus = (typeof META_AD_SET_STATUSES)[number];

export const META_INSIGHT_OBJECT_TYPES = ['account', 'campaign', 'adset', 'ad'] as const;
export type MetaInsightObjectType = (typeof META_INSIGHT_OBJECT_TYPES)[number];

export interface MetaAdSet {
  id: string;
  created_at: string;
  updated_at: string;
  campaign_id: string;
  meta_ad_set_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_amount: number | null;
  bid_strategy: string | null;
  optimization_goal: string | null;
  targeting: Record<string, unknown>;
  placements: Record<string, unknown>;
  start_time: string | null;
  end_time: string | null;
}

export interface MetaAdSetInsert {
  campaign_id: string;
  meta_ad_set_id: string;
  name: string;
  status?: string;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  bid_amount?: number | null;
  bid_strategy?: string | null;
  optimization_goal?: string | null;
  targeting?: Record<string, unknown>;
  placements?: Record<string, unknown>;
  start_time?: string | null;
  end_time?: string | null;
}

export interface MetaAd {
  id: string;
  created_at: string;
  updated_at: string;
  ad_set_id: string;
  meta_ad_id: string;
  name: string;
  status: string;
  creative: Record<string, unknown>;
  source_content_id: string | null;
}

export interface MetaAdInsert {
  ad_set_id: string;
  meta_ad_id: string;
  name: string;
  status?: string;
  creative?: Record<string, unknown>;
  source_content_id?: string | null;
}

export interface MetaInsight {
  id: string;
  meta_object_id: string;
  object_type: MetaInsightObjectType;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  actions: unknown[];
  cost_per_action: unknown[];
  breakdowns: Record<string, unknown>;
}

export interface MetaInsightInsert {
  meta_object_id: string;
  object_type: MetaInsightObjectType;
  date: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  reach?: number;
  frequency?: number;
  cpc?: number | null;
  cpm?: number | null;
  ctr?: number | null;
  actions?: unknown[];
  cost_per_action?: unknown[];
  breakdowns?: Record<string, unknown>;
}

// ===========================================
// Views
// ===========================================

export interface LeadFunnelSummary {
  status: ContactStatus;
  count: number;
  avg_score: number;
  avg_days_in_status: number;
}

export interface SourcePerformance {
  source: string | null;
  total_leads: number;
  clients_won: number;
  conversion_rate: number;
  avg_lead_score: number;
}

export interface HotLead extends Contact {
  last_interaction: string | null;
}

export interface PendingTask extends Task {
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
}

export interface SequenceEmailQueue {
  enrollment_id: string;
  contact_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  sequence_name: string;
  subject: string;
  body: string;
  next_email_at: string;
}
