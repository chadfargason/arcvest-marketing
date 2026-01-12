/**
 * ArcVest Marketing Automation System
 * Content Types - TypeScript interfaces for content management
 */

// ===========================================
// Content Constants
// ===========================================

export const CONTENT_TYPES = [
  'blog_post',
  'linkedin_post',
  'linkedin_article',
  'twitter_thread',
  'newsletter',
  'whitepaper',
  'video_script',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = [
  'idea',
  'assigned',
  'outline',
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

// ===========================================
// Content Calendar
// ===========================================

export interface ContentCalendarEntry {
  id: string;
  created_at: string;
  updated_at: string;

  // Scheduling
  scheduled_date: string | null;
  status: ContentStatus;

  // Content
  content_type: ContentType;
  title: string | null;
  topic: string | null;
  keywords: string[];
  outline: string | null;
  draft: string | null;
  final_content: string | null;

  // Source/Derivation
  source_content_id: string | null;

  // SEO
  meta_description: string | null;
  target_keyword: string | null;

  // Publishing
  published_url: string | null;
  published_at: string | null;
  wordpress_post_id: number | null;

  // Performance
  views: number;
  engagements: number;
  leads_attributed: number;

  // Metadata
  metadata: Record<string, unknown>;
}

export interface ContentCalendarEntryInsert {
  scheduled_date?: string | null;
  status?: ContentStatus;
  content_type: ContentType;
  title?: string | null;
  topic?: string | null;
  keywords?: string[];
  outline?: string | null;
  draft?: string | null;
  source_content_id?: string | null;
  target_keyword?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContentCalendarEntryUpdate {
  scheduled_date?: string | null;
  status?: ContentStatus;
  title?: string | null;
  topic?: string | null;
  keywords?: string[];
  outline?: string | null;
  draft?: string | null;
  final_content?: string | null;
  meta_description?: string | null;
  target_keyword?: string | null;
  published_url?: string | null;
  published_at?: string | null;
  wordpress_post_id?: number | null;
  views?: number;
  engagements?: number;
  leads_attributed?: number;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Content Templates
// ===========================================

export interface ContentTemplate {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  content_type: ContentType;
  template: string;
  instructions: string | null;
  examples: Record<string, unknown>[];
}

// ===========================================
// Creative Assets
// ===========================================

export const CREATIVE_ASSET_TYPES = [
  'ad_copy',
  'display_spec',
  'video_script',
  'landing_page',
] as const;
export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];

export const CREATIVE_ASSET_STATUSES = [
  'draft',
  'approved',
  'active',
  'paused',
  'retired',
] as const;
export type CreativeAssetStatus = (typeof CREATIVE_ASSET_STATUSES)[number];

export interface CreativeAsset {
  id: string;
  created_at: string;
  updated_at: string;

  asset_type: CreativeAssetType;
  name: string;
  content: AdCopy | VideoScript | DisplaySpec | LandingPageContent;

  campaign_id: string | null;
  parent_asset_id: string | null;

  status: CreativeAssetStatus;

  // Performance
  impressions: number;
  clicks: number;
  conversions: number;

  // Metadata
  metadata: Record<string, unknown>;
}

// ===========================================
// Ad Copy (Google RSA Format)
// ===========================================

export interface AdHeadline {
  text: string;
  char_count: number;
  pinned_position?: 1 | 2 | 3 | null;
}

export interface AdDescription {
  text: string;
  char_count: number;
  pinned_position?: 1 | 2 | null;
}

export interface AdCopy {
  headlines: AdHeadline[];
  descriptions: AdDescription[];
  display_path: [string, string];
  final_url: string;
}

// ===========================================
// Video Script
// ===========================================

export interface VideoTextOverlay {
  time: string;
  text: string;
}

export interface VideoScript {
  duration_seconds: number;
  format: 'short_form_ad' | 'educational_short' | 'long_form';
  speaker: 'chad' | 'erik' | 'both' | 'voiceover';

  hook: string;
  problem: string | null;
  solution: string;
  proof: string | null;
  cta: string;

  visual_notes: string | null;
  b_roll_suggestions: string[];
  text_overlays: VideoTextOverlay[];
}

// ===========================================
// Display Ad Spec
// ===========================================

export interface DisplaySpec {
  sizes: string[];
  headline: string;
  subheadline: string | null;
  cta_text: string;
  image_description: string;
  color_scheme: string | null;
  logo_placement: string | null;
}

// ===========================================
// Landing Page Content
// ===========================================

export interface LandingPageContent {
  url: string;
  headline: string;
  subheadline: string | null;
  body_sections: Array<{
    heading: string;
    content: string;
  }>;
  cta_text: string;
  cta_url: string;
}

// ===========================================
// SEO Types
// ===========================================

export interface TrackedKeyword {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  current_rank: number | null;
  previous_rank: number | null;
  url_ranking: string | null;
  target_url: string | null;
  priority: 'primary' | 'secondary' | 'monitor';
  last_checked: string | null;
}

export interface KeywordHistory {
  id: string;
  keyword_id: string;
  date: string;
  rank: number | null;
  url: string | null;
}

export interface ContentOpportunity {
  id: string;
  created_at: string;

  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  current_gap: 'not_ranking' | 'page_2' | 'needs_improvement';
  recommended_action: string | null;
  content_brief: ContentBrief | null;
  status: 'identified' | 'planned' | 'in_progress' | 'published';
  assigned_content_id: string | null;
}

export interface ContentBrief {
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  search_intent: 'informational' | 'commercial' | 'transactional' | 'navigational';

  title_suggestions: string[];
  meta_description: string | null;

  recommended_length: number;
  recommended_structure: {
    h2_headings: string[];
    h3_headings: string[];
  };

  must_include_topics: string[];
  related_keywords: string[];

  competitor_analysis: {
    top_ranking_pages: Array<{
      url: string;
      title: string;
      word_count: number | null;
      key_topics: string[];
    }>;
    content_gap: string | null;
  } | null;

  internal_link_opportunities: Array<{
    target_url: string;
    anchor_text: string;
  }>;
}

// ===========================================
// Research Types
// ===========================================

export interface Competitor {
  id: string;
  domain: string;
  name: string;
  type: 'direct' | 'indirect' | 'content';
  notes: string | null;
  last_scanned: string | null;
}

export interface CompetitorContent {
  id: string;
  competitor_id: string;
  url: string;
  title: string | null;
  type: 'blog' | 'page' | 'whitepaper' | 'video' | 'other';
  published_date: string | null;
  discovered_date: string;
  summary: string | null;
  topics: string[];
  relevance_score: number;
  notes: string | null;
}

export interface NewsArticle {
  id: string;
  source: string;
  url: string;
  title: string;
  published_date: string | null;
  discovered_date: string;
  category: 'industry' | 'regulatory' | 'market' | 'competitor';
  summary: string | null;
  relevance_score: number;
  action_needed: boolean;
  action_type: 'content_opportunity' | 'client_communication' | 'compliance_review' | null;
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
}

export interface ResearchBrief {
  id: string;
  created_at: string;
  type: 'competitor_update' | 'industry_roundup' | 'regulatory_alert';
  title: string;
  summary: string;
  details: Record<string, unknown>;
  recommendations: string[];
  sent_to: string[];
  sent_at: string | null;
}
