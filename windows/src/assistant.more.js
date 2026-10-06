/* ---------------------------------------------------------------- Webs 3.14: more for the assistant (ideas #001-#025)
   New voice commands, modes that take over what you say for a while (dictation, cooking, translating, search results),
   and the settings for them in Voice control → Assistant → More. Everything here is kept on this PC:
   routines (xRoutines), reminders (wsb.voiceRem), the conversation log (wsb.asLog), the day's activity (wsb.dayLog),
   the story so far (wsb.asStory) and the pomodoro coach's state (wsb.pomo). */
(function () {
"use strict";
if (PRIVATE || !X3.voice || !X3.voice.brain || !window.AI) return;
const V = X3.voice, VL = V.state(), B = V.brain, SP = V.speaker, SIL = V.SILENT;
const saveCfg = () => { saveNow("settings"); sendPrefs(); };
const R = s => new RegExp("^(?:" + s + ")$");
// new commands go first, so they're tried before the older, broader ones; a command that returns null lets the others try
const added = [];
function cmd(id, g, ex, re, fn) { added.push({ id, g, ex, res:(Array.isArray(re) ? re : [re]), fn }); }
const say = (t, lang) => { if (t) SP.say(t, lang); };
const sayMore = t => { if (t) SP.add(t); };
const tab = () => T(active);
const webTab = () => { const t = tab(); return t && isWeb(t.url) && !t.sleep ? t : null; };
const mins = s => { if (s < 50) return Math.max(1, Math.round(s)) + " second" + (Math.round(s) === 1 ? "" : "s"); s = Math.round(s / 60); return s >= 60 ? Math.floor(s / 60) + " hour" + (s >= 120 ? "s" : "") + (s % 60 ? " " + (s % 60) + " minute" + (s % 60 === 1 ? "" : "s") : "") : s + " minute" + (s === 1 ? "" : "s"); };
const day = d => (d || new Date()).toLocaleDateString("en-CA");
const pick = l => l[Math.floor(Math.random() * l.length)];
const ask1 = async (prompt, task) => (await AI.ask(task || "answer", prompt)).text.trim();

/* ---------------------------------------------------------------- modes: one at a time takes over what you say */
let mode = null;      // { name, take(text, s) -> string | "" | null, end() }
function setMode(m) { if (mode && mode !== m && mode.end) try { mode.end(); } catch (e) {} mode = m; paintMode(); }
function endMode(name) { if (mode && (!name || mode.name === name)) { const m = mode; mode = null; if (m.end) try { m.end(); } catch (e) {} paintMode(); } }
function paintMode() { const b = $("#vcb"); if (b) b.dataset.mode = mode ? mode.name : ""; }
V.intercept = async (text, s) => {
  if (!mode) return null;
  if (/^(stop|exit|end|cancel|quit)( the)? (dictation|dictating|translat(or|ing)|cooking|recipe|search results|results)( mode)?$/.test(s)) { const n = mode.name; endMode(); return n === "dictation" ? "Dictation off" : "Okay"; }
  return mode.take(text, s);
};
V.mode = () => mode && mode.name;

/* ---------------------------------------------------------------- #001 routines: { name, steps: "one step per line" } */
const routines = () => (Array.isArray(cfg.xRoutines) ? cfg.xRoutines : []).filter(r => r && r.name && r.steps);
if (!Array.isArray(cfg.xRoutines)) cfg.xRoutines = [{ name:"study", steps:"say Let's get some studying done.\nfocus for 25 minutes\nplay rain sounds\nsay Focus mode is on. I'll keep the rain going." }];
let routineRun = 0;
async function runRoutine(r) {
  const my = ++routineRun, steps = String(r.steps).split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 20);
  V.hud.open(); V.hud.you(r.name + " routine"); V.hud.clearActs(); V.hud.text("Starting your " + r.name + " routine."); V.hud.state("idle");
  say("Starting your " + r.name + " routine.");
  for (let i = 0; i < steps.length; i++) {
    if (my !== routineRun) return;
    const st = steps[i];
    let m;
    if ((m = /^say (.+)$/i.exec(st))) { sayMore(m[1]); V.hud.act("💬 " + m[1]); await quiet(); continue; }
    if ((m = /^wait (.+)$/i.exec(st))) { const s = V.secs(m[1]); if (s > 0) { V.hud.act("⏳ " + mins(s)); await waitFor(s * 1000, my); } continue; }
    let res = null; try { res = await V.act(st); } catch (e) {}
    V.hud.act((res === null ? "✗ " : "✓ ") + (res || st));
  }
  if (my === routineRun) { sayMore("That's your " + r.name + " routine done."); V.hud.later(); }
}
const quiet = () => new Promise(r => SP.whenQuiet(r));
const waitFor = (ms, my) => new Promise(r => { const end = Date.now() + ms, t = setInterval(() => { if (my !== routineRun || Date.now() >= end) { clearInterval(t); r(); } }, 500); });
cmd("routine2", "Assistant", "start my study routine", R("(start|run|begin|do)( my| the)? (.+?) routine|(.+?) routine( time)?"), m => {
  const n = V.norm(m[3] || m[4] || "").replace(/^(my|the) /, ""), r = routines().find(x => V.norm(x.name) === n);
  if (!r) return null;
  runRoutine(r); return SIL;
});
cmd("stoproutine", "Assistant", "stop the routine", R("stop (the |my )?routine|cancel (the |my )?routine"), () => { routineRun++; return "Routine stopped"; });

/* ---------------------------------------------------------------- #002 the day so far, and a recap at a set time */
// to-dos ticked off today and focus minutes, kept per day (the to-do lists live in other pages: their changes arrive as storage events)
const dayLog = () => { const l = load("dayLog", {}); const d = day(); l[d] = l[d] || { todos:0, focus:0 }; return [l, l[d]]; };
const putDay = l => { const cut = day(new Date(Date.now() - 14 * 864e5)); Object.keys(l).forEach(k => { if (k < cut) delete l[k]; }); save("dayLog", l); };
let todoWas = load("todo", []);
addEventListener("storage", e => {
  if (e.key !== "wsb.todo") return;
  const now = load("todo", []), before = new Map((todoWas || []).map(t => [t.id, !!t.done])), n = now.filter(t => t.done && before.get(t.id) === false).length;
  todoWas = now;
  if (n) { const [l, d] = dayLog(); d.todos += n; putDay(l); }
});
const startFocusM = startFocus;
startFocus = function (mins0) {
  const f0 = load("focus", null);
  if (mins0 < 0 && f0 && f0.until > Date.now()) { const [l, d] = dayLog(); d.focus = Math.max(0, d.focus - Math.round((f0.until - Date.now()) / 60000)); putDay(l); }
  if (mins0 > 0) { const [l, d] = dayLog(); d.focus += mins0; putDay(l); }
  return startFocusM.apply(this, arguments);
};
function recap() {
  try { if (typeof stFlush === "function") stFlush(); } catch (e) {}
  const st = (load("screentime", {})[day()] || {}), sites = Object.entries(st).sort((a, b) => b[1] - a[1]), total = sites.reduce((n, x) => n + x[1], 0);
  const [, d] = dayLog(), start = new Date(); start.setHours(0, 0, 0, 0);
  const marks = load("bookmarks", []).filter(b => b.ts >= +start).length, notes = load("notes", []).filter(n => n.ts >= +start).length;
  const nice = h => h.replace(/^www\./, "").replace(/\.(com|org|net|co\.uk|io|tv)$/, "");
  const out = [];
  if (total < 60) out.push("You've hardly been online today.");
  else out.push("Today you spent " + mins(total) + " on the web" + (sites.length ? ", mostly on " + sites.slice(0, 3).map(x => nice(x[0]) + (x[1] >= 300 ? " (" + mins(x[1]) + ")" : "")).join(", ").replace(/, ([^,]*)$/, " and $1") : "") + ".");
  const did = [];
  if (d.focus) did.push("focused for " + mins(d.focus * 60));
  if (d.todos) did.push("finished " + d.todos + " to-do" + (d.todos === 1 ? "" : "s"));
  if (marks) did.push("saved " + marks + " bookmark" + (marks === 1 ? "" : "s"));
  if (notes) did.push("wrote " + notes + " note" + (notes === 1 ? "" : "s"));
  if (did.length) out.push("You " + did.join(", ").replace(/, ([^,]*)$/, " and $1") + ".");
  out.push(d.focus || d.todos ? pick(["Nice work.", "Good day's work.", "Well done."]) : pick(["Tomorrow's another day.", "Rest well."]));
  return out.join(" ");
}
cmd("recap", "Assistant", "how was my day", R("how was my day|(give me )?(a |my )?(daily )?recap( of (my|the) day)?|what did i do today|sum up my day"), () => recap());
setInterval(() => {
  const at = cfg.xRecapAt; if (!at || !/^\d{1,2}:\d{2}$/.test(at)) return;
  const [h, m] = at.split(":").map(Number), now = new Date();
  if (now.getHours() !== h || now.getMinutes() !== m || load("recapDone", "") === day()) return;
  save("recapDone", day());
  const t = recap(); toast("🌙 " + t); say(t);
}, 20000);

/* ---------------------------------------------------------------- #003 spoken reminders */
function clockAt(s) {
  // "5 pm", "5:30 pm", "17:30", "five thirty pm", "noon", "midnight"
  s = String(s).trim().replace(/\./g, "");
  if (/^noon$/.test(s)) s = "12:00 pm"; if (/^midnight$/.test(s)) s = "12:00 am";
  let m = /^(\d{1,2})(?:[: ](\d{2}))?\s*(am|pm|a m|p m)?$/.exec(s);
  let h, mi, ap;
  if (m) { h = +m[1]; mi = +(m[2] || 0); ap = (m[3] || "").replace(" ", ""); }
  else {
    m = /^([a-z]+)(?: (o'?clock|thirty|fifteen|forty five|[a-z]+(?: [a-z]+)?))?\s*(am|pm)?$/.exec(s);
    if (!m) return null;
    h = V.num(m[1]); mi = !m[2] || /o'?clock/.test(m[2]) ? 0 : V.num(m[2]); ap = m[3] || "";
    if (!isFinite(h) || !isFinite(mi)) return null;
  }
  if (h > 23 || mi > 59) return null;
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  const d = new Date(); d.setHours(h, mi, 0, 0);
  if (!ap && h < 12 && d <= new Date()) d.setHours(h + 12);         // "at 5" in the afternoon means 5 pm
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return +d;
}
function remindAt(when) {
  when = when.trim();
  let m;
  if ((m = /^in (.+)$/.exec(when))) { const s = V.secs(m[1]); return s > 0 ? Date.now() + s * 1000 : null; }
  if ((m = /^at (.+)$/.exec(when))) return clockAt(m[1]);
  if ((m = /^tomorrow( morning)?$/.exec(when))) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return +d; }
  return null;
}
const fmtWhen = t => { const d = new Date(t), today = day(d) === day(); return (today ? "" : "tomorrow ") + "at " + d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }); };
function addReminder(text, at) {
  const l = load("voiceRem", []); l.push({ id:Date.now().toString(36), at, text:text.slice(0, 200) }); save("voiceRem", l.slice(-50));
  return "Okay, I'll remind you to " + text + (at - Date.now() < 3 * 3600e3 ? " in " + mins((at - Date.now()) / 1000) : " " + fmtWhen(at));
}
cmd("remind", "Assistant", "remind me in 20 minutes to check the oven", [R("remind me (in .+?|at .+?|tomorrow( morning)?) to (.+)"), R("remind me to (.+?) (in .+|at .+|tomorrow( morning)?)")], m => {
  const when = m[3] !== undefined && /^(in|at|tomorrow)/.test(m[1]) ? m[1] : m[2], what = /^(in|at|tomorrow)/.test(m[1]) ? m[3] : m[1];
  const at = remindAt(when || ""); if (!at || !what) return null;
  return addReminder(what.trim(), at);
});
cmd("reminders", "Assistant", "what are my reminders", R("what are my reminders|(list|show) (my )?reminders|any reminders"), () => {
  const l = load("voiceRem", []).filter(r => r.at > Date.now()).sort((a, b) => a.at - b.at);
  return l.length ? "You have " + l.length + " reminder" + (l.length === 1 ? "" : "s") + ": " + l.slice(0, 4).map(r => r.text + " " + fmtWhen(r.at)).join("; ") + "." : "You have no reminders.";
});
cmd("clearrem", "Assistant", "cancel my reminders", R("(cancel|clear|delete) (all )?(my )?reminders"), () => { save("voiceRem", []); return "Reminders cleared"; });
setInterval(() => {
  const l = load("voiceRem", []), due = l.filter(r => r.at <= Date.now());
  if (!due.length) return;
  save("voiceRem", l.filter(r => r.at > Date.now()));
  due.forEach(r => { if (Date.now() - r.at > 6 * 3600e3) return; V.ding("bubble"); toast("⏰ " + r.text, { label:"Snooze 10 min", fn:() => addReminder(r.text, Date.now() + 600e3) }); say("Reminder: " + r.text); });
}, 5000);

