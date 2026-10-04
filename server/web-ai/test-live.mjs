// Tests "live" (live.js): what the owner puts on everyone's start page, and the counts that come back: node test-live.mjs
import worker from "./worker.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map(), meta = new Map();
let writes = 0;
const LIMITS = {
  get:async k => kv.has(k) ? kv.get(k) : null,
  getWithMetadata:async (k, o) => ({ value:kv.has(k) ? kv.get(k) : null, metadata:meta.has(k) ? meta.get(k) : null }),
  put:async (k, v, o) => { writes++; kv.set(k, v); if (o && o.metadata) meta.set(k, JSON.parse(JSON.stringify(o.metadata))); else meta.delete(k); },
  delete:async k => { kv.delete(k); meta.delete(k); },
  list:async ({ prefix = "", limit = 1000 }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, ...(meta.has(name) ? { metadata:meta.get(name) } : {}) })), list_complete:true })
};
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS };
let clock = Date.parse("2026-10-14T12:00:00Z");      // a Wednesday
const realNow = Date.now; Date.now = () => clock;
globalThis.fetch = async url => {
  url = String(url);
  if (url.includes("updates/latest.json")) return new Response(JSON.stringify({ version:"3.7.0", previous:{ version:"3.6.0" } }), { status:200 });
  if (url.includes("updates/iphone.json")) return new Response(JSON.stringify({ version:"2.7.0" }), { status:200 });
  return new Response("{}", { status:200 });
};
async function call(method, path, body, country) {
  const req = new Request("https://web-ai.example.workers.dev" + path, { method, headers:{ "content-type":"application/json", Origin:"https://spiderkingfr-eng.github.io", "CF-Connecting-IP":"203.0.113.9" }, ...(body ? { body:JSON.stringify(body) } : {}) });
  if (country) Object.defineProperty(req, "cf", { value:{ country } });
  const res = await worker.fetch(req, env, { waitUntil(){} });
  const ct = res.headers.get("content-type") || "";
  let j = null; if (/json/.test(ct)) j = await res.json(); else j = new Uint8Array(await res.arrayBuffer());
  return { res, j };
}
let trust = (await call("POST", "/admin", { code:"ownercode123", op:"hello" })).j.trust;
const admin = (op, o = {}) => call("POST", "/admin", { code:"ownercode123", trust, op, ...o });
const set = live => admin("live.set", { live });
const day = n => new Date(clock + n * 86400000).toISOString().slice(0, 10);

// ---- nothing yet
let r = await call("GET", "/live");
ok(r.j.ok && r.j.rev === 0 && !r.j.ann && r.res.headers.get("Access-Control-Allow-Origin") === "https://spiderkingfr-eng.github.io", "an empty start page, readable by the iPhone app");

// ---- the owner sets things, each one checked
r = await set({ ann:{ text:"Maintenance tonight", link:"javascript:alert(1)", react:true } });
ok(r.j.live.ann.text === "Maintenance tonight" && r.j.live.ann.link === "" && /^[a-z0-9]{8}$/.test(r.j.live.ann.id), "an announcement (a javascript: link is dropped)");
const annId = r.j.live.ann.id;
r = await set({ ann:{ id:annId, text:"Maintenance tonight", react:true } });
ok(r.j.live.ann.id === annId, "saving it again keeps its id (reactions and dismissals stay)");
await set({ poll:{ q:"Next game?", opts:["Tetris", "Chess", "", ""] }, card:{ title:"TAKE YOUR TIME", text:"Update Friday" } });
await set({ countdown:{ label:"Christmas", date:"2026-12-25", emoji:"🎄" }, pick:{ url:"https://example.org/cool", title:"Cool site", note:"Try it" } });
await set({ words:[{ date:day(0), w:"heist" }, { date:day(1), w:"toolong" }, { date:day(5), w:"later" }], themes:[{ date:day(0), kind:"snow" }, { date:day(0), kind:"lava" }],
  quotes:[{ date:day(0), text:"Steal hearts.", by:"Joker" }], trivia:[{ date:day(0), q:"2+2?", opts:["3", "4"], a:1 }, { date:day(-9), q:"old", opts:["a", "b"], a:0 }],
  mystery:[{ date:day(0), kind:"joke", text:"Why did the cat…" }, { date:day(0), kind:"virus", text:"x" }] });
