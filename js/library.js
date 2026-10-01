/* Webs Browser for iPhone - the library and notes.
   Bookmarks (with folders, editing, and import and export in the HTML format
   every browser uses), history (by time or by site, and forgetting a site),
   the reading list, notes (with checklists, pins, colors, search and export),
   plus Search everything, Insights, Achievements and Copy history.
   Bookmarks are { u, t, ts, f } - f is the folder - and notes are
   { id, title, text, ts, site, pin, color, list }, the Windows format with a
   few extra fields it simply ignores. */
"use strict";

/* ---------------------------------------------------------------- small helpers */
function saveFile(blob, name, done) {
  const file = new File([blob], name, { type:blob.type || "application/octet-stream" });
  if (navigator.canShare && navigator.canShare({ files:[file] })) {
    navigator.share({ files:[file], title:name }).catch(e => { if (e && e.name !== "AbortError") dl(); });
  } else dl();
  function dl() {
    const a = Object.assign(document.createElement("a"), { href:URL.createObjectURL(file), download:name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    if (done) toast(done);
  }
}
// Press and hold a row for its menu.
function holdRows(box, sel, fn) {
  let t0 = 0, at = null;
  box.addEventListener("pointerdown", e => {
    const r = e.target.closest(sel); if (!r || e.target.closest("[data-x]")) return;
    at = [e.clientX, e.clientY]; box.dataset.held = "";
    t0 = setTimeout(() => { box.dataset.held = "1"; r.classList.add("lifted"); setTimeout(() => r.classList.remove("lifted"), 350); fn(r); }, 500);
  });
  const stop = () => clearTimeout(t0);
  box.addEventListener("pointerup", stop); box.addEventListener("pointercancel", stop);
  box.addEventListener("pointermove", e => { if (at && Math.hypot(e.clientX - at[0], e.clientY - at[1]) > 10) stop(); });
  box.addEventListener("contextmenu", e => { if (e.target.closest(sel)) e.preventDefault(); });
  box.addEventListener("click", e => { if (box.dataset.held) { e.stopPropagation(); e.preventDefault(); box.dataset.held = ""; } }, true);
}
// Swipe a row to the left to delete it.
function swipeRows(box, sel, fn) {
  let row = null, x0 = 0, y0 = 0, dx = 0, lock = "";
  box.addEventListener("touchstart", e => { row = e.target.closest(sel); if (!row) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = ""; }, { passive:true });
  box.addEventListener("touchmove", e => {
    if (!row) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!lock) lock = Math.abs(mx) > Math.abs(my) + 6 ? "x" : Math.abs(my) > 8 ? "y" : "";
    if (lock !== "x") return;
    dx = Math.min(0, mx);
    row.style.transition = "none"; row.style.transform = "translateX(" + dx + "px)";
    row.classList.toggle("swiping", dx < -20); row.classList.toggle("armed", dx < -90);
  }, { passive:true });
  box.addEventListener("touchend", () => {
    if (!row) return;
    const r = row; row = null;
    r.style.transition = "";
    if (lock === "x" && dx < -90) { r.style.transform = "translateX(-110%)"; r.style.opacity = "0"; setTimeout(() => fn(r), 180); }
    else { r.style.transform = ""; r.classList.remove("swiping", "armed"); }
  });
}
const stat = (k, n) => { if (PRIVATE) return; const s = load("mstats", {}); s[k] = (s[k] || 0) + (n || 1); save("mstats", s); checkAch(); };

/* ---------------------------------------------------------------- the library */
let libKind = "bookmarks", libQ = "", libFolder = "", libSite = "", libHist = "time", libReadAll = false;
function openLibrary(kind) {
  libKind = kind; libQ = ""; libFolder = ""; libSite = "";
  openSheet("Library", '<div class="seg" id="libSeg"><button type="button" data-v="bookmarks">Bookmarks</button><button type="button" data-v="history">History</button>' +
    '<button type="button" data-v="reading">Reading list</button></div><div class="search">' + ico("glass") +
    '<input type="search" id="libQ" placeholder="Search" autocomplete="off" autocapitalize="off" enterkeyhint="search"></div><div id="libList"></div>', { kind:"lib", full:true });
  $("#libSeg").onclick = e => { const b = e.target.closest("button"); if (b) { libKind = b.dataset.v; libFolder = ""; libSite = ""; renderLib(true); } };
  $("#libQ").oninput = e => { libQ = e.target.value.trim().toLowerCase(); renderLib(); };
  const box = $("#libList");
  box.onclick = libClick;
  holdRows(box, ".row[data-u]", rowMenu);
  swipeRows(box, ".row[data-u]", r => deleteRow(r));
  renderLib();
}
function dayLabel(ts) {
  const d = new Date(ts), now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((a - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric", year:d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
const emptyBox = (icon, text) => '<div class="empty">' + ico(icon) + esc(text) + "</div>";
const libMatch = x => !libQ || (x.t || "").toLowerCase().includes(libQ) || (x.u || "").toLowerCase().includes(libQ) || (x.f || "").toLowerCase().includes(libQ);
function folders() {
  const set = new Set(load("mfolders", []));
  load("bookmarks", []).forEach(b => { if (b.f) set.add(b.f); });
  return [...set].sort((a, b) => a.localeCompare(b));
}
function renderLib(animate) {
  $$("#libSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === libKind));
  const box = $("#libList");
  box.innerHTML = libKind === "history" ? histHTML() : libKind === "bookmarks" ? bmHTML() : readHTML();
  if (animate && typeof stagger === "function") stagger(box, 10, 30);
}
function bmHTML() {
  const all = load("bookmarks", []);
  const row = b => rowHTML({ u:b.u, t:b.t, x:1, sub:hostOf(b.u) + (b.f && (libQ || !libFolder) ? " · " + b.f : "") });
  if (libQ) { const l = all.filter(libMatch); return l.length ? '<div class="card">' + l.map(row).join("") + "</div>" : emptyBox("star", "No bookmarks match."); }
  const acts = (extra) => '<div class="acts"><button type="button" class="btnx" id="bmAdd">' + ico("plus") + "Add bookmark</button>" + extra + "</div>";
  if (libFolder) {
    const l = all.filter(b => b.f === libFolder);
    return '<button type="button" class="row up" data-fold="">' + ico("back") + "<span>All bookmarks</span></button><h4 class=\"fhead\">" + ico("folder") + esc(libFolder) + "</h4>" +
      (l.length ? '<div class="card">' + l.map(row).join("") + "</div>" : emptyBox("folder", "Nothing in this folder yet. Move bookmarks here by pressing and holding them.")) +
      acts('<button type="button" class="btnx" id="fRename">' + ico("edit") + 'Rename</button><button type="button" class="btnx" id="fDelete">' + ico("trash") + "Delete folder</button>");
  }
  const fl = folders(), loose = all.filter(b => !b.f);
  return (fl.length ? '<div class="card">' + fl.map(f => { const n = all.filter(b => b.f === f).length;
      return '<button type="button" class="row" data-fold="' + esc(f) + '"><span class="fav fold">' + ico("folder") + '</span><span class="tx"><b>' + esc(f) + "</b><i>" + n + (n === 1 ? " bookmark" : " bookmarks") +
        '</i></span><span class="end">' + ico("right") + "</span></button>"; }).join("") + "</div>" : "") +
    (loose.length ? '<div class="card">' + loose.map(row).join("") + "</div>" : fl.length ? "" : emptyBox("star", "Tap Bookmark in the menu while a page is open, or add one here.")) +
    acts('<button type="button" class="btnx" id="fNew">' + ico("folder") + "New folder</button>") +
    '<div class="acts"><button type="button" class="btnx" id="bmImp">' + ico("ul") + 'Import</button><button type="button" class="btnx" id="bmExp">' + ico("share") + "Export</button></div>";
}
function histHTML() {
  const hist = load("history", []);
  const chips = '<div class="chips"><button type="button" data-hmode="time" class="' + (libHist === "time" || libSite ? "on" : "") + '">' + ico("clock") + 'By time</button><button type="button" data-hmode="site" class="' +
    (libHist === "site" && !libSite ? "on" : "") + '">' + ico("world") + "By site</button></div>";
  if (!hist.length) return emptyBox("history", PRIVATE ? "Private tabs don't keep history." : "Pages you open will be listed here.");
  if (libHist === "site" && !libSite && !libQ) {
    const m = new Map();
    hist.forEach(h => { const host = hostOf(h.u); if (!host) return; const e = m.get(host) || { host, n:0, ts:0 }; e.n++; e.ts = Math.max(e.ts, h.ts); m.set(host, e); });
    const list = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 200);
    return chips + '<div class="card">' + list.map(e => '<button type="button" class="row" data-site="' + esc(e.host) + '"><span class="fav">' + favHTML("https://" + e.host + "/", e.host) +
      '</span><span class="tx"><b>' + esc(e.host) + "</b><i>" + e.n + (e.n === 1 ? " visit" : " visits") + " · " + esc(ago(e.ts)) + '</i></span><span class="end">' + ico("right") + "</span></button>").join("") + "</div>";
  }
  const list = hist.filter(h => libMatch(h) && (!libSite || hostOf(h.u) === libSite)).slice(0, libQ || libSite ? 400 : 250);
  let html = libSite ? '<button type="button" class="row up" data-site="">' + ico("back") + "<span>All sites</span></button><h4 class=\"fhead\">" + favHTML("https://" + libSite + "/", libSite) + esc(libSite) + "</h4>" +
    '<div class="acts" style="margin:0 0 12px"><button type="button" class="btnx" id="siteForget">' + ico("trash") + "Forget this site</button></div>" : chips;
  let day = "";
  list.forEach(h => {
    const d = dayLabel(h.ts);
    if (d !== day) { html += (day ? "</div>" : "") + '<div class="day">' + esc(d) + '</div><div class="card">'; day = d; }
    const s = searchOf(h.u);
    html += rowHTML({ u:h.u, t:s ? s.q : h.t, sub:(s ? "Search · " + s.e.name : hostOf(h.u)), end:new Date(h.ts).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }),
                      icon:s ? "glass" : "", x:1, data:' data-ts="' + h.ts + '"' });
  });
  if (day) html += "</div>";
  else html += emptyBox("history", "Nothing in your history matches.");
  if (!libQ && !libSite) html += '<div class="acts"><button type="button" class="btnx" id="histClear">' + ico("trash") + "Clear history…</button></div>";
  return html;
}
function readHTML() {
  const all = load("reading", []).slice().reverse(), unread = all.filter(r => !r.done).length;
  const list = all.filter(libMatch).filter(r => libReadAll || libQ || !r.done);
  return '<div class="chips"><button type="button" data-rmode="0" class="' + (!libReadAll ? "on" : "") + '">Unread · ' + unread + '</button><button type="button" data-rmode="1" class="' +
    (libReadAll ? "on" : "") + '">All · ' + all.length + "</button></div>" +
    (list.length ? '<div class="card">' + list.map(r => rowHTML({ u:r.u, t:r.t, sub:(r.done ? "Read · " : "") + hostOf(r.u), x:1, data:r.done ? ' data-done="1"' : "" })).join("") + "</div>"
                 : emptyBox("read", all.length ? "You're all caught up." : "Save pages to read later from the menu."));
}
function deleteRow(r) {
  const u = r.dataset.u;
  if (libKind === "history") save("history", load("history", []).filter(h => !(h.u === u && String(h.ts) === r.dataset.ts)));
  else if (libKind === "bookmarks") {
    const old = load("bookmarks", []);
    save("bookmarks", old.filter(b => b.u !== u));
    toast("Bookmark removed", { label:"Undo", fn:() => { save("bookmarks", old); if ($("#libList")) renderLib(); } });
  } else {
    const old = load("reading", []);
    save("reading", old.filter(x => x.u !== u));
    toast("Removed from your reading list", { label:"Undo", fn:() => { save("reading", old); if ($("#libList")) renderLib(); } });
  }
  renderLib();
}
function editBookmark(b) {
  ask({ title:"Edit bookmark", fields:[{ k:"t", label:"Name", value:b.t }, { k:"u", label:"Address", value:b.u, type:"url" }, { k:"f", label:"Folder", value:b.f || "", ph:"None", list:folders() }], ok:"Save" }, v => {
    let u = v.u.trim(); if (!u) return false;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { new URL(u); } catch (x) { toast("That address doesn't look right"); return false; }
    const all = load("bookmarks", []), i = all.findIndex(x => x.u === b.u);
    const nb = Object.assign({}, all[i] || b, { u, t:v.t.trim() || hostOf(u), f:v.f.trim().slice(0, 40) || undefined });
    const rest = all.filter(x => x.u !== b.u && x.u !== u);
    rest.splice(i < 0 ? 0 : Math.min(i, rest.length), 0, nb);
    save("bookmarks", rest); renderLib();
  });
}
function rowMenu(r) {
  const u = r.dataset.u;
  if (libKind === "bookmarks") {
    const b = load("bookmarks", []).find(x => x.u === u); if (!b) return;
    pick(b.t || hostOf(u), [
      { label:"Open", fn:() => go({ u }) },
      { label:"Open inside Webs in a new tab", fn:() => go({ u }, { mode:"inside", newTab:true }) },
      { label:"Edit", fn:() => editBookmark(b) },
      { label:"Move to a folder", fn:() => pick("Move to", [{ label:"No folder", fn:() => moveTo(u, "") }].concat(folders().map(f => ({ label:f, fn:() => moveTo(u, f) })))
        .concat([{ label:"New folder…", fn:() => ask({ title:"New folder", fields:[{ k:"n", label:"Name" }], ok:"Create" }, v => { if (!v.n.trim()) return false; moveTo(u, v.n.trim().slice(0, 40)); }) }])) },
      { label:"Copy link", fn:() => copyText(u) },
      { label:"Delete", danger:true, fn:() => deleteRow(r) }
    ]);
  } else if (libKind === "reading") {
    const it = load("reading", []).find(x => x.u === u); if (!it) return;
    pick(it.t || hostOf(u), [
      { label:it.done ? "Mark as unread" : "Mark as read", fn:() => { save("reading", load("reading", []).map(x => x.u === u ? Object.assign(x, { done:!it.done }) : x)); renderLib(); updateBadge(); } },
      { label:"Copy link", fn:() => copyText(u) },
      { label:"Remove", danger:true, fn:() => deleteRow(r) }
    ]);
  } else {
    pick(hostOf(u), [
      { label:"Open", fn:() => go({ u }) },
      { label:"Copy link", fn:() => copyText(u) },
      { label:"Show all from " + hostOf(u), fn:() => { libSite = hostOf(u); renderLib(); } },
      { label:"Forget " + hostOf(u), danger:true, fn:() => forgetSite(hostOf(u)) }
    ]);
  }
}
function moveTo(u, f) {
  save("bookmarks", load("bookmarks", []).map(b => b.u === u ? Object.assign(b, { f:f || undefined }) : b));
  if (f) save("mfolders", [...new Set(load("mfolders", []).concat([f]))]);
  renderLib(); toast(f ? "Moved to " + f : "Moved out of the folder");
}
function forgetSite(host) {
  pick("Forget " + host + "?", [{ label:"Forget this site", danger:true, fn:() => {
    const n = load("history", []).filter(h => hostOf(h.u) === host).length;
    save("history", load("history", []).filter(h => hostOf(h.u) !== host));
    save("closed", load("closed", []).filter(h => hostOf(h.u) !== host));
    libSite = ""; renderLib(); toast("Removed " + n + " visit" + (n === 1 ? "" : "s") + " to " + host);
  } }], "Every visit to " + host + " is removed from your history.");
}
function libClick(e) {
  const t = e.target;
  if (t.closest("#histClear")) { clearHistory(); return; }
  if (t.closest("#siteForget")) { forgetSite(libSite); return; }
  const hm = t.closest("[data-hmode]"); if (hm) { libHist = hm.dataset.hmode; libSite = ""; renderLib(true); return; }
  const rm = t.closest("[data-rmode]"); if (rm) { libReadAll = rm.dataset.rmode === "1"; renderLib(true); return; }
  const fo = t.closest("[data-fold]"); if (fo) { libFolder = fo.dataset.fold; renderLib(true); return; }
  const si = t.closest("[data-site]"); if (si) { libSite = si.dataset.site; renderLib(true); return; }
  if (t.closest("#bmImp")) { importBookmarks(); return; }
  if (t.closest("#bmExp")) { exportBookmarks(); return; }
  if (t.closest("#fNew")) {
    ask({ title:"New folder", fields:[{ k:"n", label:"Name", ph:"e.g. School" }], ok:"Create" }, v => {
      const n = v.n.trim().slice(0, 40); if (!n) return false;
      save("mfolders", [...new Set(load("mfolders", []).concat([n]))]); libFolder = n; renderLib(true);
    });
    return;
  }
  if (t.closest("#fRename")) {
    const old = libFolder;
    ask({ title:"Rename folder", fields:[{ k:"n", label:"Name", value:old }], ok:"Save" }, v => {
      const n = v.n.trim().slice(0, 40); if (!n) return false;
      save("bookmarks", load("bookmarks", []).map(b => b.f === old ? Object.assign(b, { f:n }) : b));
      save("mfolders", [...new Set(load("mfolders", []).map(f => f === old ? n : f))]); libFolder = n; renderLib();
    });
    return;
  }
  if (t.closest("#fDelete")) {
    const old = libFolder;
    pick("Delete the folder “" + old + "”?", [{ label:"Delete folder", danger:true, fn:() => {
      save("bookmarks", load("bookmarks", []).map(b => b.f === old ? Object.assign(b, { f:undefined }) : b));
      save("mfolders", load("mfolders", []).filter(f => f !== old)); libFolder = ""; renderLib();
    } }], "Its bookmarks are kept and move out of the folder.");
    return;
  }
  if (t.closest("#bmAdd")) {
    ask({ title:"Add bookmark", fields:[{ k:"t", label:"Name", ph:"Optional" }, { k:"u", label:"Address", ph:"example.com", type:"url" },
      { k:"f", label:"Folder", value:libFolder, ph:"None", list:folders() }], ok:"Add" }, v => {
      let u = v.u.trim(); if (!u) return false;
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      try { new URL(u); } catch (x) { toast("That address doesn't look right"); return false; }
      const list = load("bookmarks", []).filter(b => b.u !== u);
      list.unshift({ u, t:v.t.trim() || hostOf(u), ts:Date.now(), f:v.f.trim().slice(0, 40) || undefined }); save("bookmarks", list); renderLib(); checkAch();
    });
    return;
  }
  const r = t.closest(".row[data-u]");
  if (!r) return;
  if (t.closest("[data-x]")) { const row = r; row.classList.add("leaving"); setTimeout(() => deleteRow(row), 160); return; }
  if (libKind === "reading") { markRead(r.dataset.u); stat("readDone"); }
  go({ u:r.dataset.u });
}
function clearHistory() {
  const cut = ms => { const t = Date.now() - ms; save("history", load("history", []).filter(h => h.ts < t)); if ($("#libList")) renderLib(); toast("History cleared"); };
  pick("Clear history", [
    { label:"The last hour", fn:() => cut(3600e3) },
    { label:"Today", fn:() => { const d = new Date(); cut(Date.now() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()); } },
    { label:"Everything", danger:true, fn:() => { save("history", []); save("closed", []); save("weather", null); if ($("#libList")) renderLib(); toast("History cleared"); } }
  ]);
}

/* bookmarks in the HTML format Chrome, Safari, Edge and Firefox all import and export */
const TOP_FOLDERS = /^(bookmarks( bar| toolbar| menu)?|favorites( bar)?|other bookmarks|mobile bookmarks|favourites)$/i;
function importBookmarks() {
  pickFile(".html,.htm,text/html", async f => {
    let doc;
    try { doc = new DOMParser().parseFromString(await f.text(), "text/html"); } catch (e) { toast("That file couldn't be read"); return; }
    const mine = load("bookmarks", []), have = new Set(mine.map(b => b.u)), add = [];
    doc.querySelectorAll("a[href]").forEach(a => {
      const u = a.getAttribute("href");
      if (!/^https?:\/\//i.test(u) || have.has(u)) return;
      let dl = a.closest("dl"), name = "";
      while (dl && !name) {
        const h = dl.previousElementSibling && /^H3$/i.test(dl.previousElementSibling.tagName) ? dl.previousElementSibling : dl.parentElement && dl.parentElement.querySelector(":scope > h3");
        if (h) name = h.textContent.trim();
        else break;
      }
      if (TOP_FOLDERS.test(name)) name = "";
      have.add(u);
      add.push({ u, t:(a.textContent || "").trim().slice(0, 200) || hostOf(u), ts:(+a.getAttribute("add_date") || 0) * 1000 || Date.now(), f:name.slice(0, 40) || undefined });
    });
    if (!add.length) { toast("No new bookmarks in that file"); return; }
    save("bookmarks", mine.concat(add));
    if ($("#libList")) renderLib();
    toast("Imported " + add.length + " bookmark" + (add.length === 1 ? "" : "s"));
    checkAch();
  });
}
function exportBookmarks() {
  const all = load("bookmarks", []);
  if (!all.length) { toast("No bookmarks to export yet"); return; }
  const a = b => '<DT><A HREF="' + esc(b.u) + '" ADD_DATE="' + Math.floor((b.ts || Date.now()) / 1000) + '">' + esc(b.t || hostOf(b.u)) + "</A>\n";
  let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  folders().forEach(f => { const l = all.filter(b => b.f === f); if (l.length) html += "<DT><H3>" + esc(f) + "</H3>\n<DL><p>\n" + l.map(a).join("") + "</DL><p>\n"; });
  html += all.filter(b => !b.f).map(a).join("") + "</DL><p>\n";
  saveFile(new Blob([html], { type:"text/html" }), "Webs bookmarks " + new Date().toISOString().slice(0, 10) + ".html", "Bookmarks exported");
}
SETACTIONS.bmImport = importBookmarks;
SETACTIONS.bmExport = exportBookmarks;

/* ---------------------------------------------------------------- notes */
let noteId = null, noteT = 0, noteQ = "";
const NOTE_COLORS = [["", "None"], ["#e8342a", "Red"], ["#ff7a1a", "Orange"], ["#e0a100", "Yellow"], ["#2fa35f", "Green"], ["#1f9bd1", "Blue"], ["#8a5cf5", "Purple"]];
const noteTitle = n => n.title || (n.text || "").replace(/^- \[[ x]\] /, "").split("\n")[0] || "Untitled";
const wordsIn = s => (String(s || "").replace(/^- \[[ x]\] /gm, "").match(/\S+/g) || []).length;
function openNotes() {
  noteId = null; noteQ = "";
  openSheet("Notes", '<div class="search">' + ico("glass") + '<input type="search" id="noteQ" placeholder="Search notes" autocomplete="off" enterkeyhint="search"></div>' +
    '<div class="acts" style="margin:0 0 14px"><button type="button" class="btnx m" id="noteNew">' + ico("plus") + 'New note</button><button type="button" class="btnx" id="listNew">' +
    ico("list") + 'New checklist</button></div><div id="noteList"></div>', { kind:"notes", full:true });
  $("#noteQ").oninput = e => { noteQ = e.target.value.trim().toLowerCase(); renderNotes(); };
  const make = list => { const n = { id:uid(), title:"", text:list ? "- [ ] " : "", ts:Date.now(), site:"", list:list || undefined }; const all = load("notes", []); all.push(n); save("notes", all); openNote(n.id); };
  $("#noteNew").onclick = () => make(false);
  $("#listNew").onclick = () => make(true);
  const box = $("#noteList");
  box.onclick = e => { const r = e.target.closest("[data-note]"); if (r) openNote(r.dataset.note); };
  holdRows(box, "[data-note]", r => noteMenu(r.dataset.note, renderNotes));
  renderNotes();
}
function renderNotes() {
  const all = load("notes", []);
  const list = all.filter(n => !noteQ || (n.title || "").toLowerCase().includes(noteQ) || (n.text || "").toLowerCase().includes(noteQ))
    .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
  $("#noteList").innerHTML = list.length ? '<div class="card">' + list.map(n => {
    const items = n.list ? (n.text || "").split("\n").filter(l => /^- \[[ x]\]/.test(l)) : null;
    const sub = n.list ? items.filter(l => /^- \[x\]/.test(l)).length + " of " + items.length + " done" : ((n.text || "").replace(/\s+/g, " ").slice(0, 70) || "Empty");
    return '<button type="button" class="row nrow" data-note="' + esc(n.id) + '"' + (n.color ? ' style="--nc:' + esc(n.color) + '"' : "") + '><span class="fav">' + ico(n.list ? "list" : "note") +
      '</span><span class="tx"><b>' + (n.pin ? '<em class="npin">📌</em>' : "") + esc(noteTitle(n)) + "</b><i>" + esc(new Date(n.ts || Date.now()).toLocaleDateString([], { month:"short", day:"numeric" }) +
      " · " + wordsIn(n.text) + " words · " + sub) + "</i></span></button>";
  }).join("") + "</div>" : all.length ? emptyBox("glass", "No notes match.") : emptyBox("note", "Jot things down here. Notes stay on this iPhone and come along in backups.");
}
function noteMenu(id, after) {
  const all = load("notes", []), n = all.find(x => x.id === id); if (!n) return;
  pick(noteTitle(n), [
    { label:n.pin ? "Unpin" : "Pin to the top", fn:() => { n.pin = !n.pin || undefined; save("notes", all); after(); } },
    { label:"Color…", fn:() => pick("Color", NOTE_COLORS.map(([c, l]) => ({ label:l + (n.color === c || (!n.color && !c) ? " ✓" : ""), fn:() => { n.color = c || undefined; save("notes", all); after(); } }))) },
    { label:"Save as a text file", fn:() => exportNote(n) },
    { label:"Delete", danger:true, fn:() => { save("notes", all.filter(x => x.id !== id)); after(); toast("Note deleted", { label:"Undo", fn:() => { save("notes", all); after(); } }); } }
  ]);
}
function exportNote(n) {
  const text = (n.title ? n.title + "\n\n" : "") + (n.text || "");
  saveFile(new Blob([text], { type:"text/plain" }), (noteTitle(n).replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "Note") + ".txt", "Note saved");
}
const parseItems = t => String(t || "").split("\n").filter(l => l.trim()).map(l => { const m = /^- \[([ x])\] ?(.*)$/.exec(l); return m ? { done:m[1] === "x", t:m[2] } : { done:false, t:l }; });
const itemsText = items => items.map(i => "- [" + (i.done ? "x" : " ") + "] " + i.t).join("\n");
function openNote(id) {
  const n = load("notes", []).find(x => x.id === id);
  if (!n) { openNotes(); return; }
  noteId = id;
  const tools = [["list", n.list ? "Text" : "Checklist", n.list ? "note" : "list"], ["color", "Color", "palette"], ["pin", n.pin ? "Unpin" : "Pin", "pin"], ["share", "Share", "share"], ["file", "Save file", "dl"], ["del", "Delete", "trash"]];
  openSheet("Note", '<div class="chips ntools">' + tools.map(([k, l, i]) => '<button type="button" data-nt="' + k + '">' + ico(i) + esc(l) + "</button>").join("") + "</div>" +
    '<input id="noteTitle" placeholder="Title" maxlength="120"><div id="noteBody"></div><div class="nfoot" id="noteCount"></div>',
    { kind:"note", full:true, back:() => { flushNote(); openNotes(); } });
  $("#sheet").style.setProperty("--nc", n.color || "transparent");
  $("#noteTitle").value = n.title || "";
  noteBody(n);
  $("#noteTitle").oninput = noteSoon;
  $("#sheetBody").onclick = e => {
    const b = e.target.closest("[data-nt]"); if (!b) return;
    flushNote();
    const all = load("notes", []), x = all.find(y => y.id === id); if (!x) return;
    const k = b.dataset.nt;
    if (k === "list") {
      if (x.list) { x.text = parseItems(x.text).map(i => (i.done ? "✓ " : "") + i.t).join("\n"); x.list = undefined; }
      else { x.text = itemsText(parseItems(x.text).map(i => ({ done:false, t:i.t.replace(/^✓ /, "") }))) || "- [ ] "; x.list = true; }
      save("notes", all); openNote(id);
    } else if (k === "color") pick("Color", NOTE_COLORS.map(([c, l]) => ({ label:l + (x.color === c || (!x.color && !c) ? " ✓" : ""), fn:() => { x.color = c || undefined; save("notes", all); $("#sheet").style.setProperty("--nc", c || "transparent"); } })));
    else if (k === "pin") { x.pin = !x.pin || undefined; save("notes", all); b.lastChild.textContent = x.pin ? "Unpin" : "Pin"; toast(x.pin ? "Pinned to the top" : "Unpinned"); }
    else if (k === "share") { const text = (x.title ? x.title + "\n\n" : "") + x.text; if (navigator.share) navigator.share({ text }).catch(() => {}); else copyText(text); }
    else if (k === "file") exportNote(x);
    else if (k === "del") { save("notes", all.filter(y => y.id !== id)); noteId = null; openNotes(); toast("Note deleted", { label:"Undo", fn:() => { save("notes", all); if ($("#noteList")) renderNotes(); } }); }
  };
}
function noteSoon() { clearTimeout(noteT); noteT = setTimeout(flushNote, 500); noteCount(); }
function noteCount() {
  const el = $("#noteCount"); if (!el) return;
  const t = noteText(), w = wordsIn(t);
  el.textContent = w + (w === 1 ? " word" : " words") + " · " + t.replace(/^- \[[ x]\] /gm, "").length + " characters";
}
function noteText() {
  const chk = $("#chk");
  if (chk) return itemsText([...chk.querySelectorAll(".ci")].map(r => ({ done:r.classList.contains("done"), t:r.querySelector("input").value })).filter(i => i.t.trim() || chk.querySelectorAll(".ci").length === 1));
  return $("#noteText") ? $("#noteText").value : "";
}
function noteBody(n) {
  const box = $("#noteBody");
  if (!n.list) {
    box.innerHTML = '<textarea id="noteText" placeholder="Write something…"></textarea>';
    $("#noteText").value = n.text || "";
    $("#noteText").oninput = noteSoon;
    if (!n.text && !n.title) $("#noteText").focus();
    noteCount();
    return;
  }
  const items = parseItems(n.text);
  if (!items.length) items.push({ done:false, t:"" });
  const rowH = i => '<div class="ci' + (i.done ? " done" : "") + '"><button type="button" class="box" aria-label="Done"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button><input value="' + esc(i.t) + '" placeholder="Item" enterkeyhint="next"></div>';
  box.innerHTML = '<div id="chk">' + items.map(rowH).join("") + '</div><button type="button" class="btnx" id="chkAdd">' + ico("plus") + "Add item</button>";
  const chk = $("#chk");
  const addAfter = (row, focus) => { row.insertAdjacentHTML("afterend", rowH({ done:false, t:"" })); const nr = row.nextElementSibling; nr.classList.add("born"); if (focus) nr.querySelector("input").focus(); noteSoon(); return nr; };
  chk.oninput = noteSoon;
  chk.onclick = e => { const b = e.target.closest(".box"); if (!b) return; const r = b.parentNode; r.classList.toggle("done"); if (r.classList.contains("done")) r.classList.add("pop"); noteSoon();
    const all = [...chk.querySelectorAll(".ci")]; if (all.length > 1 && all.every(x => x.classList.contains("done")) && typeof confetti === "function") confetti(r); };
  chk.onkeydown = e => {
    const inp = e.target.closest("input"); if (!inp) return;
    const row = inp.parentNode;
    if (e.key === "Enter") { e.preventDefault(); addAfter(row, true); }
    else if (e.key === "Backspace" && !inp.value && chk.children.length > 1) {
      e.preventDefault(); const prev = row.previousElementSibling || row.nextElementSibling; row.remove(); if (prev) { const pi = prev.querySelector("input"); pi.focus(); pi.setSelectionRange(pi.value.length, pi.value.length); } noteSoon();
    }
  };
  $("#chkAdd").onclick = () => addAfter(chk.lastElementChild, true);
  if (!n.title && items.length === 1 && !items[0].t) chk.querySelector("input").focus();
  noteCount();
}
function flushNote() {
  clearTimeout(noteT);
  if (!noteId || !$("#noteTitle") || !$("#noteBody")) return;
  const all = load("notes", []), n = all.find(x => x.id === noteId);
  if (!n) return;
  const title = $("#noteTitle").value, text = noteText();
  if (!title.trim() && !text.replace(/^- \[[ x]\] ?/gm, "").trim()) { save("notes", all.filter(x => x.id !== noteId)); return; }
  if (n.title !== title || n.text !== text) { n.title = title; n.text = text; n.ts = Date.now(); save("notes", all); checkAch(); }
}

/* ---------------------------------------------------------------- search everything */
function openSearchAll(prefill) {
  openSheet("Search everything", '<div class="search big">' + ico("glass") + '<input type="search" id="allQ" placeholder="Tabs, bookmarks, history, notes, to-dos, tools…" autocomplete="off" autocapitalize="off" enterkeyhint="search"></div><div id="allList"></div>',
    { kind:"searchall", full:true });
  const q = $("#allQ");
  q.value = prefill || "";
  q.oninput = renderAll;
  q.focus();
  renderAll();
  $("#allList").onclick = e => {
    const r = e.target.closest("[data-k]"); if (!r) return;
    const k = r.dataset.k, v = r.dataset.v;
    if (k === "tab") { closeOverlays(); activate(v); }
    else if (k === "u") go({ u:v });
    else if (k === "note") openNote(v);
    else if (k === "todo") { closeSheet(); const t = curTab(); if (t && t.u) toHome(t); setTimeout(() => { const el = $('#todos [data-id="' + v + '"]'); if (el) { el.scrollIntoView({ block:"center", behavior:"smooth" }); el.classList.add("flash"); } }, 300); }
    else if (k === "act" && ACTIONS[v]) ACTIONS[v]();
    else if (k === "tool") openTool(v);
  };
}
const SEARCH_ACTS = [["settings", "Settings", "gear"], ["customize", "Customize start page", "edit"], ["bookmarks", "Bookmarks", "star"], ["history", "History", "history"],
  ["reading", "Reading list", "read"], ["notes", "Notes", "note"], ["games", "Games", "game"], ["tools", "Tools", "tools"], ["insights", "Insights", "chart"],
  ["achievements", "Achievements", "trophy"], ["clips", "Copy history", "paste"], ["whatsnew", "What's new", "sparkle"], ["help", "Help", "info"], ["private", "Private browsing", "mask"], ["keys", "Keyboard shortcuts", "keypad"]];
function renderAll() {
  const q = ($("#allQ").value || "").trim().toLowerCase(), box = $("#allList");
  if (!q) { box.innerHTML = '<div class="empty">' + ico("glass") + "Find anything in Webs: open tabs, bookmarks, history, notes, to-dos, tools and settings.</div>"; return; }
  const has = s => String(s || "").toLowerCase().includes(q);
  const sec = (title, items) => items.length ? '<div class="day">' + esc(title) + '</div><div class="card">' + items.join("") + "</div>" : "";
  const row = (k, v, icon, t, sub, u) => '<button type="button" class="row" data-k="' + k + '" data-v="' + esc(v) + '"><span class="fav">' + (u ? favHTML(u, t) : ico(icon)) + '</span><span class="tx"><b>' + esc(t) + "</b><i>" + esc(sub) + "</i></span></button>";
  const seen = new Set();
  let html = sec("Open tabs", S().list.filter(t => t.u && (has(t.t) || has(t.u))).slice(0, 5).map(t => row("tab", t.id, "tabs", t.t || hostOf(t.u), "Switch to this tab", t.internal ? "" : t.u))) +
    sec("Tools and places", SEARCH_ACTS.filter(a => has(a[1])).map(a => row("act", a[0], a[2], a[1], "Open")).concat((typeof TOOLS !== "undefined" ? TOOLS : []).filter(t => has(t.name) || has(t.desc)).map(t => row("tool", t.id, t.icon, t.name, t.desc)))) +
    sec("Bookmarks", load("bookmarks", []).filter(b => has(b.t) || has(b.u) || has(b.f)).slice(0, 8).map(b => row("u", b.u, "", b.t || hostOf(b.u), hostOf(b.u) + (b.f ? " · " + b.f : ""), b.u))) +
    sec("Notes", load("notes", []).filter(n => has(n.title) || has(n.text)).slice(0, 8).map(n => row("note", n.id, n.list ? "list" : "note", noteTitle(n), (n.text || "").replace(/\s+/g, " ").slice(0, 80)))) +
    sec("To-do", load("todo", []).filter(t => has(t.t)).slice(0, 8).map(t => row("todo", t.id, "check", t.t, t.done ? "Done" : "To do"))) +
    sec("Reading list", load("reading", []).filter(r => has(r.t) || has(r.u)).slice(0, 6).map(r => row("u", r.u, "", r.t || hostOf(r.u), (r.done ? "Read · " : "") + hostOf(r.u), r.u))) +
    sec("History", load("history", []).filter(h => (has(h.t) || has(h.u)) && !seen.has(h.u) && seen.add(h.u)).slice(0, 10).map(h => row("u", h.u, "", h.t || hostOf(h.u), hostOf(h.u) + " · " + ago(h.ts), h.u)));
  box.innerHTML = html || '<div class="empty">' + ico("glass") + "Nothing in Webs matches “" + esc(q) + "”.</div>";
}

/* ---------------------------------------------------------------- insights */
function openInsights() {
  const hist = load("history", []), now = Date.now(), wk = hist.filter(h => now - h.ts < 7 * 864e5);
  const searches = wk.filter(h => searchOf(h.u)), pages = wk.filter(h => !searchOf(h.u));
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d, n:0 }); }
  wk.forEach(h => { const dd = days.find((x, i) => h.ts >= x.d && (i === 6 || h.ts < days[i + 1].d)); if (dd) dd.n++; });
  const hours = new Array(24).fill(0);
  hist.filter(h => now - h.ts < 30 * 864e5).forEach(h => hours[new Date(h.ts).getHours()]++);
  const sites = new Map();
  hist.filter(h => now - h.ts < 30 * 864e5 && !searchOf(h.u)).forEach(h => { const k = hostOf(h.u); if (k) sites.set(k, (sites.get(k) || 0) + 1); });
  const top = [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const eng = new Map();
  hist.filter(h => now - h.ts < 30 * 864e5).forEach(h => { const s = searchOf(h.u); if (s) eng.set(s.e.name, (eng.get(s.e.name) || 0) + 1); });
  const engs = [...eng.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5), engT = engs.reduce((a, b) => a + b[1], 0);
  const maxD = Math.max(1, ...days.map(x => x.n)), maxH = Math.max(1, ...hours), maxS = top.length ? top[0][1] : 1;
  const busiest = hours.indexOf(Math.max(...hours));
  const big = (n, l) => '<div class="ib"><b>' + fmtN(n, 0) + "</b><span>" + esc(l) + "</span></div>";
  const st = load("mstats", {});
  const html = '<div class="ibig">' + big(pages.length, "pages this week") + big(searches.length, "searches this week") + big(typeof streakDays === "function" ? streakDays() : 0, "day streak") +
    big(load("bookmarks", []).length, "bookmarks") + big(load("notes", []).length, "notes") + big((st.todosDone || 0) + load("todo", []).filter(t => t.done).length, "to-dos done") + "</div>" +
    '<div class="group"><h3>The last 7 days</h3><div class="card ichart">' + days.map(x => '<div class="col"><i style="height:' + Math.max(3, x.n / maxD * 100) + '%"><em>' + x.n + "</em></i><span>" +
      esc(x.d.toLocaleDateString([], { weekday:"narrow" })) + "</span></div>").join("") + "</div></div>" +
    (top.length ? '<div class="group"><h3>Top sites this month</h3><div class="card">' + top.map(([h, n]) => '<div class="irow"><span class="fav">' + favHTML("https://" + h + "/", h) + '</span><span class="k">' + esc(h) +
      '</span><div class="bar"><i style="width:' + (n / maxS * 100) + '%"></i></div><b>' + n + "</b></div>").join("") + "</div></div>" : "") +
    '<div class="group"><h3>When you browse</h3><div class="card ichart hours">' + hours.map((n, h) => '<div class="col"><i style="height:' + Math.max(2, n / maxH * 100) + '%"></i><span>' +
      (h % 6 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? h + "a" : h - 12 + "p") : "") + "</span></div>").join("") + "</div>" +
      (Math.max(...hours) ? '<p class="note">You browse most around ' + new Date(2020, 0, 1, busiest).toLocaleTimeString([], { hour:"numeric" }) + ".</p>" : "") + "</div>" +
    (engs.length ? '<div class="group"><h3>Search engines</h3><div class="card">' + engs.map(([n, c]) => '<div class="irow"><span class="k">' + esc(n) + '</span><div class="bar"><i style="width:' +
      (c / engT * 100) + '%"></i></div><b>' + Math.round(c / engT * 100) + "%</b></div>").join("") + "</div></div>" : "") +
    '<p class="note" style="margin:0 6px">Worked out on this iPhone from your history. Nothing is sent anywhere.</p>';
  openSheet("Insights", html, { kind:"insights", full:true });
}

