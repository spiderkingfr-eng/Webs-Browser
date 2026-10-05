// Clicks everything: every palette command, main-menu row and tab-menu item in the window, every settings switch, and fails on any script error.
const { chromium, setup, watch } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  const p = await ctx.newPage(); watch(p, errors, "chrome");
  p.on("dialog", d => d.dismiss().catch(() => {}));
  // every title, bookmark, history entry, download and note carries a script that must never run
  const X = '"><img src=x onerror="window.__pwn=(window.__pwn||[]).concat(1)"><b x="';
  await ctx.addInitScript(X => {
    const now = Date.now(), u = "https://evil.example/?q=" + encodeURIComponent(X);
    const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
    if (location.hostname !== "browser.example" || sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    put("history", [{ u, t:X, ts:now, n:3 }, { u:"https://evil.example/" + X, t:X, ts:now - 5000, n:1 }]);
    put("bookmarks", [{ u, t:X, ts:now, folder:X }]);
    put("closed", [{ u, t:X, ts:now }]);
    put("downloads", [{ id:1, name:X, path:"C:\\" + X, url:u, size:5, state:"done", ts:now }]);
    put("sessions", [{ name:X, ts:now, tabs:[{ u, t:X }] }]);
    put("watch", [{ u, t:X, ts:now }]);
    put("panels", [{ u, t:X }]);
    put("groups", { [X]:{ c:"red", n:X } });
    put("reading", [{ u, t:X, ts:now, done:false }]);
    put("notes", [{ id:1, title:X, text:X, html:X, ts:now }]);
    put("todo", [{ t:X, ts:now }]);
  }, X);
  await p.goto("https://browser.example/chrome.html");
  await p.waitForTimeout(400);
  const fresh = () => p.evaluate(() => {
    try { closeOver(); } catch (e) {}
    document.querySelectorAll(".xpane").forEach(x => x.remove());
  });
  await p.evaluate(() => {
    __host("viewport", 1280, 800);
    __host("tab-created", 1, 0, "https://example.com/a", "", 0, 0);
    __host("tab-title", 1, "Example A");
    __host("tab-created", 2, 0, "https://news.example.org/page", "", 0, 0);
    __host("tab-selected", 2);
  });
  await p.evaluate(X => { __host("tab-title", 2, X); __host("tab-title", 1, X); __host("tab-url", 1, "https://evil.example/" + encodeURIComponent(X)); }, X);
  await p.waitForTimeout(300);
  // palette commands
  const n = process.env.QUICK ? 0 : await p.evaluate(() => commands().length);
  console.log("commands:", n);
  for (let i = 0; i < n; i++) {
    const before = errors.length;
    const label = await p.evaluate(async i => {
      const c = commands()[i]; if (!c) return "(gone)";
      if (/close (this )?window|quit|exit|sign out|restart|update now|clear (all )?(browsing )?data|reset/i.test(c.t)) return "skip " + c.t;
      try { const r = c.fn(); if (r && r.then) await Promise.race([r, new Promise(f => setTimeout(f, 300))]); } catch (e) { return "THROW " + c.t + ": " + e.message; }
      return c.t;
    }, i);
    await p.waitForTimeout(60);
    if (/^THROW/.test(label)) errors.push(label);
    // one level deeper: press every safe button and switch in whatever the command opened
    if (!/^skip|^THROW/.test(label)) await p.evaluate(async () => {
      const box = [...document.querySelectorAll("#over, .xpane")].filter(x => x.isConnected && x.offsetParent !== null);
      const bs = box.flatMap(b => [...b.querySelectorAll("button, .mi, input[type=checkbox], .chip")]).filter(b => !/delete|clear|reset|remove|erase|wipe|sign out|forget|unlink|close window|quit/i.test(b.textContent + " " + (b.title || "")));
      window.__clicked = (window.__clicked || 0) + Math.min(bs.length, 30); for (const b of bs.slice(0, 30)) { try { if (b.isConnected) b.click(); } catch (e) {} await new Promise(f => setTimeout(f, 8)); }
    });
    await p.waitForTimeout(40);
    if (await p.evaluate(() => { const x = window.__pwn; window.__pwn = 0; return x; })) { console.log("  INJECTED after command", i, label); errors.push("injection: " + label); }
    if (errors.length > before) console.log("  after command", i, label, "->", errors.slice(before).join(" | "));
    await fresh();
    await p.evaluate(() => { if (!tabs.length) { __host("tab-created", 9, 0, "https://example.com/z", "", 0, 0); __host("tab-selected", 9); } });
  }
  console.log("panel clicks:", await p.evaluate(() => window.__clicked));
  // the address bar suggests saved items (and the palette lists them)
  for (const q of ["e", "evil", "img", "@hist", "@book", "@tabs", "> ", "!", "=1+1", "?", "#"]) {
    await p.evaluate(q => { $("#url").focus(); $("#url").value = q; $("#url").dispatchEvent(new Event("input")); }, q);
    await p.waitForTimeout(250);
    await p.evaluate(() => { $("#url").blur(); });
  }
  for (const m of ["", "tabs", "history", "bookmarks", "commands"]) { await p.evaluate(m => { try { palette(m); } catch (e) {} }, m); await p.waitForTimeout(150);
    await p.evaluate(() => { const i = document.querySelector("#over input"); if (i) { i.value = "e"; i.dispatchEvent(new Event("input")); } }); await p.waitForTimeout(150); await fresh(); }
  check(await p.evaluate(() => document.body.innerHTML.length > 0) && !(await p.evaluate(() => window.__pwn)), "suggestions show saved titles as text");
  // main menu rows
  await p.evaluate(() => mainMenu()); await p.waitForTimeout(100);
  const rows = await p.evaluate(() => [...document.querySelectorAll(".mi, .mrow button")].length);
  console.log("menu rows:", rows);
  for (let i = 0; i < rows; i++) {
    const before = errors.length;
    await fresh(); await p.evaluate(() => mainMenu()); await p.waitForTimeout(40);
    const t = await p.evaluate(i => { const r = [...document.querySelectorAll(".mi, .mrow button")][i]; if (!r) return "(none)"; const t = r.textContent; if (/quit|exit|close window/i.test(t)) return "skip " + t; r.click(); return t; }, i);
    await p.waitForTimeout(60);
    if (await p.evaluate(() => { const x = window.__pwn; window.__pwn = 0; return x; })) { console.log("  INJECTED after menu", t); errors.push("injection: menu " + t); }
    if (errors.length > before) console.log("  after menu", t, "->", errors.slice(before).join(" | "));
  }
  // tab menu items
  await fresh();
  const tn = await p.evaluate(() => { tabMenu({ clientX:100, clientY:10 }, tabs[0].id); return document.querySelectorAll("#ctx .mi").length; });
  console.log("tab menu items:", tn);
  for (let i = 0; i < tn; i++) {
    const before = errors.length;
    await fresh();
    await p.evaluate(() => { if (tabs.length < 2) { __host("tab-created", 20 + tabs.length, 0, "https://example.com/q", "", 0, 0); } });
    const t = await p.evaluate(i => { tabMenu({ clientX:100, clientY:10 }, tabs[0].id); const r = document.querySelectorAll("#ctx .mi")[i]; if (!r) return "(none)"; const t = r.textContent; r.click(); return t; }, i);
    await p.waitForTimeout(60);
    if (await p.evaluate(() => { const x = window.__pwn; window.__pwn = 0; return x; })) { console.log("  INJECTED after tab menu", t); errors.push("injection: tab menu " + t); }
    if (errors.length > before) console.log("  after tab menu", t, "->", errors.slice(before).join(" | "));
  }
  // keyboard shortcuts with every modifier combination on letters/digits
  await fresh();
  for (const k of [...Array(26)].map((_, i) => 65 + i).concat([48,49,50,57,112,113,114,115,116,117,118,119,120,121,122,123,186,187,188,189,190,191,192,219,220,221,222])) {
    for (const [c, s, a] of [[1,0,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1]]) {
      const before = errors.length;
      const t = await p.evaluate(([k, c, s, a]) => { try { shortcut(k, !!c, !!s, !!a); } catch (e) { return "THROW " + e.message; } return ""; }, [k, c, s, a]);
      if (t) errors.push("shortcut " + k + " " + c + s + a + ": " + t);
      await p.waitForTimeout(10);
      if (errors.length > before) console.log("  after shortcut", k, c, s, a, "->", errors.slice(before).join(" | "));
      await fresh();
      await p.evaluate(() => { if (!tabs.length) { __host("tab-created", 30, 0, "https://example.com/z", "", 0, 0); __host("tab-selected", 30); } });
    }
  }
  // host messages with missing tabs, empty and odd arguments
  const MSGS = ["ambient","backup-done","cleared","content-focus","download","feed","find-result","fresh","fullscreen","key","media-list","media-state","next","open-search","other-browsers","pause","perm-list","perm-reset","picked","play","prev","profile-info","radio","reader-content","resolve-go","restore","settings-changed","shield-log","shield-status","shot-edit","site-info","split-state","sync-data","sync-done","sync-read-done","tab-audio","tab-blocked","tab-hung","tab-icon","tab-loading","tab-popup","tab-sleep","tab-thumb","tab-title","tab-url","tab-zoom","toast","toggle","tool-result","viewport","vpn-status","watch","watch-poster","watch-thumb","tab-selected","tab-closed"];
  for (const m of MSGS) for (const args of [[], [999], [999, "", ""], ["", "x", "{}"], [2, "[]", "null", "0"], [2, "{bad json", "", ""]]) {
    const before = errors.length;
    await p.evaluate(([m, args]) => __host(m, ...args), [m, args]);
    await p.waitForTimeout(15);
    if (errors.length > before) console.log("  after host", m, JSON.stringify(args), "->", errors.slice(before).join(" | "));
    await fresh();
    await p.evaluate(() => { if (!tabs.some(t => t.id === 2)) { __host("tab-created", 2, 0, "https://news.example.org/page", "", 0, 0); __host("tab-selected", 2); } });
  }
  await p.waitForTimeout(500);
  // every command again with no tabs at all
  await p.evaluate(() => { for (const t of [...tabs]) __host("tab-closed", t.id); });
  await p.waitForTimeout(100);
  for (let i = 0; i < n; i++) {
    const before = errors.length;
    const label = await p.evaluate(async i => {
      for (const t of [...tabs]) __host("tab-closed", t.id);
      const c = commands()[i]; if (!c) return "(gone)";
      if (/close (this )?window|quit|exit|sign out|restart|update now|clear (all )?(browsing )?data|reset/i.test(c.t)) return "skip " + c.t;
      try { const r = c.fn(); if (r && r.then) await Promise.race([r, new Promise(f => setTimeout(f, 300))]); } catch (e) { return "THROW " + c.t + ": " + e.message; }
      return c.t;
    }, i);
    await p.waitForTimeout(40);
    if (/^THROW/.test(label)) errors.push("no tabs: " + label);
    if (errors.length > before) console.log("  no tabs, command", i, label, "->", errors.slice(before).join(" | "));
    await fresh();
  }
  check(!(await p.evaluate(() => window.__pwn)), "no page title or saved item ever runs as code in the window");
  check(!errors.length, "no script errors in the window:\n    " + errors.join("\n    "));
  errors.length = 0;
  // every page with every switch and select flipped
  for (const pg of process.env.QUICK ? [] : ["newtab.html", "settings.html", "side.html", "games.html", "whatsnew.html", "history.html", "downloads.html", "taskmgr.html", "changelog.html"]) {
    const q = await ctx.newPage(); watch(q, errors, pg); q.on("dialog", d => d.dismiss().catch(() => {}));
    const r = await q.goto("https://browser.example/" + pg).catch(e => null);
    if (!r || r.status() === 404) { await q.close(); continue; }
    await q.waitForTimeout(500);
    const before = errors.length;
    const cnt = await q.evaluate(async () => {
      let n = 0;
      for (const x of [...document.querySelectorAll("input[type=checkbox]")]) { x.click(); n++; await new Promise(f => setTimeout(f, 5)); }
      for (const s of [...document.querySelectorAll("select")]) for (const o of [...s.options]) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles:true })); s.dispatchEvent(new Event("input", { bubbles:true })); n++; await new Promise(f => setTimeout(f, 2)); }
      return n;
    });
    await q.waitForTimeout(300);
    console.log(pg, "controls:", cnt, errors.length > before ? "-> " + errors.slice(before).join(" | ") : "");
    // buttons (not links that navigate)
    const b2 = errors.length;
    const bn = await q.evaluate(async () => {
      let n = 0; const bs = [...document.querySelectorAll("button")].filter(b => !/delete|clear|reset|remove|erase|wipe|sign out|uninstall/i.test(b.textContent));
      for (const b of bs.slice(0, 400)) { try { if (b.isConnected) b.click(); } catch (e) {} n++; await new Promise(f => setTimeout(f, 5)); }
      return n;
    });
    await q.waitForTimeout(300);
    check(!(await q.evaluate(() => window.__pwn)), "no saved item runs as code on " + pg);
    console.log(pg, "buttons:", bn, errors.length > b2 ? "-> " + errors.slice(b2).join(" | ") : "");
    await q.close();
  }
  check(!errors.length, "no script errors on the pages:\n    " + errors.join("\n    "));
  // every page tool, twice, with empty and odd arguments, on an ordinary page
  const shield = require("fs").readFileSync(require("path").join(__dirname, "..", "out", "shield.js"), "utf8");
  const c2 = await browser.newContext({ viewport:{ width:1200, height:800 } });
  await c2.route("https://test.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>T</title><body><article><h1>Hi</h1>" + "<p>Some words <a href='/x'>link</a> and a <b>fox</b>.</p>".repeat(40) + "<img src='data:image/gif;base64,R0lGODlhAQABAAAAACw=' width=200 height=100><video></video><table><tr><td>a</td><td>1</td></tr></table><form><input name=q><input type=password></form></article>" }));
  await c2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await c2.addInitScript(shield);
  const tp = await c2.newPage(); watch(tp, errors, "page tools"); tp.on("dialog", d => d.dismiss().catch(() => {}));
  await tp.goto("https://test.example/page"); await tp.waitForTimeout(300);
  await tp.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"test.example", f:0 }));
  const TOOLS = "x-a11y x-ai x-bigtext x-bionic x-calm x-colors x-confetti x-contacts x-csv x-disco x-expand x-explain x-explain-more x-explain-on x-explain-show x-fill x-flip x-fonts x-frame x-gallery x-gravity x-grid x-hoverzoom x-init x-key x-keys x-laser x-links x-marks x-md x-noimg x-passwords x-replace x-ruler x-scrollto x-seek x-seen x-shop x-shop-act x-shop-warn x-snow x-speed x-spotlight x-text x-video x-words x-yt".split(" ");
  for (const a of TOOLS) for (const arg of ["", "", "{}", "[]", "null", "garbage", "5", '{"q":"fox"}']) {
    const before = errors.length;
    const r = await tp.evaluate(([a, arg]) => { try { window[Symbol.for("wsb.tool")](a, arg); return ""; } catch (e) { return "THROW " + e.message; } }, [a, arg]);
    if (r) errors.push("tool " + a + " " + JSON.stringify(arg) + ": " + r);
    await tp.waitForTimeout(25);
    if (errors.length > before) console.log("  tool", a, JSON.stringify(arg), "->", errors.slice(before).join(" | "));
  }
  await tp.waitForTimeout(800);
  check(!errors.length, "no script errors from the page tools:\n    " + errors.join("\n    "));
  errors.length = 0;
  console.log(`crawl: ${ok} passed, ${bad} failed`);
  await browser.close(); process.exit(bad ? 1 : 0);
})();
