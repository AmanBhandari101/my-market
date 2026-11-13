-- My Market — selling online: pay by UPI to the shop or cash on delivery, delivery fee,
-- sizes / colours on order lines, more order steps and a step history for tracking.
-- Run after orders.sql. Safe to re-run. place_order() stays for older app versions.
--
-- Money goes straight from the customer to the shop's own UPI ID (or cash on delivery):
-- My Market never holds it, so no payment licence and no e-commerce TCS are involved.

-- ---------- the shop's settings for online orders ----------
alter table public.shops add column if not exists upi_id text;
-- (Postgres allows repeat counts up to 255)
alter table public.shops drop constraint if exists shops_upi_id_check;
alter table public.shops add constraint shops_upi_id_check
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9.-]{1,64}$');
alter table public.shops add column if not exists cod boolean not null default true;          -- cash on delivery
alter table public.shops add column if not exists delivery_fee integer not null default 0 check (delivery_fee between 0 and 5000);
alter table public.shops add column if not exists free_above integer check (free_above is null or free_above between 0 and 10000000);
alter table public.shops add column if not exists return_policy text check (return_policy is null or length(return_policy) <= 500);
grant update (upi_id, cod, delivery_fee, free_above, return_policy) on public.shops to authenticated;

-- what a customer needs at checkout (anyone may read it)
create or replace function public.shop_order_settings(p_shop uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('upi', s.upi_id, 'cod', s.cod, 'delivery', s.delivery, 'fee', s.delivery_fee,
                           'free_above', s.free_above, 'returns', s.return_policy, 'name', s.name)
  from shops s where s.id = p_shop;
$$;

-- ---------- orders: payment, delivery, more steps ----------
alter table public.orders add column if not exists pay_method text not null default 'cod' check (pay_method in ('upi', 'cod'));
alter table public.orders add column if not exists pay_status text not null default 'unpaid' check (pay_status in ('unpaid', 'claimed', 'paid', 'refunded'));
alter table public.orders add column if not exists upi_ref text check (upi_ref is null or upi_ref ~ '^[A-Za-z0-9]{6,30}$');
alter table public.orders add column if not exists delivery_fee integer not null default 0 check (delivery_fee >= 0);
alter table public.orders add column if not exists pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$');
alter table public.orders add column if not exists history jsonb not null default '[]'::jsonb;
-- steps: new -> ready (accepted / ready for pickup) -> packed -> shipped (out for delivery) -> done; or cancelled
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('new', 'ready', 'packed', 'shipped', 'done', 'cancelled'));
-- the shop marks the payment received / refunded
grant update (pay_status) on public.orders to authenticated;

