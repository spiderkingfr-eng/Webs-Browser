/* Webs Browser for iPhone - motion and the little things that make it feel
   alive: the launch splash, ripples, springy sheets, a sliding segmented
   control, the theme reveal, pull to refresh, confetti, parallax and live
   wallpapers. Everything here steps aside when Animations is off in Settings
   or the phone asks for reduced motion. */
"use strict";

const motionOK = () => cfg.motion !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- launch splash */
(function splash() {
  const el = $("#splash");
  if (!el) return;
  const done = () => { el.classList.add("out"); setTimeout(() => el.remove(), 450); };
  if (!motionOK() || document.documentElement.classList.contains("locked")) { el.remove(); return; }   // the lock screen comes first
  setTimeout(done, 900);
})();

/* ---------------------------------------------------------------- ripples and presses */
const RIPPLE = ".row, .mrow, .srow.btn, .btnx, .chips button, .qa button, #btns button, .hbtn, .tool, #homeFoot button, .wbtn, .tcard, #heroSearch, .tile .fv, .lbl button, #dlg .b button, .kp button";
document.addEventListener("pointerdown", e => {
  if (!motionOK() || e.button > 0) return;
  let el = e.target.closest(RIPPLE);
  if (!el) return;
  if (el.classList.contains("tile")) el = el.querySelector(".fv");
  const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement("span");
  s.className = "ripple";
  s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
  el.classList.add("rpl");
  el.appendChild(s);
  setTimeout(() => s.remove(), 650);
}, { passive:true });

// Shortcuts lean toward your finger, in 3D.
(function tilt() {
  let fv = null;
  const reset = () => { if (fv) { fv.style.removeProperty("--rx"); fv.style.removeProperty("--ry"); fv.classList.remove("tilt"); fv = null; } };
  document.addEventListener("pointerdown", e => {
    if (!motionOK()) return;
    const t = e.target.closest("#grid .tile");
    if (!t || $("#grid").classList.contains("editing")) return;
    fv = t.querySelector(".fv");
    const r = fv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    fv.style.setProperty("--rx", (-y * 26).toFixed(1) + "deg"); fv.style.setProperty("--ry", (x * 26).toFixed(1) + "deg");
    fv.classList.add("tilt");
  }, { passive:true });
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, reset, { passive:true }));
})();

/* ---------------------------------------------------------------- entrances */
// The children of a box glide in one after another.
function stagger(box, max, step) {
  if (!box || !motionOK()) return;
  let i = 0;
  [...box.children].forEach(c => {
    if (c.classList.contains("hide") || getComputedStyle(c).display === "none" || i >= (max || 14)) return;
    c.classList.remove("enter"); void c.offsetWidth;
    c.style.animationDelay = (i++ * (step || 45)) + "ms";
    c.classList.add("enter");
    c.addEventListener("animationend", () => { c.classList.remove("enter"); c.style.animationDelay = ""; }, { once:true });
  });
}
let wasWeb = null;
RENDER_HOOKS.push(web => {
  // the start page comes in section by section, when you arrive on it
  if (!web && wasWeb !== false) stagger($("#home .wrap"), 16, 40);
  wasWeb = web;
});

// Sheets spring open, their contents cascade, and they slide away when closed.
let sheetGen = 0;
openSheet = (orig => function () {
  sheetGen++;
  $("#sheet").classList.remove("closing"); $("#scrim").classList.remove("closing");
  const wasOpen = !$("#sheet").classList.contains("hide");
  orig.apply(this, arguments);
  if (!wasOpen) { $("#sheet").classList.remove("pop"); void $("#sheet").offsetWidth; $("#sheet").classList.add("pop"); }
  stagger($("#sheetBody"), 12, 35);
})(openSheet);
closeSheet = (orig => function () {
  const sh = $("#sheet");
  if (sh.classList.contains("hide") || sh.classList.contains("closing")) return;
  if (!motionOK()) { orig(); return; }
  if (sh.dataset.kind === "note" && typeof flushNote === "function") flushNote();
  const g = sheetGen;
  sh.classList.add("closing"); $("#scrim").classList.add("closing");
  setTimeout(() => {
    sh.classList.remove("closing"); $("#scrim").classList.remove("closing");
    if (g === sheetGen) orig();
  }, 190);
})(closeSheet);

