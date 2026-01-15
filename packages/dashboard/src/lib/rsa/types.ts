/**
 * RSA Asset Management Types
 */

// Headline types matching the generation pipeline
export type HeadlineType = 'brand' | 'service' | 'benefit' | 'cta' | 'differentiator' | 'keyword' | 'question';

// Asset status values (must match DB constraint)
export type AssetStatus = 'draft' | 'approved' | 'active' | 'paused' | 'retired';

// Asset group status values
export type AssetGroupStatus = 'draft' | 'pending_review' | 'approved' | 'active' | 'paused' | 'archived';

// Variation types
export type VariationType = 'master' | 'tonal' | 'angle' | 'cta' | 'benefit' | 'urgency' | 'variation';

// Generation method
export type GenerationMethod = 'single_ai' | 'multi_ai_pipeline' | 'variation';

// Single headline
export interface RSAHeadline {
  id?: string;
  text: string;
  type: HeadlineType;
  charCount: number;
  pinPosition?: 1 | 2 | 3;
  impressions?: number;
  clicks?: number;
}

// Single description
export interface RSADescription {
  id?: string;
  text: string;
  charCount: number;
  pinPosition?: 1 | 2;
  impressions?: number;
  clicks?: number;
}

// Creative asset (RSA ad)
export interface RSAAsset {
  id: string;
  created_at: string;
  updated_at: string;

  // Core fields
  name: string;
  asset_type: string;
  status: AssetStatus;
  content: {
    headlines: RSAHeadline[];
    descriptions: RSADescription[];
  };

  // RSA-specific fields
  persona_id: string | null;
  voice_id: string | null;
  variation_number: number | null;
  variation_type: VariationType | null;
  generation_method: GenerationMethod | null;
  compliance_passed: boolean;
  compliance_issues: string[];

  // Management fields
  is_favorite: boolean;
  rating: number | null;
  notes: string | null;
  exported_at: string | null;

  // Relations
  parent_asset_id: string | null;
  campaign_id: string | null;

  // Performance (synced from Google Ads)
  impressions: number;
  clicks: number;
  conversions: number;
}

// Asset group (collection of master + variations)
export interface RSAAssetGroup {
  id: string;
  created_at: string;
  updated_at: string;

  name: string;
  persona_id: string;
  voice_id: string;
  status: AssetGroupStatus;

  master_asset_id: string | null;
  batch_id: string | null;
  campaign_id: string | null;

  total_variations: number;
  approved_variations: number;

  generation_config: {
    variationsRequested?: number;
    processingTimeMs?: number;
    tokensUsed?: number;
  };

  last_generated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

// Generation batch
export interface RSAGenerationBatch {
  id: string;
  created_at: string;
  name: string | null;

  persona_ids: string[];
  voice_ids: string[];
  variations_per_combo: number;

  total_assets_created: number;
  total_groups_created: number;
  processing_time_ms: number | null;

  status: 'pending' | 'running' | 'completed' | 'failed';
}

// Export history record
export interface RSAExportRecord {
  id: string;
  created_at: string;

  export_type: 'google_ads_csv' | 'json' | 'clipboard';
  asset_ids: string[];
  asset_count: number;

  campaign_name: string | null;
  ad_group_name: string | null;
  final_url: string | null;
}

// Filter options for asset queries
export interface RSAAssetFilters {
  personas?: string[];
  voices?: string[];
  status?: AssetStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
  minRating?: number;
  variationType?: VariationType | 'all';
  search?: string;
}

// Pagination
export interface PaginationParams {
  limit: number;
  offset: number;
}

// API response wrapper
export interface RSAAssetsResponse {
  data: RSAAsset[];
  count: number;
  limit: number;
  offset: number;
}

export interface RSABatchesResponse {
  data: RSAGenerationBatch[];
  count: number;
}

// Bulk action types
export type BulkActionType = 'approve' | 'reject' | 'favorite' | 'unfavorite' | 'archive' | 'delete';

export interface BulkActionRequest {
  assetIds: string[];
  action: BulkActionType;
}

// Export request
export interface RSAExportRequest {
  assetIds: string[];
  format: 'google_ads_csv' | 'json';
  campaignName?: string;
  adGroupName?: string;
  finalUrl?: string;
}

// Persona and Voice display info (for UI)
export interface PersonaInfo {
  id: string;
  name: string;
  description: string;
}

export interface VoiceInfo {
  id: string;
  name: string;
  description: string;
}

// Personas list (matches creative/page.tsx)
export const PERSONAS: PersonaInfo[] = [
  { id: 'pre-retiree', name: 'Pre-Retirees (50-65)', description: 'Retirement readiness uncertainty' },
  { id: 'hnw-investor', name: 'High-Net-Worth ($2M+)', description: 'Excessive fees, conflicts' },
  { id: 'fee-conscious', name: 'Fee-Conscious Investors', description: 'Hidden fees frustration' },
  { id: 'business-owner', name: 'Business Owners', description: 'Exit planning complexity' },
  { id: 'recently-retired', name: 'Recent Retirees', description: 'Converting savings to income' },
  { id: 'diy-investor', name: 'DIY Investors', description: 'Portfolio grown too complex' },
  { id: 'wirehouse-refugee', name: 'Wirehouse Dissatisfied', description: 'Product pushing, impersonal' },
  { id: 'professional-couple', name: 'Dual-Income Professionals', description: 'Coordinating two careers' },
];

// Voices list (matches creative/page.tsx)
export const VOICES: VoiceInfo[] = [
  { id: 'educational', name: 'Educational', description: 'Informative, teaching tone' },
  { id: 'direct', name: 'Direct', description: 'Punchy, action-oriented' },
  { id: 'story-driven', name: 'Story-Driven', description: 'Relatable scenarios' },
  { id: 'data-driven', name: 'Data-Driven', description: 'Stats, evidence-focused' },
  { id: 'authority', name: 'Authority', description: 'Credibility-focused' },
];

// Helper functions
export function getPersonaById(id: string): PersonaInfo | undefined {
  return PERSONAS.find(p => p.id === id);
}

export function getVoiceById(id: string): VoiceInfo | undefined {
  return VOICES.find(v => v.id === id);
}

export function getPersonaName(id: string | null): string {
  if (!id) return 'Unknown';
  return getPersonaById(id)?.name || id;
}

export function getVoiceName(id: string | null): string {
  if (!id) return 'Unknown';
  return getVoiceById(id)?.name || id;
}
