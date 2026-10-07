/* Jarvis for Webs - the settings window's behaviour: fill the form from the saved settings, list the microphones,
   test the server, and save. Everything goes through the preload bridge (window.jarvis). */
"use strict";
(function () {
const $ = id => document.getElementById(id);
const FIELDS = ["name", "callYou", "style", "server", "code", "hotkey", "mic"];
const CHECKS = ["wakeEnabled", "voice", "sendScreenshot", "overlay", "autostart"];
let cfg = {};

async function fillMics(selected) {
  try {
    // asking once makes the device labels available
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); } catch (e) {}
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
    const sel = $("mic");
    sel.innerHTML = '<option value="">Default microphone</option>' + devs.map(d => '<option value="' + d.deviceId + '">' + (d.label || "Microphone") + "</option>").join("");
    sel.value = selected || "";
  } catch (e) {}
}

async function load() {
  cfg = await window.jarvis.getConfig();
  FIELDS.forEach(k => { if ($(k) && k !== "mic") $(k).value = cfg[k] == null ? "" : cfg[k]; });
  CHECKS.forEach(k => { if ($(k)) $(k).checked = !!cfg[k]; });
  await fillMics(cfg.mic);
}

async function save() {
  const next = {};
  FIELDS.forEach(k => { if ($(k)) next[k] = $(k).value; });
  CHECKS.forEach(k => { if ($(k)) next[k] = $(k).checked; });
  cfg = await window.jarvis.saveConfig(next);
  FIELDS.forEach(k => { if ($(k) && k !== "mic") $(k).value = cfg[k] == null ? "" : cfg[k]; });
  $("saved").textContent = "Saved ✓";
  setTimeout(() => { $("saved").textContent = ""; }, 2000);
}

$("save").onclick = save;
$("test").onclick = async () => {
  const out = $("testOut"); out.className = "testout"; out.textContent = "Checking…";
  await window.jarvis.saveConfig({ server: $("server").value, code: $("code").value });
  const r = await window.jarvis.testServer();
  if (r.ok) { out.className = "testout ok"; out.textContent = (r.name || "Web AI") + " is reachable" + (r.ready ? "" : " (but " + (r.message || "not fully set up") + ")") + (r.voice ? " · voice ready" : " · no voice key yet"); }
  else { out.className = "testout bad"; out.textContent = r.message || "Couldn't reach it."; }
};
$("speechNote").textContent = "";

load();
})();
