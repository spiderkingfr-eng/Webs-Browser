/* Jarvis for Webs - the hidden worker. It HEARS you (records the microphone and turns it into text with Whisper,
   which runs here on your PC - far more accurate than Windows' built-in recognition) and plays the spoken answer.
   The Whisper model (~75 MB, or ~40 MB for "fast") is fetched once from a public CDN on first run and cached; after
   that it works offline.
   Nothing about you is stored or sent anywhere by this file - the text goes to the main app, which you control. */
"use strict";

import { to16k, createListener } from "./lib/listen.mjs";

/* ---------------------------------------------------------------- Whisper (speech -> text), in the browser engine */
// "accurate" (the default) is Whisper base.en (~75 MB, noticeably better at hearing you); "fast" is tiny.en (~40 MB).
const MODELS = { accurate: "Xenova/whisper-base.en", fast: "Xenova/whisper-tiny.en" };
let asr = null, loading = false, failed = false, modelName = "";
const CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
async function ensureModel() {
  if (asr) return asr;
  if (failed) return null;
  if (loading) { while (loading) { await new Promise(r => setTimeout(r, 200)); } return asr || (failed ? null : ensureModel()); }
  loading = true;
  try { window.jarvis.whisperLoading(); } catch (e) {}
  if (!modelName) { let cfg = {}; try { cfg = await window.jarvis.getConfig(); } catch (e) {} modelName = MODELS[cfg.hearing] || MODELS.accurate; }
  const want = modelName;
  let err = null;
  try {
    const mod = await import(CDN);
    mod.env.allowLocalModels = false;
    mod.env.useBrowserCache = true;
    // the one picked in Settings; if that won't load, the small one, so hearing still works
    for (const name of want === MODELS.fast ? [want] : [want, MODELS.fast]) {
      try { asr = await mod.pipeline("automatic-speech-recognition", name); break; } catch (e) { err = e; }
    }
  } catch (e) { err = e; }
  loading = false;
  if (want !== modelName) { asr = null; return ensureModel(); }     // the setting changed while it was loading
  if (asr) { try { window.jarvis.whisperReady(); } catch (e) {} }
  else { failed = true; try { window.jarvis.whisperFail(String((err && err.message) || err)); } catch (x) {} }
  return asr;
}
// start fetching the model as soon as the app opens, so it's ready when you first speak
ensureModel();

// what Whisper writes for silence or noise rather than words
function tidy(text) {
  text = String(text || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (/^(you|thank you\.?|thanks\.?|thanks for watching[.!]?|bye\.?|\.+)$/i.test(text)) return "";
  return text;
}
async function hear(audio) {
  if (!asr) return "";
  // English-only models must NOT be given a language or task (that confuses them into hearing the wrong thing)
  const r = await asr(audio, { chunk_length_s: 30 });
  return tidy(r && r.text);
}

/* ---------------------------------------------------------------- the microphone */
// While "Listen for Jarvis" is on, the microphone stays open and the last few seconds are kept in memory (see
// lib/listen.mjs) so a question said straight after "Jarvis" isn't missed. Turn listening off and it's closed.
const listener = createListener();
let mic = null, micDevice = "", armed = false, busy = false, opening = null;

async function openMic(device) {
  device = device || "";
  if (opening) { try { await opening; } catch (e) {} }      // never open it twice at once
  if (mic && micDevice === device) return true;
  opening = reallyOpen(device);
  try { return await opening; } finally { opening = null; }
}
async function reallyOpen(device) {
  closeMic();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: device ? { deviceId: { exact: device } } : true, video: false });
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    try { await actx.resume(); } catch (e) {}
    const src = actx.createMediaStreamSource(stream);
    const node = actx.createScriptProcessor(2048, 1, 1);
    src.connect(node); node.connect(actx.destination);
    node.onaudioprocess = ev => {
      const done = listener.push(to16k(ev.inputBuffer.getChannelData(0), actx.sampleRate), Date.now());
      if (done) heard(done);
    };
    mic = { stream, actx, src, node }; micDevice = device || "";
    return true;
  } catch (e) { mic = null; return false; }
}
function closeMic() {
  if (!mic) return;
  try { mic.node.onaudioprocess = null; mic.node.disconnect(); mic.src.disconnect(); } catch (e) {}
  try { mic.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { mic.actx.close(); } catch (e) {}
  mic = null;
}

// a capture is finished: turn it into words
async function heard(c) {
  if (!armed) closeMic();     // the hotkey opened it just for this
  busy = true;
  let text = "";
  if (c.voiced && c.audio.length >= 16000 * 0.3) {
    try { window.jarvis.recState("thinking"); } catch (e) {}
    try { text = await hear(c.audio); } catch (e) { text = ""; }
  }
  busy = false;
  try { window.jarvis.transcript(text); } catch (e) {}
}

async function capture(mode, device) {
  if (busy || listener.capturing) return;
  if (!(await ensureModel())) { try { window.jarvis.transcript(""); } catch (e) {} return; }
  if (!(await openMic(device))) { try { window.jarvis.transcript(""); } catch (e) {} return; }
  listener.start(mode === "wake" ? "wake" : "once", Date.now());
  try { window.jarvis.recState("listening"); } catch (e) {}
}

window.jarvis.onRecord(d => {
  d = d || {};
  const device = d.device || "";
  if (d.mode === "arm") { armed = true; ensureModel().then(ok => { if (ok && armed) openMic(device); }); }
  else if (d.mode === "disarm") { armed = false; if (!listener.capturing && !busy) closeMic(); }
  else if (d.mode === "model") {
    // a different hearing quality was picked in Settings: load that one instead
    const next = MODELS[d.hearing] || MODELS.accurate;
    if (next !== modelName) { modelName = next; asr = null; failed = false; ensureModel(); }
  }
  else capture(d.mode, device);
});

/* ---------------------------------------------------------------- playing the spoken answer */
let audio = null;
function stopAudio() {
  if (!audio) return;
  const a = audio; audio = null;
  a.onended = a.onerror = a.onpause = null;
  try { a.pause(); } catch (e) {}
  try { URL.revokeObjectURL(a.src); a.removeAttribute("src"); a.load(); } catch (e) {}
}
window.jarvis.onPlay(buf => {
  try {
    stopAudio();
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const url = URL.createObjectURL(new Blob([u8], { type: "audio/mpeg" }));
    const a = audio = new Audio(url);
    // tell the app when it's talking, so the bubble can show Stop
    const done = () => { if (audio === a) { audio = null; URL.revokeObjectURL(url); window.jarvis.audioState(false); } };
    a.onended = done; a.onerror = done;
    a.play().then(() => { if (audio === a) window.jarvis.audioState(true); }).catch(done);
  } catch (e) { try { window.jarvis.audioState(false); } catch (x) {} }
});
// Stop: quiet at once, mid-sentence
window.jarvis.onStopAudio(() => { stopAudio(); try { window.jarvis.audioState(false); } catch (e) {} });
