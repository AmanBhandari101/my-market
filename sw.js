// Network-first for app files so updates show immediately; cache is only the
// offline fallback. Map tiles and routing are not cached in v1.
const CACHE = "mymarket-v2.0";
const SHELL = ["./", "index.html", "css/app.css", "css/commerce.css", "css/store.css","js/config.js", "js/cloud.js", "js/data.js", "js/api.js", "js/app.js", "js/shop.js", "js/biz.js", "icon.svg", "manifest.webmanifest", "business.html", "icon-business.svg", "manifest-business.webmanifest", "icons/icon-192.png", "icons/icon-business-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
