// My Market — customer shopping: product page, bag, checkout, order tracking.
// Payments are simulated: nothing is charged and no payment details are asked for.
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
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button>${U.bagBtn()}</div>
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

      <div class="sold-by">
        <div class="eyebrow">Sold by</div>
        <a class="entry" href="#/shop/${s.id}" style="border:0;padding:8px 0 4px">${U.mono(s)}
          <div class="body"><div class="name">${esc(s.name)}</div><div class="note">${esc(m.name)} · ${U.openWord(s)}</div></div>
          <div class="aside">${U.dist(s)}</div></a>

      </div>

      <div class="pad" style="margin-top:20px;display:grid;gap:10px">
        <button class="btn" id="wa">Ask the shop on WhatsApp</button>
        <a class="btn line" href="${loc ? `#/route/${s.id}` : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}" ${loc ? "" : 'target="_blank" rel="noopener"'}>Directions</a>
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
    $("#fb-yes").onclick = () => { A.feedback(s.id, it.id, true); U.toast("Thank you — marked in stock."); U.route(); };
    $("#fb-no").onclick = () => { A.feedback(s.id, it.id, false); U.toast("Thank you — we'll let others know."); U.route(); };
    $("#wa").onclick = () => {
      const d = String(s.phone || "").replace(/\D/g, "").slice(-10);
      if (d.length !== 10) return U.toast("This shop hasn't added a WhatsApp number");
      U.openWhatsApp(d, `Hi ${s.name}, I saw ${it.name}${it.price ? ` (${rupee(it.price)})` : ""} on My Market. Is it available?`);
    };
  }

  // ---------- bag ----------
  function bagView() {
    const lines = A.bagLines();
    const byShop = {};
    for (const l of lines) (byShop[l.shop.id] = byShop[l.shop.id] || []).push(l);
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px"><h1 class="display">Your bag</h1>
        <p class="quiet small" style="margin-top:8px">${lines.length ? "Each shop is a separate order — pick up or get it delivered." : ""}</p></div>
      ${!lines.length ? `<div class="empty"><div class="serif">Nothing here yet.</div><p>Find something nearby and tap “Add”.</p><a class="btn" href="#/search" style="margin-top:10px">Search the market</a></div>` : ""}
      ${Object.values(byShop).map((ls) => {
        const s = ls[0].shop;
        const sub = ls.reduce((a, l) => a + l.qty * (l.item.price || 0), 0);
        const unpriced = ls.some((l) => !l.item.price);
        return `<div class="bag-shop">
          <div class="eyebrow" style="display:flex;justify-content:space-between"><span>${esc(s.name)}</span><span class="faint">${U.dist(s)}</span></div>
          ${ls.map((l) => `<div class="bag-line">
            <a class="thumb" href="#/item/${s.id}/${l.item.id}" style="${U.catVars(l.item.cat)}">${U.pimg(l.item)}</a>
            <div class="body"><div class="name">${esc(l.item.name)}</div><div class="note">${esc(l.item.brand)}</div>
              <div class="stepper sm"><button data-q="${l.item.id}|-1">−</button><span>${l.qty}</span><button data-q="${l.item.id}|1">+</button></div></div>
            <div class="aside">${l.item.price ? `<b>${rupee(l.item.price * l.qty)}</b>` : '<span class="faint">Price at shop</span>'}</div>
          </div>`).join("")}
          <div class="bag-foot"><span>Subtotal <b>${rupee(sub)}</b>${unpriced ? ' <span class="faint tiny">+ items priced at shop</span>' : ""}</span>
            <a class="btn auto" href="#/checkout/${s.id}">Checkout</a></div>
        </div>`;
      }).join("")}
      <div style="height:40px"></div>`;
    $("#back").onclick = () => history.back();
    $$("[data-q]").forEach((b) => b.onclick = () => {
      const [id, d] = b.dataset.q.split("|");
      const l = lines.find((x) => x.item.id === id);
      A.setQty(id, l.qty + +d); bagView();
    });
  }

  // ---------- checkout (one shop at a time) ----------
  function checkoutView([, shopId]) {
    const s = A.getShop(shopId);
    const lines = A.bagLines().filter((l) => l.shop.id === shopId);
    if (!s || !lines.length) return U.go("#/bag");
    let mode = "pickup", pay = "shop";
    const sub = lines.reduce((a, l) => a + l.qty * (l.item.price || 0), 0);
    const draw = () => {
      const fee = mode === "delivery" ? (sub >= 999 ? 0 : 39) : 0;
      const payOpts = mode === "delivery" ? [["upi", "UPI", "Pay now (demo)"], ["cod", "Cash on delivery", "Pay when it arrives"]] : [["shop", "Pay at the shop", "Cash or UPI at the counter"], ["upi", "UPI", "Pay now (demo)"]];
      if (!payOpts.find((p) => p[0] === pay)) pay = payOpts[0][0];
      U.app.innerHTML = `
        <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">Demo checkout</span></div>
        <div class="pad" style="margin-top:22px"><div class="eyebrow">${esc(s.name)}</div><h1 class="display" style="font-size:36px;margin-top:8px">Checkout</h1></div>
        <div class="block"><div class="eyebrow"><span>How do you want it?</span></div>
          <div class="choices">
            ${[["pickup", "Pick up at the shop", "Free · ready in about 30 min · " + U.dist(s)], ["delivery", "Home delivery", (sub >= 999 ? "Free" : rupee(39)) + " · about 2 hours"]].map(([k, t, d]) =>
              `<button class="choice ${mode === k ? "on" : ""}" data-mode="${k}"><b>${t}</b><span>${d}</span></button>`).join("")}
          </div>
          ${mode === "delivery" ? `<textarea class="field" id="addr" rows="2" placeholder="Delivery address" style="margin-top:12px;font-size:17px">${esc(A.store.get("addr", ""))}</textarea>` : ""}
        </div>
        <div class="block"><div class="eyebrow"><span>Payment</span></div>
          <div class="choices">${payOpts.map(([k, t, d]) => `<button class="choice ${pay === k ? "on" : ""}" data-pay="${k}"><b>${t}</b><span>${d}</span></button>`).join("")}</div>
        </div>
        <div class="block"><div class="eyebrow"><span>Summary</span></div>
          <table class="specs bill">
            ${lines.map((l) => `<tr><th>${esc(l.item.name)} × ${l.qty}</th><td>${l.item.price ? rupee(l.item.price * l.qty) : "At shop"}</td></tr>`).join("")}
            <tr><th>${mode === "delivery" ? "Delivery" : "Pickup"}</th><td>${fee ? rupee(fee) : "Free"}</td></tr>
            <tr class="total"><th>Total</th><td>${rupee(sub + fee)}</td></tr>
          </table>
        </div>
        <div class="pad" style="margin:26px 0 40px"><button class="btn warm" id="place">${pay === "upi" ? `Pay ${rupee(sub + fee)} · place order` : "Place order"}</button>
          <p class="faint tiny" style="text-align:center;margin-top:10px">Demo — no money is charged.</p></div>`;
      $("#back").onclick = () => history.back();
      $$("[data-mode]").forEach((b) => b.onclick = () => { mode = b.dataset.mode; draw(); });
      $$("[data-pay]").forEach((b) => b.onclick = () => { pay = b.dataset.pay; draw(); });
      $("#place").onclick = () => {
        let address = "";
        if (mode === "delivery") {
          address = $("#addr").value.trim();
          if (address.length < 8) { U.toast("Add a delivery address"); $("#addr").focus(); return; }
          A.store.set("addr", address);
        }
        const o = A.placeOrder({ shopId, lines, mode, pay, address });
        U.refreshBag();
        U.go(`#/order/${o.id}`);
      };
    };
    draw();
  }

  // ---------- order tracking ----------
  function orderView([, id]) {
    const paint = () => {
      const o = A.getOrder(id);
      if (!o) { U.app.innerHTML = '<div class="empty"><div class="serif">Order not found.</div></div>'; return; }
      const s = A.getShop(o.shopId);
      const steps = A.STEPS[o.mode];
      const done = o.step === steps.length - 1;
      U.app.innerHTML = `
        <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">${o.id}</span></div>
        <div class="pad" style="margin-top:22px">
          <div class="eyebrow">${o.mode === "reserve" ? "Reservation" : o.mode === "delivery" ? "Home delivery" : "Pickup order"}</div>
          <h1 class="display" style="font-size:38px;margin-top:8px">${o.cancelled ? "Cancelled" : esc(steps[o.step])}</h1>
          ${A.isOwnerShop(o.shopId) && !o.cancelled && !done ? '<p class="small" style="color:var(--terracotta)">This is your own shop — accept it from your shop dashboard.</p>' : ""}
        </div>
        ${o.mode !== "delivery" && !o.cancelled ? `<div class="code-card"><span class="eyebrow">Show this code at the shop</span><b>${o.code}</b>
          <span class="small quiet">${o.mode === "reserve" ? "Kept until " + new Date(o.at + 2 * 3600000).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : o.paid ? "Already paid — just show the code" : "Pay at the counter when you collect"}</span></div>` : ""}
        <div class="block"><ol class="timeline">
          ${steps.map((t, i) => { const h = o.history.find((x) => x.step === i);
            return `<li class="${i <= o.step && !o.cancelled ? "on" : ""}"><b>${esc(t)}</b>${h ? `<span>${new Date(h.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>` : ""}</li>`; }).join("")}
        </ol></div>
        <div class="block"><div class="eyebrow"><span>${esc(s ? s.name : "")}</span></div>
          ${o.items.map((l) => `<div class="bag-line"><span class="thumb" style="${U.catVars(l.cat)}">${l.img ? `<img src="${l.img}" alt="">` : U.art(l.cat, 40)}</span>
            <div class="body"><div class="name">${esc(l.name)}</div><div class="note">${esc(l.brand)} · × ${l.qty}</div></div>
            <div class="aside"><b>${l.price ? rupee(l.price * l.qty) : "At shop"}</b></div></div>`).join("")}
          <table class="specs bill"><tr><th>${o.mode === "delivery" ? "Delivery" : "Pickup"}</th><td>${o.fee ? rupee(o.fee) : "Free"}</td></tr>
            <tr class="total"><th>Total · ${o.paid ? "paid" : o.pay === "cod" ? "cash on delivery" : "pay at shop"}</th><td>${o.total ? rupee(o.total) : "Price at counter"}</td></tr></table>
          ${o.address ? `<p class="small quiet" style="margin-top:10px">Deliver to: ${esc(o.address)}</p>` : ""}
        </div>
        <div class="pad" style="margin:24px 0 40px;display:grid;gap:14px;justify-items:center">
          ${s ? `<a class="btn" href="#/route/${s.id}">Directions to the shop</a>` : ""}
          ${!o.cancelled && o.step === 0 ? '<button class="link accent" id="cancel">Cancel</button>' : ""}
        </div>`;
      $("#back").onclick = () => U.go("#/me");
      $("#cancel") && ($("#cancel").onclick = () => { A.cancelOrder(o.id); paint(); });
    };
    paint();
    const iv = setInterval(() => { const o = A.getOrder(id); if (o && JSON.stringify(o.history) !== U.app.dataset.h) { U.app.dataset.h = JSON.stringify(o.history); paint(); } }, 2000);
    U.addCleanup(() => clearInterval(iv));
  }

  function ordersView() {
    const os = A.getOrders();
    U.app.innerHTML = `<div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button></div>
      <div class="pad" style="margin-top:22px"><h1 class="display">Orders</h1></div>
      <div class="block">${os.length ? `<div class="entries">${os.map(U.orderEntry).join("")}</div>` : '<p class="quiet">No orders yet.</p>'}</div>`;
    $("#back").onclick = () => history.back();
  }

  Object.assign(U.ROUTES, { item: itemView, bag: bagView, checkout: checkoutView, order: orderView, orders: ordersView });
})();
