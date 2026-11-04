# My Market — Supabase setup (free plan)

One-time setup of the server database. Takes about 10 minutes.

## 1. Create the project

1. Go to <https://supabase.com> → **Start your project** → sign in (GitHub sign-in is easiest).
2. **New project**
   - Organization: your personal one, plan **Free**
   - Name: `my-market`
   - Database password: click **Generate**, then save it in your password manager. You won't type it into the app — it is only for emergencies.
   - Region: **South Asia (Mumbai)**
3. Click **Create new project** and wait 1–2 minutes until it says the project is ready.

## 2. Create the tables

1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it in, click **Run**.
3. It should end with **Success. No rows returned**. If it shows an error, copy the red message and send it over.

Running it again later is safe.

4. Then do the same with `supabase/searches.sql` (what customers search for near each shop, for the Reports page).
5. Then `supabase/catalog.sql` (shared product catalogue) and `supabase/bills.sql` (bill PDFs sent to customers on WhatsApp).
6. Then `supabase/visits.sql` (visits to each shop's website page, for the shop's Reports).
7. Then `supabase/shopsite.sql` (logo, cover photo, gallery, about, payments and delivery on each shop's website).
8. Then `supabase/members.sql` (main + backup login numbers per shop, change PIN, delete shop).
9. Then `supabase/billno.sql` (each phone gets its own block of bill numbers, so two phones never print the same number).
10. Then `supabase/nearby.sql` (customers download only the shops near them).
11. Then `supabase/bills_cleanup.sql` (bill PDFs are deleted after 2 days by the shop's own app).
12. Then `supabase/bill_share.sql` (every bill is kept in the database; the customer's link shows it from there and makes the PDF on their phone).
13. Then `supabase/scan_codes.sql` (scan any barcode or QR to sell or receive an item).
14. Then `supabase/orders.sql` (customers order from a shop's website: Hold it for me / Buy).
15. Then `supabase/billing.sql` (2 months free, then ₹150/month: plan status, UPI payments, grace steps). To switch payments on, put your UPI ID in `js/config.js` (`payUpi`). Staff commands to confirm payments or give free months are at the top of the file.
16. Then `supabase/billing_v2.sql` (stricter missed-payment rules: website and analytics off after 7 days, read-only after 15 — enforced by the server).
17. Then `supabase/payments_match.sql` (bank statement lines with a shop's payment code mark its plan paid). Add your own number as staff once: `insert into public.admins (phone) values ('98XXXXXXXX');`
18. Then `supabase/admin.sql` (functions for the staff app, admin.html: overview, shops, payments, demand, activity log). Open **admin.html** and log in with a staff number.

## 3. Login settings

Shops log in with mobile number + 6-digit PIN. Behind the scenes that becomes an
email-style login that never sends email, so email confirmation must be off:

- Left menu → **Authentication** → **Sign In / Providers** → **Email**
- Keep **Enable Email provider** on
- Turn **Confirm email** **off** → **Save**

## 4. Copy two values for the app

Left menu → **Project Settings** → **API Keys** (and **Data API** for the URL):

| Copy this | Looks like | Safe to put in the app? |
|---|---|---|
| Project URL | `https://abcdefgh.supabase.co` | Yes |
| Publishable key (older projects: **anon public** key) | `sb_publishable_…` or a long `eyJ…` | Yes — it is meant to be public; the privacy rules protect the data |

**Never** share or put in the app: the **secret** / **service_role** key or the database password.

## What the setup file creates

| Table / view | Holds | Who can read it |
|---|---|---|
| `markets` | Market areas, pincodes | Everyone |
| `shops` | Shop details | Only that shop's owner |
| `items` | Items, prices, costs, stock count | Only that shop's owner |
| `stock_moves` | Every stock +/− (append-only) | Only that shop's owner |
| `bills`, `bill_lines` | Bills (can only be cancelled, never edited) | Only that shop's owner |
| `purchases`, `purchase_lines` | Stock arrived from suppliers | Only that shop's owner |
| `public_shops` (view) | Name, address, hours, phone | Everyone (customer app) |
| `public_items` (view) | Name, brand, photo, price, stock label (in / few / out / listed) | Everyone (customer app) |
| `item-photos` (storage) | Item photos, `<shop id>/<item id>.jpg` | Everyone can view; only that shop can upload |

The stock count on each item is recalculated by the database from `stock_moves`,
so bills made offline on two phones still add up correctly when they sync.

## Free plan limits to keep in mind

- 500 MB database, 1 GB photo storage — enough for a pilot of 10–30 shops for a long time.
- A free project **pauses after about a week with no activity**; open the dashboard and click **Restore** to wake it. Daily use keeps it awake.
- No downloadable backups on the free plan — a nightly backup job is part of the next steps.
