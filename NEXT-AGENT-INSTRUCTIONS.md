# Next Agent Instructions: Complete the GEO Service Pipeline

## Context

The GEO platform helps local businesses become visible to AI search engines. The purchase flow is complete: users scan their site for free, subscribe via Stripe ($299 setup + $49/mo), and the setup pipeline crawls their site, generates AI-optimized files, checks citations across ChatGPT/Perplexity/Gemini, and produces a visibility score shown on the dashboard.

**What's missing:** The ongoing service loop. After setup, subscribers get a static dashboard that never updates. There are no monthly re-checks, no email reports, no actionable recommendations, and several engines are stubbed out. This document describes everything needed to deliver the full service.

---

## Priority 1: Monthly Monitoring Pipeline

**Goal:** Re-check every subscriber monthly — re-crawl, refresh citations, compute new score, detect changes.

### Create `src/lib/pipelines/monthly-check.ts`

Steps:
1. Load client from DB (must be `plan: "starter"` and `onboardingStatus: "setup_complete"` or `"active"`)
2. Re-crawl site via `crawlSite()` — compare with stored data, update client if changed
3. Regenerate llms.txt + JSON-LD if crawl data changed — increment `version`, set new as `isActive: true`, old as `isActive: false`
4. Re-audit robots.txt
5. Re-run citation checks: all existing queries × all 3 platforms × 3 runs each
6. Store new citations in DB (don't delete old ones — they're historical)
7. Extract and store industry sources for the new period
8. Compute new visibility score for the current month's period (upsert on `clientId_period`)
9. Detect deltas: compare this month's score to last month's. Flag queries where `cited` status changed
10. Set `onboardingStatus: "active"` if still `"setup_complete"`

**Batching:** Process N clients per invocation (start with 5). Use cursor-based pagination — read the last processed `clientId` from a DB table or env var, and process the next N. This keeps each cron invocation under Vercel's function timeout.

**Existing engines to reuse:** `crawlSite`, `generateLlmsTxt`, `generateSchemaScript`, `auditRobotsTxt`, `generateQueries` (only if services changed), `checkCitations`, `extractSources`, `calculateVisibilityScore`

### Create `src/app/api/cron/monthly-check/route.ts`

- `POST` handler
- Validate `Authorization: Bearer ${CRON_SECRET}` (same pattern as setup endpoint — timing-safe comparison)
- Call monthly-check pipeline with batching
- Return `{ data: { processed: number, nextCursor: string | null } }`
- Add to Vercel cron in `vercel.json`: schedule monthly (1st of month)

---

## Priority 2: Monthly Report Pipeline

**Goal:** Email each subscriber a monthly visibility report with score changes, new/lost citations, and recommendations.

### Create `src/lib/pipelines/monthly-report.ts`

Steps:
1. Load client + user email
2. Load current and previous `VisibilityScore` records
3. Diff citations: identify newly cited queries, lost citations, position changes
4. Compile "what changed" summary
5. Generate recommendations based on current state (see Priority 4)
6. Render email via React Email template
7. Send via Resend API
8. Log that report was sent (consider a `ReportLog` table or just console.log for MVP)

### Create email template: `src/emails/monthly-report.tsx`

Use React Email (`@react-email/components` is already in `package.json`). Include:
- Visibility score with delta (↑/↓/→)
- Top 3 cited queries with platforms
- Top 3 uncited queries (opportunity)
- Generated file status
- CTA: "View Full Dashboard"

### Create `src/app/api/cron/monthly-report/route.ts`

- Same auth pattern as monthly-check
- Runs after monthly-check completes (schedule for 2nd of month, or chain from check)
- Batch process with cursor

### Wire up Resend

- `RESEND_API_KEY` env var (already in the spec)
- Create `src/lib/email.ts` — thin wrapper around Resend SDK
- From address: `reports@yourdomain.com` (configure in Resend dashboard)

---

## Priority 3: Skipped Setup Engines

These were deferred as "MVP skip" in `src/lib/pipelines/setup.ts:274`. They should be implemented and wired into both the setup and monthly-check pipelines.

### NAP Audit Engine — `src/lib/engines/nap-checker.ts`

**Purpose:** Check if the business's Name, Address, Phone are consistent across major directories.

**Interface:**
```typescript
interface NapCheckResult {
  platform: DirectoryPlatform; // "google" | "yelp" | "foursquare" | "bing" | "apple_maps" | "facebook"
  found: boolean;
  nameMatch: boolean;
  addressMatch: boolean;
  phoneMatch: boolean;
  listingUrl?: string;
}

function checkNap(params: {
  businessName: string;
  address?: string;
  phone?: string;
  city: string;
  state?: string;
}): Promise<NapCheckResult[]>
```

