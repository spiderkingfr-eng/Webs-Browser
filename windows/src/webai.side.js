/* ---------------------------------------------------------------- Webs 3.3: Web AI, in the sidebar
   A chat with Claude through the Web AI server (server/web-ai in the repository).
   The server holds the API key; this page keeps the person's Web AI code and the
   chat on this computer (wsb.xai, wsb.xaiChat - never synced to Google).
   The page text comes from the browser window that opened the sidebar
   (side.html?w=<window>, see webai.js): asked for through storage, at the
   moment a question is sent, only while "Use this page" is on. */
(function () {
"use strict";
const WINID = new URLSearchParams(location.search).get("w") || "";
const PAGE_MAX = 16000, SEL_MAX = 3000, Q_MAX = 4000, CHAT_MAX = 70000, KEEP = 60;
const E = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const q = (s) => pane.querySelector(s);
const st = () => get("xai", {}) || {};
const setSt = o => put("xai", Object.assign(st(), o));
const server = () => String(st().server || (get("xaiConfig", {}) || {}).server || "").trim().replace(/\/+$/, "");
const SPARK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.4 7 7 7.6v.8c-4.6.6-6.5 3-7 7.6h-.8c-.5-4.6-2.4-7-7-7.6v-.8c4.6-.6 6.5-3 7-7.6z"/><path d="M19 15.5c.2 1.8 1 2.7 2.7 2.9v.4c-1.8.2-2.5 1-2.7 2.8h-.4c-.2-1.8-1-2.6-2.8-2.8v-.4c1.8-.2 2.6-1.1 2.8-2.9z" opacity=".7"/></svg>';

/* the tab and the pane */
const nav = document.querySelector("nav"), tab = E("button", "xai-tab", SPARK + "<span>AI</span>");
tab.dataset.p = "xai"; tab.title = "Web AI";
nav.insertBefore(tab, nav.firstChild);
tab.onclick = () => { show("xai"); history.replaceState(null, "", "#xai"); start(); };
const pane = E("div", "pane xai"); pane.id = "xai";
document.body.insertBefore(pane, document.querySelector("script"));
pane.innerHTML =
  '<div class="xai-h"><b>' + SPARK + 'Web AI</b><span class="xai-left"></span>' +
  '<button class="xai-new" title="New chat">＋</button><button class="xai-gear" title="Web AI settings">⚙</button></div>' +
  '<div class="xai-log" aria-live="polite"></div>' +
  '<div class="xai-foot"><div class="xai-ctx"><button class="xai-page" title="Send the text of this page with your question"><i>📄</i><span></span></button></div>' +
  '<div class="xai-in"><textarea rows="1" maxlength="' + Q_MAX + '" placeholder="Ask Web AI…" spellcheck="true"></textarea>' +
  '<button class="xai-send" title="Send (Enter)">↑</button></div>' +
  '<div class="xai-fine">Web AI can make mistakes. Check anything important.</div></div>';
const log = q(".xai-log"), ta = q("textarea"), sendB = q(".xai-send"), pageB = q(".xai-page");

let chat = load(), busy = null, setupOpen = false, started = false;
function load() { const c = get("xaiChat", null); return c && Array.isArray(c.msgs) ? c : { msgs:[] }; }
function keep() {
  // the newest messages; page text is the bulk, so only the last few questions keep theirs
  chat.msgs = chat.msgs.slice(-KEEP);
  const users = chat.msgs.filter(m => m.role === "user");
  users.slice(0, -6).forEach(m => { if (m.content !== m.text) { m.content = m.text; delete m.pageUrl; } });
  try { localStorage.setItem("wsb.xaiChat", JSON.stringify(chat)); }
  catch (e) { chat.msgs.forEach((m, i) => { if (i < chat.msgs.length - 2 && m.content !== m.text) { m.content = m.text; delete m.pageUrl; } }); put("xaiChat", chat); }
}

/* ---------------------------------------------------------------- Markdown, safely: everything is escaped first; links only to http(s) and only on click; no pictures */
const fmt = s => s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
  .replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, "$1<i>$2</i>").replace(/~~([^~]+)~~/g, "<s>$1</s>");
function inline(s) {
  const kept = [], hold = h => "\u0000" + (kept.push(h) - 1) + "\u0000";
  const link = (u, t) => hold('<a href="' + esc(u) + '" title="' + esc(u) + '">' + t + "</a>");
  s = String(s).replace(/\u0000/g, "")
    .replace(/`([^`]+)`/g, (x, c) => hold("<code>" + esc(c) + "</code>"))
    .replace(/!?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (x, t, u) => link(u, fmt(esc(t))))
    .replace(/\bhttps?:\/\/[^\s<>()\[\]"]*[^\s<>()\[\]".,;:!?']/g, u => link(u, esc(u)));
  return fmt(esc(s)).replace(/\u0000(\d+)\u0000/g, (x, i) => kept[+i]);
}
function md(src) {
  const lines = String(src).replace(/\r/g, "").split("\n"), out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { const code = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]); i++;
      out.push('<pre><button class="xai-cc" title="Copy">Copy</button><code>' + esc(code.join("\n")) + "</code></pre>"); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { const h = Math.min(6, m[1].length + 2); out.push("<h" + h + ">" + inline(m[2]) + "</h" + h + ">"); i++; continue; }
    if (/^(\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[\s*_-]*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) { const b = []; while (i < lines.length && /^>\s?/.test(lines[i])) b.push(lines[i++].replace(/^>\s?/, "")); out.push("<blockquote>" + b.map(inline).join("<br>") + "</blockquote>"); continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const ol = /^\s*\d/.test(l), items = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push({ t:lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""), sub:/^\s{2,}/.test(lines[i]) });
        else items[items.length - 1].t += " " + lines[i].trim();
        i++;
      }
      out.push((ol ? "<ol>" : "<ul>") + items.map(x => "<li" + (x.sub ? ' class="sub"' : "") + ">" + inline(x.t) + "</li>").join("") + (ol ? "</ol>" : "</ul>")); continue;
    }
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push('<div class="xai-tw"><table><tr>' + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr>" + body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</table></div>"); continue;
    }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])) p.push(lines[i++]);
    out.push("<p>" + p.map(inline).join("<br>") + "</p>");
  }
  return out.join("");
}
log.addEventListener("click", e => {
  const a = e.target.closest("a[href]");
  if (a) { e.preventDefault(); if (/^https?:\/\//i.test(a.getAttribute("href"))) send("open", a.getAttribute("href")); return; }
  const cc = e.target.closest(".xai-cc");
  if (cc) { send("clip", cc.parentNode.querySelector("code").textContent); cc.textContent = "Copied"; setTimeout(() => { cc.textContent = "Copy"; }, 1100); }
});

/* ---------------------------------------------------------------- what's on screen */
const SUGGEST = [["Summarize this page", "Summarize this page."], ["Key points", "What are the key points of this page? A short list."],
  ["Explain it simply", "Explain this page in simple words, like I'm new to the topic."], ["Explain what I selected", "Explain what I selected."]];
function paint() {
  const s = st();
  q(".xai-left").textContent = s.code && s.limit ? (s.left != null ? s.left : s.limit) + " left today" : "";
  q(".xai-left").classList.toggle("low", s.code && s.left != null && s.left <= 3);
  q(".xai-new").style.visibility = chat.msgs.length && !setupOpen ? "" : "hidden";
  pane.classList.toggle("setup", setupOpen || !s.code || !server());
  if (setupOpen || !s.code || !server()) return paintSetup();
  log.innerHTML = "";
  if (!chat.msgs.length) {
    const w = E("div", "xai-hello", '<div class="xai-orb">' + SPARK + "</div><h3></h3><p>Ask about the page you're on, or anything else.</p><div class=\"xai-sug\"></div>");
    w.querySelector("h3").textContent = s.name ? "Hi " + s.name + "!" : "Web AI";
    SUGGEST.forEach(([label, text], i) => { const b = E("button", "", ""); b.textContent = label; b.style.animationDelay = i * 40 + "ms"; b.onclick = () => ask(text); w.querySelector(".xai-sug").appendChild(b); });
    log.appendChild(w);
  }
  chat.msgs.forEach((m, i) => log.appendChild(bubble(m, i)));
  log.scrollTop = log.scrollHeight;
  paintPage();
}
function bubble(m, i) {
  if (m.role === "user") {
    const d = E("div", "xai-q" + (m.failed ? " failed" : ""));
    d.appendChild(E("div", "xai-qt")).textContent = m.text;
    if (m.page) { const c = E("div", "xai-att"); c.textContent = "📄 " + (m.page.t || m.page.u); c.title = m.page.u; d.appendChild(c); }
    if (m.sel) d.appendChild(E("div", "xai-att", "✂ The text you selected"));
    return d;
  }
  const d = E("div", "xai-a" + (m.pending ? " pending" : "") + (m.err ? " err" : ""));
  d.dataset.i = i;
  fillAnswer(d, m);
  return d;
}
function fillAnswer(d, m) {
  if (m.err) {
    d.innerHTML = '<div class="xai-e"></div><div class="xai-acts"><button class="b">Try again</button></div>';
    d.querySelector(".xai-e").textContent = m.err;
    d.querySelector("button").onclick = () => retry(+d.dataset.i);
    if (m.errKind === "code") { const b = E("button", "b", "Web AI settings"); b.onclick = () => { setupOpen = true; paint(); }; d.querySelector(".xai-acts").appendChild(b); }
    return;
  }
  d.innerHTML = (m.text ? md(m.text) : "") + (m.pending && !m.text ? '<div class="xai-dots"><i></i><i></i><i></i></div>' : "") +
    (m.note ? '<div class="xai-note"></div>' : "") + (!m.pending && m.text ? '<div class="xai-acts"><button class="xai-copy" title="Copy the answer">Copy</button></div>' : "");
  if (m.note) d.querySelector(".xai-note").textContent = m.note;
  const c = d.querySelector(".xai-copy");
  if (c) c.onclick = () => { send("clip", m.text); c.textContent = "Copied"; setTimeout(() => { c.textContent = "Copy"; }, 1100); };
}
let rafT = 0;
function repaintLast() {
  if (rafT) return;
  rafT = requestAnimationFrame(() => {
    rafT = 0;
    const i = chat.msgs.length - 1, m = chat.msgs[i], d = log.querySelector('.xai-a[data-i="' + i + '"]');
    if (!m || !d) return paint();
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    d.className = "xai-a" + (m.pending ? " pending" : "") + (m.err ? " err" : "");
    fillAnswer(d, m);
    if (near) log.scrollTop = log.scrollHeight;
  });
}

/* "Use this page": on unless you turn it off; shows which page that is */
function paintPage() {
  let cur = null; try { cur = JSON.parse(localStorage.getItem("wsb.current") || "null"); } catch (e) {}
  const on = !st().noPage;
  pageB.classList.toggle("on", on && !!cur);
  pageB.classList.toggle("none", !cur);
  pageB.querySelector("span").textContent = !cur ? "No web page open" : (on ? "Using: " : "Not using: ") + (cur.t || cur.u);
  pageB.title = !cur ? "Open a web page to ask about it" : on ? "Web AI reads this page when you ask (click to stop)" : "Click to let Web AI read this page when you ask";
}
pageB.onclick = () => { setSt({ noPage:!st().noPage }); paintPage(); };
addEventListener("storage", e => {
  if (e.key === "wsb.current") paintPage();
  if (e.key === "wsb.xaiConfig" || (e.key === "wsb.xai" && !busy)) { if (pane.classList.contains("on")) paint(); }
});

/* ---------------------------------------------------------------- setting it up: the code (and the server address, if the update didn't bring one) */
function paintSetup() {
  const s = st(), fromUpdate = (get("xaiConfig", {}) || {}).server || "";
  log.innerHTML = "";
  const w = E("div", "xai-setup",
    '<div class="xai-orb">' + SPARK + '</div><h3>Web AI</h3><p class="xai-p">Ask questions about the page you\'re on, get summaries, explanations and translations, or just chat.</p>' +
    '<div class="xlab">Your Web AI code</div><input class="xin" id="xaiCode" autocomplete="off" spellcheck="false" placeholder="From the person who runs Web AI">' +
    '<div class="xai-srv"><div class="xlab">Server address</div><input class="xin" id="xaiSrv" autocomplete="off" spellcheck="false" placeholder="https://web-ai.your-name.workers.dev"></div>' +
    '<div class="xrow"><button class="b m" id="xaiGo">Connect</button><button class="b" id="xaiBack">Back</button><button class="b" id="xaiOff">Disconnect</button></div><div class="xmsg" id="xaiMsg"></div>' +
    '<p class="xai-small">Your code stays on this computer. When you ask something, your question (and the text of the page, while "Use this page" is on) goes to the Web AI server and to Claude, made by Anthropic, which writes the answer. Nothing is sent from private windows\' pages.</p>');
  log.appendChild(w);
  const code = w.querySelector("#xaiCode"), srv = w.querySelector("#xaiSrv"), msg = w.querySelector("#xaiMsg");
  code.value = s.code || "";
  srv.value = s.server || "";
  if (fromUpdate && !s.server) { srv.placeholder = fromUpdate; w.querySelector(".xai-srv").classList.add("hide"); }
  const more = E("button", "xai-link", "Use a different server"); more.onclick = () => { w.querySelector(".xai-srv").classList.remove("hide"); more.remove(); srv.focus(); };
  if (fromUpdate && !s.server) w.querySelector(".xai-srv").after(more);
  w.querySelector("#xaiBack").style.display = s.code && server() ? "" : "none";
  w.querySelector("#xaiOff").style.display = s.code ? "" : "none";
  w.querySelector("#xaiBack").onclick = () => { setupOpen = false; paint(); };
  w.querySelector("#xaiOff").onclick = () => { setSt({ code:"", name:"", left:null, limit:0 }); setupOpen = false; paint(); };
  const go = async () => {
    const c = code.value.trim(), u = (srv.value.trim() || fromUpdate).replace(/\/+$/, "");
    msg.className = "xmsg"; msg.textContent = "";
    if (!c) { msg.className = "xmsg bad"; msg.textContent = "Type your Web AI code."; code.focus(); return; }
    if (!/^https:\/\/[^\s/?#]+\.[^\s/?#]+(\/[^\s?#]*)?$/i.test(u)) { msg.className = "xmsg bad"; msg.textContent = u ? "The server address should start with https://" : "Type the server address."; w.querySelector(".xai-srv").classList.remove("hide"); srv.focus(); return; }
    const b = w.querySelector("#xaiGo"); b.disabled = true; b.textContent = "Connecting…";
    try {
      const r = await fetch(u + "/check", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:c }) });
      let j = null; try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j || !j.ok) throw new Error(j && j.message || "The server answered with an error (" + r.status + ").");
      setSt({ code:c, server:srv.value.trim() ? u : "", name:String(j.name || "").slice(0, 40), left:+j.left, limit:+j.limit });
      setupOpen = false; paint(); ta.focus();
    } catch (e) {
      msg.className = "xmsg bad"; msg.textContent = e instanceof TypeError ? "Can't reach the Web AI server. Check the address and your internet." : e.message;
      b.disabled = false; b.textContent = "Connect";
    }
  };
  w.querySelector("#xaiGo").onclick = go;
  [code, srv].forEach(x => x.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
  setTimeout(() => code.focus(), 30);
}
q(".xai-gear").onclick = () => { setupOpen = !setupOpen || !st().code; paint(); };
q(".xai-new").onclick = () => { if (busy) busy.abort(); chat = { msgs:[] }; keep(); paint(); ta.focus(); };

/* ---------------------------------------------------------------- the page, from the browser window */
function readPage() {
  return new Promise(res => {
    if (!WINID) return res({ why:"none" });
    const n = Math.random().toString(36).slice(2), key = "wsb.xaiPage." + WINID;
    let done = false, timer = 0;
    const finish = v => { if (done) return; done = true; removeEventListener("storage", on); clearTimeout(timer); res(v); };
    const on = e => {
      if (e.key !== key || !e.newValue) return;
      let v = null; try { v = JSON.parse(e.newValue); } catch (x) {}
      if (!v || v.n !== n) return;
      try { localStorage.removeItem(key); } catch (x) {}
      finish(v);
    };
    addEventListener("storage", on);
    timer = setTimeout(() => finish({ why:"slow" }), 4000);
    try { localStorage.setItem("wsb.xaiAsk." + WINID, JSON.stringify({ n, t:Date.now() })); } catch (e) { finish({ why:"none" }); }
  });
}
const clip = (s, n) => s.length > n ? s.slice(0, n) : s;

/* ---------------------------------------------------------------- asking */
async function ask(text) {
  text = String(text || "").trim().slice(0, Q_MAX);
  if (!text || busy) return;
  const s = st();
  if (!s.code || !server()) { setupOpen = true; paint(); return; }
  const u = { role:"user", text, content:text }, a = { role:"assistant", text:"", pending:true };
  chat.msgs.push(u, a);
  ta.value = ""; grow(); paint();
  const ctl = new AbortController(); busy = ctl; working(true);
  try {
  if (!s.noPage) {
    const p = await readPage();
    if (ctl.signal.aborted) throw new Error("Stopped.");
    if (p.ok) {
      const parts = [], seen = chat.msgs.some(m => m !== u && m.role === "user" && !m.failed && m.pageUrl === p.url);
      if (!seen && String(p.text || "").trim()) {
        const body = clip(String(p.text).replace(/\n{3,}/g, "\n\n").trim(), PAGE_MAX);
        parts.push("<page>\nTitle: " + String(p.title || "").slice(0, 300) + "\nAddress: " + String(p.url || "").slice(0, 500) + "\n\n" + body +
          (p.cut || String(p.text).length > PAGE_MAX ? "\n\n[The page goes on; the rest was left out.]" : "") + "\n</page>");
        u.pageUrl = p.url; u.page = { t:String(p.title || "").slice(0, 120), u:String(p.url || "").slice(0, 500) };
      }
      const sel = clip(String(p.sel || "").trim(), SEL_MAX);
      if (sel.length > 1 && sel !== chat.lastSel) { parts.push("<selection>\n" + sel + "\n</selection>"); chat.lastSel = sel; u.sel = 1; }
      else if (/what I selected/i.test(text) && sel.length <= 1) a.note = "Tip: select some text on the page first, then ask.";
      u.content = parts.concat(text).join("\n\n");
    } else if (p.why === "private") a.note = "Web AI doesn't read pages in private windows.";
    paint();
  }
    const r = await fetch(server() + "/chat", { method:"POST", headers:{ "content-type":"application/json" }, signal:ctl.signal,
      body:JSON.stringify({ code:s.code, messages:turns() }) });
    if (!r.ok || !r.body) {
      let j = null; try { j = await r.json(); } catch (e) {}
      if (j && j.left === 0) setSt({ left:0 });
      throw Object.assign(new Error(j && j.message || "Web AI couldn't answer (error " + r.status + ")."), { kind:j && j.error || "" });
    }
    const rd = r.body.getReader(), dec = new TextDecoder();
    let buf = "", end = null;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream:true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let o = null; try { o = JSON.parse(line); } catch (e) { continue; }
        if (o.d) { a.text += o.d; repaintLast(); }
        else if (o.end) end = o;
        else if (o.error) throw Object.assign(new Error(o.message || "Web AI stopped."), { kind:o.error });
      }
    }
    if (!end) throw new Error("The answer was cut off. Try again.");
    if (end.stop === "refusal") { a.note = "Web AI can't help with that one."; if (!a.text) a.text = ""; }
    else if (end.stop === "max_tokens") a.note = "That's as long as an answer can be. Ask “go on” for more.";
    if (typeof end.left === "number") setSt({ left:end.left });
    a.pending = false;
    if (!a.text && end.stop !== "refusal") throw new Error("Web AI didn't answer that. Try asking another way.");
    if (!a.text) { u.failed = true; a.failed = true; }
  } catch (e) {
    a.pending = false;
    if (ctl.signal.aborted) { if (a.text) a.note = "Stopped."; else { a.err = "Stopped."; u.failed = a.failed = true; } }
    else {
      a.err = e instanceof TypeError ? "Can't reach Web AI. Check your internet connection." : e.message;
      a.errKind = e.kind || "";
      if (!a.text) u.failed = a.failed = true; else { a.note = a.err; a.err = ""; }
    }
  } finally {
    if (busy === ctl) busy = null;
    working(false); keep(); paint();
  }
}
function retry(i) {
  const a = chat.msgs[i], u = chat.msgs[i - 1];
  if (!a || !u || u.role !== "user" || busy) return;
  chat.msgs.splice(i - 1, 2);
  if (u.sel) chat.lastSel = "";
  ask(u.text);
}
/* what the server gets: the turns that worked, newest last, within the size the server takes */
function turns() {
  const list = chat.msgs.filter(m => !m.failed && !(m.role === "assistant" && m.pending) && (m.role === "user" ? m.content : m.text))
    .map(m => ({ role:m.role, content:m.role === "user" ? m.content : m.text }));
  let total = list.reduce((n, m) => n + m.content.length, 0);
  while (list.length > 1 && total > CHAT_MAX) { total -= list.shift().content.length; while (list.length > 1 && list[0].role !== "user") total -= list.shift().content.length; }
  return list;
}

/* ---------------------------------------------------------------- the box you type in */
function grow() { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; }
ta.addEventListener("input", grow);
ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); } });
sendB.onclick = () => { if (busy) busy.abort(); else ask(ta.value); };
function working(on) {
  sendB.classList.toggle("stop", on); sendB.textContent = on ? "■" : "↑"; sendB.title = on ? "Stop" : "Send (Enter)";
  pane.classList.toggle("busy", on);
}

/* opened as #xai, or #xai:summarize from the browser's menu */
function start() {
  if (!started) { started = true; paint(); }
  else if (!busy) paint();
  setTimeout(() => { if (!pane.classList.contains("setup")) ta.focus(); }, 30);
}
function route3() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h !== "xai" && h.indexOf("xai:") !== 0) { tab.classList.remove("on"); return; }
  show("xai"); start();
  const what = h.split(":")[1];
  if (what === "summarize" && st().code && server()) { history_replace(); ask(SUGGEST[0][1]); }
}
const history_replace = () => { try { history.replaceState(null, "", "#xai"); } catch (e) {} };
addEventListener("hashchange", route3);
route3();
})();
