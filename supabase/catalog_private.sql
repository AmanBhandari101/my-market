-- My Market — each shop's own products are private unless the shop shares them.
-- Run after catalog.sql. Safe to re-run.
--
-- Before: every product a shop added by hand went into the shared catalogue, so other shops saw it.
-- Now:    a product is private (only the shop that made it, and its login numbers, can read it)
--         unless the shop ticks "Share with other shops". Products already in the catalogue stay shared.
-- Customers still see a shop's own product details on that shop's page: public_items reads the
-- catalogue as the view's owner, not through these rules.

alter table public.catalog_products add column if not exists private boolean not null default false;
-- from now on new products are private unless the app says otherwise (also covers older app versions)
alter table public.catalog_products alter column private set default true;

drop policy if exists catalog_read on public.catalog_products;
create policy catalog_read on public.catalog_products for select
  using (not private or (created_by is not null and public.is_my_shop(created_by)));

-- the shop can share (or un-share) its own product later
grant update (private) on public.catalog_products to authenticated;

-- barcodes: unique among shared products; a private product may carry a barcode another shop also uses
alter table public.catalog_products drop constraint if exists catalog_products_barcode_key;
create unique index if not exists catalog_products_barcode_shared on public.catalog_products (barcode)
  where barcode is not null and not private;
create unique index if not exists catalog_products_barcode_own on public.catalog_products (created_by, barcode)
  where barcode is not null and private;
