/* ---------------------------------------------------------------- Webs 3.10: counts for the owner, invites, the wallpaper gallery (../../js/stats.js)
   - With "Send anonymous counts" on: which panels and page tools are used, and the window's own errors, once a day.
   - Menu → Invite a friend: your invite link (a friend who opens it gets an achievement, and so do you), or a
     friend's invite code to type in.
   - Menu → Wallpaper gallery: wallpapers other people shared and the owner approved, for the new tab page;
     and sharing your own (the owner looks at each one first). */
(function () {
"use strict";
if (!window.Stats) return;
Stats.init({ platform:"windows", version:"@@WEBS_VERSION@@" });
function panel(id, icon, title, sub) {
  const p = el("div", "xpane gtp stp");
  p.innerHTML = '<div class="xhead"><div class="xic">' + icon + '</div><div><b></b><span></span></div></div><div class="gtb"></div>';
  p.querySelector(".xhead b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  const n = openOver(id, p); n.style.right = "8px";
  return p;
}
// what's used: each panel as it opens, and each page tool
const openOverS = openOver;
openOver = function (id, node) { if (!PRIVATE && typeof id === "string") Stats.use("p." + id); return openOverS.apply(this, arguments); };
// (send is a constant, so page tools are counted on their way to the host)
const QUIET = /^(init|looks|userjs|x-init|x-explain-on|x-explain-show|x-shop|x-shop-warn|x-seen|x-ai|x-scrollto|x-fill|tool-result)$/;
try {
  const wvS = window.chrome && window.chrome.webview, pm = wvS && wvS.postMessage;
  if (pm) wvS.postMessage = function (m) {
    try { const p = String(m).split("\u0001"); if (p[0] === "page-tool" && !PRIVATE && p[2] && !QUIET.test(p[2])) Stats.use("t." + p[2]); } catch (e) {}
    return pm.apply(wvS, arguments);
  };
} catch (e) {}

/* ---------------------------------------------------------------- invites */
async function invitePanel() {
  const p = panel("stinvite", "💌", "Invite a friend", "You both get an achievement"), b = p.querySelector(".gtb");
  b.innerHTML = '<div class="xsmall">Getting your link…</div>';
  try {
    const i = await Stats.invite();
    if (overlay !== "stinvite") return;
    b.innerHTML = '<div class="xsmall">Send this link to a friend. When they open Webs with it, you both get an achievement.</div><div class="stlink"><input class="xin" readonly><button class="btn2 main">Copy</button></div>' +
      '<div class="stn"></div><div class="gtk">Got an invite from a friend?</div><div class="pvadd"><input class="xin st-code" maxlength="60" placeholder="The code or the link"><button class="btn2 st-claim">Use it</button></div>' +
      '<div class="xsmall">On a PC, a friend downloads Webs Browser and types your code here: <b class="stc"></b></div>';
    b.querySelector(".stlink input").value = i.url; b.querySelector(".stc").textContent = i.code;
    b.querySelector(".stn").textContent = i.n ? "🎉 " + i.n + " friend" + (i.n === 1 ? " has" : "s have") + " joined with it" : "Nobody has used it yet.";
    b.querySelector(".stlink button").onclick = () => navigator.clipboard.writeText(i.url).then(() => toast("Invite link copied"), () => toast("Couldn't copy"));
    b.querySelector(".st-claim").onclick = async () => { try { await Stats.claim(b.querySelector(".st-code").value); toast("🤝 Welcome in! Your friend gets an achievement too"); closeOver(); } catch (e) { toast(e.message); } };
  } catch (e) { b.innerHTML = '<div class="xsmall"></div>'; b.firstChild.textContent = e.message; }
}

/* ---------------------------------------------------------------- the gallery */
async function galleryPanel() {
  const p = panel("stgallery", "🖼️", "Wallpaper gallery", "Shared by people who use Webs"), b = p.querySelector(".gtb");
  p.classList.add("stwide");
  const cur = load("galleryBg", null);
  b.innerHTML = '<div class="stgrid"><div class="xsmall">Loading…</div></div><div class="xbtns"><button class="btn2 st-share">Share a wallpaper…</button>' + (cur ? '<button class="btn2 st-off">Stop using “' + esc(cur.title) + '”</button>' : "") +
    '</div><div class="xsmall">Wallpapers from the gallery show on the new tab page when you haven\'t chosen a picture of your own. Shared ones are checked by the people who make Webs before anyone sees them.</div>';
  b.querySelector(".st-share").onclick = sharePanel;
  if (b.querySelector(".st-off")) b.querySelector(".st-off").onclick = () => { save("galleryBg", null); toast("Back to your own background"); galleryPanel(); };
  try {
    const l = await Stats.gallery(), g = b.querySelector(".stgrid");
    if (overlay !== "stgallery") return;
    g.innerHTML = l.length ? "" : '<div class="xsmall">Nothing in the gallery yet. Be the first to share one!</div>';
    // fan art (#074): a filter, a 🎨 on each, and the artist's page
    if (l.some(x => x.kind === "fanart")) {
      const f = el("div", "stfil"); f.innerHTML = '<button class="on" data-f="">All</button><button data-f="fanart">🎨 Fan art</button>';
      f.querySelectorAll("button").forEach(x => { x.onclick = () => { f.querySelectorAll("button").forEach(y => y.classList.toggle("on", y === x)); g.querySelectorAll(".stw").forEach(w => { w.hidden = !!x.dataset.f && w.dataset.kind !== x.dataset.f; }); }; });
      g.before(f);
    }
    l.forEach(x => {
      const t = el("button", "stw" + (cur && cur.id === x.id ? " on" : ""));
      t.style.backgroundImage = 'url("' + x.url + '")'; t.title = x.title + " · by " + x.by;
      t.innerHTML = "<span></span>"; t.querySelector("span").textContent = (x.kind === "fanart" ? "🎨 " : "") + x.title; t.dataset.kind = x.kind || "";
      if (x.kind === "fanart" && /^https:\/\//.test(x.link || "")) { const a = el("i", "stlk"); a.textContent = "↗"; a.title = "The artist's page"; a.onclick = ev => { ev.stopPropagation(); closeOver(); newTab(x.link, false); }; t.appendChild(a); }
      t.onclick = () => { save("galleryBg", { id:x.id, url:x.url, title:x.title, by:x.by }); Stats.use("gallery.use"); toast("🖼️ “" + x.title + "” by " + x.by + " is on your new tab page"); closeOver(); };
      g.appendChild(t);
    });
  } catch (e) { b.querySelector(".stgrid").innerHTML = '<div class="xsmall"></div>'; b.querySelector(".stgrid .xsmall").textContent = e.message; }
}
function sharePanel() {
  const p = panel("stshare", "🖼️", "Share a wallpaper", "For everyone's gallery"), b = p.querySelector(".gtb");
  b.innerHTML = '<label class="gtf"><span>Picture (a photo or drawing of your own)</span><input type="file" accept="image/jpeg,image/png,image/webp" class="xin"></label>' +
    '<label class="gtf"><span>Name it</span><input class="xin st-t" maxlength="60" placeholder="Night city"></label><label class="gtf"><span>Your name or nickname, shown with it</span><input class="xin st-by" maxlength="40"></label>' +
    '<label class="gtf st-fa"><input type="checkbox" class="st-k"> <span>🎨 This is fan art I drew myself</span></label><label class="gtf st-lk" hidden><span>A link to your art page (optional)</span><input class="xin st-l" maxlength="300" placeholder="https://…"></label>' +
    '<div class="stprev"></div><div class="xbtns"><button class="btn2 main">Send it</button></div><div class="xsmall">Only share pictures you made or may share. The people who make Webs look at each one first.</div>';
  b.querySelector(".st-by").value = load("galleryBy", "");
  b.querySelector(".st-k").onchange = e => { b.querySelector(".st-lk").hidden = !e.target.checked; };
  let img = "";
  b.querySelector("input[type=file]").onchange = async e => { const f = e.target.files[0]; if (!f) return;
    try { img = await Stats.toJpeg(f); b.querySelector(".stprev").style.backgroundImage = 'url("' + img + '")'; b.querySelector(".stprev").classList.add("on"); } catch (x) { toast(x.message); } };
  b.querySelector(".xbtns button").onclick = async ev => {
    if (!img) { toast("Choose a picture first"); return; }
    ev.target.disabled = true;
    try { save("galleryBy", b.querySelector(".st-by").value.trim()); await Stats.share(img, b.querySelector(".st-t").value.trim(), b.querySelector(".st-by").value.trim(), b.querySelector(".st-k").checked ? { kind:"fanart", link:b.querySelector(".st-l").value.trim() } : {}); toast("🖼️ Sent! It shows in the gallery once it's approved"); closeOver(); }
    catch (x) { toast(x.message); ev.target.disabled = false; }
  };
}

const menuRowsS = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRowsS) menuRowsS(m);
  if (PRIVATE) return;
  m.appendChild(row("star", "Invite a friend…", "", invitePanel));
  m.appendChild(row("win", "Wallpaper gallery…", "", galleryPanel));
};
const commandsS = commands;
commands = function () { return commandsS().concat(PRIVATE ? [] : [{ t:"Invite a friend", k:"", i:"star", fn:invitePanel }, { t:"Wallpaper gallery", k:"", i:"win", fn:galleryPanel }, { t:"Share a wallpaper", k:"", i:"win", fn:sharePanel }]); };
X3.stats = { invitePanel, galleryPanel, sharePanel };

const st = document.createElement("style");
st.textContent = `
.stp{width:420px}.stp.stwide{width:560px}.stlink{display:flex;gap:6px;margin:10px 0}.stlink .xin{flex:1;margin:0;font-size:12px}.stn{font-size:13px;margin:4px 0 10px}
.stgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.stw{aspect-ratio:16/10;border-radius:10px;border:2px solid transparent;background:var(--bg3) center/cover;position:relative;cursor:pointer;padding:0}
.stw.on{border-color:var(--accent)}.stw[hidden]{display:none}.stlk{position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-style:normal;font-size:12px;line-height:22px;text-align:center}
.stfil{display:flex;gap:6px;margin-bottom:8px}.stfil button{font:inherit;font-size:12.5px;border:1px solid var(--line);background:none;color:var(--dim);border-radius:999px;padding:3px 10px;cursor:pointer}.stfil button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.st-fa{flex-direction:row!important;align-items:center;gap:8px}.stw span{position:absolute;left:5px;bottom:5px;right:5px;font-size:11px;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:1px 6px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stprev{height:0;border-radius:10px;background:center/cover;margin:6px 0}.stprev.on{height:140px}
`;
document.head.appendChild(st);
})();
