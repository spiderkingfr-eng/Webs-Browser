// The owner's tools (Windows 3.10, iPhone 2.9; ../js/stats.js, ../server/web-ai/ledger.js), end to end: the apps' daily counts and
// errors, an A/B test, invites, the wallpaper gallery, scheduled posts and the dashboard's Insights - with the real server code
// running here in Node behind https://w.test/.
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const worker = (await import(pathToFileURL(path.join(APP, "server", "web-ai", "worker.js")).href)).default;
  const { Ledger } = await import(pathToFileURL(path.join(APP, "server", "web-ai", "ledger.js")).href);
  const kv = new Map(), meta = new Map(), store = new Map();
  const LIMITS = { get:async (k, o) => kv.has(k) ? (o && o.type === "arrayBuffer" ? kv.get(k) : kv.get(k)) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:meta.get(k) ?? null }),
    put:async (k, v, o) => { kv.set(k, v); if (o && o.metadata) meta.set(k, o.metadata); }, delete:async k => { kv.delete(k); meta.delete(k); },
    list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata:meta.get(name) })), list_complete:true }) };
  const ledger = new Ledger({ storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete:async k => store.delete(k),
    list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || "")).sort()) } }, {});
  const LEDGER = { idFromName:n => n, get:() => ({ fetch:(u, init) => ledger.fetch(new Request("https://ledger/run", init)) }) };
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, LEDGER };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => { u = String(u); if (/updates\/(latest|iphone)\.json/.test(u)) return new Response("{}", { status:200 }); return new Response("{}", { status:404 }); };
  const sent = [];
  async function serve(r) {
    const q = r.request(), u = q.url(), body = q.postData();
    if (q.method() === "POST") { try { sent.push({ path:new URL(u).pathname, body:JSON.parse(body) }); } catch (e) {} }
    const headers = Object.assign({}, q.headers(), { origin:/app\.example/.test(q.headers().origin || "") ? "https://spiderkingfr-eng.github.io" : q.headers().origin || "https://browser.example" });
    const res = await worker.fetch(new Request(u, { method:q.method(), headers, body:q.method() === "POST" ? body : undefined }), env, { waitUntil(){} });
    const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); h["access-control-allow-origin"] = "*";
    r.fulfill({ status:res.status, headers:h, body:Buffer.from(await res.arrayBuffer()) });
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  await ctx.route("https://w.test/**", serve);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await ctx.addInitScript(() => { try { if (/browser\.example|app\.example/.test(location.hostname) && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });

  /* ---------------------------------------------------------------- the PC: counts, errors, an A/B test */
  const pc = await ctx.newPage(); watch(pc, errors, "pc");
  await pc.goto("https://browser.example/chrome.html"); await wait(500);
  await pc.evaluate(() => { __host("viewport", 1280, 820); __host("tab-created", 1, 0, "https://news.example/", "", 0, 0); __host("tab-selected", 1); if (overlay) closeOver();
    X3.privacy.privacyPanel(); closeOver(); send("page-tool", 1, "x-md", ""); send("page-tool", 1, "x-md", ""); send("page-tool", 1, "init", "{}"); Stats.err("TypeError: oops is undefined", "chrome.html:42"); Stats.err("TypeError: oops is undefined", "chrome.html:42"); });
  await wait(1700);
  const b = await pc.evaluate(() => Stats.buf());
  check(b.uses["p.pvmenu"] === 1 && b.uses["t.x-md"] === 2 && !b.uses["t.init"], "panels and page tools counted (not the automatic ones): " + JSON.stringify(b.uses));
  check(b.errors.length === 1 && b.errors[0].n === 2, "errors counted");
  // an announcement with two versions
  const ab = await pc.evaluate(() => {
    localStorage.setItem("wsb.live", JSON.stringify({ at:Date.now(), d:{ ok:true, ann:{ id:"abtest01", text:"Version A words", textB:"Version B words", link:"https://example.com/a", linkB:"https://example.com/b", react:true } } }));
    const d = document.createElement("div"); document.body.appendChild(d); Live.render(d);
    const want = (parseInt(Live.dev ? Live.dev().slice(-6) : JSON.parse(localStorage.getItem("wsb.xaiDev")).slice(-6), 16) + 8) % 2;
    const t = d.textContent; const a = d.querySelector(".lv-ann a"); a.click(); d.remove();
    return { t, want };
  });
  check(ab.want === 1 ? /Version B words/.test(ab.t) : /Version A words/.test(ab.t), "an A/B test: this device sees version " + (ab.want ? "B" : "A"));
  await wait(1700);
  check(await pc.evaluate(() => { const x = Stats.buf().ab.abtest01; return x && x.seen && x.click && /^[AB]$/.test(x.v); }), "what it saw and clicked is counted");
  await pc.evaluate(() => Stats.flush(true)); await wait(300);
  const st = sent.find(s => s.path === "/stats");
  check(st && st.body.platform === "windows" && /^\d+\.\d+\.\d+$/.test(st.body.version) && st.body.uses["t.x-md"] === 2 && st.body.errors[0].m === "TypeError: oops is undefined" && st.body.ab[0].id === "abtest01", "sent once a day to the server");
  check(await pc.evaluate(() => Object.keys(Stats.buf().uses).length === 0 && localStorage.getItem("wsb.statSent")), "and started again");
  await pc.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings") || "{}"); s.liveCounts = false; localStorage.setItem("wsb.settings", JSON.stringify(s)); Stats.use("x"); });
  await wait(1700);
  check(await pc.evaluate(() => !Stats.buf().uses.x), "with “Send anonymous counts” off, nothing is counted");
  await pc.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings") || "{}"); s.liveCounts = true; localStorage.setItem("wsb.settings", JSON.stringify(s)); });

  /* ---------------------------------------------------------------- invites */
  await pc.evaluate(() => X3.stats.invitePanel());
  check(await until(pc, () => /#invite=[a-z0-9]{8}$/.test((document.querySelector("#stinvite .stlink input") || {}).value || "")), "the PC's invite link");
  const link = await pc.evaluate(() => document.querySelector("#stinvite .stlink input").value), code = link.split("=")[1];
  check(await pc.evaluate(() => /Nobody has used it yet/.test(document.querySelector("#stinvite").textContent)), "nobody yet");
  await pc.screenshot({ path:SHOTS + "owner-invite.png" });
  const ph = await ctx.newPage(); watch(ph, errors, "phone");
  await ph.setViewportSize({ width:390, height:844 });
  await ph.goto("https://app.example/index.html#invite=" + code); await wait(1500);
  check(await ph.evaluate(c => JSON.parse(localStorage.getItem("wsb.inviteWait")) === c && !/invite=/.test(location.hash), code), "a friend opens the invite: kept to claim");
  await ph.evaluate(c => Stats.claim(c), code);
  check(await ph.evaluate(() => !!(JSON.parse(localStorage.getItem("wsb.liveAch") || "{}")).invited), "the friend gets “Welcome in”");
  await pc.evaluate(() => { closeOver(); X3.stats.invitePanel(); });
  check(await until(pc, () => /1 friend has joined/.test(document.querySelector("#stinvite").textContent)), "the inviter sees it");
  check(await pc.evaluate(() => !!(JSON.parse(localStorage.getItem("wsb.liveAch") || "{}"))["invite-friend"]), "and gets “Bring a friend”");
  check(await pc.evaluate(async c => { try { await Stats.claim(c); return false; } catch (e) { return /own invite/.test(e.message); } }, code), "your own invite doesn't count");

  /* ---------------------------------------------------------------- the gallery: share, approve, use */
  await pc.evaluate(() => { closeOver(); X3.stats.sharePanel(); });
  const png = await pc.evaluate(() => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 320, 200); gr.addColorStop(0, "#3b1e7a"); gr.addColorStop(1, "#e8342a"); g.fillStyle = gr; g.fillRect(0, 0, 320, 200); return c.toDataURL("image/png").split(",")[1]; });
  await pc.setInputFiles("#stshare input[type=file]", { name:"night.png", mimeType:"image/png", buffer:Buffer.from(png, "base64") });
  await pc.fill("#stshare .st-t", "Night city"); await pc.fill("#stshare .st-by", "Sam");
  await until(pc, () => document.querySelector("#stshare .stprev").classList.contains("on"));
  await pc.evaluate(() => document.querySelector("#stshare .xbtns button").click());
  check(await until(pc, () => /It shows in the gallery once it's approved/.test(document.getElementById("toast").textContent)), "a wallpaper shared from the PC");
  const gs = sent.find(s => s.path === "/gallery/send");
  check(gs && /^data:image\/jpeg;base64,/.test(gs.body.img) && gs.body.title === "Night city", "sent as a JPEG");
  await pc.evaluate(() => X3.stats.galleryPanel());
  check(await until(pc, () => /Nothing in the gallery yet/.test(document.querySelector("#stgallery").textContent)), "not in the gallery before it's approved");

  /* ---------------------------------------------------------------- the dashboard */
  const d = await ctx.newPage(); watch(d, errors, "dashboard");
  await d.goto("https://w.test/admin"); await wait(400);
  await d.fill("#code input, input#code", "ownercode123").catch(() => {});
  await d.evaluate(() => { const i = document.querySelector('input[type="password"]'); i.value = "ownercode123"; document.getElementById("go").click(); });
  check(await until(d, () => !!document.querySelector('#tabs [data-tab="insights"]')), "the dashboard has Insights");
  await d.evaluate(() => document.querySelector('#tabs [data-tab="insights"]').click());
  check(await until(d, () => /oops is undefined/.test(document.getElementById("pane-insights").textContent)), "Insights: the PC's error");
  check(await d.evaluate(() => /t\.x-md/.test(document.getElementById("pane-insights").textContent) && /abtest01|Announcement/.test(document.getElementById("pane-insights").textContent) && /friends joined/.test(document.getElementById("pane-insights").textContent)),
    "features used, the A/B test and invites");
  await d.screenshot({ path:SHOTS + "owner-insights.png", fullPage:true });
  await d.evaluate(() => document.querySelector('#tabs [data-tab="live"]').click());
  await until(d, () => [...document.querySelectorAll("#pane-live summary")].some(s => /Wallpaper gallery/.test(s.textContent)));
  await wait(500);
  await d.evaluate(() => [...document.querySelectorAll("#pane-live details.fold")].find(x => /Wallpaper gallery/.test(x.querySelector("summary").textContent)).querySelector("summary").click());
  check(await until(d, () => /Waiting \(1\)/.test(document.getElementById("pane-live").textContent) && /by Sam/.test(document.getElementById("pane-live").textContent)), "the shared wallpaper waits for the owner");
  await d.evaluate(() => [...document.querySelectorAll("#pane-live .gal button")].find(b => b.textContent === "Approve").click());
  check(await until(d, () => /In the gallery \(1\)/.test(document.getElementById("pane-live").textContent)), "approved");
  // a scheduled post
  await d.evaluate(() => { const f = [...document.querySelectorAll("#pane-live details.fold")].find(x => /Scheduled posts/.test(x.querySelector("summary").textContent)); f.open = true;
    const ins = f.querySelectorAll("input"); ins[0].value = "🎉 The summer sale starts now!"; const t = new Date(Date.now() + 2 * 3600000); ins[2].value = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0") + "T" + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
    [...f.querySelectorAll("button")].find(b => b.textContent === "Schedule it").click(); });
  check(await until(d, () => /🕒 .*summer sale/.test(document.getElementById("pane-live").textContent)), "a post scheduled for later");
  await d.screenshot({ path:SHOTS + "owner-live.png", fullPage:true });
  check(await d.evaluate(async () => { const r = await fetch("/live"); const j = await r.json(); return !j.ann; }), "not up yet");

  /* ---------------------------------------------------------------- everyone's gallery */
  await pc.evaluate(() => { closeOver(); X3.stats.galleryPanel(); });
  check(await until(pc, () => document.querySelectorAll("#stgallery .stw").length === 1), "approved: in the PC's gallery");
  await pc.screenshot({ path:SHOTS + "owner-gallery.png" });
  await pc.evaluate(() => document.querySelector("#stgallery .stw").click());
  check(await pc.evaluate(() => (JSON.parse(localStorage.getItem("wsb.galleryBg")) || {}).title === "Night city"), "picked for the new tab page");
  const nt = await ctx.newPage(); watch(nt, errors, "newtab");
  await nt.goto("https://browser.example/newtab.html"); await wait(800);
  check(await nt.evaluate(() => { const g = document.getElementById("galbg"); return g && /\/gallery\/img\//.test(g.querySelector(".pic").style.backgroundImage) && /by Sam/.test(g.textContent) && document.body.classList.contains("pic"); }), "and shows there, with who shared it");
  await nt.screenshot({ path:SHOTS + "owner-newtab.png" });
  await nt.close();
  await ph.evaluate(() => StatsApp.gallerySheet());
  check(await until(ph, () => document.querySelectorAll("#sheetBody .stw").length === 1), "and the iPhone's");
  await ph.evaluate(() => document.querySelector("#sheetBody .stw").click());
  check(await until(ph, () => document.body.classList.contains("pic") && cfg.mbg === true), "a gallery wallpaper as the iPhone's background");
  await ph.screenshot({ path:SHOTS + "owner-app-bg.png" });

  /* ---------------------------------------------------------------- the changelog */
  const html = fs.readFileSync(path.join(APP, "changelog.html"), "utf8");
  check(/Windows 3\.9/.test(html) && /iPhone 2\.8/.test(html) && /changes, newest first/.test(html), "the public changelog lists both apps' versions");
  const cl = await ctx.newPage(); watch(cl, errors, "changelog");
  await cl.goto("https://app.example/changelog.html"); await wait(300);
  await cl.evaluate(() => document.querySelector('nav [data-t="ios"]').click());
  check(await cl.evaluate(() => document.getElementById("win").classList.contains("hide") && !document.getElementById("ios").classList.contains("hide")), "with a tab for each app");
  await cl.close();

  globalThis.fetch = realFetch;
  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load resource/.test(e));
  console.log(real.length ? "errors:\n  " + real.join("\n  ") : "errors: none");
  check(!real.length, "no page errors: " + real.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();


