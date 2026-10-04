/* Webs Browser - "live": what the people who make Webs put on everyone's start page, from the Web AI
   server (GET /live): an announcement with emoji reactions, a calling card, a poll, a countdown,
   the owner's pick, quotes, trivia, mystery boxes and theme days by date, Webs's birthday, a
   community goal, a secret code hunt, secret words for the address bar, limited-time achievements,
   the wallpaper of the week, sticker packs and help articles. The same file runs in the iPhone app,
   the Windows browser's new tab page, both games pages and the Windows browser window (secret words).

   What this sends back, and only to the Web AI server:
   - about once an hour while Webs is open, unless "Send anonymous counts" is off: the app's
     version (and Cloudflare adds the country) and, during a community goal, how many games of it
     this device played. Never what anyone browses.
   - what someone chooses to do: a vote, a trivia answer, a reaction, a found code, a game score
     for the weekly leaderboard (only with a nickname they picked), a problem report.
   Each device is a random id (wsb.xaiDev, the same one Web AI uses), which the server keeps only as a hash.
   Kept here: wsb.live (what the server said), wsb.liveSeen (votes, answers, cards seen),
   wsb.liveAch (special achievements), wsb.liveGoal, wsb.liveNick, wsb.liveBest, wsb.liveReports. */
(function () {
"use strict";
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const H = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pad2 = n => String(n).padStart(2, "0");
const localDay = t => { const d = t ? new Date(t) : new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
const opt = { platform:"iphone", version:"", isPrivate:() => false, toast:null, open:null, fx:null };
const listeners = [];
const fire = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });

/* ---------------------------------------------------------------- the server, this device, and what's kept */
function server() {
  for (const s of [(get("xai", {}) || {}).server, (get("xaiConfig", {}) || {}).server, (get("push", {}) || {}).server]) {
    const a = String(s || "").trim().replace(/\/+$/, "");
    if (/^https:\/\/\S+$/.test(a)) return a;
  }
  return "";
}
function dev() {      // the same random id Web AI uses (made here if Web AI hasn't been opened yet)
  let d = get("xaiDev", ""); if (/^[A-Za-z0-9]{20,40}$/.test(d)) return d;
  const a = new Uint8Array(15); crypto.getRandomValues(a); d = [...a].map(b => b.toString(16).padStart(2, "0")).join(""); put("xaiDev", d); return d;
}
const code = () => String((get("xai", {}) || {}).code || (get("xaiConfig", {}) || {}).code || "");
const countsOn = () => (get("settings", {}) || {}).liveCounts !== false;
const data = () => (get("live", null) || {}).d || {};
const seen = () => Object.assign({ ann:{}, cards:[], vote:{}, trivia:{}, react:{}, box:{}, bday:"" }, get("liveSeen", {}) || {});
const setSeen = f => { const s = seen(); f(s); put("liveSeen", s); };
async function post(path, body) {
  const s = server(); if (!s) throw new Error("Webs's server isn't set up yet.");
  let r; try { r = await fetch(s + path, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(body) }); } catch (e) { throw new Error("Couldn't reach Webs's server. Are you online?"); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) { const e = new Error(j && j.message || "Webs's server had a problem (" + r.status + ")."); e.status = r.status; throw e; }
  return j;
}
const act = (kind, o) => post("/live/act", Object.assign({ device:dev(), platform:opt.platform, kind }, o));

let fetching = null;
async function refresh(force) {
  const c = get("live", null), s = server();
  if (!s || (!force && c && Date.now() - c.at < 10 * 60000)) return data();
  if (fetching) return fetching;
  fetching = (async () => {
    try {
      const r = await fetch(s + "/live", { cache:"no-store" });
      const j = r.ok ? await r.json() : null;
      if (j && j.ok) { const was = JSON.stringify(data()); put("live", { at:Date.now(), d:j }); if (JSON.stringify(j) !== was) fire(); }
    } catch (e) {}
    fetching = null;
    return data();
  })();
  return fetching;
}
// checking in, about once an hour while Webs is open (not at all with "Send anonymous counts" off)
async function ping() {
  if (opt.noPing || !countsOn() || opt.isPrivate() || !server()) return;
  const last = +get("livePing", 0) || 0;
  if (Date.now() - last < 55 * 60000) return;
  put("livePing", Date.now());
  const g = goalState();
  try { await post("/live/ping", { device:dev(), platform:opt.platform, version:opt.version, ...(g ? { goal:[g.id, g.n] } : {}) }); } catch (e) {}
}

