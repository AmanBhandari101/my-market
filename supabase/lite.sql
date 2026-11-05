-- My Market — lite data model (after all earlier files). Safe to re-run.
--
-- Goal: 1,000+ shops inside the free 500 MB. Store only what can't be worked out.
--
-- * One table, docs, holds every document that moves stock: a sale bill, stock arrived,
--   a stock count, damaged/out. The items sit inside the row (lines jsonb), not as rows.
--   It replaces bills + bill_lines + purchases + purchase_lines + stock_moves.
-- * items.qty is the only stock number. A trigger changes it when a document arrives:
--   sale −, cancelled sale +, stock in +, count = exact number. Documents made before an
--   item's last count are not applied again (offline phones that sync late).
-- * Documents are kept 45 days. Every night older ones are folded into one row per shop
--   per day (daily) and deleted. Searches and website visits older than 30 days become
--   daily counts. Each phone keeps its full history; reports read daily for older days.
-- * The old tables stay readable for now; nothing new is written to them.

-- ---------- documents ----------
create table if not exists public.docs (
  id           uuid primary key,                    -- made on the phone
  shop_id      uuid not null references public.shops (id) on delete cascade,
  type         text not null check (type in ('sale', 'in', 'count', 'out')),
  no           integer,                             -- bill number (sales)
  at           timestamptz not null,
  sub          integer not null default 0,
  discount     integer not null default 0,
  total        integer not null default 0,
  units        integer not null default 0,
  pay          text check (pay is null or pay in ('cash', 'upi', 'card', 'khata', 'credit')),
  phone        text,
  received     integer,
  note         text check (note is null or length(note) <= 120),   -- supplier / reason
  share_token  text,
  lines        jsonb not null default '[]'::jsonb,  -- [{i:item id, n:name, b:brand, q:qty, p:price, c:cost}]
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 300)
);
create index if not exists docs_shop_at_idx on public.docs (shop_id, at desc);
create unique index if not exists docs_share_token_idx on public.docs (share_token) where share_token is not null;

alter table public.items add column if not exists counted_at timestamptz;

alter table public.docs enable row level security;
revoke all on public.docs from anon, authenticated;
grant select, insert on public.docs to authenticated;
grant update (cancelled_at, share_token) on public.docs to authenticated;
drop policy if exists docs_own_read on public.docs;
create policy docs_own_read on public.docs for select to authenticated using (public.is_my_shop(shop_id));
drop policy if exists docs_own_add on public.docs;
create policy docs_own_add on public.docs for insert to authenticated with check (public.is_my_shop(shop_id));
drop policy if exists docs_own_edit on public.docs;
create policy docs_own_edit on public.docs for update to authenticated using (public.is_my_shop(shop_id)) with check (public.is_my_shop(shop_id));
drop policy if exists docs_plan_ok on public.docs;
create policy docs_plan_ok on public.docs as restrictive for insert to authenticated
  with check (public.plan_allows_write(shop_id, at));

-- ---------- one-time move of existing data (only rows not moved yet) ----------
do $$ begin
  -- stock from now on changes only through docs; today's counts are the starting point
  if not exists (select 1 from public.docs) then
    update public.items set counted_at = now() where qty is not null and counted_at is null;
  end if;
end $$;
drop trigger if exists stock_moves_recount on public.stock_moves;

insert into public.docs (id, shop_id, type, no, at, sub, discount, total, units, pay, phone, received, share_token, lines, cancelled_at, created_at)
select b.id, b.shop_id, 'sale', b.no, b.at, b.sub, b.discount, b.total, b.units, b.pay, b.phone, b.received, b.share_token,
       coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('i', l.item_id, 'n', l.name, 'b', l.brand, 'q', l.qty, 'p', l.price, 'c', l.cost)) order by l.pos nulls last, l.name)
                 from public.bill_lines l where l.bill_id = b.id), '[]'::jsonb),
       b.cancelled_at, b.created_at
from public.bills b
on conflict (id) do nothing;

insert into public.docs (id, shop_id, type, at, total, pay, note, lines, created_at)
select p.id, p.shop_id, 'in', p.at, p.total, p.pay, p.supplier,
       coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('i', l.item_id, 'n', l.name, 'q', l.qty, 'c', l.cost)))
                 from public.purchase_lines l where l.purchase_id = p.id), '[]'::jsonb),
       p.created_at
from public.purchases p
on conflict (id) do nothing;

