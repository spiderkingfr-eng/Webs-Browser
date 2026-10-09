/* Jarvis for Webs - the background app.
   A tray app that sits quietly on your PC. Say your wake word ("Jarvis…") or press the hotkey, ask anything, and it
   answers in a little bubble at the bottom-right - seeing your screen if you let it. It uses your own Web AI server
   (the same one the browser uses) for the answer and the voice; nothing goes anywhere else, and a screenshot is only
   ever sent the moment you ask a question. Settings (tray → Settings) change its name, voice, hotkey and the rest.

   This is the main process: windows, the tray, the hotkey, the screenshot, and the talking-to-the-server. Hearing you
   is done by Windows' own built-in speech recognition (lib/stt-win.ps1) - no download, no extra install. Without it
   (non-Windows, or speech turned off in Windows) the hotkey opens a box you can type into, and typing always works. */
"use strict";
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer, screen, nativeImage, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const config = require("./lib/config");
const ai = require("./lib/ai");
const shot = require("./lib/shot");
const wake = require("./lib/wake");
const models = require("./lib/models");
const commands = require("./lib/commands");

const DIR = app.getPath("userData");
let cfg = config.load(DIR);

/* ---------------------------------------------------------------- never wait forever */
// Every step that waits on something outside (the server, the screen, the voice) has a time limit, so one slow or
// dropped connection can't leave Jarvis stuck and ignoring you until it's restarted.
const LIMIT = { shot: 8000, check: 5000, connect: 45000, quiet: 90000, speak: 20000, think: 120000 };
function withTimeout(promise, ms, fallback) {
  let t; return Promise.race([promise, new Promise(r => { t = setTimeout(() => r(fallback), ms); })]).finally(() => clearTimeout(t));
}
// fetch that gives up if no reply has started within ms. `outer` (e.g. the Stop button) still stops it at any
// point - including while the answer is streaming in, which is why that link is kept for the whole response.
function fetchFor(url, init, ms, outer) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener("abort", () => ctl.abort(), { once: true }); }
  return fetch(url, Object.assign({}, init, { signal: ctl.signal })).finally(() => clearTimeout(t));
}
// a small diary of what went wrong (no questions or answers in it), for when you tell me "it just didn't work":
// tray → "Open the log"
const LOG = path.join(DIR, "jarvis.log");
function log(msg) {
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 200000) fs.renameSync(LOG, LOG + ".old");
    fs.appendFileSync(LOG, new Date().toISOString() + "  " + msg + "\n");
  } catch (e) {}
}
const speechOk = process.platform === "win32";     // Windows' built-in recognition

let tray = null, overlay = null, settingsWin = null, worker = null, indicator = null;
let listening = false, asking = false, listenProc = null, onceProc = null;
let whisperOk = false, whisperLoading = false, recording = false;   // Whisper = the accurate hearing (worker.js)

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
function psArgs(mode) { return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS, "-Mode", mode, "-WakeConf", String(config.SENSITIVITY[cfg.wakeSensitivity] || 0.5)]; }

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

// got a question (from Whisper, or from Windows speech as a fallback). After the wake word, Whisper has heard
// "Jarvis, how do I make a furnace" - the question is what comes after the name.
function gotQuestion(raw, mode) {
  recording = false; clearTimeout(recTimer);
  raw = String(raw || "").trim();
  let q;
  if (mode === "wake") {
    const h = wake.heardName(raw, cfg.name);
    if (!h.hit) { notReallyWoken(); return; }      // it wasn't the name after all: carry on as if nothing happened
    q = h.question;
    if (paused || speaking) { paused = false; hushed = true; stopVoiceOnly(); }     // it was: go quiet
  } else q = wake.detect(raw, cfg.name).question || raw;
  if (wake.isStop(q)) { stopTalking(); showDot(listening ? "listening" : "off"); return; }     // "Jarvis, stop"
  if (asking && !wake.looksComplete(q)) return;     // just its name while it's answering: leave the answer be
  if (hushed && !wake.looksComplete(q)) { hushed = false; showDot(listening ? "listening" : "off"); return; }   // just "Jarvis" to quiet it: leave the answer up
  hushed = false;
  if (wake.looksComplete(q)) ask(q);
  else {
    showDot(listening ? "listening" : "off");
    const heard = q ? "I only heard “" + q + "”. " : "I didn't catch that. ";
    toBubble("say", { text: heard + (listening ? "Say “" + cfg.name + "” and ask again." : "Press " + cfg.hotkey + " and ask again, or type below."), listening: listening });
  }
}

// Windows fired, but Whisper (which hears properly) didn't hear the name: undo the little that changed
function notReallyWoken() {
  if (paused) { paused = false; if (worker && worker.webContents) worker.webContents.send("resume-audio"); }
  showDot(asking ? "busy" : listening ? "listening" : "off");
}

