// Tests the notifications part of the worker: node test-push.mjs
// A pretend Apple push service decrypts every message with the phone's own private key and checks
// the server's signature, so what's tested is what an iPhone would really get.
import worker from "./worker.js";
import { createECDH, createHmac, createDecipheriv, randomBytes } from "node:crypto";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };

// KV with metadata and paging, like Cloudflare's
const kv = new Map(), meta = new Map();
let writes = 0;
const LIMITS = {
  get:async k => kv.has(k) ? kv.get(k) : null,
  put:async (k, v, o) => { writes++; kv.set(k, v); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); },
  delete:async k => { kv.delete(k); meta.delete(k); },
  list:async ({ prefix = "", limit = 1000, cursor }) => {
    // the cursor marks a place among the keys, so deleting one while paging skips nobody (as in Cloudflare)
    const all = [...kv.keys()].filter(k => k.startsWith(prefix) && (!cursor || k > cursor)).sort(), keys = all.slice(0, limit);
    const done = all.length <= limit;
    return { keys:keys.map(name => ({ name, ...(meta.has(name) ? { metadata:meta.get(name) } : {}) })), list_complete:done, ...(done ? {} : { cursor:keys[keys.length - 1] }) };
  }
};
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123,Friend=friendcode99", LIMITS };
const APP = "https://spiderkingfr-eng.github.io";

// phones: each has its own key pair and auth secret, as an iPhone makes them
const b64u = b => Buffer.from(b).toString("base64url");
function phone(name) {
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  const auth = randomBytes(16);
  return { name, ecdh, auth, endpoint:"https://web.push.apple.com/" + name + "-" + randomBytes(6).toString("hex"), got:[], gone:false,
    sub() { return { endpoint:this.endpoint, keys:{ p256dh:b64u(this.ecdh.getPublicKey()), auth:b64u(this.auth) } }; } };
}
const hkdf = (salt, ikm, info, n) => {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  let t = Buffer.alloc(0), out = Buffer.alloc(0);
  for (let i = 1; out.length < n; i++) { t = createHmac("sha256", prk).update(Buffer.concat([t, Buffer.from(info), Buffer.from([i])])).digest(); out = Buffer.concat([out, t]); }
  return out.subarray(0, n);
};
function decrypt(p, body) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = p.ecdh.computeSecret(asPub);
  const ikm = hkdf(p.auth, secret, Buffer.concat([Buffer.from("WebPush: info\0"), p.ecdh.getPublicKey(), asPub]), 32);
  const cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16), nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const d = createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1; while (end >= 0 && plain[end] === 0) end--;
  if (plain[end] !== 2 || rs !== 4096 || idlen !== 65) throw new Error("bad record");
  return JSON.parse(plain.subarray(0, end).toString());
}

let serverKey = "", pushes = [], badSig = 0, iphoneJson = { version:"2.3.0", notes:["Old notes"] }, applesAnswer = 0;
const phones = new Map();
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith("https://raw.githubusercontent.com/")) return new Response(JSON.stringify(iphoneJson), { status:200 });
  if (!url.startsWith("https://web.push.apple.com/")) return new Response("no", { status:599 });
  const p = phones.get(url), h = init.headers || {};
  // the signature: a JWT for Apple's address, signed with the key the app subscribed with
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(\S+)$/.exec(h.Authorization || "");
  let good = false;
  if (m && m[4] === serverKey) {
    const key = await crypto.subtle.importKey("raw", Buffer.from(serverKey, "base64url"), { name:"ECDSA", namedCurve:"P-256" }, false, ["verify"]);
    const claims = JSON.parse(Buffer.from(m[2], "base64url"));
    good = await crypto.subtle.verify({ name:"ECDSA", hash:"SHA-256" }, key, Buffer.from(m[3], "base64url"), Buffer.from(m[1] + "." + m[2]))
      && claims.aud === "https://web.push.apple.com" && claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 86400 && /^https:\/\/|^mailto:/.test(claims.sub);
  }
  if (!good) { badSig++; return new Response("BadJwtToken", { status:403 }); }
  if (h["Content-Encoding"] !== "aes128gcm" || !(+h.TTL > 0)) return new Response("bad headers", { status:400 });
  // like Apple: an optional header it doesn't like is a 400 with a reason
  if (h.Topic != null) return new Response(JSON.stringify({ reason:"BadWebPushTopic" }), { status:400 });
  if (!p || p.gone) return new Response("", { status:410 });
  if (applesAnswer) return new Response(JSON.stringify({ reason:applesAnswer === 429 ? "TooManyRequests" : "BadSomething" }), { status:applesAnswer });
  const msg = decrypt(p, Buffer.from(init.body));
  p.got.push(msg); pushes.push({ phone:p.name, msg });
  return new Response("", { status:201 });
};

