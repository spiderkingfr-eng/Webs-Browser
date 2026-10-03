// Tests Help & support on the server: node test-support.mjs
import worker from "./worker.js";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const shared = require("../../js/support.settings.js");

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map(), meta = new Map();
const LIMITS = {
  get:async k => kv.has(k) ? kv.get(k) : null,
  put:async (k, v, o) => { kv.set(k, v); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); },
  delete:async k => { kv.delete(k); meta.delete(k); },
  list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, ...(meta.has(name) ? { metadata:meta.get(name) } : {}) })), list_complete:true })
};
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123,Friend=friendcode99", LIMITS };
let clock = Date.parse("2026-10-04T12:00:00Z");
const realNow = Date.now; Date.now = () => clock;
async function call(path, body, origin = "https://browser.example", ip = "203.0.113.5") {
  const res = await worker.fetch(new Request("https://web-ai.example.workers.dev" + path, { method:"POST", headers:{ Origin:origin, "content-type":"application/json", "CF-Connecting-IP":ip }, body:JSON.stringify(body) }), env, { waitUntil(){} });
  let j = null; try { j = await res.json(); } catch (x) {}
  return { res, j };
}
const admin = (op, o = {}) => call("/admin", { code:"ownercode123", op, ...o });

// the list is the same on the server and in the apps
const src = readFileSync(new URL("./worker.js", import.meta.url), "utf8");
const m = /const SUPPORT_SETTINGS = (\{.*?\});\n/.exec(src);
ok(m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(shared.SUPPORT_SETTINGS), "the server's list of settings is the same as the apps' (js/support.settings.js)");
ok(!/"(home|phost|puser|custom|dns|dldir|scripts|siteCss|snippets|histKeep|passcode)"/.test(JSON.stringify(shared.SUPPORT_SETTINGS)), "nothing typed in, nothing that deletes, nothing private is on the list");

// opening a chat
let r = await call("/support/open", { platform:"windows", text:"" });
ok(r.res.status === 400, "a chat needs a message");
r = await call("/support/open", { platform:"mac", text:"hi" });
ok(r.res.status === 400, "only the two apps");
r = await call("/support/open", { platform:"windows", version:"3.6.0", text:"Pages won't load since this morning", access:false,
  settings:{ theme:"dark", https:true, kill:true, on:true, home:"https://evil.example", phost:"10.0.0.1", search:"custom", history:["secret.example"], sleep:30 } });
ok(r.j && r.j.ok && /^[a-z0-9]{12}$/.test(r.j.id) && r.j.token.length === 32 && r.j.access === 0, "a chat opens, without settings access");
ok(r.res.headers.get("Access-Control-Allow-Origin") === "https://browser.example", "the PC browser may ask");
const T = { id:r.j.id, token:r.j.token };
const u0 = JSON.parse(kv.get("tku:" + T.id));
ok(JSON.stringify(u0.snap) === JSON.stringify({ theme:"dark", https:true, sleep:30, on:true, kill:true }), "only settings on the list are kept (no home page, VPN server, custom engine or history): " + JSON.stringify(u0.snap));
ok(!kv.get("tku:" + T.id).includes(T.token), "the token itself isn't stored, only a hash");

