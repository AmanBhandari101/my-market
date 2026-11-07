# Customer site that Google can read

`site-worker.js` puts the customer app on its own address and gives every shop, and every product that's in stock in an area, a real page Google can list:

| Address | What it is |
|---|---|
| `/shop/sharma-electricals-karol-bagh` | A shop's page: name, address, hours, phone, items with prices. It opens the app's shop screen. |
| `/p/karol-bagh/philips-9w-led-bulb-9d6e77e2` | One product in one area, and the shops there that have it. It opens the app's "Where to buy" screen. |
| `/sitemap.xml` | The list of pages for Google, updated automatically |
| everything else | The normal customer app, fetched from GitHub Pages |

## How it scales

- **No work per shop.** Every shop gets a page automatically.
- **Only pages worth listing go to Google.** A shop is listed once it has a map location, an area name, at least 5 items and its website switched on. A product page in an area is listed only while a shop there has it in stock (updated within 7 days).
- **Few, useful pages.** There's one page per product per area, not one per shop, which avoids thousands of near-copies.
- **Low database use.** Each page takes one database call and is kept at Cloudflare for 30 minutes.
- **No public search-result pages,** which Google advises against.

## Setup (one time)

1. **Database.** In Supabase, open the **SQL editor**, paste `supabase/seo.sql` and run it.
   - Every shop gets its permanent link name.
2. **Worker.** In Cloudflare, go to **Workers & Pages**, then **Create**, then **Worker**, and name it `mymarket`.
   - Deploy the starter code, then choose **Edit code**, replace everything with `site-worker.js`, and deploy.
3. **Settings.** In the Worker's **Settings**, under **Variables**:
   - `SUPABASE_KEY` = the publishable key from `js/config.js`
   - The other settings have the right defaults built in: `SUPABASE_URL`, `APP_ORIGIN`, `PHOTOS_URL` and `SHOP_APP`.
4. **Check it.** Open `https://mymarket.<your-subdomain>.workers.dev/shop/<a shop's slug>`. Each shop's slug is in the `slug` column of the `shops` table.
   - Then paste the same link into https://search.google.com/test/rich-results. It should find a Store, or a Product on `/p/` pages.
5. **Own domain (recommended, about ₹700 a year).** Buy it, add it to Cloudflare, then in the Worker go to **Settings**, then **Domains & Routes**, then **Add**, then **Custom domain**.
   - All shops build up Google ranking on this one domain, so choose it before you start promoting the site.
6. **Switch the apps over.** In `js/config.js`, set `siteUrl` to the site address (the domain, or the workers.dev link), bump `?v=` in the html files, and push.
   - From then on, every shop's QR code, WhatsApp share and bill link uses the clean address.
   - QR posters that are already printed keep working.
7. **Google Search Console** (free): https://search.google.com/search-console
   - Add the domain, verify it with the DNS record it shows, then under **Sitemaps** submit `sitemap.xml`.
8. **Bing Webmaster Tools** (free, also feeds other search engines): import the site from Search Console.

## Notes

- **Shop owners don't move.** `business.html` and `admin.html` on the new address redirect to GitHub Pages, so owners keep their login there.
- **Visit counts** now also record `google` (arrived from Google) and `web` (any other arrival on the new site).
- **Link names never change.** A shop that renames itself keeps its old link.
- **At large scale:** the sitemap counts items per shop every time it's built. Past roughly 10,000 shops, move that count into a nightly summary table.
