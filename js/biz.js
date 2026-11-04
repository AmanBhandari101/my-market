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
    if (sub === "site") return siteView(params);
    if (sub === "security") return securityView();
    if (sub === "inbox") return dashView();
    if (sub === "bill" && parts[2]) return receiptView(parts[2]);
    if (sub === "cart") return cartView();
    if (sub === "backup") return backupView(params);
    if (sub === "plan") return planView();
    if (sub === "admin") return adminView();
    if (sub === "bills") return billsView();
    if (sub === "insights") return insightsView();
    if (sub === "analytics") return analyticsView(params);
    return billView(); // home = the billing counter
  }

  // ---------- onboarding ----------
  function onboardView() {
    U.app.innerHTML = `
      <div class="band">
        <div class="topline"><span class="brand"><img src="icon-business.svg" alt="">My Market<small style="color:#5fd08a">Business</small></span></div>
        <div class="pad" style="margin-top:30px">
          <h1 class="display">Customers are already<br><em>looking for you.</em></h1>
          <p class="quiet" style="line-height:1.55;margin:14px 0 0">Billing, stock and sales reports for your shop — <b>2 months free, then ₹150/month</b>. People nearby can see what you have and your prices, then WhatsApp you or walk in.</p>
        </div>
      </div>
      <div class="block" id="login"><div class="eyebrow"><span>Log in to your shop</span></div>
        <form class="form" id="lf" style="margin-top:0">
          <label>Mobile number<input class="field" name="phone" inputmode="tel" autocomplete="username" placeholder="98765 43210" required></label>
          <label>6-digit PIN<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" placeholder="••••••" required></label>
          <p class="small" id="lerr" style="color:var(--out);margin:0;min-height:1em"></p>
          <button class="btn" type="submit">Log in</button>
          <button class="link" type="button" id="lhelp" style="justify-self:center">Forgot PIN or lost your phone?</button>
        </form></div>
      <div class="pad" style="margin:26px 0 14px;display:grid;gap:10px;justify-items:center">
        <span class="quiet small">New to My Market?</span>
        <a class="btn line" href="#/biz/new">Register your shop</a>
      </div>
      <p class="pad faint tiny" style="text-align:center;margin-bottom:8px">2 months free, then ₹150/month · takes about 5 minutes · your mobile number and 6-digit PIN become your login</p>
      <div class="block"><div class="perks">
        <div><span>${ic("receipt")}</span><b>Bills in seconds</b><p>Tap items, the app adds it up and sends a PDF bill on WhatsApp.</p></div>
        <div><span>${ic("box")}</span><b>Stock that updates itself</b><p>Every bill lowers stock. Scan a barcode to add an item.</p></div>
        <div><span>${ic("chart")}</span><b>Clear reports</b><p>Today, week, month — what's running low and what isn't selling.</p></div>
        <div><span>${ic("search")}</span><b>Customers find you</b><p>See what people near you search for — and stock what they want.</p></div>
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
    $("#lhelp").onclick = () => U.openSheet(`<div class="eyebrow">Can't get in?</div><div class="title">Getting back into your shop</div>
      <div class="help">
        <div><b>Lost your phone or SIM?</b><p>Your shop is safe on the server. On any phone, log in with your <b>main number</b> or your <b>backup number</b> and your PIN. Then open ☰ → <b>Login & security</b> → <b>Log out all other devices</b>, so the lost phone can't open your shop.</p></div>
        <div><b>Forgot your PIN?</b><p>Log in with your <b>backup number</b> (it has the same PIN unless you changed it). Then ☰ → <b>Login & security</b> → change your PIN.</p></div>
        <div><b>Neither works?</b><p>Contact My Market support with your shop name and GSTIN or shop documents — we'll check it's your shop and help you back in. (A reset code by WhatsApp/SMS is coming.)</p></div>
      </div>`);
  }

  function newShopView() {
    const loc = U.loc();
    let cat = "hardware";
    U.app.innerHTML = `
      <div class="topline"><button class="iconbtn" id="back" aria-label="Back">${ic("back")}</button><span class="eyebrow faint">About 2 minutes</span></div>
      <div class="pad" style="margin-top:22px"><div class="eyebrow">Add your shop</div><h1 class="title" style="margin-top:8px">Tell customers where you are.</h1></div>
      <form id="f" class="pad form">
        <label>Shop name<input class="field" name="name" required maxlength="80" placeholder="e.g. Sharma Hardware"></label>
        <label>Your name<input class="field" name="owner" required maxlength="60" placeholder="e.g. Ramesh Sharma"></label>
        <label>Mobile number <span class="faint tiny">— your login, and the shop's WhatsApp for bills</span><input class="field" name="phone" inputmode="tel" autocomplete="username" required placeholder="98765 43210"></label>
        <div class="two"><label>Create a 6-digit PIN<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required placeholder="••••••"></label>
          <label>Repeat PIN<input class="field" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required></label></div>
        <label>Backup mobile number <span class="faint tiny">— recommended: a family member or second SIM. If your phone is lost, log in with this number and the same PIN.</span><input class="field" name="backup" inputmode="tel" placeholder="98765 43211"></label>
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
      const weak = A.weakPin(f.pin, f.phone); if (weak) return err(weak);
      if (f.pin !== f.pin2) return err("The two PINs don't match");
      if (f.backup.trim() && A.normPhone(f.backup).length !== 10) return err("Backup number must be 10 digits");
      if (f.backup.trim() && A.normPhone(f.backup) === A.normPhone(f.phone)) return err("The backup number must be a different number");
      const p = pin.getLatLng();
      e.submitter && (e.submitter.disabled = true, e.submitter.textContent = "Creating your shop…");
      // pincode + locality for the address; give up after 4 s (works offline too)
      const addr = await Promise.race([U.reverseName(p.lat, p.lng), new Promise((r) => setTimeout(() => r({}), 4000))]);
      let shop;
      try {
        shop = await A.registerShop({ ...f, name: f.name.trim(), owner: f.owner.trim(), promo: f.promo.trim(), gst: f.gst.trim().toUpperCase(), cat }, { lat: p.lat, lng: p.lng }, addr, { phone: f.phone, pin: f.pin, backup: f.backup.trim() });
      } catch (x) { return err(x.message); }
      U.toast(shop.backupError ? `Shop registered — but the backup number wasn't added: ${shop.backupError}. Add it in ☰ → Login & security.` : shop.backupAdded ? "Shop registered — backup number added" : "Shop registered — you're logged in");
      U.go("#/biz/items?setup=1");
    };
  }

  let fullAt = 0;
  window.addEventListener("mm-storage-full", () => { if (Date.now() - fullAt > 60000) { fullAt = Date.now(); U.toast(A.FULL, 8000); } });

  // ---------- the shop's plan: 2 months free, then ₹150/month ----------
  // The server decides (plan_state); this phone keeps the last answer so it also
  // works offline, and works out the stage from the dates as days pass.
  const PAY = () => (window.MM_CONFIG || {}).payUpi || "";
  const DAYMS = 86400000;
  const planOf = (s) => A.store.get("plan:" + s.id, null);
  function planStage(s) {
    const p = planOf(s); if (!p || !s.cloud) return { state: "unknown" };
    // a phone set to an earlier date can't go back before the server's last known time
    const now = Math.max(Date.now(), Date.parse(p.server_now || 0) || 0, A.store.get("planClock:" + s.id, 0));
    A.store.set("planClock:" + s.id, now);
    const end = Date.parse(p.access_until), paid = Math.max(Date.parse(p.paid_until || 0) || 0, Date.parse(p.provisional_until || 0) || 0);
    const state = now < end ? (paid > now ? "active" : "trial") : now < end + 7 * DAYMS ? "due" : now < end + 15 * DAYMS ? "orders_off" : "read_only";
    return { ...p, state, end, now, daysLeft: Math.ceil((end - now) / DAYMS), daysOver: Math.floor((now - end) / DAYMS) };
  }
  // read-only only bites when payments are switched on (a UPI ID is set)
  const planLocked = (s) => !!PAY() && planStage(s).state === "read_only";
  function lockedSheet() {
    U.openSheet(`<div class="eyebrow">Plan</div><div class="title">Pay ₹150 to make new bills</div>
      <p class="small quiet">Your free months are over and the plan wasn't paid, so the app is read-only for now. Your bills and data are all safe — you can still see them, back them up and export them.</p>
      <div class="opts"><a class="btn" href="#/biz/plan">Pay ₹150 with UPI</a></div>`, (el) => $$("a", el).forEach((x) => x.addEventListener("click", () => U.closeSheet())));
  }
  let planAt = 0;
  async function refreshPlan(force) {
    const s = A.ownerShop(); if (!s || !s.cloud || !window.MM_CLOUD || !window.MM_CLOUD.myPlan || !navigator.onLine) return null;
    if (!force && Date.now() - planAt < 3 * 3600000) return planOf(s);
    try { const p = await window.MM_CLOUD.myPlan(s.id); if (p) { A.store.set("plan:" + s.id, p); planAt = Date.now(); $$("[data-planbar]").forEach((el) => { el.outerHTML = planBar(s); }); } return p; }
    catch { return null; }
  }
  if (window.MM_APP === "business") {
    setTimeout(() => refreshPlan(true), 2500); setInterval(() => refreshPlan(), 3600000);
    setTimeout(() => { const s0 = A.ownerShop(); if (s0 && s0.cloud && window.MM_CLOUD?.isAdmin) window.MM_CLOUD.isAdmin().then((y) => A.store.set("isAdmin", y)).catch(() => {}); }, 4000);
  }
  function planBar(s) {
    const st = planStage(s), fmt = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    let cls = "", msg = "";
    if (st.state === "trial" && st.daysLeft <= 10) { cls = "soon"; msg = `Free plan: ${st.daysLeft} day${st.daysLeft === 1 ? "" : "s"} left (till ${fmt(st.end)}) — then ₹150/month`; }
    else if (st.state === "active" && st.daysLeft <= 5) { cls = "soon"; msg = `Your plan ends on ${fmt(st.end)} — renew ₹150`; }
    else if (st.state === "due") { cls = "due"; msg = PAY() ? `₹150 due — pay within ${7 - st.daysOver} day${7 - st.daysOver === 1 ? "" : "s"} to keep your website and analytics on` : `Your free months are over`; }
    else if (st.state === "orders_off") { cls = "bad"; msg = `Website and analytics paused — billing stops in ${15 - st.daysOver} day${15 - st.daysOver === 1 ? "" : "s"}. Pay ₹150`; }
    else if (st.state === "read_only") { cls = "bad"; msg = PAY() ? `Read-only — pay ₹150 to make new bills (your data is safe)` : `Your free months are over`; }
    return msg ? `<a class="planbar ${cls}" href="#/biz/plan" data-planbar>${esc(msg)}${ic("arrow")}</a>` : `<span data-planbar hidden></span>`;
  }

  function planView() {
    const s = A.ownerShop();
    const upi = PAY(), name = (window.MM_CONFIG || {}).payName || "My Market";
    // the shop's payment code: goes first in the UPI note so it shows in the bank statement,
    // where the server reads it and marks the payment done (same rule as shop_pay_code on the server)
    const ref = "MM" + s.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    let months = 1, pays = null;
    const draw = () => {
      const st = planStage(s), fmt = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const amt = months === 12 ? 1500 : 150;
      const link = `upi://pay?pa=${encodeURIComponent(upi).replace("%40", "@")}&pn=${encodeURIComponent(name)}&am=${amt}&cu=INR&tn=${encodeURIComponent(`${ref} ${months === 12 ? "12M" : "1M"} MyMarket`)}`;
      const head = !s.cloud ? ["Log in to see your plan", "Your plan lives on the server with your shop."]
        : st.state === "unknown" ? ["Checking your plan…", "Needs the internet once."]
        : st.state === "trial" ? [`Free plan · ${st.daysLeft} day${st.daysLeft === 1 ? "" : "s"} left`, `Free till ${fmt(st.end)}. After that ₹150 a month — everything stays the same.`]
        : st.state === "active" ? [`Plan active till ${fmt(st.end)}`, st.provisional_until && Date.parse(st.provisional_until) > Date.now() && !(Date.parse(st.paid_until || 0) > Date.now()) ? "Your payment is being checked — usually within a day. Everything works meanwhile." : "Thank you! Everything is on."]
        : st.state === "due" ? ["₹150 due", `Your plan ended on ${fmt(st.end)}. Everything still works for ${7 - st.daysOver} more day${7 - st.daysOver === 1 ? "" : "s"}.`]
        : st.state === "orders_off" ? ["Website and analytics paused", `Your website is off and analytics stopped at ${fmt(st.end)}. Billing and stock work for ${15 - st.daysOver} more day${15 - st.daysOver === 1 ? "" : "s"}, then the app becomes read-only.`]
        : ["Read-only", "You can see all your bills, back them up and export them. Pay to make new bills again — nothing was lost."];
      U.app.innerHTML = `
        ${bizTop("My plan")}
        <div class="rsec plancard ${st.state}"><b>${esc(head[0])}</b><p>${esc(head[1])}</p></div>
        <div class="rsec"><div class="rhd"><b>Price</b></div>
          <div class="planopts">
            <button class="planopt ${months === 1 ? "on" : ""}" data-mo="1"><b>₹150</b><span>per month</span></button>
            <button class="planopt ${months === 12 ? "on" : ""}" data-mo="12"><b>₹1,500</b><span>per year · 2 months free</span></button>
          </div>
          <p class="faint tiny" style="margin:8px 0 0">Billing, stock, reports, your website with orders, WhatsApp bills, backup — all included. Your data is never deleted.</p>
        </div>
        ${upi && s.cloud ? `<div class="rsec"><div class="rhd"><b>Pay with UPI</b></div>
          <a class="btn" id="paynow" href="${esc(link)}">Pay ₹${amt.toLocaleString("en-IN")} with UPI</a>
          <p class="faint tiny" style="margin:8px 0 0">Opens PhonePe, Google Pay, Paytm or your bank app. On a computer, scan this with any UPI app:</p>
          <div id="payqr" class="qrbox small"></div>
          <label class="small quiet" style="display:block;margin-top:14px">After paying, type the <b>UPI transaction ID (UTR)</b> — 12 digits, in your UPI app's payment details
            <input class="field" id="utr" inputmode="numeric" maxlength="40" placeholder="e.g. 412345678901"></label>
          <button class="btn line" id="paid" style="margin-top:10px">I've paid ₹${amt.toLocaleString("en-IN")}</button>
          <div class="paycode"><span>Your payment code</span><b>${ref}</b><button class="link" id="copyref">Copy</button></div>
          <p class="faint tiny" style="margin:6px 0 0">It's already in the UPI note. Paying another way (bank transfer)? Write <b>${ref}</b> in the note so your payment is found automatically.</p>
        </div>` : `<div class="rsec"><p class="small quiet" style="margin:0">${s.cloud ? "Payments open soon — enjoy the free plan. We'll tell you before anything changes." : "Log in with your number to see your plan."}</p></div>`}
        <div class="rsec"><div class="rhd"><b>Payments</b></div><div id="paylist">${pays == null ? '<p class="quiet small">Loading…</p>' : pays.length ? pays.map((x) => `<div class="payrow ${x.status}">
          <span><b>${x.method === "grant" ? "Free months" : "₹" + x.amount.toLocaleString("en-IN")}</b> · ${x.months} month${x.months > 1 ? "s" : ""}<em>${fmt(x.created_at)}${x.ref ? " · " + esc(x.ref) : ""}${x.reason ? " · " + esc(x.reason) : ""}</em></span>
          <i>${{ claimed: "Checking", confirmed: "Paid ✓", rejected: "Not received" }[x.status]}</i></div>`).join("") : '<p class="quiet small">No payments yet.</p>'}</div></div>
        <div class="rsec"><div class="rhd"><b>If a payment is missed</b></div>
          <ol class="gsteps"><li>Days 1–7: everything works, with a reminder.</li><li>Days 8–15: billing and stock work; your website is switched off and analytics stop updating.</li><li>After day 15: read-only — you can still see, back up and export everything.</li></ol>
          <p class="faint tiny" style="margin:6px 0 0">Pay any time and everything turns back on at once. Nothing is ever deleted.</p></div>
        <div style="height:30px"></div>`;
      bindTop();
      $$("[data-mo]").forEach((x) => x.onclick = () => { months = +x.dataset.mo; draw(); });
      $("#copyref") && ($("#copyref").onclick = async () => { try { await navigator.clipboard.writeText(ref); U.toast("Payment code copied"); } catch { prompt("Your payment code", ref); } });
      if ($("#payqr")) makeQR(link).then((qr) => { const el = $("#payqr"); if (el) el.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); }).catch(() => { const el = $("#payqr"); el && el.remove(); });
      $("#paid") && ($("#paid").onclick = async (ev) => {
        const utr = $("#utr").value.replace(/[^A-Za-z0-9]/g, "");
        if (utr.length < 10) return U.toast("Type the UPI transaction ID (UTR) from your UPI app");
        ev.currentTarget.disabled = true;
        try { const p = await window.MM_CLOUD.claimPayment(s.id, utr, months); A.store.set("plan:" + s.id, p); U.toast("Thank you! Everything stays on while we check it", 5000); await loadPays(); draw(); }
        catch (x) { ev.currentTarget.disabled = false; U.toast(x.message, 7000); }
      });
    };
    const loadPays = async () => { try { pays = await window.MM_CLOUD.myPayments(s.id); } catch { pays = pays || []; } };
    draw();
    if (s.cloud && window.MM_CLOUD) Promise.all([refreshPlan(true), loadPays()]).then(() => { if (location.hash.startsWith("#/biz/plan")) draw(); });
  }

  // ---------- the cart (bill in progress) ----------
  // Saved on the phone for each shop, so it stays while you move between pages
  // or close the app — until the bill is generated or the cart is cleared.
  const EMPTY_CART = () => ({ lines: [], discount: 0, pay: "cash", phone: "", received: "" });
  const cartGet = (s) => A.store.get("billDraft:" + s.id, EMPTY_CART());
  const cartUnits = (c) => (c.lines || []).reduce((a, l) => a + l.qty, 0);
  function cartSet(s, c, bump) {
    A.store.set("billDraft:" + s.id, c);
    const n = cartUnits(c);
    $$("[data-cartn]").forEach((el) => { el.textContent = n; el.classList.toggle("hidden", !n); });
    if (bump) { const ic2 = $("#carticon"); if (ic2) { ic2.classList.remove("bump"); void ic2.offsetWidth; ic2.classList.add("bump"); } }
  }

  // ---------- shop-app top bar ----------
  const waiting = (s) => A.pendingAsks(s.id).length + (A.store.get("newOrders:" + s.id, 0) || 0);
  // website orders: check the server every minute; a new one rings the bell
  let lastNew = null;
  async function pollOrders() {
    const s = A.ownerShop(); if (!s || !s.cloud || !window.MM_CLOUD || !window.MM_CLOUD.shopOrders || !navigator.onLine) return null;
    try {
      const list = await window.MM_CLOUD.shopOrders(s.id);
      const n = list.filter((o) => o.status === "new").length;
      A.store.set("newOrders:" + s.id, n);
      $$("[data-bell]").forEach((el) => { const t = waiting(s); el.textContent = t; el.classList.toggle("hidden", !t); });
      if (lastNew != null && n > lastNew) {
        const o = list.find((x) => x.status === "new");
        U.toast(`New ${o && o.kind === "hold" ? "hold" : "order"} from ${o ? o.name : "a customer"} — open the bell`, 6000);
        try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch {}
      }
      lastNew = n;
      return list;
    } catch { return null; }
  }
  if (window.MM_APP === "business") { setTimeout(pollOrders, 3000); setInterval(pollOrders, 60000); }
  function bizTop(title) {
    const s = A.ownerShop(), n = waiting(s);
    return `<div class="topline"><span class="brand"><img src="icon-business.svg" alt=""><span class="bt">${esc(title || s.name)}${s.cloud ? `<em class="syncst" data-sync>${syncWord()}</em>` : ""}</span></span>
      <div class="btn-row" style="gap:2px"><a class="iconbtn bagbtn" id="carticon" href="#/biz/cart" aria-label="Cart">${ic("bag")}<i class="bcount ${cartUnits(cartGet(s)) ? "" : "hidden"}" data-cartn>${cartUnits(cartGet(s))}</i></a>
      <a class="iconbtn bagbtn" href="#/biz/inbox" aria-label="Orders and questions">${ic("bell")}<i class="bcount ${n ? "" : "hidden"}" data-bell>${n}</i></a>
      <button class="iconbtn" data-menu aria-label="Menu">${ic("menu")}</button></div></div>${planBar(s)}`;
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
        <a class="entry" href="#/biz/site"><div class="body"><div class="name">My website</div><div class="note">Your shop's page: share it, QR poster, add to Google Maps</div></div>${ic("arrow")}</a>
        ${s.cloud ? `<a class="entry" href="#/biz/security"><div class="body"><div class="name">Login & security</div><div class="note">Backup number, change PIN, log out other phones</div></div>${ic("arrow")}</a>` : ""}
        <button class="entry" id="m-bs"><div class="body"><div class="name">Bill settings</div><div class="note">Advert, phone and GSTIN on your bills</div></div>${ic("arrow")}</button>
        <a class="entry" href="index.html#/shop/${s.id}" target="_blank" rel="noopener"><div class="body"><div class="name">See my shop as customers do</div><div class="note">Opens the My Market customer app</div></div>${ic("arrow")}</a>
        ${A.store.get("isAdmin", false) ? `<a class="entry" href="#/biz/admin"><div class="body"><div class="name">Admin · payments</div><div class="note">Load a bank statement — payments are marked done by code</div></div>${ic("arrow")}</a>` : ""}
        <a class="entry" href="#/biz/plan"><div class="body"><div class="name">My plan</div><div class="note">${(() => { const st = planStage(s); return st.state === "trial" ? `Free plan · ${st.daysLeft} days left` : st.state === "active" ? "Active" : st.state === "unknown" ? "2 months free, then ₹150/month" : "Payment due"; })()}</div></div>${ic("arrow")}</a>
        <a class="entry" href="#/biz/backup"><div class="body"><div class="name">Back up bills</div><div class="note">Save a copy to Google Drive</div></div>${ic("arrow")}</a>
        <a class="entry" href="#/biz/insights"><div class="body"><div class="name">What people searched for</div><div class="note">Items nobody near you had</div></div>${ic("arrow")}</a>
      </div>
      <div class="opts"><button class="link accent" id="m-out">Log out</button></div>`, (el) => {
      $("#m-bs", el).onclick = () => billSettings(s);
      $("#m-sync", el) && ($("#m-sync", el).onclick = async () => {
        U.closeSheet(); U.toast("Syncing…");
        window.MM_CLOUD.retryFailed();
        const st = await window.MM_CLOUD.flush();
        if (st.pending) return U.toast("No internet — your changes are kept and will send later");
        if (st.failed) return U.toast(`${st.failed} change${st.failed > 1 ? "s" : ""} could not be saved: ${st.lastError || "server refused"}`, 8000);
        try { await window.MM_CLOUD.pullShop(); location.reload(); } catch (x) { U.toast(x.message); }
      });
      $("#m-out", el).onclick = () => {
        const c = window.MM_CLOUD, n = s.cloud && c ? c.pending() + c.failedOps().length : 0;
        if (n && !confirm(`${n} change${n > 1 ? "s" : ""} (bills, stock…) ${n > 1 ? "haven't" : "hasn't"} reached the server yet.\nIf you log out now they will be LOST.\n\nConnect to the internet and tap Sync now first. Log out anyway?`)) return;
        A.releaseShop(); U.closeSheet(); U.toast("Logged out"); U.go("#/biz"); };
      $$("a.entry", el).forEach((a) => a.addEventListener("click", () => U.closeSheet()));
    });
  }

  // ---------- orders & customer questions (the bell) ----------
  function dashView() {
    const draw = () => {
      const s = A.ownerShop();
      const asks = A.pendingAsks(s.id);
      const missed = A.missedSales(s);
      const views = (A.store.get("views", {})[s.id] || 0) + 40 + Math.floor((s.id.length * 7) % 60);
      const inStock = s.items.filter((i) => A.itemStatus(i).key === "confirmed").length;
      const inv = A.inventory(s);
      const today = A.daySummary(s.id);
      const sig = JSON.stringify([asks.map((a) => a.id)]);
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

        <div class="block" id="o"><div class="eyebrow"><span>Orders from your website</span></div><div id="olist"><p class="quiet small">Loading…</p></div></div>

        <div style="height:30px"></div>`;
      bindTop();
      $$("[data-yes]").forEach((b) => b.onclick = () => {
        const p = +$(`[data-price="${b.dataset.yes}"]`).value || null;
        A.replyAsk(b.dataset.yes, s.id, { has: true, price: p }); U.toast("Sent — the customer can see you have it"); U.app.dataset.sig = ""; draw();
      });
      $$("[data-no]").forEach((b) => b.onclick = () => { A.replyAsk(b.dataset.no, s.id, { has: false }); U.app.dataset.sig = ""; draw(); });
      drawOrders();
    };
    // ---- website orders (Hold it for me / Buy) ----
    let orders = null, showOld = false;
    const ago = (t) => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
    const KIND = (o) => o.kind === "hold" ? "HOLD" : o.mode === "delivery" ? "DELIVERY" : "PICKUP";
    function drawOrders() {
      const box = $("#olist"); if (!box) return;
      const s = A.ownerShop();
      if (!s.cloud) { box.innerHTML = '<p class="quiet small">Log in with your number so customers can order from your website.</p>'; return; }
      if (!orders) return;
      const open = orders.filter((o) => o.status === "new" || o.status === "ready"), old = orders.filter((o) => !(o.status === "new" || o.status === "ready"));
      const card = (o) => {
        const ph = String(o.phone || "");
        return `<div class="ocard ${o.status}">
          <div class="ohd"><span class="okind ${o.kind}">${KIND(o)}</span><b>${esc(o.code)}</b><span class="faint tiny">${ago(o.created_at)}</span>
            <span class="ost ${o.status}">${{ new: "New", ready: o.kind === "hold" ? "Kept aside" : "Ready", done: "Done", cancelled: "Cancelled" }[o.status]}</span></div>
          <div class="owho"><b>${esc(o.name)}</b> · <a href="tel:+91${esc(ph)}">${esc(ph.slice(0, 5) + " " + ph.slice(5))}</a>
            <button class="link" data-owa="${o.id}">WhatsApp</button></div>
          ${(o.lines || []).map((l) => `<div class="oline"><span>${l.qty} × ${esc(l.name)}</span><span>${l.price ? rupee(l.price * l.qty) : "price?"}</span></div>`).join("")}
          <div class="otot"><span>${o.mode === "delivery" ? "Deliver to: " + esc(o.address || "") : o.kind === "hold" && o.hold_until ? "Hold until " + new Date(o.hold_until).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Pickup at the shop"}</span><b>${rupee(o.total)}</b></div>
          ${o.note ? `<div class="onote">“${esc(o.note)}”</div>` : ""}
          ${o.status === "new" ? `<div class="oacts"><button class="btn auto" data-ost="${o.id}" data-to="ready">${o.kind === "hold" ? "Keep aside" : "Accept"}</button><button class="btn auto line" data-ost="${o.id}" data-to="cancelled">Can't do</button></div>`
            : o.status === "ready" ? `<div class="oacts"><button class="btn auto" data-obill="${o.id}">Collected · make bill</button><button class="btn auto line" data-ost="${o.id}" data-to="done">Collected</button><button class="link" data-ost="${o.id}" data-to="cancelled">Cancel</button></div>` : ""}
        </div>`;
      };
      box.innerHTML = (open.length ? open.map(card).join("") : '<p class="quiet small">No open orders. Customers can tap <b>Add</b> on your website, then <b>Hold</b> or <b>Buy</b> — the order shows up here and rings the bell.</p>')
        + (old.length ? `<button class="link" id="oold" style="margin-top:10px">${showOld ? "Hide" : "Show"} earlier orders (${old.length})</button>${showOld ? old.map(card).join("") : ""}` : "");
      $("#oold") && ($("#oold").onclick = () => { showOld = !showOld; drawOrders(); });
      const find = (id) => orders.find((x) => x.id === id);
      $$("[data-owa]", box).forEach((x) => x.onclick = () => {
        const o = find(x.dataset.owa);
        const msg = o.status === "ready" ? (o.kind === "hold" ? `Hi ${o.name}, your items are kept aside at ${s.name} (order ${o.code}). See you soon!` : o.mode === "delivery" ? `Hi ${o.name}, your order ${o.code} from ${s.name} is on its way.` : `Hi ${o.name}, your order ${o.code} is ready for pickup at ${s.name}.`)
          : `Hi ${o.name}, this is ${s.name} about your order ${o.code}.`;
        U.openWhatsApp(o.phone, msg);
      });
      $$("[data-ost]", box).forEach((x) => x.onclick = async () => {
        const o = find(x.dataset.ost), to = x.dataset.to;
        if (to === "cancelled" && !confirm(`Cancel order ${o.code} from ${o.name}?`)) return;
        x.disabled = true;
        try {
          await window.MM_CLOUD.setOrderStatus(o.id, to); o.status = to;
          U.toast(to === "ready" ? `Done — ${o.name} sees it's ${o.kind === "hold" ? "kept aside" : "accepted"}` : to === "cancelled" ? "Order cancelled" : "Marked collected");
          if (to === "ready") { const msg = o.kind === "hold" ? `Hi ${o.name}, your items are kept aside at ${s.name} (order ${o.code}).` : o.mode === "delivery" ? `Hi ${o.name}, ${s.name} accepted your order ${o.code} — we'll deliver soon.` : `Hi ${o.name}, your order ${o.code} is ready for pickup at ${s.name}.`;
            if (confirm(`Tell ${o.name} on WhatsApp?`)) U.openWhatsApp(o.phone, msg); }
          pollOrders(); drawOrders();
        } catch (e) { x.disabled = false; U.toast(e.message || "No internet — try again"); }
      });
      $$("[data-obill]", box).forEach((x) => x.onclick = async () => {
        const o = find(x.dataset.obill);
        const c = cartGet(s);
        if (c.lines.length && !confirm("Your cart already has items. Add this order to them?")) return;
        for (const l of o.lines || []) {
          const it = s.items.find((i) => i.id === l.item_id), price = (it && it.price) || l.price || 0;
          const have = c.lines.find((x2) => x2.itemId === l.item_id);
          if (have) have.qty += l.qty; else c.lines.push({ itemId: it ? it.id : null, name: l.name, brand: l.brand || "", qty: l.qty, price, cost: it ? it.cost ?? null : null });
        }
        c.phone = c.phone || o.phone; cartSet(s, c, true);
        try { await window.MM_CLOUD.setOrderStatus(o.id, "done"); } catch {}
        U.toast(`Order ${o.code} is in the cart — check prices, then Generate bill`); U.go("#/biz/cart");
      });
    }
    async function loadOrders() { const list = await pollOrders(); if (list) { orders = list; drawOrders(); } else if (!orders) { const box = $("#olist"); box && (box.innerHTML = '<p class="quiet small">Couldn\'t load orders — check your internet.</p>'); } }
    U.app.dataset.sig = "";
    draw(); loadOrders();
    const iv = setInterval(draw, 2000), iv2 = setInterval(loadOrders, 30000);
    U.addCleanup(() => { clearInterval(iv); clearInterval(iv2); });
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
          if (planLocked(s)) { U.closeSheet(); return lockedSheet(); }
          const r = b.dataset.mv, k = n() || 1;
          if (r === "out") A.moveStock(s.id, it.id, { set: 0, reason: "out" });
          else A.moveStock(s.id, it.id, { delta: r === "received" || r === "returned" ? k : -k, reason: r });
          done(A.REASONS[r]);
        });
        $("#savep", el).onclick = () => {
          const num = (id) => Math.round(+$(id, el).value.replace(/[^\d.]/g, "")), patch = {}, pr = num("#pr"), co = num("#co"), ro = num("#ro");
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
          <div class="pad" style="margin:18px 0 0;padding:0"><button class="btn line" id="allp">${ic("search")} Search all products</button></div>
          <div class="pad" style="margin:12px 0 40px;padding:0"><a class="btn" href="#/biz">Done — start billing</a></div></div>` : `
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
          <button class="btn line auto" id="addcat" style="flex:1;height:40px;font-size:13.5px">${ic("search")} Find & add products</button>
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
      $("#addcat") && ($("#addcat").onclick = () => addItemsSheet(s, "", draw));
      $("#allp") && ($("#allp").onclick = () => addItemsSheet(s, "", draw));
    };
    draw();
  }

  // ---------- scanned a code this shop doesn't know yet ----------
  // Pick the item it belongs to — the code is saved on it, so the next scan finds it.
  function linkCodeSheet(s, code, then) {
    let q = "";
    const draw = (el) => {
      const list = s.items.filter((it) => !q || `${it.name} ${it.brand}`.toLowerCase().includes(q)).slice(0, 40);
      el.innerHTML = `<div class="eyebrow">New code</div><div class="title" style="overflow-wrap:anywhere">${esc(code.length > 40 ? code.slice(0, 40) + "…" : code)}</div>
        <p class="small quiet" style="margin:4px 0 10px">Which item is this? Pick it once — next time the scan finds it straight away.</p>
        <div class="inshop">${ic("search")}<input id="lq" placeholder="Find the item" autocomplete="off" value="${esc(q)}"></div>
        <div class="entries" style="margin-top:8px;max-height:46vh;overflow:auto">${list.map((it) => `<button class="entry" data-li="${it.id}" style="width:100%;text-align:left">
          <div class="body"><div class="name">${esc(it.name)}</div><div class="note">${it.price ? rupee(it.price) : "no price yet"}${it.code ? " · has a code already" : ""}</div></div></button>`).join("") || '<p class="quiet small">No item matches.</p>'}</div>
        <div class="opts"><button class="btn line" id="lnew">+ It's a new item</button></div>`;
      const inp = $("#lq", el); inp.oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(el); const n = $("#lq", el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      $$("[data-li]", el).forEach((x) => x.onclick = () => {
        const it = s.items.find((y) => y.id === x.dataset.li);
        A.setItem(s.id, it.id, { code }); U.closeSheet(); U.toast(`Code saved on ${it.name}`); then && then(it);
      });
      $("#lnew", el).onclick = () => { U.closeSheet(); newItemSheet(s, (it) => { if (it) { A.setItem(s.id, it.id, { code }); then && then(it); } }); };
    };
    U.openSheet("", draw);
  }

  // ---------- staff: load a bank statement, payments are marked done by the shop's code ----------
  // Reads Excel / CSV statements from any bank: finds the credit, narration, date and
  // transaction-ID columns, keeps credits whose narration has a code like MM9D6E77E2.
  let xlsxLoad = null;
  const loadXLSX = () => xlsxLoad || (xlsxLoad = new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = () => res(window.XLSX); sc.onerror = () => { xlsxLoad = null; rej(new Error("Needs the internet to read Excel files")); }; document.head.appendChild(sc);
  }));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
  function statementRows(grid) {
    // find the header row: it names a narration column and a credit column
    const low = (x) => String(x ?? "").toLowerCase().trim();
    let h = -1, col = {};
    for (let i = 0; i < Math.min(grid.length, 60); i++) {
      const r = grid[i].map(low);
      const find = (re, not) => r.findIndex((x) => re.test(x) && !(not && not.test(x)));
      const narr = find(/narration|description|particular|remark|details|transaction details/);
      const cr = find(/credit|deposit|cr amount|amount \(cr\)|^cr$/, /debit/);
      if (narr >= 0 && cr >= 0) { h = i; col = { narr, cr, dt: find(/date/), ref: find(/ref|utr|chq|cheque/), amt: -1 }; break; }
      const amt = find(/^amount|txn amount|transaction amount/), type = find(/type|dr\s*\/\s*cr|cr\s*\/\s*dr/);
      if (narr >= 0 && amt >= 0 && type >= 0) { h = i; col = { narr, cr: -1, amt, type, dt: find(/date/), ref: find(/ref|utr|chq|cheque/) }; break; }
    }
    if (h < 0) return null;
    const out = [];
    for (const r of grid.slice(h + 1)) {
      const narration = String(r[col.narr] ?? "").trim(); if (!narration) continue;
      let amount = col.cr >= 0 ? num(r[col.cr]) : (/cr|credit/i.test(String(r[col.type] ?? "")) ? num(r[col.amt]) : 0);
      if (!(amount > 0)) continue;
      const refCell = col.ref >= 0 ? String(r[col.ref] ?? "").replace(/\D/g, "") : "";
      // UPI transaction IDs are 12 digits; banks may pad the reference column with zeros
      const inNarr = (narration.match(/(?:^|\D)(\d{12})(?:\D|$)/) || [])[1] || "";
      const fromRef = refCell.replace(/^0+/, "");
      const utr = inNarr || (/^0{2,}/.test(refCell) && fromRef.length <= 12 ? fromRef : refCell);
      const dtRaw = col.dt >= 0 ? r[col.dt] : "";
      let at = ""; if (dtRaw instanceof Date) at = dtRaw.toISOString();
      else if (dtRaw) { const m = String(dtRaw).match(/(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-z]{3})[\/\-. ](\d{2,4})/); if (m) { const mon = isNaN(+m[2]) ? "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2].slice(0, 3)) / 3 : +m[2] - 1; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(y, mon, +m[1], 12); if (!isNaN(d)) at = d.toISOString(); } }
      out.push({ utr, amount, narration, at, code: (narration.toUpperCase().match(/MM[0-9A-F]{8}/) || [""])[0] });
    }
    return out;
  }
  function adminView() {
    const s = A.ownerShop();
    let rows = null, results = null, busy = false, fileName = "";
    const draw = () => {
      const withCode = rows ? rows.filter((r) => r.code && r.utr) : [];
      const counts = results ? results.reduce((m2, r) => (m2[r.result] = (m2[r.result] || 0) + 1, m2), {}) : null;
      U.app.innerHTML = `
        ${bizTop("Admin · payments")}
        <div class="rsec"><p class="small" style="margin:0 0 8px">Load your bank statement (Excel or CSV from net banking). Every credit whose note has a shop's payment code, like <b>MM9D6E77E2</b>, is marked paid and that shop's plan is extended — ₹150 = 1 month, ₹1,500 = 1 year. Loading the same statement twice is safe.</p>
          <label class="btn line" style="display:block;text-align:center;cursor:pointer">${ic("receipt")} Choose statement file<input type="file" id="stf" accept=".csv,.xls,.xlsx,text/csv" hidden></label>
          ${fileName ? `<p class="faint tiny" style="margin:6px 0 0">${esc(fileName)}</p>` : ""}</div>
        ${rows ? `<div class="rsec"><div class="rhd"><b>${withCode.length} payment${withCode.length === 1 ? "" : "s"} with a shop code</b><span class="faint tiny">${rows.length} credits in the file</span></div>
          ${withCode.slice(0, 50).map((r) => `<div class="an-li"><span><b>${esc(r.code)}</b><em>${esc(r.narration.slice(0, 70))}${r.at ? " · " + new Date(r.at).toLocaleDateString("en-IN") : ""}</em></span><b>₹${r.amount.toLocaleString("en-IN")}</b></div>`).join("") || '<p class="quiet small">No line in this file has a shop code. Check that the bank statement shows the UPI note.</p>'}
          ${withCode.length && !results ? `<button class="btn" id="mark" style="margin-top:12px">${busy ? "Marking…" : `Mark ${withCode.length} payment${withCode.length === 1 ? "" : "s"} done`}</button>` : ""}</div>` : ""}
        ${results ? `<div class="rsec"><div class="rhd"><b>Done</b></div>
          <div class="an-kpis three"><div><em>Marked paid</em><b>${counts.matched || 0}</b></div><div><em>Already done before</em><b>${counts.already_done || 0}</b></div><div><em>Need a look</em><b>${(counts.unknown_shop || 0) + (counts.too_small || 0) + (counts.error || 0)}</b></div></div>
          ${results.filter((r) => !["matched", "already_done"].includes(r.result)).map((r) => `<div class="an-li"><span>${esc(r.code || r.utr || "")}<em>${{ unknown_shop: "No shop has this code", too_small: "Amount under ₹150", no_code: "No code", error: esc(r.error || "Error") }[r.result] || esc(r.result)}</em></span></div>`).join("")}</div>` : ""}
        <div style="height:30px"></div>`;
      bindTop();
      $("#stf").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return; fileName = f.name; results = null;
        try {
          let grid;
          if (/\.csv$/i.test(f.name) || f.type === "text/csv") {
            const text = await f.text();
            grid = text.split(/\r?\n/).map((line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; });
          } else {
            const X = await loadXLSX(); const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
            grid = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
          }
          rows = statementRows(grid);
          if (!rows) { rows = null; U.toast("Couldn't find the narration and credit columns in this file", 6000); }
        } catch (x) { U.toast(x.message || "Couldn't read this file", 6000); }
        draw();
      };
      $("#mark") && ($("#mark").onclick = async () => {
        if (busy) return; busy = true; draw();
        try { results = await window.MM_CLOUD.importStatement(withCode.map(({ utr, amount, narration, at }) => ({ utr, amount, narration, at }))); }
        catch (x) { U.toast(x.message, 7000); }
        busy = false; draw();
      });
    };
    if (!A.store.get("isAdmin", false)) { U.app.innerHTML = `${bizTop("Admin")}<div class="rsec"><p class="small quiet">This page is only for My Market staff numbers.</p></div>`; bindTop(); return; }
    draw();
  }

  // ---------- shop analytics ----------
  // Standard retail measures, worked out on the phone from the shop's own bills,
  // items and purchases — each with a plain "what to do".
  function analyticsView(params) {
    const s = A.ownerShop();
    const DAY = 86400000, stage = planStage(s);
    // overdue past day 7: analytics stay as they were on the day the plan ended
    const frozen = !!PAY() && (stage.state === "orders_off" || stage.state === "read_only");
    const now = frozen ? stage.end : Date.now();
    const span = [7, 30, 90].includes(+params.get("p")) ? +params.get("p") : 30;
    const from = now - span * DAY, prevFrom = from - span * DAY;
    const all = A.billsFor(s.id).filter((x) => !x.cancelled && x.at < now);
    const bills = all.filter((x) => x.at >= from), prev = all.filter((x) => x.at >= prevFrom && x.at < from);
    const cancelled = A.billsFor(s.id).filter((x) => x.cancelled && x.at >= from).length;
    const itemOf = (id) => s.items.find((i) => i.id === id);
    const pct = (a, b2) => (b2 ? Math.round((a / b2) * 100) : 0);
    const delta = (a, b2) => (b2 ? Math.round(((a - b2) / b2) * 100) : null);
    const dChip = (d) => d == null ? "" : `<i class="an-d ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}%</i>`;
    const fmtD = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    // ---- the basics ----
    const sumOf = (list) => {
      let sales = 0, units = 0, disc = 0, cost = 0, costSales = 0;
      for (const x of list) { sales += x.total; units += x.units; disc += x.discount || 0;
        for (const l of x.lines) if (l.cost != null) { cost += l.cost * l.qty; costSales += l.price * l.qty; } }
      return { sales, units, disc, n: list.length, atv: list.length ? sales / list.length : 0, upb: list.length ? units / list.length : 0,
        profit: costSales - cost - disc * (costSales / Math.max(1, sales + disc)), margin: costSales ? ((costSales - cost) / costSales) * 100 : null, costShare: sales ? costSales / (sales + disc) : 0 };
    };
    const K = sumOf(bills), P = sumOf(prev);

    // ---- per item ----
    const per = {};
    for (const x of bills) for (const l of x.lines) {
      const k = l.itemId || "x:" + l.name.toLowerCase();
      const r = per[k] || (per[k] = { name: l.name, itemId: l.itemId, qty: 0, sales: 0, profit: 0, costKnown: true, below: false, bills: 0, last: 0 });
      r.qty += l.qty; r.sales += l.qty * l.price; r.bills++; r.last = Math.max(r.last, x.at);
      if (l.cost == null) r.costKnown = false; else { r.profit += (l.price - l.cost) * l.qty; if (l.price < l.cost) r.below = true; }
    }
    const rowsBySales = Object.values(per).sort((p, q) => q.sales - p.sales);
    // 80/20: the few items that bring most of the money
    let run = 0; const totalItemSales = rowsBySales.reduce((a2, r) => a2 + r.sales, 0);
    const aItems = []; for (const r of rowsBySales) { if (run >= totalItemSales * 0.8) break; run += r.sales; aItems.push(r); }
    const aShare = rowsBySales.length ? pct(aItems.length, rowsBySales.length) : 0;
    const topProfit = Object.values(per).filter((r) => r.costKnown && r.profit > 0).sort((p, q) => q.profit - p.profit).slice(0, 5);
    const lowMargin = Object.values(per).filter((r) => r.costKnown && r.sales > 0 && r.profit / r.sales < 0.08).sort((p, q) => p.profit / p.sales - q.profit / q.sales).slice(0, 5);
    const belowCost = Object.values(per).filter((r) => r.below);

    // ---- when people buy ----
    const hours = Array(24).fill(0), wdays = Array(7).fill(0), wdaysN = Array(7).fill(0);
    for (const x of bills) { const d = new Date(x.at); hours[d.getHours()] += x.total; wdays[(d.getDay() + 6) % 7] += x.total; }
    for (let t = from; t < now; t += DAY) wdaysN[(new Date(t).getDay() + 6) % 7]++;
    const wAvg = wdays.map((v, i) => (wdaysN[i] ? v / wdaysN[i] : 0));
    const open0 = Math.max(0, Math.min(23, s.open ?? 9)), close0 = Math.max(open0 + 1, Math.min(24, s.close ?? 21));
    const hrs = hours.slice(open0, close0), hMax = Math.max(1, ...hrs);
    const peakH = hours.indexOf(Math.max(...hours)), quietH = hrs.length ? open0 + hrs.indexOf(Math.min(...hrs)) : null;
    const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], wMax = Math.max(1, ...wAvg);
    const bestWd = wAvg.indexOf(Math.max(...wAvg)), worstWd = wAvg.indexOf(Math.min(...wAvg.map((v, i) => (wdaysN[i] ? v : Infinity))));
    const hLabel = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

    // ---- stock: days left, reorder, money stuck, stock-outs ----
    const sold30 = {}, lastSold = {};
    for (const x of all) for (const l of x.lines) if (l.itemId) {
      if (x.at >= now - 30 * DAY) sold30[l.itemId] = (sold30[l.itemId] || 0) + l.qty;
      lastSold[l.itemId] = Math.max(lastSold[l.itemId] || 0, x.at);
    }
    const tracked = s.items.filter((i) => i.qty != null);
    const reorder = tracked.map((i) => { const rate = (sold30[i.id] || 0) / 30; return { it: i, rate, days: rate ? i.qty / rate : Infinity, need: Math.max(0, Math.ceil(rate * 14 - i.qty)) }; })
      .filter((r) => r.rate > 0 && r.days <= 7).sort((p, q) => p.days - q.days).slice(0, 8);
    const outSelling = tracked.filter((i) => i.qty === 0 && (sold30[i.id] || 0) > 0)
      .map((i) => ({ it: i, perDay: ((sold30[i.id] || 0) / 30) * (i.price || 0), since: i.stockAt || now })).sort((p, q) => q.perDay - p.perDay);
    const lostPerDay = outSelling.reduce((a2, r) => a2 + r.perDay, 0);
    const stockValue = tracked.reduce((a2, i) => a2 + i.qty * (i.cost || 0), 0);
    const costedStock = tracked.filter((i) => i.cost).length;
    const cogs30 = all.filter((x) => x.at >= now - 30 * DAY).reduce((a2, x) => a2 + x.lines.reduce((c2, l) => c2 + (l.cost || 0) * l.qty, 0), 0);
    const daysOfStock = cogs30 ? Math.round(stockValue / (cogs30 / 30)) : null;
    const stuck = tracked.filter((i) => i.qty > 0 && (now - (lastSold[i.id] || i.addedAt || now)) > 45 * DAY).reduce((a2, i) => a2 + i.qty * (i.cost || i.price || 0), 0);

    // ---- customers (bills with a phone number) ----
    const cust = {};
    for (const x of all) { const ph = A.normPhone(x.phone); if (ph.length !== 10) continue;
      const c2 = cust[ph] || (cust[ph] = { ph, n: 0, spend: 0, last: 0, first: x.at, recent: 0 });
      c2.n++; c2.spend += x.total; c2.last = Math.max(c2.last, x.at); c2.first = Math.min(c2.first, x.at); if (x.at >= from) c2.recent += x.total; }
    const custs = Object.values(cust), withPhone = bills.filter((x) => A.normPhone(x.phone).length === 10).length;
    const active = custs.filter((c2) => c2.last >= from), repeat = active.filter((c2) => c2.n > 1);
    const topCust = custs.filter((c2) => c2.recent > 0).sort((p, q) => q.recent - p.recent).slice(0, 5);
    const lapsed = custs.filter((c2) => c2.n >= 2 && now - c2.last > 30 * DAY && now - c2.last < 120 * DAY).sort((p, q) => q.spend - p.spend).slice(0, 6);

    // ---- money: payment mix, khata, buying vs selling ----
    const mix = { cash: 0, upi: 0, card: 0, khata: 0 }; for (const x of bills) mix[x.pay] = (mix[x.pay] || 0) + x.total;
    const khataBills = bills.filter((x) => x.pay === "khata");
    const bought = A.purchasesFor(s.id).filter((p2) => p2.at >= from).reduce((a2, p2) => a2 + (p2.total || 0), 0);

    // ---- next 7 days: same weekday, last 4 weeks ----
    let fc = 0; const fcDays = [];
    for (let i = 1; i <= 7; i++) {
      const day = new Date(now + i * DAY); day.setHours(0, 0, 0, 0);
      let t = 0, n = 0; for (let w = 1; w <= 4; w++) { const d0 = day.getTime() - w * 7 * DAY; t += all.filter((x) => x.at >= d0 && x.at < d0 + DAY).reduce((a2, x) => a2 + x.total, 0); n++; }
      const v = t / n; fc += v; fcDays.push({ d: day, v });
    }
    const fcMax = Math.max(1, ...fcDays.map((x) => x.v));

    const tip = (t) => `<p class="an-tip">💡 ${t}</p>`;
    const none = (t) => `<p class="quiet small" style="margin:6px 0 0">${t}</p>`;
    const barRow = (label, v, max, sub) => `<div class="an-bar"><span>${esc(label)}</span><div><i style="width:${Math.max(2, (v / max) * 100)}%"></i></div><b>${sub}</b></div>`;

    U.app.innerHTML = `
      ${bizTop("Shop analytics")}
      ${frozen ? `<a class="planbar bad" href="#/biz/plan">Analytics are frozen at ${new Date(now).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — pay ₹150 to see the latest${ic("arrow")}</a>` : ""}
      <div class="pad an-period"><div class="words">${[7, 30, 90].map((k) => `<a class="word ${span === k ? "on" : ""}" href="#/biz/analytics?p=${k}">Last ${k} days</a>`).join("")}</div></div>
      ${!bills.length ? `<div class="rsec">${none("No bills in this period yet. Analytics fill in as you bill — even a week of bills shows your best times and top sellers.")}</div>` : `

      <div class="rsec"><div class="rhd"><b>The basics</b><span class="faint tiny">vs the ${span} days before</span></div>
        <div class="an-kpis">
          <div><em>Sales</em><b>${rupee(K.sales)}</b>${dChip(delta(K.sales, P.sales))}</div>
          <div><em>Bills</em><b>${K.n}</b>${dChip(delta(K.n, P.n))}</div>
          <div><em>Average bill</em><b>${rupee(Math.round(K.atv))}</b>${dChip(delta(K.atv, P.atv))}</div>
          <div><em>Items per bill</em><b>${K.upb.toFixed(1)}</b>${dChip(delta(K.upb, P.upb))}</div>
          <div><em>Profit margin</em><b>${K.margin == null ? "—" : Math.round(K.margin) + "%"}</b>${K.margin == null ? '<i class="an-d">add cost prices</i>' : ""}</div>
          <div><em>Discounts given</em><b>${rupee(K.disc)}</b>${K.sales ? `<i class="an-d">${K.disc && pct(K.disc, K.sales + K.disc) < 1 ? "under 1" : pct(K.disc, K.sales + K.disc)}% of sales</i>` : ""}</div>
        </div>
        ${K.upb < 2 ? tip("Most customers buy just one thing. Keep small add-ons (tape, batteries, sachets) near the counter and suggest one with every bill — it raises the average bill.") : tip(`Each customer buys ${K.upb.toFixed(1)} items on average. Suggesting one matching item at the counter can lift your average bill above ${rupee(Math.round(K.atv * 1.15))}.`)}
        ${cancelled ? `<p class="faint tiny" style="margin:6px 0 0">${cancelled} cancelled bill${cancelled > 1 ? "s" : ""} in this period.</p>` : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Busiest times</b></div>
        <div class="an-hours">${hrs.map((v, i) => `<div title="${hLabel(open0 + i)} · ${rupee(v)}"><i style="height:${Math.max(3, (v / hMax) * 100)}%" class="${open0 + i === peakH ? "pk" : ""}"></i><span>${(open0 + i) % 3 === 0 ? hLabel(open0 + i) : ""}</span></div>`).join("")}</div>
        <div class="an-wd">${WD.map((d, i) => barRow(d, wAvg[i], wMax, rupee(Math.round(wAvg[i])))).join("")}</div>
        ${tip(`Your rush hour is <b>${hLabel(peakH)}–${hLabel((peakH + 1) % 24)}</b> and your best day is <b>${WD[bestWd]}</b>${quietH != null ? `; ${hLabel(quietH)} is quietest — use it to restock, count and clean` : ""}. ${worstWd !== bestWd && wdaysN[worstWd] ? `${WD[worstWd]} is slowest: try an offer on WhatsApp that morning.` : ""}`)}
      </div>

      <div class="rsec"><div class="rhd"><b>Your top sellers</b><span class="faint tiny">80/20 rule</span></div>
        ${rowsBySales.slice(0, 8).map((r) => barRow(r.name, r.sales, rowsBySales[0].sales, `${rupee(r.sales)} · ${r.qty} sold`)).join("")}
        ${rowsBySales.length >= 5 ? tip(`<b>${aItems.length} item${aItems.length > 1 ? "s" : ""}</b> (${aShare}% of what you sell) bring <b>80% of your sales</b>. Never let these run out — keep extra stock of them and check them every morning.`) : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Profit</b><span class="faint tiny">items with a cost price</span></div>
        ${topProfit.length ? `<div class="an-sub">Earn you the most</div>${topProfit.map((r) => barRow(r.name, r.profit, topProfit[0].profit, `${rupee(Math.round(r.profit))} · ${Math.round((r.profit / r.sales) * 100)}%`)).join("")}` : none("Add cost prices to your items (Stock → item → cost) to see profit per item.")}
        ${lowMargin.length ? `<div class="an-sub">Thin margin (under 8%)</div>${lowMargin.map((r) => `<div class="an-li"><span>${esc(r.name)}</span><b>${Math.round((r.profit / r.sales) * 100)}%</b></div>`).join("")}${tip("Check these prices: a small increase, or a cheaper supplier, adds straight to your profit.")}` : ""}
        ${belowCost.length ? `<div class="an-warn">⚠ Sold <b>below cost</b>: ${belowCost.map((r) => esc(r.name)).join(", ")}. Check the price or the cost you entered.</div>` : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Order soon</b><span class="faint tiny">at the speed they sell</span></div>
        ${reorder.length ? reorder.map((r) => `<div class="an-li"><span>${esc(r.it.name)}<em>${r.it.qty} left · sells ${r.rate >= 1 ? Math.round(r.rate) : r.rate.toFixed(1)}/day</em></span><b class="${r.days < 3 ? "bad" : ""}">${r.days < 1 ? "today" : Math.floor(r.days) === 1 ? "1 day" : Math.floor(r.days) + " days"}</b><i class="an-need">order ${r.need || 1}</i></div>`).join("") + tip("“Order” = enough for the next 2 weeks at your current speed.") : none("Nothing will run out in the next 7 days at the current speed.")}
        ${outSelling.length ? `<div class="an-warn">⚠ Out of stock but selling: ${outSelling.slice(0, 5).map((r) => esc(r.it.name)).join(", ")} — about <b>${rupee(Math.round(lostPerDay))} of sales lost every day</b>.</div>` : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Money in your stock</b></div>
        <div class="an-kpis three">
          <div><em>Stock value (at cost)</em><b>${rupee(Math.round(stockValue))}</b>${costedStock < tracked.length ? `<i class="an-d">${tracked.length - costedStock} items have no cost</i>` : ""}</div>
          <div><em>Days of stock</em><b>${daysOfStock == null ? "—" : daysOfStock}</b><i class="an-d">at last 30 days' speed</i></div>
          <div><em>Stuck 45+ days</em><b>${rupee(Math.round(stuck))}</b><i class="an-d">not sold</i></div>
        </div>
        ${daysOfStock != null && daysOfStock > 60 ? tip(`You hold about ${daysOfStock} days of stock — money sitting on shelves. Buy smaller amounts more often, and put the slow items on offer.`) : stuck > 0 ? tip("Put the items that haven't sold in 45+ days on a small offer, or bundle them with a top seller, to turn them back into cash.") : ""}
        ${bought ? `<div class="an-li"><span>Stock bought in this period</span><b>${rupee(bought)}</b></div><div class="an-li"><span>Sales in this period</span><b>${rupee(K.sales)}</b></div>` : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Customers</b><span class="faint tiny">bills with a phone number</span></div>
        ${custs.length ? `<div class="an-kpis three">
          <div><em>Customers</em><b>${active.length}</b><i class="an-d">${pct(withPhone, bills.length)}% of bills have a number</i></div>
          <div><em>Came back</em><b>${pct(repeat.length, active.length)}%</b><i class="an-d">${repeat.length} repeat</i></div>
          <div><em>Avg per customer</em><b>${active.length ? rupee(Math.round(active.reduce((a2, c2) => a2 + c2.recent, 0) / active.length)) : "—"}</b></div>
        </div>
        ${topCust.length ? `<div class="an-sub">Best customers</div>${topCust.map((c2) => `<div class="an-li"><span>+91 ${c2.ph.slice(0, 5)} ${c2.ph.slice(5)}<em>${c2.n} bill${c2.n > 1 ? "s" : ""} · since ${fmtD(c2.first)}</em></span><b>${rupee(c2.recent)}</b></div>`).join("")}` : ""}
        ${lapsed.length ? `<div class="an-sub">Haven't come in 30+ days</div>${lapsed.map((c2) => `<div class="an-li"><span>+91 ${c2.ph.slice(0, 5)} ${c2.ph.slice(5)}<em>last ${fmtD(c2.last)} · spent ${rupee(c2.spend)}</em></span><button class="link" data-wb="${c2.ph}">WhatsApp</button></div>`).join("")}${tip("A friendly message (“new stock arrived”) brings regulars back.")}` : ""}
        ${pct(withPhone, bills.length) < 40 ? tip("Add the customer's WhatsApp number to more bills — you'll know your regulars and can bring them back.") : ""}`
        : none("Add customers' WhatsApp numbers to bills to see your regulars, who came back, and who stopped coming.")}
      </div>

      <div class="rsec"><div class="rhd"><b>How customers pay</b></div>
        ${Object.entries(mix).filter(([, v]) => v > 0).map(([k, v]) => barRow(PAYS[k], v, Math.max(...Object.values(mix)), `${rupee(v)} · ${pct(v, K.sales)}%`)).join("")}
        ${khataBills.length ? tip(`${khataBills.length} khata bill${khataBills.length > 1 ? "s" : ""} worth ${rupee(khataBills.reduce((a2, x) => a2 + x.total, 0))} in this period — remember to collect.`) : ""}
      </div>

      <div class="rsec"><div class="rhd"><b>Next 7 days</b><span class="faint tiny">estimate</span></div>
        ${fc > 0 ? `<div class="an-fc">${fcDays.map((x) => `<div><i style="height:${Math.max(3, (x.v / fcMax) * 100)}%"></i><span>${x.d.toLocaleDateString("en-IN", { weekday: "short" })}</span></div>`).join("")}</div>
          <p class="small" style="margin:8px 0 0">About <b>${rupee(Math.round(fc))}</b> in sales expected — based on the same weekdays over the last 4 weeks.</p>` : none("Needs a few weeks of bills to estimate.")}
      </div>`}
      <div style="height:30px"></div>`;
    bindTop();
    $$("[data-wb]").forEach((x) => x.onclick = () => U.openWhatsApp(x.dataset.wb, `Namaste! ${s.name} here — new stock has arrived. Visit us soon, or see what's in stock: ${siteLink(s, "share")}`));
  }

  // ---------- find & add products: built-in list + shared catalogue + online ----------
  function addItemsSheet(s, q0 = "", after) {
    let q = q0, shared = [], online = null, offBusy = false, timer = null, seq = 0;
    const added = new Set();
    const have = (name) => s.items.some((i) => i.name.toLowerCase() === String(name).toLowerCase()) || added.has(String(name).toLowerCase());
    const photoUrl = (pp) => window.MM_CLOUD?.photoUrl(pp);
    const row = (key, img, name, sub, cat) => `<button class="entry pick-row ${have(name) ? "on" : ""}" data-k="${esc(key)}" style="width:100%;text-align:left">
        <span class="thumb" style="${U.catVars(cat || s.cat)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : U.art(cat || s.cat, 28)}</span>
        <div class="body"><div class="name">${esc(name)}</div><div class="note">${esc(sub)}</div></div>
        <span class="pick-add">${have(name) ? ic("check") : ic("plus")}</span></button>`;
    const draw = (el) => {
      const local = q ? A.catalogSearch(q, s.cat) : A.catalogFor(s.cat).map((x) => ({ ...x, cat: s.cat }));
      const sharedNew = shared.filter((p) => !local.some((l) => l.name.toLowerCase() === p.name.toLowerCase()));
      const box = $("#pres", el);
      box.innerHTML = `
        ${local.length ? `<div class="eyebrow" style="margin-top:6px">${q ? "From the My Market list" : "Popular in " + esc(C[s.cat].name)}</div>${local.map((x, i) => row("l" + i, x.img, x.name, `${x.brand !== "Generic" ? x.brand + " · " : ""}${C[x.cat]?.name || ""}`, x.cat)).join("")}` : ""}
        ${sharedNew.length ? `<div class="eyebrow" style="margin-top:14px">Added by shops on My Market</div>${sharedNew.map((p, i) => row("s" + i, p.photo_path ? photoUrl(p.photo_path) : p.photo_url, p.name, [p.brand, p.size, C[p.cat]?.name].filter(Boolean).join(" · "), p.cat)).join("")}` : ""}
        ${online && online.length ? `<div class="eyebrow" style="margin-top:14px">Online product databases</div>${online.map((p, i) => row("o" + i, p.img, p.name, [p.brand, p.size, p.label].filter(Boolean).join(" · "), p.cat || s.cat)).join("")}` : ""}
        ${q ? `<div class="pick-more">
          ${online == null ? `<button class="btn line" id="ponl">${ic("search")} Search online for “${esc(q)}”</button>` : online.length ? "" : offBusy ? `<p class="quiet small" style="margin:0 0 8px">Online search is busy — try again in a minute.</p><button class="btn line" id="ponl">Try again</button>` : `<p class="quiet small" style="margin:0 0 8px">Nothing online for “${esc(q)}”.</p>`}
          <button class="btn" id="pnew">+ Add “${esc(q)}” as a new item</button></div>` : `<p class="faint tiny" style="margin:12px 0 0">Type to search every product — or scan a barcode in New item.</p>`}`;
      const L = local, S = sharedNew, O = online || [];
      $$("[data-k]", box).forEach((x) => x.onclick = async () => {
        const k = x.dataset.k, i = +k.slice(1);
        if (x.classList.contains("on")) return;
        x.classList.add("on"); x.querySelector(".pick-add").innerHTML = ic("check");
        try {
          if (k[0] === "l") { const it = L[i]; A.addItem(s.id, it.tmpl, it.cat); added.add(it.name.toLowerCase()); }
          else if (k[0] === "s") {
            const p = S[i];
            A.addOwnItem(s.id, { name: p.name, brand: p.brand || "", cat: p.cat || s.cat, price: null, details: A.productDetails(p, photoUrl, s.id) });
            added.add(p.name.toLowerCase());
          } else {
            const p = O[i];
            // the same barcode may already be in the shared catalogue: link to it
            const hit = window.MM_CLOUD ? await window.MM_CLOUD.lookupBarcode(p.code).catch(() => null) : null;
            const det = hit && hit.source === "catalog" ? A.productDetails(hit.product, photoUrl, s.id)
              : { barcode: p.code, size: p.size, productPhoto: p.photo, photoCredit: p.photo ? `Photo: ${p.label} contributors (CC BY-SA)` : "", source: "openfoodfacts" };
            A.addOwnItem(s.id, { name: p.name, brand: p.brand || "", cat: p.cat || s.cat, price: null, details: det });
            added.add(p.name.toLowerCase());
          }
          U.toast("Added — set its price in Stock (or when you first bill it)");
        } catch (e) { x.classList.remove("on"); U.toast(e.message || "Couldn't add"); }
      });
      $("#ponl", box) && ($("#ponl", box).onclick = async (ev) => {
        if (!window.MM_CLOUD) return U.toast("Needs the internet");
        ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Searching online…";
        try { online = await window.MM_CLOUD.searchOnline(q); offBusy = false; } catch { online = []; offBusy = true; }
        draw(el);
      });
      $("#pnew", box) && ($("#pnew", box).onclick = () => { U.closeSheet(); newItemSheet(s, (it) => { after && after(it); }, q); });
    };
    U.openSheet(`<div class="eyebrow">Stock</div><div class="title">Find & add products</div>
      <div class="inshop" style="margin-top:10px">${ic("search")}<input id="pq" placeholder="e.g. hammer, LED bulb 9W, atta" autocomplete="off" value="${esc(q)}"></div>
      <div id="pres" class="pick-list"></div>
      <div class="opts" style="margin-top:14px"><button class="link" id="pdone">Done</button></div>`, (el) => {
      el.classList.add("pick-sheet");
      draw(el);
      const run = async () => {
        const my = ++seq; shared = []; online = null;
        if (q && window.MM_CLOUD && window.MM_CLOUD.searchCatalog) { try { const r = await window.MM_CLOUD.searchCatalog(q); if (my === seq) shared = r; } catch {} }
        if (my === seq) draw(el);
      };
      $("#pq", el).oninput = (e) => { q = e.target.value.trim(); clearTimeout(timer); draw(el); timer = setTimeout(run, 350); };
      $("#pdone", el).onclick = () => { U.closeSheet(); after && after(); };
      if (q) run();
      setTimeout(() => $("#pq", el)?.focus(), 50);
    });
    U.addCleanup(() => $("#sheet")?.classList.remove("pick-sheet"));
  }

  // ---------- billing: tap items, set quantity, the app does the maths ----------
  const PAYS = { cash: "Cash", upi: "UPI", card: "Card", khata: "Khata (pay later)" };
  function billView() {
    const s = A.ownerShop();
    // The bill in progress survives leaving the screen (kept on this device).
    let cart = cartGet(s);
    const keep = (bump) => cartSet(s, cart, bump);
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
      cart.lines = cart.lines.filter((x) => x.qty > 0); keep(n > 0); paint();
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
        <div class="form"><label>What is it? <span class="faint tiny">(optional)</span><input class="field" id="on" maxlength="120" placeholder="e.g. Repair charge"></label>
        <div class="two"><label>Price ₹<input class="field" id="op" inputmode="numeric"></label><label>Quantity<input class="field" id="oq" inputmode="numeric" value="1"></label></div>
        <button class="btn" id="ook" type="button">Add to bill</button></div>`, (el) => {
        setTimeout(() => $("#op", el).focus(), 50);
        $("#ook", el).onclick = () => {
          const p = Math.round(+$("#op", el).value), n = Math.max(1, Math.round(+$("#oq", el).value || 1));
          if (!(p > 0)) return U.toast("Type the price");
          cart.lines.push({ itemId: null, key: "x" + Date.now(), name: $("#on", el).value.trim() || "Other item", qty: n, price: p, cost: null });
          keep(true); U.closeSheet(); paint();
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
      $("#bsum").innerHTML = t.units ? `<span class="cartsum">${ic("bag")}<span><b>${rupee(t.total)}</b><em>${t.units} item${t.units > 1 ? "s" : ""} in cart${t.discount ? ` · ${rupee(t.discount)} off` : ""}</em></span></span>` : '<span class="quiet">Tap items to add them to the cart</span>';
      $("#bgo").classList.toggle("hidden", !t.units);
      $$("[data-it]").forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-dec],[data-inc]")) return; add(s.items.find((x) => x.id === el.dataset.it)); });
      $$("[data-inc]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.inc)));
      $$("[data-dec]").forEach((b) => b.onclick = () => add(s.items.find((x) => x.id === b.dataset.dec), -1));
    }

    U.app.innerHTML = `
      ${bizTop()}
      <div class="pad billhead"><b>New bill</b><span class="quiet small">Tap or scan items · the app adds it up</span></div>
      <div class="pad scanrow"><div class="inshop">${ic("search")}<input id="bq" placeholder="Find an item" autocomplete="off"></div><button class="btn auto scanbtn" id="scanb">${ic("camera")} Scan</button></div>
      <div class="bgrid" id="bgrid"></div>
      <div class="pad" style="margin:12px 0 0"><button class="btn line" id="other">+ Item not in list</button></div>
      ${s.items.length ? "" : '<div class="banner" style="margin:14px var(--gut) 0"><div class="serif">No items yet</div><p>Add your items on the Stock page first — then tap them here to bill.</p><a class="link accent" href="#/biz/items">Go to Stock</a></div>'}
      <div style="height:110px"></div>
      <div class="billbar"><div id="bsum"></div><a class="btn auto" id="bgo" href="#/biz/cart">View cart</a></div>`;
    bindTop();
    $("#bq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $("#other").onclick = otherItem;
    // scan item after item into the cart; an unknown code or an item without a price closes the camera to ask
    $("#scanb").onclick = async () => {
      const code = await scanBarcode({ any: true, title: "Scan to sell", hint: "Point at the barcode or QR on each item", onCode: (c) => {
        const it = A.itemByCode(s.id, c);
        if (!it || !it.price) return false;
        add(it, 1); const l = lineOf(it.id);
        return `${it.name} · ${l ? l.qty : 1} in cart · ${rupee(totals().total)}`;
      } });
      if (!code) return;
      const it = A.itemByCode(s.id, code);
      if (it) add(it, 1); // no price yet: add() asks for it
      else linkCodeSheet(s, code, (x) => { add(x, 1); });
    };
    paint();
  }

  // ---------- cart page: check the items, payment, then Generate bill ----------
  function cartView() {
    const s = A.ownerShop();
    let cart = cartGet(s);
    const keep = () => cartSet(s, cart);
    const draw = () => {
      const t = A.billTotals(cart.lines, cart.discount);
      const change = cart.pay === "cash" && +cart.received > t.total ? +cart.received - t.total : 0;
      if (!cart.lines.length) {
        U.app.innerHTML = `${bizTop("Cart")}
          <div class="cart-empty">${ic("bag")}<b>Your cart is empty</b><p>Tap items on the Bill page to add them here.</p><a class="btn auto" href="#/biz">Add items</a></div>`;
        bindTop(); return;
      }
      U.app.innerHTML = `
        ${bizTop("Cart")}
        <div class="pad billhead"><b>${t.units} item${t.units > 1 ? "s" : ""}</b><a class="link" href="#/biz">+ Add more items</a></div>
        <div class="cartlist">${cart.lines.map((l, i) => {
          const it = l.itemId && s.items.find((x) => x.id === l.itemId);
          return `<div class="cline">
            <span class="thumb" style="${it ? U.catVars(it.cat) : ""}">${it ? U.pimg(it) : U.art(s.cat, 30)}</span>
            <div class="body"><div class="name">${esc(l.name)}</div>
              <button class="link" data-price="${i}">${rupee(l.price)} each · change</button></div>
            <div class="cright"><b>${rupee(l.qty * l.price)}</b>
              <span class="stepper sm"><button data-m="${i}" aria-label="One less">−</button><span>${l.qty}</span><button data-p="${i}" aria-label="One more">+</button></span></div>
            <button class="crm" data-rm="${i}" aria-label="Remove ${esc(l.name)}">×</button>
          </div>`; }).join("")}</div>
        <div class="rsec">
          <table class="specs bill">
            <tr><th>Items (${t.units})</th><td>${rupee(t.sub)}</td></tr>
            <tr><th>Discount ₹</th><td><input class="field" id="disc" inputmode="numeric" value="${cart.discount || ""}" placeholder="0" style="width:96px;text-align:right;padding:6px 8px"></td></tr>
            <tr class="total"><th>Total</th><td>${rupee(t.total)}</td></tr></table>
        </div>
        <div class="rsec"><div class="rhd"><b>Paid by</b></div>
          <div class="words">${Object.entries(PAYS).map(([k, v]) => `<button class="word ${cart.pay === k ? "on" : ""}" data-pay="${k}">${v}</button>`).join("")}</div>
          ${cart.pay === "cash" ? `<div class="two" style="margin-top:12px;align-items:end"><label class="small quiet">Cash received ₹<input class="field" id="recv" inputmode="numeric" value="${cart.received || ""}" placeholder="${t.total}"></label>
            <div class="small" id="chg" style="padding-bottom:12px">${change ? `Return <b style="font-size:18px">${rupee(change)}</b>` : ""}</div></div>` : ""}
          ${cart.pay === "upi" ? `<p class="small quiet" style="margin:10px 0 0">The customer pays ${rupee(t.total)} to your shop's UPI.</p>` : ""}
          ${cart.pay === "khata" ? `<p class="small quiet" style="margin:10px 0 0">Goes on the customer's credit — add their number below.</p>` : ""}
          <label class="small quiet" style="display:block;margin-top:14px">Customer WhatsApp number <span class="faint">(optional)</span>
            <input class="field" id="ph" inputmode="tel" value="${esc(cart.phone)}" placeholder="98765 43210"></label>
          <p class="faint tiny" style="margin:4px 0 0">With a number, WhatsApp opens on that customer's chat with the bill ready — tap Send.</p>
          <div style="text-align:center;margin-top:14px"><button class="link accent" id="clearb">Clear cart</button></div>
        </div>
        <div style="height:120px"></div>
        <div class="billbar"><span><b>${rupee(t.total)}</b><em>${t.units} item${t.units > 1 ? "s" : ""} · ${PAYS[cart.pay]}</em></span><button class="btn auto" id="gen">Generate bill</button></div>`;
      bindTop();
      const ix = (b, k) => +b.dataset[k];
      $$("[data-m]").forEach((b) => b.onclick = () => { cart.lines[ix(b, "m")].qty--; cart.lines = cart.lines.filter((l) => l.qty > 0); keep(); draw(); });
      $$("[data-p]").forEach((b) => b.onclick = () => { cart.lines[ix(b, "p")].qty++; keep(); draw(); });
      $$("[data-rm]").forEach((b) => b.onclick = () => { cart.lines.splice(ix(b, "rm"), 1); keep(); draw(); });
      $$("[data-price]").forEach((b) => b.onclick = () => {
        const l = cart.lines[ix(b, "price")]; const a = prompt(`Price for ${l.name} (₹)`, l.price); if (a == null) return;
        const v = Math.round(+String(a).replace(/[^\d.]/g, ""));
        if (v > 0 && v <= 10000000) { l.price = v; keep(); draw(); } else U.toast("Type a price in rupees");
      });
      $("#disc").onchange = (e) => { cart.discount = Math.max(0, Math.round(+e.target.value || 0)); keep(); draw(); };
      $$("[data-pay]").forEach((b) => b.onclick = () => { cart.pay = b.dataset.pay; keep(); draw(); });
      $("#recv") && ($("#recv").oninput = (e) => { cart.received = e.target.value; keep(); const c = +e.target.value - A.billTotals(cart.lines, cart.discount).total; $("#chg").innerHTML = c > 0 ? `Return <b style="font-size:18px">${rupee(c)}</b>` : ""; });
      $("#ph").oninput = (e) => { cart.phone = e.target.value.replace(/[^\d+ ]/g, ""); keep(); };
      $("#clearb").onclick = () => { if (!confirm("Clear the cart?")) return; cart = EMPTY_CART(); keep(); draw(); };
      $("#gen").onclick = (ev) => {
        if (ev.currentTarget.disabled) return;
        if (planLocked(s)) return lockedSheet();
        if (cart.pay === "khata" && A.normPhone(cart.phone).length < 10) return U.toast("Add the customer's phone number for khata");
        if (cart.phone && A.normPhone(cart.phone).length !== 10) return U.toast("The customer's number should have 10 digits — or leave it empty");
        ev.currentTarget.disabled = true;
        let b;
        try { b = A.saveBill(s.id, { lines: cart.lines, discount: cart.discount, pay: cart.pay, phone: cart.phone, received: +cart.received || null }); }
        catch (x) { ev.currentTarget.disabled = false; return U.toast(x.message, 8000); }
        cartSet(s, EMPTY_CART());
        U.go("#/biz/bill/" + b.id);
        if (A.normPhone(b.phone).length === 10) sendBill(b, s);
      };
    };
    draw();
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

  const siteLink = (s, src) => (window.MM_CLOUD ? window.MM_CLOUD.shopLink(s.id, src) : "");

  // ---------- Login & security ----------
  function securityView() {
    const s = A.ownerShop(), C2 = window.MM_CLOUD;
    const mask = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 2)}••• ••${p.slice(7)}` : "—");
    U.app.innerHTML = `
      ${bizTop("Login & security")}
      <div class="rsec"><div class="rhd"><b>Login numbers</b></div>
        <p class="small quiet" style="margin:0 0 8px">Any of these numbers can open your shop with its PIN. Keep a backup number so a lost phone or SIM never locks you out.</p>
        <div class="entries" id="nums"><p class="quiet small">Loading…</p></div>
      </div>
      <div class="rsec" id="addbox"><div class="rhd"><b>Add a backup number</b></div>
        <div class="form" style="margin-top:0">
          <label>Mobile number<input class="field" id="bnum" inputmode="tel" placeholder="98765 43211"></label>
          <label>PIN for that number <span class="faint tiny">— use your same PIN so it's easy to remember</span><input class="field" id="bpin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></label>
          <p class="small" id="berr" style="color:var(--out);margin:0;min-height:1em"></p>
          <button class="btn" id="badd" type="button">Add backup number</button></div>
      </div>
      <div class="rsec"><div class="rhd"><b>Change my PIN</b></div>
        <div class="form" style="margin-top:0">
          <label>Current PIN<input class="field" id="opin" type="password" inputmode="numeric" maxlength="6"></label>
          <div class="two"><label>New PIN<input class="field" id="npin" type="password" inputmode="numeric" maxlength="6"></label>
            <label>Repeat new PIN<input class="field" id="npin2" type="password" inputmode="numeric" maxlength="6"></label></div>
          <p class="small" id="perr" style="color:var(--out);margin:0;min-height:1em"></p>
          <button class="btn line" id="pchg" type="button">Change PIN</button></div>
      </div>
      <div class="rsec"><div class="rhd"><b>Lost or old phone?</b></div>
        <p class="small quiet" style="margin:0 0 10px">Logs your shop out of every other phone. This phone stays logged in.</p>
        <button class="btn line" id="lout">Log out all other devices</button>
      </div>
      <div class="rsec danger"><div class="rhd"><b>Delete my shop</b></div>
        <p class="small quiet" style="margin:0 0 10px">Removes your shop, items, stock, bills and website for good. This can't be undone.</p>
        <button class="btn line" id="del" style="color:var(--out);border-color:#e9b8b0">Delete my shop…</button>
      </div>
      <div style="height:30px"></div>`;
    bindTop();
    if (!C2 || !s.cloud) { $("#nums").innerHTML = '<p class="quiet small">Log in with your number and PIN to manage this.</p>'; return; }
    const loadNums = () => C2.loginNumbers(s.id).then((list) => {
      $("#nums").innerHTML = list.map((m, i) => `<div class="entry"><div class="body"><div class="name">${mask(m.phone)}</div>
        <div class="note">${i === 0 ? "Main number" : "Backup number"}${m.me ? " · this phone" : ""}</div></div>
        ${m.me ? '<span class="tag ok">You</span>' : `<button class="link accent" data-rm="${m.user_id}">Remove</button>`}</div>`).join("");
      $("#addbox").classList.toggle("hidden", list.length >= 4);
      $$("[data-rm]").forEach((b) => b.onclick = async () => {
        if (!confirm("Remove this number? It won't be able to open your shop any more.")) return;
        try { await C2.removeLoginNumber(s.id, b.dataset.rm); U.toast("Number removed"); loadNums(); } catch (x) { U.toast(x.message); }
      });
    }).catch((x) => { $("#nums").innerHTML = `<p class="quiet small">${esc(x.message)}</p>`; });
    loadNums();
    $("#badd").onclick = async () => {
      const ph = A.normPhone($("#bnum").value), pin = $("#bpin").value, err = (m) => ($("#berr").textContent = m);
      if (ph.length !== 10) return err("Enter a 10-digit mobile number");
      const weak = A.weakPin(pin, ph); if (weak) return err(weak);
      err(""); $("#badd").disabled = true; $("#badd").textContent = "Adding…";
      try { await C2.addLoginNumber(s.id, ph, pin); U.toast("Backup number added"); $("#bnum").value = ""; $("#bpin").value = ""; loadNums(); }
      catch (x) { err(x.message); }
      $("#badd").disabled = false; $("#badd").textContent = "Add backup number";
    };
    $("#pchg").onclick = async () => {
      const o = $("#opin").value, n = $("#npin").value, err = (m) => ($("#perr").textContent = m);
      const me = await C2.myNumber();
      const weak = A.weakPin(n, me); if (weak) return err(weak);
      if (n !== $("#npin2").value) return err("The new PINs don't match");
      if (!(await C2.checkPin(me, o))) return err("Current PIN is wrong");
      try { await C2.changePin(n); err(""); U.toast("PIN changed for this number"); ["#opin", "#npin", "#npin2"].forEach((k) => ($(k).value = "")); }
      catch (x) { err(x.message); }
    };
    $("#lout").onclick = async () => {
      if (!confirm("Log out your shop on every other phone?")) return;
      try { await C2.logoutOthers(); U.toast("Other phones are logged out"); } catch (x) { U.toast(x.message); }
    };
    $("#del").onclick = () => U.openSheet(`<div class="eyebrow" style="color:var(--out)">Delete for good</div><div class="title">Delete ${esc(s.name)}?</div>
      <p class="small quiet">Everything is removed: items, stock, bills, reports and your website. Type the shop name to confirm.</p>
      <div class="form"><input class="field" id="dname" placeholder="${esc(s.name)}"><button class="btn" id="dgo" style="background:#b0392b;border-color:#b0392b">Delete my shop</button></div>`, (el) => {
      $("#dgo", el).onclick = async () => {
        if ($("#dname", el).value.trim().toLowerCase() !== s.name.trim().toLowerCase()) return U.toast("Type the shop name exactly");
        try { await C2.deleteShop(s.id); } catch (x) { return U.toast(x.message); }
        A.releaseShop(); try { Object.keys(localStorage).filter((k) => k.startsWith("mm.") && k !== "mm.loc").forEach((k) => localStorage.removeItem(k)); } catch {}
        U.closeSheet(); location.hash = "#/biz"; location.reload();
      };
    });
  }

  // ---------- My website: the shop's page, sharing, QR poster, Google Maps ----------
  const GCAT = { mobile: "Mobile phone shop", electronics: "Electronics store", electrical: "Electrical supply store", hardware: "Hardware store",
    plumbing: "Plumbing supply store", clothes: "Clothing store", footwear: "Shoe store", kitchen: "Kitchen supply store", grocery: "Grocery store",
    pharmacy: "Pharmacy", stationery: "Stationery store", accessories: "Bag shop" };
  function gfields(s) {
    const m = A.getMarket(s.marketId);
    const addr = [s.shopNo && s.shopNo !== "—" ? `Shop ${s.shopNo}` : "", s.floor && s.floor !== "Ground floor" ? s.floor : "", s.landmark || "", m?.name || "",
      s.locality || m?.locality || "", s.pincode || m?.pincode || ""].filter(Boolean).join(", ");
    const hours = `${U.fmtHour(s.open)} – ${U.fmtHour(s.close)}${s.closedDay && s.closedDay !== "None" ? `, closed ${s.closedDay}` : ", open all week"}`;
    return [["Business name", s.name], ["Category", GCAT[s.cat] || "Store"], ["Address", addr || "—"], ["Phone", s.phone || "—"], ["Hours", hours], ["Website", siteLink(s, "gmaps")]];
  }
  let qrLoad = null;
  const loadQR = () => qrLoad || (qrLoad = new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    sc.onload = () => res(window.qrcode); sc.onerror = () => { qrLoad = null; rej(new Error("QR needs the internet once")); };
    document.head.appendChild(sc);
  }));
  const makeQR = async (text) => { const qr = (await loadQR())(0, "M"); qr.addData(text); qr.make(); return qr; };
  function qrSvg(qr, px) {
    const n = qr.getModuleCount(), c = px / (n + 8); let r = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) r += `<rect x="${(x + 4) * c}" y="${(y + 4) * c}" width="${c + 0.3}" height="${c + 0.3}"/>`;
    return `<svg viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" style="background:#fff"><g fill="#0f1111">${r}</g></svg>`;
  }
  // A4 poster for the counter / shop front, drawn as vectors (sharp when printed)
  async function posterPdf(s) {
    const { jsPDF } = window.jspdf; const qr = await makeQR(siteLink(s, "qr"));
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true }); const W = 210;
    doc.setFillColor(23, 35, 49); doc.rect(0, 0, W, 58, "F");
    doc.setFillColor(255, 164, 28); doc.rect(0, 58, W, 2.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(30);
    doc.text(doc.splitTextToSize(s.name, W - 30).slice(0, 2), W / 2, 28, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(214, 224, 233);
    doc.text("See our stock and prices on your phone", W / 2, 48, { align: "center" });
    const n = qr.getModuleCount(), size = 110, c = size / n, x0 = (W - size) / 2, y0 = 78;
    doc.setFillColor(15, 17, 17);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) doc.rect(x0 + x * c, y0 + y * c, c + 0.05, c + 0.05, "F");
    doc.setTextColor(15, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
    doc.text("Scan with your phone camera", W / 2, y0 + size + 18, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(86, 89, 89);
    doc.text("Check what's in stock · prices · WhatsApp us · directions", W / 2, y0 + size + 28, { align: "center" });
    if (s.promo) {
      doc.setFillColor(255, 243, 223); doc.setDrawColor(255, 164, 28); doc.setLineWidth(0.6);
      doc.roundedRect(25, y0 + size + 36, W - 50, 20, 3, 3, "FD");
      doc.setTextColor(112, 63, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.text(doc.splitTextToSize(s.promo, W - 60)[0], W / 2, y0 + size + 48.5, { align: "center" });
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(138, 145, 145);
    doc.text("Powered by My Market — live stock and prices from shops near you", W / 2, 285, { align: "center" });
    return doc;
  }
  function siteView(params) {
    const s = A.ownerShop();
    const link = siteLink(s, "link");
    U.app.innerHTML = `
      ${bizTop("My website")}
      ${!s.cloud ? '<div class="banner" style="margin:12px var(--gut) 0"><div class="serif">Not online yet</div><p>Log in with your mobile number and PIN so your shop is on the server — then your website goes live.</p></div>' : ""}
      <div class="rsec"><div class="rhd"><b>Photos and details</b><a class="link" href="${esc(siteLink(s, "app"))}" target="_blank" rel="noopener">Preview</a></div>
        <p class="small quiet" style="margin:0 0 10px">These show on your website. Good photos of your shop front and shelves bring more customers.</p>
        <label class="ph-cover" id="pcover">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : `${ic("camera")}<em>Add a cover photo — your shop front</em>`}<input type="file" accept="image/*" hidden data-up="cover"></label>
        <div class="ph-row">
          <label class="ph-logo" id="plogo">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<span>${esc(s.name[0])}</span><em>Logo</em>`}<input type="file" accept="image/*" hidden data-up="logo"></label>
          <p class="small quiet" style="margin:0">Tap the cover or the logo to change it. Square logo works best.</p>
        </div>
        <div class="eyebrow" style="margin:14px 0 8px">Gallery <span class="faint">· up to 6 photos</span></div>
        <div class="ph-gal">${(s.gallery || []).map((g, i) => `<div class="g"><img src="${esc(g)}" alt=""><button data-rmg="${i}" aria-label="Remove photo">×</button></div>`).join("")}
          ${(s.gallery || []).length < 6 ? `<label class="g add">${ic("plus")}<input type="file" accept="image/*" hidden data-up="gallery"></label>` : ""}</div>
        <div class="form" style="margin-top:14px">
          <label>About your shop <span class="faint tiny">— a few lines (up to 600 letters)</span><textarea class="field" id="sabout" rows="3" maxlength="600" placeholder="e.g. Family shop since 1998. All hardware, plumbing and electrical items. Wholesale rates for contractors.">${esc(s.about || "")}</textarea></label>
          <label>Payments you accept</label>
          <div class="words" id="spay">${["Cash", "UPI", "Card", "Credit (khata)"].map((p) => `<button type="button" class="word ${(s.payMethods || []).includes(p) ? "on" : ""}" data-pay="${p}">${p}</button>`).join("")}</div>
          <label style="display:flex;align-items:center;gap:10px;text-transform:none"><input type="checkbox" id="sdel" ${s.delivery ? "checked" : ""} style="width:20px;height:20px;accent-color:#1e8e4e"> We do home delivery</label>
          <button class="btn" id="ssave" type="button">Save details</button>
        </div>
      </div>
      <div class="rsec"><div class="rhd"><b>Your shop's website</b><a class="link" href="${esc(siteLink(s, "app"))}" target="_blank" rel="noopener">Open</a></div>
        <p class="small quiet" style="margin:0 0 8px">Included in your plan. Shows your items, prices, stock, hours and location — and lets people WhatsApp or call you.</p>
        <div class="linkbox"><input class="field" readonly value="${esc(link)}" id="lnk"><button class="btn auto" id="copy">Copy</button></div>
        <div class="two" style="margin-top:10px"><button class="btn line" id="wash">Share on WhatsApp</button><button class="btn line" id="nsh">Share…</button></div>
      </div>
      <div class="rsec"><div class="rhd"><b>QR poster</b></div>
        <p class="small quiet" style="margin:0 0 8px">Print it for your counter and shop front. Customers scan it to see your stock and prices.</p>
        <div id="qrbox" class="qrbox"><p class="quiet small">Making the QR code…</p></div>
        <div class="two" style="margin-top:10px"><button class="btn" id="post">Download poster (PDF)</button><button class="btn line" id="postp">Print</button></div>
      </div>
      <div class="rsec"><div class="rhd"><b>Put your shop on Google Maps</b></div>
        <p class="small quiet" style="margin:0 0 8px">Google lets only the shop's owner add or claim a shop — no app can do it for you. It takes about 5 minutes, and everything you need is here to copy.</p>
        <ol class="gsteps">
          <li><a class="link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + (s.locality || A.getMarket(s.marketId)?.name || ""))}" target="_blank" rel="noopener">Search your shop on Google Maps</a>.
            Found it? Tap it → <b>Own this business?</b> / <b>Claim this business</b>.</li>
          <li>Not there? <a class="link" href="https://business.google.com/create" target="_blank" rel="noopener">Add your business on Google</a> and fill in the details below.</li>
          <li>Google checks it's yours by a phone call, SMS or short video. Then your shop shows on Maps.</li>
        </ol>
        <div class="gcopy">${gfields(s).map(([k, v], i) => `<div class="gc"><span><em>${k}</em>${esc(v)}</span><button class="link" data-gc="${i}">Copy</button></div>`).join("")}</div>
        <p class="faint tiny" style="margin:6px 0 0">Put the <b>Website</b> link in your Google profile: everyone who finds you on Maps can then see your stock and prices, and your Reports show those visits.
          <a class="link" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" rel="noopener">Check your pin on the map</a></p>
      </div>
      <div class="rsec"><div class="rhd"><b>Visits</b><div class="words">${[7, 30].map((k) => `<a class="word ${(+params.get("d") || 7) === k ? "on" : ""}" href="#/biz/site?d=${k}">${k}d</a>`).join("")}</div></div>
        <div id="visits"><p class="quiet small">Loading…</p></div>
      </div>
      <div style="height:30px"></div>`;
    bindTop();
    // photos and details
    const SIZE = { cover: [1400, 0.78], logo: [500, 0.85], gallery: [1200, 0.78] };
    $$("[data-up]").forEach((inp) => inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const kind = inp.dataset.up, [max, ql] = SIZE[kind];
      U.toast("Adding photo…");
      const data = await shrinkPhoto(f, max, ql);
      if (!data) return U.toast("Couldn't read that photo");
      A.setShopPhoto(s.id, kind, data);
      U.toast("Photo saved — it shows on your website"); siteView(params);
    });
    $$("[data-rmg]").forEach((b) => b.onclick = (e) => { e.preventDefault(); A.removeGalleryPhoto(s.id, +b.dataset.rmg); siteView(params); });
    $$("#spay [data-pay]").forEach((b) => b.onclick = () => b.classList.toggle("on"));
    $("#ssave").onclick = () => {
      A.updateShop(s.id, { about: $("#sabout").value.trim(), payMethods: $$("#spay .word.on").map((b) => b.dataset.pay), delivery: $("#sdel").checked });
      U.toast("Saved — it shows on your website");
    };
    const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); U.toast(msg); } catch { prompt("Copy this link", text); } };
    $("#copy").onclick = () => copy(link, "Link copied");
    $$("[data-gc]").forEach((x) => x.onclick = () => { const [k, v] = gfields(s)[+x.dataset.gc]; copy(v, `${k} copied — paste it in Google`); });
    $("#wash").onclick = () => U.openWhatsApp("", `${s.name} — see our stock and prices: ${siteLink(s, "share")}`);
    $("#nsh").onclick = async () => { try { await navigator.share({ title: s.name, text: `${s.name} — see our stock and prices`, url: siteLink(s, "share") }); } catch (x) { if (x.name !== "AbortError") copy(siteLink(s, "share"), "Link copied"); } };
    makeQR(siteLink(s, "qr")).then((qr) => { $("#qrbox") && ($("#qrbox").innerHTML = qrSvg(qr, 200) + `<b>${esc(s.name)}</b>`); })
      .catch((x) => { $("#qrbox") && ($("#qrbox").innerHTML = `<p class="quiet small">${esc(x.message)}</p>`); });
    const poster = async (print) => {
      if (!window.jspdf) return U.toast("Needs the internet once");
      const doc = await posterPdf(s);
      if (print) { const url = doc.output("bloburl"); const w = window.open(url, "_blank"); if (!w) doc.save("my-market-poster.pdf"); }
      else doc.save(`${s.name.replace(/[^\w]+/g, "-")}-qr-poster.pdf`);
    };
    $("#post").onclick = () => poster(false); $("#postp").onclick = () => poster(true);
    // visits
    const box = $("#visits");
    if (!(window.MM_CLOUD && s.cloud)) { box.innerHTML = '<p class="quiet small">Visits show once your shop is online.</p>'; return; }
    const SRC = { gmaps: "Google Maps", qr: "QR poster", bill: "Bills", share: "Shared links", link: "Your link", app: "My Market app", search: "Search" };
    window.MM_CLOUD.visitsSummary(s.id, +params.get("d") || 7).then((rows) => {
      const views = rows.filter((r) => r.kind === "view"), tot = views.reduce((a, r) => a + +r.n, 0);
      const act = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => a + +r.n, 0);
      if (!tot && !rows.length) { box.innerHTML = '<p class="quiet small">No visits yet. Share your link, put up the QR poster and add it to Google Maps.</p>'; return; }
      const max = Math.max(1, ...views.map((r) => +r.n));
      box.innerHTML = `<div class="stats" style="padding:0;margin:0 0 12px">
          <div><b>${tot}</b><span>page visits</span></div><div><b>${act("whatsapp")}</b><span>WhatsApp taps</span></div>
          <div><b>${act("directions")}</b><span>directions</span></div><div><b>${act("call")}</b><span>calls</span></div></div>
        <div class="bars">${views.sort((a, b) => b.n - a.n).map((r) => `<div class="bar"><div class="bl"><b>${SRC[r.src] || r.src}</b><span>${r.n}</span></div><div class="bt"><i style="width:${(r.n / max) * 100}%"></i></div></div>`).join("")}</div>`;
    }).catch((x) => { box.innerHTML = `<p class="quiet small">${esc(x.message)}</p>`; });
  }

  // ---------- bill PDF: A4 page, invoice layout ----------
  // Drawn as vectors (sharp on screen and when printed). Standard PDF fonts have
  // no ₹ sign, so amounts print as "Rs.". Long bills continue on more pages.
  const rs = (n) => "Rs. " + Math.round(n).toLocaleString("en-IN");
  const billName = (b, s) => `${s.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-bill-${b.no}.pdf`;
  // the A4 bill (js/billpdf.js — the customer's bill page draws the same one)
  const makeBillPdf = (b, s, into) => window.MM_BILLPDF.make(b, s, { market: A.getMarket(s.marketId), shopUrl: s.cloud ? siteLink(s, "bill") : "", into });
  // Send the bill to the customer's WhatsApp number — call straight from the tap.
  // With a number: the bill's link is decided now, WhatsApp opens at once on that
  // customer's chat (no contacts needed) and the PDF uploads in the background
  // (retried until it's there). Without a number: the phone's share menu.
  async function sendBill(b, s) {
    const num = A.normPhone(b.phone);
    if (num.length === 10) {
      // the bill is saved in the database; the link shows it from there (no PDF file is uploaded)
      const tok = s.cloud && window.MM_CLOUD ? A.billToken(b.id) : null;
      const link = tok ? window.MM_CLOUD.billShareLink(tok) : null;
      const msg = billText(b, s, link || "");
      U.openWhatsApp(num, msg);
      if (!link) U.toast("Sent as text — log in so bills go out as links");
      return link ? "link" : "text";
    }
    return shareBillFile(b, s);
  }
  // the PDF itself, through the phone's share menu (pick WhatsApp, then the customer's chat)
  async function shareBillFile(b, s) {
    if (!window.jspdf) { U.toast("PDF needs the internet once"); return "none"; }
    const doc = makeBillPdf(b, s);
    const file = new File([doc.output("blob")], billName(b, s), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Bill #${b.no}`, text: `Bill #${b.no} from ${s.name}: ${rs(b.total)}. Thank you!` }); return "shared"; }
      catch (x) { if (x.name === "AbortError") return "cancelled"; }
    }
    doc.save(billName(b, s)); U.toast("Bill PDF downloaded");
    return "downloaded";
  }

  // ---------- back up bills (Google Drive) ----------
  // Bills are kept on this phone and on the My Market server. The owner keeps a
  // third copy: one PDF with every bill + a sheet (CSV) for Excel / Google Sheets,
  // shared straight into Google Drive from the phone's share menu.
  const lastBackup = (s) => A.store.get("lastBackup:" + s.id, 0);
  function backupDue(s) {
    const bills = A.billsFor(s.id); if (!bills.length) return "";
    const last = lastBackup(s), newer = bills.filter((x) => x.at > last).length;
    if (!newer) return "";
    const since = last || Math.min(...bills.map((x) => x.at)), days = Math.floor((Date.now() - since) / 86400000);
    if (days < 7) return "";
    return last ? `Last backup ${days} days ago · ${newer} new bill${newer > 1 ? "s" : ""} since — save a copy to Google Drive`
      : `${newer} bill${newer > 1 ? "s" : ""} not backed up yet — save a copy to Google Drive`;
  }
  function billsCsv(list) {
    const q = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [["Bill no", "Date", "Time", "Customer phone", "Paid by", "Item", "Brand", "Qty", "Price", "Line total", "Bill discount", "Bill total", "Cancelled"]];
    for (const x of list.slice().sort((p, r) => p.at - r.at)) {
      const d = new Date(x.at), day = d.toLocaleDateString("en-IN"), tm = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      x.lines.forEach((l, i) => rows.push([x.no, day, tm, x.phone || "", PAYS[x.pay] || x.pay, l.name, l.brand || "", l.qty, l.price, l.qty * l.price,
        i === 0 ? x.discount : "", i === 0 ? x.total : "", x.cancelled ? "Yes" : ""]));
    }
    return "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n");
  }
  function backupView(params) {
    const s = A.ownerShop();
    const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), lm0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const last = lastBackup(s);
    const P = {
      new: ["Since last backup", (x) => x.at > last],
      month: ["This month", (x) => x.at >= m0],
      last: ["Last month", (x) => x.at >= lm0 && x.at < m0],
      all: ["All bills on this phone", () => true],
    };
    const pk = P[params.get("p")] ? params.get("p") : last ? "new" : "all";
    const list = A.billsFor(s.id).filter(P[pk][1]);
    const fmt = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    U.app.innerHTML = `
      ${bizTop("Back up bills")}
      <div class="rsec"><p class="small" style="margin:0 0 8px">Your bills are saved on this phone and on My Market's server. Keep your own copy in <b>Google Drive</b> too — if the phone is lost or reset, nothing is lost.</p>
        <p class="faint tiny" style="margin:0">${last ? `Last backup: ${fmt(last)}` : "No backup yet."} · Bill PDFs sent to customers stay online for 2 days.</p></div>
      <div class="rsec"><div class="rhd"><b>Which bills?</b></div>
        <div class="words">${Object.entries(P).filter(([k]) => k !== "new" || last).map(([k, [l]]) => `<a class="word ${k === pk ? "on" : ""}" href="#/biz/backup?p=${k}">${l}</a>`).join("")}</div>
        <p class="small" style="margin:12px 0 0"><b>${list.length}</b> bill${list.length === 1 ? "" : "s"}${list.length ? ` · ${fmt(Math.min(...list.map((x) => x.at)))} – ${fmt(Math.max(...list.map((x) => x.at)))}` : ""}</p>
      </div>
      <div class="rsec"><div class="rhd"><b>Save to Google Drive</b></div>
        <ol class="gsteps"><li>Tap the button below.</li><li>In the share menu, choose <b>Drive</b> (Save to Drive).</li><li>Pick a folder, e.g. <i>My Market bills</i>, and tap <b>Save</b>.</li></ol>
        <p class="faint tiny" style="margin:6px 0 10px">You get 2 files: a PDF with every bill, and a sheet that opens in Google Sheets or Excel.</p>
        <button class="btn" id="bk" ${list.length ? "" : "disabled"}>Back up ${list.length} bill${list.length === 1 ? "" : "s"}</button>
      </div>
      <div style="height:30px"></div>`;
    bindTop();
    $("#bk").onclick = async (ev) => {
      const btn = ev.currentTarget; if (btn.disabled) return;
      if (!window.jspdf) return U.toast("Making the PDF needs the internet once — try again online");
      btn.disabled = true; btn.textContent = "Making the files…";
      await new Promise((r) => setTimeout(r, 30)); // let the button repaint
      try {
        const sorted = list.slice().sort((p, r) => p.at - r.at);
        const { jsPDF } = window.jspdf;
        const book = new jsPDF({ unit: "mm", format: "a4", compress: true });
        sorted.forEach((x) => makeBillPdf(x, s, book)); // each bill starts on a new page
        book.deletePage(1);                               // the empty first page
        const tag = `${s.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-bills-${new Date().toISOString().slice(0, 10)}`;
        const pdf = new File([book.output("blob")], tag + ".pdf", { type: "application/pdf" });
        const csv = new File([billsCsv(sorted)], tag + ".csv", { type: "text/csv" });
        let ok = false;
        if (navigator.canShare && navigator.canShare({ files: [pdf, csv] })) {
          try { await navigator.share({ files: [pdf, csv], title: `${s.name} bills` }); ok = true; }
          catch (x) { if (x.name !== "AbortError") U.toast("Couldn't open the share menu — files downloaded instead"); else { btn.disabled = false; btn.textContent = `Back up ${list.length} bills`; return; } }
        }
        if (!ok) { // computer, or a phone browser without file sharing: download both
          for (const f of [pdf, csv]) { const u = URL.createObjectURL(f), el = document.createElement("a"); el.href = u; el.download = f.name; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
          U.toast("Downloaded — upload both files to Google Drive", 6000);
        }
        A.store.set("lastBackup:" + s.id, Math.max(...list.map((x) => x.at), lastBackup(s)));
        if (ok) U.toast("Backup ready — check it's in Google Drive", 5000);
        backupView(params);
      } catch (x) { btn.disabled = false; btn.textContent = "Try again"; U.toast("Backup failed: " + (x.message || x), 6000); }
    };
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
        $("#savein", el).onclick = (ev) => {
          if (planLocked(s)) { U.closeSheet(); return lockedSheet(); }
          if (ev.currentTarget.disabled) return; ev.currentTarget.disabled = true;
          let p; try { p = A.savePurchase(s.id, { lines, supplier, pay }); } catch (x) { ev.currentTarget.disabled = false; return U.toast(x.message, 8000); }
          if (supplier.trim()) A.store.set("lastSupplier:" + s.id, supplier.trim());
          A.store.del("stockDraft:" + s.id); lines = [];
          U.closeSheet(); U.toast(`Added ${p.lines.reduce((a, l) => a + l.qty, 0)} pieces to stock`); U.go("#/biz/items");
        };
      };
      U.openSheet("", draw);
    }
    U.app.innerHTML = `
      ${bizTop("Stock arrived")}
      <div class="pad billhead"><b>What arrived?</b><span class="quiet small">Tap or scan each piece</span></div>
      <div class="pad scanrow"><div class="inshop">${ic("search")}<input id="bq" placeholder="Find an item" autocomplete="off"></div><button class="btn auto scanbtn" id="scanb">${ic("camera")} Scan</button></div>
      <div class="bgrid" id="bgrid"></div>
      <div class="pad" style="margin:12px 0 0"><button class="btn line" id="newit">${ic("camera")} New item (with photo)</button></div>
      <div style="height:110px"></div>
      <div class="billbar"><div id="bsum"></div><button class="btn auto" id="bgo">Review</button></div>`;
    bindTop();
    $("#bq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $("#newit").onclick = () => newItemSheet(s, (it) => { if (it) add(it, 0); paint(); });
    $("#scanb").onclick = async () => {
      const code = await scanBarcode({ any: true, title: "Scan stock in", hint: "Scan each piece as you unpack it", onCode: (c) => {
        const it = A.itemByCode(s.id, c); if (!it) return false;
        add(it, 1); const l = lineOf(it.id);
        return `${it.name} · ${l ? l.qty : 1} arrived`;
      } });
      if (!code) return;
      const it = A.itemByCode(s.id, code);
      if (it) add(it, 1); else linkCodeSheet(s, code, (x) => add(x, 1));
    };
    $("#bgo").onclick = review;
    paint();
  }

  // ---------- new item: photo + name + price + quantity ----------
  // The photo is shrunk to 360 px and kept with the item and uploaded to the server.
  function shrinkPhoto(file, max = 360, q = 0.72) {
    return new Promise((res) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", q));
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
  // opts.any: accept any code (QR, Code 39, the shop's own sticker…), not only product barcodes.
  // opts.onCode(code): keep the camera open and scan item after item; return a line to show,
  // or false to close the scanner and hand that code back (e.g. a code nobody knows yet).
  function scanBarcode(opts = {}) {
    return new Promise((resolve) => {
      let stream = null, stop = () => {}, done = false, lastCode = "", lastAt = 0, count = 0;
      const ok = (c) => (opts.any ? c && c.trim().length >= 3 && c.length <= 200 : /^\d{6,14}$/.test(c));
      const finish = (code) => {
        if (done) return; done = true; stop();
        try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {}
        document.getElementById("scanbox")?.remove(); resolve(code || null);
      };
      const hint = opts.hint || "Point the camera at the barcode on the pack";
      const box = document.createElement("div"); box.id = "scanbox";
      box.innerHTML = `<div class="scanin"><div class="scanhd"><b>${esc(opts.title || "Scan barcode")}</b><button class="link" data-x>${opts.onCode ? "Done" : "Cancel"}</button></div>
        <video playsinline muted></video><div class="scanline"></div>
        <p class="small" id="scanmsg">${esc(hint)}</p>
        <div class="two"><input class="field" id="scantype" ${opts.any ? "" : 'inputmode="numeric"'} placeholder="Or type the ${opts.any ? "code" : "number"}"><button class="btn auto" data-ok>Use</button></div></div>`;
      document.body.appendChild(box);
      const video = box.querySelector("video"), msg = box.querySelector("#scanmsg");
      const got = (raw) => {
        const code = String(raw || "").trim();
        if (done || !ok(code)) return;
        if (!opts.onCode) return finish(code);
        if (code === lastCode && Date.now() - lastAt < 2000) return; // the same pack still in front of the camera
        lastCode = code; lastAt = Date.now();
        const r = opts.onCode(code);
        if (r === false) return finish(code);
        count++; try { navigator.vibrate && navigator.vibrate(60); } catch {}
        msg.innerHTML = `<b>✓ ${esc(r)}</b><br><span class="faint">${count} scanned · scan the next one, or tap Done</span>`;
        box.querySelector(".scanin").classList.remove("hit"); void box.offsetWidth; box.querySelector(".scanin").classList.add("hit");
      };
      box.querySelector("[data-x]").onclick = () => finish(null);
      box.querySelector("[data-ok]").onclick = () => {
        const inp = box.querySelector("#scantype"), v = opts.any ? inp.value.trim() : inp.value.replace(/\D/g, "");
        if (ok(v)) { inp.value = ""; got(v); } else msg.textContent = opts.any ? "Type the code printed under the barcode or QR" : "Type the 8–13 digit number under the barcode";
      };
      (async () => {
        try {
          if ("BarcodeDetector" in window) {
            const want = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", ...(opts.any ? ["qr_code", "code_39", "code_93", "itf", "codabar", "data_matrix"] : [])];
            const have = await window.BarcodeDetector.getSupportedFormats().catch(() => want);
            const det = new window.BarcodeDetector({ formats: want.filter((f) => have.includes(f)) });
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream; await video.play();
            const tick = async () => { if (done) return; try { const r = await det.detect(video); const c = r.find((x) => ok(String(x.rawValue || "").trim())); if (c) got(c.rawValue); } catch {} if (!done) requestAnimationFrame(tick); };
            tick();
          } else {
            msg.textContent = "Starting the camera…";
            const ZX = await loadZXing();
            const reader = new ZX.BrowserMultiFormatReader(); // reads barcodes and QR codes
            stop = () => { try { reader.reset(); } catch {} };
            msg.textContent = hint;
            await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, (res) => { if (res) got(res.getText()); }); // a blocked camera lands in catch below
          }
        } catch (e) { msg.textContent = /Permission|NotAllowed/i.test(e.name + e.message) ? "Camera blocked — allow the camera, or type the code below" : (e.message || "No camera here — type the code below"); }
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
        <label>Name<input class="field" id="nm" maxlength="120" placeholder="e.g. Ball valve 1 inch" autocomplete="off" value="${esc(p.name || f.name || (presetName ? presetName[0].toUpperCase() + presetName.slice(1) : ""))}"></label>
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
        if (planLocked(s)) { U.closeSheet(); return lockedSheet(); }
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
      ${backupDue(s) ? `<a class="rsec sitecard due" href="#/biz/backup"><span>${ic("bag")}</span><div><b>Back up your bills</b><em>${backupDue(s)}</em></div>${ic("arrow")}</a>` : ""}
      <a class="rsec sitecard an-card" href="#/biz/analytics"><span>${ic("chart")}</span><div><b>Shop analytics</b><em>Best times, top sellers, profit, what to reorder, your best customers</em></div>${ic("arrow")}</a>
      <a class="rsec sitecard" href="#/biz/site"><span>${ic("store")}</span><div><b>Your shop's website</b><em>Share it, print the QR poster, add it to Google Maps · see visits</em></div>${ic("arrow")}</a>

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

  // The WhatsApp message shows the whole bill in the chat; the link adds the full page and PDF.
  function billText(b, s, link = "") {
    const d = new Date(b.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    const shown = b.lines.slice(0, 25), more = b.lines.length - shown.length;
    return [`🧾 *${s.name}*`, `Bill #${b.no} · ${d}`, "",
      ...shown.map((l) => `• ${l.name} — ${l.qty} × ₹${l.price.toLocaleString("en-IN")} = ₹${(l.qty * l.price).toLocaleString("en-IN")}`),
      more > 0 ? `• …and ${more} more item${more > 1 ? "s" : ""}` : null, "",
      b.discount ? `Discount: −₹${b.discount.toLocaleString("en-IN")}` : null, `*Total: ₹${b.total.toLocaleString("en-IN")}*`, `Paid by: ${PAYS[b.pay]}`,
      link ? "" : null, link ? `Full bill & PDF: ${link}` : null,
      s.cloud ? `Our stock & prices: ${siteLink(s, "bill")}` : null, "", "Thank you! Visit again 🙏"].filter((x) => x !== null).join("\n");
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
        <button class="btn" id="wa">${b.phone ? `Send bill on WhatsApp to ${esc(b.phone)}` : "Share bill PDF"}</button>
        ${b.phone ? `<button class="btn line" id="wafile">Send as PDF file (WhatsApp, etc.)</button>` : ""}
        <div class="two"><button class="btn line" id="pdf">Download PDF</button><button class="btn line" id="pr">Print</button></div>
        <a class="btn warm" href="#/biz/bill">New bill</a>
      </div>
      ${b.cancelled ? "" : '<div class="pad noprint" style="text-align:center;margin-bottom:40px"><button class="link accent" id="cx">Cancel this bill (puts items back in stock)</button></div>'}`;
    $("#back").onclick = () => U.go("#/biz");
    $("#wa").onclick = () => sendBill(b, s);
    $("#wafile") && ($("#wafile").onclick = () => shareBillFile(b, s));
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
  Object.assign(U, { makeBillPdf, sendBill, posterPdf });
})();
