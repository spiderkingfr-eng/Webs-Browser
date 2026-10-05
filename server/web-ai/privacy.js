/* Privacy helpers for the apps (Windows 3.10, iPhone 2.9). Nothing here is stored.
   GET /whoami          -> { ok, ip, country, region, city, tz, isp, asn }
                        what every website learns from your internet address alone ("What sites see about you")
   GET /domain?d=name   -> { ok, d, created, expires, registrar } or { ok, d, none:true }
                        when a website's name was registered, from the public registry (RDAP through rdap.org),
                        for the fake shop warning; Cloudflare's cache keeps each answer a day */
const NAME = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;
const COUNTRY = { US:"United States", GB:"United Kingdom", CA:"Canada", AU:"Australia", DE:"Germany", FR:"France", ES:"Spain", IT:"Italy", NL:"Netherlands", BE:"Belgium",
  CH:"Switzerland", AT:"Austria", IE:"Ireland", PT:"Portugal", SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", PL:"Poland", BR:"Brazil", MX:"Mexico", IN:"India",
  JP:"Japan", KR:"South Korea", CN:"China", NZ:"New Zealand", ZA:"South Africa", SG:"Singapore", PH:"Philippines", TR:"Türkiye", UA:"Ukraine", AR:"Argentina" };

export function rdapInfo(j) {
  if (!j || typeof j !== "object") return null;
  const ev = a => (Array.isArray(j.events) ? j.events : []).find(e => e && e.eventAction === a);
  const day = e => e && /^\d{4}-\d\d-\d\d/.test(String(e.eventDate || "")) ? String(e.eventDate).slice(0, 10) : "";
  let registrar = "";
  for (const e of Array.isArray(j.entities) ? j.entities : []) {
    if (!e || !Array.isArray(e.roles) || e.roles.indexOf("registrar") < 0) continue;
    const v = Array.isArray(e.vcardArray) && Array.isArray(e.vcardArray[1]) ? e.vcardArray[1] : [];
    const fn = v.find(x => Array.isArray(x) && x[0] === "fn"); registrar = fn ? String(fn[3] || "").slice(0, 80) : ""; break;
  }
  return { created:day(ev("registration")), expires:day(ev("expiration")), registrar };
}

async function lookup(d) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch("https://rdap.org/domain/" + d, { headers:{ accept:"application/rdap+json, application/json" }, redirect:"follow", signal:ac.signal });
    if (r.status === 404) return { none:true };
    if (!r.ok) return null;
    return rdapInfo(await r.json());
  } catch (e) { return null; } finally { clearTimeout(t); }
}

export async function privacyApi(path, req, env, cors, ctx) {
  const json = (o, s) => new Response(JSON.stringify(o), { status:s || 200, headers:{ ...cors, "content-type":"application/json; charset=utf-8", "cache-control":"no-store" } });
  if (path === "/whoami") {
    const cf = req.cf || {};
    return json({ ok:true, ip:req.headers.get("CF-Connecting-IP") || "", country:COUNTRY[cf.country] || cf.country || "", region:cf.region || "", city:cf.city || "",
      tz:cf.timezone || "", isp:cf.asOrganization || "", asn:cf.asn || 0 });
  }
  // /domain
  let d = String(new URL(req.url).searchParams.get("d") || "").toLowerCase().trim().replace(/^www\./, "").replace(/\.$/, "");
  if (!NAME.test(d)) return json({ ok:false, error:"bad", message:"That isn't a website name." }, 400);
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const key = new Request("https://web-ai.cache/domain/" + d);
  if (cache) { const hit = await cache.match(key); if (hit) { const j = await hit.json(); return json(j); } }
  // the name as given, then without its first part (shop.example.com -> example.com), at most twice
  let info = null, tries = 0;
  for (let n = d; n && tries < 3; n = n.split(".").slice(1).join("."), tries++) {
    if (n.split(".").length < 2) break;
    info = await lookup(n);
    if (info && !info.none) { d = n; break; }
  }
  if (!info) return json({ ok:false, error:"busy", message:"The registry didn't answer. Try again later." }, 502);
  const out = { ok:true, d, ...(info.none ? { none:true } : info) };
  if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers:{ "content-type":"application/json", "cache-control":"public, max-age=86400" } })));
  return json(out);
}
