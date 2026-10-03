/* Webs Browser for iPhone - the start page's widgets: clock styles, holiday
   greetings, the daily streak, today's focus, "continue where you left off",
   a countdown, a quote of the day, habits, a quick note, a calendar, world
   clocks, the year's progress, sunrise and the moon, Wikipedia's "On this day"
   and picture of the day, and the order of it all. The keys match the Windows
   start page (cdLabel, cdDate, habits, ntpNote, clockStyle...), so they come
   along in a backup. */
"use strict";

const dayKey = d => (d || new Date()).toLocaleDateString("en-CA");   // 2025-03-14, in local time
const wshow = (id, on) => { const el = $("#" + id); if (el) el.classList.toggle("hide", !on); return on; };

/* ---------------------------------------------------------------- clock styles */
let clkStyle = null, clkPrev = "";
function drawClock(now, main, ap) {
  const el = $("#clock"), st = ["big", "flip", "analog"].indexOf(cfg.clockStyle) >= 0 ? cfg.clockStyle : "classic";
  if (clkStyle !== st) { clkStyle = st; clkPrev = ""; el.className = "cs-" + st; el.innerHTML = ""; }
  if (st === "analog") {
    if (!el.querySelector("svg")) {
      let ticks = "";
      for (let i = 0; i < 60; i++) ticks += '<line class="' + (i % 5 ? "t" : "T") + '" x1="50" y1="' + (i % 5 ? 6 : 5) + '" x2="50" y2="' + (i % 5 ? 8.5 : 12) + '" transform="rotate(' + i * 6 + ' 50 50)"/>';
      el.innerHTML = '<svg viewBox="0 0 100 100" class="analog" aria-hidden="true"><circle class="face" cx="50" cy="50" r="47"/>' + ticks +
        '<line class="h" x1="50" y1="54" x2="50" y2="27"/><line class="m" x1="50" y1="56" x2="50" y2="15"/><line class="s" x1="50" y1="60" x2="50" y2="11"/><circle class="hub" cx="50" cy="50" r="2.6"/></svg>' +
        '<span class="sr"></span>';
    }
    const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
    el.querySelector(".h").setAttribute("transform", "rotate(" + (h * 30 + m / 2) + " 50 50)");
    el.querySelector(".m").setAttribute("transform", "rotate(" + (m * 6 + s / 10) + " 50 50)");
    const sh = el.querySelector(".s");
    sh.setAttribute("transform", "rotate(" + s * 6 + " 50 50)");
    sh.style.display = cfg.clockSec ? "" : "none";
    el.querySelector(".sr").textContent = main + (ap ? " " + ap : "");
    return;
  }
  // digits that roll (or flip) when they change
  const box = el.querySelector(".digits");
  if (!box || clkPrev.length !== main.length) {
    el.innerHTML = '<span class="digits">' + [...main].map(c => '<span class="' + (c === ":" ? "col" : "dg") + '">' + esc(c) + "</span>").join("") + "</span>" + (ap ? "<small>" + esc(ap) + "</small>" : "");
    clkPrev = main;
    return;
  }
  const spans = box.children;
  for (let i = 0; i < main.length; i++) {
    if (main[i] === clkPrev[i]) continue;
    const sp = spans[i];
    sp.textContent = main[i];
    sp.classList.remove("roll"); void sp.offsetWidth; sp.classList.add("roll");
  }
  const sm = el.querySelector("small");
  if (sm && ap) sm.textContent = ap; else if (!sm && ap) el.insertAdjacentHTML("beforeend", "<small>" + esc(ap) + "</small>"); else if (sm && !ap) sm.remove();
  clkPrev = main;
}

/* ---------------------------------------------------------------- holidays and your birthday */
function specialDay(now) {
  const m = now.getMonth() + 1, d = now.getDate(), us = /^en-US$/i.test(navigator.language);
  const b = /^\d{4}-(\d{2})-(\d{2})$/.exec(cfg.birthday || "");
  if (b && +b[1] === m && +b[2] === d) {
    if (load("bdayShown", "") !== dayKey(now) && !PRIVATE) { save("bdayShown", dayKey(now)); setTimeout(() => { confetti($("#greet")); toast("🎂 Happy birthday from Webs!"); }, 900); }
    return "Happy birthday 🎂";
  }
  const thanks = m === 11 && now.getDay() === 4 && d >= 22 && d <= 28;
  return m === 1 && d === 1 ? "Happy New Year 🎉" : m === 2 && d === 14 ? "Happy Valentine's Day 💘" : m === 3 && d === 17 ? "Happy St. Patrick's Day ☘️" :
    m === 4 && d === 1 ? "Happy April Fools' 🃏" : us && m === 7 && d === 4 ? "Happy 4th of July 🎆" : m === 10 && d === 31 ? "Happy Halloween 🎃" :
    us && thanks ? "Happy Thanksgiving 🦃" : m === 12 && d === 24 ? "Merry Christmas Eve 🎄" : m === 12 && d === 25 ? "Merry Christmas 🎄" :
    m === 12 && d === 31 ? "Happy New Year's Eve 🥂" : "";
}

