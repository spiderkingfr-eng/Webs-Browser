/* Webs Browser for iPhone - the rest: a passcode lock, history that deletes
   itself, a storage manager, timer notifications and keeping the screen on,
   page info with a rule for each site, full screen, a reader view for
   Wikipedia, swiping the address bar to change tabs, and the keyboard
   shortcuts for an iPad. */
"use strict";

/* ---------------------------------------------------------------- passcode lock
   A passcode for Webs itself: { h:hash, s:salt } in wsb.mlock. It stays on
   this iPhone (it is not part of backups). */
async function pinHash(pin, salt) {
  const data = new TextEncoder().encode(salt + ":" + pin);
  if (window.crypto && crypto.subtle) return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(b => b.toString(16).padStart(2, "0")).join("");
  let h = 2166136261; data.forEach(b => { h ^= b; h = Math.imul(h, 16777619); }); return (h >>> 0).toString(16);   // only without HTTPS
}
let lockFails = 0, lockUntil = 0, hiddenAt = 0;
function showLock() {
  const L = load("mlock", null);
  if (!L || $("#lock")) { document.documentElement.classList.remove("locked"); return; }
  closeDlg();
  const box = document.createElement("div");
  box.id = "lock"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Webs is locked");
  box.innerHTML = '<div class="lk"><svg class="mark"><use href="#logo"/></svg><b>Enter your passcode</b><div class="dots" id="lkD"></div><p id="lkM"></p><div class="kp lkp">' +
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(k => k ? '<button type="button" data-k="' + k + '">' + k + "</button>" : "<span></span>").join("") + "</div></div>";
  document.body.appendChild(box);
  document.documentElement.classList.add("locked");
  let pin = "";
  const len = L.n || 4;
  const dots = () => { $("#lkD").innerHTML = Array.from({ length:len }, (_, i) => '<i class="' + (i < pin.length ? "on" : "") + '"></i>').join(""); };
  dots();
  box.querySelector(".kp").onclick = async e => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    if (Date.now() < lockUntil) { $("#lkM").textContent = "Try again in " + Math.ceil((lockUntil - Date.now()) / 1000) + " seconds"; return; }
    if (b.dataset.k === "⌫") pin = pin.slice(0, -1); else if (pin.length < len) pin += b.dataset.k;
    dots();
    if (pin.length < len) return;
    if (await pinHash(pin, L.s) === L.h) {
      lockFails = 0;
      box.classList.add("open");
      document.documentElement.classList.remove("locked");
      setTimeout(() => box.remove(), 420);
    } else {
      lockFails++; pin = "";
      const d = $("#lkD"); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake");
      if (lockFails >= 5) { lockUntil = Date.now() + 30000; lockFails = 0; $("#lkM").textContent = "Too many tries. Wait 30 seconds."; }
      else $("#lkM").textContent = "Wrong passcode";
      setTimeout(dots, 350);
    }
  };
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const L = load("mlock", null);
  if (L && hiddenAt && Date.now() - hiddenAt >= (L.after == null ? 60 : L.after) * 1000) showLock();
});
function askPin(title, msg, fn) {
  ask({ title, msg, fields:[{ k:"p", label:"Passcode (4 to 6 digits)", type:"password" }], ok:"Next" }, v => {
    const p = v.p.trim();
    if (!/^\d{4,6}$/.test(p)) { toast("Use 4 to 6 digits"); return false; }
    setTimeout(() => fn(p), 50);
  });
}
function setPasscode() {
  askPin("Set a passcode", "You'll enter it when you open Webs.", p1 => askPin("Enter it again", "", async p2 => {
    if (p1 !== p2) { toast("Those didn't match. Try again."); return; }
    const s = uid();
    save("mlock", { h:await pinHash(p1, s), s, n:p1.length, after:(load("mlock", {}) || {}).after ?? 60 });
    toast("Passcode on"); if ($("#sheet").dataset.kind === "settings") refreshSettings();
  }));
}
SETACTIONS.passcode = () => {
  const L = load("mlock", null);
  if (!L) { setPasscode(); return; }
  const after = L.after == null ? 60 : L.after;
  pick("Passcode lock", [
    { label:"Change passcode", fn:setPasscode },
    { label:"Lock after: " + (after === 0 ? "right away ✓" : "right away"), fn:() => { L.after = 0; save("mlock", L); } },
    { label:"Lock after: " + (after === 60 ? "1 minute ✓" : "1 minute"), fn:() => { L.after = 60; save("mlock", L); } },
    { label:"Lock after: " + (after === 900 ? "15 minutes ✓" : "15 minutes"), fn:() => { L.after = 900; save("mlock", L); } },
    { label:"Turn passcode off", danger:true, fn:() => askPin("Enter your passcode", "", async p => {
      if (await pinHash(p, L.s) !== L.h) { toast("Wrong passcode"); return; }
      localStorage.removeItem("wsb.mlock"); toast("Passcode off"); if ($("#sheet").dataset.kind === "settings") refreshSettings();
    }) }
  ], "Webs asks for it when it opens, and when you come back after the time you choose.");
};

