/**
 * ArcVest Marketing Automation System
 * Content Rules Configuration
 *
 * Defines content calendar rules, approval tiers, and publishing schedules.
 */

import type { ContentType, ApprovalType } from '../types';

export interface WeeklyTargets {
  blog_posts: number;
  linkedin_posts: number;
  twitter_threads: number;
  newsletter: number; // per month typically
}

export interface PublishingSchedule {
  content_type: ContentType;
  days: string[];
  time: string; // 24-hour format
}

export interface ContentMix {
  educational: number;
  thought_leadership: number;
  promotional: number;
}

export interface ApprovalTierConfig {
  auto_publish: ApprovalType[];
  quick_review: ApprovalType[];
  full_review: ApprovalType[];
  require_compliance_review: ApprovalType[];
}

export interface ContentRulesConfig {
  weekly_targets: WeeklyTargets;
  publishing_schedules: PublishingSchedule[];
  content_mix: ContentMix;
  evergreen_rotation_days: number;
  approval_tiers: ApprovalTierConfig;
}

export const contentRulesConfig: ContentRulesConfig = {
  // Weekly content targets
  weekly_targets: {
    blog_posts: 1,
    linkedin_posts: 3,
    twitter_threads: 0, // Not currently active
    newsletter: 0.5, // Every other week
  },

  // Publishing schedule by content type
  publishing_schedules: [
    {
      content_type: 'blog_post',
      days: ['Tuesday', 'Thursday'],
      time: '09:00',
    },
    {
      content_type: 'linkedin_post',
      days: ['Monday', 'Wednesday', 'Friday'],
      time: '09:00',
    },
    {
      content_type: 'linkedin_article',
      days: ['Thursday'],
      time: '10:00',
    },
    {
      content_type: 'newsletter',
      days: ['Thursday'],
      time: '10:00',
    },
  ],

  // Content mix percentages (should sum to 1.0)
  content_mix: {
    educational: 0.5, // 50% educational/research-based
    thought_leadership: 0.3, // 30% opinions, perspectives
    promotional: 0.2, // 20% about ArcVest specifically
  },

  // Republish/repromote evergreen content every X days
  evergreen_rotation_days: 90,

  // Approval requirements by content type
  approval_tiers: {
    // Can be published automatically (derived from approved content)
    auto_publish: [],

    // Quick review before publish (Chad or Erik glance)
    quick_review: ['blog_post', 'linkedin_post'],

    // Full review required
    full_review: ['linkedin_post', 'newsletter', 'video_script', 'email_sequence'],

    // Requires compliance review
    require_compliance_review: ['ad_copy', 'campaign_new'],
  },
};

/**
 * Get publishing schedule for a content type
 */
export function getPublishingSchedule(contentType: ContentType): PublishingSchedule | undefined {
  return contentRulesConfig.publishing_schedules.find(
    (schedule) => schedule.content_type === contentType
  );
}

/**
 * Check if content requires approval
 */
export function requiresApproval(approvalType: ApprovalType): boolean {
  const { auto_publish } = contentRulesConfig.approval_tiers;
  return !auto_publish.includes(approvalType);
}

/**
 * Get approval tier for content type
 */
export function getApprovalTier(
  approvalType: ApprovalType
): 'auto' | 'quick' | 'full' | 'compliance' {
  const { approval_tiers } = contentRulesConfig;

  if (approval_tiers.auto_publish.includes(approvalType)) return 'auto';
  if (approval_tiers.require_compliance_review.includes(approvalType)) return 'compliance';
  if (approval_tiers.full_review.includes(approvalType)) return 'full';
  if (approval_tiers.quick_review.includes(approvalType)) return 'quick';

  return 'full'; // Default to full review
}

/**
 * Get the best publishing day for a content type
 */
export function getNextPublishingDay(contentType: ContentType, fromDate: Date = new Date()): Date {
  const schedule = getPublishingSchedule(contentType);
  if (!schedule) return fromDate;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDays = schedule.days.map((day) => dayNames.indexOf(day));

  const result = new Date(fromDate);
  let daysChecked = 0;

  while (daysChecked < 7) {
    const currentDay = result.getDay();
    if (targetDays.includes(currentDay)) {
      // Set the time
      const [hours, minutes] = schedule.time.split(':').map(Number);
      result.setHours(hours ?? 9, minutes ?? 0, 0, 0);

      // If it's today but past the time, try next occurrence
      if (result > fromDate) {
        return result;
      }
    }

    result.setDate(result.getDate() + 1);
    daysChecked++;
  }

  return result;
}
