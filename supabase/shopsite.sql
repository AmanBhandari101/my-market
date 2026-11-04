-- My Market — shop website details: logo, cover photo, gallery, about, payments, delivery.
-- Run after schema.sql. Safe to re-run. Photos live in the item-photos bucket under
-- the shop's own folder (<shop id>/…), which only that shop can upload to.

alter table public.shops add column if not exists logo_path   text;
alter table public.shops add column if not exists cover_path  text;
alter table public.shops add column if not exists gallery     text[] not null default '{}';
alter table public.shops add column if not exists about       text;
alter table public.shops add column if not exists pay_methods text[] not null default '{}';
alter table public.shops add column if not exists delivery    boolean not null default false;

do $$ begin
  alter table public.shops add constraint shops_about_len check (about is null or length(about) <= 600);
exception when duplicate_object then null; end $$;

grant update (logo_path, cover_path, gallery, about, pay_methods, delivery) on public.shops to authenticated;

-- customers' view of a shop, now with the website details (new columns at the end)
create or replace view public.public_shops as
  select s.id, s.name, s.cat, s.cats, s.market_id, s.shop_no, s.floor, s.landmark,
         s.locality, s.pincode, s.lat, s.lng, s.open_h, s.close_h, s.closed_day,
         s.phone, s.verified, s.promo,
         s.logo_path, s.cover_path, s.gallery, s.about, s.pay_methods, s.delivery
  from public.shops s;
grant select on public.public_shops to anon, authenticated;
