/* Webs Browser for iPhone - the app.

   What a home-screen web app can and cannot do on an iPhone decides the shape
   of this file. Apple only lets a web app show another site inside itself when
   that site allows it, and most big sites do not. So:

     - Pages that can be shown inside (videos from YouTube and Vimeo, Wikipedia,
       maps, Spotify, the built-in games) open in a tab here, with back,
       forward and reload.
     - Everything else opens in Safari on top of the app. When you are done
       there you come straight back to where you were.

   Everything around the page - the start page, the address bar and its
   instant answers, tabs, bookmarks, history, the reading list, notes, to-do,
   games, settings and backups - lives here and works offline. */
"use strict";

const VERSION = "1.0.0";

/* ---------------------------------------------------------------- look */
const ACCENTS = ["#e8342a", "#ff7a1a", "#e0a100", "#2fa35f", "#1f9bd1", "#3d6cf0", "#8a5cf5", "#e0408a"];
function themeNow() {
  return cfg.theme === "light" || cfg.theme === "dark" ? cfg.theme : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "rgba(232,52,42," + a + ")";
  const n = parseInt(m[1], 16);
  return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
}
function applyLook() {
  const root = document.documentElement;
  root.dataset.theme = themeNow();
  root.dataset.motion = cfg.motion || "";
  root.classList.toggle("private", PRIVATE);
  if (PRIVATE) { root.style.removeProperty("--accent"); root.style.removeProperty("--soft"); }
  else { root.style.setProperty("--accent", cfg.accent || "#e8342a"); root.style.setProperty("--soft", hexA(cfg.accent, .15)); }
  document.body.classList.toggle("bartop", cfg.barPos === "top");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#16131a";
}
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (cfg.theme !== "light" && cfg.theme !== "dark") applyLook(); });

/* ---------------------------------------------------------------- favicons
   Icons the Windows browser saved come along in a backup; anything else is
   asked of DuckDuckGo's icon service (only the site's name is sent). */
let iconCache = null;
function iconURL(u) {
  const host = hostOf(u);
  if (!host) return "";
  const saved = iconCache || (iconCache = load("icons", {}));
  return saved[host] || saved["www." + host] || "https://icons.duckduckgo.com/ip3/" + host + ".ico";
}
function letterColor(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return "hsl(" + h + ",52%,46%)"; }
function favHTML(u, name, cls) {
  const host = hostOf(u) || "?";
  const letter = esc(((name || host).replace(/^www\./, "")[0] || "?").toUpperCase());
  return '<img class="' + (cls || "") + '" src="' + esc(iconURL(u)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-l="' + letter +
         '" data-c="' + letterColor(host) + '">';
}
// A missing icon becomes the site's first letter on a color of its own.
document.addEventListener("error", e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.l) return;
  const d = document.createElement("span");
  d.className = "letter " + img.className; d.textContent = img.dataset.l; d.style.background = img.dataset.c;
  img.replaceWith(d);
}, true);
document.addEventListener("load", e => {
  // DuckDuckGo answers an unknown site with a tiny placeholder
  const img = e.target;
  if (img instanceof HTMLImageElement && img.dataset.l && img.naturalWidth && img.naturalWidth < 10) img.dispatchEvent(new Event("error"));
}, true);

/* ---------------------------------------------------------------- links
   Tracking junk is removed and http is upgraded before anything opens. */