/* ---------------------------------------------------------------- daily streak */
function markDay() {
  if (PRIVATE) return;
  const days = load("mdays", []), k = dayKey();
  if (days[days.length - 1] !== k) { days.push(k); save("mdays", days.slice(-400)); }
}
function streakDays() {
  const set = new Set(load("mdays", [])), d = new Date();
  let n = 0;
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function streakChip() {
  markDay();
  const n = streakDays(), el = $("#streak");
  if (!wshow("streak", n >= 2 && !PRIVATE && !hidden("streak"))) return;
  el.innerHTML = '<span class="fl">🔥</span> ' + n + "-day streak";
  el.onclick = () => toast("You've opened Webs " + n + " days in a row, and on " + load("mdays", []).length + " days in all.");
}

/* ---------------------------------------------------------------- today's focus */
function focusBox() {
  const box = $("#focusBox");
  if (!wshow("focusSec", !PRIVATE && !hidden("focus"))) return;
  const f = load("focus", null), today = f && f.d === dayKey() ? f : null;
  if (!today) {
    if (box.querySelector("input")) return;   // keep what you are typing
    box.innerHTML = '<input id="focusIn" class="field focus-in" placeholder="Your main focus today?" maxlength="120" enterkeyhint="done" autocomplete="off">';
    $("#focusIn").onkeydown = e => {
      if (e.key !== "Enter") return;
      const t = e.target.value.trim(); if (!t) return;
      save("focus", { d:dayKey(), t, done:false }); e.target.blur(); focusBox();
      $("#focusBox").firstElementChild.classList.add("born");
    };
    return;
  }
  box.innerHTML = '<div class="focus' + (today.done ? " done" : "") + '"><button type="button" class="box" aria-label="Done"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button>' +
    '<span class="tx">' + esc(today.t) + '</span><button type="button" class="x" aria-label="Clear">' + ico("x") + "</button></div>";
  box.querySelector(".box").onclick = () => {
    today.done = !today.done; save("focus", today); focusBox();
    if (today.done) { confetti($("#focusBox")); toast("Nice work. Focus done for today ✨"); }
  };
  box.querySelector(".tx").onclick = () => ask({ title:"Today's focus", fields:[{ k:"t", label:"Focus", value:today.t }], ok:"Save" }, v => {
    if (!v.t.trim()) return false; today.t = v.t.trim().slice(0, 120); save("focus", today); focusBox();
  });
  box.querySelector(".x").onclick = () => { save("focus", null); focusBox(); };
}

/* ---------------------------------------------------------------- continue where you left off */
function contBox() {
  if (PRIVATE || hidden("cont")) { wshow("contSec", false); return; }
  const rows = [], cur = curTab();
  const tab = T.n.list.filter(t => t.u && t !== cur && t.seen).sort((a, b) => b.seen - a.seen)[0];
  if (tab) rows.push('<button type="button" class="row" data-ctab="' + esc(tab.id) + '"><span class="fav">' + (tab.internal ? ico("game") : favHTML(tab.u, tab.t)) +
    '</span><span class="tx"><b>' + esc(tab.t || hostOf(tab.u)) + "</b><i>Open tab · " + esc(ago(tab.seen)) + '</i></span><span class="end">' + ico("right") + "</span></button>");
  const note = load("notes", []).filter(n => n.ts && Date.now() - n.ts < 3 * 864e5).sort((a, b) => b.ts - a.ts)[0];
  if (note) rows.push('<button type="button" class="row" data-cnote="' + esc(note.id) + '"><span class="fav">' + ico("note") + '</span><span class="tx"><b>' +
    esc(note.title || (note.text || "").split("\n")[0] || "Untitled") + "</b><i>Note · edited " + esc(ago(note.ts)) + '</i></span><span class="end">' + ico("right") + "</span></button>");
  const ws = load("wordState", null), dayN = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  if (!ws || ws.day !== dayN || !ws.done) rows.push('<button type="button" class="row" data-cgame="1"><span class="fav">' + ico("game") +
    "</span><span class=\"tx\"><b>Today's word puzzle</b><i>" + (ws && ws.day === dayN && ws.guesses.length ? ws.guesses.length + " of 6 guesses used" : "A new five-letter word is waiting") + '</i></span><span class="end">' + ico("right") + "</span></button>");
  $("#cont").innerHTML = rows.slice(0, 3).join("");
  wshow("contSec", rows.length > 0);
}
$("#cont").addEventListener("click", e => {
  const r = e.target.closest(".row"); if (!r) return;
  if (r.dataset.ctab) activate(r.dataset.ctab);
  else if (r.dataset.cnote) openNote(r.dataset.cnote);
  else if (r.dataset.cgame) openInternal("games.html#word", "Games");
});

/* ---------------------------------------------------------------- countdown (cdLabel, cdDate) */
function cdBox() {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cfg.cdDate || "");
  if (!m || PRIVATE || hidden("cd")) { wshow("cdSec", false); return; }
  const now = new Date(), target = new Date(+m[1], m[2] - 1, +m[3]);
  const days = Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  if (days < -1) { wshow("cdSec", false); return; }
  const label = String(cfg.cdLabel || "").trim().slice(0, 40) || "the big day";
  const made = load("cdMade", null);
  if (!made || made.d !== cfg.cdDate) save("cdMade", { d:cfg.cdDate, ts:Date.now() });
  const start = (made && made.d === cfg.cdDate ? made.ts : Date.now()), total = Math.max(1, (target - start) / 864e5);
  const pct = Math.max(0, Math.min(1, 1 - days / total)), C = 2 * Math.PI * 26;
  $("#cdBox").innerHTML = '<div class="cd"><svg viewBox="0 0 60 60" class="ring"><circle cx="30" cy="30" r="26" class="tr"/><circle cx="30" cy="30" r="26" class="pg" style="stroke-dasharray:' +
    C.toFixed(1) + ";stroke-dashoffset:" + (C * (1 - pct)).toFixed(1) + '"/></svg><b class="n">' + (days <= 0 ? "🎉" : days) + '</b><div class="tx"><b>' +
    (days > 0 ? (days === 1 ? "1 day" : days + " days") + " until " + esc(label) : days === 0 ? "Today is " + esc(label) + "!" : esc(label) + " was yesterday") +
    "</b><i>" + esc(target.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric", year:"numeric" })) + "</i></div></div>";
  $("#cdBox").onclick = () => openSettings("customize");
  wshow("cdSec", true);
}

/* ---------------------------------------------------------------- quote of the day */
const QUOTES = [
  ["The secret of getting ahead is getting started.", "Mark Twain"], ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["Well done is better than well said.", "Benjamin Franklin"], ["Whether you think you can or you think you can't, you're right.", "Henry Ford"],
  ["The best way out is always through.", "Robert Frost"], ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
  ["What we think, we become.", "Buddha"], ["Act as if what you do makes a difference. It does.", "William James"],
  ["Stay hungry, stay foolish.", "Stewart Brand"], ["Quality is not an act, it is a habit.", "Aristotle"],
  ["Little by little, one travels far.", "J.R.R. Tolkien"], ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
  ["Fall seven times, stand up eight.", "Japanese proverb"], ["The journey of a thousand miles begins with one step.", "Lao Tzu"],
  ["Imagination is more important than knowledge.", "Albert Einstein"], ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche"],
  ["Energy and persistence conquer all things.", "Benjamin Franklin"], ["Be yourself; everyone else is already taken.", "Oscar Wilde"],
  ["In the middle of difficulty lies opportunity.", "Albert Einstein"], ["Dream big and dare to fail.", "Norman Vaughan"],
  ["The harder the conflict, the more glorious the triumph.", "Thomas Paine"], ["Turn your wounds into wisdom.", "Oprah Winfrey"],
  ["Everything you can imagine is real.", "Pablo Picasso"], ["Make each day your masterpiece.", "John Wooden"],
  ["Done is better than perfect.", "Sheryl Sandberg"], ["Courage is grace under pressure.", "Ernest Hemingway"],
  ["You miss 100% of the shots you don't take.", "Wayne Gretzky"], ["Hard work beats talent when talent doesn't work hard.", "Tim Notke"],
  ["Small deeds done are better than great deeds planned.", "Peter Marshall"], ["The only way to do great work is to love what you do.", "Steve Jobs"],
  ["Doubt kills more dreams than failure ever will.", "Suzy Kassem"], ["Action is the foundational key to all success.", "Pablo Picasso"],
  ["Believe you can and you're halfway there.", "Theodore Roosevelt"], ["A goal without a plan is just a wish.", "Antoine de Saint-Exupéry"],
  ["Keep your face always toward the sunshine.", "Walt Whitman"], ["If you're going through hell, keep going.", "Winston Churchill"],
  ["Life is 10% what happens to you and 90% how you react to it.", "Charles R. Swindoll"], ["Nothing will work unless you do.", "Maya Angelou"],
  ["The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese proverb"], ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
  ["Discipline is choosing between what you want now and what you want most.", "Abraham Lincoln (attributed)"], ["Creativity is intelligence having fun.", "Albert Einstein (attributed)"],
  ["We are what we repeatedly do.", "Will Durant"], ["Opportunities don't happen. You create them.", "Chris Grosser"],
  ["The man who moves a mountain begins by carrying away small stones.", "Confucius"], ["Happiness depends upon ourselves.", "Aristotle"],
  ["It does not matter how slowly you go as long as you do not stop.", "Confucius"], ["Every moment is a fresh beginning.", "T.S. Eliot"],
  ["Tough times never last, but tough people do.", "Robert H. Schuller"], ["What you do today can improve all your tomorrows.", "Ralph Marston"],
  ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"], ["Strive for progress, not perfection.", "Unknown"],
  ["Great things never come from comfort zones.", "Unknown"], ["Be so good they can't ignore you.", "Steve Martin"],
  ["If it doesn't challenge you, it won't change you.", "Fred DeVito"], ["Your limitation—it's only your imagination.", "Unknown"],
  ["The future depends on what you do today.", "Mahatma Gandhi"], ["Mistakes are proof that you are trying.", "Jennifer Lim"],
  ["Work hard in silence, let your success be your noise.", "Frank Ocean"], ["One day or day one. You decide.", "Unknown"]
];
let quoteN = -1;
function quoteBox(step) {
  if (PRIVATE || hidden("quote")) { wshow("quoteSec", false); return; }
  if (quoteN < 0) quoteN = (Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5) * 7) % QUOTES.length;
  quoteN = (quoteN + (step || 0)) % QUOTES.length;
  const [q, a] = QUOTES[quoteN], box = $("#quoteBox");
  box.innerHTML = '<blockquote class="quote"><span class="qm">“</span><p>' + esc(q) + "</p><cite>" + esc(a) + '</cite><div class="qa2"><button type="button" class="wbtn" id="quoteNext">Another</button>' +
    '<button type="button" class="wbtn" id="quoteCopy">Copy</button></div></blockquote>';
  if (step) box.firstElementChild.classList.add("swap");
  $("#quoteNext").onclick = () => quoteBox(1);
  $("#quoteCopy").onclick = () => copyText("“" + q + "” - " + a);
  wshow("quoteSec", true);
}

