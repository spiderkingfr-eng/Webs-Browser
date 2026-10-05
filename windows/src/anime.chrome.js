/* ---------------------------------------------------------------- Webs 3.8: anime themes in the browser window (../../js/anime.js)
   The colors come through the "custom" color theme every page reads; here the window gets each
   theme's touch on top: a moving band across the top of the tab strip and the active tab's mark. Menu →
   Anime themes… picks one from anywhere (the new tab page's Background panel and Settings can too).
   3.9: Menu → Anime wallpaper on this site… puts a live wallpaper behind websites, too (below). */
(function () {
"use strict";
if (!window.Anime) return;
const root = document.documentElement;
const band = el("div", "anband"); band.setAttribute("aria-hidden", "true");
document.body.appendChild(band);
const applyPack0 = applyPack;
applyPack = function () {
  applyPack0();
  const id = !PRIVATE && cfg.theme !== "light" && Anime.has(cfg.anime) ? cfg.anime : "";
  if (id) root.dataset.anime = id; else delete root.dataset.anime;
};
applyPack();

function choose(id, sound) {
  Anime.apply(cfg, id, { pc:true, sound:id ? sound : null });
  saveNow("settings"); applyLook();
  if (typeof muCmd === "function") muCmd("ambient", cfg.ambient || "");
  if (typeof sendPrefs === "function") sendPrefs();
  sitesAll();     // websites that match the browser's theme follow it
}
function animePanel() {
  const p = el("div", "xpane anp");
  p.innerHTML = '<div class="xhead"><div class="xic">🎌</div><div><b>Anime themes</b><span>Colors for the whole browser, a live wallpaper and a card on the new tab page</span></div></div><div class="anp-pick"></div>' +
    '<label class="anp-snd"><input type="checkbox"> Play its sound (rain, wind, waves…)</label>';
  const t = T(active);
  if (t && isWeb(t.url)) {
    const go = el("div", "xbtns xleft"), b = el("button", "btn2");
    b.textContent = "Put a wallpaper behind " + hostOf(t.url) + "…"; b.onclick = sitePanel;
    go.appendChild(b); p.appendChild(go);
  }
  const snd = p.querySelector("input");
  snd.checked = !!(cfg.anime && cfg.ambient && Anime.get(cfg.anime) && cfg.ambient === Anime.get(cfg.anime).amb);
  const pk = Anime.picker(p.querySelector(".anp-pick"), { current:cfg.anime || "", onPick:id => { choose(id, snd.checked); toast(id ? Anime.get(id).name + " is on: open a new tab to see its wallpaper" : "Back to your own look"); } });
  snd.onchange = () => { if (cfg.anime) choose(cfg.anime, snd.checked); };
  const n = openOver("anp", p); n.style.right = "8px";
  new MutationObserver((m, o) => { if (!p.isConnected) { pk.stop(); o.disconnect(); } }).observe($("#over"), { childList:true });
}
X3.animePanel = animePanel;
const menuRows8 = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows8) menuRows8(m);
  if (!PRIVATE) m.appendChild(row("sparkle", "Anime themes…", cfg.anime && Anime.get(cfg.anime) ? Anime.get(cfg.anime).name : "", animePanel));
  const t = T(active);
  if (!PRIVATE && t && isWeb(t.url)) { const c = siteLook(hostOf(t.url)); m.appendChild(row("sparkle", "Anime wallpaper on this site…", c.on ? Anime.get(c.id).name : "", sitePanel)); }
};
const commands8 = commands;
commands = function () { return commands8().concat(PRIVATE ? [] : [{ t:"Anime themes: Bleach, Tokyo Ghoul, Demon Slayer and more", k:"", i:"sparkle", fn:animePanel },
  { t:"Anime wallpaper on this site: a live wallpaper behind the page", k:"", i:"sparkle", fn:sitePanel }]); };