const TRACK = /^(utm_[a-z_]+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_eid|mc_cid|igshid|igsh|yclid|_hsenc|_hsmi|mkt_tok|vero_id|oly_enc_id|oly_anon_id|twclid|ttclid|li_fat_id|s_cid|ref_src|si)$/i;
function tidy(u) {
  try {
    const x = new URL(u);
    let changed = false;
    if (cfg.https !== false && x.protocol === "http:" && !/^(localhost|127\.|10\.|192\.168\.|\[)/.test(x.hostname) && !/\.local$/.test(x.hostname)) { x.protocol = "https:"; changed = true; }
    if (cfg.clean !== false && x.search) {
      // "si" is only tracking on YouTube and Spotify share links
      const keys = [...x.searchParams.keys()].filter(k => TRACK.test(k) && (k !== "si" || /youtu|spotify/.test(x.hostname)));
      if (keys.length) { keys.forEach(k => x.searchParams.delete(k)); changed = true; }
    }
    return changed ? x.href : u;
  } catch (e) { return u; }
}

/* ---------------------------------------------------------------- what opens inside
   Sites that let other apps show them, rewritten to the address that does. */
function embedFor(u) {
  let x;
  try { x = new URL(u); } catch (e) { return null; }
  const h = x.hostname.replace(/^(www|m)\./, "");
  let id = null;
  if (h === "youtube.com" || h === "music.youtube.com" || h === "youtube-nocookie.com") {
    if (x.pathname === "/watch") id = x.searchParams.get("v");
    else { const m = /^\/(shorts|embed|live)\/([\w-]{6,})/.exec(x.pathname); if (m) id = m[2]; }
  } else if (h === "youtu.be") id = x.pathname.slice(1).split("/")[0];
  if (id && /^[\w-]{6,20}$/.test(id)) {
    const t = parseInt(x.searchParams.get("t") || x.searchParams.get("start") || "0", 10) || 0;
    const list = x.searchParams.get("list");
    return { src:"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0&modestbranding=1" + (t ? "&start=" + t : "") +
             (list && /^[\w-]+$/.test(list) ? "&list=" + list : ""), title:"YouTube video", oembed:true };
  }
  if (h === "vimeo.com") { const m = /^\/(\d+)/.exec(x.pathname); if (m) return { src:"https://player.vimeo.com/video/" + m[1] + "?autoplay=1&playsinline=1", title:"Vimeo video", oembed:true }; }
  if (h === "open.spotify.com") {
    const m = /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/.exec(x.pathname);
    if (m) return { src:"https://open.spotify.com/embed/" + m[1] + "/" + m[2], title:"Spotify", oembed:true };
  }
  const w = /^([a-z][a-z-]*)\.(?:m\.)?wikipedia\.org$/.exec(x.hostname);
  if (w && w[1] !== "www") {
    const mob = new URL(u); mob.hostname = w[1] + ".m.wikipedia.org";
    const page = /^\/wiki\/(.+)$/.exec(x.pathname), s = x.searchParams.get("search");
    let title = "Wikipedia";
    try { if (page) title = decodeURIComponent(page[1]).replace(/_/g, " ") + " - Wikipedia"; else if (s) title = s + " - Wikipedia"; } catch (e) {}
    return { src:mob.href, title };
  }
  if ((/^google\.[a-z.]+$/.test(h) && x.pathname.startsWith("/maps")) || h === "maps.google.com") {
    const m = /^\/maps\/(?:search|place)\/([^/@]+)/.exec(x.pathname);
    let q = x.searchParams.get("q");
    try { if (m) q = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {}
    if (q) return { src:"https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&output=embed", title:"Map: " + q };
  }
  return null;
}
// Sites known to refuse being shown inside another app.
const NOFRAME = ["google.com", "youtube.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "tiktok.com", "reddit.com", "amazon.com",
  "github.com", "netflix.com", "linkedin.com", "apple.com", "icloud.com", "microsoft.com", "live.com", "office.com", "bing.com", "duckduckgo.com",
  "chatgpt.com", "openai.com", "claude.ai", "discord.com", "twitch.tv", "spotify.com", "paypal.com", "ebay.com", "pinterest.com", "yahoo.com",
  "whatsapp.com", "snapchat.com", "roblox.com", "stackoverflow.com", "quora.com", "medium.com", "nytimes.com", "cnn.com", "bbc.com", "bbc.co.uk",
  "theguardian.com", "search.brave.com", "startpage.com", "ecosia.org", "tumblr.com", "threads.net", "messenger.com", "dropbox.com", "zoom.us",
  "slack.com", "notion.so", "canva.com", "imdb.com", "myanimelist.net", "crunchyroll.com", "disneyplus.com", "hulu.com", "primevideo.com",
  "max.com", "steampowered.com", "steamcommunity.com", "epicgames.com", "chase.com", "bankofamerica.com", "wellsfargo.com", "gmail.com"];
function refusesFrames(u) {
  const h = hostOf(u);
  return listed(NOFRAME, h) || /(^|\.)google\.[a-z.]+$/.test(h) || /(^|\.)amazon\.[a-z.]+$/.test(h);
}
function route(u, force) {
  const em = embedFor(u), mode = force || cfg.openMode;
  if (mode === "outside") return { inside:false };
  if (em) return Object.assign({ inside:true, embed:true }, em);
  if (force === "inside" || (mode === "inside" && !refusesFrames(u))) return { inside:true, src:u, title:hostOf(u) };
  return { inside:false };
}
function searchOf(u) {
  for (const k in ENGINES) {
    const e = ENGINES[k];
    if (u.indexOf(e.url) === 0) { try { return { q:decodeURIComponent(u.slice(e.url.length).split("&")[0].replace(/\+/g, " ")), e }; } catch (x) { return null; } }
  }
  return null;
}
function titleFor(u) {
  const s = searchOf(u);
  if (s) return s.q + " - " + s.e.name;
  const em = embedFor(u);
  return em ? em.title : hostOf(u);
}

/* ---------------------------------------------------------------- opening things */
// Out to Safari. A real link click, so iOS shows it over the app instead of
// replacing the app, and the address of this app is not sent along.
function openOut(u) {
  const a = document.createElement("a");
  a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a); a.click(); a.remove();
}
function record(u, t) {
  if (PRIVATE || cfg.saveHistory === false || !/^https?:/.test(u)) return;
  const h = load("history", []);
  if (h[0] && h[0].u === u) { h[0].ts = Date.now(); if (t) h[0].t = t; }
  else h.unshift({ u, t:t || hostOf(u), ts:Date.now() });
  if (h.length > 3000) h.length = 3000;
  save("history", h);
}
function retitle(u, t) {
  const h = load("history", []), e = h.find(x => x.u === u);
  if (e) { e.t = t; save("history", h); }
  [T.n, T.p].forEach(s => s.list.forEach(x => { if (x.u === u) x.t = t; }));
  saveTabs(); updateBar();
}
// Real titles for videos and songs, from a free oEmbed service.
function fetchTitle(u) {
  if (PRIVATE) return;
  fetch("https://noembed.com/embed?url=" + encodeURIComponent(u)).then(r => r.json()).then(j => {
    if (j && typeof j.title === "string" && j.title.trim()) retitle(u, j.title.trim().slice(0, 200));
  }).catch(() => {});
}

/* go: whatever was typed or tapped. opts.mode forces "inside" or "outside",
   opts.newTab opens a new tab for a page shown inside. */
function go(input, opts) {
  opts = opts || {};
  let u = typeof input === "string" ? resolve(input) : input && input.u;
  if (!u) return;
  closeOverlays();
  if (!/^https?:/i.test(u)) { openOut(u); return; }
  u = tidy(u);
  const plan = route(u, opts.mode);
  const title = plan.title && plan.title !== hostOf(u) ? plan.title : titleFor(u);
  record(u, title);
  if (!plan.inside) { openOut(u); return; }
  let t = curTab();
  if (opts.newTab || !t) t = addTab();
  Object.assign(t, { u, src:plan.src, t:title, embed:!!plan.embed, internal:false });
  dropFrame(t.id);
  activate(t.id);
  if (plan.oembed && title === plan.title) fetchTitle(u);
}
function openInternal(page, title) {
  closeOverlays();
  let t = curTab();
  if (!t || t.u) t = addTab();
  Object.assign(t, { u:page, src:page, t:title, internal:true, embed:false });
  dropFrame(t.id);
  activate(t.id);
}

/* ---------------------------------------------------------------- tabs
   Two lists: normal tabs (kept between launches) and private tabs (never saved). */
const T = { n:{ list:[], active:null }, p:{ list:[], active:null } };
const S = () => PRIVATE ? T.p : T.n;
const curTab = () => S().list.find(t => t.id === S().active) || null;
(function restoreTabs() {
  const saved = load("mtabs", null);
  if (saved && Array.isArray(saved.list) && saved.list.length) {
    T.n.list = saved.list.filter(t => t && t.id).map(t => ({ id:t.id, u:t.u || "", src:t.src || "", t:t.t || "", embed:!!t.embed, internal:!!t.internal }));
    T.n.active = T.n.list.some(t => t.id === saved.active) ? saved.active : T.n.list[T.n.list.length - 1].id;
  }
  if (!T.n.list.length) { const t = { id:uid(), u:"", src:"", t:"" }; T.n.list.push(t); T.n.active = t.id; }
})();
function saveTabs() {
  save("mtabs", { list:T.n.list.map(t => ({ id:t.id, u:t.u, src:t.src, t:t.t, embed:t.embed, internal:t.internal })), active:T.n.active });
}
function addTab() {
  const t = { id:uid(), u:"", src:"", t:"" };
  const s = S(), i = s.list.findIndex(x => x.id === s.active);
  s.list.splice(i < 0 ? s.list.length : i + 1, 0, t);
  return t;
}
function activate(id) {
  S().active = id;
  saveTabs();
  render();
}
function closeTab(id) {
  const s = S(), i = s.list.findIndex(t => t.id === id);
  if (i < 0) return;
  const t = s.list[i];
  if (!PRIVATE && t.u && !t.internal) {
    const c = load("closed", []).filter(x => x.u !== t.u);
    c.unshift({ u:t.u, t:t.t, ts:Date.now() });
    save("closed", c.slice(0, 20));
  }
  dropFrame(id);
  s.list.splice(i, 1);
  if (!s.list.length) s.list.push({ id:uid(), u:"", src:"", t:"" });
  if (s.active === id) s.active = s.list[Math.min(i, s.list.length - 1)].id;
  saveTabs();
}
function toHome(t) {
  if (!t) return;
  Object.assign(t, { u:"", src:"", t:"", embed:false, internal:false });
  dropFrame(t.id);
  activate(t.id);
}

/* ---------------------------------------------------------------- pages inside
   One iframe per tab, the three most recent kept alive. Back and forward use
   the browser's own history, which an iframe's pages join; the logs below
   remember which tab each step belongs to so Back never moves a hidden tab. */
const frames = new Map();       // tab id -> { el, src, loads }
let navLog = [], fwdLog = [], trav = null, travT = 0;
const LIVE = 3;
function ensureFrame(t) {
  let f = frames.get(t.id);
  if (f && f.src === t.src) { touchFrame(t.id); return f; }
  if (f) dropFrame(t.id);
  const el = document.createElement("iframe");
  if (t.internal) el.className = "internal";
  else {
    // no allow-top-navigation: a page cannot take the whole app away
    el.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads allow-pointer-lock");
    el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  }
  el.setAttribute("allow", "autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share; accelerometer; gyroscope");
  el.setAttribute("allowfullscreen", "");
  el.title = t.t || "Page";
  el.src = t.src;
  f = { el, src:t.src, loads:0, id:t.id };
  el.addEventListener("load", () => frameLoaded(f));
  $("#frames").appendChild(el);
  frames.set(t.id, f);
  touchFrame(t.id);
  progress(true);
  return f;
}
let lru = [];
function touchFrame(id) {
  lru = lru.filter(x => x !== id); lru.push(id);
  while (lru.length > LIVE) { const old = lru.find(x => x !== S().active); if (!old) break; dropFrame(old); }
}
function dropFrame(id) {
  const f = frames.get(id);
  if (f) { f.el.remove(); frames.delete(id); }
  lru = lru.filter(x => x !== id);
  navLog = navLog.filter(x => x !== id); fwdLog = fwdLog.filter(x => x !== id);
}
function frameLoaded(f) {
  f.loads++;
  if (f.id === S().active) progress(false);
  if (f.loads === 1) { const t = S().list.find(x => x.id === f.id); if (t && f.id === S().active) maybeHint(t); return; }
  if (trav === f.id) { trav = null; updateBar(); return; }
  navLog.push(f.id); fwdLog = [];
  updateBar();
}
function goBack() {
  const t = curTab();
  if (!t || !t.u) return;
  if (navLog[navLog.length - 1] === t.id) {
    trav = t.id; clearTimeout(travT); travT = setTimeout(() => { trav = null; }, 4000);
    fwdLog.push(navLog.pop()); history.back(); updateBar();
  } else toHome(t);   // the first page of the tab: back to the start page
}
function goFwd() {
  if (fwdLog[fwdLog.length - 1] !== S().active) return;
  trav = S().active; clearTimeout(travT); travT = setTimeout(() => { trav = null; }, 4000);
  navLog.push(fwdLog.pop()); history.forward(); updateBar();
}
function reload() {
  const t = curTab();
  if (!t || !t.u) { renderHome(); return; }
  dropFrame(t.id);
  render();
}
let progT = 0;
function progress(on) {
  const p = $("#progress");
  clearInterval(progT);
  if (on) {
    let w = 8; p.classList.add("on"); p.style.width = w + "%";
    progT = setInterval(() => { w += (90 - w) * .08; p.style.width = w + "%"; }, 200);
  } else if (p.classList.contains("on")) {
    p.style.width = "100%";
    setTimeout(() => { p.classList.remove("on"); setTimeout(() => { p.style.width = "0"; }, 400); }, 150);
  }
}
let hintT = 0;
function maybeHint(t) {
  hideHint();
  if (t.embed || t.internal) return;
  const h = $("#hint");
  h.innerHTML = "<span><b>Blank page?</b> Some sites don't allow being shown inside other apps.</span>" +
    '<button type="button" id="hintOpen">Open in Safari</button><button type="button" class="ghost" id="hintX" aria-label="Dismiss">' + ico("x") + "</button>";
  h.classList.remove("hide");
  $("#hintOpen").onclick = () => { hideHint(); openOut(t.u); };
  $("#hintX").onclick = hideHint;
  hintT = setTimeout(hideHint, 9000);
}
function hideHint() { clearTimeout(hintT); $("#hint").classList.add("hide"); }

/* ---------------------------------------------------------------- the view */
function render() {
  const t = curTab(), web = !!(t && t.u);
  $("#home").classList.toggle("hide", web);
  $("#frames").classList.toggle("hide", !web);
  hideHint();
  if (web) {
    const f = ensureFrame(t);
    frames.forEach((x, id) => x.el.classList.toggle("on", id === t.id));
    if (f.loads) progress(false);
    fxStop();
  } else {
    frames.forEach(x => x.el.classList.remove("on"));
    progress(false);
    renderHome();
  }
  updateBar();
}
function updateBar() {
  const t = curTab(), web = !!(t && t.u);
  const ub = $("#urlbtn");
  if (web) {
    ub.textContent = t.internal ? t.t : (t.t && t.embed ? t.t : hostOf(t.u));
    ub.classList.remove("ph");
    $("#siteIc").innerHTML = t.internal ? ico("game") : ico(/^https:/.test(t.u) ? "lock" : "world");
    $("#siteIc").classList.toggle("ok", /^https:/.test(t.u) && !t.internal);
  } else {
    ub.textContent = PRIVATE ? "Private - search or enter website" : "Search or enter website";
    ub.classList.add("ph");
    $("#siteIc").innerHTML = ico(PRIVATE ? "mask" : "glass");
    $("#siteIc").classList.remove("ok");
  }
  $("#extBtn").classList.toggle("hide", !web || !!t.internal);
  $("#relBtn").classList.toggle("hide", !web);
  $("#backBtn").disabled = !web;
  $("#fwdBtn").disabled = fwdLog[fwdLog.length - 1] !== S().active;
  $("#homeBtn").innerHTML = ico(web ? "home" : "glass");
  $("#homeBtn").setAttribute("aria-label", web ? "Start page" : "Search");
  $("#tabsN").textContent = S().list.length > 99 ? ":)" : S().list.length;
  document.title = web ? (t.t || hostOf(t.u)) + " - Webs" : "Webs Browser";
}

/* ---------------------------------------------------------------- start page */
const TIPS = [
  "Type “weather in Paris”, “20 usd to eur” or “btc price” in the address bar for an instant answer.",
  "Type “timer 5 min” in the address bar to start a timer.",
  "Start a search with !g, !b, !w or !br to use Google, Bing, Wikipedia or Brave for just that search.",
  "Type “yt lofi” to search YouTube, or “w octopus” to search Wikipedia.",
  "YouTube and Vimeo videos, Wikipedia, maps and Spotify open right inside Webs.",
  "Press and hold a shortcut to rename or remove it.",
  "Settings → Backup moves bookmarks, history and notes between your iPhone and Webs Browser on Windows.",
  "Private tabs (in the tab switcher) keep nothing in your history.",
  "Tracking junk like utm_ and fbclid is removed from links before they open.",
  "Type “define serendipity” to see what a word means.",
  "Type “3pm est to london” to convert between time zones.",
  "Type “tip 18% on 64 split 3” to split a bill.",
  "Type “roll 2d6”, “flip a coin” or “password” for a quick random answer.",
  "Prefer the address bar at the top? Settings → Appearance.",
  "Games on the start page work offline: Web Runner, Snake, 2048 and a daily word puzzle.",
  "Type “days until christmas” or “what day is 7/4/2030”.",
  "Notes and the to-do list are saved on this iPhone and come along in a backup."
];
const HIDE_KEYS = [["clock", "Clock"], ["greet", "Greeting and date"], ["weather", "Weather"], ["shortcuts", "Shortcuts"], ["recent", "Jump back in"],
                   ["reading", "Reading list"], ["todo", "To-do list"], ["tip", "Tip of the day"], ["fx", "Seasonal effects"]];
const hidden = k => k === "clock" ? cfg.clock === false : (cfg.ntpHide || []).indexOf(k) >= 0;
function setHidden(k, hide) {
  if (k === "clock") { setCfg("clock", !hide); return; }
  const h = (cfg.ntpHide || []).filter(x => x !== k);
  if (hide) h.push(k);
  setCfg("ntpHide", h);
}
function renderHome() {
  const b = document.body;
  HIDE_KEYS.forEach(([k]) => b.classList.toggle("h-" + k, hidden(k) || (PRIVATE && k !== "clock" && k !== "greet")));
  $("#privNote").classList.toggle("hide", !PRIVATE);
  $("#engBadge").textContent = engine().name[0];
  tick();
  tiles();
  recents();
  readingList();
  todos();
  timersBox();
  tipOfDay(0);
  weather();
  background();
  fxStart();
}
function tick() {
  const now = new Date();
  const showClock = !PRIVATE && !hidden("clock");
  $("#clock").classList.toggle("hide", !showClock);
  $("#mark").classList.toggle("hide", showClock);
  if (showClock) {
    const o = { hour:cfg.clock24 ? "2-digit" : "numeric", minute:"2-digit", hourCycle:cfg.clock24 ? "h23" : "h12" };
    if (cfg.clockSec) o.second = "2-digit";
    const parts = new Intl.DateTimeFormat([], o).formatToParts(now);
    const main = parts.filter(p => p.type !== "dayPeriod").map(p => p.value).join("").trim();
    const ap = (parts.find(p => p.type === "dayPeriod") || {}).value;
    $("#clock").innerHTML = esc(main) + (ap ? "<small>" + esc(ap) + "</small>" : "");
  }
  const h = now.getHours();
  const hi = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const name = String(cfg.ntpName || "").trim();
  $("#greet").innerHTML = PRIVATE ? "Private browsing" : esc(hi) + (name ? ", <b>" + esc(name) + "</b>" : "");
  $("#date").textContent = now.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" });
}

// Shortcuts: yours first, then the sites you visit most.
const SEED_TILES = [{ u:"https://www.youtube.com/", n:"YouTube" }, { u:"https://en.wikipedia.org/", n:"Wikipedia" },
                    { u:"https://www.google.com/", n:"Google" }, { u:"https://www.reddit.com/", n:"Reddit" }];
let tileList = [];
function tiles() {
  if (localStorage.getItem("wsb.tiles") === null) save("tiles", SEED_TILES);
  const mine = load("tiles", []), hid = new Set(load("hidden", []));
  const own = new Set(mine.map(t => hostOf(t.u)));
  const byHost = new Map();
  if (cfg.freq !== false) load("history", []).slice(0, 1500).forEach(h => {
    const host = hostOf(h.u);
    if (!host || hid.has(host) || own.has(host) || searchOf(h.u)) return;
    const e = byHost.get(host);
    if (e) e.visits++; else byHost.set(host, { u:"https://" + host + "/", n:host.replace(/\.(com|org|net|io|co)$/, ""), visits:1 });
  });
  const top = [...byHost.values()].sort((a, b) => b.visits - a.visits).slice(0, Math.max(0, 11 - mine.length));
  tileList = mine.map(t => Object.assign({ pinned:true }, t)).concat(top).slice(0, 11);
  $("#grid").innerHTML = tileList.map((t, i) =>
    '<button type="button" class="tile" data-i="' + i + '"><span class="fv">' + favHTML(t.u, t.n) + '<i class="del">' + ico("minus") + '</i></span><span class="nm">' +
    esc(t.n || hostOf(t.u)) + "</span></button>").join("") +
    '<button type="button" class="tile add" data-i="add"><span class="fv">' + ico("plus") + '</span><span class="nm">Add</span></button>';
}
function editTile(t) {
  ask({ title:t ? "Edit shortcut" : "Add shortcut",
    fields:[{ k:"n", label:"Name", value:t ? t.n || "" : "", ph:"e.g. Weather" },
            { k:"u", label:"Address", value:t ? t.u : "", ph:"example.com", type:"url" }],
    ok:t ? "Save" : "Add" }, v => {
    let u = v.u.trim();
    if (!u) return false;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { new URL(u); } catch (e) { toast("That address doesn't look right"); return false; }
    const list = load("tiles", []).filter(x => x.u !== u && (!t || x.u !== t.u));
    const at = t && t.pinned ? load("tiles", []).findIndex(x => x.u === t.u) : -1;
    const item = { u, n:v.n.trim() || hostOf(u) };
    if (at >= 0) list.splice(Math.min(at, list.length), 0, item); else list.push(item);
    save("tiles", list.slice(0, 11));
    tiles();
  });
}
function removeTile(t) {
  if (t.pinned) save("tiles", load("tiles", []).filter(x => x.u !== t.u));
  else { const h = load("hidden", []); h.push(hostOf(t.u)); save("hidden", h); }
  tiles();
}
function tileMenu(t) {
  pick(t.n || hostOf(t.u), [
    { label:"Open", fn:() => go({ u:t.u }) },
    { label:"Open inside Webs", fn:() => go({ u:t.u }, { mode:"inside", newTab:true }) },
    { label:"Edit", fn:() => editTile(t) },
    { label:"Remove", danger:true, fn:() => removeTile(t) }
  ]);
}
(function tileEvents() {
  const grid = $("#grid");
  let lp = 0, lpFired = false, start = null;
  grid.addEventListener("pointerdown", e => {
    const el = e.target.closest(".tile");
    if (!el || el.dataset.i === "add" || grid.classList.contains("editing")) return;
    lpFired = false; start = [e.clientX, e.clientY];
    lp = setTimeout(() => { lpFired = true; tileMenu(tileList[+el.dataset.i]); }, 480);
  });
  const cancel = () => clearTimeout(lp);
  grid.addEventListener("pointerup", cancel);
  grid.addEventListener("pointercancel", cancel);
  grid.addEventListener("pointermove", e => { if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) cancel(); });
  grid.addEventListener("contextmenu", e => e.preventDefault());
  grid.addEventListener("click", e => {
    const el = e.target.closest(".tile");
    if (!el) return;
    if (lpFired) { lpFired = false; return; }
    if (el.dataset.i === "add") { editTile(null); return; }
    const t = tileList[+el.dataset.i];
    if (grid.classList.contains("editing")) {
      if (e.target.closest(".del")) removeTile(t); else editTile(t.pinned ? t : Object.assign({}, t, { pinned:false }));
      return;
    }
    go({ u:t.u });
  });
  $("#tileEdit").onclick = () => {
    const on = grid.classList.toggle("editing");
    $("#tileEdit").textContent = on ? "Done" : "Edit";
  };
})();

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 7 * 86400) return Math.floor(s / 86400) + " d ago";
  return new Date(ts).toLocaleDateString([], { month:"short", day:"numeric" });
}
function rowHTML(o) {
  return '<button type="button" class="row" data-u="' + esc(o.u) + '"' + (o.data || "") + '><span class="fav">' + (o.icon ? ico(o.icon) : favHTML(o.u, o.t)) +
    '</span><span class="tx"><b>' + esc(o.t || hostOf(o.u)) + "</b><i>" + esc(o.sub != null ? o.sub : hostOf(o.u)) + "</i></span>" +
    (o.end ? '<span class="end">' + esc(o.end) + "</span>" : "") + (o.x ? '<span class="x" data-x="1" role="button" aria-label="Remove">' + ico("x") + "</span>" : "") + "</button>";
}
function recents() {
  const seen = new Set(), list = [];
  for (const h of load("history", [])) {
    if (seen.has(h.u)) continue;
    seen.add(h.u); list.push(h);
    if (list.length >= 5) break;
  }
  $("#recentSec").classList.toggle("hide", !list.length || PRIVATE || hidden("recent"));
  $("#recent").innerHTML = list.map(h => {
    const s = searchOf(h.u);
    return rowHTML({ u:h.u, t:s ? s.q : h.t, sub:(s ? "Search · " + s.e.name : hostOf(h.u)), end:ago(h.ts), icon:s ? "glass" : "" });
  }).join("");
}
function readingList() {
  const list = load("reading", []).filter(r => !r.done).slice(-3).reverse();
  $("#readSec").classList.toggle("hide", !list.length || PRIVATE || hidden("reading"));
  $("#reads").innerHTML = list.map(r => rowHTML({ u:r.u, t:r.t, data:' data-read="1"' })).join("");
}
document.addEventListener("click", e => {
  const r = e.target.closest("#recent .row, #reads .row");
  if (!r) return;
  if (r.dataset.read) markRead(r.dataset.u);
  go({ u:r.dataset.u });
});
function markRead(u) { save("reading", load("reading", []).map(x => x.u === u ? Object.assign(x, { done:true }) : x)); }

