-- My Market — customers order from a shop's website: "Hold it for me" or "Buy". Safe to re-run.
--
-- Customers have no account: they give a name and mobile number. Orders go in only
-- through place_order(), which takes prices from the shop's own items (never from the
-- customer's phone) and limits how many open orders one number can have.
-- The customer follows the order with a long private token; the shop sees and updates
-- its own orders in the shop app.

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  code        text not null,                         -- short code both sides say out loud, e.g. 4F2A
  token       text not null unique,                  -- the customer's private tracking code
  kind        text not null check (kind in ('hold', 'buy')),
  mode        text not null check (mode in ('pickup', 'delivery')),
  name        text not null check (length(name) between 1 and 60),
  phone       text not null check (phone ~ '^[0-9]{10}$'),
  address     text check (address is null or length(address) <= 300),
  note        text check (note is null or length(note) <= 300),
  lines       jsonb not null,                        -- [{item_id, name, brand, qty, price}]
  total       integer not null default 0 check (total >= 0),
  status      text not null default 'new' check (status in ('new', 'ready', 'done', 'cancelled')),
  hold_until  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists orders_shop_idx on public.orders (shop_id, created_at desc);
create index if not exists orders_phone_idx on public.orders (phone, created_at desc);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant update (status, updated_at) on public.orders to authenticated;
drop policy if exists orders_shop_read on public.orders;
create policy orders_shop_read on public.orders for select to authenticated using (public.is_my_shop(shop_id));
drop policy if exists orders_shop_update on public.orders;
create policy orders_shop_update on public.orders for update to authenticated
  using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));

-- ---------- customer: place an order ----------
create or replace function public.place_order(p_shop uuid, p_kind text, p_mode text, p_name text, p_phone text,
                                              p_address text, p_note text, p_lines jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_lines jsonb := '[]'::jsonb; v_total integer := 0; l jsonb; it record; q integer;
  v_phone text; v_code text; v_token text; n integer; v_delivery boolean;
begin
  select delivery into v_delivery from shops where id = p_shop;
  if not found then raise exception 'This shop is not on My Market any more'; end if;
  -- an overdue shop (see billing.sql) isn't taking online orders
  if to_regprocedure('public.shop_takes_orders(uuid)') is not null then
    if not shop_takes_orders(p_shop) then raise exception 'This shop is not taking online orders right now — message them on WhatsApp'; end if;
  end if;
  if p_kind not in ('hold', 'buy') or p_mode not in ('pickup', 'delivery') then raise exception 'Choose Hold or Buy'; end if;
  if p_kind = 'hold' then p_mode := 'pickup'; end if;
  if p_mode = 'delivery' and not coalesce(v_delivery, false) then raise exception 'This shop does not deliver — choose pickup'; end if;
  v_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter your 10-digit mobile number'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Enter your name'; end if;
  if p_mode = 'delivery' and length(trim(coalesce(p_address, ''))) < 6 then raise exception 'Enter the delivery address'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Your cart is empty'; end if;

  select count(*) into n from orders where shop_id = p_shop and phone = v_phone and status in ('new', 'ready');
  if n >= 5 then raise exception 'You already have 5 open orders at this shop'; end if;
  select count(*) into n from orders where phone = v_phone and created_at > now() - interval '1 hour';
  if n >= 10 then raise exception 'Too many orders from this number — try again in an hour'; end if;

  for l in select value from jsonb_array_elements(p_lines) loop
    if coalesce(l ->> 'item_id', '') !~ '^[0-9a-f-]{36}$' then continue; end if;
    q := least(99, greatest(1, coalesce(nullif(regexp_replace(coalesce(l ->> 'qty', '1'), '\D', '', 'g'), '')::integer, 1)));
    select i.id, i.name, i.brand, i.price into it from items i
      where i.id = (l ->> 'item_id')::uuid and i.shop_id = p_shop and not i.removed;
    if not found then continue; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('item_id', it.id, 'name', it.name, 'brand', it.brand, 'qty', q, 'price', it.price));
    v_total := v_total + coalesce(it.price, 0) * q;
  end loop;
  if jsonb_array_length(v_lines) = 0 then raise exception 'These items are not available any more'; end if;

  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 4));
  v_token := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  insert into orders (shop_id, code, token, kind, mode, name, phone, address, note, lines, total, hold_until)
  values (p_shop, v_code, v_token, p_kind, p_mode, left(trim(p_name), 60), v_phone,
          case when p_mode = 'delivery' then left(trim(p_address), 300) end, nullif(left(trim(coalesce(p_note, '')), 300), ''),
          v_lines, v_total, case when p_kind = 'hold' then now() + interval '4 hours' end);
  return json_build_object('token', v_token, 'code', v_code, 'total', v_total, 'lines', v_lines);
end $$;

-- ---------- customer: follow / cancel their order ----------
create or replace function public.order_status(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('code', o.code, 'kind', o.kind, 'mode', o.mode, 'status', o.status, 'total', o.total,
                           'lines', o.lines, 'hold_until', o.hold_until, 'created_at', o.created_at, 'updated_at', o.updated_at,
                           'shop_id', o.shop_id)
  from orders o where p_token ~ '^[0-9a-f]{64}$' and o.token = p_token;
$$;

create or replace function public.cancel_my_order(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'cancelled', updated_at = now()
   where p_token ~ '^[0-9a-f]{64}$' and token = p_token and status = 'new';
  return found;
end $$;

revoke execute on function public.place_order(uuid, text, text, text, text, text, text, jsonb), public.order_status(text), public.cancel_my_order(text) from public;
grant execute on function public.place_order(uuid, text, text, text, text, text, text, jsonb), public.order_status(text), public.cancel_my_order(text) to anon, authenticated;
