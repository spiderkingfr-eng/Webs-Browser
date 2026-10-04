/* Webs Browser for iPhone - Help & support (Menu → Help & support).
   Someone who is stuck writes to the people who make Webs, and the answer comes back here (and as a
   notification, when those are on). Support can change settings ONLY while the person has a chat
   open AND has turned on "Let support adjust my settings": 30 minutes at most, ended any time with
   one tap, and only the switches and choices in js/support.settings.js, which this file checks
   every change against before applying it. Each change shows with Undo.
   What support gets: what's written in the chat, and the values of the settings on that list.
   Never history, bookmarks, tabs, notes, passwords or the pages you visit.
   It goes through the Web AI server (server/web-ai, "support"). The phone keeps wsb.support:
   { id, token, since, msgs, until, ended, applied, sent }. */
"use strict";

(function () {
const SS = window.SupportSettings;
if (!SS) return;
const st = () => load("support", {}) || {};
const setSt = o => save("support", Object.assign(st(), o));
const isOpen = () => $("#sheet").dataset.kind === "support" && !$("#sheet").classList.contains("hide");
const chatOn = () => !!(st().id && !st().ended);
const accessOn = () => chatOn() && (st().until || 0) > Date.now();
const mins = () => Math.max(1, Math.ceil(((st().until || 0) - Date.now()) / 60000));
P.lifebuoy = "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2";

/* ---------------------------------------------------------------- the server (the Web AI server's address comes with updates) */
async function server() {
  const a = String((load("xaiConfig", {}) || {}).server || "").replace(/\/+$/, "");
  if (/^https:\/\/\S+$/.test(a)) return a;
  const p = String((load("push", {}) || {}).server || "");
  if (/^https:\/\/\S+$/.test(p)) return p;
  try {
    const j = await (await fetch("updates/iphone.json?t=" + Date.now(), { cache:"no-store" })).json();
    const s = String(j && j.webai && j.webai.server || "").replace(/\/+$/, "");
    if (/^https:\/\/[^\s/?#]+\.[^\s/?#]+$/i.test(s)) return s;
  } catch (e) {}
  return "";
}
async function api(path, body) {
  const s = await server();
  if (!s) throw new Error("Help & support isn't set up yet. Try again later.");
  let r;
  try { r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) }); }
  catch (e) { throw new Error("Couldn't reach Webs's server. Are you online?"); }
  const j = await r.json().catch(() => null);
  if (r.status === 404 && j && j.error === "gone") { const e = new Error(j.message); e.gone = true; throw e; }
  if (r.status === 404) throw new Error("Help & support isn't ready yet. Try again later.");
  if (!r.ok || !j) { const e = new Error(j && j.message || "Webs's server had a problem (" + r.status + ")."); e.code = j && j.error; throw e; }
  return j;
}

/* ---------------------------------------------------------------- the settings support may see and change (only those on the list) */
function valueNow(e) {
  const k = e.k;
  if (k.startsWith("show:")) return !hidden(k.slice(5));
  if (k === "theme") return cfg.theme === "light" || cfg.theme === "dark" ? cfg.theme : "auto";
  if (k === "barPos") return cfg.barPos === "top" ? "top" : "bottom";
  if (k === "motion") return cfg.motion === "off" ? "off" : "";
  if (e.t === "bool") return cfg[k] === undefined ? false : !!cfg[k];
  return cfg[k] == null ? "" : String(cfg[k]);
}
function snapshot() {
  const o = {};
  for (const [, list] of SS.SUPPORT_SETTINGS.iphone) for (const e of list) {
    if (e.t === "action") continue;
    const v = SS.supportValue("iphone", e.k, valueNow(e));
    if (v !== undefined) o[e.k] = v;
  }
  return o;
}
function setValue(k, v) {
  if (k.startsWith("show:")) setHidden(k.slice(5), !v);
  else setCfg(k, v);
}
const said = (e, v) => e.t === "bool" ? (v ? "turned on " : "turned off ") + e.label : "changed " + e.label + " to " + ((e.o.find(x => x[0] === String(v)) || [, String(v)])[1]);
function redraw() {
  afterSetting();
  if ($("#sheet").dataset.kind === "settings" && !$("#sheet").classList.contains("hide")) refreshSettings();
}
// changes from support: each one checked against the list; one toast with Undo for all of them
function applyChanges(changes) {
  const s = st(), applied = s.applied || [], undo = [], notes = [];
  for (const c of changes) {
    if (!c || !/^[a-z0-9]{8}$/.test(c.id) || applied.includes(c.id)) continue;
    applied.push(c.id);
    const e = SS.entry("iphone", c.k), v = SS.supportValue("iphone", c.k, c.v);
    if (!e || e.t === "action" || v === undefined) continue;          // not on the list: never applied
    const before = SS.supportValue("iphone", e.k, valueNow(e));
    if (before === v) continue;
    setValue(e.k, v);
    undo.push([e, before]);
    notes.push("Support " + said(e, v));
  }
  setSt({ applied:applied.slice(-100), done:(s.done || []).concat(changes.map(c => c && c.id).filter(id => /^[a-z0-9]{8}$/.test(id || ""))).slice(-50) });
  if (!undo.length) return;
  redraw();
  addMsgs(notes.map(t => ({ f:"n", t, ts:Date.now() })));
  toast(undo.length === 1 ? notes[0] : "Support changed " + undo.length + " settings", { label:"Undo", fn:() => {
    undo.forEach(([e, before]) => { if (before !== undefined) setValue(e.k, before); });
    redraw();
    addMsgs([{ f:"n", t:"You undid " + (undo.length === 1 ? "that change" : "those changes"), ts:Date.now() }]);
    toast("Changed back");
    soon(300);
  } });
  soon(400);       // tell support right away what the settings are now
}

/* ---------------------------------------------------------------- the chat */
function addMsgs(list) {
  if (!list.length) return;
  setSt({ msgs:(st().msgs || []).concat(list).slice(-150) });
  if (isOpen()) paintLog();
}
let gen = 0, busy = false, again = false, timer = 0;
async function poll() {
  clearTimeout(timer); timer = 0;
  if (busy) { again = true; return; }
  if (!chatOn()) return;
  busy = true;
  const g = gen, s = st(), snap = snapshot(), sig = JSON.stringify(snap), done = s.done || [];
  let j = null;
  try { j = await api("/support/poll", { id:s.id, token:s.token, since:s.since || 0, done, settings:sig !== s.sent ? snap : undefined }); }
  catch (e) { if (e.gone && st().id === s.id) end("This chat has ended."); }       // offline: try again later
  try { if (j && st().id === s.id) took(j, sig, done, g); }
  finally {
    busy = false;
    paintBar();
    if (isOpen()) paintFoot();
    if (again) { again = false; soon(300); } else plan();
  }
}
// what the server said
function took(j, sig, done, g) {
  const n = st();
  setSt({ sent:sig, done:(n.done || []).filter(d => !done.includes(d)) });
  const fresh = (j.msgs || []).filter(m => m && typeof m.t === "string" && m.ts > (n.since || 0));
  if (fresh.length) {
    setSt({ since:Math.max.apply(null, fresh.map(m => +m.ts || 0)), unread:!isOpen() });
    addMsgs(fresh.map(m => ({ f:"a", t:String(m.t).slice(0, 1000), ts:+m.ts || Date.now() })));
    if (!isOpen()) toast("Webs support replied", { label:"Open", fn:openSupport });
  }
  if (g !== gen) return;                           // not if they just turned access on or off
  // the server's clock may differ from the phone's: the countdown runs on the phone's
  const until = j.access > 0 ? Date.now() + Math.max(0, j.access - (+j.now || Date.now())) : 0;
  setSt({ until });
  if (!j.open) end(j.closed ? "Webs support ended this chat." : "This chat has ended.");
  else if (until > Date.now() && Array.isArray(j.changes) && j.changes.length) applyChanges(j.changes);
}
// how often: every 4 seconds with Help & support open, 10 while support may adjust settings, 30 otherwise (only while Webs is on screen)
function plan() {
  clearTimeout(timer); timer = 0;
  if (!chatOn() || document.visibilityState === "hidden") return;
  timer = setTimeout(poll, isOpen() ? 4000 : accessOn() ? 10000 : 30000);
}
const soon = ms => { if (busy) { again = true; return; } clearTimeout(timer); timer = setTimeout(poll, ms || 0); };
function end(note) {
  if (st().ended) return;
  setSt({ ended:true, until:0, done:[] });
  addMsgs([{ f:"n", t:note, ts:Date.now() }]);
  paintBar();
  if (isOpen()) paint();
}

async function send(text) {
  text = String(text || "").trim().slice(0, 1000);
  const msg = $("#sheetBody .supmsg");
  if (!text) { if (msg) msg.textContent = "Say what's going wrong first."; return; }
  const btn = $("#sheetBody .aisend"); if (btn) btn.disabled = true;
  if (msg) { msg.textContent = "Sending…"; msg.classList.remove("bad"); }
  try {
    if (!chatOn()) {
      const push = cfg.pushOn ? String((load("push", {}) || {}).endpoint || "") : "";
      const want = !!(($("#sheetBody .supacc input") || {}).checked);
      const j = await api("/support/open", { platform:"iphone", version:VERSION, text, access:want, settings:snapshot(), push, device:window.Live ? Live.dev() : "" });
      gen++;
      save("support", { id:j.id, token:j.token, since:0, msgs:[{ f:"u", t:text, ts:Date.now() }], until:j.access > 0 ? Date.now() + 30 * 60000 : 0, applied:[], done:[], sent:"" });
    } else {
      const s = st();
      await api("/support/send", { id:s.id, token:s.token, text });
      addMsgs([{ f:"u", t:text, ts:Date.now() }]);
    }
    if (isOpen()) { paint(); const ta = $("#sheetBody textarea"); if (ta) { ta.value = ""; ta.style.height = ""; } }
    paintBar();
    soon(1500);
  } catch (e) {
    if (e.gone) end("This chat has ended.");
    if (msg) { msg.textContent = e.message || "Couldn't send it."; msg.classList.add("bad"); }
  }
  if (btn) btn.disabled = false;
}
async function setAccess(on) {
  gen++;
  const s = st();
  if (!chatOn()) { paintFoot(); return; }                          // before the first message: sent along with it
  setSt({ until:on ? Date.now() + 30 * 60000 : 0 });
  paintBar(); paintFoot();
  try {
    const j = await api("/support/access", { id:s.id, token:s.token, on });
    gen++;
    setSt({ until:j.access > 0 ? Date.now() + Math.max(0, j.access - (+j.now || Date.now())) : 0 });
    addMsgs([{ f:"n", t:on ? "You let support adjust your settings for 30 minutes" : "You ended support's access to your settings", ts:Date.now() }]);
  } catch (e) {
    if (e.gone) end("This chat has ended.");
    else toast(e.message);
    if (!on) setSt({ until:0 });                                   // off stays off here, whatever the server said
  }
  paintBar(); if (isOpen()) paintFoot();
  plan();
}
function endChat() {
  if (!chatOn()) return;
  pick("End this chat?", [{ label:"End chat", danger:true, fn:async () => {
    const s = st();
    gen++;
    try { await api("/support/close", { id:s.id, token:s.token }); } catch (e) {}
    end("You ended this chat.");
  } }], "Support won't be able to answer it or change anything.");
}

/* ---------------------------------------------------------------- the screen */
const WHAT = SS.SUPPORT_SETTINGS.iphone.map(([g, list]) => "<b>" + esc(g) + ":</b> " + esc(list.map(e => e.label).join(", "))).join("<br>");
function openSupport() {
  closeOmni();
  openSheet("Help & support", '<div class="ai sup"><div class="ailog"></div><div class="aifoot"></div></div>', { full:true, kind:"support" });
  setSt({ unread:false });
  paint();
  if (chatOn()) soon(200);
}
function paint() { if (!isOpen()) return; paintLog(); paintFoot(); }
function paintLog() {
  const log = $("#sheetBody .ailog"); if (!log) return;
  const s = st(), msgs = s.id ? s.msgs || [] : [];
  log.innerHTML = "";
  if (!msgs.length || !s.id) {
    log.innerHTML = '<div class="aihello suphello"><div class="aiorb">' + ico("lifebuoy") + "</div><h3>How can we help?</h3>" +
      "<p>Write what's going wrong. The people who make Webs answer here" + (cfg.pushOn ? ", and you'll get a notification" : "") + ".</p>" +
      '<div class="supsafe">🔒 Support only sees what you write here' + " and, if you let them, the settings below. Never your history, bookmarks, tabs, notes, passwords or the pages you visit.</div>" +
      '<details class="supwhat"><summary>What support can change, if you let them</summary><p>' + WHAT + "</p><p>For 30 minutes at most. Nothing that deletes anything, and nothing you typed in.</p></details></div>";
    extras(log);
    return;
  }
  for (const m of msgs) {
    const d = document.createElement("div");
    d.className = m.f === "u" ? "aiq" : m.f === "a" ? "supa" : "supn";
    if (m.f === "a") { const b = document.createElement("b"); b.textContent = "Webs support"; d.appendChild(b); d.appendChild(document.createTextNode(m.t)); }
    else d.textContent = m.t;
    log.appendChild(d);
  }
  log.scrollTop = log.scrollHeight;
}
// help articles from the people who make Webs, and problem reports (with their answers)
let reporting = false;
function extras(log) {
  if (!window.Live) return;
  const faq = Live.faq(), reps = Live.myReports();
  if (faq.length) {
    const box = document.createElement("div"); box.className = "supfaq";
    box.innerHTML = "<h4>Common questions</h4>" + faq.map(x => "<details><summary>" + esc(x.q) + "</summary><p>" + esc(x.a) + "</p></details>").join("");
    log.appendChild(box);
  }
  const r = document.createElement("div"); r.className = "suprep";
  if (reporting) {
    r.innerHTML = "<h4>Send a problem report</h4><p>What went wrong? Webs adds its version, your screen size and any recent errors, nothing else.</p>" +
      '<textarea rows="3" maxlength="4000" placeholder="The weather stopped loading after the update…"></textarea><div class="suprb"><button type="button" class="supgo">Send report</button><button type="button" class="supno">Cancel</button></div>';
    r.querySelector(".supno").onclick = () => { reporting = false; paintLog(); };
    r.querySelector(".supgo").onclick = async () => {
      const t = r.querySelector("textarea").value.trim(); if (!t) return;
      r.querySelector(".supgo").disabled = true;
      try { await Live.report(t, { standalone:isStandalone(), notifications:!!cfg.pushOn }); reporting = false; toast("Report sent. Thank you!"); paintLog(); }
      catch (e) { toast(e.message); r.querySelector(".supgo").disabled = false; }
    };
  } else r.innerHTML = '<button type="button" class="suplink">Send a problem report instead</button>';
  if (reps.length) {
    const l = document.createElement("div"); l.className = "suprl";
    l.innerHTML = "<h4>Your problem reports</h4>" + reps.slice(0, 5).map(x => '<div class="supri"><b>' + esc(x.text.slice(0, 80)) + "</b><span>" + (x.fixed ? "✅ Fixed · " : x.reply ? "💬 Answered · " : "Sent · ") +
      esc(new Date(x.ts).toLocaleDateString()) + "</span>" + (x.reply ? '<p class="supa"><b>Webs support</b>' + esc(x.reply.t) + "</p>" : "") + "</div>").join("");
    r.appendChild(l);
    Live.readReports(); Live.replies(true);
  }
  const btn = r.querySelector(".suplink"); if (btn) btn.onclick = () => { reporting = true; paintLog(); const ta = $("#sheetBody .suprep textarea"); if (ta) ta.focus(); };
  log.appendChild(r);
}
async function rate(v) {
  const s = st();
  setSt({ rated:v });
  paintFoot();
  try { await api("/support/rate", { id:s.id, token:s.token, r:v }); } catch (e) {}
  toast(v > 0 ? "Thanks! 😊" : "Thanks for telling us. We'll do better.");
}
function paintFoot() {
  const f = $("#sheetBody .aifoot"); if (!f) return;
  const s = st();
  if (s.id && s.ended) {
    f.innerHTML = (s.rated ? "" : '<div class="suprate"><span>How was the help?</span><button type="button" data-r="1" aria-label="Good">👍</button><button type="button" data-r="-1" aria-label="Not good">👎</button></div>') +
      '<button type="button" class="supnew">Start a new chat</button>';
    f.querySelectorAll("[data-r]").forEach(b => b.onclick = () => rate(+b.dataset.r));
    f.querySelector(".supnew").onclick = () => { save("support", {}); paint(); };
    return;
  }
  const on = chatOn() ? accessOn() : !!(f.querySelector(".supacc input") || {}).checked;
  const keep = f.querySelector("textarea") ? f.querySelector("textarea").value : "";
  f.innerHTML = '<label class="supacc' + (on ? " on" : "") + '"><span class="k">Let support adjust my settings<i>' +
    (on && chatOn() ? "On · " + mins() + " min left. Turn off any time." : on ? "For 30 minutes once you send this" : "Off. Support can't change anything.") + "</i></span>" +
    '<span class="sw"><input type="checkbox"' + (on ? " checked" : "") + "><span></span></span></label>" +
    '<div class="aiin"><textarea rows="1" maxlength="1000" placeholder="' + (chatOn() ? "Write to support…" : "What's going wrong?") + '" enterkeyhint="send"></textarea><button type="button" class="aisend" aria-label="Send">' + ico("up") + "</button></div>" +
    '<div class="supmsg aimsg"></div>' + (chatOn() ? '<button type="button" class="supend">End chat</button>' : "");
  const ta = f.querySelector("textarea");
  ta.value = keep;
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
  f.querySelector(".aisend").onclick = () => send(ta.value);
  f.querySelector(".supacc input").onchange = e => setAccess(e.target.checked);
  const x = f.querySelector(".supend"); if (x) x.onclick = endChat;
}
// the banner, wherever you are, while support may adjust settings
function paintBar() {
  let b = $("#supBar");
  if (!accessOn()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement("div"); b.id = "supBar"; b.setAttribute("role", "status");
    b.innerHTML = "<span></span><button type=\"button\">End</button>";
    b.firstChild.onclick = openSupport;
    b.querySelector("button").onclick = () => setAccess(false);
    document.body.appendChild(b);
  }
  b.firstChild.textContent = "🛟 Support connected · " + mins() + " min left";
  b.title = "Support can adjust your settings for " + mins() + " more minutes";
}
setInterval(() => { paintBar(); if (isOpen() && accessOn()) { const i = $("#sheetBody .supacc i"); if (i) i.textContent = "On · " + mins() + " min left. Turn off any time."; } }, 15000);

const css = document.createElement("style");
css.textContent = `
.sup .aiorb .ic{width:32px;height:32px;color:#fff;stroke:#fff}
.supsafe{background:var(--bg2);border:1px solid var(--line);border-radius:13px;padding:11px 13px;font-size:13.5px;line-height:1.45;color:var(--dim);text-align:left}
.supwhat{margin-top:10px;text-align:left;font-size:13.5px;color:var(--dim);line-height:1.5}
.supwhat summary{color:var(--accent);font-weight:600;cursor:pointer;padding:4px 0}
.supwhat p{margin:6px 0 0}
.supwhat b{color:var(--fg);font-weight:600}
.supa{align-self:flex-start;max-width:86%;background:var(--bg2);border:1px solid var(--line);border-radius:18px 18px 18px 5px;padding:8px 13px 9px;font-size:16px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;animation:aiup .25s ease both}
.supa b{display:block;font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px}
.supn{align-self:center;max-width:90%;text-align:center;font-size:13px;color:var(--dim);line-height:1.4}
.supacc{display:flex;align-items:center;gap:12px;padding:2px 2px 9px}
.supacc .k{flex:1;min-width:0;font-size:15px;font-weight:600}
.supacc .k i{display:block;font-style:normal;font-weight:400;font-size:12.5px;color:var(--dim);margin-top:1px}
.supacc.on .k i{color:var(--good)}
.supend{display:block;margin:4px auto 0;font-size:14px;color:var(--dim);padding:4px 10px}
.supnew{display:block;width:100%;height:48px;border-radius:13px;background:var(--accent);color:#fff;font-size:16.5px;font-weight:600}
.suprate{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:10px;font-size:15px}.suprate button{font-size:24px;width:48px;height:42px;border-radius:12px;background:var(--bg2);border:1px solid var(--line)}
.supfaq,.suprep{text-align:left;margin-top:14px}.supfaq h4,.suprep h4{font-size:12.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim2);margin:10px 4px 6px}
.supfaq details{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:6px}.supfaq summary{font-weight:600;font-size:15px;cursor:pointer}.supfaq p{margin:8px 0 0;color:var(--dim);font-size:14.5px;line-height:1.45;white-space:pre-wrap}
.suplink{display:block;margin:6px auto 0;color:var(--accent);font-size:14.5px;font-weight:600;padding:6px}
.suprep>p{color:var(--dim);font-size:13.5px;margin:0 4px 8px}.suprep textarea{width:100%;border:1px solid var(--line);background:var(--bg2);color:var(--fg);border-radius:12px;padding:10px;font:15px/1.4 inherit}
.suprb{display:flex;gap:8px;margin-top:8px}.suprb button{flex:1;height:42px;border-radius:12px;background:var(--bg3);font-weight:600}.suprb .supgo{background:var(--accent);color:#fff}
.supri{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:6px}.supri b{display:block;font-size:14.5px}.supri span{display:block;color:var(--dim);font-size:12.5px}.supri .supa{margin:8px 0 0;max-width:none}
#supBar{position:fixed;left:50%;top:calc(var(--st) + 8px);transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);
  padding:6px 6px 6px 13px;border-radius:20px;background:var(--good);color:#062614;font-size:13.5px;font-weight:600;box-shadow:var(--shadow);white-space:nowrap}
#supBar span{overflow:hidden;text-overflow:ellipsis;cursor:pointer}
#supBar button{flex:none;background:rgba(0,0,0,.16);color:inherit;border-radius:14px;padding:5px 12px;font-weight:700;font-size:13.5px}
body.bartop #supBar{top:auto;bottom:calc(84px + var(--sb))}
#sheet:not(.hide) ~ #supBar{top:auto;bottom:calc(14px + var(--sb))}
#sheet[data-kind="support"]:not(.hide) ~ #supBar{display:none}
`;
document.head.appendChild(css);

/* ---------------------------------------------------------------- Menu → Help & support, and ?go=support (a reply's notification) */
const openMenu1 = openMenu;
openMenu = function () {
  openMenu1();
  const s = st(), help = $('#sheetBody .mrow[data-act="help"]');
  const row = '<button type="button" class="mrow" data-act="support">' + ico("lifebuoy") + "<span>Help &amp; support</span>" +
    (s.unread && chatOn() ? "<em>New reply</em>" : accessOn() ? "<em>Support connected</em>" : "") + "</button>";
  if (help) help.insertAdjacentHTML("beforebegin", row);
};
ACTIONS.support = openSupport;

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && chatOn()) soon(300); else if (document.visibilityState === "hidden") { clearTimeout(timer); timer = 0; } });
document.addEventListener("DOMContentLoaded", () => {
  if (st().until && !accessOn()) setSt({ until:0 });
  paintBar();
  if (chatOn()) soon(2000);
});
// for tests
window.WebsSupport = { snapshot, poll, open:openSupport };
})();
