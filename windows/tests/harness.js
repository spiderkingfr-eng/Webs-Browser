// Shared test setup: serves out/ (falling back to orig/) at https://browser.example/.
// Run from windows/ after `python3 build.py`, e.g. `node tests/t_chrome.js`; screenshots go to out/shots/.
// and fakes the Windows host's chrome.webview bridge.
const fs = require("fs"), path = require("path");
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const ROOT = path.join(__dirname, "..");
const SHOTS = path.join(ROOT, "out", "shots") + path.sep;
fs.mkdirSync(SHOTS, { recursive:true });
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript; charset=utf-8", css:"text/css", txt:"text/plain", json:"application/json" };
function file(name) {
  for (const d of ["out", "orig"]) { const p = path.join(ROOT, d, name); if (fs.existsSync(p)) return fs.readFileSync(p); }
  return null;
}
async function setup(ctx) {
  await ctx.route("https://browser.example/**", r => {
    const u = new URL(r.request().url()), name = u.pathname.slice(1) || "newtab.html", b = file(name);
    if (!b) return r.fulfill({ status:404, body:"missing " + name });
    r.fulfill({ status:200, body:b, contentType:TYPES[name.split(".").pop()] || "application/octet-stream" });
  });
  await ctx.route(/^https:\/\/(api\.wsb|api\.datamuse\.com|api\.dictionaryapi\.dev|open\.er-api\.com|geocoding-api|api\.open-meteo)/, r => {
    const u = r.request().url();
    if (/datamuse/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(/rel_rhy/.test(u) ? [{ word:"cat" }, { word:"hat" }] : [{ word:"glad" }, { word:"cheerful" }]) });
    r.fulfill({ status:200, contentType:"application/json", body:"[]" });
  });
  await ctx.addInitScript(() => {
    window.__sent = [];
    const L = [];
    window.chrome = window.chrome || {};
    window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener(t, f) { if (t === "message") L.push(f); }, removeEventListener() {} };
    window.__host = (...a) => L.forEach(f => f({ data:a.join("\u0001") }));
  });
}
function watch(p, errors, tag) {
  p.on("pageerror", e => errors.push(tag + ": " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|404|unknown error occurred when fetching the script/.test(m.text())) errors.push(tag + " console: " + m.text()); });
}
module.exports = { chromium, setup, watch, SHOTS, ROOT };
