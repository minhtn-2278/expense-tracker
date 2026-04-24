# Manual RLS verification checklist

**When to run**: any PR that touches
`supabase/migrations/**`, `auth.*` config, or the RLS posture of any
user-data table.

**Why manual**: see [research.md §8](../specs/001-expense-tracker/research.md).
Automated RLS tests were considered (live-stack and transaction-rollback
variants) and deliberately deferred for v1. Mocking does not verify
policies, so the best cheap alternative is a short, repeatable manual
check run at every schema PR — faster than setting up the automation
and impossible to silently skip if reviewers enforce it.

**What this does NOT replace**: the policies themselves still ship in
[0003_rls.sql](migrations/0003_rls.sql) and are enforced by Postgres on
every request. This checklist only confirms they are written correctly.

---

## Pre-flight

```bash
npx supabase start          # Docker stack up
npm run db:reset            # migrations + empty public schema
```

Open Supabase Studio at `http://127.0.0.1:54323`.

## Step 1 — Create two test users

Studio → **Auth** → **Add user**:

- `alice@local.test` / any password (e.g. `password123`)
- `bob@local.test` / same

The `on_auth_user_created` trigger will create each user's `profiles`
row and 10 default categories. Verify in Studio → Table editor that
both users appear in `public.profiles` and each has 10 `categories`.

Note the two UUIDs from `auth.users.id` — you'll paste them as
`<ALICE_ID>` and `<BOB_ID>` in the SQL snippets below.

## Step 2 — Read isolation (SELECT policies)

Studio → **SQL editor** → run this block **as one transaction**:

```sql
begin;

-- Impersonate Alice
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"<ALICE_ID>","role":"authenticated"}', true);

-- Each of these MUST return 0 rows.
select count(*) from public.categories    where user_id = '<BOB_ID>';   -- expect 0
select count(*) from public.transactions  where user_id = '<BOB_ID>';   -- expect 0
select count(*) from public.profiles      where id      = '<BOB_ID>';   -- expect 0

rollback;
```

If any count is `> 0`, the `*_own_select` policy for that table is
broken — **stop and fix the migration** before continuing the review.

## Step 3 — Write isolation (UPDATE + DELETE policies)

Repeat the setup block (`begin` + `set local role` + `set_config`),
then:

```sql
-- As Alice, try to mutate rows Alice does not own. rowCount MUST be 0
-- for every one of these (RLS hides Bob's rows; the mutations silently
-- affect nothing).
update public.categories   set name = 'hacked'    where user_id = '<BOB_ID>';
update public.transactions set amount = 1         where user_id = '<BOB_ID>';
update public.profiles     set timezone = 'UTC'   where id      = '<BOB_ID>';
delete from public.categories    where user_id = '<BOB_ID>';
delete from public.transactions  where user_id = '<BOB_ID>';

rollback;
```

Each statement should report `UPDATE 0` / `DELETE 0`. Anything else
indicates a policy bug.

## Step 4 — Impersonation (INSERT `with_check`)

Repeat the setup, then attempt to write a row that claims to belong to
Bob while running as Alice:

```sql
-- Grab any of Alice's own income categories — needed because
-- enforce_transaction_category_match also requires same-owner category.
select id from public.categories
 where user_id = '<ALICE_ID>' and kind = 'income' limit 1;  -- note <A_CAT_ID>

insert into public.transactions (user_id, kind, amount, occurred_at, category_id)
values ('<BOB_ID>', 'income', 1000, now(), '<A_CAT_ID>');   -- MUST error

rollback;
```

The INSERT must error. RLS `with_check` alone blocks it; the
`enforce_transaction_category_match` trigger will also catch it if RLS
is somehow bypassed. If the statement succeeds, **both lines of defence
are broken** — treat as a P1 security bug.

## Step 5 — Record verification

In the PR description, paste:

> RLS manually verified per `supabase/RLS-VERIFY.md`
> — Steps 2–4 all produced the expected zero-row / error outcomes.
> Reviewer: @your-handle, date: YYYY-MM-DD.

Reviewers must not approve a policy-touching PR without this line.

---

## If this checklist starts feeling painful

…that is the signal to automate. Convert to a node-postgres
"transaction-rollback" test suite (Option D in research.md §8 review)
and re-enable an automated merge gate. Expected effort: ~1 afternoon.
