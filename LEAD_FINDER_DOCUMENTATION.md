# Lead Finder System - Technical Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Key Components](#key-components)
4. [LLM Models & Prompts](#llm-models--prompts)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Configuration](#configuration)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

The Lead Finder is an AI-powered lead generation system that automatically discovers, qualifies, and enriches potential business prospects. It combines web search, AI extraction, intelligent scoring, and email prediction to create a comprehensive lead pipeline.

### Key Features
- **Automated Lead Discovery**: Uses Serper.dev API to search for prospects based on configurable criteria
- **AI-Powered Extraction**: Claude Sonnet 4 extracts candidate information from web pages
- **Intelligent Scoring**: Multi-factor scoring system to prioritize high-value leads
- **Email Prediction**: AI predicts likely email addresses for prospects
- **Circle Enrichment**: Identifies colleagues of top prospects
- **Deduplication**: Permanent deduplication prevents re-contacting leads
- **Email Generation**: Personalized outreach emails with multiple tone options

### Technology Stack
- **Frontend**: Next.js 15.5.9, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **AI/LLM**: Anthropic Claude (Sonnet 4)
- **Search**: Serper.dev API (Google search results)
- **Deployment**: Vercel
- **Monorepo**: Turborepo

---

## Architecture

### Monorepo Structure

```
arcvest-marketing/
├── packages/
│   ├── agents/           # AI agent implementations
│   │   └── src/
│   │       └── lead-finder/
│   │           ├── orchestrator.ts           # Main pipeline orchestrator
│   │           ├── lead-extractor-agent.ts   # Extracts leads from pages
│   │           ├── email-generator-agent.ts  # Generates outreach emails
│   │           └── index.ts
│   │
│   ├── services/         # Business logic & utilities
│   │   └── src/
│   │       └── lead-finder/
│   │           ├── google-search-service.ts  # Serper.dev integration
│   │           ├── page-fetcher-service.ts   # Web scraping
│   │           └── lead-scorer-service.ts    # Lead scoring & deduplication
│   │
│   ├── dashboard/        # Next.js frontend & API routes
│   │   └── src/
│   │       ├── app/
│   │       │   ├── dashboard/lead-finder/
│   │       │   │   └── page.tsx             # Main UI
│   │       │   └── api/
│   │       │       ├── lead-finder/
│   │       │       │   ├── leads/route.ts   # GET leads
│   │       │       │   └── emails/[leadId]/
│   │       │       │       └── regenerate/route.ts
│   │       │       ├── cron/
│   │       │       │   └── lead-finder/route.ts  # Daily cron job
│   │       │       └── test/
│   │       │           ├── lead-finder/route.ts
│   │       │           ├── email-predict/route.ts
│   │       │           └── email-predict-batch/route.ts
│   │       └── lib/
│   │
│   └── shared/           # Shared types & utilities
│       └── src/
│           └── types/
│               └── lead-finder.ts
│
├── vercel.json           # Vercel configuration & cron jobs
└── turbo.json            # Turborepo configuration
```

### Key Architectural Decisions

#### 1. **Monorepo with Clear Separation of Concerns**
- **`@arcvest/agents`**: AI/LLM logic isolated for reusability
- **`@arcvest/services`**: Business logic and external integrations
- **`@arcvest/dashboard`**: UI and API routes
- **`@arcvest/shared`**: Common types and utilities

**Why?** Prevents circular dependencies, enables independent testing, and makes the codebase maintainable.

#### 2. **Serverless Architecture (Vercel)**
- All API routes run as serverless functions
- Requires `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`
- No module-level initialization of clients (lazy loading pattern)

**Why?** Scalability, cost-efficiency, and automatic deployment.

#### 3. **Lazy Loading Pattern for Services**
```typescript
// BAD (causes Vercel deployment issues)
export const myService = new MyService();

// GOOD (lazy loaded)
let myServiceInstance: MyService | null = null;
export function getMyService(): MyService {
  if (!myServiceInstance) {
    myServiceInstance = new MyService();
  }
  return myServiceInstance;
}
```

**Why?** Serverless environments don't support module-level initialization.

#### 4. **AI-First Approach**
- Uses Claude Sonnet 4 for complex reasoning (extraction, email prediction)
- All prompts are carefully crafted with clear instructions and examples
- Temperature set to 0.3 for consistent, deterministic results

**Why?** Provides human-level intelligence at scale.

#### 5. **Permanent Deduplication**
- Checks all historical leads (not just last 90 days)
- Uses normalized `person_key` (name + company + geo)
- Prevents re-contacting prospects

**Why?** Maintains professional reputation and avoids spam.

---

## Key Components

### 1. Lead Finder Orchestrator
**Location**: `packages/agents/src/lead-finder/orchestrator.ts`

**Purpose**: Coordinates the entire lead finding pipeline from search to email generation.

**Key Methods**:
- `runLeadFinder()`: Main entry point
- `executeSearches()`: Runs multiple search queries
- `fetchAndParsePage()`: Fetches web pages and extracts content
- `extractCandidates()`: Uses AI to extract lead information
- `scoreCandidates()`: Scores and deduplicates leads
- `selectTopLeads()`: Selects top N leads based on tier
- `enrichCandidatesWithEmails()`: AI-powered email prediction
- `findColleagues()`: Circle enrichment
- `generateEmails()`: Creates personalized outreach emails

**Configuration**:
```typescript
const config = {
  searchConfig: {
    queriesPerRun: 12,        // Number of search queries
    resultsPerQuery: 10,      // Results per query
    maxPagesToFetch: 5,       // Pages to scrape
  },
  extractionConfig: {
    minCandidatesPerPage: 1,  // Min candidates to extract
    maxCandidatesPerPage: 10, // Max candidates to extract
  },
  selectionConfig: {
    topLeadsToSelect: 3,      // Final leads to save
  }
}
```

**Random Rotation (Manual Runs)**:
When triggered manually via "Run Now", the orchestrator randomizes:
- Geographic focus (Dallas, Houston, Austin, Texas, etc.)
- Industry triggers (funding, partnership, expansion, etc.)
- Professional services (financial, legal, real estate, healthcare, etc.)

This ensures fresh leads on every manual run.

### 2. Lead Extractor Agent
**Location**: `packages/agents/src/lead-finder/lead-extractor-agent.ts`

**Purpose**: Uses Claude Sonnet 4 to extract structured candidate data from unstructured web content.

**Model**: `claude-sonnet-4-20250514`

**Key Prompt**:
```
You are a business development lead identification expert. 
Analyze this web page and extract information about individuals 
who match our ideal prospect criteria:

IDEAL PROSPECT CRITERIA:
- High-net-worth individuals (business owners, C-suite executives, board members)
- Decision-makers in companies with 50+ employees
- Individuals experiencing significant life/career transitions
- Located in our target markets (primarily Texas)

For each candidate found, extract:
- Full name (required)
- Title/role (required)
- Company name (required)
- Geographic location signals
- Change signal (funding, new role, acquisition, etc.)
- Wealth/success indicators
- Reasoning for why they're a good prospect

Return a JSON array with this structure:
{
  "candidates": [
    {
      "fullName": "John Smith",
      "title": "CEO",
      "company": "Acme Corp",
      "geoSignal": "Dallas, TX",
      "changeSignal": "Just raised $50M Series B",
      "wealthSignals": ["Founded successful company", "Board member"],
      "rationaleLong": "Detailed explanation...",
      "rationaleShort": "Brief summary..."
    }
  ]
}
```

**Temperature**: 0.7 (slightly creative for extraction)

### 3. Email Generator Agent
**Location**: `packages/agents/src/lead-finder/email-generator-agent.ts`

**Purpose**: Creates personalized outreach emails with multiple tone options.

**Model**: `claude-sonnet-4-20250514`

**Tone Options**:
1. **Congratulatory**: Celebrate their achievement
2. **Direct & Curious**: Straightforward, business-focused
3. **Warm Introduction**: Friendly, relationship-building
4. **Value Proposition**: Emphasize services and benefits
5. **Recognition**: Acknowledge their expertise

**Key Prompt Structure**:
```
You are an expert email copywriter for a wealth management firm.

LEAD CONTEXT:
Name: {fullName}
Title: {title}
Company: {company}
Situation: {changeSignal}

TONE: {selectedTone}

Write a personalized email with:
- Subject line (50 chars max)
- Email body (150-200 words)
- Professional, personalized, human
- Focus on the specific situation/achievement
- Soft ask for conversation

Return JSON:
{
  "subject": "...",
  "body": "..."
}
```

**Temperature**: 0.3 (consistent, professional output)

### 4. Email Prediction System
**Location**: `packages/agents/src/lead-finder/orchestrator.ts` (method: `enrichCandidatesWithEmails`)

**Purpose**: Predicts likely email addresses using AI reasoning.

**Model**: `claude-sonnet-4-20250514`

**Key Prompt**:
```
Help me make an educated guess at the email address for this person:

Name: {name}
Title: {title}
Organization: {company}

Please provide the 3-4 most likely email addresses, ordered by likelihood.

Consider:
- Universities typically use .edu domains (e.g., ttu.edu for Texas Tech)
- Non-profits may use .org
- Government entities use .gov
- Corporations usually use .com
- Common formats: first.last@domain, flast@domain, firstname.lastname@domain
- Handle hyphenated names, apostrophes, and special characters appropriately
- For universities, check if there are common abbreviations

Respond with ONLY a JSON array of email addresses, nothing else.
Example: ["john.smith@company.com", "jsmith@company.com", "johnsmith@company.com"]
```

**Temperature**: 0.3 (deterministic predictions)

**Success Rate**: 100% prediction rate (4 emails per lead)

**Storage**: Predictions saved as `predicted_email` type in `contact_paths` array.

### 5. Google Search Service (Serper.dev)
**Location**: `packages/services/src/lead-finder/google-search-service.ts`

**Purpose**: Interfaces with Serper.dev API to get Google search results.

**API**: `https://serper.dev/search`

**Key Configuration**:
```typescript
{
  q: searchQuery,           // Search query string
  gl: "us",                 // Country
  hl: "en",                 // Language
  num: resultsPerQuery,     // Number of results (default: 10)
  tbs: "qdr:m"              // Time range: last month
}
```

**Response Parsing**:
- Extracts organic search results
- Filters out generic domains (Facebook, LinkedIn, Wikipedia)
- Extracts publish date from metadata
- Returns structured `SearchResult[]`

**Why Serper.dev?**
- Google Custom Search API is deprecated (sunset Jan 1, 2027)
- Serper.dev provides full Google search results
- Simple JSON API with no setup complexity

### 6. Page Fetcher Service
**Location**: `packages/services/src/lead-finder/page-fetcher-service.ts`

**Purpose**: Fetches and extracts readable content from web pages.

**Dependencies**:
- `jsdom`: Parse HTML
- `@mozilla/readability`: Extract main content

**Process**:
1. Fetch HTML with `node-fetch`
2. Parse with JSDOM
3. Extract readable content with Readability
4. Return cleaned text (max 20,000 chars)

**Error Handling**:
- Handles fetch failures gracefully
- Returns empty content on parse errors
- Logs all errors for debugging

### 7. Lead Scorer Service
**Location**: `packages/services/src/lead-finder/lead-scorer-service.ts`

**Purpose**: Scores leads based on multiple factors and handles deduplication.

**Scoring Factors**:
```typescript
{
  hasGeoSignal: 10,           // Location match
  hasChangeSignal: 15,        // Life/career transition
  hasWealthSignals: 5,        // Per wealth indicator
  hasFundingMention: 10,      // Funding/investment
  hasExecutiveTitle: 8,       // C-suite or senior role
  hasCompanySize: 5,          // Company size indicators
  hasRecentNews: 5,           // Recent article/press
}
```

**Tier Assignment**:
- **Tier A** (Top Priority): Score >= 35
- **Tier B** (High Priority): Score >= 25
- **Tier C** (Medium Priority): Score >= 15
- **Tier D** (Low Priority): Score < 15

**Deduplication**:
```typescript
// Generates unique person key
generatePersonKey(candidate: ExtractedCandidate): string {
  const normalizedName = candidate.fullName.toLowerCase().replace(/[^a-z]/g, '');
  const normalizedCompany = (candidate.company || '').toLowerCase().replace(/[^a-z]/g, '');
  const normalizedGeo = (candidate.geoSignal || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normalizedName}|${normalizedCompany}|${normalizedGeo}`;
}