**Implementation notes:**
- Use SerpAPI for Google Business lookup, or scrape Google Maps
- Yelp Fusion API for Yelp listings
- Consider starting with Google + Yelp only for MVP
- Use the name-matcher engine (`src/lib/engines/name-matcher.ts`) for fuzzy matching
- 5-second timeout per directory (spec requirement)
- Store results in `NapAudit` table (schema already exists in Prisma)

### Review Snapshot Engine — `src/lib/engines/review-puller.ts`

**Purpose:** Pull current rating and review count from Google and Yelp.

**Interface:**
```typescript
interface ReviewSnapshot {
  platform: string;
  rating: number | null;
  reviewCount: number;
  url?: string;
}

function pullReviews(params: {
  businessName: string;
  city: string;
  state?: string;
}): Promise<ReviewSnapshot[]>
```

**Implementation notes:**
- Google Places API or SerpAPI for Google reviews
- Yelp Fusion API for Yelp reviews
- Store in `ReviewSnapshot` table (schema exists)
- Track trends over time (compare month-over-month)

### Competitor Detection — `src/lib/engines/competitor-detector.ts`

**Purpose:** Identify competitors from AI citation responses and track their visibility.

**Interface:**
```typescript
interface DetectedCompetitor {
  name: string;
  domain?: string;
  citedInQueries: string[];
  platforms: AiPlatform[];
}

function detectCompetitors(params: {
  businessName: string;
  citationResponses: Map<string, Map<AiPlatform, CitationResult>>;
}): DetectedCompetitor[]
```

**Implementation notes:**
- Parse raw AI responses for other business names mentioned alongside or instead of the client
- Use name-matcher to avoid detecting the client's own business as a competitor
- Store top 3-5 competitors in `Competitor` table (schema exists)
- In monthly-check, run citation checks for competitor names too and store in `CompetitorCitation`

---

## Priority 4: Actionable Recommendations

**Goal:** Tell subscribers what to do to improve their score.

### Create `src/lib/engines/recommendations.ts`

Generate recommendations based on:
- **Robots.txt blocks:** "Your robots.txt is blocking [GPTBot/ClaudeBot]. Unblock them to be indexed by AI."
- **Missing llms.txt:** "Add llms.txt to your website root." (with copy-paste instructions)
- **Missing JSON-LD:** "Add structured data to your homepage." (with embed code)
- **Low citation rate:** "You're cited in X/12 queries. Consider adding more content about [uncited services]."
- **Platform gaps:** "You appear on ChatGPT but not Perplexity. Ensure your content is accessible to all AI crawlers."
- **NAP inconsistency:** "Your phone number on Yelp doesn't match your website. Update it to [correct number]."
- **Low reviews:** "You have X reviews on Google. Businesses with 50+ reviews are cited more often."

**Interface:**
```typescript
interface Recommendation {
  type: "critical" | "important" | "suggestion";
  title: string;
  description: string;
  actionUrl?: string; // link to fix it
}

function generateRecommendations(params: {
  robotsAudit: RobotsTxtAudit;
  hasLlmsTxt: boolean;
  hasSchema: boolean;
  citedQueryCount: number;
  totalQueryCount: number;
  platformsCiting: AiPlatform[];
  napResults?: NapCheckResult[];
  reviewSnapshots?: ReviewSnapshot[];
}): Recommendation[]
```

### Wire into dashboard

Add a `recommendations` field to the `/api/dashboard` response. Show on the dashboard as an ordered action list with severity badges.

---

## Priority 5: Dashboard Enhancements

### File Implementation Instructions

The dashboard shows generated file status (llms.txt ✅, JSON-LD ✅) but doesn't tell the user how to add them to their site. Add a section or modal with:

1. **llms.txt:** "Add this file to your website root at `yourdomain.com/llms.txt`" + download button + copy button
2. **JSON-LD:** "Add this script tag to your homepage `<head>`" + copy-to-clipboard code snippet
3. Link to the public serving URLs: `/api/geo/llms/{clientId}/llms.txt` and `/api/geo/schema/{clientId}`

### Score History Chart

The `/api/dashboard/history` endpoint exists but the dashboard doesn't visualize score trends. Add a simple line chart showing visibility score over time (monthly data points from `VisibilityScore` table).

### Competitor Section

Once competitor detection is implemented, add a dashboard section showing:
- Top competitors detected
- Their citation rate vs yours
- Which queries they appear in that you don't

