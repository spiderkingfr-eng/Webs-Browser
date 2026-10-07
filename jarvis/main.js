/* Jarvis for Webs - the background app.
   A tray app that sits quietly on your PC. Say your wake word ("Jarvis…") or press the hotkey, ask anything, and it
   answers in a little bubble at the bottom-right - seeing your screen if you let it. It uses your own Web AI server
   (the same one the browser uses) for the answer and the voice; nothing goes anywhere else, and a screenshot is only
   ever sent the moment you ask a question. Settings (tray → Settings) change its name, voice, hotkey and the rest.

   This is the main process: windows, the tray, the hotkey, the screenshot, and the talking-to-the-server. Hearing you
   is done by Windows' own built-in speech recognition (lib/stt-win.ps1) - no download, no extra install. Without it
   (non-Windows, or speech turned off in Windows) the hotkey opens a box you can type into, and typing always works. */
"use strict";
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer, screen, nativeImage, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const config = require("./lib/config");
const ai = require("./lib/ai");
const shot = require("./lib/shot");
const wake = require("./lib/wake");

const DIR = app.getPath("userData");
let cfg = config.load(DIR);
const speechOk = process.platform === "win32";     // Windows' built-in recognition

let tray = null, overlay = null, settingsWin = null, worker = null, indicator = null;
let listening = false, asking = false, listenProc = null, onceProc = null;

// the wake words to tell Windows' recogniser about (the name, "hey <name>", and a few near-spellings Windows
// commonly mishears the name as - that's what makes it actually catch "Jarvis")
function wakeWords() {
  const name = config.wakeWord(cfg);
  const out = new Set(wake.variants(cfg.name));
  out.add("hey " + name); out.add("okay " + name);
  return [...out].join(",");
}

/* ---------------------------------------------------------------- hearing you (Windows speech) */
const PS = path.join(__dirname, "lib", "stt-win.ps1");
function psArgs(mode) { return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS, "-Mode", mode]; }

// read the helper's lines (TEXT: a phrase · WAKE: heard the wake word · NONE: nothing after the wake · ERR: a problem)
function readLines(proc, h) {
  let buf = "";
  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", d => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ""); buf = buf.slice(i + 1);
      if (line.startsWith("TEXT:") && h.text) h.text(line.slice(5).trim());
      else if (line === "WAKE" && h.wake) h.wake();
      else if (line === "NONE" && h.none) h.none();
      else if (line.startsWith("ERR:") && h.err) h.err(line.slice(4).trim());
    }
  });
}

// the always-on wake word
function setListening(on) {
  listening = !!on && speechOk;
  if (listenProc) { try { listenProc.kill(); } catch (e) {} listenProc = null; }
  if (listening) {
    try {
      listenProc = spawn("powershell", psArgs("continuous").concat(["-Wake", wakeWords()]), { windowsHide: true });
      readLines(listenProc, {
        // heard "Jarvis": show at once that it's listening for your question (the 3s window is open)
        wake: () => { if (!listening || asking) return; showBubble(false); showDot("busy"); toBubble("say", { text: "Yes? I'm listening…", listening: true }); },
        // your question came through
        text: t => { if (!listening) return; const q = wake.detect(t, cfg.name).question || t; if (wake.looksComplete(q)) ask(q); else { showDot("listening"); toBubble("say", { text: "I didn't catch that. Say “" + cfg.name + "” and ask again.", listening: true }); } },
        // nothing said in the window: quietly go back to waiting for the wake word
        none: () => { if (listening && !asking) { showDot("listening"); toBubble("say", { text: "Listening for “" + cfg.name + "”…", listening: true }); } },
        err: () => { listening = false; showDot("off"); refreshTray(); }
      });
      listenProc.on("close", () => { listenProc = null; });
    } catch (e) { listening = false; }
  }
  showDot(listening ? "listening" : "off");
  refreshTray();
}

