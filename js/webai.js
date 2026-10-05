/* Webs Browser for iPhone - Web AI: a chat with Claude through the Web AI server
   (server/web-ai in the repository), the same one the Windows browser uses.
   Menu → Web AI. The server holds the API key; the phone keeps the person's
   Web AI code and the chat (wsb.xai, wsb.xaiChat). Pages shown inside the app
   can't be read by it, so with "Use this page" on, the page's address goes
   along and the server lets Claude open it (web fetch). Private tabs never
   send their page. The server's address (and a shared code) come with updates
   (updates/iphone.json), so Web AI is ready by itself: no code when the server
   is open (it counts per device, wsb.xaiDev), otherwise the shared code. */
"use strict";

(function () {
const Q_MAX = 4000, CHAT_MAX = 70000, KEEP = 60;
const st = () => load("xai", {}) || {};
const setSt = o => save("xai", Object.assign(st(), o));
const server = () => String(st().server || (load("xaiConfig", {}) || {}).server || "").trim().replace(/\/+$/, "");
const shared = () => String((load("xaiConfig", {}) || {}).code || "").trim();
const ready = () => !!server() && !!(st().code || st().auto);
const codeToSend = () => st().code || (st().open ? "" : shared());
function dev() {
  let d = load("xaiDev", ""); if (/^[A-Za-z0-9]{20,40}$/.test(d)) return d;
  const a = new Uint8Array(15); crypto.getRandomValues(a); d = [...a].map(b => b.toString(16).padStart(2, "0")).join(""); save("xaiDev", d); return d;
}
let autoState = "idle", autoFail = 0;
async function autoConnect() {
  if (st().code || autoState === "busy") return;
  autoState = "busy";
  try {
    await fetchConfig();
    if (!server()) throw new Error("no server");
    const g = await (await fetch(server() + "/", { cache:"no-store" })).json();
    const open = !!(g && g.open), code = open ? "" : shared();
    if (!open && !code) throw new Error("needs a code");
    const r = await fetch(server() + "/check", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code, device:dev() }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) throw new Error("no");
    setSt({ auto:true, open, name:"", left:+j.left, limit:+j.limit });
  } catch (e) { setSt({ auto:false }); autoFail = Date.now(); }
  autoState = "done";
  paint();
}
const SPARK = '<svg class="ais" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.4 7 7 7.6v.8c-4.6.6-6.5 3-7 7.6h-.8c-.5-4.6-2.4-7-7-7.6v-.8c4.6-.6 6.5-3 7-7.6z"/><path d="M19 15.5c.2 1.8 1 2.7 2.7 2.9v.4c-1.8.2-2.5 1-2.7 2.8h-.4c-.2-1.8-1-2.6-2.8-2.8v-.4c1.8-.2 2.6-1.1 2.8-2.9z" opacity=".7"/></svg>';
let chat = null, busy = null, setupOpen = false;
const chatLoad = () => { const c = load("xaiChat", null); return c && Array.isArray(c.msgs) ? c : { msgs:[] }; };
function keep() {
  chat.msgs = chat.msgs.slice(-KEEP);
  if (!save("xaiChat", chat)) { chat.msgs.forEach(m => { m.content = m.text; delete m.pageUrl; }); save("xaiChat", chat); }
}

// the address can arrive with updates/iphone.json, so people only type their code
async function fetchConfig() {
  try {
    const r = await fetch("updates/iphone.json?t=" + Date.now(), { cache:"no-store" });
    const j = r.ok ? await r.json() : null, s = j && j.webai && String(j.webai.server || "");
    const code = j && j.webai && /^[A-Za-z0-9_-]{8,64}$/.test(j.webai.code || "") ? j.webai.code : "";
    if (/^https:\/\/[^\s/?#]+\.[^\s/?#]+(\/[^\s?#]*)?$/i.test(s)) {
      const had = load("xaiConfig", {}) || {}, srv = s.replace(/\/+$/, "").slice(0, 300);
      if (had.server !== srv || (had.code || "") !== code) { save("xaiConfig", code ? { server:srv, code } : { server:srv }); if (!st().code) setSt({ auto:false }); }
    }
  } catch (e) {}
}

/* ---------------------------------------------------------------- Markdown, safely: everything escaped; links only to http(s); no pictures */
const fmt = s => s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
  .replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, "$1<i>$2</i>").replace(/~~([^~]+)~~/g, "<s>$1</s>");
function inline(s) {
  const kept = [], hold = h => "\u0000" + (kept.push(h) - 1) + "\u0000";
  const link = (u, t) => hold('<a href="' + esc(u) + '">' + t + "</a>");
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
      out.push('<pre><button type="button" class="aicc">Copy</button><code>' + esc(code.join("\n")) + "</code></pre>"); continue; }
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
      out.push('<div class="aitw"><table><tr>' + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr>" + body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</table></div>"); continue;
    }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])) p.push(lines[i++]);
    out.push("<p>" + p.map(inline).join("<br>") + "</p>");
  }
  return out.join("");
}

