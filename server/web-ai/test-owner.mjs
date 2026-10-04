// Tests the owner's tools (owner.js and what they change in worker.js): node test-owner.mjs
import worker from "./worker.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map(), meta = new Map(), ttl = new Map();
let writes = 0;
const LIMITS = {
  get:async (k, o) => kv.has(k) ? (o && o.type === "arrayBuffer" ? kv.get(k) : kv.get(k)) : null,
  getWithMetadata:async k => ({ value:kv.has(k) ? kv.get(k) : null, metadata:meta.has(k) ? meta.get(k) : null }),
  put:async (k, v, o) => { writes++; kv.set(k, v); ttl.set(k, o && o.expirationTtl || 0); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); },
  delete:async k => { kv.delete(k); meta.delete(k); },
  list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, ...(meta.has(name) ? { metadata:meta.get(name) } : {}) })), list_complete:true })
};
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123,Friend=friendcode99", LIMITS };
let clock = Date.parse("2026-10-05T12:00:00Z");      // a Monday
const realNow = Date.now; Date.now = () => clock;

// pretend Claude, Apple's push service and the watched sites
const claude = [], pushes = [];
let modelsStatus = 200, siteUp = true;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url === "https://api.anthropic.com/v1/messages") {
    claude.push(JSON.parse(init.body));
    const ev = [{ type:"message_start", message:{ usage:{ input_tokens:1000000 } } }, { type:"content_block_delta", delta:{ type:"text_delta", text:"Hi" } }, { type:"message_delta", delta:{ stop_reason:"end_turn" }, usage:{ output_tokens:10 } }];
    return new Response(ev.map(e => "event: " + e.type + "\ndata: " + JSON.stringify(e) + "\n\n").join(""), { status:200 });
  }
  if (url.startsWith("https://api.anthropic.com/v1/models")) return new Response("{}", { status:modelsStatus });
  if (url.startsWith("https://web.push.apple.com/")) { pushes.push(url); return new Response("", { status:201 }); }
  if (url.startsWith("https://spiderkingfr-eng.github.io/") || url.startsWith("https://raw.githubusercontent.com/")) return new Response(siteUp ? "{}" : "down", { status:siteUp ? 200 : 503 });
  return new Response("no", { status:599 });
};
async function call(path, body, extra = {}) {
  const res = await worker.fetch(new Request("https://web-ai.example.workers.dev" + path, { method:"POST", headers:{ "content-type":"application/json", Origin:"https://browser.example", "CF-Connecting-IP":extra.ip || "203.0.113.5", "User-Agent":extra.ua || "Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537" }, body:JSON.stringify(body) }), extra.env || env, { waitUntil(p) { waits.push(p); } });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch (e) {}
  return { res, j, text };
}
let waits = [];
const settle = async () => { await Promise.all(waits); waits = []; };
let trust = "";
const admin = (op, o = {}, extra) => call("/admin", { code:"ownercode123", trust, op, ...o }, extra);
const cron = async iso => { clock = Date.parse(iso); const w = []; await worker.scheduled({ scheduledTime:clock }, env, { waitUntil(p) { w.push(p); } }); await Promise.all(w); };
// a pretend phone (or the owner's dashboard app) for push
const ecdh = await crypto.subtle.generateKey({ name:"ECDH", namedCurve:"P-256" }, true, ["deriveBits"]);
const p256 = Buffer.from(await crypto.subtle.exportKey("raw", ecdh.publicKey)).toString("base64url"), auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
const sub = name => ({ endpoint:"https://web.push.apple.com/" + name, keys:{ p256dh:p256, auth } });

// ---- signing in: a token for this browser
let r = await admin("hello");
ok(r.j.ok && /^[a-z0-9]{32}$/.test(r.j.trust) && r.j.twoStep === false, "signing in gives the browser a token");
trust = r.j.trust;
r = await admin("hello");
ok(r.j.ok && !r.j.trust, "a known browser gets no new one");
r = await call("/admin", { code:"friendcode99", op:"stats" });
ok(r.res.status === 401, "a friend's code isn't the owner's");

