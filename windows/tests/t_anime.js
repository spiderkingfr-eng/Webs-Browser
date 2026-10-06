// Anime themes on the PC (Webs 3.8): picked on the new tab page, in the browser window or in
// Settings; the whole browser's colors (every page reads the "custom" color theme), the live
// wallpaper and card on the new tab page, the window's band, its sound, and back to your own look.
// 3.8.1: all of it moves, on a loop, gentler with reduce motion and still with Animations: Off.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.addInitScript(() => { if (location.hostname === "browser.example" && !localStorage.getItem("wsb.settings")) localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", accent:"#3b8bf0", pack:"ocean", liveBg:"net", ambient:"" })); });
  const bg = p => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  const S = p => p.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")));

  /* ---------------------------------------------------------------- the new tab page */
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(800);
  const ids = await n.evaluate(() => Anime.THEMES.map(t => t.id));
  check(ids.length === 9, "nine themes");
  check(await n.evaluate(() => document.getElementById("anSec").classList.contains("hide") && !document.getElementById("anlive")), "nothing until one is picked");
  await n.evaluate(() => { document.getElementById("bgbox").classList.remove("hide"); paintBgBox(); }); await wait(600);
  check(await n.evaluate(() => document.querySelectorAll("#anPick .an-tile:not([data-id='+make'])").length === 10 && !!document.querySelector("#anPick .an-tile[data-id='+make']")), "Background → Anime themes: nine tiles and Off (and 3.14: make your own)");
  await n.screenshot({ path:SHOTS + "anime-ntp-picker.png" });
  for (const id of ids) {
    await n.evaluate(id => { document.getElementById("bgbox").classList.remove("hide"); paintBgBox(); document.querySelector('#anPick .an-tile[data-id="' + id + '"]').click(); }, id); await wait(700);
    const s = await S(n), th = await n.evaluate(id => Anime.get(id), id);
    check(s.anime === id && s.pack === "custom" && JSON.stringify(s.customTheme) === JSON.stringify(th.c) && s.accent === th.a && s.liveBg === "anime", id + ": saved for every page " + JSON.stringify({ a:s.anime, p:s.pack, acc:s.accent }));
    check(await bg(n) === th.c[0], id + ": this page's colors");
    check(await n.evaluate(id => { const c = document.getElementById("anlive"); return !!c && c.width > 0 && !document.getElementById("live"); }, id), id + ": its live wallpaper (instead of the one before)");
    check(await n.evaluate(id => !document.getElementById("anSec").classList.contains("hide") && document.getElementById("anBox").classList.contains("an-" + id), id), id + ": its card");
    await n.evaluate(() => document.getElementById("bgbox").classList.add("hide")); await wait(900);
    await n.screenshot({ path:SHOTS + "anime-ntp-" + id + ".png" });
  }
  // everything moves, round and round
  const px = (p, sel) => p.evaluate(sel => { const c = document.querySelector(sel); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 101) h = (h * 31 + d[i]) | 0; return h; }, sel);
  const moves = async (p, sel) => { const a = await px(p, sel); await wait(600); return a !== await px(p, sel); };
  check(await moves(n, "#anlive"), "the wallpaper moves");
  check(await moves(n, "#anBox .an-fx"), "the card's own layer moves (sparkles and shards)");
  check(await n.evaluate(() => getComputedStyle(document.querySelector("#anBox .an-burst")).animationIterationCount === "infinite"), "the card's rays turn forever");
  await n.evaluate(() => { document.getElementById("bgbox").classList.remove("hide"); paintBgBox(); }); await wait(500);
  check(await moves(n, '#anPick .an-tile[data-id="ghoul"] canvas') && await moves(n, '#anPick .an-tile[data-id="onepiece"] canvas'), "the picker's tiles play their wallpapers");
  await n.evaluate(() => document.getElementById("bgbox").classList.add("hide"));
  // Windows' animation effects off: still moving, a gentler version (the page stops its other animations)
  await n.emulateMedia({ reducedMotion:"reduce" }); await n.evaluate(() => { applyCustom(); }); await wait(400);
  check(await n.evaluate(() => Anime.motion() === 1) && await moves(n, "#anlive") && await moves(n, "#anBox .an-fx"), "animation effects off in Windows: it still moves");
  check(await n.evaluate(() => getComputedStyle(document.querySelector("#anBox .an-burst")).animationName === "anSpin"), "and the card's loops keep going");
  await n.emulateMedia({ reducedMotion:"no-preference" });
  // Animations: Off in Webs: still frames
  await n.evaluate(() => { document.documentElement.dataset.motion = "off"; applyCustom(); }); await wait(400);
  check(!(await moves(n, "#anlive")) && !(await moves(n, "#anBox .an-fx")) && await n.evaluate(() => getComputedStyle(document.querySelector("#anBox .an-burst")).animationName === "none"), "Animations: Off stops it all");
  await n.evaluate(() => { document.documentElement.dataset.motion = ""; applyCustom(); }); await wait(300);
  check(await moves(n, "#anlive"), "and on again");
  check(!(await S(n)).ambient, "no sound unless asked");
  await n.evaluate(() => { document.getElementById("bgbox").classList.remove("hide"); paintBgBox(); const c = document.getElementById("anSnd"); c.checked = true; c.dispatchEvent(new Event("change")); }); await wait(300);
  check((await S(n)).ambient === "cafe", "Play its sound: the Phantom Thief's café: " + (await S(n)).ambient);
  // Customize can hide the card
  check(await n.evaluate(() => SHOW.some(x => x[0] === "anime")), "Customize lists the card");

  /* ---------------------------------------------------------------- the other pages follow */
  for (const pg of ["side.html", "settings.html", "games.html", "whatsnew.html"]) {
    const q = await ctx.newPage(); watch(q, errors, pg);
    await q.goto("https://browser.example/" + pg); await wait(500);
    check(await bg(q) === "#0a0a0a", pg + " has the theme's colors too: " + await bg(q));
    await q.close();
  }

  /* ---------------------------------------------------------------- the browser window */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); }); await wait(500);
  await c.evaluate(() => { if (overlay) closeOver(); });
  check(await c.evaluate(() => document.documentElement.dataset.anime === "p5" && getComputedStyle(document.querySelector(".anband")).display === "block"), "the window: the theme's band across the top");
  check(await bg(c) === "#0a0a0a" && await c.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()) === "#e60012", "the window's colors and accent");
  check(await c.evaluate(ids => { const r = ids.every(id => { document.documentElement.dataset.anime = id; const st = getComputedStyle(document.querySelector(".anband")); return st.animationName !== "none" && st.animationIterationCount.split(",").every(x => x.trim() === "infinite"); }); applyPack(); return r; }, ids), "every theme's band moves, on a loop");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Anime themes…/.test(m.textContent) && /Phantom Thief/.test(m.textContent); }), "Menu → Anime themes… (with the one that's on)");
  await c.evaluate(() => X3.animePanel()); await wait(700);
  check(await c.evaluate(() => document.querySelectorAll("#anp .an-tile:not([data-id='+make'])").length === 10 && !!document.querySelector("#anp .an-tile[data-id='+make']")), "the window's picker");
  { const a = await c.evaluate(() => document.querySelector('#anp .an-tile[data-id="jjk"] canvas').toDataURL()); await wait(600);
    check(a !== await c.evaluate(() => document.querySelector('#anp .an-tile[data-id="jjk"] canvas').toDataURL()), "its tiles play"); }
  await c.screenshot({ path:SHOTS + "anime-chrome-picker.png" });
  await c.evaluate(() => { __sent.length = 0; document.querySelector('#anp .an-tile[data-id="ghoul"]').click(); }); await wait(500);
  check(await c.evaluate(() => cfg.anime === "ghoul" && document.documentElement.dataset.anime === "ghoul") && await bg(c) === "#0c0809", "picking in the window recolors it at once");
  check((await S(c)).anime === "ghoul" && (await S(c)).ambient === "rain", "and saves it, with its sound (rain) still on");
  await c.evaluate(() => closeOver());
  await c.screenshot({ path:SHOTS + "anime-chrome-ghoul.png" });
  // the open new tab page catches up by itself
  await wait(400);
  check(await n.evaluate(() => document.getElementById("anBox").classList.contains("an-ghoul")) && await bg(n) === "#0c0809", "an open new tab page follows");

  /* ---------------------------------------------------------------- Settings */
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html"); await wait(500);
  check(/One-Eyed Ghoul/.test(await st.textContent("#anNow")), "Settings shows the one that's on");
  await st.click("#anEdit"); await wait(600);
  check(await st.evaluate(() => document.querySelectorAll("#anPick .an-tile").length === 10), "and has the picker");
  await st.evaluate(() => document.querySelector('#anPick .an-tile[data-id="onepiece"]').click()); await wait(400);
  const s2 = await S(st);
  check(s2.anime === "onepiece" && s2.accent === "#ffc531" && await st.evaluate(() => document.getElementById("pack").value) === "custom", "picking in Settings saves it: " + s2.anime);
  await st.evaluate(() => document.getElementById("anBox").scrollIntoView({ block:"center" })); await wait(300);
  await st.screenshot({ path:SHOTS + "anime-settings.png" });

  /* ---------------------------------------------------------------- back to your own look */
  await n.evaluate(() => { document.getElementById("bgbox").classList.remove("hide"); paintBgBox(); document.querySelector('#anPick .an-tile[data-id=""]').click(); }); await wait(600);
  const s3 = await S(n);
  check(!s3.anime && s3.pack === "ocean" && s3.accent === "#3b8bf0" && s3.liveBg === "net" && !s3.ambient && !s3.animePrev, "No anime theme brings back the look from before: " + JSON.stringify({ p:s3.pack, a:s3.accent, l:s3.liveBg, m:s3.ambient }));
  check(await n.evaluate(() => !document.getElementById("anlive") && document.getElementById("anSec").classList.contains("hide")), "the wallpaper and card go");
  // a private window never shows them
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); Anime.apply(s, "bleach", { pc:true }); localStorage.setItem("wsb.settings", JSON.stringify(s)); });
  const pv = await ctx.newPage(); watch(pv, errors, "private");
  await pv.goto("https://browser.example/newtab.html?private=1"); await wait(600);
  check(await pv.evaluate(() => !document.getElementById("anlive") && document.getElementById("anSec").classList.contains("hide")), "not in a private window");

  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
