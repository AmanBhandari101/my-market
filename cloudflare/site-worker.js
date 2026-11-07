// My Market — the customer app on its own address, with pages Google can read.
//
//   /shop/<slug>              a shop page          (opens the app's #/shop/<id> screen)
//   /p/<area>/<product>       a product in an area (opens the app's #/p/<area>/<product> screen)
//   /sitemap.xml, /sitemaps/<shops|products>-<n>.xml, /robots.txt
//   everything else           the customer app itself, fetched from GitHub Pages
//
// For a shop or product page the worker takes the app's index.html and fills in, before sending it:
// the title and description, a canonical link, the page's text (name, address, hours, items, prices)
// and schema.org data (Store / Product with offers). Google reads that straight away; for people the
// app starts as usual and shows the same screen. Each page is kept at Cloudflare for 30 minutes, so
// Google's crawler and repeat visits don't reach the database.
//
// Settings (Cloudflare dashboard → Worker → Settings → Variables):
//   SUPABASE_URL  https://dhcpzdwzbndntnekuiud.supabase.co
//   SUPABASE_KEY  the publishable key from js/config.js (public by design)
//   APP_ORIGIN    https://amanbhandari101.github.io/my-market   (where the app files are published)
//   PHOTOS_URL    https://mymarket-photos.aman101bhandari.workers.dev   (the photo service)
//   SHOP_APP      https://amanbhandari101.github.io/my-market/business.html (shop owners keep using this)
// Needs supabase/seo.sql applied.

const PAGE_TTL = 1800, MAP_TTL = 6 * 3600, SHELL_TTL = 300;

