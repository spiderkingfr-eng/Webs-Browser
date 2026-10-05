/* Webs 3.9: an anime theme's live wallpaper behind a web page. The browser window sends this, with
   ../../js/anime.js, to the sites you choose (src/anime.chrome.js) and it runs on the page itself.

   Behind the page: the wallpaper is drawn underneath everything the site shows. The site's big,
   plain backgrounds (the page, its main column, a full-screen backdrop) turn see-through, and a
   veil in the site's own background color sits over the wallpaper, so the text stays easy to read
   and the page keeps its colors. Sidebars and full-width bars can go half see-through. Everything
   smaller keeps its look: messages, cards, menus, buttons, boxes you type in, pictures and videos.
   Nothing moves, and the wallpaper never takes a click.
   Over the page: a faint layer on top instead, which clicks go straight through, for sites whose
   backgrounds are pictures.

   Only how this page looks on your screen changes: nothing on it is read out or sent anywhere.
   window[Symbol.for("wsb.animeSite")](settings) changes it, and { on:false } takes it all off. */
(function (Anime, first) {
"use strict";
var W = window, D = document, KEY = Symbol.for("wsb.animeSite"), ATTR = "data-wsb-anime";
if (!Anime || !(D.documentElement instanceof HTMLElement)) return;
var C = null, host = null, cv = null, veil = null, wall = null, wallKey = "";
var sheet = new CSSStyleSheet(), rules = "", own = new Map(), stale = new Set();
var base = [255, 255, 255, 1], dark = false, mo = null, timer = 0, last = 0, lastFresh = 0, wantFresh = false, beat = 0;
var mq = W.matchMedia ? W.matchMedia("(prefers-color-scheme: dark)") : null;
// a page's own !important rules lose to these (two ids' worth of weight); inline !important still wins
var sel = function (v) { return "[" + ATTR + '="' + v + '"]:not(#wsb-a):not(#wsb-b)'; };

/* ---------------------------------------------------------------- colors, however the page wrote them */
var probe = null, known = new Map();
function rgba(s) {
  if (!s || s === "transparent") return [0, 0, 0, 0];
  var m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  if (known.has(s)) return known.get(s);
  var out = [0, 0, 0, 0];
  try {     // oklch(), color(), hsl()…: drawn once on a 1×1 canvas and read back
    if (!probe) { var pc = D.createElement("canvas"); pc.width = pc.height = 1; probe = pc.getContext("2d", { willReadFrequently:true }); }
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = "#000"; probe.fillStyle = s; probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255];
  } catch (e) {}
  if (known.size < 300) known.set(s, out);
  return out;
}
var lum = function (c) { return (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255; };
var far = function (a, b) { return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)); };
var css = function (c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (+a).toFixed(3) + ")"; };

/* ---------------------------------------------------------------- what each thing on the page is
   kind "b": a backdrop (big and plain: it turns see-through); "g": a sidebar or a bar across the
   page (half see-through, with "See-through sidebars and bars"). stop: something with its own
   look (a message, a card, a picture, a box to type in), which covers whatever is under it. */