// the hotkey / tray "Ask": listen for one question (no wake word needed), then answer
function startVoiceAsk() {
  if (!speechOk) { showBubble(true); toBubble("say", { text: "Type your question below. (Spoken questions need Windows, with its speech recognition on.)", listening: false }); return; }
  if (onceProc) return;
  showBubble(false);
  showDot("listening");
  toBubble("say", { text: "Listening… ask your question.", listening: true });
  // pause the always-on listener so the two don't fight over the microphone
  const wasListening = listening;
  if (listenProc) { try { listenProc.kill(); } catch (e) {} listenProc = null; }
  let answered = false;
  try {
    onceProc = spawn("powershell", psArgs("once"), { windowsHide: true });
    readLines(onceProc, {
      text: text => {
        answered = true;
        const q = wake.detect(text, cfg.name).question || text;
        if (wake.looksComplete(q)) ask(q); else toBubble("say", { text: "I didn't catch that. Try again, or type it below.", listening: false });
      },
      err: () => { toBubble("say", { text: "Couldn't hear the microphone. You can type below instead.", listening: false }); }
    });
    onceProc.on("close", () => { onceProc = null; if (!answered) toBubble("say", { text: "I didn't catch that. Try again, or type below.", listening: false }); if (wasListening) setTimeout(() => setListening(true), 400); });
  } catch (e) { onceProc = null; toBubble("say", { text: "Couldn't start listening. Type below instead.", listening: false }); }
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
// the little "I'm listening" red ball in the bottom-right corner - always on top, never clickable
function indicatorBounds() {
  const d = screen.getPrimaryDisplay().workArea, s = 22, m = 8;
  return { x: d.x + d.width - s - m, y: d.y + d.height - s - m, width: s, height: s };
}
function makeIndicator() {
  indicator = new BrowserWindow(Object.assign(indicatorBounds(), {
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    alwaysOnTop: true, focusable: false, show: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  }));
  indicator.setAlwaysOnTop(true, "screen-saver");
  indicator.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  try { indicator.setIgnoreMouseEvents(true, { forward: true }); } catch (e) {}
  indicator.loadFile("dot.html");
  indicator.on("closed", () => { indicator = null; });
}
function showDot(state) {
  if (state === "off") { if (indicator) indicator.hide(); return; }
  if (!cfg.overlay) return;      // the bubble being off hides every on-screen piece (for anti-cheat)
  if (!indicator) makeIndicator();
  const go = () => { indicator.setBounds(indicatorBounds()); indicator.showInactive(); try { indicator.webContents.send("dot", { state }); } catch (e) {} };
  if (indicator.webContents.isLoading()) indicator.webContents.once("did-finish-load", go); else go();
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
  const img = nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png"));
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
    { label: "Listen for \"" + cfg.name + "\"", type: "checkbox", checked: listening && speechOk, enabled: speechOk, click: m => setListening(m.checked) },
    { label: "Show the bubble", type: "checkbox", checked: cfg.overlay, click: m => { cfg = config.save(DIR, Object.assign({}, cfg, { overlay: m.checked })); } },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    { label: speechOk ? "Voice: Windows speech" : "Voice: type only (not Windows)", enabled: false },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

/* ---------------------------------------------------------------- keeping an eye on the screen (locally) */
// It looks at your screen every couple of seconds and keeps only the latest picture, here on your PC. Nothing is
// sent anywhere by this - only when you ask a question is the newest picture sent (once), to protect your daily limit.
let lastFrame = null, lastFrameAt = 0, watchTimer = 0, watchBusy = false;
function startWatch() {
  clearInterval(watchTimer); watchTimer = 0;
  if (!cfg.watch || !cfg.sendScreenshot) { lastFrame = null; return; }
  const every = Math.max(1000, (+cfg.watchSecs || 2) * 1000);
  watchTimer = setInterval(async () => {
    if (watchBusy || asking) return;
    watchBusy = true;
    try { const img = await grabScreen(); if (img) { lastFrame = img; lastFrameAt = Date.now(); } } catch (e) {}
    watchBusy = false;
  }, every);
}

/* ---------------------------------------------------------------- the screenshot */
let lastShotNote = "";
async function grabScreen() {
  if (!cfg.sendScreenshot) { lastShotNote = "off"; return null; }
  try {
    // the monitor you're actually looking at (the one your mouse is on)
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
    // capture straight at the small size we want (asking for the full 4K can come back blank on some PCs)
    const want = shot.fitSize(d.size.width, d.size.height, cfg.maxWidth);
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: want.w, height: want.h } });
    if (!sources.length) { lastShotNote = "nosrc"; return null; }
    // the display under the cursor; else whichever source actually came back with a picture
    let src = sources.find(s => String(s.display_id) === String(d.id) && !s.thumbnail.isEmpty());
    if (!src) src = sources.filter(s => !s.thumbnail.isEmpty()).sort((a, b) => { const A = a.thumbnail.getSize(), B = b.thumbnail.getSize(); return B.width * B.height - A.width * A.height; })[0];
    if (!src || src.thumbnail.isEmpty()) { lastShotNote = "empty"; return null; }
    let img = src.thumbnail;
    const got = img.getSize();
    const fit = shot.fitSize(got.width, got.height, cfg.maxWidth);
    if (fit.scale < 1) img = img.resize({ width: fit.w, height: fit.h, quality: "good" });
    for (const q of [72, 55, 40, 28, 18]) {
      const jpeg = img.toJPEG(q);
      if (jpeg && jpeg.length > 200) {
        const data = "data:image/jpeg;base64," + jpeg.toString("base64");
        if (!shot.tooBig(data)) { lastShotNote = "ok"; return data; }
      }
    }
    lastShotNote = "toobig"; return null;
  } catch (e) { lastShotNote = "err:" + (e && e.message || e); console.error("screenshot failed:", e); return null; }
}

