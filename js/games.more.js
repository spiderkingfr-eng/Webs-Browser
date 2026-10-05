/* Webs Browser - four more games, for the iPhone app (../games.html) and the Windows browser (its games.html):
   Sudoku, Solitaire, Chess against the computer and Blocks. Each one adds its own tab and section to the page
   it's on, works with a mouse, a keyboard or a finger, keeps a game in progress (wsb.gm.<game>) for when you
   come back, and its best times and scores in wsb.games, like the others. A finished game tells js/xp.js.
   games.html#sudoku (#solitaire, #chess, #blocks) opens one directly.
   GamesMore.sudoku / .solitaire / .chess / .blocks hold each game's insides, for the tests. */
(function () {
"use strict";
const tabs = document.querySelector(".tabs");
if (!tabs || window.GamesMore) return;
const ios = !!tabs.querySelector(".ge");
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const $ = id => document.getElementById(id);
const fmt = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const xp = (game, won, n) => { try { if (window.XP) XP.game(game, won, n); } catch (e) {} };
const bests = () => get("games", {});
// a new best: lower is better for times and moves, higher for scores
function best(key, v, lower) {
  const b = bests();
  if (b[key] == null || (lower ? v < b[key] : v > b[key])) { b[key] = v; put("games", b); paintBests(); return true; }
  return false;
}
const cur = () => { const s = document.querySelector(".g.on"); return s ? s.id : ""; };
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
function open(id) {
  if (typeof window.pickGame === "function") { window.pickGame(id); return; }      // the iPhone page's own way
  try { game = id; } catch (e) {}                                                    // eslint-disable-line no-undef
  try { snPause = true; } catch (e) {}                                               // eslint-disable-line no-undef
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x.dataset.g === id));
  document.querySelectorAll(".g").forEach(x => x.classList.toggle("on", x.id === id));
}
// your level, above the games (js/xp.js)
if (window.XP && XP.card && !/[?&]private=1/.test(location.search)) { const x = document.createElement("div"); x.className = "gm-xp"; tabs.before(x); XP.card(x); }
const GAMES = [];
function add(id, emoji, name, html, onShow) {
  const b = document.createElement("button");
  b.dataset.g = id;
  b.innerHTML = (ios ? '<span class="ge">' + emoji + "</span>" : "") + name + ' <em id="b_' + id + '"></em>';
  tabs.appendChild(b);
  const s = document.createElement("section");
  s.className = "g gm"; s.id = id; s.innerHTML = html;
  const all = document.querySelectorAll("section.g"), last = all[all.length - 1];
  if (last) last.after(s); else tabs.after(s);
  b.addEventListener("click", () => { open(id); onShow(); });
  GAMES.push({ id, onShow });
  return s;
}
function paintBests() {
  const b = bests(), set = (id, v) => { const e = $("b_" + id); if (e) e.textContent = v ? (ios ? "" : "· ") + v : ""; };
  set("sudokuG", b.sudoku_easy || b.sudoku_med || b.sudoku_hard ? "Best " + fmt(Math.min(...["easy", "med", "hard"].map(k => b["sudoku_" + k] || 1e9))) : "");
  set("solG", b.solWins ? b.solWins + " won" : "");
  set("chessG", b.chessWins ? b.chessWins + " won" : "");
  set("blocksG", b.blocks ? (ios ? "Best " : "") + b.blocks : "");
}
// a timer for the game on screen, while the page is
function ticker(id, fn) { setInterval(() => { if (!document.hidden && cur() === id) fn(); }, 1000); }

/* ================================================================ Sudoku
   Every puzzle is made here: a full grid filled at random, then numbers taken away one at a time, each
   only if the puzzle still has exactly one answer. Notes, mistakes shown at once, a hint, best times. */
const SD = (function () {
  const box = i => ((i / 27 | 0) * 3 + ((i % 9) / 3 | 0));
  const PEERS = [];
  for (let i = 0; i < 81; i++) { const p = []; for (let j = 0; j < 81; j++) if (j !== i && ((j / 9 | 0) === (i / 9 | 0) || j % 9 === i % 9 || box(j) === box(i))) p.push(j); PEERS.push(p); }
  const pop = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  function cands(g, i) { let m = 0x3fe; const p = PEERS[i]; for (let k = 0; k < 20; k++) if (g[p[k]]) m &= ~(1 << g[p[k]]); return m; }
  function pick(g) {      // the empty cell with the fewest possibilities
    let at = -1, bm = 0, bn = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) { const m = cands(g, i), n = pop(m); if (n < bn) { bn = n; at = i; bm = m; if (n < 2) break; } }
    return [at, bm, bn];
  }
  function fill(g) {
    const [at, m] = pick(g);
    if (at < 0) return true;
    const ds = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) ds.push(d);
    for (const d of shuffle(ds)) { g[at] = d; if (fill(g)) return true; }
    g[at] = 0; return false;
  }
  function count(g, max) {
    const [at, m, n] = pick(g);
    if (at < 0) return 1;
    if (!n) return 0;
    let t = 0;
    for (let d = 1; d <= 9 && t < max; d++) if (m & (1 << d)) { g[at] = d; t += count(g, max - t); }
    g[at] = 0; return t;
  }
  const HOLES = { easy:36, med:46, hard:53 };
  function make(lvl) {
    const sol = new Array(81).fill(0); fill(sol);
    const p = sol.slice(), want = HOLES[lvl] || 46;
    let gone = 0;
    for (const i of shuffle([...Array(81).keys()])) {
      if (gone >= want) break;
      const v = p[i]; p[i] = 0;
      if (count(p, 2) !== 1) p[i] = v; else gone++;
    }
    return { p, sol };
  }
  return { make, count, PEERS, box };
})();
(function () {
  const sec = add("sudokuG", "🔢", "Sudoku", '<div class="gm-bar"><b id="sdStat"></b><div class="gm-seg" id="sdLvl"><button data-v="easy">Easy</button><button data-v="med">Medium</button><button data-v="hard">Hard</button></div>' +
    '<button class="gm-act" id="sdNew">New game</button></div><div class="sd-grid" id="sdG"></div><div class="sd-pad" id="sdPad"></div><div class="gm-msg" id="sdMsg"></div>', show);
  let S = get("gm.sudoku", null), sel = -1, notes = false, lvl = (S && S.lvl) || "easy";
  const G = $("sdG"), pad = $("sdPad");
  for (let i = 0; i < 81; i++) { const b = document.createElement("button"); b.dataset.i = i; G.appendChild(b); }
  pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => '<button data-d="' + d + '">' + d + "</button>").join("") +
    '<button data-k="notes" title="Notes (N)">✏️ Notes</button><button data-k="erase" title="Erase (Delete)">⌫</button><button data-k="hint" title="Hint">💡</button>';
  function fresh() {
    $("sdMsg").textContent = "Making a puzzle…";
    setTimeout(() => {
      const m = SD.make(lvl);
      S = { lvl, p:m.p, sol:m.sol, v:m.p.slice(), n:new Array(81).fill(0), t:0, mis:0, hints:0, done:false };
      sel = -1; save(); paint(); $("sdMsg").textContent = "";
    }, 20);
  }
  const save = () => put("gm.sudoku", S);
  function paint() {
    if (!S) return;
    const sv = sel >= 0 ? S.v[sel] : 0;
    [...G.children].forEach((b, i) => {
      const v = S.v[i], given = !!S.p[i];
      b.className = (given ? "giv" : "") + (i === sel ? " sel" : "") + (sel >= 0 && i !== sel && SD.PEERS[sel].indexOf(i) >= 0 ? " peer" : "") +
        (v && sv && v === sv && i !== sel ? " same" : "") + (v && v !== S.sol[i] ? " bad" : "") + ((i % 9) % 3 === 2 && i % 9 < 8 ? " rb" : "") + (((i / 9 | 0) % 3 === 2) && i < 72 ? " bb" : "");
      if (v) b.textContent = v;
      else if (S.n[i]) { b.innerHTML = '<span class="nt">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => "<i>" + (S.n[i] & (1 << d) ? d : "") + "</i>").join("") + "</span>"; }
      else b.textContent = "";
    });
    // a digit that's on the board nine times is done
    const left = {}; S.v.forEach((v, i) => { if (v && v === S.sol[i]) left[v] = (left[v] || 0) + 1; });
    pad.querySelectorAll("[data-d]").forEach(b => b.classList.toggle("done", left[b.dataset.d] === 9));
    pad.querySelector('[data-k="notes"]').classList.toggle("on", notes);
    [...$("sdLvl").children].forEach(b => b.classList.toggle("on", b.dataset.v === lvl));
    $("sdStat").textContent = { easy:"Easy", med:"Medium", hard:"Hard" }[S.lvl] + " · " + fmt(S.t) + " · Mistakes " + S.mis;
  }
  function put1(d) {
    if (!S || S.done || sel < 0 || S.p[sel]) return;
    if (notes && d) { if (!S.v[sel]) S.n[sel] ^= 1 << d; }
    else if (!d) { S.v[sel] = 0; S.n[sel] = 0; }
    else {
      if (S.v[sel] === d) return;
      S.v[sel] = d; S.n[sel] = 0;
      if (d !== S.sol[sel]) { S.mis++; G.children[sel].classList.add("shake"); }
      else SD.PEERS[sel].forEach(j => { S.n[j] &= ~(1 << d); });      // its notes go from the row, column and box
    }
    check(); save(); paint();
  }
  function check() {
    if (S.v.every((v, i) => v === S.sol[i])) {
      S.done = true;
      const nb = best("sudoku_" + S.lvl, S.t, true);
      $("sdMsg").textContent = "🎉 Solved in " + fmt(S.t) + (S.mis ? " with " + S.mis + " mistake" + (S.mis > 1 ? "s" : "") : ", no mistakes") + (nb ? " · a new best!" : "");
      const b = bests(); b.sudokuWins = (b.sudokuWins || 0) + 1; put("games", b);
      xp("sudoku", true, { easy:1, med:2, hard:3 }[S.lvl]);
      G.classList.add("win"); setTimeout(() => G.classList.remove("win"), 1400);
    }
  }
  G.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; sel = +b.dataset.i; paint(); });
  pad.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.d) put1(+b.dataset.d);
    else if (b.dataset.k === "notes") { notes = !notes; paint(); }
    else if (b.dataset.k === "erase") put1(0);
    else if (b.dataset.k === "hint" && S && !S.done) {
      let i = sel >= 0 && S.v[sel] !== S.sol[sel] ? sel : S.v.findIndex((v, k) => v !== S.sol[k]);
      if (i < 0) return;
      sel = i; S.v[i] = S.sol[i]; S.n[i] = 0; S.hints++; check(); save(); paint();
    }
  });
  $("sdLvl").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; lvl = b.dataset.v; fresh(); });
  $("sdNew").onclick = fresh;
  addEventListener("keydown", e => {
    if (cur() !== "sudokuG" || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) put1(+e.key);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") put1(0);
    else if (e.key === "n" || e.key === "N") { notes = !notes; paint(); }
    else if (/^Arrow/.test(e.key)) {
      e.preventDefault(); if (sel < 0) sel = 40;
      const r = sel / 9 | 0, c = sel % 9;
      sel = e.key === "ArrowUp" ? ((r + 8) % 9) * 9 + c : e.key === "ArrowDown" ? ((r + 1) % 9) * 9 + c : e.key === "ArrowLeft" ? r * 9 + (c + 8) % 9 : r * 9 + (c + 1) % 9;
      paint();
    } else return;
    e.preventDefault();
  });
  ticker("sudokuG", () => { if (S && !S.done) { S.t++; if (S.t % 5 === 0) save(); $("sdStat").textContent = { easy:"Easy", med:"Medium", hard:"Hard" }[S.lvl] + " · " + fmt(S.t) + " · Mistakes " + S.mis; } });
  function show() { if (!S) fresh(); else paint(); }
  sec.dataset.ready = "1";
  SD.ui = { state:() => S, select:i => { sel = i; paint(); }, put:put1, fresh:l => { lvl = l || lvl; fresh(); } };
})();

