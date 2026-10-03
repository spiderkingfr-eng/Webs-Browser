/* ---------------------------------------------------------------- 3.2.1: "Web Studios" when the browser opens
   The startup animation (Settings → Appearance) now reads "Web Studios"; with
   it off, a short title card says it instead. A click skips it. */
(function () {
"use strict";
if (PRIVATE) return;
const splash0 = splash;
splash = function () {
  splash0();
  const t = document.querySelector("#over .splash .spn"); if (t) t.textContent = "Web Studios";
};
function studioCard() {
  if (overlay || cfg.xStudio === false) return;
  const n = el("div", "splash xstudio");
  n.style.cssText = "left:0;top:0;width:" + vpW + "px;height:" + vpH + "px";
  n.innerHTML = '<div class="xst"><b>Web Studios</b><span></span></div>';
  n.querySelector("span").textContent = "Webs Browser " + (window.X3 && X3.version || "");
  const end = () => { if (overlay === "splash" && $("#over").contains(n)) { overlay = null; $("#over").innerHTML = ""; relayout(); } };
  n.onclick = end;
  $("#over").innerHTML = ""; $("#over").appendChild(n); overlay = "splash"; lastLayout = ""; relayout();
  setTimeout(() => n.classList.add("out"), 1300);
  setTimeout(end, 1750);
}
const splashMaybe0 = splashMaybe;
splashMaybe = function () {
  const first = !splashDone;
  splashMaybe0();
  if (first && overlay !== "splash" && performance.now() < 4000) studioCard();
};
})();
