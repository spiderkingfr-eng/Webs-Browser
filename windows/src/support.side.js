/* ---------------------------------------------------------------- Webs 3.6: Help & support, in the sidebar
   The chat with the people who make Webs. Writing here sends only what's written (and the
   version of Webs); support sees your settings on the list in js/support.settings.js, and can
   change them only while "Let support adjust my settings" is on: 30 minutes at most. The browser
   window (support.js) asks the server for replies and applies changes, each with Undo; this pane
   shows the chat (wsb.support) and tells the window it's on screen (wsb.supportPing). */
(function () {
"use strict";
const SS = window.SupportSettings;
if (!SS) return;
const VER = "@@WEBS_VERSION@@";
const E = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const st = () => get("support", {}) || {};
const setSt = o => put("support", Object.assign(st(), o));
const chatOn = () => !!(st().id && !st().ended);
const accessOn = () => chatOn() && (st().until || 0) > Date.now();
const mins = () => Math.max(1, Math.ceil(((st().until || 0) - Date.now()) / 60000));
const server = () => String((get("xai", {}) || {}).server || (get("xaiConfig", {}) || {}).server || "").trim().replace(/\/+$/, "");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
async function api(path, body) {
  const s = server();
  if (!/^https:\/\/\S+$/.test(s)) throw new Error("Help & support isn't set up yet. Try again after Webs updates.");
  let r;
  try { r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) }); }
  catch (e) { throw new Error("Couldn't reach Webs's server. Are you online?"); }
  const j = await r.json().catch(() => null);
  if (r.status === 404 && j && j.error === "gone") { const e = new Error(j.message); e.gone = true; throw e; }
  if (r.status === 404) throw new Error("Help & support isn't ready yet. Try again later.");
  if (!r.ok || !j) throw new Error(j && j.message || "Webs's server had a problem (" + r.status + ").");
  return j;
}
const LIFEBUOY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2"/></svg>';

/* the tab and the pane */
const nav = document.querySelector("nav"), tab = E("button", "sup-tab", LIFEBUOY + "<span>Help</span>");
tab.dataset.p = "support"; tab.title = "Help & support";
nav.appendChild(tab);
tab.onclick = () => { show("support"); history.replaceState(null, "", "#support"); paint(); };
const pane = E("div", "pane sup"); pane.id = "support";
document.body.insertBefore(pane, document.querySelector("script"));
pane.innerHTML = '<div class="sup-h"><b>' + LIFEBUOY + "Help &amp; support</b></div>" + '<div class="sup-log" aria-live="polite"></div><div class="sup-foot"></div>';
const log = pane.querySelector(".sup-log"), foot = pane.querySelector(".sup-foot");
const WHAT = SS.SUPPORT_SETTINGS.windows.map(([g, list]) => "<b>" + esc(g) + ":</b> " + esc(list.map(e => e.label).join(", "))).join("<br>");

function paint() { paintLog(); paintFoot(); }
let logSig = "", footSig = "";
function paintLog() {
  const s = st(), msgs = s.id ? s.msgs || [] : [], sig = (s.id || "") + ":" + msgs.length;
  if (sig === logSig) return;
  logSig = sig;
  log.innerHTML = "";
  if (!msgs.length) {
    log.innerHTML = '<div class="sup-hello"><div class="xai-orb">' + LIFEBUOY.replace('width="16" height="16"', 'width="26" height="26"') + "</div><h3>How can we help?</h3>" +
      "<p>Write what's going wrong. The people who make Webs answer here.</p>" +
      '<div class="sup-safe">🔒 Support only sees what you write here and, if you let them, the settings below. Never your history, bookmarks, tabs, passwords or the pages you visit.</div>' +
      '<details class="sup-what"><summary>What support can change, if you let them</summary><p>' + WHAT +
      "</p><p>For 30 minutes at most, and you see each change with Undo. Nothing that deletes anything, and nothing you typed in (no addresses, VPN servers or your own search engine).</p></details></div>";
    return;
  }
  for (const m of msgs) {
    const d = E("div", m.f === "u" ? "xai-q" : m.f === "a" ? "sup-a" : "sup-n");
    if (m.f === "u") d.appendChild(E("div", "xai-qt")).textContent = m.t;
    else if (m.f === "a") { d.appendChild(E("b")).textContent = "Webs support"; d.appendChild(document.createTextNode(m.t)); }
    else d.textContent = m.t;
    log.appendChild(d);
  }
  log.scrollTop = log.scrollHeight;
}
let wantAccess = false, confirmEnd = false;
function paintFoot() {
  const s = st();
  if (s.id && s.ended) {
    footSig = "ended";
    foot.innerHTML = '<button class="b m sup-new">Start a new chat</button>';
    foot.querySelector(".sup-new").onclick = () => { put("support", {}); wantAccess = false; paint(); };
    return;
  }
  const on = chatOn() ? accessOn() : wantAccess, ta0 = foot.querySelector("textarea"), keep = ta0 ? ta0.value : "", focused = ta0 && document.activeElement === ta0;
  const sig = [s.id, on, chatOn(), confirmEnd].join("|");
  if (sig === footSig && ta0) { const i = foot.querySelector(".sup-acc i"); if (i && on && chatOn()) i.textContent = "On · " + mins() + " min left. Turn off any time."; return; }
  footSig = sig;
  foot.innerHTML = '<label class="sup-acc' + (on ? " on" : "") + '"><span class="k">Let support adjust my settings<i>' +
    (on && chatOn() ? "On · " + mins() + " min left. Turn off any time." : on ? "For 30 minutes once you send this" : "Off. Support can't change anything.") + "</i></span>" +
    '<span class="sup-sw"><input type="checkbox"' + (on ? " checked" : "") + "><span></span></span></label>" +
    '<div class="xai-in"><textarea rows="1" maxlength="1000" placeholder="' + (chatOn() ? "Write to support…" : "What's going wrong?") + '" spellcheck="true"></textarea><button class="xai-send" title="Send (Enter)">↑</button></div>' +
    '<div class="sup-msg"></div>' +
    (chatOn() ? confirmEnd ? '<div class="sup-endq">End this chat? Support won\'t be able to answer it or change anything. <button class="b sup-yes">End chat</button><button class="b sup-no">Keep it</button></div>'
                           : '<button class="sup-end">End chat</button>' : "");
  const ta = foot.querySelector("textarea");
  ta.value = keep;
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; };
  ta.addEventListener("input", grow); if (keep) grow();
  if (focused) ta.focus();
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(ta.value); } });
  foot.querySelector(".xai-send").onclick = () => sendMsg(ta.value);
  foot.querySelector(".sup-acc input").onchange = e => setAccess(e.target.checked);
  const x = foot.querySelector(".sup-end"); if (x) x.onclick = () => { confirmEnd = true; paintFoot(); };
  const no = foot.querySelector(".sup-no"); if (no) no.onclick = () => { confirmEnd = false; paintFoot(); };
  const yes = foot.querySelector(".sup-yes"); if (yes) yes.onclick = endChat;
}
const say = (t, bad) => { const m = foot.querySelector(".sup-msg"); if (m) { m.textContent = t; m.classList.toggle("bad", !!bad); } };
const addMsgs = list => setSt({ msgs:(st().msgs || []).concat(list).slice(-150) });
function gone() { setSt({ ended:true, until:0 }); addMsgs([{ f:"n", t:"This chat has ended.", ts:Date.now() }]); paint(); }

