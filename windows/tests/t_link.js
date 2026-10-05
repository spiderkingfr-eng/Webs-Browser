// Your phone and PC (Windows 3.10, iPhone 2.9; ../js/link.js) and playing a friend (../js/games.online.js), end to end:
// the pages talk through the server's own room code (../server/web-ai/rooms.js), run here in Node.
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const { Room } = await import(pathToFileURL(path.join(APP, "server", "web-ai", "rooms.js")).href);
  const rooms = new Map();
  const ctxFake = () => { const store = new Map(), socks = []; return { storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete:async k => store.delete(k), deleteAll:async () => store.clear(),
    list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || ""))), setAlarm:async () => {} }, acceptWebSocket(ws) { socks.push(ws); }, getWebSockets() { return socks.filter(w => !w.closed); } }; };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  const LINK = "k".repeat(24);
  let joined = 0;
  await ctx.route("https://web-ai.test/**", r => {
    const u = new URL(r.request().url());
    if (u.pathname === "/link/new") return r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify({ ok:true, link:LINK, code:"123456", minutes:10 }) });
    if (u.pathname === "/link/join") { joined++; const b = JSON.parse(r.request().postData() || "{}"); return r.fulfill({ status:b.pair === "123456" ? 200 : 404, contentType:"application/json", headers:{ "access-control-allow-origin":"*" },
      body:JSON.stringify(b.pair === "123456" ? { ok:true, link:LINK } : { error:"pair", message:"That code isn't right" }) }); }
    r.fulfill({ status:404, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:"{}" });
  });
  await ctx.routeWebSocket(/web-ai\.test\/room/, async ws => {
    const u = new URL(ws.url()), k = u.searchParams.get("k");
    let room = rooms.get(k); if (!room) { room = new Room(ctxFake(), {}); rooms.set(k, room); }
    const fake = { att:null, closed:false, send(s) { try { ws.send(s); } catch (e) {} }, close(c) { this.closed = true; try { ws.close({ code:c }); } catch (e) {} },
      serializeAttachment(a) { this.att = a; }, deserializeAttachment() { return this.att; } };
    ws.onMessage(m => room.webSocketMessage(fake, String(m)));
    ws.onClose(() => { if (!fake.closed) { fake.closed = true; room.webSocketClose(fake); } });
    await room.join(fake, { room:k, kind:k[0] === "g" ? "game" : "link", dev:u.searchParams.get("dev"), name:u.searchParams.get("name"), app:u.searchParams.get("app") });
  });
  await ctx.addInitScript(() => { try { if (/browser\.example|app\.example/.test(location.hostname) && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://web-ai.test" })); } catch (e) {} });

  /* ---------------------------------------------------------------- the shared parts */
  const pc = await ctx.newPage(); watch(pc, errors, "pc");
  await pc.goto("https://browser.example/chrome.html"); await wait(400);
  check(await pc.evaluate(() => { const l = [{ u:"https://a.example/x", t:"A é" }, { u:"https://b.example/", t:"B" }, { u:"javascript:alert(1)", t:"no" }];
    const s = Link.readShare(new URL(Link.shareUrl("My set", l)).hash); return s.name === "My set" && s.list.length === 2 && s.list[0].t === "A é" && !Link.readShare("#tabs=garbage") && /^[A-Z2-9]{6}$/.test(Link.newCode()); }),
    "a set of tabs in a link, and back; game codes");

  /* ---------------------------------------------------------------- linking */
  await pc.evaluate(() => { __host("viewport", 1280, 820); __host("tab-created", 1, 0, "https://news.example/story", "", 0, 0); __host("tab-title", 1, "A story"); __host("tab-selected", 1); if (overlay) closeOver(); X3.link.devicesPanel(); });
  await wait(100);
  await pc.evaluate(() => document.querySelector("#lkpanel .lk-make").click());
  check(await until(pc, () => /123 456/.test(document.querySelector("#lkpanel .lkcode").textContent)), "the PC makes a code");
  check(await until(pc, () => X3.link.room() && X3.link.room().open), "and opens its room");
  await pc.screenshot({ path:SHOTS + "link-code.png" });
  const ph = await ctx.newPage(); watch(ph, errors, "phone");
  await ph.setViewportSize({ width:390, height:844 });
  await ph.goto("https://app.example/index.html"); await wait(1500);
  await ph.evaluate(() => LinkApp.linkSheet()); await wait(200);
  await ph.fill("#lkCode", "999999"); await ph.evaluate(() => $("#lkJoin").click()); await wait(300);
  check(await ph.evaluate(() => /isn't right/.test($("#lkErr").textContent) && !Link.linked()), "a wrong code: says so");
  await ph.fill("#lkCode", "123 456"); await ph.evaluate(() => $("#lkJoin").click());
  check(await until(ph, () => Link.linked() && LinkApp.room() && LinkApp.room().open), "the phone links with the code, and joins the room");
  check(await until(pc, () => Link.others().some(p => p.app === "iphone")), "the PC sees the phone");
  await pc.evaluate(() => X3.link.devicesPanel()); await wait(200);
  check(await pc.evaluate(() => /iPhone/.test(document.querySelector("#lkpanel .lkdev").textContent) && /Shared clipboard/.test(document.querySelector("#lkpanel").textContent)), "the PC's panel: the phone online, and the switches");
  await pc.screenshot({ path:SHOTS + "link-panel.png" });
  await ph.screenshot({ path:SHOTS + "link-app.png" });

  /* ---------------------------------------------------------------- the clipboard */
  await ph.evaluate(() => Link.sendClip("hello from the phone"));
  check(await until(pc, () => /From iPhone: hello from the phone/.test(document.getElementById("toast").textContent)), "the phone's clipboard shows on the PC, to copy");
  await pc.evaluate(() => { closeOver(); addClip("not shared", null); });
  await wait(300);
  check(await ph.evaluate(() => !/not shared/.test(document.getElementById("toast").textContent)), "the PC's copies stay put until the shared clipboard is on");
  await pc.evaluate(() => { cfg.xClipShare = true; addClip("copied on the PC", null); });
  check(await until(ph, () => /From PC: copied on the PC/.test(document.getElementById("toast").textContent)), "then they show on the phone");

  /* ---------------------------------------------------------------- the remote */
  await pc.evaluate(() => { __host("tab-created", 2, 0, "https://video.example/", "", 0, 0); __host("tab-selected", 1); __sent.length = 0; });
  await ph.evaluate(() => LinkApp.room().msg({ k:"remote", cmd:"nexttab" })); await wait(300);
  check(await pc.evaluate(() => !__sent.some(m => m.startsWith("select-tab"))), "the remote does nothing until the PC allows it");
  await pc.evaluate(() => { cfg.xRemote = true; });
  await ph.evaluate(() => LinkApp.remoteSheet()); await wait(200);
  await ph.evaluate(() => document.querySelector('[data-r="nexttab"]').click());
  check(await until(pc, () => __sent.some(m => m === "select-tab\u00012")), "next tab, from the phone");
  await ph.evaluate(() => document.querySelector('[data-r="playpause"]').click());
  await ph.fill("#lkGo", "cats in boxes"); await ph.evaluate(() => $("#lkGoB").click());
  check(await until(pc, () => __sent.some(m => m.startsWith("media\u0001") && /toggle/.test(m)) && __sent.some(m => m.startsWith("new-tab\u0001") && /cats/.test(m))), "play/pause, and a search opened on the PC");
  await ph.screenshot({ path:SHOTS + "link-remote.png" });

  /* ---------------------------------------------------------------- pick up where you left off */
  await pc.evaluate(() => { __host("tab-selected", 1); applyPage(T(1)); });
  check(await until(ph, () => Link.nowList().some(x => x.u === "https://news.example/story" && x.from === "PC"), 7000), "the PC's page reaches the phone");
  await ph.evaluate(() => { closeSheet(); LinkApp.card(); }); await wait(200);
  check(await ph.evaluate(() => !$("#lkSec").classList.contains("hide") && /Continue from PC/.test($("#lkSec").textContent) && /A story/.test($("#lkSec").textContent)), "a card on the phone's start page");
  await ph.screenshot({ path:SHOTS + "link-continue.png" });
  await ph.evaluate(() => go("https://en.wikipedia.org/wiki/Cat"));
  check(await until(pc, () => (JSON.parse(localStorage.getItem("wsb.linkNow") || "[]")[0] || {}).u === "https://en.wikipedia.org/wiki/Cat", 8000), "the phone's page reaches the PC");
  const nt = await ctx.newPage(); watch(nt, errors, "newtab");
  await nt.goto("https://browser.example/newtab.html"); await wait(600);
  check(await nt.evaluate(() => !document.getElementById("lkSec").classList.contains("hide") && /Continue from iPhone/.test(document.getElementById("lkSec").textContent)), "and shows on the new tab page");
  await nt.close();

  /* ---------------------------------------------------------------- sets of tabs */
  await pc.evaluate(() => X3.link.sharePanel("")); await wait(150);
  await pc.evaluate(() => document.querySelector("#lkshare .lk-dev").click());
  check(await until(ph, () => /PC sent 2 tabs/.test(document.getElementById("toast").textContent)), "the PC's tabs sent to the phone");
  await ph.evaluate(() => LinkApp.setSheet(Link.tabSets()[0])); await wait(200);
  check(await ph.evaluate(() => document.querySelectorAll("#sheetBody [data-i]").length === 2), "listed there, to open");
  await ph.evaluate(() => { closeSheet(); go("https://example.org/page"); LinkApp.sendTabs(); });
  check(await until(pc, () => /iPhone sent \d+ tab/.test(document.getElementById("toast").textContent)), "and the phone's to the PC");
  await pc.evaluate(() => { __sent.length = 0; X3.link.openSet({ name:"From iPhone", list:[{ u:"https://a.example/" }, { u:"https://b.example/" }] }); });
  check(await pc.evaluate(() => __sent.filter(m => m.startsWith("new-tab\u0001https://")).length === 2 && Object.values(groups).some(g => g.name === "From iPhone")), "opened on the PC in a group");
  const sh = await ctx.newPage(); watch(sh, errors, "shared");
  await sh.setViewportSize({ width:390, height:844 });
  const url = await pc.evaluate(() => Link.shareUrl("Trip ideas", [{ u:"https://maps.example/", t:"Map" }, { u:"https://hotel.example/", t:"Hotel" }]));
  await sh.goto(url.replace("https://spiderkingfr-eng.github.io/Webs-Browser/", "https://app.example/index.html")); await wait(1800);
  check(await sh.evaluate(() => $("#sheetTitle").textContent === "Trip ideas" && document.querySelectorAll("#sheetBody [data-i]").length === 2), "a shared link opens as a list in the app");
  await sh.close();

  /* ---------------------------------------------------------------- unlink */
  await pc.evaluate(() => { X3.link.devicesPanel(); window.confirm = () => true; document.querySelector("#lkpanel .lk-off").click(); });
  check(await pc.evaluate(() => !Link.linked() && /Make a code/.test(document.querySelector("#lkpanel").textContent)), "unlinking");

  /* ---------------------------------------------------------------- play a friend */
  const g1 = await ctx.newPage(); watch(g1, errors, "games-pc");
  await g1.goto("https://browser.example/games.html"); await wait(500);
  const g2 = await ctx.newPage(); watch(g2, errors, "games-phone");
  await g2.setViewportSize({ width:390, height:844 });
  await g2.goto("https://app.example/games.html"); await wait(800);
  check(await g1.evaluate(() => { const T = GamesOnline.TTT, C = GamesOnline.C4;
    return T.result([0, 3, 1, 4, 2]).win === 0 && T.result([0, 1, 2, 4, 3, 5, 7, 6, 8]).draw && !T.legal([0], 0) && C.result([0, 1, 0, 1, 0, 1, 0]).win === 0 && C.result([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]).win === 0 && !C.legal([0, 0, 0, 0, 0, 0], 0); }),
    "the rules: three in a row, a draw, four in a row (across, up, diagonally), a full column");
  await g1.evaluate(() => document.querySelector('.tabs button[data-g="onlineG"]').click()); await wait(200);
  await g1.fill("#goName", "Sam"); await g1.evaluate(() => $("goName").dispatchEvent(new Event("change")));
  await g1.evaluate(() => document.querySelector('.go-kind[data-k="ttt"]').click());
  check(await until(g1, () => /^[A-Z2-9]{6}$/.test(GamesOnline.state().code) && /Waiting for your friend/.test(document.querySelector(".go-msg").textContent)), "a game made: its code, waiting");
  const gcode = await g1.evaluate(() => GamesOnline.state().code);
  await g2.evaluate(() => document.querySelector('.tabs button[data-g="onlineG"]').click()); await wait(200);
  await g2.fill("#goCode", "ZZZZZZ"); await g2.evaluate(() => $("goJoin").click());
  check(await until(g2, () => /no game with the code ZZZZZZ/.test($("goErr").textContent)), "a code with no game");
  await g2.fill("#goCode", gcode.toLowerCase()); await g2.evaluate(() => $("goJoin").click());
  check(await until(g2, () => GamesOnline.state().role === 1 && /Sam to move/.test(document.querySelector(".go-msg").textContent)), "the friend joins as the second player");
  check(await until(g1, () => /Your move/.test(document.querySelector(".go-msg").textContent)), "and the maker moves first");
  await g2.evaluate(() => GamesOnline.move(4)); await wait(200);
  check(await g1.evaluate(() => GamesOnline.state().G.mv.length === 0), "not your turn: nothing happens");
  const play = async (p, m) => { await p.evaluate(m => document.querySelector('.go-ttt [data-m="' + m + '"]').click(), m); };
  await play(g1, 0); check(await until(g2, () => GamesOnline.state().G.mv.length === 1 && /Your move/.test(document.querySelector(".go-msg").textContent)), "a move reaches the friend");
  await play(g2, 4); await until(g1, () => GamesOnline.state().G.mv.length === 2);
  await play(g1, 1); await until(g2, () => GamesOnline.state().G.mv.length === 3);
  await play(g2, 8); await until(g1, () => GamesOnline.state().G.mv.length === 4);
  await play(g1, 2);
  check(await until(g1, () => /You win/.test(document.querySelector(".go-msg").textContent)) && await until(g2, () => /Sam wins/.test(document.querySelector(".go-msg").textContent)), "three in a row: the winner and the loser both told");
  await g1.screenshot({ path:SHOTS + "link-ttt.png" });
  await g2.evaluate(() => $("goAgain").click());
  check(await until(g1, () => GamesOnline.state().G.mv.length === 0 && GamesOnline.state().role === 1 && !/Your move/.test(document.querySelector(".go-msg").textContent)), "play again: the other one starts");
  // come back later: the game is still there
  await g1.reload(); await wait(600);
  await g1.evaluate(() => document.querySelector('.tabs button[data-g="onlineG"]').click());
  check(await until(g1, () => GamesOnline.state().code && GamesOnline.state().G && GamesOnline.state().G.n === 2), "the page closed and opened again: back in the same game");
  // chess and Connect Four
  await g1.evaluate(() => GamesOnline.lobby()); await g1.evaluate(() => document.querySelector('.go-kind[data-k="chess"]').click());
  await until(g1, () => GamesOnline.state().G && GamesOnline.state().G.kind === "chess");
  const ccode = await g1.evaluate(() => GamesOnline.state().code);
  await g2.evaluate(c => GamesOnline.join(c), ccode);
  await until(g2, () => GamesOnline.state().role === 1);
  for (const [p, m] of [[g1, [53, 45]], [g2, [12, 28]], [g1, [54, 38]], [g2, [3, 39]]]) { await p.evaluate(m => GamesOnline.move(m), m); await wait(250); }
  check(await until(g1, () => /wins this one/.test(document.querySelector(".go-msg").textContent)) && await until(g2, () => /You win/.test(document.querySelector(".go-msg").textContent)), "chess with a friend: fool's mate");
  check(await g2.evaluate(() => document.querySelectorAll(".go-board .sq").length === 64 && document.querySelector('.go-board .sq').dataset.i === "63"), "the second player sees the board from black's side");
  await g2.screenshot({ path:SHOTS + "link-chess.png" });
  await g1.evaluate(() => GamesOnline.lobby()); await g1.evaluate(() => document.querySelector('.go-kind[data-k="c4"]').click());
  await until(g1, () => GamesOnline.state().G && GamesOnline.state().G.kind === "c4");
  await g2.evaluate(c => GamesOnline.join(c), await g1.evaluate(() => GamesOnline.state().code));
  await until(g2, () => GamesOnline.state().role === 1);
  for (const [p, c] of [[g1, 3], [g2, 3], [g1, 4], [g2, 4], [g1, 2], [g2, 2], [g1, 5]]) { await p.evaluate(c => document.querySelector('.go-c4 [data-c="' + c + '"]').click(), c); await wait(200); }
  check(await until(g2, () => /Sam wins/.test(document.querySelector(".go-msg").textContent) && document.querySelectorAll(".go-c4 .win").length === 4), "Connect Four: four in a row");
  await g2.screenshot({ path:SHOTS + "link-c4.png" });

  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load resource/.test(e));
  console.log(real.length ? "errors:\n  " + real.join("\n  ") : "errors: none");
  check(!real.length, "no page errors: " + real.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
