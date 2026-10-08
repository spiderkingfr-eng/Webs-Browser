/* Web AI server - the owner's tools, used by the dashboard (/admin) and by the jobs Cloudflare runs
   every minute. Everything here is about running the server; nothing in it can see what anyone
   browses.

   Stored in LIMITS (KV):
     admin:cfg     the owner's settings: Web AI (model, answer length, limits, pause, spending cap),
                   maintenance, blocked devices and codes, saved replies, away message, how long
                   finished chats are kept, two-step login, alerts, time zone, hidden nicknames
     admin:codes   the Web AI codes, once changed on the dashboard (they then replace WEB_AI_CODES)
     admin:owner   a hash of the owner's code, once changed on the dashboard
     admin:trust   hashes of the browsers that may open the dashboard (two-step login)
     admin:ch:<id> a login waiting to be approved on the owner's phone (5 minutes)
     admin:subs    the owner's own devices for alerts (the dashboard installed as an app)
     admin:log     what the owner did on the dashboard (the newest 300)
     admin:origin  this server's address, for links in alerts sent by the scheduled jobs
     admin:weekly  the week the last weekly report was for
     push:hist     the notifications sent (the newest 40)
     push:sched    notifications waiting to go out at a set time
     watch:state   whether the iPhone app's website and the update files answer */
import { json, readJSON, hash, rnd, cut, same, count, pushOne, pushCtx, vapid, tidyMsg, PUSH_HOSTS, unb64u,
  envCodes, limit, UNLIMITED_SHOWN, cost, APP_URL, IPHONE_UPDATES, WIN_UPDATES } from "./worker.js";

const now = () => Date.now();
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))))].map(b => b.toString(16).padStart(2, "0")).join("");
const bool = v => v === true;
const num = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const txt = (v, n) => cut(v, n).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim();
export const MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-haiku-4-5"];
export const LENGTHS = { short:1500, normal:4000, long:8000 };
const day = t => new Date(t || now()).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- the owner's settings (cached for 20 seconds) */
// kept per storage (the settings) and per server setup (the codes), so a test's separate setups never mix
const memo = new WeakMap(), M = o => { let m = memo.get(o); if (!m) memo.set(o, m = {}); return m; };
const DEF = { ai:{ model:"", length:"", daily:0, network:0, total:0, paused:false, pauseMsg:"", cap:0 }, maint:{ on:false, text:"" },
  block:{ devices:[], codes:[] }, replies:[], away:{ on:false, text:"" }, keep:30, twoStep:false, recovery:"", tz:0, weekly:true,
  alerts:{ support:true, logins:true, outages:true, cap:true }, watch:[], hideNick:[] };
