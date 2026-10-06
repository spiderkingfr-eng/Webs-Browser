/* ---------------------------------------------------------------- Webs 3.14: the Web AI tools on the PC (ideas #026-#050)
   The tools themselves are shared with the iPhone app (../../js/ai.tools.js); this is the PC's side: it reads the
   page (the x-ai, x-selinfo, x-yt and x-pickimg page tools), puts answers back where the text was (x-type), and
   adds them to Menu → More from Web AI and the command list. Also: how many questions are left today, on the
   Web AI button, and saving study cards as a file. */
(function () {
"use strict";
if (PRIVATE || !window.AITools || !X3.ai) return;
const A = AITools, PT = X3.ai.pageTool;
const webT = () => { const t = T(active); return t && isWeb(t.url) && !t.sleep && !t.lazy ? t : null; };
let picked = null;       // the picture chosen for "Describe a picture"
// a panel that grows as the answer comes in asks the window for the room (and stays inside it)
function grow(p, id) { new ResizeObserver(() => { if (overlay === id && p.isConnected) { capHeight(p); relayout(); } }).observe(p.querySelector(".aib")); }
async function ctx(tool) {
  const n = tool.needs || [], c = {};
  if (n.includes("page")) {
    const t = webT();
    if (!t) { if (tool.id === "code") return c; throw new Error("Open the page first."); }
    if (tool.id === "code" && (await sel()).text) return c;
    c.page = await X3.ai.readTab(t);
  } else if (n.includes("sel")) { const t = webT(); if (t) c.page = { title:t.title || "", url:t.url, text:"" }; }
  if (n.includes("tabs")) {
    const list = tabs.filter(t => isWeb(t.url) && !t.sleep && !t.lazy).slice(0, 6);
    if (list.length < 2) throw new Error("Open at least two pages to ask across them.");
    c.tabs = [];
    for (const t of list) { try { c.tabs.push(await X3.ai.readTab(t)); } catch (e) {} }
    if (c.tabs.length < 2) throw new Error("The tabs couldn't be read. Reload them and try again.");
  }
  if (n.includes("caps")) {
    const t = webT();
    if (!t || !/^https:\/\/(www\.|m\.)?youtube\.com\/watch/.test(t.url)) throw new Error("Open a YouTube video first: the notes come from its captions.");
    const r = await PT(t, "x-yt", "", 15000);
    if (r.none || !r.t) throw new Error("This video has no captions Web AI can read.");
    c.caps = { title:r.title || t.title, text:r.t };
  }
  if (n.includes("img")) { if (!picked) throw new Error("Pick a picture first."); c.img = picked; }
  return c;
}
async function sel() {
  const t = webT(); if (!t) return { text:"" };
  try { const r = await PT(t, "x-selinfo", "", 3000); return { text:String(r.sel || ""), edit:!!r.edit, all:!!r.all }; } catch (e) { return { text:"" }; }
}
function insert(text, s) {
  closeOver();
  setTimeout(async () => {
    const t = webT(); if (!t) { toast("The page has gone"); return; }
    const arg = s && s.edit && s.all ? { t:text, all:1 } : s && s.edit && s.text ? { t:text, r:s.text } : { t:text };
    let r = null; try { r = await PT(t, "x-type", JSON.stringify(arg), 5000); } catch (e) {}
    if (r && r.ok) toast("✍️ Done"); else { send("clip", text); toast(r && r.why === "none" ? "Click in the box first. The text is copied, so you can paste it too." : "Couldn't put it on the page, so it's copied instead: paste it with Ctrl+V"); }
  }, 250);
}
const app = { ctx, sel, insert, copy:t => send("clip", t), save:(n, t) => send("save-text", n, String(t).replace(/\r?\n/g, "\r\n")) };
AI.saveFile = app.save;

function toolPanel(tool) {
  const p = el("div", "xpane aip aitp");
  p.innerHTML = '<div class="xhead"><div class="xic"></div><div><b></b><span></span></div></div><div class="aib"></div>';
  p.querySelector(".xic").textContent = tool.icon; p.querySelector(".xhead b").textContent = tool.name; p.querySelector(".xhead span").textContent = tool.sub || "";
  const n = openOver("aitool", p); n.style.right = "8px";
  grow(p, "aitool");
  p.addEventListener("click", e => { const a = e.target.closest("a[data-href]"); if (a) { e.preventDefault(); closeOver(); newTab(a.dataset.href, false); } });
  const body = p.querySelector(".aib");
  if (tool.id === "picture" && picked) { const im = el("div", "ait-pic"); const i = new Image(); i.src = picked.url || picked.data; i.alt = picked.alt || ""; im.appendChild(i); body.appendChild(im); }
  const box = el("div"); body.appendChild(box);
  return A.mount(box, tool, app);
}
// "Describe a picture": first you click one on the page, then the panel opens with it
async function pickPicture() {
  const t = webT(); if (!t) { toast("Open a page with the picture first"); return; }
  closeOver(); toast("🖼️ Click the picture on the page (Esc to cancel)");
  let r = null; try { r = await PT(t, "x-pickimg", "", 65000); } catch (e) {}
  if (!r || r.none) { if (r && r.why === "none") toast("There are no pictures on this page"); else if (r && r.why === "locked") toast("This page doesn't let its pictures be read"); return; }
  picked = r.u ? { url:r.u, alt:r.alt } : { data:r.data, alt:r.alt };
  const h = toolPanel(A.byId("picture")); h.run();
}
function open(id) {
  if (id === "picture") { pickPicture(); return; }
  if (id === "prompts") { promptsPanel(); return; }
  const tool = /^p:/.test(id) ? (A.prompts().map(A.promptTool).find(t => t.id === id) || null) : A.byId(id);
  if (!tool) return;
  if (!AI.ready()) { toast("Open Web AI once to connect it first"); return; }
  toolPanel(tool);
}
function promptsPanel() {
  const p = el("div", "xpane aip aitp");
  p.innerHTML = '<div class="xhead"><div class="xic">⭐</div><div><b>Your prompts</b><span>Write a prompt once, then run it with one click from More from Web AI</span></div></div><div class="aib"></div>';
  const n = openOver("aiprompts", p); n.style.right = "8px";
  grow(p, "aiprompts");
  A.promptsEditor(p.querySelector(".aib"));
}
const PC = t => !t.ios;        // every tool works on the PC
X3.aiMoreRows = m => {
  const add = (icon, name, fn) => { const r = el("div", "mi"); r.innerHTML = '<span class="aie"></span><span></span>'; r.firstChild.textContent = icon; r.lastChild.textContent = name; r.onclick = () => { closeOver(); fn(); }; m.appendChild(r); };
  A.GROUPS.forEach(g => { m.appendChild(el("div", "aigk", esc(g))); A.TOOLS.filter(t => t.g === g && PC(t)).forEach(t => add(t.icon, t.name, () => open(t.id))); });
  m.appendChild(el("div", "aigk", "Your prompts"));
  A.prompts().forEach(p => add("⭐", p.name, () => open("p:" + p.id)));
  add("✎", A.prompts().length ? "Edit your prompts…" : "Make your own prompt…", promptsPanel);
};
X3.aiTools = { open, toolPanel, pickPicture, app, picked:() => picked, setPicked:p => { picked = p; } };
const commandsT = commands;
commands = function () { return commandsT().concat(A.TOOLS.map(t => ({ t:"Web AI: " + t.name.toLowerCase().replace(/^\w/, c => c.toUpperCase()), k:"", i:"sparkle", fn:() => open(t.id) })), A.prompts().map(p => ({ t:"Web AI: " + p.name, k:"", i:"sparkle", fn:() => open("p:" + p.id) })), [{ t:"Web AI: your prompts", k:"", i:"sparkle", fn:promptsPanel }]); };

/* ---------------------------------------------------------------- #049 questions left today, on the Web AI button */
const badge = el("i", "aileft");
function paintLeft() {
  const b = $("#aib"); if (!b) return;
  if (!badge.isConnected) b.appendChild(badge);
  const n = AI.left();
  badge.hidden = n == null; badge.textContent = n == null ? "" : n > 99 ? "99+" : String(n);
  badge.classList.toggle("low", n != null && n <= 3);
  b.title = "Web AI  (Alt+Shift+A)" + (n == null ? "" : " · " + n + " question" + (n === 1 ? "" : "s") + " left today");
}
addEventListener("storage", e => { if (e.key === "wsb.xai") paintLeft(); });
const askA = AI.ask;
AI.ask = function () { const p = askA.apply(this, arguments); p.then(paintLeft, paintLeft); return p; };
setTimeout(() => { if (AI.ready()) AI.check().then(paintLeft); else paintLeft(); }, 4000);
setInterval(() => { if (AI.ready() && !document.hidden) AI.check().then(paintLeft); }, 30 * 60000);
paintLeft();

const st = document.createElement("style");
st.textContent = `
.aitp{width:min(520px,calc(100vw - 32px))}.aitp .aib{max-height:70vh;overflow:auto}.aigk{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);padding:10px 12px 4px}
.ait-pic{margin-bottom:10px}.ait-pic img{max-width:100%;max-height:220px;border-radius:10px;display:block}
#aib{position:relative}.aileft{position:absolute;right:-2px;top:-2px;min-width:14px;height:14px;padding:0 3px;box-sizing:border-box;border-radius:7px;background:var(--bg3);color:var(--dim);font:600 9.5px/14px system-ui,sans-serif;font-style:normal;text-align:center;pointer-events:none}
.aileft.low{background:#e8553a;color:#fff}.aileft[hidden]{display:none}`;
document.head.appendChild(st);
})();