async function sendMsg(text) {
  text = String(text || "").trim().slice(0, 1000);
  if (!text) { say(chatOn() ? "Write something first." : "Say what's going wrong first.", true); return; }
  const b = foot.querySelector(".xai-send"); b.disabled = true;
  say("Sending…");
  try {
    if (!chatOn()) {
      const j = await api("/support/open", { platform:"windows", version:VER, text, access:wantAccess });
      put("support", { id:j.id, token:j.token, since:0, msgs:[{ f:"u", t:text, ts:Date.now() }], until:j.access > 0 ? Date.now() + 30 * 60000 : 0, applied:[], done:[], sent:"", av:1 });
      wantAccess = false;
    } else {
      const s = st();
      await api("/support/send", { id:s.id, token:s.token, text });
      addMsgs([{ f:"u", t:text, ts:Date.now() }]);
    }
    const ta = foot.querySelector("textarea"); if (ta) ta.value = "";
    paint();
    const t2 = foot.querySelector("textarea"); if (t2) t2.focus();
  } catch (e) {
    if (e.gone) gone();
    say(e.message || "Couldn't send it.", true);
    const b2 = foot.querySelector(".xai-send"); if (b2) b2.disabled = false;
  }
}
async function setAccess(on) {
  if (!chatOn()) { wantAccess = on; paintFoot(); return; }      // sent along with the first message
  const s = st();
  setSt({ until:on ? Date.now() + 30 * 60000 : 0, av:(s.av || 0) + 1 });
  paintFoot();
  try {
    const j = await api("/support/access", { id:s.id, token:s.token, on });
    setSt({ until:on && j.access > 0 ? Date.now() + Math.max(0, j.access - (+j.now || Date.now())) : 0, av:(st().av || 0) + 1 });
    addMsgs([{ f:"n", t:on ? "You let support adjust your settings for 30 minutes" : "You ended support's access to your settings", ts:Date.now() }]);
  } catch (e) {
    if (e.gone) gone(); else say(e.message, true);
    if (!on) setSt({ until:0 });                                   // off stays off here, whatever happened
    else setSt({ until:0, av:(st().av || 0) + 1 });
  }
  paint();
}
async function endChat() {
  const s = st();
  confirmEnd = false;
  try { await api("/support/close", { id:s.id, token:s.token }); } catch (e) {}
  setSt({ ended:true, until:0 });
  addMsgs([{ f:"n", t:"You ended this chat.", ts:Date.now() }]);
  paint();
}

// on screen: the browser window asks the server every few seconds, and the reply is no longer new
const visible = () => pane.classList.contains("on") && document.visibilityState === "visible";
function ping() { if (visible()) { put("supportPing", Date.now()); if (st().unread) setSt({ unread:false }); } }
setInterval(ping, 3000);
setInterval(() => { if (visible() && accessOn()) { const i = foot.querySelector(".sup-acc i"); if (i) i.textContent = "On · " + mins() + " min left. Turn off any time."; } }, 15000);
addEventListener("storage", e => { if (e.key === "wsb.support") paint(); });

function routeS() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h !== "support") { tab.classList.remove("on"); return; }
  show("support"); paint(); ping();
  try { tab.scrollIntoView({ block:"nearest", inline:"nearest" }); } catch (e) {}
  setTimeout(() => { const ta = foot.querySelector("textarea"); if (ta) ta.focus(); }, 30);
}
addEventListener("hashchange", routeS);
routeS();
})();
