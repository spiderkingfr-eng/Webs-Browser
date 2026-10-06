/* ---------------------------------------------------------------- Webs 3.14: watching, in the browser window (ideas #076-#100)
   Menu → Watching… (../../js/watch.js: watch later, moments, streamers, this week) with a Tools tab of the window's own:
     #076 skip intro          a "Skip intro" button during a chapter called Intro or Opening (or skipped by itself)
     #077 resume              (since 3.x for videos) now podcasts and other long audio too
     #079 speed per site      (since 3.x) the list of sites with their speed, to forget one
     #080 volume per site     each site keeps the volume you last set on it
     #081 video follows you   a playing video pops out when you switch tabs, and back in when you return
     #083 loop a part         (A-B loop since 3.x) now by typing the times
     #084 brightness boost    #085 subtitle styles    #094 ambient glow    #095 cinema mode (everything else dimmed)
     #087 shorts allowance    YouTube Shorts for so many minutes a day, then hidden
     #088 binge guard         after three episodes in a row, a break is offered
     #089 chapter list        the video's chapters, to jump to
     #090 listen only         (since 3.x) now kept for the sites you choose
     #091 Twitch chat         chat over the stream in full screen
     #096 sleep timer fade    the sound fades out over the last minute
     #097 watch stats         #098 save captions    #099 lecture notes by time    #100 reaction recorder (the new tab page)
   Page side: src/shield.more.js (x-watch and friends). Settings: cfg.w* (below). */
