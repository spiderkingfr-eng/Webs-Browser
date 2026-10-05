// Web AI end to end: the browser window (chrome.html), the sidebar (side.html#xai) and the
// real server code (server/web-ai/worker.js), with only Claude itself pretended.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const SERVER = "https://web-ai.test.workers.dev";

(async () => {
  const worker = (await import(path.join(ROOT, "..", "server", "web-ai", "worker.js"))).default;
  const kv = new Map();
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", WEB_AI_CODES:"Sam=abcd1234efgh", DAILY_LIMIT:"6",
    LIMITS:{ get:async k => kv.has(k) ? kv.get(k) : null, put:async (k, v) => { kv.set(k, v); } } };
  // pretend Claude: answers with what it was sent, so the test can see the page went along
  const asked = [];
  let claude = body => [{ type:"message_start", message:{ usage:{} } },
    { type:"content_block_delta", delta:{ type:"text_delta", text:"## Summary\n\nThe page is about **foxes**.\n\n- Point one\n- Point two [link](https://example.org/a_b_c)\n\n" } },
    { type:"content_block_delta", delta:{ type:"text_delta", text:"```js\nlet x = 1;\n```\n<img src=x onerror=alert(1)> ![t](https://evil.example/p.png)" } },
    { type:"message_delta", delta:{ stop_reason:"end_turn" }, usage:{ output_tokens:9 } }];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url !== "https://api.anthropic.com/v1/messages") return realFetch(url, init);
    const body = JSON.parse(init.body); asked.push(body);
    const ev = claude(body);
    if (!Array.isArray(ev)) return new Response(JSON.stringify(ev.error), { status:ev.status });
    return new Response(ev.map(e => "event: " + e.type + "\ndata: " + JSON.stringify(e) + "\n\n").join(""), { status:200 });
  };

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.route(SERVER + "/**", async r => {
    const q = r.request(), waits = [];
    const res = await worker.fetch(new Request(q.url(), { method:q.method(), headers:q.headers(), body:q.method() === "POST" ? q.postData() : undefined }), env, { waitUntil:p => waits.push(p) });
    const body = await res.text(); await Promise.all(waits);
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    r.fulfill({ status:res.status, headers, body });
  });

  // the browser window, with one web page open
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await c.waitForTimeout(200);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/foxes", "", 0, 0); __host("tab-selected", 1); __host("tab-title", 1, "Foxes of the world"); });
  await c.waitForTimeout(400);
  await c.evaluate(() => { if (overlay) closeOver(); });
  // the page (shield.js) answers page tools; this stands in for it
  await c.evaluate(() => {
    window.__pageText = "Foxes are small. They live in forests.\n\nThey eat berries.";
    window.__sel = "";
    setInterval(() => {
      const i = __sent.findIndex(m => m === "page-tool\u00011\u0001x-ai\u0001");
      if (i < 0) return;
      __sent.splice(i, 1);
      __host("tool-result", 1, JSON.stringify({ a:"x-ai", t:__pageText, sel:__sel, title:"Foxes of the world" }));
    }, 30);
  });
  const WIN = await c.evaluate(() => WIN);

  // the toolbar button opens Web AI in the sidebar
  check(await c.evaluate(() => !!document.querySelector("#aib") && ["sideb", "vcb"].includes(document.querySelector("#aib").nextElementSibling.id)), "Web AI button next to the sidebar button (Hey Webs may sit between)");
  await c.click("#aib"); await c.waitForTimeout(100);
  const opened = await c.evaluate(() => __sent.filter(m => m.startsWith("side-open")).pop() || "");
  check(opened === "side-open\u0001https://browser.example/side.html?w=" + WIN + "#xai", "opens side.html#xai for this window: " + opened);
  check(await c.evaluate(() => side.open && side.which === "xai" && document.querySelector("#aib").classList.contains("act")), "button shows it's open");
  check(await c.evaluate(() => document.querySelector("#rail .btn").title.startsWith("Web AI")), "Web AI first in the sidebar rail");
  await c.click("#aib"); await c.waitForTimeout(100);
  check(await c.evaluate(() => !side.open && !document.querySelector("#aib").classList.contains("act")), "clicking again closes it");
  await c.evaluate(() => shortcut(65, false, true, true)); await c.waitForTimeout(50);
  check(await c.evaluate(() => side.open && side.which === "xai"), "Alt+Shift+A opens it");
  await c.evaluate(() => { __host("tool-result", 1, JSON.stringify({ a:"x-key", k:"A" })); }); await c.waitForTimeout(50);
  check(await c.evaluate(() => !side.open), "Alt+Shift+A pressed on the page toggles it too");
  await c.evaluate(() => { const m = el("div"); X3.menuRows(m); window.__m = m.textContent; });
  check(/Web AI/.test(await c.evaluate(() => __m)), "in the menu");
  check(await c.evaluate(() => commands().some(x => x.t === "Web AI: summarize this page")), "in the command palette");

  // the sidebar
  const s = await ctx.newPage(); watch(s, errors, "side");
  await s.setViewportSize({ width:380, height:760 });
  await s.goto("https://browser.example/side.html?w=" + WIN + "#xai"); await s.waitForTimeout(300);
  check(await s.evaluate(() => document.querySelector("nav button.on").dataset.p === "xai" && document.querySelector("#xai").classList.contains("on")), "AI tab shown");
  check(await s.isVisible("#xaiCode") && await s.isVisible("#xaiSrv"), "first time: asks for the code and the server");
  await s.screenshot({ path:SHOTS + "webai-setup.png" });
  await s.fill("#xaiCode", "wrong-code-0000"); await s.fill("#xaiSrv", SERVER); await s.click("#xaiGo"); await s.waitForTimeout(400);
  check(/isn't right/.test(await s.textContent("#xaiMsg")), "wrong code explained: " + await s.textContent("#xaiMsg"));
  await s.fill("#xaiSrv", "http://insecure.example"); await s.click("#xaiGo"); await s.waitForTimeout(100);
  check(/https/.test(await s.textContent("#xaiMsg")), "server must be https");
  await s.fill("#xaiSrv", SERVER); await s.fill("#xaiCode", "abcd1234efgh"); await s.click("#xaiGo"); await s.waitForTimeout(500);
  check(/Hi Sam/.test(await s.textContent(".xai-hello h3")), "connected: says hi");
  check((await s.textContent(".xai-left")) === "6 left today", "questions left shown");
  const saved = await s.evaluate(() => JSON.parse(localStorage.getItem("wsb.xai")));
  check(saved.code === "abcd1234efgh" && saved.server === SERVER, "code and server kept on this computer");
  check(await s.evaluate(() => !/abcd1234efgh/.test(localStorage.getItem("wsb.settings") || "")), "the code isn't in the synced settings");
  // the browser shares which page is open
  await c.evaluate(() => { lastCurrent = ""; shareCurrent(T(1)); });
  await s.waitForTimeout(100);
  check(/Using: Foxes of the world/.test(await s.textContent(".xai-page")), "shows the page it will use: " + await s.textContent(".xai-page") + " / " + await s.evaluate(() => localStorage.getItem("wsb.current")));
  await s.screenshot({ path:SHOTS + "webai-hello.png" });

  // a question: the page goes along, the answer streams in
  await s.click(".xai-sug button"); await s.waitForTimeout(900);
  const sent = asked[asked.length - 1];
  check(sent && sent.messages.length === 1 && /<page>\nTitle: Foxes of the world\nAddress: https:\/\/example.com\/foxes\n\nFoxes are small/.test(sent.messages[0].content) && /Summarize this page\.$/.test(sent.messages[0].content), "page sent with the question: " + JSON.stringify(sent && sent.messages));
  check(await s.evaluate(() => !localStorage.getItem("wsb.xaiPage." + new URLSearchParams(location.search).get("w"))), "page text removed from storage once read");
  check(/The page is about foxes/.test(await s.textContent(".xai-a")), "answer shown");
  check(await s.evaluate(() => { const a = document.querySelector(".xai-a"); return !!a.querySelector("h4") && a.querySelectorAll("li").length === 2 && !!a.querySelector("b") && !!a.querySelector("pre code"); }), "Markdown: heading, list, bold, code");
  check(await s.evaluate(() => { const a = document.querySelector(".xai-a"); return !a.querySelector("img") && /&lt;img|<img/.test(a.innerHTML) && a.textContent.includes("<img src=x"); }), "no pictures, HTML shown as text");
  check(await s.evaluate(() => document.querySelector(".xai-a a").getAttribute("href")) === "https://example.org/a_b_c", "links untouched by formatting");
  await s.click(".xai-a a"); await s.waitForTimeout(50);
  check(await s.evaluate(() => __sent.includes("open\u0001https://example.org/a_b_c")), "links open in a tab");
  check(/📄 Foxes of the world/.test(await s.textContent(".xai-q")), "question shows the page went along");
  check((await s.textContent(".xai-left")) === "5 left today", "one question used");
  await s.screenshot({ path:SHOTS + "webai-answer.png" });

  // a follow-up on the same page doesn't send it again; a selection goes along
  await c.evaluate(() => { __sel = "They eat berries."; });
  await s.fill(".xai-in textarea", "Why berries?"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(900);
  const sent2 = asked[asked.length - 1];
  check(sent2.messages.length === 3 && sent2.messages[1].role === "assistant" && !/<page>/.test(sent2.messages[2].content) && /<selection>\nThey eat berries\.\n<\/selection>\n\nWhy berries\?$/.test(sent2.messages[2].content), "follow-up: no second copy of the page, selection included: " + JSON.stringify(sent2.messages[2]));
  check(/<page>/.test(sent2.messages[0].content), "the page is still in the first message");

  // "Use this page" off: nothing read
  await s.click(".xai-page"); await s.waitForTimeout(50);
  check(/Not using/.test(await s.textContent(".xai-page")), "page switch off");
  await c.evaluate(() => { window.__asked0 = __sent.length; });
  await s.fill(".xai-in textarea", "Plain question"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(asked[asked.length - 1].messages.pop().content === "Plain question", "only the question");
  await s.click(".xai-page");

  // errors: Claude out of credit -> plain words and Try again; the failed question isn't sent again later
  claude = () => ({ status:400, error:{ type:"error", error:{ type:"invalid_request_error", message:"Your credit balance is too low to access the Anthropic API." } } });
  await s.fill(".xai-in textarea", "Will fail"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(/out of credit/.test(await s.textContent(".xai-a.err")), "out of credit explained");
  claude = () => [{ type:"content_block_delta", delta:{ type:"text_delta", text:"Better now." } }, { type:"message_delta", delta:{ stop_reason:"end_turn" } }];
  await s.click(".xai-a.err button"); await s.waitForTimeout(800);
  check(!(await s.$(".xai-a.err")) && /Better now/.test(await s.evaluate(() => [...document.querySelectorAll(".xai-a")].pop().textContent)), "Try again works");
  const last = asked[asked.length - 1].messages;
  check(last.filter(m => m.content === "Will fail").length === 1 && last[last.length - 1].content === "Will fail", "the retried question is sent once");

  // a refusal
  claude = () => [{ type:"message_delta", delta:{ stop_reason:"refusal" } }];
  await s.fill(".xai-in textarea", "Something it won't do"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(/can't help with that/.test(await s.evaluate(() => [...document.querySelectorAll(".xai-a")].pop().textContent)), "refusal explained");
  claude = () => [{ type:"content_block_delta", delta:{ type:"text_delta", text:"ok" } }, { type:"message_delta", delta:{ stop_reason:"end_turn" } }];
  await s.fill(".xai-in textarea", "Next"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(!asked[asked.length - 1].messages.some(m => /won't do/.test(m.content)), "a refused question isn't sent again");

  // the daily limit (6)
  await s.fill(".xai-in textarea", "One too many"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(/your 6 questions for today/.test(await s.evaluate(() => [...document.querySelectorAll(".xai-a")].pop().textContent)), "daily limit explained");
  check((await s.textContent(".xai-left")) === "0 left today", "0 left");

  // the chat survives the sidebar reloading; New chat clears it
  await s.reload(); await s.waitForTimeout(400);
  check((await s.$$(".xai-q")).length >= 6, "chat kept after reload");
  await s.click(".xai-new"); await s.waitForTimeout(100);
  check((await s.$$(".xai-q")).length === 0 && !!(await s.$(".xai-hello")), "New chat");

  // the server address can come with an update (latest.json) - then only the code is asked for
  await s.evaluate(() => { localStorage.removeItem("wsb.xai"); localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:"https://web-ai.test.workers.dev" })); });
  await s.reload(); await s.waitForTimeout(300);
  check(await s.isVisible("#xaiCode") && !(await s.isVisible("#xaiSrv")), "address from the update: only the code is asked for");
  await s.fill("#xaiCode", "abcd1234efgh"); await s.press("#xaiCode", "Enter"); await s.waitForTimeout(500);
  check(!!(await s.$(".xai-hello")), "connects with the address from the update");
  check(await s.evaluate(() => JSON.parse(localStorage.getItem("wsb.xai")).server === ""), "keeps following the update's address");

  // cloud.js takes the address from latest.json
  await c.evaluate(() => localStorage.removeItem("wsb.xaiConfig"));
  await ctx.route("https://raw.githubusercontent.com/**", r => r.fulfill({ status:200, contentType:"application/json",
    body:JSON.stringify({ version:"3.3.0", notes:[], updater:{ url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe" }, webai:{ server:"https://web-ai.owner.workers.dev/" } }) }));
  await c.evaluate(() => X3.checkUpdate(true)); await c.waitForTimeout(600); await c.evaluate(() => { if (overlay) closeOver(); });
  const cfgSaved = await c.evaluate(() => localStorage.getItem("wsb.xaiConfig"));
  check(cfgSaved === JSON.stringify({ server:"https://web-ai.owner.workers.dev" }), "the server address comes with updates/latest.json: " + cfgSaved);

  // private windows never send the page
  const pc = await ctx.newPage(); watch(pc, errors, "private");
  await pc.goto("https://browser.example/chrome.html?private=1"); await pc.waitForTimeout(200);
  await pc.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/secret", "Secret", 0, 0); __host("tab-selected", 1); });
  await pc.waitForTimeout(300);
  const PW = await pc.evaluate(() => WIN);
  const reply = await s.evaluate(PW => new Promise(res => {
    const on = e => { if (e.key === "wsb.xaiPage." + PW && e.newValue) { removeEventListener("storage", on); res(JSON.parse(e.newValue)); } };
    addEventListener("storage", on);
    localStorage.setItem("wsb.xaiAsk." + PW, JSON.stringify({ n:"t1", t:Date.now() }));
    setTimeout(() => res(null), 2000);
  }), PW);
  check(reply && reply.why === "private" && !reply.text, "private window: page not sent: " + JSON.stringify(reply));
  check(!(await pc.evaluate(() => __sent.some(m => m.indexOf("page-tool") === 0 && m.indexOf("x-ai") > 0))), "private window: the page isn't even read");

  // old asks are ignored
  const stale = await s.evaluate(W => new Promise(res => {
    const on = e => { if (e.key === "wsb.xaiPage." + W && e.newValue) res("answered"); };
    addEventListener("storage", on);
    localStorage.setItem("wsb.xaiAsk." + W, JSON.stringify({ n:"old", t:Date.now() - 60000 }));
    setTimeout(() => res("ignored"), 800);
  }), WIN);
  check(stale === "ignored", "an old request is ignored");

  // shield.js: the x-ai tool returns the text, the selection and the title
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const sp = await ctx.newPage();
  await sp.route("https://test.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>Fox page</title><body><h1>Foxes</h1><p id=p>Foxes eat berries in summer.</p></body>" }));
  await sp.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await sp.addInitScript(shield);
  await sp.goto("https://test.example/x"); await sp.waitForTimeout(200);
  await sp.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"test.example", f:0 }));
  await sp.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById("p")); getSelection().addRange(r); });
  await sp.evaluate(() => window[Symbol.for("wsb.tool")]("x-ai", ""));
  const sr = await sp.evaluate(() => __sent.filter(m => m.startsWith("wsb-page\u0001TK\u0001tool\u0001")).map(m => JSON.parse(m.split("\u0001")[3])).pop());
  check(sr && sr.a === "x-ai" && /Foxes eat berries/.test(sr.t) && sr.sel === "Foxes eat berries in summer." && sr.title === "Fox page", "shield x-ai: " + JSON.stringify(sr));

  // ready by itself (3.3.1): the shared code from the update, no typing
  kv.clear();
  env.WEB_AI_CODES = "Sam=abcd1234efgh,Friend4=shared12345678";
  await s.evaluate(S => { localStorage.removeItem("wsb.xai"); localStorage.removeItem("wsb.xaiChat"); localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S, code:"shared12345678" })); }, SERVER);
  await s.reload(); await s.waitForTimeout(700);
  check(!!(await s.$(".xai-hello .xai-sug")) && !(await s.isVisible("#xaiCode")), "shared code: ready by itself, no setup screen");
  check(/^Web AI$/.test(await s.textContent(".xai-hello h3")), "no 'Hi Friend4' for the shared code");
  check((await s.textContent(".xai-left")) === "6 left today", "shared code: left today shown");
  await s.fill(".xai-in textarea", "Hello"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check(/Better now|ok|foxes/i.test(await s.evaluate(() => [...document.querySelectorAll(".xai-a")].pop().textContent)), "shared code: question answered");
  const dev1 = await s.evaluate(() => JSON.parse(localStorage.getItem("wsb.xaiDev")));
  check(/^[0-9a-f]{30}$/.test(dev1), "a device id is made: " + dev1);
  // the gear still lets someone enter a personal code
  await s.click(".xai-gear"); await s.waitForTimeout(100);
  check(/ready for everyone, no code needed/.test(await s.textContent(".xai-p")) && /Use this code/.test(await s.textContent("#xaiGo")), "settings say no code is needed");
  await s.click("#xaiBack"); await s.waitForTimeout(100);

  // open server (OPEN=true): no code at all, counted per device
  kv.clear(); env.OPEN = "true";
  await s.evaluate(S => { localStorage.removeItem("wsb.xai"); localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S })); }, SERVER);
  await s.reload(); await s.waitForTimeout(700);
  check(await s.evaluate(() => !document.querySelector("#xai").classList.contains("setup")) && JSON.parse(await s.evaluate(() => localStorage.getItem("wsb.xai"))).open === true, "open server: ready by itself without any code");
  await s.fill(".xai-in textarea", "Open question"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  check([...kv.keys()].some(k => /:d[0-9a-f]{16}$/.test(k)) && ![...kv.keys()].some(k => /:p[0-9a-f]{16}$/.test(k)), "open server: counted per device, no code sent");
  // the server stops being open: Web AI falls back to the shared code by itself
  env.OPEN = ""; kv.clear();
  await s.evaluate(S => localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S, code:"shared12345678" })), SERVER);
  await s.fill(".xai-in textarea", "After the change"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(900);
  await s.fill(".xai-in textarea", "Again"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(900);
  check(/ok|Better/i.test(await s.evaluate(() => [...document.querySelectorAll(".xai-a")].pop().textContent)), "falls back to the shared code when the server closes");
  delete env.OPEN;

  // the update file brings the shared code (cloud.js)
  await ctx.unroute("https://raw.githubusercontent.com/**");
  await ctx.route("https://raw.githubusercontent.com/**", r => r.fulfill({ status:200, contentType:"application/json",
    body:JSON.stringify({ version:"3.3.0", notes:[], updater:{ url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe" }, webai:{ server:"https://web-ai.owner.workers.dev", code:"shared12345678" } }) }));
  await c.evaluate(() => X3.checkUpdate(true)); await c.waitForTimeout(600); await c.evaluate(() => { if (overlay) closeOver(); });
  check(await c.evaluate(() => localStorage.getItem("wsb.xaiConfig")) === JSON.stringify({ server:"https://web-ai.owner.workers.dev", code:"shared12345678" }), "the shared code comes with updates/latest.json");

  // dark and light both readable
  kv.clear();
  await s.evaluate(S => { localStorage.setItem("wsb.settings", JSON.stringify({ theme:"light" })); localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S, code:"shared12345678" })); }, SERVER);
  await s.reload(); await s.waitForTimeout(300);
  await s.fill(".xai-in textarea", "Light theme check"); await s.press(".xai-in textarea", "Enter"); await s.waitForTimeout(700);
  await s.screenshot({ path:SHOTS + "webai-light.png" });

  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
