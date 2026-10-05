/* ---------------------------------------------------------------- Webs 3.13: the assistant
   "Hey Webs" with Web AI behind it: what isn't one of the voice commands becomes a conversation. The answer is
   spoken a sentence at a time while it's still being written, in "Adam" (an ElevenLabs stock voice, through the
   Web AI server's /speak, when the server has a voice key) or a Windows voice, and it can do things: the answer
   may carry [[do: command]] lines, which run as voice commands. After it answers it keeps listening for a few
   seconds, so a follow-up needs no wake phrase; saying the wake phrase while it talks stops it.
   Settings (cfg): xAssistant (on), xAsName, xAsCall (what it calls you), xAsStyle, xAsVoice ("adam", or
   "win:<voice name>"), xAsVoiceId (another ElevenLabs voice), xAsFx (the "suit" effect), xAsRate, xAsFollow. */
(function () {
"use strict";
if (PRIVATE || !X3.voice || !window.AI) return;
const V = X3.voice, VL = V.state();
const saveCfg = () => { saveNow("settings"); sendPrefs(); };
const STYLES = { witty:"calm, quick and a little dry, like a butler AI with a sense of humour", short:"as brief as possible, a few words when that's enough",
  friendly:"warm and upbeat, like a good friend", detailed:"thorough: explain properly when it helps" };
const NO_DO = ["fill", "help", "repeat", "thanks", "stoplisten", "private"];     // never done for the assistant on its own

/* ---------------------------------------------------------------- the voice */
let serverVoice = null;            // null: not asked yet; true/false: the server has (or hasn't) a voice key
let adamDown = "";                 // why Adam isn't talking this session (no key, today's allowance…)
async function checkVoice() {
  if (serverVoice !== null || !AI.ready()) return serverVoice;
  try { const j = await (await fetch(AI.server() + "/")).json(); serverVoice = !!(j && Array.isArray(j.features) && j.features.includes("voice")); } catch (e) { serverVoice = null; }
  return serverVoice;
}
const useAdam = () => cfg.xAssistant !== false && (cfg.xAsVoice || "adam") === "adam" && serverVoice !== false && !adamDown && AI.ready();
const winVoices = () => { try { return speechSynthesis.getVoices(); } catch (e) { return []; } };
function winVoice() {
  const vs = winVoices(), want = String(cfg.xAsVoice || "").replace(/^win:/, "");
  return vs.find(v => v.name === want) || vs.find(v => /en-GB/i.test(v.lang) && /natural|online/i.test(v.name) && /male|ryan|thomas|george/i.test(v.name))
    || vs.find(v => /en-GB/i.test(v.lang) && /ryan|george|thomas|male/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang) && /natural|online/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || vs[0] || null;
}
// the "suit" effect: a little brighter, a short metallic echo, evened out
let actx = null, fxIn = null, dryIn = null;
function audioOut() {
  if (actx) return;
  actx = new AudioContext();
  const comp = actx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.connect(actx.destination);
  dryIn = actx.createGain(); dryIn.connect(comp);
  fxIn = actx.createGain();
  const hp = actx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 160;
  const pk = actx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 2800; pk.gain.value = 4; pk.Q.value = 0.9;
  const dl = actx.createDelay(0.2); dl.delayTime.value = 0.022;
  const fb = actx.createGain(); fb.gain.value = 0.22;
  const wet = actx.createGain(); wet.gain.value = 0.28;
  fxIn.connect(hp); hp.connect(pk); pk.connect(comp); pk.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
}
/* the speaker: sentences in a queue, each fetched as soon as it's known and played in order */
const Q = [];
let playing = null, gen = 0, idleFns = [], talkT = 0;
function setTalking(on) { clearTimeout(talkT); if (on) { VL.talking = true; if (hud.el.dataset.s !== "error") hud.state("talking"); } else talkT = setTimeout(() => { VL.talking = false; }, 350); }
function fetchAdam(text) {
  const ctl = new AbortController();
  const p = fetch(AI.server() + "/speak", { method:"POST", headers:{ "content-type":"application/json" }, signal:ctl.signal,
    body:JSON.stringify({ code:AI.code(), device:AI.dev(), text, voice:/^[A-Za-z0-9]{12,40}$/.test(cfg.xAsVoiceId || "") ? cfg.xAsVoiceId : undefined }) })
    .then(async r => {
      if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) {} throw Object.assign(new Error(j && j.message || "The voice didn't answer (" + r.status + ")."), { kind:j && j.error || "voice" }); }
      return r.arrayBuffer();
    });
  p.catch(() => {});
  return { p, abort:() => ctl.abort() };
}
function say(text) {
  text = String(text || "").replace(/[“”]/g, "").replace(/\s+/g, " ").trim();
  if (!text || cfg.xVoiceTalk === false) return;
  const item = { text, g:gen };
  if (useAdam()) item.adam = fetchAdam(text);
  Q.push(item);
  if (!playing) next();
}
function next() {
  const g = gen, item = Q.shift();
  if (!item) { playing = null; setTalking(false); const f = idleFns; idleFns = []; f.forEach(fn => { try { fn(); } catch (e) {} }); return; }
  playing = item; setTalking(true);
  const done = () => { if (g === gen && playing === item) next(); };
  if (item.adam) {
    item.adam.p.then(async buf => {
      if (g !== gen) return;
      audioOut(); if (actx.state === "suspended") await actx.resume().catch(() => {});
      const b = await actx.decodeAudioData(buf);
      if (g !== gen) return;
      const src = actx.createBufferSource(); src.buffer = b; src.playbackRate.value = Math.min(1.3, Math.max(0.8, +cfg.xAsRate || 1));
      src.connect(cfg.xAsFx !== false ? fxIn : dryIn); src.onended = done; item.src = src; src.start();
    }).catch(e => {
      if (g !== gen) return;
      // no Adam this time: a Windows voice for this and what follows, and say why once
      if (e && e.name === "AbortError") return;
      if (!adamDown) { adamDown = e && e.message || "The voice isn't available."; if (e && e.kind === "novoice") serverVoice = false; toast("🔊 " + adamDown + " Using a Windows voice for now."); }
      Q.forEach(x => { if (x.adam) { x.adam.abort(); x.adam = null; } });
      item.adam = null; winSay(item.text, done);
    });
  } else winSay(item.text, done);
}
function winSay(text, done) {
  try {
    const u = new SpeechSynthesisUtterance(text), v = winVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = Math.min(1.3, Math.max(0.8, +cfg.xAsRate || 1)) * 1.03;
    u.onend = u.onerror = done;
    speechSynthesis.speak(u);
  } catch (e) { setTimeout(done, 0); }
}
function hush() {
  gen++;
  Q.splice(0).forEach(x => { if (x.adam) x.adam.abort(); });
  if (playing) { if (playing.adam) playing.adam.abort(); if (playing.src) try { playing.src.onended = null; playing.src.stop(); } catch (e) {} }
  playing = null; idleFns = [];
  try { speechSynthesis.cancel(); } catch (e) {}
  setTalking(false);
}
const whenQuiet = fn => { if (!playing && !Q.length) fn(); else idleFns.push(fn); };
// stopping it (its name said while it talks, or ✕): the answer being written stops too
function stopAll() { hush(); turn++; if (ctl) { ctl.abort(); ctl = null; } }
V.speaker = { say:t => { hush(); say(t); }, hush:stopAll, busy:() => !!playing || Q.length > 0 };

