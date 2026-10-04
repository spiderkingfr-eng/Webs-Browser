/* Webs Browser - anime themes, for the iPhone app and the Windows browser. Each one is a whole look
   inspired by a popular show: colors for every page of the browser, a live wallpaper, and a card for
   the start page. Everything is drawn here, by code (shapes, gradients, particles): no characters,
   logos or artwork from the shows, which belong to their creators. They're fan-made looks, not
   official ones, and the picker says so.

   Anime.THEMES          [{ id, name, show, e, c:[bg, bg2, bg3, bg4, line, fg, dim, dim2], a (accent), amb (ambient sound), tag }]
   Anime.run(canvas, id) the live wallpaper on a canvas; returns { stop() }. About 30 frames a second,
                         looping forever; paused while the page is hidden or the canvas is off screen.
                         Animations off: one still frame. Reduce motion: a gentler version.
   Anime.preview(canvas, id)       one still frame
   Anime.card(el, id, opt)         the start page's card, with its own moving layer; call again to update the time
   Anime.picker(el, opt)           the tiles to choose one, each playing its wallpaper (opt: current, onPick(id))
   Anime.motion()                  0 still, 1 gentle, 2 full
   Anime.apply(settings, id, opt)  sets (or, with no id, undoes) the look in a settings object */
(function () {
"use strict";
const TAU = Math.PI * 2;
const THEMES = [
  { id:"bleach", name:"Soul Reaper", show:"Bleach", e:"🌙", a:"#ff6a1a", amb:"wind", tag:"Steel your spirit.",
    c:["#0b0b0f", "#131319", "#1b1b23", "#24242e", "#2a2a35", "#f4f4f7", "#a5a5b0", "#70707b"] },
  { id:"ghoul", name:"One-Eyed Ghoul", show:"Tokyo Ghoul", e:"🩸", a:"#e0193a", amb:"rain", tag:"Coffee first. Then the night.",
    c:["#0c0809", "#150d0f", "#1f1316", "#2a191d", "#351c22", "#f6eef0", "#b69ca2", "#82676d"] },
  { id:"slayer", name:"Wisteria Night", show:"Demon Slayer", e:"🌸", a:"#b58cff", amb:"wind", tag:"Breathe. Stay steady.",
    c:["#0c0d1b", "#131529", "#1b1d37", "#242645", "#2b2d4c", "#f0ebff", "#a9a4cb", "#76729b"] },
  { id:"jjk", name:"Cursed Energy", show:"Jujutsu Kaisen", e:"🌀", a:"#7f5cff", amb:"space", tag:"Expand your domain.",
    c:["#08070f", "#100e1c", "#18152a", "#211d39", "#282342", "#eeebff", "#9f98c9", "#6d6696"] },
  { id:"naruto", name:"Hidden Leaf", show:"Naruto", e:"🍃", a:"#ff8a1c", amb:"forest", tag:"Never go back on your word.",
    c:["#120d0a", "#1b140f", "#251b14", "#30231a", "#3a2a1e", "#fcf2e7", "#c3a88f", "#8f7863"] },
  { id:"aot", name:"Beyond the Walls", show:"Attack on Titan", e:"🪽", a:"#c9a26b", amb:"wind", tag:"The world outside is waiting.",
    c:["#0f100d", "#171913", "#20221a", "#2a2d22", "#33362a", "#eff1e7", "#a7ab97", "#777b6b"] },
  { id:"onepiece", name:"Grand Voyage", show:"One Piece", e:"🏴‍☠️", a:"#ffc531", amb:"waves", tag:"Set sail for the horizon.",
    c:["#071521", "#0c1e2e", "#12283c", "#18334b", "#1e3c57", "#eaf6ff", "#96b6cf", "#6a8aa3"] },
  { id:"deathnote", name:"Shinigami Notebook", show:"Death Note", e:"📓", a:"#d4102e", amb:"storm", tag:"Write today's plans down.",
    c:["#050505", "#0d0d0d", "#161616", "#1f1f1f", "#282828", "#f2f2f2", "#9d9d9d", "#6b6b6b"] },
  { id:"p5", name:"Phantom Thief", show:"Persona 5", e:"🎭", a:"#e60012", amb:"cafe", tag:"Steal back your time.",
    c:["#0a0a0a", "#141012", "#1e1518", "#291c20", "#341e24", "#ffffff", "#bba4a8", "#87696e"] }
];
const BY = {}; THEMES.forEach(t => { BY[t.id] = t; });

/* ---------------------------------------------------------------- drawing helpers */
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => gr.addColorStop(s[0], s[1])); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => gr.addColorStop(s[0], s[1])); return gr; };
const blob = (g, x, y, r, inner, outer) => { g.fillStyle = rad(g, x, y, 0, r, [[0, inner], [1, outer]]); g.fillRect(x - r, y - r, r * 2, r * 2); };
// an event that comes back every `per` seconds and lasts `len`: { p: 0..1, n: which time } or null
const ev = (t, per, len, off) => { const u = t + (off || 0), n = Math.floor(u / per), ph = u - n * per; return ph < len ? { p:ph / len, n } : null; };
const off = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const wrap = (v, m) => ((v % m) + m) % m;
// a soft, long wisp of cloud
function cloud(g, x, y, w, h, rgb, a) { g.save(); g.translate(x, y); g.scale(1, h / w); g.fillStyle = rad(g, 0, 0, 0, w, [[0, "rgba(" + rgb + "," + a + ")"], [.6, "rgba(" + rgb + "," + a * .5 + ")"], [1, "rgba(" + rgb + ",0)"]]); g.beginPath(); g.arc(0, 0, w, 0, TAU); g.fill(); g.restore(); }

/* ---------------------------------------------------------------- the live wallpapers */
const WALL = {};

/* Soul Reaper: a white desert under a crescent moon, black butterflies, and now and then the
   black-and-fire crescent of a swung blade sweeping the sky. */
WALL.bleach = {
  pt:33.5,
  init(W, H, R) {
    const S = { stars:Array.from({ length:150 }, () => ({ x:R(), y:R() * .62, r:R() * 1.2 + .2, p:R() * TAU })),
      flies:Array.from({ length:7 }, () => ({ cx:.1 + R() * .8, cy:.22 + R() * .45, ax:.06 + R() * .14, ay:.04 + R() * .08, fx:.05 + R() * .06, fy:.08 + R() * .07, p:R() * TAU, s:7 + R() * 7 })),
      motes:Array.from({ length:55 }, () => ({ x:R(), y:R(), s:.015 + R() * .04, p:R() * TAU, r:R() })) };
    const mr = S.mr = Math.min(W, H) * .14, mc = S.moon = off(mr * 2.6, mr * 2.6), m = mc.getContext("2d"), c = mc.width / 2;
    m.fillStyle = rad(m, c - mr * .2, c - mr * .2, mr * .1, mr, [[0, "#ffffff"], [1, "#dfe5f2"]]); m.beginPath(); m.arc(c, c, mr, 0, TAU); m.fill();
    m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(c - mr * .45, c - mr * .2, mr * .92, 0, TAU); m.fill();
    const tc = S.trees = off(W + 40, H), tg = tc.getContext("2d");
    tg.lineCap = "round"; tg.strokeStyle = "#eef0f6";
    const branch = (x, y, len, a, w, d) => {
      if (!d || len < 3) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      tg.lineWidth = w; tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo((x + x2) / 2 + (R() - .5) * len * .3, (y + y2) / 2, x2, y2); tg.stroke();
      const n = R() < .4 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(x2, y2, len * (.6 + R() * .2), a + (i - (n - 1) / 2) * (.45 + R() * .35), w * .64, d - 1);
    };
    [[.14, .855, 1], [.83, .895, .8], [.6, .92, .5], [.36, .93, .35]].forEach(([fx, fy, sc]) => branch(fx * W + 20, fy * H, H * .1 * sc, -Math.PI / 2 + (R() - .5) * .25, 6 * sc, 7));
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5;
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, "#02030a"], [.55, "#0c1121"], [1, "#1b2238"]]); g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    S.stars.forEach(s => { g.globalAlpha = .2 + .6 * Math.abs(Math.sin(t * .6 + s.p)); g.beginPath(); g.arc(s.x * W - px * 8, s.y * H - py * 6, s.r, 0, TAU); g.fill(); });
    g.globalAlpha = 1;
    const mx = W * .74 - px * 18, my = H * .25 - py * 12;
    blob(g, mx, my, S.mr * 3.4, "rgba(214,226,255,.24)", "rgba(214,226,255,0)");
    g.drawImage(S.moon, mx - S.moon.width / 2, my - S.moon.height / 2);
    const dune = (base, amp, fr, ph, fill, k) => {
      g.fillStyle = fill; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 16) g.lineTo(x, base * H + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.3 + ph * 1.7) * amp * .35 - px * k);
      g.lineTo(W, H); g.closePath(); g.fill();
    };
    dune(.75, H * .03, .004, 1, lin(g, 0, H * .68, 0, H, [[0, "#8a90a4"], [1, "#545a6e"]]), 10);
    g.drawImage(S.trees, -20 - px * 16, -py * 6);
    dune(.85, H * .025, .006, 3, lin(g, 0, H * .78, 0, H, [[0, "#dadeea"], [1, "#9aa0b3"]]), 22);
    g.globalCompositeOperation = "lighter";
    S.motes.forEach(p => { const y = (1 - wrap(p.y + t * p.s, 1)) * H, x = p.x * W + Math.sin(t * .8 + p.p) * 12; blob(g, x, y, 5 + p.r * 7, "rgba(140,190,255,.45)", "rgba(140,190,255,0)"); });
    g.globalCompositeOperation = "source-over";
    S.flies.forEach(f => {
      const a = t * f.fx * TAU * .5 + f.p, x = (f.cx + Math.sin(a) * f.ax) * W, y = (f.cy + Math.sin(t * f.fy * TAU * .5 + f.p * 1.3) * f.ay) * H;
      butterfly(g, x, y, f.s, .2 + .8 * Math.abs(Math.sin(t * 6.5 + f.p)), Math.cos(a) >= 0 ? 1 : -1);
    });
    const e = !m.gentle && ev(t, 11, 1.25);
    if (e) bladeWave(g, W, H, e.p, hash(e.n + 1));
  }
};
function butterfly(g, x, y, s, flap, dir) {
  g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(-.3);
  g.fillStyle = "#040406"; g.strokeStyle = "rgba(255,95,60,.6)"; g.lineWidth = .8;
  for (const side of [-1, 1]) {
    g.save(); g.scale(side * flap, 1);
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * .3, -s * 1.4, s * 1.6, -s * 1.2, s * 1.15, -s * .1); g.bezierCurveTo(s, s * .2, s * .4, s * .12, 0, 0); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * .55, s * .2, s * .95, s * .85, s * .45, s * 1.05); g.bezierCurveTo(s * .2, s * .95, s * .05, s * .5, 0, 0); g.fill(); g.stroke();
    g.restore();
  }
  g.lineWidth = 1.6; g.strokeStyle = "#040406"; g.beginPath(); g.moveTo(0, -s * .35); g.lineTo(0, s * .65); g.stroke();
  g.restore();
}
function bladeWave(g, W, H, p, h) {
  // a crescent that sweeps across: thickest in the middle, sharp at both ends, black with a burning edge
  const cx = W * (.15 + h * .7), cy = H * (1.3 + h * .25), R0 = Math.max(W, H) * (.8 + h * .2), T = Math.min(W, H) * (.07 + h * .03);
  const a0 = -Math.PI * (.92 - h * .12), span = Math.PI * .6, head = a0 + span * Math.min(1, p * 1.7), tail = a0 + span * Math.max(0, p * 1.7 - .55);
  if (head - tail < .02) return;
  const N = 40, out = [], inn = [];
  for (let i = 0; i <= N; i++) { const u = i / N, a = tail + (head - tail) * u, th = T * Math.pow(Math.sin(Math.PI * u), .8) * (.6 + .4 * u);
    out.push([cx + Math.cos(a) * R0, cy + Math.sin(a) * R0]); inn.push([cx + Math.cos(a) * (R0 - th), cy + Math.sin(a) * (R0 - th)]); }
  const shape = () => { g.beginPath(); out.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); for (let i = N; i >= 0; i--) g.lineTo(inn[i][0], inn[i][1]); g.closePath(); };
  g.save(); g.globalAlpha = p < .7 ? 1 : 1 - (p - .7) / .3;
  shape(); g.shadowColor = "rgba(255,70,15,.95)"; g.shadowBlur = 40; g.fillStyle = "#070208"; g.fill();
  g.shadowBlur = 0; g.lineWidth = 2.5; g.strokeStyle = "#ff5f1f"; g.stroke();
  g.lineWidth = 1.2; g.strokeStyle = "rgba(255,225,190,.95)"; g.beginPath(); out.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
  g.restore();
}