await set({ birthday:{ date:"10-14", since:2026 }, goal:{ label:"10,000 Snake games", game:"snake", target:100 }, hunt:{ code:"Phantom2026", hint:"Look in the news" },
  secrets:[{ word:"joker", fx:"confetti" }, { word:"x", fx:"nope" }], ach:[{ emoji:"🎃", name:"Spooky", from:clock - 3600000, until:clock + 86400000 }, { name:"Future", from:clock + 86400000 * 5 }],
  faq:[{ q:"How do I update?", a:"Menu → Check for updates." }] });
const stored = kv.get("live:cfg");
ok(!stored.includes("Phantom2026") && !stored.includes("joker"), "the hunt's code and secret words are kept only as fingerprints");
r = await call("GET", "/live");
const L = r.j;
ok(L.ann && L.poll.opts.length === 2 && L.card && L.countdown && L.pick && L.birthday && L.goal && L.faq.length === 1, "everything is on the start page");
ok(L.words.length === 1 && L.words[0].w === "HEIST", "words: 5 letters only, and only near today (not next week's)");
ok(L.themes.length === 1 && L.themes[0].kind === "snow" && L.mystery.length === 1, "unknown themes and box kinds are dropped");
ok(L.trivia.length === 1 && L.trivia[0].a === 1, "trivia from long ago isn't sent");
ok(L.ach.length === 1 && L.ach[0].name === "Spooky", "an achievement that hasn't started yet isn't sent");
ok(L.secrets.length === 1 && /^[0-9a-f]{16}$/.test(L.secrets[0].h) && !JSON.stringify(L).includes("joker"), "secret words go out as fingerprints");
ok(L.hunt && /^[0-9a-f]{16}$/.test(L.hunt.h) && L.hunt.hint === "Look in the news", "the hunt: the hint and a fingerprint");
clock += 2 * 86400000;
r = await call("GET", "/live");
ok(!r.j.words && !r.j.quotes && !r.j.trivia, "two days later, that day's things are gone");
clock -= 2 * 86400000;

// ---- the apps check in
const dev = n => "device-" + n + "-abcdefgh";
writes = 0;
r = await call("POST", "/live/ping", { device:dev(1), platform:"iphone", version:"2.7.0" }, "US");
ok(r.j.ok && writes === 1, "a check-in is written");
r = await call("POST", "/live/ping", { device:dev(1), platform:"iphone", version:"2.7.0" }, "US");
ok(writes === 1, "the same again within the hour: nothing written");
clock += 61 * 60000;
r = await call("POST", "/live/ping", { device:dev(1), platform:"iphone", version:"2.7.0" }, "US");
ok(writes === 2, "an hour later it's written again (that's how “in the last hour” is known)");
r = await call("POST", "/live/ping", { device:dev(1), platform:"iphone", version:"2.7.1" }, "US");
ok(writes === 3, "a new version is written at once");
const m1 = [...meta.entries()].find(([k]) => k.startsWith("dv:"))[1];
ok(m1.p === "i" && m1.v === "2.7.1" && m1.c === "US" && !JSON.stringify(m1).includes("device-1"), "kept: platform, version, country; the device's id only as a hash");
r = await call("POST", "/live/ping", { device:"short" });
ok(r.res.status === 400, "a device id is needed");
for (let i = 2; i <= 6; i++) await call("POST", "/live/ping", { device:dev(i), platform:i % 2 ? "windows" : "iphone", version:i % 2 ? "3.7.0" : "2.7.0" }, i < 5 ? "US" : "FR");