/* ---------------------------------------------------------------- history that deletes itself (cfg.histKeep days) */
function trimHistory() {
  const days = +cfg.histKeep || 0;
  if (!days) return;
  const cut = Date.now() - days * 864e5, h = load("history", []);
  const kept = h.filter(x => x.ts >= cut);
  if (kept.length !== h.length) save("history", kept);
}
setInterval(trimHistory, 3600e3);
SETACTIONS["seg:histKeep"] = () => { trimHistory(); if (+cfg.histKeep) toast("History older than " + (+cfg.histKeep === 1 ? "a day" : +cfg.histKeep + " days") + " is deleted automatically"); };

/* ---------------------------------------------------------------- storage */
const fmtBytes = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1048576).toFixed(1) + " MB";
async function openStorage() {
  const groups = { History:["history", "closed"], Bookmarks:["bookmarks", "mfolders"], "Notes and to-do":["notes", "todo", "ntpNote", "habits", "focus"], "Reading list":["reading"],
    "Tabs":["mtabs", "msessions"], "Remembered answers":["weather", "otd", "potd", "fx", "skyLoc", "calcs", "clips"], Settings:["settings", "tiles", "hidden", "icons", "mach", "mstats", "mdays"] };
  const size = k => { const v = localStorage.getItem("wsb." + k); return v ? (k.length + 4 + v.length) * 2 : 0; };
  const all = Object.keys(localStorage).filter(k => k.startsWith("wsb.")).map(k => k.slice(4));
  const known = new Set([].concat(...Object.values(groups)));
  const rows = Object.keys(groups).map(g => [g, groups[g].reduce((a, k) => a + size(k), 0)]);
  rows.push(["Other", all.filter(k => !known.has(k)).reduce((a, k) => a + size(k), 0)]);
  let pic = 0; try { const b = await idb.get("bg"); if (b) pic = b.size; } catch (e) {}
  if (pic) rows.push(["Background picture", pic]);
  const total = rows.reduce((a, r) => a + r[1], 0) || 1;
  let est = null; try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) {}
  const cols = ["#e8342a", "#ff9f0a", "#34c759", "#30b0c7", "#5e5ce6", "#bf5af2", "#8e8e93", "#ff375f", "#64d2ff"];
  const html = '<div class="stbar">' + rows.filter(r => r[1]).map((r, i) => '<i style="flex:' + r[1] + ";background:" + cols[i % cols.length] + '"></i>').join("") + "</div>" +
    '<div class="card">' + rows.filter(r => r[1]).map((r, i) => '<div class="srow"><span class="dotc" style="background:' + cols[i % cols.length] + '"></span><span class="k">' + esc(r[0]) + '</span><span class="v">' + fmtBytes(r[1]) + "</span></div>").join("") + "</div>" +
    '<p class="note" style="margin:8px 6px 18px">Your data: ' + fmtBytes(total) + (est && est.usage ? " · Webs uses " + fmtBytes(est.usage) + " on this iPhone in all, including the app itself for offline use" : "") + ".</p>" +
    GROUP("Free up space", BTN("stHist", "Clear history…", "", "", "trash") + BTN("stCache", "Forget remembered answers", "Weather, Wikipedia, copy and calculator history") +
      BTN("stClosed", "Forget recently closed tabs") + (cfg.mbg ? BTN("stPic", "Remove background picture") : ""));
  openSheet("Storage", html, { kind:"storage", full:true, back:() => openSettings() });
  $("#sheetBody").onclick = e => {
    const b = e.target.closest("[data-set]"); if (!b) return;
    const k = b.dataset.set;
    if (k === "stHist") clearHistory();
    else if (k === "stCache") { ["weather", "otd", "potd", "fx", "skyLoc", "calcs", "clips"].forEach(x => localStorage.removeItem("wsb." + x)); toast("Done"); openStorage(); }
    else if (k === "stClosed") { save("closed", []); toast("Done"); openStorage(); }
    else if (k === "stPic") { setCfg("mbg", false); idb.del("bg").catch(() => {}); if (bgURL) URL.revokeObjectURL(bgURL); bgURL = ""; afterSetting(); openStorage(); }
  };
}
SETACTIONS.storage = openStorage;

