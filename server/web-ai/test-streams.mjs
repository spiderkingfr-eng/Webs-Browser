// Webs 3.14: streamers you follow (streams.js): node test-streams.mjs
import worker from "./worker.js";
import { _reset } from "./streams.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.get(k) ?? null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); }, list:async () => ({ keys:[], list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS, TWITCH_CLIENT_ID:"cid", TWITCH_CLIENT_SECRET:"secret" };
const asked = []; let tokens = 0, expire = false;
const soon = new Date(Date.now() + 864e5).toISOString(), far = new Date(Date.now() + 30 * 864e5).toISOString();
globalThis.fetch = async (u, init) => {
  u = String(u); asked.push({ u, h:init && init.headers });
  const J = o => new Response(JSON.stringify(o), { status:200 });
  if (u.startsWith("https://id.twitch.tv/oauth2/token")) { tokens++; return J({ access_token:"tok" + tokens, expires_in:3600 }); }
  if (u.startsWith("https://api.twitch.tv/helix/")) {
    if (init.headers.Authorization !== "Bearer tok" + tokens || init.headers["Client-Id"] !== "cid") return new Response("", { status:401 });
    if (expire) { expire = false; return new Response("", { status:401 }); }
    const p = new URL(u);
    if (p.pathname === "/helix/users") return J({ data:p.searchParams.getAll("login").map((l, i) => ({ id:"10" + i, login:l, display_name:l.toUpperCase(), profile_image_url:"https://img.test/" + l + ".png" })) });
    if (p.pathname === "/helix/streams") return J({ data:[{ user_login:"alpha", user_name:"Alpha", type:"live", title:"Speedruns  all day", game_name:"Celeste", viewer_count:1234, started_at:"2026-10-06T10:00:00Z", thumbnail_url:"https://img.test/live-{width}x{height}.jpg" }] });
    if (p.pathname === "/helix/schedule") {
      if (p.searchParams.get("broadcaster_id") === "101") return new Response("", { status:404 });
      return J({ data:{ segments:[{ start_time:soon, end_time:soon, title:"Chill stream", category:{ name:"Just Chatting" } }, { start_time:far, title:"Too far" }, { start_time:soon, title:"Cancelled", canceled_until:soon }] } });
    }
  }
  return new Response("{}", { status:404 });
};
const call = async (path, e) => { const res = await worker.fetch(new Request("https://w.example" + path, { headers:{ Origin:"https://browser.example" } }), e || env, { waitUntil(){} }); return { res, j:await res.json() }; };

let r = await call("/streams?u=Alpha,beta,bad name!,alpha");
ok(r.j.ok, "streams: ok");
ok(r.j.users.length === 2 && r.j.users[0].u === "alpha" && r.j.users[0].img === "https://img.test/alpha.png", "the streamers (bad names dropped, duplicates once)");
ok(r.j.live.length === 1 && r.j.live[0].u === "alpha" && r.j.live[0].title === "Speedruns all day" && r.j.live[0].viewers === 1234 && r.j.live[0].img === "https://img.test/live-320x180.jpg", "who is live now");
ok(r.j.next.length === 1 && r.j.next[0].u === "alpha" && r.j.next[0].title === "Chill stream" && r.j.next[0].game === "Just Chatting", "the schedule: the next week only, not cancelled ones, none for a streamer without one");
ok(asked.some(a => /helix\/streams\?first=20&user_login=alpha&user_login=beta$/.test(a.u)), "asks Twitch for just those names");
ok(tokens === 1, "one app token");
await call("/streams?u=alpha");
ok(tokens === 1, "the token is kept");
expire = true;
r = await call("/streams?u=gamma");
ok(r.j.ok && tokens === 2, "a token that ran out early: a new one, once");
ok((await call("/streams?u=")).res.status === 400, "no names: refused");
r = await call("/streams?u=alpha", Object.assign({}, env, { TWITCH_CLIENT_ID:"" }));
ok(!r.j.ok && r.j.error === "nokey" && /setup\.cmd/.test(r.j.message), "no Twitch key: says how to add one");
const root = await call("/");
ok(root.j.features.includes("streams"), "the server says it has streams");
_reset();
console.log(`streams: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
