/* Webs Browser for iPhone - storage, settings and small helpers shared by
   every script. Data lives in this web app's own storage under the same
   "wsb." keys the Windows browser uses, so a backup file from one opens in
   the other. Nothing leaves the phone. */
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function load(k, d) {
  try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
}
function save(k, v) {
  try { localStorage.setItem("wsb." + k, JSON.stringify(v)); return true; }
  catch (e) {
    // Out of room: history is the one thing that grows without bound.
    const h = load("history", []);
    if (k !== "history" && h.length > 200) { h.length = Math.floor(h.length * 0.6); try { localStorage.setItem("wsb.history", JSON.stringify(h)); } catch (e2) {} }
    else if (k === "history" && v.length > 200) v.length = Math.floor(v.length * 0.6);
    try { localStorage.setItem("wsb." + k, JSON.stringify(v)); return true; } catch (e2) { return false; }
  }
}

// Settings. Keys shared with the Windows browser keep their names there;
// the few that only make sense on a phone are marked.
const DEF = {
  search:"ddg", theme:"auto", accent:"#e8342a", https:true, suggest:true, motion:"",
  clock24:false, clockSec:false, clock:true, ntpName:"", ntpHide:[], ntpShow:[], wxCity:"", wxUnit:"", freq:true,
  // phone only
  clean:true,           // strip tracking parameters (utm_, fbclid...) before a page opens
  saveHistory:true,
  openMode:"smart",     // smart | inside | outside
  barPos:"bottom"       // bottom | top
};
let cfg = Object.assign({}, DEF, load("settings", {}));
function setCfg(k, v) { cfg[k] = v; save("settings", cfg); }

var PRIVATE = false;     // private tabs: nothing is written to history

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;

/* ---------------------------------------------------------------- icons
   The Windows browser's own line icons, plus a few a phone needs. */
const P = {
  plus:"M12 5v14M5 12h14", x:"M5 5l14 14M19 5L5 19", minus:"M5 12h14",
  back:"M15 5l-7 7 7 7", fwd:"M9 5l7 7-7 7",
  rel:"M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  home:"M4 11l8-7 8 7M6 10v9h12v-9",
  star:"M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z",
  read:"M4 6h7a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4zM20 6h-7a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h7z",
  shieldok:"M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6zM9 12l2 2 4-4",
  menu:"M4 7h16M4 12h16M4 17h16",
  lock:"M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z",
  glass:"M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4 4",
  clock:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2",
  chev:"M6 9l6 6 6-6", right:"M9 6l6 6-6 6",
  world:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 12h16M12 4c2.5 2.6 2.5 12.4 0 16M12 4c-2.5 2.6-2.5 12.4 0 16",
  gear:"M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4",
  copy:"M9 9h10v10H9zM5 15V5h10",
  mask:"M4 9c2-3 14-3 16 0-1 6-4 8-8 8s-7-2-8-8zM9 12h.01M15 12h.01",
  trash:"M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13",
  book:"M5 5h8a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H5z",
  note:"M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  info:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 11v5M12 8h.01",
  edit:"M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  other:"M14 4h6v6M20 4l-9 9M11 5H5v14h14v-6",
  history:"M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v4l3 2",
  timer:"M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 10v4l2 2M10 3h4",
  link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  sparkle:"M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  list:"M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  // phone additions
  share:"M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1",
  tabs:"M8 8h12v12H8zM4 16V4h12",
  game:"M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01",
  up:"M12 19V5M6 11l6-6 6 6", dl:"M12 4v10m-4-4l4 4 4-4M5 19h14", ul:"M12 15V5M8 9l4-4 4 4M5 19h14",
  phone:"M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  paste:"M9 4h6v3H9zM7 5H5v15h14V5h-2M9 12h6M9 16h4",
  pin:"M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  check:"M5 12l5 5L20 7"
};
function ico(n, cls) {
  return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || "") + '"/></svg>';
}

/* ---------------------------------------------------------------- toast */
let toastT = 0;
function toast(msg, action) {
  const el = $("#toast");
  if (!el) return;
  el.innerHTML = '<span></span>' + (action ? '<button type="button"></button>' : "");
  el.firstChild.textContent = msg;
  if (action) { const b = el.querySelector("button"); b.textContent = action.label; b.onclick = () => { hideToast(); action.fn(); }; }
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(hideToast, action ? 6000 : 2600);
}
function hideToast() { const el = $("#toast"); if (el) el.classList.remove("on"); }

async function copyText(s) {
  try { await navigator.clipboard.writeText(s); toast("Copied"); }
  catch (e) {
    const t = Object.assign(document.createElement("textarea"), { value:s });
    t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); toast("Copied"); } catch (e2) { toast("Could not copy"); }
    t.remove();
  }
}