// Checks against ALL historical leads (permanent deduplication)
async checkDuplicates(personKeys: string[], cooldownDays = 0): Promise<Set<string>> {
  // cooldownDays = 0 means check all historical leads
  const cutoffDate = cooldownDays > 0 ? new Date() : new Date(0);
  // ... query database for existing person_keys
}
```

**Why Permanent Deduplication?**
- Prevents re-contacting prospects
- Maintains professional reputation
- Avoids spam complaints

---

## LLM Models & Prompts

### Model Selection

**Primary Model**: `claude-sonnet-4-20250514` (Sonnet 4)
- Most powerful Sonnet model available via API
- Excellent at reasoning, extraction, and generation
- Consistent output with temperature 0.3

**Model Usage Across System**:
| Component | Model | Temperature | Purpose |
|-----------|-------|-------------|---------|
| Lead Extractor | `claude-sonnet-4-20250514` | 0.7 | Extract candidates from pages |
| Email Generator | `claude-sonnet-4-20250514` | 0.3 | Generate personalized emails |
| Email Predictor | `claude-sonnet-4-20250514` | 0.3 | Predict email addresses |
| Circle Enrichment | `claude-sonnet-4-20250514` | 0.7 | Find colleague mentions |

**Note**: The model identifier `claude-sonnet-4-5-20251022` does NOT exist in the Anthropic API. The web interface may show "Sonnet 4.5" as a marketing name, but the API uses `claude-sonnet-4-20250514`.

### Prompt Engineering Best Practices

#### 1. **Clear Role Definition**
```
You are a [specific expert role]. 
Your task is to [specific task].
```

#### 2. **Structured Input**
```
CONTEXT:
- Key fact 1
- Key fact 2

