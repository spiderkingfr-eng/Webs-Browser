/* ---------------------------------------------------------------- Webs 3.0: more widgets and live wallpapers */
(function () {
"use strict";
const XW = [["xprog", "Day and year progress"], ["xfocus", "Today's focus"], ["xmoon", "Moon phase"], ["xwclock", "World clocks"],
  ["xwater", "Water tracker"], ["xscreen", "Screen time today"], ["xmark", "Rediscover a bookmark"]];
XW.forEach(w => { SHOW.push(w); DEFAULT_OFF.push(w[0]); });
const sec = document.createElement("section"); sec.id = "xSec"; sec.innerHTML = '<div class="wgrid" id="xgrid"></div>';
$("wSec").after(sec);
const day = () => new Date().toLocaleDateString("en-CA");
const E = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d; };
let tickT = 0;
function moon(d) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14), age = (((d - ref) / 864e5) % syn + syn) % syn, f = age / syn;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  const i = Math.floor(f * 8 + .5) % 8, ill = Math.round((1 - Math.cos(f * 2 * Math.PI)) / 2 * 100);
  const toFull = ((14.765 - age) % syn + syn) % syn;
  return { e:["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"][i], n:names[i], ill, full:Math.round(toFull) };
}
function paintW(k, d) {
  const now = new Date();
  if (k === "xprog") {
    const y0 = new Date(now.getFullYear(), 0, 1), y1 = new Date(now.getFullYear() + 1, 0, 1), m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), w0 = new Date(d0 - ((now.getDay() + 6) % 7) * 864e5);
    const P = [["Today", (now - d0) / 864e5], ["Week", (now - w0) / (7 * 864e5)], ["Month", (now - m0) / (m1 - m0)], ["Year", (now - y0) / (y1 - y0)]];
    d.innerHTML = '<h3>Progress</h3><div class="xbars">' + P.map(([n, p]) => '<div><span>' + n + '</span><i><b style="width:' + (p * 100).toFixed(1) + '%"></b></i><em>' + Math.floor(p * 100) + "%</em></div>").join("") + "</div>";
  } else if (k === "xmoon") {
    const m = moon(now);
    d.innerHTML = '<h3>Moon</h3><div class="xmoon"><b></b><div><strong></strong><span></span></div></div>';
    d.querySelector("b").textContent = m.e; d.querySelector("strong").textContent = m.n;
    d.querySelector("span").textContent = m.ill + "% lit · " + (m.n === "Full moon" ? "full tonight" : "full moon in " + m.full + " day" + (m.full === 1 ? "" : "s"));
  } else if (k === "xfocus") {
    const f = get("xFocus", {});
    if (f.d === day() && f.t) {
      d.innerHTML = '<h3>Today\'s focus</h3><div class="xgoal' + (f.done ? " done" : "") + '"><button title="Done">' + (f.done ? "✓" : "") + '</button><span></span><a title="Change">✎</a></div>';
      d.querySelector("span").textContent = f.t;
      d.querySelector("button").onclick = () => { f.done = !f.done; put("xFocus", f); paintW(k, d); if (f.done && typeof egg === "function" && cfg.motion !== "off") try { egg("fireworks"); } catch (e) {} };
      d.querySelector("a").onclick = () => { put("xFocus", {}); paintW(k, d); };
    } else {
      d.innerHTML = '<h3>Today\'s focus</h3><div class="xfocus"><input placeholder="What matters most today?" maxlength="80"></div>';
      const i = d.querySelector("input"); i.onkeydown = e => { if (e.key === "Enter" && i.value.trim()) { put("xFocus", { d:day(), t:i.value.trim(), done:false }); paintW(k, d); } };
    }
  } else if (k === "xwclock") {
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const L = (get("xClocks", null) || [here, "Europe/London", "America/New_York", "Asia/Tokyo"]).filter(z => z !== here).slice(0, 4);
    d.innerHTML = '<h3>World clocks</h3><div class="xwc">' + L.map(z => { let t = ""; try { t = now.toLocaleTimeString([], { timeZone:z, hour:"numeric", minute:"2-digit" }); } catch (e) {} return "<div><span>" + z.split("/").pop().replace(/_/g, " ") + "</span><b>" + t + "</b></div>"; }).join("") +
      '</div><div style="font-size:11px;color:var(--dim2);margin-top:4px">Change the places in the sidebar: More → World clocks</div>';
  } else if (k === "xwater") {
    let w = get("xWater", {}); if (w.d !== day()) w = { d:day(), n:0 };
    d.innerHTML = '<h3>Water today · <span></span></h3><div class="xcups">' + Array.from({ length:8 }, (_, i) => '<button data-i="' + i + '" class="' + (i < w.n ? "on" : "") + '" title="Glass ' + (i + 1) + '"></button>').join("") + "</div>";
    d.querySelector("h3 span").textContent = w.n + " of 8 glasses";
    d.querySelectorAll("button").forEach(b => b.onclick = () => { const i = +b.dataset.i; w.n = w.n === i + 1 ? i : i + 1; put("xWater", w); paintW(k, d); });
  } else if (k === "xscreen") {
    const t = (get("screentime", {})[day()] || {}), hosts = Object.keys(t).sort((a, b) => t[b] - t[a]), sum = hosts.reduce((a, h) => a + t[h], 0);
    const f = s => s >= 3600 ? Math.floor(s / 3600) + " h " + Math.round(s % 3600 / 60) + " min" : Math.round(s / 60) + " min";
    d.innerHTML = '<h3>Screen time today</h3><div class="xst"></div><div></div><span class="xlink">See the week</span>';
    d.querySelector(".xst").textContent = f(sum);
    d.querySelector(".xst+div").textContent = hosts.length ? "Most on " + hosts.slice(0, 2).join(" and ") : "Nothing yet today";
    d.querySelector(".xlink").onclick = () => send("go", "https://browser.example/insights.html");
  } else if (k === "xmark") {
    const L = get("bookmarks", []).filter(m => m && /^https?:/.test(m.u));
    if (!L.length) { d.innerHTML = '<h3>Rediscover</h3><div style="color:var(--dim);font-size:12.5px">Your bookmarks show up here, one a day.</div>'; return; }
    const n = (d.dataset.skip = +(d.dataset.skip || 0)), m = L[(Math.floor(Date.now() / 864e5) + n) % L.length];
    d.innerHTML = '<h3>Rediscover</h3><div class="xmk"><img alt=""><div><b></b><span></span></div></div><span class="xlink">Another one</span>';
    d.querySelector("img").src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(hostOf(m.u));
    d.querySelector("img").onerror = e => { e.target.style.visibility = "hidden"; };
    d.querySelector("b").textContent = m.t || hostOf(m.u); d.querySelector("span").textContent = hostOf(m.u) + (m.ts ? " · saved " + new Date(m.ts).toLocaleDateString([], { month:"short", year:"numeric" }) : "");
    d.querySelector(".xmk").onclick = e => open(m.u, e);
    d.querySelector(".xlink").onclick = () => { d.dataset.skip = n + 1; paintW(k, d); };
  }
}
function xWidgets() {
  const g = $("xgrid"), on = XW.map(w => w[0]).filter(k => !hidden(k) && !PRIVATE);
  sec.classList.toggle("hide", !on.length);
  if ([...g.children].map(x => x.dataset.w).join(",") !== on.join(",")) {
    g.innerHTML = "";
    on.forEach((k, i) => { const d = document.createElement("div"); d.className = "wg"; d.dataset.w = k; d.style.animationDelay = i * 60 + "ms"; g.appendChild(d); paintW(k, d); });
  } else [...g.children].forEach(d => { if (d.dataset.w !== "xfocus" || !d.querySelector("input")) paintW(d.dataset.w, d); });
  clearInterval(tickT);
  if (on.some(k => k === "xprog" || k === "xwclock")) tickT = setInterval(() => { if (!document.hidden) [...g.children].forEach(d => { if (d.dataset.w === "xprog" || d.dataset.w === "xwclock") paintW(d.dataset.w, d); }); }, 60000);
}