-- ---------- stock follows the documents ----------
create or replace function public.docs_apply()
returns trigger language plpgsql security definer set search_path = public as $$
declare l jsonb; q integer; iid uuid; sgn integer;
begin
  if tg_op = 'INSERT' and new.cancelled_at is not null then return null; end if;
  if tg_op = 'UPDATE' and not (old.cancelled_at is null and new.cancelled_at is not null) then return null; end if;
  for l in select value from jsonb_array_elements(new.lines) loop
    if coalesce(l ->> 'i', '') !~ '^[0-9a-f-]{36}$' then continue; end if;
    iid := (l ->> 'i')::uuid;
    q := coalesce(nullif(l ->> 'q', '')::numeric, 0)::integer;
    if new.type = 'count' then
      if tg_op = 'INSERT' then
        update items set qty = q, counted_at = new.at, stock_at = greatest(coalesce(stock_at, new.at), new.at)
         where id = iid and shop_id = new.shop_id and (counted_at is null or new.at >= counted_at);
      end if;
      continue;
    end if;
    sgn := case when new.type in ('sale', 'out') then -1 else 1 end;
    if tg_op = 'UPDATE' then sgn := -sgn; end if;          -- a cancelled bill puts the items back
    update items
       set qty = case when qty is null and new.type = 'sale' then null else coalesce(qty, 0) + sgn * q end,
           stock_at = greatest(coalesce(stock_at, new.at), new.at)
     where id = iid and shop_id = new.shop_id and (counted_at is null or new.at > counted_at);
  end loop;
  return null;
end $$;
drop trigger if exists docs_apply_ins on public.docs;
create trigger docs_apply_ins after insert on public.docs for each row execute function public.docs_apply();
drop trigger if exists docs_apply_upd on public.docs;
create trigger docs_apply_upd after update of cancelled_at on public.docs for each row execute function public.docs_apply();

-- ---------- one row per shop per day, kept for good ----------
create table if not exists public.daily (
  shop_id       uuid not null references public.shops (id) on delete cascade,
  day           date not null,
  sales         integer not null default 0,
  bills         integer not null default 0,
  units         integer not null default 0,
  discount      integer not null default 0,
  profit        integer not null default 0,
  profit_known  boolean not null default true,
  pay           jsonb not null default '{}'::jsonb,     -- {"cash": 1200, "upi": 800}
  items         jsonb not null default '{}'::jsonb,     -- {"<item id>": units sold}
  bought        integer not null default 0,             -- stock bought that day
  primary key (shop_id, day)
);
alter table public.daily enable row level security;
revoke all on public.daily from anon, authenticated;
grant select on public.daily to authenticated;
drop policy if exists daily_own_read on public.daily;
create policy daily_own_read on public.daily for select to authenticated using (public.is_my_shop(shop_id));

-- add two {key: number} maps
create or replace function public.jsonb_add(a jsonb, b jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select key k, sum(value::numeric) v from (
      select * from jsonb_each_text(coalesce(a, '{}'::jsonb)) union all select * from jsonb_each_text(coalesce(b, '{}'::jsonb))) x
    group by key) y;
$$;

-- fold documents older than p_keep_days into daily, then delete them
create or replace function public.fold_old_docs(p_keep_days integer default 45)
returns integer language plpgsql security definer set search_path = public as $$
declare cutoff timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata' - make_interval(days => greatest(7, p_keep_days))) at time zone 'Asia/Kolkata';
        r record; n integer;
