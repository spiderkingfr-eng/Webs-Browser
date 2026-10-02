/* ---------------------------------------------------------------- Webs 3.1: your Google account, and updates
   Sign in with Google: Google's sign-in page opens in a tab. When you are done,
   Google sends that tab to http://127.0.0.1:<port>/ with a one-time code.
   Nothing listens there; this page sees the tab's address, takes the code and
   closes the tab (Google's sign-in for installed apps, with PKCE). The code is
   traded for a refresh token, kept in the browser's own storage, which web
   pages cannot read. What is saved goes to one file in the app's hidden folder
   in your Google Drive (drive.appdata), which only Webs Browser can see.

   Updates: updates/latest.json in the GitHub repository names the newest
   version. "Update now" downloads WebsUpdate.exe, which closes the browser,
   installs the new version (checked against its SHA-256) and opens it again. */
(function () {
"use strict";
const X3 = window.X3 = window.X3 || {};
const VERSION = "@@WEBS_VERSION@@";
const REPO = "spiderkingfr-eng/Webs-Browser";
const MANIFEST = "https://raw.githubusercontent.com/" + REPO + "/main/updates/latest.json";
const FROM_REPO = /^https:\/\/(raw\.githubusercontent\.com|github\.com)\/spiderkingfr-eng\/Webs-Browser\//;
// Filled in by the owner (see windows/README.md), or delivered later through updates/latest.json.
const GOOGLE_ID = "", GOOGLE_SECRET = "";
const CLIENT_RE = /^[0-9]{5,}-[a-z0-9]+\.apps\.googleusercontent\.com$/;
X3.version = VERSION;

Object.assign(P, {
  google:"M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.8v2.3h3.1c1.8-1.6 2.8-4 2.8-6.8zM12 21c2.5 0 4.7-.8 6.2-2.3l-3.1-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H3.7v2.4A9 9 0 0 0 12 21zM6.9 13.5a5.4 5.4 0 0 1 0-3.4V7.7H3.7a9 9 0 0 0 0 8.2zM12 6.6c1.3 0 2.6.5 3.5 1.4l2.7-2.7A9 9 0 0 0 3.7 7.7l3.2 2.4C7.6 8.1 9.6 6.6 12 6.6z",
  cloud:"M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18z",
  upd:"M12 19V7m-5 5l5-5 5 5M5 4h14"
});

const vnum = v => String(v || "").split(".").map(n => parseInt(n, 10) || 0);
function newer(a, b) { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; }
const ago = ts => { if (!ts) return "never"; const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + " min ago" : s < 86400 ? Math.floor(s / 3600) + " h ago" : new Date(ts).toLocaleDateString(); };
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
// a quick, stable fingerprint of some data: same data, same keys in any order, same text
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
function fp(v) {
  const s = stable(v); let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822507); b ^= b >>> 13; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + s.length.toString(36);
}

/* ================================================================ updates */
const UPD_KEY = "xUpd";
function updInfo() { return load(UPD_KEY, {}) || {}; }
function updAvail() { const u = updInfo(); return u.latest && newer(u.latest.version, VERSION) ? u.latest : null; }
function takeManifest(m) {
  if (m && m.google && CLIENT_RE.test(m.google.clientId || ""))
    save("xgConfig", { clientId:m.google.clientId, clientSecret:String(m.google.clientSecret || "").slice(0, 100) });
  const ok = m && /^\d+\.\d+\.\d+$/.test(m.version || "") && m.updater && FROM_REPO.test(m.updater.url || "");
  if (!ok) return null;
  return { version:m.version, date:String(m.date || "").slice(0, 10), url:m.updater.url,
           notes:(Array.isArray(m.notes) ? m.notes : []).slice(0, 40).map(s => String(s).slice(0, 240)) };
}
let checking = false;
async function checkUpdate(manual) {
  if (checking || (!manual && cfg.xUpdates === false)) return;
  checking = true;
  const u = updInfo();
  try {
    const r = await fetch(MANIFEST + "?t=" + Math.floor(Date.now() / 300000), { cache:"no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const latest = takeManifest(await r.json());
    if (!latest) throw new Error("The update information looks wrong");
    u.latest = latest; u.err = "";
  } catch (e) { u.err = /HTTP|wrong/.test(e.message) ? e.message : "Couldn't reach GitHub"; }
  u.checked = Date.now(); checking = false;
  save(UPD_KEY, u); paintUpd();
  const a = updAvail();
  if (manual) { if (a) updPanel(); else toast(u.err ? "Couldn't check for updates: " + u.err : "You have the newest version (" + VERSION + ")"); return; }
  if (a) {
    const told = load("xUpdTold", {}) || {};
    if (told.v !== a.version || Date.now() - (told.ts || 0) > 20 * 3600000) {
      save("xUpdTold", { v:a.version, ts:Date.now() });
      toast("Webs Browser " + a.version + " is ready", { label:"Update now", fn:updPanel });
    }
  }
}
function paintUpd() {
  const box = document.querySelector(".xbox"); if (!box) return;
  let pill = box.querySelector(".xupd");
  const a = updAvail();
  if (!a) { if (pill) pill.remove(); return; }
  if (!pill) { pill = el("span", "xupd"); pill.onclick = updPanel; box.insertBefore(pill, box.firstChild); }
  pill.innerHTML = ico("upd") + "Update";
  pill.title = "Webs Browser " + a.version + " is ready - click to update";
}
function updPanel() {
  const u = updInfo(), a = updAvail();
  const p = el("div", "xpane");
  p.innerHTML = '<div class="xhead"><div class="xic">' + ico(a ? "upd" : "sparkle") + '</div><div><b></b><span></span></div></div><ul class="xnotes"></ul><div class="xsmall"></div><div class="xbtns"></div>';
  p.querySelector("b").textContent = a ? "Webs Browser " + a.version + " is ready" : "You have the newest version";
  p.querySelector(".xhead span").textContent = "You have " + VERSION + (u.checked ? " · checked " + ago(u.checked) : "") + (u.err ? " · " + u.err : "");
  const ul = p.querySelector("ul");
  (a ? a.notes : []).forEach(n => { const li = el("li"); li.textContent = n; ul.appendChild(li); });
  if (!ul.children.length) ul.remove();
  p.querySelector(".xsmall").textContent = a ? "Update now downloads a small updater from GitHub. It closes the browser, installs " + a.version +
    " and opens it again, with your tabs. If Windows asks, choose More info, then Run anyway." : "Webs Browser checks for updates by itself every few hours.";
  const bt = p.querySelector(".xbtns");
  const b1 = el("button", "btn2"); b1.textContent = a ? "Later" : "Check now"; b1.onclick = () => { if (a) closeOver(); else { closeOver(); checkUpdate(true); } };
  bt.appendChild(b1);
  if (a) { const b2 = el("button", "btn2 main"); b2.textContent = "Update now"; b2.onclick = startUpdate; bt.appendChild(b2); }
  const n = openOver("xupdp", p); n.style.right = "8px";
}
let updUrl = "", updVer = "";
function startUpdate() {
  const a = updAvail(); if (!a) return;
  closeOver();
  updUrl = a.url; updVer = a.version;
  toast("Downloading the updater…");
  // "dl-retry" with an unknown id downloads the address: in the page you are on, or a background tab
  send("dl-retry", "webs-update", updUrl);
}
const isUpdDl = d => !!updUrl && (d.uri === updUrl || (/^WebsUpdate[^\\/]*\.exe$/i.test(d.name || "") && FROM_REPO.test(d.uri || "")));
const dlSafety0 = dlSafety;
dlSafety = function (d) { if (isUpdDl(d)) return; return dlSafety0(d); };
function onUpdDl(p) {
  const d = { state:p[2], name:p[3], path:p[4], uri:p[8] || "" };
  if (!isUpdDl(d)) return;
  tabs.filter(t => t.url === updUrl).forEach(t => closeTab(t.id));   // a tab opened just for the download
  if (d.state === "done") {
    updUrl = "";
    send("open-file", d.path);
    toast("Installing Webs Browser " + updVer + ". It closes and opens again by itself. If Windows asks, choose More info, then Run anyway.");
  } else if (d.state === "failed" || d.state === "cancelled") {
    updUrl = "";
    toast("The update didn't download", { label:"Try again", fn:startUpdate });
  }
}
X3.checkUpdate = checkUpdate; X3.updPanel = updPanel; X3.startUpdate = startUpdate;

/* ================================================================ Google account */
const TOKEN_URL = "https://oauth2.googleapis.com/token", DRIVE = "https://www.googleapis.com/drive/v3/files",
      UPLOAD = "https://www.googleapis.com/upload/drive/v3/files", FILE = "webs-browser-sync.json";
const SCOPE = "openid email profile https://www.googleapis.com/auth/drive.appdata";
function gConfig() {
  const c = load("xgConfig", null) || {};
  const id = CLIENT_RE.test(c.clientId || "") ? c.clientId : GOOGLE_ID, secret = CLIENT_RE.test(c.clientId || "") ? c.clientSecret : GOOGLE_SECRET;
  return CLIENT_RE.test(id || "") ? { id, secret:String(secret || "") } : null;
}
let auth = load("xgAuth", null);                    // { rt, email, name, pic, since, expired }
let at = "", atExp = 0, pending = null, busy = false, lastErr = "", syncing = false, soonT = 0;
const G_ON = () => !PRIVATE && !!(auth && auth.rt && !auth.expired);
const gPrefs = () => Object.assign({ layout:true, lists:true, extras:true }, load("xgPrefs", {}) || {});
function gState() { return load("xgState", {}) || {}; }
function setState(s) { save("xgState", s); publish(); }
// Settings shows this; it is the only part of the account other pages can see
function publish() {
  const s = gState();
  save("xgStatus", { configured:!!gConfig(), signedIn:G_ON(), expired:!!(auth && auth.expired), email:auth ? auth.email : "", name:auth ? auth.name : "",
    pic:auth ? auth.pic : "", last:s.lastSync || 0, err:lastErr, busy, signingIn:!!pending, prefs:gPrefs(), private:PRIVATE, version:VERSION, upd:updInfo() });
}

async function signIn(viaBrowser) {
  if (PRIVATE) { toast("Sign in from a normal window, not a private one"); return; }
  const c = gConfig();
  if (!c) { acctPanel(); return; }
  const verifier = rand(48), state = rand(18), port = 49152 + (crypto.getRandomValues(new Uint16Array(1))[0] % 16000);
  const challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const redirect = "http://127.0.0.1:" + port + "/";
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id:c.id, redirect_uri:redirect, response_type:"code", scope:SCOPE,
    code_challenge:challenge, code_challenge_method:"S256", state, access_type:"offline", prompt:"consent select_account" });
  pending = { verifier, state, port, redirect, url, t:Date.now() };
  if (viaBrowser) send("open-other", viaBrowser, url); else newTab(url, false, active);
  publish();
  if (overlay === "xacct") acctPanel();
}
// The address Google sends you back to, seen in a tab (or pasted from another browser).
function catchCode(id, url) {
  if (!pending || !url) return false;
  let u = String(url);
  try { u = decodeURIComponent(u); } catch (e) {}
  const i = u.indexOf("127.0.0.1:" + pending.port);
  if (i < 0) return false;
  const q = (u.slice(i).split("?")[1] || "").split("#")[0], prm = new URLSearchParams(q);
  if (prm.get("state") !== pending.state) return false;
  if (id) setTimeout(() => quietClose(id), 0);
  finishSignIn(prm.get("code"), prm.get("error"));
  return true;
}
// closes the sign-in tab without keeping it in recently closed tabs or offering Undo
function quietClose(id) {
  const t = T(id); if (!t) return;
  t.wcheck = true;
  const i = tabs.findIndex(x => x.id === id), next = id === active ? (tabs[i + 1] || tabs[i - 1] || {}).id || 0 : active;
  send("close-tab", id, next);
}
async function finishSignIn(code, err) {
  const pd = pending; pending = null;
  if (!code) { lastErr = err === "access_denied" ? "" : "Sign-in didn't finish" + (err ? " (" + err + ")" : ""); toast(err === "access_denied" ? "Sign-in cancelled" : lastErr); publish(); paintAcctIfOpen(); return; }
  const c = gConfig();
  busy = true; publish();
  try {
    const r = await fetch(TOKEN_URL, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body:new URLSearchParams({ code, client_id:c.id, client_secret:c.secret, redirect_uri:pd.redirect, grant_type:"authorization_code", code_verifier:pd.verifier }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "HTTP " + r.status);
    if (!j.refresh_token) throw new Error("Google didn't allow staying signed in. Try again.");
    at = j.access_token; atExp = Date.now() + (+j.expires_in || 3600) * 1000 - 60000;
    let me = {};
    try { me = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers:{ Authorization:"Bearer " + at } })).json(); } catch (e) {}
    const was = auth && auth.email;
    auth = { rt:j.refresh_token, email:String(me.email || "").slice(0, 200), name:String(me.name || "").slice(0, 120),
             pic:/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(me.picture || "") ? me.picture : "", since:Date.now() };
    save("xgAuth", auth);
    // a different account starts fresh; the same one carries on where it was
    if (was !== auth.email) setState({});
    lastErr = ""; busy = false;
    toast("Signed in as " + (auth.email || "your Google account"));
    await syncG(true);
  } catch (e) { lastErr = "Sign-in failed: " + e.message; toast(lastErr); }
  busy = false; publish(); paintAcctIfOpen(); paintAcctBtn();
}
async function token() {
  if (at && Date.now() < atExp) return at;
  if (!G_ON()) throw new Error("Not signed in");
  const c = gConfig(); if (!c) throw new Error("Google sign-in isn't set up in this copy");
  const r = await fetch(TOKEN_URL, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ client_id:c.id, client_secret:c.secret, refresh_token:auth.rt, grant_type:"refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (j.error === "invalid_grant") { auth.expired = true; save("xgAuth", auth); publish(); paintAcctBtn(); throw new Error("Your Google sign-in has ended. Sign in again to keep syncing."); }
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "HTTP " + r.status);
  at = j.access_token; atExp = Date.now() + (+j.expires_in || 3600) * 1000 - 60000;
  return at;
}
async function gfetch(url, opt) {
  opt = Object.assign({}, opt || {});
  opt.headers = Object.assign({}, opt.headers || {}, { Authorization:"Bearer " + await token() });
  let r = await fetch(url, opt);
  if (r.status === 401) { at = ""; opt.headers.Authorization = "Bearer " + await token(); r = await fetch(url, opt); }
  if (!r.ok) { let m = "HTTP " + r.status; try { const j = await r.json(); m = (j.error && (j.error.message || j.error)) || m; } catch (e) {} throw new Error(String(m)); }
  return r;
}
async function findFile() {
  const q = encodeURIComponent("name='" + FILE + "' and trashed=false");
  const j = await (await gfetch(DRIVE + "?spaces=appDataFolder&pageSize=10&fields=files(id,modifiedTime)&q=" + q)).json();
  return (j.files || [])[0] || null;
}
async function readFile(id) { return (await gfetch(DRIVE + "/" + encodeURIComponent(id) + "?alt=media")).json(); }
async function writeFile(id, data) {
  const body = JSON.stringify(data);
  if (id) return (await gfetch(UPLOAD + "/" + encodeURIComponent(id) + "?uploadType=media&fields=id,modifiedTime",
    { method:"PATCH", headers:{ "Content-Type":"application/json" }, body })).json();
  const bd = "webs" + rand(12);
  const meta = JSON.stringify({ name:FILE, parents:["appDataFolder"], mimeType:"application/json" });
  const multi = "--" + bd + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n--" + bd + "\r\nContent-Type: application/json\r\n\r\n" + body + "\r\n--" + bd + "--";
  return (await gfetch(UPLOAD + "?uploadType=multipart&fields=id,modifiedTime", { method:"POST", headers:{ "Content-Type":"multipart/related; boundary=" + bd }, body:multi })).json();
}

