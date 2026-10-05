/* Webs 3.11: Happening near you in the window: Menu → Happening near you… (../../js/near.js). */
(function () {
"use strict";
if (!window.Near) return;
function nearPanel() {
  if (PRIVATE) { toast("Not in a private window"); return; }
  const p = el("div", "xpane gtp nrp");
  p.innerHTML = '<div class="xhead"><div class="xic">📍</div><div><b>Happening near you</b><span>Events, alerts and news around you</span></div></div><div class="gtb"></div>';
  const n = openOver("nearp", p); n.style.right = "8px";
  Near.full(p.querySelector(".gtb"), { open:u => { closeOver(); newTab(u, false); } }).then(d => { if (d && overlay === "nearp") p.querySelector(".xhead span").textContent = (d.place.approx ? "Around " : "In ") + d.place.name; });
}
const menuRowsN = X3.menuRows;
X3.menuRows = function (m) { if (menuRowsN) menuRowsN(m); if (!PRIVATE) m.appendChild(row("pin", "Happening near you…", "", nearPanel)); };
const commandsN = commands;
commands = function () { return commandsN().concat(PRIVATE ? [] : [{ t:"Happening near you: events, alerts, local news", k:"", i:"pin", fn:nearPanel }]); };
X3.near = { nearPanel };
const st = document.createElement("style");
st.textContent = Near.CSS + ".nrp{width:460px}.nrp .nr-list{max-height:52vh;overflow:auto}";
document.head.appendChild(st);
})();
