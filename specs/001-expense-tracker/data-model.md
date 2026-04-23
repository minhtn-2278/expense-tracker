# Data Model: Simple Expense Tracker

This document is the source-of-truth description of the persistent data model.
Every table below is owned by the user identified by `user_id`; Row-Level
Security policies described under "Authorization" enforce that ownership.

All `timestamptz` columns are stored in UTC. User-facing date boundaries (day /
week / month) are derived at read-time by converting to the user's
`profiles.timezone`.

## 0. Relationship to Supabase Auth (`auth.users` ↔ `public.profiles`)

This project does **not** store credentials itself. Supabase Auth owns the
`auth` schema and manages identity + credentials; our application schema
(`public`) extends each Supabase user with app-specific data via `profiles`.

### Split of responsibility

```
┌───────────────────────────────────────┐          ┌──────────────────────────────┐
│  auth.users           (Supabase)      │   1:1    │  public.profiles    (app)    │
│  ───────────────────────────────────  │  ──────► │  ─────────────────────────   │
│  id uuid PRIMARY KEY                  │          │  id uuid PK                  │
│  email                                │          │    └── FK → auth.users(id)   │
│  encrypted_password   (bcrypt hash)   │          │        ON DELETE CASCADE     │
│  email_confirmed_at                   │          │  email    (denormalised)     │
│  last_sign_in_at                      │          │  timezone                    │
│  raw_app_meta_data, raw_user_meta_data│          │  created_at                  │
│  recovery_token, mfa_factors, ...     │          │                              │
└───────────────────────────────────────┘          └──────────────────────────────┘
          ▲                                                 ▲
          │ managed exclusively by                          │ managed by the app
          │ supabase.auth.signUp / signIn / signOut         │ via Server Actions
          │ (no app write, ever)                            │ under RLS
```

**Why no `password` column in `profiles`**: password hashes live in
`auth.users.encrypted_password`, written by Supabase Auth itself during
`supabase.auth.signUp(...)` and verified by `signInWithPassword(...)`.
Application code never reads, writes, or even sees the hash. Duplicating a
password column into `public.profiles` would force us to re-implement
hashing, rotation, rate limiting, and session refresh — all features we
get for free by delegating to Supabase Auth (and required by constitution
Principle IV).

### 1:1 identity via shared `id`

`public.profiles.id` **is** `auth.users.id`. The FK uses
`ON DELETE CASCADE` so that deleting an account from Supabase Auth
automatically tears down the user's profile (and, by further cascades from
`profiles.id`, all their categories and transactions). There is no
separate "app user id" — `auth.uid()` inside RLS returns the same UUID
stored in `profiles.id` and in every `user_id` column.

### Signup handoff — one trigger seeds both profile and defaults

Account creation is a single DB-transactional handoff:

