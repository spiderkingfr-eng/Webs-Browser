/* Webs Browser for iPhone 2.11 - more for anime fans (js/anime.more.js; ideas #051-#075): Menu → Anime hub (this
   season, countdowns, today's cards, guess the anime, trivia, voice actors, the filler guide, watch order, the cosplay
   board, your own theme from a photo, Mochi's outfits, anime radio, secrets), today's cards on the start page under the
   anime card (Customize start page → Anime: today's cards), and stickers anywhere on the start page. */
"use strict";

(function () {
if (!window.AnimeMore || !window.Anime) return;
const M = AnimeMore, on = () => !PRIVATE && Anime.has(cfg.anime);
function useTheme(id) {
  if (id && !Anime.has(id)) return;
  Anime.apply(cfg, id, {}); save("settings", cfg);
  afterSetting(); liveStart(); if (typeof fxStart === "function") fxStart();
  toast(id ? Anime.get(id).name + " is on" : "Back to your own look");
}
const app = {
  open:u => { closeSheet(); go(u); },
  server:() => window.AI ? AI.server() : "",
  useTheme, theme:() => cfg.anime || ""
};
function hubSheet(tab) {
  if (tab) try { localStorage.setItem("wsb.animeHub" + "Tab", JSON.stringify(tab)); } catch (e) {}
  openSheet("Anime hub", '<div class="amhub"></div>', { full:true });
  M.hub($("#sheetBody .amhub"), app);
}
ACTIONS.animehub = () => hubSheet();
const openMenuA = openMenu;
openMenu = function () {
  openMenuA();
  if (PRIVATE || $('#sheetBody .mrow[data-act="animehub"]')) return;
  const after = $('#sheetBody .mrow[data-act="aimore"]') || $('#sheetBody .mrow[data-act="webai"]');
  const html = '<button type="button" class="mrow" data-act="animehub">' + ico("sparkle") + "<span>Anime hub</span><em>This season, countdowns, games</em></button>";
  if (after) after.insertAdjacentHTML("afterend", html); else $("#sheetBody").insertAdjacentHTML("beforeend", html);
};

// Settings → Anime themes: a tile to make your own from a photo
const animeThemesA = SETACTIONS.animeThemes;
if (animeThemesA) SETACTIONS.animeThemes = function () {
  animeThemesA();
  const grid = $("#anPick .an-grid");
  if (!grid || grid.querySelector('[data-id="+make"]')) return;
  const t = document.createElement("button"); t.type = "button"; t.className = "an-tile none"; t.dataset.id = "+make";
  t.innerHTML = '<div class="an-none">🖼️</div><b></b><span>Colors and a moving wallpaper from your photo</span>';
  t.querySelector("b").textContent = Anime.get("mine") ? "Make another from a photo" : "Make one from your photo";
  t.onclick = () => hubSheet("maker");
  grid.insertBefore(t, grid.lastElementChild);
};

// today's cards, under the anime card
HIDE_KEYS.push(["animeDaily", "Anime: today's cards"]);
ORDERABLE.push(["amSec", "Anime: today's cards"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="amSec" class="wsec hide"></section>');
let painted = "";
function cards() {
  const show = on() && !hidden("animeDaily");
  wshow("amSec", show);
  if (!show) { painted = ""; return; }
  const key = new Date().toDateString() + cfg.anime;
  if (painted === key) return;
  painted = key;
  M.daily($("#amSec"), app);
}
HOME_HOOKS.push(cards);

// stickers on the start page (only there: not over websites)
const stk = M.stickers(document.body, { key:"stickers" });
const stkShow = () => { const t = curTab(); stk.layer.hidden = !!(t && t.u); };
HOME_HOOKS.push(stkShow);
setInterval(stkShow, 1500);
SETACTIONS.stickers = () => { closeSheet(); stk.edit(true); };
const customizeHTMLA = customizeHTML;
customizeHTML = function () { return (PRIVATE ? "" : GROUP("Stickers", BTN("stickers", "Add or move stickers", "", "", "sparkle"), "Put them anywhere on the start page.")) + customizeHTMLA(); };

document.addEventListener("wsb-secret", e => { const d = e.detail || {}; toast(d.e + " Secret found: " + d.name + " (" + d.n + " of " + d.of + ")"); });
addEventListener("click", () => setTimeout(M.spiderCheck, 60), true);

const st = document.createElement("style");
st.textContent = "#sheetBody .amhub .amh-tabs{position:sticky;top:-2px;z-index:2;background:var(--bg2);padding:4px 0 6px}#sheetBody .amh-grid{grid-template-columns:repeat(2,1fr)}#amSec .amd-row{grid-template-columns:1fr}" +
  "";
document.head.appendChild(st);
window.AnimeMoreApp = { hubSheet, cards, stk, useTheme };
})();
