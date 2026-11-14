-- My Market — offer posters (after seo.sql). Safe to re-run.
--
-- The offer poster a shop shares on WhatsApp status / Instagram / Facebook links to the shop's
-- page with ?src=offer, so its visits show as "Offer posters" in the shop's Visits.
alter table public.shop_visits drop constraint if exists shop_visits_src_check;
alter table public.shop_visits add constraint shop_visits_src_check
  check (src in ('app', 'qr', 'bill', 'share', 'gmaps', 'link', 'search', 'google', 'web', 'offer'));