/* ---------------------------------------------------------------- the sheet */
const SUGGEST = [["Summarize this page", "Summarize this page."], ["Key points", "What are the key points of this page? A short list."],
  ["Explain it simply", "Explain this page in simple words, like I'm new to the topic."], ["Ask anything", ""]];
const isOpen = () => $("#sheet").dataset.kind === "ai" && !$("#sheet").classList.contains("hide");
const page = () => { const t = curTab(); return t && t.u && !t.internal && /^https?:/i.test(t.u) ? t : null; };
function openAI() {
  chat = chatLoad();
  openSheet("Web AI", '<div class="ai"><div class="ailog"></div><div class="aifoot">' +
    '<button type="button" class="aipage"><span></span></button>' +
    '<div class="aicallbar hide"><span class="dot"></span><span class="t"></span><button type="button" class="btn">Hang up</button></div>' +
    '<div class="aiin"><textarea rows="1" maxlength="' + Q_MAX + '" placeholder="Ask Web AI…" enterkeyhint="send"></textarea><button type="button" class="aicall" aria-label="Voice call">📞</button><button type="button" class="aisend" aria-label="Send">' + ico("up") + "</button></div>" +
    '<div class="aifine">Web AI can make mistakes. Check anything important.</div></div></div>', { full:true, kind:"ai" });
  const b = $("#sheetBody");
  b.querySelector(".aipage").onclick = () => { setSt({ noPage:!st().noPage }); paintPage(); };
  const ta = b.querySelector("textarea");
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); } });
  b.querySelector(".aisend").onclick = () => { if (busy) busy.abort(); else ask(ta.value); };
  b.querySelector(".aicall").onclick = () => call ? hangUp() : startCall();
  b.querySelector(".aicallbar .btn").onclick = hangUp;
  ta.addEventListener("keydown", e => { if (call && e.key === "Enter" && !e.shiftKey) { stopListening(); stopTalking(); } }, true);
  paintCall();
  b.onclick = e => {
    const a = e.target.closest(".ai a[href]");
    if (a) { e.preventDefault(); if (/^https?:\/\//i.test(a.getAttribute("href"))) go(a.getAttribute("href"), { newTab:true }); return; }
    const cc = e.target.closest(".aicc");
    if (cc) copyText(cc.parentNode.querySelector("code").textContent);
  };
  if (!st().code && autoState !== "busy") autoState = "idle";     // a failed try earlier: try again now
  paint();                                                        // not ready yet: this connects by itself
  if (!st().code && st().auto) autoConnect();                     // ready: refresh the address and what's left today
}
function grow() { const ta = $("#sheetBody textarea"); if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; }
function paint() {
  if (!isOpen()) return;
  const s = st(), log = $("#sheetBody .ailog");
  if (!setupOpen && !ready() && autoState !== "done") {
    $("#sheetBody .ai").classList.add("setup");
    $("#sheetTitle").innerHTML = SPARK + "Web AI"; headButtons();
    log.innerHTML = '<div class="aihello"><div class="aiorb">' + SPARK + '</div><h3>Web AI</h3><p>Getting ready…</p></div>';
    autoConnect();
    return;
  }
  const setup = setupOpen || !ready();
  $("#sheetBody .ai").classList.toggle("setup", setup);
  $("#sheetTitle").innerHTML = SPARK + "Web AI" + (ready() && s.limit ? '<em class="aileft' + (s.left != null && s.left <= 3 ? " low" : "") + '">' + (s.left != null ? s.left : s.limit) + " left today</em>" : "");
  headButtons();
  if (setup) return paintSetup(log);
  log.innerHTML = "";
  if (!chat.msgs.length) {
    const w = document.createElement("div"); w.className = "aihello";
    w.innerHTML = '<div class="aiorb">' + SPARK + "</div><h3></h3><p>Ask about the page you're on, or anything else.</p><div class=\"aisug\"></div>";
    w.querySelector("h3").textContent = s.name ? "Hi " + s.name + "!" : "Web AI";
    SUGGEST.forEach(([label, text]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label;
      b.onclick = () => text ? ask(text) : $("#sheetBody textarea").focus(); w.querySelector(".aisug").appendChild(b); });
    log.appendChild(w);
  }
  chat.msgs.forEach((m, i) => log.appendChild(bubble(m, i)));
  log.scrollTop = log.scrollHeight;
  paintPage();
}
function headButtons() {
  // New chat and settings sit in the sheet's header, left of Done
  let h = $("#aiHead");
  if (!h) { h = document.createElement("span"); h.id = "aiHead"; $("#sheetDone").before(h); }
  h.innerHTML = (chat.msgs.length && !setupOpen ? '<button type="button" id="aiNew" aria-label="New chat">' + ico("plus") + "</button>" : "") + '<button type="button" id="aiGear" aria-label="Web AI settings">' + ico("gear") + "</button>";
  const n = $("#aiNew"); if (n) n.onclick = () => { if (busy) busy.abort(); chat = { msgs:[] }; keep(); paint(); };
  $("#aiGear").onclick = () => { setupOpen = !setupOpen || !ready(); paint(); };
}
function bubble(m, i) {
  const d = document.createElement("div");
  if (m.role === "user") {
    d.className = "aiq" + (m.failed ? " failed" : "");
    d.appendChild(document.createElement("div")).textContent = m.text;
    if (m.page) { const c = document.createElement("small"); c.textContent = "📄 " + (m.page.t || m.page.u); d.appendChild(c); }
    return d;
  }
  d.className = "aia"; d.dataset.i = i;
  fill(d, m);
  return d;
}
function fill(d, m) {
  d.classList.toggle("pending", !!m.pending); d.classList.toggle("err", !!m.err);
  if (m.err) {
    d.innerHTML = '<div class="aie"></div><div class="aiacts"><button type="button" class="btn">Try again</button></div>';
    d.querySelector(".aie").textContent = m.err;
    d.querySelector("button").onclick = () => retry(+d.dataset.i);
    if (m.errKind === "code") { const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "Web AI settings"; b.onclick = () => { setupOpen = true; paint(); }; d.querySelector(".aiacts").appendChild(b); }
    return;
  }
  d.innerHTML = (m.text ? md(m.text) : "") + (m.pending && !m.text ? '<div class="aidots"><i></i><i></i><i></i></div>' : "") +
    (m.note ? '<div class="ainote"></div>' : "") + (!m.pending && m.text ? '<div class="aiacts"><button type="button" class="aicopy">' + ico("copy") + 'Copy</button>' + (synth ? '<button type="button" class="aisay" aria-label="Read it out loud">🔊</button>' : "") + "</div>" : "");
  if (m.note) d.querySelector(".ainote").textContent = m.note;
  const c = d.querySelector(".aicopy"); if (c) c.onclick = () => copyText(m.text);
  const v = d.querySelector(".aisay"); if (v) v.onclick = () => { if (speaking) { stopTalking(); paintCall(); } else { unlock(); say(m.text); } };
}
let raf = 0;
function repaintLast() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!isOpen()) return;
    const i = chat.msgs.length - 1, d = $('#sheetBody .aia[data-i="' + i + '"]'), log = $("#sheetBody .ailog");
    if (!d) return paint();
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    fill(d, chat.msgs[i]);
    if (near) log.scrollTop = log.scrollHeight;
  });
}
function paintPage() {
  const b = $("#sheetBody .aipage"); if (!b) return;
  const t = page(), on = !st().noPage && !PRIVATE;
  b.classList.toggle("on", on && !!t); b.classList.toggle("none", !t || PRIVATE);
  b.querySelector("span").textContent = PRIVATE ? "Private tab: the page isn't sent" : !t ? "No web page open" : (on ? "Using: " : "Not using: ") + (t.t || hostOf(t.u));
}

