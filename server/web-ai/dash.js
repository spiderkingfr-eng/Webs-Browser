/* Web AI server - the owner's dashboard (GET /admin), as files the worker serves:
   ADMIN_PAGE the page, DASH_CSS its look, DASH_JS what it does, DASH_SW the service worker that shows
   the owner's alerts when the dashboard is installed as an app, DASH_MANIFEST and the icons for that.
   DASH_JS is plain JavaScript kept in a String.raw template, so it has no backticks and no dollar-brace. */
import { ICON_192, ICON_TOUCH } from "./icons.js";

export const ADMIN_PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">
<title>Web AI dashboard</title><meta name="theme-color" content="#16131a"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Webs admin">
<link rel="manifest" href="admin/manifest.json"><link rel="apple-touch-icon" href="admin/apple-touch-icon.png"><link rel="icon" href="admin/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="admin/app.css"></head><body>
<main id="app"><h1>Web AI dashboard</h1><p class="d">Loading…</p></main>
<div id="toast" class="toast hide"></div>
<script src="admin/app.js"></script></body></html>`;

export const DASH_ICON = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#e8342a"/><path d="M18 22h28v20H18z" fill="#fff" opacity=".9"/><path d="M22 28h20M22 34h14" stroke="#e8342a" stroke-width="3" stroke-linecap="round"/></svg>`;

export const DASH_MANIFEST = JSON.stringify({ name:"Webs admin", short_name:"Webs admin", start_url:"/admin", scope:"/admin", display:"standalone", background_color:"#16131a", theme_color:"#16131a",
  icons:[{ src:"/admin/icon-192.png", sizes:"192x192", type:"image/png" }, { src:"/admin/apple-touch-icon.png", sizes:"180x180", type:"image/png" }] });

export const DASH_PNG = { "/admin/icon-192.png":ICON_192, "/admin/apple-touch-icon.png":ICON_TOUCH };

// the owner's alerts: show them, and open the dashboard (on the chat or the login to approve) when tapped
export const DASH_SW = String.raw`self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body:e.data ? e.data.text() : "" }; }
  const o = { body:String(m.body || "").slice(0, 300), icon:"/admin/icon-192.png", badge:"/admin/icon-192.png", data:{ url:typeof m.url === "string" ? m.url : "/admin" } };
  if (m.tag) { o.tag = String(m.tag).slice(0, 40); o.renotify = true; }
  e.waitUntil(self.registration.showNotification(String(m.title || "Webs").slice(0, 80), o));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  let url = "/admin";
  try { const u = new URL(e.notification.data && e.notification.data.url || "/admin", self.location.origin); if (u.origin === self.location.origin) url = u.href; } catch (x) {}
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
    const c = list.find(x => x.url.indexOf("/admin") >= 0);
    if (c) return c.focus().then(w => w && w.navigate ? w.navigate(url) : null).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});`;

export const DASH_CSS = String.raw`
:root{--bg:#16131a;--bg2:#1e1a24;--bg3:#272230;--line:#322c3c;--fg:#f3eff1;--dim:#9a91a3;--accent:#e8342a;--good:#2fbf71;--warn:#febc2e}
@media (prefers-color-scheme:light){:root{--bg:#efebe3;--bg2:#f9f6ef;--bg3:#e6e0d6;--line:#d9d2c6;--fg:#1d1a20;--dim:#6b6560;--good:#17803f;--warn:#a86b00}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:calc(18px + env(safe-area-inset-top)) 16px 80px}h1{font-size:22px;margin:0}h2{font-size:16px;margin:26px 0 10px}h3{font-size:14.5px;margin:0 0 8px}
p.d,.d{color:var(--dim)}p.d{margin:0 0 14px}.small{font-size:12.5px}.hide{display:none!important}.err{color:#ff7a6e}.ok{color:var(--good)}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:12px}
input,button,select,textarea{font:inherit}input,select,textarea{background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--fg);padding:9px 11px;width:100%}
textarea{resize:vertical;min-height:64px}input[type=checkbox]{width:auto;accent-color:var(--accent)}input[type=range]{padding:0;accent-color:var(--accent)}
label{display:block;font-size:13px;color:var(--dim);margin:8px 0 0}label>input,label>select,label>textarea{margin-top:4px;color:var(--fg)}label.chk{display:flex;gap:8px;align-items:center;color:var(--fg);font-size:14px}
button{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:9px 15px;cursor:pointer}button.ghost{background:var(--bg3);color:var(--fg)}button.small{padding:5px 11px;font-size:13px}
button.danger{background:transparent;color:#ff7a6e;border:1px solid currentColor}button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}.row>.sp{flex:1}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 12px}
@media (max-width:640px){.grid2,.grid3{grid-template-columns:1fr}}
.top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.top .sp{flex:1}.top button{margin:0}
.tabs{display:flex;gap:4px;overflow-x:auto;margin:14px -4px 16px;padding:0 4px;scrollbar-width:none;position:sticky;top:0;background:var(--bg);z-index:5;padding-top:6px;padding-bottom:6px}
.tabs::-webkit-scrollbar{display:none}.tabs button{background:transparent;color:var(--dim);white-space:nowrap;border-radius:99px;padding:7px 13px;font-weight:600;font-size:14px}
.tabs button.on{background:var(--fg);color:var(--bg)}.tabs .n{display:inline-block;min-width:18px;padding:0 5px;margin-left:5px;border-radius:9px;background:var(--accent);color:#fff;font-size:11px;line-height:18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}.tile{margin:0}.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.tile span{color:var(--dim);font-size:13px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.chip{font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:99px;background:var(--bg3)}.chip.bad{background:#7a1e1e;color:#fff}.chip.good{background:#1e7a4a;color:#fff}
.bars{display:grid;gap:6px}.bar{display:grid;grid-template-columns:110px 1fr 90px;gap:10px;align-items:center;font-size:13px}.bar i{display:block;height:10px;border-radius:5px;background:var(--accent);min-width:2px}
.bar em{font-style:normal;color:var(--dim);text-align:right;font-variant-numeric:tabular-nums}.bar span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pill{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--bg3);color:var(--dim);white-space:nowrap}.pill.on{background:#1e7a4a;color:#fff}.pill.off{opacity:.7}.pill.red{background:var(--accent);color:#fff}
.list .it{display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid var(--line);font-size:14px}.list .it:last-child{border-bottom:0}.list .it .tx{flex:1;min-width:0}
.list .it .tx b{display:block;font-size:14px}.list .it .tx span{display:block;color:var(--dim);font-size:12.5px;overflow:hidden;text-overflow:ellipsis}.list .it button{margin:0}
.sw{position:relative;width:44px;height:26px;flex:none;display:inline-block}.sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:1;width:100%}
.sw span{position:absolute;inset:0;border-radius:13px;background:var(--bg3);border:1px solid var(--line);transition:background .15s}.sw span::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#bbb;transition:left .15s}
.sw input:checked+span{background:#1e7a4a;border-color:#1e7a4a}.sw input:checked+span::after{left:21px;background:#fff}
.swrow{display:flex;gap:12px;align-items:center;padding:6px 0}.swrow .tx{flex:1}.swrow .tx i{display:block;font-style:normal;color:var(--dim);font-size:12.5px}
.sched .it{font-size:13.5px}.sched .when{font-variant-numeric:tabular-nums;color:var(--dim);white-space:nowrap}
.res{margin-top:8px;font-size:13px;color:var(--dim)}.res .bar{grid-template-columns:140px 1fr 60px}
.prev{margin-top:10px;border:1px dashed var(--line);border-radius:12px;padding:12px}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:12px;font-size:14px;z-index:50;max-width:calc(100% - 32px);box-shadow:0 10px 30px rgba(0,0,0,.4)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:grid;place-items:center;z-index:40;padding:16px}.modal>div{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:18px;max-width:440px;width:100%}
.big{font-size:20px;font-weight:700;letter-spacing:.06em;font-family:ui-monospace,Menlo,monospace;background:var(--bg3);border-radius:10px;padding:10px;text-align:center;margin:10px 0}
.flag{font-size:16px;margin-right:4px}
details.fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px}details.fold>summary::-webkit-details-marker{display:none}
details.fold>summary b{flex:1;font-size:14.5px}details.fold>summary::after{content:"▾";color:var(--dim);transition:transform .15s}details.fold[open]>summary::after{transform:rotate(180deg)}
details.fold[open]>summary{margin-bottom:6px}
.ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.ach div{background:var(--bg3);border-radius:12px;padding:10px;opacity:.45}.ach div.got{opacity:1;box-shadow:inset 0 0 0 1px var(--warn)}
.ach em{font-style:normal;font-size:22px;display:block}.ach b{display:block;font-size:13px}.ach span{font-size:11.5px;color:var(--dim)}
/* Help & support (the chats, and their settings while they allow it) */
.sup .row2{display:flex;gap:10px;align-items:center;padding:10px 6px;border-bottom:1px solid var(--line);cursor:pointer;border-radius:8px}.sup .row2:hover{background:var(--bg3)}
.sup .row2:last-child{border-bottom:0}.sup .row2 .ic{font-size:20px}.sup .row2 .tx{flex:1;min-width:0}.sup .row2 .tx b{display:block;font-size:14px}
.sup .row2 .tx span{display:block;color:var(--dim);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tk{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;margin-top:10px}@media (max-width:760px){.tk{grid-template-columns:1fr}}
.tkh{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tkh b{font-size:15px}.tkh span{color:var(--dim);font-size:13px}.tkh .sp{flex:1}.tkh button{margin:0}
.chat{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;padding:4px}.msg{max-width:85%;padding:8px 11px;border-radius:12px;font-size:14px;white-space:pre-wrap;word-break:break-word}
.msg.u{background:var(--bg3);align-self:flex-start;border-bottom-left-radius:4px}.msg.a{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}.msg.a.auto{opacity:.75}
.msg i{display:block;font-style:normal;font-size:11px;opacity:.7;margin-top:3px}
.reply{display:flex;gap:8px;margin-top:10px}.reply textarea{flex:1;min-height:42px}.reply button{margin:0;align-self:flex-end}
.dev{border-radius:16px;border:1px solid var(--line);background:var(--bg);overflow:hidden}.dev.iphone{border-radius:34px;border:8px solid #2b2731;max-width:380px;margin:0 auto}
.devbar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--bg3);font-size:12.5px;color:var(--dim)}.devbar i{width:10px;height:10px;border-radius:50%;background:#ff5f57}.devbar i+i{background:#febc2e}.devbar i+i+i{background:#28c840}
.dev.iphone .devbar{justify-content:center;background:var(--bg2)}.dev.iphone .devbar i{display:none}
.acc{padding:9px 12px;font-size:13px;border-bottom:1px solid var(--line)}.acc.on{background:rgba(30,122,74,.18);color:#7fe0aa}.acc.off{background:rgba(255,122,110,.1);color:#ffb3aa}
@media (prefers-color-scheme:light){.acc.on{color:#17643d}.acc.off{color:#a3291f}}
.sets{max-height:460px;overflow:auto;padding:4px 12px 12px}.sets h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.set{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}.set .l{flex:1}.set .w{font-size:11.5px;color:var(--warn)}.set .w.d{color:#7fe0aa}
.set select{width:auto;max-width:52%;padding:5px 8px;font-size:13px}
.tg{width:44px;height:26px;border-radius:13px;background:var(--bg3);border:1px solid var(--line);position:relative;cursor:pointer;padding:0;margin:0;flex:none}
.tg::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#bbb;transition:left .15s}.tg.on{background:#1e7a4a;border-color:#1e7a4a}.tg.on::after{left:21px;background:#fff}
.sets.locked .set select,.sets.locked .tg,.sets.locked button.act{opacity:.45;pointer-events:none}
button.act{background:var(--bg3);color:var(--fg);padding:6px 12px;font-size:13px;margin:0}
.rep h3{margin:0 0 4px}.rep .meta{color:var(--dim);font-size:12.5px}.rep pre{white-space:pre-wrap;word-break:break-word;background:var(--bg3);border-radius:8px;padding:8px;font-size:12px;max-height:240px;overflow:auto}
.rep .ans{background:rgba(30,122,74,.15);border-radius:8px;padding:8px;font-size:13.5px;margin-top:8px}
/* a calling card, as the apps show it */
.cc{position:relative;background:#e60012;color:#000;border-radius:6px;padding:22px 20px;overflow:hidden;font-family:"Arial Black",Impact,system-ui,sans-serif;transform:rotate(-1.5deg)}
.cc::before{content:"";position:absolute;inset:-40%;background:repeating-conic-gradient(from 0deg,#000 0 6deg,transparent 6deg 18deg);opacity:.14}
.cc b{position:relative;display:inline-block;background:#000;color:#fff;padding:2px 10px;transform:skew(-8deg);font-size:22px;letter-spacing:.02em}
.cc p{position:relative;font-family:Georgia,serif;font-weight:700;font-size:16px;background:#fff;padding:8px 10px;margin:12px 0 8px;transform:rotate(1deg)}
.cc i{position:relative;display:block;text-align:right;font-style:normal;font-size:13px}
/* the Phantom Thieves look */
body.p5{--bg:#0b0b0b;--bg2:#141414;--bg3:#232323;--line:#e60012;--fg:#fff;--dim:#c9c9c9;--accent:#e60012;
  background:#0b0b0b radial-gradient(circle at 20% 10%,rgba(230,0,18,.18),transparent 40%),radial-gradient(#2a2a2a 1px,transparent 1.5px) 0 0/14px 14px}
body.p5 h1{margin-bottom:12px;font-family:"Arial Black",Impact,sans-serif;text-transform:uppercase;letter-spacing:.04em;transform:skew(-10deg);display:inline-block;background:#fff;color:#000;padding:2px 12px;box-shadow:6px 6px 0 #e60012}
body.p5 h2{font-family:"Arial Black",Impact,sans-serif;text-transform:uppercase;transform:skew(-8deg);display:inline-block;background:#e60012;color:#fff;padding:1px 10px}
body.p5 h2::after{content:" ★"}
body.p5 .card{border-width:2px;border-radius:2px;clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
body.p5 .tabs button.on{background:#e60012;color:#fff;transform:skew(-10deg)}body.p5 button{border-radius:2px}
`;

