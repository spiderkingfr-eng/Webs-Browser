/* Webs Browser - getting things done (Windows 3.10, iPhone 2.9), the parts both apps share:
   GTD.routine     the morning routine: a set of sites opened at a time you choose (wsb.routine:
                   { on, time:"08:30", days:[1,2,3,4,5], sites:[{ u, t }], last:"2026-10-05" })
                   .due(r)  whether to open them now   .editor(el, r, onChange, current)  its settings
   GTD.remind      "remind me next time I'm on this site" (wsb.reminders: [{ id, h, t, ts }])
                   .add(host, text)  .for(host)  .done(id)  .all()
   GTD.digest      the weekly reading digest: what's on your reading list, saved over 3 days ago and never read
                   .due()  .items(list)  .seen()
   GTD.dupes(list) bookmarks (or anything with .u) that point at the same page
   GTD.voice       voice commands: .parse(text) -> { cmd, arg } or null   .listen(opt) -> { stop() }
   Nothing here leaves the device. */
(function () {
"use strict";
if (window.GTD) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const pad = n => String(n).padStart(2, "0");
const dayKey = d => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

/* ---------------------------------------------------------------- the morning routine */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const routine = {
  get:() => Object.assign({ on:false, time:"08:00", days:[1, 2, 3, 4, 5], sites:[], last:"" }, get("routine", {}) || {}),
  set:r => put("routine", r),
  // due: on, a day it's for, its time has come today, and not opened yet today (until noon after the time, so a
  // computer switched on in the afternoon doesn't open the morning's sites)
  due(r, now) {
    r = r || routine.get(); now = now || new Date();
    if (!r.on || !r.sites.length || r.last === dayKey(now) || r.days.indexOf(now.getDay()) < 0) return false;
    const [h, m] = String(r.time || "08:00").split(":").map(Number), at = new Date(now); at.setHours(h || 0, m || 0, 0, 0);
    return now >= at && now - at < 6 * 3600000;
  },
  opened(r) { r = r || routine.get(); r.last = dayKey(); routine.set(r); },
  editor(el, r, onChange, current) {
    r = JSON.parse(JSON.stringify(r || routine.get()));
    const save = () => { routine.set(r); if (onChange) onChange(r); };
    const paint = () => {
      el.innerHTML = '<label class="gt-row"><input type="checkbox" class="gt-on"> <b>Open my morning sites</b></label>' +
        '<div class="gt-row">At <input type="time" class="gt-time"> on <span class="gt-days">' + DAYS.map((d, i) => '<button type="button" data-d="' + i + '" class="' + (r.days.indexOf(i) >= 0 ? "on" : "") + '">' + d + "</button>").join("") + "</span></div>" +
        '<div class="gt-sites">' + (r.sites.length ? r.sites.map((s, i) => '<div class="gt-site"><span></span><button type="button" data-x="' + i + '" title="Remove">✕</button></div>').join("") : '<p class="gt-note">No sites yet.</p>') + "</div>" +
        '<div class="gt-row"><input class="gt-add" placeholder="Add a site, e.g. news.example.com" inputmode="url"><button type="button" class="gt-addb">Add</button></div>' +
        (current ? '<button type="button" class="gt-cur">Add the page you\'re on</button>' : "") + '<p class="gt-note">They open in new tabs at that time on those days (or when Webs opens, if it was closed then).</p>';
      el.querySelector(".gt-on").checked = !!r.on;
      el.querySelector(".gt-time").value = r.time;
      el.querySelectorAll(".gt-site span").forEach((s, i) => { s.textContent = r.sites[i].t || hostOf(r.sites[i].u) || r.sites[i].u; s.title = r.sites[i].u; });
      el.querySelector(".gt-on").onchange = e => { r.on = e.target.checked; save(); };
      el.querySelector(".gt-time").onchange = e => { r.time = e.target.value || "08:00"; r.last = ""; save(); };
      el.querySelectorAll("[data-d]").forEach(b => { b.onclick = () => { const d = +b.dataset.d, i = r.days.indexOf(d); if (i >= 0) r.days.splice(i, 1); else r.days.push(d); r.days.sort(); save(); paint(); }; });
      el.querySelectorAll("[data-x]").forEach(b => { b.onclick = () => { r.sites.splice(+b.dataset.x, 1); save(); paint(); }; });
      const add = u => { u = String(u || "").trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = "https://" + u; if (!hostOf(u) || r.sites.some(s => s.u === u)) return; r.sites.push({ u, t:"" }); if (r.sites.length > 12) r.sites.shift(); save(); paint(); };
      el.querySelector(".gt-addb").onclick = () => add(el.querySelector(".gt-add").value);
      el.querySelector(".gt-add").onkeydown = e => { if (e.key === "Enter") add(e.target.value); };
      const cur = el.querySelector(".gt-cur"); if (cur) cur.onclick = () => { const c = current(); if (c && c.u) { if (!r.sites.some(s => s.u === c.u)) r.sites.push({ u:c.u, t:c.t || "" }); save(); paint(); } };
    };
    paint();
  }
};

/* ---------------------------------------------------------------- reminders for a site */
const remind = {
  all:() => (get("reminders", []) || []).filter(x => x && x.h && x.t),
  add(host, text) { host = String(host || "").replace(/^www\./, ""); text = String(text || "").trim().slice(0, 300); if (!host || !text) return null; const l = remind.all(), x = { id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), h:host, t:text, ts:Date.now() }; l.push(x); put("reminders", l.slice(-100)); return x; },
  for:host => { host = String(host || "").replace(/^www\./, ""); return remind.all().filter(x => host === x.h || host.endsWith("." + x.h)); },
  done(id) { put("reminders", remind.all().filter(x => x.id !== id)); }
};

/* ---------------------------------------------------------------- the weekly reading digest */
const digest = {
  // once a week: Monday, or any day 7 days after the last one
  due(now) { now = now || new Date(); const last = +get("digestAt", 0) || 0; return Date.now() - last > 6.5 * 864e5 && (now.getDay() === 1 || Date.now() - last > 7.5 * 864e5); },
  items:list => (list || []).filter(r => r && r.u && !r.done && Date.now() - (+r.ts || 0) > 3 * 864e5).sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(0, 8),
  seen() { put("digestAt", Date.now()); }
};

/* ---------------------------------------------------------------- bookmarks that are the same page */
const norm = u => { try { const x = new URL(u); x.hash = ""; [...x.searchParams.keys()].forEach(k => { if (/^(utm_\w+|fbclid|gclid|ref|ref_src)$/i.test(k)) x.searchParams.delete(k); }); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase(); } catch (e) { return String(u).toLowerCase(); } };
function dupes(list) {
  const by = new Map();
  (list || []).forEach((b, i) => { if (!b || !b.u) return; const k = norm(b.u); if (!by.has(k)) by.set(k, []); by.get(k).push(i); });
  return [...by.values()].filter(g => g.length > 1);
}

/* ---------------------------------------------------------------- voice commands */
const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, first:1, second:2, third:3, last:9 };
function parse(text) {
  let s = String(text || "").toLowerCase().replace(/[.,!?]+$/g, "").replace(/^(hey |ok |okay )?(webs|browser)[, ]+/, "").replace(/^(please |can you |could you )/, "").replace(/ please$/, "").trim();
  if (!s) return null;
  const m = (re, cmd, f) => { const x = re.exec(s); return x ? { cmd, arg:f ? f(x) : "" } : null; };
  return m(/^(open |new |a new )?tab$|^open a new tab$|^new tab$/, "newtab") ||
    m(/^(close|shut) (this |the )?tab$/, "close") ||
    m(/^(re-?open|bring back|undo close)( the)?( last)?( closed)? tab$/, "reopen") ||
    m(/^(scroll|go) down$|^page down$/, "down") || m(/^(scroll|go) up$|^page up$/, "up") ||
    m(/^(go )?to the top$|^scroll to the top$|^top$/, "top") || m(/^(go )?to the bottom$|^scroll to the bottom$|^bottom$/, "bottom") ||
    m(/^(go )?back$/, "back") || m(/^(go )?forward$/, "forward") ||
    m(/^(reload|refresh)( the page| this page)?$/, "reload") ||
    m(/^(next|right) tab$/, "nexttab") || m(/^(previous|last|left) tab$/, "prevtab") ||
    m(/^(go to |switch to )?tab (\w+)$/, "tab", x => WORDS[x[2]] || +x[2] || 0) ||
    m(/^zoom in$|^bigger$/, "zoomin") || m(/^zoom out$|^smaller$/, "zoomout") || m(/^(reset zoom|normal size)$/, "zoomreset") ||
    m(/^(bookmark|save) (this|this page|it)$/, "bookmark") ||
    m(/^read (this|this page|it)( to me| aloud| out loud)?$|^read aloud$/, "read") ||
    m(/^(stop reading|stop|be quiet)$/, "stop") ||
    m(/^(play|pause|resume)( the)?( video| music)?$/, "playpause") || m(/^(mute|unmute)( this tab| the tab)?$/, "mute") ||
    m(/^(go home|home|start page)$/, "home") ||
    m(/^(new )?private (tab|window)$/, "private") ||
    m(/^(summari[sz]e|sum up)( this| this page| the page)?$/, "summarize") ||
    m(/^(find|search for|look for) (.+) (on|in) (this|the) page$/, "find", x => x[2]) ||
    m(/^(search( for)?|google|look up) (.+)$/, "search", x => x[3]) ||
    m(/^(open|go to|visit) (.+)$/, "open", x => x[2].replace(/ dot /g, ".").replace(/\s+/g, "")) ||
    m(/^(ask|hey) web ai (.+)$/, "ask", x => x[2]) ||
    null;
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listen(opt) {
  opt = opt || {};
  if (!SR) { if (opt.onError) opt.onError("none"); return { stop() {} }; }
  let r = null, done = false;
  try { r = new SR(); } catch (e) { if (opt.onError) opt.onError("none"); return { stop() {} }; }
  r.lang = opt.lang || navigator.language || "en-US"; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
  r.onresult = e => {
    let fin = "", tmp = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else tmp += t; }
    if (tmp && opt.onPartial) opt.onPartial(tmp);
    if (fin && !done) {
      done = true;
      // the first of the alternatives that's a command
      const alts = [...e.results[e.results.length - 1]].map(a => a.transcript);
      const hit = alts.map(a => ({ a, c:parse(a) })).find(x => x.c) || { a:fin, c:parse(fin) };
      if (opt.onText) opt.onText(hit.a, hit.c);
    }
  };
  r.onerror = e => { if (!done && opt.onError) opt.onError(e.error || "error"); done = true; };
  r.onend = () => { if (!done && opt.onError) opt.onError("nothing"); done = true; };
  try { r.start(); } catch (e) { if (opt.onError) opt.onError("busy"); }
  return { stop() { done = true; try { r.abort(); } catch (e) {} } };
}
const HELP = ["“New tab”, “close tab”, “reopen tab”", "“Scroll down”, “go to the top”", "“Go back”, “reload”", "“Next tab”, “tab 3”", "“Open youtube.com”", "“Search for pizza near me”",
  "“Bookmark this”, “read this page”", "“Zoom in”, “mute”", "“Summarize this page”", "“Ask Web AI how tall is Everest”"];

const st = document.createElement("style");
st.textContent = `
.gt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;font-size:13px}.gt-row input[type=time],.gt-add{height:30px;border-radius:8px;border:1px solid var(--line,rgba(127,127,127,.35));background:var(--bg3,rgba(127,127,127,.12));color:inherit;font:inherit;padding:0 8px}
.gt-add{flex:1;min-width:160px}.gt-days{display:inline-flex;gap:3px}.gt-days button,.gt-addb,.gt-cur,.gt-site button{height:28px;padding:0 8px;border-radius:7px;border:1px solid var(--line,rgba(127,127,127,.35));background:var(--bg3,rgba(127,127,127,.12));color:inherit;font:inherit;font-size:12px;cursor:pointer}
.gt-days button.on{background:var(--accent,#e8342a);border-color:var(--accent,#e8342a);color:#fff}.gt-sites{margin:6px 0}.gt-site{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px}.gt-site span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gt-note{font-size:12px;opacity:.7;margin:6px 0}.gt-on{accent-color:var(--accent,#e8342a)}
`;
(document.head || document.documentElement).appendChild(st);
window.GTD = { routine, remind, digest, dupes, norm, voice:{ parse, listen, ok:!!SR, HELP }, dayKey, hostOf, esc };
})();