/* ================================================================ Solitaire (Klondike)
   Tap a card and it goes where it can (a foundation first), or drag it. Draw one or three, as many times
   through the deck as you like, undo, and Finish moves everything up once all the cards are showing. */
const SO = (function () {
  const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const red = c => c.s === 1 || c.s === 2;
  function deal(draw) {
    const deck = shuffle([...Array(52).keys()].map(i => ({ s:i / 13 | 0, r:i % 13 + 1, u:false })));
    const t = [[], [], [], [], [], [], []];
    for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) t[j].push(deck.pop());
    t.forEach(col => { col[col.length - 1].u = true; });
    return { stock:deck, waste:[], f:[[], [], [], []], t, draw:draw || 1, moves:0, time:0, done:false };
  }
  const top = a => a[a.length - 1];
  function canF(S, c, fi) { const f = S.f[fi], tp = top(f); return tp ? tp.s === c.s && c.r === tp.r + 1 : c.r === 1; }
  function canT(S, c, ti) { const tp = top(S.t[ti]); return tp ? tp.u && red(tp) !== red(c) && tp.r === c.r + 1 : c.r === 13; }
  // where a card is: { pile:"t"|"w"|"f", i (which pile), k (place in it) }
  function find(S, id) {
    for (let i = 0; i < 7; i++) { const k = S.t[i].findIndex(c => c.s * 13 + c.r - 1 === id); if (k >= 0) return { pile:"t", i, k }; }
    for (let i = 0; i < 4; i++) { const k = S.f[i].findIndex(c => c.s * 13 + c.r - 1 === id); if (k >= 0) return { pile:"f", i, k }; }
    let k = S.waste.findIndex(c => c.s * 13 + c.r - 1 === id); if (k >= 0) return { pile:"w", i:0, k };
    k = S.stock.findIndex(c => c.s * 13 + c.r - 1 === id); if (k >= 0) return { pile:"s", i:0, k };
    return null;
  }
  const pileOf = (S, w) => w.pile === "t" ? S.t[w.i] : w.pile === "f" ? S.f[w.i] : w.pile === "w" ? S.waste : S.stock;
  // the cards that would move from there (a run in a column; the top card anywhere else), or null
  function lift(S, w) {
    const p = pileOf(S, w);
    if (w.pile === "s" || !p[w.k] || !p[w.k].u) return null;
    if (w.pile !== "t" && w.k !== p.length - 1) return null;
    return p.slice(w.k);
  }
  function move(S, w, to) {      // to: { pile:"t"|"f", i }; true if it was allowed and done
    const cards = lift(S, w);
    if (!cards) return false;
    if (to.pile === "f" && (cards.length !== 1 || !canF(S, cards[0], to.i))) return false;
    if (to.pile === "t" && (!canT(S, cards[0], to.i) || (w.pile === "t" && w.i === to.i))) return false;
    if (to.pile === "f" && w.pile === "f" && w.i === to.i) return false;
    pileOf(S, w).splice(w.k);
    (to.pile === "f" ? S.f[to.i] : S.t[to.i]).push(...cards);
    if (w.pile === "t" && S.t[w.i].length) top(S.t[w.i]).u = true;
    S.moves++;
    if (S.f.every(f => f.length === 13)) S.done = true;
    return true;
  }
  // the best place for a card that's tapped: up to a foundation, else a column (one with cards first)
  function auto(S, w) {
    const cards = lift(S, w); if (!cards) return false;
    if (cards.length === 1) for (let i = 0; i < 4; i++) if (move(S, w, { pile:"f", i })) return true;
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => (S.t[a].length ? 0 : 1) - (S.t[b].length ? 0 : 1));
    for (const i of order) { if (cards[0].r === 13 && w.pile === "t" && w.k === 0 && !S.t[i].length) continue; if (move(S, w, { pile:"t", i })) return true; }
    return false;
  }
  function draw(S) {
    if (!S.stock.length) { if (!S.waste.length) return false; S.stock = S.waste.reverse().map(c => ({ ...c, u:false })); S.waste = []; S.moves++; return true; }
    for (let i = 0; i < S.draw && S.stock.length; i++) { const c = S.stock.pop(); c.u = true; S.waste.push(c); }
    S.moves++; return true;
  }
  const canFinish = S => !S.done && !S.stock.length && !S.waste.length && S.t.every(col => col.every(c => c.u));
  // one card up to its foundation (the lowest one first), for Finish
  function step(S) {
    let bestW = null, bestR = 99;
    S.t.forEach((col, i) => { const c = top(col); if (c && c.r < bestR) { for (let f = 0; f < 4; f++) if (canF(S, c, f)) { bestW = { w:{ pile:"t", i, k:col.length - 1 }, f }; bestR = c.r; break; } } });
    if (!bestW) return false;
    return move(S, bestW.w, { pile:"f", i:bestW.f });
  }
  return { SUITS, RANKS, red, deal, canF, canT, find, lift, move, auto, draw, canFinish, step, top };
})();
(function () {
  const sec = add("solG", "🂡", "Solitaire", '<div class="gm-bar"><b id="soStat"></b><div class="gm-seg" id="soDraw"><button data-v="1">Draw 1</button><button data-v="3">Draw 3</button></div>' +
    '<span class="gm-btns"><button class="gm-act" id="soUndo">Undo</button><button class="gm-act" id="soNew">New game</button></span></div><div class="so-board" id="soB"></div>' +
    '<div class="gm-msg" id="soMsg"></div><div class="gm-hud" style="justify-content:center"><button class="gm-act gm-main hide" id="soFin">Finish</button></div>', show);
  let S = get("gm.sol", null), undo = [], drawN = (S && S.draw) || 1;
  const B = $("soB"), els = new Map(), slots = [];
  // the empty places: stock, waste, four foundations, seven columns
  ["s", "w", "f0", "f1", "f2", "f3", "t0", "t1", "t2", "t3", "t4", "t5", "t6"].forEach(k => { const d = document.createElement("div"); d.className = "so-slot " + (k[0] === "f" ? "so-f" : k === "s" ? "so-s" : ""); d.dataset.k = k; B.appendChild(d); slots.push(d); });
  for (let id = 0; id < 52; id++) {
    const c = { s:id / 13 | 0, r:id % 13 + 1 }, d = document.createElement("div");
    d.className = "so-c" + (SO.red(c) ? " red" : ""); d.dataset.id = id;
    d.innerHTML = '<span class="so-k">' + SO.RANKS[c.r] + "<b>" + SO.SUITS[c.s] + '</b></span><span class="so-m">' + (c.r > 10 ? SO.RANKS[c.r] : "") + SO.SUITS[c.s] + "</span>";
    B.appendChild(d); els.set(id, d);
  }
  let L = { cw:60, ch:84, gap:8, x:[], top:0 };
  const idOf = c => c.s * 13 + c.r - 1;
  function layout() {
    const W = Math.min(B.parentNode.clientWidth || 600, 640), gap = Math.max(4, Math.round(W / 80)), cw = Math.floor((W - gap * 8) / 7), ch = Math.round(cw * 1.4);
    L = { cw, ch, gap, x:[...Array(7).keys()].map(i => gap + i * (cw + gap)), top:ch + gap * 2, W };
    B.style.width = W + "px"; B.style.setProperty("--cw", cw + "px"); B.style.setProperty("--ch", ch + "px");
  }
  function paint(anim) {
    if (!S) return;
    layout();
    const { cw, ch, gap, x, top } = L;
    const place = (k, px, py) => { const s = slots.find(d => d.dataset.k === k); s.style.cssText = "left:" + px + "px;top:" + py + "px"; };
    place("s", x[0], gap); place("w", x[1], gap); for (let i = 0; i < 4; i++) place("f" + i, x[3 + i], gap); for (let i = 0; i < 7; i++) place("t" + i, x[i], top);
    let z = 1, maxY = top + ch;
    const seen = new Set();
    const pos = (c, px, py, up) => {
      const d = els.get(idOf(c)); seen.add(d); d.hidden = false;
      d.classList.toggle("up", up); d.classList.toggle("anim", !!anim);
      d.style.left = px + "px"; d.style.top = py + "px"; d.style.zIndex = z++; d.style.transform = "";
    };
    S.stock.forEach((c, i) => pos(c, x[0] - Math.min(i, 3) * .5, gap - Math.min(i, 3) * .5, false));
    const wn = S.waste.length, fan = S.draw === 3 ? Math.round(cw * .28) : 0;
    S.waste.forEach((c, i) => pos(c, x[1] + Math.max(0, i - Math.max(0, wn - 3)) * fan, gap, true));      // draw 3: the last three fanned
    S.f.forEach((f, i) => f.forEach(c => pos(c, x[3 + i], gap, true)));
    // columns: face-down cards close together, face-up ones further apart, squeezed when a column gets long
    const room = Math.max(ch * 3, (innerHeight || 800) - B.getBoundingClientRect().top - top - ch - 40);
    S.t.forEach((col, i) => {
      const down = col.filter(c => !c.u).length, upN = col.length - down;
      let dd = Math.round(ch * .12), du = Math.round(ch * .27);
      const need = down * dd + Math.max(0, upN - 1) * du;
      if (need > room) { const k = room / need; dd = Math.max(4, Math.floor(dd * k)); du = Math.max(12, Math.floor(du * k)); }
      let y = top;
      col.forEach(c => { pos(c, x[i], y, c.u); y += c.u ? du : dd; });
      maxY = Math.max(maxY, y - (col.length ? (col[col.length - 1].u ? du : dd) : 0) + ch);
    });
    els.forEach(d => { if (!seen.has(d)) d.hidden = true; });
    B.style.height = Math.max(maxY + gap, top + ch * 4) + "px";
    slots[0].classList.toggle("empty", !S.stock.length); slots[0].classList.toggle("again", !S.stock.length && !!S.waste.length);
    [...$("soDraw").children].forEach(b => b.classList.toggle("on", +b.dataset.v === drawN));
    $("soStat").textContent = "Moves " + S.moves + " · " + fmt(S.time);
    $("soFin").classList.toggle("hide", !SO.canFinish(S));
    $("soUndo").disabled = !undo.length;
  }
  const save = () => put("gm.sol", S);
  const snap = () => { undo.push(JSON.stringify(S)); if (undo.length > 200) undo.shift(); };
  function fresh() { S = SO.deal(drawN); undo = []; $("soMsg").textContent = ""; save(); paint(); }
  function won() {
    if (!S.done) return;
    const b = bests(); b.solWins = (b.solWins || 0) + 1; put("games", b);
    const nb = best("sol_" + S.draw, S.time, true);
    $("soMsg").textContent = "🎉 You won in " + S.moves + " moves and " + fmt(S.time) + (nb ? " · a new best!" : "");
    xp("solitaire", true, S.draw === 3 ? 3 : 2);
    B.classList.add("win");
    [...els.values()].forEach((d, i) => { d.style.transitionDelay = (i % 13) * 40 + "ms"; d.style.transform = "translateY(-14px) rotate(" + ((i % 7) - 3) * 3 + "deg)"; });
    setTimeout(() => { B.classList.remove("win"); els.forEach(d => { d.style.transitionDelay = ""; d.style.transform = ""; }); }, 1600);
  }
  function act(fn) { const before = JSON.stringify(S); if (fn()) { undo.push(before); if (undo.length > 200) undo.shift(); save(); paint(true); won(); return true; } return false; }

  // tapping, and dragging
  let drag = null;
  B.addEventListener("pointerdown", e => {
    if (!S || S.done) return;
    const d = e.target.closest(".so-c"), slot = e.target.closest(".so-slot");
    if (!d) { if (slot && slot.dataset.k === "s") act(() => SO.draw(S)); return; }
    const w = SO.find(S, +d.dataset.id);
    if (!w) return;
    if (w.pile === "s") { act(() => SO.draw(S)); return; }
    const cards = SO.lift(S, w);
    if (!cards) return;
    e.preventDefault();
    drag = { w, ids:cards.map(idOf), x:e.clientX, y:e.clientY, moved:false, pid:e.pointerId };
    try { B.setPointerCapture(e.pointerId); } catch (x) {}
  });
  B.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    drag.ids.forEach((id, i) => { const d = els.get(id); d.classList.remove("anim"); d.classList.add("drag"); d.style.zIndex = 200 + i; d.style.transform = "translate(" + dx + "px," + dy + "px)"; });
  });
  B.addEventListener("pointerup", e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dr = drag; drag = null;
    dr.ids.forEach(id => els.get(id).classList.remove("drag"));
    if (!dr.moved) { if (!act(() => SO.auto(S, dr.w))) { const d = els.get(dr.ids[0]); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake"); } return; }
    // dropped on a column or a foundation
    const r = B.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, { cw, ch, x, gap, top } = L;
    let to = null;
    for (let i = 0; i < 7 && !to; i++) if (mx >= x[i] - gap / 2 && mx <= x[i] + cw + gap / 2 && my >= top - gap) to = { pile:"t", i };
    for (let i = 0; i < 4 && !to; i++) if (mx >= x[3 + i] - gap / 2 && mx <= x[3 + i] + cw + gap / 2 && my <= gap + ch + gap) to = { pile:"f", i };
    if (!to || !act(() => SO.move(S, dr.w, to))) paint(true);
  });
  B.addEventListener("pointercancel", () => { if (drag) { drag = null; paint(true); } });
  $("soUndo").onclick = () => { if (!undo.length) return; S = JSON.parse(undo.pop()); S.moves++; save(); paint(true); };
  $("soNew").onclick = fresh;
  $("soDraw").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; drawN = +b.dataset.v; fresh(); });
  $("soFin").onclick = () => {
    snap();
    const go = () => { if (SO.step(S)) { save(); paint(true); if (S.done) won(); else setTimeout(go, 70); } };
    go();
  };
  addEventListener("keydown", e => {
    if (cur() !== "solG" || typing(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); $("soUndo").click(); }
    else if (e.key === " " && !e.ctrlKey) { e.preventDefault(); act(() => SO.draw(S)); }
  });
  addEventListener("resize", () => { if (cur() === "solG") paint(); });
  ticker("solG", () => { if (S && !S.done && S.moves) { S.time++; if (S.time % 5 === 0) save(); $("soStat").textContent = "Moves " + S.moves + " · " + fmt(S.time); } });
  function show() { if (!S) fresh(); else requestAnimationFrame(() => paint()); }
  SO.ui = { state:() => S, set:s => { S = s; undo = []; save(); paint(); }, act, paint };
  sec.dataset.ready = "1";
})();