// To-do, shared with the Windows browser through backups.
function todos() {
  const list = load("todo", []), box = $("#todos");
  box.innerHTML = list.map(it => '<div class="todo' + (it.done ? " done" : "") + '" data-id="' + esc(it.id) + '"><button type="button" class="box" role="checkbox" aria-checked="' +
    !!it.done + '" aria-label="Done"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button><div class="tx">' + esc(it.t) +
    '</div><button type="button" class="rm" aria-label="Delete">' + ico("x") + "</button></div>").join("");
  box.classList.toggle("hide", !list.length);
  $("#todoClear").classList.toggle("hide", !list.some(x => x.done));
}
$("#todos").addEventListener("click", e => {
  const row = e.target.closest(".todo");
  if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest(".box")) save("todo", load("todo", []).map(x => x.id === id ? Object.assign(x, { done:!x.done }) : x));
  else if (e.target.closest(".rm")) save("todo", load("todo", []).filter(x => x.id !== id));
  else return;
  todos();
});
$("#todoNew").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const t = e.target.value.trim();
  if (!t) return;
  const list = load("todo", []);
  list.push({ id:uid(), t:t.slice(0, 200), done:false, ts:Date.now() });
  save("todo", list.slice(-50));
  e.target.value = "";
  todos();
});
$("#todoClear").onclick = () => { save("todo", load("todo", []).filter(x => !x.done)); todos(); };

// Timers started from the address bar ("timer 10 min").
function timersBox() {
  const list = load("timers", []).filter(t => t.end > Date.now());
  $("#timerSec").classList.toggle("hide", !list.length);
  if (!list.length) return;
  $("#timers").innerHTML = list.map(t => '<div class="row"><span class="fav">' + ico("timer") + '</span><span class="tx"><b>' +
    esc(fmtClock(Math.ceil((t.end - Date.now()) / 1000))) + "</b><i>" + esc(t.label || fmtDur(t.secs) + " timer") +
    '</i></span><span class="x" data-timer="' + esc(t.id) + '" role="button" aria-label="Cancel timer">' + ico("x") + "</span></div>").join("");
}
function fmtClock(s) { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }
$("#timers").addEventListener("click", e => {
  const x = e.target.closest("[data-timer]");
  if (x) { save("timers", load("timers", []).filter(t => t.id !== x.dataset.timer)); timersBox(); }
});

let tipN = -1;
function tipOfDay(step) {
  const box = $("#tip");
  if (PRIVATE || hidden("tip")) { box.classList.add("hide"); return; }
  if (tipN < 0) { const d = new Date(); tipN = Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5) % TIPS.length; }
  tipN = (tipN + (step || 0)) % TIPS.length;
  $("#tipT").textContent = TIPS[tipN];
  box.classList.remove("hide");
}
$("#tipNext").onclick = () => tipOfDay(1);
$("#tipX").onclick = () => { setHidden("tip", true); renderHome(); toast("Tips hidden", { label:"Undo", fn:() => { setHidden("tip", false); renderHome(); } }); };

/* Weather from Open-Meteo: free, no account and no key. Only the city you
   typed (or, if you chose it, your location) is sent. */
const WXI = {
  sun:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#f5b642"/><g stroke="#f5b642" stroke-width="2" stroke-linecap="round"><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/></g></svg>',
  moon:'<svg viewBox="0 0 32 32"><path d="M21 22a9 9 0 0 1-8.6-12.6A9 9 0 1 0 23.6 20.6 9 9 0 0 1 21 22z" fill="#c9cfe0"/></svg>',
  cloud:'<svg viewBox="0 0 32 32"><path d="M9 25a6 6 0 0 1-.6-12A8 8 0 0 1 24 13.5 5.8 5.8 0 0 1 23.5 25z" fill="#b8c0cc"/></svg>',
  partly:'<svg viewBox="0 0 32 32"><circle cx="12" cy="11" r="5" fill="#f5b642"/><path d="M11 27a5 5 0 0 1-.5-10A7 7 0 0 1 24 17.5 5 5 0 0 1 23.5 27z" fill="#b8c0cc"/></svg>',
  rain:'<svg viewBox="0 0 32 32"><path d="M9 20a5.5 5.5 0 0 1-.5-11A7.5 7.5 0 0 1 23 9.5 5.3 5.3 0 0 1 22.5 20z" fill="#9aa4b4"/><g stroke="#5aa0ff" stroke-width="2" stroke-linecap="round"><path d="M11 23l-1.5 4M16 23l-1.5 4M21 23l-1.5 4"/></g></svg>',
  snow:'<svg viewBox="0 0 32 32"><path d="M9 20a5.5 5.5 0 0 1-.5-11A7.5 7.5 0 0 1 23 9.5 5.3 5.3 0 0 1 22.5 20z" fill="#b8c0cc"/><g fill="#e6f0ff"><circle cx="11" cy="25" r="1.6"/><circle cx="16" cy="27" r="1.6"/><circle cx="21" cy="25" r="1.6"/></g></svg>',
  storm:'<svg viewBox="0 0 32 32"><path d="M9 19a5.5 5.5 0 0 1-.5-11A7.5 7.5 0 0 1 23 8.5 5.3 5.3 0 0 1 22.5 19z" fill="#8a93a3"/><path d="M17 18l-5 7h4l-2 5 6-8h-4l2-4z" fill="#f5b642"/></svg>',
  fog:'<svg viewBox="0 0 32 32"><g stroke="#b8c0cc" stroke-width="2.4" stroke-linecap="round"><path d="M6 11h20M4 16h24M7 21h18M10 26h12"/></g></svg>'
};
function wxKind(c, day) {
  return c === 0 ? (day ? "sun" : "moon") : c <= 2 ? (day ? "partly" : "cloud") : c === 3 ? "cloud" : c === 45 || c === 48 ? "fog" :
         (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : c >= 95 ? "storm" : c >= 51 ? "rain" : "cloud";
}
const wxUnit = () => cfg.wxUnit === "c" || cfg.wxUnit === "f" ? cfg.wxUnit : /^en-US$/i.test(navigator.language) ? "f" : "c";
let wxBusy = "";
async function weather() {
  const box = $("#wx");
  if (PRIVATE || hidden("weather")) { box.classList.add("hide"); return; }
  box.classList.remove("hide");
  const city = String(cfg.wxCity || "").trim(), here = cfg.wxCity === "@here" && cfg.wxLat != null, unit = wxUnit();
  const chip = text => { box.className = "chip"; box.textContent = text; box.onclick = () => openSettings("customize"); };
  if (!city) { chip("+ Add weather"); return; }
  const key = (here ? cfg.wxLat + "," + cfg.wxLon : city.toLowerCase()) + "|" + unit;
  const c = load("weather", null);
  const show = d => {
    box.className = "";
    box.innerHTML = WXI[wxKind(d.code, d.day)] + '<span class="tt"></span><span class="ww"><span></span><span></span></span>';
    box.querySelector(".tt").textContent = Math.round(d.t) + "°";
    const s = box.querySelectorAll(".ww span");
    s[0].textContent = d.name;
    s[1].textContent = (WXT[d.code] || "") + " · H " + Math.round(d.hi) + "° L " + Math.round(d.lo) + "°";
    box.onclick = () => here ? openSettings("customize") : openOmni("weather " + d.name);
  };
  if (c && c.key === key) { show(c); if (Date.now() - c.ts < 30 * 60000) return; }
  if (wxBusy === key) return;
  wxBusy = key;
  try {
    let lat = cfg.wxLat, lon = cfg.wxLon, name = "Your location";
    if (!here) {
      const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(city))).json();
      const loc = g && g.results && g.results[0];
      if (!loc) { chip("City not found: " + city); return; }
      lat = loc.latitude; lon = loc.longitude; name = loc.name;
    }
    const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto" +
      (unit === "f" ? "&temperature_unit=fahrenheit" : ""))).json();
    const d = { key, ts:Date.now(), name, t:w.current.temperature_2m, code:w.current.weather_code, day:w.current.is_day,
                hi:w.daily.temperature_2m_max[0], lo:w.daily.temperature_2m_min[0], unit };
    save("weather", d);
    show(d);
  } catch (e) { if (!(c && c.key === key)) chip("Weather unavailable right now"); }
  finally { wxBusy = ""; }
}

