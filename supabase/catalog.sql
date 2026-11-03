-- My Market — shared product catalogue (run after schema.sql). Safe to re-run.
--
-- One row per product (not per shop). The first shop that adds "Havells MCB 32A"
-- fills in its details; every other shop that scans the same barcode gets them.
-- A shop's own price, cost and stock stay on its items row; items.product_id links
-- the two. Facts only: details come from the pack, a barcode database or the shop.
--
-- Rules:
--   • Everyone can read the catalogue (it's public product information).
--   • A logged-in shop can add products.
--   • Only the shop that added a product can edit it, and only until it is
--     verified — so one shop can't quietly change what other shops show.

create table if not exists public.catalog_products (
  id           uuid primary key,
  barcode      text unique check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  name         text not null check (length(name) between 1 and 120),
  brand        text,
  model        text,
  cat          text not null,
  size         text,                           -- net quantity / size, as printed: "1 kg", "32 A", "1 inch"
  mrp          integer check (mrp is null or mrp >= 0),
  features     text[] not null default '{}',   -- 3–5 short points
  description  text check (description is null or length(description) <= 1000),
  specs        jsonb not null default '{}'::jsonb,  -- {"Material": "Brass", "Warranty": "1 year (printed)"}
  keywords     text[] not null default '{}',   -- other words people search with: "nal", "tonti"
  photo_path   text,                           -- our own photo in the item-photos bucket
  photo_url    text,                           -- or an openly licensed photo (e.g. Open Food Facts)
  photo_credit text,                           -- shown under that photo
  source       text not null default 'shop' check (source in ('shop', 'openfoodfacts', 'ai', 'gs1')),
  created_by   uuid references public.shops (id) on delete set null,
  verified     boolean not null default false, -- set by My Market staff only
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists catalog_products_name_idx on public.catalog_products (lower(name));

drop trigger if exists catalog_products_touch on public.catalog_products;
create trigger catalog_products_touch before update on public.catalog_products
  for each row execute function public.touch_updated_at();

alter table public.catalog_products enable row level security;
drop policy if exists catalog_read on public.catalog_products;
create policy catalog_read on public.catalog_products for select using (true);
drop policy if exists catalog_add on public.catalog_products;
create policy catalog_add on public.catalog_products for insert to authenticated
  with check (verified = false and created_by is not null and public.is_my_shop(created_by));
drop policy if exists catalog_edit on public.catalog_products;
create policy catalog_edit on public.catalog_products for update to authenticated
  using (verified = false and public.is_my_shop(created_by))
  with check (verified = false and public.is_my_shop(created_by));
revoke delete on public.catalog_products from anon, authenticated;
revoke update on public.catalog_products from anon, authenticated;
grant update (barcode, name, brand, model, cat, size, mrp, features, description, specs, keywords, photo_path, photo_url, photo_credit)
  on public.catalog_products to authenticated;

-- link a shop's item to a catalogue product
alter table public.items add column if not exists product_id uuid references public.catalog_products (id) on delete set null;
grant update (product_id) on public.items to authenticated;

-- Customers' view of items now carries the product details (new columns added at the end).
create or replace view public.public_items as
  select i.id, i.shop_id, i.name, i.brand, i.cat, i.price, i.mrp, i.photo_path,
         case
           when i.qty is null then 'listed'
           when i.qty <= 0 then 'out'
           when i.stock_at is null or i.stock_at < now() - interval '7 days' then 'listed'
           when i.qty <= greatest(1, i.reorder_at) then 'few'
           else 'in'
         end as stock,
         i.stock_at as updated_at,
         i.product_id, p.barcode, p.model, p.size, p.features, p.description, p.specs, p.keywords,
         p.mrp as product_mrp, p.photo_path as product_photo_path, p.photo_url as product_photo_url, p.photo_credit
  from public.items i
  left join public.catalog_products p on p.id = i.product_id
  where not i.removed;

grant select on public.public_items to anon, authenticated;
