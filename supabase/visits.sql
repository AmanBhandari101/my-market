-- My Market — visits to each shop's website page (for the shop's Reports). Safe to re-run.
--
-- A row = one page view or one tap (WhatsApp / Call / Directions / Share) on a
-- shop's page, with where the visitor came from (Google Maps, QR poster, bill…).
-- No names, numbers or locations. Anyone can add a row; nobody can read rows —
-- a shop owner gets only totals for their own shop through shop_visits_summary().

create table if not exists public.shop_visits (
  id       bigint generated always as identity primary key,
  shop_id  uuid not null references public.shops (id) on delete cascade,
  kind     text not null check (kind in ('view', 'whatsapp', 'call', 'directions', 'share')),
  src      text not null default 'app' check (src in ('app', 'qr', 'bill', 'share', 'gmaps', 'link', 'search')),
  at       timestamptz not null default now()
);
create index if not exists shop_visits_shop_at_idx on public.shop_visits (shop_id, at desc);

alter table public.shop_visits enable row level security;
drop policy if exists shop_visits_add on public.shop_visits;
create policy shop_visits_add on public.shop_visits for insert to anon, authenticated with check (true);
revoke select, update, delete on public.shop_visits from anon, authenticated;
grant insert on public.shop_visits to anon, authenticated;

-- Totals for the caller's own shop over the last p_days, by kind and source.
create or replace function public.shop_visits_summary(p_shop uuid, p_days integer default 7)
returns table (kind text, src text, n bigint)
language sql stable security definer set search_path = public as $$
  select v.kind, v.src, count(*)
  from shop_visits v
  where v.shop_id = p_shop
    and exists (select 1 from shops s where s.id = p_shop and s.owner_id = auth.uid())
    and v.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by v.kind, v.src;
$$;
revoke execute on function public.shop_visits_summary(uuid, integer) from anon;
grant execute on function public.shop_visits_summary(uuid, integer) to authenticated;
