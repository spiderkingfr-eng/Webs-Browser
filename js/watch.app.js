/* Webs Browser for iPhone 2.11 - watching (js/watch.js; ideas #076-#100): Menu → Watching (watch later, moments saved
   on the PC, streamers you follow, this week's watching, and a daily Shorts limit), "Watch later" for the page you're
   on, and the streamers who are live, on the start page. The phone can't look inside a site's video player, so the
   week counts the time you spend on video sites in Webs, and the Shorts limit goes by the page's address (after it,
   a Short goes back to the start page). */
"use strict";

(function () {
if (!window.Watch) return;
const W = Watch, today = () => new Date().toLocaleDateString("en-CA");
const VIDEO = /(^|\.)(youtube\.com|youtu\.be|twitch\.tv|netflix\.com|crunchyroll\.com|vimeo\.com|disneyplus\.com|primevideo\.com|tiktok\.com|dailymotion\.com|hulu\.com|max\.com)$/;
const isShorts = u => /^https:\/\/(www\.|m\.)?youtube\.com\/shorts\//.test(u || "");
const host = u => { try { return new URL(u).hostname.replace(/^(www|m)\./, ""); } catch (e) { return ""; } };

function limits(body) {
  const lim = +cfg.wShorts || 0, used = ((load("shortsUsed", {}) || {})[today()] || 0);
  body.innerHTML = '<div class="wt-k" style="margin-top:0">YouTube Shorts</div><p class="wt-note">Shorts for so many minutes a day; after that, Webs takes you back to the start page.</p>' +
    '<div class="wtseg">' + [[0, "No limit"], [5, "5 min"], [15, "15 min"], [30, "30 min"]].map(x => '<button type="button" data-v="' + x[0] + '"' + (lim === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>").join("") + "</div>" +
    (lim ? '<p class="wt-note">' + Math.round(used / 60) + " of " + lim + " minutes used today.</p>" : "");
  body.querySelectorAll(".wtseg button").forEach(b => { b.onclick = () => { cfg.wShorts = +b.dataset.v; save("settings", cfg); limits(body); }; });
}
function sheet(tab) {
  openSheet("Watching", '<div class="wtsheet"></div>', { full:true });
  W.panel($("#sheetBody .wtsheet"), { open:u => { closeSheet(); go(u); }, openAt:(u, at) => { closeSheet(); go(W.timeUrl(u, at).u); }, statsNote:"time on video sites in Webs",
    current:() => { const t = curTab(); return t && t.u ? { u:t.u, t:t.t } : null; }, tabs:[{ id:"limits", name:"Limits", render:limits }] }, tab);
}
ACTIONS.watching = () => sheet();
ACTIONS.watchlater = () => { const t = curTab(); if (!t || !t.u) { sheet("later"); return; } W.addLater(t.u, t.t); closeSheet(); toast("📺 Added to Watch later"); };
const openMenuW = openMenu;
openMenu = function () {
  openMenuW();
  if (PRIVATE || $('#sheetBody .mrow[data-act="watching"]')) return;
  const t = curTab(), after = $('#sheetBody .mrow[data-act="animehub"]') || $('#sheetBody .mrow[data-act="aimore"]') || $('#sheetBody .mrow[data-act="webai"]');
  const html = '<button type="button" class="mrow" data-act="watching">' + ico("eye") + "<span>Watching</span><em>Later, streamers, your week</em></button>" +
    (t && t.u ? '<button type="button" class="mrow" data-act="watchlater">' + ico("clock") + "<span>Watch later</span><em>Add this page</em></button>" : "");
  if (after) after.insertAdjacentHTML("afterend", html); else $("#sheetBody").insertAdjacentHTML("beforeend", html);
};

// this week (time on video sites) and the Shorts limit, every 10 seconds while the app is open
function tick() {
  if (PRIVATE || document.hidden) return;
  const t = curTab(); if (!t || !t.u) return;
  const h = host(t.u);
  if (VIDEO.test(h)) W.addStat(h, 10);
  const lim = +cfg.wShorts || 0;
  if (lim && isShorts(t.u)) {
    const u = load("shortsUsed", {}) || {}, d = today(); u[d] = (u[d] || 0) + 10;
    Object.keys(u).filter(k => k !== d).forEach(k => delete u[k]); save("shortsUsed", u);
    if (u[d] >= lim * 60) { toHome(t); toast("📵 That's your " + lim + " minutes of Shorts for today"); }
  }
}
setInterval(tick, 10000);

// streamers who are live, on the start page
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="wlSec" class="wsec hide"></section>');
HIDE_KEYS.push(["live", "Streamers live now"]);
ORDERABLE.push(["wlSec", "Streamers live now"]);
let liveN = 0;
async function paintLive() {
  const sec = $("#wlSec"); if (!sec) return;
  if (PRIVATE || hidden("live") || !liveN) { wshow("wlSec", false); return; }
  try {
    const j = await W.streams();
    sec.innerHTML = '<div class="wlh"><i></i>Live now</div>' + j.live.slice(0, 4).map(x => '<button type="button" class="wlr" data-u="' + esc(x.u) + '"><b>' + esc(x.name) + "</b><span>" + esc(x.game || x.title) + "</span></button>").join("");
    sec.querySelectorAll(".wlr").forEach(b => { b.onclick = () => go("https://www.twitch.tv/" + b.dataset.u); });
    wshow("wlSec", j.live.length > 0);
  } catch (e) { wshow("wlSec", false); }
}
W.liveDot(n => { liveN = n; paintLive(); });
HOME_HOOKS.push(paintLive);

const st = document.createElement("style");
st.textContent = "#sheetBody .wt-tabs{position:sticky;top:-2px;z-index:2;background:var(--bg2);padding:4px 0 6px}.wtseg{display:flex;gap:6px;flex-wrap:wrap}.wtseg button{font:inherit;font-size:14px;border:1px solid var(--line);background:none;color:var(--fg);border-radius:10px;padding:7px 12px}.wtseg button.on{background:var(--accent);border-color:var(--accent);color:#fff}" +
  "#wlSec{padding:12px 14px}.wlh{display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:6px}.wlh i{width:9px;height:9px;border-radius:50%;background:#e91916}.wlr{display:flex;flex-direction:column;align-items:flex-start;width:100%;font:inherit;text-align:left;border:0;background:none;color:var(--fg);padding:6px 0}.wlr span{font-size:13px;color:var(--dim)}";
document.head.appendChild(st);
window.WatchApp = { sheet, paintLive, tick };
})();