// ---- Web AI settings
r = await admin("cfg.set", { patch:{ ai:{ model:"gpt-9", length:"long", daily:7, cap:-5 } } });
ok(r.j.cfg.ai.model === "" && r.j.cfg.ai.length === "long" && r.j.cfg.ai.daily === 7 && r.j.cfg.ai.cap === 0, "settings are checked (an unknown model is refused)");
await admin("cfg.set", { patch:{ ai:{ model:"claude-haiku-4-5" } } });
r = await call("/chat", { device:"device-aaaa-1111", messages:[{ role:"user", content:"hi" }] }); await settle();
ok(r.res.status === 200 && claude[0].model === "claude-haiku-4-5" && claude[0].max_tokens === 8000 && !claude[0].output_config, "the chosen model and answer length are used");
r = await call("/check", { device:"device-aaaa-1111" });
ok(r.j.limit === 7 && r.j.left === 6, "the daily limit from the dashboard");
await admin("cfg.set", { patch:{ ai:{ paused:true, pauseMsg:"Back at 5!" } } });
r = await call("/chat", { device:"device-aaaa-1111", messages:[{ role:"user", content:"hi" }] });
ok(r.res.status === 503 && r.j.error === "paused" && r.j.message === "Back at 5!", "paused: says the owner's message");
await admin("cfg.set", { patch:{ ai:{ paused:false }, maint:{ on:true, text:"" } } });
r = await call("/chat", { device:"device-aaaa-1111", messages:[{ role:"user", content:"hi" }] });
ok(r.res.status === 503 && r.j.error === "maintenance", "maintenance mode");
await admin("cfg.set", { patch:{ maint:{ on:false } } });

// ---- alerts on the owner's phone (the dashboard installed as an app, which asks for the server's key first)
await worker.fetch(new Request("https://web-ai.example.workers.dev/push/key"), env, { waitUntil(){} });
r = await admin("sub.add", { sub:sub("owner-phone") });
ok(r.j.ok && JSON.parse(kv.get("admin:subs")).length === 1 && kv.get("admin:origin") === "https://web-ai.example.workers.dev", "the owner's phone signs up for alerts");
r = await admin("sub.test"); await settle();
ok(r.j.ok && pushes.filter(u => u.endsWith("owner-phone")).length === 1, "a test alert reaches it");

// ---- the spending limit
await admin("cfg.set", { patch:{ ai:{ cap:0.5 } } });
pushes.length = 0;
r = await call("/chat", { device:"device-aaaa-1111", messages:[{ role:"user", content:"hi" }] }); await settle();
ok(r.res.status === 429 && r.j.error === "cap" && pushes.length === 1, "the spending limit stops Web AI (a million input tokens with Haiku is about $1) and tells the owner once");
r = await call("/chat", { device:"device-aaaa-1111", messages:[{ role:"user", content:"hi" }] }); await settle();
ok(r.res.status === 429 && pushes.length === 1, "only once a day");
await admin("cfg.set", { patch:{ ai:{ cap:0 } } });

// ---- the owner's code and the Web AI codes
r = await admin("owner.code", { newCode:"short" });
ok(r.res.status === 400, "an owner's code needs 10 or more letters");
r = await admin("owner.code", { newCode:"friendcode99" });
ok(r.res.status === 400, "not one of the Web AI codes");
r = await admin("owner.code", { newCode:"brand-new-owner-1" });
ok(r.j.ok && !kv.get("admin:owner").includes("brand-new-owner-1"), "changed, and only a hash is kept");
r = await call("/admin", { code:"ownercode123", trust, op:"stats" });
ok(r.res.status === 401, "the old (leaked) code no longer opens the dashboard");
r = await call("/admin", { code:"brand-new-owner-1", trust, op:"stats" });
ok(r.j.ok, "the new one does");
const A = (op, o = {}, extra) => call("/admin", { code:"brand-new-owner-1", trust, op, ...o }, extra);
r = await A("codes.get");
ok(r.j.list.length === 2 && r.j.list[1].code === "friendcode99" && !r.j.fromDashboard, "the Web AI codes, as setup.cmd gave them");
r = await A("codes.set", { list:[{ name:"Me", code:"ownercode123" }, { name:"Friend", code:"short" }] });
ok(r.res.status === 400, "codes are checked");
r = await A("codes.set", { list:[{ name:"Me", code:"ownercode123x" }, { name:"Sam", code:"samsnewcode1", limit:3 }] });
ok(r.j.ok, "the codes are changed on the dashboard");
r = await call("/check", { code:"friendcode99" });
ok(r.res.status === 401, "a removed code stops working");
r = await call("/check", { code:"samsnewcode1" });
ok(r.j.ok && r.j.name === "Sam" && r.j.limit === 3, "a new one works, with its own limit");

