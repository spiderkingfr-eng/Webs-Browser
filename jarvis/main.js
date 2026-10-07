/* Jarvis for Webs - the background app.
   A tray app that sits quietly on your PC. Say your wake word ("Jarvis…") or press the hotkey, ask anything, and it
   answers in a little bubble at the bottom-right - seeing your screen if you let it. It uses your own Web AI server
   (the same one the browser uses) for the answer and the voice; nothing goes anywhere else, and a screenshot is only
   ever sent the moment you ask a question. Settings (tray → Settings) change its name, voice, hotkey and the rest.

   This is the main process: windows, the tray, the hotkey, the screenshot, and the talking-to-the-server. The speech
   model (vosk) is optional - without it, the hotkey and the typed box still work (see README.md). */
"use strict";
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer, screen, nativeImage, shell } = require("electron");
const path = require("path");
const config = require("./lib/config");
const ai = require("./lib/ai");
const shot = require("./lib/shot");

const DIR = app.getPath("userData");
let cfg = config.load(DIR);

let tray = null, overlay = null, settingsWin = null, worker = null;
let listening = false, asking = false, modelReady = false;

/* ---------------------------------------------------------------- the speech model (optional) */
let vosk = null, voskModel = null, rec = null;
function startModel() {
  try { vosk = require("vosk"); } catch (e) { vosk = null; }
  if (!vosk) { console.log("Speech model not installed (npm i vosk). The hotkey and typing still work."); return; }
  const modelDir = process.env.JARVIS_MODEL || path.join(__dirname, "model");
  try {
    vosk.setLogLevel(-1);
    voskModel = new vosk.Model(modelDir);
    rec = new vosk.Recognizer({ model: voskModel, sampleRate: 16000 });
    modelReady = true;
    console.log("Speech model loaded from", modelDir);
  } catch (e) { modelReady = false; console.log("No speech model in", modelDir, "- put an unzipped vosk model there for the wake word (see README.md)."); }
}

/* ---------------------------------------------------------------- windows */
function overlayBounds() {
  const d = screen.getPrimaryDisplay().workArea;
  const w = 380, h = 260, m = 18;
  return { x: d.x + d.width - w - m, y: d.y + d.height - h - m, width: w, height: h };
}
function makeOverlay() {
  overlay = new BrowserWindow(Object.assign(overlayBounds(), {
    frame: false, transparent: true, resizable: false, movable: true, skipTaskbar: true,
    alwaysOnTop: true, focusable: true, show: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  }));
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile("overlay.html");
  overlay.on("closed", () => { overlay = null; });
}
function makeWorker() {
  worker = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, "preload.js") } });
  worker.loadFile("worker.html");
  worker.on("closed", () => { worker = null; });
}
function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 520, height: 680, title: "Jarvis settings", autoHideMenuBar: true, resizable: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  });
  settingsWin.loadFile("settings.html");
  settingsWin.on("closed", () => { settingsWin = null; });
}

/* ---------------------------------------------------------------- the tray */
function trayIcon() {
  const p = path.join(__dirname, "assets", "icon.png");
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}
function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip(cfg.name + " - your screen assistant");
  refreshTray();
  tray.on("click", () => showBubble(true));
}
function refreshTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Ask " + cfg.name + " (" + (cfg.hotkey || "hotkey") + ")", click: () => startVoiceAsk() },
    { label: "Type a question", click: () => showBubble(true) },
    { type: "separator" },
    { label: "Listen for \"" + cfg.name + "\"", type: "checkbox", checked: listening && modelReady, enabled: modelReady, click: m => setListening(m.checked) },
    { label: "Show the bubble", type: "checkbox", checked: cfg.overlay, click: m => { cfg = config.save(DIR, Object.assign({}, cfg, { overlay: m.checked })); } },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    { label: modelReady ? "Speech: ready" : "Speech: not set up (README)", enabled: false },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

