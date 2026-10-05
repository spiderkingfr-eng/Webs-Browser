// The assistant (Windows 3.13, src/assistant.chrome.js): Hey Webs with Web AI behind it, speaking in Adam (ElevenLabs,
// through the Web AI server's /speak) or a Windows voice, doing things with [[do: …]] lines, and listening for follow-ups.
// The Web AI server, Claude and ElevenLabs are pretend here.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const untilN = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(60); } return false; };
// a short silent sound, as the pretend Adam
function wav(ms) {
  const n = Math.round(8000 * ms / 1000), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
(async () => {
  const browser = await chromium.launch({ args:["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:820 } });
  await setup(ctx);
  const chats = [], speaks = [];
  let answer = "Paris, of course.", speakStatus = 200, chatStatus = 200, voiceFeature = true;
  await ctx.route("https://w.test/**", async r => {
    const u = new URL(r.request().url()), H = { "access-control-allow-origin":"*" };
    if (u.pathname === "/") return r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, features:voiceFeature ? ["assistant", "voice"] : ["assistant"] }) });
    if (u.pathname === "/speak") {
      speaks.push(JSON.parse(r.request().postData()));
      if (speakStatus !== 200) return r.fulfill({ status:speakStatus, headers:H, contentType:"application/json", body:JSON.stringify({ error:speakStatus === 503 ? "novoice" : "limit", message:speakStatus === 503 ? "The Web AI server has no voice key yet." : "The voice has talked enough for today." }) });
      return r.fulfill({ status:200, headers:H, contentType:"audio/mpeg", body:wav(120) });
    }
    if (u.pathname === "/chat") {
      chats.push(JSON.parse(r.request().postData()));
      if (chatStatus !== 200) return r.fulfill({ status:chatStatus, headers:H, contentType:"application/json", body:JSON.stringify({ error:"limit", message:"You've asked your 25 questions for today.", left:0 }) });
      const parts = answer.match(/[\s\S]{1,7}/g) || [];
      return r.fulfill({ status:200, headers:H, contentType:"application/x-ndjson", body:parts.map(d => JSON.stringify({ d })).join("\n") + "\n" + JSON.stringify({ end:1, stop:"end_turn", left:20 }) + "\n" });
    }
    r.fulfill({ status:404, headers:H, body:"{}" });
  });
  await ctx.addInitScript(() => {
    if (location.hostname !== "browser.example") return;
    try { localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {}
    window.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", { configurable:true, value:{ speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() { window.__cancelled = (window.__cancelled || 0) + 1; }, getVoices:() => [{ name:"Microsoft Ryan Online (Natural) - English (United Kingdom)", lang:"en-GB" }, { name:"Microsoft David", lang:"en-US" }], addEventListener() {} } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.__sr = { inst:null, say(text, final) { const r = this.inst; if (!r) return; const res = [{ transcript:text }]; res.isFinal = final !== false; r.onresult({ resultIndex:0, results:[res] }); } };
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { const me = this; window.__sr.inst = me; me.start = () => { me.started = true; }; me.stop = me.abort = () => { me.started = false; }; };
  });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => { __host("viewport", 1280, 820); __host("tab-created", 1, 0, "https://news.example/story", "", 0, 0); __host("tab-title", 1, "Big news story"); __host("tab-created", 2, 0, "https://video.example/watch", "", 0, 0); __host("tab-title", 2, "A video"); __host("tab-selected", 1); X3.voice.setOn(true); closeOver();
    window.__layouts = []; const pm = chrome.webview.postMessage; chrome.webview.postMessage = m => { if (/^layout\u0001/.test(String(m))) __layouts.push(String(m).split("\u0001")); return pm(m); }; });
  await wait(200);
  const sayIt = async text => { await c.evaluate(t => { __sent.length = 0; __sr.say(t, true); }, text); };
  const quiet = () => until(c, () => !X3.voice.speaker.busy() && !X3.voice.state().talking, 6000);

  /* ---------------------------------------------------------------- a question: Web AI answers, in Adam's voice */
  check(await c.evaluate(() => X3.voice.brain && X3.voice.brain.on()), "the assistant is on with Web AI connected");
  answer = "Paris, of course. It has been the capital since the tenth century.";
  await sayIt("hey webs what's the capital of france");
  check(await until(c, () => document.querySelector(".asst") && !document.querySelector(".asst").classList.contains("hide")), "a card shows the conversation");
  check(await until(c, () => /tenth century/.test(document.querySelector(".asst-text").textContent)), "with the answer, as it's written");
  check(chats.length === 1 && chats[0].task === "jarvis", "asked as the assistant's job");
  // where it shows: the bottom right of the window, and the window is told so the card can be seen and clicked
  await quiet(); await wait(300);
  const pos = await c.evaluate(() => { const b = document.querySelector(".asst").getBoundingClientRect(), l = __sent.filter(m => m.startsWith("layout\u0001")).pop() || window.__lastLayout || ""; return { top:b.top, bottom:b.bottom, right:b.right, layout:l.split("\u0001") }; });
  const lay = await c.evaluate(() => __layouts[__layouts.length - 1]);
  check(lay && +lay[2] >= pos.bottom && lay[4].split(";").some(r => { const [x, y, w, h] = r.split(",").map(Number); return Math.abs(y - pos.top) <= 2 && Math.abs(y + h - pos.bottom) <= 3 && w > 300; }), "the window gives the card room: " + JSON.stringify(lay));
  check(Math.abs(pos.bottom - 804) <= 2 && Math.abs(pos.right - 1264) <= 2 && pos.top > 90, "the card sits at the bottom right of the window, not up in the toolbar: " + JSON.stringify([pos.top, pos.bottom, pos.right]));
  const m0 = chats[0].messages[chats[0].messages.length - 1].content;
  check(/<assistant>[\s\S]*name: Webs/.test(m0) && /<now>[\s\S]*This tab: Big news story \(https:\/\/news\.example\/story\)/.test(m0) && /Other tabs: A video/.test(m0), "it knows its name, the time and your tabs");
  check(/<commands>[\s\S]*Tabs and windows: new tab · close this tab/.test(m0) && !/fill in my address/.test(m0) && /They said: what's the capital of france$/.test(m0), "and what it can do");
  check(await untilN(() => speaks.length >= 2) && speaks.length === 2 && speaks[0].text === "Paris, of course." && /tenth century\.$/.test(speaks[1].text) && !speaks[0].voice, "said a sentence at a time, in Adam's voice");
  check(await quiet(), "it finishes talking");
  check(await c.evaluate(() => !__spoken.length), "no Windows voice when Adam talks");
  check(await c.evaluate(() => X3.voice.state().awakeUntil > Date.now() && document.querySelector(".asst").dataset.s === "follow"), "then listens for a follow-up");
  // a follow-up, no wake phrase: it remembers the conversation
  answer = "About two point one million people live there.";
  await sayIt("how many people live there");
  check(await untilN(() => chats.length === 2), "a follow-up needs no wake phrase");
  check(chats[1].messages.length === 3 && /capital of france/.test(chats[1].messages[0].content) && /tenth century/.test(chats[1].messages[1].content), "and it remembers what you were talking about");
  await quiet();

  /* ---------------------------------------------------------------- doing things */
  answer = "Opening YouTube and setting your timer.\n[[do: open youtube]]\n[[do: set a timer for 5 minutes]]\nAnything else?";
  await sayIt("hey webs put on youtube and give me five minutes");
  check(await until(c, () => document.querySelectorAll(".asst-act").length === 2), "it does things");
  check(await c.evaluate(() => __sent.some(m => /youtube\.com/.test(m)) && !!load("timers", []).length || __sent.some(m => /youtube\.com/.test(m))), "opens YouTube");
  check(await c.evaluate(() => [...document.querySelectorAll(".asst-act")].every(a => /^✓/.test(a.textContent))), "each action shows it worked");
  check(await untilN(() => speaks.some(s => s.text === "Anything else?")) && speaks.some(s => s.text === "Opening YouTube and setting your timer.") && speaks.some(s => s.text === "Anything else?") && !speaks.some(s => /\[\[/.test(s.text)), "and only the words are said");
  await quiet();
  check(await c.evaluate(() => X3.voice.state().awakeUntil - Date.now() > 7000), "a question back: it listens a little longer");
  await c.screenshot({ path:SHOTS + "assistant.png" });
  // what it must not do on its own, and what it doesn't know
  answer = "[[do: fill in my address]] [[do: frobnicate the widgets]] I can't do that one.";
  await sayIt("hey webs fill my address and frobnicate");
  check(await until(c, () => document.querySelectorAll(".asst-act").length === 2), "two actions asked");
  check(await c.evaluate(() => [...document.querySelectorAll(".asst-act")].every(a => /^✗/.test(a.textContent)) && !__sent.some(m => /x-fill/.test(m))), "filling in forms and unknown commands: not done");
  await quiet();

  /* ---------------------------------------------------------------- commands still go straight through */
  const before = chats.length;
  await sayIt("hey webs next tab");
  await wait(200);
  check(chats.length === before && await c.evaluate(() => __sent.some(m => m === "select-tab\u00012")), "a voice command doesn't ask Web AI");
  check(await untilN(() => speaks.length > 0 && speaks[speaks.length - 1].text !== "Anything else?"), "its reply is said in the assistant's voice too");
  await quiet();

  /* ---------------------------------------------------------------- stopping it */
  answer = "Here is a very long story. " + "It goes on and on. ".repeat(12);
  await sayIt("hey webs tell me a long story");
  check(await until(c, () => X3.voice.state().talking), "talking");
  const n0 = speaks.length;
  await sayIt("hey webs");
  check(await until(c, () => !X3.voice.speaker.busy()), "saying its name stops it");
  await wait(400);
  check(speaks.length - n0 < 3 || await c.evaluate(() => !X3.voice.speaker.busy()), "and the rest of the answer isn't said");
  await c.evaluate(() => X3.voice.state().awakeUntil = 0);
  answer = "Here is another long story. " + "It goes on and on. ".repeat(12);
  await sayIt("hey webs another story");
  await until(c, () => X3.voice.state().talking);
  await c.evaluate(() => document.querySelector(".asst-x").click());
  check(await c.evaluate(() => !X3.voice.speaker.busy() && document.querySelector(".asst").classList.contains("hide")), "✕ stops it and hides the card");
  check(await c.evaluate(() => { const l = __layouts[__layouts.length - 1]; return +l[2] < 200 && !l[4]; }), "and gives the room back");

  /* ---------------------------------------------------------------- typing to it */
  answer = "Typing works too.";
  await c.evaluate(() => { X3.voice.hud.open(); const i = document.querySelector(".asst-type input"); i.value = "can you hear me"; document.querySelector(".asst-type").requestSubmit(); });
  check(await until(c, () => /Typing works too/.test(document.querySelector(".asst-text").textContent)), "typing to it in the card");
  await quiet();

  /* ---------------------------------------------------------------- the voice */
  speakStatus = 503;
  answer = "No voice key here.";
  await c.evaluate(() => { __spoken.length = 0; X3.voice.state().awakeUntil = 0; });
  await sayIt("hey webs say something");
  check(await until(c, () => __spoken.includes("No voice key here.")), "no voice key on the server: a Windows voice says it");
  check(await c.evaluate(() => /no voice key/i.test(document.getElementById("toast").textContent)), "and says why once");
  await quiet();
  speakStatus = 200; const s0 = speaks.length;
  await c.evaluate(() => { cfg.xAsVoice = "win:Microsoft David"; __spoken.length = 0; X3.voice.state().awakeUntil = 0; });
  answer = "A Windows voice.";
  await sayIt("hey webs which voice is this");
  check(await until(c, () => __spoken.includes("A Windows voice.")) && speaks.length === s0, "a Windows voice chosen: Adam isn't asked");
  await quiet();
  await c.evaluate(() => { cfg.xAsVoice = "adam"; });

  /* ---------------------------------------------------------------- the panel */
  await c.evaluate(() => X3.voice.voicePanel()); await wait(200);
  check(await c.evaluate(() => !!document.querySelector("#voicep .vc-asst .as-on") && document.querySelector("#voicep .as-voice").options[0].textContent === "Adam (ElevenLabs)" && [...document.querySelector("#voicep .as-voice").options].some(o => /Ryan Online/.test(o.textContent))), "Voice control → Assistant: Adam or a Windows voice");
  await c.fill("#voicep .as-name", "Jarvis"); await c.evaluate(() => document.querySelector("#voicep .as-name").dispatchEvent(new Event("change")));
  await c.fill("#voicep .as-call", "sir"); await c.evaluate(() => document.querySelector("#voicep .as-call").dispatchEvent(new Event("change")));
  await c.selectOption("#voicep .as-style", "short");
  check(await c.evaluate(() => cfg.xAsName === "Jarvis" && cfg.xAsCall === "sir" && cfg.xAsStyle === "short" && load("settings", {}).xAsName === "Jarvis"), "its name, what it calls you and its personality, kept");
  await c.screenshot({ path:SHOTS + "assistant-panel.png" });
  const s1 = speaks.length;
  await c.evaluate(() => document.querySelector("#voicep .as-test").click());
  check(await untilN(() => speaks.length > s1) && /^Good (morning|afternoon|evening), sir\. Jarvis here\./.test(speaks[s1].text), "▶ Hear it");
  await quiet();
  await c.evaluate(() => closeOver());
  answer = "Yes sir.";
  await c.evaluate(() => X3.voice.state().awakeUntil = 0);
  await sayIt("hey webs are you there");
  check(await untilN(() => chats.length && /name: Jarvis\ncall them: sir\nstyle: as brief/.test(chats[chats.length - 1].messages.slice(-1)[0].content)), "the next question uses them");
  check(await c.evaluate(() => document.querySelector(".asst-top b").textContent === "Jarvis"), "and the card shows its name");
  await quiet();

  /* ---------------------------------------------------------------- when Web AI can't answer, and turned off */
  chatStatus = 429;
  await c.evaluate(() => X3.voice.state().awakeUntil = 0);
  await sayIt("hey webs what's the meaning of life");
  check(await untilN(() => speaks.some(s => /25 questions/.test(s.text))) && await c.evaluate(() => document.querySelector(".asst").dataset.s === "error"), "out of questions: it says so");
  await quiet();
  chatStatus = 200;
  await c.evaluate(() => { cfg.xAssistant = false; X3.voice.state().awakeUntil = 0; __sent.length = 0; });
  const c0 = chats.length;
  await sayIt("hey webs what is the tallest mountain in the world");
  await wait(300);
  check(chats.length === c0 && await c.evaluate(() => /what is the tallest mountain/.test(JSON.parse(localStorage.getItem("wsb.xaiBarQ") || "{}").q || "")), "assistant off: questions go to the Web AI sidebar as before");
  check(await c.evaluate(() => !X3.voice.brain.on()), "and it isn't on");
  await c.evaluate(() => { cfg.xAssistant = true; });

  /* ---------------------------------------------------------------- as in the real window: the toolbar's view is only as tall as the toolbar */
  await c.setViewportSize({ width:1280, height:90 }); await wait(100);
  await c.evaluate(() => { closeOver(); X3.voice.hud.close(); X3.voice.hud.open(); X3.voice.hud.text("Still at the bottom of the window."); X3.voice.hud.state("idle"); });
  await wait(400);
  const small = await c.evaluate(() => { const a = document.querySelector(".asst"); return { top:a.offsetTop, bottom:a.offsetTop + a.offsetHeight, l:__layouts[__layouts.length - 1] }; });
  check(Math.abs(small.bottom - 804) <= 2 && small.l && +small.l[2] >= 804, "with the toolbar's view 90px tall, the card is still at the window's bottom and asks for the room: " + JSON.stringify(small));
  await c.evaluate(() => X3.voice.hud.close());
  console.log(errors.length ? "errors:\n  " + errors.join("\n  ") : "errors: none");
  check(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