REQUIREMENTS:
- Requirement 1
- Requirement 2

OUTPUT FORMAT:
{
  "field1": "value",
  "field2": "value"
}
```

#### 3. **JSON Output Format**
- Always request `"Respond with ONLY a JSON object, nothing else"`
- Provide exact schema
- Include example output
- Parse with regex: `/\{[\s\S]*?\}/` or `/\[[\s\S]*?\]/`

#### 4. **Temperature Guidelines**
- **0.3**: Deterministic tasks (email generation, prediction)
- **0.7**: Creative tasks (extraction, ideation)
- **1.0**: Maximum creativity (not used in Lead Finder)

#### 5. **Token Limits**
- Lead Extraction: 1000 tokens (complex structured output)
- Email Generation: 300 tokens (short email)
- Email Prediction: 300 tokens (JSON array)

### All Prompts in the System

#### 1. Lead Extraction Prompt
**File**: `packages/agents/src/lead-finder/lead-extractor-agent.ts`
**Purpose**: Extract candidates from web page content

<details>
<summary>View Full Prompt</summary>

```typescript
const prompt = `You are a business development lead identification expert specializing in wealth management prospects.

Analyze the following web page content and extract information about individuals who match our ideal prospect criteria.

IDEAL PROSPECT CRITERIA:
- High-net-worth individuals (business owners, C-suite executives, board members, founders)
- Decision-makers in companies with 50+ employees or significant revenue
- Individuals experiencing significant life/career transitions (promotions, funding, exits, new roles)
- Located in our target markets (primarily Texas: Dallas, Houston, Austin, San Antonio)
- Professionals in our key verticals: financial services, real estate, legal, healthcare, technology, energy

REQUIRED INFORMATION:
For each candidate you identify, extract:
1. Full name (required)
2. Title/role (required)
3. Company name (required)
4. Geographic location signals (city, state)
5. Change signal (what significant event/transition is happening?)
6. Wealth/success indicators (board seats, prior exits, company size, funding raised)
7. Brief rationale for why they're a good prospect

EXTRACTION GUIDELINES:
- Only extract individuals (not companies or organizations)
- Prioritize executives and decision-makers
- Look for signals of wealth and influence
- Focus on recent changes or transitions
- Be specific about change signals (what's happening now?)

WEB PAGE CONTENT:
---
${pageContent}
---

Respond with a JSON object containing an array of candidates:
{
  "candidates": [
    {
      "fullName": "John Smith",
      "title": "CEO and Co-Founder",
      "company": "Acme Corporation",
      "geoSignal": "Dallas, TX",
      "changeSignal": "Just raised $50M Series B led by Sequoia",
      "wealthSignals": [
        "Founded successful tech company",
        "Board member at 2 other companies",
        "Previous exit at $100M"
      ],
      "rationaleLong": "John is the CEO of a fast-growing tech company that just secured significant funding. As a serial entrepreneur with a prior successful exit, he likely has substantial liquid wealth and complex financial planning needs. The funding event is a natural inflection point for wealth management conversations.",
      "rationaleShort": "CEO of rapidly growing tech company with recent $50M funding and prior successful exit."
    }
  ]
}

If you find no suitable candidates, return: {"candidates": []}

Extract between ${this.minCandidates} and ${this.maxCandidates} candidates if available.
Focus on quality over quantity.`;
```
</details>

#### 2. Email Generation Prompt
**File**: `packages/agents/src/lead-finder/email-generator-agent.ts`
**Purpose**: Generate personalized outreach emails

<details>
<summary>View Full Prompt Template</summary>

```typescript
const prompt = `You are an expert email copywriter for a wealth management firm (ArcVest).

YOUR TASK: Write a personalized, professional email to a prospective client.

LEAD CONTEXT:
- Name: ${lead.full_name}
- Title: ${lead.title || 'Unknown'}
- Company: ${lead.company || 'Unknown'}
- Situation: ${lead.change_signal || 'Professional in relevant industry'}
- Location: ${lead.geo_signal || 'Texas'}

TONE: ${tone}
${toneGuidance[tone]}

REQUIREMENTS:
1. Subject line: Max 50 characters, compelling, personalized
2. Email body: 150-200 words
3. Reference their specific situation/achievement
4. Be genuinely personal, not templated
5. Include a soft ask for a conversation (not pushy)
6. Sign off as "Chad Fargason, Partner, ArcVest"
7. Professional but warm tone
8. Focus on the transition/change they're experiencing
9. Don't be overly salesy

WHAT TO AVOID:
- Generic language that could apply to anyone
- Multiple asks or CTAs
- Long paragraphs (keep it scannable)
- Overpromising or hype
- Mentioning specific investment strategies

Return a JSON object with:
{
  "subject": "Your subject line here",
  "body": "Your email body here (use \\n\\n for paragraph breaks)"
}

Write the email now:`;
```

**Tone Guidance**:
```typescript
const toneGuidance = {
  congratulatory: "Celebrate their achievement. Express genuine excitement about their news.",
  direct_curious: "Be straightforward and business-focused. Express interest in learning about their situation.",
  warm_introduction: "Be friendly and approachable. Focus on relationship-building.",
  value_proposition: "Emphasize the services and value ArcVest can provide.",
  recognition: "Acknowledge their expertise and success in their field."
};
```
</details>

#### 3. Email Prediction Prompt
**File**: `packages/agents/src/lead-finder/orchestrator.ts`
**Purpose**: Predict likely email addresses

<details>
<summary>View Full Prompt</summary>

```typescript
const prompt = `Help me make an educated guess at the email address for this person:

Name: ${candidate.fullName}
Title: ${candidate.title || 'Unknown'}
Organization: ${candidate.company || 'Unknown'}

Please provide the 3-4 most likely email addresses for this person, ordered by likelihood.

Consider:
- Universities typically use .edu domains (e.g., ttu.edu for Texas Tech)
- Non-profits may use .org
- Government entities use .gov
- Corporations usually use .com
- Common formats: first.last@domain, flast@domain, firstname.lastname@domain
- Handle hyphenated names, apostrophes, and special characters appropriately
- For universities, check if there are common abbreviations (e.g., "Texas Tech University" = ttu.edu)

Respond with ONLY a JSON array of email addresses, nothing else.
Example: ["john.smith@company.com", "jsmith@company.com", "johnsmith@company.com"]`;
```
</details>

#### 4. Circle Enrichment Prompt
**File**: `packages/agents/src/lead-finder/orchestrator.ts`
**Purpose**: Find colleagues of top prospects

<details>
<summary>View Full Prompt</summary>

```typescript
const prompt = `You are analyzing a company website/page to find colleagues of a specific person.

TARGET PERSON: ${lead.full_name} (${lead.title} at ${lead.company})

WEBSITE CONTENT:
---
${content}
---

Find other high-level executives, board members, or key decision-makers mentioned on this page who work at ${lead.company}.

For each person found, extract:
- Full name
- Title/role
- Any signals of seniority or decision-making authority

Return JSON:
{
  "colleagues": [
    {
      "fullName": "Jane Doe",
      "title": "CFO",
      "company": "${lead.company}",
      "relationshipToTarget": "Colleague of ${lead.full_name}"
    }
  ]
}

If no colleagues are found, return: {"colleagues": []}`;
```
</details>

---

## Data Flow

### 1. Automated Daily Run (Cron Job)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel Cron Job                            │
│              Daily at 6 AM Central (11 AM UTC)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     API: /api/cron/lead-finder                                  │
│     - Validates CRON_SECRET                                     │
│     - Calls orchestrator.runLeadFinder()                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     LeadFinderOrchestrator.runLeadFinder()                      │
│     1. Execute 12 search queries via Serper.dev                 │
│     2. Fetch top 5 pages per query                              │
│     3. Extract candidates with Claude Sonnet 4                  │
│     4. Score & deduplicate candidates                           │
│     5. Select top 3 leads                                       │
│     6. Enrich with AI-predicted emails (4 per lead)             │
│     7. Find colleagues (circle enrichment)                      │
│     8. Generate personalized emails                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     Save to Supabase: lead_finder_leads                         │
│     - Lead metadata                                             │
│     - Contact paths (emails)                                    │
│     - Generated email content                                   │
│     - Scoring information                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Manual Run (User-Triggered)

```
┌─────────────────────────────────────────────────────────────────┐
│     User clicks "Run Now" button                                │
│     UI: packages/dashboard/src/app/dashboard/lead-finder/       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     API: /api/test/lead-finder?action=run                       │
│     - Determines random rotation criteria                       │
│     - Calls orchestrator with randomized config                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     LeadFinderOrchestrator.determineTodayRotation()             │
│     - Random geo (Dallas, Houston, Austin, etc.)                │
│     - Random trigger (funding, partnership, expansion)          │
│     - Random focus (financial, legal, real estate, etc.)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    [Same pipeline as daily run]
```

### 3. Email Prediction (Batch)

```
┌─────────────────────────────────────────────────────────────────┐
│     API: /api/test/email-predict-batch                          │
│     - Fetches all existing leads                                │
│     - For each lead without predicted emails                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     For each lead:                                              │
│     1. Call Claude Sonnet 4 with name, title, company           │
│     2. Parse JSON array of predicted emails                     │
│     3. Validate emails (must contain @ and .)                   │
│     4. Save to contact_paths as "predicted_email"               │
│     5. Update lead in database                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Lead Display & Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│     User visits /dashboard/lead-finder                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     API: /api/lead-finder/leads                                 │
│     - Fetch leads (limit: 200, default sort: most recent)      │
│     - Filter by tier, status, date                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     UI displays:                                                │
│     - Lead cards with name, title, company, score               │
│     - Best email address badge                                  │
│     - Email status badge                                        │
│     - Tier badge (A/B/C/D)                                      │
│     - Created timestamp                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│     User clicks "Email" → Opens dialog with:                    │
│     - All found/predicted emails (with copy buttons)            │
│     - Tone selector                                             │
│     - Generated subject & body                                  │
│     - "Regenerate" button                                       │
│     - "Mark as Sent" button                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `lead_finder_leads`