/* ---------------------------------------------------------------- the start page's cards */
const daysTo = date => { const t = new Date(date + "T00:00:00"), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((t - n) / 86400000); };
const today = (list, d) => (list || []).find(x => x.date === (d || localDay()));
const BOXES = {
  joke:["Why did the browser go to school? To improve its search skills.", "I told my computer a joke about UDP. I'm not sure it got it.", "Why do programmers prefer dark mode? Because light attracts bugs.",
    "What's a tab's favorite exercise? Reloading.", "Why was the cookie sad? It got cleared.", "My Wi-Fi and I have a strong connection. Mostly."],
  tip:["Type a word with ! in front, like !yt cats, to search a site directly.", "Long-press a shortcut to edit or remove it.", "Turn on the Phantom calendar in Customize for a countdown to anything.",
    "Type “timer 5 min” in the address bar to start a timer.", "Web AI can summarize the page you're on: open it from the menu."],
  fact:["Octopuses have three hearts.", "Honey never spoils: pots thousands of years old are still good.", "A day on Venus is longer than its year.", "Bananas are berries, but strawberries aren't.", "There are more trees on Earth than stars in the Milky Way."],
  game:["Can you get 20 in Snake today?", "Try to reach 512 in 2048 without using the down arrow.", "Solve today's word in 4 tries or fewer.", "Beat your Web Runner score before lunch."]
};
function mysteryToday() {
  const d = localDay(), own = today(data().mystery, d);
  if (own) return own;
  const n = Math.floor(Date.now() / 86400000), kinds = ["joke", "tip", "fact", "game"], k = kinds[n % 4], l = BOXES[k];
  return { date:d, kind:k, text:l[Math.floor(n / 4) % l.length] };
}
const KIND = { joke:"😄 A joke", tip:"💡 A tip", fact:"🧠 A fun fact", game:"🎮 Today's challenge" };
const REACTS = ["👍", "❤️", "😂", "😮", "🎉"];
function goalState() {
  const g = data().goal; if (!g) return null;
  const mine = get("liveGoal", {}) || {};
  return { id:g.id, n:mine.id === g.id ? mine.n || 0 : 0 };
}

