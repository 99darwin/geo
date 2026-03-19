# SPEC.md — GEO Service Platform Technical Specification

## System Overview

A Next.js application that helps local businesses become visible to AI search engines. The platform scans websites, generates AI-optimized files (llms.txt, JSON-LD schema), monitors AI citation performance across platforms, and surfaces results through a client dashboard and monthly reports.

Three user types: **anonymous** (free scan), **client** (authenticated, paid), **admin** (internal team).

---

## Stack

| Layer | Choice | Justification |
|-------|--------|---------------|
| Framework | Next.js 14+ (App Router) | Full-stack, API routes, server actions, Vercel-native |
| UI | React + Tailwind CSS | Rapid iteration, utility-first |
| Database | Supabase (Postgres + Auth + Storage) | Managed Postgres, built-in auth, row-level security |
| Payments | Stripe (Checkout + Subscriptions) | $299 one-time + $49/mo recurring |
| Email | React Email + Resend | Templated transactional emails, monthly reports |
| Cron | Vercel Cron | Trigger monthly monitoring runs |
| AI APIs | OpenAI, Perplexity, Google Gemini | Citation checking across platforms |
| Site Crawling | Firecrawl | Business info extraction, llms.txt seed data |
| Query Generation | Claude API (Anthropic) | Generate tracked queries from business category + city |

---

## Data Model

### clients

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  website_url text not null,
  city text not null,
  state text,
  phone text,
  address text,
  category text,
  services text[] default '{}',
  hours text,
  google_business_url text,
  onboarding_status text not null default 'scan_complete'
    check (onboarding_status in ('scan_complete', 'setup_pending', 'setup_complete', 'active')),
  plan text not null default 'free_scan'
    check (plan in ('free_scan', 'starter', 'growth')),
  stripe_customer_id text,
  stripe_subscription_id text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### queries

```sql
create table queries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  query_text text not null,
  is_auto_generated boolean default true,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### citations

```sql
create type ai_platform as enum ('chatgpt', 'perplexity', 'google_ai', 'gemini', 'copilot');
create type sentiment_type as enum ('positive', 'neutral', 'negative');

create table citations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  query_id uuid references queries(id) on delete cascade,
  platform ai_platform not null,
  cited boolean not null default false,
  position int,
  sentiment sentiment_type,
  raw_response text,
  sources_cited jsonb default '[]',
  checked_at timestamptz not null default now(),
  created_at timestamptz default now()
);
```

### visibility_scores

```sql
create table visibility_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  query_coverage int not null,
  platform_coverage int not null,
  period date not null,
  breakdown jsonb default '{}',
  created_at timestamptz default now(),
  unique (client_id, period)
);
```

### competitors

```sql
create table competitors (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  competitor_name text not null,
  competitor_url text,
  is_auto_detected boolean default false,
  created_at timestamptz default now()
);
```

### competitor_citations

```sql
create table competitor_citations (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  query_id uuid references queries(id) on delete cascade,
  platform ai_platform not null,
  cited boolean not null default false,
  position int,
  raw_response text,
  checked_at timestamptz not null default now(),
  created_at timestamptz default now()
);
```

### nap_audits

```sql
create type directory_platform as enum ('google', 'yelp', 'foursquare', 'bing', 'apple_maps', 'facebook');

create table nap_audits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  platform directory_platform not null,
  name_match boolean,
  address_match boolean,
  phone_match boolean,
  listing_url text,
  issues text[] default '{}',
  checked_at timestamptz not null default now(),
  created_at timestamptz default now()
);
```

### review_snapshots

```sql
create table review_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  platform directory_platform not null,
  rating decimal(2,1),
  review_count int,
  checked_at timestamptz not null default now(),
  created_at timestamptz default now()
);
```

### generated_files

```sql
create table generated_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  file_type text not null check (file_type in ('llms_txt', 'schema_json')),
  content text not null,
  version int not null default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### industry_sources

```sql
create table industry_sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  domain text not null,
  url text,
  citation_count int not null default 0,
  platforms_citing ai_platform[] default '{}',
  period date not null,
  created_at timestamptz default now()
);
```

### admin_notes

```sql
create table admin_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  author text not null,
  content text not null,
  created_at timestamptz default now()
);
```

### RLS Policies

