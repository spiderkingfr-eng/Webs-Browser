/* Jarvis for Webs - the hidden worker. Its one job is to play the spoken answer (an MP3 that came from your
   server's /speak, through the main process). Hearing you is done by Windows itself, so there's no microphone code
   here. Nothing is stored. */
"use strict";
(function () {
let audio = null;
window.jarvis.onPlay(buf => {
  try {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const url = URL.createObjectURL(new Blob([u8], { type: "audio/mpeg" }));
    if (audio) { try { audio.pause(); } catch (e) {} }
    audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
  } catch (e) {}
});
})();