let restarts = [];
// the always-on wake word. With Whisper: Windows just spots "Jarvis", then Whisper hears the question (far better).
// Without Whisper (still loading, or it failed): Windows does the whole thing (the older, rougher way).
function setListening(on) {
  listening = !!on && speechOk;
  if (listenProc) { try { listenProc.kill(); } catch (e) {} listenProc = null; }
  if (listening) {
    try {
      if (whisperOk) {
        armMic(true);      // the worker keeps the last few seconds, so a question said right after the name isn't lost
        listenProc = spawn("powershell", psArgs("wake").concat(["-Wake", wakeWords()]), { windowsHide: true });
        readLines(listenProc, {
          wake: () => {
            // Windows *thinks* it heard the name. Nothing shows yet: Whisper checks it really was the name first
            // (Windows sometimes fires on other words), and only then does anything happen. The ball turns amber.
            if (!listening || recording) return;
            recording = true;
            // talking? hold the voice while we check ("Jarvis, stop" - or a new question); carry on if it wasn't the name
            if (playing && worker && worker.webContents) { paused = true; worker.webContents.send("pause-audio"); }
            showDot("busy");
            recordQuestion("wake");
          },
          err: m => { log("wake listener: " + m); listening = false; showDot("off"); refreshTray(); }
        });
      } else {
        listenProc = spawn("powershell", psArgs("continuous").concat(["-Wake", wakeWords()]), { windowsHide: true });
        readLines(listenProc, {
          wake: () => { if (!listening || asking) return; showBubble(false); showDot("busy"); toBubble("say", { text: "Yes? I'm listening…", listening: true }); },
          text: t => { if (listening) gotQuestion(t); },
          none: () => { if (listening && !asking) { showDot("listening"); toBubble("say", { text: "Listening for “" + cfg.name + "”…", listening: true }); } },
          err: m => { log("wake listener: " + m); listening = false; showDot("off"); refreshTray(); }
        });
      }
      // if the listener stops by itself (Windows speech hiccup, the microphone changed...), start it again
      const p = listenProc;
      p.on("close", code => {
        if (listenProc !== p) return;            // replaced or turned off on purpose
        listenProc = null;
        if (!listening) return;
        const now = Date.now(); restarts = restarts.filter(t => now - t < 60000); restarts.push(now);
        log("wake listener stopped (" + code + "), restarting" + (restarts.length > 5 ? " in a minute" : ""));
        setTimeout(() => { if (listening && !listenProc) setListening(true); }, restarts.length > 5 ? 60000 : 2000);
      });
    } catch (e) { listening = false; }
  }
  if (!listening || !whisperOk) armMic(false);
  showDot(listening ? "listening" : "off");
  refreshTray();
}

// the hotkey / tray "Ask": listen for one question (no wake word needed), then answer
function startVoiceAsk() {
  if (isTalking()) { stopTalking(); return; }      // the hotkey while it's talking: be quiet (press again to ask)
  if (!speechOk && !whisperOk) { showBubble(true); toBubble("say", { text: "Type your question below.", listening: false }); return; }
  if (recording || onceProc) return;
  showBubble(false);
  showDot("listening");
  if (whisperOk) {
    recording = true;
    toBubble("say", { text: "Listening… ask your question.", listening: true });
    recordQuestion("once");
    return;
  }
  if (whisperLoading) { toBubble("say", { text: "Jarvis's better hearing is still downloading (one-time). Type below for now.", listening: false }); return; }
  // fallback: Windows speech, one phrase
  toBubble("say", { text: "Listening… ask your question.", listening: true });
  const wasListening = listening;
  if (listenProc) { try { listenProc.kill(); } catch (e) {} listenProc = null; }
  let answered = false;
  try {
    onceProc = spawn("powershell", psArgs("once"), { windowsHide: true });
    readLines(onceProc, {
      text: text => { answered = true; gotQuestion(text); },
      err: () => { toBubble("say", { text: "Couldn't hear the microphone. You can type below instead.", listening: false }); }
    });
    onceProc.on("close", () => { onceProc = null; if (!answered) toBubble("say", { text: "I didn't catch that. Try again, or type below.", listening: false }); if (wasListening) setTimeout(() => setListening(true), 400); });
  } catch (e) { onceProc = null; toBubble("say", { text: "Couldn't start listening. Type below instead.", listening: false }); }
}