/* One-Eyed Ghoul: a red moon over a rainy city, and red, living tendrils curling up from a corner. */
WALL.ghoul = {
  pt:4.2,
  init(W, H, R) {
    const S = { rain:Array.from({ length:260 }, () => ({ x:R(), y:R(), s:.8 + R() * .8, l:.5 + R() })),
      tend:Array.from({ length:5 }, (_, i) => ({ a:-1.95 - i * .2 + (R() - .5) * .12, len:.5 + R() * .35, p:R() * TAU, w:20 + R() * 16 })) };
    S.city = [0, 1].map(layer => {
      const c = off(W + 80, H), x = c.getContext("2d");
      for (let px = 0; px < W + 80;) {
        const w = 26 + R() * 70, h = H * (layer ? .14 + R() * .2 : .24 + R() * .3);
        x.fillStyle = layer ? "#080304" : "#1a0b10"; x.fillRect(px, H - h, w, h);
        if (!layer && R() < .3) x.fillRect(px + w * .4, H - h - 18, 3, 18);
        for (let wy = H - h + 8; wy < H - 6; wy += 12) for (let wx = px + 5; wx < px + w - 6; wx += 9)
          if (R() < (layer ? .09 : .05)) { x.fillStyle = R() < .3 ? "rgba(255,40,64,.8)" : "rgba(255,190,120,.55)"; x.fillRect(wx, wy, 4, 6); }
        px += w + (R() * 5 | 0);
      }
      return c;
    });
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5;
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, "#060203"], [.6, "#1b0609"], [1, "#3c0a13"]]); g.fillRect(0, 0, W, H);
    const mx = W * .27 - px * 10, my = H * .3 - py * 8, mr = Math.min(W, H) * .12;
    blob(g, mx, my, mr * 3.6, "rgba(255,30,55,.32)", "rgba(255,30,55,0)");
    g.fillStyle = rad(g, mx - mr * .3, my - mr * .3, mr * .1, mr, [[0, "#ff6b78"], [.75, "#c90f2e"], [1, "#8a0019"]]); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) cloud(g, wrap(t * 10 * (i + 1) + i * 420, W + 700) - 350, my + mr * (i * .45 - .2), mr * 2.2, mr * .3, "10,2,4", .6);
    g.drawImage(S.city[0], -40 - px * 14, 0);
    g.drawImage(S.city[1], -40 - px * 30, 0);
    tendrils(g, W, H, t, S, px);
    g.strokeStyle = "rgba(210,195,205,.2)"; g.lineWidth = 1; g.beginPath();
    S.rain.forEach(r => { const y = wrap(r.y + t * r.s * .9, 1.1) * H - .05 * H, x = wrap(r.x * W - y * .18, W), l = 10 + r.l * 16; g.moveTo(x, y); g.lineTo(x - l * .18, y + l); });
    g.stroke();
    const e = !m.gentle && ev(t, 13, .55, 4);
    if (e) { g.fillStyle = "rgba(255,225,232," + (.2 * (1 - e.p) * (e.p < .15 || e.p > .35 ? 1 : .35)) + ")"; g.fillRect(0, 0, W, H); }
  }
};
function tendrils(g, W, H, t, S, px) {
  const ox = W * 1.03 - px * 20, oy = H * 1.05, U = Math.min(W, H);
  S.tend.forEach(k => {
    const N = 34, L = U * k.len * 1.3, pts = [];
    let x = ox, y = oy;
    for (let j = 0; j <= N; j++) {
      const f = j / N, a = k.a + Math.sin(t * .9 + k.p + f * 3.2) * .38 * f + Math.sin(t * 1.8 + k.p * 2 + f * 7) * .07 * f + f * f * .9 * Math.sin(k.p);
      pts.push([x, y, a, k.w * Math.pow(1 - f, .85) + 1.2]);
      x += Math.cos(a) * L / N; y += Math.sin(a) * L / N;
    }
    const outline = sc => { g.beginPath(); pts.forEach((p, i) => { const nx = -Math.sin(p[2]) * p[3] * sc, ny = Math.cos(p[2]) * p[3] * sc; i ? g.lineTo(p[0] + nx, p[1] + ny) : g.moveTo(p[0] + nx, p[1] + ny); });
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], nx = -Math.sin(p[2]) * p[3] * sc, ny = Math.cos(p[2]) * p[3] * sc; g.lineTo(p[0] - nx, p[1] - ny); } g.closePath(); };
    const tip = pts[pts.length - 1];
    g.globalCompositeOperation = "lighter"; outline(2.2); g.fillStyle = "rgba(255,20,50,.1)"; g.fill(); g.globalCompositeOperation = "source-over";
    outline(1); g.fillStyle = lin(g, ox, oy, tip[0], tip[1], [[0, "#3a000a"], [.5, "#9e0a24"], [1, "#ff2a48"]]); g.fill();
    g.globalCompositeOperation = "lighter"; g.strokeStyle = "rgba(255,90,110,.55)"; g.lineWidth = 1.5; g.beginPath();
    pts.forEach((p, i) => { if (i % 4 === 2 && i < N - 2) { const nx = -Math.sin(p[2]) * p[3] * .7, ny = Math.cos(p[2]) * p[3] * .7; g.moveTo(p[0] + nx, p[1] + ny); g.quadraticCurveTo(p[0] + Math.cos(p[2]) * 6, p[1] + Math.sin(p[2]) * 6, p[0] - nx, p[1] - ny); } });
    g.stroke(); g.globalCompositeOperation = "source-over";
  });
}

/* Wisteria Night: wisteria hanging from the top of the screen, petals falling, a full moon, and the
   wave pattern of old Japanese prints drifting along the bottom. */
WALL.slayer = {
  pt:6,
  init(W, H, R) {
    const S = { petals:Array.from({ length:70 }, () => ({ x:R(), y:R(), s:.025 + R() * .05, r:R() * TAU, vr:(R() - .5) * 2, w:2.5 + R() * 3.5, p:R() * TAU, c:R() })), vines:[] };
    const n = Math.ceil(W / 60) + 1;
    for (let i = 0; i < n; i++) {
      const len = H * (.14 + R() * .2), cnt = 26 + (R() * 14 | 0), fl = [];
      for (let j = 0; j < cnt; j++) { const f = j / cnt; fl.push({ f, dx:(R() - .5) * (1 - f * .7) * 24, r:(1 - f * .72) * (4 + R() * 2.4), c:R() }); }
      S.vines.push({ x:(i + (R() - .5) * .5) / (n - 1), len, fl, p:R() * TAU });
    }
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5;
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, "#070919"], [.6, "#141a3d"], [1, "#212a5c"]]); g.fillRect(0, 0, W, H);
    const mx = W * .52 - px * 12, my = H * .4 - py * 8, mr = Math.min(W, H) * .15;
    blob(g, mx, my, mr * 3.2, "rgba(255,240,205,.22)", "rgba(255,240,205,0)");
    g.fillStyle = rad(g, mx - mr * .3, my - mr * .3, mr * .1, mr, [[0, "#fffbea"], [1, "#efdfb2"]]); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) cloud(g, wrap(t * 7 * (i + 1) + i * 380, W + 700) - 350, my + mr * (.15 + i * .38), mr * 1.9, mr * .26, "14,18,48", .65);
    seigaiha(g, W, H, t, px, S);
    g.fillStyle = "#16241a"; g.fillRect(0, 0, W, 5);
    S.vines.forEach(v => {
      const x0 = v.x * W - px * 20, sway = Math.sin(t * .7 + v.p);
      g.fillStyle = "#2b4f33"; g.beginPath(); g.ellipse(x0 - 9, 9, 15, 5, -.45, 0, TAU); g.ellipse(x0 + 10, 11, 14, 4.5, .5, 0, TAU); g.fill();
      v.fl.forEach(fl => {
        const y = 8 + fl.f * v.len, x = x0 + fl.dx * (1 - fl.f * .4) + sway * Math.pow(fl.f, 1.6) * 16;
        const r = 190 - fl.f * 70 + fl.c * 30, gg = 150 - fl.f * 80 + fl.c * 30;
        g.fillStyle = "rgba(" + (r | 0) + "," + (gg | 0) + ",255,.93)"; g.beginPath(); g.ellipse(x, y, fl.r, fl.r * .78, 0, 0, TAU); g.fill();
        if (fl.c > .7) { g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(x - fl.r * .3, y - fl.r * .3, fl.r * .3, 0, TAU); g.fill(); }
      });
    });
    S.petals.forEach(p => {
      const y = wrap(p.y + t * p.s, 1.1) * H - .05 * H, x = wrap(p.x * W + Math.sin(t * .7 + p.p) * 30 + t * 6, W);
      g.save(); g.translate(x, y); g.rotate(p.r + t * p.vr); g.scale(1, .5 + .5 * Math.abs(Math.sin(t * 1.5 + p.p)));
      g.fillStyle = p.c < .5 ? "rgba(205,175,255,.85)" : "rgba(240,225,255,.8)"; g.beginPath(); g.ellipse(0, 0, p.w, p.w * .55, 0, 0, TAU); g.fill(); g.restore();
    });
  }
};
// the wave pattern is drawn once, a little wider than the screen, and slides along
function seigaiha(g, W, H, t, px, S) {
  const top = H * .82, r = Math.max(20, Math.min(W, H) / 22), shift = wrap(t * 9 - px * 24, r * 2);
  if (!S.sei || S.sei.w !== W || S.sei.h !== H) {
    const c = off(W + r * 4, H - top), x = c.getContext("2d"), hh = c.height;
    x.fillStyle = "#14275f"; x.fillRect(0, 0, c.width, hh); x.lineWidth = 1.4;
    for (let row = 0, y = -r * .6; y < hh + r; row++, y += r * .5)
      for (let cx = (row % 2 ? r : 0); cx < c.width + r * 2; cx += r * 2) {
        x.beginPath(); x.arc(cx, y + r, r, Math.PI, 0); x.closePath(); x.fillStyle = row % 3 === 1 ? "#1d3a8a" : "#183170"; x.fill();
        x.strokeStyle = "rgba(232,238,255,.85)";
        for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(cx, y + r, r * k / 4, Math.PI, 0); x.stroke(); }
      }
    x.fillStyle = lin(x, 0, 0, 0, r * 2, [[0, "rgba(10,12,40,.7)"], [1, "rgba(10,12,40,0)"]]); x.fillRect(0, 0, c.width, r * 2);
    S.sei = { c, w:W, h:H };
  }
  g.drawImage(S.sei.c, -shift - r * 2, top);
}

/* Cursed Energy: a void with a slowly turning ring, blue-violet flames rising, a blue and a red light
   circling until they meet in a violet burst, and jagged black lightning edged in red. */