- Clients can only read their own data (`user_id = auth.uid()`)
- Admin role bypasses RLS (service role key for API routes)
- Public endpoints (scan, llms.txt, schema.js) use no auth
- Generated files are publicly readable by design (served to AI crawlers)

---

## Routes & API

### Public Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with free scan input |
| `/scan?url={url}` | Scan results page (ephemeral, no DB write unless email captured) |
| `/api/geo/llms/[clientId]/llms.txt` | Hosted llms.txt (text/plain) |
| `/api/geo/schema/[clientId].js` | Embeddable schema injection script (application/javascript) |

### Auth Pages

| Route | Purpose |
|-------|---------|
| `/login` | Supabase auth (email/password) |
| `/onboarding` | 3-step wizard → Stripe Checkout |
| `/dashboard` | Client dashboard (hero score, queries, platforms, sources, competitors, reviews, NAP, setup status) |
| `/dashboard/history` | Historical score trends |

### Admin Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Client list with filters, aggregate stats |
| `/admin/clients/[id]` | Per-client detail view with manual triggers |

### API Routes

```
POST   /api/scan                          # Free scan (no auth, rate-limited)
POST   /api/webhooks/stripe               # Stripe webhook handler

GET    /api/dashboard                      # Client dashboard data
GET    /api/dashboard/history              # Score history

GET    /api/admin/clients                  # All clients
GET    /api/admin/clients/[id]             # Single client detail
POST   /api/admin/clients/[id]/recheck    # Trigger full citation check
POST   /api/admin/clients/[id]/regenerate # Re-crawl + regenerate files
GET    /api/admin/export                   # CSV export

POST   /api/cron/monthly-check            # Cron-triggered monthly monitoring
POST   /api/cron/monthly-report           # Cron-triggered report emails

GET    /api/geo/llms/[clientId]/llms.txt   # Public llms.txt
GET    /api/geo/schema/[clientId].js       # Public schema script
```

---

## Core Engines

### 1. Site Crawler

**Input:** URL
**Output:** Business name, category, city, services, page list, raw content

```
Firecrawl endpoint: https://llmstxt.firecrawl.dev/{URL}
Fallback: direct fetch + cheerio parsing for meta tags, headings, structured data
```

Used during free scan (lightweight) and full setup (comprehensive crawl).

### 2. Query Generator

**Input:** Business category, city, services array
**Output:** Array of 10-15 search queries

```
Claude API call with prompt:
"Generate 10-15 queries that a real person would ask an AI assistant 
when looking for a {category} in {city}. Include:
- Direct queries: 'best {category} in {city}'
- Problem queries: 'emergency {service} near me {city}'  
- Comparison queries: '{category} vs {competitor_category} {city}'
- Specific service queries: '{specific_service} {city} {state}'
Return as JSON array of strings. No numbering, no explanation."
```

Free scan uses 3-5 queries. Full setup uses 10-15.

### 3. Citation Checker

**Input:** Query string, platform, business name (+ variations)
**Output:** `{ cited: bool, position: int|null, sentiment: string|null, raw_response: string, sources_cited: string[] }`

Per-platform implementation:

**ChatGPT (OpenAI API):**
```
Model: gpt-4o-mini with web browsing enabled (responses API or chat completions with tools)
System prompt: "You are answering a local business query. Provide specific 
business recommendations with names, brief descriptions, and ratings if known."
Parse response for business name matches (fuzzy: handle abbreviations, 
possessives, missing "The", etc.)
```

**Perplexity:**
```
Model: sonar or sonar-pro
Advantage: Returns explicit source citations in response metadata
Parse both answer text for business mentions AND citations array for source URLs
```

**Gemini (Google):**
```
Model: gemini-2.0-flash or gemini-pro
Standard chat completion, parse response text
```

**Google AI Overviews:**
```
Option A: SerpAPI with google AI overview result type ($50-100/mo)
Option B: Defer to post-MVP
```

**Copilot:**
```
Defer to post-MVP. 4 platforms is sufficient for launch.
```

