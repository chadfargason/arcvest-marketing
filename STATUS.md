# ArcVest Marketing Automation - Status Report
**Last Updated:** January 16, 2026

---

## Executive Summary

ArcVest Marketing Automation is an AI-powered content generation and marketing management platform. It automatically scans news sources and email newsletters, scores content ideas for relevance, and generates SEO-optimized blog posts using a multi-AI pipeline.

**Current State:** Fully operational for content generation. Cron jobs configured and running. Gmail integration fixed. Google Ads integration pending API approval.

---

## Quick Links

| Resource | URL |
|----------|-----|
| **Dashboard** | https://arcvest-marketing.vercel.app/dashboard |
| **Content Calendar** | https://arcvest-marketing.vercel.app/dashboard/content |
| **Ideas** | https://arcvest-marketing.vercel.app/dashboard/ideas |
| **Sources** | https://arcvest-marketing.vercel.app/dashboard/sources |
| **Creative Studio** | https://arcvest-marketing.vercel.app/dashboard/creative |
| **Approvals** | https://arcvest-marketing.vercel.app/dashboard/approvals |
| **Analytics** | https://arcvest-marketing.vercel.app/dashboard/analytics |
| **Campaigns** | https://arcvest-marketing.vercel.app/dashboard/campaigns |
| **Settings** | https://arcvest-marketing.vercel.app/dashboard/settings |
| **Pipeline Logs** | https://arcvest-marketing.vercel.app/dashboard/pipeline-logs |

---

## Integration Status

### ✅ FULLY WORKING

| Integration | Status | Details |
|-------------|--------|---------|
| **Supabase Database** | ✅ Working | All tables created, service key configured |
| **RSS News Scanner** | ✅ Working | Scans 13+ sources (MarketWatch, CNBC, Seeking Alpha, etc.) |
| **Gmail Integration** | ✅ Working | Separate OAuth client, tokens stored in DB |
| **Bloomberg Email Scanner** | ✅ Working | Extracts articles from Bloomberg newsletters |
| **Abnormal Returns Scanner** | ✅ Working | Parses daily link roundups |
| **Larry Swedroe Scanner** | ✅ Working | Investment research articles |
| **General Inbox Scanner** | ✅ Working | Catches other financial newsletters |
| **Idea Scoring (Claude)** | ✅ Working | Scores relevance 0-100 with reasoning |
| **Daily Selection** | ✅ Working | Picks top N ideas per day |
| **4-AI Content Pipeline** | ✅ Working | Claude→ChatGPT→Gemini→Claude |
| **GA4 Analytics** | ✅ Working | Property 512536724 connected |
| **Cron Jobs** | ✅ Working | Configured in root vercel.json, Pro plan enabled |

### ⏸️ PENDING

| Integration | Status | Action Required |
|-------------|--------|-----------------|
| **Google Ads API** | ⏸️ Blocked | Developer token in "Test Account" mode. Apply for Basic Access at https://ads.google.com/aw/apicenter |
| **WordPress Auto-Publish** | ⏸️ Not Started | Credentials needed |

---

## Automated Content Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTENT SOURCES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   RSS Feeds     │  │  Email Sources  │  │     Manual Ideas            │ │
│  │  (13+ sources)  │  │  (5 scanners)   │  │   (dashboard input)         │ │
│  │  6:30am daily   │  │  6:30am + 5:30pm│  │      anytime                │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘ │
│           │                    │                         │                  │
│           └────────────────────┼─────────────────────────┘                  │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │     IDEA QUEUE        │                                │
│                    │   (idea_queue table)  │                                │
│                    └───────────┬───────────┘                                │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │   CLAUDE SCORING      │                                │
│                    │  Relevance 0-100      │                                │
│                    │  6:45am daily         │                                │
│                    └───────────┬───────────┘                                │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │   DAILY SELECTION     │                                │
│                    │  Top 6 morning        │                                │
│                    │  Top 2 evening        │                                │
│                    │  6:50am / 5:50pm      │                                │
│                    └───────────┬───────────┘                                │
│                                ▼                                            │
│           ┌────────────────────────────────────────────────┐                │
│           │              4-AI CONTENT PIPELINE              │                │
│           ├────────────────────────────────────────────────┤                │
│           │  1. Claude    → Research & Outline             │                │
│           │  2. ChatGPT   → Expand to Full Draft           │                │
│           │  3. Gemini    → Edit & Polish                  │                │
│           │  4. Claude    → Compliance Check & Finalize    │                │
│           │                                                │                │
│           │  Output: WordPress-ready HTML + SEO metadata   │                │
│           └────────────────────┬───────────────────────────┘                │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │   CONTENT CALENDAR    │                                │
│                    │  Status: "review"     │                                │
│                    │  Ready for publish    │                                │
│                    └───────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Email Sources Configured

