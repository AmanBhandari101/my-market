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
  const photoUrl = (path) => (path ? `${C.supabaseUrl}/storage/v1/object/public/item-photos/${path}` : null);

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
      const path = `${op.shopId}/${op.itemId}.jpg`;
      r = await sb.storage.from("item-photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (!r.error) r = await sb.from("items").update({ photo_path: path }).eq("id", op.itemId);
      // our own catalogue product gets the photo too (ignored if it isn't ours)
      if (!r.error && op.productId) await sb.from("catalog_products").update({ photo_path: path }).eq("id", op.productId).is("photo_path", null);
    }
    else if (op.op === "shopphoto") {
      const blob = await (await fetch(op.dataUrl)).blob();
      r = await sb.storage.from("item-photos").upload(op.path, blob, { upsert: true, contentType: "image/jpeg" });
      if (!r.error) r = await sb.from("shops").update(op.kind === "gallery" ? { gallery: op.gallery } : { [op.kind + "_path"]: op.path }).eq("id", op.shopId);
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
        try { await run(op); lastError = ""; }
        catch (e) {
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
  async function signUp(ph, pin) {
    const { data, error } = await sb.auth.signUp({ email: emailFor(ph), password: pin });
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
    if (!shop) throw new Error("No shop is linked to this number");
    const since = new Date(Date.now() - 120 * 86400000).toISOString();
    const [items, bills, purchases, markets] = await Promise.all([
      one(sb.from("items").select("*").eq("shop_id", shop.id)),
      one(sb.from("bills").select("*, bill_lines(*)").eq("shop_id", shop.id).gte("at", since).order("at", { ascending: false }).limit(2000)),
      one(sb.from("purchases").select("*, purchase_lines(*)").eq("shop_id", shop.id).gte("at", since).order("at", { ascending: false }).limit(1000)),
      one(sb.from("markets").select("*")),
    ]);
    const pids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    const products = pids.length ? await one(sb.from("catalog_products").select("*").in("id", pids)) : [];
    // never replace the phone's copy while it still holds changes the server doesn't have
    if (Q.get().length || (Q.failed().length && A.ownerShopId() === shop.id))
      throw new Error("Some changes on this phone haven't reached the server yet — connect to the internet and tap Sync now again");
    A.hydrateShop({ shop, items, bills, purchases, markets, products }, photoUrl);
    A.store.set("lastPull", Date.now());
    return shop.id;
  }

  // ---------- customers: real shops from the public views ----------
  async function loadPublic() {
    const [m, s, i] = await Promise.all([
      sb.from("markets").select("*"),
      sb.from("public_shops").select("*").limit(2000),
      sb.from("public_items").select("*").limit(20000),
    ]);
    if (m.error || s.error || i.error) { console.warn("[MM cloud] public load failed", m.error || s.error || i.error); return 0; }
    return A.mergePublic({ markets: m.data, shops: s.data, items: i.data }, photoUrl);
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
    return { path, link: new URL("bill.html", location.href).href.split("#")[0] + "#" + path };
  }
  const billFileUrl = (path) => `${C.supabaseUrl}/storage/v1/object/public/bills/${path}`;

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

  window.MM_CLOUD = { ready: true, addLoginNumber, loginNumbers, removeLoginNumber, checkPin, changePin, logoutOthers, myNumber, deleteShop, logSearch, searchesNear, lookupBarcode, uploadBill, billFileUrl, billLink, logVisit, visitsSummary, shopLink, publicDone: false, sb, enqueue, flush, status, retryFailed, topUpBillNos, signUp, signIn, signOut, userId, pullShop, loadPublic, photoUrl,
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
      const me = A.ownerShop(); if (me && me.cloud) topUpBillNos(me.id);
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
