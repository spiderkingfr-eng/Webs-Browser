/* Webs Browser for iPhone 2.9 - counts for the owner, invites and the wallpaper gallery (js/stats.js).
   - With "Send anonymous counts" on: which sheets are opened, and the app's own errors, once a day.
   - Menu → Invite a friend: your invite link (share it; when a friend opens Webs with it, you both get an achievement).
   - Menu → Wallpaper gallery: wallpapers people shared and the owner approved, as your start page's background;
     and sharing one of your own. */
(function () {
"use strict";
if (!window.Stats) return;
Stats.init({ platform:"iphone", version:VERSION });
const openSheetS = openSheet;
openSheet = function (title, html, opts) { if (!PRIVATE) Stats.use("s." + String(opts && opts.kind || title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)); return openSheetS.apply(this, arguments); };

async function inviteSheet() {
  openSheet("Invite a friend", '<div class="card pvc"><p class="dim">Getting your link…</p></div>');
  try {
    const i = await Stats.invite();
    openSheet("Invite a friend", '<div class="card pvc"><p>Send your link to a friend. When they open Webs with it, you both get an achievement.</p><p class="stl"></p>' +
      '<button type="button" class="btn" id="stShare">Share my invite</button><p class="pvh" id="stN"></p></div>' +
      '<div class="card pvc"><p class="dim">Got an invite? Type its code (or paste the link):</p><div class="lkin"><input id="stCode" autocapitalize="off" placeholder="abcd1234"><button type="button" class="btn" id="stUse">Use it</button></div></div>');
    $("#sheetBody .stl").textContent = i.url;
    $("#stN").textContent = i.n ? "🎉 " + i.n + " friend" + (i.n === 1 ? " has" : "s have") + " joined" : "";
    $("#stShare").onclick = () => { if (navigator.share) navigator.share({ title:"Webs Browser", text:"Try Webs, the browser I use! Open my invite and we both get an achievement:", url:i.url }).catch(() => {}); else navigator.clipboard.writeText(i.url).then(() => toast("Copied")); };
    $("#stUse").onclick = async () => { try { await Stats.claim($("#stCode").value); toast("🤝 Welcome in! Your friend gets an achievement too"); closeSheet(); } catch (e) { toast(e.message); } };
  } catch (e) { $("#sheetBody").innerHTML = '<div class="card pvc"><p></p></div>'; $("#sheetBody p").textContent = e.message; }
}
async function gallerySheet() {
  openSheet("Wallpaper gallery", '<div class="stgrid"><p class="dim">Loading…</p></div><div class="card"><button type="button" class="mrow" id="stSend"><span class="aie">📤</span><span>Share a wallpaper</span><em>Checked before anyone sees it</em></button></div>', { kind:"gallery" });
  $("#stSend").onclick = shareSheet;
  try {
    const l = await Stats.gallery(), g = $("#sheetBody .stgrid"); if (!g) return;
    g.innerHTML = l.length ? "" : '<p class="dim">Nothing in the gallery yet. Be the first!</p>';
    l.forEach(x => {
      const b = document.createElement("button"); b.type = "button"; b.className = "stw"; b.style.backgroundImage = 'url("' + x.url + '")';
      b.innerHTML = "<span></span>"; b.querySelector("span").textContent = x.title + " · " + x.by;
      b.onclick = async () => {
        try { const r = await fetch(x.url); if (!r.ok) throw new Error(); const blob = await r.blob(); closeSheet(); await chooseBackground(new File([blob], "gallery.jpg", { type:"image/jpeg" })); Stats.use("gallery.use"); }
        catch (e) { toast("Couldn't get that wallpaper"); }
      };
      g.appendChild(b);
    });
  } catch (e) { const g = $("#sheetBody .stgrid"); if (g) { g.innerHTML = '<p class="dim"></p>'; g.firstChild.textContent = e.message; } }
}
function shareSheet() {
  openSheet("Share a wallpaper", '<div class="card pvc"><button type="button" class="btn ghost" id="stPick">Choose a picture</button><div class="stprev" id="stPrev"></div>' +
    '<div class="lkin"><input id="stT" maxlength="60" placeholder="Name it"></div><div class="lkin"><input id="stBy" maxlength="40" placeholder="Your name or nickname"></div>' +
    '<button type="button" class="btn" id="stGo">Send it</button><p class="dim">Only share pictures you made or may share. The people who make Webs look at each one first.</p></div>', { back:gallerySheet });
  $("#stBy").value = load("galleryBy", "");
  let img = "";
  $("#stPick").onclick = () => pickFile("image/*", async f => { try { img = await Stats.toJpeg(f); $("#stPrev").style.backgroundImage = 'url("' + img + '")'; $("#stPrev").classList.add("on"); } catch (e) { toast(e.message); } });
  $("#stGo").onclick = async () => {
    if (!img) { toast("Choose a picture first"); return; }
    try { save("galleryBy", $("#stBy").value.trim()); await Stats.share(img, $("#stT").value.trim(), $("#stBy").value.trim()); closeSheet(); toast("🖼️ Sent! It shows in the gallery once it's approved"); } catch (e) { toast(e.message); }
  };
}
Object.assign(ACTIONS, { invite:inviteSheet, gallery:gallerySheet });
const openMenuS = openMenu;
openMenu = function () {
  openMenuS();
  const card = $("#sheetBody .card:last-of-type");
  if (card && !PRIVATE) card.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="invite">' + ico("gift") + "<span>Invite a friend</span><em>An achievement for both</em></button>" +
    '<button type="button" class="mrow" data-act="gallery">' + ico("palette") + "<span>Wallpaper gallery</span><em>Shared by people</em></button>");
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.StatsApp = { inviteSheet, gallerySheet, shareSheet };
const st = document.createElement("style");
st.textContent = ".stl{font-size:13px;word-break:break-all;background:var(--bg);border-radius:10px;padding:8px 10px;color:var(--dim)}.stgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}" +
  ".stw{aspect-ratio:3/4;border:0;border-radius:14px;background:var(--bg2) center/cover;position:relative;padding:0}.stw span{position:absolute;left:6px;right:6px;bottom:6px;font-size:12px;color:#fff;background:rgba(0,0,0,.55);border-radius:8px;padding:2px 7px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".stprev{height:0;border-radius:12px;background:center/cover;margin:8px 0}.stprev.on{height:180px}";
document.head.appendChild(st);
})();
