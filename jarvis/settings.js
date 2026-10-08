/* Jarvis for Webs - the settings window's behaviour: fill the form from the saved settings, list the microphones,
   test the server, and save. Everything goes through the preload bridge (window.jarvis). */
"use strict";
(function () {
const $ = id => document.getElementById(id);
const FIELDS = ["name", "callYou", "style", "server", "code", "hotkey", "mic", "hearing", "model", "wakeSensitivity"];
const CHECKS = ["wakeEnabled", "voice", "sendScreenshot", "webSearch", "watch", "overlay", "autostart"];
let cfg = {};
// only what you change here is saved - so a change made meanwhile from the tray, the bubble or by voice isn't undone
const touched = new Set();
FIELDS.concat(CHECKS).forEach(k => { const el = $(k); if (el) ["input", "change"].forEach(ev => el.addEventListener(ev, () => touched.add(k))); });
function show(c, all) {
  FIELDS.forEach(k => { if ($(k) && k !== "mic" && (all || !touched.has(k))) $(k).value = c[k] == null ? "" : c[k]; });
  CHECKS.forEach(k => { if ($(k) && (all || !touched.has(k))) $(k).checked = !!c[k]; });
}
window.jarvis.onConfig(c => { cfg = c; show(c, false); });     // changed elsewhere while this window is open

async function fillMics(selected) {
  try {
    // asking once makes the device labels available
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); } catch (e) {}
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
    const sel = $("mic");
    sel.textContent = "";
    [{ deviceId: "", label: "Default microphone" }].concat(devs).forEach(d => { const o = document.createElement("option"); o.value = d.deviceId; o.textContent = d.label || "Microphone"; sel.appendChild(o); });
    sel.value = selected || "";
  } catch (e) {}
}

async function load() {
  cfg = await window.jarvis.getConfig();
  show(cfg, true);
  await fillMics(cfg.mic);
}

async function save() {
  const next = {};
  FIELDS.forEach(k => { if ($(k) && touched.has(k)) next[k] = $(k).value; });
  CHECKS.forEach(k => { if ($(k) && touched.has(k)) next[k] = $(k).checked; });
  cfg = await window.jarvis.saveConfig(next);
  touched.clear();
  show(cfg, true);
  $("saved").textContent = "Saved ✓";
  setTimeout(() => { $("saved").textContent = ""; }, 2000);
}

$("save").onclick = save;
$("test").onclick = async () => {
  const out = $("testOut"); out.className = "testout"; out.textContent = "Checking…";
  await window.jarvis.saveConfig({ server: $("server").value, code: $("code").value });
  const r = await window.jarvis.testServer();
  if (r.ok) { out.className = "testout ok"; out.textContent = (r.name || "Web AI") + " is reachable" + (r.ready ? "" : " (but " + (r.message || "not fully set up") + ")") + (r.voice ? " · voice ready" : " · no voice key yet") + (r.sees ? " · can see your screen" : " · ⚠ too old to see your screen - update it with setup.cmd from the new web-ai-server zip"); }
  else { out.className = "testout bad"; out.textContent = r.message || "Couldn't reach it."; }
};
$("speechNote").textContent = "";

load();
})();