/* ---------------------------------------------------------------- windows */
function overlayBounds() {
  const w = 390, h = 300, m = 18;
  // where you last dragged it, if that's still on one of your screens; else the bottom-right corner
  const b = cfg.bubble;
  if (b) {
    const fits = screen.getAllDisplays().some(d => { const a = d.workArea; return b.x >= a.x - 40 && b.y >= a.y && b.x + w <= a.x + a.width + 40 && b.y + h <= a.y + a.height + 40; });
    if (fits) return { x: b.x, y: b.y, width: w, height: h };
  }
  const d = screen.getPrimaryDisplay().workArea;
  return { x: d.x + d.width - w - m, y: d.y + d.height - h - m, width: w, height: h };
}
let movedTimer = 0;
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
  // remember where you drag it
  overlay.on("moved", () => { clearTimeout(movedTimer); movedTimer = setTimeout(() => { if (!overlay) return; const [x, y] = overlay.getPosition(); cfg = config.save(DIR, Object.assign({}, cfg, { bubble: { x, y } })); }, 400); });
}
function makeWorker() {
  const w = worker = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false } });
  w.loadFile("worker.html");
  w.on("closed", () => { if (worker === w) worker = null; });
  // the hidden window that hears you (Whisper) and plays the voice crashed or froze: start a fresh one, so hearing
  // and the voice come back by themselves instead of staying dead until Jarvis is restarted
  const redo = why => {
    if (worker !== w) return;
    log("hearing/voice window " + why + " - starting a new one");
    worker = null; try { w.destroy(); } catch (e) {}
    whisperOk = false; whisperLoading = false; recording = false; playing = false; speaking = false; paused = false;
    refreshTray(); busyChanged();
    setTimeout(() => { makeWorker(); if (listening) setListening(true); }, 1000);
  };
  w.webContents.on("render-process-gone", (e, d) => redo("stopped (" + (d && d.reason) + ")"));
  // (Whisper keeps it busy for a few seconds at a time - only a long freeze counts)
  let hung = false;
  w.on("responsive", () => { hung = false; });
  w.on("unresponsive", () => { hung = true; setTimeout(() => { if (hung && worker === w && !w.isDestroyed()) redo("froze"); }, 25000); });
}
let recMode = "", recTimer = 0;
function recordQuestion(mode) {
  recMode = mode;
  if (worker && worker.webContents) worker.webContents.send("record", { mode, device: cfg.mic });
  // never get stuck "recording" if the worker doesn't answer
  clearTimeout(recTimer);
  recTimer = setTimeout(() => { if (recording) { log("no words back from the hearing window in time"); recording = false; notReallyWoken(); } }, 30000);
}
// keep the microphone open in the worker (while listening for the wake word), or close it
function armMic(on) { if (worker && worker.webContents) worker.webContents.send("record", { mode: on ? "arm" : "disarm", device: cfg.mic }); }
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
    { label: "Read answers aloud", type: "checkbox", checked: !!cfg.voice, click: m => setVoice(m.checked) },
    { label: "Thinking: " + ({ quick: "Quick", balanced: "Balanced", deep: "Deep" })[cfg.thinking], submenu: [["quick", "Quick - fast answers (still very clever)"], ["balanced", "Balanced - thinks a bit more"], ["deep", "Deep - for hard questions (slower)"]].map(([id, label]) => ({ label, type: "radio", checked: cfg.thinking === id, click: () => { cfg = config.save(DIR, Object.assign({}, cfg, { thinking: id })); refreshTray(); configChanged(); } })) },
    ...(timers.length ? [{ label: "Timers and reminders (" + timers.length + ")", submenu: timers.map(t => ({ label: (t.text ? "Remind me to " + t.text : "Timer") + " - at " + new Date(t.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), enabled: false })).concat([{ type: "separator" }, { label: "Cancel them all", click: () => { timers.forEach(t => clearTimeout(t.handle)); timers = []; refreshTray(); } }]) }] : []),
    { label: "Model: " + models.nameOf(cfg.model), submenu: models.MODELS.map(m => ({ label: m.name + "  -  " + m.note, type: "radio", checked: cfg.model === m.id, click: () => setModel(m.id, false) })) },
    { label: "Show the bubble", type: "checkbox", checked: cfg.overlay, click: m => { cfg = config.save(DIR, Object.assign({}, cfg, { overlay: m.checked })); configChanged(); } },
    { label: "New chat (forget this conversation)", click: () => newChat(true) },
    { label: "Put the bubble back in the corner", click: () => { cfg = config.save(DIR, Object.assign({}, cfg, { bubble: null })); if (overlay) overlay.setBounds(overlayBounds()); } },
    { type: "separator" },
    { label: "Show what I can see", enabled: !!cfg.sendScreenshot, click: () => showWhatISee() },
    { label: "Settings…", click: openSettings },
    { label: whisperOk ? "Voice: Whisper (accurate)" : whisperLoading ? "Voice: downloading Whisper…" : speechOk ? "Voice: Windows speech" : "Voice: type only", enabled: false },
    { type: "separator" },
    { label: "Restart Jarvis", click: () => { app.relaunch(); app.exit(0); } },
    { label: "Open the log (if something went wrong)", click: () => { log("log opened"); shell.openPath(LOG); } },
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
const SHOT_PS = path.join(__dirname, "lib", "shot-win.ps1");
let lastShotNote = "";
function shotData(b64) {
  b64 = String(b64 || "").trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length <= 500) return null;
  const data = "data:image/jpeg;base64," + b64;
  return shot.tooBig(data) ? null : data;
}
// The helper stays open (one PowerShell, started once), so each picture takes a moment instead of a whole
// PowerShell start-up every couple of seconds. Each line we send it takes one picture; it answers SHOT:<base64>.
let shotProc = null, shotBuf = "", shotWait = [];
function shotServer() {
  if (shotProc) return shotProc;
  try {
    const p = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SHOT_PS, "-Serve", "-MaxWidth", String(cfg.maxWidth), "-Quality", "70"], { windowsHide: true });
    shotProc = p; shotBuf = "";
    p.stdout.setEncoding("ascii");
    p.stdout.on("data", d => {
      shotBuf += d;
      let i;
      while ((i = shotBuf.indexOf("\n")) >= 0) {
        const line = shotBuf.slice(0, i).trim(); shotBuf = shotBuf.slice(i + 1);
        if (!/^(SHOT|ERR):/.test(line)) continue;      // anything else PowerShell says isn't an answer
        const w = shotWait.shift(); if (w) w(line);
      }
    });
    const gone = () => { if (shotProc === p) shotProc = null; shotWait.splice(0).forEach(w => w("")); };
    p.on("error", gone); p.on("close", gone);
    p.stdin.on("error", () => {});
  } catch (e) { shotProc = null; }
  return shotProc;
}
function stopShotServer() { if (shotProc) { try { shotProc.kill(); } catch (e) {} shotProc = null; } }
function shotViaServer() {
  return new Promise(resolve => {
    const p = shotServer();
    if (!p) return resolve(null);
    let done = false, timer = 0;
    const finish = v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const onLine = line => {
      if (line.startsWith("SHOT:")) finish(shotData(line.slice(5)));
      else { if (line.startsWith("ERR:")) lastShotNote = "win:" + line.slice(4); finish(null); }
    };
    // the first picture also starts PowerShell, so give it a while; if it's stuck, drop it and start fresh next time
    timer = setTimeout(() => { const i = shotWait.indexOf(onLine); if (i >= 0) shotWait.splice(i, 1); if (shotProc === p) stopShotServer(); finish(null); }, 9000);
    shotWait.push(onLine);
    try { p.stdin.write("shot\n"); } catch (e) { finish(null); }
  });
}
// the reliable Windows way (System.Drawing) - what Electron's own capture couldn't manage on some PCs
function shotViaWindows() {
  return new Promise(resolve => {
    try {
      const p = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SHOT_PS, "-MaxWidth", String(cfg.maxWidth), "-Quality", "70"], { windowsHide: true });
      let out = "";
      p.stdout.on("data", d => { out += d; });
      p.on("error", () => resolve(null));
      p.on("close", () => resolve(shotData(out)));
      setTimeout(() => { try { p.kill(); } catch (e) {} resolve(null); }, 6000);
    } catch (e) { resolve(null); }
  });
}
async function grabScreen() {
  if (!cfg.sendScreenshot) { lastShotNote = "off"; return null; }
  if (process.platform === "win32") {
    const d = (await shotViaServer()) || (await shotViaWindows());
    if (d) { lastShotNote = "ok"; return d; }
    if (!/^win:/.test(lastShotNote)) lastShotNote = "win-failed";     // fall through to Electron's capture as a backup
  }
  try {
    // the monitor you're actually looking at (the one your mouse is on)
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
    // capture straight at the small size we want (asking for the full 4K can come back blank on some PCs)
    const want = shot.fitSize(d.size.width, d.size.height, cfg.maxWidth);
    const sources = await withTimeout(desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: want.w, height: want.h } }), 6000, []);
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