// The address bar zooms open and its rows cascade in.
openOmni = (orig => function () {
  const was = !$("#omni").classList.contains("hide");
  orig.apply(this, arguments);
  if (was || !motionOK()) return;
  const l = $("#omniList");
  l.classList.remove("cascade"); void l.offsetWidth; l.classList.add("cascade");
  setTimeout(() => l.classList.remove("cascade"), 700);
})(openOmni);

// The tab switcher zooms out of the tabs button.
openTabs = (orig => function () {
  orig.apply(this, arguments);
  const v = $("#tabsv");
  v.classList.remove("zoom"); void v.offsetWidth; v.classList.add("zoom");
})(openTabs);

// The reload button spins while a page loads.
progress = (orig => function (on) {
  orig(on);
  $("#relBtn").classList.toggle("spin", !!on);
})(progress);

/* ---------------------------------------------------------------- a sliding segmented control
   The highlighted part of a segmented control glides to the one you tap,
   even when the settings around it are redrawn. */
(function slidingSeg() {
  let prev = null;
  const keyOf = seg => seg.dataset.seg || seg.id || "";
  document.addEventListener("click", e => {
    const b = e.target.closest(".seg button");
    if (!b || !motionOK()) return;
    const seg = b.parentNode, on = seg.querySelector("button.on");
    if (!on || on === b) return;
    const r = on.getBoundingClientRect(), sr = seg.getBoundingClientRect();
    prev = { key:keyOf(seg), left:r.left - sr.left, width:r.width };
    setTimeout(() => {
      const p = prev; prev = null;
      const seg2 = $$(".seg").find(s => keyOf(s) === p.key), on2 = seg2 && seg2.querySelector("button.on");
      if (!on2) return;
      const r2 = on2.getBoundingClientRect(), s2 = seg2.getBoundingClientRect();
      const pill = document.createElement("i");
      pill.className = "pill";
      pill.style.cssText = "left:" + p.left + "px;width:" + p.width + "px";
      seg2.appendChild(pill); seg2.classList.add("sliding");
      requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.left = (r2.left - s2.left) + "px"; pill.style.width = r2.width + "px"; }));
      setTimeout(() => { pill.remove(); seg2.classList.remove("sliding"); }, 330);
    }, 0);
  }, true);
})();

/* ---------------------------------------------------------------- theme reveal
   A new theme spreads out in a circle from where you tapped. */
