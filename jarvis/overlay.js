/* Jarvis for Webs - the bubble's behaviour. It shows what you asked, streams the answer in, and lets you type or
   tap the microphone. Messages come from the main process via the preload bridge (window.jarvis). */
"use strict";
(function () {
const $ = id => document.getElementById(id);
const body = document.body, a = $("a"), q = $("q"), warn = $("warn"), stop = $("stop"), voice = $("voice");
let busy = false;
let hideTimer = 0;

function armHide(ms) { clearTimeout(hideTimer); hideTimer = setTimeout(() => window.jarvis.hideBubble(), ms); }
function keepOpen() { clearTimeout(hideTimer); }

requestAnimationFrame(() => body.classList.add("show"));

window.jarvis.onBubble(d => {
  if (!d) return;
  if (d.name) { $("who").textContent = d.name; $("in").placeholder = "Ask " + d.name + "…"; }
  if (typeof d.voice === "boolean") {
    voice.textContent = d.voice ? "🔊" : "🔇"; voice.classList.toggle("off", !d.voice);
    voice.title = d.voice ? "Voice on - click to just read the answers" : "Voice off (just reading) - click to hear answers again";
  }
  keepOpen();
  body.classList.add("show");
  switch (d.kind) {
    case "focus": setTimeout(() => $("in").focus(), 30); break;
    case "say":
      body.classList.toggle("listening", !!d.listening); body.classList.remove("thinking");
      q.hidden = true; a.classList.remove("thinking"); a.textContent = d.text || "";
      if (!d.listening) armHide(9000);
      break;
    case "heard":
      body.classList.add("listening");
      q.hidden = false; q.textContent = "“" + (d.text || "") + "…”";
      break;
    case "question":
      body.classList.remove("listening");
      q.hidden = false; q.textContent = "“" + (d.text || "") + "”"; a.textContent = ""; warn.hidden = true;
      break;
    case "warn":
      warn.hidden = false; warn.textContent = "⚠ " + (d.text || "");
      if (!body.classList.contains("thinking")) armHide(20000);     // a note on its own (no answer coming) goes away too
      break;
    case "answer":
      body.classList.toggle("thinking", !!d.thinking);
      a.classList.toggle("thinking", !!d.thinking);
      if (!d.thinking) a.textContent = d.text || "";
      a.scrollTop = a.scrollHeight;
      if (d.done) { body.classList.remove("thinking"); a.classList.remove("thinking"); if (!busy) armHide(30000); if (d.parts) showParts(d.parts); }
      break;
    case "busy":
      // talking or still answering: show Stop, and don't tidy the bubble away mid-sentence
      busy = !!d.on; stop.hidden = !busy;
      if (!busy && !body.classList.contains("thinking")) armHide(30000);
      break;
    case "voice":
      if (!busy) armHide(30000);
      break;
    case "left":
      $("left").textContent = [d.model, d.unlimited ? "no daily limit" : d.left != null ? d.left + " left today" : ""].filter(Boolean).join(" · ");
      break;
  }
});

// the finished answer, with its links as things to click (they open in your normal browser, not in the bubble)
function showParts(parts) {
  if (!parts.some(p => p.url)) return;
  a.textContent = "";
  parts.forEach(p => {
    if (!p.url) { a.appendChild(document.createTextNode(p.text)); return; }
    const l = document.createElement("a");
    l.className = "lnk"; l.href = "#"; l.textContent = "🔗 " + p.text; l.title = p.url;
    l.onclick = e => { e.preventDefault(); keepOpen(); window.jarvis.openExternal(p.url); };
    a.appendChild(l);
  });
}

$("ask").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("in").value.trim(); if (!v) return;
  $("in").value = ""; keepOpen();
  window.jarvis.askText(v);
});
$("in").addEventListener("focus", keepOpen);
$("in").addEventListener("input", keepOpen);
$("mic").onclick = () => { keepOpen(); window.jarvis.startVoice(); };
$("close").onclick = () => window.jarvis.hideBubble();
stop.onclick = () => { keepOpen(); window.jarvis.stopTalking(); };
voice.onclick = () => { keepOpen(); window.jarvis.toggleVoice(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") window.jarvis.hideBubble(); });
})();
