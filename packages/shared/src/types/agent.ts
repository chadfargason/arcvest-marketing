/**
 * ArcVest Marketing Automation System
 * Agent Types - TypeScript interfaces for agent infrastructure
 */

// ===========================================
// Agent Constants
// ===========================================

export const AGENT_NAMES = [
  'orchestrator',
  'content',
  'creative',
  'paid_media',
  'seo',
  'analytics',
  'research',
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const TASK_TYPES = [
  'content_creation',
  'content_publish',
  'ad_optimization',
  'ad_copy_creation',
  'rank_check',
  'content_brief',
  'analytics_sync',
  'report_generation',
  'competitor_scan',
  'news_scan',
  'gmail_sync',
  'sequence_email',
  'lead_score_update',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const AGENT_TASK_STATUSES = [
  'pending',
  'in_progress',
  'awaiting_approval',
  'complete',
  'failed',
] as const;
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number];

export const APPROVAL_TYPES = [
  'blog_post',
  'linkedin_post',
  'twitter_thread',
  'newsletter',
  'ad_copy',
  'video_script',
  'email_sequence',
  'campaign_budget',
  'campaign_new',
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'revision_requested',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ApprovalPriority = (typeof APPROVAL_PRIORITIES)[number];

// ===========================================
// Task Queue
// ===========================================

export interface AgentTask {
  id: string;
  created_at: string;

  type: TaskType;
  priority: number; // 1 (highest) to 5 (lowest)
  status: AgentTaskStatus;
  assigned_agent: AgentName;

  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;

  created_by: string;
  due_at: string | null;
  completed_at: string | null;

  attempts: number;
  last_error: string | null;
}

export interface AgentTaskInsert {
  type: TaskType;
  priority?: number;
  status?: AgentTaskStatus;
  assigned_agent: AgentName;
  payload: Record<string, unknown>;
  created_by: string;
  due_at?: string | null;
}

export interface AgentTaskUpdate {
  status?: AgentTaskStatus;
  result?: Record<string, unknown> | null;
  completed_at?: string | null;
  attempts?: number;
  last_error?: string | null;
}

// ===========================================
// Approval Queue
// ===========================================

export interface ApprovalItem {
  id: string;
  created_at: string;

  type: ApprovalType;
  status: ApprovalStatus;
  priority: ApprovalPriority;

  title: string;
  summary: string | null;
  content: Record<string, unknown>;

  created_by: AgentName;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;

  related_task_id: string | null;
}

export interface ApprovalItemInsert {
  type: ApprovalType;
  status?: ApprovalStatus;
  priority?: ApprovalPriority;
  title: string;
  summary?: string | null;
  content: Record<string, unknown>;
  created_by: AgentName;
  related_task_id?: string | null;
}

export interface ApprovalItemUpdate {
  status?: ApprovalStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  feedback?: string | null;
}

// ===========================================
// Agent Events
// ===========================================

export const AGENT_EVENT_TYPES = {
  // Contact events
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_STATUS_CHANGED: 'contact.status_changed',
  CONTACT_SCORE_CHANGED: 'contact.score_changed',
  CONTACT_BECAME_HOT: 'contact.became_hot',

  // Interaction events
  INTERACTION_LOGGED: 'interaction.logged',
  EMAIL_RECEIVED: 'email.received',
  EMAIL_SENT: 'email.sent',

  // Sequence events
  SEQUENCE_ENROLLED: 'sequence.enrolled',
  SEQUENCE_EMAIL_SENT: 'sequence.email_sent',
  SEQUENCE_COMPLETED: 'sequence.completed',

  // Task events
  TASK_CREATED: 'task.created',
  TASK_DUE: 'task.due',
  TASK_COMPLETED: 'task.completed',

  // Campaign events
  CAMPAIGN_STARTED: 'campaign.started',
  CAMPAIGN_PAUSED: 'campaign.paused',
  CAMPAIGN_BUDGET_ALERT: 'campaign.budget_alert',

  // Content events
  CONTENT_CREATED: 'content.created',
  CONTENT_APPROVED: 'content.approved',
  CONTENT_PUBLISHED: 'content.published',

  // Performance events
  PERFORMANCE_ANOMALY: 'performance.anomaly',
  PERFORMANCE_GOAL_AT_RISK: 'performance.goal_at_risk',

  // Research events
  COMPETITOR_CONTENT: 'research.competitor_content',
  REGULATORY_UPDATE: 'research.regulatory_update',
} as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[keyof typeof AGENT_EVENT_TYPES];

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: string;
  source_agent: AgentName | 'system';
  payload: Record<string, unknown>;
}

// ===========================================
// Agent Message (Inter-agent communication)
// ===========================================

export const MESSAGE_TYPES = ['request', 'response', 'event', 'error'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface AgentMessage {
  id: string;
  timestamp: string;
  from_agent: AgentName | 'system';
  to_agent: AgentName | 'orchestrator';
  type: MessageType;
  action: string;
  payload: Record<string, unknown>;
  priority: number;
  requires_response: boolean;
  correlation_id: string | null;
  expires_at: string | null;
}

// ===========================================
// Workflow Types
// ===========================================

export const WORKFLOW_TYPES = [
  'new_blog_post',
  'new_ad_campaign',
  'content_repurpose',
  'lead_nurture',
] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export interface WorkflowStep {
  agent: AgentName;
  action: string;
  requires_approval: boolean;
}

export interface WorkflowDefinition {
  type: WorkflowType;
  steps: WorkflowStep[];
}

export interface WorkflowInstance {
  id: string;
  type: WorkflowType;
  status: 'running' | 'paused' | 'completed' | 'failed';
  current_step: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ===========================================
// Agent Status
// ===========================================

export interface AgentStatus {
  name: AgentName;
  is_running: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  tasks_pending: number;
  tasks_completed_today: number;
}

// ===========================================
// Scheduling
// ===========================================

export interface ScheduleConfig {
  job_name: string;
  agent: AgentName;
  action: string;
  cron_expression: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
}
