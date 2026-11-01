// My Market — shop-owner side ("My Market for Business").
// Rule: every owner action is a tap, never a form to type into, except the one-time setup.
// In production this side also runs over WhatsApp; here it is the same flows in the app.
(function () {
  const U = window.MM_UI, A = U.A, C = U.C, { $, $$, esc, ic, rupee } = U;
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
  const fmtH = (h) => (h % 12 || 12) + (h < 12 ? " am" : " pm");

  function biz(parts, params) {
    const sub = parts[1];
    if (sub === "claim") return claimView();
    if (sub === "new") return newShopView();
    if (!A.ownerShop()) return onboardView();
    if (sub === "items") return itemsView(params);
    if (sub === "insights") return insightsView();
    return dashView();
  }

  // ---------- onboarding ----------
  function onboardView() {
    U.app.innerHTML = `
      <div class="band">
        <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow">For shop owners</span></div>
        <div class="pad" style="margin-top:30px">
          <h1 class="display">Customers are already<br><em>looking for you.</em></h1>
          <p class="quiet" style="line-height:1.55;margin:14px 0 0">List your shop free. People nearby see what you stock, ask you questions on WhatsApp, and reserve before they walk in.</p>
        </div>
      </div>
      <div class="block"><div class="perks">
        <div><span>${ic("chat")}</span><b>Customer questions</b><p>“Do you have a 1 inch elbow?” — answer with one tap.</p></div>
        <div><span>${ic("chart")}</span><b>Missed sales report</b><p>What people searched for near you that nobody had.</p></div>
        <div><span>${ic("box")}</span><b>Orders & reservations</b><p>Pickup, delivery, or “keep it for me” — paid at your counter.</p></div>
        <div><span>${ic("camera")}</span><b>No typing</b><p>Photograph a shelf; we build your item list.</p></div>
      </div></div>
      <div class="pad" style="margin:30px 0 14px;display:grid;gap:16px;justify-items:center">
        <a class="btn" href="#/biz/claim">Find my shop</a>
        <a class="link" href="#/biz/new">My shop isn't listed — add it</a>
      </div>
      <p class="pad faint tiny" style="text-align:center;margin-bottom:40px">Free to list · takes about 5 minutes</p>`;
    $("#back").onclick = () => U.go("#/me");
  }

  function claimView() {
    const loc = U.loc();
    const shops = A.shopsNear(loc, 10).filter((s) => !s.own);
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px"><div class="eyebrow">Step 1 of 2</div><h1 class="title" style="margin-top:8px">Which one is your shop?</h1>
        <div class="inshop" style="margin-top:16px">${ic("search")}<input id="f" placeholder="Shop name" autocomplete="off"></div></div>
      <div class="block" style="padding-top:8px"><div class="entries" id="list">${shops.map((s) => U.shopEntry(s)).join("")}</div>
        <p class="small quiet" style="margin-top:18px">Not here? <a class="link" href="#/biz/new">Add your shop</a></p></div>`;
    $("#back").onclick = () => history.back();
    $("#f").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      $$("#list .entry").forEach((a) => a.classList.toggle("hidden", !a.textContent.toLowerCase().includes(q)));
    });
    $$("#list .entry").forEach((a) => a.onclick = (e) => {
      e.preventDefault();
      const s = A.getShop(a.getAttribute("href").split("/").pop());
      const code = String(1000 + Math.floor(Math.random() * 9000));
      U.openSheet(`
        <div class="eyebrow">Step 2 of 2 · Verify</div>
        <div class="title">${esc(s.name)}</div>
        <p class="quiet small" style="line-height:1.55">In the live app we send a code to the shop's WhatsApp number. <b>Demo code: ${code}</b></p>
        <input class="field" id="otp" inputmode="numeric" maxlength="4" placeholder="Enter 4-digit code" style="margin-top:8px;letter-spacing:.3em">
        <div class="opts"><button class="btn" id="ok">Verify & claim</button></div>`, (el) => {
        $("#ok", el).onclick = () => {
          if ($("#otp", el).value.trim() !== code) { U.toast("That code doesn't match"); return; }
          A.claimShop(s.id); U.closeSheet(); U.toast("It's yours. Welcome!"); U.go("#/biz");
        };
      });
    });
  }

  function newShopView() {
    const loc = U.loc();
    let cat = "hardware";
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">About 2 minutes</span></div>
      <div class="pad" style="margin-top:22px"><div class="eyebrow">Add your shop</div><h1 class="title" style="margin-top:8px">Tell customers where you are.</h1></div>
      <form id="f" class="pad form">
        <label>Shop name<input class="field" name="name" required placeholder="e.g. Sharma Hardware"></label>
        <label>What do you sell?</label>
        <div class="words" id="cats">${Object.entries(C).map(([k, c]) => `<button type="button" class="word ${k === cat ? "on" : ""}" data-cat="${k}" style="${U.catVars(k)}">${esc(c.name)}</button>`).join("")}</div>
        <label>Market or area<input class="field" name="area" placeholder="e.g. Beadonpura Bazaar"></label>
        <div class="two"><label>Shop no.<input class="field" name="shopNo" placeholder="B-12"></label>
          <label>Floor<select class="field" name="floor"><option>Ground floor</option><option>1st floor</option><option>Basement</option></select></label></div>
        <label>Landmark<input class="field" name="landmark" placeholder="e.g. Next to the Shiv temple, lane 2"></label>
        <div class="two"><label>Opens<select class="field" name="open">${HOURS.map((h) => `<option value="${h}" ${h === 10 ? "selected" : ""}>${fmtH(h)}</option>`).join("")}</select></label>
          <label>Closes<select class="field" name="close">${HOURS.map((h) => `<option value="${h}" ${h === 20 ? "selected" : ""}>${fmtH(h)}</option>`).join("")}</select></label></div>
        <label>Weekly holiday<select class="field" name="closedDay"><option>None</option>${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => `<option>${d}</option>`).join("")}</select></label>
        <label>Shop location <span class="faint tiny">— drag the pin onto your shop</span></label>
        <div class="map" id="pinmap" style="margin:0;height:220px"></div>
        <button class="btn" type="submit" style="margin-top:22px">Create my shop</button>
        <p class="faint tiny" style="text-align:center;margin:10px 0 40px">Demo — saved on this device only.</p>
      </form>`;
    $("#back").onclick = () => history.back();
    $$("#cats [data-cat]").forEach((b) => b.onclick = () => { cat = b.dataset.cat; $$("#cats .word").forEach((x) => x.classList.toggle("on", x === b)); });
    const map = U.newMap("pinmap");
    map.setView([loc.lat, loc.lng], 17);
    const pin = L.marker([loc.lat, loc.lng], { draggable: true, icon: U.dotIcon("best") }).addTo(map);
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!f.name.trim()) return;
      const p = pin.getLatLng();
      A.addShop({ ...f, name: f.name.trim(), cat }, { lat: p.lat, lng: p.lng });
      U.toast("Shop created");
      U.go("#/biz/items?setup=1");
    };
  }

  // ---------- dashboard ----------
  function dashView() {
    const draw = () => {
      const s = A.ownerShop();
      const asks = A.pendingAsks(s.id);
      const orders = A.ordersFor(s.id).filter((o) => !o.cancelled && o.step < A.STEPS[o.mode].length - 1);
      const missed = A.missedSales(s);
      const views = (A.store.get("views", {})[s.id] || 0) + 40 + Math.floor((s.id.length * 7) % 60);
      const inStock = s.items.filter((i) => A.itemStatus(i).key === "confirmed").length;
      const sig = JSON.stringify([asks.map((a) => a.id), orders.map((o) => o.id + o.step)]);
      if (U.app.dataset.sig === sig && $("#dash")) return;
      U.app.dataset.sig = sig;
      U.app.innerHTML = `
        <div class="band" id="dash" style="${U.catVars(s.cat)}">
          <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><a class="link" href="#/shop/${s.id}">View as customer</a></div>
          <div class="pad" style="margin-top:24px"><div class="eyebrow">Your shop · ${esc(C[s.cat].name)}</div>
            <h1 class="title" style="margin-top:8px">${esc(s.name)}</h1>
            <div class="facts" style="margin-top:10px"><span class="pill ${A.isOpen(s) ? "open" : "closed"}">${U.openWord(s)}</span>${s.verified ? '<span class="pill">✓ Verified</span>' : '<span class="pill">Verification pending</span>'}</div></div>
        </div>
        <div class="stats">
          <div><b>${views}</b><span>shop visits this week</span></div>
          <a href="#q" class="${asks.length ? "hot" : ""}"><b>${asks.length}</b><span>questions waiting</span></a>
          <a href="#o" class="${orders.length ? "hot" : ""}"><b>${orders.length}</b><span>active orders</span></a>
          <a href="#/biz/insights"><b>${missed.reduce((a, m) => a + m.n, 0)}</b><span>missed searches</span></a>
        </div>

        <div class="block" id="q"><div class="eyebrow"><span>Customer questions</span></div>
          ${asks.length ? asks.map((a) => `<div class="qcard">
            <div class="serif" style="font-size:21px">“Do you have ${esc(a.q)}?”</div>
            <div class="faint tiny">${Math.max(1, Math.round((Date.now() - a.at) / 60000))} min ago · a customer nearby</div>
            <div class="qrow"><input class="field" inputmode="numeric" placeholder="Price ₹ (optional)" data-price="${a.id}">
              <button class="btn auto" data-yes="${a.id}">Yes</button><button class="btn auto line" data-no="${a.id}">No</button></div>
          </div>`).join("") : '<p class="quiet small">No questions right now. When someone nearby asks for something you sell, it shows up here — and on your WhatsApp.</p>'}
        </div>

        <div class="block" id="o"><div class="eyebrow"><span>Orders & reservations</span></div>
          ${orders.length ? orders.map((o) => {
            const steps = A.STEPS[o.mode];
            const next = steps[o.step + 1];
            const verb = o.step === 0 ? (o.mode === "reserve" ? "Keep it aside" : "Accept") : next === "Picked up" || next === "Collected" ? "Customer collected" : next === "Delivered" ? "Mark delivered" : next === "Out for delivery" ? "Send for delivery" : "Mark ready";
            return `<div class="qcard">
              <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="eyebrow">${o.mode === "reserve" ? "Reservation" : o.mode === "delivery" ? "Delivery" : "Pickup"} · ${esc(steps[o.step])}</span><span class="faint tiny">${o.id}</span></div>
              ${o.items.map((l) => `<div class="small" style="margin-top:6px">${l.qty} × ${esc(l.name)}${l.price ? ` · ${rupee(l.price * l.qty)}` : ""}</div>`).join("")}
              <div class="small quiet" style="margin-top:6px">${o.mode !== "delivery" ? `Pickup code <b style="color:var(--ink)">${o.code}</b> · ` : esc(o.address) + " · "}${o.paid ? "Paid" : o.pay === "cod" ? "Cash on delivery" : "Pay at counter"} · <b style="color:var(--ink)">${o.total ? rupee(o.total) : "price at counter"}</b></div>
              <div class="qrow"><button class="btn auto" data-adv="${o.id}">${verb}</button></div>
            </div>`; }).join("") : '<p class="quiet small">No active orders.</p>'}
        </div>

        <div class="block"><div class="eyebrow"><span>People looked for — nobody had it</span><a class="link" href="#/biz/insights" style="font-size:10.5px">All</a></div>
          <div class="entries">${missed.slice(0, 3).map((m) => `<div class="entry"><div class="body"><div class="name">${esc(m.q)}</div><div class="note">${m.n} searches near you this week</div></div></div>`).join("")}</div>
        </div>

        <div class="block"><div class="tiles">
          <a href="#/biz/items"><span>${ic("box")}</span><b>Items</b><em>${s.items.length} listed · ${inStock} in stock</em></a>
          <a href="#/biz/items?scan=1"><span>${ic("camera")}</span><b>Scan a shelf</b><em>Add items from a photo</em></a>
        </div></div>
        <div class="pad" style="margin:30px 0 40px;text-align:center"><button class="link accent" id="leave">Stop managing this shop (demo)</button></div>`;
      $("#back").onclick = () => U.go("#/me");
      $$("[data-yes]").forEach((b) => b.onclick = () => {
        const p = +$(`[data-price="${b.dataset.yes}"]`).value || null;
        A.replyAsk(b.dataset.yes, s.id, { has: true, price: p }); U.toast("Sent — the customer can see you have it"); U.app.dataset.sig = ""; draw();
      });
      $$("[data-no]").forEach((b) => b.onclick = () => { A.replyAsk(b.dataset.no, s.id, { has: false }); U.app.dataset.sig = ""; draw(); });
      $$("[data-adv]").forEach((b) => b.onclick = () => { A.advanceOrder(b.dataset.adv); U.toast("Updated — the customer is notified"); U.app.dataset.sig = ""; draw(); });
      $$('.stats a[href^="#"]:not([href^="#/"])').forEach((a) => a.onclick = (e) => { e.preventDefault(); $(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); });
      $("#leave").onclick = () => { A.releaseShop(); U.go("#/me"); };
    };
    U.app.dataset.sig = "";
    draw();
    const iv = setInterval(draw, 2000);
    U.addCleanup(() => clearInterval(iv));
  }

  // ---------- items: stock switches, prices, catalogue, shelf scan ----------
  function itemsView(params) {
    const s = A.ownerShop();
    const setup = params.get("setup") === "1";
    const draw = () => {
      const listed = new Set(s.items.map((i) => A.slug(i.name)));
      const cat = A.catalogFor(s.cat);
      U.app.innerHTML = `
        <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><a class="link" href="#/shop/${s.id}">Preview</a></div>
        <div class="pad" style="margin-top:22px"><div class="eyebrow">${esc(s.name)}</div><h1 class="title" style="margin-top:8px">${setup ? "Tap what you sell" : "Your items"}</h1>
          <p class="quiet small" style="line-height:1.5">${setup ? "No typing — pick from the list. You can add prices later." : "Flip the switch when stock runs out. Customers see it instantly."}</p></div>
        ${setup ? `<div class="block"><div class="pick">${cat.map((c) => `<button class="pickc ${listed.has(A.slug(c.name)) ? "on" : ""}" data-pick="${esc(c.name)}">
            <span class="pimg sm" style="${U.catVars(s.cat)}">${c.img ? `<img src="${c.img}" alt="">` : U.art(s.cat, 36)}</span><span>${esc(c.name)}<em>${esc(c.brand)}</em></span></button>`).join("")}</div>
          <div class="pad" style="margin:24px 0 40px;padding:0"><a class="btn" href="#/biz">Done — open my dashboard</a></div></div>` : `
        <div class="pad" style="margin-top:18px;display:flex;gap:10px">
          <button class="btn line auto" id="scan" style="flex:1">${ic("camera")} Scan shelf</button>
          <button class="btn line auto" id="addcat" style="flex:1">+ From list</button>
        </div>
        <div class="block"><div class="entries">${s.items.map((it) => {
          const st = A.itemStatus(it);
          return `<div class="oitem">
            <span class="thumb" style="${U.catVars(it.cat)}">${U.pimg(it)}</span>
            <div class="body"><div class="name">${esc(it.name)}</div><div class="note">${esc(it.brand)}</div>
              <label class="pricein">₹<input inputmode="numeric" value="${it.price || ""}" placeholder="price" data-price="${it.id}"></label></div>
            <label class="switch"><input type="checkbox" data-stock="${it.id}" ${st.key === "confirmed" ? "checked" : ""}><i></i><span>${st.key === "confirmed" ? "In stock" : st.key === "out" ? "Out" : "Not sure"}</span></label>
          </div>`; }).join("") || '<p class="quiet">No items yet.</p>'}</div>
          <p class="faint tiny" style="margin:16px 0 40px">“Not sure” means listed but not confirmed this week — customers are told to ask first.</p></div>`}`;
      $("#back").onclick = () => U.go("#/biz");
      $$("[data-pick]").forEach((b) => b.onclick = () => {
        const c = cat.find((x) => x.name === b.dataset.pick);
        if (b.classList.contains("on")) {
          const it = s.items.find((i) => i.name === c.name); if (it) A.setItem(s.id, it.id, { removed: true });
        } else A.addItem(s.id, c.tmpl, s.cat);
        b.classList.toggle("on");
      });
      $$("[data-stock]").forEach((c) => c.onchange = () => { A.setItem(s.id, c.dataset.stock, { inStock: c.checked }); draw(); });
      $$("[data-price]").forEach((inp) => inp.onchange = () => { const v = +inp.value; if (v > 0) { A.setItem(s.id, inp.dataset.price, { price: v }); U.toast("Price updated"); } });
      $("#addcat") && ($("#addcat").onclick = () => U.go("#/biz/items?setup=1"));
      $("#scan") && ($("#scan").onclick = scanShelf);
    };
    // Shelf scan: SIMULATED. Live version sends the photo to a vision model that
    // reads brands/labels and matches them to the master catalogue.
    function scanShelf() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*"; inp.capture = "environment";
      inp.onchange = () => {
        if (!inp.files.length) return;
        U.openSheet(`<div class="eyebrow">Shelf scan</div><div class="title">Reading your shelf<span class="typing"></span></div><p class="quiet small">Looking for brands and labels…</p>`);
        setTimeout(() => {
          const listed = new Set(s.items.map((i) => A.slug(i.name)));
          const found = A.catalogFor(s.cat).filter((c) => !listed.has(A.slug(c.name))).sort(() => Math.random() - 0.5).slice(0, 4);
          U.openSheet(`<div class="eyebrow">Shelf scan · demo</div><div class="title">Found ${found.length} items</div>
            <p class="quiet small">Untick anything that's wrong.</p>
            <div class="entries">${found.map((c, i) => `<label class="entry"><input type="checkbox" checked data-f="${i}" style="accent-color:var(--teal);width:20px;height:20px"><div class="body"><div class="name">${esc(c.name)}</div><div class="note">${esc(c.brand)}</div></div></label>`).join("")}</div>
            <div class="opts"><button class="btn" id="addf">Add to my shop</button></div>`, (el) => {
            $("#addf", el).onclick = () => {
              $$("[data-f]", el).forEach((cb) => { if (cb.checked) A.addItem(s.id, found[+cb.dataset.f].tmpl, s.cat); });
              U.closeSheet(); U.toast("Added — marked in stock"); draw();
            };
          });
        }, 1800);
      };
      inp.click();
    }
    draw();
    if (params.get("scan") === "1") setTimeout(() => $("#scan")?.click(), 100);
  }

  // ---------- insights ----------
  function insightsView() {
    const s = A.ownerShop();
    const missed = A.missedSales(s);
    const log = A.store.get("searchLog", []).filter((l) => l.cats.some((c) => s.cats.includes(c)));
    const top = {}; for (const l of log) top[l.q] = (top[l.q] || 0) + 1;
    const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = Math.max(...missed.map((m) => m.n), 1);
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px"><div class="eyebrow">Insights · last 7 days</div><h1 class="title" style="margin-top:8px">What to stock next</h1>
        <p class="quiet small" style="line-height:1.5">People near your shop searched for these and found <b>no shop</b> that had them in stock.</p></div>
      <div class="block"><div class="bars">${missed.map((m) => `<div class="bar">
        <div class="bl"><b>${esc(m.q)}</b><span>${m.n} searches${m.real ? "" : " · demo"}</span></div>
        <div class="bt"><i style="width:${(m.n / max) * 100}%"></i></div>
        ${m.tmpl && !s.items.find((i) => i.name === m.tmpl[0]) ? `<button class="link" data-add="${esc(m.tmpl[0])}">I stock this</button>` : ""}
      </div>`).join("")}</div></div>
      ${topList.length ? `<div class="block"><div class="eyebrow"><span>Searched in your category</span></div><div class="words">${topList.map(([q, n]) => `<span class="word">${esc(q)} · ${n}</span>`).join("")}</div></div>` : ""}
      <p class="pad faint tiny" style="margin:28px 0 40px;line-height:1.6">Figures marked “demo” are sample demand so a new shop sees a full report. Real searches made in this app are counted too.</p>`;
    $("#back").onclick = () => U.go("#/biz");
    $$("[data-add]").forEach((b) => b.onclick = () => {
      const t = A.D.CATALOG[s.cat].find(([n]) => n === b.dataset.add);
      A.addItem(s.id, t, s.cat); U.toast("Added to your items — in stock"); insightsView();
    });
  }

  U.ROUTES.biz = biz;
})();
