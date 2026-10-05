/* Webs Browser for iPhone 2.10 - Happening near you (js/near.js): a card on the start page with the three biggest
   things around you, and everything (events, alerts, local news) in Menu → Happening near you. */
(function () {
"use strict";
if (!window.Near || PRIVATE) return;
HIDE_KEYS.push(["near", "Happening near you"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="nearSec" class="wsec hide"></section>');
const open = u => { closeSheet(); go(u, { newTab:true }); };
let shownAt = 0;
function card() {
  if (hidden("near")) { wshow("nearSec", false); return; }
  wshow("nearSec", true);
  if (Date.now() - shownAt < 60000 && $("#nearSec").childElementCount) return;
  shownAt = Date.now();
  Near.card($("#nearSec"), { open, more:sheet });
}
HOME_HOOKS.push(card);
function sheet() {
  openSheet("Happening near you", '<div class="card pvc nrs"></div>', { kind:"near" });
  Near.full($("#sheetBody .nrs"), { open, changed:() => { shownAt = 0; card(); } });
}
ACTIONS.near = sheet;
const openMenuN = openMenu;
openMenu = function () {
  openMenuN();
  const c = $("#sheetBody .card:last-of-type");
  if (c) c.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="near">' + ico("world") + "<span>Happening near you</span><em>Events, alerts, local news</em></button>");
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.NearApp = { card, sheet };
const st = document.createElement("style");
st.textContent = Near.CSS + "#nearSec{margin-bottom:10px}.nrs{padding:10px 14px 14px}";
document.head.appendChild(st);
})();