// ---- what people do
r = await call("POST", "/live/act", { device:dev(1), kind:"vote", id:L.poll.id, choice:1 });
ok(r.j.ok, "a vote");
r = await call("POST", "/live/act", { device:dev(1), kind:"vote", id:L.poll.id, choice:0 });
ok(r.j.already, "one vote per device");
await call("POST", "/live/act", { device:dev(2), kind:"vote", id:L.poll.id, choice:1 });
await call("POST", "/live/act", { device:dev(3), kind:"vote", id:L.poll.id, choice:0 });
r = await call("POST", "/live/act", { device:dev(4), kind:"vote", id:L.poll.id, choice:7 });
ok(r.res.status === 409, "a choice that isn't there");
r = await call("POST", "/live/act", { device:dev(1), kind:"trivia", id:day(0), choice:1 });
ok(r.j.right === true, "trivia: right");
r = await call("POST", "/live/act", { device:dev(2), kind:"trivia", id:day(0), choice:0 });
ok(r.j.right === false, "trivia: wrong");
r = await call("POST", "/live/act", { device:dev(1), kind:"react", id:annId, emoji:"🎉" });
await call("POST", "/live/act", { device:dev(2), kind:"react", id:annId, emoji:"🎉" });
await call("POST", "/live/act", { device:dev(3), kind:"react", id:annId, emoji:"👍" });
r = await call("POST", "/live/act", { device:dev(4), kind:"react", id:annId, emoji:"💩" });
ok(r.res.status === 409, "only the five reactions");
r = await call("POST", "/live/act", { device:dev(1), kind:"found", id:L.hunt.id, code:"wrong" });
ok(r.res.status === 400, "a wrong code isn't a find");
r = await call("POST", "/live/act", { device:dev(1), kind:"found", id:L.hunt.id, code:"  PHANTOM2026 " });
ok(r.j.ok && !r.j.already, "the right code (any case) is a find");
r = await call("POST", "/live/act", { device:dev(1), kind:"ach", id:L.ach[0].id });
ok(r.j.ok, "a limited-time achievement");
r = await call("POST", "/live/act", { device:dev(1), kind:"ach", id:"made-up" });
ok(r.res.status === 409, "not one that isn't on");
r = await call("POST", "/live/act", { device:dev(1), kind:"ach", id:"hunt-" + L.hunt.id });
ok(r.j.ok, "the hunt's achievement, after finding the code");
r = await call("POST", "/live/act", { device:dev(2), kind:"ach", id:"hunt-" + L.hunt.id });
ok(r.res.status === 409, "not without finding it");
// the leaderboard
r = await call("POST", "/live/act", { device:dev(1), kind:"score", game:"snake", score:120 });
ok(r.res.status === 400, "a score needs a nickname");
await call("POST", "/live/act", { device:dev(1), kind:"score", game:"snake", score:120, nick:"Joker" });
await call("POST", "/live/act", { device:dev(1), kind:"score", game:"snake", score:80, nick:"Joker" });
await call("POST", "/live/act", { device:dev(2), kind:"score", game:"snake", score:300, nick:"Skull<script>" });
await call("POST", "/live/act", { device:dev(3), kind:"score", game:"2048", score:5000, nick:"Panther" });
r = await call("POST", "/live/act", { device:dev(4), kind:"score", game:"snake", score:99999999, nick:"Cheat" });
ok(r.res.status === 400, "an impossible score");
// the community goal: counts come with the check-ins
for (const [i, n] of [[1, 30], [2, 25], [3, 20]]) await call("POST", "/live/ping", { device:dev(i), platform:"iphone", version:"2.7.1", goal:[L.goal.id, n] }, "US");

// ---- adding it up
r = await admin("live.agg");
const a = r.j.agg;
ok(a.devices === 6 && a.active1 >= 5, "devices, and how many were on in the last hour: " + a.devices + ", " + a.active1);
ok(a.countries.US === 4 && a.countries.FR === 2, "countries: " + JSON.stringify(a.countries));
ok(a.vers["iPhone 2.7.1"] === 3 && a.vers["iPhone 2.7.0"] === 2 && a.vers["Windows 3.7.0"] === 1, "versions: " + JSON.stringify(a.vers));
ok(a.poll.counts[0] === 1 && a.poll.counts[1] === 2, "the poll: " + JSON.stringify(a.poll.counts));
ok(a.trivia[day(0)].n === 2 && a.trivia[day(0)].right === 1, "trivia: half right");
ok(a.react.counts["🎉"] === 2 && a.react.counts["👍"] === 1, "reactions");
ok(a.hunt.n === 1 && a.ach[L.ach[0].id] === 1, "finds and achievements");
ok(a.goal.n === 75, "the goal: 75 games so far");
ok(a.board.snake[0].n === "Skullscript" && a.board.snake[0].s === 300 && a.board.snake[1].s === 120 && a.board["2048"][0].n === "Panther", "the leaderboard (best scores, nicknames cleaned)");
r = await call("GET", "/live");
ok(r.j.goal.n === 75 && r.j.board.snake.length === 2 && r.j.hunt.found === 1, "the apps see the progress and the leaderboard");
// hiding a nickname
const skull = a.nicks.find(x => x.n === "Skullscript").dev;
await admin("cfg.set", { patch:{ hideNick:[skull] } });
r = await admin("live.agg");
ok(r.j.agg.board.snake.length === 1 && r.j.agg.board.snake[0].n === "Joker", "a hidden nickname leaves the leaderboard");
// a new week starts a new leaderboard
clock += 7 * 86400000;
await call("POST", "/live/act", { device:dev(1), kind:"score", game:"snake", score:10, nick:"Joker" });
r = await admin("live.agg");
ok(r.j.agg.board.snake.length === 1 && r.j.agg.board.snake[0].s === 10, "every Monday the leaderboard starts again");
clock -= 7 * 86400000;
// the hourly job
writes = 0;
const cron = async iso => { const w = []; await worker.scheduled({ scheduledTime:Date.parse(iso) }, env, { waitUntil(p) { w.push(p); } }); await Promise.all(w); };
await cron("2026-10-14T13:30:00Z");
ok(JSON.parse(kv.get("live:agg")).at === clock, "it adds up by itself every hour");

