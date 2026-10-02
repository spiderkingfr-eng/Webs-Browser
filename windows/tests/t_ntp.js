const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:860 } });
  await setup(ctx);
  await ctx.addInitScript(() => { if (location.hostname === "browser.example" && !sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1);
    localStorage.setItem("wsb.settings", JSON.stringify({ ntpShow:["xprog", "xfocus", "xmoon", "xwclock", "xwater", "xscreen", "xmark"], liveBg:"net" }));
    localStorage.setItem("wsb.bookmarks", JSON.stringify([{ u:"https://example.com/", t:"Example", ts:Date.now() - 9e9 }]));
    localStorage.setItem("wsb.screentime", JSON.stringify({ [new Date().toLocaleDateString("en-CA")]:{ "youtube.com":3900, "github.com":600 } })); } });
  const p = await ctx.newPage(); watch(p, errors, "ntp");
  await p.goto("https://browser.example/newtab.html"); await p.waitForTimeout(1200);
  check(await p.evaluate(() => document.querySelectorAll("#xgrid .wg").length === 7), "7 new widgets");
  check(await p.evaluate(() => /1 h 15 min/.test(document.querySelector('[data-w="xscreen"]').textContent)), "screen time widget");
  check(await p.evaluate(() => /lit/.test(document.querySelector('[data-w="xmoon"]').textContent)), "moon widget");
  await p.fill('[data-w="xfocus"] input', "Finish the essay"); await p.press('[data-w="xfocus"] input', "Enter");
  check(await p.evaluate(() => /Finish the essay/.test(document.querySelector('[data-w="xfocus"]').textContent)), "focus saved");
  await p.click('[data-w="xwater"] button[data-i="2"]');
  check(await p.evaluate(() => /3 of 8/.test(document.querySelector('[data-w="xwater"]').textContent)), "water tracker");
  check(await p.evaluate(() => !!document.querySelector("canvas#live")), "constellation wallpaper running");
  await p.screenshot({ path:SHOTS + "ntp-widgets.png", fullPage:false });
  await p.evaluate(() => window.scrollTo(0, 2000)); await p.waitForTimeout(300);
  await p.screenshot({ path:SHOTS + "ntp-widgets2.png" });
  for (const k of ["matrix", "warp", "bubbles", "lava", "petals", "aurora", "", "net"]) {
    await p.evaluate(k => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.liveBg = k; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); liveBg(); }, k);
    await p.waitForTimeout(500);
    check(await p.evaluate(() => document.querySelectorAll("canvas#live").length) === (k ? 1 : 0), "one wallpaper canvas for " + (k || "none"));
    if (["matrix", "lava", "petals", "warp"].includes(k)) await p.screenshot({ path:SHOTS + "ntp-" + k + ".png" });
  }
  check(await p.evaluate(() => [...document.querySelectorAll("#liveSeg button")].length === 16), "wallpaper buttons");
  check(await p.evaluate(() => ENGS.some(e => e[0] === "ecosia")), "new engines in the engine menu");
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
