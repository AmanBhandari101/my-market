-- My Market — shop plan: 2 months free, then ₹150 a month (or ₹1,500 a year). Safe to re-run.
--
-- Every shop gets a free trial of 60 days (one trial per mobile number, ever).
-- The shop pays by UPI to My Market's UPI ID and types the transaction ID (UTR);
-- that claim gives 3 days of access while My Market checks it in the bank app, then
-- confirm_payment() adds the months. Later, a payment gateway (UPI AutoPay) can call
-- the same confirm step from its webhook.
--
-- When access runs out nothing is deleted:
--   days 1–7   "due"         everything works, reminders
--   days 8–14  "orders_off"  the shop's website stops taking orders
--   after 14   "read_only"   no new bills/stock; old bills, backup and export still work
--
-- Staff commands (run here in the SQL editor — they can't be called from the apps):
--   select * from public.payments where status = 'claimed' order by created_at;   -- to check
--   select public.confirm_payment('<payment id>');                                 -- money received
--   select public.reject_payment('<payment id>', 'UTR not found');                 -- not received
--   select public.grant_months('<shop id>', 2, 'pilot partner');                   -- free months

create table if not exists public.shop_plans (
  shop_id        uuid primary key references public.shops (id) on delete cascade,
  trial_ends_at  timestamptz not null,
  paid_until     timestamptz,
  note           text,
  updated_at     timestamptz not null default now()
);
create table if not exists public.trial_numbers (     -- one free trial per mobile number
  phone   text primary key,
  shop_id uuid,
  at      timestamptz not null default now()
);
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  amount        integer not null check (amount > 0),
  months        integer not null check (months between 1 and 24),
  method        text not null default 'upi' check (method in ('upi', 'gateway', 'grant')),
  ref           text check (ref is null or length(ref) <= 40),     -- UPI transaction ID (UTR)
  status        text not null default 'claimed' check (status in ('claimed', 'confirmed', 'rejected')),
  reason        text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index if not exists payments_shop_idx on public.payments (shop_id, created_at desc);
create unique index if not exists payments_ref_idx on public.payments (ref) where ref is not null and status <> 'rejected';

alter table public.shop_plans enable row level security;
alter table public.trial_numbers enable row level security;
alter table public.payments enable row level security;
revoke all on public.shop_plans, public.trial_numbers, public.payments from anon, authenticated;
grant select on public.payments to authenticated;
drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments for select to authenticated using (public.is_my_shop(shop_id));

-- a new shop starts its trial (no trial if this number already had one)
create or replace function public.shops_start_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare ph text := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10); had boolean := false;
begin
  if ph ~ '^[0-9]{10}$' then
    select true into had from trial_numbers where phone = ph;
    if not coalesce(had, false) then insert into trial_numbers (phone, shop_id) values (ph, new.id) on conflict do nothing; end if;
  end if;
  insert into shop_plans (shop_id, trial_ends_at)
  values (new.id, case when coalesce(had, false) then now() else now() + interval '60 days' end)
  on conflict (shop_id) do nothing;
  return new;
end $$;
drop trigger if exists shops_start_plan on public.shops;
create trigger shops_start_plan after insert on public.shops for each row execute function public.shops_start_plan();

-- shops that exist already: 60 days from when they joined, and at least 30 days from today
insert into public.shop_plans (shop_id, trial_ends_at)
  select s.id, greatest(s.created_at + interval '60 days', now() + interval '30 days') from public.shops s
on conflict (shop_id) do nothing;
insert into public.trial_numbers (phone, shop_id)
  select right(regexp_replace(s.phone, '\D', '', 'g'), 10), s.id from public.shops s
  where right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 10) ~ '^[0-9]{10}$'
on conflict do nothing;

-- the plan as the apps see it
create or replace function public.plan_state(p_shop uuid)
returns json language sql stable security definer set search_path = public as $$
  with p as (
    select sp.trial_ends_at, sp.paid_until,
           (select max(created_at) + interval '3 days' from payments
             where shop_id = p_shop and status = 'claimed') as provisional_until
    from shop_plans sp where sp.shop_id = p_shop
  ), a as (
    select *, greatest(trial_ends_at, coalesce(paid_until, '-infinity'), coalesce(provisional_until, '-infinity')) as access_until from p
  )
  select json_build_object(
    'trial_ends_at', trial_ends_at, 'paid_until', paid_until, 'provisional_until', provisional_until, 'access_until', access_until,
    'state', case
      when now() < access_until then case when coalesce(paid_until, '-infinity') > now() or coalesce(provisional_until, '-infinity') > now() then 'active' else 'trial' end
      when now() < access_until + interval '7 days' then 'due'
      when now() < access_until + interval '14 days' then 'orders_off'
      else 'read_only' end,
    'price_month', 150, 'price_year', 1500)
  from a;