/* ---------------------------------------------------------------- habits (the Windows format: { id, name, days:{ "2025-03-14":1 } }) */
function habitBox() {
  if (PRIVATE || hidden("habits")) { wshow("habitSec", false); return; }
  wshow("habitSec", true);
  const list = load("habits", []), today = new Date(), days = [];
  for (let i = 6; i >= 0; i--) days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
  const streak = h => { let n = 0; for (let i = 0; i < 400; i++) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); if ((h.days || {})[dayKey(d)]) n++; else if (i) break; } return n; };
  $("#habitBox").innerHTML = (list.length ? '<div class="hgrid"><span></span>' + days.map(d => "<span class=\"hd\">" + esc(d.toLocaleDateString([], { weekday:"narrow" })) + "</span>").join("") + "<span></span>" +
    list.map(h => '<span class="hn" data-h="' + esc(h.id) + '">' + esc(h.name) + "</span>" + days.map((d, i) => '<button type="button" class="hc' + ((h.days || {})[dayKey(d)] ? " on" : "") + (i === 6 ? " today" : "") +
      '" data-h="' + esc(h.id) + '" data-d="' + dayKey(d) + '" aria-label="' + esc(h.name + ", " + d.toLocaleDateString()) + '"></button>').join("") +
      '<span class="hs">' + (streak(h) ? "🔥" + streak(h) : "") + "</span>").join("") + "</div>" : '<p class="wempty">Track something you want to do every day: water, reading, the gym, practice…</p>') +
    '<input class="field" id="habitNew" placeholder="Add a habit" maxlength="60" enterkeyhint="done" autocomplete="off">';
  $("#habitNew").onkeydown = e => {
    if (e.key !== "Enter") return;
    const v = e.target.value.trim(); if (!v) return;
    const all = load("habits", []); all.push({ id:"h" + Date.now().toString(36), name:v.slice(0, 60), days:{} }); save("habits", all.slice(0, 12)); habitBox();
  };
}
$("#habitBox").addEventListener("click", e => {
  const c = e.target.closest(".hc"), n = e.target.closest(".hn");
  if (c) {
    const all = load("habits", []), h = all.find(x => x.id === c.dataset.h); if (!h) return;
    h.days = h.days || {};
    if (h.days[c.dataset.d]) delete h.days[c.dataset.d]; else h.days[c.dataset.d] = 1;
    save("habits", all); habitBox();
    const again = $('#habitBox .hc[data-h="' + h.id + '"][data-d="' + c.dataset.d + '"]');
    if (again && again.classList.contains("on")) again.classList.add("pop");
  } else if (n) {
    const all = load("habits", []), h = all.find(x => x.id === n.dataset.h); if (!h) return;
    pick(h.name, [
      { label:"Rename", fn:() => ask({ title:"Rename habit", fields:[{ k:"n", label:"Name", value:h.name }], ok:"Save" }, v => { if (!v.n.trim()) return false; h.name = v.n.trim().slice(0, 60); save("habits", all); habitBox(); }) },
      { label:"Remove", danger:true, fn:() => { save("habits", all.filter(x => x.id !== h.id)); habitBox(); toast("Habit removed", { label:"Undo", fn:() => { save("habits", all); habitBox(); } }); } }
    ]);
  }
});

