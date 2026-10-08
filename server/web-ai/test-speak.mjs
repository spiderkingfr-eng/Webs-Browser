// Tests the assistant's voice (speak.js, POST /speak) and the jarvis job with a pretend ElevenLabs and Claude: node test-speak.mjs
import worker from "./worker.js";
import { ADAM } from "./speak.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, ELEVENLABS_KEY:"el-key", SPEAK_DAILY:"100" };
const asked = []; let elStatus = 200; const claude = [];
globalThis.fetch = async (u, init) => {
  u = String(u);
  if (u.startsWith("https://api.elevenlabs.io/")) { asked.push({ u, h:init.headers, b:JSON.parse(init.body) }); return elStatus === 200 ? new Response(new Uint8Array([73, 68, 51, 4]), { status:200, headers:{ "content-type":"audio/mpeg" } }) : new Response('{"detail":"quota_exceeded"}', { status:elStatus }); }
  if (u === "https://api.anthropic.com/v1/messages") { claude.push(JSON.parse(init.body)); return new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"On it."}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}\n\n', { status:200 }); }
  return new Response("{}", { status:200 });
};
const waits = [];
async function call(path, body, e = env) {
  const r = await worker.fetch(new Request("https://w.example" + path, { method:body ? "POST" : "GET", headers:{ Origin:"https://browser.example", "content-type":"application/json", "CF-Connecting-IP":"203.0.113.7" }, body:body ? JSON.stringify(body) : undefined }), e, { waitUntil(p) { waits.push(p); } });
  if (path !== "/chat") await Promise.all(waits);
  return r;
}
const D = "devicedevicedevice12";
let r = await call("/");
let j = await r.json();
ok(j.features.includes("assistant") && j.features.includes("voice"), "the server says it has the assistant and a voice");
r = await call("/speak", { device:D, text:"Good evening. All systems are online." });
ok(r.status === 200 && r.headers.get("content-type") === "audio/mpeg" && (await r.arrayBuffer()).byteLength === 4, "a sentence comes back as audio");
ok(asked[0].u.startsWith("https://api.elevenlabs.io/v1/text-to-speech/" + ADAM + "?") && asked[0].h["xi-api-key"] === "el-key" && asked[0].b.model_id === "eleven_flash_v2_5", "in Adam's voice, with the server's key");
ok(r.headers.get("x-voice-left") === String(100 - 37), "counted in characters");
r = await call("/speak", { device:D, text:"Hi", voice:"21m00Tcm4TlvDq8ikWAM" });
ok(asked[1].u.includes("/21m00Tcm4TlvDq8ikWAM?"), "another voice by its id");
r = await call("/speak", { device:D, text:"Hi", voice:"../../v1/user" });
ok(asked[2].u.includes("/" + ADAM + "?"), "a strange voice id: Adam");
r = await call("/speak", { device:D, text:"x".repeat(601) });
ok(r.status === 400, "too long at once");
r = await call("/speak", { device:D, text:"" });
ok(r.status === 400, "nothing to say");
r = await call("/speak", { device:D, text:"y".repeat(80) });
j = await r.json();
ok(r.status === 429 && j.error === "limit" && asked.length === 3, "the daily allowance is kept, without asking ElevenLabs");
r = await call("/speak", { device:"anotherdevice1234567", text:"Hello" });
ok(r.status === 200, "someone else still has theirs");
elStatus = 429;
r = await call("/speak", { device:"anotherdevice1234567", text:"Hello" });
j = await r.json();
ok(r.status === 502 && /allowance/.test(j.message), "the voice service out of credit: says so");
r = await call("/speak", { device:D, text:"Hello" }, { ...env, ELEVENLABS_KEY:"" });
j = await r.json();
ok(r.status === 503 && j.error === "novoice", "no key: the browser is told to use a Windows voice");
ok(!(await (await call("/", null, { ...env, ELEVENLABS_KEY:"" })).json()).features.includes("voice"), "and the server doesn't say it has a voice");
r = await call("/speak", { code:"wrong", text:"Hello" }, { ...env, OPEN:"false" });
ok(r.status === 401, "a wrong code");
// the jarvis job
r = await call("/chat", { device:D, task:"jarvis", messages:[{ role:"user", content:"<assistant>name: Jarvis</assistant>\nopen youtube" }] });
await r.text();
ok(r.status === 200 && /JARVIS/.test(claude[0].system) && /\[\[do: command\]\]/.test(claude[0].system) && claude[0].max_tokens <= 3000 && claude[0].output_config.effort === "medium", "the assistant's job: spoken, short, how to do things, and thinking a bit harder");
console.log(`speak: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
