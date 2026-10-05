// Tests the privacy endpoints (privacy.js) with a pretend registry: node test-privacy.mjs
import worker from "./worker.js";
import { rdapInfo } from "./privacy.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS:{ get:async () => null, put:async () => {}, delete:async () => {}, list:async () => ({ keys:[], list_complete:true }) } };
const RDAP = {
  "example.com":{ status:200, j:{ events:[{ eventAction:"registration", eventDate:"1995-08-14T04:00:00Z" }, { eventAction:"expiration", eventDate:"2027-08-13T04:00:00Z" }],
    entities:[{ roles:["registrar"], vcardArray:["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "RESERVED-Internet Assigned Numbers Authority"]]] }] } },
  "cheap-nike-outlet.shop":{ status:200, j:{ events:[{ eventAction:"registration", eventDate:new Date(Date.now() - 12 * 86400000).toISOString() }] } }
};
let asked = [];
globalThis.fetch = async (url, init) => {
  asked.push(String(url));
  const d = String(url).replace("https://rdap.org/domain/", "");
  if (d === "slow.com") return new Response("busy", { status:503 });
  const r = RDAP[d];
  return r ? new Response(JSON.stringify(r.j), { status:r.status, headers:{ "content-type":"application/rdap+json" } }) : new Response("{}", { status:404 });
};
async function call(path, headers, cf) {
  const req = new Request("https://web-ai.example.workers.dev" + path, { headers:{ Origin:"https://spiderkingfr-eng.github.io", ...(headers || {}) } });
  if (cf) Object.defineProperty(req, "cf", { value:cf });
  const res = await worker.fetch(req, env, { waitUntil(){} });
  return { res, j:await res.json() };
}

let r = await call("/whoami", { "CF-Connecting-IP":"203.0.113.9" }, { country:"FR", city:"Lyon", region:"Auvergne-Rhône-Alpes", timezone:"Europe/Paris", asOrganization:"Orange", asn:3215 });
ok(r.j.ok && r.j.ip === "203.0.113.9" && r.j.country === "France" && r.j.city === "Lyon" && r.j.isp === "Orange" && r.j.tz === "Europe/Paris", "whoami tells the address and place");
ok(r.res.headers.get("Access-Control-Allow-Origin") === "https://spiderkingfr-eng.github.io", "whoami answers the apps");
r = await call("/whoami");
ok(r.j.ok && r.j.ip === "" && r.j.country === "", "whoami without Cloudflare's details");

asked = [];
r = await call("/domain?d=www.Example.com");
ok(r.j.ok && r.j.d === "example.com" && r.j.created === "1995-08-14" && r.j.expires === "2027-08-13" && /Assigned Numbers/.test(r.j.registrar), "domain age from the registry");
ok(asked.length === 1 && asked[0] === "https://rdap.org/domain/example.com", "asks rdap.org once");
asked = [];
r = await call("/domain?d=shop.example.com");
ok(r.j.ok && r.j.d === "example.com" && r.j.created === "1995-08-14", "a subdomain finds its registered name");
ok(asked.join() === "https://rdap.org/domain/shop.example.com,https://rdap.org/domain/example.com", "tries the name, then without its first part");
r = await call("/domain?d=cheap-nike-outlet.shop");
ok(r.j.ok && r.j.created && (Date.now() - Date.parse(r.j.created)) < 14 * 86400000, "a new shop's date");
r = await call("/domain?d=nothing-here.com");
ok(r.j.ok && r.j.none === true, "a name nobody registered");
r = await call("/domain?d=slow.com");
ok(r.res.status === 502 && r.j.error === "busy", "the registry not answering");
for (const bad of ["", "localhost", "a b.com", "http://x.com/", "-x.com", "x".repeat(300) + ".com", "1.2.3.4"]) {
  r = await call("/domain?d=" + encodeURIComponent(bad));
  ok(r.res.status === 400 && r.j.error === "bad", "rejects " + JSON.stringify(bad.slice(0, 20)));
}
ok(rdapInfo(null) === null && rdapInfo({}).created === "" && rdapInfo({ events:[{ eventAction:"registration", eventDate:"nope" }] }).created === "", "odd registry answers");
r = await call("/");
ok(r.j.features.includes("privacy"), "GET / lists privacy");

console.log("privacy: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
