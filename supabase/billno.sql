-- My Market — unique bill numbers when a shop bills from more than one phone. Safe to re-run.
--
-- Each phone asks the server for a block of numbers (e.g. 1001–1200) and uses
-- them, even offline. The next phone gets the next block (1201–1400), so two
-- phones never print the same bill number. A shop with one phone sees
-- 1001, 1002, 1003… as before.

alter table public.shops add column if not exists next_bill_no integer;
-- (not in the shops update grant: only the function below can change it)

create or replace function public.claim_bill_numbers(p_shop uuid, p_n integer default 200)
returns integer   -- the first number of the block; the block is [first, first + p_n - 1]
language plpgsql security definer set search_path = public as $$
declare first_no integer;
begin
  if not is_my_shop(p_shop) then raise exception 'Not your shop'; end if;
  p_n := greatest(10, least(p_n, 1000));
  update shops
     set next_bill_no = greatest(coalesce(next_bill_no, 1001),
                                 (select coalesce(max(no), 1000) + 1 from bills where shop_id = p_shop)) + p_n
   where id = p_shop
  returning next_bill_no - p_n into first_no;
  return first_no;
end $$;

revoke execute on function public.claim_bill_numbers(uuid, integer) from anon, public;
grant execute on function public.claim_bill_numbers(uuid, integer) to authenticated;
