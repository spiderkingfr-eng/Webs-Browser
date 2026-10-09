// A Web AI code with no daily limit (the owner's own): node test-unlimited.mjs
import worker from "./worker.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", WEB_AI_CODES:"Me=ownercode123=unlimited,Sam=samcode12345=2,Ann=anncode12345=2", TOTAL_DAILY_LIMIT:"3", SPEAK_DAILY:"10", ELEVENLABS_KEY:"el-test", LIMITS };
globalThis.fetch = async u => {
  if (String(u) === "https://api.anthropic.com/v1/messages") return new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n\n', { status:200 });
  if (String(u).startsWith("https://api.elevenlabs.io/")) return new Response(new Uint8Array([1, 2, 3]), { status:200, headers:{ "content-type":"audio/mpeg" } });
  return new Response("{}", { status:200 });
};
let waits = [];
async function call(path, body) {
  const r = await worker.fetch(new Request("https://w.example" + path, { method:"POST", headers:{ "content-type":"application/json", Origin:"https://browser.example", "CF-Connecting-IP":"203.0.113.8" }, body:JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  const text = await r.text(); await Promise.all(waits); waits = [];
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  return { s:r.status, j, text };
}
const ask = code => call("/chat", { code, messages:[{ role:"user", content:"hi" }] });
const endOf = text => text.trim().split("\n").map(l => JSON.parse(l)).find(x => x.end);

let r = await call("/check", { code:"ownercode123" });
ok(r.j.ok && r.j.name === "Me" && r.j.unlimited === true && r.j.left === 999, "/check: the unlimited code says so (and shows 999 left)");
let all = true, e = null;
for (let i = 0; i < 6; i++) { r = await ask("ownercode123"); all = all && r.s === 200; e = endOf(r.text); }
ok(all, "six questions on a code with no limit, past the server's total of 3");
ok(e && e.unlimited === 1 && e.left === 999, "each answer says it's unlimited (and 999 left)");
r = await call("/check", { code:"ownercode123" });
ok(r.j.left === 999, "and it never goes down");
// everyone else still has their limits, and the owner's questions don't use up their share
ok((await ask("samcode12345")).s === 200 && (await ask("samcode12345")).s === 200, "Sam still gets his 2");
r = await ask("samcode12345");
ok(r.s === 429 && r.j.error === "limit", "and then his own limit stops him");
ok((await ask("anncode12345")).s === 200, "the owner's six didn't use up the total for others");
r = await ask("anncode12345");
ok(r.s === 429 && r.j.error === "busy", "but the total still holds for everyone else (Sam 2 + Ann 1 = 3)");
// the voice: an unlimited code isn't capped by SPEAK_DAILY
r = await call("/speak", { code:"ownercode123", text:"This is longer than ten characters." });
ok(r.s === 200, "the voice isn't capped for the unlimited code");
r = await call("/speak", { code:"samcode12345", text:"This is longer than ten characters." });
ok(r.s === 429, "but is for others");
// "=infinite" and "=no limit" work too; a plain number still means that many
const codes = (await import("./worker.js")).envCodes({ WEB_AI_CODES:"A=aaaaaaaa1=infinite,B=bbbbbbbb1=no limit,C=cccccccc1=5,D=dddddddd1" }, 25);
ok(codes[0].unlimited && codes[1].unlimited && !codes[2].unlimited && codes[2].limit === 5 && codes[3].limit === 25, "ways to write it in WEB_AI_CODES");

// picking the model (Jarvis's Model setting): only the unlimited code can, and only from the dashboard's list
let seen = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => { if (String(u) === "https://api.anthropic.com/v1/messages") seen.push(JSON.parse(init.body)); return realFetch(u, init); };
r = await call("/chat", { code:"ownercode123", model:"claude-haiku-5-5", messages:[{ role:"user", content:"hi" }] });
e = endOf(r.text);
ok(seen[0].model === "claude-haiku-5-5" && e.chose === 1, "the unlimited code picks Haiku 5.5 for this question (and is told it did)");
ok(seen[0].output_config && seen[0].output_config.effort === "low" && !("fallbacks" in seen[0]), "Haiku 5.5 takes an effort setting, but not the backup-model one");
r = await call("/chat", { code:"ownercode123", model:"gpt-9", messages:[{ role:"user", content:"hi" }] });
ok(seen[1].model === "claude-fable-5-1" && !endOf(r.text).chose, "a model that isn't on the list: the server's choice");
r = await call("/chat", { code:"ownercode123", effort:"high", messages:[{ role:"user", content:"hi" }] });
ok(seen[2].output_config.effort === "high", "the unlimited code can ask it to think harder (Jarvis: Thinking → Deep)");
r = await call("/chat", { code:"ownercode123", effort:"max", messages:[{ role:"user", content:"hi" }] });
ok(seen[3].output_config.effort === "low", "only low / medium / high");
// (other codes can't pick: test.mjs, "browser can't pick the model")
globalThis.fetch = realFetch;

// the owner's dashboard: a "No daily limit" switch on each code
let h = await call("/admin", { code:"ownercode123", op:"hello" });
const trust = h.j && h.j.trust;
const A = (op, o = {}) => call("/admin", { code:"ownercode123", trust, op, ...o });
r = await A("codes.get");
ok(r.j.ok && r.j.list[0].unlimited === true && r.j.list[0].limit === 0 && r.j.list[1].unlimited === false && r.j.list[1].limit === 2, "the dashboard shows which code has no limit");
r = await A("codes.set", { list:[{ name:"Me", code:"ownercode123", unlimited:true }, { name:"Sam", code:"samcode12345", limit:4 }, { name:"Kid", code:"kidcode12345", limit:1, unlimited:"yes" }] });
ok(r.j.ok, "saving codes with the switch");
r = await A("codes.get");
ok(r.j.list[0].unlimited === true && r.j.list[1].unlimited === false && r.j.list[2].unlimited === false, "kept (and only a real true counts)");
r = await call("/check", { code:"kidcode12345" });
ok(r.j.limit === 1 && !r.j.unlimited, "a normal code from the dashboard keeps its limit");
r = await call("/check", { code:"ownercode123" });
ok(r.j.unlimited === true, "and the owner's is still unlimited");

console.log(`unlimited: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