begin
  for r in
    with d as (select * from docs where at < cutoff and type = 'sale' and cancelled_at is null),
    ln as (select d.shop_id, (d.at at time zone 'Asia/Kolkata')::date as day, l from d, jsonb_array_elements(d.lines) l),
    per_doc as (select shop_id, (at at time zone 'Asia/Kolkata')::date as day, total, units, discount, pay,
                       (select coalesce(sum(((x ->> 'p')::numeric - (x ->> 'c')::numeric) * (x ->> 'q')::numeric) filter (where x ? 'c'), 0) from jsonb_array_elements(lines) x) - discount as profit,
                       (select bool_and(x ? 'c') from jsonb_array_elements(lines) x) as known
                from d)
    select p.shop_id, p.day, sum(p.total)::int sales, count(*)::int bills, sum(p.units)::int units, sum(p.discount)::int discount,
           sum(p.profit)::int profit, coalesce(bool_and(p.known), true) known,
           (select coalesce(jsonb_object_agg(pay, s), '{}'::jsonb) from (select coalesce(pay, 'cash') pay, sum(total) s from per_doc q where q.shop_id = p.shop_id and q.day = p.day group by 1) z) pay,
           (select coalesce(jsonb_object_agg(i, s), '{}'::jsonb) from (select l ->> 'i' i, sum((l ->> 'q')::numeric) s from ln where ln.shop_id = p.shop_id and ln.day = p.day and l ? 'i' group by 1) z) items
    from per_doc p group by p.shop_id, p.day
  loop
    insert into daily (shop_id, day, sales, bills, units, discount, profit, profit_known, pay, items)
    values (r.shop_id, r.day, r.sales, r.bills, r.units, r.discount, r.profit, r.known, r.pay, r.items)
    on conflict (shop_id, day) do update set
      sales = daily.sales + excluded.sales, bills = daily.bills + excluded.bills, units = daily.units + excluded.units,
      discount = daily.discount + excluded.discount, profit = daily.profit + excluded.profit,
      profit_known = daily.profit_known and excluded.profit_known,
      pay = jsonb_add(daily.pay, excluded.pay), items = jsonb_add(daily.items, excluded.items);
  end loop;
  insert into daily (shop_id, day, bought)
    select shop_id, (at at time zone 'Asia/Kolkata')::date, sum(total) from docs where at < cutoff and type = 'in' group by 1, 2
  on conflict (shop_id, day) do update set bought = daily.bought + excluded.bought;
  delete from docs where at < cutoff;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- customer searches and website visits: daily counts after 30 days ----------
create table if not exists public.demand_daily (
  day date not null, q text not null, lat numeric(6, 2) not null, lng numeric(6, 2) not null,
  n integer not null default 0, missed integer not null default 0,
  primary key (day, q, lat, lng)
);
create table if not exists public.visits_daily (
  shop_id uuid not null references public.shops (id) on delete cascade, day date not null, kind text not null, src text not null,
  n integer not null default 0, primary key (shop_id, day, kind, src)
);
alter table public.demand_daily enable row level security;
alter table public.visits_daily enable row level security;
revoke all on public.demand_daily, public.visits_daily from anon, authenticated;

create or replace function public.fold_old_activity(p_keep_days integer default 30)
returns void language plpgsql security definer set search_path = public as $$
declare cutoff timestamptz := date_trunc('day', now() - make_interval(days => greatest(7, p_keep_days)));
begin
  insert into demand_daily (day, q, lat, lng, n, missed)
    select at::date, lower(q), round(lat::numeric, 2), round(lng::numeric, 2), count(*), count(*) filter (where found = 0)
    from searches where at < cutoff group by 1, 2, 3, 4
  on conflict (day, q, lat, lng) do update set n = demand_daily.n + excluded.n, missed = demand_daily.missed + excluded.missed;
  delete from searches where at < cutoff;
  insert into visits_daily (shop_id, day, kind, src, n)
    select shop_id, at::date, kind, src, count(*) from shop_visits where at < cutoff group by 1, 2, 3, 4
  on conflict (shop_id, day, kind, src) do update set n = visits_daily.n + excluded.n;
  delete from shop_visits where at < cutoff;
end $$;

revoke execute on function public.fold_old_docs(integer), public.fold_old_activity(integer), public.docs_apply() from public, anon, authenticated;

-- every night at 3 am India time (21:30 UTC); skipped quietly if the scheduler isn't available
do $$ begin
  create extension if not exists pg_cron with schema extensions;
  perform cron.schedule('mm-nightly-fold', '30 21 * * *', 'select public.fold_old_docs(45); select public.fold_old_activity(30);');
exception when others then raise notice 'pg_cron not available: run the fold functions by hand (%).', sqlerrm;
end $$;

-- ---------- functions that read bills now read docs ----------
create or replace function public.public_bill(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'bill', json_build_object('no', d.no, 'at', d.at, 'sub', d.sub, 'discount', d.discount, 'total', d.total, 'units', d.units,
      'pay', d.pay, 'received', d.received, 'cancelled', d.cancelled_at,
      'phone_last4', nullif(right(regexp_replace(coalesce(d.phone, ''), '\D', '', 'g'), 4), '')),
    'lines', coalesce((select json_agg(json_build_object('name', x ->> 'n', 'brand', x ->> 'b', 'qty', (x ->> 'q')::numeric, 'price', (x ->> 'p')::numeric)) from jsonb_array_elements(d.lines) x), '[]'::json),
    'shop', json_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'gst', s.gst, 'promo', s.promo, 'shop_no', s.shop_no,
      'floor', s.floor, 'landmark', s.landmark, 'locality', s.locality, 'pincode', s.pincode, 'logo_path', s.logo_path),
    'market', (select json_build_object('name', m.name, 'locality', m.locality, 'pincode', m.pincode) from markets m where m.id = s.market_id))
  from docs d join shops s on s.id = d.shop_id
  where p_token ~ '^[A-Za-z0-9]{20,40}$' and d.share_token = p_token and d.type = 'sale';
