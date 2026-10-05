// Sends every route and every owner op odd bodies and methods; nothing may crash or answer 500: node test-fuzz.mjs
import worker from "./worker.js";
import { Ledger } from "./ledger.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map(), meta = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.has(k) ? kv.get(k) : null, metadata:meta.get(k) ?? null }),
  put:async (k, v, o) => { kv.set(k, v); if (o && o.metadata) meta.set(k, o.metadata); }, delete:async k => { kv.delete(k); meta.delete(k); },
  list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata:meta.get(name) })), list_complete:true }) };
const store = new Map();
const ledger = new Ledger({ storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete:async k => store.delete(k),
  list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || "")).sort()) } }, {});
const LEDGER = { idFromName:n => n, get:() => ({ fetch:(u, init) => ledger.fetch(new Request("https://ledger/run", init)) }) };
const ROOMS = { idFromName:n => n, get:() => ({ fetch:async () => new Response("ok") }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, LEDGER, ROOMS, TICKETMASTER_KEY:"k" };
globalThis.fetch = async u => { u = String(u);
  if (u.startsWith("https://api.anthropic.com/v1/messages")) return new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n', { status:200 });
  return new Response(/\{|\[/.test(u) ? "nope" : "{}", { status:200, headers:{ "content-type":"application/json" } }); };
const waits = [];
const ctx = { waitUntil(p) { waits.push(Promise.resolve(p).catch(e => { crashes.push("waitUntil: " + (e && e.stack || e)); })); }, passThroughOnException() {} };
const crashes = [];
async function call(method, path, body, headers = {}) {
  const init = { method, headers:{ Origin:"https://browser.example", "CF-Connecting-IP":"203.0.113.9", ...headers } };
  if (body !== undefined && method !== "GET" && method !== "HEAD") { init.body = body; init.headers["content-type"] = "application/json"; }
  let res; try { res = await worker.fetch(new Request("https://w.example" + path, init), env, ctx); } catch (e) { crashes.push(method + " " + path + " " + JSON.stringify(body).slice(0, 60) + ": " + e.stack.split("\n").slice(0, 2).join(" ")); return null; }
  const text = await res.text().catch(() => "");
  if (res.status >= 500 && res.status !== 501 && res.status !== 503) crashes.push(method + " " + path + " " + JSON.stringify(body).slice(0, 60) + " -> " + res.status + " " + text.slice(0, 120));
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  return { res, j };
}
const PATHS = ["/", "/admin", "/admin/sw.js", "/changelog", "/check", "/domain", "/gallery", "/gallery/send", "/inbox", "/invite/claim", "/invite/new", "/invite/x", "/link/join", "/link/new", "/live", "/live/ping", "/live/replies",
  "/near", "/near/geo", "/push/key", "/push/test", "/push/unsubscribe", "/read", "/report", "/room", "/send", "/stats", "/support/access", "/support/close", "/support/open", "/support/poll", "/support/rate", "/support/send", "/whoami", "/chat", "/nope"];
const BODIES = [undefined, "", "garbage", "{}", "[]", "null", "1", '"s"', '{"a":1}', JSON.stringify({ code:"x", op:"stats", messages:"x", u:"javascript:x", q:{}, lat:"x", lon:[], k:5, text:null, device:{}, sub:"x", id:[], tz:{}, lang:5 }),
  JSON.stringify({ messages:[{ role:"user", content:[{ type:"image" }] }], model:5, system:[], code:["x"] }), JSON.stringify({ x:"y".repeat(200000) })];
const QUERIES = ["", "?u=", "?u=javascript:alert(1)", "?u=http://127.0.0.1/", "?lat=999&lon=-999", "?q=%E0%A4%A", "?k=g.%00", "?d=[]&x=%"];
for (const p of PATHS) for (const m of ["GET", "POST", "OPTIONS", "PUT", "DELETE"]) for (const b of (m === "POST" ? BODIES : [undefined])) for (const q of (m === "GET" ? QUERIES : [""])) await call(m, p + q, b);
// the owner ops, signed in
let r = await call("POST", "/admin", JSON.stringify({ code:"ownercode123", op:"hello" }));
const trust = r && r.j && r.j.trust;
ok(!!trust, "signed in");
const OPS = "2fa.approve 2fa.off 2fa.on 2fa.peek 2fa.poll 2fa.recover blockTicket cfg.get cfg.set closeTicket codes.get codes.set export gallery.del gallery.img gallery.list gallery.no gallery.ok gallery.public gallery.send health hello i img.del img.put invite.claim invite.new iphone ledger.read live.agg live.get live.set log owner.code push push.hist push.me push.schedule push.unschedule read read.count reply report.fix report.reply reports secret.hash set stats sub.add sub.del sub.test ticket tickets updates.info w".split(" ");
const ODD = [{}, { id:"x" }, { id:[] }, { id:{} }, { v:null }, { v:"x".repeat(5000) }, { cfg:"x" }, { cfg:[] }, { cfg:{ a:{ b:1 } } }, { text:5, title:[], when:"x", at:"never", list:"x", codes:"x", name:{}, img:"data:x", n:-1, page:"x", sub:{}, k:{} }];
for (const op of OPS) for (const o of ODD) await call("POST", "/admin", JSON.stringify({ code:"ownercode123", trust, op, ...o }));
// stats endpoints with odd devices
for (const b of [{ device:"x" }, { device:"d".repeat(40), counts:"x" }, { device:"d".repeat(40), counts:{ a:"x", b:-5, c:1e99 } }, { device:"d".repeat(40), counts:[1, 2] }]) await call("POST", "/stats", JSON.stringify(b));
await Promise.all(waits);
// the scheduled job with odd stored data
kv.set("cfg", "{bad"); kv.set("sched", "[1,"); kv.set("live", "null");
try { await worker.scheduled({ scheduledTime:Date.now() }, env, ctx); await Promise.all(waits); } catch (e) { crashes.push("scheduled: " + e.stack.split("\n").slice(0, 2).join(" ")); }
ok(!crashes.length, "no crashes:\n  " + [...new Set(crashes)].slice(0, 60).join("\n  "));
console.log(`fuzz: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