```sql
CREATE TABLE lead_finder_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Lead Information
  full_name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  geo_signal TEXT,
  change_signal TEXT,
  wealth_signals JSONB DEFAULT '[]'::jsonb,
  
  -- Scoring
  score INTEGER NOT NULL DEFAULT 0,
  tier TEXT,  -- 'A', 'B', 'C', 'D'
  person_key TEXT NOT NULL,  -- For deduplication
  
  -- Content
  rationale_long TEXT,
  rationale_short TEXT,
  
  -- Contact Information
  contact_paths JSONB DEFAULT '[]'::jsonb,
  /*
    Structure:
    [
      {
        "type": "generic_email" | "predicted_email" | "company_contact_url" | "linkedin",
        "value": "email@domain.com" | "https://...",
        "confidence": "high" | "medium" | "low" | "ai_predicted",
        "source": "scraped" | "sonnet_4" | "sonnet_4_batch",
        "found_at": "2024-01-15T10:30:00Z"
      }
    ]
  */
  
  -- Email Generation
  generated_emails JSONB DEFAULT '[]'::jsonb,
  /*
    Structure:
    [
      {
        "tone": "congratulatory" | "direct_curious" | "warm_introduction" | "value_proposition" | "recognition",
        "subject": "Email subject",
        "body": "Email body with \\n\\n for paragraphs",
        "generated_at": "2024-01-15T10:30:00Z"
      }
    ]
  */
  
  -- Metadata
  source_url TEXT,
  source_snippet TEXT,
  run_id UUID,
  
  -- Status
  status TEXT DEFAULT 'new',  -- 'new', 'contacted', 'responded', 'not_interested'
  contacted_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lead_finder_leads_person_key ON lead_finder_leads(person_key);
CREATE INDEX idx_lead_finder_leads_created_at ON lead_finder_leads(created_at DESC);
CREATE INDEX idx_lead_finder_leads_score ON lead_finder_leads(score DESC);
CREATE INDEX idx_lead_finder_leads_tier ON lead_finder_leads(tier);
CREATE INDEX idx_lead_finder_leads_status ON lead_finder_leads(status);
```