```sql
-- supabase/migrations/0003_seed_defaults_on_signup.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. mirror the auth.users row into public.profiles
  insert into public.profiles (id, email)
  values (new.id, new.email);

  -- 2. seed default Vietnamese categories for the new user
  insert into public.categories (user_id, name, kind)
  values
    (new.id, 'Lương',          'income'),
    (new.id, 'Thu nhập khác',  'income'),
    (new.id, 'Ăn uống',        'expense'),
    (new.id, 'Đi lại',         'expense'),
    (new.id, 'Nhà ở',          'expense'),
    (new.id, 'Giải trí',       'expense'),
    (new.id, 'Sức khỏe',       'expense'),
    (new.id, 'Mua sắm',        'expense'),
    (new.id, 'Hóa đơn',        'expense'),
    (new.id, 'Chi phí khác',   'expense');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Properties of this design:

- **Atomic**: profile row and default categories are created in the same
  transaction as the `auth.users` insert. No "account exists but profile
  missing" window is ever possible.
- **`security definer` but tightly scoped**: the function only touches two
  `public` tables and only uses `new.id` / `new.email` as inputs, so it
  cannot be abused to write rows for another user.
- **App code never inserts into `profiles`**: registration ends at
  `supabase.auth.signUp(...)`; the trigger handles the rest.

### Updating a profile

App code may only `update` its own `profiles` row (`timezone` is the only
user-editable field in v1). This is enforced by an RLS update policy on
`profiles` keyed on `auth.uid() = id`. `email` stays in sync with
`auth.users.email`; changing email is not in scope for v1 (no email-change
flow is exposed).

### Deleting an account

Out of scope for v1 (there is no "delete my account" feature). When it is
added later, the pattern will be `supabase.auth.admin.deleteUser(id)` from
a server-only module that holds the service-role key; the `ON DELETE
CASCADE` chain (`auth.users` → `profiles` → `categories`/`transactions`)
removes the rest automatically.

### What this means for queries

Every RLS policy below uses `auth.uid()`, which is the JWT-derived
`auth.users.id` — i.e. the same value as `profiles.id` and as every
`user_id` FK. There is therefore **exactly one identity throughout the
system**, and no "translate app user to auth user" layer is needed
anywhere in the app code.

## 1. Tables

### 1.1 `profiles`

One row per account, created by trigger when a new `auth.users` row is inserted.

| Column        | Type                        | Constraints                                        | Notes                                                 |
|---------------|-----------------------------|----------------------------------------------------|-------------------------------------------------------|
| `id`          | `uuid`                      | PK, `references auth.users(id) on delete cascade`  | Mirrors `auth.users.id`; used as `user_id` everywhere |
| `email`       | `citext`                    | `not null`                                         | Denormalised from `auth.users` for display            |
| `timezone`    | `text`                      | `not null default 'Asia/Ho_Chi_Minh'`              | IANA zone; used for Dashboard period boundaries       |
| `created_at`  | `timestamptz`               | `not null default now()`                           |                                                       |

### 1.2 `categories`

A user-scoped label used to classify a transaction.

| Column        | Type                        | Constraints                                                          | Notes                                            |
|---------------|-----------------------------|----------------------------------------------------------------------|--------------------------------------------------|
| `id`          | `uuid`                      | PK, `default gen_random_uuid()`                                      |                                                  |
| `user_id`     | `uuid`                      | `not null default auth.uid() references profiles(id) on delete cascade` | Owner                                         |
| `name`        | `text`                      | `not null check (char_length(trim(name)) between 1 and 40)`          | Vietnamese display name                          |
| `kind`        | `category_kind` (enum)      | `not null`                                                           | `'income'` or `'expense'`                        |
| `archived`    | `boolean`                   | `not null default false`                                             | Archived categories stay on historical rows      |
| `created_at`  | `timestamptz`               | `not null default now()`                                             |                                                  |
| `updated_at`  | `timestamptz`               | `not null default now()`                                             | Kept up-to-date by `update_updated_at` trigger   |

Indexes and constraints:

- Unique `(user_id, name, kind) where archived = false` — a user can reuse a
  name once the old one is archived, but cannot have two active categories with
  the same name and kind.
- Index `(user_id, archived, kind)` supports the category-picker query.

### 1.3 `transactions`

A single monetary event recorded by a user.

| Column           | Type                     | Constraints                                                                   | Notes                                                                     |
|------------------|--------------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| `id`             | `uuid`                   | PK, `default gen_random_uuid()`                                               |                                                                           |
| `user_id`        | `uuid`                   | `not null default auth.uid() references profiles(id) on delete cascade`       | Owner                                                                     |
| `kind`           | `category_kind` (enum)   | `not null`                                                                    | Must match `category.kind` (enforced by trigger below)                    |
| `amount`         | `numeric(14,0)`          | `not null check (amount > 0)`                                                 | VND is zero-decimal; no fractional part. 14 digits → up to 99 trillion đ. |
| `occurred_at`    | `timestamptz`            | `not null`                                                                    | When the event actually happened, in UTC                                  |
| `category_id`    | `uuid`                   | `not null references categories(id) on delete restrict`                       | Deleting a category that has transactions is blocked (archive instead)    |
| `note`           | `text`                   | `check (char_length(note) <= 500)`                                            | Optional free text                                                        |
| `created_at`     | `timestamptz`            | `not null default now()`                                                      |                                                                           |
| `updated_at`     | `timestamptz`            | `not null default now()`                                                      | Kept up-to-date by `update_updated_at` trigger                            |

Indexes:

- **Primary-list index**: `(user_id, occurred_at desc, id desc)` — supports the
  paginated list with default ordering and is the fastest path for all filter
  combinations (range on `occurred_at`, equality on `user_id`).
- `(user_id, category_id)` — supports per-category filter.
- `(user_id, kind)` — supports income/expense filter.

Triggers:

- `enforce_category_kind_match` — `BEFORE INSERT OR UPDATE` fires a check that
  the referenced `categories.kind` equals `transactions.kind` **and** that the
  referenced category is owned by the same `user_id`. Rejects otherwise.
- `update_updated_at` — shared generic trigger to keep `updated_at` current.

## 2. Enums

```sql
create type category_kind as enum ('income', 'expense');
```

## 3. Relationships

```
auth.users (Supabase-managed)
    │  1:1 (trigger on insert)
    ▼
