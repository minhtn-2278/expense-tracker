# Implementation Plan: Simple Expense Tracker

**Branch**: `001-expense-tracker` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-expense-tracker/spec.md`

## Summary

Build a single-user, web-only expense tracker where an authenticated user records
income / expense transactions tagged with categories, sees per-day / per-week /
per-month aggregations on a Dashboard, and can search, filter, and export their
history to CSV. v1 UI is Vietnamese only; currency is VND; session is 30-day rolling;
no email verification and no password reset.

Technical approach: a single Next.js App-Router app with all server work done via
Server Components, Server Actions, and Route Handlers. Persistence, authentication,
and authorization live in Supabase: Postgres with Row-Level Security policies as the
primary authorization gate; Supabase Auth for email/password sessions. TypeScript
strict end-to-end, Zod at every trust boundary (form submit, Route Handler body,
URL params), and feature-first source organization per the constitution.

## Technical Context

**Language/Version**: TypeScript 5.x (strict + `noUncheckedIndexedAccess`), Node.js 20 LTS
**Primary Dependencies**: Next.js 15 (App Router) + React 19, `@supabase/ssr`,
`@supabase/supabase-js`, Zod, Tailwind CSS v4, shadcn/ui (Radix + Tailwind),
`date-fns` + `date-fns-tz`, `react-hook-form` + `@hookform/resolvers/zod`
**Storage**: Supabase (managed PostgreSQL) with Row-Level Security; Supabase Auth
**Testing**: Vitest + `@testing-library/react` for unit / component; Playwright for
E2E on the three user-story flows; dedicated RLS integration tests that query as
user A and assert zero rows of user B (run against a throwaway schema)
**Target Platform**: Deployed to Vercel (Node 20 serverless runtime); clients are
evergreen browsers (last 2 versions of Chrome, Edge, Firefox, Safari) on desktop
and mobile widths
**Project Type**: Web application — single Next.js project (no separate backend)
**Performance Goals**: Dashboard aggregation for 10k-transaction account under
2 s; search/filter under 1 s; CSV export for 10k transactions begins downloading
within 5 s; TTFB p95 under 600 ms on Vercel
**Constraints**: RLS policies present on every user-data table before the PR
that uses it merges; service-role key lives only in server-only modules;
`"use client"` only at interactive leaves; Vietnamese UI only; single currency
(VND); 30-day rolling session
**Scale/Scope**: ~10k transactions per user (per spec); low-hundreds of users
for v1; single region; single Postgres database

All items above are concrete — no NEEDS CLARIFICATION remains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reviewed against `.specify/memory/constitution.md` v1.0.0.

| Principle | Plan complies? | Evidence |
|-----------|----------------|----------|
| I. Clean & Concise Code | Yes | Feature-first layout; formatter + linter enforced in CI; no commented-out code allowed; per-file and per-function size budgets apply. |
| II. Clear Source Organization | Yes | Chosen layout matches the constitution verbatim (`app/`, `features/<feature>/`, `lib/`, `types/`); cross-feature imports forbidden and will be lint-guarded. |
| III. Next.js Best Practices (App Router First) | Yes | Server Components by default; all mutations via Server Actions or Route Handlers; `"use client"` marked only on `TransactionForm`, `FiltersBar`, and other interactive leaves; `loading.tsx` + `error.tsx` per route segment; `next/image`, `next/font`, `next/link` used. |
| IV. Supabase Best Practices (RLS is Non-Negotiable) | Yes | Every table (`categories`, `transactions`) has RLS enabled with explicit `SELECT / INSERT / UPDATE / DELETE` policies keyed on `auth.uid() = owner`; service-role key only in `lib/supabase/service-role.ts` gated by `"server-only"`; schema changes land as migrations; typed DB via `supabase gen types`. |
| V. Type Safety & Validation at Boundaries | Yes | `strict: true`, `noUncheckedIndexedAccess: true`; every Server Action / Route Handler parses its input with a Zod schema before any logic runs; derived types (`z.infer`) used throughout, no duplicated shapes. |

**Result**: PASS. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/001-expense-tracker/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (server actions + route handlers)
│   ├── auth.actions.md
│   ├── transactions.actions.md
│   ├── categories.actions.md
│   └── transactions.export.route.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
app/
├── (auth)/                      # public auth routes share a layout
│   ├── layout.tsx
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/                       # authenticated area, protected in layout.tsx
│   ├── layout.tsx               # checks Supabase session; redirects to /login if missing
│   ├── loading.tsx
│   ├── error.tsx
│   ├── transactions/
│   │   ├── page.tsx             # list + search + filters + export button
│   │   ├── new/page.tsx         # create form
│   │   └── [id]/edit/page.tsx   # edit form
│   ├── dashboard/
│   │   └── page.tsx             # day/week/month toggle + period nav
│   └── categories/
│       └── page.tsx             # manage categories (create/rename/archive)
├── api/
│   └── transactions/export/route.ts   # GET — streams CSV for filtered list
├── layout.tsx                   # root layout, Vietnamese lang="vi"
├── page.tsx                     # redirect → /login or /transactions
└── not-found.tsx

features/
├── auth/
│   ├── actions.ts               # register, login, logout (Server Actions)
│   ├── schemas.ts               # Zod: RegisterInput, LoginInput
│   ├── session.ts               # getServerSession() helper
│   └── components/
│       ├── RegisterForm.tsx     # "use client"
│       └── LoginForm.tsx        # "use client"
├── categories/
│   ├── actions.ts               # createCategory, renameCategory, archiveCategory
│   ├── queries.ts               # listCategories (server)
│   ├── schemas.ts
│   └── components/
│       └── CategoryManager.tsx  # "use client"
├── transactions/
│   ├── actions.ts               # createTransaction, updateTransaction, deleteTransaction
│   ├── queries.ts               # listTransactions(filters), getTransaction
│   ├── schemas.ts               # TransactionInput, TransactionFilters
│   ├── csv.ts                   # RFC 4180–compliant CSV encoder
│   └── components/
│       ├── TransactionForm.tsx  # "use client"
│       ├── TransactionList.tsx  # server component, takes server-fetched rows
│       ├── FiltersBar.tsx       # "use client"
│       └── ExportCsvButton.tsx  # "use client"
└── dashboard/
    ├── queries.ts               # aggregateForPeriod (calls SQL RPC)
    ├── period.ts                # toPeriodBounds(periodType, date, tz)  → Monday-week math
    └── components/
        ├── PeriodSwitcher.tsx   # "use client"
        └── TotalsCard.tsx       # server component

lib/
├── supabase/
│   ├── server.ts                # createServerClient() — RSC + Server Actions
│   ├── browser.ts               # createBrowserClient()
│   └── service-role.ts          # import "server-only"; createServiceRoleClient()
├── time/
│   └── period.ts                # timezone helpers, Monday week bounds
└── utils/
    ├── money.ts                 # VND formatting
    └── errors.ts                # action result types

types/
└── database.ts                  # `supabase gen types typescript` output (committed)

supabase/
├── migrations/
│   ├── 0001_init.sql                       # tables + indexes
│   ├── 0002_rls.sql                        # RLS enable + policies
│   ├── 0003_seed_defaults_on_signup.sql    # trigger: insert default categories
│   └── 0004_dashboard_rpc.sql              # aggregation SQL function
├── seed.sql                     # local dev seed
└── config.toml                  # Supabase CLI config

tests/
├── unit/                        # pure functions: period.ts, csv.ts, zod schemas
├── integration/
│   ├── rls/                     # queries as user A, asserts no user B rows
│   └── actions/                 # server actions with Supabase test container
└── e2e/                         # Playwright — one spec per user story
```

**Structure Decision**: Feature-first single-project Next.js App-Router layout
matching constitution Principle II. Server work (auth, queries, mutations) lives
in `features/<feature>/{actions,queries,schemas}.ts`; shared, product-agnostic
utilities live in `lib/`; route segments in `app/` are thin glue that composes
feature code. `supabase/migrations/` is the source of truth for the schema and
for RLS policies, and every schema-changing PR regenerates `types/database.ts`.

## Complexity Tracking

> No constitution violations; this section is empty by design.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
