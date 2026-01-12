/**
 * ArcVest Marketing Automation System
 * Assignment Rules Configuration
 *
 * Defines how leads are assigned to team members.
 */

// Advisor type - the two team members
export type Advisor = 'chad' | 'erik';

export interface AdvisorInfo {
  id: Advisor;
  name: string;
  email: string;
  active: boolean;
}

export interface SourceAssignmentRule {
  sources: string[];
  assignTo: Advisor;
  description: string;
}

export interface TagAssignmentRule {
  tag: string;
  assignTo: Advisor;
  description: string;
}

export interface AssignmentRulesConfig {
  advisors: Advisor[];
  advisorInfo: AdvisorInfo[];
  sourceRules: SourceAssignmentRule[];
  tagRules: TagAssignmentRule[];
  initialLastAssigned: Advisor;
}

export const assignmentRulesConfig: AssignmentRulesConfig = {
  // Active advisors for round-robin
  advisors: ['chad', 'erik'],

  // Team member information
  advisorInfo: [
    {
      id: 'chad',
      name: 'Chad',
      email: 'chad@arcvest.com',
      active: true,
    },
    {
      id: 'erik',
      name: 'Erik',
      email: 'erik@arcvest.com',
      active: true,
    },
  ],

  // Source-based assignment rules
  sourceRules: [
    // Example: Client referrals always go to Chad
    // {
    //   sources: ['referral_client'],
    //   assignTo: 'chad',
    //   description: 'Client referrals always go to Chad',
    // },
  ],

  // Tag-based assignment rules
  tagRules: [
    // Example: High-value leads go to Erik
    // {
    //   tag: 'high-value',
    //   assignTo: 'erik',
    //   description: 'High-value tagged leads go to Erik',
    // },
  ],

  // For round robin tracking - Erik is last, so Chad gets the first lead
  initialLastAssigned: 'erik',
};

/**
 * Get active advisors
 */
export function getActiveAdvisors(): AdvisorInfo[] {
  return assignmentRulesConfig.advisorInfo.filter((advisor) => advisor.active);
}

/**
 * Get advisor by ID
 */
export function getAdvisor(id: Advisor): AdvisorInfo | undefined {
  return assignmentRulesConfig.advisorInfo.find((advisor) => advisor.id === id);
}

/**
 * Get advisor name by ID
 */
export function getAdvisorName(id: Advisor): string {
  const advisor = getAdvisor(id);
  return advisor?.name ?? 'Unknown';
}

/**
 * Get advisor email by ID
 */
export function getAdvisorEmail(id: Advisor): string {
  const advisor = getAdvisor(id);
  return advisor?.email ?? '';
}

/**
 * Get next assignee in round robin
 */
export function getNextRoundRobinAssignee(lastAssigned: Advisor): Advisor {
  const { advisors } = assignmentRulesConfig;
  if (advisors.length === 0) {
    throw new Error('No advisors available for assignment');
  }

  const lastIndex = advisors.indexOf(lastAssigned);
  const nextIndex = (lastIndex + 1) % advisors.length;

  const nextAdvisor = advisors[nextIndex];
  if (!nextAdvisor) {
    throw new Error('Failed to determine next assignee');
  }

  return nextAdvisor;
}

/**
 * Get advisor options (for dropdowns)
 */
export function getAdvisorOptions(): Array<{ value: Advisor; label: string }> {
  return getActiveAdvisors().map((advisor) => ({
    value: advisor.id,
    label: advisor.name,
  }));
}

// Backwards compatibility - use Advisor type instead of TeamMember for new code
// TeamMember is defined in types/database.ts
