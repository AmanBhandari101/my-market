# Reading supplier bills from a photo

In **Stock → Stock arrived**, a shop can take a photo of its supplier's bill. The app then lists each item with its quantity and rate, matched to the shop's own items. The owner checks the lines and adds them to the delivery.

## How it works
- **`bills-worker.js`:** a Cloudflare Worker. It sends the photos (1–4 pages, about 1600 px JPEG) to Claude (Anthropic) and gets the bill back as structured JSON.
- **Where the AI key lives:** only in the worker, as a secret. It is never in the app or the repo.
- **No photos kept:** photos are not stored. Only a count of bills read per shop (and the tokens used) goes into the `bill_scans` table.
- **Monthly limit:** each shop can read up to `bill_scan_limit()` bills a month (30). Failed attempts count too.
- **Model:** `claude-opus-5-5` at effort `medium`, with server-side refusal fallback. Roughly ₹4–5 per bill; check real figures with the cost query in `supabase/bill_scans.sql`.

## Setup (one time)
1. **Anthropic key.** At console.anthropic.com:
   - Add billing.
   - Set a monthly spend limit (e.g. $20).
   - Create an API key.
2. **Database.** Run `supabase/bill_scans.sql` in the Supabase SQL editor.
3. **Worker.**
   - Go to Cloudflare → **Workers & Pages → Create → Worker**, name it `mymarket-bills`, and deploy the starter.
   - Choose **Edit code**, replace everything with `bills-worker.js`, and deploy.
4. **Settings.** In the worker's **Settings → Variables and Secrets**:
   - **Secret:** `ANTHROPIC_API_KEY` = the key from step 1.
   - **Variable:** `SUPABASE_URL` = `https://dhcpzdwzbndntnekuiud.supabase.co`
   - **Variable:** `SUPABASE_KEY` = the publishable key in `js/config.js`.
   - **Variable:** `ALLOW_ORIGIN` = `https://amanbhandari101.github.io`
   - **Optional:** `MODEL` (default `claude-opus-5-5`) and `EFFORT` (default `medium`).
5. **Check it.** Open `https://mymarket-bills.<your-subdomain>.workers.dev/health`. It should show `"ready": true`.
6. **Switch it on in the app.** Put that address (without `/health`) in `js/config.js` → `billsUrl`, then publish. The **Photo of the supplier's bill** button appears in Stock arrived.

## Changing things later
- **Monthly limit:** change the number in `bill_scan_limit()` and re-run that function.
- **Cheaper model:** set the worker variable `MODEL` to `claude-haiku-5-5`, but only after checking it on real bills.
- **Turn it off:** empty `billsUrl` in `js/config.js` (the button disappears), or remove the worker's secret (the worker answers "isn't switched on yet").