/* ================================================================ Chess against the computer
   The whole of chess (castling, en passant, promotion, check, mate, stalemate, the 50-move rule, three
   times the same position and too little to mate with). The computer looks ahead a little on Easy and
   further on Hard, for a moment at most. Play white or black, take a move back, flip the board. */
const CH = (function () {
  const VAL = { p:100, n:320, b:330, r:500, q:900, k:0 };
  // how good each square is for each piece (white's view, rank 8 first), from Tomasz Michniewski's simplified evaluation
  const PST = {
    p:[0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b:[-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r:[0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    ke:[-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  const isW = p => p && p === p.toUpperCase(), lower = p => p.toLowerCase();
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  function fromFen(fen) {
    const [pl, side, cas, ep, hm, fm] = fen.split(/\s+/), b = [];
    pl.split("/").forEach(row => { for (const ch of row) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(""); else b.push(ch); } });
    return { b, w:side === "w", c:cas === "-" ? "" : cas, ep:ep === "-" ? -1 : sq(ep), hm:+hm || 0, fm:+fm || 1 };
  }
  const sq = n => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
  const name = i => String.fromCharCode(97 + i % 8) + (8 - (i / 8 | 0));
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function attacked(b, s, byW) {
    const r = s >> 3, c = s & 7, at = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null;
    const own = p => p && isW(p) === byW;
    // pawns attack forwards: a white pawn below-left/right of the square
    const pr = byW ? r + 1 : r - 1, pp = byW ? "P" : "p";
    if (at(pr, c - 1) === pp || at(pr, c + 1) === pp) return true;
    for (const [dr, dc] of KN) { const p = at(r + dr, c + dc); if (own(p) && lower(p) === "n") return true; }
    for (const [dr, dc] of KG) { const p = at(r + dr, c + dc); if (own(p) && lower(p) === "k") return true; }
    for (const [dr, dc] of DIAG) for (let k = 1; k < 8; k++) { const p = at(r + dr * k, c + dc * k); if (p === null) break; if (p) { if (own(p) && (lower(p) === "b" || lower(p) === "q")) return true; break; } }
    for (const [dr, dc] of ORTH) for (let k = 1; k < 8; k++) { const p = at(r + dr * k, c + dc * k); if (p === null) break; if (p) { if (own(p) && (lower(p) === "r" || lower(p) === "q")) return true; break; } }
    return false;
  }
  const king = (b, w) => b.indexOf(w ? "K" : "k");
  const inCheck = (s, w) => attacked(s.b, king(s.b, w), !w);
  // every move by the side to move, before checking it leaves its own king safe
  function pseudo(s) {
    const b = s.b, w = s.w, out = [];
    const add = (f, t, extra) => out.push(Object.assign({ f, t, p:b[f], x:b[t] }, extra));
    for (let f = 0; f < 64; f++) {
      const p = b[f]; if (!p || isW(p) !== w) continue;
      const r = f >> 3, c = f & 7, k = lower(p);
      const free = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
      if (k === "p") {
        const d = w ? -1 : 1, last = w ? 0 : 7, start = w ? 6 : 1, t1 = f + d * 8;
        const push = (t, extra) => { if ((t >> 3) === last) "qrbn".split("").forEach(q => add(f, t, Object.assign({ promo:w ? q.toUpperCase() : q }, extra))); else add(f, t, extra); };
        if (free(r + d, c) && !b[t1]) { push(t1); if (r === start && !b[t1 + d * 8]) add(f, t1 + d * 8, { two:true }); }
        for (const dc of [-1, 1]) {
          if (!free(r + d, c + dc)) continue;
          const t = (r + d) * 8 + c + dc;
          if (b[t] && isW(b[t]) !== w) push(t);
          else if (t === s.ep) add(f, t, { ep:true, x:w ? "p" : "P" });
        }
      } else if (k === "n" || k === "k") {
        for (const [dr, dc] of k === "n" ? KN : KG) { if (!free(r + dr, c + dc)) continue; const t = (r + dr) * 8 + c + dc; if (!b[t] || isW(b[t]) !== w) add(f, t); }
        if (k === "k") {
          const home = w ? 60 : 4, K = w ? "K" : "k", Q = w ? "Q" : "q", R = w ? "R" : "r";
          if (f === home && !attacked(b, f, !w)) {
            if (s.c.indexOf(K) >= 0 && !b[f + 1] && !b[f + 2] && b[f + 3] === R && !attacked(b, f + 1, !w) && !attacked(b, f + 2, !w)) add(f, f + 2, { castle:[f + 3, f + 1] });
            if (s.c.indexOf(Q) >= 0 && !b[f - 1] && !b[f - 2] && !b[f - 3] && b[f - 4] === R && !attacked(b, f - 1, !w) && !attacked(b, f - 2, !w)) add(f, f - 2, { castle:[f - 4, f - 1] });
          }
        }
      } else {
        for (const [dr, dc] of k === "b" ? DIAG : k === "r" ? ORTH : DIAG.concat(ORTH)) {
          for (let n = 1; n < 8; n++) {
            const rr = r + dr * n, cc = c + dc * n; if (!free(rr, cc)) break;
            const t = rr * 8 + cc;
            if (!b[t]) add(f, t); else { if (isW(b[t]) !== w) add(f, t); break; }
          }
        }
      }
    }
    return out;
  }
  const CORNER = { 63:"K", 56:"Q", 7:"k", 0:"q" };
  function make(s, m) {
    const b = s.b.slice();
    b[m.t] = m.promo || m.p; b[m.f] = "";
    if (m.ep) b[m.t + (s.w ? 8 : -8)] = "";
    if (m.castle) { b[m.castle[1]] = b[m.castle[0]]; b[m.castle[0]] = ""; }
    let c = s.c;
    if (c) {
      if (m.p === "K") c = c.replace(/[KQ]/g, ""); else if (m.p === "k") c = c.replace(/[kq]/g, "");
      if (CORNER[m.f]) c = c.replace(CORNER[m.f], ""); if (CORNER[m.t]) c = c.replace(CORNER[m.t], "");
    }
    return { b, w:!s.w, c, ep:m.two ? (m.f + m.t) / 2 : -1, hm:lower(m.p) === "p" || m.x ? 0 : s.hm + 1, fm:s.fm + (s.w ? 0 : 1) };
  }
  const legal = s => pseudo(s).filter(m => !inCheck(make(s, m), s.w));
  function perft(s, d) { if (!d) return 1; let n = 0; for (const m of pseudo(s)) { const t = make(s, m); if (!inCheck(t, s.w)) n += d === 1 ? 1 : perft(t, d - 1); } return n; }
  const key = s => s.b.map(p => p || ".").join("") + (s.w ? "w" : "b") + s.c + s.ep;
  function tooLittle(b) {
    const ps = b.filter(p => p && lower(p) !== "k");
    return !ps.length || (ps.length === 1 && /[nb]/i.test(ps[0]));
  }
  function evaluate(s) {
    let sc = 0, minor = 0;
    for (let i = 0; i < 64; i++) { const p = s.b[i]; if (p && /[qQ]/.test(p)) minor += 2; else if (p && /[rRbBnN]/.test(p)) minor++; }
    const end = minor <= 6;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i]; if (!p) continue;
      const k = lower(p), w = isW(p), t = PST[k === "k" && end ? "ke" : k];
      const v = VAL[k] + t[w ? i : (7 - (i >> 3)) * 8 + (i & 7)];
      sc += w ? v : -v;
    }
    return s.w ? sc : -sc;
  }
  const MATE = 100000;
  function order(ms) { return ms.sort((a, b) => ((b.x ? VAL[lower(b.x)] * 10 - VAL[lower(b.p)] : 0) + (b.promo ? 800 : 0)) - ((a.x ? VAL[lower(a.x)] * 10 - VAL[lower(a.p)] : 0) + (a.promo ? 800 : 0))); }
  // the computer's move: looks ahead deeper and deeper until its time is up
  function think(s, opt) {
    const until = Date.now() + (opt.ms || 600), maxD = opt.depth || 3;
    let nodes = 0, stop = false;
    function q(st, a, bt) {
      if (++nodes % 2048 === 0 && Date.now() > until) stop = true;
      const sp = evaluate(st);
      if (sp >= bt) return sp; if (sp > a) a = sp;
      for (const m of order(pseudo(st).filter(m => m.x || m.promo))) {
        const t = make(st, m); if (inCheck(t, st.w)) continue;
        const v = -q(t, -bt, -a); if (stop) return 0;
        if (v >= bt) return v; if (v > a) a = v;
      }
      return a;
    }
    function ab(st, d, a, bt, ply) {
      if (++nodes % 2048 === 0 && Date.now() > until) stop = true;
      if (st.hm >= 100) return 0;
      if (d <= 0) return q(st, a, bt);
      let any = false;
      for (const m of order(pseudo(st))) {
        const t = make(st, m); if (inCheck(t, st.w)) continue;
        any = true;
        const v = -ab(t, d - 1, -bt, -a, ply + 1); if (stop) return 0;
        if (v >= bt) return v; if (v > a) a = v;
      }
      if (!any) return inCheck(st, st.w) ? -MATE + ply : 0;
      return a;
    }
    let moves = order(legal(s)), bestM = moves[0] || null;
    if (moves.length < 2) return bestM;
    for (let d = 1; d <= maxD && !stop; d++) {
      let a = -Infinity, pick = null; const scored = [];
      for (const m of moves) {
        const v = -ab(make(s, m), d - 1, -Infinity, -a, 1);
        if (stop) break;
        scored.push([m, v + (opt.noise ? (Math.random() - .5) * opt.noise : 0)]);
        if (v > a) { a = v; pick = m; }
      }
      if (!stop && pick) { bestM = opt.noise ? scored.sort((x, y) => y[1] - x[1])[0][0] : pick; moves = [pick].concat(moves.filter(m => m !== pick)); }
    }
    return bestM;
  }
  return { START, fromFen, legal, make, perft, inCheck, think, key, tooLittle, name, sq, isW, evaluate };
})();
(function () {
  const sec = add("chessG", "♟️", "Chess", '<div class="gm-bar"><b id="chStat"></b><div class="gm-seg" id="chLvl"><button data-v="easy">Easy</button><button data-v="med">Normal</button><button data-v="hard">Hard</button></div>' +
    '<span class="gm-btns"><button class="gm-act" id="chUndo" title="Take back a move">Undo</button><button class="gm-act" id="chFlip" title="Turn the board round">⇅</button><button class="gm-act" id="chNew">New game</button></span></div>' +
    '<div class="ch-wrap"><div class="ch-board" id="chB"></div><div class="ch-side"><div class="ch-cap" id="chCapB"></div><div class="ch-moves" id="chMv"></div><div class="ch-cap" id="chCapW"></div></div></div>' +
    '<div class="gm-msg" id="chMsg"></div><div class="ch-promo hide" id="chPro"></div>', show);
  const GLYPH = { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" };
  const LVL = { easy:{ depth:1, ms:200, noise:140 }, med:{ depth:3, ms:600 }, hard:{ depth:5, ms:1500 } };
  let G = get("gm.chess", null), S = null, sel = -1, flip = false, busy = false, pending = null;
  const B = $("chB");
  for (let i = 0; i < 64; i++) { const d = document.createElement("div"); d.className = "sq " + (((i >> 3) + (i & 7)) % 2 ? "dk" : "lt"); B.appendChild(d); }
  // the game is its moves: played again from the start when it's opened
  function replay() {
    S = CH.fromFen(CH.START); G.keys = [CH.key(S)];
    for (const mv of G.mv) { const m = CH.legal(S).find(x => x.f === mv[0] && x.t === mv[1] && (x.promo || "") === (mv[2] || "")); if (!m) break; S = CH.make(S, m); G.keys.push(CH.key(S)); }
  }
  function fresh(side) { G = { mv:[], me:side || (G && G.me) || "w", lvl:(G && G.lvl) || "med", over:"" }; flip = G.me === "b"; sel = -1; replay(); save(); paint(); turn(); }
  const save = () => put("gm.chess", { mv:G.mv, me:G.me, lvl:G.lvl, over:G.over });
  function status() {
    const ms = CH.legal(S), chk = CH.inCheck(S, S.w), mine = S.w === (G.me === "w");
    if (!ms.length) return chk ? (mine ? "lost" : "won") : "stalemate";
    if (S.hm >= 100) return "fifty";
    if (G.keys.filter(k => k === G.keys[G.keys.length - 1]).length >= 3) return "three";
    if (CH.tooLittle(S.b)) return "little";
    return chk ? "check" : "";
  }
  const SAY = { won:"♛ Checkmate. You win!", lost:"Checkmate. The computer wins this one.", stalemate:"Stalemate: a draw.", fifty:"A draw: 50 moves with no capture or pawn move.",
    three:"A draw: the same position three times.", little:"A draw: not enough pieces left to checkmate." };
  function paint() {
    const ms = sel >= 0 ? CH.legal(S).filter(m => m.f === sel) : [], last = G.mv[G.mv.length - 1], st = status();
    const kChk = (st === "check" || st === "won" || st === "lost") ? S.b.indexOf(S.w ? "K" : "k") : -1;
    [...B.children].forEach((d, n) => {
      const i = flip ? 63 - n : n, p = S.b[i];
      d.className = "sq " + (((i >> 3) + (i & 7)) % 2 ? "dk" : "lt") + (i === sel ? " sel" : "") + (last && (i === last[0] || i === last[1]) ? " last" : "") +
        (ms.some(m => m.t === i) ? (p ? " cap" : " dot") : "") + (i === kChk ? " chk" : "");
      d.dataset.i = i;
      d.innerHTML = (p ? '<span class="pc ' + (CH.isW(p) ? "w" : "b") + '">' + GLYPH[p.toLowerCase()] + "︎</span>" : "") +
        ((n & 7) === 0 ? '<i class="rk">' + (8 - (i >> 3)) + "</i>" : "") + (n >= 56 ? '<i class="fl">' + "abcdefgh"[i & 7] + "</i>" : "");
    });
    // what's been taken, and how far ahead someone is
    const all = { p:8, n:2, b:2, r:2, q:1 }, have = { w:{}, b:{} };
    S.b.forEach(p => { if (p && p.toLowerCase() !== "k") { const s = CH.isW(p) ? "w" : "b"; have[s][p.toLowerCase()] = (have[s][p.toLowerCase()] || 0) + 1; } });
    const gone = s => Object.keys(all).map(k => GLYPH[k].repeat(Math.max(0, all[k] - (have[s][k] || 0)))).join("");
    const val = s => Object.keys(have[s]).reduce((n, k) => n + ({ p:1, n:3, b:3, r:5, q:9 }[k] * have[s][k]), 0), diff = val("w") - val("b");
    $("chCapW").innerHTML = '<span class="b">' + gone("b") + "</span>" + (diff > 0 ? " +" + diff : "");
    $("chCapB").innerHTML = '<span class="w">' + gone("w") + "</span>" + (diff < 0 ? " +" + -diff : "");
    (flip ? ["chCapW", "chMv", "chCapB"] : ["chCapB", "chMv", "chCapW"]).forEach(id => $("chMv").parentNode.appendChild($(id)));      // yours at the bottom
    $("chMv").innerHTML = G.mv.map((m, k) => (k % 2 ? "" : "<b>" + (k / 2 + 1) + ".</b> ") + CH.name(m[0]) + "–" + CH.name(m[1]) + (m[2] ? "=" + m[2].toUpperCase() : "")).join(" ");
    $("chMv").scrollTop = 1e6;
    [...$("chLvl").children].forEach(b => b.classList.toggle("on", b.dataset.v === G.lvl));
    $("chStat").textContent = "You play " + (G.me === "w" ? "white" : "black") + (busy ? " · thinking…" : st === "check" ? " · check!" : "");
    $("chMsg").textContent = SAY[st] || (busy ? "" : S.w === (G.me === "w") ? "Your move" : "");
    $("chUndo").disabled = !G.mv.length || busy;
  }
  function finish(st) {
    if (G.over || !SAY[st]) return;
    G.over = st; save();
    const b = bests();
    if (st === "won") { b.chessWins = (b.chessWins || 0) + 1; xp("chess", true, { easy:1, med:3, hard:6 }[G.lvl]); }
    else xp("chess", false, 1);
    put("games", b); paintBests();
  }
  function play(m) {
    S = CH.make(S, m); G.mv.push([m.f, m.t, m.promo ? m.promo.toLowerCase() : ""]); G.keys.push(CH.key(S)); sel = -1;
    save(); paint(); finish(status());
  }
  function turn() {
    if (G.over || S.w === (G.me === "w") || SAY[status()]) return;
    busy = true; paint();
    setTimeout(() => {         // drawn first, then the computer thinks
      const m = CH.think(S, LVL[G.lvl] || LVL.med);
      busy = false;
      if (m) play(m); else paint();
    }, 60);
  }
  function tap(i) {
    if (busy || G.over || S.w !== (G.me === "w")) return;
    const p = S.b[i];
    if (sel >= 0) {
      const ms = CH.legal(S).filter(m => m.f === sel && m.t === i);
      if (ms.length) {
        if (ms.length > 1) { promo(ms); return; }
        play(ms[0]); turn(); return;
      }
    }
    sel = p && CH.isW(p) === S.w && sel !== i ? i : -1; paint();
  }
  function promo(ms) {
    const box = $("chPro"); pending = ms;
    box.innerHTML = "<b>Turn the pawn into</b>" + ["q", "r", "b", "n"].map(k => '<button data-k="' + k + '" class="pc ' + (S.w ? "w" : "b") + '">' + GLYPH[k] + "︎</button>").join("");
    box.classList.remove("hide");
  }
  $("chPro").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !pending) return;
    const m = pending.find(x => x.promo.toLowerCase() === b.dataset.k); pending = null; $("chPro").classList.add("hide");
    if (m) { play(m); turn(); }
  });
  // tap one square then another, or drag a piece
  let downAt = -1;
  B.addEventListener("pointerdown", e => { const d = e.target.closest(".sq"); if (!d) return; e.preventDefault(); downAt = +d.dataset.i; tap(downAt); });
  B.addEventListener("pointerup", e => {
    const d = document.elementFromPoint(e.clientX, e.clientY), sqEl = d && d.closest && d.closest("#chB .sq");
    if (sqEl && downAt >= 0 && +sqEl.dataset.i !== downAt && sel === downAt) tap(+sqEl.dataset.i);
    downAt = -1;
  });
  $("chUndo").onclick = () => {
    if (busy || !G.mv.length) return;
    G.mv.pop(); if (G.mv.length && (G.mv.length % 2 === 0) !== (G.me === "w")) G.mv.pop();
    G.over = ""; sel = -1; replay(); save(); paint(); turn();
  };
  $("chFlip").onclick = () => { flip = !flip; paint(); };
  $("chNew").onclick = () => fresh(G && G.me === "w" ? "b" : "w");
  $("chLvl").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; G.lvl = b.dataset.v; save(); paint(); });
  function show() { if (!G) fresh("w"); else { if (!S) { replay(); flip = G.me === "b"; } paint(); turn(); } }
  CH.ui = { state:() => S, game:() => G, tap, fresh, play:m => play(m), turn };
  sec.dataset.ready = "1";
})();

