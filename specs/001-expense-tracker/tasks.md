---
description: "Task list for feature 001-expense-tracker — Simple Expense Tracker"
---

# Tasks: Simple Expense Tracker

**Input**: Design documents from `/specs/001-expense-tracker/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The project [constitution](../../.specify/memory/constitution.md) makes "unit/integration tests pass" a merge gate and requires RLS tests in the same PR as any table change, so test tasks are first-class below.

**Organization**: One phase per user story, in priority order (US1 → US2 → US3). Each story is an independently shippable slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: safe to run in parallel — touches a different file from other tasks in its phase and has no dependency on an incomplete task.
- **[Story]**: `US1` / `US2` / `US3` on user-story tasks; setup / foundational / polish tasks carry no story label.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Bring up the empty Next.js + Supabase skeleton the rest of the work will build on.

- [ ] T001 Initialise pnpm Next.js 15 app with TypeScript at repo root: `pnpm create next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias="@/*"`, then delete generated boilerplate pages.
- [ ] T002 Install runtime dependencies: `pnpm add @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers date-fns date-fns-tz server-only` and dev deps `pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test eslint-plugin-boundaries supabase`. Record versions in `package.json`.
- [ ] T003 [P] Edit `tsconfig.json` to set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"paths": { "@/*": ["./*"] }`.
- [ ] T004 [P] Create `.eslintrc.cjs` extending Next.js defaults plus `eslint-plugin-boundaries` rule that forbids imports from `features/<a>/*` into `features/<b>/*`; zero warnings allowed (`--max-warnings=0`).
- [ ] T005 [P] Create `prettier.config.cjs` (semi, single quotes, trailing commas) and `.editorconfig`.
- [ ] T006 [P] Create `vitest.config.ts` (jsdom env, `@testing-library/jest-dom` in setup) and `playwright.config.ts` (base URL `http://localhost:3000`, single `chromium` project for v1).
- [ ] T007 [P] Scaffold empty feature-first directories with `.gitkeep` files per [plan.md](./plan.md) structure: `app/(auth)`, `app/(app)`, `app/api`, `features/{auth,categories,transactions,dashboard}/{components}`, `lib/{supabase,time,utils}`, `types/`, `supabase/migrations/`, `tests/{unit,integration/{rls,actions},e2e}`.
- [ ] T008 Initialise Supabase CLI: `supabase init`, then edit `supabase/config.toml` to set `[auth] enable_signup = true`, `enable_confirmations = false`, `session_refresh_rolling = true`, `session_inactivity_timeout = "720h"` (30 days per spec Clarification Q3). Commit.
- [ ] T009 Create `.env.example` listing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; add `.env.local` to `.gitignore` (already present — verify).
- [ ] T010 [P] Add `pnpm` scripts to `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `test`, `test:rls`, `test:e2e`, `test:all`, `db:reset`, `db:types`, `db:new-migration` (see [quickstart.md](./quickstart.md) for exact commands).
- [ ] T011 [P] Configure Vietnamese-subset Inter font via `next/font/google` in `app/layout.tsx` (subsets: `['latin', 'vietnamese']`) and set `<html lang="vi">`.

**Checkpoint**: `pnpm dev` boots an empty Next.js app; `pnpm lint && pnpm typecheck` pass on the empty scaffold; `supabase start` brings up Postgres + Auth + Studio.

---

## Phase 2: Foundational (blocks ALL user stories)

**Purpose**: Ship the schema, RLS policies, signup trigger, and shared clients that every user story depends on. Nothing in Phase 3+ may begin until this phase is green.

### Database schema and policies

- [ ] T012 Create migration `supabase/migrations/0001_init.sql` implementing the three tables from [data-model.md](./data-model.md): `category_kind` enum; `profiles` (id/email/timezone/created_at); `categories` (id/user_id/name/kind/archived/timestamps with partial unique on `(user_id,name,kind) where not archived`); `transactions` (id/user_id/kind/amount numeric(14,0)/occurred_at/category_id/note/timestamps); all indexes listed in data-model.md §1; `update_updated_at` generic trigger function and triggers on the two mutable tables.
- [ ] T013 Create migration `supabase/migrations/0002_enforce_category_kind.sql` implementing the `enforce_category_kind_match` trigger: `BEFORE INSERT OR UPDATE` on `transactions` rejecting rows where `categories.kind != NEW.kind` OR `categories.user_id != NEW.user_id`.
- [ ] T014 Create migration `supabase/migrations/0003_rls.sql` that for each of `profiles`, `categories`, `transactions`: `alter table ... enable row level security;` and declares the four policies (`own_select`, `own_insert`, `own_update`, `own_delete`) keyed on `auth.uid() = user_id` (for `profiles` keyed on `auth.uid() = id`). Follow the exact pattern from [research.md §2](./research.md).
- [ ] T015 Create migration `supabase/migrations/0004_seed_defaults_on_signup.sql` with `public.handle_new_user()` function + `on_auth_user_created` trigger verbatim from [data-model.md §0](./data-model.md) (creates `profiles` row and seeds 10 Vietnamese default categories in one transaction).
- [ ] T016 Create migration `supabase/migrations/0005_dashboard_rpc.sql` declaring SQL function `public.dashboard_totals(p_period text, p_anchor date, p_tz text)` returning `(total_income numeric, total_expense numeric, net numeric, by_category jsonb)` using `date_trunc(p_period, (t.occurred_at at time zone p_tz))` for period bucketing. Mark `stable` and `security invoker` so RLS applies.
- [ ] T017 Run `pnpm db:reset` locally; verify migrations apply cleanly from zero and that a manual `auth.users` insert (via Supabase Studio) produces the profile row + 10 categories.
- [ ] T018 Generate DB types: `pnpm db:types` → writes `types/database.ts`. Commit the generated file.

### Shared app-layer infrastructure

- [ ] T019 [P] Create [lib/supabase/server.ts](lib/supabase/server.ts) exporting `createServerClient()` using `@supabase/ssr` with `cookies()` from `next/headers` for RSC + Server Actions + Route Handlers.
- [ ] T020 [P] Create [lib/supabase/browser.ts](lib/supabase/browser.ts) exporting `createBrowserClient()` for `"use client"` components.
- [ ] T021 [P] Create [lib/supabase/service-role.ts](lib/supabase/service-role.ts) starting with `import "server-only";` then exporting `createServiceRoleClient()` — this module must never be reachable from a client component.
- [ ] T022 [P] Create [lib/utils/errors.ts](lib/utils/errors.ts) exporting the `ActionResult<T>` discriminated union used by all Server Actions (shape from [contracts/auth.actions.md](./contracts/auth.actions.md)) plus helpers `ok(data)`, `fail(code, message, fieldErrors?)`.
- [ ] T023 [P] Create [lib/utils/money.ts](lib/utils/money.ts) exporting `formatVND(amount: number): string` using `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })`.
- [ ] T024 [P] Create [lib/time/period.ts](lib/time/period.ts) with `toPeriodBounds(period: 'day' | 'week' | 'month', anchor: Date, tz: string)` returning `{ fromUtc, toUtc, label }`. Weeks start Monday (spec Clarification Q5). Use `date-fns-tz`.
- [ ] T025 [P] Create [features/auth/session.ts](features/auth/session.ts) exporting `getServerSession()` which calls `supabase.auth.getUser()` on the server client and returns `{ userId, email } | null`.

### Protected-area layout + public pages

- [ ] T026 Create [app/layout.tsx](app/layout.tsx) (root): `<html lang="vi">`, Inter font classes, Tailwind globals, metadata `{ title: 'Quản lý thu chi', description: '...' }`.
- [ ] T027 Create [app/page.tsx](app/page.tsx): server component that reads session; redirects to `/transactions` if logged in else `/login`.
- [ ] T028 [P] Create [app/not-found.tsx](app/not-found.tsx) with Vietnamese copy.
- [ ] T029 Create [app/(auth)/layout.tsx](app/(auth)/layout.tsx): public layout; if session already exists, redirect to `/transactions`.
- [ ] T030 Create [app/(app)/layout.tsx](app/(app)/layout.tsx): **authentication gate** — calls `getServerSession()`; `null` → `redirect('/login')`; otherwise renders a simple header with nav links to `/transactions`, `/dashboard`, `/categories`, and a logout form posting to `logoutAction`.
- [ ] T031 [P] Create [app/(app)/loading.tsx](app/(app)/loading.tsx) and [app/(app)/error.tsx](app/(app)/error.tsx); same for `(auth)` segment.

### Test harness

- [ ] T032 Create [tests/integration/rls/harness.ts](tests/integration/rls/harness.ts): helper that spins up two Supabase JS clients signed in as pre-seeded users A and B (emails/passwords in a dedicated `supabase/seed.sql` that runs after migrations for tests only). Exports `asUser(letter)` returning a typed client.
- [ ] T033 Create [tests/integration/rls/policies.test.ts](tests/integration/rls/policies.test.ts): parametrised Vitest suite asserting — for each of `categories` and `transactions` and each of `SELECT`, `INSERT`, `UPDATE`, `DELETE` — that user A cannot affect user B's rows. Test must pass against the migrations from T012–T015.

**Checkpoint**: `supabase db reset` runs clean → types regenerate → `pnpm test:rls` passes → `pnpm dev` shows the `/login` page. No user story work may begin before this.

---

## Phase 3: User Story 1 — Record personal income and expenses (Priority: P1) 🎯 MVP

**Goal**: A visitor can register, log in, record income and expense transactions tagged with categories, edit and delete them, log out, log back in, and see their data intact and private.

**Independent Test**: Follow the US1 smoke path in [quickstart.md §Smoke tests](./quickstart.md) — register Alice, create one income + one expense, edit the expense, delete it, log out, log back in, confirm the income remains and Alice sees no one else's rows.

### Auth feature

- [ ] T034 [P] [US1] Create [features/auth/schemas.ts](features/auth/schemas.ts) with `RegisterInput`, `LoginInput` Zod schemas (email trimmed + lowercased + `.email()`; password `min(8).regex(/[A-Za-z]/).regex(/\d/)`). Per [contracts/auth.actions.md](./contracts/auth.actions.md).
- [ ] T035 [US1] Create [features/auth/actions.ts](features/auth/actions.ts) implementing `registerAction`, `loginAction`, `logoutAction` — maps Supabase errors to the stable error codes (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `WEAK_PASSWORD`, `UNKNOWN`) with Vietnamese messages; relies on signup trigger (T015) for profile + categories.
- [ ] T036 [P] [US1] Create [features/auth/components/RegisterForm.tsx](features/auth/components/RegisterForm.tsx) — `"use client"`, `react-hook-form` + `zodResolver(RegisterInput)`, submit calls `registerAction`; renders Vietnamese labels and field-level errors.
- [ ] T037 [P] [US1] Create [features/auth/components/LoginForm.tsx](features/auth/components/LoginForm.tsx) — same pattern with `LoginInput` + `loginAction`.
- [ ] T038 [US1] Create [app/(auth)/register/page.tsx](app/(auth)/register/page.tsx) — server component that renders `<RegisterForm />` and a link to `/login`.
- [ ] T039 [US1] Create [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) — server component that renders `<LoginForm />` and a link to `/register`.

### Categories feature (minimum slice needed for US1 — pick a category)

- [ ] T040 [P] [US1] Create [features/categories/schemas.ts](features/categories/schemas.ts) with `CategoryInput`, `RenameCategoryInput` per [contracts/categories.actions.md](./contracts/categories.actions.md).
- [ ] T041 [P] [US1] Create [features/categories/queries.ts](features/categories/queries.ts): `listCategories({ includeArchived = false })` returning `{ income: Category[]; expense: Category[] }` sorted by name.
- [ ] T042 [US1] Create [features/categories/actions.ts](features/categories/actions.ts): `createCategory`, `renameCategory`, `archiveCategory`, `unarchiveCategory`, `deleteCategory` per contract, including the `CATEGORY_IN_USE` precheck before `delete`.
- [ ] T043 [P] [US1] Create [features/categories/components/CategoryManager.tsx](features/categories/components/CategoryManager.tsx) — `"use client"` table of income + expense categories with inline rename / archive / delete controls.
- [ ] T044 [US1] Create [app/(app)/categories/page.tsx](app/(app)/categories/page.tsx) — server component that fetches categories and renders `<CategoryManager />`.

### Transactions feature (create / list / edit / delete — no filters yet)

- [ ] T045 [P] [US1] Create [features/transactions/schemas.ts](features/transactions/schemas.ts) with `TransactionInput` (Zod: kind enum, amount `coerce.number().int().positive()`, `occurredAt` ISO, `categoryId` uuid, optional `note` ≤ 500). Also define `TransactionFilters` (used by US3 later) so the shape exists, but US1 only consumes `TransactionInput`.
- [ ] T046 [US1] Create [features/transactions/actions.ts](features/transactions/actions.ts): `createTransaction`, `updateTransaction`, `deleteTransaction` per [contracts/transactions.actions.md](./contracts/transactions.actions.md) — including the "category exists + same kind + same owner + not archived" precheck and `revalidatePath` on `/transactions` and `/dashboard`.
- [ ] T047 [US1] Create [features/transactions/queries.ts](features/transactions/queries.ts): `listTransactions(filters)` returning `{ rows, total, page, pageSize }` with default ordering `occurred_at desc, id desc` and page size 50. For US1 only the empty-filters + pagination branch is needed.
- [ ] T048 [P] [US1] Create [features/transactions/components/TransactionForm.tsx](features/transactions/components/TransactionForm.tsx) — `"use client"`, react-hook-form + `zodResolver(TransactionInput)`, category dropdown grouped by kind, VND input using `formatVND`, submits to `createTransaction` or `updateTransaction`.
- [ ] T049 [P] [US1] Create [features/transactions/components/TransactionList.tsx](features/transactions/components/TransactionList.tsx) — server component that receives rows + categories and renders the table with edit/delete buttons (the delete button posts to a tiny `"use client"` confirm dialog).
- [ ] T050 [US1] Create [app/(app)/transactions/page.tsx](app/(app)/transactions/page.tsx) — default list with pagination via `?page=N`.
- [ ] T051 [US1] Create [app/(app)/transactions/new/page.tsx](app/(app)/transactions/new/page.tsx) — renders `<TransactionForm mode="create" />`.
- [ ] T052 [US1] Create [app/(app)/transactions/[id]/edit/page.tsx](app/(app)/transactions/[id]/edit/page.tsx) — fetches the row, returns 404 if RLS makes the query empty, else renders `<TransactionForm mode="edit" initial={row} />`.

### Tests for US1

- [ ] T053 [P] [US1] Unit tests for the Zod schemas in [tests/unit/schemas/transactions.test.ts](tests/unit/schemas/transactions.test.ts) and [tests/unit/schemas/auth.test.ts](tests/unit/schemas/auth.test.ts): amount ≤ 0 rejected; note > 500 rejected; invalid email rejected; password without digit rejected.
- [ ] T054 [P] [US1] Integration test [tests/integration/actions/transactions.test.ts](tests/integration/actions/transactions.test.ts): sign in as a seeded user, `createTransaction` with an expense category assigned `kind: 'income'` → expect `CATEGORY_KIND_MISMATCH`.
- [ ] T055 [P] [US1] Extend the RLS test suite (T033) or add a sibling file to explicitly exercise the four policies on `transactions` *and* the precheck path in the actions layer for cross-user deletes. File: [tests/integration/rls/transactions-cross-user.test.ts](tests/integration/rls/transactions-cross-user.test.ts).
- [ ] T056 [US1] Playwright E2E: [tests/e2e/us1-record.spec.ts](tests/e2e/us1-record.spec.ts) — full US1 journey per the Independent Test above.

**Checkpoint**: Demo-able MVP. A fresh user can sign up, record transactions, edit and delete them, and never see another user's data. All US1 tests pass.

---

## Phase 4: User Story 2 — Dashboard (Priority: P2)

**Goal**: An authenticated user with recorded transactions can switch between Day / Week / Month views, navigate previous/next periods, and see totals + per-category breakdown for the chosen period.

**Independent Test**: With a populated account (from US1), visit `/dashboard`, toggle Day / Week / Month, click previous/next, assert totals match the underlying transaction data for each period. Empty period shows zeroed totals + empty-state message, not an error.

- [ ] T057 [P] [US2] Create [features/dashboard/period.ts](features/dashboard/period.ts) re-exporting + extending `lib/time/period.ts` for dashboard-specific needs (period label in Vietnamese: `"Hôm nay"`, `"Tuần này"`, `"Tháng này"`, plus formatted range strings).
- [ ] T058 [P] [US2] Create [features/dashboard/queries.ts](features/dashboard/queries.ts): `aggregateForPeriod({ period, anchor })` — reads the caller's `profiles.timezone`, calls `dashboard_totals` RPC (from T016), returns typed `{ totalIncome, totalExpense, net, byCategory: { income: [...], expense: [...] } }`.
- [ ] T059 [P] [US2] Create [features/dashboard/components/PeriodSwitcher.tsx](features/dashboard/components/PeriodSwitcher.tsx) — `"use client"`; manages URL state `?period=day|week|month&anchor=YYYY-MM-DD` via `useRouter`, with prev/next/today buttons.
- [ ] T060 [P] [US2] Create [features/dashboard/components/TotalsCard.tsx](features/dashboard/components/TotalsCard.tsx) — server component rendering three numbers (income / expense / net) in Vietnamese VND.
- [ ] T061 [P] [US2] Create [features/dashboard/components/CategoryBreakdown.tsx](features/dashboard/components/CategoryBreakdown.tsx) — server component rendering two ordered lists (by absolute amount desc): expenses by category, incomes by category.
- [ ] T062 [US2] Create [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) — parses `period`/`anchor` search params with a small Zod schema (default `period='month'`, `anchor=today`), composes the three components, shows empty-state copy `"Không có giao dịch nào trong kỳ này."` when both totals are zero.
- [ ] T063 [P] [US2] Unit tests for [lib/time/period.ts](lib/time/period.ts) and [features/dashboard/period.ts](features/dashboard/period.ts) in [tests/unit/period.test.ts](tests/unit/period.test.ts): Monday-week boundaries; DST edge case; year boundary; `Asia/Ho_Chi_Minh` timezone aggregation for a UTC-midnight transaction.
- [ ] T064 [P] [US2] Integration test [tests/integration/actions/dashboard.test.ts](tests/integration/actions/dashboard.test.ts): seed mixed transactions in adjacent weeks, call `aggregateForPeriod` with `period='week'` and an anchor, assert bucketing is correct and uses Monday starts.
- [ ] T065 [P] [US2] Playwright E2E: [tests/e2e/us2-dashboard.spec.ts](tests/e2e/us2-dashboard.spec.ts) — seed data, open `/dashboard`, switch periods, click prev/next, assert labels and totals.

**Checkpoint**: Dashboard delivers insight on top of the US1 ledger. Tests green.

---

## Phase 5: User Story 3 — Search, filter, and CSV export (Priority: P3)

**Goal**: User can narrow the transaction list by note keyword, date range, type, categories, and amount range; export the current filtered list to a correctly-escaped CSV that opens cleanly in Vietnamese Excel.

**Independent Test**: Apply all filter types simultaneously, confirm list narrows correctly, export CSV, open in spreadsheet, confirm rows match the list exactly and Vietnamese characters render. Exporting an empty filtered list shows the Vietnamese "nothing to export" message and downloads no file.

- [ ] T066 [P] [US3] Extend [features/transactions/schemas.ts](features/transactions/schemas.ts) to finalise `TransactionFilters` with the two `refine` cross-field checks (date range, amount range) per [contracts/transactions.actions.md](./contracts/transactions.actions.md). (Shape was introduced in T045.)
- [ ] T067 [US3] Extend [features/transactions/queries.ts](features/transactions/queries.ts) `listTransactions` to honour every filter: `.ilike` with escaped `%`/`_` on `q`, `.in('category_id', ...)`, `.gte/.lte` on amount and on `occurred_at` (after converting user-local dates to UTC bounds using the caller's timezone).
- [ ] T068 [P] [US3] Create [features/transactions/csv.ts](features/transactions/csv.ts): `encodeRow(row): string` producing RFC 4180 output (quote fields containing `"`, `,`, or newline; double internal `"`); plus `CSV_HEADER = 'date,type,category,amount,note'` and `UTF8_BOM = '﻿'`.
- [ ] T069 [P] [US3] Create [features/transactions/components/FiltersBar.tsx](features/transactions/components/FiltersBar.tsx) — `"use client"`; form synced to URL search params; fields for `q`, `from`, `to`, `kind`, `categoryIds` (multi), `amountMin`, `amountMax`; resets `page=1` on change.
- [ ] T070 [P] [US3] Create [features/transactions/components/ExportCsvButton.tsx](features/transactions/components/ExportCsvButton.tsx) — `"use client"`; constructs `/api/transactions/export?<currentFilters>` and triggers download; on `409` shows a toast with `'Không có giao dịch nào để xuất.'`.
- [ ] T071 [US3] Update [app/(app)/transactions/page.tsx](app/(app)/transactions/page.tsx) to parse search params with `TransactionFilters`, pass them to `listTransactions`, render `<FiltersBar />` above `<TransactionList />`, and render `<ExportCsvButton />` beside the page title.
- [ ] T072 [US3] Create [app/api/transactions/export/route.ts](app/api/transactions/export/route.ts) — Node runtime GET; auth-gate (302 to `/login` if no session); `TransactionFilters.omit({ page: true }).parse(searchParams)`; peek first row, return 409 `NOTHING_TO_EXPORT` if empty; otherwise return a `ReadableStream` response with BOM + header + streamed row lines and `Content-Disposition: attachment; filename="transactions-YYYYMMDD.csv"`, capped at 10,000 rows.
- [ ] T073 [P] [US3] Unit tests [tests/unit/csv.test.ts](tests/unit/csv.test.ts): `encodeRow` escapes `,`, `"`, `\n`, preserves Vietnamese diacritics (`'Ăn uống'`); header is exactly `date,type,category,amount,note`.
- [ ] T074 [P] [US3] Integration test [tests/integration/actions/export.test.ts](tests/integration/actions/export.test.ts): seed 3 matching + 2 non-matching rows, hit the route handler, assert body starts with `﻿`, has 1 header + 3 data lines, and that a call with no matches returns 409 with `NOTHING_TO_EXPORT`.
- [ ] T075 [P] [US3] Playwright E2E [tests/e2e/us3-search-export.spec.ts](tests/e2e/us3-search-export.spec.ts): apply every filter type, assert list narrows, click Export, verify downloaded file matches the listed rows and opens as UTF-8 CSV.