/* Your own background picture, kept in this app's database on the phone. */
const idb = {
  db:null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, bad) => {
      const r = indexedDB.open("webs", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => { this.db = r.result; ok(this.db); };
      r.onerror = () => bad(r.error);
    });
  },
  async op(mode, fn) { const db = await this.open(); return new Promise((ok, bad) => { const tx = db.transaction("files", mode); const q = fn(tx.objectStore("files")); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => bad(tx.error); }); },
  get(k) { return this.op("readonly", s => s.get(k)); },
  put(k, v) { return this.op("readwrite", s => s.put(v, k)); },
  del(k) { return this.op("readwrite", s => s.delete(k)); }
};
let bgURL = "";
async function background() {
  const l = $("#bgl");
  if (PRIVATE || !cfg.mbg) { l.style.backgroundImage = ""; document.body.classList.remove("pic"); return; }
  if (!bgURL) {
    try { const blob = await idb.get("bg"); if (blob) bgURL = URL.createObjectURL(blob); } catch (e) {}
  }
  if (!bgURL) { document.body.classList.remove("pic"); return; }
  l.style.backgroundImage = "url(" + bgURL + ")";
  l.style.setProperty("--dimv", (+cfg.bgDim || 0) / 100);
  document.body.classList.add("pic");
}
async function chooseBackground(file) {
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 2200 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement("canvas"), { width:Math.round(img.width * k), height:Math.round(img.height * k) });
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", .86));
    await idb.put("bg", blob);
    if (bgURL) URL.revokeObjectURL(bgURL);
    bgURL = "";
    if (cfg.bgDim == null) setCfg("bgDim", 20);
    setCfg("mbg", true);
    background();
    toast("Background set");
  } catch (e) { toast("That picture could not be used"); }
}

/* Seasonal effects: snow in winter, blossom in spring, fireflies in summer,
   leaves in autumn, drifting behind the start page. */
const fx = { cv:null, parts:[], raf:0, kind:"" };
function fxKind(d) { const m = (d || new Date()).getMonth(); return m === 11 || m <= 1 ? "snow" : m <= 4 ? "petals" : m <= 7 ? "fireflies" : "leaves"; }
function fxOn() {
  const t = curTab();
  return !PRIVATE && !hidden("fx") && cfg.motion !== "off" && !(t && t.u) && !document.hidden &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function fxStart() {
  if (!fxOn()) { fxStop(); return; }
  if (fx.raf) return;
  const home = $("#home");
  if (!fx.cv) { fx.cv = Object.assign(document.createElement("canvas"), { id:"fx" }); fx.cv.setAttribute("aria-hidden", "true"); home.prepend(fx.cv); }
  fx.kind = fxKind();
  const W = home.clientWidth, H = home.clientHeight, n = fx.kind === "fireflies" ? 18 : W < 600 ? 22 : 34;
  fx.parts = Array.from({ length:n }, () => fxNew(W, H, true));
  const g = fx.cv.getContext("2d");
  let last = performance.now();
  const step = now => {
    const dt = Math.min(50, now - last) / 16.7; last = now;
    const w = home.clientWidth, h = home.clientHeight, k = Math.min(2, devicePixelRatio || 1);
    fx.cv.style.top = home.scrollTop + "px";
    fx.cv.style.height = h + "px";
    if (fx.cv.width !== Math.round(w * k) || fx.cv.height !== Math.round(h * k)) { fx.cv.width = Math.round(w * k); fx.cv.height = Math.round(h * k); }
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w, h);
    fx.parts.forEach(p => fxDraw(g, p, dt, now));
    fx.parts = fx.parts.map(p => p.y > h + 20 || p.x < -30 || p.x > w + 30 ? fxNew(w, h, false) : p);
    fx.raf = fxOn() ? requestAnimationFrame(step) : 0;
    if (!fx.raf) fxStop();
  };
  fx.raf = requestAnimationFrame(step);
}
function fxStop() { cancelAnimationFrame(fx.raf); fx.raf = 0; if (fx.cv) { fx.cv.remove(); fx.cv = null; } }
function fxNew(W, H, anywhere) {
  const r = Math.random;
  return { x:r() * W, y:anywhere ? r() * H : -15, s:.5 + r() * 1, a:r() * 6.28, spin:(r() - .5) * .04, wob:r() * 6.28, hue:r(),
    vy:fx.kind === "fireflies" ? 0 : .25 + r() * .5, vx:(r() - .5) * .3, ph:r() * 6.28 };
}
function fxDraw(g, p, dt, now) {
  p.wob += .015 * dt; p.a += p.spin * dt;
  if (fx.kind === "fireflies") {
    p.x += Math.cos(p.wob * 1.3 + p.ph) * .35 * dt; p.y += Math.sin(p.wob + p.ph) * .25 * dt;
    const glow = .35 + .65 * Math.max(0, Math.sin(now / 700 + p.ph));
    const r = 2 + p.s * 1.5, grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
    grd.addColorStop(0, "rgba(255,236,140," + (.9 * glow) + ")"); grd.addColorStop(1, "rgba(255,220,90,0)");
    g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r * 5, 0, 7); g.fill();
    return;
  }
  p.y += p.vy * p.s * dt; p.x += (p.vx + Math.sin(p.wob) * .35) * dt;
  g.save(); g.translate(p.x, p.y); g.rotate(p.a);
  if (fx.kind === "snow") { g.globalAlpha = .45 + p.s * .35; g.fillStyle = themeNow() === "light" ? "#b9c6d8" : "#fff"; g.beginPath(); g.arc(0, 0, 1.2 + p.s * 1.8, 0, 7); g.fill(); }
  else if (fx.kind === "petals") { g.globalAlpha = .75; g.fillStyle = "hsl(" + (330 + p.hue * 25) + ",75%," + (82 - p.hue * 8) + "%)"; g.beginPath(); g.ellipse(0, 0, 3 + p.s * 3, 1.8 + p.s * 1.6, 0, 0, 7); g.fill(); }
  else {
    g.globalAlpha = .8; g.fillStyle = "hsl(" + (10 + p.hue * 35) + ",70%,45%)"; const z = 4 + p.s * 4;
    g.beginPath(); g.moveTo(0, -z); g.quadraticCurveTo(z * .9, 0, 0, z); g.quadraticCurveTo(-z * .9, 0, 0, -z); g.fill();
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = .8; g.beginPath(); g.moveTo(0, -z); g.lineTo(0, z); g.stroke();
  }
  g.restore();
}

setInterval(() => {
  const t = curTab();
  if (document.hidden || (t && t.u)) return;
  tick();
  if (!$("#timerSec").classList.contains("hide") || load("timers", []).length) timersBox();
}, 1000);
setInterval(() => { if (!document.hidden) weather(); }, 10 * 60000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { fxStop(); return; }
  const t = curTab();
  if (!(t && t.u)) renderHome();
});