/* ---------------------------------------------------------------- quick note (ntpNote) */
let qnT = 0;
function noteBox() {
  if (PRIVATE || hidden("notew")) { wshow("noteSec", false); return; }
  wshow("noteSec", true);
  const ta = $("#quickNote");
  if (document.activeElement !== ta) ta.value = load("ntpNote", "") || "";
}
$("#quickNote").addEventListener("input", e => { clearTimeout(qnT); qnT = setTimeout(() => save("ntpNote", e.target.value.slice(0, 5000)), 300); });
$("#noteToNotes").onclick = () => {
  const t = $("#quickNote").value.trim();
  if (!t) { toast("Write something first"); return; }
  const all = load("notes", []); all.push({ id:uid(), title:t.split("\n")[0].slice(0, 60), text:t, ts:Date.now(), site:"" }); save("notes", all);
  $("#quickNote").value = ""; save("ntpNote", "");
  toast("Saved to Notes", { label:"Open", fn:() => ACTIONS.notes() });
};

/* ---------------------------------------------------------------- calendar */
let calOff = 0;
function calBox() {
  if (PRIVATE || hidden("cal")) { wshow("calSec", false); return; }
  wshow("calSec", true);
  const now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + calOff, 1), mon = !/^en-US$/i.test(navigator.language);
  const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + (mon ? 6 : 0)) % 7;
  const marks = {};
  const cd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cfg.cdDate || ""); if (cd) marks[cfg.cdDate] = cfg.cdLabel || "Countdown";
  const b = /^\d{4}-(\d{2})-(\d{2})$/.exec(cfg.birthday || ""); if (b) marks[first.getFullYear() + "-" + b[1] + "-" + b[2]] = "Your birthday";
  const names = [];
  for (let i = 0; i < 7; i++) names.push(new Date(2024, 0, (mon ? 1 : 7) + i).toLocaleDateString([], { weekday:"narrow" }));
  let cells = "";
  for (let i = 0; i < lead; i++) cells += "<span></span>";
  for (let d = 1; d <= n; d++) {
    const dt = new Date(first.getFullYear(), first.getMonth(), d), k = dayKey(dt), today = k === dayKey(now);
    cells += '<button type="button" class="cd2' + (today ? " today" : "") + (marks[k] ? " mark" : "") + (dt.getDay() === 0 || dt.getDay() === 6 ? " we" : "") + '" data-k="' + k + '">' + d + "</button>";
  }
  $("#calTitle").textContent = first.toLocaleDateString([], { month:"long", year:"numeric" });
  $("#calBox").innerHTML = '<div class="calnav"><button type="button" class="wbtn" data-cal="-1" aria-label="Previous month">' + ico("back") + "</button><b>" +
    esc(first.toLocaleDateString([], { month:"long", year:"numeric" })) + '</b><button type="button" class="wbtn" data-cal="0">Today</button><button type="button" class="wbtn" data-cal="1" aria-label="Next month">' + ico("fwd") + "</button></div>" +
    '<div class="calg">' + names.map(x => "<i>" + esc(x) + "</i>").join("") + cells + "</div>";
  $("#calBox").dataset.marks = JSON.stringify(marks);
}
$("#calBox").addEventListener("click", e => {
  const nav = e.target.closest("[data-cal]");
  if (nav) { calOff = nav.dataset.cal === "0" ? 0 : calOff + +nav.dataset.cal; calBox(); const g = $("#calBox .calg"); if (g) g.classList.add(nav.dataset.cal === "-1" ? "fromL" : "fromR"); return; }
  const c = e.target.closest("[data-k]"); if (!c) return;
  const now = new Date(), [y, m, d] = c.dataset.k.split("-").map(Number), dt = new Date(y, m - 1, d);
  const diff = Math.round((dt - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  const marks = JSON.parse($("#calBox").dataset.marks || "{}");
  toast(dt.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" }) + " · " + (diff === 0 ? "today" : diff > 0 ? "in " + diff + (diff === 1 ? " day" : " days") : -diff + (diff === -1 ? " day ago" : " days ago")) +
    (marks[c.dataset.k] ? " · " + marks[c.dataset.k] : ""));
});

/* ---------------------------------------------------------------- world clocks */
function wclockBox() {
  if (PRIVATE || hidden("wclock")) { wshow("wclockSec", false); return; }
  wshow("wclockSec", true);
  const now = new Date(), here = dayKey(now);
  const cities = String(cfg.wclocks || "London, Tokyo, New York").split(",").map(x => x.trim()).filter(Boolean).slice(0, 6);
  $("#wclockBox").innerHTML = '<div class="wcl">' + cities.map(c => {
    const z = zoneOf(c);
    if (!z) return '<div class="wc"><b>' + esc(c) + "</b><span>Unknown city</span></div>";
    const h = +now.toLocaleString("en-US", { timeZone:z, hour:"numeric", hourCycle:"h23" }), dk = now.toLocaleDateString("en-CA", { timeZone:z });
    return '<div class="wc"><em>' + (h >= 6 && h < 18 ? "☀️" : "🌙") + "</em><b>" + esc(titleCase(c)) + '</b><span class="t">' +
      esc(now.toLocaleTimeString([], { timeZone:z, hour:cfg.clock24 ? "2-digit" : "numeric", minute:"2-digit", hourCycle:cfg.clock24 ? "h23" : "h12" })) +
      "</span><span>" + (dk > here ? "Tomorrow" : dk < here ? "Yesterday" : "Today") + " · " + esc(gmtLabel(zoneOffset(z, now))) + "</span></div>";
  }).join("") + "</div>";
}

/* ---------------------------------------------------------------- the year's progress */
function yearBox() {
  if (PRIVATE || hidden("year")) { wshow("yearSec", false); return; }
  wshow("yearSec", true);
  const now = new Date(), y = now.getFullYear();
  const span = (a, b) => (now - a) / (b - a);
  const dow = (now.getDay() + 6) % 7, wk0 = new Date(y, now.getMonth(), now.getDate() - dow);
  const rows = [["Today", span(new Date(y, now.getMonth(), now.getDate()), new Date(y, now.getMonth(), now.getDate() + 1))],
    ["This week", span(wk0, new Date(wk0.getFullYear(), wk0.getMonth(), wk0.getDate() + 7))],
    [now.toLocaleDateString([], { month:"long" }), span(new Date(y, now.getMonth(), 1), new Date(y, now.getMonth() + 1, 1))],
    [String(y), span(new Date(y, 0, 1), new Date(y + 1, 0, 1))]];
  const doy = Math.floor((new Date(y, now.getMonth(), now.getDate()) - new Date(y, 0, 1)) / 864e5) + 1, len = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  $("#yearBox").innerHTML = '<div class="yp"><div class="yh"><b>Day ' + doy + " of " + len + "</b><span>" + (len - doy) + " days left this year</span></div>" +
    rows.map(([l, p]) => '<div class="yr"><span>' + esc(l) + '</span><div class="bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div><b>' + Math.floor(p * 100) + "%</b></div>").join("") + "</div>";
}

/* ---------------------------------------------------------------- sunrise, sunset and the moon (worked out on the phone) */
function sunTimes(date, lat, lon) {
  const rad = Math.PI / 180, J1970 = 2440588, J2000 = 2451545, J0 = .0009, e = rad * 23.4397;
  const d = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 864e5 - .5 + J1970) - J2000;
  const lw = rad * -lon, phi = rad * lat, n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + .98560028 * ds), C = rad * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI, dec = Math.asin(Math.sin(e) * Math.sin(L));
  const transit = (a) => J2000 + a + .0053 * Math.sin(M) - .0069 * Math.sin(2 * L);
  const noon = transit(ds);
  const w = Math.acos((Math.sin(rad * -.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const toDate = j => new Date((j + .5 - J1970) * 864e5);
  if (isNaN(w)) return { noon:toDate(noon), polar:Math.sin(phi) * Math.sin(dec) > 0 ? "day" : "night" };
  const set = transit(J0 + (w + lw) / (2 * Math.PI) + n);
  return { rise:toDate(noon - (set - noon)), set:toDate(set), noon:toDate(noon) };
}
function moonPhase(date) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 864e5;
  const age = ((date / 864e5 - ref) % syn + syn) % syn, p = age / syn;
  const names = [[.0339, "New moon", "🌑"], [.216, "Waxing crescent", "🌒"], [.284, "First quarter", "🌓"], [.466, "Waxing gibbous", "🌔"], [.534, "Full moon", "🌕"],
    [.716, "Waning gibbous", "🌖"], [.784, "Last quarter", "🌗"], [.966, "Waning crescent", "🌘"], [1.01, "New moon", "🌑"]];
  const n = names.find(x => p < x[0]);
  return { name:n[1], emoji:n[2], lit:Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100), toFull:Math.round(((.5 - p + 1) % 1) * syn) };
}
let skyBusy = false;
async function skyBox() {
  if (PRIVATE || hidden("sky")) { wshow("skySec", false); return; }
  wshow("skySec", true);
  const box = $("#skyBox"), now = new Date(), mp = moonPhase(now);
  let loc = null;
  if (cfg.wxCity === "@here" && cfg.wxLat != null) loc = { name:"Your location", lat:cfg.wxLat, lon:cfg.wxLon };
  else if (cfg.wxCity) {
    const c = load("skyLoc", null);
    if (c && c.q === cfg.wxCity.toLowerCase()) loc = c;
    else if (!skyBusy) {
      skyBusy = true;
      try {
        const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(cfg.wxCity))).json();
        const r = g && g.results && g.results[0];
        if (r) { loc = { q:cfg.wxCity.toLowerCase(), name:r.name, lat:r.latitude, lon:r.longitude }; save("skyLoc", loc); }
      } catch (e) {}
      skyBusy = false;
    }
  }
  const t = d => d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit", hourCycle:cfg.clock24 ? "h23" : "h12" });
  let sun = '<div class="sk"><em>🌅</em><b>Sunrise and sunset</b><span>Add your city under Weather in Customize to see them</span></div>';
  if (loc) {
    const s = sunTimes(now, loc.lat, loc.lon);
    if (s.polar) sun = '<div class="sk"><em>' + (s.polar === "day" ? "☀️" : "🌌") + "</em><b>" + (s.polar === "day" ? "The sun doesn't set today" : "The sun doesn't rise today") + "</b><span>" + esc(loc.name) + "</span></div>";
    else {
      const len = (s.set - s.rise) / 6e4, frac = Math.max(0, Math.min(1, (now - s.rise) / (s.set - s.rise)));
      sun = '<div class="sunarc"><svg viewBox="0 0 200 70" aria-hidden="true"><path d="M10 64 Q100 -14 190 64" class="arc"/><circle r="6" class="sunb" cx="' + (10 + 180 * frac).toFixed(1) + '" cy="' +
        (64 - 156 * frac * (1 - frac)).toFixed(1) + '"/></svg><div class="st"><span>🌅 ' + esc(t(s.rise)) + "</span><span>" + Math.floor(len / 60) + " h " + Math.round(len % 60) +
        " min of daylight</span><span>🌇 " + esc(t(s.set)) + "</span></div><small>" + esc(loc.name) + "</small></div>";
    }
  }
  box.innerHTML = sun + '<div class="sk moon"><em>' + mp.emoji + "</em><b>" + esc(mp.name) + "</b><span>" + mp.lit + "% lit" + (mp.toFull > 0 && mp.name !== "Full moon" ? " · full moon in " + mp.toFull + (mp.toFull === 1 ? " day" : " days") : "") + "</span></div>";
}