---

## Priority 6: Admin Manual Triggers

### Create `src/app/api/admin/clients/[id]/recheck/route.ts`

- Admin-only endpoint
- Triggers the monthly-check pipeline for a single client
- Useful for testing and manual intervention

### Create `src/app/api/admin/clients/[id]/regenerate/route.ts`

- Admin-only endpoint
- Regenerates llms.txt + JSON-LD for a single client
- Useful after manual data corrections

### Create `GET /api/admin/export` route

- Export all client data as CSV
- Admin-only

---

## Security Requirements

The following were identified in a deep security audit. Address these during implementation:

### Must Do

1. **Distributed rate limiter:** Replace in-memory `Map` rate limiter (`src/lib/rate-limit.ts`) with Upstash Redis or Vercel KV. The current implementation provides **zero protection** in serverless — each instance gets its own Map. This affects login (`src/middleware.ts`), registration (`src/app/api/auth/register/route.ts`), and checkout (`src/app/api/checkout/route.ts`). All have `TODO` comments marking this.

2. **Create `.env.example`:** Document all required environment variables with placeholder values. The tooling blocked writing `.env*` files directly — create manually:
   ```
   DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, STRIPE_SECRET_KEY,
   STRIPE_WEBHOOK_SECRET, STRIPE_STARTER_SETUP_PRICE_ID,
   STRIPE_STARTER_MONTHLY_PRICE_ID, SETUP_PIPELINE_SECRET, CRON_SECRET,
   OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY,
   GOOGLE_GEMINI_API_KEY, FIRECRAWL_API_KEY, RESEND_API_KEY
   ```

3. **SSRF validation in setup pipeline:** The free-scan endpoint validates URLs via `isBlockedUrl()`, but the setup pipeline's `crawlSite()` call does not. Add SSRF validation at the entry of `runSetupPipeline` or in `crawlSite` itself.

### Should Do

4. **Nonce-based CSP:** Current CSP uses `unsafe-eval` for scripts (required by Next.js). When possible, migrate to nonce-based CSP to eliminate eval.

5. **Password change session invalidation:** When a user changes password (`src/app/api/dashboard/settings/route.ts`), existing JWT sessions remain valid for up to 1 hour. Consider adding `passwordChangedAt` to the User model and checking it in the JWT callback.

6. **CORS on public geo endpoints:** `/api/geo/*` endpoints may need explicit CORS headers if businesses embed the files via JavaScript. Currently relies on browser defaults (same-origin only).

---

## Existing Architecture to Follow

### Three-Layer Pattern
- **Routes** (`src/app/api/`): Thin — validate input, call pipeline, return result
- **Pipelines** (`src/lib/pipelines/`): Orchestrate engines, handle DB reads/writes
- **Engines** (`src/lib/engines/`): Pure functions — input in, output out, no DB access

### Conventions
- All API responses: `{ data: T }` on success, `{ error: string }` on failure
- Cron routes validate `CRON_SECRET` from Authorization header (timing-safe comparison)
- Timeouts: 10s AI APIs, 15s crawling, 5s directory lookups — use `AbortController`
- AI responses are non-deterministic: run each (query, platform) 3x, take majority for `cited`
- Platform checkers implement `PlatformChecker` interface in `src/lib/engines/platforms/types.ts`

### Key Files Reference
| File | Purpose |
|------|---------|
| `SPEC.md` | Full technical specification |
| `CLAUDE.md` | Agent coding conventions |
| `prisma/schema.prisma` | Data model (tables for NAP, reviews, competitors already exist) |
| `src/lib/pipelines/setup.ts` | Reference pipeline implementation |
| `src/lib/pipelines/free-scan.ts` | Reference for timeout-budgeted pipeline |
| `src/lib/engines/platforms/types.ts` | PlatformChecker interface |
| `src/types/platforms.ts` | AiPlatform and DirectoryPlatform types |
| `src/types/index.ts` | Core type definitions |

---

## Verification Checklist

- [ ] Monthly-check pipeline processes all active subscribers without timeout
- [ ] Monthly-report emails render correctly (test with React Email preview)
- [ ] Cron routes reject requests without valid `CRON_SECRET`
- [ ] NAP checker returns results for at least Google + Yelp
- [ ] Recommendations surface actionable items on the dashboard
- [ ] Score history shows month-over-month trend
- [ ] Admin recheck/regenerate endpoints work for single clients
- [ ] All new engines have no side effects (no DB access)
- [ ] All new pipelines are idempotent (safe to re-run)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Rate limiter migrated to distributed store (Upstash/Vercel KV)
