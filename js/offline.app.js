/* Webs Browser for iPhone 2.9 - offline articles: a page's words kept on the phone, to read with no internet
   (on a plane, in the metro). Menu → Save for offline, or Menu → Offline articles to read them.
   Wikipedia comes from Wikipedia itself; other sites are read by the Web AI server (GET /read), since the app
   can't read the pages it shows. Either way only plain text, headings, lists, links and Wikipedia's pictures are
   kept (the reader view's cleaning), in the phone's own storage. Opening a saved page with no internet opens the
   saved copy. "Keep my reading list offline" saves what you add to the reading list too. */
(function () {
"use strict";
if (PRIVATE) return;
const list = () => load("offline", []) || [];
const setList = l => save("offline", l.slice(0, 200));
const key = id => "off:" + id;
const norm = u => String(u || "").split("#")[0].replace(/\/$/, "");
const find = u => list().find(x => norm(x.u) === norm(u));
const server = () => { for (const s of [(load("xai", {}) || {}).server, (load("xaiConfig", {}) || {}).server, (load("push", {}) || {}).server]) { const a = String(s || "").trim().replace(/\/+$/, ""); if (/^https:\/\/\S+$/.test(a)) return a; } return ""; };
const devId = () => load("xaiDev", "") || "";

async function fetchArticle(u) {
  const m = /^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/.exec(u);
  if (m) {
    const r = await fetch("https://" + m[1] + ".wikipedia.org/api/rest_v1/page/html/" + encodeURIComponent(decodeURIComponent(m[2])));
    if (!r.ok) throw new Error("Wikipedia didn't send the article.");
    return { title:decodeURIComponent(m[2]).replace(/_/g, " "), site:"Wikipedia", html:cleanArticle(await r.text(), m[1]) };
  }
  const s = server();
  if (!s) throw new Error("Open Web AI once first: other sites are read through its server.");
  let r; try { r = await fetch(s + "/read?u=" + encodeURIComponent(u) + "&device=" + encodeURIComponent(devId())); } catch (e) { throw new Error("Can't reach the server. Check your internet connection."); }
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error(j && j.message || "That page couldn't be saved.");
  return { title:j.title, site:j.site, html:cleanArticle(j.html, null) };
}
async function saveOffline(u, title, quiet) {
  if (!/^https?:\/\//i.test(u || "")) { if (!quiet) toast("Open a page first"); return null; }
  if (find(u)) { if (!quiet) toast("Already saved for offline", { label:"Read", fn:() => readOffline(find(u).id) }); return find(u); }
  if (!quiet) toast("Saving for offline…");
  try {
    const a = await fetchArticle(u);
    const words = a.html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (words < 30) throw new Error("There wasn't an article to keep on that page.");
    const id = uid(), e = { id, u, t:title && title !== hostOf(u) ? title : a.title || title || hostOf(u), site:a.site || hostOf(u), ts:Date.now(), words, read:0 };
    await idb.put(key(id), a.html);
    setList([e].concat(list()));
    if (!quiet) toast("📥 Saved for offline · " + Math.max(1, Math.round(words / 230)) + " min read", { label:"Read", fn:() => readOffline(id) });
    return e;
  } catch (e) { if (!quiet) toast(e.message); return null; }
}
async function readOffline(id) {
  const e = list().find(x => x.id === id); if (!e) return;
  let html = null; try { html = await idb.get(key(id)); } catch (x) {}
  if (!html) { toast("That saved page is missing. Save it again."); return; }
  const size = +cfg.readerSize || 18;
  openSheet(e.t, '<div class="rbar"><span class="offtag">📥 Offline · ' + esc(e.site) + '</span><button type="button" class="wbtn" data-rs="-1">A−</button><button type="button" class="wbtn" data-rs="1">A+</button><button type="button" class="wbtn" data-ro="1">' + ico("other") + "</button></div>" +
    '<article id="rd" class="reader' + (cfg.readerSepia ? " sepia" : "") + '" style="font-size:' + size + 'px"><h1>' + esc(e.t) + "</h1>" + html + "</article>", { kind:"offread", full:true, back:offlineSheet });
  $("#sheetBody").onclick = ev => {
    const rs = ev.target.closest("[data-rs]");
    if (rs) { const v = Math.max(14, Math.min(28, (+cfg.readerSize || 18) + 2 * rs.dataset.rs)); setCfg("readerSize", v); $("#rd").style.fontSize = v + "px"; return; }
    if (ev.target.closest("[data-ro]")) { closeSheet(); goOnline(e.u); return; }
    const a = ev.target.closest("#rd a[href]"); if (a) { ev.preventDefault(); closeSheet(); goOnline(a.getAttribute("href")); }
  };
  // where you stopped
  const pos = load("offPos", {}) || {};
  setTimeout(() => { $("#sheetBody").scrollTop = pos[id] || 0; }, 30);
  $("#sheetBody").onscroll = () => { clearTimeout(readOffline.t); readOffline.t = setTimeout(() => { const p = load("offPos", {}) || {}; p[id] = $("#sheetBody").scrollTop; save("offPos", p); }, 400); };
  setList(list().map(x => x.id === id ? Object.assign(x, { read:Date.now() }) : x));
}
async function remove(id) { try { await idb.del(key(id)); } catch (e) {} setList(list().filter(x => x.id !== id)); }
function offlineSheet() {
  const l = list(), t = curTab(), web = t && t.u && !t.internal && /^https?:/.test(t.u);
  openSheet("Offline articles", (web && !find(t.u) ? '<div class="card"><button type="button" class="mrow" id="offSave"><span class="aie">📥</span><span>Save this page for offline</span><em>' + esc(hostOf(t.u)) + "</em></button></div>" : "") +
    '<div class="card">' + (l.length ? l.map(x => '<div class="offrow" data-id="' + x.id + '"><button type="button" class="offo"><b>' + esc(x.t) + "</b><em>" + esc(x.site) + " · " + Math.max(1, Math.round(x.words / 230)) + " min" + (x.read ? "" : " · new") + '</em></button><button type="button" class="offx" aria-label="Delete">' + ico("trash") + "</button></div>").join("")
      : '<p class="dim" style="padding:12px 16px">Nothing saved yet. Open an article, then Menu → Save for offline.</p>') + "</div>" +
    '<div class="card"><label class="mrow lkswr"><span class="aie">📚</span><span>Keep my reading list offline</span><input type="checkbox" id="offRl"' + (cfg.offReading ? " checked" : "") + "></label>" +
    (l.length ? '<button type="button" class="mrow" id="offAll"><span class="aie">🧹</span><span>Delete what I\'ve read</span></button>' : "") + "</div>", { kind:"offline" });
  const sv = $("#offSave"); if (sv) sv.onclick = async () => { closeSheet(); await saveOffline(t.u, t.t); };
  $("#sheetBody").querySelectorAll(".offrow").forEach(r => { r.querySelector(".offo").onclick = () => readOffline(r.dataset.id); r.querySelector(".offx").onclick = async () => { await remove(r.dataset.id); offlineSheet(); }; });
  $("#offRl").onchange = e => { setCfg("offReading", e.target.checked); if (e.target.checked) keepReading(); };
  const all = $("#offAll"); if (all) all.onclick = async () => { for (const x of list().filter(y => y.read)) await remove(x.id); offlineSheet(); };
}
// the reading list, kept offline when that's on
async function keepReading() {
  if (!cfg.offReading || !navigator.onLine) return;
  for (const r of (load("reading", []) || []).filter(x => x && !x.done && /^https?:/.test(x.u || "")).slice(0, 30)) if (!find(r.u)) await saveOffline(r.u, r.t, true);
}
// with no internet, a saved page opens as its saved copy
function goOnline(u) { go(u, { newTab:false }); }
const goO = go;
go = function (input, opts) {
  const u = typeof input === "string" ? input : input && input.u;
  const e = u && !navigator.onLine ? find(u) : null;
  if (e) { readOffline(e.id); toast("You're offline: this is the copy you saved"); return; }
  return goO(input, opts);
};
addEventListener("online", () => setTimeout(keepReading, 3000));
setTimeout(keepReading, 15000);
ACTIONS.offline = offlineSheet; ACTIONS.saveOffline = () => { const t = curTab(); if (t) saveOffline(t.u, t.t); };
const openMenuO = openMenu;
openMenu = function () {
  openMenuO();
  const card = $("#sheetBody .card:last-of-type"), t = curTab(), web = t && t.u && !t.internal;
  if (card) card.insertAdjacentHTML("afterbegin", (web ? '<button type="button" class="mrow" data-act="saveOffline">' + ico("folder") + "<span>Save for offline</span><em>Read it with no internet</em></button>" : "") +
    '<button type="button" class="mrow" data-act="offline">' + ico("book") + "<span>Offline articles</span><em>" + (list().length || "None yet") + "</em></button>");
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.OfflineApp = { saveOffline, readOffline, offlineSheet, list, keepReading, remove };
const st = document.createElement("style");
st.textContent = ".offtag{flex:1;font-size:13px;color:var(--dim)}.offrow{display:flex;align-items:center;border-bottom:1px solid var(--line)}.offrow:last-child{border:0}" +
  ".offo{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:0;background:none;color:var(--fg);font:inherit;text-align:left;padding:12px 16px}" +
  ".offo b{font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.offo em{font-style:normal;font-size:13px;color:var(--dim)}.offx{border:0;background:none;color:var(--dim);padding:12px 16px}";
document.head.appendChild(st);
})();
