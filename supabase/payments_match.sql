-- My Market — mark plan payments done from the bank statement. Safe to re-run (after billing.sql).
--
-- Every shop has a payment code: "MM" + the first 8 characters of its shop id, e.g. MM9D6E77E2.
-- The app puts it first in the UPI payment note, so it appears in the bank statement line.
-- When statement lines come in (uploaded by staff now; an automatic feed later), each credit
-- is matched by that code: the payment is marked done and the shop's plan is extended.
-- Each bank transaction (UTR) is used once, so loading the same statement twice is safe.
--
-- Who may load statements: the numbers in public.admins. Add yours once (SQL editor):
--   insert into public.admins (phone) values ('98XXXXXXXX') on conflict do nothing;

create table if not exists public.admins (phone text primary key check (phone ~ '^[0-9]{10}$'));
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where phone = substring(coalesce(auth.jwt() ->> 'email', '') from '^91([0-9]{10})@'));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.shop_pay_code(p_shop uuid)
returns text language sql immutable as $$ select 'MM' || upper(left(replace(p_shop::text, '-', ''), 8)) $$;
create index if not exists shops_pay_code_idx on public.shops (public.shop_pay_code(id));

-- every credit seen in a statement, matched or not (so nothing is lost or counted twice)
create table if not exists public.bank_credits (
  utr         text primary key,
  amount      numeric not null,
  narration   text,
  credited_at timestamptz,
  code        text,
  shop_id     uuid references public.shops (id) on delete set null,
  payment_id  uuid references public.payments (id) on delete set null,
  status      text not null check (status in ('matched', 'no_code', 'unknown_shop', 'too_small')),
  loaded_at   timestamptz not null default now()
);
alter table public.bank_credits enable row level security;
revoke all on public.bank_credits from anon, authenticated;

-- one credit from the statement → mark the payment done
-- (inside these functions current_user is the owner, so the caller is checked with is_admin(),
--  the service key's role, or session_user — a direct SQL editor session)
create or replace function public.record_bank_credit(p_utr text, p_amount numeric, p_narration text, p_at timestamptz default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  u text := upper(regexp_replace(coalesce(p_utr, ''), '[^A-Za-z0-9]', '', 'g'));
  c text := substring(upper(coalesce(p_narration, '')) from 'MM[0-9A-F]{8}');
  sh uuid; m integer; pay uuid; st text;
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role' or session_user not in ('authenticator', 'anon', 'authenticated')) then raise exception 'Only My Market staff can load bank statements'; end if;
  if length(u) < 6 then raise exception 'Missing transaction ID (UTR)'; end if;
  if exists (select 1 from bank_credits where utr = u) then
    return json_build_object('utr', u, 'result', 'already_done');
  end if;
  if c is not null then select id into sh from shops where shop_pay_code(id) = c limit 1; end if;
  m := case when p_amount >= 1500 then 12 when p_amount >= 150 then least(11, floor(p_amount / 150)::integer) else 0 end;
  st := case when c is null then 'no_code' when sh is null then 'unknown_shop' when m < 1 then 'too_small' else 'matched' end;
  if st = 'matched' then
    -- the shop's own "I paid" claim becomes this payment; otherwise a new one is recorded
    update payments set status = 'confirmed', decided_at = now(), ref = coalesce(ref, u), months = m, amount = round(p_amount)
     where id = (select id from payments where shop_id = sh and status = 'claimed' order by created_at limit 1)
     returning id into pay;
    if pay is null then
      insert into payments (shop_id, amount, months, method, ref, status, decided_at, reason)
      values (sh, round(p_amount), m, 'upi', u, 'confirmed', now(), 'matched from bank statement')
      returning id into pay;
    end if;
    update shop_plans set paid_until = greatest(coalesce(paid_until, now()), trial_ends_at, now()) + make_interval(months => m), updated_at = now()
     where shop_id = sh;
  end if;
  insert into bank_credits (utr, amount, narration, credited_at, code, shop_id, payment_id, status)
  values (u, p_amount, left(p_narration, 300), p_at, c, sh, pay, st);
  return json_build_object('utr', u, 'result', st, 'code', c, 'shop_id', sh, 'months', m);
end $$;

-- a whole statement at once: [{utr, amount, narration, at}, …] → one result per line
create or replace function public.import_bank_statement(p_rows jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r jsonb; out jsonb := '[]'::jsonb;
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role' or session_user not in ('authenticator', 'anon', 'authenticated')) then raise exception 'Only My Market staff can load bank statements'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'Send up to 2,000 statement lines at a time'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    begin
      out := out || jsonb_build_array(record_bank_credit(r ->> 'utr', (r ->> 'amount')::numeric, r ->> 'narration', nullif(r ->> 'at', '')::timestamptz)::jsonb);
    exception when others then
      out := out || jsonb_build_array(jsonb_build_object('utr', r ->> 'utr', 'result', 'error', 'error', sqlerrm));
    end;
  end loop;
  return out;
end $$;

revoke execute on function public.record_bank_credit(text, numeric, text, timestamptz), public.import_bank_statement(jsonb) from public, anon;
grant execute on function public.record_bank_credit(text, numeric, text, timestamptz), public.import_bank_statement(jsonb) to authenticated;

-- staff: unmatched credits to look at by hand
create or replace function public.unmatched_credits()
returns setof public.bank_credits language sql stable security definer set search_path = public as $$
  select * from bank_credits where status <> 'matched' and is_admin() order by loaded_at desc limit 200;
$$;
revoke execute on function public.unmatched_credits() from public, anon;
grant execute on function public.unmatched_credits() to authenticated;
