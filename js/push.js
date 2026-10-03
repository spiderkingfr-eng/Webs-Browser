/* Webs Browser for iPhone - notifications from Webs (Settings → Notifications): new versions, news
   from the people who make Webs, and a daily word reminder, even when Webs is closed.
   They come through Apple's push service from the Web AI server (server/web-ai, "notifications"),
   whose address arrives with updates (updates/iphone.json). iPhone only allows them for apps on
   the Home Screen, with iOS 16.4 or newer. sw.js shows them and opens what they point to.
   The phone keeps wsb.push: the server, its key, and what it last told the server. */
"use strict";

(function () {
const st = () => load("push", {}) || {};
const setSt = o => save("push", Object.assign(st(), o));
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const bytes = k => { const s = String(k).replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(s + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0)); };
const settingsOpen = () => !$("#sheet").classList.contains("hide") && $("#sheet").dataset.kind === "settings";
const redraw = () => { if (settingsOpen()) refreshSettings(); };

// why notifications can't be turned on here ("" when they can)
function why() {
  if (isIOS && !isStandalone()) return "On iPhone, notifications work once Webs is on your Home Screen: tap Share, then Add to Home Screen, and turn them on from there.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIOS ? "Notifications need iOS 16.4 or newer." : "This browser can't get notifications.";
  if (!/^https?:$/.test(location.protocol)) return "Notifications work once Webs is opened from its web address.";
  return "";
}

/* the server: the Web AI server's address (it comes with updates) */
async function server() {
  const a = String((load("xaiConfig", {}) || {}).server || "").replace(/\/+$/, "");
  if (/^https:\/\/\S+$/.test(a)) return a;
  if (st().server) return st().server;
  try {
    const j = await (await fetch("updates/iphone.json?t=" + Date.now(), { cache:"no-store" })).json();
    const s = String(j && j.webai && j.webai.server || "").replace(/\/+$/, "");
    if (/^https:\/\/[^\s/?#]+\.[^\s/?#]+$/i.test(s)) { setSt({ server:s }); return s; }
  } catch (e) {}
  return "";
}
async function api(path, body) {
  const s = await server();
  if (!s) throw new Error("Notifications aren't set up yet. Try again later.");
  let r;
  try { r = await fetch(s + path, body ? { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) } : { cache:"no-store" }); }
  catch (e) { throw new Error("Couldn't reach Webs's server. Are you online?"); }
  const j = await r.json().catch(() => null);
  if (r.status === 404 && (!j || j.error === "not_found")) throw new Error("Notifications aren't ready yet. Try again later.");
  if (!r.ok || !j) { const e = new Error(j && j.message || "Webs's server had a problem (" + r.status + ")."); e.code = j && j.error; e.key = j && j.key; throw e; }
  return j;
}
async function serverKey() {
  if (st().key) return st().key;
  const j = await api("/push/key");
  setSt({ key:j.key });
  return j.key;
}
const reg = async () => UPD.reg || await navigator.serviceWorker.ready;
// the phone's subscription with this key (one made with an old key is replaced)
async function subscription(r, key) {
  const cur = await r.pushManager.getSubscription();
  if (cur) {
    const k = cur.options && cur.options.applicationServerKey;
    if (!k || b64u(k) === key) return cur;
    await api("/push/unsubscribe", { endpoint:cur.endpoint }).catch(() => {});
    await cur.unsubscribe().catch(() => {});
  }
  return r.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:bytes(key) });
}
// what this phone wants; the reminder hour goes to the server in UTC (rounded up for half-hour time zones)
function prefs() {
  const h = cfg.pushDaily && cfg.pushDaily !== "off" ? +cfg.pushDaily : -1;
  const m = h >= 0 ? ((h * 60 + new Date().getTimezoneOffset()) % 1440 + 1440) % 1440 : -1;
  return { updates:cfg.pushUpd !== false, news:cfg.pushNews !== false, daily:h >= 0, utcHour:h >= 0 ? Math.ceil(m / 60) % 24 : -1 };
}
async function tell(sub, key) {
  const p = prefs();
  try { await api("/push/subscribe", { sub:sub.toJSON(), key, ...p }); }
  catch (e) {
    if (e.code !== "key" || !e.key) throw e;
    // the server has another key now: sign up again with that one
    setSt({ key:e.key }); key = e.key;
    sub = await subscription(await reg(), key);
    await api("/push/subscribe", { sub:sub.toJSON(), key, ...p });
  }
  setSt({ endpoint:sub.endpoint, sig:JSON.stringify([sub.endpoint, key, p]), at:Date.now() });
}
const nice = e => e && e.name === "NotAllowedError" ? "iPhone didn't allow it. Tap the switch again." : e && e.message || "Couldn't turn notifications on.";