// ---- blocking
r = await call("/support/open", { platform:"windows", text:"spam spam", device:"device-bad-2222" });
const bad = { id:r.j.id, token:r.j.token };
r = await A("blockTicket", { id:bad.id });
ok(r.j.ok && JSON.parse(kv.get("admin:cfg")).block.devices.length === 1, "block the device of a support chat");
r = await call("/chat", { device:"device-bad-2222", messages:[{ role:"user", content:"hi" }] });
ok(r.res.status === 403 && r.j.error === "blocked", "a blocked device can't use Web AI");
r = await call("/support/open", { platform:"windows", text:"again", device:"device-bad-2222" });
ok(r.res.status === 403, "or start a support chat");
r = await call("/live/ping", { device:"device-bad-2222", platform:"windows", version:"3.7.0" });
ok(r.res.status === 403, "or check in");
await A("cfg.set", { patch:{ block:{ devices:[], codes:["Sam"] } } });
r = await call("/chat", { code:"samsnewcode1", messages:[{ role:"user", content:"hi" }] });
ok(r.res.status === 403, "a code can be blocked by its name");
await A("cfg.set", { patch:{ block:{ devices:[], codes:[] } } });

// ---- support: an alert for the owner, the away message, ratings, how long chats are kept
await A("cfg.set", { patch:{ away:{ on:true, text:"Away until Monday!" }, keep:7 } });
pushes.length = 0;
r = await call("/support/open", { platform:"iphone", text:"Help please", device:"device-good-3333" }); await settle();
const T = { id:r.j.id, token:r.j.token };
ok(pushes.length === 1, "a new chat is an alert on the owner's phone");
r = await call("/support/poll", { ...T, since:0 });
ok(r.j.msgs.length === 1 && r.j.msgs[0].t === "Away until Monday!", "the away message answers by itself");
await call("/support/send", { ...T, text:"still there?" });
r = await call("/support/poll", { ...T, since:0 });
ok(r.j.msgs.length === 1, "only once every 12 hours in a chat");
r = await A("ticket", { id:T.id });
ok(r.j.dev && r.j.msgs.some(m => m.auto), "the dashboard sees it was automatic");
r = await call("/support/rate", { ...T, r:1 });
ok(r.j.ok, "they rate the help");
r = await A("tickets");
ok(r.j.items.find(x => x.id === T.id).rate === 1, "the dashboard sees 👍");
await A("closeTicket", { id:T.id });
ok(ttl.get("tka:" + T.id) === 7 * 86400 && ttl.get("tku:" + T.id) === 7 * 86400, "finished chats are kept as long as the owner chose (7 days)");

// ---- two-step login
r = await A("2fa.on");
ok(r.j.ok && /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/.test(r.j.recovery), "two-step login on, with a recovery code");
const recovery = r.j.recovery;
r = await A("stats");
ok(r.j.ok, "this browser is approved already");
pushes.length = 0;
r = await call("/admin", { code:"brand-new-owner-1", op:"stats" }, { ua:"Mozilla/5.0 (iPhone) Safari/605" }); await settle();
ok(r.res.status === 403 && r.j.error === "twostep" && pushes.length === 1, "a new browser needs approval: the owner's phone is asked");
const ch = r.j.ch;
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.poll", ch });
ok(r.j.waiting, "it waits");
r = await A("2fa.peek", { ch });
ok(r.j.ua === "Safari on iPhone", "the owner sees which browser: " + r.j.ua);
r = await A("2fa.approve", { ch });
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.poll", ch });
ok(/^[a-z0-9]{32}$/.test(r.j.trust), "approved: the new browser gets its token");
const t2 = r.j.trust;
r = await call("/admin", { code:"brand-new-owner-1", trust:t2, op:"stats" });
ok(r.j.ok, "and it's in");
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.poll", ch });
ok(r.res.status === 404, "an approval is picked up once");
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.recover", recovery:"nope" });
ok(r.res.status === 401, "a wrong recovery code");
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.recover", recovery });
ok(/^[a-z0-9]{32}$/.test(r.j.trust) && r.j.recovery && r.j.recovery !== recovery, "the recovery code lets you in once, and a new one is made");
r = await call("/admin", { code:"brand-new-owner-1", op:"2fa.recover", recovery });
ok(r.res.status === 401, "the old recovery code is used up");
r = await A("trust.revoke", { all:true });
r = await call("/admin", { code:"brand-new-owner-1", trust:t2, op:"stats" });
ok(r.res.status === 403, "sign out every other browser");
r = await A("stats");
ok(r.j.ok, "but not this one");
await A("2fa.off");

// ---- wrong codes
pushes.length = 0;
for (let i = 0; i < 3; i++) await call("/admin", { code:"guess" + i, op:"stats" }, { ip:"192.0.2.66" });
await settle();
ok(pushes.length === 1, "3 wrong codes: an alert");
r = await A("cfg.get");
ok(r.j.fails >= 3, "the dashboard shows the wrong tries: " + r.j.fails);

