// "From Webs" on the PC (Webs 3.7) end to end, against the real server code (server/web-ai):
// the new tab page's cards, the calling card, the owner's quote and wallpaper, secret words and the
// code hunt in the address bar, special achievements, the games page (the owner's word, the
// leaderboard, the community goal), help articles, problem reports and rating in the sidebar,
// "Send anonymous counts", and the update button following a gradual rollout and going back.
const path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SERVER = "https://web-ai.test.workers.dev";
const day = n => { const d = new Date(Date.now() + n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

(async () => {
  const worker = (await import(path.join(ROOT, "..", "server", "web-ai", "worker.js"))).default;
  const kv = new Map(), meta = new Map(), calls = [];
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS:{ get:async k => kv.has(k) ? kv.get(k) : null,
    getWithMetadata:async k => ({ value:kv.has(k) ? kv.get(k) : null, metadata:meta.get(k) || null }),
    put:async (k, v, o) => { kv.set(k, v); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); }, delete:async k => { kv.delete(k); meta.delete(k); },
    list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata:meta.get(name) })), list_complete:true }) } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, i) => /api\.anthropic\.com/.test(String(u)) ? new Response("{}") : realFetch(u, i);
  const W = async (p, body) => { const r = await worker.fetch(new Request(SERVER + p, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) }), env, { waitUntil(){} }); return r.json(); };
  const trust = (await W("/admin", { code:"ownercode123", op:"hello" })).trust;
  const admin = (op, o = {}) => W("/admin", { code:"ownercode123", trust, op, ...o });
  // a picture for the wallpaper: a tiny PNG
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4AWP4z8DwnwEIGBgYGBgYAAAj8gP9pBsJ7QAAAABJRU5ErkJggg==";
  const img = (await admin("img.put", { kind:"wall", data:"data:image/png;base64," + png })).id;
  await admin("live.set", { live:{
    ann:{ text:"New games this Friday!", react:true }, card:{ title:"TAKE YOUR TIME", text:"We will steal your boredom on Friday.", sign:"The Phantom Thieves" },
    poll:{ q:"Which game next?", opts:["Tetris", "Chess"] }, countdown:{ label:"Christmas", date:"2026-12-25", emoji:"🎄" }, pick:{ url:"https://example.org/", title:"Example", note:"A classic" },
    quotes:[{ date:day(0), text:"Steal their hearts.", by:"Joker" }], trivia:[{ date:day(0), q:"How many legs has a spider?", opts:["6", "8", "10"], a:1 }],
    themes:[{ date:day(0), kind:"snow" }], words:[{ date:day(0), w:"heist" }],
    goal:{ label:"500 Snake games together", game:"snake", target:500 }, hunt:{ code:"Phantom2026", hint:"It's in this week's news." },
    secrets:[{ word:"joker", fx:"confetti" }], ach:[{ emoji:"🎃", name:"Spooky visitor", desc:"Opened Webs this week", from:Date.now() - 3600000, until:Date.now() + 86400000 }],
    wall:{ id:img, credit:"Test picture" }, faq:[{ q:"How do I update?", a:"Menu → What's new, or click Update when it shows." }] } });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  let manifest = null, updStatus = null;
  await ctx.route(/^https:\/\/raw\.githubusercontent\.com\/spiderkingfr-eng\/Webs-Browser\/main\/updates\/latest\.json/, r =>
    manifest ? r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(manifest) }) : r.fulfill({ status:404, body:"" }));
  await ctx.route("https://browser.example/user/webs-update.json*", r => updStatus ? r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(updStatus) }) : r.fulfill({ status:404, body:"" }));
  await ctx.route(SERVER + "/**", async r => {
    const q = r.request(), cors = { "access-control-allow-origin":"*", "access-control-allow-headers":"content-type" };
    if (q.method() === "OPTIONS") return r.fulfill({ status:204, headers:cors });
    const pth = new URL(q.url()).pathname;
    calls.push({ path:pth, body:q.postData() ? (() => { try { return JSON.parse(q.postData()); } catch (e) { return null; } })() : null });
    const req = new Request(q.url(), { method:q.method(), headers:q.headers(), body:q.method() === "POST" ? q.postData() : undefined });
    Object.defineProperty(req, "cf", { value:{ country:"FR" } });
    const res = await worker.fetch(req, env, { waitUntil(){} });
    const headers = { ...cors }; res.headers.forEach((v, k) => { if (k !== "access-control-allow-origin") headers[k] = v; });
    r.fulfill({ status:res.status, headers, body:Buffer.from(await res.arrayBuffer()) });
  });
  await ctx.addInitScript(S => {
    if (location.hostname !== "browser.example" || localStorage.getItem("wsb.xaiConfig")) return;
    localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S }));
    localStorage.setItem("wsb.settings", JSON.stringify({ theme:"dark" }));
  }, SERVER);

  /* ---------------------------------------------------------------- the browser window */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(300);
  await c.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
  await wait(1200); await c.evaluate(() => { if (overlay) closeOver(); });
  const VER = await c.evaluate(() => X3.version);
  const ping = calls.find(x => x.path === "/live/ping");
  check(ping && ping.body.platform === "windows" && ping.body.version === VER && !/example\.com/.test(JSON.stringify(ping.body)), "the window checks in (version only): " + JSON.stringify(ping && ping.body));
  check(await c.evaluate(() => !!Live.data().ann), "it knows what's on");
  // 3.7.1: the calling card covers the whole window, whatever page is open
  await c.waitForSelector(".lv-cc", { timeout:12000 }).catch(() => {});
  const full = await c.evaluate(() => Math.round(innerHeight * devicePixelRatio));
  check(await c.evaluate(() => !!document.querySelector(".lv-cc")), "the window shows the calling card over the page");
  check(await c.evaluate(F => __sent.some(m => m.startsWith("layout\u0001" + F + "\u0001" + F + "\u0001")), full), "covering the whole window");
  await c.screenshot({ path:SHOTS + "live-win-card.png" });
  await c.evaluate(() => { __sent.length = 0; }); await c.click(".lv-cc"); await wait(700);
  check(await c.evaluate(F => !document.querySelector(".lv-cc") && __sent.some(m => m.startsWith("layout\u0001") && !m.startsWith("layout\u0001" + F + "\u0001")), full), "a click gives the window back");
  // then the announcement, once, as a panel at the top right
  await c.waitForSelector("#lvann", { timeout:6000 }).catch(() => {});
  check(/New games this Friday/.test(await c.evaluate(() => (document.querySelector("#lvann") || {}).textContent || "")), "then the announcement opens in the window");
  await c.screenshot({ path:SHOTS + "live-win-ann.png" });
  await c.click("#lvann .lvann-r button:has-text('👍')"); await wait(400);
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "react" && x.body.emoji === "👍"), "a reaction from the panel");
  await c.click("#lvann button:has-text('Got it')"); await wait(300);
  check(await c.evaluate(() => !document.querySelector("#lvann") && !!Live.seen().ann[Live.data().ann.id]), "Got it closes it, here and on the new tab page");
  check(await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.liveWinAnn")).includes(Live.data().ann.id)), "and it won't open again");
  // 3.7.3: news sent to everyone (a notification on iPhones) opens once in the window too
  await worker.fetch(new Request(SERVER + "/push/key"), env, { waitUntil(){} });
  check((await admin("push", { title:"Pong is here!", text:"Open Games and try it.", url:"https://example.org/pong", started:Date.now() })).done, "news sent from the dashboard");
  await c.evaluate(() => Live.refresh(true)); await c.waitForSelector("#lvnews", { timeout:8000 }).catch(() => {});
  check(/Pong is here!/.test(await c.evaluate(() => (document.querySelector("#lvnews") || {}).textContent || "")) && /Open Games/.test(await c.evaluate(() => (document.querySelector("#lvnews") || {}).textContent || "")), "the news opens in the window");
  await c.screenshot({ path:SHOTS + "live-win-news.png" });
  await c.click("#lvnews button:has-text('OK')"); await wait(300);
  check(await c.evaluate(() => !document.querySelector("#lvnews") && JSON.parse(localStorage.getItem("wsb.liveWinNews")).includes(Live.data().news.id)), "once");
  // the 📣 button: everything from the dashboard, whatever the start page
  check(await c.evaluate(() => { const b = document.querySelector(".lvb"); return !!b && !b.classList.contains("hide") && b.classList.contains("new"); }), "the 📣 button, with a dot for something new");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /From Webs/.test(m.textContent); }), "and From Webs in the menu");
  await c.click(".lvb"); await wait(900);
  const lvp = await c.evaluate(() => (document.querySelector("#lvp") || {}).textContent || "");
  check(/Updated (just now|\d+ min ago)/.test(lvp), "the panel says it's up to date: " + lvp.slice(0, 120));
  check(/Pong is here!/.test(lvp) && /Which game next/.test(lvp) && /How many legs/.test(lvp) && /until Christmas/.test(lvp) && /mystery box/i.test(lvp) && /Pick of the week/.test(lvp) && /500 Snake games together/.test(lvp) && /Steal their hearts/.test(lvp), "the panel has the news, the poll, trivia, the countdown, the mystery box, the pick, the goal and the quote");
  await c.screenshot({ path:SHOTS + "live-win-panel.png" });
  await c.click("#lvp .lv-trivia button:has-text('8')"); await wait(500);
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "trivia" && x.body.choice === 1), "answering trivia in the panel");
  check(await c.evaluate(() => !document.querySelector(".lvb").classList.contains("new")), "the dot goes once it's been looked at");
  // when the PC can't reach the server, the panel says so
  await c.evaluate(() => { localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:"https://nowhere.invalid" })); });
  await c.evaluate(() => Live.refresh(true)); await wait(800); await c.evaluate(() => { closeOver(); X3.fromWebs(); }); await wait(600);
  check(/Couldn't reach Webs's server/.test(await c.textContent("#lvp .lvp-st")), "it says when the server can't be reached: " + await c.textContent("#lvp .lvp-st"));
  await c.evaluate(S => { localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S })); closeOver(); }, SERVER);
  await c.evaluate(() => Live.refresh(true)); await wait(400);
  // a secret word: the effect plays on a new tab page
  await c.evaluate(() => { __sent.length = 0; go("Joker"); }); await wait(500);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("new-tab\u0001https://browser.example/newtab.html#lvfx=confetti"))), "a secret word opens its effect: " + (await c.evaluate(() => __sent.join(" | "))));
  check(/secret word/.test(await c.textContent("#toast")), "and says so");
  check(await c.evaluate(() => !document.querySelector(".lv-fx")), "no effect under the web pages in the window itself");
  // the hunt's code
  await c.evaluate(() => { __sent.length = 0; go("phantom2026"); }); await wait(700);
  check(await c.evaluate(() => __sent.some(m => /newtab\.html#lvfx=fireworks/.test(m))), "the hunt's code: fireworks");
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "found" && x.body.code === "phantom2026"), "the find is counted");
  check(await c.evaluate(() => !!(JSON.parse(localStorage.getItem("wsb.liveAch")) || {})["hunt-" + Live.data().hunt.id]), "Code breaker unlocked");
  // anything else is searched as usual
  await c.evaluate(() => { __sent.length = 0; go("cute cats"); }); await wait(400);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("navigate\u00011\u0001") && /cute%20cats/.test(m))), "other words are searched");
  // special achievements in the list
  await c.evaluate(() => achPanel()); await wait(300);
  const ach = await c.textContent("#achp");
  check(/Spooky visitor/.test(ach) && /Code breaker/.test(ach) && /Ad dodger/.test(ach), "the achievements list has the special ones");
  await c.screenshot({ path:SHOTS + "live-ach.png" });
  await c.evaluate(() => closeOver());

  // updates: a gradual rollout, then going back
  const next = "9.9.0", upd = { url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe", sha256:"a".repeat(64), size:1 };
  const exe = v => ({ url:"https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebStudiosBrowser-" + v + ".exe", sha256:"b".repeat(64), size:1 });
  manifest = { version:next, notes:["Faster tabs"], exe:exe(next), updater:upd, previous:{ version:VER, exe:exe(VER) } };
  const pill = () => c.evaluate(() => { const p = document.querySelector(".xbox .xupd"); return p ? p.textContent : ""; });
  const setLive = async o => { await admin("live.set", { live:o }); await c.evaluate(() => Live.refresh(true)); await wait(300); await c.evaluate(() => X3.checkUpdate(false)); await wait(500); };
  const bucket = await c.evaluate(() => Live.bucket());
  await setLive({ rollout:{ win:{ v:next, pct:bucket } } });
  check(await pill() === "", "rollout: this PC (number " + bucket + ") isn't in the first " + bucket + "%: no Update button");
  await setLive({ rollout:{ win:{ v:next, pct:bucket + 1 } } });
  check(/^Update$/.test(await pill()), "a little wider, and it is: " + await pill());
  // with the background updater, its own number counts
  updStatus = { v:1, auto:true, inbox:"C:\\inbox", alive:Date.now(), bucket:99, latest:next, ready:false, target:"", wait:true };
  await setLive({ rollout:{ win:{ v:next, pct:50 } } });
  check(await pill() === "", "the updater's number (99) is used when it runs");
  updStatus.bucket = 3; await c.evaluate(() => X3.checkUpdate(false)); await wait(500);
  check(/^Update$/.test(await pill()), "and its number 3 is in the first 50%");
  updStatus = null;
  // going back: this PC is on the new one, everyone goes back to the one before
  manifest = { version:VER, notes:["Help & support"], exe:exe(VER), updater:upd, previous:{ version:"3.5.0", exe:exe("3.5.0") } };
  await setLive({ rollout:{}, rollback:{ win:"3.5.0" } });
  check(/Go back to 3\.5\.0/.test(await pill()), "going back: " + await pill());
  await c.evaluate(() => document.querySelector(".xbox .xupd").click()); await wait(300);
  check(/Going back to Webs Browser 3\.5\.0/.test(await c.textContent("#xupdp")) && /Go back now/.test(await c.textContent("#xupdp")), "the panel explains it");
  await c.screenshot({ path:SHOTS + "live-goback.png" });
  await c.evaluate(() => closeOver());
  updStatus = { v:1, auto:true, inbox:"C:\\inbox", alive:Date.now(), bucket:3, latest:VER, ready:true, target:"3.5.0", back:true };
  await c.evaluate(() => X3.checkUpdate(false)); await wait(500);
  check(/Restart to go back/.test(await pill()), "once the updater put it in place: " + await pill());
  updStatus = null;
  await setLive({ rollback:{} });
  check(await pill() === "", "going back stopped: nothing to do on the newest version");

  /* ---------------------------------------------------------------- the new tab page */
  // a new card and announcement (the window showed the first ones); a panel keeps the window busy meanwhile
  await c.evaluate(() => achPanel());
  await admin("live.set", { live:{ card:{ title:"TAKE YOUR TIME", text:"We will steal your boredom on Friday.", sign:"The Phantom Thieves" }, ann:{ text:"New games this Friday!", react:true } } });
  await c.evaluate(() => localStorage.removeItem("wsb.live"));
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(1800);
  check(await n.evaluate(() => !!document.querySelector(".lv-cc")), "the calling card");
  await n.screenshot({ path:SHOTS + "live-ntp-card.png" });
  await n.click(".lv-cc"); await wait(500);
  const txt = await n.textContent("#liveSec");
  check(await n.isVisible("#liveSec") && /New games this Friday/.test(txt) && /Which game next/.test(txt) && /How many legs/.test(txt) && /until Christmas/.test(txt), "the cards under the search box");
  check(/mystery box/i.test(txt) && /Pick of the week/.test(txt) && /500 Snake games together/.test(txt) && /You found it/.test(txt) && /Wallpaper of the week/.test(txt), "the mystery box, the pick, the goal, the hunt (found), the wallpaper");
  check(await n.evaluate(() => !!document.querySelector(".lv-fx") && +localStorage.getItem("wsb.liveFxAt") > 0), "today's theme (snow) plays");
  await n.screenshot({ path:SHOTS + "live-ntp.png" });
  await n.click("#liveSec .lv-poll button:has-text('Chess')"); await wait(500);
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "vote" && x.body.choice === 1 && x.body.platform === "windows"), "a vote reaches the server");
  await n.click("#liveSec .lv-react button:has-text('🎉')"); await wait(400);
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "react" && x.body.emoji === "🎉"), "a reaction too");
  // the owner's quote, when the quote widget is on
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.ntpShow = ["quote"]; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); applyCustom(); }); await wait(300);
  check(/Steal their hearts/.test(await n.textContent('.wg[data-w="quote"]')) && /Joker/.test(await n.textContent('.wg[data-w="quote"]')), "the owner's quote of the day");
  // the wallpaper of the week
  await n.click("#liveSec .lv-wall button"); await wait(500);
  check(await n.evaluate(S => { const l = document.getElementById("bgl"); return !!l && l.dataset.wall === "1" && l.querySelector(".pic").style.backgroundImage.includes(S + "/live/img/") && document.body.classList.contains("pic"); }, SERVER), "the wallpaper of the week goes behind the page");
  await n.screenshot({ path:SHOTS + "live-ntp-wall.png" });
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.bg = "user/ntp-bg.jpg"; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); }); await wait(200);
  check(await n.evaluate(() => { const l = document.getElementById("bgl"); return !!l && !l.dataset.wall && /ntp-bg/.test(l.querySelector(".pic").style.backgroundImage); }), "a picture of their own comes first");
  // Customize can turn it off
  check(await n.evaluate(() => SHOW.some(x => x[0] === "live")), "Customize lists From Webs");
  await n.evaluate(() => { const s = JSON.parse(localStorage.getItem("wsb.settings")); s.ntpHide = ["live"]; delete s.bg; localStorage.setItem("wsb.settings", JSON.stringify(s)); readCfg(); applyCustom(); }); await wait(300);
  check(!(await n.isVisible("#liveSec")), "and off it goes");
  // the effect of a secret word, opened from the window
  const n2 = await ctx.newPage(); watch(n2, errors, "newtab2");
  await n2.goto("https://browser.example/newtab.html#lvfx=confetti"); await wait(500);
  check(await n2.evaluate(() => !!document.querySelector(".lv-fx") && location.hash === ""), "#lvfx= plays the effect and tidies the address");
  await n2.close();
  // a private window shows none of it
  const np = await ctx.newPage(); watch(np, errors, "private");
  await np.goto("https://browser.example/newtab.html?private=1"); await wait(900);
  check(!(await np.isVisible("#liveSec")) && !(await np.evaluate(() => !!document.querySelector(".lv-cc"))), "nothing in a private window");
  await np.close();

  /* ---------------------------------------------------------------- the games page */
  const g = await ctx.newPage(); watch(g, errors, "games");
  await g.goto("https://browser.example/games.html"); await wait(800);
  check(await g.evaluate(() => ANSWER === "heist"), "the daily word is the owner's");
  check(/This week.s leaderboard/.test(await g.textContent("#lvGames")) && /500 Snake games together/.test(await g.textContent("#lvGames")), "the leaderboard and the community goal");
  await g.fill("#lvGames input", "Skull"); await g.click("#lvGames [data-x='join']"); await wait(200);
  await g.evaluate(() => Live.gameOver("snake", 14)); await wait(500);
  check(calls.some(x => x.path === "/live/act" && x.body.kind === "score" && x.body.game === "snake" && x.body.score === 14 && x.body.nick === "Skull"), "a Snake score goes on the board with the nickname");
  check(await g.evaluate(() => JSON.parse(localStorage.getItem("wsb.liveGoal")).n === 1), "and counts toward the goal");
  await g.click("[data-g='word']"); await wait(200);
  for (const k of "heist") await g.keyboard.press(k); await g.keyboard.press("Enter"); await wait(900);
  check(/Solved/.test(await g.textContent("#wmsg")), "solving the owner's word");
  await g.screenshot({ path:SHOTS + "live-games.png", fullPage:true });

  /* ---------------------------------------------------------------- the sidebar: help articles, problem reports, rating */
  const WIN = await c.evaluate(() => WIN);
  const s = await ctx.newPage(); watch(s, errors, "side");
  await s.setViewportSize({ width:380, height:900 });
  await s.goto("https://browser.example/side.html?w=" + WIN + "#support"); await wait(900);
  check(/Common questions/.test(await s.textContent("#support")) && /How do I update/.test(await s.textContent("#support")), "help articles in Help & support");
  await s.click(".sup-link"); await wait(200);
  await s.fill(".sup-rep textarea", "Videos stopped playing after the update");
  await s.click(".sup-go"); await wait(800);
  const rep = calls.find(x => x.path === "/report");
  check(rep && rep.body.app === "windows" && rep.body.version === VER && /Videos stopped/.test(rep.body.text) && /^[0-9a-f]{24}$/.test(rep.body.rtok), "a problem report is sent");
  check(/Your problem reports/.test(await s.textContent("#support")) && /Sent ·/.test(await s.textContent("#support")), "and listed");
  const rid = await s.evaluate(() => Live.myReports()[0].id);
  await admin("report.reply", { id:rid, text:"Fixed in the next version, thanks!" });
  await s.evaluate(() => Live.replies(true)); await wait(600);
  check(/Answered/.test(await s.textContent("#support")) && /Fixed in the next version/.test(await s.textContent("#support")), "the owner's answer shows");
  await s.screenshot({ path:SHOTS + "live-side-help.png" });
  // rating a finished chat
  const t = await W("/support/open", { platform:"windows", version:VER, text:"Help!", access:false });
  await s.evaluate(t => localStorage.setItem("wsb.support", JSON.stringify({ id:t.id, token:t.token, msgs:[{ f:"u", t:"Help!", ts:Date.now() }], ended:true })), t);
  await s.reload(); await wait(800);
  await s.click(".sup-rate [data-r='1']"); await wait(500);
  check(calls.some(x => x.path === "/support/rate" && x.body.r === 1) && /Thanks/.test(await s.textContent(".sup-rate")), "rating the help");

  /* ---------------------------------------------------------------- Settings: anonymous counts */
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html#x3"); await wait(500);
  check(await st.evaluate(() => document.getElementById("liveCounts").classList.contains("on")), "Send anonymous counts is on by default");
  await st.click("#liveCounts"); await wait(300);
  check(await st.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")).liveCounts === false), "and can be turned off");
  await st.screenshot({ path:SHOTS + "live-settings.png" });
  const before = calls.filter(x => x.path === "/live/ping").length;
  await c.evaluate(() => localStorage.removeItem("wsb.livePing"));
  const c2 = await ctx.newPage(); watch(c2, errors, "chrome2");
  await c2.goto("https://browser.example/chrome.html"); await wait(1200);
  check(calls.filter(x => x.path === "/live/ping").length === before, "off: no check-in");
  check(!calls.some(x => /history|bookmarks|example\.com/.test(JSON.stringify(x.body || ""))), "nothing about browsing ever goes to the server");

  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("\nchecks passed: " + ok + " failed: " + bad);
  console.log("errors: " + (errors.length ? errors.join("\n") : "none"));
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
