// My Market — server sync (Supabase).
// The apps keep working from data saved on the phone; this file sends every
// change to the server through a queue ("outbox") and downloads a shop's data
// when it logs in. Customers get real shops from the public views.
//
//   enqueue(op)  op = { op: "insert", table, row }      insert, ignore if already there
//                     { op: "update", table, id, patch }
//                     { op: "photo", shopId, itemId, dataUrl }
//   Ops are sent in order. A network failure stops the run and it retries later;
//   a data/permission error moves that op to "outboxFailed" so it can't block the rest.
(function () {
  const C = window.MM_CONFIG, A = window.MM_API;
  if (!C || !C.supabaseUrl || !window.supabase || !A) return; // no server configured → demo mode

  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "mm.auth" },
  });
  // Mobile number + 6-digit PIN become an email-style login. No email is ever sent
  // (email confirmation is off in the project), the address is only an identifier.
  const emailFor = (ph) => `91${ph}@phone.mymarket.in`;
  // Photos live in Cloudflare R2 (path "r2/<shop>/<file>") once C.photosUrl is set; older ones stay in Supabase storage.
  const photoUrl = (path) => (!path ? null : path.startsWith("r2/") && C.photosUrl ? `${C.photosUrl}/p/${path.slice(3)}`
    : `${C.supabaseUrl}/storage/v1/object/public/item-photos/${path}`);
  // the path a new photo gets: "r2/…" when the Cloudflare photo service is on
  const newPhotoPath = (p) => (C.photosUrl ? "r2/" + p : p);
  // save one photo at its path ("r2/…" → Cloudflare, otherwise Supabase storage)
  async function putPhoto(path, blob, replacePrefix = "") {
    if (!path.startsWith("r2/")) {
      const r = await sb.storage.from("item-photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (r.error) throw r.error;
      return;
    }
    if (!C.photosUrl) throw Object.assign(new Error("The photo service isn't set up"), { code: "photo" });
    const { data } = await sb.auth.getSession();
    if (!data.session) throw Object.assign(new Error("Not logged in"), { code: "auth" });
    let res;
    try {
      res = await fetch(`${C.photosUrl}/p/${path.slice(3)}`, { method: "PUT", body: blob,
        headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: C.supabaseKey, "Content-Type": "image/jpeg", ...(replacePrefix ? { "X-Replace-Prefix": replacePrefix } : {}) } });
    } catch (e) { throw new Error("network: " + e.message); }        // offline: retried later
    // an expired login or a busy service is retried later; a refused photo (wrong shop, too large) is not
    if (res.status === 401 || res.status >= 500) throw new Error("network: photo service " + res.status);
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw Object.assign(new Error(j.msg || "Photo not saved"), { code: "photo" + res.status }); }
  }

  const Q = {
    get: () => A.store.get("outbox", []),
    set: (v) => A.store.set("outbox", v),
    setFailed: (v) => A.store.set("outboxFailed", v),
    failed: () => A.store.get("outboxFailed", []),
  };
  let busy = false, timer = null, online = navigator.onLine, lastError = "";

  function status() {
    const detail = { pending: Q.get().length, failed: Q.failed().length, online, busy, lastError };
    window.dispatchEvent(new CustomEvent("mm-sync", { detail }));
    return detail;
  }
  function enqueue(op) {
    const o = Q.get(); o.push({ ...op, qid: Date.now() + "-" + Math.random().toString(36).slice(2, 7) }); Q.set(o);
    status(); schedule(250);
  }
  // "Sync now": changes the server refused before get one more try, oldest first.
  function retryFailed() {
    const f = Q.failed(); if (!f.length) return 0;
    Q.set([...f.map(({ error, at, ...op }) => op), ...Q.get()]); Q.setFailed([]);
    return f.length;
  }
  function schedule(ms = 0) { clearTimeout(timer); timer = setTimeout(flush, ms); }

  async function run(op) {
    let r;
    if (op.op === "insert") r = await sb.from(op.table).upsert(op.row, { onConflict: "id", ignoreDuplicates: true });
    else if (op.op === "update") r = await sb.from(op.table).update(op.patch).eq("id", op.id);
    else if (op.op === "photo") {
      const blob = await (await fetch(op.dataUrl)).blob();
      // Cloudflare: a new file name per photo (customers' phones keep photos cached for long); the item's older photo is removed
      const path = C.photosUrl ? `r2/${op.shopId}/${op.itemId}-${Date.now().toString(36)}.jpg` : `${op.shopId}/${op.itemId}.jpg`;
      await putPhoto(path, blob, C.photosUrl ? op.itemId + "-" : "");
      op.savedPath = path;
      r = await sb.from("items").update({ photo_path: path }).eq("id", op.itemId);
      // our own catalogue product gets the photo too (ignored if it isn't ours)
      if (!r.error && op.productId) await sb.from("catalog_products").update({ photo_path: path }).eq("id", op.productId).is("photo_path", null);
    }
    else if (op.op === "shopphoto") {
      const blob = await (await fetch(op.dataUrl)).blob();
      await putPhoto(op.path, blob);    // the path already says where it lives ("r2/…" or Supabase)
      r = await sb.from("shops").update(op.kind === "gallery" ? { gallery: op.gallery } : { [op.kind + "_path"]: op.path }).eq("id", op.shopId);
    }
    else if (op.op === "billpdf") {
      const blob = await (await fetch(op.dataUrl)).blob();
      r = await sb.storage.from("bills").upload(op.path, blob, { contentType: "application/pdf", upsert: false });
      if (r.error && /exist|duplicate/i.test(r.error.message || "")) r = { error: null }; // sent before
    }
    if (r && r.error) throw r.error;
    if (op.op === "photo" || op.op === "shopphoto") A.photoSent(op);
  }
  // A database answer (has a code / status) is permanent; a thrown fetch error is a network problem.
  const isNetwork = (e) => !e || (!e.code && !e.statusCode && /fetch|network|load failed|timeout/i.test(String(e.message || e)));

  async function flush() {
    if (busy) return status();
    online = navigator.onLine;
    if (!online || !Q.get().length) return status();
    const { data } = await sb.auth.getSession();
    if (!data.session) return status();
    busy = true; status();
    try {
      for (;;) {
        const o = Q.get(); if (!o.length) break;
        const op = o[0];
        // a request that hangs on weak mobile data must not freeze the queue: give up after 30 s and
        // try again on the next round (inserts and updates are safe to send twice)
        try { await Promise.race([run(op), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 30000))]); lastError = ""; }
        catch (e) {
          if (e && e.message === "timeout") { lastError = "Slow internet — will retry"; break; }
          if (isNetwork(e)) { online = false; lastError = "No internet"; break; }
          lastError = e.message || String(e);
          console.warn("[MM sync] not saved:", op, e);
          A.store.set("outboxFailed", [...Q.failed(), { ...op, error: lastError, at: Date.now() }].slice(-200));
        }
        Q.set(Q.get().filter((x) => x.qid !== op.qid));
      }
    } finally { busy = false; status(); }
    return status();
  }
  window.addEventListener("online", () => { online = true; schedule(0); const s = A.ownerShop(); if (s && s.cloud) topUpBillNos(s.id); });
  window.addEventListener("offline", () => { online = false; status(); });
  setInterval(() => schedule(0), 20000);

  // ---------- bill numbers: keep at least 100 of this phone's own in hand ----------
  let topping = null;
  function topUpBillNos(shopId) {
    if (topping || !shopId || A.billNosLeft(shopId) >= 100) return topping || Promise.resolve();
    topping = (async () => {
      try {
        const { data, error } = await sb.rpc("claim_bill_numbers", { p_shop: shopId, p_n: 200 });
        if (!error && Number.isInteger(data)) A.addBillNos(shopId, data, 200);
        else if (error) console.warn("[MM cloud] bill numbers:", error.message);
      } catch { /* offline: try again later */ }
      finally { topping = null; }
    })();
    return topping;
  }

  // ---------- login ----------
  function friendly(e) {
    const m = String(e?.message || e || "");
    if (/already registered|already exists/i.test(m)) return "This number already has a shop — log in instead";
    if (/invalid login credentials/i.test(m)) return "Wrong mobile number or PIN";
    if (/password/i.test(m)) return "PIN must be 6 digits";
    if (/rate limit|too many/i.test(m)) return "Too many tries — wait a few minutes and try again";
    if (/fetch|network/i.test(m)) return "No internet — this needs a connection";
    return m || "Something went wrong — try again";
  }
  // A shop's login stays when the shop is deleted. Registering again with that number reuses
  // the login (same PIN), as long as no shop is linked to it any more.
  async function hasShop(uid) {
    const [m, o] = await Promise.all([sb.from("shop_members").select("shop_id").eq("user_id", uid).limit(1), sb.from("shops").select("id").eq("owner_id", uid).limit(1)]);
    if (m.error || o.error) throw new Error(friendly(m.error || o.error));
    return !!(m.data.length || o.data.length);
  }
  async function signUp(ph, pin) {
    const { data, error } = await sb.auth.signUp({ email: emailFor(ph), password: pin });
    if (error && /already registered|already exists/i.test(error.message)) {
      const r = await sb.auth.signInWithPassword({ email: emailFor(ph), password: pin });
      if (r.error) throw new Error(/invalid login/i.test(r.error.message)
        ? "This number already has a My Market login. Use the same PIN as before, or tap Log in" : friendly(r.error));
      if (await hasShop(r.data.user.id)) { await signOut(); throw new Error("This number already has a shop — log in instead"); }
      return r.data.user.id;
    }
    if (error) throw new Error(friendly(error));
    if (!data.session) throw new Error("The server asks for email confirmation — it must be switched off in Supabase");
    return data.user.id;
  }
  async function signIn(ph, pin) {
    const { data, error } = await sb.auth.signInWithPassword({ email: emailFor(ph), password: pin });
    if (error) throw new Error(friendly(error));
    return data.user.id;
  }
  async function signOut() { try { await sb.auth.signOut(); } catch {} }
  async function userId() { const { data } = await sb.auth.getSession(); return data.session?.user?.id || null; }

  // ---------- download a shop (after login, or "Sync now") ----------
  async function pullShop() {
    const uid = await userId(); if (!uid) throw new Error("Not logged in");
    const one = async (q) => { const r = await q; if (r.error) throw new Error(friendly(r.error)); return r.data; };
    const mem = await one(sb.from("shop_members").select("shop_id").eq("user_id", uid).limit(1));
    const shop = mem.length ? await one(sb.from("shops").select("*").eq("id", mem[0].shop_id).maybeSingle())
      : await one(sb.from("shops").select("*").eq("owner_id", uid).maybeSingle()); // before members existed
    if (!shop) { await signOut(); throw new Error("No shop is linked to this number. To start a new shop, tap Register and use the same number and PIN"); }
    // the server keeps ~45 days of documents and one summary row per day before that
    const [items, docs, daily, markets] = await Promise.all([
      one(sb.from("items").select("*").eq("shop_id", shop.id)),
      one(sb.from("docs").select("*").eq("shop_id", shop.id).order("at", { ascending: false }).limit(5000)),
      one(sb.from("daily").select("day,sales,bills,profit,profit_known,pay,bought").eq("shop_id", shop.id).order("day", { ascending: false }).limit(800)),
      one(sb.from("markets").select("*")),
    ]);
    const pids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    const products = pids.length ? await one(sb.from("catalog_products").select("*").in("id", pids)) : [];
    // never replace the phone's copy while it still holds changes the server doesn't have
    if (Q.get().length || (Q.failed().length && A.ownerShopId() === shop.id))
      throw new Error("Some changes on this phone haven't reached the server yet — connect to the internet and tap Sync now again");
    A.hydrateShop({ shop, items, docs, daily, markets, products }, photoUrl);
    A.store.set("lastPull", Date.now());
    return shop.id;
  }

  // ---------- customers: the shops near them ----------
  // Only the nearest shops (up to 150 within 25 km) and their items are downloaded,
  // in pages of 1,000 rows (the server's maximum per request). Long product details
  // (features, description, specs) are fetched when a product page opens.
  const NEAR_KM = 25, NEAR_SHOPS = 150, PAGE = 1000;
  const LIGHT = "id,shop_id,name,brand,cat,price,mrp,photo_path,stock,updated_at,product_id,barcode,model,size,keywords,product_mrp,product_photo_path,product_photo_url,photo_credit";
  async function pages(build, cap = 60000) {
    const out = [];
    for (let from = 0; out.length < cap; from += PAGE) {
      const r = await build().range(from, from + PAGE - 1);
      if (r.error) throw r.error;
      out.push(...r.data);
      if (r.data.length < PAGE) break;
    }
    return out;
  }
  async function itemsFor(shopIds) {
    const chunks = []; for (let i = 0; i < shopIds.length; i += 60) chunks.push(shopIds.slice(i, i + 60));
    const res = await Promise.all(chunks.map((ids) => pages(() => sb.from("public_items").select(LIGHT).in("shop_id", ids).order("id"))));
    return res.flat();
  }
  const box = (q, loc, km) => { const dl = km / 111, dg = km / (111 * Math.cos(loc.lat * Math.PI / 180));
    return q.gte("lat", loc.lat - dl).lte("lat", loc.lat + dl).gte("lng", loc.lng - dg).lte("lng", loc.lng + dg); };
  let loadedAt = null;
  async function loadPublic(loc) {
    loc = loc || A.store.get("loc", null) || { lat: 28.6517, lng: 77.1905 };
    let shops;
    const near = await sb.rpc("public_shops_near", { p_lat: loc.lat, p_lng: loc.lng, p_km: NEAR_KM, p_limit: NEAR_SHOPS });
    if (!near.error) shops = near.data || [];
    else { // server not updated yet: same area, without nearest-first
      const r = await box(sb.from("public_shops").select("*"), loc, NEAR_KM).limit(NEAR_SHOPS);
      if (r.error) { console.warn("[MM cloud] shops not loaded", r.error.message); return 0; }
      shops = r.data;
    }
    const [m, items] = await Promise.all([
      box(sb.from("markets").select("*"), loc, NEAR_KM + 10).limit(PAGE),
      shops.length ? itemsFor(shops.map((s) => s.id)) : [],
    ]);
    loadedAt = { lat: loc.lat, lng: loc.lng };
    return A.mergePublic({ markets: m.data || [], shops, items }, photoUrl);
  }
  // The customer moved far from where shops were last loaded: load the new area.
  function movedTo(loc) {
    if (!loc || !loadedAt || A.distKm(loc, loadedAt) < 5) return Promise.resolve(0);
    return loadPublic(loc).catch(() => 0);
  }
  // One shop by id — a shared link, QR poster or bill can point anywhere in India.
  const triedShop = new Set();
  async function loadShop(id) {
    if (!/^[0-9a-f-]{36}$/.test(id) || triedShop.has(id)) return 0;
    triedShop.add(id);
    const s = await sb.from("public_shops").select("*").eq("id", id).maybeSingle();
    if (s.error || !s.data) return 0;
    const [m, items] = await Promise.all([
      s.data.market_id ? sb.from("markets").select("*").eq("id", s.data.market_id) : { data: [] },
      itemsFor([id]),
    ]);
    return A.mergePublic({ markets: m.data || [], shops: [s.data], items }, photoUrl);
  }
  async function itemDetails(itemId) {
    const { data } = await sb.from("public_items").select("features,description,specs").eq("id", itemId).maybeSingle();
    return data || null;
  }

  // ---------- what customers search for ----------
  // Sent straight away (no queue): only the words, matching categories, a
  // location rounded to ~1 km and how many shops had it.
  function logSearch({ q, cats, found }) {
    const loc = A.store.get("loc", null); if (!loc) return;
    const r2 = (x) => Math.round(x * 100) / 100;
    sb.from("searches").insert({ q: q.slice(0, 80), cats: cats || [], lat: r2(loc.lat), lng: r2(loc.lng), found: Math.min(999, found || 0) })
      .then(({ error }) => error && console.warn("[MM cloud] search not logged", error.message));
  }
  async function searchesNear(shopId, days = 7) {
    const { data, error } = await sb.rpc("searches_near", { p_shop: shopId, p_days: days, p_km: 3 });
    if (error) throw new Error(friendly(error));
    return data || [];
  }

  // ---------- product lookup by barcode ----------
  // 1) our shared catalogue  2) Open Food Facts (food, grocery)  3) Open Products Facts (other goods)
  // Open Food/Products Facts data is openly licensed: we keep the source and photo credit.
  async function lookupBarcode(code) {
    const { data } = await sb.from("catalog_products").select("*").eq("barcode", code).maybeSingle();
    if (data) return { source: "catalog", product: data };
    for (const [host, label, cat] of [["world.openfoodfacts.org", "Open Food Facts", "grocery"], ["world.openproductsfacts.org", "Open Products Facts", null]]) {
      try {
        const r = await fetch(`https://${host}/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,quantity,categories_tags,image_front_url`);
        if (!r.ok) continue;
        const j = await r.json(); const p = j.product;
        if (j.status !== 1 || !p || !(p.product_name_en || p.product_name)) continue;
        const tags = (p.categories_tags || []).join(" ");
        const guess = /beauty|cosmetic|hygiene|soap|shampoo|medic|pharma/.test(tags) ? "pharmacy" : /book|paper|station/.test(tags) ? "stationery" : cat || "grocery";
        return { source: "openfoodfacts", label, product: {
          id: null, barcode: code, name: (p.product_name_en || p.product_name).trim(), brand: (p.brands || "").split(",")[0].trim(), cat: guess,
          size: p.quantity || "", description: p.generic_name || "", features: [], specs: {}, keywords: [],
          photo_url: p.image_front_url || null, photo_credit: p.image_front_url ? `Photo: ${label} contributors (CC BY-SA)` : "" } };
      } catch { /* offline or blocked: try the next source */ }
    }
    return null;
  }

  // ---------- product search by name ----------
  // 1) the shared My Market catalogue (everything shops have added)
  const PCOLS = "id,barcode,name,brand,model,cat,size,mrp,features,description,specs,keywords,photo_path,photo_url,photo_credit,created_by,verified";
  async function searchCatalog(q) {
    const words = String(q || "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 4);
    if (!words.length) return [];
    const w = words.sort((a, b) => b.length - a.length)[0]; // the longest word narrows it on the server
    const { data, error } = await sb.from("catalog_products").select(PCOLS).or(`name.ilike.%${w}%,brand.ilike.%${w}%`).limit(60);
    if (error) throw error;
    const hay = (p) => `${p.name} ${p.brand || ""} ${p.model || ""} ${p.size || ""} ${(p.keywords || []).join(" ")}`.toLowerCase();
    return (data || []).filter((p) => words.every((x) => hay(p).includes(x))).slice(0, 30);
  }
  // 2) Open Food Facts / Open Products Facts by name (openly licensed, with photos)
  async function searchOnline(q) {
    const term = encodeURIComponent(String(q || "").trim().slice(0, 60)); if (!term) return [];
    let busy = 0;
    const one = async (host, label, india) => {
      try {
        const r = await fetch(`https://${host}/cgi/search.pl?search_terms=${term}&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,product_name_en,brands,quantity,image_front_small_url,image_front_url,categories_tags` +
          (india ? "&tagtype_0=countries&tag_contains_0=contains&tag_0=india" : ""));
        if (!r.ok) { busy++; return []; }
        const j = await r.json();
        return (j.products || []).filter((p) => (p.product_name_en || p.product_name) && /^[0-9]{6,14}$/.test(p.code || "")).map((p) => {
          const tags = (p.categories_tags || []).join(" ");
          return { code: p.code, name: (p.product_name_en || p.product_name).trim().slice(0, 120), brand: (p.brands || "").split(",")[0].trim(), size: p.quantity || "",
            img: p.image_front_small_url || p.image_front_url || null, photo: p.image_front_url || p.image_front_small_url || null, label,
            cat: /beauty|cosmetic|hygiene|soap|shampoo|medic|pharma/.test(tags) ? "pharmacy" : /book|paper|station/.test(tags) ? "stationery" : host.includes("food") ? "grocery" : null };
        });
      } catch { busy++; return []; }
    };
    // products sold in India first; the whole world only if India has too few
    let [a, b] = await Promise.all([one("world.openfoodfacts.org", "Open Food Facts", true), one("world.openproductsfacts.org", "Open Products Facts", true)]);
    if (a.length + b.length < 4) { const [c, d] = await Promise.all([one("world.openfoodfacts.org", "Open Food Facts"), one("world.openproductsfacts.org", "Open Products Facts")]); a = [...a, ...c]; b = [...b, ...d]; }
    const seen = new Set(), list = [...a, ...b].filter((p) => !seen.has(p.code) && seen.add(p.code)).slice(0, 20);
    if (!list.length && busy) throw new Error("busy");
    return list;
  }

  // ---------- bill PDFs for customers ----------
  // Stored as <shop>/<bill>-<random>.pdf (unguessable); the customer gets a link
  // to bill.html, which opens it.
  async function uploadBill(shopId, billId, blob) {
    const rand = [...crypto.getRandomValues(new Uint8Array(9))].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
    const path = `${shopId}/${billId}-${rand}.pdf`;
    const { error } = await sb.storage.from("bills").upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return new URL("bill.html", location.href).href.split("#")[0] + "#" + path;
  }
  // The link is decided first, so WhatsApp can open at once (inside the tap);
  // the PDF goes up through the queue a moment later and is retried until it's there.
  function billLink(shopId, billId) {
    const rand = [...crypto.getRandomValues(new Uint8Array(9))].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
    const path = `${shopId}/${billId}-${rand}.pdf`;
    return { path, link: new URL("bill.html", location.href).href.split("#")[0] + "#" + path + "~" + Date.now().toString(36) };
  }
  // Bill PDFs live online for 2 days (enough for the customer to open and save it),
  // then this shop's phone deletes them, so the free storage never fills up.
  const KEEP_MS = 2 * 86400000;
  async function cleanOldBills(shopId) {
    if (!shopId || Date.now() - A.store.get("billClean:" + shopId, 0) < 6 * 3600000) return 0;
    const cut = Date.now() - KEEP_MS; let gone = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const { data, error } = await sb.storage.from("bills").list(shopId, { limit: 100, offset: 0, sortBy: { column: "created_at", order: "asc" } });
        if (error) throw error;
        const old = (data || []).filter((f) => f.created_at && Date.parse(f.created_at) < cut).map((f) => `${shopId}/${f.name}`);
        if (!old.length) break;
        const r = await sb.storage.from("bills").remove(old);
        if (r.error) throw r.error;
        gone += old.length;
        if (old.length < 100) break;
      }
      A.store.set("billClean:" + shopId, Date.now());
    } catch (e) { console.warn("[MM cloud] old bill PDFs not cleaned:", e.message || e); }
    return gone;
  }
  // the customer's link: the bill page reads the bill from the database
  const billShareLink = (token) => new URL("bill.html", location.href).href.split("#")[0] + "#b=" + token;
  const billFileUrl = (path) => `${C.supabaseUrl}/storage/v1/object/public/bills/${path}`;

  // ---------- the shop's plan (free trial, ₹150/month) ----------
  async function myPlan(shopId) { const { data, error } = await sb.rpc("my_plan", { p_shop: shopId }); if (error) throw new Error(friendly(error)); return data; }
  async function claimPayment(shopId, ref, months) {
    const { data, error } = await sb.rpc("claim_payment", { p_shop: shopId, p_ref: ref, p_months: months });
    if (error) throw new Error(/fetch|network/i.test(error.message) ? "No internet — try again" : error.message);
    return data;
  }
  async function myPayments(shopId) {
    const { data, error } = await sb.from("payments").select("id,amount,months,method,ref,status,reason,created_at").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(24);
    if (error) throw new Error(friendly(error)); return data || [];
  }

  // ---------- staff: bank statement → payments done ----------
  async function isAdmin() { const { data } = await sb.rpc("is_admin"); return data === true; }
  async function importStatement(rows) {
    const out = [];
    for (let i = 0; i < rows.length; i += 400) {
      const { data, error } = await sb.rpc("import_bank_statement", { p_rows: rows.slice(i, i + 400) });
      if (error) throw new Error(friendly(error));
      out.push(...(data || []));
    }
    return out;
  }

  // ---------- orders from a shop's website (Hold it for me / Buy) ----------
  async function placeOrder(o) {
    const { data, error } = await sb.rpc("place_order", { p_shop: o.shopId, p_kind: o.kind, p_mode: o.mode, p_name: o.name, p_phone: o.phone,
      p_address: o.address || null, p_note: o.note || null, p_lines: o.lines.map((l) => ({ item_id: l.itemId, qty: l.qty })) });
    if (error) throw new Error(/fetch|network/i.test(error.message) ? "No internet — check your connection and try again" : error.message);
    return data;
  }
  async function orderStatus(token) { const { data, error } = await sb.rpc("order_status", { p_token: token }); if (error) throw error; return data; }
  async function cancelMyOrder(token) { const { data, error } = await sb.rpc("cancel_my_order", { p_token: token }); if (error) throw error; return data; }
  // the shop's side
  async function shopOrders(shopId) {
    const since = new Date(Date.now() - 4 * 86400000).toISOString();
    const { data, error } = await sb.from("orders").select("id,code,kind,mode,name,phone,address,note,lines,total,status,hold_until,created_at")
      .eq("shop_id", shopId).gte("created_at", since).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(friendly(error));
    return data || [];
  }
  async function setOrderStatus(id, status) {
    const { error } = await sb.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(friendly(error));
  }

  // ---------- shop website visits ----------
  const SRCS = ["app", "qr", "bill", "share", "gmaps", "link", "search"];
  function logVisit(shopId, kind, src) {
    if (!/^[0-9a-f-]{36}$/.test(shopId)) return;
    sb.from("shop_visits").insert({ shop_id: shopId, kind, src: SRCS.includes(src) ? src : "link" })
      .then(({ error }) => error && console.warn("[MM cloud] visit not logged", error.message));
  }
  async function visitsSummary(shopId, days = 7) {
    const { data, error } = await sb.rpc("shop_visits_summary", { p_shop: shopId, p_days: days });
    if (error) throw new Error(friendly(error));
    return data || [];
  }
  // the shop's public web page (customer app), with where the link was used
  const shopLink = (shopId, src) => new URL("index.html", location.href).href.split("#")[0] + `#/shop/${shopId}${src ? `?src=${src}` : ""}`;

  // ---------- login numbers (main + backup), PIN, devices ----------
  // A second client that keeps no session, so adding a number never logs this phone out.
  const tempClient = () => window.supabase.createClient(C.supabaseUrl, C.supabaseKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "mm.tmp" } });
  async function addLoginNumber(shopId, ph, pin) {
    const { data: code, error } = await sb.rpc("create_member_invite", { p_shop: shopId, p_phone: ph });
    if (error) throw new Error(friendly(error));
    const tmp = tempClient();
    let r = await tmp.auth.signUp({ email: emailFor(ph), password: pin });
    if (r.error && /already registered|already exists/i.test(r.error.message)) r = await tmp.auth.signInWithPassword({ email: emailFor(ph), password: pin });
    if (r.error) throw new Error(/invalid login/i.test(r.error.message) ? "This number already has a My Market login with a different PIN — use that PIN" : friendly(r.error));
    const j = await tmp.rpc("join_shop", { p_code: code });
    try { await tmp.auth.signOut(); } catch {}
    if (j.error) throw new Error(friendly(j.error));
  }
  async function loginNumbers(shopId) {
    const uid = await userId();
    const { data, error } = await sb.from("shop_members").select("user_id, phone, role, added_at").eq("shop_id", shopId).order("added_at");
    if (error) throw new Error(friendly(error));
    return (data || []).map((m) => ({ ...m, me: m.user_id === uid }));
  }
  async function removeLoginNumber(shopId, user) {
    const { error } = await sb.rpc("remove_member", { p_shop: shopId, p_user: user }); if (error) throw new Error(friendly(error));
  }
  async function checkPin(ph, pin) { // is this the right PIN? (without touching this phone's login)
    const tmp = tempClient(); const r = await tmp.auth.signInWithPassword({ email: emailFor(ph), password: pin });
    try { await tmp.auth.signOut(); } catch {}
    return !r.error;
  }
  async function changePin(pin) { const { error } = await sb.auth.updateUser({ password: pin }); if (error) throw new Error(friendly(error)); }
  async function logoutOthers() { const { error } = await sb.auth.signOut({ scope: "others" }); if (error) throw new Error(friendly(error)); }
  async function myNumber() { const { data } = await sb.auth.getSession(); const m = (data.session?.user?.email || "").match(/^91(\d{10})@/); return m ? m[1] : ""; }
  async function deleteShop(shopId) { const { error } = await sb.rpc("delete_my_shop", { p_shop: shopId }); if (error) throw new Error(friendly(error)); }

  window.MM_CLOUD = { ready: true, addLoginNumber, loginNumbers, removeLoginNumber, checkPin, changePin, logoutOthers, myNumber, deleteShop, logSearch, searchesNear, lookupBarcode, uploadBill, billFileUrl, billLink, logVisit, visitsSummary, shopLink, publicDone: false, isAdmin, importStatement, searchCatalog, searchOnline, myPlan, claimPayment, myPayments, placeOrder, orderStatus, cancelMyOrder, shopOrders, setOrderStatus, billShareLink, cleanOldBills, movedTo, loadShop, itemDetails, sb, enqueue, flush, status, retryFailed, topUpBillNos, signUp, signIn, signOut, userId, pullShop, loadPublic, photoUrl, newPhotoPath,
    pending: () => Q.get().length, failedOps: () => Q.failed() };

  // start-up
  if (window.MM_APP === "business") {
    // market list, so a new shop joins the right market when it registers
    sb.from("markets").select("*").then(({ data }) => {
      if (!data) return;
      const cm = data.map((m) => ({ id: m.id, name: m.name, area: m.area || "", locality: m.locality || "", pincode: m.pincode || "",
        lat: m.lat, lng: m.lng, radiusM: m.radius_m, pending: m.pending, tagline: m.tagline || "" }));
      A.store.set("cloudMarkets", cm);
      for (const m of cm) if (!A.D.MARKETS.find((x) => x.id === m.id)) A.D.MARKETS.push(m);
      window.dispatchEvent(new Event("mm-markets"));
    });
    flush().then(() => {
      const me = A.ownerShop(); if (me && me.cloud) { topUpBillNos(me.id); cleanOldBills(me.id); }
      // a phone that hasn't downloaded for 30 min picks up changes made on the shop's other phones
      const shop = A.ownerShop();
      if (shop && shop.cloud && !Q.get().length && !Q.failed().length && Date.now() - A.store.get("lastPull", 0) > 30 * 60000)
        pullShop().then(() => {
          // don't reload under someone's fingers: wait until they move to another page
          const busy = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || (document.querySelector("#sheet") && !document.querySelector("#sheet").classList.contains("hidden"));
          if (!busy()) location.reload(); else window.addEventListener("hashchange", () => location.reload(), { once: true });
        }).catch(() => {});
    });
  } else {
    loadPublic().then((n) => { window.MM_CLOUD.publicDone = true; if (window.MM_UI) window.MM_UI.route(); })
      .catch(() => { window.MM_CLOUD.publicDone = true; if (window.MM_UI) window.MM_UI.route(); });
  }
})();
