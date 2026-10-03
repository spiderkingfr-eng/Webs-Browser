/* Webs Browser for iPhone - offline support.
   The app's own files are kept on the phone so it opens instantly and works
   without a connection. Each launch quietly fetches fresh copies for next
   time; a new VERSION is picked up as a whole and the app offers to switch.
   Requests to other sites (weather, suggestions...) are never touched. */
"use strict";
const VERSION = "webs-2.5.0";
const SHELL = ["./", "index.html", "app.css", "fx.css", "js/core.js", "js/answers.js", "js/app.js", "js/qrcode.js", "js/fx.js", "js/phantom.js", "js/widgets.js", "js/answers2.js",
  "js/library.js", "js/tools.js", "js/extras.js", "js/whatsnew.js", "js/webai.js", "js/push.js", "js/support.settings.js", "js/support.js", "games.html", "manifest.webmanifest",
  "icons/favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(p => new Request(p, { cache:"reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("webs-") && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
// notifications from Webs's server (js/push.js): new versions, news, the daily word reminder
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body:e.data ? e.data.text() : "" }; }
  const opts = { body:String(m.body || "").slice(0, 300), icon:"icons/icon-192.png", badge:"icons/icon-192.png", data:{ url:typeof m.url === "string" ? m.url : "" } };
  if (m.tag) { opts.tag = String(m.tag).slice(0, 40); opts.renotify = true; }
  // iPhone needs every push to show something, or it stops sending them
  e.waitUntil(self.registration.showNotification(String(m.title || "Webs").slice(0, 80), opts));
});
// a notification brings Webs back to the front, on the page it points to (a timer's points nowhere)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  let url = "";
  try { const raw = e.notification.data && e.notification.data.url; if (raw) { const u = new URL(raw, self.registration.scope); if (u.protocol === "https:" || u.origin === self.location.origin) url = u.href; } } catch (x) {}
  if (url === self.registration.scope) url = "";          // just Webs: back to the front, as it was
  const mine = url.startsWith(self.registration.scope);
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
    if (!list.length || (url && !mine)) return self.clients.openWindow(url || "./");
    return list[0].focus().then(c => url && c && c.navigate ? c.navigate(url) : null).catch(() => {});
  }));
});

const shellPath = url => {
  const scope = self.registration.scope;
  if (!url.href.startsWith(scope)) return null;
  const p = url.pathname.slice(new URL(scope).pathname.length) || "./";
  return SHELL.includes(p) ? p : null;
};
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = shellPath(url);
  if (!path) {
    // anything else on this site (the Windows download, say): network, with the app as the offline page
    if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match("index.html", { cacheName:VERSION })));
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = new Request(new URL(path, self.registration.scope).href);
    const hit = await cache.match(key);
    const fresh = fetch(key, { cache:"no-cache" }).then(r => { if (r.ok) cache.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    try { return await fresh; }
    catch (err) { return (await cache.match(new Request(new URL("index.html", self.registration.scope).href))) || Response.error(); }
  })());
});