function render(el) {
  if (!el) return;
  el.innerHTML = "";
  if (opt.isPrivate() || (opt.hidden && opt.hidden())) { el.classList.add("lv-hide"); return; }
  const D = data(), S = seen(), cards = [];
  const card = (cls, html) => { const c = H("div", "lv-card " + (cls || ""), html); cards.push(c); return c; };
  if (D.maint && !D.maint.ai) card("lv-maint", "🛠 " + esc(D.maint.text));
  // the announcement, with reactions
  if (D.ann && !S.ann[D.ann.id]) {
    const c = card("lv-ann", '<button type="button" class="lv-x" aria-label="Close">✕</button><p></p>');
    c.querySelector("p").textContent = "📣 " + D.ann.text;
    if (D.ann.link) { const a = H("a", "lv-link", "Open ›"); a.href = D.ann.link; a.onclick = e => { if (opt.open) { e.preventDefault(); opt.open(D.ann.link); } }; c.appendChild(a); }
    if (D.ann.react) {
      const r = H("div", "lv-react"), mine = S.react[D.ann.id];
      REACTS.forEach(e => { const b = H("button", e === mine ? "on" : "", e); b.type = "button"; b.onclick = async () => {
        setSeen(s => { s.react[D.ann.id] = e; }); render(el);
        try { await act("react", { id:D.ann.id, emoji:e }); } catch (x) {}
      }; r.appendChild(b); });
      c.appendChild(r);
    }
    c.querySelector(".lv-x").onclick = () => { setSeen(s => { s.ann[D.ann.id] = 1; }); render(el); };
  }
  // Webs's birthday
  const md = localDay().slice(5);
  if (D.birthday && D.birthday.date === md) {
    const yrs = D.birthday.since ? new Date().getFullYear() - D.birthday.since : 0;
    card("lv-bday", "<b>🎂 Happy birthday, Webs!</b><span>" + (yrs > 0 ? "Turning " + yrs + " today. " : "") + "Thanks for being here. 🎉</span>");
    const y = String(new Date().getFullYear());
    if (S.bday !== y) { setSeen(s => { s.bday = y; }); setTimeout(() => fxBurst("confetti"), 400); }
  }
  // the countdown
  if (D.countdown) {
    const n = daysTo(D.countdown.date);
    if (n >= 0) card("lv-cd", '<span class="lv-big">' + esc(D.countdown.emoji) + " " + (n === 0 ? "Today!" : n + "<small> day" + (n === 1 ? "" : "s") + "</small>") + "</span><span>" + (n === 0 ? "" : "until ") + esc(D.countdown.label) + "</span>");
  }
  // the poll
  if (D.poll) {
    const mine = S.vote[D.poll.id], c = card("lv-poll", "<b></b><div class=\"lv-opts\"></div>");
    c.querySelector("b").textContent = "📊 " + D.poll.q;
    D.poll.opts.forEach((o, i) => { const b = H("button", mine === i ? "on" : ""); b.type = "button"; b.textContent = o; b.disabled = mine != null; b.onclick = async () => {
      setSeen(s => { s.vote[D.poll.id] = i; }); render(el);
      try { await act("vote", { id:D.poll.id, choice:i }); if (opt.toast) opt.toast("Thanks for voting!"); } catch (x) {}
    }; c.querySelector(".lv-opts").appendChild(b); });
    if (mine != null) c.appendChild(H("small", "", "Thanks for voting! Results come in the next news."));
  }
  // today's trivia
  const tv = today(D.trivia);
  if (tv) {
    const mine = S.trivia[tv.date], c = card("lv-trivia", "<b></b><div class=\"lv-opts\"></div>");
    c.querySelector("b").textContent = "❓ " + tv.q;
    tv.opts.forEach((o, i) => { const b = H("button", mine == null ? "" : i === tv.a ? "right" : i === mine ? "wrong" : ""); b.type = "button"; b.textContent = o; b.disabled = mine != null; b.onclick = async () => {
      setSeen(s => { s.trivia[tv.date] = i; }); render(el);
      if (opt.toast) opt.toast(i === tv.a ? "✅ Right!" : "❌ Not quite. It's " + tv.opts[tv.a] + ".");
      if (i === tv.a) fxBurst("confetti", 40);
      try { await act("trivia", { id:tv.date, choice:i }); } catch (x) {}
    }; c.querySelector(".lv-opts").appendChild(b); });
  }
  // the mystery box (once Webs's server has answered: the owner's surprise, or a built-in one)
  const box = D.ok ? mysteryToday() : null, opened = box && S.box[box.date];
  if (box) {
  const bc = card("lv-box" + (opened ? " open" : ""), opened ? "<b>" + KIND[box.kind] + "</b><p></p>" : '<button type="button" class="lv-gift">🎁 <span>Today’s mystery box</span><small>Tap to open</small></button>');
  if (opened) bc.querySelector("p").textContent = box.text;
  else bc.querySelector("button").onclick = () => { setSeen(s => { s.box[box.date] = 1; }); fxBurst("confetti", 30); render(el); };
  }
  // the owner's pick
  if (D.pick) {
    const c = card("lv-pick", "<b>⭐ Pick of the week</b><a class=\"lv-link\"></a><span></span>");
    const a = c.querySelector("a"); a.href = D.pick.url; a.textContent = D.pick.title + " ›"; c.querySelector("span").textContent = D.pick.note || "";
    a.onclick = e => { if (opt.open) { e.preventDefault(); opt.open(D.pick.url); } };
  }
  // the community goal
  const g = D.goal;
  if (g) {
    const mine = goalState(), pct = Math.min(100, Math.round((g.n || 0) / g.target * 100)), done = (g.n || 0) >= g.target;
    const c = card("lv-goal", "<b></b><div class=\"lv-bar\"><i></i></div><span></span>");
    c.querySelector("b").textContent = (done ? "🎉 " : "🏁 ") + g.label;
    c.querySelector("i").style.width = pct + "%";
    c.querySelector("span").textContent = done ? "Goal reached! " + (g.reward || "Thanks, everyone!") : (g.n || 0).toLocaleString() + " of " + g.target.toLocaleString() + (mine.n ? " · you played " + mine.n : " · play in Games to help") + (g.reward ? " · reward: " + g.reward : "");
    if (done) unlock("goal-" + g.id, "🏁", "Team player", "Helped reach “" + g.label + "”", true);
  }
  // the secret code hunt
  if (D.hunt) {
    const got = (get("liveAch", {}) || {})["hunt-" + D.hunt.id];
    const c = card("lv-hunt", "<b>🔍 Secret code hunt</b><span></span>");
    c.querySelector("span").textContent = got ? "You found it! 🏆 " + (D.hunt.found > 1 ? D.hunt.found + " people have so far." : "") : (D.hunt.hint || "A code is hidden somewhere.") + " Type it in the address bar.";
  }
  // the wallpaper of the week
  if (D.wall && !opt.noWall) {
    const on = get("liveWall", false), c = card("lv-wall", "<b>🖼 Wallpaper of the week</b><span></span><button type=\"button\"></button>");
    c.querySelector("span").textContent = D.wall.credit || "";
    c.querySelector("button").textContent = on ? "Stop using it" : "Use it";
    c.querySelector("button").onclick = () => { put("liveWall", !on); if (opt.onWall) opt.onWall(!on); render(el); };
  }
  cards.forEach((c, i) => { c.style.animationDelay = i * 50 + "ms"; el.appendChild(c); });
  el.classList.toggle("lv-hide", !cards.length);
  checkAch();
}

