// Tests Happening near you (near.js) with pretend Ticketmaster, weather, USGS and news services: node test-near.mjs
import worker from "./worker.js";
import { km, postsNear } from "./near.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const kv = new Map();
const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
  list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete:true }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, TICKETMASTER_KEY:"tmkey" };
const asked = [];
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
globalThis.fetch = async (u, init) => {
  u = String(u); asked.push(u);
  const J = o => new Response(JSON.stringify(o), { status:200, headers:{ "content-type":"application/json" } });
  if (u.startsWith("https://app.ticketmaster.com/")) return J({ _embedded:{ events:[
    { name:"Taylor Swift | The Eras Tour", url:"https://www.ticketmaster.com/e1", dates:{ start:{ localDate:tomorrow, localTime:"19:30:00" } }, classifications:[{ segment:{ name:"Music" }, genre:{ name:"Pop" } }],
      images:[{ url:"https://img.example/small.jpg", width:100 }, { url:"https://img.example/640.jpg", width:640 }], _embedded:{ venues:[{ name:"SoFi Stadium", city:{ name:"Inglewood" }, location:{ latitude:"33.95", longitude:"-118.34" } }] } },
    { name:"Taylor Swift | The Eras Tour", url:"https://www.ticketmaster.com/e2", dates:{ start:{ localDate:tomorrow } } },
    { name:"Lakers vs Celtics", url:"javascript:alert(1)", dates:{ start:{ localDate:tomorrow } }, classifications:[{ segment:{ name:"Sports" }, genre:{ name:"Undefined" } }] }] } });
  if (u.startsWith("https://api.weather.gov/alerts")) return J({ features:[{ properties:{ event:"Red Flag Warning", headline:"Red Flag Warning until 8 PM", severity:"Severe", ends:"2026-10-06T20:00:00Z" } }, { properties:{ event:"Small thing", severity:"Minor" } }] });
  if (u.startsWith("https://api.open-meteo.com/")) return J({ daily:{ time:["d1", "d2"], weather_code:[95, 3], temperature_2m_max:[40, 25], temperature_2m_min:[20, 10], precipitation_sum:[5, 90], snowfall_sum:[0, 0], wind_gusts_10m_max:[30, 110] } });
  if (u.startsWith("https://earthquake.usgs.gov/")) return J({ features:[{ properties:{ mag:4.24, place:"10 km NE of Somewhere, CA", time:Date.now() - 3600000, url:"https://earthquake.usgs.gov/eq1" }, geometry:{ coordinates:[-118.0, 34.3, 5] } }] });
  if (u.startsWith("https://news.google.com/")) return new Response('<rss><channel><item><title>City opens new park - Daily News</title><link>https://news.google.com/a1</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><source url="x">Daily News</source></item>' +
    '<item><title><![CDATA[Big & bold festival]]></title><link>https://news.google.com/a2</link></item><item><title>Bad link</title><link>javascript:x</link></item></channel></rss>', { status:200 });
  if (u.startsWith("https://geocoding-api.open-meteo.com/")) return J({ results:[{ name:"Lyon", admin1:"Auvergne-Rhône-Alpes", country:"France", country_code:"FR", latitude:45.748, longitude:4.847 }] });
  return J({});
};
async function call(path, cf, e = env) {
  const req = new Request("https://w.example" + path, { headers:{ Origin:"https://browser.example" } });
  if (cf) Object.defineProperty(req, "cf", { value:cf });
  const r = await worker.fetch(req, e, { waitUntil(){} });
  return { s:r.status, j:await r.json() };
}

