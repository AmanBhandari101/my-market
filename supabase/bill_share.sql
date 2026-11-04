-- My Market — bills live in the database; the customer's link shows them from there. Safe to re-run.
--
-- Every bill gets a long random share token (made on the shop's phone). The link
-- bill.html#b=<token> asks public_bill() for that one bill and draws it; the PDF is
-- made on the customer's phone only when they tap Download. Nothing is stored as a
-- file, so storage never fills up and old links keep working.
--
-- public_bill returns only what is printed on the bill: no cost prices, no other
-- bills, and only the last 4 digits of the customer's number.

alter table public.bills add column if not exists share_token text;
create unique index if not exists bills_share_token_idx on public.bills (share_token) where share_token is not null;
alter table public.bill_lines add column if not exists pos integer;   -- line order on the bill

-- older bills get a token when the shop sends them again
grant update (cancelled_at, share_token) on public.bills to authenticated;

create or replace function public.public_bill(p_token text)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'bill', json_build_object(
      'no', b.no, 'at', b.at, 'sub', b.sub, 'discount', b.discount, 'total', b.total, 'units', b.units,
      'pay', b.pay, 'received', b.received, 'cancelled', b.cancelled_at,
      'phone_last4', nullif(right(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'), 4), '')),
    'lines', coalesce((select json_agg(json_build_object('name', l.name, 'brand', l.brand, 'qty', l.qty, 'price', l.price)
                                       order by l.pos nulls last, l.name)
                       from bill_lines l where l.bill_id = b.id), '[]'::json),
    'shop', json_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'gst', s.gst, 'promo', s.promo, 'shop_no', s.shop_no,
      'floor', s.floor, 'landmark', s.landmark, 'locality', s.locality, 'pincode', s.pincode, 'logo_path', s.logo_path),
    'market', (select json_build_object('name', m.name, 'locality', m.locality, 'pincode', m.pincode)
               from markets m where m.id = s.market_id))
  from bills b join shops s on s.id = b.shop_id
  where p_token ~ '^[A-Za-z0-9]{20,40}$' and b.share_token = p_token;
$$;
revoke execute on function public.public_bill(text) from public;
grant execute on function public.public_bill(text) to anon, authenticated;