async function call(method, path, body, e = env, ip = "203.0.113.9") {
  const res = await worker.fetch(new Request("https://web-ai.example.workers.dev" + path, { method, headers:{ Origin:APP, "content-type":"application/json", "CF-Connecting-IP":ip }, body:body ? JSON.stringify(body) : undefined }), e, { waitUntil(){} });
  let j = null; try { j = await res.json(); } catch (x) {}
  return { res, j };
}
const subscribe = (p, extra = {}, ip) => call("POST", "/push/subscribe", { sub:p.sub(), key:serverKey, updates:true, news:true, daily:false, ...extra }, env, ip);
const cron = async at => { const waits = []; await worker.scheduled({ scheduledTime:+new Date(at) }, env, { waitUntil:x => waits.push(x) }); await Promise.all(waits); };
const add = p => { phones.set(p.endpoint, p); return p; };

// ---- the key
let r = await call("GET", "/push/key");
serverKey = r.j && r.j.key;
ok(r.res.status === 200 && Buffer.from(serverKey, "base64url").length === 65, "GET /push/key gives a P-256 public key");
ok(r.res.headers.get("Access-Control-Allow-Origin") === APP, "the iPhone app may ask");
ok((await call("GET", "/push/key")).j.key === serverKey, "the same key every time");
ok((await call("GET", "/")).j.features.includes("push"), "GET / lists notifications");

// ---- signing up
const amy = add(phone("amy"));
r = await subscribe(amy);
ok(r.j && r.j.ok, "a phone signs up");
const rec = JSON.parse(kv.get([...kv.keys()].find(k => k.startsWith("ps:"))));
ok(rec.e === amy.endpoint && rec.u === 1 && rec.n === 1 && rec.d === -1, "its record: " + JSON.stringify({ u:rec.u, n:rec.n, d:rec.d }));
ok([...meta.keys()].some(k => k.startsWith("ps:") && meta.get(k).e === amy.endpoint), "kept with metadata, so a send needs no extra reads");
r = await call("POST", "/push/subscribe", { sub:{ ...amy.sub(), endpoint:"https://evil.example/collect" }, key:serverKey });
ok(r.res.status === 400, "only real push services (no sending to any address)");
r = await call("POST", "/push/subscribe", { sub:{ ...amy.sub(), endpoint:"http://web.push.apple.com/x" }, key:serverKey });
ok(r.res.status === 400, "https only");
r = await call("POST", "/push/subscribe", { sub:{ ...amy.sub(), endpoint:"https://web.push.apple.com:8443/x" }, key:serverKey });
ok(r.res.status === 400, "no other ports");
r = await call("POST", "/push/subscribe", { sub:{ endpoint:amy.endpoint, keys:{ p256dh:"abc", auth:"def" } }, key:serverKey });
ok(r.res.status === 400, "bad keys refused");
r = await call("POST", "/push/subscribe", { sub:amy.sub(), key:"AAAA" });
ok(r.res.status === 409 && r.j.error === "key" && r.j.key === serverKey, "signed up with another key: told the current one");

// nothing changed: no write
let w = writes; await subscribe(amy);
ok(writes === w, "checking in with the same choices writes nothing");

// daily reminder at 18:00 UTC, then 07:00, then off
await subscribe(amy, { daily:true, utcHour:18 });
ok([...kv.keys()].some(k => k.startsWith("pd:18:")), "the 18:00 reminder list has it");
await subscribe(amy, { daily:true, utcHour:7 });
ok(![...kv.keys()].some(k => k.startsWith("pd:18:")) && [...kv.keys()].some(k => k.startsWith("pd:07:")), "moved to 07:00");
await subscribe(amy, { daily:false });
ok(![...kv.keys()].some(k => k.startsWith("pd:")), "reminder off: off every list");

// 100 new phones a day from one connection
{ let last = null; for (let i = 0; i < 101; i++) last = await call("POST", "/push/subscribe", { sub:phone("lim" + i).sub(), key:serverKey }, env, "192.0.2.77");
  ok(last.res.status === 429, "the 101st new phone from one connection in a day waits");
  for (const k of [...kv.keys()]) if (k.startsWith("ps:") && kv.get(k).includes("/lim")) { kv.delete(k); meta.delete(k); } }

