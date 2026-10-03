/* ---------------------------------------------------------------- Webs 3.6: Help & support
   Someone who is stuck writes to the people who make Webs (the chat is in the sidebar,
   side.html#support, support.side.js) and the answer comes back there. Support can change
   settings ONLY while the person has a chat open AND has turned on "Let support adjust my
   settings": 30 minutes at most, ended any time (the ✕ on the toolbar's 🛟, or the switch).
   Only the switches and choices on the list in js/support.settings.js, which this window checks
   every change against before applying it; each change shows with Undo.
   Support gets what's written in the chat and the values of the settings on that list. Never
   history, bookmarks, tabs, passwords or the pages you visit.
   One browser window at a time (wsb.supportLock) asks the Web AI server for replies and changes;
   the chat's state is wsb.support, shared with the sidebar through storage. */
(function () {
"use strict";
const SS = window.SupportSettings;
if (!SS) return;
Object.assign(P, { lifebuoy:"M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2" });
const st = () => load("support", {}) || {};
const setSt = o => save("support", Object.assign(st(), o));
const chatOn = () => !!(st().id && !st().ended);
const accessOn = () => chatOn() && (st().until || 0) > Date.now();
const mins = () => Math.max(1, Math.ceil(((st().until || 0) - Date.now()) / 60000));
const server = () => String((load("xai", {}) || {}).server || (load("xaiConfig", {}) || {}).server || "").trim().replace(/\/+$/, "");
async function api(path, body) {
  const s = server();
  if (!/^https:\/\/\S+$/.test(s)) throw new Error("Help & support isn't set up yet.");
  const r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (r.status === 404 && j && j.error === "gone") { const e = new Error(j.message); e.gone = true; throw e; }
  if (!r.ok || !j) throw new Error(j && j.message || "Webs's server had a problem (" + r.status + ").");
  return j;
}

/* ---------------------------------------------------------------- the settings on the list: what they are now, and changing them */
const STORE = { settings:() => cfg, shield:() => sh, vpn:() => vcfg };
const vpnUp = () => vpnState.state === "on" || vpnState.state === "connecting";
function valueNow(e) {
  if (e.t === "action") return undefined;
  if (e.k === "theme") return cfg.themeMode === "auto" ? "auto" : cfg.theme === "light" ? "light" : "dark";    // "auto" is kept as themeMode, like Settings does
  const v = STORE[e.s]()[e.k];
  if (e.t === "bool") return !!v;
  return v == null ? "" : String(v);
}
function snapshot() {
  const o = {};
  for (const [, list] of SS.SUPPORT_SETTINGS.windows) for (const e of list) {
    const v = SS.supportValue("windows", e.k, valueNow(e));
    if (v !== undefined) o[e.k] = v;
  }
  return o;
}
function setValue(e, v) {
  if (e.k === "vpnOff") { if (v) send("vpn-connect", "off"); else send("vpn-connect", vcfg.mode === "proxy" ? "proxy" : "tor"); return; }
  if (e.k === "theme") {
    if (v === "auto") { cfg.themeMode = "auto"; cfg.theme = sunTheme(); } else { cfg.themeMode = ""; cfg.theme = v; }
    saveNow("settings"); return;
  }
  STORE[e.s]()[e.k] = v;
  saveNow(e.s);
}
// reloadSettings() only tells the host about Shield and VPN changes made in another page, so changes made here are sent too
function tellHost(list) {
  reloadSettings();
  if (list.some(([e]) => e.s === "shield")) sendShield();
  if (list.some(([e]) => e.s === "vpn" && e.t !== "action")) sendVpnCfg();
}
const said = (e, v) => e.t === "action" ? (v ? "disconnected the VPN" : "") : e.t === "bool" ? (v ? "turned on " : "turned off ") + e.label :
  "changed " + e.label + " to " + ((e.o.find(x => x[0] === String(v)) || [, String(v)])[1]);
// changes from support: each one checked against the list; one toast with Undo for all of them
function applyChanges(changes) {
  const s = st(), applied = s.applied || [], undo = [], notes = [];
  for (const c of changes) {
    if (!c || !/^[a-z0-9]{8}$/.test(c.id) || applied.includes(c.id)) continue;
    applied.push(c.id);
    const e = SS.entry("windows", c.k), v = SS.supportValue("windows", c.k, c.v);
    if (!e || v === undefined) continue;                      // not on the list: never applied
    if (e.t === "action") {
      if (e.k !== "vpnOff" || !vpnUp()) continue;
      setValue(e, true); undo.push([e, false]); notes.push("Support " + said(e, true));
      continue;
    }
    const before = SS.supportValue("windows", e.k, valueNow(e));
    if (before === v) continue;
    setValue(e, v);
    undo.push([e, before]);
    notes.push("Support " + said(e, v));
  }
  setSt({ applied:applied.slice(-100), done:(s.done || []).concat(changes.map(c => c && c.id).filter(id => /^[a-z0-9]{8}$/.test(id || ""))).slice(-50) });
  if (!undo.length) return;
  tellHost(undo);
  addMsgs(notes.map(t => ({ f:"n", t, ts:Date.now() })));
  toast(undo.length === 1 ? notes[0] : "Support changed " + undo.length + " settings", { label:"Undo", fn:() => {
    undo.forEach(([e, before]) => { if (before !== undefined) setValue(e, before); });
    tellHost(undo);
    addMsgs([{ f:"n", t:"You undid " + (undo.length === 1 ? "that change" : "those changes"), ts:Date.now() }]);
    toast("Changed back");
    soon(300);
  } });
  soon(400);       // tell support right away what the settings are now
}
const addMsgs = list => { if (list.length) setSt({ msgs:(st().msgs || []).concat(list).slice(-150) }); };

/* ---------------------------------------------------------------- asking the server: one window at a time */
const LOCK = "wsb.supportLock";
function leader() {
  let l = null; try { l = JSON.parse(localStorage.getItem(LOCK) || "null"); } catch (e) {}
  if (l && l.w !== WIN && Date.now() - (+l.t || 0) < 45000) return false;
  try { localStorage.setItem(LOCK, JSON.stringify({ w:WIN, t:Date.now() })); } catch (e) {}
  return true;
}
addEventListener("beforeunload", () => { try { const l = JSON.parse(localStorage.getItem(LOCK) || "null"); if (l && l.w === WIN) localStorage.removeItem(LOCK); } catch (e) {} });
let busy = false, again = false, timer = 0, timerAt = 0;
// how often: every 4 seconds while the chat is on screen, 10 while support may adjust settings, 30 otherwise
const watching = () => Date.now() - (+load("supportPing", 0) || 0) < 9000;
function plan() {
  clearTimeout(timer); timer = 0;
  if (!chatOn()) return;
  const ms = watching() ? 4000 : accessOn() ? 10000 : 30000;
  timerAt = Date.now() + ms; timer = setTimeout(poll, ms);
}
const soon = ms => { if (busy) { again = true; return; } clearTimeout(timer); timerAt = Date.now() + (ms || 0); timer = setTimeout(poll, ms || 0); };
async function poll() {
  clearTimeout(timer); timer = 0;
  if (busy) { again = true; return; }
  if (!chatOn()) return;
  if (!leader()) return plan();
  busy = true;
  const s = st(), snap = snapshot(), sig = JSON.stringify(snap), done = s.done || [], av = s.av || 0;
  let j = null;
  try { j = await api("/support/poll", { id:s.id, token:s.token, since:s.since || 0, done, settings:sig !== s.sent ? snap : undefined }); }
  catch (e) { if (e.gone && st().id === s.id) end("This chat has ended."); }       // offline: try again later
  try { if (j && st().id === s.id) took(j, sig, done, av); }
  finally {
    busy = false;
    paintPill();
    if (again) { again = false; soon(300); } else plan();
  }
}
// what the server said
function took(j, sig, done, av) {
  const n = st();
  if (sig !== n.sent || done.length) setSt({ sent:sig, done:(n.done || []).filter(d => !done.includes(d)) });
  const fresh = (j.msgs || []).filter(m => m && typeof m.t === "string" && m.ts > (n.since || 0));
  if (fresh.length) {
    setSt({ since:Math.max.apply(null, fresh.map(m => +m.ts || 0)), unread:!watching() });
    addMsgs(fresh.map(m => ({ f:"a", t:String(m.t).slice(0, 1000), ts:+m.ts || Date.now() })));
    if (!watching()) toast("Webs support replied", { label:"Open", fn:() => openSide("support") });
  }
  if ((st().av || 0) !== av) return;               // not if they just turned access on or off in the sidebar
  const until = j.access > 0 ? Date.now() + Math.max(0, j.access - (+j.now || Date.now())) : 0, had = st().until || 0;
  if (!until !== !had || Math.abs(until - had) > 5000) setSt({ until });     // only real changes: each write wakes the other windows
  if (!j.open) end(j.closed ? "Webs support ended this chat." : "This chat has ended.");
  else if (until > Date.now() && Array.isArray(j.changes) && j.changes.length) applyChanges(j.changes);
}
function end(note) {
  if (st().ended) return;
  setSt({ ended:true, until:0, done:[] });
  addMsgs([{ f:"n", t:note, ts:Date.now() }]);
  paintPill();
}
async function endAccess() {
  const s = st();
  setSt({ until:0, av:(s.av || 0) + 1 });
  addMsgs([{ f:"n", t:"You ended support's access to your settings", ts:Date.now() }]);
  paintPill();
  try { await api("/support/access", { id:s.id, token:s.token, on:false }); } catch (e) {}
}

/* ---------------------------------------------------------------- the toolbar's 🛟 while support may adjust settings */
const pill = el("span", "suppill hide");
pill.innerHTML = '<button class="supgo" title="Help & support">' + ico("lifebuoy") + "<span></span></button>" +
  '<button class="supx" title="End support\'s access to your settings">✕</button>';
pill.querySelector(".supgo").onclick = () => openSide("support");
pill.querySelector(".supx").onclick = endAccess;
($("#aib") || $("#sideb")).before(pill);
function paintPill() {
  const on = accessOn();
  pill.classList.toggle("hide", !on);
  if (on) { pill.querySelector("span").textContent = "Support · " + mins() + " min"; pill.title = "Support can adjust your settings for " + mins() + " more minutes"; }
}
setInterval(paintPill, 15000);

/* ---------------------------------------------------------------- the sidebar pane, the menu, the command palette */
const openSide6 = openSide;
openSide = function (which, what) {
  if (which !== "support") return openSide6(which, what);
  if (!side.open) { const r = $("#rail"); r.classList.add("opening"); setTimeout(() => r.classList.remove("opening"), 500); }
  side.open = true; side.which = "support";
  send("side-open", HOME + "side.html?w=" + WIN + "#support");
  renderRail(); paint(); relayout();
};
X3.support = () => openSide("support");
const menuRows6 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows6) menuRows6(m);
  m.appendChild(row("lifebuoy", "Help & support", st().unread && chatOn() ? "New reply" : accessOn() ? "Connected" : "", () => openSide("support")));
};
const commands6 = commands;
commands = function () {
  return commands6().concat([{ t:"Help & support: write to the people who make Webs", k:"", i:"lifebuoy", fn:() => openSide("support") }]);
};

addEventListener("storage", e => {
  if (e.key === "wsb.support") {
    paintPill();
    let o = null, n = null; try { o = JSON.parse(e.oldValue || "null"); n = JSON.parse(e.newValue || "null"); } catch (x) {}
    // the sidebar started a chat, sent a message or changed access: ask the server soon
    if (n && n.id && (!o || o.id !== n.id || (o.msgs || []).length !== (n.msgs || []).length || o.av !== n.av)) soon(1200);
  }
  // the chat came on screen: from now on every 4 seconds
  if (e.key === "wsb.supportPing" && chatOn() && !busy && (!timer || timerAt - Date.now() > 4500)) soon(300);
});
if (st().until && !accessOn()) setSt({ until:0 });
paintPill();
setTimeout(() => { if (chatOn()) soon(0); }, 2500);
window.WebsSupport = { snapshot, poll, endAccess };      // for tests
})();
