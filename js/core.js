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
  barPos:"bottom",      // bottom | top
  tabView:"grid",       // grid | list
  midBtn:"home",        // the toolbar's middle button: home | bookmarks | notes | tools | newtab
  histKeep:0            // days of history to keep; 0 = all
};
let cfg = Object.assign({}, DEF, load("settings", {}));
function setCfg(k, v) { cfg[k] = v; save("settings", cfg); }

var PRIVATE = false;     // private tabs: nothing is written to history

/* Places the other scripts plug into, so each feature can live in its own file. */
const HOME_HOOKS = [];   // run after the start page is drawn
const LOOK_HOOKS = [];   // run after the theme and colors are applied
const OMNI_EMPTY = [];   // extra rows for the empty address bar: () => html
const RENDER_HOOKS = []; // run after the view switches between the start page and a page
const SETACTIONS = {};   // Settings buttons (data-set="name") added by other scripts
function runHooks(list) {
  const args = [].slice.call(arguments, 1);
  list.forEach(f => { try { f.apply(null, args); } catch (e) { console.error(e); } });
}

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
  check:"M5 12l5 5L20 7",
  // 2.0
  tools:"M15 4a5 5 0 0 0-4.6 6.9L4 17.3V20h2.7l6.4-6.4A5 5 0 0 0 20 9l-3 1-2-2 1-3z",
  chart:"M4 20h16M7 16v-5M12 16V7M17 16v-8",
  trophy:"M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6",
  mic:"M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v3",
  qr:"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 19h1M19 14h1",
  folder:"M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
  grid:"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  sort:"M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2",
  cal:"M5 6h14v14H5zM5 10h14M9 4v4M15 4v4",
  quote:"M6 8h4v4c0 2.5-1.5 4-4 5M14 8h4v4c0 2.5-1.5 4-4 5",
  flame:"M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5",
  palette:"M12 4a8 8 0 0 0 0 16c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-2 2-2H17a3 3 0 0 0 3-3c0-3.9-3.6-7-8-7zM8 12h.01M10 8h.01M15 8h.01",
  key:"M15 4a5 5 0 1 1-4.6 7L4 17.4V20h3v-2h2v-2h2l1.4-1.4A5 5 0 0 1 15 4zM16 8h.01",
  wind:"M4 9h10a3 3 0 1 0-3-3M4 15h14a3 3 0 1 1-3 3M4 12h7",
  wheel:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7",
  receipt:"M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  type:"M5 7V5h14v2M12 5v14M9 19h6",
  keypad:"M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01",
  ruler:"M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2",
  bell:"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  db:"M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  gift:"M4 9h16v4H4zM6 13v8h12v-8M12 9v12M12 9C10 5 6 5 6 7.5S12 9 12 9s6 .5 6-1.5S14 5 12 9",
  heart:"M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  expand:"M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  grip:"M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  bulb:"M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z",
  target:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1",
  sun:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon:"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  dice:"M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01",
  textsize:"M3 18l5-12 5 12M5 14h6M15 18l3-7 3 7M16 16h4",
  undo:"M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  wifi:"M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  flag:"M5 21V4M5 4h11l-2 4 2 4H5",
  more:"M5 12h.01M12 12h.01M19 12h.01"
};
function ico(n, cls) {
  return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || "") + '"/></svg>';
}

/* ---------------------------------------------------------------- toast */
let toastT = 0;
function toast(msg, action) {
  const el = $("#toast");
  if (!el) return;
  const ms = action ? 6000 : 2600;
  el.innerHTML = '<span></span>' + (action ? '<button type="button"></button>' : "") + '<i class="tbar" style="animation-duration:' + ms + 'ms"></i>';
  el.firstChild.textContent = msg;
  if (action) { const b = el.querySelector("button"); b.textContent = action.label; b.onclick = () => { hideToast(); action.fn(); }; }
  el.classList.remove("on"); void el.offsetWidth;   // restart the slide-in for a toast that replaces another
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(hideToast, ms);
}
function hideToast() { const el = $("#toast"); if (el) el.classList.remove("on"); }

