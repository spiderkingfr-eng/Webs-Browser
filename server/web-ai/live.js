/* Web AI server - "live": what the owner puts on everyone's start page, and the counts that come back.

   The owner sets it on the dashboard (live:cfg): an announcement (with emoji reactions), a calling
   card, a poll, a countdown, an owner's pick, quotes, trivia, mystery boxes and theme days by date,
   tomorrow's word for the daily puzzle, Webs's birthday, a community goal, a secret code hunt, secret
   words for the address bar, limited-time achievements, the wallpaper of the week, sticker packs,
   help articles, and how new versions roll out.

   The apps read it (GET /live), and say what they did:
     POST /live/ping  { device, platform, version, goal? }   about once an hour while Webs is open,
                      unless "Send anonymous counts" is off: the app's version, the country
                      (from Cloudflare) and when it was last open. Nothing about what anyone browses.
     POST /live/act   { device, kind, ... }   a vote, a trivia answer, a reaction, a found code,
                      an achievement, a game score for the weekly leaderboard (with the nickname
                      chosen for it)
     POST /live/replies { reports:[{ id, t }] }   replies to problem reports this device sent
   Each device is one key, dv:<hash of its random id>, with all of that in its metadata, so the
   hourly job adds everything up with a single list (live:agg). A free account has 1,000 writes a
   day: a device's key is only rewritten when something changed or an hour has passed. */
import { json, readJSON, hash, rnd, cut, corsFor, WIN_UPDATES, IPHONE_UPDATES } from "./worker.js";
import { ownerCfg, isBlocked, logA } from "./owner.js";

const now = () => Date.now();
const txt = (v, n) => cut(v, n).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim();
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const day = t => new Date(t || now()).toISOString().slice(0, 10);
const id8 = s => /^[a-z0-9]{4,16}$/.test(String(s || "")) ? s : rnd(8);
const sha16 = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
export const secretHash = w => sha16("webs:" + String(w || "").trim().toLowerCase());
export const FX = ["snow", "confetti", "hearts", "stars", "leaves", "halloween", "rainbow", "bubbles", "fireworks"];
export const REACTS = ["👍", "❤️", "😂", "😮", "🎉"];
export const GAMES = ["snake", "2048"];
const week = t => { const d = new Date(t || now()); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };   // the Monday it started

