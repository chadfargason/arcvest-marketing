# Meta Ads Integration Design

**Date:** 2026-02-20
**Status:** Approved
**Approach:** Hybrid (shared campaigns table + Meta-specific detail tables)

---

## Overview

Full Meta (Facebook/Instagram) Ads integration into the ArcVest marketing dashboard. Three phases: read-only sync + dashboard, campaign creation + content-to-ads pipeline, and AI optimization.

## Architecture Decision

**Hybrid approach:** Reuse the existing `campaigns` and `campaign_metrics` tables (adding a `platform` column) for unified cross-platform reporting, while adding Meta-specific tables (`meta_ad_sets`, `meta_ads`, `meta_insights`) for platform detail.

---

## Phase 1: Read-Only Sync + Dashboard

### Database Schema (Migration 014)

**Modify `campaigns` table:**

```sql
ALTER TABLE campaigns
  ADD COLUMN platform TEXT DEFAULT 'google' CHECK (platform IN ('google', 'meta', 'other')),
  ADD COLUMN meta_campaign_id TEXT,
  ADD COLUMN daily_budget DECIMAL(10,2),
  ADD COLUMN lifetime_budget DECIMAL(10,2);

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN (
  'google_search', 'google_display', 'google_youtube',
  'linkedin', 'email', 'content', 'other',
  'meta_traffic', 'meta_leads', 'meta_awareness', 'meta_conversions', 'meta_engagement'
));

CREATE INDEX idx_campaigns_platform ON campaigns(platform);
CREATE INDEX idx_campaigns_meta_id ON campaigns(meta_campaign_id);
```

**New table: `meta_ad_sets`**

```sql
CREATE TABLE meta_ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  meta_ad_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'PAUSED',
  daily_budget DECIMAL(10,2),
  lifetime_budget DECIMAL(10,2),
  bid_amount DECIMAL(10,2),
  bid_strategy TEXT,
  optimization_goal TEXT,
  targeting JSONB DEFAULT '{}',
  placements JSONB DEFAULT '{}',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  UNIQUE(meta_ad_set_id)
);
```

**New table: `meta_ads`**

```sql
CREATE TABLE meta_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ad_set_id UUID NOT NULL REFERENCES meta_ad_sets(id) ON DELETE CASCADE,
  meta_ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'PAUSED',
  creative JSONB DEFAULT '{}',
  source_content_id UUID REFERENCES content_calendar(id),
  UNIQUE(meta_ad_id)
);
```

**New table: `meta_insights`**

```sql
CREATE TABLE meta_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meta_object_id TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('account', 'campaign', 'adset', 'ad')),
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency DECIMAL(8,4) DEFAULT 0,
  cpc DECIMAL(10,2),
  cpm DECIMAL(10,2),
  ctr DECIMAL(8,6),
  actions JSONB DEFAULT '[]',
  cost_per_action JSONB DEFAULT '[]',
  breakdowns JSONB DEFAULT '{}',
  UNIQUE(meta_object_id, object_type, date)
);
```

### Service Layer

**File:** `packages/services/src/meta-ads-service.ts`

Singleton class following `GoogleAdsService` pattern.

**Config:**
- `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_BUSINESS_ID`, `META_PIXEL_ID`, `META_PAGE_ID`, `META_API_VERSION`
- Direct HTTP calls to Graph API v21.0 (no SDK)
- Base URL: `https://graph.facebook.com/v21.0/`

**Read methods (Phase 1):**
- `validateToken()` - GET /me
- `getAccountInfo()` - GET /act_{id}
- `getCampaigns()` - GET /act_{id}/campaigns
- `getAdSets(campaignId?)` - GET /act_{id}/adsets
- `getAds(adSetId?)` - GET /act_{id}/ads
- `getInsights(level, dateRange)` - GET /act_{id}/insights
- `getInsightsWithBreakdowns()` - With age, gender, device breakdowns

**Sync methods (Phase 1):**
- `syncCampaigns()` - Fetch all campaigns, upsert to DB
- `syncAdSets()` - Fetch ad sets with targeting
- `syncAds()` - Fetch ads with creative details
- `syncInsights(dateRange)` - Fetch insights, write to meta_insights + campaign_metrics
- `fullSync(dateRange)` - Orchestrates all of the above

**Dashboard read methods:**
- `getPerformanceSummary()` - Aggregated metrics
- `getCampaignPerformance()` - Per-campaign breakdown
- `getAudienceBreakdown()` - Demographics from breakdowns

