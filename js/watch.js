/* Webs Browser - watching (Windows 3.14, iPhone 2.11; ideas #076-#100), shared by both apps: what you keep about the
   videos you watch, all on this device.
     #078 watch later      one queue for videos from any site (wsb.watchLater)
     #082 video moments    a moment in a video, with a note, to jump back to (wsb.vbm)
     #092 #093 streamers   the Twitch streamers you follow (wsb.streamers): who's live now and when they stream next,
                           from the Web AI server (GET /streams, server/web-ai/streams.js)
     #097 watch stats      how long you watched each day, by site (wsb.watchStats { "2026-10-06": { host: seconds } })
   Watch.panel(el, app, tab)  the Watching panel: Watch later, Moments, Streamers, This week, and app.tabs (more of the
                              app's own: [{ id, name, render(body) }]). app: { open(url), server(), current() -> { u, t } }
   Watch.liveDot(fn)          fn(n) with how many you follow are live, now and every few minutes */
(function () {
"use strict";
if (window.Watch) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const day = d => (d || new Date()).toLocaleDateString("en-CA");
const clock = s => { s = Math.max(0, Math.round(+s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const dur = s => { s = s > 0 ? Math.max(1, Math.round(s / 60)) : 0; return s >= 60 ? Math.floor(s / 60) + " h " + (s % 60 ? (s % 60) + " min" : "") : s + " min"; };
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

/* ---------------------------------------------------------------- #078 watch later */
const later = () => (get("watchLater", []) || []).filter(x => x && /^https?:\/\//.test(x.u)).slice(0, 200);
function addLater(u, t) {
  if (!/^https?:\/\//.test(u || "")) return false;
  const l = later().filter(x => x.u !== u);
  l.unshift({ u, t:String(t || hostOf(u)).slice(0, 160), host:hostOf(u), ts:Date.now() });
  put("watchLater", l.slice(0, 200)); return true;
}
const delLater = u => put("watchLater", later().filter(x => x.u !== u));
const inLater = u => later().some(x => x.u === u);

/* ---------------------------------------------------------------- #082 moments in videos */
const marks = () => (get("vbm", []) || []).filter(x => x && /^https?:\/\//.test(x.u)).slice(0, 300);
function addMark(m) {
  if (!m || !/^https?:\/\//.test(m.u || "")) return null;
  const x = { id:Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u:m.u, t:String(m.t || hostOf(m.u)).slice(0, 160), at:Math.max(0, Math.round(+m.at || 0)), note:String(m.note || "").slice(0, 300), ts:Date.now() };
  put("vbm", [x].concat(marks()).slice(0, 300)); return x;
}
const delMark = id => put("vbm", marks().filter(x => x.id !== id));
const editMark = (id, note) => put("vbm", marks().map(x => x.id === id ? Object.assign(x, { note:String(note || "").slice(0, 300) }) : x));
// the address that opens a video at a moment, on sites that have one (others get the time after the page loads)
function timeUrl(u, s) {
  s = Math.max(0, Math.round(+s || 0));
  try {
    const x = new URL(u), h = x.hostname.replace(/^(www|m)\./, "");
    if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") { x.searchParams.set("t", s + "s"); return { u:x.href, done:true }; }
    if (h === "vimeo.com") { x.hash = "t=" + s + "s"; return { u:x.href, done:true }; }
    if (h === "twitch.tv" && /^\/videos\//.test(x.pathname)) { x.searchParams.set("t", Math.floor(s / 3600) + "h" + Math.floor(s % 3600 / 60) + "m" + (s % 60) + "s"); return { u:x.href, done:true }; }
    if (h === "dailymotion.com") { x.searchParams.set("start", s); return { u:x.href, done:true }; }
  } catch (e) {}
  return { u, done:false };
}

/* ---------------------------------------------------------------- #097 watch stats */
function addStat(host, secs, d) {
  if (!host || !(secs > 0)) return;
  const all = get("watchStats", {}) || {}, k = d || day();
  all[k] = all[k] || {}; all[k][host] = Math.round((all[k][host] || 0) + Math.min(secs, 120));
  const keep = Object.keys(all).sort().slice(-60); Object.keys(all).forEach(x => { if (keep.indexOf(x) < 0) delete all[x]; });
  put("watchStats", all);
}
function week(now) {
  const all = get("watchStats", {}) || {}, out = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(now || Date.now()); d.setDate(d.getDate() - i); const k = day(d), h = all[k] || {}; out.push({ day:k, name:d.toLocaleDateString([], { weekday:"short" }), total:Object.values(h).reduce((a, b) => a + b, 0), hosts:h }); }
  return out;
}

/* ---------------------------------------------------------------- #092 #093 streamers */
const streamers = () => (get("streamers", []) || []).filter(x => /^[a-z0-9_]{3,25}$/.test(x)).slice(0, 20);
function follow(name, on) { name = String(name || "").trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\/(www\.)?twitch\.tv\//, "").split(/[/?#]/)[0]; if (!/^[a-z0-9_]{3,25}$/.test(name)) return false; const l = streamers().filter(x => x !== name); if (on !== false) l.push(name); put("streamers", l.slice(0, 20)); cache = null; return true; }
let cache = null;
function server() {
  for (const s of [(get("xai", {}) || {}).server, (get("xaiConfig", {}) || {}).server]) { const a = String(s || "").trim().replace(/\/+$/, ""); if (/^https:\/\/\S+$/.test(a)) return a; }
  return "";
}
async function streams(force) {
  const l = streamers(); if (!l.length) return { ok:true, live:[], next:[], users:[] };
  if (!force && cache && cache.k === l.join() && Date.now() - cache.at < 120e3) return cache.d;
  const s = server(); if (!s) throw new Error("Open Web AI once first: who's live comes from its server.");
  const j = await (await fetch(s + "/streams?u=" + encodeURIComponent(l.join(",")))).json().catch(() => null);
  if (!j) throw new Error("The server didn't answer. Try again later.");
  if (!j.ok) { const e = new Error(j.message || "Streamers aren't available right now."); e.code = j.error; throw e; }
  cache = { k:l.join(), at:Date.now(), d:j };
  return j;
}
const dots = new Set();
function liveDot(fn) { dots.add(fn); tick(); return () => dots.delete(fn); }
async function tick() { if (!dots.size) return; let n = 0; try { if (streamers().length) n = (await streams()).live.length; } catch (e) {} dots.forEach(f => { try { f(n); } catch (e) {} }); }
setInterval(() => { if (!document.hidden) tick(); }, 3 * 60000);

/* ---------------------------------------------------------------- the panel */
const TABS = [["later", "Watch later"], ["marks", "Moments"], ["live", "Streamers"], ["week", "This week"]];
function panel(el, app, tab) {
  app = app || {};
  const tabs = TABS.concat((app.tabs || []).map(t => [t.id, t.name]));
  tab = tab || get("watchTab", "later"); if (!tabs.some(t => t[0] === tab)) tab = "later";
  el.classList.add("wt");
  el.innerHTML = '<div class="wt-tabs hscroll" role="tablist">' + tabs.map(t => '<button type="button" role="tab" data-t="' + t[0] + '">' + esc(t[1]) + "</button>").join("") + '</div><div class="wt-body"></div>';
  const body = el.querySelector(".wt-body"), open = u => app.open && app.open(u);
  const show = t => {
    tab = t; put("watchTab", t);
    el.querySelectorAll(".wt-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    const own = (app.tabs || []).find(x => x.id === t);
    try { if (own) own.render(body); else V[t](); } catch (e) { body.textContent = e.message; }
  };
  el.querySelectorAll(".wt-tabs button").forEach(b => { b.onclick = () => show(b.dataset.t); });
  const cur = () => app.current ? app.current() : null;
  const V = {
    later() {
      const l = later(), c = cur();
      body.innerHTML = (c && c.u && !inLater(c.u) ? '<button type="button" class="wt-btn wt-add">＋ Add “' + esc(c.t || hostOf(c.u)) + '”</button>' : "") +
        (l.length ? '<div class="wt-list">' + l.map((x, i) => '<div class="wt-row"><button type="button" class="wt-go" data-i="' + i + '"><b>' + esc(x.t) + "</b><span>" + esc(x.host) + " · added " + ago(x.ts) + '</span></button><button type="button" class="wt-x" data-i="' + i + '" title="Remove (watched)">✓</button></div>').join("") + "</div>"
          : '<p class="wt-note">One queue for videos from any site. Add the page you\'re on, or a video\'s link from its menu.</p>');
      const a = body.querySelector(".wt-add"); if (a) a.onclick = () => { addLater(c.u, c.t); V.later(); };
      body.querySelectorAll(".wt-go").forEach(b => { b.onclick = () => open(l[+b.dataset.i].u); });
      body.querySelectorAll(".wt-x").forEach(b => { b.onclick = () => { delLater(l[+b.dataset.i].u); V.later(); }; });
    },
    marks(fresh) {
      const l = marks(), nw = fresh && l.find(x => x.id === fresh);
      body.innerHTML = (app.markNow ? '<button type="button" class="wt-btn wt-mk">🔖 Save this moment</button>' : "") +
        (nw ? '<div class="wt-addr"><input class="wt-in wt-mnote" maxlength="300" placeholder="A note for ' + clock(nw.at) + ' (optional), then Enter"></div>' : "") + (l.length ? '<div class="wt-list">' + l.map((x, i) => '<div class="wt-row"><button type="button" class="wt-go" data-i="' + i + '"><b><em>' + clock(x.at) + "</em> " + esc(x.note || x.t) + "</b><span>" + esc(x.note ? x.t : hostOf(x.u)) + " · " + ago(x.ts) + '</span></button><button type="button" class="wt-x" data-i="' + i + '" title="Delete">✕</button></div>').join("") + "</div>"
        : '<p class="wt-note">Save a moment in a video, with a note, and jump straight back to it later.' + (app.markNow ? "" : " (On the PC: Watching → Save this moment.)") + "</p>");
      const mk = body.querySelector(".wt-mk"); if (mk) mk.onclick = async () => { const m = await app.markNow(); V.marks(m && m.id); };
      const mn = body.querySelector(".wt-mnote"); if (mn) { mn.focus(); mn.onkeydown = e => { if (e.key === "Enter") { editMark(fresh, mn.value.trim()); V.marks(); } }; }
      body.querySelectorAll(".wt-go").forEach(b => { b.onclick = () => { const x = l[+b.dataset.i]; if (app.openAt) app.openAt(x.u, x.at); else open(timeUrl(x.u, x.at).u); }; });
      body.querySelectorAll(".wt-x").forEach(b => { b.onclick = () => { delMark(l[+b.dataset.i].id); V.marks(); }; });
    },
    async live() {
      const l = streamers();
      body.innerHTML = '<div class="wt-addr"><input class="wt-in" placeholder="A Twitch streamer\'s name or link"><button type="button" class="wt-btn">Follow</button></div><div class="wt-chips">' +
        l.map(x => '<span class="wt-chip">' + esc(x) + '<button type="button" data-u="' + esc(x) + '" title="Unfollow">✕</button></span>').join("") + '</div><div class="wt-lv"></div>';
      const inp = body.querySelector(".wt-in"), go = () => { if (follow(inp.value)) V.live(); else inp.select(); };
      body.querySelector(".wt-addr .wt-btn").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
      body.querySelectorAll(".wt-chip button").forEach(b => { b.onclick = () => { follow(b.dataset.u, false); V.live(); }; });
      const out = body.querySelector(".wt-lv");
      if (!l.length) { out.innerHTML = '<p class="wt-note">Follow streamers to see who\'s live now, and when they stream next.</p>'; return; }
      out.innerHTML = '<p class="wt-note">Looking…</p>';
      try {
        const j = await streams(true); if (!out.isConnected) return;
        const at = s => { const d = new Date(s); return d.toLocaleDateString([], { weekday:"short" }) + " " + d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }); };
        out.innerHTML = (j.live.length ? '<div class="wt-k">🔴 Live now</div>' + j.live.map(x => '<button type="button" class="wt-live" data-u="' + esc(x.u) + '"><i style="background-image:url(&quot;' + esc(x.img) + '&quot;)"></i><span><b>' + esc(x.name) + "</b><em>" + esc(x.title) + "</em><small>" + esc(x.game) + " · " + x.viewers.toLocaleString() + " watching</small></span></button>").join("") : '<p class="wt-note">Nobody you follow is live right now.</p>') +
          (j.next.length ? '<div class="wt-k">📅 Coming up</div>' + j.next.map(x => '<div class="wt-sch"><b>' + esc(at(x.at)) + "</b><span>" + esc(x.name) + " · " + esc(x.title || x.game) + "</span></div>").join("") : "");
        out.querySelectorAll(".wt-live").forEach(b => { b.onclick = () => open("https://www.twitch.tv/" + b.dataset.u); });
      } catch (e) { out.innerHTML = '<p class="wt-note"></p>'; out.firstChild.textContent = e.message; }
    },
    week() {
      const w = week(), max = Math.max(1, ...w.map(x => x.total)), all = {};
      w.forEach(d => Object.keys(d.hosts).forEach(h => { all[h] = (all[h] || 0) + d.hosts[h]; }));
      const tot = w.reduce((a, d) => a + d.total, 0), top = Object.keys(all).sort((a, b) => all[b] - all[a]).slice(0, 6);
      body.innerHTML = '<div class="wt-big">' + (tot ? dur(tot) : "Nothing yet") + '<span>watched in the last 7 days' + (app.statsNote ? " · " + esc(app.statsNote) : "") + '</span></div><div class="wt-bars">' +
        w.map(d => '<div class="wt-bar" title="' + esc(d.day) + ": " + dur(d.total) + '"><i style="height:' + Math.round(d.total / max * 100) + '%"></i><span>' + esc(d.name) + "</span></div>").join("") + "</div>" +
        (top.length ? '<div class="wt-k">By site</div>' + top.map(h => '<div class="wt-site"><span>' + esc(h) + '</span><i><b style="width:' + Math.round(all[h] / all[top[0]] * 100) + '%"></b></i><em>' + dur(all[h]) + "</em></div>").join("") : "");
    }
  };
  show(tab);
  return { show };
}

const css = document.createElement("style");
css.textContent = `
.wt{display:flex;flex-direction:column;gap:10px}.wt-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.wt-tabs::-webkit-scrollbar{display:none}
.wt-tabs button{flex:none;font:inherit;font-size:13px;border:1px solid var(--line, rgba(127,127,127,.3));background:transparent;color:var(--dim);border-radius:999px;padding:5px 12px;cursor:pointer}.wt-tabs button.on{color:#fff;background:var(--accent);border-color:var(--accent)}
.wt-body{min-height:100px}.wt-note{color:var(--dim);font-size:13.5px;margin:6px 0}.wt-btn{font:inherit;font-weight:600;font-size:13.5px;border:0;border-radius:10px;padding:8px 14px;background:var(--accent);color:#fff;cursor:pointer;margin-bottom:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wt-list{display:flex;flex-direction:column;gap:4px}.wt-row{display:flex;align-items:center;gap:6px}.wt-go{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;font:inherit;text-align:left;border:0;background:transparent;color:var(--fg);padding:6px 8px;border-radius:8px;cursor:pointer}
.wt-go:hover{background:var(--bg3, rgba(127,127,127,.12))}.wt-go b{font-size:13.5px;font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wt-go b em{font-style:normal;color:var(--accent);font-variant-numeric:tabular-nums}.wt-go span{font-size:12px;color:var(--dim)}
.wt-x{border:0;background:none;color:var(--dim);cursor:pointer;font-size:14px;padding:6px}
.wt-addr{display:flex;gap:6px;margin-bottom:6px}.wt-addr .wt-btn{margin:0}.wt-in{flex:1;min-width:0;font:inherit;font-size:14px;color:var(--fg);background:var(--bg3, rgba(127,127,127,.12));border:1px solid var(--line, rgba(127,127,127,.3));border-radius:10px;padding:8px 10px}
.wt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.wt-chip{display:inline-flex;align-items:center;gap:2px;font-size:12.5px;padding:3px 4px 3px 10px;border-radius:999px;background:var(--bg3, rgba(127,127,127,.12))}.wt-chip button{border:0;background:none;color:var(--dim);cursor:pointer}
.wt-k{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);margin:12px 0 6px}
.wt-live{display:flex;gap:10px;align-items:center;width:100%;font:inherit;text-align:left;border:0;background:transparent;color:var(--fg);padding:6px;border-radius:10px;cursor:pointer}.wt-live:hover{background:var(--bg3, rgba(127,127,127,.12))}
.wt-live i{flex:none;width:96px;aspect-ratio:16/9;border-radius:8px;background:#222 center/cover;box-shadow:inset 0 0 0 2px #e91916}.wt-live span{display:flex;flex-direction:column;min-width:0}.wt-live em{font-style:normal;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wt-live small{font-size:11.5px;color:var(--dim)}
.wt-sch{display:flex;gap:10px;font-size:13px;padding:4px 6px}.wt-sch b{flex:none;min-width:110px}.wt-sch span{color:var(--dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wt-big{font-size:28px;font-weight:800;display:flex;flex-direction:column}.wt-big span{font-size:12.5px;font-weight:400;color:var(--dim)}
.wt-bars{display:flex;gap:6px;align-items:flex-end;height:110px;margin:12px 0}.wt-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}.wt-bar i{width:100%;min-height:2px;border-radius:6px 6px 2px 2px;background:var(--accent)}.wt-bar span{font-size:11px;color:var(--dim)}
.wt-site{display:grid;grid-template-columns:minmax(0,1fr) 2fr auto;gap:8px;align-items:center;font-size:13px;padding:3px 0}.wt-site span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wt-site i{height:6px;border-radius:3px;background:var(--bg3, rgba(127,127,127,.15));overflow:hidden}.wt-site b{display:block;height:100%;background:var(--accent)}.wt-site em{font-style:normal;color:var(--dim);font-size:12px}`;
document.head.appendChild(css);

window.Watch = { panel, later, addLater, delLater, inLater, marks, addMark, delMark, editMark, timeUrl, addStat, week, streamers, follow, streams, liveDot, clock, dur };
})();
