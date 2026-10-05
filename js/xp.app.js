/* Webs Browser for iPhone - XP and levels (js/xp.js) on the start page: a card with your level and the
   way to the next one (Customize → Level and XP turns it off); Levels shows what each one unlocks.
   And Mochi, the companion in the corner (js/buddy.js; Customize → Mochi, your companion). */
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
// Mochi, the companion in the corner of the start page (js/buddy.js); not while a site is open
HIDE_KEYS.push(["buddy", "Mochi, your companion"]);
function buddy() {
  if (!window.Buddy) return;
  const t = curTab(), want = !hidden("buddy") && !(t && t.u);
  if (want && !Buddy.on()) Buddy.mount({ bottom:92, right:16 }); else if (!want && Buddy.on()) Buddy.unmount();
}
HOME_HOOKS.push(buddy);
setInterval(buddy, 1500);
})();