/* ---------------------------------------------------------------- the owner's live settings, checked */
const until = v => { const n = +v; return n > 1e12 && n < 1e13 ? n : 0; };
const url = v => { const u = String(v || "").trim(); return /^https?:\/\/[^\s"<>]{3,1000}$/i.test(u) ? u : ""; };
const dated = (list, n, f) => (Array.isArray(list) ? list : []).filter(x => x && isDate(x.date)).map(f).filter(Boolean).sort((a, b) => a.date < b.date ? -1 : 1).slice(-n);
export function cleanLive(p, old) {
  const o = old || {}, v = {};
  if (p.ann && txt(p.ann.text, 300)) v.ann = { id:p.ann.id && o.ann && o.ann.id === p.ann.id ? p.ann.id : id8(p.ann.id), text:txt(p.ann.text, 300), link:url(p.ann.link), until:until(p.ann.until), react:p.ann.react !== false };
  if (p.card && txt(p.card.title, 80)) v.card = { id:id8(p.card.id), title:txt(p.card.title, 80), text:txt(p.card.text, 400), sign:txt(p.card.sign, 60) || "The Phantom Thieves", until:until(p.card.until) };
  if (p.poll && txt(p.poll.q, 200)) {
    const opts = (Array.isArray(p.poll.opts) ? p.poll.opts : []).map(x => txt(x, 60)).filter(Boolean).slice(0, 4);
    if (opts.length >= 2) v.poll = { id:id8(p.poll.id), q:txt(p.poll.q, 200), opts, until:until(p.poll.until) };
  }
  v.words = dated(p.words, 60, x => /^[a-z]{5}$/i.test(x.w || "") ? { date:x.date, w:x.w.toUpperCase() } : null);
  v.themes = dated(p.themes, 60, x => FX.includes(x.kind) ? { date:x.date, kind:x.kind } : null);
  v.quotes = dated(p.quotes, 120, x => txt(x.text, 300) ? { date:x.date, text:txt(x.text, 300), by:txt(x.by, 80) } : null);
  v.trivia = dated(p.trivia, 120, x => {
    const opts = (Array.isArray(x.opts) ? x.opts : []).map(y => txt(y, 80)).filter(Boolean).slice(0, 4), a = Math.round(+x.a);
    return txt(x.q, 200) && opts.length >= 2 && a >= 0 && a < opts.length ? { date:x.date, q:txt(x.q, 200), opts, a } : null;
  });
  v.mystery = dated(p.mystery, 120, x => ["joke", "tip", "fact", "game"].includes(x.kind) && txt(x.text, 300) ? { date:x.date, kind:x.kind, text:txt(x.text, 300) } : null);
  if (p.countdown && txt(p.countdown.label, 60) && isDate(p.countdown.date)) v.countdown = { label:txt(p.countdown.label, 60), date:p.countdown.date, emoji:txt(p.countdown.emoji, 8) || "⏳" };
  if (p.pick && url(p.pick.url)) v.pick = { url:url(p.pick.url), title:txt(p.pick.title, 80) || url(p.pick.url).replace(/^https?:\/\//, "").split("/")[0], note:txt(p.pick.note, 200), until:until(p.pick.until) };
  if (p.birthday && /^\d{2}-\d{2}$/.test(p.birthday.date || "")) v.birthday = { date:p.birthday.date, since:Math.round(+p.birthday.since) || 0 };
  if (p.goal && txt(p.goal.label, 120) && +p.goal.target > 0) v.goal = { id:id8(p.goal.id), label:txt(p.goal.label, 120), game:["snake", "2048", "any"].includes(p.goal.game) ? p.goal.game : "snake",
    target:Math.min(1e7, Math.round(+p.goal.target)), until:until(p.goal.until), reward:txt(p.goal.reward, 120) };
  if (p.hunt && (p.hunt.h || txt(p.hunt.code, 40))) v.hunt = { id:id8(p.hunt.id), hint:txt(p.hunt.hint, 200), h:/^[0-9a-f]{16}$/.test(p.hunt.h || "") && !p.hunt.code ? p.hunt.h : "", code:txt(p.hunt.code, 40), until:until(p.hunt.until) };
  v.secrets = (Array.isArray(p.secrets) ? p.secrets : []).filter(x => x && FX.includes(x.fx) && (/^[0-9a-f]{16}$/.test(x.h || "") || txt(x.word, 40))).slice(0, 20)
    .map(x => ({ h:/^[0-9a-f]{16}$/.test(x.h || "") && !x.word ? x.h : "", word:txt(x.word, 40), fx:x.fx, hint:txt(x.hint, 60) }));
  v.ach = (Array.isArray(p.ach) ? p.ach : []).filter(x => x && txt(x.name, 40)).slice(0, 20).map(x => ({ id:id8(x.id), emoji:txt(x.emoji, 8) || "🏅", name:txt(x.name, 40), desc:txt(x.desc, 120) || "Open Webs while it's on",
    from:until(x.from), until:until(x.until) }));
  if (p.wall && /^[a-z0-9]{10}$/.test(p.wall.id || "")) v.wall = { id:p.wall.id, credit:txt(p.wall.credit, 100), until:until(p.wall.until) };
  v.stickers = (Array.isArray(p.stickers) ? p.stickers : []).filter(x => x && /^[a-z0-9]{10}$/.test(x.id || "")).slice(0, 24).map(x => ({ id:x.id, name:txt(x.name, 40) }));
  v.faq = (Array.isArray(p.faq) ? p.faq : []).filter(x => x && txt(x.q, 200) && txt(x.a, 2000)).slice(0, 30).map(x => ({ q:txt(x.q, 200), a:txt(x.a, 2000) }));
  const ro = p.rollout || {}, rv = s => /^\d+\.\d+\.\d+$/.test(String(s || "")) ? s : "";
  v.rollout = {};
  for (const k of ["win", "ios"]) if (ro[k] && rv(ro[k].v)) v.rollout[k] = { v:ro[k].v, pct:Math.max(0, Math.min(100, Math.round(+ro[k].pct))) };
  v.rollback = p.rollback && rv(p.rollback.win) ? { win:p.rollback.win } : {};
  return v;
}
// secret words and the hunt's code are kept as hashes only (the app hashes what's typed and compares)
async function hashSecrets(v) {
  for (const s of v.secrets) if (s.word) { s.h = await secretHash(s.word); s.word = ""; }
  if (v.hunt && v.hunt.code) { v.hunt.h = await secretHash(v.hunt.code); v.hunt.code = ""; }
  if (v.hunt && !v.hunt.h) delete v.hunt;
  v.secrets = v.secrets.filter(s => s.h);
  return v;
}

const memo = new WeakMap(), M = o => { let m = memo.get(o); if (!m) memo.set(o, m = {}); return m; };     // per storage
export async function liveCfg(env, fresh) {
  const m = M(env.LIMITS);
  if (!fresh && m.live && now() - m.live.at < 20000) return m.live.v;
  const v = await readJSON(env, "live:cfg") || {};
  m.live = { at:now(), v };
  return v;
}
async function liveAgg(env, fresh) {
  const m = M(env.LIMITS);
  if (!fresh && m.agg && now() - m.agg.at < 60000) return m.agg.v;
  const v = await readJSON(env, "live:agg") || {};
  m.agg = { at:now(), v };
  return v;
}

/* ---------------------------------------------------------------- what the apps get: only what's on now (dated things from yesterday to tomorrow, so every time zone has its today) */
const on = x => x && (!x.until || x.until > now()) && (!x.from || x.from <= now());
const near = list => { const a = day(now() - 86400000), b = day(now() + 86400000); return (list || []).filter(x => x.date >= a && x.date <= b); };
export async function livePublic(env, base) {
  const v = await liveCfg(env), agg = await liveAgg(env), c = await ownerCfg(env), img = id => base + "/live/img/" + id;
  const out = { ok:true, rev:v.rev || 0, now:now() };
  if (c.maint.on) out.maint = { text:c.maint.text || "Web AI is down for maintenance. It'll be back soon." };
  else if (c.ai.paused) out.maint = { text:c.ai.pauseMsg || "Web AI is taking a break. Try again later.", ai:true };
  for (const k of ["ann", "card", "poll", "pick"]) if (on(v[k])) out[k] = v[k];
  for (const k of ["words", "themes", "quotes", "trivia", "mystery"]) { const l = near(v[k]); if (l.length) out[k] = l; }
  if (v.countdown && v.countdown.date >= day(now() - 86400000)) out.countdown = v.countdown;
  if (v.birthday) out.birthday = v.birthday;
  if (on(v.goal)) out.goal = { ...v.goal, n:agg.goal && agg.goal.id === v.goal.id ? agg.goal.n : 0 };
  if (on(v.hunt)) out.hunt = { id:v.hunt.id, hint:v.hunt.hint, h:v.hunt.h, found:agg.hunt && agg.hunt.id === v.hunt.id ? agg.hunt.n : 0 };
  if (v.secrets && v.secrets.length) out.secrets = v.secrets.map(s => ({ h:s.h, fx:s.fx }));
  const ach = (v.ach || []).filter(on); if (ach.length) out.ach = ach;
  if (on(v.wall)) out.wall = { ...v.wall, url:img(v.wall.id) };
  if (v.stickers && v.stickers.length) out.stickers = v.stickers.map(s => ({ ...s, url:img(s.id) }));
  if (v.faq && v.faq.length) out.faq = v.faq;
  if (v.rollout && Object.keys(v.rollout).length) out.rollout = v.rollout;
  if (v.rollback && v.rollback.win) out.rollback = v.rollback;
  if (agg.board && agg.board.wk === week()) out.board = agg.board;
  return out;
}

/* ---------------------------------------------------------------- the apps' requests */
const devId = async device => { const d = String(device || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); return d.length >= 12 ? "d" + await hash("device:" + d) : ""; };
const META_MAX = 1000;
async function readDev(env, id) {
  if (typeof env.LIMITS.getWithMetadata === "function") { const r = await env.LIMITS.getWithMetadata("dv:" + id); return r && r.metadata ? r.metadata : null; }
  return null;
}
async function writeDev(env, id, m) {
  let s = JSON.stringify(m);
  while (s.length > META_MAX && m.a && m.a.length) { m.a.shift(); s = JSON.stringify(m); }
  if (s.length > META_MAX) { delete m.nk; s = JSON.stringify(m); }
  await env.LIMITS.put("dv:" + id, "1", { metadata:m, expirationTtl:90 * 86400 });
}
export async function liveApi(path, req, env, cors) {
  const base = new URL(req.url).origin;
  if (req.method === "GET" && path === "/live") {
    const r = json(await livePublic(env, base), 200, cors);
    r.headers.set("cache-control", "public, max-age=60");
    return r;
  }
  const im = /^\/live\/img\/([a-z0-9]{10})$/.exec(path);
  if (req.method === "GET" && im) {
    const r = await env.LIMITS.getWithMetadata("img:" + im[1], { type:"arrayBuffer" });
    if (!r || !r.value) return json({ error:"not_found", message:"No such picture." }, 404, cors);
    const type = r.metadata && /^image\/(jpeg|png|webp)$/.test(r.metadata.type) ? r.metadata.type : "image/jpeg";
    return new Response(r.value, { headers:{ ...corsFor(req.headers.get("Origin") || ""), "Access-Control-Allow-Origin":"*", "content-type":type, "cache-control":"public, max-age=31536000, immutable" } });
  }
  let body = null;
  try { body = await req.json(); } catch (e) {}
  if (!body || typeof body !== "object") return json({ error:"bad", message:"The app sent something the server can't read." }, 400, cors);

  if (path === "/live/replies") {        // replies to this device's problem reports (it keeps their ids and tokens)
    const items = [];
    for (const r of (Array.isArray(body.reports) ? body.reports : []).slice(0, 5)) {
      const id = String(r && r.id || "");
      if (!/^[0-9]{13}-[a-z0-9]{6}$/.test(id)) continue;
      const rep = await readJSON(env, "report:" + id);
      if (!rep || !rep.rh || rep.rh !== await hash("rt:" + String(r.t || ""))) continue;
      items.push({ id, reply:rep.reply || null, fixed:rep.fixed || 0 });
    }
    return json({ ok:true, items }, 200, cors);
  }

  const id = await devId(body.device);
  if (!id) return json({ error:"bad", message:"No device id." }, 400, cors);
  const c = await ownerCfg(env);
  if (isBlocked(c, { id })) return json({ error:"blocked", message:"This isn't available on this device." }, 403, cors);
  const old = await readDev(env, id) || {}, m = JSON.parse(JSON.stringify(old)), v = await liveCfg(env);
  const minute = Math.floor(now() / 60000);

  if (path === "/live/ping") {
    m.p = body.platform === "iphone" ? "i" : body.platform === "windows" ? "w" : m.p || "?";
    m.v = /^\d+\.\d+\.\d+$/.test(body.version || "") ? body.version : m.v || "";
    m.c = /^[A-Z]{2}$/.test(req.cf && req.cf.country || "") ? req.cf.country : m.c || "";
    if (Array.isArray(body.goal) && v.goal && body.goal[0] === v.goal.id) m.g = [v.goal.id, Math.max(0, Math.min(100000, Math.round(+body.goal[1]) || 0))];
    const agg = await liveAgg(env), every = (agg.devices || 0) > 300 ? 720 : (agg.devices || 0) > 100 ? 180 : 55;
    const changed = ["p", "v", "c"].some(k => m[k] !== old[k]) || JSON.stringify(m.g) !== JSON.stringify(old.g);
    if (changed || !(minute - (old.t || 0) < every)) { m.t = minute; m.d = m.d || day(); await writeDev(env, id, m); }
    return json({ ok:true }, 200, cors);
  }
  if (path !== "/live/act") return json({ error:"not_found", message:"Nothing here." }, 404, cors);
  const k = String(body.kind || "");
  if (k === "vote") {
    const p = v.poll, ch = Math.round(+body.choice);
    if (!on(p) || p.id !== body.id || !(ch >= 0 && ch < p.opts.length)) return json({ error:"gone", message:"That poll has closed." }, 409, cors);
    if (m.pv && m.pv[0] === p.id) return json({ ok:true, already:true }, 200, cors);
    m.pv = [p.id, ch];
  } else if (k === "trivia") {
    const t = (v.trivia || []).find(x => x.date === body.id), ch = Math.round(+body.choice);
    if (!t || !(ch >= 0 && ch < t.opts.length)) return json({ error:"gone", message:"That question has gone." }, 409, cors);
    if (m.tv && m.tv[0] === t.date) return json({ ok:true, already:true, right:m.tv[1] === 1 }, 200, cors);
    m.tv = [t.date, ch === t.a ? 1 : 0];
  } else if (k === "react") {
    if (!on(v.ann) || v.ann.id !== body.id || !REACTS.includes(body.emoji)) return json({ error:"gone", message:"That announcement has gone." }, 409, cors);
    if (m.rx && m.rx[0] === v.ann.id && m.rx[1] === body.emoji) return json({ ok:true, already:true }, 200, cors);
    m.rx = [v.ann.id, body.emoji];
  } else if (k === "found") {
    if (!on(v.hunt) || v.hunt.id !== body.id || await secretHash(body.code) !== v.hunt.h) return json({ error:"bad", message:"That isn't the code." }, 400, cors);
    if (m.h === v.hunt.id) return json({ ok:true, already:true }, 200, cors);
    m.h = v.hunt.id;
  } else if (k === "ach") {
    const a = (v.ach || []).find(x => x.id === body.id && on(x));
    const goalDone = v.goal && body.id === "goal-" + v.goal.id, huntDone = v.hunt && body.id === "hunt-" + v.hunt.id && m.h === v.hunt.id;
    if (!a && !goalDone && !huntDone) return json({ error:"gone", message:"That achievement isn't on now." }, 409, cors);
    m.a = Array.isArray(m.a) ? m.a : [];
    if (m.a.includes(body.id)) return json({ ok:true, already:true }, 200, cors);
    m.a.push(body.id); m.a = m.a.slice(-15);
  } else if (k === "score") {
    const g = String(body.game || ""), s = Math.round(+body.score), nick = txt(body.nick, 16).replace(/[^\p{L}\p{N} ._-]/gu, "").trim();
    if (!GAMES.includes(g) || !(s > 0 && s <= 1000000)) return json({ error:"bad", message:"That score can't be right." }, 400, cors);
    if (!nick) return json({ error:"bad", message:"Pick a nickname for the leaderboard first." }, 400, cors);
    const wk = week();
    if (!m.sc || m.sc.wk !== wk) m.sc = { wk };
    const better = !(m.sc[g] >= s);
    if (!better && m.nk === nick) return json({ ok:true, already:true }, 200, cors);
    if (better) m.sc[g] = s;
    m.nk = nick;
  } else return json({ error:"bad", message:"Unknown." }, 400, cors);
  m.t = minute; m.d = m.d || day();
  if (!m.p && /^(iphone|windows)$/.test(body.platform || "")) m.p = body.platform === "iphone" ? "i" : "w";
  await writeDev(env, id, m);
  return json({ ok:true, ...(k === "trivia" ? { right:m.tv[1] === 1 } : {}) }, 200, cors);
}

/* ---------------------------------------------------------------- adding it all up (every hour, or when the owner asks) */
export async function aggregate(env) {
  const v = await liveCfg(env, true), c = await ownerCfg(env, true), t = Math.floor(now() / 60000), wk = week(), today = day();
  const a = { at:now(), devices:0, active1:0, active24:0, active7:0, wroteToday:0, plat:{}, vers:{}, countries:{}, poll:null, trivia:{}, react:null, goal:null, hunt:null, ach:{}, board:{ wk }, nicks:[] };
  if (v.poll) a.poll = { id:v.poll.id, counts:v.poll.opts.map(() => 0) };
  if (v.ann) a.react = { id:v.ann.id, counts:{} };
  if (v.goal) a.goal = { id:v.goal.id, n:0 };
  if (v.hunt) a.hunt = { id:v.hunt.id, n:0 };
  const scores = { snake:[], 2048:[] };
  let cursor = "", pages = 0;
  do {
    const l = await env.LIMITS.list({ prefix:"dv:", limit:1000, ...(cursor ? { cursor } : {}) });
    for (const k of l.keys) {
      const m = k.metadata || {}, dev = k.name.slice(3), age = t - (m.t || 0);
      a.devices++;
      if (age < 60) a.active1++; if (age < 1440) a.active24++; if (age < 10080) a.active7++;
      if (m.t && day(m.t * 60000) === today) a.wroteToday++;
      if (age < 30 * 1440) {
        const pk = m.p === "i" ? "iPhone" : m.p === "w" ? "Windows" : "Other";
        a.plat[pk] = (a.plat[pk] || 0) + 1;
        if (m.v) a.vers[pk + " " + m.v] = (a.vers[pk + " " + m.v] || 0) + 1;
        if (m.c) a.countries[m.c] = (a.countries[m.c] || 0) + 1;
      }
      if (a.poll && m.pv && m.pv[0] === a.poll.id && a.poll.counts[m.pv[1]] != null) a.poll.counts[m.pv[1]]++;
      if (m.tv) { const x = a.trivia[m.tv[0]] = a.trivia[m.tv[0]] || { n:0, right:0 }; x.n++; x.right += m.tv[1] ? 1 : 0; }
      if (a.react && m.rx && m.rx[0] === a.react.id) a.react.counts[m.rx[1]] = (a.react.counts[m.rx[1]] || 0) + 1;
      if (a.goal && m.g && m.g[0] === a.goal.id) a.goal.n += m.g[1] || 0;
      if (a.hunt && m.h === a.hunt.id) a.hunt.n++;
      for (const x of m.a || []) a.ach[x] = (a.ach[x] || 0) + 1;
      if (m.sc && m.sc.wk === wk && m.nk) {
        const hidden = c.hideNick.includes(dev);
        for (const g of Object.keys(scores)) if (m.sc[g] > 0 && !hidden) scores[g].push({ n:m.nk, s:m.sc[g] });
        a.nicks.push({ dev, n:m.nk, hidden, snake:m.sc.snake || 0, 2048:m.sc[2048] || 0 });
      }
    }
    cursor = l.list_complete ? "" : l.cursor || "";
  } while (cursor && ++pages < 5);
  for (const g of Object.keys(scores)) a.board[g] = scores[g].sort((x, y) => y.s - x.s).slice(0, 10);
  a.nicks = a.nicks.sort((x, y) => (y.snake + y[2048]) - (x.snake + x[2048])).slice(0, 50);
  await env.LIMITS.put("live:agg", JSON.stringify(a));
  M(env.LIMITS).agg = { at:now(), v:a };
  return a;
}
export async function liveCron(env, t) {
  if (new Date(t).getUTCMinutes() === 30) await aggregate(env).catch(e => console.log("live:", e && e.message));     // every hour, at half past
}

/* ---------------------------------------------------------------- the dashboard's requests */
export async function liveAdmin(op, body, env, h) {
  if (op === "live.get") return json({ ok:true, live:await liveCfg(env, true), agg:await liveAgg(env, true), fx:FX, reacts:REACTS, week:week() }, 200, h);
  if (op === "live.set") {
    const old = await liveCfg(env, true), p = body.live && typeof body.live === "object" ? body.live : {};
    // what the dashboard didn't send stays as it was
    const merged = { ...old, ...p };
    const v = await hashSecrets(cleanLive(merged, old));
    v.rev = (old.rev || 0) + 1;
    await env.LIMITS.put("live:cfg", JSON.stringify(v));
    M(env.LIMITS).live = { at:now(), v };
    await logA(env, "Changed what's on everyone's start page: " + Object.keys(p).join(", "));
    return json({ ok:true, live:v }, 200, h);
  }
  if (op === "live.agg") return json({ ok:true, agg:await aggregate(env) }, 200, h);
  if (op === "img.put") {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
    if (!m) return json({ error:"bad", message:"That isn't a JPEG, PNG or WebP picture." }, 400, h);
    const bin = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0));
    if (bin.length > 900000) return json({ error:"bad", message:"That picture is too big (900 KB at most)." }, 400, h);
    const id = rnd(10);
    await env.LIMITS.put("img:" + id, bin.buffer, { metadata:{ type:m[1], at:now(), kind:body.kind === "sticker" ? "sticker" : "wall" } });
    await logA(env, "Uploaded a " + (body.kind === "sticker" ? "sticker" : "wallpaper"));
    return json({ ok:true, id }, 200, h);
  }
  if (op === "img.del") {
    if (/^[a-z0-9]{10}$/.test(body.id || "")) await env.LIMITS.delete("img:" + body.id);
    return json({ ok:true }, 200, h);
  }
  if (op === "secret.hash") return json({ ok:true, h:await secretHash(body.word) }, 200, h);
  if (op === "updates.info") {        // what's published on GitHub now, for the Updates tab
    const get = async u => { try { const r = await fetch(u + "?t=" + Math.floor(now() / 60000), { headers:{ "cache-control":"no-cache" } }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const [w, i] = await Promise.all([get(WIN_UPDATES), get(IPHONE_UPDATES)]);
    return json({ ok:true, win:w ? { version:w.version, previous:w.previous && w.previous.version || "" } : null, ios:i ? { version:i.version } : null }, 200, h);
  }
  return null;
}
