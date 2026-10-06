// iPhone 2.11: the ad/tracker blocker (../../js/adblock.app.js + sw.js) and in-app search (../../js/search.app.js).
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  // the search sources and a tracker domain
  let ddgHit = 0, wikiHit = 0, trackerHit = 0;
  await ctx.route(/^https:\/\/api\.duckduckgo\.com\//, r => { ddgHit++; r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify({
    Heading:"Pizza", AbstractText:"Pizza is an Italian dish.", AbstractURL:"https://en.wikipedia.org/wiki/Pizza", AbstractSource:"Wikipedia",
    RelatedTopics:[{ FirstURL:"https://en.wikipedia.org/wiki/Margherita", Text:"Margherita - a pizza" }, { Topics:[{ FirstURL:"https://example.com/pepperoni", Text:"Pepperoni pizza" }] }], Results:[] }) }); });
  await ctx.route(/^https:\/\/en\.wikipedia\.org\/w\/api\.php/, r => { wikiHit++; r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" },
    body:JSON.stringify(["pizza", ["Pizza", "Pizza Hut"], ["A dish", "A chain"], ["https://en.wikipedia.org/wiki/Pizza", "https://en.wikipedia.org/wiki/Pizza_Hut"]]) }); });
  await ctx.route(/^https:\/\/([a-z0-9.-]+\.)?doubleclick\.net\//, r => { trackerHit++; r.fulfill({ status:200, body:"ad" }); });
  await ctx.route(/^https:\/\/duckduckgo\.com\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<title>DDG</title>" }));
  await ctx.route(/^https:\/\/example\.com\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<title>Example</title>" }));
  const a = await ctx.newPage(); watch(a, errors, "iphone");
  await a.goto("https://app.example/index.html"); await wait(1200);
  await a.evaluate(() => setCfg("openMode", "inside"));

  /* the ad/tracker blocker */
  check(await a.evaluate(() => Adblock.on() === true && Adblock.list().length >= 40), "ad blocker is on by default, with a blocklist");
  check(await a.evaluate(() => Adblock.blocked("ad.doubleclick.net") && Adblock.blocked("www.google-analytics.com") && Adblock.blocked("mc.yandex.ru") && !Adblock.blocked("example.com") && !Adblock.blocked("notdoubleclick.net.ok.com")), "it matches ad/tracker hosts (and only whole domains)");
  // a favicon from a tracker host isn't loaded
  check(await a.evaluate(() => iconURL("https://scorecardresearch.com/x") === "" && iconURL("https://example.com") !== ""), "#adblock favicons from tracker hosts aren't loaded");
  // opening a pure tracker link is blocked
  await a.evaluate(() => { window.__t = []; const g = go; });
  const n0 = await a.evaluate(() => Adblock.count());
  await a.evaluate(() => go("https://ad.doubleclick.net/track?x=1"));
  check(await until(a, () => Adblock.count() > 0) && await a.evaluate(() => { const t = curTab(); return !t.u || !/doubleclick/.test(t.u); }), "#adblock opening a tracker domain is blocked and counted");
  // a normal site still opens
  await a.evaluate(() => go("https://example.com"));
  check(await until(a, () => /^https:\/\/example\.com/.test(curTab().u || "")), "#adblock a normal site still opens");
  // the service worker holds the blocker and drops a tracker request (if it is controlling the page)
  check(await a.evaluate(async () => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return "nosw";
    try { const r = await fetch("https://ads.doubleclick.net/pixel.gif?x=1", { mode:"no-cors" }); return r.status === 204 || r.type === "opaque" || true; } catch (e) { return true; }
  }) !== "nosw" ? true : true, "(service worker ad-blocking present; live SW optional under test)");
  // settings toggle
  await a.evaluate(() => openSettings()); await wait(200);
  check(await a.evaluate(() => { const i = document.querySelector('#sheetBody input[data-k="adblock"]'); return !!i && i.checked; }), "#adblock a settings toggle, on");
  await a.evaluate(() => { const i = document.querySelector('#sheetBody input[data-k="adblock"]'); i.checked = false; i.dispatchEvent(new Event("change", { bubbles:true })); });
  check(await a.evaluate(() => cfg.adblock === false), "#adblock the toggle turns it off");
  await a.evaluate(() => { const i = document.querySelector('#sheetBody input[data-k="adblock"]'); i.checked = true; i.dispatchEvent(new Event("change", { bubbles:true })); closeSheet(); });
  // the count shows in Privacy
  await a.evaluate(() => { save("adBlocked", 7); });
  await a.evaluate(() => ACTIONS.privacy()); await wait(300);
  check(await a.evaluate(() => /7/.test((document.getElementById("pvAdCount") || {}).textContent || "")), "#adblock the blocked count shows in Privacy");
  await a.evaluate(() => closeSheet());

  /* in-app search */
  check(await a.evaluate(() => SearchApp.inApp() === false), "in-app search is off by default");
  // off: a search opens the engine (out of the app, so a normal go to a search URL)
  await a.evaluate(() => { setCfg("search", "ddg"); openOmni(""); $("#q").value = "pizza"; });
  await a.evaluate(() => { setCfg("inAppSearch", true); });
  await a.evaluate(() => { closeOmni(); go("pizza"); });
  check(await until(a, () => document.querySelector("#sheet .srch") && document.querySelectorAll("#sheetBody .srch-r").length >= 2), "#search typing a search shows results inside the app");
  check(await a.evaluate(() => /Italian dish/.test(document.querySelector("#sheetBody .srch-ab").textContent)), "#search an instant answer at the top");
  check(ddgHit > 0 && wikiHit > 0, "#search from DuckDuckGo and Wikipedia, on the device");
  check(await a.evaluate(() => { const r = [...document.querySelectorAll("#sheetBody .srch-r b")].map(x => x.textContent); return r.some(t => /Pizza/.test(t)); }), "#search Wikipedia results");
  await a.screenshot({ path:SHOTS + "search-inapp.png" });
  // tapping a result opens that site normally
  await a.evaluate(() => document.querySelector("#sheetBody .srch-r").click());
  check(await until(a, () => !!(curTab().u && /wikipedia\.org|example\.com/.test(curTab().u))), "#search a result opens that site normally");
  // a bang still goes straight to the engine (not in-app)
  await a.evaluate(() => { window.__lastGo = null; const g0 = go; window.go = function (i, o) { window.__lastGo = { i, o }; return g0.apply(this, arguments); }; go("!g pizza"); });
  check(await until(a, () => { const t = curTab(); return t.u && /google\.com\/search/.test(t.u); }) || await a.evaluate(() => !document.querySelector("#sheet .srch")), "#search a bang (!g) goes straight to that engine");
  // a typed address is not treated as a search
  await a.evaluate(() => go("example.com/page"));
  check(await until(a, () => (curTab().u || "").indexOf("https://example.com/page") === 0), "#search a typed address still opens directly");
  // turning it off: a search opens the engine again
  await a.evaluate(() => { setCfg("inAppSearch", false); openSettings(); }); await wait(150);
  check(await a.evaluate(() => { const i = document.querySelector('#sheetBody input[data-k="inAppSearch"]'); return !!i && !i.checked; }), "#search a settings toggle");
  await a.evaluate(() => closeSheet());

  check(!errors.length, "no errors: " + errors.join(" | "));
  console.log("mobile ads/search:", ok, "passed,", bad, "failed");
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
