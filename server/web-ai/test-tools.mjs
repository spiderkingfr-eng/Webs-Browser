// Web AI's new jobs (3.14): pictures with a question, and web search for fact checks and comparisons: node test-tools.mjs
import worker from "./worker.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS };
const sent = [];
globalThis.fetch = async (u, init) => {
  if (String(u) === "https://api.anthropic.com/v1/messages") { sent.push(JSON.parse(init.body)); return new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n\n', { status:200 }); }
  return new Response("{}", { status:200 });
};
async function chat(body) {
  const r = await worker.fetch(new Request("https://w.example/chat", { method:"POST", headers:{ "content-type":"application/json", Origin:"https://browser.example", "CF-Connecting-IP":"203.0.113.8" }, body:JSON.stringify({ device:"devicedevicedevice99", messages:[{ role:"user", content:"What is this?" }], ...body }) }), env, { waitUntil(){} });
  const text = await r.text(); return { s:r.status, text };
}
let r = await chat({ image:{ url:"https://img.example/cat.jpg" } });
let m = sent[sent.length - 1].messages.slice(-1)[0];
ok(r.s === 200 && Array.isArray(m.content) && m.content[0].type === "image" && m.content[0].source.type === "url" && m.content[0].source.url === "https://img.example/cat.jpg" && m.content[1].text === "What is this?", "a picture's address goes with the question");
const png = "data:image/png;base64," + Buffer.from("fakepng").toString("base64");
r = await chat({ image:{ data:png } });
m = sent[sent.length - 1].messages.slice(-1)[0];
ok(r.s === 200 && m.content[0].source.type === "base64" && m.content[0].source.media_type === "image/png", "or the picture itself");
const n = sent.length;
for (const bad of [{ url:"http://img.example/a.jpg" }, { url:"javascript:alert(1)" }, { data:"data:image/svg+xml;base64,AAAA" }, { data:"data:image/png;base64," + "A".repeat(2000004) }, "https://x.example/a.png", 5])
  ok((await chat({ image:bad })).s === 400, "refused: " + JSON.stringify(bad).slice(0, 40));
ok(sent.length === n, "without asking Claude");
// Jarvis on the PC sends a screenshot of the screen: it reaches Claude, Claude is told to use it, and GET / says the server can see
const jpg = "data:image/jpeg;base64," + Buffer.from("fakejpg").toString("base64");
r = await chat({ task:"jarvis", image:{ data:jpg }, messages:[{ role:"user", content:"What am I looking at?" }] });
m = sent[sent.length - 1].messages.slice(-1)[0];
ok(r.s === 200 && m.content[0].source.media_type === "image/jpeg" && m.content[1].text === "What am I looking at?", "a Jarvis screenshot goes with the question");
ok(/screenshot of their screen is attached, it IS what they're looking at/.test(sent[sent.length - 1].system) && /never say you can't see their screen/.test(sent[sent.length - 1].system), "and Jarvis is told to look at it");
const home = await (await worker.fetch(new Request("https://w.example/", { method:"GET" }), env, { waitUntil(){} })).json();
ok(home.features.includes("see"), "GET / says this server can look at pictures");
r = await chat({ task:"factcheck", search:true, messages:[{ role:"user", content:"The Great Wall is visible from space." }] });
let b = sent[sent.length - 1];
ok(b.tools && b.tools.some(t => t.type === "web_search_20250305" && t.max_uses === 3) && /verdict in bold/.test(b.system), "a fact check searches the web (3 searches at most)");
r = await chat({ task:"compare2", search:true, messages:[{ role:"user", content:"iPhone 17 vs Pixel 10" }] });
ok(sent[sent.length - 1].tools.some(t => t.type === "web_search_20250305") && /a column for each/.test(sent[sent.length - 1].system), "comparing by name too");
r = await chat({ task:"answer", search:true });
ok(!sent[sent.length - 1].tools, "other jobs can't search");
r = await chat({ task:"factcheck", search:true, web:true });
ok(sent[sent.length - 1].tools.length === 2, "with a page to fetch too");
console.log(`tools: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
