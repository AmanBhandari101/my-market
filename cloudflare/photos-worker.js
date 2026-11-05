// My Market — photo storage on Cloudflare (free plan, no card needed).
//
// GET    /p/<shopId>/<file>.jpg   anyone: the photo (cached at Cloudflare's edge for a year)
// PUT    /p/<shopId>/<file>.jpg   a logged-in member of that shop: save a photo
// DELETE /p/<shopId>/<file>.jpg   a logged-in member of that shop: remove a photo
//
// Photos are kept in a D1 database (free: 5 GB, no card). If an R2 bucket is bound
// as PHOTOS instead (R2 needs a card on file), that is used.
//
// A write must carry the shopkeeper's own login token (Authorization: Bearer …).
// The worker asks Supabase "is this my shop?" with that token, so no secret key
// is needed anywhere: only the public Supabase URL and publishable key.
//
// Settings (Cloudflare dashboard → Worker → Settings):
//   D1 database binding  DB            → the database, e.g. "mymarket-photos"
//   Variable             SUPABASE_URL  → https://dhcpzdwzbndntnekuiud.supabase.co
//   Variable             SUPABASE_KEY  → the publishable key (same as js/config.js)
//   Variable             ALLOW_ORIGIN  → https://amanbhandari101.github.io  (where the apps run)

const MAX_BYTES = 1_500_000;                       // the apps send ~60–200 KB; D1 rows can hold up to 2 MB
const PATH = /^\/p\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{1,100}\.(?:jpg|webp))$/;

// ---------- storage: D1 (default) or R2 ----------
let ready = false;
function store(env) {
  if (env.PHOTOS) return {
    get: async (k) => { const o = await env.PHOTOS.get(k); return o && { body: o.body, type: o.httpMetadata?.contentType }; },
    put: (k, shop, type, buf) => env.PHOTOS.put(k, buf, { httpMetadata: { contentType: type } }),
    del: (k) => env.PHOTOS.delete(k),
    dropOthers: async (shop, prefix, keep) => {
      const l = await env.PHOTOS.list({ prefix: `${shop}/${prefix}`, limit: 50 });
      const old = l.objects.map((o) => o.key).filter((k) => k !== keep); if (old.length) await env.PHOTOS.delete(old);
    },
  };
  const db = env.DB;
  const init = async () => {
    if (ready) return;
    await db.exec("CREATE TABLE IF NOT EXISTS photos (key TEXT PRIMARY KEY, shop TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, at INTEGER NOT NULL, data BLOB NOT NULL)");
    await db.exec("CREATE INDEX IF NOT EXISTS photos_shop ON photos (shop)");
    ready = true;
  };
  return {
    get: async (k) => {
      await init();
      const r = await db.prepare("SELECT type, data FROM photos WHERE key = ?").bind(k).first();
      return r && { body: new Uint8Array(r.data), type: r.type };
    },
    put: async (k, shop, type, buf) => {
      await init();
      await db.prepare("INSERT INTO photos (key, shop, type, size, at, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
        "ON CONFLICT(key) DO UPDATE SET type = ?3, size = ?4, at = ?5, data = ?6").bind(k, shop, type, buf.byteLength, Date.now(), buf).run();
    },
    del: async (k) => { await init(); await db.prepare("DELETE FROM photos WHERE key = ?").bind(k).run(); },
    dropOthers: async (shop, prefix, keep) => {
      await init();
      // prefix is checked to be letters, digits, "-" and "_" only, so it is safe inside LIKE
      await db.prepare("DELETE FROM photos WHERE shop = ?1 AND key LIKE ?2 AND key <> ?3").bind(shop, `${shop}/${prefix}%`, keep).run();
    },
  };
}

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
    const S = store(env);

    // ---------- read: public, cached for a year (file names change when a photo changes) ----------
    if (req.method === "GET" || req.method === "HEAD") {
      const cache = caches.default, ck = new Request(url.origin + url.pathname);
      let res = await cache.match(ck);
      if (res) return res;
      const obj = await S.get(key);
      if (!obj) return reply(404, "Not found");
      res = new Response(req.method === "HEAD" ? null : obj.body, { headers: {
        "Content-Type": obj.type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*" } });
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
      await S.del(key);
      ctx.waitUntil(caches.default.delete(new Request(url.origin + url.pathname)));
      return reply(200, "Removed");
    }

    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!["image/jpeg", "image/webp"].includes(type)) return reply(415, "Only JPEG or WebP photos");
    if (+(req.headers.get("content-length") || 0) > MAX_BYTES) return reply(413, "Photo too large");
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return reply(413, "Photo too large");
    if (body.byteLength < 200) return reply(400, "Empty photo");
    await S.put(key, shopId, type, body);

    // the item's older photos (same name start, e.g. "<itemId>-") are removed, so storage doesn't grow
    const prefix = (req.headers.get("x-replace-prefix") || "").trim();
    if (/^[A-Za-z0-9_-]{8,100}-$/.test(prefix)) ctx.waitUntil(S.dropOthers(shopId, prefix, key));
    return reply(200, "Saved");
  },
};
