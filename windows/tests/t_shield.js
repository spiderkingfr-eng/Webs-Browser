// Runs the new x-… page tools inside an ordinary web page, with shield.js
// injected before the page's scripts the way the Windows host does it.
const fs = require("fs");
const path = require("path");
const { chromium, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Test page</title>
<style>body{font:16px Georgia,serif;color:#222;background:#fff;margin:40px}.low{color:#ccc}.spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(1turn)}}</style>
<body><main><article><h1>Hello world</h1><h3>Skipped level</h3>
<p>Reading is fun. The quick brown fox runs over a lazy dog every morning. Foxes like the morning sun and the river. A fox can run far.</p>
<p class="low">Low contrast words here for the check.</p><div class="spin">spinning</div>
<p>Mail <a href="mailto:hello@example.com">hello@example.com</a> or call +1 555 123 4567. Also sales@example.org.</p>
<p><a href="https://other.example/a">Other site</a> <a href="/local">Local page</a> <a href="https://other.example/file.pdf">A PDF</a></p>
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect width='300' height='200' fill='red'/%3E%3C/svg%3E" width="300" height="200">
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Crect width='120' height='90' fill='blue'/%3E%3C/svg%3E" alt="blue">
<table><tr><th>Name</th><th>Price</th></tr><tr><td>Apple</td><td>1,20</td></tr><tr><td>Pear "green"</td><td>2</td></tr></table>
<details><summary>More</summary>Hidden answer</details>
<form><input type="password" value="hunter2"><button></button></form>
<video width="320" height="180"></video>
${"<p>Filler paragraph about rivers and foxes to make the page long enough to scroll. </p>".repeat(60)}
</article></main></body></html>`;
(async () => {
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1200, height:800 } });
  await ctx.route("https://test.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:PAGE }));
  await ctx.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await ctx.addInitScript(shield);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.goto("https://test.example/page"); await p.waitForTimeout(300);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"test.example", f:0 }));
  const T = (a, arg) => p.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg == null ? "" : arg), [a, arg]);
  const replies = () => p.evaluate(() => __sent.filter(m => m.startsWith("wsb-page\u0001TK\u0001tool\u0001")).map(m => JSON.parse(m.split("\u0001")[3])));
  const panels = () => p.evaluate(() => document.querySelectorAll("wsb-badge").length);
  check(typeof await p.evaluate(() => typeof window[Symbol.for("wsb.tool")]) === "string", "tool entry point exists");
  for (const a of ["x-gallery", "x-links", "x-contacts", "x-passwords", "x-fonts", "x-colors", "x-a11y", "x-words", "x-video", "x-speed"]) {
    const before = await panels();
    await T(a); await p.waitForTimeout(150);
    check(await panels() > before, a + " opens its panel");
    await p.screenshot({ path:SHOTS + "x-" + a.slice(2) + ".png" });
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    await p.evaluate(() => document.querySelectorAll("wsb-badge").forEach(b => b.remove()));
  }
  check(await p.evaluate(() => document.querySelector("form input").type) === "text", "passwords shown");
  for (const a of ["x-ruler", "x-bionic", "x-spotlight", "x-bigtext", "x-hoverzoom", "x-grid", "x-snow", "x-noimg", "x-calm", "x-disco", "x-flip", "x-keys", "x-laser", "x-confetti"]) {
    await T(a); await p.waitForTimeout(120);
    await p.mouse.move(300, 300); await p.keyboard.press("a");
    await p.waitForTimeout(80);
    if (a !== "x-confetti") { await T(a); await p.waitForTimeout(80); }   // and off again
  }
  check(await p.evaluate(() => !document.documentElement.style.transform || document.documentElement.style.transform === "none"), "flip turned back");
  await T("x-bionic"); check(await p.evaluate(() => document.querySelectorAll("article b").length > 20), "bionic bolds words");
  await p.screenshot({ path:SHOTS + "x-bionic2.png" }); await T("x-bionic");
  check(await p.evaluate(() => document.querySelectorAll("article b").length) === 0, "bionic off restores the text");
  await T("x-expand"); check(await p.evaluate(() => document.querySelector("details").open), "folded sections opened");
  await T("x-marks", JSON.stringify(["fox", "river"]));
  check(await p.evaluate(() => document.querySelectorAll("mark").length) >= 5, "words highlighted");
  await T("x-marks", "[]"); check(await p.evaluate(() => document.querySelectorAll("mark").length) === 0, "highlights cleared");
  await T("x-replace", JSON.stringify({ f:"Hello", r:"Howdy", cs:1 }));
  check(await p.evaluate(() => document.querySelector("h1").textContent) === "Howdy world", "find and replace");
  await p.evaluate(() => { __sent.length = 0; });
  await T("x-md"); await T("x-csv"); await T("x-text");
  const r = await replies();
  const md = r.find(x => x.a === "x-md"), csv = r.find(x => x.a === "x-csv"), tx = r.find(x => x.a === "x-text");
  check(md && /^# Howdy world/m.test(md.md) && /\| Name \| Price \|/.test(md.md) && /\[Other site\]\(https:\/\/other\.example\/a\)/.test(md.md), "markdown reply: " + (md && md.md.slice(0, 120)));
  check(csv && csv.n === 1 && /"Pear ""green"""/.test(csv.csv) && /"1,20"/.test(csv.csv), "csv reply: " + (csv && csv.csv));
  check(tx && /Reading is fun/.test(tx.t), "text reply");
  await T("x-init", JSON.stringify({ progress:1, totop:1, accent:"#3366ff" }));
  await p.evaluate(() => scrollTo(0, 3000)); await p.waitForTimeout(300);
  await p.screenshot({ path:SHOTS + "x-init.png" });
  check(await p.evaluate(() => [...document.querySelectorAll("wsb-badge")].some(b => /width:\s*[1-9]/.test(b.style.cssText) && /3366ff|51, 102, 255/.test(b.style.cssText))), "progress bar follows scrolling");
  // a real Alt+Shift+R on the page is passed to the browser
  await p.evaluate(() => { __sent.length = 0; });
  await p.keyboard.press("Alt+Shift+KeyR"); await p.waitForTimeout(50);
  check((await replies()).some(x => x.a === "x-key" && x.k === "R"), "page shortcut relayed");
  // page scripts cannot fake the key
  await p.evaluate(() => { __sent.length = 0; dispatchEvent(new KeyboardEvent("keydown", { key:"R", code:"KeyR", altKey:true, shiftKey:true })); });
  check(!(await replies()).length, "synthetic key ignored");
  await T("x-gravity"); await p.waitForTimeout(1200);
  await p.screenshot({ path:SHOTS + "x-gravity.png" });
  await T("x-frame", "1");
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
