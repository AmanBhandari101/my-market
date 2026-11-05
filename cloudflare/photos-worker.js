// My Market — photo storage on Cloudflare R2 (free: 10 GB, no charge when customers view photos).
//
// GET    /p/<shopId>/<file>.jpg   anyone: the photo (cached at Cloudflare's edge)
// PUT    /p/<shopId>/<file>.jpg   a logged-in member of that shop: save a photo
// DELETE /p/<shopId>/<file>.jpg   a logged-in member of that shop: remove a photo
//
// A write must carry the shopkeeper's own login token (Authorization: Bearer …).
// The worker asks Supabase "is this my shop?" with that token, so no secret key
// is needed anywhere: only the public Supabase URL and publishable key.
//
// Settings (Cloudflare dashboard → Worker → Settings):
//   R2 bucket binding  PHOTOS        → the bucket, e.g. "mymarket-photos"
//   Variable           SUPABASE_URL  → https://dhcpzdwzbndntnekuiud.supabase.co
//   Variable           SUPABASE_KEY  → the publishable key (same as js/config.js)
//   Variable           ALLOW_ORIGIN  → https://amanbhandari101.github.io  (where the apps run)

const MAX_BYTES = 1_500_000;                       // the apps send ~60–200 KB; this is a hard ceiling
const PATH = /^\/p\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{1,100}\.(?:jpg|webp))$/;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    const allowed = (env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type, x-replace-prefix",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, msg) => new Response(JSON.stringify({ ok: status < 300, msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/" || url.pathname === "/health") return reply(200, "My Market photos");
    const m = url.pathname.match(PATH);
    if (!m) return reply(404, "Not found");
    const [, shopId, file] = m, key = `${shopId}/${file}`;

    // ---------- read: public, cached for a year (file names change when a photo changes) ----------
    if (req.method === "GET" || req.method === "HEAD") {
      const cache = caches.default, ck = new Request(url.origin + url.pathname);
      let res = await cache.match(ck);
      if (res) return res;
      const obj = await env.PHOTOS.get(key);
      if (!obj) return reply(404, "Not found");
      res = new Response(req.method === "HEAD" ? null : obj.body, { headers: {
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: obj.httpEtag, "Access-Control-Allow-Origin": "*" } });
      if (req.method === "GET") ctx.waitUntil(cache.put(ck, res.clone()));
      return res;
    }

    if (req.method !== "PUT" && req.method !== "DELETE") return reply(405, "Not allowed");

    // ---------- write: only someone logged in to this shop ----------
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, "Log in first");
    const chk = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_my_shop`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_shop: shopId }),
    });
    if (chk.status === 401) return reply(401, "Your login has expired — open the app again");
    if (!chk.ok || (await chk.json()) !== true) return reply(403, "Not your shop");

    if (req.method === "DELETE") {
      await env.PHOTOS.delete(key);
      ctx.waitUntil(caches.default.delete(new Request(url.origin + url.pathname)));
      return reply(200, "Removed");
    }

    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!["image/jpeg", "image/webp"].includes(type)) return reply(415, "Only JPEG or WebP photos");
    if (+(req.headers.get("content-length") || 0) > MAX_BYTES) return reply(413, "Photo too large");
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return reply(413, "Photo too large");
    if (body.byteLength < 200) return reply(400, "Empty photo");
    await env.PHOTOS.put(key, body, { httpMetadata: { contentType: type } });

    // the item's older photos (same name start, e.g. "<itemId>-") are removed, so storage doesn't grow
    const prefix = (req.headers.get("x-replace-prefix") || "").trim();
    if (/^[A-Za-z0-9_-]{8,100}-$/.test(prefix)) {
      ctx.waitUntil((async () => {
        const list = await env.PHOTOS.list({ prefix: `${shopId}/${prefix}`, limit: 50 });
        const old = list.objects.map((o) => o.key).filter((k) => k !== key);
        if (old.length) await env.PHOTOS.delete(old);
      })());
    }
    return reply(200, "Saved");
  },
};
