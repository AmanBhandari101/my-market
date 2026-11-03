-- My Market — database setup for Supabase (Postgres).
-- Run once: Supabase dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to re-run: it only creates what is missing and replaces functions/policies.
--
-- Rules this file enforces:
--   • A shop owner can read and write ONLY their own shop's data.
--   • Customers (not logged in) can read ONLY the public views:
--     shop name/address/hours and item name/brand/photo/price + a stock LABEL.
--     Costs, exact quantities, bills, purchases and profit never leave the shop.
--   • History is append-only: stock moves, bill lines and purchases can't be
--     edited or deleted from the app; a bill can only be marked cancelled.
--   • Every row id is made on the phone (uuid), so an offline bill that is sent
--     twice is saved once.

-- ============================================================ tables

create table if not exists public.markets (
  id          text primary key,
  name        text not null,
  area        text,
  locality    text,
  pincode     text,
  lat         double precision not null,
  lng         double precision not null,
  radius_m    integer not null default 350,
  pending     boolean not null default false,   -- a new area: listed once 3 shops join
  tagline     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  owner_name  text,
  phone       text,
  cat         text not null,
  cats        text[] not null default '{}',
  market_id   text references public.markets (id),
  shop_no     text,
  floor       text,
  landmark    text,
  locality    text,
  pincode     text,
  lat         double precision,
  lng         double precision,
  open_h      smallint not null default 10,
  close_h     smallint not null default 20,
  closed_day  text not null default 'None',
  promo       text check (promo is null or length(promo) <= 90),   -- small advert on bills
  gst         text,
  verified    boolean not null default false,  -- set by My Market staff only
  needs_check boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shops_owner_idx on public.shops (owner_id);
create index if not exists shops_geo_idx on public.shops (lat, lng);

create table if not exists public.items (
  id          uuid primary key,                 -- made on the phone
  shop_id     uuid not null references public.shops (id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  brand       text,
  cat         text not null,
  price       integer check (price is null or price >= 0),   -- selling price, ₹
  mrp         integer,
  cost        integer check (cost is null or cost >= 0),     -- PRIVATE
  reorder_at  integer not null default 3,
  photo_path  text,                             -- path in the item-photos bucket
  qty         integer,                          -- PRIVATE; kept by trigger from stock_moves; null = not counted
  stock_at    timestamptz,                      -- last stock change (freshness)
  removed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_shop_idx on public.items (shop_id);

-- Every +/− to stock. qty on items is rebuilt from this log, so moves that
-- arrive late or out of order (offline phones) still give the right count.
create table if not exists public.stock_moves (
  id          uuid primary key,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  item_id     uuid not null references public.items (id) on delete cascade,
  delta       integer not null,
  set_to      integer,                          -- a full count ("I have 12"); null = delta only
  reason      text not null check (reason in ('sold','order','received','returned','damaged','count','out')),
  ref         text,                             -- bill / purchase id that caused it
  device      text,
  at          timestamptz not null,             -- when it happened on the phone
  created_at  timestamptz not null default now()
);
create index if not exists stock_moves_item_idx on public.stock_moves (item_id, at);
create index if not exists stock_moves_shop_idx on public.stock_moves (shop_id, at);

create table if not exists public.bills (
  id            uuid primary key,
  shop_id       uuid not null references public.shops (id) on delete cascade,
  no            integer not null,               -- shop's running bill number
  at            timestamptz not null,
  sub           integer not null,
  discount      integer not null default 0,
  total         integer not null,
  units         integer not null,
  pay           text not null check (pay in ('cash','upi','card','khata')),
  phone         text,                           -- customer's number (optional)
  received      integer,
  cancelled_at  timestamptz,
  device        text,
  created_at    timestamptz not null default now()
);
create index if not exists bills_shop_idx on public.bills (shop_id, at desc);

create table if not exists public.bill_lines (
  id        uuid primary key,
  bill_id   uuid not null references public.bills (id) on delete cascade,
  shop_id   uuid not null references public.shops (id) on delete cascade,
  item_id   uuid references public.items (id) on delete set null,   -- null = "item not in list"
  name      text not null,
  brand     text,
  qty       integer not null check (qty > 0),
  price     integer not null check (price >= 0),
  cost      integer
);
create index if not exists bill_lines_bill_idx on public.bill_lines (bill_id);
create index if not exists bill_lines_shop_idx on public.bill_lines (shop_id);

create table if not exists public.purchases (
  id          uuid primary key,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  at          timestamptz not null,
  supplier    text,
  pay         text not null check (pay in ('cash','upi','credit')),
  total       integer not null default 0,
  device      text,
  created_at  timestamptz not null default now()
);
create index if not exists purchases_shop_idx on public.purchases (shop_id, at desc);

create table if not exists public.purchase_lines (
  id           uuid primary key,
  purchase_id  uuid not null references public.purchases (id) on delete cascade,
  shop_id      uuid not null references public.shops (id) on delete cascade,
  item_id      uuid not null references public.items (id) on delete cascade,
  name         text not null,
  qty          integer not null check (qty > 0),
  cost         integer
);
create index if not exists purchase_lines_purchase_idx on public.purchase_lines (purchase_id);

-- ============================================================ stock count from the log

create or replace function public.recount_item(p_item uuid)
returns void language sql security definer set search_path = public as $$
  with last_set as (
    select set_to, at from stock_moves
    where item_id = p_item and set_to is not null
    order by at desc, created_at desc limit 1
  ),
  since_set as (
    select coalesce(sum(m.delta), 0) as d, max(m.at) as last_at
    from stock_moves m
    where m.item_id = p_item and m.set_to is null
      and (not exists (select 1 from last_set) or m.at > (select at from last_set))
  ),
  any_move as (select max(at) as last_at from stock_moves where item_id = p_item)
  update items i set
    qty = case
            when (select last_at from any_move) is null then i.qty
            else greatest(0, coalesce((select set_to from last_set), 0) + (select d from since_set))
          end,
    stock_at = coalesce((select last_at from any_move), i.stock_at),
    updated_at = now()
  where i.id = p_item;
$$;

create or replace function public.stock_moves_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recount_item(new.item_id);
  return null;
end $$;

drop trigger if exists stock_moves_recount on public.stock_moves;
create trigger stock_moves_recount after insert on public.stock_moves
  for each row execute function public.stock_moves_after_insert();

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops for each row execute function public.touch_updated_at();
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- ============================================================ privacy rules (row level security)

alter table public.markets        enable row level security;
alter table public.shops          enable row level security;
alter table public.items          enable row level security;
alter table public.stock_moves    enable row level security;
alter table public.bills          enable row level security;
alter table public.bill_lines     enable row level security;
alter table public.purchases      enable row level security;
alter table public.purchase_lines enable row level security;

-- "is this my shop?" — used by every policy below
create or replace function public.is_my_shop(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and owner_id = auth.uid());
$$;

-- markets: everyone may read; a logged-in shop may add a new (pending) area
drop policy if exists markets_read on public.markets;
create policy markets_read on public.markets for select using (true);
drop policy if exists markets_add on public.markets;
create policy markets_add on public.markets for insert to authenticated with check (pending = true);

-- shops: an owner sees and edits only their own shop (customers use public_shops)
drop policy if exists shops_own_read on public.shops;
create policy shops_own_read on public.shops for select to authenticated using (owner_id = auth.uid());
drop policy if exists shops_own_add on public.shops;
create policy shops_own_add on public.shops for insert to authenticated with check (owner_id = auth.uid() and verified = false);
drop policy if exists shops_own_edit on public.shops;
create policy shops_own_edit on public.shops for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- shop-owned tables: same rule everywhere
do $$
declare t text;
begin
  foreach t in array array['items','stock_moves','bills','bill_lines','purchases','purchase_lines'] loop
    execute format('drop policy if exists %1$s_own_read on public.%1$s', t);
    execute format('create policy %1$s_own_read on public.%1$s for select to authenticated using (public.is_my_shop(shop_id))', t);
    execute format('drop policy if exists %1$s_own_add on public.%1$s', t);
    execute format('create policy %1$s_own_add on public.%1$s for insert to authenticated with check (public.is_my_shop(shop_id))', t);
  end loop;
end $$;

drop policy if exists items_own_edit on public.items;
create policy items_own_edit on public.items for update to authenticated using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));
drop policy if exists bills_own_cancel on public.bills;
create policy bills_own_cancel on public.bills for update to authenticated using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));

