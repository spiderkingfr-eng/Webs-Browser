/* Webs 3.11: Happening near you on the new tab page (../../js/near.js): the three biggest things around you, and
   all of them when you click See all. Customize → Show on this page → Happening near you. */
(function () {
"use strict";
if (!window.Near || PRIVATE) return;
SHOW.push(["near", "Happening near you"]);
const sec = document.createElement("section"); sec.id = "nearSec"; sec.className = "hide";
($("lkSec") || $("xpSec") || $("anSec") || $("f")).after(sec);
const open = u => { location.href = u; };
let made = false;
function small() { Near.card(sec, { open, more:big }); }
function big() {
  sec.innerHTML = '<div class="nr-card nr-big"><div class="nr-h"><b>📍 Happening near you</b><button type="button" class="nr-more nr-close">Close</button></div><div class="nr-x"></div></div>';
  sec.querySelector(".nr-close").onclick = small;
  Near.full(sec.querySelector(".nr-x"), { open, changed:() => {} });
}
function paint() {
  const show = !hidden("near");
  sec.classList.toggle("hide", !show);
  if (show && !made) { made = true; small(); }
}
const applyCustomN = applyCustom;
applyCustom = function () { applyCustomN(); try { paint(); } catch (e) { console.error(e); } };
const st = document.createElement("style");
st.textContent = Near.CSS + "#nearSec{margin:16px auto 0;max-width:560px}#nearSec .nr-card{background:var(--card,rgba(255,255,255,.06));backdrop-filter:blur(14px)}";
document.head.appendChild(st);
paint();
})();
