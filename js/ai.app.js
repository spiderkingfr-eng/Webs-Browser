/* Webs Browser for iPhone - more from Web AI (2.9, js/ai.js): answers in the address bar (by themselves when a
   question ends with ?), and Menu → More from Web AI: study this page (flashcards and a quiz), compare tabs,
   tidy my tabs, find it again in your history. The app can't read the pages it shows, so for a page Web AI
   gets its address and opens it itself. Nothing in private browsing. */
(function () {
"use strict";
if (!window.AI) return;
const errText = e => e && e.message || "Web AI couldn't answer.";
const pageOf = t => "<page>\nTitle: " + String(t.t || hostOf(t.u)).slice(0, 300) + "\nAddress: " + t.u.slice(0, 500) + "\n</page>";
const webTabs = () => (T.n.list || []).filter(t => t.u && !t.internal && /^https?:/i.test(t.u));

/* ---------------------------------------------------------------- the address bar */
const answers9 = answers;
let askT = 0;
answers = function (q) {
  const out = answers9(q);
  if (PRIVATE || cfg.aiBar === false || !AI.isQuestion(q)) return out;
  const a = AI.quickGet(q), upd = qq => onAnswerReady(qq);
  if (a && (a.text || a.err)) out.unshift({ t:a.err || AI.plain(a.text), s:a.err ? "Web AI" : "✦ Web AI" + (a.busy ? " · answering…" : " · Tap to ask more"), wrap:1, act:a.err ? null : () => WebAI.ask(q) });
  else if (a && a.busy) out.unshift({ t:"Web AI is thinking…", s:"✦ Web AI" });
  else {
    out.unshift({ t:"Ask Web AI: " + q, s:/\?$/.test(q) ? "✦ The answer is on its way" : "✦ Tap for Web AI's answer", act:() => { AI.quick(q, upd); setTimeout(() => { openOmni(q); omniRender(); }, 60); } });
    clearTimeout(askT);
    if (/\?$/.test(q)) askT = setTimeout(() => { if ($("#q").value.trim() === q) { AI.quick(q, upd); omniRender(); } }, 900);
  }
  return out;
};

/* ---------------------------------------------------------------- More from Web AI */
function sheet(title, lead) {
  openSheet(title, '<p class="ailead"></p><div class="aibody"></div>', { back:openMore });
  $("#sheetBody .ailead").textContent = lead;
  return $("#sheetBody .aibody");
}
const busy = (b, t) => { b.innerHTML = '<div class="aiw"><i></i><span></span></div>'; b.querySelector("span").textContent = t; };
const fail = (b, e) => { b.innerHTML = '<p class="aierr"></p>'; b.querySelector(".aierr").textContent = errText(e); };
async function study() {
  const t = curTab();
  if (PRIVATE || !t || !t.u || t.internal) { toast("Open a page to study first"); return; }
  const b = sheet("Study this page", "Flashcards and a quiz, made by Web AI from this page.");
  busy(b, "Web AI is reading the page…");
  try {
    const r = await AI.ask("study", pageOf(t) + "\n\nMake study cards and a quiz from this page.", { web:true });
    const j = AI.json(r.text); if (!j) throw new Error("Web AI's cards didn't come out right. Try again.");
    if (!b.isConnected) return;
    b.innerHTML = ""; const box = document.createElement("div"); b.appendChild(box); AI.study(box, j);
  } catch (e) { if (b.isConnected) fail(b, e); }
}
function compare() {
  if (PRIVATE) return;
  const list = webTabs();
  if (list.length < 2) { toast("Open two or more pages to compare, like two products"); return; }
  const b = sheet("Compare tabs", "Web AI opens the pages you tick (up to four) and puts them side by side.");
  b.innerHTML = list.map((t, i) => '<label class="aic"><input type="checkbox" data-i="' + i + '"' + (i < 3 ? " checked" : "") + '><span></span></label>').join("") + '<button type="button" class="btn main aigo">Compare</button>';
  b.querySelectorAll(".aic span").forEach((s, i) => { s.textContent = list[i].t || hostOf(list[i].u); });
  b.querySelector(".aigo").onclick = async () => {
    const chosen = [...b.querySelectorAll("input:checked")].map(i => list[+i.dataset.i]).slice(0, 4);
    if (chosen.length < 2) { toast("Tick at least two"); return; }
    busy(b, "Web AI is reading " + chosen.length + " pages…");
    try {
      const out = document.createElement("div"); out.className = "ai-md";
      const show = x => { out.innerHTML = AI.md(x); if (!out.isConnected && b.isConnected) { b.innerHTML = ""; b.appendChild(out); } };
      const r = await AI.ask("compare", chosen.map(pageOf).join("\n\n") + "\n\nOpen these pages and compare them.", { web:true, onText:show });
      show(r.text);
    } catch (e) { if (b.isConnected) fail(b, e); }
  };
}
async function tidy() {
  if (PRIVATE) return;
  const list = webTabs();
  if (list.length < 3) { toast("Tidy my tabs needs a few more tabs open"); return; }
  const b = sheet("Tidy my tabs", "Web AI sees your tabs' titles and addresses (not the pages) and sorts them by topic.");
  busy(b, "Sorting " + list.length + " tabs…");
  try {
    const r = await AI.ask("tidy", list.map((t, i) => (i + 1) + " | " + String(t.t || "").replace(/\|/g, "/").slice(0, 120) + " | " + t.u.slice(0, 200)).join("\n") + "\n\nGroup my tabs.");
    const j = AI.json(r.text) || {}, at = n => list[+n - 1];
    const gs = (j.groups || []).map(g => ({ name:String(g.name || "Tabs").slice(0, 30), tabs:(g.ids || []).map(at).filter(Boolean) })).filter(g => g.tabs.length);
    const close = (j.close || []).map(c => ({ t:at(c.id), why:String(c.why || "").slice(0, 80) })).filter(c => c.t);
    if (!gs.length) throw new Error("Web AI couldn't sort these. Try again.");
    if (!b.isConnected) return;
    b.innerHTML = gs.map(g => '<div class="aig"><b></b>' + g.tabs.map(() => "<span></span>").join("") + "</div>").join("") +
      (close.length ? '<h4 class="aik">Could go</h4>' + close.map(() => '<label class="aic"><input type="checkbox" checked><span></span><em></em></label>').join("") + '<button type="button" class="btn main aigo">Close the ticked tabs</button>' : "");
    b.querySelectorAll(".aig").forEach((d, i) => { d.querySelector("b").textContent = gs[i].name + " · " + gs[i].tabs.length; d.querySelectorAll("span").forEach((s, k) => { s.textContent = gs[i].tabs[k].t || hostOf(gs[i].tabs[k].u); }); });
    b.querySelectorAll(".aic").forEach((l, i) => { l.querySelector("span").textContent = close[i].t.t || hostOf(close[i].t.u); l.querySelector("em").textContent = close[i].why; });
    const go = b.querySelector(".aigo");
    if (go) go.onclick = () => { const ids = [...b.querySelectorAll(".aic input")].map((x, i) => x.checked ? close[i].t.id : null).filter(Boolean); ids.forEach(id => closeTab(id)); closeSheet(); toast("Closed " + ids.length + " tab" + (ids.length === 1 ? "" : "s")); };
  } catch (e) { if (b.isConnected) fail(b, e); }
}
function find() {
  if (PRIVATE) return;
  const b = sheet("Find it again", "Describe a page you saw, and Web AI looks through your history's titles and addresses (not the pages) to find it.");
  b.innerHTML = '<div class="card"><input class="aiq" placeholder="e.g. that pasta recipe with lemon" maxlength="300" enterkeyhint="search"></div><button type="button" class="btn main aigo">Find it</button><div class="aires"></div>';
  const inp = b.querySelector(".aiq"), res = b.querySelector(".aires");
  const search = async () => {
    const q = inp.value.trim(); if (!q) return;
    const lines = AI.historyLines(load("history", []), 400);
    if (!lines.length) { res.textContent = "Your history is empty."; return; }
    busy(res, "Looking…");
    try {
      const r = await AI.ask("find", "History:\n" + lines.map(x => x.line).join("\n") + "\n\nI'm looking for: " + q);
      const hits = ((AI.json(r.text) || {}).hits || []).map(h => ({ x:lines[+h.n - 1], why:String(h.why || "") })).filter(h => h.x);
      res.innerHTML = hits.length ? "" : '<p class="aismall">Nothing in your history matches that. Try other words.</p>';
      hits.forEach(h => { const a = document.createElement("button"); a.type = "button"; a.className = "aihit"; a.innerHTML = "<b></b><span></span>"; a.querySelector("b").textContent = h.x.h.t || h.x.h.u; a.querySelector("span").textContent = hostOf(h.x.h.u) + (h.why ? " · " + h.why : ""); a.onclick = () => { closeSheet(); go2(h.x.h.u); }; res.appendChild(a); });
    } catch (e) { fail(res, e); }
  };
  const go2 = u => go(u);       // the app's own go: open the page
  b.querySelector(".aigo").onclick = search;
  inp.addEventListener("keydown", e => { if (e.key === "Enter") search(); });
}
function openMore() {
  const t = curTab(), web = !!(t && t.u) && !t.internal;
  const r = (act, e, n, s) => '<button type="button" class="mrow" data-ai="' + act + '"><span class="aie">' + e + "</span><span>" + n + "</span><em>" + s + "</em></button>";
  openSheet("More from Web AI", '<p class="ailead">Each one asks Web AI when you tap it.</p><div class="card">' + (web ? r("study", "🎓", "Study this page", "Flashcards and a quiz") : "") +
    r("compare", "⚖️", "Compare tabs", "Side by side") + r("tidy", "🧹", "Tidy my tabs", "By topic") + r("find", "🔎", "Find it again", "In your history") + "</div>");
  $("#sheetBody").querySelectorAll("[data-ai]").forEach(b => { b.onclick = () => ({ study, compare, tidy, find })[b.dataset.ai](); });
}
ACTIONS.aimore = openMore;
const openMenu9 = openMenu;
openMenu = function () {
  openMenu9();
  const w = $('#sheetBody .mrow[data-act="webai"]');
  if (w && !PRIVATE) w.insertAdjacentHTML("afterend", '<button type="button" class="mrow" data-act="aimore">' + ico("sparkle") + "<span>More from Web AI</span><em>Study, compare, tidy, find</em></button>");
};
window.AIApp = { study, compare, tidy, find, openMore };

const st = document.createElement("style");
st.textContent = ".ailead{color:var(--dim);font-size:14.5px;line-height:1.45;margin:0 4px 12px}.aibody{font-size:15px;line-height:1.5}.aiw{display:flex;align-items:center;gap:10px;padding:16px 4px;color:var(--dim)}" +
  ".aiw i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:aiSpin .8s linear infinite}@keyframes aiSpin{to{transform:rotate(1turn)}}" +
  ".aierr{padding:12px;border-radius:12px;background:color-mix(in srgb,#e8342a 14%,transparent)}.aic{display:flex;align-items:center;gap:10px;padding:8px 4px;font-size:15px}.aic span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".aic em{font-style:normal;color:var(--dim);font-size:12.5px;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aic input{width:20px;height:20px;accent-color:var(--accent)}.aigo{width:100%;margin-top:12px}" +
  ".aig{margin:0 0 12px}.aig b{display:block;margin-bottom:6px}.aig span{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:var(--bg3);font-size:13px}" +
  ".aiq{width:100%;height:44px;border:0;background:none;color:var(--fg);font:inherit;font-size:16px;padding:0 12px}.aires{margin-top:12px}.aihit{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:12px;background:var(--bg2);color:var(--fg);font:inherit;margin-bottom:6px}" +
  ".aihit span{color:var(--dim);font-size:13px}.aie{width:24px;text-align:center;font-size:18px}.aik{margin:14px 0 6px}";
document.head.appendChild(st);
})();
