const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1100, height:900 } });
  await setup(ctx);
  const p = await ctx.newPage(); watch(p, errors, "games");
  await p.goto("https://browser.example/games.html"); await p.waitForTimeout(500);
  check(await p.locator(".tabs button").count() === 12, "12 game tabs");
  const tab = async g => { await p.click('.tabs button[data-g="' + g + '"]'); await p.waitForTimeout(250); };
  // tic-tac-toe: unbeatable never loses over a few random games
  await tab("tttG");
  for (let n = 0; n < 4; n++) {
    await p.click("#tttNew"); await p.waitForTimeout(500);
    for (let k = 0; k < 6; k++) {
      const free = await p.$$eval("#ttt button", bs => bs.map((b, i) => b.textContent ? -1 : i).filter(i => i >= 0));
      const over = await p.evaluate(() => /win|draw/i.test(document.getElementById("tttMsg").textContent));
      if (!free.length || over) break;
      await p.click("#ttt button >> nth=" + free[Math.random() * free.length | 0]); await p.waitForTimeout(500);
    }
  }
  const sc = await p.textContent("#tttScore");
  check(/^You 0 ·/.test(sc), "unbeatable tic-tac-toe never lost: " + sc);
  await p.screenshot({ path:SHOTS + "g-ttt.png" });
  // memory
  await tab("memG");
  check(await p.locator("#mem .mc").count() === 16, "16 memory cards");
  const faces = await p.$$eval("#mem .mc b", bs => bs.map(b => b.textContent));
  const pairs = {}; faces.forEach((f, i) => (pairs[f] = pairs[f] || []).push(i));
  for (const f in pairs) { await p.click("#mem .mc >> nth=" + pairs[f][0]); await p.click("#mem .mc >> nth=" + pairs[f][1]); await p.waitForTimeout(80); }
  check(/All pairs in 8 moves/.test(await p.textContent("#memMsg")), "memory solved in 8 moves");
  // minesweeper: right-click flags, hard is 16x16
  await tab("mineG");
  await p.click('#mineLvl button[data-v="hard"]');
  check(await p.locator("#mine button").count() === 256, "16x16 minefield");
  await p.click("#mine button >> nth=100"); await p.waitForTimeout(100);
  check(await p.locator("#mine button.open").count() > 1, "first click opens an area");
  const closed = await p.$$eval("#mine button", bs => bs.findIndex(b => !b.classList.contains("open")));
  await p.click("#mine button >> nth=" + closed, { button:"right" });
  check((await p.textContent("#mine button >> nth=" + closed)) === "🚩", "right-click flags");
  check(/💣 39/.test(await p.textContent("#mineStat")), "flag count");
  await p.screenshot({ path:SHOTS + "g-mine.png" });
  await p.click('#mineLvl button[data-v="easy"]');
  // breakout
  await tab("brkG");
  await p.mouse.move(500, 500);
  await p.click("#brk"); await p.waitForTimeout(2500);
  await p.screenshot({ path:SHOTS + "g-brk.png" });
  check(/Level 1 · Score \d+/.test(await p.textContent("#brkS")), "breakout hud: " + await p.textContent("#brkS"));
  // pong
  await tab("pongG");
  await p.click("#pong"); await p.waitForTimeout(2500);
  await p.screenshot({ path:SHOTS + "g-pong.png" });
  check(/You \d+ · Computer \d+/.test(await p.textContent("#pongS")), "pong score line");
  // typing
  await tab("typeG");
  check(await p.evaluate(() => document.activeElement.id) === "typeIn", "typing box focused");
  await p.click('#typeLen button[data-v="15"]');
  const words = await p.$$eval("#typeBox span", s => s.slice(0, 30).map(x => x.textContent));
  for (let i = 0; i < 30; i++) await p.keyboard.type((i === 3 ? "xx" : words[i]) + " ", { delay:5 });
  check(await p.locator("#typeBox span.bad").count() === 1 && await p.locator("#typeBox span.ok").count() === 29, "typing marks right and wrong words");
  check(await p.evaluate(() => document.getElementById("typeW").scrollTop > 0), "typing box scrolls along");
  await p.screenshot({ path:SHOTS + "g-type.png" });
  await p.waitForTimeout(15500);
  const ts = await p.textContent("#typeStat");
  check(/\d+ wpm · \d+% accuracy/.test(ts), "typing result: " + ts);
  // reaction
  await tab("reactG");
  for (let n = 0; n < 5; n++) {
    await p.click("#react"); // arm
    await p.waitForFunction(() => document.getElementById("react").className === "go", null, { timeout:6000 });
    await p.click("#react");
  }
  const rm = await p.textContent("#react b");
  check(/ms average/.test(rm), "reaction result: " + rm);
  await p.click("#react"); await p.click("#react"); // too soon
  check(/Too soon/.test(await p.textContent("#react b")), "too soon");
  // aim
  await tab("aimG");
  await p.click("#aimGo"); await p.waitForTimeout(900);
  for (let n = 0; n < 6; n++) { const t = await p.$("#aim i"); if (t) { const b = await t.boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } await p.waitForTimeout(350); }
  await p.screenshot({ path:SHOTS + "g-aim.png" });
  check(/Hits [1-9]/.test(await p.textContent("#aimStat")), "aim hits: " + await p.textContent("#aimStat"));
  await tab("runner");
  check(await p.locator("#aim i").count() === 0, "aim round stops when leaving");
  const best = await p.evaluate(() => JSON.parse(localStorage.getItem("wsb.games") || "{}"));
  check(best.mem === 8 && best.react > 0 && best.wpm > 0, "bests saved " + JSON.stringify(best));
  check(/8 moves/.test(await p.textContent("#bM")), "best on tab");
  // hash opens a game; light theme renders
  await p.goto("https://browser.example/games.html#pong"); await p.waitForTimeout(400);
  check(await p.evaluate(() => document.getElementById("pongG").classList.contains("on")), "#pong opens Pong");
  await p.evaluate(() => { localStorage.setItem("wsb.settings", JSON.stringify({ theme:"light" })); });
  await p.goto("https://browser.example/games.html#breakout"); await p.reload(); await p.waitForTimeout(500);
  await p.screenshot({ path:SHOTS + "g-light.png" });
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
