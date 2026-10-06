/* Webs Browser for iPhone - offline support.
   The app's own files are kept on the phone so it opens instantly and works
   without a connection. Each launch quietly fetches fresh copies for next
   time; a new VERSION is picked up as a whole and the app offers to switch.
   Requests to other sites (weather, suggestions...) are never touched.
   A gradual rollout (the owner's dashboard → Updates): an iPhone that isn't in it yet neither installs
   that version nor refreshes its files to it; it keeps the one it has (js/live.app.js writes which
   side of the rollout it is on, in the "wsbmeta" cache). Anything unclear means: update as usual. */
"use strict";
const VERSION = "webs-2.10.1";
const SHELL = ["./", "index.html", "app.css", "fx.css", "js/core.js", "js/answers.js", "js/app.js", "js/qrcode.js", "js/fx.js", "js/phantom.js", "js/widgets.js", "js/answers2.js",
  "js/library.js", "js/tools.js", "js/extras.js", "js/whatsnew.js", "js/webai.js", "js/ai.js", "js/ai.tools.js", "js/ai.app.js", "js/gtd.js", "js/gtd.app.js", "js/privacy.js", "js/privacy.app.js", "js/link.js", "js/link.app.js", "js/stats.js", "js/stats.app.js", "js/offline.app.js", "js/ipad.app.js", "js/near.js", "js/near.app.js", "js/push.js", "js/support.settings.js", "js/support.js", "js/live.js", "js/live.app.js", "js/live.games.js", "js/anime.js", "js/anime.app.js", "js/xp.js", "js/xp.app.js", "js/buddy.js", "js/anime.more.js", "js/anime.more.app.js", "js/watch.js", "js/watch.app.js", "js/games.more.js", "js/games.online.js", "games.html", "manifest.webmanifest",
  "icons/favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png"];

const MINE = VERSION.replace("webs-", "");
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
let gate = { at:0, v:null };
async function rollout() {        // { v, pct, b } while a rollout is on, else false (looked up at most every 10 minutes)
  if (gate.v !== null && Date.now() - gate.at < 10 * 60000) return gate.v;
  let v = false;
  try {
    const m = await (await caches.open("wsbmeta")).match("meta"), meta = m ? await m.json() : null;
    if (meta && /^https:\/\/\S+$/.test(meta.server || "") && meta.b >= 0) {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 3000);
      const j = await (await fetch(meta.server + "/live", { signal:ac.signal, cache:"no-store" })).json();
      clearTimeout(t);
      const r = j && j.rollout && j.rollout.ios;
      if (r && /^\d+\.\d+\.\d+$/.test(r.v)) v = { v:r.v, pct:+r.pct, b:+meta.b };
    }
  } catch (e) {}
  gate = { at:Date.now(), v };
  return v;
}
const notYet = (r, ver) => !!r && r.v === ver && r.b >= r.pct;      // that version, and this iPhone isn't in its rollout yet
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    // a first install always goes ahead; an update waits for this iPhone's turn
    if (self.registration.active && notYet(await rollout(), MINE)) throw new Error("Not this iPhone's turn for " + MINE + " yet");
    const c = await caches.open(VERSION);
    await c.addAll(SHELL.map(p => new Request(p, { cache:"reload" })));
  })());
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
    const fresh = () => fetch(key, { cache:"no-cache" }).then(r => { if (r.ok) cache.put(key, r.clone()); return r; });
    // the copy kept here at once; a fresh one for next time, unless a newer version is rolling out without this iPhone yet
    if (hit) { e.waitUntil(rollout().then(r => r && newer(r.v, MINE) && r.b >= r.pct ? null : fresh()).catch(() => {})); return hit; }
    try { return await fresh(); }
    catch (err) { return (await cache.match(new Request(new URL("index.html", self.registration.scope).href))) || Response.error(); }
  })());
});