/* What is saved. Layout and extras: the newest copy wins. Lists: both sides are
   added together, like the folder sync (adding and updating, never deleting). */
const LAYOUT = ["settings", "tiles", "hidden", "panels", "zooms", "shield", "xClocks", "xTabNames"];
const EXTRAS = ["stickies", "habits", "events", "ntpNote", "games", "game", "ach", "counts"];
// things that only make sense on this computer: its folders, its files, what is playing
const LOCAL_ONLY = new Set(["syncDir", "backupDir", "backupAuto", "dldir", "autostart", "music", "playlists", "playlist", "radioNow", "musicMuted",
  "musicPaused", "musicPos", "musicNow", "bg", "bgList", "slides", "bgNtp", "sideW"]);
const localOnly = (k, v) => LOCAL_ONLY.has(k) || /"user\/|[A-Za-z]:\\\\/.test(JSON.stringify(v === undefined ? null : v) || "");
function gather() {
  flush();
  const layout = {};
  LAYOUT.forEach(k => { let v = load(k, null); if (v == null) return;
    if (k === "settings") { const s = {}; Object.keys(v).forEach(x => { if (!localOnly(x, v[x])) s[x] = v[x]; }); v = s; }
    layout[k] = v; });
  const extras = {}; EXTRAS.forEach(k => { const v = load(k, null); if (v != null) extras[k] = v; });
  const lists = {}; SYNC_KEYS.forEach(k => { const v = load(k, null); if (v != null) lists[k] = v; });
  return { layout:{ data:layout, hash:fp(layout) }, extras:{ data:extras, hash:fp(extras) }, lists:{ data:lists, hash:fp(lists) } };
}
function applyLayout(d) {
  const cur = load("settings", {}) || {}, s = {};
  Object.keys(d.settings || {}).forEach(k => { if (!localOnly(k, d.settings[k])) s[k] = d.settings[k]; });
  Object.keys(cur).forEach(k => { if (localOnly(k, cur[k])) s[k] = cur[k]; });     // this computer keeps its own files and folders
  if (d.settings) save("settings", s);
  LAYOUT.forEach(k => { if (k !== "settings" && d[k] !== undefined) save(k, d[k]); });
  zooms = load("zooms", {});
  reloadSettings(); sendPrefs();
  send("settings-changed");
  tabs.forEach(t => { if (/^https:\/\/browser\.example\/(newtab|settings)\.html/.test(t.url || "")) send("reload", t.id, 0); });
}
function applyExtras(d) { EXTRAS.forEach(k => { if (d[k] !== undefined) save(k, d[k]); }); }
// asked once, on the first sync of a computer that already has its own layout
function askLayout(cloud) {
  return new Promise(res => {
    const p = el("div", "xpane");
    p.innerHTML = '<div class="xhead"><div class="xic">' + ico("cloud") + '</div><div><b>Use your saved layout?</b><span></span></div></div>' +
      '<div class="xsmall">Your Google account has a layout and settings saved from another computer. Use them here, or keep this computer\'s and save those to your account instead. Bookmarks, notes and to-dos are added together either way.</div><div class="xbtns"></div>';
    p.querySelector(".xhead span").textContent = "Saved " + (cloud.saved ? new Date(cloud.saved).toLocaleString() : "earlier");
    let done = false;
    const pick = v => { if (done) return; done = true; closeOver(); res(v); };
    const b1 = el("button", "btn2"); b1.textContent = "Keep this computer's"; b1.onclick = () => pick(false);
    const b2 = el("button", "btn2 main"); b2.textContent = "Use my saved layout"; b2.onclick = () => pick(true);
    p.querySelector(".xbtns").append(b1, b2);
    const n = openOver("xask1", p); n.style.right = "8px";
    // closing the panel some other way keeps this computer's, and asks again next time
    const watchClose = setInterval(() => { if (overlay !== "xask1") { clearInterval(watchClose); if (!done) { done = true; res(null); } } }, 400);
  });
}
const DEVICE = (() => { let d = load("xgDevice", ""); if (!d) { d = rand(9); save("xgDevice", d); } return d; })();
const LOCK = "wsb.xgLock", ME = rand(6);
function haveLock() {
  try { const l = JSON.parse(localStorage.getItem(LOCK) || "null");
    if (l && l.id !== ME && l.until > Date.now()) return false;
    localStorage.setItem(LOCK, JSON.stringify({ id:ME, until:Date.now() + 90000 })); return true; } catch (e) { return true; }
}
async function syncG(manual) {
  if (!G_ON()) return;
  if (!haveLock() && !manual) return;
  if (syncing) { if (manual) toast("Already syncing…"); return; }
  syncing = true; busy = true; publish(); paintAcctIfOpen();
  const prefs = gPrefs(), st = gState(), first = !st.lastSync;
  try {
    const f = await findFile();
    let cloud = null;
    if (f && (first || manual || f.modifiedTime !== st.cloudMod)) {
      cloud = await readFile(f.id);
      if (!cloud || cloud.app !== "Webs Browser cloud") cloud = null;
    }
    let local = gather(), upload = !f;
    const now = Date.now(), keepCloud = new Set();
    for (const g of ["layout", "extras"]) {
      if (!prefs[g]) continue;
      const lh = local[g].hash, base = st[g + "Base"];
      if (lh !== st[g + "Seen"]) { st[g + "Seen"] = lh; st[g + "Ts"] = now; }    // when this computer last changed it
      const c = cloud && cloud[g] && cloud[g].data ? cloud[g] : null;
      if (!c) { if (lh !== base) upload = true; continue; }
      if (c.hash === lh) { st[g + "Base"] = lh; continue; }
      let take;
      if (!base) take = g === "layout" ? (Object.keys(local.layout.data).length ? await askLayout(cloud) : true) : true;
      else if (c.hash !== base && lh === base) take = true;
      else if (c.hash === base && lh !== base) take = false;
      else take = (+c.ts || 0) > (+st[g + "Ts"] || 0);
      if (take === null) { keepCloud.add(g); continue; }             // not answered: leave both as they are, ask next time
      if (take) { if (g === "layout") applyLayout(c.data); else applyExtras(c.data); st[g + "Base"] = c.hash; st[g + "Seen"] = c.hash; st[g + "Ts"] = +c.ts || now; }
      else upload = true;
    }
    if (prefs.lists && cloud && cloud.lists && cloud.lists.data) syncMerge("Webs Browser sync - your Google account.json", JSON.stringify({ app:"Webs Browser sync", data:cloud.lists.data }));
    local = gather();
    if (prefs.lists && local.lists.hash !== st.listsBase) upload = true;
    for (const g of ["layout", "extras"]) if (prefs[g] && !keepCloud.has(g) && local[g].hash !== st[g + "Base"]) upload = true;
    if (upload) {
      // parts not synced from here are carried over from the copy in your account
      if (f && !cloud) { cloud = await readFile(f.id).catch(() => null); if (cloud && cloud.app !== "Webs Browser cloud") cloud = null; }
      const out = { app:"Webs Browser cloud", v:1, saved:now, device:DEVICE, version:VERSION };
      for (const g of ["layout", "extras", "lists"]) {
        if (prefs[g] && !keepCloud.has(g)) out[g] = { ts:g === "lists" ? now : (+st[g + "Ts"] || now), hash:local[g].hash, data:local[g].data };
        else if (cloud && cloud[g]) out[g] = cloud[g];                   // a part you don't sync here stays as it was
      }
      const w = await writeFile(f && f.id, out);
      st.cloudMod = w.modifiedTime || "";
      for (const g of ["layout", "extras", "lists"]) if (prefs[g] && !keepCloud.has(g)) { st[g + "Base"] = local[g].hash; st[g + "Seen"] = local[g].hash; }
    } else if (f) st.cloudMod = f.modifiedTime;
    st.lastSync = Date.now(); lastErr = "";
    setState(st);
    if (manual) toast(upload ? "Saved to your Google account" : "Synced with your Google account");
  } catch (e) {
    lastErr = e.message || "Sync failed";
    if (manual) toast("Google sync: " + lastErr);
  }
  syncing = false; busy = false; publish(); paintAcctIfOpen(); paintAcctBtn();
}
function syncSoon(ms) { clearTimeout(soonT); soonT = setTimeout(() => syncG(false), ms || 20000); }

