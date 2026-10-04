/* ---------------------------------------------------------------- Webs 3.8: anime themes in Settings → Appearance (../../js/anime.js) */
(function () {
"use strict";
if (!window.Anime) return;
const box = $("#anBox"), btn = $("#anEdit"), snd = $("#anSnd");
let pk = null;
const name = () => cfg.anime && Anime.get(cfg.anime) ? Anime.get(cfg.anime).name : "Off";
function paint() { $("#anNow").textContent = name(); snd.classList.toggle("on", !!(cfg.anime && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb)); }
function choose(id, sound) {
  Anime.apply(cfg, id, { pc:true, sound:id ? sound : null });
  commit(); applyAccent();
  $("#pack").value = cfg.pack || "";
  document.querySelectorAll("#accent button").forEach(b => b.classList.toggle("on", (b.title || "").toLowerCase() === (cfg.accent || "").toLowerCase()));
  document.dispatchEvent(new Event("wsb-pack"));
  paint();
}
btn.onclick = () => {
  const open = box.classList.toggle("hidden") === false;
  btn.textContent = open ? "Close" : "Choose…";
  if (open) pk = Anime.picker($("#anPick"), { current:cfg.anime || "", hover:true, onPick:id => choose(id, snd.classList.contains("on")) });
  else if (pk) pk.stop();
};
snd.onclick = () => { snd.classList.toggle("on"); if (cfg.anime) choose(cfg.anime, snd.classList.contains("on")); };
paint();
})();
