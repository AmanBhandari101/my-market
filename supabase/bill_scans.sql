-- My Market — reading supplier bills from a photo (cloudflare/bills-worker.js). Safe to re-run.
--
-- One row per bill a shop asks the worker to read: when, which AI model, how many tokens it
-- used, and whether it worked. No photo and no bill content is kept. Each shop can read up to
-- bill_scan_limit() bills per calendar month (India time); change the number there.
--
-- Cost check (staff, SQL editor):
--   select date_trunc('month', at) m, count(*) bills, sum(tok_in) tok_in, sum(tok_out) tok_out
--     from public.bill_scans group by 1 order by 1 desc;

create table if not exists public.bill_scans (
  id       uuid primary key default gen_random_uuid(),
  shop_id  uuid not null references public.shops (id) on delete cascade,
  at       timestamptz not null default now(),
  status   text not null default 'started' check (status in ('started', 'ok', 'failed')),
  model    text,
  tok_in   integer not null default 0,
  tok_out  integer not null default 0,
  problem  text
);
create index if not exists bill_scans_shop_at_idx on public.bill_scans (shop_id, at desc);
alter table public.bill_scans enable row level security;
revoke all on public.bill_scans from anon, authenticated;

create or replace function public.bill_scan_limit() returns integer language sql immutable as $$ select 30 $$;

-- called by the worker with the shopkeeper's own login: counts this bill, refuses past the limit
create or replace function public.bill_scan_start(p_shop uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  used integer;
  new_id uuid;
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  perform 1 from shops where id = p_shop for update;                 -- one bill at a time per shop
  select count(*) into used from bill_scans
   where shop_id = p_shop
     and at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  if used >= bill_scan_limit() then
    raise exception 'You have read % bills this month — the limit is %. It starts again on the 1st.', used, bill_scan_limit();
  end if;
  insert into bill_scans (shop_id) values (p_shop) returning id into new_id;
  return json_build_object('id', new_id, 'used', used + 1, 'limit', bill_scan_limit());
end $$;

-- the worker records the result. Every attempt counts against the limit, failed ones too: the worker
-- calls this with the shopkeeper's own login, so a refund here could be faked to get past the limit.
create or replace function public.bill_scan_finish(p_id uuid, p_ok boolean, p_model text, p_in integer, p_out integer, p_problem text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bill_scans set status = case when p_ok then 'ok' else 'failed' end, model = left(p_model, 60),
         tok_in = greatest(0, coalesce(p_in, 0)), tok_out = greatest(0, coalesce(p_out, 0)), problem = left(p_problem, 200)
   where id = p_id and status = 'started' and is_my_shop(shop_id);
end $$;

-- the app shows "12 of 30 bills read this month"
create or replace function public.bill_scans_used(p_shop uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('used', count(*), 'limit', bill_scan_limit())
    from bill_scans
   where shop_id = p_shop and is_my_shop(p_shop)
     and at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

revoke execute on function public.bill_scan_start(uuid), public.bill_scan_finish(uuid, boolean, text, integer, integer, text),
  public.bill_scans_used(uuid) from public, anon;
grant execute on function public.bill_scan_start(uuid), public.bill_scan_finish(uuid, boolean, text, integer, integer, text),
  public.bill_scans_used(uuid) to authenticated;