$$;

create or replace function public.claim_bill_numbers(p_shop uuid, p_n integer default 200)
returns integer language plpgsql security definer set search_path = public as $$
declare first_no integer;
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  p_n := greatest(10, least(p_n, 1000));
  update shops
     set next_bill_no = greatest(coalesce(next_bill_no, 1001),
                                 (select coalesce(max(no), 1000) + 1 from docs where shop_id = p_shop and type = 'sale')) + p_n
   where id = p_shop
  returning next_bill_no - p_n into first_no;
  return first_no;
end $$;

-- admin: recent days from docs, older days from daily
create or replace function public.shop_sales(p_shop uuid, p_from timestamptz)
returns table (n bigint, value bigint) language sql stable security definer set search_path = public as $$
  select (select count(*) from docs where shop_id = p_shop and type = 'sale' and cancelled_at is null and at >= p_from)
         + coalesce((select sum(bills) from daily where shop_id = p_shop and day >= (p_from at time zone 'Asia/Kolkata')::date
                       and day < (select coalesce(min(at), now()) from docs where shop_id = p_shop) at time zone 'Asia/Kolkata'), 0),
         (select coalesce(sum(total), 0) from docs where shop_id = p_shop and type = 'sale' and cancelled_at is null and at >= p_from)
         + coalesce((select sum(sales) from daily where shop_id = p_shop and day >= (p_from at time zone 'Asia/Kolkata')::date
                       and day < (select coalesce(min(at), now()) from docs where shop_id = p_shop) at time zone 'Asia/Kolkata'), 0);
$$;
revoke execute on function public.shop_sales(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare st jsonb := '{}'::jsonb; r record;
begin
  perform admin_check();
  for r in select plan_state(id) ->> 'state' as s, count(*) n from shops group by 1 loop
    st := st || jsonb_build_object(coalesce(r.s, 'none'), r.n);
  end loop;
  return json_build_object(
    'shops', (select count(*) from shops),
    'new_7d', (select count(*) from shops where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from shops where created_at > now() - interval '30 days'),
    'active_7d', (select count(distinct shop_id) from docs where type = 'sale' and at > now() - interval '7 days'),
    'plans', st,
    'trials_ending_7d', (select count(*) from shop_plans sp where sp.paid_until is null and sp.trial_ends_at between now() and now() + interval '7 days'),
    'money_month', (select coalesce(sum(amount), 0) from payments where status = 'confirmed' and method <> 'grant' and decided_at >= date_trunc('month', now())),
    'money_last_month', (select coalesce(sum(amount), 0) from payments where status = 'confirmed' and method <> 'grant'
                          and decided_at >= date_trunc('month', now()) - interval '1 month' and decided_at < date_trunc('month', now())),
    'paid_shops', (select count(*) from shop_plans where paid_until > now()),
    'bills_today', (select json_build_object('n', count(*), 'value', coalesce(sum(total), 0)) from docs where type = 'sale' and cancelled_at is null and at >= date_trunc('day', now())),
    'bills_7d', (select json_build_object('n', count(*), 'value', coalesce(sum(total), 0)) from docs where type = 'sale' and cancelled_at is null and at > now() - interval '7 days'),
    'orders_7d', (select count(*) from orders where created_at > now() - interval '7 days'),
    'searches_7d', (select count(*) from searches where at > now() - interval '7 days'),
    'unmatched_credits', (select count(*) from bank_credits where status <> 'matched'),
    'joins_by_week', (select coalesce(json_agg(json_build_object('week', w, 'n', n) order by w), '[]'::json) from (
        select date_trunc('week', created_at)::date w, count(*) n from shops where created_at > now() - interval '12 weeks' group by 1) x));
end $$;

create or replace function public.admin_shops()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
    select s.id, s.name, s.owner_name, s.phone, s.cat, s.locality, s.pincode, s.created_at, s.lat, s.lng,
           shop_pay_code(s.id) as pay_code, ps.st ->> 'state' as plan, (ps.st ->> 'access_until')::timestamptz as access_until,
           (select count(*) from items i where i.shop_id = s.id and not i.removed) as items,
           (select n from shop_sales(s.id, '-infinity')) as bills,
           (select value from shop_sales(s.id, now() - interval '30 days')) as sales_30d,
           coalesce((select max(at) from docs d where d.shop_id = s.id and d.type = 'sale'), (select max(day)::timestamptz from daily where shop_id = s.id and bills > 0)) as last_bill,
           (select count(*) from shop_visits v where v.shop_id = s.id and v.at > now() - interval '30 days') as visits_30d,
           (select count(*) from orders o where o.shop_id = s.id) as orders,
           (select coalesce(json_agg(m.phone), '[]'::json) from shop_members m where m.shop_id = s.id) as logins
    from shops s cross join lateral (select plan_state(s.id) as st) ps) t);
