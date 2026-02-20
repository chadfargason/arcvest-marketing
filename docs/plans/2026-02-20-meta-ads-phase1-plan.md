# Meta Ads Phase 1: Read-Only Sync + Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync existing Meta (Facebook/Instagram) ad campaigns and metrics into the ArcVest dashboard with a dedicated Meta Ads page showing campaigns, insights, audiences, and creatives.

**Architecture:** Hybrid approach — extend existing `campaigns` and `campaign_metrics` tables with a `platform` column, add Meta-specific tables (`meta_ad_sets`, `meta_ads`, `meta_insights`). New `MetaAdsService` makes direct HTTP calls to Meta Graph API v21.0. New API routes under `/api/meta-ads/`, new cron job for automated sync, new dashboard page at `/dashboard/meta-ads`.

**Tech Stack:** Next.js 15, TypeScript, Supabase PostgreSQL, Meta Graph API v21.0, Tailwind CSS, Radix UI, Recharts, Lucide icons

**Reference docs:**
- Design: `docs/plans/2026-02-20-meta-ads-integration-design.md`
- Meta API reference: `meta-ads-api-setup-reference.md`
- Existing Google Ads service pattern: `packages/services/src/google-ads-service.ts`
- Existing cron pattern: `packages/dashboard/src/app/api/cron/ads-sync/route.ts`
- Existing dashboard page pattern: `packages/dashboard/src/app/dashboard/campaigns/page.tsx`
- Shared types: `packages/shared/src/types/database.ts`
- Service exports: `packages/services/src/index.ts`
- Sidebar nav: `packages/dashboard/src/components/layout/sidebar.tsx`

---

### Task 1: Database Migration — Extend campaigns table and create Meta tables

**Files:**
- Create: `packages/database/migrations/014_meta_ads.sql`

**Step 1: Write the migration file**

```sql
-- ============================================
-- ArcVest Marketing Automation System
-- Migration 014: Meta Ads Integration
-- ============================================

-- ============================================
-- EXTEND CAMPAIGNS TABLE
-- ============================================

-- Add platform column (defaults to 'google' for backward compatibility)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'google';

-- Add platform check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_platform_check'
  ) THEN
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_platform_check
      CHECK (platform IN ('google', 'meta', 'other'));
  END IF;
END $$;

-- Add Meta external campaign ID
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;

-- Add daily/lifetime budget columns (Meta uses both)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS lifetime_budget DECIMAL(10,2);

-- Add Meta objective column (OUTCOME_TRAFFIC, OUTCOME_LEADS, etc.)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT;

-- Expand campaign type check to include Meta types
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN (
  'google_search', 'google_display', 'google_youtube',
  'linkedin', 'email', 'content', 'other',
  'meta_traffic', 'meta_leads', 'meta_awareness', 'meta_conversions', 'meta_engagement'
));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_meta_id ON campaigns(meta_campaign_id);

-- ============================================
-- META AD SETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS meta_ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Relationship
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Meta external ID
  meta_ad_set_id TEXT NOT NULL,

  -- Core fields
  name TEXT NOT NULL,
  status TEXT DEFAULT 'PAUSED',

  -- Budget
  daily_budget DECIMAL(10,2),
  lifetime_budget DECIMAL(10,2),
  bid_amount DECIMAL(10,2),
  bid_strategy TEXT,

  -- Targeting & Placement
  optimization_goal TEXT,
  targeting JSONB DEFAULT '{}',
  placements JSONB DEFAULT '{}',

  -- Schedule
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,

  UNIQUE(meta_ad_set_id)
);

-- ============================================
-- META ADS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS meta_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Relationship
  ad_set_id UUID NOT NULL REFERENCES meta_ad_sets(id) ON DELETE CASCADE,

  -- Meta external ID
  meta_ad_id TEXT NOT NULL,

  -- Core fields
  name TEXT NOT NULL,
  status TEXT DEFAULT 'PAUSED',

  -- Creative data (headline, body, image_url, call_to_action, link)
  creative JSONB DEFAULT '{}',

  -- Link back to blog post that generated this ad (Phase 2)
  source_content_id UUID REFERENCES content_calendar(id),

  UNIQUE(meta_ad_id)
);

-- ============================================
-- META INSIGHTS TABLE (daily granularity)
-- ============================================

CREATE TABLE IF NOT EXISTS meta_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What this insight is for
  meta_object_id TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('account', 'campaign', 'adset', 'ad')),
  date DATE NOT NULL,

  -- Core metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency DECIMAL(8,4) DEFAULT 0,

  -- Calculated metrics
  cpc DECIMAL(10,2),
  cpm DECIMAL(10,2),
  ctr DECIMAL(8,6),

  -- Structured action data (conversions, leads, link clicks, etc.)
  actions JSONB DEFAULT '[]',
  cost_per_action JSONB DEFAULT '[]',

  -- Optional demographic breakdowns
  breakdowns JSONB DEFAULT '{}',

  UNIQUE(meta_object_id, object_type, date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_campaign ON meta_ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_status ON meta_ad_sets(status);
CREATE INDEX IF NOT EXISTS idx_meta_ads_ad_set ON meta_ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_status ON meta_ads(status);
CREATE INDEX IF NOT EXISTS idx_meta_ads_source_content ON meta_ads(source_content_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_object_date ON meta_insights(meta_object_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_type_date ON meta_insights(object_type, date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS meta_ad_sets_updated_at ON meta_ad_sets;
CREATE TRIGGER meta_ad_sets_updated_at
  BEFORE UPDATE ON meta_ad_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS meta_ads_updated_at ON meta_ads;
CREATE TRIGGER meta_ads_updated_at
  BEFORE UPDATE ON meta_ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Run the migration against Supabase**

Run: `cd /c/code/arcvest-marketing && npm run db:migrate`

If `db:migrate` doesn't work, run directly via Supabase dashboard SQL editor or:
```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add packages/database/migrations/014_meta_ads.sql
git commit -m "feat: add Meta Ads database migration (tables + indexes)"
```

---

### Task 2: Shared Types — Add Meta Ads TypeScript types

**Files:**
- Modify: `packages/shared/src/types/database.ts`

**Step 1: Add Meta campaign types and platform enum**

After the existing `CAMPAIGN_TYPES` array (line ~43), add the Meta types to the array and add a new `CAMPAIGN_PLATFORMS` constant:

```typescript
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
```

**Step 2: Update Campaign interface**

Add new fields to the existing `Campaign` interface (after `google_ads_campaign_id`):

```typescript
export interface Campaign {
  // ... existing fields ...

