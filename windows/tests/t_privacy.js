// Privacy (Windows 3.10, iPhone 2.9; ../js/privacy.js): containers, cleaning up a site when its last tab closes,
// the fake shop warning, what sites see about you, and Face ID for the iPhone app's passcode.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const S = "\u0001";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  let updJson = null;
  await ctx.route("https://browser.example/user/webs-update.json*", r => updJson ? r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(updJson) }) : r.fulfill({ status:404, body:"" }));

  /* ---------------------------------------------------------------- the shared parts */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  check(await c.evaluate(() => [Privacy.regDomain("shop.example.co.uk"), Privacy.regDomain("www.Amazon.com"), Privacy.regDomain("a.b.example.com"), Privacy.regDomain("1.2.3.4"), Privacy.regDomain("localhost")].join()) === "example.co.uk,amazon.com,example.com,,",
    "the registered name of a site");
  check(await c.evaluate(() => { const s = Privacy.hostSigns("www.cheap-nike-outlet.shop"); return s.signs.map(x => x.k).join() === "brand,end,name" && Privacy.hostSigns("www.amazon.de").known && !Privacy.hostSigns("nike.com").signs.length && !Privacy.hostSigns("bbc.co.uk").signs.length; }),
    "the address alone: a brand in someone else's name, a cheap ending; big shops known");
  const verdicts = await c.evaluate(() => {
    const fake = { shop:true, deals:4, trust:[], payRisky:"bank transfer", urgency:"Only 3 left", freeMail:"help.store@gmail.com", https:true };
    const good = { shop:true, deals:0, trust:["contact", "returns", "privacy", "terms"], payOk:"paypal", https:true };
    return [Privacy.shopVerdict(fake, { days:12, created:"2026-09-23" }, "cheap-nike-outlet.shop"), Privacy.shopVerdict(good, { days:4000, created:"2015-08-01" }, "bobs-bikes.example"),
      Privacy.shopVerdict({ shop:true, deals:1, trust:["contact"] }, { days:200, created:"2026-03-01" }, "newshop.example"), Privacy.shopVerdict(fake, null, "amazon.com")];
  });
  check(verdicts[0].level === "warn" && verdicts[0].reasons.length >= 6 && /12 days ago/.test(verdicts[0].reasons.join()), "a new scam-looking shop: warn, with the reasons: " + verdicts[0].reasons.join(" / "));
  check(verdicts[1].level === "ok" && /2015/.test(verdicts[1].good.join()), "an old shop with contact pages and PayPal: fine");
  check(verdicts[2].level === "careful", "a young shop with few pages and one big discount: careful (" + verdicts[2].score + ")");
  check(verdicts[3].level === "ok" && verdicts[3].known, "a big shop everyone knows is never warned about");
  check(await c.evaluate(() => { const r = Privacy.parseRdap({ events:[{ eventAction:"registration", eventDate:"1997-09-15T04:00:00Z" }], entities:[{ roles:["registrar"], vcardArray:["vcard", [["fn", {}, "text", "MarkMonitor Inc."]]] }] });
    return r.created === "1997-09-15" && r.registrar === "MarkMonitor Inc." && Privacy.ageDays("2026-01-01") > 200; }), "reads the registry's answer");
  check(await c.evaluate(() => { const l = Privacy.seen({ page:{ ua:"UA", cores:4, mem:8, canvas:"abc", gpu:"ANGLE (Generic GPU)", dnt:false, gpc:true, battery:false, cookieN:3, thirdN:2, third:["ads.example", "cdn.example"] }, ip:{ ip:"203.0.113.9", city:"Lyon", country:"France", isp:"Orange" }, fp:true, vpn:false });
    const f = k => l.find(r => r.k === k); return f("Address (IP)").v === "203.0.113.9" && !f("Address (IP)").safe && f("Canvas drawing").safe && f("Global Privacy Control").safe && /ads\.example/.test(f("Other companies on the page").v) && f("Roughly where you are").v === "Lyon, France"; }),
    "the list of what sites see, with what Webs hides marked");

  /* ---------------------------------------------------------------- on a page: the shop signs, the warning bar, what it sees */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const ctx2 = await browser.newContext({ viewport:{ width:1100, height:700 } });
  await ctx2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await ctx2.addInitScript(shield);
  const FAKE = `<!doctype html><title>NIKE OUTLET</title><h1>Nike Air Max - CLEARANCE</h1>
    <div>Was $189.99 now $24.99 <b>-87%</b></div><div>Air Jordan 1 $29.99 -90%</div><div>Dunk Low $19.99 <span>-85%</span></div><div>Hoodie $9.99 -80%</div>
    <button>Add to cart</button><p>Only 3 left in stock! Hurry, sale ends in 00:14:59</p><p>We accept bank transfer and Bitcoin.</p><p>Questions? niketeam.outlet@gmail.com</p>`;
  const REAL = `<!doctype html><title>Bob's Bikes</title><h1>Trail bike</h1><p>$1,299.00</p><button>Add to basket</button><p>Pay with PayPal, Visa or Mastercard.</p>
    <footer><a href="/contact">Contact us</a> <a href="/returns">Returns & refunds</a> <a href="/privacy">Privacy</a> <a href="/terms">Terms</a> <a href="/about">About us</a></footer>`;
  const NEWS = `<!doctype html><title>News</title><article><h1>Rain tomorrow</h1><p>It will rain. Umbrellas cost about $10 in shops.</p></article><script src="https://ads.tracker.example/a.js"></script>`;
  await ctx2.route("https://cheap-nike-outlet.shop/**", r => r.fulfill({ status:200, contentType:"text/html", body:FAKE }));
  await ctx2.route("https://bobs-bikes.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:REAL }));
  await ctx2.route("https://news.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:NEWS }));
  await ctx2.route("https://ads.tracker.example/**", r => r.fulfill({ status:200, contentType:"text/javascript", body:"" }));
  const tool = async (p, name, arg) => {
    await p.evaluate(([n, a]) => { window.__sent.length = 0; window[Symbol.for("wsb.tool")](n, a || ""); }, [name, arg]);
    await wait(name === "x-seen" ? 400 : 50);
    return p.evaluate(() => { const m = window.__sent.find(x => /\u0001tool\u0001/.test(x)); return m ? JSON.parse(m.split("\u0001")[3]) : null; });
  };
  const p = await ctx2.newPage(); watch(p, errors, "page");
  await p.goto("https://cheap-nike-outlet.shop/"); await wait(200);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"cheap-nike-outlet.shop", f:0 }));
  let s = await tool(p, "x-shop");
  check(s && s.a === "x-shop" && s.shop && s.deals === 4 && s.trust.length === 0 && /bank transfer/.test(s.payRisky) && !s.payOk && /Only 3 left/.test(s.urgency) && /gmail/.test(s.freeMail), "a fake shop's page: " + JSON.stringify(s));
  const v = await c.evaluate(sig => Privacy.shopVerdict(sig, { days:9, created:"2026-09-26" }, "cheap-nike-outlet.shop"), s);
  await p.evaluate(v => window[Symbol.for("wsb.tool")]("x-shop-warn", JSON.stringify(v)), v); await wait(400);
  check(await p.evaluate(() => document.querySelectorAll("wsb-badge").length === 1), "the warning bar shows on the page");
  await p.screenshot({ path:SHOTS + "privacy-shop.png" });
  await p.mouse.click(550, 10); await wait(50);
  await p.goto("https://bobs-bikes.example/"); await wait(200);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"bobs-bikes.example", f:0 }));
  s = await tool(p, "x-shop");
  check(s && s.shop && s.deals === 0 && s.trust.length >= 4 && /paypal/.test(s.payOk) && !s.payRisky && !s.urgency && !s.freeMail, "a real shop's page: " + JSON.stringify(s));
  await p.goto("https://news.example/"); await wait(200);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"news.example", f:0 }));
  s = await tool(p, "x-shop");
  check(s && !s.shop, "a news page isn't a shop");
  const seen = await tool(p, "x-seen");
  check(seen && seen.ua && seen.canvas && seen.screen && typeof seen.cores === "number" && seen.perms && seen.third.indexOf("tracker.example") >= 0 && seen.fonts >= 0, "what the page sees: " + JSON.stringify(seen).slice(0, 300));

  /* ---------------------------------------------------------------- cleaning up a site when its last tab closes */
  await c.evaluate(() => { __host("viewport", 1280, 820);
    __host("tab-created", 1, 0, "https://shop.example/a", "", 0, 0); __host("tab-created", 2, 0, "https://news.example/", "", 0, 0); __host("tab-created", 3, 0, "https://www.shop.example/b", "", 0, 0);
    __host("tab-selected", 2); if (overlay) closeOver(); cfg.xClean = "pick"; cfg.xCleanSites = ["shop.example"]; __sent.length = 0; });
  await wait(200);
  await c.evaluate(() => closeTab(1)); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab" + "\u00011")) && !__sent.some(m => m.startsWith("site-clear"))), "another tab of the site is open: it just closes");
  await c.evaluate(() => { __host("tab-closed", 1); __sent.length = 0; closeTab(3); }); await wait(50);
  check(await c.evaluate(() => __sent.join("|") === "site-clear\u00013\u00010" && document.querySelector('.tab[data-id="3"]').classList.contains("pvgoing")), "its last tab: the site is cleared first: " + await c.evaluate(() => __sent.join("|")));
  await c.evaluate(() => __host("toast", "Cookies and data for shop.example cleared")); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab\u00013")) && /Cleaned up shop\.example/.test(document.getElementById("toast").textContent)), "then the tab closes, and Webs says so");
  await c.evaluate(() => { __host("tab-closed", 3); __host("tab-created", 4, 0, "https://other.example/", "", 0, 0); __sent.length = 0; closeTab(4); }); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab\u00014")) && !__sent.some(m => m.startsWith("site-clear"))), "a site you didn't pick isn't touched");
  await c.evaluate(() => { __host("tab-closed", 4); cfg.xClean = "all"; cfg.xKeepSites = ["keep.example"]; __host("tab-created", 5, 0, "https://keep.example/", "", 0, 0); __host("tab-created", 6, 0, "https://any.example/", "", 0, 0); __sent.length = 0; closeTab(5); closeTab(6); });
  await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab\u00015")) && __sent.some(m => m === "site-clear\u00016\u00010") && !__sent.some(m => m.startsWith("close-tab\u00016"))), "every site but the ones you keep");
  await c.evaluate(() => __host("toast", "Could not clear the site", "busy")); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab\u00016")) && /Couldn't clean up/.test(document.getElementById("toast").textContent)), "if it couldn't be cleared, the tab still closes and Webs says so");
  await c.evaluate(() => { __host("tab-closed", 5); __host("tab-closed", 6); cfg.xClean = ""; });

  /* ---------------------------------------------------------------- the shop check in the window */
  await c.evaluate(() => { __host("tab-created", 7, 0, "https://cheap-nike-outlet.shop/sale", "", 0, 0); __host("tab-selected", 7); __sent.length = 0; X3.privacy.shopCheck(T(7), false); });
  await wait(50);
  check(await c.evaluate(() => __sent.some(m => m === "page-tool\u00017\u0001x-shop\u0001")), "a page opens: its shop signs are asked for");
  await c.evaluate(sig => __host("tool-result", 7, JSON.stringify(sig)), Object.assign({}, await (async () => ({ a:"x-shop", shop:true, deals:4, trust:[], payRisky:"bank transfer", urgency:"Only 3 left", freeMail:"x@gmail.com", https:true }))()));
  await wait(100);
  const rdapUrl = await c.evaluate(() => (__sent.find(m => m.startsWith("feed-fetch\u0001")) || "").split("\u0001")[1]);
  check(rdapUrl === "https://rdap.org/domain/cheap-nike-outlet.shop", "without Web AI's server, the registry is asked through the host: " + rdapUrl);
  const created = new Date(Date.now() - 20 * 864e5).toISOString();
  await c.evaluate(([u, d]) => __host("feed", u, JSON.stringify({ events:[{ eventAction:"registration", eventDate:d }] }), ""), [rdapUrl, created]); await wait(150);
  const warnMsg = await c.evaluate(() => __sent.find(m => m.startsWith("page-tool\u00017\u0001x-shop-warn\u0001")));
  check(warnMsg && JSON.parse(warnMsg.split("\u0001")[3]).level === "warn" && /20 days ago/.test(warnMsg), "a scam-looking shop gets the warning bar");
  check(await c.evaluate(() => { const a = JSON.parse(localStorage.getItem("wsb.domAge") || "{}")["cheap-nike-outlet.shop"]; return a && a.created; }), "the website's age is kept for a week");
  await c.evaluate(() => { __sent.length = 0; X3.privacy.shopCheck(T(7), false); }); await wait(50);
  check(await c.evaluate(() => !__sent.some(m => /x-shop/.test(m))), "checked once a visit, not on every page");
  await c.evaluate(() => __host("tool-result", 7, JSON.stringify({ a:"x-shop-act", act:"trust" }))); await wait(50);
  check(await c.evaluate(() => cfg.xShopTrust.indexOf("cheap-nike-outlet.shop") >= 0), "“I trust this shop” is remembered");
  await c.evaluate(() => { __sent.length = 0; __host("tool-result", 7, JSON.stringify({ a:"x-shop-act", act:"leave" })); }); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("close-tab\u00017"))), "“Leave this site” closes it (no page to go back to)");
  await c.evaluate(() => { __host("tab-closed", 7); __host("tab-created", 8, 0, "https://www.amazon.com/dp/1", "", 0, 0); __sent.length = 0; X3.privacy.shopCheck(T(8), false); }); await wait(50);
  check(await c.evaluate(() => !__sent.some(m => /x-shop/.test(m))), "big shops aren't checked");

  /* ---------------------------------------------------------------- what sites see */
  await c.evaluate(() => { __host("tab-created", 9, 0, "https://news.example/today", "", 0, 0); __host("tab-selected", 9); __sent.length = 0; X3.privacy.seenPanel(); }); await wait(100);
  check(await c.evaluate(() => __sent.some(m => m === "page-tool\u00019\u0001x-seen\u0001")), "the page is asked what it sees");
  await c.evaluate(o => __host("tool-result", 9, JSON.stringify(o)), Object.assign({ a:"x-seen" }, seen)); await wait(300);
  const seenText = await c.evaluate(() => document.querySelector("#pvseen").textContent);
  check(/As news\.example sees you/.test(seenText) && /Canvas drawing/.test(seenText) && /tracker\.example/.test(seenText) && /Couldn't check it/.test(seenText) && /Turn on fingerprint protection/.test(seenText), "the panel lists it: " + seenText.slice(0, 200));
  await c.screenshot({ path:SHOTS + "privacy-seen.png" });
  await c.evaluate(() => [...document.querySelectorAll("#pvseen .btn2")].find(b => /fingerprint/.test(b.textContent)).click()); await wait(50);
  check(await c.evaluate(() => cfg.fp === true && JSON.parse(localStorage.getItem("wsb.settings")).fp === true), "turning on fingerprint protection from there");

  /* ---------------------------------------------------------------- containers */
  await c.evaluate(() => { __host("profile-info", "Default", "Container Shopping\nWork"); cfg.xBoxes = { "shop.example":"Shopping" }; __host("tab-created", 10, 0, "https://shop.example/cart", "", 0, 0); __host("tab-selected", 10); __host("tab-loading", 10, "0", "200"); });
  await wait(100);
  check(await c.evaluate(() => /lives in your Shopping container/.test(document.getElementById("toast").textContent)), "a site you put in a container: Webs offers to open it there");
  updJson = { auto:true, inbox:"C:\\Users\\me\\AppData\\Local\\Programs\\Webs Browser\\inbox", alive:Date.now() };
  await c.evaluate(() => { X3.privacy.reset(); __sent.length = 0; return X3.privacy.openInBox("Shopping", "https://shop.example/cart", 10); }); await wait(100);
  const sw = await c.evaluate(() => __sent.find(m => m.startsWith("sync-write\u0001")));
  const hand = sw ? JSON.parse(sw.split("\u0001")[2]) : {};
  check(sw && sw.split("\u0001")[1] === "C:\\Users\\me\\AppData\\Local\\Programs\\Webs Browser" && hand.app === "Webs container" && hand.to === "Container Shopping" && hand.u === "https://shop.example/cart", "the address goes across through the updater's folder");
  check(await c.evaluate(() => __sent.some(m => m === "profile-open\u0001Container Shopping") && __sent.some(m => m.startsWith("close-tab\u000110"))), "the container opens, and the tab here closes");
  await c.evaluate(() => __host("sync-done", "1", "Webs Browser sync - PC.json")); await wait(50);
  check(await c.evaluate(() => !(JSON.parse(localStorage.getItem("wsb.syncLast") || "null") || {}).ts), "the hand-off doesn't count as a folder sync");
  // the container's own window
  const b2 = await browser.newContext({ viewport:{ width:1100, height:700 } });
  await setup(b2);
  await b2.route("https://browser.example/user/webs-update.json*", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(updJson) }));
  const w = await b2.newPage(); watch(w, errors, "container");
  await w.goto("https://browser.example/chrome.html"); await wait(400);
  await w.evaluate(() => { __host("viewport", 1100, 700); __sent.length = 0; __host("profile-info", "Container Shopping", "Container Shopping"); }); await wait(200);
  check(await w.evaluate(() => __sent.some(m => m === "sync-read\u0001C:\\Users\\me\\AppData\\Local\\Programs\\Webs Browser")), "the container's window looks in the folder as it opens");
  await w.evaluate(t => { __sent.length = 0; __host("sync-data", "Webs Browser sync - PC.json", t); __host("sync-read-done"); }, JSON.stringify(hand)); await wait(100);
  check(await w.evaluate(() => __sent.filter(m => m.startsWith("new-tab\u0001https://shop.example/cart")).length === 1), "and opens the address sent to it");
  await w.evaluate(t => { __sent.length = 0; __host("sync-data", "Webs Browser sync - PC.json", t); }, JSON.stringify(hand)); await wait(50);
  check(await w.evaluate(() => !__sent.some(m => m.startsWith("new-tab"))), "only once");
  await w.evaluate(t => { __sent.length = 0; __host("sync-data", "Webs Browser sync - PC.json", t); }, JSON.stringify(Object.assign({}, hand, { id:"other", to:"Container Work" }))); await wait(50);
  check(await w.evaluate(() => !__sent.some(m => m.startsWith("new-tab"))), "an address meant for another container is left alone");
  await c.evaluate(() => { __host("tab-created", 11, 0, "https://news.example/", "", 0, 0); __host("tab-selected", 11); X3.privacy.boxPanel(); }); await wait(100);
  await c.fill("#pvbox .pvadd input", "Banking");
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#pvbox .pvadd button").click(); }); await wait(50);
  check(await c.evaluate(() => __sent.some(m => m === "profile-open\u0001Container Banking") && /Banking/.test(document.querySelector("#pvbox .pvlist").textContent)), "a new container");
  await c.evaluate(() => { const s = document.querySelector("#pvbox .pvsite select"); s.value = "Banking"; s.dispatchEvent(new Event("change")); }); await wait(50);
  check(await c.evaluate(() => cfg.xBoxes["news.example"] === "Banking"), "a site put in a container");
  await c.screenshot({ path:SHOTS + "privacy-boxes.png" });
  check(await c.evaluate(() => { closeOver(); const m = document.createElement("div"); X3.menuRows(m); return /Privacy tools…/.test(m.textContent) && commands().some(x => /What sites see about you/.test(x.t)); }), "Menu → Privacy tools…, and in the command list");
  await c.evaluate(() => { cfg.xClean = "pick"; sitePanel(); }); await wait(150);
  check(await c.evaluate(() => { const t = document.querySelector("#sitep .pvrows"); return t && /Clean up when closed/.test(t.textContent) && /Is this shop real/.test(t.textContent) && /Container/.test(t.textContent); }), "the site's panel: clean up when closed, its container, the checks");

  /* ---------------------------------------------------------------- Settings */
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html"); await wait(400);
  check(await st.evaluate(() => document.getElementById("xShop").classList.contains("on") && document.getElementById("xClean").options.length === 3), "Settings: the shop warning (on), cleaning up sites");

  /* ---------------------------------------------------------------- the iPhone app */
  const a = await ctx.newPage(); watch(a, errors, "app");
  await a.setViewportSize({ width:390, height:844 });
  await a.goto("https://app.example/index.html"); await wait(1500);
  await a.evaluate(() => PrivacyApp.seen()); await wait(800);
  const appSeen = await a.evaluate(() => document.getElementById("sheet").textContent);
  check(/What sites see about you/.test(appSeen) && /Browser/.test(appSeen) && /Canvas drawing/.test(appSeen), "iPhone: what sites see about you");
  await a.screenshot({ path:SHOTS + "privacy-app-seen.png" });
  await a.evaluate(() => closeSheet()); await wait(300);
  // Face ID: a pretend authenticator
  await a.evaluate(() => {
    window.__wa = { made:0, asked:0, fail:false };
    window.PublicKeyCredential = window.PublicKeyCredential || function () {};
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
    navigator.credentials.create = async o => { __wa.made++; __wa.opts = o; return { rawId:new Uint8Array([1, 2, 3, 4]).buffer, response:{} }; };
    navigator.credentials.get = async o => { __wa.asked++; __wa.got = o; if (__wa.fail) throw new DOMException("no", "NotAllowedError");
      const ad = new Uint8Array(37); ad[32] = 0x05;
      return { rawId:new Uint8Array([1, 2, 3, 4]).buffer, response:{ authenticatorData:ad.buffer, clientDataJSON:new TextEncoder().encode(JSON.stringify({ type:"webauthn.get", challenge:btoa(String.fromCharCode(...new Uint8Array(o.publicKey.challenge))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") })).buffer } }; };
  });
  await a.evaluate(async () => { save("mlock", { h:await pinHash("1234", "s"), s:"s", n:4, after:60 }); await PrivacyApp.faceOn(); });
  check(await a.evaluate(() => load("mlock").fid === "AQIDBA" && __wa.made === 1 && __wa.opts.publicKey.authenticatorSelection.userVerification === "required"), "iPhone: Face ID turned on for the passcode");
  await a.evaluate(() => { showLock(); }); await wait(300);
  check(await a.evaluate(() => !!document.querySelector("#lock .lkface")), "the lock screen has a Face ID button");
  await a.evaluate(() => document.querySelector("#lock .lkface").click()); await wait(700);
  check(await a.evaluate(() => !document.getElementById("lock") || document.getElementById("lock").classList.contains("open")), "Face ID unlocks Webs");
  check(await a.evaluate(() => __wa.got.publicKey.allowCredentials[0].type === "public-key" && __wa.got.publicKey.userVerification === "required"), "only the credential made for it, with Face ID required");
  await wait(500);
  await a.evaluate(() => { __wa.fail = true; showLock(); }); await wait(300);
  await a.evaluate(() => document.querySelector("#lock .lkface").click()); await wait(500);
  check(await a.evaluate(() => document.getElementById("lock") && !document.getElementById("lock").classList.contains("open") && /passcode/i.test(document.getElementById("lkM").textContent)), "Face ID failing: the passcode still works, and it says so");
  await a.screenshot({ path:SHOTS + "privacy-app-lock.png" });
  await a.evaluate(() => { for (const k of "1234") document.querySelector('#lock [data-k="' + k + '"]').click(); }); await wait(600);
  check(await a.evaluate(() => !document.getElementById("lock") || document.getElementById("lock").classList.contains("open")), "the passcode opens it");
  // the shop check from the address
  await a.evaluate(() => { localStorage.setItem("wsb.domAge", JSON.stringify({ "cheap-nike-outlet.shop":{ created:new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10), at:Date.now() } })); });
  const appShop = await a.evaluate(() => PrivacyApp.checkHost("cheap-nike-outlet.shop", true));
  check(appShop && appShop.level === "warn", "iPhone: a new shop with a brand in its name is warned about: " + JSON.stringify(appShop));
  check(await a.evaluate(() => /might be fake/.test(document.getElementById("toast").textContent) || /might be fake/.test(document.getElementById("sheet").textContent)), "and it says so");

  const real = errors.filter(e => !/An unknown error occurred when fetching the script/.test(e));
  console.log(real.length ? "errors:\n  " + real.join("\n  ") : "errors: none");
  check(!real.length, "no page errors: " + real.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
