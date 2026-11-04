-- My Market Admin — the staff web app (admin.html) reads and acts only through these
-- functions. Safe to re-run (after payments_match.sql, which creates public.admins).
--
-- Every function checks the caller is staff (public.admins) before doing anything,
-- and every action that changes something is written to public.admin_log.
-- Customers' phone numbers are never returned in full here.

create table if not exists public.admin_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  by_phone text,
  action  text not null,
  shop_id uuid,
  detail  jsonb
);
create table if not exists public.admin_notes (
  id      bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  note    text not null check (length(note) between 1 and 1000),
  by_phone text,
  at      timestamptz not null default now()
);
alter table public.admin_log enable row level security;
alter table public.admin_notes enable row level security;
revoke all on public.admin_log, public.admin_notes from anon, authenticated;

create or replace function public.admin_check()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or session_user not in ('authenticator', 'anon', 'authenticated')) then
    raise exception 'Only My Market staff can open this';
  end if;
  return coalesce(substring(coalesce(auth.jwt() ->> 'email', '') from '^91([0-9]{10})@'), 'sql');
end $$;

create or replace function public.admin_write_log(p_action text, p_shop uuid, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into admin_log (by_phone, action, shop_id, detail) values (admin_check(), p_action, p_shop, p_detail);
$$;

-- ---------- overview ----------
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
    'active_7d', (select count(distinct shop_id) from bills where at > now() - interval '7 days'),
    'plans', st,
    'trials_ending_7d', (select count(*) from shop_plans sp where sp.paid_until is null and sp.trial_ends_at between now() and now() + interval '7 days'),
    'money_month', (select coalesce(sum(amount), 0) from payments where status = 'confirmed' and method <> 'grant' and decided_at >= date_trunc('month', now())),
    'money_last_month', (select coalesce(sum(amount), 0) from payments where status = 'confirmed' and method <> 'grant'
                          and decided_at >= date_trunc('month', now()) - interval '1 month' and decided_at < date_trunc('month', now())),
    'paid_shops', (select count(*) from shop_plans where paid_until > now()),
    'bills_today', (select json_build_object('n', count(*), 'value', coalesce(sum(total), 0)) from bills where cancelled_at is null and at >= date_trunc('day', now())),
    'bills_7d', (select json_build_object('n', count(*), 'value', coalesce(sum(total), 0)) from bills where cancelled_at is null and at > now() - interval '7 days'),
    'orders_7d', (select count(*) from orders where created_at > now() - interval '7 days'),
    'searches_7d', (select count(*) from searches where at > now() - interval '7 days'),
    'unmatched_credits', (select count(*) from bank_credits where status <> 'matched'),
    'joins_by_week', (select coalesce(json_agg(json_build_object('week', w, 'n', n) order by w), '[]'::json) from (
        select date_trunc('week', created_at)::date w, count(*) n from shops where created_at > now() - interval '12 weeks' group by 1) x)
  );
end $$;

-- ---------- shops ----------
create or replace function public.admin_shops()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
    select s.id, s.name, s.owner_name, s.phone, s.cat, s.locality, s.pincode, s.created_at, s.lat, s.lng,
           shop_pay_code(s.id) as pay_code,
           plan_state(s.id) ->> 'state' as plan, (plan_state(s.id) ->> 'access_until')::timestamptz as access_until,
           (select count(*) from items i where i.shop_id = s.id and not i.removed) as items,
           (select count(*) from bills b where b.shop_id = s.id and b.cancelled_at is null) as bills,
           (select coalesce(sum(total), 0) from bills b where b.shop_id = s.id and b.cancelled_at is null and b.at > now() - interval '30 days') as sales_30d,
           (select max(at) from bills b where b.shop_id = s.id) as last_bill,
           (select count(*) from shop_visits v where v.shop_id = s.id and v.at > now() - interval '30 days') as visits_30d,
           (select count(*) from orders o where o.shop_id = s.id) as orders,
           (select coalesce(json_agg(m.phone), '[]'::json) from shop_members m where m.shop_id = s.id) as logins
    from shops s) t);
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
      'bills', (select count(*) from bills where shop_id = p_shop and cancelled_at is null),
      'sales_all', (select coalesce(sum(total), 0) from bills where shop_id = p_shop and cancelled_at is null),
      'sales_30d', (select coalesce(sum(total), 0) from bills where shop_id = p_shop and cancelled_at is null and at > now() - interval '30 days'),
      'last_bill', (select max(at) from bills where shop_id = p_shop),
      'orders', (select count(*) from orders where shop_id = p_shop),
      'visits_30d', (select coalesce(json_object_agg(kind, n), '{}'::json) from (select kind, count(*) n from shop_visits where shop_id = p_shop and at > now() - interval '30 days' group by kind) v)),
    'daily_30d', (select coalesce(json_agg(json_build_object('day', d, 'value', v) order by d), '[]'::json) from (
        select date_trunc('day', at)::date d, sum(total) v from bills where shop_id = p_shop and cancelled_at is null and at > now() - interval '30 days' group by 1) x)
  ));
