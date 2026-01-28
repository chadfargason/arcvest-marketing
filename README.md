# ArcVest Marketing Automation Platform

AI-powered content generation and marketing management platform for ArcVest wealth management.

## Quick Links

| Resource | URL |
|----------|-----|
| **Live Dashboard** | https://arcvest-marketing.vercel.app/dashboard |
| **Pipeline Logs** | https://arcvest-marketing.vercel.app/dashboard/pipeline-logs |
| **Content Calendar** | https://arcvest-marketing.vercel.app/dashboard/content |
| **Ideas Queue** | https://arcvest-marketing.vercel.app/dashboard/ideas |

---

## Troubleshooting Guide

### Common Issues

#### 1. Gmail OAuth Token Expired (Token refresh failed: 400)

**Symptoms:**
- Email sources failing in pipeline logs
- `Token refresh failed: 400` errors
- `score_ideas` shows "Scored 0 ideas"
- `select_daily` shows "Selected 0 ideas"

**Fix:**
1. Visit: https://arcvest-marketing.vercel.app/api/auth/gmail-setup
2. Authorize with the Google account receiving newsletters
3. Done - tokens are saved automatically

**Why it happens:** Google OAuth refresh tokens can expire after extended periods of non-use or if manually revoked.

#### 2. No New Content Being Generated

**Check in order:**
1. **Pipeline Logs**: `/dashboard/pipeline-logs` - Look for errors
2. **Gmail Token**: See fix above if email sources failing
3. **Vercel Cron**: Check if crons are running in Vercel dashboard
4. **RSS Feeds**: Test `/api/test/rss-scan` manually

#### 3. Cron Jobs Not Running

**Verify in Vercel:**
1. Go to Vercel Dashboard > Project > Settings > Crons
2. Verify crons are enabled (requires Vercel Pro)
3. Check "Logs" tab for cron execution history

**Manual Testing:**
```bash
# Test RSS news scan
curl https://arcvest-marketing.vercel.app/api/test/rss-scan

# Test email scan
curl https://arcvest-marketing.vercel.app/api/test/email-scan

# Test idea scoring
curl https://arcvest-marketing.vercel.app/api/test/score-ideas

# Test daily selection
curl https://arcvest-marketing.vercel.app/api/test/select-daily?count=2

# Test pipeline processing
curl https://arcvest-marketing.vercel.app/api/test/process-pipeline?limit=1
```

---

## Architecture Overview

### Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel with cron jobs
- **AI Models:** Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google)
- **Integrations:** Gmail API, Google Ads API, GA4, WordPress

### Monorepo Structure

```
arcvest-marketing/
├── packages/
│   ├── dashboard/       # Next.js frontend (port 3001)
│   ├── agents/          # AI agent implementations
│   ├── services/        # Backend business logic
│   ├── shared/          # Types, config, utilities
│   └── database/        # SQL migrations
├── package.json         # Root workspace config
├── turbo.json           # Turbo build config
└── vercel.json          # Cron schedule (in packages/dashboard/)
```

### Package Details

| Package | Purpose |
|---------|---------|
| `@arcvest/dashboard` | Main web UI, API routes, cron endpoints |
| `@arcvest/agents` | AI agents: ContentAgent, CreativeAgent, SEOAgent, etc. |
| `@arcvest/services` | GmailService, IdeaScorer, JobQueueService, etc. |
| `@arcvest/shared` | TypeScript types, config files, scoring rules |
| `@arcvest/database` | 12 SQL migration files for schema |

---

## Content Pipeline

### How It Works

```
Content Discovery (6:30am + 5:30pm CT)
├── RSS Feeds → 13+ financial news sources
├── Email Newsletters → Bloomberg, Abnormal Returns, etc.
└── Manual Ideas → Dashboard input
         │
         ▼
    Idea Queue (Supabase)
         │
         ▼
    Claude Scoring (0-100 relevance)
         │
         ▼
    Daily Selection (Top 6 morning, Top 2 evening)
         │
         ▼
    4-AI Content Pipeline
    ├── Step 1: Claude → Research & Outline
    ├── Step 2: ChatGPT → Expand to Full Draft
    ├── Step 3: Gemini → Edit & Polish
    └── Step 4: Claude → Compliance Check & Finalize
         │
         ▼
    Content Calendar (WordPress-ready)
         │
         ▼
    Approval Queue → Human Review
         │
         ▼
    Published (WordPress)
```

