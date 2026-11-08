// My Market Admin — the staff app. Everything it shows comes from admin_* server
// functions, which refuse anyone who isn't in public.admins. Its login is kept apart
// from the shop app's, so logging in here never logs a shop out on the same browser.
(function () {
  const C = window.MM_CONFIG;
  const root = document.getElementById("root");
  const $ = (q, el = document) => el.querySelector(q), $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupee = (n) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
  const day = (t) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const ago = (t) => { if (!t) return "never"; const d = Math.floor((Date.now() - Date.parse(t)) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  const PLAN = { trial: "Free trial", active: "Paid", due: "Due (1–7 days)", orders_off: "Website off (8–15)", read_only: "Read-only", none: "No plan" };
  let toastT; const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 3500); };
  if (!C || !window.supabase) { root.innerHTML = '<div class="ad-loading">Server not configured.</div>'; return; }
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "mm.admin.auth" } });
  const rpc = async (fn, args = {}) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; };
  const wa = (phone, text) => `https://wa.me/91${String(phone || "").replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
  const shopLink = (id) => new URL("index.html", location.href).href.split("#")[0] + "#/shop/" + id;
  let me = "", shops = null;

  // ---------- login ----------
  function loginView(msg = "") {
    root.innerHTML = `<div class="ad-login"><h1>My Market Admin</h1><p>Staff only. Log in with your mobile number and PIN.</p>
      <form id="lf"><label>Mobile number<input name="ph" inputmode="tel" autocomplete="username" required placeholder="98765 43210"></label>
      <label>PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required></label>
      <div class="err" id="lerr">${esc(msg)}</div><button class="btn wide">Log in</button></form></div>`;
    $("#lf").onsubmit = async (e) => {
      e.preventDefault();
      const ph = e.target.ph.value.replace(/\D/g, "").slice(-10), pin = e.target.pin.value;
      if (ph.length !== 10) return ($("#lerr").textContent = "Enter your 10-digit mobile number");
      $("#lerr").textContent = "Checking…";
      const { error } = await sb.auth.signInWithPassword({ email: `91${ph}@phone.mymarket.in`, password: pin });
      if (error) return ($("#lerr").textContent = /invalid/i.test(error.message) ? "Wrong number or PIN" : error.message);
      start();
    };
  }
  async function start() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return loginView();
    me = (data.session.user.email || "").replace(/^91(\d{10})@.*/, "$1");
    try { await rpc("admin_check"); }
    catch { await sb.auth.signOut(); return loginView("This number isn't on the staff list."); }
    window.addEventListener("hashchange", route);
    route();
  }

  // ---------- frame ----------
  const NAV = [["", "Overview"], ["shops", "Shops"], ["payments", "Payments"], ["google", "On Google"], ["demand", "Customers & demand"], ["activity", "Activity log"]];
  function frame(active, inner) {
    root.innerHTML = `<div class="ad"><nav class="ad-side"><b>My Market Admin</b>
      ${NAV.map(([k, l]) => `<a href="#/${k}" class="${active === k ? "on" : ""}">${l}${k === "payments" ? '<span class="pill hidden" id="unm"></span>' : ""}</a>`).join("")}
      <div class="me">+91 ${esc(me)} · <button id="out">Log out</button></div></nav>
      <main class="ad-main" id="main">${inner}</main></div>`;
    $("#out").onclick = async () => { await sb.auth.signOut(); location.hash = ""; loginView(); };
  }
  const loading = (active, title) => frame(active, `<h1>${title}</h1><p class="sub">Loading…</p>`);
  const fail = (e) => { $("#main").innerHTML += `<div class="card err">${esc(e.message || e)}</div>`; };

  async function route() {
    const [path] = (location.hash.slice(2) || "").split("?");
    const parts = path.split("/").filter(Boolean);
    try {
      if (!parts[0]) return await overview();
      if (parts[0] === "shops") return await shopsView();
      if (parts[0] === "shop" && parts[1]) return await shopView(parts[1]);
      if (parts[0] === "payments") return await paymentsView();
      if (parts[0] === "demand") return await demandView();
      if (parts[0] === "google") return await googleView();
      if (parts[0] === "activity") return await activityView();
      location.hash = "#/";
    } catch (e) { if (!$("#main")) frame("", ""); fail(e); }
  }
  const getShops = async (fresh) => (shops && !fresh ? shops : (shops = await rpc("admin_shops")));

  // ---------- overview ----------
  async function overview() {
    loading("", "Overview");
    const [o, list] = await Promise.all([rpc("admin_overview"), getShops(true)]);
    const p = o.plans || {}, wk = o.joins_by_week || [], wMax = Math.max(1, ...wk.map((x) => x.n));
    const soon = list.filter((s) => s.plan === "trial" && s.access_until && Date.parse(s.access_until) - Date.now() < 7 * 86400000);
    const overdue = list.filter((s) => ["due", "orders_off", "read_only"].includes(s.plan));
    $("#main").innerHTML = `<h1>Overview</h1><p class="sub">${new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</p>
      <div class="kpis">
        <div class="kpi"><span>Shops registered</span><b>${o.shops}</b><em>+${o.new_7d} this week · +${o.new_30d} in 30 days</em></div>
        <div class="kpi"><span>Active (billed in 7 days)</span><b>${o.active_7d}</b><em>${o.shops ? Math.round((o.active_7d / o.shops) * 100) : 0}% of shops</em></div>
        <div class="kpi"><span>Collected this month</span><b>${rupee(o.money_month)}</b><em>last month ${rupee(o.money_last_month)}</em></div>
        <div class="kpi"><span>Paying shops</span><b>${o.paid_shops}</b><em>expected ≈ ${rupee(o.paid_shops * 150)}/month</em></div>
        <div class="kpi"><span>Bills today</span><b>${o.bills_today.n}</b><em>${rupee(o.bills_today.value)} across all shops</em></div>
        <div class="kpi"><span>Bills, last 7 days</span><b>${o.bills_7d.n}</b><em>${rupee(o.bills_7d.value)}</em></div>
        <div class="kpi"><span>Website orders, 7 days</span><b>${o.orders_7d}</b></div>
        <div class="kpi"><span>Customer searches, 7 days</span><b>${o.searches_7d}</b></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Plans</h2>${Object.keys(PLAN).filter((k) => p[k]).map((k) => `<div class="row" style="justify-content:space-between;padding:4px 0"><span class="tag ${k}">${PLAN[k]}</span><b>${p[k]}</b></div>`).join("") || '<p class="empty">No shops yet.</p>'}
          <p style="margin:10px 0 0"><a href="#/shops">See all shops →</a></p></div>
        <div class="card"><h2>New shops per week</h2>${wk.length ? `<div class="bars">${wk.map((x) => `<div><i style="height:${Math.max(4, (x.n / wMax) * 100)}%" title="${x.n}"></i><span>${new Date(x.week).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>`).join("")}</div>` : '<p class="empty">No sign-ups in 12 weeks.</p>'}</div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Free trial ending in 7 days <span class="tag">${soon.length}</span></h2>${soon.length ? soon.map((s) => `<div class="row" style="justify-content:space-between;padding:5px 0"><a href="#/shop/${s.id}">${esc(s.name)}</a><span>${day(s.access_until)}</span></div>`).join("") : '<p class="empty">None.</p>'}</div>
        <div class="card"><h2>Payment overdue <span class="tag due">${overdue.length}</span></h2>${overdue.length ? overdue.map((s) => `<div class="row" style="justify-content:space-between;padding:5px 0"><a href="#/shop/${s.id}">${esc(s.name)}</a><span class="tag ${s.plan}">${PLAN[s.plan]}</span></div>`).join("") : '<p class="empty">None.</p>'}
          ${o.unmatched_credits ? `<p style="margin:10px 0 0"><a href="#/payments">${o.unmatched_credits} bank credit${o.unmatched_credits > 1 ? "s need" : " needs"} a look →</a></p>` : ""}</div>
      </div>`;
    if (o.unmatched_credits) { const u = $("#unm"); u.textContent = o.unmatched_credits; u.classList.remove("hidden"); }
  }

  // ---------- shops ----------
  const FILTERS = { all: "All", trial: "Free trial", active: "Paid", due: "Due", orders_off: "Website off", read_only: "Read-only", inactive: "No bill in 14 days", never: "Never billed" };
  async function shopsView() {
    loading("shops", "Shops");
    const list = await getShops(true);
    let f = "all", q = "";
    const draw = () => {
      const rows = list.filter((s) => {
        if (q && !`${s.name} ${s.owner_name || ""} ${s.phone || ""} ${s.locality || ""} ${s.pincode || ""} ${s.pay_code} ${(s.logins || []).join(" ")}`.toLowerCase().includes(q)) return false;
        if (f === "inactive") return s.last_bill && Date.now() - Date.parse(s.last_bill) > 14 * 86400000;
        if (f === "never") return !s.last_bill;
        return f === "all" || s.plan === f;
      });
      $("#tbl").innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Shop</th><th>Owner / phone</th><th>Area</th><th>Plan</th><th class="num">Items</th><th class="num">Bills</th><th class="num">Sales 30d</th><th>Last bill</th><th>Joined</th></tr></thead><tbody>
        ${rows.map((s) => `<tr class="click" data-id="${s.id}"><td><b>${esc(s.name)}</b><small>${esc(s.cat)} · ${esc(s.pay_code)}</small></td>
          <td>${esc(s.owner_name || "—")}<small>${esc(s.phone || "")}</small></td><td>${esc(s.locality || "—")}<small>${esc(s.pincode || "")}</small></td>
          <td><span class="tag ${s.plan || "none"}">${PLAN[s.plan] || "—"}</span><small>${s.access_until ? "till " + day(s.access_until) : ""}</small></td>
          <td class="num">${s.items}</td><td class="num">${s.bills}</td><td class="num">${rupee(s.sales_30d)}</td><td>${ago(s.last_bill)}</td><td>${day(s.created_at)}</td></tr>`).join("")}</tbody></table>`
        : '<p class="empty">No shops match.</p>';
      $("#cnt").textContent = `${rows.length} of ${list.length}`;
      $$("tr[data-id]").forEach((tr) => tr.onclick = () => { location.hash = "#/shop/" + tr.dataset.id; });
    };
    $("#main").innerHTML = `<h1>Shops</h1><p class="sub"><span id="cnt"></span> · <a href="#" id="csv">Download as Excel (CSV)</a></p>
      <div class="row" style="margin-bottom:10px"><input id="q" placeholder="Search name, owner, phone, area, pincode, payment code" style="max-width:420px"></div>
      <div class="chips">${Object.entries(FILTERS).map(([k, l]) => `<button class="chip ${k === f ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div class="card scroll" id="tbl"></div>`;
    $("#q").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    $$("[data-f]").forEach((b) => b.onclick = () => { f = b.dataset.f; $$("[data-f]").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
    $("#csv").onclick = (e) => { e.preventDefault(); csv("my-market-shops", ["Shop", "Category", "Owner", "Phone", "Logins", "Area", "Pincode", "Plan", "Plan until", "Payment code", "Items", "Bills", "Sales 30 days", "Last bill", "Joined"],
      list.map((s) => [s.name, s.cat, s.owner_name, s.phone, (s.logins || []).join(" "), s.locality, s.pincode, PLAN[s.plan] || "", day(s.access_until), s.pay_code, s.items, s.bills, s.sales_30d, s.last_bill ? day(s.last_bill) : "", day(s.created_at)])); };
    draw();
  }

  async function shopView(id) {
    loading("shops", "Shop");
    const d = await rpc("admin_shop", { p_shop: id });
    if (!d || !d.shop) { $("#main").innerHTML = '<h1>Shop not found</h1><p><a href="#/shops">All shops</a></p>'; return; }
    const s = d.shop, st = d.stats, pl = d.plan || {}, daily = d.daily_30d || [], dMax = Math.max(1, ...daily.map((x) => x.value));
    const ph = String(s.phone || "").replace(/\D/g, "").slice(-10);
    $("#main").innerHTML = `<p><a href="#/shops">← All shops</a></p>
      <h1>${esc(s.name)}</h1><p class="sub"><span class="tag ${pl.state || "none"}">${PLAN[pl.state] || "No plan"}</span> · payment code <b>${esc(d.pay_code)}</b> · joined ${day(s.created_at)}</p>
      <div class="kpis">
        <div class="kpi"><span>Items</span><b>${st.items}</b><em>${st.items_with_price} with a price</em></div>
        <div class="kpi"><span>Bills</span><b>${st.bills}</b><em>last ${ago(st.last_bill)}</em></div>
        <div class="kpi"><span>Sales, 30 days</span><b>${rupee(st.sales_30d)}</b><em>all time ${rupee(st.sales_all)}</em></div>
        <div class="kpi"><span>Website, 30 days</span><b>${Object.values(st.visits_30d || {}).reduce((a, b) => a + b, 0)}</b><em>${Object.entries(st.visits_30d || {}).map(([k, v]) => `${k} ${v}`).join(" · ") || "no visits"}</em></div>
        <div class="kpi"><span>Website orders</span><b>${st.orders}</b></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Details</h2><div class="kv">
          <span>Owner</span><b>${esc(s.owner_name || "—")}</b>
          <span>Shop phone</span><span>${esc(s.phone || "—")}</span>
          <span>Login numbers</span><span>${(d.logins || []).map((l) => `${esc(l.phone)} <small>(${esc(l.role)}, since ${day(l.added_at)})</small>`).join("<br>") || "—"}</span>
          <span>Category</span><span>${esc(s.cat)}</span>
          <span>Address</span><span>${esc([s.shop_no && s.shop_no !== "—" ? "Shop " + s.shop_no : "", s.landmark, s.locality, s.pincode].filter(Boolean).join(", ") || "—")}</span>
          <span>Hours</span><span>${s.open_h}:00 – ${s.close_h}:00${s.closed_day && s.closed_day !== "None" ? ", closed " + esc(s.closed_day) : ""}</span>
          <span>GSTIN</span><span>${esc(s.gst || "—")}</span></div>
          <div class="row" style="margin-top:12px">
            ${ph ? `<a class="btn small" target="_blank" rel="noopener" href="${wa(ph, `Namaste ${s.owner_name || ""}! This is My Market support.`)}">WhatsApp owner</a><a class="btn small line" href="tel:+91${ph}">Call</a>` : ""}
            <a class="btn small line" target="_blank" rel="noopener" href="${shopLink(s.id)}">Open website</a>
            ${s.lat ? `<a class="btn small line" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}">Map</a>` : ""}</div></div>
        <div class="card"><h2>Plan</h2><div class="kv">
          <span>Stage</span><span><span class="tag ${pl.state || "none"}">${PLAN[pl.state] || "—"}</span></span>
          <span>Free trial till</span><span>${day(pl.trial_ends_at)}</span>
          <span>Paid till</span><span>${day(pl.paid_until)}</span>
          <span>Everything on till</span><b>${day(pl.access_until)}</b></div>
          <div class="row" style="margin-top:14px"><select id="gm" style="width:auto">${[1, 2, 3, 6, 12].map((m) => `<option value="${m}">${m} month${m > 1 ? "s" : ""}</option>`).join("")}</select>
            <input id="gn" placeholder="Reason (e.g. pilot partner)" style="flex:1;min-width:150px"><button class="btn small" id="give">Give free months</button></div>
          <div class="row" style="margin-top:8px"><select id="td" style="width:auto">${[7, 14, 30, 60].map((n) => `<option value="${n}">${n} days</option>`).join("")}</select><button class="btn small line" id="ext">Extend free trial</button></div>
          ${ph && ["due", "orders_off", "read_only"].includes(pl.state) ? `<div class="row" style="margin-top:8px"><a class="btn small line" target="_blank" rel="noopener" href="${wa(ph, `Namaste! Your My Market plan payment of ₹150 is due. Pay in the app: Menu → My plan → Pay with UPI. Your payment code: ${d.pay_code}. Thank you!`)}">Send payment reminder</a></div>` : ""}</div>
      </div>
      <div class="card"><h2>Sales, last 30 days</h2>${daily.length ? `<div class="bars">${daily.map((x) => `<div><i style="height:${Math.max(3, (x.value / dMax) * 100)}%" title="${rupee(x.value)}"></i><span>${new Date(x.day).getDate()}</span></div>`).join("")}</div>` : '<p class="empty">No bills in 30 days.</p>'}</div>
      <div class="grid2">
        <div class="card"><h2>Payments</h2>${(d.payments || []).map((x) => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:7px 0">
          <span>${x.method === "grant" ? "Free months" : rupee(x.amount)} · ${x.months} month${x.months > 1 ? "s" : ""}<small style="display:block;color:var(--ink3)">${day(x.created_at)}${x.ref ? " · " + esc(x.ref) : ""}${x.reason ? " · " + esc(x.reason) : ""}</small></span>
          <span class="tag ${x.status}">${x.status}</span></div>`).join("") || '<p class="empty">No payments yet.</p>'}</div>
        <div class="card"><h2>Private notes</h2>
          <div class="row"><input id="nt" placeholder="e.g. Called on 5 Nov — will pay Monday" style="flex:1"><button class="btn small" id="addn">Add</button></div>
          ${(d.notes || []).map((n) => `<div class="note">${esc(n.note)}<br><small>${day(n.at)} · +91 ${esc(n.by)}</small></div>`).join("") || '<p class="empty">No notes.</p>'}</div>
      </div>`;
    $("#give").onclick = async () => { const m = +$("#gm").value; if (!confirm(`Give ${s.name} ${m} free month${m > 1 ? "s" : ""}?`)) return;
      try { await rpc("admin_give_months", { p_shop: id, p_months: m, p_note: $("#gn").value }); toast("Free months given"); shopView(id); } catch (e) { toast(e.message); } };
    $("#ext").onclick = async () => { const n = +$("#td").value; if (!confirm(`Extend ${s.name}'s free trial by ${n} days?`)) return;
      try { await rpc("admin_extend_trial", { p_shop: id, p_days: n, p_note: "" }); toast("Free trial extended"); shopView(id); } catch (e) { toast(e.message); } };
    $("#addn").onclick = async () => { const t = $("#nt").value.trim(); if (!t) return;
      try { await rpc("admin_add_note", { p_shop: id, p_note: t }); shopView(id); } catch (e) { toast(e.message); } };
  }

  // ---------- payments ----------
  async function paymentsView() {
    loading("payments", "Payments");
    const [credits, pays, list] = await Promise.all([rpc("admin_credits", { p_only_unmatched: true }), rpc("admin_payments", { p_days: 120 }), getShops()]);
    let rows = null, results = null;
    const overdue = list.filter((s) => ["due", "orders_off", "read_only"].includes(s.plan));
    const opts = list.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.pay_code)}</option>`).join("");
    const draw = () => {
      const withCode = rows ? rows.filter((r) => r.code && r.utr) : [];
      const counts = results ? results.reduce((m, r) => (m[r.result] = (m[r.result] || 0) + 1, m), {}) : null;
      $("#main").innerHTML = `<h1>Payments</h1><p class="sub">Shops pay ₹150 (1 month) or ₹1,500 (1 year) by UPI with their payment code in the note. Load your bank statement and matching payments are marked paid.</p>
        <div class="card"><h2>Load bank statement</h2>
          <label class="btn line" style="cursor:pointer">Choose Excel / CSV file<input type="file" id="stf" accept=".csv,.xls,.xlsx,text/csv" hidden></label>
          ${rows ? `<p style="margin:12px 0 6px"><b>${withCode.length}</b> payment${withCode.length === 1 ? "" : "s"} with a shop code · ${rows.length} credits in the file</p>
            ${withCode.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Code</th><th>Note in the statement</th><th>Date</th><th class="num">Amount</th></tr></thead><tbody>${withCode.slice(0, 200).map((r) => `<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.narration.slice(0, 90))}</td><td>${r.at ? day(r.at) : ""}</td><td class="num">${rupee(r.amount)}</td></tr>`).join("")}</tbody></table></div>
              ${results ? "" : `<button class="btn" id="mark" style="margin-top:12px">Mark ${withCode.length} payment${withCode.length === 1 ? "" : "s"} paid</button>`}` : '<p class="empty">No line has a shop code. Check that your bank statement shows the UPI note.</p>'}` : ""}
          ${results ? `<div class="kpis" style="margin-top:12px"><div class="kpi"><span>Marked paid</span><b>${counts.matched || 0}</b></div><div class="kpi"><span>Already done before</span><b>${counts.already_done || 0}</b></div><div class="kpi"><span>Need a look</span><b>${(counts.unknown_shop || 0) + (counts.too_small || 0) + (counts.error || 0) + (counts.no_code || 0)}</b></div></div>` : ""}</div>
        <div class="card"><h2>Bank credits that need a look <span class="tag ${credits.length ? "due" : ""}">${credits.length}</span></h2>
          ${credits.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Credit</th><th>Problem</th><th>Attach to shop</th></tr></thead><tbody>${credits.map((c) => `<tr>
            <td><b>${rupee(c.amount)}</b> · ${esc(c.utr)}<small>${esc((c.narration || "").slice(0, 80))} · ${day(c.credited_at || c.loaded_at)}</small></td>
            <td><span class="tag ${c.status}">${{ unknown_shop: "Code matches no shop", too_small: "Under ₹150", no_code: "No code" }[c.status] || c.status}</span>${c.code ? `<small>${esc(c.code)}</small>` : ""}</td>
            <td><div class="row"><select data-shop="${esc(c.utr)}" style="width:auto;max-width:220px"><option value="">Choose shop…</option>${opts}</select>
              <select data-m="${esc(c.utr)}" style="width:auto">${[1, 2, 3, 6, 12].map((m) => `<option ${(c.amount >= 1500 && m === 12) || (c.amount < 1500 && m === 1) ? "selected" : ""}>${m}</option>`).join("")}</select><span class="small">months</span>
              <button class="btn small" data-attach="${esc(c.utr)}">Mark paid</button></div></td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Nothing to check.</p>'}</div>
        <div class="card"><h2>Overdue shops <span class="tag due">${overdue.length}</span></h2>
          ${overdue.length ? overdue.map((s) => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:7px 0"><span><a href="#/shop/${s.id}">${esc(s.name)}</a> <span class="tag ${s.plan}">${PLAN[s.plan]}</span><small style="display:block;color:var(--ink3)">${esc(s.phone || "")} · code ${esc(s.pay_code)}</small></span>
            ${s.phone ? `<a class="btn small line" target="_blank" rel="noopener" href="${wa(s.phone, `Namaste! Your My Market plan payment of ₹150 is due. Pay in the app: Menu → My plan → Pay with UPI. Your payment code: ${s.pay_code}. Thank you!`)}">WhatsApp reminder</a>` : ""}</div>`).join("") : '<p class="empty">No shop is overdue.</p>'}</div>
        <div class="card"><h2>All payments, last 120 days <a href="#" id="pcsv" style="font-weight:400;font-size:13px">Download as Excel (CSV)</a></h2>
          ${pays.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Shop</th><th class="num">Amount</th><th>Months</th><th>How</th><th>Status</th><th>Reference</th></tr></thead><tbody>${pays.map((x) => `<tr>
            <td>${day(x.decided_at || x.created_at)}</td><td><a href="#/shop/${x.shop_id}">${esc(x.shop)}</a><small>${esc(x.pay_code)}</small></td><td class="num">${x.method === "grant" ? "free" : rupee(x.amount)}</td><td>${x.months}</td>
            <td>${{ upi: "UPI", grant: "Given free", gateway: "Gateway" }[x.method] || x.method}</td><td><span class="tag ${x.status}">${x.status}</span></td><td>${esc(x.ref || "")}<small>${esc(x.reason || "")}</small></td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">No payments yet.</p>'}</div>`;
      $("#stf").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return; results = null;
        try {
          let grid;
          if (/\.csv$/i.test(f.name) || f.type === "text/csv") {
            grid = (await f.text()).split(/\r?\n/).map((line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; });
          } else {
            const X = await MM_STATEMENT.loadXLSX(); const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
            grid = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
          }
          rows = MM_STATEMENT.statementRows(grid);
          if (!rows) toast("Couldn't find the narration and credit columns in this file");
        } catch (x) { toast(x.message || "Couldn't read this file"); }
        draw();
      };
      $("#mark") && ($("#mark").onclick = async (ev) => {
        ev.target.disabled = true; ev.target.textContent = "Marking…";
        try {
          const all = []; const send = withCode.map(({ utr, amount, narration, at }) => ({ utr, amount, narration, at }));
          for (let i = 0; i < send.length; i += 400) all.push(...(await rpc("admin_import_statement", { p_rows: send.slice(i, i + 400) })));
          results = all; shops = null; toast("Statement loaded");
        } catch (x) { toast(x.message); ev.target.disabled = false; ev.target.textContent = "Try again"; return; }
        draw();
      });
      $$("[data-attach]").forEach((b) => b.onclick = async () => {
        const u = b.dataset.attach, sid = $(`[data-shop="${u}"]`).value, m = +$(`[data-m="${u}"]`).value;
        if (!sid) return toast("Choose the shop first");
        if (!confirm(`Mark this payment as ${m} month${m > 1 ? "s" : ""} for the chosen shop?`)) return;
        try { await rpc("admin_attach_credit", { p_utr: u, p_shop: sid, p_months: m }); toast("Marked paid"); shops = null; paymentsView(); } catch (e) { toast(e.message); }
      });
      $("#pcsv") && ($("#pcsv").onclick = (e) => { e.preventDefault(); csv("my-market-payments", ["Date", "Shop", "Payment code", "Amount", "Months", "How", "Status", "Reference", "Note"],
        pays.map((x) => [day(x.decided_at || x.created_at), x.shop, x.pay_code, x.method === "grant" ? 0 : x.amount, x.months, x.method, x.status, x.ref, x.reason])); });
    };
    draw();
  }

  // ---------- customers & demand ----------
  async function demandView() {
    loading("demand", "Customers & demand");
    let days = 30;
    const draw = async () => {
      const d = await rpc("admin_demand", { p_days: days });
      const o = d.orders || {};
      $("#main").innerHTML = `<h1>Customers & demand</h1><p class="sub">What customers search for in the customer app — and what no shop had. Use it to sign up the right shops.</p>
        <div class="chips">${[7, 30, 90].map((n) => `<button class="chip ${n === days ? "on" : ""}" data-d="${n}">Last ${n} days</button>`).join("")}</div>
        <div class="kpis"><div class="kpi"><span>Website orders</span><b>${o.n || 0}</b><em>${o.holds || 0} holds · ${rupee(o.value)}</em></div><div class="kpi"><span>Collected</span><b>${o.done || 0}</b></div><div class="kpi"><span>Cancelled</span><b>${o.cancelled || 0}</b></div></div>
        <div class="grid2">
          <div class="card"><h2>Most searched</h2>${(d.top || []).map((x) => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:6px 0"><span>${esc(x.q)}</span><span><b>${x.n}</b>${x.missed ? ` <small style="color:var(--bad)">${x.missed} found nothing</small>` : ""}</span></div>`).join("") || '<p class="empty">No searches yet.</p>'}</div>
          <div class="card"><h2>Searched, nobody had it</h2>${(d.missed || []).map((x) => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:6px 0"><span>${esc(x.q)}</span><span><b>${x.n}</b> <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}">area</a></span></div>`).join("") || '<p class="empty">Nothing missed.</p>'}</div>
        </div>`;
      $$("[data-d]").forEach((b) => b.onclick = () => { days = +b.dataset.d; draw(); });
    };
    await draw();
  }

  // ---------- activity log ----------
  // ---------- shops on Google: Maps profile and Shopping, who needs help ----------
  const GBP = { none: "Not started", started: "Submitted", verifying: "Verifying", live: "Live on Maps" };
  const MC = { none: "Not started", started: "Started", feeds: "Links added", review: "In review", live: "Products live" };
  async function googleView() {
    loading("google", "On Google");
    const list = await rpc("admin_google");
    let f = "all";
    const F = { all: "All", help: "Asked for help", nomaps: "Not on Maps", maps: "On Maps, no Shopping", shopping: "Products live" };
    const draw = () => {
      const rows = list.filter((s) => f === "all" || (f === "help" && s.help_at) || (f === "nomaps" && s.gbp_status !== "live")
        || (f === "maps" && s.gbp_status === "live" && s.mc_status !== "live") || (f === "shopping" && s.mc_status === "live"));
      const n = (k, v) => list.filter((s) => s[k] === v).length;
      $("#main").innerHTML = `<h1>On Google</h1><p class="sub">Each shop's Google Maps profile and Google Shopping set-up. Shops do it in the app (menu → Get found on Google); help the stuck ones.</p>
        <div class="kpis">
          <div class="kpi"><span>Live on Google Maps</span><b>${n("gbp_status", "live")}</b><em>of ${list.length} shops</em></div>
          <div class="kpi"><span>Products on Google Shopping</span><b>${n("mc_status", "live")}</b><em>${n("mc_status", "review")} in review</em></div>
          <div class="kpi"><span>Asked for help</span><b>${list.filter((s) => s.help_at).length}</b></div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0">${Object.entries(F).map(([k, l]) => `<button class="chip ${f === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
        ${rows.length ? `<table class="tbl"><thead><tr><th>Shop</th><th>Owner / phone</th><th>Google Maps</th><th>Google Shopping</th><th class="num">Items ready</th><th>Help</th><th></th></tr></thead><tbody>
          ${rows.map((s) => { const ph = String(s.phone || "").replace(/\D/g, "").slice(-10); return `<tr><td><a href="#/shop/${s.id}"><b>${esc(s.name)}</b></a><small>${esc(s.locality || "")}</small></td>
            <td>${esc(s.owner_name || "—")}<small>${esc(s.phone || "")}${s.gmail ? " · " + esc(s.gmail) : ""}</small></td>
            <td>${GBP[s.gbp_status] || s.gbp_status}${s.maps_url ? `<small><a href="${esc(s.maps_url)}" target="_blank" rel="noopener">Maps</a>${s.review_url ? ` · <a href="${esc(s.review_url)}" target="_blank" rel="noopener">reviews</a>` : ""}</small>` : ""}</td>
            <td>${MC[s.mc_status] || s.mc_status}<small>${s.merchant_id ? "MC " + esc(s.merchant_id) : ""} · ${esc(s.store_code || "")}</small></td>
            <td class="num">${s.ready_items} / ${s.items}</td>
            <td>${s.help_at ? `<b>${day(s.help_at)}</b><small>${esc(s.help_note || "")}</small>` : ""}</td>
            <td>${ph ? `<a href="https://wa.me/91${ph}?text=${encodeURIComponent(`Namaste ${s.owner_name || ""}! This is My Market. Let's get ${s.name} on Google — open the My Market Business app → menu → Get found on Google. Reply here if you're stuck and we'll help.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</td></tr>`; }).join("")}</tbody></table>`
          : '<p class="empty">No shops match.</p>'}`;
      $$("[data-f]").forEach((b) => b.onclick = () => { f = b.dataset.f; draw(); });
    };
    draw();
  }

  async function activityView() {
    loading("activity", "Activity log");
    const log = await rpc("admin_activity");
    const W = { give_months: "Gave free months", extend_trial: "Extended free trial", note: "Added a note", attach_credit: "Marked a bank credit paid", import_statement: "Loaded a bank statement" };
    $("#main").innerHTML = `<h1>Activity log</h1><p class="sub">Every change made in this admin app — who, what, when.</p>
      <div class="card scroll">${log.length ? `<table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Shop</th><th>Details</th></tr></thead><tbody>${log.map((l) => `<tr><td>${new Date(l.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
        <td>${esc(l.by)}</td><td>${W[l.action] || esc(l.action)}</td><td>${esc(l.shop || "—")}</td><td><small>${esc(Object.entries(l.detail || {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${v}`).join(" · "))}</small></td></tr>`).join("")}</tbody></table>` : '<p class="empty">Nothing yet.</p>'}</div>`;
  }

  // ---------- export ----------
  function csv(name, head, rows) {
    const q = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const blob = new Blob(["﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  start();
})();