/* ---------------------------------------------------------------- Wikipedia: on this day, and the picture of the day
   From Wikipedia's free feed (no account). Kept for the day. */
const pad2 = n => String(n).padStart(2, "0");
let otdBusy = false;
async function otdBox(force) {
  if (PRIVATE || hidden("otd")) { wshow("otdSec", false); return; }
  wshow("otdSec", true);
  const now = new Date(), key = dayKey(now), box = $("#otdBox");
  let c = load("otd", null);
  if (!c || c.d !== key || force) {
    if (!c || c.d !== key) box.innerHTML = '<div class="skel3"><i></i><i></i><i></i></div>';
    if (otdBusy) return;
    otdBusy = true;
    try {
      const j = await (await fetch("https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/" + pad2(now.getMonth() + 1) + "/" + pad2(now.getDate()))).json();
      const list = (j.selected || []).map(x => { const p = (x.pages || [])[0] || {}; return { y:x.year, t:x.text, u:p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page, img:p.thumbnail && p.thumbnail.source }; })
        .filter(x => x.t).slice(0, 25);
      c = { d:key, list };
      save("otd", c);
    } catch (e) { if (!c || c.d !== key) { box.innerHTML = '<p class="wempty">Couldn\'t reach Wikipedia right now. Pull down to try again.</p>'; otdBusy = false; return; } }
    otdBusy = false;
  }
  const pickN = c.list.length ? [0, 1, 2].map(i => c.list[(now.getDate() + i * 5) % c.list.length]).filter((x, i, a) => a.indexOf(x) === i) : [];
  box.innerHTML = pickN.map(otdRow).join("") || '<p class="wempty">Nothing for today.</p>';
}
const otdRow = x => '<button type="button" class="otd" data-u="' + esc(x.u || "") + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") +
  "<b>" + esc(x.y) + "</b><span>" + esc(x.t) + "</span></button>";
