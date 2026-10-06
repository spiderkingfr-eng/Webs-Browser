/* Webs 3.14: more for anime fans on the new tab page (../../js/anime.more.js; ideas #051-#075)
   Today's cards under the anime card (#052 birthdays, #053 a quote, #054 the opening of the week, #062 a Japanese word,
   #070 your countdowns), the clock in a font that suits the theme (#073), stickers anywhere on the page (#059), and
   an old game code (#072). The window does what this page can't (open the hub, change the theme): wsb-anime channel. */
(function () {
"use strict";
if (!window.AnimeMore || !window.Anime) return;
const M = AnimeMore, on = () => !PRIVATE && Anime.has(cfg.anime);
const ch = typeof BroadcastChannel === "function" ? new BroadcastChannel("wsb-anime") : null;
const tell = m => { if (ch) ch.postMessage(m); };
SHOW.push(["animeDaily", "Anime: today's cards"]);

/* ---------------------------------------------------------------- today's cards */
const sec = document.createElement("section"); sec.id = "amSec"; sec.className = "hide";
const anSec = $("anSec"); if (anSec) anSec.after(sec); else $("f").after(sec);
let painted = "";
function cards() {
  const show = on() && !hidden("animeDaily");
  sec.classList.toggle("hide", !show);
  if (!show) { painted = ""; return; }
  const key = new Date().toDateString();
  if (painted === key) return;
  painted = key;
  M.daily(sec, { open:u => send("go", u), useTheme:id => tell({ theme:id }) });
}

/* ---------------------------------------------------------------- #073 the theme's font */
const FONTS = { bleach:"Cinzel:wght@700", ghoul:"Special+Elite", slayer:"Yuji+Syuku", jjk:"Rubik+Glitch", naruto:"Bangers", aot:"Oswald:wght@600", onepiece:"Pirata+One", deathnote:"Caveat:wght@700", p5:"Bebas+Neue",
  halloween:"Creepster", winter:"Mountains+of+Christmas:wght@700", newyear:"Monoton", hearts:"Pacifico" };
const fontCss = document.createElement("style"); document.head.appendChild(fontCss);
const loaded = {};
function font() {
  const id = on() && cfg.animeFonts !== false ? cfg.anime : "", f = FONTS[id];
  if (!f) { fontCss.textContent = ""; return; }
  if (!loaded[f]) { loaded[f] = 1; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + f + "&display=swap"; document.head.appendChild(l); }
  const fam = '"' + f.split(":")[0].replace(/\+/g, " ") + '"';
  fontCss.textContent = "#anBox .an-time,#anBox .an-date,#anBox .an-md,#anBox .an-day{font-family:" + fam + ",inherit!important;letter-spacing:.01em}" + (id === "p5" || id === "naruto" ? "#anBox .an-time{font-weight:400!important}" : "");
}

/* ---------------------------------------------------------------- #059 stickers, from the Background panel */
const stk = M.stickers(document.body, { key:"stickers" });
const bgbox = $("bgbox");
if (bgbox) {
  const b = document.createElement("div"); b.className = "amstk";
  b.innerHTML = '<div class="k">Stickers <span class="vnote">put them anywhere on this page</span></div><button type="button" class="btn2">✨ Add or move stickers</button>';
  b.querySelector("button").onclick = () => { if (typeof closeAll === "function") closeAll(); else bgbox.classList.add("hide"); stk.edit(true); };
  const ab = bgbox.querySelector(".anbox"); if (ab) ab.after(b); else bgbox.appendChild(b);
  // Background → Anime themes: a tile to make your own (the window's Anime hub does it)
  const pickBox = $("anPick");
  if (pickBox) new MutationObserver(() => {
    if (pickBox.querySelector('[data-id="+make"]')) return;
    const t = document.createElement("button"); t.type = "button"; t.className = "an-tile none"; t.dataset.id = "+make";
    t.innerHTML = '<div class="an-none">🖼️</div><b></b><span></span>'; t.querySelector("b").textContent = Anime.get("mine") ? "Make another from a picture" : "Make one from your picture"; t.querySelector("span").textContent = "In the Anime hub";
    t.onclick = () => tell({ hub:"maker" });
    const grid = pickBox.querySelector(".an-grid"); if (grid) grid.insertBefore(t, grid.lastElementChild);
  }).observe(pickBox, { childList:true });
}

/* ---------------------------------------------------------------- #072 secrets: an old game code, the hidden spider */
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let kk = 0;
addEventListener("keydown", e => {
  // (the search box has the focus when the page opens: the code works there too while it's empty)
  const t = e.target || {}, box = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "") || t.isContentEditable;
  if (box && (t.tagName !== "INPUT" || t.value)) { kk = 0; return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  kk = k === KONAMI[kk] ? kk + 1 : k === KONAMI[0] ? 1 : 0;
  if (kk > 8 && box) e.preventDefault();         // the b and the a don't go into the box
  if (kk === KONAMI.length) { kk = 0; M.secret("konami"); party(); }
}, true);
addEventListener("click", () => setTimeout(M.spiderCheck, 60), true);
function party() {
  const b = document.createElement("div"); b.className = "amparty"; b.setAttribute("aria-hidden", "true");
  b.innerHTML = Array.from({ length:40 }, (_, i) => '<i style="left:' + (Math.random() * 100).toFixed(1) + "%;animation-delay:" + (Math.random() * .8).toFixed(2) + "s;font-size:" + (18 + Math.random() * 22).toFixed(0) + 'px">' + M.STICKERS[i % M.STICKERS.length] + "</i>").join("");
  document.body.appendChild(b); setTimeout(() => b.remove(), 4200);
}
const note = document.createElement("div"); note.className = "amnote"; note.setAttribute("role", "status"); document.body.appendChild(note);
document.addEventListener("wsb-secret", e => { const d = e.detail || {}; note.textContent = d.e + " Secret found: " + d.name + " (" + d.n + " of " + d.of + ")"; note.classList.add("on"); setTimeout(() => note.classList.remove("on"), 4000); });

const applyCustomM = applyCustom;
applyCustom = function () { applyCustomM(); try { painted = ""; cards(); font(); } catch (e) { console.error(e); } };
addEventListener("storage", e => { if (e.key === "wsb.settings") setTimeout(() => { painted = ""; cards(); font(); }, 0); else if (e.key === "wsb.stickers") stk.paint(); else if (e.key === "wsb.animeMine") { Anime.mine(); painted = ""; } });
setInterval(() => { if (!document.hidden) cards(); }, 60000);

const st = document.createElement("style");
st.textContent = "#amSec{margin-top:12px}.amstk{margin:12px 0}.amstk .btn2{margin-top:6px}" +
  ".amparty{position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden}.amparty i{position:absolute;top:-60px;font-style:normal;animation:amFall 3.2s cubic-bezier(.3,.6,.6,1) forwards}" +
  "@keyframes amFall{to{transform:translateY(calc(100vh + 120px)) rotate(540deg)}}" +
  ".amnote{position:fixed;left:50%;top:20px;transform:translate(-50%,-80px);z-index:71;padding:10px 16px;border-radius:12px;background:var(--bg2);color:var(--fg);box-shadow:0 10px 30px rgba(0,0,0,.35);font-weight:600;transition:transform .35s}.amnote.on{transform:translate(-50%,0)}" +
  ":root[data-motion=\"off\"] .amparty{display:none}";
document.head.appendChild(st);
cards(); font();
X3N.animeMore = { cards, font, stk };
})();