WALL.jjk = {
  pt:42.22,
  init(W, H, R) {
    return { flames:Array.from({ length:110 }, () => ({ x:R(), s:.05 + R() * .1, p:R() * TAU, r:6 + R() * 12, h:R() })),
      ticks:Array.from({ length:60 }, (_, i) => ({ a:i / 60 * TAU, l:4 + R() * 14, k:R() })),
      stars:Array.from({ length:90 }, () => ({ x:R(), y:R(), r:R() * 1.1 + .2, p:R() * TAU })) };
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5, cx = W / 2 - px * 14, cy = H * .46 - py * 10, rr = Math.min(W, H) * .34;
    g.fillStyle = rad(g, cx, cy, 0, Math.max(W, H) * .75, [[0, "#1d1240"], [.55, "#0b0718"], [1, "#030206"]]); g.fillRect(0, 0, W, H);
    g.fillStyle = "#cfc8ff"; S.stars.forEach(s => { g.globalAlpha = .15 + .45 * Math.abs(Math.sin(t * .5 + s.p)); g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, TAU); g.fill(); }); g.globalAlpha = 1;
    g.strokeStyle = "rgba(170,140,255,.32)"; g.lineWidth = 1.2;
    g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, rr * 1.12, 0, TAU); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(t * .05);
    S.ticks.forEach(k => { g.save(); g.rotate(k.a); g.beginPath(); g.moveTo(rr * 1.015, 0); g.lineTo(rr * 1.015 + k.l, 0); if (k.k > .55) { g.moveTo(rr * 1.06, -4); g.lineTo(rr * 1.06, 4); } g.stroke(); g.restore(); });
    g.rotate(-t * .12); g.setLineDash([2, 10]); g.beginPath(); g.arc(0, 0, rr * .82, 0, TAU); g.stroke(); g.setLineDash([]);
    g.restore();
    g.globalCompositeOperation = "lighter";
    S.flames.forEach(f => {
      const ph = wrap(t * f.s + f.h, 1), y = H * (1.06 - ph * 1.1), x = f.x * W + Math.sin(t * 1.3 + f.p) * 22 * ph, r = f.r * (1.1 - ph);
      const c = f.h < .5 ? [90, 110, 255] : [165, 80, 255], a = (1 - ph) * .5;
      g.save(); g.translate(x, y); g.scale(1, 1.7);
      g.fillStyle = rad(g, 0, 0, 0, r, [[0, "rgba(" + c + "," + a + ")"], [1, "rgba(" + c + ",0)"]]); g.fillRect(-r, -r, r * 2, r * 2); g.restore();
    });
    const per = 16, ph = wrap(t, per), orbit = rr * .55 * (m.gentle || ph < 13 ? 1 : ph < 14.5 ? 1 - (ph - 13) / 1.5 : 0), ang = t * .9;
    if (m.gentle || ph < 14.5) {
      const bx = cx + Math.cos(ang) * orbit, by = cy + Math.sin(ang) * orbit * .55, qx = cx - Math.cos(ang) * orbit, qy = cy - Math.sin(ang) * orbit * .55;
      blob(g, bx, by, 46, "rgba(80,150,255,.85)", "rgba(80,150,255,0)"); blob(g, bx, by, 12, "rgba(230,245,255,1)", "rgba(200,230,255,0)");
      blob(g, qx, qy, 46, "rgba(255,50,70,.85)", "rgba(255,50,70,0)"); blob(g, qx, qy, 12, "rgba(255,235,235,1)", "rgba(255,200,200,0)");
    } else {
      const p = (ph - 14.5) / 1.5, rad0 = p * Math.max(W, H) * .9;
      blob(g, cx, cy, 30 + p * 220, "rgba(190,110,255," + (.9 * (1 - p)) + ")", "rgba(150,60,255,0)");
      g.strokeStyle = "rgba(200,150,255," + (.8 * (1 - p)) + ")"; g.lineWidth = 6 * (1 - p) + 1; g.beginPath(); g.arc(cx, cy, rad0, 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = "source-over";
    const e = !m.gentle && ev(t, 9, .5, 3);
    if (e) blackFlash(g, W, H, e.p, e.n);
  }
};
function blackFlash(g, W, H, p, n) {
  const R = rng(n * 7919 + 13), x0 = W * (.2 + R() * .6), y0 = H * (.25 + R() * .5), a = (1 - p) * (p < .1 ? p * 10 : 1);
  const bolt = (x, y, ang, len, w, d) => {
    const pts = [[x, y]];
    for (let i = 0; i < 12; i++) { ang += (R() - .5) * 1.5; x += Math.cos(ang) * len / 12; y += Math.sin(ang) * len / 12; pts.push([x, y]); }
    const path = () => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); };
    g.globalCompositeOperation = "lighter"; path(); g.strokeStyle = "rgba(255,20,50," + a * .22 + ")"; g.lineWidth = w * 6; g.stroke();
    path(); g.strokeStyle = "rgba(255,50,80," + a + ")"; g.lineWidth = w * 2; g.stroke(); g.globalCompositeOperation = "source-over";
    path(); g.strokeStyle = "rgba(0,0,0," + Math.min(1, a * 2) + ")"; g.lineWidth = w * 1.55; g.stroke();
    if (d) for (let i = 0; i < 2; i++) { const q = pts[3 + (R() * 7 | 0)]; bolt(q[0], q[1], ang + (R() - .5) * 2.4, len * .45, w * .6, d - 1); }
  };
  g.lineJoin = "round"; g.lineCap = "round";
  for (let i = 0; i < 4; i++) bolt(x0, y0, i * TAU / 4 + R(), Math.min(W, H) * .34, 6, 1);
  g.globalCompositeOperation = "lighter"; blob(g, x0, y0, 90, "rgba(255,40,60," + a * .6 + ")", "rgba(255,40,60,0)"); g.globalCompositeOperation = "source-over";
  g.lineCap = "butt";
}

/* Hidden Leaf: a forest at sunset with green leaves blowing through, and now and then a whirl of them. */
WALL.naruto = {
  pt:7.6,
  init(W, H, R) {
    const S = { leaves:Array.from({ length:42 }, () => ({ x:R(), y:R(), s:.04 + R() * .06, p:R() * TAU, r:R() * TAU, vr:(R() - .5) * 3, w:5 + R() * 6, c:R() })),
      birds:Array.from({ length:6 }, () => ({ x:R(), y:.12 + R() * .25, s:.01 + R() * .015, p:R() * TAU })) };
    S.hills = [0, 1].map(k => { const c = off(W + 80, H), x = c.getContext("2d"); x.fillStyle = k ? "#3a2240" : "#5a2f4c"; x.beginPath(); x.moveTo(0, H);
      for (let px = 0; px <= W + 80; px += 30) x.lineTo(px, H * (k ? .6 : .52) - Math.abs(Math.sin(px * .004 + k * 2)) * H * (k ? .08 : .14) - R() * H * .015); x.lineTo(W + 80, H); x.fill(); return c; });
    const fc = S.forest = off(W + 80, H), f = fc.getContext("2d");
    for (let px = -20; px < W + 100; px += 14 + R() * 22) {
      const h = H * (.18 + R() * .2), base = H * (.98 - R() * .05), w = 22 + R() * 26;
      f.fillStyle = R() < .5 ? "#0f1a0c" : "#13200f";
      for (let k = 0; k < 4; k++) { const ty = base - h * (k / 4) - h * .2, tw = w * (1 - k * .2); f.beginPath(); f.moveTo(px - tw / 2, ty + h * .3); f.lineTo(px, ty - h * .15); f.lineTo(px + tw / 2, ty + h * .3); f.fill(); }
      f.fillRect(px - 2, base - h * .2, 4, h * .25);
    }
    f.fillStyle = "#0c1509"; f.fillRect(0, H * .97, W + 80, H * .03);
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5;
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, "#26163f"], [.42, "#a8403c"], [.72, "#f2873a"], [1, "#ffc466"]]); g.fillRect(0, 0, W, H);
    const sx = W * .64 - px * 10, sy = H * .66 - py * 6, sr = Math.min(W, H) * .1;
    blob(g, sx, sy, sr * 4, "rgba(255,190,90,.45)", "rgba(255,150,60,0)");
    g.fillStyle = rad(g, sx, sy, 0, sr, [[0, "#fff4c8"], [1, "#ffb347"]]); g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    g.drawImage(S.hills[0], -40 - px * 8, 0); g.drawImage(S.hills[1], -40 - px * 14, 0);
    g.strokeStyle = "rgba(30,15,30,.7)"; g.lineWidth = 1.6;
    S.birds.forEach(b => { const x = wrap(b.x + t * b.s, 1.1) * W - .05 * W, y = b.y * H + Math.sin(t + b.p) * 6, f = Math.sin(t * 6 + b.p) * 4; g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 2, x, y); g.quadraticCurveTo(x + 3, y - 2, x + 7, y - f); g.stroke(); });
    g.drawImage(S.forest, -40 - px * 26, 0);
    S.leaves.forEach(l => leaf(g, wrap(l.x + t * l.s, 1.2) * W - .1 * W, l.y * H + Math.sin(t * 1.2 + l.p) * 40, l.r + t * l.vr, l.w, l.c));
    const e = ev(t, 12, 3.2, 2);
    if (e) {
      const cx = W * (.2 + hash(e.n) * .6) + e.p * W * .15, cy = H * (.75 - e.p * .4);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + e.p * 9, r = 20 + e.p * 120 + i * 3, al = e.p < .8 ? 1 : (1 - e.p) / .2;
        g.globalAlpha = al; leaf(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .5, a + 1.5, 7, i / 16); }
      g.globalAlpha = 1;
    }
  }
};
function leaf(g, x, y, r, w, c) {
  g.save(); g.translate(x, y); g.rotate(r);
  g.fillStyle = c < .33 ? "#5fbf3f" : c < .66 ? "#8bd65a" : "#3f9a35";
  g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(0, -w * .7, w, 0); g.quadraticCurveTo(0, w * .7, -w, 0); g.fill();
  g.strokeStyle = "rgba(20,60,15,.6)"; g.lineWidth = .8; g.beginPath(); g.moveTo(-w, 0); g.lineTo(w, 0); g.stroke();
  g.restore();
}

/* Beyond the Walls: a towering stone wall against a burning dusk, steam rising behind it, birds
   flying out, and now and then the thin cables of someone swinging over the top. */
WALL.aot = {
  pt:4.7,
  init(W, H, R) {
    const S = { top:H * .62, src:Array.from({ length:5 }, () => ({ x:.08 + R() * .84, p:R() })), dust:Array.from({ length:50 }, () => ({ x:R(), y:R(), s:.01 + R() * .02, p:R() * TAU })) };
    const wc = S.wall = off(W + 80, H - S.top + 30), w = wc.getContext("2d"), wh = wc.height;
    w.fillStyle = lin(w, 0, 0, 0, wh, [[0, "#4a443c"], [.3, "#2f2b26"], [1, "#16140f"]]); w.fillRect(0, 22, wc.width, wh);
    w.strokeStyle = "rgba(0,0,0,.35)"; w.lineWidth = 1;
    for (let y = 40, row = 0; y < wh; y += 22, row++) { w.beginPath(); w.moveTo(0, y); w.lineTo(wc.width, y); w.stroke(); for (let x = (row % 2) * 30; x < wc.width; x += 60) { w.beginPath(); w.moveTo(x, y); w.lineTo(x, y + 22); w.stroke(); } }
    w.fillStyle = "rgba(255,190,120,.12)"; w.fillRect(0, 22, wc.width, 3);
    w.fillStyle = "#3c372f"; w.fillRect(0, 14, wc.width, 10);
    for (let x = 30; x < wc.width; x += 140 + R() * 120) { w.fillStyle = "#2a2621"; w.fillRect(x, 0, 22, 18); w.fillRect(x + 8, -4, 6, 6); }
    for (let x = 0; x < wc.width; x += 9 + R() * 14) if (R() < .5) { w.fillStyle = "rgba(0,0,0,.25)"; w.fillRect(x, 24 + R() * wh * .6, 2 + R() * 3, 6 + R() * 30); }
    // a town at its foot, tiny next to it
    const tc = S.town = off(W + 80, H * .2), tw = tc.getContext("2d"), th = tc.height;
    for (let x = 0; x < tc.width;) {
      const bw = 14 + R() * 26, bh = th * (.25 + R() * .45), roof = 6 + R() * 10;
      tw.fillStyle = "#0d0b09"; tw.fillRect(x, th - bh, bw, bh); tw.beginPath(); tw.moveTo(x - 2, th - bh); tw.lineTo(x + bw / 2, th - bh - roof); tw.lineTo(x + bw + 2, th - bh); tw.fill();
      if (R() < .12) { tw.fillRect(x + bw / 2 - 3, th - bh - roof - 22, 6, 24); tw.beginPath(); tw.moveTo(x + bw / 2 - 5, th - bh - roof - 22); tw.lineTo(x + bw / 2, th - bh - roof - 34); tw.lineTo(x + bw / 2 + 5, th - bh - roof - 22); tw.fill(); }
      for (let k = 0; k < 2; k++) if (R() < .5) { tw.fillStyle = "rgba(255,180,90,.75)"; tw.fillRect(x + 3 + R() * (bw - 8), th - bh + 4 + R() * (bh - 10), 3, 4); }
      x += bw + R() * 4;
    }
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5, top = S.top - py * 6;
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, "#121624"], [.42, "#55271f"], [.62, "#c4562a"], [1, "#e88a42"]]); g.fillRect(0, 0, W, H);
    blob(g, W * .5 - px * 10, top, Math.max(W, H) * .55, "rgba(255,170,90,.4)", "rgba(255,120,60,0)");
    const sr = Math.min(W, H) * .16; g.fillStyle = rad(g, W * .5 - px * 10, top, 0, sr, [[0, "#fff1c8"], [.6, "#ffb45a"], [1, "rgba(255,140,60,0)"]]); g.beginPath(); g.arc(W * .5 - px * 10, top, sr, 0, TAU); g.fill();
    S.src.forEach((s, i) => {
      for (let k = 0; k < 6; k++) {
        const ph = wrap(t * .04 + k / 6 + s.p, 1), y = top - ph * H * .6, r = 30 + ph * 170, a = .34 * (1 - ph) * Math.min(1, ph * 6);
        blob(g, s.x * W + Math.sin(t * .3 + k + i) * 34 * ph - px * 12, y, r, "rgba(255,226,206," + a + ")", "rgba(255,210,190,0)");
      }
    });
    const e = ev(t, 18, 10, 3);
    if (e) { g.strokeStyle = "rgba(20,12,10,.8)"; g.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) { const k = Math.abs(i - 4), x = W * (1.05 - e.p * 1.15) + k * 22, y = H * (.3 + hash(e.n) * .15) + k * 12 + Math.sin(t * 2 + i) * 3, f = Math.sin(t * 7 + i) * 4;
        g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 2, x, y); g.quadraticCurveTo(x + 3, y - 2, x + 7, y - f); g.stroke(); } }
    const c = ev(t, 7, 1.3, 1);
    if (c) {
      const sx = W * (.15 + hash(c.n + 3) * .5), ex = sx + W * .3, ey = top - H * .28, p = c.p, cpx = (sx + ex) / 2, cpy = ey - H * .1;
      const q = u => [(1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cpx + u * u * ex, (1 - u) * (1 - u) * (top + 6) + 2 * (1 - u) * u * cpy + u * u * ey];
      const [fx, fy] = q(Math.min(1, p * 1.2));
      g.strokeStyle = "rgba(30,25,22,.85)"; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, top + 6); g.lineTo(fx, fy); g.moveTo(sx + 10, top + 6); g.lineTo(fx, fy); g.stroke();
      for (let k = 1; k < 8; k++) { const [tx, ty] = q(Math.max(0, Math.min(1, p * 1.2) - k * .04)); blob(g, tx, ty, 6 + k * 2, "rgba(240,235,230," + (.35 - k * .04) + ")", "rgba(240,235,230,0)"); }
      g.fillStyle = "#1a1512"; g.beginPath(); g.ellipse(fx, fy, 3, 5, .4, 0, TAU); g.fill();
    }
    g.drawImage(S.wall, -40 - px * 16, top - 22);
    g.drawImage(S.town, -40 - px * 34, H - S.town.height + 2);
    g.fillStyle = "rgba(255,200,150,.5)";
    S.dust.forEach(d => { const x = wrap(d.x + t * d.s, 1) * W, y = d.y * top + Math.sin(t + d.p) * 8; g.fillRect(x, y, 1.5, 1.5); });
  }
};

