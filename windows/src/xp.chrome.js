/* Webs 3.10: XP and levels (../../js/xp.js) in the browser window: Menu → Levels and XP…, the frames and
   band effects you've unlocked (the band across the top of the window wears the one you pick). */
(function () {
"use strict";
if (!window.XP || PRIVATE) return;
function xpPanel() {
  const p = el("div", "xpane xpp"), c = el("div");
  p.innerHTML = '<div class="xhead"><div class="xic">⭐</div><div><b>Levels and XP</b><span>From games, achievements and coming back each day. Levels unlock looks.</span></div></div>';
  p.appendChild(c);
  XP.card(c, { noPanel:true });
  const list = el("div", "xp-panel"); p.appendChild(list); XP.panel(list);
  const n = openOver("xpp", p); n.style.right = "8px";
}
X3.xpPanel = xpPanel;
const menuRows10 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows10) menuRows10(m);
  const i = XP.info();
  m.appendChild(row("sparkle", "Levels and XP…", "Level " + i.level, xpPanel));
};
const commands10 = commands;
commands = function () { return commands10().concat([{ t:"Levels and XP: what your level unlocks", k:"", i:"sparkle", fn:xpPanel }]); };
const st = document.createElement("style");
st.textContent = ".xpp{width:420px}.xpp .xp-card{margin-bottom:6px}.xpp .xp-panel{border:0;margin:0;padding:0}";
document.head.appendChild(st);
})();