**Checkpoint**: All three user stories functional and independently testable.

---

## Phase 6: Polish & cross-cutting concerns

- [ ] T076 [P] Verify **service-role key not in client bundle**: `pnpm build`, then `grep -r "SUPABASE_SERVICE_ROLE_KEY\|eyJ" .next/static` — must return zero matches. Add to CI as a post-build check.
- [ ] T077 [P] Verify **no cross-feature imports**: run lint (T004 rule); fail CI on any violation.
- [ ] T078 Performance pass: seed a test account with 10,000 transactions, measure SC-004 (Dashboard ≤ 2 s), SC-005 (filter ≤ 1 s), SC-006 (CSV export start ≤ 5 s). Record numbers in a short markdown inside `specs/001-expense-tracker/perf-baseline.md`.
- [ ] T079 [P] Run [quickstart.md](./quickstart.md) smoke tests end-to-end against a locally-built production bundle (`pnpm build && pnpm start`).
- [ ] T080 [P] Verify logs redaction: grep dev + prod logs for `encrypted_password`, JWTs, auth request bodies — must be absent (constitution "secrets in logs").
- [ ] T081 Add a short top-level `README.md` (Vietnamese) with run/deploy pointers and a one-line link to [specs/001-expense-tracker/](./).

---

## Dependencies & Execution Order

