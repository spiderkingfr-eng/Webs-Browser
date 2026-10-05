/* Webs Browser - your devices together, and live rooms (Windows 3.10, iPhone 2.9), shared by both apps.
   Linking: one device makes a 6-digit code (POST /link/new), the other types it (POST /link/join); both then
   hold the same link (wsb.devLink), which opens their room on the Web AI server (rooms.js).
   Link.room(key, opt)   a live room: { on(type, fn), set(k, v), msg(d, to), store, peers, you, close() }
                         types: "open", "peers", "set", "msg", "close"; reconnects by itself
   Link.connect(opt)     your own devices' room (opt: app, onSet, onMsg, onPeers); Link.room for it in Link.r
   Link.pairNew() / Link.join(code) / Link.unlink()
   What goes through it, kept in the room:
     clip              { text, from, ts }            the shared clipboard
     now.<device>      { u, t, ts, from, app }       the page each device has open: pick up where you left off
     tabs.<id>         { name, list:[{ u, t }], from, ts }   a set of tabs sent to your other devices (5 kept)
   and passed along: { k:"remote", cmd, arg } from a phone used as a remote.
   Link.shareUrl(name, list) / Link.readShare(hash)   a set of tabs for anyone, in a link (nothing stored) */
(function () {
"use strict";
if (window.Link) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const APP_URL = "https://spiderkingfr-eng.github.io/Webs-Browser/";
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
const code = () => String((get("xai", {}) || {}).code || (get("xaiConfig", {}) || {}).code || "");
const state = () => get("devLink", null) || {};
const linked = () => /^[a-z0-9]{24}$/.test(state().link || "");
let APP = "";
const myName = () => state().me || (APP === "iphone" || /iPhone|iPad/.test(navigator.userAgent) ? (/iPad/.test(navigator.userAgent) ? "iPad" : "iPhone") : "PC");

async function post(path, body) {
  const s = server(); if (!s) throw new Error("Connect Web AI first (open it once): linking uses its server.");
  let r; try { r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(Object.assign({ code:code(), device:dev() }, body)) }); }
  catch (e) { throw new Error("Can't reach the server. Check your internet connection."); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error(j && j.message || "That didn't work (error " + r.status + ").");
  return j;
}
async function pairNew() {
  const j = await post("/link/new", { link:state().link || "" });
  put("devLink", Object.assign(state(), { link:j.link, at:Date.now() }));
  return j;
}
async function join(pair) {
  const j = await post("/link/join", { pair:String(pair || "").replace(/\D/g, "") });
  put("devLink", Object.assign(state(), { link:j.link, at:Date.now() }));
  if (L.r) { L.r.close(); L.r = null; }
  return j;
}
function unlink() { if (L.r) { L.r.close(); L.r = null; } put("devLink", { me:state().me || "" }); }
function rename(n) { put("devLink", Object.assign(state(), { me:String(n || "").trim().slice(0, 30) })); if (L.r) { L.r.close(); L.r = null; } }

/* ---------------------------------------------------------------- a live room */
function room(key, opt) {
  opt = opt || {};
  const ls = {}, R = { key, store:{}, peers:[], you:"", open:false, closed:false };
  const fire = (t, ...a) => (ls[t] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  let ws = null, tries = 0, timer = 0, ping = 0, queue = [];
  function connect() {
    if (R.closed) return;
    const s = server(); if (!s || typeof WebSocket === "undefined") { fire("close", "no server"); return; }
    const u = s.replace(/^http/, "ws") + "/room?k=" + encodeURIComponent(key) + "&dev=" + encodeURIComponent(dev()) + "&name=" + encodeURIComponent(opt.name || myName()) + "&app=" + (opt.app || "web");
    try { ws = new WebSocket(u); } catch (e) { retry(); return; }
    ws.onmessage = e => {
      let m = null; try { m = JSON.parse(e.data); } catch (x) {} if (!m) return;
      if (m.t === "hi") { R.you = m.you; R.peers = m.peers || []; R.store = m.store || {}; R.open = true; tries = 0; const q = queue; queue = []; q.forEach(x => ws.send(x)); fire("open", R); fire("peers", R.peers); }
      else if (m.t === "peers") { R.peers = m.peers || []; fire("peers", R.peers); }
      else if (m.t === "set") { if (m.v === null) delete R.store[m.k]; else R.store[m.k] = m.v; fire("set", m.k, m.v, m.from); }
      else if (m.t === "msg") fire("msg", m.d, m.from);
      else if (m.t === "full") { R.closed = true; fire("close", "full"); }
      else if (m.t === "error") fire("error", m.message);
    };
    ws.onclose = () => { R.open = false; clearInterval(ping); fire("close", "lost"); retry(); };
    ws.onerror = () => {};
    clearInterval(ping); ping = setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 30000);
  }
  function retry() { if (R.closed) return; clearTimeout(timer); timer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, tries++))); }
  function send(o) { const s = JSON.stringify(o); if (ws && ws.readyState === 1 && R.open) ws.send(s); else { queue.push(s); queue = queue.slice(-20); } }
  R.on = (t, f) => { (ls[t] = ls[t] || []).push(f); return R; };
  R.set = (k, v) => { if (v === null) delete R.store[k]; else R.store[k] = v; send({ t:"set", k, v }); };
  R.msg = (d, to) => send({ t:"msg", d, to });
  R.close = () => { R.closed = true; clearTimeout(timer); clearInterval(ping); try { if (ws) ws.close(); } catch (e) {} };
  R.again = () => { if (!R.open && !R.closed) { tries = 0; clearTimeout(timer); connect(); } };
  setTimeout(connect, 0);
  return R;
}
// a game code: 6 letters and numbers that can't be mixed up
function newCode() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map(x => A[x % A.length]).join(""); }

