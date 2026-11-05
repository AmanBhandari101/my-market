# Photo storage on Cloudflare R2

Item photos and shop photos (logo, cover, gallery) can live on Cloudflare R2 instead of Supabase storage.
- **Free tier:** 10 GB of storage, no charge when customers view photos, and 100,000 photo-service requests a day.
- **Supabase:** keeps only each photo's path. Paths that start with `r2/` live on Cloudflare; older paths stay in Supabase storage and keep working.

## How it works
`photos-worker.js` is a small Cloudflare Worker:
- **`GET /p/<shopId>/<file>.jpg`:** anyone can view a photo. It's cached at Cloudflare for a year, which is safe because a changed photo always gets a new file name.
- **`PUT` / `DELETE`:** only for a logged-in member of that shop.
  - The app sends the shopkeeper's own login token.
  - The worker asks Supabase `is_my_shop` with that token, so the worker holds no secret key.
  - It accepts only JPEG or WebP, up to 1.5 MB.
  - Saving a new photo of an item removes that item's older photo.

## Setup (one time)
1. **Create an R2 bucket.** In the Cloudflare dashboard, go to **R2**, then **Create bucket**, and name it `mymarket-photos`.
   - R2 asks for a payment card even on the free tier, but nothing is charged under the free limits.
2. **Create the worker.** Go to **Workers & Pages**, then **Create**, then **Worker**, and name it `mymarket-photos`. Deploy the starter code, then choose **Edit code**, replace everything with `photos-worker.js`, and deploy again.
3. **Add settings.** In the worker's **Settings**:
   - **Bindings:** add an **R2 bucket** binding named `PHOTOS` pointing to `mymarket-photos`.
   - **Variables:**
     - `SUPABASE_URL` = `https://dhcpzdwzbndntnekuiud.supabase.co`
     - `SUPABASE_KEY` = the publishable key from `js/config.js`
     - `ALLOW_ORIGIN` = `https://amanbhandari101.github.io`
4. **Check it.** Open `https://mymarket-photos.<your-subdomain>.workers.dev/health`. It should say "My Market photos".
5. **Switch the apps over.** In `js/config.js`, set `photosUrl` to that address without `/health`, then publish.
   - From then on, new photos go to Cloudflare.
   - Existing photos stay where they are until they're moved (see below).

## Moving existing photos (optional)
Copy each `item-photos/<path>` object from Supabase storage to R2 at the same `<path>`. Then change the database paths to `r2/<path>` (`items.photo_path`, `shops.logo_path` / `cover_path` / `gallery`).