document.addEventListener("click", e => {
  const o = e.target.closest(".otd");
  if (o && o.dataset.u) go({ u:o.dataset.u });
});
$("#otdMore").onclick = () => {
  const c = load("otd", null);
  if (!c || !c.list.length) return;
  openSheet("On this day · " + new Date().toLocaleDateString([], { month:"long", day:"numeric" }), '<div class="otdlist">' + c.list.map(otdRow).join("") + '</div><p class="note">From Wikipedia</p>', { kind:"otd", full:true });
};

let potdBusy = false;
async function potd() {
  const cap = $("#potdCap");
  if (!cfg.potd || cfg.mbg || PRIVATE) { if (cap) cap.remove(); return; }
  const now = new Date(), key = dayKey(now);
  let c = load("potd", null);
  if ((!c || c.d !== key) && !potdBusy) {
    potdBusy = true;
    try {
      const j = await (await fetch("https://en.wikipedia.org/api/rest_v1/feed/featured/" + now.getFullYear() + "/" + pad2(now.getMonth() + 1) + "/" + pad2(now.getDate()))).json();
      const im = j.image;
      if (im && im.thumbnail) {
        // a bigger copy than the feed's thumbnail, for a phone screen
        const src = im.thumbnail.source.replace(/\/(\d+)px-/, (m, w) => "/" + Math.max(+w, 1280) + "px-");
        c = { d:key, src, small:im.thumbnail.source, title:(im.description && im.description.text) || (im.title || "").replace(/^File:/, "").replace(/\.\w+$/, ""), page:im.file_page || "" };
        save("potd", c);
      }
    } catch (e) {}
    potdBusy = false;
  }
  if (!c || !c.src) return;
  const l = $("#bgl");
  l.style.backgroundImage = "url(" + JSON.stringify(c.src) + "), url(" + JSON.stringify(c.small) + ")";
  l.style.setProperty("--dimv", (+cfg.bgDim || 0) / 100);
  document.body.classList.add("pic");
  if (!cap) $("#homeFoot").insertAdjacentHTML("afterend", '<a id="potdCap" href="#" class="potdcap"></a>');
  const a = $("#potdCap");
  a.textContent = "Picture of the day: " + String(c.title).replace(/<[^>]+>/g, "").slice(0, 90) + " · Wikimedia Commons";
  a.onclick = e => { e.preventDefault(); if (c.page) go({ u:c.page }, { mode:"outside" }); };
}
function refreshWidgets() {
  const o = load("otd", null); if (o) { o.d = ""; save("otd", o); }
  const p = load("potd", null); if (p) { p.d = ""; save("potd", p); }
}