var CONTENT = /^(IMG|VIDEO|CANVAS|IFRAME|EMBED|OBJECT|PICTURE|AUDIO|INPUT|TEXTAREA|SELECT|BUTTON|svg)$/i;
var PASS = { pass:1 }, STOP = { stop:1 };
function measure(el, vw, vh) {
  if (el === host) return PASS;
  if (CONTENT.test(el.tagName) || (el.isContentEditable && el !== D.body)) return STOP;
  var cs = getComputedStyle(el);
  if (+cs.opacity < .5 || cs.visibility === "hidden") return PASS;
  var was = el.hasAttribute(ATTR) && own.get(el);       // our rule is on it: its own colors were kept
  var bg = was ? was.bg : cs.backgroundColor, im = was ? was.im : cs.backgroundImage;
  if (/url\(/i.test(im)) return STOP;                     // a picture: the site's own
  var c = rgba(bg), grad = !!im && im !== "none";
  if (c[3] < .9 && !grad) return PASS;                    // nothing painted here: look further down
  var r = el.getBoundingClientRect();
  var w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)), f = w * h / (vw * vh);
  var info = { bg:bg, im:im, c:c, f:f };
  if (f >= .4 || (w >= vw * .85 && h >= vh * .5)) { info.kind = "b"; return info; }
  // a fade into the page's color (above the box to type in, under a header) would be a band of it: it goes
  if (c[3] < .9 && w >= vw * .5 && /rgba\([^()]*,\s*0\)|transparent/.test(im)) { info.kind = "b"; return info; }
  if (f >= .04 && c[3] >= .9 && (h >= vh * .45 || w >= vw * .9)) { info.kind = "g"; return info; }
  return STOP;
}
// the color of the page itself, when nothing big has one
function pageColor() {
  var h = rgba(getComputedStyle(D.documentElement).backgroundColor);
  if (h[3] >= .9) return h;
  var b = D.body && (own.get(D.body) ? own.get(D.body).c : rgba(getComputedStyle(D.body).backgroundColor));
  if (b && b[3] >= .9) return b;
  return /dark/.test(getComputedStyle(D.documentElement).colorScheme || "") ? [18, 18, 18, 1] : [255, 255, 255, 1];
}

/* ---------------------------------------------------------------- looking over the page
   Points across the window, and at each one everything stacked there, from the top down to the
   first thing that keeps its look. Fresh: the site's colors may have changed (its dark mode), so
   what was kept about the backdrops is read again. */
function scan(fresh) {
  clearTimeout(timer); timer = 0; last = Date.now();
  if (fresh) lastFresh = last;
  if (!C || !host) return;
  if (!host.isConnected) D.documentElement.appendChild(host);
  if (D.adoptedStyleSheets.indexOf(sheet) < 0) D.adoptedStyleSheets = D.adoptedStyleSheets.concat([sheet]);
  var vw = innerWidth, vh = innerHeight;
  if (!vw || !vh) return;
  var redo = fresh ? Array.from(own.keys()) : Array.from(stale);
  stale.clear();
  redo.forEach(function (el) { el.removeAttribute(ATTR); own.delete(el); });
  var seen = new Map(), found = new Map(), behind = C.mode === "behind";
  for (var y = 0; y < 6; y++) for (var x = 0; x < 8; x++) {
    var stack = D.elementsFromPoint((x + .5) / 8 * vw, (y + .5) / 6 * vh);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (el === D.documentElement) break;
      var m = seen.get(el);
      if (!m) { m = measure(el, vw, vh); seen.set(el, m); }
      if (m.kind) { found.set(el, m); continue; }
      if (m.stop) break;
    }
  }
  // and inside the backdrops, wide things the points missed (a thin fade above the box to type in)
  var cnt = { n:0 };
  Array.from(found.keys()).forEach(function (el) { if (found.get(el).kind === "b") dig(el, 0, vw, vh, seen, found, cnt); });
  // backdrops read again that are out of sight right now keep their place
  redo.forEach(function (el) { if (!seen.has(el) && el.isConnected) { var m = measure(el, vw, vh); seen.set(el, m); if (m.kind) found.set(el, m); } });
  var all = new Map();
  own.forEach(function (m, el) { if (el.isConnected && !seen.has(el)) all.set(el, m); });
  found.forEach(function (m, el) { all.set(el, m); });
  // the page's own color: its biggest plain backdrop's, or the page's
  var big = null;
  all.forEach(function (m) { if (m.kind === "b" && m.c[3] >= .9 && (!big || m.f > big.f)) big = m; });
  base = big ? big.c : pageColor();
  dark = lum(base) < .45;
  // a big area in a color of its own (a colored banner) only goes half see-through, like a sidebar
  all.forEach(function (m, el) {
    if (m.kind === "b" && m.c[3] >= .9 && far(m.c, base) > 90) m.kind = "g";
    if (m.kind === "g" && !C.panels) all.delete(el);
  });
  if (!behind) all.clear();
  // what no longer counts goes back to how the site made it
  own.forEach(function (m, el) { if (!all.has(el)) el.removeAttribute(ATTR); });
  own = all;
  var cols = [], k = shows(), text = "";
  own.forEach(function (m, el) {
    var v = "b";
    if (m.kind === "g") { var key = css(m.c, 1), n = cols.indexOf(key); if (n < 0) { n = cols.length; cols.push(key); } v = "g" + n; m.v = n; }
    if (el.getAttribute(ATTR) !== v) el.setAttribute(ATTR, v);
  });
  if (behind) {
    text = "@media screen{" + sel("b") + "{background-color:transparent!important;background-image:none!important}";
    own.forEach(function (m) { if (m.kind === "g") text += sel("g" + m.v) + "{background-color:" + css(m.c, Math.max(.35, 1 - .6 * k) * m.c[3]) + "!important;background-image:none!important}"; });
    text += "}";
  }
  if (text !== rules) { rules = text; try { sheet.replaceSync(text); } catch (e) {} }
  place();
}
function dig(el, d, vw, vh, seen, found, cnt) {
  for (var c = el.firstElementChild; c && cnt.n < 150; c = c.nextElementSibling) {
    if (c === host || !(c.offsetWidth >= vw * .5)) continue;
    cnt.n++;
    var m = seen.get(c);
    if (!m) { m = measure(c, vw, vh); seen.set(c, m); }
    if (m.kind) found.set(c, m);
    if (!m.stop && d < 6) dig(c, d + 1, vw, vh, seen, found, cnt);
  }
}
function soon(fresh) {
  if (fresh) wantFresh = true;
  if (!C) return;
  // straight away when it's been a while (before the page is drawn: no flash), else once things settle;
  // the site's own colors changing (its dark mode) straight away, unless that happens all the time
  var now = Date.now(), wait = wantFresh && now - lastFresh > 1000 ? 0 : 400 - (now - last);
  if (wait <= 0) run(); else if (!timer) timer = setTimeout(run, wait);
}
/* Something big just put on the page (a site redrawing its main column) is made see-through at once,
   before it's drawn; the full look over the page comes a moment later. Small things are passed by. */
