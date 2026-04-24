-- 0001_init.sql
--
-- Core schema for feature 001-expense-tracker.
-- Tables: profiles (1:1 with auth.users), categories, transactions.
-- Every user-owned row is keyed by auth.uid() via a default; RLS policies
-- (added in 0003_rls.sql) enforce per-user isolation.
--
-- Refs: specs/001-expense-tracker/data-model.md

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.category_kind as enum ('income', 'expense');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic trigger helper: keep updated_at current on row change.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — mirrors auth.users.id 1:1. Created by signup trigger (0004).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext       not null,
  timezone    text         not null default 'Asia/Ho_Chi_Minh',
  created_at  timestamptz  not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- categories — user-scoped labels. Default set seeded by signup trigger.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  kind        public.category_kind not null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- a user can reuse a name once the old one is archived
create unique index if not exists categories_active_unique
  on public.categories (user_id, lower(name), kind)
  where archived = false;

create index if not exists categories_user_kind_idx
  on public.categories (user_id, archived, kind);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- transactions — one monetary event per row.
-- VND is zero-decimal: amount stored as integer numeric(14,0).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind          public.category_kind not null,
  amount        numeric(14, 0) not null check (amount > 0),
  occurred_at   timestamptz not null,
  category_id   uuid not null references public.categories(id) on delete restrict,
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Primary list / pagination index (newest first).
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_at desc, id desc);

-- Filter support indexes
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id);

create index if not exists transactions_user_kind_idx
  on public.transactions (user_id, kind);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