/* ---------------------------------------------------------------- the calling card (once each) */
function callingCard() {
  const c = data().card;
  if (!c || opt.isPrivate() || seen().cards.includes(c.id) || document.querySelector(".lv-cc")) return false;
  setSeen(s => { s.cards = s.cards.concat(c.id).slice(-20); });
  const o = H("div", "lv-cc", '<div class="lv-ccin"><b></b><p></p><i></i><small>Tap to close</small></div>');
  o.querySelector("b").textContent = c.title; o.querySelector("p").textContent = c.text; o.querySelector("i").textContent = "— " + (c.sign || "The Phantom Thieves");
  o.setAttribute("role", "dialog"); o.setAttribute("aria-label", c.title);
  o.onclick = () => { o.classList.add("out"); setTimeout(() => o.remove(), 350); };
  document.body.appendChild(o);
  return true;
}

/* ---------------------------------------------------------------- effects: theme days, secret words, bursts */
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || (get("settings", {}) || {}).motion === "off" || document.documentElement.dataset.motion === "off";
const FXSET = { snow:["❄", "❅", "❆"], hearts:["❤️", "💖", "💕"], stars:["⭐", "✨", "🌟"], leaves:["🍂", "🍁", "🍃"], halloween:["🎃", "🦇", "👻"], bubbles:["🫧", "○", "◦"], rainbow:["🌈", "✨"], confetti:null, fireworks:null };
let fxLayer = null;
function fxRun(kind, ms, count) {
  if (opt.noFx || reduced() || !FXSET.hasOwnProperty(kind)) return;     // noFx: the Windows browser window plays them in a new tab page instead
  if (fxLayer) fxLayer.remove();
  const c = H("canvas", "lv-fx"); document.body.appendChild(c); fxLayer = c;
  const W = c.width = innerWidth, Ht = c.height = innerHeight, x = c.getContext("2d"), set = FXSET[kind], cols = ["#e8342a", "#febc2e", "#2fbf71", "#4a9eff", "#c86bff", "#ffffff"];
  const burst = !set, ps = [];
  const make = i => burst ? { x:W / 2 + (kind === "fireworks" ? (Math.random() - .5) * W * .6 : 0), y:kind === "fireworks" ? Ht * (.2 + Math.random() * .3) : Ht / 3, vx:(Math.random() - .5) * (kind === "fireworks" ? 8 : 14), vy:Math.random() * -12 - 2, r:Math.random() * 6 + 3, c:cols[i % cols.length], a:Math.random() * 6 }
    : { x:Math.random() * W, y:-20 - Math.random() * Ht, vx:(Math.random() - .5) * .6, vy:.6 + Math.random() * 1.2, s:14 + Math.random() * 14, ch:set[i % set.length], a:Math.random() * 6 };
  for (let i = 0; i < (count || (burst ? 140 : 26)); i++) ps.push(make(i));
  const t0 = performance.now();
  const step = t => {
    if (c !== fxLayer) return;
    x.clearRect(0, 0, W, Ht);
    ps.forEach((p, i) => {
      if (burst) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }
      else { p.x += p.vx + Math.sin((t / 1000) + p.a) * .3; p.y += p.vy; if (p.y > Ht + 20) { p.y = -20; p.x = Math.random() * W; } x.globalAlpha = .75; x.font = p.s + "px serif"; x.fillText(p.ch, p.x, p.y); x.globalAlpha = 1; }
    });
    if (t - t0 < ms) requestAnimationFrame(step); else { c.remove(); if (fxLayer === c) fxLayer = null; }
  };
  requestAnimationFrame(step);
}
const fxBurst = (kind, n) => fxRun(kind || "confetti", 2600, n);
// today's theme: gentle effects for a while each time the start page shows
function themeFx() {
  if (opt.isPrivate()) return "";
  const t = today(data().themes);
  if (!t) return "";
  document.documentElement.classList.toggle("lv-rainbow", t.kind === "rainbow");
  if (t.kind === "confetti" || t.kind === "fireworks") fxBurst(t.kind); else fxRun(t.kind, 20000);
  return t.kind;
}
const sha16 = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
// what was typed in the address bar: a secret word (its effect plays) or the hunt's code (a find)
async function secret(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t || t.length > 40 || !crypto.subtle) return "";
  const D = data();
  if (!(D.secrets && D.secrets.length) && !D.hunt) return "";
  const h = await sha16("webs:" + t);
  if (D.hunt && h === D.hunt.h) {
    const id = "hunt-" + D.hunt.id, had = (get("liveAch", {}) || {})[id];
    if (!had) { try { await act("found", { id:D.hunt.id, code:t }); } catch (e) {} unlock(id, "🔍", "Code breaker", "Found the secret code", true); }
    fxBurst("fireworks");
    return "hunt";
  }
  const s = (D.secrets || []).find(x => x.h === h);
  if (!s) return "";
  if (s.fx === "confetti" || s.fx === "fireworks") fxBurst(s.fx); else fxRun(s.fx, 6000, 40);
  if (s.fx === "rainbow" && !opt.noFx) { document.documentElement.classList.add("lv-rainbow"); setTimeout(() => document.documentElement.classList.remove("lv-rainbow"), 6000); }
  return s.fx;
}

