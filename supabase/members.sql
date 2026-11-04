-- My Market — more than one login number per shop (main + backup), safely. Safe to re-run.
--
-- A shop has members: each is a login (mobile number + PIN) that can open the shop.
-- The number that registered is the first owner. The owner can add a backup number
-- (family member or second SIM) so a lost phone or SIM never locks them out.
-- Adding a number needs a one-time invite made by a logged-in owner, and only the
-- account for exactly that number can use it, within 15 minutes.

create table if not exists public.shop_members (
  shop_id   uuid not null references public.shops (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  phone     text,
  role      text not null default 'owner' check (role in ('owner', 'staff')),
  added_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user_idx on public.shop_members (user_id);

-- shops that exist already: their creator is the first owner
insert into public.shop_members (shop_id, user_id, phone, role)
  select s.id, s.owner_id, regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 'owner' from public.shops s
on conflict do nothing;

-- every new shop: its creator becomes the first owner
create or replace function public.shops_add_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into shop_members (shop_id, user_id, phone, role)
  values (new.id, new.owner_id, right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10), 'owner')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists shops_add_owner on public.shops;
create trigger shops_add_owner after insert on public.shops for each row execute function public.shops_add_owner();

-- "is this my shop?" now means "am I a member of it" — every policy uses this
create or replace function public.is_my_shop(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid());
$$;
create or replace function public.is_shop_owner(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid() and role = 'owner');
$$;

drop policy if exists shops_own_read on public.shops;
create policy shops_own_read on public.shops for select to authenticated using (owner_id = auth.uid() or public.is_my_shop(id));
drop policy if exists shops_own_edit on public.shops;
create policy shops_own_edit on public.shops for update to authenticated using (public.is_my_shop(id)) with check (public.is_my_shop(id));

alter table public.shop_members enable row level security;
drop policy if exists members_read on public.shop_members;
create policy members_read on public.shop_members for select to authenticated using (user_id = auth.uid() or public.is_my_shop(shop_id));
revoke insert, update, delete on public.shop_members from anon, authenticated;

-- one-time invites to add a login number
create table if not exists public.member_invites (
  code        text primary key,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  phone       text not null,
  role        text not null default 'owner',
  created_by  uuid,
  expires_at  timestamptz not null default now() + interval '15 minutes'
);
alter table public.member_invites enable row level security;
revoke all on public.member_invites from anon, authenticated;

create or replace function public.create_member_invite(p_shop uuid, p_phone text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_shop_owner(p_shop) then raise exception 'Only the shop owner can add a login number'; end if;
  if p_phone !~ '^[0-9]{10}$' then raise exception 'Enter a 10-digit mobile number'; end if;
  if (select count(*) from shop_members where shop_id = p_shop) >= 4 then raise exception 'A shop can have up to 4 login numbers'; end if;
  delete from member_invites where expires_at < now();
  c := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into member_invites (code, shop_id, phone, created_by) values (c, p_shop, p_phone, auth.uid());
  return c;
end $$;

create or replace function public.join_shop(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv member_invites; mine text;
begin
  select * into inv from member_invites where code = p_code and expires_at > now();
  if not found then raise exception 'This has expired — add the number again'; end if;
  mine := substring(coalesce(auth.jwt() ->> 'email', '') from '^91([0-9]{10})@');
  if mine is distinct from inv.phone then raise exception 'This login is for a different number'; end if;
  insert into shop_members (shop_id, user_id, phone, role) values (inv.shop_id, auth.uid(), inv.phone, inv.role) on conflict do nothing;
  delete from member_invites where code = p_code;
  return inv.shop_id;
end $$;

create or replace function public.remove_member(p_shop uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_shop_owner(p_shop) then raise exception 'Only the shop owner can remove a login number'; end if;
  if p_user = auth.uid() then raise exception 'You can''t remove the number you''re logged in with'; end if;
  delete from shop_members where shop_id = p_shop and user_id = p_user;
end $$;

-- delete the shop and everything in it (bills, stock, items…) — owner only
create or replace function public.delete_my_shop(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_shop_owner(p_shop) then raise exception 'Only the shop owner can delete the shop'; end if;
  delete from shops where id = p_shop;
end $$;

revoke execute on function public.create_member_invite(uuid, text), public.join_shop(text), public.remove_member(uuid, uuid), public.delete_my_shop(uuid) from anon, public;
grant execute on function public.create_member_invite(uuid, text), public.join_shop(text), public.remove_member(uuid, uuid), public.delete_my_shop(uuid) to authenticated;

-- reports for any member of the shop (were: only the creator)
create or replace function public.searches_near(p_shop uuid, p_days integer default 7, p_km double precision default 3)
returns table (q text, n bigint, missed bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select lat, lng from shops where id = p_shop and is_my_shop(p_shop) and lat is not null)
  select lower(x.q), count(*), count(*) filter (where x.found = 0), max(x.at)
  from searches x cross join me
  where x.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
    and x.lat between me.lat - p_km / 111.0 and me.lat + p_km / 111.0
    and 6371 * 2 * asin(sqrt(power(sin(radians(x.lat - me.lat) / 2), 2) +
          cos(radians(me.lat)) * cos(radians(x.lat)) * power(sin(radians(x.lng - me.lng) / 2), 2))) <= p_km
  group by lower(x.q) order by count(*) desc, max(x.at) desc limit 30;
$$;
create or replace function public.shop_visits_summary(p_shop uuid, p_days integer default 7)
returns table (kind text, src text, n bigint)
language sql stable security definer set search_path = public as $$
  select v.kind, v.src, count(*) from shop_visits v
  where v.shop_id = p_shop and is_my_shop(p_shop)
    and v.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by v.kind, v.src;
$$;