**Implementation notes:**
- Cursor-based pagination: Follow `paging.next` in responses
- Rate limiting: 200 calls per hour per ad account; batch where possible
- Error handling: Map Meta error codes (17 = rate limit, 190 = invalid token, etc.)

### API Routes

```
GET    /api/meta-ads                — List Meta campaigns from DB
GET    /api/meta-ads/sync           — Connection status (validates token)
POST   /api/meta-ads/sync           — Trigger full sync
GET    /api/meta-ads/insights       — Aggregated insights with date range and breakdowns
GET    /api/meta-ads/ad-sets        — List ad sets (filterable by campaign)
GET    /api/meta-ads/ads            — List ads
```

### Cron Route

**File:** `/api/cron/meta-ads-sync/route.ts`
**Schedule:** Every 4 hours (matches Google Ads pattern)
**Behavior:** Sync campaigns, ad sets, ads, and last 7 days of insights

**Added to vercel.json:**
```json
{
  "path": "/api/cron/meta-ads-sync",
  "schedule": "0 */4 * * *"
}
```

### Dashboard Page

**File:** `/dashboard/meta-ads/page.tsx`

Four tabs:
1. **Campaigns** - List with status, budget, spend, key metrics. Expandable to show ad sets.
2. **Insights** - Spend/impressions/clicks/CTR charts over time. Date range picker. Campaign breakdown table.
3. **Audiences** - Demographics from breakdowns (age, gender, device, placement).
4. **Ad Creatives** - View ad creatives, linked to source content. Generate new creatives (Phase 2).

---

## Phase 2: Campaign Creation + Content-to-Ads Pipeline

### Write Operations on MetaAdsService

- `createCampaign(name, objective, budget, schedule)` - POST to Meta API, insert to DB
- `updateCampaignStatus(id, status)` - Pause/activate/archive
- `updateCampaignBudget(id, budget)` - Change daily/lifetime budget
- `createAdSet(campaignId, targeting, budget, placements)` - Create targeting group
- `updateAdSet(id, updates)` - Modify targeting/budget
- `createAd(adSetId, creative)` - Create ad with creative
- `updateAdStatus(id, status)` - Pause/activate ad

All write operations create entities as **PAUSED** by default.

### Additional API Routes

```
POST   /api/meta-ads                    — Create a new Meta campaign
PUT    /api/meta-ads/[id]               — Update campaign
POST   /api/meta-ads/ad-sets            — Create ad set
POST   /api/meta-ads/ads                — Create ad
POST   /api/meta-ads/generate-creative  — AI generates ad copy from blog content
```

### Content-to-Ads Pipeline

**Trigger:** Manual button on content calendar ("Generate Meta Ad") or automated

**AI Generation (Claude):**
1. Takes blog post content
2. Generates 3-5 headline variations (25 char limit)
3. Generates 3-5 primary text variations (125 char recommended)
4. Suggests call-to-action type (LEARN_MORE, SIGN_UP, CONTACT_US)
5. Suggests audience targeting based on content topic

**Output:** Saved to `meta_ads` with `status: 'draft'` and `source_content_id` linking to blog post

**Review:** Appears in Ad Creatives tab for human approval before creation in Meta

---

## Phase 3: AI Optimization

### Optimization Rules Extension

- Add `platform` filter to `optimization_rules` (google, meta, both)
- Meta-specific metrics: reach, frequency, cost_per_lead, cost_per_link_click
- Budget pacing for daily and lifetime budgets

### AI Recommendations

- High frequency detection (>3.0 = audience fatigue)
- Audience expansion suggestions
- Creative performance ranking
- Cross-platform budget allocation recommendations

### Cron Route

**File:** `/api/cron/meta-ads-optimize/route.ts`
**Schedule:** Daily at 6am CT (matches Google Ads pattern)

---

## Environment Variables

```env
META_APP_ID=879432091765894
META_AD_ACCOUNT_ID=act_972632354854560
META_BUSINESS_ID=2103507003811585
META_PIXEL_ID=2583562368691598
META_PAGE_ID=924603480729419
META_ACCESS_TOKEN=<stored securely>
META_API_VERSION=v21.0
```

---

## Phasing Summary

| Phase | Scope | Priority |
|-------|-------|----------|
| Phase 1 | Migration + Service + Sync Cron + Dashboard (read-only) | Build now |
| Phase 2 | Write operations + Content-to-Ads pipeline | Build next |
| Phase 3 | AI optimization engine | Build later |
