// Sudoku, Solitaire, Chess and Blocks (../js/games.more.js) and XP and levels (../js/xp.js): on the Windows
// games page (out/games.html) and the iPhone app's (../games.html, served here as https://app.example/),
// then the level card on both start pages, the window's Levels panel and the band effects.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };

async function games(p, tag) {
  const xp = () => p.evaluate(() => (JSON.parse(localStorage.getItem("wsb.xp") || "{}").total) || 0);
  check(await p.evaluate(() => ["sudokuG", "solG", "chessG", "blocksG"].every(id => document.querySelector('.tabs button[data-g="' + id + '"]') && document.getElementById(id))), tag + ": four new games, each with its tab");
  check(await p.evaluate(() => !!document.querySelector(".gm-xp.xp-card .xp-lv")), tag + ": your level above the games");

  /* Sudoku */
  await p.click('.tabs button[data-g="sudokuG"]'); await wait(400);
  check(await p.evaluate(() => document.getElementById("sudokuG").classList.contains("on") && document.querySelectorAll("#sdG button").length === 81), tag + ": Sudoku opens with its grid");
  const sd = await p.evaluate(() => { const S = GamesMore.sudoku.ui.state(); return { holes:S.v.filter(v => !v).length, unique:GamesMore.sudoku.count(S.p.slice(), 2) === 1 }; });
  check(sd.holes === 36 && sd.unique, tag + ": an easy puzzle, one answer: " + JSON.stringify(sd));
  await p.evaluate(() => { const S = GamesMore.sudoku.ui.state(), i = S.v.findIndex(v => !v); GamesMore.sudoku.ui.select(i); GamesMore.sudoku.ui.put(S.sol[i] % 9 + 1); });
  check(await p.evaluate(() => GamesMore.sudoku.ui.state().mis === 1 && !!document.querySelector("#sdG button.bad")), tag + ": a wrong number is a mistake, in red");
  await p.screenshot({ path:SHOTS + "games-sudoku-" + tag + ".png" });
  const x0 = await xp();
  await p.evaluate(() => { const S = GamesMore.sudoku.ui.state(); S.v.forEach((v, i) => { if (v !== S.sol[i]) { GamesMore.sudoku.ui.select(i); GamesMore.sudoku.ui.put(S.sol[i]); } }); });
  await wait(300);
  check(/Solved/.test(await p.textContent("#sdMsg")) && await p.evaluate(() => JSON.parse(localStorage.getItem("wsb.games")).sudoku_easy >= 0), tag + ": solved, best time kept: " + await p.textContent("#sdMsg"));
  check(await xp() === x0 + 15, tag + ": +15 XP for a win: " + x0 + " → " + await xp());

  /* Solitaire */
  await p.click('.tabs button[data-g="solG"]'); await wait(500);
  check(await p.evaluate(() => document.querySelectorAll("#soB .so-c").length === 52 && document.querySelectorAll("#soB .so-c.up").length === 7), tag + ": Solitaire deals 52 cards, 7 face up");
  await p.evaluate(() => { const s = GamesMore.solitaire.ui.state(); document.querySelector('#soB .so-slot[data-k="s"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles:true, clientX:1, clientY:1 })); });
  check(await p.evaluate(() => GamesMore.solitaire.ui.state().waste.length === 1), tag + ": tap the deck to turn a card");
  // a column ready for a drag: 7♠ in one column, 6♥ in the next
  await p.evaluate(() => {
    const c = (s, r, u) => ({ s, r, u }), S = GamesMore.solitaire.deal(1);
    S.t = [[c(0, 7, true)], [c(1, 6, true)], [], [], [], [], []]; S.stock = []; S.waste = []; S.f = [[], [], [], []];
    GamesMore.solitaire.ui.set(S);
  });
  await wait(300);
  const from = await p.evaluate(() => { const r = document.querySelector('#soB .so-c[data-id="' + (13 + 5) + '"]').getBoundingClientRect(); return [r.x + 10, r.y + 10]; });
  const to = await p.evaluate(() => { const r = document.querySelector('#soB .so-c[data-id="6"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(from[0] + 20, from[1] + 10, { steps:3 }); await p.mouse.move(to[0], to[1], { steps:6 }); await p.mouse.up(); await wait(300);
  check(await p.evaluate(() => GamesMore.solitaire.ui.state().t[0].length === 2 && GamesMore.solitaire.ui.state().t[1].length === 0), tag + ": drag the 6♥ onto the 7♠");
  await p.click("#soUndo"); await wait(200);
  check(await p.evaluate(() => GamesMore.solitaire.ui.state().t[1].length === 1), tag + ": and Undo puts it back");
  // the last card: tap it and it goes up, and the game is won
  await p.evaluate(() => {
    const S = GamesMore.solitaire.deal(1); S.stock = []; S.waste = []; S.t = [[{ s:3, r:13, u:true }], [], [], [], [], [], []];
    S.f = [0, 1, 2, 3].map(s => [...Array(s === 3 ? 12 : 13).keys()].map(i => ({ s, r:i + 1, u:true }))); S.moves = 90; S.time = 200;
    GamesMore.solitaire.ui.set(S);
  });
  await wait(300);
  const x1 = await xp();
  await p.evaluate(() => { const d = document.querySelector('#soB .so-c[data-id="51"]').getBoundingClientRect(); const o = { bubbles:true, clientX:d.x + 5, clientY:d.y + 5, pointerId:1 };
    document.querySelector('#soB .so-c[data-id="51"]').dispatchEvent(new PointerEvent("pointerdown", o)); document.getElementById("soB").dispatchEvent(new PointerEvent("pointerup", o)); });
  await wait(400);
  check(/You won/.test(await p.textContent("#soMsg")) && await xp() > x1, tag + ": the last card up wins: " + await p.textContent("#soMsg"));
  await p.evaluate(() => { const S = GamesMore.solitaire.deal(1); GamesMore.solitaire.ui.set(S); }); await wait(300);
  await p.screenshot({ path:SHOTS + "games-solitaire-" + tag + ".png" });

  /* Chess */
  const pf = await p.evaluate(() => { const C = GamesMore.chess; return [C.perft(C.fromFen(C.START), 3), C.perft(C.fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 2), C.perft(C.fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 3)]; });
  check(pf.join() === "8902,2039,2812", tag + ": every rule of chess (move counts on test positions): " + pf);
  await p.click('.tabs button[data-g="chessG"]'); await wait(300);
  check(await p.evaluate(() => document.querySelectorAll("#chB .sq").length === 64 && document.querySelectorAll("#chB .pc").length === 32), tag + ": Chess: the board and 32 pieces");
  const sqAt = n => p.evaluate(n => { const r = document.querySelector('#chB .sq[data-i="' + GamesMore.chess.sq(n) + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, n);
  let a = await sqAt("e2"), b = await sqAt("e4");
  await p.mouse.click(a[0], a[1]); await wait(100);
  check(await p.evaluate(() => document.querySelectorAll("#chB .dot").length === 2), tag + ": tap a pawn: its two moves show");
  await p.mouse.click(b[0], b[1]); await wait(1200);
  check(await p.evaluate(() => GamesMore.chess.ui.game().mv.length === 2), tag + ": e4, and the computer answers");
  await p.screenshot({ path:SHOTS + "games-chess-" + tag + ".png" });
  // a mate on the board when the game is opened again
  await p.evaluate(() => { const sq = GamesMore.chess.sq, mv = [["e2", "e4"], ["e7", "e5"], ["f1", "c4"], ["b8", "c6"], ["d1", "h5"], ["g8", "f6"], ["h5", "f7"]].map(m => [sq(m[0]), sq(m[1]), ""]);
    localStorage.setItem("wsb.gm.chess", JSON.stringify({ mv, me:"w", lvl:"med", over:"won" })); });
  await p.reload(); await wait(400);
  await p.click('.tabs button[data-g="chessG"]'); await wait(300);
  check(/Checkmate\. You win/.test(await p.textContent("#chMsg")) && await p.evaluate(() => !!document.querySelector("#chB .chk")), tag + ": checkmate is seen, the king in red: " + await p.textContent("#chMsg"));
  await p.click("#chNew"); await wait(1500);
  check(await p.evaluate(() => GamesMore.chess.ui.game().me === "b" && GamesMore.chess.ui.game().mv.length === 1), tag + ": New game: now with black, and the computer opens");

  /* Blocks */
  await p.click('.tabs button[data-g="blocksG"]'); await wait(300);
  check(await p.evaluate(() => document.getElementById("blOver").classList.contains("on")), tag + ": Blocks waits for Start");
  await p.click("#blOver button"); await wait(200);
  check(await p.evaluate(() => { const s = GamesMore.blocks.ui.state(); return !s.over && !!s.piece && s.queue.length === 3; }), tag + ": a piece falls, three come next");
  await p.keyboard.press("Space"); await wait(100);
  check(await p.evaluate(() => GamesMore.blocks.ui.state().score > 0 && GamesMore.blocks.ui.state().board[19].some(Boolean)), tag + ": Space drops it to the bottom");
  check(await p.evaluate(() => { const B = GamesMore.blocks, b = Array.from({ length:20 }, () => new Array(10).fill("")); b[19] = new Array(10).fill("I"); b[18] = new Array(10).fill("I"); b[18][3] = ""; return B.clear(b) === 1 && b[19][3] === "" && b[19][0] === "I"; }), tag + ": a full row goes, the rest moves down");
  await p.screenshot({ path:SHOTS + "games-blocks-" + tag + ".png" });
  const x2 = await xp();
  for (let i = 0; i < 80; i++) { if (await p.evaluate(() => GamesMore.blocks.ui.state().over)) break; await p.keyboard.press("Space"); }
  check(await p.evaluate(() => GamesMore.blocks.ui.state().over) && /Game over/.test(await p.textContent("#blOver")) && await p.evaluate(() => JSON.parse(localStorage.getItem("wsb.games")).blocks > 0), tag + ": stacked to the top: game over, best score kept");
  check(await xp() > x2, tag + ": and XP for it");
  // the old games count too: a win at Tic-tac-toe (its counter in wsb.games) is noticed
  const x3 = await xp();
  await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("wsb.games") || "{}"); g.tttWins = (g.tttWins || 0) + 1; localStorage.setItem("wsb.games", JSON.stringify(g)); });
  await wait(3000);
  check(await xp() === x3 + 15, tag + ": a Tic-tac-toe win is worth XP too");
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1100, height:900 } });
  await setup(ctx);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });

  const w = await ctx.newPage(); watch(w, errors, "windows games");
  await w.goto("https://browser.example/games.html"); await wait(600);
  await games(w, "windows");
  const i = await ctx.newPage(); watch(i, errors, "iphone games");
  await i.goto("https://app.example/games.html"); await wait(600);
  await games(i, "iphone");
  await i.goto("https://app.example/games.html#chess"); await wait(500);
  check(await i.evaluate(() => document.getElementById("chessG").classList.contains("on")), "games.html#chess opens Chess");
  await i.setViewportSize({ width:390, height:844 }); await i.click('.tabs button[data-g="blocksG"]'); await wait(300);
  check(await i.evaluate(() => getComputedStyle(document.getElementById("blPad")).display === "flex"), "Blocks on a phone: buttons to play with");
  await i.screenshot({ path:SHOTS + "games-blocks-phone.png" });
  await i.click('.tabs button[data-g="solG"]'); await wait(400);
  check(await i.evaluate(() => document.getElementById("soB").getBoundingClientRect().right <= innerWidth), "Solitaire fits a phone's width");
  await i.screenshot({ path:SHOTS + "games-solitaire-phone.png" });

  /* ---------------------------------------------------------------- levels: looks you unlock */
  await w.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.xp")); s.total = 5000; localStorage.setItem("wsb.xp", JSON.stringify(s)); });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); }); await wait(300);
  await c.evaluate(() => { if (overlay) closeOver(); });
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Levels and XP…/.test(m.textContent); }), "Menu → Levels and XP…");
  await c.evaluate(() => X3.xpPanel()); await wait(400);
  check(await c.evaluate(() => XP.info().level >= 10 && /Level \d+/.test(document.querySelector("#xpp .xp-top b").textContent)), "the panel: your level");
  await c.evaluate(() => document.querySelector('#xpp button[data-k="band"][data-id="rainbow"]').click()); await wait(200);
  check(await c.evaluate(() => document.documentElement.dataset.xpband === "rainbow" && getComputedStyle(document.querySelector(".anband")).display === "block"), "wearing the Rainbow band: it runs across the top of the window");
  await c.evaluate(() => document.querySelector('#xpp button[data-k="frame"][data-id="holo"]').click()); await wait(200);
  await c.screenshot({ path:SHOTS + "xp-chrome-panel.png" });
  check(await c.evaluate(() => !document.querySelector('#xpp button[data-k="frame"][data-id="crown"]')), "the Crown frame is still locked at this level");
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(700);
  check(await n.evaluate(() => !document.getElementById("xpSec").classList.contains("hide") && document.documentElement.dataset.xpframe === "holo"), "the new tab page: your level card, in its holographic frame");
  await n.evaluate(() => document.getElementById("xpSec").scrollIntoView({ block:"center" })); await wait(300);
  await n.screenshot({ path:SHOTS + "xp-newtab.png" });
  check(await n.evaluate(() => SHOW.some(x => x[0] === "xp")), "Customize can hide it");
  const app = await ctx.newPage(); watch(app, errors, "app");
  await app.goto("https://app.example/index.html"); await wait(1500);
  check(await app.evaluate(() => !!document.querySelector("#xpSec .xp-card") && !document.getElementById("xpSec").classList.contains("hide")), "the iPhone start page: the level card too");
  const pv = await ctx.newPage(); watch(pv, errors, "private");
  await pv.goto("https://browser.example/newtab.html?private=1"); await wait(500);
  check(await pv.evaluate(() => !document.getElementById("xpSec")), "no XP in private windows");

  // (the iPhone app's service worker can't be registered from a test route)
  const real = errors.filter(e => !/app console: An unknown error occurred when fetching the script/.test(e));
  errors.length = 0; errors.push(...real);
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