/* ---------------------------------------------------------------- #004 quiz me, #006 story time */
cmd("quiz", "Assistant", "quiz me on the solar system", R("quiz me (on|about) (.+)|(give me|start) a quiz (on|about) (.+)|test me (on|about) (.+)"), m => {
  const topic = (m[2] || m[5] || m[7] || "").trim(); if (!topic) return null;
  B.ask("Quiz me on " + topic + ".", { show:"Quiz: " + topic, follow:20000,
    task:"Run a spoken quiz on " + topic + ". Ask one multiple-choice question at a time with options A, B and C, then stop and wait for their answer. When they answer, say briefly if they're right and why, give the score so far, then ask the next question. After 5 questions give the final score. No [[do:]] lines." });
  return SIL;
});
const story = () => load("asStory", null);
function tellStory(topic, fresh) {
  let s = story();
  if (fresh || !s) s = { topic:topic || "", parts:[], ts:Date.now() };
  const n = s.parts.length + 1;
  B.ask(n === 1 ? "Tell me a story" + (s.topic ? " about " + s.topic : "") + "." : "Go on with the story.", { show:n === 1 ? "Story time" + (s.topic ? ": " + s.topic : "") : "The story, part " + n, follow:12000,
    task:"Tell a story meant to be listened to" + (s.topic ? ", about " + s.topic : "") + ". It's told in parts; this is part " + n + " of about 6. " +
      (s.parts.length ? "The story so far:\n" + s.parts.join("\n\n").slice(-8000) + "\n\n" : "") +
      "Tell only part " + n + ": 5 to 7 sentences, vivid and easy to follow aloud" + (n >= 6 ? ", and bring the story to a satisfying end." : ", ending on a small cliffhanger, then ask if they want to hear more.") + " No [[do:]] lines.",
    done:full => { s.parts.push(full.replace(/\[\[[^\]]*\]\]/g, "").trim()); s.ts = Date.now(); if (n >= 6) s.parts = []; save("asStory", n >= 6 ? null : s); } });
  return SIL;
}
cmd("story", "Assistant", "tell me a story about dragons", R("tell me a (new )?story( about (.+))?|story time|(start|tell me) a new story( about (.+))?"), m => tellStory(m[3] || m[6] || "", true));
cmd("storymore", "Assistant", "continue the story", R("(continue|go on with|carry on with) the story|what happens next|keep going|tell me more( of the story)?|yes,? (go on|tell me more|more)"), () => story() && story().parts.length ? tellStory("", false) : null);

