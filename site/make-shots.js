// Takes the website's sneak-peek pictures from the browser's real pages (run from the repository:
// `cd windows && python3 build.py && cd .. && node site/make-shots.js`). The Windows browser's window
// is put together from its parts: the toolbar (chrome.html), the page, and the sidebar.
const fs = require("fs"), path = require("path");
const { chromium, setup } = require("../windows/tests/harness");
const ROOT = path.join(__dirname, ".."), OUT = path.join(__dirname, "img");
fs.mkdirSync(OUT, { recursive:true });
const W = 1280, H = 800, SIDE = 380, RAIL = 44;
const APP = "https://spiderkingfr-eng.github.io/Webs-Browser/";

const ARTICLE = `<!doctype html><meta charset="utf-8"><title>Red foxes are thriving in our cities</title>
<style>body{margin:0;font:18px/1.65 Georgia,serif;color:#222;background:#fbfaf7}header{padding:14px 40px;border-bottom:1px solid #e6e1d8;font:600 15px system-ui;display:flex;gap:22px;color:#555}
header b{color:#b5312a;margin-right:auto;font-size:18px}main{max-width:720px;margin:0 auto;padding:34px 30px}h1{font-size:40px;line-height:1.15;margin:0 0 12px}.by{font:14px system-ui;color:#777;margin-bottom:22px}
.hero{height:250px;border-radius:14px;background:radial-gradient(circle at 70% 30%,#f3b26b,#c8572b 45%,#5a2a1c 80%);margin-bottom:24px;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;inset:auto -10% -30% -10%;height:60%;background:linear-gradient(#2c4a2b,#1b2e1b);border-radius:50% 50% 0 0}</style>
<header><b>The Daily Field</b><span>Nature</span><span>Cities</span><span>Science</span></header>
<main><h1>Red foxes are thriving in our cities</h1><div class="by">By Sam Rivers · 6 min read</div><div class="hero"></div>
<p>Once rare sights, red foxes now live in most big cities. Researchers counting them at night found that city foxes keep smaller territories than country foxes, because food is easier to find.</p>
<p>They eat what they can find: mice, berries, insects and the leftovers people throw away. Most are active at dusk and dawn, and they rarely cause trouble.</p></main>`;

