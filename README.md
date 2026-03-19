# GEO Service Platform

A Next.js app that helps local businesses become visible to AI search engines. Scans sites, generates AI-optimized files (llms.txt, JSON-LD schema), monitors AI citations across ChatGPT/Perplexity/Gemini/Google AI, and reports results via a client dashboard.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript (strict)
- **UI:** React 19, Tailwind CSS 4
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js
- **Payments:** Stripe
- **Email:** React Email + Resend
- **Crawling:** Firecrawl
- **AI APIs:** OpenAI, Perplexity, Google Gemini, Anthropic Claude
- **Hosting:** Vercel

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (local instance or hosted)
- Stripe CLI (for webhook testing)

### 1. Clone and install

```bash
git clone <repo-url>
cd las-vegas-v2
npm install
```

### 2. Environment variables

Create a `.env` file in the project root with the following:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/geo_platform"

# Auth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AI APIs
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
PERPLEXITY_API_KEY="pplx-..."
GOOGLE_GEMINI_API_KEY="..."

# Crawling
FIRECRAWL_API_KEY="fc-..."

# Email (optional for local dev)
RESEND_API_KEY="re_..."
```

### 3. Database setup

```bash
npx prisma db push    # Apply schema to your database
npx prisma generate   # Generate Prisma client
npx prisma db seed    # Seed initial data (optional)
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Stripe webhooks (optional)

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma db push` | Push schema changes to DB |
| `npx prisma migrate dev` | Create and apply a migration |

## Contributing

### Branch Rules

- **Never push directly to `main`.** All changes go through pull requests.
- Create feature branches with descriptive names: `feat/`, `fix/`, `chore/`
- Keep PRs focused and reviewable — under 300 lines when possible.

### PR Checklist

Before opening a PR:

1. Run `npm run lint` and fix any errors
2. Run `npm run build` to verify the build passes
3. Verify no secrets in your diff: `git diff --staged | grep -iE "(key|secret|password|token)"`
4. Write a clear PR description explaining **what** changed and **why**
5. Request a review — don't merge your own PRs without approval

### Code Conventions

- **Server Components by default.** Only add `'use client'` when hooks or browser APIs are needed.
- **Architecture:** API routes are thin wrappers. Business logic lives in pipelines (`src/lib/pipelines/`) and engines (`src/lib/engines/`). Engines are pure functions with no DB access.
- Use `interface` for object shapes, `type` for unions/intersections. All types go in `src/types/`.
- Add timeouts on all external calls: 10s AI APIs, 15s crawling, 5s directory lookups.
- Never write raw SQL in application code — SQL belongs in Prisma schema or migrations only.

### Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat: add citation checker for Google AI
fix: handle timeout in Perplexity platform checker
chore: update dependencies
```

## Architecture

See `SPEC.md` for the full technical specification. The high-level pattern:

```
API Routes → Pipelines → Engines
   (thin)    (orchestration, DB)   (pure functions)
```

## License

Private — all rights reserved.