/* ---------------------------------------------------------------- the address bar */
let rows = [];
function openOmni(prefill) {
  const ov = $("#omni"), q = $("#q");
  ov.classList.remove("hide");
  const t = curTab();
  q.value = prefill != null ? prefill : t && t.u && !t.internal ? t.u : "";
  q.focus();                 // inside the tap, so iOS brings up the keyboard
  if (prefill == null) q.select();
  $("#omniIc").innerHTML = ico(PRIVATE ? "mask" : "glass");
  omniRender();
}
function closeOmni() { $("#q").blur(); $("#omni").classList.add("hide"); sugQ = ""; }
function rowsHTML(list, startAt) {
  return list.map((r, i) => {
    const n = startAt + i;
    return '<button type="button" class="row' + (r.big ? " big" : "") + '" data-n="' + n + '"><span class="fav">' +
      (r.img ? '<img src="' + esc(r.img) + '" alt="">' : r.icon ? ico(r.icon) : favHTML(r.u, r.t)) + '</span><span class="tx' + (r.wrap ? " wrap" : "") + '"><b>' + esc(r.t) + "</b>" +
      (r.s ? "<i>" + esc(r.s) + "</i>" : "") + "</span>" + (r.fill ? '<span class="fill" data-fill="' + n + '" role="button" aria-label="Edit this search">' + ico("up") + "</span>" : "") + "</button>";
  }).join("");
}
function omniRender() {
  const raw = $("#q").value, s = raw.trim(), box = $("#omniList");
  $("#qClear").classList.toggle("hide", !raw);
  rows = [];
  let html = "";
  const sec = (title, list) => { if (!list.length) return; html += '<div class="sec">' + esc(title) + "</div>" + rowsHTML(list, rows.length); rows = rows.concat(list); };
  if (!s) {
    html += '<div class="sec">Search with</div><div class="chips" id="engChips">' + Object.keys(ENGINES).map(k =>
      '<button type="button" data-eng="' + k + '" class="' + (engine() === ENGINES[k] ? "on" : "") + '">' + esc(ENGINES[k].name) + "</button>").join("") + "</div>";
    html += '<div class="chips"><button type="button" id="pasteGo">' + ico("paste") + "Paste</button>" +
      '<button type="button" data-open="bookmarks">' + ico("star") + 'Bookmarks</button><button type="button" data-open="history">' + ico("history") + "History</button></div>";
    const seen = new Set();
    const hist = load("history", []).filter(h => !seen.has(h.u) && seen.add(h.u)).slice(0, 6)
      .map(h => { const sq = searchOf(h.u); return { u:h.u, t:sq ? sq.q : h.t || hostOf(h.u), s:sq ? "Search · " + sq.e.name : hostOf(h.u), icon:sq ? "history" : "", go:{ u:h.u } }; });
    if (!PRIVATE) sec("Recent", hist);
    sec("Bookmarks", load("bookmarks", []).slice(0, 5).map(b => ({ u:b.u, t:b.t || hostOf(b.u), s:hostOf(b.u), go:{ u:b.u } })));
    box.innerHTML = html;
    return;
  }
  const top = [];
  const c = calc(s);
  if (c != null) top.push({ t:"= " + fmtN(c, 10), s:s + " · Tap to copy", icon:"sparkle", big:1, copy:String(c) });
  const cv = convert(s);
  if (cv) top.push({ t:"= " + cv, s:s + " · Tap to copy", icon:"sparkle", big:1, copy:cv.replace(/[^\d.\-e]+.*$/, "") });
  answers(s).forEach(a => top.push({ t:a.t, s:a.s, icon:"sparkle", img:a.img, big:1, wrap:a.wrap, copy:a.copy, act:a.act }));
  const target = resolve(s), so = target && searchOf(target);
  top.push(so ? { t:s, s:"Search with " + so.e.name, icon:"glass", go:s }
              : { t:/^https?:/.test(target || "") ? tidy(target) : target, s:/^https?:/.test(target || "") ? (route(tidy(target)).inside ? "Open inside Webs" : "Open in Safari") : "Open", u:target, go:s });
  sec("", top);
  html = html.replace('<div class="sec"></div>', "");
  const l = s.toLowerCase();
  const match = x => (x.t || "").toLowerCase().includes(l) || (x.u || "").toLowerCase().includes(l);
  const open = S().list.filter(t => t.u && match({ t:t.t, u:t.u })).slice(0, 3).map(t => ({ u:t.u, t:t.t || hostOf(t.u), s:"Switch to tab", tab:t.id }));
  sec("Open tabs", open);
  sec("Bookmarks", load("bookmarks", []).filter(match).slice(0, 4).map(b => ({ u:b.u, t:b.t || hostOf(b.u), s:hostOf(b.u), go:{ u:b.u } })));
  if (!PRIVATE) {
    const seen = new Set();
    sec("History", load("history", []).filter(h => !searchOf(h.u) && match(h) && !seen.has(h.u) && seen.add(h.u)).slice(0, 5)
      .map(h => ({ u:h.u, t:h.t || hostOf(h.u), s:hostOf(h.u) + " · " + ago(h.ts), go:{ u:h.u } })));
  }
  html += '<div id="sugs"></div>';
  box.innerHTML = html;
  suggest(s);
}
// Search suggestions as you type: DuckDuckGo, or Wikipedia if that is unreachable.
let sugQ = "", sugT = 0, sugCtl = null, sugSrc = "ddg";
const sugCache = {};
function suggest(s) {
  clearTimeout(sugT);
  if (sugCtl) { sugCtl.abort(); sugCtl = null; }
  sugQ = s;
  if (!cfg.suggest || PRIVATE || s.length < 2 || /^[a-z][a-z0-9+.-]*:/i.test(s) || /^\S+\.\S+$/.test(s)) return;
  if (sugCache[s]) { showSugs(s, sugCache[s]); return; }
  sugT = setTimeout(async () => {
    const ctl = sugCtl = new AbortController();
    let list = null;
    if (sugSrc === "ddg") {
      try {
        const j = await (await fetch("https://duckduckgo.com/ac/?type=list&kl=wt-wt&q=" + encodeURIComponent(s), { signal:ctl.signal })).json();
        list = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : Array.isArray(j) ? j.map(x => x && x.phrase).filter(Boolean) : [];
      } catch (e) { if (e && e.name === "AbortError") return; sugSrc = "wiki"; }
    }
    if (!list) {
      try {
        const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=opensearch&format=json&formatversion=2&namespace=0&limit=6&origin=*&search=" +
          encodeURIComponent(s), { signal:ctl.signal })).json();
        list = Array.isArray(j[1]) ? j[1] : [];
      } catch (e) { return; }
    }
    sugCache[s] = list.filter(x => typeof x === "string" && x.toLowerCase() !== s.toLowerCase()).slice(0, 6);
    showSugs(s, sugCache[s]);
  }, 140);
}
function showSugs(s, list) {
  const box = $("#sugs");
  if (!box || s !== sugQ || $("#omni").classList.contains("hide") || !list.length) return;
  const items = list.map(x => ({ t:x, s:"", icon:"glass", go:x, fill:x }));
  box.innerHTML = '<div class="sec">Suggestions</div>' + rowsHTML(items, rows.length);
  rows = rows.concat(items);
}
function onAnswerReady(q) { if (!$("#omni").classList.contains("hide") && (!q || $("#q").value.trim() === q)) omniRender(); }
$("#q").addEventListener("input", omniRender);
$("#omniForm").addEventListener("submit", e => {
  e.preventDefault();
  const s = $("#q").value.trim();
  if (!s) return;
  const first = rows.find(r => r.act && r.big);
  if (first && /^(timer|set (a )?timer|countdown|remind me)/i.test(s)) { runRow(first); return; }
  go(s);
});
$("#omniList").addEventListener("click", e => {
  const eng = e.target.closest("[data-eng]");
  if (eng) { setCfg("search", eng.dataset.eng); omniRender(); $("#q").focus(); return; }
  if (e.target.closest("#pasteGo")) {
    // fills the box rather than going: iOS only opens Safari from a tap
    navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText().then(t => {
      t = t.trim(); if (!t) { toast("Nothing to paste"); return; }
      $("#q").value = t; $("#q").focus(); omniRender();
    }, () => toast("Paste isn't allowed here")) : toast("Paste isn't available");
    return;
  }
  const fill = e.target.closest("[data-fill]");
  if (fill) { const r = rows[+fill.dataset.fill]; $("#q").value = r.fill + " "; $("#q").focus(); omniRender(); return; }
  const b = e.target.closest("[data-n]");
  if (b) runRow(rows[+b.dataset.n]);
});
function runRow(r) {
  if (!r) return;
  if (r.act) {
    try { ringCtx = ringCtx || new AudioContext(); ringCtx.resume(); } catch (e) {}   // iOS only lets sound start from a tap
    r.act(); closeOmni(); renderHome(); return;
  }
  if (r.copy != null) { copyText(r.copy); return; }
  if (r.tab) { closeOverlays(); activate(r.tab); return; }
  if (r.go != null) go(r.go);
}
$("#qClear").onclick = () => { $("#q").value = ""; $("#q").focus(); omniRender(); };
$("#omniCancel").onclick = closeOmni;

/* ---------------------------------------------------------------- tab switcher */
function openTabs() {
  $("#tabsv").classList.remove("hide");
  renderTabs();
}
function renderTabs() {
  const s = S(), grid = $("#tabGrid");
  $$("#tabMode button").forEach(b => b.classList.toggle("on", (b.dataset.v === "1") === PRIVATE));
  $("#tabsTitle").textContent = s.list.length + (PRIVATE ? " private tab" : " tab") + (s.list.length === 1 ? "" : "s");
  grid.innerHTML = s.list.map(t => {
    const web = !!t.u;
    return '<div class="tcard' + (t.id === s.active ? " on" : "") + '" data-id="' + esc(t.id) + '" role="button" tabindex="0"><div class="th">' +
      (web ? (t.internal ? ico("game") : favHTML(t.u, t.t)) : ico(PRIVATE ? "mask" : "home")) + "<span>" + esc(web ? t.t || hostOf(t.u) : "Start page") +
      '</span><button type="button" class="tclose" aria-label="Close tab">' + ico("x") + '</button></div><div class="tb">' +
      (web ? '<span class="big">' + (t.internal ? ico("game") : favHTML(t.u, t.t)) + "</span><small>" + esc(t.internal ? "Games" : hostOf(t.u)) + "</small>"
           : '<svg class="mark"><use href="#logo"/></svg><small>' + (PRIVATE ? "Private" : "New tab") + "</small>") + "</div></div>";
  }).join("");
  const closed = PRIVATE ? [] : load("closed", []).slice(0, 5);
  if (closed.length) grid.insertAdjacentHTML("beforeend", '<section id="closedSec"><div class="lbl"><span>Recently closed</span></div><div class="card">' +
    closed.map(c => rowHTML({ u:c.u, t:c.t, end:ago(c.ts) })).join("") + "</div></section>");
}
$("#tabGrid").addEventListener("click", e => {
  const c = e.target.closest(".tcard"), r = e.target.closest("#closedSec .row");
  if (r) { const u = r.dataset.u; save("closed", load("closed", []).filter(x => x.u !== u)); go({ u }, { newTab:true, mode:"inside" }); return; }
  if (!c) return;
  if (e.target.closest(".tclose")) { closeTab(c.dataset.id); renderTabs(); updateBar(); return; }
  closeOverlays();
  activate(c.dataset.id);
});
// swipe a card sideways to close it
(function swipeClose() {
  let card = null, x0 = 0, y0 = 0, dx = 0, lock = "";
  const grid = $("#tabGrid");
  grid.addEventListener("touchstart", e => {
    card = e.target.closest(".tcard"); if (!card) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = "";
  }, { passive:true });
  grid.addEventListener("touchmove", e => {
    if (!card) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!lock) lock = Math.abs(mx) > Math.abs(my) + 4 ? "x" : Math.abs(my) > 8 ? "y" : "";
    if (lock !== "x") return;
    dx = mx; card.style.transition = "none"; card.style.transform = "translateX(" + dx + "px)"; card.style.opacity = String(1 - Math.min(.7, Math.abs(dx) / 300));
  }, { passive:true });
  grid.addEventListener("touchend", () => {
    if (!card) return;
    const c = card; card = null;
    c.style.transition = "";
    if (lock === "x" && Math.abs(dx) > 90) {
      c.style.transform = "translateX(" + (dx > 0 ? 120 : -120) + "%)"; c.style.opacity = "0";
      setTimeout(() => { closeTab(c.dataset.id); renderTabs(); updateBar(); }, 180);
    } else { c.style.transform = ""; c.style.opacity = ""; }
  });
})();
$("#tabMode").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  setPrivate(b.dataset.v === "1");
  renderTabs();
});
function setPrivate(on) {
  if (PRIVATE === on) return;
  frames.forEach((f, id) => dropFrame(id));
  PRIVATE = on;
  if (on && !T.p.list.length) { const t = { id:uid(), u:"", src:"", t:"" }; T.p.list.push(t); T.p.active = t.id; }
  applyLook();
  render();
}
$("#newTab").onclick = () => { const t = addTab(); closeOverlays(); activate(t.id); };
$("#tabsDone").onclick = () => { closeOverlays(); render(); };
$("#closeAll").onclick = () => {
  const n = S().list.length;
  pick("Close " + (n === 1 ? "this tab" : "all " + n + (PRIVATE ? " private" : "") + " tabs") + "?", [{ label:"Close " + (n === 1 ? "tab" : "all tabs"), danger:true, fn:() => {
    S().list.slice().forEach(t => closeTab(t.id));
    if (PRIVATE) { T.p.list = []; T.p.active = null; setPrivate(false); }
    closeOverlays(); render();
  } }]);
};

/* ---------------------------------------------------------------- sheets */
let sheetBackFn = null;
function openSheet(title, html, opts) {
  opts = opts || {};
  $("#sheetTitle").textContent = title;
  $("#sheetBody").onclick = null;
  $("#sheetBody").innerHTML = html;
  $("#sheetBody").scrollTop = 0;
  $("#sheet").classList.toggle("full", !!opts.full);
  $("#sheet").classList.remove("hide");
  $("#scrim").classList.remove("hide");
  sheetBackFn = opts.back || null;
  $("#sheetBack").classList.toggle("hide", !sheetBackFn);
  $("#sheetBack").innerHTML = ico("back");
  $("#sheet").dataset.kind = opts.kind || "";
}
function closeSheet() {
  if ($("#sheet").classList.contains("hide")) return;
  if ($("#sheet").dataset.kind === "note") flushNote();
  $("#sheet").classList.add("hide"); $("#scrim").classList.add("hide");
  $("#sheetBody").innerHTML = "";
}
$("#sheetDone").onclick = closeSheet;
$("#scrim").onclick = closeSheet;
$("#sheetBack").onclick = () => { if (sheetBackFn) sheetBackFn(); };
function closeOverlays() { closeOmni(); closeSheet(); $("#tabsv").classList.add("hide"); closeDlg(); }

// pull a sheet down by its handle to close it
(function dragSheet() {
  const sh = $("#sheet");
  let y0 = null, dy = 0;
  sh.addEventListener("touchstart", e => { if (e.target.closest(".grab, header") && !e.target.closest("button")) { y0 = e.touches[0].clientY; dy = 0; } }, { passive:true });
  sh.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = "translateY(" + dy + "px)"; sh.style.transition = "none"; }, { passive:true });
  sh.addEventListener("touchend", () => { if (y0 == null) return; y0 = null; sh.style.transition = ""; sh.style.transform = ""; if (dy > 110) closeSheet(); });
})();