/* ---------------------------------------------------------------- asking the server */
async function ask(question) {
  if (asking) return;
  if (!cfg.server) { showBubble(true); toBubble("answer", { done: true, text: "Open Settings and paste your Web AI server address first." }); openSettings(); return; }
  asking = true;
  showBubble(false);
  showDot("busy");
  toBubble("question", { text: question });
  toBubble("answer", { text: "", thinking: true });
  let answer = "";
  try {
    // use the freshest watched frame if we have one (instant); otherwise grab one right now
    let image = (cfg.watch && lastFrame && Date.now() - lastFrameAt < 4000) ? lastFrame : await grabScreen();
    if (cfg.sendScreenshot && !image) toBubble("warn", { text: "Couldn't capture the screen (" + lastShotNote + ") — answering from your words. Tell me if this keeps happening." });
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
        if (part.error) { toBubble("answer", { done: true, text: part.error }); asking = false; return; }
        if (part.text) { answer += part.text; toBubble("answer", { text: ai.cleanForShow(answer) }); }
        if (part.end && typeof part.left === "number") toBubble("left", { left: part.left });
      }
    }
    reader.end().forEach(p => { if (p.text) answer += p.text; });
    toBubble("answer", { done: true, text: ai.cleanForShow(answer) || "(no answer)" });
    if (cfg.voice && answer) speak(ai.cleanForSpeech(answer));
  } catch (e) {
    toBubble("answer", { done: true, text: "Couldn't reach your Web AI server. Check it's on, and the address in Settings." });
  }
  asking = false;
  showDot(listening ? "listening" : "off");
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
  if (!cfg.overlay && !overlay) return;
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
  applyHotkey();
  applyAutostart();
  startWatch();
  refreshTray();
  if (tray) tray.setToolTip(cfg.name + " - your screen assistant");
  if (before.wakeEnabled !== cfg.wakeEnabled) setListening(cfg.wakeEnabled);
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

/* ---------------------------------------------------------------- hotkey & autostart */
function applyHotkey() {
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
    makeWorker();
    buildTray();
    applyHotkey();
    applyAutostart();
    startWatch();
    if (cfg.wakeEnabled && speechOk) setTimeout(() => setListening(true), 1500);
    if (!cfg.server) setTimeout(openSettings, 800);
  });
  app.on("window-all-closed", () => { /* a tray app keeps running */ });
  app.on("will-quit", () => {
    try { globalShortcut.unregisterAll(); } catch (e) {}
    clearInterval(watchTimer);
    if (listenProc) try { listenProc.kill(); } catch (e) {}
    if (onceProc) try { onceProc.kill(); } catch (e) {}
    if (indicator) try { indicator.destroy(); } catch (e) {}
  });
}