// See exactly what it sees: takes a picture now and opens it, so you can check the capture itself works.
async function showWhatISee() {
  const img = cfg.sendScreenshot ? await grabScreen() : null;
  if (!img) {
    showBubble(false);
    toBubble("warn", { text: cfg.sendScreenshot ? "Couldn't capture the screen (" + lastShotNote + ")." : "\"Let it see my screen\" is off in Settings." });
    return;
  }
  const file = path.join(DIR, "what-" + config.wakeWord(cfg).replace(/[^a-z0-9]+/gi, "-") + "-sees.jpg");
  try { fs.writeFileSync(file, Buffer.from(img.slice(img.indexOf(",") + 1), "base64")); await shell.openPath(file); } catch (e) {}
}

/* ---------------------------------------------------------------- can your server look at pictures? */
// Web AI servers from before the 3.14 update quietly drop the screenshot, so the answer comes back as if it's blind
// ("I can't see your screen"). Servers that can look list "see" in GET /. Without it, say so plainly.
let serverSees = null;      // null = not known yet
const OLD_SERVER = "Your Web AI server is an older version that can't look at pictures, so I can't see your screen yet. Update it: unzip the new web-ai-server zip and run setup.cmd, then ask again.";
async function checkServer() {
  if (!cfg.server) { serverSees = null; return null; }
  try {
    const r = await fetchFor(cfg.server + "/", { method: "GET" }, LIMIT.check);
    const j = await r.json();
    serverSees = Array.isArray(j.features) && j.features.includes("see");
    return j;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------- right here, no server */
// Timers, reminders, opening websites and the time are done on your PC - instantly, and they cost nothing.
let timers = [], timerId = 0, lastSpoken = "";
function reply(question, text) {
  showBubble(false);
  toBubble("question", { text: question });
  toBubble("status", { text: "" });
  toBubble("answer", { done: true, text, parts: ai.linkParts(text), copy: false });
  lastSpoken = text;
  if (cfg.voice) { stopVoiceOnly(); say(text); }
  showDot(listening ? "listening" : "off");
}
const niceName = n => commands.SITES[n] ? n.replace(/\b\w/g, c => c.toUpperCase()).replace(/^Youtube$/, "YouTube").replace(/^Github$/, "GitHub").replace(/^Tiktok$/, "TikTok") : n;
function local(question) {
  const c = commands.parse(question);
  if (!c) return false;
  const now = new Date();
  if (c.kind === "timer" || c.kind === "remind") {
    const t = { id: ++timerId, at: Date.now() + c.ms, text: c.kind === "remind" ? commands.you(c.text) : "" };
    t.handle = setTimeout(() => ring(t), c.ms);
    timers.push(t); refreshTray();
    reply(question, t.text ? "Okay, I'll remind you in " + commands.say(c.ms) + " to " + t.text + "." : "Timer set for " + commands.say(c.ms) + ".");
  } else if (c.kind === "cancel") {
    const n = timers.length; timers.forEach(t => clearTimeout(t.handle)); timers = []; refreshTray();
    reply(question, n ? (n === 1 ? "Done - cancelled it." : "Done - cancelled all " + n + ".") : "You don't have any timers or reminders running.");
  } else if (c.kind === "list") {
    reply(question, timers.length ? timers.map(t => (t.text ? "Reminder to " + t.text : "A timer") + ": " + commands.say(t.at - Date.now()) + " left.").join("\n") : "No timers or reminders running.");
  } else if (c.kind === "time") reply(question, "It's " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".");
  else if (c.kind === "date") reply(question, "It's " + now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) + ".");
  else if (c.kind === "open") { shell.openExternal(c.url); reply(question, "Opening " + niceName(c.name) + "."); }
  log("done here, no server: " + c.kind);
  return true;
}
// a timer or reminder is up: a Windows notification, the bubble, and (if the voice is on) it says so
function ring(t) {
  timers = timers.filter(x => x !== t); refreshTray();
  const text = t.text ? "Reminder: " + t.text + "." : "Time's up!";
  try { if (Notification && Notification.isSupported()) new Notification({ title: cfg.name, body: text }).show(); } catch (e) {}
  showBubble(false); toBubble("say", { text: "⏰ " + text, listening: false });
  if (cfg.voice) { stopVoiceOnly(); say(text); }
}

/* ---------------------------------------------------------------- asking the server */
// the conversation so far (memory only), so follow-up questions work; "New chat" or "Jarvis, new chat" forgets it
const memory = ai.createMemory();
function newChat(say) {
  memory.clear();
  toBubble("memory", { count: 0 });
  if (say) { showBubble(false); toBubble("say", { text: "Okay - new conversation.", listening: false }); }
}
const STATUS = { look: "Looking at your screen…", think: "Thinking…", search: "Searching the web…", fetch: "Reading the page…", tool: "Looking that up…" };

async function ask(question) {
  // already answering something? a new question takes over (it used to be quietly ignored)
  if (asking) { stopTalking(); for (let i = 0; i < 30 && asking; i++) await new Promise(r => setTimeout(r, 100)); if (asking) return; }
  // "switch to Opus", "use the smartest model"... - change the model instead of asking
  const pick = models.parseSwitch(question);
  if (pick !== null) { setModel(pick, true); return; }
  if (wake.isReset(question)) { newChat(true); return; }      // "new chat", "forget that"
  if (local(question)) return;                                // timers, reminders, "open YouTube", the time - done right here
  if (!cfg.server) { showBubble(true); toBubble("answer", { done: true, text: "Open Settings and paste your Web AI server address first." }); openSettings(); return; }
  asking = true;
  const ctl = askCtl = new AbortController();
  stopVoiceOnly();          // a new question cuts off an answer still being read out
  showBubble(false);
  showDot("busy");
  toBubble("question", { text: question, followUp: memory.size() > 0 });
  toBubble("answer", { text: "", thinking: true });
  busyChanged();
  let answer = "", spokenTo = 0, failed = false, timedOut = false, quietTimer = 0;
  const started = Date.now();
  // while it thinks: how long it's been, a word if it's a long one, and a stop if no answer has started in 2 minutes
  let status = "";
  const showStatus = t => { status = t; toBubble("status", { text: t }); };
  const clock = setInterval(() => {
    if (answer) return;
    const s = Math.round((Date.now() - started) / 1000);
    if (Date.now() - started > LIMIT.think) { timedOut = true; log("no answer started within " + LIMIT.think / 1000 + "s"); ctl.abort(); return; }
    if (s >= 25) toBubble("status", { text: "Still thinking (" + s + "s) - a tricky one. Stop cancels it." });
    else if (s >= 4 && status) toBubble("status", { text: status + " " + s + "s" });
  }, 1000);
  // no word from the server for a long while (it sends a "still working" line every ten seconds): give up, and say so
  const stillThere = () => { clearTimeout(quietTimer); quietTimer = setTimeout(() => { timedOut = true; log("no reply from the server for " + LIMIT.quiet / 1000 + "s"); ctl.abort(); }, LIMIT.quiet); };
  try {
    // use the freshest watched frame if we have one (instant); otherwise grab one right now
    // (and, until we know the server can look at pictures, ask it - at the same time, so it costs no extra wait)
    if (cfg.sendScreenshot) showStatus(STATUS.look);
    const sees = cfg.sendScreenshot && serverSees !== true ? checkServer() : null;
    let image = (cfg.watch && lastFrame && Date.now() - lastFrameAt < 4000) ? lastFrame : await withTimeout(grabScreen(), LIMIT.shot, null);
    if (cfg.sendScreenshot && !image) toBubble("warn", { text: "Couldn't capture the screen (" + lastShotNote + ") — answering from your words. Tray icon → \"Show what I can see\" to check." });
    if (image && sees) { await withTimeout(sees, LIMIT.check, null); if (serverSees === false) toBubble("warn", { text: OLD_SERVER }); }
    if (ctl.signal.aborted) throw new Error("stopped");
    showStatus(STATUS.think);
    // "explain what I copied": only then is the clipboard read (and sent along with this question)
    let clip = "";
    if (commands.wantsClipboard(question)) { try { clip = clipboard.readText(); } catch (e) {} if (!clip.trim()) toBubble("warn", { text: "Your clipboard has no text in it - copy something first." }); }
    const body = ai.buildBody({ question, cfg, imageDataUrl: image, now: new Date(), history: memory.list(), clipboard: clip });
    let res;
    try { res = await fetchFor(cfg.server + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, LIMIT.connect, ctl.signal); }
    catch (e) { if (!ctl.signal.aborted) timedOut = true; throw e; }
    if (!res.ok || !res.body) {
      let msg = "The server didn't answer (" + res.status + ").";
      try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) {}
      log("server said " + res.status + (msg ? ": " + msg.slice(0, 120) : ""));
      failed = true; toBubble("answer", { done: true, text: msg });
      return;
    }
    stillThere();
    const reader = ai.streamReader(), dec = new TextDecoder();
    const r = res.body.getReader();
    for (;;) {
      const { value, done } = await r.read();
      if (done) break;
      stillThere();
      for (const part of reader.push(dec.decode(value, { stream: true }))) {
        if (part.error) { failed = true; stopVoiceOnly(); toBubble("answer", { done: true, text: part.error }); return; }
        if (part.status) showStatus(STATUS[part.status] || STATUS.tool);
        if (part.text) {
          answer += part.text; toBubble("answer", { text: ai.cleanForShow(answer) });
          // read the first sentence out as soon as it's written (the rest follows when the answer's done)
          if (cfg.voice && !spokenTo) { const cut = ai.speakCut(answer); if (cut > 0) { spokenTo = cut; say(ai.cleanForSpeech(answer.slice(0, cut))); } }
        }
        if (part.end) toBubble("left", { left: part.left, unlimited: part.unlimited, model: models.short(part.model) });
        // you picked a model, but the server answered with its own: your code can't pick (only the unlimited one can)
        if (part.end && cfg.model && !part.chose) toBubble("warn", { text: "The server answered with its own model, not " + models.nameOf(cfg.model) + ". Only your unlimited code can pick (Settings → Your code), and the server needs its latest update." });
        if (part.end && part.stop === "refusal") { failed = true; stopVoiceOnly(); toBubble("answer", { done: true, text: "Sorry, I can't help with that one." }); return; }
      }
    }
    reader.end().forEach(p => { if (p.text) answer += p.text; });
    const shown = ai.cleanForShow(answer) || "(no answer)";
    toBubble("answer", { done: true, text: shown, parts: ai.linkParts(shown), copy: !!answer });     // links become buttons to click
    lastSpoken = ai.cleanForSpeech(answer);
    if (cfg.voice && answer && !ctl.signal.aborted) say(ai.cleanForSpeech(answer.slice(spokenTo)));
  } catch (e) {
    if (timedOut) {
      failed = !answer; stopVoiceOnly();
      log("gave up waiting after " + Math.round((Date.now() - started) / 1000) + "s");
      const faster = cfg.thinking !== "quick" ? "set Thinking to Quick (tray → Thinking)" : "say \"use Sonnet\" for a faster model";
      toBubble("answer", { done: true, text: (answer ? ai.cleanForShow(answer) + " …\n\n" : "") + "That took too long, so I stopped waiting. Ask again - it usually works the second time. For quicker answers, " + faster + ".", copy: !!answer });
    }
    else if (ctl.signal.aborted) toBubble("answer", { done: true, text: answer ? ai.cleanForShow(answer) + " …" : "Stopped.", copy: !!answer });
    else { failed = true; stopVoiceOnly(); log("couldn't reach the server: " + (e && e.message || e)); toBubble("answer", { done: true, text: "Couldn't reach your Web AI server. Check your internet, and the address in Settings." }); }
  } finally {
    clearTimeout(quietTimer); clearInterval(clock);
    asking = false;
    if (askCtl === ctl) askCtl = null;
    // remember it for follow-ups (a stopped answer too - "go on" then works)
    if (!failed && answer) { memory.add(question, ai.cleanForShow(answer)); toBubble("memory", { count: memory.size() }); }
    toBubble("status", { text: "" });
    showDot(listening ? "listening" : "off");
    busyChanged();
  }
}