/* ---------------------------------------------------------------- timer alerts and keeping the screen on */
function timerDone(t) {
  if (t.pomo && t.label === "Focus") stat("pomos");
  if (!cfg.notify || !("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  const body = t.pomo ? (t.label === "Focus" ? "Focus round done. Time for a break." : "Break over. Ready for the next round?") : (t.label || "Your " + fmtDur(t.secs) + " timer is done");
  const opts = { body, icon:"icons/icon-192.png", badge:"icons/icon-192.png", tag:"webs-timer", renotify:true };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification("Webs", opts)).catch(() => {});
  else try { new Notification("Webs", opts); } catch (e) {}
}
async function askNotify(on, el, key) {
  if (!on) return;
  if (!("Notification" in window)) {
    setCfg(key, false); if (el) el.checked = false;
    toast(isIOS && !isStandalone() ? "Add Webs to your Home Screen first, then turn this on" : "Notifications aren't available here");
    return;
  }
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (p !== "granted") { setCfg(key, false); if (el) el.checked = false; toast("Webs wasn't allowed to send notifications"); }
  if (key === "badge" && typeof updateBadge === "function") updateBadge();
}
SETACTIONS["sw:notify"] = (on, el) => askNotify(on, el, "notify");
SETACTIONS["sw:badge"] = (on, el) => { if (!on) { if (typeof updateBadge === "function") updateBadge(); return; } askNotify(on, el, "badge"); };

let wake = null;
async function keepAwake() {
  const want = cfg.awake !== false && !document.hidden && load("timers", []).some(t => t.end > Date.now());
  if (want && !wake && navigator.wakeLock) {
    try { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } catch (e) { wake = null; }
  } else if (!want && wake) { wake.release().catch(() => {}); wake = null; }
}
setInterval(keepAwake, 4000);
document.addEventListener("visibilitychange", keepAwake);

/* ---------------------------------------------------------------- page info, and a rule for each site */
function openPageInfo() {
  const t = curTab(); if (!t || !t.u || t.internal) return;
  const host = hostOf(t.u), rule = (cfg.siteRules || {})[host] || "", visits = load("history", []).filter(h => hostOf(h.u) === host).length;
  const html = '<div class="pihead">' + favHTML(t.u, t.t, "pifav") + "<div><b>" + esc(t.t || host) + "</b><span>" + esc(host) + "</span></div></div>" +
    '<div class="card">' +
    '<button type="button" class="srow btn" data-pi="copy"><span class="k">Address<i class="brk">' + esc(t.u) + "</i></span>" + ico("copy") + "</button>" +
    ROW("Connection", '<span class="v ' + (/^https:/.test(t.u) ? "ok" : "") + '">' + (/^https:/.test(t.u) ? "🔒 Secure (HTTPS)" : "Not secure") + "</span>") +
    ROW("Shown", '<span class="v">Inside Webs' + (/youtube|vimeo|spotify/.test(t.src || "") ? " (player)" : /\.m\.wikipedia\.org/.test(t.src || "") ? " (mobile page)" : "") + "</span>") +
    (t.seen ? ROW("Opened", '<span class="v">' + esc(ago(t.seen)) + "</span>") : "") +
    ROW("Visits to this site", '<span class="v">' + visits + "</span>") + "</div>" +
    '<div class="group" style="margin-top:18px"><h3>Open ' + esc(host) + "</h3>" + '<div class="seg" id="piRule">' + [["", "Automatic"], ["inside", "In Webs"], ["outside", "In Safari"]].map(([v, l]) =>
      '<button type="button" data-v="' + v + '" class="' + (rule === v ? "on" : "") + '">' + l + "</button>").join("") + '</div><p class="note">A rule for just this site. You can see all of them in Settings → Opening websites.</p></div>' +
    '<div class="acts"><button type="button" class="btnx" data-pi="qr">' + ico("qr") + 'QR code</button><button type="button" class="btnx" data-pi="share">' + ico("share") +
    'Share</button><button type="button" class="btnx" data-pi="safari">' + ico("other") + 'Open in Safari</button><button type="button" class="btnx" data-pi="forget">' + ico("trash") + "Forget this site</button></div>";
  openSheet("Page info", html, { kind:"pageinfo" });
  $("#sheetBody").onclick = e => {
    const r = e.target.closest("#piRule button");
    if (r) {
      const rules = Object.assign({}, cfg.siteRules || {});
      if (r.dataset.v) rules[host] = r.dataset.v; else delete rules[host];
      setCfg("siteRules", rules);
      $$("#piRule button").forEach(b => b.classList.toggle("on", b === r));
      toast(r.dataset.v === "inside" ? host + " opens inside Webs from now on" : r.dataset.v === "outside" ? host + " opens in Safari from now on" : "Back to automatic for " + host);
      return;
    }
    const b = e.target.closest("[data-pi]"); if (!b) return;
    const k = b.dataset.pi;
    if (k === "copy") copyText(t.u);
    else if (k === "qr") openTool("qr", t.u);
    else if (k === "share") ACTIONS.share();
    else if (k === "safari") { closeSheet(); openOut(t.u); }
    else if (k === "forget") forgetSite(host);
  };
}
function openRules() {
  const r = cfg.siteRules || {}, ks = Object.keys(r).sort();
  openSheet("Rules for single sites", (ks.length ? '<div class="card">' + ks.map(h => '<div class="srow"><span class="fav2">' + favHTML("https://" + h + "/", h) + '</span><span class="k">' + esc(h) + "<i>" +
    (r[h] === "inside" ? "Inside Webs" : "In Safari") + '</i></span><button type="button" class="hbtn plain" data-rdel="' + esc(h) + '">Remove</button></div>').join("") + "</div>"
    : '<div class="empty">' + ico("world") + "No rules yet. Open a page, then Menu → Page info to choose how that site opens.</div>") +
    '<div class="acts"><button type="button" class="btnx" id="ruleAdd">' + ico("plus") + "Add a rule</button></div>", { kind:"rules", full:true, back:() => openSettings() });
  $("#sheetBody").onclick = e => {
    const d = e.target.closest("[data-rdel]");
    if (d) { const x = Object.assign({}, cfg.siteRules); delete x[d.dataset.rdel]; setCfg("siteRules", x); openRules(); return; }
    if (e.target.closest("#ruleAdd")) ask({ title:"Add a rule", fields:[{ k:"h", label:"Website", ph:"example.com", type:"url" }], ok:"Next" }, v => {
      const h = hostOf(/^https?:/.test(v.h.trim()) ? v.h.trim() : "https://" + v.h.trim());
      if (!h) { toast("That doesn't look like a website"); return false; }
      setTimeout(() => pick("Open " + h, [{ label:"Inside Webs", fn:() => { setCfg("siteRules", Object.assign({}, cfg.siteRules, { [h]:"inside" })); openRules(); } },
        { label:"In Safari", fn:() => { setCfg("siteRules", Object.assign({}, cfg.siteRules, { [h]:"outside" })); openRules(); } }]), 50);
    });
  };
}
SETACTIONS.siteRules = openRules;

/* ---------------------------------------------------------------- full screen */
function setFull(on) {
  document.body.classList.toggle("fs", on);
  $("#fsExit").classList.toggle("hide", !on);
  if (on) toast("Full screen. Tap the arrows at the top to leave.");
}
$("#fsExit").innerHTML = ico("expand");
$("#fsExit").onclick = () => setFull(false);
RENDER_HOOKS.push(web => { if (!web && document.body.classList.contains("fs")) setFull(false); });

/* ---------------------------------------------------------------- reader view for Wikipedia articles */
const READ_TAGS = new Set(["P", "H2", "H3", "H4", "UL", "OL", "LI", "B", "STRONG", "I", "EM", "A", "BLOCKQUOTE", "FIGURE", "FIGCAPTION", "IMG", "BR", "DL", "DT", "DD", "SUB", "SUP", "CODE", "PRE", "SPAN", "SECTION", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH", "CAPTION"]);
function cleanArticle(html, lang) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,link,meta,noscript,.mw-ref,sup.reference,.reference,.navbox,.metadata,.hatnote,.mw-editsection,.ambox,.sistersitebox,.reflist,.references,.mw-references-wrap,.noprint,.infobox,.sidebar,.vertical-navbox,.thumbcaption .magnify,math,svg,.mwe-math-element")
    .forEach(n => n.remove());
  doc.querySelectorAll("table:not(.wikitable)").forEach(n => n.remove());
  // drop the sections nobody reads on a phone
  doc.querySelectorAll("section").forEach(s => { const h = s.querySelector("h2"); if (h && /^(references|notes|external links|further reading|sources|citations|bibliography|footnotes)$/i.test(h.textContent.trim())) s.remove(); });
  const walk = el => {
    [...el.children].forEach(c => {
      if (!READ_TAGS.has(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); return; }
      const keep = {};
      if (c.tagName === "A") {
        let h = c.getAttribute("href") || "";
        if (/^\.\//.test(h)) h = "https://" + lang + ".wikipedia.org/wiki/" + h.slice(2);
        else if (/^\/\//.test(h)) h = "https:" + h;
        if (/^https?:\/\//.test(h)) keep.href = h;
      } else if (c.tagName === "IMG") {
        let s = c.getAttribute("src") || "";
        if (/^\/\//.test(s)) s = "https:" + s;
        if (/^https:\/\/upload\.wikimedia\.org\//.test(s)) { keep.src = s; keep.alt = c.getAttribute("alt") || ""; keep.loading = "lazy"; }
        else { c.remove(); return; }
      }
      [...c.attributes].forEach(a => c.removeAttribute(a.name));
      Object.keys(keep).forEach(k => c.setAttribute(k, keep[k]));
      walk(c);
    });
  };
  walk(doc.body);
  doc.querySelectorAll("p,li").forEach(n => { if (!n.textContent.trim() && !n.querySelector("img")) n.remove(); });
  return doc.body.innerHTML;
}
async function openReader(u) {
  const t = curTab();
  u = u || (t && t.u);
  const m = /^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/.exec(u || "");
  if (!m) { toast("Reader view works with Wikipedia articles"); return; }
  const lang = m[1], title = decodeURIComponent(m[2]);
  const size = +cfg.readerSize || 18;
  openSheet(title.replace(/_/g, " "), '<div class="rbar"><button type="button" class="wbtn" data-rs="-1">A−</button><button type="button" class="wbtn" data-rs="1">A+</button><button type="button" class="wbtn" data-rt="1">' +
    (cfg.readerSepia ? "Normal" : "Sepia") + '</button><button type="button" class="wbtn" data-ro="1">' + ico("other") + '</button></div><article id="rd" class="reader' + (cfg.readerSepia ? " sepia" : "") + '" style="font-size:' + size + 'px">' +
    '<div class="skel3"><i></i><i></i><i></i><i></i><i></i></div></article>', { kind:"reader", full:true });
  $("#sheetBody").onclick = e => {
    const rs = e.target.closest("[data-rs]");
    if (rs) { const v = Math.max(14, Math.min(28, (+cfg.readerSize || 18) + 2 * rs.dataset.rs)); setCfg("readerSize", v); $("#rd").style.fontSize = v + "px"; return; }
    if (e.target.closest("[data-rt]")) { setCfg("readerSepia", !cfg.readerSepia); $("#rd").classList.toggle("sepia", !!cfg.readerSepia); e.target.closest("[data-rt]").textContent = cfg.readerSepia ? "Normal" : "Sepia"; return; }
    if (e.target.closest("[data-ro]")) { closeSheet(); go({ u }); return; }
    const a = e.target.closest("#rd a[href]");
    if (a) { e.preventDefault(); const h = a.getAttribute("href"); if (/wikipedia\.org\/wiki\/[^:]+$/.test(h)) openReader(h); else go({ u:h }); }
  };
  try {
    const r = await fetch("https://" + lang + ".wikipedia.org/api/rest_v1/page/html/" + encodeURIComponent(title));
    if (!r.ok) throw new Error(r.status);
    const html = cleanArticle(await r.text(), lang);
    if ($("#rd")) { $("#rd").innerHTML = "<h1>" + esc(title.replace(/_/g, " ")) + "</h1>" + html; $("#sheetBody").scrollTop = 0; }
    if (!PRIVATE) record("https://" + lang + ".wikipedia.org/wiki/" + m[2], title.replace(/_/g, " ") + " - Wikipedia");
  } catch (e) { if ($("#rd")) $("#rd").innerHTML = '<div class="empty">' + ico("book") + "This article couldn't be loaded. Check your connection.</div>"; }
}

/* ---------------------------------------------------------------- swipe the address bar to switch tabs */
(function swipeBar() {
  const a = $("#addr");
  let x0 = null, y0 = 0, moved = false;
  a.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; moved = false; }, { passive:true });
  a.addEventListener("touchmove", e => {
    if (x0 == null) return;
    const dx = e.touches[0].clientX - x0;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.touches[0].clientY - y0)) { moved = true; a.style.transform = "translateX(" + dx * .35 + "px)"; a.style.transition = "none"; }
  }, { passive:true });
  a.addEventListener("touchend", e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    a.style.transition = ""; a.style.transform = "";
    if (!moved || Math.abs(dx) < 60) return;
    const l = S().list, i = l.findIndex(t => t.id === S().active), j = i + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= l.length) { a.classList.remove("nudge"); void a.offsetWidth; a.classList.add("nudge"); return; }
    a.classList.remove("swl", "swr"); void a.offsetWidth; a.classList.add(dx < 0 ? "swl" : "swr");
    activate(l[j].id);
  });
  a.addEventListener("click", e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
})();

/* ---------------------------------------------------------------- keyboard shortcuts (iPad with a keyboard) */
function openKeys() {
  const K = [["⌘ L", "Address bar"], ["⌘ T", "New tab"], ["⌘ W", "Close tab"], ["⌘ ⇧ T", "Reopen closed tab"], ["⌘ ⇧ N", "Private browsing"], ["⌘ 1 – 9", "Go to a tab"],
    ["⌘ [   ⌘ ]", "Back and forward"], ["⌘ R", "Reload"], ["⌘ D", "Bookmark this page"], ["⌘ K", "Search everything"], ["⌘ ,", "Settings"], ["/", "Search"], ["?", "This list"], ["Esc", "Close"]];
  openSheet("Keyboard shortcuts", '<div class="card">' + K.map(([k, l]) => '<div class="srow"><span class="k">' + esc(l) + '</span><kbd>' + esc(k) + "</kbd></div>").join("") + "</div>", { kind:"keys" });
}

/* ---------------------------------------------------------------- into the menu */
Object.assign(ACTIONS, {
  pageinfo:openPageInfo,
  pageqr:() => { const t = curTab(); if (t && t.u) openTool("qr", t.u); },
  fullscreen:() => { closeSheet(); setFull(true); },
  reader:() => openReader(),
  keys:openKeys
});
// the passcode screen comes first
showLock();
trimHistory();
