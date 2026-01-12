# Google Ads API Integration Design Document

**Application Name:** ArcVest Marketing Dashboard
**Company:** ArcVest Wealth Management
**Document Version:** 1.0
**Date:** January 2026

---

## 1. Executive Summary

ArcVest Wealth Management is a fee-only fiduciary Registered Investment Advisor (RIA) that provides comprehensive wealth management services. The ArcVest Marketing Dashboard is an internal tool designed to help our marketing team monitor and analyze the performance of our Google Ads campaigns alongside other marketing metrics.

This document describes the technical design and intended use of our Google Ads API integration.

---

## 2. Company Information

**Company Name:** ArcVest Wealth Management
**Website:** https://arcvest.com
**Industry:** Financial Services / Wealth Management
**Google Ads Customer ID:** 911-003-7605

**Primary Contact:**
Chad Fargason
Managing Partner
ArcVest Wealth Management

---

## 3. Application Overview

### 3.1 Purpose

The ArcVest Marketing Dashboard is a private, internal-only web application that consolidates marketing analytics from multiple sources into a single unified dashboard. The application is used exclusively by ArcVest employees to:

- Monitor Google Ads campaign performance
- Track website traffic via Google Analytics
- Manage leads and client pipeline
- Analyze marketing ROI and cost-per-acquisition

### 3.2 Users

This application is **not** a third-party tool or service offered to external customers. It is used exclusively by:

- ArcVest marketing team members (2-3 users)
- ArcVest leadership for performance reviews

### 3.3 Access Control

- The application requires authenticated login
- Only authorized ArcVest employees can access the dashboard
- No external parties have access to the application or data

---

## 4. Google Ads API Usage

### 4.1 API Features Used

Our application uses the Google Ads API (v18) with **read-only** access to retrieve campaign performance data. We use the following API features:

| Feature | Purpose |
|---------|---------|
| `GoogleAdsService.SearchStream` | Query campaign metrics |
| Campaign resource | Retrieve campaign names and status |
| Metrics resource | Retrieve impressions, clicks, cost, conversions |
| Segments resource | Retrieve date-based breakdowns |

### 4.2 Data Retrieved

We retrieve the following data from our own Google Ads account only:

- **Campaign Information:** Campaign ID, name, status
- **Performance Metrics:** Impressions, clicks, cost, conversions
- **Calculated Metrics:** CTR, CPC, CPA
- **Time Segments:** Daily performance data for trend analysis

### 4.3 API Query Examples

```sql
-- Campaign Performance Query
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.ctr,
  metrics.average_cpc
FROM campaign
WHERE segments.date BETWEEN '2026-01-01' AND '2026-01-12'
  AND campaign.status != 'REMOVED'

-- Account Summary Query
SELECT
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM customer
WHERE segments.date BETWEEN '2026-01-01' AND '2026-01-12'
```

### 4.4 API Call Frequency

- **Dashboard Load:** 3 API calls per page load
- **Expected Usage:** 50-100 API calls per day
- **Caching:** Access tokens cached for 55 minutes to minimize OAuth requests

---

## 5. Technical Architecture

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ArcVest Marketing Dashboard              │
│                      (Next.js Application)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │  Analytics  │  │  Campaign           │ │
│  │    Home     │  │    Page     │  │  Performance Table  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │               │                    │              │
│         └───────────────┼────────────────────┘              │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                       │
│              │   API Route Layer   │                       │
│              │  /api/analytics     │                       │
│              └─────────────────────┘                       │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Google Ads  │ │  Google     │ │  Supabase   │
   │    API      │ │ Analytics 4 │ │  Database   │
   └─────────────┘ └─────────────┘ └─────────────┘
```

### 5.2 Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Authentication | Supabase Auth |

### 5.3 Google Ads API Client

Our API client implementation:

- Uses OAuth 2.0 with refresh tokens for authentication
- Implements token caching to minimize OAuth requests
- Uses the REST API via `googleads.googleapis.com`
- All requests include proper developer token headers

---

## 6. Data Handling & Security

### 6.1 Data Storage

- Google Ads data is **not stored** in our database
- Data is fetched in real-time on each dashboard load
- No Google Ads data is cached beyond the current session

### 6.2 Credential Security

| Credential | Storage Location |
|------------|------------------|
| Developer Token | Vercel Environment Variables (encrypted) |
| OAuth Client ID | Vercel Environment Variables (encrypted) |
| OAuth Client Secret | Vercel Environment Variables (encrypted) |
| Refresh Token | Vercel Environment Variables (encrypted) |

### 6.3 Access Control

- Application requires authenticated login
- Only ArcVest employees have credentials
- No public access to API endpoints
- All API routes verify authentication before processing

### 6.4 Data Privacy

- We only access our own Google Ads account (Customer ID: 911-003-7605)
- No third-party data is accessed
- No data is shared with external parties
- Compliant with financial services data handling requirements

---

## 7. User Interface

### 7.1 Analytics Dashboard

The analytics dashboard displays Google Ads data in the following sections:

**Overview Metrics Cards:**
- Total Ad Spend
- Cost per Lead
- Total Conversions
- Conversion Rate

**Secondary Metrics:**
- Impressions
- Clicks
- Click-Through Rate (CTR)
- Cost per Click (CPC)

**Performance Charts:**
- Daily spend and conversions over time (line/area chart)
- Visual trend analysis for selected date range

**Campaign Performance Table:**
| Column | Description |
|--------|-------------|
| Campaign | Campaign name |
| Status | Active/Paused/Ended |
| Impressions | Total impressions |
| Clicks | Total clicks |
| CTR | Click-through rate |
| Spend | Total cost |
| CPC | Average cost per click |
| Conversions | Total conversions |
| CPA | Cost per acquisition |

### 7.2 Date Range Selection

Users can view data for:
- Last 7 days
- Last 30 days
- Last 90 days
- Last 365 days

---

## 8. Compliance

### 8.1 Google Ads API Terms

Our application complies with Google Ads API Terms of Service:

- **Single Account Access:** We only access our own Google Ads account
- **No Resale:** We do not resell or provide API access to third parties
- **Read-Only:** We only read data; we do not modify campaigns via API
- **Rate Limits:** Our usage is well within standard rate limits
- **Data Handling:** We follow Google's data handling requirements

### 8.2 Financial Services Compliance

As a Registered Investment Advisor, ArcVest maintains:

- SOC 2 compliant hosting (Vercel)
- Encrypted data transmission (HTTPS/TLS)
- Access logging and audit trails
- Employee-only access to marketing data

---

## 9. Support & Maintenance

### 9.1 Development Team

The application is developed and maintained by the ArcVest technology team with assistance from contracted developers.

### 9.2 Error Handling

- API errors are logged for debugging
- Users see friendly error messages
- Automatic fallback to cached/database data if API unavailable

### 9.3 Updates

- Application updates are deployed via CI/CD pipeline
- Google Ads API version updates are applied as needed
- Security patches are applied promptly

---

## 10. Conclusion

The ArcVest Marketing Dashboard is a straightforward internal analytics tool that uses the Google Ads API to display campaign performance data to our small marketing team. We use read-only API access to retrieve metrics from our single Google Ads account and display them alongside other marketing data in a unified dashboard.

We are requesting Basic Access to enable our production Google Ads account integration. Our usage is minimal (under 100 API calls/day) and strictly for internal business analytics purposes.

---

**Document Prepared By:**
ArcVest Wealth Management
https://arcvest.com

**For Questions Contact:**
Chad Fargason
Managing Partner