/* Grand Voyage: a bright sea with a little ship riding the waves, clouds, gulls and a sparkling sun. */
WALL.onepiece = {
  pt:5,
  init(W, H, R) {
    const S = { hz:H * .6, clouds:Array.from({ length:6 }, () => ({ x:R(), y:.08 + R() * .3, s:.004 + R() * .008, k:.6 + R() * .8, puffs:Array.from({ length:7 }, () => [(R() - .5) * 2, (R() - .5) * .6, .4 + R() * .6]) })),
      gulls:Array.from({ length:5 }, () => ({ x:R(), y:.15 + R() * .3, s:.008 + R() * .012, p:R() * TAU })),
      glints:Array.from({ length:70 }, () => ({ x:R(), y:R(), p:R() * TAU, s:1 + R() * 2 })) };
    const sc = S.ship = off(150, 150), s = sc.getContext("2d");
    s.fillStyle = "#6b3e1f"; s.beginPath(); s.moveTo(10, 100); s.lineTo(140, 100); s.lineTo(122, 128); s.lineTo(28, 128); s.closePath(); s.fill();
    s.fillStyle = "#8a5228"; s.fillRect(14, 98, 124, 6); s.fillStyle = "#4e2c15"; for (let x = 36; x < 120; x += 16) { s.beginPath(); s.arc(x, 112, 3, 0, TAU); s.fill(); }
    s.fillStyle = "#3a2312"; s.fillRect(72, 18, 4, 84); s.fillRect(110, 42, 3, 58);
    s.fillStyle = "#fbf6ea"; s.beginPath(); s.moveTo(78, 22); s.quadraticCurveTo(116, 46, 78, 84); s.closePath(); s.fill();
    s.beginPath(); s.moveTo(70, 26); s.quadraticCurveTo(34, 52, 70, 86); s.closePath(); s.fill();
    s.beginPath(); s.moveTo(114, 46); s.quadraticCurveTo(136, 62, 114, 88); s.closePath(); s.fill();
    s.fillStyle = "#f2a91c"; s.beginPath(); s.arc(96, 54, 9, 0, TAU); s.fill();
    s.strokeStyle = "#f2a91c"; s.lineWidth = 2; for (let a = 0; a < TAU; a += TAU / 8) { s.beginPath(); s.moveTo(96 + Math.cos(a) * 12, 54 + Math.sin(a) * 12); s.lineTo(96 + Math.cos(a) * 16, 54 + Math.sin(a) * 16); s.stroke(); }
    s.fillStyle = "#e3342b"; s.beginPath(); s.moveTo(76, 12); s.lineTo(98, 16); s.lineTo(76, 21); s.fill();
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, hz = S.hz;
    g.fillStyle = lin(g, 0, 0, 0, hz, [[0, "#2a86e0"], [.65, "#83c9ff"], [1, "#d7f0ff"]]); g.fillRect(0, 0, W, hz);
    const sx = W * .18 - px * 10, sy = H * .16;
    g.globalCompositeOperation = "lighter";
    g.save(); g.translate(sx, sy); g.rotate(t * .04);
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = "rgba(255,250,210,.08)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H), -60); g.lineTo(Math.max(W, H), 60); g.fill(); }
    g.restore();
    blob(g, sx, sy, 140, "rgba(255,250,220,.9)", "rgba(255,240,180,0)");
    g.globalCompositeOperation = "source-over";
    S.clouds.forEach(c => {
      const cx = wrap(c.x + t * c.s, 1.4) * W - .2 * W - px * 20, cy = c.y * H, u = Math.min(W, H) * .07 * c.k;
      c.puffs.forEach(p => { g.fillStyle = "rgba(220,235,250,.95)"; g.beginPath(); g.arc(cx + p[0] * u * 1.8, cy + p[1] * u + u * .15, u * p[2] * 1.05, 0, TAU); g.fill(); });
      c.puffs.forEach(p => { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx + p[0] * u * 1.8, cy + p[1] * u, u * p[2], 0, TAU); g.fill(); });
    });
    g.strokeStyle = "rgba(40,50,70,.75)"; g.lineWidth = 1.6;
    S.gulls.forEach(b => { const x = wrap(b.x - t * b.s, 1.1) * W, y = b.y * H + Math.sin(t * .8 + b.p) * 8, f = 3 + Math.sin(t * 3 + b.p) * 3; g.beginPath(); g.moveTo(x - 9, y - f); g.quadraticCurveTo(x - 4, y - 3, x, y); g.quadraticCurveTo(x + 4, y - 3, x + 9, y - f); g.stroke(); });
    g.fillStyle = lin(g, 0, hz, 0, H, [[0, "#3aa0e0"], [.4, "#1c6fb8"], [1, "#0a3a6e"]]); g.fillRect(0, hz, W, H - hz);
    for (let r = 0; r < 12; r++) {
      const f = r / 11, y = hz + Math.pow(f, 1.7) * (H - hz), amp = 1 + f * 7, len = 40 + f * 140;
      g.strokeStyle = "rgba(235,248,255," + (.25 + f * .3) + ")"; g.lineWidth = .8 + f * 1.8; g.beginPath();
      for (let x = -len; x < W + len; x += len) { const ox = wrap(t * (8 + f * 30) * (r % 2 ? 1 : -1) + r * 50, len); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + len * .25, y - amp, x + ox + len * .5, y); }
      g.stroke();
    }
    g.globalCompositeOperation = "lighter";
    S.glints.forEach(s => { const a = Math.max(0, Math.sin(t * s.s + s.p)); if (a < .6) return; const x = s.x * W, y = hz + Math.pow(s.y, 1.5) * (H - hz); g.fillStyle = "rgba(255,255,240," + (a - .6) * 2 + ")"; g.fillRect(x - 3, y, 6, 1); g.fillRect(x, y - 3, 1, 6); });
    g.globalCompositeOperation = "source-over";
    const shx = W * .42 + Math.sin(t * .05) * W * .06 - px * 30, shy = hz + (H - hz) * .3 + Math.sin(t * 1.2) * 4, k = Math.min(1.4, Math.max(.7, W / 1100));
    g.save(); g.translate(shx, shy); g.rotate(Math.sin(t * 1.1) * .045); g.scale(k, k); g.drawImage(S.ship, -75, -122); g.restore();
    g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(shx - 70 * k, shy + 6); g.quadraticCurveTo(shx, shy + 12, shx + 70 * k, shy + 6); g.stroke();
  }
};

/* Shinigami Notebook: a dark room lit by a candle, moonlight through tall windows, an apple on the
   table, black feathers drifting down, and now and then a ruled page floating past. */