**Name matching logic:**
```typescript
function isBusinessMentioned(response: string, businessName: string): { cited: boolean, position: number | null } {
  const normalizedResponse = response.toLowerCase();
  const variations = generateVariations(businessName); // "Bob's Dental" → ["bob's dental", "bobs dental", "bob's", "bob dental"]
  
  for (const variant of variations) {
    const index = normalizedResponse.indexOf(variant.toLowerCase());
    if (index !== -1) {
      // Determine position by counting business-like mentions before this one
      const beforeText = normalizedResponse.slice(0, index);
      const position = (beforeText.match(/\d+\.\s/g) || []).length + 1;
      return { cited: true, position: Math.min(position, 10) };
    }
  }
  return { cited: false, position: null };
}
```

**Reliability:** Run each (query, platform) pair 3x. Take majority result for `cited`. Store all raw responses.

### 4. Source Extractor

**Input:** Raw AI response text, platform
**Output:** Array of `{ domain: string, url: string | null }`

```
Perplexity: Parse citations array from API response metadata (structured, reliable)
ChatGPT: Regex for URLs in response text + parse markdown links
Gemini: Regex for URLs in response text
All: Normalize domains (strip www, trailing slashes), deduplicate
```

Aggregated per client across all queries/platforms to produce the "Sources AI Trusts" ranking.

### 5. Scoring Algorithm

```typescript
function calculateVisibilityScore(client: Client): number {
  const queryCoverage = citedQueries / totalQueries;             // 0-1
  const platformCoverage = platformsCiting / totalPlatforms;     // 0-1
  const positionQuality = avgPositionScore(citations);           // 0-1 (1st=1.0, 2nd=0.7, 3rd=0.5, 4th+=0.3)
  const setupComplete = (hasLlmsTxt + hasSchema + hasCleanRobotsTxt) / 3; // 0-1

  const score = Math.round(
    (queryCoverage * 40) +
    (platformCoverage * 30) +
    (positionQuality * 20) +
    (setupComplete * 10)
  );

  return Math.max(0, Math.min(100, score));
}
```

### 6. File Generators

**llms.txt:**
```typescript
function generateLlmsTxt(client: Client, crawlData: CrawlResult): string {
  return `# ${client.business_name}

> ${crawlData.description || client.category + ' in ' + client.city}

## About
${crawlData.about || generateAbout(client)}

## Services
${client.services.map(s => `- ${s}`).join('\n')}

## Contact
- Phone: ${client.phone}
- Address: ${client.address}, ${client.city}, ${client.state}
- Website: ${client.website_url}
${client.hours ? `- Hours: ${client.hours}` : ''}

## Links
${crawlData.keyPages.map(p => `- ${p.title}: ${p.url}`).join('\n')}
`;
}
```

**Schema (JSON-LD) embeddable script:**
```typescript
function generateSchemaScript(client: Client): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: client.business_name,
    address: {
      "@type": "PostalAddress",
      streetAddress: client.address,
      addressLocality: client.city,
      addressRegion: client.state,
    },
    telephone: client.phone,
    url: client.website_url,
  };
  // Add optional fields if present
  if (client.hours) schema.openingHours = client.hours;
  if (client.google_business_url) schema.sameAs = [client.google_business_url];

  return `(function(){var s=document.createElement('script');s.type='application/ld+json';s.text=${JSON.stringify(JSON.stringify(schema))};document.head.appendChild(s);})();`;
}
```

### 7. robots.txt Auditor

```typescript
const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot'];

async function auditRobotsTxt(url: string): Promise<RobotsTxtAudit> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  const response = await fetch(robotsUrl);
  if (!response.ok) return { accessible: true, blocked: [], status: 'no_robots_txt' };
  
  const text = await response.text();
  const blocked = AI_BOTS.filter(bot => isBlocked(text, bot));
  
  return {
    accessible: blocked.length === 0,
    blocked,
    total: AI_BOTS.length,
    status: blocked.length === 0 ? 'clean' : 'blocked',
  };
}
```

### 8. NAP Checker

For each directory platform, search for the business and compare name/address/phone against the client's onboarding data.

```
Google: SerpAPI local results or Places API
Yelp: Yelp Fusion API (free tier: 5000 calls/day)
Foursquare: Places API (free tier: 100K calls/mo)
Bing: Bing Places API
Apple Maps: MapKit JS
Facebook: Graph API (pages search)
```

Fuzzy matching for address normalization (abbreviations, suite numbers, etc.).

### 9. Review Puller

```
Google: SerpAPI or Outscraper
Yelp: Yelp Fusion API (business endpoint includes rating + review_count)
Facebook: Graph API (page ratings)
```