/* ---------------------------------------------------------------- listening */
function setListening(on) {
  listening = !!on && modelReady;
  if (worker && worker.webContents) worker.webContents.send("mic", listening ? { on: true, device: cfg.mic } : { on: false });
  refreshTray();
}
// the hotkey / tray "Ask": listen for one question (no wake word needed), then answer
let oneShot = false;
function startVoiceAsk() {
  if (!modelReady) { showBubble(true); toBubble("say", { text: "Type your question below (voice needs the speech model - see README).", listening: false }); return; }
  oneShot = true;
  if (rec) try { rec.reset(); } catch (e) {}
  if (worker && worker.webContents) worker.webContents.send("mic", { on: true, device: cfg.mic, oneShot: true });
  showBubble(false);
  toBubble("say", { text: "Listening…", listening: true });
}

// mic frames from the worker (16 kHz mono Int16) -> vosk -> wake word / question
ipcMain.on("mic-data", (e, buf) => {
  if (!rec || !(listening || oneShot)) return;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let done = false;
  try { done = rec.acceptWaveform(b); } catch (err) { return; }
  if (done) {
    let text = ""; try { text = (JSON.parse(rec.result()).text || ""); } catch (err) {}
    handleHeard(text, true);
  } else {
    let part = ""; try { part = (JSON.parse(rec.partialResult()).partial || ""); } catch (err) {}
    if (part) toBubble("heard", { text: part });
  }
});
function handleHeard(text, isFinal) {
  if (!text) return;
  const wake = require("./lib/wake");
  if (oneShot) {
    // the hotkey/tray already started us; the whole utterance is the question
    oneShot = false;
    if (worker && worker.webContents && !listening) worker.webContents.send("mic", { on: false });
    const q = wake.detect(text, cfg.name).question || text;     // allow "jarvis ..." here too
    if (wake.looksComplete(q)) ask(q); else toBubble("say", { text: "I didn't catch that. Try again, or type it.", listening: false });
    return;
  }
  if (!listening) return;
  const r = wake.detect(text, cfg.name);
  if (r.hit && wake.looksComplete(r.question)) ask(r.question);
}

/* ---------------------------------------------------------------- the screenshot */
async function grabScreen() {
  if (!cfg.sendScreenshot) return null;
  try {
    const d = screen.getPrimaryDisplay();
    const size = d.size, sf = d.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: Math.round(size.width * sf), height: Math.round(size.height * sf) } });
    if (!sources.length) return null;
    let img = sources[0].thumbnail;
    const got = img.getSize();
    const fit = shot.fitSize(got.width, got.height, cfg.maxWidth);
    if (fit.scale < 1) img = img.resize({ width: fit.w, height: fit.h, quality: "good" });
    for (const q of [70, 55, 40, 28]) {
      const data = "data:image/jpeg;base64," + img.toJPEG(q).toString("base64");
      if (!shot.tooBig(data)) return data;
    }
    return null;     // couldn't get it small enough; ask without it
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------- asking the server */
async function ask(question) {
  if (asking) return;
  if (!cfg.server) { showBubble(true); toBubble("answer", { done: true, text: "Open Settings and paste your Web AI server address first." }); openSettings(); return; }
  asking = true;
  showBubble(false);
  toBubble("question", { text: question });
  toBubble("answer", { text: "", thinking: true });
  let answer = "";
  try {
    const image = await grabScreen();
    const body = ai.buildBody({ question, cfg, imageDataUrl: image, now: new Date() });
    const res = await fetch(cfg.server + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok || !res.body) {
      let msg = "The server didn't answer (" + res.status + ").";
      try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) {}
      toBubble("answer", { done: true, text: msg });
      asking = false; return;
    }
    const reader = ai.streamReader(), dec = new TextDecoder();
    const r = res.body.getReader();
    for (;;) {
      const { value, done } = await r.read();
      if (done) break;
      for (const part of reader.push(dec.decode(value, { stream: true }))) {
        if (part.error) { answer = part.error; toBubble("answer", { done: true, text: ai.cleanForShow(answer) }); asking = false; return; }
        if (part.text) { answer += part.text; toBubble("answer", { text: ai.cleanForShow(answer) }); }
        if (part.end && typeof part.left === "number") toBubble("left", { left: part.left });
      }
    }
    reader.end().forEach(p => { if (p.text) answer += p.text; });
    const shown = ai.cleanForShow(answer) || "(no answer)";
    toBubble("answer", { done: true, text: shown });
    if (cfg.voice && answer) speak(ai.cleanForSpeech(answer));
  } catch (e) {
    toBubble("answer", { done: true, text: "Couldn't reach your Web AI server. Check it's on, and the address in Settings." });
  }
  asking = false;
}