/* ---------------------------------------------------------------- stopping him */
// The bubble's Stop button (or the hotkey, or "Jarvis, stop"): stop reading aloud mid-sentence, and stop an answer
// that's still coming in (what's already shown stays, so you can read it).
let askCtl = null, speakCtl = null, speaking = false, playing = false, hushed = false, paused = false;
const isTalking = () => asking || speaking || playing;
function busyChanged() { toBubble("busy", { on: isTalking() }); }
function stopVoiceOnly() {
  voiceGen++; pieces = 0;
  if (speakCtl) { try { speakCtl.abort(); } catch (e) {} speakCtl = null; }
  speaking = false; playing = false; paused = false;
  if (worker && worker.webContents) worker.webContents.send("stop-audio");
  busyChanged();
}
function stopTalking() {
  if (askCtl) { try { askCtl.abort(); } catch (e) {} }
  stopVoiceOnly();
}
// which model answers (Settings, the tray's Model menu, or "Jarvis, switch to Opus")
function setModel(id, sayIt) {
  cfg = config.save(DIR, Object.assign({}, cfg, { model: id }));
  refreshTray(); configChanged();
  if (sayIt) {
    const text = id ? "Okay, I'll use " + models.nameOf(id) + " from now on." : "Okay, back to your server's choice of model.";
    showBubble(false); toBubble("say", { text, listening: false });
    if (cfg.voice) { stopVoiceOnly(); say(text); }
  }
}
// voice on/off (the bubble's speaker button, the tray, or Settings). Off = it just writes the answer for you to read.
function setVoice(on) {
  cfg = config.save(DIR, Object.assign({}, cfg, { voice: !!on }));
  if (!cfg.voice) stopVoiceOnly();
  refreshTray(); configChanged();
  toBubble("voice", {});
}
// the Settings window (if open) shows changes made elsewhere - the tray, the bubble, by voice - so its Save can't undo them
function configChanged() { if (settingsWin && !settingsWin.isDestroyed()) { try { settingsWin.webContents.send("config", cfg); } catch (e) {} } }

