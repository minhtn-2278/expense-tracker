# Phase 0 Research: Simple Expense Tracker

Each section below follows the format: **Decision → Rationale → Alternatives considered**.

## 1. Auth session handling in the Next.js App Router

**Decision**: Use `@supabase/ssr` with two client factories — `createServerClient()`
in `lib/supabase/server.ts` (reads/writes cookies via `next/headers`) for Server
Components, Server Actions, and Route Handlers; `createBrowserClient()` in
`lib/supabase/browser.ts` for client components that need realtime subscriptions
or client-side redirects after login. The `(app)/layout.tsx` server component calls
`supabase.auth.getUser()` on each request; unauthenticated visitors are redirected
to `/login` with `redirect()` from `next/navigation`.

**Rationale**: `@supabase/ssr` is the officially-recommended package for the App
Router, transparently handles cookie-based session persistence on both edges of
the request, and removes the need to hand-roll a middleware that reads JWTs.
Calling `getUser()` in the protected-area layout gives us one place to enforce
"must be logged in," which keeps every downstream page free of repeated auth
boilerplate.

**Alternatives considered**:
- Middleware-based auth redirect — works but runs on every asset request; we'd
  still need server-side `getUser()` inside Server Actions. Moved the gate into
  the layout to centralise behaviour.
- Legacy `@supabase/auth-helpers-nextjs` — superseded; Supabase has moved new
  development to `@supabase/ssr`.

## 2. Row-Level Security policy pattern

**Decision**: Every user-data table has a non-null `user_id uuid` column that
defaults to `auth.uid()` and is referenced in all four policies:

```sql
alter table public.transactions enable row level security;

create policy "own_select" on public.transactions
  for select using (auth.uid() = user_id);

create policy "own_insert" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "own_update" on public.transactions
  for update using (auth.uid() = user_id)
             with check (auth.uid() = user_id);

create policy "own_delete" on public.transactions
  for delete using (auth.uid() = user_id);
```

Same four-policy shape is applied to `categories`.

**Rationale**: Explicit policies for every operation make intent obvious in
review and in tests; the `with check` clauses on insert/update prevent a user
from re-owning a row to someone else. `default auth.uid()` means a malicious or
buggy client cannot even submit a `user_id` of another user and succeed.

**Alternatives considered**:
- A single `using (auth.uid() = user_id)` policy covering `all` — shorter but
  hides the update-retarget risk and is harder to audit per-operation.
- Using `security definer` RPCs and no RLS — violates Principle IV; RLS must be
  the primary gate.

## 3. Signup handoff — profile creation and default-category seeding

**Decision**: A single Postgres `AFTER INSERT` trigger on `auth.users`, bound
to a `security definer` function `public.handle_new_user()`, performs the
entire app-side signup handoff atomically: (1) insert the corresponding row
into `public.profiles` (mirroring `auth.users.id` and `auth.users.email`),
then (2) insert the default Vietnamese category set for the new user.

