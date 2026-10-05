/* Webs Browser for iPhone - anime themes (js/anime.js) in the app: Settings → Appearance → Anime
   themes picks one. It colors the whole app (the same colors as on Windows), sets the accent, puts
   its live wallpaper behind the start page, and its card near the top (Customize start page →
   Anime theme card). "No anime theme" brings back the look from before.
   2.9: a little spider hides in the wallpaper now and then (tap it), a trail can follow your finger, a
   schedule can change the theme by itself (by time of day or day of the week), a screensaver comes on
   when the start page is left alone, and limited-time event themes show up when they're on. */
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
  wall = Anime.run(wallCv, cfg.anime, { pointer:false, hidden:true });
};
// the hidden spider: tap it
addEventListener("click", e => {
  if (!wall || !wallCv || !wall.hidden) return;
  const sp = wall.hidden(), r = wallCv.getBoundingClientRect();
  if (!sp || Math.hypot(e.clientX - r.left - sp.x, e.clientY - r.top - sp.y) > sp.r + 6) return;
  if (Anime.foundIt(sp)) { toast("🕷 You found the hidden spider! (" + Anime.found(sp.id) + " in this wallpaper)"); if (window.XP) XP.add(30, "Found a hidden spider"); }
}, true);
// a trail behind your finger
let trail = null, trailKey = "";
function trailNow() {
  const want = on() && cfg.animeTrail ? cfg.anime + ":" + Anime.motion() : "";
  if (want === trailKey) return;
  if (trail) trail.stop(); trail = null; trailKey = want;
  if (want) trail = Anime.trail(cfg.anime);
}
LOOK_HOOKS.push(trailNow);
// the schedule: when its time comes, its theme goes on (one picked by hand stays until then)
function schedNow() {
  const sc = cfg.animeSched, want = Anime.scheduled(sc), sl = Anime.slot(sc);
  if (PRIVATE || !want || !sl || cfg.animeSlot === sl) return;
  cfg.animeSlot = sl;
  const id = want === "none" ? "" : want;
  if ((cfg.anime || "") !== id) { Anime.apply(cfg, id, {}); save("settings", cfg); afterSetting(); liveStart(); if (typeof fxStart === "function") fxStart(); toast(id ? Anime.get(id).name + " is on, by your schedule" : "Back to your own look, by your schedule"); }
  else save("settings", cfg);
}
setInterval(schedNow, 30000); setTimeout(schedNow, 1500);
// the screensaver: the start page left alone for a few minutes
let lastTouch = Date.now(), sv = null;
["pointerdown", "keydown", "scroll", "touchstart"].forEach(t => addEventListener(t, () => { lastTouch = Date.now(); if (sv && t !== "scroll") { sv.stop(); sv = null; } }, { capture:true, passive:true }));
setInterval(() => {
  const mins = +cfg.animeSaver || 0, t = curTab();
  if (sv || PRIVATE || !mins || document.hidden || (t && t.u) || Date.now() - lastTouch < mins * 60000) return;
  if (document.querySelector("#sheet.open,.sheet.open")) return;
  sv = Anime.saver(on() ? cfg.anime : "jjk", { hint:"Tap to come back", h24:!!cfg.clock24 });
}, 5000);
window.AnimeApp = { schedNow, wall:() => wall, saver:() => sv, idleFor:ms => { lastTouch = Date.now() - ms; } };      // (for the tests)

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
  openSheet("Anime themes", '<p class="anlead">A whole look inspired by a popular show: colors for all of Webs, a live wallpaper behind the start page and a card on it.</p><div id="anPick"></div>' +
    '<div class="anmore"><label class="anchk"><input type="checkbox" id="anTrail"> A trail behind your finger</label>' +
    '<label class="anrow">Screensaver <select id="anSaver"><option value="0">Off</option><option value="2">After 2 minutes</option><option value="5">After 5 minutes</option><option value="10">After 10 minutes</option></select></label>' +
    '<p class="ansmall">When the start page is left alone: the wallpaper and a big clock. Tap to come back.</p><h4>Schedule</h4><div id="anSched"></div>' +
    '<p class="ansmall">🕷 A little spider hides in each wallpaper now and then. Tap it when you see it.</p></div>', { back:() => openSettings() });
  $("#anTrail").checked = !!cfg.animeTrail; $("#anTrail").onchange = e => { cfg.animeTrail = e.target.checked; save("settings", cfg); trailNow(); };
  $("#anSaver").value = String(+cfg.animeSaver || 0); $("#anSaver").onchange = e => { cfg.animeSaver = +e.target.value; save("settings", cfg); };
  Anime.schedEditor($("#anSched"), cfg.animeSched || {}, sc => { cfg.animeSched = sc; cfg.animeSlot = ""; save("settings", cfg); schedNow(); });
  if (pick) pick.stop();
  pick = Anime.picker($("#anPick"), { current:cfg.anime || "", onPick:id => {
    Anime.apply(cfg, id, {}); save("settings", cfg);
    afterSetting(); liveStart(); if (typeof fxStart === "function") fxStart();
    toast(id ? Anime.get(id).name + " is on" : "Back to your own look");
  } });
};

const st = document.createElement("style");
st.textContent = ".anmore{margin-top:16px;padding:12px;border-radius:14px;background:var(--bg3)}.anmore h4{margin:12px 0 6px;font-size:14px}.anchk{display:flex;gap:8px;align-items:center;font-size:14.5px}" +
  ".anrow{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:14.5px}.anrow select{height:32px;border-radius:8px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font:inherit;font-size:14px}" +
  ".ansmall{color:var(--dim);font-size:12.5px;margin:4px 0 0}" +
  ".anlead{color:var(--dim);font-size:14.5px;line-height:1.45;margin:0 4px 12px}#sheetBody .an-grid{grid-template-columns:repeat(2,1fr)}#anSec{margin-top:14px}";
document.head.appendChild(st);
})();
