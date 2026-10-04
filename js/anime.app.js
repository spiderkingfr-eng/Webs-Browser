/* Webs Browser for iPhone - anime themes (js/anime.js) in the app: Settings → Appearance → Anime
   themes picks one. It colors the whole app (the same colors as on Windows), sets the accent, puts
   its live wallpaper behind the start page, and its card near the top (Customize start page →
   Anime theme card). "No anime theme" brings back the look from before. */
"use strict";

(function () {
if (!window.Anime) return;
const on = () => !PRIVATE && Anime.has(cfg.anime);

// the colors: on top of the dark theme, after the app has applied its own
LOOK_HOOKS.push(() => {
  const root = document.documentElement, th = on() && themeNow() === "dark" ? Anime.get(cfg.anime) : null;
  if (th) { PACK_KEYS.forEach((k, i) => root.style.setProperty("--" + k, th.c[i])); root.dataset.anime = th.id; }
  else delete root.dataset.anime;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && th) meta.content = th.c[0];
});

// the live wallpaper, in place of the built-in moving backgrounds while a theme is on
let wall = null, wallCv = null;
function wallStop() { if (wall) wall.stop(); wall = null; if (wallCv) wallCv.remove(); wallCv = null; }
const liveStart0 = liveStart;
liveStart = function () {
  if (!(on() && cfg.liveBg === "anime")) { wallStop(); return liveStart0(); }
  liveStop();
  const t = curTab();
  document.body.classList.add("live");
  if ((t && t.u) || document.hidden) { wallStop(); return; }
  // (started again when the theme or the Animations setting changes)
  const key = cfg.anime + ":" + Anime.motion();
  if (wall && wallCv && wallCv.isConnected && wallCv.dataset.id === key) return;
  wallStop();
  wallCv = Object.assign(document.createElement("canvas"), { id:"live" });
  wallCv.dataset.id = key; wallCv.setAttribute("aria-hidden", "true");
  $("#view").prepend(wallCv);
  wall = Anime.run(wallCv, cfg.anime, { pointer:false });
};

// the seasonal effects (falling leaves and so on) step aside while a theme's wallpaper is on
const fxOn0 = fxOn;
fxOn = function () { return fxOn0() && !(on() && cfg.liveBg === "anime"); };

// the card, near the top of the start page
HIDE_KEYS.push(["anime", "Anime theme card"]);
ORDERABLE.unshift(["anSec", "Anime theme card"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="anSec" class="wsec hide"><div id="anBox"></div></section>');
let seen = false;
const paintCard = () => {
  const show = on() && !hidden("anime");
  wshow("anSec", show);
  if (!show) { seen = false; return; }
  Anime.card($("#anBox"), cfg.anime, { h24:!!cfg.clock24, animate:!seen });
  seen = true;
};
HOME_HOOKS.push(paintCard);
setInterval(() => { if (document.visibilityState === "visible" && !(curTab() && curTab().u)) paintCard(); }, 20000);

// Settings → Appearance → Anime themes
const settingsHTML0 = settingsHTML;
settingsHTML = function () {
  const html = settingsHTML0(), mark = '<div class="srow col"><span class="k">Dark theme colors</span>', th = Anime.get(cfg.anime);
  return html.indexOf(mark) < 0 ? html : html.replace(mark, BTN("animeThemes", "Anime themes", th ? th.name : "Off", "", "sparkle") + mark);
};
let pick = null;
SETACTIONS.animeThemes = () => {
  openSheet("Anime themes", '<p class="anlead">A whole look inspired by a popular show: colors for all of Webs, a live wallpaper behind the start page and a card on it.</p><div id="anPick"></div>', { back:() => openSettings() });
  if (pick) pick.stop();
  pick = Anime.picker($("#anPick"), { current:cfg.anime || "", onPick:id => {
    Anime.apply(cfg, id, {}); save("settings", cfg);
    afterSetting(); liveStart(); if (typeof fxStart === "function") fxStart();
    toast(id ? Anime.get(id).name + " is on" : "Back to your own look");
  } });
};

const st = document.createElement("style");
st.textContent = ".anlead{color:var(--dim);font-size:14.5px;line-height:1.45;margin:0 4px 12px}#sheetBody .an-grid{grid-template-columns:repeat(2,1fr)}#anSec{margin-top:14px}";
document.head.appendChild(st);
})();