const CATS = {
  mobile: ["Mobile phone shop", "MobilePhoneStore"], electronics: ["Electronics shop", "ElectronicsStore"],
  electrical: ["Electrical shop", "HardwareStore"], hardware: ["Hardware shop", "HardwareStore"],
  plumbing: ["Plumbing and sanitary shop", "HardwareStore"], clothes: ["Clothes shop", "ClothingStore"],
  footwear: ["Footwear shop", "ShoeStore"], kitchen: ["Kitchenware shop", "HomeGoodsStore"],
  grocery: ["Grocery shop", "GroceryStore"], pharmacy: ["Chemist", "Pharmacy"],
  stationery: ["Stationery shop", "Store"], accessories: ["Accessories shop", "Store"],
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STOCK = { in: ["In stock", "https://schema.org/InStock"], few: ["Only a few left", "https://schema.org/LimitedAvailability"],
  listed: ["Listed — ask the shop", null], out: ["Out of stock", "https://schema.org/OutOfStock"] };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
// Indian digit grouping without relying on Intl: 125000 → 1,25,000
const inr = (n) => { const s = String(Math.round(n)); const last = s.slice(-3), rest = s.slice(0, -3);
  return "₹" + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last; };
const hour = (h) => `${String(h).padStart(2, "0")}:00`;
const hour12 = (h) => (h % 12 || 12) + (h < 12 ? " am" : " pm");
const phone10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const catName = (c) => (CATS[c] || ["Shop"])[0];
const ldType = (c) => (CATS[c] || [0, "Store"])[1];

// our own photo (path) first, then an openly licensed one (url)
function photo(env, path, url) {
  if (!path) return url || null;
  if (path.startsWith("r2/")) return `${env.PHOTOS_URL}/p/${path.slice(3)}`;
  return `${env.SUPABASE_URL}/storage/v1/object/public/item-photos/${path}`;
}
const addressLine = (s) => [s.shop_no && s.shop_no !== "—" ? `Shop ${s.shop_no}` : "", s.floor, s.landmark].filter(Boolean).join(", ");
function postal(s) {
  return { "@type": "PostalAddress", streetAddress: addressLine(s) || undefined, addressLocality: s.locality || undefined,
    postalCode: s.pincode || undefined, addressCountry: "IN" };
}
function hoursLd(s) {
  const open = DAYS.filter((d) => d !== s.closed_day);
  return [{ "@type": "OpeningHoursSpecification", dayOfWeek: open.map((d) => `https://schema.org/${d}`), opens: hour(s.open_h), closes: hour(s.close_h) }];
}
const hoursText = (s) => `Open ${hour12(s.open_h)} – ${hour12(s.close_h)}${s.closed_day && s.closed_day !== "None" ? `, closed on ${s.closed_day}` : ", every day"}`;

// ---------- data ----------
async function rpc(env, fn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function shell(env) {
  const r = await fetch(`${env.APP_ORIGIN}/index.html`, { cf: { cacheTtl: SHELL_TTL, cacheEverything: true } });
  if (!r.ok) throw new Error(`app shell: ${r.status}`);
  return r.text();
}

// ---------- the page around the app ----------
// base href="/" so the app's relative files (js/, css/, img/) load from the site root on /shop/… and /p/… pages.
// The small script turns the clean address into the app's own #/… address before the app starts.
function inject(html, p) {
  const ld = p.ld ? `<script type="application/ld+json">${JSON.stringify(p.ld).replace(/</g, "\\u003c")}</script>` : "";
  const start = `<script>(function(){var q=new URLSearchParams(location.search),r=document.referrer,`
    + `s=q.get("src")||(/(^|\\.)google\\./.test(r&&new URL(r).hostname)?"google":"web"),h=${JSON.stringify(p.hash)};`
    + `try{history.replaceState(null,"","/"+(location.hash.length>2?location.hash:"#"+h+(h.indexOf("?")<0?"?":"&")+"src="+s))}catch(e){}})()</script>`;
  const head = `<base href="/">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <link rel="canonical" href="${esc(p.canonical)}">
  <meta name="robots" content="${p.index ? "index, follow, max-image-preview:large" : "noindex, follow"}">
  <meta property="og:type" content="${p.ogType || "website"}"><meta property="og:site_name" content="My Market">
  <meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${esc(p.canonical)}">${p.image ? `<meta property="og:image" content="${esc(p.image)}">` : ""}
  ${ld}${p.hash ? start : ""}`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta name="description"[^>]*>/i, "")
    .replace(/(<meta charset[^>]*>)/i, `$1\n  ${head}`)
    .replace('<div id="app"></div>', `<div id="app">${p.body}</div>`);
}
const wrap = (inner) => `<main class="seo-pre" style="max-width:960px;margin:0 auto;padding:24px 16px;font:16px/1.55 Inter,system-ui,sans-serif;color:#172331">${inner}</main>`;
const crumbs = (list) => `<nav style="font-size:14px;margin-bottom:10px">${list.map(([t, h]) => h ? `<a href="${esc(h)}">${esc(t)}</a>` : esc(t)).join(" › ")}</nav>`;

// ---------- shop page ----------
async function shopPage(env, origin, slug) {
  const d = await rpc(env, "seo_shop", { p_slug: slug });
  if (!d || !d.shop) return null;
  const s = d.shop, items = d.items || [], url = `${origin}/shop/${s.slug}`;
  const ph = phone10(s.phone), kind = catName(s.cat), place = s.locality || (d.market && d.market.name) || "";
  const inStock = items.filter((i) => i.stock === "in" || i.stock === "few");
  const named = (inStock.length ? inStock : items).slice(0, 3).map((i) => i.name).join(", ");
  const image = photo(env, s.cover_path) || photo(env, s.logo_path);
  const title = cut(`${s.name}${place ? `, ${place}` : ""} – ${kind} | My Market`, 70);
  const desc = cut(`${kind}${place ? ` in ${place}` : ""}. ${items.length} items${named ? ` including ${named}` : ""} — see prices and what's in stock, opening hours, directions and WhatsApp.`, 158);
  const offers = items.filter((i) => i.price).slice(0, 60).map((i) => ({
    "@type": "Offer", price: i.price, priceCurrency: "INR", availability: (STOCK[i.stock] || [])[1] || undefined,
    itemOffered: { "@type": "Product", name: i.name, brand: i.brand ? { "@type": "Brand", name: i.brand } : undefined,
      image: photo(env, i.photo_path, i.photo_url) || undefined, gtin: i.barcode || undefined } }));
  const ld = {
    "@context": "https://schema.org", "@type": ldType(s.cat), "@id": url + "#shop", name: s.name, url,
    description: s.about || undefined, image: [...new Set([image, photo(env, s.logo_path)].filter(Boolean))],
    telephone: ph ? `+91${ph}` : undefined, address: postal(s),
    geo: s.lat != null ? { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } : undefined,
    openingHoursSpecification: hoursLd(s),
    paymentAccepted: s.pay_methods && s.pay_methods.length ? s.pay_methods.join(", ") : undefined,
    currenciesAccepted: "INR", makesOffer: offers.length ? offers : undefined,
  };
  const row = (i) => `<li>${i.p ? `<a href="${esc(i.p)}">${esc(i.name)}</a>` : esc(i.name)}${i.brand ? ` · ${esc(i.brand)}` : ""}`
    + `${i.price ? ` · <b>${inr(i.price)}</b>` : ""}${i.mrp && i.price && i.mrp > i.price ? ` <s>${inr(i.mrp)}</s>` : ""} · ${esc((STOCK[i.stock] || ["Listed"])[0])}</li>`;
  const body = wrap(`${crumbs([["My Market", "/"], [place || kind]])}
    <h1 style="margin:0 0 6px">${esc(s.name)}</h1>
    <p style="margin:0">${esc(kind)}${place ? ` in ${esc(place)}` : ""}${s.pincode ? ` – ${esc(s.pincode)}` : ""}</p>
    ${addressLine(s) ? `<p style="margin:4px 0">${esc(addressLine(s))}</p>` : ""}
    <p style="margin:4px 0">${esc(hoursText(s))}</p>
    ${ph ? `<p style="margin:4px 0">Phone: <a href="tel:+91${ph}">+91 ${ph}</a> · <a href="https://wa.me/91${ph}">WhatsApp</a></p>` : ""}
    ${s.lat != null ? `<p style="margin:4px 0"><a href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lng}">Directions</a></p>` : ""}
    ${s.about ? `<p>${esc(s.about)}</p>` : ""}
    ${s.delivery ? `<p>Delivery: ${esc(s.delivery)}</p>` : ""}
    <h2>Products at ${esc(s.name)}</h2>
    <ul>${items.map(row).join("")}</ul>`);
  return { title, desc, canonical: url, index: !!d.index, image, ld, body, hash: `/shop/${s.id}`, ogType: "business.business" };
}

// ---------- product in an area ----------
async function areaPage(env, origin, area, prod) {
  const d = await rpc(env, "seo_area_product", { p_area: area, p_product: prod });
  if (!d || !d.product) return null;
  const p = d.product, offers = d.offers || [];
  if (p.slug !== prod) return { redirect: `${origin}/p/${area}/${p.slug}` };
  if (!offers.length) return null;
  const place = offers[0].locality || area.replace(/-/g, " ");
  const url = `${origin}/p/${area}/${p.slug}`, full = [p.name, p.size && !p.name.toLowerCase().includes(String(p.size).toLowerCase()) ? p.size : ""].filter(Boolean).join(" ");
  const priced = offers.filter((o) => o.price), low = priced.length ? Math.min(...priced.map((o) => o.price)) : null;
  const avail = offers.filter((o) => o.stock === "in" || o.stock === "few").length;
  const image = photo(env, p.photo_path, p.photo_url) || photo(env, offers.find((o) => o.photo_path)?.photo_path);
  const nShops = `${offers.length} shop${offers.length === 1 ? "" : "s"}`;
  const title = cut(`${full} in ${place} – ${avail ? `in stock at ${avail} shop${avail === 1 ? "" : "s"}` : nShops} | My Market`, 70);
  const desc = cut(`${full}${p.brand ? ` (${p.brand})` : ""} near ${place}: ${nShops}${low ? `, from ${inr(low)}` : ""}. See which shop has it in stock, the price, opening hours and directions.`, 158);
  const shopUrl = (o) => o.slug ? `${origin}/shop/${o.slug}` : undefined;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", "@id": url + "#product", name: full, url,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined, model: p.model || undefined,
    image: image || undefined, description: p.description || (p.features && p.features.length ? p.features.join(". ") : undefined),
    gtin: p.barcode || undefined,
    offers: priced.length ? {
      "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: low, highPrice: Math.max(...priced.map((o) => o.price)), offerCount: priced.length,
      offers: priced.map((o) => ({ "@type": "Offer", price: o.price, priceCurrency: "INR", availability: (STOCK[o.stock] || [])[1] || undefined,
        url: shopUrl(o), seller: { "@type": ldType(o.cat), name: o.name, url: shopUrl(o), address: postal(o) } })),
    } : undefined,
  };
  const row = (o) => `<li><a href="${esc(o.slug ? `/shop/${o.slug}` : "/")}">${esc(o.name)}</a>${addressLine(o) ? ` · ${esc(addressLine(o))}` : ""}`
    + ` · ${o.price ? `<b>${inr(o.price)}</b>` : "ask for price"} · ${esc((STOCK[o.stock] || ["Listed"])[0])} · ${esc(hoursText(o))}</li>`;
  const body = wrap(`${crumbs([["My Market", "/"], [place]])}
    <h1 style="margin:0 0 6px">${esc(full)} in ${esc(place)}</h1>
    ${p.brand ? `<p style="margin:0">Brand: ${esc(p.brand)}${p.model ? ` · Model ${esc(p.model)}` : ""}</p>` : ""}
    <p>${esc(nShops)} near ${esc(place)} ${offers.length === 1 ? "has" : "have"} it${low ? `, from ${inr(low)}` : ""}.</p>
    <h2>Shops with ${esc(full)}</h2>
    <ul>${offers.map(row).join("")}</ul>
    ${p.features && p.features.length ? `<h2>About this item</h2><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${p.description ? `<p>${esc(p.description)}</p>` : ""}
    ${p.photo_credit ? `<p style="font-size:13px">Photo: ${esc(p.photo_credit)}</p>` : ""}`);
  return { title, desc, canonical: url, index: !!d.index, image, ld, body, hash: `/p/${area}/${p.slug}`, ogType: "product" };
}

// ---------- sitemaps ----------
const xml = (s) => new Response(s, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": `public, max-age=3600, s-maxage=${MAP_TTL}` } });
async function sitemapIndex(env, origin) {
  const c = await rpc(env, "seo_sitemap_counts", {});
  const parts = [];
  for (const kind of ["shops", "products"]) for (let i = 1; i <= Math.max(kind === "shops" ? 1 : 0, Math.ceil((c[kind] || 0) / 45000)); i++)
    parts.push(`<sitemap><loc>${origin}/sitemaps/${kind}-${i}.xml</loc></sitemap>`);
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${parts.join("")}</sitemapindex>`);
}
async function sitemap(env, origin, kind, page) {
  const rows = await rpc(env, "seo_sitemap", { p_kind: kind, p_page: page });
  const urls = (kind === "shops" && page === 1 ? [{ path: "/" }] : []).concat(rows || [])
    .map((r) => `<url><loc>${esc(origin + r.path)}</loc>${r.lastmod ? `<lastmod>${new Date(r.lastmod).toISOString()}</lastmod>` : ""}</url>`);
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
}

// ---------- responses ----------
const htmlRes = (body, status, index, ttl) => new Response(body, { status, headers: {
  "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=300, s-maxage=${ttl}`,
  ...(index ? {} : { "x-robots-tag": "noindex" }) } });
