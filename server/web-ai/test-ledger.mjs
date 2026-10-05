// Tests the ledger (ledger.js) and scheduled / A/B announcements (live.js): node test-ledger.mjs
import worker from "./worker.js";
import { Ledger } from "./ledger.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name })), list_complete:true }) };
const store = new Map();
const ledger = new Ledger({ storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete:async k => store.delete(k),
  list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || "")).sort()) } }, {});
const LEDGER = { idFromName:n => n, get:() => ({ fetch:(u, init) => ledger.fetch(new Request("https://ledger/run", init)) }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, LEDGER };
let clock = Date.now(); const realNow = Date.now; Date.now = () => clock;
async function call(method, path, body, e = env) {
  const res = await worker.fetch(new Request("https://w.example" + path, { method, headers:{ "content-type":"application/json", Origin:"https://browser.example" }, ...(body ? { body:JSON.stringify(body) } : {}) }), e, { waitUntil(){} });
  const ct = res.headers.get("content-type") || "";
  return { res, j:/json/.test(ct) ? await res.json() : new Uint8Array(await res.arrayBuffer()) };
}
const trust = (await call("POST", "/admin", { code:"ownercode123", op:"hello" })).j.trust;
const admin = (op, o = {}) => call("POST", "/admin", { code:"ownercode123", trust, op, ...o });
const D1 = "device-one-000000000", D2 = "device-two-000000000", D3 = "device-three-0000000";

// ---- daily counts
let r = await call("POST", "/stats", { device:D1, platform:"windows", version:"3.10.0", uses:{ "x-shop":2, "pvseen":1, "bad name!":5 }, errors:[{ m:"TypeError: x is undefined", s:"https://browser.example/chrome.html:120", n:3 }, { m:"Boom", s:"https://secret.example/page?id=7" }],
  ab:[{ id:"ann1abcd", v:"A", seen:1, click:1 }] });
ok(r.j.ok, "a PC's day of counts");
r = await call("POST", "/stats", { device:D1, platform:"windows", version:"3.10.0", uses:{ "x-shop":9 } });
ok(r.j.again, "only once a day per device");
await call("POST", "/stats", { device:D2, platform:"iphone", version:"2.9.0", uses:{ "links":4 }, errors:[{ m:"TypeError: x is undefined", s:"https://browser.example/chrome.html:120" }], ab:[{ id:"ann1abcd", v:"B", seen:1, click:0 }] });
ok((await call("POST", "/stats", { platform:"iphone" })).res.status === 400, "no device id: refused");
r = await admin("ledger.read", { days:7 });
const td = r.j.days[r.j.days.length - 1];
ok(r.j.ok && r.j.days.length === 7 && td.devices === 2 && td.plat.windows === 1 && td.plat.iphone === 1 && td.ver["windows 3.10.0"] === 1, "the dashboard reads today's devices and versions");
ok(td.uses.windows["x-shop"] === 2 && td.uses.iphone.links === 4 && !td.uses.windows["bad name!"], "features used, by app (odd names dropped)");
const errs = Object.values(td.errors);
ok(errs.length === 3 && errs.some(e => e.m === "Boom" && e.s === "(a page)") && errs.some(e => e.s === "/chrome.html:120"), "errors kept without web pages' addresses");
ok(r.j.ab.ann1abcd.A.seen === 1 && r.j.ab.ann1abcd.A.click === 1 && r.j.ab.ann1abcd.B.seen === 1 && r.j.ab.ann1abcd.B.click === 0, "A/B: seen and clicked, per version");
ok((await call("POST", "/admin", { code:"wrong", op:"ledger.read" })).res.status >= 400, "the ledger needs the owner's code");

// ---- the gallery
const JPG = "data:image/jpeg;base64," + Buffer.from("fake jpeg bytes").toString("base64");
r = await call("POST", "/gallery/send", { device:D1, title:"Night city", by:"Sam", img:JPG, platform:"windows" });
ok(r.j.ok && r.j.id, "a wallpaper shared, waiting for the owner");
ok((await call("POST", "/gallery/send", { device:D1, title:"x", img:"data:image/png;base64,AAAA" })).res.status === 400, "only JPEGs");
ok((await call("POST", "/gallery/send", { device:D1, img:"data:image/jpeg;base64," + "A".repeat(900000) })).res.status === 400, "not too big");
await call("POST", "/gallery/send", { device:D1, title:"2", img:JPG }); await call("POST", "/gallery/send", { device:D1, title:"3", img:JPG });
ok((await call("POST", "/gallery/send", { device:D1, title:"4", img:JPG })).res.status === 429, "3 a day per device");
r = await call("GET", "/gallery");
ok(r.j.ok && r.j.items.length === 0, "nothing public before the owner approves");
r = await admin("gallery.list");
ok(r.j.pending.length === 3 && r.j.pending[0].title === "Night city", "the owner sees what's waiting");
const gid = r.j.pending[0].id;
await admin("gallery.ok", { id:gid, title:"Neon night" }); await admin("gallery.no", { id:r.j.pending[1].id });
r = await call("GET", "/gallery");
ok(r.j.items.length === 1 && r.j.items[0].title === "Neon night" && r.j.items[0].by === "Sam" && /\/gallery\/img\/[a-z0-9]{10}$/.test(r.j.items[0].url), "approved: in everyone's gallery");
r = await call("GET", "/gallery/img/" + gid);
ok(r.res.headers.get("content-type") === "image/jpeg" && Buffer.from(r.j).toString() === "fake jpeg bytes", "and its picture");
ok((await admin("gallery.list")).j.pending.length === 1, "turned down: gone");
await admin("gallery.del", { id:gid });
ok((await call("GET", "/gallery")).j.items.length === 0 && (await call("GET", "/gallery/img/" + gid)).res.status === 404, "taken out of the gallery");

// ---- invites
r = await call("POST", "/invite/new", { device:D1 });
const ic = r.j.code;
ok(r.j.ok && /^[a-z0-9]{8}$/.test(ic) && r.j.n === 0, "an invite code");
ok((await call("POST", "/invite/new", { device:D1 })).j.code === ic, "the same one each time");
ok((await call("POST", "/invite/claim", { device:D1, code:ic })).j.error === "self", "not your own");
r = await call("POST", "/invite/claim", { device:D3, code:ic });
ok(r.j.ok && !r.j.again, "a new device joins with it");
ok((await call("POST", "/invite/claim", { device:D3, code:ic })).j.again, "once per device");
ok((await call("POST", "/invite/claim", { device:D2, code:"zzzzzzzz" })).res.status === 400, "a wrong code");
ok((await call("POST", "/invite/new", { device:D1 })).j.n === 1, "the inviter sees one friend joined");
ok((await admin("ledger.read")).j.invites.joined === 1, "and the owner too");

// ---- without the ledger
ok((await call("POST", "/stats", { device:D1 }, { ...env, LEDGER:undefined })).res.status === 503, "an older setup says to run setup.cmd");
ok((await call("GET", "/")).j.features.includes("ledger"), "GET / lists the ledger");

// ---- scheduled announcements, and two versions
const H = 3600000;
await admin("live.set", { live:{ ann:{ text:"Hello everyone", textB:"Hi there, everyone!", linkB:"https://example.com/b" },
  sched:[{ text:"Sale starts!", from:clock + 2 * H, until:clock + 30 * H }, { text:"Later news", from:clock + 48 * H }, { text:"no time" }, { text:"Old", from:clock - 5 * H, until:clock - H }] } });
r = await call("GET", "/live");
ok(r.j.ann.text === "Hello everyone" && r.j.ann.textB === "Hi there, everyone!" && r.j.ann.linkB === "https://example.com/b", "the announcement, with its second version");
const g = (await admin("live.get")).j.live;
ok(g.sched.length === 2 && g.sched[0].text === "Sale starts!", "scheduled posts kept in order (no time, or already over: dropped)");
clock += 3 * H;
ok((await call("GET", "/live")).j.ann.text === "Sale starts!", "its time comes: it shows instead");
clock += 30 * H;
ok((await call("GET", "/live")).j.ann.text === "Hello everyone", "it ends: back to the main one");
clock += 20 * H;
ok((await call("GET", "/live")).j.ann.text === "Later news", "the next one");
await admin("live.set", { live:{ ann:{ text:"Hello everyone" }, sched:g.sched } });
ok(!(await call("GET", "/live")).j.ann.textB, "one version: no A/B test");

Date.now = realNow;
console.log("ledger: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
