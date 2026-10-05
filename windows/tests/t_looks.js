// Anime and looks (Windows 3.10, iPhone 2.9): event themes from the dashboard and the vote on the next one,
// wallpapers that move with the music, the hidden spider, the pointer trail, the schedule, the screensaver,
// Mochi the companion, and (iPhone) a video or GIF as the start page's background.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const LIVE = { at:Date.now(), d:{ ok:true, event:{ id:"halloween", until:Date.now() + 864e5 },
  tvote:{ id:"tv12345a", q:"Which theme should Webs add next?", opts:[{ n:"Pirate Storm", e:"🌊", d:"Waves and lightning" }, { n:"Neon City", e:"🌆", d:"Rain on neon" }], counts:[3, 1] } } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.addInitScript(live => { if (location.hostname === "browser.example" && !localStorage.getItem("wsb.settings")) { localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", accent:"#3b8bf0" })); localStorage.setItem("wsb.live", JSON.stringify(live)); } }, LIVE);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  const S = p => p.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")));

  /* ---------------------------------------------------------------- the new tab page */
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(900);
  check(await n.evaluate(() => Anime.THEMES.length === 9 && Anime.EVENTS.length === 4), "nine themes, and four event themes");
  check(await n.evaluate(() => Anime.events().map(t => t.id).join() === "halloween" && Anime.events()[0].live), "the event on the dashboard (Haunted Night) is in the picker now");
  check(await n.evaluate(() => !!document.querySelector("#liveBox .lv-event") && /Haunted Night is here/.test(document.querySelector("#liveBox .lv-event").textContent)), "and a card says so on the start page");
  check(await n.evaluate(() => document.querySelectorAll("#liveBox .lv-tvote .lv-tile").length === 2), "the vote on the next theme: two ideas as tiles");
  await n.evaluate(() => document.querySelector("#liveBox .lv-tvote .lv-tile").click()); await wait(300);
  check(await n.evaluate(() => JSON.parse(localStorage.getItem("wsb.liveSeen")).tvote.tv12345a === 0 && /75%/.test(document.querySelector("#liveBox .lv-tvote").textContent)), "a vote, and the results so far (75%)");
  await n.evaluate(() => document.querySelector("#liveBox .lv-event .lv-try").click()); await wait(500);
  check(await n.evaluate(() => !document.getElementById("bgbox").classList.contains("hide") && !!document.querySelector('#anPick .an-tile.an-ev[data-id="halloween"]')), "Try it opens the picker, with the event's tile");
  await n.evaluate(() => document.querySelector('#anPick .an-tile[data-id="halloween"]').click()); await wait(700);
  check((await S(n)).anime === "halloween" && await n.evaluate(() => JSON.parse(localStorage.getItem("wsb.animeKeep")).includes("halloween")), "picked: it's on, and kept for after the event");
  await n.evaluate(() => document.getElementById("bgbox").classList.add("hide")); await wait(600);
  await n.screenshot({ path:SHOTS + "looks-halloween.png" });
  for (const id of ["winter", "newyear", "hearts"]) {
    await n.evaluate(id => { const s = JSON.parse(localStorage.getItem("wsb.settings")); Anime.apply(s, id, { pc:true }); localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); applyCustom(); }, id); await wait(900);
    const a = await n.evaluate(() => document.getElementById("anlive").toDataURL().length); await wait(500);
    check(a !== await n.evaluate(() => document.getElementById("anlive").toDataURL().length) && await n.evaluate(id => document.getElementById("anBox").classList.contains("an-" + id), id), id + ": its wallpaper moves, and its card");
    await n.screenshot({ path:SHOTS + "looks-" + id + ".png" });
  }
  // the music: the bass of what's playing makes the wallpaper glow and hurry
  check(await n.evaluate(() => X3N.anime.beat() === 0), "no music, no beat");
  await n.evaluate(() => { vizBins = Array.from({ length:48 }, (_, i) => i < 8 ? 250 : 40); vizAt = Date.now(); });
  check(await n.evaluate(() => X3N.anime.beat() > .7), "a loud bass: the wallpaper moves with it");
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.animeBeat = false; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); vizAt = Date.now(); });
  check(await n.evaluate(() => { for (let i = 0; i < 30; i++) X3N.anime.beat(); return X3N.anime.beat() < .1; }), "Move with the music off: it calms down and stops");
  // the hidden spider (seconds ahead, so it's out now)
  await n.evaluate(() => { const c = document.getElementById("anlive"); X3N.anime.wall().stop(); window.__w = Anime.run(c, "hearts", { hidden:50 }); });
  await wait(400);
  const sp = await n.evaluate(() => window.__w.hidden());
  check(sp && sp.r > 0 && (sp.x < 1280 * .3 || sp.x > 1280 * .7), "a little spider is hiding at the side of the wallpaper: " + JSON.stringify(sp));
  await n.screenshot({ path:SHOTS + "looks-spider.png" });
  check(await n.evaluate(sp => { const s = Object.assign({}, sp); const a = Anime.foundIt(s), b = Anime.foundIt(s); return a && !b && Anime.found("hearts") === 1; }, sp), "finding it counts once");
  // the trail
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.animeTrail = true; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); applyCustom(); });
  await n.mouse.move(300, 300); for (let i = 0; i < 12; i++) { await n.mouse.move(300 + i * 30, 300 + i * 8); await wait(30); }
  check(await n.evaluate(() => { const c = document.querySelector("canvas.an-trail"); if (!c) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) return true; return false; }), "a trail of hearts behind the pointer");
  await n.screenshot({ path:SHOTS + "looks-trail.png" });
  // Mochi
  check(await n.evaluate(() => !!document.querySelector(".bd svg")), "Mochi is in the corner");
  await n.evaluate(() => document.querySelector(".bd").click()); await wait(300);
  check(await n.evaluate(() => document.querySelector(".bd-say").classList.contains("on") && document.querySelector(".bd-say").textContent.length > 3), "poke Mochi and it says something: " + await n.evaluate(() => document.querySelector(".bd-say").textContent));
  await n.evaluate(() => { const x = JSON.parse(localStorage.getItem("wsb.xp") || "{}"); x.total = 4000; localStorage.setItem("wsb.xp", JSON.stringify(x)); Buddy.unmount(); Buddy.mount({ bottom:64, right:22 }); });
  await wait(300);
  check(await n.evaluate(() => document.querySelector(".bd").dataset.stage === "2" && !!document.querySelector(".bd-wings") && !!document.querySelector(".bd-ant")), "at level 10 it has antennae and wings");
  await n.screenshot({ path:SHOTS + "looks-buddy.png", clip:{ x:1000, y:560, width:280, height:240 } });
  check(await n.evaluate(() => SHOW.some(x => x[0] === "buddy")), "Customize can hide Mochi");
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.ntpHide = (s.ntpHide || []).concat("buddy"); localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); applyCustom(); }); await wait(200);
  check(await n.evaluate(() => !document.querySelector(".bd")), "and hidden, it goes");

  /* ---------------------------------------------------------------- the browser window: schedule and screensaver */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); }); await wait(300);
  await c.evaluate(() => { if (overlay) closeOver(); });
  await c.evaluate(() => X3.animePanel()); await wait(500);
  check(await c.evaluate(() => !!document.querySelector("#anp #anpSaver") && !!document.querySelector("#anp #anpSched .an-sch-m")), "Menu → Anime themes…: screensaver and schedule");
  await c.evaluate(() => document.querySelector('#anp #anpSched button[data-m="day"]').click()); await wait(100);
  await c.evaluate(() => document.querySelectorAll("#anp #anpSched select").forEach(s => { s.value = "naruto"; s.dispatchEvent(new Event("change")); }));
  await c.screenshot({ path:SHOTS + "looks-schedule.png" });
  await wait(200);
  check(await c.evaluate(() => cfg.anime === "naruto" && cfg.animeSched.mode === "day"), "a schedule for the time of day: its theme goes on now");
  await c.evaluate(() => { closeOver(); X3.animePanel(); document.querySelector('#anp .an-tile[data-id="ghoul"]').click(); X3.schedNow(); }); await wait(200);
  check(await c.evaluate(() => cfg.anime === "ghoul"), "one picked by hand stays until the next part of the day");
  await c.evaluate(() => { cfg.animeSlot = "an earlier part of the day"; X3.schedNow(); }); await wait(200);
  check(await c.evaluate(() => cfg.anime === "naruto"), "and then the schedule's comes back");
  await c.evaluate(() => { closeOver(); cfg.animeSched = {}; cfg.animeSaver = 2; saveNow("settings"); X3.saver.idleFor(5 * 60000); }); await wait(5600);
  check(await c.evaluate(() => !X3.saver.on()), "a website on screen: no screensaver (you might be reading)");
  await c.evaluate(() => { __host("tab-created", 2, 0, "https://browser.example/newtab.html", "", 0, 0); __host("tab-selected", 2); X3.saver.idleFor(5 * 60000); }); await wait(5600);
  check(await c.evaluate(() => X3.saver.on() && overlay === "ansv" && !!document.querySelector("#over .an-saver canvas")), "the new tab page left alone: the screensaver covers the window");
  await c.screenshot({ path:SHOTS + "looks-saver.png" });
  await wait(1000); await c.keyboard.press("a"); await wait(600);
  check(await c.evaluate(() => !X3.saver.on() && overlay !== "ansv"), "a key brings the browser back");
  await c.evaluate(() => { __host("tab-audio", 2, 1); X3.saver.idleFor(5 * 60000); }); await wait(5600);
  check(await c.evaluate(() => !X3.saver.on()), "nothing while something plays");
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html"); await wait(400);
  check(await st.evaluate(() => document.getElementById("anSaver").value === "2" && !!document.getElementById("anSchEdit")), "Settings: Screensaver (after 2 minutes) and Theme schedule");

  /* ---------------------------------------------------------------- the iPhone app */
  const a = await ctx.newPage(); watch(a, errors, "app");
  await a.addInitScript(live => { if (!localStorage.getItem("wsb.settings")) { localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark" })); localStorage.setItem("wsb.live", JSON.stringify(live)); } }, LIVE);
  await a.setViewportSize({ width:390, height:844 });
  await a.goto("https://app.example/index.html"); await wait(1500);
  check(await a.evaluate(() => !!document.querySelector(".lv-event") && !!document.querySelector(".lv-tvote")), "iPhone: the event and the vote on the start page too");
  check(await a.evaluate(() => !!document.querySelector(".bd svg")), "iPhone: Mochi in the corner of the start page");
  await a.evaluate(() => { document.querySelector(".lv-event .lv-try").click(); }); await wait(700);
  check(await a.evaluate(() => !!document.querySelector('#anPick .an-tile[data-id="halloween"]') && !!document.getElementById("anSaver") && !!document.querySelector("#anSched .an-sch-m")), "iPhone: Try it opens Anime themes, with the event, the screensaver and the schedule");
  await a.screenshot({ path:SHOTS + "looks-iphone-sheet.png" });
  await a.evaluate(() => { document.querySelector('#anPick .an-tile[data-id="halloween"]').click(); }); await wait(500);
  await a.evaluate(() => { cfg.animeSaver = 2; save("settings", cfg); closeSheet && closeSheet(); }); await wait(300);
  await a.evaluate(() => AnimeApp.idleFor(3 * 60000)); await wait(5600);
  check(await a.evaluate(() => !!AnimeApp.saver() && !!document.querySelector(".an-saver")), "iPhone: the start page left alone: the screensaver");
  await a.screenshot({ path:SHOTS + "looks-iphone-saver.png" });
  await a.mouse.click(200, 400); await wait(600);
  check(await a.evaluate(() => !AnimeApp.saver()), "a tap brings it back");
  // a GIF or a video as the background, kept as it is
  await a.evaluate(async () => { await chooseMoving(new File([new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0, 59])], "a.gif", { type:"image/gif" })); });
  await wait(400);
  check(await a.evaluate(() => cfg.mbgKind === "gif" && /blob:/.test(document.getElementById("bgl").style.backgroundImage)), "iPhone: a GIF is the background, moving as it is");
  await a.evaluate(async () => { await chooseMoving(new File([new Uint8Array(2000)], "a.mp4", { type:"video/mp4" })); });
  await wait(400);
  check(await a.evaluate(() => cfg.mbgKind === "video" && !!document.querySelector("#bgl video.bgvid") && document.querySelector("#bgl video").muted), "and a video: playing muted, on a loop");

  // (the iPhone app's service worker can't be registered from a test route)
  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load because no supported source|NotSupportedError/.test(e));
  errors.length = 0; errors.push(...real);
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