/* ---------------------------------------------------------------- Webs 3.9: anime wallpapers behind websites
   A theme's live wallpaper behind the sites you choose, each with its own look: which theme, behind
   the page or faintly over it, how much shows through, see-through sidebars and bars, soft focus or
   a still picture. The page side is src/anime.page.js, sent to the page with ../../js/anime.js and
   run there (the host's "userjs" page tool) each time a page on that site loads. Settings →
   Appearance can turn it on for every site. Never in a private window.
     cfg.animeWeb    "" off, "pick" the sites you choose, "all" every site
     cfg.animeSites  { "claude.ai": { on, id ("" = the browser's theme), mode, k (0 = auto), panels, soft, still } } */
const PAGE_JS = @@ANIME_PAGE@@;
const SITE_ID = "jjk";      // the wallpaper when neither the site nor the browser has a theme
function siteLook(h) {
  const own = (cfg.animeSites || {})[h] || {}, web = cfg.animeWeb || "";
  const id = Anime.has(own.id) ? own.id : Anime.has(cfg.anime) ? cfg.anime : SITE_ID;
  return { on:!PRIVATE && !!h && !!web && (own.on === true || (web === "all" && own.on !== false)), id, mode:own.mode === "over" ? "over" : "behind",
    k:Math.max(0, Math.min(.9, +own.k || 0)), panels:own.panels !== false, soft:!!own.soft, still:!!own.still, motion:Anime.motion() };
}
// what goes to the page: the settings, and the first time on each page the wallpapers and the page side too
function siteCode(c, full) {
  const head = "var K=Symbol.for('wsb.animeSite'),C=" + JSON.stringify(c) + ";if(window[K]){window[K](C);return;}";
  if (!full) return head;
  const src = document.getElementById("wsb-anime-js");
  return head + "var A=(function(window){" + (src ? src.textContent : "") + "\nreturn window.Anime;})({animeNoCss:1});\n" + PAGE_JS + "(A,C);";
}
function siteSend(t) {
  if (!t || !isWeb(t.url) || t.sleep || t.lazy) return;
  const c0 = siteLook(hostOf(t.url)), c = c0.on ? c0 : { on:false }, s = JSON.stringify(c);
  if (!c.on && !t.anWall) return;          // never on this page: nothing to take off
  if (s === t.anCfg) return;
  send("page-tool", t.id, "userjs", siteCode(c, c.on && !t.anWall));
  t.anCfg = s; if (c.on) t.anWall = true;
}
function sitesAll(h) { tabs.forEach(t => { if (!h || hostOf(t.url) === h) siteSend(t); }); }
X3.siteLook = siteLook; X3.siteCode = siteCode;
const applyPage9 = applyPage;
applyPage = function (t) {
  applyPage9(t);
  if (t && isWeb(t.url)) { t.anWall = false; t.anCfg = ""; siteSend(t); }     // a page that just loaded starts with nothing
};
// Settings or another window changed something (a site's look, the theme, Animations)
const reloadSettings9 = reloadSettings;
reloadSettings = function () { reloadSettings9(); sitesAll(); };

