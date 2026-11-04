-- My Market — scan any code (barcode, QR, the shop's own sticker) to sell or receive an item. Safe to re-run.
--
-- Product barcodes already live in the shared catalogue (catalog_products.barcode).
-- items.code is the shop's own code for an item: a QR or sticker it scanned and
-- linked once, so the next scan finds the item straight away.

alter table public.items add column if not exists code text check (code is null or length(code) <= 200);
create index if not exists items_shop_code_idx on public.items (shop_id, code) where code is not null;
grant update (code) on public.items to authenticated;