/* ---------------------------------------------------------------- tips you can swipe */
(function swipeTips() {
  const tip = $("#tip");
  let x0 = null;
  tip.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive:true });
  tip.addEventListener("touchend", e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 40) return;
    tipOfDay(dx < 0 ? 1 : TIPS.length - 1);
    const t = $("#tipT"); t.classList.remove("fromL", "fromR"); void t.offsetWidth; t.classList.add(dx < 0 ? "fromR" : "fromL");
  });
})();
TIPS.push("Swipe a tip sideways to see the next one.", "Pull down on the start page to refresh the weather and Wikipedia.",
  "Type “note: buy milk” or “todo: call mom” in the address bar to save it straight away.", "Press and hold the tabs button for a quick menu.",
  "Press and hold a tab in the tab switcher to pin it, duplicate it or close the others.", "Type “qr” and some text to make a QR code.",
  "Tools in the menu has a calculator, unit converter, password maker, stopwatch, focus timer and more.", "Customize lets you pick a live wallpaper and rearrange the start page.",
  "Type “translate hello to spanish” or “wiki octopus” for an instant answer.", "Swipe the address bar left or right to switch tabs.");

/* ---------------------------------------------------------------- the order of the start page */
const ORDERABLE = [["focusSec", "Today's focus"], ["topSec", "Shortcuts"], ["contSec", "Continue where you left off"], ["recentSec", "Jump back in"], ["readSec", "Reading list"],
  ["todoSec", "To-do list"], ["cdSec", "Countdown"], ["quoteSec", "Quote of the day"], ["habitSec", "Habits"], ["noteSec", "Quick note"], ["calSec", "Calendar"],
  ["wclockSec", "World clocks"], ["yearSec", "Year progress"], ["skySec", "Sunrise, sunset and moon"], ["otdSec", "On this day"], ["tip", "Tip of the day"]];