// What you copied with Webs' own buttons, newest first (Tools → Copy history).
function rememberCopy(s) {
  if (PRIVATE || !s || String(s).length > 4000) return;
  const list = load("clips", []).filter(x => x.t !== s);
  list.unshift({ t:String(s), ts:Date.now() });
  save("clips", list.slice(0, 30));
}
async function copyText(s) {
  rememberCopy(s);
  try { await navigator.clipboard.writeText(s); toast("Copied"); }
  catch (e) {
    const t = Object.assign(document.createElement("textarea"), { value:s });
    t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); toast("Copied"); } catch (e2) { toast("Could not copy"); }
    t.remove();
  }
}

/* ---------------------------------------------------------------- drag to reorder
   For shortcuts in Edit mode, to-dos and lists in settings. o.can(el) says which
   items may move, o.hold is how long to press first (0: as soon as you move),
   and o.drop(from, to) gets the old and new position among the items. */
function dragSort(box, sel, o) {
  o = o || {};
  let el = null, ph = null, x0 = 0, y0 = 0, from = -1, on = false, timer = 0, raf = 0, lastY = 0;
  const kids = () => [...box.children].filter(x => x.matches(sel));
  const slots = () => [...box.children].filter(x => x !== el && (x === ph || x.matches(sel)));   // the order with the placeholder in it
  const scroller = () => box.closest("#home, .sheet .body, #tabGrid");
  function begin() {
    on = true;
    const r = el.getBoundingClientRect();
    from = kids().indexOf(el);
    ph = document.createElement(el.tagName === "BUTTON" ? "div" : el.tagName);
    ph.className = "dragph"; ph.style.width = r.width + "px"; ph.style.height = r.height + "px";
    box.insertBefore(ph, el);
    Object.assign(el.style, { position:"fixed", left:r.left + "px", top:r.top + "px", width:r.width + "px", height:r.height + "px", zIndex:60, pointerEvents:"none", margin:0 });
    el.classList.add("dragging");
    document.body.classList.add("sorting");
    autoScroll();
  }
  function autoScroll() {
    const sc = scroller();
    raf = requestAnimationFrame(autoScroll);
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (lastY < r.top + 50) sc.scrollTop -= 7; else if (lastY > r.bottom - 70) sc.scrollTop += 7;
  }
  function move(e) {
    if (!el) return;
    lastY = e.clientY;
    if (!on) {
      const d = Math.hypot(e.clientX - x0, e.clientY - y0);
      if (o.hold) { if (d > 8) end(); return; }
      if (d < 6) return;
      begin();
    }
    e.preventDefault();
    el.style.transform = "translate(" + (e.clientX - x0) + "px," + (e.clientY - y0) + "px) scale(1.06)";
    const hit = document.elementFromPoint(e.clientX, e.clientY), t = hit && hit.closest(sel);
    if (!t || t === el || t.parentNode !== box) return;
    const list = slots();
    if (list.indexOf(ph) < list.indexOf(t)) box.insertBefore(ph, t.nextSibling); else box.insertBefore(ph, t);
  }
  function end(drop) {
    clearTimeout(timer); timer = 0;
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel);
    cancelAnimationFrame(raf);
    if (on) {
      const to = slots().indexOf(ph);
      ph.remove();
      el.removeAttribute("style"); el.classList.remove("dragging");
      document.body.classList.remove("sorting");
      box.dataset.dragged = "1"; setTimeout(() => { delete box.dataset.dragged; }, 60);
      if (drop && to >= 0 && to !== from) o.drop(from, to);
    }
    el = null; on = false;
  }
  const up = () => end(true), cancel = () => end(false);
  box.addEventListener("pointerdown", e => {
    if (e.button > 0 || el) return;
    const t = e.target.closest(sel);
    if (!t || t.parentNode !== box || (o.can && !o.can(t))) return;
    el = t; x0 = e.clientX; y0 = e.clientY; lastY = y0; on = false;
    if (o.hold) timer = setTimeout(() => { if (el) { begin(); el.style.transform = "scale(1.06)"; } }, o.hold);
    addEventListener("pointermove", move, { passive:false }); addEventListener("pointerup", up); addEventListener("pointercancel", cancel);
  });
  // once a drag starts, the page must not scroll under it
  box.addEventListener("touchmove", e => { if (on) e.preventDefault(); }, { passive:false });
  box.addEventListener("contextmenu", e => { if (on || timer) e.preventDefault(); });
}
