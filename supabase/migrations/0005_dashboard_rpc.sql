-- 0005_dashboard_rpc.sql
--
-- public.dashboard_totals(period, anchor, tz) — aggregation used by US2.
-- Returns a single JSONB blob for the caller's transactions within the
-- selected period, bucketed by kind and per-category.
--
-- `security invoker` + RLS on transactions/categories means the function
-- automatically scopes to the caller's own rows — no user_id arg needed.
--
-- Weeks start on Monday because Postgres date_trunc('week', ...) is ISO 8601
-- by definition (clarification Q5).

create or replace function public.dashboard_totals(
  p_period text,         -- 'day' | 'week' | 'month'
  p_anchor date,         -- reference date, interpreted in p_tz
  p_tz text              -- IANA timezone, e.g. 'Asia/Ho_Chi_Minh'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from          timestamptz;
  v_to            timestamptz;
  v_total_income  numeric := 0;
  v_total_expense numeric := 0;
  v_by_category   jsonb;
begin
  if p_period not in ('day', 'week', 'month') then
    raise exception 'invalid period: %', p_period
      using errcode = '22023';
  end if;

  -- Treat p_anchor as local midnight in p_tz, truncate to period start,
  -- then convert back to UTC. Same for the exclusive upper bound.
  v_from := date_trunc(p_period, p_anchor::timestamp) at time zone p_tz;
  v_to   := (date_trunc(p_period, p_anchor::timestamp)
             + ('1 ' || p_period)::interval) at time zone p_tz;

  select
    coalesce(sum(case when kind = 'income'  then amount end), 0),
    coalesce(sum(case when kind = 'expense' then amount end), 0)
  into v_total_income, v_total_expense
  from public.transactions
  where occurred_at >= v_from and occurred_at < v_to;

  with agg as (
    select kind::text as kind_text,
           category_id,
           sum(amount)::numeric as total
    from public.transactions
    where occurred_at >= v_from and occurred_at < v_to
    group by kind, category_id
  )
  select jsonb_object_agg(kind_text, list)
  into v_by_category
  from (
    select a.kind_text,
           jsonb_agg(
             jsonb_build_object(
               'categoryId', a.category_id,
               'name',       c.name,
               'total',      a.total
             )
             order by a.total desc
           ) as list
    from   agg a
    join   public.categories c on c.id = a.category_id
    group  by a.kind_text
  ) s;

  -- ensure both kinds always present as arrays, even if zero transactions
  v_by_category := jsonb_build_object(
    'income',  coalesce(v_by_category -> 'income',  '[]'::jsonb),
    'expense', coalesce(v_by_category -> 'expense', '[]'::jsonb)
  );

  return jsonb_build_object(
    'from',         v_from,
    'to',           v_to,
    'totalIncome',  v_total_income,
    'totalExpense', v_total_expense,
    'net',          v_total_income - v_total_expense,
    'byCategory',   v_by_category
  );
end;
$$;

-- Allow authenticated role to call the function; RLS handles row scoping.
grant execute on function public.dashboard_totals(text, date, text) to authenticated;
