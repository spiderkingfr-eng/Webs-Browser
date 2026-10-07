/* Jarvis for Webs - settings, kept in one small JSON file in the app's own data folder.
   Everything here stays on this PC. load(dir) reads config.json (filling in anything missing with the defaults),
   save(dir, cfg) writes it. The device id is made once, so the Web AI server can count this PC's questions. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const DEFAULTS = {
  name: "Jarvis",            // what you call it (also the wake word)
  wakeEnabled: true,          // listen for the wake word all the time (needs the speech model; see README)
  callYou: "",                // what it calls you (sir, boss, your name) - optional
  style: "calm",              // calm | short | friendly | detailed
  server: "",                 // your Web AI server address, e.g. https://web-ai.you.workers.dev
  code: "",                   // your Web AI code (optional, for a higher daily limit)
  device: "",                 // made once, below
  hotkey: "Alt+Shift+J",      // push to talk / ask, from anywhere
  voice: true,                // read answers aloud (Adam, through your server's /speak)
  overlay: true,              // show the little bubble (turn off for games with strict anti-cheat)
  sendScreenshot: true,       // send a screenshot with your question so it can see what you're doing
  watch: true,                // keep an eye on the screen locally (every watchSecs), so the newest view is ready at once
  watchSecs: 2,               // how often it looks (kept on this PC; only the latest is sent, and only when you ask)
  mic: "",                    // which microphone (its id; empty = the default)
  autostart: false,           // start with Windows
  maxWidth: 1280              // the screenshot is shrunk to at most this wide before it's sent
};

const STYLES = ["calm", "short", "friendly", "detailed"];

function file(dir) { return path.join(dir, "config.json"); }

function clean(cfg) {
  const c = Object.assign({}, DEFAULTS, cfg && typeof cfg === "object" ? cfg : {});
  c.name = String(c.name || "Jarvis").trim().slice(0, 30) || "Jarvis";
  c.callYou = String(c.callYou || "").trim().slice(0, 30);
  c.style = STYLES.includes(c.style) ? c.style : "calm";
  c.server = String(c.server || "").trim().replace(/\/+$/, "");
  c.code = String(c.code || "").trim().slice(0, 200);
  c.hotkey = String(c.hotkey || "").trim().slice(0, 40) || DEFAULTS.hotkey;
  c.mic = String(c.mic || "").slice(0, 200);
  c.maxWidth = Math.max(640, Math.min(2560, +c.maxWidth || DEFAULTS.maxWidth));
  c.watchSecs = Math.max(1, Math.min(10, +c.watchSecs || DEFAULTS.watchSecs));
  ["wakeEnabled", "voice", "overlay", "sendScreenshot", "watch", "autostart"].forEach(k => { c[k] = !!c[k]; });
  if (!/^dev-[0-9a-f]{16}$/.test(c.device || "")) c.device = "dev-" + crypto.randomBytes(8).toString("hex");
  return c;
}

function load(dir) {
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(file(dir), "utf8")); } catch (e) { raw = null; }
  const c = clean(raw);
  if (!raw || raw.device !== c.device) { try { fs.mkdirSync(dir, { recursive: true }); save(dir, c); } catch (e) {} }   // keep the new device id
  return c;
}

function save(dir, cfg) {
  const c = clean(cfg);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(dir), JSON.stringify(c, null, 2));
  return c;
}

// the wake word the speech model listens for (the name, lowercased; "hey <name>" also works, handled in wake.js)
const wakeWord = cfg => String((cfg && cfg.name) || "Jarvis").toLowerCase().trim();

module.exports = { DEFAULTS, STYLES, load, save, clean, wakeWord, file };
