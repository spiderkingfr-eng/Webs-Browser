/* Webs Browser - XP and levels, for both apps (iPhone 2.9, Windows 3.10). XP comes from finishing games
   (more for a win, more again on a harder level), from achievements and from coming back each day (a little
   more for a streak). Levels unlock looks: frames for the start page's cards, and on Windows effects for the
   band across the top of the window. Everything stays on this device, in wsb.xp:
     { total, day, todayN (game XP today), last (the last day you came), streak, ach (achievements counted),
       seen (the games' counters last time), frame, band, log:[{ t, n, why }] }
   XP.game(name, won, times)   a game was finished (games call it; wins and bests in wsb.games are noticed too)
   XP.add(n, why)              XP for anything else
   XP.info()                   { level, into, need, total, title }
   XP.card(el) / XP.panel(el)  the little card with the bar, and the levels with what they unlock
   XP.choose(kind, id)         wear a frame ("frame") or a band effect ("band") you've unlocked */
(function () {
"use strict";
if (window.XP && window.XP.ready) return;
const KEY = "wsb.xp";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } };
const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
const day = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const PRIVATE = /[?&]private=1/.test(location.search);
// XP from one level to the next: 100, 150, 200, 250…
const need = L => 50 + 50 * L;
const TITLES = [[1, "Newcomer"], [3, "Explorer"], [5, "Adventurer"], [8, "Veteran"], [12, "Champion"], [16, "Legend"], [20, "Mythic"]];
function info(total) {
  total = total == null ? read().total || 0 : total;
  let L = 1, left = total;
  while (left >= need(L)) { left -= need(L); L++; }
  return { level:L, into:left, need:need(L), total, title:TITLES.filter(t => t[0] <= L).pop()[1] };
}
const UNLOCKS = [
  { lvl:2, kind:"frame", id:"glow", name:"Glow", what:"a soft glow in your accent color" },
  { lvl:3, kind:"band", id:"sparkle", name:"Sparkle", what:"sparkles running along the top of the window" },
  { lvl:4, kind:"frame", id:"neon", name:"Neon", what:"a buzzing neon outline" },
  { lvl:5, kind:"band", id:"rainbow", name:"Rainbow", what:"a rainbow sweeping across" },
  { lvl:6, kind:"frame", id:"gold", name:"Gold", what:"a gold edge that catches the light" },
  { lvl:8, kind:"band", id:"comet", name:"Comet", what:"a comet shooting by" },
  { lvl:10, kind:"frame", id:"holo", name:"Holographic", what:"shifting rainbow foil, like a rare card" },
  { lvl:12, kind:"band", id:"fire", name:"Fire", what:"flames flickering along the top" },
  { lvl:15, kind:"frame", id:"crown", name:"Crown", what:"a little crown and a gold edge" },
  { lvl:20, kind:"band", id:"aurora", name:"Aurora", what:"northern lights, slowly drifting" }
];
const DAY_CAP = 400;             // game XP in one day, so it can't be farmed without end
const IS_WIN = location.hostname === "browser.example";       // the Windows browser's own pages

function add(n, why, capped) {
  if (PRIVATE || !(n > 0)) return 0;
  const s = read(), d = day();
  if (s.day !== d) { s.day = d; s.todayN = 0; }
  if (capped) { n = Math.max(0, Math.min(n, DAY_CAP - (s.todayN || 0))); s.todayN = (s.todayN || 0) + n; }
  if (!n) { write(s); return 0; }
  const before = info(s.total || 0).level;
  s.total = (s.total || 0) + Math.round(n);
  s.log = [{ t:Date.now(), n:Math.round(n), why:String(why || "").slice(0, 40) }].concat(s.log || []).slice(0, 30);
  write(s);
  const now = info(s.total);
  pop("+" + Math.round(n) + " XP" + (why ? " · " + why : ""));
  if (now.level > before) {
    const got = UNLOCKS.filter(u => u.lvl > before && u.lvl <= now.level && (u.kind === "frame" || IS_WIN));
    setTimeout(() => pop("⭐ Level " + now.level + "! " + (got.length ? "Unlocked: " + got.map(u => u.name + " " + u.kind).join(", ") : now.title), true), 900);
  }
  document.dispatchEvent(new CustomEvent("wsb-xp", { detail:now }));
  return n;
}
const NAMES = { sudoku:"Sudoku", solitaire:"Solitaire", chess:"Chess", blocks:"Blocks", snake:"Snake", "2048":"2048", word:"Daily word", ttt:"Tic-tac-toe",
  mem:"Memory", mine:"Minesweeper", brk:"Breakout", pong:"Pong", wpm:"Typing test", react:"Reaction time", aim:"Aim trainer", runner:"Web Runner" };
