// Help & support end to end on the PC: the browser window (chrome.html), the sidebar
// (side.html#support), the real server code (server/web-ai/worker.js) and the owner's dashboard.
const path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SERVER = "https://web-ai.test.workers.dev";
const PRIVATE = /my-bank|secret-site|private note|Tokyo/;

(async () => {
  const worker = (await import(path.join(ROOT, "..", "server", "web-ai", "worker.js"))).default;
  const kv = new Map(), meta = new Map(), calls = [];
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS:{ get:async k => kv.has(k) ? kv.get(k) : null,
    put:async (k, v, o) => { kv.set(k, v); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); }, delete:async k => { kv.delete(k); meta.delete(k); },
    list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata:meta.get(name) })), list_complete:true }) } };
  const admin = async (op, o = {}) => { const r = await worker.fetch(new Request(SERVER + "/admin", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:"ownercode123", op, ...o }) }), env, { waitUntil(){} }); return { status:r.status, j:await r.json() }; };
  const tk = () => { const k = [...kv.keys()].filter(x => x.startsWith("tku:")).sort((a, b) => JSON.parse(kv.get(b)).created - JSON.parse(kv.get(a)).created)[0]; return k ? JSON.parse(kv.get(k)) : null; };
  let tamper = null;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  await ctx.route(SERVER + "/**", async r => {
    const q = r.request(), pth = new URL(q.url()).pathname;
    if (pth.startsWith("/support")) calls.push({ path:pth, body:JSON.parse(q.postData() || "{}") });
    const res = await worker.fetch(new Request(q.url(), { method:q.method(), headers:q.headers(), body:q.method() === "POST" ? q.postData() : undefined }), env, { waitUntil(){} });
    let body = await res.text();
    if (tamper && pth === "/support/poll") { const j = JSON.parse(body); j.changes = (j.changes || []).concat(tamper); body = JSON.stringify(j); }
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    r.fulfill({ status:res.status, headers, body });
  });
  await ctx.addInitScript(S => {
    if (location.hostname !== "browser.example" || localStorage.getItem("wsb.xaiConfig")) return;
    localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S }));
    localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark", wxCity:"Tokyo" }));
    localStorage.setItem("wsb.bookmarks", JSON.stringify([{ u:"https://my-bank.example/", t:"My bank" }]));
    localStorage.setItem("wsb.history", JSON.stringify([{ u:"https://secret-site.example/x", t:"Secret", ts:1 }]));
    localStorage.setItem("wsb.notes", JSON.stringify([{ id:"a", title:"private note", text:"private note", ts:1 }]));
    localStorage.setItem("wsb.vpn", JSON.stringify({ phost:"10.1.2.3", puser:"me" }));
  }, SERVER);

  // the browser window
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(300);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
  await wait(300); await c.evaluate(() => { if (overlay) closeOver(); });
  const WIN = await c.evaluate(() => WIN);
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Help & support/.test(m.textContent); }), "the menu has Help & support");
  check(await c.evaluate(() => commands().some(x => /^Help & support/.test(x.t))), "and the command palette");
  check(await c.evaluate(() => document.querySelector(".suppill").classList.contains("hide")), "no 🛟 in the toolbar: nobody is connected");
  await c.evaluate(() => { __sent.length = 0; openSide("support"); });
  check(await c.evaluate(W => __sent.some(m => m === "side-open\u0001https://browser.example/side.html?w=" + W + "#support"), WIN), "it opens in the sidebar");

  // the sidebar
  const s = await ctx.newPage(); watch(s, errors, "side");
  await s.setViewportSize({ width:380, height:760 });
  await s.goto("https://browser.example/side.html?w=" + WIN + "#support"); await wait(400);
  check(await s.evaluate(() => document.querySelector("#support").classList.contains("on") && /How can we help/.test(document.querySelector("#support").textContent)), "the Help & support pane is showing");
  check(await s.evaluate(() => /Never your history, bookmarks, tabs, passwords/.test(document.querySelector(".sup-safe").textContent)), "it says what support never sees");
  check(await s.evaluate(() => !document.querySelector(".sup-acc input").checked), "settings access is off to start");
  await s.evaluate(() => document.querySelector(".sup-what").open = true);
  await s.screenshot({ path:SHOTS + "support-side-start.png" });

  await s.fill("#support textarea", "Videos won't play and pages look broken");
  await s.press("#support textarea", "Enter"); await wait(3000);
  let u = tk();
  check(u && u.platform === "windows" && u.version === require("fs").readFileSync(path.join(ROOT, "VERSION"), "utf8").trim() && u.access === 0, "the chat reached support, with the version, without access");
  check(u.snap && u.snap.theme === "dark" && u.snap.on === true && u.snap.kill === true && u.snap.sleep === 30 && u.snap.search === "ddg", "the browser window sent the settings on the list: " + JSON.stringify(u.snap));
  check(!/phost|puser|10\.1\.2\.3|dldir|home|wxCity/.test(JSON.stringify(u.snap)), "nothing typed in (no VPN server, no home page, no city)");
  check(!PRIVATE.test(JSON.stringify([...kv.values()])) && !calls.some(x => PRIVATE.test(JSON.stringify(x.body))), "no bookmarks, history, notes or city ever sent");
  const id = u.id;
  let r = await admin("set", { id, k:"theme", v:"light" });
  check(r.status === 403, "support can't change anything before they allow it");
  await admin("reply", { id, text:"Hi! Can you turn on the switch so I can check your Shield settings?" });
  await wait(5000);
  check(await s.evaluate(() => { const a = document.querySelector("#support .sup-a"); return a && /Shield settings/.test(a.textContent); }), "the reply shows in the sidebar");

  // they allow it
  await s.click(".sup-acc .sup-sw"); await wait(1200);
  check(tk().access > Date.now() + 29 * 60000, "settings access for 30 minutes");
  await wait(600);
  check(await c.evaluate(() => { const p = document.querySelector(".suppill"); return !p.classList.contains("hide") && /Support · 30 min/.test(p.textContent); }), "the toolbar shows 🛟 Support · 30 min");

  // the owner changes five settings
  for (const [k, v] of [["theme", "light"], ["on", false], ["sleep", 60], ["kill", false], ["search", "google"]]) { r = await admin("set", { id, k, v }); check(r.j.ok, "set " + k); }
  r = await admin("set", { id, k:"phost", v:"6.6.6.6" });
  check(r.status === 400, "the server refuses a VPN server");
  await c.evaluate(() => { __sent.length = 0; });
  await wait(4800);
  const got = await c.evaluate(() => ({ theme:cfg.theme, on:sh.on, sleep:cfg.sleep, kill:vcfg.kill, search:cfg.search, stored:JSON.parse(localStorage.getItem("wsb.shield")).on,
    sentTheme:__sent.includes("theme\u0001light"), sentShield:__sent.some(m => m.startsWith("shield-config") && JSON.parse(m.split("\u0001")[1]).on === false), sentVpn:__sent.some(m => m.startsWith("vpn-config") && JSON.parse(m.split("\u0001")[1]).kill === false), body:document.documentElement.dataset.theme || document.body.className }));
  check(got.theme === "light" && got.on === false && got.sleep === 60 && got.kill === false && got.search === "google" && got.stored === false, "the browser applied them, as the right types: " + JSON.stringify(got));
  check(got.sentTheme && got.sentShield && got.sentVpn, "and told the host (theme, Shield, VPN): " + JSON.stringify(got));
  check(await c.evaluate(() => /Support changed 5 settings/.test(document.querySelector("#toast").textContent) && /Undo/.test(document.querySelector("#toast").textContent)), "a toast says so, with Undo");
  check(await s.evaluate(() => [...document.querySelectorAll("#support .sup-n")].map(n => n.textContent).join("|")).then(t => /turned off Shield/.test(t) && /Sleeping tabs to After 1 hour/.test(t) && /Search engine to Google/.test(t)), "each change is written in the chat");
  await c.screenshot({ path:SHOTS + "support-chrome.png", clip:{ x:0, y:0, width:1280, height:90 } });
  await s.screenshot({ path:SHOTS + "support-side-chat.png" });
  await wait(4500);
  r = await admin("ticket", { id });
  check(r.j.settings.theme === "light" && r.j.settings.on === false && r.j.settings.sleep === 60 && r.j.changes.every(x => x.done), "the dashboard sees the new settings, and the changes as done");

  // Undo
  await c.evaluate(() => { __sent.length = 0; });
  await c.click("#toast button"); await wait(400);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("shield-config") && JSON.parse(m.split("\u0001")[1]).on === true) && __sent.some(m => m.startsWith("vpn-config") && JSON.parse(m.split("\u0001")[1]).kill === true)), "the host hears about the Undo too");
  check(await c.evaluate(() => cfg.theme === "dark" && sh.on === true && cfg.sleep === 30 && vcfg.kill === true && cfg.search === "ddg"), "Undo puts all five back");
  await wait(4500);
  check(tk().snap.on === true && tk().snap.theme === "dark", "and support sees it");

  // light by day, dark after sunset (kept as themeMode, like Settings does)
  await admin("set", { id, k:"theme", v:"auto" }); await wait(4600);
  check(await c.evaluate(() => cfg.themeMode === "auto" && (cfg.theme === "light" || cfg.theme === "dark")), "theme → auto");
  // the VPN: disconnect
  await c.evaluate(() => { __host("vpn-status", JSON.stringify({ state:"on", mode:"tor", since:Date.now() })); __sent.length = 0; });
  await admin("set", { id, k:"vpnOff", v:true }); await wait(4600);
  check(await c.evaluate(() => __sent.includes("vpn-connect\u0001off")), "Disconnect the VPN");

  // a server that misbehaves still can't change anything off the list
  tamper = [{ id:"evil0001", k:"home", v:"https://evil.example", ts:Date.now() }, { id:"evil0002", k:"phost", v:"6.6.6.6", ts:Date.now() }, { id:"evil0003", k:"search", v:"custom", ts:Date.now() },
            { id:"evil0004", k:"textSize", v:"xl", ts:Date.now() }, { id:"evil0005", k:"dldir", v:"C:\\evil", ts:Date.now() }, { id:"evil0006", k:"on", v:"no", ts:Date.now() }, { id:"evil0007", k:"vpnOff", v:false, ts:Date.now() }];
  await c.evaluate(() => { __sent.length = 0; });
  await wait(4600); tamper = null;
  const safe = await c.evaluate(() => ({ home:cfg.home, phost:vcfg.phost, search:cfg.search, ts:cfg.textSize, dldir:cfg.dldir, on:sh.on, vpn:__sent.filter(m => m.startsWith("vpn-connect")) }));
  check(safe.home === "" && safe.phost === "10.1.2.3" && safe.search === "ddg" && safe.ts === undefined && safe.dldir === "" && safe.on === true && !safe.vpn.length, "the browser ignores changes that aren't on its own list: " + JSON.stringify(safe));

  // a second window doesn't ask the server too
  const c2 = await ctx.newPage(); watch(c2, errors, "chrome2");
  await c2.goto("https://browser.example/chrome.html"); await wait(600);
  const n0 = calls.filter(x => x.path === "/support/poll").length;
  await c2.evaluate(() => WebsSupport.poll()); await wait(300);
  check(calls.filter(x => x.path === "/support/poll").length === n0 && await c2.evaluate(() => !document.querySelector(".suppill").classList.contains("hide")), "a second window shows 🛟 but leaves asking to the first");
  await c2.close();

  // ✕ on the 🛟 ends access
  await c.click(".suppill .supx"); await wait(900);
  check(tk().access === 0 && await c.evaluate(() => document.querySelector(".suppill").classList.contains("hide")), "✕ ends support's access");
  r = await admin("set", { id, k:"theme", v:"light" });
  check(r.status === 403, "support can't change anything now");
  await wait(500);
  check(await s.evaluate(() => !document.querySelector(".sup-acc input").checked), "the sidebar's switch is off too");

  // the dashboard: the mini Windows screen
  await s.click(".sup-acc .sup-sw"); await wait(1200);
  const d = await ctx.newPage(); watch(d, errors, "dashboard");
  await d.setViewportSize({ width:1200, height:900 });
  await d.goto(SERVER + "/admin"); await d.fill("#code", "ownercode123"); await d.click("#go"); await wait(1000);
  await d.evaluate(i => openTicket(i), id); await wait(1200);
  const dash = await d.evaluate(() => ({ dev:document.querySelector("#sdev").className, sets:document.querySelectorAll("#ssets .set").length, groups:[...document.querySelectorAll("#ssets h4")].map(h => h.textContent).join(","), acc:document.querySelector("#sacc").textContent }));
  check(/windows/.test(dash.dev) && dash.sets === 22 && /Shield/.test(dash.groups) && /VPN/.test(dash.groups) && /min left/.test(dash.acc), "the dashboard shows the mini PC screen: " + JSON.stringify(dash));
  check(await d.evaluate(() => !/my-bank|secret-site|private note|Tokyo|10\.1\.2\.3/.test(document.body.innerText)), "and nothing else about them");
  // turn the Shield's pop-up blocker off from the mini screen
  await d.evaluate(() => { const row = [...document.querySelectorAll("#ssets .set")].find(x => x.querySelector(".l").textContent === "Block pop-ups"); row.querySelector(".tg").click(); });
  await wait(5000);
  check(await c.evaluate(() => sh.popups === false), "flipped on the mini screen → flipped in the browser");
  await d.evaluate(() => document.querySelector("#sview").scrollIntoView()); await wait(300);
  await d.screenshot({ path:SHOTS + "support-dashboard-windows.png" });

  // they end the chat
  await s.click(".sup-end"); await s.click(".sup-yes"); await wait(900);
  check(tk().open === false && await s.evaluate(() => !!document.querySelector(".sup-new") && /You ended this chat/.test(document.querySelector("#support .sup-log").textContent)), "End chat ends it on both sides");
  r = await admin("set", { id, k:"popups", v:true });
  check(r.status === 409, "nothing can be changed in an ended chat");
  const n1 = calls.filter(x => x.path === "/support/poll").length; await wait(5000);
  check(calls.filter(x => x.path === "/support/poll").length === n1, "and the browser stops asking the server");

  check(errors.length === 0, "no page errors: " + errors.join(" | "));
  console.log(ok + " passed, " + bad + " failed");
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); console.error("page errors:", errors.join(" | ")); process.exit(1); });
