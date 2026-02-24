# Design: Retiree & HNW Test Campaign

**Date:** 2026-02-24
**Status:** Approved

## Goal

Launch a $10/day Google Ads Search campaign targeting retirees and near-retirees with $1-4M in assets who want knowledgeable advisors at a fair price. This is a test campaign to learn which audience segment and messaging resonates best.

## Architecture

**1 Campaign, 2 Ad Groups** — lets Google auto-allocate budget to the better-performing segment while keeping everything under a single $10/day cap.

### Campaign Settings

| Setting | Value |
|---------|-------|
| Name | `Retiree-HNW-Test-2026-02` |
| Daily budget | $10 (10,000,000 micros) |
| Bid strategy | Maximize Clicks |
| Channel | Search (Google + Search Network) |
| Location | United States (geo ID: 2840) |
| Initial status | PAUSED (enable after review) |
| Landing page | `https://arcvest.com/` |

### Ad Group 1: Pre-Retiree Planning

**Persona:** `pre-retiree` | **Voice:** `educational`

**Keywords (Phrase match):**
- retirement planning advisor
- retirement financial advisor
- 401k rollover advisor
- pre-retirement planning
- retirement wealth management
- social security planning advisor
- retirement income planning

### Ad Group 2: HNW Fee-Conscious

**Persona:** `hnw-investor` | **Voice:** `direct`

**Keywords (Phrase match):**
- fee-only financial advisor
- fiduciary wealth manager
- low fee wealth management
- independent financial advisor
- fee-only wealth management
- fiduciary advisor near me
- transparent fee advisor

### Ad Copy

Generated via the 4-AI RSA pipeline (Claude + GPT-4o + Gemini + Claude validation). Each ad group gets its own RSA with 15 headlines + 4 descriptions, SEC-compliance-checked.

## Execution Sequence

1. Build a new API endpoint `POST /api/campaigns/launch` that orchestrates the full flow
2. Generate RSAs via pipeline (2 persona/voice combos)
3. Call Google Ads API in sequence: budget -> campaign -> location -> ad group 1 (keywords + RSA) -> ad group 2 (keywords + RSA)
4. Record campaign in Supabase with `google_ads_campaign_id`
5. Enable campaign

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/dashboard/src/app/api/campaigns/launch/route.ts` | New — orchestration endpoint |
| RSA pipeline | Invoke existing `generateRSA()` for 2 persona/voice combos |
| Google Ads client | Use existing methods, no changes needed |
| Supabase campaigns table | Insert record with google_ads_campaign_id |