function sitePanel() {
  const t = T(active);
  if (PRIVATE) { toast("Anime wallpapers stay off in private windows"); return; }
  if (!t || !isWeb(t.url)) { toast("Open a website first: its wallpaper is chosen here"); return; }
  const h = hostOf(t.url), p = el("div", "xpane anp ansp");
  p.innerHTML = '<div class="xhead"><div class="xic">🎌</div><div><b></b><span>A live wallpaper behind the site, out of the way of everything on it</span></div></div>' +
    '<div class="mi tg ans-on">' + ico("sparkle") + '<span></span><div class="k"></div></div>' +
    '<div class="ans-k">Wallpaper</div><div class="ans-pick"></div>' +
    '<div class="ans-k">Where</div><div class="ans-seg"><button data-m="behind">Behind the page</button><button data-m="over">Over the page, faintly</button></div>' +
    '<div class="ans-k">How much shows through <em></em></div><div class="ans-rg"><input type="range" min="10" max="90" step="5"><button class="btn2">Auto</button></div>' +
    '<label class="anp-snd"><input type="checkbox" data-o="panels"> See-through sidebars and bars</label>' +
    '<label class="anp-snd"><input type="checkbox" data-o="soft"> Soft focus: the wallpaper a little blurred</label>' +
    '<label class="anp-snd"><input type="checkbox" data-o="still"> A still picture (uses less battery)</label>' +
    '<div class="mi tg ans-all">' + ico("world") + '<span>On every website</span><div class="k"></div></div>' +
    '<div class="xsmall">Only how ' + esc(h) + ' looks on your screen changes: nothing on it is read or sent anywhere. Messages, buttons, boxes you type in, pictures and videos keep their own look.</div>' +
    '<div class="xbtns"><button class="btn2 ans-reset">Reset this site</button><button class="btn2 main ans-done">Done</button></div>';
  p.querySelector(".xhead b").textContent = "Anime wallpaper on " + h;
  p.querySelector(".ans-on span").textContent = "Show it on " + h;
  const own = () => (cfg.animeSites || {})[h] || {};
  // any change turns it on for this site, except switching it off; saved when a slider is let go
  const upd = (ch, later) => {
    const all = Object.assign({}, cfg.animeSites);
    all[h] = Object.assign({}, all[h], "on" in ch ? {} : { on:true }, ch);
    cfg.animeSites = all;
    if (all[h].on && !cfg.animeWeb) cfg.animeWeb = "pick";
    if (!later) saveNow("settings");
    sitesAll(h); paint();
  };
  const rg = p.querySelector("input[type=range]");
  rg.oninput = () => upd({ k:+rg.value / 100 }, true);
  rg.onchange = () => saveNow("settings");
  p.querySelector(".ans-rg button").onclick = () => upd({ k:0 });
  p.querySelectorAll(".ans-seg button").forEach(b => { b.onclick = () => upd({ mode:b.dataset.m }); });
  p.querySelectorAll("input[data-o]").forEach(i => { i.onchange = () => upd({ [i.dataset.o]:i.checked }); });
  p.querySelector(".ans-on").onclick = () => upd({ on:!siteLook(h).on });
  p.querySelector(".ans-all").onclick = () => { cfg.animeWeb = cfg.animeWeb === "all" ? "pick" : "all"; saveNow("settings"); sitesAll(); paint(); };
  p.querySelector(".ans-reset").onclick = () => { const all = Object.assign({}, cfg.animeSites); delete all[h]; cfg.animeSites = all; saveNow("settings"); sitesAll(h); pk.stop(); pick(); paint(); toast(h + " is back to how it was"); };
  p.querySelector(".ans-done").onclick = () => closeOver();
  let pk = null;
  const pick = () => {
    const b = Anime.get(cfg.anime);
    pk = Anime.picker(p.querySelector(".ans-pick"), { current:own().id || "", onPick:id => upd({ id }),
      none:{ name:"Match the browser", show:b ? b.name + ", your anime theme" : Anime.get(SITE_ID).name + " until you pick an anime theme", e:"🎌" } });
  };
  function paint() {
    const c = siteLook(h), o = own();
    const on = p.querySelector(".ans-on"); on.classList.toggle("on", c.on); on.querySelector(".k").textContent = c.on ? "On" : "Off";
    const all = p.querySelector(".ans-all"); all.classList.toggle("on", cfg.animeWeb === "all"); all.querySelector(".k").textContent = cfg.animeWeb === "all" ? "On" : "Off";
    p.querySelectorAll(".ans-seg button").forEach(b => b.classList.toggle("on", b.dataset.m === c.mode));
    if (document.activeElement !== rg) rg.value = Math.round((c.k || (o.k ? o.k : .4)) * 100);
    p.querySelector(".ans-k em").textContent = c.k ? Math.round(c.k * 100) + "%" : "Auto (about a third on a light site, half on a dark one)";
    p.querySelectorAll("input[data-o]").forEach(i => { i.checked = !!c[i.dataset.o]; });
    p.classList.toggle("ans-off", !c.on);
  }
  pick(); paint();
  const n = openOver("ansp", p); n.style.right = "8px";
  new MutationObserver((m, o) => { if (!p.isConnected) { pk.stop(); o.disconnect(); } }).observe($("#over"), { childList:true });
}
X3.sitePanel = sitePanel;

