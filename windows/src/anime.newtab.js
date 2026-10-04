/* Webs 3.8: anime themes on the new tab page (../../js/anime.js, shared with the iPhone app).
   Background → Anime themes picks one: it colors the whole browser (the "custom" color theme every
   page reads), sets the accent, and puts its live wallpaper behind this page and its card on it
   (Customize → Show on this page → Anime theme card). "No anime theme" brings back the look from
   before. Its ambient sound only plays with "Play its sound" on. */
(function () {
"use strict";
if (!window.Anime) return;
SHOW.push(["anime", "Anime theme card"]);
const on = () => !PRIVATE && Anime.has(cfg.anime);

// the picker, at the top of the Background panel
const box = document.createElement("div");
box.className = "anbox";
box.innerHTML = '<div class="k" style="margin-top:0">Anime themes <span class="vnote">colors for the whole browser, a live wallpaper and a card</span></div><div id="anPick"></div>' +
  '<label class="chk ansnd"><input type="checkbox" id="anSnd"> Play its sound (rain, wind, waves…)</label>';
const bgbox = $("bgbox");
bgbox.insertBefore(box, bgbox.firstChild);
let pick = null;
function paintPick() {
  if (pick) pick.stop();
  pick = Anime.picker($("anPick"), { current:cfg.anime || "", onPick:choose });
  $("anSnd").checked = !!(cfg.anime && cfg.ambient && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb);
}
function choose(id) {
  const s = Anime.apply(get("settings", {}), id, { pc:true, sound:id ? $("anSnd").checked : null });
  put("settings", s); readCfg(); applyCustom(); paintBgBox(); if (typeof music === "function") music();
  document.dispatchEvent(new Event("wsb-pack"));
  send("settings-changed");
  if (typeof muSend === "function") muSend("ambient", s.ambient || "");
  if (id) { const r = document.documentElement; r.classList.remove("vibing"); void r.offsetWidth; r.classList.add("vibing"); setTimeout(() => r.classList.remove("vibing"), 900); }
}
$("anSnd").onchange = () => { if (cfg.anime) choose(cfg.anime); };
const paintBgBox0 = paintBgBox;
paintBgBox = function () {
  paintBgBox0();
  const cur = $("anPick").querySelector(".an-tile.on");
  if (!$("bgbox").classList.contains("hide") && (!pick || !cur || cur.dataset.id !== (cfg.anime || ""))) paintPick();
};

// the live wallpaper (whatever moving background was on steps aside)
let wall = null, wallId = "";
function wallStop() { if (wall) wall.stop(); wall = null; wallId = ""; const c = $("anlive"); if (c) c.remove(); }
const liveBg0 = liveBg;
liveBg = function () {
  if (!(on() && cfg.liveBg === "anime")) { wallStop(); return liveBg0(); }
  const keep = cfg.liveBg; cfg.liveBg = ""; liveBg0(); cfg.liveBg = keep;
  document.body.classList.add("pic");
  // (started again when the theme or the Animations setting changes)
  const key = cfg.anime + ":" + Anime.motion();
  if (wall && wallId === key && $("anlive")) return;
  wallStop();
  const cv = Object.assign(document.createElement("canvas"), { id:"anlive" });
  cv.setAttribute("aria-hidden", "true");
  const bgl = $("bgl"); if (bgl) bgl.after(cv); else document.body.prepend(cv);
  wall = Anime.run(cv, cfg.anime); wallId = key;
};

// the card, near the top of the page
const sec = document.createElement("section"); sec.id = "anSec"; sec.className = "hide"; sec.innerHTML = '<div id="anBox"></div>';
$("f").after(sec);
let seen = false;
function card() {
  const show = on() && !hidden("anime");
  sec.classList.toggle("hide", !show);
  if (!show) { seen = false; return; }
  Anime.card($("anBox"), cfg.anime, { h24:!!cfg.clock24, animate:!seen });
  seen = true;
}
setInterval(() => { if (!document.hidden && on()) card(); }, 20000);

const applyCustom0 = applyCustom;
applyCustom = function () { applyCustom0(); try { card(); liveBg(); } catch (e) { console.error(e); } };
// another page (the browser window, Settings) chose one: catch up
addEventListener("storage", e => { if (e.key === "wsb.settings") setTimeout(() => { readCfg(); card(); liveBg(); }, 0); });

// the seasonal effects (falling leaves and so on) step aside while a theme's wallpaper is on
const fxOn0 = fxOn;
fxOn = function () { return fxOn0() && !(on() && cfg.liveBg === "anime"); };

const st = document.createElement("style");
st.textContent = "#bgbox .an-tile{height:auto;padding:0 0 7px;border:2px solid transparent;border-radius:12px;background:var(--bg3);display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:1px}" +
  "#bgbox .an-tile.on{border-color:var(--ac,var(--accent))}#bgbox .an-tile b{margin:5px 8px 0}#bgbox .an-tile span{margin:0 8px}#bgbox .an-none{font-size:22px}" +
  "#bgbox .ansnd input{width:auto;height:auto;margin:0;padding:0;border-radius:3px;box-shadow:none;accent-color:var(--accent)}" +
  "#anlive{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}" +
  "#anSec{margin-top:22px}.anbox{margin-bottom:14px}.anbox .an-grid{grid-template-columns:repeat(3,1fr);gap:8px}.anbox .an-tile b{font-size:12px}.anbox .an-tile span{font-size:10.5px}" +
  ".ansnd{margin-top:8px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}";
document.head.appendChild(st);
card(); liveBg();
})();