/* the menu */
function openMenu() {
  const t = curTab(), web = !!(t && t.u) && !t.internal;
  const marked = web && load("bookmarks", []).some(b => b.u === t.u);
  const qa = web ? [["mark", marked ? "Saved" : "Bookmark", "star", marked], ["read", "Read later", "read"], ["share", "Share", "share"], ["copy", "Copy link", "copy"], ["safari", "Safari", "other"]]
                 : [["newtab", "New tab", "plus"], ["private", PRIVATE ? "Normal" : "Private", "mask"], ["games", "Games", "game"], ["notes", "Notes", "note"], ["customize", "Customize", "edit"]];
  const m = (act, label, icon, em) => '<button type="button" class="mrow" data-act="' + act + '">' + ico(icon) + "<span>" + esc(label) + "</span>" + (em ? "<em>" + esc(em) + "</em>" : "") + "</button>";
  const html = '<div class="qa">' + qa.map(([a, l, i, on]) => '<button type="button" data-act="' + a + '" class="' + (on ? "on" : "") + '">' + ico(i) + esc(l) + "</button>").join("") + "</div>" +
    '<div class="card">' +
    (web ? m("inside2", "Open in a new tab", "tabs") : "") +
    (web ? m("newtab", "New tab", "plus") : "") +
    m("private", PRIVATE ? "Leave private browsing" : "New private tab", "mask") +
    m("bookmarks", "Bookmarks", "star", load("bookmarks", []).length || "") +
    m("history", "History", "history") +
    m("reading", "Reading list", "read", load("reading", []).filter(r => !r.done).length || "") +
    (web ? m("notes", "Notes", "note") + m("games", "Games", "game") : "") +
    m("settings", "Settings", "gear") +
    "</div>" + '<div class="card" style="margin-top:12px">' +
    (!isStandalone() ? m("install", "Add Webs to your Home Screen", "phone") : "") +
    m("help", "Help - what works on iPhone", "info") + "</div>";
  openSheet(web ? t.t || hostOf(t.u) : "Webs Browser", html, { kind:"menu" });
}
const ACTIONS = {
  mark() {
    const t = curTab(); if (!t || !t.u) return;
    const list = load("bookmarks", []);
    if (list.some(b => b.u === t.u)) { save("bookmarks", list.filter(b => b.u !== t.u)); toast("Bookmark removed"); }
    else { list.unshift({ u:t.u, t:t.t || hostOf(t.u), ts:Date.now() }); save("bookmarks", list); toast("Bookmarked"); }
    closeSheet();
  },
  read() {
    const t = curTab(); if (!t || !t.u) return;
    const list = load("reading", []).filter(r => r.u !== t.u);
    list.push({ u:t.u, t:t.t || hostOf(t.u), ts:Date.now(), done:false });
    save("reading", list); closeSheet(); toast("Added to your reading list");
  },
  share() {
    const t = curTab(); if (!t || !t.u) return;
    if (navigator.share) navigator.share({ title:t.t || hostOf(t.u), url:t.u }).catch(() => {});
    else { copyText(t.u); }
    closeSheet();
  },
  copy() { const t = curTab(); if (t && t.u) copyText(t.u); closeSheet(); },
  safari() { const t = curTab(); closeSheet(); if (t && t.u) openOut(t.u); },
  inside2() { const t = curTab(); if (t && t.u) go({ u:t.u }, { newTab:true, mode:"inside" }); },
  newtab() { const t = addTab(); closeOverlays(); activate(t.id); },
  private() { closeOverlays(); setPrivate(!PRIVATE); toast(PRIVATE ? "Private browsing: nothing is saved to history" : "Back to your normal tabs"); },
  games() { closeOverlays(); openInternal("games.html", "Games"); },
  bookmarks() { openLibrary("bookmarks"); },
  history() { openLibrary("history"); },
  reading() { openLibrary("reading"); },
  notes() { openNotes(); },
  settings() { openSettings(); },
  customize() { openSettings("customize"); },
  install() { openHelp(true); },
  help() { openHelp(false); }
};
$("#sheetBody").addEventListener("click", e => {
  const a = e.target.closest("[data-act]");
  if (a && ACTIONS[a.dataset.act] && $("#sheet").dataset.kind === "menu") ACTIONS[a.dataset.act]();
});
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]");
  if (o && ACTIONS[o.dataset.open]) { if (!$("#omni").classList.contains("hide")) closeOmni(); ACTIONS[o.dataset.open](); return; }
  const a = e.target.closest("#homeFoot [data-act]");
  if (a && ACTIONS[a.dataset.act]) ACTIONS[a.dataset.act]();
});