/* ---------------------------------------------------------------- setting it up */
function paintSetup(log) {
  const s = st(), fromUpdate = (load("xaiConfig", {}) || {}).server || "";
  log.innerHTML = '<div class="aisetup"><div class="aiorb">' + SPARK + '</div><h3>Web AI</h3><p>Ask questions about the page you\'re on, get summaries, explanations and translations, or just chat.</p>' +
    '<div class="group"><h3>Your Web AI code</h3><div class="card"><input id="aiCode" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="From the person who runs Web AI"></div></div>' +
    '<div class="group aisrv' + (fromUpdate && !s.server ? " hide" : "") + '"><h3>Server address</h3><div class="card"><input id="aiSrv" type="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://web-ai.your-name.workers.dev"></div></div>' +
    '<div class="aibtns"><button type="button" class="btn main" id="aiGo">Connect</button>' + (s.code ? '<button type="button" class="btn" id="aiOff">Disconnect</button>' : "") + '</div><p class="aimsg" id="aiMsg"></p>' +
    '<div class="group"><h3>Your instructions</h3><div class="card"><textarea id="aiPrefs" rows="3" maxlength="600" placeholder="How you like answers, e.g. Keep it short. Use simple words. Answer in Spanish."></textarea></div></div>' +
    '<p class="aismall">Web AI follows your instructions in every answer, here and in the address bar.</p>' +
    '<p class="aismall">Your code stays on this phone. When you ask something, your question (and the address of the page, while "Use this page" is on) goes to the Web AI server and to Claude, made by Anthropic, which writes the answer.</p></div>';
  const code = $("#aiCode"), srv = $("#aiSrv"), msg = $("#aiMsg");
  code.value = s.code || ""; srv.value = s.server || "";
  const pf = $("#aiPrefs"); pf.value = s.prefs || ""; pf.oninput = () => setSt({ prefs:pf.value.slice(0, 600) });
  if (fromUpdate) srv.placeholder = fromUpdate;
  const off = $("#aiOff"); if (off) off.onclick = () => { setSt({ code:"", name:"", left:null, limit:0, auto:false }); autoState = "idle"; setupOpen = false; paint(); };
  if (s.auto && !s.code) {
    $("#sheetBody .aisetup > p").textContent = "Web AI is ready for everyone, no code needed. If someone gave you a personal Web AI code, enter it here.";
    $("#aiGo").textContent = "Use this code";
  } else if (autoFail && !s.code) {
    $("#sheetBody .aisetup > p").textContent = "Web AI couldn't connect by itself. Check your internet connection, or enter a Web AI code.";
    const again = document.createElement("button"); again.type = "button"; again.className = "btn"; again.textContent = "Try again";
    again.onclick = () => { autoState = "idle"; autoFail = 0; paint(); }; $("#sheetBody .aibtns").appendChild(again);
  }
  const connect = async () => {
    const c = code.value.trim(), u = (srv.value.trim() || fromUpdate).replace(/\/+$/, "");
    msg.className = "aimsg"; msg.textContent = "";
    if (!c) { msg.className = "aimsg bad"; msg.textContent = "Type your Web AI code."; code.focus(); return; }
    if (!/^https:\/\/[^\s/?#]+\.[^\s/?#]+(\/[^\s?#]*)?$/i.test(u)) { msg.className = "aimsg bad"; msg.textContent = u ? "The server address should start with https://" : "Type the server address."; $("#sheetBody .aisrv").classList.remove("hide"); srv.focus(); return; }
    const b = $("#aiGo"); b.disabled = true; b.textContent = "Connecting…";
    try {
      const r = await fetch(u + "/check", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:c, device:dev() }) });
      let j = null; try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j || !j.ok) throw new Error(j && j.message || "The server answered with an error (" + r.status + ").");
      setSt({ code:c, server:srv.value.trim() ? u : "", name:String(j.name || "").slice(0, 40), left:+j.left, limit:+j.limit });
      setupOpen = false; paint();
    } catch (e) {
      msg.className = "aimsg bad"; msg.textContent = e instanceof TypeError ? "Can't reach the Web AI server. Check the address and your internet." : e.message;
      b.disabled = false; b.textContent = "Connect";
    }
  };
  $("#aiGo").onclick = connect;
  [code, srv].forEach(x => x.addEventListener("keydown", e => { if (e.key === "Enter") connect(); }));
}

