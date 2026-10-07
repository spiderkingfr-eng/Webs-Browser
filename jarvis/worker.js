/* Jarvis for Webs - the hidden worker. It captures the microphone and sends the sound to the main process as
   16 kHz mono (what the speech model needs), and it plays the spoken answer. Nothing about you is stored here. */
"use strict";
(function () {
let actx = null, stream = null, node = null, src = null, running = false, oneShot = false, lastVoice = 0, started = 0;

// turn the mic's sample rate (usually 48000) into 16000 mono Int16, the simple way (average blocks)
function downsampleTo16k(input, inRate) {
  const ratio = inRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0, n = 0;
    for (let j = start; j < end; j++) { sum += input[j]; n++; }
    let s = n ? sum / n : 0;
    s = Math.max(-1, Math.min(1, s));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function start(device) {
  if (running) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: device ? { deviceId: { exact: device } } : true, video: false });
  } catch (e) { return; }
  actx = new (window.AudioContext || window.webkitAudioContext)();
  src = actx.createMediaStreamSource(stream);
  node = actx.createScriptProcessor(4096, 1, 1);
  src.connect(node); node.connect(actx.destination);
  running = true; started = Date.now(); lastVoice = Date.now();
  node.onaudioprocess = ev => {
    if (!running) return;
    const input = ev.inputBuffer.getChannelData(0);
    // a rough loudness, to notice when the person has stopped talking (for the one-shot "ask" mode)
    let peak = 0; for (let i = 0; i < input.length; i += 64) peak = Math.max(peak, Math.abs(input[i]));
    if (peak > 0.04) lastVoice = Date.now();
    const pcm = downsampleTo16k(input, actx.sampleRate);
    window.jarvis.micData(pcm.buffer);     // an ArrayBuffer (Buffer isn't available in the renderer); main wraps it
    // one-shot: once they've spoken and then paused ~1s (or 8s max), stop listening - main turns the words into the question
    if (oneShot && ((Date.now() - lastVoice > 1000 && Date.now() - started > 1200) || Date.now() - started > 8000)) stop();
  };
}
function stop() {
  running = false; oneShot = false;
  try { if (node) node.disconnect(); } catch (e) {}
  try { if (src) src.disconnect(); } catch (e) {}
  try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (actx) actx.close(); } catch (e) {}
  node = src = stream = actx = null;
}

window.jarvis.onMic(d => {
  if (d && d.on) { oneShot = !!d.oneShot; start(d.device || ""); }
  else stop();
});

// play the spoken answer (an MP3 arrived from the server, through main)
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