/* ================================================================ Blocks
   Falling blocks: fill a row and it goes. ← → to move, ↑ to turn, ↓ to drop faster, Space to drop, C to
   keep one for later, P to pause. On a phone: the buttons, or swipe on the board and tap to turn. */
const BL = (function () {
  const COLS = 10, ROWS = 20;
  const SHAPES = { I:[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], O:[[1, 1], [1, 1]], T:[[0, 1, 0], [1, 1, 1], [0, 0, 0]], S:[[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z:[[1, 1, 0], [0, 1, 1], [0, 0, 0]], J:[[1, 0, 0], [1, 1, 1], [0, 0, 0]], L:[[0, 0, 1], [1, 1, 1], [0, 0, 0]] };
  const COL = { I:"#3ec1d3", O:"#f5c242", T:"#a46bf5", S:"#4cc96b", Z:"#ef5350", J:"#4f7df5", L:"#ff9a3c" };
  const rot = (m, dir) => dir > 0 ? m[0].map((_, i) => m.map(r => r[i]).reverse()) : m[0].map((_, i) => m.map(r => r[r.length - 1 - i]));
  function hits(board, m, x, y) {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const px = x + c, py = y + r;
      if (px < 0 || px >= COLS || py >= ROWS) return true;
      if (py >= 0 && board[py][px]) return true;
    }
    return false;
  }
  function clear(board) {
    let n = 0;
    for (let r = ROWS - 1; r >= 0; r--) if (board[r].every(Boolean)) { board.splice(r, 1); board.unshift(new Array(COLS).fill("")); n++; r++; }
    return n;
  }
  return { COLS, ROWS, SHAPES, COL, rot, hits, clear };
})();
(function () {
  const sec = add("blocksG", "🧱", "Blocks", '<div class="bl-wrap"><div class="bl-side"><div class="bl-box"><b>Keep</b><canvas id="blHold" width="80" height="60"></canvas></div><div class="bl-stat" id="blStat"></div></div>' +
    '<div class="bl-mid"><canvas id="blC" width="300" height="600"></canvas><div class="bl-over" id="blOver"></div></div>' +
    '<div class="bl-side"><div class="bl-box"><b>Next</b><canvas id="blNext" width="80" height="170"></canvas></div><button class="gm-act" id="blGo">New game</button></div></div>' +
    '<div class="bl-pad" id="blPad"><button data-a="left">◀</button><button data-a="rot">⟳</button><button data-a="right">▶</button><button data-a="down">▼</button><button data-a="drop">⤓</button><button data-a="hold">Keep</button></div>' +
    '<div class="gm-hud"><span>← → move · ↑ turn · ↓ faster · Space drop · C keep · P pause</span><span id="blBest"></span></div>', show);
  const cv = $("blC"), g = cv.getContext("2d"), CS = 30, { COLS, ROWS } = BL;
  let board, piece, bag, queue, hold, held, score, lines, level, over = true, paused = false, acc = 0, lastT = 0, lockT = 0, resets = 0, flash = [];
  function next() { if (!bag.length) bag = shuffle(Object.keys(BL.SHAPES)); return bag.pop(); }
  function spawn(k) {
    k = k || queue.shift(); queue.push(next());
    const m = BL.SHAPES[k].map(r => r.slice());
    piece = { k, m, x:((COLS - m[0].length) / 2) | 0, y:k === "I" ? -1 : 0 };
    held = false; lockT = 0; resets = 0;
    if (BL.hits(board, piece.m, piece.x, piece.y)) end();
  }
  function fresh() {
    board = Array.from({ length:ROWS }, () => new Array(COLS).fill("")); bag = []; queue = [next(), next(), next()]; hold = null;
    score = 0; lines = 0; level = 1; over = false; paused = false; acc = 0; flash = [];
    $("blOver").classList.remove("on"); spawn(); paint();
  }
  const speed = () => Math.max(60, 800 * Math.pow(.85, level - 1));
  function moveBy(dx, dy) {
    if (!piece || over || paused) return false;
    if (BL.hits(board, piece.m, piece.x + dx, piece.y + dy)) return false;
    piece.x += dx; piece.y += dy;
    if (lockT && resets < 15) { lockT = performance.now(); resets++; }
    return true;
  }
  function turnP(dir) {
    if (!piece || over || paused || piece.k === "O") return;
    const m = BL.rot(piece.m, dir);
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]]) {
      if (!BL.hits(board, m, piece.x + dx, piece.y + dy)) { piece.m = m; piece.x += dx; piece.y += dy; if (lockT && resets < 15) { lockT = performance.now(); resets++; } return; }
    }
  }
  function lock() {
    let above = false;
    piece.m.forEach((r, ry) => r.forEach((v, rx) => { if (v) { if (piece.y + ry < 0) above = true; else board[piece.y + ry][piece.x + rx] = piece.k; } }));
    if (above) return end();
    const full = []; board.forEach((r, i) => { if (r.every(Boolean)) full.push(i); });
    const n = BL.clear(board);
    if (n) { flash = full.map(r => ({ r, t:performance.now() })); lines += n; score += [0, 100, 300, 500, 800][n] * level; level = 1 + (lines / 10 | 0); }
    spawn();
  }
  function hard() { if (!piece || over || paused) return; let n = 0; while (moveBy(0, 1)) n++; score += n * 2; lock(); paint(); }
  function soft() { if (moveBy(0, 1)) score += 1; else if (!lockT) lockT = performance.now(); }
  function keep() {
    if (!piece || over || paused || held) return;
    const k = piece.k; if (hold) spawn(hold); else spawn(); hold = k; held = true;
  }
  function end() {
    over = true; piece = null;
    const nb = best("blocks", score, false);
    $("blOver").innerHTML = "<b>Game over</b><span>" + score + " points · " + lines + " lines" + (nb && score ? " · a new best!" : "") + "</span><button class=\"gm-act gm-main\">Play again</button>";
    $("blOver").classList.add("on"); $("blOver").querySelector("button").onclick = fresh;
    if (score) xp("blocks", true, Math.min(5, 1 + (lines / 15 | 0)));
    paint();
  }
  function cell(c2, x, y, s, col, ghost) {
    if (ghost) { c2.strokeStyle = col; c2.globalAlpha = .45; c2.lineWidth = 2; c2.strokeRect(x + 2, y + 2, s - 4, s - 4); c2.globalAlpha = 1; return; }
    c2.fillStyle = col; c2.beginPath(); c2.roundRect ? c2.roundRect(x + 1, y + 1, s - 2, s - 2, 5) : c2.rect(x + 1, y + 1, s - 2, s - 2); c2.fill();
    c2.fillStyle = "rgba(255,255,255,.22)"; c2.fillRect(x + 4, y + 3, s - 8, 3);
  }
  function mini(c, k) {
    const x2 = c.getContext("2d"); x2.clearRect(0, 0, c.width, c.height);
    (Array.isArray(k) ? k : [k]).forEach((kk, n) => {
      if (!kk) return;
      const m = BL.SHAPES[kk], s = 16, w = m[0].length * s, rows = m.filter(r => r.some(Boolean)), top = m.findIndex(r => r.some(Boolean));
      const ox = (c.width - w) / 2, oy = n * 56 + (56 - rows.length * s) / 2 - top * s + 2;
      m.forEach((r, ry) => r.forEach((v, rx) => { if (v) cell(x2, ox + rx * s, oy + ry * s, s, kk === hold && held && c.id === "blHold" ? "#777" : BL.COL[kk]); }));
    });
  }
  function paint() {
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#222";
    g.fillStyle = css("--bg2"); g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = css("--line"); g.lineWidth = 1; g.globalAlpha = .5;
    for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * CS + .5, 0); g.lineTo(x * CS + .5, ROWS * CS); g.stroke(); }
    for (let y = 1; y < ROWS; y++) { g.beginPath(); g.moveTo(0, y * CS + .5); g.lineTo(COLS * CS, y * CS + .5); g.stroke(); }
    g.globalAlpha = 1;
    if (board) board.forEach((r, y) => r.forEach((k, x) => { if (k) cell(g, x * CS, y * CS, CS, BL.COL[k]); }));
    if (piece) {
      let gy = piece.y; while (!BL.hits(board, piece.m, piece.x, gy + 1)) gy++;
      piece.m.forEach((r, ry) => r.forEach((v, rx) => { if (v && gy + ry >= 0) cell(g, (piece.x + rx) * CS, (gy + ry) * CS, CS, BL.COL[piece.k], true); }));
      piece.m.forEach((r, ry) => r.forEach((v, rx) => { if (v && piece.y + ry >= 0) cell(g, (piece.x + rx) * CS, (piece.y + ry) * CS, CS, BL.COL[piece.k]); }));
    }
    const now = performance.now();
    flash = flash.filter(f => now - f.t < 300);
    flash.forEach(f => { g.fillStyle = "rgba(255,255,255," + (1 - (now - f.t) / 300) * .8 + ")"; g.fillRect(0, f.r * CS, COLS * CS, CS); });
    if (paused && !over) { g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = "#fff"; g.font = "700 22px system-ui,sans-serif"; g.textAlign = "center"; g.fillText("Paused", cv.width / 2, cv.height / 2); }
    if (queue) mini($("blNext"), queue.slice(0, 3));
    mini($("blHold"), hold);
    $("blStat").innerHTML = "<b>" + (score || 0) + "</b><span>points</span><b>" + (lines || 0) + "</b><span>lines</span><b>" + (level || 1) + "</b><span>level</span>";
    const b = bests(); $("blBest").textContent = b.blocks ? "Best " + b.blocks : "";
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (cur() !== "blocksG") { if (!over && !paused && board) paused = true; lastT = t; return; }
    const dt = Math.min(100, t - (lastT || t)); lastT = t;
    if (document.hidden && !over) paused = true;
    if (!over && !paused && piece) {
      acc += dt;
      if (acc >= speed()) { acc = 0; if (!moveBy(0, 1) && !lockT) lockT = t; }
      if (lockT && BL.hits(board, piece.m, piece.x, piece.y + 1)) { if (t - lockT > 450) lock(); }
      else lockT = 0;
    }
    paint();
  }
  const ACT = { left:() => moveBy(-1, 0), right:() => moveBy(1, 0), rot:() => turnP(1), down:soft, drop:hard, hold:keep };
  addEventListener("keydown", e => {
    if (cur() !== "blocksG" || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (over && (k === "Enter" || k === " ")) { e.preventDefault(); fresh(); return; }
    if (k === "p" || k === "P" || k === "Escape") { if (!over) paused = !paused; }
    else if (paused) return;
    else if (k === "ArrowLeft") moveBy(-1, 0); else if (k === "ArrowRight") moveBy(1, 0);
    else if (k === "ArrowUp" || k === "x" || k === "X") turnP(1); else if (k === "z" || k === "Z") turnP(-1);
    else if (k === "ArrowDown") soft(); else if (k === " ") hard(); else if (k === "c" || k === "C" || k === "Shift") keep();
    else return;
    e.preventDefault();
  });
  // the buttons; held down, ◀ ▶ ▼ keep going
  let rep = 0;
  const unrep = () => { clearTimeout(rep); clearInterval(rep); rep = 0; };
  $("blPad").addEventListener("pointerdown", e => {
    const b = e.target.closest("button"); if (!b) return; e.preventDefault();
    if (over) return; if (paused) paused = false;
    const fn = ACT[b.dataset.a]; fn(); unrep();
    if (/left|right|down/.test(b.dataset.a)) rep = setTimeout(() => { rep = setInterval(fn, 70); }, 180);
  });
  ["pointerup", "pointercancel", "blur"].forEach(t => addEventListener(t, unrep));
  // on the board: tap to turn, drag sideways to move, swipe down to drop
  let sw = null;
  cv.addEventListener("pointerdown", e => { if (over) return; if (paused) { paused = false; return; } sw = { x:e.clientX, y:e.clientY, t:performance.now(), moved:0 }; });
  cv.addEventListener("pointermove", e => {
    if (!sw) return;
    const step = cv.getBoundingClientRect().width / COLS, dx = e.clientX - sw.x;
    while (Math.abs(dx - sw.moved * step) >= step) { const d = dx > sw.moved * step ? 1 : -1; moveBy(d, 0); sw.moved += d; }
  });
  cv.addEventListener("pointerup", e => {
    if (!sw) return;
    const dy = e.clientY - sw.y, dt = performance.now() - sw.t;
    if (dy > 60 && dt < 350) hard(); else if (!sw.moved && Math.abs(dy) < 10) turnP(1);
    sw = null;
  });
  $("blGo").onclick = fresh;
  function show() { paint(); }
  board = Array.from({ length:ROWS }, () => new Array(COLS).fill(""));
  $("blOver").innerHTML = "<b>Blocks</b><span>Fill a row and it goes. How long can you keep going?</span><button class=\"gm-act gm-main\">Start</button>";
  $("blOver").classList.add("on"); $("blOver").querySelector("button").onclick = fresh;
  requestAnimationFrame(frame);
  BL.ui = { fresh, state:() => ({ board, piece, score, lines, level, over, paused, hold, queue }), act:ACT, lock:() => lock(), setBoard:b => { board = b; } };
  sec.dataset.ready = "1";
})();