function quick(added) {
  if (!C || C.mode !== "behind" || !added.length) return;
  var vw = innerWidth, vh = innerHeight, min = .04 * vw * vh, n = 0;
  var look = function (el, d) {
    if (el.nodeType !== 1 || el === host || ++n > 80 || !(el.offsetWidth * el.offsetHeight >= min)) return;
    var m = measure(el, vw, vh);
    if (m.kind === "b" && !(m.c[3] >= .9 && far(m.c, base) > 90)) { own.set(el, m); if (el.getAttribute(ATTR) !== "b") el.setAttribute(ATTR, "b"); }
    if (!m.stop && d < 4) for (var c = el.firstElementChild; c; c = c.nextElementSibling) look(c, d + 1);
  };
  added.forEach(function (el) { look(el, 0); });
}
function run() { var f = wantFresh; wantFresh = false; scan(f); }
function onMut(list) {
  if (!C) return;
  var fresh = false, any = false, added = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.target === host) continue;                     // its own fading in and out
    if (r.type === "attributes") {
      if (r.target === D.documentElement || r.target === D.body) fresh = true;    // the site's dark mode, say
      else if (r.target.hasAttribute(ATTR)) stale.add(r.target);
    } else {
      if (r.addedNodes.length === 1 && r.addedNodes[0] === host && !r.removedNodes.length) continue;
      for (var j = 0; j < r.addedNodes.length && added.length < 40; j++) if (r.addedNodes[j].nodeType === 1) added.push(r.addedNodes[j]);
    }
    any = true;
  }
  quick(added);
  if (any) soon(fresh);
}
var onScroll = function () { soon(false); };
var onResize = function () { soon(false); if (wall && C && C.still) wall.redraw(); };
var onScheme = function () { soon(true); };