  // Platform
  platform: CampaignPlatform;

  // External IDs
  google_ads_campaign_id: string | null;
  meta_campaign_id: string | null;

  // Budget (Meta uses daily/lifetime in addition to monthly)
  daily_budget: number | null;
  lifetime_budget: number | null;

  // Objective (Meta campaigns)
  objective: string | null;

  // ... rest of existing fields ...
}
```

Also update `CampaignInsert` to include:
```typescript
  platform?: CampaignPlatform;
  meta_campaign_id?: string | null;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  objective?: string | null;
```

**Step 3: Add Meta-specific interfaces**

Add a new section at the end of the file (before the Views section):

```typescript
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
```

**Step 4: Verify TypeScript compiles**

Run: `cd /c/code/arcvest-marketing && npx turbo run build --filter=@arcvest/shared`

**Step 5: Commit**

```bash
git add packages/shared/src/types/database.ts
git commit -m "feat: add Meta Ads TypeScript types to shared package"
```

---

### Task 3: Meta Ads Service — Core API client and sync logic

**Files:**
- Create: `packages/services/src/meta-ads-service.ts`
- Modify: `packages/services/src/index.ts`

**Step 1: Create the MetaAdsService**

Create `packages/services/src/meta-ads-service.ts` with the full service implementation:

```typescript
import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string;    // e.g. "act_972632354854560"
  businessId: string;
  pixelId: string;
  pageId: string;
  apiVersion: string;     // e.g. "v21.0"
}