Store rating (decimal) and review_count (int) per platform per check.

---

## Pipelines

### Free Scan Pipeline

Triggered by `POST /api/scan` with `{ url: string }`.

```
1. Firecrawl: crawl URL → extract business name, category, city
2. Claude API: generate 3-5 queries from category + city
3. Citation check: run queries against ChatGPT + Perplexity (2 platforms only)
4. Extract sources from responses
5. Score: compute visibility score
6. Return: { score, platforms, queries, competitor (first non-client business found), top_sources }
```

No database writes. Ephemeral. Rate-limited to 5/hour per IP.
Timeout budget: 30 seconds total. Use Promise.allSettled for parallel citation checks.

### Setup Pipeline

Triggered by Stripe webhook on successful checkout.

```
1. Create client record in DB
2. Firecrawl: full site crawl
3. Generate llms.txt → store in generated_files
4. Generate schema JSON-LD → store in generated_files
5. Audit robots.txt → store result
6. Claude API: generate 10-15 queries → store in queries table
7. Citation check: all queries × all platforms (parallel, batched)
8. Extract sources → store in industry_sources
9. NAP check: all 6 directories → store in nap_audits
10. Review pull: Google, Yelp, Facebook → store in review_snapshots
11. Auto-detect competitors from citation responses → store in competitors
12. Competitor citation check → store in competitor_citations
13. Compute visibility score → store in visibility_scores
14. Update client onboarding_status → 'setup_complete'
15. Send setup complete email via Resend
```

Run as background job (Vercel function with 5-min timeout, or queue if needed).

### Monthly Monitoring Pipeline

Triggered by Vercel cron (`POST /api/cron/monthly-check`), secured by `CRON_SECRET`.

```
For each active client:
  1. Re-crawl site (detect changes)
  2. If changes detected: regenerate llms.txt + schema, increment version
  3. Citation check: all queries × all platforms
  4. Extract/update industry sources
  5. NAP re-check
  6. Review snapshot pull
  7. Competitor citation check
  8. Compute new visibility score
  9. Detect: new citations, lost citations, score delta
  10. Store all results
```

Batch clients to stay within Vercel function timeout. Process N clients per invocation, use cursor-based pagination.

### Monthly Report Pipeline

Triggered by Vercel cron (`POST /api/cron/monthly-report`), runs after monitoring completes.

```
For each active client:
  1. Load current + previous visibility scores
  2. Diff citations (new appearances, disappearances)
  3. Compile "what we did" log (file updates, fixes)
  4. Generate report data
  5. Render React Email template
  6. Send via Resend
```

---

## Stripe Integration

### Products

| Product | Type | Price |
|---------|------|-------|
| GEO Setup (Starter) | One-time | $299 |
| GEO Monthly (Starter) | Recurring (monthly) | $49 |

Use Stripe Checkout in `subscription` mode with a one-time line item for setup fee + recurring line item for monthly.

### Webhook Events

```
checkout.session.completed → Create client, trigger setup pipeline
customer.subscription.updated → Update client plan status
customer.subscription.deleted → Mark client as churned, stop monitoring
invoice.payment_failed → Flag for follow-up
```

Webhook handler at `/api/webhooks/stripe`, verify signature with `STRIPE_WEBHOOK_SECRET`.

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_STARTER_SETUP_PRICE_ID=
STRIPE_STARTER_MONTHLY_PRICE_ID=

# AI APIs
OPENAI_API_KEY=
PERPLEXITY_API_KEY=
GOOGLE_GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Firecrawl
FIRECRAWL_API_KEY=

# Email
RESEND_API_KEY=

# Cron
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Rate Limits & Costs

### Free Scan
- 5 scans/hour per IP (middleware-level, use Vercel KV or in-memory if low traffic)
- Cost per scan: ~$0.05-0.15 (Firecrawl + 2 AI API calls + Claude query gen)

### Per-Client Monthly Monitoring
- 15 queries × 4 platforms × 3 runs each = 180 API calls
- ~$2-5/client/month all-in (AI APIs + Firecrawl re-crawl)

### Vercel Limits
- Function timeout: 60s (hobby) / 300s (pro). Pro plan likely needed for setup pipeline.
- Cron: 1/day on hobby, up to every minute on pro.
- Target: Vercel Pro ($20/mo) once in production.