export async function ownerCfg(env, fresh) {
  const m = M(env.LIMITS);
  if (!fresh && m.cfg && now() - m.cfg.at < 20000) return m.cfg.v;
  const s = await readJSON(env, "admin:cfg") || {};
  const v = { ...DEF, ...s, ai:{ ...DEF.ai, ...(s.ai || {}) }, maint:{ ...DEF.maint, ...(s.maint || {}) }, block:{ ...DEF.block, ...(s.block || {}) },
    away:{ ...DEF.away, ...(s.away || {}) }, alerts:{ ...DEF.alerts, ...(s.alerts || {}) } };
  m.cfg = { at:now(), v };
  return v;
}
async function saveCfg(env, v) { await env.LIMITS.put("admin:cfg", JSON.stringify(v)); M(env.LIMITS).cfg = { at:now(), v }; M(env).codes = null; }
// what the dashboard may change, each one checked
function cleanPatch(p, cur) {
  const v = JSON.parse(JSON.stringify(cur));
  if (p.ai && typeof p.ai === "object") {
    const a = p.ai;
    if ("model" in a) v.ai.model = MODELS.includes(a.model) ? a.model : "";
    if ("length" in a) v.ai.length = a.length in LENGTHS ? a.length : "";
    for (const k of ["daily", "network", "total"]) if (k in a) v.ai[k] = num(a[k], 0, 100000, 0);
    if ("paused" in a) v.ai.paused = bool(a.paused);
    if ("pauseMsg" in a) v.ai.pauseMsg = txt(a.pauseMsg, 200);
    if ("cap" in a) v.ai.cap = Math.max(0, Math.min(1000, Math.round(+a.cap * 100) / 100 || 0));
  }
  if (p.maint && typeof p.maint === "object") v.maint = { on:bool(p.maint.on), text:txt(p.maint.text, 200) };
  if (Array.isArray(p.replies)) v.replies = p.replies.map(r => txt(r, 1000)).filter(Boolean).slice(0, 30);
  if (p.away && typeof p.away === "object") v.away = { on:bool(p.away.on), text:txt(p.away.text, 500) };
  if ("keep" in p) v.keep = [7, 30, 90].includes(+p.keep) ? +p.keep : 30;
  if ("tz" in p) v.tz = num(p.tz, -900, 900, 0);
  if ("weekly" in p) v.weekly = bool(p.weekly);
  if (p.alerts && typeof p.alerts === "object") for (const k of Object.keys(DEF.alerts)) if (k in p.alerts) v.alerts[k] = bool(p.alerts[k]);
  if (Array.isArray(p.watch)) v.watch = p.watch.map(u => String(u || "").trim()).filter(u => /^https:\/\/[^\s"<>]{4,300}$/.test(u)).slice(0, 5);
  if (p.block && typeof p.block === "object") {
    if (Array.isArray(p.block.devices)) v.block.devices = p.block.devices.filter(d => /^d[0-9a-f]{16}$/.test(d)).slice(0, 500);
    if (Array.isArray(p.block.codes)) v.block.codes = p.block.codes.map(n => txt(n, 40)).filter(Boolean).slice(0, 100);
  }
  if (Array.isArray(p.hideNick)) v.hideNick = p.hideNick.filter(d => /^d[0-9a-f]{16}$/.test(d)).slice(0, 500);
  return v;
}
export const isBlocked = (c, who) => !!who && (c.block.devices.includes(who.id) || (!!who.name && c.block.codes.includes(who.name)));
// the Web AI limits and model, with the dashboard's choices over the server's settings
export function aiSettings(env, c) {
  const a = c.ai;
  return { model:a.model || String(env.MODEL || "").trim() || "claude-fable-5-1", maxTokens:LENGTHS[a.length] || 4000,
    daily:a.daily || limit(env.DAILY_LIMIT, 25), network:a.network || limit(env.NETWORK_DAILY_LIMIT, 100), total:a.total || limit(env.TOTAL_DAILY_LIMIT, 150) };
}

/* ---------------------------------------------------------------- Web AI codes and the owner's code */
const okCode = c => c && /^[A-Za-z0-9_-]{8,64}$/.test(c.code || "");
export async function allCodes(env) {
  const mm = M(env), sig = String(env.WEB_AI_CODES || "") + "|" + String(env.DAILY_LIMIT || "");
  if (mm.codes && mm.codes.sig === sig && now() - mm.codes.at < 20000) return mm.codes.v;
  const k = await readJSON(env, "admin:codes"), c = await ownerCfg(env), daily = c.ai.daily || limit(env.DAILY_LIMIT, 25);
  const v = k && Array.isArray(k.list) ? k.list.filter(okCode).map(x => x.unlimited ? { name:x.name || "Someone", code:x.code, limit:UNLIMITED_SHOWN, unlimited:true } : { name:x.name || "Someone", code:x.code, limit:x.limit > 0 ? x.limit : daily }) : envCodes(env, daily);
  mm.codes = { at:now(), v, sig };
  return v;
}
const ownerNamed = list => list.find(x => /^(me|owner|admin)$/i.test(x.name));
// the owner's code: ADMIN_CODE, else one set on the dashboard, else the code named Me (or the first code)
export async function ownerCheck(env, code) {
  if (!code) return false;
  if (String(env.ADMIN_CODE || "").trim().length >= 8) return same(code, String(env.ADMIN_CODE).trim());
  const o = await readJSON(env, "admin:owner");
  if (o && o.h) return same(await sha("owner:" + code), o.h);
  const list = await allCodes(env), c = ownerNamed(list) || list[0];
  return !!c && same(code, c.code);
}
export async function ownerChosen(env) {     // an owner's code picked on purpose (not just the first code handed out)
  return String(env.ADMIN_CODE || "").trim().length >= 8 || !!(await readJSON(env, "admin:owner")) || !!ownerNamed(await allCodes(env));
}
export async function ownerExists(env) { return String(env.ADMIN_CODE || "").trim().length >= 8 || !!(await readJSON(env, "admin:owner")) || (await allCodes(env)).length > 0; }

/* ---------------------------------------------------------------- alerts on the owner's own devices */
export async function pushOwner(env, msg, kind) {
  try {
    const c = await ownerCfg(env);
    if (kind && c.alerts[kind] === false) return 0;
    const subs = await readJSON(env, "admin:subs") || [], v = await vapid(env, false);
    if (!subs.length || !v) return 0;
    const origin = await env.LIMITS.get("admin:origin") || "";
    const m = tidyMsg({ ...msg, url:msg.url && /^https:/.test(msg.url) ? msg.url : origin ? origin + "/admin" + (msg.go || "") : "./" });
    let sent = 0, gone = [];
    const ctx = pushCtx(env, v);
    await Promise.all(subs.map(async s => {
      try { const r = await pushOne(ctx, s, m); if (r.status >= 200 && r.status < 300) sent++; else if (r.status === 404 || r.status === 410) gone.push(s.e); } catch (e) {}
    }));
    if (gone.length) await env.LIMITS.put("admin:subs", JSON.stringify(subs.filter(s => !gone.includes(s.e))));
    return sent;
  } catch (e) { console.log("owner alert failed:", e && e.message); return 0; }
}
export async function logA(env, what) {
  try {
    const l = await readJSON(env, "admin:log") || [];
    l.unshift({ at:now(), w:cut(what, 200) });
    await env.LIMITS.put("admin:log", JSON.stringify(l.slice(0, 300)));
  } catch (e) {}
}
export async function addHist(env, h) {
  try {
    const l = await readJSON(env, "push:hist") || [];
    l.unshift({ at:now(), ...h });
    await env.LIMITS.put("push:hist", JSON.stringify(l.slice(0, 40)));
  } catch (e) {}
}
const uaShort = ua => {
  ua = String(ua || "");
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "a device";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "a browser";
  return br + " on " + os;
};

/* ---------------------------------------------------------------- signing in: the code, then (with two-step login) a browser the owner approved
   Returns null when the request may go on, or the answer to send back. */
export async function ownerGate(req, env, body, h) {
  const code = String(body && body.code || "").trim(), ip = req.headers.get("CF-Connecting-IP") || "";
  const d = day(), failKey = "afail:" + (await hash("ip:" + ip));
  const fails = await count(env, failKey, d);
  if (fails >= 20) return json({ error:"limit", message:"Too many wrong codes today. Try again tomorrow." }, 429, h);
  if (!(await ownerCheck(env, code))) {
    await env.LIMITS.put("n:" + d + ":" + failKey, String(fails + 1), { expirationTtl:3 * 86400 });
    const all = await count(env, "afail", d);
    await env.LIMITS.put("n:" + d + ":afail", String(all + 1), { expirationTtl:3 * 86400 });
    if (all + 1 === 3 || all + 1 === 10) await pushOwner(env, { title:"🔐 Wrong owner codes", body:(all + 1) + " wrong tries at your dashboard's code today. If that wasn't you, change your code (Settings & security).", tag:"webs-login" }, "logins");
    return json({ error:"code", message:(await ownerExists(env)) ? "That isn't the owner's code." : "Add a Web AI code named Me (or ADMIN_CODE) to use this page." }, 401, h);
  }
  const op = String(body.op || "");
  const trust = await trusted(env, body.trust);
  const c = await ownerCfg(env);
  if (!c.twoStep || trust) return null;
  // two-step login: this browser isn't approved yet
  if (op === "2fa.poll") {
    const ch = /^[a-z0-9]{16}$/.test(body.ch || "") ? await readJSON(env, "admin:ch:" + body.ch) : null;
    if (!ch) return json({ error:"gone", message:"That approval expired. Try again." }, 404, h);
    if (!ch.token) return json({ ok:true, waiting:true }, 200, h);
    await env.LIMITS.delete("admin:ch:" + body.ch);
    return json({ ok:true, trust:ch.token }, 200, h);
  }
  if (op === "2fa.recover") {
    if (!c.recovery || !same(await sha("rec:" + String(body.recovery || "").replace(/[\s-]+/g, "").toLowerCase()), c.recovery)) return json({ error:"code", message:"That recovery code isn't right." }, 401, h);
    const token = await newTrust(env, req);
    const fresh = rnd(16), v = await ownerCfg(env, true);
    v.recovery = await sha("rec:" + fresh); await saveCfg(env, v);
    await logA(env, "Signed in with the recovery code (a new one was made)");
    await pushOwner(env, { title:"🔐 Recovery code used", body:"Your dashboard was opened with the recovery code (" + uaShort(req.headers.get("User-Agent")) + ").", tag:"webs-login" }, "logins");
    return json({ ok:true, trust:token, recovery:fresh.match(/.{4}/g).join("-") }, 200, h);
  }
  if (await overLimitDay(env, "a2fa", 20)) return json({ error:"limit", message:"Too many logins waiting today. Try again tomorrow." }, 429, h);
  const id = rnd(16);
  await env.LIMITS.put("admin:ch:" + id, JSON.stringify({ at:now(), ua:uaShort(req.headers.get("User-Agent")) }), { expirationTtl:300 });
  const sent = await pushOwner(env, { title:"🔐 Is this you?", body:"Someone with your owner code is opening your dashboard (" + uaShort(req.headers.get("User-Agent")) + "). Tap to approve.", go:"?approve=" + id, tag:"webs-login" });
  return json({ error:"twostep", ch:id, sent, message:sent ? "Approve this login on your phone: tap the notification." : "Two-step login is on, but none of your devices could be reached. Use your recovery code." }, 403, h);
}
async function overLimitDay(env, key, max) { const d = day(), n = await count(env, key, d); if (n >= max) return true; await env.LIMITS.put("n:" + d + ":" + key, String(n + 1), { expirationTtl:3 * 86400 }); return false; }
async function trusted(env, token) {
  if (!/^[a-z0-9]{32}$/.test(String(token || ""))) return false;
  const h = await sha("trust:" + token), l = await readJSON(env, "admin:trust") || [];
  const t = l.find(x => same(x.h, h));
  if (!t) return false;
  if (now() - (t.last || 0) > 86400000) { t.last = now(); await env.LIMITS.put("admin:trust", JSON.stringify(l)); }     // once a day at most
  return true;
}
async function newTrust(env, req) {
  const token = rnd(32), l = (await readJSON(env, "admin:trust") || []).filter(x => now() - (x.last || x.at) < 90 * 86400000);
  l.unshift({ h:await sha("trust:" + token), at:now(), last:now(), ua:uaShort(req.headers.get("User-Agent")) });
  await env.LIMITS.put("admin:trust", JSON.stringify(l.slice(0, 20)));
  return token;
}

/* ---------------------------------------------------------------- the dashboard's requests for these tools */
export async function ownerAdmin(op, body, env, h, req) {
  // signing in: this browser gets a token (it's how two-step login knows it later); a new browser is an alert
  if (op === "hello") {
    const c = await ownerCfg(env), ok = await trusted(env, body.trust);
    const origin = new URL(req.url).origin;
    if (await env.LIMITS.get("admin:origin") !== origin) await env.LIMITS.put("admin:origin", origin);
    if (ok) return json({ ok:true, twoStep:c.twoStep }, 200, h);
    const token = await newTrust(env, req);
    await pushOwner(env, { title:"🔐 New login", body:"Your dashboard was opened on " + uaShort(req.headers.get("User-Agent")) + ".", tag:"webs-login" }, "logins");
    await logA(env, "Opened the dashboard on " + uaShort(req.headers.get("User-Agent")));
    return json({ ok:true, trust:token, twoStep:c.twoStep }, 200, h);
  }
  if (op === "cfg.get") {
    const c = await ownerCfg(env, true), subs = await readJSON(env, "admin:subs") || [], tr = await readJSON(env, "admin:trust") || [];
    const d = day();
    return json({ ok:true, cfg:{ ...c, recovery:!!c.recovery }, models:MODELS, lengths:LENGTHS, ai:aiSettings(env, c),
      subs:subs.map(s => ({ e:s.e.slice(0, 40), label:s.label, at:s.at })), trust:tr.map((t, i) => ({ i, ua:t.ua, at:t.at, last:t.last })),
      fails:await count(env, "afail", d), ownerSet:!!(await readJSON(env, "admin:owner")), adminSecret:String(env.ADMIN_CODE || "").trim().length >= 8 }, 200, h);
  }
  if (op === "cfg.set") {
    const v = cleanPatch(body.patch || {}, await ownerCfg(env, true));
    await saveCfg(env, v);
    await logA(env, "Changed settings: " + Object.keys(body.patch || {}).join(", "));
    return json({ ok:true, cfg:{ ...v, recovery:!!v.recovery } }, 200, h);
  }
  if (op === "owner.code") {
    if (String(env.ADMIN_CODE || "").trim().length >= 8) return json({ error:"bad", message:"Your owner's code is set as ADMIN_CODE on Cloudflare. Change it there with setup.cmd." }, 400, h);
    const n = String(body.newCode || "").trim();
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(n)) return json({ error:"bad", message:"Use 10 or more letters and numbers." }, 400, h);
    if ((await allCodes(env)).some(x => x.code === n)) return json({ error:"bad", message:"That's already a Web AI code. Pick another." }, 400, h);
    await env.LIMITS.put("admin:owner", JSON.stringify({ h:await sha("owner:" + n), at:now() }));
    await logA(env, "Changed the owner's code");
    await pushOwner(env, { title:"🔐 Owner code changed", body:"Your dashboard's code was changed.", tag:"webs-login" }, "logins");
    return json({ ok:true }, 200, h);
  }
  if (op === "codes.get") {
    const list = await allCodes(env), k = await readJSON(env, "admin:codes");
    return json({ ok:true, list:list.map(x => ({ name:x.name, code:x.code, limit:x.unlimited ? 0 : x.limit, unlimited:!!x.unlimited })), fromDashboard:!!k }, 200, h);
  }
  if (op === "codes.set") {
    const list = (Array.isArray(body.list) ? body.list : []).slice(0, 200).map(x => ({ name:txt(x && x.name, 40) || "Someone", code:String(x && x.code || "").trim(), limit:num(x && x.limit, 0, 100000, 0), ...(x && x.unlimited === true ? { unlimited:true } : {}) }));
    const bad = list.find(x => !okCode(x));
    if (bad) return json({ error:"bad", message:"Codes need 8 to 64 letters and numbers (" + bad.name + ")." }, 400, h);
    if (new Set(list.map(x => x.code)).size !== list.length) return json({ error:"bad", message:"Two people have the same code." }, 400, h);
    await env.LIMITS.put("admin:codes", JSON.stringify({ list, at:now() }));
    M(env).codes = null;
    await logA(env, "Changed the Web AI codes (" + list.length + ")");
    return json({ ok:true }, 200, h);
  }
  if (op === "sub.add") {
    const s = body.sub && typeof body.sub === "object" ? body.sub : {}, e = String(s.endpoint || ""), k = s.keys || {};
    let u = null; try { u = new URL(e); } catch (x) {}
    const p = String(k.p256dh || "").replace(/=+$/, ""), a = String(k.auth || "").replace(/=+$/, "");
    let ok = false; try { ok = unb64u(p).length === 65 && unb64u(a).length === 16; } catch (x) {}
    if (!u || u.protocol !== "https:" || !PUSH_HOSTS.test(u.hostname) || !ok) return json({ error:"bad", message:"That isn't a notification service this server knows." }, 400, h);
    const subs = (await readJSON(env, "admin:subs") || []).filter(x => x.e !== e);
    subs.unshift({ e, p, a, label:uaShort(req.headers.get("User-Agent")), at:now() });
    await env.LIMITS.put("admin:subs", JSON.stringify(subs.slice(0, 5)));
    await env.LIMITS.put("admin:origin", new URL(req.url).origin);
    await logA(env, "Turned on alerts on " + uaShort(req.headers.get("User-Agent")));
    return json({ ok:true }, 200, h);
  }
  if (op === "sub.del") {
    const subs = await readJSON(env, "admin:subs") || [], e = String(body.e || "");
    await env.LIMITS.put("admin:subs", JSON.stringify(subs.filter(x => !x.e.startsWith(e) || !e)));
    await logA(env, "Turned off alerts on a device");
    return json({ ok:true }, 200, h);
  }
  if (op === "sub.test") {
    const n = await pushOwner(env, { title:"🔔 Alerts are on", body:"This is how your dashboard tells you about support chats, logins and outages.", tag:"webs-owner" });
    return n ? json({ ok:true, sent:n }, 200, h) : json({ error:"push", message:"None of your devices could be reached. Turn alerts off and on again." }, 502, h);
  }
  if (op === "2fa.on") {
    const subs = await readJSON(env, "admin:subs") || [];
    if (!subs.length) return json({ error:"bad", message:"First turn on alerts on your phone: that's where you approve logins." }, 400, h);
    const rec = rnd(16), v = await ownerCfg(env, true);
    v.twoStep = true; v.recovery = await sha("rec:" + rec); await saveCfg(env, v);
    await logA(env, "Turned on two-step login");
    return json({ ok:true, recovery:rec.match(/.{4}/g).join("-") }, 200, h);
  }
  if (op === "2fa.off") { const v = await ownerCfg(env, true); v.twoStep = false; await saveCfg(env, v); await logA(env, "Turned off two-step login"); return json({ ok:true }, 200, h); }
  if (op === "2fa.approve") {
    const id = String(body.ch || ""), ch = /^[a-z0-9]{16}$/.test(id) ? await readJSON(env, "admin:ch:" + id) : null;
    if (!ch) return json({ error:"gone", message:"That login request expired." }, 404, h);
    if (body.no === true) { await env.LIMITS.delete("admin:ch:" + id); await logA(env, "Refused a login on " + ch.ua); return json({ ok:true }, 200, h); }
    ch.token = await newTrust(env, req);
    await env.LIMITS.put("admin:ch:" + id, JSON.stringify(ch), { expirationTtl:300 });
    await logA(env, "Approved a login on " + ch.ua);
    return json({ ok:true, ua:ch.ua }, 200, h);
  }
  if (op === "2fa.peek") {
    const id = String(body.ch || ""), ch = /^[a-z0-9]{16}$/.test(id) ? await readJSON(env, "admin:ch:" + id) : null;
    return ch ? json({ ok:true, ua:ch.ua, at:ch.at }, 200, h) : json({ error:"gone", message:"That login request expired." }, 404, h);
  }
  if (op === "trust.revoke") {
    const l = await readJSON(env, "admin:trust") || [], keep = await sha("trust:" + String(body.trust || ""));
    const out = body.all === true ? l.filter(x => x.h === keep) : l.filter((x, i) => i !== +body.i || x.h === keep);
    await env.LIMITS.put("admin:trust", JSON.stringify(out));
    await logA(env, body.all ? "Signed out every other browser" : "Signed out a browser");
    return json({ ok:true }, 200, h);
  }
  if (op === "log") return json({ ok:true, items:await readJSON(env, "admin:log") || [] }, 200, h);
  if (op === "push.hist") return json({ ok:true, items:await readJSON(env, "push:hist") || [], sched:await readJSON(env, "push:sched") || [] }, 200, h);
  if (op === "push.me") {
    const m = { title:txt(body.title, 80) || "Webs", body:txt(body.text, 300), url:String(body.url || "").trim(), tag:"webs-preview" };
    if (!m.body) return json({ error:"bad", message:"Write a message first." }, 400, h);
    const n = await pushOwner(env, m);
    await addHist(env, { kind:"preview", title:m.title, sent:n });
    return n ? json({ ok:true, sent:n }, 200, h) : json({ error:"push", message:"Turn on alerts on your phone first (Settings & security)." }, 400, h);
  }
  if (op === "push.schedule") {
    const at = +body.at, title = txt(body.title, 80), text = txt(body.text, 300), url = String(body.url || "").trim();
    if (!title || !text) return json({ error:"bad", message:"Write a title and a message first." }, 400, h);
    if (!(at > now() + 30000) || at > now() + 60 * 86400000) return json({ error:"bad", message:"Pick a time in the next 60 days." }, 400, h);
    if (url && tidyMsg({ url }).url !== url) return json({ error:"bad", message:"The link has to start with https://" }, 400, h);
    const l = await readJSON(env, "push:sched") || [];
    if (l.length >= 20) return json({ error:"limit", message:"20 waiting is the most." }, 400, h);
    l.push({ id:rnd(8), at, title, text, url }); l.sort((a, b) => a.at - b.at);
    await env.LIMITS.put("push:sched", JSON.stringify(l));
    await logA(env, "Scheduled “" + title + "” for " + new Date(at).toISOString().slice(0, 16).replace("T", " ") + " UTC");
    return json({ ok:true, sched:l }, 200, h);
  }
  if (op === "push.unschedule") {
    const l = (await readJSON(env, "push:sched") || []).filter(x => x.id !== body.id);
    await env.LIMITS.put("push:sched", JSON.stringify(l));
    await logA(env, "Cancelled a scheduled notification");
    return json({ ok:true, sched:l }, 200, h);
  }
  if (op === "health") return json({ ok:true, ...(await health(env)) }, 200, h);
  if (op === "export") return json({ ok:true, ...(await exportAll(env)) }, 200, h);
  if (op === "report.reply" || op === "report.fix") {
    const id = String(body.id || ""), k = "report:" + id, r = /^[0-9]{13}-[a-z0-9]{6}$/.test(id) ? await readJSON(env, k) : null;
    if (!r) return json({ error:"gone", message:"That report is gone." }, 404, h);
    if (op === "report.reply") { const t = txt(body.text, 1000); if (!t) return json({ error:"bad", message:"Write a reply first." }, 400, h); r.reply = { t, at:now() }; }
    else r.fixed = body.on === false ? 0 : now();
    await env.LIMITS.put(k, JSON.stringify(r), { expirationTtl:90 * 86400 });
    await logA(env, op === "report.reply" ? "Replied to a problem report" : r.fixed ? "Marked a problem report fixed" : "Marked a problem report not fixed");
    return json({ ok:true, item:r }, 200, h);
  }
  return null;
}

/* ---------------------------------------------------------------- the health panel */
async function health(env) {
  const out = { server:SERVER_VERSION, checks:[] }, add = (name, ok, say) => out.checks.push({ name, ok, say });
  // the Claude API key (asking which models it can use costs nothing)
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers:{ "x-api-key":String(env.ANTHROPIC_API_KEY || "").trim(), "anthropic-version":"2023-06-01" } });
    add("Claude API key", r.ok, r.ok ? "Works." : r.status === 401 ? "Claude says the key isn't valid. Run setup.cmd and paste a new one." : "Claude answered " + r.status + ".");
  } catch (e) { add("Claude API key", false, "Couldn't reach Claude."); }
  try { await env.LIMITS.put("health:ping", String(now()), { expirationTtl:3600 }); add("Storage (KV)", true, "Reads and writes work."); }
  catch (e) { add("Storage (KV)", false, "Writing failed: " + String(e && e.message || e).slice(0, 120) + ". The free daily limit (1,000 writes) may be used up; it resets at midnight UTC."); }
  const d = day(), q = await count(env, "everyone", d), agg = await readJSON(env, "live:agg") || {};
  const writes = q * 4 + (agg.wroteToday || 0) + 40;
  out.writes = writes;
  add("Free daily writes", writes < 800, "About " + writes + " of the free 1,000 used today (each Web AI question uses 4).");
  const subs = await readJSON(env, "admin:subs") || [], v = await vapid(env, false);
  add("Alerts to your phone", subs.length > 0, subs.length ? subs.length + " device" + (subs.length > 1 ? "s" : "") + " signed up." : "Not on yet: open this dashboard on your phone and turn on alerts.");
  add("Notifications", !!v, v ? "Signing key made " + new Date(v.at).toLocaleDateString("en-US") + "." : "No iPhone has signed up for notifications yet.");
  const w = await readJSON(env, "watch:state") || {}, c = await ownerCfg(env);
  for (const u of [APP_URL, IPHONE_UPDATES, WIN_UPDATES].concat(c.watch || [])) {
    const s = w[u];
    const name = u === APP_URL ? "The iPhone app's website" : u === IPHONE_UPDATES ? "The iPhone update file (GitHub)" : u === WIN_UPDATES ? "The Windows update file (GitHub)" : "Watching " + u.replace(/^https:\/\//, "").slice(0, 60);
    add(name, !s || s.fails < 2, !s ? "Answering." : s.fails < 2 ? "Didn't answer once; checking again." : "Not answering since " + new Date(s.since).toISOString().slice(0, 16).replace("T", " ") + " UTC.");
  }
  add("Scheduled jobs", agg.at && now() - agg.at < 2 * 3600000, agg.at ? "Last hourly run " + Math.round((now() - agg.at) / 60000) + " min ago." : "Not run yet (they run every hour).");
  return out;
}
export const SERVER_VERSION = "2026-10-04";
async function exportAll(env) {
  const reps = await env.LIMITS.list({ prefix:"report:", limit:1000 }), tks = await env.LIMITS.list({ prefix:"tku:", limit:1000 });
  const reports = (await Promise.all(reps.keys.map(k => readJSON(env, k.name)))).filter(Boolean).map(r => { const { rh, ...rest } = r; return rest; });
  const chats = (await Promise.all(tks.keys.map(async k => {
    const u = await readJSON(env, k.name); if (!u) return null;
    const a = await readJSON(env, "tka:" + u.id) || {};
    return { id:u.id, platform:u.platform, version:u.version, created:u.created, open:u.open && !a.closed, rate:u.rate || 0, settings:u.snap, msgs:(u.msgs || []).concat(a.msgs || []).sort((x, y) => x.ts - y.ts), changes:a.changes || [] };
  }))).filter(Boolean);
  return { exported:new Date().toISOString(), reports, chats };
}