interface MetaGraphResponse<T = unknown> {
  data?: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdSetRaw {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  bid_strategy?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface MetaAdRaw {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: { id: string };
}

export interface MetaInsightRaw {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface MetaSyncResult {
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
  errors: string[];
}

export interface MetaPerformanceSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
}

export class MetaAdsService {
  private supabase: SupabaseClient;
  private config: MetaAdsConfig | null = null;
  private baseUrl: string = '';

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabase();
  }

  initialize(config: MetaAdsConfig): void {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`;
  }

  initializeFromEnv(): void {
    const accessToken = process.env['META_ACCESS_TOKEN'];
    const adAccountId = process.env['META_AD_ACCOUNT_ID'];
    const businessId = process.env['META_BUSINESS_ID'] || '';
    const pixelId = process.env['META_PIXEL_ID'] || '';
    const pageId = process.env['META_PAGE_ID'] || '';
    const apiVersion = process.env['META_API_VERSION'] || 'v21.0';

    if (!accessToken || !adAccountId) {
      throw new Error('META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are required');
    }

    this.initialize({
      accessToken,
      adAccountId,
      businessId,
      pixelId,
      pageId,
      apiVersion,
    });
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.accessToken && !!this.config.adAccountId;
  }

  // ==========================================
  // Meta Graph API calls
  // ==========================================

  private async graphGet<T = unknown>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    if (!this.config) throw new Error('MetaAdsService not configured');

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('access_token', this.config.accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      const code = data.error.code;
      const msg = data.error.message;
      if (code === 17) throw new Error(`Meta API rate limit exceeded: ${msg}`);
      if (code === 190) throw new Error(`Meta API invalid token: ${msg}`);
      throw new Error(`Meta API error (${code}): ${msg}`);
    }

    return data as T;
  }

  private async graphGetAll<T = unknown>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextUrl: string | undefined;

    // First request
    const firstResponse = await this.graphGet<MetaGraphResponse<T>>(path, params);
    if (firstResponse.data) allItems.push(...firstResponse.data);
    nextUrl = firstResponse.paging?.next;

    // Follow pagination
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data: MetaGraphResponse<T> = await response.json();
      if (data.error) throw new Error(`Meta API error: ${data.error.message}`);
      if (data.data) allItems.push(...data.data);
      nextUrl = data.paging?.next;
    }

    return allItems;
  }

  async validateToken(): Promise<{ name: string; id: string }> {
    return this.graphGet('/me');
  }

  async getAccountInfo(): Promise<Record<string, unknown>> {
    if (!this.config) throw new Error('MetaAdsService not configured');
    return this.graphGet(`/${this.config.adAccountId}`, {
      fields: 'name,account_status,currency,timezone_name,business,amount_spent',
    });
  }

  async getCampaigns(): Promise<MetaCampaignRaw[]> {
    if (!this.config) throw new Error('MetaAdsService not configured');
    return this.graphGetAll(`/${this.config.adAccountId}/campaigns`, {
      fields: 'name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      limit: '100',
    });
  }

  async getAdSets(): Promise<MetaAdSetRaw[]> {
    if (!this.config) throw new Error('MetaAdsService not configured');
    return this.graphGetAll(`/${this.config.adAccountId}/adsets`, {
      fields: 'name,status,campaign_id,daily_budget,lifetime_budget,bid_amount,bid_strategy,optimization_goal,targeting,start_time,end_time',
      limit: '100',
    });
  }

  async getAds(): Promise<MetaAdRaw[]> {
    if (!this.config) throw new Error('MetaAdsService not configured');
    return this.graphGetAll(`/${this.config.adAccountId}/ads`, {
      fields: 'name,status,adset_id,creative{id}',
      limit: '100',
    });
  }

  async getInsights(
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign',
    startDate: string,
    endDate: string
  ): Promise<MetaInsightRaw[]> {
    if (!this.config) throw new Error('MetaAdsService not configured');

    const params: Record<string, string> = {
      fields: 'campaign_id,campaign_name,adset_id,ad_id,impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type',
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      time_increment: '1',
      limit: '500',
    };

    if (level !== 'account') {
      params.level = level;
    }

    return this.graphGetAll(`/${this.config.adAccountId}/insights`, params);
  }

  async getInsightsWithBreakdowns(
    startDate: string,
    endDate: string,
    breakdownType: 'age,gender' | 'device_platform' | 'publisher_platform' = 'age,gender'
  ): Promise<MetaInsightRaw[]> {
    if (!this.config) throw new Error('MetaAdsService not configured');

    return this.graphGetAll(`/${this.config.adAccountId}/insights`, {
      fields: 'impressions,clicks,spend,reach,cpc,ctr',
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      breakdowns: breakdownType,
      limit: '500',
    });
  }

  // ==========================================
  // Sync operations (Meta -> Supabase)
  // ==========================================

  private mapMetaObjectiveToType(objective: string): string {
    const mapping: Record<string, string> = {
      'OUTCOME_TRAFFIC': 'meta_traffic',
      'LINK_CLICKS': 'meta_traffic',
      'OUTCOME_LEADS': 'meta_leads',
      'LEAD_GENERATION': 'meta_leads',
      'OUTCOME_AWARENESS': 'meta_awareness',
      'BRAND_AWARENESS': 'meta_awareness',
      'REACH': 'meta_awareness',
      'OUTCOME_SALES': 'meta_conversions',
      'CONVERSIONS': 'meta_conversions',
      'OUTCOME_ENGAGEMENT': 'meta_engagement',
      'POST_ENGAGEMENT': 'meta_engagement',
    };
    return mapping[objective] || 'other';
  }

  private mapMetaStatusToCampaignStatus(metaStatus: string): string {
    const mapping: Record<string, string> = {
      'ACTIVE': 'active',
      'PAUSED': 'paused',
      'DELETED': 'completed',
      'ARCHIVED': 'completed',
    };
    return mapping[metaStatus] || 'draft';
  }

  async syncCampaigns(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    const metaCampaigns = await this.getCampaigns();
    let synced = 0;

    for (const mc of metaCampaigns) {
      const { error } = await this.supabase.from('campaigns').upsert(
        {
          meta_campaign_id: mc.id,
          platform: 'meta',
          name: mc.name,
          type: this.mapMetaObjectiveToType(mc.objective),
          status: this.mapMetaStatusToCampaignStatus(mc.status),
          objective: mc.objective,
          daily_budget: mc.daily_budget ? parseFloat(mc.daily_budget) / 100 : null,
          lifetime_budget: mc.lifetime_budget ? parseFloat(mc.lifetime_budget) / 100 : null,
          start_date: mc.start_time ? mc.start_time.split('T')[0] : null,
          end_date: mc.stop_time ? mc.stop_time.split('T')[0] : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meta_campaign_id' }
      );
      if (error) {
        errors.push(`Campaign ${mc.name}: ${error.message}`);
      } else {
        synced++;
      }
    }

    return { synced, errors };
  }

  async syncAdSets(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    const metaAdSets = await this.getAdSets();
    let synced = 0;

    for (const mas of metaAdSets) {
      // Look up the local campaign by meta_campaign_id
      const { data: campaign } = await this.supabase
        .from('campaigns')
        .select('id')
        .eq('meta_campaign_id', mas.campaign_id)
        .single();

      if (!campaign) {
        errors.push(`Ad set ${mas.name}: parent campaign ${mas.campaign_id} not found in DB`);
        continue;
      }

      const { error } = await this.supabase.from('meta_ad_sets').upsert(
        {
          meta_ad_set_id: mas.id,
          campaign_id: campaign.id,
          name: mas.name,
          status: mas.status,
          daily_budget: mas.daily_budget ? parseFloat(mas.daily_budget) / 100 : null,
          lifetime_budget: mas.lifetime_budget ? parseFloat(mas.lifetime_budget) / 100 : null,
          bid_amount: mas.bid_amount ? parseFloat(mas.bid_amount) / 100 : null,
          bid_strategy: mas.bid_strategy || null,
          optimization_goal: mas.optimization_goal || null,
          targeting: mas.targeting || {},
          start_time: mas.start_time || null,
          end_time: mas.end_time || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meta_ad_set_id' }
      );
      if (error) {
        errors.push(`Ad set ${mas.name}: ${error.message}`);
      } else {
        synced++;
      }
    }

    return { synced, errors };
  }

  async syncAds(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    const metaAds = await this.getAds();
    let synced = 0;

    for (const ma of metaAds) {
      // Look up the local ad set by meta_ad_set_id
      const { data: adSet } = await this.supabase
        .from('meta_ad_sets')
        .select('id')
        .eq('meta_ad_set_id', ma.adset_id)
        .single();

      if (!adSet) {
        errors.push(`Ad ${ma.name}: parent ad set ${ma.adset_id} not found in DB`);
        continue;
      }

      const { error } = await this.supabase.from('meta_ads').upsert(
        {
          meta_ad_id: ma.id,
          ad_set_id: adSet.id,
          name: ma.name,
          status: ma.status,
          creative: ma.creative || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meta_ad_id' }
      );
      if (error) {
        errors.push(`Ad ${ma.name}: ${error.message}`);
      } else {
        synced++;
      }
    }

    return { synced, errors };
  }

  async syncInsights(startDate: string, endDate: string): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    // Fetch campaign-level daily insights
    const insights = await this.getInsights('campaign', startDate, endDate);

    for (const insight of insights) {
      // Save to meta_insights
      const { error: insightError } = await this.supabase.from('meta_insights').upsert(
        {
          meta_object_id: insight.campaign_id || this.config!.adAccountId,
          object_type: insight.campaign_id ? 'campaign' : 'account',
          date: insight.date_start,
          impressions: parseInt(insight.impressions) || 0,
          clicks: parseInt(insight.clicks) || 0,
          spend: parseFloat(insight.spend) || 0,
          reach: insight.reach ? parseInt(insight.reach) : 0,
          frequency: insight.frequency ? parseFloat(insight.frequency) : 0,
          cpc: insight.cpc ? parseFloat(insight.cpc) : null,
          cpm: insight.cpm ? parseFloat(insight.cpm) : null,
          ctr: insight.ctr ? parseFloat(insight.ctr) / 100 : null,
          actions: insight.actions || [],
          cost_per_action: insight.cost_per_action_type || [],
        },
        { onConflict: 'meta_object_id,object_type,date' }
      );

      if (insightError) {
        errors.push(`Insight ${insight.date_start}: ${insightError.message}`);
        continue;
      }

      // Also populate campaign_metrics for unified reporting
      if (insight.campaign_id) {
        const { data: campaign } = await this.supabase
          .from('campaigns')
          .select('id')
          .eq('meta_campaign_id', insight.campaign_id)
          .single();

        if (campaign) {
          const impressions = parseInt(insight.impressions) || 0;
          const clicks = parseInt(insight.clicks) || 0;
          const cost = parseFloat(insight.spend) || 0;
          const conversions = insight.actions?.reduce((sum: number, a: { action_type: string; value: string }) => {
            if (['lead', 'complete_registration', 'purchase'].includes(a.action_type)) {
              return sum + parseInt(a.value);
            }
            return sum;
          }, 0) || 0;

          await this.supabase.from('campaign_metrics').upsert(
            {
              campaign_id: campaign.id,
              date: insight.date_start,
              impressions,
              clicks,
              cost,
              conversions,
              ctr: impressions > 0 ? clicks / impressions : 0,
              cpc: clicks > 0 ? cost / clicks : null,
              cpa: conversions > 0 ? cost / conversions : null,
            },
            { onConflict: 'campaign_id,date' }
          );
        }
      }

      synced++;
    }

    return { synced, errors };
  }

  async fullSync(startDate: string, endDate: string): Promise<MetaSyncResult> {
    const allErrors: string[] = [];

    console.log('[Meta Ads] Starting full sync...');

    // Step 1: Sync campaigns
    const campaignResult = await this.syncCampaigns();
    allErrors.push(...campaignResult.errors);
    console.log(`[Meta Ads] Campaigns synced: ${campaignResult.synced}`);

    // Step 2: Sync ad sets (depends on campaigns being in DB)
    const adSetResult = await this.syncAdSets();
    allErrors.push(...adSetResult.errors);
    console.log(`[Meta Ads] Ad sets synced: ${adSetResult.synced}`);

    // Step 3: Sync ads (depends on ad sets being in DB)
    const adResult = await this.syncAds();
    allErrors.push(...adResult.errors);
    console.log(`[Meta Ads] Ads synced: ${adResult.synced}`);

    // Step 4: Sync insights
    const insightResult = await this.syncInsights(startDate, endDate);
    allErrors.push(...insightResult.errors);
    console.log(`[Meta Ads] Insights synced: ${insightResult.synced}`);

    return {
      campaigns: campaignResult.synced,
      adSets: adSetResult.synced,
      ads: adResult.synced,
      insights: insightResult.synced,
      errors: allErrors,
    };
  }

  // ==========================================
  // Dashboard read methods (from Supabase)
  // ==========================================

  async getPerformanceSummary(days: number = 30): Promise<MetaPerformanceSummary> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { count: totalCampaigns } = await this.supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'meta');

    const { count: activeCampaigns } = await this.supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'meta')
      .eq('status', 'active');

    const { data: insights } = await this.supabase
      .from('meta_insights')
      .select('spend, impressions, clicks, reach')
      .eq('object_type', 'campaign')
      .gte('date', since);

    const totals = insights?.reduce(
      (acc, i) => ({
        spend: acc.spend + parseFloat(i.spend || '0'),
        impressions: acc.impressions + (i.impressions || 0),
        clicks: acc.clicks + (i.clicks || 0),
        reach: acc.reach + (i.reach || 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, reach: 0 }
    ) || { spend: 0, impressions: 0, clicks: 0, reach: 0 };

    return {
      totalCampaigns: totalCampaigns || 0,
      activeCampaigns: activeCampaigns || 0,
      totalSpend: totals.spend,
      totalImpressions: totals.impressions,
      totalClicks: totals.clicks,
      totalReach: totals.reach,
      avgCtr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      avgCpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    };
  }

  async getCampaignPerformance(days: number = 30): Promise<unknown[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('id, name, status, type, objective, daily_budget, lifetime_budget, meta_campaign_id')
      .eq('platform', 'meta')
      .order('created_at', { ascending: false });

    if (!campaigns) return [];

    const result = [];
    for (const campaign of campaigns) {
      const { data: metrics } = await this.supabase
        .from('meta_insights')
        .select('impressions, clicks, spend, reach, frequency, cpc, ctr')
        .eq('meta_object_id', campaign.meta_campaign_id)
        .eq('object_type', 'campaign')
        .gte('date', since);

      const totals = metrics?.reduce(
        (acc, m) => ({
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          spend: acc.spend + parseFloat(m.spend || '0'),
          reach: acc.reach + (m.reach || 0),
        }),
        { impressions: 0, clicks: 0, spend: 0, reach: 0 }
      ) || { impressions: 0, clicks: 0, spend: 0, reach: 0 };

      result.push({
        ...campaign,
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
      });
    }

    return result;
  }

  async getAudienceBreakdown(startDate: string, endDate: string): Promise<unknown[]> {
    const { data } = await this.supabase
      .from('meta_insights')
      .select('breakdowns, impressions, clicks, spend')
      .neq('breakdowns', '{}')
      .gte('date', startDate)
      .lte('date', endDate);

    return data || [];
  }
}

// Singleton instance
let serviceInstance: MetaAdsService | null = null;

export function getMetaAdsService(): MetaAdsService {
  if (!serviceInstance) {
    serviceInstance = new MetaAdsService();
  }
  return serviceInstance;
}
```

**Step 2: Export from services index**

Add to `packages/services/src/index.ts` after the Google Ads exports:

```typescript
export {
  MetaAdsService,
  getMetaAdsService,
  type MetaAdsConfig,
  type MetaSyncResult,
  type MetaPerformanceSummary,
} from './meta-ads-service';
```

**Step 3: Verify build**

Run: `cd /c/code/arcvest-marketing && npx turbo run build --filter=@arcvest/services`

**Step 4: Commit**

```bash
git add packages/services/src/meta-ads-service.ts packages/services/src/index.ts
git commit -m "feat: add MetaAdsService with Graph API client and sync logic"
```

---

### Task 4: Environment Variables — Add Meta credentials

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (if exists locally)

**Step 1: Add Meta env vars to .env.example**

Append after the existing Google Ads section:

```env
# Meta (Facebook/Instagram) Ads API
META_APP_ID=
META_AD_ACCOUNT_ID=
META_BUSINESS_ID=
META_PIXEL_ID=
META_PAGE_ID=
META_ACCESS_TOKEN=
META_API_VERSION=v21.0
```

**Step 2: Add actual values to .env.local**

Use the values from `meta-ads-api-setup-reference.md`:
```env
META_APP_ID=879432091765894
META_AD_ACCOUNT_ID=act_972632354854560
META_BUSINESS_ID=2103507003811585
META_PIXEL_ID=2583562368691598
META_PAGE_ID=924603480729419
META_ACCESS_TOKEN=EAAMf1r1vDIYBQZCQZCyulThdDILnmvJq8DB1GllRURJqyii4FGw64zec0v15ZCeRiLUtkMXXoE21Bau5keZBLYUyjaF6so8G21a0UxiMC4f3azaTECnZCpZAQZA5zUzB2pHRaQJlXTyZAvZCJkZBZCZC5XTZAK3Ah2c6RiICQffhZCOLcNd5Qn6GYEKnt2JU1kKF0RZCan0jZBnxZAJBJMWcMA61a4poFeaJFwqyjiTqb9sZAW
META_API_VERSION=v21.0
```

**Step 3: Add to Vercel environment variables**

Run:
```bash
cd /c/code/arcvest-marketing
npx vercel env add META_APP_ID production
npx vercel env add META_AD_ACCOUNT_ID production
npx vercel env add META_BUSINESS_ID production
npx vercel env add META_PIXEL_ID production
npx vercel env add META_PAGE_ID production
npx vercel env add META_ACCESS_TOKEN production
npx vercel env add META_API_VERSION production
```

Or add via the Vercel dashboard at Settings > Environment Variables.

**Step 4: Commit (only .env.example, NOT .env.local)**

```bash
git add .env.example
git commit -m "feat: add Meta Ads environment variables to .env.example"
```

---

### Task 5: API Routes — Meta Ads endpoints

**Files:**
- Create: `packages/dashboard/src/app/api/meta-ads/route.ts`
- Create: `packages/dashboard/src/app/api/meta-ads/sync/route.ts`
- Create: `packages/dashboard/src/app/api/meta-ads/insights/route.ts`
- Create: `packages/dashboard/src/app/api/meta-ads/ad-sets/route.ts`
- Create: `packages/dashboard/src/app/api/meta-ads/ads/route.ts`

**Step 1: Create main list route**

Create `packages/dashboard/src/app/api/meta-ads/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('platform', 'meta')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, error } = await query;
    if (error) throw error;

    // Enrich with metrics
    const enriched = [];
    for (const campaign of campaigns || []) {
      const { data: metrics } = await supabase
        .from('campaign_metrics')
        .select('impressions, clicks, cost, conversions, ctr, cpc, cpa')
        .eq('campaign_id', campaign.id);

      const totals = metrics?.reduce(
        (acc, m) => ({
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          cost: acc.cost + parseFloat(m.cost || '0'),
          conversions: acc.conversions + (m.conversions || 0),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
      ) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

      enriched.push({
        ...campaign,
        total_impressions: totals.impressions,
        total_clicks: totals.clicks,
        total_cost: totals.cost,
        total_conversions: totals.conversions,
        avg_ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        avg_cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
      });
    }

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[Meta Ads API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Meta campaigns' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create sync route**

Create `packages/dashboard/src/app/api/meta-ads/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

// GET: Connection status check
export async function GET() {
  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();

    const identity = await service.validateToken();
    const accountInfo = await service.getAccountInfo();

    return NextResponse.json({
      connected: true,
      identity,
      account: accountInfo,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

// POST: Trigger full sync
export async function POST(request: NextRequest) {
  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();

    const body = await request.json().catch(() => ({}));
    const endDate = body.endDate || new Date().toISOString().split('T')[0];
    const startDate = body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await service.fullSync(startDate, endDate);

    // Log to activity_log
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.from('activity_log').insert({
      actor: 'meta_ads_service',
      action: 'meta_ads_sync_complete',
      entity_type: 'meta_campaigns',
      details: {
        ...result,
        date_range: { startDate, endDate },
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Meta Ads Sync] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
```

**Step 3: Create insights route**

Create `packages/dashboard/src/app/api/meta-ads/insights/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const level = searchParams.get('level') || 'campaign';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: insights, error } = await supabase
      .from('meta_insights')
      .select('*')
      .eq('object_type', level)
      .gte('date', since)
      .order('date', { ascending: true });

    if (error) throw error;

    // Calculate summary
    const summary = insights?.reduce(
      (acc, i) => ({
        totalSpend: acc.totalSpend + parseFloat(i.spend || '0'),
        totalImpressions: acc.totalImpressions + (i.impressions || 0),
        totalClicks: acc.totalClicks + (i.clicks || 0),
        totalReach: acc.totalReach + (i.reach || 0),
      }),
      { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0 }
    ) || { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0 };

    return NextResponse.json({
      insights,
      summary: {
        ...summary,
        avgCtr: summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0,
        avgCpc: summary.totalClicks > 0 ? summary.totalSpend / summary.totalClicks : 0,
      },
    });
  } catch (error) {
    console.error('[Meta Ads Insights] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
```

**Step 4: Create ad-sets route**

Create `packages/dashboard/src/app/api/meta-ads/ad-sets/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    let query = supabase
      .from('meta_ad_sets')
      .select('*, campaigns(name, status)')
      .order('created_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Meta Ads Ad Sets] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ad sets' },
      { status: 500 }
    );
  }
}
```

**Step 5: Create ads route**

Create `packages/dashboard/src/app/api/meta-ads/ads/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const adSetId = searchParams.get('ad_set_id');

    let query = supabase
      .from('meta_ads')
      .select('*, meta_ad_sets(name, status, campaign_id)')
      .order('created_at', { ascending: false });

    if (adSetId) {
      query = query.eq('ad_set_id', adSetId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Meta Ads] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ads' },
      { status: 500 }
    );
  }
}
```

**Step 6: Verify build**

Run: `cd /c/code/arcvest-marketing && npx turbo run build --filter=@arcvest/dashboard`

**Step 7: Commit**

```bash
git add packages/dashboard/src/app/api/meta-ads/
git commit -m "feat: add Meta Ads API routes (list, sync, insights, ad-sets, ads)"
```

---

### Task 6: Cron Route — Automated Meta Ads sync

**Files:**
- Create: `packages/dashboard/src/app/api/cron/meta-ads-sync/route.ts`
- Modify: `vercel.json`

**Step 1: Create cron route**

Create `packages/dashboard/src/app/api/cron/meta-ads-sync/route.ts`:

```typescript
/**
 * Meta Ads Sync Cron
 *
 * Scheduled to run every 4 hours
 * Syncs campaigns, ad sets, ads, and insights from Meta
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAdsService } from '@arcvest/services';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    console.warn('[Meta Ads Sync Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Meta Ads Sync Cron] Starting scheduled sync (Trigger: ${vercelCronHeader === '1' ? 'Vercel Cron' : 'Manual'})...`);

  try {
    const service = getMetaAdsService();
    service.initializeFromEnv();

    // Sync last 7 days of data
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await service.fullSync(startDate, endDate);

    console.log(`[Meta Ads Sync Cron] Complete. Campaigns: ${result.campaigns}, Ad Sets: ${result.adSets}, Ads: ${result.ads}, Insights: ${result.insights}`);

    // Log to activity_log
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.from('activity_log').insert({
      actor: 'meta_ads_cron',
      action: 'meta_ads_sync_complete',
      entity_type: 'meta_campaigns',
      details: {
        ...result,
        date_range: { startDate, endDate },
        trigger: vercelCronHeader === '1' ? 'cron' : 'manual',
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[Meta Ads Sync Cron] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Meta Ads sync failed',
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Add cron schedule to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/meta-ads-sync",
  "schedule": "30 */4 * * *"
}
```

(Offset by 30 minutes from the Google Ads sync to avoid overlap.)

**Step 3: Commit**

```bash
git add packages/dashboard/src/app/api/cron/meta-ads-sync/route.ts vercel.json
git commit -m "feat: add Meta Ads sync cron job (every 4 hours)"
```

---

### Task 7: Sidebar Navigation — Add Meta Ads link

**Files:**
- Modify: `packages/dashboard/src/components/layout/sidebar.tsx`

**Step 1: Add Meta Ads to navigation array**

Import the `Facebook` icon from lucide-react (or use `Megaphone` with a different label). Add the Meta Ads entry after the Campaigns entry:

Add to imports: `Share2` (or another suitable icon — lucide doesn't have a Facebook icon, so use `Share2` as a social-media-like icon).

Add to the `navigation` array after `{ name: 'Campaigns', ... }`:

```typescript
{ name: 'Meta Ads', href: '/dashboard/meta-ads', icon: Share2 },
```

**Step 2: Commit**

```bash
git add packages/dashboard/src/components/layout/sidebar.tsx
git commit -m "feat: add Meta Ads to dashboard sidebar navigation"
```

---

### Task 8: Dashboard Page — Meta Ads page with 4 tabs

**Files:**
- Create: `packages/dashboard/src/app/dashboard/meta-ads/page.tsx`

**Step 1: Create the Meta Ads dashboard page**

This is a large client component following the existing campaigns page pattern. It should have 4 tabs: Campaigns, Insights, Audiences, Ad Creatives.

The page should:
- Fetch from `/api/meta-ads` for campaign list
- Fetch from `/api/meta-ads/sync` (GET) for connection status
- POST to `/api/meta-ads/sync` for manual sync trigger
- Fetch from `/api/meta-ads/insights` for charts and metrics
- Fetch from `/api/meta-ads/ad-sets` for ad set details
- Fetch from `/api/meta-ads/ads` for creative details
- Use Recharts for spend/impressions/clicks charts over time
- Use Radix UI components (Card, Badge, Tabs, Button, Select)
- Show KPI summary cards at top (total spend, impressions, clicks, CTR, CPC, reach)
- Show connection status indicator
- Include manual sync button with loading state
- Date range selector (7d, 14d, 30d, 90d)

Follow the exact same component patterns from `packages/dashboard/src/app/dashboard/campaigns/page.tsx` (client component, useState, useCallback, useEffect for data loading, local interfaces).

The full implementation will be ~600-800 lines. Key structure:

```
page.tsx
├── Interfaces (MetaCampaign, MetaInsight, MetaAdSet, MetaAd, etc.)
├── Helper functions (formatCurrency, formatNumber, formatDate, formatPercent)
├── Main component: MetaAdsPage
│   ├── State: campaigns, insights, adSets, ads, connected, syncing, dateRange
│   ├── Data fetchers: fetchCampaigns, fetchInsights, fetchAdSets, fetchAds, checkConnection
│   ├── Actions: handleSync
│   ├── useEffect: load data on mount + dateRange change
│   └── Render:
│       ├── Header: title + sync button + connection badge
│       ├── KPI Cards row: spend, impressions, clicks, CTR, CPC, reach
│       └── Tabs:
│           ├── Tab 1 - Campaigns: table with status badges, budgets, metrics
│           ├── Tab 2 - Insights: Recharts line chart + daily breakdown table
│           ├── Tab 3 - Audiences: demographic breakdown cards (placeholder for Phase 2 data)
│           └── Tab 4 - Ad Creatives: list of ads with creative JSON display
```

**Step 2: Verify build**

Run: `cd /c/code/arcvest-marketing && npx turbo run build --filter=@arcvest/dashboard`

**Step 3: Test locally**

Run: `cd /c/code/arcvest-marketing && npm run dev`
Navigate to `http://localhost:3001/dashboard/meta-ads`
Verify: Page loads, shows connection status, sync button works.

**Step 4: Commit**

```bash
git add packages/dashboard/src/app/dashboard/meta-ads/page.tsx
git commit -m "feat: add Meta Ads dashboard page with campaigns, insights, audiences, and creatives tabs"
```

---

### Task 9: Manual Verification — Test the full integration

**Step 1: Run dev server**

```bash
cd /c/code/arcvest-marketing && npm run dev
```

**Step 2: Test connection check**

```bash
curl http://localhost:3001/api/meta-ads/sync
```

Expected: `{ "connected": true, "identity": { "name": "Jonny_Ive", ... }, "account": { ... } }`

**Step 3: Test manual sync**

```bash
curl -X POST http://localhost:3001/api/meta-ads/sync -H "Content-Type: application/json" -d "{}"
```

Expected: `{ "success": true, "campaigns": N, "adSets": N, "ads": N, "insights": N, "errors": [] }`

**Step 4: Test campaign list**

```bash
curl http://localhost:3001/api/meta-ads
```

Expected: Array of campaigns with `platform: "meta"` and enriched metrics.

**Step 5: Test insights**

```bash
curl "http://localhost:3001/api/meta-ads/insights?days=30"
```

Expected: `{ "insights": [...], "summary": { ... } }`

**Step 6: Test dashboard page**

Navigate to `http://localhost:3001/dashboard/meta-ads` and verify:
- Connection badge shows "Connected"
- Sync button works and shows loading state
- Campaigns tab shows synced campaigns
- Insights tab shows charts (if data exists)
- All tabs render without errors

**Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: Meta Ads integration adjustments from manual testing"
```

---

### Task 10: Deploy — Push to production

**Step 1: Ensure all env vars are set in Vercel**

Check via Vercel dashboard or CLI that META_* vars are configured for production.

**Step 2: Run the database migration on production Supabase**

Copy the SQL from `packages/database/migrations/014_meta_ads.sql` and run it in the Supabase SQL editor for the production database.

**Step 3: Push to main**

```bash
cd /c/code/arcvest-marketing && git push origin main
```

**Step 4: Verify deployment**

Wait for Vercel build to complete, then:
- Visit `https://arcvest-marketing.vercel.app/dashboard/meta-ads`
- Click "Sync" to trigger initial data load
- Verify campaigns appear after sync
- Verify cron will run on schedule (check Vercel Cron tab)

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Database migration | `migrations/014_meta_ads.sql` |
| 2 | Shared TypeScript types | `shared/src/types/database.ts` |
| 3 | MetaAdsService | `services/src/meta-ads-service.ts`, `services/src/index.ts` |
| 4 | Environment variables | `.env.example`, `.env.local`, Vercel |
| 5 | API routes (5 files) | `api/meta-ads/` |
| 6 | Cron route + vercel.json | `api/cron/meta-ads-sync/`, `vercel.json` |
| 7 | Sidebar navigation | `components/layout/sidebar.tsx` |
| 8 | Dashboard page | `dashboard/meta-ads/page.tsx` |
| 9 | Manual verification | Testing |
| 10 | Deploy to production | Push + migration |
