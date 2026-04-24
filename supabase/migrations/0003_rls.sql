-- 0003_rls.sql
--
-- Enable Row-Level Security and declare explicit per-operation policies.
-- Policy pattern per constitution Principle IV and research.md §2:
--   own_select / own_insert / own_update / own_delete,
--   keyed on auth.uid() = user_id (or = id for profiles).
--
-- A user whose JWT does not match the row's owner sees zero rows on read
-- and cannot mutate; the default is denial — no policy means no access.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No INSERT policy: rows are created exclusively by the signup trigger
-- (security definer) in 0004_seed_defaults_on_signup.sql. No DELETE policy:
-- account deletion cascades from auth.users.

-- ─────────────────────────────────────────────────────────────────────────────
-- categories
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.categories enable row level security;

drop policy if exists categories_own_select on public.categories;
create policy categories_own_select on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists categories_own_insert on public.categories;
create policy categories_own_insert on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists categories_own_update on public.categories;
create policy categories_own_update on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists categories_own_delete on public.categories;
create policy categories_own_delete on public.categories
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- transactions
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.transactions enable row level security;

drop policy if exists transactions_own_select on public.transactions;
create policy transactions_own_select on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists transactions_own_insert on public.transactions;
create policy transactions_own_insert on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists transactions_own_update on public.transactions;
create policy transactions_own_update on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transactions_own_delete on public.transactions;
create policy transactions_own_delete on public.transactions
  for delete using (auth.uid() = user_id);
