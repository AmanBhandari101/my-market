-- My Market — problems the apps report (run once in the Supabase SQL editor).
-- The apps can only ADD a row (no reading, no editing); staff read them in the SQL editor:
--   select * from public.app_errors order by at desc limit 50;
create table if not exists public.app_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  app     text check (app is null or length(app) <= 20),
  shop_id uuid,
  what    text not null check (length(what) <= 60),
  msg     text check (msg is null or length(msg) <= 600),
  ua      text check (ua is null or length(ua) <= 200)
);
alter table public.app_errors enable row level security;
drop policy if exists app_errors_add on public.app_errors;
create policy app_errors_add on public.app_errors for insert to anon, authenticated with check (true);
grant insert on public.app_errors to anon, authenticated;
create index if not exists app_errors_at_idx on public.app_errors (at desc);