/* live wallpapers */
const XL = [["matrix", "Code rain"], ["warp", "Warp speed"], ["bubbles", "Bubbles"], ["lava", "Lava lamp"], ["net", "Constellations"], ["petals", "Cherry blossoms"]];
const seg = $("liveSeg");
XL.forEach(([v, n]) => { const b = document.createElement("button"); b.dataset.v = v; b.textContent = n; b.onclick = () => { saveBg("liveBg", v); liveBg(); }; seg.appendChild(b); });
const xl = { kind:"", cv:null, raf:0 };
function xlStop() { cancelAnimationFrame(xl.raf); xl.raf = 0; if (xl.cv) { xl.cv.remove(); xl.cv = null; } xl.kind = ""; }
function xlStart(kind) {
  xl.kind = kind;
  const cv = xl.cv = Object.assign(document.createElement("canvas"), { id:"live" }); cv.setAttribute("aria-hidden", "true");
  const bgl = $("bgl"); if (bgl) bgl.after(cv); else document.body.prepend(cv);
  const g = cv.getContext("2d"), still = cfg.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e8342a";
  let W = 0, H = 0, last = performance.now(), cols = [], P = [];
  const mouse = { x:-1e4, y:-1e4 };
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive:true });
  const resize = () => {
    const k = devicePixelRatio || 1; if (W === innerWidth && H === innerHeight) return false;
    W = innerWidth; H = innerHeight; cv.width = W * k; cv.height = H * k; g.setTransform(k, 0, 0, k, 0, 0); return true;
  };
  const R = Math.random;
  const init = () => {
    if (kind === "matrix") { cols = Array.from({ length:Math.ceil(W / 16) }, () => ({ y:R() * -H / 16, s:.4 + R() * .9 })); g.fillStyle = "#020a04"; g.fillRect(0, 0, W, H); }
    if (kind === "warp") P = Array.from({ length:420 }, () => ({ x:(R() - .5) * 2, y:(R() - .5) * 2, z:R() }));
    if (kind === "bubbles") P = Array.from({ length:70 }, () => ({ x:R(), y:R() * 1.2, r:6 + R() * 34, s:.02 + R() * .05, p:R() * 6.28 }));
    if (kind === "lava") P = Array.from({ length:7 }, (_, i) => ({ x:R(), y:R(), r:.18 + R() * .16, sx:.02 + R() * .03, sy:.015 + R() * .03, p:R() * 6.28, h:i }));
    if (kind === "net") P = Array.from({ length:Math.min(140, Math.round(W * H / 11000)) }, () => ({ x:R() * W, y:R() * H, vx:(R() - .5) * 18, vy:(R() - .5) * 18 }));
    if (kind === "petals") P = Array.from({ length:70 }, () => ({ x:R(), y:R(), s:.03 + R() * .05, r:R() * 6.28, vr:(R() - .5) * 1.6, w:6 + R() * 7, p:R() * 6.28 }));
  };
  const KATA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";
  const step = now => {
    if (resize()) init();
    const dt = Math.min(.05, (now - last) / 1000), t = now / 1000; last = now;
    if (kind === "matrix") {
      g.fillStyle = "rgba(2,10,4,.14)"; g.fillRect(0, 0, W, H); g.font = "15px Consolas, monospace";
      cols.forEach((c, i) => { c.y += c.s * dt * 22; const y = c.y * 16;
        g.fillStyle = "#c8ffd4"; g.fillText(KATA[(Math.random() * KATA.length) | 0], i * 16, y);
        g.fillStyle = "rgba(40,220,90,.75)"; g.fillText(KATA[(Math.random() * KATA.length) | 0], i * 16, y - 16);
        if (y > H && Math.random() > .975) c.y = 0; });
    } else if (kind === "warp") {
      g.fillStyle = "rgba(4,4,12,.35)"; g.fillRect(0, 0, W, H);
      const cx = W / 2 + (mouse.x > 0 ? (mouse.x - W / 2) * .08 : 0), cy = H / 2 + (mouse.y > 0 ? (mouse.y - H / 2) * .08 : 0), sp = .22 * dt;
      P.forEach(p => { const z0 = p.z; p.z -= sp; if (p.z <= .02) { p.x = (R() - .5) * 2; p.y = (R() - .5) * 2; p.z = 1; return; }
        const k0 = .5 / z0, k1 = .5 / p.z, x0 = cx + p.x * k0 * W * .5, y0 = cy + p.y * k0 * H * .5, x1 = cx + p.x * k1 * W * .5, y1 = cy + p.y * k1 * H * .5;
        g.strokeStyle = "rgba(" + (180 + (1 - p.z) * 75 | 0) + "," + (200 + (1 - p.z) * 55 | 0) + ",255," + (1 - p.z) + ")"; g.lineWidth = (1 - p.z) * 2.6;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
    } else if (kind === "bubbles") {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#052a3d"); gr.addColorStop(1, "#0b5c73"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      P.forEach(p => { p.y -= p.s * dt * (1 + p.r / 30); if (p.y < -.1) { p.y = 1.1; p.x = R(); }
        const x = p.x * W + Math.sin(t * .8 + p.p) * 14, y = p.y * H;
        const rg = g.createRadialGradient(x - p.r * .35, y - p.r * .35, p.r * .1, x, y, p.r); rg.addColorStop(0, "rgba(255,255,255,.35)"); rg.addColorStop(.6, "rgba(160,230,255,.08)"); rg.addColorStop(1, "rgba(200,245,255,.28)");
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, p.r, 0, 6.283); g.fill(); g.strokeStyle = "rgba(220,250,255,.35)"; g.lineWidth = 1; g.stroke(); });
    } else if (kind === "lava") {
      g.fillStyle = "#14060f"; g.fillRect(0, 0, W, H);
      g.filter = "blur(46px)";
      P.forEach((p, i) => { const x = (.5 + Math.sin(t * p.sx * 6 + p.p) * .38) * W, y = (.5 + Math.sin(t * p.sy * 6 + p.p * 2) * .4) * H, r = p.r * Math.min(W, H) * (1 + .15 * Math.sin(t * .7 + i));
        const rg = g.createRadialGradient(x, y, 0, x, y, r); const h = (300 + i * 17) % 360;
        rg.addColorStop(0, "hsla(" + h + ",78%,52%,.62)"); rg.addColorStop(1, "hsla(" + h + ",78%,45%,0)"); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); });
      g.filter = "none";
    } else if (kind === "net") {
      const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7); gr.addColorStop(0, "#151228"); gr.addColorStop(1, "#07060d"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      P.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; });
      const pts = P.concat(mouse.x > 0 ? [{ x:mouse.x, y:mouse.y, m:1 }] : []);
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy, lim = pts[j].m ? 30000 : 15000;
        if (d2 < lim) { g.strokeStyle = (pts[j].m ? acc : "#9aa6ff") + Math.round((1 - d2 / lim) * (pts[j].m ? 200 : 110)).toString(16).padStart(2, "0"); g.lineWidth = 1; g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[j].x, pts[j].y); g.stroke(); } }
      g.fillStyle = "#dfe3ff"; P.forEach(p => { g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 6.283); g.fill(); });
    } else if (kind === "petals") {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#2b1630"); gr.addColorStop(1, "#5a2a45"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      P.forEach(p => { p.y += p.s * dt; p.x += Math.sin(t * .6 + p.p) * .0008; p.r += p.vr * dt; if (p.y > 1.05) { p.y = -.05; p.x = R(); }
        const x = p.x * W, y = p.y * H; g.save(); g.translate(x, y); g.rotate(p.r); g.scale(1, .55 + .45 * Math.sin(t * 2 + p.p));
        g.fillStyle = "rgba(255,183,205,.9)"; g.beginPath(); g.moveTo(0, -p.w); g.bezierCurveTo(p.w, -p.w, p.w, p.w * .6, 0, p.w); g.bezierCurveTo(-p.w, p.w * .6, -p.w, -p.w, 0, -p.w); g.fill();
        g.fillStyle = "rgba(255,120,160,.5)"; g.beginPath(); g.arc(0, p.w * .4, p.w * .25, 0, 6.283); g.fill(); g.restore(); });
    }
    if (!still && !document.hidden) xl.raf = requestAnimationFrame(step); else xl.raf = 0;
  };
  xl.raf = requestAnimationFrame(step);
  xl.resume = () => { if (!xl.raf && !still) { last = performance.now(); xl.raf = requestAnimationFrame(step); } };
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && xl.cv && xl.resume) xl.resume(); });
const liveBg0 = liveBg;
liveBg = function () {
  const want = !PRIVATE && XL.some(x => x[0] === cfg.liveBg) ? cfg.liveBg : "";
  if (!want) { xlStop(); return liveBg0(); }
  const keep = cfg.liveBg; cfg.liveBg = ""; liveBg0(); cfg.liveBg = keep;     // the built-in one steps aside
  document.querySelectorAll("#liveSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === want));
  document.body.classList.add("pic");
  if (xl.kind === want && xl.cv) return;
  xlStop(); xlStart(want);
};
const applyCustom0 = applyCustom;
applyCustom = function () { applyCustom0(); try { xWidgets(); } catch (e) {} };
if (!PRIVATE) { xWidgets(); liveBg(); }
const E2 = ["ecosia", "Ecosia", "E", "!eco"], more = [E2, ["qwant", "Qwant", "Q", "!q"], ["kagi", "Kagi", "K", "!k"], ["yahoo", "Yahoo", "Y", "!y"], ["mojeek", "Mojeek", "Mj", "!mj"], ["yandex", "Yandex", "Ya", "!ya"],
  ["custom", String(cfg.xCustomName || "").trim().slice(0, 20) || "Your engine", "★", "!my"]];
more.forEach(x => { if (x[0] !== "custom" || /%s/.test(cfg.xCustomUrl || "")) ENGS.push(x); });
paintEng();
})();