// ---- a test notification
r = await call("POST", "/push/test", { endpoint:amy.endpoint });
ok(r.j && r.j.ok && amy.got.length === 1 && /Notifications are on/.test(amy.got[0].title) && amy.got[0].tag === "webs-test", "the test arrives, readable only with the phone's key: " + JSON.stringify(amy.got[0]));
ok(badSig === 0, "Apple accepted the signature");
for (let i = 0; i < 4; i++) await call("POST", "/push/test", { endpoint:amy.endpoint });
r = await call("POST", "/push/test", { endpoint:amy.endpoint });
ok(r.res.status === 429 && amy.got.length === 5, "5 tests a day");
r = await call("POST", "/push/test", { endpoint:"https://web.push.apple.com/nobody" });
ok(r.res.status === 404, "a phone that never signed up");

// ---- news from the owner, in batches, to many phones
const crowd = [];
for (let i = 0; i < 45; i++) { const p = add(phone("p" + i)); crowd.push(p); await subscribe(p, { news:i % 5 !== 0, daily:i < 25, utcHour:9 }, "198.51.100." + (i % 3)); }
crowd[3].gone = true;          // turned notifications off in iPhone Settings
const wantNews = [amy, ...crowd].filter((p, i) => i === 0 || (i - 1) % 5 !== 0);
r = await call("POST", "/admin", { code:"friendcode99", op:"push", title:"Hi", text:"x" });
ok(r.res.status === 401, "news needs the owner's code");
r = await call("POST", "/admin", { code:"friendcode99", op:"push", title:"Hi", text:"x" }, { ...env, WEB_AI_CODES:"Friend=friendcode99" });
ok(r.res.status === 403, "no news when the owner's code is only 'the first code' (it could be handed out)");
r = await call("POST", "/admin", { code:"ownercode123", op:"push", title:"", text:"" });
ok(r.res.status === 400, "news needs a title and a message");
r = await call("POST", "/admin", { code:"ownercode123", op:"push", title:"Hi", text:"x", url:"javascript:alert(1)" });
ok(r.res.status === 400, "links must be https");
pushes = [];
let cursor = "", rounds = 0, sent = 0, gone = 0;
const t0 = process.cpuUsage();
do {
  r = await call("POST", "/admin", { code:"ownercode123", op:"push", title:"New games!", text:"Try Pong.", url:"https://example.com/news", cursor, started:1, sentSoFar:sent });
  cursor = r.j.cursor; sent += r.j.sent; gone += r.j.gone; rounds++;
} while (!r.j.done && rounds < 10);
const cpu = process.cpuUsage(t0);
ok(rounds === 3, "46 phones go out in batches of 20: " + rounds + " rounds");
ok(sent === wantNews.length - 1 && gone === 1, "news reaches everyone who wants it (" + sent + "), and the phone that left is noted (" + gone + ")");
ok(new Set(pushes.map(x => x.phone)).size === pushes.length, "nobody gets it twice");
ok(pushes.every(x => x.msg.title === "New games!" && x.msg.body === "Try Pong." && x.msg.url === "https://example.com/news" && /^news-/.test(x.msg.tag)), "the news, as written");
ok(!pushes.some(x => crowd.findIndex(p => p.name === x.phone) % 5 === 0), "nobody who turned news off");
ok(![...kv.values()].some(v => v.includes(crowd[3].endpoint)), "the phone that left is forgotten");
ok(JSON.parse(kv.get("push:news")).sent === sent, "the dashboard remembers the last news");
console.log("  (CPU for 46 messages here, encryption and signing: " + ((cpu.user + cpu.system) / 1000).toFixed(0) + " ms in Node)");

// the dashboard numbers
r = await call("POST", "/admin", { code:"ownercode123" });
ok(r.j.push && r.j.push.phones === 45 && r.j.push.daily === 24 && r.j.push.news === 36, "dashboard: " + JSON.stringify(r.j.push && { phones:r.j.push.phones, news:r.j.push.news, daily:r.j.push.daily }));
r = await worker.fetch(new Request("https://web-ai.example.workers.dev/admin"), env, { waitUntil(){} });
ok(/Notifications on iPhones/.test(await r.text()), "the dashboard page has the notifications part");