/* ---------------------------------------------------------------- library */
let libKind = "bookmarks", libQ = "";
function openLibrary(kind) {
  libKind = kind; libQ = "";
  openSheet("Library", '<div class="seg" id="libSeg"><button type="button" data-v="bookmarks">Bookmarks</button><button type="button" data-v="history">History</button>' +
    '<button type="button" data-v="reading">Reading list</button></div><div class="search">' + ico("glass") +
    '<input type="search" id="libQ" placeholder="Search" autocomplete="off" autocapitalize="off" enterkeyhint="search"></div><div id="libList"></div>', { kind:"lib", full:true });
  $("#libSeg").onclick = e => { const b = e.target.closest("button"); if (b) { libKind = b.dataset.v; renderLib(); } };
  $("#libQ").oninput = e => { libQ = e.target.value.trim().toLowerCase(); renderLib(); };
  $("#libList").onclick = libClick;
  renderLib();
}
function dayLabel(ts) {
  const d = new Date(ts), now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((a - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric", year:d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
function renderLib() {
  $$("#libSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === libKind));
  const match = x => !libQ || (x.t || "").toLowerCase().includes(libQ) || (x.u || "").toLowerCase().includes(libQ);
  const box = $("#libList");
  const empty = (icon, text) => '<div class="empty">' + ico(icon) + esc(text) + "</div>";
  let html = "";
  if (libKind === "history") {
    const list = load("history", []).filter(match).slice(0, libQ ? 400 : 250);
    let day = "";
    list.forEach(h => {
      const d = dayLabel(h.ts);
      if (d !== day) { html += (day ? "</div>" : "") + '<div class="day">' + esc(d) + '</div><div class="card">'; day = d; }
      const s = searchOf(h.u);
      html += rowHTML({ u:h.u, t:s ? s.q : h.t, sub:(s ? "Search · " + s.e.name : hostOf(h.u)), end:new Date(h.ts).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }),
                        icon:s ? "glass" : "", x:1, data:' data-ts="' + h.ts + '"' });
    });
    if (day) html += "</div>";
    html = html || empty("history", libQ ? "Nothing in your history matches." : PRIVATE ? "Private tabs don't keep history." : "Pages you open will be listed here.");
    if (!libQ && load("history", []).length) html += '<div class="acts"><button type="button" class="btnx" id="histClear">' + ico("trash") + "Clear history…</button></div>";
  } else if (libKind === "bookmarks") {
    const list = load("bookmarks", []).filter(match);
    html = list.length ? '<div class="card">' + list.map(b => rowHTML({ u:b.u, t:b.t, x:1 })).join("") + "</div>"
                       : empty("star", libQ ? "No bookmarks match." : "Tap Bookmark in the menu while a page is open, or add one here.");
    if (!libQ) html += '<div class="acts"><button type="button" class="btnx" id="bmAdd">' + ico("plus") + "Add bookmark</button></div>";
  } else {
    const list = load("reading", []).filter(match).reverse();
    html = list.length ? '<div class="card">' + list.map(r => rowHTML({ u:r.u, t:r.t, sub:(r.done ? "Read · " : "") + hostOf(r.u), x:1, data:r.done ? ' style="opacity:.6"' : "" })).join("") + "</div>"
                       : empty("read", "Save pages to read later from the menu.");
  }
  box.innerHTML = html;
}
function libClick(e) {
  if (e.target.closest("#histClear")) { clearHistory(); return; }
  if (e.target.closest("#bmAdd")) {
    ask({ title:"Add bookmark", fields:[{ k:"t", label:"Name", ph:"Optional" }, { k:"u", label:"Address", ph:"example.com", type:"url" }], ok:"Add" }, v => {
      let u = v.u.trim(); if (!u) return false;
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      try { new URL(u); } catch (x) { toast("That address doesn't look right"); return false; }
      const list = load("bookmarks", []).filter(b => b.u !== u);
      list.unshift({ u, t:v.t.trim() || hostOf(u), ts:Date.now() }); save("bookmarks", list); renderLib();
    });
    return;
  }
  const r = e.target.closest(".row");
  if (!r) return;
  const u = r.dataset.u;
  if (e.target.closest("[data-x]")) {
    if (libKind === "history") save("history", load("history", []).filter(h => !(h.u === u && String(h.ts) === r.dataset.ts)));
    else if (libKind === "bookmarks") {
      const old = load("bookmarks", []);
      save("bookmarks", old.filter(b => b.u !== u));
      toast("Bookmark removed", { label:"Undo", fn:() => { save("bookmarks", old); if ($("#libList")) renderLib(); } });
    }
    else save("reading", load("reading", []).filter(x => x.u !== u));
    renderLib();
    return;
  }
  if (libKind === "reading") markRead(u);
  go({ u });
}
function clearHistory() {
  const cut = ms => { const t = Date.now() - ms; save("history", load("history", []).filter(h => h.ts < t)); renderLib(); toast("History cleared"); };
  pick("Clear history", [
    { label:"The last hour", fn:() => cut(3600e3) },
    { label:"Today", fn:() => { const d = new Date(); cut(Date.now() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()); } },
    { label:"Everything", danger:true, fn:() => { save("history", []); save("closed", []); save("weather", null); renderLib(); toast("History cleared"); } }
  ]);
}

/* ---------------------------------------------------------------- notes
   The same notes as the Windows sidebar: { id, title, text, ts }. */
let noteId = null, noteT = 0;
function openNotes() {
  noteId = null;
  const list = load("notes", []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const html = '<div class="acts" style="margin:0 0 14px"><button type="button" class="btnx m" id="noteNew">' + ico("plus") + "New note</button></div>" +
    (list.length ? '<div class="card">' + list.map(n => '<button type="button" class="row" data-note="' + esc(n.id) + '"><span class="fav">' + ico("note") +
      '</span><span class="tx"><b>' + esc(n.title || (n.text || "").split("\n")[0] || "Untitled") + "</b><i>" + esc(new Date(n.ts || Date.now()).toLocaleDateString([], { month:"short", day:"numeric" }) +
      " · " + ((n.text || "").replace(/\s+/g, " ").slice(0, 80) || "Empty")) + "</i></span></button>").join("") + "</div>"
                 : '<div class="empty">' + ico("note") + "Jot things down here. Notes stay on this iPhone and come along in backups.</div>");
  openSheet("Notes", html, { kind:"notes", full:true });
  $("#noteNew").onclick = () => {
    const n = { id:uid(), title:"", text:"", ts:Date.now(), site:"" };
    const all = load("notes", []); all.push(n); save("notes", all);
    openNote(n.id);
  };
  $("#sheetBody").onclick = e => { const r = e.target.closest("[data-note]"); if (r) openNote(r.dataset.note); };
}
function openNote(id) {
  const n = load("notes", []).find(x => x.id === id);
  if (!n) { openNotes(); return; }
  noteId = id;
  openSheet("Note", '<input id="noteTitle" placeholder="Title" maxlength="120"><textarea id="noteText" placeholder="Write something…"></textarea>' +
    '<div class="acts"><button type="button" class="btnx" id="noteShare">' + ico("share") + 'Share</button><button type="button" class="btnx" id="noteDel">' + ico("trash") + "Delete</button></div>",
    { kind:"note", full:true, back:() => { flushNote(); openNotes(); } });
  $("#sheetBody").onclick = null;
  $("#noteTitle").value = n.title || ""; $("#noteText").value = n.text || "";
  const saveSoon = () => { clearTimeout(noteT); noteT = setTimeout(flushNote, 500); };
  $("#noteTitle").oninput = saveSoon; $("#noteText").oninput = saveSoon;
  $("#noteDel").onclick = () => { save("notes", load("notes", []).filter(x => x.id !== id)); noteId = null; openNotes(); toast("Note deleted"); };
  $("#noteShare").onclick = () => {
    const text = ($("#noteTitle").value ? $("#noteTitle").value + "\n\n" : "") + $("#noteText").value;
    if (navigator.share) navigator.share({ text }).catch(() => {}); else copyText(text);
  };
  if (!n.text && !n.title) $("#noteText").focus();
}
function flushNote() {
  clearTimeout(noteT);
  if (!noteId || !$("#noteText")) return;
  const all = load("notes", []), n = all.find(x => x.id === noteId);
  if (!n) return;
  const title = $("#noteTitle").value, text = $("#noteText").value;
  if (!title.trim() && !text.trim()) { save("notes", all.filter(x => x.id !== noteId)); return; }
  if (n.title !== title || n.text !== text) { n.title = title; n.text = text; n.ts = Date.now(); save("notes", all); }
}

/* ---------------------------------------------------------------- settings */
const SW = (k, label, sub, on) => '<label class="srow"><span class="k">' + esc(label) + (sub ? "<i>" + esc(sub) + "</i>" : "") +
  '</span><span class="sw"><input type="checkbox" data-k="' + k + '"' + (on ? " checked" : "") + "><span></span></span></label>";
const RADIO = (k, v, label, sub, on) => '<button type="button" class="srow btn radio' + (on ? " on" : "") + '" data-radio="' + k + '" data-v="' + esc(v) + '"><span class="k">' +
  esc(label) + (sub ? "<i>" + esc(sub) + "</i>" : "") + "</span>" + ico("check") + "</button>";
const BTN = (act, label, value, cls, lead) => '<button type="button" class="srow btn ' + (cls || "") + '" data-set="' + act + '">' + (lead ? ico(lead, "ic lead") : "") +
  '<span class="k">' + esc(label) + "</span>" + (value ? '<span class="v">' + esc(value) + "</span>" : "") + (cls === "danger" ? "" : ico("right")) + "</button>";
const SEG = (k, opts, cur) => '<div class="seg" data-seg="' + k + '">' + opts.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (String(cur) === v ? "on" : "") + '">' + esc(l) + "</button>").join("") + "</div>";
const ROW = (label, inner) => '<div class="srow"><span class="k">' + esc(label) + "</span>" + inner + "</div>";
const GROUP = (title, rowsHtml, note) => '<div class="group">' + (title ? "<h3>" + esc(title) + "</h3>" : "") + '<div class="card">' + rowsHtml + "</div>" + (note ? '<p class="note">' + note + "</p>" : "") + "</div>";

let setPage = "";
function openSettings(page) {
  setPage = page || "";
  const html = page === "customize" ? customizeHTML() : settingsHTML();
  openSheet(page === "customize" ? "Customize start page" : "Settings", html, { kind:"settings", full:true, back:page === "customize" && $("#sheet").dataset.kind === "settings" ? () => openSettings() : null });
}
function settingsHTML() {
  const themeV = cfg.theme === "light" || cfg.theme === "dark" ? cfg.theme : "auto";
  return GROUP("Appearance",
      ROW("Theme", SEG("theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]], themeV)) +
      '<div class="swatches" role="radiogroup" aria-label="Accent color">' + ACCENTS.map(c => '<button type="button" data-accent="' + c + '" style="--c:' + c + '" class="' +
        ((cfg.accent || "#e8342a").toLowerCase() === c ? "on" : "") + '" aria-label="Accent ' + c + '"></button>').join("") + "</div>" +
      ROW("Address bar", SEG("barPos", [["bottom", "Bottom"], ["top", "Top"]], cfg.barPos === "top" ? "top" : "bottom")) +
      SW("motion", "Animations", "", cfg.motion !== "off")) +
    GROUP("Search engine", Object.keys(ENGINES).map(k => RADIO("search", k, ENGINES[k].name, "", engine() === ENGINES[k])).join("") +
      SW("suggest", "Search suggestions", "Sent to DuckDuckGo as you type. Never in private tabs.", cfg.suggest !== false),
      "Start with <b>!g</b>, <b>!d</b>, <b>!b</b>, <b>!w</b>, <b>!br</b>, <b>!s</b> or <b>!e</b> to pick an engine for one search. Keywords: " +
      keywords().map(k => "<b>" + esc(k.k) + "</b> " + esc(k.n)).join(", ") + ".") +
    GROUP("Opening websites",
      RADIO("openMode", "smart", "Smart", "Videos, Wikipedia, maps and Spotify inside Webs; everything else in Safari", cfg.openMode !== "inside" && cfg.openMode !== "outside") +
      RADIO("openMode", "inside", "Inside Webs when possible", "Tries every site here. Sites that refuse show a blank page with a way out.", cfg.openMode === "inside") +
      RADIO("openMode", "outside", "Always in Safari", "", cfg.openMode === "outside") +
      SW("https", "HTTPS first", "Upgrade http:// links to a secure connection", cfg.https !== false) +
      SW("clean", "Clean links", "Remove utm_, fbclid, gclid and other trackers from links", cfg.clean !== false),
      "iPhone only lets an app show a site inside itself when the site allows it. Safari opens on top of Webs; tap <b>Done</b> to come back.") +
    GROUP("Start page", BTN("customize", "Customize start page", "", "", "edit")) +
    GROUP("Privacy",
      SW("saveHistory", "Save history", "", cfg.saveHistory !== false) +
      BTN("clearHist", "Clear history…", "", "", "trash")) +
    GROUP("Backup",
      BTN("export", "Save a backup", "", "", "dl") +
      BTN("import", "Restore from a backup", "", "", "ul"),
      "One file with your bookmarks, history, reading list, notes, to-do, shortcuts and settings. It works both ways with Webs Browser on Windows " +
      "(Settings → Backup there): send the file to your iPhone with AirDrop, iCloud Drive or email and restore it here.") +
    GROUP("About",
      ROW("Version", '<span class="v">' + VERSION + (isStandalone() ? " · installed" : "") + "</span>") +
      BTN("help", "What works on iPhone") +
      (!isStandalone() ? BTN("install", "Add Webs to your Home Screen") : "") +
      BTN("eraseAll", "Erase all Webs data", "", "danger")) ;
}
function customizeHTML() {
  return GROUP("Greeting",
      '<div class="srow"><span class="k">Your name</span><input type="text" data-text="ntpName" maxlength="30" placeholder="Optional" value="' + esc(cfg.ntpName || "") + '" autocomplete="given-name"></div>' +
      SW("clock24", "24-hour clock", "", !!cfg.clock24) + SW("clockSec", "Show seconds", "", !!cfg.clockSec)) +
    GROUP("Weather",
      '<div class="srow"><span class="k">City</span><input type="text" data-text="wxCity" maxlength="60" placeholder="e.g. Chicago" value="' + esc(cfg.wxCity === "@here" ? "" : cfg.wxCity || "") + '" enterkeyhint="done"></div>' +
      BTN("wxHere", cfg.wxCity === "@here" ? "Using your location" : "Use my location", "", "", "pin") +
      ROW("Units", SEG("wxUnit", [["c", "°C"], ["f", "°F"]], wxUnit())),
      "From Open-Meteo. Only the city (or your rough location, if you choose it) is sent.") +
    GROUP("Show on the start page", HIDE_KEYS.map(([k, l]) => SW("show:" + k, l, "", !hidden(k))).join("") +
      SW("freq", "Frequently visited sites in shortcuts", "", cfg.freq !== false)) +
    GROUP("Background",
      BTN("bgPick", cfg.mbg ? "Choose another picture" : "Choose a picture", "", "", "edit") +
      (cfg.mbg ? ROW("Dim", SEG("bgDim", [["0", "None"], ["20", "Light"], ["40", "Strong"]], String(+cfg.bgDim || 0))) + BTN("bgRemove", "Remove picture", "", "danger") : ""));
}
function refreshSettings() {
  const y = $("#sheetBody").scrollTop;
  $("#sheetBody").innerHTML = setPage === "customize" ? customizeHTML() : settingsHTML();
  $("#sheetBody").scrollTop = y;
}
function afterSetting() { applyLook(); const t = curTab(); if (!(t && t.u)) renderHome(); updateBar(); }
$("#sheetBody").addEventListener("change", e => {
  if ($("#sheet").dataset.kind !== "settings") return;
  const el = e.target;
  if (el.dataset.k) {
    const k = el.dataset.k, on = el.checked;
    if (k.startsWith("show:")) setHidden(k.slice(5), !on);
    else if (k === "motion") setCfg("motion", on ? "" : "off");
    else setCfg(k, on);
    afterSetting();
  } else if (el.dataset.text) {
    const k = el.dataset.text, v = el.value.trim();
    if (k === "wxCity") { setCfg("wxCity", v); save("weather", null); }
    else setCfg(k, v);
    afterSetting();
  }
});
$("#sheetBody").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.text) e.target.blur(); });
$("#sheetBody").addEventListener("click", e => {
  if ($("#sheet").dataset.kind !== "settings") return;
  const seg = e.target.closest("[data-seg] button");
  if (seg) {
    const k = seg.parentNode.dataset.seg, v = seg.dataset.v;
    setCfg(k, k === "bgDim" ? +v : v);
    if (k === "wxUnit") save("weather", null);
    afterSetting(); refreshSettings(); return;
  }
  const acc = e.target.closest("[data-accent]");
  if (acc) { setCfg("accent", acc.dataset.accent); afterSetting(); refreshSettings(); return; }
  const r = e.target.closest("[data-radio]");
  if (r) { setCfg(r.dataset.radio, r.dataset.v); afterSetting(); refreshSettings(); return; }
  const b = e.target.closest("[data-set]");
  if (!b) return;
  const SET = {
    customize:() => openSettings("customize"),
    clearHist:clearHistory,
    export:exportBackup,
    import:() => pickFile(".json,application/json", importBackup),
    help:() => openHelp(false),
    install:() => openHelp(true),
    eraseAll:eraseAll,
    wxHere:() => {
      if (cfg.wxCity === "@here") { setCfg("wxCity", ""); save("weather", null); afterSetting(); refreshSettings(); return; }
      if (!navigator.geolocation) { toast("Location isn't available"); return; }
      navigator.geolocation.getCurrentPosition(p => {
        setCfg("wxLat", Math.round(p.coords.latitude * 100) / 100); setCfg("wxLon", Math.round(p.coords.longitude * 100) / 100);
        setCfg("wxCity", "@here"); save("weather", null); afterSetting(); if ($("#sheet").dataset.kind === "settings") refreshSettings();
      }, () => toast("Webs wasn't allowed to use your location"), { maximumAge:3600e3, timeout:15000 });
    },
    bgPick:() => pickFile("image/*", chooseBackground),
    bgRemove:() => { setCfg("mbg", false); idb.del("bg").catch(() => {}); if (bgURL) URL.revokeObjectURL(bgURL); bgURL = ""; afterSetting(); refreshSettings(); }
  };
  if (SET[b.dataset.set]) SET[b.dataset.set]();
});
function pickFile(accept, fn) {
  const inp = $("#fileIn");
  inp.value = ""; inp.accept = accept;
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) fn(f); };
  inp.click();
}

/* ---------------------------------------------------------------- backup
   The Windows browser's format: { app:"Webs Browser", version:1, saved, data:{ key:value } }. */
const BACKUP_KEYS = ["settings", "shield", "vpn", "bookmarks", "history", "sessions", "notes", "reading", "panels", "watch", "zooms", "tiles", "hidden", "stats",
  "closed", "todo", "screentime", "groups", "workspaces", "highlights", "offline", "watched", "intros", "rates", "collections", "game", "games", "follows",
  "stickies", "habits", "events", "ntpNote", "scratch", "ach", "counts", "watchHist", "icons"];