/* ---------------------------------------------------------------- #005 translating */
const LANGS = { spanish:"es", french:"fr", german:"de", italian:"it", portuguese:"pt", japanese:"ja", chinese:"zh", mandarin:"zh", korean:"ko", russian:"ru", arabic:"ar", hindi:"hi", dutch:"nl",
  polish:"pl", turkish:"tr", swedish:"sv", greek:"el", vietnamese:"vi", indonesian:"id", ukrainian:"uk", thai:"th", filipino:"fil", tagalog:"fil", danish:"da", norwegian:"no", finnish:"fi", czech:"cs", romanian:"ro", hungarian:"hu", hebrew:"he", english:"en" };
const LANG_RE = "(" + Object.keys(LANGS).join("|") + ")";
async function translateSay(text, langName) {
  const code = LANGS[langName]; if (!code) return null;
  V.hud.open(); V.hud.you(text + " → " + langName); V.hud.state("thinking"); V.hud.text(""); V.hud.clearActs();
  try {
    const t = (await ask1("Translate into " + langName + ". Reply with only the translation, nothing else:\n" + text)).replace(/^["“]|["”]$/g, "");
    V.hud.text(t); V.hud.later(); say(t, code);
    return "";
  } catch (e) { return e.message || "I couldn't translate that."; }
}
cmd("translate1", "Assistant", "how do you say good morning in Japanese", [R("how (do|would) (you|i) say (.+) in " + LANG_RE), R("translate (.+) (in|into|to) " + LANG_RE), R("say (.+) in " + LANG_RE)], m => {
  const l = m.length;     // the language is always the last group
  const lang = m[l - 1], text = m[3] && /^(how)/.test(m[0]) ? m[3] : m[1];
  if (!lang || !text || /^(this|the) page$/.test(text)) return null;
  return translateSay(text, lang).then(r => r || SIL);
});
cmd("translator", "Assistant", "translator mode to Spanish", R("(start )?translat(or|ion|e) mode (to|in|into|for) " + LANG_RE + "|translate everything (to|into) " + LANG_RE), m => {
  const lang = m[4] || m[6];
  setMode({ name:"translator", take:(text, s) => { V.awake(30000); return /^stop/.test(s) ? null : translateSay(text, lang).then(r => { V.awake(30000); return r; }); } });
  V.awake(30000);
  return "Translator on: I'll say everything in " + lang + ". Say “stop translating” when you're done.";
});