| Source | Filter | Description |
|--------|--------|-------------|
| Bloomberg | `from:bloomberg.com` | Daily market newsletters |
| Abnormal Returns | `from:abnormalreturns.com` | Curated link roundups |
| Larry Swedroe | `from:larryswedroeinfo` | Investment research |
| Michael Green | `from:michael.green` | Macro analysis |
| General | Financial keywords | Other newsletters |

### RSS Sources Configured

- MarketWatch
- CNBC Investing
- Seeking Alpha
- Reuters Business
- Bloomberg (RSS)
- Financial Times
- Wall Street Journal
- Barron's
- Morningstar
- Kiplinger
- And more...

---

## Cron Schedule (All Times CT)

### New Simplified Architecture (Job Queue Based)

The system now uses a job queue pattern for reliability:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRON TRIGGERS (Vercel)                       │
│  Lightweight - just enqueue work, don't process                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   6:30am         5:30pm         Every 5min                       │
│   MORNING        EVENING        WORKER                           │
│   enqueue        enqueue        (processes queue)                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Active Crons (6 total)

| Schedule | Endpoint | Description |
|----------|----------|-------------|
| 6:30am CT | `/api/cron/enqueue/morning-batch` | Queue: news_scan, email_scan, bloomberg_scan, score_ideas, select_daily (6) |
| 5:30pm CT | `/api/cron/enqueue/evening-batch` | Queue: email_scan, score_ideas, select_daily (2) |
| Every 5 min | `/api/cron/worker` | Process queued jobs one at a time with checkpointing |
| 2:00am CT | `/api/cron/analytics-sync` | Sync GA4 metrics |
| Every 4 hours | `/api/cron/ads-sync` | Sync Google Ads (when enabled) |
| 6:00am CT | `/api/cron/ads-optimize` | Run bid optimization (when enabled) |

### Job Types Processed by Worker

| Job Type | Priority | Description |
|----------|----------|-------------|
| `news_scan` | 10 | Scan RSS feeds |
| `email_scan` | 10 | Scan Gmail newsletters |
| `bloomberg_scan` | 9 | Parse Bloomberg emails |
| `score_ideas` | 8 | Claude scores pending ideas |
| `select_daily` | 7 | Pick top ideas for today |
| `process_pipeline` | 5 | Run 4-AI content pipeline (7 API calls, checkpointed) |

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `idea_queue` | Raw content ideas from all sources (includes `pipeline_step`, `pipeline_data` for checkpointing) |
| `content_calendar` | Generated blog posts and drafts |
| `approval_queue` | Items pending human review |
| `job_queue` | Persistent job queue with retry logic and exponential backoff |
| `pipeline_logs` | Debug logs from cron jobs and content pipeline (for overnight debugging) |
| `system_state` | OAuth tokens, settings |
| `activity_log` | Audit trail |

### CRM Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Client/prospect database |
| `interactions` | Email/call history |
| `tasks` | Follow-up tasks |

### Analytics Tables

| Table | Purpose |
|-------|---------|
| `daily_metrics` | GA4 traffic data |
| `analytics_reports` | Generated reports |
| `campaigns` | Google Ads campaigns |
| `campaign_metrics` | Ad performance data |
| `optimization_log` | Bid change history |

---

## Environment Variables

### Vercel Production Environment

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://rhysciwzmjleziieeugv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=✅ configured
SUPABASE_SERVICE_KEY=✅ configured

# Google OAuth (for Google Ads / GA4)
GOOGLE_CLIENT_ID=867350115316-... ✅
GOOGLE_CLIENT_SECRET=✅ configured
GOOGLE_REFRESH_TOKEN=✅ configured

# Gmail OAuth (separate client)
GMAIL_CLIENT_ID=65157208709-... ✅
GMAIL_CLIENT_SECRET=✅ configured
# Gmail refresh token stored in database system_state table

# Google Analytics
GOOGLE_ANALYTICS_PROPERTY_ID=512536724

# Google Ads (waiting on Basic Access)
GOOGLE_ADS_DEVELOPER_TOKEN=✅ configured
GOOGLE_ADS_CUSTOMER_ID=9110037605