function exportBackup() {
  flushNote();
  const data = { app:"Webs Browser", version:1, saved:new Date().toISOString(), device:"iPhone", data:{} };
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem("wsb." + k); if (v != null) { try { data.data[k] = JSON.parse(v); } catch (e) {} } });
  const name = "Webs Browser backup " + new Date().toISOString().slice(0, 10) + ".json";
  const file = new File([JSON.stringify(data)], name, { type:"application/json" });
  if (navigator.canShare && navigator.canShare({ files:[file] })) {
    navigator.share({ files:[file], title:"Webs Browser backup" }).catch(e => { if (e && e.name !== "AbortError") download(file, name); });
  } else download(file, name);
}
function download(blob, name) {
  const a = Object.assign(document.createElement("a"), { href:URL.createObjectURL(blob), download:name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  toast("Backup saved");
}
async function importBackup(file) {
  let d;
  try { d = JSON.parse(await file.text()); } catch (e) { toast("That file isn't a Webs Browser backup"); return; }
  if (!d || d.app !== "Webs Browser" || !d.data || typeof d.data !== "object") { toast("That file isn't a Webs Browser backup"); return; }
  const x = d.data, n = { bookmarks:0, history:0, notes:0 };
  const mergeBy = (k, key) => {
    if (!Array.isArray(x[k])) return 0;
    const mine = load(k, []), have = new Set(mine.map(i => i && i[key]));
    const add = x[k].filter(i => i && i[key] && !have.has(i[key]));
    save(k, mine.concat(add));
    return add.length;
  };
  n.bookmarks = mergeBy("bookmarks", "u");
  if (Array.isArray(x.history)) {
    const mine = load("history", []), seen = new Set(mine.map(h => h.u + "|" + h.ts));
    const add = x.history.filter(h => h && h.u && !seen.has(h.u + "|" + h.ts));
    save("history", mine.concat(add).sort((a, b) => b.ts - a.ts).slice(0, 3000));
    n.history = add.length;
  }
  n.notes = mergeBy("notes", "id");
  mergeBy("reading", "u"); mergeBy("todo", "id"); mergeBy("tiles", "u");
  if (Array.isArray(x.hidden)) save("hidden", [...new Set(load("hidden", []).concat(x.hidden))]);
  if (x.icons && typeof x.icons === "object") { save("icons", Object.assign({}, x.icons, load("icons", {}))); iconCache = null; }
  if (x.settings && typeof x.settings === "object") {
    const keep = ["openMode", "barPos", "saveHistory", "clean", "theme", "mbg", "bgDim", "wxLat", "wxLon"];
    const merged = Object.assign({}, cfg, x.settings);
    keep.forEach(k => { if (k in cfg) merged[k] = cfg[k]; else delete merged[k]; });
    cfg = Object.assign({}, DEF, merged);
    save("settings", cfg);
  }
  // what only the Windows browser uses is kept, so a backup made here restores it there
  const own = new Set(["settings", "bookmarks", "history", "notes", "reading", "todo", "tiles", "hidden", "icons", "closed", "game", "games"]);
  BACKUP_KEYS.forEach(k => { if (!own.has(k) && k in x) save(k, x[k]); });
  ["game", "games"].forEach(k => { if (k in x && localStorage.getItem("wsb." + k) === null) save(k, x[k]); });
  save("weather", null);
  afterSetting();
  if ($("#sheet").dataset.kind === "settings") refreshSettings();
  toast("Restored " + n.bookmarks + " bookmark" + (n.bookmarks === 1 ? "" : "s") + ", " + n.history + " history item" + (n.history === 1 ? "" : "s") +
        " and " + n.notes + " note" + (n.notes === 1 ? "" : "s"));
}
function eraseAll() {
  pick("Erase all Webs data?", [{ label:"Erase everything", danger:true, fn:async () => {
    Object.keys(localStorage).filter(k => k.startsWith("wsb.")).forEach(k => localStorage.removeItem(k));
    try { await idb.del("bg"); } catch (e) {}
    location.reload();
  } }], "Bookmarks, history, notes, to-do, shortcuts and settings on this iPhone are deleted. This can't be undone.");
}

/* ---------------------------------------------------------------- help and install */
const SHARE_IOS = '<span class="ios">' + ico("share") + "</span>";
const installSteps = () => '<ol class="steps"><li><span>Tap ' + SHARE_IOS + " <b>Share</b> in Safari's toolbar</span></li>" +
  "<li><span>Scroll down and tap <b>Add to Home Screen</b></span></li><li><span>Tap <b>Add</b>. Webs is now on your Home Screen, full screen and offline-ready.</span></li></ol>";
function openHelp(install) {
  const html = '<div class="help">' +
    (install || !isStandalone() ? "<h4>Put Webs on your Home Screen</h4>" + (isIOS ? installSteps() :
      "<p>In Chrome or Edge, open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>" +
      (deferredInstall ? '<div class="acts"><button type="button" class="btnx m" id="doInstall">' + ico("dl") + "Install Webs</button></div>" : "")) : "") +
    "<h4>Works just like on Windows</h4><ul>" +
    "<li><b>Start page</b>: clock, greeting, weather, shortcuts, to-do, reading list, tips and seasonal effects.</li>" +
    "<li><b>Smart address bar</b>: calculator, units, currencies, time zones, dates, weather, word definitions, crypto prices, dice, passwords and timers. Bangs (<b>!g</b>, <b>!w</b>…) and keywords (<b>yt</b>, <b>w</b>, <b>gh</b>…).</li>" +
    "<li><b>Tabs</b> and <b>private tabs</b>, <b>bookmarks</b>, <b>history</b>, <b>reading list</b>, <b>notes</b> and <b>games</b>.</li>" +
    "<li><b>Clean links</b> and <b>HTTPS first</b>: trackers are stripped from links before they open.</li>" +
    "<li><b>Backups</b> in the same format as the Windows version, so your bookmarks and history move both ways.</li>" +
    "<li>Works <b>offline</b> once it has been opened.</li></ul>" +
    "<h4>Different on iPhone</h4><ul>" +
    "<li>Apple only lets an app show a website inside itself when the website allows it. <b>YouTube and Vimeo videos, Wikipedia, maps and Spotify</b> open inside Webs; other sites open in <b>Safari on top of Webs</b>. Tap <b>Done</b> there (or <b>◀ Webs</b> at the top-left) to come back.</li>" +
    "<li>Settings → Opening websites can try every site inside Webs. Sites that refuse show a blank page, with an <b>Open in Safari</b> button.</li></ul>" +
    "<h4>Only on Windows</h4><ul>" +
    "<li><b>Shield</b> (the ad blocker), the <b>VPN</b> and Tor, extensions, the download manager and developer tools. iOS doesn't allow web apps to do these.</li></ul>" +
    "<p style=\"margin-top:16px\">Version " + VERSION + ". Your data stays on this iPhone.</p></div>";
  openSheet(install ? "Install Webs" : "Help", html, { kind:"help", full:!install });
  const b = $("#doInstall");
  if (b) b.onclick = () => { deferredInstall.prompt(); deferredInstall = null; closeSheet(); };
}
// Chrome, Edge and Android offer their own install button.
let deferredInstall = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
function installNudge() {
  if (isStandalone() || load("installSeen", false) || !isIOS) return;
  const box = document.createElement("div");
  box.id = "install";
  box.setAttribute("role", "dialog");
  box.innerHTML = '<div class="hd"><img src="icons/apple-touch-icon.png" alt=""><div><b>Install Webs Browser</b><span>Full screen, on your Home Screen, works offline.</span></div></div>' +
    installSteps() + '<div class="acts"><button type="button" class="btnx" id="instLater">Not now</button></div>';
  document.body.appendChild(box);
  $("#instLater").onclick = () => { save("installSeen", true); box.remove(); };
}

/* ---------------------------------------------------------------- dialogs */
function closeDlg() { const d = $("#dlg"); if (d) d.remove(); }
function dlg(inner, onSubmit) {
  closeDlg();
  const d = document.createElement("div");
  d.id = "dlg";
  d.innerHTML = '<form autocomplete="off">' + inner + "</form>";
  document.body.appendChild(d);
  const f = d.querySelector("form");
  d.addEventListener("click", e => { if (e.target === d) closeDlg(); });
  f.addEventListener("submit", e => { e.preventDefault(); if (onSubmit && onSubmit() === false) return; closeDlg(); });
  return d;
}
// A list of choices, like iOS's action sheets.
function pick(title, opts, msg) {
  const d = dlg("<h3>" + esc(title) + "</h3>" + (msg ? "<p>" + esc(msg) + "</p>" : "") + '<div class="b" style="flex-direction:column">' +
    opts.map((o, i) => '<button type="button" data-i="' + i + '" class="' + (o.danger ? "danger" : "") + '">' + esc(o.label) + "</button>").join("") +
    '<button type="button" data-i="x">Cancel</button></div>');
  d.querySelector(".b").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    closeDlg();
    if (b.dataset.i !== "x") opts[+b.dataset.i].fn();
  });
}
// A small form. fn gets { key:value }; returning false keeps it open.
function ask(o, fn) {
  const d = dlg("<h3>" + esc(o.title) + "</h3>" + o.fields.map(f => '<label for="f_' + f.k + '">' + esc(f.label) + '</label><input id="f_' + f.k + '" name="' + f.k + '" value="' +
    esc(f.value || "") + '" placeholder="' + esc(f.ph || "") + '"' + (f.type === "url" ? ' inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"' : "") + ">").join("") +
    '<div class="b"><button type="button" id="dlgCancel">Cancel</button><button type="submit" class="m">' + esc(o.ok || "OK") + "</button></div>", () => {
    const v = {};
    o.fields.forEach(f => { v[f.k] = d.querySelector('[name="' + f.k + '"]').value; });
    return fn(v);
  });
  d.querySelector("#dlgCancel").onclick = closeDlg;
  const first = d.querySelector("input");
  if (first) first.focus();
}

/* ---------------------------------------------------------------- toolbar wiring */
$("#urlbtn").onclick = () => openOmni();
$("#heroSearch").onclick = () => openOmni("");
$("#siteIc").onclick = () => openOmni();
$("#extBtn").innerHTML = ico("other");
$("#relBtn").innerHTML = ico("rel");
$("#extBtn").onclick = () => { const t = curTab(); if (t && t.u) openOut(t.u); };
$("#relBtn").onclick = reload;
$("#backBtn").innerHTML = ico("back");
$("#fwdBtn").innerHTML = ico("fwd");
$("#menuBtn").innerHTML = ico("menu");
$("#newTab").innerHTML = ico("plus");
$("#qClear").innerHTML = ico("x");
$("#heroSearch .go").innerHTML = ico("fwd");
$("#backBtn").onclick = goBack;
$("#fwdBtn").onclick = goFwd;
$("#homeBtn").onclick = () => { const t = curTab(); if (t && t.u) toHome(t); else openOmni(""); };
$("#tabsBtn").onclick = openTabs;
$("#menuBtn").onclick = openMenu;
$("#wx").onclick = () => openSettings("customize");

// A keyboard, on an iPad or a computer.
addEventListener("keydown", e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""));
  if (e.key === "Escape") { if (!$("#dlg") && $("#sheet").classList.contains("hide") && $("#tabsv").classList.contains("hide")) closeOmni(); else closeOverlays(); return; }
  const mod = e.metaKey || e.ctrlKey, key = String(e.key || "").toLowerCase();
  if (mod && key === "l") { e.preventDefault(); openOmni(); }
  else if (mod && key === "t") { e.preventDefault(); ACTIONS.newtab(); }
  else if (mod && key === "w") { e.preventDefault(); const t = curTab(); if (t) { closeTab(t.id); render(); } }
  else if (!typing && e.key === "/" && $("#omni").classList.contains("hide")) { e.preventDefault(); openOmni(""); }
});

/* ---------------------------------------------------------------- offline and updates */
let updating = false;
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    const ready = w => {
      if (!navigator.serviceWorker.controller) return;   // first install: nothing to update
      toast("A new version of Webs is ready", { label:"Update", fn:() => { updating = true; w.postMessage("skip"); } });
    };
    if (reg.waiting) ready(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (w) w.addEventListener("statechange", () => { if (w.state === "installed") ready(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 3600e3);
  }).catch(() => {});
  // reload only for an update you asked for, not when the first install takes over
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) { updating = false; location.reload(); } });
}

/* ---------------------------------------------------------------- start */
applyLook();
render();
setTimeout(installNudge, 1500);
// a link shared to Webs (?q=...) or opened from the Home Screen shortcut list
(function launch() {
  const p = new URLSearchParams(location.search);
  const q = p.get("q") || p.get("url") || p.get("text");
  if (q) { history.replaceState(null, "", location.pathname); setTimeout(() => openOmni(q), 50); }
  else if (p.get("go") && ACTIONS[p.get("go")]) { const k = p.get("go"); history.replaceState(null, "", location.pathname); setTimeout(() => ACTIONS[k](), 50); }
})();
