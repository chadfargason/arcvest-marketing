// Supabase client
export { getSupabase, createSupabaseClient, resetSupabase, type SupabaseConfig } from './supabase';

// Event Bus
export { EventBus, EventBusClass, type EventMap } from './event-bus';

// Services
export { ContactService, type ContactSearchParams, type ContactSearchResult } from './contact-service';
export { LeadScoringService, type ScoreBreakdown } from './lead-scoring-service';
export { AssignmentService, type AssignmentResult } from './assignment-service';
export { InteractionService, type InteractionWithContact } from './interaction-service';
export { TaskService, type TaskWithContact, type TaskSearchParams } from './task-service';
export {
  SequenceService,
  type SequenceWithSteps,
  type EnrollmentWithDetails,
  type EmailQueueItem,
} from './sequence-service';
export {
  GmailService,
  type GmailConfig,
  type GmailTokens,
  type GmailMessage,
  type SendEmailParams,
  type GmailSyncResult,
} from './gmail-service';

// Re-export types from shared for convenience
export type {
  Contact,
  ContactInsert,
  ContactUpdate,
  Interaction,
  InteractionInsert,
  Task,
  TaskInsert,
  TaskUpdate,
  Campaign,
  EmailSequence,
  EmailSequenceStep,
  SequenceEnrollment,
} from '@arcvest/shared';
