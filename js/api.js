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
    set(k, v) { try { localStorage.setItem("mm." + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem("mm." + k); } catch {} },
  };

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
    "wi-fi-router wireless-mouse lunch-box measuring-tape-5-m type-c-cable-1-m").split(" "));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = (s) => {
    let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; // mix so similar ids spread out
    return (h >>> 0) / 4294967296;
  };
  const WARRANTY = { mobile: "6 months", electronics: "1 year", electrical: "1 year", hardware: "6 months", plumbing: "6 months", clothes: "No warranty", footwear: "No warranty", kitchen: "1 year" };

  // Adds what a product page needs: photo, MRP (for "% off"), rating, specs.
  function enrich(it) {
    it.key = slug(it.name);
    it.img = PHOTOS.has(it.key) ? `img/items/${it.key}.jpg` : null;
    const h = hash(it.key + it.brand);
    if (it.price && !it.mrp) it.mrp = Math.round((it.price * (1.1 + h * 0.3)) / 10) * 10 - 1;
    it.rating = it.rating || Math.round((3.8 + hash(it.id) * 1.0) * 10) / 10;
    it.reviews = it.reviews || 12 + Math.floor(hash(it.id + "r") * 900);
    it.specs = [["Brand", it.brand], ["Category", D.CATEGORIES[it.cat].name], ["Condition", "New"],
      ["Warranty", WARRANTY[it.cat]], ["Returns", "7-day exchange at the shop"]];
    return it;
  }

  // ---------- shop-owner data (claimed / added shops, stock edits) ----------
  function loadOwnerData() {
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
        if (e.inStock != null && (!fb[it.id] || fb[it.id].at < e.at)) {
          if (e.inStock) { it.lastConfirmed = e.at; it.reportedOut = null; }
          else { it.reportedOut = e.at; it.lastConfirmed = null; }
        }
      }
    }
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

  function marketsNear(loc, radiusKm = 10) {
    return D.MARKETS.map((m) => ({
      ...m,
      dist: distKm(loc, m),
      shopCount: D.shops.filter((s) => s.marketId === m.id).length,
      cats: [...new Set(D.shops.filter((s) => s.marketId === m.id).map((s) => s.cat))],
    })).filter((m) => m.dist <= radiusKm).sort((a, b) => a.dist - b.dist);
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
    if (q.length >= 4 && lev(q, t) <= (q.length >= 7 ? 2 : 1)) return true;
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
    return norm(`${it.name} ${it.brand} ${D.CATEGORIES[it.cat].name} ${it.cat}`);
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
        const row = { shop: sh, item: it, score: s, status: st };
        (st.key === "confirmed" ? confirmed : listed).push(row);
        matchedShops.add(sh.id);
      }
    }
    const byRank = (a, b) => (b.score - a.score) || (a.shop.dist - b.shop.dist) || (b.shop.trust - a.shop.trust);
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
    const timers = a.targets.filter((t) => !isOwnerShop(t.shopId)).map((t, i) => setTimeout(() => {
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
  }
  function addView(shopId) { const v = store.get("views", {}); v[shopId] = (v[shopId] || 0) + 1; store.set("views", v); }

  // ---------- owner tools ----------
  function claimShop(id) { store.set("owner", id); }
  function releaseShop() { store.del("owner"); }
  function addShop(f, loc) {
    const id = "own" + Date.now().toString(36);
    let m = D.MARKETS.map((x) => ({ x, d: distKm(loc, x) })).sort((a, b) => a.d - b.d)[0];
    let market = null;
    if (!m || m.d > 1) { market = { id: "m-" + id, name: f.area || "Local shops", area: f.area || "", lat: loc.lat, lng: loc.lng, tagline: D.CATEGORIES[f.cat].name }; D.MARKETS.push(market); }
    const shop = {
      id, marketId: market ? market.id : m.x.id, market, name: f.name, cat: f.cat, cats: [f.cat], shopNo: f.shopNo || "—",
      floor: f.floor || "Ground floor", landmark: f.landmark || "Ask for the shop by name", lat: loc.lat, lng: loc.lng,
      open: +f.open || 10, close: +f.close || 20, closedDay: f.closedDay || "None", phone: f.phone || "", rating: 0, ratings: 0,
      verified: false, trust: 0.7, items: [], own: true,
    };
    const all = store.get("shopsAdded", []); all.push(shop); store.set("shopsAdded", all);
    D.shops.push(shop); claimShop(id);
    return shop;
  }
  function persistAddedShop(shop) {
    const all = store.get("shopsAdded", []);
    const i = all.findIndex((s) => s.id === shop.id);
    if (i >= 0) { all[i] = { ...shop, items: [] }; store.set("shopsAdded", all); }
  }
  function setItem(shopId, itemId, patch) {
    const edits = store.get("itemEdits", {});
    edits[itemId] = { ...(edits[itemId] || {}), ...patch, at: Date.now() };
    store.set("itemEdits", edits);
    const it = getShop(shopId)?.items.find((x) => x.id === itemId); if (!it) return;
    if (patch.price != null) { it.price = patch.price; it.mrp = Math.max(it.mrp || 0, patch.price); }
    if (patch.inStock === true) { it.lastConfirmed = Date.now(); it.reportedOut = null; }
    if (patch.inStock === false) { it.reportedOut = Date.now(); it.lastConfirmed = null; }
    if (patch.removed) { const sh = getShop(shopId); sh.items = sh.items.filter((x) => x.id !== itemId); }
  }
  function addItem(shopId, [name, brand, price], cat) {
    const sh = getShop(shopId);
    if (sh.items.find((x) => x.name === name && x.brand === brand)) return null;
    const it = enrich({ id: `${shopId}-a${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`, name, brand, cat: cat || sh.cat, price, lastConfirmed: Date.now() });
    const all = store.get("ownerItems", {}); (all[shopId] = all[shopId] || []).push(it); store.set("ownerItems", all);
    sh.items.push(it);
    return it;
  }
  const catalogFor = (cat) => D.CATALOG[cat].map(([n, b, p]) => ({ tmpl: [n, b, p], name: n, brand: b, price: p, img: PHOTOS.has(slug(n)) ? `img/items/${slug(n)}.jpg` : null }));

  // "People searched for X near you and nobody had it" — the hook that tells a shop what to stock.
  function missedSales(shop) {
    const log = store.get("searchLog", []).filter((l) => Date.now() - l.at < 7 * DAY && l.cats.some((c) => shop.cats.includes(c)) && !l.hits.includes(shop.id));
    const counts = {};
    for (const l of log) counts[l.q] = (counts[l.q] || 0) + 1;
    const real = Object.entries(counts).map(([q, n]) => ({ q, n, real: true }));
    // demo baseline so a new shop sees a realistic report on day one
    const have = new Set(shop.items.map((i) => slug(i.name)));
    const base = D.CATALOG[shop.cat].filter(([n]) => !have.has(slug(n))).map(([n, b]) => ({ q: `${b !== "Generic" ? b + " " : ""}${n}`.toLowerCase(), n: 3 + Math.floor(hash(shop.id + n) * 40), real: false, tmpl: [n, b] }));
    return [...real, ...base].sort((a, b) => b.n - a.n).slice(0, 10);
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
    if (isOwnerShop(o.shopId) || o.cancelled) return o;
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
    if (o.step < STEPS[o.mode].length - 1) { o.step++; o.history.push({ step: o.step, at: Date.now() }); if (o.step === STEPS[o.mode].length - 1) o.paid = true; }
    saveOrder(o);
  }
  function cancelOrder(id) { const o = store.get("orders", []).find((x) => x.id === id); if (o) { o.cancelled = Date.now(); saveOrder(o); } }
  const ordersFor = (shopId) => store.get("orders", []).filter((o) => o.shopId === shopId);

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
    D, store, distKm, fmtDist, marketsNear, shopsNear, getShop, getMarket, isOpen, itemStatus,
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
