/* Jarvis for Webs - the hidden worker. It HEARS you (records the microphone and turns it into text with Whisper,
   which runs here on your PC - far more accurate than Windows' built-in recognition) and plays the spoken answer.
   The Whisper model (~40 MB) is fetched once from a public CDN on first run and cached; after that it works offline.
   Nothing about you is stored or sent anywhere by this file - the text goes to the main app, which you control. */
"use strict";

/* ---------------------------------------------------------------- Whisper (speech -> text), in the browser engine */
let asr = null, loading = false, failed = false;
async function ensureModel() {
  if (asr) return asr;
  if (failed) return null;
  if (loading) { while (loading) { await new Promise(r => setTimeout(r, 200)); } return asr; }
  loading = true;
  try { window.jarvis.whisperLoading(); } catch (e) {}
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
    mod.env.allowLocalModels = false;
    mod.env.useBrowserCache = true;
    asr = await mod.pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
    try { window.jarvis.whisperReady(); } catch (e) {}
  } catch (e) {
    failed = true;
    try { window.jarvis.whisperFail(String((e && e.message) || e)); } catch (x) {}
  }
  loading = false;
  return asr;
}
// start fetching the model as soon as the app opens, so it's ready when you first speak
ensureModel();

/* ---------------------------------------------------------------- recording the microphone */
let actx = null, stream = null, node = null, src = null;
let recording = false, buffers = [], total = 0, started = 0, lastVoice = 0, haveVoice = false, oneShot = false;
let deviceId = "";

// mix the mic down to 16 kHz mono Float32 (what Whisper wants), the simple way
function to16k(input, inRate) {
  const ratio = inRate / 16000, outLen = Math.max(1, Math.floor(input.length / ratio)), out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0, n = 0; for (let j = a; j < b; j++) { s += input[j]; n++; }
    out[i] = n ? s / n : 0;
  }
  return out;
}
async function startRec(mode) {
  if (recording) return;
  const ok = await ensureModel();
  if (!ok) return;      // whisper couldn't load; main falls back to Windows speech
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false }); }
  catch (e) { try { window.jarvis.transcript(""); } catch (x) {} return; }
  actx = new (window.AudioContext || window.webkitAudioContext)();
  src = actx.createMediaStreamSource(stream);
  node = actx.createScriptProcessor(4096, 1, 1);
  src.connect(node); node.connect(actx.destination);
  recording = true; oneShot = mode === "once"; buffers = []; total = 0; started = Date.now(); lastVoice = Date.now(); haveVoice = false;
  try { window.jarvis.recState("listening"); } catch (e) {}
  node.onaudioprocess = ev => {
    if (!recording) return;
    const input = ev.inputBuffer.getChannelData(0);
    let peak = 0; for (let i = 0; i < input.length; i += 32) peak = Math.max(peak, Math.abs(input[i]));
    if (peak > 0.035) { lastVoice = Date.now(); haveVoice = true; }
    buffers.push(to16k(input, actx.sampleRate)); total += Math.ceil(input.length * 16000 / actx.sampleRate);
    const ms = Date.now();
    // wait up to 3.5s for you to start; once you do, stop after ~1.2s of quiet; never run past 13s
    if ((!haveVoice && ms - started > 3500) || (haveVoice && ms - lastVoice > 1200) || ms - started > 13000) finishRec();
  };
}
async function finishRec() {
  if (!recording) return;
  recording = false;
  try { if (node) node.disconnect(); } catch (e) {}
  try { if (src) src.disconnect(); } catch (e) {}
  try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (actx) actx.close(); } catch (e) {}
  node = src = stream = actx = null;
  if (!haveVoice || total < 16000 * 0.3) { try { window.jarvis.transcript(""); } catch (e) {} return; }
  const audio = new Float32Array(total); let o = 0;
  for (const b of buffers) { audio.set(b.subarray(0, Math.min(b.length, audio.length - o)), o); o += b.length; if (o >= audio.length) break; }
  buffers = [];
  try { window.jarvis.recState("thinking"); } catch (e) {}
  try {
    const r = await asr(audio, { language: "english", task: "transcribe", chunk_length_s: 30 });
    let text = (r && r.text || "").trim();
    // Whisper sometimes writes "[BLANK_AUDIO]" or bracketed noises for silence - drop those
    if (/^[\[(][^\])]*[\])]$/.test(text) || /^(you|thank you\.?|thanks for watching\.?)$/i.test(text)) text = "";
    window.jarvis.transcript(text);
  } catch (e) { try { window.jarvis.transcript(""); } catch (x) {} }
}
window.jarvis.onRecord(d => { deviceId = (d && d.device) || ""; startRec((d && d.mode) || "once"); });

/* ---------------------------------------------------------------- playing the spoken answer */
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
