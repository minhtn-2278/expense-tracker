# Quickstart: Simple Expense Tracker

A minimal, reproducible local dev loop.

## Prerequisites

- **Node.js 20 LTS** (`node -v` → `v20.x`)
- **pnpm 9+** (recommended) or npm
- **Supabase CLI** (`brew install supabase/tap/supabase` or
  `npm i -g supabase`) — runs a full local stack in Docker
- **Docker Desktop** (for the Supabase local stack)

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the local Supabase stack (Postgres + Auth + Studio + Inbucket)
supabase start

# 3. Apply migrations and seed default data
supabase db reset         # wipes local DB and reruns migrations from zero

# 4. Copy env and fill values from the `supabase start` output
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
#   SUPABASE_SERVICE_ROLE_KEY=<from supabase start>   # server-only, never ship to client

# 5. Generate TypeScript types from the current schema
pnpm db:types   # wraps: supabase gen types typescript --local > types/database.ts

# 6. Start the Next.js dev server
pnpm dev
# → http://localhost:3000
```

Supabase Studio is at `http://127.0.0.1:54323` (inspect tables + RLS policies).
Inbucket (the local mail catcher) is at `http://127.0.0.1:54324` — not used in
v1 since there is no email verification or password reset, but available.

## Common commands

```bash
pnpm dev           # Next.js dev server
pnpm build         # production build
pnpm start         # run the production build

pnpm lint          # eslint — MUST pass with zero warnings before commit
pnpm typecheck     # tsc --noEmit — MUST pass before commit
pnpm format        # prettier --write

pnpm test          # vitest (unit + component + action integration)
pnpm test:e2e      # playwright e2e
pnpm test:all      # all of the above
#
# Note: RLS policies are verified MANUALLY via supabase/RLS-VERIFY.md,
# not an automated suite. Run that checklist on any PR touching
# migrations or a table's RLS config. See research.md §8 for rationale.

pnpm db:reset      # wipes + remigrates + reseeds local DB
pnpm db:types      # regenerate types/database.ts
pnpm db:new-migration  # supabase migration new <name>
```

## Smoke tests (manual, ~5 minutes)

Walk the three user stories end-to-end with a fresh DB:

1. **US1 — Record**: open `http://localhost:3000`, register
   `alice@example.test` / `password1`, land on `/transactions` (empty list,
   defaults seeded). Create one income (Lương, 20 000 000) and one expense
   (Ăn uống, 150 000), edit the expense to 200 000, delete it, log out, log
   back in, confirm only the income remains.
2. **US2 — Dashboard**: navigate to `/dashboard`, toggle Day / Week / Month,
   confirm totals match what US1 recorded and that the current-month view
   shows the income as `+20 000 000`. Click "previous period" and confirm the
   label updates.
3. **US3 — Search / filter / export**: on `/transactions`, apply a filter
   (kind=income, date range this month), confirm the list narrows, click
   Export CSV, open the downloaded file — it must open cleanly in Excel with
   Vietnamese characters intact and exactly one data row.

## Before opening a PR

Run the full gate locally:

```bash
pnpm lint && pnpm typecheck && pnpm test:all
```

If your change touches the schema, also:

```bash
pnpm db:reset         # confirm migrations run clean from scratch
pnpm db:types         # regenerate and commit types/database.ts in the same PR
```

## Deploying to Vercel

1. Create a managed Supabase project; copy its URL, anon key, and service-role
   key into Vercel project settings.
2. Run `supabase db push` from a secure machine to apply migrations to the
   managed DB (service-role token required; never commit).
3. In Vercel env:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
     "Production, Preview, Development".
   - `SUPABASE_SERVICE_ROLE_KEY` as "Production" only; never "Preview" to
     avoid leaking through preview deploys on PRs.
4. Confirm `app/api/transactions/export/route.ts` runs on the Node.js runtime
   (not the Edge runtime) — streaming + Supabase cookies both need Node.