### Phase-level

- Phase 1 **Setup** → Phase 2 **Foundational** → Phases 3–5 (user stories) → Phase 6 **Polish**.
- Phase 2 is a hard gate: no `features/**` code is written until migrations (T012–T016), clients (T019–T021), and the protected layout (T030) are merged.

### Within Phase 2

- T012 → T013 → T014 → T015 → T016 → T017 → T018 (migrations and generated types are strictly sequential).
- T019–T025 (shared libs) and T026–T031 (layouts) are parallel among themselves once T018 lands.
- T032 → T033 (RLS test harness then suite).

### Within a user-story phase

- Schemas → Queries → Actions → Components → Pages. Tests run against the wired-up stack.
- Within US1: T040/T041 and T045 are independent leaves and parallel; T042 depends on T040/T041; T046 depends on T040/T041/T045; pages depend on all feature modules.
- Within US2: T057–T061 all parallel (different files, only read typed DB and period helpers); T062 depends on all of them; tests depend on the page.
- Within US3: T066 is a schema extension (already-scaffolded file) → T067 then T072 can proceed; T068/T069/T070 parallel with each other.

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

### US2 entirely parallel

T057–T061 and T063/T064 can run in parallel on five different team members once the data layer from T016/T018 is in.

### US3 front and back in parallel