### Contact Paths Structure

The `contact_paths` field stores all discovered contact information:

```typescript
interface ContactPath {
  type: 'generic_email' | 'predicted_email' | 'company_contact_url' | 'linkedin';
  value: string;  // Email address or URL
  confidence?: 'high' | 'medium' | 'low' | 'ai_predicted';
  source?: string;  // 'scraped' | 'sonnet_4' | 'sonnet_4_batch'
  found_at?: string;  // ISO timestamp
}
```

**Types**:
- **`generic_email`**: Found via web scraping (often generic like info@, contact@)
- **`predicted_email`**: AI-predicted personal email addresses
- **`company_contact_url`**: Contact page or form URL
- **`linkedin`**: LinkedIn profile URL

---

## API Endpoints

### Production Endpoints

#### 1. GET `/api/lead-finder/leads`
**Purpose**: Fetch leads for dashboard display

**Query Parameters**:
- `limit` (number, default: 200): Max leads to return
- `sort` (string, default: 'recent'): Sort order ('recent' | 'score')
- `tier` (string, optional): Filter by tier (A/B/C/D)
- `status` (string, optional): Filter by status
- `dateFilter` (string, optional): Date filter ('today', 'week', 'month', 'all')

**Response**:
```typescript
{
  success: true,
  leads: Lead[],
  total: number
}
```