function notFound(origin, what) {
  return htmlRes(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex"><title>Not found | My Market</title></head>
    <body style="font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px">
    <h1>${esc(what)}</h1><p><a href="${origin}/">Find shops near you on My Market</a></p></body></html>`, 404, false, 600);
}

async function handle(request, env) {
  const url = new URL(request.url), origin = url.origin, path = url.pathname;
  if (request.method !== "GET" && request.method !== "HEAD") return proxy(request, env, url);

  if (path === "/robots.txt")
    return new Response(`User-agent: *\nAllow: /\nDisallow: /business.html\nDisallow: /admin.html\nDisallow: /bill.html\n\nSitemap: ${origin}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
  if (path === "/sitemap.xml") return sitemapIndex(env, origin);
  let m = path.match(/^\/sitemaps\/(shops|products)-(\d{1,4})\.xml$/);
  if (m) return sitemap(env, origin, m[1], +m[2]);

  // shop owners keep using the shop app where their login lives
  if (/^\/(business|admin)\.html$/.test(path)) return Response.redirect(`${env.SHOP_APP.replace(/business\.html$/, "")}${path.slice(1)}${url.search}${url.hash}`, 302);

  if ((m = path.match(/^\/shop\/([a-z0-9-]{1,80})\/?$/))) {
    if (path.endsWith("/")) return Response.redirect(`${origin}/shop/${m[1]}${url.search}`, 301);
    const [p, html] = await Promise.all([shopPage(env, origin, m[1]), shell(env)]);
    if (!p) return notFound(origin, "This shop isn't on My Market (any more).");
    return htmlRes(inject(html, p), 200, p.index, PAGE_TTL);
  }
  if ((m = path.match(/^\/p\/([a-z0-9-]{1,80})\/([a-z0-9-]{8,90})\/?$/))) {
    const [p, html] = await Promise.all([areaPage(env, origin, m[1], m[2]), shell(env)]);
    if (p && p.redirect) return Response.redirect(p.redirect, 301);
    if (!p) return notFound(origin, "No shop here has this right now.");
    return htmlRes(inject(html, p), 200, p.index, PAGE_TTL);
  }
  return proxy(request, env, url);
}

// the app's own files, straight from GitHub Pages
async function proxy(request, env, url) {
  const r = await fetch(`${env.APP_ORIGIN}${url.pathname === "/" ? "/" : url.pathname}${url.search}`, {
    method: request.method, headers: { accept: request.headers.get("accept") || "*/*" }, redirect: "manual",
    cf: { cacheTtl: 60, cacheEverything: true } });
  const out = new Response(r.body, r);
  out.headers.delete("x-github-request-id"); out.headers.delete("x-fastly-request-id");
  return out;
}

const defaults = (env) => ({
  SUPABASE_URL: "https://dhcpzdwzbndntnekuiud.supabase.co",
  APP_ORIGIN: "https://amanbhandari101.github.io/my-market",
  PHOTOS_URL: "https://mymarket-photos.aman101bhandari.workers.dev",
  SHOP_APP: "https://amanbhandari101.github.io/my-market/business.html",
  ...Object.fromEntries(Object.entries(env || {}).filter(([, v]) => typeof v === "string" && v)),
});

export default {
  async fetch(request, env, ctx) {
    env = defaults(env);
    const url = new URL(request.url);
    const cacheable = request.method === "GET" && /^\/(shop|p|sitemaps)\/|^\/sitemap\.xml$/.test(url.pathname);
    const cache = cacheable && typeof caches !== "undefined" && caches.default;
    const key = cache && new Request(url.origin + url.pathname);   // ?src=qr etc. only matter inside the app
    if (cache) { const hit = await cache.match(key); if (hit) return hit; }
    let res;
    try { res = await handle(request, env); }
    catch (e) {
      console.error(e && e.stack || e);
      return new Response("My Market is busy — please try again in a minute.", { status: 503, headers: { "retry-after": "120", "content-type": "text/plain; charset=utf-8" } });
    }
    if (cache && res.status < 500 && !res.headers.has("location")) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
export { handle, defaults, inject };