function sectionOrder() {
  const want = Array.isArray(cfg.ntpOrder) ? cfg.ntpOrder.filter(id => ORDERABLE.some(o => o[0] === id)) : [];
  return want.concat(ORDERABLE.map(o => o[0]).filter(id => want.indexOf(id) < 0));
}
function applyOrder() {
  const wrap = $("#home .wrap"), foot = $("#homeFoot");
  sectionOrder().forEach(id => { const el = document.getElementById(id); if (el && el.parentNode === wrap) wrap.insertBefore(el, foot); });
}
function openOrder() {
  const list = () => '<p class="note" style="margin:0 6px 12px">Drag the handles to rearrange the start page. Turn parts on or off in Customize.</p><div class="card olist" id="olist">' +
    sectionOrder().map(id => '<div class="orow" data-id="' + id + '"><span class="k">' + esc((ORDERABLE.find(o => o[0] === id) || [])[1]) + "</span>" + ico("grip", "ic grip") + "</div>").join("") +
    '</div><div class="acts"><button type="button" class="btnx" id="oReset">' + ico("undo") + "Reset order</button></div>";
  openSheet("Rearrange the start page", list(), { kind:"order", full:true, back:() => openSettings("customize") });
  const wire = () => {
    dragSort($("#olist"), ".orow", { drop:(from, to) => {
      const o = sectionOrder(); const [m] = o.splice(from, 1); o.splice(to, 0, m); setCfg("ntpOrder", o); applyOrder();
    } });
    $("#oReset").onclick = () => { setCfg("ntpOrder", []); applyOrder(); $("#sheetBody").innerHTML = list(); wire(); toast("Back to the usual order"); };
  };
  wire();
}
SETACTIONS.order = openOrder;

/* ---------------------------------------------------------------- the engine badge: tap to switch */
$("#engBadge").addEventListener("click", e => {
  e.stopPropagation();
  pick("Search with", engineKeys().map(k => ({ label:ENGINES[k].name + (engine() === ENGINES[k] ? " ✓" : ""), fn:() => { setCfg("search", k); renderHome(); toast("Searching with " + ENGINES[k].name); } })));
});

/* ---------------------------------------------------------------- together */
HOME_HOOKS.push(() => {
  applyOrder();
  streakChip(); focusBox(); contBox(); cdBox(); quoteBox(0); habitBox(); noteBox(); calBox(); wclockBox(); yearBox(); skyBox(); otdBox(); potd();
});
setInterval(() => {
  const t = curTab();
  if (document.hidden || (t && t.u)) return;
  if (!hidden("wclock")) wclockBox();
  if (!hidden("year")) yearBox();
  if (!hidden("p5") && !PRIVATE && typeof Phantom !== "undefined") Phantom.render($("#p5Box"), { tick:true });
}, 20000);

/* ---------------------------------------------------------------- the Phantom calendar (Persona 5 style, js/phantom.js)
   Off until it's turned on in Customize; it slams in the first time the start page shows. */
HIDE_KEYS.push(["p5", "Phantom calendar (Persona 5 style)"]);
DEFAULT_OFF.push("p5");
ORDERABLE.unshift(["p5Sec", "Phantom calendar"]);       // near the top: it's the one you turned on to see
BACKUP_KEYS.push("p5");                 // the deadline comes along in a backup
$("#homeFoot").insertAdjacentHTML("beforebegin", '<section id="p5Sec" class="wsec hide"><div id="p5Box"></div></section>');
let p5Seen = false;
HOME_HOOKS.push(() => {
  const on = typeof Phantom !== "undefined" && !hidden("p5") && !PRIVATE;
  wshow("p5Sec", on);
  if (!on) { p5Seen = false; return; }
  Phantom.render($("#p5Box"), { animate:!p5Seen });
  p5Seen = true;
});