/* ---------------------------------------------------------------- achievements */
function achievements() {
  const st = load("mstats", {}), hist = load("history", []), bms = load("bookmarks", []);
  const hosts = new Set(hist.map(h => hostOf(h.u)).filter(Boolean)), srch = hist.filter(h => searchOf(h.u)).length;
  const streak = typeof streakDays === "function" ? streakDays() : 0;
  const habits = load("habits", []).some(h => { let n = 0; const d = new Date(); for (let i = 0; i < 30; i++) { if ((h.days || {})[d.toLocaleDateString("en-CA")]) n++; else if (i) break; d.setDate(d.getDate() - 1); } return n >= 7; });
  const b = /^\d{4}-(\d{2})-(\d{2})$/.exec(cfg.birthday || ""), now = new Date();
  const L = [
    ["first_bm", "⭐", "Collector", "Save your first bookmark", bms.length >= 1],
    ["bm25", "📚", "Librarian", "Keep 25 bookmarks", bms.length >= 25],
    ["explorer", "🧭", "Explorer", "Visit 50 different websites", hosts.size >= 50],
    ["curious", "🔎", "Curious mind", "Search 100 times", srch >= 100],
    ["notes5", "📝", "Note taker", "Write 5 notes", load("notes", []).length >= 5],
    ["gtd", "✅", "Getting things done", "Finish 10 to-dos", (st.todosDone || 0) >= 10],
    ["roll3", "🔥", "On a roll", "Open Webs 3 days in a row", streak >= 3],
    ["roll7", "📆", "Week warrior", "Open Webs 7 days in a row", streak >= 7],
    ["roll30", "🏅", "Unstoppable", "Open Webs 30 days in a row", streak >= 30],
    ["owl", "🦉", "Night owl", "Use Webs between midnight and 4 a.m.", !!st.owl],
    ["bird", "🐦", "Early bird", "Use Webs between 4 and 6 a.m.", !!st.bird],
    ["focus", "🍅", "Focused", "Finish a focus round", (st.pomos || 0) >= 1],
    ["zen", "🧘", "Zen", "Finish a breathing exercise", (st.breaths || 0) >= 1],
    ["habit", "💪", "Habit hero", "Keep a habit up for 7 days", habits],
    ["style", "🎨", "Make it yours", "Pick a theme, accent color or live wallpaper", !!(cfg.pack || cfg.liveBg || (cfg.accent && cfg.accent !== "#e8342a"))],
    ["gamer", "🎮", "Gamer", "Score 500 in Web Runner or solve the daily word", load("game", 0) >= 500 || (load("games", {}).wordWins || 0) >= 1],
    ["juggler", "🤹", "Tab juggler", "Have 10 tabs open", T.n.list.length >= 10],
    ["ghost", "🕶️", "Incognito", "Open a private tab", !!st.private],
    ["bookworm", "📖", "Bookworm", "Finish 5 things on your reading list", (st.readDone || 0) + load("reading", []).filter(r => r.done).length >= 5],
    ["square", "🔳", "Square deal", "Make a QR code", (st.qr || 0) >= 1],
    ["wheel", "🎡", "Let fate decide", "Spin the decision wheel", (st.spins || 0) >= 1],
    ["bday", "🎂", "Birthday!", "Open Webs on your birthday", !!(b && +b[1] === now.getMonth() + 1 && +b[2] === now.getDate()) || !!st.bday]
  ];
  const got = load("mach", {});
  return L.map(([id, e, name, desc, ok]) => ({ id, e, name, desc, got:got[id] || (ok ? -1 : 0) }));
}
let achReady = false;
function checkAch() {
  if (PRIVATE) return;
  const h = new Date().getHours(), st = load("mstats", {});
  if (h < 4 && !st.owl) { st.owl = 1; save("mstats", st); } else if (h >= 4 && h < 6 && !st.bird) { st.bird = 1; save("mstats", st); }
  const got = load("mach", {}), fresh = [];
  achievements().forEach(a => { if (a.got === -1) { got[a.id] = Date.now(); fresh.push(a); } });
  if (!fresh.length) { achReady = true; return; }
  save("mach", got);
  // the first check only catches up on what you had already done, quietly
  if (achReady || load("machSeen", false)) {
    const a = fresh[0];
    setTimeout(() => toast("🏆 Achievement unlocked: " + a.name + (fresh.length > 1 ? " and " + (fresh.length - 1) + " more" : ""), { label:"See", fn:openAch }), 600);
  }
  achReady = true; save("machSeen", true);
}
function openAch() {
  const list = achievements(), n = list.filter(a => a.got).length;
  openSheet("Achievements", '<div class="achhead"><b>' + n + " of " + list.length + '</b><span>unlocked</span><div class="bar"><i style="width:' + (n / list.length * 100) + '%"></i></div></div><div class="achs">' +
    list.map(a => '<div class="ach' + (a.got ? " got" : "") + '"><em>' + a.e + "</em><b>" + esc(a.name) + "</b><span>" + esc(a.desc) + "</span>" +
      (a.got > 0 ? "<small>" + esc(new Date(a.got).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" })) + "</small>" : "") + "</div>").join("") + "</div>", { kind:"ach", full:true });
}
HOME_HOOKS.push(() => setTimeout(checkAch, 1200));

/* ---------------------------------------------------------------- copy history */
function openClips() {
  const list = load("clips", []);
  openSheet("Copy history", (list.length ? '<p class="note" style="margin:0 6px 12px">What you copied with Webs\' copy buttons. Tap one to copy it again.</p><div class="card">' +
    list.map((c, i) => '<button type="button" class="row" data-clip="' + i + '"><span class="fav">' + ico("paste") + '</span><span class="tx"><b>' + esc(c.t.replace(/\s+/g, " ").slice(0, 120)) +
      "</b><i>" + esc(ago(c.ts)) + "</i></span></button>").join("") + '</div><div class="acts"><button type="button" class="btnx" id="clipClear">' + ico("trash") + "Clear</button></div>"
    : emptyBox("paste", "Things you copy with Webs (answers, links, passwords, colors…) show up here.")), { kind:"clips", full:true });
  $("#sheetBody").onclick = e => {
    const r = e.target.closest("[data-clip]");
    if (r) { copyText(load("clips", [])[+r.dataset.clip].t); setTimeout(openClips, 50); }
    else if (e.target.closest("#clipClear")) { save("clips", []); openClips(); }
  };
}

/* ---------------------------------------------------------------- the app icon badge: unread reading list items */
function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  const n = cfg.badge ? load("reading", []).filter(r => !r.done).length : 0;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
HOME_HOOKS.push(updateBadge);

Object.assign(ACTIONS, {
  searchAll:() => openSearchAll(), insights:openInsights, achievements:openAch, clips:openClips
});
