/**
 * ArcVest Marketing Automation System
 * Pipeline Stages Configuration
 *
 * Defines the sales pipeline stages and their associated auto-actions.
 */

import type { ContactStatus } from '../types';

export type AutoAction =
  | 'assign_owner'
  | 'enroll_welcome_sequence'
  | 'pause_sequences'
  | 'create_prep_task'
  | 'create_followup_task'
  | 'stop_all_sequences'
  | 'create_onboarding_tasks';

export interface PipelineStage {
  id: ContactStatus;
  name: string;
  order: number;
  description: string;
  auto_actions: AutoAction[];
  color: string; // For UI display
}

export interface PipelineStagesConfig {
  stages: PipelineStage[];
}

export const pipelineStagesConfig: PipelineStagesConfig = {
  stages: [
    {
      id: 'new_lead',
      name: 'New Lead',
      order: 1,
      description: 'Just entered the system, not yet contacted',
      auto_actions: ['assign_owner', 'enroll_welcome_sequence'],
      color: '#3B82F6', // Blue
    },
    {
      id: 'contacted',
      name: 'Contacted',
      order: 2,
      description: 'Initial outreach has been made',
      auto_actions: [],
      color: '#8B5CF6', // Purple
    },
    {
      id: 'consultation_scheduled',
      name: 'Consultation Scheduled',
      order: 3,
      description: 'Discovery call or meeting is on the calendar',
      auto_actions: ['pause_sequences', 'create_prep_task'],
      color: '#F59E0B', // Amber
    },
    {
      id: 'consultation_completed',
      name: 'Consultation Completed',
      order: 4,
      description: 'Had the initial conversation',
      auto_actions: ['create_followup_task'],
      color: '#10B981', // Emerald
    },
    {
      id: 'proposal_sent',
      name: 'Proposal Sent',
      order: 5,
      description: 'Formal proposal or agreement sent',
      auto_actions: [],
      color: '#06B6D4', // Cyan
    },
    {
      id: 'client',
      name: 'Client Won',
      order: 6,
      description: 'Signed and onboarding',
      auto_actions: ['stop_all_sequences', 'create_onboarding_tasks'],
      color: '#22C55E', // Green
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      order: 7,
      description: 'Did not convert',
      auto_actions: ['stop_all_sequences'],
      color: '#EF4444', // Red
    },
  ],
};

/**
 * Get pipeline stage by ID
 */
export function getPipelineStage(id: ContactStatus): PipelineStage | undefined {
  return pipelineStagesConfig.stages.find((stage) => stage.id === id);
}

/**
 * Get pipeline stage name by ID
 */
export function getPipelineStageName(id: ContactStatus): string {
  const stage = getPipelineStage(id);
  return stage?.name ?? 'Unknown';
}

/**
 * Get auto-actions for a stage
 */
export function getStageAutoActions(id: ContactStatus): AutoAction[] {
  const stage = getPipelineStage(id);
  return stage?.auto_actions ?? [];
}

/**
 * Get all active stages (excluding closed states)
 */
export function getActiveStages(): PipelineStage[] {
  return pipelineStagesConfig.stages.filter(
    (stage) => stage.id !== 'client' && stage.id !== 'closed_lost'
  );
}

/**
 * Get stages in order (for Kanban board)
 */
export function getOrderedStages(): PipelineStage[] {
  return [...pipelineStagesConfig.stages].sort((a, b) => a.order - b.order);
}

/**
 * Check if a status represents a "won" lead
 */
export function isWonStatus(status: ContactStatus): boolean {
  return status === 'client';
}

/**
 * Check if a status represents a "lost" lead
 */
export function isLostStatus(status: ContactStatus): boolean {
  return status === 'closed_lost';
}

/**
 * Check if a status is an end state
 */
export function isEndState(status: ContactStatus): boolean {
  return isWonStatus(status) || isLostStatus(status);
}

/**
 * Get next logical stage (for stage progression)
 */
export function getNextStage(currentStatus: ContactStatus): ContactStatus | null {
  const currentStage = getPipelineStage(currentStatus);
  if (!currentStage || isEndState(currentStatus)) return null;

  const nextStage = pipelineStagesConfig.stages.find(
    (stage) => stage.order === currentStage.order + 1
  );

  return nextStage?.id ?? null;
}