/* ---------------------------------------------------------------- your devices */
function connect(opt) {
  if (opt && opt.app) APP = opt.app;
  if (!linked()) return null;
  if (L.r && !L.r.closed) return L.r;
  const r = L.r = room("l." + state().link, { app:opt && opt.app, name:myName() });
  return r;
}
const others = () => L.r ? L.r.peers.filter(p => p.id !== L.r.you) : [];
// what the other devices have open, newest first
function nowList() {
  const s = L.r ? L.r.store : get("linkStore", {}) || {}, me = dev();
  return Object.keys(s).filter(k => k.indexOf("now.") === 0 && k !== "now." + me).map(k => s[k]).filter(x => x && x.u && Date.now() - (+x.ts || 0) < 3 * 86400000).sort((a, b) => b.ts - a.ts);
}
let nowT = 0, nowLast = "";
function setNow(u, t, app) {
  if (!L.r || !/^https?:\/\//i.test(u || "")) return;
  clearTimeout(nowT);
  nowT = setTimeout(() => { if (u === nowLast) return; nowLast = u; L.r.set("now." + dev(), { u:String(u).slice(0, 2000), t:String(t || "").slice(0, 200), ts:Date.now(), from:myName(), app:app || "" }); }, 4000);
}
function sendClip(text) { if (L.r && text) L.r.set("clip", { text:String(text).slice(0, 20000), from:myName(), ts:Date.now() }); }
function tabSets() { const s = L.r ? L.r.store : {}; return Object.keys(s).filter(k => k.indexOf("tabs.") === 0).map(k => Object.assign({ id:k.slice(5) }, s[k])).filter(x => x && Array.isArray(x.list)).sort((a, b) => b.ts - a.ts); }
function sendTabs(name, list) {
  if (!L.r) return false;
  const l = list.filter(x => /^https?:\/\//i.test(x.u || "")).slice(0, 60).map(x => ({ u:String(x.u).slice(0, 2000), t:String(x.t || "").slice(0, 120) }));
  if (!l.length) return false;
  const old = tabSets(); old.slice(4).forEach(x => L.r.set("tabs." + x.id, null));
  L.r.set("tabs." + Math.random().toString(36).slice(2, 8), { name:String(name || "Tabs").slice(0, 60), list:l, from:myName(), ts:Date.now() });
  return true;
}
// a set of tabs for anyone: in the link itself
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
function shareUrl(name, list) {
  const l = list.filter(x => /^https?:\/\//i.test(x.u || "")).slice(0, 30).map(x => [String(x.u).slice(0, 600), String(x.t || "").slice(0, 60)]);
  return APP_URL + "#tabs=" + b64u(JSON.stringify({ n:String(name || "").slice(0, 60), l }));
}
function readShare(h) {
  const m = /(?:^|[#&])tabs=([A-Za-z0-9_-]+)/.exec(h || ""); if (!m) return null;
  try { const j = JSON.parse(unb64u(m[1])); const list = (Array.isArray(j.l) ? j.l : []).filter(x => Array.isArray(x) && /^https?:\/\//i.test(x[0])).slice(0, 30).map(x => ({ u:String(x[0]), t:String(x[1] || "") }));
    return list.length ? { name:String(j.n || ""), list } : null; } catch (e) { return null; }
}
// remote buttons (a phone working the PC)
const REMOTE = [["playpause", "⏯", "Play / pause"], ["prevtab", "◀", "Tab before"], ["nexttab", "▶", "Next tab"], ["up", "⬆", "Scroll up"], ["down", "⬇", "Scroll down"],
  ["back", "↩", "Back"], ["fwd", "↪", "Forward"], ["reload", "↻", "Reload"], ["mute", "🔇", "Mute"], ["zoomin", "＋", "Zoom in"], ["zoomout", "－", "Zoom out"], ["fullscreen", "⛶", "Full screen"], ["close", "✕", "Close tab"]];
const setApp = a => { APP = a; };
const L = { setApp, server, dev, state, linked, myName, pairNew, join, unlink, rename, room, newCode, connect, others, nowList, setNow, sendClip, tabSets, sendTabs, shareUrl, readShare, REMOTE, APP_URL, r:null };
window.Link = L;
})();