async function shot(page, file, opts) { await page.screenshot(Object.assign({ path:path.join(OUT, file), type:"jpeg", quality:86 }, opts || {})); console.log("  " + file); }
async function compose(browser, file, w, h, layers) {
  const p = await browser.newPage({ viewport:{ width:w, height:h } });
  await p.setContent("<body style='margin:0;width:" + w + "px;height:" + h + "px;position:relative;overflow:hidden;background:#16131a'>" +
    layers.map(l => "<img src='data:image/png;base64," + l.png.toString("base64") + "' style='position:absolute;left:" + l.x + "px;top:" + l.y + "px'>").join("") + "</body>");
  await p.waitForTimeout(200);
  await shot(p, file); await p.close();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
  await setup(ctx);
  const DAY = new Date("2026-10-03T15:42:00");     // an afternoon, so the pages say "Good afternoon"
  await ctx.clock.setFixedTime(DAY);
  await ctx.route("https://news.example.com/**", r => r.fulfill({ status:200, contentType:"text/html", body:ARTICLE }));
  await ctx.route(/^https:\/\/(?!browser\.example|news\.example\.com)/, r => r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:"{}" }));
  await ctx.addInitScript(() => {
    if (location.hostname !== "browser.example" || sessionStorage.getItem("s")) return;
    sessionStorage.setItem("s", 1);
    localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", ntpShow:["xprog", "xfocus", "xmoon", "xwclock"], liveBg:"net", xClock:true }));
    localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:"https://web-ai.spiderkingfr.workers.dev" }));
    localStorage.setItem("wsb.xai", JSON.stringify({ auto:true, open:true, name:"", left:22, limit:25, noPage:false }));
    localStorage.setItem("wsb.current", JSON.stringify({ u:"https://news.example.com/foxes", t:"Red foxes are thriving in our cities" }));
    localStorage.setItem("wsb.xaiChat", JSON.stringify({ msgs:[
      { role:"user", text:"Summarize this page", content:"x", page:{ t:"Red foxes are thriving in our cities", u:"https://news.example.com/foxes" }, pageUrl:"https://news.example.com/foxes" },
      { role:"assistant", text:"**Red foxes are moving into cities, and doing well.**\n\n- City foxes keep **smaller territories** than country foxes, because food is easier to find.\n- They eat mice, berries, insects and leftovers.\n- They're most active at **dusk and dawn** and rarely cause trouble.\n\nIn short: cities have become a good home for them." },
      { role:"user", text:"Are they dangerous to pets?", content:"Are they dangerous to pets?" },
      { role:"assistant", text:"Rarely. Foxes avoid cats and dogs and run off when they see people. Keep small pets like rabbits in a secure hutch at night, and don't leave food out." }] }));
    // the voice call shows "listening" with a microphone that's always waiting
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} abort() {} };
  });

  // the browser window: toolbar with three tabs
  const c = await ctx.newPage();
  await c.goto("https://browser.example/chrome.html"); await c.waitForTimeout(300);
  await c.evaluate(() => {
    __host("viewport", 1280, 800);
    __host("tab-created", 1, 0, "https://browser.example/newtab.html", "", 0, 0);
    __host("tab-created", 2, 0, "https://news.example.com/foxes", "", 0, 0); __host("tab-title", 2, "Red foxes are thriving in our cities");
    __host("tab-created", 3, 0, "https://www.youtube.com/", "", 0, 0); __host("tab-title", 3, "YouTube");
    __host("tab-created", 4, 0, "https://browser.example/games.html", "", 0, 0); __host("tab-title", 4, "Games");
    for (const id of [1, 2, 3, 4]) __host("tab-loading", id, "0", "ok");
    __host("tab-selected", 1);
  });
  await c.waitForTimeout(2200);
  await c.evaluate(() => { if (overlay) closeOver(); });
  const top = await c.evaluate(() => Math.ceil(document.querySelector("#chrome").getBoundingClientRect().height));
  // pop-up notes (achievements and the like) are left out, except where a shot says to keep them
  const chrome = async keepToast => { if (!keepToast) await c.evaluate(() => { const t = document.getElementById("toast"); if (t) t.remove(); }); return await c.screenshot({ clip:{ x:0, y:0, width:W, height:H } }); };
  const page = async (url, w, h, ready) => {
    const p = await ctx.newPage({ viewport:{ width:w, height:h } });
    await p.setViewportSize({ width:w, height:h });
    await p.goto(url); await p.waitForTimeout(1600);
    if (ready) await ready(p);
    const png = await p.screenshot(); await p.close(); return png;
  };
  console.log("Windows (toolbar is " + top + "px):");

  // 1. the new tab page
  await compose(browser, "win-home.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://browser.example/newtab.html", W, H - top, async p => { await p.evaluate(() => { const t = document.getElementById("tip"); if (t) t.remove(); }); }), x:0, y:top }]);

  // 2. Web AI in the sidebar, next to a page, on a voice call
  await c.evaluate(() => { __host("tab-selected", 2); openSide("xai"); }); await c.waitForTimeout(400);
  const side = await page("https://browser.example/side.html?w=x#xai", SIDE, H - top, async p => { await p.evaluate(() => XAI.call.start()); await p.waitForTimeout(300); });
  await compose(browser, "win-webai.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://news.example.com/foxes", W - SIDE - RAIL, H - top), x:0, y:top }, { png:side, x:W - SIDE - RAIL, y:top }]);

  // 3. the page tools panel over a page
  await c.evaluate(() => { closeSide(); X3.toolsPanel(); }); await c.waitForTimeout(700);
  const panel = await c.$("#xtp"), box = await panel.boundingBox();
  await compose(browser, "win-tools.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://news.example.com/foxes", W, H - top), x:0, y:top }, { png:await panel.screenshot(), x:Math.round(box.x), y:Math.round(box.y) }]);
  await c.evaluate(() => closeOver());

  // 3b. Shield, the ad blocker, on the same page
  await c.evaluate(() => {
    __host("tab-selected", 2); __host("tab-blocked", 2, 38, 3);
    __host("shield-status", JSON.stringify({ net:186420, cos:24318 }));
    stats.blocked = 12873; stats.popups = 214; stats.since = Date.now() - 21 * 864e5;
    shieldPanel();
  }); await c.waitForTimeout(700);
  const sp = await c.$("#shieldp"), sbox = await sp.boundingBox();
  await compose(browser, "win-shield.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://news.example.com/foxes", W, H - top), x:0, y:top }, { png:await sp.screenshot(), x:Math.round(sbox.x), y:Math.round(sbox.y) }]);
  await c.evaluate(() => closeOver());

  // 3c. the VPN, on through Tor (a documentation address, not a real one)
  await c.evaluate(() => {
    vcfg.mode = "tor"; vcfg.country = "ca"; vcfg.kill = true; vcfg.dns = true;
    __host("vpn-status", JSON.stringify({ state:"on", mode:"tor", country:"ca", ip:"203.0.113.84", since:Date.now() - 754e3, down:48.3e6 }));
    vpnPanel();
  }); await c.waitForTimeout(700);
  const vp = await c.$("#vpnp"), vbox = await vp.boundingBox();
  await compose(browser, "win-vpn.jpg", W, H, [{ png:await chrome(true), x:0, y:0 }, { png:await page("https://news.example.com/foxes", W, H - top), x:0, y:top }, { png:await vp.screenshot(), x:Math.round(vbox.x), y:Math.round(vbox.y) }]);
  await c.evaluate(() => { closeOver(); __host("vpn-status", JSON.stringify({ state:"off", mode:"off" })); });

  // 4. games, and 5. settings (appearance)
  await c.evaluate(() => __host("tab-selected", 4)); await c.waitForTimeout(300);
  await compose(browser, "win-games.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://browser.example/games.html", W, H - top), x:0, y:top }]);
  await c.evaluate(() => { __host("tab-created", 5, 0, "https://browser.example/settings.html#look", "", 0, 0); __host("tab-title", 5, "Settings"); __host("tab-loading", 5, "0", "ok"); __host("tab-selected", 5); }); await c.waitForTimeout(300);
  await compose(browser, "win-settings.jpg", W, H, [{ png:await chrome(), x:0, y:0 }, { png:await page("https://browser.example/settings.html#look", W, H - top, async p => { await p.evaluate(() => { const h = document.getElementById("look"), bar = document.querySelector("header,.top,nav"); if (h) window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 170); }); await p.waitForTimeout(300); }), x:0, y:top }]);

  // the iPhone app
  console.log("iPhone:");
  const ictx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  await ictx.clock.setFixedTime(DAY);
  await ictx.route(APP + "**", r => {
    const n = new URL(r.request().url()).pathname.replace("/Webs-Browser/", "") || "index.html", f = path.join(ROOT, n);
    if (n === "sw.js" || !fs.existsSync(f)) return r.fulfill({ status:404, body:"" });
    const T = { html:"text/html", js:"text/javascript", css:"text/css", json:"application/json", svg:"image/svg+xml", png:"image/png", webmanifest:"application/manifest+json" };
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:T[n.split(".").pop()] || "application/octet-stream" });
  });
  await ictx.route(/^https:\/\/(?!spiderkingfr-eng\.github\.io)/, r => {
    const u = r.request().url(), A = "https://web-ai.spiderkingfr.workers.dev/";
    const body = u === A ? { ok:true, ready:true, open:true } : u.startsWith(A + "check") ? { ok:true, left:22, limit:25 } : {};
    r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify(body) });
  });
  await ictx.addInitScript(() => {
    for (const k of ["seenSplash", "onboarded", "toured", "welcomed"]) localStorage.setItem("wsb." + k, "1");
    localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", wallpaper:"aurora" }));
    localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:"https://web-ai.spiderkingfr.workers.dev", code:"jcku563mgxwn" }));
    localStorage.setItem("wsb.xai", JSON.stringify({ auto:true, open:true, left:22, limit:25 }));
    localStorage.setItem("wsb.xaiChat", JSON.stringify({ msgs:[
      { role:"user", text:"What's a good name for a pet fox?", content:"What's a good name for a pet fox?" },
      { role:"assistant", text:"Some favourites:\n\n- **Ember**, for that red coat\n- **Rusty**\n- **Maple**\n- **Kit** (that's what baby foxes are called!)\n\nWant names that go with a theme, like space or food?" }] }));
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} abort() {} };
  });
  const ph = await ictx.newPage();
  await ph.goto(APP + "index.html"); await ph.waitForTimeout(2500);
  const clean = () => ph.evaluate(() => { document.querySelectorAll(".splash,#splash,#onboard,#toast").forEach(x => { x.classList.remove("on"); if (x.id !== "toast") x.remove(); }); });
  await clean(); await ph.waitForTimeout(300);
  await shot(ph, "iphone-home.jpg");
  await ph.evaluate(() => openMenu()); await ph.waitForTimeout(700); await clean();
  await shot(ph, "iphone-menu.jpg");
  await ph.evaluate(() => { closeSheet(); }); await ph.waitForTimeout(500);
  await ph.evaluate(() => WebAI.open()); await ph.waitForTimeout(800);
  await ph.click("#sheetBody .aicall"); await ph.waitForTimeout(400); await clean();
  await shot(ph, "iphone-webai.jpg");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