/* ---------------------------------------------------------------- special achievements (limited-time, the goal, the hunt) */
function unlock(id, e, name, desc, tell) {
  const all = get("liveAch", {}) || {};
  if (all[id]) return false;
  all[id] = { ts:Date.now(), e, name, desc };
  put("liveAch", all);
  act("ach", { id }).catch(() => {});
  if (tell && opt.toast) setTimeout(() => opt.toast("🏆 Achievement unlocked: " + name), 700);
  fire();
  return true;
}
function checkAch() {
  if (opt.isPrivate()) return;
  const now = Date.now();
  for (const a of data().ach || []) if ((!a.from || a.from <= now) && (!a.until || a.until > now)) unlock(a.id, a.emoji, a.name, a.desc, true);
}
// for the apps' Achievements screens: the ones on now, and every one unlocked before
function achievements() {
  const all = get("liveAch", {}) || {}, out = [], now = Date.now();
  for (const a of data().ach || []) if (!all[a.id] && (!a.until || a.until > now)) out.push({ id:a.id, e:a.emoji, name:a.name, desc:a.desc + " (limited time)", got:0 });
  for (const [id, a] of Object.entries(all)) out.push({ id, e:a.e, name:a.name, desc:a.desc, got:a.ts });
  return out;
}

/* ---------------------------------------------------------------- games: tomorrow's word, the leaderboard, the goal */
function wordToday() { const w = today(data().words); return w && /^[A-Z]{5}$/.test(w.w) ? w.w.toLowerCase() : ""; }
const weekOf = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
async function gameOver(game, score) {
  const g = data().goal;
  if (g && (g.game === game || g.game === "any")) {
    const m = get("liveGoal", {}) || {};
    put("liveGoal", m.id === g.id ? { id:g.id, n:(m.n || 0) + 1 } : { id:g.id, n:1 });
  }
  const nick = get("liveNick", ""), wk = weekOf();
  if (!nick || !(score > 0) || (game !== "snake" && game !== "2048")) return false;
  const best = get("liveBest", {}) || {};
  if (best.wk !== wk) { best.wk = wk; best.snake = 0; best["2048"] = 0; }
  if (score <= (best[game] || 0)) return false;
  best[game] = score; put("liveBest", best);
  try { await act("score", { game, score, nick }); return true; } catch (e) { return false; }
}
function gamesPanel(el) {
  if (!el) return;
  const D = data(), b = D.board || {}, nick = get("liveNick", ""), g = D.goal, mine = goalState();
  const list = (title, rows) => '<div class="lv-lb"><b>' + title + "</b>" + (rows && rows.length ? "<ol>" + rows.map(r => "<li><span>" + esc(r.n) + "</span><em>" + r.s.toLocaleString() + "</em></li>").join("") + "</ol>" : "<p>No scores yet this week.</p>") + "</div>";
  el.innerHTML = (g ? '<div class="lv-card lv-goal"><b>' + ((g.n || 0) >= g.target ? "🎉 " : "🏁 ") + esc(g.label) + '</b><div class="lv-bar"><i style="width:' + Math.min(100, Math.round((g.n || 0) / g.target * 100)) + '%"></i></div><span>' +
      (g.n || 0).toLocaleString() + " of " + g.target.toLocaleString() + " · you played " + mine.n + " (" + (g.game === "any" ? "any game" : g.game === "2048" ? "2048" : "Snake") + ")" + "</span></div>" : "") +
    '<div class="lv-card"><b>🏆 This week’s leaderboard</b><div class="lv-lbs">' + list("Snake", b.snake) + list("2048", b["2048"]) + "</div>" +
    '<div class="lv-nick">' + (nick ? "<span>You play as <b>" + esc(nick) + "</b></span><button type=\"button\" data-x=\"change\">Change</button><button type=\"button\" data-x=\"leave\">Leave</button>"
      : '<input maxlength="16" placeholder="Pick a nickname to join"><button type="button" data-x="join">Join</button>') + "</div><small>Your best Snake and 2048 scores this week go on the board with your nickname. It starts again every Monday.</small></div>";
  el.onclick = e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x === "join") { const v = el.querySelector("input").value.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 16); if (!v) return; put("liveNick", v); put("liveBest", {}); gamesPanel(el); }
    if (x.dataset.x === "change") { put("liveNick", ""); gamesPanel(el); }
    if (x.dataset.x === "leave") { put("liveNick", ""); gamesPanel(el); if (opt.toast) opt.toast("You left the leaderboard. Your scores stay until Monday."); }
  };
}