$$;
create or replace function public.my_plan(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  return plan_state(p_shop);
end $$;

-- the shop says "I paid": counts for 3 days while My Market checks it
create or replace function public.claim_payment(p_shop uuid, p_ref text, p_months integer)
returns json language plpgsql security definer set search_path = public as $$
declare r text := upper(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9]', '', 'g')); n integer;
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  if p_months not in (1, 12) then raise exception 'Choose 1 month or 1 year'; end if;
  if length(r) < 10 or length(r) > 40 then raise exception 'Type the UPI transaction ID (UTR) — 12 digits, shown in your UPI app after paying'; end if;
  if exists (select 1 from payments where ref = r and status <> 'rejected') then raise exception 'This transaction ID was already sent'; end if;
  select count(*) into n from payments where shop_id = p_shop and status = 'claimed';
  if n >= 2 then raise exception 'Your earlier payment is still being checked — it is usually done within a day'; end if;
  insert into payments (shop_id, amount, months, method, ref) values (p_shop, case when p_months = 12 then 1500 else 150 end, p_months, 'upi', r);
  return plan_state(p_shop);
end $$;

-- staff only (SQL editor): money received / not received / free months
create or replace function public.confirm_payment(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare pay payments;
begin
  update payments set status = 'confirmed', decided_at = now() where id = p_id and status = 'claimed' returning * into pay;
  if not found then raise exception 'No claimed payment with that id'; end if;
  update shop_plans set paid_until = greatest(coalesce(paid_until, now()), trial_ends_at, now()) + make_interval(months => pay.months), updated_at = now()
   where shop_id = pay.shop_id;
  return plan_state(pay.shop_id);
end $$;
create or replace function public.reject_payment(p_id uuid, p_reason text default 'Payment not received')
returns void language sql security definer set search_path = public as $$
  update payments set status = 'rejected', reason = p_reason, decided_at = now() where id = p_id and status = 'claimed';
$$;
create or replace function public.grant_months(p_shop uuid, p_months integer, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
begin
  insert into payments (shop_id, amount, months, method, status, reason, decided_at) values (p_shop, 1, p_months, 'grant', 'confirmed', p_note, now());
  update shop_plans set paid_until = greatest(coalesce(paid_until, now()), trial_ends_at, now()) + make_interval(months => p_months),
         note = coalesce(p_note, note), updated_at = now() where shop_id = p_shop;
  return plan_state(p_shop);
end $$;

revoke execute on function public.plan_state(uuid), public.my_plan(uuid), public.claim_payment(uuid, text, integer),
  public.confirm_payment(uuid), public.reject_payment(uuid, text), public.grant_months(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.my_plan(uuid), public.claim_payment(uuid, text, integer) to authenticated;

-- an overdue shop's website stops taking orders (everything else keeps working)
create or replace function public.shop_takes_orders(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((plan_state(p_shop) ->> 'state') not in ('orders_off', 'read_only'), true);
$$;
revoke execute on function public.shop_takes_orders(uuid) from public;
-- customers' shop list (below) calls it, so they may: it only says yes/no for a shop
grant execute on function public.shop_takes_orders(uuid) to anon, authenticated;

-- customers' view of a shop also says whether its website takes orders right now
create or replace view public.public_shops as
  select s.id, s.name, s.cat, s.cats, s.market_id, s.shop_no, s.floor, s.landmark,
         s.locality, s.pincode, s.lat, s.lng, s.open_h, s.close_h, s.closed_day,
         s.phone, s.verified, s.promo,
         s.logo_path, s.cover_path, s.gallery, s.about, s.pay_methods, s.delivery,
         public.shop_takes_orders(s.id) as takes_orders
  from public.shops s;
grant select on public.public_shops to anon, authenticated;