/* ---------------------------------------------------------------- the look, shared by both pages */
const st = document.createElement("style");
st.textContent = `
.gm-xp{max-width:520px;margin:0 0 14px}
.gm-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;width:min(520px,100%);margin:0 auto 12px;flex-wrap:wrap}
.gm-bar b{font-size:15px;font-variant-numeric:tabular-nums}.gm-btns{display:flex;gap:6px}
.gm-seg{display:flex;background:var(--bg3);border-radius:10px;padding:2px;gap:2px}
.gm-seg button{height:30px;padding:0 12px;border:0;border-radius:8px;background:none;color:var(--dim);font:600 12.5px system-ui,sans-serif;cursor:pointer}
.gm-seg button.on{background:var(--bg2);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.2)}
.gm-act{height:32px;padding:0 13px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);cursor:pointer;font:600 12.5px system-ui,sans-serif;touch-action:manipulation}
.gm-act:disabled{opacity:.45;cursor:default}.gm-act.gm-main{background:var(--accent);border-color:var(--accent);color:#fff}.gm .hide{display:none!important}
.gm-msg{text-align:center;min-height:26px;margin:12px 0 4px;font-weight:600;color:var(--dim)}
.gm-hud{display:flex;justify-content:space-between;gap:8px;color:var(--dim);font-size:12.5px;padding:8px 4px 0;flex-wrap:wrap}
.gm .shake{animation:gmShake .35s}@keyframes gmShake{20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
/* Sudoku */
.sd-grid{display:grid;grid-template-columns:repeat(9,1fr);width:min(450px,100%);aspect-ratio:1;margin:0 auto;border:2px solid var(--fg);border-radius:10px;overflow:hidden;background:var(--line);gap:1px;user-select:none;-webkit-user-select:none}
.sd-grid button{border:0;padding:0;background:var(--bg2);color:var(--accent);font:600 clamp(16px,4.6vw,24px)/1 system-ui,sans-serif;cursor:pointer;position:relative;touch-action:manipulation}
.sd-grid button.giv{color:var(--fg);font-weight:750}.sd-grid button.peer{background:color-mix(in srgb,var(--accent) 7%,var(--bg2))}
.sd-grid button.same{background:color-mix(in srgb,var(--accent) 20%,var(--bg2))}.sd-grid button.sel{background:color-mix(in srgb,var(--accent) 34%,var(--bg2))}
.sd-grid button.bad{color:#ef4444;background:color-mix(in srgb,#ef4444 14%,var(--bg2))}
.sd-grid button.rb{box-shadow:2px 0 0 var(--fg)}.sd-grid button.bb{box-shadow:0 2px 0 var(--fg)}.sd-grid button.rb.bb{box-shadow:2px 0 0 var(--fg),0 2px 0 var(--fg),2px 2px 0 var(--fg)}
.sd-grid .nt{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);font-size:clamp(7px,1.9vw,10px);color:var(--dim);font-weight:500}
.sd-grid .nt i{font-style:normal;display:grid;place-items:center}
.sd-grid.win button{animation:gmPop .5s both}@keyframes gmPop{50%{transform:scale(.85)}}
.sd-pad{display:grid;grid-template-columns:repeat(9,1fr) auto auto auto;gap:5px;width:min(560px,100%);margin:12px auto 0}
.sd-pad button{height:42px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--fg);font:700 18px system-ui,sans-serif;cursor:pointer;padding:0 8px;touch-action:manipulation}
.sd-pad button[data-k]{font-size:13px}.sd-pad button.on{background:var(--accent);border-color:var(--accent);color:#fff}.sd-pad button.done{opacity:.3}
@media (max-width:520px){.sd-pad{grid-template-columns:repeat(9,1fr)}.sd-pad button[data-k]{grid-column:span 3}}
/* Solitaire */
.so-board{position:relative;margin:0 auto;user-select:none;-webkit-user-select:none;touch-action:none}
.so-slot{position:absolute;width:var(--cw);height:var(--ch);border-radius:8px;border:2px dashed color-mix(in srgb,var(--fg) 18%,transparent)}
.so-slot.so-s{cursor:pointer}.so-slot.so-s.again::after{content:"↻";position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--cw)*.45);color:var(--dim)}
.so-slot.so-f::after{content:"A";position:absolute;inset:0;display:grid;place-items:center;font:700 calc(var(--cw)*.35) system-ui;color:color-mix(in srgb,var(--fg) 20%,transparent)}
.so-c{position:absolute;width:var(--cw);height:var(--ch);border-radius:8px;cursor:pointer;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 45%,#000));border:1px solid rgba(0,0,0,.25);box-shadow:0 1px 3px rgba(0,0,0,.3);overflow:hidden}
.so-c::before{content:"";position:absolute;inset:4px;border-radius:5px;border:1.5px solid rgba(255,255,255,.35);background:repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 4px,transparent 4px 8px)}
.so-c>span{display:none}
.so-c.up{background:#fdfcf8;color:#1d1a20}.so-c.up::before{display:none}.so-c.up>span{display:block}.so-c.up.red{color:#d32f2f}
.so-c.anim{transition:left .2s cubic-bezier(.2,.8,.3,1),top .2s cubic-bezier(.2,.8,.3,1),transform .4s}
.so-c.drag{box-shadow:0 10px 24px rgba(0,0,0,.45);transition:none}
.so-k{position:absolute;left:4px;top:2px;font:700 calc(var(--cw)*.26)/1.05 system-ui,sans-serif;text-align:center}.so-k b{display:block;font-size:.85em}
.so-m{position:absolute;right:4px;bottom:2px;font:calc(var(--cw)*.42)/1 system-ui,sans-serif}
/* Chess */
.ch-wrap{display:flex;gap:14px;justify-content:center;align-items:flex-start;flex-wrap:wrap}
.ch-board{display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);width:min(480px,100%);aspect-ratio:1;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.3);user-select:none;-webkit-user-select:none;touch-action:none}
.ch-board .sq{position:relative;display:grid;place-items:center;cursor:pointer}
.ch-board .lt{background:#ecdcbf}.ch-board .dk{background:#b0835a}
.ch-board .last{box-shadow:inset 0 0 0 100px rgba(255,214,64,.38)}.ch-board .sel{box-shadow:inset 0 0 0 100px rgba(80,170,255,.45)}
.ch-board .chk{background:radial-gradient(circle,#ff4d4d 0,#d32f2f 45%,transparent 75%)}
.ch-board .dot::after{content:"";width:28%;height:28%;border-radius:50%;background:rgba(20,20,20,.28)}
.ch-board .cap::after{content:"";position:absolute;inset:4%;border-radius:50%;border:4px solid rgba(20,20,20,.28)}
.ch-board .pc{font:clamp(28px,8.6vw,46px)/1 "Segoe UI Symbol","Apple Symbols","DejaVu Sans",serif;pointer-events:none}
.pc.w{color:#fff;text-shadow:0 0 1px #000,0 0 1px #000,0 1px 2px rgba(0,0,0,.6),1px 0 0 #222,-1px 0 0 #222,0 1px 0 #222,0 -1px 0 #222}.pc.b{color:#1b1b1b;text-shadow:0 1px 1px rgba(255,255,255,.25)}
.ch-board .rk,.ch-board .fl{position:absolute;font:700 10px system-ui;font-style:normal;opacity:.65;color:#3b2a1a}.ch-board .rk{left:3px;top:2px}.ch-board .fl{right:3px;bottom:1px}
.ch-side{width:min(200px,100%);display:flex;flex-direction:column;gap:6px}
.ch-moves{max-height:300px;overflow:auto;background:var(--bg2);border-radius:10px;padding:8px 10px;font:12.5px/1.7 ui-monospace,Consolas,monospace;color:var(--dim);min-height:60px}
.ch-moves b{color:var(--fg);font-weight:600}.ch-cap{min-height:22px;font-size:18px;color:var(--dim);font-weight:700}.ch-cap .w{color:#ddd}.ch-cap .b{color:#888}
.ch-promo{display:flex;gap:6px;align-items:center;justify-content:center;margin-top:10px}
.ch-promo button{width:52px;height:52px;border-radius:10px;border:1px solid var(--line);background:#ecdcbf;font-size:36px;cursor:pointer}
/* Blocks */
.bl-wrap{display:flex;gap:12px;justify-content:center;align-items:flex-start}
.bl-mid{position:relative}.bl-mid canvas{display:block;width:min(300px,62vw);height:auto;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);touch-action:none}
.bl-side{display:flex;flex-direction:column;gap:10px;width:96px}.bl-side .gm-act{padding:0 6px;white-space:nowrap;font-size:12px}
.bl-box{background:var(--bg2);border-radius:10px;padding:6px 8px;text-align:center}.bl-box b{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}
.bl-box canvas{display:block;width:100%;height:auto}
.bl-stat{display:grid;grid-template-columns:1fr;text-align:center;background:var(--bg2);border-radius:10px;padding:8px 4px}.bl-stat b{font-size:18px;font-variant-numeric:tabular-nums}.bl-stat span{font-size:11px;color:var(--dim);margin-bottom:4px}
.bl-over{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(0,0,0,.62);border-radius:10px;color:#fff;text-align:center;padding:16px}
.bl-over.on{display:flex}.bl-over b{font-size:24px}
.bl-pad{display:none;gap:6px;justify-content:center;margin-top:10px}.bl-pad button{width:52px;height:46px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font:700 18px system-ui;touch-action:manipulation}
.bl-pad button[data-a="hold"]{width:64px;font-size:13px}
@media (pointer:coarse),(max-width:620px){.bl-pad{display:flex}.bl-side{width:72px}}
`;
document.head.appendChild(st);

// games.html#sudoku (and #solitaire, #chess, #blocks) opens one
const HASH = { sudoku:"sudokuG", solitaire:"solG", chess:"chessG", blocks:"blocksG" };
function fromHash() { const id = HASH[location.hash.slice(1)]; if (id) { const b = document.querySelector('.tabs button[data-g="' + id + '"]'); if (b) b.click(); } }
fromHash();
addEventListener("hashchange", fromHash);
paintBests();
window.GamesMore = { sudoku:SD, solitaire:SO, chess:CH, blocks:BL, open };
})();
