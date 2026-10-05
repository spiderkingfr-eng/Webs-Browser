// Getting things done (Windows 3.10, iPhone 2.9; ../js/gtd.js): the morning routine, reminders for a site, the
// bookmark checkup, the weekly reading digest, your address for forms (encrypted), notes on a PDF, phone
// preview, and voice commands.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });

  /* ---------------------------------------------------------------- the parts both apps share */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  const P = s => c.evaluate(s => GTD.voice.parse(s), s);
  const parsed = await c.evaluate(() => ["New tab", "close this tab", "scroll down", "Hey Webs, go to the top", "open youtube dot com", "search for pizza near me", "tab three",
    "zoom in", "bookmark this", "read this page aloud", "find cats on this page", "ask web ai how tall is everest", "summarize this page", "do a barrel roll"].map(x => JSON.stringify(GTD.voice.parse(x))));
  check(parsed.join("|") === ['{"cmd":"newtab","arg":""}', '{"cmd":"close","arg":""}', '{"cmd":"down","arg":""}', '{"cmd":"top","arg":""}', '{"cmd":"open","arg":"youtube.com"}', '{"cmd":"search","arg":"pizza near me"}',
    '{"cmd":"tab","arg":3}', '{"cmd":"zoomin","arg":""}', '{"cmd":"bookmark","arg":""}', '{"cmd":"read","arg":""}', '{"cmd":"find","arg":"cats"}', '{"cmd":"ask","arg":"how tall is everest"}', '{"cmd":"summarize","arg":""}', "null"].join("|"),
    "voice commands understood: " + parsed.join(" "));
  check(await c.evaluate(() => { const d = new Date(); d.setHours(8, 30, 0, 0); const r = { on:true, time:"08:00", days:[d.getDay()], sites:[{ u:"https://a.example" }], last:"" };
    const late = new Date(d); late.setHours(15, 0); const early = new Date(d); early.setHours(7, 0);
    return GTD.routine.due(r, d) && !GTD.routine.due(r, early) && !GTD.routine.due(r, late) && !GTD.routine.due(Object.assign({}, r, { last:GTD.dayKey(d) }), d) && !GTD.routine.due(Object.assign({}, r, { on:false }), d); }),
    "the routine is due from its time (not before, not in the afternoon, once a day, only when on)");
  check(await c.evaluate(() => JSON.stringify(GTD.dupes([{ u:"https://x.com/a?utm_source=z" }, { u:"https://www.x.com/a/" }, { u:"https://x.com/b" }, { u:"https://x.com/a#top" }]))) === "[[0,1,3]]", "copies of the same page found (tracking tags, www, a trailing slash, #…)");

  /* ---------------------------------------------------------------- the morning routine (Windows) */
  await c.evaluate(() => { __host("viewport", 1280, 820); __host("tab-created", 1, 0, "https://shop.example/item", "", 0, 0); __host("tab-title", 1, "A shop"); __host("tab-selected", 1); if (overlay) closeOver(); });
  await wait(200);
  await c.evaluate(() => X3.gtd.routinePanel()); await wait(300);
  await c.evaluate(() => { const b = document.querySelector("#gtroutine"); b.querySelector(".gt-on").click(); b.querySelector(".gt-add").value = "news.example.com"; b.querySelector(".gt-addb").click(); b.querySelector(".gt-cur").click(); });
  await c.screenshot({ path:SHOTS + "gtd-routine.png" });
  const r = await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.routine")));
  check(r.on && r.sites.map(s => s.u).join() === "https://news.example.com,https://shop.example/item", "routine: on, with a typed site and the page you're on");
  await c.evaluate(() => { __sent.length = 0; closeOver(); const r = JSON.parse(localStorage.getItem("wsb.routine")); const d = new Date(); r.days = [d.getDay()]; r.time = String(d.getHours()).padStart(2, "0") + ":00"; r.last = ""; localStorage.setItem("wsb.routine", JSON.stringify(r)); localStorage.removeItem("wsb.routineLock"); });
  await c.evaluate(() => X3.gtd.openRoutine(false)); await wait(200);
  const opened = await c.evaluate(() => __sent.filter(m => m.startsWith("new-tab\u0001")).map(m => m.split("\u0001")[1]));
  check(opened.join() === "https://news.example.com,https://shop.example/item" && await c.evaluate(() => Object.values(groups).some(g => g.name === "☀️ Morning")), "its time: the sites open, in a ☀️ Morning group");
  check(await c.evaluate(() => !GTD.routine.due()), "and not again today");

  /* ---------------------------------------------------------------- reminders */
  await c.evaluate(() => X3.gtd.remindPanel()); await wait(200);
  await c.fill("#gtremind textarea", "Check if the price went down");
  await c.evaluate(() => document.querySelector("#gtremind .btn2.main").click()); await wait(100);
  check(await c.evaluate(() => GTD.remind.for("shop.example").length === 1), "a reminder for shop.example");
  await c.evaluate(() => { __host("tab-loading", 1, "0", "200"); }); await wait(200);
  check(await c.evaluate(() => /Check if the price went down/.test(document.getElementById("toast").textContent)), "back on the site: it pops up");
  await c.evaluate(() => { const b = document.querySelector("#toast button"); if (b) b.click(); }); await wait(100);
  check(await c.evaluate(() => GTD.remind.for("shop.example").length === 0), "Done: gone");

  /* ---------------------------------------------------------------- the bookmark checkup */
  await c.evaluate(() => { marks = [{ u:"https://a.example/x", t:"A" }, { u:"https://www.a.example/x/", t:"A again" }, { u:"https://gone.example/", t:"Gone" }, { u:"https://b.example/", t:"B" }]; saveNow("bookmarks"); __sent.length = 0; X3.gtd.checkPanel(); });
  await wait(200);
  check(await c.evaluate(() => /2 copies/.test(document.querySelector("#gtcheck").textContent)), "copies of the same page");
  await c.evaluate(() => document.querySelector("#gtcheck .gtd .btn2.main").click()); await wait(100);
  check(await c.evaluate(() => marks.length === 3), "Keep one of each");
  await c.evaluate(() => document.querySelector("#gtcheck .gtdead .btn2").click()); await wait(300);
  const fetched = await c.evaluate(() => __sent.filter(m => m.startsWith("feed-fetch\u0001")).map(m => m.split("\u0001")[1]));
  check(fetched.length === 3, "every link is tried: " + fetched.join(" "));
  await c.evaluate(() => { __host("feed", "https://a.example/x", "<html>ok</html>", ""); __host("feed", "https://gone.example/", "", "error"); __host("feed", "https://b.example/", "<html>", ""); }); await wait(300);
  check(await c.evaluate(() => /1 couldn't be reached/.test(document.querySelector("#gtcheck").textContent) && /Gone/.test(document.querySelector("#gtcheck .gtres").textContent)), "the one that's gone is listed, to remove");
  await c.screenshot({ path:SHOTS + "gtd-check.png" });

  /* ---------------------------------------------------------------- the reading digest */
  await c.evaluate(() => { closeOver(); save("reading", [{ u:"https://long.example/read", t:"A long read", ts:Date.now() - 6 * 864e5, done:false }, { u:"https://new.example", t:"New", ts:Date.now(), done:false }]); localStorage.setItem("wsb.digestAt", "0"); X3.gtd.digestTick(); });
  await wait(100);
  check(await c.evaluate(() => /reading digest: 1 saved page/.test(document.getElementById("toast").textContent)), "the weekly digest: 1 page saved 6 days ago, still waiting (not yesterday's)");
  await c.evaluate(() => X3.gtd.digestPanel()); await wait(100);
  check(await c.evaluate(() => /A long read/.test(document.querySelector("#gtdigest").textContent) && !/New/.test(document.querySelector("#gtdigest .gtb").textContent)), "and its list");

  /* ---------------------------------------------------------------- your address, encrypted */
  await c.evaluate(() => { closeOver(); X3.gtd.addressPanel(); }); await wait(300);
  await c.evaluate(() => { const v = { name:"Ada Lovelace", email:"ada@example.com", phone:"555 0100", street:"12 Analytical Way", city:"London", postcode:"N1 9GU", country:"United Kingdom" };
    document.querySelectorAll("#gtaddr input").forEach(i => { i.value = v[i.dataset.k] || ""; }); document.querySelector("#gtaddr .btn2.main").click(); });
  await wait(300);
  const vault = await c.evaluate(() => localStorage.getItem("wsb.addrVault"));
  check(vault && !/Ada|Lovelace|London/.test(vault) && /"iv"/.test(vault), "your address is stored encrypted (no plain text)");
  check(await c.evaluate(async () => (await X3.gtd.vault.load()).city === "London"), "and the browser can read it back");
  await c.evaluate(async () => { __sent.length = 0; await X3.gtd.fillAddress(); }); await wait(200);
  const fill = await c.evaluate(() => __sent.filter(m => m.startsWith("page-tool\u0001")).map(m => m.split("\u0001")).find(m => m[2] === "x-fill"));
  check(fill && JSON.parse(fill[3]).email === "ada@example.com", "Fill in my address hands it to the page, when asked");

  /* ---------------------------------------------------------------- notes on a PDF */
  await c.evaluate(() => { __host("tab-created", 5, 0, "https://docs.example/guide.pdf#page=4", "", 0, 0); __host("tab-selected", 5); }); await wait(200);
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Notes on this PDF/.test(m.textContent); }), "a PDF: Menu → Notes on this PDF…");
  await c.evaluate(() => X3.gtd.pdfPanel()); await wait(200);
  check(await c.evaluate(() => document.querySelector("#gtpdf .gtpg").value === "4"), "the page you're on (4)");
  await c.evaluate(() => { document.querySelector("#gtpdf textarea").value = "The key table"; document.querySelector("#gtpdf .gtnew .btn2").click(); });
  check(await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.pdfNotes"))["https://docs.example/guide.pdf"][0].p === 4), "a note kept with the PDF and its page");
  await c.screenshot({ path:SHOTS + "gtd-pdf.png" });

  /* ---------------------------------------------------------------- phone preview */
  await c.evaluate(() => { closeOver(); __host("tab-selected", 1); __sent.length = 0; }); await wait(100);
  await c.evaluate(() => X3.gtd.phoneStart(393)); await wait(200);
  const lay = await c.evaluate(() => __sent.filter(m => m.startsWith("layout\u0001")).pop().split("\u0001"));
  check(+lay[5] === 1280 - 44 - 393, "phone preview: the page is 393 wide (the sidebar takes the rest): " + lay[5]);
  check(await c.evaluate(() => cfg.mobile.includes("shop.example") && __sent.some(m => m.startsWith("side-open\u0001") && /side\.html#xphone/.test(m))), "the site's phone version, and the sizes in the sidebar");
  await c.evaluate(() => { localStorage.setItem("wsb.phonePrev", JSON.stringify({ off:1, t:Date.now() })); dispatchEvent(new StorageEvent("storage", { key:"wsb.phonePrev", newValue:localStorage.getItem("wsb.phonePrev") })); }); await wait(200);
  check(await c.evaluate(() => !X3.gtd.phone() && !cfg.mobile.includes("shop.example")), "Done: back to the desktop site, full width");
  const sd = await ctx.newPage(); watch(sd, errors, "side");
  await sd.goto("https://browser.example/side.html#xphone"); await wait(400);
  check(await sd.evaluate(() => document.querySelectorAll("#xphone .xcard").length === 6), "the sidebar: six phone sizes");
  await sd.screenshot({ path:SHOTS + "gtd-phone-side.png" });
  await sd.close();

  /* ---------------------------------------------------------------- voice commands */
  await c.evaluate(() => { __sent.length = 0; X3.gtd.voicePanel(); }); await wait(300);
  check(await c.evaluate(() => !!document.querySelector("#gtvoice input")), "voice: a box for Windows' voice typing (or typing)");
  await c.screenshot({ path:SHOTS + "gtd-voice.png" });
  await c.fill("#gtvoice input", "open youtube.com"); await c.press("#gtvoice input", "Enter"); await wait(200);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("navigate\u0001") && /youtube\.com/.test(m)) || __sent.some(m => /youtube\.com/.test(m))), "“open youtube.com” goes there");
  await c.evaluate(() => { __sent.length = 0; X3.gtd.runVoice({ cmd:"down" }); X3.gtd.runVoice({ cmd:"newtab" }); X3.gtd.runVoice({ cmd:"zoomin" }); });
  check(await c.evaluate(() => __sent.some(m => m === "page-tool\u00011\u0001x-scrollto\u0001down") && __sent.some(m => m.startsWith("new-tab\u0001")) && __sent.some(m => m.startsWith("zoom\u00011\u0001"))), "scroll down, new tab, zoom in");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Get things done…/.test(m.textContent) && /Voice commands/.test(m.textContent); }), "Menu → Get things done…, Voice commands");

  /* ---------------------------------------------------------------- on a page: filling a form, scrolling */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const ctx2 = await browser.newContext({ viewport:{ width:1000, height:600 } });
  await ctx2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await ctx2.addInitScript(shield);
  await ctx2.route("https://form.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:`<!doctype html><form style="margin:40px">
    <label>First name <input id="fn" name="firstName"></label><label>Last name <input id="ln" name="lastName"></label>
    <input id="em" type="email" placeholder="Email"><input id="ph" autocomplete="tel"><input id="st" name="address1"><input id="ci" placeholder="City">
    <input id="pc" name="zip"><select id="co" autocomplete="country"><option value="">Choose</option><option value="US">United States</option><option value="GB">United Kingdom</option></select>
    <input id="pw" type="password"><input id="cp" name="promo_code"><input id="pre" name="city2" value="kept"></form><div style="height:3000px"></div>` }));
  const p = await ctx2.newPage(); watch(p, errors, "form");
  await p.goto("https://form.example/"); await wait(200);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"form.example", f:0 }));
  await p.evaluate(() => window[Symbol.for("wsb.tool")]("x-fill", JSON.stringify({ name:"Ada Lovelace", email:"ada@example.com", phone:"555 0100", street:"12 Analytical Way", city:"London", postcode:"N1 9GU", country:"United Kingdom" })));
  const f = await p.evaluate(() => ["fn", "ln", "em", "ph", "st", "ci", "pc", "co", "pw", "cp", "pre"].map(id => document.getElementById(id).value));
  check(f.join("|") === "Ada|Lovelace|ada@example.com|555 0100|12 Analytical Way|London|N1 9GU|GB|||kept", "the form filled: names split, the country picked, password and promo boxes and what was there left alone: " + f.join("|"));
  await p.screenshot({ path:SHOTS + "gtd-fill.png" });
  await p.evaluate(() => window[Symbol.for("wsb.tool")]("x-scrollto", "down")); await wait(700);
  check(await p.evaluate(() => scrollY > 300), "“scroll down” scrolls the page");

  /* ---------------------------------------------------------------- the iPhone app */
  const a = await ctx.newPage(); watch(a, errors, "app");
  await a.setViewportSize({ width:390, height:844 });
  await a.addInitScript(() => { if (location.hostname === "app.example" && !localStorage.getItem("wsb.settings")) { const d = new Date(); localStorage.setItem("wsb.routine", JSON.stringify({ on:true, time:String(d.getHours()).padStart(2, "0") + ":00", days:[d.getDay()], sites:[{ u:"https://en.wikipedia.org/wiki/Morning", t:"Morning" }, { u:"https://news.example/", t:"News" }], last:"" })); } });
  await a.goto("https://app.example/index.html"); await wait(1500);
  check(await a.evaluate(() => !document.getElementById("gtSec").classList.contains("hide") && document.querySelectorAll("#gtSec .gts").length === 2), "iPhone: your morning sites on a card on the start page");
  await a.screenshot({ path:SHOTS + "gtd-iphone-routine.png" });
  await a.evaluate(() => document.querySelector("#gtSec .gts").click()); await wait(500);
  await a.evaluate(() => { GTDApp.cards(); });
  check(await a.evaluate(() => document.querySelectorAll("#gtSec .gts").length === 1), "a tapped one goes from the card");
  await a.evaluate(() => { GTD.remind.add("wikipedia.org", "Read the history part"); go("https://en.wikipedia.org/wiki/Cat"); }); await wait(1000);
  check(await a.evaluate(() => /Read the history part/.test(document.getElementById("toast") ? document.getElementById("toast").textContent : document.body.textContent)), "iPhone: a reminder when the site opens");
  await a.evaluate(() => openMenu()); await wait(300);
  check(await a.evaluate(() => !!document.querySelector('#sheetBody .mrow[data-act="gtd"]')), "iPhone: Menu → Get things done");
  await a.evaluate(() => GTDApp.voiceSheet()); await wait(200);
  await a.fill("#sheetBody .gtq", "new tab"); await a.press("#sheetBody .gtq", "Enter"); await wait(300);
  check(await a.evaluate(() => !curTab().u), "iPhone voice: “new tab”");
  await a.evaluate(() => { save("bookmarks", [{ u:"https://a.example/x", t:"A" }, { u:"https://a.example/x/", t:"A" }]); GTDApp.checkSheet(); }); await wait(200);
  check(await a.evaluate(() => /2 copies/.test(document.getElementById("sheetBody").textContent)), "iPhone: the bookmark checkup");

  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load resource/.test(e));
  errors.length = 0; errors.push(...real);
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
