// "Web Studios" when the browser opens: the title card, the startup animation's label, and skipping it.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  async function open(settings) {
    const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
    await setup(ctx);
    if (settings) await ctx.addInitScript(s => { if (location.origin === "https://browser.example") localStorage.setItem("wsb.settings", JSON.stringify(s)); }, settings);
    const p = await ctx.newPage(); watch(p, errors, "studio");
    await p.goto("https://browser.example/chrome.html"); await p.waitForTimeout(200);
    await p.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  let { ctx, p } = await open(null);
  check(/Web Studios/.test(await p.evaluate(() => (document.querySelector("#over .xstudio") || {}).textContent || "")), "title card says Web Studios");
  check(/Webs Browser 3\.\d+\.\d+/.test(await p.textContent("#over .xstudio span")), "with the version under it");
  await p.screenshot({ path:SHOTS + "studio.png" });
  await p.waitForTimeout(1600);
  check(await p.evaluate(() => !document.querySelector("#over .xstudio") && overlay === null), "goes away by itself");
  await p.evaluate(() => { __host("viewport", 1280, 800); }); await p.waitForTimeout(300);
  check(await p.evaluate(() => !document.querySelector("#over .xstudio")), "only once per start");
  await ctx.close();
  ({ ctx, p } = await open(null));
  await p.click("#over .xstudio"); await p.waitForTimeout(100);
  check(await p.evaluate(() => !document.querySelector("#over .xstudio") && overlay === null), "a click skips it");
  await ctx.close();
  ({ ctx, p } = await open({ startAnim:true }));
  check((await p.evaluate(() => (document.querySelector("#over .splash .spn") || {}).textContent)) === "Web Studios", "the startup animation says Web Studios");
  check(await p.evaluate(() => !document.querySelector("#over .xstudio")), "and the card doesn't show twice");
  await ctx.close();
  ({ ctx, p } = await open({ motion:"off" }));
  check(/Web Studios/.test(await p.evaluate(() => (document.querySelector("#over .xstudio") || {}).textContent || "")), "still says it with animations off");
  await ctx.close();
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
