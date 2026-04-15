# ArcVest Ad & Tracking Reference

**Last Updated:** April 15, 2026

This document maps all account IDs, tags, measurement IDs, and how they connect across Google Ads, Meta Ads, GA4, GoHighLevel, and the website.

---

## Platform Accounts

### Google Ads
- **Primary Customer ID:** `911-003-7605` (numeric: `9110037605`) — the active account where all campaigns run
- **Secondary Customer ID:** `485-831-1786` — signed up April 15, 2026 under chad@arcvest.com; not yet used for campaigns
- **Account Login (primary):** chad@arcvest.com
- **Manager/MCC Account ID:** `263-406-1148` (numeric: `2634061148`)
- **Developer Token:** `1-joGIfJtiTUXjGWnT13Ww`
- **Google Ads Tag (gtag):** `AW-17761344768`
- **API Version:** v23
- **YouTube Channel Linked:** Apr 15, 2026 — @ArcVest linked with View counts, Remarketing, and Engagement permissions. Enables "Subscribers earned" / "Views earned" as conversion metrics.

### Google Analytics (GA4)
- **Property ID:** `514386445` (current, correct — linked Feb 2026)
- **Measurement ID:** `G-7BN9CY5C35` (on arcvest.com via GoHighLevel)
- **Old Property ID:** `512536724` (stopped collecting ~Feb 18, 2026 — do not use)
- **Timezone:** America/Chicago

### Meta (Facebook/Instagram) Ads
- **Ad Account ID:** `act_972632354854560`
- **Meta Pixel ID:** `2583562368691598`
- **Page ID:** stored in `.env.local` as `META_PAGE_ID`
- **Business ID:** stored in `.env.local` as `META_BUSINESS_ID`
- **API Version:** v21.0
- **Access Token:** stored in `.env.local` as `META_ACCESS_TOKEN`

### GoHighLevel (Website Platform)
- **Platform:** GoHighLevel (leadconnector/msgsndr)
- **Site:** arcvest.com
- **Funnels:** ArcVest Meeting, ArcVest Retirement, Low Fees, ArcVest Email, AI Generated Funnel

