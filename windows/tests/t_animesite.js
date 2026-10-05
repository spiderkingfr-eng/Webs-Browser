// Anime wallpapers behind websites (Webs 3.9): the window sends src/anime.page.js (with js/anime.js) to
// the sites you choose, and it runs on the page. Here it runs on a page laid out like a chat site
// (claude.ai, say: a sidebar, a column of messages, a box to type in), sent the way the host runs the
// "userjs" page tool. Then the window's side: when it's sent, the panel, the menu, Settings.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SITE = `<!doctype html><html lang="en" class="light"><head><meta charset="utf-8"><title>Chat</title>
<style>
:root{--bg0:oklch(98.5% .006 85);--bg1:#f0eee6;--card:#ffffff;--fg:#29261b}
html.dark{--bg0:#262624;--bg1:#1f1e1d;--card:#30302e;--fg:#f5f4ef}
html,body{margin:0;height:100%}body{background:var(--bg0);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
#app{display:flex;height:100vh}
nav{width:260px;flex:none;background:var(--bg1);padding:14px;box-sizing:border-box}
nav a{display:block;padding:6px 8px;border-radius:8px;color:inherit;text-decoration:none}nav a.on{background:rgba(0,0,0,.07)}
main{flex:1;display:flex;flex-direction:column;background:var(--bg0);min-width:0}
header{height:52px;display:flex;align-items:center;padding:0 18px;font-weight:600}
#log{flex:1;overflow:auto;padding:10px 0}
.col{max-width:720px;margin:0 auto;padding:0 18px}
.me{background:var(--card);border-radius:14px;padding:10px 14px;margin:14px 0 14px auto;width:fit-content;max-width:80%}
.ai{padding:4px 2px;margin:10px 0}
.code{background:#1e1e1e;color:#ddd;border-radius:10px;padding:12px;font:13px monospace}
#fade{height:28px;margin-top:-28px;position:relative;background:linear-gradient(to bottom,transparent,var(--bg0))}
#box{max-width:720px;margin:0 auto 18px;width:calc(100% - 36px);background:var(--card);border:1px solid rgba(0,0,0,.12);border-radius:18px;padding:12px 14px;box-sizing:border-box}
#ed{min-height:44px;outline:0}#send{float:right;background:#c96442;color:#fff;border:0;border-radius:9px;width:34px;height:34px}
#hero{height:180px;background:linear-gradient(135deg,#c96442,#e8a07c);border-radius:16px;margin:14px 0}
#scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none}
</style></head><body><div id="app">
<nav><b>Chat</b><a class="on" href="#">A talk about wallpapers</a><a href="#">Recipes</a><a href="#">Holiday plans</a></nav>
<main><header>A talk about wallpapers</header><div id="log"><div class="col">
<div class="me">Can you help me plan a trip?</div>
<div class="ai">Of course! ${"Here is a long and helpful answer about trains, hotels and the best time to go. ".repeat(6)}</div>
<div class="code">print("hello")</div><div id="hero"></div>
${'<div class="ai">More words to read, so the page can scroll a little further down. </div>'.repeat(12)}
</div></div><div id="fade"></div>
<div id="box"><div id="ed" contenteditable="true"></div><button id="send" onclick="window.sent=(window.sent||0)+1">↑</button></div></main></div>
<div id="scrim"></div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.addInitScript(() => { if (location.hostname === "browser.example" && !localStorage.getItem("wsb.settings")) localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", accent:"#3b8bf0" })); });
  // a strict site, like many: no inline styles or scripts of its own allowed
  await ctx.route("https://claude.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:SITE, headers:{ "content-security-policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'" } }));

  /* ---------------------------------------------------------------- the window makes what's sent */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  const code = await c.evaluate(() => X3.siteCode({ on:true, id:"jjk", mode:"behind", k:0, panels:true, soft:false, still:false, motion:2 }, true));
  check(code.length > 60000 && /wsb\.animeSite/.test(code) && /WALL\.jjk/.test(code), "the page side and the wallpapers go together: " + code.length + " characters");
  // the host runs it the way it runs every userscript
  const wrap = s => "(function(){try{\n" + s + "\n}catch(e){console.error('Webs Browser userscript:',e)}})();";

  /* ---------------------------------------------------------------- on the site */
  const p = await ctx.newPage(); watch(p, errors, "site");
  await p.goto("https://claude.example/chat"); await wait(300);
  const sheets0 = await p.evaluate(() => document.adoptedStyleSheets.length);
  await p.screenshot({ path:SHOTS + "animesite-before.png" });
  const run = s => p.evaluate(s => { (0, eval)(s); }, wrap(s));
  const set = o => run("var f=window[Symbol.for('wsb.animeSite')];if(f)f(" + JSON.stringify(Object.assign({ on:true, id:"jjk", mode:"behind", k:0, panels:true, soft:false, still:false, motion:2 }, o)) + ");");
  const info = () => p.evaluate(() => window[Symbol.for("wsb.animeSite")].info());
  const kind = sel => p.evaluate(sel => document.querySelector(sel).getAttribute("data-wsb-anime"), sel);
  const bgOf = sel => p.evaluate(sel => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);
  await run(code); await wait(900);
  check(await p.evaluate(() => { const h = document.querySelector("wsb-anime"); if (!h) return false; const s = getComputedStyle(h); return s.position === "fixed" && s.zIndex === "-2147483647" && s.pointerEvents === "none" && h.parentNode === document.documentElement; }), "the wallpaper sits behind the whole page, and takes no clicks");
  check(await p.evaluate(() => typeof window.Anime === "undefined" && typeof window.animeNoCss === "undefined"), "nothing of Webs' left for the site to see (no window.Anime)");
  check(await p.evaluate(() => !/an-card|an-tile/.test([...document.querySelectorAll("style")].map(s => s.textContent).join(""))), "and none of Webs' own styles on the site");
  check(await kind("body") === "b" && await kind("main") === "b", "the page and its main column turn see-through: " + await kind("body") + " " + await kind("main"));
  check(await bgOf("main") === "rgba(0, 0, 0, 0)", "main's background is gone");
  check(await kind("nav") && /^g\d$/.test(await kind("nav")), "the sidebar goes half see-through: " + await kind("nav"));
  check(/rgba\(240, 238, 230, 0\.\d+\)/.test(await bgOf("nav")), "in its own color: " + await bgOf("nav"));
  check(!(await kind(".me")) && await bgOf(".me") === "rgb(255, 255, 255)", "messages keep their look");
  check(!(await kind("#box")) && await bgOf("#box") === "rgb(255, 255, 255)", "so does the box to type in");
  check(!(await kind(".code")) && !(await kind("#hero")) && !(await kind("#send")), "and code, banners and buttons");
  check(await kind("#fade") === "b", "a fade into the page's color goes (it would be a band)");
  const i1 = await info();
  check(i1 && i1.mode === "behind" && i1.id === "jjk" && !i1.dark && Math.abs(i1.base[0] - 250) < 6, "the veil is the site's own color (light): " + JSON.stringify(i1 && i1.base));
  check(Math.abs(i1.k - .32) < .01, "about a third shows through on a light site: " + i1.k);
  check(await p.evaluate(() => document.adoptedStyleSheets.length) === sheets0 + 1, "its rules got onto the page (a strict site too)");
  // clicks and typing go to the site
  const sb = await p.evaluate(() => { const r = document.getElementById("send").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.click(sb[0], sb[1]);
  check(await p.evaluate(() => window.sent === 1), "clicking the site's button works");
  await p.click("#ed"); await p.keyboard.type("hello there");
  check(await p.evaluate(() => document.getElementById("ed").textContent === "hello there"), "typing works");
  // the wallpaper moves, behind the page
  const px = async () => (await p.screenshot({ clip:{ x:420, y:600, width:120, height:20 } })).toString("base64");
  { const a = await px(); await wait(700); check(a !== await px(), "it moves behind the page"); }
  await p.screenshot({ path:SHOTS + "animesite-light.png" });
  // the site's dark mode: the veil follows
  await p.evaluate(() => document.documentElement.className = "dark"); await wait(700);
  const i2 = await info();
  check(i2.dark && i2.base[0] === 38 && Math.abs(i2.k - .5) < .01, "the site's dark mode: a dark veil, half shows through: " + JSON.stringify(i2));
  check(/rgba\(31, 30, 29, 0\.\d+\)/.test(await bgOf("nav")) && await bgOf(".me") === "rgb(48, 48, 46)", "the sidebar's new color, messages theirs: " + await bgOf("nav"));
  await p.screenshot({ path:SHOTS + "animesite-dark.png" });
  // a page that redraws itself (as these sites do) keeps it, before it's even drawn
  const fresh = await p.evaluate(() => new Promise(res => {
    const m = document.querySelector("main"), n = m.cloneNode(true); n.removeAttribute("data-wsb-anime");
    m.replaceWith(n);
    requestAnimationFrame(() => res(n.getAttribute("data-wsb-anime")));
  }));
  check(fresh === "b", "a new main column is see-through before it's first drawn: " + fresh);
  // a scrim for a dialog keeps darkening the page
  await p.evaluate(() => document.getElementById("scrim").style.display = "block"); await wait(600);
  check(!(await kind("#scrim")) && await bgOf("#scrim") === "rgba(0, 0, 0, 0.45)", "a dialog's dimming stays");
  await p.evaluate(() => document.getElementById("scrim").style.display = "none"); await wait(300);
  // the site's look, your way
  await set({ k:.7 }); await wait(300);
  check((await info()).k === .7, "how much shows through: 70%");
  await set({ panels:false }); await wait(300);
  check(!(await kind("nav")) && await bgOf("nav") === "rgb(31, 30, 29)" && await kind("main") === "b", "sidebars solid again when asked");
  await set({ id:"p5", soft:true }); await wait(500);
  check((await info()).id === "p5", "another theme");
  await p.screenshot({ path:SHOTS + "animesite-p5.png" });
  await set({ still:true }); await wait(300);
  { const a = await px(); await wait(700); check(a === await px(), "a still picture doesn't move"); }
  await set({ mode:"over", still:false, k:0 }); await wait(500);
  check(await p.evaluate(() => { const s = getComputedStyle(document.querySelector("wsb-anime")); return s.zIndex === "2147483645" && s.mixBlendMode === "screen" && s.pointerEvents === "none"; }), "over the page: faint, on top, and clicks go through");
  check(!(await kind("main")) && !(await kind("body")) && await bgOf("main") === "rgb(38, 38, 36)", "and the site's backgrounds as they were");
  await p.mouse.click(sb[0], sb[1]);
  check(await p.evaluate(() => window.sent === 2), "clicking through it works");
  await p.screenshot({ path:SHOTS + "animesite-over.png" });
  // sent again on the same page: just the settings
  await set({ mode:"behind" }); await run(code); await wait(300);
  check(await p.evaluate(() => document.querySelectorAll("wsb-anime").length) === 1, "sent twice: still one wallpaper");
  // off: as it was
  await set({ on:false }); await wait(300);
  check(await p.evaluate(() => !document.querySelector("wsb-anime") && !document.querySelector("[data-wsb-anime]")), "off: the wallpaper goes, and every mark");
  check(await p.evaluate(() => document.adoptedStyleSheets.length) === sheets0 && await bgOf("main") === "rgb(38, 38, 36)", "and the site's own look is back");
  // with Webs' dark mode for every site on, the wallpaper isn't turned inside out
  await p.evaluate(() => { document.documentElement.className = "light"; const s = new CSSStyleSheet(); s.replaceSync("html{filter:invert(.92) hue-rotate(180deg)!important}"); document.adoptedStyleSheets = document.adoptedStyleSheets.concat(s); });
  await set({}); await wait(500);
  await p.screenshot({ path:SHOTS + "animesite-invert.png" });
  await set({ on:false });

  /* ---------------------------------------------------------------- the window: when it's sent */
  const sent = () => c.evaluate(() => __sent.filter(m => m.startsWith("page-tool\u0001")).map(m => m.split("\u0001")));
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://claude.ai/new", "", 0, 0); __host("tab-selected", 1); }); await wait(300);
  await c.evaluate(() => { if (overlay) closeOver(); __sent.length = 0; __host("tab-loading", 1, "0", "200"); }); await wait(200);
  check(!(await sent()).some(m => m[2] === "userjs"), "off by default: nothing goes to the site");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Anime wallpaper on this site…/.test(m.textContent); }), "Menu → Anime wallpaper on this site…");
  check(await c.evaluate(() => commands().some(x => /Anime wallpaper on this site/.test(x.t))), "and in the command palette");
  await c.evaluate(() => X3.sitePanel()); await wait(600);
  check(await c.evaluate(() => /claude\.ai/.test(document.querySelector("#ansp .xhead b").textContent) && document.querySelectorAll("#ansp .an-tile").length === 10), "the panel: this site, nine wallpapers and Match the browser");
  check(await c.evaluate(() => /Match the browser/.test(document.querySelector('#ansp .an-tile[data-id=""]').textContent) && document.querySelector('#ansp .an-tile[data-id=""]').classList.contains("on")), "matching the browser to start with");
  await c.screenshot({ path:SHOTS + "animesite-panel.png" });
  await c.evaluate(() => { __sent.length = 0; document.querySelector('#ansp .an-tile[data-id="slayer"]').click(); }); await wait(300);
  let s = await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")));
  check(s.animeWeb === "pick" && s.animeSites["claude.ai"].on === true && s.animeSites["claude.ai"].id === "slayer", "picking one turns it on for this site, saved: " + JSON.stringify(s.animeSites));
  let m = await sent();
  check(m.length === 1 && m[0][1] === "1" && m[0][2] === "userjs" && m[0][3].length > 60000 && /"id":"slayer"/.test(m[0][3]), "and sends it to the tab, wallpapers and all");
  check(await c.evaluate(() => document.querySelector("#ansp .ans-on").classList.contains("on")), "Show it on claude.ai: On");
  await c.evaluate(() => { __sent.length = 0; document.querySelector('#ansp .ans-seg button[data-m="over"]').click(); }); await wait(200);
  m = await sent();
  check(m.length === 1 && m[0][3].length < 1000 && /"mode":"over"/.test(m[0][3]), "a change after that: only the settings go");
  await c.evaluate(() => { __sent.length = 0; const r = document.querySelector("#ansp input[type=range]"); r.value = 60; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); }); await wait(200);
  check((await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")).animeSites["claude.ai"].k)) === .6 && /"k":0.6/.test((await sent())[0][3]), "how much shows through: 60%");
  await c.evaluate(() => { document.querySelector('#ansp input[data-o="still"]').click(); }); await wait(200);
  check(await c.evaluate(() => cfg.animeSites["claude.ai"].still === true), "a still picture");
  await c.evaluate(() => { __sent.length = 0; }); await c.evaluate(() => X3.sitePanel());
  await c.evaluate(() => { __sent.length = 0; __host("tab-loading", 1, "0", "200"); }); await wait(200);
  m = await sent();
  check(m.some(x => x[2] === "userjs" && x[3].length > 60000 && /"id":"slayer","mode":"over","k":0.6/.test(x[3])), "the site loads again: it's sent again, with its look");
  // another site isn't touched, unless every site is asked for
  await c.evaluate(() => { __host("tab-created", 2, 0, "https://example.com/", "", 0, 0); __sent.length = 0; __host("tab-loading", 2, "0", "200"); }); await wait(200);
  check(!(await sent()).some(x => x[1] === "2" && x[2] === "userjs"), "other sites: nothing");
  await c.evaluate(() => { __host("tab-selected", 2); }); await wait(200);
  await c.evaluate(() => { if (overlay) closeOver(); X3.sitePanel(); }); await wait(300);
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#ansp .ans-all").click(); }); await wait(200);
  m = await sent();
  check(await c.evaluate(() => cfg.animeWeb === "all") && m.some(x => x[1] === "2" && x[2] === "userjs" && /"on":true,"id":"jjk"/.test(x[3])), "On every website: example.com gets one too (no anime theme on: Cursed Energy)");
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#ansp .ans-on").click(); }); await wait(200);
  m = await sent();
  check(await c.evaluate(() => cfg.animeSites["example.com"].on === false) && m.some(x => x[1] === "2" && /C=\{"on":false\}/.test(x[3])), "and off again for just this one");
  // the browser's theme changes: a site that matches it follows
  await c.evaluate(() => { __sent.length = 0; closeOver(); X3.animePanel(); }); await wait(300);
  await c.evaluate(() => { document.querySelector('#anp .an-tile[data-id="ghoul"]').click(); }); await wait(300);
  check((await sent()).some(x => x[1] === "2") === false, "a site switched off stays off");
  await c.evaluate(() => { const a = Object.assign({}, cfg.animeSites); delete a["example.com"]; cfg.animeSites = a; saveNow("settings"); __sent.length = 0; X3.animePanel(); }); await wait(300);
  await c.evaluate(() => { document.querySelector('#anp .an-tile[data-id="naruto"]').click(); }); await wait(300);
  check((await sent()).some(x => x[1] === "2" && /"id":"naruto"/.test(x[3])) && !(await sent()).some(x => x[1] === "1"), "Match the browser follows a new theme; a site with its own stays");
  await c.evaluate(() => closeOver());

  /* ---------------------------------------------------------------- Settings */
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html"); await wait(500);
  check(await st.evaluate(() => document.getElementById("anWeb").value) === "all", "Settings: Anime wallpaper on websites: Every site");
  check(/claude\.ai/.test(await st.textContent("#anSites")) && /Wisteria Night/.test(await st.textContent("#anSites")), "and the sites with their own look");
  await st.evaluate(() => document.getElementById("anSites").scrollIntoView({ block:"center" })); await wait(200);
  await st.screenshot({ path:SHOTS + "animesite-settings.png" });
  await c.evaluate(() => { __sent.length = 0; });
  await st.evaluate(() => { const s = document.getElementById("anWeb"); s.value = ""; s.dispatchEvent(new Event("change")); }); await wait(500);
  m = await sent();
  check(m.some(x => x[1] === "1" && /"on":false/.test(x[3])) && m.some(x => x[1] === "2" && /C=\{"on":false\}/.test(x[3])), "Off in Settings: every open site goes back to how it was");
  await st.evaluate(() => document.querySelector("#anSites button").click()); await wait(300);
  check(await st.evaluate(() => !JSON.parse(localStorage.getItem("wsb.settings")).animeSites["claude.ai"]), "Remove forgets a site's look");

  /* ---------------------------------------------------------------- never in a private window */
  const pv = await ctx.newPage(); watch(pv, errors, "private");
  await pv.goto("https://browser.example/chrome.html?private=1"); await wait(300);
  check(await pv.evaluate(() => { cfg.animeWeb = "all"; return X3.siteLook("claude.ai").on === false; }), "not in a private window");

  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