(function () {
"use strict";
if (!window.Watch || !X3.ai) return;
const PT = X3.ai.pageTool, Wt = Watch;
const webT = () => { const t = T(active); return t && isWeb(t.url) && !t.sleep && !t.lazy ? t : null; };
const today = () => new Date().toLocaleDateString("en-CA");
const D0 = { wSkip:true, wAuto:false, wVolMem:true, wFollow:false, wBright:1, wSubs:null, wGlow:false, wCinema:false, wShorts:0, wBinge:true, wTwitch:true, wFade:true, wAudioSites:[] };
const C = k => cfg[k] == null ? D0[k] : cfg[k];
const setC = (k, v) => { cfg[k] = v; saveNow("settings"); if (typeof sendPrefs === "function") sendPrefs(); };
function grow(p, id) { if (typeof ResizeObserver === "function") new ResizeObserver(() => { if (overlay === id && p.isConnected) { capHeight(p); relayout(); } }).observe(p); }
const vkey = u => { try { const x = new URL(u); if (/(^|\.)youtube\.com$/.test(x.hostname) && x.searchParams.get("v")) return "yt:" + x.searchParams.get("v"); ["t", "time_continue", "start", "si", "feature", "pp"].forEach(k => x.searchParams.delete(k)); x.hash = ""; return x.href; } catch (e) { return u; } };

/* ---------------------------------------------------------------- what each page's videos do (x-watch) */
const shortsLeft = () => { const lim = +C("wShorts") || 0; if (!lim) return Infinity; const u = load("shortsUsed", {}) || {}; return lim * 60 - (u[today()] || 0); };
function watchCfg(t) {
  const h = hostOf(t.url), vols = load("siteVols", {}) || {}, ap = (load("audioPos", {}) || {})[vkey(t.url)];
  return { skip:C("wSkip"), auto:C("wAuto"), vol:C("wVolMem") && vols[h] != null ? vols[h] : null, bright:+C("wBright") || 1, subs:C("wSubs"), glow:C("wGlow"), cinema:!!t.wCinema || C("wCinema"),
    shorts:shortsLeft() <= 0, twitch:C("wTwitch"), ao:(C("wAudioSites") || []).indexOf(h) >= 0, apos:ap || 0 };
}
function push(t) {
  if (!t || !isWeb(t.url) || t.sleep || t.lazy) return;
  const s = JSON.stringify(watchCfg(t));
  if (s === t.wCfg) return;
  t.wCfg = s; send("page-tool", t.id, "x-watch", s);
}
const pushAll = () => tabs.forEach(push);
const pendingSeek = new Map();          // a moment to go to once its page has loaded (sites without a time in the address)
const applyPageW = applyPage;
applyPage = function (t) {
  applyPageW(t);
  if (!t || !isWeb(t.url)) return;
  t.wCfg = ""; push(t);
  const at = pendingSeek.get(vkey(t.url));
  if (at != null) { pendingSeek.delete(vkey(t.url)); setTimeout(() => send("page-tool", t.id, "x-seekto", String(at)), 1500); }
  shortsGuard(t);
};
const reloadSettingsW = reloadSettings;
reloadSettings = function () { reloadSettingsW(); tabs.forEach(t => { t.wCfg = ""; }); pushAll(); };

// what pages tell the window: your volume on a site (#080), podcasts' places (#077), the binge question's answer (#088)
const onToolResultW = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  const t = T(id);
  if (r && r.a === "x-watch-ev" && t && !PRIVATE) {
    if (r.ev === "vol" && C("wVolMem") && r.v >= 0 && r.v <= 1) { const v = load("siteVols", {}) || {}; v[hostOf(t.url)] = r.v; save("siteVols", v); t.wCfg = ""; }
    if (r.ev === "apos" && r.d >= 300) { const a = load("audioPos", {}) || {}, k = vkey(t.url); if (r.t > 20 && r.t < r.d - 30) a[k] = Math.round(r.t); else delete a[k]; const ks = Object.keys(a); if (ks.length > 200) delete a[ks[0]]; save("audioPos", a); }
    return;
  }
  if (r && r.a === "x-binge") { if (r.rest) toast("Enjoy the break. ☕"); return; }
  onToolResultW(id, json);
};

/* ---------------------------------------------------------------- #097 watch stats and #088 the binge guard (from the "watch" reports) */
const lastW = {}, finished = new Set();
let streak = 0, lastFinish = 0;
const onWatchW = onWatch;
onWatch = function (id, url, title, time, dur) {
  onWatchW(id, url, title, time, dur);
  if (PRIVATE || !/^https?:/.test(url)) return;
  const now = Date.now(), l = lastW[id];
  if (l && l.u === url && time > l.t && now - l.at < 30000) Wt.addStat(hostOf(url), Math.min(time - l.t, (now - l.at) / 1000 + 2));
  lastW[id] = { u:url, t:time, at:now };
  // an episode: 10 minutes or more, watched to 90%
  const k = vkey(url);
  if (dur >= 600 && time >= dur * 0.9 && !finished.has(k)) {
    finished.add(k);
    streak = now - lastFinish < 45 * 60000 ? streak + 1 : 1; lastFinish = now;
    if (C("wBinge") && streak >= 3) { streak = 0; send("page-tool", id, "x-binge", "3"); }
  }
};

/* ---------------------------------------------------------------- #087 the shorts allowance */
const isShorts = u => /^https:\/\/(www\.|m\.)?youtube\.com\/shorts\//.test(u || "");
function shortsGuard(t) {
  if (!t || !isShorts(t.url) || shortsLeft() > 0) return;
  send("navigate", t.id, "https://www.youtube.com/");
  toast("📵 That's your " + C("wShorts") + " minutes of Shorts for today");
}
setInterval(() => {
  const lim = +C("wShorts") || 0; if (!lim || PRIVATE) return;
  const t = T(active);
  if (t && isShorts(t.url) && !document.hidden) {
    const u = load("shortsUsed", {}) || {}, d = today(); u[d] = (u[d] || 0) + 5;
    Object.keys(u).filter(k => k !== d).forEach(k => delete u[k]); save("shortsUsed", u);
    const left = lim * 60 - u[d];
    if (left === 120) toast("⏳ 2 minutes of Shorts left today");
    if (left <= 0) { tabs.forEach(x => { x.wCfg = ""; }); pushAll(); shortsGuard(t); }
  } else if (t) shortsGuard(t);
}, 5000);

/* ---------------------------------------------------------------- #081 the video follows you */
let prevActive = active, pipFor = 0;
setInterval(() => {
  if (active === prevActive) return;
  const from = T(prevActive); prevActive = active;
  if (pipFor && active === pipFor) { send("media", pipFor, "pip", ""); pipFor = 0; return; }       // back to it: back in the page
  if (!C("wFollow") || PRIVATE || !from || !from.media || !from.audio || from.muted || pipFor) return;
  send("media", from.id, "pip", ""); pipFor = from.id;
}, 300);

/* ---------------------------------------------------------------- #096 the sleep timer fades out */
let fadedFor = 0;
setInterval(() => {
  if (typeof sleepAt === "undefined" || !sleepAt) { fadedFor = 0; return; }
  const left = sleepAt - Date.now();
  if (!C("wFade") || fadedFor === sleepAt || left > 60000 || left < 2000) return;
  fadedFor = sleepAt;
  tabs.filter(t => t.audio && !t.muted).forEach(t => send("page-tool", t.id, "x-fade", String(Math.round(left / 1000))));
  toast("🌙 Fading out…");
}, 1000);

/* ---------------------------------------------------------------- the panels */
function chapterPanel() {
  const t = webT(); if (!t) { toast("Open a video first"); return; }
  const p = el("div", "xpane wtp");
  p.innerHTML = '<div class="xhead"><div class="xic">📑</div><div><b>Chapters</b><span></span></div></div><div class="wt-ch"><p class="wt-note">Looking…</p></div>';
  p.querySelector(".xhead span").textContent = t.title || hostOf(t.url);
  const n = openOver("wtchap", p); n.style.right = "8px"; grow(p, "wtchap");
  const box = p.querySelector(".wt-ch");
  let list = null;
  const paint = async () => {
    let r = null; try { r = await PT(t, "x-chapters", "", 3000); } catch (e) {}
    if (!p.isConnected) return;
    if (!r || !r.has) { box.innerHTML = '<p class="wt-note">No video on this page.</p>'; return; }
    if (!r.l.length) { box.innerHTML = '<p class="wt-note">This video has no chapters.</p>'; return; }
    const sig = r.l.map(c => c.t).join();
    if (!list || list !== sig) {
      list = sig;
      box.innerHTML = r.l.map(c => '<button type="button" class="wt-c" data-t="' + c.t + '"><em>' + Wt.clock(c.t) + "</em><span></span></button>").join("");
      box.querySelectorAll(".wt-c").forEach((b, i) => { b.querySelector("span").textContent = r.l[i].title; b.onclick = () => send("page-tool", t.id, "x-seekto", b.dataset.t); });
    }
    box.querySelectorAll(".wt-c").forEach((b, i) => b.classList.toggle("on", r.now >= r.l[i].t && r.now < r.l[i].end));
  };
  paint();
  const iv = setInterval(() => { if (!p.isConnected) { clearInterval(iv); return; } paint(); }, 2000);
}
async function saveCaptions() {
  const t = webT(); if (!t) { toast("Open a video first"); return; }
  let r = null;
  try {
    if (/^https:\/\/(www\.|m\.)?youtube\.com\/watch/.test(t.url)) { r = await PT(t, "x-yt", "", 15000); if (r && r.t) r = { text:r.t, title:r.title }; else r = null; }
    if (!r) r = await PT(t, "x-caps", "", 5000);
  } catch (e) {}
  if (!r || r.none || !r.text) { toast("This video has no captions that can be saved"); return; }
  const name = String(r.title || t.title || "captions").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "captions";
  send("save-text", name + " (captions).txt", String(r.text).replace(/\r?\n/g, "\r\n"));
  toast("💬 Captions saved in your downloads");
}
// #099 notes next to a lecture, each stamped with the moment
function notesPanel() {
  const t = webT(); if (!t) { toast("Open the video first"); return; }
  const k = vkey(t.url), all = () => load("lectureNotes", {}) || {}, mine = () => (all()[k] || { notes:[] });
  const p = el("div", "xpane wtp");
  p.innerHTML = '<div class="xhead"><div class="xic">📝</div><div><b>Lecture notes</b><span></span></div></div><div class="wt-nl"></div><div class="wt-addr"><input class="wt-in" placeholder="A note… (Enter: stamped with the video\'s time)"></div><div class="xbtns xleft"><button class="btn2 wt-exp">Save as a file</button></div>';
  p.querySelector(".xhead span").textContent = t.title || hostOf(t.url);
  const n = openOver("wtnotes", p); n.style.right = "8px"; grow(p, "wtnotes");
  const list = p.querySelector(".wt-nl"), inp = p.querySelector(".wt-in");
  const paint = () => {
    const l = mine().notes.slice().sort((a, b) => a.t - b.t);
    list.innerHTML = l.length ? l.map((x, i) => '<div class="wt-n"><button type="button" class="wt-nt" data-t="' + x.t + '">' + Wt.clock(x.t) + '</button><span></span><button type="button" class="wt-x" data-i="' + i + '">✕</button></div>').join("") : '<p class="wt-note">Notes you type here are stamped with where the video is, so a click takes you back to that moment.</p>';
    list.querySelectorAll(".wt-n span").forEach((s, i) => { s.textContent = l[i].x; });
    list.querySelectorAll(".wt-nt").forEach(b => { b.onclick = () => send("page-tool", t.id, "x-seekto", b.dataset.t); });
    list.querySelectorAll(".wt-x").forEach(b => { b.onclick = () => { const a = all(), m = a[k]; m.notes = m.notes.filter(x => x !== l[+b.dataset.i]); save("lectureNotes", a); paint(); }; });
  };
  inp.onkeydown = async e => {
    if (e.key !== "Enter" || !inp.value.trim()) return;
    const text = inp.value.trim(); inp.value = "";
    let r = null; try { r = await PT(t, "x-vtime", "", 3000); } catch (x) {}
    const a = all(); a[k] = a[k] || { title:t.title || "", u:t.url, notes:[] };
    a[k].notes.push({ t:r && r.has ? r.t : 0, x:text.slice(0, 1000) }); a[k].ts = Date.now();
    const ks = Object.keys(a); if (ks.length > 100) delete a[ks.sort((x, y) => (a[x].ts || 0) - (a[y].ts || 0))[0]];
    save("lectureNotes", a); paint();
  };
  p.querySelector(".wt-exp").onclick = () => {
    const m = mine(); if (!m.notes.length) { toast("No notes yet"); return; }
    const name = String(m.title || t.title || "notes").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80);
    send("save-text", name + " (notes).txt", [m.title || t.title, t.url, ""].concat(m.notes.slice().sort((a, b) => a.t - b.t).map(x => "[" + Wt.clock(x.t) + "] " + x.x)).join("\r\n"));
    toast("📝 Saved in your downloads");
  };
  paint(); setTimeout(() => inp.focus(), 50);
}
// #082 save this moment
async function markNow() {
  const t = webT(); if (!t) { toast("Open a video first"); return null; }
  let r = null; try { r = await PT(t, "x-vtime", "", 3000); } catch (e) {}
  if (!r || !r.has) { toast("No video on this page"); return null; }
  const m = Wt.addMark({ u:t.url, t:t.title || r.title, at:r.t });
  toast("🔖 Saved: " + Wt.clock(r.t)); return m;
}
function openAt(u, at) {
  const x = Wt.timeUrl(u, at);
  if (!x.done) pendingSeek.set(vkey(u), at);
  closeOver(); newTab(x.u, false);
}
function laterNow() { const t = webT(); if (!t) { toast("Open a video first"); return; } Wt.addLater(t.url, t.title); toast("📺 Added to Watch later"); }
// #100 the reaction recorder: the new tab page records (it can save files), next to the video
function recorder() { if (PRIVATE) { toast("Not in a private window"); return; } closeOver(); openInSplit(HOME + "newtab.html#recorder"); }

