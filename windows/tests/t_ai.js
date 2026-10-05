// More from Web AI (Windows 3.10, iPhone 2.9; ../js/ai.js): answers in the address bar, key moments of a video,
// tidy my tabs, compare tabs, study this page, Explain on selected text, find it again, and "Your instructions"
// sent with every question. A pretend Web AI server answers each job the way Claude would.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const bodies = [];
const REPLY = {
  answer:"Paris is the **capital** of France.",
  tidy:'Here you go:\n```json\n{"groups":[{"name":"Recipes","ids":[1,2]},{"name":"Laptops","ids":[3,4,5]}],"close":[{"id":2,"why":"a search you already did"}]}\n```',
  compare:"| Laptop | Price | Battery |\n|---|---|---|\n| Alpha 13 | $999 | 12 h |\n| Beta 14 | $1,199 | ? |\n\nThe **Alpha** is the better deal.",
  study:'```json\n{"cards":[{"q":"Capital of France","a":"Paris"},{"q":"River in Paris","a":"The Seine"}],"quiz":[{"q":"Which river runs through Paris?","opts":["Thames","Seine","Danube","Nile"],"a":1}]}\n```',
  explain:"It means two particles stay linked, so measuring one tells you about the other.",
  find:'```json\n{"hits":[{"n":2,"why":"lemon pasta"}]}\n```',
  video:"- [0:05] The intro\n- [1:30] How it works\n- [12:04] The results\n\nIn short: a quick tour."
};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("wsb.xaiConfig")) { localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:"https://webai.example" })); localStorage.setItem("wsb.xai", JSON.stringify({ auto:true, open:true, prefs:"Keep it short, please." })); }
  });
  await ctx.route("https://webai.example/**", async r => {
    const req = r.request(), u = new URL(req.url());
    if (req.method() === "OPTIONS") return r.fulfill({ status:204, headers:{ "access-control-allow-origin":"*", "access-control-allow-headers":"content-type" } });
    const b = JSON.parse(req.postData() || "{}");
    if (u.pathname === "/chat") bodies.push(b); else return r.fulfill({ status:200, headers:{ "access-control-allow-origin":"*" }, contentType:"application/json", body:JSON.stringify({ ok:true, open:true, left:20, limit:25 }) });
    const text = REPLY[b.task] || "Hello!", parts = text.match(/[\s\S]{1,12}/g);
    await wait(150);
    r.fulfill({ status:200, headers:{ "access-control-allow-origin":"*" }, contentType:"application/x-ndjson", body:parts.map(d => JSON.stringify({ d })).join("\n") + "\n" + JSON.stringify({ end:1, stop:"end_turn", left:20 }) + "\n" });
  });
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  const last = task => bodies.filter(b => b.task === task).pop();

  /* ---------------------------------------------------------------- the browser window */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  await c.evaluate(() => {
    __host("viewport", 1280, 820);
    [["https://food.example/lemon-pasta", "Lemon pasta"], ["https://www.google.com/search?q=pasta", "pasta - Google Search"], ["https://shop.example/alpha-13", "Alpha 13 laptop"],
     ["https://shop.example/beta-14", "Beta 14 laptop"], ["https://reviews.example/laptops", "Best laptops 2026"]].forEach(([u, t], i) => { __host("tab-created", i + 1, 0, u, "", 0, 0); __host("tab-title", i + 1, t); });
    __host("tab-selected", 3);
  });
  await wait(300); await c.evaluate(() => { if (overlay) closeOver(); });
  const sent = (action) => c.evaluate(a => __sent.filter(m => m.startsWith("page-tool\u0001") && m.split("\u0001")[2] === a).map(m => m.split("\u0001")), action);
  const reply = (id, o) => c.evaluate(([id, o]) => __host("tool-result", id, JSON.stringify(o)), [id, o]);

  // the address bar
  await c.click("#url"); await c.keyboard.type("what is the capital of france?"); await wait(1600);
  check(await c.evaluate(() => /Paris is the capital of France/.test($("#drop") ? $("#drop").textContent : "")), "a question ending with ?: Web AI's answer in the address bar's list");
  check(last("answer") && last("answer").prefs === "Keep it short, please." && /capital of france/.test(last("answer").messages[0].content), "asked as the address bar's job, with your instructions");
  await c.screenshot({ path:SHOTS + "ai-bar.png" });
  await c.keyboard.press("Escape"); await c.evaluate(() => { $("#url").blur(); if (overlay) closeOver(true); }); await wait(300); await wait(300);
  await c.click("#url"); await c.keyboard.type("best pizza near me"); await wait(1200);
  check(await c.evaluate(() => !/Web AI/.test($("#drop") ? $("#drop").textContent : "")), "a search isn't a question: no Web AI row");
  await c.evaluate(() => { $("#url").blur(); if (overlay) closeOver(true); }); await wait(300);
  const nAns = bodies.filter(b => b.task === "answer").length;
  await c.click("#url"); await c.keyboard.type("how do magnets work"); await wait(1200);
  check(bodies.filter(b => b.task === "answer").length === nAns && await c.evaluate(() => /Ask Web AI: how do magnets work/.test($("#drop").textContent)), "a question without ?: asked only when its row is picked");
  await c.evaluate(() => { $("#url").blur(); if (overlay) closeOver(true); }); await wait(300);

  // tidy my tabs
  await c.evaluate(() => X3.ai.tidyTabs()); await wait(800);
  check(/1 \| Lemon pasta \| https:\/\/food\.example\/lemon-pasta/.test(last("tidy").messages[0].content) && !/<page>/.test(last("tidy").messages[0].content), "tidy: Web AI gets titles and addresses only");
  check(await c.evaluate(() => document.querySelectorAll("#aitidy .aig").length === 2 && /Recipes · 2/.test(document.querySelector("#aitidy").textContent)), "two groups: Recipes and Laptops");
  await c.screenshot({ path:SHOTS + "ai-tidy.png" });
  await c.evaluate(() => document.querySelector("#aiGroup").click()); await wait(200);
  check(await c.evaluate(() => Object.values(groups).map(g => g.name).sort().join() === "Laptops,Recipes" && tabs.filter(t => t.group).length === 5), "Make these groups: real tab groups");
  await c.evaluate(() => X3.ai.tidyTabs()); await wait(800);
  const goes = await c.evaluate(() => document.querySelector("#aitidy .aic span").textContent);
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#aiClose").click(); }); await wait(200);
  check(await c.evaluate(goes => { const m = __sent.find(x => x.startsWith("close-tab\u0001")); const t = m && T(+m.split("\u0001")[1]); return !!m && (!t || t.title === goes); }, goes), "and the tab it says could go (" + goes + "), closed");

  // compare
  await c.evaluate(() => { __sent.length = 0; X3.ai.compareTabs(); }); await wait(300);
  await c.evaluate(() => { document.querySelectorAll("#aicmp input").forEach(i => { i.checked = [3, 4].includes(+i.dataset.id); }); document.querySelector("#aiCmp").click(); });
  await wait(300);
  check((await sent("x-ai")).map(m => +m[1]).join() === "3", "compare: the ticked tabs are read, one after the other");
  await reply(3, { a:"x-ai", title:"Alpha 13 laptop", t:"Alpha 13. $999. Battery 12 hours." }); await wait(150);
  check((await sent("x-ai")).map(m => +m[1]).join() === "3,4", "then the second");
  await reply(4, { a:"x-ai", title:"Beta 14 laptop", t:"Beta 14. $1,199." }); await wait(900);
  check(/<page>\nTitle: Alpha 13 laptop/.test(last("compare").messages[0].content) && /<page>\nTitle: Beta 14 laptop/.test(last("compare").messages[0].content), "both pages go to Web AI");
  check(await c.evaluate(() => document.querySelectorAll("#aicmp .ai-md table tr").length === 3 && /better deal/.test(document.querySelector("#aicmp").textContent)), "a table side by side, and a verdict");
  await c.screenshot({ path:SHOTS + "ai-compare.png" });

  // study this page
  await c.evaluate(() => { __sent.length = 0; closeOver(); X3.ai.studyPage(); }); await wait(300);
  await reply(3, { a:"x-ai", title:"Paris", t:"Paris is the capital of France. The Seine runs through it." }); await wait(900);
  check(await c.evaluate(() => /Capital of France/.test(document.querySelector("#aistudy .ai-card").textContent)), "study: flashcards");
  await c.evaluate(() => document.querySelector("#aistudy .ai-card").click()); await wait(500);
  check(await c.evaluate(() => document.querySelector("#aistudy .ai-card").classList.contains("flip")), "a card turns over");
  await c.screenshot({ path:SHOTS + "ai-study.png" });
  await c.evaluate(() => document.querySelector('#aistudy .ai-seg button[data-m="quiz"]').click());
  await c.evaluate(() => document.querySelector('#aistudy .ai-q button[data-o="1"]').click());
  check(await c.evaluate(() => document.querySelector('#aistudy .ai-q button[data-o="1"]').classList.contains("right")), "and a quiz: the right answer, in green");

  // Explain, asked from the bubble on a page
  await c.evaluate(() => { __sent.length = 0; closeOver(); });
  await reply(3, { a:"x-explain", sel:"quantum entanglement", ctx:"Quantum entanglement links particles.", title:"Physics" }); await wait(900);
  const ex = (await sent("x-explain-show")).map(m => JSON.parse(m[3]));
  check(ex.length && ex[ex.length - 1].t === REPLY.explain && !ex[ex.length - 1].more, "Explain: the answer goes back to the bubble on the page");
  check(/<selection>\nquantum entanglement\n<\/selection>/.test(last("explain").messages[0].content), "with the selection and the paragraph around it");
  check((await sent("x-explain-on")).length === 0, "(only pages that load get the bubble switched on)");
  await c.evaluate(() => { __host("tab-loading", 3, "0", "200"); }); await wait(100);
  check((await sent("x-explain-on")).some(m => m[1] === "3" && m[3] === "1"), "a page that loads: the Explain bubble is on");

  // find it again
  await c.evaluate(() => { hist = [{ u:"https://news.example/a", t:"Some news", ts:Date.now() - 864e5 }, { u:"https://food.example/lemon-pasta", t:"Lemon pasta recipe", ts:Date.now() - 3 * 864e5 }]; X3.ai.findAgain(); });
  await wait(200); await c.fill("#aifind input", "that pasta with lemon"); await c.click("#aifind .btn2.main"); await wait(900);
  check(/2 \| \d{4}-\d{2}-\d{2} \| Lemon pasta recipe \| https:\/\/food\.example\/lemon-pasta/.test(last("find").messages[0].content), "find it again: the history's titles and addresses, numbered");
  check(await c.evaluate(() => /Lemon pasta recipe/.test(document.querySelector("#aifind .aires").textContent)), "and the page it found");
  await c.screenshot({ path:SHOTS + "ai-find.png" });

  // key moments of a YouTube video
  await c.evaluate(() => { closeOver(); __host("tab-created", 9, 0, "https://www.youtube.com/watch?v=abc123", "", 0, 0); __host("tab-selected", 9); __sent.length = 0; X3.ai.keyMoments(); }); await wait(300);
  check((await sent("x-yt")).length === 1, "key moments: the video's captions are asked for");
  await reply(9, { a:"x-yt", title:"How magnets work", t:"[0:05] hi there\n[1:30] so magnets have poles" }); await wait(900);
  check(await c.evaluate(() => document.querySelectorAll("#aiyt .aits").length === 3), "three moments, as times to click");
  await c.screenshot({ path:SHOTS + "ai-video.png" });
  await c.evaluate(() => document.querySelectorAll("#aiyt .aits")[2].click());
  check((await sent("x-seek")).some(m => m[1] === "9" && m[3] === "724"), "a time jumps the video there (12:04)");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /More from Web AI…/.test(m.textContent); }), "Menu → More from Web AI…");
  check(bodies.every(b => b.prefs === "Keep it short, please."), "your instructions went with every question: " + bodies.filter(b => b.prefs !== "Keep it short, please.").map(b => b.task + ":" + JSON.stringify(b.prefs)).join());

  /* ---------------------------------------------------------------- on a page: the Explain bubble, and a video's captions */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const ctx2 = await browser.newContext({ viewport:{ width:1100, height:700 } });
  await ctx2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await ctx2.addInitScript(shield);
  await ctx2.route("https://yt.example/**", r => {
    if (r.request().url().includes("/tt")) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ events:[{ tStartMs:1000, segs:[{ utf8:"Hello and welcome" }] }, { tStartMs:95000, segs:[{ utf8:"now the main part" }] }] }) });
    r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>A video</title><p id=p style=\"font:20px serif;margin:60px\">Quantum entanglement is when two particles stay linked however far apart they are.</p><script>window.ytInitialPlayerResponse={videoDetails:{videoId:'abc',title:'A video',shortDescription:'About things'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:'/tt?x=1',languageCode:'en'}]}}};</script>" });
  });
  const p = await ctx2.newPage(); watch(p, errors, "page");
  await p.goto("https://yt.example/watch?v=abc"); await wait(200);
  await p.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"yt.example", f:0 }));
  const T2 = (a, arg) => p.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg == null ? "" : arg), [a, arg]);
  const replies = () => p.evaluate(() => __sent.filter(m => m.startsWith("wsb-page\u0001TK\u0001tool\u0001")).map(m => JSON.parse(m.split("\u0001")[3])));
  await T2("x-yt"); await wait(400);
  const yt = (await replies()).find(r => r.a === "x-yt");
  check(yt && /^\[0:01\] Hello and welcome\n\[1:35\] now the main part$/.test(yt.t) && yt.title === "A video", "on YouTube: the captions come back as times and words: " + JSON.stringify(yt && yt.t));
  await T2("x-explain-on", "1");
  const box = await p.evaluate(() => { const r = document.getElementById("p").getBoundingClientRect(); return [r.left + 4, r.top + r.height / 2, r.left + 340]; });
  await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[2], box[1], { steps:8 }); await p.mouse.up(); await wait(200);
  check(await p.evaluate(() => document.querySelectorAll("wsb-badge").length === 1), "select a few words: the ✦ Explain button shows");
  await p.screenshot({ path:SHOTS + "ai-explain-button.png" });
  const bp = await p.evaluate(() => { const r = document.querySelector("wsb-badge").getBoundingClientRect(); return [r.left + 30, r.top + 12]; });
  await p.mouse.click(bp[0], bp[1]); await wait(200);
  const xr = (await replies()).find(r => r.a === "x-explain");
  check(xr && /Quantum entanglement/.test(xr.sel) && /two particles stay linked/.test(xr.ctx), "clicked: the selection and its paragraph go to the browser window");
  await T2("x-explain-show", JSON.stringify({ t:REPLY.explain })); await wait(200);
  await p.screenshot({ path:SHOTS + "ai-explain-answer.png" });
  await T2("x-explain-on", "0");
  await p.mouse.click(20, 20); await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[2], box[1], { steps:8 }); await p.mouse.up(); await wait(200);
  check(await p.evaluate(() => document.querySelectorAll("wsb-badge").length === 0), "switched off in Settings: no button");

  /* ---------------------------------------------------------------- the iPhone app */
  const a = await ctx.newPage(); watch(a, errors, "app");
  await a.setViewportSize({ width:390, height:844 });
  await a.goto("https://app.example/index.html"); await wait(1500);
  await a.evaluate(() => openOmni("")); await wait(200);
  await a.fill("#q", "who painted the mona lisa?"); await a.evaluate(() => omniRender()); await wait(1600);
  check(await a.evaluate(() => /Paris is the capital/.test(document.getElementById("omniList").textContent)), "iPhone: Web AI's answer in the address bar too");
  await a.screenshot({ path:SHOTS + "ai-iphone-bar.png" });
  await a.evaluate(() => closeOmni());
  await a.evaluate(() => { T.n.list.push({ id:"x1", u:"https://food.example/lemon-pasta", t:"Lemon pasta" }, { id:"x2", u:"https://www.google.com/search?q=pasta", t:"pasta - Google" },
    { id:"x3", u:"https://shop.example/alpha-13", t:"Alpha 13" }, { id:"x4", u:"https://shop.example/beta-14", t:"Beta 14" }, { id:"x5", u:"https://reviews.example/laptops", t:"Laptops" }); });
  await a.evaluate(() => openMenu()); await wait(300);
  check(await a.evaluate(() => !!document.querySelector('#sheetBody .mrow[data-act="aimore"]')), "iPhone: Menu → More from Web AI");
  await a.evaluate(() => document.querySelector('#sheetBody .mrow[data-act="aimore"]').click()); await wait(300);
  await a.evaluate(() => document.querySelector('#sheetBody [data-ai="compare"]').click()); await wait(200);
  await a.evaluate(() => document.querySelector("#sheetBody .aigo").click()); await wait(900);
  const cb = last("compare");
  check(cb.web === true && /Address: https:\/\/food\.example\/lemon-pasta/.test(cb.messages[0].content) && !/Alpha 13\. \$999/.test(cb.messages[0].content), "iPhone compare: the addresses, for Web AI to open");
  check(await a.evaluate(() => !!document.querySelector("#sheetBody .ai-md table")), "and the table");
  await a.screenshot({ path:SHOTS + "ai-iphone-compare.png" });
  await a.evaluate(() => AIApp.tidy()); await wait(900);
  check(await a.evaluate(() => document.querySelectorAll("#sheetBody .aig").length === 2), "iPhone: tidy my tabs");
  await a.evaluate(() => { save("history", [{ u:"https://news.example/a", t:"News", ts:Date.now() }, { u:"https://food.example/lemon-pasta", t:"Lemon pasta recipe", ts:Date.now() }]); AIApp.find(); });
  await wait(200); await a.fill("#sheetBody .aiq", "lemon pasta"); await a.evaluate(() => document.querySelector("#sheetBody .aigo").click()); await wait(900);
  check(await a.evaluate(() => /Lemon pasta recipe/.test(document.querySelector("#sheetBody .aires").textContent)), "iPhone: find it again");
  await a.evaluate(() => { T.n.active = "x1"; AIApp.study(); }); await wait(900);
  check(last("study").web === true && await a.evaluate(() => !!document.querySelector("#sheetBody .ai-card")), "iPhone: study the page (Web AI opens it itself)");
  await a.evaluate(() => { closeSheet(); WebAI.open(); }); await wait(300);

  const real = errors.filter(e => !/An unknown error occurred when fetching the script/.test(e));
  errors.length = 0; errors.push(...real);
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