/* ---------------------------------------------------------------- asking */
async function ask(text) {
  text = String(text || "").trim().slice(0, Q_MAX);
  if (!text || busy) return;
  const s = st();
  if (!ready()) { paint(); return; }
  const u = { role:"user", text, content:text }, a = { role:"assistant", text:"", pending:true };
  let web = false;
  const t = page();
  if (t && !s.noPage && !PRIVATE) {
    web = true;
    if (!chat.msgs.some(m => m.role === "user" && !m.failed && m.pageUrl === t.u)) {
      u.content = "<page>\nTitle: " + String(t.t || hostOf(t.u)).slice(0, 300) + "\nAddress: " + t.u.slice(0, 500) + "\n</page>\n\n" + text;
      u.pageUrl = t.u; u.page = { t:String(t.t || hostOf(t.u)).slice(0, 120), u:t.u.slice(0, 500) };
    }
  }
  chat.msgs.push(u, a);
  const ta = $("#sheetBody textarea"); if (ta) { ta.value = ""; grow(); }
  const ctl = new AbortController(); busy = ctl; working(true); paint();
  try {
    const r = await fetch(server() + "/chat", { method:"POST", headers:{ "content-type":"application/json" }, signal:ctl.signal,
      body:JSON.stringify({ code:codeToSend(), device:dev(), web, prefs:String(st().prefs || "").slice(0, 600), messages:turns() }) });
    if (!r.ok || !r.body) {
      let j = null; try { j = await r.json(); } catch (e) {}
      if (j && j.left === 0) setSt({ left:0 });
      if (j && j.error === "code" && !st().code) { setSt({ auto:false }); autoState = "idle"; }
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
    if (end.stop === "refusal") a.note = "Web AI can't help with that one.";
    else if (end.stop === "max_tokens") a.note = "That's as long as an answer can be. Ask “go on” for more.";
    if (typeof end.left === "number") setSt({ left:end.left });
    a.pending = false;
    if (!a.text && end.stop !== "refusal") throw new Error("Web AI didn't answer that. Try asking another way.");
    if (!a.text) u.failed = a.failed = true;
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
    afterAnswer(a);
  }
}
function retry(i) {
  const a = chat.msgs[i], u = chat.msgs[i - 1];
  if (!a || !u || u.role !== "user" || busy) return;
  chat.msgs.splice(i - 1, 2);
  ask(u.text);
}
function turns() {
  const list = chat.msgs.filter(m => !m.failed && !(m.role === "assistant" && m.pending) && (m.role === "user" ? m.content : m.text))
    .map(m => ({ role:m.role, content:m.role === "user" ? m.content : m.text }));
  let total = list.reduce((n, m) => n + m.content.length, 0);
  while (list.length > 1 && total > CHAT_MAX) { total -= list.shift().content.length; while (list.length > 1 && list[0].role !== "user") total -= list.shift().content.length; }
  return list;
}
function working(on) {
  const b = $("#sheetBody .aisend"); if (!b) return;
  b.classList.toggle("stop", on); b.innerHTML = on ? '<i class="aisq"></i>' : ico("up"); b.setAttribute("aria-label", on ? "Stop" : "Send");
  $("#sheetBody .ai").classList.toggle("busy", on);
}

/* the menu: Web AI first */
const openMenu0 = openMenu;
openMenu = function () {
  openMenu0();
  const card = $("#sheetBody .card");
  if (card) card.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="webai">' + ico("sparkle") + "<span>Web AI</span><em>Ask about this page</em></button>");
};
ACTIONS.webai = openAI;

/* ---------------------------------------------------------------- 2.3: a voice call with Web AI
   📞 starts a call: Web AI listens, sends what you said, says the answer out loud, then listens
   again, until you hang up. 🔊 on an answer says it out loud. Where the phone can't listen
   (no speech recognition, or no microphone permission), the call carries on with the
   keyboard's own 🎤 dictation, and the answers are still spoken. */
const SRc = window.SpeechRecognition || window.webkitSpeechRecognition, synth = window.speechSynthesis;
let call = false, rec = null, speaking = false, heard = "", quiet = 0, noMic = "";
const plain = md => String(md || "").replace(/```[\s\S]*?```/g, " (a code example) ").replace(/`([^`]*)`/g, "$1").replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/https?:\/\/\S+/g, "a link").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*#+\s*/gm, "").replace(/[*_~]+/g, "").replace(/[>|]+/g, " ").replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
function voice() {
  const vs = synth ? synth.getVoices() : [], lang = (navigator.language || "en-US").toLowerCase();
  return vs.find(v => v.lang.toLowerCase() === lang && /enhanced|premium/i.test(v.name)) || vs.find(v => v.lang.toLowerCase() === lang) || vs.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) || null;
}
function unlock() { try { if (synth) synth.speak(new SpeechSynthesisUtterance("")); } catch (e) {} }   // iOS speaks later only after a tap has started it once
function say(text, done) {
  stopTalking();
  if (!synth) { if (done) done(); return; }
  const chunks = [];
  (plain(text).match(/[^.!?;:]+[.!?;:]*\s*/g) || []).forEach(x => { const l = chunks[chunks.length - 1]; if (l && (l + x).length < 220) chunks[chunks.length - 1] = l + x; else chunks.push(x); });
  let i = 0;
  speaking = true; paintCall();
  const next = () => {
    if (!speaking || i >= chunks.length) { speaking = false; paintCall(); if (done) done(); return; }
    const u = new SpeechSynthesisUtterance(chunks[i++].trim());
    u.lang = navigator.language || "en-US"; const v = voice(); if (v) u.voice = v;
    u.onend = next; u.onerror = next;
    synth.speak(u);
  };
  next();
}
function stopTalking() { speaking = false; if (synth) synth.cancel(); }
function listen() {
  if (!call || busy || !isOpen()) { paintCall(); return; }
  const ta = $("#sheetBody textarea");
  if (!SRc || noMic) { paintCall(); return; }
  heard = "";
  try {
    rec = new SRc();
    rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = e => {
      let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (ta) { ta.value = t; grow(); }
      if (e.results[e.results.length - 1].isFinal) heard = t;
    };
    rec.onerror = e => { if (/not-allowed|service-not-allowed|network|audio-capture|language-not-supported/.test(e.error)) noMic = e.error; else if (e.error === "no-speech") quiet++; };
    rec.onend = () => {
      rec = null;
      const t = (heard || (ta ? ta.value : "")).trim();
      if (!call) { paintCall(); return; }
      if (t) { quiet = 0; if (ta) { ta.value = ""; grow(); } ask(t); }
      else if (!noMic && quiet < 3) setTimeout(listen, 250);
      else if (quiet >= 3) { hangUp(); toast("The call ended because it was quiet for a while"); return; }
      paintCall();
    };
    rec.start();
  } catch (e) { rec = null; noMic = "start"; }
  paintCall();
}
function stopListening() { if (rec) { const r = rec; rec = null; r.onend = r.onresult = r.onerror = null; try { r.abort(); } catch (e) {} } }
function startCall() { call = true; quiet = 0; stopTalking(); unlock(); listen(); paintCall(); }
function hangUp() { call = false; stopListening(); stopTalking(); paintCall(); }
function afterAnswer(a) {
  if (!call) return;
  const text = a.err || a.text || a.note || "";
  if (text && isOpen()) say(text, () => setTimeout(listen, 200)); else listen();
}
function paintCall() {
  const btn = $("#sheetBody .aicall"), bar = $("#sheetBody .aicallbar");
  if (!btn || !bar) return;
  btn.classList.toggle("on", call); btn.textContent = call ? "✕" : "📞"; btn.setAttribute("aria-label", call ? "Hang up" : "Voice call");
  bar.className = "aicallbar" + (call ? "" : " hide") + (rec ? " listening" : speaking ? " speaking" : busy ? " thinking" : "");
  bar.querySelector(".t").textContent = rec ? "Listening… say your question" : speaking ? "Web AI is talking… (tap ✕ to stop)" : busy ? "Thinking…"
    : noMic || !SRc ? "Type, or tap 🎤 on the keyboard to talk. Web AI answers out loud." : "On a call with Web AI";
}
document.addEventListener("visibilitychange", () => { if (document.hidden && call) hangUp(); });
// app.js wired the menu button to the menu before this file loaded; point it at the menu that has Web AI in it
$("#menuBtn").onclick = () => openMenu();
// and a Web AI button on the start page, first among Bookmarks, History...
const foot = $("#homeFoot");
if (foot && !foot.querySelector('[data-act="webai"]')) foot.insertAdjacentHTML("afterbegin", '<button type="button" data-act="webai" class="aihome">✦ Web AI</button>');
// the header buttons only belong to the Web AI sheet
const closeSheet0 = closeSheet;
closeSheet = function () { if (isOpen()) { if (busy) busy.abort(); hangUp(); } closeSheet0(); const h = $("#aiHead"); if (h) h.remove(); };
$("#sheetDone").addEventListener("click", () => { if (call) hangUp(); });      // Done was wired to the plain close before this file loaded
const openSheet0 = openSheet;
openSheet = function (title, html, opts) { const h = $("#aiHead"); if (h) h.remove(); return openSheet0(title, html, opts); };
window.WebAI = { open:openAI, ask:q => { openAI(); setTimeout(() => ask(q), 60); } };
})();
