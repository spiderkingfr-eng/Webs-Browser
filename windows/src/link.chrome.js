/* ---------------------------------------------------------------- Webs 3.10: your phone and this PC (../../js/link.js)
   Menu → Phone and PC…: link the iPhone app with a 6-digit code, then
   - Shared clipboard: what you copy here can go to your phone, and what it sends shows here to copy.
   - Phone as a remote: play and pause, change tabs, scroll, go back, zoom… from the phone (only when you allow it).
   - Pick up where you left off: what your phone has open shows on the new tab page, and this PC's page on the phone.
   - Send these tabs: all of them (or a group) to the phone, or a link anyone can open.
   It all goes through a live room on the Web AI server (rooms.js), only between your linked devices. */
(function () {
"use strict";
if (!window.Link) return;
const LK = window.Link;
function panel(id, icon, title, sub) {
  const p = el("div", "xpane gtp lkp");
  p.innerHTML = '<div class="xhead"><div class="xic">' + icon + '</div><div><b></b><span></span></div></div><div class="gtb"></div>';
  p.querySelector(".xhead b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  const n = openOver(id, p); n.style.right = "8px";
  return p;
}
const saveCfg = () => { saveNow("settings"); sendPrefs(); };
const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
let R = null, showingCode = false;
LK.setApp("windows");

/* ---------------------------------------------------------------- the room */
function start() {
  if (PRIVATE || !LK.linked()) return;
  R = LK.connect({ app:"windows" });
  if (!R || R.wired) return;
  R.wired = true;
  R.on("open", () => { keepNow(); mine(T(active)); if (overlay === "lkpanel" && !showingCode) devicesPanel(); });
  R.on("peers", () => {
    if (showingCode && LK.others().length) { showingCode = false; toast("📱 Linked with " + LK.others()[0].name); if (overlay === "lkpanel") devicesPanel(); }
    else if (overlay === "lkpanel") paintDevices();
  });
  R.on("set", (k, v, from) => {
    if (k === "clip" && v && v.text) gotClip(v);
    else if (k.indexOf("tabs.") === 0 && v && Array.isArray(v.list)) gotTabs(v);
    else if (k.indexOf("now.") === 0) keepNow();
  });
  R.on("msg", d => { if (d && d.k === "remote") remote(d.cmd, d.arg); });
}
// what the other devices have open, for the new tab page (it reads wsb.linkNow)
function keepNow() { save("linkNow", LK.nowList().slice(0, 4)); }
function mine(t) { if (R && t && isWeb(t.url) && cfg.xNowShare !== false) LK.setNow(t.url, t.title, "windows"); }

/* ---------------------------------------------------------------- the clipboard */
function gotClip(v) {
  toast("📋 From " + (v.from || "your phone") + ": " + short(v.text, 60), { label:"Copy", fn:() => { navigator.clipboard.writeText(v.text).then(() => toast("Copied"), () => toast("Couldn't copy")); addClip(v.text, null); } });
}
const addClipL = addClip;
addClip = function (text, t) {
  addClipL(text, t);
  if (R && cfg.xClipShare && !PRIVATE && text && text.length <= 20000) LK.sendClip(text);
};
function sendClipNow() {
  if (!R) { devicesPanel(); return; }
  navigator.clipboard.readText().then(t => { if (!t) { toast("The clipboard is empty"); return; } LK.sendClip(t); toast("📋 Sent to your phone"); }, () => toast("Couldn't read the clipboard"));
}

/* ---------------------------------------------------------------- sets of tabs */
function tabList(gid) { return tabs.filter(t => isWeb(t.url) && (!gid || t.group === gid)).map(t => ({ u:t.url, t:t.title || "" })); }
function gotTabs(v) {
  toast("🗂️ " + (v.from || "Your phone") + " sent " + v.list.length + " tab" + (v.list.length === 1 ? "" : "s") + (v.name ? " (" + short(v.name, 30) + ")" : ""), { label:"Open", fn:() => openSet(v) });
}
function openSet(v) {
  let gid = "";
  if (v.list.length > 1) { gid = newGroupId(); groups[gid] = { name:short(v.name || "From " + (v.from || "phone"), 30), color:Object.keys(COLORS)[2] || Object.keys(COLORS)[0], collapsed:false }; saveGroups(); }
  v.list.slice(0, 40).forEach((x, i) => newTab(x.u, i > 0, 0, i > 0, x.t, gid ? { group:gid } : {}));
}
function sharePanel(gid) {
  const list = tabList(gid), g = gid && groups[gid];
  const p = panel("lkshare", "🗂️", "Share these tabs", list.length + " tab" + (list.length === 1 ? "" : "s") + (g ? " in " + g.name : "")), b = p.querySelector(".gtb");
  const name = g ? g.name : "Tabs from " + LK.myName();
  b.innerHTML = '<div class="lkl"></div><div class="xbtns"><button class="btn2 main lk-dev">Send to my phone</button><button class="btn2 lk-copy">Copy a link anyone can open</button></div>' +
    '<div class="xsmall">The link holds the addresses themselves (nothing is stored anywhere), so share it only with people who may see them.</div>';
  list.slice(0, 12).forEach(x => b.querySelector(".lkl").appendChild(linkRow(x.u, x.t || x.u, "", () => {})));
  if (list.length > 12) b.querySelector(".lkl").insertAdjacentHTML("beforeend", '<div class="xsmall">and ' + (list.length - 12) + " more</div>");
  const dv = b.querySelector(".lk-dev");
  if (!LK.linked()) { dv.textContent = "Link your phone first…"; dv.onclick = () => { closeOver(); devicesPanel(); }; }
  else dv.onclick = () => { if (LK.sendTabs(name, list)) { toast("🗂️ Sent " + list.length + " tabs to your phone"); closeOver(); } else toast("Not connected yet. Try again in a moment."); };
  b.querySelector(".lk-copy").onclick = () => { const u = LK.shareUrl(name, list); navigator.clipboard.writeText(u).then(() => toast("Link copied: " + Math.min(list.length, 30) + " tabs"), () => toast("Couldn't copy")); };
}

/* ---------------------------------------------------------------- the phone as a remote */
function remote(cmd, arg) {
  if (!cfg.xRemote) return;
  const t = T(active), i = tabs.findIndex(x => x.id === active);
  const playing = tabs.find(x => x.audio) || t;
  switch (cmd) {
    case "playpause": if (playing) send("media", playing.id, "toggle", ""); break;
    case "nexttab": if (tabs.length) select(tabs[(i + 1) % tabs.length].id); break;
    case "prevtab": if (tabs.length) select(tabs[(i - 1 + tabs.length) % tabs.length].id); break;
    case "up": case "down": if (t && isWeb(t.url)) send("page-tool", t.id, "x-scrollto", cmd); break;
    case "back": if (t) send("back", t.id); break;
    case "fwd": if (t) send("forward", t.id); break;
    case "reload": if (t) send("reload", t.id, 0); break;
    case "mute": if (playing) send("mute", playing.id, playing.muted ? 0 : 1); break;
    case "zoomin": zoom(1); break;
    case "zoomout": zoom(-1); break;
    case "fullscreen": send("fullscreen", "t"); break;
    case "close": if (t) closeTab(t.id); break;
    case "open": if (/^https?:\/\//i.test(arg || "")) newTab(arg, false); break;
    case "search": if (arg) newTab(engine().url + encodeURIComponent(String(arg).slice(0, 300)), false); break;
    default: return;
  }
  const n = load("remoteN", 0); save("remoteN", n + 1);
}

/* ---------------------------------------------------------------- the panel */
function devicesPanel() {
  if (overlay !== "lkpanel") showingCode = false;
  const p = panel("lkpanel", "📱", "Phone and PC", LK.linked() ? "Linked" : "Link the Webs app on your iPhone"), b = p.querySelector(".gtb");
  if (!LK.linked()) {
    b.innerHTML = '<div class="xsmall">In the Webs app on your iPhone: Menu → Phone and PC → Type a code. Or make the code on the phone and type it here.</div>' +
      '<div class="lkcode">······</div><div class="xbtns"><button class="btn2 main lk-make">Make a code</button></div>' +
      '<div class="gtk">Or type the code from your phone</div><div class="pvadd"><input class="xin lk-in" inputmode="numeric" maxlength="7" placeholder="123456"><button class="btn2 lk-join">Link</button></div><div class="xsmall lk-err"></div>';
    const err = m => { b.querySelector(".lk-err").textContent = m; };
    b.querySelector(".lk-make").onclick = async () => {
      try { const j = await LK.pairNew(); b.querySelector(".lkcode").textContent = j.code.slice(0, 3) + " " + j.code.slice(3); err("Type it on your phone in the next " + j.minutes + " minutes. This panel changes once it's linked."); showingCode = true; start(); }
      catch (e) { err(e.message); }
    };
    const go = async () => { try { await LK.join(b.querySelector(".lk-in").value); toast("📱 Linked"); start(); devicesPanel(); } catch (e) { err(e.message); } };
    b.querySelector(".lk-join").onclick = go;
    b.querySelector(".lk-in").onkeydown = e => { if (e.key === "Enter") go(); };
    return;
  }
  start();
  const sw = (k, label, sub, def) => '<label class="lksw"><span><b>' + label + "</b><em>" + sub + '</em></span><input type="checkbox" data-k="' + k + '"' + ((cfg[k] === undefined ? def : cfg[k]) ? " checked" : "") + "></label>";
  b.innerHTML = '<div class="gtk">Devices</div><div class="lkdev"></div>' +
    sw("xClipShare", "Shared clipboard", "What you copy here goes to your phone too", false) +
    sw("xRemote", "Let my phone be a remote", "Play and pause, tabs, scrolling, zoom", false) +
    sw("xNowShare", "Pick up where you left off", "Your devices show each other's open page", true) +
    '<div class="gtk">On your phone now</div><div class="lknow"></div>' +
    '<div class="xbtns"><button class="btn2 lk-clip">Send my clipboard</button><button class="btn2 lk-tabs">Send these tabs…</button></div>' +
    '<div class="gtk">This PC</div><div class="pvadd"><input class="xin lk-name" maxlength="30"><button class="btn2 lk-ren">Rename</button></div>' +
    '<div class="xbtns"><button class="btn2 lk-more">Link another device…</button><button class="btn2 lk-off">Unlink</button></div><div class="lkcode small hide"></div>';
  b.querySelectorAll("[data-k]").forEach(c => { c.onchange = () => { cfg[c.dataset.k] = c.checked; saveCfg(); if (c.dataset.k === "xNowShare" && c.checked) mine(T(active)); }; });
  b.querySelector(".lk-clip").onclick = sendClipNow;
  b.querySelector(".lk-tabs").onclick = () => { closeOver(); sharePanel(""); };
  b.querySelector(".lk-name").value = LK.myName();
  b.querySelector(".lk-ren").onclick = () => { LK.rename(b.querySelector(".lk-name").value); R = null; start(); toast("Renamed"); };
  b.querySelector(".lk-off").onclick = () => { if (!confirm("Unlink this PC from your other devices?")) return; LK.unlink(); R = null; save("linkNow", []); devicesPanel(); };
  b.querySelector(".lk-more").onclick = async () => { const c = b.querySelector(".lkcode"); try { const j = await LK.pairNew(); c.textContent = j.code.slice(0, 3) + " " + j.code.slice(3); c.classList.remove("hide"); } catch (e) { toast(e.message); } };
  paintDevices();
}
function paintDevices() {
  const b = document.querySelector("#lkpanel .gtb"); if (!b || !b.querySelector(".lkdev")) return;
  const o = LK.others(), d = b.querySelector(".lkdev");
  d.innerHTML = '<div class="lkrow"><span>💻</span><b></b><em>this PC' + (R && R.open ? "" : " · connecting…") + "</em></div>";
  d.querySelector("b").textContent = LK.myName();
  if (!o.length) d.insertAdjacentHTML("beforeend", '<div class="xsmall">No other device online right now. Open the Webs app on your phone.</div>');
  o.forEach(x => { const r = el("div", "lkrow"); r.innerHTML = "<span>" + (x.app === "iphone" ? "📱" : "💻") + "</span><b></b><em>online</em>"; r.querySelector("b").textContent = x.name; d.appendChild(r); });
  const n = b.querySelector(".lknow"), l = LK.nowList();
  n.innerHTML = l.length ? "" : '<div class="xsmall">Nothing yet.</div>';
  l.slice(0, 3).forEach(x => n.appendChild(linkRow(x.u, x.t || x.u, (x.from || "") + " · " + ago(x.ts), () => { closeOver(); newTab(x.u, false); })));
}

/* ---------------------------------------------------------------- hooks */
const applyPageL = applyPage;
applyPage = function (t) { applyPageL(t); if (t && t.id === active) mine(t); };
const selectL = select;
select = function (id) { selectL(id); setTimeout(() => mine(T(active)), 400); };      // the tab really showing, once the host has switched
const menuRowsL = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRowsL) menuRowsL(m);
  if (!PRIVATE) m.appendChild(row("win", "Phone and PC…" + (LK.linked() ? "" : " (link your iPhone)"), "", devicesPanel));
};
const commandsL = commands;
commands = function () {
  return commandsL().concat(PRIVATE ? [] : [
    { t:"Phone and PC: link your iPhone", k:"", i:"win", fn:devicesPanel },
    { t:"Send my clipboard to my phone", k:"", i:"copy", fn:sendClipNow },
    { t:"Share these tabs (to my phone, or a link)", k:"", i:"list", fn:() => sharePanel("") }
  ]);
};
const tabItemsL = X3.tabItems;
X3.tabItems = function (items, id) {
  if (tabItemsL) tabItemsL(items, id);
  const t = T(id); if (!t || PRIVATE) return;
  if (t.group && groups[t.group]) items.splice(items.length - 1, 0, ["Share this group's tabs…", () => sharePanel(t.group)]);
  else items.splice(items.length - 1, 0, ["Share all tabs…", () => sharePanel("")]);
};
X3.link = { devicesPanel, sharePanel, remote, start, openSet, gotClip, room:() => R };
setTimeout(start, 1500);
window.addEventListener("focus", () => { if (R) R.again(); });

const st = document.createElement("style");
st.textContent = `
.lkp{width:420px}.lkcode{font:700 34px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.12em;text-align:center;margin:14px 0 8px;color:var(--accent)}.lkcode.small{font-size:24px}.lkcode.hide{display:none}
.lksw{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer}.lksw span{flex:1;display:flex;flex-direction:column}.lksw em{font-style:normal;font-size:11.5px;color:var(--dim)}
.lkrow{display:flex;gap:8px;align-items:center;padding:5px 0}.lkrow em{font-style:normal;font-size:11.5px;color:var(--dim);margin-left:auto}.lk-err{color:#ff8a80;min-height:16px}
`;
document.head.appendChild(st);
})();
