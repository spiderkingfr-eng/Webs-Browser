/* ---------------------------------------------------------------- 3.4: a voice call with Web AI
   📞 starts a call: Web AI listens, sends what you said, says the answer out loud, then
   listens again, until you hang up. 🔊 on any answer says it out loud.
   Listening uses the engine's speech recognition when it works. Where it doesn't (the
   WebView2 engine often has none), the call carries on with Windows' own voice typing
   (Windows key + H) typing into the box, and every answer is still spoken. */
(function () {
"use strict";
const X = window.XAI;
if (!X) return;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition, synth = window.speechSynthesis;
let call = false, rec = null, speaking = false, heard = "", quiet = 0, noMicWhy = "";

/* saying things */
const plain = md => String(md || "").replace(/```[\s\S]*?```/g, " (a code example) ").replace(/`([^`]*)`/g, "$1").replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/https?:\/\/\S+/g, "a link").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*#+\s*/gm, "").replace(/[*_~]+/g, "").replace(/[>|]+/g, " ").replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
function voice() {
  const vs = synth ? synth.getVoices() : [], lang = (navigator.language || "en-US").toLowerCase();
  return vs.find(v => v.lang.toLowerCase() === lang && /natural|online/i.test(v.name)) || vs.find(v => v.lang.toLowerCase() === lang) || vs.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) || null;
}
function say(text, done) {
  stopTalking();
  if (!synth) { if (done) done(); return; }
  // short pieces, one after another: some engines stop a long one halfway
  const chunks = [];
  (plain(text).match(/[^.!?;:]+[.!?;:]*\s*/g) || []).forEach(s => { const l = chunks[chunks.length - 1]; if (l && (l + s).length < 220) chunks[chunks.length - 1] = l + s; else chunks.push(s); });
  let i = 0;
  speaking = true; paint();
  const next = () => {
    if (!speaking || i >= chunks.length) { speaking = false; paint(); if (done) done(); return; }
    const text = chunks[i++].trim(), u = new SpeechSynthesisUtterance(text);
    u.lang = navigator.language || "en-US"; const v = voice(); if (v) u.voice = v; u.rate = 1.03;
    // some voices never report the end: move on anyway, so the call doesn't stop listening for good
    let fin = false; const go = () => { if (fin) return; fin = true; clearTimeout(t); next(); }, t = setTimeout(go, 2500 + text.length * 110);
    u.onend = go; u.onerror = go;
    synth.speak(u);
  };
  next();
}
function stopTalking() { speaking = false; if (synth) synth.cancel(); }
X.say = text => { if (speaking) { stopTalking(); paint(); } else say(text); };

/* listening */
function listen() {
  if (!call || X.busy()) return;
  if (!SR || noMicWhy) { paint(); X.input.focus(); return; }
  heard = "";
  try {
    rec = new SR();
    rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      X.input.value = t; X.grow();
      if (e.results[e.results.length - 1].isFinal) heard = t;
    };
    rec.onerror = e => {
      if (/not-allowed|service-not-allowed|network|audio-capture|language-not-supported/.test(e.error)) noMicWhy = e.error;
      else if (e.error === "no-speech") quiet++;
    };
    rec.onend = () => {
      rec = null;
      const t = (heard || X.input.value).trim();
      if (!call) { paint(); return; }
      if (t) { quiet = 0; X.input.value = ""; X.grow(); X.ask(t); }
      else if (!noMicWhy && quiet < 3) setTimeout(listen, 250);
      else if (quiet >= 3) { hangUp(); note("The call ended because it was quiet for a while."); return; }
      paint();
    };
    rec.start();
  } catch (e) { rec = null; noMicWhy = "start"; }
  paint();
}
function stopListening() { if (rec) { const r = rec; rec = null; r.onend = r.onresult = r.onerror = null; try { r.abort(); } catch (e) {} } }

/* the call */
// Hey Webs (the window's voice control) pauses during a call, so the two don't fight over the microphone
let beat = 0;
const flag = on => { try { if (on) localStorage.setItem("wsb.xaiCall", String(Date.now())); else localStorage.removeItem("wsb.xaiCall"); } catch (e) {} };
function startCall() { call = true; quiet = 0; flag(true); clearInterval(beat); beat = setInterval(() => flag(true), 20000); stopTalking(); setTimeout(() => { if (call) listen(); }, 350); paint(); }
function hangUp() { const was = call; call = false; clearInterval(beat); if (was) flag(false); stopListening(); stopTalking(); paint(); }
X.hooks.push(a => {
  if (!call) return;
  const text = a.err || a.text || a.note || "";
  if (text) say(text, () => setTimeout(listen, 200)); else listen();
});

/* what's on screen: a 📞 button by the box, and a bar while a call is on */
const btn = document.createElement("button");
btn.className = "xai-call"; btn.type = "button"; btn.title = "Talk with Web AI (a voice call)"; btn.textContent = "📞";
btn.onclick = () => call ? hangUp() : startCall();
X.foot.insertBefore(btn, X.foot.querySelector(".xai-send"));
const bar = document.createElement("div");
bar.className = "xai-callbar hide";
bar.innerHTML = '<span class="dot"></span><span class="t"></span><button type="button" class="b">Hang up</button>';
bar.querySelector("button").onclick = hangUp;
X.foot.parentNode.insertBefore(bar, X.foot);
let noteT = 0;
function note(t) { bar.classList.remove("hide"); bar.querySelector(".t").textContent = t; clearTimeout(noteT); noteT = setTimeout(paint, 4000); }
function paint() {
  btn.classList.toggle("on", call);
  btn.textContent = call ? "✕" : "📞"; btn.title = call ? "Hang up" : "Talk with Web AI (a voice call)";
  bar.classList.toggle("hide", !call);
  if (!call) return;
  const t = bar.querySelector(".t");
  bar.className = "xai-callbar" + (rec ? " listening" : speaking ? " speaking" : X.busy() ? " thinking" : "");
  t.textContent = rec ? "Listening… say your question" : speaking ? "Web AI is talking… (tap ✕ to stop)" : X.busy() ? "Thinking…"
    : noMicWhy || !SR ? "Type, or press ⊞ Windows + H to talk, then Enter. Web AI answers out loud." : "On a call with Web AI";
}
// typing (or Windows voice typing) during a call still sends; the answer is spoken
X.input.addEventListener("keydown", e => { if (call && e.key === "Enter" && !e.shiftKey) { stopListening(); stopTalking(); } }, true);
addEventListener("pagehide", hangUp);
document.addEventListener("visibilitychange", () => { if (document.hidden && call) hangUp(); });
if (synth && synth.onvoiceschanged !== undefined) synth.onvoiceschanged = () => {};
X.call = { start:startCall, hangUp, state:() => ({ call, listening:!!rec, speaking }) };
})();
