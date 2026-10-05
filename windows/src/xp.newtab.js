/* Webs 3.10: XP and levels (../../js/xp.js) on the new tab page: a card with your level and the way to
   the next one, under the anime theme's card (Customize → Show on this page → Level and XP). */
(function () {
"use strict";
if (!window.XP || PRIVATE) return;
SHOW.push(["xp", "Level and XP"]);
const sec = document.createElement("section"); sec.id = "xpSec"; sec.className = "hide"; sec.innerHTML = '<div id="xpBox"></div>';
($("anSec") || $("f")).after(sec);
let made = false;
function paint() {
  const show = !hidden("xp");
  sec.classList.toggle("hide", !show);
  if (show && !made) { XP.card($("xpBox")); made = true; }
}
const applyCustom0 = applyCustom;
applyCustom = function () { applyCustom0(); try { paint(); } catch (e) { console.error(e); } };
const st = document.createElement("style");
st.textContent = "#xpSec{margin-top:18px}#xpBox{max-width:560px;margin:0 auto}";
document.head.appendChild(st);
paint();
})();