-- append-only history: the app may add rows, never change or delete them
revoke update, delete on public.stock_moves, public.bill_lines, public.purchases, public.purchase_lines from anon, authenticated;
revoke delete on public.bills, public.items, public.shops from anon, authenticated;
revoke update on public.bills from anon, authenticated;
grant update (cancelled_at) on public.bills to authenticated;          -- cancelling is the only edit
-- Column rules only work once the table-wide right is taken away, so: take it
-- away, then give back exactly the columns the app may change.
revoke update on public.items from anon, authenticated;                -- stock (qty, stock_at) only moves via stock_moves
grant update (name, brand, cat, price, mrp, cost, reorder_at, photo_path, removed) on public.items to authenticated;
revoke update on public.shops from anon, authenticated;                -- verified / needs_check are staff-only
grant update (name, owner_name, phone, cat, cats, market_id, shop_no, floor, landmark, locality, pincode,
              lat, lng, open_h, close_h, closed_day, promo, gst) on public.shops to authenticated;

-- ============================================================ what customers can see

-- Views run as their owner, so they show these columns to anyone while the
-- tables themselves stay locked. Only safe columns are listed here.
create or replace view public.public_shops as
  select s.id, s.name, s.cat, s.cats, s.market_id, s.shop_no, s.floor, s.landmark,
         s.locality, s.pincode, s.lat, s.lng, s.open_h, s.close_h, s.closed_day,
         s.phone, s.verified, s.promo
  from public.shops s;

