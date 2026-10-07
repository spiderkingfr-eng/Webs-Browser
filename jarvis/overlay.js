/* Jarvis for Webs - the bubble's behaviour. It shows what you asked, streams the answer in, and lets you type or
   tap the microphone. Messages come from the main process via the preload bridge (window.jarvis). */
"use strict";
(function () {
const $ = id => document.getElementById(id);
const body = document.body, a = $("a"), q = $("q"), dot = $("dot");
let hideTimer = 0;

function armHide(ms) { clearTimeout(hideTimer); hideTimer = setTimeout(() => window.jarvis.hideBubble(), ms); }
function keepOpen() { clearTimeout(hideTimer); }

requestAnimationFrame(() => body.classList.add("show"));

window.jarvis.onBubble(d => {
  if (!d) return;
  if (d.name) { $("who").textContent = d.name; $("in").placeholder = "Ask " + d.name + "…"; }
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
      q.hidden = false; q.textContent = "“" + (d.text || "") + "”"; a.textContent = "";
      break;
    case "answer":
      body.classList.toggle("thinking", !!d.thinking);
      a.classList.toggle("thinking", !!d.thinking);
      if (!d.thinking) a.textContent = d.text || "";
      a.scrollTop = a.scrollHeight;
      if (d.done) { body.classList.remove("thinking"); a.classList.remove("thinking"); armHide(30000); linkify(); }
      break;
    case "left":
      $("left").textContent = d.left != null ? d.left + " left today" : "";
      break;
  }
});

// the few links an answer might contain open in the real browser, not in the bubble
function linkify() {
  const m = a.textContent.match(/https?:\/\/[^\s)]+/);
  // (answers are read-aloud style, so links are rare; we just make the first one tappable if present)
  if (!m) return;
  const url = m[0];
  if (!a.querySelector(".lnk")) {
    const b = document.createElement("button"); b.className = "lnk x"; b.textContent = "Open link"; b.style.marginTop = "6px";
    b.onclick = () => window.jarvis.openExternal(url);
    a.appendChild(document.createElement("br")); a.appendChild(b);
  }
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
document.addEventListener("keydown", e => { if (e.key === "Escape") window.jarvis.hideBubble(); });
})();