/* ---------------------------------------------------------------- #007 hands-free recipes */
async function startCooking() {
  const t = webTab(); if (!t) return "Open a recipe first";
  V.hud.open(); V.hud.you("Cooking: " + (t.title || hostOf(t.url))); V.hud.state("thinking"); V.hud.text("Reading the recipe…"); V.hud.clearActs();
  let r;
  try {
    const pg = await X3.ai.readTab(t);
    const res = await AI.ask("", "From this recipe page, reply with only JSON in a ```json block like {\"title\":\"…\",\"ingredients\":[\"200 g flour\"],\"steps\":[\"Heat the oven to 180 °C.\"]}. Keep each step short and easy to follow aloud; keep quantities exact. If it isn't a recipe, reply {\"none\":true}.\n\n<page>\n" + pg.title + "\n" + pg.text.slice(0, 20000) + "\n</page>");
    r = AI.json(res.text) || {};
  } catch (e) { V.hud.state("error"); V.hud.text(e.message || "I couldn't read that page."); return e.message || "I couldn't read that page."; }
  const steps = (Array.isArray(r.steps) ? r.steps : []).map(String).filter(Boolean), ing = (Array.isArray(r.ingredients) ? r.ingredients : []).map(String).filter(Boolean);
  if (r.none || !steps.length) { V.hud.text("That doesn't look like a recipe."); V.hud.later(); return "That doesn't look like a recipe"; }
  let i = -1;
  const show = () => { V.hud.clearActs(); V.hud.you((r.title || "Recipe") + (i >= 0 ? " · step " + (i + 1) + " of " + steps.length : "")); V.hud.text(i >= 0 ? steps[i] : ing.join(" · ")); };
  const stepSay = () => { show(); const last = i === steps.length - 1; return "Step " + (i + 1) + ". " + steps[i] + (last ? " That's the last step. Enjoy!" : ""); };
  const keep = () => V.awake(180000);
  setMode({ name:"cooking", take:(text, s) => {
    keep();
    if (/^(next|next step|go on|done|ok(ay)?( next)?|got it|what'?s next|continue)$/.test(s)) { if (i >= steps.length - 1) { endMode("cooking"); return "That was the last step. Enjoy your " + (r.title || "food") + "!"; } i++; return stepSay(); }
    if (/^(back|previous|previous step|go back|last step)$/.test(s)) { i = Math.max(0, i - 1); return stepSay(); }
    if (/^(repeat|again|say (that|it) again|what was that|repeat (that|the step))$/.test(s)) return i >= 0 ? stepSay() : "You need: " + ing.join(", ");
    if (/^(ingredients|what do i need|list the ingredients|what are the ingredients)$/.test(s)) { show(); return "You need: " + ing.join(", ") + "."; }
    let m = /^(go to )?step (.+)$/.exec(s); if (m) { const n = V.num(m[2]); if (n >= 1 && n <= steps.length) { i = n - 1; return stepSay(); } }
    m = /^how (much|many) (.+?)( do i need)?$/.exec(s); if (m) { const w = m[2].replace(/^(of )?(the )?/, ""); const hit = ing.filter(x => x.toLowerCase().includes(w.replace(/s$/, ""))); return hit.length ? hit.join(", ") : "The recipe doesn't list " + w; }
    return null;
  }, end:() => { V.hud.later(); } });
  keep(); show();
  V.hud.state("idle");
  return (r.title ? r.title + ". " : "") + "You'll need " + ing.length + " ingredients" + (ing.length ? ": " + ing.slice(0, 8).join(", ") + (ing.length > 8 ? " and more" : "") : "") + ". There are " + steps.length + " steps. Say “next” when you're ready, “repeat”, “back”, or “stop cooking”.";
}
cmd("cook", "Assistant", "start cooking", R("(let'?s|start) cooking|cooking mode|(read|walk me through|start) (the |this )?recipe( step by step)?|read me the recipe"), () => startCooking());

/* ---------------------------------------------------------------- #008 the pomodoro coach */
const POMO = { focus:25, short:5, long:20, rounds:4 };
function pomoSay(t) { toast("🍅 " + t); say(t); }
function pomoTick() {
  const p = load("pomo", null); if (!p || Date.now() < p.until) return;
  if (p.phase === "focus") {
    if (p.round >= POMO.rounds) { save("pomo", { round:p.round, phase:"long", until:Date.now() + POMO.long * 60000 }); pomoSay("That's " + POMO.rounds + " rounds done. Brilliant. Take a longer break: " + POMO.long + " minutes."); }
    else { save("pomo", { round:p.round, phase:"break", until:Date.now() + POMO.short * 60000 }); pomoSay(pick(["Round " + p.round + " done.", "Time's up on round " + p.round + "."]) + " Take a " + POMO.short + " minute break. " + pick(["Stretch your legs.", "Drink some water.", "Look away from the screen."])); }
    try { startFocus(-1); } catch (e) {}
  } else if (p.phase === "break") {
    save("pomo", { round:p.round + 1, phase:"focus", until:Date.now() + POMO.focus * 60000 }); startFocus(POMO.focus);
    pomoSay("Break's over. Round " + (p.round + 1) + ": focus for " + POMO.focus + " minutes.");
  } else { save("pomo", null); pomoSay("Your pomodoro session is finished. Nice work."); }
}
setInterval(pomoTick, 5000);
cmd("pomo", "Assistant", "start a pomodoro", R("(start )?(a )?pomodoro( session| coach)?|(be my|start the) (focus|pomodoro) coach"), () => {
  save("pomo", { round:1, phase:"focus", until:Date.now() + POMO.focus * 60000 }); startFocus(POMO.focus);
  return "Pomodoro started. Round 1 of " + POMO.rounds + ": focus for " + POMO.focus + " minutes. I'll tell you when to take a break.";
});
cmd("pomostop", "Assistant", "stop the pomodoro", R("(stop|end|cancel) (the )?(pomodoro|coach|focus coach)"), () => { if (!load("pomo", null)) return null; save("pomo", null); try { startFocus(-1); } catch (e) {} return "Pomodoro stopped"; });
cmd("pomoleft", "Assistant", "how long is left", R("how (long|much time)( is)? left|time left|how long until (my |the )?break"), () => {
  const p = load("pomo", null); if (!p) { const f = typeof focusState === "function" && focusState(); return f ? mins((f.until - Date.now()) / 1000) + " of focus left" : null; }
  return mins(Math.max(60, p.until - Date.now()) / 1000) + " left in " + (p.phase === "focus" ? "round " + p.round : "your break");
});

/* ---------------------------------------------------------------- #009 search results, read out */
// the window may not read other sites; the Windows side fetches for it (feed-fetch), and its answer is caught here
const hostWait = {};
function hostFetch(url) {
  return new Promise((ok, bad) => {
    (hostWait[url] = hostWait[url] || []).push([ok, bad]);
    if (hostWait[url].length === 1) { send("feed-fetch", url); setTimeout(() => { const w = hostWait[url]; if (w) { delete hostWait[url]; w.forEach(x => x[1](new Error("timeout"))); } }, 12000); }
  });
}
const onM = on;
on = function (p) {
  if (p && p[0] === "feed" && hostWait[p[1]]) { const w = hostWait[p[1]]; delete hostWait[p[1]]; w.forEach(x => p[3] === "error" ? x[1](new Error("error")) : x[0](p[2] || "")); return; }
  return onM.apply(this, arguments);
};
function ddgResults(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html"), out = [];
  doc.querySelectorAll(".result, .web-result").forEach(r => {
    const a = r.querySelector("a.result__a, a.result-link, h2 a"); if (!a || out.length >= 5) return;
    let u = a.getAttribute("href") || ""; const m = /[?&]uddg=([^&]+)/.exec(u); if (m) u = decodeURIComponent(m[1]); if (u.startsWith("//")) u = "https:" + u;
    if (!/^https?:\/\//.test(u) || /duckduckgo\.com\/y\.js|ad_domain|ad_provider/.test(u) || r.classList.contains("result--ad")) return;
    out.push({ t:a.textContent.replace(/\s+/g, " ").trim(), u, host:hostOf(u).replace(/^www\./, "") });
  });
  return out;
}
const ORD = { one:1, first:1, "1":1, two:2, second:2, "2":2, three:3, third:3, "3":3, four:4, fourth:4, "4":4, five:5, fifth:5, "5":5 };
async function readResults(q) {
  V.hud.open(); V.hud.you("Search: " + q); V.hud.state("thinking"); V.hud.text(""); V.hud.clearActs();
  let res = [];
  try { res = ddgResults(await hostFetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q))); } catch (e) {}
  if (!res.length) { go(q); V.hud.text("Here are the results."); V.hud.later(); return "I couldn't read the results out, so I've opened them for you"; }
  const top = res.slice(0, 3);
  top.forEach((r, i) => V.hud.act((i + 1) + ". " + r.t.slice(0, 60), () => { newTab(r.u, false); endMode("results"); }));
  V.hud.text(top.map((r, i) => (i + 1) + ". " + r.t + " (" + r.host + ")").join("\n")); V.hud.state("idle");
  setMode({ name:"results", take:(text, s) => {
    const m = /^(open |go to |pick |number |the )*(one|two|three|four|five|first|second|third|fourth|fifth|[1-5])( one| result| link)?$/.exec(s);
    if (!m) return null;
    const r = res[ORD[m[2]] - 1]; if (!r) return "There's no result " + m[2];
    newTab(r.u, false); endMode("results"); return "Opening " + r.host;
  } });
  setTimeout(() => endMode("results"), 60000);
  V.awake(20000);
  return "Here's what I found. " + top.map((r, i) => ["One", "Two", "Three"][i] + ": " + r.t + ", from " + r.host + ".").join(" ") + " Say a number to open one.";
}
cmd("results", "Assistant", "read me the results for best pizza in town", R("(read me|tell me|what are) the (top |search )?results for (.+)|search for (.+?) and read (me )?(the |out the )?results|(look up|search for) (.+) and tell me( what you find)?"), m => readResults((m[3] || m[4] || m[8] || "").trim()));

/* ---------------------------------------------------------------- #010 / #023 saved assistants: "switch to Friday" */
cmd("switchas", "Assistant", "switch to Friday", R("switch to (?!(the )?(tab|next|previous|last|first|dark|light|reader|theater|full)\\b)(.+)|(i want to )?talk to (?!(the )?(assistant|ai|web ai)$)(.+)|(use|bring back) (the )?(main|default|normal) (assistant|voice)|switch back"), m => {
  const who = m[3] || m[7];
  if (!who) { cfg.xAsActive = -1; VL.who = 0; saveCfg(); return "Back to " + (cfg.xAsName || "Webs"); }
  const want = V.norm(who), l = B.people(), i = l.findIndex(p => V.norm(p.name) === want);
  if (i < 0) return null;
  cfg.xAsActive = i; VL.who = 0; saveCfg();
  return pick(["Hi, " + l[i].name + " here.", l[i].name + " at your service.", "Hello! It's " + l[i].name + "."]);
});

/* ---------------------------------------------------------------- #011 whisper mode */
cmd("whisper", "Assistant", "whisper mode", R("whisper( mode)?( on)?|(talk|speak) (quietly|softly|more quietly)"), () => { cfg.xAsWhisper = "on"; saveCfg(); return "I'll keep my voice down."; });
cmd("whisperoff", "Assistant", "speak normally", R("whisper( mode)? off|speak normally|(talk|speak) (normally|louder)|normal voice"), () => { cfg.xAsWhisper = ""; saveCfg(); return "Normal voice."; });

/* ---------------------------------------------------------------- #013 what does this error mean */
cmd("error", "Assistant", "what does this error mean", R("what does (this|that|the) error( message)? mean|explain (this|that|the) error|what('?s| is| went) wrong( (here|with this page))?|why (isn'?t|is not) this (page )?working"), async () => {
  const t = webTab(); if (!t) return "Open the page with the error first";
  let pg = null; try { pg = await X3.ai.readTab(t); } catch (e) {}
  B.ask("What does this error mean?", { show:"What does this error mean?", task:"They're looking at a page with an error. Page: " + (t.title || "") + " (" + t.url.slice(0, 200) + ").\n" +
    (pg && pg.sel ? "What they selected:\n" + pg.sel.slice(0, 2000) + "\n" : "") + (pg ? "The page's text:\n" + pg.text.slice(0, 6000) : "(The page couldn't be read: explain from the title and address.)") +
    "\nFind the error, say in plain words what it means, and the one or two things most likely to fix it. Short, spoken." });
  return SIL;
});

/* ---------------------------------------------------------------- #014 what can I do here? */
function here() {
  const t = tab(), u = t ? t.url : "", h = t ? hostOf(u) : "", ti = t ? (t.title || "").toLowerCase() : "";
  if (!t || !isWeb(u)) return ["open YouTube", "what's the weather", "set a timer for 10 minutes", "how was my day"];
  if (/youtube|twitch|netflix|crunchyroll|vimeo|disneyplus|primevideo|hulu/.test(h) || t.media) return ["pause", "skip 30 seconds", "play faster", "picture in picture", "key moments"];
  if (/recipe|allrecipes|bbcgoodfood|seriouseats|food\.com|tasty/.test(h + " " + u + " " + ti)) return ["start cooking", "read me the recipe", "set a timer for 20 minutes", "bookmark this"];
  if (/amazon|ebay|etsy|aliexpress|walmart|bestbuy|shop|store|cart|checkout/.test(h + " " + u)) return ["is this shop real", "compare my tabs", "bookmark this", "summarize this page"];
  if (/mail\.google|outlook|mail\.yahoo|proton/.test(h)) return ["start dictation", "type hello", "make that more polite", "read this page"];
  if (/docs\.google|notion|wordpress|medium\.com\/new|substack/.test(h)) return ["start dictation", "fix the spelling in that", "what does this error mean"];
  return ["summarize this page", "read this page", "explain this page", "translate this page", "what does this error mean"];
}
cmd("here", "Assistant", "what can I do here", R("what can i (do|say) (here|on this (page|site))|what can you do (here|on this (page|site)|with this (page|site))|help me with this (page|site)"), () => {
  const l = here(); V.hud.open(); V.hud.you("What can I do here?"); V.hud.text(""); V.hud.clearActs(); V.hud.state("idle");
  l.forEach(c => V.hud.act("“" + c + "”", () => V.run(c))); V.hud.later();
  return "Here you can say: " + l.slice(0, 4).map(x => "“" + x + "”").join(", ").replace(/, ([^,]*)$/, " or $1") + ".";
});

/* ---------------------------------------------------------------- #015 dictation, #016 fixing what was dictated */
let lastTyped = "", lastTypedAt = 0, typedTab = 0, typing = Promise.resolve();     // typing: one sentence at a time, in order
const PUNCT = [[/\s*\b(comma)\b/g, ","], [/\s*\b(period|full stop)\b/g, "."], [/\s*\b(question mark)\b/g, "?"], [/\s*\b(exclamation (mark|point))\b/g, "!"], [/\s*\b(colon)\b/g, ":"], [/\s*\b(semicolon)\b/g, ";"],
  [/\s*\b(new paragraph)\b\s*/g, "\n\n"], [/\s*\b(new line|next line)\b\s*/g, "\n"], [/\b(open quote)\s*/g, "“"], [/\s*\b(close quote)\b/g, "”"]];
function spoken2text(t, after) {
  let s = " " + String(t).trim();
  PUNCT.forEach(([re, v]) => { s = s.replace(re, v); });
  s = s.replace(/^ /, "");
  if (!after || /[.!?\n]\s*$/.test(after)) s = s.replace(/^(\s*)(\S)/, (m, a, b) => a + b.toUpperCase());
  s = s.replace(/([.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, "I");
  return (after && !/[\s\n“]$/.test(after) && !/^[,.!?:;\n]/.test(s) ? " " : "") + s;
}
async function typeIt(text, replace) {
  const t = webTab(); if (!t) return { ok:0, why:"tab" };
  try { const r = await X3.ai.pageTool(t, "x-type", JSON.stringify(replace != null ? { t:text, r:replace } : { t:text }), 5000); if (r && r.ok) typedTab = t.id; return r || { ok:0 }; }
  catch (e) { return { ok:0, why:"page" }; }
}
const typeFail = r => r.why === "tab" ? "Open a page with a text box first" : r.why === "none" ? "Click in a text box first, then say it again" : r.why === "gone" ? "I can't find that text any more" : "I couldn't type there";
cmd("type", "Assistant", "type see you at five", R("type (.+)"), async m => {
  const txt = spoken2text(m[1], lastTypedAt > Date.now() - 600000 ? lastTyped : ""), r = await typeIt(txt);
  if (!r.ok) return typeFail(r);
  lastTyped = txt.trim(); lastTypedAt = Date.now(); return SIL;
});
cmd("dictate", "Assistant", "start dictation", R("(start|begin) (dictation|dictating|typing)|dictation( mode)?( on)?|take (a )?dictation|type what i say"), () => {
  if (!webTab()) return "Click in a text box on a page first";
  let all = "";
  const take = async (text, s) => {
    if (/^(stop|end|finish)( the)? (dictation|dictating|typing)$|^i'?m done$/.test(s)) { endMode("dictation"); return "Dictation off"; }
    if (/^(delete|undo|scratch) that$/.test(s)) { if (!lastTyped) return ""; const r = await typeIt("", lastTyped); if (r.ok) { all = all.slice(0, Math.max(0, all.length - lastTyped.length)); lastTyped = ""; } return r.ok ? "" : typeFail(r); }
    if (fixRe.test(s)) return null;      // "make that more polite": the fixing command below
    const txt = spoken2text(text, all), r = await typeIt(txt);
    if (!r.ok) return typeFail(r);
    all += txt; lastTyped = txt.trim(); lastTypedAt = Date.now();
    V.chip("heard", txt.trim());
    return "";
  };
  setMode({ name:"dictation", take:(text, s) => {
    V.awake(60000);
    if (fixRe.test(s)) return null;      // "make that more polite": the fixing command below, once the typing before it is done
    const job = typing.then(() => take(text, s)); typing = job.catch(() => {}); return job;
  }, end:() => { V.hud.later(); } });
  V.awake(60000);
  V.hud.open(); V.hud.you("Dictation"); V.hud.text("Talk and I'll type. Say “comma”, “period” or “new line” for punctuation, “scratch that” to undo, and “stop dictation” when you're done."); V.hud.clearActs(); V.hud.state("follow");
  return "Dictation on. Go ahead.";
});
const HOW = { polite:"more polite", formal:"more formal", professional:"more professional", shorter:"shorter", longer:"a bit longer", friendlier:"friendlier", friendly:"friendlier", casual:"more casual", clearer:"clearer", simpler:"simpler", nicer:"nicer", funnier:"funnier" };
const fixRe = new RegExp("^(make (that|it) (more |sound more |a bit |a little )?(" + Object.keys(HOW).join("|") + ")|fix (the )?(spelling|grammar|typos)( in (that|it))?|rewrite (that|it)( to be (more )?(\\w+))?|clean (that|it) up)$");
cmd("fixtyped", "Assistant", "make that more polite", R(fixRe.source.replace(/^\^\(|\)\$$/g, "")), async (m) => {
  const s = m[0];
  await typing;
  if (!lastTyped || Date.now() - lastTypedAt > 15 * 60000) return null;
  const mm = fixRe.exec(s), word = mm && (mm[4] || mm[12]);
  const how = /spelling|grammar|typos|clean/.test(s) ? "correct in spelling, grammar and punctuation, changing nothing else" : word && HOW[word] ? HOW[word] : word ? "more " + word : "clearer";
  let nw = "";
  try { nw = (await ask1("Rewrite this text so it is " + how + ". Keep the meaning and the language. Reply with only the rewritten text:\n" + lastTyped)).replace(/^["“]|["”]$/g, ""); } catch (e) { return e.message || "Web AI didn't answer"; }
  if (!nw) return "I couldn't rewrite that";
  const r = await typeIt(nw, lastTyped);
  if (!r.ok) return typeFail(r);
  lastTyped = nw; lastTypedAt = Date.now();
  V.hud.open(); V.hud.you("Rewritten"); V.hud.text(nw); V.hud.clearActs(); V.hud.later();
  return "Done";
});

/* ---------------------------------------------------------------- #019 the conversation log */
function logPanel() {
  const p = el("div", "xpane gtp aslog");
  p.innerHTML = '<div class="xhead"><div class="xic">💬</div><div><b>Conversations</b><span>Kept on this PC only: the last 300</span></div></div><div class="gtb"></div>';
  const n = openOver("aslog", p), rail = $("#rail"); n.style.right = (rail && rail.offsetWidth && getComputedStyle(rail).display !== "none" ? rail.offsetWidth + 8 : 8) + "px";
  const b = p.querySelector(".gtb"), l = load("asLog", []);
  if (!l.length) { b.innerHTML = '<div class="xsmall">Nothing yet. Say “Hey Webs” and ask anything.</div>'; return; }
  const top = el("div", "xbtns"); top.innerHTML = '<button class="btn2 ask-clear">Delete all</button>'; b.appendChild(top);
  top.querySelector("button").onclick = () => { save("asLog", []); logPanel(); toast("Conversation log deleted"); };
  let lastDay = "";
  l.slice().reverse().forEach(x => {
    const d = new Date(x.ts).toLocaleDateString([], { weekday:"long", day:"numeric", month:"long" });
    if (d !== lastDay) { lastDay = d; b.appendChild(el("div", "gtk", esc(d))); }
    const r = el("div", "aslog-row");
    r.innerHTML = '<div class="aslog-t"></div><div class="aslog-you"></div><div class="aslog-said"></div><button class="btn aslog-x" title="Delete">✕</button>';
    r.querySelector(".aslog-t").textContent = new Date(x.ts).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }) + (x.who ? " · " + x.who : "");
    r.querySelector(".aslog-you").textContent = "“" + x.you + "”";
    r.querySelector(".aslog-said").textContent = x.said + (x.acts && x.acts.length ? "  [" + x.acts.join(", ") + "]" : "");
    r.querySelector(".aslog-x").onclick = () => { save("asLog", load("asLog", []).filter(y => y.ts !== x.ts)); r.remove(); };
    b.appendChild(r);
  });
}
cmd("log", "Assistant", "show our conversations", R("(show|open) (the |our |my )?(conversation|chat)s?( log| history)?|what did we talk about|conversation (log|history)"), () => { logPanel(); return SIL; });

/* ---------------------------------------------------------------- #020 a page from your history */
cmd("histask", "Assistant", "what was that lamp site I saw on Tuesday", [R("what was (that|the) (.+?) (site|page|website|shop|video|article)( (that )?i (saw|visited|was on|looked at|found|read|watched)(.*))?"), R("which (site|page|website) (was|had) (.+)"), R("find (that|the) (.+?) (site|page|website|shop|video|article) (i|that i) (saw|visited|was on|looked at|read|watched)(.*)")], async m => {
  const q = m[0], lines = AI.historyLines(hist, 400);
  if (!lines.length) return "Your history is empty";
  V.hud.open(); V.hud.you(q); V.hud.state("thinking"); V.hud.text(""); V.hud.clearActs();
  let hits = [];
  try {
    const r = await AI.ask("find", "History:\n" + lines.map(x => x.line).join("\n") + "\n\nI'm looking for: " + q + " (today is " + new Date().toDateString() + ")");
    hits = ((AI.json(r.text) || {}).hits || []).map(h => lines[+h.n - 1]).filter(Boolean).slice(0, 4);
  } catch (e) { V.hud.state("error"); V.hud.text(e.message || ""); return e.message || "Web AI didn't answer"; }
  if (!hits.length) { V.hud.text("Nothing in your history matches."); V.hud.later(); return "I couldn't find it in your history"; }
  hits.forEach(x => V.hud.act((x.h.t || x.h.u).slice(0, 50), () => { newTab(x.h.u, false); endMode("history"); }));
  const best = hits[0].h, when = best.ts ? new Date(best.ts).toLocaleDateString([], { weekday:"long" }) : "";
  V.hud.text((best.t || best.u) + " — " + hostOf(best.u)); V.hud.state("idle");
  setMode({ name:"history", take:(text, s) => { if (/^(yes|yeah|yep|open it|open that|please|go|sure|ok(ay)?)( please)?$/.test(s)) { newTab(best.u, false); endMode("history"); return "Opening it"; } if (/^no/.test(s)) { endMode("history"); return "Okay"; } return null; } });
  setTimeout(() => endMode("history"), 30000);
  V.awake(15000);
  return "I think it was " + (best.t || hostOf(best.u)).slice(0, 90) + ", on " + hostOf(best.u).replace(/^www\./, "") + (when ? ", " + when : "") + ". Shall I open it?";
});

/* ---------------------------------------------------------------- #021 group tabs by voice */
cmd("grouptabs", "Assistant", "put all the shopping tabs in a group", [R("(put|move|group) (all )?(of )?(the |my )?(.+?) tabs (in|into) (a |one )?group( together)?"), R("group (all )?(of )?(the |my )?(.+?) tabs( together)?")], async m => {
  const topic = ((/ (in|into) (a |one )?group/.test(m[0]) ? m[5] : m[4]) || "").trim();
  if (!topic || /^(my|the|all|these|those|open|other)$/.test(topic)) return null;
  const list = tabs.filter(t => isWeb(t.url));
  if (list.length < 2) return "There aren't enough tabs to group";
  let j = null;
  try {
    const r = await AI.ask("", "My open tabs, one per line as number | title | address:\n" + list.map((t, i) => (i + 1) + " | " + String(t.title || "").replace(/\|/g, "/").slice(0, 120) + " | " + t.url.slice(0, 160)).join("\n") +
      "\n\nWhich of them are " + topic + " tabs? Reply with only JSON in a ```json block like {\"name\":\"a short group name\",\"ids\":[1,4]}.");
    j = AI.json(r.text);
  } catch (e) { return e.message || "Web AI didn't answer"; }
  const ids = (j && Array.isArray(j.ids) ? j.ids : []).map(n => list[+n - 1]).filter(Boolean).map(t => t.id);
  if (!ids.length) return "I couldn't find any " + topic + " tabs";
  const gid = newGroupId(), used = Object.values(groups).map(g => g.color), col = Object.keys(COLORS).find(k => !used.includes(k)) || "blue";
  groups[gid] = { name:String(j.name || topic).slice(0, 30).replace(/^\w/, c => c.toUpperCase()), color:col, collapsed:false };
  ids.forEach(id => addToGroup(id, gid)); saveGroups(); renderTabs(); saveSession();
  return "Grouped " + ids.length + " " + topic + " tab" + (ids.length === 1 ? "" : "s");
});

/* ---------------------------------------------------------------- #025 the weather, said */
const WMO = { 0:"clear", 1:"mostly clear", 2:"partly cloudy", 3:"cloudy", 45:"foggy", 48:"foggy", 51:"drizzly", 53:"drizzly", 55:"drizzly", 56:"freezing drizzle", 57:"freezing drizzle", 61:"light rain", 63:"rainy", 65:"heavy rain",
  66:"freezing rain", 67:"freezing rain", 71:"light snow", 73:"snowy", 75:"heavy snow", 77:"snow grains", 80:"showers", 81:"showers", 82:"heavy showers", 85:"snow showers", 86:"snow showers", 95:"thunderstorms", 96:"thunderstorms with hail", 99:"thunderstorms with hail" };
async function weatherSay(s) {
  const city = String(cfg.wxCity || "").trim(); if (!city) return null;
  let loc = load("asWxLoc", null);
  if (!loc || loc.city !== city.toLowerCase()) {
    const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(city))).json();
    const x = g && g.results && g.results[0]; if (!x) return null;
    loc = { city:city.toLowerCase(), name:x.name, lat:x.latitude, lon:x.longitude }; save("asWxLoc", loc);
  }
  const f = cfg.wxUnit === "f" || (cfg.wxUnit !== "c" && /^en-US$/i.test(navigator.language));
  const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon + "&current=temperature_2m,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=2" + (f ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : ""))).json();
  if (!w || !w.daily || !w.current) return null;
  const tm = /tomorrow/.test(s), i = tm ? 1 : 0, r = Math.round, rain = w.daily.precipitation_probability_max ? w.daily.precipitation_probability_max[i] : null;
  if (/umbrella|rain|coat|jacket/.test(s) && /need|going to|will it/.test(s)) {
    const cold = w.daily.temperature_2m_max[i] < (f ? 50 : 10);
    if (/coat|jacket/.test(s)) return cold ? "Yes, it'll only get to " + r(w.daily.temperature_2m_max[i]) + " degrees" + (tm ? " tomorrow." : ".") : "You probably won't: it gets up to " + r(w.daily.temperature_2m_max[i]) + " degrees.";
    return rain >= 40 ? "Yes, there's a " + rain + " percent chance of rain" + (tm ? " tomorrow." : " today.") : "Probably not: only a " + (rain || 0) + " percent chance of rain" + (tm ? " tomorrow." : " today.");
  }
  const desc = WMO[tm ? w.daily.weather_code[1] : w.current.weather_code] || "";
  return (tm ? "Tomorrow in " + loc.name + ": " + desc + ", " : "It's " + r(w.current.temperature_2m) + " degrees and " + desc + " in " + loc.name + ". Today: ") +
    "a high of " + r(w.daily.temperature_2m_max[i]) + " and a low of " + r(w.daily.temperature_2m_min[i]) + (rain != null ? ", with a " + rain + " percent chance of rain." : ".");
}
cmd("wx", "Assistant", "what's the weather", R("what'?s the weather( like)?( today| tomorrow| outside)?|weather( today| tomorrow| forecast)?|is it going to rain( today| tomorrow)?|will it rain( today| tomorrow)?|do i need (an umbrella|a coat|a jacket)( today| tomorrow)?|how (hot|cold|warm) is it( outside)?"), async m => {
  try { return await weatherSay(m[0]); } catch (e) { return null; }
});