function game(name, won, times) { return add((won ? 15 : 5) * Math.max(1, Math.min(6, +times || 1)), NAMES[name] || name, true); }

/* the games' own counters in wsb.games: a win or a new best is worth XP, whichever game it came from
   (the four in js/games.more.js say so themselves, so they're left out here) */
const WIN_KEYS = { tttWins:"ttt", wordWins:"word", pongWins:"pong" }, BEST_KEYS = { snake:"snake", g2048:"2048", mem:"mem", mine:"mine", brk:"brk", wpm:"wpm", react:"react", aim:"aim" };
function counters() {
  let g = {}; try { g = JSON.parse(localStorage.getItem("wsb.games") || "{}") || {}; } catch (e) {}
  let r = 0; try { r = +JSON.parse(localStorage.getItem("wsb.game") || "0") || 0; } catch (e) {}
  return Object.assign({}, g, { runner:r });
}
function watchGames() {
  const s = read(), now = counters();
  if (!s.seen) { s.seen = now; write(s); return; }
  const was = s.seen;
  s.seen = now; write(s);
  Object.keys(WIN_KEYS).forEach(k => { const d = (now[k] || 0) - (was[k] || 0); if (d > 0 && d < 20) game(WIN_KEYS[k], true, d); });
  Object.keys(BEST_KEYS).forEach(k => { if (now[k] != null && now[k] !== was[k]) add(10, "New best: " + NAMES[BEST_KEYS[k]], true); });
  if (now.runner > (was.runner || 0)) add(10, "New best: Web Runner", true);
}
// achievements, on either app: 25 XP each, the ones you had before too
function watchAch() {
  let n = 0;
  ["wsb.ach", "wsb.mach"].forEach(k => { try { n += Object.keys(JSON.parse(localStorage.getItem(k) || "{}") || {}).length; } catch (e) {} });
  const s = read();
  if (n > (s.ach || 0)) { const d = n - (s.ach || 0); s.ach = n; write(s); add(25 * d, d > 1 ? d + " achievements" : "Achievement"); }
}
// once a day for coming back, a little more each day in a row (up to a week)
function daily() {
  const s = read(), d = day();
  if (s.last === d) return;
  const y = new Date(Date.now() - 864e5), yd = y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
  s.streak = s.last === yd ? (s.streak || 1) + 1 : 1; s.last = d; write(s);
  add(10 + 5 * Math.min(6, s.streak - 1), s.streak > 1 ? "Day " + s.streak + " in a row" : "Welcome back");
}

/* ---------------------------------------------------------------- looks you've unlocked */
const unlocked = (kind, id) => { const u = UNLOCKS.find(x => x.kind === kind && x.id === id); return !!u && info().level >= u.lvl; };
function wear() {
  const s = read(), r = document.documentElement;
  if (s.frame && unlocked("frame", s.frame)) r.dataset.xpframe = s.frame; else delete r.dataset.xpframe;
  if (s.band && unlocked("band", s.band)) r.dataset.xpband = s.band; else delete r.dataset.xpband;
}
function choose(kind, id) {
  if (id && !unlocked(kind, id)) return false;
  const s = read(); s[kind] = id || ""; write(s); wear();
  document.dispatchEvent(new CustomEvent("wsb-xp", { detail:info() }));
  return true;
}