// the dashboard
r = await call("/admin", { code:"friendcode99", op:"tickets" });
ok(r.res.status === 401, "only the owner sees support chats");
r = await admin("tickets");
ok(r.j.items.length === 1 && r.j.items[0].platform === "windows" && /Pages won't load/.test(r.j.items[0].last), "the dashboard lists the chat");
r = await admin("ticket", { id:T.id });
ok(r.j.platform === "windows" && r.j.msgs.length === 1 && r.j.schema.length === 5 && r.j.settings.theme === "dark" && r.j.access === 0, "the chat, their settings and the list of what can be changed");
ok(!JSON.stringify(r.j).includes("evil.example") && !JSON.stringify(r.j).includes("tokenHash"), "nothing else about them");

// no access: nothing can be changed
r = await admin("set", { id:T.id, k:"theme", v:"light" });
ok(r.res.status === 403 && r.j.error === "access", "without their OK, settings can't be changed");

// replies both ways
r = await admin("reply", { id:T.id, text:"Hi! Can you let me adjust your settings? Turn on the switch." });
ok(r.j.ok, "the owner replies");
r = await call("/support/poll", { ...T, since:0 });
ok(r.j.msgs.length === 1 && /adjust your settings/.test(r.j.msgs[0].t) && r.j.changes.length === 0, "the app gets the reply, and no changes");
r = await call("/support/send", { ...T, text:"OK, done" });
ok(r.j.ok, "they write back");

// they turn on access: 30 minutes
r = await call("/support/access", { ...T, on:true });
ok(r.j.access === clock + 30 * 60000 && r.j.now === clock, "access for 30 minutes (with the server's time, for the countdown)");
r = await admin("set", { id:T.id, k:"home", v:"https://evil.example" });
ok(r.res.status === 400, "a setting that isn't on the list is refused");
r = await admin("set", { id:T.id, k:"search", v:"custom" });
ok(r.res.status === 400, "a value that isn't on the list is refused (no custom search engine)");
r = await admin("set", { id:T.id, k:"theme", v:"light" });
ok(r.j.ok, "theme → light");
r = await admin("set", { id:T.id, k:"sleep", v:"60" });
ok(r.j.ok, "sleeping tabs → 1 hour");
r = await admin("set", { id:T.id, k:"vpnOff", v:true });
ok(r.j.ok, "disconnect the VPN");
r = await call("/support/poll", { ...T, since:clock });
ok(r.j.changes.length === 3 && r.j.changes.find(c => c.k === "sleep").v === 60 && r.j.changes.find(c => c.k === "theme").v === "light", "the app gets the changes, with the right types");
const ids = r.j.changes.map(c => c.id);
r = await call("/support/poll", { ...T, since:clock, done:ids, settings:{ theme:"light", https:true, sleep:60, on:true, kill:true } });
ok(r.j.changes.length === 0, "done changes aren't sent again");
r = await admin("ticket", { id:T.id });
ok(r.j.settings.theme === "light" && r.j.changes.every(c => c.done), "the dashboard sees the new settings and the changes as done");
r = await admin("set", { id:T.id, k:"theme", v:"dark" }); r = await admin("set", { id:T.id, k:"theme", v:"auto" });
r = await call("/support/poll", { ...T, since:clock });
ok(r.j.changes.length === 1 && r.j.changes[0].v === "auto", "two asks for the same setting: the newest wins");

// the 30 minutes run out
clock += 31 * 60000;
r = await call("/support/poll", { ...T, since:0 });
ok(r.j.access === 0 && r.j.changes.length === 0, "after 30 minutes: no access, and waiting changes aren't applied");
r = await admin("set", { id:T.id, k:"https", v:false });
ok(r.res.status === 403, "and nothing more can be changed");
r = await call("/support/access", { ...T, on:true });
r = await call("/support/access", { ...T, on:false });
r = await admin("set", { id:T.id, k:"https", v:false });
ok(r.res.status === 403, "they can end access any time");

// a wrong token, a closed chat
r = await call("/support/poll", { id:T.id, token:"x".repeat(32), since:0 });
ok(r.res.status === 404, "another token can't read the chat");
r = await call("/support/access", { ...T, on:true });
await admin("closeTicket", { id:T.id });
r = await call("/support/poll", { ...T, since:clock });
ok(r.j.closed && !r.j.open && r.j.changes.length === 0, "the owner closes the chat: the app is told");
r = await admin("set", { id:T.id, k:"https", v:false });
ok(r.res.status === 409, "and nothing can be changed in a closed chat");
r = await call("/support/send", { ...T, text:"hello?" });
ok(r.res.status === 409, "a closed chat takes no more messages");

// an iPhone chat, ended by the person
r = await call("/support/open", { platform:"iphone", version:"2.6.0", text:"Where did my weather go?", access:true, settings:{ theme:"auto", "show:weather":false, textSize:"l", passcode:"1234" } }, "https://spiderkingfr-eng.github.io", "198.51.100.7");
const P = { id:r.j.id, token:r.j.token };
ok(r.res.headers.get("Access-Control-Allow-Origin") === "https://spiderkingfr-eng.github.io", "the iPhone app may ask");
ok(r.j.access > clock && JSON.stringify(JSON.parse(kv.get("tku:" + P.id)).snap) === JSON.stringify({ theme:"auto", textSize:"l", "show:weather":false }), "access from the start if they ask; no passcode kept");
r = await admin("set", { id:P.id, k:"show:weather", v:true });
ok(r.j.ok, "turn the weather back on");
r = await admin("set", { id:P.id, k:"kill", v:true });
ok(r.res.status === 400, "a PC setting can't be sent to an iPhone");
r = await call("/support/close", P, "https://spiderkingfr-eng.github.io");
r = await admin("set", { id:P.id, k:"theme", v:"dark" });
ok(r.res.status === 409, "they end the chat: nothing more can be changed");

// too many chats from one connection
for (let i = 0; i < 6; i++) r = await call("/support/open", { platform:"windows", text:"x" + i }, "https://browser.example", "192.0.2.9");
ok(r.res.status === 429, "5 new chats a day from one connection");

Date.now = realNow;
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
