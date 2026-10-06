// Ideas #026-#050 (Windows 3.14 / iPhone 2.11): the Web AI tools (../../js/ai.tools.js), on the PC (src/webai.tools.js) and the
// iPhone (../../js/ai.app.js), with a pretend Web AI server and pretend pages.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(80); } return false; };
const untilN = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(60); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:860 } });
  await setup(ctx);
  const chats = []; let left = 20;
  const answer = b => {
    const m = b.messages[b.messages.length - 1], text = typeof m.content === "string" ? m.content : m.content.map(x => x.text || "").join("");
    if (/five-question multiple-choice quiz/.test(text)) return '```json\n{"quiz":[' + [1, 2, 3, 4, 5].map(i => '{"q":"Question ' + i + '?","opts":["a","b","c"],"a":1}').join(",") + ']}\n```';
    if (/^Rewrite this text/.test(text)) return "Could you please send it as soon as you can?";
    if (/Draft my reply/.test(text)) return "Hi Sam,\nThursday works for me.\nBest";
    if (/From the reviews/.test(text)) return "**Verdict:** good.\n## Pros\n- Light\n## Cons\n- Pricey";
    if (b.task === "factcheck") return "**Mostly false**, fairly sure.\n- [NASA](https://nasa.example/wall)";
    if (b.task === "compare2") return "| | A | B |\n|---|---|---|\n| Price | $1 | $2 |";
    return "Here you go.";
  };
  const route = async r => {
    const u = new URL(r.request().url()), H = { "access-control-allow-origin":"*" };
    if (u.pathname === "/check") return r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, left, limit:25 }) });
    if (u.pathname === "/chat") {
      const b = JSON.parse(r.request().postData()); chats.push(b);
      return r.fulfill({ status:200, headers:H, contentType:"application/x-ndjson", body:(answer(b).match(/[\s\S]{1,12}/g) || []).map(d => JSON.stringify({ d })).join("\n") + "\n" + JSON.stringify({ end:1, stop:"end_turn", left:--left }) + "\n" });
    }
    r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, features:[] }) });
  };
  await ctx.route("https://w.test/**", route);
  await ctx.addInitScript(() => { try { if ((location.hostname === "browser.example" || location.hostname === "app.example") && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => {
    window.__typed = []; window.__sel = { sel:"pls send asap", edit:1, all:0 }; window.__pick = { u:"https://img.example/cat.jpg", alt:"a cat" };
    const PG = { 1:{ t:"Re: Meeting\nSam wrote: can we meet Thursday?", title:"Inbox - Mail" }, 2:{ t:"Headphones X. Reviews: Great sound. Too pricey. Light.", title:"Headphones X - Shop" }, 3:{ t:"Lecture page", title:"Physics 101 - YouTube" } };
    const pm = chrome.webview.postMessage;
    chrome.webview.postMessage = m => {
      const a = String(m).split("\u0001"), id = +a[1], R = o => setTimeout(() => onToolResult(id, JSON.stringify(o)), 10);
      if (a[0] === "page-tool") {
        if (a[2] === "x-ai") R({ a:"x-ai", t:(PG[id] || {}).t || "", sel:"", title:(PG[id] || {}).title || "" });
        if (a[2] === "x-selinfo") R(Object.assign({ a:"x-selinfo" }, __sel));
        if (a[2] === "x-type") { __typed.push(JSON.parse(a[3])); R({ a:"x-type", ok:1 }); }
        if (a[2] === "x-pickimg") R(Object.assign({ a:"x-pickimg" }, __pick));
        if (a[2] === "x-yt") R({ a:"x-yt", t:"[0:01] Welcome to physics\n[2:30] Newton's laws", title:"Physics 101" });
      }
      return pm(m);
    };
    __host("viewport", 1280, 860);
    __host("tab-created", 1, 0, "https://mail.example/inbox/42", "", 0, 0); __host("tab-title", 1, "Inbox - Mail");
    __host("tab-created", 2, 0, "https://shop.example/headphones-x", "", 0, 0); __host("tab-title", 2, "Headphones X - Shop");
    __host("tab-created", 3, 0, "https://www.youtube.com/watch?v=phys", "", 0, 0); __host("tab-title", 3, "Physics 101 - YouTube");
    __host("tab-selected", 1); closeOver();
  });
  await wait(200);
  const lastChat = () => chats[chats.length - 1];
  const msg = b => { const m = b.messages[b.messages.length - 1]; return typeof m.content === "string" ? m.content : m.content.map(x => x.text || "").join(""); };
  const open = async id => { await c.evaluate(id => { closeOver(); X3.aiTools.open(id); }, id); await wait(150); };
  const fill = async (k, v) => c.evaluate(([k, v]) => { const i = document.querySelector('#aitool [data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event("change", { bubbles:true })); }, [k, v]);
  const run = async () => { const n = chats.length; await c.evaluate(() => document.querySelector("#aitool .ait-run").click()); await untilN(() => chats.length > n); await until(c, () => !document.querySelector("#aitool .ait-run").disabled); };
  const out = () => c.evaluate(() => (document.querySelector("#aitool .ait-out") || {}).textContent || "");

  /* the menu */
  await c.evaluate(() => X3.ai.morePanel()); await wait(150);
  const rows = await c.evaluate(() => [...document.querySelectorAll("#aimore .mi span:last-child")].map(s => s.textContent));
  check(["Rewrite text", "Draft a reply", "Ask across tabs", "Describe a picture", "Fact check", "Trip planner", "Make your own prompt…"].every(n => rows.includes(n)) && rows.length >= 27, "More from Web AI lists the new tools by group: " + rows.length);
  await c.screenshot({ path:SHOTS + "aitools-menu.png" });

  /* #026 rewrite: the selected text, back in its place */
  await open("rewrite");
  check(await until(c, () => document.querySelector('#aitool [data-k="text"]').value === "pls send asap"), "#026 the selected text, ready");
  await fill("how", "more formal"); await run();
  check(/so it is more formal/.test(msg(lastChat())) && /pls send asap/.test(msg(lastChat())) && /Could you please send it/.test(await out()), "#026 rewritten");
  await c.evaluate(() => [...document.querySelectorAll("#aitool .ait-b")].find(b => /Replace it/.test(b.textContent)).click());
  check(await until(c, () => __typed.some(x => x.t === "Could you please send it as soon as you can?" && x.r === "pls send asap")), "#026 and put back in place of the selection");
  await c.evaluate(() => { __sel = { sel:"whole box text", edit:1, all:1 }; });
  await open("rewrite"); await until(c, () => document.querySelector('#aitool [data-k="text"]').value === "whole box text"); await run();
  await c.evaluate(() => [...document.querySelectorAll("#aitool .ait-b")].find(b => /Replace it/.test(b.textContent)).click());
  check(await until(c, () => __typed.some(x => x.all === 1)), "#026 with nothing selected, the whole box is rewritten");
  await c.evaluate(() => { __sel = { sel:"", edit:0, all:0 }; });

  /* #027 reply */
  await open("reply"); await fill("points", "yes to Thursday"); await fill("tone", "friendly"); await run();
  check(/Sam wrote: can we meet Thursday/.test(msg(lastChat())) && /Make these points: yes to Thursday/.test(msg(lastChat())) && /Thursday works for me/.test(await out()), "#027 a reply drafted from the email on the page");
  await c.evaluate(() => [...document.querySelectorAll("#aitool .ait-b")].find(b => /Put it on the page/.test(b.textContent)).click());
  check(await until(c, () => __typed.some(x => /Thursday works for me/.test(x.t))), "#027 put in the reply box");

  /* the page tools: #028 #029 #030 #035 #036 */
  await c.evaluate(() => __host("tab-selected", 2));
  for (const [id, re] of [["comments", /Summarise the comments/], ["reviews", /From the reviews/], ["recipe", /Give just the recipe/], ["terms", /about to agree to these terms/], ["simplify", /so a 10-year-old can/]]) {
    await open(id); await run();
    check(re.test(msg(lastChat())) && /Headphones X\. Reviews/.test(msg(lastChat())), "#0" + ({ comments:28, reviews:29, recipe:30, terms:35, simplify:36 })[id] + " " + id + ": asks about the page's text");
  }
  await open("reviews"); await run();
  check(await c.evaluate(() => [...document.querySelectorAll("#aitool .ait-a h4")].map(h => h.textContent).join(",") === "Pros,Cons"), "#029 shown with headings and lists");

  /* #031 across tabs */
  await open("tabs"); await fill("q", "which is cheapest?"); await run();
  check(/<tab n="1">[\s\S]*Inbox[\s\S]*<tab n="3">/.test(msg(lastChat())) && /which is cheapest\?/.test(msg(lastChat())) && /\(tab 2\)/.test(msg(lastChat())), "#031 one question across all the tabs");

  /* #032 a picture */
  await c.evaluate(() => X3.aiTools.pickPicture());
  check(await untilN(() => chats.length && lastChat().image && lastChat().image.url === "https://img.example/cat.jpg") && await until(c, () => !!document.querySelector("#aitool .ait-pic img")), "#032 the picture you click is sent with the question, and shown");
  await c.evaluate(() => { __pick = { none:1, why:"locked" }; X3.aiTools.pickPicture(); });
  check(await until(c, () => /doesn't let its pictures be read/.test(document.getElementById("toast").textContent)), "#032 a page whose pictures can't be read: says so");
  await c.evaluate(() => { __pick = { u:"https://img.example/cat.jpg" }; });

  /* #033 lecture notes */
  await c.evaluate(() => __host("tab-selected", 3));
  await open("lecture"); await run();
  check(/<video>[\s\S]*\[2:30\] Newton's laws/.test(msg(lastChat())) && /Make study notes/.test(msg(lastChat())), "#033 notes from the video's captions");
  await c.evaluate(() => __host("tab-selected", 2));
  await open("lecture"); await c.evaluate(() => document.querySelector("#aitool .ait-run").click());
  check(await until(c, () => /Open a YouTube video first/.test(document.querySelector("#aitool .ait-out").textContent)), "#033 not a video: says so");

  /* #034 cover letter, remembered details */
  await open("cover"); await fill("me", "Sam, 5 years in retail"); await run();
  check(/About me:\nSam, 5 years in retail/.test(msg(lastChat())), "#034 your details and the job page");
  await open("cover");
  check(await c.evaluate(() => document.querySelector('#aitool [data-k="me"]').value === "Sam, 5 years in retail"), "#034 your details are kept for next time");

  /* #037 quiz, #038 cards to a file */
  await open("quiz5"); await run();
  check(await until(c, () => document.querySelectorAll("#aitool .ai-q button[data-o]").length === 3 && /Quiz \(5\)/.test(document.querySelector("#aitool .ai-seg").textContent)), "#037 a five-question quiz to answer");
  await c.evaluate(() => { const d = document.createElement("div"); document.body.appendChild(d); AI.study(d, { cards:[{ q:"Front\tone", a:"Back\nside" }, { q:"Q2", a:"A2" }], quiz:[] }); d.querySelector(".ai-savecards").click(); d.remove(); });
  check(await c.evaluate(() => __sent.some(m => m === "save-text\u0001Flashcards.txt\u0001Front one\tBack side\r\nQ2\tA2")), "#038 study cards saved as a file Anki and Quizlet import");

  /* #039 fact check, #048 compare by name: they search the web */
  await c.evaluate(() => { __sel = { sel:"The Great Wall is visible from space", edit:0, all:0 }; });
  await open("factcheck"); await until(c, () => document.querySelector('#aitool [data-k="claim"]').value.length > 0); await run();
  check(lastChat().task === "factcheck" && lastChat().search === true && /Great Wall/.test(msg(lastChat())) && await c.evaluate(() => !!document.querySelector('#aitool .ait-a a[href="https://nasa.example/wall"]')), "#039 a fact check, searched, with sources");
  await open("compare2"); await fill("a", "iPhone 17"); await fill("b", "Pixel 10"); await run();
  check(lastChat().task === "compare2" && lastChat().search === true && /Compare iPhone 17 with Pixel 10/.test(msg(lastChat())) && await c.evaluate(() => !!document.querySelector("#aitool .ait-a table")), "#048 two things compared, as a table");

  /* #040-#047 the forms */
  for (const [id, fields, re, n] of [
    ["tone", { text:"Fine. Do what you want." }, /how it might come across/, 40], ["names", { what:"a ginger kitten" }, /12 names for a ginger kitten/, 41],
    ["gifts", { who:"my dad", budget:"$50" }, /Gift ideas for my dad, budget \$50/, 42], ["trip", { city:"Tokyo", days:"3" }, /Plan 3 days in Tokyo[\s\S]*google\.com\/maps/, 43],
    ["meals", { have:"eggs, rice", people:"2" }, /7 dinners for 2 people using mostly what I have: eggs, rice/, 44], ["workout", { goal:"run 5 km" }, /Goal: run 5 km\. Time: 30 minutes/, 45],
    ["code", { text:"const x = 1;" }, /```\nconst x = 1;\n```/, 46], ["formula", { q:"=SUM(B2:B9)" }, /explain this formula[\s\S]*=SUM/, 47]]) {
    await open(id); for (const [k, v] of Object.entries(fields)) await fill(k, v); await run();
    check(re.test(msg(lastChat())), "#0" + n + " " + id);
  }
  await open("names"); await c.evaluate(() => document.querySelector("#aitool .ait-run").click());
  check(await until(c, () => /Fill in “Names for” first/.test(document.querySelector("#aitool .ait-out").textContent)), "a missing field: says which");

  /* #049 questions left */
  check(await until(c, () => { const b = document.querySelector("#aib .aileft"); return b && !b.hidden && +b.textContent === JSON.parse(localStorage.getItem("wsb.xai")).left; }), "#049 questions left today, on the Web AI button");
  left = 2; await c.evaluate(() => AI.check());
  check(await until(c, () => { const b = document.querySelector("#aib .aileft"); b && 0; return true; }) && await c.evaluate(async () => { await new Promise(r => setTimeout(r, 50)); const b = document.querySelector("#aib .aileft"); return AI.left() === 2; }), "#049 refreshed from the server");
  await c.evaluate(() => { AI.ask = AI.ask; }); await open("names"); await fill("what", "a robot"); await run();
  check(await until(c, () => document.querySelector("#aib .aileft").classList.contains("low") && /question/.test(document.querySelector("#aitool .ait-left").textContent)), "#049 shown in red when only a few are left");
  left = 20;

  /* #050 your prompts */
  await c.evaluate(() => { closeOver(); X3.aiTools.open("prompts"); });
  await wait(100);
  await c.evaluate(() => { const g = k => document.querySelector('#aiprompts .ait-add [data-k="' + k + '"]'); g("name").value = "Explain like I'm 10"; g("text").value = "Explain this page like I'm 10, with one example."; g("on").value = "page"; document.querySelector("#aiprompts .ait-add .ait-b").click(); });
  check(await c.evaluate(() => AITools.prompts().length === 1 && /Explain like I'm 10/.test(document.querySelector("#aiprompts .ait-pl").textContent)), "#050 a prompt of your own, saved");
  await c.evaluate(() => { closeOver(); X3.ai.morePanel(); });
  await wait(100);
  await c.evaluate(() => [...document.querySelectorAll("#aimore .mi")].find(r => /Explain like I'm 10/.test(r.textContent)).click());
  await untilN(() => chats.length && /Explain this page like I'm 10/.test(msg(lastChat())), 4000);
  check(/Explain this page like I'm 10[\s\S]*/.test(msg(lastChat())) && /<page>/.test(msg(lastChat())), "#050 run with one click, on the page");
  check(await c.evaluate(() => commands().some(x => x.t === "Web AI: Explain like I'm 10")), "#050 and in the command list");
  await wait(500); await c.screenshot({ path:SHOTS + "aitools-panel.png" });

  /* in a page: what's selected, and picking a picture (shield.more.js) */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const c2 = await browser.newContext();
  await c2.route("https://page.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:'<!doctype html><textarea id="ta">hello there friend</textarea><p id="p">Some page text.</p><img id="im" src="https://page.example/big.png" width="200" height="150"><img src="https://page.example/tiny.png" width="10" height="10">' }));
  await c2.route("https://page.example/*.png", r => r.fulfill({ status:200, contentType:"image/png", body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") }));
  await c2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await c2.addInitScript(shield);
  const pg = await c2.newPage(); watch(pg, errors, "page");
  await pg.goto("https://page.example/"); await wait(300);
  await pg.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"page.example", f:0 }));
  const T2 = (a, arg) => pg.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg || ""), [a, arg]);
  const last = () => pg.evaluate(() => { const m = __sent.filter(x => /\u0001tool\u0001/.test(x)).pop(); return m ? JSON.parse(m.split("\u0001")[3]) : null; });
  await pg.evaluate(() => { const t = document.getElementById("ta"); t.focus(); t.setSelectionRange(6, 11); });
  await T2("x-selinfo"); let r = await last();
  check(r.sel === "there" && r.edit === 1 && r.all === 0, "x-selinfo: the selection in a text box");
  await pg.evaluate(() => { const t = document.getElementById("ta"); t.setSelectionRange(5, 5); });
  await T2("x-selinfo"); r = await last();
  check(r.sel === "hello there friend" && r.all === 1, "x-selinfo: nothing selected, the whole box");
  await T2("x-type", JSON.stringify({ t:"Hi friend", all:1 }));
  check(await pg.evaluate(() => document.getElementById("ta").value) === "Hi friend", "x-type all: the whole box replaced");
  await pg.evaluate(() => document.activeElement.blur());
  await T2("x-pickimg");
  check(await pg.evaluate(() => /Click the picture/.test(document.documentElement.innerText)), "x-pickimg: says what to do");
  await pg.click("#im");
  r = await last();
  check(r && r.a === "x-pickimg" && r.u === "https://page.example/big.png", "x-pickimg: the clicked picture's address");
  await T2("x-pickimg"); await pg.keyboard.press("Escape");
  r = await last();
  check(r.none === 1 && r.why === "cancel", "x-pickimg: Esc cancels");
  await c2.close();

  /* the iPhone */
  const ictx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  await ictx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await ictx.route("https://w.test/**", route);
  await ictx.route(/^https:\/\/news\.example\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>News</title><h1>News</h1>" }));
  await ictx.addInitScript(() => { try { if (location.hostname === "app.example") localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const a = await ictx.newPage(); watch(a, errors, "iphone");
  await a.goto("https://app.example/index.html"); await wait(1500);
  await a.evaluate(() => { setCfg("openMode", "inside"); go("https://news.example/today"); }); await wait(400);
  await a.evaluate(() => AIApp.openMore()); await wait(300);
  const ir = await a.evaluate(() => [...document.querySelectorAll("#sheetBody [data-ai] .aitn b")].map(s => s.textContent));
  check(ir.includes("Rewrite text") && ir.includes("Describe a picture") && ir.includes("Trip planner") && !ir.includes("Ask across tabs") && !ir.includes("Draft a reply"), "iPhone: the tools that work on the phone");
  check(await until(a, () => /\d+ questions? left today/.test(document.querySelector("#sheetBody .ailead").textContent)), "iPhone #049: questions left");
  await a.screenshot({ path:SHOTS + "aitools-iphone.png" });
  const irun = async () => { const n = chats.length; await a.evaluate(() => document.querySelector("#sheetBody .ait-run").click()); await untilN(() => chats.length > n); await until(a, () => !document.querySelector("#sheetBody .ait-run").disabled); };
  await a.evaluate(() => AIApp.toolSheet("reviews")); await wait(200); await irun();
  check(lastChat().web === true && /Address: https:\/\/news\.example\/today/.test(msg(lastChat())), "iPhone: page tools have Web AI read the page's address");
  await a.evaluate(() => AIApp.toolSheet("picture")); await wait(200);
  await a.evaluate(() => { const u = document.querySelector("#sheetBody .aiimgurl"); u.value = "https://img.example/dog.jpg"; }); await irun();
  check(lastChat().image && lastChat().image.url === "https://img.example/dog.jpg", "iPhone #032: a picture's address");
  await a.evaluate(() => AIApp.toolSheet("picture")); await wait(200);
  await a.setInputFiles("#sheetBody .aiextra input[type=file]", { name:"cat.png", mimeType:"image/png", buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  await irun();
  check(lastChat().image && /^data:image\/jpeg;base64,/.test(lastChat().image.data), "iPhone #032: or a photo, made small");
  await a.evaluate(() => AIApp.toolSheet("lecture")); await wait(200);
  await a.evaluate(() => { document.querySelector("#sheetBody .aitrans").value = "0:00 Today: atoms"; }); await irun();
  check(/<video>[\s\S]*0:00 Today: atoms/.test(msg(lastChat())), "iPhone #033: notes from a pasted transcript");
  await a.evaluate(() => AIApp.toolSheet("names")); await wait(200);
  await a.evaluate(() => { document.querySelector('#sheetBody [data-k="what"]').value = "a puppy"; }); await irun();
  check(/12 names for a puppy/.test(msg(lastChat())) && await until(a, () => /Here you go/.test(document.querySelector("#sheetBody .ait-out").textContent)), "iPhone: a form tool");
  await a.evaluate(() => AIApp.promptsSheet()); await wait(200);
  await a.evaluate(() => { const g = k => document.querySelector('#sheetBody .ait-add [data-k="' + k + '"]'); g("name").value = "Haiku"; g("text").value = "Write a haiku about this."; g("on").value = "none"; document.querySelector("#sheetBody .ait-add .ait-b").click(); });
  check(await a.evaluate(() => AITools.prompts().some(p => p.name === "Haiku")), "iPhone #050: your prompts");

  console.log(errors.length ? "errors:\n  " + errors.join("\n  ") : "errors: none");
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
