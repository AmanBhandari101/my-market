-- My Market — pages Google can read (run once in the Supabase SQL editor, after all the other files).
--
-- Adds:
--   shops.slug                 permanent link name: /shop/sharma-electricals-karol-bagh (set once, never changes)
--   seo_shop(slug)             everything one shop page needs, in one call
--   seo_area_product(a, p)     one product in one area (locality) and the shops that have it
--   seo_sitemap(kind, page)    the links Google should crawl, 45,000 per page
--   seo_sitemap_counts()       how many sitemap pages there are
--   visit sources 'google' and 'web' (people who arrive from search engines / the new site)
--
-- Only public data is returned: the same columns customers already read through public_shops and public_items.

-- ---------- link names ----------
create or replace function public.slugify(t text)
returns text language sql immutable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- product link name: "philips-9w-led-bulb-9d6e77e2" (name + size + the first 8 characters of the id)
create or replace function public.product_slug(p_name text, p_size text, p_id uuid)
returns text language sql immutable set search_path = public as $$
  select concat_ws('-', nullif(rtrim(left(public.slugify(p_name || case when p_size is null or position(lower(p_size) in lower(p_name)) > 0 then '' else ' ' || p_size end), 70), '-'), ''),
                   left(p_id::text, 8));
$$;

alter table public.shops add column if not exists slug text;
create unique index if not exists shops_slug_key on public.shops (slug);

-- A new shop gets its link name once. Renaming the shop keeps the old link working (it never changes).
create or replace function public.shop_slug_set()
returns trigger language plpgsql security definer set search_path = public as $$
declare base text; cand text; n integer := 1;
begin
  if tg_op = 'UPDATE' and old.slug is not null then new.slug := old.slug; return new; end if;   -- never changes
  -- a new shop never chooses its own link name: it is always made here
  base := left(public.slugify(new.name || ' ' || coalesce(new.locality, '')), 60);
  if length(base) < 3 then base := 'shop-' || left(new.id::text, 8); end if;                  -- e.g. a name only in Hindi
  cand := base;
  while exists (select 1 from public.shops where slug = cand and id <> new.id) loop
    n := n + 1; cand := base || '-' || n;
  end loop;
  new.slug := cand;
  return new;
end $$;
drop trigger if exists shops_slug on public.shops;
create trigger shops_slug before insert or update on public.shops
  for each row execute function public.shop_slug_set();

-- existing shops: give each one its link name (one at a time, so two shops can't pick the same name)
do $$ declare r record; begin
  for r in select id from public.shops where slug is null order by created_at loop
    update public.shops set slug = null where id = r.id;
  end loop;
end $$;

-- items are looked up by product for area pages
create index if not exists items_product_idx on public.items (product_id) where product_id is not null;

-- customers' view of a shop now carries its link name (same columns as before, slug added at the end)
create or replace view public.public_shops as
  select s.id, s.name, s.cat, s.cats, s.market_id, s.shop_no, s.floor, s.landmark,
         s.locality, s.pincode, s.lat, s.lng, s.open_h, s.close_h, s.closed_day,
         s.phone, s.verified, s.promo,
         s.logo_path, s.cover_path, s.gallery, s.about, s.pay_methods, s.delivery,
         public.shop_takes_orders(s.id) as takes_orders,
         s.slug
  from public.shops s;
grant select on public.public_shops to anon, authenticated;

-- ---------- quality gate ----------
-- A shop page is offered to Google only when it is worth landing on: a place on the map,
-- an area name, at least 5 listed items, and a website that is switched on.
create or replace function public.seo_shop_ok(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.public_shops s
    where s.id = p_shop and s.lat is not null and coalesce(s.locality, '') <> '' and s.takes_orders
      and (select count(*) from public.public_items i where i.shop_id = s.id) >= 5);
$$;

-- ---------- one shop page ----------
create or replace function public.seo_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shop', to_jsonb(s),
    'index', public.seo_shop_ok(s.id),
    'market', (select jsonb_build_object('name', m.name, 'pending', m.pending) from public.markets m where m.id = s.market_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'name', i.name, 'brand', i.brand, 'cat', i.cat, 'price', i.price,
               'mrp', coalesce(i.mrp, i.product_mrp), 'stock', i.stock, 'size', i.size, 'barcode', i.barcode,
               'photo_path', coalesce(i.photo_path, i.product_photo_path), 'photo_url', i.product_photo_url,
               -- link to the area page for this product, when that page exists
               'p', case when i.product_id is not null and i.stock in ('in', 'few') and coalesce(s.locality, '') <> ''
                         then '/p/' || public.slugify(s.locality) || '/' || public.product_slug(p.name, p.size, p.id) end)
             order by (i.stock in ('in', 'few')) desc, i.name)
      from (select * from public.public_items where shop_id = s.id order by (stock in ('in', 'few')) desc, name limit 300) i
      left join public.catalog_products p on p.id = i.product_id), '[]'::jsonb))
  from public.public_shops s
  where s.slug = p_slug;
