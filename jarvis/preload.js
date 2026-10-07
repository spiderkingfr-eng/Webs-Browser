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
  // the hidden worker (microphone + playing the voice)
  onMic: fn => ipcRenderer.on("mic", (e, d) => fn(d)),
  micData: buf => ipcRenderer.send("mic-data", buf),
  onPlay: fn => ipcRenderer.on("play", (e, buf) => fn(buf))
});
