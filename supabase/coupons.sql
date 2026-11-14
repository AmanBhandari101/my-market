-- My Market — coupon codes for a lifetime free plan (after billing.sql + billing_v2.sql). Safe to re-run.
--
-- A coupon makes a shop free for life: its plan is paid till 31 Dec 2099 and the app shows
-- "Free for life". Each coupon works for a limited number of shops (default 3). The server
-- counts and locks, so a 4th shop is refused even if several try at the same moment.
-- Wrong codes are limited to 5 tries per shop per hour, so codes can't be guessed.
--
-- The coupon codes themselves are NOT in this file (the repo is public). Staff add them in the
-- SQL editor:
--   insert into public.coupons (code, max_uses, note) values ('MYCODE123', 3, 'pilot shops');
--   select c.code, c.max_uses, count(r.shop_id) used from public.coupons c
--     left join public.coupon_redemptions r on r.code = c.code group by c.code, c.max_uses;   -- who used what
--   update public.coupons set active = false where code = 'MYCODE123';                       -- stop a code

create table if not exists public.coupons (
  code       text primary key check (code ~ '^[A-Z0-9-]{4,40}$'),
  kind       text not null default 'lifetime' check (kind in ('lifetime')),
  max_uses   integer not null default 3 check (max_uses between 1 and 1000),
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);
create table if not exists public.coupon_redemptions (
  shop_id uuid primary key references public.shops (id) on delete cascade,   -- one coupon per shop
  code    text not null references public.coupons (code),
  at      timestamptz not null default now()
);
create index if not exists coupon_redemptions_code_idx on public.coupon_redemptions (code);
create table if not exists public.coupon_tries (            -- wrong codes, for the guess limit
  shop_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists coupon_tries_idx on public.coupon_tries (shop_id, at desc);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_tries enable row level security;
revoke all on public.coupons, public.coupon_redemptions, public.coupon_tries from anon, authenticated;

-- the plan as the apps see it: same as billing_v2.sql, plus "lifetime" for coupon shops
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
      when now() < access_until + interval '15 days' then 'orders_off'
      else 'read_only' end,
    'lifetime', exists (select 1 from coupon_redemptions r where r.shop_id = p_shop),
    'server_now', now(),
    'price_month', 150, 'price_year', 1500)
  from a;
$$;
revoke execute on function public.plan_state(uuid) from public, anon, authenticated;

-- the shop types a coupon code in the app
create or replace function public.redeem_coupon(p_shop uuid, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g'));
  cp  coupons;
  used integer;
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  if exists (select 1 from coupon_redemptions where shop_id = p_shop) then
    raise exception 'Your shop is already free for life';
  end if;
  if (select count(*) from coupon_tries where shop_id = p_shop and at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many wrong codes — try again in an hour';
  end if;
  select * into cp from coupons where code = c for update;          -- one shop at a time per code
  if not found or not cp.active then
    -- returned, not raised: an error would roll back this record and the guess limit with it
    insert into coupon_tries (shop_id) values (p_shop);
    return json_build_object('error', 'This coupon code isn''t valid');
  end if;
  select count(*) into used from coupon_redemptions where code = c;
  if used >= cp.max_uses then
    raise exception 'This coupon has already been used by % shops', cp.max_uses;
  end if;
  insert into coupon_redemptions (shop_id, code) values (p_shop, c);
  update shop_plans set paid_until = greatest(coalesce(paid_until, now()), timestamptz '2099-12-31 23:59:59+05:30'),
         note = 'Lifetime free (coupon ' || c || ')', updated_at = now()
   where shop_id = p_shop;
  if not found then
    insert into shop_plans (shop_id, trial_ends_at, paid_until, note)
    values (p_shop, now(), timestamptz '2099-12-31 23:59:59+05:30', 'Lifetime free (coupon ' || c || ')');
  end if;
  return plan_state(p_shop);
end $$;
revoke execute on function public.redeem_coupon(uuid, text) from public, anon;
grant execute on function public.redeem_coupon(uuid, text) to authenticated;