end $$;

-- ---------- actions on a shop ----------
create or replace function public.admin_give_months(p_shop uuid, p_months integer, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  perform admin_check();
  if p_months not between 1 and 24 then raise exception 'Give 1 to 24 months'; end if;
  r := grant_months(p_shop, p_months, coalesce(nullif(trim(p_note), ''), 'given by staff'));
  perform admin_write_log('give_months', p_shop, jsonb_build_object('months', p_months, 'note', p_note));
  return r;
end $$;

create or replace function public.admin_extend_trial(p_shop uuid, p_days integer, p_note text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform admin_check();
  if p_days not between 1 and 365 then raise exception 'Extend by 1 to 365 days'; end if;
  update shop_plans set trial_ends_at = greatest(trial_ends_at, now()) + make_interval(days => p_days), updated_at = now() where shop_id = p_shop;
  perform admin_write_log('extend_trial', p_shop, jsonb_build_object('days', p_days, 'note', p_note));
  return plan_state(p_shop);
end $$;

create or replace function public.admin_add_note(p_shop uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := admin_check();
  insert into admin_notes (shop_id, note, by_phone) values (p_shop, left(trim(p_note), 1000), me);
  perform admin_write_log('note', p_shop, jsonb_build_object('note', left(p_note, 200)));
end $$;

-- ---------- payments ----------
create or replace function public.admin_payments(p_days integer default 90)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(json_build_object('id', p.id, 'shop_id', p.shop_id, 'shop', s.name, 'pay_code', shop_pay_code(p.shop_id), 'amount', p.amount, 'months', p.months,
      'method', p.method, 'ref', p.ref, 'status', p.status, 'reason', p.reason, 'created_at', p.created_at, 'decided_at', p.decided_at) order by p.created_at desc), '[]'::json)
    from payments p join shops s on s.id = p.shop_id
    where p.created_at > now() - make_interval(days => greatest(1, least(p_days, 3650))));
end $$;

create or replace function public.admin_credits(p_only_unmatched boolean default true)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(json_build_object('utr', c.utr, 'amount', c.amount, 'narration', c.narration, 'credited_at', c.credited_at, 'code', c.code,
      'status', c.status, 'shop', s.name, 'loaded_at', c.loaded_at) order by c.loaded_at desc), '[]'::json)
    from (select * from bank_credits where not p_only_unmatched or status <> 'matched' order by loaded_at desc limit 500) c
    left join shops s on s.id = c.shop_id);
end $$;

