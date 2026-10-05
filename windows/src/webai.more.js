/* ---------------------------------------------------------------- Webs 3.10: more from Web AI (../../js/ai.js)
   - The address bar: a question gets Web AI's answer right in the dropdown (by itself when it ends with ?,
     or when its row is picked; Enter on the answer opens Web AI to ask more).
   - Key moments of a YouTube video: its captions (the x-yt page tool) become times you click to jump to.
   - Tidy my tabs: Web AI groups your tabs by topic (real tab groups) and says which could go.
   - Compare tabs: the tabs you tick, read and compared in a table.
   - Study this page: flashcards and a quiz.
   - Explain: select a few words on a page and click ✦ Explain beside them (shield.add.js shows it).
   - Find it again: describe a page you saw and Web AI looks through your history's titles and addresses.
   Everything is asked for: nothing goes to Web AI by itself, except an address bar question ending with ?.
   Private windows: none of it. */
(function () {
"use strict";
if (!window.AI) return;
const WT = s => "<page>\nTitle: " + String(s.title || "").slice(0, 300) + "\nAddress: " + String(s.url || "").slice(0, 500) + "\n\n" + String(s.text || "").slice(0, s.max || 14000) + "\n</page>";
const errText = e => e && e.message || "Web AI couldn't answer.";

/* ---------------------------------------------------------------- reading a tab's page (the x-ai page tool), and other page answers */
const waits = {};
function pageTool(t, action, arg, ms) {
  return new Promise((ok, bad) => {
    if (!t || !isWeb(t.url) || t.sleep || t.lazy) { bad(new Error("That tab isn't loaded.")); return; }
    const k = t.id + ":" + action, done = (f, v) => { if (waits[k] !== w) return; delete waits[k]; clearTimeout(w.t); f(v); };
    const w = waits[k] = { ok:v => done(ok, v), t:setTimeout(() => done(bad, new Error("The page didn't answer.")), ms || 9000) };
    send("page-tool", t.id, action, arg || "");
  });
}
const readTab = t => pageTool(t, "x-ai").then(r => ({ title:r.title || t.title || "", url:t.url, text:String(r.t || ""), sel:String(r.sel || "") }));
const onToolResult10 = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  if (r && r.a && waits[id + ":" + r.a]) { waits[id + ":" + r.a].ok(r); return; }
  if (r && r.a === "x-explain") { explain(id, r); return; }
  if (r && r.a === "x-explain-more") { if (X3.webAI) X3.webAI(); return; }
  onToolResult10(id, json);
};

/* ---------------------------------------------------------------- the address bar */
const answers10 = answers;
let askT = 0;
answers = function (q) {
  const out = answers10(q);
  if (PRIVATE || cfg.xAiBar === false || !AI.isQuestion(q)) return out;
  const a = AI.quickGet(q), refresh = qq => { if (overlay === "drop" && $("#url").value.trim() === qq) suggest(); };
  const ask = () => { AI.quick(q, refresh); setTimeout(() => { $("#url").focus(); suggest(); }, 0); };
  if (a && (a.text || a.err)) out.unshift({ u:"ai:" + q, t:a.err ? a.err : AI.plain(a.text), s:a.err ? "Web AI" : "✦ Web AI" + (a.busy ? " · answering…" : " · Enter: ask more in Web AI"), i:"sparkle", wrap:1,
    act:() => { try { localStorage.setItem("wsb.xaiBarQ", JSON.stringify({ q, t:Date.now() })); } catch (e) {} if (X3.webAI) openSide("xai", "bar"); } });
  else if (a && a.busy) out.unshift({ u:"ai:" + q, t:"Web AI is thinking…", s:"✦ Web AI", i:"sparkle", act:() => {} });
  else {
    out.unshift({ u:"ai:" + q, t:"Ask Web AI: " + q, s:/\?$/.test(q) ? "✦ The answer is on its way" : "✦ Enter here for Web AI's answer", i:"sparkle", act:ask });
    // a question that ends with ?: asked by itself once typing stops
    clearTimeout(askT);
    if (/\?$/.test(q)) askT = setTimeout(() => { if ($("#url").value.trim() === q && document.activeElement === $("#url")) { AI.quick(q, refresh); suggest(); } }, 900);
  }
  return out;
};

/* ---------------------------------------------------------------- panels */
function panel(id, icon, title, sub, body) {
  const p = el("div", "xpane aip");
  p.innerHTML = '<div class="xhead"><div class="xic">' + icon + '</div><div><b></b><span></span></div></div><div class="aib"></div>';
  p.querySelector(".xhead b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  if (body) p.querySelector(".aib").appendChild(body);
  const n = openOver(id, p); n.style.right = "8px";
  // links in Web AI's answers open in a new tab
  p.addEventListener("click", e => { const a = e.target.closest("a[data-href]"); if (a) { e.preventDefault(); closeOver(); newTab(a.dataset.href, false); } });
  return p;
}
const busy = (p, text) => { p.querySelector(".aib").innerHTML = '<div class="aiw"><i></i><span></span></div>'; p.querySelector(".aiw span").textContent = text; };
const fail = (p, e) => { p.querySelector(".aib").innerHTML = '<div class="aierr"></div>'; p.querySelector(".aierr").textContent = errText(e); };
const alive = p => p.isConnected;

// key moments of the YouTube video on screen
async function keyMoments() {
  const t = T(active);
  if (PRIVATE || !t || !/^https:\/\/(www\.|m\.)?youtube\.com\/watch/.test(t.url)) { toast("Open a YouTube video first"); return; }
  const p = panel("aiyt", "▶️", "Key moments", "Web AI reads the video's captions. Click a time to jump there.");
  busy(p, "Reading the captions…");
  try {
    const r = await pageTool(t, "x-yt", "", 15000);
    if (!alive(p)) return;
    busy(p, "Web AI is watching…");
    const content = r.none ? WT({ title:r.title, url:t.url, text:"(No captions.) Description:\n" + (r.desc || "") }) : WT({ title:r.title, url:t.url, text:r.t, max:26000 });
    const out = el("div", "ai-md aiym");
    const show = text => {
      out.innerHTML = AI.md(text).replace(/\[(\d{1,2}(?::\d{2}){1,2})\]/g, (m, ts) => '<button class="aits" data-s="' + ts.split(":").reduce((a, b) => a * 60 + +b, 0) + '">' + ts + "</button>");
      if (!out.isConnected && alive(p)) { const b = p.querySelector(".aib"); b.innerHTML = ""; b.appendChild(out); }
    };
    const res = await AI.ask("video", content + "\n\nWhat are this video's key moments?", { onText:show });
    show(res.text);
    out.addEventListener("click", e => { const b = e.target.closest(".aits"); if (b) send("page-tool", t.id, "x-seek", b.dataset.s); });
  } catch (e) { if (alive(p)) fail(p, e); }
}

// tidy my tabs: groups by topic, and the ones that could go
async function tidyTabs() {
  if (PRIVATE) return;
  const list = tabs.filter(t => isWeb(t.url) && !t.pinned);
  if (list.length < 3) { toast("Tidy my tabs needs a few more tabs open"); return; }
  const p = panel("aitidy", "🧹", "Tidy my tabs", "Web AI sees your tabs' titles and addresses (not the pages) and sorts them by topic.");
  busy(p, "Sorting " + list.length + " tabs…");
  const ids = list.map((t, i) => [i + 1, t.id]), byN = Object.fromEntries(ids);
  try {
    const res = await AI.ask("tidy", list.map((t, i) => (i + 1) + " | " + String(t.title || "").replace(/\|/g, "/").slice(0, 120) + " | " + t.url.slice(0, 200)).join("\n") + "\n\nGroup my tabs.");
    if (!alive(p)) return;
    const j = AI.json(res.text) || {};
    const groupsIn = (Array.isArray(j.groups) ? j.groups : []).map(g => ({ name:String(g.name || "Tabs").slice(0, 30), ids:(Array.isArray(g.ids) ? g.ids : []).map(n => byN[n]).filter(Boolean) })).filter(g => g.ids.length);
    const close = (Array.isArray(j.close) ? j.close : []).map(c => ({ id:byN[c.id], why:String(c.why || "").slice(0, 80) })).filter(c => c.id);
    if (!groupsIn.length) throw new Error("Web AI couldn't sort these. Try again.");
    const box = el("div", "aitidy");
    box.innerHTML = groupsIn.map((g, gi) => '<div class="aig"><b></b>' + g.ids.map(id => '<span class="aich" data-id="' + id + '"></span>').join("") + "</div>").join("") +
      (close.length ? '<div class="aik">Could go</div>' + close.map(c => '<label class="aic"><input type="checkbox" checked data-id="' + c.id + '"><span></span><em></em></label>').join("") : "") +
      '<div class="xbtns">' + (close.length ? '<button class="btn2" id="aiClose">Close the ticked tabs</button>' : "") + '<button class="btn2 main" id="aiGroup">Make these groups</button></div>';
    box.querySelectorAll(".aig b").forEach((b, i) => { b.textContent = groupsIn[i].name + " · " + groupsIn[i].ids.length; });
    box.querySelectorAll(".aich").forEach(s => { const t = T(+s.dataset.id); s.textContent = t ? t.title || hostOf(t.url) : "?"; s.title = t ? t.url : ""; });
    box.querySelectorAll(".aic").forEach((l, i) => { const t = T(close[i].id); l.querySelector("span").textContent = t ? t.title || hostOf(t.url) : "?"; l.querySelector("em").textContent = close[i].why; });
    const b = p.querySelector(".aib"); b.innerHTML = ""; b.appendChild(box);
    box.querySelector("#aiGroup").onclick = () => {
      const used = Object.values(groups).map(g => g.color), cols = Object.keys(COLORS).filter(k => !used.includes(k)).concat(Object.keys(COLORS));
      let n = 0;
      groupsIn.forEach((g, i) => {
        const live = g.ids.filter(id => T(id)); if (live.length < 2) return;
        const gid = newGroupId(); groups[gid] = { name:g.name, color:cols[i % cols.length], collapsed:false };
        live.forEach(id => addToGroup(id, gid)); n++;
      });
      saveGroups(); renderTabs(); saveSession(); closeOver();
      toast(n ? n + " tab group" + (n === 1 ? "" : "s") + " made" : "Nothing to group");
    };
    const cb = box.querySelector("#aiClose");
    if (cb) cb.onclick = () => { const go = [...box.querySelectorAll(".aic input:checked")].map(i => +i.dataset.id).filter(id => T(id)); go.forEach(closeTab); closeOver(); toast("Closed " + go.length + " tab" + (go.length === 1 ? "" : "s")); };
  } catch (e) { if (alive(p)) fail(p, e); }
}

// compare the tabs you tick
function compareTabs() {
  if (PRIVATE) return;
  const list = tabs.filter(t => isWeb(t.url));
  if (list.length < 2) { toast("Open two or more pages to compare, like two products"); return; }
  const pick = el("div", "aipick");
  const order = [T(active)].concat(list.filter(t => t.id !== active)).filter(t => t && isWeb(t.url));
  pick.innerHTML = '<div class="aik">Tick the tabs to compare (two to five)</div>' + order.map((t, i) => '<label class="aic"><input type="checkbox" data-id="' + t.id + '"' + (i < 3 ? " checked" : "") + "><span></span><em></em></label>").join("") +
    '<div class="xbtns"><button class="btn2 main" id="aiCmp">Compare</button></div>';
  pick.querySelectorAll(".aic").forEach((l, i) => { l.querySelector("span").textContent = order[i].title || hostOf(order[i].url); l.querySelector("em").textContent = hostOf(order[i].url) + (order[i].sleep || order[i].lazy ? " · asleep: click its tab first" : ""); });
  const p = panel("aicmp", "⚖️", "Compare tabs", "Web AI reads the pages you tick and puts them side by side.", pick);
  pick.querySelector("#aiCmp").onclick = async () => {
    const chosen = [...pick.querySelectorAll("input:checked")].map(i => T(+i.dataset.id)).filter(Boolean).slice(0, 5);
    if (chosen.length < 2) { toast("Tick at least two tabs"); return; }
    busy(p, "Reading " + chosen.length + " pages…");
    try {
      const pages = [];
      for (const t of chosen) { try { pages.push(await readTab(t)); } catch (e) {} }
      if (pages.length < 2) throw new Error("Couldn't read enough of those pages. Click each tab once so it loads, then try again.");
      if (!alive(p)) return;
      busy(p, "Comparing…");
      const per = Math.floor(26000 / pages.length), out = el("div", "ai-md");
      const show = text => { out.innerHTML = AI.md(text); if (!out.isConnected && alive(p)) { const b = p.querySelector(".aib"); b.innerHTML = ""; b.appendChild(out); } };
      const res = await AI.ask("compare", pages.map(x => WT(Object.assign({ max:per }, x))).join("\n\n") + "\n\nCompare these.", { onText:show });
      show(res.text);
    } catch (e) { if (alive(p)) fail(p, e); }
  };
}

// study this page: flashcards and a quiz
async function studyPage() {
  const t = T(active);
  if (PRIVATE || !t || !isWeb(t.url)) { toast("Open a page to study first"); return; }
  const p = panel("aistudy", "🎓", "Study this page", "Flashcards and a quiz, made by Web AI from this page.");
  busy(p, "Reading the page…");
  try {
    const pg = await readTab(t);
    if (!alive(p)) return;
    busy(p, "Making flashcards and a quiz…");
    const res = await AI.ask("study", WT(pg) + "\n\nMake study cards and a quiz.");
    if (!alive(p)) return;
    const j = AI.json(res.text);
    if (!j) throw new Error("Web AI's cards didn't come out right. Try again.");
    const box = el("div"), b = p.querySelector(".aib"); b.innerHTML = ""; b.appendChild(box);
    AI.study(box, j);
  } catch (e) { if (alive(p)) fail(p, e); }
}

// Explain, from the bubble on the page: the answer goes back to the same bubble, a little at a time
async function explain(id, r) {
  const t = T(id), reply = o => send("page-tool", id, "x-explain-show", JSON.stringify(o));
  if (!t || PRIVATE) { reply({ err:"Web AI doesn't read pages in private windows." }); return; }
  let last = 0;
  try {
    const res = await AI.ask("explain", WT({ title:r.title || t.title, url:t.url, text:String(r.ctx || "").slice(0, 3000) }) + "\n\n<selection>\n" + String(r.sel || "").slice(0, 1500) + "\n</selection>\n\nExplain this.",
      { onText:x => { if (Date.now() - last > 250) { last = Date.now(); reply({ t:AI.plain(x), more:1 }); } } });
    reply({ t:AI.plain(res.text) });
  } catch (e) { reply({ err:errText(e) }); }
}
const applyPage10 = applyPage;
applyPage = function (t) { applyPage10(t); if (t && isWeb(t.url)) send("page-tool", t.id, "x-explain-on", !PRIVATE && cfg.xExplain !== false ? "1" : "0"); };

// find it again: a page you saw, from what you remember about it
function findAgain() {
  if (PRIVATE) return;
  const box = el("div", "aifind");
  box.innerHTML = '<input class="xin" placeholder="e.g. that pasta recipe with lemon, last week" maxlength="300"><div class="xbtns"><button class="btn2 main">Find it</button></div>' +
    '<div class="xsmall">Web AI looks through the titles and addresses of the last 400 pages in your history (not the pages themselves).</div><div class="aires"></div>';
  const p = panel("aifind", "🔎", "Find it again", "Describe a page you saw, and Web AI finds it in your history.", box);
  const inp = box.querySelector("input"), res = box.querySelector(".aires");
  setTimeout(() => inp.focus(), 50);
  const go = async () => {
    const q = inp.value.trim(); if (!q) return;
    const lines = AI.historyLines(hist, 400);
    if (!lines.length) { res.textContent = "Your history is empty."; return; }
    res.innerHTML = '<div class="aiw"><i></i><span>Looking…</span></div>';
    try {
      const r = await AI.ask("find", "History:\n" + lines.map(x => x.line).join("\n") + "\n\nI'm looking for: " + q);
      if (!alive(p)) return;
      const hits = ((AI.json(r.text) || {}).hits || []).map(h => ({ x:lines[+h.n - 1], why:String(h.why || "") })).filter(h => h.x);
      res.innerHTML = hits.length ? "" : '<div class="xsmall">Nothing in your history matches that. Try other words.</div>';
      hits.forEach(h => { const r2 = linkRow(h.x.h.u, h.x.h.t || h.x.h.u, hostOf(h.x.h.u) + (h.why ? " · " + h.why : ""), () => { closeOver(); go2(h.x.h.u); }); res.appendChild(r2); });
    } catch (e) { res.innerHTML = '<div class="aierr"></div>'; res.querySelector(".aierr").textContent = errText(e); }
  };
  const go2 = u => newTab(u, false);
  box.querySelector("button").onclick = go;
  inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
}

/* ---------------------------------------------------------------- where to find them */
function morePanel() {
  const t = T(active), yt = t && /^https:\/\/(www\.|m\.)?youtube\.com\/watch/.test(t.url);
  const m = el("div", "xpane aimore");
  m.innerHTML = '<div class="xhead"><div class="xic">✦</div><div><b>More from Web AI</b><span>Each one asks Web AI when you click it.</span></div></div>';
  [yt ? ["▶️", "Key moments of this video", keyMoments] : null, ["🎓", "Study this page", studyPage], ["⚖️", "Compare tabs…", compareTabs], ["🧹", "Tidy my tabs", tidyTabs], ["🔎", "Find it again…", findAgain]]
    .filter(Boolean).forEach(([e, n, fn]) => { const r = el("div", "mi"); r.innerHTML = '<span class="aie">' + e + "</span><span></span>"; r.lastChild.textContent = n; r.onclick = () => { closeOver(); fn(); }; m.appendChild(r); });
  const n = openOver("aimore", m); n.style.right = "8px";
}
X3.ai = { keyMoments, tidyTabs, compareTabs, studyPage, findAgain, morePanel, readTab, explain };
const menuRows10 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows10) menuRows10(m);
  if (!PRIVATE) m.appendChild(row("sparkle", "More from Web AI…", "", morePanel));
};
const commands10 = commands;
commands = function () {
  return commands10().concat(PRIVATE ? [] : [
    { t:"Web AI: key moments of this YouTube video", k:"", i:"sparkle", fn:keyMoments },
    { t:"Web AI: study this page (flashcards and a quiz)", k:"", i:"sparkle", fn:studyPage },
    { t:"Web AI: compare tabs", k:"", i:"sparkle", fn:compareTabs },
    { t:"Web AI: tidy my tabs", k:"", i:"sparkle", fn:tidyTabs },
    { t:"Web AI: find it again in my history", k:"", i:"sparkle", fn:findAgain }
  ]);
};

