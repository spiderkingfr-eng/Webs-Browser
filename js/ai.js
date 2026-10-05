/* Webs Browser - Web AI's helpers for its newer jobs (Windows 3.10, iPhone 2.9), shared by both apps. They use
   the same Web AI server, code and device id as the Web AI chat (wsb.xai, wsb.xaiConfig, wsb.xaiDev), and send
   "Your instructions" (wsb.xai.prefs, set in Web AI's settings) with every question.
   AI.ask(task, content, opt)  one question for a job (server/web-ai/worker.js TASKS): the address bar's answer,
                               a video's key moments, tidying tabs, comparing pages, study cards, explaining a
                               selection, finding a page in the history. opt: onText(textSoFar), signal, web
   AI.json(text)               the JSON in an answer (in a ```json block or not), or null
   AI.md(text)                 an answer as HTML (escaped first): paragraphs, lists, tables, bold, code, links
   AI.isQuestion(q)            looks like a question to Web AI rather than a search
   AI.quick(q, onUpdate)       the address bar's answer for q, asked once and kept for a while
   AI.study(el, data)          flashcards and a quiz from AI.ask("study", …)
   AI.historyLines(list)       history entries ({ u, t, ts }) as the numbered lines the find job reads */
(function () {
"use strict";
if (window.AI) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const st = () => get("xai", {}) || {};
const server = () => String(st().server || (get("xaiConfig", {}) || {}).server || "").trim().replace(/\/+$/, "");
const shared = () => String((get("xaiConfig", {}) || {}).code || "").trim();
const codeToSend = () => st().code || (st().open ? "" : shared());
function dev() {
  let d = get("xaiDev", ""); if (/^[A-Za-z0-9]{20,40}$/.test(d)) return d;
  const a = new Uint8Array(15); crypto.getRandomValues(a); d = [...a].map(b => b.toString(16).padStart(2, "0")).join(""); put("xaiDev", d); return d;
}
const prefs = () => String(st().prefs || "").slice(0, 600);
const setPrefs = v => put("xai", Object.assign(st(), { prefs:String(v || "").slice(0, 600) }));

async function ask(task, content, opt) {
  opt = opt || {};
  if (!server()) throw new Error("Web AI isn't connected yet: open Web AI once, and it connects by itself.");
  let r;
  try {
    r = await fetch(server() + "/chat", { method:"POST", headers:{ "content-type":"application/json" }, signal:opt.signal,
      body:JSON.stringify({ code:codeToSend(), device:dev(), task, prefs:prefs(), web:!!opt.web, messages:opt.messages || [{ role:"user", content:String(content || "") }] }) });
  } catch (e) { if (e && e.name === "AbortError") throw e; throw new Error("Can't reach Web AI. Check your internet connection."); }
  if (!r.ok || !r.body) {
    let j = null; try { j = await r.json(); } catch (e) {}
    if (j && typeof j.left === "number") put("xai", Object.assign(st(), { left:j.left }));
    throw Object.assign(new Error(j && j.message || "Web AI couldn't answer (error " + r.status + ")."), { kind:j && j.error || "" });
  }
  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", end = null;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream:true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let o = null; try { o = JSON.parse(line); } catch (e) { continue; }
      if (o.d) { text += o.d; if (opt.onText) opt.onText(text); }
      else if (o.end) end = o;
      else if (o.error) throw Object.assign(new Error(o.message || "Web AI stopped."), { kind:o.error });
    }
  }
  if (!end) throw new Error("The answer was cut off. Try again.");
  if (typeof end.left === "number") put("xai", Object.assign(st(), { left:end.left }));
  if (end.stop === "refusal") throw new Error("Web AI can't help with that one.");
  if (!text) throw new Error("Web AI didn't answer that. Try again.");
  return { text, stop:end.stop, left:end.left };
}
function json(text) {
  text = String(text || "");
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text), s = m ? m[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ---------------------------------------------------------------- Markdown, small: what Web AI's answers use */
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (x, t, u) => '<a href="' + u.replace(/"/g, "%22") + '" data-href="' + u.replace(/"/g, "%22") + '" target="_blank" rel="noopener">' + t + "</a>");
}
function md(text) {
  const L = String(text || "").replace(/\r/g, "").split("\n"), out = [];
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (/^```/.test(l)) { const code = []; i++; while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]); out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(cells(L[i++]));
      i--;
      out.push('<div class="ai-tw"><table><thead><tr>' + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + rows.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l); if (h) { out.push("<h4>" + inline(h[2]) + "</h4>"); continue; }
    if (/^\s*[-*+]\s+/.test(l)) { const items = []; while (i < L.length && /^\s*[-*+]\s+/.test(L[i])) items.push("<li>" + inline(L[i++].replace(/^\s*[-*+]\s+/, "")) + "</li>"); i--; out.push("<ul>" + items.join("") + "</ul>"); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const items = []; while (i < L.length && /^\s*\d+[.)]\s+/.test(L[i])) items.push("<li>" + inline(L[i++].replace(/^\s*\d+[.)]\s+/, "")) + "</li>"); i--; out.push("<ol>" + items.join("") + "</ol>"); continue; }
    if (l.trim()) out.push("<p>" + inline(l) + "</p>");
  }
  return out.join("");
}

/* ---------------------------------------------------------------- the address bar */
const QWORDS = /^(who|what|whats|what's|why|how|when|where|which|whose|is|are|was|were|can|could|does|do|did|should|would|will|explain|tell me|define|describe|give me|name)\b/i;
const isQuestion = q => { q = String(q || "").trim(); return q.length >= 8 && q.length <= 300 && !/^[a-z][a-z0-9+.-]*:\/?\//i.test(q) && (/\?$/.test(q) || (QWORDS.test(q) && q.split(/\s+/).length >= 4)); };
const answers = new Map();       // q -> { text, busy, err, at }
function quick(q, onUpdate) {
  q = String(q || "").trim();
  const k = q.toLowerCase(), have = answers.get(k);
  if (have && (have.busy || have.text) && Date.now() - have.at < 30 * 60000) return have;
  const a = { text:"", busy:true, err:"", at:Date.now() };
  answers.set(k, a);
  if (answers.size > 30) answers.delete(answers.keys().next().value);
  ask("answer", q, { onText:t => { a.text = t; if (onUpdate) onUpdate(q, a); } })
    .then(r => { a.text = r.text; a.busy = false; if (onUpdate) onUpdate(q, a); })
    .catch(e => { a.busy = false; a.err = e.message; if (onUpdate) onUpdate(q, a); });
  return a;
}
const quickGet = q => answers.get(String(q || "").trim().toLowerCase()) || null;
const plain = t => String(t || "").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();

/* ---------------------------------------------------------------- study: flashcards and a quiz */
function study(el, data) {
  const cards = (data && Array.isArray(data.cards) ? data.cards : []).filter(c => c && c.q && c.a).slice(0, 20);
  const quiz = (data && Array.isArray(data.quiz) ? data.quiz : []).filter(x => x && x.q && Array.isArray(x.opts) && x.opts.length >= 2 && x.a >= 0 && x.a < x.opts.length).slice(0, 10);
  let mode = cards.length ? "cards" : "quiz", ci = 0, flip = false, qi = 0, right = 0, picked = -1;
  const paint = () => {
    el.className = "ai-study";
    let h = '<div class="ai-seg"><button type="button" data-m="cards"' + (mode === "cards" ? ' class="on"' : "") + ">Flashcards (" + cards.length + ')</button><button type="button" data-m="quiz"' +
      (mode === "quiz" ? ' class="on"' : "") + ">Quiz (" + quiz.length + ")</button></div>";
    if (mode === "cards" && cards.length) {
      const c = cards[ci];
      h += '<button type="button" class="ai-card' + (flip ? " flip" : "") + '"><span class="ai-f">' + inline(c.q) + '</span><span class="ai-b">' + inline(c.a) + "</span></button>" +
        '<div class="ai-nav"><button type="button" data-n="-1">‹ Back</button><span>' + (ci + 1) + " of " + cards.length + ' · tap the card to turn it</span><button type="button" data-n="1">Next ›</button></div>';
    } else if (mode === "quiz" && quiz.length) {
      if (qi >= quiz.length) h += '<div class="ai-done"><b>' + right + " of " + quiz.length + "</b><span>" + (right === quiz.length ? "Perfect! 🎉" : right >= quiz.length / 2 ? "Nicely done." : "Have another look at the cards.") + '</span><button type="button" class="ai-again">Try again</button></div>';
      else {
        const x = quiz[qi];
        h += '<div class="ai-q"><b>' + (qi + 1) + ". " + inline(x.q) + "</b>" + x.opts.map((o, i) => '<button type="button" data-o="' + i + '" class="' + (picked < 0 ? "" : i === x.a ? "right" : i === picked ? "wrong" : "") + '"' + (picked >= 0 ? " disabled" : "") + ">" + inline(o) + "</button>").join("") +
          (picked >= 0 ? '<button type="button" class="ai-next">' + (qi + 1 < quiz.length ? "Next question ›" : "See how you did") + "</button>" : "") + "</div>";
      }
    } else h += '<p class="ai-none">Nothing to study here.</p>';
    el.innerHTML = h;
    el.querySelectorAll(".ai-seg button").forEach(b => { b.onclick = () => { mode = b.dataset.m; paint(); }; });
    const card = el.querySelector(".ai-card"); if (card) card.onclick = () => { flip = !flip; card.classList.toggle("flip", flip); };
    el.querySelectorAll("[data-n]").forEach(b => { b.onclick = () => { ci = (ci + +b.dataset.n + cards.length) % cards.length; flip = false; paint(); }; });
    el.querySelectorAll("[data-o]").forEach(b => { b.onclick = () => { picked = +b.dataset.o; if (picked === quiz[qi].a) right++; paint(); }; });
    const nx = el.querySelector(".ai-next"); if (nx) nx.onclick = () => { qi++; picked = -1; paint(); if (qi >= quiz.length && window.XP && right) XP.add(5 * right, "Study quiz"); };
    const ag = el.querySelector(".ai-again"); if (ag) ag.onclick = () => { qi = 0; right = 0; picked = -1; paint(); };
  };
  paint();
  return { cards:cards.length, quiz:quiz.length };
}

/* ---------------------------------------------------------------- the history, for "Find it again" */
function historyLines(list, max) {
  const out = [], seen = new Set();
  for (const h of list || []) {
    if (!h || !h.u || seen.has(h.u)) continue; seen.add(h.u);
    const when = h.ts ? new Date(h.ts).toISOString().slice(0, 10) : "";
    out.push({ h, line:(out.length + 1) + " | " + when + " | " + String(h.t || "").replace(/\s+/g, " ").slice(0, 120) + " | " + String(h.u).slice(0, 160) });
    if (out.length >= (max || 400)) break;
  }
  return out;
}

const css = document.createElement("style");
css.textContent = `
.ai-md p{margin:0 0 8px}.ai-md ul,.ai-md ol{margin:0 0 8px 18px;padding:0}.ai-md h4{margin:8px 0 4px;font-size:13.5px}.ai-md code{font-family:Consolas,ui-monospace,monospace;font-size:.92em;background:rgba(127,127,127,.15);padding:0 4px;border-radius:4px}
.ai-md pre{background:rgba(127,127,127,.12);padding:8px 10px;border-radius:8px;overflow:auto}.ai-md a{color:var(--accent)}
.ai-tw{overflow:auto;margin:0 0 10px;border:1px solid var(--line,rgba(127,127,127,.3));border-radius:10px}.ai-md table{border-collapse:collapse;width:100%;font-size:12.5px}
.ai-md th,.ai-md td{padding:6px 9px;border-bottom:1px solid var(--line,rgba(127,127,127,.25));text-align:left;vertical-align:top}.ai-md th{background:rgba(127,127,127,.1);font-weight:600}
.ai-study .ai-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:rgba(127,127,127,.15);margin-bottom:10px}
.ai-study .ai-seg button{flex:1;height:30px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;font-size:12.5px;cursor:pointer;opacity:.75}.ai-study .ai-seg button.on{background:var(--accent,#e8342a);color:#fff;opacity:1}
.ai-card{position:relative;display:block;width:100%;min-height:150px;border:0;padding:0;background:none;cursor:pointer;perspective:900px;font:inherit;color:inherit}
.ai-card span{position:absolute;inset:0;display:grid;place-items:center;padding:16px;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;transition:transform .45s cubic-bezier(.4,.2,.2,1);font-size:15px;line-height:1.4;text-align:center}
.ai-card .ai-f{background:linear-gradient(135deg,var(--accent,#e8342a),color-mix(in srgb,var(--accent,#e8342a) 55%,#000));color:#fff;font-weight:650}
.ai-card .ai-b{background:var(--bg3,rgba(127,127,127,.15));transform:rotateY(180deg)}.ai-card.flip .ai-f{transform:rotateY(180deg)}.ai-card.flip .ai-b{transform:rotateY(360deg)}
.ai-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;font-size:12px;opacity:.85}
.ai-nav button,.ai-q button,.ai-done button{border:1px solid var(--line,rgba(127,127,127,.3));background:var(--bg3,rgba(127,127,127,.12));color:inherit;border-radius:9px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}
.ai-q{display:flex;flex-direction:column;gap:6px}.ai-q b{font-size:14px;margin-bottom:4px}.ai-q button{text-align:left}.ai-q button.right{border-color:#2fbf71;background:rgba(47,191,113,.18)}.ai-q button.wrong{border-color:#ff6a5e;background:rgba(255,106,94,.16)}
.ai-q .ai-next{align-self:flex-end;background:var(--accent,#e8342a);border-color:var(--accent,#e8342a);color:#fff;font-weight:600}
.ai-done{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px}.ai-done b{font-size:28px}.ai-none{opacity:.7}
`;
(document.head || document.documentElement).appendChild(css);
window.AI = { ask, json, md, inline, isQuestion, quick, quickGet, plain, study, historyLines, prefs, setPrefs, ready:() => !!server(), server, dev };
})();