/* ---------------------------------------------------------------- showing it */
let popEl = null, popT = 0;
function pop(text, big) {
  if (!document.body) return;
  if (!popEl) { popEl = document.createElement("div"); popEl.className = "xp-pop"; popEl.setAttribute("role", "status"); document.body.appendChild(popEl); }
  popEl.textContent = text; popEl.classList.toggle("big", !!big);
  popEl.classList.remove("on"); void popEl.offsetWidth; popEl.classList.add("on");
  clearTimeout(popT); popT = setTimeout(() => popEl.classList.remove("on"), big ? 3600 : 2200);
}
function bar(i) { return '<div class="xp-bar"><i style="width:' + Math.round(i.into / i.need * 100) + '%"></i></div>'; }
// the card: your level, title and the way to the next one; Levels opens what they unlock
function card(el, opt) {
  opt = opt || {};
  const paint = () => {
    const i = info(), s = read(), next = UNLOCKS.find(u => u.lvl > i.level && (u.kind === "frame" || IS_WIN));
    el.classList.add("xp-card");
    el.innerHTML = '<div class="xp-top"><span class="xp-lv">' + i.level + '</span><div><b>Level ' + i.level + " · " + esc(i.title) + "</b><span>" + i.into + " / " + i.need + " XP" +
      (s.streak > 1 && s.last === day() ? " · 🔥 " + s.streak + " days" : "") + "</span></div>" + (opt.noPanel ? "" : '<button class="xp-more" type="button">Levels</button>') + "</div>" + bar(i) +
      (next ? '<div class="xp-next">Level ' + next.lvl + " unlocks the " + esc(next.name) + " " + next.kind + "</div>" : "") + '<div class="xp-panel hide"></div>';
    const b = el.querySelector(".xp-more");
    if (b) b.onclick = () => { const p = el.querySelector(".xp-panel"); const open = p.classList.toggle("hide") === false; b.textContent = open ? "Close" : "Levels"; if (open) panel(p); };
  };
  paint();
  const up = () => { if (!el.querySelector(".xp-panel:not(.hide)")) paint(); };
  document.addEventListener("wsb-xp", up);
  addEventListener("storage", e => { if (e.key === KEY) up(); });
  return { paint };
}
function panel(el) {
  const i = info(), s = read();
  const row = u => {
    const got = i.level >= u.lvl, on = s[u.kind] === u.id, here = u.kind === "frame" || IS_WIN;
    return '<div class="xp-u' + (got ? "" : " locked") + '"><span class="xp-sw xp-' + u.kind + "-" + u.id + '"></span><div><b>' + esc(u.name) + " " + u.kind + "</b><span>" +
      (got ? esc(u.what) : "Level " + u.lvl) + (here ? "" : " · on the PC") + "</span></div>" +
      (got && here ? '<button type="button" data-k="' + u.kind + '" data-id="' + (on ? "" : u.id) + '">' + (on ? "Take off" : "Wear") + "</button>" : got ? "" : "<em>🔒</em>") + "</div>";
  };
  el.innerHTML = '<div class="xp-how">Finish games for XP (more for wins and harder levels), unlock achievements, and come back each day.</div>' +
    UNLOCKS.map(row).join("") + ((s.log || []).length ? '<div class="xp-log"><b>Lately</b>' + s.log.slice(0, 6).map(l => "<span>+" + l.n + " · " + esc(l.why) + "</span>").join("") + "</div>" : "");
  el.querySelectorAll("button[data-k]").forEach(b => { b.onclick = () => { choose(b.dataset.k, b.dataset.id); panel(el); }; });
}

