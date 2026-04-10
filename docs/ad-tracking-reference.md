# ArcVest Ad & Tracking Reference

**Last Updated:** April 10, 2026

This document maps all account IDs, tags, measurement IDs, and how they connect across Google Ads, Meta Ads, GA4, GoHighLevel, and the website.

---

## Platform Accounts

### Google Ads
- **Customer ID:** `911-003-7605` (numeric: `9110037605`)
- **Manager/MCC Account ID:** `263-406-1148` (numeric: `2634061148`)
- **Developer Token:** `1-joGIfJtiTUXjGWnT13Ww`
- **Google Ads Tag (gtag):** `AW-17761344768`
- **API Version:** v23

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

| Name | Type | Primary | Fires On |
|------|------|---------|----------|
| Lead Form Submission | WEBPAGE | Yes | Form submit (body tracking code) |
| Book appointment | WEBPAGE | Yes | Form submit (body tracking code) |
| Free Guide Sign-up | WEBPAGE | Yes | Form submit (needs setup) |
| Lead form - Submit | LEAD_FORM_SUBMIT | Yes | Google Ads lead form extension |
| Form | WEBPAGE_CODELESS | **Secondary** | Auto-detected (demoted Apr 10) |
| Page view (/consultation) | WEBPAGE_CODELESS | **Secondary** | Page load (demoted Apr 10) |

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

## Active Campaigns (as of April 10, 2026)

### Google Ads
| Campaign | Type | Budget | Status |
|----------|------|--------|--------|
| Retiree-HNW-Test-2026-02 | Search | $15/day | Enabled |
| ArcVest Podcast Promo - YouTube | Demand Gen | $20/day | Enabled |
| Campaign #1 | Performance Max | $20/day | **Paused** |
| Leads-Search-1 | Search | $25/day | **Paused** |

### Meta Ads
| Campaign | Objective | Budget | Status |
|----------|-----------|--------|--------|
| Retirement is attainable | OUTCOME_TRAFFIC | $15/day | Active |
| ArcVest Podcast - Video Views | OUTCOME_AWARENESS | $5/day | **Paused** |
| Fees campaigns (3) | Various | Various | **Paused** |
| [12/11/2025] Promoting | LINK_CLICKS | $16/day | **Paused** |

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
