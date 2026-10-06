// Ideas #001-#025 (Windows 3.14, src/assistant.more.js and the hooks in voice.chrome.js / assistant.chrome.js / shield.more.js):
// routines, the daily recap, reminders, quiz, translating, stories, cooking, the pomodoro coach, search results read out,
// saved assistants, whisper, seasons, errors explained, "what can I do here", dictation and fixing it, chimes, push to talk,
// the conversation log, history questions, grouping tabs, quiet hours, ducking and the weather. Web AI, pages and sites are pretend.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const untilN = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(60); } return false; };
(async () => {
  const browser = await chromium.launch({ args:["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  const chats = [];
  // the pretend Web AI: the answer depends on what was asked
  const answer = b => {
    const m = b.messages[b.messages.length - 1].content;
    if (/Translate into japanese/i.test(m)) return "おはようございます";
    if (/Translate into spanish/i.test(m)) return "¿Dónde está la estación?";
    if (/recipe page/.test(m)) return '```json\n{"title":"Pancakes","ingredients":["2 eggs","200 g flour","300 ml milk"],"steps":["Whisk the eggs and milk.","Stir in the flour.","Fry spoonfuls for two minutes a side."]}\n```';
    if (/Which of them are shopping tabs/.test(m)) return '```json\n{"name":"Shopping","ids":[1,3]}\n```';
    if (/^History:/.test(m)) { const n = (m.split("\n").find(l => /lamp/i.test(l)) || "1").split(" | ")[0]; return '```json\n{"hits":[{"n":' + n + ',"why":"lamps"}]}\n```'; }
    if (/Rewrite this text so it is more polite/.test(m)) return "Would you kindly send the report?";
    if (/spoken quiz on planets/.test(m)) return "Question one. Which planet is largest? A, Mars. B, Jupiter. C, Venus.";
    if (/Tell a story/.test(m)) return /part 2 of/.test(m) ? "The dragon flew home. Want more?" : "Once there was a small dragon. It was afraid of the dark. Shall I go on?";
    if (/has an error|page with an error/.test(m)) return "That's a 404: the page doesn't exist any more. Check the address.";
    return "Sure.";
  };
  await ctx.route("https://w.test/**", async r => {
    const u = new URL(r.request().url()), H = { "access-control-allow-origin":"*" };
    if (u.pathname === "/") return r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, features:["assistant"] }) });
    if (u.pathname === "/chat") {
      const b = JSON.parse(r.request().postData()); chats.push(b);
      const parts = answer(b).match(/[\s\S]{1,9}/g) || [];
      return r.fulfill({ status:200, headers:H, contentType:"application/x-ndjson", body:parts.map(d => JSON.stringify({ d })).join("\n") + "\n" + JSON.stringify({ end:1, stop:"end_turn", left:20 }) + "\n" });
    }
    r.fulfill({ status:404, headers:H, body:"{}" });
  });
  await ctx.route(/geocoding-api\.open-meteo\.com/, r => r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" }, body:JSON.stringify({ results:[{ name:"Lyon", latitude:45.75, longitude:4.85 }] }) }));
  await ctx.route(/api\.open-meteo\.com\/v1\/forecast/, r => r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" },
    body:JSON.stringify({ current:{ temperature_2m:17.6, weather_code:2, wind_speed_10m:8 }, daily:{ temperature_2m_max:[21.2, 15], temperature_2m_min:[11.8, 9], precipitation_probability_max:[70, 10], weather_code:[61, 3] } }) }));
  await ctx.addInitScript(() => {
    if (location.hostname !== "browser.example") return;
    try { localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {}
    window.__spoken = []; window.__vol = [];
    Object.defineProperty(window, "speechSynthesis", { configurable:true, value:{ speak(u) { window.__spoken.push(u.text); window.__vol.push(u.volume); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {},
      getVoices:() => [{ name:"Microsoft Ryan Online (Natural) - English (United Kingdom)", lang:"en-GB" }, { name:"Microsoft David", lang:"en-US" }, { name:"Microsoft Haruka", lang:"ja-JP" }], addEventListener() {} } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.volume = 1; };
    window.__sr = { inst:null, say(text, final) { const r = this.inst; if (!r) return; const res = [{ transcript:text }]; res.isFinal = final !== false; r.onresult({ resultIndex:0, results:[res] }); } };
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { const me = this; window.__sr.inst = me; me.start = () => { me.started = true; }; me.stop = me.abort = () => { me.started = false; }; };
  });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  // pretend pages: what the page tools would answer, and the Windows side fetching for the window
  await c.evaluate(() => {
    window.__typed = []; window.__ducks = []; window.__feeds = {};
    window.__page = { 1:{ t:"Pancakes. Ingredients: 2 eggs, 200 g flour. Method: whisk, stir, fry.", title:"Fluffy pancakes" }, 2:{ t:"404 Not Found. The requested URL was not found on this server.", title:"404 Not Found" } };
    const pm = chrome.webview.postMessage;
    chrome.webview.postMessage = m => {
      const a = String(m).split("\u0001");
      if (a[0] === "page-tool" && a[2] === "x-ai") { const pg = __page[a[1]] || { t:"", title:"" }; setTimeout(() => onToolResult(+a[1], JSON.stringify({ a:"x-ai", t:pg.t, sel:"", title:pg.title })), 10); }
      if (a[0] === "page-tool" && a[2] === "x-type") { __typed.push(JSON.parse(a[3])); setTimeout(() => onToolResult(+a[1], JSON.stringify({ a:"x-type", ok:window.__noBox ? 0 : 1, why:window.__noBox ? "none" : "" })), 10); }
      if (a[0] === "page-tool" && a[2] === "x-duck") __ducks.push(a[1] + ":" + a[3]);
      if (a[0] === "feed-fetch" && __feeds[a[1]] != null) setTimeout(() => __host("feed", a[1], __feeds[a[1]]), 20);
      return pm(m);
    };
    __host("viewport", 1280, 820);
    __host("tab-created", 1, 0, "https://cooking.example/recipes/pancakes", "", 0, 0); __host("tab-title", 1, "Fluffy pancakes recipe");
    __host("tab-created", 2, 0, "https://broken.example/missing", "", 0, 0); __host("tab-title", 2, "404 Not Found");
    __host("tab-created", 3, 0, "https://shop.example/headphones", "", 0, 0); __host("tab-title", 3, "Headphones - Shop");
    __host("tab-created", 4, 0, "https://www.youtube.com/watch?v=abc", "", 0, 0); __host("tab-title", 4, "Lofi beats - YouTube");
    __host("tab-created", 5, 0, "https://store.example/lamps", "", 0, 0); __host("tab-title", 5, "Desk lamps - Store");
    __host("tab-selected", 1); closeOver(); cfg.xAsVoice = "win:Microsoft Ryan Online (Natural) - English (United Kingdom)"; X3.voice.setOn(true);
  });
  await wait(300);
  const sayIt = async t => { await c.evaluate(t => { __sent.length = 0; __sr.say(t, true); }, t); };
  const quiet = () => until(c, () => !X3.voice.speaker.busy() && !X3.voice.state().talking, 8000);
  const spokeIt = async (re, ms) => { const end = Date.now() + (ms || 5000); while (Date.now() < end) { if (await c.evaluate(r => __spoken.some(s => new RegExp(r, "i").test(s)), re).catch(() => false)) return true; await wait(80); } console.log("    (said: " + JSON.stringify(await c.evaluate(() => __spoken.slice(-4))) + ")"); return false; };
  const said = re => spokeIt(re.source || re);
  const fresh = async () => { await quiet(); await c.evaluate(() => { __spoken.length = 0; X3.voice.state().awakeUntil = 0; X3.assist.endMode(); closeOver(); }); };

  /* #001 routines */
  await sayIt("hey webs start my study routine");
  check(await said(/Starting your study routine/) && await said(/Let's get some studying done/), "#001 a routine is talked through");
  check(await until(c, () => !!focusState() && cfg.ambient === "rain"), "#001 and its steps run: focus mode and rain sounds");
  check(await c.evaluate(() => [...document.querySelectorAll(".asst-act")].some(a => /✓/.test(a.textContent))), "#001 each step shows in the card");
  await fresh(); await c.evaluate(() => { startFocus(-1); cfg.ambient = ""; ambUpdate(); });

  /* #002 recap */
  await c.evaluate(() => {
    const st = load("screentime", {}); st[new Date().toLocaleDateString("en-CA")] = { "www.youtube.com":3700, "reddit.com":1300, "mail.google.com":400 }; save("screentime", st);
    localStorage.setItem("wsb.todo", JSON.stringify([{ id:"a", t:"call mom", done:true }, { id:"b", t:"milk", done:false }]));
    dispatchEvent(new StorageEvent("storage", { key:"wsb.todo" }));
  });
  await c.evaluate(() => { localStorage.setItem("wsb.todo", JSON.stringify([{ id:"a", t:"call mom", done:true }, { id:"b", t:"milk", done:true }])); dispatchEvent(new StorageEvent("storage", { key:"wsb.todo" })); });
  await sayIt("hey webs how was my day");
  check(await said(/spent 1 hour 30 minutes on the web, mostly on youtube \(1 hour 2 minutes\), reddit \(22 minutes\) and mail\.google/) && await said(/finished 1 to-do/), "#002 the daily recap: time online, top sites, to-dos ticked off");
  await fresh();

  /* #003 reminders */
  check(await c.evaluate(() => { const a = X3.assist.clockAt("5 30 pm"), d = new Date(a); return d.getHours() === 17 && d.getMinutes() === 30; }), "#003 “at 5 30 pm” (as heard)");
  check(await c.evaluate(() => new Date(X3.assist.clockAt("noon")).getHours() === 12 && new Date(X3.assist.clockAt("17 45")).getMinutes() === 45 && new Date(X3.assist.clockAt("seven thirty am")).getHours() === 7), "#003 noon, 17 45, seven thirty am");
  await sayIt("hey webs remind me in 3 seconds to check the oven");
  check(await said(/I'll remind you to check the oven in/), "#003 a reminder is set");
  check(await spokeIt("Reminder: check the oven", 9000), "#003 and said when it's time");
  check(await c.evaluate(() => /check the oven/.test(document.getElementById("toast").textContent)), "#003 with a toast to snooze it");
  await sayIt("hey webs remind me to call mom at 6 pm");
  check(await until(c, () => load("voiceRem", []).some(r => r.text === "call mom" && new Date(r.at).getHours() === 18)), "#003 “remind me to … at 6 pm”");
  await quiet(); await sayIt("hey webs what are my reminders");
  check(await said(/call mom at 6/), "#003 “what are my reminders”");
  await fresh();

  /* #004 quiz, #006 story */
  await sayIt("hey webs quiz me on planets");
  check(await untilN(() => chats.some(b => /spoken quiz on planets/.test(b.messages.slice(-1)[0].content))) && await said(/Which planet is largest/), "#004 a spoken quiz");
  check(await until(c, () => X3.voice.state().awakeUntil - Date.now() > 12000, 8000), "#004 it waits a while for your answer, no wake phrase needed");
  await fresh();
  await sayIt("hey webs tell me a story about a dragon");
  check(await said(/small dragon/) && await until(c, () => (load("asStory", null) || { parts:[] }).parts.length === 1), "#006 a story, part one, remembered");
  await quiet(); await c.evaluate(() => X3.voice.state().awakeUntil = 0);
  await sayIt("hey webs continue the story");
  check(await untilN(() => chats.some(b => /part 2 of about 6/.test(b.messages.slice(-1)[0].content) && /small dragon/.test(b.messages.slice(-1)[0].content))) && await said(/flew home/), "#006 it goes on where it stopped");
  await fresh();

  /* #005 translating */
  await sayIt("hey webs how do you say good morning in japanese");
  check(await said(/おはようございます/), "#005 a translation, said");
  await fresh();
  await sayIt("hey webs translator mode to spanish");
  check(await said(/Translator on/), "#005 translator mode");
  await quiet(); await sayIt("where is the station");
  check(await said(/Dónde está la estación/), "#005 everything said is translated, no wake phrase");
  await quiet(); await sayIt("stop translating");
  check(await until(c, () => !X3.assist.mode()), "#005 until you stop it");
  await fresh();

  /* #007 cooking */
  await c.evaluate(() => __host("tab-selected", 1));
  await sayIt("hey webs start cooking");
  check(await said(/Pancakes\. You'll need 3 ingredients: 2 eggs, 200 g flour, 300 ml milk\. There are 3 steps/), "#007 the recipe, read from the page");
  await quiet(); await sayIt("next");
  check(await said(/Step 1\. Whisk the eggs and milk/), "#007 “next”: step 1, no wake phrase");
  await quiet(); await sayIt("how much flour");
  check(await said(/^200 g flour$/), "#007 “how much flour”");
  await quiet(); await sayIt("repeat");
  check(await until(c, () => __spoken.filter(s => /Step 1/.test(s)).length >= 2), "#007 “repeat”");
  await quiet(); await sayIt("next"); await quiet(); await sayIt("next");
  check(await said(/Step 3\. Fry spoonfuls for two minutes a side\. That's the last step/), "#007 the last step");
  await quiet(); await sayIt("stop cooking");
  check(await until(c, () => !X3.assist.mode()), "#007 “stop cooking”");
  await fresh();

  /* #008 pomodoro */
  await sayIt("hey webs start a pomodoro");
  check(await said(/Round 1 of 4/) && await until(c, () => load("pomo", null).phase === "focus" && !!focusState()), "#008 the coach starts round 1 with focus mode");
  await quiet(); await c.evaluate(() => { const p = load("pomo"); p.until = Date.now() - 1; save("pomo", p); });
  check(await spokeIt("Take a 5 minute break", 8000) && await until(c, () => load("pomo").phase === "break" && !focusState()), "#008 then tells you to take a break");
  await quiet(); await c.evaluate(() => { const p = load("pomo"); p.until = Date.now() - 1; save("pomo", p); });
  check(await spokeIt("Round 2: focus", 8000), "#008 and when to get back to it");
  await quiet(); await sayIt("hey webs how long is left");
  check(await said(/left in round 2/), "#008 “how long is left”");
  await quiet(); await sayIt("hey webs stop the pomodoro");
  check(await until(c, () => !load("pomo", null)), "#008 stopped");
  await fresh();

  /* #009 search results */
  await c.evaluate(() => { __feeds["https://html.duckduckgo.com/html/?q=best%20pizza%20in%20lyon"] = '<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fpizza.example%2Fone&rut=x">Pizza One, the best in Lyon</a></div><div class="result result--ad"><a class="result__a" href="https://ad.example/">Ad</a></div><div class="result"><a class="result__a" href="https://slice.example/">Slice House</a></div><div class="result"><a class="result__a" href="https://www.dough.example/">Dough Bros</a></div>'; });
  await sayIt("hey webs read me the results for best pizza in lyon");
  check(await said(/One: Pizza One, the best in Lyon, from pizza\.example\. Two: Slice House, from slice\.example\. Three: Dough Bros, from dough\.example/), "#009 the top three results, read out (no ads)");
  await quiet(); await sayIt("two");
  check(await until(c, () => __sent.some(m => m.startsWith("new-tab\u0001https://slice.example/"))), "#009 “two” opens the second");
  await fresh();

  /* #010 / #023 saved assistants */
  await c.evaluate(() => { cfg.xAsPeople = [{ name:"Friday", wake:"hey friday", call:"Sam", style:"short", voice:"win:Microsoft David" }]; saveNow("settings"); });
  await sayIt("hey friday who are you");
  check(await untilN(() => /name: Friday\ncall them: Sam\nstyle: as brief/.test((chats[chats.length - 1] || { messages:[{ content:"" }] }).messages.slice(-1)[0].content)), "#010 its own wake phrase: that assistant answers, with its own name and person");
  check(await c.evaluate(() => X3.voice.brain.persona().voice === "win:Microsoft David"), "#010 and its own voice");
  await fresh(); await c.evaluate(() => X3.voice.state().who = 0);
  await sayIt("hey webs switch to friday");
  check(await said(/Friday/) && await c.evaluate(() => cfg.xAsActive === 0 && X3.voice.brain.persona().name === "Friday"), "#023 “switch to Friday”");
  await quiet(); await sayIt("hey webs switch back");
  check(await until(c, () => cfg.xAsActive === -1 && X3.voice.brain.persona().name === "Webs"), "#023 and back");
  await sayIt("hey webs switch to tab three");
  check(await until(c, () => __sent.includes("select-tab\u00013")), "“switch to tab three” still switches tabs");
  await fresh();

  /* #011 whisper, #012 seasons */
  await sayIt("hey webs whisper mode");
  check(await until(c, () => cfg.xAsWhisper === "on") && await until(c, () => __vol.includes(0.45)), "#011 whisper: softer");
  await quiet(); await sayIt("hey webs speak normally");
  check(await until(c, () => !cfg.xAsWhisper), "#011 and back");
  check(await c.evaluate(() => /spooky/.test(X3.voice.brain.season(new Date(2026, 9, 10))) && /festive/.test(X3.voice.brain.season(new Date(2026, 11, 3))) && !X3.voice.brain.season(new Date(2026, 4, 10))), "#012 seasonal moods by the date");
  await fresh();

  /* #013 errors, #014 what can I do here */
  await c.evaluate(() => __host("tab-selected", 2));
  await sayIt("hey webs what does this error mean");
  check(await untilN(() => chats.some(b => /404 Not Found\. The requested URL/.test(b.messages.slice(-1)[0].content))) && await said(/404: the page doesn't exist/), "#013 the error on the page, explained");
  await fresh();
  await c.evaluate(() => __host("tab-selected", 4));
  await sayIt("hey webs what can i do here");
  check(await said(/Here you can say: pause, skip 30 seconds, play faster or picture in picture/), "#014 on YouTube: the video commands");
  check(await c.evaluate(() => [...document.querySelectorAll(".asst-act.go")].some(b => /key moments/.test(b.textContent))), "#014 as buttons in the card");
  await fresh();

  /* #015 dictation, #016 fixing it */
  await c.evaluate(() => __host("tab-selected", 3));
  await sayIt("hey webs start dictation");
  check(await said(/Dictation on/) && await until(c, () => X3.assist.mode() === "dictation"), "#015 dictation mode");
  await quiet(); await sayIt("please send the report comma thanks period");
  check(await until(c, () => __typed.some(x => x.t === "Please send the report, thanks.")), "#015 what you say is typed, with punctuation: " + JSON.stringify(await c.evaluate(() => __typed)));
  await sayIt("make that more polite");
  check(await until(c, () => __typed.some(x => x.t === "Would you kindly send the report?" && x.r === "Please send the report, thanks.")), "#016 “make that more polite” replaces it");
  await quiet(); await sayIt("scratch that");
  check(await until(c, () => __typed.some(x => x.t === "" && x.r === "Would you kindly send the report?")), "#015 “scratch that” removes it");
  await sayIt("stop dictation");
  check(await until(c, () => !X3.assist.mode()), "#015 “stop dictation”");
  await c.evaluate(() => { window.__noBox = true; X3.voice.state().awakeUntil = 0; });
  await sayIt("hey webs type hello");
  check(await said(/Click in a text box first/), "#015 no text box: it says so");
  await c.evaluate(() => { window.__noBox = false; });
  await fresh();

  /* #017 chimes, #018 push to talk, #022 quiet hours */
  check(await c.evaluate(() => { ["ding", "soft", "bubble", "scifi", "low", "none"].forEach(k => X3.voice.ding(k)); return Object.keys(X3.voice.CHIMES).length === 5; }), "#017 five chimes (and none)");
  await c.evaluate(() => { cfg.xVoicePTT = true; X3.voice.setOn(false); X3.voice.setOn(true); });
  check(await until(c, () => !X3.voice.state().eng && document.getElementById("vcb").dataset.s === "ptt"), "#018 push to talk: not listening until asked");
  await c.evaluate(() => shortcut(75, false, true, true));
  check(await until(c, () => !!X3.voice.state().eng && X3.voice.state().awakeUntil > Date.now()), "#018 Alt+Shift+K: listening, no wake phrase needed");
  await c.evaluate(() => { X3.voice.state().ptt = 0; X3.voice.state().awakeUntil = 0; });
  check(await until(c, () => !X3.voice.state().eng, 4000), "#018 and off again after");
  await c.evaluate(() => { cfg.xVoicePTT = false; X3.voice.setOn(false); X3.voice.setOn(true); });
  await c.evaluate(() => { const d = new Date(), f = n => String(n).padStart(2, "0"), a = new Date(d - 60000), b = new Date(+d + 3600000); cfg.xVoiceQuiet = { on:true, from:f(a.getHours()) + ":" + f(a.getMinutes()), to:f(b.getHours()) + ":" + f(b.getMinutes()) }; __spoken.length = 0; });
  check(await c.evaluate(() => X3.voice.quietNow()), "#022 quiet hours now");
  await c.evaluate(() => X3.voice.run("what time is it"));
  await wait(300);
  check(await c.evaluate(() => !__spoken.length), "#022 nothing is said during quiet hours");
  await c.evaluate(() => { cfg.xVoiceQuiet = { on:false }; });
  await fresh();

  /* #019 conversation log */
  check(await c.evaluate(() => load("asLog", []).some(x => /quiz me on planets/i.test(x.you) || /Quiz: planets/.test(x.you))), "#019 conversations are logged");
  await sayIt("hey webs show our conversations");
  check(await until(c, () => document.querySelectorAll("#aslog .aslog-row").length >= 3), "#019 “show our conversations”");
  await c.screenshot({ path:SHOTS + "assist-log.png" });
  const nLog = await c.evaluate(() => load("asLog", []).length);
  await c.evaluate(() => document.querySelector("#aslog .aslog-x").click());
  check(await c.evaluate(n => load("asLog", []).length === n - 1, nLog), "#019 delete one");
  await fresh();

  /* #020 history */
  await c.evaluate(() => { hist.unshift({ u:"https://lamps.example/brass", t:"Brass desk lamp | Lamps & Co", ts:Date.now() - 2 * 864e5 }, { u:"https://news.example/a", t:"News", ts:Date.now() - 864e5 }); });
  await sayIt("hey webs what was that lamp site i saw on tuesday");
  check(await said(/I think it was Brass desk lamp \| Lamps & Co, on lamps\.example/), "#020 found in your history, and asks to open it");
  await quiet(); await sayIt("yes");
  check(await until(c, () => __sent.some(m => m.startsWith("new-tab\u0001https://lamps.example/brass"))), "#020 “yes” opens it");
  await fresh();

  /* #021 group tabs */
  await sayIt("hey webs put all the shopping tabs in a group");
  check(await said(/Grouped 2 shopping tabs/) && await c.evaluate(() => { const g = Object.entries(groups).find(([k, v]) => v.name === "Shopping"); return g && T(1).group === g[0] && T(3).group === g[0]; }), "#021 “put all the shopping tabs in a group”");
  await fresh();

  /* #024 ducking */
  await c.evaluate(() => { __host("tab-audio", 4, 1); __ducks.length = 0; });
  await c.evaluate(() => X3.voice.speaker.say("Testing the ducking now."));
  check(await until(c, () => __ducks.includes("4:0.25")), "#024 music in other tabs goes down while it talks");
  check(await until(c, () => __ducks.includes("4:off"), 6000), "#024 and back up after");
  await fresh();

  /* #025 weather, and the volume fix */
  await c.evaluate(() => { cfg.wxCity = "Lyon"; cfg.wxUnit = "c"; });
  await sayIt("hey webs what's the weather");
  check(await said(/It's 18 degrees and partly cloudy in Lyon\. Today: a high of 21 and a low of 12, with a 70 percent chance of rain/), "#025 the weather, said");
  await quiet(); await sayIt("hey webs do i need an umbrella");
  check(await said(/Yes, there's a 70 percent chance of rain today/), "#025 “do I need an umbrella?”");
  await fresh();
  await c.evaluate(() => { __host("tab-selected", 4); });
  await sayIt("hey webs quieter");
  check(await until(c, () => __sent.some(m => m === "media\u00014\u0001tabvol\u00010.8")), "“quieter” turns the volume down a step (it used to mute the tab)");
  await quiet(); await sayIt("hey webs louder");
  check(await until(c, () => __sent.some(m => m === "media\u00014\u0001tabvol\u00011")), "“louder” back up");
  await fresh();

  /* the settings */
  await c.evaluate(() => { X3.voice.voicePanel(); });
  await wait(200);
  await c.evaluate(() => { const d = document.querySelector("#voicep .as-more"); d.open = true; });
  check(await c.evaluate(() => !!document.querySelector("#voicep .as-routines .as-rn") && !!document.querySelector("#voicep .as-people .as-pn") && !!document.querySelector("#voicep .as-ptt") && !!document.querySelector("#voicep .as-qfrom")), "settings: routines, saved assistants, push to talk, quiet hours");
  await c.evaluate(() => { document.querySelector("#voicep .as-more").scrollIntoView(); });
  await c.screenshot({ path:SHOTS + "assist-more.png" });
  await c.evaluate(() => closeOver());

  /* in a page: typing and ducking (shield.more.js) */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const c2 = await browser.newContext();
  await c2.route("https://page.example/**", r => r.fulfill({ status:200, contentType:"text/html", body:'<!doctype html><input id="i" value="Dear Sam, "><div id="ce" contenteditable="true">Hi there</div><textarea id="ta"></textarea><video id="v"></video><audio id="au"></audio>' }));
  await c2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await c2.addInitScript(shield);
  const pg = await c2.newPage(); watch(pg, errors, "page");
  await pg.goto("https://page.example/"); await wait(200);
  await pg.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"page.example", f:0 }));
  const T2 = (a, arg) => pg.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg), [a, arg]);
  const last = () => pg.evaluate(() => { const m = __sent.filter(x => /\u0001tool\u0001/.test(x)).pop(); return m ? JSON.parse(m.split("\u0001")[3]) : null; });
  await pg.evaluate(() => { const i = document.getElementById("i"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
  await T2("x-type", JSON.stringify({ t:"please send it." }));
  check(await pg.evaluate(() => document.getElementById("i").value) === "Dear Sam, please send it." && (await last()).ok === 1, "x-type types at the cursor");
  await T2("x-type", JSON.stringify({ t:"would you send it?", r:"please send it." }));
  check(await pg.evaluate(() => document.getElementById("i").value) === "Dear Sam, would you send it?", "x-type replaces what was typed");
  await pg.evaluate(() => { const e = document.getElementById("ce"); e.focus(); const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await T2("x-type", JSON.stringify({ t:" and welcome" }));
  check(await pg.evaluate(() => document.getElementById("ce").textContent) === "Hi there and welcome", "x-type in an editable box");
  await pg.evaluate(() => document.activeElement.blur());
  await T2("x-type", JSON.stringify({ t:"x" }));
  check((await last()).ok === 0 && (await last()).why === "none", "x-type with no text box: says so");
  await pg.evaluate(() => { document.getElementById("v").volume = 0.8; document.getElementById("au").volume = 1; });
  await T2("x-duck", "0.25");
  check(await pg.evaluate(() => Math.abs(document.getElementById("v").volume - 0.2) < 0.01 && document.getElementById("au").volume === 0.25), "x-duck lowers every video and sound");
  await T2("x-duck", "off");
  check(await pg.evaluate(() => Math.abs(document.getElementById("v").volume - 0.8) < 0.01 && document.getElementById("au").volume === 1), "x-duck off: back as they were");

  console.log(errors.length ? "errors:\n  " + errors.join("\n  ") : "errors: none");
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