/* ---------------------------------------------------------------- problem reports and their replies */
const errs = [];
addEventListener("error", e => { errs.push(String(e.message || e.type).slice(0, 300) + (e.filename ? " @ " + String(e.filename).split("/").pop() + ":" + e.lineno : "")); if (errs.length > 20) errs.shift(); });
addEventListener("unhandledrejection", e => { errs.push("promise: " + String(e.reason && e.reason.message || e.reason).slice(0, 300)); if (errs.length > 20) errs.shift(); });
async function report(text, info) {
  const a = new Uint8Array(12); crypto.getRandomValues(a); const t = [...a].map(b => b.toString(16).padStart(2, "0")).join("");
  const body = { device:dev(), app:opt.platform, version:opt.version, text:String(text || "").slice(0, 4000), info:Object.assign({ screen:innerWidth + "x" + innerHeight, lang:navigator.language, ua:navigator.userAgent.slice(0, 200) }, info || {}), errors:errs.slice(-15), rtok:t };
  let j;
  // an open server needs no code; one with codes gets the Web AI code this app has
  try { j = await post("/report", body); } catch (e) { if (e.status !== 401 || !code()) throw e; j = await post("/report", Object.assign({ code:code() }, body)); }
  const l = get("liveReports", []) || [];
  l.unshift({ id:j.id, t, text:String(text).slice(0, 300), ts:Date.now() });
  put("liveReports", l.slice(0, 10));
  return j.id;
}
let repT = 0;
async function replies(force) {
  const l = get("liveReports", []) || [], open = l.filter(r => r.id && !(r.fixed && r.reply));
  if (!open.length || !server() || (!force && Date.now() - repT < 30 * 60000)) return [];
  repT = Date.now();
  try {
    const j = await post("/live/replies", { reports:open.slice(0, 5).map(r => ({ id:r.id, t:r.t })) });
    const fresh = [];
    for (const it of j.items || []) {
      const r = l.find(x => x.id === it.id); if (!r) continue;
      if (it.reply && (!r.reply || r.reply.at !== it.reply.at)) { r.reply = it.reply; r.unread = 1; fresh.push(r); }
      if (it.fixed && !r.fixed) { r.fixed = it.fixed; if (!fresh.includes(r)) { r.unread = 1; fresh.push(r); } }
    }
    put("liveReports", l);
    if (fresh.length && opt.toast) opt.toast("💬 Webs support answered your problem report", opt.openReports ? { label:"See", fn:opt.openReports } : null);
    if (fresh.length) fire();
    return fresh;
  } catch (e) { return []; }
}
const myReports = () => get("liveReports", []) || [];
const readReports = () => { const l = myReports(); l.forEach(r => { delete r.unread; }); put("liveReports", l); };