/* ---------------------------------------------------------------- the wallpaper */
// how much of it shows through: chosen, or about half on a dark site and a third on a light one
function shows() { return C.k || (dark ? .5 : .32); }
function build() {
  host = D.createElement("wsb-anime");
  host.setAttribute("aria-hidden", "true");
  var root = host.attachShadow({ mode:"closed" });
  root.innerHTML = '<style>.w,canvas,.v{position:absolute;left:0;top:0;width:100%;height:100%;display:block}.w{overflow:hidden}' +
    'canvas{transition:filter .4s}.v{transition:background-color .5s}@media print{.w{display:none}}</style><div class="w"><canvas></canvas><div class="v"></div></div>';
  cv = root.querySelector("canvas"); veil = root.querySelector(".v");
  place(0);
  D.documentElement.appendChild(host);
  mo = new MutationObserver(onMut);
  mo.observe(D.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["class", "style"] });
  W.addEventListener("scroll", onScroll, { capture:true, passive:true });
  W.addEventListener("resize", onResize);
  if (mq && mq.addEventListener) mq.addEventListener("change", onScheme);
  // now and then the colors are read again: some sites change them deep inside the page
  beat = setInterval(function () { if (!D.hidden) soon(true); }, 20000);
  requestAnimationFrame(function () { requestAnimationFrame(function () { place(); }); });    // fades in
}
function place(fade) {
  if (!host || !C) return;
  var over = C.mode === "over", k = shows();
  var st = "all:initial;display:block;position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;contain:strict;transition:opacity .6s;" +
    (over ? "z-index:2147483645;mix-blend-mode:" + (dark ? "screen" : "multiply") + ";opacity:" + (fade === 0 ? 0 : (.12 + .45 * k).toFixed(3))
      : "z-index:-2147483647;opacity:" + (fade === 0 ? 0 : 1));
  host.style.cssText = st.split(";").filter(Boolean).map(function (d) { return d + "!important"; }).join(";");
  veil.style.backgroundColor = over ? "transparent" : css(base, 1 - k);
  // the site's colors turned upside down (Webs' dark mode for every site): the wallpaper is turned back
  var inv = /invert/.test(getComputedStyle(D.documentElement).filter || "");
  cv.style.filter = (inv ? "invert(1) hue-rotate(180deg) " : "") + (C.soft ? "blur(6px)" : "");
  cv.style.transform = C.soft ? "scale(1.04)" : "";
}
function start() {
  var key = C.id + ":" + C.still + ":" + C.motion;
  if (wall && key === wallKey) return;
  if (wall) wall.stop();
  wall = Anime.run(cv, C.id, { motion:C.motion, still:C.still, dpr:1, fps:30 }); wallKey = key;
}

/* ---------------------------------------------------------------- on, changed, off */
function set(c) {
  c = c || {};
  if (!c.on || !Anime.has(c.id)) return off();
  C = { id:String(c.id), mode:c.mode === "over" ? "over" : "behind", k:Math.max(0, Math.min(.95, +c.k || 0)), panels:c.panels !== false,
    soft:!!c.soft, still:!!c.still, motion:c.motion === 0 || c.motion === 1 ? c.motion : 2 };
  if (!host) build();
  start();
  scan(true);
}
function off() {
  C = null; clearTimeout(timer); timer = 0; clearInterval(beat);
  if (wall) wall.stop(); wall = null; wallKey = "";
  own.forEach(function (m, el) { el.removeAttribute(ATTR); }); own = new Map(); stale.clear();
  rules = ""; try { sheet.replaceSync(""); } catch (e) {}
  D.adoptedStyleSheets = D.adoptedStyleSheets.filter(function (s) { return s !== sheet; });
  if (mo) mo.disconnect(); mo = null;
  W.removeEventListener("scroll", onScroll, { capture:true });
  W.removeEventListener("resize", onResize);
  if (mq && mq.removeEventListener) mq.removeEventListener("change", onScheme);
  if (host) host.remove(); host = null;
}
var api = function (c) { try { set(c); } catch (e) { console.error("Webs anime wallpaper:", e); } };
// for the tests: what it's doing
api.info = function () { return C ? { id:C.id, mode:C.mode, k:shows(), base:base.slice(0, 3), dark:dark, marked:own.size, rules:rules } : null; };
try { Object.defineProperty(W, KEY, { value:api }); } catch (e) {}
api(first);
})