### YouTube
- **Channel:** @ArcVest (https://www.youtube.com/@ArcVest)
- **Channel ID:** `UCG2Ww-fYfDBFmCHShG2IcJw`
- **Channel Type:** Brand Account (managed by chad@arcvest.com + erik@arcvest.com)
- **Owner:** erik@arcvest.com
- **Manager:** chad@arcvest.com
- **As of Apr 15, 2026:** 585 subscribers, 143 videos
- **Linked to Google Ads:** Yes (Apr 15, 2026) — channel is `UCG2Ww-fYfDBFmCHShG2IcJw` in the Ads → Linked accounts → YouTube settings
- **YouTube Data API:** enabled in Google Cloud project `arcvest-marketing` (project number `65157208709`)
- **YouTube Analytics API:** enabled in same project, but by-source subscriber attribution requires Brand Account OAuth (pending — Erik's OAuth needed; see session log below)
- **Daily subscriber snapshot:** `/api/cron/youtube-stats` runs 06:00 CT, writes to `youtube_channel_stats` in Supabase. Uses YouTube Data API when `YOUTUBE_API_KEY` is set, HTML scrape fallback otherwise.

---

## How Everything Connects

```
┌─────────────────────────────────────────────────────────┐
│                    arcvest.com                           │
│                 (GoHighLevel site)                       │
│                                                         │
│  HEAD TRACKING CODE:                                    │
│  ├── Google Ads tag: AW-17761344768                     │
│  ├── GA4 tag: G-7BN9CY5C35 → Property 514386445        │
│  └── Meta Pixel: 2583562368691598                       │
│                                                         │
│  BODY TRACKING CODE (on form submit only):              │
│  ├── gtag conversion: AW-17761344768/e1-fCICrjYscEIC6  │
│  └── fbq('track', 'Lead')                              │
└──────────────────┬──────────────────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│  Google Ads     │  │   Meta Ads       │
│  911-003-7605   │  │  act_972632...   │
│                 │  │                  │
│  Linked to GA4  │  │  Pixel tracks    │
│  property       │  │  page views +    │
│  514386445      │  │  Lead events     │
│  (Apr 10, 2026) │  │                  │
└─────────────────┘  └──────────────────┘
```

---

## Google Ads Conversion Actions

| Name | Type | Origin | Fires On |
|------|------|---------|----------|
| Lead Form Submission | WEBPAGE | WEBSITE | Form submit (body tracking code) |
| Book appointment | WEBPAGE | WEBSITE | Form submit (body tracking code) |
| Free Guide Sign-up | WEBPAGE | WEBSITE | Form submit (needs setup) |
| Lead form - Submit | LEAD_FORM_SUBMIT | GOOGLE_HOSTED | Google Ads lead form extension |
| **YouTube channel subscriptions** (7576817985) | ENGAGEMENT | YOUTUBE_HOSTED | Subscribe click on @ArcVest |
| **YouTube follow-on views** (7576420799) | YOUTUBE_FOLLOW_ON_VIEWS | YOUTUBE_HOSTED | Viewer watches another ArcVest video after ad |
| Form | WEBPAGE_CODELESS | WEBSITE | Secondary — auto-detected (demoted Apr 10) |
| Page view (/consultation) | WEBPAGE_CODELESS | WEBSITE | Secondary — page load (demoted Apr 10) |

**Demand Gen Podcast campaign (23693998500) optimization goal** — as of Apr 15, 2026, only `ENGAGEMENT / YOUTUBE_HOSTED` (subscribes) is biddable on this campaign. All other goals are observed-only. The algorithm now optimizes for subscribes, not generic engagement.

### Conversion Tag IDs
- **Lead Form Submission:** `AW-17761344768/e1-fCICrjYscEIC6opVC`
- **Form:** `AW-17761344768/jF2_CK7UoMcbEIC6opVC`
- **Book appointment:** `AW-17761344768/SWOxCL_ArccbEIC6opVC`
- **Free Guide Sign-up:** `AW-17761344768/_K8yCLb9x8sbEIC6opVC`
- **Page view (/consultation):** `AW-17761344768/KchFCPHArccbEIC6opVC`

---

## GoHighLevel Funnel Tracking Setup

Each funnel with a booking/contact form should have:

**Head Tracking Code** (same across all funnels):
```html
<meta name="google-site-verification" content="bY_RlmVkQqPCAjA_LRm5B-RFwFkfnY0pJFO1oAb4dC0" />
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17761344768"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-17761344768');
  gtag('config', 'G-7BN9CY5C35');
</script>
<!-- Meta Pixel -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '2583562368691598');
  fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=2583562368691598&ev=PageView&noscript=1"
/></noscript>
```

**Body Tracking Code** (fires on form submit / thank-you step):
```html
<script>
  gtag('event', 'conversion', {
    'send_to': 'AW-17761344768/e1-fCICrjYscEIC6opVC',
    'value': 1.0,
    'currency': 'USD'
  });
  fbq('track', 'Lead');
</script>
```

**DO NOT** put the conversion event snippet in the Head Tracking Code — it will fire on every page load and corrupt conversion data.

---

## Active Campaigns (as of April 15, 2026)

### Google Ads
| Campaign | Type | Budget | Status | Notes |
|----------|------|--------|--------|-------|
| Retiree-HNW-Test-2026-02 | Search | $10/day | Enabled | Fiduciary Focus + HNW Fee-Conscious ad groups. Pre-Retiree Planning PAUSED (Apr 15) |
| ArcVest Podcast Promo - YouTube | Demand Gen | $25/day | Enabled | Optimizing for subscribes (Apr 15). Promotes "Truth About Retirement Income" video |
| Campaign #1 | Performance Max | $20/day | **Paused** | |
| Leads-Search-1 | Search | $25/day | **Paused** | |

### Google Ads — Active Ads in Demand Gen (campaign 23693998500)
| Ad | Video | Status | Notes |
|----|-------|--------|-------|
| Podcast Promo - Truth About Retirement Income (805583045234) | `EI9pGjDemYc` | Enabled | **Current winner** — created Apr 15. Video had 4:44 avg view duration, 3.2% CTR, 4 subs from 4,577 organic views |
| Podcast Promo - Investing During Turbulence (802601817755) | `DI5gisKz9wE` | **Paused** (Apr 15) | 0 subs from 10K views — fail. Kept for reactivation if needed |
| Podcast Promo - AI and Geopolitics 2026 (805404486425) | `ocuRmLlVpAY` | **Paused** (Apr 15) | Cannibalized the winner at 1% CTR vs 8%. Paused mid-day Apr 15 |

### Google Ads — Fiduciary Focus Keywords (ad group 190100236290)
Twelve phrase-match keywords after Apr 15 additions:
- `best fiduciary advisor`, `fiduciary advisor near me`, `fiduciary financial advisor`, `fiduciary financial planner`, `fiduciary investment advisor`, `fiduciary wealth advisor`, `fee only advisor near me`, `RIA wealth management` (existing)
- `fee only fiduciary`, `top fiduciary advisor`, `trusted fiduciary advisor`, `fiduciary retirement advisor` (added Apr 15)

### Meta Ads
| Campaign | Objective | Budget | Status | Notes |
|----------|-----------|--------|--------|-------|
| Retirement is attainable | OUTCOME_TRAFFIC | $15/day | **Paused** (since Apr 10) | User paused intentionally — clicks weren't converting |
| ArcVest Podcast - Video Views | OUTCOME_AWARENESS | $5/day | **Paused** (since Apr 10) | Paused with rest of Meta |
| Fees campaigns (3) | Various | Various | **Paused** | |
| [12/11/2025] Promoting | LINK_CLICKS | $16/day | **Paused** | |

**Meta status:** All Meta campaigns intentionally paused by user on Apr 10, 2026. Clicks weren't converting to quality engagement. No plan to resume at this time.

---

## Environment Variables

All stored in `arcvest-marketing/.env.local`:
```
# Google
GOOGLE_ADS_DEVELOPER_TOKEN=1-joGIfJtiTUXjGWnT13Ww
GOOGLE_ADS_CUSTOMER_ID=9110037605
GOOGLE_ADS_LOGIN_CUSTOMER_ID=2634061148
GOOGLE_CLIENT_ID=867350115316-...
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REFRESH_TOKEN=1//0fTwGA-...
GOOGLE_ANALYTICS_PROPERTY_ID=514386445
NEXT_PUBLIC_GTAG_ID=AW-17761344768

# Meta
META_AD_ACCOUNT_ID=act_972632354854560
META_ACCESS_TOKEN=EAAMf1r1v...
META_API_VERSION=v21.0
META_PIXEL_ID=2583562368691598
```

---

## Key Dates
- **Dec 12, 2025:** Original GA4 (512536724) linked to Google Ads
- **~Feb 18, 2026:** GA4 tracking broke (site rebuilt in GoHighLevel, measurement ID changed)
- **Mar 27, 2026:** Started ad optimization work, paused underperformers
- **Apr 10, 2026:** Fixed GA4 (property 514386445 linked to Google Ads), fixed conversion tracking (moved from page-load to form-submit), demoted page-view conversions to secondary
- **Apr 10, 2026:** Meta Ads paused intentionally — clicks not converting
- **Apr 14, 2026:** Added "AI and Geopolitics" Demand Gen ad — cannibalized the winner; sub growth crashed from +69/day to +1/day overnight
- **Apr 15, 2026:** Full day of marketing surgery (see session log below)

---

## Session Log — April 15, 2026

Comprehensive overhaul of Google Ads and subscriber-tracking infrastructure. Sub growth had stalled the prior day; root cause diagnosed as creative cannibalization from a newly-added ad.

### Google Ads changes (all via API, verified live)

**Demand Gen Podcast (23693998500):**
- **Paused** the "AI and Geopolitics 2026" ad (805404486425) — 1.25% CTR vs winner's 8% CTR, was splitting budget from the proven ad
- **Paused** the "Investing During Turbulence" ad (802601817755) — after data showed 0 subs from 9,993 views (avg view duration 0:31 on a 9-min video)
- **Created new ad** "Podcast Promo - Truth About Retirement Income" (805583045234) promoting video `EI9pGjDemYc` — chosen because that organic video had 4:44 avg view duration and direct sub attribution (4 subs from 4,577 views, 3.2% CTR on impressions)
- **Linked @ArcVest channel to Google Ads** — unlocked "YouTube channel subscriptions" (7576817985) and "YouTube follow-on views" (7576420799) as conversion actions
- **Set subscribes as the only biddable conversion goal** on this campaign — Google's ML now optimizes the campaign for subscribes specifically, not generic engagement
- Budget kept at $25/day

**Search (23597050223):**
- **Paused** "Pre-Retiree Planning" ad group (196485118511) — was burning $72 in 14 days at 1.39% CTR on `retirement income planning`
- **Paused** `fiduciary wealth manager` keyword (199292097331~173016715222) in HNW Fee-Conscious — 2.45% CTR / $3.15 CPC, far below ad-group average
- **Added 4 fiduciary phrase-match keywords** to Fiduciary Focus: `fee only fiduciary`, `top fiduciary advisor`, `trusted fiduciary advisor`, `fiduciary retirement advisor`
- Budget kept at $10/day (spend was constrained)

### Policy fix

- **Detached** the Lead Form asset (333613798428) from Campaign #1 (PMax, paused) — its privacy policy URL `http://arcvest.com/privacy` was redirecting to `/home` instead of the actual privacy page at `/privacy-policy`. Triggered the "Destination not working" policy email on Apr 14. Asset detached (status: REMOVED). Site redirect bug still present on Hostinger — user to fix manually.

### New subscriber-tracking infrastructure

- **Supabase migration 018** applied — new `youtube_channel_stats` table
- **New cron** `/api/cron/youtube-stats` — daily 06:00 CT, snapshots subs via YouTube Data API (with HTML scrape fallback). Today's 585 seeded.
- **New read API** `/api/youtube/stats` — serves latest + 7d/30d deltas + sparkline
- **Ad Optimizer dashboard** — added Subscribers panel with current count, 7d/30d delta, sparkline
- **vercel.json** — cron scheduled
- `.env.example` documents optional `YOUTUBE_API_KEY` (project `arcvest-marketing`, add an API Key from Credentials)

### YouTube Analytics API OAuth attempt

- Ran the OAuth flow against chad@arcvest.com — returned refresh token tied to Chad's personal channel (`UCBQw2bD_2oEhqIAbcgn1zAg`, 0 subs), not @ArcVest
- @ArcVest is a Brand Account — OAuth with a Manager account returns the personal default channel via `mine=true`, and `channel==<ArcVestID>` queries return 403 without Content Partner status
- **Still pending:** have Erik (Owner) run the same OAuth script (`arcvest-marketing/scripts/youtube-oauth.js`) on his Mac to capture a refresh token that can query @ArcVest analytics

### Key findings from CSV analysis (YouTube Studio manual export)

User manually exported Advanced mode CSVs (Content by video, Traffic Source). Analysis revealed:

- **Total subs over 90 days:** 959 gained, 375 lost, **net +584** (channel at 585 today)
- **Three distinct growth bursts:** Dec 8-25 (high churn), Jan 13-26 (clean +240 from a content dump of ~30 videos in 4 days), Apr 9-13 (+215 from Demand Gen budget bump at cheap-inventory pocket)
- **Apr 14 collapse confirmed** — same campaign, same budget, +1 net sub vs +69 the day before. Sole change: new ad added. Pausing it (done today) should restore growth.
- **Only ~38 of 959 subs are attributed to specific videos.** Remaining ~920 come from channel-page subscribes, browse features, algorithm recommendations. Demand Gen drives attention to the channel; daily publishing cadence + algorithm amplification closes the sub.
- **Sub-magnet ranking (volume × rate):** "The Truth About Retirement Income: A Million Dollar Breakdown" (Jan 16, 14 min) topped the list — 4 subs on 4,577 views at 4:44 avg view duration, 3.2% impression CTR. This is now the promoted video.
- **ArcVest Introduction** (Apr 10, 66 sec) had 14,730 impressions but 0 subs — suggests algo promoted it but creative doesn't convert. Worth re-shooting.
- **Shorts feed + External are vanity traffic** — 20-second average view duration, essentially no sub conversion. Don't optimize around them.

### Known limitations / open items

- **Erik OAuth pending** — blocks YouTube Analytics-by-source in the dashboard
- **Site redirect bug** — `arcvest.com/privacy` → `/home` — user fixing manually in Hostinger
- **No YouTube Data API key yet** — cron uses HTML scrape fallback (works but less reliable); user to create API key in Cloud Console when ready
- **Learning period** — Demand Gen's new optimization goal (subscribes-only) and new creative will both trigger 7-day learning. Expect lumpy performance Apr 15-22. Stable metrics by Apr 22+.

### Files added / modified today (committed as `6bc7ac6`)

- `packages/database/migrations/018_youtube_channel_stats.sql` (new)
- `packages/dashboard/src/app/api/cron/youtube-stats/route.ts` (new)
- `packages/dashboard/src/app/api/youtube/stats/route.ts` (new)
- `packages/dashboard/src/app/dashboard/ad-optimizer/page.tsx` (modified — added SubscribersPanel)
- `packages/dashboard/vercel.json` (modified — added cron schedule)
- `.env.example` (modified — documented YOUTUBE_API_KEY)
- `scripts/youtube-oauth.js` (added before commit — standalone OAuth helper for Brand Account flow)
