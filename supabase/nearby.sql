-- My Market — customers download only the shops near them. Safe to re-run.
--
-- The customer app asks for the nearest shops (default: up to 150 within 25 km)
-- instead of every shop on My Market, so it stays fast as more cities join.
-- Uses the shops (lat, lng) index from schema.sql. Same columns as public_shops.

create or replace function public.public_shops_near(p_lat double precision, p_lng double precision,
                                                    p_km double precision default 25, p_limit integer default 150)
returns setof public.public_shops
language sql stable set search_path = public as $$
  select ps.* from public_shops ps
  where ps.lat between p_lat - p_km / 111.0 and p_lat + p_km / 111.0
    and ps.lng between p_lng - p_km / (111.0 * cos(radians(p_lat))) and p_lng + p_km / (111.0 * cos(radians(p_lat)))
  order by power(ps.lat - p_lat, 2) + power((ps.lng - p_lng) * cos(radians(p_lat)), 2)
  limit greatest(1, least(p_limit, 300));
$$;
grant execute on function public.public_shops_near(double precision, double precision, double precision, integer) to anon, authenticated;
