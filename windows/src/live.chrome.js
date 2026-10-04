/* ---------------------------------------------------------------- Webs 3.7: "From Webs" in the browser window (js/live.js)
   Checks in with the Web AI server about once an hour (the version, and the country Cloudflare
   sees; never what anyone browses; "Send anonymous counts" in Settings turns it off), unlocks the
   limited-time achievements, shows answers to problem reports, and takes secret words and the code
   hunt's code from the address bar: the effect plays on a new tab page (#lvfx=), since web pages
   cover this window. cloud.js asks Live which side of a gradual rollout this PC is on.
   3.7.1: the calling card and the announcement show in the window itself, over whatever page is
   open (many people start on another site, where the new tab page's cards never show): the card
   covers the window once, and the announcement opens once as a panel at the top right. */
(function () {
"use strict";
if (!window.Live) return;
Live.init({ platform:"windows", version:"@@WEBS_VERSION@@", isPrivate:() => PRIVATE, noFx:true, toast:(m, a) => toast(m, a),
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
// the calling card and the announcement, in the window: not in private windows, with From Webs
// hidden (Customize on the new tab page), during a full-screen video, or while a panel is open
const shownKey = "wsb.liveWinAnn";
const shown = () => { try { return JSON.parse(localStorage.getItem(shownKey) || "[]") || []; } catch (e) { return []; } };
const hiddenLive = () => ((load("settings", {}) || {}).ntpHide || []).includes("live");
const busy = () => !!overlay || document.body.classList.contains("fs") || !!document.getElementById("lock") || !!document.querySelector(".lv-cc");
let retry = 0;
const soon = ms => { clearTimeout(retry); retry = setTimeout(special, ms); };
function special() {
  clearTimeout(retry);
  if (PRIVATE || hiddenLive() || !active) return;
  const D = Live.data(), S = Live.seen();
  const card = D.card && !S.cards.includes(D.card.id), ann = D.ann && !S.ann[D.ann.id] && !shown().includes(D.ann.id);
  if (!card && !ann) return;
  if (document.visibilityState !== "visible" || busy()) { soon(15000); return; }
  if (card) coverCard(); else annPanel();
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
    soon(1500);       // then the announcement, if there is one
  }).observe(document.body, { childList:true });
}
function annPanel() {
  const a = Live.data().ann;
  localStorage.setItem(shownKey, JSON.stringify(shown().concat(a.id).slice(-20)));
  const p = el("div", "xpane lvann");
  p.innerHTML = '<div class="xhead"><div class="xic">📣</div><div><b>From Webs</b><span>The people who make Webs</span></div><button class="lvann-x" title="Close">✕</button></div><p class="lvann-t"></p><div class="lvann-r"></div><div class="xbtns"></div>';
  p.querySelector(".lvann-t").textContent = a.text;
  const paintR = () => {
    const r = p.querySelector(".lvann-r"), mine = Live.seen().react[a.id];
    r.innerHTML = "";
    if (a.react) Live.REACTS.forEach(e => { const b = el("button", e === mine ? "on" : ""); b.textContent = e; b.title = "React with " + e; b.onclick = () => { Live.react(a.id, e); paintR(); }; r.appendChild(b); });
  };
  paintR();
  const bt = p.querySelector(".xbtns");
  if (a.link) { const o = el("button", "btn2"); o.textContent = "Open"; o.onclick = () => { closeOver(); newTab(a.link, false); }; bt.appendChild(o); }
  const ok = el("button", "btn2 main"); ok.textContent = "Got it"; ok.onclick = () => { Live.closeAnn(a.id); closeOver(); }; bt.appendChild(ok);
  p.querySelector(".lvann-x").onclick = () => { Live.closeAnn(a.id); closeOver(); };
  const n = openOver("lvann", p); n.style.right = "8px";
}
const st = document.createElement("style");
st.textContent = ".lvann .xic{font-size:20px}.lvann .xhead{position:relative}.lvann-x{border:0;background:none;color:var(--dim);font-size:13px;cursor:pointer;padding:4px 6px;align-self:flex-start}.lvann-x:hover{color:var(--fg)}" +
  ".lvann-t{margin:2px 0 10px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}" +
  ".lvann-r{display:flex;gap:6px;margin-bottom:10px}.lvann-r:empty{display:none}.lvann-r button{border:1px solid var(--line);background:var(--bg3);border-radius:99px;padding:3px 10px;font-size:16px;cursor:pointer;transition:transform .2s}" +
  ".lvann-r button.on{border-color:var(--accent);background:var(--soft);transform:scale(1.12)}";
document.head.appendChild(st);

Live.on(() => { Live.checkAch(); soon(2500); });
setTimeout(() => Live.checkAch(), 25000);
soon(6000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") soon(2000); });
})();