$$;

-- ---------- one product in one area ----------
-- p_product is a product_slug: the last 8 characters are the start of the product id.
create or replace function public.seo_area_product(p_area text, p_product text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pre text := right(coalesce(p_product, ''), 8); prod public.catalog_products; res jsonb;
begin
  if pre !~ '^[0-9a-f]{8}$' then return null; end if;
  select * into prod from public.catalog_products
   where id between (pre || '-0000-0000-0000-000000000000')::uuid and (pre || '-ffff-ffff-ffff-ffffffffffff')::uuid
   limit 1;
  if prod.id is null then return null; end if;
  select jsonb_agg(jsonb_build_object(
           'shop_id', s.id, 'slug', s.slug, 'name', s.name, 'cat', s.cat, 'locality', s.locality, 'landmark', s.landmark,
           'shop_no', s.shop_no, 'pincode', s.pincode, 'lat', s.lat, 'lng', s.lng, 'phone', s.phone,
           'open_h', s.open_h, 'close_h', s.close_h, 'closed_day', s.closed_day, 'logo_path', s.logo_path,
           'item_id', i.id, 'item_name', i.name, 'price', i.price, 'mrp', coalesce(i.mrp, i.product_mrp),
           'stock', i.stock, 'updated_at', i.updated_at, 'photo_path', i.photo_path)
         order by (i.stock in ('in', 'few')) desc, i.price nulls last)
    into res
    from public.public_items i
    join public.public_shops s on s.id = i.shop_id
   where i.product_id = prod.id and public.slugify(s.locality) = p_area and s.takes_orders and i.stock <> 'out';
  return jsonb_build_object(
    'product', jsonb_build_object('id', prod.id, 'name', prod.name, 'brand', prod.brand, 'model', prod.model, 'cat', prod.cat,
                                  'size', prod.size, 'mrp', prod.mrp, 'barcode', prod.barcode, 'features', prod.features,
                                  'description', prod.description, 'specs', prod.specs, 'keywords', prod.keywords,
                                  'photo_path', prod.photo_path, 'photo_url', prod.photo_url, 'photo_credit', prod.photo_credit,
                                  'slug', public.product_slug(prod.name, prod.size, prod.id)),
    'offers', coalesce(res, '[]'::jsonb),
    -- the page is offered to Google only while at least one shop there has it in stock (updated within 7 days)
    'index', exists (select 1 from jsonb_array_elements(coalesce(res, '[]'::jsonb)) as o(v) where o.v ->> 'stock' in ('in', 'few')));
end $$;

-- ---------- sitemaps ----------
create or replace function public.seo_sitemap(p_kind text, p_page integer default 1)
returns table (path text, lastmod timestamptz) language sql stable security definer set search_path = public as $$
  with shops as (
    select '/shop/' || s.slug as u, greatest(s.updated_at, (select max(i.stock_at) from public.items i where i.shop_id = s.id)) as m
    from public.shops s
    where p_kind = 'shops' and s.slug is not null and public.seo_shop_ok(s.id)
  ), products as (
    select '/p/' || public.slugify(s.locality) || '/' || public.product_slug(p.name, p.size, p.id) as u, max(i.updated_at) as m
    from public.public_items i
    join public.public_shops s on s.id = i.shop_id
    join public.catalog_products p on p.id = i.product_id
    where p_kind = 'products' and i.product_id is not null and i.stock in ('in', 'few')
      and coalesce(s.locality, '') <> '' and s.takes_orders
    group by 1
  )
  select x.u, x.m from (select * from shops union all select * from products) x
  order by x.u
  offset greatest(p_page - 1, 0) * 45000 limit 45000;
$$;

create or replace function public.seo_sitemap_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shops', (select count(*) from public.shops s where s.slug is not null and public.seo_shop_ok(s.id)),
    'products', (select count(distinct (public.slugify(s.locality), i.product_id))
                 from public.public_items i join public.public_shops s on s.id = i.shop_id
                 where i.product_id is not null and i.stock in ('in', 'few') and coalesce(s.locality, '') <> '' and s.takes_orders));
$$;

revoke execute on function public.seo_shop(text), public.seo_area_product(text, text), public.seo_sitemap(text, integer),
  public.seo_sitemap_counts(), public.seo_shop_ok(uuid) from public;
grant execute on function public.seo_shop(text), public.seo_area_product(text, text), public.seo_sitemap(text, integer),
  public.seo_sitemap_counts(), public.seo_shop_ok(uuid) to anon, authenticated;

-- ---------- visit sources ----------
alter table public.shop_visits drop constraint if exists shop_visits_src_check;
alter table public.shop_visits add constraint shop_visits_src_check
  check (src in ('app', 'qr', 'bill', 'share', 'gmaps', 'link', 'search', 'google', 'web'));