function themeSwap(apply, x, y) {
  if (!motionOK() || !document.startViewTransition) {
    apply();
    if (motionOK()) { document.body.classList.remove("flash"); void document.body.offsetWidth; document.body.classList.add("flash"); }
    return;
  }
  x = x || innerWidth / 2; y = y || innerHeight / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try {
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => document.documentElement.animate({ clipPath:["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
      { duration:520, easing:"cubic-bezier(.4,0,.2,1)", pseudoElement:"::view-transition-new(root)" })).catch(() => {});
  } catch (e) { apply(); }
}

/* ---------------------------------------------------------------- confetti */
function confetti(from) {
  if (!motionOK()) return;
  const cv = document.createElement("canvas"), k = Math.min(2, devicePixelRatio || 1);
  cv.className = "confetti"; cv.width = innerWidth * k; cv.height = innerHeight * k;
  document.body.appendChild(cv);
  const g = cv.getContext("2d"); g.scale(k, k);
  const r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : { left:innerWidth / 2, top:innerHeight / 3, width:0, height:0 };
  const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e8342a";
  const cols = [acc, "#ffd23f", "#3ec1d3", "#7bd389", "#ff6b9a", "#a66bff", "#ffffff"];
  const P = Array.from({ length:140 }, () => {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, v = 6 + Math.random() * 9;
    return { x:ox, y:oy, vx:Math.cos(a) * v, vy:Math.sin(a) * v, s:4 + Math.random() * 5, rot:Math.random() * 6, vr:(Math.random() - .5) * .4, c:cols[Math.random() * cols.length | 0], sh:Math.random() < .3 };
  });
  const t0 = performance.now();
  (function frame(now) {
    const t = now - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => {
      p.vy += .32; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - t / 2200); g.fillStyle = p.c;
      if (p.sh) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 7); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    });
    if (t < 2200) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

/* ---------------------------------------------------------------- pull to refresh */
(function pullToRefresh() {
  const home = $("#home"), ptr = $("#ptr");
  let y0 = null, d = 0, busy = false;
  home.addEventListener("touchstart", e => { if (home.scrollTop <= 0 && !busy && !document.body.classList.contains("sorting")) { y0 = e.touches[0].clientY; d = 0; } }, { passive:true });
  home.addEventListener("touchmove", e => {
    if (y0 == null) return;
    d = e.touches[0].clientY - y0;
    if (d <= 0 || home.scrollTop > 0) { ptr.style.cssText = ""; return; }
    const p = Math.min(1, d / 90);
    ptr.style.cssText = "opacity:" + p + ";transform:translate(-50%," + Math.min(70, d * .55) + "px) rotate(" + d * 3 + "deg)";
    ptr.classList.toggle("ready", d > 90);
  }, { passive:true });
  home.addEventListener("touchend", () => {
    if (y0 == null) return;
    y0 = null;
    if (d > 90 && !busy) {
      busy = true; ptr.classList.add("spin"); ptr.style.cssText = "opacity:1;transform:translate(-50%,46px)";
      save("weather", Object.assign(load("weather", {}) || {}, { ts:0 }));
      if (typeof refreshWidgets === "function") refreshWidgets();
      renderHome();
      setTimeout(() => { busy = false; ptr.classList.remove("spin", "ready"); ptr.style.cssText = ""; stagger($("#home .wrap"), 16, 30); }, 700);
    } else { ptr.classList.remove("ready"); ptr.style.cssText = ""; }
  });
})();

/* ---------------------------------------------------------------- scrolling: parallax and the toolbar's shadow */
(function onScroll() {
  const home = $("#home"), bar = $("#bar"), bgl = $("#bgl");
  let ticking = false;
  const upd = () => {
    ticking = false;
    const st = home.scrollTop;
    if (document.body.classList.contains("pic") && motionOK()) bgl.style.transform = "translateY(" + (st - Math.min(st * .18, 140)) + "px)";
    else bgl.style.transform = "";
    const under = cfg.barPos === "top" ? st > 4 : st + home.clientHeight < home.scrollHeight - 4;
    bar.classList.toggle("raised", under);
  };
  home.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive:true });
  HOME_HOOKS.push(() => requestAnimationFrame(upd));
  RENDER_HOOKS.push(web => { if (web) bar.classList.remove("raised"); });
})();

/* ---------------------------------------------------------------- offline banner */
(function offline() {
  const el = $("#offline");
  const upd = () => {
    const off = navigator.onLine === false;
    if (off) { el.classList.remove("hide", "bye"); }
    else if (!el.classList.contains("hide")) { el.textContent = "You're back online"; el.classList.add("good", "bye"); setTimeout(() => { el.classList.add("hide"); el.classList.remove("good", "bye"); el.textContent = "You're offline. Webs, your notes and games still work."; }, 1800); }
  };
  addEventListener("online", upd); addEventListener("offline", upd);
  if (navigator.onLine === false) upd();
})();

/* ---------------------------------------------------------------- live wallpapers
   The Windows start page's moving backgrounds (cfg.liveBg), drawn behind the
   start page while it is on screen. */
