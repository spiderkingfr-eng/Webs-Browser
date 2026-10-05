// The iPhone app: runs every menu action (with and without a page open), every Settings switch, segment and button, and fails on any script error.
const fs = require("fs"), path = require("path");
const { chromium, watch, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const RISKY = /delete|clear|reset|remove|erase|wipe|sign out|forget|unlink|leave|uninstall|install/i;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:+(process.env.W || 375), height:667 }, isMobile:true, hasTouch:true });
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await ctx.route(/^https:\/\/(news|shop)\.example\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>Page</title><h1>Hello</h1><p>Words.</p>" }));
  await ctx.route(/^https:\/\/(?!app\.example|news\.example|shop\.example)/, r => r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:"{}" }));
  const X = '"><img src=x onerror="window.__pwn=(window.__pwn||[]).concat(1)"><b x="';
  await ctx.addInitScript(X => {
    if (location.hostname !== "app.example" || sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const now = Date.now(), u = "https://news.example/?q=" + encodeURIComponent(X), put = (k, v) => localStorage.setItem("wsb." + k, JSON.stringify(v));
    put("bookmarks", [{ u, t:X, ts:now }]); put("history", [{ u, t:X, ts:now, n:2 }]); put("reading", [{ u, t:X, ts:now, done:false }]);
    put("notes", [{ id:1, t:X, title:X, text:X, ts:now }]); put("todo", [{ t:X, ts:now }]); put("closed", [{ u, t:X, ts:now }]);
    put("speed", [{ u, t:X }]); put("shortcuts", [{ u, t:X }]); put("offline", [{ u, t:X, site:X, html:"<p>hi</p>", ts:now }]);
  }, X);
  const a = await ctx.newPage(); watch(a, errors, "app");
  a.on("dialog", d => d.dismiss().catch(() => {}));
  await a.goto("https://app.example/index.html"); await wait(1500);
  const deeper = () => a.evaluate(async RISKY => {
    const root = document.querySelector("#sheet"); if (!root || root.classList.contains("hide")) return 0;
    const bs = [...root.querySelectorAll("button, [data-set], [data-sw], input[type=checkbox]")].filter(b => !new RegExp(RISKY, "i").test(b.textContent + " " + (b.title || "") + " " + (b.dataset.set || "") + " " + (b.dataset.act || "")));
    let n = 0;
    for (const b of bs.slice(0, 25)) { if (!b.isConnected || b.closest("#sheet") !== root) continue; if (b.matches("[data-act]") && root.dataset.kind === "menu") continue; try { b.click(); n++; } catch (e) {} await new Promise(f => setTimeout(f, 10)); }
    return n;
  }, RISKY.source);
  const tidy = () => a.evaluate(() => { try { closeSheet(); } catch (e) {} try { if (typeof closeOmni === "function") closeOmni(); } catch (e) {} });
  const keys = await a.evaluate(() => Object.keys(ACTIONS)); const widths = [];
  console.log("actions:", keys.length);
  for (const pass of ["home", "page"]) {
    if (pass === "page") { await a.evaluate(() => { setCfg("openMode", "inside"); go("https://news.example/today"); }); await wait(500); await a.evaluate(X => { const t = curTab(); t.t = X; }, X); }
    for (const k of keys) {
      if (RISKY.test(k)) continue;
      const before = errors.length;
      const r = await a.evaluate(async k => { try { if (typeof openMenu === "function") openMenu(); const v = ACTIONS[k](); if (v && v.then) await Promise.race([v, new Promise(f => setTimeout(f, 400))]); return ""; } catch (e) { return "THROW " + e.message; } }, k);
      if (r) errors.push(pass + " action " + k + ": " + r);
      await wait(80);
      const wide = await a.evaluate(() => { const W = innerWidth, out = [];
        document.querySelectorAll("#sheet *, body > *").forEach(e => { if (!e.offsetParent && e.tagName !== "BODY") return; const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > W + 2 && getComputedStyle(e).position !== "fixed" && !e.closest("[style*='overflow'], .hscroll, .qa, .chips, .seg, .tabs, .scroll, .strip, .row")) out.push((e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + [...e.classList].join(".")) + " " + Math.round(r.right - W) + "px"); });
        return document.scrollingElement.scrollWidth > W + 2 ? ["page scrolls sideways: " + document.scrollingElement.scrollWidth].concat(out.slice(0, 4)) : out.slice(0, 4); });
      if (wide.length) { console.log("  too wide after", pass, k, wide.join(", ")); widths.push(k + ": " + wide[0]); }
      await deeper(); await wait(60);
      if (await a.evaluate(() => { const x = window.__pwn; window.__pwn = 0; return x; })) { console.log("  INJECTED", pass, k); errors.push("injection: " + k); }
      if (errors.length > before) console.log("  " + pass + " action", k, "->", errors.slice(before).join(" | "));
      await tidy(); await wait(30);
      if (pass === "page") await a.evaluate(() => { if (!S().list.some(t => t.u)) go("https://news.example/today"); });
    }
  }
  // settings: every switch, segment and button
  const before = errors.length;
  for (const page of ["", "customize"]) {
    await a.evaluate(p => openSettings(p), page); await wait(300);
    const n = await a.evaluate(async ([RISKY, setPage0]) => {
      let n = 0; const re = new RegExp(RISKY, "i");
      const all = () => [...document.querySelectorAll("#sheet [data-sw], #sheet .sw, #sheet [data-seg] button, #sheet [data-seg] [data-v], #sheet [data-set], #sheet input[type=checkbox]")];
      const seen = new Set();
      for (let i = 0; i < 400; i++) {
        const b = all().find(b => { const key = (b.dataset.k || b.dataset.set || b.dataset.v || "") + "|" + b.textContent.slice(0, 30); return !seen.has(key) && !re.test(b.textContent + " " + (b.dataset.set || "")); });
        if (!b) break;
        seen.add((b.dataset.k || b.dataset.set || b.dataset.v || "") + "|" + b.textContent.slice(0, 30));
        if (!b.isConnected) continue;
        try { b.click(); n++; } catch (e) {} await new Promise(f => setTimeout(f, 15));
        if (document.querySelector("#sheet").dataset.kind !== "settings" || document.querySelector("#sheet").classList.contains("hide")) { try { closeSheet(); } catch (e) {} openSettings(setPage0); await new Promise(f => setTimeout(f, 60)); }
      }
      return n;
    }, [RISKY.source, page]);
    console.log("settings", page || "main", "pressed:", n);
    await tidy();
  }
  if (errors.length > before) console.log("  settings ->", errors.slice(before).join(" | "));
  await wait(800);
  // the address bar suggests saved items
  for (const q of ["n", "news", "img", "x"]) { await a.evaluate(q => { const i = document.querySelector("#omniIn, #omni input, input[type=search], #q"); if (i) { i.focus(); i.value = q; i.dispatchEvent(new Event("input", { bubbles:true })); } }, q); await wait(250); }
  check(!(await a.evaluate(() => window.__pwn)), "no saved title ever runs as code in the app");
  check(!widths.length, "nothing wider than the screen:\n    " + widths.join("\n    "));
  check(!errors.length, "no script errors in the app:\n    " + errors.join("\n    "));
  console.log(`crawl app: ${ok} passed, ${bad} failed`);
  await browser.close(); process.exit(bad ? 1 : 0);
})();
