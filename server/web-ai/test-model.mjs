// The model: the smartest by default (Claude Fable 5.1), a backup when the account can't use it,
// and a declined question handled properly: node test-model.mjs
import worker, { cost } from "./worker.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS };
const sse = events => events.map(e => "event: " + e.type + "\ndata: " + JSON.stringify(e) + "\n\n").join("");
const ANSWER = sse([{ type:"message_start", message:{ usage:{ input_tokens:1000000 } } }, { type:"content_block_delta", index:0, delta:{ type:"text_delta", text:"Hi" } }, { type:"message_delta", delta:{ stop_reason:"end_turn" }, usage:{ output_tokens:0 } }]);
let sent = [], replies = [];
globalThis.fetch = async (url, init) => {
  if (String(url) !== "https://api.anthropic.com/v1/messages") return new Response("{}", { status:200 });
  sent.push({ headers:init.headers, body:JSON.parse(init.body) });
  const r = replies.shift() || { status:200, text:ANSWER };
  return new Response(r.text, { status:r.status });
};
let waits = [];
async function chat(extra = {}, e = env) {
  const res = await worker.fetch(new Request("https://w.example/chat", { method:"POST", headers:{ "content-type":"application/json", Origin:"https://browser.example", "CF-Connecting-IP":"203.0.113." + (sent.length + 1) },
    body:JSON.stringify({ device:"device-" + Math.random().toString(36).slice(2, 14), messages:[{ role:"user", content:"hi" }], ...extra }) }), e, { waitUntil(p) { waits.push(p); } });
  const text = await res.text(); await Promise.all(waits); waits = [];
  return { s:res.status, lines:text.trim().split("\n").map(l => { try { return JSON.parse(l); } catch (x) { return { raw:l }; } }) };
}
const day = new Date().toISOString().slice(0, 10);

// the smartest model, thinking a little harder for Jarvis
let r = await chat({ task:"jarvis" });
let b = sent[0].body;
ok(r.s === 200 && b.model === "claude-fable-5-1", "Claude Fable 5.1 by default");
ok(b.output_config.effort === "medium" && b.max_tokens === 3000 && !("thinking" in b) && !("temperature" in b), "Jarvis: medium effort, room to think, no thinking or sampling settings");
ok(b.fallbacks === "default" && sent[0].headers["anthropic-beta"] === "server-side-fallback-2026-07-01", "declined questions go to Anthropic's recommended backup");
ok(Math.abs(cost(JSON.parse(kv.get("u:" + day)), "claude-fable-5-1") - 10) < 1e-9, "its cost is counted at Fable's price (a million tokens in = $10)");
ok(Math.abs(cost({ input_tokens:1e6, output_tokens:1e6 }, "claude-fable-5-1") - 60) < 1e-9 && Math.abs(cost({ input_tokens:1e6, output_tokens:1e6 }, "claude-opus-5-5") - 24) < 1e-9, "prices: Fable $10/$50, Opus $4/$20");

// the account can't use Fable: answered by Opus 5.5 instead of failing
kv.clear(); sent = [];
replies = [{ status:404, text:JSON.stringify({ type:"error", error:{ type:"not_found_error", message:"model: claude-fable-5-1" } }) }];
r = await chat();
ok(r.s === 200 && sent.length === 2 && sent[1].body.model === "claude-opus-5-5" && r.lines.some(l => l.d === "Hi"), "model not available: Opus 5.5 answers instead");
ok(JSON.parse(kv.get("u:" + day)).m["claude-opus-5-5"] === 1, "and the cost is counted at Opus's price");
kv.clear(); sent = [];
replies = [{ status:400, text:JSON.stringify({ type:"error", error:{ type:"invalid_request_error", message:"This model requires 30-day data retention." } }) }];
r = await chat();
ok(r.s === 200 && sent.length === 2 && sent[1].body.model === "claude-opus-5-5", "data-retention settings don't allow it: Opus 5.5 answers");
// a 400 for some other reason isn't retried
kv.clear(); sent = [];
replies = [{ status:400, text:JSON.stringify({ type:"error", error:{ type:"invalid_request_error", message:"messages: text content blocks must be non-empty" } }) }];
r = await chat();
ok(r.s === 502 && sent.length === 1, "any other problem isn't retried on another model");

// declined, and the backup declined too: the end line says so (the apps then say "can't help with that one")
kv.clear(); sent = [];
replies = [{ status:200, text:sse([{ type:"message_start", message:{ usage:{ input_tokens:10 } } }, { type:"content_block_delta", index:0, delta:{ type:"text_delta", text:"Partial" } }, { type:"message_delta", delta:{ stop_reason:"refusal" }, usage:{ output_tokens:1 } }]) }];
r = await chat();
const last = r.lines[r.lines.length - 1];
ok(last.end === 1 && last.stop === "refusal", "a refusal is passed on in the end line");

// the owner can still pick a cheaper model on the dashboard or with MODEL
kv.clear(); sent = [];
await chat({}, { ...env, MODEL:"claude-sonnet-5-5" });
ok(sent[0].body.model === "claude-sonnet-5-5" && sent[0].body.fallbacks === "default", "MODEL picks another one (Sonnet 5.5 takes the backup setting too)");

console.log(`model: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