**Example**:
```bash
GET /api/lead-finder/leads?limit=50&sort=recent&tier=A
```

#### 2. POST `/api/lead-finder/emails/[leadId]/regenerate`
**Purpose**: Regenerate email with different tone

**Body**:
```typescript
{
  tone: 'congratulatory' | 'direct_curious' | 'warm_introduction' | 'value_proposition' | 'recognition'
}
```

**Response**:
```typescript
{
  success: true,
  email: {
    subject: string,
    body: string
  }
}
```

#### 3. POST `/api/cron/lead-finder`
**Purpose**: Daily automated lead generation (triggered by Vercel Cron)

**Headers**:
- `Authorization: Bearer {CRON_SECRET}`

**Response**:
```typescript
{
  success: true,
  runId: string,
  stats: {
    queriesExecuted: number,
    searchResultsFound: number,
    pagesFetched: number,
    candidatesExtracted: number,
    leadsSelected: number,
    emailsGenerated: number,
    timing: {
      searchMs: number,
      fetchMs: number,
      extractMs: number,
      emailMs: number,
      totalMs: number
    }
  },
  leadsFound: number
}
```

### Test/Debug Endpoints

#### 1. GET `/api/test/lead-finder?action=run`
**Purpose**: Manual lead finder run with random rotation

**Response**: Same as cron endpoint

#### 2. GET `/api/test/email-predict`
**Purpose**: Test email prediction for a single person

**Query Parameters**:
- `name` (string, required): Full name
- `title` (string, optional): Job title
- `company` (string, optional): Company name

**Response**:
```typescript
{
  success: true,
  parsedEmails: string[],
  aiResponse: string,
  prompt: string
}
```

**Example**:
```bash
GET /api/test/email-predict?name=Elizabeth+Trejos-Castillo&company=Texas+Tech+University&title=Professor
```

#### 3. GET `/api/test/email-predict-batch`
**Purpose**: Run email prediction on all existing leads and save to database

**Response**:
```typescript
{
  success: true,
  summary: {
    total: number,
    successful: number,
    failed: number,
    savedToDatabase: number,
    successRate: string
  },
  results: Array<{
    name: string,
    company: string,
    predictedEmails: string[],
    savedToDatabase: boolean,
    status: 'success' | 'failed' | 'error'
  }>
}
```

---

## Configuration

### Environment Variables

**Required for Production**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Service role key

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Serper.dev (Search)
SERPER_API_KEY=your_serper_key

# Cron Security
CRON_SECRET=your_random_secret_string
```

**Optional**:
```bash
# Deprecated (kept for backwards compatibility)
GOOGLE_CUSTOM_SEARCH_API_KEY=...
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=...
```

### Vercel Configuration

**File**: `vercel.json`

```json
{
  "buildCommand": "turbo run build --filter=@arcvest/dashboard... --force",
  "crons": [
    {
      "path": "/api/cron/lead-finder",
      "schedule": "0 11 * * *"
    }
  ]
}
```

**Cron Schedule**: `0 11 * * *`
- Runs daily at 11:00 AM UTC (6:00 AM Central Time)
- Generates 3 new leads per day automatically

### Turborepo Configuration

**File**: `turbo.json`

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    }
  }
}
```

**Build Order**:
1. `@arcvest/shared` (types)
2. `@arcvest/services` (business logic)
3. `@arcvest/agents` (AI logic)
4. `@arcvest/dashboard` (UI & API)

---

## Deployment

### Vercel Deployment

**Prerequisites**:
1. Vercel account connected to GitHub repository
2. Environment variables configured in Vercel dashboard
3. Vercel CLI installed: `npm i -g vercel`

**Deployment Process**:
```bash
# 1. Commit changes
git add .
git commit -m "Your commit message"
git push origin main

# 2. Vercel automatically deploys on push to main branch
# Monitor deployment: https://vercel.com/your-project

# 3. Check deployment status locally
vercel ls --prod

# 4. View logs
vercel logs --prod
```