// all the new commands, ahead of the older ones
V.COMMANDS.unshift(...added);

/* ---------------------------------------------------------------- #018 hold the 🎙️ button to talk */
const vbtn = $("#vcb");
if (vbtn) {
  let hold = 0, held = false;
  vbtn.addEventListener("pointerdown", e => { if (e.button !== 0) return; held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; V.talkNow(); }, 350); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => vbtn.addEventListener(t, () => clearTimeout(hold)));
  vbtn.addEventListener("click", e => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

/* ---------------------------------------------------------------- settings: Voice control → Assistant → More */
const panelA = V.panelHook;
V.panelHook = function (box) {
  panelA(box);
  if (!box) return;
  const more = el("details", "as-more");
  const ppl = B.people(), styles = B.STYLES, vs = B.winVoices().filter(v => /^en/i.test(v.lang));
  const vOpts = cur => '<option value="adam"' + (cur === "adam" ? " selected" : "") + '>Adam (ElevenLabs)</option>' + vs.map(v => '<option value="win:' + esc(v.name) + '"' + (cur === "win:" + v.name ? " selected" : "") + ">" + esc(v.name.replace(/^Microsoft /, "")) + "</option>").join("");
  const sOpts = cur => Object.keys(styles).map(k => '<option value="' + k + '"' + (cur === k ? " selected" : "") + ">" + ({ witty:"Calm and witty", short:"Short", friendly:"Friendly", detailed:"Detailed" })[k] + "</option>").join("");
  const q0 = cfg.xVoiceQuiet || {};
  more.innerHTML = "<summary>More: routines, saved assistants, reminders, quiet hours…</summary>" +
    '<div class="gtk">Routines</div><div class="xsmall">Say “start my <i>name</i> routine”. One step per line: any voice command, “say …”, or “wait 5 minutes”.</div><div class="as-routines"></div><button class="btn2 as-addr">+ Add a routine</button>' +
    '<div class="gtk">Saved assistants</div><div class="xsmall">Each one has its own name, voice and personality. Give it a wake phrase so each person in the house gets their own, or say “switch to <i>name</i>”.</div><div class="as-people"></div><button class="btn2 as-addp">+ Add an assistant</button>' +
    '<div class="gtk">How it sounds</div>' +
    '<label class="gtf"><span>Wake chime</span><span class="as-row"><select class="xin as-chime">' + ["ding", "soft", "bubble", "scifi", "low", "none"].map(k => '<option value="' + k + '"' + ((cfg.xAsChime || "ding") === k ? " selected" : "") + ">" + ({ ding:"Ding", soft:"Soft", bubble:"Bubble", scifi:"Sci-fi", low:"Low", none:"No sound" })[k] + "</option>").join("") + '</select><button class="btn2 as-chimeplay">▶</button></span></label>' +
    '<label class="gtf"><span>Whisper (softer and slower)</span><select class="xin as-whisper"><option value="">Off</option><option value="night"' + (cfg.xAsWhisper === "night" ? " selected" : "") + '>At night (10 pm to 7 am)</option><option value="on"' + (cfg.xAsWhisper === "on" ? " selected" : "") + ">Always</option></select></label>" +
    '<label class="lksw"><span><b>Seasonal moods</b><em>A bit spooky in October, cosy in December</em></span><input type="checkbox" class="as-season"' + (cfg.xAsSeason ? " checked" : "") + "></label>" +
    '<label class="lksw"><span><b>Lower other sounds while it talks</b><em>Music and videos in other tabs get quieter</em></span><input type="checkbox" class="as-duck"' + (cfg.xAsDuck !== false ? " checked" : "") + "></label>" +
    '<div class="gtk">When it listens</div>' +
    '<label class="lksw"><span><b>Push to talk</b><em>Only listens after Alt+Shift+K or while you hold the 🎙️ button</em></span><input type="checkbox" class="as-ptt"' + (cfg.xVoicePTT ? " checked" : "") + "></label>" +
    '<label class="lksw"><span><b>Quiet hours</b><em>No listening and no talking between these times</em></span><input type="checkbox" class="as-quiet"' + (q0.on ? " checked" : "") + "></label>" +
    '<div class="as-grid"><label class="gtf"><span>From</span><input type="time" class="xin as-qfrom" value="' + esc(q0.from || "22:00") + '"></label><label class="gtf"><span>To</span><input type="time" class="xin as-qto" value="' + esc(q0.to || "07:00") + '"></label></div>' +
    '<div class="gtk">Every day</div>' +
    '<label class="gtf"><span>Daily recap, said at (empty for none)</span><input type="time" class="xin as-recap" value="' + esc(cfg.xRecapAt || "") + '"></label>' +
    '<label class="lksw"><span><b>Keep a conversation log</b><em>On this PC only</em></span><input type="checkbox" class="as-log"' + (cfg.xAsLog !== false ? " checked" : "") + '></label><button class="btn2 as-logopen">See conversations</button>';
  box.appendChild(more);
  const q = s => more.querySelector(s);
  try { if (sessionStorage.getItem("wsb-as-more") === "1") more.open = true; } catch (e) {}
  more.addEventListener("toggle", () => { try { sessionStorage.setItem("wsb-as-more", more.open ? "1" : "0"); } catch (e) {} });
  // routines
  const paintR = () => {
    const box2 = q(".as-routines"); box2.innerHTML = "";
    (cfg.xRoutines || []).forEach((r, i) => {
      const d = el("div", "as-card"); d.innerHTML = '<div class="as-row"><input class="xin as-rn" maxlength="30" placeholder="Name (study)"><button class="btn2 as-rgo" title="Run it">▶</button><button class="btn as-rx" title="Delete">✕</button></div><textarea class="xin as-rs" rows="3" placeholder="focus for 25 minutes&#10;play rain sounds"></textarea>';
      d.querySelector(".as-rn").value = r.name || ""; d.querySelector(".as-rs").value = r.steps || "";
      d.querySelector(".as-rn").onchange = e => { cfg.xRoutines[i].name = e.target.value.trim().slice(0, 30); saveCfg(); };
      d.querySelector(".as-rs").onchange = e => { cfg.xRoutines[i].steps = e.target.value.slice(0, 1500); saveCfg(); };
      d.querySelector(".as-rgo").onclick = () => { closeOver(); runRoutine(cfg.xRoutines[i]); };
      d.querySelector(".as-rx").onclick = () => { cfg.xRoutines.splice(i, 1); saveCfg(); paintR(); };
      box2.appendChild(d);
    });
  };
  paintR();
  q(".as-addr").onclick = () => { cfg.xRoutines = (cfg.xRoutines || []).concat([{ name:"", steps:"" }]).slice(0, 12); saveCfg(); paintR(); };
  // saved assistants
  const paintP = () => {
    const box2 = q(".as-people"); box2.innerHTML = "";
    (cfg.xAsPeople || []).forEach((p, i) => {
      const d = el("div", "as-card");
      d.innerHTML = '<div class="as-grid"><input class="xin as-pn" maxlength="30" placeholder="Name (Friday)"><input class="xin as-pw" maxlength="30" placeholder="Wake phrase (Hey Friday)"></div>' +
        '<div class="as-grid"><input class="xin as-pc" maxlength="30" placeholder="Calls them (Sam)"><select class="xin as-ps">' + sOpts(p.style || "witty") + '</select></div>' +
        '<div class="as-row"><select class="xin as-pv">' + vOpts(p.voice || "adam") + '</select><button class="btn2 as-puse">' + (cfg.xAsActive === i ? "In use" : "Use") + '</button><button class="btn as-px" title="Delete">✕</button></div>';
      d.querySelector(".as-pn").value = p.name || ""; d.querySelector(".as-pw").value = p.wake || ""; d.querySelector(".as-pc").value = p.call || "";
      const upd = (k, v) => { cfg.xAsPeople[i][k] = v; saveCfg(); };
      d.querySelector(".as-pn").onchange = e => upd("name", e.target.value.trim().slice(0, 30));
      d.querySelector(".as-pw").onchange = e => upd("wake", e.target.value.trim().slice(0, 30));
      d.querySelector(".as-pc").onchange = e => upd("call", e.target.value.trim().slice(0, 30));
      d.querySelector(".as-ps").onchange = e => upd("style", e.target.value);
      d.querySelector(".as-pv").onchange = e => upd("voice", e.target.value);
      d.querySelector(".as-puse").onclick = () => { cfg.xAsActive = cfg.xAsActive === i ? -1 : i; saveCfg(); paintP(); };
      d.querySelector(".as-px").onclick = () => { cfg.xAsPeople.splice(i, 1); if (cfg.xAsActive === i) cfg.xAsActive = -1; else if (cfg.xAsActive > i) cfg.xAsActive--; saveCfg(); paintP(); };
      box2.appendChild(d);
    });
  };
  paintP();
  q(".as-addp").onclick = () => { cfg.xAsPeople = (cfg.xAsPeople || []).concat([{ name:"", wake:"", call:"", style:"witty", voice:"adam" }]).slice(0, 8); saveCfg(); paintP(); };
  // the rest
  q(".as-chime").onchange = e => { cfg.xAsChime = e.target.value; saveCfg(); V.ding(e.target.value); };
  q(".as-chimeplay").onclick = () => V.ding(q(".as-chime").value);
  q(".as-whisper").onchange = e => { cfg.xAsWhisper = e.target.value; saveCfg(); };
  q(".as-season").onchange = e => { cfg.xAsSeason = e.target.checked; saveCfg(); };
  q(".as-duck").onchange = e => { cfg.xAsDuck = e.target.checked; saveCfg(); };
  q(".as-ptt").onchange = e => { cfg.xVoicePTT = e.target.checked; saveCfg(); if (VL.on) { V.setOn(false); V.setOn(true); } };
  const qs = () => { cfg.xVoiceQuiet = { on:q(".as-quiet").checked, from:q(".as-qfrom").value || "22:00", to:q(".as-qto").value || "07:00" }; saveCfg(); };
  q(".as-quiet").onchange = qs; q(".as-qfrom").onchange = qs; q(".as-qto").onchange = qs;
  q(".as-recap").onchange = e => { cfg.xRecapAt = e.target.value; saveCfg(); };
  q(".as-log").onchange = e => { cfg.xAsLog = e.target.checked; saveCfg(); };
  q(".as-logopen").onclick = () => logPanel();
};

const commandsM = commands;
commands = function () { return commandsM().concat([{ t:"Conversations with the assistant", k:"", i:"speech", fn:logPanel }, { t:"Daily recap (how was my day?)", k:"", i:"speech", fn:() => { const t = recap(); toast(t); say(t); } }]); };

const st = document.createElement("style");
st.textContent = `
.as-more{margin:10px 0}.as-more>summary{cursor:pointer;font-weight:600;padding:6px 0}.as-card{border:1px solid var(--line, rgba(127,127,127,.25));border-radius:10px;padding:8px;margin:6px 0;display:grid;gap:6px}
.as-row{display:flex;gap:6px;align-items:center}.as-row .xin{flex:1;min-width:0}.as-card textarea{width:100%;box-sizing:border-box;resize:vertical;font:inherit}
.aslog .gtb{max-height:70vh;overflow:auto}.aslog-row{position:relative;padding:8px 30px 8px 0;border-top:1px solid var(--line, rgba(127,127,127,.2))}.aslog-t{font-size:11.5px;color:var(--dim)}
.aslog-you{font-size:13px;color:var(--dim);margin:2px 0}.aslog-said{font-size:13.5px;overflow-wrap:anywhere}.aslog-x{position:absolute;right:0;top:8px;width:24px;height:24px}
#vcb[data-mode=dictation]::after,#vcb[data-mode=cooking]::after,#vcb[data-mode=translator]::after{content:"";position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:#4ec98a}`;
document.head.appendChild(st);
X3.assist = { recap, routines, runRoutine, here, spoken2text, clockAt, remindAt, addReminder, ddgResults, weatherSay, logPanel, setMode, endMode, mode:() => mode && mode.name, hostFetch };
})();
