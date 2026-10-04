/* ---------------------------------------------------------------- Webs 3.7: "From Webs" in the browser window (js/live.js)
   Checks in with the Web AI server about once an hour (the version, and the country Cloudflare
   sees; never what anyone browses; "Send anonymous counts" in Settings turns it off), unlocks the
   limited-time achievements, shows answers to problem reports, and takes secret words and the code
   hunt's code from the address bar: the effect plays on a new tab page (#lvfx=), since web pages
   cover this window. cloud.js asks Live which side of a gradual rollout this PC is on.
   3.7.1: the calling card and the announcement show in the window itself, over whatever page is
   open (many people start on another site, where the new tab page's cards never show): the card
   covers the window once, and the announcement opens once as a panel at the top right.
   3.7.3: everything else from the dashboard too, whatever start page someone uses: the 📣 button in
   the toolbar (with a dot when there's something new) opens From Webs: the news sent to everyone,
   the poll, today's trivia, the countdown, the mystery box, the pick of the week, the goal, the
   code hunt, the wallpaper and the quote of the day, and whether this PC can reach Webs's server.
   News sent to everyone (iPhones get it as a notification) opens once, like the announcement. */
(function () {
"use strict";
if (!window.Live) return;
Live.init({ platform:"windows", version:"@@WEBS_VERSION@@", isPrivate:() => PRIVATE, noFx:true, fresh:true, toast:(m, a) => toast(m, a), open:u => { closeOver(); newTab(u, false); },
  openReports:() => { if (window.X3 && X3.support) X3.support(); } });

// a secret word or the hunt's code, typed in the address bar
const go0 = go;
go = function (text) {
  const s = String(text || "").trim(), D = Live.data();
  if (PRIVATE || !s || s.length > 40 || /[./:]/.test(s) || !((D.secrets && D.secrets.length) || D.hunt)) return go0(text);
  Live.secret(s).then(hit => {
    if (!hit) return go0(text);
    const u = HOME + "newtab.html#lvfx=" + (hit === "hunt" ? "fireworks" : hit);
    if (active && isNtp(T(active))) send("navigate", active, u); else newTab(u, false);
    closeOver();
    toast(hit === "hunt" ? "🔍 You found the secret code!" : "🤫 You found a secret word!");
  }, () => go0(text));
};

// limited-time achievements, the community goal's and the hunt's join the list
const achPanel0 = achPanel;
achPanel = function () {
  const extra = Live.achievements();
  if (!extra.length) return achPanel0();
  const got = load("ach", {});
  const row = (on, icon, name, what) => { const r = el("div", "achv" + (on ? " got" : ""), "<b></b><span></span>"); r.querySelector("b").textContent = on ? icon : "🔒";
    r.querySelector("span").textContent = name; const e = el("em"); e.textContent = what; r.querySelector("span").appendChild(e); return r; };
  const rows = ACH.map(([id, icon, name, what]) => row(got[id], icon, name, what + (got[id] ? " · " + new Date(got[id]).toLocaleDateString() : "")))
    .concat(extra.map(a => row(a.got, a.e, a.name, a.desc + (a.got ? " · " + new Date(a.got).toLocaleDateString() : ""))));
  listPanel("achp", "Achievements - " + (Object.keys(got).length + extra.filter(a => a.got).length) + " of " + (ACH.length + extra.length), rows, "");
};
// what shows by itself, once each: the calling card (over the whole window), the announcement and
// the news (panels at the top right). Not in private windows, with From Webs hidden (Customize on the
// new tab page), during a full-screen video, or while a panel is open: then a little later.
const lget = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lput = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const shown = k => lget(k, []) || [];
const mark = (k, id) => lput(k, shown(k).concat(id).slice(-20));
const hiddenLive = () => ((load("settings", {}) || {}).ntpHide || []).includes("live");
const busy = () => !!overlay || document.body.classList.contains("fs") || !!document.getElementById("lock") || !!document.querySelector(".lv-cc");
let retry = 0;
const soon = ms => { clearTimeout(retry); retry = setTimeout(special, ms); };
function special() {
  clearTimeout(retry);
  paintBtn();
  if (PRIVATE || hiddenLive() || !active) return;
  const D = Live.data(), S = Live.seen();
  const card = D.card && !S.cards.includes(D.card.id), ann = D.ann && !S.ann[D.ann.id] && !shown("liveWinAnn").includes(D.ann.id), news = D.news && !shown("liveWinNews").includes(D.news.id);
  if (!card && !ann && !news) return;
  if (document.visibilityState !== "visible" || busy()) { soon(15000); return; }
  if (card) coverCard(); else if (ann) annPanel(); else newsPanel();
}
function coverCard() {
  if (!Live.callingCard()) return;
  const cc = document.querySelector(".lv-cc");
  // the whole window belongs to the card until it's clicked (as with a locked private window)
  const cover = () => { if (cc.isConnected) send("layout", Math.round(innerHeight * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), devicePixelRatio, "", 0, 0); };
  const esc = e => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") cc.click(); };
  cover(); addEventListener("resize", cover); addEventListener("keydown", esc);
  cc.tabIndex = -1; cc.focus({ preventScroll:true });
  new MutationObserver((m, o) => {
    if (cc.isConnected) return;
    o.disconnect(); removeEventListener("resize", cover); removeEventListener("keydown", esc);
    lastLayout = ""; relayout(); send("focus-content");
    soon(1500);       // then the announcement or the news, if there is any
  }).observe(document.body, { childList:true });
}
P.megaphone = "M4 10v4h3l6 4V6L7 10H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12";
const MEGA = ico("megaphone");
function pop(id, icon, title, sub, text, btns) {
  const p = el("div", "xpane lvann");
  p.innerHTML = '<div class="xhead"><div class="xic"></div><div><b></b><span></span></div><button class="lvann-x" title="Close">✕</button></div><p class="lvann-t"></p><div class="lvann-r"></div><div class="xbtns"></div>';
  p.querySelector(".xic").textContent = icon; p.querySelector("b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  p.querySelector(".lvann-t").textContent = text;
  btns.forEach(([label, main, fn]) => { const b = el("button", "btn2" + (main ? " main" : "")); b.textContent = label; b.onclick = fn; p.querySelector(".xbtns").appendChild(b); });
  const n = openOver(id, p); n.style.right = "8px";
  return p;
}
function annPanel() {
  const a = Live.data().ann;
  mark("liveWinAnn", a.id);
  const done = () => { Live.closeAnn(a.id); closeOver(); };
  const p = pop("lvann", "📣", "From Webs", "The people who make Webs", a.text,
    (a.link ? [["Open", false, () => { closeOver(); newTab(a.link, false); }]] : []).concat([["Got it", true, done]]));
  p.querySelector(".lvann-x").onclick = done;
  const paintR = () => {
    const r = p.querySelector(".lvann-r"), mine = Live.seen().react[a.id];
    r.innerHTML = "";
    if (a.react) Live.REACTS.forEach(e => { const b = el("button", e === mine ? "on" : ""); b.textContent = e; b.title = "React with " + e; b.onclick = () => { Live.react(a.id, e); paintR(); }; r.appendChild(b); });
  };
  paintR();
}
function newsPanel() {
  const x = Live.data().news;
  mark("liveWinNews", x.id);
  const p = pop("lvnews", "🔔", x.title, "News from the people who make Webs", x.body,
    (x.url ? [["Open", false, () => { closeOver(); newTab(x.url, false); }]] : []).concat([["OK", true, () => closeOver()]]));
  p.querySelector(".lvann-x").onclick = () => closeOver();
}

// the 📣 button and the From Webs panel: everything on now, whatever the start page
const sig = () => {
  const D = Live.data(), q = Live.quote(), parts = [];
  if (D.news) parts.push("n" + D.news.id);
  if (D.ann && !Live.seen().ann[D.ann.id]) parts.push("a" + D.ann.id);
  if (D.poll) parts.push("p" + D.poll.id);
  (D.trivia || []).forEach(t => parts.push("t" + t.date));
  if (D.countdown) parts.push("c" + D.countdown.date + D.countdown.label);
  if (D.pick) parts.push("k" + D.pick.url);
  if (D.goal) parts.push("g" + D.goal.id);
  if (D.hunt) parts.push("h" + D.hunt.id);
  if (D.wall) parts.push("w" + D.wall.id);
  if (q) parts.push("q" + q.date);
  if (D.maint) parts.push("m");
  return parts.join(",");
};
const btn = el("button", "btn lvb");
btn.id = "lvb"; btn.innerHTML = MEGA + "<i></i>"; btn.title = "From Webs: news, polls and fun from the people who make Webs";
btn.onclick = () => { if (overlay === "lvp") closeOver(); else fromWebs(); };
const nextTo = $("#aib") || $("#sideb");
nextTo.before(btn);
TOOLBAR.splice(Math.max(0, TOOLBAR.findIndex(b => b[0] === nextTo.id)), 0, ["lvb", "From Webs"]);
applyToolbar();
function paintBtn() {
  const s = sig(), on = !PRIVATE && !hiddenLive() && !!s;
  btn.classList.toggle("hide", !on);
  btn.classList.toggle("new", on && s !== lget("liveWinSig", ""));
}
function age(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago"; }
function fromWebs() {
  lput("liveWinSig", sig()); paintBtn();
  const p = el("div", "xpane lvp");
  p.innerHTML = '<div class="xhead"><div class="xic">' + MEGA + '</div><div><b>From Webs</b><span class="lvp-st"></span></div><button class="lvann-x" title="Close">✕</button></div><div class="lvp-news"></div><div class="lv-wrap lvp-cards"></div><div class="lvp-q"></div><div class="xsmall lvp-empty"></div>';
  p.querySelector(".lvann-x").onclick = () => closeOver();
  const paint = () => {
    const D = Live.data(), st = Live.status(), last = st.last || {};
    p.querySelector(".lvp-st").textContent = !st.server ? "Not connected yet: Webs gets the server's address with its next update check"
      : last.why && last.at >= st.at ? last.why : st.at ? "Updated " + age(st.at) : "Checking…";
    p.querySelector(".lvp-st").title = st.server ? "Webs's server: " + st.server : "";
    const nw = p.querySelector(".lvp-news"); nw.innerHTML = "";
    if (D.news) { const c = el("div", "lv-card lvp-n", "<b></b><p></p>"); c.querySelector("b").textContent = "🔔 " + D.news.title; c.querySelector("p").textContent = D.news.body;
      if (D.news.url) { const a = el("a", "lv-link"); a.textContent = "Open ›"; a.href = "#"; a.onclick = e => { e.preventDefault(); closeOver(); newTab(D.news.url, false); }; c.appendChild(a); } nw.appendChild(c); }
    const cards = p.querySelector(".lvp-cards"); Live.render(cards);
    const q = Live.quote(), qb = p.querySelector(".lvp-q"); qb.innerHTML = "";
    if (q) { const c = el("div", "lv-card", "<b>💬 Quote of the day</b><p></p><span></span>"); c.querySelector("p").textContent = "“" + q.text + "”"; c.querySelector("span").textContent = "- " + (q.by || "Webs"); qb.appendChild(c); }
    p.querySelector(".lvp-empty").textContent = !D.news && cards.classList.contains("lv-hide") && !q ? "Nothing from Webs right now. When the people who make Webs post something, it shows here." : "";
  };
  paint();
  openOver("lvp", p).style.right = "8px";
  new ResizeObserver(() => { if (overlay === "lvp") relayout(); }).observe(p);
  panelPaint = paint;
  Live.refresh(true).then(() => { if (overlay === "lvp") paint(); });
}
let panelPaint = null;
X3.fromWebs = fromWebs;
const menuRows7 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows7) menuRows7(m);
  if (!PRIVATE) m.appendChild(row("sparkle", "From Webs", btn.classList.contains("new") ? "New" : "", fromWebs));
};
const st = document.createElement("style");
st.textContent = ".lvann .xic{font-size:20px}.lvann .xhead{position:relative}.lvann-x{border:0;background:none;color:var(--dim);font-size:13px;cursor:pointer;padding:4px 6px;align-self:flex-start}.lvann-x:hover{color:var(--fg)}" +
  ".lvann-t{margin:2px 0 10px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}" +
  ".lvann-r{display:flex;gap:6px;margin-bottom:10px}.lvann-r:empty{display:none}.lvann-r button{border:1px solid var(--line);background:var(--bg3);border-radius:99px;padding:3px 10px;font-size:16px;cursor:pointer;transition:transform .2s}" +
  ".lvann-r button.on{border-color:var(--accent);background:var(--soft);transform:scale(1.12)}" +
  ".lvb{position:relative}.lvb.hide{display:none}.lvb i{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--accent);display:none}.lvb.new i{display:block}" +
  ".lvp{width:440px}.lvp .xic svg{width:20px;height:20px}.lvp .lv-wrap{margin:0}.lvp .lv-card{font-size:13.5px}.lvp-news .lv-card,.lvp-q .lv-card{margin-bottom:10px}.lvp-q .lv-card{margin-top:10px}.lvp .lv-card p{margin:0}";
document.head.appendChild(st);

Live.on(() => { Live.checkAch(); if (panelPaint && overlay === "lvp") panelPaint(); soon(2500); });
setTimeout(() => Live.checkAch(), 25000);
soon(6000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") soon(2000); });
// a computer that hasn't got the server's address yet gets it with the update check (cloud.js), 25 s in
setTimeout(() => { if (!Live.data().ok) Live.refresh(true); }, 40000);
})();
