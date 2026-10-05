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
  if (open) pk = Anime.picker($("#anPick"), { current:cfg.anime || "", onPick:id => choose(id, snd.classList.contains("on")) });
  else if (pk) pk.stop();
};
snd.onclick = () => { snd.classList.toggle("on"); if (cfg.anime) choose(cfg.anime, snd.classList.contains("on")); };
paint();

// 3.10: the screensaver and the schedule (the browser window runs them, src/anime.chrome.js)
$("#anSaver").value = String(+cfg.animeSaver || 0);
$("#anSaver").onchange = () => { cfg.animeSaver = +$("#anSaver").value; commit(); };
$("#anSchEdit").onclick = () => {
  const box = $("#anSch"), open = box.classList.toggle("hidden") === false;
  $("#anSchEdit").textContent = open ? "Close" : "Edit…";
  if (open) Anime.schedEditor(box, cfg.animeSched || {}, sc => { cfg.animeSched = sc; cfg.animeSlot = ""; commit(); });
};

// 3.9: the wallpaper behind websites (src/anime.chrome.js): on or off, and the sites with a look of their own
const web = $("#anWeb"), list = $("#anSites");
web.value = cfg.animeWeb || "";
web.onchange = () => { cfg.animeWeb = web.value; commit(); sites(); };
function sites() {
  const all = cfg.animeSites || {}, hosts = Object.keys(all).sort();
  list.classList.toggle("hidden", !hosts.length);
  list.innerHTML = hosts.length ? "<p>Sites with a look of their own (Remove brings back the usual one):</p>" : "";
  hosts.forEach(h => {
    const o = all[h], th = Anime.get(o.id), r = document.createElement("div");
    r.className = "set"; r.style.padding = "8px 0";
    r.innerHTML = '<div class="txt"><b></b><span></span></div><button class="act">Remove</button>';
    r.querySelector("b").textContent = h;
    r.querySelector("span").textContent = [o.on === false ? "Off" : o.on ? "On" : "", th ? th.name : "Matches the browser", o.mode === "over" ? "over the page" : "behind the page",
      o.k ? Math.round(o.k * 100) + "% shows through" : "", o.still ? "still" : "", o.soft ? "soft focus" : ""].filter(Boolean).join(" · ");
    r.querySelector("button").onclick = () => { const a = Object.assign({}, cfg.animeSites); delete a[h]; cfg.animeSites = a; commit(); sites(); };
    list.appendChild(r);
  });
}
sites();
})();