/* ---------------------------------------------------------------- the voice (Adam, through /speak) */
// Pieces are fetched in order and handed to the worker, which plays them one after another. Stop (or a new
// question) bumps voiceGen, so anything still on its way is dropped.
let voiceGen = 0, voiceChain = Promise.resolve(), pieces = 0;
function say(text) {
  if (!text || !cfg.voice || !cfg.server || !worker || !worker.webContents) return;
  const gen = voiceGen;
  for (const piece of ai.speechPieces(text)) {
    pieces++; speaking = true;
    voiceChain = voiceChain.then(async () => {
      if (gen !== voiceGen) return;
      const ctl = speakCtl = new AbortController();
      try {
        const res = await fetchFor(cfg.server + "/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device: cfg.device, code: cfg.code || undefined, text: piece }) }, LIMIT.speak, ctl.signal);
        if (!res.ok) { log("voice: server said " + res.status); return; }
        const buf = Buffer.from(await res.arrayBuffer());
        if (gen !== voiceGen || !cfg.voice) return;      // stopped (or voice turned off) while it was on its way
        playing = true;
        worker.webContents.send("play", buf);
      } catch (e) {}
      finally {
        if (speakCtl === ctl) speakCtl = null;
        if (gen === voiceGen) { pieces = Math.max(0, pieces - 1); speaking = pieces > 0; busyChanged(); }
      }
    });
  }
  busyChanged();
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
  const msg = Object.assign({ kind: kind, name: cfg.name, voice: cfg.voice }, data);
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
  if (before.maxWidth !== cfg.maxWidth || !cfg.sendScreenshot) stopShotServer();
  if (before.server !== cfg.server) { serverSees = null; checkServer(); }
  startWatch();
  refreshTray();
  if (tray) tray.setToolTip(cfg.name + " - your screen assistant");
  if (before.hearing !== cfg.hearing && worker && worker.webContents) {
    // load the other Whisper; until it's ready, Windows' own recognition stands in
    whisperOk = false; whisperLoading = true;
    worker.webContents.send("record", { mode: "model", hearing: cfg.hearing });
    if (listening) setListening(true);
  } else if (before.mic !== cfg.mic && listening && whisperOk) armMic(true);
  if (before.wakeEnabled !== cfg.wakeEnabled) setListening(cfg.wakeEnabled);
  else if ((before.wakeSensitivity !== cfg.wakeSensitivity || before.name !== cfg.name) && listening) setListening(true);
  return cfg;
});
ipcMain.handle("test-server", async () => {
  if (!cfg.server) return { ok: false, message: "No server address yet." };
  const j = await checkServer();
  if (!j) return { ok: false, message: "Couldn't reach that address." };
  return { ok: !!j.ok, ready: !!j.ready, name: j.name || "Web AI", voice: (j.features || []).includes("voice"), sees: serverSees === true, message: j.missing || "" };
});
// the worker (Whisper) reports in
ipcMain.on("whisper-loading", () => { whisperLoading = true; refreshTray(); });
ipcMain.on("whisper-ready", () => {
  whisperOk = true; whisperLoading = false; refreshTray();
  if (listening) setListening(true);      // switch the wake listener over to the accurate mode
});
ipcMain.on("whisper-fail", (e, m) => { log("Whisper couldn't load: " + String(m || "").slice(0, 200)); whisperOk = false; whisperLoading = false; refreshTray(); });
ipcMain.on("log", (e, m) => log(String(m || "").slice(0, 300)));
ipcMain.on("transcript", (e, t) => { recording = false; gotQuestion(String(t || ""), recMode); });
ipcMain.on("rec-state", (e, s) => {
  // (after the wake word nothing shows until Whisper has confirmed it was the name - see notReallyWoken)
  if (s === "thinking") { showDot("busy"); if (!asking && recMode !== "wake") toBubble("say", { text: "…", listening: false }); }
  else if (s === "listening") { showDot("busy"); }
});
ipcMain.on("ask-text", (e, q) => { if (q && String(q).trim()) ask(String(q).trim()); });
ipcMain.on("open-external", (e, u) => { if (/^https?:\/\//.test(u)) shell.openExternal(u); });
ipcMain.on("hide-bubble", () => { if (overlay) overlay.hide(); });
ipcMain.on("start-voice", () => startVoiceAsk());
ipcMain.on("stop-talking", () => stopTalking());
ipcMain.on("new-chat", () => newChat(false));
ipcMain.on("read-again", () => { if (lastSpoken) { stopVoiceOnly(); say(lastSpoken); } });
ipcMain.on("copy-text", (e, t) => { try { clipboard.writeText(String(t || "").slice(0, 20000)); } catch (x) {} });
ipcMain.on("toggle-voice", () => setVoice(!cfg.voice));
ipcMain.on("audio-state", (e, on) => { playing = !!on; busyChanged(); });

/* ---------------------------------------------------------------- hotkey & autostart */
function applyHotkey() {
  try { globalShortcut.unregisterAll(); } catch (e) {}
  if (cfg.hotkey) { try { if (!globalShortcut.register(cfg.hotkey, () => startVoiceAsk())) log("hotkey " + cfg.hotkey + " is taken by another app"); } catch (e) {} }
  // the typing hotkey: the bubble with its box ready to type in
  if (cfg.typeHotkey && cfg.typeHotkey !== cfg.hotkey) { try { if (!globalShortcut.register(cfg.typeHotkey, () => showBubble(true))) log("typing hotkey " + cfg.typeHotkey + " is taken by another app"); } catch (e) {} }
}
function applyAutostart() {
  try {
    const opts = { openAtLogin: !!cfg.autostart, args: ["--hidden"] };
    // run from this folder (npm start, or "Start Jarvis.vbs") rather than installed: Windows must start Electron *with
    // this folder*, or it would open an empty Electron instead of Jarvis
    if (process.defaultApp) { opts.path = process.execPath; opts.args = [path.resolve(__dirname), "--hidden"]; }
    app.setLoginItemSettings(opts);
  } catch (e) {}
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
    checkServer();
    if (cfg.wakeEnabled && speechOk) setTimeout(() => setListening(true), 1500);
    if (!cfg.server) setTimeout(openSettings, 800);
  });
  app.on("window-all-closed", () => { /* a tray app keeps running */ });
  app.on("will-quit", () => {
    try { globalShortcut.unregisterAll(); } catch (e) {}
    clearInterval(watchTimer);
    stopShotServer();
    if (listenProc) try { listenProc.kill(); } catch (e) {}
    if (onceProc) try { onceProc.kill(); } catch (e) {}
    if (indicator) try { indicator.destroy(); } catch (e) {}
  });
}

// for test/test-app.js: drive the real app logic with a pretend Electron, server and clock limits
if (process.env.JARVIS_TEST) module.exports = { LIMIT, ask, gotQuestion, state: () => ({ asking, speaking, playing, recording, timers: timers.length }) };
