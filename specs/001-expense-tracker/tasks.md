---
description: "Task list for feature 001-expense-tracker — Simple Expense Tracker"
---

# Tasks: Simple Expense Tracker

**Input**: Design documents from `/specs/001-expense-tracker/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Mandatory under **Principle VI (Test-Driven Development)** from the [constitution](../../.specify/memory/constitution.md) v1.1.0. Every feature or bug-fix task in Phases 4+ is preceded by its test task; tests must land and fail before the implementation commit. RLS correctness is verified **manually** via [supabase/RLS-VERIFY.md](../../supabase/RLS-VERIFY.md) — see T032 — rather than by an automated suite; decision rationale in [research.md §8](./research.md).

**Phase 3 (US1) is grandfathered**: those tasks shipped test-after before Principle VI was ratified. Do not retroactively reorder them; backfill tests only when the code is modified (per the grandfathering clause in Principle VI).

**Organization**: One phase per user story, in priority order (US1 → US2 → US3). Each story is an independently shippable slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: safe to run in parallel — touches a different file from other tasks in its phase and has no dependency on an incomplete task.
- **[Story]**: `US1` / `US2` / `US3` on user-story tasks; setup / foundational / polish tasks carry no story label.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Bring up the empty Next.js + Supabase skeleton the rest of the work will build on.

- [X] T001 Initialise pnpm Next.js 15 app with TypeScript at repo root: `pnpm create next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias="@/*"`, then delete generated boilerplate pages.
- [X] T002 Install runtime dependencies: `pnpm add @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers date-fns date-fns-tz server-only` and dev deps `pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test eslint-plugin-boundaries supabase`. Record versions in `package.json`.
- [X] T003 [P] Edit `tsconfig.json` to set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"paths": { "@/*": ["./*"] }`.
- [X] T004 [P] Create `.eslintrc.cjs` extending Next.js defaults plus `eslint-plugin-boundaries` rule that forbids imports from `features/<a>/*` into `features/<b>/*`; zero warnings allowed (`--max-warnings=0`).
- [X] T005 [P] Create `prettier.config.cjs` (semi, single quotes, trailing commas) and `.editorconfig`.
- [X] T006 [P] Create `vitest.config.ts` (jsdom env, `@testing-library/jest-dom` in setup) and `playwright.config.ts` (base URL `http://localhost:3000`, single `chromium` project for v1).
- [X] T007 [P] Scaffold empty feature-first directories with `.gitkeep` files per [plan.md](./plan.md) structure: `app/(auth)`, `app/(app)`, `app/api`, `features/{auth,categories,transactions,dashboard}/{components}`, `lib/{supabase,time,utils}`, `types/`, `supabase/migrations/`, `tests/{unit,integration/{rls,actions},e2e}`.
- [X] T008 Initialise Supabase CLI: `supabase init`, then edit `supabase/config.toml` to set `[auth] enable_signup = true`, `enable_confirmations = false`, `session_refresh_rolling = true`, `session_inactivity_timeout = "720h"` (30 days per spec Clarification Q3). Commit.
- [X] T009 Create `.env.example` listing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; add `.env.local` to `.gitignore` (already present — verify).
- [X] T010 [P] Add `pnpm` scripts to `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `test`, `test:e2e`, `test:all`, `db:reset`, `db:types`, `db:new-migration` (see [quickstart.md](./quickstart.md) for exact commands). (`test:rls` intentionally absent — see task T032.)
- [X] T011 [P] Configure Vietnamese-subset Inter font via `next/font/google` in `app/layout.tsx` (subsets: `['latin', 'vietnamese']`) and set `<html lang="vi">`.

**Checkpoint**: `pnpm dev` boots an empty Next.js app; `pnpm lint && pnpm typecheck` pass on the empty scaffold; `supabase start` brings up Postgres + Auth + Studio.

---

## Phase 2: Foundational (blocks ALL user stories)

**Purpose**: Ship the schema, RLS policies, signup trigger, and shared clients that every user story depends on. Nothing in Phase 3+ may begin until this phase is green.

### Database schema and policies

- [X] T012 Create migration `supabase/migrations/0001_init.sql` implementing the three tables from [data-model.md](./data-model.md): `category_kind` enum; `profiles` (id/email/timezone/created_at); `categories` (id/user_id/name/kind/archived/timestamps with partial unique on `(user_id,name,kind) where not archived`); `transactions` (id/user_id/kind/amount numeric(14,0)/occurred_at/category_id/note/timestamps); all indexes listed in data-model.md §1; `update_updated_at` generic trigger function and triggers on the two mutable tables.
- [X] T013 Create migration `supabase/migrations/0002_enforce_category_kind.sql` implementing the `enforce_category_kind_match` trigger: `BEFORE INSERT OR UPDATE` on `transactions` rejecting rows where `categories.kind != NEW.kind` OR `categories.user_id != NEW.user_id`.
- [X] T014 Create migration `supabase/migrations/0003_rls.sql` that for each of `profiles`, `categories`, `transactions`: `alter table ... enable row level security;` and declares the four policies (`own_select`, `own_insert`, `own_update`, `own_delete`) keyed on `auth.uid() = user_id` (for `profiles` keyed on `auth.uid() = id`). Follow the exact pattern from [research.md §2](./research.md).
- [X] T015 Create migration `supabase/migrations/0004_seed_defaults_on_signup.sql` with `public.handle_new_user()` function + `on_auth_user_created` trigger verbatim from [data-model.md §0](./data-model.md) (creates `profiles` row and seeds 10 Vietnamese default categories in one transaction).
- [X] T016 Create migration `supabase/migrations/0005_dashboard_rpc.sql` declaring SQL function `public.dashboard_totals(p_period text, p_anchor date, p_tz text)` returning `(total_income numeric, total_expense numeric, net numeric, by_category jsonb)` using `date_trunc(p_period, (t.occurred_at at time zone p_tz))` for period bucketing. Mark `stable` and `security invoker` so RLS applies.
- [X] T017 Run `pnpm db:reset` locally; verify migrations apply cleanly from zero and that a manual `auth.users` insert (via Supabase Studio) produces the profile row + 10 categories.
- [X] T018 Generate DB types: `pnpm db:types` → writes `types/database.ts`. Commit the generated file.

### Shared app-layer infrastructure

- [X] T019 [P] Create [lib/supabase/server.ts](lib/supabase/server.ts) exporting `createServerClient()` using `@supabase/ssr` with `cookies()` from `next/headers` for RSC + Server Actions + Route Handlers.
- [X] T020 [P] Create [lib/supabase/browser.ts](lib/supabase/browser.ts) exporting `createBrowserClient()` for `"use client"` components.
- [X] T021 [P] Create [lib/supabase/service-role.ts](lib/supabase/service-role.ts) starting with `import "server-only";` then exporting `createServiceRoleClient()` — this module must never be reachable from a client component.
- [X] T022 [P] Create [lib/utils/errors.ts](lib/utils/errors.ts) exporting the `ActionResult<T>` discriminated union used by all Server Actions (shape from [contracts/auth.actions.md](./contracts/auth.actions.md)) plus helpers `ok(data)`, `fail(code, message, fieldErrors?)`.
- [X] T023 [P] Create [lib/utils/money.ts](lib/utils/money.ts) exporting `formatVND(amount: number): string` using `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })`.
- [X] T024 [P] Create [lib/time/period.ts](lib/time/period.ts) with `toPeriodBounds(period: 'day' | 'week' | 'month', anchor: Date, tz: string)` returning `{ fromUtc, toUtc, label }`. Weeks start Monday (spec Clarification Q5). Use `date-fns-tz`.
- [X] T025 [P] Create [features/auth/session.ts](features/auth/session.ts) exporting `getServerSession()` which calls `supabase.auth.getUser()` on the server client and returns `{ userId, email } | null`.

### Protected-area layout + public pages

- [X] T026 Create [app/layout.tsx](app/layout.tsx) (root): `<html lang="vi">`, Inter font classes, Tailwind globals, metadata `{ title: 'Quản lý thu chi', description: '...' }`.
- [X] T027 Create [app/page.tsx](app/page.tsx): server component that reads session; redirects to `/transactions` if logged in else `/login`.
- [X] T028 [P] Create [app/not-found.tsx](app/not-found.tsx) with Vietnamese copy.
- [X] T029 Create [app/(auth)/layout.tsx](app/(auth)/layout.tsx): public layout; if session already exists, redirect to `/transactions`.
- [X] T030 Create [app/(app)/layout.tsx](app/(app)/layout.tsx): **authentication gate** — calls `getServerSession()`; `null` → `redirect('/login')`; otherwise renders a simple header with nav links to `/transactions`, `/dashboard`, `/categories`, and a logout form posting to `logoutAction`.
- [X] T031 [P] Create [app/(app)/loading.tsx](app/(app)/loading.tsx) and [app/(app)/error.tsx](app/(app)/error.tsx); same for `(auth)` segment.

### Manual RLS verification (no automated suite — see [research.md §8](./research.md))

- [X] T032 Create [supabase/RLS-VERIFY.md](supabase/RLS-VERIFY.md): a short, runnable checklist any PR touching `supabase/migrations/**` or a table's RLS config MUST execute before merge. Include the exact SQL snippets for impersonating a user via `set local role authenticated` + `set_config('request.jwt.claims', ..., true)`, the queries that must return zero rows, and a PR-description one-liner the author pastes to confirm verification. RLS policies themselves already exist in [0003_rls.sql](supabase/migrations/0003_rls.sql); T032 is the procedure, not the policies.
- ~~T033~~ Removed. An automated RLS suite against a live Supabase stack was originally planned but rejected during Phase 2 because it entangled dev and test databases. Server-action-layer correctness (the precheck paths that rely on ownership) is still covered by mocked-client tests under each user-story phase below.

**Checkpoint**: `supabase db reset` runs clean → types regenerate → manual RLS checklist (T032) runs clean → `pnpm dev` shows the `/login` page. No user story work may begin before this.

---

## Phase 3: User Story 1 — Record personal income and expenses (Priority: P1) 🎯 MVP

**Goal**: A visitor can register, log in, record income and expense transactions tagged with categories, edit and delete them, log out, log back in, and see their data intact and private.

**Independent Test**: Follow the US1 smoke path in [quickstart.md §Smoke tests](./quickstart.md) — register Alice, create one income + one expense, edit the expense, delete it, log out, log back in, confirm the income remains and Alice sees no one else's rows.

### Auth feature

- [X] T034 [P] [US1] Create [features/auth/schemas.ts](features/auth/schemas.ts) with `RegisterInput`, `LoginInput` Zod schemas (email trimmed + lowercased + `.email()`; password `min(8).regex(/[A-Za-z]/).regex(/\d/)`). Per [contracts/auth.actions.md](./contracts/auth.actions.md).
- [X] T035 [US1] Create [features/auth/actions.ts](features/auth/actions.ts) implementing `registerAction`, `loginAction`, `logoutAction` — maps Supabase errors to the stable error codes (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `WEAK_PASSWORD`, `UNKNOWN`) with Vietnamese messages; relies on signup trigger (T015) for profile + categories.
- [X] T036 [P] [US1] Create [features/auth/components/RegisterForm.tsx](features/auth/components/RegisterForm.tsx) — `"use client"`, `react-hook-form` + `zodResolver(RegisterInput)`, submit calls `registerAction`; renders Vietnamese labels and field-level errors.
- [X] T037 [P] [US1] Create [features/auth/components/LoginForm.tsx](features/auth/components/LoginForm.tsx) — same pattern with `LoginInput` + `loginAction`.
- [X] T038 [US1] Create [app/(auth)/register/page.tsx](app/(auth)/register/page.tsx) — server component that renders `<RegisterForm />` and a link to `/login`.
- [X] T039 [US1] Create [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) — server component that renders `<LoginForm />` and a link to `/register`.

### Categories feature (minimum slice needed for US1 — pick a category)

- [X] T040 [P] [US1] Create [features/categories/schemas.ts](features/categories/schemas.ts) with `CategoryInput`, `RenameCategoryInput` per [contracts/categories.actions.md](./contracts/categories.actions.md).
- [X] T041 [P] [US1] Create [features/categories/queries.ts](features/categories/queries.ts): `listCategories({ includeArchived = false })` returning `{ income: Category[]; expense: Category[] }` sorted by name.
- [X] T042 [US1] Create [features/categories/actions.ts](features/categories/actions.ts): `createCategory`, `renameCategory`, `archiveCategory`, `unarchiveCategory`, `deleteCategory` per contract, including the `CATEGORY_IN_USE` precheck before `delete`.
- [X] T043 [P] [US1] Create [features/categories/components/CategoryManager.tsx](features/categories/components/CategoryManager.tsx) — `"use client"` table of income + expense categories with inline rename / archive / delete controls.
- [X] T044 [US1] Create [app/(app)/categories/page.tsx](app/(app)/categories/page.tsx) — server component that fetches categories and renders `<CategoryManager />`.

### Transactions feature (create / list / edit / delete — no filters yet)

- [X] T045 [P] [US1] Create [features/transactions/schemas.ts](features/transactions/schemas.ts) with `TransactionInput` (Zod: kind enum, amount `coerce.number().int().positive()`, `occurredAt` ISO, `categoryId` uuid, optional `note` ≤ 500). Also define `TransactionFilters` (used by US3 later) so the shape exists, but US1 only consumes `TransactionInput`.
- [X] T046 [US1] Create [features/transactions/actions.ts](features/transactions/actions.ts): `createTransaction`, `updateTransaction`, `deleteTransaction` per [contracts/transactions.actions.md](./contracts/transactions.actions.md) — including the "category exists + same kind + same owner + not archived" precheck and `revalidatePath` on `/transactions` and `/dashboard`.
- [X] T047 [US1] Create [features/transactions/queries.ts](features/transactions/queries.ts): `listTransactions(filters)` returning `{ rows, total, page, pageSize }` with default ordering `occurred_at desc, id desc` and page size 50. For US1 only the empty-filters + pagination branch is needed.
- [X] T048 [P] [US1] Create [features/transactions/components/TransactionForm.tsx](features/transactions/components/TransactionForm.tsx) — `"use client"`, react-hook-form + `zodResolver(TransactionInput)`, category dropdown grouped by kind, VND input using `formatVND`, submits to `createTransaction` or `updateTransaction`.
- [X] T049 [P] [US1] Create [features/transactions/components/TransactionList.tsx](features/transactions/components/TransactionList.tsx) — server component that receives rows + categories and renders the table with edit/delete buttons (the delete button posts to a tiny `"use client"` confirm dialog).
- [X] T050 [US1] Create [app/(app)/transactions/page.tsx](app/(app)/transactions/page.tsx) — default list with pagination via `?page=N`.
- [X] T051 [US1] Create [app/(app)/transactions/new/page.tsx](app/(app)/transactions/new/page.tsx) — renders `<TransactionForm mode="create" />`.
- [X] T052 [US1] Create [app/(app)/transactions/[id]/edit/page.tsx](app/(app)/transactions/[id]/edit/page.tsx) — fetches the row, returns 404 if RLS makes the query empty, else renders `<TransactionForm mode="edit" initial={row} />`.

### Tests for US1

- [X] T053 [P] [US1] Unit tests for the Zod schemas in [tests/unit/schemas/transactions.test.ts](tests/unit/schemas/transactions.test.ts) and [tests/unit/schemas/auth.test.ts](tests/unit/schemas/auth.test.ts): amount ≤ 0 rejected; note > 500 rejected; invalid email rejected; password without digit rejected.
- [X] T054 [P] [US1] Integration test [tests/integration/actions/transactions.test.ts](tests/integration/actions/transactions.test.ts): sign in as a seeded user, `createTransaction` with an expense category assigned `kind: 'income'` → expect `CATEGORY_KIND_MISMATCH`.
- [X] T055 [P] [US1] Action-layer cross-user test at [tests/integration/actions/transactions-cross-user.test.ts](tests/integration/actions/transactions-cross-user.test.ts): with a mocked Supabase client, call `updateTransaction` / `deleteTransaction` with an `id` whose `user_id` does not match the caller and assert the action returns `NOT_FOUND` (not a partial mutation) and emits no mutating SQL beyond the parameterised `.eq('id', id)` query. Does not attempt to verify Postgres RLS — that is the manual checklist in T032.
- [X] T056 [US1] Playwright E2E: [tests/e2e/us1-record.spec.ts](tests/e2e/us1-record.spec.ts) — full US1 journey per the Independent Test above.

**Checkpoint**: Demo-able MVP. A fresh user can sign up, record transactions, edit and delete them, and never see another user's data. All US1 tests pass.

---

## Phase 4: User Story 2 — Dashboard (Priority: P2)

**Goal**: An authenticated user with recorded transactions can switch between Day / Week / Month views, navigate previous/next periods, and see totals + per-category breakdown for the chosen period.

**Independent Test**: With a populated account (from US1), visit `/dashboard`, toggle Day / Week / Month, click previous/next, assert totals match the underlying transaction data for each period. Empty period shows zeroed totals + empty-state message, not an error.

**TDD order** (Principle VI): each test task below is written and must **fail first**, then the paired implementation task lands as the minimum code that flips it green. Task IDs stay stable; the sequence is the execution order.

### Unit — period helpers (pure function)

- [X] T063 [RED] [US2] Write unit tests in [tests/unit/period.test.ts](tests/unit/period.test.ts): Monday-week boundaries, DST edge case, year boundary, `Asia/Ho_Chi_Minh` aggregation for a UTC-midnight transaction. Tests target `lib/time/period.ts` (exists) plus `features/dashboard/period.ts` (does not exist yet — imports MUST fail at Red).
- [X] T057 [GREEN] [US2] Implement [features/dashboard/period.ts](features/dashboard/period.ts) — re-export + extend `lib/time/period.ts` with Vietnamese period labels (`"Hôm nay"`, `"Tuần này"`, `"Tháng này"`) and range strings. Minimum code to flip T063 green.

### Integration — aggregation query

- [X] T064 [RED] [US2] Write [tests/integration/actions/dashboard.test.ts](tests/integration/actions/dashboard.test.ts) — mocked Supabase client returns fixture rows across adjacent weeks; assert `aggregateForPeriod({ period: 'week', anchor })` buckets via Monday starts. Must fail at Red because `features/dashboard/queries.ts` does not exist yet.
- [X] T058 [GREEN] [US2] Implement [features/dashboard/queries.ts](features/dashboard/queries.ts): `aggregateForPeriod({ period, anchor })` reads caller's `profiles.timezone`, calls `dashboard_totals` RPC (T016), returns `{ totalIncome, totalExpense, net, byCategory: { income: [...], expense: [...] } }`. Flips T064 green.

### UI — E2E drives the page + components

- [X] T065 [RED] [US2] Write Playwright E2E [tests/e2e/us2-dashboard.spec.ts](tests/e2e/us2-dashboard.spec.ts): seed 2–3 transactions across adjacent weeks via US1 UI, open `/dashboard`, toggle Day/Week/Month, click prev/next, assert totals match. Must fail at Red: `/dashboard` currently returns 404 (no page component).
- [X] T059 [GREEN] [P] [US2] Implement [features/dashboard/components/PeriodSwitcher.tsx](features/dashboard/components/PeriodSwitcher.tsx) — `"use client"` URL-state switcher with prev/next/today.
- [X] T060 [GREEN] [P] [US2] Implement [features/dashboard/components/TotalsCard.tsx](features/dashboard/components/TotalsCard.tsx) — server component rendering income / expense / net in VND.
- [X] T061 [GREEN] [P] [US2] Implement [features/dashboard/components/CategoryBreakdown.tsx](features/dashboard/components/CategoryBreakdown.tsx) — server component, two lists (income, expense) sorted by `total` desc.
- [X] T062 [GREEN] [US2] Implement [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) — Zod-parse search params (default `period='month'`, `anchor=today`), compose the three components, show `"Không có giao dịch nào trong kỳ này."` when totals are zero. Flips T065 green.

**Checkpoint**: T063 + T064 + T065 all green; dashboard delivers insight on top of the US1 ledger.

---

## Phase 5: User Story 3 — Search, filter, and CSV export (Priority: P3)

**Goal**: User can narrow the transaction list by note keyword, date range, type, categories, and amount range; export the current filtered list to a correctly-escaped CSV that opens cleanly in Vietnamese Excel.

**Independent Test**: Apply all filter types simultaneously, confirm list narrows correctly, export CSV, open in spreadsheet, confirm rows match the list exactly and Vietnamese characters render. Exporting an empty filtered list shows the Vietnamese "nothing to export" message and downloads no file.

**TDD order** (Principle VI): tests lead; implementations flip them green. Note that T066 and T067 are already covered by earlier work — `TransactionFilters` refines shipped in T045, `listTransactions` filter branches shipped in T047. Tasks remain for traceability but each is effectively a no-op verification step.

### Unit — CSV encoder (pure function)

- [X] T073 [RED] [US3] Write [tests/unit/csv.test.ts](tests/unit/csv.test.ts): `encodeRow` escapes `,`, `"`, `\n`; preserves Vietnamese diacritics (`'Ăn uống'`); header is exactly `date,type,category,amount,note`. Must fail at Red: `features/transactions/csv.ts` does not exist yet.
- [X] T068 [GREEN] [US3] Implement [features/transactions/csv.ts](features/transactions/csv.ts) with `encodeRow`, `CSV_HEADER`, `UTF8_BOM`. Minimum code to flip T073 green.

### Filter-shape reconciliation (covered by prior tasks)

- [X] T066 [US3] **Verification only** — confirm `TransactionFilters` in [features/transactions/schemas.ts](features/transactions/schemas.ts) already declares both `refine` cross-field checks (from T045). If a US3 review turns up missing checks, add them with an accompanying unit test in [tests/unit/schemas/transactions.test.ts](tests/unit/schemas/transactions.test.ts) FIRST (Red-Green).
- [X] T067 [US3] **Verification only** — confirm `listTransactions` in [features/transactions/queries.ts](features/transactions/queries.ts) already handles every filter branch (from T047): `.ilike`-escape on `q`, `.in` on `categoryIds`, `.gte/.lte` on amount, `.gte/.lte` on `occurred_at` with user-local-to-UTC conversion. Missing branch → write the action-layer integration test FIRST, then extend the query. **Finding**: the `from/to` → UTC conversion currently uses UTC midnight (`T00:00:00Z` / `T23:59:59.999Z`) rather than user-local-midnight-converted-to-UTC. For `Asia/Ho_Chi_Minh` (UTC+7) this shifts the day boundary by 7 h. Flagged for review; not fixed under US3 scope (pre-shipped Phase 3 behaviour).

### Integration — export route handler

- [X] T074 [RED] [US3] Write [tests/integration/actions/export.test.ts](tests/integration/actions/export.test.ts): with a mocked Supabase client returning 3 matching + 0 non-matching rows, hit the route handler and assert body starts with `﻿`, one header line + three data lines; with zero matching rows, assert 409 `NOTHING_TO_EXPORT`. Must fail at Red: `app/api/transactions/export/route.ts` does not exist yet.
- [X] T072 [GREEN] [US3] Implement [app/api/transactions/export/route.ts](app/api/transactions/export/route.ts) — Node runtime GET; auth-gate redirect to `/login`; `TransactionFilters.omit({ page: true }).parse(searchParams)`; peek first row, return 409 `NOTHING_TO_EXPORT` when empty; otherwise stream `ReadableStream` with BOM + header + rows; `Content-Disposition: attachment; filename="transactions-YYYYMMDD.csv"`; cap at 10,000 rows. Flips T074 green.

### UI — E2E drives filters + export button

- [X] T075 [RED] [US3] Write Playwright E2E [tests/e2e/us3-search-export.spec.ts](tests/e2e/us3-search-export.spec.ts): seed 5 transactions via US1 UI, apply every filter type, assert the list narrows, click Export, verify the downloaded file matches the filtered rows and opens as UTF-8 CSV. Must fail at Red: `<FiltersBar />` and `<ExportCsvButton />` are not wired into the transactions page.
- [X] T069 [GREEN] [P] [US3] Implement [features/transactions/components/FiltersBar.tsx](features/transactions/components/FiltersBar.tsx) — native `<form method="GET" action="/transactions">` with `name` on every control (`q`, `from`, `to`, `kind`, `categoryIds` (multi), `amountMin`, `amountMax`) and uncontrolled `defaultValue` seeded from the already-parsed filters. Resets `page` implicitly (no `name="page"`). **Fix note (2026-04-24)**: the first pass used `router.push(...)` in a JS submit handler, but Next's router cache reused the stale server-component output for same-path soft navigations, so only date-range filters "worked" (apparently). Exporting CSV hit the route handler directly and was unaffected. The native-GET refactor forces a full browser navigation, guaranteeing the server page re-renders with fresh `searchParams`. Regression test: [tests/unit/components/FiltersBar.test.tsx](tests/unit/components/FiltersBar.test.tsx).
- [X] T070 [GREEN] [P] [US3] Implement [features/transactions/components/ExportCsvButton.tsx](features/transactions/components/ExportCsvButton.tsx) — `"use client"`; constructs `/api/transactions/export?<filters>` URL + triggers download; on `409` shows `'Không có giao dịch nào để xuất.'`.
- [X] T071 [GREEN] [US3] Wire [app/(app)/transactions/page.tsx](app/(app)/transactions/page.tsx) to parse search params with `TransactionFilters`, render `<FiltersBar />` above `<TransactionList />`, and render `<ExportCsvButton />` beside the page title. Flips T075 green.

**Checkpoint**: All three user stories functional and independently testable. T073 + T074 + T075 green.

---

## Phase 6: Polish & cross-cutting concerns

- [ ] T076 [P] Verify **service-role key not in client bundle**: `pnpm build`, then `grep -r "SUPABASE_SERVICE_ROLE_KEY\|eyJ" .next/static` — must return zero matches. Add to CI as a post-build check.
- [X] T077 [P] Verify **no cross-feature imports**: run lint (T004 rule); fail CI on any violation. **Outcome (2026-04-24)**: `features/transactions/components/{TransactionForm,FiltersBar}.tsx` were importing `GroupedCategories` from `@/features/categories/queries` — a cross-feature dependency forbidden by the rule. Fixed by relocating `Category` and `GroupedCategories` to [types/categories.ts](types/categories.ts) (the boundary config allows `feature → types`) and re-exporting the same names from `features/categories/queries.ts` for internal callers. Also swapped `form.watch('kind')` for `useWatch(...)` in `TransactionForm.tsx` so the React Compiler no longer warns. `npm run lint` now exits clean with `--max-warnings=0`.
- [ ] T078 Performance pass: seed a test account with 10,000 transactions, measure SC-004 (Dashboard ≤ 2 s), SC-005 (filter ≤ 1 s), SC-006 (CSV export start ≤ 5 s). Record numbers in a short markdown inside `specs/001-expense-tracker/perf-baseline.md`.
- [ ] T079 [P] Run [quickstart.md](./quickstart.md) smoke tests end-to-end against a locally-built production bundle (`pnpm build && pnpm start`).
- [ ] T080 [P] Verify logs redaction: grep dev + prod logs for `encrypted_password`, JWTs, auth request bodies — must be absent (constitution "secrets in logs").
- [X] T081 Add a short top-level `README.md` (Vietnamese) with run/deploy pointers and a one-line link to [specs/001-expense-tracker/](./). Replaces the stock `create-next-app` README.

---

## Dependencies & Execution Order

### Phase-level

- Phase 1 **Setup** → Phase 2 **Foundational** → Phases 3–5 (user stories) → Phase 6 **Polish**.
- Phase 2 is a hard gate: no `features/**` code is written until migrations (T012–T016), clients (T019–T021), and the protected layout (T030) are merged.

### Within Phase 2

- T012 → T013 → T014 → T015 → T016 → T017 → T018 (migrations and generated types are strictly sequential).
- T019–T025 (shared libs) and T026–T031 (layouts) are parallel among themselves once T018 lands.
- T032 has no intra-phase dependency; it is a documentation deliverable that can land any time before the first PR touching policies.

### Within a user-story phase

- **Phases 4+ (Principle VI TDD)**: each test task (`[RED]`) MUST be written and committed in a failing state before its paired implementation task (`[GREEN]`) lands. The phases above list tasks in the exact execution order required by TDD; do not interleave Green tasks ahead of their Red.
- **Phase 3 (US1) — grandfathered**: shipped test-after in order Schemas → Queries → Actions → Components → Pages → Tests. Retained as historical record; do not retroactively reorder.
- Within US1 (grandfathered): T040/T041 and T045 are independent leaves; T042 depends on T040/T041; T046 depends on T040/T041/T045; pages depend on all feature modules.
- Within US2 (TDD): T063 → T057 → T064 → T058 → T065 → (T059/T060/T061 parallel) → T062.
- Within US3 (TDD): T073 → T068 → T074 → T072 → T075 → (T069/T070 parallel) → T071. T066/T067 are verification no-ops because their code shipped proactively in T045/T047.

### Story-to-story

- US1 is the only strict prerequisite: it stands up auth, the transactions table flow, and the category picker that US2 and US3 both observe.
- US2 and US3 are otherwise independent and can be done in parallel once US1 ships.

---

## Parallel Execution Examples

### Phase 1 kickoff (after T001–T002)

Tasks T003, T004, T005, T006, T007, T010, T011 can each run as a separate agent/PR — all touch distinct files.

### Phase 2 — once T018 (types) lands

Launch in parallel:

- T019 `lib/supabase/server.ts`
- T020 `lib/supabase/browser.ts`
- T021 `lib/supabase/service-role.ts`
- T022 `lib/utils/errors.ts`
- T023 `lib/utils/money.ts`
- T024 `lib/time/period.ts`
- T025 `features/auth/session.ts`

### US1 — once T034, T040, T041, T045 are complete

- T036 + T037 + T043 + T048 + T049 can run in parallel (five different component files).

### US2 (TDD — limited parallelism)

The Red-Green pairs are strictly sequential. The only parallel window is between the three Green component tasks under "UI — E2E drives the page":

- T059 `PeriodSwitcher.tsx`, T060 `TotalsCard.tsx`, T061 `CategoryBreakdown.tsx` can be written by three developers in parallel once T065 (E2E) is committed as Red. T062 (`page.tsx`) waits for all three.

### US3 (TDD — limited parallelism)

Red-Green pairs are sequential. Parallel windows:

- The unit track (T073 → T068, CSV encoder) can run concurrently with the integration track (T074 → T072, export route) once both Red tests are committed.
- Green UI components T069 (`FiltersBar.tsx`) and T070 (`ExportCsvButton.tsx`) can be written in parallel once T075 (E2E) is committed as Red. T071 (wiring) waits for both.

---

## Implementation Strategy

### MVP first

Complete Phase 1 → Phase 2 → **Phase 3 only**, then stop and validate. At that point the product delivers the core value proposition (record and manage a personal ledger with categories and auth), is demo-able, and could be deployed to a private beta if desired.

### Incremental delivery

1. MVP above → demo.
2. Add Phase 4 (Dashboard) → demo.
3. Add Phase 5 (Search + filter + CSV) → demo.
4. Phase 6 polish → ship v1.

### Parallel team strategy

- Dev A owns migrations + shared libs (T012–T025).
- Dev B owns layouts + auth feature (T026–T039).
- Once Phase 2 ships, Dev A picks up US2, Dev B finishes US1, Dev C picks up US3.

---

## Task Count Summary

- Phase 1 (Setup): **11** tasks (T001–T011)
- Phase 2 (Foundational): **21** tasks (T012–T032; T033 removed when automated RLS suite was replaced by manual checklist)
- Phase 3 (US1 — MVP): **23** tasks (T034–T056)
- Phase 4 (US2 — Dashboard): **9** tasks (T057–T065)
- Phase 5 (US3 — Search/Export): **10** tasks (T066–T075)
- Phase 6 (Polish): **6** tasks (T076–T081)
- **Total: 80 tasks** (T033 removed mid-Phase 2)

Parallel opportunities: 41 tasks carry `[P]` and can run concurrently with siblings in their phase.

---

## Notes

- `[P]` tasks = different files, no dependency on an incomplete task in the same phase.
- `[RED]` / `[GREEN]` labels (Phase 4+) make the TDD step explicit. Red tasks commit a failing test; Green tasks commit the minimum code that flips it passing. Under Principle VI both may ship in the same PR, but the Red commit MUST precede the Green commit within the PR's history.
- `[US1]` / `[US2]` / `[US3]` labels are traceability to user stories in [spec.md](./spec.md).
- Commit after each task or small logical group; the constitution requires `lint + typecheck + tests` to be green on every commit. For TDD: a Red commit is acceptable with the newly-added test failing — but every OTHER test in the suite must still pass.
- Every task touching a table also touches its migration and its RLS policies in the same PR — enforced by the constitution.
- Every task touching a trust boundary (Server Action, Route Handler) uses a Zod schema from `features/<feature>/schemas.ts` and no bare `any`.
