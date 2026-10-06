/* ---------------------------------------------------------------- Webs 3.14: more for anime fans in the browser window (ideas #051-#075)
   The Anime hub (../../js/anime.more.js: this season, countdowns, today's cards, games, voice actors, the filler guide,
   watch order, the cosplay board, your own theme, Mochi's outfits, secrets) in a panel, and the window's own parts:
     #055 the spoiler shield   words you don't want spoiled (your shows, characters) blurred on every page (x-spoil)
     #061 manga mode           just a manga site's pages, big: one at a time, two side by side (right to left too) or a strip (x-manga)
     #063 romaji on hover      the reading of Japanese under the pointer (x-romaji); words with kanji are asked of Web AI
     #069 anime radio          (in the hub)
     #071 theme of the day     a different anime theme each day
     #075 theme sounds         clicks and chimes in the style of your anime theme
   Settings: cfg.animeDaily, cfg.animeSfx, cfg.spoilOn, cfg.spoilWords [], cfg.animeRomaji, cfg.animeFonts (the new tab page). */
(function () {
"use strict";
if (!window.AnimeMore || !window.Anime) return;
const M = AnimeMore, PT = X3.ai && X3.ai.pageTool;
const webT = () => { const t = T(active); return t && isWeb(t.url) && !t.sleep && !t.lazy ? t : null; };
const today = () => new Date().toLocaleDateString("en-CA");
function grow(p, id) { if (typeof ResizeObserver === "function") new ResizeObserver(() => { if (overlay === id && p.isConnected) { capHeight(p); relayout(); } }).observe(p); }

/* ---------------------------------------------------------------- the hub */
const app = {
  open:u => { closeOver(); newTab(u, false); },
  server:() => AI.server(),
  useTheme:id => { const s = !!(cfg.anime && cfg.ambient && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb); X3.animeChoose(id, s); toast(id ? (Anime.get(id) || {}).name + " is on" : "Back to your own look"); },
  theme:() => cfg.anime || "",
  addFromPage:async () => {
    const t = webT(); if (!t || !PT) { toast("Open the page with the picture first"); return null; }
    closeOver(); toast("🖼️ Click the picture to save (Esc to cancel)");
    let r = null; try { r = await PT(t, "x-pickimg", "", 65000); } catch (e) {}
    if (r && !r.none) { M.cosAdd(r.u || r.data, t.url, t.title || ""); toast("📌 On your cosplay board"); hub("cosplay"); }
    else if (r && r.why === "none") toast("There are no pictures on this page");
    else if (r && r.why === "locked") toast("This page doesn't let its pictures be saved");
    return null;
  }
};
function hub(tab) {
  if (tab) try { localStorage.setItem("wsb.animeHubTab", JSON.stringify(tab)); } catch (e) {}
  const p = el("div", "xpane anh");
  p.innerHTML = '<div class="xhead"><div class="xic">🎌</div><div><b>Anime hub</b><span>This season, your countdowns, today\'s cards, games and more</span></div><button class="btn2 anh-set" title="Spoiler shield, theme of the day, theme sounds, romaji…">⚙ Extras</button></div><div class="anh-b"></div>';
  const n = openOver("animehub", p); n.style.right = "8px";
  p.querySelector(".anh-set").onclick = extras;
  grow(p, "animehub");
  M.hub(p.querySelector(".anh-b"), app);
}

/* ---------------------------------------------------------------- the extras' panel */
function extras() {
  const p = el("div", "xpane anh anx");
  p.innerHTML = '<div class="xhead"><div class="xic">⚙</div><div><b>Anime extras</b><span>Everything here stays on this computer</span></div></div>' +
    '<label class="anx-r"><input type="checkbox" data-k="animeDaily"><span><b>Theme of the day</b><em>A different anime theme every day (your schedule, if you have one, comes first)</em></span></label>' +
    '<label class="anx-r"><input type="checkbox" data-k="animeSfx"><span><b>Theme sounds</b><em>Clicks and chimes in your anime theme\'s style (a sword, a bell, a pen…)</em></span></label>' +
    '<label class="anx-r"><input type="checkbox" data-k="animeFonts"><span><b>Theme fonts</b><em>The new tab page\'s clock in a font that suits the theme</em></span></label>' +
    '<label class="anx-r"><input type="checkbox" data-k="animeRomaji"><span><b>Romaji on hover</b><em>Point at Japanese on a page to see how it\'s read (words with kanji use Web AI)</em></span></label>' +
    '<label class="anx-r"><input type="checkbox" data-k="spoilOn"><span><b>Spoiler shield</b><em>Blurs anything that mentions these, on every page; click one to see it</em></span></label>' +
    '<div class="anx-w"><div class="anx-chips"></div><div class="anx-add"><input placeholder="A show or character, then Enter"><button class="btn2 anx-fol">＋ The shows I follow</button></div></div>' +
    '<div class="xbtns xleft"><button class="btn2 anx-manga">📖 Manga mode on this page</button><button class="btn2 anx-back">‹ Back to the hub</button></div>';
  p.querySelectorAll("[data-k]").forEach(c => {
    const k = c.dataset.k; c.checked = k === "animeFonts" ? cfg.animeFonts !== false : !!cfg[k];
    c.onchange = () => { cfg[k] = c.checked; saveNow("settings"); if (typeof sendPrefs === "function") sendPrefs(); after(k); };
  });
  const chips = p.querySelector(".anx-chips"), inp = p.querySelector(".anx-add input");
  const paint = () => { const w = cfg.spoilWords || []; chips.innerHTML = w.length ? w.map((x, i) => '<span class="anx-c">' + esc(x) + '<button data-i="' + i + '" title="Remove">✕</button></span>').join("") : '<em class="anx-none">No words yet</em>';
    chips.querySelectorAll("button").forEach(b => { b.onclick = () => { const l = (cfg.spoilWords || []).slice(); l.splice(+b.dataset.i, 1); setWords(l); paint(); }; }); };
  inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) { setWords((cfg.spoilWords || []).concat(inp.value.trim())); inp.value = ""; paint(); } };
  p.querySelector(".anx-fol").onclick = () => { const l = M.follows().map(f => f.t); if (!l.length) { toast("Follow shows in the Anime hub first (☆)"); return; } setWords((cfg.spoilWords || []).concat(l)); paint(); };
  p.querySelector(".anx-manga").onclick = manga;
  p.querySelector(".anx-back").onclick = () => hub();
  paint();
  const n = openOver("animex", p); n.style.right = "8px";
  grow(p, "animex");
}
function setWords(l) {
  const seen = new Set();
  cfg.spoilWords = l.map(x => String(x).trim().slice(0, 60)).filter(x => x.length >= 3 && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 60);
  if (cfg.spoilWords.length && !cfg.spoilOn) { cfg.spoilOn = true; const c = $(".anx [data-k=spoilOn]"); if (c) c.checked = true; }
  saveNow("settings"); spoilAll();
}
function after(k) {
  if (k === "spoilOn") spoilAll();
  if (k === "animeRomaji") tabs.forEach(t => romaji(t, true));
  if (k === "animeDaily") daily(true);
  if (k === "animeSfx" && cfg.animeSfx) sound("done");
}

