// Webs 3.14's anime extras on the server: the filler guide (filler.js), conventions in Happening near you (near.js),
// and fan art in the wallpaper gallery (ledger.js): node test-anime.mjs
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
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, LEDGER, TICKETMASTER_KEY:"tm" };
const asked = [];
const PAGE = '<html><h1>Naruto Shippuden Filler List</h1><div class="manga_canon"><span class="Label">Manga Canon Episodes:</span><span class="Episodes"><a href="/x">1-32</a>, <a href="/x">34-53</a></span></div>' +
  '<div class="mixed_canon/filler"><span class="Label">Mixed:</span><span class="Episodes"><a>33</a>, <a>55</a></span></div><div class="filler"><span class="Label">Filler Episodes:</span><span class="Episodes"><a>57-71</a>, <a>90-112</a></span></div></html>';
globalThis.fetch = async (u, init) => {
  u = String(u); asked.push(u);
  if (u === "https://www.animefillerlist.com/shows/naruto-shippuden") return new Response(PAGE, { status:200 });
  if (u.startsWith("https://www.animefillerlist.com/")) return new Response("nope", { status:404 });
  if (u.startsWith("https://app.ticketmaster.com/")) {
    const kw = new URL(u).searchParams.get("keyword");
    const J = l => new Response(JSON.stringify({ _embedded:{ events:l } }), { status:200 });
    if (kw === "anime") return J([{ name:"Anime Expo 2026", url:"https://tm.example/ax", dates:{ start:{ localDate:"2026-11-20" } }, _embedded:{ venues:[{ name:"Convention Center", city:{ name:"Lyon" }, location:{ latitude:"46.2", longitude:"5.3" } }] } },
      { name:"Anime Night at the Symphony", url:"https://tm.example/sym", dates:{ start:{ localDate:"2026-10-30" } } }, { name:"Taylor Swift", dates:{ start:{ localDate:"2026-10-10" } } }]);
    if (kw === "comic con") return J([{ name:"Lyon Comic Con", url:"javascript:x", dates:{ start:{ localDate:"2026-12-01" } } }, { name:"Anime Expo 2026", dates:{ start:{ localDate:"2026-11-20" } } }]);
    if (kw === "cosplay") return J([]);
    return J([{ name:"A concert", dates:{ start:{ localDate:"2026-10-12" } } }]);
  }
  return new Response("{}", { status:200, headers:{ "content-type":"application/json" } });
};
async function call(method, path, body, cf) {
  const req = new Request("https://w.example" + path, { method, headers:{ "content-type":"application/json", Origin:"https://browser.example" }, ...(body ? { body:JSON.stringify(body) } : {}) });
  if (cf) Object.defineProperty(req, "cf", { value:cf });
  const res = await worker.fetch(req, env, { waitUntil(){} });
  return { res, j:await res.json() };
}
// the filler guide
let r = await call("GET", "/filler?s=Naruto%20Shippuden");
ok(r.j.ok && r.j.show === "Naruto Shippuden" && r.j.filler === "57-71, 90-112" && r.j.mixed === "33, 55" && r.j.canon === "1-32, 34-53" && r.j.url === "https://www.animefillerlist.com/shows/naruto-shippuden", "the filler guide: filler, mixed and canon episodes");
r = await call("GET", "/filler?s=made%20up%20show");
ok(!r.j.ok && r.j.error === "none" && /isn't on the filler list/.test(r.j.message), "a show that isn't listed: says so");
ok((await call("GET", "/filler?s=")).res.status === 400, "no show: refused");
ok(!asked.some(u => /shows\/\.\.|%2F/.test(u)), "only the filler list's show pages are read");
// conventions
r = await call("GET", "/near?lat=45.75&lon=4.85&name=Lyon&cc=FR");
ok(Array.isArray(r.j.cons) && r.j.cons.map(c => c.name).join("|") === "Anime Night at the Symphony|Anime Expo 2026|Lyon Comic Con", "conventions near you: anime, comic con and cosplay searches, merged, by date, no concerts");
ok(r.j.cons.find(c => c.name === "Lyon Comic Con").url === "" && r.j.cons.find(c => c.name === "Anime Expo 2026").km > 0, "with distances, and no bad links");
ok(asked.some(u => /keyword=anime&/.test(u) && /radius=300/.test(u)), "within 300 km, the next four months");
// fan art in the gallery
const D = "device-fanart-0000001", jpg = "data:image/jpeg;base64," + Buffer.from("jpeg!").toString("base64");
r = await call("POST", "/gallery/send", { device:D, title:"Gojo", by:"Sam", img:jpg, kind:"fanart", link:"https://art.example/sam" });
ok(r.j.ok, "fan art sent");
r = await call("POST", "/gallery/send", { device:D, title:"Sky", by:"Sam", img:jpg });
const trust = (await call("POST", "/admin", { code:"ownercode123", op:"hello" })).j.trust;
const admin = (op, o) => call("POST", "/admin", { code:"ownercode123", trust, op, ...o });
const l = (await admin("gallery.list", {})).j;
const fa = l.pending.find(x => x.title === "Gojo"), wp = l.pending.find(x => x.title === "Sky");
ok(fa.kind === "fanart" && fa.link === "https://art.example/sam" && !wp.kind, "the dashboard sees which is fan art, with the artist's link");
await admin("gallery.ok", { id:fa.id }); await admin("gallery.ok", { id:wp.id });
r = await call("GET", "/gallery");
const g = r.j.items;
ok(g.find(x => x.title === "Gojo").kind === "fanart" && g.find(x => x.title === "Gojo").link === "https://art.example/sam" && !g.find(x => x.title === "Sky").kind, "and so does everyone's gallery");
r = await call("POST", "/gallery/send", { device:"device-fanart-0000002", title:"x", by:"y", img:jpg, kind:"fanart", link:"javascript:alert(1)" });
const bad = (await admin("gallery.list", {})).j.pending.find(x => x.title === "x");
ok(bad.link === "", "a bad link is dropped");
console.log(`anime: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
