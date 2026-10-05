/* Happening near you (Windows 3.11, iPhone 2.10): big things around where someone is, for the apps' start pages.
   GET /near                       around where Cloudflare places this internet address (about the town)
   GET /near?lat=…&lon=…&name=…    around a place the person chose (their exact location, or a city they typed)
   -> { ok, place:{ name, country, lat, lon, approx }, events, alerts, quakes, news, posts, missing? }
     events  concerts, sports, festivals, shows: Ticketmaster's Discovery API (needs the TICKETMASTER_KEY secret,
             free at developer.ticketmaster.com), within 50 km, the next three weeks
     alerts  severe weather: the US weather service's warnings there, and anywhere, the next two days' forecast
             (Open-Meteo) when it's extreme: heavy rain or snow, storms, strong wind, great heat or cold
     quakes  earthquakes of 3.5 and up within 300 km in the last three days (USGS)
     news    local headlines (Google News for the place's name)
     posts   what the owner put up for that area on the dashboard (live:cfg near)
   GET /near/geo?q=…               a place's name to its position (Open-Meteo's geocoding), for the dashboard
   Nothing about anyone is kept. Each area's answer is cached an hour (positions rounded to about 10 km). */
import { json } from "./worker.js";
import { liveCfg } from "./live.js";

const UA = "WebsBrowser/3.11 (+https://github.com/spiderkingfr-eng/Webs-Browser)";
const r1 = n => Math.round(n * 10) / 10;
const clean = (s, n) => String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const ent = s => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
export const km = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

async function get(url, type, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 7000);
  try {
    const r = await fetch(url, { headers:{ "user-agent":UA, accept:type === "text" ? "application/rss+xml, text/xml, */*" : "application/geo+json, application/json" }, signal:ac.signal });
    if (!r.ok) return null;
    return type === "text" ? await r.text() : await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}

export async function events(key, lat, lon) {
  if (!key) return null;
  const now = new Date(), end = new Date(Date.now() + 21 * 86400000), iso = d => d.toISOString().slice(0, 19) + "Z";
  const j = await get("https://app.ticketmaster.com/discovery/v2/events.json?apikey=" + encodeURIComponent(key) + "&latlong=" + lat + "," + lon +
    "&radius=50&unit=km&size=40&sort=date,asc&startDateTime=" + iso(now) + "&endDateTime=" + iso(end));
  const list = j && j._embedded && Array.isArray(j._embedded.events) ? j._embedded.events : [];
  const seen = new Set(), out = [];
  for (const e of list) {
    const name = clean(e.name, 120); if (!name || seen.has(name)) continue;   // a show on many nights: once
    seen.add(name);
    const v = e._embedded && e._embedded.venues && e._embedded.venues[0] || {}, c = e.classifications && e.classifications[0] || {};
    const img = (Array.isArray(e.images) ? e.images : []).filter(i => i && /^https:/.test(i.url || "")).sort((a, b) => Math.abs((a.width || 0) - 640) - Math.abs((b.width || 0) - 640))[0];
    const vl = v.location ? [+v.location.latitude, +v.location.longitude] : null;
    out.push({ name, url:/^https:\/\//.test(e.url || "") ? e.url : "", date:(e.dates && e.dates.start && e.dates.start.localDate) || "", time:(e.dates && e.dates.start && e.dates.start.localTime || "").slice(0, 5),
      kind:clean(c.segment && c.segment.name, 30), genre:clean(c.genre && c.genre.name !== "Undefined" ? c.genre.name : "", 30), venue:clean(v.name, 80), city:clean(v.city && v.city.name, 60),
      km:vl && isFinite(vl[0]) ? Math.round(km(lat, lon, vl[0], vl[1])) : null, img:img ? img.url : "" });
    if (out.length >= 15) break;
  }
  return out;
}

const WMO_STORM = [95, 96, 99];
export async function alerts(lat, lon, cc) {
  const out = [];
  if (cc === "US") {
    const j = await get("https://api.weather.gov/alerts/active?point=" + lat + "," + lon);
    for (const f of (j && Array.isArray(j.features) ? j.features : []).slice(0, 6)) {
      const p = f.properties || {};
      if (!/^(Extreme|Severe|Moderate)$/.test(p.severity || "")) continue;
      out.push({ kind:"warning", title:clean(p.event, 80), text:clean(p.headline, 300), until:p.ends || p.expires || "", level:p.severity === "Moderate" ? 1 : 2, src:"US National Weather Service" });
    }
  }
  const w = await get("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max&timezone=auto&forecast_days=2");
  const d = w && w.daily;
  if (d && Array.isArray(d.time)) d.time.forEach((day, i) => {
    const when = i === 0 ? "Today" : "Tomorrow", add = (title, text, level) => { if (!out.some(a => a.title === title)) out.push({ kind:"weather", title, text:when + ": " + text, day, level, src:"Open-Meteo" }); };
    if (d.snowfall_sum[i] >= 10) add("Heavy snow", Math.round(d.snowfall_sum[i]) + " cm of snow expected", d.snowfall_sum[i] >= 25 ? 2 : 1);
    else if (d.precipitation_sum[i] >= 40) add("Heavy rain", Math.round(d.precipitation_sum[i]) + " mm of rain expected", d.precipitation_sum[i] >= 80 ? 2 : 1);
    if (d.wind_gusts_10m_max[i] >= 75) add("Strong wind", "gusts up to " + Math.round(d.wind_gusts_10m_max[i]) + " km/h", d.wind_gusts_10m_max[i] >= 100 ? 2 : 1);
    if (WMO_STORM.indexOf(d.weather_code[i]) >= 0) add("Thunderstorms", "thunderstorms likely" + (d.weather_code[i] > 95 ? ", with hail" : ""), 1);
    if (d.temperature_2m_max[i] >= 38) add("Extreme heat", "up to " + Math.round(d.temperature_2m_max[i]) + " °C", 2);
    if (d.temperature_2m_min[i] <= -20) add("Extreme cold", "down to " + Math.round(d.temperature_2m_min[i]) + " °C", 2);
  });
  return out.slice(0, 6);
}

