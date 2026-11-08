// My Market — the customer app on its own address, with pages Google can read.
//
//   /shop/<slug>              a shop page          (opens the app's #/shop/<id> screen)
//   /p/<area>/<product>       a product in an area (opens the app's #/p/<area>/<product> screen)
//   /shop/<slug>/i/<item>     one item at one shop: Google Shopping's product page (opens #/item/<shop>/<item>)
//   /feeds/<slug>/products.tsv, /feeds/<slug>/local.tsv   the shop's product and stock feeds for Google Merchant Center
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
    sameAs: s.maps_url ? [s.maps_url] : undefined,
  };
  const row = (i) => `<li><a href="/shop/${esc(s.slug)}/i/${esc(i.id)}">${esc(i.name)}</a>${i.brand ? ` · ${esc(i.brand)}` : ""}`
    + `${i.price ? ` · <b>${inr(i.price)}</b>` : ""}${i.mrp && i.price && i.mrp > i.price ? ` <s>${inr(i.mrp)}</s>` : ""} · ${esc((STOCK[i.stock] || ["Listed"])[0])}`
    + `${i.p ? ` · <a href="${esc(i.p)}">other shops nearby</a>` : ""}</li>`;
  const body = wrap(`${crumbs([["My Market", "/"], [place || kind]])}
    <h1 style="margin:0 0 6px">${esc(s.name)}</h1>
    <p style="margin:0">${esc(kind)}${place ? ` in ${esc(place)}` : ""}${s.pincode ? ` – ${esc(s.pincode)}` : ""}</p>
    ${addressLine(s) ? `<p style="margin:4px 0">${esc(addressLine(s))}</p>` : ""}
    <p style="margin:4px 0">${esc(hoursText(s))}</p>
    ${ph ? `<p style="margin:4px 0">Phone: <a href="tel:+91${ph}">+91 ${ph}</a> · <a href="https://wa.me/91${ph}">WhatsApp</a></p>` : ""}
    ${s.lat != null ? `<p style="margin:4px 0"><a href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lng}">Directions</a></p>` : ""}
    ${s.about ? `<p>${esc(s.about)}</p>` : ""}
    ${s.delivery ? "<p>Home delivery available</p>" : ""}
    ${s.maps_url ? `<p><a href="${esc(s.maps_url)}">See us on Google Maps</a>${s.review_url ? ` · <a href="${esc(s.review_url)}">Reviews</a>` : ""}</p>` : ""}
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

