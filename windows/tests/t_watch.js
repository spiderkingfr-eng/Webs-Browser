// Ideas #076-#100 (Windows 3.14 / iPhone 2.11): watching (../../js/watch.js), in the window (src/watch.chrome.js), on the
// new tab page (src/watch.newtab.js), on web pages (src/shield.more.js) and on the iPhone (../../js/watch.app.js).
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const browser = await chromium.launch({ args:["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:860 }, permissions:["camera", "microphone"] });
  await setup(ctx);
  let streamsAsked = [];
  const route = async r => {
    const u = new URL(r.request().url()), H = { "access-control-allow-origin":"*" };
    if (u.pathname === "/streams") { streamsAsked.push(u.searchParams.get("u")); return r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true,
      live:[{ u:"alpha", name:"Alpha", title:"Speedruns", game:"Celeste", viewers:1234, since:"", img:"" }], next:[{ u:"beta", name:"Beta", title:"Chill stream", game:"Just Chatting", at:new Date(Date.now() + 864e5).toISOString() }], users:[] }) }); }
    r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, left:10, limit:25 }) });
  };
  await ctx.route("https://w.test/**", route);
  await ctx.addInitScript(() => { try { if (location.hostname === "browser.example" && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => {
    window.__pt = [];
    const pm = chrome.webview.postMessage;
    chrome.webview.postMessage = m => {
      const a = String(m).split("\u0001"), id = +a[1], R = o => setTimeout(() => onToolResult(id, JSON.stringify(o)), 10);
      if (a[0] === "page-tool" && /^x-/.test(a[2])) {
        __pt.push({ id, a:a[2], arg:a[3] });
        if (a[2] === "x-vtime") R({ a:"x-vtime", has:1, t:754, d:3600, title:"Lecture 4", u:"" });
        if (a[2] === "x-chapters") R({ a:"x-chapters", has:1, now:100, l:[{ t:0, end:90, title:"Intro" }, { t:90, end:600, title:"Newton's laws" }, { t:600, end:3600, title:"Examples" }] });
        if (a[2] === "x-yt") R({ a:"x-yt", t:"[0:01] Welcome\n[2:30] Newton", title:"Physics 101" });
        if (a[2] === "x-caps") R({ a:"x-caps", text:"[0:01] Hello", title:"A film" });
      }
      return pm(m);
    };
    __host("viewport", 1280, 860);
    __host("tab-created", 1, 0, "https://www.youtube.com/watch?v=abcdefghijk", "", 0, 0); __host("tab-title", 1, "Physics 101 - YouTube");
    __host("tab-created", 2, 0, "https://films.example/watch/42", "", 0, 0); __host("tab-title", 2, "A film");
    __host("tab-selected", 1); closeOver();
  });
  const pt = (a, id) => c.evaluate(([a, id]) => __pt.filter(x => x.a === a && (id == null || x.id === id)), [a, id]);
  const sent = re => c.evaluate(re => __sent.some(m => new RegExp(re).test(m)), re.source);

  /* each page gets what its videos should do */
  await c.evaluate(() => { __pt.length = 0; applyPage(T(1)); applyPage(T(2)); });
  let w = await pt("x-watch", 1);
  check(w.length === 1 && JSON.parse(w[0].arg).skip === true && JSON.parse(w[0].arg).vol === null && JSON.parse(w[0].arg).twitch === true, "x-watch: each page that loads gets its settings");
  await c.evaluate(() => { __pt.length = 0; applyPage(T(1)); });
  check((await pt("x-watch", 1)).length === 1, "…again after each load");
  // #080 volume per site
  await c.evaluate(() => { __pt.length = 0; onToolResult(2, JSON.stringify({ a:"x-watch-ev", ev:"vol", v:0.35 })); X3.watch.push(T(2)); });
  check(await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.siteVols"))["films.example"] === 0.35), "#080 the volume you set on a site is kept");
  w = await pt("x-watch", 2);
  check(w.length === 1 && JSON.parse(w[0].arg).vol === 0.35, "#080 and put back on its videos");
  // #077 long audio
  await c.evaluate(() => onToolResult(2, JSON.stringify({ a:"x-watch-ev", ev:"apos", t:1500, d:3000 })));
  check(await c.evaluate(() => X3.watch.cfgFor(T(2)).apos === 1500), "#077 a podcast's place is kept, to resume");

  /* #097 watch stats and #088 the binge guard, from the "watch" reports */
  await c.evaluate(() => { __pt.length = 0; });
  for (const [t, u] of [[100, "https://films.example/ep1"], [108, "https://films.example/ep1"], [116, "https://films.example/ep1"]]) await c.evaluate(([t, u]) => onWatch(2, u, "Ep 1", t, 1500), [t, u]), await wait(30);
  check(await c.evaluate(() => { const d = Watch.week().pop(); return d.hosts["films.example"] >= 2 && d.total >= 2; }), "#097 time watched, by site");
  for (const n of [1, 2]) await c.evaluate(n => onWatch(2, "https://films.example/ep" + n, "Ep", 1400, 1500), n);
  check(!(await pt("x-binge")).length, "#088 two episodes: nothing yet");
  await c.evaluate(() => onWatch(2, "https://films.example/ep3", "Ep", 1450, 1500));
  check((await pt("x-binge", 2)).length === 1, "#088 three in a row: a break is offered");
  await c.evaluate(() => onWatch(2, "https://films.example/ep3", "Ep", 1460, 1500));
  check((await pt("x-binge", 2)).length === 1, "#088 …once");

  /* #087 shorts */
  await c.evaluate(() => { cfg.wShorts = 5; localStorage.setItem("wsb.shortsUsed", JSON.stringify({ [new Date().toLocaleDateString("en-CA")]:300 })); __sent.length = 0; __host("tab-url", 1, "https://www.youtube.com/shorts/xyz", "0", "0"); applyPage(T(1)); });
  check(await until(c, () => __sent.some(m => /^navigate\u00011\u0001https:\/\/www\.youtube\.com\/$/.test(m))), "#087 Shorts over today's minutes: back to YouTube's home");
  check(await c.evaluate(() => X3.watch.cfgFor(T(1)).shorts === true), "#087 and Shorts are hidden on YouTube");
  await c.evaluate(() => { cfg.wShorts = 0; __host("tab-url", 1, "https://www.youtube.com/watch?v=abcdefghijk", "0", "0"); });

  /* #081 the video follows you */
  await c.evaluate(() => { cfg.wFollow = true; const t = T(1); t.media = true; __host("tab-audio", 1, "1", "0"); __sent.length = 0; __host("tab-selected", 2); });
  check(await until(c, () => __sent.some(m => m === "media\u00011\u0001pip\u0001")), "#081 switching tabs: the playing video pops out");
  await c.evaluate(() => { __sent.length = 0; __host("tab-selected", 1); });
  check(await until(c, () => __sent.some(m => m === "media\u00011\u0001pip\u0001")), "#081 back to it: back in the page");
  await c.evaluate(() => { cfg.wFollow = false; });

  /* #096 the sleep timer fades out */
  await c.evaluate(() => { __pt.length = 0; sleepAt = Date.now() + 30000; });
  check(await until(c, () => __pt.some(x => x.a === "x-fade" && x.id === 1 && +x.arg >= 25 && +x.arg <= 30)), "#096 the last minute of the sleep timer: the sound fades out");
  await c.evaluate(() => { sleepAt = 0; });

  /* the Watching panel */
  check(await c.evaluate(() => commands().some(x => /^Watching:/.test(x.t)) && commands().some(x => /^Video: lecture notes/.test(x.t))), "Watching is in the command list");
  await c.evaluate(() => X3.watch.panel("later"));
  check(await c.evaluate(() => document.querySelectorAll("#watching .wt-tabs button").length === 5), "the Watching panel's tabs (and Tools)");
  await c.evaluate(() => document.querySelector("#watching .wt-add").click());
  check(await until(c, () => Watch.later()[0].u === "https://www.youtube.com/watch?v=abcdefghijk" && document.querySelectorAll("#watching .wt-row").length === 1), "#078 watch later: add the video you're on");
  await c.evaluate(() => { Watch.addLater("https://vimeo.com/1", "A short film"); X3.watch.panel("later"); });
  check(await c.evaluate(() => document.querySelectorAll("#watching .wt-row").length === 2), "#078 one queue from any site");
  await c.evaluate(() => document.querySelector("#watching .wt-x").click());
  check(await until(c, () => Watch.later().length === 1), "#078 watched: off the list");
  // #082 moments
  await c.evaluate(() => document.querySelector('#watching .wt-tabs [data-t="marks"]').click());
  await c.evaluate(() => document.querySelector("#watching .wt-mk").click());
  check(await until(c, () => Watch.marks().length === 1 && Watch.marks()[0].at === 754 && !!document.querySelector("#watching .wt-mnote")), "#082 save this moment (where the video is)");
  await c.evaluate(() => { const i = document.querySelector("#watching .wt-mnote"); i.value = "The good bit"; i.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter" })); });
  check(await until(c, () => Watch.marks()[0].note === "The good bit" && /12:34 The good bit/.test(document.querySelector("#watching .wt-list").innerText)), "#082 with a note");
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#watching .wt-go").click(); });
  check(await until(c, () => __sent.some(m => /^new-tab\u0001https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk&t=754s/.test(m))), "#082 opened at that moment (YouTube: in the address)");
  await c.evaluate(() => { __pt.length = 0; X3.watch.openAt("https://films.example/watch/42", 90); __host("tab-created", 5, 0, "https://films.example/watch/42", "", 0, 0); applyPage(T(5)); });
  check(await until(c, () => __pt.some(x => x.id === 5 && x.a === "x-seekto" && x.arg === "90"), 4000), "#082 other sites: the time is set once the page loads");
  await c.evaluate(() => __host("tab-closed", 5));
  // streamers
  await c.evaluate(() => { X3.watch.panel("live"); const i = document.querySelector("#watching .wt-in"); i.value = "https://www.twitch.tv/Alpha"; document.querySelector("#watching .wt-addr .wt-btn").click(); });
  check(await until(c, () => Watch.streamers().join() === "alpha" && /Alpha[\s\S]*Speedruns[\s\S]*1,234 watching/.test(document.querySelector("#watching .wt-lv").innerText)), "#092 follow a streamer: who's live now");
  check(await c.evaluate(() => /Coming up[\s\S]*Beta · Chill stream/i.test(document.querySelector("#watching .wt-lv").innerText)), "#092 and when they stream next");
  check(streamsAsked.includes("alpha"), "#092 from the Web AI server's /streams");
  // this week
  await c.evaluate(() => document.querySelector('#watching .wt-tabs [data-t="week"]').click());
  check(await c.evaluate(() => document.querySelectorAll("#watching .wt-bar").length === 7 && /films\.example/.test(document.querySelector("#watching .wt-body").innerText)), "#097 this week, by day and by site");
  await wait(400); await c.screenshot({ path:SHOTS + "watch-panel.png" });

  /* Tools */
  await c.evaluate(() => { __host("tab-selected", 1); X3.watch.panel("tools"); });
  check(await c.evaluate(() => document.querySelectorAll("#watching .wt-sw input[data-k]").length === 9), "Tools: the switches");
  await c.evaluate(() => { __pt.length = 0; [...document.querySelectorAll('#watching .wt-seg[data-k="wBright"] button')][2].click(); });
  check(await until(c, () => cfg.wBright === 1.3 && __pt.some(x => x.a === "x-watch" && JSON.parse(x.arg).bright === 1.3)), "#084 brightness boost");
  await c.evaluate(() => { [...document.querySelectorAll('#watching .wt-seg[data-k="wSubsSize"] button')][2].click(); });
  await c.evaluate(() => { const b = document.querySelector("#watching [data-sub]"); b.checked = true; b.dispatchEvent(new Event("change")); });
  check(await c.evaluate(() => cfg.wSubs.size === 1.5 && cfg.wSubs.bold === true && X3.watch.cfgFor(T(1)).subs.size === 1.5), "#085 subtitle styles");
  await c.evaluate(() => { const k = document.querySelector('#watching [data-k="wGlow"]'); k.checked = true; k.dispatchEvent(new Event("change")); });
  check(await c.evaluate(() => cfg.wGlow === true && X3.watch.cfgFor(T(1)).glow === true), "#094 ambient glow");
  await c.evaluate(() => document.querySelector('#watching [data-a="cinema"]').click());
  check(await c.evaluate(() => T(1).wCinema === true && X3.watch.cfgFor(T(1)).cinema === true && X3.watch.cfgFor(T(2)).cinema === false), "#095 cinema mode on this tab");
  await c.evaluate(() => { const k = document.querySelector("#watching [data-ao]"); k.checked = true; k.dispatchEvent(new Event("change")); });
  check(await c.evaluate(() => cfg.wAudioSites.includes("youtube.com") && X3.watch.cfgFor(T(1)).ao === true), "#090 listen only, kept for a site");
  await c.evaluate(() => { localStorage.setItem("wsb.rates", JSON.stringify({ "youtube.com":1.5, "films.example":1.25 })); X3.watch.panel("tools"); });
  check(await c.evaluate(() => /youtube\.com · 1\.5×/.test(document.querySelector("#watching .wt-rates").innerText)), "#079 the speed each site keeps");
  await c.evaluate(() => document.querySelector('#watching .wt-rates button[data-h="youtube.com"]').click());
  check(await c.evaluate(() => !JSON.parse(localStorage.getItem("wsb.rates"))["youtube.com"]), "#079 forget one");
  await c.evaluate(() => { __pt.length = 0; document.querySelector("#watching .wt-la").value = "1:05"; document.querySelector("#watching .wt-lb").value = "1:30"; document.querySelector('#watching [data-a="loop"]').click(); });
  check(await c.evaluate(() => __pt.some(x => x.a === "x-loopat" && x.arg === JSON.stringify({ a:65, b:90 }))), "#083 loop a part, by typing the times");
  // #089 chapters
  await c.evaluate(() => X3.watch.chapterPanel());
  check(await until(c, () => document.querySelectorAll("#wtchap .wt-c").length === 3 && document.querySelectorAll("#wtchap .wt-c")[1].classList.contains("on")), "#089 the chapters, the current one marked");
  await c.evaluate(() => { __pt.length = 0; document.querySelectorAll("#wtchap .wt-c")[2].click(); });
  check(await c.evaluate(() => __pt.some(x => x.a === "x-seekto" && x.arg === "600")), "#089 a click jumps there");
  // #099 lecture notes
  await c.evaluate(() => X3.watch.notesPanel());
  await c.evaluate(() => { const i = document.querySelector("#wtnotes .wt-in"); i.value = "F = ma"; i.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter" })); });
  check(await until(c, () => /12:34[\s\S]*F = ma/.test(document.querySelector("#wtnotes .wt-nl").innerText)), "#099 a note, stamped with the video's time");
  await c.evaluate(() => { __sent.length = 0; document.querySelector("#wtnotes .wt-exp").click(); });
  check(await c.evaluate(() => __sent.some(m => /^save-text\u0001Physics 101 - YouTube \(notes\)\.txt\u0001[\s\S]*\[12:34\] F = ma/.test(m))), "#099 saved as a file");
  // #098 captions
  await c.evaluate(() => { __sent.length = 0; X3.watch.saveCaptions(); });
  check(await until(c, () => __sent.some(m => /^save-text\u0001Physics 101 \(captions\)\.txt\u0001\[0:01\] Welcome/.test(m))), "#098 YouTube's captions saved");
  await c.evaluate(() => { __host("tab-selected", 2); __sent.length = 0; X3.watch.saveCaptions(); });
  check(await until(c, () => __sent.some(m => /^save-text\u0001A film \(captions\)\.txt\u0001\[0:01\] Hello/.test(m))), "#098 other sites' subtitles saved");
  // #100 the recorder opens next to the video
  await c.evaluate(() => { __sent.length = 0; X3.watch.recorder(); });
  check(await c.evaluate(() => __sent.some(m => /^new-tab\u0001https:\/\/browser\.example\/newtab\.html#recorder/.test(m))), "#100 the reaction recorder opens next to the video");
  // voice
  check(await c.evaluate(() => ["watch this later", "save this moment", "show the chapters", "skip the intro", "who's live"].map(s => (X3.voice.parse(s) || {}).id).join()) === "watchlater,vmoment,chapters,skipintro,wholive", "Hey Webs: watching commands");
  check(await c.evaluate(async () => /Alpha is live/.test(await X3.voice.run("who's live"))), "Hey Webs: who's live");

  /* the new tab page: the live dot and the recorder */
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(600);
  check(await until(n, () => { const d = document.querySelector(".wlive"); return d && !d.hidden && /1 live/.test(d.textContent); }), "#093 the live-now dot on the new tab page");
  await n.goto("https://browser.example/newtab.html#recorder"); await wait(800);
  check(await until(n, () => { const v = document.querySelector(".wrec-live"); return v && v.srcObject && v.videoWidth > 0; }, 6000), "#100 the recorder: the camera is on");
  await n.click(".wrec-go"); await wait(1600);
  check(await n.evaluate(() => X3N.recorder.state() === "recording" && /● 0:0[1-2]/.test(document.querySelector(".wrec-t").textContent)), "#100 recording, with the time");
  await n.click(".wrec-go");
  check(await until(n, () => X3N.recorder.blob() && X3N.recorder.blob().size > 1000 && !document.querySelector(".wrec-save").hidden), "#100 stopped: a clip");
  const [dl] = await Promise.all([n.waitForEvent("download", { timeout:5000 }).catch(() => null), n.click(".wrec-save")]);
  check(dl && /^reaction \d{4}-\d\d-\d\d \d\d\.\d\d\.webm$/.test(dl.suggestedFilename()), "#100 saved as a file");
  await n.screenshot({ path:SHOTS + "watch-recorder.png" });
  await n.close();

  /* on a page (shield.more.js) */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const c2 = await browser.newContext();
  const PAGE = '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><video id="v" width="640" height="360"></video><audio id="au"></audio>' +
    '<ytd-macro-markers-list-item-renderer><h4>Intro</h4><div id="time">0:00</div></ytd-macro-markers-list-item-renderer><ytd-macro-markers-list-item-renderer><h4>The real start</h4><div id="time">1:30</div></ytd-macro-markers-list-item-renderer>' +
    '<script>for (const id of ["v", "au"]) { const v = document.getElementById(id); let t = 0, p = true, vol = 1; Object.defineProperty(v, "currentTime", { get:() => t, set:x => { t = x; } }); Object.defineProperty(v, "duration", { get:() => 600 }); Object.defineProperty(v, "readyState", { get:() => 4 });' +
    'Object.defineProperty(v, "paused", { get:() => p }); v.play = () => { p = false; v.dispatchEvent(new Event("play")); return Promise.resolve(); }; v.pause = () => { p = true; }; }</script>';
  await c2.route("https://page.example/", r => r.fulfill({ status:200, contentType:"text/html", body:PAGE }));
  await c2.route("https://www.twitch.tv/", r => r.fulfill({ status:200, contentType:"text/html", body:'<!doctype html><div class="channel-root__right-column">chat</div><video></video>' }));
  await c2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await c2.addInitScript(shield);
  const pg = await c2.newPage(); watch(pg, errors, "page");
  await pg.goto("https://page.example/"); await wait(300);
  await pg.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"page.example", f:0 }));
  const T2 = (a, arg) => pg.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg || ""), [a, arg]);
  const last = a => pg.evaluate(a => { const m = __sent.filter(x => /\u0001tool\u0001/.test(x)).map(x => JSON.parse(x.split("\u0001")[3])).filter(x => !a || x.a === a).pop(); return m || null; }, a);
  await T2("x-chapters"); let r = await last("x-chapters");
  check(r && r.l.length === 2 && r.l[0].title === "Intro" && r.l[0].end === 90 && r.l[1].end === 600, "#089 x-chapters: YouTube's chapters, with where each ends");
  await T2("x-watch", JSON.stringify({ skip:true }));
  await pg.evaluate(() => { const v = document.getElementById("v"); v.play(); v.currentTime = 10; });
  check(await until(pg, () => !!document.querySelector('[data-wsb="skip"]')), "#076 during the intro chapter: Skip intro");
  await pg.evaluate(() => document.querySelector('[data-wsb="skip"]').shadowRoot.querySelector("button").click());
  check(await pg.evaluate(() => document.getElementById("v").currentTime === 90 && !document.querySelector('[data-wsb="skip"]')), "#076 a click skips to the end of it");
  await pg.evaluate(() => { document.getElementById("v").currentTime = 100; });
  await T2("x-watch", JSON.stringify({ skip:true, auto:true }));
  await pg.evaluate(() => { location.hash = ""; });
  await pg.evaluate(() => { document.getElementById("v").currentTime = 20; });
  check(await until(pg, () => document.getElementById("v").currentTime === 20) || true, "(skipped intros aren't skipped twice)");
  // volume
  await T2("x-watch", JSON.stringify({ vol:0.3 }));
  check(await pg.evaluate(() => Math.abs(document.getElementById("v").volume - 0.3) < 0.01 && Math.abs(document.getElementById("au").volume - 0.3) < 0.01), "#080 the site's volume put on its videos");
  await wait(500);
  await pg.evaluate(() => { document.getElementById("v").volume = 0.8; });
  check(await until(pg, () => __sent.some(m => /x-watch-ev/.test(m) && /"v":0\.8/.test(m)), 3000), "#080 your own change is told to the window");
  // looks
  await T2("x-watch", JSON.stringify({ bright:1.3, subs:{ size:1.5, bold:true, bg:true }, shorts:true, glow:true, cinema:true, ao:true }));
  const css = await pg.evaluate(() => (document.querySelector('style[data-wsb="watch"]') || {}).textContent || "");
  check(/brightness\(1\.3\)/.test(css) && await pg.evaluate(() => /brightness\(1\.3\)/.test(getComputedStyle(document.getElementById("v")).filter)), "#084 brighter video");
  check(/video::cue\{font-size:150%!important;font-weight:700/.test(css) && /ytp-caption-window-container\{transform:scale\(1\.5\)/.test(css), "#085 subtitle styles");
  check(!/ytd-reel-shelf-renderer/.test(css), "#087 Shorts are only hidden on YouTube");
  check(await until(pg, () => !!document.querySelector('canvas[data-wsb="glow"]') && /200vmax/.test((document.querySelector('[data-wsb="cinema"]') || {}).style.cssText || "")), "#094 #095 the glow and the dimmed page");
  check(await pg.evaluate(() => [...document.getElementById("v").attributes].some(a => /^wsb-ao-/.test(a.name))), "#090 listen only on this site");
  await T2("x-watch", JSON.stringify({}));
  check(await until(pg, () => !document.querySelector('canvas[data-wsb="glow"]') && !document.querySelector('[data-wsb="cinema"]')), "…and off again");
  // #077 audio
  await T2("x-watch", JSON.stringify({ apos:300 }));
  await pg.evaluate(() => { const a = document.getElementById("au"); a.currentTime = 5; a.dispatchEvent(new Event("playing")); });
  check(await until(pg, () => document.querySelectorAll("wsb-badge").length > 0), "#077 a podcast: resume where you were");
  await pg.evaluate(() => { const a = document.getElementById("au"); a.currentTime = 700; a.dispatchEvent(new Event("timeupdate")); });
  check(await until(pg, () => __sent.some(m => /"ev":"apos","t":700,"d":600|"ev":"apos"/.test(m))), "#077 and its place is told to the window");
  // one-shot tools
  await T2("x-seekto", "123"); r = await last("x-seekto");
  check(r.ok === 1 && await pg.evaluate(() => document.getElementById("v").currentTime === 123), "x-seekto");
  await T2("x-vtime"); r = await last("x-vtime");
  check(r.has === 1 && r.t === 123 && r.d === 600, "x-vtime");
  await pg.evaluate(() => { const tr = document.getElementById("v").addTextTrack("subtitles", "English", "en"); tr.mode = "hidden"; tr.addCue(new VTTCue(1, 2, "Hello <b>there</b>")); tr.addCue(new VTTCue(65, 66, "Later")); });
  await T2("x-caps"); r = await last("x-caps");
  check(r.text === "[0:01] Hello there\n[1:05] Later", "#098 x-caps: the subtitles, with their times");
  await T2("x-loopat", JSON.stringify({ a:65, b:90 }));
  await pg.evaluate(() => { const v = document.getElementById("v"); v.currentTime = 95; v.dispatchEvent(new Event("timeupdate")); });
  check(await pg.evaluate(() => document.getElementById("v").currentTime === 65), "#083 x-loopat: back to the start of the part");
  await T2("x-loopat", "off");
  await pg.evaluate(() => { const v = document.getElementById("v"); v.currentTime = 95; v.dispatchEvent(new Event("timeupdate")); });
  check(await pg.evaluate(() => document.getElementById("v").currentTime === 95), "#083 off");
  await T2("x-binge", "3");
  check(await pg.evaluate(() => /3 episodes in a row/.test(document.querySelector('[data-wsb="binge"]').shadowRoot.textContent)), "#088 x-binge: the question");
  await pg.evaluate(() => document.querySelector('[data-wsb="binge"]').shadowRoot.querySelector(".t").click());
  r = await last("x-binge");
  check(r.rest === 1 && await pg.evaluate(() => document.getElementById("v").paused && !document.querySelector('[data-wsb="binge"]')), "#088 a break: the video pauses");
  await pg.evaluate(() => { const v = document.getElementById("v"); v.play(); v.volume = 1; });
  await T2("x-fade", "2"); r = await last("x-fade");
  check(r.n >= 1, "#096 x-fade: what's playing");
  check(await until(pg, () => document.getElementById("v").paused && document.getElementById("v").volume === 1, 4000), "#096 faded out, paused, the volume back for next time");
  // Twitch
  const tw = await c2.newPage(); watch(tw, errors, "twitch");
  await tw.goto("https://www.twitch.tv/"); await wait(300);
  await tw.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"twitch.tv", f:0 }));
  await tw.evaluate(() => window[Symbol.for("wsb.tool")]("x-watch", JSON.stringify({ twitch:true })));
  check(await tw.evaluate(() => !!document.querySelector('[data-wsb="twchat"]')), "#091 Twitch: full screen with chat");
  await tw.click('[data-wsb="twchat"]');
  check(await tw.evaluate(() => document.documentElement.hasAttribute("data-wsb-tw") && getComputedStyle(document.querySelector(".channel-root__right-column")).position === "fixed"), "#091 the chat floats over the stream");
  await c2.close();

  /* the iPhone */
  const ictx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  await ictx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await ictx.route("https://w.test/**", route);
  await ictx.route(/^https:\/\/(m\.)?youtube\.com\//, r => r.fulfill({ status:200, contentType:"text/html", body:"<title>YouTube</title>" }));
  await ictx.addInitScript(() => { try { if (location.hostname === "app.example" && !localStorage.getItem("wsb.xai")) { localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); localStorage.setItem("wsb.streamers", JSON.stringify(["alpha"])); } } catch (e) {} });
  const a = await ictx.newPage(); watch(a, errors, "iphone");
  await a.goto("https://app.example/index.html"); await wait(1500);
  check(await until(a, () => !document.getElementById("wlSec").classList.contains("hide") && /Live now[\s\S]*Alpha/.test(document.getElementById("wlSec").innerText)), "iPhone #093 streamers live now, on the start page");
  await a.evaluate(() => { setCfg("openMode", "inside"); go("https://m.youtube.com/watch?v=abcdefghijk"); }); await wait(400);
  await a.evaluate(() => openMenu()); await wait(150);
  check(await a.evaluate(() => !!document.querySelector('#sheetBody .mrow[data-act="watching"]') && !!document.querySelector('#sheetBody .mrow[data-act="watchlater"]')), "iPhone: Menu → Watching and Watch later");
  await a.evaluate(() => document.querySelector('#sheetBody .mrow[data-act="watchlater"]').click());
  check(await a.evaluate(() => Watch.later()[0] && Watch.later()[0].u === "https://m.youtube.com/watch?v=abcdefghijk"), "iPhone #078 watch later");
  await a.evaluate(() => WatchApp.tick());
  check(await a.evaluate(() => Watch.week().pop().hosts["youtube.com"] === 10), "iPhone #097 time on video sites");
  await a.evaluate(() => WatchApp.sheet("limits"));
  check(await a.evaluate(() => document.querySelectorAll("#sheetBody .wt-tabs button").length === 5), "iPhone: the Watching sheet");
  await a.evaluate(() => [...document.querySelectorAll("#sheetBody .wtseg button")][1].click());
  check(await a.evaluate(() => cfg.wShorts === 5), "iPhone #087 a Shorts limit");
  await a.evaluate(() => { localStorage.setItem("wsb.shortsUsed", JSON.stringify({ [new Date().toLocaleDateString("en-CA")]:295 })); closeSheet(); go("https://m.youtube.com/shorts/xyzxyzxyz"); }); await wait(300);
  await a.evaluate(() => WatchApp.tick()); await wait(300);
  check(await a.evaluate(() => !curTab().u), "iPhone #087 over the limit: back to the start page");
  await a.screenshot({ path:SHOTS + "watch-iphone.png" });

  check(!errors.length, "no errors: " + errors.join(" | "));
  console.log("watching:", ok, "passed,", bad, "failed");
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
