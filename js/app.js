// My Market v1 — screens and navigation (gallery-minimal design).
// Rule for every screen: lead with the answer, keep the rest one tap away.
(function () {
  const A = window.MM_API, D = A.D, C = D.CATEGORIES;
  // Two apps, one codebase: business.html sets MM_APP = "business" (shop app),
  // index.html is the customer app. Each only shows its own screens.
  const BIZ = window.MM_APP === "business";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PILOT_ORIG = { lat: 28.6517, lng: 77.1905, label: "Karol Bagh", sub: "New Delhi", source: "pilot" };
  const SUGGEST = ["Type-C charger", "1 inch elbow", "nal", "Havells MCB", "kurti", "pressure cooker", "atta", "dawai", "ghadi"];

  // thin line icons
  const P = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    heartF: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>',
    pin: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    down: '<path d="M7 10l5 5 5-5"/>',
    bag: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
    store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 12v8h13v-8M10 20v-5h4v5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    chat: '<path d="M5 5h14v10H9l-4 4z"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    chart: '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-4"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8z"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    wallet: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H18v3"/><path d="M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5H20V9H5.5A1.5 1.5 0 0 1 4 7.5z"/><circle cx="16" cy="14.2" r="1.1"/>',
    cloud: '<path d="M7.5 18.5a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17.6 9 4.8 4.8 0 0 1 17 18.5z"/><path d="M12 11v5M9.8 13.2L12 11l2.2 2.2"/>',
    sync: '<path d="M19 8.5A7.5 7.5 0 0 0 5.2 9.6M5 15.5a7.5 7.5 0 0 0 13.8-1.1"/><path d="M19 4v4.5h-4.5M5 20v-4.5h4.5"/>',
    eye: '<path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
    out: '<path d="M10 4.5H5.5v15H10M15 8l4 4-4 4M9.5 12H19"/>',
    pen: '<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5z"/><path d="M14 7l3 3"/>',
  };
  const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24">${P[n]}</svg>`;

  // ---------- state ----------
  let loc = A.store.get("loc", null);
  let saved = A.store.get("saved", []);
  let recent = A.store.get("recent", []);
  let homeCat = null, homeMarket = null;
  let cleanups = [];
  const setLoc = (l) => {
    loc = l; A.store.set("loc", l);
    // far from the shops already loaded: fetch that area's shops, then redraw
    if (window.MM_CLOUD && window.MM_CLOUD.movedTo) window.MM_CLOUD.movedTo(l).then((n) => { if (n) route(); });
  };
  const addRecent = (q) => {
    q = q.trim(); if (!q) return;
    recent = [q, ...recent.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    A.store.set("recent", recent);
  };

  // ---------- helpers ----------
  const go = (h) => { location.hash = h; };
  const fmtHour = (h) => (h % 12 || 12) + (h < 12 ? " am" : " pm");
  const rupee = (p) => "₹" + p.toLocaleString("en-IN");
  const dist = (s) => (loc ? A.fmtDist(A.distKm(loc, s)) : "");
  const away = (km) => `${A.fmtDist(km)} · ${A.fmtTrip(km)}`;
  const stWord = (st) => (st.few ? "Only a few left" : statusWord[st.key]);
  // Walking / Short ride / Whole city: caps how far "near me" looks.
  const rangeChips = (id) => `<div class="ranges" id="${id}">${Object.entries(A.RANGES).map(([k, r]) => `<button class="${A.getRange() === k ? "on" : ""}" data-range="${k}">${r.label}</button>`).join("")}</div>`;
  const areaNote = (km) => `within ${A.fmtDist(km)}`;
  const stars = (r, n) => !r ? "" : `<span class="prate"><span class="stars" style="--r:${r}" aria-label="${r} out of 5">★★★★★</span>${n != null ? `<span class="rc">${n.toLocaleString("en-IN")}</span>` : ""}</span>`;
  const amt = (p) => `<span class="amt"><sup>₹</sup>${p.toLocaleString("en-IN")}</span>`;
  // small product tile for the home rows
  const hcard = (x) => {
    const o = off(x.item);
    return `<a class="hcard" href="#/item/${x.shop.id}/${x.item.id}"><div class="himg" style="${catVars(x.item.cat)}">${pimg(x.item)}</div>
      <div>${o ? `<span class="dealtag">${o}% off</span>` : ""}${x.item.price ? amt(x.item.price) : '<span class="quiet">Ask for price</span>'}</div>
      <div class="hname">${esc(x.item.name)}</div>${stars(x.item.rating, x.item.reviews)}
      <div class="hshop">${esc(x.shop.name)} · ${A.fmtDist(x.shop.dist)}</div></a>`;
  };
  const openWord = (s) => A.isOpen(s) ? `Open until ${fmtHour(s.close)}` : `Closed · opens ${fmtHour(s.open)}`;
  const statusWord = { confirmed: "In stock", listed: "Ask to confirm", out: "Not available" };
  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms);
  }
  function openSheet(html, onMount) {
    $("#sheet").innerHTML = html;
    $("#sheet").classList.remove("hidden"); $("#sheet-backdrop").classList.remove("hidden");
    onMount && onMount($("#sheet"));
  }
  function closeSheet() { $("#sheet").classList.add("hidden"); $("#sheet-backdrop").classList.add("hidden"); }
  $("#sheet-backdrop").addEventListener("click", closeSheet);

  // ---------- map ----------
  function newMap(el) {
    const m = L.map(el, { zoomControl: false });
    // OSM tiles, toned to warm grey in CSS (.leaflet-tile-pane) so the shops are the only thing that speaks.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    cleanups.push(() => m.remove());
    return m;
  }
  const meIcon = () => L.divIcon({ className: "", html: '<div class="mk-me"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
  const dotIcon = (cls = "", s = null) => L.divIcon({ className: "", html: `<div class="mk-dot ${cls}" ${s ? `style="--c:${C[s.cat].color}"` : ""}></div>`, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
  const catVars = (cat) => `--c:${C[cat].color};--t:${C[cat].tint}`;
  const mono = (s) => `<span class="mono" style="${catVars(s.cat)}">${esc(s.name[0])}</span>`;
  const shopPopup = (s) => `<div class="pop"><div class="serif">${esc(s.name)}</div><div class="tiny">${esc(C[s.cat].name)} · ${dist(s)}</div>
    <div class="btn-row"><a class="link" href="#/shop/${s.id}">View</a><a class="link accent" href="#/route/${s.id}">Directions</a></div></div>`;

  // Open WhatsApp on a chat (10-digit Indian number) or the "send to…" list (no number).
  // Must be called straight from a tap. On Android we open the WhatsApp app itself
  // (works for WhatsApp and WhatsApp Business); the wa.me web page is only a fallback
  // if the app doesn't open — that page is what asked people to download WhatsApp.
  function openWhatsApp(num, text) {
    const enc = encodeURIComponent(text);
    const web = `https://wa.me/${num ? "91" + num : ""}?text=${enc}`;
    if (/Android/i.test(navigator.userAgent)) {
      let left = false;
      const gone = () => { if (document.visibilityState === "hidden") left = true; };
      document.addEventListener("visibilitychange", gone);
      window.addEventListener("blur", () => { left = true; }, { once: true });
      location.href = `whatsapp://send?${num ? `phone=91${num}&` : ""}text=${enc}`;
      setTimeout(() => { document.removeEventListener("visibilitychange", gone); if (!left) location.href = web; }, 2000);
    } else window.open(web, "_blank", "noopener");
  }
  // Open a WhatsApp chat with the shop (its registered number).
  function waShop(s, text) {
    const d = String(s.phone || "").replace(/\D/g, "").slice(-10);
    if (d.length !== 10) return toast("This shop hasn't added a WhatsApp number");
    openWhatsApp(d, text);
  }

  // ---------- shared pieces ----------
  function shopEntry(s, aside) {
    return `<a class="entry" href="#/shop/${s.id}">${mono(s)}
      <div class="body"><div class="name">${esc(s.name)}</div><div class="note">${esc(C[s.cat].name)} · ${openWord(s)}</div></div>
      <div class="aside">${aside ?? dist(s)}</div></a>`;
  }
  function reachSteps(s) {
    const m = A.getMarket(s.marketId);
    const where = [s.locality || m.locality || m.area, s.pincode || m.pincode].filter(Boolean).join(" ");
    return `<ol class="steps"><li>${esc(m.name)}${where ? ", " + esc(where) : ""}</li><li>${esc(s.landmark)}</li><li>Shop ${esc(s.shopNo)}, ${esc(s.floor.toLowerCase())}</li></ol>`;
  }

  // ---------- location ----------
  async function reverseName(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`);
      const a = (await r.json()).address || {};
      const locality = a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city || "";
      return { label: locality || "Current location", sub: [a.city || a.town || a.state, a.postcode].filter(Boolean).join(" "), locality, pincode: a.postcode || "" };
    } catch { return { label: "Current location", sub: "", locality: "", pincode: "" }; }
  }
  function useGPS(done) {
    if (!navigator.geolocation) { toast("Location isn't available here"); return openLocationSheet(); }
    toast("Finding you…");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { latitude: lat, longitude: lng } = p.coords;
      const n = await reverseName(lat, lng);
      setLoc({ lat, lng, label: n.label, sub: n.sub, source: "gps" });
      closeSheet(); done ? done() : route();
    }, () => { toast("Couldn't find you. Choose an area instead."); openLocationSheet(); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }
  function pickPilot() {
    setLoc(PILOT_ORIG); closeSheet();
    if (A.hasDemoShift()) { A.clearDemoShift(); location.hash = "#/"; location.reload(); return; }
    go("#/"); route();
  }
  function openLocationSheet() {
    const recentLocs = A.store.get("recentLocs", []);
    openSheet(`
      <div class="eyebrow">Location</div>
      <div class="title">Where are you?</div>
      <input class="field" id="placeq" placeholder="Search an area" autocomplete="off" style="margin-top:14px">
      <div id="placeres" class="entries" style="border:0"></div>
      <div class="entries" style="margin-top:18px">
        <button class="entry" id="pl-gps"><div class="body"><div class="name">Use my location</div></div><div class="aside">${ic("locate")}</div></button>
        <button class="entry" id="pl-pilot"><div class="body"><div class="name">Karol Bagh</div><div class="note">New Delhi</div></div></button>
        ${recentLocs.map((l, i) => `<button class="entry" data-rl="${i}"><div class="body"><div class="name">${esc(l.label)}</div><div class="note">${esc(l.sub || "")}</div></div></button>`).join("")}
      </div>`, (el) => {
      $("#pl-gps", el).onclick = () => useGPS();
      $("#pl-pilot", el).onclick = pickPilot;
      $$("[data-rl]", el).forEach((b) => b.onclick = () => { setLoc(recentLocs[+b.dataset.rl]); closeSheet(); go("#/"); route(); });
      let t;
      $("#placeq", el).addEventListener("input", (e) => {
        clearTimeout(t); const q = e.target.value.trim();
        if (q.length < 3) { $("#placeres", el).innerHTML = ""; return; }
        t = setTimeout(async () => {
          try {
            const list = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`)).json();
            $("#placeres", el).innerHTML = list.length ? list.map((p, i) => `<button class="entry" data-p="${i}"><div class="body"><div class="name">${esc(p.name || p.display_name.split(",")[0])}</div><div class="note">${esc(p.display_name.split(",").slice(1, 3).join(",").trim())}</div></div></button>`).join("") : '<p class="quiet small">Nothing found.</p>';
            $$("[data-p]", el).forEach((b) => b.onclick = () => {
              const p = list[+b.dataset.p];
              const l = { lat: +p.lat, lng: +p.lon, label: p.name || p.display_name.split(",")[0], sub: p.display_name.split(",").slice(1, 2).join("").trim(), source: "search" };
              setLoc(l); A.store.set("recentLocs", [l, ...recentLocs.filter((x) => x.label !== l.label)].slice(0, 3));
              closeSheet(); go("#/"); route();
            });
          } catch { $("#placeres", el).innerHTML = '<p class="quiet small">Place search needs internet.</p>'; }
        }, 450);
      });
    });
  }

  // ---------- screens ----------
  function welcome() {
    app.innerHTML = `<div class="welcome">
      <img class="mark" src="icon.svg" alt="">
      <h1 class="display">My Market</h1>
      <p class="sub">Know which shop has it,<br>before you walk the market.</p>
      <div class="spacer"></div>
      <div class="actions">
        <button class="btn" id="w-gps">Use my location</button>
        <button class="link" id="w-manual">Choose an area</button>
      </div>

    </div>`;
    $("#w-gps").onclick = () => useGPS(() => go("#/"));
    $("#w-manual").onclick = openLocationSheet;
  }

  function home() {
    const area = A.nearArea(loc);
    const markets = area.markets;
    const filtered = (homeCat || homeMarket) ? A.shopsNear(loc, area.km, homeCat).filter((s) => !homeMarket || s.marketId === homeMarket) : [];
    const listTitle = homeMarket ? A.getMarket(homeMarket).name : homeCat ? C[homeCat].name : "";
    // product rows: what's in stock nearby, and the biggest price drops
    const seenName = new Set();
    const nearItems = area.shops.flatMap((sh) => sh.items.map((item) => ({ shop: sh, item, st: A.itemStatus(item) })))
      .filter((x) => x.st.key === "confirmed" && (!homeCat || x.item.cat === homeCat));
    const inStock = nearItems.filter((x) => x.item.img).sort((a, b) => a.shop.dist - b.shop.dist)
      .filter((x) => !seenName.has(x.item.name) && seenName.add(x.item.name)).slice(0, 12);
    const deals = nearItems.filter((x) => x.item.price && off(x.item) >= 15).sort((a, b) => off(b.item) - off(a.item)).slice(0, 12);
    const catImg = (k) => { const it = D.shops.flatMap((x) => x.items).find((i) => i.cat === k && i.img); return it ? `<img src="${it.img}" alt="">` : art(k, 40); };
    app.innerHTML = `
      <div class="navwrap">
        <div class="nav1"><a class="brand" href="#/"><img src="icon.svg" alt="">My Market<small>.local</small></a>
          <div class="btn-row" style="gap:4px"><a class="iconbtn" href="#/me" aria-label="Profile">${ic("user")}</a>${bagBtn()}</div></div>
        <div class="pad"><a class="seek" href="#/search">${ic("search")}<span class="ph">Search an item, brand or shop</span><span class="seekbtn">${ic("search")}</span></a></div>
        ${rangeChips("hrange")}
      </div>
      <button class="locbar" id="locbtn">${ic("pin")}<span>Shopping near <b>${esc(loc.label)}${loc.sub ? ", " + esc(loc.sub) : ""}</b></span>${ic("down")}</button>
      <div class="catstrip"><button data-cat="" class="${!homeCat ? "on" : ""}">All</button>${Object.entries(C).map(([k, c]) => `<button class="${homeCat === k ? "on" : ""}" data-cat="${k}">${esc(c.name)}</button>`).join("")}</div>
      <div class="home-body">
      ${!markets.length && area.shops.length ? `<div class="banner" style="margin:0 var(--gut) 10px"><div class="serif">${area.shops.length} shop${area.shops.length > 1 ? "s" : ""} ${areaNote(area.km)}.</div><p>No market listed here yet — a market appears once a few shops in one spot join.</p></div>` : ""}
      ${!markets.length && !area.shops.length ? `<div class="banner" style="margin:0 var(--gut) 10px"><div class="serif">No shops on My Market near you yet.</div>
        <p>Shops join with the My Market Business app (2 months free). Know a shop nearby? Tell them about it — or try a wider range above.</p>
        <div class="btn-row"><a class="link accent" href="business.html" target="_blank" rel="noopener">My Market Business</a></div></div>` : ""}
      ${!homeCat && !homeMarket && area.shops.length ? `<div class="hero"><b>Find it in your market today</b><span>Live stock and prices from ${area.shops.length} shop${area.shops.length > 1 ? "s" : ""} ${areaNote(area.km)}</span></div>` : ""}
      ${listTitle ? `<div class="card" id="flist"><h3><span>${esc(listTitle)} · ${filtered.length} shops</span><button class="link" id="clearf">Clear</button></h3>
        <div class="entries">${filtered.length ? filtered.map((s) => shopEntry(s)).join("") : '<p class="quiet">No shops here yet.</p>'}</div></div>` : ""}
      ${inStock.length ? `<div class="card"><h3><span>In stock near you</span><a class="link" href="#/search">See more</a></h3><div class="hrow">${inStock.map(hcard).join("")}</div></div>` : ""}
      ${!homeCat ? `<div class="card"><h3>Shop by category</h3><div class="catgrid">
        ${Object.entries(C).map(([k, c]) => `<button data-cat="${k}" class="${homeCat === k ? "on" : ""}"><span class="cimg" style="${catVars(k)}">${catImg(k)}</span>${esc(c.name)}</button>`).join("")}
      </div></div>` : ""}
      ${deals.length ? `<div class="card"><h3>Top deals in your market</h3><div class="hrow">${deals.map(hcard).join("")}</div></div>` : ""}
      <div class="card"><h3><span>${markets.length ? "Markets nearby" : "Shops nearby"}</span><span class="faint small">${areaNote(area.km)}</span></h3>
        ${markets.length ? `<div class="entries">
        ${markets.map((m) => `<button class="entry ${homeMarket === m.id ? "on" : ""}" data-m="${m.id}"><div class="body"><div class="name">${esc(m.name)}</div><div class="note"><span class="cdots">${m.cats.map((c) => `<i style="--c:${C[c].color}"></i>`).join("")}</span>${esc(m.tagline)}</div></div><div class="aside">${A.fmtDist(m.dist)}<br><span class="faint tiny">${A.fmtTrip(m.dist)}</span></div></button>`).join("")}
        </div>` : ""}
        <div class="map" id="map"><button class="recenter" id="recenter" aria-label="My location">${ic("locate")}</button></div>
      </div>
      </div>`;

    $("#locbtn").onclick = openLocationSheet;
    $$("#hrange [data-range]").forEach((b) => b.onclick = () => { A.setRange(b.dataset.range); cleanups.forEach((f) => f()); cleanups = []; home(); });
    $("#b-pilot") && ($("#b-pilot").onclick = pickPilot);
    $("#b-demo") && ($("#b-demo").onclick = () => { A.setDemoShift(loc); location.reload(); });
    $("#clearf") && ($("#clearf").onclick = () => { homeCat = null; homeMarket = null; home(); });
    const rerender = (anchor) => { cleanups.forEach((f) => f()); cleanups = []; home(); $(anchor)?.scrollIntoView({ block: "start", behavior: "instant" }); };
    $$("[data-cat]").forEach((b) => b.onclick = () => { homeCat = !b.dataset.cat || homeCat === b.dataset.cat ? null : b.dataset.cat; homeMarket = null; rerender(homeCat ? "#flist" : null); });
    $$("[data-m]").forEach((b) => b.onclick = () => { homeMarket = homeMarket === b.dataset.m ? null : b.dataset.m; homeCat = null; rerender(homeMarket ? "#flist" : null); });

    const map = newMap("map");
    L.marker([loc.lat, loc.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(map);
    const marketLayer = L.layerGroup(), shopLayer = L.layerGroup();
    for (const m of markets) {
      L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="mk-market">${esc(m.name)}</div>` }) })
        .on("click", () => map.flyTo([m.lat, m.lng], 17, { duration: 0.6 })).addTo(marketLayer);
    }
    const focusIds = new Set(filtered.map((s) => s.id));
    for (const s of area.shops) {
      const dim = (homeCat || homeMarket) && !focusIds.has(s.id);
      L.marker([s.lat, s.lng], { icon: dotIcon(dim ? "dim" : "", s) }).bindPopup(shopPopup(s)).addTo(shopLayer);
    }
    const sync = () => {
      if (homeCat || homeMarket || map.getZoom() >= 16) { map.removeLayer(marketLayer); shopLayer.addTo(map); }
      else { map.removeLayer(shopLayer); marketLayer.addTo(map); }
    };
    map.on("zoomend", sync);
    $("#recenter").onclick = () => map.flyTo([loc.lat, loc.lng], 16, { duration: 0.6 });
    const focus = filtered.length ? filtered : markets.length ? markets.slice(0, 3) : area.shops.slice(0, 6);
    if (focus.length) map.fitBounds(L.latLngBounds([[loc.lat, loc.lng], ...focus.map((x) => [x.lat, x.lng])]), { padding: [36, 36], maxZoom: 17 });
    else map.setView([loc.lat, loc.lng], 14);
    sync();
  }

  // ---------- a shop's own website page ----------
  // Opens from search, from a shared link, the QR poster, a bill or Google Maps
  // (?src=…), even without the visitor's location. Visits are counted for the shop.
  // ---------- a shop's website: cart, "Hold it for me" and "Buy" ----------
  // The cart is kept on this phone per shop. Orders go to the shop through the server
  // (place_order); a shop that isn't online yet gets the order on WhatsApp instead.
  const sc = {
    get: (sid) => A.store.get("siteCart:" + sid, []),
    set: (sid, v) => A.store.set("siteCart:" + sid, v),
    qty: (sid, iid) => (sc.get(sid).find((l) => l.itemId === iid) || {}).qty || 0,
    add(sid, iid, n) {
      const c = sc.get(sid), l = c.find((x) => x.itemId === iid);
      if (l) l.qty = Math.max(0, Math.min(99, l.qty + n)); else if (n > 0) c.push({ itemId: iid, qty: Math.min(99, n) });
      sc.set(sid, c.filter((x) => x.qty > 0));
    },
    lines: (s) => sc.get(s.id).map((l) => ({ ...l, it: s.items.find((i) => i.id === l.itemId) })).filter((l) => l.it && A.itemStatus(l.it).key !== "out"),
  };
  const myOrders = () => A.store.get("myOrders", []);
  const canOrder = (s) => !!(window.MM_CLOUD && window.MM_CLOUD.placeOrder && (s.live || s.cloud));
  const ordersOn = (s) => s.takesOrders !== false;
  const tm = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const orderWord = (o) => o.status === "cancelled" ? "Cancelled"
    : o.status === "done" ? (o.mode === "delivery" ? "Delivered — thank you!" : "Collected — thank you!")
    : o.status === "ready" ? (o.kind === "hold" ? `Kept aside for you${o.hold_until ? " until " + tm(o.hold_until) : ""} ✓` : o.mode === "delivery" ? "Accepted — on its way soon ✓" : "Ready for pickup ✓")
    : "Sent — waiting for the shop to confirm";
  function orderText(s, kind, mode, lines, f, code) {
    const total = lines.reduce((x, l) => x + (l.it.price || 0) * l.qty, 0);
    return `Hi ${s.name}, I ${code ? "placed an order" : "would like to order"} on My Market.\n` +
      `${code ? `Order *${code}* · ` : ""}${kind === "hold" ? "Please *hold* these for me — I'll pick them up" : mode === "delivery" ? "*Buy* — home delivery" : "*Buy* — I'll pick it up"}\n` +
      lines.map((l) => `• ${l.qty} × ${l.it.name}${l.it.price ? ` — ₹${(l.it.price * l.qty).toLocaleString("en-IN")}` : ""}`).join("\n") +
      `\nTotal: ₹${total.toLocaleString("en-IN")}\nName: ${f.name}${mode === "delivery" ? `\nAddress: ${f.address}` : ""}${f.note ? `\nNote: ${f.note}` : ""}`;
  }
  function siteCheckout(s, kind = "hold", src = "app") {
    const me = A.store.get("me", {});
    const f = { name: me.name || "", phone: me.phone || "", address: me.address || "", note: "" };
    let mode = "pickup", busy = false;
    const draw = (el) => {
      const lines = sc.lines(s);
      if (!lines.length) { closeSheet(); return; }
      if (kind === "hold") mode = "pickup";
      const total = lines.reduce((x, l) => x + (l.it.price || 0) * l.qty, 0), unknown = lines.some((l) => !l.it.price);
      el.innerHTML = `<div class="co" style="${catVars(s.cat)}">
        <div class="co-hd"><b>Your order</b><span>${esc(s.name)}</span></div>
        <div class="co-tabs"><button class="${kind === "hold" ? "on" : ""}" data-k="hold">${ic("clock")}Hold it for me</button><button class="${kind === "buy" ? "on" : ""}" data-k="buy">${ic("bag")}Buy</button></div>
        <p class="co-why">${kind === "hold" ? `The shop keeps these aside for <b>4 hours</b>. Pay when you collect — nothing to pay now.` : `Pay at the shop${s.delivery ? " or on delivery" : ""} — cash or UPI. Nothing is charged online.`}</p>
        <div class="co-lines">${lines.map((l) => `<div class="co-l"><span class="co-n">${esc(l.it.name)}<em>${l.it.price ? rupee(l.it.price) + " each" : "price at the shop"}</em></span>
          <span class="co-q"><button data-cq="${l.itemId}" data-n="-1" aria-label="One less">−</button><b>${l.qty}</b><button data-cq="${l.itemId}" data-n="1" aria-label="One more">+</button></span>
          <span class="co-p">${l.it.price ? rupee(l.it.price * l.qty) : "—"}</span></div>`).join("")}</div>
        <div class="co-tot"><span>Total${unknown ? " <em>+ items priced at the shop</em>" : ""}</span><b>${rupee(total)}</b></div>
        ${kind === "buy" ? `<div class="co-mode"><button class="${mode === "pickup" ? "on" : ""}" data-m="pickup">${ic("store")}Pick up</button>${s.delivery ? `<button class="${mode === "delivery" ? "on" : ""}" data-m="delivery">${ic("truck")}Home delivery</button>` : `<span class="co-nod">This shop doesn't deliver yet</span>`}</div>` : ""}
        <div class="co-form">
          <label>Your name<input data-f="name" autocomplete="name" maxlength="60" value="${esc(f.name)}" placeholder="e.g. Priya"></label>
          <label>Mobile number<input data-f="phone" inputmode="tel" autocomplete="tel" maxlength="16" value="${esc(f.phone)}" placeholder="98765 43210"></label>
          ${mode === "delivery" ? `<label class="wide">Delivery address<textarea data-f="address" rows="2" maxlength="300" placeholder="House no., street, landmark">${esc(f.address)}</textarea></label>` : ""}
          <label class="wide">Note for the shop <span>(optional)</span><input data-f="note" maxlength="300" value="${esc(f.note)}" placeholder="${kind === "hold" ? "e.g. I'll come at 6 pm" : "e.g. Call before coming"}"></label>
        </div>
        <p class="co-err" id="co-err"></p>
        <button class="co-go" id="co-go"><span>${kind === "hold" ? "Hold my items" : mode === "delivery" ? "Place delivery order" : "Place order"}</span><b>${rupee(total)}</b></button>
        <p class="co-fine">${canOrder(s) ? "The shop gets your order straight away and confirms it here." : "This shop gets your order on WhatsApp."}</p>
      </div>`;
      $$("[data-f]", el).forEach((x) => x.oninput = () => { f[x.dataset.f] = x.value; });
      $$("[data-k]", el).forEach((x) => x.onclick = () => { kind = x.dataset.k; draw(el); });
      $$("[data-m]", el).forEach((x) => x.onclick = () => { mode = x.dataset.m; draw(el); });
      $$("[data-cq]", el).forEach((x) => x.onclick = () => { sc.add(s.id, x.dataset.cq, +x.dataset.n); paintSiteCart(s); draw(el); });
      const err = (m) => { const e = $("#co-err", el); e.textContent = m; e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); };
      $("#co-go", el).onclick = async () => {
        if (busy) return;
        const name = f.name.trim(), ph = A.normPhone(f.phone);
        if (!name) return err("Enter your name");
        if (!/^[6-9]\d{9}$/.test(ph)) return err("Enter your 10-digit mobile number");
        if (mode === "delivery" && f.address.trim().length < 6) return err("Enter the delivery address");
        A.store.set("me", { name, phone: ph, address: f.address.trim() });
        if (!canOrder(s)) { // shop not online yet: the order goes as a WhatsApp message
          waShop(s, orderText(s, kind, mode, lines, { ...f, name }, null)); sc.set(s.id, []); paintSiteCart(s); closeSheet(); return;
        }
        busy = true; const btn = $("#co-go", el); btn.classList.add("busy"); btn.querySelector("span").textContent = "Sending your order…";
        try {
          const r = await window.MM_CLOUD.placeOrder({ shopId: s.id, kind, mode, name, phone: ph, address: f.address.trim(), note: f.note.trim(), lines });
          A.store.set("myOrders", [{ token: r.token, shopId: s.id, code: r.code, at: Date.now() }, ...myOrders()].slice(0, 30));
          sc.set(s.id, []); paintSiteCart(s);
          try { window.MM_CLOUD.logVisit(s.id, "whatsapp", src); } catch {}
          const sent = lines.slice();
          el.innerHTML = `<div class="co done" style="${catVars(s.cat)}">
            <div class="co-tick">${ic("check")}</div>
            <h3>${kind === "hold" ? "Your items are on hold" : "Order placed"}</h3>
            <p class="co-code">Order <b>${esc(r.code)}</b> · ${rupee(r.total)}</p>
            <p class="co-why">${kind === "hold" ? `Show code <b>${esc(r.code)}</b> at ${esc(s.name)} within 4 hours.` : mode === "delivery" ? `${esc(s.name)} will confirm and deliver to you.` : `Pick it up at ${esc(s.name)} — show code <b>${esc(r.code)}</b>.`} You'll see when the shop confirms it on this page.</p>
            <button class="co-go" id="co-track"><span>${ic("receipt")}Track it in My orders</span></button>
            <button class="co-go wa" id="co-wa"><span>${ic("chat")}Tell the shop on WhatsApp</span></button>
            <button class="co-done" id="co-ok">Keep shopping</button></div>`;
          $("#co-wa", el).onclick = () => waShop(s, orderText(s, kind, mode, sent, { ...f, name }, r.code));
          $("#co-ok", el).onclick = () => { closeSheet(); route(); };
          $("#co-track", el).onclick = () => { closeSheet(); go(`#/orders?new=${encodeURIComponent(r.code)}`); };
          refreshOrders().then(() => syncTabs((location.hash.slice(2).split(/[/?]/)[0]) || "")).catch(() => {});
        } catch (x) { busy = false; btn.classList.remove("busy"); btn.querySelector("span").textContent = "Try again"; err(x.message || "Couldn't send — try again"); }
      };
    };
    openSheet("", (el) => { el.classList.add("co-sheet"); draw(el); });
    cleanups.push(() => $("#sheet")?.classList.remove("co-sheet"));
  }
  // ---------- My orders: every order at every shop, tracked live ----------
  // The order list lives on this phone (myOrders: token, shop, code, time); each order's
  // status comes from the server by its private token. Carts not yet ordered are listed too,
  // so a customer can shop at several shops at once and check out each one from here.
  const ordCache = () => A.store.get("myOrdersCache", {});
  const isActive = (st, o) => st && (st.status === "new" || st.status === "ready") && Date.now() - o.at < 3 * 86400000;
  const activeOrders = () => { const c = ordCache(); return myOrders().filter((o) => isActive(c[o.token], o)).length; };
  async function refreshOrders() {
    const CL = window.MM_CLOUD; if (!CL || !CL.orderStatus || !navigator.onLine) return false;
    const list = myOrders().filter((o) => Date.now() - o.at < 30 * 86400000);
    const res = await Promise.all(list.map((o) => CL.orderStatus(o.token).catch(() => undefined)));
    const c = ordCache();
    list.forEach((o, i) => { if (res[i] !== undefined) c[o.token] = res[i]; });
    A.store.set("myOrdersCache", c);
    // shops these orders are from, if they aren't loaded (a shop far from here)
    const missing = [...new Set(list.map((o) => o.shopId))].filter((id) => !A.getShop(id)).slice(0, 8);
    if (missing.length && CL.loadShop) await Promise.all(missing.map((id) => CL.loadShop(id).catch(() => 0)));
    return true;
  }
  function openCarts() {
    const out = [];
    try { for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("mm.siteCart:")) continue;
      const s = A.getShop(k.slice(12)); if (!s) continue;
      const lines = sc.lines(s); if (!lines.length) continue;
      out.push({ s, n: lines.reduce((x, l) => x + l.qty, 0), t: lines.reduce((x, l) => x + (l.it.price || 0) * l.qty, 0) });
    } } catch {}
    return out;
  }
  const STEPS = (st) => st.kind === "hold" ? ["Sent", "Kept aside", "Collected"] : st.mode === "delivery" ? ["Sent", "Accepted", "Delivered"] : ["Sent", "Ready", "Collected"];
  const stepAt = (st) => ({ new: 0, ready: 1, done: 2 })[st.status] ?? 0;
  const left = (t) => { const m = Math.round((Date.parse(t) - Date.now()) / 60000); return m <= 0 ? "time is up" : m < 60 ? `${m} min left` : `${Math.floor(m / 60)} h ${m % 60} min left`; };
  function orderCard(o, st, hl) {
    const s = A.getShop(o.shopId), ph = s ? String(s.phone || "").replace(/\D/g, "").slice(-10) : "";
    if (!st) return `<div class="mo-card off"><div class="mo-hd"><b>${esc(s ? s.name : "A shop")}</b><span>Order ${esc(o.code || "")}</span></div>
      <p class="small quiet" style="margin:6px 0 0">${navigator.onLine ? "This order isn't on the server any more." : "Connect to the internet to see this order."}</p></div>`;
    const lines = Array.isArray(st.lines) ? st.lines : [], cancelled = st.status === "cancelled", at = stepAt(st), steps = STEPS(st);
    return `<div class="mo-card ${st.status} ${hl ? "hl" : ""}" id="mo-${esc(o.token.slice(0, 12))}">
      <div class="mo-hd"><a href="#/shop/${o.shopId}"><b>${esc(s ? s.name : "Shop")}</b></a><span class="mo-code">${esc(st.code)}</span></div>
      <div class="mo-sub">${st.kind === "hold" ? "Hold for pickup" : st.mode === "delivery" ? "Home delivery" : "Pickup"} · ${new Date(st.created_at || o.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
      ${cancelled ? '<div class="mo-state x">Cancelled</div>' : `<div class="mo-steps">${steps.map((t, i) => `<span class="${i <= at ? "on" : ""} ${i === at ? "now" : ""}"><i></i>${t}</span>`).join("")}</div>
        <div class="mo-state">${esc(orderWord(st))}${st.kind === "hold" && st.status !== "done" && st.hold_until ? ` · ${left(st.hold_until)}` : ""}</div>`}
      <div class="mo-lines">${lines.slice(0, 6).map((l) => `<div><span>${l.qty} × ${esc(l.name)}</span><b>${l.price ? rupee(l.price * l.qty) : "—"}</b></div>`).join("")}
        ${lines.length > 6 ? `<div class="faint">…and ${lines.length - 6} more</div>` : ""}
        <div class="mo-tot"><span>Total</span><b>${rupee(st.total || 0)}</b></div></div>
      <div class="mo-act">
        ${ph ? `<button data-wa="${o.token}">${ic("chat")}WhatsApp</button><a href="tel:+91${ph}">${ic("phone")}Call</a>` : ""}
        ${s && s.lat != null ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" rel="noopener">${ic("pin")}Directions</a>` : ""}
        ${st.status === "new" ? `<button class="x" data-cx="${o.token}">Cancel</button>` : ""}
        ${(st.status === "done" || cancelled) && s ? `<button data-again="${o.token}">${ic("bag")}Order again</button>` : ""}
      </div></div>`;
  }
  function myOrdersView(params) {
    const hl = params.get("new") || "";
    const draw = () => {
      const c = ordCache(), all = myOrders().filter((o) => Date.now() - o.at < 30 * 86400000);
      const act = all.filter((o) => isActive(c[o.token], o) || (c[o.token] === undefined && Date.now() - o.at < 86400000));
      const past = all.filter((o) => !act.includes(o));
      const carts = openCarts();
      app.innerHTML = `
        <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="faint tiny" id="mo-upd"></span></div>
        <div class="pad" style="margin-top:18px"><h1 class="display">My orders</h1>
          <p class="quiet small" style="margin-top:6px">Order from as many shops as you like — each one is tracked here.</p></div>
        ${carts.length ? `<div class="block"><div class="eyebrow"><span>In your carts</span><span class="faint">not ordered yet</span></div>
          <div class="entries">${carts.map(({ s, n, t }) => `<a class="entry" href="#/shop/${s.id}?cart=buy">${mono(s)}<div class="body"><div class="name">${esc(s.name)}</div>
            <div class="note">${n} item${n === 1 ? "" : "s"} · ${rupee(t)}</div></div><div class="aside"><b class="mo-go">Checkout</b></div></a>`).join("")}</div></div>` : ""}
        <div class="block"><div class="eyebrow"><span>Active</span>${act.length ? `<span class="faint">${act.length}</span>` : ""}</div>
          ${act.length ? `<div class="mo-list">${act.map((o) => orderCard(o, c[o.token], hl && o.code === hl)).join("")}</div>`
            : `<p class="quiet small">No active orders. ${all.length ? "" : "Open a shop, add items to the cart and tap Hold or Buy."}</p><a class="btn line" href="#/" style="margin-top:10px">Find shops near you</a>`}</div>
        ${past.length ? `<div class="block"><div class="eyebrow"><span>Earlier</span></div><div class="mo-list">${past.slice(0, 20).map((o) => orderCard(o, c[o.token], false)).join("")}</div></div>` : ""}
        <div style="height:90px"></div>`;
      $("#back").onclick = () => (history.length > 1 ? history.back() : go("#/"));
      const find = (t) => all.find((o) => o.token === t);
      $$("[data-wa]").forEach((b) => b.onclick = () => {
        const o = find(b.dataset.wa), st = c[o.token], s = A.getShop(o.shopId); if (!s) return;
        waShop(s, `Hi ${s.name}, about my My Market order *${st.code}* (${rupee(st.total || 0)}) — `);
      });
      $$("[data-cx]").forEach((b) => b.onclick = async () => {
        if (!confirm("Cancel this order?")) return;
        try { await window.MM_CLOUD.cancelMyOrder(b.dataset.cx); toast("Order cancelled"); await refreshOrders(); draw(); }
        catch { toast("Couldn't cancel — check your internet"); }
      });
      $$("[data-again]").forEach((b) => b.onclick = () => {
        const o = find(b.dataset.again), st = c[o.token], s = A.getShop(o.shopId); if (!s) return;
        let n = 0; for (const l of st.lines || []) if (s.items.find((i) => i.id === l.item_id)) { sc.add(s.id, l.item_id, l.qty); n++; }
        if (!n) return toast("These items aren't listed at the shop any more");
        go(`#/shop/${s.id}?cart=buy`);
      });
      if (hl) setTimeout(() => $(".mo-card.hl")?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
      syncTabs("orders");
    };
    draw();
    const tick = async () => {
      const ok = await refreshOrders().catch(() => false);
      if (!location.hash.startsWith("#/orders")) return;
      draw(); const u = $("#mo-upd"); if (u) u.textContent = ok ? "Updated " + tm(Date.now()) : "Offline — showing the last update";
    };
    tick();
    const iv = setInterval(tick, 20000); cleanups.push(() => clearInterval(iv));
  }

  // the floating cart bar on a shop's website
  function paintSiteCart(s) {
    const bar = $("#scb"); if (!bar) return;
    const lines = sc.lines(s), n = lines.reduce((x, l) => x + l.qty, 0), t = lines.reduce((x, l) => x + (l.it.price || 0) * l.qty, 0);
    bar.classList.toggle("on", n > 0); document.body.classList.toggle("has-scb", n > 0);
    $("#scbn").textContent = n; $("#scbt").textContent = rupee(t);
    $("#scbw").textContent = `${n} item${n === 1 ? "" : "s"} in your cart`;
  }

  const visitSrc = {}, shopTried = new Set();
  function shopView(id, params) {
    const s = A.getShop(id);
    if (!s) {
      const CL = window.MM_CLOUD;
      if (CL && CL.publicDone && CL.loadShop && !shopTried.has(id)) { // a link to a shop outside this area
        shopTried.add(id);
        app.innerHTML = '<div class="empty"><div class="serif">Opening the shop…</div></div>';
        CL.loadShop(id).catch(() => 0).then(() => route());
        return;
      }
      const loading = CL && !CL.publicDone;
      app.innerHTML = loading ? '<div class="empty"><div class="serif">Opening the shop…</div></div>'
        : '<div class="empty"><div class="serif">This shop isn\'t on My Market (any more).</div><p><a class="link" href="#/">Find shops near you</a></p></div>';
      return;
    }
    const m = A.getMarket(s.marketId);
    if (!ordersOn(s)) { // the shop's plan is overdue: its website is switched off
      const ph = String(s.phone || "").replace(/\D/g, "").slice(-10);
      app.innerHTML = `<div class="empty s-off">
        <div class="serif">${esc(s.name)}</div>
        <p>This shop's website is paused right now. You can still reach them:</p>
        <div class="btn-row" style="justify-content:center;flex-wrap:wrap;gap:8px;margin-top:12px">
          ${ph ? `<button class="btn auto" id="offwa">${ic("chat")} WhatsApp</button><a class="btn auto line" href="tel:+91${ph}">${ic("phone")} Call</a>` : ""}
          <a class="btn auto line" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" rel="noopener">${ic("pin")} Directions</a></div>
        <p style="margin-top:18px"><a class="link" href="#/">Find other shops near you</a></p></div>`;
      $("#offwa") && ($("#offwa").onclick = () => waShop(s, `Hi ${s.name}, I found your shop on My Market.`));
      return;
    }
    document.body.classList.add("site-mode");
    cleanups.push(() => document.body.classList.remove("site-mode"));
    const isSaved = saved.includes(id);
    const hl = params.get("item");
    const src = params.get("src") || visitSrc[id] || "app";
    visitSrc[id] = src;
    A.addView(id);
    try {
      const k = "mm.v." + id, last = +sessionStorage.getItem(k) || 0;
      if (Date.now() - last > 30 * 60000) { sessionStorage.setItem(k, Date.now()); window.MM_CLOUD?.logVisit(id, "view", src); }
    } catch {}
    const tap = (kind) => window.MM_CLOUD?.logVisit(id, kind, src);
    const open = A.isOpen(s);
    const cats = [...new Set(s.items.map((it) => it.cat))];
    const phone = String(s.phone || "").replace(/\D/g, "").slice(-10);
    const where = [s.shopNo && s.shopNo !== "—" ? `Shop ${s.shopNo}` : "", s.floor && s.floor !== "Ground floor" ? s.floor : "", m?.name, [s.locality || m?.locality, s.pincode || m?.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const hours = `${fmtHour(s.open)} – ${fmtHour(s.close)}`;
    const fromBack = history.length > 1 && src === "app";
    const priceOf = (it) => it.price ? `<b>${rupee(it.price)}</b>${off(it) ? ` <s>${rupee(it.mrp)}</s>` : ""}` : '<span class="ask">Price on request</span>';
    const addCtl = (it) => {
      if (A.itemStatus(it).key === "out") return `<span class="sp-out">Out of stock</span>`;
      if (!ordersOn(s)) return "";
      const n = sc.qty(s.id, it.id);
      return n ? `<span class="sp-step"><button data-dec="${it.id}" aria-label="One less">−</button><b>${n}</b><button data-inc="${it.id}" aria-label="One more">+</button></span>`
        : `<button class="sp-addb" data-add="${it.id}">${ic("plus")}Add</button>`;
    };
    const card = (it, i) => {
      const st = A.itemStatus(it);
      const word = st.key === "out" ? "Out of stock" : st.few ? "Only a few left" : st.key === "confirmed" ? "In stock" : "Ask availability";
      return `<div class="sp rv ${it.id === hl ? "hl" : ""} ${st.key === "out" ? "is-out" : ""}" id="it-${it.id}" data-item="${it.id}" style="--d:${Math.min(i, 12) * 45}ms">
        <a class="sp-link" href="#/item/${s.id}/${it.id}">
        <span class="sp-img">${off(it) ? `<i class="sp-off">-${off(it)}%</i>` : ""}${it.img ? `<img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy">` : art(it.cat, 56)}</span>
        <span class="sp-b"><em>${esc(it.brand && it.brand !== "Generic" ? it.brand : C[it.cat]?.name || "")}</em><span class="sp-n">${esc(it.name)}</span>
        <span class="sp-p">${priceOf(it)}</span><span class="sp-s ${st.key} ${st.few ? "few" : ""}">${word}</span></span></a>
        <div class="sp-add" data-ctl="${it.id}">${addCtl(it)}</div></div>`;
    };
    app.innerHTML = `
      <div class="site" style="${catVars(s.cat)}">
      <header class="s-nav">
        ${fromBack ? `<button class="s-icon" id="back" aria-label="Back">${ic("back")}</button>` : ""}
        <a class="s-mark" href="#/shop/${s.id}">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<span>${esc(s.name[0])}</span>`}<b>${esc(s.name)}</b></a>
        <button class="s-icon" id="share" aria-label="Share">${ic("arrow")}</button>
        <button class="s-icon" id="save" aria-label="Save" ${isSaved ? 'style="color:var(--terracotta)"' : ""}>${ic(isSaved ? "heartF" : "heart")}</button>
      </header>

      ${s.cover ? `<div class="s-cover"><img src="${esc(s.cover)}" alt="${esc(s.name)}"></div>` : ""}
      <section class="s-hero ${s.cover ? "has-cover" : ""}">
        <span class="s-blob b1"></span><span class="s-blob b2"></span><span class="s-blob b3"></span>
        <div class="s-in">
          <div class="s-logo">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)} logo">` : `<span>${esc(s.name[0])}</span>`}</div>
          <p class="s-kicker">${esc(C[s.cat].name)}${m ? ` · ${esc(m.name)}` : ""}</p>
          <h1 class="s-title">${esc(s.name)}</h1>
          <p class="s-status"><i class="${open ? "on" : "off"}"></i>${open ? `Open now · until ${fmtHour(s.close)}` : `Closed · opens ${fmtHour(s.open)}`}${s.verified ? ' <span class="s-ver">✓ Verified shop</span>' : ""}</p>
          ${where ? `<p class="s-addr">${ic("pin")}${esc(where)}</p>` : ""}
          ${s.items.length && ordersOn(s) ? `<div class="s-perks"><span>${ic("bag")}Order online</span><span>${ic("clock")}Hold for pickup</span>${s.delivery ? `<span>${ic("truck")}Home delivery</span>` : ""}<span>${ic("check")}Pay at the shop</span></div>` : ""}
          <div class="s-cta">
            ${s.items.length ? `<a class="s-btn shop" href="#" id="toprod">${ic("bag")}Shop now</a>` : ""}
            <button class="s-btn wa" id="wa">${ic("chat")}WhatsApp us</button>
            ${phone ? `<a class="s-btn" id="call" href="tel:+91${phone}">${ic("user")}Call</a>` : ""}
            <a class="s-btn ${phone ? "" : "solo"}" id="dir" href="${loc ? `#/route/${s.id}` : gmaps}" ${loc ? "" : 'target="_blank" rel="noopener"'}>${ic("pin")}Directions</a>
          </div>
        </div>
      </section>

      <div class="s-in" id="sorders"></div>
      ${!ordersOn(s) && s.items.length ? `<div class="s-in"><div class="s-paused">Online orders are paused at ${esc(s.name)} right now — message them on WhatsApp to order.</div></div>` : ""}
      <div class="s-in">
        <div class="s-facts rv">
          <div><b>${s.items.length}</b><span>Products</span></div>
          <div><b>${hours}</b><span>Shop hours</span></div>
          <div><b>${s.closedDay && s.closedDay !== "None" ? `${s.closedDay.slice(0, 3)} off` : "7 days"}</b><span>${s.closedDay && s.closedDay !== "None" ? "Weekly holiday" : "Open all week"}</span></div>
        </div>

        ${s.promo ? `<div class="s-offer rv"><span>Offer</span><p>${esc(s.promo)}</p></div>` : ""}

        ${s.about || (s.payMethods || []).length || s.delivery ? `<section class="s-sec rv">
          <div class="s-head"><h2>About us</h2></div>
          ${s.about ? `<p class="s-about">${esc(s.about)}</p>` : ""}
          <div class="s-chips">${(s.payMethods || []).map((p) => `<span>${esc(p)}</span>`).join("")}${s.delivery ? '<span class="dl">Home delivery</span>' : ""}</div>
        </section>` : ""}

        ${(s.gallery || []).length ? `<section class="s-sec rv">
          <div class="s-head"><h2>Photos</h2></div>
          <div class="s-gal">${s.gallery.map((g, i) => `<button data-gal="${i}"><img src="${esc(g)}" alt="${esc(s.name)} photo ${i + 1}" loading="lazy"></button>`).join("")}</div>
        </section>` : ""}

        <section class="s-sec" id="sprod">
          <div class="s-head rv"><h2>Products</h2><p>${s.items.length ? `Live prices and stock from ${esc(s.name)}` : "This shop is adding its products"}</p></div>
          ${s.items.length ? `<div class="s-tools">
            <label class="s-search">${ic("search")}<input id="ishop" placeholder="Search products" autocomplete="off"></label>
            ${cats.length > 1 ? `<div class="s-tabs" id="scats"><button class="on" data-sc="">All</button>${cats.map((c) => `<button data-sc="${c}">${esc(C[c]?.name || c)}</button>`).join("")}</div>` : ""}
          </div>
          <div class="s-grid" id="sgrid">${s.items.map(card).join("")}</div>
          <p class="s-none hidden" id="snone">No products match. <button class="link" id="askit">Ask the shop on WhatsApp</button></p>`
          : `<div class="s-emptyp"><p>Message the shop to ask what's in stock.</p><button class="s-btn wa" id="wa2">${ic("chat")}Ask on WhatsApp</button></div>`}
        </section>

        <section class="s-sec rv">
          <div class="s-head"><h2>Visit us</h2><p>${esc(s.landmark || "We look forward to seeing you")}</p></div>
          <div class="s-visit">
            <div class="s-map" id="smap"></div>
            <div class="s-info">
              ${where ? `<div class="s-row"><span>Address</span><p>${esc(where)}</p></div>` : ""}
              ${phone ? `<div class="s-row"><span>Phone & WhatsApp</span><p><a href="tel:+91${phone}">+91 ${phone.slice(0, 5)} ${phone.slice(5)}</a></p></div>` : ""}
              <div class="s-row"><span>Opening hours</span>
                <table class="s-hours">${DAYS.map((d) => `<tr class="${d === today ? "now" : ""}"><td>${d}</td><td>${d === s.closedDay ? "Closed" : hours}</td></tr>`).join("")}</table></div>
              <a class="s-btn dark" href="${gmaps}" target="_blank" rel="noopener">${ic("pin")}Get directions</a>
              ${s.mapsUrl ? `<p style="margin:10px 0 0"><a class="link" href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">See us on Google Maps</a>${s.reviewUrl ? ` · <a class="link" href="${esc(s.reviewUrl)}" target="_blank" rel="noopener">Rate us on Google ⭐</a>` : ""}</p>` : ""}
            </div>
          </div>
        </section>
      </div>

      <footer class="s-foot">
        <div class="s-in">
          <b>${esc(s.name)}</b>
          <p>${esc(where)}</p>
          <div class="s-foot-links"><a href="#/">Find more shops near you</a><a href="business.html" target="_blank" rel="noopener">Own a shop? Get your own website</a></div>
          <small>Website by <a href="#/">My Market</a> · live stock and prices from local shops</small>
        </div>
      </footer>
      <button class="s-fab" id="wa3" aria-label="WhatsApp the shop">${ic("chat")}</button>
      <div class="s-cartbar" id="scb">
        <span class="scb-ic">${ic("bag")}<i id="scbn">0</i></span>
        <span class="scb-t"><b id="scbt"></b><em id="scbw"></em></span>
        <button class="scb-hold" id="scbh">Hold</button><button class="scb-go" id="scbg">Buy ${ic("arrow")}</button>
      </div>
      </div>`;
    $("#back") && ($("#back").onclick = () => history.back());
    $("#save").onclick = () => {
      saved = isSaved ? saved.filter((x) => x !== id) : [id, ...saved]; A.store.set("saved", saved);
      toast(isSaved ? "Removed from saved" : "Saved"); shopView(id, params);
    };
    const wa = (txt) => { tap("whatsapp"); waShop(s, txt || `Hi ${s.name}, I found your shop on My Market.`); };
    ["#wa", "#wa2", "#wa3"].forEach((k) => $(k) && ($(k).onclick = () => wa()));
    $("#call") && $("#call").addEventListener("click", () => tap("call"));
    $("#dir").addEventListener("click", () => tap("directions"));
    $("#share").onclick = async () => {
      tap("share");
      const url = window.MM_CLOUD ? window.MM_CLOUD.shopLink(s.id, "share") : location.href;
      try { if (navigator.share) return await navigator.share({ title: s.name, text: `${s.name} — see their products and prices`, url }); } catch (x) { if (x.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { prompt("Copy this link", url); }
    };
    let catF = "", q = "";
    const filter = () => {
      let shown = 0;
      $$("[data-item]").forEach((b) => {
        const it = s.items.find((x) => x.id === b.dataset.item);
        const hide = (!!q && !`${it.name} ${it.brand}`.toLowerCase().includes(q)) || (!!catF && it.cat !== catF);
        b.classList.toggle("hidden", hide); if (!hide) shown++;
      });
      $("#snone") && $("#snone").classList.toggle("hidden", shown > 0);
    };
    $("#ishop") && $("#ishop").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); filter(); });
    $("#askit") && ($("#askit").onclick = () => wa(`Hi ${s.name}, do you have ${$("#ishop").value.trim()}?`));
    $$("[data-sc]").forEach((b) => b.onclick = () => { catF = b.dataset.sc; $$("[data-sc]").forEach((x) => x.classList.toggle("on", x === b)); filter(); });
    // tap a gallery photo: view it large
    $$("[data-gal]").forEach((b) => b.onclick = () => {
      const all = s.gallery; let i = +b.dataset.gal;
      const box = document.createElement("div"); box.className = "s-light";
      const show = () => { box.innerHTML = `<img src="${esc(all[i])}" alt=""><button class="x" aria-label="Close">×</button>${all.length > 1 ? '<button class="p" aria-label="Previous">‹</button><button class="n" aria-label="Next">›</button>' : ""}`; };
      show(); document.body.appendChild(box);
      box.onclick = (e) => {
        if (e.target.classList.contains("p")) { i = (i - 1 + all.length) % all.length; show(); }
        else if (e.target.classList.contains("n")) { i = (i + 1) % all.length; show(); }
        else box.remove();
      };
      cleanups.push(() => box.remove());
    });
    try { const map = newMap("smap"); map.setView([s.lat, s.lng], 16); L.marker([s.lat, s.lng], { icon: dotIcon("best", s) }).addTo(map); map.scrollWheelZoom.disable(); } catch {}
    if (hl) setTimeout(() => $(`#it-${hl}`)?.scrollIntoView({ block: "center" }), 60);

    // add to cart (a little dot flies into the cart bar)
    const fly = (from) => {
      const bar = $("#scb .scb-ic"); if (!bar || !from || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const a0 = from.getBoundingClientRect(), b0 = bar.getBoundingClientRect(), dot = document.createElement("i");
      dot.className = "s-fly"; dot.style.left = a0.left + a0.width / 2 - 9 + "px"; dot.style.top = a0.top + a0.height / 2 - 9 + "px"; document.body.appendChild(dot);
      dot.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${b0.left - a0.left - a0.width / 2 + 18}px, ${b0.top - a0.top - a0.height / 2 + 18}px) scale(.4)`, opacity: .6 }],
        { duration: 520, easing: "cubic-bezier(.5,-0.3,.6,1)" }).onfinish = () => { dot.remove(); bar.classList.remove("pop"); void bar.offsetWidth; bar.classList.add("pop"); };
    };
    const ctl = (iid) => { const box = $(`[data-ctl="${iid}"]`); const it = s.items.find((x) => x.id === iid); if (box && it) box.innerHTML = addCtl(it); };
    $("#sgrid") && $("#sgrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-add],[data-inc],[data-dec]"); if (!b) return;
      e.preventDefault();
      const iid = b.dataset.add || b.dataset.inc || b.dataset.dec;
      sc.add(s.id, iid, b.dataset.dec ? -1 : 1);
      if (!b.dataset.dec) fly(b);
      ctl(iid); paintSiteCart(s);
      if (b.dataset.add) { try { navigator.vibrate && navigator.vibrate(25); } catch {} }
    });
    $("#scbg").onclick = () => siteCheckout(s, "buy", src);
    $("#scbh").onclick = () => siteCheckout(s, "hold", src);
    $("#toprod") && ($("#toprod").onclick = (e) => { e.preventDefault(); $("#sprod")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    paintSiteCart(s);
    cleanups.push(() => document.body.classList.remove("has-scb"));
    if (params.get("cart") === "hold" || params.get("cart") === "buy") setTimeout(() => sc.lines(s).length && siteCheckout(s, params.get("cart"), src), 120);

    // this customer's active orders at this shop: one short line, full tracking on My orders
    const paintMine = () => {
      const box = $("#sorders"); if (!box) return;
      const c = ordCache(), mine = myOrders().filter((o) => o.shopId === s.id && isActive(c[o.token], o));
      if (!mine.length) { box.innerHTML = ""; return; }
      const st = c[mine[0].token];
      box.innerHTML = `<a class="s-ord ${st.status}" href="#/orders">
        <span class="s-ord-ic">${ic(st.status === "ready" ? "check" : "clock")}</span>
        <div><b>${mine.length > 1 ? `${mine.length} orders here` : `Order ${esc(st.code)} · ${rupee(st.total || 0)}`}</b><p>${mine.length > 1 ? "Tap to track them" : esc(orderWord(st))}</p></div>
        <span class="s-ord-go">Track ${ic("arrow")}</span></a>`;
    };
    paintMine();
    if (myOrders().some((o) => o.shopId === s.id)) refreshOrders().then(paintMine).catch(() => {});

    // sections fade up as they scroll into view
    const rv = $$(".site .rv");
    if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -8% 0px" });
      rv.forEach((x) => io.observe(x)); cleanups.push(() => io.disconnect());
    } else rv.forEach((x) => x.classList.add("in"));
  }

  // ---------- product card (shared by shop page, search, owner preview) ----------
  const ART = {
    mobile: '<rect x="15" y="6" width="18" height="36" rx="3"/><path d="M21 37h6"/>',
    electronics: '<rect x="9" y="11" width="30" height="20" rx="2"/><path d="M5 36h38l-3 3H8z"/>',
    electrical: '<path d="M24 6a11 11 0 0 0-6 20c1.5 1 2 2.5 2 4h8c0-1.5.5-3 2-4a11 11 0 0 0-6-20z"/><path d="M20 35h8M21 39h6"/>',
    hardware: '<path d="M30 8a8 8 0 0 0-7 11L9 33a3 3 0 0 0 4 4l14-14a8 8 0 0 0 11-7l-5 5-5-1-1-5z"/>',
    plumbing: '<path d="M8 18h18a6 6 0 0 1 6 6v5"/><path d="M8 24h16v5"/><path d="M15 18v-6M10 12h10"/><path d="M32 35c0 2-1.5 4-1.5 4S29 37 29 35a1.5 1.5 0 0 1 3 0z"/>',
    clothes: '<path d="M17 8l-9 5 3 8 4-2v21h18V19l4 2 3-8-9-5c-1 3-3.5 4-6 4s-5-1-6-4z"/>',
    footwear: '<path d="M6 30c0-6 2-14 4-16 3 0 4 4 9 4 3 0 5 3 9 6 5 3 14 3 14 9v3H6z"/><path d="M6 36h36"/>',
    kitchen: '<path d="M10 20h28v12a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path d="M6 20h36M20 14h8M24 14v-3"/>',
    grocery: '<path d="M6 10h5l4 20h20l4-14H13"/><circle cx="17" cy="37" r="2.5"/><circle cx="32" cy="37" r="2.5"/>',
    pharmacy: '<rect x="8" y="8" width="32" height="32" rx="6"/><path d="M24 15v18M15 24h18"/>',
    stationery: '<path d="M10 8h22a4 4 0 0 1 4 4v28H14a4 4 0 0 1-4-4z"/><path d="M10 36a4 4 0 0 1 4-4h22M17 15h12M17 21h9"/>',
    accessories: '<circle cx="24" cy="24" r="10"/><path d="M24 18v6l4 3M19 14l1-7h8l1 7M19 34l1 7h8l1-7"/>',
  };
  const art = (cat, size = 64) => `<svg class="art" viewBox="0 0 48 48" width="${size}" height="${size}">${ART[cat]}</svg>`;
  const pimg = (it) => it.img ? `<img src="${it.img}" alt="${esc(it.name)}" loading="lazy">` : art(it.cat);
  const off = (it) => (it.price && it.mrp > it.price ? Math.round((1 - it.price / it.mrp) * 100) : 0);
  function priceLine(it) {
    if (!it.price) return '<div class="pprice"><span class="quiet">Ask for price</span></div>';
    const o = off(it);
    return `<div class="pprice">${o ? `<span class="offred">-${o}%</span>` : ""}${amt(it.price)}${o ? `<span class="mrp">M.R.P.: <s>${rupee(it.mrp)}</s></span>` : ""}</div>`;
  }
  function productCard(s, it, hl = false) {
    const st = A.itemStatus(it);
    return `<a class="pcard ${hl ? "hl" : ""}" id="it-${it.id}" data-item="${it.id}" href="#/item/${s.id}/${it.id}">
      <div class="pimg" style="${catVars(it.cat)}">${pimg(it)}</div>
      <div class="pbody">
        <div class="pbrand">${esc(it.brand)}</div>
        <div class="pname">${esc(it.name)}</div>
        ${stars(it.rating, it.reviews)}
        ${priceLine(it)}
        <div class="pstat ${st.key} ${st.few ? "few" : ""}"><span class="dot ${st.key}"></span>${stWord(st)}</div>
      </div>

    </a>`;
  }
  function bindAdd(root) {
    $$("[data-add]", root).forEach((b) => b.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const [sid, iid] = b.dataset.add.split("|");
      A.addToBag(sid, iid); refreshBag(); toast("Added to bag");
      b.textContent = "✓ Added"; b.classList.add("done");
    });
  }
  const bagBtn = () => ""; // ordering comes back once orders live on the server
  const bagBtnOld = () => { const n = A.bagCount(); return `<a class="iconbtn bagbtn" href="#/bag" aria-label="Bag">${ic("bag")}<i class="bcount ${n ? "" : "hidden"}">${n}</i></a>`; };
  function refreshBag() { const n = A.bagCount(); $$(".bcount").forEach((b) => { b.textContent = n; b.classList.toggle("hidden", !n); }); }

  function searchView(q0) {
    let mode = "list", showMore = false;
    app.innerHTML = `
      <div class="navwrap">
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><div class="toggle hidden" id="tog"><button data-mode="list" class="on">List</button><button data-mode="map">Map</button></div></div>
      <div class="pad"><label class="seek">
        <input id="q" placeholder="Search an item, brand or shop" value="${esc(q0)}" autocomplete="off" enterkeyhint="search">
        <button id="clr" class="${q0 ? "" : "hidden"}" aria-label="Clear">${ic("close")}</button><span class="seekbtn">${ic("search")}</span>
      </label></div>
      ${rangeChips("srange")}
      </div>
      <div id="results"></div>`;
    const input = $("#q");
    $$("#srange [data-range]").forEach((b) => b.onclick = () => { A.setRange(b.dataset.range); $$("#srange button").forEach((x) => x.classList.toggle("on", x === b)); render(input.value); });
    $("#back").onclick = () => go("#/");
    if (!q0) setTimeout(() => input.focus(), 50);
    $$("[data-mode]").forEach((b) => b.onclick = () => { mode = b.dataset.mode; $$("[data-mode]").forEach((x) => x.classList.toggle("on", x === b)); render(input.value); });

    function render(q) {
      cleanups.forEach((f) => f()); cleanups = [];
      const box = $("#results");
      $("#clr").classList.toggle("hidden", !q);
      if (!q.trim()) {
        $("#tog").classList.add("hidden");
        box.innerHTML = `
          ${recent.length ? `<div class="block"><div class="eyebrow"><span>Recent</span></div><div class="entries">${recent.map((r) => `<button class="entry" data-q="${esc(r)}"><div class="body"><div class="name">${esc(r)}</div></div><div class="aside">${ic("arrow")}</div></button>`).join("")}</div></div>` : ""}
          <div class="block"><div class="eyebrow"><span>Try</span></div><div class="words">${SUGGEST.map((r) => `<button class="word" data-q="${esc(r)}">${esc(r)}</button>`).join("")}</div>
          <p class="faint small" style="margin-top:22px;line-height:1.5">Hinglish works too — nal, taar, joota.</p></div>`;
        $$("[data-q]", box).forEach((b) => b.onclick = () => { input.value = b.dataset.q; addRecent(b.dataset.q); A.logSearch(b.dataset.q, A.search(b.dataset.q, loc, 10)); commit(); });
        return;
      }
      const r = A.nearSearch(q, loc);
      const rows = [...r.confirmed, ...r.listed];
      const any = rows.length || r.likely.length || r.shopsByName.length;
      $("#tog").classList.toggle("hidden", !any);
      if (!any) {
        const tryWords = [...SUGGEST, "rice", "paracetamol", "notebook", "watch"].filter((w) => w !== q).slice(0, 8);
        box.innerHTML = `<div class="empty"><div class="serif">No shop ${areaNote(r.km)} lists “${esc(q)}” yet.</div><p>${A.getRange() !== "city" ? "Try a wider range above — " : ""}more shops are joining every week.</p>

          <p class="small quiet" style="margin-top:22px">Or try one of these:</p><div class="words">${tryWords.map((w) => `<button class="word" data-try="${esc(w)}">${esc(w)}</button>`).join("")}</div></div>`;
        $$("[data-try]", box).forEach((b) => b.onclick = () => { input.value = b.dataset.try; commit(); });
        return;
      }
      const best = rows[0];
      // one line per shop for the rest: the nearest match in each
      const seen = new Set(best ? [best.shop.id] : []);
      const others = rows.filter((x) => !seen.has(x.shop.id) && seen.add(x.shop.id));
      const rowEntry = (x) => `<a class="entry" href="#/item/${x.shop.id}/${x.item.id}">
        <div class="body"><div class="name">${esc(x.shop.name)}</div><div class="note"><span class="dot ${x.status.key}"></span>${esc(x.item.name)}</div></div>
        <div class="aside">${x.item.price ? `<b>${rupee(x.item.price)}</b>` : ""}${A.fmtDist(x.shop.dist)}</div></a>`;
      box.innerHTML = `
        ${r.far ? `<div class="banner" style="margin:12px var(--gut) 0"><div class="serif">No shops near you yet</div>
          <p>These are the nearest shops on My Market — ${A.fmtDist(r.far)} away.</p></div>` : ""}
        ${mode === "map" ? '<div class="map tall" id="rmap"></div>' : ""}
        ${r.shopsByName.length ? `<div class="block"><div class="eyebrow"><span>Shop</span></div><div class="entries">${r.shopsByName.map((s) => shopEntry(s)).join("")}</div></div>` : ""}
        ${best ? `<div class="answer ${best.status.key}">
          <div class="eyebrow"><span class="dot ${best.status.key}"></span>${best.status.key === "confirmed" ? "In stock nearby" : "Listed nearby"}</div>
          <h2 class="title">${esc(best.item.name)}</h2>
          <div class="where">at <b>${esc(best.shop.name)}</b>, ${esc(A.getMarket(best.shop.marketId).name)}<br>${away(best.shop.dist)} · ${esc(best.status.label.replace(/^In stock · /, ""))}</div>
          ${best.item.price ? `<div class="price" style="margin-top:10px">${rupee(best.item.price)}</div>` : ""}
          <div class="btn-row"><a class="btn" href="#/route/${best.shop.id}">Directions</a><a class="link" href="#/item/${best.shop.id}/${best.item.id}">View item</a></div>
        </div>` : ""}
        ${others.length ? `<div class="block"><div class="eyebrow"><span>Also at</span><span class="faint">${others.length} · ${r.far ? "nearest shops" : areaNote(r.km)}</span></div><div class="entries">${others.map(rowEntry).join("")}</div></div>` : ""}
        ${r.likely.length ? `<div class="block">${showMore || !rows.length
          ? `<div class="eyebrow"><span>${rows.length ? "May also have it" : `No exact match · these ${r.likely.length > 1 ? "shops sell" : "shop sells"} ${esc((r.cats || []).slice(0, 2).map((c) => C[c].name).join(" & ") || "similar items")}`}</span></div><div class="entries">${r.likely.map((s) => shopEntry(s, '<span class="dot likely"></span>' + A.fmtDist(s.dist))).join("")}</div>`
          : `<button class="link" id="more">${r.likely.length} more shop${r.likely.length > 1 ? "s" : ""} may have it</button>`}</div>` : ""}
        <div style="height:30px"></div>`;
      $("#more") && ($("#more").onclick = () => { showMore = true; render(q); });
      $("#far-demo") && ($("#far-demo").onclick = () => { A.clearDemoShift(); A.setDemoShift(loc); location.reload(); });
      $("#far-pilot") && ($("#far-pilot").onclick = pickPilot);
      $$("a", box).forEach((a) => a.addEventListener("click", () => { addRecent(q); A.logSearch(q, r); }));
      if (mode === "map") {
        const map = newMap("rmap");
        L.marker([loc.lat, loc.lng], { icon: meIcon() }).addTo(map);
        const pts = [[loc.lat, loc.lng]];
        const put = (s, cls) => { L.marker([s.lat, s.lng], { icon: dotIcon(cls) }).bindPopup(shopPopup(s)).addTo(map); pts.push([s.lat, s.lng]); };
        if (best) put(best.shop, "best");
        others.forEach((x) => put(x.shop, x.status.key === "confirmed" ? "hit" : ""));
        r.likely.forEach((s) => { L.marker([s.lat, s.lng], { icon: dotIcon("dim", s) }).bindPopup(shopPopup(s)).addTo(map); pts.push([s.lat, s.lng]); });
        map.fitBounds(pts, { padding: [36, 36], maxZoom: 17 });
      }
    }
    let logT;
    const commit = () => {
      history.replaceState(null, "", "#/search" + (input.value ? "?q=" + encodeURIComponent(input.value) : ""));
      render(input.value);
      // a search counts once the customer pauses on it (not every letter typed)
      clearTimeout(logT);
      const v = input.value.trim();
      if (v.length >= 3) logT = setTimeout(() => { if (input.value.trim() === v) A.logSearch(v, A.nearSearch(v, loc)); }, 2500);
    };
    cleanups.push(() => clearTimeout(logT));
    let t;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(commit, 250); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { addRecent(input.value); A.logSearch(input.value, A.search(input.value, loc, 10)); input.blur(); commit(); } });
    $("#clr").onclick = (e) => { e.preventDefault(); input.value = ""; commit(); input.focus(); };
    render(q0);
  }

  function askView(q, askId) {
    if (askId && A.getAsk(askId)) q = A.getAsk(askId).q;
    if (!q) return go("#/search");
    addRecent(q);
    app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">Simulated in v1</span></div>
      <div class="pad" style="margin-top:34px">
        <div class="eyebrow">Asking nearby shops</div>
        <h1 class="title" style="margin-top:12px">“Do you have ${esc(q)}?”</h1>
        <div class="quiet small" id="askstat" style="margin-top:14px">Sending…</div>
        <div class="progress"><div id="bar"></div></div>
      </div>
      <div class="block"><div class="entries" id="asklist"></div></div>
      <p class="pad faint tiny" style="margin:28px 0 40px;line-height:1.6">In the live app each shop receives a WhatsApp message and answers with one tap.</p>`;
    $("#back").onclick = () => history.back();
    // Re-opening an earlier question (?id=) shows its replies; otherwise a new question is sent.
    let a0 = askId && A.getAsk(askId);
    if (!a0) {
      const job = A.ask(q, loc);
      a0 = job.ask;
      history.replaceState(null, "", "#/ask?id=" + a0.id + "&q=" + encodeURIComponent(q));
    }
    if (!a0.targets.length) { $("#askstat").textContent = "No matching shops within 5 km."; return; }
    $("#asklist").innerHTML = a0.targets.map((t) => {
      const s = A.getShop(t.shopId);
      return shopEntry(s, `<span id="r-${s.id}"><span class="reply wait typing">${A.isOwnerShop(s.id) ? "Your shop" : "Waiting"}</span></span>`);
    }).join("");
    // replies arrive in storage (from simulated shops, or from you on the shop-owner side)
    const paint = () => {
      const a = A.getAsk(a0.id); if (!a) return;
      let got = 0, yes = 0;
      for (const t of a.targets) {
        const rep = a.replies[t.shopId]; if (!rep) continue;
        got++;
        const cell = $(`#r-${t.shopId}`); if (!cell || cell.dataset.done) continue;
        cell.dataset.done = 1;
        if (rep.noReply) cell.innerHTML = '<span class="reply wait">No reply</span>';
        else if (rep.has) { cell.innerHTML = `<b>${rep.price ? rupee(rep.price) : ""}</b><span class="reply yes">Has it</span>`; cell.closest(".entry").classList.add("yes"); }
        else cell.innerHTML = '<span class="reply no">Doesn\'t have it</span>';
      }
      yes = Object.values(a.replies).filter((r) => r.has).length;
      const n = a.targets.length;
      $("#bar").style.width = (got / n) * 100 + "%";
      $("#askstat").innerHTML = got < n ? `${got} of ${n} replied${yes ? ` · ${yes} have it` : ""}<span class="typing"></span>` : (yes ? `${yes} of ${n} shops have it` : "No shop has it right now");
    };
    paint();
    const iv = setInterval(paint, 700);
    cleanups.push(() => clearInterval(iv));
  }

  function routeView(id) {
    const s = A.getShop(id);
    if (!s) return go("#/");
    let mode = "foot";
    const MODES = { foot: { l: "Walk", verb: "walk", srv: "routed-foot", kmh: 4.5, g: "walking" }, bike: { l: "Two-wheeler", verb: "ride", srv: "routed-bike", kmh: 18, g: "two-wheeler" }, car: { l: "Car", verb: "drive", srv: "routed-car", kmh: 20, g: "driving" } };
    const crow = A.distKm(loc, s);
    app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px">
        <div class="eyebrow">To ${esc(s.name)}</div>
        <h1 class="display" id="rt-sum" style="margin-top:12px">…</h1>
        <div class="quiet small" id="rt-sub" style="margin-top:8px">&nbsp;</div>
        <div class="modes toggle">${Object.entries(MODES).map(([k, v]) => `<button class="${k === mode ? "on" : ""}" data-md="${k}">${v.l}</button>`).join("")}</div>
      </div>
      <div class="map tall" id="rtmap"></div>
      <div class="pad" style="margin-top:24px"><a class="btn" id="gmaps" target="_blank" rel="noopener">Start navigation</a></div>
      <div class="block"><div class="eyebrow"><span>Inside the market</span></div>${reachSteps(s)}
        <p class="faint tiny" style="line-height:1.6;margin-top:12px">GPS drifts in narrow lanes — follow these once you arrive.</p></div>
      <div style="height:40px"></div>`;
    $("#back").onclick = () => history.back();
    const map = newMap("rtmap");
    L.marker([loc.lat, loc.lng], { icon: meIcon() }).addTo(map);
    L.marker([s.lat, s.lng], { icon: dotIcon("best") }).addTo(map);
    let line = null, reqId = 0;
    const draw = async () => {
      const md = MODES[mode], my = ++reqId;
      $("#gmaps").href = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=${md.g}`;
      let coords, km, min, approx = false;
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(`https://routing.openstreetmap.de/${md.srv}/route/v1/driving/${loc.lng},${loc.lat};${s.lng},${s.lat}?overview=full&geometries=geojson`, { signal: ctl.signal });
        clearTimeout(to);
        const rt = (await r.json()).routes[0];
        coords = rt.geometry.coordinates.map(([x, y]) => [y, x]); km = rt.distance / 1000;
        min = mode === "foot" ? rt.duration / 60 : (km / md.kmh) * 60; // city traffic: own speed for vehicles
      } catch { approx = true; coords = [[loc.lat, loc.lng], [s.lat, s.lng]]; km = crow * 1.3; min = (km / md.kmh) * 60; }
      if (my !== reqId) return;
      line && map.removeLayer(line);
      line = L.polyline(coords, { color: "#1f6e6a", weight: 5, opacity: .9, dashArray: approx ? "2 8" : null, lineCap: "round" }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 18 });
      const t = min < 60 ? `${Math.max(1, Math.round(min))} min` : `${(min / 60).toFixed(1)} h`;
      $("#rt-sum").textContent = `${t} ${md.verb}`;
      $("#rt-sub").textContent = `${A.fmtDist(km)}${approx ? " · approximate" : ""}${crow > 50 ? " · far from this market" : ""}`;
    };
    $$("[data-md]").forEach((b) => b.onclick = () => { mode = b.dataset.md; $$("[data-md]").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
    draw();
  }

  function meView() {
    const sv = saved.map(A.getShop).filter(Boolean);
    app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px"><h1 class="display">Yours</h1></div>
      <div class="block"><div class="eyebrow"><span>Location</span><button class="link" id="chg" style="font-size:10.5px">Change</button></div>
        <div class="serif" style="font-size:24px">${esc(loc.label)}${loc.sub ? `<span class="quiet">, ${esc(loc.sub)}</span>` : ""}</div></div>
      <a class="bizcard" href="business.html" target="_blank" rel="noopener" style="margin:26px var(--gut) 0">
        <span class="bz-ic">${ic("store")}</span>
        <span class="body"><span class="serif" style="font-size:19px;display:block">Own a shop? Get My Market Business</span>
        <span class="small quiet">A separate app for billing, stock and khata — 2 months free</span></span>${ic("arrow")}
      </a>
      <a class="entry" href="#/orders" style="margin:20px var(--gut) 0;width:auto">${ic("receipt")}<div class="body"><div class="name">My orders</div>
        <div class="note">${activeOrders() ? `${activeOrders()} active · ` : ""}${myOrders().length ? `${myOrders().length} in the last 30 days` : "Orders and holds you place show here"}</div></div>${ic("arrow")}</a>
      ${A.store.get("asks", []).length ? `<div class="block"><div class="eyebrow"><span>Your questions to shops</span></div><div class="entries">
        ${A.store.get("asks", []).slice(0, 3).map((a) => { const yes = Object.values(a.replies).filter((r) => r.has).length;
          return `<a class="entry" href="#/ask?id=${a.id}"><div class="body"><div class="name">“${esc(a.q)}”</div><div class="note">${Object.keys(a.replies).length} of ${a.targets.length} replied</div></div><div class="aside">${yes ? `<b style="color:var(--in)">${yes} have it</b>` : ""}</div></a>`; }).join("")}
      </div></div>` : ""}
      <div class="block"><div class="eyebrow"><span>Saved shops</span></div>
        ${sv.length ? `<div class="entries">${sv.map((s) => shopEntry(s)).join("")}</div>` : '<p class="quiet small">Tap the heart on a shop to keep it here.</p>'}</div>
      <div class="block"><div class="eyebrow"><span>Recent searches</span>${recent.length ? '<button class="link" id="clrrec" style="font-size:10.5px">Clear</button>' : ""}</div>
        ${recent.length ? `<div class="words">${recent.map((r) => `<a class="word" href="#/search?q=${encodeURIComponent(r)}">${esc(r)}</a>`).join("")}</div>` : '<p class="quiet small">None yet.</p>'}</div>
      <div class="rule"></div>
      <div class="block"><button class="link" id="demo-reset" style="color:var(--out)">Clear my history on this phone</button></div>
      <p class="pad faint tiny" style="margin:34px 0 40px;line-height:1.6">My Market · shops and prices come from registered shops. Map © OpenStreetMap contributors.</p>`;
    $("#back").onclick = () => go("#/");
    $("#chg").onclick = openLocationSheet;
    $("#clrrec") && ($("#clrrec").onclick = () => { recent = []; A.store.set("recent", []); meView(); });
    $("#demo-reset").onclick = () => {
      if (!confirm("Clear saved shops, recent searches and your history on this phone?")) return;
      ["feedback", "trust", "saved", "recent", "bag", "orders", "asks", "searchLog", "views", "watch"].forEach((k) => A.store.del(k));
      location.reload();
    };
  }

  function orderEntry(o) {
    const s = A.getShop(o.shopId);
    const steps = A.STEPS[o.mode];
    const label = o.cancelled ? "Cancelled" : steps[o.step];
    const n = o.items.reduce((a, b) => a + b.qty, 0);
    return `<a class="entry" href="#/order/${o.id}"><div class="body"><div class="name">${esc(s ? s.name : "Shop")}</div>
      <div class="note">${n} item${n > 1 ? "s" : ""} · ${o.mode === "reserve" ? "Reserved" : o.mode === "delivery" ? "Delivery" : "Pickup"} · ${esc(label)}</div></div>
      <div class="aside"><b>${o.total ? rupee(o.total) : "At shop"}</b>${new Date(o.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div></a>`;
  }

  // ---------- bottom tabs (customer screens only) ----------
  const TAB_ON = { "": "home", item: "home", search: "search", ask: "search", me: "me", orders: "orders", order: "me", bag: "bag" };
  // Shop app: five main pages — Bill (home), Orders, Stock, Reports, More. See DESIGN.md.
  const BIZ_ON = { "": "bill", bill: "bill", cart: "bill", inbox: "orders", items: "stock", stockin: "stock", reports: "reports", bills: "reports", insights: "reports", analytics: "reports",
    more: "more", site: "more", google: "more", details: "more", security: "more", backup: "more", plan: "more" };
  function syncTabs(r, parts = []) {
    const nav = $("#tabs"); if (!nav) return;
    if (BIZ) {
      const on = A.ownerShop() && r === "biz" ? BIZ_ON[parts[1] || ""] : null;
      nav.classList.toggle("hidden", !on); nav.classList.add("five"); document.body.classList.toggle("tabs-on", !!on);
      if (!on) return;
      const id = A.ownerShopId(), c = A.store.get("billDraft:" + id, null), nCart = c ? (c.lines || []).reduce((a, x) => a + x.qty, 0) : 0;
      const nWait = A.pendingAsks(id).length + (A.store.get("newOrders:" + id, 0) || 0);
      const badge = (k) => k === "bill" ? `<i class="bcount ${nCart ? "" : "hidden"}" data-cartn>${nCart}</i>` : k === "orders" ? `<i class="bcount hot ${nWait ? "" : "hidden"}" data-bell>${nWait}</i>` : "";
      nav.innerHTML = [["bill", "#/biz", "receipt", "Bill"], ["orders", "#/biz/inbox", "bell", "Orders"], ["stock", "#/biz/items", "box", "Stock"], ["reports", "#/biz/reports", "chart", "Reports"], ["more", "#/biz/more", "grid", "More"]]
        .map(([k, h, i, l]) => `<a href="${h}" class="${on === k ? "on" : ""}"><span class="ti">${ic(i)}${badge(k)}</span>${l}</a>`).join("");
      return;
    }
    const on = TAB_ON[r];
    nav.classList.toggle("hidden", !on); document.body.classList.toggle("tabs-on", !!on);
    if (!on) return;
    const nAct = activeOrders();
    nav.innerHTML = [["home", "#/", "store", "Home"], ["search", "#/search", "search", "Search"], ["orders", "#/orders", "receipt", "Orders"], ["me", "#/me", "user", "You"]]
      .map(([k, h, i, l]) => `<a href="${h}" class="${on === k ? "on" : ""}">${ic(i)}${l}${k === "orders" && nAct ? `<i class="bcount">${nAct}</i>` : ""}</a>`).join("");
  }

  if (BIZ) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#/shop/"]');
      if (!a) return;
      e.preventDefault();
      window.open("index.html" + a.getAttribute("href"), "_blank", "noopener");
    }, true);
  }

  // ---------- router ----------
  function route() {
    cleanups.forEach((f) => { try { f(); } catch {} }); cleanups = [];
    closeSheet();
    const h = location.hash.slice(1) || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    if (BIZ) {
      // shop app: shop screens only; no customer location needed
      if (!loc) loc = PILOT_ORIG;
      if (parts[0] !== "biz") { go("#/biz"); return; }
    } else if (parts[0] === "biz") { location.replace("business.html" + location.hash); return; }
    if (!loc && !["welcome", "shop", "item", "p", "orders"].includes(parts[0])) { go("#/welcome"); return; }
    if (loc && parts[0] === "welcome") { go("#/"); return; }
    const fn = ROUTES[parts[0] || ""] || home;
    fn(parts, params);
    syncTabs(parts[0] || "", parts);
    if (parts[0] !== "shop" || !params.get("item")) window.scrollTo(0, 0);
  }
  // Other files (shop.js, biz.js) add their screens to ROUTES before the first render.
  const ROUTES = {
    "": home, welcome, me: meView,
    shop: (p, q) => shopView(p[1], q), search: (p, q) => searchView(q.get("q") || ""),
    ask: (p, q) => askView(q.get("q"), q.get("id")), route: (p) => routeView(p[1]), orders: (p, q) => myOrdersView(q),
  };
  // a form field that needs fixing: red outline, scrolled into view, focused, and the message shown
  // under the button and as a toast (browsers' own "required" bubbles don't show in installed apps)
  function badField(form, name, msg, errSel) {
    const el = form.querySelector(`[name="${name}"]`);
    form.querySelectorAll(".field.bad").forEach((x) => x.classList.remove("bad"));
    if (el) { el.classList.add("bad"); el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => el.focus({ preventScroll: true }), 300); }
    const out = errSel && document.querySelector(errSel); if (out) out.textContent = msg;
    toast(msg, 5000);
    return false;
  }
  window.MM_UI = {
    BIZ, A, C, $, $$, app, esc, ic, toast, badField, fmtHour, openWhatsApp, openSheet, closeSheet, go, rupee, dist, away, openWord, statusWord, stWord, catVars, mono, reverseName, stars, amt,
    sc, siteCheckout, paintSiteCart, newMap, meIcon, dotIcon, shopPopup, reachSteps, shopEntry, productCard, priceLine, pimg, art, off, bindAdd, bagBtn, refreshBag, orderEntry,
    loc: () => loc, addCleanup: (f) => cleanups.push(f), ROUTES, route,
  };
  window.addEventListener("hashchange", route);

  // ---------- stay up to date ----------
  // An installed app can stay open for days. Every 30 min (and when the app comes
  // back to the screen) check whether a newer version is online; if so, reload at a
  // safe moment — not while someone is typing or has a sheet open (carts are saved).
  const MY_V = +((document.querySelector('script[src*="js/app.js?v="]') || {}).src || "").replace(/.*v=(\d+).*/, "$1") || 0;
  let newer = false;
  const safeNow = () => !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") && $("#sheet").classList.contains("hidden");
  async function checkVersion() {
    if (!MY_V || newer || !navigator.onLine || location.protocol === "file:") return;
    try {
      const page = BIZ ? "business.html" : "index.html";
      const html = await (await fetch(`${page}?check=${Date.now()}`, { cache: "no-store" })).text();
      const live = +((html.match(/js\/app\.js\?v=(\d+)/) || [])[1] || 0);
      if (live > MY_V) {
        newer = true;
        const go = () => location.reload();
        if (safeNow()) { toast("Updating to the latest version…"); setTimeout(go, 1200); }
        else window.addEventListener("hashchange", () => setTimeout(go, 300), { once: true });
      }
    } catch { /* offline: try later */ }
  }
  setTimeout(checkVersion, 8000);
  setInterval(checkVersion, 30 * 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkVersion(); });
  document.addEventListener("DOMContentLoaded", route);
})();
