// My Market v1 — data layer.
// Every screen talks to MM_API only. In v2 these functions become calls to
// the real backend (location, search, catalogue, live-ask, feedback services).

window.MM_API = (function () {
  const D = window.MM_DATA;
  const DAY = 86400000;
  const CONFIRM_FRESH_DAYS = 7; // "confirmed" turns into "listed" after this

  // ---------- storage helpers (per-device, wrapped so private mode works) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("mm." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    // Returns false when the phone's storage is full (after trying to free space),
    // so callers that must not lose data (bills) can stop and say so.
    set(k, v) {
      let txt; try { txt = JSON.stringify(v); } catch { return false; }
      try { localStorage.setItem("mm." + k, txt); return true; } catch {}
      try { if (freeSpace()) { localStorage.setItem("mm." + k, txt); return true; } } catch {}
      try { window.dispatchEvent(new CustomEvent("mm-storage-full")); } catch {}
      return false;
    },
    del(k) { try { localStorage.removeItem("mm." + k); } catch {} },
  };

  // ---------- one-time clean-up: remove old demo / test data from this device ----------
  try {
    if (store.get("dataVersion", 0) < 2) {
      const keep = new Set(["mm.auth", "mm.loc", "mm.recentLocs", "mm.range", "mm.outbox", "mm.outboxFailed"]);
      for (const k of Object.keys(localStorage)) if (k.startsWith("mm.") && !keep.has(k)) localStorage.removeItem(k);
      store.set("dataVersion", 2);
    }
  } catch {}

  const FULL = "Phone storage is full — this was NOT saved. Connect to the internet and tap Menu → Sync now, or free space on the phone.";
  // Make room: photos already on the server are kept as a link instead of the
  // photo itself, and old bills the server already has are dropped from the phone.
  function freeSpace() {
    const C = window.MM_CLOUD; if (!C || !C.photoUrl) return false;
    let changed = false;
    const pend = new Set((store.get("outbox", []) || []).filter((o) => o.op === "photo" || o.op === "shopphoto").map((o) => o.itemId || o.path));
    const cloudShops = new Set((store.get("shopsAdded", []) || []).filter((x) => x.cloud).map((x) => x.id));
    const oi = store.get("ownerItems", {});
    for (const [sid, list] of Object.entries(oi)) if (cloudShops.has(sid)) for (const it of list)
      if (typeof it.photo === "string" && it.photo.startsWith("data:") && !pend.has(it.id)) { it.photo = C.photoUrl(`${sid}/${it.id}.jpg`); changed = true; }
    const sa = store.get("shopsAdded", []);
    for (const sh of sa) if (sh.cloud) {
      for (const k of ["logo", "cover"]) if (typeof sh[k] === "string" && sh[k].startsWith("data:") && sh[k + "Path"] && !pend.has(sh[k + "Path"])) { sh[k] = C.photoUrl(sh[k + "Path"]); changed = true; }
      (sh.gallery || []).forEach((g, i) => { const p = (sh.galleryPaths || [])[i]; if (typeof g === "string" && g.startsWith("data:") && p && !pend.has(p)) { sh.gallery[i] = C.photoUrl(p); changed = true; } });
    }
    const old = Date.now() - 120 * DAY, sent = new Set((store.get("outbox", []) || []).filter((o) => o.table === "bills").map((o) => o.row?.id || o.id));
    const bills = store.get("bills", []), keep = bills.filter((b) => !cloudShops.has(b.shopId) || b.at > old || sent.has(b.id));
    const writes = [];
    if (changed) writes.push(["ownerItems", oi], ["shopsAdded", sa]);
    if (keep.length < bills.length) writes.push(["bills", keep]);
    let ok = false;
    for (const [k, v] of writes) try { localStorage.setItem("mm." + k, JSON.stringify(v)); ok = true; } catch {}
    try { if ((store.get("outboxFailed", []) || []).length > 50) { localStorage.setItem("mm.outboxFailed", JSON.stringify(store.get("outboxFailed", []).slice(-50))); ok = true; } } catch {}
    return ok;
  }
  // A photo reached the server: keep only its link on the phone.
  function photoSent(op) {
    const C = window.MM_CLOUD; if (!C) return;
    if (op.op === "photo") {
      const oi = store.get("ownerItems", {}), it = (oi[op.shopId] || []).find((x) => x.id === op.itemId);
      if (it && it.photo === op.dataUrl) { it.photo = C.photoUrl(`${op.shopId}/${op.itemId}.jpg`) + "?v=" + Date.now().toString(36); store.set("ownerItems", oi); }
    } else if (op.op === "shopphoto") {
      const sa = store.get("shopsAdded", []), sh = sa.find((x) => x.id === op.shopId); if (!sh) return;
      if (op.kind === "gallery") (sh.gallery || []).forEach((g, i) => { if (g === op.dataUrl) sh.gallery[i] = C.photoUrl(op.path); });
      else if (sh[op.kind] === op.dataUrl) sh[op.kind] = C.photoUrl(op.path);
      store.set("shopsAdded", sa);
    }
  }
  // Numbers the server accepts: whole rupees / pieces, within sane limits.
  const money = (v) => (v == null || v === "" || !isFinite(+v) ? null : Math.min(10000000, Math.max(0, Math.round(+v))));
  const count = (v) => Math.min(100000, Math.max(0, Math.round(+v || 0)));

  // ---------- server sync helpers ----------
  // Every record gets an id made on the phone, so a bill sent twice is saved once.
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const iso = (t) => new Date(t).toISOString();
  const ms = (t) => (t ? Date.parse(t) : null);
  // queue a change for the server — only for shops that live on the server
  function q(shopId, op) { if (window.MM_CLOUD && getShop(shopId)?.cloud) window.MM_CLOUD.enqueue(op); }
  const cloudOn = () => !!(window.MM_CLOUD && window.MM_CLOUD.ready);

  // ---------- demo relocation: move the pilot markets next to the user ----------
  function applyShift() {
    const s = store.get("demoShift", null);
    if (!s) return;
    for (const m of D.MARKETS) { m.lat += s.dLat; m.lng += s.dLng; }
    for (const sh of D.shops) { sh.lat += s.dLat; sh.lng += s.dLng; }
    D.PILOT.lat += s.dLat; D.PILOT.lng += s.dLng;
    D.PILOT.name = "Demo markets near you";
  }
  applyShift();

  // ---------- feedback overrides (found it / not here) ----------
  function applyFeedback() {
    const fb = store.get("feedback", {});
    for (const sh of D.shops) {
      for (const it of sh.items) {
        const f = fb[it.id];
        if (!f) continue;
        if (f.found) { it.lastConfirmed = f.at; it.reportedOut = null; }
        else { it.reportedOut = f.at; it.lastConfirmed = null; }
      }
      const t = store.get("trust", {})[sh.id];
      if (t != null) sh.trust = t;
    }
  }
  applyFeedback();

  // ---------- product photos ----------
  // Only photos that were checked by eye and clearly show the product.
  // Everything else gets a designed category tile until the shop adds a photo.
  const PHOTOS = new Set(("arduino-uno-board bluetooth-neckband canvas-shoes drill-machine-13-mm electric-plug-top-16a " +
    "extension-usb-hub-4-port hacksaw-blade hdmi-cable-1-5-m led-bulb-9w lightning-cable-iphone mcb-32a-single-pole " +
    "men-s-formal-shirt men-s-jeans mobile-back-cover otg-adapter-type-c pad-lock pendrive-64gb phone-battery-replacement " +
    "pressure-cooker-5-l punjabi-jutti pvc-pipe-1-inch-3-m sandpaper-sheet screwdriver-set spanner-set sports-shoes " +
    "steel-water-bottle-1-l storage-geyser-15-l teflon-tape tv-remote-control type-c-fast-charger-25w usb-keyboard " +
    "wi-fi-router wireless-mouse lunch-box measuring-tape-5-m").split(" "));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = (s) => {
    let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; // mix so similar ids spread out
    return (h >>> 0) / 4294967296;
  };
  const WARRANTY = { mobile: "6 months", electronics: "1 year", electrical: "1 year", hardware: "6 months", plumbing: "6 months", clothes: "No warranty", footwear: "No warranty", kitchen: "1 year", grocery: "No warranty", pharmacy: "No warranty", stationery: "No warranty", accessories: "6 months" };

  // Adds what a product page needs: photo, MRP (for "% off"), rating, specs.
  function enrich(it) {
    it.key = slug(it.name);
    it.img = it.photo || (PHOTOS.has(it.key) ? `img/items/${it.key}.jpg` : null) || it.productPhoto || null;
    const h = hash(it.key + it.brand);
    void h; void WARRANTY;
    // only real values: MRP if the shop entered one, no invented ratings or policies
    it.rating = it.rating || null;
    it.reviews = it.reviews || 0;
    it.specs = [["Brand", it.brand], it.model && ["Model", it.model], it.size && ["Size / quantity", it.size],
      ["Category", D.CATEGORIES[it.cat]?.name || it.cat], ...Object.entries(it.specMap || {}), it.barcode && ["Barcode", it.barcode]].filter(Boolean);
    return it;
  }

  // ---------- shop-owner data (claimed / added shops, stock edits) ----------
  function loadOwnerData() {
    for (const m of store.get("cloudMarkets", [])) if (!D.MARKETS.find((x) => x.id === m.id)) D.MARKETS.push(m);
    for (const s of store.get("shopsAdded", [])) {
      if (s.market && !D.MARKETS.find((m) => m.id === s.market.id)) D.MARKETS.push(s.market);
      if (!D.shops.find((x) => x.id === s.id)) D.shops.push(s);
    }
    const added = store.get("ownerItems", {});
    for (const [shopId, items] of Object.entries(added)) {
      const sh = D.shops.find((s) => s.id === shopId);
      if (sh) for (const it of items) if (!sh.items.find((x) => x.id === it.id)) sh.items.push(it);
    }
    const edits = store.get("itemEdits", {});
    const fb = store.get("feedback", {});
    for (const sh of D.shops) {
      sh.items = sh.items.filter((it) => !(edits[it.id] && edits[it.id].removed));
      for (const it of sh.items) {
        enrich(it);
        const e = edits[it.id];
        if (!e) continue;
        if (e.price != null) { it.price = e.price; it.mrp = Math.max(it.mrp || 0, e.price); }
        if (e.cost != null) it.cost = e.cost;
        if (e.reorderAt != null) it.reorderAt = e.reorderAt;
        if (e.inStock != null && (!fb[it.id] || fb[it.id].at < e.at)) {
          if (e.inStock) { it.lastConfirmed = e.at; it.reportedOut = null; }
          else { it.reportedOut = e.at; it.lastConfirmed = null; }
        }
      }
    }
    replayLedger();
  }

  // ---------- inventory: stock is a log of movements ----------
  // Each entry: { shopId, itemId, delta, set?, reason, at }. `set` = a full count
  // ("I have 12"), otherwise `delta` adds or removes. qty = seeded count + the log.
  // In v2 this log is a server table; the customer side only ever sees the label.
  const REASONS = {
    sold: "Sold at counter", order: "Online order", received: "New stock arrived", returned: "Customer return",
    damaged: "Damaged / expired", count: "Stock count", out: "Marked out of stock",
  };
  function applyEntry(it, e) {
    it.qtyRaw = e.set != null ? e.set : (it.qtyRaw ?? it.qty ?? 0) + e.delta;
    it.qty = Math.max(0, it.qtyRaw);
    it.stockAt = e.at;
    if (it.qty > 0) { it.lastConfirmed = e.at; if (it.reportedOut && it.reportedOut < e.at) it.reportedOut = null; }
  }
  function replayLedger() {
    const byItem = {}, base = store.get("ledgerBase", {});
    for (const e of store.get("ledger", [])) (byItem[e.itemId] = byItem[e.itemId] || []).push(e);
    for (const sh of D.shops) for (const it of sh.items) {
      const log = byItem[it.id], b = base[it.id]; if (!log && !b) continue;
      if (b) { it.qty = Math.max(0, b.q); it.qtyRaw = b.q; it.stockAt = b.at; if (b.q > 0) it.lastConfirmed = it.lastConfirmed || b.at; }
      else if (it.qty0 !== undefined) { it.qty = it.qty0; it.qtyRaw = undefined; it.stockAt = it.stockAt0; }
      for (const e of (log || []).sort((a, b) => a.at - b.at)) applyEntry(it, e);
    }
  }
  function moveStock(shopId, itemId, { delta = 0, set = null, reason = "count", ref = null }) {
    const it = getShop(shopId)?.items.find((x) => x.id === itemId); if (!it) return;
    const before = it.qty ?? 0;
    const e = { id: uuid(), shopId, itemId, delta: set != null ? set - before : delta, set, reason, at: Date.now(), ...(ref ? { ref } : {}) };
    const log = store.get("ledger", []); log.push(e);
    // a long history: fold the oldest moves into a per-item starting count, never just drop them
    if (log.length > 3000) {
      const base = store.get("ledgerBase", {}), old = log.splice(0, 1000).sort((a, b) => a.at - b.at);
      for (const o of old) {
        const cur = base[o.itemId] || (() => { const x = getShop(o.shopId)?.items.find((y) => y.id === o.itemId);
          return { shopId: o.shopId, q: x && x.qty0 !== undefined ? x.qty0 : 0, at: 0 }; })();
        cur.q = o.set != null ? o.set : cur.q + o.delta; cur.at = o.at; base[o.itemId] = cur;
      }
      store.set("ledgerBase", base);
    }
    store.set("ledger", log);
    applyEntry(it, e);
    q(shopId, { op: "insert", table: "stock_moves", row: { id: e.id, shop_id: shopId, item_id: itemId, delta: e.delta, set_to: set, reason, ref, at: iso(e.at) } });
    return it;
  }
  const stockLog = (itemId) => store.get("ledger", []).filter((e) => e.itemId === itemId).sort((a, b) => b.at - a.at);
  const lowAt = (it) => Math.max(1, it.reorderAt ?? 3);
  function inventory(shop) {
    const tracked = shop.items.filter((i) => i.qty != null);
    return {
      tracked: tracked.length, untracked: shop.items.length - tracked.length,
      units: tracked.reduce((a, i) => a + i.qty, 0),
      value: tracked.reduce((a, i) => a + i.qty * (i.cost || 0), 0),
      low: tracked.filter((i) => i.qty > 0 && i.qty <= lowAt(i)),
      out: tracked.filter((i) => i.qty === 0),
    };
  }
  loadOwnerData();

  // ---------- geo ----------
  function distKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(km) {
    if (km < 1) return Math.round(km * 1000 / 10) * 10 + " m";
    if (km < 10) return km.toFixed(1) + " km";
    return Math.round(km) + " km";
  }

  // A new area becomes a listed market once this many shops have joined it.
  const MARKET_MIN_SHOPS = 3;
  function marketsNear(loc, radiusKm = 10) {
    return D.MARKETS.map((m) => ({
      ...m,
      dist: distKm(loc, m),
      shopCount: D.shops.filter((s) => s.marketId === m.id).length,
      cats: [...new Set(D.shops.filter((s) => s.marketId === m.id).map((s) => s.cat))],
    })).filter((m) => m.dist <= radiusKm && m.shopCount > 0 && (!m.pending || m.shopCount >= MARKET_MIN_SHOPS)).sort((a, b) => a.dist - b.dist);
  }

  // ---------- "near me": travel time + a search area that widens ----------
  // The range caps how far we look; inside it we start small and widen until
  // there is enough to show. A dense bazaar shows walking-distance shops, a
  // quiet town still finds something.
  const RANGES = {
    walk: { label: "Walking", maxKm: 1.5 },
    ride: { label: "Short ride", maxKm: 5 },
    city: { label: "Whole city", maxKm: 25 },
  };
  const AREA_STEPS = [0.5, 1, 1.5, 2.5, 4, 5, 8, 12, 18, 25];
  const ROAD_FACTOR = 1.3; // straight line -> typical road distance in Indian cities
  function trip(km) {
    const road = km * ROAD_FACTOR;
    if (road <= 1.6) return { mode: "walk", min: Math.max(1, Math.round((road / 4.5) * 60)) };
    return { mode: "ride", min: Math.max(2, Math.round((road / 18) * 60)) };
  }
  const fmtTrip = (km) => { if (km > 40) return "in another city"; const t = trip(km); return `${t.min} min ${t.mode === "walk" ? "walk" : "ride"}`; };
  const getRange = () => (RANGES[store.get("range", "ride")] ? store.get("range", "ride") : "ride");
  const setRange = (k) => store.set("range", k);
  function widen(range, run, enough) {
    const max = RANGES[range].maxKm;
    for (const step of AREA_STEPS.filter((x) => x < max)) { const r = run(step); if (enough(r)) return { r, km: step, max }; }
    return { r: run(max), km: max, max };
  }
  // Home: the closest few markets and the shops around them.
  function nearArea(loc, range = getRange()) {
    const { r, km, max } = widen(range, (k) => ({ markets: marketsNear(loc, k), shops: shopsNear(loc, k) }), (x) => x.markets.length >= 3 || x.shops.length >= 12);
    return { ...r, km, max };
  }
  // Search: widen until at least 3 shops list the item.
  function nearSearch(q, loc, range = getRange()) {
    const shopsWith = (x) => new Set([...x.confirmed, ...x.listed].map((y) => y.shop.id)).size;
    const { r, km, max } = widen(range, (k) => search(q, loc, k), (x) => shopsWith(x) >= 3);
    if (!shopsWith(r) && !r.likely.length && !r.shopsByName.length) {
      const all = search(q, loc, 40000);
      const n = [...all.confirmed, ...all.listed, ...all.likely.map((sh) => ({ shop: sh }))].map((x) => x.shop.dist);
      if (n.length) return { ...all, km, max, far: Math.min(...n) };
    }
    return { ...r, km, max };
  }
  // Which market a point belongs to: the nearest one whose radius covers it.
  function marketFor(p) {
    const m = D.MARKETS.map((x) => ({ x, d: distKm(p, x) * 1000 })).sort((a, b) => a.d - b.d)[0];
    return m && m.d <= (m.x.radiusM || 350) ? m.x : null;
  }
  function shopsNear(loc, radiusKm = 10, cat = null) {
    return D.shops
      .filter((s) => !cat || s.cats.includes(cat))
      .map((s) => ({ ...s, dist: distKm(loc, s) }))
      .filter((s) => s.dist <= radiusKm)
      .sort((a, b) => a.dist - b.dist);
  }
  const getShop = (id) => D.shops.find((s) => s.id === id);
  const getMarket = (id) => D.MARKETS.find((m) => m.id === id);

  function isOpen(shop, d = new Date()) {
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    if (shop.closedDay === day) return false;
    const h = d.getHours() + d.getMinutes() / 60;
    return h >= shop.open && h < shop.close;
  }

  // item status: confirmed (green) | listed (amber) | out (red)
  function itemStatus(it) {
    if (it.qty != null && !(it.reportedOut && it.reportedOut > (it.stockAt || 0))) {
      const fresh = it.stockAt && Date.now() - it.stockAt < CONFIRM_FRESH_DAYS * DAY;
      if (it.qty <= 0) return { key: "out", label: "Out of stock" };
      if (!fresh) return { key: "listed", label: "Listed · stock not updated recently" };
      const few = it.qty <= lowAt(it);
      return { key: "confirmed", few, label: (few ? "Only a few left · " : "In stock · ") + ago(it.stockAt).replace("confirmed", "updated") };
    }
    if (it.reportedOut && Date.now() - it.reportedOut < CONFIRM_FRESH_DAYS * DAY) return { key: "out", label: "Reported not available" };
    if (it.lastConfirmed && Date.now() - it.lastConfirmed < CONFIRM_FRESH_DAYS * DAY) return { key: "confirmed", label: "In stock · " + ago(it.lastConfirmed) };
    return { key: "listed", label: "Listed · not confirmed recently" };
  }
  function ago(t) {
    const h = (Date.now() - t) / 3600000;
    if (h < 1) return "confirmed just now";
    if (h < 24) return `confirmed ${Math.round(h)}h ago`;
    const d = Math.round(h / 24);
    return `confirmed ${d} day${d > 1 ? "s" : ""} ago`;
  }

  // ---------- search ----------
  // Hindi / Hinglish / common-spelling words → English terms used in the catalogue.
  const SYN = {
    nal: ["tap"], tonti: ["tap"], tooti: ["tap"], tar: ["wire"], taar: ["wire"], bijli: ["electrical"],
    pankha: ["fan"], batti: ["bulb", "led"], light: ["led", "bulb", "batten"], joota: ["shoes"], jutta: ["shoes"],
    joote: ["shoes"], shoe: ["shoes"], chappal: ["slippers", "chappal"], kapda: ["clothes"], kapde: ["clothes"],
    kameez: ["shirt", "kurti"], pant: ["jeans", "pants"], saari: ["saree"], sari: ["saree"], bartan: ["utensil", "steel"],
    paip: ["pipe"], geezer: ["geyser"], gizer: ["geyser"], geaser: ["geyser"], ghanti: ["doorbell"], tala: ["lock"],
    taala: ["lock"], kabza: ["hinge"], pech: ["screws"], pechkas: ["screwdriver"], gond: ["adhesive", "fevicol"],
    phone: ["mobile"], headphone: ["earphones"], earphone: ["earphones"], headphones: ["earphones"],
    pendrive: ["pendrive"], "pen-drive": ["pendrive"], usb: ["usb"], cover: ["cover"], case: ["cover"],
    elbow: ["elbow"], bend: ["elbow"], valve: ["valve"], "ball-valve": ["ball", "valve"], tank: ["tank"],
    charger: ["charger"], chargr: ["charger"], cable: ["cable"], wire: ["wire"], typec: ["type-c"],
    iphone: ["lightning"], battery: ["battery"], screen: ["screen", "glass"], guard: ["glass"],
    drill: ["drill"], paint: ["primer", "paints"], cooker: ["cooker"], tawa: ["tawa"], tiffin: ["lunch"],
    bottle: ["bottle"], mixie: ["mixer"], mixi: ["mixer"], tv: ["tv"], remote: ["remote"],
    chawal: ["rice"], aata: ["atta"], doodh: ["milk"], tel: ["oil"], dal: ["dal"], cheeni: ["sugar"], chini: ["sugar"],
    chai: ["tea"], sabun: ["soap"], anda: ["eggs"], ande: ["eggs"], kirana: ["grocery"], ration: ["grocery"],
    dawai: ["paracetamol", "pharmacy"], dawa: ["paracetamol", "pharmacy"], medicine: ["pharmacy", "paracetamol"], tablet: ["tablets"],
    bukhar: ["paracetamol", "thermometer"], khansi: ["cough"], chemist: ["pharmacy"], medical: ["pharmacy"],
    kitab: ["book"], copy: ["notebook"], kalam: ["pen"], pen: ["pen"], pencil: ["pencils"], book: ["book", "dictionary"],
    ghadi: ["watch"], ghari: ["watch"], watch: ["watch"], basta: ["bag"], bag: ["bag", "backpack", "handbag"], batua: ["wallet"],
    purse: ["handbag", "wallet"], chashma: ["sunglasses"], chhata: ["umbrella"], chhatri: ["umbrella"],
  };
  const STOP = new Set(["ka", "ki", "ke", "for", "the", "a", "an", "of", "wala", "wali", "wale", "chahiye", "need", "want", "buy", "kahan", "where", "milega", "shop", "dukan", "and", "with", "me", "mein"]);

  function norm(s) {
    return s.toLowerCase()
      .replace(/(\d)\s*("|inch(es)?|in\b)/g, "$1 inch")
      .replace(/type\s*-?\s*c/g, "type-c")
      .replace(/sq\.?\s*mm/g, "sqmm")
      .replace(/[^a-z0-9\-\s]/g, " ")
      .split(/\s+/).filter(Boolean);
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  // strict = translated synonym: whole word (or plural) only, so "tap" never hits "tape".
  function tokMatch(q, t, strict) {
    if (q === t) return true;
    if (q.endsWith("s") && q.slice(0, -1) === t) return true;
    if (t.endsWith("s") && t.slice(0, -1) === q) return true;
    if (strict) return false;
    if (q.length >= 4 && (t.startsWith(q) || (t.length >= 4 && q.startsWith(t)))) return true;
    if (q.length >= 5 && lev(q, t) <= (q.length >= 7 ? 2 : 1)) return true;
    return false;
  }
  // Turns a query into groups of alternatives: each group must be matched by some token.
  function parseQuery(q) {
    const groups = [];
    for (const w of norm(q)) {
      if (STOP.has(w)) continue;
      const alts = [{ w, strict: false }, ...(SYN[w] || []).filter((s) => s !== w).map((s) => ({ w: s, strict: true }))];
      groups.push({ alts, num: /^\d/.test(w) });
    }
    return groups;
  }
  function itemTokens(it) {
    return norm(`${it.name} ${it.brand} ${it.model || ""} ${it.size || ""} ${(it.keywords || []).join(" ")} ${D.CATEGORIES[it.cat]?.name || ""} ${it.cat}`);
  }
  // Score 0..1 for how well a token list matches the parsed query.
  function score(groups, toks) {
    const words = groups.filter((g) => !g.num);
    const nums = groups.filter((g) => g.num);
    if (!words.length) return 0;
    let hit = 0;
    for (const g of words) if (g.alts.some((a) => toks.some((t) => tokMatch(a.w, t, a.strict)))) hit++;
    let s = hit / words.length;
    if (s && nums.length) {
      const nh = nums.filter((g) => toks.includes(g.alts[0].w)).length;
      s = s * 0.85 + 0.15 * (nh / nums.length);
    }
    return s;
  }
  // How well the query matches the item's own name (not just its category):
  // whole word 1, prefix / spelling 0.6, category only 0. "watch" ranks a
  // watch above a bag from the "Bags & Watches" category, "wire" ranks a
  // wire above "wired earphones".
  function nameRank(groups, it) {
    const toks = norm(`${it.name} ${it.brand}`);
    const words = groups.filter((g) => !g.num); if (!words.length) return 0;
    let r = 0;
    for (const g of words) {
      if (g.alts.some((a) => toks.some((t) => tokMatch(a.w, t, true)))) r += 1;
      else if (g.alts.some((a) => toks.some((t) => tokMatch(a.w, t, a.strict)))) r += 0.6;
    }
    return r / words.length;
  }
  // Which categories does this query belong to? Uses the whole catalogue, so a
  // shop can show as "likely" even if that exact item isn't in its list.
  function queryCategories(groups) {
    const cats = {};
    for (const [cat, list] of Object.entries(D.CATALOG)) {
      let best = score(groups, norm(`${D.CATEGORIES[cat].name} ${cat}`));
      for (const [n, b] of list) best = Math.max(best, score(groups, norm(`${n} ${b}`)));
      if (best >= 0.5) cats[cat] = best;
    }
    return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }

  function shopHas(shop, q) {
    const groups = parseQuery(q); if (!groups.length) return null;
    let best = null, bs = 0;
    for (const it of shop.items) { const sc = score(groups, itemTokens(it)); if (sc > bs) { bs = sc; best = it; } }
    return bs >= 0.6 ? best : null;
  }
  function search(q, loc, radiusKm = 10) {
    const groups = parseQuery(q);
    if (!groups.length) return { confirmed: [], listed: [], likely: [], shopsByName: [], cats: [] };
    const near = shopsNear(loc, radiusKm);
    const confirmed = [], listed = [], matchedShops = new Set();
    for (const sh of near) {
      for (const it of sh.items) {
        const s = score(groups, itemTokens(it));
        if (s < 0.6) continue;
        const st = itemStatus(it);
        if (st.key === "out") continue;
        const row = { shop: sh, item: it, score: s, rank: nameRank(groups, it), status: st };
        (st.key === "confirmed" ? confirmed : listed).push(row);
        matchedShops.add(sh.id);
      }
    }
    const byRank = (a, b) => (b.score - a.score) || (b.rank - a.rank) || (a.shop.dist - b.shop.dist) || (b.shop.trust - a.shop.trust);
    confirmed.sort(byRank); listed.sort(byRank);
    const cats = queryCategories(groups);
    const likely = near.filter((s) => !matchedShops.has(s.id) && s.cats.some((c) => cats.includes(c)));
    const shopsByName = near.filter((s) => score(groups, norm(s.name)) >= 0.99);
    return { confirmed, listed, likely, shopsByName, cats };
  }

  // ---------- owner identity ----------
  const ownerShopId = () => store.get("owner", null);
  const ownerShop = () => getShop(ownerShopId());
  const isOwnerShop = (id) => id && id === ownerShopId();

  // ---------- live ask ----------
  // Questions are stored so the shop owner's side (this same browser) can answer them.
  // Other shops reply automatically (SIMULATED; real version = WhatsApp Business API).
  function saveAsk(a) { const all = store.get("asks", []).filter((x) => x.id !== a.id); all.unshift(a); store.set("asks", all.slice(0, 50)); }
  const getAsk = (id) => store.get("asks", []).find((a) => a.id === id);
  function replyAsk(askId, shopId, reply) {
    const a = getAsk(askId); if (!a || a.replies[shopId]) return;
    a.replies[shopId] = { ...reply, at: Date.now() };
    saveAsk(a);
    // a "yes" from the shop confirms the item it matched
    const t = a.targets.find((x) => x.shopId === shopId);
    if (reply.has && t && t.itemId) setItem(shopId, t.itemId, { inStock: true });
  }
  function ask(q, loc) {
    const r = search(q, loc, 5);
    const candidates = [], seen = new Set();
    const own = ownerShop();
    for (const row of [...r.confirmed, ...r.listed]) if (!seen.has(row.shop.id)) { seen.add(row.shop.id); candidates.push({ shopId: row.shop.id, itemId: row.item.id }); }
    for (const s of r.likely) if (!seen.has(s.id)) { seen.add(s.id); candidates.push({ shopId: s.id, itemId: null }); }
    // the owner's own shop always gets the question if it sells that category
    if (own && !seen.has(own.id) && own.cats.some((c) => r.cats.includes(c))) candidates.unshift({ shopId: own.id, itemId: null });
    const a = { id: "q" + Date.now().toString(36), q, at: Date.now(), targets: candidates.slice(0, 8), replies: {} };
    saveAsk(a);
    const timers = [].filter(() => false).map((t, i) => setTimeout(() => { // simulated replies removed
      const it = t.itemId ? getShop(t.shopId).items.find((x) => x.id === t.itemId) : null;
      let reply;
      if (it && it.lastConfirmed) reply = { has: true, price: it.price };
      else if (it) reply = { has: Math.random() < 0.75, price: it.price };
      else reply = { has: Math.random() < 0.35, price: null };
      if (reply.has && reply.price == null && Math.random() < 0.6) reply.price = Math.round((100 + Math.random() * 900) / 10) * 10;
      if (Math.random() < 0.12) reply = { noReply: true };
      replyAsk(a.id, t.shopId, reply);
    }, 1500 + i * 700 + Math.random() * 3500));
    return { ask: a, cancel: () => timers.forEach(clearTimeout) };
  }
  const pendingAsks = (shopId) => store.get("asks", []).filter((a) => a.targets.some((t) => t.shopId === shopId) && !a.replies[shopId] && Date.now() - a.at < DAY);

  // ---------- search log (feeds the shop's "missed sales" report) ----------
  function logSearch(q, r) {
    q = q.trim().toLowerCase(); if (q.length < 2) return;
    const log = store.get("searchLog", []);
    if (log[0] && log[0].q === q && Date.now() - log[0].at < 60000) return;
    log.unshift({ q, at: Date.now(), cats: r.cats, hits: r.confirmed.map((x) => x.shop.id) });
    store.set("searchLog", log.slice(0, 300));
    if (window.MM_CLOUD && window.MM_APP !== "business")
      window.MM_CLOUD.logSearch({ q, cats: r.cats, found: new Set([...r.confirmed, ...r.listed].map((x) => x.shop.id)).size });
  }
  function addView(shopId) { const v = store.get("views", {}); v[shopId] = (v[shopId] || 0) + 1; store.set("views", v); }

  // ---------- owner tools ----------
  function claimShop(id) { store.set("owner", id); }
  function releaseShop() { store.del("owner"); if (cloudOn()) window.MM_CLOUD.signOut(); }
  // addr = { locality, pincode } from reverse geocoding (may be empty offline).
  function addShop(f, loc, addr = {}) {
    const id = uuid();
    const near = marketFor(loc);
    let market = null;
    // No market covers this spot: start a new area. It is listed as a market once
    // MARKET_MIN_SHOPS shops have joined; the shop itself shows in "near me" at once.
    if (!near) {
      market = { id: "m-" + id, name: f.area || addr.locality || "Local shops", area: addr.locality || f.area || "", lat: loc.lat, lng: loc.lng,
        radiusM: 300, pending: true, locality: addr.locality || "", pincode: addr.pincode || "", tagline: D.CATEGORIES[f.cat].name };
      D.MARKETS.push(market);
    }
    const home = near || market;
    // A pin far from every other shop is probably misplaced: flag it for a check.
    const nearestShop = Math.min(Infinity, ...D.shops.map((s) => distKm(loc, s)));
    const shop = {
      id, marketId: home.id, market, name: f.name,
      locality: addr.locality || home.locality || "", pincode: addr.pincode || home.pincode || "", needsCheck: nearestShop > 2, cat: f.cat, cats: [f.cat], shopNo: f.shopNo || "—",
      floor: f.floor || "Ground floor", landmark: f.landmark || "Ask for the shop by name", lat: loc.lat, lng: loc.lng,
      open: +f.open || 10, close: +f.close || 20, closedDay: f.closedDay || "None", phone: f.phone || "", rating: 0, ratings: 0,
      owner: f.owner || "", promo: f.promo || "", gst: f.gst || "",
      verified: false, trust: 0.7, items: [], own: true,
    };
    const all = store.get("shopsAdded", []); all.push(shop); store.set("shopsAdded", all);
    D.shops.push(shop); claimShop(id);
    return shop;
  }
  // ---------- shop accounts ----------
  // Register once with mobile number + PIN; the same pair logs in later.
  // DEMO: accounts live on this device (PIN stored only as a salted SHA-256
  // hash). v2 moves this to the server with an OTP on the number.
  const normPhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);
  async function pinHash(phone, pin, salt) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${phone}:${pin}`));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const accountFor = (phone) => store.get("accounts", []).find((a) => a.phone === normPhone(phone));
  // PINs that are too easy to guess
  function weakPin(pin, phone = "") {
    if (!/^\d{6}$/.test(pin)) return "PIN must be exactly 6 digits";
    if (/^(\d)\1{5}$/.test(pin) || "0123456789012".includes(pin) || "9876543210987".includes(pin) || /^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin))
      return "That PIN is too easy to guess — choose 6 mixed digits";
    if (phone && normPhone(phone).endsWith(pin)) return "Don't use the end of your mobile number as your PIN";
    return "";
  }
  async function registerShop(f, loc, addr, { phone, pin, backup = "" }) {
    const ph = normPhone(phone), bk = normPhone(backup);
    if (ph.length !== 10) throw new Error("Enter a 10-digit mobile number");
    const weak = weakPin(pin, ph); if (weak) throw new Error(weak);
    if (backup && bk.length !== 10) throw new Error("Backup number must be 10 digits");
    if (bk && bk === ph) throw new Error("The backup number must be a different number");
    if (cloudOn()) {
      // server account first: if the number is taken, nothing is created here
      const uid = await window.MM_CLOUD.signUp(ph, pin);
      const shop = addShop({ ...f, phone: `+91 ${ph.slice(0, 5)} ${ph.slice(5)}` }, loc, addr);
      shop.cloud = true; persistAddedShop(shop);
      if (shop.market) q(shop.id, { op: "insert", table: "markets", row: marketRow(shop.market) });
      q(shop.id, { op: "insert", table: "shops", row: shopRow(shop, uid) });
      await window.MM_CLOUD.flush();
      store.set("lastPull", Date.now());
      // the backup number can open the same shop if this phone or SIM is lost
      if (bk) { try { await window.MM_CLOUD.addLoginNumber(shop.id, bk, pin); shop.backupAdded = bk; }
                catch (x) { shop.backupError = x.message; } }
      return shop;
    }
    if (accountFor(ph)) throw new Error("This number already has a shop — log in instead");
    const shop = addShop({ ...f, phone: `+91 ${ph.slice(0, 5)} ${ph.slice(5)}` }, loc, addr);
    const salt = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
    store.set("accounts", [...store.get("accounts", []), { phone: ph, shopId: shop.id, owner: f.owner || "", salt, hash: await pinHash(ph, pin, salt), at: Date.now() }]);
    return shop;
  }
  async function login(phone, pin) {
    if (cloudOn()) {
      try {
        await window.MM_CLOUD.signIn(normPhone(phone), String(pin));
        const id = await window.MM_CLOUD.pullShop();
        claimShop(id);
        return { ok: true, reload: true };
      } catch (e) { return { ok: false, why: e.message }; }
    }
    const acc = accountFor(phone);
    if (!acc) return { ok: false, why: "No shop is registered with this number" };
    const tries = store.get("loginTries", {}); const t = tries[acc.phone] || { n: 0, until: 0 };
    if (Date.now() < t.until) return { ok: false, why: `Too many wrong PINs. Try again in ${Math.ceil((t.until - Date.now()) / 60000)} min` };
    if ((await pinHash(acc.phone, String(pin), acc.salt)) !== acc.hash) {
      t.n++; if (t.n >= 5) { t.until = Date.now() + 5 * 60000; t.n = 0; }
      tries[acc.phone] = t; store.set("loginTries", tries);
      return { ok: false, why: "Wrong PIN" };
    }
    delete tries[acc.phone]; store.set("loginTries", tries);
    claimShop(acc.shopId);
    return { ok: true };
  }
  function updateShop(id, patch) {
    const sh = getShop(id); if (!sh) return;
    Object.assign(sh, patch); persistAddedShop(sh);
    const row = {};
    if ("promo" in patch) row.promo = (patch.promo || "").slice(0, 90) || null;
    if ("phone" in patch) row.phone = patch.phone || null;
    if ("gst" in patch) row.gst = patch.gst || null;
    if ("about" in patch) row.about = (patch.about || "").slice(0, 600) || null;
    if ("payMethods" in patch) row.pay_methods = patch.payMethods || [];
    if ("delivery" in patch) row.delivery = !!patch.delivery;
    if (Object.keys(row).length) q(id, { op: "update", table: "shops", id, patch: row });
  }
  const shopRow = (sh, ownerId) => ({
    id: sh.id, owner_id: ownerId, name: String(sh.name).slice(0, 80), owner_name: sh.owner || null, phone: sh.phone || null, cat: sh.cat, cats: sh.cats,
    market_id: sh.marketId, shop_no: sh.shopNo, floor: sh.floor, landmark: sh.landmark, locality: sh.locality || null, pincode: sh.pincode || null,
    lat: sh.lat, lng: sh.lng, open_h: sh.open, close_h: sh.close, closed_day: sh.closedDay, promo: (sh.promo || "").slice(0, 90) || null, gst: sh.gst || null, needs_check: !!sh.needsCheck,
  });
  const marketRow = (m) => ({ id: m.id, name: m.name, area: m.area || null, locality: m.locality || null, pincode: m.pincode || null,
    lat: m.lat, lng: m.lng, radius_m: m.radiusM || 300, pending: true, tagline: m.tagline || null });
  const itemRow = (shopId, it) => ({ id: it.id, shop_id: shopId, name: String(it.name).slice(0, 120), brand: it.brand || null, cat: it.cat,
    price: it.price ?? null, mrp: it.mrp ?? null, cost: it.cost ?? null, reorder_at: it.reorderAt ?? 3 });
  // ---------- product details (shared catalogue) ----------
  // details d = { productId?, barcode, model, size, mrp, features[], description, specMap{}, keywords[],
  //               productPhoto (url), photoCredit, source }
  const DETAIL_KEYS = ["barcode", "model", "size", "features", "description", "specMap", "keywords", "productPhoto", "photoCredit", "productId", "productMine"];
  function persistOwnerItem(shopId, it) {
    const all = store.get("ownerItems", {}); const list = all[shopId] || [];
    const i = list.findIndex((x) => x.id === it.id);
    const copy = { ...it }; delete copy.specs; delete copy.img; delete copy.key;
    if (i >= 0) list[i] = copy; else list.push(copy);
    all[shopId] = list; store.set("ownerItems", all);
  }
  const productRow = (shopId, it, d) => ({
    id: d.productId, barcode: d.barcode || null, name: it.name, brand: it.brand || null, model: d.model || null, cat: it.cat, size: d.size || null,
    mrp: d.mrp ?? null, features: d.features || [], description: (d.description || "").slice(0, 1000) || null, specs: d.specMap || {}, keywords: d.keywords || [],
    photo_url: d.productPhoto && /^https:/.test(d.productPhoto) ? d.productPhoto : null, photo_credit: d.photoCredit || null,
    source: d.source || "shop", created_by: shopId,
  });
  // Save details for an item: link to an existing catalogue product, update our own
  // (unverified) one, or add a new product to the shared catalogue.
  function saveDetails(shopId, itemId, d) {
    const sh = getShop(shopId), it = sh?.items.find((x) => x.id === itemId); if (!it) return null;
    if (d.mrp != null) it.mrp = d.mrp;
    if (d.productId && d.productId !== it.productId && !d.productMine) {
      // someone else's catalogue product: link to it, don't change it
      Object.assign(it, pick(d)); it.productMine = false;
      q(shopId, { op: "update", table: "items", id: itemId, patch: { product_id: d.productId, ...(d.mrp != null ? { mrp: d.mrp } : {}) } });
    } else if (it.productId && it.productMine) {
      Object.assign(it, pick(d), { productId: it.productId, productMine: true });
      const row = productRow(shopId, it, { ...d, productId: it.productId }); delete row.id; delete row.created_by; delete row.source;
      q(shopId, { op: "update", table: "catalog_products", id: it.productId, patch: row });
      if (d.mrp != null) q(shopId, { op: "update", table: "items", id: itemId, patch: { mrp: d.mrp } });
    } else if (!it.productId || !d.productId) {
      const pid = uuid();
      Object.assign(it, pick(d), { productId: pid, productMine: true });
      q(shopId, { op: "insert", table: "catalog_products", row: productRow(shopId, it, { ...d, productId: pid }) });
      q(shopId, { op: "update", table: "items", id: itemId, patch: { product_id: pid, ...(d.mrp != null ? { mrp: d.mrp } : {}) } });
    }
    enrich(it); persistOwnerItem(shopId, it);
    return it;
  }
  function addPhoto(shopId, itemId, dataUrl) {
    const it = getShop(shopId)?.items.find((x) => x.id === itemId); if (!it) return;
    it.photo = dataUrl; enrich(it); persistOwnerItem(shopId, it);
    q(shopId, { op: "photo", shopId, itemId, dataUrl, productId: it.productMine ? it.productId : null });
  }
  function pick(d) { const o = {}; for (const k of DETAIL_KEYS) if (d[k] !== undefined) o[k] = d[k]; return o; }
  // Shop website photos: kind = "logo" | "cover" | "gallery". Shown at once from the
  // phone's copy; uploaded through the queue with a fresh file name (so no stale cache).
  function setShopPhoto(id, kind, dataUrl, galleryIndex = null) {
    const sh = getShop(id); if (!sh) return;
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${id}/shop-${kind}-${rand}.jpg`;
    if (kind === "gallery") {
      sh.gallery = sh.gallery || []; sh.galleryPaths = sh.galleryPaths || [];
      if (galleryIndex == null) { sh.gallery.push(dataUrl); sh.galleryPaths.push(path); }
      else { sh.gallery[galleryIndex] = dataUrl; sh.galleryPaths[galleryIndex] = path; }
    } else { sh[kind] = dataUrl; sh[kind + "Path"] = path; }
    persistAddedShop(sh);
    q(id, { op: "shopphoto", shopId: id, kind, path, dataUrl, gallery: kind === "gallery" ? [...sh.galleryPaths] : null });
  }
  function removeGalleryPhoto(id, i) {
    const sh = getShop(id); if (!sh || !sh.gallery) return;
    sh.gallery.splice(i, 1); (sh.galleryPaths || []).splice(i, 1);
    persistAddedShop(sh);
    q(id, { op: "update", table: "shops", id, patch: { gallery: [...(sh.galleryPaths || [])] } });
  }
  function persistAddedShop(shop) {
    const all = store.get("shopsAdded", []);
    const i = all.findIndex((s) => s.id === shop.id);
    if (i >= 0) { all[i] = { ...shop, items: [] }; store.set("shopsAdded", all); }
  }
  function setItem(shopId, itemId, patch) {
    patch = { ...patch };
    for (const k of ["price", "cost", "mrp"]) if (k in patch) patch[k] = patch[k] == null ? null : money(patch[k]) || null;
    if ("reorderAt" in patch && patch.reorderAt != null) patch.reorderAt = count(patch.reorderAt);
    const edits = store.get("itemEdits", {});
    edits[itemId] = { ...(edits[itemId] || {}), ...patch, at: Date.now() };
    store.set("itemEdits", edits);
    const row = {};
    if (patch.price != null) row.price = patch.price;
    if (patch.cost != null) row.cost = patch.cost;
    if (patch.reorderAt != null) row.reorder_at = patch.reorderAt;
    if (patch.mrp != null) row.mrp = patch.mrp;
    if (patch.removed) row.removed = true;
    if (Object.keys(row).length) q(shopId, { op: "update", table: "items", id: itemId, patch: row });
    const it = getShop(shopId)?.items.find((x) => x.id === itemId); if (!it) return;
    if (patch.price != null) { it.price = patch.price; }
    if (patch.mrp != null) it.mrp = patch.mrp;
    if (patch.inStock === true) { it.lastConfirmed = Date.now(); it.reportedOut = null; }
    if (patch.inStock === false) { it.reportedOut = Date.now(); it.lastConfirmed = null; }
    if (patch.removed) { const sh = getShop(shopId); sh.items = sh.items.filter((x) => x.id !== itemId); }
  }
  function addItem(shopId, [name, brand], cat) {
    const price = null; // the shop sets its own price
    const sh = getShop(shopId);
    if (sh.items.find((x) => x.name === name && x.brand === brand)) return null;
    const it = enrich({ id: uuid(), name, brand, cat: cat || sh.cat, price, lastConfirmed: Date.now(), addedAt: Date.now() });
    const all = store.get("ownerItems", {}); (all[shopId] = all[shopId] || []).push(it); store.set("ownerItems", all);
    sh.items.push(it);
    q(shopId, { op: "insert", table: "items", row: itemRow(shopId, it) });
    return it;
  }
  // A shop's own new item: name, price, optional photo (small JPEG data URL),
  // cost and opening quantity. The photo also shows in the customer app.
  function addOwnItem(shopId, { name, brand = "", cat, price = null, cost = null, photo = null, qty = null, details = null }) {
    const sh = getShop(shopId); if (!sh) return null;
    name = String(name || "").trim().slice(0, 120); brand = String(brand || "").trim().slice(0, 60);
    if (!name) return null;
    const same = (x) => x.name.trim().toLowerCase() === name.toLowerCase() && (x.brand || "Generic").toLowerCase() === (brand || "Generic").toLowerCase();
    if (sh.items.find(same)) return null;
    price = money(price); cost = money(cost); if (qty != null) qty = count(qty);
    const it = enrich({ id: uuid(), name, brand: brand || "Generic", cat: cat || sh.cat, price, cost, photo, lastConfirmed: Date.now(), addedAt: Date.now() });
    const all = store.get("ownerItems", {}); (all[shopId] = all[shopId] || []).push(it); store.set("ownerItems", all);
    sh.items.push(it);
    q(shopId, { op: "insert", table: "items", row: itemRow(shopId, it) });
    const photoOp = photo ? { op: "photo", shopId, itemId: it.id, dataUrl: photo } : null;
    if (details && Object.values(details).some((v) => v && (!Array.isArray(v) || v.length) && (typeof v !== "object" || Array.isArray(v) || Object.keys(v).length)))
      saveDetails(shopId, it.id, details);
    if (photoOp) q(shopId, { ...photoOp, productId: it.productMine ? it.productId : null }); // after the product exists
    if (!sh.cats.includes(it.cat)) sh.cats.push(it.cat);
    if (qty != null) moveStock(shopId, it.id, { set: qty, reason: "received" });
    return it;
  }
  // Stock arrived from a supplier: every line goes into stock, the purchase is kept for reports.
  function savePurchase(shopId, { lines, supplier = "", pay = "cash" }) {
    const p = { id: uuid(), shopId, at: Date.now(), supplier: supplier.trim().slice(0, 80), pay,
      lines: lines.filter((l) => l.qty > 0).map((l) => ({ id: uuid(), itemId: l.itemId, name: l.name, qty: Math.max(1, count(l.qty)), cost: money(l.cost) })) };
    if (!p.lines.length) throw new Error("Nothing to add");
    const pall = store.get("purchases", []); pall.unshift(p); if (!store.set("purchases", pall.slice(0, 1000))) throw new Error(FULL);
    p.total = p.lines.reduce((a, l) => a + (l.cost || 0) * l.qty, 0);
    q(shopId, { op: "insert", table: "purchases", row: { id: p.id, shop_id: shopId, at: iso(p.at), supplier: p.supplier || null, pay, total: p.total } });
    for (const l of p.lines) q(shopId, { op: "insert", table: "purchase_lines", row: { id: l.id, purchase_id: p.id, shop_id: shopId, item_id: l.itemId, name: l.name, qty: l.qty, cost: l.cost } });
    for (const l of p.lines) {
      moveStock(shopId, l.itemId, { delta: l.qty, reason: "received", ref: p.id });
      if (l.cost) setItem(shopId, l.itemId, { cost: l.cost });
      const it = getShop(shopId)?.items.find((x) => x.id === l.itemId); if (it && l.cost) it.cost = l.cost;
    }
    return p;
  }
  const purchasesFor = (shopId) => store.get("purchases", []).filter((p) => p.shopId === shopId);
  const catalogFor = (cat) => D.CATALOG[cat].map(([n, b, p]) => ({ tmpl: [n, b, p], name: n, brand: b, price: p, img: PHOTOS.has(slug(n)) ? `img/items/${slug(n)}.jpg` : null }));

  // "People searched for X near you and nobody had it" — the hook that tells a shop what to stock.
  function missedSales(shop) {
    const log = store.get("searchLog", []).filter((l) => Date.now() - l.at < 7 * DAY && l.cats.some((c) => shop.cats.includes(c)) && !l.hits.includes(shop.id));
    const counts = {};
    for (const l of log) counts[l.q] = (counts[l.q] || 0) + 1;
    return Object.entries(counts).map(([q, n]) => ({ q, n, real: true })).sort((a, b) => b.n - a.n).slice(0, 10);
  }

  // ---------- bag & orders ----------
  const getBag = () => store.get("bag", []);
  function addToBag(shopId, itemId, qty = 1) {
    const bag = getBag(); const l = bag.find((x) => x.itemId === itemId);
    if (l) l.qty = Math.min(20, l.qty + qty); else bag.push({ shopId, itemId, qty });
    store.set("bag", bag);
  }
  function setQty(itemId, qty) {
    let bag = getBag();
    if (qty <= 0) bag = bag.filter((x) => x.itemId !== itemId); else bag.find((x) => x.itemId === itemId).qty = Math.min(20, qty);
    store.set("bag", bag);
  }
  const bagCount = () => getBag().reduce((a, b) => a + b.qty, 0);
  function bagLines() {
    return getBag().map((l) => { const s = getShop(l.shopId); const it = s?.items.find((x) => x.id === l.itemId); return s && it ? { ...l, shop: s, item: it } : null; }).filter(Boolean);
  }

  const STEPS = {
    pickup: ["Order sent", "Shop accepted", "Ready for pickup", "Picked up"],
    delivery: ["Order sent", "Shop accepted", "Out for delivery", "Delivered"],
    reserve: ["Request sent", "Shop is keeping it", "Collected"],
  };
  function placeOrder({ shopId, lines, mode, pay, address }) {
    const items = lines.map((l) => ({ itemId: l.item.id, name: l.item.name, brand: l.item.brand, img: l.item.img, cat: l.item.cat, qty: l.qty, price: l.item.price || 0 }));
    const sub = items.reduce((a, b) => a + b.qty * b.price, 0);
    const fee = mode === "delivery" ? (sub >= 999 ? 0 : 39) : 0;
    const o = {
      id: "MM" + Date.now().toString(36).toUpperCase().slice(-6), code: String(1000 + Math.floor(Math.random() * 9000)),
      shopId, items, sub, fee, total: sub + fee, mode, pay, address: address || "", at: Date.now(), step: 0,
      paid: pay === "upi", history: [{ step: 0, at: Date.now() }],
    };
    const all = store.get("orders", []); all.unshift(o); store.set("orders", all);
    if (mode !== "reserve") store.set("bag", getBag().filter((b) => !lines.some((l) => l.item.id === b.itemId)));
    return o;
  }
  function saveOrder(o) { const all = store.get("orders", []).map((x) => (x.id === o.id ? o : x)); store.set("orders", all); }
  // Shops other than yours move orders forward on their own (simulated).
  function autoAdvance(o) {
    if (isOwnerShop(o.shopId) || o.cancelled || true) return o; // no simulated shop actions
    const last = STEPS[o.mode].length - 1;
    const t = (Date.now() - o.at) / 1000;
    const want = t > 90 ? last : t > 20 ? Math.min(2, last) : t > 6 ? 1 : 0;
    while (o.step < want) { o.step++; o.history.push({ step: o.step, at: o.at + [0, 6, 20, 90][o.step] * 1000 }); }
    return o;
  }
  const getOrders = () => store.get("orders", []).map(autoAdvance);
  const getOrder = (id) => getOrders().find((o) => o.id === id);
  function advanceOrder(id) {
    const o = store.get("orders", []).find((x) => x.id === id); if (!o) return;
    if (o.step < STEPS[o.mode].length - 1) {
      o.step++; o.history.push({ step: o.step, at: Date.now() });
      if (o.step === STEPS[o.mode].length - 1) {
        o.paid = true;
        // a finished order at a shop that counts stock takes the units out
        if (!o.stockDone) {
          for (const l of o.items) { const it = getShop(o.shopId)?.items.find((x) => x.id === l.itemId); if (it && it.qty != null) moveStock(o.shopId, l.itemId, { delta: -l.qty, reason: "order" }); }
          o.stockDone = true;
        }
      }
    }
    saveOrder(o);
  }
  function cancelOrder(id) { const o = store.get("orders", []).find((x) => x.id === id); if (o) { o.cancelled = Date.now(); saveOrder(o); } }
  const ordersFor = (shopId) => store.get("orders", []).filter((o) => o.shopId === shopId);

  // ---------- counter billing ----------
  // A bill = picked items x quantity; the app does the maths. Saving a bill
  // takes the units out of stock (for items the shop counts) and records the
  // sale. Bills are never edited: a cancel is a new "returned" stock entry.
  // lines: [{ itemId|null, name, qty, price, cost }]
  function billTotals(lines, discount = 0) {
    const sub = lines.reduce((a, l) => a + l.qty * l.price, 0);
    const disc = Math.min(Math.max(0, Math.round(discount || 0)), sub);
    return { sub, discount: disc, total: sub - disc, units: lines.reduce((a, l) => a + l.qty, 0) };
  }
  function saveBill(shopId, { lines, discount = 0, pay = "cash", phone = "", received = null }) {
    lines = (lines || []).map((l) => ({ ...l, name: String(l.name || "Item").slice(0, 120), qty: Math.max(1, count(l.qty)), price: money(l.price) ?? 0 })).filter((l) => l.qty > 0);
    if (!lines.length) throw new Error("The cart is empty");
    if (!["cash", "upi", "card", "khata"].includes(pay)) pay = "cash";
    const t = billTotals(lines, money(discount) || 0);
    if (t.sub > 2000000000) throw new Error("This bill is too large — check the quantities and prices");
    const seq = store.get("billSeq", {}); const mine = billsFor(shopId).reduce((a, b) => Math.max(a, b.no || 0), 0);
    seq[shopId] = Math.max(seq[shopId] || 1000, mine) + 1;
    const b = {
      id: uuid(), no: seq[shopId], shopId, at: Date.now(),
      lines: lines.map((l) => ({ id: uuid(), itemId: l.itemId || null, name: l.name, brand: l.brand || "", qty: l.qty, price: l.price, cost: l.cost ?? null })),
      ...t, pay, phone: phone || "", received: pay === "cash" && received ? money(received) : null,
    };
    const all = store.get("bills", []); all.unshift(b);
    if (!store.set("bills", all.slice(0, 2000))) throw new Error(FULL);
    store.set("billSeq", seq);
    q(shopId, { op: "insert", table: "bills", row: { id: b.id, shop_id: shopId, no: b.no, at: iso(b.at), sub: b.sub, discount: b.discount, total: b.total,
      units: b.units, pay, phone: b.phone || null, received: b.received } });
    for (const l of b.lines) q(shopId, { op: "insert", table: "bill_lines", row: { id: l.id, bill_id: b.id, shop_id: shopId, item_id: l.itemId,
      name: l.name, brand: l.brand || null, qty: l.qty, price: l.price, cost: l.cost } });
    for (const l of b.lines) {
      const it = l.itemId && getShop(shopId)?.items.find((x) => x.id === l.itemId);
      if (it && it.qty != null) moveStock(shopId, l.itemId, { delta: -l.qty, reason: "sold", ref: b.id });
    }
    return b;
  }
  function cancelBill(id) {
    const all = store.get("bills", []); const b = all.find((x) => x.id === id);
    if (!b || b.cancelled) return;
    b.cancelled = Date.now(); store.set("bills", all);
    q(b.shopId, { op: "update", table: "bills", id: b.id, patch: { cancelled_at: iso(b.cancelled) } });
    for (const l of b.lines) {
      const it = l.itemId && getShop(b.shopId)?.items.find((x) => x.id === l.itemId);
      if (it && it.qty != null) moveStock(b.shopId, l.itemId, { delta: l.qty, reason: "returned", ref: b.id });
    }
  }
  // A logged-in shop's data from the server replaces what this phone had for it.
  // The caller reloads the page afterwards so every screen starts from it.
  function hydrateShop({ shop: r, items, bills, purchases, markets, products }, photoUrl) {
    const prod = {}; for (const p of products || []) prod[p.id] = p;
    const cm = (markets || []).map((m) => ({ id: m.id, name: m.name, area: m.area || "", locality: m.locality || "", pincode: m.pincode || "",
      lat: m.lat, lng: m.lng, radiusM: m.radius_m, pending: m.pending, tagline: m.tagline || "" }));
    store.set("cloudMarkets", cm);
    const shop = {
      id: r.id, marketId: r.market_id, market: null, name: r.name, owner: r.owner_name || "", phone: r.phone || "", cat: r.cat,
      cats: r.cats && r.cats.length ? r.cats : [r.cat], shopNo: r.shop_no || "—", floor: r.floor || "Ground floor", landmark: r.landmark || "",
      locality: r.locality || "", pincode: r.pincode || "", lat: r.lat, lng: r.lng, open: r.open_h, close: r.close_h, closedDay: r.closed_day,
      promo: r.promo || "", gst: r.gst || "", verified: r.verified, needsCheck: r.needs_check, rating: 0, ratings: 0, trust: 0.7, items: [], own: true, cloud: true,
      ...siteDetails(r, photoUrl),
    };
    store.set("shopsAdded", [...store.get("shopsAdded", []).filter((s) => s.id !== r.id), shop]);
    const its = (items || []).filter((i) => !i.removed).map((i) => ({
      id: i.id, name: i.name, brand: i.brand || "Generic", cat: i.cat, price: i.price, mrp: i.mrp, cost: i.cost, reorderAt: i.reorder_at,
      qty: i.qty, qty0: i.qty, stockAt: ms(i.stock_at), stockAt0: ms(i.stock_at), lastConfirmed: i.qty > 0 ? ms(i.stock_at) : null,
      photo: photoUrl(i.photo_path), addedAt: ms(i.created_at),
      ...(prod[i.product_id] ? productDetails(prod[i.product_id], photoUrl, r.id) : {}),
    }));
    const oi = store.get("ownerItems", {}); oi[r.id] = its; store.set("ownerItems", oi);
    const ids = new Set((items || []).map((i) => i.id));
    const ed = store.get("itemEdits", {}); for (const k of Object.keys(ed)) if (ids.has(k)) delete ed[k]; store.set("itemEdits", ed);
    store.set("ledger", store.get("ledger", []).filter((e) => e.shopId !== r.id));
    const lb = store.get("ledgerBase", {}); for (const k of Object.keys(lb)) if (lb[k].shopId === r.id) delete lb[k]; store.set("ledgerBase", lb);
    const bl = (bills || []).map((b) => ({ id: b.id, no: b.no, shopId: r.id, at: ms(b.at), sub: b.sub, discount: b.discount, total: b.total, units: b.units,
      pay: b.pay, phone: b.phone || "", received: b.received, ...(b.cancelled_at ? { cancelled: ms(b.cancelled_at) } : {}),
      lines: (b.bill_lines || []).map((l) => ({ id: l.id, itemId: l.item_id, name: l.name, brand: l.brand || "", qty: l.qty, price: l.price, cost: l.cost })) }));
    store.set("bills", [...bl, ...store.get("bills", []).filter((b) => b.shopId !== r.id)].sort((a, b) => b.at - a.at));
    const seq = store.get("billSeq", {}); seq[r.id] = Math.max(seq[r.id] || 1000, ...bl.map((b) => b.no)); store.set("billSeq", seq);
    const pu = (purchases || []).map((p) => ({ id: p.id, shopId: r.id, at: ms(p.at), supplier: p.supplier || "", pay: p.pay, total: p.total,
      lines: (p.purchase_lines || []).map((l) => ({ id: l.id, itemId: l.item_id, name: l.name, qty: l.qty, cost: l.cost })) }));
    store.set("purchases", [...pu, ...store.get("purchases", []).filter((p) => p.shopId !== r.id)]);
    return shop;
  }
  const siteDetails = (r, photoUrl) => ({
    logo: r.logo_path ? photoUrl(r.logo_path) : null, cover: r.cover_path ? photoUrl(r.cover_path) : null,
    gallery: (r.gallery || []).map(photoUrl), galleryPaths: r.gallery || [], about: r.about || "", payMethods: r.pay_methods || [], delivery: !!r.delivery,
  });
  function productDetails(p, photoUrl, shopId) {
    return { productId: p.id, productMine: p.created_by === shopId && !p.verified, barcode: p.barcode || "", model: p.model || "", size: p.size || "",
      features: p.features || [], description: p.description || "", specMap: p.specs || {}, keywords: p.keywords || [],
      productPhoto: p.photo_path ? photoUrl(p.photo_path) : p.photo_url || null, photoCredit: p.photo_url && !p.photo_path ? p.photo_credit || "" : "" };
  }
  // Customer app: real shops from the server join the map and search.
  // Only public columns arrive: stock is a label (in / few / out / listed), never a count.
  function mergePublic({ markets, shops, items }, photoUrl) {
    for (const m of markets || []) if (!D.MARKETS.find((x) => x.id === m.id))
      D.MARKETS.push({ id: m.id, name: m.name, area: m.area || "", locality: m.locality || "", pincode: m.pincode || "", lat: m.lat, lng: m.lng, radiusM: m.radius_m, pending: m.pending, tagline: m.tagline || "" });
    const byShop = {};
    for (const i of items || []) (byShop[i.shop_id] = byShop[i.shop_id] || []).push(i);
    let n = 0;
    for (const r of shops || []) {
      if (getShop(r.id) || r.lat == null) continue;
      const sh = {
        id: r.id, marketId: r.market_id || null, name: r.name, cat: r.cat, cats: r.cats && r.cats.length ? r.cats : [r.cat],
        shopNo: r.shop_no || "—", floor: r.floor || "Ground floor", landmark: r.landmark || "", locality: r.locality || "", pincode: r.pincode || "",
        lat: r.lat, lng: r.lng, open: r.open_h, close: r.close_h, closedDay: r.closed_day, phone: r.phone || "", promo: r.promo || "",
        ...siteDetails(r, photoUrl),
        rating: 0, ratings: 0, verified: r.verified, trust: 0.8, live: true,
        items: (byShop[r.id] || []).map((i) => {
          const at = ms(i.updated_at);
          const qty = i.stock === "in" ? 10 : i.stock === "few" ? 1 : i.stock === "out" ? 0 : null;
          return enrich({ id: i.id, name: i.name, brand: i.brand || "Generic", cat: i.cat, price: i.price, mrp: i.mrp ?? i.product_mrp ?? null, reorderAt: 3,
            qty, stockAt: qty == null ? null : at, lastConfirmed: qty > 0 ? at : null, photo: photoUrl(i.photo_path),
            ...(i.product_id ? productDetails({ id: i.product_id, barcode: i.barcode, model: i.model, size: i.size, features: i.features, description: i.description,
              specs: i.specs, keywords: i.keywords, photo_path: i.product_photo_path, photo_url: i.product_photo_url, photo_credit: i.photo_credit, verified: true }, photoUrl, null) : {}) });
        }),
      };
      if (!sh.marketId || !D.MARKETS.find((m) => m.id === sh.marketId)) {
        const near = marketFor(sh); sh.marketId = near ? near.id : null;
      }
      if (!sh.marketId) { // a shop in an area with no market yet: give it a stand-alone one
        const m = { id: "solo-" + r.id, name: r.locality || r.name, area: r.locality || "", locality: r.locality || "", pincode: r.pincode || "", lat: r.lat, lng: r.lng, radiusM: 200, pending: true, tagline: D.CATEGORIES[r.cat]?.name || "" };
        D.MARKETS.push(m); sh.marketId = m.id;
      }
      D.shops.push(sh); n++;
    }
    return n;
  }
  function setBillLink(id, link) {
    const all = store.get("bills", []); const b = all.find((x) => x.id === id);
    if (b) { b.pdfLink = link; store.set("bills", all); }
  }
  const billsFor = (shopId) => store.get("bills", []).filter((b) => b.shopId === shopId);
  const getBill = (id) => store.get("bills", []).find((b) => b.id === id);
  // Today's money: sales by payment type and profit (where the cost is known).
  function daySummary(shopId, day = new Date()) {
    const from = new Date(day); from.setHours(0, 0, 0, 0);
    const to = from.getTime() + DAY;
    const bills = billsFor(shopId).filter((b) => !b.cancelled && b.at >= from.getTime() && b.at < to);
    const by = { cash: 0, upi: 0, card: 0, khata: 0 };
    let profit = 0, costKnown = true;
    for (const b of bills) {
      by[b.pay] = (by[b.pay] || 0) + b.total;
      for (const l of b.lines) { if (l.cost == null) costKnown = false; else profit += (l.price - l.cost) * l.qty; }
      profit -= b.discount;
    }
    return { bills: bills.length, total: bills.reduce((a, b) => a + b.total, 0), by, profit, costKnown };
  }

  // same product at other shops, for price comparison
  function elsewhere(item, shopId, loc) {
    const out = [];
    for (const s of D.shops) {
      if (s.id === shopId) continue;
      const it = s.items.find((x) => x.key === item.key);
      if (it) out.push({ shop: s, item: it, dist: distKm(loc, s), status: itemStatus(it) });
    }
    return out.filter((x) => x.status.key !== "out").sort((a, b) => a.dist - b.dist).slice(0, 5);
  }

  function watchItem(itemId) { const w = store.get("watch", []); if (!w.includes(itemId)) w.push(itemId); store.set("watch", w); }
  const isWatched = (itemId) => store.get("watch", []).includes(itemId);

  // ---------- feedback ----------
  function feedback(shopId, itemId, found) {
    const fb = store.get("feedback", {});
    fb[itemId] = { found, at: Date.now() };
    store.set("feedback", fb);
    const sh = getShop(shopId);
    const it = sh.items.find((x) => x.id === itemId);
    if (found) { it.lastConfirmed = Date.now(); it.reportedOut = null; }
    else { it.reportedOut = Date.now(); it.lastConfirmed = null; }
    sh.trust = Math.max(0.1, Math.min(0.99, sh.trust + (found ? 0.03 : -0.05)));
    const t = store.get("trust", {}); t[shopId] = sh.trust; store.set("trust", t);
  }

  return {
    D, store, distKm, fmtDist, marketsNear, shopsNear,
    RANGES, getRange, setRange, trip, fmtTrip, nearArea, nearSearch, marketFor,
    REASONS, moveStock, stockLog, inventory, lowAt,
    billTotals, saveBill, cancelBill, billsFor, getBill, daySummary,
    photoSent, FULL, registerShop, login, updateShop, normPhone, weakPin, addOwnItem, savePurchase, purchasesFor, hydrateShop, mergePublic, uuid, shopHas, saveDetails, productDetails, addPhoto, setBillLink, setShopPhoto, removeGalleryPhoto, getShop, getMarket, isOpen, itemStatus,
    search, ask, getAsk, replyAsk, pendingAsks, feedback, logSearch, addView,
    ownerShopId, ownerShop, isOwnerShop, claimShop, releaseShop, addShop, persistAddedShop, setItem, addItem, catalogFor, missedSales,
    getBag, addToBag, setQty, bagCount, bagLines, STEPS, placeOrder, getOrders, getOrder, advanceOrder, cancelOrder, ordersFor,
    elsewhere, watchItem, isWatched, slug,
    setDemoShift(loc) {
      store.set("demoShift", { dLat: loc.lat - 28.6517, dLng: loc.lng - 77.1905 });
    },
    clearDemoShift() { store.del("demoShift"); },
    hasDemoShift: () => !!store.get("demoShift", null),
  };
})();