const st = document.createElement("style");
st.textContent = `
.aip{width:520px}.aip .aib{font-size:13px;line-height:1.5}.aiw{display:flex;align-items:center;gap:10px;padding:14px 4px;color:var(--dim)}
.aiw i{width:16px;height:16px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:aiSpin .8s linear infinite}@keyframes aiSpin{to{transform:rotate(1turn)}}
.aierr{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#e8342a 14%,transparent);color:var(--fg)}
.aits{border:0;background:var(--accent);color:#fff;border-radius:6px;padding:0 6px;font:600 12px Consolas,ui-monospace,monospace;cursor:pointer;margin-right:2px}.aits:hover{filter:brightness(1.15)}
.aig{margin:0 0 10px}.aig b{display:block;font-size:12.5px;margin-bottom:5px}.aich{display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top;margin:0 5px 5px 0;padding:3px 9px;border-radius:999px;background:var(--bg3);font-size:12px}
.aik{font-size:12px;font-weight:600;margin:10px 0 4px}.aic{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px}.aic span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aic em{font-style:normal;color:var(--dim);font-size:11.5px;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aic input{accent-color:var(--accent)}.aifind .xin{margin-top:0}.aires{margin-top:8px}.aimore{width:330px}.aimore .mi{cursor:pointer}.aie{width:20px;text-align:center}
`;
document.head.appendChild(st);
})();