/* the switches */
function turnedOff(el, msg) { setCfg("pushOn", false); if (el) el.checked = false; if (msg) toast(msg); redraw(); }
async function turnOn(el) {
  const no = why();
  if (no) { turnedOff(el, no); return; }
  // asked straight away, while the tap still counts: iPhone only shows the question right after a tap
  const asked = Notification.permission === "default" ? Notification.requestPermission() : Promise.resolve(Notification.permission);
  try {
    const perm = await asked;
    if (perm !== "granted") {
      turnedOff(el, perm === "denied" ? "Notifications are off for Webs in the iPhone's Settings → Notifications → Webs. Turn them on there, then here." : "Webs wasn't allowed to send notifications.");
      return;
    }
    const key = await serverKey();
    await tell(await subscription(await reg(), key), key);
  } catch (e) { turnedOff(el, nice(e)); return; }
  toast("Notifications are on");
  redraw();
}
async function turnOff() {
  try {
    const sub = await (await reg()).pushManager.getSubscription(), ep = sub ? sub.endpoint : st().endpoint;
    if (ep) await api("/push/unsubscribe", { endpoint:ep }).catch(() => {});
    if (sub) await sub.unsubscribe();
  } catch (e) {}
  setSt({ endpoint:"", sig:"" });
  redraw();
}
// keeps the server up to date: after a change here, and now and then (a new key, a new time zone)
let lastSync = 0;
async function sync(force) {
  if (!cfg.pushOn || why()) return;
  if (Notification.permission !== "granted") { if (Notification.permission === "denied") { setCfg("pushOn", false); setSt({ sig:"" }); } return; }
  lastSync = Date.now();
  const key = await serverKey(), sub = await subscription(await reg(), key);      // permission's given, so no tap needed
  if (!force && JSON.stringify([sub.endpoint, key, prefs()]) === st().sig && Date.now() - (st().at || 0) < 7 * 86400000) return;
  await tell(sub, key);
}
const changed = () => sync(true).catch(e => toast(nice(e)));

SETACTIONS["sw:pushOn"] = (on, el) => on ? turnOn(el) : turnOff();
SETACTIONS["sw:pushUpd"] = changed;
SETACTIONS["sw:pushNews"] = changed;
SETACTIONS["seg:pushDaily"] = changed;
SETACTIONS.pushTest = async () => {
  try {
    const sub = await (await reg()).pushManager.getSubscription();
    if (!sub) throw new Error("Turn notifications on first.");
    await sync(false);
    await api("/push/test", { endpoint:sub.endpoint });
    toast("Sent! It should arrive in a few seconds.");
  } catch (e) { toast(nice(e)); }
};

/* Settings → Notifications */
const hour = h => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour:"numeric" });
window.pushGroup = () => {
  const no = why(), on = !!cfg.pushOn && !no;
  let rows = SW("pushOn", "Notifications from Webs", "New versions, news and a daily word reminder, even when Webs is closed", on);
  if (on) rows += SW("pushUpd", "New versions", "", cfg.pushUpd !== false) + SW("pushNews", "News from Webs", "New features and games", cfg.pushNews !== false) +
    '<div class="srow col"><span class="k">Daily word reminder</span>' + CHIPS("pushDaily", [["off", "Off"]].concat([8, 12, 17, 20].map(h => [String(h), hour(h)])), cfg.pushDaily || "off") + "</div>" +
    BTN("pushTest", "Send a test notification", "", "", "bell");
  return GROUP("Notifications", rows, no ? esc(no) : on ? "Turn them off here, or in the iPhone's Settings → Notifications → Webs." : "");
};

// a notification about a new version opens Webs with ?go=update
ACTIONS.update = async () => {
  for (let i = 0; i < 50 && !UPD.reg; i++) await new Promise(r => setTimeout(r, 100));
  checkUpdate(true);
};

document.addEventListener("DOMContentLoaded", () => setTimeout(() => sync(false).catch(() => {}), 3000));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - lastSync > 3600e3) sync(false).catch(() => {}); });
})();