-- every change of step or payment is written down with its time (the customer's tracking timeline)
create or replace function public.orders_history()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.history := jsonb_build_array(jsonb_build_object('s', new.status, 'p', new.pay_status, 'at', now()));
  elsif new.status is distinct from old.status or new.pay_status is distinct from old.pay_status then
    new.history := coalesce(old.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('s', new.status, 'p', new.pay_status, 'at', now()));
  end if;
  return new;
end $$;
drop trigger if exists orders_history on public.orders;
create trigger orders_history before insert or update on public.orders for each row execute function public.orders_history();

-- ---------- customer: place an order (new app versions) ----------
-- p = {shop, kind: hold|buy, mode: pickup|delivery, pay: upi|cod, name, phone, address, pincode, note,
--      lines: [{item_id, qty, size, color}]}
create or replace function public.place_order_v2(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid; sh record; v_kind text := coalesce(p ->> 'kind', 'buy'); v_mode text := coalesce(p ->> 'mode', 'pickup');
  v_pay text := coalesce(p ->> 'pay', 'cod'); v_lines jsonb := '[]'::jsonb; v_items integer := 0; v_fee integer := 0;
  l jsonb; it record; q integer; v_phone text; v_pin text; v_code text; v_token text; n integer;
  v_size text; v_color text;
begin
  if coalesce(p ->> 'shop', '') !~ '^[0-9a-f-]{36}$' then raise exception 'This shop is not on My Market any more'; end if;
  v_shop := (p ->> 'shop')::uuid;
  select id, name, delivery, upi_id, cod, delivery_fee, free_above into sh from shops where id = v_shop;
  if not found then raise exception 'This shop is not on My Market any more'; end if;
  if to_regprocedure('public.shop_takes_orders(uuid)') is not null then
    if not shop_takes_orders(v_shop) then raise exception 'This shop is not taking online orders right now — message them on WhatsApp'; end if;
  end if;
  if v_kind not in ('hold', 'buy') or v_mode not in ('pickup', 'delivery') then raise exception 'Choose Hold or Buy'; end if;
  if v_kind = 'hold' then v_mode := 'pickup'; v_pay := 'cod'; end if;
  if v_mode = 'delivery' and not coalesce(sh.delivery, false) then raise exception 'This shop does not deliver — choose pickup'; end if;
  if v_pay not in ('upi', 'cod') then raise exception 'Choose how to pay'; end if;
  if v_pay = 'upi' and sh.upi_id is null then raise exception 'This shop does not take online payment yet — choose cash'; end if;
  if v_pay = 'cod' and v_mode = 'delivery' and not coalesce(sh.cod, true) then raise exception 'This shop takes only online payment for delivery'; end if;

  v_phone := right(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), 10);
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter your 10-digit mobile number'; end if;
  if length(trim(coalesce(p ->> 'name', ''))) = 0 then raise exception 'Enter your name'; end if;
  v_pin := nullif(regexp_replace(coalesce(p ->> 'pincode', ''), '\D', '', 'g'), '');
  if v_mode = 'delivery' then
    if length(trim(coalesce(p ->> 'address', ''))) < 6 then raise exception 'Enter the delivery address'; end if;
    if v_pin is null or v_pin !~ '^[1-9][0-9]{5}$' then raise exception 'Enter the 6-digit PIN code'; end if;
  else v_pin := null; end if;
  if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') not between 1 and 50 then raise exception 'Your cart is empty'; end if;

  select count(*) into n from orders where phone = v_phone and created_at > now() - interval '1 hour';
  if n >= 100 then raise exception 'Too many orders from this number — try again in an hour'; end if;

  for l in select value from jsonb_array_elements(p -> 'lines') loop
    if coalesce(l ->> 'item_id', '') !~ '^[0-9a-f-]{36}$' then continue; end if;
    q := least(99, greatest(1, coalesce(nullif(regexp_replace(coalesce(l ->> 'qty', '1'), '\D', '', 'g'), '')::integer, 1)));
    select i.id, i.name, i.brand, i.price into it from items i where i.id = (l ->> 'item_id')::uuid and i.shop_id = v_shop and not i.removed;
    if not found then continue; end if;
    v_size := nullif(left(regexp_replace(coalesce(l ->> 'size', ''), '[^A-Za-z0-9 .+/\-]', '', 'g'), 20), '');
    v_color := nullif(left(regexp_replace(coalesce(l ->> 'color', ''), '[^A-Za-z0-9 .+/\-]', '', 'g'), 20), '');
    v_lines := v_lines || jsonb_strip_nulls(jsonb_build_array(jsonb_build_object('item_id', it.id, 'name', it.name, 'brand', it.brand,
      'qty', q, 'price', it.price, 'size', v_size, 'color', v_color)));
    v_items := v_items + coalesce(it.price, 0) * q;
  end loop;
  if jsonb_array_length(v_lines) = 0 then raise exception 'These items are not available any more'; end if;
  if v_mode = 'delivery' and not (sh.free_above is not null and v_items >= sh.free_above) then v_fee := coalesce(sh.delivery_fee, 0); end if;

  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 4));
  v_token := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  insert into orders (shop_id, code, token, kind, mode, name, phone, address, pincode, note, lines, total, delivery_fee, pay_method, hold_until)
  values (v_shop, v_code, v_token, v_kind, v_mode, left(trim(p ->> 'name'), 60), v_phone,
          case when v_mode = 'delivery' then left(trim(p ->> 'address'), 300) end, v_pin,
          nullif(left(trim(coalesce(p ->> 'note', '')), 300), ''), v_lines, v_items + v_fee, v_fee, v_pay,
          case when v_kind = 'hold' then now() + interval '4 hours' end);
  return json_build_object('token', v_token, 'code', v_code, 'total', v_items + v_fee, 'fee', v_fee, 'lines', v_lines,
                           'pay', v_pay, 'upi', case when v_pay = 'upi' then sh.upi_id end, 'shop_name', sh.name);
end $$;

-- ---------- customer: follow the order (now with payment and the step history) ----------
create or replace function public.order_status(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('code', o.code, 'kind', o.kind, 'mode', o.mode, 'status', o.status, 'total', o.total,
                           'lines', o.lines, 'hold_until', o.hold_until, 'created_at', o.created_at, 'updated_at', o.updated_at,
                           'shop_id', o.shop_id, 'pay_method', o.pay_method, 'pay_status', o.pay_status, 'upi_ref', o.upi_ref,
                           'delivery_fee', o.delivery_fee, 'pincode', o.pincode, 'history', o.history,
                           'upi', case when o.pay_method = 'upi' then s.upi_id end, 'shop_name', s.name)
  from orders o join shops s on s.id = o.shop_id where p_token ~ '^[0-9a-f]{64}$' and o.token = p_token;
$$;

-- ---------- customer: "I've paid" (UPI) — the shop still checks its UPI app and marks it received ----------
create or replace function public.claim_order_payment(p_token text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ref text := nullif(upper(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9]', '', 'g')), '');
begin
  if v_ref is not null and v_ref !~ '^[A-Z0-9]{6,30}$' then raise exception 'That UPI reference doesn''t look right — it is 12 digits in your UPI app'; end if;
  update orders set pay_status = 'claimed', upi_ref = coalesce(v_ref, upi_ref), updated_at = now()
   where p_token ~ '^[0-9a-f]{64}$' and token = p_token and pay_method = 'upi' and pay_status = 'unpaid' and status <> 'cancelled';
  return found;
end $$;

revoke execute on function public.place_order_v2(jsonb), public.shop_order_settings(uuid), public.claim_order_payment(text, text) from public;
grant execute on function public.place_order_v2(jsonb), public.shop_order_settings(uuid), public.claim_order_payment(text, text) to anon, authenticated;
