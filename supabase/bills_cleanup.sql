-- My Market — bill PDFs are kept online for 2 days, then deleted. Safe to re-run.
--
-- The shop app removes its own bill PDFs older than 2 days each time it opens
-- (Supabase only lets files be deleted through its storage service, not plain SQL).
-- These rules let a shop see and delete the files in its own folder — nothing else.
-- The bill itself (items, totals) stays in the bills tables; only the PDF copy goes.

drop policy if exists bills_list_own on storage.objects;
create policy bills_list_own on storage.objects for select to authenticated
  using (case when bucket_id = 'bills' then public.is_my_shop(((storage.foldername(name))[1])::uuid) else false end);

drop policy if exists bills_delete_own on storage.objects;
create policy bills_delete_own on storage.objects for delete to authenticated
  using (case when bucket_id = 'bills' then public.is_my_shop(((storage.foldername(name))[1])::uuid) else false end);