// ---- notifications: to the owner first, at a set time, and the history
await call("/push/subscribe", { sub:sub("a-phone"), key:JSON.parse(kv.get("push:vapid")).pub, news:true, updates:true });
pushes.length = 0;
r = await A("push.me", { title:"Test", text:"How does it look?" });
ok(r.j.ok && pushes.length === 1 && pushes[0].endsWith("owner-phone"), "send to me first: only the owner's phone");
r = await A("push.schedule", { title:"Tomorrow", text:"Big update!", at:clock + 3600000 });
ok(r.j.sched.length === 1, "scheduled");
await cron("2026-10-05T12:30:00Z");
ok(!pushes.some(u => u.endsWith("a-phone")), "not before its time");
await cron("2026-10-05T13:01:00Z");
await cron("2026-10-05T13:02:00Z");
ok(pushes.some(u => u.endsWith("a-phone")), "sent at its time");
r = await A("push.hist");
ok(r.j.items.some(x => x.kind === "scheduled" && x.title === "Tomorrow" && x.sent === 1) && r.j.items.some(x => x.kind === "preview") && !r.j.sched.length, "the history: " + JSON.stringify(r.j.items.map(x => x.kind)));

// ---- problem reports: a reply the app can read
r = await call("/report", { device:"device-good-3333", app:"iphone", version:"2.7.0", text:"The weather is gone", rtok:"abcdefghijklmnop1234" });
const rid = r.j.id;
ok(/^[0-9]{13}-[a-z0-9]{6}$/.test(rid), "a report gets an id");
r = await A("reports");
ok(r.j.items[0].canReply && !("rh" in r.j.items[0]), "the dashboard can reply (the token isn't shown)");
await A("report.reply", { id:rid, text:"Fixed in 2.7.1!" });
await A("report.fix", { id:rid });
r = await call("/live/replies", { reports:[{ id:rid, t:"wrong-token-000000" }] });
ok(r.j.items.length === 0, "another token can't read the reply");
r = await call("/live/replies", { reports:[{ id:rid, t:"abcdefghijklmnop1234" }] });
ok(r.j.items[0].reply.t === "Fixed in 2.7.1!" && r.j.items[0].fixed > 0, "the app reads the reply and that it's fixed");

// ---- the backup, the log, the health panel
r = await A("export");
ok(r.j.chats.length >= 2 && r.j.reports.length === 1 && !JSON.stringify(r.j).includes("tokenHash") && !JSON.stringify(r.j).includes('"rh"'), "the backup has chats and reports, and no tokens");
r = await A("log");
ok(r.j.items.length > 10 && r.j.items.some(x => /owner's code/.test(x.w)) && r.j.items.some(x => /two-step/.test(x.w)), "the activity log");
r = await A("health");
ok(r.j.checks.find(c => c.name === "Claude API key").ok && r.j.checks.find(c => c.name === "Storage (KV)").ok && r.j.checks.find(c => c.name === "Alerts to your phone").ok, "the health panel");
modelsStatus = 401;
r = await A("health");
ok(!r.j.checks.find(c => c.name === "Claude API key").ok, "it spots a key that doesn't work");

// ---- outage alerts: only changes are written
pushes.length = 0; siteUp = false;
let w = writes;
await cron("2026-10-05T14:05:00Z");
ok(pushes.length === 0, "down once: no alert yet");
await cron("2026-10-05T14:10:00Z");
ok(pushes.length === 1, "down for 10 minutes: an alert");
await cron("2026-10-05T14:15:00Z");
ok(pushes.length === 1, "only once");
const ww = writes;
await cron("2026-10-05T14:20:00Z");
ok(writes === ww, "while it stays down, nothing more is written");
siteUp = true;
await cron("2026-10-05T14:25:00Z");
ok(pushes.length === 2, "back up: an alert");
ok(!JSON.parse(kv.get("watch:state") || "{}")[Object.keys(JSON.parse(kv.get("watch:state") || "{}"))[0]], "nothing kept while everything answers");

// ---- the weekly report: Monday 9 in the morning where the owner is
await A("cfg.set", { patch:{ tz:300 } });      // New York in winter (UTC-5)
pushes.length = 0;
await cron("2026-10-12T09:00:00Z");
ok(pushes.length === 0, "not at 9 UTC");
await cron("2026-10-12T14:00:00Z");
ok(pushes.length === 1, "at 9 in the morning New York time");
await cron("2026-10-12T14:00:00Z");
ok(pushes.length === 1, "once a week");

Date.now = realNow;
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
