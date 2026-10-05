/* Webs Browser for iPhone 2.9 - your phone and your PC (js/link.js): Menu → Phone and PC.
   - Link with the Webs browser on Windows (a 6-digit code, made on either one).
   - Remote: the PC's video, tabs, scrolling and zoom from the phone (when the PC allows it in its panel).
   - Shared clipboard: send what you copied to the PC, and copy what it sends.
   - Pick up where you left off: what the PC has open, on a card on the start page.
   - Sets of tabs: the PC's tabs sent here open with one tap; this phone's tabs go to the PC, or into a link
     anyone can open (webs…/#tabs=…, which this app shows as a list). */
(function () {
"use strict";
if (!window.Link || PRIVATE) return;
const LK = window.Link;
let R = null, showingCode = false;
LK.setApp("iphone");
const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function start() {
  if (!LK.linked()) return;
  R = LK.connect({ app:"iphone" });
  if (!R || R.wired) return;
  R.wired = true;
  R.on("open", () => { card(); mine(); if (open("links") && !showingCode) linkSheet(); });
  R.on("peers", () => {
    if (showingCode && LK.others().length) { showingCode = false; toast("📱 Linked with " + LK.others()[0].name); if (open("links")) linkSheet(); }
    else if (open("links")) paintPeers();
  });
  R.on("set", (k, v) => {
    if (k === "clip" && v && v.text) toast("📋 From " + (v.from || "your PC") + ": " + short(v.text, 50), { label:"Copy", fn:() => copy(v.text) });
    else if (k.indexOf("tabs.") === 0 && v && Array.isArray(v.list)) toast("🗂️ " + (v.from || "Your PC") + " sent " + v.list.length + " tab" + (v.list.length === 1 ? "" : "s"), { label:"See", fn:() => setSheet(v) });
    else if (k.indexOf("now.") === 0) card();
  });
}
const open = kind => !$("#sheet").classList.contains("hide") && $("#sheet").dataset.kind === kind;
function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Copied"), () => toast("Couldn't copy")); }
function mine() { const t = curTab(); if (R && t && t.u && !t.internal && /^https?:/.test(t.u) && cfg.xNowShare !== false) LK.setNow(t.u, t.t, "iphone"); }

/* ---------------------------------------------------------------- the start page: continue from your PC */
HIDE_KEYS.push(["linknow", "Continue from your PC"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="lkSec" class="wsec hide"></section>');
function card() {
  const box = $("#lkSec"); if (!box) return;
  const l = LK.nowList().filter(x => x.app !== "iphone" || true);
  if (hidden("linknow") || !l.length || Date.now() - l[0].ts > 86400000) { wshow("lkSec", false); return; }
  const x = l[0];
  box.innerHTML = '<button type="button" class="lkc"><span class="lki">' + (x.app === "windows" ? "💻" : "📱") + '</span><span class="lkt"><em>Continue from ' + esc(x.from || "your PC") + "</em><b>" + esc(x.t || hostOf(x.u)) +
    "</b><i>" + esc(hostOf(x.u)) + "</i></span><span class=\"lkg\">Open ›</span></button>";
  box.querySelector(".lkc").onclick = () => go(x.u, { newTab:true });
  wshow("lkSec", true);
}
HOME_HOOKS.push(card);

/* ---------------------------------------------------------------- sheets */
function linkSheet() {
  if (!LK.linked()) {
    openSheet("Phone and PC", '<div class="card pvc"><p>Link Webs on this phone with the Webs browser on your PC: use your phone as a remote, share the clipboard, send tabs, and pick up where you left off.</p>' +
      '<p class="dim">On the PC: Menu → Phone and PC → Make a code. Then type it here.</p>' +
      '<div class="lkin"><input id="lkCode" inputmode="numeric" maxlength="7" placeholder="123 456" autocomplete="one-time-code"><button type="button" class="btn" id="lkJoin">Link</button></div>' +
      '<p class="dim">Or make a code here and type it on the PC:</p><button type="button" class="btn ghost" id="lkMake">Make a code</button><div class="lkbig" id="lkShow"></div><p class="lkerr" id="lkErr"></p></div>', { kind:"links" });
    const err = m => { $("#lkErr").textContent = m; };
    $("#lkJoin").onclick = async () => { try { await LK.join($("#lkCode").value); toast("📱 Linked with your PC"); start(); linkSheet(); } catch (e) { err(e.message); } };
    $("#lkMake").onclick = async () => { try { const j = await LK.pairNew(); $("#lkShow").textContent = j.code.slice(0, 3) + " " + j.code.slice(3); err("Type it on the PC in the next " + j.minutes + " minutes."); showingCode = true; start(); } catch (e) { err(e.message); } };
    return;
  }
  start();
  const r = (act, e, n, sub) => '<button type="button" class="mrow" data-lk="' + act + '"><span class="aie">' + e + "</span><span>" + n + "</span><em>" + esc(sub) + "</em></button>";
  const sets = LK.tabSets();
  openSheet("Phone and PC", '<div class="card pvc"><div class="lkdev" id="lkDev"></div></div><div class="card">' +
    r("remote", "🎮", "Remote", "Work the PC from here") + r("clip", "📋", "Send my clipboard", "To the PC") +
    r("tabs", "🗂️", "Send my tabs", T.n.list.filter(t => t.u && !t.internal).length + " open") + r("share", "🔗", "Share my tabs in a link", "Anyone can open it") +
    (sets.length ? r("sets", "📥", "Tabs from your PC", sets.length + " set" + (sets.length === 1 ? "" : "s")) : "") + "</div>" +
    '<div class="card"><label class="mrow lkswr"><span class="aie">⏩</span><span>Pick up where you left off</span><input type="checkbox" id="lkNow"' + (cfg.xNowShare !== false ? " checked" : "") + "></label>" +
    r("rename", "✏️", "Name of this phone", LK.myName()) + r("unlink", "⛓️", "Unlink", "") + "</div>", { kind:"links" });
  $("#lkNow").onchange = e => { cfg.xNowShare = e.target.checked; save("settings", cfg); if (e.target.checked) mine(); };
  $("#sheetBody").querySelectorAll("[data-lk]").forEach(b => { b.onclick = () => ({
    remote:remoteSheet, clip:sendClip, tabs:sendTabs, share:shareTabs, sets:() => setSheet(sets[0]),
    rename:() => ask({ title:"Name of this phone", fields:[{ k:"n", label:"Name", value:LK.myName() }], ok:"Save" }, v => { LK.rename(v.n); R = null; start(); setTimeout(linkSheet, 50); }),
    unlink:() => { if (confirm("Unlink this phone from your PC?")) { LK.unlink(); R = null; wshow("lkSec", false); linkSheet(); } } })[b.dataset.lk](); });
  paintPeers();
}
function paintPeers() {
  const d = $("#lkDev"); if (!d) return;
  const o = LK.others(), n = LK.nowList()[0];
  d.innerHTML = '<p class="pvh">' + (o.length ? "💻 " + esc(o.map(x => x.name).join(", ")) + " online" : R && R.open ? "Your PC isn't online right now" : "Connecting…") + "</p>" +
    (n ? '<p class="dim">Open there: ' + esc(short(n.t || n.u, 60)) + "</p>" : "");
}
function sendClip() {
  if (!navigator.clipboard || !navigator.clipboard.readText) { ask({ title:"Send to the PC", fields:[{ k:"t", label:"Text" }], ok:"Send" }, v => { LK.sendClip(v.t); toast("📋 Sent"); }); return; }
  navigator.clipboard.readText().then(t => { if (!t) { toast("The clipboard is empty"); return; } LK.sendClip(t); toast("📋 Sent to your PC"); },
    () => ask({ title:"Send to the PC", msg:"Paste what to send.", fields:[{ k:"t", label:"Text" }], ok:"Send" }, v => { LK.sendClip(v.t); toast("📋 Sent"); }));
}
const myTabs = () => T.n.list.filter(t => t.u && !t.internal && /^https?:/.test(t.u)).map(t => ({ u:t.u, t:t.t }));
function sendTabs() { const l = myTabs(); if (!l.length) { toast("No web pages open"); return; } if (LK.sendTabs("Tabs from " + LK.myName(), l)) toast("🗂️ Sent " + l.length + " tabs to your PC"); else toast("Not connected yet"); }
function shareTabs() {
  const l = myTabs(); if (!l.length) { toast("No web pages open"); return; }
  const u = LK.shareUrl("Tabs from a friend", l);
  if (navigator.share) navigator.share({ title:l.length + " tabs", url:u }).catch(() => {}); else copy(u);
}
function setSheet(v) {
  if (!v) return;
  openSheet(v.name || "Tabs", '<div class="card">' + v.list.map((x, i) => '<button type="button" class="mrow" data-i="' + i + '"><span class="aie">🌐</span><span>' + esc(short(x.t || hostOf(x.u), 60)) + "</span><em>" + esc(hostOf(x.u)) + "</em></button>").join("") +
    '</div><div class="card"><button type="button" class="mrow" data-all="1"><span class="aie">📂</span><span>Open all ' + v.list.length + "</span></button></div>", { back:LK.linked() ? linkSheet : null });
  $("#sheetBody").querySelectorAll("[data-i]").forEach(b => { b.onclick = () => { closeSheet(); go(v.list[+b.dataset.i].u, { newTab:true }); }; });
  $("#sheetBody [data-all]").onclick = () => { closeSheet(); v.list.slice(0, 15).forEach(x => go(x.u, { newTab:true })); toast("Opened " + Math.min(15, v.list.length) + " tabs"); };
}
function remoteSheet() {
  openSheet("Remote", '<div class="lkpad">' + LK.REMOTE.map(([k, e, n]) => '<button type="button" data-r="' + k + '" aria-label="' + esc(n) + '"><b>' + e + "</b><span>" + esc(n) + "</span></button>").join("") + "</div>" +
    '<div class="card pvc"><div class="lkin"><input id="lkGo" placeholder="Open a site or search on the PC" enterkeyhint="go"><button type="button" class="btn" id="lkGoB">Go</button></div>' +
    '<p class="dim">The PC needs “Let my phone be a remote” on (Menu → Phone and PC).</p></div>', { back:linkSheet, kind:"remote" });
  $("#sheetBody .lkpad").onclick = e => { const b = e.target.closest("[data-r]"); if (!b || !R) return; R.msg({ k:"remote", cmd:b.dataset.r }); b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 180); try { navigator.vibrate && navigator.vibrate(8); } catch (x) {} };
  const goPc = () => { const v = $("#lkGo").value.trim(); if (!v || !R) return; const url = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? "https://" + v : "";
    R.msg({ k:"remote", cmd:url ? "open" : "search", arg:url || v }); $("#lkGo").value = ""; toast("Sent to the PC"); };
  $("#lkGoB").onclick = goPc; $("#lkGo").onkeydown = e => { if (e.key === "Enter") goPc(); };
}

/* ---------------------------------------------------------------- hooks */
const goL = go;
go = function (input, opts) { const r = goL(input, opts); setTimeout(mine, 800); return r; };
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && R) { R.again(); card(); } });
// a set of tabs in a link (…/#tabs=…)
function fromHash() {
  const s = LK.readShare(location.hash); if (!s) return;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  setTimeout(() => setSheet({ name:s.name || "Shared tabs", list:s.list }), 400);
}
fromHash(); addEventListener("hashchange", fromHash);
ACTIONS.links = linkSheet;
const openMenuL = openMenu;
openMenu = function () {
  openMenuL();
  const card2 = $("#sheetBody .card:last-of-type");
  if (card2) card2.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="links">' + ico("phone") + "<span>Phone and PC</span><em>" + (LK.linked() ? "Remote, clipboard, tabs" : "Link your PC") + "</em></button>");
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.LinkApp = { linkSheet, remoteSheet, setSheet, sendClip, sendTabs, shareTabs, card, start, room:() => R };
setTimeout(start, 1200);

const st = document.createElement("style");
st.textContent = ".lkc{display:flex;width:100%;gap:12px;align-items:center;padding:12px 14px;border:0;border-radius:16px;background:var(--bg2);color:var(--fg);font:inherit;text-align:left;margin-bottom:10px}" +
  ".lki{font-size:24px}.lkt{flex:1;min-width:0;display:flex;flex-direction:column}.lkt em{font-style:normal;font-size:12.5px;color:var(--dim)}.lkt b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lkt i{font-style:normal;font-size:12.5px;color:var(--dim)}.lkg{color:var(--accent);font-weight:600}" +
  ".lkin{display:flex;gap:8px;margin:10px 0}.lkin input{flex:1;min-width:0;font:inherit;font-size:17px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}" +
  ".lkbig{font:700 38px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-align:center;color:var(--accent);margin:8px 0}.lkerr{color:#ff6b5f;min-height:18px}" +
  ".lkpad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:4px 0 14px}.lkpad button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 4px;border:0;border-radius:16px;background:var(--bg2);color:var(--fg);font:inherit;touch-action:manipulation}" +
  ".lkpad b{font-size:26px;line-height:1}.lkpad span{font-size:12px;color:var(--dim)}.lkpad button.hit{background:var(--accent);color:#fff}.lkswr input{margin-left:auto;width:22px;height:22px}";
document.head.appendChild(st);
})();
