-- 0002_enforce_category_kind.sql
--
-- Invariants for transactions:
--   1. transaction.kind MUST equal referenced category.kind
--      (an income transaction cannot use an expense category, and vice versa).
--   2. transaction.user_id MUST equal referenced category.user_id
--      (belt & braces on top of RLS — blocks a user attempting to attach
--      another user's category to their own transaction).
--
-- These are checked on INSERT and on any UPDATE that touches category_id,
-- kind, or user_id, via a BEFORE trigger.

create or replace function public.enforce_transaction_category_match()
returns trigger
language plpgsql
as $$
declare
  v_cat_kind    public.category_kind;
  v_cat_owner   uuid;
  v_cat_archived boolean;
begin
  select kind, user_id, archived
  into   v_cat_kind, v_cat_owner, v_cat_archived
  from   public.categories
  where  id = new.category_id;

  if v_cat_kind is null then
    raise exception 'category % not found', new.category_id
      using errcode = '23503';  -- foreign_key_violation
  end if;

  if v_cat_owner is distinct from new.user_id then
    raise exception 'category % not owned by user %', new.category_id, new.user_id
      using errcode = '42501';  -- insufficient_privilege
  end if;

  if v_cat_kind <> new.kind then
    raise exception 'category kind % does not match transaction kind %',
                    v_cat_kind, new.kind
      using errcode = '23514';  -- check_violation
  end if;

  -- New transactions cannot pick an archived category. Existing transactions
  -- may keep their archived category on update (so users can archive a
  -- category without orphaning or rewriting history).
  if tg_op = 'INSERT' and v_cat_archived then
    raise exception 'category % is archived', new.category_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_enforce_category_match on public.transactions;
create trigger transactions_enforce_category_match
  before insert or update of category_id, kind, user_id on public.transactions
  for each row execute function public.enforce_transaction_category_match();