/* ---------------------------------------------------------------- the jobs: every minute (scheduled notifications), every 5 minutes (watching), every hour (the weekly report) */
export async function ownerCron(env, t) {
  const d = new Date(t), m = d.getUTCMinutes();
  if (m % 5 === 0) await watch(env).catch(e => console.log("watch:", e && e.message));
  if (m === 0) await weekly(env, t).catch(e => console.log("weekly:", e && e.message));
}
// scheduled notifications that are due become sends (pushCron in worker.js sends them a batch a minute)
export async function dueScheduled(env, t) {
  const l = await readJSON(env, "push:sched");
  if (!l || !l.length || l[0].at > t) return [];
  const due = l.filter(x => x.at <= t), rest = l.filter(x => x.at > t);
  await env.LIMITS.put("push:sched", JSON.stringify(rest));
  return due.map(x => tidyMsg({ title:x.title, body:x.text, url:x.url || "./", tag:"news-" + x.id }));
}
async function watch(env) {
  const c = await ownerCfg(env), urls = [APP_URL, IPHONE_UPDATES, WIN_UPDATES].concat(c.watch || []);
  const st = await readJSON(env, "watch:state") || {}, before = JSON.stringify(st);      // only what isn't answering is kept
  const down = [], up = [], short = u => u.replace(/^https:\/\//, "").replace(/^raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\//, "GitHub: ");
  await Promise.all(urls.map(async u => {
    let ok = false;
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
      const r = await fetch(u, { method:"GET", signal:ac.signal, headers:{ "cache-control":"no-cache" } });
      clearTimeout(tm); ok = r.status < 400; if (r.body) r.body.cancel().catch(() => {});
    } catch (e) { ok = false; }
    const s = st[u];
    if (ok) { if (s && s.fails >= 2) up.push(u); delete st[u]; }
    else {
      const n = { ok:false, fails:Math.min(2, (s ? s.fails : 0) + 1), since:s ? s.since : now() };
      if (n.fails === 2 && (!s || s.fails < 2)) down.push(u);
      st[u] = n;
    }
  }));
  // one alert for everything that went down (after 10 minutes), one for what came back
  if (down.length) await pushOwner(env, { title:"⚠️ Something's down", body:down.map(short).join(", ") + (down.length > 1 ? " haven't" : " hasn't") + " answered for 10 minutes." + (down.includes(APP_URL) ? " The iPhone app can't update until it's back (check GitHub → Settings → Pages)." : ""), tag:"webs-watch" }, "outages");
  if (up.length) await pushOwner(env, { title:"✅ Back up", body:up.map(short).join(", ") + (up.length > 1 ? " are" : " is") + " answering again.", tag:"webs-watch" }, "outages");
  for (const k of Object.keys(st)) if (!urls.includes(k)) delete st[k];
  if (JSON.stringify(st) !== before) await env.LIMITS.put("watch:state", JSON.stringify(st));
}
async function weekly(env, t) {
  const c = await ownerCfg(env);
  if (!c.weekly) return;
  const local = new Date(t - c.tz * 60000);
  if (local.getUTCDay() !== 1 || local.getUTCHours() !== 9) return;          // Monday, 9 in the morning where the owner is
  const wk = local.toISOString().slice(0, 10);
  if (await env.LIMITS.get("admin:weekly") === wk) return;
  await env.LIMITS.put("admin:weekly", wk, { expirationTtl:30 * 86400 });
  let q = 0, money = 0;
  const m = aiSettings(env, c).model;
  for (let i = 1; i <= 7; i++) {
    const dd = day(t - i * 86400000);
    q += await count(env, "everyone", dd);
    try { money += cost(JSON.parse(await env.LIMITS.get("u:" + dd) || "{}") || {}, m); } catch (e) {}
  }
  const tks = await env.LIMITS.list({ prefix:"tku:", limit:1000 }), weekAgo = t - 7 * 86400000;
  const chats = tks.keys.filter(k => (k.metadata || {}).created > weekAgo).length;
  const reps = (await env.LIMITS.list({ prefix:"report:", limit:1000 })).keys.filter(k => +(k.name.slice(7, 20)) < 1e13 - weekAgo).length;
  const agg = await readJSON(env, "live:agg") || {};
  await pushOwner(env, { title:"📊 Your week on Webs", body:q + " Web AI questions (about $" + money.toFixed(2) + "), " + chats + " support chat" + (chats === 1 ? "" : "s") + ", " + reps + " problem report" + (reps === 1 ? "" : "s") +
    (agg.active7 != null ? ", " + agg.active7 + " devices used Webs" : "") + ".", tag:"webs-weekly" });
}
