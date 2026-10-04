/* Webs Browser - the games pages' part of "live" (js/live.js), on iPhone and Windows: the weekly
   leaderboard (with a nickname people choose), the community goal's progress, and the daily word
   the owner picked (games.html asks Live.wordToday() before choosing its own). */
(function () {
"use strict";
if (!window.Live) return;
const toast = m => {
  let t = document.getElementById("lvToast");
  if (!t) { t = document.createElement("div"); t.id = "lvToast"; t.style.cssText = "position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:12px;font-size:14px;max-width:calc(100% - 32px);transition:opacity .3s"; document.body.appendChild(t); }
  t.textContent = typeof m === "string" ? m : ""; t.style.opacity = "1"; clearTimeout(t.tm); t.tm = setTimeout(() => { t.style.opacity = "0"; }, 2600);
};
Live.init({ platform:window.chrome && window.chrome.webview ? "windows" : "iphone", noPing:true, toast });
const box = document.createElement("section"); box.id = "lvGames"; box.className = "lvg";
const main = document.querySelector("main") || document.body;
main.appendChild(box);
const paint = () => Live.gamesPanel(box);
paint(); Live.on(paint);
Live.refresh(true);
const st = document.createElement("style");
st.textContent = ".lvg{display:grid;gap:10px;max-width:640px;margin:18px auto 30px;padding:0 12px}";
document.head.appendChild(st);
})();
