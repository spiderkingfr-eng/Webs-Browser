// Tests the live rooms (rooms.js) with pretend sockets and storage: node test-rooms.mjs
import worker from "./worker.js";
import { Room, roomKey } from "./rooms.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
function ctxFake() {
  const store = new Map(), socks = [];
  return { store, socks, alarm:0,
    storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete:async k => store.delete(k), deleteAll:async () => store.clear(),
      list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || ""))), setAlarm:async t => { ctx.alarm = t; } },
    acceptWebSocket(ws) { socks.push(ws); }, getWebSockets() { return socks.filter(w => !w.closed); } };
}
let ctx = ctxFake();
const sock = () => { const w = { got:[], closed:false, att:null, send(s) { this.got.push(JSON.parse(s)); }, close(c) { this.closed = true; this.code = c; }, serializeAttachment(a) { this.att = a; }, deserializeAttachment() { return this.att; } }; return w; };
const last = (w, t) => [...w.got].reverse().find(m => m.t === t);

ok(roomKey("l." + "a".repeat(24)).kind === "link" && roomKey("g.AB23CD").kind === "game" && !roomKey("g.ab23cd") && !roomKey("g.ABC") && !roomKey("x") && !roomKey("l.short"), "room names");

let room = new Room(ctx, {});
const pc = sock(), phone = sock();
await room.join(pc, { room:"l." + "a".repeat(24), kind:"link", dev:"d1", name:"My PC", app:"windows" });
ok(pc.got[0].t === "hi" && pc.got[0].peers.length === 1 && pc.got[0].peers[0].name === "My PC" && pc.got[0].kind === "link", "the first device joins");
await room.join(phone, { room:"l." + "a".repeat(24), kind:"link", dev:"d2", name:"iPhone", app:"iphone" });
ok(phone.got[0].peers.length === 2 && last(pc, "peers").peers.length === 2, "the second one, and the first hears of it");
await room.webSocketMessage(pc, JSON.stringify({ t:"set", k:"clip", v:{ text:"hello", ts:1 } }));
ok(last(phone, "set").k === "clip" && last(phone, "set").v.text === "hello" && !last(pc, "set"), "the clipboard goes to the others");
await room.webSocketMessage(phone, JSON.stringify({ t:"msg", d:{ k:"remote", cmd:"play" } }));
ok(last(pc, "msg").d.cmd === "play" && last(pc, "msg").from === phone.att.id && !last(phone, "msg"), "a remote's button press");
const tablet = sock();
await room.join(tablet, { room:"l." + "a".repeat(24), kind:"link", dev:"d3", name:"iPad", app:"iphone" });
ok(tablet.got[0].store.clip.text === "hello", "a device joining later gets what's kept");
await room.webSocketMessage(pc, JSON.stringify({ t:"msg", d:{ x:1 }, to:tablet.att.id }));
ok(last(tablet, "msg").d.x === 1 && !(phone.got.filter(m => m.t === "msg").some(m => m.d.x === 1)), "a message to one device");
await room.webSocketMessage(pc, JSON.stringify({ t:"set", k:"clip", v:null }));
ok(!ctx.store.has("s:clip"), "a value taken away");
await room.webSocketMessage(pc, JSON.stringify({ t:"set", k:"big", v:"x".repeat(40000) }));
ok(last(pc, "error") && !ctx.store.has("s:big"), "too big to keep");
await room.webSocketMessage(pc, JSON.stringify({ t:"set", k:"bad key!", v:1 }));
ok(!ctx.store.has("s:bad key!"), "odd key names refused");
await room.webSocketMessage(pc, '{"t":"ping"}');
ok(last(pc, "pong"), "ping");
for (let i = 0; i < 45; i++) await room.webSocketMessage(phone, JSON.stringify({ t:"msg", d:{ i } }));
ok(phone.closed && phone.code === 1008, "too many messages: closed");
await room.webSocketClose(phone);
ok(last(pc, "peers").peers.length === 2, "the others hear someone left");
await room.webSocketMessage(pc, "x".repeat(70000));
ok(pc.closed && pc.code === 1009, "a huge message: closed");

// a game: forgotten later, 8 at most
ctx = ctxFake(); room = new Room(ctx, {});
const a = sock();
await room.join(a, { room:"g.AB23CD", kind:"game", name:"Sam" });
await room.webSocketMessage(a, JSON.stringify({ t:"set", k:"game", v:{ kind:"chess", mv:[[52, 36]] } }));
ok(ctx.alarm > Date.now() + 86400000, "a game is kept two days after its last move");
for (let i = 0; i < 7; i++) ok(await room.join(sock(), { room:"g.AB23CD", kind:"game" }), "player " + (i + 2));
ok(!(await room.join(sock(), { room:"g.AB23CD", kind:"game" })), "the ninth is turned away");
await room.alarm();
ok(!ctx.store.size, "and then forgotten");
ctx = ctxFake(); room = new Room(ctx, {});
await room.join(sock(), { room:"l." + "b".repeat(24), kind:"link" });
await room.alarm();
ok(ctx.store.size === 1, "linked devices' rooms are kept");

// the worker's door
const kv = new Map([["lk:" + "c".repeat(24), "1"]]);
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS:{ get:async k => kv.get(k) ?? null, put:async () => {}, delete:async () => {}, list:async () => ({ keys:[] }) } };
let asked = null;
const ROOMS = { idFromName:n => "id:" + n, get:id => ({ fetch:async r => { asked = id; return new Response("ok", { status:200 }); } }) };
const call = async (q, e, up = true) => { const r = await worker.fetch(new Request("https://w.example/room?" + q, { headers:up ? { Upgrade:"websocket", Origin:"https://browser.example" } : {} }), e, { waitUntil(){} }); return { status:r.status, text:await r.text() }; };
ok((await call("k=g.AB23CD", env)).status === 503, "without the Durable Object: says to set it up");
ok((await call("k=g.AB23CD", { ...env, ROOMS })).status === 200 && asked === "id:g.AB23CD", "a game room is opened");
ok((await call("k=l." + "c".repeat(24), { ...env, ROOMS })).status === 200 && asked === "id:l." + "c".repeat(24), "a linked devices' room");
ok((await call("k=l." + "d".repeat(24), { ...env, ROOMS })).status === 404, "a link that doesn't exist");
ok((await call("k=nope", { ...env, ROOMS })).status === 400, "not a room");
ok((await call("k=g.AB23CD", { ...env, ROOMS }, false)).status === 426, "needs a WebSocket");
const h = await (await worker.fetch(new Request("https://w.example/"), { ...env, ROOMS }, { waitUntil(){} })).json();
ok(h.features.includes("rooms"), "GET / lists rooms");

console.log("rooms: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