### Cron Schedule (vercel.json)

All times in UTC. Subtract 6 hours for CT.

| Time (UTC) | CT Time | Endpoint | Purpose |
|------------|---------|----------|---------|
| 12:30 | 6:30am | `/api/cron/news-scan` | RSS feed scan |
| 12:30 | 6:30am | `/api/cron/email-scan` | Email newsletter scan |
| 12:35 | 6:35am | `/api/cron/bloomberg-scan` | Bloomberg-specific scan |
| 12:45 | 6:45am | `/api/cron/score-ideas` | Score pending ideas |
| 12:50 | 6:50am | `/api/cron/select-daily?count=6` | Select top 6 for morning |
| 12:55 | 6:55am | `/api/cron/process-pipeline` | Start content generation |
| 13:00-13:25 | 7:00-7:25am | `/api/cron/process-pipeline` | Continue generation (every 5 min) |
| 23:30 | 5:30pm | `/api/cron/email-scan` | Evening email scan |
| 23:45 | 5:45pm | `/api/cron/score-ideas` | Score new ideas |
| 23:50 | 5:50pm | `/api/cron/select-daily?count=2` | Select top 2 for evening |
| 23:55 | 5:55pm | `/api/cron/process-pipeline` | Start evening generation |
| 00:00 | 6:00pm | `/api/cron/process-pipeline` | Continue generation |
| 08:00 | 2:00am | `/api/cron/analytics-sync` | GA4 metrics sync |
| Every 4h | - | `/api/cron/ads-sync` | Google Ads sync |
| 12:00 | 6:00am | `/api/cron/ads-optimize` | Bid optimization |

### Email Sources

| Source | Description | Filter |
|--------|-------------|--------|
| `email-bloomberg` | Bloomberg daily newsletters | from:bloomberg.com |
| `email-abnormal-returns` | Curated daily finance links | from:abnormalreturns.com |
| `email-larry-swedroe` | Investment research | from:larryswe OR swedroe |
| `email-michael-green` | Macro analysis | from:michael AND green |
| `email-general` | Misc financial newsletters | Various |

### RSS Sources

Configured in `packages/dashboard/src/lib/news-sourcer/sources.ts`:
- MarketWatch
- CNBC
- Seeking Alpha
- Reuters
- Bloomberg (RSS)
- And 8+ more...

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `idea_queue` | Discovered content ideas with scoring |
| `content_calendar` | Generated blog posts and drafts |
| `approval_queue` | Items pending human review |
| `job_queue` | Persistent job queue for pipeline |
| `pipeline_logs` | Debug logs for pipeline execution |
| `system_state` | OAuth tokens, settings, credentials |
| `source_adapters` | Configuration for content sources |
| `contacts` | CRM contact database |
| `tasks` | Team task management |
| `campaigns` | Marketing campaigns |
| `daily_metrics` | GA4 traffic data |

### Viewing Data

Use Supabase dashboard: https://supabase.com/dashboard/project/rhysciwzmjleziieeugv

Or query via API:
```javascript
const { data } = await supabase.from('idea_queue').select('*').order('created_at', { ascending: false }).limit(20);
```

---

## API Reference

### Test Endpoints (for debugging)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/test/rss-scan` | GET | Test RSS feed scanning |
| `/api/test/email-scan` | GET | Test email source scanning |
| `/api/test/score-ideas` | GET | Score pending ideas |
| `/api/test/select-daily?count=N` | GET | Select top N ideas |
| `/api/test/process-pipeline?limit=N` | GET | Generate N articles |
| `/api/test/log-test` | GET | Test pipeline logging |

### Pipeline Logs API

```
GET /api/pipeline-logs?hours=24&limit=50&level=error&jobType=email_scan
```

Parameters:
- `hours`: How far back to look (default: 24)
- `limit`: Max records (default: 50)
- `level`: Filter by level (error, warn, info, debug)
- `jobType`: Filter by job type (email_scan, score_ideas, select_daily, etc.)

### Auth Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/gmail-setup` | Start Gmail OAuth flow |
| `/api/auth/gmail-setup/callback` | Gmail OAuth callback |
| `/api/auth/google-setup` | Start Google Ads OAuth flow |
| `/api/auth/google-setup/callback` | Google Ads OAuth callback |

---

## Development

### Local Setup