# AI APIs
ANTHROPIC_API_KEY=✅ configured
# OpenAI and Google AI keys configured in services
```

---

## Recent Fixes (January 14-15, 2026)

### Pipeline Logging System (January 15, 2026)
- **Problem:** When content pipeline runs overnight, no way to debug failures in the morning
- **Solution:** Implemented comprehensive logging to Supabase with dashboard UI
- **Features:**
  - **PipelineLogger Service:** Logs to console + Supabase with auto-flush
  - **Step Timing:** Tracks duration of each pipeline step
  - **Error Capture:** Full stack traces and context for debugging
  - **Dashboard UI:** Filter by level (error/warn/info/debug), job type, time range
  - **Auto-refresh:** Toggle to watch logs in real-time
- **New Files:**
  - `packages/database/migrations/011_pipeline_logs.sql` - Logs table with indexes
  - `packages/services/src/pipeline-logger.ts` - Logger service
  - `packages/dashboard/src/app/api/pipeline-logs/route.ts` - Logs API
  - `packages/dashboard/src/app/dashboard/pipeline-logs/page.tsx` - Dashboard UI
- **Worker Integration:** All job types now log their activity (news_scan, email_scan, bloomberg_scan, score_ideas, select_daily, process_pipeline)
- **Result:** Check `/dashboard/pipeline-logs` each morning to see overnight activity and debug any failures

### Robust Job Queue System with Checkpointing (NEW)
- **Problem:** Content pipeline (7 API calls) frequently timed out on Vercel, losing all progress
- **Solution:** Implemented Supabase-based job queue with checkpointing
- **Features:**
  - **Job Queue Table:** Persistent queue with atomic job claiming (`FOR UPDATE SKIP LOCKED`)
  - **Checkpointing:** Pipeline saves progress after each of 7 steps to `idea_queue.pipeline_data`
  - **Retry Logic:** Exponential backoff (30s, 60s, 120s, 240s, 480s) on failures
  - **Self-Healing:** Worker cleans up jobs stuck in "processing" for >10 minutes
  - **Resume Capability:** If step 4 fails, steps 1-3 work is preserved, only retry from failure point
- **New Files:**
  - `packages/database/migrations/010_job_queue.sql` - Job queue table + functions
  - `packages/services/src/job-queue-service.ts` - Queue operations service
  - `packages/dashboard/src/app/api/cron/worker/route.ts` - Main worker (runs every 5 min)
  - `packages/dashboard/src/app/api/cron/enqueue/morning-batch/route.ts` - Morning job enqueuer
  - `packages/dashboard/src/app/api/cron/enqueue/evening-batch/route.ts` - Evening job enqueuer
- **Simplified Cron Schedule:** Reduced from 15 crons to 6 (enqueuers + worker + analytics)
- **Result:** Successfully tested - 4 articles generated with checkpointing, retries working

### Cron Jobs Not Running
- **Problem:** Crons were defined in `packages/dashboard/vercel.json` but Vercel only reads root `vercel.json`
- **Fix:** Moved all cron definitions to root `vercel.json`
- **Upgraded:** Vercel Pro plan to support multiple daily cron runs

### Gmail OAuth 401 Errors
- **Problem:** Refresh token expired, wrong OAuth client being used
- **Fix:**
  - Created separate `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` env vars
  - Updated `base-email-adapter.ts` to use `GMAIL_*` instead of `GOOGLE_*`
  - Generated new refresh token via OAuth Playground
  - Stored tokens in database `system_state` table
- **Result:** Gmail integration now uses dedicated OAuth client, separate from Google Ads/GA4

### Vercel Auto-Deploy Not Working
- **Problem:** GitHub webhook not triggering deployments
- **Workaround:** Using `vercel --prod` CLI command for deployments
- **Token:** Vercel deploy token configured for CLI access

---

## Manual Testing Commands

```bash
# Test RSS news scan
curl https://arcvest-marketing.vercel.app/api/test/rss-scan

# Test email scan (all sources)
curl https://arcvest-marketing.vercel.app/api/test/email-scan

# Score pending ideas
curl https://arcvest-marketing.vercel.app/api/test/score-ideas

# Select top ideas for today
curl "https://arcvest-marketing.vercel.app/api/test/select-daily?count=3"

# Run content pipeline (generates 1 article)
curl "https://arcvest-marketing.vercel.app/api/test/process-pipeline?limit=1"

# Run full pipeline for all selected ideas
curl https://arcvest-marketing.vercel.app/api/test/process-pipeline

# Test pipeline logging (creates sample log entries)
curl https://arcvest-marketing.vercel.app/api/test/log-test

# View pipeline logs (last 24 hours)
curl "https://arcvest-marketing.vercel.app/api/pipeline-logs?limit=50"

