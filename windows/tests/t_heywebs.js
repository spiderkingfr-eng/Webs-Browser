// "Hey Webs" voice control (Windows 3.12, src/voice.chrome.js): over a hundred commands, the wake phrase, both ways of
// listening (the browser's speech recognition and the offline engine, both pretend here), and your own commands.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  // a pretend speech recognition, driven by the test (window.__sr.say(text, final)), and speech that just records
  await ctx.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", { configurable:true, value:{ speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {} } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.__sr = { inst:null, fail:"", say(text, final) { const r = this.inst; if (!r) return; const res = [{ transcript:text }]; res.isFinal = final !== false; r.onresult({ resultIndex:0, results:[res] }); } };
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { const me = this; window.__sr.inst = me; me.start = () => { me.started = true; if (window.__sr.fail) setTimeout(() => { me.onerror({ error:window.__sr.fail }); me.onend(); }, 10); }; me.stop = me.abort = () => { me.started = false; }; };
  });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => { __host("viewport", 1280, 820); __host("tab-created", 1, 0, "https://news.example/story", "", 0, 0); __host("tab-created", 2, 0, "https://video.example/watch", "", 0, 0); __host("tab-created", 3, 0, "https://shop.example/", "", 0, 0); __host("tab-selected", 2); if (overlay) closeOver(); });

  /* ---------------------------------------------------------------- understanding: every command */
  const n = await c.evaluate(() => X3.voice.COMMANDS.length);
  check(n >= 100, "over a hundred commands: " + n);
  const SAY = [
    ["New tab", "newtab"], ["close this tab", "close"], ["close other tabs", "closeothers"], ["reopen the last closed tab", "reopen"], ["next tab", "nexttab"], ["previous tab", "prevtab"], ["go to the first tab", "firsttab"],
    ["switch to tab three", "tabn"], ["tab 2", "tabn"], ["duplicate this tab", "duplicate"], ["pin this tab", "pin"], ["unpin the tab", "pin"], ["mute this tab", "mutetab"], ["mute all tabs", "muteall"], ["put the other tabs to sleep", "sleeptabs"],
    ["show all my tabs", "overview"], ["tab overview", "overview"], ["open a new window", "newwindow"], ["new private window", "private"], ["incognito", "private"], ["split screen", "splitview"],
    ["go back", "back"], ["go forward", "forward"], ["reload the page", "reload"], ["refresh", "reload"], ["hard refresh", "hardreload"], ["stop loading", "stoploading"], ["go home", "home"],
    ["search YouTube for lofi beats", "youtube"], ["play never gonna give you up on youtube", "youtube"], ["show me pictures of puppies", "images"], ["directions to the airport", "maps"], ["Wikipedia black holes", "wiki"],
    ["show me the news", "news"], ["what's the weather like tomorrow", "weather"], ["search amazon for headphones", "shopping"], ["search for pizza near me", "search"], ["google cheap flights", "search"],
    ["scroll down", "down"], ["page up", "up"], ["go to the top", "top"], ["scroll to the bottom", "bottom"], ["zoom in", "zoomin"], ["make it smaller", "zoomout"], ["reset zoom", "zoomreset"],
    ["find recipes on this page", "find"], ["find on page", "findbar"], ["read this page out loud", "read"], ["stop reading", "stopread"], ["be quiet", "stopread"], ["reader mode", "reader"], ["translate this page", "translate"],
    ["print this page", "print"], ["take a screenshot", "screenshot"], ["snip", "screenshotarea"], ["copy the link", "copylink"], ["full screen", "fullscreen"], ["is this site safe", "sitepanel"], ["make this page dark", "darkpage"],
    ["confetti", "confetti"], ["make it snow", "snow"], ["gravity", "gravity"], ["disco mode", "disco"],
    ["pause", "pause"], ["stop the video", "pause"], ["play", "play"], ["resume", "play"], ["skip 30 seconds", "skip"], ["skip ahead two minutes", "skip"], ["go back 10 seconds", "rewind"], ["rewind a minute", "rewind"],
    ["play faster", "faster"], ["slow down", "slower"], ["speed 1.5", "speed"], ["normal speed", "normalspeed"], ["picture in picture", "pip"], ["theater mode", "theater"], ["louder", "louder"], ["volume down", "quieter"],
    ["play some rain sounds", "ambient"], ["fireplace sounds", "ambient"], ["stop the sounds", "stopambient"], ["sleep timer", "sleeptimer"],
    ["bookmark this", "bookmark"], ["read this later", "readlater"], ["show my bookmarks", "bookmarks"], ["open my history", "history"], ["show downloads", "downloads"], ["show my reading list", "reading"],
    ["take a note buy milk", "note"], ["note that the meeting moved to friday", "note"], ["open my notes", "notes"], ["add call mom to my to do list", "todo"], ["remind me about this site", "remindsite"], ["clipboard history", "clipboard"], ["open collections", "collections"],
    ["summarize this page", "summarize"], ["tldr", "summarize"], ["key moments", "keymoments"], ["make flashcards", "study"], ["quiz me", "study"], ["tidy my tabs", "tidy"], ["compare these products", "compare"],
    ["find that page about volcanoes", "findagain"], ["open web ai", "webai"], ["explain this page", "explain"], ["ask web ai how far is the moon", "ask"],
    ["what time is it", "time"], ["what's the date today", "date"], ["what is 12 times 7", "calc"], ["set a timer for 10 minutes", "timer"], ["five minute timer", "timer"], ["show my timers", "timers"],
    ["flip a coin", "coin"], ["roll a die", "dice"], ["pick a number between 1 and 100", "pick"], ["tell me a joke", "joke"], ["what level am i", "level"], ["how much battery", "battery"],
    ["change the theme to naruto", "theme"], ["demon slayer theme", "theme"], ["no anime theme", "notheme"], ["show anime themes", "themes"], ["dark mode", "dark"], ["light mode", "light"], ["start the screensaver", "screensaver"],
    ["wallpaper gallery", "gallery"], ["let's play a game", "games"], ["play chess", "playgame"], ["play sudoku", "playgame"], ["show my achievements", "achievements"], ["show my levels", "levels"],
    ["focus for 25 minutes", "focus"], ["stop focus mode", "stopfocus"], ["what's happening near me", "near"], ["what do websites see about me", "seen"], ["privacy tools", "privacytools"], ["is this shop legit", "shopcheck"],
    ["turn on the vpn", "vpn"], ["phone and pc", "phonepc"], ["send this to my phone", "sendphone"], ["good morning", "routine"], ["fill in my address", "fill"], ["invite a friend", "invite"], ["open settings", "settings"],
    ["what's new", "whatsnew"], ["toggle the sidebar", "sidebar"], ["what can I say", "help"], ["stop listening", "stoplisten"], ["say that again", "repeat"], ["thank you", "thanks"], ["hello", "hello"],
    ["stop talking back", "talkoff"], ["talk back", "talkon"], ["open YouTube", "open"], ["go to reddit", "open"], ["open github in a new tab", "open"],
    ["Please, could you open a new tab for me?", "newtab"], ["um can you scroll down please", "down"]];
  const got = await c.evaluate(list => list.map(([t]) => { const p = X3.voice.parse(t); return p ? p.id : null; }), SAY);
  const wrong = SAY.filter((x, i) => got[i] !== x[1]).map((x, i) => x[0] + " → " + got[SAY.indexOf(x)] + " (want " + x[1] + ")");
  check(!wrong.length, SAY.length + " phrases understood" + (wrong.length ? ": " + wrong.join("; ") : ""));
  check(await c.evaluate(() => [X3.voice.calc("12 times 7"), X3.voice.calc("one hundred divided by four"), X3.voice.calc("2 to the power of 10"), X3.voice.calc("fifteen percent of 80"), X3.voice.calc("the moon")].join()) === "84,25,1024,12,",
    "sums in words");
  check(await c.evaluate(() => [X3.voice.secs("10 minutes"), X3.voice.secs("an hour and 30 minutes"), X3.voice.secs("ninety seconds"), X3.voice.num("twenty five")].join()) === "600,5400,90,25", "times and numbers in words");

  /* ---------------------------------------------------------------- doing it */
  const run = async t => { await c.evaluate(() => { __sent.length = 0; }); const r = await c.evaluate(t => X3.voice.run(t), t); await wait(50); return { r, sent:await c.evaluate(() => __sent.slice()) }; };
  let x = await run("new tab");
  check(x.sent.some(m => m.startsWith("new-tab\u0001")) && x.r === "New tab", "“new tab”");
  x = await run("scroll down");
  check(x.sent.includes("page-tool\u00012\u0001x-scrollto\u0001down"), "“scroll down” scrolls the page you're on");
  x = await run("skip 30 seconds");
  check(x.sent.includes("media\u00012\u0001seek\u000130") && /Skipped 30/.test(x.r), "“skip 30 seconds”");
  x = await run("go back 10 seconds");
  check(x.sent.includes("media\u00012\u0001seek\u0001-10"), "“go back 10 seconds”");
  x = await run("speed one point five");
  x = await run("speed 1.5");
  check(x.sent.includes("media\u00012\u0001speed\u00011.5"), "“speed 1.5”");
  x = await run("search youtube for lofi beats");
  check(x.sent.some(m => m.startsWith("new-tab\u0001https://www.youtube.com/results?search_query=lofi%20beats")), "“search YouTube for…”");
  x = await run("find recipes on this page");
  check(x.sent.includes("find\u00012\u0001recipes\u00011\u00010"), "“find recipes on this page” finds on the page (not a web search)");
  x = await run("switch to tab three");
  check(x.sent.includes("select-tab\u00013"), "“switch to tab three”");
  x = await run("tab nine");
  check(/There's no tab nine/.test(x.r), "a tab that isn't there: says so");
  x = await run("what is 12 times 7");
  check(x.r === "12 times 7 is 84", "“what is 12 times 7” answers: " + x.r);
  check(await c.evaluate(() => __spoken[__spoken.length - 1] === "12 times 7 is 84"), "out loud");
  x = await run("set a timer for 10 minutes");
  check(await c.evaluate(() => load("timers", []).some(t => t.secs === 600)) && /10 minutes/.test(x.r), "“set a timer for 10 minutes”");
  x = await run("take a note buy milk");
  check(await c.evaluate(() => load("notes", [])[0].t === "buy milk"), "“take a note buy milk”");
  x = await run("add call mom to my to do list");
  check(await c.evaluate(() => load("todo", [])[0].t === "call mom"), "“add call mom to my to-do list”");
  x = await run("change the theme to naruto");
  check(await c.evaluate(() => cfg.anime === "naruto"), "“change the theme to Naruto”");
  x = await run("play some rain sounds");
  check(await c.evaluate(() => cfg.ambient === "rain") && /Rain/.test(x.r), "“play some rain sounds”");
  await run("stop the sounds");
  x = await run("what is the capital of australia");
  check(x.r === "Asking Web AI" && await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.xaiBarQ")).q === "what is the capital of australia"), "a question nothing else answers goes to Web AI");
  x = await run("blah blah wibble");
  check(/didn't catch that/.test(x.r), "something it doesn't know: says so");
  x = await run("open youtube");
  check(x.sent.some(m => m.startsWith("navigate\u00012\u0001") && /youtube\.com/.test(m)) || x.sent.some(m => /youtube\.com/.test(m)), "“open YouTube”");
  await c.evaluate(() => { __host("tab-created", 4, 0, "about:blank", "", 0, 0); __host("tab-selected", 4); });
  x = await run("scroll down");
  check(x.r === "Open a web page first", "a page command with no page: says so");
  await c.evaluate(() => { __host("tab-selected", 2); });

  /* ---------------------------------------------------------------- listening for "Hey Webs" */
  await c.evaluate(() => X3.voice.setOn(true)); await wait(100);
  check(await c.evaluate(() => X3.voice.state().on && X3.voice.state().engine === "web" && __sr.inst && __sr.inst.started && __sr.inst.continuous), "on: the browser's speech recognition keeps listening");
  await c.evaluate(() => { __sent.length = 0; __sr.say("so anyway I was telling her about the new tab", true); }); await wait(100);
  check(await c.evaluate(() => !__sent.some(m => m.startsWith("new-tab"))), "talking without the wake phrase: nothing happens");
  await c.evaluate(() => { __sr.say("hey webs", true); }); await wait(100);
  check(await c.evaluate(() => document.getElementById("vcb").dataset.s === "awake"), "“Hey Webs”: it's awake (the button glows)");
  await c.screenshot({ path:SHOTS + "heywebs-awake.png", clip:{ x:700, y:0, width:580, height:90 } });
  await c.evaluate(() => { __sr.say("new tab", true); }); await wait(150);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("new-tab"))), "…then a command: done");
  await wait(600);      // (it doesn't listen while it's talking)
  await c.evaluate(() => { __sent.length = 0; __sr.say("hey web scroll down", false); }); await wait(60);
  check(await c.evaluate(() => !__sent.length && /scroll down/.test(document.querySelector("#vcb .vcl").textContent)), "what it hears shows as you speak");
  await c.evaluate(() => { __sr.say("hey web scroll down", true); }); await wait(150);
  check(await c.evaluate(() => __sent.includes("page-tool\u00012\u0001x-scrollto\u0001down")), "“Hey Webs, scroll down” in one breath (even heard as “hey web”)");
  await wait(600);
  await c.evaluate(() => { cfg.xVoiceWake = "okay browser"; __sent.length = 0; __sr.say("okay browser go back", true); }); await wait(150);
  check(await c.evaluate(() => __sent.includes("back\u00012")), "your own wake phrase");
  await c.evaluate(() => { cfg.xVoiceWake = ""; });
  // its own voice isn't heard as a command
  await c.evaluate(() => { X3.voice.state().talking = true; __sent.length = 0; __sr.say("hey webs new tab", true); X3.voice.state().talking = false; }); await wait(60);
  check(await c.evaluate(() => !__sent.length), "Webs talking: not heard as a command");
  // hidden window: stops, back: starts
  await c.evaluate(() => { Object.defineProperty(document, "hidden", { configurable:true, get:() => true }); document.dispatchEvent(new Event("visibilitychange")); });
  check(await c.evaluate(() => !X3.voice.state().eng), "another window in front: not listening");
  await c.evaluate(() => { Object.defineProperty(document, "hidden", { configurable:true, get:() => false }); document.dispatchEvent(new Event("visibilitychange")); });
  check(await c.evaluate(() => !!X3.voice.state().eng), "back in front: listening again");
  await wait(600);
  await c.evaluate(() => { __sr.say("hey webs stop listening", true); }); await wait(150);
  check(await c.evaluate(() => !X3.voice.state().on && !cfg.xVoice), "“Hey Webs, stop listening”");

  /* ---------------------------------------------------------------- when speech recognition doesn't work here: the offline engine */
  await c.evaluate(() => { __sr.fail = "network"; X3.voice.setOn(true); }); await wait(200);
  await c.evaluate(() => { __sr.inst.onerror({ error:"network" }); __sr.inst.onerror({ error:"network" }); }); await wait(100);
  check(await c.evaluate(() => X3.voice.state().err === "web" && document.getElementById("vcb").dataset.s === "err"), "speech recognition failing: it says the offline engine is needed");
  await c.evaluate(() => X3.voice.voicePanel()); await wait(100);
  check(await c.evaluate(() => !!document.querySelector("#voicep .vc-off") && /40 MB/.test(document.querySelector("#voicep").textContent)), "the panel offers the offline engine (40 MB, once)");
  // a pretend Vosk and microphone
  await c.evaluate(() => {
    window.__rec = null;
    window.Vosk = { createModel:async url => { window.__modelUrl = url; return { KaldiRecognizer:function (rate) { const h = {}; this.on = (t, f) => { h[t] = f; }; this.acceptWaveform = () => {}; this.emit = (t, m) => h[t](m); window.__rec = this; }, terminate() {} }; } };
    navigator.mediaDevices.getUserMedia = async () => { const ac = new AudioContext(), d = ac.createMediaStreamDestination(); return d.stream; };
  });
  await c.evaluate(() => document.querySelector("#voicep .vc-off").click());
  check(await until(c, () => X3.voice.state().engine === "offline" && !!window.__rec), "the offline engine starts");
  check(await c.evaluate(() => /vosk-model-small-en-us/.test(window.__modelUrl) && cfg.xVoiceOffline === true), "with the small English model, and remembered");
  await c.evaluate(() => { __sent.length = 0; __rec.emit("result", { result:{ text:"hey webs next tab" } }); }); await wait(150);
  check(await c.evaluate(() => __sent.includes("select-tab\u00013")), "a command heard by the offline engine");
  // turned off while the offline engine is still loading: the microphone is not left open
  await c.evaluate(() => { closeOver(); X3.voice.stopMeter(); }); await wait(100);
  await c.evaluate(() => {
    X3.voice.setOn(false); window.__open = 0; window.__gate = null;
    const cm = window.__cm = Vosk.createModel; Vosk.createModel = url => new Promise(r => { window.__gate = () => r(cm(url)); });
    navigator.mediaDevices.getUserMedia = async () => { window.__open++; const ac = new AudioContext(), d = ac.createMediaStreamDestination(); const s = d.stream; s.getTracks().forEach(t => { const st = t.stop.bind(t); t.stop = () => { window.__open--; st(); }; }); return s; };
    X3.voice.setOn(true); X3.voice.setOn(false); X3.voice.setOn(true); X3.voice.setOn(false);
  });
  await until(c, () => !!window.__gate); await c.evaluate(() => __gate()); await wait(300);
  check(await c.evaluate(() => window.__open === 0 && !X3.voice.state().eng && !X3.voice.state().loading), "voice turned off while the offline engine loads: no microphone left open");
  await c.evaluate(() => { X3.voice.setOn(true); }); await until(c, () => !!window.__gate); await c.evaluate(() => __gate());
  check(await until(c, () => X3.voice.state().engine === "offline" && !!X3.voice.state().eng && window.__open === 1), "and on again: one engine, one microphone");
  // switching the engine on the Settings page takes effect at once
  await c.evaluate(() => { cfg.xVoiceOffline = false; saveNow("settings"); reloadSettings(); });
  check(await until(c, () => X3.voice.state().engine === "web" && window.__open === 0), "Settings: back to Windows' speech recognition at once");
  await c.evaluate(() => { closeOver(); X3.voice.setOn(false); __sr.fail = ""; cfg.xVoiceOffline = false; Vosk.createModel = __cm; });

  /* ---------------------------------------------------------------- your own commands, and the panel */
  await c.evaluate(() => X3.voice.voicePanel(true)); await wait(100);
  check(await c.evaluate(() => document.querySelectorAll("#voicep .vc-list li").length >= 100 && /What you can say \(\d{3}/.test(document.querySelector("#voicep").textContent)), "the panel lists every command");
  await c.fill("#voicep .vc-say", "study time"); await c.fill("#voicep .vc-do", "open khanacademy.org then focus for 25 minutes");
  await c.evaluate(() => document.querySelector("#voicep .vc-add button").click()); await wait(50);
  check(await c.evaluate(() => cfg.xVoiceCustom.length === 1 && /study time/.test(document.querySelector("#voicep .vc-mine").textContent)), "your own command, kept");
  await c.screenshot({ path:SHOTS + "heywebs-panel.png" });
  await c.fill("#voicep .vc-say", "nonsense"); await c.fill("#voicep .vc-do", "frobnicate the widgets");
  await c.evaluate(() => document.querySelector("#voicep .vc-add button").click()); await wait(50);
  check(await c.evaluate(() => cfg.xVoiceCustom.length === 1 && /doesn't know/.test(document.getElementById("toast").textContent)), "one Webs can't do isn't kept");
  x = await run("study time");
  check(x.sent.some(m => /khanacademy/.test(m)) && await c.evaluate(() => !!load("focus", null)) && x.r === "Done: study time", "“study time” does both");
  await c.evaluate(() => X3.voice.voicePanel()); await wait(100);
  await c.fill("#voicep .vc-try", "zoom in"); await c.evaluate(() => { __sent.length = 0; document.querySelector("#voicep .vc-go").click(); }); await wait(100);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("zoom\u0001"))), "Try it: typing a command");
  check(await c.evaluate(() => { const m = document.createElement("div"); X3.menuRows(m); return /Voice control/.test(m.textContent) && commands().some(x => /Hey Webs/.test(x.t)); }), "Menu → Voice control, and in the command list");
  // Alt+Shift+M, from the window or from a page
  await c.evaluate(() => { closeOver(); shortcut(77, false, true, true); });
  check(await c.evaluate(() => X3.voice.state().on), "Alt+Shift+M turns it on");
  await c.evaluate(() => __host("tool-result", 2, JSON.stringify({ a:"x-key", k:"M" })));
  check(await c.evaluate(() => !X3.voice.state().on), "and off again from a page");

  /* ---------------------------------------------------------------- choosing the microphone */
  await c.evaluate(() => {
    window.__gum = [];
    window.__devs = [{ kind:"audioinput", deviceId:"default", label:"Default" }, { kind:"audioinput", deviceId:"mic-usb", label:"Blue Yeti USB Microphone" }, { kind:"audioinput", deviceId:"mic-cam", label:"Webcam Microphone" }, { kind:"videoinput", deviceId:"cam", label:"Webcam" }];
    navigator.mediaDevices.enumerateDevices = async () => window.__devs;
    navigator.mediaDevices.getUserMedia = async c => { window.__gum.push(JSON.stringify(c.audio)); const id = c.audio && c.audio.deviceId && c.audio.deviceId.exact;
      if (id && !window.__devs.some(d => d.deviceId === id)) throw Object.assign(new Error("gone"), { name:"OverconstrainedError" });
      const ac = new AudioContext(), d = ac.createMediaStreamDestination(); const s = d.stream; s.__id = id || "default"; return s; };
    __sr.startArgs = [];
    const SR0 = window.webkitSpeechRecognition;
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { SR0.call(this); const me = this, st = me.start; me.start = t => { __sr.startArgs.push(t ? "track" : "none"); if (t && __sr.noTrack) throw new TypeError("no track support"); st(); }; };
    X3.voice.voicePanel();
  });
  check(await until(c, () => [...document.querySelectorAll("#voicep .vc-mic option")].map(o => o.textContent).join("|") === "Windows' default microphone|Blue Yeti USB Microphone|Webcam Microphone"), "the panel lists your microphones (not cameras)");
  check(await c.evaluate(() => !!document.querySelector("#voicep .vc-meter i")), "with a level meter to see it's the right one");
  await c.screenshot({ path:SHOTS + "heywebs-mics.png" });
  await c.evaluate(() => { const s = document.querySelector("#voicep .vc-mic"); s.value = "mic-usb"; s.dispatchEvent(new Event("change")); }); await wait(100);
  check(await c.evaluate(() => cfg.xVoiceMic === "mic-usb" && cfg.xVoiceMicName === "Blue Yeti USB Microphone" && /Using Blue Yeti/.test(document.getElementById("toast").textContent)), "picking one: remembered");
  check(await c.evaluate(() => __gum.some(g => /"exact":"mic-usb"/.test(g))), "the meter listens to it");
  await c.evaluate(() => { __gum.length = 0; __sr.startArgs = []; closeOver(); X3.voice.setOn(true); }); await wait(200);
  check(await c.evaluate(() => __gum.some(g => /"exact":"mic-usb"/.test(g)) && __sr.startArgs[0] === "track" && X3.voice.state().engine === "web"), "listening uses that microphone (handed to the recognition)");
  await c.evaluate(() => { __sent.length = 0; __sr.say("hey webs next tab", true); }); await wait(150);
  check(await c.evaluate(() => __sent.some(m => m.startsWith("select-tab"))), "and commands still work");
  await c.evaluate(() => X3.voice.setOn(false));
  // where the recognition can't take a chosen mic: the offline engine can
  await c.evaluate(() => { __sr.noTrack = true; X3.voice.setOn(true); }); await wait(200);
  check(await c.evaluate(() => X3.voice.state().err === "choose" && /default microphone/.test(document.getElementById("toast").textContent)), "if Windows' recognition can't use it: says so, and offers the offline engine");
  await c.evaluate(() => { __gum.length = 0; X3.voice.voicePanel(); });
  check(await until(c, () => /can only listen to the default microphone/.test(document.querySelector("#voicep").textContent)), "the panel explains it");
  await c.evaluate(() => document.querySelector("#voicep .vc-off").click());
  check(await until(c, () => X3.voice.state().engine === "offline" && __gum.some(g => /"exact":"mic-usb"/.test(g))), "the offline engine listens to your chosen microphone");
  await c.evaluate(() => { closeOver(); X3.voice.setOn(false); cfg.xVoiceOffline = false; __sr.noTrack = false; });
  // unplugged: the default, and it says so
  await c.evaluate(() => { __devs = __devs.filter(d => d.deviceId !== "mic-usb"); __gum.length = 0; X3.voice.setOn(true); }); await wait(250);
  check(await c.evaluate(() => /Blue Yeti USB Microphone isn't plugged in/.test(document.getElementById("toast").textContent) && __gum.some(g => !/exact/.test(g)) && X3.voice.state().eng), "your mic unplugged: Windows' default, and Webs says so");
  await c.evaluate(() => X3.voice.voicePanel());
  check(await until(c, () => /Blue Yeti USB Microphone \(not plugged in\)/.test(document.querySelector("#voicep .vc-mic").textContent)), "the picker shows it's not plugged in");
  await c.evaluate(() => { const s = document.querySelector("#voicep .vc-mic"); s.value = ""; s.dispatchEvent(new Event("change")); closeOver(); X3.voice.setOn(false); });
  check(await c.evaluate(() => cfg.xVoiceMic === "" && /Windows' default/.test(document.getElementById("toast").textContent) || cfg.xVoiceMic === ""), "back to Windows' default");

  /* ---------------------------------------------------------------- Settings */
  const st = await ctx.newPage(); watch(st, errors, "settings");
  await st.goto("https://browser.example/settings.html"); await wait(400);
  check(await st.evaluate(() => !!document.getElementById("xVoice") && document.getElementById("xVoiceTalk").classList.contains("on")), "Settings: Voice control");

  console.log(errors.length ? "errors:\n  " + errors.join("\n  ") : "errors: none");
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
