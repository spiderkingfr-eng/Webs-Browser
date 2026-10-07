/* Jarvis for Webs - the little ball's state: "listening" (red pulse) or "busy" (amber). */
"use strict";
window.jarvis.onDot(d => {
  document.body.classList.toggle("busy", d && d.state === "busy");
});