/* ---------------------------------------------------------------- new versions: which side of a gradual rollout this device is on */
function bucket() { let h = 2166136261; for (const ch of dev()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 100; }
function rolloutOk(platform, version) {
  const r = (data().rollout || {})[platform === "windows" ? "win" : "ios"];
  return !r || r.v !== version || bucket() < r.pct;
}

/* ---------------------------------------------------------------- the look (it uses the page's own colors) */
const css = H("style", "", `
.lv-hide{display:none!important}
.lv-wrap{display:grid;gap:10px;margin:14px 0 4px}
.lv-card{position:relative;background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-size:14.5px;line-height:1.45;animation:lvIn .45s cubic-bezier(.2,.8,.2,1) both;text-align:left;color:var(--fg)}
@keyframes lvIn{from{opacity:0;transform:translateY(10px) scale(.98)}}
.lv-card b{display:block;font-weight:650;margin-bottom:4px}.lv-card p{margin:0}.lv-card span,.lv-card small{display:block;color:var(--dim);font-size:13px}
.lv-card .lv-link{color:var(--accent);font-weight:600;text-decoration:none;display:inline-block;margin-top:4px}
.lv-ann{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));background:color-mix(in srgb,var(--accent) 10%,var(--bg2));padding-right:38px}
.lv-x{position:absolute;top:6px;right:6px;width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:var(--dim);font-size:14px;cursor:pointer}
.lv-react{display:flex;gap:6px;margin-top:8px}.lv-react button{border:1px solid var(--line);background:var(--bg3,var(--bg));border-radius:99px;padding:3px 10px;font-size:16px;cursor:pointer;transition:transform .2s}
.lv-react button.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);transform:scale(1.12)}
.lv-big{display:block!important;font-size:24px;font-weight:700;color:var(--fg)!important}.lv-big small{display:inline!important;font-size:14px;font-weight:600;color:var(--dim)}
.lv-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:8px 0 4px}
.lv-opts button{border:1px solid var(--line);background:var(--bg3,var(--bg));color:var(--fg);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;cursor:pointer;text-align:left}
.lv-opts button:disabled{cursor:default;opacity:.75}.lv-opts button.on{border-color:var(--accent);opacity:1}.lv-opts button.right{border-color:#2fbf71;background:rgba(47,191,113,.16);opacity:1}.lv-opts button.wrong{border-color:#ff6a5e;background:rgba(255,106,94,.14);opacity:1}
.lv-gift{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;color:var(--fg);font:inherit;font-size:22px;cursor:pointer;padding:0;text-align:left}
.lv-gift span{display:block!important;font-size:15px!important;font-weight:650;color:var(--fg)!important;flex:1}.lv-gift small{font-size:12.5px;color:var(--dim)}
.lv-gift{animation:lvWiggle 2.6s ease-in-out infinite}@keyframes lvWiggle{0%,90%,100%{transform:none}93%{transform:rotate(-2deg)}96%{transform:rotate(2deg)}}
.lv-box.open p{font-size:15px}
.lv-bar{height:10px;border-radius:5px;background:var(--bg3,var(--line));overflow:hidden;margin:6px 0}.lv-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#febc2e);border-radius:5px;transition:width .6s}
.lv-bday{background:linear-gradient(135deg,color-mix(in srgb,#febc2e 25%,var(--bg2)),color-mix(in srgb,var(--accent) 22%,var(--bg2)))}
.lv-maint{border-color:#febc2e}
.lv-wall button{margin-top:8px;border:0;border-radius:99px;background:var(--accent);color:#fff;font:inherit;font-size:13.5px;font-weight:600;padding:6px 14px;cursor:pointer}
.lv-lbs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:6px 0}.lv-lb ol{margin:0;padding-left:20px}.lv-lb li{display:flex;justify-content:space-between;gap:8px;font-size:13.5px}.lv-lb li em{font-style:normal;color:var(--dim);font-variant-numeric:tabular-nums}
.lv-lb p{margin:0;font-size:13px;color:var(--dim)}.lv-lb li span{display:inline!important;color:var(--fg)!important;font-size:13.5px!important}
.lv-nick{display:flex;gap:8px;align-items:center;margin:10px 0 6px}.lv-nick input{flex:1;min-width:0;border:1px solid var(--line);background:var(--bg3,var(--bg));color:var(--fg);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px}
.lv-nick button{border:0;border-radius:10px;background:var(--accent);color:#fff;font:inherit;font-size:13.5px;font-weight:600;padding:8px 12px;cursor:pointer}.lv-nick button[data-x="change"],.lv-nick button[data-x="leave"]{background:var(--bg3,var(--line));color:var(--fg)}
.lv-nick span{display:inline!important;flex:1;font-size:14px!important;color:var(--fg)!important}.lv-nick span b{display:inline;margin:0}
.lv-fx{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998}
.lv-cc{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:#0b0b0b radial-gradient(#2a2a2a 1px,transparent 1.6px) 0 0/14px 14px;animation:lvCc .45s cubic-bezier(.2,.9,.2,1.2) both;cursor:pointer}
.lv-cc.out{animation:lvCcOut .35s ease both}
@keyframes lvCc{from{opacity:0;transform:scale(1.3) rotate(4deg)}}@keyframes lvCcOut{to{opacity:0;transform:scale(.9) rotate(-3deg)}}
.lv-ccin{position:relative;max-width:520px;width:100%;background:#e60012;color:#000;padding:30px 24px 22px;transform:rotate(-3deg);box-shadow:12px 12px 0 #000,12px 12px 0 2px #fff;font-family:"Arial Black",Impact,system-ui,sans-serif;overflow:hidden}
.lv-ccin::before{content:"";position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,#000 0 6deg,transparent 6deg 18deg);opacity:.16;animation:lvSpin 30s linear infinite}
@keyframes lvSpin{to{transform:rotate(360deg)}}
.lv-ccin b{position:relative;display:inline-block;background:#000;color:#fff;padding:4px 14px;transform:skew(-10deg);font-size:clamp(22px,6vw,34px);letter-spacing:.02em;text-transform:uppercase}
.lv-ccin p{position:relative;font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:17px;line-height:1.4;background:#fff;color:#000;padding:12px 14px;margin:16px 0 10px;transform:rotate(1.2deg)}
.lv-ccin i{position:relative;display:block;text-align:right;font-style:normal;font-size:14px}.lv-ccin small{position:relative;display:block;text-align:center;margin-top:14px;font-family:system-ui,sans-serif;font-size:12px;color:#000;opacity:.7}
html.lv-rainbow{--accent:#e8342a;animation:lvHue 4s linear infinite}@keyframes lvHue{0%{filter:none}50%{filter:hue-rotate(180deg)}100%{filter:hue-rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.lv-card,.lv-cc,.lv-gift,.lv-ccin::before{animation:none!important}html.lv-rainbow{animation:none}}
`);
(document.head || document.documentElement).appendChild(css);

/* ---------------------------------------------------------------- starting */
function init(o) {
  Object.assign(opt, o || {});
  refresh(false).then(() => { ping(); replies(false); });
  setInterval(() => { if (document.visibilityState === "visible") { refresh(false).then(ping); replies(false); } }, 5 * 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(false).then(ping); });
}
window.Live = { init, refresh, data, render, callingCard, themeFx, fx:fxRun, burst:fxBurst, secret, achievements, checkAch, unlock, wordToday, gameOver, gamesPanel,
  report, replies, myReports, readReports, faq:() => data().faq || [], quote:() => today(data().quotes), wallOn:() => !!(data().wall && get("liveWall", false)), wallUrl:() => data().wall && data().wall.url,
  stickers:() => data().stickers || [], rolloutOk, bucket, countsOn, on:f => listeners.push(f), dev, server };
})();
