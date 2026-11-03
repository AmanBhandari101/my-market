-- My Market — what customers search for near a shop (for the shop's Reports page).
-- Run once in Supabase → SQL Editor (after schema.sql). Safe to re-run.
--
-- Privacy: a search row holds only the words, the categories they match, a
-- location rounded to ~1 km by the app, and how many shops had the item.
-- No names, numbers or accounts. Nobody can read single searches: a shop owner
-- gets only totals for searches near their own shop, through searches_near().

create table if not exists public.searches (
  id     bigint generated always as identity primary key,
  q      text not null check (length(q) between 2 and 80),
  cats   text[] not null default '{}',
  lat    double precision not null,
  lng    double precision not null,
  found  integer not null default 0 check (found between 0 and 999),  -- shops that listed it; 0 = nobody had it
  at     timestamptz not null default now()
);
create index if not exists searches_at_idx on public.searches (at desc);
create index if not exists searches_geo_idx on public.searches (lat, lng);

alter table public.searches enable row level security;
drop policy if exists searches_add on public.searches;
create policy searches_add on public.searches for insert to anon, authenticated
  with check (length(q) between 2 and 80);
revoke select, update, delete on public.searches from anon, authenticated;
grant insert on public.searches to anon, authenticated;

-- Totals of searches within p_km of the caller's own shop over the last p_days.
create or replace function public.searches_near(p_shop uuid, p_days integer default 7, p_km double precision default 3)
returns table (q text, n bigint, missed bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (
    select lat, lng from shops where id = p_shop and owner_id = auth.uid() and lat is not null
  )
  select lower(x.q), count(*), count(*) filter (where x.found = 0), max(x.at)
  from searches x cross join me
  where x.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
    and x.lat between me.lat - p_km / 111.0 and me.lat + p_km / 111.0
    and 6371 * 2 * asin(sqrt(
          power(sin(radians(x.lat - me.lat) / 2), 2) +
          cos(radians(me.lat)) * cos(radians(x.lat)) * power(sin(radians(x.lng - me.lng) / 2), 2)
        )) <= p_km
  group by lower(x.q)
  order by count(*) desc, max(x.at) desc
  limit 30;
$$;
revoke execute on function public.searches_near(uuid, integer, double precision) from anon;
grant execute on function public.searches_near(uuid, integer, double precision) to authenticated;
