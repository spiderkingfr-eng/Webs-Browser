/* Webs 3.7: "From Webs" on the new tab page (js/live.js, the same file as in the iPhone app): the
   cards under the search box (news with reactions, a poll, today's trivia, the mystery box, a
   countdown, the owner's pick, the community goal, the code hunt), the calling card, theme days,
   the owner's quote of the day, and the wallpaper of the week for people who choose it. A secret
   word typed in the address bar opens this page with #lvfx=<effect>, which plays here.
   Customize → Show on this page → "From Webs" turns the cards off. */
(function () {
"use strict";
if (!window.Live) return;
const VERSION = "@@WEBS_VERSION@@";
SHOW.push(["live", "From Webs: news, polls and fun"]);

// a small message at the bottom of the page
function toast(msg) {
  let t = $("lvToast");
  if (!t) { t = document.createElement("div"); t.id = "lvToast"; document.body.appendChild(t); }
  t.textContent = String(msg || ""); t.classList.add("on");
  clearTimeout(t.tm); t.tm = setTimeout(() => t.classList.remove("on"), 3200);
}
const st = document.createElement("style");
st.textContent = "#liveSec{margin-top:22px}#liveSec .lv-wrap{margin:0}" +
  "#lvToast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,12px);z-index:9997;background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:12px;font-size:13.5px;max-width:min(520px,calc(100vw - 32px));opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}" +
  "#lvToast.on{opacity:1;transform:translate(-50%,0)}";
document.head.appendChild(st);

const sec = document.createElement("section"); sec.id = "liveSec"; sec.className = "hide";
sec.innerHTML = '<div id="liveBox" class="lv-wrap lv-hide"></div>';
$("f").after(sec);
const off = () => PRIVATE || hidden("live");
Live.init({ platform:"windows", version:VERSION, isPrivate:() => PRIVATE, hidden:() => hidden("live"), toast, noPing:true, onWall:() => paintBackground(), anime:() => { $("bgbox").classList.remove("hide"); paintBgBox(); scrollTo(0, 0); } });

function paint() {
  Live.render($("liveBox"));
  sec.classList.toggle("hide", $("liveBox").classList.contains("lv-hide"));
}

// the calling card once, and today's theme at most every 10 minutes (any tab)
function special() {
  if (off() || document.hidden) return;
  Live.callingCard();
  if (hidden("fx")) return;      // "Seasonal effects" off: no theme days either
  const last = +get("liveFxAt", 0) || 0;
  if (Date.now() - last < 10 * 60000) return;
  if (Live.themeFx()) put("liveFxAt", Date.now());
}

// a secret word or the hunt's code, from the address bar
function hashFx() {
  const m = /^#lvfx=([a-z]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  const k = m[1];
  if (k === "confetti" || k === "fireworks") Live.burst(k); else Live.fx(k, 6000, 40);
  if (k === "rainbow") { document.documentElement.classList.add("lv-rainbow"); setTimeout(() => document.documentElement.classList.remove("lv-rainbow"), 6000); }
}
addEventListener("hashchange", hashFx);

// the owner's quote of the day takes the place of the built-in one that day
const widgets0 = widgets;
widgets = function () {
  widgets0();
  const q = Live.quote(), d = document.querySelector('.wg[data-w="quote"]');
  if (!q || !d) return;
  d.querySelector("p").textContent = "“" + q.text + "”"; d.querySelector("span").textContent = "- " + (q.by || "Webs");
};

// the wallpaper of the week, when there is no picture or moving background of the person's own
const ownBg = () => currentSlide() || (/^user\/ntp-bg\.[a-z0-9]+(\?v=\d+)?$/.test(cfg.bg || "") ? cfg.bg : "");
const wallFor = () => !PRIVATE && !cfg.liveBg && !ownBg() && Live.wallOn() ? String(Live.wallUrl() || "") : "";
const paintBackground0 = paintBackground;
paintBackground = function () {
  const w = wallFor();
  if (!/^https:\/\/\S+$/.test(w)) { paintBackground0(); const l = $("bgl"); if (l) delete l.dataset.wall; return; }
  let l = $("bgl");
  if (!l) {
    l = Object.assign(document.createElement("div"), { id:"bgl" });
    l.setAttribute("aria-hidden", "true");
    l.innerHTML = '<div class="fill"></div><div class="pic"></div><div class="dim"></div><div class="foot"></div>';
    document.body.prepend(l);
  }
  l.dataset.wall = "1"; l.dataset.fit = "cover";
  l.style.setProperty("--dim", String(Math.max(0, Math.min(80, cfg.bgDim == null ? 20 : +cfg.bgDim || 0)) / 100));
  document.body.classList.add("pic");
  if (l.dataset.src === w) return;
  l.dataset.src = w;
  const old = $("bgv"); if (old) old.remove();
  l.querySelector(".pic").style.backgroundImage = l.querySelector(".fill").style.backgroundImage = "url(" + JSON.stringify(w) + ")";
};

const applyCustom0 = applyCustom;
applyCustom = function () { applyCustom0(); try { paint(); } catch (e) {} };
Live.on(() => { paint(); widgets(); paintBackground(); if (!document.hidden && !off()) Live.callingCard(); });
paint(); widgets(); paintBackground(); hashFx();
setTimeout(special, 900);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { paint(); setTimeout(special, 600); } });
})();
