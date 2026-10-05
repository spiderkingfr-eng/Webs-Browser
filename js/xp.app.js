/* Webs Browser for iPhone - XP and levels (js/xp.js) on the start page: a card with your level and the
   way to the next one (Customize → Level and XP turns it off); Levels shows what each one unlocks. */
(function () {
"use strict";
if (!window.XP || PRIVATE) return;
HIDE_KEYS.push(["xp", "Level and XP"]);
ORDERABLE.push(["xpSec", "Level and XP"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="xpSec" class="wsec hide"><div id="xpBox"></div></section>');
let made = false;
HOME_HOOKS.push(() => {
  const show = !hidden("xp");
  wshow("xpSec", show);
  if (show && !made) { XP.card($("#xpBox")); made = true; }
});
})();