/* ---------------------------------------------------------------- #055 the spoiler shield and #063 romaji, on every page that loads */
function spoil(t) {
  if (!t || !isWeb(t.url) || t.sleep || t.lazy) return;
  const w = cfg.spoilOn ? cfg.spoilWords || [] : [];
  if (!w.length && !t.spoiled) return;
  send("page-tool", t.id, "x-spoil", JSON.stringify(w.length ? { w } : { off:1 }));
  t.spoiled = !!w.length;
}
const spoilAll = () => tabs.forEach(spoil);
function romaji(t, change) {
  if (!t || !isWeb(t.url) || t.sleep || t.lazy) return;
  if (cfg.animeRomaji) { send("page-tool", t.id, "x-romaji", "on"); t.romaji = true; }
  else if (change && t.romaji) { send("page-tool", t.id, "x-romaji", "off"); t.romaji = false; }
}
const applyPageA = applyPage;
applyPage = function (t) { applyPageA(t); if (t && isWeb(t.url)) { t.spoiled = false; t.romaji = false; spoil(t); romaji(t); } };
const reloadSettingsA = reloadSettings;
reloadSettings = function () { reloadSettingsA(); spoilAll(); tabs.forEach(t => romaji(t, true)); };
// words with kanji: Web AI reads them (once each)
const roCache = new Map();
const onToolResultA = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  if (r && r.a === "x-romaji-ask") { readKanji(id, String(r.q || "").slice(0, 30)); return; }
  onToolResultA(id, json);
};
async function readKanji(id, q) {
  if (!q) return;
  let ans = roCache.get(q);
  if (!ans) {
    if (!AI.ready()) ans = { q, ro:"(open Web AI once to read kanji)", en:"" };
    else try {
      const r = await AI.ask("answer", "How is the Japanese “" + q + "” read? Answer on one line only, exactly like this: <the reading in Hepburn romaji> | <a short English meaning>. No other words.");
      const [ro, en] = String(r.text || "").split("\n")[0].split("|").map(x => x.trim().replace(/^[*_`"“]+|[*_`"”]+$/g, ""));
      ans = { q, ro:(ro || "?").slice(0, 60), en:(en || "").slice(0, 80) }; roCache.set(q, ans);
    } catch (e) { ans = { q, ro:"(couldn't read it)", en:"" }; }
  }
  send("page-tool", id, "x-romaji", JSON.stringify({ ans }));
}

/* ---------------------------------------------------------------- #061 manga mode */
async function manga() {
  const t = webT(); if (!t || !PT) { toast("Open a manga page first"); return; }
  closeOver();
  let r = null; try { r = await PT(t, "x-manga", JSON.stringify({ mode:cfg.mangaMode || "page", rtl:!!cfg.mangaRtl }), 4000); } catch (e) {}
  if (!r) toast("Manga mode couldn't start on this page");
  else if (r.none) toast("No manga pages here. Open a chapter first (and scroll it once, so its pages load)");
  else if (r.n) toast("📖 " + r.n + " pages · arrow keys to turn · Esc to leave");
}

/* ---------------------------------------------------------------- #071 the theme of the day */
const DAILY = () => Anime.THEMES.filter(t => !t.mine && !t.ev).map(t => t.id);
function daily(now) {
  if (PRIVATE || !cfg.animeDaily || (cfg.animeSched && Anime.scheduled(cfg.animeSched))) return;
  if (!now && cfg.animeDailyDay === today()) return;
  const l = DAILY(), d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5) + d.getFullYear();
  const id = l[n % l.length];
  cfg.animeDailyDay = today();
  if (cfg.anime === id) { saveNow("settings"); return; }
  X3.animeChoose(id, !!(cfg.anime && cfg.ambient && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb));
  toast("🎌 Today's theme: " + Anime.get(id).name + " (" + Anime.get(id).show + ")");
}
setTimeout(() => daily(false), 3000);
setInterval(() => { if (!document.hidden) daily(false); }, 10 * 60000);
X3.animeDaily = daily;

/* ---------------------------------------------------------------- #075 theme sounds */
const pk = (fn) => (k, t, tone, click) => fn(k, t, tone, click);
Object.assign(SOUND_PACKS, {
  "an-bleach":pk((k, t, tone, click) => { click(t, .25); tone(t, "sawtooth", k === "close" ? 1800 : 2400, k === "close" ? 1200 : 3600, .16, .018); if (k === "done") tone(t + .12, "sine", 2637, 2637, .5, .03); }),
  "an-ghoul":pk((k, t, tone) => { tone(t, "sine", k === "open" ? 140 : 110, 70, .22, .12); if (k === "done") tone(t + .2, "sine", 120, 60, .3, .1); }),
  "an-slayer":pk((k, t, tone) => { const f = { open:[784, 1047], close:[1047, 784], done:[659, 784, 988, 1319] }[k] || [880]; f.forEach((x, i) => tone(t + i * .08, "sine", x, x, .5, .04)); }),
  "an-jjk":pk((k, t, tone) => { tone(t, "triangle", k === "close" ? 440 : 220, k === "close" ? 220 : 440, .2, .05); tone(t, "triangle", k === "close" ? 466 : 233, k === "close" ? 233 : 466, .2, .04); if (k === "done") tone(t + .18, "sine", 110, 55, .6, .08); }),
  "an-naruto":pk((k, t, tone, click) => { tone(t, "sine", 3000, 900, .08, .02); click(t + .05, .3); if (k === "done") [523, 587, 784].forEach((f, i) => tone(t + .12 + i * .07, "square", f, f, .08, .02)); }),
  "an-aot":pk((k, t, tone) => { tone(t, "sawtooth", 196, k === "close" ? 147 : 196, k === "done" ? .7 : .25, .025); if (k === "done") tone(t + .25, "sawtooth", 294, 294, .6, .02); }),
  "an-onepiece":pk((k, t, tone) => { tone(t, "sine", 880, 880, .7, .05); tone(t, "sine", 1320, 1320, .5, .025); if (k === "done") tone(t + .2, "sine", 880, 880, .8, .05); }),
  "an-deathnote":pk((k, t, tone, click) => { [0, .04, .09].forEach(d => click(t + d, .18)); if (k === "done") tone(t + .14, "sine", 220, 207, .8, .05); }),
  "an-p5":pk((k, t, tone) => { const c = k === "close" ? [784, 659, 523] : k === "done" ? [523, 659, 784, 988] : [523, 659, 784]; c.forEach((f, i) => tone(t + i * .03, "triangle", f, f, .2, .035)); })
});
const sound0 = sound;
sound = function (kind) {
  const th = "an-" + (cfg.anime || "");
  if (!cfg.animeSfx || PRIVATE || !SOUND_PACKS[th]) return sound0(kind);
  const p = cfg.soundPack, s = cfg.sounds;
  cfg.soundPack = th; cfg.sounds = true;
  try { sound0(kind); } finally { cfg.soundPack = p; cfg.sounds = s; }
};

/* ---------------------------------------------------------------- secrets (#072) in the window: a hero's motto in the address bar */
const goA = go;
go = function (text) { if (/^\s*plus\s*ultra\s*!*\s*$/i.test(String(text || "")) && M.secret("plusultra")) toast("💥 Secret found: Go beyond!"); return goA(text); };
document.addEventListener("wsb-secret", e => { const d = e.detail || {}; toast(d.e + " Secret found: " + d.name + " (" + d.n + " of " + d.of + ")"); });

/* ---------------------------------------------------------------- the menu, commands and voice */
const menuRowsA = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRowsA) menuRowsA(m);
  m.appendChild(row("sparkle", "Anime hub…", "", () => { closeOver(); hub(); }));
};
const commandsA = commands;
commands = function () { return commandsA().concat([
  { t:"Anime hub: this season, countdowns, trivia, guess the anime", k:"", i:"sparkle", fn:() => hub() },
  { t:"Anime: this season's chart", k:"", i:"sparkle", fn:() => hub("season") }, { t:"Anime: guess the anime", k:"", i:"sparkle", fn:() => hub("guess") },
  { t:"Anime: trivia", k:"", i:"sparkle", fn:() => hub("trivia") }, { t:"Anime: who voices this character", k:"", i:"sparkle", fn:() => hub("va") },
  { t:"Anime: filler guide (episodes to skip)", k:"", i:"sparkle", fn:() => hub("filler") }, { t:"Anime: watch order", k:"", i:"sparkle", fn:() => hub("order") },
  { t:"Anime: cosplay board", k:"", i:"sparkle", fn:() => hub("cosplay") }, { t:"Anime: make a theme from a picture", k:"", i:"sparkle", fn:() => hub("maker") },
  { t:"Anime: Mochi's outfits", k:"", i:"sparkle", fn:() => hub("mochi") }, { t:"Anime: radio", k:"", i:"sparkle", fn:() => hub("radio") },
  { t:"Manga mode: just the pages, big", k:"", i:"sparkle", fn:manga }, { t:"Spoiler shield, romaji on hover, theme of the day…", k:"", i:"sparkle", fn:extras }]); };