export async function quakes(lat, lon) {
  const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 19);
  const j = await get("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=" + lat + "&longitude=" + lon + "&maxradiuskm=300&minmagnitude=3.5&orderby=time&limit=5&starttime=" + since);
  return (j && Array.isArray(j.features) ? j.features : []).map(f => { const p = f.properties || {}, g = f.geometry && f.geometry.coordinates || [];
    return { mag:Math.round((+p.mag || 0) * 10) / 10, place:clean(p.place, 120), time:+p.time || 0, url:/^https:\/\//.test(p.url || "") ? p.url : "", km:g.length > 1 ? Math.round(km(lat, lon, g[1], g[0])) : null }; }).filter(q => q.mag);
}

export async function news(name, cc) {
  if (!name) return [];
  const gl = /^[A-Z]{2}$/.test(cc || "") ? cc : "US";
  const x = await get("https://news.google.com/rss/search?q=" + encodeURIComponent('"' + name + '"') + "&hl=en-" + gl + "&gl=" + gl + "&ceid=" + gl + ":en", "text");
  const out = [];
  for (const m of String(x || "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], tag = t => { const r = new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">").exec(it); return r ? ent(r[1]).trim() : ""; };
    const link = tag("link"), title = clean(tag("title"), 200), src = clean(tag("source"), 60);
    if (!/^https:\/\//.test(link) || !title) continue;
    out.push({ title:src && title.endsWith(" - " + src) ? title.slice(0, -(src.length + 3)) : title, url:link, src, ts:Date.parse(tag("pubDate")) || 0 });
    if (out.length >= 8) break;
  }
  return out;
}

// the owner's local posts: within their radius, not over
export function postsNear(list, lat, lon) {
  const now = Date.now();
  return (Array.isArray(list) ? list : []).filter(p => p && (!p.until || p.until > now) && (!p.from || p.from <= now) && km(lat, lon, p.lat, p.lon) <= (p.r || 30))
    .map(p => ({ id:p.id, title:p.title, text:p.text, link:p.link, date:p.date || "", place:p.place || "" })).slice(0, 5);
}

const COUNTRY = { US:"United States", GB:"United Kingdom", CA:"Canada", AU:"Australia", DE:"Germany", FR:"France", ES:"Spain", IT:"Italy", NL:"Netherlands", IE:"Ireland", NZ:"New Zealand" };
export async function nearApi(path, req, env, cors, ctx) {
  const q = new URL(req.url).searchParams;
  if (path === "/near/geo") {
    const name = clean(q.get("q"), 80);
    if (name.length < 2) return json({ ok:true, places:[] }, 200, cors);
    const j = await get("https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=" + encodeURIComponent(name));
    return json({ ok:true, places:(j && Array.isArray(j.results) ? j.results : []).map(p => ({ name:[p.name, p.admin1, p.country].filter(Boolean).join(", "), short:p.name, cc:p.country_code || "", lat:r1(p.latitude), lon:r1(p.longitude) })) }, 200, cors);
  }
  const cf = req.cf || {};
  let lat = parseFloat(q.get("lat")), lon = parseFloat(q.get("lon")), name = clean(q.get("name"), 80), cc = String(q.get("cc") || "").toUpperCase().slice(0, 2), approx = false;
  if (!(isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) {
    lat = parseFloat(cf.latitude); lon = parseFloat(cf.longitude); name = clean(cf.city, 80); cc = cf.country || ""; approx = true;
    if (!(isFinite(lat) && isFinite(lon))) return json({ ok:false, error:"where", message:"Webs couldn't tell where you are. Choose your city." }, 200, cors);
  }
  lat = r1(lat); lon = r1(lon);          // about 10 km: nobody's street, and one answer for a whole area
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
  const key = new Request("https://web-ai.cache/near/" + lat + "/" + lon + "/" + encodeURIComponent(name.toLowerCase()) + "/" + new Date().toISOString().slice(0, 13));
  let out = null;
  if (cache) { const hit = await cache.match(key); if (hit) out = await hit.json(); }
  if (!out) {
    const tk = String(env.TICKETMASTER_KEY || "").trim();
    const [ev, al, qk, nw] = await Promise.all([events(tk, lat, lon), alerts(lat, lon, cc), quakes(lat, lon), news(name, cc)]);
    out = { events:ev || [], alerts:al, quakes:qk, news:nw, ...(ev === null ? { missing:["events"] } : {}) };
    if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers:{ "content-type":"application/json", "cache-control":"public, max-age=3600" } })));
  }
  const live = await liveCfg(env);
  return json({ ok:true, place:{ name:name || "your area", country:COUNTRY[cc] || cc, cc, lat, lon, approx }, ...out, posts:postsNear(live.near, lat, lon) }, 200, cors);
}
