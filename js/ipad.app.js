/* Webs Browser for iPhone 2.9 - side by side on an iPad (or any wide screen): two tabs at once, each half the
   screen, with a divider to drag. Menu → Side by side, then pick the other tab. Tap a side to work in it (the
   address bar and Back follow the side you're in); ⇄ swaps them, ✕ goes back to one. It turns off by itself when
   the screen gets narrow (Split View, Slide Over, turning the iPad) and comes back when there's room. */
(function () {
"use strict";
const WIDE = 820;
const st0 = () => load("split", null) || null;            // { other:tabId, at:0.5 }
let split = st0();
const wide = () => innerWidth >= WIDE;
const tabOf = id => S().list.find(t => t.id === id) || null;
const on = () => !!(split && wide() && !PRIVATE && tabOf(split.other) && curTab() && curTab().u && curTab().id !== split.other && tabOf(split.other).u);
const div = document.createElement("div"); div.id = "splitBar";
div.innerHTML = '<span class="sgrip"></span><button type="button" class="sbtn" data-s="swap" aria-label="Swap sides">⇄</button><button type="button" class="sbtn" data-s="off" aria-label="One page">✕</button>';
$("#frames").appendChild(div);

function paint() {
  const yes = on();
  document.body.classList.toggle("split", yes);
  frames.forEach(f => f.el.classList.remove("sl", "sr"));
  if (!yes) return;
  const t = curTab(), o = tabOf(split.other);
  const fo = ensureFrame(o), ft = frames.get(t.id);
  if (ft) ft.el.classList.add("on", "sl");
  fo.el.classList.add("on", "sr");
  const at = Math.max(0.25, Math.min(0.75, +split.at || 0.5));
  $("#frames").style.setProperty("--sp", at);
}
RENDER_HOOKS.push(() => paint());
addEventListener("resize", () => { clearTimeout(paint.t); paint.t = setTimeout(paint, 150); });
function start(otherId) {
  if (!wide()) { toast("Side by side needs a wider screen (turn the iPad, or make Webs bigger)"); return; }
  split = { other:otherId, at:(split && split.at) || 0.5 };
  save("split", split); closeSheet(); render();
}
function stop() { split = null; save("split", null); render(); }
function swap() { if (!on()) return; const was = curTab().id, other = split.other; split.other = was; save("split", split); activate(other); }
// working in the other side: a tap in its page makes it the current tab
addEventListener("blur", () => setTimeout(() => {
  if (!on()) return;
  const o = frames.get(split.other);
  if (o && document.activeElement === o.el) { const was = curTab().id; split.other = was; save("split", split); activate(o.id); }
}, 0));
div.addEventListener("click", e => {
  const b = e.target.closest("[data-s]"); if (!b) return;
  if (b.dataset.s === "off") stop();
  else swap();
});
// drag the divider
div.addEventListener("pointerdown", e => {
  if (e.target.closest("[data-s]")) return;
  e.preventDefault(); div.setPointerCapture(e.pointerId); document.body.classList.add("sdrag");
  const box = $("#frames").getBoundingClientRect();
  const mv = ev => { split.at = Math.max(0.25, Math.min(0.75, (ev.clientX - box.left) / box.width)); $("#frames").style.setProperty("--sp", split.at); };
  const up = () => { div.removeEventListener("pointermove", mv); div.removeEventListener("pointerup", up); document.body.classList.remove("sdrag"); save("split", split); };
  div.addEventListener("pointermove", mv); div.addEventListener("pointerup", up);
});
function pickSheet() {
  const t = curTab(), l = S().list.filter(x => x.u && x.id !== (t && t.id));
  if (!t || !t.u) { toast("Open a page first, then put another beside it"); return; }
  openSheet("Side by side", '<p class="dim" style="margin:0 4px 10px">Show another tab beside ' + esc(t.t || hostOf(t.u)) + ":</p><div class=\"card\">" +
    (l.length ? l.map(x => '<button type="button" class="mrow" data-id="' + x.id + '"><span class="aie">🌐</span><span>' + esc(x.t || hostOf(x.u)) + "</span><em>" + esc(hostOf(x.u)) + "</em></button>").join("") : '<p class="dim" style="padding:12px 16px">No other pages open.</p>') +
    '</div><div class="card"><button type="button" class="mrow" id="spNew"><span class="aie">➕</span><span>A new page beside it</span></button></div>');
  $("#sheetBody").querySelectorAll("[data-id]").forEach(b => { b.onclick = () => start(b.dataset.id); });
  $("#spNew").onclick = () => { closeSheet(); openOmni(""); const was = t.id; split = { other:was, at:(split && split.at) || 0.5 }; save("split", split); const n = addTab(); activate(n.id); };
}
ACTIONS.split = pickSheet;
const openMenuP = openMenu;
openMenu = function () {
  openMenuP();
  if (!wide() || PRIVATE) return;
  const card = $("#sheetBody .card:last-of-type");
  if (card) card.insertAdjacentHTML("afterbegin", on() ? '<button type="button" class="mrow" id="spOff">' + ico("grid") + "<span>One page at a time</span><em>Leave side by side</em></button>"
    : '<button type="button" class="mrow" data-act="split">' + ico("grid") + "<span>Side by side</span><em>Two pages at once</em></button>");
  const off = $("#spOff"); if (off) off.onclick = () => { closeSheet(); stop(); };
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.IPad = { start, stop, swap, on, pickSheet, state:() => split };
const st = document.createElement("style");
st.textContent = "#splitBar{display:none}body.split #frames iframe.sl{display:block;right:auto;width:calc(var(--sp,.5) * 100% - 4px)}" +
  "body.split #frames iframe.sr{display:block;left:auto;width:calc((1 - var(--sp,.5)) * 100% - 4px)}" +
  "body.split #splitBar{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;position:absolute;top:0;bottom:0;left:calc(var(--sp,.5) * 100% - 4px);width:8px;background:var(--line);cursor:col-resize;z-index:3;touch-action:none}" +
  "#splitBar .sgrip{width:4px;height:44px;border-radius:2px;background:var(--dim)}#splitBar .sbtn{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font-size:14px;flex:none;padding:0}" +
  "body.sdrag #frames iframe{pointer-events:none}body.split #frames iframe.sl{box-shadow:inset 0 3px 0 var(--accent)}";
document.head.appendChild(st);
paint();
})();
