/* Jarvis for Webs - the safe bridge between the windows (the bubble, settings, the hidden worker) and the main
   process. The pages can only use exactly what's listed here, nothing else of the computer. */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  // settings page
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: next => ipcRenderer.invoke("save-config", next),
  testServer: () => ipcRenderer.invoke("test-server"),
  openExternal: u => ipcRenderer.send("open-external", u),
  // the bubble
  onBubble: fn => ipcRenderer.on("bubble", (e, d) => fn(d)),
  askText: q => ipcRenderer.send("ask-text", q),
  startVoice: () => ipcRenderer.send("start-voice"),
  hideBubble: () => ipcRenderer.send("hide-bubble"),
  stopTalking: () => ipcRenderer.send("stop-talking"),
  toggleVoice: () => ipcRenderer.send("toggle-voice"),
  // the little "listening" ball
  onDot: fn => ipcRenderer.on("dot", (e, d) => fn(d)),
  // the hidden worker (hearing via Whisper, and playing the spoken answer)
  onRecord: fn => ipcRenderer.on("record", (e, d) => fn(d)),
  whisperReady: () => ipcRenderer.send("whisper-ready"),
  whisperFail: m => ipcRenderer.send("whisper-fail", m),
  whisperLoading: () => ipcRenderer.send("whisper-loading"),
  transcript: t => ipcRenderer.send("transcript", t),
  recState: s => ipcRenderer.send("rec-state", s),
  onPlay: fn => ipcRenderer.on("play", (e, buf) => fn(buf)),
  onStopAudio: fn => ipcRenderer.on("stop-audio", () => fn()),
  onPauseAudio: fn => ipcRenderer.on("pause-audio", () => fn()),
  onResumeAudio: fn => ipcRenderer.on("resume-audio", () => fn()),
  audioState: on => ipcRenderer.send("audio-state", !!on)
});