const st = document.createElement("style");
st.textContent = `
.xp-card{border-radius:16px;padding:12px 14px;background:var(--bg2,#1e1a24);color:var(--fg,#f3eff1);border:1px solid var(--line,#322c3c);text-align:left}
.xp-top{display:flex;align-items:center;gap:10px}.xp-top>div{flex:1;min-width:0}.xp-top b{display:block;font-size:14px}.xp-top span{font-size:12px;color:var(--dim,#9a91a3)}
.xp-lv{width:38px;height:38px;flex:none;border-radius:50%;display:grid;place-items:center;font:800 16px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);background:radial-gradient(circle at 32% 28%,color-mix(in srgb,var(--accent,#e8342a) 55%,#fff),var(--accent,#e8342a) 55%,color-mix(in srgb,var(--accent,#e8342a) 65%,#000));box-shadow:0 4px 12px color-mix(in srgb,var(--accent,#e8342a) 40%,transparent),inset 0 0 0 2px rgba(255,255,255,.25)}
.xp-more,.xp-u button{height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--line,#322c3c);background:var(--bg3,#272230);color:var(--fg,#f3eff1);font:600 12px system-ui,sans-serif;cursor:pointer}
.xp-bar{height:7px;border-radius:4px;background:var(--bg3,#272230);margin-top:10px;overflow:hidden}.xp-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--accent,#e8342a),color-mix(in srgb,var(--accent,#e8342a) 55%,#fff));transition:width .6s cubic-bezier(.2,.9,.3,1)}
.xp-next{font-size:11.5px;color:var(--dim,#9a91a3);margin-top:6px}.xp-card .hide{display:none}
.xp-panel{margin-top:10px;border-top:1px solid var(--line,#322c3c);padding-top:8px}.xp-how{font-size:12px;color:var(--dim,#9a91a3);margin-bottom:6px}
.xp-u{display:flex;align-items:center;gap:10px;padding:6px 0}.xp-u>div{flex:1;min-width:0}.xp-u b{display:block;font-size:13px}.xp-u span{font-size:11.5px;color:var(--dim,#9a91a3)}.xp-u em{font-style:normal}
.xp-u.locked{opacity:.55}.xp-sw{width:30px;height:22px;flex:none;border-radius:6px;background:var(--bg3,#272230)}
.xp-log{display:flex;flex-direction:column;font-size:12px;color:var(--dim,#9a91a3);margin-top:8px}.xp-log b{color:var(--fg,#f3eff1);font-size:12px}
.xp-pop{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,30px);opacity:0;z-index:99999;pointer-events:none;padding:8px 16px;border-radius:999px;
  background:color-mix(in srgb,var(--accent,#e8342a) 90%,#000);color:#fff;font:700 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:transform .35s cubic-bezier(.2,.9,.3,1.3),opacity .3s}
.xp-pop.on{transform:translate(-50%,0);opacity:1}.xp-pop.big{font-size:15px;padding:12px 20px}
/* frames: on the level card and the start page's anime card (a ring drawn over its edge, so its own look stays) */
.xp-card,.xp-sw{position:relative}
.xp-sw.xp-frame-glow,html[data-xpframe="glow"] :is(.xp-card,.an-card){box-shadow:0 0 0 1px var(--accent,#e8342a),0 0 22px color-mix(in srgb,var(--accent,#e8342a) 55%,transparent)}
.xp-sw.xp-frame-neon,html[data-xpframe="neon"] :is(.xp-card,.an-card){box-shadow:0 0 0 2px #2ef2ff,0 0 14px #2ef2ff;animation:xpNeon 2.6s infinite}
:is(.xp-frame-gold,.xp-frame-holo,.xp-frame-crown)::after,html:is([data-xpframe="gold"],[data-xpframe="holo"],[data-xpframe="crown"]) :is(.xp-card,.an-card)::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:3px;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:6;background-size:300% 100%;animation:xpShine 5s linear infinite}
.xp-frame-gold::after,html[data-xpframe="gold"] :is(.xp-card,.an-card)::after{background-image:linear-gradient(120deg,#8a6a1f,#ffe08a,#b8862b,#fff3c4,#8a6a1f)}
.xp-frame-holo::after,html[data-xpframe="holo"] :is(.xp-card,.an-card)::after{background-image:linear-gradient(90deg,#ff6ad5,#c774e8,#ad8cff,#8795e8,#94d0ff,#6affc7,#ff6ad5);animation-duration:3s}
.xp-frame-crown::after,html[data-xpframe="crown"] :is(.xp-card,.an-card)::after{background-image:linear-gradient(120deg,#f5c242,#fff1b8,#f5c242);padding:2px}
html[data-xpframe="holo"] :is(.xp-card,.an-card){box-shadow:0 0 18px rgba(173,140,255,.35)}html[data-xpframe="crown"] :is(.xp-card,.an-card){box-shadow:0 0 16px rgba(245,194,66,.45)}
html[data-xpframe="crown"] .xp-card::before{content:"👑";position:absolute;top:-15px;left:12px;font-size:20px;transform:rotate(-12deg)}
@keyframes xpShine{to{background-position:300% 0}}@keyframes xpNeon{0%,90%,100%{opacity:1}93%{opacity:.6}96%{opacity:1}}
/* band effects (Windows): the band across the top of the window */
.xp-sw.xp-band-sparkle,html[data-xpband="sparkle"] .anband{background:radial-gradient(circle,#fff 0 1px,transparent 2px) 0 0/18px 100%,linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 40%,#fff),var(--accent))!important;animation:xpSpark 1.2s linear infinite!important}
.xp-sw.xp-band-rainbow,html[data-xpband="rainbow"] .anband{background:linear-gradient(90deg,#ff3b3b,#ff9f1c,#ffe14d,#3ddc84,#2ec7ff,#7c5cff,#ff3b3b)!important;background-size:200% 100%!important;animation:xpRun 3s linear infinite!important}
.xp-sw.xp-band-comet,html[data-xpband="comet"] .anband{background:linear-gradient(90deg,transparent 0 40%,color-mix(in srgb,var(--accent) 40%,transparent) 55%,#fff 60%,transparent 61%) 0 0/200% 100% no-repeat!important;animation:xpComet 2.2s cubic-bezier(.5,0,.5,1) infinite!important}
.xp-sw.xp-band-fire,html[data-xpband="fire"] .anband{height:4px!important;background:linear-gradient(90deg,#ff2d00,#ff9500,#ffd000,#ff9500,#ff2d00)!important;background-size:60px 100%!important;box-shadow:0 0 10px #ff6a00!important;animation:xpRun 1s linear infinite,xpFlick .3s steps(2) infinite!important}
.xp-sw.xp-band-aurora,html[data-xpband="aurora"] .anband{height:5px!important;background:linear-gradient(90deg,#00ffa3,#03e1ff,#a64dff,#00ffa3)!important;background-size:300% 100%!important;filter:blur(.5px);box-shadow:0 0 14px rgba(3,225,255,.6)!important;animation:xpRun 8s ease-in-out infinite alternate!important}
html[data-xpband] .anband{display:block!important}
@keyframes xpRun{to{background-position:-200% 0}}@keyframes xpSpark{to{background-position:-18px 0,0 0}}@keyframes xpComet{from{background-position:120% 0}to{background-position:-120% 0}}@keyframes xpFlick{50%{opacity:.8}}
html[data-motion="off"] .anband,html[data-motion="off"] :is(.xp-card,.an-card),html[data-motion="off"] :is(.xp-card,.an-card)::after{animation:none!important}
`;
(document.head || document.documentElement).appendChild(st);

