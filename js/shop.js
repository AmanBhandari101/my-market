// My Market — customer side: product page, and the product-in-an-area page Google lists.
(function () {
  const U = window.MM_UI, A = U.A, C = U.C, { $, $$, esc, ic, rupee } = U;

  // ---------- product page ----------
  const itemTried = new Set();
  function itemView([, shopId, itemId]) {
    const s = A.getShop(shopId);
    const it = s && s.items.find((x) => x.id === itemId);
    const CL = window.MM_CLOUD;
    if (!s && CL && CL.loadShop && CL.publicDone && !itemTried.has(shopId)) { // shared link to a shop outside this area
      itemTried.add(shopId);
      U.app.innerHTML = '<div class="empty"><div class="serif">Opening…</div></div>';
      CL.loadShop(shopId).catch(() => 0).then(() => U.route());
      return;
    }
    if (it && it.needDetails && CL && CL.itemDetails) { // long details come when the page opens
      const here = location.hash;
      CL.itemDetails(it.id).catch(() => null).then((d) => { A.addDetails(it, d); if (location.hash === here) U.route(); });
    }
    if (!it) { U.app.innerHTML = '<div class="empty"><div class="serif">This item isn\'t listed any more.</div><p><a class="link" href="#/">Back</a></p></div>'; return; }
    const loc = U.loc();
    const st = A.itemStatus(it);
    const m = A.getMarket(s.marketId);
    const other = loc ? A.elsewhere(it, s.id, loc) : [];
    let qty = 1;
    const o = U.off(it);
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><b class="ctitle">${esc(s.name)}</b></div>
      <div class="hero-img" style="${U.catVars(it.cat)}">${U.pimg(it)}</div>
      ${!it.photo && it.productPhoto && it.photoCredit && it.img === it.productPhoto ? `<p class="faint tiny pad" style="margin:4px 0 0">${esc(it.photoCredit)}</p>` : ""}
      <div class="pad" style="margin-top:20px">
        <div class="eyebrow" style="color:${C[it.cat].color}">${esc(it.brand)}</div>
        <h1 class="title" style="margin-top:6px">${esc(it.name)}${it.size && !it.name.toLowerCase().includes(it.size.toLowerCase()) ? ` <span class="quiet" style="font-weight:400">· ${esc(it.size)}</span>` : ""}</h1>
        <div style="margin-top:8px">${U.stars(it.rating, it.reviews)}</div>
        <div class="price-block">
          ${it.price ? `${o ? `<span class="offred" style="font-size:26px">-${o}%</span>` : ""}<span class="amt" style="font-size:30px"><sup>₹</sup>${it.price.toLocaleString("en-IN")}</span>${o ? `<span class="mrp">M.R.P.: <s>${rupee(it.mrp)}</s> · Inclusive of all taxes</span>` : ""}` : '<span class="big" style="font-size:22px">Ask the shop for price</span>'}
        </div>
        <div class="pstat ${st.key} ${st.few ? "few" : ""}" style="margin-top:10px;font-size:16px"><span class="dot ${st.key}"></span>${esc(st.label)}</div>
      </div>

      ${st.key !== "out" ? `<div class="pad pbuy" style="${U.catVars(s.cat)}">
        <div class="pbuy-q"><button id="pqm" aria-label="One less">−</button><b id="pqn">1</b><button id="pqp" aria-label="One more">+</button></div>
        <button class="pbuy-add" id="padd">${ic("bag")}Add to cart</button>
        <div class="pbuy-two"><button class="pbuy-hold" id="phold">${ic("clock")}Hold it for me</button><button class="pbuy-buy" id="pbuy">Buy now</button></div>
      </div>` : `<p class="pad pout">Out of stock right now — ask the shop when it's back.</p>`}
      <div class="sold-by">
        <div class="eyebrow">Sold by</div>
        <a class="entry" href="#/shop/${s.id}" style="border:0;padding:8px 0 4px">${U.mono(s)}
          <div class="body"><div class="name">${esc(s.name)}</div><div class="note">${esc(m.name)} · ${U.openWord(s)}</div></div>
          <div class="aside">${U.dist(s)}</div></a>

      </div>

      <div class="pad pmore">
        <button class="pm wa" id="wa">${ic("chat")}Ask on WhatsApp</button>
        <a class="pm" href="${loc ? `#/route/${s.id}` : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}" ${loc ? "" : 'target="_blank" rel="noopener"'}>${ic("pin")}Directions</a>
      </div>

      ${other.length ? `<div class="block"><div class="eyebrow"><span>Also at</span><span class="faint">compare</span></div><div class="entries">
        ${other.map((x) => `<a class="entry" href="#/item/${x.shop.id}/${x.item.id}"><div class="body"><div class="name">${esc(x.shop.name)}</div>
          <div class="note"><span class="dot ${x.status.key}"></span>${U.stWord(x.status)} · ${A.fmtDist(x.dist)}</div></div>
          <div class="aside">${x.item.price ? `<b>${rupee(x.item.price)}</b>` : '<span class="faint">Ask</span>'}</div></a>`).join("")}
      </div></div>` : ""}

      ${it.features && it.features.length ? `<div class="block"><div class="eyebrow"><span>About this item</span></div>
        <ul class="feat">${it.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>` : ""}
      ${it.description ? `<div class="block"><p style="margin:0;line-height:1.6">${esc(it.description)}</p></div>` : ""}
      <div class="block"><div class="eyebrow"><span>Details</span></div>
        <table class="specs">${it.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
      </div>

      <div class="block" style="padding-bottom:40px"><div class="eyebrow"><span>Been to this shop?</span></div>
        <div class="btn-row"><button class="link" id="fb-yes" style="color:var(--in)">I found it here</button><button class="link" id="fb-no" style="color:var(--out)">It wasn't there</button></div>
      </div>`;

    $("#back").onclick = () => (history.length > 1 ? history.back() : U.go(`#/shop/${s.id}`));
    // buy box: the same cart as the shop's website
    if ($("#padd")) {
      let pq = 1; const setQ = (n) => { pq = Math.max(1, Math.min(99, n)); $("#pqn").textContent = pq; };
      $("#pqm").onclick = () => setQ(pq - 1); $("#pqp").onclick = () => setQ(pq + 1);
      $("#padd").onclick = () => { U.sc.add(s.id, it.id, pq); U.toast(`Added to your cart at ${s.name}`); U.go(`#/shop/${s.id}?item=${it.id}`); };
      $("#phold").onclick = () => { U.sc.add(s.id, it.id, pq); U.go(`#/shop/${s.id}?cart=hold`); };
      $("#pbuy").onclick = () => { U.sc.add(s.id, it.id, pq); U.go(`#/shop/${s.id}?cart=buy`); };
    }
    $("#fb-yes").onclick = () => { A.feedback(s.id, it.id, true); U.toast("Thank you — marked in stock."); U.route(); };
    $("#fb-no").onclick = () => { A.feedback(s.id, it.id, false); U.toast("Thank you — we'll let others know."); U.route(); };
    $("#wa").onclick = () => {
      const d = String(s.phone || "").replace(/\D/g, "").slice(-10);
      if (d.length !== 10) return U.toast("This shop hasn't added a WhatsApp number");
      U.openWhatsApp(d, `Hi ${s.name}, I saw ${it.name}${it.price ? ` (${rupee(it.price)})` : ""} on My Market. Is it available?`);
    };
  }

  // ---------- one product in one area (the /p/<area>/<product> page Google lists) ----------
  const areaCache = {};
  function areaView([, area, product]) {
    const CL = window.MM_CLOUD, key = area + "/" + product, d = areaCache[key];
    if (d === undefined) {
      U.app.innerHTML = '<div class="empty"><div class="serif">Finding shops…</div></div>';
      if (!CL || !CL.areaProduct) { areaCache[key] = null; U.route(); return; }
      const here = location.hash;
      CL.areaProduct(area, product).catch(() => null).then((r) => { areaCache[key] = r; if (location.hash === here) U.route(); });
      return;
    }
    const offers = (d && d.offers) || [];
    if (!d || !d.product || !offers.length) {
      U.app.innerHTML = '<div class="empty"><div class="serif">No shop here has this right now.</div><p><a class="link" href="#/">Find shops near you</a></p></div>';
      return;
    }
    const p = d.product, loc = U.loc(), place = offers[0].locality || area.replace(/-/g, " ");
    const img = CL.photoUrl(p.photo_path) || p.photo_url || CL.photoUrl((offers.find((o) => o.photo_path) || {}).photo_path);
    const cat = C[p.cat] ? p.cat : "hardware";
    const st = (o) => A.itemStatus({ qty: o.stock === "in" ? 10 : o.stock === "few" ? 1 : o.stock === "out" ? 0 : null, reorderAt: 3,
      stockAt: o.updated_at ? Date.parse(o.updated_at) : null, lastConfirmed: o.updated_at ? Date.parse(o.updated_at) : null });
    const far = (o) => (loc && o.lat != null ? A.fmtDist(A.distKm(loc, o)) : "");
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="hero-img" style="${U.catVars(cat)}">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : U.art(cat, 96)}</div>
      ${p.photo_credit && img === p.photo_url ? `<p class="faint tiny pad" style="margin:4px 0 0">${esc(p.photo_credit)}</p>` : ""}
      <div class="pad" style="margin-top:20px">
        ${p.brand ? `<div class="eyebrow" style="color:${C[cat].color}">${esc(p.brand)}</div>` : ""}
        <h1 class="title" style="margin-top:6px">${esc(p.name)}${p.size && !p.name.toLowerCase().includes(String(p.size).toLowerCase()) ? ` <span class="quiet" style="font-weight:400">· ${esc(p.size)}</span>` : ""}</h1>
        <p class="quiet" style="margin-top:6px">${offers.length} shop${offers.length === 1 ? "" : "s"} in ${esc(place)} ${offers.length === 1 ? "has" : "have"} it</p>
      </div>
      <div class="block"><div class="eyebrow"><span>Where to buy</span></div><div class="entries">
        ${offers.map((o) => { const s = st(o); return `<a class="entry" href="#/item/${o.shop_id}/${o.item_id}">${U.mono({ name: o.name, cat: C[o.cat] ? o.cat : cat })}
          <div class="body"><div class="name">${esc(o.name)}</div>
          <div class="note"><span class="dot ${s.key}"></span>${U.stWord(s)}${o.landmark ? ` · ${esc(o.landmark)}` : ""}</div></div>
          <div class="aside">${o.price ? `<b>${rupee(o.price)}</b>` : '<span class="faint">Ask</span>'}${far(o) ? `<div class="faint tiny">${far(o)}</div>` : ""}</div></a>`; }).join("")}
      </div></div>
      ${p.features && p.features.length ? `<div class="block"><div class="eyebrow"><span>About this item</span></div>
        <ul class="feat">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>` : ""}
      ${p.description ? `<div class="block" style="padding-bottom:40px"><p style="margin:0;line-height:1.6">${esc(p.description)}</p></div>` : ""}`;
    $("#back").onclick = () => (history.length > 1 ? history.back() : U.go("#/"));
  }

  const toOrders = () => U.go("#/orders");   // old demo bag / checkout / order pages
  Object.assign(U.ROUTES, { p: areaView, item: itemView, bag: toOrders, checkout: toOrders, order: toOrders });
})();