// ---- new versions, checked every 10 minutes
pushes = []; w = writes;
await cron("2026-10-04T10:00:00Z");
ok(JSON.parse(kv.get("push:state")).sentVer === "2.3.0" && !pushes.length, "the first look: 2.3.0 is old news, nothing sent");
for (const m of ["01", "02", "03"]) await cron("2026-10-04T10:" + m + ":00Z");
ok(writes === w + 1, "quiet minutes write nothing (" + (writes - w) + " writes)");
iphoneJson = { version:"2.4.0", notes:["Notifications: new versions, news and a daily word reminder", "x"] };
await cron("2026-10-04T10:10:00Z");
ok(!pushes.length, "a new version is noticed, but not announced straight away");
await cron("2026-10-04T10:20:00Z");
const upd = [amy, ...crowd].filter(p => !p.gone);
ok(pushes.length === 20, "the first batch of 20 goes out: " + pushes.length);
await cron("2026-10-04T10:21:00Z");
ok(pushes.length === 40, "the next 20 a minute later: " + pushes.length);
await cron("2026-10-04T10:22:00Z");
ok(pushes.length === upd.length && new Set(pushes.map(x => x.phone)).size === upd.length, "then the rest: " + pushes.length + " of " + upd.length);
ok(pushes.every(x => x.msg.title === "Webs 2.4 is here ✨" && /^Notifications: new versions/.test(x.msg.body) && x.msg.url === "./?go=update" && x.msg.tag === "webs-update"), "says what's new and opens the update: " + JSON.stringify(pushes[0].msg));
const st = JSON.parse(kv.get("push:state"));
ok(!st.jobs.length && st.last.updates.sent === upd.length, "done, and the dashboard knows: " + JSON.stringify(st.last.updates));
pushes = [];
await cron("2026-10-04T10:30:00Z"); await cron("2026-10-04T10:40:00Z");
ok(!pushes.length, "announced once only");

// ---- daily reminders: 24 phones at 09:00 UTC (20, then 4 a minute later)
pushes = [];
await cron("2026-10-04T08:59:00Z");
ok(!pushes.length, "not before the hour");
await cron("2026-10-04T09:00:00Z");
await cron("2026-10-04T09:01:00Z");
const daily = crowd.slice(0, 25).filter(p => !p.gone);
ok(pushes.length === daily.length && pushes.every(x => x.msg.tag === "webs-daily" && x.msg.url === "games.html#word"), "the 09:00 reminders: " + pushes.length + " of " + daily.length);
ok(!pushes.some(x => crowd.slice(25).some(p => p.name === x.phone)), "only the phones that asked");
pushes = []; w = writes;
await cron("2026-10-04T10:00:00Z");
ok(!pushes.length && writes === w, "nobody wanted 10:00: nothing sent, nothing written");

// ---- a batch that keeps failing (here: the storage) is tried 3 times, then skipped, not repeated forever
const realList = LIMITS.list;
LIMITS.list = async o => { if (o.limit === 20 && o.prefix.startsWith("pd:")) throw new Error("storage down"); return realList(o); };
const quiet = console.log; console.log = () => {};
for (const m of ["00", "01", "02", "03", "04"]) await worker.scheduled({ scheduledTime:+new Date("2026-10-05T09:" + m + ":00Z") }, env, { waitUntil:x => x.catch(() => {}) }), await new Promise(r => setTimeout(r, 5));
console.log = quiet; LIMITS.list = realList;
ok(!JSON.parse(kv.get("push:state")).jobs.length, "a send that fails 3 times is given up");

// ---- unsubscribing, and Apple refusing
r = await call("POST", "/push/unsubscribe", { endpoint:amy.endpoint });
ok(r.j.ok && ![...kv.values()].some(v => v.includes(amy.endpoint)), "unsubscribe forgets the phone");
applesAnswer = 429; pushes = [];
r = await call("POST", "/push/test", { endpoint:crowd[1].endpoint });
ok(r.res.status === 502 && kv.has("ps:" + [...kv.keys()].find(k => k.startsWith("ps:") && kv.get(k).includes(crowd[1].endpoint)).slice(3)), "Apple busy: says so, and keeps the phone");
ok(/\(429 TooManyRequests\)/.test(r.j.message), "the app is told Apple's reason: " + r.j.message);
applesAnswer = 400;
r = await call("POST", "/admin", { code:"ownercode123", op:"push", title:"Lunch", text:"Eat food" });
ok(r.j.ok && r.j.sent === 0 && r.j.failed > 0 && r.j.why === "400 BadSomething", "the dashboard is told Apple's reason: " + r.j.why);
r = await worker.fetch(new Request("https://web-ai.example.workers.dev/admin"), env, { waitUntil(){} });
ok(/Apple said: /.test(await r.text()), "and shows it");
applesAnswer = 0;
ok(badSig === 0, "every signature was good");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