profiles
    │  1:N
    ├────────────► categories
    │                   │
    │                   │ 1:N
    │                   ▼
    └─────► transactions (category_id references categories, same user_id required)
```

## 4. State transitions

### Category

```
                       +─────────+
   (insert) ────────►  | active  |
                       +─────────+
                            │
                       archive()
                            ▼
                       +─────────+
                       |archived |   (hidden from picker; still shown on tx)
                       +─────────+
                            │
                       un-archive()   (allowed only if no active category
                            ▼         with same (name, kind) exists)
                       +─────────+
                       | active  |
                       +─────────+

   delete() — only allowed when no transactions reference the row;
              otherwise the server action returns error CATEGORY_IN_USE
              and the UI offers archive() instead.
```

### Transaction

```
   (insert) ─► existing ─► update() ─► existing
                     │
                     └── delete() ─► (gone; no soft-delete)
```

## 5. Authorization (Row-Level Security)

RLS is enabled on **every** table above (`profiles`, `categories`, `transactions`).
Policies for `categories` and `transactions` follow the four-policy pattern
documented in [`research.md §2`](./research.md):

```sql
-- applied to categories and transactions identically
create policy own_select on <table>
  for select using (auth.uid() = user_id);
create policy own_insert on <table>
  for insert with check (auth.uid() = user_id);
create policy own_update on <table>
  for update using (auth.uid() = user_id)
             with check (auth.uid() = user_id);
create policy own_delete on <table>
  for delete using (auth.uid() = user_id);
```

For `profiles`, the user can only `select` and `update` their own row; `insert`
happens inside the signup trigger under `security definer`; no `delete` policy
exposed to the user (profile cleanup cascades from `auth.users` delete).

## 6. Validation rules (mirrored in Zod schemas at app layer)

The Zod schemas in `features/<feature>/schemas.ts` are the source of truth for
boundary validation. The database constraints above are the second line of
defence (constitution Principle IV). Every rule below exists in **both** places:

| Rule                                                        | DB check                          | Zod equivalent                                   |
|-------------------------------------------------------------|-----------------------------------|--------------------------------------------------|
| Transaction amount strictly > 0                             | `check (amount > 0)`              | `z.coerce.number().int().positive()`             |
| Transaction note ≤ 500 characters                           | `check (char_length(note) <= 500)`| `z.string().max(500).optional()`                 |
| Category name length 1–40                                   | `check ...between 1 and 40`       | `z.string().trim().min(1).max(40)`               |
| Category kind matches transaction kind + same owner         | trigger `enforce_category_kind_match` | server-action validation re-checks after fetch |
| Category name unique per (user, kind) while not archived    | partial unique index              | server-action validates with a pre-insert query  |
| Deleting a category with transactions is blocked            | `on delete restrict`              | server action returns `CATEGORY_IN_USE` first    |
| Only the owner can read/write a row                         | RLS policies                      | server actions also check `auth.uid()` early     |

## 7. Data volume expectations (informational)

- 10k transactions per user, ~20 categories per user, ~1,000 users for v1 ⇒
  well under a million rows total. All indexes above fit trivially in memory on
  any Supabase tier.