-- a credit whose note had no code (or a wrong one): attach it to the right shop by hand
create or replace function public.admin_attach_credit(p_utr text, p_shop uuid, p_months integer)
returns json language plpgsql security definer set search_path = public as $$
declare c bank_credits; pay uuid;
begin
  perform admin_check();
  select * into c from bank_credits where utr = upper(p_utr);
  if not found then raise exception 'No such credit'; end if;
  if c.status = 'matched' then raise exception 'This credit is already used'; end if;
  if p_months not between 1 and 24 then raise exception 'Give 1 to 24 months'; end if;
  update payments set status = 'confirmed', decided_at = now(), ref = coalesce(ref, c.utr), months = p_months, amount = round(c.amount)
   where id = (select id from payments where shop_id = p_shop and status = 'claimed' order by created_at limit 1) returning id into pay;
  if pay is null then
    insert into payments (shop_id, amount, months, method, ref, status, decided_at, reason)
    values (p_shop, round(c.amount), p_months, 'upi', c.utr, 'confirmed', now(), 'attached by staff') returning id into pay;
  end if;
  update shop_plans set paid_until = greatest(coalesce(paid_until, now()), trial_ends_at, now()) + make_interval(months => p_months), updated_at = now() where shop_id = p_shop;
  update bank_credits set status = 'matched', shop_id = p_shop, payment_id = pay where utr = c.utr;
  perform admin_write_log('attach_credit', p_shop, jsonb_build_object('utr', c.utr, 'amount', c.amount, 'months', p_months));
  return plan_state(p_shop);
end $$;

-- ---------- what customers look for ----------
create or replace function public.admin_demand(p_days integer default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  perform admin_check();
  return json_build_object(
    'top', (select coalesce(json_agg(json_build_object('q', q, 'n', n, 'missed', missed) order by n desc), '[]'::json) from (
        select lower(q) q, count(*) n, count(*) filter (where found = 0) missed from searches where at > since group by 1 order by 2 desc limit 40) a),
    'missed', (select coalesce(json_agg(json_build_object('q', q, 'n', n, 'lat', lat, 'lng', lng) order by n desc), '[]'::json) from (
        select lower(q) q, count(*) n, round(avg(lat)::numeric, 3) lat, round(avg(lng)::numeric, 3) lng from searches where at > since and found = 0 group by 1 order by 2 desc limit 40) b),
    'orders', (select json_build_object('n', count(*), 'holds', count(*) filter (where kind = 'hold'), 'value', coalesce(sum(total), 0),
        'done', count(*) filter (where status = 'done'), 'cancelled', count(*) filter (where status = 'cancelled')) from orders where created_at > since));
end $$;

-- ---------- activity log ----------
create or replace function public.admin_activity()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return (select coalesce(json_agg(json_build_object('at', l.at, 'by', l.by_phone, 'action', l.action, 'shop', s.name, 'detail', l.detail) order by l.at desc), '[]'::json)
    from (select * from admin_log order by at desc limit 200) l left join shops s on s.id = l.shop_id);
end $$;

-- the statement upload is logged too
create or replace function public.admin_import_statement(p_rows jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  perform admin_check();
  r := import_bank_statement(p_rows);
  perform admin_write_log('import_statement', null, jsonb_build_object('lines', jsonb_array_length(p_rows)));
  return r;
end $$;

revoke execute on function public.admin_check(), public.admin_write_log(text, uuid, jsonb), public.admin_overview(), public.admin_shops(), public.admin_shop(uuid),
  public.admin_give_months(uuid, integer, text), public.admin_extend_trial(uuid, integer, text), public.admin_add_note(uuid, text),
  public.admin_payments(integer), public.admin_credits(boolean), public.admin_attach_credit(text, uuid, integer), public.admin_demand(integer),
  public.admin_activity(), public.admin_import_statement(jsonb) from public, anon;
grant execute on function public.admin_overview(), public.admin_shops(), public.admin_shop(uuid),
  public.admin_give_months(uuid, integer, text), public.admin_extend_trial(uuid, integer, text), public.admin_add_note(uuid, text),
  public.admin_payments(integer), public.admin_credits(boolean), public.admin_attach_credit(text, uuid, integer), public.admin_demand(integer),
  public.admin_activity(), public.admin_import_statement(jsonb) to authenticated;
-- admin_check / admin_write_log are called only from inside the functions above
grant execute on function public.admin_check(), public.admin_write_log(text, uuid, jsonb) to authenticated;