WALL.deathnote = {
  pt:10.5,
  init(W, H, R) {
    return { feathers:Array.from({ length:15 }, () => ({ x:R(), y:R(), s:.015 + R() * .025, r:R() * TAU, vr:(R() - .5) * .8, l:14 + R() * 18, p:R() * TAU })),
      motes:Array.from({ length:60 }, () => ({ x:R(), y:R(), s:.004 + R() * .01, p:R() * TAU })),
      scribble:Array.from({ length:9 }, () => Array.from({ length:8 }, () => R())) };
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, py = m.y - .5;
    g.fillStyle = "#050505"; g.fillRect(0, 0, W, H);
    const ww = Math.min(W * .07, 70), wy = H * .08, wh = H * .42;
    for (let i = 0; i < 3; i++) {
      const wx = W * .62 + i * ww * 1.6 - px * 14;
      g.fillStyle = "rgba(40,46,70,.35)"; g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx, wy + ww / 2); g.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww, wy + wh); g.fill();
      g.strokeStyle = "#141414"; g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * .55); g.lineTo(wx + ww, wy + wh * .55); g.stroke();
      g.fillStyle = lin(g, wx, wy, wx - W * .25, H, [[0, "rgba(150,165,210,.09)"], [1, "rgba(150,165,210,0)"]]);
      g.beginPath(); g.moveTo(wx, wy + ww / 2); g.lineTo(wx + ww, wy + ww / 2); g.lineTo(wx + ww - W * .28, H); g.lineTo(wx - W * .32, H); g.fill();
    }
    g.fillStyle = "rgba(200,210,240,.5)";
    S.motes.forEach(d => { const x = wrap(d.x + Math.sin(t * .2 + d.p) * .02, 1) * W, y = wrap(d.y + t * d.s, 1) * H; if (x > W * .3) g.fillRect(x, y, 1.3, 1.3); });
    const ty = H * .86;
    g.fillStyle = lin(g, 0, ty, 0, H, [[0, "#1a120c"], [1, "#0a0705"]]); g.fillRect(0, ty, W, H - ty);
    g.fillStyle = "rgba(255,180,90,.08)"; g.fillRect(0, ty, W, 2);
    const cx = W * .16 - px * 6, fl = 1 + Math.sin(t * 11) * .06 + Math.sin(t * 7.3 + 1) * .05 + Math.sin(t * 17) * .03;
    g.globalCompositeOperation = "lighter";
    blob(g, cx, ty - H * .16, Math.min(W, H) * .55 * fl, "rgba(255,150,60,.22)", "rgba(255,120,40,0)");
    g.globalCompositeOperation = "source-over";
    const ch = H * .12, cw = Math.max(16, W * .018);
    g.fillStyle = lin(g, cx - cw / 2, 0, cx + cw / 2, 0, [[0, "#b9ac90"], [.4, "#efe6d2"], [1, "#9c8f75"]]); g.fillRect(cx - cw / 2, ty - ch, cw, ch);
    g.fillStyle = "#efe6d2"; g.beginPath(); g.ellipse(cx + cw * .3, ty - ch + 10, 3, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = "#111"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, ty - ch); g.lineTo(cx, ty - ch - 7); g.stroke();
    const fh = 26 * fl, fx = cx + Math.sin(t * 3) * 1.5;
    g.fillStyle = rad(g, fx, ty - ch - 10, 1, fh, [[0, "#fffbe0"], [.35, "#ffcf5a"], [1, "rgba(255,110,20,0)"]]);
    g.beginPath(); g.moveTo(fx, ty - ch - 6 - fh); g.quadraticCurveTo(fx + 9, ty - ch - 14, fx, ty - ch - 4); g.quadraticCurveTo(fx - 9, ty - ch - 14, fx, ty - ch - 6 - fh); g.fill();
    const ax = W * .24 - px * 6, ar = Math.max(14, Math.min(W, H) * .035), ay = ty - ar * .9;
    g.fillStyle = rad(g, ax - ar * .4, ay - ar * .4, ar * .1, ar * 1.2, [[0, "#ff5a68"], [.5, "#c8102e"], [1, "#4a0008"]]);
    g.beginPath(); g.moveTo(ax, ay - ar * .7); g.bezierCurveTo(ax + ar * 1.2, ay - ar * 1.3, ax + ar * 1.3, ay + ar * .9, ax, ay + ar * .9); g.bezierCurveTo(ax - ar * 1.3, ay + ar * .9, ax - ar * 1.2, ay - ar * 1.3, ax, ay - ar * .7); g.fill();
    g.strokeStyle = "#3b2414"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(ax, ay - ar * .7); g.quadraticCurveTo(ax + 2, ay - ar * 1.2, ax + 5, ay - ar * 1.35); g.stroke();
    g.fillStyle = "#2d4a1e"; g.beginPath(); g.ellipse(ax + ar * .45, ay - ar * 1.15, ar * .4, ar * .16, -.5, 0, TAU); g.fill();
    const gl = ev(t, 6, .8, 2); if (gl) { const a = Math.sin(gl.p * Math.PI); g.fillStyle = "rgba(255,255,255," + a + ")"; g.fillRect(ax - ar * .45, ay - ar * .45, 7 * a, 1.2); g.fillRect(ax - ar * .45 + 3 * a, ay - ar * .45 - 3 * a, 1.2, 7 * a); }
    S.feathers.forEach(f => {
      const y = wrap(f.y + t * f.s, 1.15) * H - .08 * H, x = f.x * W + Math.sin(t * .6 + f.p) * 40;
      feather(g, x, y, f.r + Math.sin(t * .5 + f.p) * .6, f.l);
    });
    const pg = ev(t, 16, 9, 5);
    if (pg) {
      const x = W * (.92 - pg.p * .75), y = -H * .15 + pg.p * H * 1.25, pw = Math.min(W, H) * .16, ph = pw * 1.35;
      g.save(); g.translate(x, y); g.rotate(-.3 + Math.sin(pg.p * 6) * .25); g.globalAlpha = pg.p < .1 ? pg.p * 10 : pg.p > .9 ? (1 - pg.p) * 10 : 1;
      g.fillStyle = "#e9e6dc"; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.strokeStyle = "rgba(90,110,160,.4)"; g.lineWidth = .7;
      for (let ly = -ph / 2 + 14; ly < ph / 2; ly += 9) { g.beginPath(); g.moveTo(-pw / 2 + 4, ly); g.lineTo(pw / 2 - 4, ly); g.stroke(); }
      g.strokeStyle = "rgba(25,25,30,.7)"; g.lineWidth = .9;
      S.scribble.forEach((l, i) => { const ly = -ph / 2 + 12 + i * 9; g.beginPath(); g.moveTo(-pw / 2 + 8, ly); l.forEach((v, j) => g.lineTo(-pw / 2 + 8 + (j + 1) * (pw - 20) / 8 * (i === 8 ? .5 : 1), ly - 1 - v * 4)); g.stroke(); });
      g.restore();
    }
    g.fillStyle = rad(g, W / 2, H / 2, Math.min(W, H) * .3, Math.max(W, H) * .8, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.65)"]]); g.fillRect(0, 0, W, H);
  }
};

/* Phantom Thief: bold red and black, turning rays, halftone dots, a city skyline, sparkles and
   black-and-white shards slicing across. */
WALL.p5 = {
  pt:3.2,
  init(W, H, R) {
    const S = { stars:Array.from({ length:26 }, () => ({ x:R(), y:R() * .7, s:6 + R() * 12, p:R() * TAU })) };
    const cc = S.city = off(W + 80, H), c = cc.getContext("2d");
    c.fillStyle = "#050505"; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x < W + 80;) { const w = 18 + R() * 46, h = H * (.06 + R() * .16), sl = (R() - .5) * 26; c.lineTo(x, H - h); c.lineTo(x + w * .5, H - h - Math.abs(sl)); c.lineTo(x + w, H - h + sl * .3); x += w; }
    c.lineTo(W + 80, H); c.fill();
    for (let i = 0; i < 60; i++) { c.fillStyle = R() < .5 ? "rgba(230,0,18,.85)" : "rgba(255,255,255,.7)"; c.fillRect(R() * (W + 80), H - R() * H * .1, 3, 5); }
    return S;
  },
  draw(g, W, H, t, S, m) {
    const px = m.x - .5, cx = W * .5 - px * 20, cy = H * .55;
    g.fillStyle = lin(g, 0, 0, W, H, [[0, "#9e000c"], [.5, "#e60012"], [1, "#7a0009"]]); g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, cy); g.rotate(t * .05); g.fillStyle = "rgba(0,0,0,.32)";
    const L = Math.max(W, H) * 1.3;
    for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(L, -L * .1); g.lineTo(L, L * .1); g.fill(); }
    g.restore();
    g.fillStyle = "rgba(0,0,0,.3)";
    const sp = Math.max(18, Math.min(W, H) / 32);
    for (let y = sp / 2, row = 0; y < H; y += sp, row++) for (let x = (row % 2) * sp / 2; x < W; x += sp) {
      const r = (Math.sin(x * .012 + t * .7) + Math.cos(y * .016 - t * .5) + 2) / 4 * sp * .32;
      if (r > .6) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    }
    for (let i = 0; i < 3; i++) {
      const e = !m.gentle && ev(t, 5 + i * 1.7, 1.4, i * 2.1); if (!e) continue;
      const R0 = rng(e.n * 31 + i), y = H * (.15 + R0() * .6), x = -W * .3 + e.p * W * 1.6, s = Math.min(W, H) * (.08 + R0() * .1);
      g.save(); g.translate(x, y); g.rotate(-.35 + R0() * .3 + e.p * .5); g.fillStyle = i === 1 ? "#ffffff" : "#050505";
      g.beginPath(); g.moveTo(-s * 1.6, -s * .2); g.lineTo(s * 1.4, -s * .6); g.lineTo(s * .9, s * .35); g.lineTo(-s * 1.2, s * .5); g.closePath(); g.fill(); g.restore();
    }
    g.drawImage(S.city, -40 - px * 24, 0);
    S.stars.forEach(s => {
      const a = Math.max(0, Math.sin(t * 1.4 + s.p)); if (a < .1) return;
      g.fillStyle = "#fff"; spark(g, s.x * W, s.y * H, s.s * a);
    });
  }
};

function feather(g, x, y, r, l) {
  g.save(); g.translate(x, y); g.rotate(r);
  g.fillStyle = "#0b0b0d"; g.strokeStyle = "rgba(120,125,140,.55)"; g.lineWidth = .8;
  g.beginPath(); g.moveTo(0, -l); g.bezierCurveTo(l * .32, -l * .5, l * .3, l * .4, 0, l * .7); g.bezierCurveTo(-l * .28, l * .3, -l * .3, -l * .55, 0, -l); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(0, -l); g.lineTo(0, l); g.stroke(); g.restore();
}
// a four-pointed twinkle, in the current fill color
function spark(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r * .35, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r * .35, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }

/* ---------------------------------------------------------------- running a wallpaper */
/* Everything loops forever: things move with the clock and wrap round, and the big moments (a
   blade's swing, lightning, a black flash) come back every few seconds. Webs' own Animations: Off
   shows one still frame. The system's "reduce motion" setting (or Animations: Reduced) gets a
   gentle version: half speed, without the flashes and the sweeps across the screen. */
const motion = () => {
  try { const d = document.documentElement.dataset.motion; if (d === "off") return 0; if (d === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches) return 1; }
  catch (e) { /* no matchMedia: full motion */ }
  return 2;
};
// opt: still (one frame), from (the time to start at; the preview's moment by default), fps, pointer (follow the
// mouse), virtual (draw the scene this wide and scale it down), scene (draw this instead of a wallpaper), clear
function run(cv, id, opt) {
  opt = opt || {};
  const w = opt.scene || WALL[id];
  if (!cv || !w) return { stop() {}, redraw() {}, setFps() {} };
  const lvl = motion(), still = !!opt.still || lvl === 0, speed = lvl === 1 ? .5 : 1, from = opt.from != null ? opt.from : w.pt || 0;
  const g = cv.getContext("2d"), m = { x:.5, y:.5, tx:.5, ty:.5, gentle:lvl === 1 };
  let W = 0, H = 0, S = null, raf = 0, last = 0, t0 = -1, fps = opt.fps || 30, stopped = false, seen = true, io = null;
  const move = e => { m.tx = e.clientX / innerWidth; m.ty = e.clientY / innerHeight; };
  if (!still && opt.pointer !== false) addEventListener("pointermove", move, { passive:true });
  const draw = now => {
    const k = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth || cv.width, ch = cv.clientHeight || cv.height;
    // a small canvas (the picker's tiles) gets the whole scene, drawn at a normal size and scaled down
    const vw = opt.virtual ? opt.virtual : cw, vh = opt.virtual ? opt.virtual * ch / Math.max(1, cw) : ch, sc = cw / vw;
    if (vw !== W || vh !== H || !S) { W = vw; H = vh; cv.width = Math.round(cw * k); cv.height = Math.round(ch * k); S = w.init(W, H, rng(opt.seed || 20261004)); }
    g.setTransform(k * sc, 0, 0, k * sc, 0, 0);
    if (opt.clear) g.clearRect(0, 0, W, H);
    m.x += (m.tx - m.x) * .06; m.y += (m.ty - m.y) * .06;
    if (t0 < 0) t0 = now;
    try { w.draw(g, W, H, still ? from : from + (now - t0) / 1000 * speed, S, m); } catch (e) { console.error(e); stopped = true; }
  };
  const go = () => { if (!raf && !stopped && !still && seen && !document.hidden) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    if (stopped || !cv.isConnected) return; // taken off the page: it starts again if it comes back
    if (now - last >= 1000 / fps - 4) { last = now; draw(now); }
    go();
  }
  document.addEventListener("visibilitychange", go);
  // off screen (scrolled away, or in a closed panel): no drawing until it's back
  if (!still && typeof IntersectionObserver === "function") { io = new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; go(); }); io.observe(cv); }
  if (still) draw(0); else go();
  return {
    stop() { stopped = true; cancelAnimationFrame(raf); raf = 0; if (io) io.disconnect(); removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", go); },
    redraw() { W = 0; if (still) draw(0); },
    setFps(n) { fps = n || 30; }
  };
}
function preview(cv, id) { return run(cv, id, { still:true, pointer:false, virtual:720 }); }

/* ---------------------------------------------------------------- the cards' moving layer
   A canvas over each card's background and under its words: butterflies, rain, petals, flames,
   leaves, a passing flock, a little ship sailing the map, feathers, sparkles. Looping like the
   wallpapers. */