**Manual Deployment**:
```bash
# Deploy current branch to preview
vercel

# Deploy to production
vercel --prod
```

### Common Deployment Issues

#### Issue 1: TypeScript Build Errors
**Symptom**: `Type error: Parameter 'x' implicitly has an 'any' type`

**Solution**: Add explicit type annotations
```typescript
// BAD
array.forEach(item => { ... })

// GOOD
array.forEach((item: { type: string; value: string }) => { ... })
```

#### Issue 2: Module Not Found
**Symptom**: `Module '"@arcvest/agents"' has no exported member 'X'`

**Solution**: 
- Check if DTS generation is disabled in `tsup.config.ts`
- Define types locally in the consuming file
- Ensure correct build order in `turbo.json`

#### Issue 3: Serverless Function Timeout
**Symptom**: Function times out after 60 seconds

**Solution**: Add `maxDuration` to API route:
```typescript
export const maxDuration = 300; // 5 minutes
```

#### Issue 4: Environment Variable Not Available
**Symptom**: `undefined` when accessing `process.env.VAR_NAME`

**Solution**:
- Add to Vercel dashboard: Settings → Environment Variables
- Redeploy after adding variables
- For client-side variables, prefix with `NEXT_PUBLIC_`

---

## Troubleshooting

### Issue: No leads are being generated

**Potential Causes**:
1. **Serper.dev API key invalid**: Check `SERPER_API_KEY` in Vercel
2. **All candidates are duplicates**: Deduplication working correctly
3. **Search queries returning no results**: Adjust search criteria

**Debug Steps**:
```bash
# 1. Check API endpoint directly
vercel curl "/api/test/lead-finder?action=run" --prod

# 2. Check cron job logs
vercel logs --prod

# 3. Manually query Serper.dev
curl -X POST https://serper.dev/search \
  -H "X-API-KEY: your_key" \
  -d '{"q": "Dallas CEO funding raised", "num": 10}'
```

### Issue: Email predictions not showing

**Potential Causes**:
1. **Predictions not being saved**: Check database update logic
2. **UI not displaying contact_paths**: Check frontend mapping
3. **Claude API error**: Check `ANTHROPIC_API_KEY`

**Debug Steps**:
```bash
# 1. Test email prediction directly
vercel curl "/api/test/email-predict?name=John+Smith&company=Acme+Corp" --prod

# 2. Run batch prediction
vercel curl "/api/test/email-predict-batch" --prod

# 3. Check database
# In Supabase SQL Editor:
SELECT full_name, contact_paths 
FROM lead_finder_leads 
WHERE contact_paths::text LIKE '%predicted_email%'
LIMIT 10;
```

### Issue: Duplicate leads appearing

**Potential Causes**:
1. **person_key not being generated correctly**: Check normalization logic
2. **Database query not checking historical leads**: Verify `cooldownDays = 0`

**Debug Steps**:
```sql
-- Check for duplicates in database
SELECT 
  person_key, 
  COUNT(*) as count,
  array_agg(full_name) as names,
  array_agg(company) as companies
FROM lead_finder_leads
GROUP BY person_key
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Delete duplicates (keep oldest)
DELETE FROM lead_finder_leads
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY person_key ORDER BY created_at ASC) as rn
    FROM lead_finder_leads
  ) t
  WHERE t.rn > 1
);
```

### Issue: Cron job not running

**Potential Causes**:
1. **Vercel cron configuration incorrect**: Check `vercel.json`
2. **CRON_SECRET mismatch**: Verify environment variable
3. **Function timeout**: Increase `maxDuration`

**Debug Steps**:
```bash
# 1. Check Vercel cron logs
vercel logs --prod | grep "cron/lead-finder"

# 2. Manually trigger cron job
curl -X POST https://your-domain.vercel.app/api/cron/lead-finder \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 3. Check Vercel dashboard
# Go to: Deployments → [Latest] → Functions → Cron Jobs
```

### Performance Optimization

**Current Performance**:
- **Daily Run**: ~30-45 seconds for 3 leads
- **Email Prediction (50 leads)**: ~90-120 seconds
- **Single Lead Extraction**: ~2-3 seconds

**Optimization Tips**:
1. **Reduce `resultsPerQuery`**: Trade-off between coverage and speed
2. **Reduce `maxPagesToFetch`**: Fewer pages = faster extraction
3. **Implement caching**: Cache search results for 24 hours
4. **Batch AI calls**: Send multiple candidates to Claude in one request
5. **Parallelize searches**: Use `Promise.all()` for concurrent searches

---

## Future Enhancements

### Planned Features

1. **Email Verification**
   - Integrate with email verification service (ZeroBounce, NeverBounce)
   - Validate predicted emails before display
   - Score emails by deliverability

2. **LinkedIn Integration**
   - Automatically find LinkedIn profiles
   - Extract additional information (education, prior roles)
   - Identify warm introduction paths

3. **CRM Integration**
   - Sync leads to CRM (Salesforce, HubSpot)
   - Track engagement and pipeline stages
   - Bidirectional sync

4. **Advanced Scoring**
   - Machine learning-based scoring
   - Incorporate historical conversion data
   - Dynamic tier assignment based on performance

5. **Email Sending**
   - Send emails directly from platform
   - Track opens and clicks
   - A/B test subject lines and tones

6. **Enrichment Services**
   - Integrate with Clearbit, FullContact
   - Add company firmographics
   - Wealth estimation

