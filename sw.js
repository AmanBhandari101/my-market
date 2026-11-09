// Network-first for app files so updates show immediately; cache is only the
// offline fallback. Map tiles and routing are not cached in v1.
const CACHE = "mymarket-v2.8";
const SHELL = ["./", "index.html", "css/app.css", "css/commerce.css", "css/store.css", "css/biz.css", "css/customer.css","js/config.js", "js/cloud.js", "js/data.js", "js/api.js", "js/app.js", "js/shop.js", "js/biz.js", "icon.svg", "manifest.webmanifest", "business.html", "icon-business.svg", "manifest-business.webmanifest", "icons/icon-192.png", "icons/icon-business-192.png"];

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

// ---------- order alerts (Web Push) ----------
// A new order rings the shopkeeper's phone even when the app is closed. The alert text comes
// encrypted from cloudflare/site-worker.js. An open shop app also hears it and rings at once.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = d.title || "🛒 New order on My Market";
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || "Tap to open your orders", tag: d.tag || "mm-order-" + Date.now(), renotify: true, silent: false, requireInteraction: true,
      vibrate: [400, 200, 400, 200, 800], icon: "icons/icon-business-192.png", badge: "icons/icon-business-192.png",
      timestamp: Date.now(), data: { url: d.url || "business.html#/biz/inbox" },
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: "mm-order", alert: d }))),
  ]));
});
// Chrome sometimes replaces a push address. Get the new one at once and tell any open shop app,
// which saves it on the server; if none is open, the app saves it the next time it opens.
self.addEventListener("pushsubscriptionchange", (e) => {
  const key = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
  e.waitUntil((e.newSubscription ? Promise.resolve(e.newSubscription)
    : key ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : Promise.resolve(null))
    .catch(() => null)
    .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
    .then((list) => list.forEach((c) => c.postMessage({ type: "mm-subchange" }))));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "business.html#/biz/inbox", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.includes("business.html"));
    if (w) { w.postMessage({ type: "mm-open", url }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
