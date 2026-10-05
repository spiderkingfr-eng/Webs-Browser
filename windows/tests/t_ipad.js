// The iPhone app 2.9: offline articles (../js/offline.app.js) and side by side on an iPad (../js/ipad.app.js).
const fs = require("fs"), path = require("path");
const { chromium, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const ARTICLE = "<p>" + "The quick brown fox jumps over the lazy dog again and again. ".repeat(20) + "</p>";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1180, height:820 } });
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  const reads = [];
  await ctx.route("https://w.test/**", r => {
    const u = new URL(r.request().url());
    if (u.pathname === "/read") { reads.push(u.searchParams.get("u")); const bad = /nothing/.test(u.searchParams.get("u"));
      return r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify(bad ? { ok:true, title:"Empty", site:"x", html:"<p>Hi</p>" } :
        { ok:true, u:u.searchParams.get("u"), title:"The Big Story", site:"Daily News", html:"<h2>Part one</h2>" + ARTICLE + '<script>alert(1)</script><p onclick="evil()">Clicky <a href="https://news.example/more">more</a></p>' }) }); }
    r.fulfill({ status:404, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:"{}" });
  });
  await ctx.route("https://en.wikipedia.org/api/rest_v1/page/html/**", r => r.fulfill({ status:200, contentType:"text/html", headers:{ "access-control-allow-origin":"*" },
    body:'<html><body><section><p>The <b>cat</b> is a small mammal.</p>' + ARTICLE + '</section><section><h2>References</h2><p>refs</p></section></body></html>' }));
  await ctx.route(/^https:\/\/(news|shop|blog)\.example\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>Page</title><h1>" + new URL(r.request().url()).hostname + "</h1>" }));
  await ctx.addInitScript(() => { try { if (location.hostname === "app.example" && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const a = await ctx.newPage(); watch(a, errors, "ipad");
  await a.goto("https://app.example/index.html"); await wait(1500);

  /* ---------------------------------------------------------------- side by side */
  await a.evaluate(() => { setCfg("openMode", "inside"); go("https://news.example/today"); go("https://shop.example/deals", { newTab:true }); });
  await wait(400);
  const ids = await a.evaluate(() => S().list.filter(t => t.u).map(t => t.id));
  check(ids.length === 2, "two pages open");
  await a.evaluate(() => openMenu()); await wait(200);
  check(await a.evaluate(() => /Side by side/.test($("#sheetBody").textContent)), "a wide screen: Menu → Side by side");
  await a.evaluate(() => { closeSheet(); IPad.pickSheet(); }); await wait(200);
  await a.evaluate(() => document.querySelector("#sheetBody [data-id]").click()); await wait(400);
  const geo = await a.evaluate(() => { const l = document.querySelector("#frames iframe.sl"), r = document.querySelector("#frames iframe.sr"); return l && r ? [l.getBoundingClientRect().width, r.getBoundingClientRect().width, getComputedStyle(r).display, getComputedStyle(l).display] : null; });
  check(geo && Math.abs(geo[0] - geo[1]) < 12 && geo[0] > 500 && geo[2] === "block" && geo[3] === "block", "two pages side by side, half each: " + JSON.stringify(geo));
  await a.screenshot({ path:SHOTS + "ipad-split.png" });
  const box = await a.evaluate(() => { const r = $("#splitBar").getBoundingClientRect(); return [r.left + r.width / 2, r.top + 30]; });
  await a.mouse.move(box[0], box[1]); await a.mouse.down(); await a.mouse.move(box[0] - 300, box[1], { steps:5 }); await a.mouse.up(); await wait(100);
  check(await a.evaluate(() => IPad.state().at < 0.3 && JSON.parse(localStorage.getItem("wsb.split")).at < 0.3), "drag the divider: the sides change size, and it's remembered");
  const before = await a.evaluate(() => curTab().id);
  await a.evaluate(() => document.querySelector('#splitBar [data-s="swap"]').click()); await wait(200);
  check(await a.evaluate(b => curTab().id !== b && IPad.state().other === b && document.body.classList.contains("split"), before), "⇄: the other side becomes the one you're in");
  await a.setViewportSize({ width:700, height:900 }); await wait(400);
  check(await a.evaluate(() => !document.body.classList.contains("split")), "a narrow screen: one page");
  await a.setViewportSize({ width:1180, height:820 }); await wait(400);
  check(await a.evaluate(() => document.body.classList.contains("split")), "room again: side by side comes back");
  await a.evaluate(() => document.querySelector('#splitBar [data-s="off"]').click()); await wait(200);
  check(await a.evaluate(() => !document.body.classList.contains("split") && !localStorage.getItem("wsb.split") || JSON.parse(localStorage.getItem("wsb.split")) === null), "✕: back to one page");

  /* ---------------------------------------------------------------- offline articles */
  await a.evaluate(() => go("https://news.example/2026/story")); await wait(300);
  await a.evaluate(() => { const t = curTab(); return OfflineApp.saveOffline(t.u, "The Big Story"); });
  check(await until(a, () => OfflineApp.list().length === 1 && /Saved for offline/.test(document.getElementById("toast").textContent)), "Save for offline: through the server");
  check(reads[0] === "https://news.example/2026/story", "the server is asked for the page");
  await a.evaluate(() => OfflineApp.readOffline(OfflineApp.list()[0].id)); await wait(300);
  const rd = await a.evaluate(() => ({ t:$("#sheetTitle").textContent, h:$("#rd").innerHTML }));
  check(rd.t === "The Big Story" && /Part one/.test(rd.h) && /quick brown fox/.test(rd.h) && !/script|onclick|alert/.test(rd.h), "read it: the words, cleaned of scripts and handlers");
  await a.screenshot({ path:SHOTS + "ipad-offline.png" });
  await a.evaluate(() => closeSheet());
  await a.evaluate(() => OfflineApp.saveOffline("https://en.wikipedia.org/wiki/Cat", "Cat - Wikipedia"));
  check(await until(a, () => OfflineApp.list().length === 2 && OfflineApp.list()[0].site === "Wikipedia"), "Wikipedia articles come from Wikipedia");
  check(reads.length === 1, "(not through the server)");
  await a.evaluate(() => OfflineApp.saveOffline("https://blog.example/nothing", "Nothing"));
  check(await until(a, () => /wasn't an article/.test(document.getElementById("toast").textContent)), "a page with no article isn't kept");
  // no internet: a saved page opens as its copy
  await ctx.setOffline(true); await wait(100);
  await a.evaluate(() => go("https://news.example/2026/story"));
  check(await until(a, () => $("#sheet").dataset.kind === "offread" && /You're offline/.test(document.getElementById("toast").textContent)), "offline: the saved copy opens instead");
  await ctx.setOffline(false);
  await a.evaluate(() => { closeSheet(); OfflineApp.offlineSheet(); }); await wait(200);
  check(await a.evaluate(() => document.querySelectorAll("#sheetBody .offrow").length === 2), "Menu → Offline articles lists them");
  await a.evaluate(() => document.querySelector("#sheetBody .offrow .offx").click()); await wait(200);
  check(await a.evaluate(() => OfflineApp.list().length === 1), "and deletes one");
  // the reading list, kept offline
  await a.evaluate(() => { save("reading", [{ u:"https://blog.example/post-1", t:"Post one", ts:Date.now(), done:false }]); setCfg("offReading", true); return OfflineApp.keepReading(); });
  check(await until(a, () => OfflineApp.list().some(x => x.u === "https://blog.example/post-1")), "Keep my reading list offline");

  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e));
  console.log(real.length ? "errors:\n  " + real.join("\n  ") : "errors: none");
  check(!real.length, "no page errors: " + real.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