/* ---------------------------------------------------------------- the conversation */
let convo = [], lastAt = 0, ctl = null, turn = 0;
const name = () => String(cfg.xAsName || "Webs").slice(0, 30);
function commandList() {
  const g = {}; V.COMMANDS.forEach(c => { if (NO_DO.indexOf(c.id) < 0) (g[c.g] = g[c.g] || []).push(c.ex); });
  return Object.keys(g).map(k => k + ": " + g[k].join(" · ")).join("\n");
}
function now() {
  const t = T(active), others = tabs.filter(x => x.id !== active).slice(0, 12);
  return "Time: " + new Date().toLocaleString([], { weekday:"long", hour:"numeric", minute:"2-digit", day:"numeric", month:"long" }) +
    "\nThis tab: " + (t ? (t.title || "untitled") + " (" + (isWeb(t.url) ? t.url.slice(0, 200) : "a Webs page") + ")" : "none") +
    (others.length ? "\nOther tabs: " + others.map(x => (x.title || hostOf(x.url) || "tab").slice(0, 60)).join(" | ") : "");
}
function setup() {
  return "name: " + name() + "\ncall them: " + (String(cfg.xAsCall || "").trim().slice(0, 30) || "nothing in particular, no title") + "\nstyle: " + (STYLES[cfg.xAsStyle] || STYLES.witty);
}
async function ask(text) {
  hush(); if (ctl) ctl.abort();
  const my = ++turn; ctl = new AbortController();
  if (Date.now() - lastAt > 5 * 60000) convo = [];
  lastAt = Date.now();
  hud.open(); hud.you(text); hud.state("thinking"); hud.text(""); hud.clearActs();
  V.chip("heard", text);
  checkVoice();
  const msg = "<assistant>\n" + setup() + "\n</assistant>\n<now>\n" + now() + "\n</now>\n<commands>\n" + commandList() + "\n</commands>\n\nThey said: " + text;
  const messages = convo.slice(-12).concat([{ role:"user", content:msg }]);
  let seen = 0, spoken = "", buf = "", acts = Promise.resolve();
  // whole sentences are said as soon as they're written; [[do: …]] runs when its "]]" arrives
  const take = (str, all) => {
    let m; const re = /^([\s\S]*?[.!?…])(\s+)/;
    while ((m = re.exec(str))) { const t = m[1].trim(); if (t) { say(t); spoken += (spoken ? " " : "") + t; } str = str.slice(m[0].length); }
    if (all && str.trim()) { const t = str.trim(); say(t); spoken += (spoken ? " " : "") + t; str = ""; }
    return str;
  };
  const feed = (full, end) => {
    buf += full.slice(seen); seen = full.length;
    for (;;) {
      const a = buf.indexOf("[[");
      if (a < 0) { buf = take(buf, end); break; }
      const b = buf.indexOf("]]", a);
      if (b < 0) { buf = take(buf.slice(0, a), true) + buf.slice(a); if (end) buf = ""; break; }
      take(buf.slice(0, a), true);
      const cmd = buf.slice(a + 2, b).replace(/^\s*do\s*:\s*/i, "").trim();
      buf = buf.slice(b + 2);
      if (cmd) acts = acts.then(() => doIt(cmd, my));
    }
    hud.text((spoken + " " + buf.replace(/\[\[[\s\S]*$/, "")).trim());
  };
  let full = "";
  try {
    full = (await AI.ask("jarvis", "", { messages, signal:ctl.signal, onText:t => { if (my === turn) feed(t, false); } })).text;
    if (my !== turn) return "";
    feed(full, true);
  } catch (e) {
    if (my !== turn || (e && e.name === "AbortError")) return "";
    const why = e && e.message || "Web AI didn't answer.";
    hud.state("error"); hud.text(why); say(why); V.chip("miss", why); hud.later();
    return why;
  }
  await acts;
  if (my !== turn) return "";
  convo.push({ role:"user", content:"They said: " + text }, { role:"assistant", content:full.trim() || "…" });
  if (convo.length > 16) convo = convo.slice(-16);
  hud.text(spoken || (hud.actCount() ? "" : "…"));
  if (!spoken && !hud.actCount()) say("Done.");
  whenQuiet(() => {
    if (my !== turn) return;
    // a follow-up needs no wake phrase for a few seconds (longer when it asked something)
    if (cfg.xAsFollow !== false && VL.on && !cfg.xVoiceNoWake) { V.awake(/\?\s*$/.test(spoken) ? 10000 : 7000); hud.state("follow"); } else hud.state("idle");
    hud.later();
  });
  return spoken;
}
async function doIt(cmd, my) {
  if (my !== turn) return;
  const p = V.parse(cmd);
  if (!p || p.custom || NO_DO.indexOf(p.id) >= 0) { hud.act("✗ " + cmd); return; }
  let r = null;
  try { r = await V.act(cmd); } catch (e) { r = null; }
  hud.act((r === null ? "✗ " : "✓ ") + (r || cmd));
}
V.brain = { on:() => cfg.xAssistant !== false && AI.ready(), ask, convo:() => convo, reset:() => { convo = []; } };

/* ---------------------------------------------------------------- what's on screen: a small card while you talk */
const hud = (function () {
  const c = el("div", "asst hide");
  c.innerHTML = '<div class="asst-orb"><i></i><i></i><i></i></div><div class="asst-body"><div class="asst-top"><b></b><span class="asst-st"></span><button class="btn asst-x" title="Stop">✕</button></div>' +
    '<div class="asst-you"></div><div class="asst-text"></div><div class="asst-acts"></div><form class="asst-type"><input class="xin" placeholder="Or type to it…" maxlength="400"></form></div>';
  document.body.appendChild(c);
  let hideT = 0, acts = 0;
  const ST = { thinking:"Thinking…", talking:"Talking · say “" + "{w}" + "” to stop", follow:"Listening for a follow-up…", idle:"", error:"", listening:"Listening…" };
  c.querySelector(".asst-x").onclick = () => { stopAll(); api.close(); };
  c.querySelector("form").onsubmit = e => { e.preventDefault(); const i = c.querySelector("form input"), v = i.value.trim(); if (v) { i.value = ""; V.run(v); } };
  const api = {
    open() { const was = c.classList.contains("hide"); clearTimeout(hideT); c.classList.remove("hide"); c.querySelector(".asst-top b").textContent = name(); api.side(); if (was) relayout(); },
    side() { api.place(); },     // a panel open on the right: the card moves left
    // the window's top part is only as tall as the toolbar unless it asks for more (relayout, below): the card is placed
    // from the real window size (vpW, vpH) at the bottom right, clear of the sidebar
    place() {
      if (c.classList.contains("hide")) return;
      c.classList.toggle("left", !!overlay);
      const top = Math.ceil($("#chrome").getBoundingClientRect().height), rail = $("#rail"), rw = rail && rail.classList.contains("on") ? rail.offsetWidth : 0;
      const sideW = side.open ? Math.round(Math.min(cfg.sideW || 380, vpW * 0.5)) : 0;
      c.style.maxHeight = Math.max(140, vpH - top - 24) + "px";
      c.style.top = Math.max(top + 8, vpH - c.offsetHeight - 16) + "px";
      if (c.classList.contains("left")) { c.style.left = "16px"; c.style.right = "auto"; } else { c.style.right = (16 + rw + sideW) + "px"; c.style.left = "auto"; }
    },
    close() { clearTimeout(hideT); c.classList.add("hide"); relayout(); },
    you(t) { c.querySelector(".asst-you").textContent = t ? "“" + t + "”" : ""; },
    text(t) { c.querySelector(".asst-text").textContent = t; },
    state(s) { api.side(); c.dataset.s = s; c.querySelector(".asst-st").textContent = (ST[s] || "").replace("{w}", cfg.xVoiceWake || "Hey Webs"); if (s !== "idle" && s !== "follow") clearTimeout(hideT); },
    act(t) { acts++; const d = el("div", "asst-act"); d.textContent = t; c.querySelector(".asst-acts").appendChild(d); },
    clearActs() { acts = 0; c.querySelector(".asst-acts").innerHTML = ""; },
    actCount:() => acts,
    later() { clearTimeout(hideT); hideT = setTimeout(() => { if (!playing && !Q.length && Date.now() >= VL.awakeUntil && document.activeElement !== c.querySelector("form input")) api.close(); else api.later(); }, 12000); },
    el:c
  };
  return api;
})();
V.hud = hud;
// the card's area is added to what the toolbar asks the window for, so it shows and can be clicked
let cardSent = "";
const relayoutA = relayout;
relayout = function () {
  relayoutA.apply(this, arguments);
  const c = hud.el;
  if (c.classList.contains("hide") || !lastLayout) { if (cardSent) { cardSent = ""; const s = lastLayout; lastLayout = ""; relayoutA(); if (!lastLayout) lastLayout = s; } return; }
  hud.place();
  // where it rests (offset*, not the rectangle mid-way through its slide-in)
  const b = { left:c.offsetLeft, top:c.offsetTop, width:c.offsetWidth, height:c.offsetHeight }; b.bottom = b.top + b.height;
  const dpr = devicePixelRatio || 1, p = lastLayout.split("/");
  if (!b.width || !b.height || p.length < 6) return;
  p[1] = String(Math.max(+p[1], Math.round((Math.ceil(b.bottom) + 2) * dpr)));
  p[3] = (p[3] ? p[3] + ";" : "") + [Math.floor(b.left * dpr), Math.floor(b.top * dpr), Math.ceil(b.width * dpr) + 1, Math.ceil(b.height * dpr) + 1, Math.round(18 * dpr)].join(",");
  const s = p.join("/");
  if (s === cardSent) return;
  cardSent = s;
  send("layout", ...p);
};
new ResizeObserver(() => { if (!hud.el.classList.contains("hide")) relayout(); }).observe(hud.el);
// no microphone needed: the command list opens the card to type to it
const commandsA = commands;
commands = function () { return commandsA().concat([{ t:"Talk to the assistant (" + name() + ")", k:"", i:"speech", fn:() => { if (!AI.ready()) { toast("Open Web AI once to connect it first"); return; } hud.open(); hud.you(""); hud.text("What can I do for you?"); hud.clearActs(); hud.state("idle"); setTimeout(() => hud.el.querySelector(".asst-type input").focus(), 50); } }]); };
const openOverA = openOver, closeOverA = closeOver;
openOver = function () { const r = openOverA.apply(this, arguments); hud.side(); return r; };
closeOver = function () { const r = closeOverA.apply(this, arguments); hud.side(); return r; };
// the wake phrase alone: the card shows it's listening
V.onChip = state => {
  if (cfg.xAssistant === false || state !== "awake" || !AI.ready()) return;
  const s0 = hud.el.dataset.s, busy = !hud.el.classList.contains("hide") && (s0 === "thinking" || s0 === "talking");
  if (busy) return;
  if (hud.el.classList.contains("hide")) { hud.open(); hud.you(""); hud.text(""); hud.clearActs(); }
  hud.state("follow"); hud.later();
};

/* ---------------------------------------------------------------- settings, in the voice panel */
V.panelHook = function (box) {
  if (!box) return;
  const vs = winVoices().filter(v => /^en/i.test(v.lang));
  const cur = cfg.xAsVoice || "adam";
  box.innerHTML = '<div class="gtk">Assistant</div>' +
    '<label class="lksw"><span><b>Talk with Web AI</b><em>Anything that isn\'t a command is a conversation, and it can do things for you</em></span><input type="checkbox" class="as-on"' + (cfg.xAssistant !== false ? " checked" : "") + "></label>" +
    '<div class="as-grid"><label class="gtf"><span>Its name</span><input class="xin as-name" maxlength="30" placeholder="Webs"></label>' +
    '<label class="gtf"><span>It calls you</span><input class="xin as-call" maxlength="30" placeholder="sir, boss, your name…"></label></div>' +
    '<label class="gtf"><span>Personality</span><select class="xin as-style">' + Object.keys(STYLES).map(k => '<option value="' + k + '">' + ({ witty:"Calm and witty", short:"Short and to the point", friendly:"Warm and friendly", detailed:"Detailed" })[k] + "</option>").join("") + "</select></label>" +
    '<label class="gtf"><span>Voice</span><select class="xin as-voice"><option value="adam">Adam (ElevenLabs)</option>' + vs.map(v => '<option value="win:' + esc(v.name) + '">' + esc(v.name.replace(/^Microsoft /, "")) + " (Windows)</option>").join("") + "</select></label>" +
    '<div class="xsmall as-vnote"></div>' +
    '<div class="as-grid"><label class="gtf"><span>Speed</span><input type="range" class="as-rate" min="0.8" max="1.3" step="0.05"></label><button class="btn2 as-test">▶ Hear it</button></div>' +
    '<label class="lksw"><span><b>Suit effect</b><em>A slight metallic echo, like an AI in a suit (Adam only)</em></span><input type="checkbox" class="as-fx"' + (cfg.xAsFx !== false ? " checked" : "") + "></label>" +
    '<label class="lksw"><span><b>Follow-ups without the wake phrase</b><em>Keeps listening for a few seconds after it answers</em></span><input type="checkbox" class="as-follow"' + (cfg.xAsFollow !== false ? " checked" : "") + "></label>" +
    '<details class="as-adv"><summary>Another ElevenLabs voice</summary><label class="gtf"><span>Voice ID (from elevenlabs.io; empty for Adam)</span><input class="xin as-vid" maxlength="40" placeholder="pNInz6obpgDQGcFmaJgB"></label></details>';
  const q = s => box.querySelector(s);
  q(".as-name").value = cfg.xAsName || ""; q(".as-call").value = cfg.xAsCall || ""; q(".as-style").value = STYLES[cfg.xAsStyle] ? cfg.xAsStyle : "witty";
  q(".as-voice").value = [...q(".as-voice").options].some(o => o.value === cur) ? cur : "adam"; q(".as-rate").value = String(+cfg.xAsRate || 1); q(".as-vid").value = cfg.xAsVoiceId || "";
  const set = (k, v) => { cfg[k] = v; saveCfg(); };
  q(".as-on").onchange = e => set("xAssistant", e.target.checked);
  q(".as-name").onchange = e => set("xAsName", e.target.value.trim().slice(0, 30));
  q(".as-call").onchange = e => set("xAsCall", e.target.value.trim().slice(0, 30));
  q(".as-style").onchange = e => set("xAsStyle", e.target.value);
  q(".as-voice").onchange = e => { set("xAsVoice", e.target.value); adamDown = ""; serverVoice = null; checkVoice().then(note); note(); };
  q(".as-rate").onchange = e => set("xAsRate", +e.target.value);
  q(".as-fx").onchange = e => set("xAsFx", e.target.checked);
  q(".as-follow").onchange = e => set("xAsFollow", e.target.checked);
  q(".as-vid").onchange = e => { const v = e.target.value.trim(); set("xAsVoiceId", /^[A-Za-z0-9]{12,40}$/.test(v) ? v : ""); adamDown = ""; };
  q(".as-test").onclick = () => { adamDown = ""; serverVoice = null; hush(); say("Good " + (new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening") + (String(cfg.xAsCall || "").trim() ? ", " + cfg.xAsCall.trim() : "") + ". " + name() + " here. All systems are running."); };
  function note() {
    const n = q(".as-vnote"); if (!n) return;
    if ((cfg.xAsVoice || "adam") !== "adam") { n.textContent = "A voice from Windows. Windows → Settings → Accessibility → Narrator → Add natural voices for better ones."; return; }
    n.textContent = !AI.ready() ? "Open Web AI once to connect it, then Adam can talk." : serverVoice === false ? "The Web AI server has no voice key yet: run setup.cmd and add an ElevenLabs key (free to start). Until then a Windows voice talks." : adamDown ? adamDown : "Adam talks through your Web AI server (ElevenLabs).";
  }
  note(); checkVoice().then(note);
};
// a voice list that arrives late
try { speechSynthesis.addEventListener("voiceschanged", () => { if (overlay === "voicep") { const b = document.querySelector("#voicep .vc-asst"); if (b && !b.contains(document.activeElement)) V.panelHook(b); } }); } catch (e) {}

const st = document.createElement("style");
st.textContent = `
.asst{position:fixed;right:16px;top:60px;z-index:60;overflow:auto;box-sizing:border-box;width:min(380px,calc(100vw - 32px));display:flex;gap:12px;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--bg2) 92%,transparent);backdrop-filter:blur(14px);box-shadow:0 12px 40px rgba(0,0,0,.35),inset 0 0 0 1px color-mix(in srgb,var(--accent) 30%,transparent);color:var(--fg);animation:asstIn .22s ease}
.asst.hide{display:none}.asst.left{right:auto;left:16px}@keyframes asstIn{from{opacity:0;transform:translateY(10px)}}
.asst-orb{position:relative;flex:0 0 46px;height:46px}.asst-orb i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent);opacity:.8}
.asst-orb i:nth-child(1){background:radial-gradient(circle,color-mix(in srgb,var(--accent) 70%,#fff) 0,var(--accent) 35%,transparent 70%);border:0}
.asst-orb i:nth-child(2){inset:-4px;opacity:.35}.asst-orb i:nth-child(3){inset:-9px;opacity:.15}
.asst[data-s=thinking] .asst-orb i:nth-child(2){border-style:dashed;animation:asstSpin 1.2s linear infinite}.asst[data-s=thinking] .asst-orb i:nth-child(3){border-style:dotted;animation:asstSpin 2.4s linear infinite reverse}
.asst[data-s=talking] .asst-orb i:nth-child(1){animation:asstPulse .5s ease-in-out infinite alternate}.asst[data-s=talking] .asst-orb i:nth-child(2),.asst[data-s=talking] .asst-orb i:nth-child(3){animation:asstRing 1.1s ease-out infinite}
.asst[data-s=follow] .asst-orb i:nth-child(1),.asst[data-s=listening] .asst-orb i:nth-child(1){animation:asstPulse 1.4s ease-in-out infinite alternate}
.asst[data-s=error] .asst-orb i{border-color:#e8553a}.asst[data-s=error] .asst-orb i:nth-child(1){background:radial-gradient(circle,#ffb4a6 0,#e8553a 40%,transparent 70%)}
@keyframes asstSpin{to{transform:rotate(1turn)}}@keyframes asstPulse{from{transform:scale(.82)}to{transform:scale(1)}}@keyframes asstRing{from{transform:scale(.9);opacity:.5}to{transform:scale(1.25);opacity:0}}
.asst-body{flex:1;min-width:0}.asst-top{display:flex;align-items:center;gap:8px}.asst-top b{font-size:14px}.asst-st{flex:1;font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asst-x{width:26px;height:26px}
.asst-you{font-size:12.5px;color:var(--dim);margin-top:4px;overflow-wrap:anywhere}.asst-text{font-size:14px;line-height:1.45;margin-top:6px;max-height:180px;overflow:auto;overflow-wrap:anywhere}.asst-text:empty{display:none}
.asst-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.asst-act{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--bg3)}
.asst-type{margin-top:8px}.asst-type input{width:100%;box-sizing:border-box}
.as-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end}.as-rate{width:100%}.as-adv{margin:6px 0 10px;font-size:13px}.as-adv summary{cursor:pointer;color:var(--dim)}.vc-asst .gtf select{width:100%}`;
document.head.appendChild(st);
})();
