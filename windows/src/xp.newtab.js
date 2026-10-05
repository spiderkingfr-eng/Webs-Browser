/* Webs 3.10: XP and levels (../../js/xp.js) on the new tab page: a card with your level and the way to
   the next one, under the anime theme's card (Customize → Show on this page → Level and XP), and Mochi,
   the companion in the corner (../../js/buddy.js; Customize → Mochi, your companion). */
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
// Mochi, the companion in the corner (../../js/buddy.js)
SHOW.push(["buddy", "Mochi, your companion"]);
function buddy() { if (!window.Buddy) return; const want = !hidden("buddy"); if (want && !Buddy.on()) Buddy.mount({ bottom:64, right:22 }); else if (!want && Buddy.on()) Buddy.unmount(); }
const applyCustom0 = applyCustom;
applyCustom = function () { applyCustom0(); try { paint(); buddy(); } catch (e) { console.error(e); } };
const st = document.createElement("style");
st.textContent = "#xpSec{margin-top:18px}#xpBox{max-width:560px;margin:0 auto}";
document.head.appendChild(st);
paint(); buddy();
})();