const FXC = {};
FXC.bleach = {
  init(W, H, R) { return { flies:Array.from({ length:3 }, () => ({ cx:.4 + R() * .5, cy:.25 + R() * .5, ax:.06 + R() * .1, ay:.12 + R() * .14, fx:.05 + R() * .05, fy:.08 + R() * .06, p:R() * TAU, s:8 + R() * 4 })),
    motes:Array.from({ length:Math.round(W / 26) + 6 }, () => ({ x:R(), y:R(), s:.05 + R() * .08, p:R() * TAU, r:R() })) }; },
  draw(g, W, H, t, S) {
    g.globalCompositeOperation = "lighter";
    S.motes.forEach(p => { const y = (1.05 - wrap(p.y + t * p.s, 1.1)) * H, x = p.x * W + Math.sin(t * .8 + p.p) * 8; blob(g, x, y, 3 + p.r * 4, "rgba(140,190,255,.5)", "rgba(140,190,255,0)"); });
    g.globalCompositeOperation = "source-over";
    S.flies.forEach(f => { const a = t * f.fx * TAU + f.p; butterfly(g, (f.cx + Math.sin(a) * f.ax) * W, (f.cy + Math.sin(t * f.fy * TAU + f.p * 1.3) * f.ay) * H, f.s, .2 + .8 * Math.abs(Math.sin(t * 6.5 + f.p)), Math.cos(a) >= 0 ? 1 : -1); });
  }
};
FXC.ghoul = {
  init(W, H, R) { return { rain:Array.from({ length:Math.round(W / 7) }, () => ({ x:R(), y:R(), s:1.1 + R() * .8, l:.5 + R() })),
    em:Array.from({ length:12 }, () => ({ x:.45 + R() * .55, y:R(), s:.06 + R() * .08, p:R() * TAU, r:R() })) }; },
  draw(g, W, H, t, S) {
    g.strokeStyle = "rgba(235,205,215,.17)"; g.lineWidth = 1; g.beginPath();
    S.rain.forEach(r => { const y = wrap(r.y + t * r.s, 1.2) * H - .1 * H, x = wrap(r.x * W - y * .2, W), l = 7 + r.l * 10; g.moveTo(x, y); g.lineTo(x - l * .2, y + l); });
    g.stroke();
    g.globalCompositeOperation = "lighter";
    S.em.forEach(e => { const ph = wrap(e.y + t * e.s, 1); blob(g, e.x * W + Math.sin(t * 1.5 + e.p) * 10, H * (1 - ph), 2.5 + e.r * 3, "rgba(255,60,80," + .8 * Math.sin(ph * Math.PI) + ")", "rgba(255,30,50,0)"); });
    g.globalCompositeOperation = "source-over";
  }
};
FXC.slayer = {
  init(W, H, R) { return { pe:Array.from({ length:Math.round(W / 22) + 4 }, () => ({ x:R(), y:R(), s:.13 + R() * .14, r:R() * TAU, vr:(R() - .5) * 3, w:2.2 + R() * 2.4, p:R() * TAU, c:R() })) }; },
  draw(g, W, H, t, S) {
    S.pe.forEach(p => {
      g.save(); g.translate(wrap(p.x + t * .015 + Math.sin(t * .7 + p.p) * .02, 1) * W, wrap(p.y + t * p.s, 1.2) * H - .1 * H); g.rotate(p.r + t * p.vr); g.scale(1, .45 + .55 * Math.abs(Math.sin(t * 1.8 + p.p)));
      g.fillStyle = p.c < .5 ? "rgba(205,175,255,.9)" : "rgba(244,232,255,.85)"; g.beginPath(); g.ellipse(0, 0, p.w, p.w * .55, 0, 0, TAU); g.fill(); g.restore();
    });
  }
};
FXC.jjk = {
  init(W, H, R) { return { f:Array.from({ length:Math.round(W / 24) + 4 }, () => ({ x:R(), h:R(), s:.16 + R() * .2, r:9 + R() * 14, p:R() * TAU })),
    sp:Array.from({ length:10 }, () => ({ x:R(), y:R(), p:R() * TAU, s:.3 + R() * .4 })) }; },
  draw(g, W, H, t, S) {
    g.globalCompositeOperation = "lighter";
    S.f.forEach(f => {
      const ph = wrap(t * f.s + f.h, 1), y = H * (1.12 - ph * 1.25), x = f.x * W + Math.sin(t * 1.6 + f.p) * 10 * ph, r = f.r * (1.1 - ph), c = f.h < .5 ? "90,110,255" : "170,80,255", a = (1 - ph) * .5;
      g.save(); g.translate(x, y); g.scale(1, 1.7); g.fillStyle = rad(g, 0, 0, 0, r, [[0, "rgba(" + c + "," + a + ")"], [1, "rgba(" + c + ",0)"]]); g.fillRect(-r, -r, r * 2, r * 2); g.restore();
    });
    g.fillStyle = "rgba(220,205,255,.9)";
    S.sp.forEach(s => { const a = Math.max(0, Math.sin(t * s.s * 4 + s.p)); if (a > .2) spark(g, s.x * W, wrap(s.y - t * .04, 1) * H, 4 * a); });
    g.globalCompositeOperation = "source-over";
  }
};
FXC.naruto = {
  init(W, H, R) { return { l:Array.from({ length:Math.round(W / 70) + 3 }, () => ({ x:R(), y:.12 + R() * .76, s:.05 + R() * .06, r:R() * TAU, vr:(R() - .5) * 2.6, w:7 + R() * 3, c:R(), p:R() * TAU })) }; },
  draw(g, W, H, t, S) { S.l.forEach(l => leaf(g, wrap(l.x + t * l.s, 1.2) * W - .1 * W, l.y * H + Math.sin(t * 1.3 + l.p) * H * .12, l.r + t * l.vr, l.w, l.c)); }
};
FXC.aot = {
  init(W, H, R) { return { d:Array.from({ length:Math.round(W / 22) + 6 }, () => ({ x:R(), y:R(), s:.01 + R() * .025, p:R() * TAU })) }; },
  draw(g, W, H, t, S) {
    g.fillStyle = "rgb(255,214,160)";
    S.d.forEach(d => { g.globalAlpha = .25 + .55 * Math.abs(Math.sin(t * .8 + d.p)); g.fillRect(wrap(d.x + t * d.s, 1) * W, wrap(d.y - t * d.s * .6, 1) * H + Math.sin(t + d.p) * 4, 1.8, 1.8); });
    g.globalAlpha = 1;
    // now and then, a flock crossing over the wall
    const e = ev(t, 10, 7, 2);
    if (e) { g.strokeStyle = "rgba(18,14,10,.8)"; g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const k = Math.abs(i - 2), x = W * (1.08 - e.p * 1.3) + k * 15, y = H * (.2 + hash(e.n) * .25) + k * 8 + Math.sin(t * 2 + i) * 2, f = Math.sin(t * 8 + i * 1.3) * 3;
        g.beginPath(); g.moveTo(x - 6, y - f); g.quadraticCurveTo(x - 2.5, y - 1.5, x, y); g.quadraticCurveTo(x + 2.5, y - 1.5, x + 6, y - f); g.stroke(); } }
  }
};
// the dotted route on the card's map: the card's own drawing (220 by 120, stretched over the right 70%)
const ROUTE = [[10, 100, 50, 80, 60, 30, 100, 40], [100, 40, 140, 50, 160, 90, 200, 60]];
const bz = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
const onRoute = (u, W, H) => { const s = ROUTE[u < .5 ? 0 : 1], k = u < .5 ? u * 2 : u * 2 - 1; return [W * .3 + bz(s[0], s[2], s[4], s[6], k) / 220 * W * .7, bz(s[1], s[3], s[5], s[7], k) / 120 * H]; };
FXC.onepiece = {
  init(W, H, R) { return { gulls:Array.from({ length:2 }, () => ({ x:R(), y:.15 + R() * .3, s:.03 + R() * .02, p:R() * TAU })) }; },
  draw(g, W, H, t, S) {
    const u = wrap(t / 16, 1), [x, y] = onRoute(u, W, H), [x2, y2] = onRoute(Math.min(1, u + .01), W, H), s = Math.max(8, H * .085);
    g.save(); g.globalAlpha = Math.min(1, u * 12, (1 - u) * 12); g.translate(x, y - s * .3); g.rotate(Math.max(-.35, Math.min(.35, Math.atan2(y2 - y, x2 - x) * .5)) + Math.sin(t * 2.4) * .08);
    g.fillStyle = "#5a3315"; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s * 1.1, 0); g.lineTo(s * .7, s * .5); g.lineTo(-s * .7, s * .5); g.closePath(); g.fill();
    g.strokeStyle = "#5a3315"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.5); g.stroke();
    g.fillStyle = "#fff8e6"; g.beginPath(); g.moveTo(-s * .62, -s * 1.25); g.quadraticCurveTo(0, -s * 1.05, s * .62, -s * 1.25); g.lineTo(s * .62, -s * .3); g.quadraticCurveTo(0, -s * .12, -s * .62, -s * .3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#c22"; g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s * .5, -s * 1.38 + Math.sin(t * 6) * 1.5); g.lineTo(0, -s * 1.26); g.fill();
    g.restore();
    // the X glints
    const gl = ev(t, 3.5, 1); if (gl) { const [xx, xy] = onRoute(1, W, H); g.fillStyle = "rgba(255,250,220," + Math.sin(gl.p * Math.PI) + ")"; spark(g, xx + 4, xy - 2, 9 * Math.sin(gl.p * Math.PI)); }
    g.strokeStyle = "rgba(70,45,20,.75)"; g.lineWidth = 1.4;
    S.gulls.forEach(b => { const gx = wrap(b.x - t * b.s, 1.2) * W - .1 * W, gy = b.y * H + Math.sin(t * .8 + b.p) * 5, f = 2 + Math.sin(t * 4 + b.p) * 3;
      g.beginPath(); g.moveTo(gx - 7, gy - f); g.quadraticCurveTo(gx - 3, gy - 2, gx, gy); g.quadraticCurveTo(gx + 3, gy - 2, gx + 7, gy - f); g.stroke(); });
  }
};
FXC.deathnote = {
  init(W, H, R) { return { f:Array.from({ length:Math.round(W / 140) + 2 }, () => ({ x:.2 + R() * .8, y:R(), s:.05 + R() * .05, r:(R() - .5) * 1.2, l:11 + R() * 6, p:R() * TAU })) }; },
  draw(g, W, H, t, S) { S.f.forEach(f => feather(g, f.x * W + Math.sin(t * .7 + f.p) * 22, wrap(f.y + t * f.s, 1.3) * H - .15 * H, f.r + Math.sin(t * .6 + f.p) * .7, f.l)); }
};
FXC.p5 = {
  init(W, H, R) { return { st:Array.from({ length:Math.round(W / 45) + 4 }, () => ({ x:R(), y:R(), s:4 + R() * 6, p:R() * TAU, v:1 + R() })) }; },
  draw(g, W, H, t, S, m) {
    g.fillStyle = "#fff";
    S.st.forEach(s => { const a = Math.max(0, Math.sin(t * s.v * 1.4 + s.p)); if (a > .1) spark(g, s.x * W, s.y * H, s.s * a); });
    for (let i = 0; i < 2; i++) {
      const e = !m.gentle && ev(t, 4.5 + i * 1.6, 1.1, i * 1.9); if (!e) continue;
      const R0 = rng(e.n * 17 + i), y = H * (.15 + R0() * .7), x = -W * .2 + e.p * W * 1.4, sz = H * (.07 + R0() * .06);
      g.save(); g.translate(x, y); g.rotate(-.4 + R0() * .4 + e.p * .6); g.fillStyle = i ? "#fff" : "#000";
      g.beginPath(); g.moveTo(-sz * 1.5, -sz * .2); g.lineTo(sz * 1.3, -sz * .6); g.lineTo(sz * .8, sz * .35); g.lineTo(-sz * 1.1, sz * .5); g.closePath(); g.fill(); g.restore();
    }
  }
};

