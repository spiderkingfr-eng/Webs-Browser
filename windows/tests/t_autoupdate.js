// The browser and the background updater: it reads ui/user/webs-update.json and
// asks the updater through its inbox (sync-write), instead of downloading anything.
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
const VERSION = require("fs").readFileSync(require("path").join(ROOT, "VERSION"), "utf8").trim();
const NEXT = VERSION.replace(/\d+$/, n => +n + 1);     // the pretend update is always newer than this build
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const INBOX = "C:\\Users\\sam\\AppData\\Local\\Programs\\Webs Browser\\inbox";
let status = null, manifest404 = false;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.route(/raw\.githubusercontent\.com\/.*latest\.json/, r => manifest404 ? r.fulfill({ status:404, body:"404: Not Found" }) :
    r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" },
      body:JSON.stringify({ version:NEXT, notes:["Something new"], updater:{ url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe" } }) }));
  await ctx.route("https://browser.example/user/webs-update.json*", r => status ? r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(Object.assign({ alive:Date.now() }, status)) }) : r.fulfill({ status:404, body:"" }));
  const p = await ctx.newPage(); watch(p, errors, "auto");
  await p.goto("https://browser.example/chrome.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
  const sent = re => p.evaluate(src => __sent.filter(m => new RegExp(src).test(m)), re.source);
  const inbox = async () => (await sent(/^sync-write/)).map(m => { const a = m.split("\u0001"); return { dir:a[1], body:JSON.parse(a[2]) }; });

  // no background updater yet: Update now downloads it, this one last time
  await p.evaluate(() => X3.checkUpdate(true)); await p.waitForTimeout(400);
  check(/one last time/.test(await p.textContent("#xupdp")), "without it, the panel says it's the last download");
  await p.evaluate(() => { __sent.length = 0; [...document.querySelectorAll("#xupdp button")].find(b => b.textContent === "Update now").click(); }); await p.waitForTimeout(300);
  check((await sent(/^dl-retry/)).length === 1 && !(await inbox()).length, "downloads the updater");

  // the background updater is running: it is asked to get the update ready, nothing is downloaded
  status = { v:1, auto:true, inbox:INBOX, latest:VERSION, ready:true, busy:false, error:"", autoInstall:true };
  await p.evaluate(() => { __sent.length = 0; localStorage.removeItem("wsb.xUpdTold"); X3.checkUpdate(false); }); await p.waitForTimeout(600);
  let reqs = await inbox();
  check(reqs.length === 1 && reqs[0].dir === INBOX && reqs[0].body.action === "check", "asks the updater to get " + NEXT + " ready: " + JSON.stringify(reqs));
  check(!(await sent(/^dl-retry/)).length, "nothing downloaded");
  const syncLast = await p.evaluate(() => localStorage.getItem("wsb.syncLast"));
  await p.evaluate(() => __host("sync-done", "1", "Webs Browser sync - PC.json"));
  check(await p.evaluate(() => localStorage.getItem("wsb.syncLast")) === syncLast, "the inbox reply isn't taken for a folder sync");
  check(/Update$/.test(await p.evaluate(() => (document.querySelector(".xupd") || {}).textContent || "")), "Update button while it gets ready");

  // installed by the updater: Restart to update
  status = Object.assign({}, status, { latest:NEXT, ready:true });
  await p.evaluate(() => X3.checkUpdate(false)); await p.waitForTimeout(500);
  check(/Restart to update/.test(await p.evaluate(() => document.querySelector(".xupd").textContent)), "Restart to update once it's installed");
  await p.evaluate(() => X3.updPanel()); await p.waitForTimeout(200);
  check(/is installed/.test(await p.textContent("#xupdp")) && /Restart now/.test(await p.textContent("#xupdp")), "panel offers Restart now");
  await p.screenshot({ path:SHOTS + "auto-restart.png", clip:{ x:700, y:0, width:580, height:330 } });
  await p.evaluate(() => { __sent.length = 0; [...document.querySelectorAll("#xupdp button")].find(b => b.textContent === "Restart now").click(); }); await p.waitForTimeout(500);
  reqs = await inbox();
  check(reqs.length === 1 && reqs[0].body.action === "update" && reqs[0].body.from === VERSION, "Restart now asks the updater: " + JSON.stringify(reqs));
  check(!(await sent(/^dl-retry|^open-file/)).length, "no download, nothing to open");
  await p.evaluate(() => __host("sync-done", "1", ""));

  // an error from the updater is shown
  status = Object.assign({}, status, { ready:false, error:"The download failed: offline", busy:false });
  await p.evaluate(() => { __sent.length = 0; X3.startUpdate(); }); await p.waitForTimeout(5500);
  check(/didn't install: The download failed/.test(await p.textContent("#toast")), "the updater's error is shown");
  await p.evaluate(() => __host("sync-done", "1", ""));

  // the install-by-itself switch reaches the updater
  await p.evaluate(() => { __sent.length = 0; const s = JSON.parse(localStorage.getItem("wsb.settings") || "{}"); s.xUpdates = false; localStorage.setItem("wsb.settings", JSON.stringify(s)); __host("settings-changed"); }); await p.waitForTimeout(300);
  reqs = await inbox();
  check(reqs.some(r => r.body.action === "auto-off"), "switch off reaches the updater");

  // Settings shows it
  const ps = await ctx.newPage(); watch(ps, errors, "settings");
  status = Object.assign({}, status, { ready:true, error:"" });
  await p.evaluate(() => X3.checkUpdate(false)); await p.waitForTimeout(500);
  await ps.goto("https://browser.example/settings.html#account"); await ps.waitForTimeout(700);
  check(/by themselves in the background/.test(await ps.textContent("#xuNote")) && (await ps.textContent("#xuGo")) === "Restart to update", "Settings shows automatic updates");
  check(/Install updates by itself/.test(await ps.evaluate(() => document.getElementById("xUpdates").closest(".set").textContent)), "Settings switch is about installing");

  // nothing published yet: a plain message, not "HTTP 404"
  manifest404 = true; status = null;
  await p.evaluate(() => { localStorage.removeItem("wsb.xUpd"); closeOver(); X3.checkUpdate(true); }); await p.waitForTimeout(500);
  check(/No update has been published yet/.test(await p.textContent("#toast")) && !/404/.test(await p.textContent("#toast")), "friendly message when nothing is published");

  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
