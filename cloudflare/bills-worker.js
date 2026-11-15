// My Market — read a supplier's bill from a photo (Cloudflare Worker).
//
// POST /read   a logged-in member of the shop: { shopId, images: ["<base64 JPEG>", …] } (1–4 pages)
//              → { ok, bill: { supplier, bill_no, bill_date, lines: [...], bill_total, readable, problem }, used, limit }
// GET  /health → "My Market bills"
//
// The photo goes to Claude (Anthropic) to be read; it is not stored anywhere. Only the
// count of bills each shop reads is kept (Supabase table bill_scans, supabase/bill_scans.sql),
// so a shop can't read more than its monthly limit and the cost stays known.
//
// One file, pasted into the Cloudflare dashboard like photos-worker.js — no build step,
// so the Claude API is called over plain HTTPS.
//
// Settings (Cloudflare dashboard → Worker → Settings):
//   Secret    ANTHROPIC_API_KEY → from console.anthropic.com (never in the app or the repo)
//   Variable  SUPABASE_URL      → https://dhcpzdwzbndntnekuiud.supabase.co
//   Variable  SUPABASE_KEY      → optional: the publishable key (js/config.js)
//   Variable  ALLOW_ORIGIN      → https://amanbhandari101.github.io
//   Variable  MODEL             → optional, default claude-opus-5-5
//   Variable  EFFORT            → optional, default medium (low / medium / high)

const MAX_PAGES = 4;
const MAX_B64 = 1_600_000;            // per page; the app sends ~150–400 KB (1600 px JPEG)

const SYSTEM = `You read photos of bills that small Indian shops receive from their suppliers and wholesalers:
printed GST invoices, delivery challans, estimates and handwritten "kachcha" bills, in English, Hindi or both.
The shop will add the items to its stock, so only the item lines matter.

For every item line on the bill give:
- name: the item as written, in English letters (write Hindi words in Roman script, e.g. "Chini" not "चीनी"). Keep brand, size and pack (e.g. "Tata Salt 1 kg", "Parle-G 100g x 12").
- qty: how many units were bought, as a number. If the quantity is in packs/boxes/dozens, give that number and put the unit in "unit".
- unit: the unit written next to the quantity (pcs, box, doz, kg, pkt, set…), or "" if none.
- rate: the price of one unit as printed, before any bill-level tax. null if not written.
- amount: the line total as printed. null if not written.
- mrp: the MRP if a column shows it, else null.
- gst_pct: the GST rate for the line if shown, else null.
- hsn: the HSN code if shown, else "".
- unsure: true when any part of the line was hard to read or you had to guess.
- note: a short reason when unsure (e.g. "qty smudged"), else "".

Rules:
- Never invent a line or a number. If a number can't be read, use null and set unsure.
- Leave out rows that are not items: totals, sub-totals, discount, tax summary, round-off, freight, previous balance.
- If there are several photos they are pages of the same bill, in order; a line that appears twice because two photos overlap is listed once.
- supplier: the seller's name from the top of the bill ("" if not shown). bill_no and bill_date as written ("" if not shown).
- bill_total: the final amount payable as printed, else null.
- readable: false if the photo is not a bill or nothing can be read; then say why in "problem" (e.g. "too blurry", "not a bill") and give no lines.`;

const num = { anyOf: [{ type: "number" }, { type: "null" }] };
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["supplier", "bill_no", "bill_date", "lines", "bill_total", "readable", "problem"],
  properties: {
    supplier: { type: "string" }, bill_no: { type: "string" }, bill_date: { type: "string" },
    lines: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["name", "qty", "unit", "rate", "amount", "mrp", "gst_pct", "hsn", "unsure", "note"],
      properties: { name: { type: "string" }, qty: num, unit: { type: "string" }, rate: num, amount: num, mrp: num,
        gst_pct: num, hsn: { type: "string" }, unsure: { type: "boolean" }, note: { type: "string" } },
    } },
    bill_total: num, readable: { type: "boolean" }, problem: { type: "string" },
  },
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    const allowed = (env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) => new Response(JSON.stringify({ ok: status < 300, ...body }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    const fail = (status, msg) => reply(status, { msg });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/" || url.pathname === "/health") return reply(200, { msg: "My Market bills", ready: !!env.ANTHROPIC_API_KEY });
    if (url.pathname !== "/read" || req.method !== "POST") return fail(404, "Not found");
    if (!env.ANTHROPIC_API_KEY) return fail(503, "Bill reading isn't switched on yet");

    // ---------- who is asking: someone logged in to this shop ----------
    let body;
    try { body = await req.json(); } catch { return fail(400, "Bad request"); }
    const shopId = String(body.shopId || "");
    if (!/^[0-9a-f-]{36}$/.test(shopId)) return fail(400, "Bad request");
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_PAGES + 1) : [];
    if (!images.length || images.length > MAX_PAGES) return fail(400, `Send 1 to ${MAX_PAGES} photos`);
    if (images.some((b) => typeof b !== "string" || b.length < 500 || b.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(b))) return fail(413, "A photo is too large or not a JPEG");

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const apikey = env.SUPABASE_KEY || req.headers.get("apikey") || "";
    if (!token) return fail(401, "Log in first");
    if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$|^eyJ[A-Za-z0-9._-]+$/.test(apikey)) return fail(401, "Missing app key");
    const rpc = (fn, args) => fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: { apikey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });

    // counts this bill against the shop's monthly limit (and checks it is the caller's shop)
    const st = await rpc("bill_scan_start", { p_shop: shopId });
    if (st.status === 401) return fail(401, "Your login has expired — open the app again");
    const sj = await st.json().catch(() => null);
    if (!st.ok) { const msg = (sj && sj.message) || "Not your shop"; return fail(/not your shop/i.test(msg) ? 403 : 429, msg); }
    const { id: scanId, used, limit } = sj;

    // ---------- read the bill ----------
    const model = env.MODEL || "claude-opus-5-5";
    let r, j;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2026-10-21",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model, max_tokens: 16000,
          fallbacks: "default",
          output_config: { effort: env.EFFORT || "medium", format: { type: "json_schema", schema: SCHEMA } },
          system: SYSTEM,
          messages: [{ role: "user", content: [
            ...images.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
            { type: "text", text: images.length > 1 ? `These ${images.length} photos are the pages of one bill, in order. Read it.` : "Read this bill." },
          ] }],
        }),
      });
      j = await r.json().catch(() => null);
    } catch (e) { j = null; r = { ok: false, status: 0 }; }

    const usage = (j && j.usage) || {};
    const done = (ok, problem) => rpc("bill_scan_finish", { p_id: scanId, p_ok: ok, p_model: (j && j.model) || model,
      p_in: usage.input_tokens || 0, p_out: usage.output_tokens || 0, p_problem: problem || null }).catch(() => {});

    if (!r.ok || !j) {
      const why = (j && j.error && j.error.type) || `status ${r.status}`;
      await done(false, why);
      return fail(502, r.status === 429 || r.status === 529 ? "The bill reader is busy — try again in a minute" : "Couldn't read the bill — try again");
    }
    if (j.stop_reason === "refusal") { await done(false, "refusal"); return fail(422, "This photo couldn't be read — try another photo of the bill"); }
    if (j.stop_reason === "max_tokens") { await done(false, "max_tokens"); return fail(422, "The bill is too long for one go — photograph it in two parts"); }
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let bill;
    try { bill = JSON.parse(text); } catch { await done(false, "bad json"); return fail(502, "Couldn't read the bill — try again"); }
    await done(!!bill.readable, bill.readable ? null : bill.problem);
    return reply(200, { bill, used, limit });
  },
};