/* ---------------------------------------------------------------- the start page's card */
const KANJI = ["日", "月", "火", "水", "木", "金", "土"];
const pad = n => String(n).padStart(2, "0");
function clock(d, h24) { const h = d.getHours(); return h24 ? pad(h) + ":" + pad(d.getMinutes()) : (h % 12 || 12) + ":" + pad(d.getMinutes()); }
function facts(opt) {
  const d = new Date(), y0 = new Date(d.getFullYear(), 0, 1), doy = Math.floor((d - y0) / 864e5) + 1, mins = d.getHours() * 60 + d.getMinutes();
  const yLen = (new Date(d.getFullYear() + 1, 0, 1) - y0) / 864e5;
  return { d, time:clock(d, opt.h24), ampm:opt.h24 ? "" : d.getHours() < 12 ? "AM" : "PM", wd:d.toLocaleDateString("en-US", { weekday:"long" }), md:d.toLocaleDateString("en-US", { month:"long", day:"numeric" }),
    k:KANJI[d.getDay()], doy, left:yLen - doy, dayPct:Math.round(mins / 1440 * 100), toWeekend:(6 - d.getDay() + 7) % 7 };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const meter = (label, pct) => '<div class="an-meter"><span>' + esc(label) + '</span><i><b style="width:' + Math.max(2, Math.min(100, pct)) + '%"></b></i><em>' + pct + "%</em></div>";
const CARD = {
  bleach:f => '<div class="an-k">' + f.k + '</div><svg class="an-moon" viewBox="0 0 100 100"><defs><mask id="anm"><rect width="100" height="100" fill="#fff"/><circle cx="36" cy="40" r="38" fill="#000"/></mask></defs><circle cx="55" cy="50" r="40" fill="#f1f3f9" mask="url(#anm)"/></svg>' +
    '<div class="an-body"><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-date">' + esc(f.wd) + " · " + esc(f.md) + "</div>" + meter("Spiritual pressure", 100 - f.dayPct) + '<div class="an-tag"></div></div><i class="an-slash"></i>',
  ghoul:f => '<svg class="an-veins" viewBox="0 0 200 120" preserveAspectRatio="none"><path d="M200 120C170 90 160 70 172 30M200 110C150 96 128 70 120 20M200 100C176 84 150 88 140 60" fill="none" stroke="#e0193a" stroke-width="5" stroke-linecap="round"/></svg>' +
    '<div class="an-body"><div class="an-date">' + esc(f.wd) + '</div><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-md">' + esc(f.md) + '</div><div class="an-tag"></div></div><div class="an-cup">☕<i></i><i class="s2"></i><i class="s3"></i></div>',
  slayer:f => '<div class="an-in"><svg class="an-wis" viewBox="0 0 60 120">' + Array.from({ length:14 }, (_, i) => '<circle cx="' + (30 + Math.sin(i * 1.7) * (14 - i)) + '" cy="' + (8 + i * 8) + '" r="' + (7 - i * .4) + '" fill="' + (i % 2 ? "#c9a7ff" : "#a57cf0") + '"/>').join("") + "</svg>" +
    '<div class="an-k">' + f.k + '</div><div class="an-body"><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-date">' + esc(f.wd) + " · " + esc(f.md) + '</div><div class="an-tag"></div></div></div>',
  jjk:f => '<svg class="an-ring" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="#7f5cff" stroke-width="1.5"/><circle cx="100" cy="100" r="80" fill="none" stroke="#7f5cff" stroke-width="1" stroke-dasharray="2 9"/>' +
    Array.from({ length:24 }, (_, i) => '<line x1="100" y1="2" x2="100" y2="' + (8 + (i % 3) * 4) + '" stroke="#a88bff" stroke-width="1.5" transform="rotate(' + i * 15 + ' 100 100)"/>').join("") + "</svg>" +
    '<div class="an-body"><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-date">' + esc(f.wd) + " · " + esc(f.md) + "</div>" + meter("Cursed energy", f.dayPct) + '<div class="an-tag"></div></div>',
  naruto:f => '<i class="an-rod l"></i><div class="an-paper"><div class="an-body"><div class="an-date">' + esc(f.wd) + '</div><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-md">' + esc(f.md) + "</div>" +
    meter("Energy left today", 100 - f.dayPct) + '<div class="an-tag"></div></div><svg class="an-swirl" viewBox="0 0 100 100"><path d="M50 50m0-6a6 6 0 1 1-6 6 12 12 0 0 1 12-12 18 18 0 0 1 18 18 24 24 0 0 1-24 24 30 30 0 0 1-30-30 36 36 0 0 1 36-36" fill="none" stroke="#ff8a1c" stroke-width="5" stroke-linecap="round"/></svg></div><i class="an-rod r"></i>',
  aot:f => '<div class="an-body"><div class="an-date">' + esc(f.wd) + " · " + esc(f.md) + '</div><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-day">Day ' + f.doy + " beyond the walls</div>" + '<div class="an-tag"></div></div>' +
    '<svg class="an-key" viewBox="0 0 60 140"><circle cx="30" cy="22" r="16" fill="none" stroke="#c9a26b" stroke-width="6"/><circle cx="30" cy="22" r="5" fill="#c9a26b"/><rect x="27" y="36" width="6" height="88" rx="2" fill="#c9a26b"/>' +
    '<path d="M33 104h14v7H33zM33 116h10v7H33z" fill="#c9a26b"/><path d="M30 0v6" stroke="#6b5636" stroke-width="2"/></svg>',
  onepiece:f => '<svg class="an-map" viewBox="0 0 220 120" preserveAspectRatio="none"><path d="M10 100C50 80 60 30 100 40s60 50 100 20" fill="none" stroke="#8a5a2b" stroke-width="2.5" stroke-dasharray="6 6"/>' +
    '<path d="M192 50l12 12M204 50l-12 12" stroke="#c22" stroke-width="4" stroke-linecap="round"/></svg><svg class="an-compass" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#8a5a2b" stroke-width="3"/>' +
    '<path d="M50 10L58 50 50 90 42 50z" fill="#c22"/><path d="M10 50L50 42 90 50 50 58z" fill="#8a5a2b"/></svg><div class="an-body"><div class="an-date">' + esc(f.wd) + " · " + esc(f.md) + '</div><div class="an-time">' + f.time + "<small>" + f.ampm + '</small></div><div class="an-day">Day ' + f.doy + ' of the voyage</div><div class="an-tag"></div></div>',
  deathnote:f => '<div class="an-cover"><b>NOTE</b><span>' + f.d.getFullYear() + '</span></div><div class="an-page"><div class="an-hand">' + esc(f.wd) + ", " + esc(f.md) + '</div><div class="an-time">' + f.time + "<small>" + f.ampm + "</small></div>" +
    '<div class="an-rule">Rule ' + ["I", "II", "III", "IV", "V", "VI", "VII"][f.d.getDay()] + ": " + f.left + ' days are left in this year. Use them well.</div><div class="an-tag"></div><span class="an-apple">🍎</span></div>',
  p5:f => '<div class="an-burst"></div><div class="an-body"><div class="an-date"><span>' + esc(f.wd.toUpperCase()) + "</span></div><div class=\"an-time\"><span>" + f.time + "</span><small>" + f.ampm + '</small></div><div class="an-md"><span>' + esc(f.md.toUpperCase()) + "</span></div>" +
    '<div class="an-days">' + (f.toWeekend ? f.toWeekend + " DAY" + (f.toWeekend === 1 ? "" : "S") + " TO THE WEEKEND" : "IT'S THE WEEKEND!") + '</div><div class="an-tag"></div></div>'
};
// the moving layer of each card on the page (a new theme stops the old one)
const FXRUN = typeof WeakMap === "function" ? new WeakMap() : null;
function fxStop(el) { const r = FXRUN && FXRUN.get(el); if (r) { r.stop(); FXRUN.delete(el); } }
function card(el, id, opt) {
  opt = opt || {};
  const th = BY[id];
  if (!el) return;
  if (!th) { fxStop(el); el.innerHTML = ""; el.className = ""; delete el.dataset.an; delete el.dataset.sig; delete el.dataset.mo; return; }
  const f = facts(opt), sig = f.time + f.md, mo = String(motion());
  let box = el.querySelector(".an-c");
  if (el.dataset.an === id && el.dataset.sig === sig && el.dataset.mo === mo && box) return;
  // the moving layer stays put while the words change (the time, every minute)
  if (el.dataset.an !== id || el.dataset.mo !== mo || !box || !el.querySelector(".an-fx")) {
    fxStop(el); el.dataset.mo = mo;
    el.innerHTML = '<canvas class="an-fx" aria-hidden="true"></canvas><div class="an-c"></div>';
    box = el.querySelector(".an-c");
    if (FXRUN) FXRUN.set(el, run(el.firstChild, id, { scene:FXC[id], pointer:false, clear:true }));
  }
  el.dataset.an = id; el.dataset.sig = sig;
  el.className = "an-card an-" + id + (opt.animate ? " an-in" : "");
  box.innerHTML = CARD[id](f);
  el.querySelectorAll(".an-tag").forEach(n => { n.textContent = "“" + th.tag + "”"; });
  el.setAttribute("aria-label", th.name + " card: " + f.time + " " + f.ampm + ", " + f.wd + ", " + f.md);
}

/* ---------------------------------------------------------------- choosing one */
// every tile plays its wallpaper (a little slower than the real one, and only while it's on screen)
function picker(el, opt) {
  opt = opt || {};
  const runs = [];
  let dead = false;
  el.innerHTML = '<div class="an-grid"></div><p class="an-note">Fan-made looks inspired by these shows: drawn by Webs, not official, and not connected to their creators.</p>';
  const grid = el.querySelector(".an-grid");
  THEMES.concat([{ id:"", name:"No anime theme", show:"Your own look", e:"✖️" }]).forEach(th => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "an-tile" + (th.id === (opt.current || "") ? " on" : "") + (th.id ? "" : " none"); b.dataset.id = th.id;
    b.innerHTML = (th.id ? "<canvas></canvas>" : '<div class="an-none">' + th.e + "</div>") + "<b></b><span></span>";
    b.querySelector("b").textContent = th.name; b.querySelector("span").textContent = th.id ? "Inspired by " + th.show : th.show;
    if (th.id) b.style.setProperty("--ac", th.a);
    b.onclick = () => { grid.querySelectorAll(".an-tile").forEach(x => x.classList.toggle("on", x === b)); if (opt.onPick) opt.onPick(th.id); };
    grid.appendChild(b);
    if (th.id) {
      const cv = b.querySelector("canvas");
      requestAnimationFrame(() => {
        if (dead) return;
        const r = run(cv, th.id, { pointer:false, virtual:640, fps:12 });
        runs.push(r);
        b.addEventListener("pointerenter", () => r.setFps(30));
        b.addEventListener("pointerleave", () => r.setFps(12));
      });
    }
  });
  return { stop() { dead = true; runs.forEach(r => r.stop()); } };
}

/* ---------------------------------------------------------------- putting it on (and taking it off) */
// settings: the app's settings object. opt.pc: also the Windows colors (pack "custom"); opt.sound: its ambient sound
function apply(s, id, opt) {
  opt = opt || {};
  const th = BY[id];
  if (th) {
    if (!s.anime) s.animePrev = { pack:s.pack || "", customTheme:Array.isArray(s.customTheme) ? s.customTheme.slice() : null, accent:s.accent || "", liveBg:s.liveBg || "",
      theme:s.theme || "", ambient:s.ambient || "", vibe:s.vibe || "" };
    Object.assign(s, { anime:id, accent:th.a, theme:"dark", liveBg:"anime", vibe:"" });
    if (opt.pc) Object.assign(s, { pack:"custom", customTheme:th.c.slice() });
    if (opt.sound != null) s.ambient = opt.sound ? th.amb : (s.animePrev && s.animePrev.ambient) || "";
  } else if (s.anime) {
    const pv = s.animePrev || {};
    Object.assign(s, { anime:"", accent:pv.accent || "", liveBg:pv.liveBg || "", ambient:pv.ambient || "", vibe:pv.vibe || "" });
    if (opt.pc) { s.pack = pv.pack || ""; if (pv.customTheme) s.customTheme = pv.customTheme; else delete s.customTheme; }
    if (pv.theme) s.theme = pv.theme;
    delete s.animePrev;
  }
  return s;
}

