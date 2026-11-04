-- My Market — stricter rules when a shop's plan payment is missed (after billing.sql). Safe to re-run.
--
--   days 1–7 after the plan ends   "due"         everything works, reminders
--   days 8–15                      "orders_off"  website off (shop hidden from customers' item lists,
--                                                 page shows "paused"), analytics frozen at the due date;
--                                                 billing and stock still work
--   after day 15                   "read_only"   only reading, backup and export
--
-- The server enforces the read-only stage itself: new bills, stock moves, purchases and items
-- are refused once a shop is past day 15 — so an old or modified app can't get around it.
-- Bills made offline while still allowed are judged by when they were made, so they still save
-- when the phone syncs later.

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
    'server_now', now(),
    'price_month', 150, 'price_year', 1500)
  from a;
$$;

-- may this shop still write (bills, stock)? judged at the time the record was made
create or replace function public.plan_allows_write(p_shop uuid, p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select least(coalesce(p_at, now()), now() + interval '1 day') < (st ->> 'access_until')::timestamptz + interval '15 days'
       from (select public.plan_state(p_shop) as st) x),
    true);
$$;
revoke execute on function public.plan_allows_write(uuid, timestamptz) from public, anon;
grant execute on function public.plan_allows_write(uuid, timestamptz) to authenticated;

drop policy if exists bills_plan_ok on public.bills;
create policy bills_plan_ok on public.bills as restrictive for insert to authenticated
  with check (public.plan_allows_write(shop_id, at));
drop policy if exists stock_moves_plan_ok on public.stock_moves;
create policy stock_moves_plan_ok on public.stock_moves as restrictive for insert to authenticated
  with check (public.plan_allows_write(shop_id, at));
drop policy if exists purchases_plan_ok on public.purchases;
create policy purchases_plan_ok on public.purchases as restrictive for insert to authenticated
  with check (public.plan_allows_write(shop_id, at));
drop policy if exists items_plan_ok on public.items;
create policy items_plan_ok on public.items as restrictive for insert to authenticated
  with check (public.plan_allows_write(shop_id, now()));

-- website off: an overdue shop's items leave customers' lists (same columns as before)
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
  join (select s.id from public.shops s where public.shop_takes_orders(s.id)) live on live.id = i.shop_id
  left join public.catalog_products p on p.id = i.product_id
  where not i.removed;
grant select on public.public_items to anon, authenticated;