const LIVE_KINDS = ["gradient", "stars", "aurora", "rain", "snow", "embers", "fireflies", "waves"];
const live = { cv:null, raf:0, kind:"" };
function liveKind() { return PRIVATE ? "" : LIVE_KINDS.indexOf(cfg.liveBg) >= 0 ? cfg.liveBg : ""; }
function liveStop() { cancelAnimationFrame(live.raf); live.raf = 0; if (live.cv) { live.cv.remove(); live.cv = null; } live.kind = ""; }
function liveStart() {
  const kind = liveKind(), t = curTab();
  document.body.classList.toggle("live", !!kind);
  if (!kind || (t && t.u) || document.hidden) { liveStop(); return; }
  if (live.kind === kind && live.cv) return;
  liveStop();
  live.kind = kind;
  live.cv = Object.assign(document.createElement("canvas"), { id:"live" });
  live.cv.setAttribute("aria-hidden", "true");
  $("#view").prepend(live.cv);
  const g = live.cv.getContext("2d"), still = !motionOK();
  const stars = Array.from({ length:160 }, () => ({ x:Math.random(), y:Math.random(), r:Math.random() * 1.4 + .2, s:Math.random() * 3 + 1 }));
  const P = Array.from({ length:240 }, () => ({ x:Math.random(), y:Math.random(), r:Math.random(), s:Math.random(), p:Math.random() * 6.283 }));
  let W = 0, H = 0, last = 0;
  const step = now => {
    live.raf = 0;
    if (!live.cv) return;
    const k = Math.min(2, devicePixelRatio || 1), w = live.cv.clientWidth, h = live.cv.clientHeight;
    if (w !== W || h !== H) { W = w; H = h; live.cv.width = W * k; live.cv.height = H * k; }
    g.setTransform(k, 0, 0, k, 0, 0);
    const t = still ? 0 : now / 1000;
    drawLive(g, kind, t, W, H, stars, P);
    // about 30 frames a second is plenty for a background, and kind to the battery
    if (!still) live.raf = requestAnimationFrame(n => { if (n - last < 30) { live.raf = requestAnimationFrame(step); return; } last = n; step(n); });
  };
  live.raf = requestAnimationFrame(step);
}
function drawLive(g, kind, t, W, H, stars, P) {
  const vgrad = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  if (kind === "gradient") {
    const a = t * .15, gr = g.createLinearGradient(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * H, W / 2 - Math.cos(a) * W, H / 2 - Math.sin(a) * H);
    gr.addColorStop(0, "hsl(" + (260 + Math.sin(t * .2) * 40) + ",55%,22%)"); gr.addColorStop(.5, "hsl(" + (330 + Math.sin(t * .17) * 30) + ",55%,25%)"); gr.addColorStop(1, "hsl(" + (20 + Math.sin(t * .13) * 20) + ",60%,24%)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  } else if (kind === "stars") {
    g.fillStyle = "#07060d"; g.fillRect(0, 0, W, H);
    stars.forEach(p => { const x = ((p.x - t * .004 * p.s) % 1 + 1) % 1 * W, y = p.y * H; g.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * p.s * .5 + p.x * 10)); g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, p.r, 0, 7); g.fill(); });
    g.globalAlpha = 1;
  } else if (kind === "aurora") {
    g.fillStyle = "#060a12"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    [["#1fd1a3", 0], ["#3b8bf0", 2], ["#9a63f0", 4]].forEach(([c, o]) => {
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, H * .35 + Math.sin(x / 180 + t * .5 + o) * 60 + Math.sin(x / 70 + t * .9 + o) * 18);
      g.lineTo(W, H); g.closePath();
      const gr = g.createLinearGradient(0, H * .2, 0, H * .8); gr.addColorStop(0, c + "66"); gr.addColorStop(1, c + "00"); g.fillStyle = gr; g.fill();
    });
    g.globalCompositeOperation = "source-over";
  } else if (kind === "rain") {
    vgrad("#0a1322", "#1b2b45");
    g.strokeStyle = "rgba(170,200,255,.33)"; g.lineWidth = 1; g.beginPath();
    P.forEach(p => { const y = ((p.y + t * (.55 + p.s * .8)) % 1.1) * H - .05 * H, x = ((p.x * W + y * .14) % W + W) % W, len = 9 + p.r * 20; g.moveTo(x, y); g.lineTo(x + len * .14, y + len); });
    g.stroke();
    g.strokeStyle = "rgba(170,200,255,.35)";
    P.slice(0, 45).forEach(p => { const ph = (t * (.7 + p.s) + p.p) % 1; if (ph < .3) { g.globalAlpha = 1 - ph / .3; g.beginPath(); g.ellipse(p.x * W, H - 8 - p.r * 26, 2 + ph * 26, 1 + ph * 5, 0, 0, 6.283); g.stroke(); } });
    g.globalAlpha = 1;
  } else if (kind === "snow") {
    vgrad("#0e1627", "#2b3753");
    g.fillStyle = "#fff";
    P.forEach(p => { const y = ((p.y + t * (.025 + p.s * .045)) % 1.05) * H - 10, x = p.x * W + Math.sin(t * (.4 + p.s * .6) + p.p) * 22 * (p.r + .3);
      g.globalAlpha = .35 + .6 * p.r; g.beginPath(); g.arc(x, y, .7 + p.r * 2.6, 0, 6.283); g.fill(); });
    g.globalAlpha = 1;
  } else if (kind === "embers") {
    const gr = g.createRadialGradient(W / 2, H * 1.15, 10, W / 2, H * 1.15, H * 1.1); gr.addColorStop(0, "#5a1e08"); gr.addColorStop(.5, "#241007"); gr.addColorStop(1, "#0b0503");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    P.slice(0, 110).forEach(p => { const ph = (t * (.04 + p.s * .07) + p.y) % 1, y = H * (1.03 - ph * 1.12), x = p.x * W + Math.sin(t * (.7 + p.s) + p.p) * 36 * ph;
      const a = (1 - ph) * (.45 + .45 * Math.sin(t * 5 + p.p * 3)); if (a <= 0) return;
      const r = 1 + p.r * 2.4, rg = g.createRadialGradient(x, y, 0, x, y, r * 4); rg.addColorStop(0, "hsla(" + (18 + p.r * 22) + ",100%,62%," + a + ")"); rg.addColorStop(1, "hsla(20,100%,50%,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 4, 0, 6.283); g.fill(); });
    g.globalCompositeOperation = "source-over";
  } else if (kind === "fireflies") {
    vgrad("#030d08", "#0a2014");
    g.fillStyle = "#020805";
    for (let i = 0; i < 9; i++) { const x = (i / 8) * W, h = H * (.22 + ((i * 37) % 10) / 45); g.beginPath(); g.moveTo(x - 70, H); g.lineTo(x, H - h); g.lineTo(x + 70, H); g.fill(); }
    g.globalCompositeOperation = "lighter";
    P.slice(0, 55).forEach(p => { const x = (p.x + Math.sin(t * .12 * (1 + p.s) + p.p) * .07) * W, y = (.12 + p.y * .8 + Math.cos(t * .1 * (1 + p.r) + p.p * 2) * .05) * H;
      const glow = t ? Math.max(0, Math.sin(t * (.8 + p.s * 1.6) + p.p)) : p.r; if (glow < .02) return;
      const rg = g.createRadialGradient(x, y, 0, x, y, 14); rg.addColorStop(0, "rgba(220,255,120," + glow * .9 + ")"); rg.addColorStop(1, "rgba(180,255,80,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.fill(); });
    g.globalCompositeOperation = "source-over";
  } else if (kind === "waves") {
    const sky = g.createLinearGradient(0, 0, 0, H * .62); sky.addColorStop(0, "#241640"); sky.addColorStop(.6, "#b85f6e"); sky.addColorStop(1, "#f4a96a");
    g.fillStyle = sky; g.fillRect(0, 0, W, H * .62);
    const sx = W * .68, sy = H * .56, sg = g.createRadialGradient(sx, sy, 10, sx, sy, 150); sg.addColorStop(0, "rgba(255,226,150,.95)"); sg.addColorStop(.35, "rgba(255,190,120,.5)"); sg.addColorStop(1, "rgba(255,160,100,0)");
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 150, 0, 6.283); g.fill();
    ["#2d6f8f", "#23597a", "#1a4566", "#123351", "#0b243d"].forEach((c, i) => {
      const base = H * (.6 + i * .085), amp = 6 + i * 4, sp = .6 + i * .25;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 12) g.lineTo(x, base + Math.sin(x / (90 + i * 30) + t * sp + i) * amp + Math.sin(x / 41 - t * sp * 1.3) * amp * .3);
      g.lineTo(W, H); g.closePath(); g.fillStyle = c; g.fill();
    });
  }
}
HOME_HOOKS.push(liveStart);
RENDER_HOOKS.push(web => { if (web) { liveStop(); document.body.classList.remove("live"); } });
LOOK_HOOKS.push(() => { if (live.cv && live.kind !== liveKind()) liveStart(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) liveStop(); else { const t = curTab(); if (!(t && t.u)) liveStart(); } });
addEventListener("resize", () => { if (live.cv && !live.raf) { const k = live.kind; liveStop(); if (k) liveStart(); } });