const st = document.createElement("style");
st.textContent = `
.anband{position:fixed;left:0;right:0;top:0;height:3px;z-index:30;pointer-events:none;display:none}
html[data-anime] .anband{display:block}
html[data-anime="bleach"] .anband{background:linear-gradient(90deg,#000 0 30%,#ff6a1a 50%,#fff 52%,#000 70%);background-size:200% 100%;animation:anBand 6s linear infinite}
html[data-anime="ghoul"] .anband{background:linear-gradient(90deg,#3a000a,#e0193a,#3a000a);background-size:50% 100%;box-shadow:0 0 10px #e0193a;animation:anBeat 2.4s ease-in-out infinite,anDrift 5s linear infinite}
html[data-anime="slayer"] .anband{height:6px;background:conic-gradient(#1f8a5c 25%,#0a0a0a 0 50%,#1f8a5c 0 75%,#0a0a0a 0) 0 0/6px 6px;animation:anChk 1.6s linear infinite}
html[data-anime="jjk"] .anband{background:linear-gradient(90deg,#4d6bff,#a64dff,#ff3355,#a64dff,#4d6bff);background-size:200% 100%;box-shadow:0 0 12px #7f5cff;animation:anBand 5s linear infinite}
html[data-anime="naruto"] .anband{background:linear-gradient(90deg,#ff8a1c 0 24px,#1d2a5c 24px 30px) 0 0/30px 100%;animation:anRoll 1.5s linear infinite}
html[data-anime="aot"] .anband{background:linear-gradient(90deg,#3c3a2c,#c9a26b,#5b6b3f,#c9a26b,#3c3a2c);background-size:200% 100%;animation:anBand 9s linear infinite}
html[data-anime="onepiece"] .anband{background:linear-gradient(135deg,#ffc531 25%,#e3342b 0 50%,#ffc531 0 75%,#e3342b 0) 0 0/16px 16px;animation:anStripe 1s linear infinite}
html[data-anime="deathnote"] .anband{height:2px;background:linear-gradient(90deg,transparent,#fff 20%,#d4102e 50%,#fff 80%,transparent);background-size:200% 100%;animation:anBand 5s linear infinite}
html[data-anime="p5"] .anband{height:5px;background:linear-gradient(-45deg,#e60012 25%,#000 0 50%,#e60012 0 75%,#000 0) 0 0/14px 14px;animation:anStripe2 .8s linear infinite}
@keyframes anBand{to{background-position:-200% 0}}@keyframes anBeat{50%{opacity:.45}}@keyframes anDrift{to{background-position:100% 0}}
@keyframes anChk{to{background-position:12px 0}}@keyframes anRoll{to{background-position:30px 0}}@keyframes anStripe{to{background-position:32px 0}}@keyframes anStripe2{to{background-position:28px 0}}
html[data-anime="p5"] .tab.on,html[data-anime="bleach"] .tab.on{box-shadow:inset 0 -2px 0 var(--accent)}
.anp{width:560px}.anp .an-grid{grid-template-columns:repeat(4,1fr);gap:8px}.anp .an-tile b{font-size:12px}.anp .an-tile span{font-size:10.5px}
.anp-snd{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:var(--dim)}
.ansp .ans-k{margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--fg)}.ansp .ans-k em{font-style:normal;font-weight:400;color:var(--dim);margin-left:4px}
.ansp .an-tile canvas{aspect-ratio:16/9}.ansp .an-note{display:none}.ansp .an-none{aspect-ratio:16/9;font-size:24px}
.ansp .mi.tg{cursor:pointer}.ansp .ans-all{margin-top:8px}
.ans-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:var(--bg3)}.ans-seg button{flex:1;height:28px;border:0;border-radius:8px;background:none;color:var(--dim);font:inherit;font-size:12.5px;cursor:pointer}
.ans-seg button.on{background:var(--accent);color:#fff}
.ans-rg{display:flex;align-items:center;gap:10px}.ans-rg input{flex:1;accent-color:var(--accent)}.ans-rg .btn2{height:28px;padding:0 12px}
.ansp.ans-off .ans-k,.ansp.ans-off .ans-seg,.ansp.ans-off .ans-rg,.ansp.ans-off .anp-snd{opacity:.55}
/* every band moves, round and round; only Animations: Off stops it */
html[data-motion="off"] .anband{animation:none!important}
`;
document.head.appendChild(st);
})();