/* ---------------------------------------------------------------- the voice (Adam, through /speak) */
async function speak(text) {
  if (!text || !cfg.server || !worker || !worker.webContents) return;
  try {
    const res = await fetch(cfg.server + "/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device: cfg.device, code: cfg.code || undefined, text: text.slice(0, 1200) }) });
    if (!res.ok) return;
    const buf = Buffer.from(await res.arrayBuffer());
    worker.webContents.send("play", buf);
  } catch (e) {}
}

/* ---------------------------------------------------------------- the bubble */
function showBubble(focus) {
  if (!cfg.overlay) return;
  if (!overlay) makeOverlay();
  const go = () => { overlay.setBounds(overlayBounds()); overlay.showInactive(); if (focus) { overlay.focus(); toBubble("focus", {}); } };
  if (overlay.webContents.isLoading()) overlay.webContents.once("did-finish-load", go); else go();
}
function toBubble(kind, data) {
  if (!cfg.overlay) { if (!overlay) return; }
  if (!overlay) makeOverlay();
  const msg = Object.assign({ kind: kind, name: cfg.name }, data);
  const send = () => { try { overlay.webContents.send("bubble", msg); } catch (e) {} };
  if (overlay.webContents.isLoading()) overlay.webContents.once("did-finish-load", send); else send();
}

/* ---------------------------------------------------------------- settings <-> windows */
ipcMain.handle("get-config", () => cfg);
ipcMain.handle("save-config", (e, next) => {
  const before = cfg;
  cfg = config.save(DIR, Object.assign({}, cfg, next || {}));
  applyHotkey(before.hotkey);
  applyAutostart();
  if (settingsWin) settingsWin.setTitle("Jarvis settings");
  refreshTray();
  if (tray) tray.setToolTip(cfg.name + " - your screen assistant");
  return cfg;
});
ipcMain.handle("test-server", async () => {
  if (!cfg.server) return { ok: false, message: "No server address yet." };
  try { const r = await fetch(cfg.server + "/", { method: "GET" }); const j = await r.json(); return { ok: !!j.ok, ready: !!j.ready, name: j.name || "Web AI", voice: (j.features || []).includes("voice"), message: j.missing || "" }; }
  catch (e) { return { ok: false, message: "Couldn't reach that address." }; }
});
ipcMain.on("ask-text", (e, q) => { if (q && String(q).trim()) ask(String(q).trim()); });
ipcMain.on("open-external", (e, u) => { if (/^https?:\/\//.test(u)) shell.openExternal(u); });
ipcMain.on("hide-bubble", () => { if (overlay) overlay.hide(); });
ipcMain.on("start-voice", () => startVoiceAsk());
ipcMain.handle("mics", () => true);

/* ---------------------------------------------------------------- hotkey & autostart */
function applyHotkey(oldKey) {
  try { globalShortcut.unregisterAll(); } catch (e) {}
  if (cfg.hotkey) { try { globalShortcut.register(cfg.hotkey, () => startVoiceAsk()); } catch (e) {} }
}
function applyAutostart() {
  try { app.setLoginItemSettings({ openAtLogin: !!cfg.autostart, args: ["--hidden"] }); } catch (e) {}
}

/* ---------------------------------------------------------------- start up */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on("second-instance", () => showBubble(true));
  app.whenReady().then(() => {
    if (process.platform === "darwin" && app.dock) app.dock.hide();
    startModel();
    makeWorker();
    buildTray();
    applyHotkey();
    applyAutostart();
    if (cfg.wakeEnabled && modelReady) setTimeout(() => setListening(true), 1500);
    if (!cfg.server) setTimeout(openSettings, 800);
  });
  app.on("window-all-closed", e => { /* a tray app keeps running */ });
  app.on("will-quit", () => { try { globalShortcut.unregisterAll(); } catch (e) {} if (rec) try { rec.free(); } catch (e) {} if (voskModel) try { voskModel.free(); } catch (e) {} });
}