const V = X3.voice;
if (V && V.COMMANDS) {
  const S = "\u0001";
  V.COMMANDS.unshift(
    { id:"animehub", g:"Anime", ex:"open the anime hub", res:[/^(?:open |show )?(?:the )?anime hub$/, /^what anime (?:is|are) (?:out|airing|on) (?:this season|now)$/], fn:m => { hub(/airing|season/.test(m.input || "") ? "season" : ""); return "Here's the anime hub."; } },
    { id:"manga", g:"Anime", ex:"manga mode", res:[/^(?:turn on |start |open )?manga mode$/, /^read (?:this|the) manga$/], fn:() => { manga(); return S; } },
    { id:"dattebayo", g:"Anime", ex:"", res:[/^(?:believe it )?dattebayo$/, /^believe it$/], fn:() => M.secret("dattebayo") ? "Believe it! You found a secret." : "Believe it!" });
}
// the new tab page asks: open the hub, put on a theme
if (typeof BroadcastChannel === "function") new BroadcastChannel("wsb-anime").onmessage = e => { const d = e.data || {}; if (d.hub != null) hub(String(d.hub)); else if (typeof d.theme === "string" && (!d.theme || Anime.has(d.theme))) app.useTheme(d.theme); };
// your own theme, made (or deleted) in the hub: the picker and the window know it at once
addEventListener("storage", e => { if (e.key === "wsb.animeMine") Anime.mine(); });
X3.animeHub = hub; X3.animeExtras = extras; X3.manga = manga;

const st = document.createElement("style");
st.textContent = `
.anh{width:min(760px,calc(100vw - 32px))}.anh .anh-b{max-height:72vh;overflow:auto;padding:2px 2px 8px}.anh .xhead{align-items:center}.anh .anh-set{margin-left:auto}
.anx{width:min(520px,calc(100vw - 32px))}.anx-r{display:flex;gap:10px;align-items:flex-start;padding:8px 4px;cursor:pointer}.anx-r input{margin-top:3px}.anx-r span{display:flex;flex-direction:column}.anx-r em{font-style:normal;font-size:12px;color:var(--dim)}
.anx-w{margin:0 4px 8px 30px;padding:8px;border-radius:10px;background:var(--bg3)}.anx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.anx-c{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;padding:3px 4px 3px 10px;border-radius:999px;background:var(--bg2)}
.anx-c button{border:0;background:none;color:var(--dim);cursor:pointer}.anx-none{font-size:12.5px;color:var(--dim)}.anx-add{display:flex;gap:6px}.anx-add input{flex:1;font:inherit;font-size:13px;color:var(--fg);background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:6px 8px}`;
document.head.appendChild(st);
})();
