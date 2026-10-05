/* ---------------------------------------------------------------- Webs 3.10: getting things done (../../js/gtd.js)
   - Morning routine: a set of sites opened at a time you choose, in a ☀️ Morning tab group.
   - Remind me next time I'm on this site: a note that pops up when you're back there (until you say Done).
   - Bookmark checkup: copies of the same page, and links that can't be reached any more.
   - Weekly reading digest: what's on your reading list, saved over three days ago and never read.
   - Fill in my address (Alt+Shift+F): your name, email, phone and address, kept encrypted on this PC (an AES key
     the browser can use but never read out, in its own storage), put into a form only when you ask.
   - Notes on this PDF: notes for a PDF, by page, kept with its address.
   - Phone preview: the page at a phone's width, as a phone sees it (the site's mobile version), with the
     sizes in the sidebar (side.html#xphone).
   - Voice commands (Alt+Shift+V): "new tab", "scroll down", "open youtube.com", "search for…" and more. Where the
     engine can't listen, the box takes Windows' own voice typing (Windows key + H), or typing. */
(function () {
"use strict";
if (!window.GTD) return;
const esc2 = GTD.esc;
function panel(id, icon, title, sub) {
  const p = el("div", "xpane gtp");
  p.innerHTML = '<div class="xhead"><div class="xic">' + icon + '</div><div><b></b><span></span></div></div><div class="gtb"></div>';
  p.querySelector(".xhead b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  const n = openOver(id, p); n.style.right = "8px";
  return p;
}
const curPage = () => { const t = T(active); return t && isWeb(t.url) ? { u:t.url, t:t.title || "" } : null; };

/* ---------------------------------------------------------------- the morning routine */
function routinePanel() {
  const p = panel("gtroutine", "☀️", "Morning routine", "Your sites, opened for you each morning");
  GTD.routine.editor(p.querySelector(".gtb"), GTD.routine.get(), null, curPage);
  const b = el("div", "xbtns"), go = el("button", "btn2"); go.textContent = "Open them now"; go.onclick = () => { closeOver(); openRoutine(true); }; b.appendChild(go); p.appendChild(b);
}
function openRoutine(now) {
  const r = GTD.routine.get();
  if (!r.sites.length) { if (now) toast("Add some sites first"); return; }
  GTD.routine.opened(r);
  let gid = "";
  if (!PRIVATE && r.sites.length > 1) {
    gid = Object.keys(groups).find(g => groups[g].name === "☀️ Morning") || newGroupId();
    if (!groups[gid]) { groups[gid] = { name:"☀️ Morning", color:"yellow" in COLORS ? "yellow" : Object.keys(COLORS)[0], collapsed:false }; saveGroups(); }
  }
  r.sites.forEach((s, i) => newTab(s.u, i > 0, active, false, s.t || "", gid ? { group:gid } : null));
  if (!now) toast("☀️ Good morning! Your " + r.sites.length + " morning site" + (r.sites.length === 1 ? " is" : "s are") + " open", { label:"Change", fn:routinePanel });
}
function routineTick() {
  if (PRIVATE || !GTD.routine.due()) return;
  // one window opens them
  const at = +localStorage.getItem("wsb.routineLock") || 0;
  if (Date.now() - at < 60000) return;
  try { localStorage.setItem("wsb.routineLock", String(Date.now())); } catch (e) {}
  openRoutine(false);
}
setTimeout(routineTick, 5000); setInterval(routineTick, 60000);

/* ---------------------------------------------------------------- reminders for a site */
function remindPanel() {
  const t = T(active);
  if (!t || !isWeb(t.url)) { toast("Open the site first"); return; }
  const h = hostOf(t.url), p = panel("gtremind", "📌", "Remind me on " + h, "Next time you're on " + h + ", this pops up");
  const b = p.querySelector(".gtb");
  b.innerHTML = '<textarea class="xin" rows="3" maxlength="300" placeholder="e.g. Check if the price went down"></textarea><div class="gtlist"></div><div class="xbtns"><button class="btn2 main">Save</button></div>';
  const list = b.querySelector(".gtlist"), paintL = () => {
    list.innerHTML = "";
    GTD.remind.for(h).forEach(x => list.appendChild(linkRow(t.url, x.t, "Saved " + ago(x.ts), () => {}, () => { GTD.remind.done(x.id); paintL(); })));
  };
  paintL();
  b.querySelector(".btn2.main").onclick = () => { const v = b.querySelector("textarea").value.trim(); if (!v) return; GTD.remind.add(h, v); closeOver(); toast("📌 Saved: it pops up next time you're on " + h); };
  setTimeout(() => b.querySelector("textarea").focus(), 50);
}
const shown = {};
const applyPage10g = applyPage;
applyPage = function (t) {
  applyPage10g(t);
  if (!t || !isWeb(t.url) || PRIVATE) return;
  // a reminder, once a visit (not again on every page of the same site for 30 minutes)
  const h = hostOf(t.url), l = GTD.remind.for(h).filter(x => !(shown[x.id] > Date.now() - 30 * 60000));
  if (!l.length || t.id !== active) return;
  const x = l[0]; shown[x.id] = Date.now();
  toast("📌 " + x.t, { label:"Done", fn:() => { GTD.remind.done(x.id); toast("Reminder done"); } });
};

/* ---------------------------------------------------------------- the bookmark checkup */
function reach(u) {
  return new Promise(res => {
    if (!/^https?:\/\//i.test(u) || u.length > 1500) { res(true); return; }
    const first = !proxyWait[u];
    (proxyWait[u] = proxyWait[u] || []).push([() => res(true), () => res(false)]);
    if (first) { send("feed-fetch", u); setTimeout(() => { const w = proxyWait[u]; if (w) { delete proxyWait[u]; w.forEach(x => x[1]()); } }, 15000); }
  });
}
function checkPanel() {
  const p = panel("gtcheck", "🔖", "Bookmark checkup", marks.length + " bookmarks"), b = p.querySelector(".gtb");
  const paint = () => {
    const d = GTD.dupes(marks);
    b.innerHTML = '<div class="gtk">Copies of the same page</div><div class="gtd"></div><div class="gtk">Links that might be gone</div><div class="gtdead"><button class="btn2">Check every link</button><div class="xsmall">Webs tries to open each one, a few at a time. Nothing else is sent.</div></div>';
    const dd = b.querySelector(".gtd");
    if (!d.length) dd.innerHTML = '<div class="xsmall">None. Every bookmark is different.</div>';
    else {
      d.slice(0, 20).forEach(g => dd.appendChild(linkRow(marks[g[0]].u, marks[g[0]].t || marks[g[0]].u, g.length + " copies")));
      const fix = el("button", "btn2 main"); fix.textContent = "Keep one of each (" + d.reduce((n, g) => n + g.length - 1, 0) + " to remove)";
      fix.onclick = () => { const drop = new Set(); d.forEach(g => g.slice(1).forEach(i => drop.add(i))); marks = marks.filter((m, i) => !drop.has(i)); saveNow("bookmarks"); paint(); toast("Removed " + drop.size + " copies"); };
      dd.appendChild(fix);
    }
    b.querySelector(".gtdead .btn2").onclick = async () => {
      const box = b.querySelector(".gtdead"), list = marks.filter(m => /^https?:\/\//i.test(m.u)).slice(0, 400), dead = [];
      box.innerHTML = '<div class="gtbar"><i></i></div><div class="xsmall gtc">Checking…</div><div class="gtres"></div>';
      let done = 0;
      const next = async () => { while (list.length && p.isConnected) { const m = list.shift(); if (!(await reach(m.u))) dead.push(m); done++; box.querySelector(".gtbar i").style.width = Math.round(done / (done + list.length) * 100) + "%"; box.querySelector(".gtc").textContent = "Checked " + done + " · " + dead.length + " couldn't be reached"; } };
      await Promise.all([next(), next(), next()]);
      if (!p.isConnected) return;
      const res = box.querySelector(".gtres");
      box.querySelector(".gtc").textContent = dead.length ? dead.length + " couldn't be reached. They may be gone, or just down right now." : "Every link works. 👍";
      dead.forEach(m => res.appendChild(linkRow(m.u, m.t || m.u, hostOf(m.u), () => { closeOver(); newTab(m.u, false); }, () => { marks = marks.filter(x => x !== m); saveNow("bookmarks"); res.innerHTML = ""; paint(); })));
    };
  };
  paint();
}

/* ---------------------------------------------------------------- the weekly reading digest */
function digestPanel() {
  const items = GTD.digest.items(load("reading", []));
  const p = panel("gtdigest", "📚", "Your reading digest", items.length ? items.length + " saved pages still waiting" : "Nothing waiting"), b = p.querySelector(".gtb");
  if (!items.length) b.innerHTML = '<div class="xsmall">You\'ve read everything you saved. 🎉</div>';
  items.forEach(r => b.appendChild(linkRow(r.u, r.t || r.u, "Saved " + ago(r.ts), () => { closeOver(); newTab(r.u, false); }, () => {
    const l = load("reading", []), x = l.find(y => y.u === r.u); if (x) x.done = true; save("reading", l); closeOver(); digestPanel(); })));
}
function digestTick() {
  if (PRIVATE || !GTD.digest.due()) return;
  const items = GTD.digest.items(load("reading", []));
  GTD.digest.seen();
  if (items.length) toast("📚 Your reading digest: " + items.length + " saved page" + (items.length === 1 ? "" : "s") + " still waiting", { label:"See them", fn:digestPanel });
}
setTimeout(digestTick, 20000); setInterval(digestTick, 3600000);

/* ---------------------------------------------------------------- your address, encrypted, for forms */
const vault = {
  db:null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((ok, bad) => { const r = indexedDB.open("webs-vault", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => { this.db = r.result; ok(this.db); }; r.onerror = () => bad(r.error); }); },
  async key() {
    const db = await this.open(), get = () => new Promise((ok, bad) => { const q = db.transaction("k").objectStore("k").get("addr"); q.onsuccess = () => ok(q.result); q.onerror = () => bad(q.error); });
    let k = await get();
    if (!k) { k = await crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, false, ["encrypt", "decrypt"]); await new Promise((ok, bad) => { const tx = db.transaction("k", "readwrite"); tx.objectStore("k").put(k, "addr"); tx.oncomplete = ok; tx.onerror = () => bad(tx.error); }); }
    return k;
  },
  async save(o) {
    const k = await this.key(), iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify(o))));
    const b64 = a => btoa(String.fromCharCode(...a));
    localStorage.setItem("wsb.addrVault", JSON.stringify({ iv:b64(iv), ct:b64(ct) }));
  },
  async load() {
    const v = JSON.parse(localStorage.getItem("wsb.addrVault") || "null"); if (!v) return null;
    const un = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:un(v.iv) }, await this.key(), un(v.ct)))); } catch (e) { return null; }
  }
};
const FIELDS = [["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["street", "Street address"], ["street2", "Apartment, suite (optional)"], ["city", "City"], ["postcode", "ZIP or postcode"], ["state", "State or region"], ["country", "Country"]];
async function addressPanel() {
  const p = panel("gtaddr", "🏠", "Your address for forms", "Kept encrypted on this PC. Never synced, never in backups."), b = p.querySelector(".gtb");
  const v = await vault.load() || {};
  b.innerHTML = FIELDS.map(([k, n]) => '<label class="gtf"><span>' + n + '</span><input class="xin" data-k="' + k + '" maxlength="120"></label>').join("") +
    '<div class="xsmall">Menu → Fill in my address (or Alt+Shift+F) puts these into the form on a page. Boxes that already have something in them are left alone.</div>' +
    '<div class="xbtns"><button class="btn2">Delete it all</button><button class="btn2 main">Save</button></div>';
  b.querySelectorAll("input").forEach(i => { i.value = v[i.dataset.k] || ""; });
  b.querySelector(".btn2.main").onclick = async () => { const o = {}; b.querySelectorAll("input").forEach(i => { if (i.value.trim()) o[i.dataset.k] = i.value.trim(); }); await vault.save(o); closeOver(); toast("Saved, encrypted on this PC"); };
  b.querySelector(".btn2:not(.main)").onclick = () => { localStorage.removeItem("wsb.addrVault"); closeOver(); toast("Your address is deleted from Webs"); };
}
async function fillAddress() {
  const t = T(active);
  if (!t || !isWeb(t.url)) { toast("Open the page with the form first"); return; }
  const v = await vault.load();
  if (!v || !Object.keys(v).length) { addressPanel(); toast("Add your details first, then fill"); return; }
  send("page-tool", t.id, "x-fill", JSON.stringify(v));
}

/* ---------------------------------------------------------------- notes on a PDF */
const isPdf = t => !!t && (/\.pdf($|[?#])/i.test(t.url) || /\.pdf$/i.test(t.title || ""));
function pdfPanel() {
  const t = T(active);
  if (!t || !isPdf(t)) { toast("Open a PDF first"); return; }
  const key = t.url.split("#")[0], all = load("pdfNotes", {}), list = all[key] = all[key] || [];
  const p = panel("gtpdf", "📄", "Notes on this PDF", (t.title || hostOf(t.url)).slice(0, 80)), b = p.querySelector(".gtb");
  const pg = (/#page=(\d+)/.exec(t.url) || [])[1] || "";
  b.innerHTML = '<div class="gtnew"><input class="xin gtpg" type="number" min="1" placeholder="Page" value="' + pg + '"><textarea class="xin" rows="2" maxlength="2000" placeholder="Your note"></textarea><button class="btn2 main">Add</button></div><div class="gtnotes"></div>' +
    '<div class="xbtns"><button class="btn2 gtcopy">Copy all</button></div>';
  const paint = () => {
    const box = b.querySelector(".gtnotes"); box.innerHTML = list.length ? "" : '<div class="xsmall">No notes yet. They stay with this PDF\'s address, on this PC.</div>';
    list.slice().sort((x, y) => (x.p || 0) - (y.p || 0)).forEach(n => { const r = el("div", "gtnote"); r.innerHTML = "<b></b><span></span><button class=\"btn\" title=\"Remove\">" + ico("x") + "</button>";
      r.querySelector("b").textContent = n.p ? "p. " + n.p : "—"; r.querySelector("span").textContent = n.t;
      r.querySelector("b").onclick = () => { if (n.p) go(key + "#page=" + n.p); };
      r.querySelector("button").onclick = () => { list.splice(list.indexOf(n), 1); save("pdfNotes", all); paint(); }; box.appendChild(r); });
  };
  b.querySelector(".gtnew .btn2").onclick = () => { const tx = b.querySelector(".gtnew textarea").value.trim(); if (!tx) return; list.push({ p:+b.querySelector(".gtpg").value || 0, t:tx, ts:Date.now() }); save("pdfNotes", all); b.querySelector(".gtnew textarea").value = ""; paint(); };
  b.querySelector(".gtcopy").onclick = () => { send("clip", (t.title || key) + "\n" + key + "\n\n" + list.slice().sort((x, y) => (x.p || 0) - (y.p || 0)).map(n => (n.p ? "p. " + n.p + ": " : "") + n.t).join("\n")); toast("Copied your notes"); };
  paint();
}

/* ---------------------------------------------------------------- phone preview */
let phone = null;      // { w, host, had (the site was already on its mobile version) }
X3.sideWFor = vpW => phone ? Math.max(260, vpW - RAIL - phone.w) : Math.min(cfg.sideW || 380, vpW * 0.5);
function phoneUndo() { if (!phone) return; const p = phone; phone = null; if (!p.had) listToggle("mobile", p.host, false); relayout(); reloadActive(); }
function phoneStart(w) {
  const t = T(active);
  if (!t || !isWeb(t.url)) { toast("Open a web page first"); return; }
  const h = hostOf(t.url);
  if (phone && phone.host !== h) phoneUndo();
  if (!phone) { phone = { w:w || 393, host:h, had:listed(cfg.mobile, h) }; if (!phone.had) listToggle("mobile", h, true); reloadActive(); }
  else phone.w = w || phone.w;
  openSide("xphone"); relayout();
}
const openSide10g = openSide;
openSide = function (which, site) {
  if (which !== "xphone") { if (phone) phoneUndo(); return openSide10g(which, site); }
  if (!side.open) { const r = $("#rail"); r.classList.add("opening"); setTimeout(() => r.classList.remove("opening"), 500); }
  side.open = true; side.which = "xphone";
  send("side-open", HOME + "side.html#xphone");
  renderRail(); paint(); relayout();
};
const closeSide10g = closeSide;
closeSide = function () { closeSide10g(); phoneUndo(); };
addEventListener("storage", e => {
  if (e.key !== "wsb.phonePrev" || !e.newValue) return;
  let v = null; try { v = JSON.parse(e.newValue); } catch (x) {}
  if (!v) return;
  if (v.off) { if (side.which === "xphone") closeSide(); else phoneUndo(); }
  else if (+v.w > 200) { if (!phone) phoneStart(+v.w); else { phone.w = +v.w; relayout(); } }
});

/* ---------------------------------------------------------------- voice commands */
function runVoice(c) {
  const t = T(active), web = t && isWeb(t.url), page = a => { if (web) send("page-tool", t.id, "x-scrollto", a); };
  const idx = tabs.findIndex(x => x.id === active);
  switch (c.cmd) {
    case "newtab": newTab(null, false); break;
    case "close": if (t) closeTab(t.id); break;
    case "reopen": reopenClosed(); break;
    case "down": case "up": case "top": case "bottom": page(c.cmd); break;
    case "back": if (t) send("back", t.id); break;
    case "forward": if (t) send("forward", t.id); break;
    case "reload": if (t) send("reload", t.id, 0); break;
    case "nexttab": if (tabs.length) select(tabs[(idx + 1) % tabs.length].id); break;
    case "prevtab": if (tabs.length) select(tabs[(idx - 1 + tabs.length) % tabs.length].id); break;
    case "tab": { const i = c.arg === 9 ? tabs.length - 1 : c.arg - 1; if (tabs[i]) select(tabs[i].id); break; }
    case "zoomin": zoom(1); break; case "zoomout": zoom(-1); break; case "zoomreset": zoom(0); break;
    case "bookmark": $("#star").click(); break;
    case "read": if (web) send("read-aloud", t.id, navigator.language); break;
    case "stop": if (web) send("media", t.id, "pause"); break;
    case "playpause": if (web) send("media", t.id, "toggle"); break;
    case "mute": if (t) send("mute", t.id, t.muted ? 0 : 1); break;
    case "home": $("#home").click(); break;
    case "private": send("new-window", 1); break;
    case "summarize": if (X3.webAI) openSide("xai", "summarize"); break;
    case "find": if (web) send("find", t.id, c.arg, 1, 0); break;
    case "search": go(c.arg); break;
    case "open": go(c.arg); break;
    case "ask": try { localStorage.setItem("wsb.xaiBarQ", JSON.stringify({ q:c.arg, t:Date.now() })); } catch (e) {} openSide("xai", "bar"); break;
    default: return false;
  }
  return true;
}
let lis = null;
function voicePanel() {
  const p = panel("gtvoice", "🎙️", "Voice commands", GTD.voice.ok ? "Listening… say a command" : "Type a command, or press Windows key + H in the box and say it"), b = p.querySelector(".gtb");
  b.innerHTML = '<div class="gtlive">' + (GTD.voice.ok ? "🎙️ Listening…" : "") + '</div><input class="xin" placeholder="e.g. open youtube.com" maxlength="200"><div class="gtk">You can say</div><ul class="xnotes">' + GTD.voice.HELP.map(h => "<li>" + esc2(h) + "</li>").join("") + "</ul>";
  const live = b.querySelector(".gtlive"), inp = b.querySelector("input");
  const doIt = text => { const c = GTD.voice.parse(text); if (c && runVoice(c)) { closeOver(); toast("🎙️ " + text); } else { live.textContent = "Didn't catch a command in “" + text + "”. Try one of these:"; } };
  inp.addEventListener("keydown", e => { if (e.key === "Enter" && inp.value.trim()) doIt(inp.value.trim()); });
  if (GTD.voice.ok) {
    if (lis) lis.stop();
    lis = GTD.voice.listen({ onPartial:x => { live.textContent = "🎙️ " + x; }, onText:(x, c) => { if (c && runVoice(c)) { closeOver(); toast("🎙️ " + x); } else doIt(x); },
      onError:e => { live.textContent = e === "not-allowed" ? "The microphone isn't allowed. Type a command, or use Windows key + H." : e === "nothing" ? "Didn't hear anything. Type a command, or try again." : "Can't listen here: type a command, or press Windows key + H to dictate."; inp.focus(); } });
    new MutationObserver((m, o) => { if (!p.isConnected) { o.disconnect(); if (lis) lis.stop(); lis = null; } }).observe($("#over"), { childList:true });
  } else setTimeout(() => inp.focus(), 50);
}
const shortcut10 = shortcut;
shortcut = function (k, ctrl, shift, alt) {
  if (alt && shift && !ctrl && k === 86) { voicePanel(); return; }      // V
  if (alt && shift && !ctrl && k === 70) { fillAddress(); return; }     // F
  return shortcut10(k, ctrl, shift, alt);
};

/* ---------------------------------------------------------------- the menu and the command palette */
X3.gtd = { routinePanel, openRoutine, remindPanel, checkPanel, digestPanel, digestTick, addressPanel, fillAddress, pdfPanel, phoneStart, phoneUndo, voicePanel, runVoice, vault, phone:() => phone };
function gtdPanel() {
  const t = T(active), web = t && isWeb(t.url);
  const m = el("div", "xpane gtmore");
  m.innerHTML = '<div class="xhead"><div class="xic">✅</div><div><b>Get things done</b><span>Small helpers for every day</span></div></div>';
  [["☀️", "Morning routine…", routinePanel], web ? ["📌", "Remind me next time I'm on " + hostOf(t.url) + "…", remindPanel] : null, ["🔖", "Bookmark checkup…", checkPanel],
   ["📚", "Reading digest", digestPanel], ["🏠", "Your address for forms…", addressPanel], web ? ["📱", "Phone preview", () => phoneStart()] : null,
   web && isPdf(t) ? ["📄", "Notes on this PDF…", pdfPanel] : null, ["🎙️", "Voice commands", voicePanel]].filter(Boolean)
    .forEach(([e, n, fn]) => { const r = el("div", "mi"); r.innerHTML = '<span class="aie">' + e + "</span><span></span>"; r.lastChild.textContent = n; r.onclick = () => { closeOver(); fn(); }; m.appendChild(r); });
  const n = openOver("gtmore", m); n.style.right = "8px";
}
X3.gtd.panel = gtdPanel;
const menuRows10g = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRows10g) menuRows10g(m);
  m.appendChild(row("task", "Get things done…", "", gtdPanel));
  const t = T(active), web = t && isWeb(t.url);
  if (web && isPdf(t)) m.appendChild(row("book", "Notes on this PDF…", "", pdfPanel));
  if (web) m.appendChild(row("edit", "Fill in my address", "Alt+Shift+F", fillAddress));
  m.appendChild(row("sparkle", "Voice commands", "Alt+Shift+V", voicePanel));
};
const commands10g = commands;
commands = function () {
  return commands10g().concat([
    { t:"Morning routine: sites that open each morning", k:"", i:"clock", fn:routinePanel },
    { t:"Remind me next time I'm on this site", k:"", i:"pin", fn:remindPanel },
    { t:"Bookmark checkup: copies and dead links", k:"", i:"star", fn:checkPanel },
    { t:"Reading digest: saved pages still waiting", k:"", i:"book", fn:digestPanel },
    { t:"Fill in my address", k:"Alt+Shift+F", i:"edit", fn:fillAddress },
    { t:"Your address for forms (edit)", k:"", i:"edit", fn:addressPanel },
    { t:"Notes on this PDF", k:"", i:"book", fn:pdfPanel },
    { t:"Phone preview: this page at a phone's size", k:"", i:"win", fn:() => phoneStart() },
    { t:"Voice commands", k:"Alt+Shift+V", i:"sparkle", fn:voicePanel }
  ]);
};
// the tab's right-click menu and the page's: a reminder for the site
const tabItems10 = X3.tabItems;
X3.tabItems = function (items, id) { if (tabItems10) tabItems10(items, id); const t = T(id); if (t && isWeb(t.url)) items.splice(items.length - 1, 0, ["Remind me next time I'm on " + hostOf(t.url) + "…", () => { select(id); remindPanel(); }]); };

const st = document.createElement("style");
st.textContent = `
.gtp{width:440px}.gtb{font-size:13px}.gtk{font-size:12px;font-weight:600;margin:12px 0 6px}.gtf{display:block;margin:6px 0}.gtf span{display:block;font-size:11.5px;color:var(--dim)}.gtf .xin{margin-top:3px}
.gtbar{height:6px;border-radius:3px;background:var(--bg3);overflow:hidden;margin:6px 0}.gtbar i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
.gtnew{display:grid;grid-template-columns:80px 1fr auto;gap:6px;align-items:start}.gtnew .xin{margin:0}.gtnew .btn2{height:34px}
.gtnote{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)}.gtnote b{flex:none;width:44px;color:var(--accent);cursor:pointer}.gtnote span{flex:1;white-space:pre-wrap}
.gtlive{min-height:22px;font-size:14px;margin-bottom:8px}.gtmore{width:340px}.gtmore .mi{cursor:pointer}.gtmore .aie{width:20px;text-align:center}
`;
document.head.appendChild(st);
})();