create or replace view public.public_items as
  select i.id, i.shop_id, i.name, i.brand, i.cat, i.price, i.mrp, i.photo_path,
         case
           when i.qty is null then 'listed'                                 -- shop doesn't count it yet
           when i.qty <= 0 then 'out'
           when i.stock_at is null or i.stock_at < now() - interval '7 days' then 'listed'  -- not fresh
           when i.qty <= greatest(1, i.reorder_at) then 'few'
           else 'in'
         end as stock,
         i.stock_at as updated_at
  from public.items i
  where not i.removed;

grant select on public.public_shops, public.public_items to anon, authenticated;

-- Nearby shops for the customer app (straight-line km; the app adds travel time).
create or replace function public.shops_near(p_lat double precision, p_lng double precision, p_km double precision default 5)
returns table (id uuid, name text, cat text, market_id text, lat double precision, lng double precision, km double precision)
language sql stable security definer set search_path = public as $$
  select * from (
    select s.id, s.name, s.cat, s.market_id, s.lat, s.lng,
           6371 * 2 * asin(sqrt(
             power(sin(radians(s.lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
           )) as km
    from shops s
    where s.lat between p_lat - p_km / 111.0 and p_lat + p_km / 111.0
  ) x where x.km <= p_km order by x.km limit 200;
$$;
grant execute on function public.shops_near(double precision, double precision, double precision) to anon, authenticated;

-- ============================================================ item photos

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 200000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Photos are stored as <shop id>/<item id>.jpg; only that shop can upload or replace them.
drop policy if exists item_photos_upload on storage.objects;
create policy item_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and public.is_my_shop(((storage.foldername(name))[1])::uuid));
drop policy if exists item_photos_replace on storage.objects;
create policy item_photos_replace on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and public.is_my_shop(((storage.foldername(name))[1])::uuid));

-- ============================================================ pilot markets (Karol Bagh)

insert into public.markets (id, name, area, locality, pincode, lat, lng, radius_m, tagline) values
  ('gaffar', 'Gaffar Market', 'Karol Bagh', 'Karol Bagh', '110005', 28.6519, 77.1907, 350, 'Mobiles, accessories & electronics'),
  ('ajmal',  'Ajmal Khan Road', 'Karol Bagh', 'Karol Bagh', '110005', 28.6487, 77.1923, 350, 'Clothes, footwear & household'),
  ('beadon', 'Beadonpura Hardware Bazaar', 'Karol Bagh', 'Karol Bagh', '110005', 28.6547, 77.1876, 350, 'Hardware, plumbing & electrical')
on conflict (id) do nothing;
