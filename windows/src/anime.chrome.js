/* ---------------------------------------------------------------- Webs 3.8: anime themes in the browser window (../../js/anime.js)
   The colors come through the "custom" color theme every page reads; here the window gets each
   theme's touch on top: a moving band across the top of the tab strip and the active tab's mark. Menu →
   Anime themes… picks one from anywhere (the new tab page's Background panel and Settings can too). */
(function () {
"use strict";
if (!window.Anime) return;
const root = document.documentElement;
const band = el("div", "anband"); band.setAttribute("aria-hidden", "true");
document.body.appendChild(band);
const applyPack0 = applyPack;
applyPack = function () {
  applyPack0();
  const id = !PRIVATE && cfg.theme !== "light" && Anime.has(cfg.anime) ? cfg.anime : "";
  if (id) root.dataset.anime = id; else delete root.dataset.anime;
};
applyPack();

function choose(id, sound) {
  Anime.apply(cfg, id, { pc:true, sound:id ? sound : null });
  saveNow("settings"); applyLook();
  if (typeof muCmd === "function") muCmd("ambient", cfg.ambient || "");
  if (typeof sendPrefs === "function") sendPrefs();
}
function animePanel() {
  const p = el("div", "xpane anp");
  p.innerHTML = '<div class="xhead"><div class="xic">🎌</div><div><b>Anime themes</b><span>Colors for the whole browser, a live wallpaper and a card on the new tab page</span></div></div><div class="anp-pick"></div>' +
    '<label class="anp-snd"><input type="checkbox"> Play its sound (rain, wind, waves…)</label>';
  const snd = p.querySelector("input");
  snd.checked = !!(cfg.anime && cfg.ambient && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb);
  const pk = Anime.picker(p.querySelector(".anp-pick"), { current:cfg.anime || "", onPick:id => { choose(id, snd.checked); toast(id ? Anime.get(id).name + " is on: open a new tab to see its wallpaper" : "Back to your own look"); } });
  snd.onchange = () => { if (cfg.anime) choose(cfg.anime, snd.checked); };
  const n = openOver("anp", p); n.style.right = "8px";
  new MutationObserver((m, o) => { if (!p.isConnected) { pk.stop(); o.disconnect(); } }).observe($("#over"), { childList:true });
}
X3.animePanel = animePanel;
const menuRows8 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows8) menuRows8(m);
  if (!PRIVATE) m.appendChild(row("sparkle", "Anime themes…", cfg.anime && Anime.get(cfg.anime) ? Anime.get(cfg.anime).name : "", animePanel));
};
const commands8 = commands;
commands = function () { return commands8().concat(PRIVATE ? [] : [{ t:"Anime themes: Bleach, Tokyo Ghoul, Demon Slayer and more", k:"", i:"sparkle", fn:animePanel }]); };

const st = document.createElement("style");
st.textContent = `
.anband{position:fixed;left:0;right:0;top:0;height:3px;z-index:30;pointer-events:none;display:none}
html[data-anime] .anband{display:block}
html[data-anime="bleach"] .anband{background:linear-gradient(90deg,#000 0 30%,#ff6a1a 50%,#fff 52%,#000 70%);background-size:200% 100%;animation:anBand 6s linear infinite}
html[data-anime="ghoul"] .anband{background:linear-gradient(90deg,#3a000a,#e0193a,#3a000a);background-size:50% 100%;box-shadow:0 0 10px #e0193a;animation:anBeat 2.4s ease-in-out infinite,anDrift 5s linear infinite}
html[data-anime="slayer"] .anband{height:6px;background:conic-gradient(#1f8a5c 25%,#0a0a0a 0 50%,#1f8a5c 0 75%,#0a0a0a 0) 0 0/6px 6px;animation:anChk 1.6s linear infinite}
html[data-anime="jjk"] .anband{background:linear-gradient(90deg,#4d6bff,#a64dff,#ff3355,#a64dff,#4d6bff);background-size:200% 100%;box-shadow:0 0 12px #7f5cff;animation:anBand 5s linear infinite}
html[data-anime="naruto"] .anband{background:linear-gradient(90deg,#ff8a1c 0 24px,#1d2a5c 24px 30px) 0 0/30px 100%;animation:anRoll 1.5s linear infinite}
html[data-anime="aot"] .anband{background:linear-gradient(90deg,#3c3a2c,#c9a26b,#5b6b3f,#c9a26b,#3c3a2c);background-size:200% 100%;animation:anBand 9s linear infinite}
html[data-anime="onepiece"] .anband{background:linear-gradient(135deg,#ffc531 25%,#e3342b 0 50%,#ffc531 0 75%,#e3342b 0) 0 0/16px 16px;animation:anStripe 1s linear infinite}
html[data-anime="deathnote"] .anband{height:2px;background:linear-gradient(90deg,transparent,#fff 20%,#d4102e 50%,#fff 80%,transparent);background-size:200% 100%;animation:anBand 5s linear infinite}
html[data-anime="p5"] .anband{height:5px;background:linear-gradient(-45deg,#e60012 25%,#000 0 50%,#e60012 0 75%,#000 0) 0 0/14px 14px;animation:anStripe2 .8s linear infinite}
@keyframes anBand{to{background-position:-200% 0}}@keyframes anBeat{50%{opacity:.45}}@keyframes anDrift{to{background-position:100% 0}}
@keyframes anChk{to{background-position:12px 0}}@keyframes anRoll{to{background-position:30px 0}}@keyframes anStripe{to{background-position:32px 0}}@keyframes anStripe2{to{background-position:28px 0}}
html[data-anime="p5"] .tab.on,html[data-anime="bleach"] .tab.on{box-shadow:inset 0 -2px 0 var(--accent)}
.anp{width:560px}.anp .an-grid{grid-template-columns:repeat(4,1fr);gap:8px}.anp .an-tile b{font-size:12px}.anp .an-tile span{font-size:10.5px}
.anp-snd{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:var(--dim)}
/* every band moves, round and round; only Animations: Off stops it */
html[data-motion="off"] .anband{animation:none!important}
`;
document.head.appendChild(st);
})();
