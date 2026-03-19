# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GEO Service Platform — a Next.js app that helps local businesses become visible to AI search engines. Scans sites, generates AI-optimized files (llms.txt, JSON-LD schema), monitors AI citations across ChatGPT/Perplexity/Gemini/Google AI, and reports results via a client dashboard.

See `SPEC.md` for the full technical specification (data model, API contracts, engine implementations, pipeline definitions).

## Commands

```bash
npm run dev                    # Next.js dev server
npm run build                  # Production build
npm run lint                   # ESLint
npx supabase start             # Local Supabase
npx supabase db push           # Apply migrations
npx supabase migration new <name>  # Create migration
stripe listen --forward-to localhost:3000/api/webhooks/stripe  # Stripe webhook forwarding
```

## Tech Stack

Next.js 14+ (App Router), TypeScript (strict), React + Tailwind CSS, Supabase (Postgres + Auth + RLS), Stripe, React Email + Resend, Firecrawl, Vercel hosting. AI APIs: OpenAI, Perplexity, Google Gemini, Anthropic Claude.

## Architecture

### Three-Layer Pattern: Routes → Pipelines → Engines

- **API routes** (`src/app/api/`) are thin: validate input, call a pipeline or engine, return result. All return `{ data: T }` on success, `{ error: string }` on failure.
- **Pipelines** (`src/lib/pipelines/`) orchestrate engines and handle all DB reads/writes. Four pipelines: `free-scan`, `setup`, `monthly-check`, `monthly-report`.
- **Engines** (`src/lib/engines/`) are pure functions — take input, return output, no side effects or DB access.

### Platform Abstraction

All AI citation checkers implement `PlatformChecker` interface (defined in `src/lib/engines/platforms/types.ts`). Adding a new platform = new file under `platforms/` implementing the interface. The citation checker iterates over all registered platforms using `Promise.allSettled` — one platform failure never blocks others.

### Supabase Client Usage

- **Server/API routes**: use service role client (`lib/supabase/server.ts`) — bypasses RLS, needed for admin and cron routes.
- **Client components**: use anon client (`lib/supabase/client.ts`) — respects RLS, clients can only access their own data.
- Never write raw SQL in application code; SQL belongs in `supabase/migrations/` only.

### Key Data Flow

1. **Free scan** (`POST /api/scan`): Firecrawl → query gen (Claude) → citation check (2 platforms, parallel) → scoring. No DB writes. 30s timeout budget.
2. **Setup** (Stripe webhook): Full crawl → generate llms.txt + schema → audit robots.txt → generate queries → citation check all platforms → NAP check → review pull → competitor detection → scoring → email.
3. **Monthly cron**: Re-crawl → regenerate files if changed → full citation check → NAP + reviews → new score → delta detection. Cursor-based batching (N=10 clients per invocation).

## Conventions

- Server Components by default. `'use client'` only when hooks/browser APIs needed.
- `interface` for object shapes, `type` for unions/intersections. All types in `src/types/`.
- Timeouts on all external calls: 10s AI APIs, 15s crawling, 5s directory lookups. Use `AbortController`.
- Cron routes validate `CRON_SECRET` from Authorization header. Stripe webhook validates signature.
- Generators (`src/lib/generators/`) produce llms.txt and JSON-LD schema served via public routes at `/api/geo/llms/[clientId]/llms.txt` and `/api/geo/schema/[clientId].js`.

## Gotchas

- OpenAI needs Responses API or Assistants API with web browsing for local business results — standard chat completions won't work.
- Perplexity returns structured `citations` field — parse that, don't regex the response text.
- Stripe mixed checkout (one-time + recurring) requires `mode: 'subscription'` with one-time item via `invoice_creation`.
- Free scan budget: Firecrawl 8s, query gen 3s, citation checks 12s (parallel), scoring 2s, buffer 5s.
- AI responses are non-deterministic. Run each (query, platform) 3x and take majority for `cited`. Frame results as "based on our latest check."
- Name matching must handle: abbreviations, missing articles ("The"), possessives, partial matches. Use case-insensitive substring + Levenshtein distance < 3.

## Build Phases

The project follows a phased build order: Foundation → Free Scan → Onboarding + Setup → Dashboard → Admin → Monitoring + Reports. Each phase should be working before starting the next. See the bottom of SPEC.md for detailed phase steps.