```bash
# Install dependencies
cd arcvest-marketing
npm install

# Copy environment variables
cp packages/dashboard/.env.example packages/dashboard/.env.local
# Edit .env.local with your credentials

# Run development server
npm run dev

# Dashboard runs on http://localhost:3001
```

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Gmail OAuth (separate from Google Ads)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=

# AI APIs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# Google Ads (optional, pending Basic Access approval)
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=

# GA4
GA4_PROPERTY_ID=512536724

# Vercel Cron
CRON_SECRET=
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@arcvest/dashboard
```

### Deploying

```bash
# Deploy to Vercel production
vercel --prod

# Or push to main branch for auto-deploy
git push origin main
```

---

## Services Reference

### GmailService

Location: `packages/services/src/gmail-service.ts`

Handles Gmail API integration. Tokens stored in `system_state` table with key `gmail_tokens`.

Key methods:
- `fetchNewMessages()` - Get recent emails
- `getAccessToken()` - Get valid token (auto-refreshes)
- `isConnected()` - Check if Gmail is authorized

### IdeaScorer

Location: `packages/services/src/scoring/idea-scorer.ts`

Uses Claude to score content ideas 0-100 for relevance to ArcVest's audience.

### JobQueueService

Location: `packages/services/src/job-queue-service.ts`

Persistent job queue with:
- Checkpointing after each AI step
- Exponential backoff retry
- Self-healing for stuck jobs
- Resume from failure point

### DailySelectionService

Location: `packages/services/src/selection/daily-selection-service.ts`

Selects top ideas for content generation based on score and source diversity.

---

## Agents Reference

Location: `packages/agents/src/`

| Agent | Purpose |
|-------|---------|
| `ContentAgent` | 4-AI blog post generation |
| `CreativeAgent` | RSA ad generation |
| `PaidMediaAgent` | Google Ads optimization |
| `SEOAgent` | Keyword research |
| `AnalyticsAgent` | GA4 intelligence |
| `ResearchAgent` | Competitive intelligence |
| `OrchestratorAgent` | Multi-agent coordination |

---

## Dashboard Pages

| Path | Purpose |
|------|---------|
| `/dashboard` | KPI overview, hot leads, pending approvals |
| `/dashboard/content` | Blog post drafts, scheduling, publishing |
| `/dashboard/ideas` | Discovered ideas, scoring, selection |
| `/dashboard/sources` | Source adapter management |
| `/dashboard/creative` | RSA generator, phrase variations |
| `/dashboard/approvals` | Human review queue |
| `/dashboard/analytics` | GA4 traffic trends |
| `/dashboard/campaigns` | Google Ads campaigns |
| `/dashboard/pipeline-logs` | Debug logs for cron jobs |
| `/dashboard/contacts` | CRM contact database |
| `/dashboard/agents` | Agent status and metrics |
| `/dashboard/tasks` | Team task management |
| `/dashboard/settings` | System configuration |

---

## Monitoring & Debugging

### Pipeline Logs Dashboard

Visit `/dashboard/pipeline-logs` to see:
- Recent job executions
- Error messages with details
- Filter by job type, level, time range
- Job duration metrics

### Key Log Levels

| Level | Meaning |
|-------|---------|
| `error` | Something failed - needs attention |
| `warn` | Recoverable issue (e.g., one source failed) |
| `info` | Normal operation logs |
| `debug` | Detailed debugging info |

### Common Log Messages

| Message | Meaning |
|---------|---------|
| "Token refresh failed: 400" | Gmail OAuth token expired - re-authorize |
| "Selected 0 ideas" | No ideas scored high enough, or no ideas available |
| "Scored 0 ideas" | No new ideas to score |
| "Email scan complete: 0 ideas from 0 sources" | All email sources failed |

---

## Integration Status

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase | Working | Database fully operational |
| Gmail | Working* | *Requires periodic re-auth |
| RSS Feeds | Working | 13+ sources configured |
| Claude AI | Working | Content scoring and generation |
| ChatGPT | Working | Content expansion |
| Gemini | Working | Content editing |
| GA4 | Working | Analytics sync |
| Google Ads | Pending | Awaiting Basic Access approval |
| WordPress | Pending | Credentials needed |

---

## Support

For issues:
1. Check `/dashboard/pipeline-logs` for errors
2. Try manual test endpoints
3. Re-authorize OAuth if token errors
4. Check Vercel logs for cron failures

---

*Last updated: January 2026*