// the Tools tab
function tools(body) {
  const t = webT(), h = t ? hostOf(t.url) : "";
  const sw = (k, name, sub) => '<label class="wt-sw"><input type="checkbox" data-k="' + k + '"' + (C(k) ? " checked" : "") + "><span><b>" + name + "</b><em>" + sub + "</em></span></label>";
  const subs = C("wSubs") || {};
  body.innerHTML = '<div class="wt-acts">' +
    '<button type="button" class="btn2" data-a="chap">📑 Chapters</button><button type="button" class="btn2" data-a="notes">📝 Lecture notes</button><button type="button" class="btn2" data-a="caps">💬 Save captions</button>' +
    '<button type="button" class="btn2" data-a="mark">🔖 Save this moment</button><button type="button" class="btn2" data-a="later">📺 Watch later</button><button type="button" class="btn2" data-a="rec">🎥 Record my reaction</button>' +
    '<button type="button" class="btn2' + (t && t.wCinema ? " on" : "") + '" data-a="cinema">🎬 Cinema mode on this tab</button></div>' +
    '<div class="wt-k">Loop a part</div><div class="wt-addr"><input class="wt-in wt-la" placeholder="from 1:05"><input class="wt-in wt-lb" placeholder="to 1:30"><button type="button" class="btn2" data-a="loop">Loop</button><button type="button" class="btn2" data-a="unloop">Stop</button></div>' +
    '<div class="wt-k">Videos</div>' + sw("wSkip", "Skip intro", "A button during a chapter called Intro or Opening") + sw("wAuto", "…by itself", "Skip those chapters without asking") +
    sw("wVolMem", "Volume per site", "Each site keeps the volume you last set") + sw("wFollow", "The video follows you", "A playing video pops out when you switch tabs") +
    sw("wGlow", "Ambient glow", "The video's colors glow around it") + sw("wCinema", "Cinema mode everywhere", "Everything but the video dimmed") +
    sw("wBinge", "Binge guard", "After three episodes in a row, it asks if you'd like a break") + sw("wTwitch", "Twitch chat over the stream", "A full-screen button that keeps the chat") + sw("wFade", "Sleep timer fades out", "The sound fades over the last minute") +
    '<div class="wt-row2"><span>Brightness</span><div class="seg wt-seg" data-k="wBright">' + [[1, "Normal"], [1.15, "+15%"], [1.3, "+30%"], [1.5, "+50%"]].map(x => '<button data-v="' + x[0] + '"' + (Math.abs((+C("wBright") || 1) - x[0]) < .01 ? ' class="on"' : "") + ">" + x[1] + "</button>").join("") + "</div></div>" +
    '<div class="wt-row2"><span>Subtitles</span><div class="seg wt-seg" data-k="wSubsSize">' + [[0, "As is"], [1.25, "Big"], [1.5, "Bigger"], [2, "Huge"]].map(x => '<button data-v="' + x[0] + '"' + ((C("wSubs") ? +subs.size : 0) === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>").join("") + "</div></div>" +
    '<label class="wt-sw wt-sub"><input type="checkbox" data-sub="bold"' + (subs.bold ? " checked" : "") + '><span><b>Bold, on a dark band</b></span></label>' +
    '<div class="wt-row2"><span>YouTube Shorts</span><div class="seg wt-seg" data-k="wShorts">' + [[0, "No limit"], [5, "5 min"], [15, "15 min"], [30, "30 min"]].map(x => '<button data-v="' + x[0] + '"' + ((+C("wShorts") || 0) === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>").join("") + "</div></div>" +
    (h ? '<label class="wt-sw"><input type="checkbox" data-ao' + ((C("wAudioSites") || []).indexOf(h) >= 0 ? " checked" : "") + "><span><b>Listen only on " + esc(h) + "</b><em>The picture hidden on this site, always (music videos)</em></span></label>" : "") +
    '<div class="wt-k">Speed per site</div><div class="wt-rates"></div>';
  const R = load("rates", {}) || {}, rk = Object.keys(R);
  body.querySelector(".wt-rates").innerHTML = rk.length ? rk.map(x => '<span class="wt-chip">' + esc(x) + " · " + R[x] + '×<button data-h="' + esc(x) + '" title="Forget">✕</button></span>').join("") : '<p class="wt-note">Change a video\'s speed and the site keeps it.</p>';
  body.querySelectorAll(".wt-rates button").forEach(b => { b.onclick = () => { const r = load("rates", {}); delete r[b.dataset.h]; save("rates", r); tools(body); }; });
  body.querySelectorAll("[data-k]").forEach(c => { if (c.tagName === "INPUT") c.onchange = () => { setC(c.dataset.k, c.checked); tabs.forEach(x => { x.wCfg = ""; }); pushAll(); }; });
  body.querySelectorAll(".wt-seg").forEach(sg => sg.querySelectorAll("button").forEach(b => { b.onclick = () => {
    const k = sg.dataset.k, v = +b.dataset.v;
    if (k === "wSubsSize") setC("wSubs", v ? Object.assign({}, C("wSubs") || {}, { size:v }) : null); else setC(k, v);
    tabs.forEach(x => { x.wCfg = ""; }); pushAll(); tools(body);
  }; }));
  const sb = body.querySelector("[data-sub]"); if (sb) sb.onchange = () => { setC("wSubs", Object.assign({ size:1 }, C("wSubs") || {}, { bold:sb.checked, bg:sb.checked })); tabs.forEach(x => { x.wCfg = ""; }); pushAll(); };
  const ao = body.querySelector("[data-ao]"); if (ao) ao.onchange = () => { const l = (C("wAudioSites") || []).filter(x => x !== h); if (ao.checked) l.push(h); setC("wAudioSites", l.slice(-50)); t.wCfg = ""; push(t); };
  const sec = s => { const p = String(s || "").trim().split(":").map(Number); return p.some(isNaN) || !p.length ? -1 : p.reduce((a, b) => a * 60 + b, 0); };
  body.querySelectorAll("[data-a]").forEach(b => { b.onclick = () => {
    const a = b.dataset.a;
    if (a === "chap") chapterPanel(); else if (a === "notes") notesPanel(); else if (a === "caps") saveCaptions(); else if (a === "mark") markNow(); else if (a === "later") laterNow(); else if (a === "rec") recorder();
    else if (a === "cinema") { const x = webT(); if (!x) { toast("Open a video first"); return; } x.wCinema = !x.wCinema; x.wCfg = ""; push(x); b.classList.toggle("on", x.wCinema); }
    else if (a === "loop" || a === "unloop") {
      const x = webT(); if (!x) { toast("Open a video first"); return; }
      const A = sec(body.querySelector(".wt-la").value), B = sec(body.querySelector(".wt-lb").value);
      if (a === "loop" && !(A >= 0 && B > A)) { toast("Type when it starts and ends, like 1:05 and 1:30"); return; }
      send("page-tool", x.id, "x-loopat", a === "loop" ? JSON.stringify({ a:A, b:B }) : "off");
    }
  }; });
}
function panel(tab) {
  const p = el("div", "xpane wtp wtmain");
  p.innerHTML = '<div class="xhead"><div class="xic">📺</div><div><b>Watching</b><span>Your videos, moments, streamers and the tools for watching</span></div></div><div class="wt-b"></div>';
  const n = openOver("watching", p); n.style.right = "8px"; grow(p, "watching");
  Wt.panel(p.querySelector(".wt-b"), { open:u => { closeOver(); newTab(u, false); }, openAt, markNow, statsNote:"videos over 3 minutes",
    current:() => { const t = webT(); return t ? { u:t.url, t:t.title } : null; }, tabs:[{ id:"tools", name:"Tools", render:tools }] }, tab);
}
// the new tab page's live dot opens the streamers
if (typeof BroadcastChannel === "function") new BroadcastChannel("wsb-watch").onmessage = e => { const d = e.data || {}; if (d.panel) panel(String(d.panel)); };
X3.watch = { panel, chapterPanel, notesPanel, saveCaptions, markNow, laterNow, recorder, push, cfgFor:watchCfg, openAt };

/* ---------------------------------------------------------------- the menu, commands and voice */
const menuRowsW = X3.menuRows;
X3.menuRows = function (m) { if (menuRowsW) menuRowsW(m); m.appendChild(row("media", "Watching…", "", () => { closeOver(); panel(); })); };
const commandsW = commands;
commands = function () { return commandsW().concat([
  { t:"Watching: watch later, moments, streamers, this week", k:"", i:"media", fn:() => panel() }, { t:"Watch later: add this video", k:"", i:"media", fn:laterNow },
  { t:"Video: save this moment", k:"", i:"media", fn:markNow }, { t:"Video: chapters", k:"", i:"media", fn:chapterPanel }, { t:"Video: lecture notes", k:"", i:"media", fn:notesPanel },
  { t:"Video: save the captions", k:"", i:"media", fn:saveCaptions }, { t:"Video: record my reaction", k:"", i:"media", fn:recorder },
  { t:"Streamers: who's live", k:"", i:"media", fn:() => panel("live") }, { t:"Watch stats: this week", k:"", i:"media", fn:() => panel("week") }]); };
const V = X3.voice;
if (V && V.COMMANDS) {
  const S = "\u0001";
  V.COMMANDS.unshift(
    { id:"watchlater", g:"Video and sound", ex:"watch this later", res:[/^(?:add (?:this|it) to )?watch(?: (?:this|it))? later$/, /^save (?:this|it) for later$/], fn:() => { laterNow(); return S; } },
    { id:"vmoment", g:"Video and sound", ex:"save this moment", res:[/^(?:save|bookmark|mark) this (?:moment|part|bit)$/], fn:() => { markNow(); return S; } },
    { id:"chapters", g:"Video and sound", ex:"show the chapters", res:[/^(?:show |open )?(?:the )?chapters$/], fn:() => { chapterPanel(); return "Here are the chapters."; } },
    { id:"skipintro", g:"Video and sound", ex:"skip the intro", res:[/^skip (?:the )?(?:intro|opening)$/], fn:async () => {
      const t = webT(); if (!t) return null; let r = null; try { r = await PT(t, "x-chapters", "", 3000); } catch (e) {}
      const c = r && r.l && r.l.find(x => /^(?:\d+[.:)]?\s*)?(intro|opening|op)\b/i.test(x.title));
      if (c) { send("page-tool", t.id, "x-seekto", String(c.end)); return S; }
      send("media", t.id, "seek", "85"); return S; } },
    { id:"wholive", g:"Video and sound", ex:"who's live", res:[/^who(?:'s| is) (?:live|streaming)(?: now)?$/], fn:async () => {
      try { const j = await Wt.streams(true); return j.live.length ? j.live.map(x => x.name).join(", ") + (j.live.length === 1 ? " is" : " are") + " live." : Wt.streamers().length ? "Nobody you follow is live right now." : "You don't follow any streamers yet."; } catch (e) { return e.message; } } });
}

const st = document.createElement("style");
st.textContent = `
.wtp{width:min(560px,calc(100vw - 32px))}.wtp .wt-b,.wtp .wt-ch,.wtp .wt-nl{max-height:66vh;overflow:auto}.wt-acts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.wt-acts .btn2.on{background:var(--accent);color:#fff}
.wt-sw{display:flex;gap:10px;align-items:flex-start;padding:6px 2px;cursor:pointer}.wt-sw input{margin-top:3px}.wt-sw span{display:flex;flex-direction:column}.wt-sw em{font-style:normal;font-size:12px;color:var(--dim)}.wt-sub{margin-left:24px}
.wt-row2{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 2px;font-size:13.5px}.wt-seg button{font-size:12px}
.wt-c{display:flex;gap:10px;width:100%;font:inherit;font-size:13.5px;text-align:left;border:0;background:transparent;color:var(--fg);padding:7px 8px;border-radius:8px;cursor:pointer}.wt-c:hover{background:var(--bg3)}.wt-c.on{background:color-mix(in srgb,var(--accent) 18%,transparent)}.wt-c em{font-style:normal;color:var(--accent);font-variant-numeric:tabular-nums;min-width:48px}
.wt-n{display:flex;gap:8px;align-items:flex-start;padding:4px 0}.wt-n span{flex:1;font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}.wt-nt{font:inherit;font-size:12.5px;font-weight:600;color:var(--accent);background:var(--bg3);border:0;border-radius:6px;padding:2px 6px;cursor:pointer;font-variant-numeric:tabular-nums}
.wtp .wt-addr{margin-top:8px}.wt-la,.wt-lb{max-width:110px}`;
document.head.appendChild(st);
})();
