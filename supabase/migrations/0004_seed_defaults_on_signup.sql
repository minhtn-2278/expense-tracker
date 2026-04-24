-- 0004_seed_defaults_on_signup.sql
--
-- Bundle the entire app-side signup handoff into one trigger on auth.users,
-- running inside the same transaction as the user insert:
--   1. mirror the auth.users row into public.profiles
--   2. seed 10 default Vietnamese categories (2 income + 8 expense)
--
-- Together these establish the invariants:
--   - every authenticated user has a profile row
--   - every new user can start logging transactions immediately
--
-- `security definer` is scoped tightly: the function only writes to
-- public.profiles and public.categories using new.id / new.email as input.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.categories (user_id, name, kind) values
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
