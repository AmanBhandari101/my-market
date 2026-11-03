// My Market — shop-owner side ("My Market for Business").
// Rule: every owner action is a tap, never a form to type into, except the one-time setup.
// In production this side also runs over WhatsApp; here it is the same flows in the app.
(function () {
  const U = window.MM_UI, A = U.A, C = U.C, { $, $$, esc, ic, rupee } = U;
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
  const fmtH = (h) => (h % 12 || 12) + (h < 12 ? " am" : " pm");

  function biz(parts, params) {
    const sub = parts[1];
    if (sub === "new") return newShopView();
    if (!A.ownerShop()) return onboardView();
    if (sub === "items") return itemsView(params);
    if (sub === "stockin") return stockInView();
    if (sub === "reports") return reportsView(params);
    if (sub === "inbox") return dashView();
    if (sub === "bill" && parts[2]) return receiptView(parts[2]);
    if (sub === "bills") return billsView();
    if (sub === "insights") return insightsView();
    return billView(); // home = the billing counter
  }

  // ---------- onboarding ----------
  function onboardView() {
    U.app.innerHTML = `
      <div class="band">
        <div class="topline"><span class="brand"><img src="icon-business.svg" alt="">My Market<small style="color:#5fd08a">Business</small></span></div>
        <div class="pad" style="margin-top:30px">
          <h1 class="display">Customers are already<br><em>looking for you.</em></h1>
          <p class="quiet" style="line-height:1.55;margin:14px 0 0">List your shop free. People nearby see what you stock, ask you questions on WhatsApp, and reserve before they walk in.</p>
        </div>
      </div>
      <div class="block" id="login"><div class="eyebrow"><span>Log in to your shop</span></div>
        <form class="form" id="lf" style="margin-top:0">
          <label>Mobile number<input class="field" name="phone" inputmode="tel" autocomplete="username" placeholder="98765 43210" required></label>
          <label>6-digit PIN<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" placeholder="••••••" required></label>
          <p class="small" id="lerr" style="color:var(--out);margin:0;min-height:1em"></p>
          <button class="btn" type="submit">Log in</button>
        </form></div>
      <div class="pad" style="margin:26px 0 14px;display:grid;gap:10px;justify-items:center">
        <span class="quiet small">New to My Market?</span>
        <a class="btn line" href="#/biz/new">Register your shop</a>
      </div>
      <p class="pad faint tiny" style="text-align:center;margin-bottom:8px">Free · takes about 5 minutes · your mobile number and 6-digit PIN become your login</p>
      <div class="block"><div class="perks">
        <div><span>${ic("chat")}</span><b>Customer questions</b><p>“Do you have a 1 inch elbow?” — answer with one tap.</p></div>
        <div><span>${ic("chart")}</span><b>Missed sales report</b><p>What people searched for near you that nobody had.</p></div>
        <div><span>${ic("box")}</span><b>Orders & reservations</b><p>Pickup, delivery, or “keep it for me” — paid at your counter.</p></div>
        <div><span>${ic("camera")}</span><b>No typing</b><p>Photograph a shelf; we build your item list.</p></div>
      </div></div>
      <div style="height:40px"></div>`;
    $("#lf").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Logging in…";
      const r = await A.login(f.phone, f.pin);
      btn.disabled = false; btn.textContent = "Log in";
      if (!r.ok) { $("#lerr").textContent = r.why; return; }
      if (r.reload) { location.hash = "#/biz"; location.reload(); return; }
      U.toast("Welcome back"); U.go("#/biz");
    };
    $$("#lf input").forEach((i) => i.addEventListener("input", () => { $("#lerr").textContent = ""; }));
  }

  function newShopView() {
    const loc = U.loc();
    let cat = "hardware";
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">About 2 minutes</span></div>
      <div class="pad" style="margin-top:22px"><div class="eyebrow">Add your shop</div><h1 class="title" style="margin-top:8px">Tell customers where you are.</h1></div>
      <form id="f" class="pad form">
        <label>Shop name<input class="field" name="name" required placeholder="e.g. Sharma Hardware"></label>
        <label>Your name<input class="field" name="owner" required placeholder="e.g. Ramesh Sharma"></label>
        <label>Mobile number <span class="faint tiny">— your login, and the shop's WhatsApp for bills</span><input class="field" name="phone" inputmode="tel" autocomplete="username" required placeholder="98765 43210"></label>
        <div class="two"><label>Create a 6-digit PIN<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required placeholder="••••••"></label>
          <label>Repeat PIN<input class="field" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required></label></div>
        <label>What do you sell?</label>
        <div class="words" id="cats">${Object.entries(C).map(([k, c]) => `<button type="button" class="word ${k === cat ? "on" : ""}" data-cat="${k}" style="${U.catVars(k)}">${esc(c.name)}</button>`).join("")}</div>
        <label>Market or area<input class="field" name="area" placeholder="e.g. Beadonpura Bazaar"></label>
        <div class="two"><label>Shop no.<input class="field" name="shopNo" placeholder="B-12"></label>
          <label>Floor<select class="field" name="floor"><option>Ground floor</option><option>1st floor</option><option>Basement</option></select></label></div>
        <label>Landmark<input class="field" name="landmark" placeholder="e.g. Next to the Shiv temple, lane 2"></label>
        <div class="two"><label>Opens<select class="field" name="open">${HOURS.map((h) => `<option value="${h}" ${h === 10 ? "selected" : ""}>${fmtH(h)}</option>`).join("")}</select></label>
          <label>Closes<select class="field" name="close">${HOURS.map((h) => `<option value="${h}" ${h === 20 ? "selected" : ""}>${fmtH(h)}</option>`).join("")}</select></label></div>
        <label>Message on your bills <span class="faint tiny">— a small advert, optional</span><input class="field" name="promo" maxlength="90" placeholder="e.g. Free screen-guard fitting with every cover"></label>
        <label>GSTIN <span class="faint tiny">— optional</span><input class="field" name="gst" maxlength="15" placeholder="07ABCDE1234F1Z5" style="text-transform:uppercase"></label>
        <label>Weekly holiday<select class="field" name="closedDay"><option>None</option>${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => `<option>${d}</option>`).join("")}</select></label>
        <label>Shop location <span class="faint tiny">— stand in your shop and tap the button, or drag the pin</span></label>
        <button type="button" class="btn line auto" id="atshop" style="margin-bottom:10px">${ic("locate")} I'm at my shop</button>
        <div class="map" id="pinmap" style="margin:0;height:220px"></div>
        <p class="small quiet" id="mhint" style="margin-top:8px;line-height:1.5"></p>
        <button class="btn" type="submit" style="margin-top:22px">Create my shop</button>
        <p class="small" id="ferr" style="color:var(--out);text-align:center;margin:10px 0 0;min-height:1em"></p>
        <p class="faint tiny" style="text-align:center;margin:6px 0 40px">${window.MM_CLOUD ? "Your shop is saved on the My Market server — log in from any phone with your number and PIN. Needs internet to register." : "Demo — your shop and login are saved on this device only."}</p>
      </form>`;
    $("#back").onclick = () => history.back();
    $$("#cats [data-cat]").forEach((b) => b.onclick = () => { cat = b.dataset.cat; $$("#cats .word").forEach((x) => x.classList.toggle("on", x === b)); });
    const map = U.newMap("pinmap");
    map.setView([loc.lat, loc.lng], 17);
    const pin = L.marker([loc.lat, loc.lng], { draggable: true, icon: U.dotIcon("best") }).addTo(map);
    // Tell the owner which market the pin falls in (or that it starts a new area).
    const hint = () => {
      const p = pin.getLatLng(), m = A.marketFor({ lat: p.lat, lng: p.lng });
      $("#mhint").innerHTML = m ? `Your shop will be listed in <b>${esc(m.name)}</b>${m.pincode ? `, ${esc(m.locality || "")} ${esc(m.pincode)}` : ""}.`
        : "No market here yet — your shop starts a new area. It shows as a market once 3 shops nearby join; customers nearby see your shop right away.";
    };
    pin.on("dragend", hint); hint();
    window.addEventListener("mm-markets", () => $("#mhint") && hint(), { once: true });
    $("#atshop").onclick = () => {
      if (!navigator.geolocation) return U.toast("Location isn't available here");
      U.toast("Finding your shop…");
      navigator.geolocation.getCurrentPosition((p) => {
        const ll = [p.coords.latitude, p.coords.longitude];
        pin.setLatLng(ll); map.setView(ll, 18); hint();
      }, () => U.toast("Couldn't get your location — drag the pin instead"), { enableHighAccuracy: true, timeout: 12000 });
    };
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const err = (m) => { $("#ferr").textContent = m; e.submitter && (e.submitter.disabled = false, e.submitter.textContent = "Create my shop"); };
      if (!f.name.trim()) return err("Enter your shop's name");
      if (A.normPhone(f.phone).length !== 10) return err("Enter a 10-digit mobile number");
      if (!/^\d{6}$/.test(f.pin)) return err("PIN must be exactly 6 digits");
      if (f.pin !== f.pin2) return err("The two PINs don't match");
      const p = pin.getLatLng();
      e.submitter && (e.submitter.disabled = true, e.submitter.textContent = "Creating your shop…");
      // pincode + locality for the address; give up after 4 s (works offline too)
      const addr = await Promise.race([U.reverseName(p.lat, p.lng), new Promise((r) => setTimeout(() => r({}), 4000))]);
      let shop;
      try {
        shop = await A.registerShop({ ...f, name: f.name.trim(), owner: f.owner.trim(), promo: f.promo.trim(), gst: f.gst.trim().toUpperCase(), cat }, { lat: p.lat, lng: p.lng }, addr, { phone: f.phone, pin: f.pin });
      } catch (x) { return err(x.message); }
      U.toast(shop.needsCheck ? "Shop registered — we'll double-check the pin" : "Shop registered — you're logged in");
      U.go("#/biz/items?setup=1");
    };
  }

  // ---------- shop-app top bar ----------
  const waiting = (s) => A.pendingAsks(s.id).length + A.ordersFor(s.id).filter((o) => !o.cancelled && o.step < A.STEPS[o.mode].length - 1).length;
  function bizTop(title) {
    const s = A.ownerShop(), n = waiting(s);
    return `<div class="topline"><span class="brand"><img src="icon-business.svg" alt=""><span class="bt">${esc(title || s.name)}${s.cloud ? `<em class="syncst" data-sync>${syncWord()}</em>` : ""}</span></span>
      <div class="btn-row" style="gap:2px"><a class="iconbtn bagbtn" href="#/biz/inbox" aria-label="Orders and questions">${ic("bell")}<i class="bcount ${n ? "" : "hidden"}">${n}</i></a>
      <button class="iconbtn" data-menu aria-label="Menu">${ic("menu")}</button></div></div>`;
  }
  function bindTop() { $$("[data-menu]").forEach((b) => b.onclick = menuSheet); }
  // "Saved" / "Saving 3…" / "Offline · 3 waiting" / "2 not saved"
  function syncWord(d) {
    const c = window.MM_CLOUD; if (!c) return "";
    d = d || { pending: c.pending(), failed: c.failedOps().length, online: navigator.onLine };
    if (d.failed) return `<b class="bad">${d.failed} not saved</b>`;
    if (!d.online && d.pending) return `<b class="warn">Offline · ${d.pending} waiting</b>`;
    if (!d.online) return "Offline";
    if (d.pending) return `Saving ${d.pending}…`;
    return "✓ Saved";
  }
  window.addEventListener("mm-sync", (e) => $$("[data-sync]").forEach((el) => { el.innerHTML = syncWord(e.detail); }));
  function menuSheet() {
    const s = A.ownerShop();
    U.openSheet(`<div class="eyebrow">${esc(C[s.cat].name)}</div><div class="title">${esc(s.name)}</div>
      <p class="small quiet">${esc(s.phone || "")}${s.pincode ? ` · ${esc(s.locality || "")} ${esc(s.pincode)}` : ""}</p>
      <div class="entries" style="margin-top:12px">
        <a class="entry" href="#/biz/inbox"><div class="body"><div class="name">Orders and questions</div><div class="note">${waiting(s)} waiting</div></div>${ic("arrow")}</a>
        ${s.cloud ? `<button class="entry" id="m-sync"><div class="body"><div class="name">Sync now</div><div class="note">Send this phone's changes and get your other phones' — ${window.MM_CLOUD.pending()} waiting</div></div>${ic("arrow")}</button>` : ""}
        <button class="entry" id="m-bs"><div class="body"><div class="name">Bill settings</div><div class="note">Advert, phone and GSTIN on your bills</div></div>${ic("arrow")}</button>
        <a class="entry" href="index.html#/shop/${s.id}" target="_blank" rel="noopener"><div class="body"><div class="name">See my shop as customers do</div><div class="note">Opens the My Market customer app</div></div>${ic("arrow")}</a>
        <a class="entry" href="#/biz/insights"><div class="body"><div class="name">What people searched for</div><div class="note">Items nobody near you had</div></div>${ic("arrow")}</a>
      </div>
      <div class="opts"><button class="link accent" id="m-out">Log out</button></div>`, (el) => {
      $("#m-bs", el).onclick = () => billSettings(s);
      $("#m-sync", el) && ($("#m-sync", el).onclick = async () => {
        U.closeSheet(); U.toast("Syncing…");
        const st = await window.MM_CLOUD.flush();
        if (st.pending) return U.toast("No internet — your changes are kept and will send later");
        try { await window.MM_CLOUD.pullShop(); location.reload(); } catch (x) { U.toast(x.message); }
      });
      $("#m-out", el).onclick = () => { A.releaseShop(); U.closeSheet(); U.toast("Logged out"); U.go("#/biz"); };
      $$("a.entry", el).forEach((a) => a.addEventListener("click", () => U.closeSheet()));
    });
  }

  // ---------- orders & customer questions (the bell) ----------
  function dashView() {
    const draw = () => {
      const s = A.ownerShop();
      const asks = A.pendingAsks(s.id);
      const orders = A.ordersFor(s.id).filter((o) => !o.cancelled && o.step < A.STEPS[o.mode].length - 1);
      const missed = A.missedSales(s);
      const views = (A.store.get("views", {})[s.id] || 0) + 40 + Math.floor((s.id.length * 7) % 60);
      const inStock = s.items.filter((i) => A.itemStatus(i).key === "confirmed").length;
      const inv = A.inventory(s);
      const today = A.daySummary(s.id);
      const sig = JSON.stringify([asks.map((a) => a.id), orders.map((o) => o.id + o.step)]);
      if (U.app.dataset.sig === sig && $("#dash")) return;
      U.app.dataset.sig = sig;
      U.app.innerHTML = `
        <div id="dash">${bizTop("Orders and questions")}</div>
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

        <div style="height:30px"></div>`;
      bindTop();
      $$("[data-yes]").forEach((b) => b.onclick = () => {
        const p = +$(`[data-price="${b.dataset.yes}"]`).value || null;
        A.replyAsk(b.dataset.yes, s.id, { has: true, price: p }); U.toast("Sent — the customer can see you have it"); U.app.dataset.sig = ""; draw();
      });
      $$("[data-no]").forEach((b) => b.onclick = () => { A.replyAsk(b.dataset.no, s.id, { has: false }); U.app.dataset.sig = ""; draw(); });
      $$("[data-adv]").forEach((b) => b.onclick = () => { A.advanceOrder(b.dataset.adv); U.toast("Updated — the customer is notified"); U.app.dataset.sig = ""; draw(); });
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
    const FILTERS = { all: "All", low: "Running low", out: "Out", uncounted: "Not counted" };
    let filter = FILTERS[params.get("f")] ? params.get("f") : "all", find = "";

    // One item: count, stock in/out with a reason, prices, alert level, history.
    function itemSheet(it) {
      if (!it) return;
      const st = A.itemStatus(it);
      const log = A.stockLog(it.id).slice(0, 6);
      const when = (t) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
      U.openSheet(`
        <div class="eyebrow">${esc(it.brand)}</div><div class="title">${esc(it.name)}</div>
        <p class="small quiet" style="margin-top:6px"><span class="dot ${st.key}"></span>Customers see: <b>${esc(U.stWord(st))}</b>${it.price ? ` at ${rupee(it.price)}` : ""}</p>
        <div class="form" style="margin-top:14px">
          <label>${it.qty != null ? `In stock now: <b style="color:var(--ink);font-size:18px">${it.qty}</b>` : "Not counted yet — how many do you have?"}</label>
          <div class="two"><input class="field" id="n" inputmode="numeric" placeholder="Quantity" value="${it.qty == null ? "" : ""}">
            <button class="btn auto" id="setn" type="button">Set count</button></div>
          ${it.qty != null ? `<div class="words" style="margin-top:10px">
            <button class="word" data-mv="received">+ Stock arrived</button><button class="word" data-mv="returned">+ Returned</button>
            <button class="word" data-mv="sold">− Sold</button><button class="word" data-mv="damaged">− Damaged</button>
            <button class="word" data-mv="out">Mark out</button></div>
            <p class="faint tiny" style="margin-top:6px">Type a quantity first (default 1).</p>` : ""}
          <div class="two" style="margin-top:16px"><label>Selling price ₹<input class="field" id="pr" inputmode="numeric" value="${it.price || ""}"></label>
            <label>Your cost ₹ <span class="faint tiny">(private)</span><input class="field" id="co" inputmode="numeric" value="${it.cost || ""}"></label></div>
          <label>Warn me at <span class="faint tiny">(“few left” at or below)</span><input class="field" id="ro" inputmode="numeric" value="${A.lowAt(it)}"></label>
          ${it.price && it.cost ? `<p class="small quiet">Margin ${rupee(it.price - it.cost)} per piece (${Math.round((1 - it.cost / it.price) * 100)}%)</p>` : ""}
          <button class="btn" id="savep" type="button" style="margin-top:6px">Save prices</button>
        </div>
        ${log.length ? `<div class="eyebrow" style="margin-top:20px">History</div><div class="entries">${log.map((e) => `<div class="entry"><div class="body"><div class="name">${esc(A.REASONS[e.reason] || e.reason)}</div><div class="note">${when(e.at)}</div></div><div class="aside"><b>${e.set != null ? "= " + e.set : (e.delta > 0 ? "+" : "") + e.delta}</b></div></div>`).join("")}</div>` : ""}
        <div class="opts"><button class="btn line" id="dets" type="button">Product details${it.productId ? " ✓" : ""}</button><button class="link accent" id="rm" type="button">Remove item from my shop</button></div>`, (el) => {
        const n = () => Math.max(0, Math.round(+$("#n", el).value || 0));
        const done = (msg) => { U.toast(msg); U.closeSheet(); draw(); };
        $("#setn", el).onclick = () => { if ($("#n", el).value === "") return U.toast("Type how many you have"); A.moveStock(s.id, it.id, { set: n(), reason: "count" }); done("Count saved"); };
        $$("[data-mv]", el).forEach((b) => b.onclick = () => {
          const r = b.dataset.mv, k = n() || 1;
          if (r === "out") A.moveStock(s.id, it.id, { set: 0, reason: "out" });
          else A.moveStock(s.id, it.id, { delta: r === "received" || r === "returned" ? k : -k, reason: r });
          done(A.REASONS[r]);
        });
        $("#savep", el).onclick = () => {
          const patch = {}, pr = +$("#pr", el).value, co = +$("#co", el).value, ro = +$("#ro", el).value;
          if (pr > 0) patch.price = pr; if (co > 0) patch.cost = co; if (ro >= 0 && $("#ro", el).value !== "") patch.reorderAt = Math.round(ro);
          A.setItem(s.id, it.id, patch);
          if (patch.cost != null) it.cost = patch.cost; if (patch.reorderAt != null) it.reorderAt = patch.reorderAt;
          done("Saved");
        };
        $("#rm", el).onclick = () => { A.setItem(s.id, it.id, { removed: true }); done("Removed"); };
        $("#dets", el).onclick = () => detailsSheet(s, it, draw);
      });
    }

    const draw = () => {
      const listed = new Set(s.items.map((i) => A.slug(i.name)));
      const inv = A.inventory(s);
      const q = find.trim().toLowerCase();
      const rows = s.items.filter((it) => {
        if (q && !`${it.name} ${it.brand}`.toLowerCase().includes(q)) return false;
        if (filter === "low") return it.qty != null && it.qty > 0 && it.qty <= A.lowAt(it);
        if (filter === "out") return it.qty === 0;
        if (filter === "uncounted") return it.qty == null;
        return true;
      });
      const cat = A.catalogFor(s.cat);
      U.app.innerHTML = `
        ${bizTop(setup ? "Your items" : "Stock")}
        ${setup ? `<div class="pad" style="margin-top:18px"><h1 class="title">Tap what you sell</h1>
          <p class="quiet small" style="line-height:1.5">No typing — pick from the list. You can add prices later.</p></div>` : ""}
        ${setup ? `<div class="block"><div class="pick">${cat.map((c) => `<button class="pickc ${listed.has(A.slug(c.name)) ? "on" : ""}" data-pick="${esc(c.name)}">
            <span class="pimg sm" style="${U.catVars(s.cat)}">${c.img ? `<img src="${c.img}" alt="">` : U.art(s.cat, 36)}</span><span>${esc(c.name)}<em>${esc(c.brand)}</em></span></button>`).join("")}</div>
          <div class="pad" style="margin:24px 0 40px;padding:0"><a class="btn" href="#/biz">Done — start billing</a></div></div>` : `
        <div class="addstock">
          <a class="as-main" href="#/biz/stockin">${ic("truck")}<b>Stock arrived</b><span>Add quantities from a supplier</span></a>
          <button class="as-main" id="newit">${ic("camera")}<b>New item</b><span>Photo, name, price, quantity</span></button>
        </div>
        <div class="stats">
          <div><b>${inv.units}</b><span>units counted</span></div>
          <div><b>${rupee(inv.value)}</b><span>stock value at cost</span></div>
          <button data-f="low" class="${inv.low.length ? "hot" : ""}"><b>${inv.low.length}</b><span>running low</span></button>
          <button data-f="out" class="${inv.out.length ? "hot" : ""}"><b>${inv.out.length}</b><span>out of stock</span></button>
        </div>
        <div class="pad" style="margin-top:12px;display:flex;gap:10px">
          <button class="btn line auto" id="addcat" style="flex:1;height:40px;font-size:13.5px">+ Pick from list</button>
        </div>
        <div class="block">
          <div class="words" id="filt">${Object.entries(FILTERS).map(([k, l]) => `<button class="word ${filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
          <div class="inshop" style="margin-top:12px">${ic("search")}<input id="sfind" placeholder="Find an item" autocomplete="off" value="${esc(find)}"></div>
          <div class="entries">${rows.map((it) => {
          const st = A.itemStatus(it);
          const counted = it.qty != null;
          const low = counted && it.qty > 0 && it.qty <= A.lowAt(it);
          return `<div class="oitem">
            <span class="thumb" style="${U.catVars(it.cat)}">${U.pimg(it)}</span>
            <button class="body" data-open="${it.id}" style="text-align:left"><div class="name">${esc(it.name)}</div>
              <div class="note">${esc(it.brand)} · ${it.price ? rupee(it.price) : "no price"}${it.cost ? ` · cost ${rupee(it.cost)}` : ""}</div>
              <div class="note"><span class="dot ${st.key}"></span>Customers see: ${esc(U.stWord(st))}</div></button>
            ${counted ? `<div class="stepper ${it.qty === 0 ? "out" : low ? "low" : ""}"><button data-sell="${it.id}" aria-label="Sold one" ${it.qty === 0 ? "disabled" : ""}>−</button><b>${it.qty}</b><button data-recv="${it.id}" aria-label="One more arrived">+</button></div>`
              : `<button class="btn line auto" data-open="${it.id}" style="padding:8px 12px">Count</button>`}
          </div>`; }).join("") || `<p class="quiet small" style="margin-top:14px">${s.items.length ? "Nothing here." : "No items yet."}</p>`}</div>
          <p class="faint tiny" style="margin:16px 0 40px;line-height:1.6">“Count” starts tracking an item. Items you don't count yet still show as “Ask to confirm” to customers. Few left = at or below the alert level you set (default 3).</p></div>`}`;
      bindTop();
      $("#newit") && ($("#newit").onclick = () => newItemSheet(s, draw));
      $$("[data-pick]").forEach((b) => b.onclick = () => {
        const c = cat.find((x) => x.name === b.dataset.pick);
        if (b.classList.contains("on")) {
          const it = s.items.find((i) => i.name === c.name); if (it) A.setItem(s.id, it.id, { removed: true });
        } else A.addItem(s.id, c.tmpl, s.cat);
        b.classList.toggle("on");
      });
      $$("[data-f]").forEach((b) => b.onclick = () => { filter = filter === b.dataset.f && b.dataset.f !== "all" ? "all" : b.dataset.f; draw(); });
      $("#sfind") && $("#sfind").addEventListener("input", (e) => { find = e.target.value; const pos = e.target.selectionStart; draw(); const f = $("#sfind"); f.focus(); f.setSelectionRange(pos, pos); });
      $$("[data-sell]").forEach((b) => b.onclick = () => { A.moveStock(s.id, b.dataset.sell, { delta: -1, reason: "sold" }); draw(); });
      $$("[data-recv]").forEach((b) => b.onclick = () => { A.moveStock(s.id, b.dataset.recv, { delta: 1, reason: "received" }); draw(); });
      $$("[data-open]").forEach((b) => b.onclick = () => itemSheet(s.items.find((x) => x.id === b.dataset.open)));
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

  // ---------- billing: tap items, set quantity, the app does the maths ----------
  const PAYS = { cash: "Cash", upi: "UPI", card: "Card", khata: "Khata (pay later)" };
  function billView() {
    const s = A.ownerShop();
    // The bill in progress survives leaving the screen (kept on this device).
    let cart = A.store.get("billDraft:" + s.id, { lines: [], discount: 0, pay: "cash", phone: "", received: "" });
    const keep = () => A.store.set("billDraft:" + s.id, cart);
    let q = "";
    // most-sold items first, then the ones in stock
    const sold = {}; for (const b of A.billsFor(s.id)) for (const l of b.lines) if (l.itemId) sold[l.itemId] = (sold[l.itemId] || 0) + l.qty;
    const order = () => [...s.items].sort((a, b) => (sold[b.id] || 0) - (sold[a.id] || 0) || ((b.qty ?? 1) > 0) - ((a.qty ?? 1) > 0) || a.name.localeCompare(b.name));
    const lineOf = (id) => cart.lines.find((l) => l.itemId === id);
    const totals = () => A.billTotals(cart.lines, cart.discount);

    function add(it, n = 1) {
      if (!it.price) return askPrice(it);
      const l = lineOf(it.id);
      if (l) l.qty += n; else cart.lines.push({ itemId: it.id, name: it.name, brand: it.brand, qty: n, price: it.price, cost: it.cost ?? null });
      cart.lines = cart.lines.filter((x) => x.qty > 0); keep(); paint();
    }
    function askPrice(it) {
      U.openSheet(`<div class="eyebrow">${esc(it.brand)}</div><div class="title">${esc(it.name)}</div>
        <div class="form"><label>Price ₹<input class="field" id="pp" inputmode="numeric" autofocus></label>
        <label style="display:flex;gap:8px;align-items:center;text-transform:none"><input type="checkbox" id="psave" checked> Save as this item's price</label>
        <button class="btn" id="pok" type="button">Add to bill</button></div>`, (el) => {
        setTimeout(() => $("#pp", el).focus(), 50);
        $("#pok", el).onclick = () => {
          const v = Math.round(+$("#pp", el).value); if (!(v > 0)) return U.toast("Type the price");
          if ($("#psave", el).checked) A.setItem(s.id, it.id, { price: v }); else it.price = v;
          it.price = v; U.closeSheet(); add(it);
        };
      });
    }
    function otherItem() {
      U.openSheet(`<div class="eyebrow">Not in your list</div><div class="title">Add an amount</div>
        <div class="form"><label>What is it? <span class="faint tiny">(optional)</span><input class="field" id="on" placeholder="e.g. Repair charge"></label>
        <div class="two"><label>Price ₹<input class="field" id="op" inputmode="numeric"></label><label>Quantity<input class="field" id="oq" inputmode="numeric" value="1"></label></div>
        <button class="btn" id="ook" type="button">Add to bill</button></div>`, (el) => {
        setTimeout(() => $("#op", el).focus(), 50);
        $("#ook", el).onclick = () => {
          const p = Math.round(+$("#op", el).value), n = Math.max(1, Math.round(+$("#oq", el).value || 1));
          if (!(p > 0)) return U.toast("Type the price");
          cart.lines.push({ itemId: null, key: "x" + Date.now(), name: $("#on", el).value.trim() || "Other item", qty: n, price: p, cost: null });
          keep(); U.closeSheet(); paint();
        };
      });
    }

    function paint() {
      const t = totals();
      const list = order().filter((it) => !q || `${it.name} ${it.brand}`.toLowerCase().includes(q));
      $("#bgrid").innerHTML = list.map((it) => {
        const l = lineOf(it.id), n = l ? l.qty : 0;
        const left = it.qty == null ? "" : it.qty - n <= 0 ? `<span class="bst out">${it.qty === 0 ? "Out of stock" : "Last one"}</span>` : `<span class="bst">${it.qty - n} left</span>`;
        return `<div class="btile ${n ? "on" : ""}" data-it="${it.id}">
          <span class="bimg" style="${U.catVars(it.cat)}">${U.pimg(it)}</span>
          <span class="bname">${esc(it.name)}</span>
          <span class="bprice">${it.price ? rupee(it.price) : '<span class="faint">set price</span>'}</span>${left}
          ${n ? `<span class="bstep"><button data-dec="${it.id}" aria-label="One less">−</button><b>${n}</b><button data-inc="${it.id}" aria-label="One more">+</button></span>` : ""}
        </div>`;
      }).join("") || '<p class="quiet small">No item matches. Use “Item not in list”.</p>';
      $("#bsum").innerHTML = t.units ? `<span><b>${rupee(t.total)}</b><em>${t.units} item${t.units > 1 ? "s" : ""}${t.discount ? ` · ${rupee(t.discount)} off` : ""}</em></span>` : '<span class="quiet">Tap items to add them</span>';
      $("#bgo").classList.toggle("hidden", !t.units);
      $$("[data-it]").forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-dec],[data-inc]")) return; add(s.items.find((x) => x.id === el.dataset.it)); });
      $$("[data-inc]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.inc)));
      $$("[data-dec]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.dec), -1));
    }

    // Review: quantities, prices, discount, payment, then Generate bill.
    function review() {
      const draw = (el) => {
        const t = totals();
        const change = cart.pay === "cash" && +cart.received > t.total ? +cart.received - t.total : 0;
        el.innerHTML = `
          <div class="eyebrow">Bill · ${esc(s.name)}</div><div class="title">${rupee(t.total)}</div>
          <div class="entries">${cart.lines.map((l, i) => `<div class="bline">
            <div class="body"><div class="name">${esc(l.name)}</div><button class="link" data-price="${i}">${rupee(l.price)} each</button></div>
            <span class="stepper sm"><button data-m="${i}" aria-label="One less">−</button><span>${l.qty}</span><button data-p="${i}" aria-label="One more">+</button></span>
            <b class="bamt">${rupee(l.qty * l.price)}</b></div>`).join("")}</div>
          <table class="specs bill" style="margin-top:8px">
            <tr><th>Items</th><td>${rupee(t.sub)}</td></tr>
            <tr><th>Discount ₹</th><td><input class="field" id="disc" inputmode="numeric" value="${cart.discount || ""}" placeholder="0" style="width:96px;text-align:right;padding:6px 8px"></td></tr>
            <tr class="total"><th>Total</th><td>${rupee(t.total)}</td></tr></table>
          <div class="eyebrow" style="margin-top:16px">Paid by</div>
          <div class="words" style="margin-top:8px">${Object.entries(PAYS).map(([k, v]) => `<button class="word ${cart.pay === k ? "on" : ""}" data-pay="${k}">${v}</button>`).join("")}</div>
          ${cart.pay === "cash" ? `<div class="two" style="margin-top:12px;align-items:end"><label class="small quiet">Cash received ₹<input class="field" id="recv" inputmode="numeric" value="${cart.received || ""}" placeholder="${t.total}"></label>
            <div class="small" style="padding-bottom:12px">${change ? `Return <b style="font-size:18px">${rupee(change)}</b>` : ""}</div></div>` : ""}
          ${cart.pay === "upi" ? `<p class="small quiet" style="margin-top:10px">The customer pays ${rupee(t.total)} to your shop's UPI.</p>` : ""}
          ${cart.pay === "khata" ? `<p class="small quiet" style="margin-top:10px">Added to the customer's credit. Add their phone number so it goes in their khata.</p>` : ""}
          <label class="small quiet" style="display:block;margin-top:12px">Customer WhatsApp number <span class="faint">(optional)</span>
            <input class="field" id="ph" inputmode="tel" value="${esc(cart.phone)}" placeholder="98765 43210"></label>
          <p class="faint tiny" style="margin:4px 0 0">If you add a number, the bill PDF is sent to it as soon as you tap Generate.</p>
          <div class="opts" style="margin-top:18px"><button class="btn" id="gen" style="height:52px;font-size:16px">Generate bill · ${rupee(t.total)}</button>
            <button class="link accent" id="clearb">Clear this bill</button></div>`;
        const idx = (b, k) => +b.dataset[k];
        $$("[data-m]", el).forEach((b) => b.onclick = () => { cart.lines[idx(b, "m")].qty--; cart.lines = cart.lines.filter((l) => l.qty > 0); keep(); paint(); if (!cart.lines.length) return U.closeSheet(); draw(el); });
        $$("[data-p]", el).forEach((b) => b.onclick = () => { cart.lines[idx(b, "p")].qty++; keep(); paint(); draw(el); });
        $$("[data-price]", el).forEach((b) => b.onclick = () => {
          const l = cart.lines[idx(b, "price")]; const v = Math.round(+prompt(`Price for ${l.name} (₹)`, l.price));
          if (v > 0) { l.price = v; keep(); paint(); draw(el); }
        });
        $("#disc", el).onchange = (e) => { cart.discount = Math.max(0, Math.round(+e.target.value || 0)); keep(); paint(); draw(el); };
        $$("[data-pay]", el).forEach((b) => b.onclick = () => { cart.pay = b.dataset.pay; keep(); draw(el); });
        $("#recv", el) && ($("#recv", el).oninput = (e) => { cart.received = e.target.value; keep(); const c = +e.target.value - totals().total; e.target.closest(".two").lastElementChild.innerHTML = c > 0 ? `Return <b style="font-size:18px">${rupee(c)}</b>` : ""; });
        $("#ph", el).oninput = (e) => { cart.phone = e.target.value.replace(/[^\d+ ]/g, ""); keep(); };
        $("#clearb", el).onclick = () => { if (!confirm("Clear this bill?")) return; cart = { lines: [], discount: 0, pay: "cash", phone: "", received: "" }; keep(); U.closeSheet(); paint(); };
        $("#gen", el).onclick = () => {
          if (cart.pay === "khata" && cart.phone.replace(/\D/g, "").length < 10) return U.toast("Add the customer's phone number for khata");
          const b = A.saveBill(s.id, { lines: cart.lines, discount: cart.discount, pay: cart.pay, phone: cart.phone, received: +cart.received || null });
          A.store.del("billDraft:" + s.id);
          U.closeSheet(); U.go("#/biz/bill/" + b.id);
          if (A.normPhone(b.phone).length === 10) sendBill(b, s);
        };
      };
      U.openSheet("", draw);
    }

    U.app.innerHTML = `
      ${bizTop()}
      <div class="pad billhead"><b>New bill</b><span class="quiet small">Tap items · the app adds it up</span></div>
      <div class="pad"><div class="inshop">${ic("search")}<input id="bq" placeholder="Find an item" autocomplete="off"></div></div>
      <div class="bgrid" id="bgrid"></div>
      <div class="pad" style="margin:12px 0 0"><button class="btn line" id="other">+ Item not in list</button></div>
      ${s.items.length ? "" : '<div class="banner" style="margin:14px var(--gut) 0"><div class="serif">No items yet</div><p>Add your items on the Stock page first — then tap them here to bill.</p><a class="link accent" href="#/biz/items">Go to Stock</a></div>'}
      <div style="height:110px"></div>
      <div class="billbar"><div id="bsum"></div><button class="btn auto" id="bgo">Review bill</button></div>`;
    bindTop();
    $("#bq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $("#other").onclick = otherItem;
    $("#bgo").onclick = review;
    paint();
  }

  // Shop's bill details: the small advert and GSTIN printed on every bill.
  function billSettings(s) {
    U.openSheet(`<div class="eyebrow">On every bill</div><div class="title">Bill settings</div>
      <div class="form"><label>Advert / message <span class="faint tiny">(up to 90 letters)</span><input class="field" id="bp" maxlength="90" value="${esc(s.promo || "")}" placeholder="e.g. Free screen-guard fitting with every cover"></label>
      <label>Shop phone on the bill<input class="field" id="bph" value="${esc(s.phone || "")}"></label>
      <label>GSTIN <span class="faint tiny">(optional)</span><input class="field" id="bg" maxlength="15" value="${esc(s.gst || "")}" style="text-transform:uppercase"></label>
      <button class="btn" id="bsave" type="button">Save</button></div>`, (el) => {
      $("#bsave", el).onclick = () => { A.updateShop(s.id, { promo: $("#bp", el).value.trim(), phone: $("#bph", el).value.trim(), gst: $("#bg", el).value.trim().toUpperCase() }); U.closeSheet(); U.toast("Saved — shows on your next bill"); };
    });
  }

  // A4-wide receipt PDF, drawn as vectors (sharp on any phone). Standard PDF
  // fonts have no ₹ glyph, so amounts print as "Rs.".
  const rs = (n) => "Rs. " + Math.round(n).toLocaleString("en-IN");
  const billName = (b, s) => `${s.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-bill-${b.no}.pdf`;
  function makeBillPdf(b, s) {
    const { jsPDF } = window.jspdf;
    const m = A.getMarket(s.marketId);
    const W = 105, X = 8, R = W - 8;
    const doc0 = new jsPDF({ unit: "mm", format: [W, 200] });
    doc0.setFont("helvetica", "normal"); doc0.setFontSize(9.5);
    const wrapped = b.lines.map((l) => doc0.splitTextToSize(l.name, 46));
    const H = 124 + wrapped.reduce((a, w) => a + w.length * 4.2 + 3, 0) + (b.discount ? 5 : 0) + (b.received ? 10 : 0) + (s.promo ? 8 : 0);
    const doc = new jsPDF({ unit: "mm", format: [W, Math.max(150, H)], compress: true });
    const d = new Date(b.at);
    // header band
    doc.setFillColor(23, 35, 49); doc.rect(0, 0, W, 31, "F");
    doc.setFillColor(255, 164, 28); doc.rect(0, 31, W, 1.4, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(doc.splitTextToSize(s.name, R - X)[0], X, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor(214, 224, 233);
    const addr = [s.shopNo && s.shopNo !== "—" ? `Shop ${s.shopNo}` : "", s.floor && s.floor !== "Ground floor" ? s.floor : "", m?.name || "", [s.locality || m?.locality || "", s.pincode || m?.pincode || ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const al = doc.splitTextToSize(addr, R - X).slice(0, 2);
    doc.text(al, X, 17);
    doc.text([s.phone ? `Ph / WhatsApp: ${s.phone}` : "", s.gst ? `GSTIN: ${s.gst}` : ""].filter(Boolean).join("   "), X, 17 + al.length * 3.6 + 2);
    // bill meta
    let y = 41;
    doc.setTextColor(15, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("BILL", X, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(86, 89, 89);
    doc.text(`No. ${b.no}`, X + 12, y);
    doc.text(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + "  " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), R, y, { align: "right" });
    if (b.phone) { y += 5; doc.text(`Customer: ${b.phone}`, X, y); }
    if (b.cancelled) { doc.setTextColor(177, 39, 4); doc.setFont("helvetica", "bold"); doc.text("CANCELLED", R, y + 5, { align: "right" }); }
    // table
    y += 7;
    doc.setFillColor(243, 245, 245); doc.rect(X, y, R - X, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.3); doc.setTextColor(86, 89, 89);
    doc.text("ITEM", X + 2, y + 4.7); doc.text("QTY", 64, y + 4.7, { align: "right" }); doc.text("RATE", 80, y + 4.7, { align: "right" }); doc.text("AMOUNT", R - 2, y + 4.7, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(15, 17, 17);
    b.lines.forEach((l, i) => {
      const w = wrapped[i]; const h = w.length * 4.2 + 3;
      doc.text(w, X + 2, y + 4.6);
      doc.text(String(l.qty), 64, y + 4.6, { align: "right" });
      doc.text(Math.round(l.price).toLocaleString("en-IN"), 80, y + 4.6, { align: "right" });
      doc.text(Math.round(l.qty * l.price).toLocaleString("en-IN"), R - 2, y + 4.6, { align: "right" });
      y += h; doc.setDrawColor(225, 228, 228); doc.setLineWidth(0.2); doc.line(X, y, R, y);
    });
    // totals
    y += 6; doc.setFontSize(9); doc.setTextColor(86, 89, 89);
    const row = (label, val) => { doc.text(label, 58, y); doc.text(val, R - 2, y, { align: "right" }); y += 5; };
    row(`Items (${b.units})`, rs(b.sub));
    if (b.discount) row("Discount", "- " + rs(b.discount));
    doc.setFillColor(255, 216, 20); doc.roundedRect(54, y - 3.6, R - 54, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 17, 17);
    doc.text("TOTAL", 57, y + 2.4); doc.text(rs(b.total), R - 2, y + 2.4, { align: "right" });
    y += 11; doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(86, 89, 89);
    row("Paid by", { cash: "Cash", upi: "UPI", card: "Card", khata: "Khata (pay later)" }[b.pay]);
    if (b.received) { row("Cash received", rs(b.received)); row("Returned", rs(Math.max(0, b.received - b.total))); }
    // the shop's small advert
    y += 3;
    const promo = s.promo || `Visit ${s.name} again — new stock every week.`;
    const pl = doc.splitTextToSize(promo, R - X - 22);
    doc.setFontSize(7.6);
    const sub = doc.splitTextToSize(`See our stock & prices on My Market: search "${s.name}"`, R - X - 18);
    doc.setFontSize(9.5);
    const bh = 7 + pl.length * 4 + sub.length * 3.3;
    doc.setFillColor(255, 243, 223); doc.setDrawColor(255, 164, 28); doc.setLineWidth(0.4);
    doc.roundedRect(X, y, R - X, bh, 2, 2, "FD");
    doc.setFillColor(255, 164, 28); doc.circle(X + 7, y + bh / 2, 3.6, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("%", X + 7, y + bh / 2 + 1.2, { align: "center" });
    doc.setTextColor(112, 63, 0); doc.setFontSize(9.5); doc.text(pl, X + 14, y + 5.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.setTextColor(140, 90, 20);
    doc.text(sub, X + 14, y + 5.2 + pl.length * 4);
    // footer
    y += bh + 9;
    doc.setTextColor(15, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text("Thank you! Visit again.", W / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(138, 145, 145);
    doc.text("Computer-generated bill · My Market", W / 2, y + 4.5, { align: "center" });
    return doc;
  }
  // Share the bill PDF. Phones: the share sheet opens with the PDF attached
  // (pick WhatsApp, send). Computers: the PDF downloads and the customer's
  // WhatsApp chat opens. In v2 the shop's WhatsApp Business number sends it
  // by itself through the WhatsApp Business API — this is the one place to swap.
  async function sendBill(b, s) {
    const num = A.normPhone(b.phone);
    const text = `Bill #${b.no} from ${s.name}: ${rs(b.total)}. Thank you!`;
    if (!window.jspdf) {
      U.toast("PDF needs the internet once — sending the bill as text");
      if (num) window.open(`https://wa.me/91${num}?text=${encodeURIComponent(billText(b, s))}`, "_blank", "noopener");
      return "text";
    }
    const doc = makeBillPdf(b, s);
    const file = new File([doc.output("blob")], billName(b, s), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Bill #${b.no}`, text }); return "shared"; }
      catch (x) { if (x.name === "AbortError") return "cancelled"; }
    }
    doc.save(billName(b, s));
    if (num) { window.open(`https://wa.me/91${num}?text=${encodeURIComponent(text + " (PDF attached)")}`, "_blank", "noopener"); U.toast("PDF saved — attach it in the WhatsApp chat that opened"); }
    else U.toast("Bill PDF downloaded");
    return "downloaded";
  }

  // ---------- stock arrived (purchase) ----------
  function stockInView() {
    const s = A.ownerShop();
    let lines = A.store.get("stockDraft:" + s.id, []); // [{itemId, name, qty, cost}]
    const keep = () => A.store.set("stockDraft:" + s.id, lines);
    let q = "", supplier = A.store.get("lastSupplier:" + s.id, ""), pay = "cash";
    const lineOf = (id) => lines.find((l) => l.itemId === id);
    function add(it, n = 1) {
      const l = lineOf(it.id);
      if (l) l.qty += n; else lines.push({ itemId: it.id, name: it.name, qty: n, cost: it.cost ?? null });
      lines = lines.filter((x) => x.qty > 0); keep(); paint();
    }
    function paint() {
      const list = [...s.items].filter((it) => !q || `${it.name} ${it.brand}`.toLowerCase().includes(q))
        .sort((a, b) => ((a.qty ?? 99) - (b.qty ?? 99)) || a.name.localeCompare(b.name)); // lowest stock first
      $("#bgrid").innerHTML = list.map((it) => {
        const l = lineOf(it.id), n = l ? l.qty : 0;
        return `<div class="btile ${n ? "on" : ""}" data-it="${it.id}">
          <span class="bimg" style="${U.catVars(it.cat)}">${U.pimg(it)}</span>
          <span class="bname">${esc(it.name)}</span>
          <span class="bst ${it.qty === 0 ? "out" : ""}">${it.qty == null ? "not counted" : `${it.qty} in stock`}</span>
          ${n ? `<span class="bstep"><button data-dec="${it.id}" aria-label="One less">−</button><b>+${n}</b><button data-inc="${it.id}" aria-label="One more">+</button></span>` : ""}
        </div>`;
      }).join("") || '<p class="quiet small">No item matches. Add it as a new item.</p>';
      const units = lines.reduce((a, l) => a + l.qty, 0);
      $("#bsum").innerHTML = units ? `<span><b>+${units}</b><em>${lines.length} item${lines.length > 1 ? "s" : ""} arriving</em></span>` : '<span class="quiet">Tap what arrived</span>';
      $("#bgo").classList.toggle("hidden", !units);
      $$("[data-it]").forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-dec],[data-inc]")) return; add(s.items.find((x) => x.id === el.dataset.it)); });
      $$("[data-inc]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.inc)));
      $$("[data-dec]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.dec), -1));
    }
    function review() {
      const draw = (el) => {
        const total = lines.reduce((a, l) => a + (l.cost || 0) * l.qty, 0);
        el.innerHTML = `<div class="eyebrow">Stock arrived</div><div class="title">+${lines.reduce((a, l) => a + l.qty, 0)} pieces</div>
          <div class="entries">${lines.map((l, i) => `<div class="bline">
            <div class="body"><div class="name">${esc(l.name)}</div>
              <label class="small quiet">Cost each ₹ <input class="field" data-cost="${i}" inputmode="numeric" value="${l.cost ?? ""}" placeholder="optional" style="width:90px;padding:4px 8px;font-size:14px"></label></div>
            <span class="stepper sm"><button data-m="${i}" aria-label="One less">−</button><span>${l.qty}</span><button data-p="${i}" aria-label="One more">+</button></span></div>`).join("")}</div>
          ${total ? `<p class="small" style="margin-top:10px">Purchase total <b>${rupee(total)}</b></p>` : ""}
          <div class="form" style="margin-top:12px"><label>Supplier <span class="faint tiny">(optional)</span><input class="field" id="sup" value="${esc(supplier)}" placeholder="e.g. Gupta Distributors"></label></div>
          <div class="words" style="margin-top:10px">${[["cash", "Paid cash"], ["upi", "Paid UPI"], ["credit", "On credit"]].map(([k, v]) => `<button class="word ${pay === k ? "on" : ""}" data-pay="${k}">${v}</button>`).join("")}</div>
          <div class="opts"><button class="btn" id="savein" style="height:50px">Add to stock</button></div>`;
        const ix = (b, k) => +b.dataset[k];
        $$("[data-m]", el).forEach((b) => b.onclick = () => { lines[ix(b, "m")].qty--; lines = lines.filter((l) => l.qty > 0); keep(); paint(); if (!lines.length) return U.closeSheet(); draw(el); });
        $$("[data-p]", el).forEach((b) => b.onclick = () => { lines[ix(b, "p")].qty++; keep(); paint(); draw(el); });
        $$("[data-cost]", el).forEach((inp) => inp.onchange = () => { const v = Math.round(+inp.value); lines[ix(inp, "cost")].cost = v > 0 ? v : null; keep(); draw(el); });
        $("#sup", el).oninput = (e) => { supplier = e.target.value; };
        $$("[data-pay]", el).forEach((b) => b.onclick = () => { pay = b.dataset.pay; draw(el); });
        $("#savein", el).onclick = () => {
          const p = A.savePurchase(s.id, { lines, supplier, pay });
          if (supplier.trim()) A.store.set("lastSupplier:" + s.id, supplier.trim());
          A.store.del("stockDraft:" + s.id); lines = [];
          U.closeSheet(); U.toast(`Added ${p.lines.reduce((a, l) => a + l.qty, 0)} pieces to stock`); U.go("#/biz/items");
        };
      };
      U.openSheet("", draw);
    }
    U.app.innerHTML = `
      ${bizTop("Stock arrived")}
      <div class="pad billhead"><b>What arrived?</b><span class="quiet small">Tap each item once per piece</span></div>
      <div class="pad"><div class="inshop">${ic("search")}<input id="bq" placeholder="Find an item" autocomplete="off"></div></div>
      <div class="bgrid" id="bgrid"></div>
      <div class="pad" style="margin:12px 0 0"><button class="btn line" id="newit">${ic("camera")} New item (with photo)</button></div>
      <div style="height:110px"></div>
      <div class="billbar"><div id="bsum"></div><button class="btn auto" id="bgo">Review</button></div>`;
    bindTop();
    $("#bq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $("#newit").onclick = () => newItemSheet(s, (it) => { if (it) add(it, 0); paint(); });
    $("#bgo").onclick = review;
    paint();
  }

  // ---------- new item: photo + name + price + quantity ----------
  // The photo is shrunk to 360 px and kept with the item and uploaded to the server.
  function shrinkPhoto(file) {
    return new Promise((res) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 360 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  // ---------- barcode scanner ----------
  // Uses the phone's built-in barcode reader (Android Chrome); otherwise loads
  // the ZXing reader once. The shop can always type the number instead.
  let zxingLoad = null;
  const loadZXing = () => zxingLoad || (zxingLoad = new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
    sc.onload = () => res(window.ZXing); sc.onerror = () => { zxingLoad = null; rej(new Error("Scanner needs the internet once")); };
    document.head.appendChild(sc);
  }));
  function scanBarcode() {
    return new Promise((resolve) => {
      let stream = null, stop = () => {}, done = false;
      const finish = (code) => {
        if (done) return; done = true; stop();
        try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {}
        document.getElementById("scanbox")?.remove(); resolve(code || null);
      };
      const box = document.createElement("div"); box.id = "scanbox";
      box.innerHTML = `<div class="scanin"><div class="scanhd"><b>Scan barcode</b><button class="link" data-x>Cancel</button></div>
        <video playsinline muted></video><div class="scanline"></div>
        <p class="small" id="scanmsg">Point the camera at the barcode on the pack</p>
        <div class="two"><input class="field" id="scantype" inputmode="numeric" placeholder="Or type the number"><button class="btn auto" data-ok>Use</button></div></div>`;
      document.body.appendChild(box);
      const video = box.querySelector("video"), msg = box.querySelector("#scanmsg");
      box.querySelector("[data-x]").onclick = () => finish(null);
      box.querySelector("[data-ok]").onclick = () => { const v = box.querySelector("#scantype").value.replace(/\D/g, ""); if (v.length >= 6) finish(v); else msg.textContent = "Type the 8–13 digit number under the barcode"; };
      (async () => {
        try {
          if ("BarcodeDetector" in window) {
            const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream; await video.play();
            const tick = async () => { if (done) return; try { const r = await det.detect(video); const c = r.find((x) => /^\d{6,14}$/.test(x.rawValue)); if (c) return finish(c.rawValue); } catch {} requestAnimationFrame(tick); };
            tick();
          } else {
            msg.textContent = "Starting the camera…";
            const ZX = await loadZXing();
            const reader = new ZX.BrowserMultiFormatReader();
            stop = () => { try { reader.reset(); } catch {} };
            msg.textContent = "Point the camera at the barcode on the pack";
            reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, (res) => { if (res && /^\d{6,14}$/.test(res.getText())) finish(res.getText()); });
          }
        } catch (e) { msg.textContent = /Permission|NotAllowed/i.test(e.name + e.message) ? "Camera blocked — allow the camera, or type the number below" : (e.message || "No camera here — type the number below"); }
      })();
    });
  }

  // ---------- product details form (new item, or details of an existing item) ----------
  const lines = (v) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  const parseSpecs = (v) => Object.fromEntries(lines(v).map((l) => l.split(/\s*[:=–-]\s*/)).filter((p) => p.length >= 2 && p[0]).map(([k, ...r]) => [k, r.join(" - ")]));
  const specText = (o) => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
  function detailsHTML(d, locked) {
    const dis = locked ? "disabled" : "";
    return `<details class="more" ${d.features?.length || d.description || Object.keys(d.specMap || {}).length ? "open" : ""}>
      <summary>Product details <span class="faint tiny">— what customers see on the product page</span></summary>
      ${locked ? '<p class="small quiet" style="margin:8px 0 0">These details come from the My Market catalogue (added by another shop).</p>' : ""}
      <div class="two"><label>Size / quantity<input class="field" id="dsz" value="${esc(d.size || "")}" placeholder="1 kg, 32 A, 1 inch" ${dis}></label>
        <label>Model <span class="faint tiny">(optional)</span><input class="field" id="dmd" value="${esc(d.model || "")}" ${dis}></label></div>
      <label>Key features <span class="faint tiny">— one per line</span><textarea class="field" id="dft" rows="3" placeholder="Brass body&#10;Full bore&#10;For hot and cold water" ${dis}>${esc((d.features || []).join("\n"))}</textarea></label>
      <label>Description<textarea class="field" id="dds" rows="2" ${dis}>${esc(d.description || "")}</textarea></label>
      <label>Specifications <span class="faint tiny">— "Name: value", one per line</span><textarea class="field" id="dsp" rows="3" placeholder="Material: Brass&#10;Warranty: 1 year (printed on pack)" ${dis}>${esc(specText(d.specMap))}</textarea></label>
      <label>Other words customers use <span class="faint tiny">— comma separated</span><input class="field" id="dkw" value="${esc((d.keywords || []).join(", "))}" placeholder="nal, tonti, tap" ${dis}></label>
    </details>`;
  }
  function readDetails(el, base) {
    return { ...base, size: $("#dsz", el).value.trim(), model: $("#dmd", el).value.trim(), features: lines($("#dft", el).value).slice(0, 8),
      description: $("#dds", el).value.trim(), specMap: parseSpecs($("#dsp", el).value), keywords: $("#dkw", el).value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 15) };
  }

  function newItemSheet(s, after, presetName = "") {
    let photo = null, cat = s.cat, found = null; // found = catalogue / open-database product
    const draw = (el, f = {}) => {
      const locked = found && found.source === "catalog" && found.product.created_by !== s.id;
      const p = found ? found.product : {};
      const d = found ? { barcode: p.barcode, size: p.size, model: p.model, features: p.features, description: p.description, specMap: p.specs, keywords: p.keywords } : f;
      el.innerHTML = `<div class="eyebrow">Stock</div><div class="title">New item</div>
      <div class="form">
        <div class="scanrow"><button class="btn line auto" type="button" id="scan">${ic("camera")} Scan barcode</button>
          <input class="field" id="bc" inputmode="numeric" placeholder="or barcode number" value="${esc(d.barcode || f.barcode || "")}"></div>
        <p class="small" id="lk" style="margin:0">${found ? (found.source === "catalog" ? `<b class="up">✓ Found in the My Market catalogue</b> — details filled in` : `<b class="up">✓ Found in ${esc(found.label)}</b> — check the details`) : f.notFound ? "Not found in any catalogue — fill in what's on the pack. The next shop gets it automatically." : '<span class="faint">Scan first — details may fill in by themselves.</span>'}</p>
        <label class="photo-in"><input type="file" accept="image/*" capture="environment" id="ph" hidden>
          <span id="phv">${photo ? `<img src="${photo}" alt="">` : p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : `${ic("camera")}<em>Take or choose a photo</em>`}</span></label>
        ${!photo && p.photo_url && p.photo_credit ? `<p class="faint tiny" style="margin:-6px 0 0">${esc(p.photo_credit)} — take your own photo to replace it</p>` : ""}
        <label>Name<input class="field" id="nm" placeholder="e.g. Ball valve 1 inch" autocomplete="off" value="${esc(p.name || f.name || (presetName ? presetName[0].toUpperCase() + presetName.slice(1) : ""))}"></label>
        <label>Brand <span class="faint tiny">(optional)</span><input class="field" id="br" placeholder="e.g. Ashirvad" autocomplete="off" value="${esc(p.brand || f.brand || "")}"></label>
        <label>Category</label><div class="words" id="ncat">${Object.entries(C).map(([k, c]) => `<button type="button" class="word ${k === cat ? "on" : ""}" data-c="${k}">${esc(c.name)}</button>`).join("")}</div>
        <div class="two"><label>Selling price ₹<input class="field" id="pr" inputmode="numeric" value="${esc(f.price || "")}"></label><label>MRP on pack ₹<input class="field" id="mrp" inputmode="numeric" value="${esc(p.mrp || f.mrp || "")}"></label></div>
        <div class="two"><label>Your cost ₹ <span class="faint tiny">(private)</span><input class="field" id="co" inputmode="numeric" value="${esc(f.cost || "")}"></label><label>Quantity in stock<input class="field" id="qt" inputmode="numeric" placeholder="e.g. 20" value="${esc(f.qty || "")}"></label></div>
        ${detailsHTML(d, locked)}
        <p class="small" id="nerr" style="color:var(--out);margin:0;min-height:1em"></p>
        <button class="btn" id="nsave" type="button">Save item</button></div>`;
      const keep = () => ({ name: $("#nm", el).value, brand: $("#br", el).value, price: $("#pr", el).value, mrp: $("#mrp", el).value, cost: $("#co", el).value, qty: $("#qt", el).value, barcode: $("#bc", el).value });
      const lookup = async (code) => {
        code = String(code || "").replace(/\D/g, "");
        if (code.length < 6) return;
        const k = keep(); k.barcode = code;
        $("#lk", el).innerHTML = '<span class="faint">Looking it up…</span>';
        const local = s.items.find((x) => x.barcode === code);
        if (local) { $("#lk", el).innerHTML = `<b class="down">You already have this: ${esc(local.name)}</b>`; return; }
        const r = window.MM_CLOUD ? await window.MM_CLOUD.lookupBarcode(code).catch(() => null) : null;
        found = r; if (r) cat = r.product.cat in C ? r.product.cat : cat;
        draw(el, { ...k, notFound: !r });
      };
      $("#scan", el).onclick = async () => { const code = await scanBarcode(); if (code) lookup(code); };
      $("#bc", el).onchange = (e) => lookup(e.target.value);
      $("#ph", el).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        photo = await shrinkPhoto(file);
        $("#phv", el).innerHTML = photo ? `<img src="${photo}" alt="">` : `${ic("camera")}<em>Couldn't read that photo</em>`;
      };
      $$("#ncat [data-c]", el).forEach((b) => b.onclick = () => { cat = b.dataset.c; $$("#ncat .word", el).forEach((x) => x.classList.toggle("on", x === b)); });
      $("#nsave", el).onclick = () => {
        const name = $("#nm", el).value.trim(), pr = Math.round(+$("#pr", el).value), co = Math.round(+$("#co", el).value), qv = $("#qt", el).value.trim(), mrp = Math.round(+$("#mrp", el).value);
        if (!name) return ($("#nerr", el).textContent = "Type the item's name");
        if (!(pr > 0)) return ($("#nerr", el).textContent = "Type the selling price");
        const barcode = $("#bc", el).value.replace(/\D/g, "");
        let details = { barcode, mrp: mrp > 0 ? mrp : null };
        if (found && found.source === "catalog") details = { ...details, ...A.productDetails(found.product, (pp) => window.MM_CLOUD?.photoUrl(pp), s.id) };
        if (!(found && found.source === "catalog" && found.product.created_by !== s.id)) details = readDetails(el, details);
        if (found && found.source !== "catalog") Object.assign(details, { productPhoto: found.product.photo_url, photoCredit: found.product.photo_credit, source: "openfoodfacts" });
        const it = A.addOwnItem(s.id, { name, brand: $("#br", el).value.trim(), cat, price: pr, cost: co > 0 ? co : null, photo, qty: qv === "" ? null : Math.max(0, Math.round(+qv)), details });
        if (!it) return ($("#nerr", el).textContent = "You already have an item with this name");
        U.closeSheet(); U.toast(`${name} added${qv ? ` · ${qv} in stock` : ""}`); after && after(it);
      };
    };
    U.openSheet("", (el) => draw(el));
  }

  // details for an item the shop already has (barcode, size, features, specs…)
  function detailsSheet(s, it, after) {
    const locked = it.productId && !it.productMine;
    U.openSheet("", (el) => {
      el.innerHTML = `<div class="eyebrow">${esc(it.brand || "")}</div><div class="title">${esc(it.name)}</div>
        <div class="form">
          <div class="scanrow"><button class="btn line auto" type="button" id="scan">${ic("camera")} Scan barcode</button>
            <input class="field" id="bc" inputmode="numeric" placeholder="barcode number" value="${esc(it.barcode || "")}" ${locked ? "disabled" : ""}></div>
          <p class="small" id="lk" style="margin:0"></p>
          <label>MRP on pack ₹<input class="field" id="mrp" inputmode="numeric" value="${esc(it.mrp || "")}"></label>
          ${detailsHTML({ ...it, open: true }, locked)}
          <label class="photo-in"><input type="file" accept="image/*" capture="environment" id="ph" hidden>
            <span id="phv">${it.img ? `<img src="${esc(it.img)}" alt="">` : `${ic("camera")}<em>Add a photo</em>`}</span></label>
          <button class="btn" id="dsave" type="button">Save details</button></div>`;
      $("details.more", el)?.setAttribute("open", "");
      let photo = null;
      $("#ph", el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; photo = await shrinkPhoto(f); if (photo) $("#phv", el).innerHTML = `<img src="${photo}" alt="">`; };
      $("#scan", el).onclick = async () => {
        const code = await scanBarcode(); if (!code) return;
        $("#bc", el).value = code; $("#lk", el).innerHTML = '<span class="faint">Looking it up…</span>';
        const r = window.MM_CLOUD ? await window.MM_CLOUD.lookupBarcode(code).catch(() => null) : null;
        if (r && r.source === "catalog" && r.product.created_by !== s.id) {
          A.saveDetails(s.id, it.id, { ...A.productDetails(r.product, (pp) => window.MM_CLOUD?.photoUrl(pp), s.id), mrp: r.product.mrp ?? it.mrp });
          U.closeSheet(); U.toast("Linked to the My Market catalogue — details filled in"); after && after(); return;
        }
        if (r) {
          const p = r.product;
          if (!$("#dsz", el).value) $("#dsz", el).value = p.size || "";
          if (!$("#dds", el).value) $("#dds", el).value = p.description || "";
          $("#lk", el).innerHTML = `<b class="up">✓ Found in ${esc(r.label || "the catalogue")}</b> — check and save`;
        } else $("#lk", el).textContent = "Not found — fill in what's on the pack.";
      };
      $("#dsave", el).onclick = () => {
        const mrp = Math.round(+$("#mrp", el).value);
        const base = { barcode: $("#bc", el).value.replace(/\D/g, ""), mrp: mrp > 0 ? mrp : null };
        if (locked) { if (base.mrp) A.setItem(s.id, it.id, { mrp: base.mrp }); }
        else A.saveDetails(s.id, it.id, readDetails(el, base));
        if (photo) { it.photo = photo; A.addPhoto(s.id, it.id, photo); }
        U.closeSheet(); U.toast("Details saved"); after && after();
      };
    });
  }

  // ---------- reports ----------
  // 1 sales today / week / month vs the previous period · 2 daily sales chart
  // 3 running low (with days left) · 4 not selling (money stuck) · 5 what customers look for
  function reportsView(params) {
    const s = A.ownerShop();
    const DAYMS = 86400000, nowMs = Date.now(), now = new Date(nowMs);
    const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const today0 = sod(nowMs);
    const week0 = today0 - ((now.getDay() + 6) % 7) * DAYMS;            // week starts Monday
    const month0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonth0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const bills = A.billsFor(s.id).filter((b) => !b.cancelled);
    const sum = (from, to) => {
      let t = 0, p = 0, n = 0, noCost = false;
      for (const b of bills) if (b.at >= from && b.at < to) {
        t += b.total; n++; p -= b.discount;
        for (const l of b.lines) { if (l.cost == null) noCost = true; else p += (l.price - l.cost) * l.qty; }
      }
      return { t, p, n, noCost };
    };
    // compare with the same stretch of the previous period (up to this time)
    const rows = [
      ["Today", sum(today0, nowMs + 1), sum(today0 - DAYMS, nowMs - DAYMS), "yesterday"],
      ["This week", sum(week0, nowMs + 1), sum(week0 - 7 * DAYMS, nowMs - 7 * DAYMS), "last week"],
      ["This month", sum(month0, nowMs + 1), sum(lastMonth0, Math.min(month0, lastMonth0 + (nowMs - month0))), "last month"],
    ];
    const change = (a, b, word) => {
      if (!b.t && !a.t) return `<span class="faint">no sales yet</span>`;
      if (!b.t) return `<span class="up">new · none ${word}</span>`;
      const pc = Math.round(((a.t - b.t) / b.t) * 100);
      return `<span class="${pc >= 0 ? "up" : "down"}">${pc >= 0 ? "▲" : "▼"} ${Math.abs(pc)}%</span> <span class="faint">vs ${word}</span>`;
    };

    // daily chart
    const span = params.get("c") === "30" ? 30 : 7;
    const days = Array.from({ length: span }, (_, i) => { const d0 = today0 - (span - 1 - i) * DAYMS; return { d0, ...sum(d0, d0 + DAYMS) }; });
    const max = Math.max(1, ...days.map((d) => d.t));
    const total = days.reduce((a, d) => a + d.t, 0);
    const best = days.reduce((a, d) => (d.t > a.t ? d : a), days[0]);
    const dayName = (t, long) => new Date(t).toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short" });

    // sales per item: last sale and units in the last 14 days
    const lastSale = {}, sold14 = {}, soldAll = {};
    for (const b of bills) for (const l of b.lines) if (l.itemId) {
      lastSale[l.itemId] = Math.max(lastSale[l.itemId] || 0, b.at);
      soldAll[l.itemId] = (soldAll[l.itemId] || 0) + l.qty;
      if (b.at >= nowMs - 14 * DAYMS) sold14[l.itemId] = (sold14[l.itemId] || 0) + l.qty;
    }
    // running low
    const low = s.items.filter((it) => it.qty != null && it.qty <= A.lowAt(it)).map((it) => {
      const rate = (sold14[it.id] || 0) / 14;
      return { it, rate, left: rate ? it.qty / rate : null };
    }).sort((a, b) => (a.it.qty === 0 ? -1 : 0) - (b.it.qty === 0 ? -1 : 0) || (a.left ?? 999) - (b.left ?? 999));
    // not selling: in stock, no sale for N days (counted from when it was added if never sold)
    const deadDays = [15, 30, 60].includes(+params.get("dd")) ? +params.get("dd") : 30;
    const dead = s.items.filter((it) => (it.qty ?? 0) > 0).map((it) => {
      const since = lastSale[it.id] || it.addedAt || null;
      return { it, since, sold: !!lastSale[it.id], idle: since ? Math.floor((nowMs - since) / DAYMS) : null, stuck: it.qty * (it.cost || 0) };
    }).filter((x) => x.idle != null && x.idle >= deadDays).sort((a, b) => b.stuck - a.stuck || b.idle - a.idle);
    const stuckTotal = dead.reduce((a, x) => a + x.stuck, 0);
    const youngest = s.items.length ? Math.min(...s.items.map((it) => (it.addedAt ? Math.floor((nowMs - it.addedAt) / DAYMS) : 0))) : 0;

    const sDays = params.get("sd") === "30" ? 30 : 7;
    const link = (k, v) => { const p = new URLSearchParams(params); p.set(k, v); return `#/biz/reports?${p}`; };
    U.app.innerHTML = `
      ${bizTop("Reports")}

      <div class="rsec"><div class="rhd"><b>Sales</b><a class="link" href="#/biz/bills">All bills</a></div>
        <div class="salesrows">${rows.map(([label, a, b, word]) => `<div class="srow">
          <div><span class="sl">${label}</span><b>${rupee(a.t)}</b><em>${a.n} bill${a.n === 1 ? "" : "s"} · profit ${rupee(a.p)}${a.noCost ? "*" : ""}</em></div>
          <div class="sc">${change(a, b, word)}</div></div>`).join("")}</div>
        ${rows.some(([, a]) => a.noCost) ? '<p class="faint tiny" style="margin:6px 0 0">* some items have no cost price, so profit is shown only for the ones that do.</p>' : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Daily sales</b>
          <div class="words">${[7, 30].map((k) => `<a class="word ${span === k ? "on" : ""}" href="${link("c", k)}">${k} days</a>`).join("")}</div></div>
        <div class="dbars big ${span === 30 ? "thin" : ""}">${days.map((d, i) => `<button data-day="${i}" class="${d.d0 === today0 ? "today" : ""}" aria-label="${dayName(d.d0, true)} ${rupee(d.t)}">
          ${span === 7 && d.t ? `<small>${d.t >= 1000 ? Math.round(d.t / 100) / 10 + "k" : d.t}</small>` : ""}<i style="height:${Math.max(2, Math.round((d.t / max) * 100))}%"></i>
          <span>${span === 7 ? dayName(d.d0).slice(0, 2) : new Date(d.d0).getDate() % 5 === 1 ? new Date(d.d0).getDate() : ""}</span></button>`).join("")}</div>
        <p class="small" id="dayinfo" style="margin:10px 0 0">${total ? `${span} days: <b>${rupee(total)}</b> · average ${rupee(Math.round(total / span))}/day · best ${dayName(best.d0, true)} (${rupee(best.t)})` : "No sales in this period yet."}</p>
      </div>

      <div class="rsec"><div class="rhd"><b>Running low</b>${low.length ? `<a class="link" href="#/biz/stockin">Add stock</a>` : ""}</div>
        ${low.length ? `<div class="entries">${low.slice(0, 6).map(({ it, rate, left }) => `<a class="entry" href="#/biz/items?f=${it.qty === 0 ? "out" : "low"}">
          <span class="thumb sm" style="${U.catVars(it.cat)}">${U.pimg(it)}</span>
          <div class="body"><div class="name">${esc(it.name)}</div>
          <div class="note">${it.qty === 0 ? '<b class="down">Out of stock</b>' : `<b class="warn">${it.qty} left</b>`}${rate ? ` · sells ~${rate >= 1 ? Math.round(rate) + "/day" : Math.round(rate * 7) + "/week"}` : " · no sales in 2 weeks"}</div></div>
          <div class="aside">${it.qty === 0 ? "" : left != null ? `<b>${left < 1 ? "<1" : Math.round(left)} day${Math.round(left) === 1 ? "" : "s"}</b>left` : ""}</div></a>`).join("")}</div>
          ${low.length > 6 ? `<a class="link" href="#/biz/items?f=low" style="display:inline-block;margin-top:8px">All ${low.length} items</a>` : ""}`
        : `<p class="quiet small">${s.items.some((it) => it.qty != null) ? "Nothing is running low." : "Count your stock on the Stock page to see what's running low."}</p>`}
      </div>

      <div class="rsec"><div class="rhd"><b>Not selling</b>
          <div class="words">${[15, 30, 60].map((k) => `<a class="word ${deadDays === k ? "on" : ""}" href="${link("dd", k)}">${k}d</a>`).join("")}</div></div>
        ${dead.length ? `<p class="small" style="margin:0 0 6px">${dead.length} item${dead.length > 1 ? "s" : ""} not sold for ${deadDays}+ days${stuckTotal ? ` · <b>${rupee(stuckTotal)}</b> stuck in stock` : ""}</p>
          <div class="entries">${dead.slice(0, 5).map((x) => `<a class="entry" href="#/biz/items">
          <span class="thumb sm" style="${U.catVars(x.it.cat)}">${U.pimg(x.it)}</span>
          <div class="body"><div class="name">${esc(x.it.name)}</div><div class="note">${x.sold ? `No sale for ${x.idle} days` : `Never sold · ${x.idle} days`} · ${x.it.qty} in stock</div></div>
          <div class="aside">${x.stuck ? `<b>${rupee(x.stuck)}</b>stuck` : ""}</div></a>`).join("")}</div>
          <p class="faint tiny" style="margin:8px 0 0">Ideas: put it near the counter, offer a small discount, or don't reorder it.</p>`
        : `<p class="quiet small">${s.items.length && youngest < deadDays && !Object.keys(lastSale).length ? `Nothing yet — items show here once they've been in stock ${deadDays} days without a sale.` : `Everything in stock has sold in the last ${deadDays} days.`}</p>`}
      </div>

      <div class="rsec"><div class="rhd"><b>Customers looking for</b>
          <div class="words">${[7, 30].map((k) => `<a class="word ${sDays === k ? "on" : ""}" href="${link("sd", k)}">${k}d</a>`).join("")}</div></div>
        <p class="faint tiny" style="margin:0 0 6px">What people searched on My Market within 3 km of your shop.</p>
        <div id="looking"><p class="quiet small">Loading…</p></div>
      </div>
      <div style="height:30px"></div>`;
    bindTop();
    $$("[data-day]").forEach((b) => b.onclick = () => {
      const d = days[+b.dataset.day];
      $$("[data-day]").forEach((x) => x.classList.toggle("sel", x === b));
      $("#dayinfo").innerHTML = `${dayName(d.d0, true)}: <b>${rupee(d.t)}</b> · ${d.n} bill${d.n === 1 ? "" : "s"} · profit ${rupee(d.p)}`;
    });

    // customers looking for: from the server (all customers near the shop), or this phone's searches offline
    const paintLooking = (list) => {
      const el = $("#looking"); if (!el) return;
      if (!list.length) { el.innerHTML = '<p class="quiet small">No searches near you yet. This fills in as customers use My Market around your shop.</p>'; return; }
      el.innerHTML = `<div class="entries">${list.slice(0, 10).map((r, i) => {
        const has = A.shopHas(s, r.q);
        return `<div class="entry"><div class="body"><div class="name">${esc(r.q)}</div>
          <div class="note">${r.n} search${r.n > 1 ? "es" : ""}${r.missed ? ` · <b class="down">${r.missed === r.n ? "nobody had it" : `${r.missed} found nothing`}</b>` : ""}</div></div>
          <div class="aside">${has ? `<span class="tag ok">You have it</span>` : `<button class="tag add" data-addq="${i}">+ Add item</button>`}</div></div>`;
      }).join("")}</div>`;
      $$("[data-addq]", el).forEach((b) => b.onclick = () => newItemSheet(s, () => reportsView(params), list[+b.dataset.addq].q));
    };
    if (window.MM_CLOUD && s.cloud) window.MM_CLOUD.searchesNear(s.id, sDays).then((r) => paintLooking(r.map((x) => ({ q: x.q, n: +x.n, missed: +x.missed }))))
      .catch(() => { const el = $("#looking"); if (el) el.innerHTML = '<p class="quiet small">Couldn\'t load searches — check the internet and open Reports again.</p>'; });
    else paintLooking(A.missedSales(s).map((m) => ({ q: m.q, n: m.n, missed: m.n })));
  }

  function billText(b, s) {
    const d = new Date(b.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    return [`*${s.name}*`, `Bill #${b.no} · ${d}`, "",
      ...b.lines.map((l) => `${l.name} — ${l.qty} × ₹${l.price} = ₹${(l.qty * l.price).toLocaleString("en-IN")}`), "",
      b.discount ? `Discount: −₹${b.discount}` : null, `*Total: ₹${b.total.toLocaleString("en-IN")}*`, `Paid by: ${PAYS[b.pay]}`, "", "Thank you! — sent from My Market"].filter((x) => x !== null).join("\n");
  }
  function receiptView(id) {
    const b = A.getBill(id), s = A.ownerShop();
    if (!b || !s || b.shopId !== s.id) { U.app.innerHTML = '<div class="empty"><div class="serif">Bill not found.</div><p><a class="link" href="#/biz/bills">All bills</a></p></div>'; return; }
    const m = A.getMarket(s.marketId);
    const d = new Date(b.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    U.app.innerHTML = `
      <div class="topline noprint"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><b style="font-weight:600">Bill #${b.no}</b><a class="link" href="#/biz/bills">Bills</a></div>
      ${b.cancelled ? '<div class="banner noprint" style="margin:12px var(--gut) 0"><div class="serif">This bill was cancelled</div><p>Its items went back into stock.</p></div>' : ""}
      <div class="receipt">
        <div class="rhead"><b>${esc(s.name)}</b><span>${esc(m?.name || "")}${s.shopNo && s.shopNo !== "—" ? ` · Shop ${esc(s.shopNo)}` : ""}${s.pincode ? ` · ${esc(s.locality || "")} ${esc(s.pincode)}` : ""}</span>${s.phone ? `<span>${esc(s.phone)}</span>` : ""}</div>
        <div class="rmeta"><span>Bill #${b.no}</span><span>${d}</span></div>
        <table class="rtable"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          ${b.lines.map((l) => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${rupee(l.price)}</td><td>${rupee(l.qty * l.price)}</td></tr>`).join("")}</table>
        <div class="rtot">${b.discount ? `<div><span>Items</span><span>${rupee(b.sub)}</span></div><div><span>Discount</span><span>−${rupee(b.discount)}</span></div>` : ""}
          <div class="big"><span>Total</span><span>${rupee(b.total)}</span></div>
          <div><span>Paid by</span><span>${PAYS[b.pay]}</span></div>
          ${b.received ? `<div><span>Cash received</span><span>${rupee(b.received)}</span></div><div><span>Returned</span><span>${rupee(Math.max(0, b.received - b.total))}</span></div>` : ""}</div>
        <div class="rad"><b>%</b><span>${esc(s.promo || `Visit ${s.name} again — new stock every week.`)}<em>See our stock and prices on My Market</em></span></div>
        <div class="rfoot">Thank you! Visit again.<br><span>${b.units} item${b.units > 1 ? "s" : ""} · My Market</span></div>
      </div>
      <div class="pad noprint" style="display:grid;gap:10px;margin:18px 0 10px">
        <button class="btn" id="wa">${b.phone ? `Send bill PDF to ${esc(b.phone)}` : "Share bill PDF"}</button>
        <div class="two"><button class="btn line" id="pdf">Download PDF</button><button class="btn line" id="pr">Print</button></div>
        <a class="btn warm" href="#/biz/bill">New bill</a>
      </div>
      ${b.cancelled ? "" : '<div class="pad noprint" style="text-align:center;margin-bottom:40px"><button class="link accent" id="cx">Cancel this bill (puts items back in stock)</button></div>'}`;
    $("#back").onclick = () => U.go("#/biz");
    $("#wa").onclick = () => sendBill(b, s);
    $("#pdf").onclick = () => { if (!window.jspdf) return U.toast("PDF needs the internet once"); makeBillPdf(b, s).save(billName(b, s)); };
    $("#pr").onclick = () => window.print();
    $("#cx") && ($("#cx").onclick = () => { if (!confirm(`Cancel bill #${b.no}? Its items go back into stock.`)) return; A.cancelBill(b.id); U.toast("Bill cancelled"); receiptView(id); });
  }

  function billsView() {
    const s = A.ownerShop();
    const t = A.daySummary(s.id);
    const bills = A.billsFor(s.id);
    const time = (x) => new Date(x).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><b style="font-weight:600">Bills</b><a class="link" href="#/biz/bill">New bill</a></div>
      <div class="pad" style="margin-top:16px"><div class="eyebrow">Today</div><h1 class="title" style="margin-top:4px">${rupee(t.total)} <span class="quiet small">from ${t.bills} bill${t.bills === 1 ? "" : "s"}</span></h1></div>
      <div class="stats" style="margin-top:12px">
        <div><b>${rupee(t.by.cash)}</b><span>cash</span></div><div><b>${rupee(t.by.upi + t.by.card)}</b><span>UPI and card</span></div>
        <div><b>${rupee(t.by.khata)}</b><span>on khata (to collect)</span></div>
        <div><b>${rupee(t.profit)}</b><span>profit${t.costKnown ? "" : " (items with a cost)"}</span></div>
      </div>
      <div class="block"><div class="entries">${bills.map((b) => `<a class="entry" href="#/biz/bill/${b.id}"><div class="body"><div class="name">#${b.no} · ${rupee(b.total)}${b.cancelled ? ' <span class="pill closed">Cancelled</span>' : ""}</div>
        <div class="note">${b.units} item${b.units > 1 ? "s" : ""} · ${PAYS[b.pay]} · ${time(b.at)}</div></div><div class="aside">${ic("arrow")}</div></a>`).join("") || '<p class="quiet small" style="margin-top:12px">No bills yet. Tap “New bill” to make the first one.</p>'}</div></div>
      <div style="height:40px"></div>`;
    $("#back").onclick = () => U.go("#/biz/reports");
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
        <div class="bl"><b>${esc(m.q)}</b><span>${m.n} search${m.n > 1 ? "es" : ""}</span></div>
        <div class="bt"><i style="width:${(m.n / max) * 100}%"></i></div>
        ${m.tmpl && !s.items.find((i) => i.name === m.tmpl[0]) ? `<button class="link" data-add="${esc(m.tmpl[0])}">I stock this</button>` : ""}
      </div>`).join("")}</div></div>
      ${topList.length ? `<div class="block"><div class="eyebrow"><span>Searched in your category</span></div><div class="words">${topList.map(([q, n]) => `<span class="word">${esc(q)} · ${n}</span>`).join("")}</div></div>` : ""}
      ${missed.length ? "" : '<p class="pad quiet small">No data yet — this fills in as customers search near you.</p>'}
      <div style="height:40px"></div>`;
    $("#back").onclick = () => U.go("#/biz/reports");
    $$("[data-add]").forEach((b) => b.onclick = () => {
      const t = A.D.CATALOG[s.cat].find(([n]) => n === b.dataset.add);
      A.addItem(s.id, t, s.cat); U.toast("Added to your items — in stock"); insightsView();
    });
  }

  U.ROUTES.biz = biz;
  Object.assign(U, { makeBillPdf, sendBill });
})();