end $$;

create or replace function public.admin_shop(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select json_build_object(
    'shop', (select row_to_json(s) from shops s where s.id = p_shop),
    'pay_code', shop_pay_code(p_shop),
    'plan', plan_state(p_shop),
    'logins', (select coalesce(json_agg(json_build_object('phone', phone, 'role', role, 'added_at', added_at) order by added_at), '[]'::json) from shop_members where shop_id = p_shop),
    'payments', (select coalesce(json_agg(json_build_object('id', id, 'amount', amount, 'months', months, 'method', method, 'ref', ref, 'status', status, 'reason', reason, 'created_at', created_at) order by created_at desc), '[]'::json) from payments where shop_id = p_shop),
    'notes', (select coalesce(json_agg(json_build_object('note', note, 'by', by_phone, 'at', at) order by at desc), '[]'::json) from admin_notes where shop_id = p_shop),
    'stats', json_build_object(
      'items', (select count(*) from items where shop_id = p_shop and not removed),
      'items_with_price', (select count(*) from items where shop_id = p_shop and not removed and price is not null),
      'bills', (select n from shop_sales(p_shop, '-infinity')),
      'sales_all', (select value from shop_sales(p_shop, '-infinity')),
      'sales_30d', (select value from shop_sales(p_shop, now() - interval '30 days')),
      'last_bill', (select max(at) from docs where shop_id = p_shop and type = 'sale'),
      'orders', (select count(*) from orders where shop_id = p_shop),
      'visits_30d', (select coalesce(json_object_agg(kind, n), '{}'::json) from (select kind, count(*) n from shop_visits where shop_id = p_shop and at > now() - interval '30 days' group by kind) v)),
    'daily_30d', (select coalesce(json_agg(json_build_object('day', d, 'value', v) order by d), '[]'::json) from (
        select (at at time zone 'Asia/Kolkata')::date d, sum(total) v from docs where shop_id = p_shop and type = 'sale' and cancelled_at is null and at > now() - interval '30 days' group by 1) x)
  ));
end $$;

create or replace function public.admin_demand(p_days integer default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  perform admin_check();
  return json_build_object(
    'top', (select coalesce(json_agg(json_build_object('q', q, 'n', n, 'missed', missed) order by n desc), '[]'::json) from (
        select q, sum(n) n, sum(missed) missed from (
          select lower(q) q, 1 n, (found = 0)::int missed from searches where at > since
          union all select q, n, missed from demand_daily where day > since::date) a group by q order by 2 desc limit 40) a),
    'missed', (select coalesce(json_agg(json_build_object('q', q, 'n', n, 'lat', lat, 'lng', lng) order by n desc), '[]'::json) from (
        select q, sum(m) n, round(avg(lat), 3) lat, round(avg(lng), 3) lng from (
          select lower(q) q, 1 m, lat::numeric lat, lng::numeric lng from searches where at > since and found = 0
          union all select q, missed, lat, lng from demand_daily where day > since::date and missed > 0) b group by q order by 2 desc limit 40) b),
    'orders', (select json_build_object('n', count(*), 'holds', count(*) filter (where kind = 'hold'), 'value', coalesce(sum(total), 0),
        'done', count(*) filter (where status = 'done'), 'cancelled', count(*) filter (where status = 'cancelled')) from orders where created_at > since));
end $$;

create or replace function public.shop_visits_summary(p_shop uuid, p_days integer default 7)
returns table (kind text, src text, n bigint)
language sql stable security definer set search_path = public as $$
  select kind, src, sum(n)::bigint from (
    select v.kind, v.src, 1 n from shop_visits v
     where v.shop_id = p_shop and is_my_shop(p_shop) and v.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
    union all
    select d.kind, d.src, d.n from visits_daily d
     where d.shop_id = p_shop and is_my_shop(p_shop) and d.day > (now() - make_interval(days => greatest(1, least(p_days, 90))))::date) x
  group by kind, src;
$$;
