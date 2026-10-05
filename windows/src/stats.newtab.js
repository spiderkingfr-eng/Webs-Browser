/* Webs 3.10: a wallpaper from the gallery (Menu → Wallpaper gallery; ../../js/stats.js) on the new tab page,
   when no picture of your own is chosen. Shared by people, approved by the owner, from the Web AI server. */
(function () {
"use strict";
if (PRIVATE) return;
function gal() { try { const g = JSON.parse(localStorage.getItem("wsb.galleryBg") || "null"); return g && /^https:\/\/[^\s"'()]+\/gallery\/img\/[a-z0-9]{10}$/.test(g.url || "") ? g : null; } catch (e) { return null; } }
function paint() {
  let l = $("galbg");
  const g = gal(), own = $("bgl");
  if (!g || own) { if (l) { l.remove(); if (!own) document.body.classList.remove("pic"); } return; }
  if (!l) { l = document.createElement("div"); l.id = "galbg"; l.setAttribute("aria-hidden", "true"); l.innerHTML = '<div class="pic"></div><div class="dim"></div><div class="by"></div>'; document.body.prepend(l); }
  l.querySelector(".pic").style.backgroundImage = 'url("' + g.url + '")';
  l.querySelector(".by").textContent = "“" + g.title + "” by " + g.by;
  document.body.classList.add("pic");
}
const paintBackgroundG = paintBackground;
paintBackground = function () { paintBackgroundG.apply(this, arguments); try { paint(); } catch (e) { console.error(e); } };
addEventListener("storage", e => { if (e.key === "wsb.galleryBg") paint(); });
const st = document.createElement("style");
st.textContent = "#galbg{position:fixed;inset:0;z-index:-1;pointer-events:none}#galbg .pic{position:absolute;inset:0;background:center/cover no-repeat}#galbg .dim{position:absolute;inset:0;background:rgba(0,0,0,.25)}" +
  "#galbg .by{position:absolute;right:12px;bottom:8px;font-size:11px;color:#fff;opacity:.7;text-shadow:0 1px 2px #000}";
document.head.appendChild(st);
paint();
})();