// ---------- one item at one shop (Google Shopping's product page for that shop) ----------
// Price, stock, the shop and how to get it are on the page itself, so they always match the feeds.
const fullTitle = (i) => {
  const name = String(i.name || "").trim(), size = i.size && !name.toLowerCase().includes(String(i.size).toLowerCase()) ? ` ${i.size}` : "";
  const brand = i.brand && i.brand !== "Generic" && !name.toLowerCase().includes(String(i.brand).toLowerCase()) ? `${i.brand} ` : "";
  return cut(`${brand}${name}${size}`, 150);
};
const itemPhoto = (env, i) => photo(env, i.photo_path) || photo(env, i.product_photo_path, i.product_photo_url);
async function itemPage(env, origin, slug, itemId) {
  const d = await rpc(env, "seo_item", { p_slug: slug, p_item: itemId });
  if (!d || !d.shop || !d.item) return null;
  const s = d.shop, i = d.item, url = `${origin}/shop/${s.slug}/i/${i.id}`, shopUrl = `${origin}/shop/${s.slug}`;
  const ph = phone10(s.phone), place = s.locality || "", title0 = fullTitle(i), image = itemPhoto(env, i);
  const st = STOCK[i.stock] || STOCK.listed, sale = i.mrp && i.price && i.mrp > i.price;
  const title = cut(`${title0}${i.price ? ` – ${inr(i.price)}` : ""} at ${s.name}${place ? `, ${place}` : ""} | My Market`, 70);
  const desc = cut(`${title0}${i.price ? ` for ${inr(i.price)}` : ""} at ${s.name}${place ? ` in ${place}` : ""}. ${st[0]}. Pick it up today — see the shop's hours, directions and WhatsApp.`, 158);
  const store = { "@type": ldType(s.cat), "@id": shopUrl + "#shop", name: s.name, url: shopUrl, address: postal(s), telephone: ph ? `+91${ph}` : undefined };
  const ld = {
    "@context": "https://schema.org", "@type": "Product", "@id": url + "#product", name: title0, url,
    image: image || undefined, brand: i.brand && i.brand !== "Generic" ? { "@type": "Brand", name: i.brand } : undefined,
    gtin: /^\d{8}$|^\d{12,14}$/.test(i.barcode || "") ? i.barcode : undefined, mpn: i.model || undefined,
    description: i.description || (i.features && i.features.length ? i.features.join(". ") : undefined),
    offers: i.price ? { "@type": "Offer", price: i.price, priceCurrency: "INR", url, itemCondition: "https://schema.org/NewCondition",
      availability: st[1] || undefined, seller: store, availableAtOrFrom: store,
      availableDeliveryMethod: "https://schema.org/OnSitePickup" } : undefined,
  };
  const body = wrap(`${crumbs([["My Market", "/"], [s.name, `/shop/${s.slug}`], [title0]])}
    <h1 style="margin:0 0 6px">${esc(title0)}</h1>
    ${image ? `<img src="${esc(image)}" alt="${esc(title0)}" style="max-width:320px;width:100%;height:auto;display:block;margin:8px 0">` : ""}
    <p style="font-size:22px;margin:6px 0">${i.price ? `<b>${inr(i.price)}</b>${sale ? ` <s style="font-size:16px">${inr(i.mrp)}</s>` : ""}` : "Ask the shop for the price"}</p>
    <p style="margin:4px 0"><b>${esc(st[0])}</b> at <a href="/shop/${esc(s.slug)}">${esc(s.name)}</a>${place ? `, ${esc(place)}` : ""}</p>
    <p style="margin:4px 0">${esc(addressLine(s))}${addressLine(s) ? " · " : ""}${esc(hoursText(s))}</p>
    <p style="margin:4px 0">Pick up at the shop — pay there by cash or UPI.${s.delivery ? " Home delivery available." : ""}</p>
    ${ph ? `<p style="margin:4px 0"><a href="https://wa.me/91${ph}">Ask on WhatsApp</a> · <a href="tel:+91${ph}">Call</a>${s.lat != null ? ` · <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lng}">Directions</a>` : ""}</p>` : ""}
    ${i.features && i.features.length ? `<h2>About this item</h2><ul>${i.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${i.description ? `<p>${esc(i.description)}</p>` : ""}`);
  return { title, desc, canonical: url, index: !!(i.price && image), image, ld, body, hash: `/item/${s.id}/${i.id}`, ogType: "product" };
}

// ---------- feeds Google Merchant Center fetches (tab-separated, one per shop) ----------
// products.tsv: what the shop sells.  local.tsv: what is in stock at the shop today, at what price.
// Only items Google accepts: a price and a photo. Stock not updated for 7 days is left out of local.tsv.
const tsvCell = (v) => String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();
const tsv = (head, rows) => new Response([head, ...rows].map((r) => r.map(tsvCell).join("\t")).join("\n") + "\n",
  { headers: { "content-type": "text/tab-separated-values; charset=utf-8", "cache-control": "public, max-age=1800, s-maxage=1800" } });
async function feed(env, origin, slug, kind) {
  const d = await rpc(env, "seo_feed", { p_slug: slug });
  if (!d || !d.shop) return null;
  const s = d.shop, ok = (d.items || []).filter((i) => i.price > 0 && itemPhoto(env, i) && String(i.name || "").trim().length >= 3);
  const money = (n) => `${Number(n).toFixed(2)} INR`;
  if (kind === "products") {
    return tsv(["id", "title", "description", "link", "image_link", "availability", "price", "sale_price", "brand", "gtin", "mpn", "identifier_exists", "condition", "product_type"],
      ok.map((i) => {
        const brand = i.brand && i.brand !== "Generic" ? i.brand : "", gtin = /^\d{8}$|^\d{12,14}$/.test(i.barcode || "") ? i.barcode : "";
        const sale = i.mrp && i.mrp > i.price;
        return [i.id, fullTitle(i),
          i.description || (i.features && i.features.length ? i.features.join(". ") : `${fullTitle(i)} — available at ${s.name}. Pick it up today.`),
          `${origin}/shop/${s.slug}/i/${i.id}`, itemPhoto(env, i),
          i.stock === "out" ? "out_of_stock" : "in_stock",
          money(sale ? i.mrp : i.price), sale ? money(i.price) : "",
          brand, gtin, i.model || "", gtin || (brand && i.model) ? "yes" : "no", "new", catName(i.cat).replace(/ shop$/i, "")];
      }));
  }
  const AV = { in: "in_stock", few: "limited_availability", out: "out_of_stock" };
  return tsv(["store_code", "id", "availability", "price", "sale_price", "pickup_method", "pickup_sla"],
    ok.filter((i) => AV[i.stock]).map((i) => {
      const sale = i.mrp && i.mrp > i.price;
      return [d.store_code, i.id, AV[i.stock], money(sale ? i.mrp : i.price), sale ? money(i.price) : "", "reserve", "same day"];
    }));
}

// ---------- order alerts: Web Push to the shopkeeper's phones ----------
// Supabase calls POST /push/order when an order is placed (supabase/push.sql), with the shop's phones and
// the order. Each alert is encrypted for that phone (RFC 8291) and signed with My Market's VAPID key (RFC 8292).
// Settings: VAPID_PUBLIC (base64url, 65-byte P-256 point) and VAPID_PRIVATE (JWK, kept as a secret).
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
const utf8 = (s) => new TextEncoder().encode(s);
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
// aes128gcm body for one phone: salt(16) | record size(4) | key length(1) | our public key(65) | ciphertext
async function encryptPush(sub, plaintext, local) {
  const uaPublic = b64u.dec(sub.p256dh), authSecret = b64u.dec(sub.auth);
  local = local || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = local.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(utf8(plaintext), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}
let vapidKey = null;
async function vapidAuth(env, endpoint) {
  vapidKey = vapidKey || await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u.enc(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.enc(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.PUSH_CONTACT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapidKey, utf8(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u.enc(sig)}, k=${env.VAPID_PUBLIC}`;
}
async function pushRaw(env, sub, payload) {
  if (!/^https:\/\//.test(sub.endpoint || "")) return new Response("bad endpoint", { status: 400 });
  const body = await encryptPush(sub, JSON.stringify(payload));
  return fetch(sub.endpoint, { method: "POST", body, headers: {
    authorization: await vapidAuth(env, sub.endpoint), "content-encoding": "aes128gcm", "content-type": "application/octet-stream",
    // no "topic" header: the push service would merge alerts that share one, and every alert must ring
    ttl: "3600", urgency: "high" } });
}
const sendPush = async (env, sub, payload) => (await pushRaw(env, sub, payload)).status;

// "Send a test alert" from the shop app: straight to this phone, and the push service's answer goes back
// to the app so the owner (and we) can see what happened. Only a logged-in member of the shop may use it.
async function pushTest(request, env) {
  const cors = { "access-control-allow-origin": env.ALLOW_ORIGIN, "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "86400", vary: "origin" };
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) return out({ error: "Alert keys aren't set on the server" }, 503);
  let d; try { d = await request.json(); } catch { return out({ error: "Bad request" }, 400); }
  const sub = d.sub || {};
  if (!/^[0-9a-f-]{36}$/.test(d.shop_id || "") || !/^https:\/\//.test(sub.endpoint || "") || !sub.p256dh || !sub.auth) return out({ error: "Bad request" }, 400);
  // is the caller a member of this shop? (their own login token; RLS answers)
  const chk = await fetch(`${env.SUPABASE_URL}/rest/v1/shops?select=id&id=eq.${d.shop_id}`, {
    headers: { apikey: env.SUPABASE_KEY, authorization: request.headers.get("authorization") || "" } });
  const rows = chk.ok ? await chk.json().catch(() => []) : [];
  if (!Array.isArray(rows) || !rows.length) return out({ error: "Log in to your shop again, then try" }, 403);
  const r = await pushRaw(env, sub, orderAlert({ test: true }));
  const text = (await r.text().catch(() => "")).slice(0, 300);
  return out({ status: r.status, ok: r.status >= 200 && r.status < 300, detail: text, service: new URL(sub.endpoint).host });
}
// Every alert gets its own tag, so it arrives as a NEW notification. Re-using a tag replaces the
// previous notification, and Android plays the sound only for the first one (later ones were silent).
function orderAlert(o) {
  const stamp = Date.now().toString(36);
  const time = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(11, 16);   // India time, for the owner to tell tests apart
  if (o.test) return { title: "🔔 Test alert", body: `Order alerts work on this phone (${time}). New orders will ring like this.`, tag: "mm-test-" + stamp, url: "business.html#/biz/inbox" };
  const what = o.kind === "hold" ? "Hold request" : "New order";
  const money = o.total ? ` · ${inr(o.total)}` : "";
  return { title: `🛒 ${what} ${o.code || ""}${money}`.trim(),
    body: `${o.name || "A customer"} · ${o.items || 1} item${o.items === 1 ? "" : "s"} · ${o.mode === "delivery" ? "Delivery" : "Pickup"} — tap to open`,
    tag: "mm-order-" + (o.code || "x") + "-" + stamp, url: "business.html#/biz/inbox" };
}
async function pushOrder(request, env) {
  if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) return new Response("Push keys not set", { status: 503 });
  const secret = request.headers.get("x-push-secret") || "";
  if (secret.length < 32 || !(await rpc(env, "push_secret_ok", { p_secret: secret }))) return new Response("Forbidden", { status: 403 });
  let d; try { d = await request.json(); } catch { return new Response("Bad body", { status: 400 }); }
  const subs = Array.isArray(d.subs) ? d.subs.slice(0, 20) : [], alert = orderAlert(d.order || {});
  const res = await Promise.all(subs.map((s) => sendPush(env, s, alert).catch(() => 0)));
  const gone = subs.filter((s, i) => res[i] === 404 || res[i] === 410).map((s) => s.endpoint);
  if (gone.length) await rpc(env, "push_gone", { p_secret: secret, p_endpoints: gone }).catch(() => 0);
  return new Response(JSON.stringify({ sent: res.filter((x) => x >= 200 && x < 300).length, results: res }), { headers: { "content-type": "application/json" } });
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
  if (path === "/push/order" && request.method === "POST") return pushOrder(request, env);
  if (path === "/push/test" && (request.method === "POST" || request.method === "OPTIONS")) return pushTest(request, env);
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
  if ((m = path.match(/^\/shop\/([a-z0-9-]{1,80})\/i\/([0-9a-f-]{36})\/?$/))) {
    const [p, html] = await Promise.all([itemPage(env, origin, m[1], m[2]), shell(env)]);
    if (!p) return notFound(origin, "This item isn't listed any more.");
    return htmlRes(inject(html, p), 200, p.index, PAGE_TTL);
  }
  if ((m = path.match(/^\/feeds\/([a-z0-9-]{1,80})\/(products|local)\.tsv$/))) {
    const r = await feed(env, origin, m[1], m[2]);
    return r || new Response("Not found", { status: 404 });
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
  PUSH_CONTACT: "https://mymarket.aman101bhandari.workers.dev",
  ALLOW_ORIGIN: "https://amanbhandari101.github.io",
  ...Object.fromEntries(Object.entries(env || {}).filter(([, v]) => typeof v === "string" && v)),
});

export default {
  async fetch(request, env, ctx) {
    env = defaults(env);
    const url = new URL(request.url);
    const cacheable = request.method === "GET" && /^\/(shop|p|sitemaps|feeds)\/|^\/sitemap\.xml$/.test(url.pathname);
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
export { handle, defaults, inject, encryptPush, b64u, hkdf };