// ---- pictures: the wallpaper of the week and stickers
const png = "data:image/png;base64," + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).toString("base64");
r = await admin("img.put", { kind:"wall", data:png });
ok(/^[a-z0-9]{10}$/.test(r.j.id), "a picture is stored");
const img = r.j.id;
r = await call("GET", "/live/img/" + img);
ok(r.res.status === 200 && r.res.headers.get("content-type") === "image/png" && r.j.length === 11 && /immutable/.test(r.res.headers.get("cache-control")), "and served");
r = await admin("img.put", { kind:"wall", data:"data:text/html;base64,PHNjcmlwdD4=" });
ok(r.res.status === 400, "only pictures");
r = await admin("img.put", { kind:"wall", data:"data:image/jpeg;base64," + Buffer.alloc(950000).toString("base64") });
ok(r.res.status === 400, "not too big");
await set({ wall:{ id:img, credit:"Me" }, stickers:[{ id:img, name:"Star" }, { id:"../../etc", name:"x" }] });
r = await call("GET", "/live");
ok(r.j.wall.url === "https://web-ai.example.workers.dev/live/img/" + img && r.j.stickers.length === 1, "the apps get their addresses");

// ---- maintenance shows on the start page; rollout settings
await admin("cfg.set", { patch:{ maint:{ on:true, text:"Back soon" } } });
r = await call("GET", "/live");
ok(r.j.maint && r.j.maint.text === "Back soon", "maintenance mode shows on the start page");
await admin("cfg.set", { patch:{ maint:{ on:false } } });
await set({ rollout:{ win:{ v:"3.7.0", pct:25 }, ios:{ v:"bad", pct:5 } }, rollback:{ win:"3.6.0" } });
r = await call("GET", "/live");
ok(r.j.rollout.win.pct === 25 && !r.j.rollout.ios && r.j.rollback.win === "3.6.0", "rollout and going back");
r = await admin("updates.info");
ok(r.j.win.version === "3.7.0" && r.j.win.previous === "3.6.0" && r.j.ios.version === "2.7.0", "what's published, for the Updates tab");
// removing things
await set({ poll:null, ann:null });
r = await call("GET", "/live");
ok(!r.j.poll && !r.j.ann && r.j.card, "removing one thing leaves the rest");
r = await call("POST", "/live/act", { device:dev(5), kind:"vote", id:L.poll.id, choice:0 });
ok(r.res.status === 409, "a vote on an ended poll");
// news sent to everyone also goes to the PCs, for 3 days, and survives other changes on the dashboard
await call("GET", "/push/key");
r = await admin("push", { title:"New games!", text:"Pong is here.", url:"https://example.org/pong", started:clock });
ok(r.j.done, "news sent (no iPhones yet)");
r = await call("GET", "/live");
ok(r.j.news && r.j.news.title === "New games!" && r.j.news.body === "Pong is here." && r.j.news.url === "https://example.org/pong" && /^[a-z0-9]{8}$/.test(r.j.news.id), "the PCs get the news: " + JSON.stringify(r.j.news));
const newsId = r.j.news.id;
await set({ countdown:{ label:"Christmas", date:"2026-12-25", emoji:"🎄" } });
r = await call("GET", "/live");
ok(r.j.news && r.j.news.id === newsId, "a change on the Start page keeps it");
clock += 3 * 86400000 + 1000;
r = await call("GET", "/live");
ok(!r.j.news, "gone after 3 days");

Date.now = realNow;
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