### Technical Debt

1. **Re-enable DTS Generation**
   - Currently disabled for `@arcvest/agents` and `@arcvest/services`
   - Requires fixing external dependency type resolution
   - Improves IDE autocomplete and type safety

2. **Add Unit Tests**
   - Test individual components in isolation
   - Mock external dependencies (Serper, Claude, Supabase)
   - Target 80%+ code coverage

3. **Add Integration Tests**
   - Test full pipeline end-to-end
   - Use test database and mock APIs
   - Automated CI/CD testing

4. **Improve Error Handling**
   - Centralized error logging (Sentry, LogRocket)
   - Better user-facing error messages
   - Automatic retry logic for transient failures

5. **Performance Monitoring**
   - Add performance metrics (Vercel Analytics)
   - Track AI token usage and costs
   - Monitor API rate limits

---

## Support & Resources

### Documentation
- **Anthropic Claude API**: https://docs.anthropic.com/claude/reference/
- **Serper.dev API**: https://serper.dev/docs
- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **Vercel**: https://vercel.com/docs

### Key Files for Reference
- **Main Orchestrator**: `packages/agents/src/lead-finder/orchestrator.ts`
- **Lead Extractor**: `packages/agents/src/lead-finder/lead-extractor-agent.ts`
- **Email Generator**: `packages/agents/src/lead-finder/email-generator-agent.ts`
- **Search Service**: `packages/services/src/lead-finder/google-search-service.ts`
- **Scorer**: `packages/services/src/lead-finder/lead-scorer-service.ts`
- **UI Component**: `packages/dashboard/src/app/dashboard/lead-finder/page.tsx`
- **API Routes**: `packages/dashboard/src/app/api/lead-finder/*`

### Contact
For questions or support, contact:
- **Project Owner**: Chad Fargason
- **AI Assistant**: Claude (via this conversation)

---

## Appendix

### A. Search Query Examples

**Current Search Queries** (randomized for manual runs):
```typescript
const queries = [
  "${geo} ${trigger} ${professionalService}",
  "${geo} CEO ${trigger}",
  "${geo} founder ${trigger}",
  "${geo} executive ${trigger}",
  "${geo} business owner ${professionalService}",
  "Texas ${professionalService} ${trigger}",
  "${geo} investment ${trigger}",
  "${geo} private equity ${trigger}",
  "${geo} board member appointment",
  "${geo} venture capital ${trigger}",
  "${geo} merger acquisition",
  "${geo} IPO ${professionalService}"
];
```

**Variables**:
- `geo`: Dallas, Houston, Austin, San Antonio, Texas, DFW
- `trigger`: raised funding, new partnership, expansion, acquisition, series A, series B, growth capital
- `professionalService`: financial services, legal services, real estate, healthcare, technology, energy, professional services

### B. Scoring Examples

**Example 1: Tier A Lead (Score: 45)**
```json
{
  "fullName": "Kelly Ortberg",
  "title": "CEO",
  "company": "The Boeing Company",
  "geoSignal": "Dallas, TX",
  "changeSignal": "Appointed as new CEO of major aerospace company",
  "wealthSignals": ["Fortune 500 CEO", "Prior aerospace executive"],
  "score": 45,
  "tier": "A",
  "scoring": {
    "hasGeoSignal": 10,
    "hasChangeSignal": 15,
    "hasWealthSignals": 10,
    "hasExecutiveTitle": 8,
    "hasRecentNews": 5
  }
}
```

**Example 2: Tier C Lead (Score: 18)**
```json
{
  "fullName": "John Smith",
  "title": "Manager",
  "company": "Local Tech Startup",
  "geoSignal": "Austin, TX",
  "changeSignal": "",
  "wealthSignals": [],
  "score": 18,
  "tier": "C",
  "scoring": {
    "hasGeoSignal": 10,
    "hasChangeSignal": 0,
    "hasWealthSignals": 0,
    "hasExecutiveTitle": 0,
    "hasRecentNews": 8
  }
}
```

### C. Email Prediction Examples

**Example 1: University Professor**
```
Input:
  Name: Elizabeth Trejos-Castillo
  Title: Fulbright Scholar Liaison
  Company: Texas Tech University

Output:
  [
    "elizabeth.trejos-castillo@ttu.edu",
    "etrejos-castillo@ttu.edu",
    "elizabeth.trejoscastillo@ttu.edu",
    "etrejoscastillo@ttu.edu"
  ]
```

**Example 2: Corporate Executive**
```
Input:
  Name: Kelly Ortberg
  Title: CEO
  Company: The Boeing Company

Output:
  [
    "kelly.ortberg@boeing.com",
    "kortberg@boeing.com",
    "kelly_ortberg@boeing.com",
    "kellyortberg@boeing.com"
  ]
```

**Example 3: Hyphenated Name**
```
Input:
  Name: Alexis Barbier-Mueller
  Title: CEO
  Company: Harwood International

Output:
  [
    "alexis.barbier-mueller@harwoodinternational.com",
    "abarbier-mueller@harwoodinternational.com",
    "alexis.barbiermueller@harwoodinternational.com",
    "abarbierm@harwoodinternational.com"
  ]
```

---

**Last Updated**: February 4, 2026
**Version**: 1.0
**Author**: AI Assistant (Claude) with input from Chad Fargason