/* ---------------------------------------------------------------- the look (cards and picker; colors come from the page) */
const css = document.createElement("style");
css.textContent = `
.an-card{position:relative;overflow:hidden;border-radius:18px;min-height:150px;padding:20px 22px;color:#fff;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.35);isolation:isolate;text-align:left}
.an-card.an-in{animation:anIn .6s cubic-bezier(.2,.9,.2,1.1) both}@keyframes anIn{from{opacity:0;transform:translateY(16px) scale(.97)}}
.an-card .an-time{font-size:48px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.an-card .an-time small{font-size:15px;font-weight:700;margin-left:6px;letter-spacing:.06em;opacity:.8}
.an-card .an-date{font-size:14px;font-weight:600;letter-spacing:.04em;opacity:.9;margin-top:4px}.an-card .an-tag{font-size:12.5px;opacity:.75;margin-top:8px;font-style:italic}
.an-card .an-body{position:relative;z-index:2}
.an-card .an-c{display:contents}.an-card .an-fx{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;pointer-events:none}
.an-meter{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.92}.an-meter i{flex:1;max-width:220px;height:6px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden}
.an-meter b{position:relative;display:block;height:100%;border-radius:3px;background:var(--an-m,#fff);overflow:hidden}
.an-meter b::after{content:"";position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);transform:translateX(-100%)}.an-meter em{font-style:normal;font-variant-numeric:tabular-nums}
/* Soul Reaper */
.an-bleach{background:linear-gradient(135deg,#0a0a0e,#16161d 60%,#0a0a0e);padding-left:120px;--an-m:linear-gradient(90deg,#ff6a1a,#ffd0a8)}
.an-bleach .an-k{position:absolute;left:18px;top:50%;transform:translateY(-50%);font:900 92px/1 "Yu Mincho","Hiragino Mincho ProN",serif;color:#fff;text-shadow:4px 4px 0 #ff6a1a}
.an-bleach .an-moon{position:absolute;right:18px;top:12px;width:70px;height:70px;filter:drop-shadow(0 0 12px rgba(220,230,255,.5))}
.an-bleach .an-slash{position:absolute;left:-10%;right:-10%;bottom:-6px;height:16px;background:linear-gradient(90deg,transparent,#ff6a1a 30%,#fff 50%,#ff6a1a 70%,transparent);transform:rotate(-4deg);opacity:.85}
@keyframes anSlash{0%,100%{clip-path:inset(0 100% 0 0)}30%,70%{clip-path:inset(0 0 0 0)}}
/* One-Eyed Ghoul */
.an-ghoul{background:radial-gradient(circle at 85% 110%,#5a0614,#150608 60%,#0a0405);border:1px solid #3a0a12}
.an-ghoul .an-veins{position:absolute;right:0;bottom:0;width:60%;height:100%;filter:drop-shadow(0 0 8px #e0193a);opacity:.85}
@keyframes anPulse{50%{opacity:.55}}
.an-ghoul .an-date{color:#ff4a62;text-transform:uppercase;letter-spacing:.2em;font-size:12px}.an-ghoul .an-time{font-family:Georgia,"Times New Roman",serif;font-weight:700;margin-top:4px}.an-ghoul .an-md{font-size:14px;opacity:.85;margin-top:4px}
.an-ghoul .an-cup{position:absolute;right:26px;top:18px;font-size:30px;z-index:2}.an-ghoul .an-cup i{position:absolute;left:14px;top:-6px;width:3px;height:14px;border-radius:2px;background:rgba(255,255,255,.4)}
.an-ghoul .an-cup .s2{left:9px}.an-ghoul .an-cup .s3{left:19px}
@keyframes anSteam{0%{transform:translateY(0) scaleY(.6);opacity:0}40%{opacity:.8}100%{transform:translateY(-16px) scaleY(1.2);opacity:0}}
/* Wisteria Night */
.an-slayer{padding:8px;background:conic-gradient(#1f8a5c 25%,#0a0a0a 0 50%,#1f8a5c 0 75%,#0a0a0a 0) 0 0/16px 16px}
.an-slayer .an-in{position:relative;border-radius:12px;min-height:134px;padding:16px 18px 16px 110px;background:linear-gradient(160deg,#141633,#22285a)}
.an-slayer .an-wis{position:absolute;left:12px;top:0;width:40px;height:100%;transform-origin:top}@keyframes anSway{50%{transform:rotate(4deg)}}
.an-slayer .an-k{position:absolute;left:52px;top:50%;transform:translateY(-50%);font:700 46px/1 "Yu Mincho","Hiragino Mincho ProN",serif;color:#e9ddff}
/* Cursed Energy */
.an-jjk{background:radial-gradient(circle at 80% 50%,#2a1a5c,#0c0918 70%);--an-m:linear-gradient(90deg,#4d6bff,#a64dff)}
.an-jjk .an-ring{position:absolute;right:-30px;top:50%;width:220px;height:220px;margin-top:-110px;opacity:.8;filter:drop-shadow(0 0 6px #7f5cff)}
@keyframes anSpin{to{transform:rotate(360deg)}}
.an-jjk .an-time{text-shadow:0 0 18px rgba(140,110,255,.9)}
/* Hidden Leaf */
.an-naruto{background:none;box-shadow:none;padding:0;display:flex;align-items:stretch;--an-m:linear-gradient(90deg,#ff8a1c,#ffd27a)}
.an-naruto .an-rod{width:16px;flex:none;border-radius:8px;background:linear-gradient(90deg,#5a3315,#a7652a,#5a3315);box-shadow:0 8px 20px rgba(0,0,0,.35)}
.an-naruto .an-paper{position:relative;flex:1;margin:8px -4px;padding:16px 20px;background:linear-gradient(180deg,#f6e7c6,#ead39f);color:#3a2412;box-shadow:inset 0 0 30px rgba(140,90,30,.35)}
.an-naruto .an-date{color:#c25a00;text-transform:uppercase;letter-spacing:.18em;font-size:12px;opacity:1}.an-naruto .an-md{font-size:14px;margin-top:2px}
.an-naruto .an-meter i{background:rgba(90,50,10,.15)}
.an-naruto .an-swirl{position:absolute;right:14px;top:50%;width:84px;height:84px;margin-top:-42px;opacity:.85}
/* Beyond the Walls */
.an-aot{background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 60px),linear-gradient(180deg,#4a443c,#25221d);color:#f1ead9}
.an-aot .an-time{text-shadow:0 2px 0 rgba(0,0,0,.6),0 -1px 0 rgba(255,255,255,.15)}.an-aot .an-date{color:#c9a26b;text-transform:uppercase;letter-spacing:.14em;font-size:12px}
.an-aot .an-day{margin-top:8px;font-size:13px;font-weight:600;letter-spacing:.05em}.an-aot .an-key{position:absolute;right:34px;top:50%;height:120px;margin-top:-60px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6));transform-origin:30px 0}
/* Grand Voyage */
.an-onepiece{background:radial-gradient(circle at 30% 30%,#f7e8c4,#e6cb92 70%,#c9a565);color:#3b2410;border:3px solid #8a5a2b}
.an-onepiece .an-map{position:absolute;left:30%;right:0;top:0;bottom:0;width:70%;height:100%;opacity:.55}.an-onepiece .an-compass{position:absolute;right:18px;top:14px;width:62px;height:62px}
@keyframes anSway2{50%{transform:rotate(20deg)}}
.an-onepiece .an-date{color:#a0461a;text-transform:uppercase;letter-spacing:.14em;font-size:12px}.an-onepiece .an-day{margin-top:6px;font-size:13px;font-weight:700}
/* Shinigami Notebook */
.an-deathnote{background:#050505;display:flex;padding:0;border:1px solid #222}
.an-deathnote .an-cover{width:84px;flex:none;background:linear-gradient(90deg,#0b0b0b,#1a1a1a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-right:2px solid #333}
.an-deathnote .an-cover b{font:700 15px Georgia,"Times New Roman",serif;letter-spacing:.3em;color:#e8e8e8;writing-mode:vertical-rl}.an-deathnote .an-cover span{font-size:10px;color:#777;letter-spacing:.1em}
.an-deathnote .an-page{position:relative;flex:1;padding:14px 20px;color:#151515;background:repeating-linear-gradient(180deg,transparent 0 23px,rgba(70,90,150,.28) 23px 24px),#ecebe6}
.an-deathnote .an-hand{font:22px/1.1 "Segoe Print","Bradley Hand","Comic Sans MS",cursive;color:#1a1a2a}.an-deathnote .an-time{font-family:Georgia,"Times New Roman",serif;color:#111;font-size:40px;margin-top:4px}
.an-deathnote .an-rule{font:italic 12.5px Georgia,"Times New Roman",serif;margin-top:6px;color:#333}.an-deathnote .an-tag{color:#555}.an-deathnote .an-apple{position:absolute;right:16px;bottom:10px;font-size:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));z-index:2}.an-deathnote .an-page>:not(.an-apple){position:relative;z-index:2}
/* Phantom Thief */
.an-p5{background:#e60012;overflow:hidden}.an-p5 .an-burst{position:absolute;inset:-60%;background:repeating-conic-gradient(#000 0 7deg,transparent 7deg 20deg);opacity:.22}
.an-p5 .an-body span{display:inline-block;background:#000;color:#fff;padding:2px 10px;transform:skew(-10deg) rotate(-2deg)}.an-p5 .an-date span{font-weight:900;letter-spacing:.12em}
.an-p5 .an-time span{background:#fff;color:#000;font-family:"Arial Black",Impact,sans-serif;font-size:46px;padding:2px 12px;transform:skew(-8deg) rotate(1.5deg);box-shadow:6px 6px 0 #000;margin:8px 0}
.an-p5 .an-md span{font-weight:800;letter-spacing:.08em;font-size:13px}.an-p5 .an-days{display:inline-block;margin-top:10px;font:900 13px "Arial Black",Impact,sans-serif;color:#fff;text-shadow:2px 2px 0 #000;letter-spacing:.06em}.an-p5 .an-tag{color:#fff}
@media (max-width:480px){.an-card .an-time{font-size:40px}.an-bleach{padding-left:96px}.an-bleach .an-k{font-size:70px}.an-slayer .an-in{padding-left:92px}.an-jjk .an-ring{width:170px;height:170px;margin-top:-85px;right:-50px}.an-naruto .an-swirl{width:64px;height:64px;margin-top:-32px}.an-aot .an-key{height:90px;margin-top:-45px;right:18px}.an-onepiece .an-compass{width:46px;height:46px}}
/* the moving parts, round and round. They keep going with the system's "reduce motion" on (the
   pages stop every animation then, so these are marked important), and stop with Animations: Off. */
.an-card.an-bleach .an-slash{animation:anSlash 4s ease-in-out infinite!important}
.an-card.an-ghoul .an-veins{animation:anPulse 3s ease-in-out infinite!important}
.an-card.an-ghoul .an-cup i{animation:anSteam 2.4s ease-in-out infinite!important}.an-card.an-ghoul .an-cup .s2{animation:anSteam 2.4s ease-in-out -.8s infinite!important}.an-card.an-ghoul .an-cup .s3{animation:anSteam 2.4s ease-in-out -1.6s infinite!important}
.an-card.an-slayer .an-wis{animation:anSway 5s ease-in-out infinite!important}
.an-card.an-jjk .an-ring{animation:anSpin 40s linear infinite!important}
.an-card.an-naruto .an-swirl{animation:anSpin 8s linear infinite!important}
.an-card.an-aot .an-key{animation:anSway 4s ease-in-out infinite!important}
.an-card.an-onepiece .an-compass{animation:anSway2 6s ease-in-out infinite!important}
.an-card.an-deathnote .an-apple{animation:anBob 3.2s ease-in-out infinite!important}
.an-card.an-p5 .an-burst{animation:anSpin 30s linear infinite!important}.an-card.an-p5 .an-time span{animation:anJolt 5s linear infinite!important}
.an-card.an-card .an-meter b::after{animation:anSheen 3s ease-in-out infinite!important}
@keyframes anBob{50%{transform:translateY(-4px) rotate(-6deg)}}@keyframes anSheen{55%,100%{transform:translateX(240%)}}
@keyframes anJolt{0%,86%,100%{transform:skew(-8deg) rotate(1.5deg)}89%{transform:skew(-8deg) rotate(-1.5deg) translate(-3px,1px)}92%{transform:skew(-11deg) rotate(3deg) translate(2px,-1px)}95%{transform:skew(-8deg) rotate(1.5deg)}}
:root:root[data-motion="off"] .an-card.an-card,:root:root[data-motion="off"] .an-card.an-card *,:root:root[data-motion="off"] .an-card.an-card *::after{animation:none!important}
/* the picker */
.an-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.an-tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:2px;padding:0 0 9px;border:2px solid transparent;border-radius:14px;background:rgba(127,127,127,.12);color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;transition:transform .2s,border-color .2s,box-shadow .2s}
.an-tile canvas{width:100%;aspect-ratio:16/10;display:block;border-radius:12px 12px 0 0;background:#000}
.an-tile:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(0,0,0,.35)}.an-tile.on{border-color:var(--ac,var(--accent,#e8342a))}
.an-tile b{font-size:13px;font-weight:650;margin:6px 10px 0}.an-tile span{font-size:11px;opacity:.65;margin:0 10px}
.an-none{aspect-ratio:16/10;display:grid;place-items:center;font-size:28px;background:rgba(127,127,127,.12)}
.an-note{font-size:11.5px;opacity:.6;margin:10px 2px 0;line-height:1.45}
`;
(document.head || document.documentElement).appendChild(css);

window.Anime = { THEMES, get:id => BY[id] || null, run, preview, card, picker, apply, has:id => !!BY[id], motion, _wall:WALL, _fx:FXC, _rng:rng };
})();