Default categories: **Income** — `Lương`, `Thu nhập khác`; **Expense** —
`Ăn uống`, `Đi lại`, `Nhà ở`, `Giải trí`, `Sức khỏe`, `Mua sắm`, `Hóa đơn`,
`Chi phí khác`. (Full SQL is in
[`data-model.md §0`](./data-model.md#0-relationship-to-supabase-auth-authusers--publicprofiles).)

**Rationale**: Bundling both inserts into one trigger makes "every account has
a profile *and* default categories" a schema-level invariant that no client
code can bypass — including any future alternative signup path we add later
(OAuth, admin-created accounts, data-import scripts). Because the trigger fires
inside the same transaction as the `auth.users` insert, there is no window in
which a user exists without a profile (which would break every FK in the
public schema) or without categories (which would block US1). `security
definer` is scoped tightly: the function only writes to `public.profiles` and
`public.categories`, uses only `NEW.id` / `NEW.email` as input, and its
`search_path` is pinned.

**Alternatives considered**:
- Two separate triggers (one for profile, one for categories) — marginally more
  granular but adds ordering fragility (the second trigger would need to run
  after the first). One function is easier to reason about.
- Inserting the profile + categories from a Server Action after
  `supabase.auth.signUp(...)` returns — two network round-trips; can fail
  mid-way leaving an inconsistent account; also means application code would
  need to be allowed to insert into `profiles`, which would require a policy
  broader than "read/update your own row."
- Lazy creation ("if the user has no categories, seed on first login") — adds
  branching to every authenticated page load and still does not guarantee the
  profile row exists for the first query.

## 4. Timezone + Monday-week aggregation

**Decision**: The user's IANA timezone is stored in `profiles.timezone` (default
`Asia/Ho_Chi_Minh`). Dashboard aggregations run as a Postgres function
`dashboard_totals(p_period text, p_anchor date, p_tz text)` that uses
`date_trunc('week', (t.occurred_at at time zone p_tz))` (or `'day'` / `'month'`).
Postgres's `date_trunc('week', ...)` starts weeks on Monday by ISO 8601 — exactly
the clarification answer, no custom math needed.

**Rationale**: Pushing aggregation into SQL keeps the server action a thin
transport layer, uses the database indexes, and gives deterministic results
regardless of which server instance runs. `date_trunc('week', ...)` is ISO 8601
and Monday-anchored by definition, matching the spec clarification.

**Alternatives considered**:
- Aggregating in JavaScript with `date-fns-tz` — works but pulls all rows for
  the period to the server just to reduce them; slower for 10k-row accounts.
- Storing `occurred_at` in UTC and converting in every query — still our plan;
  this is the storage format. The decision above is about *how* to aggregate.

## 5. CSV export — streaming vs buffered

**Decision**: A GET Route Handler at `app/api/transactions/export/route.ts`
accepts the same filter query params as the transactions list, validates them
with the shared Zod filters schema, streams rows with `ReadableStream`, and
encodes each row with a small RFC 4180 encoder in `features/transactions/csv.ts`.
Response headers: `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="transactions-YYYYMMDD.csv"`, and a
UTF-8 BOM (`﻿`) at the start so that default Microsoft Excel on Vietnamese
Windows opens the file without mojibake.

**Rationale**: A streaming Route Handler keeps memory bounded for large exports
and satisfies SC-006 (start download within 5 s) regardless of row count. The
UTF-8 BOM is the pragmatic fix for Excel's legacy default; it costs three bytes
and eliminates the most common "why are my Vietnamese category names broken?"
bug. Sharing the filters schema with the list page guarantees exported rows
exactly match what the user sees.

**Alternatives considered**:
- A Server Action that returns the whole CSV string — simplest but buffers in
  memory; a 10k-row export could hit payload limits.
- Papaparse — adds a dependency for a problem we can solve in ~20 lines; RFC
  4180 escaping rules are small and tested.

## 6. Category deletion vs archive

**Decision**: "Delete" on a category with zero transactions hard-deletes. "Delete"
on a category with ≥ 1 transaction is rejected by a check in the server action
and a database constraint (`FK on transactions.category_id with ON DELETE
RESTRICT`) — the UI instead offers "Archive" (set `archived = true`). Archived
categories remain joinable for display on existing transactions but are filtered
out of the "select category" dropdown in the new-transaction form.

**Rationale**: Hard delete when safe keeps the data model lean. The `ON DELETE
RESTRICT` constraint is a belt-and-braces second line of defence under the
server-side check (constitution Principle IV: RLS + server checks). Archiving
rather than soft-deleting keeps the historical record readable without
introducing a tombstone semantic elsewhere.

**Alternatives considered**:
- Always soft-delete — simpler branching but pollutes every query with
  `where archived = false` and still doesn't answer "can the user reuse the
  name?" (archived `Ăn uống` would block creating a new `Ăn uống`).
- Cascade-delete transactions when category deleted — unacceptable data loss
  for a financial ledger.

## 7. Pagination strategy for the transactions list

**Decision**: Offset pagination with `limit 50 offset $N` for v1; list defaults
to page size 50 ordered by `occurred_at desc, id desc`. An index on
`(user_id, occurred_at desc, id desc)` makes this fast within the 10k/user
target. Page number travels in the URL (`?page=3`) so the user can bookmark and
deep-link.

**Rationale**: At 10k rows/user, offset is fine; keyset (cursor) pagination
brings complexity (encoding the tuple, handling ties) that we do not yet need.
URL-state pagination plays naturally with Server Components — the page is a pure
function of the URL.

**Alternatives considered**:
- Keyset pagination — correct at larger scale but premature here and harder to
  combine with arbitrary filter/search URL state.
- Infinite scroll — adds client-side state and hurts accessibility; users of a
  financial ledger routinely want to "jump to page 12."

## 8. Verifying Row-Level Security — manual checklist, not automated suite

**Decision**: v1 does **not** ship an automated RLS integration test suite.
RLS is still enforced at the database layer via the four per-operation
policies declared in `0003_rls.sql`; however, verifying those policies is
performed as a **documented manual checklist** (stored alongside the
migrations) that any PR touching `supabase/migrations/**`, `auth.*`, or a
table's RLS config MUST run before merge. Unit and component tests for
server actions mock the Supabase client instead (since they are testing
action logic, not policy enforcement).

**Rationale**: An earlier iteration of this doc prescribed an automated
suite that hit a real Supabase stack (signing in fixture users A + B and
asserting A sees no rows of B). During Phase 2 implementation we decided
that strategy entangled dev and test databases in a way the team preferred
to avoid — every test run either mutated dev data or required the full
stack to be reset between runs. Alternatives were considered (transaction
rollback per test, dedicated second stack) but the team judged the
operational cost not worth the coverage for v1's scope. The decision is
explicitly reversible: when the product grows, switch to
"transaction-rollback via direct `pg` connection" (Option D in the
review) without changing any other architecture.

**What still enforces correctness, even without automated RLS tests**:

1. Every table has four explicit per-operation policies keyed on
   `auth.uid() = user_id`. These are reviewed on every migration PR.
2. The `enforce_transaction_category_match` trigger provides a second
   line of defence for cross-user category reuse.
3. The service-role key is confined to `lib/supabase/service-role.ts`
   under `import "server-only"`, so no client path can bypass RLS.
4. Server actions additionally check ownership (for better error UX);
   these are covered by the Phase 3 action-layer unit/integration tests
   (with a mocked Supabase client).

**Manual verification checklist** (must run on any PR touching RLS or
the DB schema — tracked as task T032 and stored at
`supabase/RLS-VERIFY.md`):

1. `supabase db reset` runs cleanly from zero.
2. Open Studio → Auth → create two users alice@local / bob@local.
3. Open SQL editor → `set local role authenticated` + inject alice's
   JWT claim, then `select * from categories where user_id = <bob>` → 0
   rows. Repeat for `transactions`, `profiles`, and for each of
   `UPDATE`/`DELETE`.
4. Attempt `insert into transactions (user_id, ...) values (<bob>, ...)`
   as alice → error.
5. Record completion in PR description as "RLS manually verified per
   `supabase/RLS-VERIFY.md`".

**Alternatives considered (and rejected for v1)**:
- Automated suite hitting live PostgREST — rejected per decision above.
- Transaction-rollback with direct `pg` connection (Option D) — most
  robust; rejected for v1 due to setup cost; kept as the forward path.
- Mocking the Supabase client for RLS tests — rejected outright: a mock
  returns whatever data you script, so "RLS tests" that use mocks
  provide zero signal about policy correctness.
- `pgTAP` — same operational cost as the live-stack suite; no win.

## 9. Vietnamese-only UI approach

**Decision**: Strings are hardcoded in Vietnamese in the component JSX (or in
per-feature `strings.ts` modules for any string that repeats). Root
`<html lang="vi">`. No i18n framework. `next/font` with a Latin+Vietnamese
subset of Inter.

**Rationale**: The clarification explicitly scoped v1 to Vietnamese only and
explicitly ruled out i18n plumbing. Hardcoded strings are the simplest thing
that works and is trivial to refactor later behind `next-intl` or similar if
demand appears. Using the correct font subset prevents rendering fallbacks for
Vietnamese diacritics.

**Alternatives considered**:
- `next-intl` with a single `vi.json` — premature abstraction; adds a
  dependency, a build step, and a per-page boilerplate for zero user-visible
  benefit today.

## 10. Form and schema flow

**Decision**: `react-hook-form` + `@hookform/resolvers/zod` on the client,
submitting via Server Actions. The same Zod schema exported from
`features/<feature>/schemas.ts` is used by both the form resolver and the
Server Action's input parsing — the action never trusts client validation.

**Rationale**: The schema is the single source of truth for the shape; client
gets early UX feedback, server gets authoritative validation. No duplicated
"also check amount > 0 on the server" code — Zod already says that.

**Alternatives considered**:
- Validating only on the server — loses instant feedback UX.
- Validating only on the client — violates Principle V.

## Open questions

None. Every bullet above resolves a concrete design question and the spec's
clarifications cover the remaining product ambiguities. The plan can proceed to
Phase 1.
