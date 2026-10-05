/* ---------------------------------------------------------------- Webs 3.10: privacy (../../js/privacy.js)
   - Containers: a site kept in its own window with its own cookies and logins (Shopping, Work, Banking…).
     Each container is a profile named "Container …"; a site you put in one opens there. The address
     goes across through the updater's folder (the folder sync command writes one small file there, which
     the container's window reads as it opens); without the updater it's copied for you to paste.
   - Clean up when I close a site: its cookies and stored data go when its last tab closes (Settings →
     Webs 3.0 extras: off, the sites you pick, or every site but the ones you keep).
   - Is this shop real? Shops are checked as they open: what the page shows, how old the website is
     (the public registry, through the Web AI server), and its address. A bar on the page says why.
   - What sites see about you: your internet address and roughly where you are, your device, the
     fingerprint a site can build, and what this site set, with what Webs already hides. */
(function () {
"use strict";
if (!window.Privacy) return;
const P = window.Privacy;
function panel(id, icon, title, sub) {
  const p = el("div", "xpane gtp pvp");
  p.innerHTML = '<div class="xhead"><div class="xic">' + icon + '</div><div><b></b><span></span></div></div><div class="gtb"></div>';
  p.querySelector(".xhead b").textContent = title; p.querySelector(".xhead span").textContent = sub;
  const n = openOver(id, p); n.style.right = "8px";
  return p;
}
const base = h => P.regDomain(h) || String(h || "").replace(/^www\./, "");
const saveCfg = () => { saveNow("settings"); sendPrefs(); };
// the host fetches for the window (it may read any site; nothing else is sent)
function hostFetch(u) {
  return new Promise((res, rej) => {
    const first = !proxyWait[u];
    (proxyWait[u] = proxyWait[u] || []).push([res, rej]);
    if (first) { send("feed-fetch", u); setTimeout(() => { const w = proxyWait[u]; if (w) { delete proxyWait[u]; w.forEach(x => x[1](new Error("timeout"))); } }, 12000); }
  });
}
// a page tool's answer
const waits = {};
function askPage(t, action, arg, ms) {
  return new Promise((ok, bad) => {
    if (!t || !isWeb(t.url) || t.sleep || t.lazy) { bad(new Error("That tab isn't loaded.")); return; }
    const k = t.id + ":" + action;
    const w = waits[k] = { ok:v => { if (waits[k] === w) { delete waits[k]; clearTimeout(w.t); ok(v); } }, t:setTimeout(() => { if (waits[k] === w) { delete waits[k]; bad(new Error("The page didn't answer.")); } }, ms || 6000) };
    send("page-tool", t.id, action, arg || "");
  });
}
const onToolResultP = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  if (r && r.a && waits[id + ":" + r.a]) { waits[id + ":" + r.a].ok(r); return; }
  if (r && r.a === "x-shop-act") { shopAct(id, r.act); return; }
  onToolResultP(id, json);
};

/* ---------------------------------------------------------------- containers */
const PRE = "Container ";
const boxes = () => profiles.list.filter(n => n.indexOf(PRE) === 0).map(n => n.slice(PRE.length));
const inBox = () => profiles.cur.indexOf(PRE) === 0 ? profiles.cur.slice(PRE.length) : "";
const BOXC = { Shopping:"🛍️", Work:"💼", Banking:"🏦", Social:"💬", School:"🎒", Games:"🎮", Personal:"🏠" };
const boxIcon = n => BOXC[n] || "📦";
const boxFor = h => { const m = cfg.xBoxes || {}, b = base(h); return m[b] || ""; };
let handFolder = null;
async function folder() {
  if (handFolder !== null) return handFolder;
  try {
    const r = await fetch("user/webs-update.json?t=" + Date.now(), { cache:"no-store" });
    const j = r.ok ? await r.json() : null;
    handFolder = j && typeof j.inbox === "string" && /[\\/]inbox[\\/]?$/i.test(j.inbox) ? j.inbox.replace(/[\\/]inbox[\\/]?$/i, "") : "";
  } catch (e) { handFolder = ""; }
  return handFolder;
}
let quietSync = 0, quietRead = 0;
async function openInBox(name, u, fromId) {
  if (!/^[A-Za-z0-9 _-]{1,20}$/.test(name)) { toast("Use letters and numbers for a container's name"); return; }
  const f = PRIVATE ? "" : await folder();
  if (u && f) { quietSync++; send("sync-write", f, JSON.stringify({ app:"Webs container", to:PRE + name, u, t:Date.now(), id:Math.random().toString(36).slice(2) })); }
  else if (u) { try { await navigator.clipboard.writeText(u); } catch (e) {} }
  send("profile-open", PRE + name);
  setTimeout(() => send("profile-info"), 3000);
  if (fromId && T(fromId)) closeTab(fromId);
  toast(boxIcon(name) + " Opening in your " + name + " container" + (u && !f ? " - the address is copied: paste it there with Ctrl+V" : ""));
}
// the container's own window: takes the addresses sent to it
const handled = new Set(load("boxSeen", []));
let readUntil = 0;
async function pickUp() {
  if (!inBox() || PRIVATE) return;
  const f = await folder(); if (!f) return;
  quietRead++; send("sync-read", f);
}
function onHandoff(text) {
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  if (!j || j.app !== "Webs container") return false;
  if (j.to === profiles.cur && /^https?:\/\//i.test(j.u || "") && Date.now() - (+j.t || 0) < 120000 && !handled.has(j.id)) {
    handled.add(j.id); save("boxSeen", [...handled].slice(-50));
    newTab(j.u, false);
  }
  return true;
}
function boxPanel() {
  const p = panel("pvbox", "📦", "Containers", inBox() ? "This window is your " + inBox() + " container" : "Sites kept apart, each with its own logins"), b = p.querySelector(".gtb");
  const t = T(active), web = t && isWeb(t.url), h = web ? hostOf(t.url) : "";
  const paint = () => {
    const list = boxes(), map = cfg.xBoxes || {};
    b.innerHTML = '<div class="xsmall">A container is a window of its own: cookies, logins and history stay inside it, so shops can\'t follow you to the news, and you can be signed in to two accounts at once.</div>' +
      '<div class="gtk">Your containers</div><div class="pvlist"></div>' +
      '<div class="pvadd"><input class="xin" maxlength="20" placeholder="New container, e.g. Shopping"><button class="btn2">Add</button></div>' +
      (web ? '<div class="gtk">' + esc(base(h)) + '</div><div class="pvsite"></div>' : "") +
      '<label class="pvchk"><input type="checkbox"' + (cfg.xBoxAuto ? " checked" : "") + '> Move a site to its container by itself (otherwise Webs asks)</label>';
    const l = b.querySelector(".pvlist");
    if (!list.length) l.innerHTML = '<div class="xsmall">None yet. Try Shopping, Work or Banking.</div>';
    list.forEach(n => {
      const sites = Object.keys(map).filter(k => map[k] === n);
      const r = el("div", "mi"); r.innerHTML = '<span class="pvi"></span><span class="pvn"><b></b><em></em></span>';
      r.querySelector(".pvi").textContent = boxIcon(n); r.querySelector("b").textContent = n + (n === inBox() ? " (this window)" : "");
      r.querySelector("em").textContent = sites.length ? sites.slice(0, 4).join(", ") + (sites.length > 4 ? "…" : "") : "No sites yet";
      r.onclick = () => { closeOver(); if (n !== inBox()) openInBox(n, ""); };
      l.appendChild(r);
    });
    const inp = b.querySelector(".pvadd input");
    b.querySelector(".pvadd button").onclick = () => {
      const n = inp.value.trim().replace(/\s+/g, " ");
      if (!/^[A-Za-z0-9 _-]{1,20}$/.test(n)) { toast("Use letters and numbers (up to 20)"); return; }
      if (boxes().indexOf(n) >= 0) { toast("You have that one already"); return; }
      profiles.list.push(PRE + n); send("profile-open", PRE + n); setTimeout(() => send("profile-info"), 3000);
      toast(boxIcon(n) + " Made your " + n + " container"); paint();
    };
    inp.onkeydown = e => { if (e.key === "Enter") b.querySelector(".pvadd button").click(); };
    const s = b.querySelector(".pvsite");
    if (s) {
      const cur = boxFor(h);
      s.innerHTML = '<select class="xin"><option value="">Not in a container</option>' + list.map(n => '<option' + (n === cur ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select>" +
        (list.length ? '<button class="btn2">Open this tab there</button>' : "");
      s.querySelector("select").onchange = e => { cfg.xBoxes = Object.assign({}, cfg.xBoxes || {}); if (e.target.value) cfg.xBoxes[base(h)] = e.target.value; else delete cfg.xBoxes[base(h)]; saveCfg(); paint(); };
      const go = s.querySelector("button");
      if (go) go.onclick = () => { const n = s.querySelector("select").value || list[0]; closeOver(); openInBox(n, t.url, t.id); };
    }
    b.querySelector(".pvchk input").onchange = e => { cfg.xBoxAuto = e.target.checked; saveCfg(); };
  };
  paint();
}
// a site that belongs in another container
const boxAsked = {};
function boxCheck(t) {
  if (PRIVATE || !t || !isWeb(t.url)) return;
  const want = boxFor(hostOf(t.url));
  if (!want || want === inBox() || boxes().indexOf(want) < 0) return;
  const k = base(hostOf(t.url));
  if (cfg.xBoxAuto) { openInBox(want, t.url, t.id); return; }
  if (boxAsked[k] || t.id !== active) return;
  boxAsked[k] = 1;
  toast(boxIcon(want) + " " + k + " lives in your " + want + " container", { label:"Open there", fn:() => openInBox(want, t.url, t.id) });
}

/* ---------------------------------------------------------------- clean up when a site's last tab closes */
const cleanMode = () => cfg.xClean === "pick" || cfg.xClean === "all" ? cfg.xClean : "";
function cleanFor(h) {
  const b = base(h), m = cleanMode();
  if (!m || !b) return false;
  return m === "pick" ? (cfg.xCleanSites || []).indexOf(b) >= 0 : (cfg.xKeepSites || []).indexOf(b) < 0;
}
const pendingClean = {};
function finishClean(id, ok) {
  const p = pendingClean[id]; if (!p) return;
  delete pendingClean[id]; clearTimeout(p.timer);
  closeTab0(id);
  if (ok !== false) { toast("🧹 Cleaned up " + p.site + " - its cookies and data are gone"); bump(p.site); }
}
const bump = s => { const n = load("cleanN", { n:0 }); n.n++; n.last = s; save("cleanN", n); };
const closeTab0 = closeTab;
closeTab = function (id) {
  const t = T(id);
  if (pendingClean[id]) return;
  if (t && !PRIVATE && isWeb(t.url) && !t.lazy && cleanFor(hostOf(t.url))) {
    const b = base(hostOf(t.url));
    if (!tabs.some(x => x.id !== id && isWeb(x.url) && base(hostOf(x.url)) === b)) {
      pendingClean[id] = { site:b, timer:setTimeout(() => finishClean(id), 2500) };
      const d = document.querySelector('.tab[data-id="' + id + '"]'); if (d) d.classList.add("pvgoing");
      send("site-clear", id, 0);
      return;
    }
  }
  closeTab0(id);
};
function cleanSwitch(h) {
  const b = base(h), m = cleanMode();
  if (!m) return null;
  return m === "pick" ? ["Clean up when closed", "Its cookies go when you close its last tab", (cfg.xCleanSites || []).indexOf(b) >= 0, on => {
    const s = new Set(cfg.xCleanSites || []); if (on) s.add(b); else s.delete(b); cfg.xCleanSites = [...s]; saveCfg(); }]
    : ["Keep its cookies", "Every other site is cleaned up when you close it", (cfg.xKeepSites || []).indexOf(b) >= 0, on => {
    const s = new Set(cfg.xKeepSites || []); if (on) s.add(b); else s.delete(b); cfg.xKeepSites = [...s]; saveCfg(); }];
}
// in the site's panel (the icon left of the address)
const fillSiteP = fillSite;
fillSite = function () {
  fillSiteP();
  const p = $("#sitep"), t = T(active);
  if (!p || !t || !isWeb(t.url)) return;
  const acts = p.querySelector(".pacts"); if (!acts || p.querySelector(".pvrows")) return;
  const h = hostOf(t.url), wrap = el("div", "pvrows"), rows = [];
  const sw = cleanSwitch(h); if (sw) rows.push(sw);
  if (boxes().length) rows.push(["Container", boxFor(h) ? boxIcon(boxFor(h)) + " " + boxFor(h) : "Not in one", null, boxPanel]);
  rows.push(["Is this shop real?", "Check it now", null, () => { closeOver(); shopCheck(t, true); }]);
  rows.push(["What this site sees about you", "Your address, device and fingerprint", null, () => { closeOver(); seenPanel(); }]);
  rows.forEach(r => {
    const d = el("div", "prow"); d.innerHTML = '<div class="t"><b></b><span></span></div>' + (r[2] === null ? '<button class="btn">›</button>' : '<div class="sw' + (r[2] ? " on" : "") + '"><i></i></div>');
    d.querySelector("b").textContent = r[0]; d.querySelector("span").textContent = r[1];
    (d.querySelector(".sw") || d.querySelector(".btn")).onclick = () => { if (r[2] === null) r[3](); else { r[3](!r[2]); p.querySelector(".pvrows").remove(); fillSite(); } };
    wrap.appendChild(d);
  });
  acts.parentNode.insertBefore(wrap, acts);
};

/* ---------------------------------------------------------------- is this shop real? */
const shopDone = {};
async function shopCheck(t, manual) {
  if (!t || !isWeb(t.url)) { if (manual) toast("Open a shop first"); return; }
  const h = hostOf(t.url), b = base(h), url = t.url;
  if (!manual) {
    if (cfg.xShop === false || PRIVATE || (cfg.xShopTrust || []).indexOf(b) >= 0 || shopDone[b]) return;
    if (P.hostSigns(h).known) return;
  }
  let sig;
  try { sig = await askPage(t, "x-shop", "", 6000); } catch (e) { if (manual) toast("The page didn't answer. Reload it and try again."); return; }
  if (!manual && !sig.shop) return;
  if (!manual) shopDone[b] = 1;
  let age = null;
  try { age = await P.domainAge(h, { fetchText:hostFetch }); } catch (e) {}
  const v = P.shopVerdict(sig, age, h);
  const now = T(t.id); if (!now || now.url !== url) return;
  if (v.level !== "ok") { send("page-tool", t.id, "x-shop-warn", JSON.stringify(v)); return; }
  if (manual) {
    const p = panel("pvshop", "🛍️", "Is this shop real?", b), body = p.querySelector(".gtb");
    body.innerHTML = '<div class="pvok">✅ ' + (v.known ? "A big shop everyone knows." : sig.shop ? "Nothing worrying found." : "This doesn't look like a shop, and nothing worrying was found.") + "</div>" +
      (v.good.length ? "<ul class=\"pvul\">" + v.good.map(g => "<li>" + esc(g) + "</li>").join("") + "</ul>" : "") +
      (v.reasons.length ? '<div class="gtk">Small things</div><ul class="pvul">' + v.reasons.map(g => "<li>" + esc(g) + "</li>").join("") + "</ul>" : "") +
      '<div class="xsmall">Webs looks at the page, the website\'s age and its address. It can\'t be sure: if a deal looks too good to be true, it usually is.</div>';
  }
}
function shopAct(id, act) {
  const t = T(id); if (!t) return;
  const b = base(hostOf(t.url));
  if (act === "trust") { cfg.xShopTrust = [...new Set((cfg.xShopTrust || []).concat(b))]; saveCfg(); toast("Webs won't warn about " + b + " again"); }
  else if (act === "leave") { if (t.back) send("back", id); else closeTab(id); toast("Left " + b); }
  else if (act === "ai") {
    select(id);
    try { localStorage.setItem("wsb.xaiBarQ", JSON.stringify({ q:"Is the shop " + b + " (" + t.url + ") legitimate, or a scam? Look for signs on this page.", t:Date.now() })); } catch (e) {}
    openSide("xai", "bar");
  }
}
const applyPageP = applyPage;
applyPage = function (t) {
  applyPageP(t);
  if (!t || !isWeb(t.url)) return;
  boxCheck(t);
  const id = t.id, u = t.url;
  setTimeout(() => { const n = T(id); if (n && n.url === u) shopCheck(n, false); }, 2500);
};

/* ---------------------------------------------------------------- what sites see about you */
async function seenPanel() {
  const p = panel("pvseen", "👀", "What sites see about you", "Loading…"), b = p.querySelector(".gtb");
  b.innerHTML = '<div class="xsmall">Asking…</div>';
  const t = T(active), web = t && isWeb(t.url) && !t.sleep && !t.lazy;
  const [page, ip] = await Promise.all([web ? askPage(t, "x-seen", "", 5000).catch(() => null) : Promise.resolve(null), P.whoami()]);
  if (overlay !== "pvseen") return;
  const pg = page || await P.local();
  p.querySelector(".xhead span").textContent = page ? "As " + hostOf(t.url) + " sees you" : "What any website gets (open a site to see what it sees)";
  const vpn = vpnState && vpnState.state === "on";
  const list = P.seen({ page:pg, ip, fp:!!cfg.fp, vpn, ipWhy:PRIVATE ? "Not checked in a private window" : "" });
  const hidden = list.filter(r => r.safe).length;
  P.render(b, list, hidden + " of " + list.length + " are hidden or made common by Webs.");
  const f = el("div", "xbtns");
  if (!cfg.fp) { const x = el("button", "btn2 main"); x.textContent = "Turn on fingerprint protection"; x.onclick = () => { cfg.fp = true; saveCfg(); reloadActive(); toast("Fingerprint protection on"); closeOver(); }; f.appendChild(x); }
  if (!vpn) { const x = el("button", "btn2"); x.textContent = "Hide my address (VPN)"; x.onclick = () => { closeOver(); vpnPanel(); }; f.appendChild(x); }
  const c = el("button", "btn2"); c.textContent = "Privacy tools"; c.onclick = () => { closeOver(); privacyPanel(); }; f.appendChild(c);
  b.appendChild(f);
}

/* ---------------------------------------------------------------- the menu */
function privacyPanel() {
  const t = T(active), web = t && isWeb(t.url), m = cleanMode(), cn = load("cleanN", { n:0 });
  const rows = [
    ["👀", "What sites see about you", "Your address, device and fingerprint", seenPanel],
    ["📦", "Containers", boxes().length ? boxes().length + " - " + boxes().slice(0, 3).join(", ") : "Keep sites apart, each with its own logins", boxPanel],
    ["🧹", "Clean up when I close a site", (m === "pick" ? "For the sites you pick" : m === "all" ? "For every site but the ones you keep" : "Off") + (cn.n ? " · " + cn.n + " cleaned so far" : ""), cleanPanel],
    ["🛍️", "Is this shop real?", web ? "Check " + base(hostOf(t.url)) : "Shops are checked as they open" + (cfg.xShop === false ? " (off)" : ""), () => shopCheck(T(active), true)]
  ];
  const p = panel("pvmenu", "🛡️", "Privacy tools", "Webs 3.10"), b = p.querySelector(".gtb"); p.classList.add("gtmore");
  rows.forEach(r => { const d = el("div", "mi"); d.innerHTML = '<span class="aie"></span><span class="pvn"><b></b><em></em></span>'; d.querySelector(".aie").textContent = r[0];
    d.querySelector("b").textContent = r[1]; d.querySelector("em").textContent = r[2]; d.onclick = () => { closeOver(); r[3](); }; b.appendChild(d); });
}
function cleanPanel() {
  const p = panel("pvclean", "🧹", "Clean up when I close a site", "Cookies and stored data, gone with the last tab"), b = p.querySelector(".gtb");
  const paint = () => {
    const m = cleanMode(), list = m === "pick" ? cfg.xCleanSites || [] : cfg.xKeepSites || [];
    b.innerHTML = '<select class="xin"><option value="">Off</option><option value="pick"' + (m === "pick" ? " selected" : "") + '>Only the sites I pick</option><option value="all"' + (m === "all" ? " selected" : "") + ">Every site, except the ones I keep</option></select>" +
      (m ? '<div class="gtk">' + (m === "pick" ? "Sites cleaned up" : "Sites kept") + '</div><div class="pvl2"></div><div class="xsmall">Add a site from its panel (the icon left of the address).</div>' : "") +
      '<div class="xsmall">You\'re signed out of a site when it\'s cleaned up. Other sites you have open aren\'t touched.</div>';
    b.querySelector("select").onchange = e => { cfg.xClean = e.target.value; saveCfg(); paint(); };
    const l = b.querySelector(".pvl2");
    if (l) {
      if (!list.length) l.innerHTML = '<div class="xsmall">None yet.</div>';
      list.forEach(s => l.appendChild(linkRow("https://" + s + "/", s, "", () => {}, () => {
        const k = m === "pick" ? "xCleanSites" : "xKeepSites"; cfg[k] = (cfg[k] || []).filter(x => x !== s); saveCfg(); paint(); })));
      const t = T(active);
      if (t && isWeb(t.url) && list.indexOf(base(hostOf(t.url))) < 0) {
        const a = el("button", "btn2"); a.textContent = "Add " + base(hostOf(t.url));
        a.onclick = () => { const k = m === "pick" ? "xCleanSites" : "xKeepSites"; cfg[k] = [...new Set((cfg[k] || []).concat(base(hostOf(t.url))))]; saveCfg(); paint(); };
        l.appendChild(a);
      }
    }
  };
  paint();
}

/* ---------------------------------------------------------------- the host's answers */
const onP = on;
on = function (p) {
  const c = p[0];
  if (c === "toast" && /^(Cookies and data for |Could not clear the site)/.test(p[1] || "")) {
    const ids = Object.keys(pendingClean);
    if (ids.length) {
      const bad = /^Could not/.test(p[1]);
      const id = ids.find(i => (p[1] || "").indexOf(pendingClean[i].site) >= 0) || ids[0];
      finishClean(+id, !bad);
      if (bad) toast("Couldn't clean up " + (p[2] ? "- " + p[2] : "this site"));
      return;
    }
  }
  if (c === "sync-done" && quietSync > 0) { quietSync--; return; }
  if (c === "sync-data" && quietRead > 0 && onHandoff(p[2])) return;
  if (c === "sync-read-done" && quietRead > 0) { quietRead--; return; }
  onP(p);
  if (c === "profile-info" && inBox() && !readUntil) { readUntil = Date.now() + 8000; pickUp(); setTimeout(pickUp, 2500); setTimeout(pickUp, 6000); }
  if (c === "tab-closed" && pendingClean[+p[1]]) { clearTimeout(pendingClean[+p[1]].timer); delete pendingClean[+p[1]]; }
};
window.addEventListener("focus", () => { if (inBox()) pickUp(); });

const menuRowsP = X3.menuRows;
X3.menuRows = function (m) {
  if (menuRowsP) menuRowsP(m);
  m.appendChild(row("shield", "Privacy tools…", "", privacyPanel));
};
const commandsP = commands;
commands = function () {
  return commandsP().concat([
    { t:"What sites see about you", k:"", i:"eye", fn:seenPanel },
    { t:"Containers: keep sites apart", k:"", i:"win", fn:boxPanel },
    { t:"Clean up when I close a site", k:"", i:"broom", fn:cleanPanel },
    { t:"Is this shop real?", k:"", i:"shield", fn:() => shopCheck(T(active), true) },
    { t:"Privacy tools", k:"", i:"shield", fn:privacyPanel }
  ]);
};
const tabItemsP = X3.tabItems;
X3.tabItems = function (items, id) {
  if (tabItemsP) tabItemsP(items, id);
  const t = T(id); if (!t || !isWeb(t.url) || PRIVATE) return;
  const l = boxes().filter(n => n !== inBox());
  if (l.length) items.splice(items.length - 1, 0, ["Open in a container…", () => { select(id); boxPanel(); }]);
};
X3.privacy = { boxPanel, openInBox, cleanFor, shopCheck, seenPanel, privacyPanel, cleanPanel, onHandoff, pendingClean, folder:() => folder(), reset:() => { handFolder = null; } };

const st = document.createElement("style");
st.textContent = P.CSS + `
.pvp{width:440px}.pvp .pvg{color:var(--dim)}.pvp .pvr{border-color:var(--line)}.pvp .pvr.safe .pvv{color:#4ec98a}
.pvlist .mi,.gtmore .mi{display:flex;gap:10px;align-items:center;cursor:pointer}.pvi{font-size:18px;width:24px;text-align:center}.pvn{display:flex;flex-direction:column;min-width:0}.pvn em{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvadd,.pvsite{display:flex;gap:6px;margin:8px 0}.pvadd .xin,.pvsite .xin{flex:1;margin:0}.pvchk{display:flex;gap:8px;align-items:center;margin:12px 0 2px;font-size:12.5px}
.pvok{font-size:14px;margin:4px 0 8px}.pvul{margin:4px 0 8px 18px;font-size:12.5px}.pvrows{border-top:1px solid var(--line);margin-top:6px}
.tab.pvgoing{opacity:.35;pointer-events:none;transition:opacity .2s}
`;
document.head.appendChild(st);
})();