wear();
addEventListener("storage", e => { if (e.key === KEY) wear(); });
document.addEventListener("wsb-xp", wear);
// the daily XP and achievements are counted by the browser window (Windows) or the app (iPhone), and the games'
// counters by the games page, so two pages never count the same thing twice
const page = location.pathname.split("/").pop();
const MAIN = page === "chrome.html" || (!IS_WIN && (page === "" || page === "index.html")), GAMES = page === "games.html";
function mine() {        // one window at a time
  const now = Date.now(), at = +localStorage.getItem("wsb.xpLock") || 0;
  if (now - at < 4000 && sessionStorage.getItem("wsb.xpMe") !== String(at)) return false;
  try { localStorage.setItem("wsb.xpLock", String(now)); sessionStorage.setItem("wsb.xpMe", String(now)); } catch (e) {}
  return true;
}
const tick = () => { if (PRIVATE || document.hidden) return; if (MAIN && mine()) { daily(); watchAch(); } if (GAMES) watchGames(); };
if (document.body) setTimeout(tick, 400); else addEventListener("DOMContentLoaded", () => setTimeout(tick, 400));
setInterval(tick, 2500);
// Snake and 2048 have no wins to count: finishing a game is worth a little XP
if (window.Live && typeof Live.gameOver === "function") {
  const g0 = Live.gameOver;
  Live.gameOver = function (g) { const r = g0.apply(this, arguments); if (g === "snake" || g === "2048") game(g, false, 1); return r; };
}
window.XP = { ready:true, add:(n, why) => add(n, why, false), game, info, card, panel, choose, unlocked, UNLOCKS, need, read };
})();
