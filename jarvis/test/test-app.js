// Jarvis for Webs - the app itself (main.js) with a pretend Electron and a pretend server: does it ever get stuck?
// node test/test-app.js
"use strict";
const Module = require("module"), fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) pass++; else { fail++; console.log("  FAIL:", w); } };

// ---- a pretend Electron: windows record what they're sent, nothing is shown
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-app-"));
fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ server: "https://web-ai.example", sendScreenshot: false, voice: false, wakeEnabled: false, watch: false }));
const sent = [];
class Win {
  constructor() { this.webContents = { send: (ch, m) => sent.push([ch, m]), isLoading: () => false, once() {}, on() {} }; }
  loadFile() {} on() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setIgnoreMouseEvents() {} setBounds() {}
  showInactive() {} show() {} focus() {} hide() {} isDestroyed() { return false; } destroy() {}
}
const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, id: 1 };
const electron = {
  app: { getPath: () => dir, requestSingleInstanceLock: () => true, on() {}, whenReady: () => new Promise(() => {}), setLoginItemSettings() {}, relaunch() {}, exit() {}, quit() {} },
  BrowserWindow: Win, Tray: class { setToolTip() {} setContextMenu() {} on() {} }, Menu: { buildFromTemplate: t => t },
  globalShortcut: { register: () => true, unregisterAll() {} }, ipcMain: { on() {}, handle() {} },
  desktopCapturer: { getSources: async () => [] }, screen: { getPrimaryDisplay: () => display, getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => display },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) }, shell: { openPath() {}, openExternal() {} }, clipboard: { writeText() {} }
};
const load = Module._load;
Module._load = function (req) { return req === "electron" ? electron : load.apply(this, arguments); };
process.env.JARVIS_TEST = "1";
const app = require("../main.js");
app.LIMIT.connect = 300; app.LIMIT.quiet = 300;       // shrink the waits so the test is quick

// ---- a pretend server
const enc = new TextEncoder();
let server = null;     // (url, init) -> { lines:[[delayMs, obj], ...], hang:bool } | "never"
global.fetch = (url, init) => new Promise((resolve, reject) => {
  const sig = init && init.signal, plan = server(url, init);
  let ctl = null;
  const abort = () => { const e = new Error("aborted"); e.name = "AbortError"; reject(e); try { ctl && ctl.error(e); } catch (x) {} };
  if (sig) { if (sig.aborted) return abort(); sig.addEventListener("abort", abort); }
  if (plan === "never") return;                                          // no reply at all
  const body = new ReadableStream({ start(c) {
    ctl = c;
    let t = 0;
    for (const [ms, o] of plan.lines) { t += ms; setTimeout(() => { try { c.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch (e) {} }, t); }
    if (!plan.hang) setTimeout(() => { try { c.close(); } catch (e) {} }, t + 5);
  } });
  resolve(new Response(body, { status: 200 }));
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const lastAnswer = () => { const a = sent.filter(s => s[0] === "bubble" && s[1].kind === "answer" && s[1].done).pop(); return a ? a[1].text : ""; };

(async () => {
  // 1) the server never answers: it gives up and says so (it used to wait forever)
  server = () => "never";
  await app.ask("what is this");
  ok(/took too long/.test(lastAnswer()) && !app.state().asking, "no reply at all: gives up, says so, and is ready again (" + lastAnswer() + ")");

  // 2) the answer starts, then the connection goes quiet: keeps what came, gives up, ready again
  server = () => ({ lines: [[20, { d: "Hello there." }]], hang: true });
  await app.ask("hello");
  ok(/^Hello there\. …[\s\S]*took too long/.test(lastAnswer()) && !app.state().asking, "an answer that stalls halfway: keeps the part that came, then gives up");

  // 3) a slow answer that keeps sending "still working" lines is NOT given up on
  server = () => ({ lines: [[100, { k: 1 }], [100, { k: 1 }], [100, { k: 1 }], [100, { k: 1 }], [100, { k: 1 }], [50, { d: "Worth the wait." }], [10, { end: 1, stop: "end_turn", left: 5 }]] });
  await app.ask("think hard");
  ok(lastAnswer() === "Worth the wait.", "a long think with 'still working' lines finishes normally (" + lastAnswer() + ")");

  // 4) a new question while one is stuck takes over (it used to be quietly ignored)
  server = (u, init) => /stuck/.test(init.body) ? "never" : { lines: [[10, { d: "Second answer." }], [5, { end: 1, stop: "end_turn" }]] };
  const first = app.ask("this one gets stuck");
  await wait(50);
  await app.ask("a new question");
  await first;
  ok(lastAnswer() === "Second answer." && !app.state().asking, "a new question takes over from one that's stuck");
  // same, but spoken: "Jarvis, <a new question>" while it's answering
  const third = app.ask("this one gets stuck too");
  await wait(50);
  app.gotQuestion("Jarvis, what time is it?", "wake");
  await wait(150); await third;
  ok(lastAnswer() === "Second answer." && !app.state().asking, "a spoken new question takes over too");

  // 5) and a normal question afterwards just works
  server = () => ({ lines: [[10, { d: "All good." }], [5, { end: 1, stop: "end_turn" }]] });
  await app.ask("are you ok");
  ok(lastAnswer() === "All good." && !app.state().asking, "afterwards, questions work as normal");

  const log = fs.readFileSync(path.join(dir, "jarvis.log"), "utf8");
  ok(/gave up waiting/.test(log) && !/what is this|hello/.test(log), "problems go in the log (without your questions in it)");
  console.log("jarvis app:", pass, "passed,", fail, "failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("crashed:", e); process.exit(1); });