async function signOut(keepNothing) {
  const rt = auth && auth.rt;
  auth = null; at = ""; atExp = 0; lastErr = "";
  try { localStorage.removeItem("wsb.xgAuth"); } catch (e) {}
  setState({});
  if (rt) fetch("https://oauth2.googleapis.com/revoke", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ token:rt }) }).catch(() => {});
  publish(); paintAcctBtn(); paintAcctIfOpen();
  toast("Signed out. Everything stays on this computer.");
}
async function deleteCloud() {
  if (!confirm("Delete everything Webs Browser saved in your Google account?\n\nThis computer keeps its own copy.")) return;
  try { const f = await findFile(); if (f) await gfetch(DRIVE + "/" + encodeURIComponent(f.id), { method:"DELETE" }); setState({}); toast("Deleted from your Google account"); await signOut(); }
  catch (e) { toast("Couldn't delete it: " + e.message); }
}

/* ---------------------------------------------------------------- the account panel */
function paintAcctIfOpen() { if (overlay === "xacct") acctPanel(); }
function acctPanel() {
  const p = el("div", "xpane xacct");
  const c = gConfig(), st = gState(), prefs = gPrefs();
  const head = (icon, title, sub) => { const h = el("div", "xhead"); h.innerHTML = '<div class="xic">' + icon + '</div><div><b></b><span></span></div>';
    h.querySelector("b").textContent = title; h.querySelector("span").textContent = sub; return h; };
  const small = t => { const d = el("div", "xsmall"); d.textContent = t; return d; };
  const btns = (...list) => { const d = el("div", "xbtns"); list.forEach(([label, fn, main]) => { const b = el("button", "btn2" + (main ? " main" : "")); b.textContent = label; b.onclick = fn; d.appendChild(b); }); return d; };
  if (PRIVATE) { p.append(head(ico("google"), "Google account", "Not in private windows"), small("Sign in from a normal window. Nothing from private windows is ever saved.")); }
  else if (!c) {
    p.append(head(ico("google"), "Google account", "Not switched on in this copy yet"),
      small("Saving your layout to a Google account needs a one-time setup by whoever publishes this browser (a free Google Cloud project; the steps are in windows/README.md). It then arrives with the next update, with nothing to install."));
  } else if (pending) {
    p.append(head(ico("google"), "Finish signing in", "In the Google tab that just opened"),
      small("Pick your account and allow Webs Browser to keep its own data in your Google Drive. The tab closes by itself when you're done."));
    if (otherBrowsers.length) {
      const o = el("div", "xsmall"); o.textContent = "Google not letting you sign in here? Sign in with another browser, then paste the address it ends up on (it starts with http://127.0.0.1):";
      const r = el("div", "xbtns xleft");
      otherBrowsers.forEach(b => { const x = el("button", "btn2"); x.textContent = "Use " + b[1]; x.onclick = () => send("open-other", b[0], pending.url); r.appendChild(x); });
      const i = el("input", "xin"); i.placeholder = "Paste the address here"; i.spellcheck = false;
      i.onkeydown = e => { if (e.key === "Enter") { if (!catchCode(0, i.value.trim())) { i.value = ""; i.placeholder = "That isn't the address from this sign-in"; } } };
      i.oninput = () => { if (/127\.0\.0\.1/.test(i.value) && catchCode(0, i.value.trim())) i.value = ""; };
      p.append(o, r, i);
    }
    p.append(btns(["Cancel", () => { pending = null; publish(); acctPanel(); }]));
  } else if (!auth || !auth.rt) {
    p.append(head(ico("google"), "Save your layout to Google", "Sign in once on each computer"),
      small("Your layout and settings, new tab shortcuts, bookmarks, notes, to-dos, reading list, collections and more are kept in your Google account, and come back on any computer where you sign in to Webs Browser."),
      small("Only Webs Browser can see this data: it lives in a hidden app folder in your Google Drive, not with your files."));
    if (lastErr) p.appendChild(small(lastErr));
    p.append(btns(["Sign in with Google", () => signIn(), true]));
  } else {
    const h = head(auth.pic ? '<img alt="" referrerpolicy="no-referrer">' : ico("google"), auth.name || auth.email || "Google account", auth.email || "");
    if (auth.pic) h.querySelector("img").src = auth.pic;
    p.appendChild(h);
    if (auth.expired) p.append(small("Your sign-in has ended (Google does this after a password change, or if access was removed). Sign in again to keep syncing."), btns(["Sign in again", () => signIn(), true]));
    p.appendChild(small(busy ? "Syncing…" : "Last synced " + ago(st.lastSync) + (lastErr ? " · " + lastErr : "")));
    [["layout", "Layout and settings", "Look, new tab shortcuts and widgets, sidebar panels, Shield, site zoom"],
     ["lists", "Bookmarks, notes and to-dos", "Also your reading list, collections and highlights"],
     ["extras", "Extras", "Sticky notes, habits, calendar events, game scores and achievements"]].forEach(([k, t, s]) => {
      const r = el("div", "mi tg" + (prefs[k] ? " on" : ""));
      r.innerHTML = ico(k === "layout" ? "grid" : k === "lists" ? "book" : "sparkle") + "<span></span>";
      r.querySelector("span").textContent = t; r.title = s;
      r.appendChild(el("div", "k", prefs[k] ? "On" : "Off"));
      r.onclick = () => { const pr = gPrefs(); pr[k] = !pr[k]; save("xgPrefs", pr); publish(); acctPanel(); if (pr[k]) syncSoon(1500); };
      p.appendChild(r);
    });
    p.append(btns(["Sign out", () => signOut()], ["Delete saved data", deleteCloud], ["Sync now", () => syncG(true), true]));
  }
  const n = openOver("xacct", p); n.style.right = "8px";
}
function paintAcctBtn() {
  const box = document.querySelector(".xbox"); if (!box) return;
  let b = box.querySelector(".xacc");
  if (PRIVATE || !auth || !auth.rt) { if (b) b.remove(); return; }
  if (!b) { b = el("span", "xacc"); b.onclick = acctPanel; box.appendChild(b); }
  b.classList.toggle("warn", !!auth.expired || !!lastErr);
  b.innerHTML = auth.pic ? '<img alt="" referrerpolicy="no-referrer">' : esc((auth.name || auth.email || "G").charAt(0).toUpperCase());
  if (auth.pic) b.querySelector("img").src = auth.pic;
  b.title = (auth.email || "Google account") + (auth.expired ? " - sign in again" : busy ? " - syncing" : " - synced " + ago(gState().lastSync));
}
X3.acctPanel = acctPanel; X3.signIn = signIn; X3.syncG = syncG; X3.catchCode = catchCode;

