/* ---------------------------------------------------------------- Webs 3.3: Web AI
   The chat itself lives in the sidebar (side.html#xai, webai.side.js). This
   window opens it (toolbar button, menu, Alt+Shift+A) and reads the page for it:
   the sidebar asks through storage (wsb.xaiAsk.<window>), the page answers
   through the page tools (x-ai in shield.js), and the text goes back the same
   way (wsb.xaiPage.<window>), where it is removed as soon as it has been read.
   Private windows never hand over a page. */
(function () {
"use strict";
const open = what => {
  if (side.open && side.which === "xai" && !what) { closeSide(); return; }
  openSide("xai", what);
};
const openSide3 = openSide;
openSide = function (which, what) {
  if (which !== "xai") return openSide3(which, what);
  if (!side.open) { const r = $("#rail"); r.classList.add("opening"); setTimeout(() => r.classList.remove("opening"), 500); }
  side.open = true; side.which = "xai";
  send("side-open", HOME + "side.html?w=" + WIN + "#xai" + (what ? ":" + what + ":" + Date.now() : ""));
  renderRail(); paint(); relayout();
};
X3.webAI = open;

/* a button in the toolbar, next to the sidebar's (Settings > hide toolbar buttons can hide it) */
const btn = el("button", "btn", ico("sparkle"));
btn.id = "aib"; btn.title = "Web AI  (Alt+Shift+A)";
btn.onclick = () => open();
$("#sideb").before(btn);
TOOLBAR.splice(TOOLBAR.findIndex(b => b[0] === "sideb"), 0, ["aib", "Web AI"]);
const paint3 = paint;
paint = function () {
  paint3();
  btn.classList.toggle("act", side.open && side.which === "xai");
};
const renderRail3 = renderRail;
renderRail = function () {
  renderRail3();
  const r = $("#rail"), b = el("button", "btn" + (side.which === "xai" ? " act" : ""), ico("sparkle"));
  b.title = "Web AI  (Alt+Shift+A)";
  b.onclick = () => openSide("xai");
  r.insertBefore(b, r.firstChild);
};

/* the menu, the command palette, the keyboard */
const menuRows3 = X3.menuRows;
X3.menuRows = function (m) {
  m.appendChild(row("sparkle", "Web AI", "Alt+Shift+A", () => open()));
  if (menuRows3) menuRows3(m);
};
const commands3 = commands;
commands = function () {
  return commands3().concat([
    { t:"Web AI: ask about this page", k:"Alt+Shift+A", i:"sparkle", fn:() => openSide("xai") },
    { t:"Web AI: summarize this page", k:"", i:"sparkle", fn:() => openSide("xai", "summarize") }
  ]);
};
const shortcut3 = shortcut;
shortcut = function (k, ctrl, shift, alt) {
  if (alt && shift && !ctrl && k === 65) { open(); return; }
  return shortcut3(k, ctrl, shift, alt);
};
const keysPanel3 = keysPanel;
keysPanel = function () {
  keysPanel3();
  const cols = document.querySelector("#keysp .cols"); if (!cols) return;
  const r = el("div", "kr"); r.appendChild(el("span")).textContent = "Web AI"; r.appendChild(el("span")).textContent = "Alt+Shift+A"; r.style.color = "var(--fg)"; cols.appendChild(r);
};

/* reading the page for the sidebar */
const ASK = "wsb.xaiAsk." + WIN, PAGE = "wsb.xaiPage." + WIN, waiting = {};
function answer(o) {
  try { localStorage.setItem(PAGE, JSON.stringify(o)); }
  catch (e) { o.text = String(o.text || "").slice(0, 20000); o.cut = 1; try { localStorage.setItem(PAGE, JSON.stringify(o)); } catch (x) { return; } }
  setTimeout(() => {      // the sidebar removes it once read; this is the backstop
    try { const v = JSON.parse(localStorage.getItem(PAGE) || "null"); if (v && v.n === o.n) localStorage.removeItem(PAGE); } catch (e) {}
  }, 6000);
}
addEventListener("storage", e => {
  if (e.key !== ASK || !e.newValue) return;
  let c = null; try { c = JSON.parse(e.newValue); } catch (x) {}
  if (!c || typeof c.n !== "string" || Date.now() - (+c.t || 0) > 10000) return;
  const n = c.n.slice(0, 20), t = T(active);
  if (PRIVATE) return answer({ n, why:"private" });
  if (!t || !isWeb(t.url)) return answer({ n, why:"none" });
  waiting[t.id] = { n, ts:Date.now() };
  send("page-tool", t.id, "x-ai", "");
});
const onToolResult3 = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  if (r && r.a === "x-key" && r.k === "A") { if (id === active) open(); return; }   // Alt+Shift+A pressed on a page
  if (r && r.a === "x-ai") {
    const w = waiting[id]; delete waiting[id];
    if (!w || Date.now() - w.ts > 8000) return;     // only answers this window asked for, just now
    const t = T(id);
    answer({ n:w.n, ok:1, title:String(r.title || (t && t.title) || "").slice(0, 300), url:t ? t.url : "",
             text:String(r.t || "").slice(0, 60000), sel:String(r.sel || "").slice(0, 5000), cut:r.cut || String(r.t || "").length > 60000 ? 1 : 0 });
    return;
  }
  onToolResult3(id, json);
};
applyToolbar(); paint(); renderRail();
})();
