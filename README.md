# My Market

Two web apps for local shops in India, in pilot:

| App | For | Open |
|---|---|---|
| **My Market** | Customers: find which nearby shop has an item, at what price, and walk straight to it | https://amanbhandari101.github.io/my-market/ |
| **My Market Business** | Shopkeepers: billing, stock, reports, a shop website — log in with mobile number + 6-digit PIN | https://amanbhandari101.github.io/my-market/business.html |

Both install on Android from Chrome (menu → *Install app*) and work offline; changes sync to a
Supabase project (Mumbai region) when the phone is online. There is no demo data — only shops that registered.

## Shop app (My Market Business)

Three tabs, built so a shopkeeper can bill as fast as a calculator.

| Tab | What it does |
|---|---|
| **Bill** | Tap or **scan** items (any barcode or QR — scan item after item, the camera stays open) to add them to the **cart** (top-bar cart icon shows the count). The cart is saved on the phone, so it survives moving between tabs or closing the app. **Cart page**: quantity −/+, remove, change price, discount, cash / UPI / card / khata, cash received and change, customer WhatsApp number → **Generate bill**. |
| **Stock** | Items with stock count, low / out of stock, *Stock arrived* (purchases from suppliers — tap or scan each piece), add items by **barcode** (shared catalogue → Open Food Facts → Open Products Facts) with photo and details. |
| **Reports** | Sales today / week / month with profit, daily chart, running low, not selling, what customers nearby searched for, all bills. |

Also in the shop app:
- **Bills are saved in the database** — every bill (items, prices, totals) is stored on the server with a private link code. With a customer number, WhatsApp opens on that customer's chat with the link; the bill page shows the bill straight from the database and makes the A4 PDF on the customer's phone when they tap *Download PDF*. No PDF file is stored, and links keep working. Cancelling a bill puts the stock back.
- **Scan codes** — a code the shop hasn't seen (its own QR sticker, an unlisted barcode) is linked to an item once; every later scan finds it.
- **Bill numbers** — each phone gets its own block of numbers from the server, so a shop billing from two phones never prints the same number, even offline.
- **Older PDF links** — bills sent before the database links were stored as PDF files; the shop app deletes those after 2 days.
- **Back up bills to Google Drive** — one PDF with every bill plus a sheet (CSV) for Google Sheets / Excel, shared to Drive from the phone. Reports reminds the owner after 7 days without a backup.
- **My website** — the shop's own page in the customer app: logo, cover, gallery, about, payments, delivery, link + QR poster, visits by source. **Google Maps**: step-by-step with every detail ready to copy (Google only lets the owner add or claim a shop).
- **Login & security** — main number + backup number (a lost phone or SIM never locks the shop out), change PIN, log out other phones, delete shop.
- **Safe offline use** — every change goes through a queue (outbox) and is retried; *Sync now* retries refused changes; the app never overwrites unsent changes with a download and warns before logging out with unsent bills; a full phone is detected and the bill is refused rather than silently lost.

## Customer app (My Market)

| Screen | What it does |
|---|---|
| Location | GPS or area search (OpenStreetMap) |
| Home | Map and nearby markets and shops, category filter |
| Search | English + Hinglish + typos; best match first, which shop has it, price, stock label (in / few / out) |
| Shop page | The shop's website: photos, about, hours, map, items with prices, WhatsApp and directions |
| Product page | Photo, price, stock, details, the same item at other shops |
| Directions | Walk / bike / car route, Google Maps hand-off |

The phone downloads only the **nearest 150 shops within 25 km** (and their items, in pages), so it stays fast
as more towns join. A shop opened from a shared link, QR poster or bill loads on its own from anywhere;
moving more than 5 km loads the new area.

## Server (Supabase)

Set up once in the Supabase SQL editor — the files in `supabase/`, in the order given in
[`supabase/SETUP.md`](supabase/SETUP.md):

`schema.sql` → `searches.sql` → `catalog.sql` → `bills.sql` → `visits.sql` → `shopsite.sql` → `members.sql` → `billno.sql` → `nearby.sql` → `bills_cleanup.sql` → `bill_share.sql` → `scan_codes.sql`

Row-level security keeps each shop's data private; customers read only the public views
(`public_shops`, `public_items` — stock as a label, never a count). The app holds only the publishable key.

**Free plan limits:** 500 MB database, 1 GB file storage, 5 GB data transfer a month; the project pauses after
about a week without use. Enough for a pilot of about 100–200 active shops; Supabase Pro takes it to thousands.

## Run it locally

No build step — plain HTML, CSS and JavaScript:
```
python -m http.server 8896
```
Open http://localhost:8896 (customer) or http://localhost:8896/business.html (shop).
GPS needs `localhost` or `https`. After changing JS/CSS, bump the `?v=` numbers in **both**
`index.html` and `business.html` so phones don't keep old files.

## Files

- `js/config.js` — Supabase URL + publishable key
- `js/data.js` — categories and the starter product catalogue
- `js/api.js` — data layer on the phone: shops, items, stock ledger, cart/bills, bill numbers, search, storage safety
- `js/cloud.js` — server sync: outbox, login, download a shop, nearby shops for customers, bill PDFs and their clean-up
- `js/app.js` — shared UI, router, customer screens, shop website page
- `js/shop.js` — product page
- `js/biz.js` — the shop app (bill, cart, scanning, stock, reports, website, backup, security)
- `js/billpdf.js` — the A4 bill PDF, shared by the shop app and the customer's bill page
- `bill.html` — the customer's bill page: reads the bill from the database, Download PDF
- `css/` — `app.css` (base), `commerce.css`, `store.css` (newer screens)
- `supabase/` — database setup and `SETUP.md`

## Not built yet

- PIN reset by OTP (needs an SMS / WhatsApp provider)
- A support contact for shopkeepers
- Khata (credit) ledger, Play Store apps

## Licence

Code: [MIT](LICENSE). Product photos in `img/items/` are not covered by MIT; each keeps its own
Wikimedia Commons licence, listed in [CREDITS.md](CREDITS.md).