/* ---------------------------------------------------------------- hooks */
const onCloud0 = on;
on = function (p) {
  const c = p[0];
  if (pending && (c === "tab-url" || c === "tab-created") && catchCode(+p[1], c === "tab-url" ? p[2] : p[3])) { if (c === "tab-created") onCloud0(p); return; }
  onCloud0(p);
  if (c === "download") onUpdDl(p);
};
X3.menuRows = function (m) {
  if (PRIVATE) return;
  const a = updAvail();
  m.appendChild(row("google", auth && auth.rt ? "Google account (" + (auth.email || "signed in") + ")" + (auth.expired ? " ●" : "") : "Sign in with Google…", "", acctPanel));
  m.appendChild(row("upd", a ? "Update to Webs Browser " + a.version + " ●" : "Check for updates", "", () => a ? updPanel() : checkUpdate(true)));
};
const commands1 = commands;
commands = function () {
  return commands1().concat([
    { t:"Google account: save my layout", k:"", i:"google", fn:acctPanel },
    { t:"Sync with Google now", k:"", i:"cloud", fn:() => G_ON() ? syncG(true) : acctPanel() },
    { t:"Check for updates", k:"", i:"upd", fn:() => checkUpdate(true) }
  ]);
};
// Settings (another page) asks through storage; this page answers in wsb.xgStatus
addEventListener("storage", e => {
  if (PRIVATE || !e.newValue) return;
  if (e.key === "wsb.xgCmd") {
    let c = null; try { c = JSON.parse(e.newValue); } catch (x) {}
    if (!c || Date.now() - (+c.t || 0) > 10000) return;
    // every window hears it; only the one that wins the lock acts on it
    if (c.cmd !== "status" && !haveLock()) return;
    if (c.cmd === "signin") signIn();
    else if (c.cmd === "sync") syncG(true);
    else if (c.cmd === "signout") signOut();
    else if (c.cmd === "delete") deleteCloud();
    else if (c.cmd === "panel") acctPanel();
    else if (c.cmd === "check") checkUpdate(true);
    else if (c.cmd === "update") { if (updAvail()) startUpdate(); }
    else if (c.cmd === "status") publish();
  } else if (G_ON() && /^wsb\.(settings|tiles|hidden|panels|shield|bookmarks|notes|todo|reading|collections|highlights|stickies|habits|events)$/.test(e.key)) syncSoon(30000);
});
if (!PRIVATE) {
  publish(); paintUpd(); paintAcctBtn();
  setTimeout(() => checkUpdate(false), 25000);
  setInterval(() => checkUpdate(false), 6 * 3600000);
  if (G_ON()) setTimeout(() => syncG(false), 12000);
  setInterval(() => { if (G_ON()) syncG(false); }, 4 * 60000);
  setInterval(paintAcctBtn, 60000);
}
})();
