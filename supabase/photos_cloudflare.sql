-- My Market — photos now live on Cloudflare (cloudflare/photos-worker.js).
-- Run after schema.sql. Safe to re-run.
-- Stops new uploads to Supabase's item-photos store, so even an old app version can't add
-- photos here: its photo waits in the phone's queue until the app updates and sends it to
-- Cloudflare. Reading stays public, so any photo already here keeps showing.
drop policy if exists item_photos_upload  on storage.objects;
drop policy if exists item_photos_replace on storage.objects;