# View only errors
curl "https://arcvest-marketing.vercel.app/api/pipeline-logs?level=error"
```

---

## What's Next

### Immediate Priorities
- [x] Fix cron jobs (moved to root vercel.json)
- [x] Fix Gmail OAuth (separate credentials)
- [x] Upgrade Vercel to Pro plan
- [x] Implement robust job queue with checkpointing
- [x] Add pipeline resume capability for timeouts
- [x] Add pipeline logging for overnight debugging
- [ ] Apply for Google Ads Basic Access
- [ ] Fix Vercel GitHub webhook (auto-deploy)

### When Google Ads Approved
- [ ] Test Google Ads sync endpoint
- [ ] Verify campaigns appear on /dashboard/campaigns
- [ ] Test bid optimization rules
- [ ] Enable ads-sync and ads-optimize crons

### Future Enhancements
- [ ] WordPress auto-publish integration
- [ ] LinkedIn auto-posting
- [ ] Email newsletter automation (Mailchimp/ConvertKit)
- [ ] Lead scoring refinement
- [ ] Custom reporting dashboards
- [ ] A/B testing for headlines

---

## Creative Studio

**URL:** https://arcvest-marketing.vercel.app/dashboard/creative

The Creative Studio provides AI-powered tools for generating advertising content.

### Phrase Variation Generator (NEW - January 16, 2026)

Generate multiple variations of a seed phrase for ad copy testing.

**Features:**
- Enter a seed phrase (e.g., "Give us 15 minutes and we'll save you $15,000")
- Generate 5-20 variations with different styles (varied, similar, contrasting)
- **Star Rating System:** Rate each variation 1-5 stars
- **Smart Rejection:** 1-star or delete removes variation and remembers it
- **Future-Proof:** Rejected phrases are excluded from future generations
- **Copy Tools:** Copy all, or copy only 4-5 star rated variations

**New Database Tables:**
- `phrase_variations` - stores generated variations with ratings
- `rejected_phrases` - stores patterns to avoid in future generations

**API Endpoints:**
```bash
# Generate variations
curl -X POST https://arcvest-marketing.vercel.app/api/creative/phrase-variations \
  -H "Content-Type: application/json" \
  -d '{"seedPhrase": "Your phrase here", "count": 10, "style": "varied"}'

# Fetch existing variations
curl "https://arcvest-marketing.vercel.app/api/creative/phrase-variations?seedPhrase=..."

# Rate a variation (1-5 stars, 1 = reject)
curl -X PATCH https://arcvest-marketing.vercel.app/api/creative/phrase-variations/rating \
  -H "Content-Type: application/json" \
  -d '{"variationId": "uuid", "rating": 5}'
```

### RSA Generator

Generate Google Ads Responsive Search Ads with persona/voice targeting.

**Features:**
- 8 target personas (pre-retirees, HNW investors, business owners, etc.)
- 5 voice styles (educational, direct, story-driven, data-driven, authority)
- Generates 15 headlines + 4 descriptions per combination
- Built-in compliance checking
- Character count validation (30 char headlines, 90 char descriptions)

---

## Support & Resources

| Resource | Location |
|----------|----------|
| GitHub Repo | https://github.com/chadfargason/arcvest-marketing |
| Vercel Dashboard | https://vercel.com/chadfargasons-projects/arcvest-marketing |
| Supabase Dashboard | https://supabase.com/dashboard/project/rhysciwzmjleziieeugv |
| Google Ads API Center | https://ads.google.com/aw/apicenter |
| Google Cloud Console | https://console.cloud.google.com/apis/credentials |

### Local Files
- **Project root:** `C:/code/arcvest-marketing`
- **Environment:** `C:/code/arcvest-marketing/.env.local`
- **AI Instructions:** `C:/code/.claude/CLAUDE.md`

---

## Deployment

**Current deployment method:** Manual via Vercel CLI

```bash
cd C:/code/arcvest-marketing
vercel --prod --yes --token=YOUR_TOKEN
```

**Note:** GitHub auto-deploy webhook needs to be reconnected in Vercel settings.

---

## Architecture Overview

```
arcvest-marketing/
├── packages/
│   ├── dashboard/          # Next.js 15 frontend
│   │   ├── src/app/        # App router pages
│   │   │   ├── api/        # API routes (cron, test, auth)
│   │   │   └── dashboard/  # Dashboard pages
│   │   └── src/lib/        # Utilities, clients
│   │
│   ├── services/           # Backend services
│   │   ├── gmail-service.ts
│   │   ├── contact-service.ts
│   │   ├── source-adapters/  # RSS, Email adapters
│   │   └── scoring/          # Idea scoring
│   │
│   ├── agents/             # AI agent implementations
│   │   ├── analytics/
│   │   ├── content/
│   │   ├── creative/       # RSA generator
│   │   └── paid-media/
│   │
│   ├── shared/             # Shared types, utils, config
│   │
│   └── database/           # Migrations, seeds
│
├── vercel.json             # Deployment config + crons
└── .env.local              # Local environment
```

---

**Report Generated:** January 16, 2026, 10:00 AM CT