export const DASH_JS = String.raw`(function () {
"use strict";
var $ = function (id) { return document.getElementById(id); };
function E(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
var code = sessionStorage.getItem("c") || localStorage.getItem("wc") || "", trust = localStorage.getItem("wt") || "";
var S = { live:{}, agg:{}, cfg:null };
var money = function (v) { v = +v || 0; return "$" + (v < 1 ? v.toFixed(3) : v.toFixed(2)); };
var ago = function (ts) { var s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : new Date(ts).toLocaleDateString(); };
var when = function (ts) { return new Date(ts).toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); };
var flag = function (cc) { return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : "🌐"; };
var today = function (n) { var d = new Date(Date.now() + (n || 0) * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
var dateTs = function (s, end) { if (!s) return 0; var d = new Date(s + (end ? "T23:59:59" : "T00:00:00")); return isNaN(d) ? 0 : d.getTime(); };
var tsDate = function (ts) { if (!ts) return ""; var d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
var toastT = 0;
function toast(m) { var t = $("toast"); t.textContent = m; t.classList.remove("hide"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("hide"); }, 3000); }

async function call(o) {
  var r = await fetch("admin", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(Object.assign({ code:code, trust:trust }, o)) });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) { var e = new Error(j.message || "Error " + r.status); e.data = j; e.status = r.status; throw e; }
  return j;
}
window.call = call;
async function act(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { var r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message); throw e; } finally { if (btn) btn.disabled = false; }
}

/* ---------------------------------------------------------------- small form helpers */
function inp(label, value, attrs) { var l = E("label", "", label), i = E(attrs && attrs.area ? "textarea" : "input"); if (attrs) for (var k in attrs) if (k !== "area") i.setAttribute(k, attrs[k]); i.value = value == null ? "" : value; l.appendChild(i); l.input = i; return l; }
function sel(label, value, opts) { var l = E("label", "", label), s = E("select"); opts.forEach(function (o) { var x = E("option", "", o[1]); x.value = o[0]; s.appendChild(x); }); s.value = value == null ? "" : String(value); l.appendChild(s); l.input = s; return l; }
function sw(label, on, sub) { var r = E("div", "swrow"), t = E("div", "tx", label), w = E("span", "sw"), i = E("input"); i.type = "checkbox"; i.checked = !!on; if (sub) t.appendChild(E("i", "", sub)); add(w, i, E("span")); add(r, t, w); r.input = i; return r; }
function btn(text, fn, cls) { var b = E("button", cls || "", text); b.onclick = function () { fn(b); }; return b; }
function card(parent, title, note) { var c = E("div", "card"); if (title) c.appendChild(E("h3", "", title)); if (note) c.appendChild(E("p", "d small", note)); parent.appendChild(c); return c; }
// a section that opens and closes; "On" when it's showing on people's start pages
function fold(parent, title, note, on, open) {
  var c = E("details", "card fold"), sm = E("summary"); add(sm, E("b", "", title), E("span", "pill" + (on ? " on" : ""), on ? "On" : "Off"));
  c.appendChild(sm); if (note) c.appendChild(E("p", "d small", note)); if (on || open) c.open = true; parent.appendChild(c); return c;
}
function rowOf() { var r = E("div", "row"); for (var i = 0; i < arguments.length; i++) if (arguments[i]) r.appendChild(arguments[i]); return r; }
function bars(box, list, fmt) { box.innerHTML = ""; var max = Math.max.apply(null, [1].concat(list.map(function (x) { return x[1]; }))); list.forEach(function (x) { var r = E("div", "bar"), a = E("span"), b = E("i"), c = E("em"); a.textContent = x[0]; b.style.width = (x[1] / max * 100) + "%"; c.textContent = fmt ? fmt(x) : x[1]; add(r, a, b, c); box.appendChild(r); }); if (!list.length) box.appendChild(E("p", "d small", "Nothing yet.")); }

/* ---------------------------------------------------------------- signing in */
function loginView(msg) {
  var app = $("app"); app.innerHTML = "";
  add(app, E("h1", "", "Web AI dashboard"), E("p", "d", "Questions, devices, help and everything on everyone's start page."));
  var c = card(app, "Sign in");
  var ci = inp("Owner's code", "", { id:"code", type:"password", autocomplete:"current-password" });
  var rem = E("label", "chk"), rc = E("input"); rc.type = "checkbox"; rc.id = "remember"; rc.checked = !!localStorage.getItem("wc"); add(rem, rc, document.createTextNode("Remember on this device"));
  var go = E("button", "", "Open"); go.id = "go";
  var m = E("p", "err", msg || ""); m.id = "msg";
  add(c, ci, rem, rowOf(go), m);
  var w = E("div", "hide"); w.id = "wait2"; c.appendChild(w);
  go.onclick = function () { code = ci.input.value.trim(); m.textContent = ""; signIn(); };
  ci.input.onkeydown = function (e) { if (e.key === "Enter") go.click(); };
  ci.input.focus();
}
async function signIn() {
  try {
    var h = await call({ op:"hello" });
    if (h.trust) { trust = h.trust; localStorage.setItem("wt", trust); }
    sessionStorage.setItem("c", code);
    var r = $("remember"); if (r && r.checked) localStorage.setItem("wc", code); else if (r) localStorage.removeItem("wc");
    S.twoStep = h.twoStep;
    build();
  } catch (e) {
    if (e.data && e.data.error === "twostep") return waitApproval(e.data);
    sessionStorage.removeItem("c");
    loginView(e.message);
  }
}
function waitApproval(d) {
  if (!$("wait2")) loginView();
  var w = $("wait2"); w.classList.remove("hide"); w.innerHTML = "";
  add(w, E("p", "", "🔐 " + d.message), E("p", "d small", "Waiting… (5 minutes at most)"));
  var det = E("details"), sm = E("summary", "small", "Lost your phone? Use your recovery code"), ri = inp("Recovery code", "", { placeholder:"xxxx-xxxx-xxxx-xxxx" });
  var rb = btn("Use it", async function (b) {
    try { var r = await call({ op:"2fa.recover", recovery:ri.input.value }); trust = r.trust; localStorage.setItem("wt", trust); showSecret("Your new recovery code", r.recovery, "The old one doesn't work any more. Keep this one somewhere safe."); signIn(); } catch (e) { toast(e.message); }
  }, "ghost");
  add(det, sm, ri, rowOf(rb)); w.appendChild(det);
  var tries = 0, t = setInterval(async function () {
    if (++tries > 150) { clearInterval(t); w.firstChild.textContent = "That approval expired. Try again."; return; }
    try { var r = await call({ op:"2fa.poll", ch:d.ch }); if (r.trust) { clearInterval(t); trust = r.trust; localStorage.setItem("wt", trust); signIn(); } }
    catch (e) { if (e.status === 404) { clearInterval(t); w.firstChild.textContent = "That approval expired or was refused."; } }
  }, 2000);
}
function showSecret(title, value, note) {
  var m = E("div", "modal"), b = E("div");
  add(b, E("h3", "", title), E("div", "big", value), E("p", "d small", note), rowOf(btn("I've saved it", function () { m.remove(); })));
  m.appendChild(b); document.body.appendChild(m);
}

/* ---------------------------------------------------------------- the dashboard */
var TABS = [["overview", "Overview"], ["support", "Support"], ["live", "Start page"], ["push", "Notifications"], ["updates", "Updates"], ["settings", "Settings"], ["log", "Log"]];
var built = {};
function build() {
  var app = $("app"); app.innerHTML = ""; built = {};
  var top = E("div", "top"), h = E("h1", "", "Web AI dashboard");
  var achB = btn("🏆", openAch, "ghost small"); achB.id = "achb"; achB.title = "Your achievements";
  var p5 = btn("🎭", function () { var on = !document.body.classList.contains("p5"); document.body.classList.toggle("p5", on); if (on) localStorage.setItem("wp5", "1"); else localStorage.removeItem("wp5"); toast(on ? "Take your heart… Phantom Thieves look on." : "Normal look."); }, "ghost small"); p5.title = "Phantom Thieves look";
  var out = btn("Sign out", function () { sessionStorage.removeItem("c"); localStorage.removeItem("wc"); code = ""; loginView(); }, "ghost small");
  add(top, h, E("span", "sp"), achB, p5, out); app.appendChild(top);
  var nav = E("nav", "tabs"); nav.id = "tabs";
  TABS.forEach(function (t) { var b = E("button", "", t[1]); b.dataset.tab = t[0]; b.onclick = function () { show(t[0]); }; nav.appendChild(b); });
  app.appendChild(nav);
  TABS.forEach(function (t) { var s = E("section", "hide"); s.dataset.pane = t[0]; s.id = "pane-" + t[0]; app.appendChild(s); });
  var q = new URLSearchParams(location.search), hash = location.hash.slice(1);
  show(q.get("chat") ? "support" : hash === "reports" ? "support" : TABS.some(function (t) { return t[0] === hash; }) ? hash : "overview");
  if (q.get("chat")) setTimeout(function () { openTicket(q.get("chat")); }, 300);
  if (q.get("approve")) approveLogin(q.get("approve"));
  if (q.get("chat") || q.get("approve")) history.replaceState(null, "", location.pathname);
  // the owner's time zone, for the weekly report
  call({ op:"cfg.get" }).then(function (r) { S.cfg = r; var tz = new Date().getTimezoneOffset(); if (r.cfg.tz !== tz) call({ op:"cfg.set", patch:{ tz:tz } }).catch(function () {}); checkAch(); }).catch(function () {});
  setInterval(function () { if (!document.hidden && code) { if (!tk) loadTickets().catch(function () {}); } }, 60000);
}
function show(name) {
  document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
  document.querySelectorAll("section[data-pane]").forEach(function (s) { s.classList.toggle("hide", s.dataset.pane !== name); });
  if (location.hash.slice(1) !== name) history.replaceState(null, "", location.pathname + location.search + "#" + name);
  var p = $("pane-" + name);
  if (!built[name]) { built[name] = true; PANES[name](p); } else if (REFRESH[name]) REFRESH[name](p);
}
async function approveLogin(id) {
  try {
    var r = await call({ op:"2fa.peek", ch:id });
    var m = E("div", "modal"), b = E("div");
    add(b, E("h3", "", "🔐 Approve this login?"), E("p", "", "Someone with your owner code wants to open your dashboard on " + r.ua + ", " + ago(r.at) + "."),
      rowOf(btn("Yes, it's me", async function () { await call({ op:"2fa.approve", ch:id }); m.remove(); toast("Approved. It opens on that device now."); }),
        btn("No, block it", async function () { await call({ op:"2fa.approve", ch:id, no:true }); m.remove(); toast("Refused. Change your owner code if you didn't expect this."); }, "danger")));
    m.appendChild(b); document.body.appendChild(m);
  } catch (e) { toast(e.message); }
}

/* ---------------------------------------------------------------- Overview */
var PANES = {}, REFRESH = {};
PANES.overview = function (p) {
  p.innerHTML = '<div class="chips" id="chips"></div><div class="tiles"><div class="card tile"><b id="tq">0</b><span>questions today</span></div><div class="card tile"><b id="td">0</b><span>devices and people asking today</span></div>' +
    '<div class="card tile"><b id="tc">$0</b><span>cost today (about)</span></div><div class="card tile"><b id="tm">$0</b><span>last 14 days (about)</span></div></div>';
  var now = card(p, "Right now"); now.id = "now";
  add(now, E("div", "tiles", null));
  now.lastChild.innerHTML = '<div class="card tile"><b id="a1">–</b><span>using Webs in the last hour</span></div><div class="card tile"><b id="a24">–</b><span>in the last 24 hours</span></div><div class="card tile"><b id="a7">–</b><span>in the last 7 days</span></div><div class="card tile"><b id="aall">–</b><span>devices in all</span></div>';
  var g2 = E("div", "grid2"), c1 = E("div"), c2 = E("div");
  add(c1, E("h3", "", "Where people are"), E("div", "bars")); c1.lastChild.id = "countries";
  add(c2, E("h3", "", "Versions in use"), E("div", "bars")); c2.lastChild.id = "versions";
  add(g2, c1, c2); now.appendChild(g2);
  var nr = E("p", "d small"); nr.id = "aggat"; now.appendChild(rowOf(nr, E("span", "sp"), btn("Count again now", async function (b) { await act(b, async function () { var r = await call({ op:"live.agg" }); S.agg = r.agg; paintAgg(); }, "Counted."); }, "ghost small")));
  now.appendChild(E("p", "d small", "Counted from the apps' anonymous check-ins (version and country, about once an hour; people can turn them off). Never what anyone browses."));
  var d14 = card(p, "The last 14 days"); var b = E("div", "bars"); b.id = "bars"; d14.appendChild(b); var lim = E("p", "d small"); lim.id = "lim"; d14.appendChild(lim);
  var hc = card(p, "Health", "Checks the Claude API key, storage, alerts, notifications and the sites the server watches.");
  var hl = E("div", "list"); hl.id = "health"; hc.appendChild(hl);
  hc.appendChild(rowOf(btn("Run the checks", runHealth, "ghost")));
  REFRESH.overview(p);
};
REFRESH.overview = async function () {
  try {
    var s = await call({ op:"stats" }); S.stats = s;
    var t = s.days[s.days.length - 1];
    $("tq").textContent = t.questions; $("td").textContent = s.today.devices + s.today.people; $("tc").textContent = money(t.cost); $("tm").textContent = money(s.days.reduce(function (n, d) { return n + d.cost; }, 0));
    bars($("bars"), s.days.slice().reverse().map(function (d) { return [d.day.slice(5), d.questions, d.cost]; }), function (x) { return x[1] + " · " + money(x[2]); });
    $("lim").textContent = "Model " + s.model + ". " + (s.open ? "Open to everyone: " : "With codes: ") + s.limits.perDevice + " questions a day each, " + s.limits.total + " in total. Costs are estimates from the token counts; the Claude Console has the real bill.";
    var ch = $("chips"); ch.innerHTML = "";
    if (s.paused) ch.appendChild(E("span", "chip bad", "⏸ Web AI is paused"));
    if (s.maint) ch.appendChild(E("span", "chip bad", "🛠 Maintenance mode"));
    if (s.cap) ch.appendChild(E("span", "chip", "💸 Spending limit " + money(s.cap) + " a day"));
    if (!s.paused && !s.maint) ch.appendChild(E("span", "chip good", "✓ Web AI is on"));
    checkAch();
  } catch (e) { toast(e.message); }
  try {
    var l = await call({ op:"live.get" }); S.live = l.live; S.agg = l.agg; S.fx = l.fx; S.reacts = l.reacts; S.events = l.events; S.week = l.week;
    if (!S.agg.at || Date.now() - S.agg.at > 3 * 3600000) S.agg = (await call({ op:"live.agg" })).agg;      // not counted lately: count now
    paintAgg(); checkAch();
  } catch (e) {}
};
function paintAgg() {
  var a = S.agg || {};
  if (!$("a1")) return;
  $("a1").textContent = a.active1 != null ? a.active1 : "–"; $("a24").textContent = a.active24 != null ? a.active24 : "–"; $("a7").textContent = a.active7 != null ? a.active7 : "–"; $("aall").textContent = a.devices != null ? a.devices : "–";
  bars($("countries"), Object.entries(a.countries || {}).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 12).map(function (x) { return [flag(x[0]) + " " + (new Intl.DisplayNames(["en"], { type:"region" }).of(x[0]) || x[0]), x[1]]; }));
  bars($("versions"), Object.entries(a.vers || {}).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 10));
  $("aggat").textContent = a.at ? "Counted " + ago(a.at) + " (every hour)." : "Not counted yet: it happens every hour.";
}
async function runHealth(b) {
  await act(b, async function () {
    var r = await call({ op:"health" }), l = $("health"); l.innerHTML = "";
    r.checks.forEach(function (c) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", (c.ok ? "✅ " : "⚠️ ") + c.name), E("span", "", c.say)); add(it, tx); l.appendChild(it); });
    l.appendChild(E("p", "d small", "Server version " + r.server + "."));
  });
}

/* ---------------------------------------------------------------- Support: the chats, saved replies, away message, help articles, problem reports */
var tk = null, tkT = 0, waiting = {};
PANES.support = function (p) {
  p.innerHTML = '<h2>Help &amp; support <span id="sn" class="pill"></span> <span id="srate" class="pill"></span></h2>' +
    '<div class="card sup"><div id="slist"><p class="d" style="margin:0">No support chats yet. People start one from Help &amp; support in the app.</p></div>' +
    '<div id="sview" class="hide"><div class="tkh"><button class="ghost small" id="sback">← All chats</button><b id="stitle"></b><span id="ssub"></span><span class="sp"></span><button class="ghost small" id="sblock">Block device</button><button class="ghost small" id="sclose">Close this chat</button></div>' +
    '<div class="tk"><div><div class="chat" id="schat"></div><div class="row" style="margin-top:6px"><select id="sreplies" style="width:auto;max-width:100%"><option value="">Saved replies…</option></select></div><div class="reply"><textarea id="sreply" maxlength="1000" placeholder="Write a reply…"></textarea><button id="ssend">Send</button></div></div>' +
    '<div><div class="dev" id="sdev"><div class="devbar"><i></i><i></i><i></i><span id="sdevname"></span></div><div class="acc" id="sacc"></div><div class="sets" id="ssets"></div></div>' +
    '<p class="d small" style="margin:8px 2px 0">Only these settings, and only while they allow it. You never see their history, bookmarks, passwords or pages. Each change shows on their screen with Undo.</p></div></div></div></div>';
  $("sback").onclick = closeView;
  $("sclose").onclick = async function () { if (!confirm("Close this chat? They'll see it has ended, and nothing more can be changed.")) return; await call({ op:"closeTicket", id:tk.id }); await refreshTicket(); };
  $("sblock").onclick = async function () { var on = !tk.blocked; if (on && !confirm("Block this device? It can't use Web AI or Help & support any more, and this chat closes.")) return; try { await call({ op:"blockTicket", id:tk.id, on:on }); toast(on ? "Blocked." : "Unblocked."); await refreshTicket(); } catch (e) { toast(e.message); } };
  $("ssend").onclick = async function () {
    var text = $("sreply").value.trim(); if (!text) return;
    $("ssend").disabled = true;
    try { await call({ op:"reply", id:tk.id, text:text }); $("sreply").value = ""; await refreshTicket(); } catch (e) { toast(e.message); }
    $("ssend").disabled = false;
  };
  $("sreply").onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("ssend").click(); } };
  $("sreplies").onchange = function () { var v = $("sreplies").value; if (v) { $("sreply").value = ($("sreply").value ? $("sreply").value + " " : "") + v; $("sreply").focus(); } $("sreplies").value = ""; };
  // the owner's support settings
  var sc = card(p, "How you answer");
  var away = sw("Away message", false, "Sent by itself when someone writes (once every 12 hours in a chat)"), awayT = inp("", "", { area:1, maxlength:500, placeholder:"Hi! I'm away until Monday. I'll answer then." });
  var keep = sel("Delete finished chats after", 30, [["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]);
  var reps = inp("Saved replies (one per line)", "", { area:1, rows:5, placeholder:"Can you turn on the switch so I can check your settings?\nTry closing Webs and opening it again." });
  add(sc, away, awayT, keep, reps, rowOf(btn("Save", async function (b) {
    await act(b, async function () {
      var r = await call({ op:"cfg.set", patch:{ away:{ on:away.input.checked, text:awayT.input.value }, keep:+keep.input.value, replies:reps.input.value.split("\n") } });
      S.cfg.cfg = r.cfg; fillReplies();
    }, "Saved.");
  })));
  var fq = card(p, "Help articles", "Answers to common questions. They show in Help & support in both apps, before people write to you.");
  var fl = E("div"); fq.appendChild(fl);
  var faqAdd = function (q, a) { var w = E("div", "card"); w.style.background = "var(--bg3)"; var qi = inp("Question", q, { maxlength:200 }), ai = inp("Answer", a, { area:1, maxlength:2000 }); add(w, qi, ai, rowOf(E("span", "sp"), btn("Remove", function () { w.remove(); }, "danger small"))); w.q = qi.input; w.a = ai.input; fl.appendChild(w); };
  add(fq, rowOf(btn("Add a question", function () { faqAdd("", ""); }, "ghost"), btn("Save help articles", async function (b) {
    var faq = [].map.call(fl.children, function (w) { return { q:w.q.value, a:w.a.value }; });
    await act(b, function () { return saveLive({ faq:faq }); }, "Help articles saved.");
  })));
  var rc = E("div"); rc.id = "reports"; p.appendChild(rc);
  REFRESH.support(p, function () {
    var c = S.cfg && S.cfg.cfg; if (c) { away.input.checked = c.away.on; awayT.input.value = c.away.text; keep.input.value = String(c.keep); reps.input.value = (c.replies || []).join("\n"); fillReplies(); }
    fl.innerHTML = ""; (S.live.faq || []).forEach(function (x) { faqAdd(x.q, x.a); });
  });
};
REFRESH.support = async function (p, then) {
  try { if (!S.cfg) S.cfg = await call({ op:"cfg.get" }); if (!S.live || !S.live.rev) { var l = await call({ op:"live.get" }); S.live = l.live; S.agg = l.agg; } } catch (e) {}
  if (then) then();
  loadTickets().catch(function () {});
  loadReports().catch(function () {});
};
function fillReplies() { var s = $("sreplies"); if (!s || !S.cfg) return; s.length = 1; (S.cfg.cfg.replies || []).forEach(function (r) { var o = E("option", "", r.length > 70 ? r.slice(0, 70) + "…" : r); o.value = r; s.appendChild(o); }); }
async function loadTickets() {
  if (!$("slist")) return;
  var r = await call({ op:"tickets" }), box = $("slist");
  var open = r.items.filter(function (x) { return x.open && !x.closed; });
  $("sn").textContent = open.length ? open.length + " open" : ""; $("sn").className = "pill" + (open.length ? " on" : "");
  var up = r.items.filter(function (x) { return x.rate === 1; }).length, down = r.items.filter(function (x) { return x.rate === -1; }).length;
  $("srate").textContent = up + down ? "👍 " + up + " · 👎 " + down : ""; $("srate").className = up + down ? "pill" : "hide";
  var tb = document.querySelector('#tabs [data-tab="support"]'); if (tb) tb.innerHTML = "Support" + (open.length ? '<span class="n">' + open.length + "</span>" : "");
  if (!r.items.length) return;
  box.innerHTML = "";
  r.items.forEach(function (x) {
    var row = E("div", "row2"), ic = E("span", "ic"), tx = E("div", "tx"), b = E("b"), sp = E("span"), pl = E("span", "pill");
    ic.textContent = x.platform === "iphone" ? "📱" : "💻";
    b.textContent = (x.platform === "iphone" ? "iPhone " : "Windows ") + (x.version || "") + " · " + ago(x.updated || x.created) + (x.rate === 1 ? " · 👍" : x.rate === -1 ? " · 👎" : "");
    sp.textContent = x.last || "";
    var acc = x.open && !x.closed && x.access > Date.now();
    pl.textContent = !x.open || x.closed ? "ended" : acc ? "settings access · " + mins(x.access) + " min" : "open";
    pl.className = "pill" + (acc ? " on" : x.open && !x.closed ? "" : " off");
    add(tx, b, sp); add(row, ic, tx, pl);
    row.onclick = function () { openTicket(x.id); };
    box.appendChild(row);
  });
}
var mins = function (until) { return Math.max(1, Math.round((until - Date.now()) / 60000)); };
async function openTicket(id) {
  if (!$("sview")) { show("support"); await new Promise(function (r) { setTimeout(r, 200); }); }
  $("slist").classList.add("hide"); $("sview").classList.remove("hide");
  tk = { id:id }; waiting = {};
  await refreshTicket();
  clearInterval(tkT); tkT = setInterval(function () { if (!document.hidden && tk) refreshTicket().catch(function () {}); }, 4000);
}
function closeView() { tk = null; clearInterval(tkT); $("sview").classList.add("hide"); $("slist").classList.remove("hide"); loadTickets().catch(function () {}); }
async function refreshTicket() {
  var t = await call({ op:"ticket", id:tk.id });
  if (!tk || tk.id !== t.id) return;
  tk = t;
  var phone = t.platform === "iphone";
  $("stitle").textContent = (phone ? "📱 iPhone " : "💻 Windows ") + (t.version || "");
  $("ssub").textContent = "started " + ago(t.created) + (t.open ? "" : " · ended") + (t.rate === 1 ? " · they said 👍" : t.rate === -1 ? " · they said 👎" : "");
  $("sclose").classList.toggle("hide", !t.open);
  $("sblock").textContent = t.blocked ? "Unblock device" : "Block device"; $("sblock").classList.toggle("hide", !t.dev);
  var chat = $("schat"), atEnd = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 20;
  chat.innerHTML = "";
  t.msgs.forEach(function (m) { var d = E("div", "msg " + m.f + (m.auto ? " auto" : "")), i = E("i"); d.textContent = m.t; i.textContent = (m.f === "a" ? (m.auto ? "Away message · " : "You · ") : "Them · ") + ago(m.ts); d.appendChild(i); chat.appendChild(d); });
  if (atEnd) chat.scrollTop = chat.scrollHeight;
  $("ssend").disabled = !t.open; $("sreply").disabled = !t.open;
  $("sdev").className = "dev " + (phone ? "iphone" : "windows");
  $("sdevname").textContent = phone ? "Webs on their iPhone" : "Webs on their PC";
  var live = t.open && t.access > 0;
  $("sacc").className = "acc " + (live ? "on" : "off");
  $("sacc").textContent = !t.open ? "This chat has ended. Nothing can be changed." : live ? "✓ They let support adjust their settings · " + mins(t.access) + " min left" : "They haven't let support adjust their settings. Ask them to turn on the switch in Help & support.";
  var sets = $("ssets"), y = sets.scrollTop;
  sets.className = "sets" + (live ? "" : " locked");
  sets.innerHTML = "";
  var pend = {}; t.changes.forEach(function (c) { if (!c.done) pend[c.k] = c; });
  t.schema.forEach(function (g) {
    sets.appendChild(E("h4", "", g[0]));
    g[1].forEach(function (e) {
      var row = E("div", "set"), l = E("span", "l", e.label), w = E("span", "w");
      var cur = t.settings[e.k];
      if (pend[e.k]) w.textContent = "waiting for their device…";
      else if (waiting[e.k] && t.changes.some(function (c) { return c.k === e.k && c.done; })) { w.textContent = "✓ changed"; w.className = "w d"; }
      var c;
      if (e.t === "bool") { c = E("button", "tg" + (cur ? " on" : "")); c.setAttribute("aria-pressed", cur ? "true" : "false"); c.title = cur === undefined ? "Unknown" : cur ? "On" : "Off"; c.onclick = function () { change(e.k, !cur); }; }
      else if (e.t === "choice") { c = E("select"); e.o.forEach(function (o) { var x = E("option", "", o[1]); x.value = o[0]; c.appendChild(x); }); c.value = cur === undefined ? "" : String(cur); c.onchange = function () { change(e.k, c.value); }; }
      else { c = E("button", "act", e.label); l.textContent = ""; c.onclick = function () { if (confirm(e.label + "?")) change(e.k, true); }; }
      add(row, l, w, c); sets.appendChild(row);
    });
  });
  sets.scrollTop = y;
}
async function change(k, v) { try { await call({ op:"set", id:tk.id, k:k, v:v }); waiting[k] = true; await refreshTicket(); } catch (e) { toast(e.message); } }
window.loadTickets = loadTickets; window.openTicket = openTicket;
async function loadReports() {
  var box = $("reports"); if (!box) return;
  var r = await call({ op:"reports" });
  box.innerHTML = ""; box.appendChild(E("h2", "", "Problem reports (" + r.items.length + ")"));
  if (!r.items.length) box.appendChild(E("p", "d", "No reports. 🎉"));
  r.items.forEach(function (x) {
    var c = E("div", "card rep"), m = E("div", "meta"), t = E("pre"), d = E("pre");
    c.appendChild(E("h3", "", (x.fixed ? "✅ " : "") + x.text.split("\n")[0].slice(0, 120)));
    m.textContent = new Date(x.ts).toLocaleString() + " · " + x.app + " " + x.version + " · " + x.who;
    t.textContent = x.text; d.textContent = JSON.stringify(x.info, null, 2) + (x.errors && x.errors.length ? "\n\nErrors:\n" + x.errors.join("\n") : "");
    add(c, m, t, d);
    if (x.reply) c.appendChild(E("div", "ans", "You replied: " + x.reply.t));
    var ri = E("textarea"); ri.placeholder = x.canReply ? "Reply (it shows in their app)…" : "This report came from an older version: it can't get a reply."; ri.disabled = !x.canReply; ri.style.marginTop = "8px";
    var rr = rowOf(btn("Reply", async function (b) { await act(b, async function () { await call({ op:"report.reply", id:x.id, text:ri.value }); loadReports(); }, "Sent."); }, "small"),
      btn(x.fixed ? "Mark not fixed" : "Mark fixed", async function (b) { await act(b, async function () { await call({ op:"report.fix", id:x.id, on:!x.fixed }); loadReports(); }); }, "ghost small"),
      E("span", "sp"),
      btn("Delete", async function (b) { await act(b, async function () { await call({ op:"delete", id:x.id }); loadReports(); }); }, "danger small"));
    if (!x.canReply) rr.firstChild.disabled = true;
    add(c, ri, rr); box.appendChild(c);
  });
}

/* ---------------------------------------------------------------- Start page: everything on everyone's start page */
async function saveLive(part) { var r = await call({ op:"live.set", live:part }); S.live = r.live; return r; }
function resultsBars(box, list) { var w = E("div", "res bars"); box.appendChild(w); bars(w, list); return w; }
function untilField(label, ts) { return inp(label || "Until (optional)", tsDate(ts), { type:"date" }); }
PANES.live = async function (p) {
  if (!S.live || !S.live.rev) { try { var l = await call({ op:"live.get" }); S.live = l.live; S.agg = l.agg; S.fx = l.fx; S.reacts = l.reacts; S.events = l.events; S.week = l.week; } catch (e) { toast(e.message); } }
  p.innerHTML = "";
  p.appendChild(E("p", "d", "Everything here shows on the start page of Webs on every iPhone and PC (within a few minutes). Each part has its own Save."));
  var L = S.live, A = S.agg || {};
  // the announcement
  var an = fold(p, "📣 Announcement banner", "A banner at the top of everyone's start page. People can react with emoji and close it.", !!L.ann);
  var at = inp("Message", L.ann && L.ann.text, { maxlength:300, placeholder:"Maintenance tonight from 10 to 11 pm" }), al = inp("Link (optional)", L.ann && L.ann.link, { placeholder:"https://…" }), au = untilField("Show until (optional)", L.ann && L.ann.until), ar = sw("Emoji reactions", !L.ann || L.ann.react !== false);
  add(an, at, al, au, ar, rowOf(btn("Save banner", async function (b) {
    var same = L.ann && L.ann.text === at.input.value.trim();
    await act(b, function () { return saveLive({ ann:{ id:same ? L.ann.id : "", text:at.input.value, link:al.input.value, until:dateTs(au.input.value, true), react:ar.input.checked } }); }, "Banner is on.");
    built.live = false; show("live");
  }), L.ann ? btn("Remove", async function (b) { await act(b, function () { return saveLive({ ann:null }); }, "Removed."); built.live = false; show("live"); }, "danger") : null));
  if (L.ann && A.react && A.react.id === L.ann.id) resultsBars(an, (S.reacts || []).map(function (e) { return [e, A.react.counts[e] || 0]; }));
  // the calling card
  var cc = fold(p, "🎭 Calling card", "A full-screen Persona 5-style card everyone sees once, the next time they open a new tab.", !!L.card);
  var ct = inp("Title", L.card && L.card.title, { maxlength:80, placeholder:"TAKE YOUR TIME!" }), cx = inp("Message", L.card && L.card.text, { area:1, maxlength:400, placeholder:"We will steal your boredom this Friday: a new update is coming." }), cs = inp("Signed", L.card ? L.card.sign : "The Phantom Thieves", { maxlength:60 });
  var prev = E("div", "prev");
  var paintCard = function () { prev.innerHTML = ""; var c = E("div", "cc"); add(c, E("b", "", ct.input.value || "TAKE YOUR TIME!"), E("p", "", cx.input.value || "Your message here."), E("i", "", "— " + (cs.input.value || "The Phantom Thieves"))); prev.appendChild(c); };
  [ct, cx, cs].forEach(function (f) { f.input.oninput = paintCard; }); paintCard();
  add(cc, ct, cx, cs, prev, rowOf(btn(L.card ? "Send it again (everyone sees it again)" : "Send the card", async function (b) {
    if (!confirm("Show this card to everyone?")) return;
    await act(b, function () { return saveLive({ card:{ title:ct.input.value, text:cx.input.value, sign:cs.input.value, until:Date.now() + 7 * 86400000 } }); }, "Sent. Everyone sees it on their next new tab.");
  }), L.card ? btn("Stop showing it", async function (b) { await act(b, function () { return saveLive({ card:null }); }, "Stopped."); built.live = false; show("live"); }, "danger") : null));
  // the poll
  var po = fold(p, "📊 Poll", "A question on everyone's start page. One vote per device.", !!L.poll);
  var pq = inp("Question", L.poll && L.poll.q, { maxlength:200, placeholder:"Which game should we add next?" }), opts = [0, 1, 2, 3].map(function (i) { return inp("Choice " + (i + 1) + (i > 1 ? " (optional)" : ""), L.poll && L.poll.opts[i], { maxlength:60 }); }), pu = untilField("Ends (optional)", L.poll && L.poll.until);
  var g = E("div", "grid2"); opts.forEach(function (o) { g.appendChild(o); });
  add(po, pq, g, pu, rowOf(btn(L.poll ? "Start a new poll" : "Start the poll", async function (b) {
    await act(b, function () { return saveLive({ poll:{ q:pq.input.value, opts:opts.map(function (o) { return o.input.value; }), until:dateTs(pu.input.value, true) } }); }, "The poll is on.");
    built.live = false; show("live");
  }), L.poll ? btn("End the poll", async function (b) { await act(b, function () { return saveLive({ poll:null }); }, "Ended."); built.live = false; show("live"); }, "danger") : null));
  if (L.poll && A.poll && A.poll.id === L.poll.id) { var tot = A.poll.counts.reduce(function (a, b) { return a + b; }, 0); po.appendChild(E("p", "res", tot + " votes so far (counted every hour; press Count again on Overview for now)")); resultsBars(po, L.poll.opts.map(function (o, i) { return [o, A.poll.counts[i] || 0]; })); }
  // 3.10 / 2.9: a limited-time event theme for the anime themes, and a vote on the next theme
  var EVN = { halloween:"🎃 Haunted Night", winter:"❄️ Snowfall Shrine", newyear:"🎆 Midnight Fireworks", hearts:"💗 Sakura Hearts" };
  var et = fold(p, "🎃 Event theme", "A limited-time anime theme in everyone's picker (Windows 3.10, iPhone 2.9). Whoever picks it keeps it after it ends.", !!L.event);
  var es = sel("Theme", L.event ? L.event.id : "halloween", (S.events || Object.keys(EVN)).map(function (k) { return [k, EVN[k] || k]; })), eu = untilField("Ends (optional)", L.event && L.event.until);
  add(et, es, eu, rowOf(btn(L.event ? "Save" : "Start the event", async function (b) { await act(b, function () { return saveLive({ event:{ id:es.input.value, until:dateTs(eu.input.value, true) } }); }, "The event theme is on."); built.live = false; show("live"); }),
    L.event ? btn("End it", async function (b) { await act(b, function () { return saveLive({ event:null }); }, "Ended."); built.live = false; show("live"); }, "danger") : null));
  var tv = fold(p, "🗳 Vote on the next theme", "Up to four ideas for the next anime theme, as tiles on everyone's start page. One vote per device.", !!L.tvote);
  var tq = inp("Question", L.tvote ? L.tvote.q : "Which theme should Webs add next?", { maxlength:120 });
  var tos = [0, 1, 2, 3].map(function (i) { var o = L.tvote && L.tvote.opts[i] || {}; return [inp("Idea " + (i + 1) + (i > 1 ? " (optional)" : ""), o.n, { maxlength:40, placeholder:["Ninja Village at Night", "Pirate Storm", "Neon City", "Spirit Forest"][i] }), inp("Emoji", o.e, { maxlength:8, placeholder:"🥷" }), inp("A few words", o.d, { maxlength:120 })]; });
  var tg = E("div", "grid2"); tos.forEach(function (r) { var c = E("div"); add(c, r[0], r[1], r[2]); tg.appendChild(c); });
  var tu = untilField("Ends (optional)", L.tvote && L.tvote.until);
  add(tv, tq, tg, tu, rowOf(btn(L.tvote ? "Save (keeps the votes)" : "Start the vote", async function (b) {
    await act(b, function () { return saveLive({ tvote:{ id:L.tvote ? L.tvote.id : "", q:tq.input.value, opts:tos.map(function (r) { return { n:r[0].input.value, e:r[1].input.value, d:r[2].input.value }; }), until:dateTs(tu.input.value, true) } }); }, "The vote is on.");
    built.live = false; show("live");
  }), L.tvote ? btn("End the vote", async function (b) { await act(b, function () { return saveLive({ tvote:null }); }, "Ended."); built.live = false; show("live"); }, "danger") : null));
  if (L.tvote && A.tvote && A.tvote.id === L.tvote.id) resultsBars(tv, L.tvote.opts.map(function (o, i) { return [o.e + " " + o.n, A.tvote.counts[i] || 0]; }));
  // the countdown and the owner's pick
  var g2 = E("div", "grid2"); p.appendChild(g2);
  var cd = fold(g2, "⏳ Countdown", "Days until something, on everyone's start page.", !!L.countdown);
  var cl = inp("Counting down to", L.countdown && L.countdown.label, { maxlength:60, placeholder:"Christmas" }), cdd = inp("Date", L.countdown && L.countdown.date, { type:"date" }), ce = inp("Emoji", L.countdown ? L.countdown.emoji : "🎄", { maxlength:8 });
  add(cd, cl, cdd, ce, rowOf(btn("Save", async function (b) { await act(b, function () { return saveLive({ countdown:{ label:cl.input.value, date:cdd.input.value, emoji:ce.input.value } }); }, "Countdown is on."); }), L.countdown ? btn("Remove", async function (b) { await act(b, function () { return saveLive({ countdown:null }); }, "Removed."); built.live = false; show("live"); }, "danger") : null));
  var pk = fold(g2, "⭐ Owner's pick", "A website you recommend, on everyone's start page.", !!L.pick);
  var pu2 = inp("Address", L.pick && L.pick.url, { placeholder:"https://…" }), pt = inp("Name", L.pick && L.pick.title, { maxlength:80 }), pn = inp("Why it's cool", L.pick && L.pick.note, { maxlength:200 }), pun = untilField("Until (optional)", L.pick && L.pick.until);
  add(pk, pu2, pt, pn, pun, rowOf(btn("Save", async function (b) { await act(b, function () { return saveLive({ pick:{ url:pu2.input.value, title:pt.input.value, note:pn.input.value, until:dateTs(pun.input.value, true) } }); }, "Saved."); }), L.pick ? btn("Remove", async function (b) { await act(b, function () { return saveLive({ pick:null }); }, "Removed."); built.live = false; show("live"); }, "danger") : null));
  // things by date
  schedule(p, "💬 Quote of the day", "Your own quote on a day you pick (it replaces the built-in one).", "quotes", [["text", "Quote", 300], ["by", "Who said it", 80]]);
  schedule(p, "❓ Daily trivia", "A question on the start page; people see if they got it right.", "trivia", [["q", "Question", 200], ["o0", "Answer 1", 80], ["o1", "Answer 2", 80], ["o2", "Answer 3 (optional)", 80], ["o3", "Answer 4 (optional)", 80], ["a", "Right answer", "sel4"]],
    function (x) { var r = (A.trivia || {})[x.date]; return r ? r.n + " answered, " + Math.round(r.right / Math.max(1, r.n) * 100) + "% right" : ""; });
  schedule(p, "🎁 Mystery box", "A surprise people open on the start page: a joke, a tip, a fact or a little challenge. Days without one get a built-in surprise.", "mystery", [["kind", "Kind", "kind"], ["text", "What's inside", 300]]);
  schedule(p, "🎉 Theme day", "Effects on everyone's start page for a day.", "themes", [["kind", "Theme", "fx"]]);
  schedule(p, "🧩 Word of the day", "Pick the daily word puzzle's answer (5 letters) for a day.", "words", [["w", "Word", 5]]);
  // Webs's birthday
  var bd = fold(p, "🎂 Webs's birthday", "Confetti and a birthday card on everyone's start page that day, every year.", !!L.birthday);
  var bdd = inp("Birthday (month and day)", L.birthday ? "2000-" + L.birthday.date : "", { type:"date" }), bys = inp("First year", L.birthday && L.birthday.since || "", { type:"number", min:2000, max:2100, placeholder:"2026" });
  add(bd, E("div", "grid2"), rowOf(btn("Save", async function (b) { var v = bdd.input.value; await act(b, function () { return saveLive({ birthday:v ? { date:v.slice(5), since:+bys.input.value || 0 } : null }); }, "Saved."); })));
  add(bd.children[2], bdd, bys);
  // the community goal
  var go = fold(p, "🏁 Community goal", "Everyone works together, like 10,000 Snake games this week, with a progress bar on the start page and in Games. Progress is counted every hour.", !!L.goal);
  var gl = inp("Goal", L.goal && L.goal.label, { maxlength:120, placeholder:"Play 10,000 games of Snake together" }), gg = sel("Game", L.goal ? L.goal.game : "snake", [["snake", "Snake"], ["2048", "2048"], ["any", "Any game"]]), gt = inp("Target (games)", L.goal ? L.goal.target : 10000, { type:"number", min:1 }), gu = untilField("Ends", L.goal && L.goal.until), gr = inp("Reward", L.goal && L.goal.reward, { maxlength:120, placeholder:"A special achievement and confetti for everyone" });
  var gw = E("div", "grid2"); add(gw, gg, gt, gu, gr);
  add(go, gl, gw, rowOf(btn(L.goal ? "Save" : "Start the goal", async function (b) { await act(b, function () { return saveLive({ goal:{ id:L.goal && L.goal.label === gl.input.value ? L.goal.id : "", label:gl.input.value, game:gg.input.value, target:+gt.input.value, until:dateTs(gu.input.value, true), reward:gr.input.value } }); }, "Saved."); built.live = false; show("live"); }),
    L.goal ? btn("End it", async function (b) { await act(b, function () { return saveLive({ goal:null }); }, "Ended."); built.live = false; show("live"); }, "danger") : null));
  if (L.goal) { var gn = A.goal && A.goal.id === L.goal.id ? A.goal.n : 0; resultsBars(go, [["Done so far", gn], ["Target", L.goal.target]]); }
  // the leaderboard
  var lb = fold(p, "🏆 Weekly leaderboard", "Snake and 2048, for people who chose a nickname in Games. It starts again every Monday.", (A.nicks || []).length > 0);
  var nk = A.nicks || [];
  if (!nk.length) lb.appendChild(E("p", "d small", "No scores yet this week."));
  var ll = E("div", "list"); lb.appendChild(ll);
  nk.forEach(function (x) {
    var it = E("div", "it"), tx = E("div", "tx");
    add(tx, E("b", "", (x.hidden ? "🚫 " : "") + x.n), E("span", "", "Snake " + x.snake + " · 2048 " + x["2048"]));
    add(it, tx, btn(x.hidden ? "Show" : "Hide", async function (b) {
      var hid = (S.cfg && S.cfg.cfg.hideNick || []).filter(function (d) { return d !== x.dev; }).concat(x.hidden ? [] : [x.dev]);
      await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ hideNick:hid } }); S.cfg.cfg = r.cfg; var a = await call({ op:"live.agg" }); S.agg = a.agg; }, x.hidden ? "Shown." : "Hidden from the leaderboard.");
      built.live = false; show("live");
    }, "ghost small"));
    ll.appendChild(it);
  });
  var b0 = A.board || {};
  if ((b0.snake || []).length || (b0["2048"] || []).length) lb.appendChild(rowOf(
    (b0.snake || [])[0] ? btn("Feature the Snake winner", function (b) { featureWinner(b, "Snake", b0.snake[0]); }, "ghost small") : null,
    (b0["2048"] || [])[0] ? btn("Feature the 2048 winner", function (b) { featureWinner(b, "2048", b0["2048"][0]); }, "ghost small") : null));
  // the secret code hunt
  var hu = fold(p, "🔍 Secret code hunt", "Hide a code (in a notification, on your website, anywhere). Whoever types it in Webs's address bar unlocks a special achievement.", !!L.hunt);
  var hc = inp("The code", "", { maxlength:40, placeholder:L.hunt ? "•••••• (saved; type a new one to change it)" : "PHANTOM2026" }), hh = inp("Hint on the start page", L.hunt && L.hunt.hint, { maxlength:200, placeholder:"It's hidden in this week's notification…" }), hun = untilField("Ends (optional)", L.hunt && L.hunt.until);
  add(hu, hc, hh, hun, rowOf(btn(L.hunt ? "Save" : "Start the hunt", async function (b) {
    if (!L.hunt && !hc.input.value.trim()) return toast("Pick a code first.");
    await act(b, function () { return saveLive({ hunt:hc.input.value.trim() ? { code:hc.input.value, hint:hh.input.value, until:dateTs(hun.input.value, true) } : { id:L.hunt.id, h:L.hunt.h, hint:hh.input.value, until:dateTs(hun.input.value, true) } }); }, "Saved.");
    built.live = false; show("live");
  }), L.hunt ? btn("End the hunt", async function (b) { await act(b, function () { return saveLive({ hunt:null }); }, "Ended."); built.live = false; show("live"); }, "danger") : null));
  if (L.hunt) hu.appendChild(E("p", "res", ((A.hunt && A.hunt.id === L.hunt.id) ? A.hunt.n : 0) + " people found it so far."));
  // secret words
  var sw2 = fold(p, "🤫 Secret words", "Typing one of these in the address bar sets off an effect instead of searching. Only a fingerprint of each word is kept, so nobody can read them.", (L.secrets || []).length > 0);
  var sl = E("div", "list"); sw2.appendChild(sl);
  (L.secrets || []).forEach(function (x, i) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", "•••••• → " + x.fx), x.hint ? E("span", "", x.hint) : null); add(it, tx, btn("Remove", async function (b) { var l = L.secrets.slice(); l.splice(i, 1); await act(b, function () { return saveLive({ secrets:l }); }, "Removed."); built.live = false; show("live"); }, "danger small")); sl.appendChild(it); });
  var swd = inp("New secret word", "", { maxlength:40, placeholder:"joker" }), swf = sel("Effect", "confetti", (S.fx || []).map(function (f) { return [f, f]; })), swh = inp("Note for you (optional)", "", { maxlength:60 });
  var swg = E("div", "grid3"); add(swg, swd, swf, swh);
  add(sw2, swg, rowOf(btn("Add", async function (b) { if (!swd.input.value.trim()) return; var l = (L.secrets || []).concat([{ word:swd.input.value, fx:swf.input.value, hint:swh.input.value }]); await act(b, function () { return saveLive({ secrets:l }); }, "Added."); built.live = false; show("live"); })));
  // limited-time achievements
  var ac = fold(p, "🏅 Limited-time achievements", "An achievement people unlock by opening Webs while it's on, like Visited on Halloween.", (L.ach || []).length > 0);
  var acl = E("div", "list"); ac.appendChild(acl);
  (L.ach || []).forEach(function (x, i) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", x.emoji + " " + x.name), E("span", "", x.desc + " · " + (x.from ? tsDate(x.from) : "now") + " → " + (x.until ? tsDate(x.until) : "no end") + " · " + ((A.ach || {})[x.id] || 0) + " unlocked"));
    add(it, tx, btn("Remove", async function (b) { var l = L.ach.slice(); l.splice(i, 1); await act(b, function () { return saveLive({ ach:l }); }, "Removed."); built.live = false; show("live"); }, "danger small")); acl.appendChild(it); });
  var ae = inp("Emoji", "🎃", { maxlength:8 }), an2 = inp("Name", "", { maxlength:40, placeholder:"Visited on Halloween" }), ad = inp("How", "", { maxlength:120, placeholder:"Open Webs on October 31" }), af = inp("From", today(), { type:"date" }), aun = inp("Until", today(1), { type:"date" });
  var ag = E("div", "grid3"); add(ag, ae, an2, ad, af, aun);
  add(ac, ag, rowOf(btn("Add", async function (b) { if (!an2.input.value.trim()) return toast("Give it a name."); var l = (L.ach || []).concat([{ emoji:ae.input.value, name:an2.input.value, desc:ad.input.value, from:dateTs(af.input.value), until:dateTs(aun.input.value, true) }]); await act(b, function () { return saveLive({ ach:l }); }, "Added."); built.live = false; show("live"); })));
  // the wallpaper of the week
  var wp = fold(p, "🖼 Wallpaper of the week", "A picture people can use as their start page background (they choose to).", !!L.wall);
  if (L.wall) { var im = E("img"); im.src = "live/img/" + L.wall.id; im.style.cssText = "max-width:100%;max-height:220px;border-radius:10px;display:block;margin-bottom:8px"; wp.appendChild(im); }
  var wf = E("input"); wf.type = "file"; wf.accept = "image/*"; var wc = inp("Credit (optional)", L.wall && L.wall.credit, { maxlength:100, placeholder:"Photo: you" }), wu = untilField("Until (optional)", L.wall && L.wall.until);
  add(wp, wf, wc, wu, rowOf(btn("Save", async function (b) {
    await act(b, async function () {
      var id = L.wall && L.wall.id;
      if (wf.files[0]) id = (await call({ op:"img.put", kind:"wall", data:await shrink(wf.files[0], 1920, "image/jpeg") })).id;
      if (!id) throw new Error("Pick a picture first.");
      await saveLive({ wall:{ id:id, credit:wc.input.value, until:dateTs(wu.input.value, true) } });
    }, "Wallpaper saved."); built.live = false; show("live");
  }), L.wall ? btn("Remove", async function (b) { await act(b, function () { return saveLive({ wall:null }); }, "Removed."); built.live = false; show("live"); }, "danger") : null));
  // sticker packs
  var st = fold(p, "✨ Phantom stickers", "Stickers people can add to their Phantom calendar (PNG with a see-through background works best).", (L.stickers || []).length > 0);
  var sg = E("div", "row"); st.appendChild(sg);
  (L.stickers || []).forEach(function (x, i) { var w = E("div"), im = E("img"); im.src = "live/img/" + x.id; im.style.cssText = "width:72px;height:72px;object-fit:contain;background:var(--bg3);border-radius:10px;display:block"; var rb = btn("✕", async function (b) { var l = L.stickers.slice(); l.splice(i, 1); await act(b, function () { return saveLive({ stickers:l }); }, "Removed."); built.live = false; show("live"); }, "danger small"); add(w, im, rb); sg.appendChild(w); });
  var sf = E("input"); sf.type = "file"; sf.accept = "image/png,image/webp,image/*"; sf.multiple = true;
  add(st, sf, rowOf(btn("Add stickers", async function (b) {
    if (!sf.files.length) return toast("Pick some pictures first.");
    await act(b, async function () {
      var l = (L.stickers || []).slice();
      for (var i = 0; i < sf.files.length && l.length < 24; i++) { var id = (await call({ op:"img.put", kind:"sticker", data:await shrink(sf.files[i], 512, "image/png") })).id; l.push({ id:id, name:sf.files[i].name.replace(/\.\w+$/, "").slice(0, 40) }); }
      await saveLive({ stickers:l });
    }, "Stickers added."); built.live = false; show("live");
  })));
};
REFRESH.live = function () {};
async function featureWinner(b, game, w) {
  await act(b, function () { return saveLive({ ann:{ text:"🏆 This week's " + game + " champion: " + w.n + " with " + w.s + "! Can you beat it? Games → " + game, react:true } }); }, "Announced on everyone's start page.");
  built.live = false; show("live");
}
// a picture made smaller in the browser before it's sent (JPEG for wallpapers, PNG for stickers)
function shrink(file, max, type) {
  return new Promise(function (ok, no) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      var q = .86, d = c.toDataURL(type, q);
      while (type === "image/jpeg" && d.length > 1150000 && q > .4) { q -= .1; d = c.toDataURL(type, q); }
      if (d.length > 1150000) return no(new Error("That picture is too big even made smaller."));
      ok(d);
    };
    img.onerror = function () { no(new Error("That isn't a picture this browser can open.")); };
    img.src = url;
  });
}
// a list of things by date (quotes, trivia, mystery boxes, theme days, words)
function schedule(p, title, note, key, fields, result) {
  var items = (S.live[key] || []).filter(function (x) { return x.date >= today(-1); });
  var c = fold(p, title, note, items.length > 0), l = E("div", "list sched"); c.appendChild(l);
  var show1 = function (x) {
    if (key === "trivia") return x.q + " → " + x.opts[x.a];
    if (key === "mystery") return x.kind + ": " + x.text;
    if (key === "themes") return x.kind;
    if (key === "words") return x.w;
    return "“" + x.text + "”" + (x.by ? " — " + x.by : "");
  };
  if (!items.length) l.appendChild(E("p", "d small", "Nothing planned."));
  items.forEach(function (x) {
    var it = E("div", "it"), w = E("span", "when", x.date), tx = E("div", "tx"); add(tx, E("b", "", show1(x)), result && result(x) ? E("span", "", result(x)) : null);
    add(it, w, tx, btn("Remove", async function (b) { var all = (S.live[key] || []).filter(function (y) { return y !== x; }); var o = {}; o[key] = all; await act(b, function () { return saveLive(o); }, "Removed."); built.live = false; show("live"); }, "danger small"));
    l.appendChild(it);
  });
  var d = inp("Date", today(1), { type:"date" }), g = E("div", "grid3"), ins = {};
  g.appendChild(d);
  fields.forEach(function (f) {
    var x = f[2] === "sel4" ? sel(f[1], "0", [["0", "Answer 1"], ["1", "Answer 2"], ["2", "Answer 3"], ["3", "Answer 4"]]) : f[2] === "kind" ? sel(f[1], "joke", [["joke", "A joke"], ["tip", "A tip"], ["fact", "A fun fact"], ["game", "A little challenge"]]) :
      f[2] === "fx" ? sel(f[1], "snow", (S.fx || []).map(function (k) { return [k, k]; })) : inp(f[1], "", { maxlength:f[2] });
    ins[f[0]] = x.input; g.appendChild(x);
  });
  add(c, g, rowOf(btn("Add", async function (b) {
    var x = { date:d.input.value };
    fields.forEach(function (f) { x[f[0]] = ins[f[0]].value; });
    if (key === "trivia") { x = { date:x.date, q:x.q, opts:[x.o0, x.o1, x.o2, x.o3].filter(Boolean), a:+x.a }; }
    var all = (S.live[key] || []).filter(function (y) { return y.date !== x.date; }).concat([x]), o = {}; o[key] = all;
    await act(b, function () { return saveLive(o); }, "Added for " + x.date + ".");
    built.live = false; show("live");
  })));
}

/* ---------------------------------------------------------------- Notifications */
PANES.push = function (p) {
  var c = card(p, "Send a notification", "To every iPhone with news turned on, and on every PC (3.7.3 and later) it opens in the browser window within a few minutes. Send it to yourself first to see how it looks.");
  var pn = E("p", "d small"); pn.id = "pn"; c.appendChild(pn);
  var t = inp("Title", "", { id:"ptitle", maxlength:80, placeholder:"New games are here!" }), x = inp("Message", "", { id:"ptext", area:1, maxlength:300, placeholder:"Open Webs and try Pong and Breakout." }), u = inp("Link when they tap it (optional)", "", { id:"purl", maxlength:500, placeholder:"https://… (leave empty to open Webs)" });
  var at = inp("Send later (optional)", "", { type:"datetime-local" });
  var m = E("span", "d small"); m.id = "pmsg";
  var go = btn("Send to everyone", sendNews); go.id = "psend";
  add(c, t, x, u, at, rowOf(btn("Send to me first", async function (b) { await act(b, function () { return call({ op:"push.me", title:t.input.value, text:x.input.value, url:u.input.value }); }, "Sent to your devices."); }, "ghost"), go, m));
  var sc = card(p, "Waiting to go out"); var sl = E("div", "list sched"); sl.id = "psched"; sc.appendChild(sl);
  var hc = card(p, "Sent"); var hl = E("div", "list"); hl.id = "phist"; hc.appendChild(hl);
  REFRESH.push(p);
};
REFRESH.push = async function () {
  try {
    var s = S.stats || await call({ op:"stats" }), p = s.push || { phones:0 };
    var w = function (x) { return x ? new Date(x.at).toLocaleString() + " (" + x.sent + " iPhones)" : "not yet"; };
    $("pn").textContent = p.phones + (p.more ? "+" : "") + " iPhones have notifications on: " + p.news + " get news, " + p.updates + " new versions, " + p.daily + " the daily word reminder. Last news: " + (p.lastNews ? "“" + p.lastNews.title + "”, " + w(p.lastNews) : "not yet") + "." + (p.sending ? " Still sending: " + p.sending + "." : "");
    $("psend").textContent = "Send to " + p.news + (p.more ? "+" : "") + " iPhones and every PC";
    var h = await call({ op:"push.hist" }), sl = $("psched"), hl = $("phist");
    sl.innerHTML = ""; if (!h.sched.length) sl.appendChild(E("p", "d small", "Nothing scheduled."));
    h.sched.forEach(function (x) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", x.title), E("span", "", x.text)); add(it, E("span", "when", when(x.at)), tx, btn("Cancel", async function (b) { await act(b, function () { return call({ op:"push.unschedule", id:x.id }); }, "Cancelled."); REFRESH.push(); }, "danger small")); sl.appendChild(it); });
    hl.innerHTML = ""; if (!h.items.length) hl.appendChild(E("p", "d small", "Nothing sent yet."));
    var K = { news:"News", scheduled:"Scheduled news", updates:"New version", daily:"Word reminders", preview:"To you" };
    h.items.forEach(function (x) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", x.title || "(no title)"), E("span", "", (K[x.kind] || x.kind) + " · " + x.sent + " delivered" + (x.failed ? ", " + x.failed + " failed" + (x.why ? " (" + x.why + ")" : "") : "") + (x.gone ? ", " + x.gone + " had turned them off" : ""))); add(it, E("span", "when", when(x.at)), tx); hl.appendChild(it); });
  } catch (e) { toast(e.message); }
};
async function sendNews() {
  var title = $("ptitle").value.trim(), text = $("ptext").value.trim(), url = $("purl").value.trim(), later = document.querySelector('#pane-push input[type="datetime-local"]').value;
  if (!title || !text) { $("pmsg").textContent = "Write a title and a message first."; return; }
  if (later) {
    try { await call({ op:"push.schedule", title:title, text:text, url:url, at:new Date(later).getTime() }); toast("Scheduled for " + when(new Date(later).getTime()) + "."); $("ptitle").value = $("ptext").value = $("purl").value = ""; REFRESH.push(); } catch (e) { $("pmsg").textContent = e.message; }
    return;
  }
  if (!confirm("Send “" + title + "” to every iPhone that gets news, and every PC?")) return;
  $("psend").disabled = true;
  var cursor = "", sent = 0, gone = 0, failed = 0, why = "", started = Date.now();
  try {
    for (;;) {
      var r = await call({ op:"push", title:title, text:text, url:url, cursor:cursor, started:started, sentSoFar:sent, goneSoFar:gone, failedSoFar:failed, why:why });
      sent += r.sent; gone += r.gone; failed += r.failed; cursor = r.cursor; why = why || r.why || "";
      $("pmsg").textContent = "Sent to " + sent + " iPhones…";
      if (r.done) break;
    }
    $("pmsg").textContent = "Sent to " + sent + " iPhones, and on its way to every PC." + (gone ? " " + gone + " had turned notifications off." : "") + (failed ? " " + failed + " didn't go through" + (why ? " (Apple said: " + why + ")" : "") + "." : "");
    $("ptitle").value = $("ptext").value = $("purl").value = "";
    S.stats = null; REFRESH.push();
  } catch (e) { $("pmsg").textContent = e.message + (sent ? " (" + sent + " sent before that)" : ""); }
  $("psend").disabled = false;
}

/* ---------------------------------------------------------------- Updates: gradual rollout and going back */
PANES.updates = async function (p) {
  p.innerHTML = "";
  var info = {}; try { info = await call({ op:"updates.info" }); } catch (e) { toast(e.message); }
  if (!S.live || !S.live.rev) { try { var l = await call({ op:"live.get" }); S.live = l.live; S.agg = l.agg; } catch (e) {} }
  var ro = S.live.rollout || {}, rb = S.live.rollback || {}, A = S.agg || {};
  var users = function (pk) { return Object.entries(A.vers || {}).filter(function (x) { return x[0].indexOf(pk) === 0; }).map(function (x) { return x[0].slice(pk.length + 1) + ": " + x[1]; }).join(", ") || "no counts yet"; };
  // Windows
  var w = card(p, "💻 Windows", "The newest published version is " + (info.win ? info.win.version : "unknown") + (info.win && info.win.previous ? " (the one before: " + info.win.previous + ")" : "") + ". In use: " + users("Windows") + ".");
  var wv = info.win && info.win.version, wp = ro.win && ro.win.v === wv ? ro.win.pct : 100;
  var wr = inp("Who gets " + (wv || "it") + ": " + wp + "% of PCs", wp, { type:"range", min:0, max:100, step:5 });
  wr.input.oninput = function () { wr.firstChild.textContent = "Who gets " + (wv || "it") + ": " + wr.input.value + "% of PCs"; };
  add(w, wr, E("p", "d small", "0% stops it: PCs that haven't updated yet stay where they are. Each PC always lands on the same side, so raising the number only adds more."),
    rowOf(btn("Save", async function (b) { var r = Object.assign({}, ro); if (wv) r.win = { v:wv, pct:+wr.input.value }; await act(b, function () { return saveLive({ rollout:r }); }, "Saved."); built.updates = false; show("updates"); })));
  if (rb.win) add(w, E("p", "err", "⏪ Going back: every PC is being put on " + rb.win + "."), rowOf(btn("Stop going back", async function (b) { await act(b, function () { return saveLive({ rollback:{} }); }, "PCs update to " + wv + " again."); built.updates = false; show("updates"); }, "ghost")));
  else if (info.win && info.win.previous) w.appendChild(rowOf(btn("Undo: put every PC back on " + info.win.previous, async function (b) {
    if (!confirm("Put every PC back on " + info.win.previous + "? They install it by themselves within a few hours.")) return;
    await act(b, function () { return saveLive({ rollback:{ win:info.win.previous } }); }, "Going back to " + info.win.previous + "."); built.updates = false; show("updates");
  }, "danger")));
  else w.appendChild(E("p", "d small", "Undo needs the version before to be published too (it is from the next release on)."));
  // iPhone
  var i = card(p, "📱 iPhone", "The newest published version is " + (info.ios ? info.ios.version : "unknown") + ". In use: " + users("iPhone") + ".");
  var iv = info.ios && info.ios.version, ip = ro.ios && ro.ios.v === iv ? ro.ios.pct : 100;
  var ir = inp("Who gets " + (iv || "it") + ": " + ip + "% of iPhones", ip, { type:"range", min:0, max:100, step:5 });
  ir.input.oninput = function () { ir.firstChild.textContent = "Who gets " + (iv || "it") + ": " + ir.input.value + "% of iPhones"; };
  add(i, ir, E("p", "d small", "0% pauses it: iPhones that haven't updated keep the version they have. An iPhone can't go back to an older version by itself; to undo one, ask for the change to be reverted on GitHub (a new version then goes out)."),
    rowOf(btn("Save", async function (b) { var r = Object.assign({}, ro); if (iv) r.ios = { v:iv, pct:+ir.input.value }; await act(b, function () { return saveLive({ rollout:r }); }, "Saved."); built.updates = false; show("updates"); })));
};

/* ---------------------------------------------------------------- Settings: Web AI, codes, alerts, security, blocks */
PANES.settings = async function (p) {
  p.innerHTML = "";
  try { S.cfg = await call({ op:"cfg.get" }); } catch (e) { toast(e.message); return; }
  var C = S.cfg.cfg;
  // Web AI
  var ai = card(p, "✦ Web AI");
  var pa = sw("Pause Web AI", C.ai.paused, "Nobody can ask until you turn it back on"), pm = inp("What people see while it's paused", C.ai.pauseMsg, { maxlength:200, placeholder:"Web AI is taking a break. Try again later." });
  var cap = inp("Daily spending limit in dollars (0 = none)", C.ai.cap || 0, { type:"number", min:0, step:"0.5" });
  var mo = sel("Model", C.ai.model, [["", "Default (" + (S.cfg.ai.model) + ")"]].concat(S.cfg.models.map(function (m) { return [m, m + (/haiku/.test(m) ? " (cheapest, fastest)" : /opus/.test(m) ? " (smartest, about twice the price)" : " (balanced)")]; })));
  var le = sel("Answer length", C.ai.length, [["", "Default (normal)"], ["short", "Short"], ["normal", "Normal"], ["long", "Long"]]);
  var dl = inp("Questions a day per device or person (0 = default " + S.cfg.ai.daily + ")", C.ai.daily || 0, { type:"number", min:0 }), nl = inp("Per internet connection (0 = default)", C.ai.network || 0, { type:"number", min:0 }), tl = inp("For everyone together (0 = default)", C.ai.total || 0, { type:"number", min:0 });
  var g = E("div", "grid2"); add(g, cap, mo, le, dl, nl, tl);
  var mt = sw("Maintenance mode", C.maint.on, "Web AI says it's down for maintenance, and a note shows on everyone's start page"), mm = inp("Maintenance message", C.maint.text, { maxlength:200, placeholder:"Web AI is down for maintenance. It'll be back soon." });
  add(ai, pa, pm, g, mt, mm, rowOf(btn("Save", async function (b) {
    await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ ai:{ paused:pa.input.checked, pauseMsg:pm.input.value, cap:+cap.input.value, model:mo.input.value, length:le.input.value, daily:+dl.input.value, network:+nl.input.value, total:+tl.input.value }, maint:{ on:mt.input.checked, text:mm.input.value } } }); S.cfg.cfg = r.cfg; }, "Saved.");
  })));
  // the owner's code
  var oc = card(p, "🔑 Your owner's code", S.cfg.adminSecret ? "It's set as ADMIN_CODE on Cloudflare: change it with setup.cmd." : S.cfg.ownerSet ? "You changed it here before." : "It's the Web AI code named Me. Changing it here makes the old one stop working for this dashboard.");
  if (!S.cfg.adminSecret) {
    var n1 = inp("New code", "", { type:"password", autocomplete:"new-password", minlength:10 }), n2 = inp("Again", "", { type:"password", autocomplete:"new-password" });
    add(oc, E("div", "grid2"), rowOf(btn("Make a random one", function () { var a = new Uint8Array(12); crypto.getRandomValues(a); var v = [].map.call(a, function (x) { return "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]; }).join(""); n1.input.value = n2.input.value = v; n1.input.type = "text"; }, "ghost"),
      btn("Change it", async function (b) {
        if (n1.input.value !== n2.input.value) return toast("The two don't match.");
        await act(b, async function () { await call({ op:"owner.code", newCode:n1.input.value.trim() }); code = n1.input.value.trim(); sessionStorage.setItem("c", code); if (localStorage.getItem("wc")) localStorage.setItem("wc", code); }, "Changed. Use the new code from now on.");
      })));
    add(oc.children[2], n1, n2);
  }
  // Web AI codes
  var cc = card(p, "🎟 Web AI codes", "The codes you give people (each gets its own daily limit). Saving here replaces the WEB_AI_CODES from setup.cmd.");
  var cl = E("div"); cc.appendChild(cl);
  var codeRow = function (x) { var r = E("div", "grid3"), n = inp("Name", x.name, { maxlength:40 }), c = inp("Code", x.code, { maxlength:64, type:"password" }), l = inp("Questions a day (0 = default)", x.limit || 0, { type:"number", min:0 }); c.input.onfocus = function () { c.input.type = "text"; }; add(r, n, c, l); r.get = function () { return { name:n.input.value, code:c.input.value.trim(), limit:+l.input.value }; }; cl.appendChild(r); };
  add(cc, rowOf(btn("Show the codes", async function (b) { await act(b, async function () { var r = await call({ op:"codes.get" }); cl.innerHTML = ""; r.list.forEach(codeRow); b.remove(); }); }, "ghost"),
    btn("Add someone", function () { var a = new Uint8Array(12); crypto.getRandomValues(a); codeRow({ name:"", code:[].map.call(a, function (x) { return "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]; }).join(""), limit:0 }); }, "ghost"),
    btn("Save codes", async function (b) { if (!cl.children.length) return toast("Show the codes first."); await act(b, function () { return call({ op:"codes.set", list:[].map.call(cl.children, function (r) { return r.get(); }).filter(function (x) { return x.code; }) }); }, "Codes saved."); })));
  // alerts on this device
  var al = card(p, "🔔 Alerts on your phone", "New support chats and replies, logins, outages, the spending limit and a weekly report. On iPhone: open this page in Safari, Share → Add to Home Screen, open it from there, then turn alerts on.");
  var sl = E("div", "list"); al.appendChild(sl);
  (S.cfg.subs || []).forEach(function (s) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", s.label), E("span", "", "Since " + new Date(s.at).toLocaleDateString())); add(it, tx, btn("Remove", async function (b) { await act(b, function () { return call({ op:"sub.del", e:s.e }); }, "Removed."); built.settings = false; show("settings"); }, "danger small")); sl.appendChild(it); });
  var kinds = [["support", "Support chats and problem reports"], ["logins", "Logins and wrong codes"], ["outages", "Outages"], ["cap", "Spending limit reached"]].map(function (k) { var s = sw(k[1], C.alerts[k[0]] !== false); s.key = k[0]; return s; });
  var wk = sw("Weekly report (Mondays at 9 in the morning)", C.weekly !== false);
  add(al, rowOf(btn("Turn on alerts on this device", alertsOn), (S.cfg.subs || []).length ? btn("Send a test", async function (b) { await act(b, function () { return call({ op:"sub.test" }); }, "Sent."); }, "ghost") : null));
  kinds.forEach(function (k) { al.appendChild(k); }); al.appendChild(wk);
  al.appendChild(rowOf(btn("Save", async function (b) { var a = {}; kinds.forEach(function (k) { a[k.key] = k.input.checked; }); await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ alerts:a, weekly:wk.input.checked } }); S.cfg.cfg = r.cfg; }, "Saved."); }, "ghost")));
  // two-step login
  var ts = card(p, "🔐 Two-step login", C.twoStep ? "On: a new browser needs your OK on your phone, as well as the code." : "Off. Turn it on so your code alone isn't enough: a new browser also needs your OK on your phone.");
  ts.appendChild(E("p", "small " + (S.cfg.fails ? "err" : "d"), S.cfg.fails ? "⚠️ " + S.cfg.fails + " wrong codes typed today." : "No wrong codes typed today."));
  var tl2 = E("div", "list"); ts.appendChild(tl2);
  (S.cfg.trust || []).forEach(function (t) { var it = E("div", "it"), tx = E("div", "tx"); add(tx, E("b", "", t.ua), E("span", "", "Signed in " + new Date(t.at).toLocaleDateString() + " · last used " + ago(t.last))); add(it, tx, btn("Sign out", async function (b) { await act(b, function () { return call({ op:"trust.revoke", i:t.i }); }, "Signed out."); built.settings = false; show("settings"); }, "ghost small")); tl2.appendChild(it); });
  ts.appendChild(rowOf(C.twoStep ? btn("Turn off", async function (b) { await act(b, function () { return call({ op:"2fa.off" }); }, "Two-step login is off."); built.settings = false; show("settings"); }, "danger") :
    btn("Turn on", async function (b) { await act(b, async function () { var r = await call({ op:"2fa.on" }); showSecret("Your recovery code", r.recovery, "If you lose your phone, this lets you in once. Write it down and keep it safe: it's shown only now."); }); built.settings = false; show("settings"); }),
    btn("Sign out every other browser", async function (b) { await act(b, function () { return call({ op:"trust.revoke", all:true }); }, "Done."); built.settings = false; show("settings"); }, "ghost")));
  // blocked
  var bl = card(p, "🚫 Blocked", "Blocked devices can't use Web AI, Help & support or the start page extras. Block a device from its support chat; block a code by name.");
  var bll = E("div", "list"); bl.appendChild(bll);
  C.block.devices.forEach(function (d) { var it = E("div", "it"); add(it, E("div", "tx", "Device " + d.slice(1, 9)), btn("Unblock", async function (b) { await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ block:{ devices:C.block.devices.filter(function (x) { return x !== d; }), codes:C.block.codes } } }); S.cfg.cfg = r.cfg; }, "Unblocked."); built.settings = false; show("settings"); }, "ghost small")); bll.appendChild(it); });
  C.block.codes.forEach(function (n) { var it = E("div", "it"); add(it, E("div", "tx", "Code: " + n), btn("Unblock", async function (b) { await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ block:{ devices:C.block.devices, codes:C.block.codes.filter(function (x) { return x !== n; }) } } }); S.cfg.cfg = r.cfg; }, "Unblocked."); built.settings = false; show("settings"); }, "ghost small")); bll.appendChild(it); });
  var bn = inp("Block a code by its name", "", { maxlength:40, placeholder:"Friend2" });
  add(bl, bn, rowOf(btn("Block", async function (b) { if (!bn.input.value.trim()) return; await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ block:{ devices:C.block.devices, codes:C.block.codes.concat([bn.input.value.trim()]) } } }); S.cfg.cfg = r.cfg; }, "Blocked."); built.settings = false; show("settings"); }, "ghost")));
  // watching
  var wa = card(p, "📡 Outage alerts", "Every 5 minutes the server checks the iPhone app's website and the update files, and tells you if one stops answering. Add your own sites too.");
  var wu = inp("More addresses to watch (one per line)", (C.watch || []).join("\n"), { area:1, placeholder:"https://…" });
  add(wa, wu, rowOf(btn("Save", async function (b) { await act(b, async function () { var r = await call({ op:"cfg.set", patch:{ watch:wu.input.value.split("\n") } }); S.cfg.cfg = r.cfg; }, "Saved."); }, "ghost")));
  // backup
  var bk = card(p, "💾 Backup", "Problem reports and support chats in one file.");
  bk.appendChild(rowOf(btn("Download a backup", async function (b) {
    await act(b, async function () { var r = await call({ op:"export" }); var blob = new Blob([JSON.stringify(r, null, 2)], { type:"application/json" }), a = E("a"); a.href = URL.createObjectURL(blob); a.download = "webs-backup-" + today() + ".json"; document.body.appendChild(a); a.click(); a.remove(); }, "Downloaded.");
  }, "ghost")));
};
async function alertsOn(b) {
  await act(b, async function () {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error(/iPhone|iPad/.test(navigator.userAgent) ? "On iPhone, add this page to your Home Screen first (Share → Add to Home Screen), open it from there, and try again." : "This browser can't get notifications.");
    var reg = await navigator.serviceWorker.register("admin/sw.js", { scope:"/admin" });
    var perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications weren't allowed.");
    var k = (await (await fetch("push/key")).json()).key;
    var s = k.replace(/-/g, "+").replace(/_/g, "/"), key = Uint8Array.from(atob(s + "===".slice((s.length + 3) % 4)), function (c) { return c.charCodeAt(0); });
    var old = await reg.pushManager.getSubscription(); if (old) await old.unsubscribe().catch(function () {});
    var sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:key });
    await call({ op:"sub.add", sub:sub.toJSON() });
  }, "Alerts are on on this device.");
  built.settings = false; show("settings");
}

/* ---------------------------------------------------------------- Log */
PANES.log = function (p) { REFRESH.log(p); };
REFRESH.log = async function (p) {
  p.innerHTML = "";
  var c = card(p, "What you did", "The newest first: news sent, settings changed, chats answered, logins.");
  var l = E("div", "list"); c.appendChild(l);
  try { var r = await call({ op:"log" }); if (!r.items.length) l.appendChild(E("p", "d small", "Nothing yet.")); r.items.forEach(function (x) { var it = E("div", "it"); add(it, E("span", "when", when(x.at)), E("div", "tx", x.w)); l.appendChild(it); }); } catch (e) { toast(e.message); }
};

/* ---------------------------------------------------------------- your achievements */
function achList() {
  var s = S.stats || {}, a = S.agg || {}, c = S.cfg || {}, L = S.live || {};
  var days = s.days || [], q14 = days.reduce(function (n, d) { return n + d.questions; }, 0), qmax = Math.max.apply(null, [0].concat(days.map(function (d) { return d.questions; })));
  return [
    ["first", "✦", "Hello, Web AI", "Someone asked Web AI a question", q14 > 0],
    ["q100", "💯", "Busy day", "100 questions in one day", qmax >= 100],
    ["d10", "👥", "Squad", "10 devices use Webs", (a.devices || 0) >= 10],
    ["d50", "🎪", "Crowd", "50 devices use Webs", (a.devices || 0) >= 50],
    ["d100", "🚀", "First 100 users", "100 devices use Webs", (a.devices || 0) >= 100],
    ["world", "🌍", "Worldwide", "People in 3 countries", Object.keys(a.countries || {}).length >= 3],
    ["alerts", "🔔", "Always on call", "Alerts on your phone", (c.subs || []).length > 0],
    ["safe", "🔐", "Locked down", "Two-step login on", !!(c.cfg && c.cfg.twoStep)],
    ["poll", "📊", "Democracy", "Run a poll", !!L.poll],
    ["card", "🎭", "Phantom Thief", "Send a calling card", !!L.card],
    ["goal", "🏁", "Team captain", "Start a community goal", !!L.goal],
    ["hunt", "🔍", "Game master", "Start a secret code hunt", !!L.hunt],
    ["wall", "🖼", "Curator", "Share a wallpaper of the week", !!L.wall],
    ["p5", "🃏", "Take your heart", "Use the Phantom Thieves look", document.body.classList.contains("p5")]
  ];
}
function checkAch() {
  var seen = {}; try { seen = JSON.parse(localStorage.getItem("wach") || "{}"); } catch (e) {}
  var list = achList(), fresh = list.filter(function (x) { return x[4] && !seen[x[0]]; });
  var n = list.filter(function (x) { return x[4]; }).length, b = $("achb"); if (b) b.textContent = "🏆 " + n;
  if (!fresh.length) return;
  var first = !Object.keys(seen).length;
  fresh.forEach(function (x) { seen[x[0]] = Date.now(); });
  localStorage.setItem("wach", JSON.stringify(seen));
  if (!first) { toast("🏆 Achievement: " + fresh[0][2] + (fresh.length > 1 ? " and " + (fresh.length - 1) + " more" : "")); confetti(); }
}
function openAch() {
  checkAch();
  var m = E("div", "modal"), b = E("div"), g = E("div", "ach"), list = achList();
  list.forEach(function (x) { var d = E("div", x[4] ? "got" : ""); add(d, E("em", "", x[1]), E("b", "", x[2]), E("span", "", x[3])); g.appendChild(d); });
  add(b, E("h3", "", "Your achievements · " + list.filter(function (x) { return x[4]; }).length + " of " + list.length), g, rowOf(E("span", "sp"), btn("Close", function () { m.remove(); }, "ghost")));
  b.style.maxWidth = "640px"; m.appendChild(b); m.onclick = function (e) { if (e.target === m) m.remove(); }; document.body.appendChild(m);
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var c = E("canvas"); c.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60"; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  var x = c.getContext("2d"), ps = [], cols = ["#e8342a", "#febc2e", "#2fbf71", "#4a9eff", "#ffffff"];
  for (var i = 0; i < 140; i++) ps.push({ x:innerWidth / 2, y:innerHeight / 3, vx:(Math.random() - .5) * 14, vy:Math.random() * -12 - 2, r:Math.random() * 6 + 3, c:cols[i % 5], a:Math.random() * 6 });
  var t0 = performance.now();
  (function f(t) { x.clearRect(0, 0, c.width, c.height); ps.forEach(function (p) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }); if (t - t0 < 2600) requestAnimationFrame(f); else c.remove(); })(t0);
}

/* ---------------------------------------------------------------- start */
if (localStorage.getItem("wp5")) document.body.classList.add("p5");
if (code) signIn(); else loginView();
})();`;
