-- My Market — "Get found on Google" (run once in the Supabase SQL editor, after seo.sql).
--
-- google_link        one row per shop: where it stands on Google Maps (Business Profile) and Google Shopping
--                    (Merchant Center), its Maps and review links, its store code, and help requests
-- public_shops       + maps_url, review_url (the shop's website and bills show them)
-- seo_item(s, i)     one item page: price, stock and the shop — Google's "product page" for the item
-- seo_feed(s)        every item of a shop, for the product and stock feeds Google fetches daily
-- admin_google()     staff: every shop's stage, to help the ones that are stuck

-- ---------- one row per shop ----------
create table if not exists public.google_link (
  shop_id     uuid primary key references public.shops (id) on delete cascade,
  gmail       text check (gmail is null or gmail ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  gbp_status  text not null default 'none' check (gbp_status in ('none', 'started', 'verifying', 'live')),
  maps_url    text check (maps_url is null or (length(maps_url) <= 300 and maps_url ~* '^https://([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.page)/')),
  review_url  text check (review_url is null or (length(review_url) <= 300 and review_url ~* '^https://([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.page)/')),
  -- the code the owner types into the Business Profile ("Store code"); Google matches stock to the shop with it
  store_code  text generated always as ('MM-' || upper(left(shop_id::text, 8))) stored,
  mc_status   text not null default 'none' check (mc_status in ('none', 'started', 'feeds', 'review', 'live')),
  merchant_id text check (merchant_id is null or merchant_id ~ '^[0-9]{6,13}$'),
  help_at     timestamptz,                       -- the owner asked My Market for help
  help_note   text check (help_note is null or length(help_note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.google_link enable row level security;

drop policy if exists google_link_read on public.google_link;
create policy google_link_read on public.google_link for select to authenticated using (public.is_my_shop(shop_id));
drop policy if exists google_link_add on public.google_link;
create policy google_link_add on public.google_link for insert to authenticated with check (public.is_my_shop(shop_id));
drop policy if exists google_link_edit on public.google_link;
create policy google_link_edit on public.google_link for update to authenticated using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));
grant select, insert, update on public.google_link to authenticated;

drop trigger if exists google_link_touch on public.google_link;
create trigger google_link_touch before update on public.google_link for each row execute function public.touch_updated_at();

-- ---------- customers' view of a shop: + Maps and review links ----------
create or replace view public.public_shops as
  select s.id, s.name, s.cat, s.cats, s.market_id, s.shop_no, s.floor, s.landmark,
         s.locality, s.pincode, s.lat, s.lng, s.open_h, s.close_h, s.closed_day,
         s.phone, s.verified, s.promo,
         s.logo_path, s.cover_path, s.gallery, s.about, s.pay_methods, s.delivery,
         public.shop_takes_orders(s.id) as takes_orders,
         s.slug,
         g.maps_url, g.review_url
  from public.shops s
  left join public.google_link g on g.shop_id = s.id;
grant select on public.public_shops to anon, authenticated;

-- ---------- one item page ----------
create or replace function public.seo_item(p_slug text, p_item uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shop', to_jsonb(s),
    'store_code', 'MM-' || upper(left(s.id::text, 8)),
    'item', (select to_jsonb(i) || jsonb_build_object('product_name', p.name)
             from public.public_items i left join public.catalog_products p on p.id = i.product_id
             where i.shop_id = s.id and i.id = p_item))
  from public.public_shops s
  where s.slug = p_slug and s.takes_orders;
$$;

-- ---------- every item of a shop, for Google's feeds ----------
create or replace function public.seo_feed(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shop', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'cat', s.cat, 'delivery', s.delivery),
    'store_code', 'MM-' || upper(left(s.id::text, 8)),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'brand', i.brand, 'cat', i.cat, 'price', i.price, 'mrp', coalesce(i.mrp, i.product_mrp),
        'stock', i.stock, 'updated_at', i.updated_at, 'barcode', i.barcode, 'model', i.model, 'size', i.size,
        'description', i.description, 'features', i.features,
        'photo_path', i.photo_path, 'product_photo_path', i.product_photo_path, 'product_photo_url', i.product_photo_url) order by i.name)
      from public.public_items i where i.shop_id = s.id), '[]'::jsonb))
  from public.public_shops s
  where s.slug = p_slug and s.takes_orders;
$$;

revoke execute on function public.seo_item(text, uuid), public.seo_feed(text) from public;
grant execute on function public.seo_item(text, uuid), public.seo_feed(text) to anon, authenticated;

-- ---------- staff: where every shop stands ----------
create or replace function public.admin_google()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(row_to_json(t) order by t.help_at desc nulls last, t.name), '[]'::json) from (
    select s.id, s.name, s.owner_name, s.phone, s.locality, s.slug,
           coalesce(g.gbp_status, 'none') as gbp_status, coalesce(g.mc_status, 'none') as mc_status,
           g.maps_url, g.review_url, g.gmail, g.merchant_id, g.store_code, g.help_at, g.help_note, g.updated_at,
           (select count(*) from public.public_items i where i.shop_id = s.id) as items,
           (select count(*) from public.public_items i where i.shop_id = s.id and i.price > 0
              and coalesce(i.photo_path, i.product_photo_path, i.product_photo_url) is not null) as ready_items
    from public.shops s left join public.google_link g on g.shop_id = s.id) t);
end $$;
revoke execute on function public.admin_google() from public;
grant execute on function public.admin_google() to authenticated;