- Track A: T068 + T073 (CSV encoder + its tests).
- Track B: T069 (FiltersBar).
- Track C: T067 + T072 (query extension + route handler) — sequential within the track.
- Merge all three, then do T071 wiring + T074/T075 tests.

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
- Phase 2 (Foundational): **22** tasks (T012–T033)
- Phase 3 (US1 — MVP): **23** tasks (T034–T056)
- Phase 4 (US2 — Dashboard): **9** tasks (T057–T065)
- Phase 5 (US3 — Search/Export): **10** tasks (T066–T075)
- Phase 6 (Polish): **6** tasks (T076–T081)
- **Total: 81 tasks**

Parallel opportunities: 41 tasks carry `[P]` and can run concurrently with siblings in their phase.

---

## Notes

- `[P]` tasks = different files, no dependency on an incomplete task in the same phase.
- `[US1]` / `[US2]` / `[US3]` labels are traceability to user stories in [spec.md](./spec.md).
- Commit after each task or small logical group; the constitution requires `lint + typecheck + tests` to be green on every commit.
- Every task touching a table also touches its migration and its RLS policies in the same PR — enforced by the constitution.
- Every task touching a trust boundary (Server Action, Route Handler) uses a Zod schema from `features/<feature>/schemas.ts` and no bare `any`.
