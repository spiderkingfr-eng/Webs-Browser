/* Webs Browser - what the owner learns, and sharing with friends (Windows 3.10, iPhone 2.9), shared by both apps.
   Only with "Send anonymous counts" on (Settings), and once a day (POST /stats on the Web AI server, ledger.js):
     Stats.use(name)        a feature was used (the apps count panels and tools as they open: a name, never a page)
     errors                 the apps' own errors (the message and where in Webs), to fix them
     Stats.ab(id, v, what)  an A/B test's announcement was "seen" or "click"ed in version "A" or "B"
   And for everyone:
     Stats.invite()         -> { code, n, url }  your invite link, and how many friends joined with it
     Stats.claim(code)      a new device opened a friend's invite: both of you get an achievement
     Stats.gallery()        the wallpapers people shared that the owner approved
     Stats.share(file, title, by, opt)   share one (a JPEG made from your picture, at most 1600 px wide); opt { kind:"fanart", link }
                                         marks fan art you drew (items then carry kind and link too) */
(function () {
"use strict";
if (window.Stats) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const APP_URL = "https://spiderkingfr-eng.github.io/Webs-Browser/";
const opt = { platform:"", version:"" };
const day = () => new Date().toISOString().slice(0, 10);
function server() {
  for (const s of [(get("xai", {}) || {}).server, (get("xaiConfig", {}) || {}).server, (get("push", {}) || {}).server]) {
    const a = String(s || "").trim().replace(/\/+$/, ""); if (/^https:\/\/\S+$/.test(a)) return a;
  }
  return "";
}
function dev() {
  let d = get("xaiDev", ""); if (/^[A-Za-z0-9]{20,40}$/.test(d)) return d;
  const a = new Uint8Array(15); crypto.getRandomValues(a); d = [...a].map(b => b.toString(16).padStart(2, "0")).join(""); put("xaiDev", d); return d;
}
const countsOn = () => (get("settings", {}) || {}).liveCounts !== false && !/[?&]private=1/.test(location.search);
const saved = () => Object.assign({ uses:{}, errors:[], ab:{} }, get("statBuf", {}) || {});
const buf = () => pend ? JSON.parse(JSON.stringify(pend)) : saved();

/* ---------------------------------------------------------------- counting */
let pend = null, pendT = 0;
// kept in memory and written within 1.5 seconds of the first change (busy moments don't keep pushing it back)
function edit(f) { if (!pend) pend = saved(); f(pend); if (!pendT) pendT = setTimeout(() => { pendT = 0; if (pend) { put("statBuf", pend); pend = null; } }, 1500); }
function use(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48);
  if (!n || !countsOn()) return;
  edit(b => { if (b.uses[n] != null || Object.keys(b.uses).length < 150) b.uses[n] = (b.uses[n] || 0) + 1; });
}
function err(m, s) {
  m = String(m || "").slice(0, 300); if (!m || !countsOn() || /ResizeObserver loop|Script error\.?$/.test(m)) return;
  s = String(s || "").replace(/https?:\/\/(?!browser\.example|spiderkingfr-eng\.github\.io|app\.example)[^\s)]+/g, "(a page)").slice(0, 120);
  edit(b => { const x = b.errors.find(e => e.m === m && e.s === s); if (x) x.n++; else if (b.errors.length < 20) b.errors.push({ m, s, n:1 }); });
}
addEventListener("error", e => { if (e && e.message) err(e.message, (e.filename || "").replace(/^.*\//, "") + ":" + (e.lineno || 0)); });
addEventListener("unhandledrejection", e => { const r = e && e.reason; if (r && (r.name === "AbortError" || /Failed to fetch|NetworkError|Load failed/.test(r.message || ""))) return; err(r && r.message ? r.name + ": " + r.message : String(r), "promise"); });
function ab(id, v, what) {
  if (!/^[a-z0-9]{4,16}$/.test(id || "") || !/^[AB]$/.test(v) || !countsOn()) return;
  edit(b => { const x = b.ab[id] || (b.ab[id] = { v }); x.v = v; x[what === "click" ? "click" : "seen"] = 1; });
}
// once a day: what was counted since the last time
async function flush(force) {
  if (pend) { put("statBuf", pend); pend = null; }
  if (!countsOn() || !server() || (!force && get("statSent", "") === day())) return false;
  const b = saved();
  const body = { device:dev(), platform:opt.platform, version:opt.version, uses:b.uses, errors:b.errors, ab:Object.keys(b.ab).map(id => Object.assign({ id }, b.ab[id])) };
  try {
    const r = await fetch(server() + "/stats", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) });
    if (!r.ok && r.status !== 503) return false;
  } catch (e) { return false; }
  put("statSent", day()); put("statBuf", { uses:{}, errors:[], ab:{} });
  return true;
}
function init(o) {
  Object.assign(opt, o || {});
  setTimeout(() => flush(), 20000);
  setInterval(() => { if (document.visibilityState === "visible") { flush(); checkInvite(); } }, 30 * 60000);
  setTimeout(checkInvite, 60000);
  setTimeout(checkInvite, 8000);
}

/* ---------------------------------------------------------------- invites */
async function post(path, b) {
  const s = server(); if (!s) throw new Error("Open Web AI once first: invites go through its server.");
  let r; try { r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(Object.assign({ device:dev(), platform:opt.platform }, b)) }); }
  catch (e) { throw new Error("Can't reach the server. Check your internet connection."); }
  const j = await r.json().catch(() => null);
  if (!j || (!r.ok && !j.again)) throw new Error(j && j.message || "That didn't work (error " + r.status + ").");
  return j;
}
const unlock = (id, e, n, d) => { try { if (window.Live && Live.unlock) return Live.unlock(id, e, n, d, true); } catch (x) {} return false; };
async function invite() {
  const j = await post("/invite/new", {});
  put("invite", { code:j.code, n:j.n, at:Date.now() });
  if (j.n >= 1) unlock("invite-friend", "💌", "Bring a friend", "A friend joined Webs with your invite");
  if (j.n >= 5) unlock("invite-five", "🎉", "Party starter", "Five friends joined with your invite");
  return { code:j.code, n:j.n, url:APP_URL + "#invite=" + j.code };
}
async function claim(code) {
  code = String(code || "").trim().toLowerCase().replace(/^.*invite=/, "").replace(/[^a-z0-9]/g, "");
  if (!/^[a-z0-9]{8}$/.test(code)) throw new Error("An invite code has 8 letters and numbers.");
  const j = await post("/invite/claim", { code });
  put("invitedBy", code);
  unlock("invited", "🤝", "Welcome in", "Joined Webs with a friend's invite");
  return j;
}
// an invite that came with the link (…#invite=…) waits until the server is known; the inviter's count is checked now and then
function checkInvite() {
  const w = get("inviteWait", ""); if (w && server() && !get("invitedBy", "")) claim(w).then(() => put("inviteWait", ""), e => { if (/valid|own/.test(e.message)) put("inviteWait", ""); });
  const i = get("invite", null); if (i && Date.now() - (i.at || 0) > 86400000) invite().catch(() => {});
}
const m = /[#&]invite=([a-z0-9]{8})/i.exec(location.hash);
if (m) { put("inviteWait", m[1].toLowerCase()); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }

/* ---------------------------------------------------------------- the wallpaper gallery */
async function gallery() {
  const s = server(); if (!s) throw new Error("Open Web AI once first: the gallery comes from its server.");
  const r = await fetch(s + "/gallery"), j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error(j && j.message || "The gallery isn't available right now.");
  return j.items;
}
// a picture as a JPEG data: URL, at most 1600 px wide and 600 KB
function toJpeg(file) {
  return new Promise((ok, bad) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(u);
      let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, 1600 / w, 1600 / h); w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(im, 0, 0, w, h);
      for (let q = 0.86; q >= 0.4; q -= 0.12) { const d = c.toDataURL("image/jpeg", q); if (d.length * 0.75 < 590 * 1024) { ok(d); return; } }
      bad(new Error("That picture is too big to share."));
    };
    im.onerror = () => { URL.revokeObjectURL(u); bad(new Error("That isn't a picture Webs can read.")); };
    im.src = u;
  });
}
// opt (3.14 / 2.11, #074): { kind:"fanart", link } for fan art you drew yourself, with a link to your page (https only)
async function share(file, title, by, opt) {
  opt = opt || {};
  const img = typeof file === "string" ? file : await toJpeg(file), link = /^https:\/\/\S+$/.test(String(opt.link || "").trim()) ? String(opt.link).trim().slice(0, 300) : "";
  return post("/gallery/send", Object.assign({ img, title:String(title || "").slice(0, 60), by:String(by || "").slice(0, 40) }, opt.kind === "fanart" ? { kind:"fanart", link } : {}));
}

window.Stats = { init, use, err, ab, flush, invite, claim, gallery, share, toJpeg, buf, APP_URL, _opt:opt };
})();