ok(Math.abs(km(34.05, -118.24, 33.95, -118.34) - 14.5) < 1, "distance in km");
let r = await call("/near", { latitude:"34.0522", longitude:"-118.2437", city:"Los Angeles", country:"US" });
ok(r.j.ok && r.j.place.name === "Los Angeles" && r.j.place.approx && r.j.place.lat === 34.1 && r.j.place.lon === -118.2 && r.j.place.country === "United States", "where: from the internet address, rounded to about 10 km");
ok(asked.some(u => /latlong=34\.1,-118\.2/.test(u) && /apikey=tmkey/.test(u)) && !asked.some(u => /34\.0522/.test(u)), "the services are only told the rounded place");
ok(r.j.events.length === 2 && r.j.events[0].name === "Taylor Swift | The Eras Tour" && r.j.events[0].time === "19:30" && r.j.events[0].venue === "SoFi Stadium" && r.j.events[0].img === "https://img.example/640.jpg" && r.j.events[0].km > 0 && r.j.events[0].genre === "Pop",
  "events: one per show, with time, venue, distance and a picture");
ok(r.j.events[1].url === "" && r.j.events[1].genre === "", "a bad link or an undefined genre dropped");
const at = r.j.alerts.map(a => a.title).join(",");
ok(/Red Flag Warning/.test(at) && /Thunderstorms/.test(at) && /Extreme heat/.test(at) && /Heavy rain/.test(at) && /Strong wind/.test(at) && !/Small thing/.test(at), "alerts: the weather service's warnings and the extreme forecast: " + at);
ok(r.j.alerts.find(a => a.title === "Heavy rain").text.startsWith("Tomorrow"), "with when");
ok(r.j.quakes[0].mag === 4.2 && r.j.quakes[0].km > 0, "earthquakes nearby");
ok(r.j.news.length === 2 && r.j.news[0].title === "City opens new park" && r.j.news[0].src === "Daily News" && r.j.news[1].title === "Big & bold festival", "local news, without bad links");
asked.length = 0;
r = await call("/near?lat=45.75&lon=4.85&name=Lyon&cc=FR");
ok(r.j.place.name === "Lyon" && !r.j.place.approx && !asked.some(u => /weather\.gov/.test(u)), "a chosen place; the US weather service only in the US");
ok(asked.some(u => /news\.google\.com.*%22Lyon%22.*gl=FR/.test(u)), "news for that place and country");
r = await call("/near");
ok(!r.j.ok && r.j.error === "where", "no idea where: asks for a city");
r = await call("/near?lat=45.75&lon=4.85&name=Lyon", null, { ...env, TICKETMASTER_KEY:"" });
ok(r.j.ok && r.j.events.length === 0 && r.j.missing.includes("events"), "no Ticketmaster key: no events, and it says so");
r = await call("/near/geo?q=Lyon");
ok(r.j.places[0].name === "Lyon, Auvergne-Rhône-Alpes, France" && r.j.places[0].lat === 45.7 && r.j.places[0].cc === "FR", "a place's name to where it is");
ok((await call("/near/geo?q=L")).j.places.length === 0, "too short to look up");
// the owner's local posts
const trust = (await (await worker.fetch(new Request("https://w.example/admin", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:"ownercode123", op:"hello" }) }), env, { waitUntil(){} })).json()).trust;
await worker.fetch(new Request("https://w.example/admin", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:"ownercode123", trust, op:"live.set", live:{ near:[
  { title:"Webs meetup in Lyon", text:"Come say hi", place:"Lyon", lat:45.76, lon:4.84, r:20, date:tomorrow }, { title:"Far away", lat:-33.9, lon:151.2, r:20 }, { title:"Over", lat:45.76, lon:4.84, until:Date.now() - 1000 }, { title:"no place" }] } }) }), env, { waitUntil(){} });
r = await call("/near?lat=45.75&lon=4.85&name=Lyon");
ok(r.j.posts.length === 1 && r.j.posts[0].title === "Webs meetup in Lyon" && r.j.posts[0].date === tomorrow, "your local post shows to people near it (not far away, not when it's over)");
ok(postsNear([{ title:"x", lat:0, lon:0, r:10 }], 0, 0.2).length === 0 && postsNear([{ title:"x", lat:0, lon:0, r:30 }], 0, 0.2).length === 1, "within its radius only");
ok((await call("/")).j.features.includes("near") && (await call("/")).j.features.includes("events"), "GET / lists near and events");

console.log("near: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
