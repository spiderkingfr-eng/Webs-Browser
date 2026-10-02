// The first start after an update says it worked; a fresh install and later starts don't.
const { chromium, setup, watch, SHOTS } = require("./harness");
const fs = require("fs"), path = require("path");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const VERSION = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
async function start(browser, seed) {
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.route(/raw\.githubusercontent\.com/, r => r.fulfill({ status:404, body:"" }));
  if (seed) await ctx.addInitScript(s => { if (location.origin === "https://browser.example" && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", 1); for (const k in s) localStorage.setItem("wsb." + k, JSON.stringify(s[k])); } }, seed);
  const p = await ctx.newPage(); watch(p, errors, "updated");
  await p.goto("https://browser.example/chrome.html"); await p.waitForTimeout(3200);
  return { ctx, p, toast:await p.evaluate(() => (document.querySelector("#toast") || {}).textContent || "") };
}
(async () => {
  const browser = await chromium.launch();
  // updated from 3.1.0, which offered this version but didn't note its own
  let r = await start(browser, { xUpd:{ checked:1, latest:{ version:VERSION, url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe", notes:[] } } });
  check(new RegExp("Updated to Webs Browser " + VERSION.replace(/\./g, "\\.")).test(r.toast), "notice after updating from 3.1.0: " + r.toast);
  await r.p.screenshot({ path:SHOTS + "updated.png", clip:{ x:0, y:0, width:1280, height:120 } });
  await r.p.reload(); await r.p.waitForTimeout(3200);
  check(!/Updated to/.test(await r.p.evaluate(() => (document.querySelector("#toast") || {}).textContent || "")), "only once");
  await r.ctx.close();
  // updated from a version that noted itself
  r = await start(browser, { xVersionSeen:"3.1.0" });
  check(/Updated to/.test(r.toast), "notice after updating from a noted version");
  await r.ctx.close();
  // a fresh install, and a downgrade, say nothing
  r = await start(browser, null);
  check(!/Updated to/.test(r.toast), "nothing on a fresh install");
  check(await r.p.evaluate(v => JSON.parse(localStorage.getItem("wsb.xVersionSeen")) === v, VERSION), "version noted");
  await r.ctx.close();
  r = await start(browser, { xVersionSeen:"9.9.9" });
  check(!/Updated to/.test(r.toast), "nothing after going back to an older version");
  await r.ctx.close();
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
