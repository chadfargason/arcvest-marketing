/**
 * Integration Tests for ArcVest Marketing Automation
 *
 * Tests core logic without external dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  leadScoringConfig,
  pipelineStagesConfig,
  assetRangesConfig,
  budgetParametersConfig,
  contentRulesConfig,
  assignmentRulesConfig,
  agentSchedulesConfig,
  agentSchedulesList,
  getActionPoints,
  getFitBonus,
  classifyLead,
  checkThresholdCrossing,
} from '../config';
import {
  contactInsertSchema,
  taskInsertSchema,
  interactionInsertSchema,
  isValidEmail,
  isValidUuid,
  isValidPhone,
} from '../utils/validators';
import {
  formatCurrency,
  formatPhone,
  formatDate,
  formatPercent,
  truncate,
  formatNumber,
  formatContactName,
  formatInitials,
  formatLeadScore,
  slugify,
} from '../utils/formatters';
import type { Contact, Task, Interaction } from '../types';

describe('Lead Scoring Configuration', () => {
  it('should have scoring actions defined', () => {
    expect(leadScoringConfig.actions).toBeDefined();
    expect(Object.keys(leadScoringConfig.actions).length).toBeGreaterThan(0);
  });

  it('should have positive scores for engagement actions', () => {
    expect(leadScoringConfig.actions.email_opened).toBeGreaterThan(0);
    expect(leadScoringConfig.actions.email_clicked).toBeGreaterThan(0);
    expect(leadScoringConfig.actions.form_submission).toBeGreaterThan(0);
  });

  it('should have thresholds defined', () => {
    expect(leadScoringConfig.thresholds).toBeDefined();
    expect(leadScoringConfig.thresholds.hot).toBeGreaterThan(leadScoringConfig.thresholds.warm);
  });

  it('should have decay configuration', () => {
    expect(leadScoringConfig.decayConfig).toBeDefined();
    expect(leadScoringConfig.decayConfig.startAfterDays).toBeGreaterThan(0);
    expect(leadScoringConfig.decayConfig.pointsPerPeriod).toBeGreaterThan(0);
  });

  it('should classify leads correctly', () => {
    expect(classifyLead(80)).toBe('hot');
    expect(classifyLead(50)).toBe('warm');
    expect(classifyLead(20)).toBe('cold');
  });

  it('should detect threshold crossings', () => {
    expect(checkThresholdCrossing(30, 75)).toBe('became_hot');
    expect(checkThresholdCrossing(30, 50)).toBe('became_warm');
    expect(checkThresholdCrossing(50, 20)).toBe('became_cold');
    expect(checkThresholdCrossing(50, 55)).toBeNull();
  });

  it('should get action points', () => {
    expect(getActionPoints('email_opened')).toBe(5);
    expect(getActionPoints('form_submission')).toBe(30);
  });

  it('should get fit bonus', () => {
    expect(getFitBonus('over_2m')).toBe(25);
    expect(getFitBonus('under_500k')).toBe(5);
    expect(getFitBonus(null)).toBe(0);
  });
});

describe('Pipeline Stages Configuration', () => {
  it('should have ordered stages', () => {
    expect(pipelineStagesConfig.stages).toBeDefined();
    expect(pipelineStagesConfig.stages.length).toBeGreaterThan(0);
  });

  it('should have unique stage orders', () => {
    const orders = pipelineStagesConfig.stages.map((s) => s.order);
    const uniqueOrders = [...new Set(orders)];
    expect(orders.length).toBe(uniqueOrders.length);
  });

  it('should have stage names', () => {
    pipelineStagesConfig.stages.forEach((stage) => {
      expect(stage.name).toBeDefined();
      expect(stage.name.length).toBeGreaterThan(0);
    });
  });
});

describe('Asset Ranges Configuration', () => {
  it('should have defined ranges', () => {
    expect(assetRangesConfig.ranges).toBeDefined();
    expect(assetRangesConfig.ranges.length).toBeGreaterThan(0);
  });

  it('should have non-overlapping ranges', () => {
    const ranges = assetRangesConfig.ranges.sort((a, b) => a.min - b.min);
    for (let i = 0; i < ranges.length - 1; i++) {
      const currentRange = ranges[i];
      const nextRange = ranges[i + 1];
      if (currentRange && nextRange && currentRange.max !== null) {
        expect(currentRange.max).toBeLessThanOrEqual(nextRange.min);
      }
    }
  });

  it('should have labels for all ranges', () => {
    assetRangesConfig.ranges.forEach((range) => {
      expect(range.label).toBeDefined();
      expect(range.id).toBeDefined();
    });
  });
});

describe('Budget Parameters Configuration', () => {
  it('should have monthly budget defined', () => {
    expect(budgetParametersConfig.monthly_budget).toBeDefined();
    expect(budgetParametersConfig.monthly_budget).toBeGreaterThan(0);
  });

  it('should have scaling configuration', () => {
    expect(budgetParametersConfig.scaling).toBeDefined();
    expect(budgetParametersConfig.scaling.enabled).toBeDefined();
  });

  it('should have approval thresholds', () => {
    expect(budgetParametersConfig.requires_approval).toBeDefined();
    expect(budgetParametersConfig.requires_approval.budget_increase_percent).toBeDefined();
  });

  it('should have auto-pause rules', () => {
    expect(budgetParametersConfig.auto_pause).toBeDefined();
    expect(budgetParametersConfig.auto_pause.keyword_cpc_limit).toBeDefined();
  });
});

describe('Content Rules Configuration', () => {
  it('should have weekly targets defined', () => {
    expect(contentRulesConfig.weekly_targets).toBeDefined();
    expect(contentRulesConfig.weekly_targets.blog_posts).toBeDefined();
  });

  it('should have publishing schedules', () => {
    expect(contentRulesConfig.publishing_schedules).toBeDefined();
    expect(contentRulesConfig.publishing_schedules.length).toBeGreaterThan(0);
  });

  it('should have approval tiers', () => {
    expect(contentRulesConfig.approval_tiers).toBeDefined();
    expect(contentRulesConfig.approval_tiers.quick_review).toBeDefined();
  });
});

describe('Assignment Rules Configuration', () => {
  it('should have advisors defined', () => {
    expect(assignmentRulesConfig.advisors).toBeDefined();
    expect(assignmentRulesConfig.advisors.length).toBeGreaterThan(0);
  });

  it('should have advisor info', () => {
    expect(assignmentRulesConfig.advisorInfo).toBeDefined();
    expect(assignmentRulesConfig.advisorInfo.length).toBeGreaterThan(0);
  });

  it('should have initial assignment config', () => {
    expect(assignmentRulesConfig.initialLastAssigned).toBeDefined();
  });
});

describe('Agent Schedules Configuration', () => {
  it('should have agent schedules defined', () => {
    expect(agentSchedulesConfig).toBeDefined();
    expect(Object.keys(agentSchedulesConfig).length).toBeGreaterThan(0);
  });

  it('should have schedules list', () => {
    expect(agentSchedulesList).toBeDefined();
    expect(agentSchedulesList.length).toBeGreaterThan(0);
  });

  it('should have agent and schedules for all entries', () => {
    agentSchedulesList.forEach((config) => {
      expect(config.agent).toBeDefined();
      expect(config.schedules).toBeDefined();
      expect(config.schedules.length).toBeGreaterThan(0);
      config.schedules.forEach((schedule) => {
        expect(schedule.cron).toBeDefined();
        expect(schedule.name).toBeDefined();
      });
    });
  });
});

describe('Validators', () => {
  describe('contactInsertSchema', () => {
    it('should validate a valid contact', () => {
      const validContact = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        source: 'website',
      };
      const result = contactInsertSchema.safeParse(validContact);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidContact = {
        email: 'invalid-email',
        first_name: 'John',
        last_name: 'Doe',
      };
      const result = contactInsertSchema.safeParse(invalidContact);
      expect(result.success).toBe(false);
    });
  });

  describe('taskInsertSchema', () => {
    it('should validate a valid task', () => {
      const validTask = {
        title: 'Follow up call',
        assigned_to: 'chad',
        due_date: new Date().toISOString(),
        contact_id: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = taskInsertSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should reject task without title', () => {
      const invalidTask = {
        assigned_to: 'chad',
      };
      const result = taskInsertSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });
  });

  describe('interactionInsertSchema', () => {
    it('should validate a valid interaction', () => {
      const validInteraction = {
        contact_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'email_outbound',
        summary: 'Sent follow-up email',
      };
      const result = interactionInsertSchema.safeParse(validInteraction);
      expect(result.success).toBe(true);
    });

    it('should reject interaction without contact_id', () => {
      const invalidInteraction = {
        type: 'email_outbound',
        summary: 'Sent follow-up email',
      };
      const result = interactionInsertSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
    });
  });

  describe('utility validators', () => {
    it('should validate emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
    });

    it('should validate UUIDs', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUuid('invalid')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(isValidPhone('555-123-4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
    });
  });
});

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('should handle compact format', () => {
      const result = formatCurrency(1500000, { compact: true });
      expect(result).toContain('M');
    });
  });

  describe('formatPhone', () => {
    it('should format 10-digit numbers', () => {
      const result = formatPhone('5551234567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should handle 11-digit numbers with country code', () => {
      const result = formatPhone('15551234567');
      expect(result).toBe('+1 (555) 123-4567');
    });

    it('should return original for non-standard formats', () => {
      const result = formatPhone('12345');
      expect(result).toBe('12345');
    });
  });

  describe('formatDate', () => {
    it('should format Date objects', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toBeDefined();
      expect(result).toContain('2024');
    });

    it('should format ISO strings', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toBeDefined();
    });
  });

  describe('formatPercent', () => {
    it('should format decimal percentages', () => {
      expect(formatPercent(0.75)).toBe('75.0%');
    });

    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });

    it('should handle 100%', () => {
      expect(formatPercent(1)).toBe('100.0%');
    });

    it('should respect decimals parameter', () => {
      expect(formatPercent(0.755, 2)).toBe('75.50%');
    });
  });

  describe('formatNumber', () => {
    it('should format with commas', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should handle compact format', () => {
      const result = formatNumber(1500000, { compact: true });
      expect(result).toContain('M');
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate long strings', () => {
      const result = truncate('This is a very long string that should be truncated', 20);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
    });
  });

  describe('formatContactName', () => {
    it('should format full name', () => {
      expect(formatContactName('John', 'Doe', 'john@test.com')).toBe('John Doe');
    });

    it('should handle first name only', () => {
      expect(formatContactName('John', null, 'john@test.com')).toBe('John');
    });

    it('should fall back to email', () => {
      expect(formatContactName(null, null, 'john@test.com')).toBe('john@test.com');
    });
  });

  describe('formatInitials', () => {
    it('should get initials from full name', () => {
      expect(formatInitials('John', 'Doe', 'john@test.com')).toBe('JD');
    });

    it('should handle first name only', () => {
      expect(formatInitials('John', null, 'john@test.com')).toBe('JO');
    });
  });

  describe('formatLeadScore', () => {
    it('should classify hot leads', () => {
      const result = formatLeadScore(80);
      expect(result.label).toBe('Hot');
      expect(result.score).toBe(80);
    });

    it('should classify warm leads', () => {
      const result = formatLeadScore(50);
      expect(result.label).toBe('Warm');
    });

    it('should classify cold leads', () => {
      const result = formatLeadScore(20);
      expect(result.label).toBe('Cold');
    });
  });

  describe('slugify', () => {
    it('should create URL-safe slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('This is a Test!')).toBe('this-is-a-test');
    });
  });
});

describe('Type Exports', () => {
  it('should export Contact type', () => {
    const contact: Partial<Contact> = {
      id: '123',
      email: 'test@test.com',
    };
    expect(contact).toBeDefined();
  });

  it('should export Task type', () => {
    const task: Partial<Task> = {
      id: '123',
      title: 'Test task',
    };
    expect(task).toBeDefined();
  });

  it('should export Interaction type', () => {
    const interaction: Partial<Interaction> = {
      id: '123',
      type: 'email_outbound',
    };
    expect(interaction).toBeDefined();
  });
});
