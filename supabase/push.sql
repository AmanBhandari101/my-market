-- My Market — order alerts on the shopkeeper's phone (run once in the Supabase SQL editor, after orders.sql).
--
-- push_subs            the phones that asked for order alerts (one row per phone per shop)
-- private.push_config  where to send alerts (the site worker) and a random secret, made here and never shown
-- orders_push          a new order → the worker gets the shop's phones and the order, and sends each phone an alert
-- push_secret_ok(s)    the worker checks the secret it was sent (it never stores it)
-- push_gone(s, list)   the worker removes phones whose alert address no longer works
-- push_test(shop)      the "Send a test alert" button in the shop app
--
-- An alert can never stop an order: any error here is ignored and the order is saved as usual.

create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- phones that want alerts ----------
create table if not exists public.push_subs (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  endpoint   text not null check (endpoint ~ '^https://' and length(endpoint) <= 800),
  p256dh     text not null check (length(p256dh) between 60 and 120),
  auth       text not null check (length(auth) between 10 and 40),
  user_id    uuid default auth.uid(),
  device     text check (device is null or length(device) <= 120),
  created_at timestamptz not null default now(),
  primary key (shop_id, endpoint)
);
alter table public.push_subs enable row level security;
drop policy if exists push_subs_read on public.push_subs;
create policy push_subs_read on public.push_subs for select to authenticated using (public.is_my_shop(shop_id));
drop policy if exists push_subs_add on public.push_subs;
create policy push_subs_add on public.push_subs for insert to authenticated with check (public.is_my_shop(shop_id));
drop policy if exists push_subs_edit on public.push_subs;
create policy push_subs_edit on public.push_subs for update to authenticated using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));
drop policy if exists push_subs_remove on public.push_subs;
create policy push_subs_remove on public.push_subs for delete to authenticated using (public.is_my_shop(shop_id));
grant select, insert, update, delete on public.push_subs to authenticated;

-- ---------- where alerts go (not reachable from the apps) ----------
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.push_config (
  id     integer primary key default 1 check (id = 1),
  url    text not null,
  secret text not null
);
insert into private.push_config (id, url, secret)
values (1, 'https://mymarket.aman101bhandari.workers.dev', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (id) do update set url = excluded.url;          -- keeps the secret

-- send one alert batch to the worker
create or replace function private.push_send(p_shop uuid, p_order jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c private.push_config; subs jsonb;
begin
  select * into c from private.push_config where id = 1;
  if c.url is null then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)) into subs
    from public.push_subs where shop_id = p_shop;
  if subs is null then return; end if;
  perform net.http_post(
    url := c.url || '/push/order',
    body := jsonb_build_object('subs', subs, 'order', p_order),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', c.secret),
    timeout_milliseconds := 8000);
end $$;
revoke all on function private.push_send(uuid, jsonb) from public;

-- ---------- a new order rings the shop's phones ----------
create or replace function public.orders_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform private.push_send(new.shop_id, jsonb_build_object(
      'code', new.code, 'kind', new.kind, 'mode', new.mode, 'name', new.name, 'total', new.total,
      'items', coalesce(jsonb_array_length(new.lines), 0)));
  exception when others then null;     -- an alert must never block an order
  end;
  return new;
end $$;
drop trigger if exists orders_push on public.orders;
create trigger orders_push after insert on public.orders for each row execute function public.orders_push();

-- ---------- for the worker ----------
create or replace function public.push_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(length(p_secret) >= 32 and p_secret = (select secret from private.push_config where id = 1), false);
$$;
create or replace function public.push_gone(p_secret text, p_endpoints text[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.push_secret_ok(p_secret) then return 0; end if;
  delete from public.push_subs where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.push_secret_ok(text), public.push_gone(text, text[]) from public;
grant execute on function public.push_secret_ok(text), public.push_gone(text, text[]) to anon, authenticated;

-- ---------- "Send a test alert" ----------
create or replace function public.push_test(p_shop uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  select count(*) into n from public.push_subs where shop_id = p_shop;
  if n = 0 then return 0; end if;
  perform private.push_send(p_shop, jsonb_build_object('test', true, 'code', 'TEST', 'kind', 'buy', 'mode', 'pickup',
    'name', 'Test customer', 'total', 0, 'items', 1));
  return n;
end $$;
revoke execute on function public.push_test(uuid) from public;
grant execute on function public.push_test(uuid) to authenticated;
