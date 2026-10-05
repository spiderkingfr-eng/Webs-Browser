/* Webs Browser for iPhone - getting things done (2.9, js/gtd.js): Menu → Get things done.
   - Morning routine: your morning sites on a card at the top of the start page from the time you pick (an
     iPhone app can't open a row of sites by itself: most open in Safari), tap through them.
   - Remind me next time I'm on this site: it pops up when you open that site in Webs again.
   - Bookmark checkup: copies of the same page, and sites that can't be reached any more.
   - Weekly reading digest: a card with what you saved over three days ago and never read.
   - Voice commands: "new tab", "open youtube.com", "search for…", "ask Web AI…" and more. */
(function () {
"use strict";
if (!window.GTD || PRIVATE) return;
const R = GTD.routine;

/* ---------------------------------------------------------------- the start page's cards: the morning sites, the digest */
HIDE_KEYS.push(["gtd", "Morning sites and reading digest"]);
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="gtSec" class="wsec hide"></section>');
function cards() {
  const box = $("#gtSec"), out = [];
  if (hidden("gtd")) { wshow("gtSec", false); return; }
  const r = R.get(), opened = load("routineTapped", {}), today = GTD.dayKey();
  // the morning sites: from their time until six hours later, on their days, until they're all opened or put away
  if (load("routineHide", "") !== today && R.due(Object.assign({}, r, { last:"" }))) {
    const left = r.sites.filter(s => !(opened[today] || []).includes(s.u));
    if (left.length) out.push('<div class="gtc"><div class="gth"><b>☀️ Your morning sites</b><button type="button" class="gtx" data-x="routine" aria-label="Put away">✕</button></div>' +
      left.map(s => '<button type="button" class="gts" data-u="' + GTD.esc(s.u) + '"><span>' + GTD.esc(s.t || GTD.hostOf(s.u)) + "</span><em>Open ›</em></button>").join("") + "</div>");
  }
  // the reading digest, once a week
  const dg = load("digestCard", null);
  if (dg && dg.until > Date.now()) {
    const items = GTD.digest.items(load("reading", []));
    if (items.length) out.push('<div class="gtc"><div class="gth"><b>📚 Still on your reading list</b><button type="button" class="gtx" data-x="digest" aria-label="Put away">✕</button></div>' +
      items.slice(0, 5).map(r2 => '<button type="button" class="gts" data-u="' + GTD.esc(r2.u) + '"><span>' + GTD.esc(r2.t || GTD.hostOf(r2.u)) + "</span><em>Read ›</em></button>").join("") + "</div>");
  }
  box.innerHTML = out.join("");
  wshow("gtSec", out.length > 0);
  box.querySelectorAll(".gts").forEach(b => { b.onclick = () => {
    const u = b.dataset.u, o = load("routineTapped", {}); o[today] = (o[today] || []).concat(u); Object.keys(o).forEach(k => { if (k !== today) delete o[k]; }); save("routineTapped", o);
    go(u);
  }; });
  box.querySelectorAll(".gtx").forEach(b => { b.onclick = () => { if (b.dataset.x === "routine") save("routineHide", today); else save("digestCard", null); cards(); }; });
}
HOME_HOOKS.push(cards);
function weekly() { if (GTD.digest.due()) { GTD.digest.seen(); if (GTD.digest.items(load("reading", [])).length) { save("digestCard", { until:Date.now() + 3 * 864e5 }); cards(); } } }
setTimeout(weekly, 3000); setInterval(() => { if (document.visibilityState === "visible") { weekly(); const t = curTab(); if (!(t && t.u)) cards(); } }, 60000);

/* ---------------------------------------------------------------- reminders: when the site opens in Webs */
const go9 = go;
go = function (input, opts) {
  go9(input, opts);
  const t = curTab(); if (!t || !t.u) return;
  const l = GTD.remind.for(hostOf(t.u));
  if (l.length) setTimeout(() => toast("📌 " + l[0].t, { label:"Done", fn:() => { GTD.remind.done(l[0].id); toast("Reminder done"); } }), 600);
};

/* ---------------------------------------------------------------- the sheets */
function sheet(title, html) { openSheet(title, html, { back:openGtd }); return $("#sheetBody"); }
function routineSheet() { const b = sheet("Morning routine", '<div class="gtwrap"></div>'); R.editor(b.querySelector(".gtwrap"), R.get(), () => {}, () => { const t = curTab(); return t && t.u ? { u:t.u, t:t.t } : null; }); }
function remindSheet() {
  const t = curTab();
  if (!t || !t.u || t.internal) { toast("Open the site first"); return; }
  const h = hostOf(t.u), b = sheet("Remind me on " + h, '<p class="gtlead">Next time you open ' + GTD.esc(h) + " in Webs, this pops up.</p>" +
    '<div class="card"><textarea class="gtta" rows="3" maxlength="300" placeholder="e.g. Check if the price went down"></textarea></div><button type="button" class="btn main gtgo">Save</button><div class="gtl"></div>');
  const paint = () => { const l = b.querySelector(".gtl"); l.innerHTML = GTD.remind.for(h).map(x => '<div class="gtr"><span></span><button type="button" data-id="' + x.id + '">Done</button></div>').join("");
    l.querySelectorAll(".gtr span").forEach((s, i) => { s.textContent = GTD.remind.for(h)[i].t; }); l.querySelectorAll("button").forEach(x => { x.onclick = () => { GTD.remind.done(x.dataset.id); paint(); }; }); };
  paint();
  b.querySelector(".gtgo").onclick = () => { const v = b.querySelector(".gtta").value.trim(); if (!v) return; GTD.remind.add(h, v); closeSheet(); toast("📌 Saved"); };
}
function checkSheet() {
  const list = load("bookmarks", []), d = GTD.dupes(list);
  const b = sheet("Bookmark checkup", '<p class="gtlead">' + list.length + " bookmarks.</p><h4>Copies of the same page</h4><div class=\"gtd\"></div><h4>Sites that can't be reached</h4><div class=\"gtdead\"><button type=\"button\" class=\"btn gtgo\">Check every link</button></div>");
  const dd = b.querySelector(".gtd");
  dd.innerHTML = d.length ? d.slice(0, 20).map(g => '<div class="gtr"><span></span><em>' + g.length + " copies</em></div>").join("") + '<button type="button" class="btn main gtfix">Keep one of each</button>' : '<p class="gtlead">None. 👍</p>';
  dd.querySelectorAll(".gtr span").forEach((s, i) => { s.textContent = list[d[i][0]].t || list[d[i][0]].u; });
  const fix = dd.querySelector(".gtfix");
  if (fix) fix.onclick = () => { const drop = new Set(); d.forEach(g => g.slice(1).forEach(i => drop.add(i))); save("bookmarks", list.filter((x, i) => !drop.has(i))); toast("Removed " + drop.size + " copies"); checkSheet(); };
  b.querySelector(".gtdead .gtgo").onclick = async () => {
    const box = b.querySelector(".gtdead"), todo = list.filter(x => /^https?:\/\//i.test(x.u)).slice(0, 300), dead = [];
    box.innerHTML = '<p class="gtlead gtc2">Checking…</p><div class="gtres"></div>';
    let n = 0;
    // a site that answers at all is fine; one whose name doesn't exist any more can't be reached
    const one = async x => { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 10000); try { await fetch(x.u, { mode:"no-cors", signal:ctl.signal, cache:"no-store" }); } catch (e) { dead.push(x); } clearTimeout(tm); n++; const c = box.querySelector(".gtc2"); if (c) c.textContent = "Checked " + n + " of " + todo.length; };
    const work = async () => { while (todo.length && box.isConnected) await one(todo.shift()); };
    await Promise.all([work(), work(), work()]);
    if (!box.isConnected) return;
    box.querySelector(".gtc2").textContent = dead.length ? dead.length + " couldn't be reached. They may be gone, or just down right now." : "Every site answered. 👍";
    box.querySelector(".gtres").innerHTML = dead.map(() => '<div class="gtr"><span></span><button type="button">Remove</button></div>').join("");
    box.querySelectorAll(".gtres .gtr").forEach((r, i) => { r.querySelector("span").textContent = dead[i].t || dead[i].u; r.querySelector("button").onclick = () => { save("bookmarks", load("bookmarks", []).filter(x => x.u !== dead[i].u)); r.remove(); }; });
  };
}
function digestSheet() {
  const items = GTD.digest.items(load("reading", []));
  const b = sheet("Reading digest", '<p class="gtlead">' + (items.length ? "Saved over three days ago and never read:" : "You've read everything you saved. 🎉") + '</p><div class="gtl"></div>');
  b.querySelector(".gtl").innerHTML = items.map(() => '<div class="gtr"><span></span><button type="button" data-a="open">Read</button><button type="button" data-a="done">Done</button></div>').join("");
  b.querySelectorAll(".gtl .gtr").forEach((r, i) => { r.querySelector("span").textContent = items[i].t || items[i].u;
    r.querySelector('[data-a="open"]').onclick = () => go(items[i].u);
    r.querySelector('[data-a="done"]').onclick = () => { const l = load("reading", []), x = l.find(y => y.u === items[i].u); if (x) x.done = true; save("reading", l); r.remove(); }; });
}
/* voice commands */
function runVoice(c) {
  const s = S(), i = s.list.findIndex(t => t.id === s.active), t = curTab();
  switch (c.cmd) {
    case "newtab": ACTIONS.newtab(); break;
    case "close": if (t) closeTab(t.id); break;
    case "nexttab": if (s.list.length) activate(s.list[(i + 1) % s.list.length].id); break;
    case "prevtab": if (s.list.length) activate(s.list[(i - 1 + s.list.length) % s.list.length].id); break;
    case "tab": { const k = c.arg === 9 ? s.list.length - 1 : c.arg - 1; if (s.list[k]) activate(s.list[k].id); break; }
    case "down": scrollBy({ top:innerHeight * .8, behavior:"smooth" }); break;
    case "up": scrollBy({ top:-innerHeight * .8, behavior:"smooth" }); break;
    case "top": scrollTo({ top:0, behavior:"smooth" }); break;
    case "bookmark": if (t && t.u) ACTIONS.mark(); break;
    case "search": case "open": go(c.arg); break;
    case "summarize": if (window.WebAI) WebAI.ask("Summarize this page."); break;
    case "ask": if (window.WebAI) WebAI.ask(c.arg); break;
    case "home": ACTIONS.newtab(); break;
    default: toast("That one works on Webs for Windows"); return true;
  }
  return true;
}
function voiceSheet() {
  const b = sheet("Voice commands", '<button type="button" class="gtmic" aria-label="Listen">🎙️</button><p class="gtlive">' + (GTD.voice.ok ? "Tap the microphone and say a command." : "Listening isn't available here. Type a command, or use the keyboard's 🎙️.") + "</p>" +
    '<div class="card"><input class="gtq" placeholder="e.g. open youtube.com" enterkeyhint="go"></div><h4>You can say</h4><ul class="gthelp">' + GTD.voice.HELP.map(h => "<li>" + GTD.esc(h) + "</li>").join("") + "</ul>");
  const live = b.querySelector(".gtlive"), inp = b.querySelector(".gtq");
  const doIt = text => { const c = GTD.voice.parse(text); if (c && runVoice(c)) { closeSheet(); toast("🎙️ " + text); } else live.textContent = "Didn't catch a command in “" + text + "”."; };
  inp.addEventListener("keydown", e => { if (e.key === "Enter" && inp.value.trim()) doIt(inp.value.trim()); });
  b.querySelector(".gtmic").onclick = () => {
    if (!GTD.voice.ok) { inp.focus(); return; }
    live.textContent = "🎙️ Listening…";
    GTD.voice.listen({ onPartial:x => { live.textContent = "🎙️ " + x; }, onText:(x, c) => { if (c && runVoice(c)) { closeSheet(); toast("🎙️ " + x); } else doIt(x); },
      onError:e => { live.textContent = e === "not-allowed" ? "The microphone isn't allowed for Webs. Type a command instead." : "Didn't hear a command. Try again, or type it."; } });
  };
}
function openGtd() {
  const t = curTab(), web = t && t.u && !t.internal;
  const r = (act, e, n, sub) => '<button type="button" class="mrow" data-gt="' + act + '"><span class="aie">' + e + "</span><span>" + n + "</span><em>" + sub + "</em></button>";
  openSheet("Get things done", '<div class="card">' + r("routine", "☀️", "Morning routine", "Your sites each morning") + (web ? r("remind", "📌", "Remind me on this site", hostOf(t.u)) : "") +
    r("check", "🔖", "Bookmark checkup", "Copies and dead links") + r("digest", "📚", "Reading digest", "Saved, never read") + r("voice", "🎙️", "Voice commands", "Say what to do") + "</div>");
  $("#sheetBody").querySelectorAll("[data-gt]").forEach(b => { b.onclick = () => ({ routine:routineSheet, remind:remindSheet, check:checkSheet, digest:digestSheet, voice:voiceSheet })[b.dataset.gt](); });
}
ACTIONS.gtd = openGtd;
const openMenu8 = openMenu;
openMenu = function () {
  openMenu8();
  const card = $("#sheetBody .card:last-of-type");
  if (card) card.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="gtd">' + ico("check") + "<span>Get things done</span><em>Routine, reminders, voice</em></button>");
};
window.GTDApp = { openGtd, routineSheet, remindSheet, checkSheet, digestSheet, voiceSheet, runVoice, cards };

const st = document.createElement("style");
st.textContent = ".gtc{background:var(--bg2);border-radius:16px;padding:12px 14px;margin-bottom:10px}.gth{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.gtx{border:0;background:none;color:var(--dim);font-size:16px}" +
  ".gts{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;border:0;border-top:1px solid var(--line);background:none;color:var(--fg);font:inherit;font-size:15px;padding:10px 0;text-align:left}" +
  ".gts span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gts em{font-style:normal;color:var(--accent);font-weight:600;font-size:14px}" +
  ".gtlead{color:var(--dim);font-size:14.5px;margin:0 4px 10px}.gtta,.gtq{width:100%;border:0;background:none;color:var(--fg);font:inherit;font-size:16px;padding:10px 12px}.gtgo,.gtfix{width:100%;margin:10px 0}" +
  ".gtr{display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--line);font-size:15px}.gtr span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gtr em{font-style:normal;color:var(--dim);font-size:13px}" +
  ".gtr button{border:1px solid var(--line);background:var(--bg3);color:var(--fg);border-radius:9px;padding:5px 10px;font:inherit;font-size:13px}.gtwrap{font-size:15px}" +
  ".gtmic{display:block;margin:6px auto;width:84px;height:84px;border-radius:50%;border:0;background:var(--accent);font-size:38px;box-shadow:0 10px 26px color-mix(in srgb,var(--accent) 45%,transparent)}.gtlive{text-align:center;color:var(--dim);min-height:22px}" +
  ".gthelp{margin:4px 0 0 20px;color:var(--dim);font-size:14px;line-height:1.7}";
document.head.appendChild(st);
})();
