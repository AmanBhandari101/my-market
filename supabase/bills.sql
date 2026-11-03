-- My Market — bill PDFs for sending to customers on WhatsApp. Safe to re-run.
--
-- A shop uploads the PDF of a bill to <shop id>/<bill id>-<random>.pdf and sends the
-- customer a WhatsApp link to it. The random part makes the address impossible
-- to guess; there is no way to list the files. Only the shop itself can upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bills', 'bills', true, 500000, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists bills_upload on storage.objects;
create policy bills_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'bills' and public.is_my_shop(((storage.foldername(name))[1])::uuid));
