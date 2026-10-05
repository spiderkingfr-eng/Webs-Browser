// Happening near you (Windows 3.11, iPhone 2.10; ../js/near.js, ../server/web-ai/near.js), end to end: the real server code runs here in
// Node behind https://w.test/, with pretend Ticketmaster, weather, USGS, news and geocoding services.
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn).catch(() => false)) return true; await wait(80); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
(async () => {
  const worker = (await import(pathToFileURL(path.join(APP, "server", "web-ai", "worker.js")).href)).default;
  const kv = new Map();
  const LIMITS = { get:async k => kv.has(k) ? kv.get(k) : null, getWithMetadata:async k => ({ value:kv.get(k) ?? null, metadata:null }), put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); },
    list:async ({ prefix = "" }) => ({ keys:[...kv.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })), list_complete:true }) };
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", WEB_AI_CODES:"Me=ownercode123", LIMITS, TICKETMASTER_KEY:"tmkey" };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const outside = [];
  globalThis.fetch = async u => {
    u = String(u); outside.push(u);
    const J = o => new Response(JSON.stringify(o), { status:200, headers:{ "content-type":"application/json" } });
    if (u.startsWith("https://app.ticketmaster.com/")) { const paris = /latlong=48\.9,2\.4/.test(u);
      return J({ _embedded:{ events:paris ? [{ name:"PSG vs Marseille", url:"https://www.ticketmaster.fr/psg", dates:{ start:{ localDate:tomorrow, localTime:"21:00:00" } }, classifications:[{ segment:{ name:"Sports" } }], _embedded:{ venues:[{ name:"Parc des Princes" }] } }] :
        [{ name:"Big Summer Festival", url:"https://www.ticketmaster.com/fest", dates:{ start:{ localDate:tomorrow, localTime:"18:00:00" } }, classifications:[{ segment:{ name:"Music" } }], _embedded:{ venues:[{ name:"City Park", location:{ latitude:"34.08", longitude:"-118.25" } }] } },
         { name:"Lakers vs Celtics", url:"https://www.ticketmaster.com/lakers", dates:{ start:{ localDate:tomorrow, localTime:"19:30:00" } }, classifications:[{ segment:{ name:"Sports" } }], _embedded:{ venues:[{ name:"Crypto.com Arena" }] } }] } }); }
    if (u.startsWith("https://api.weather.gov/")) return J({ features:[{ properties:{ event:"Heat Advisory", headline:"Heat Advisory until 8 PM", severity:"Severe" } }] });
    if (u.startsWith("https://api.open-meteo.com/")) return J({ daily:{ time:["a", "b"], weather_code:[1, 1], temperature_2m_max:[30, 30], temperature_2m_min:[15, 15], precipitation_sum:[0, 0], snowfall_sum:[0, 0], wind_gusts_10m_max:[20, 20] } });
    if (u.startsWith("https://earthquake.usgs.gov/")) return J({ features:[] });
    if (u.startsWith("https://news.google.com/")) return new Response("<rss><channel><item><title>New metro line opens - City Times</title><link>https://news.google.com/m1</link><source>City Times</source></item></channel></rss>", { status:200 });
    if (u.startsWith("https://geocoding-api.open-meteo.com/")) return J({ results:[{ name:"Paris", admin1:"Île-de-France", country:"France", country_code:"FR", latitude:48.857, longitude:2.352 }] });
    return J({});
  };
  async function serve(r) {
    const q = r.request(), u = q.url();
    const req = new Request(u, { method:q.method(), headers:Object.assign({}, q.headers(), { origin:"https://browser.example" }), body:q.method() === "POST" ? q.postData() : undefined });
    Object.defineProperty(req, "cf", { value:{ latitude:"34.05", longitude:"-118.24", city:"Los Angeles", country:"US" } });
    const res = await worker.fetch(req, env, { waitUntil(){} });
    const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); h["access-control-allow-origin"] = "*";
    r.fulfill({ status:res.status, headers:h, body:Buffer.from(await res.arrayBuffer()) });
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await setup(ctx);
  await ctx.route("https://w.test/**", serve);
  await ctx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await ctx.addInitScript(() => { try { if (/browser\.example|app\.example/.test(location.hostname) && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });

  /* ---------------------------------------------------------------- the owner posts something local */
  const d = await ctx.newPage(); watch(d, errors, "dashboard");
  await d.goto("https://w.test/admin"); await wait(400);
  await d.evaluate(() => { document.querySelector('input[type="password"]').value = "ownercode123"; document.getElementById("go").click(); });
  await until(d, () => !!document.querySelector('#tabs [data-tab="live"]'));
  await d.evaluate(() => document.querySelector('#tabs [data-tab="live"]').click());
  await until(d, () => [...document.querySelectorAll("#pane-live summary")].some(s => /Happening near you/.test(s.textContent)));
  await d.evaluate(() => { const f = [...document.querySelectorAll("#pane-live details.fold")].find(x => /Happening near you/.test(x.querySelector("summary").textContent)); f.open = true;
    const ins = f.querySelectorAll("input"); ins[0].value = "Webs meetup in LA"; ins[3].value = "Los Angeles"; });
  // the place: the dashboard asks the server (the pretend geocoder always says Paris, so this post is for Paris)
  await d.evaluate(() => [...document.querySelectorAll("#pane-live button")].find(b => b.textContent === "Find").click());
  check(await until(d, () => [...document.querySelectorAll("#pane-live button")].some(b => /Paris, Île-de-France, France/.test(b.textContent))), "the dashboard finds the place");
  await d.evaluate(() => { [...document.querySelectorAll("#pane-live button")].find(b => /Paris, Île-de-France/.test(b.textContent)).click(); });
  await d.evaluate(() => { const f = [...document.querySelectorAll("#pane-live details.fold")].find(x => /Happening near you/.test(x.querySelector("summary").textContent)); f.querySelectorAll("input")[0].value = "Webs meetup in Paris";
    [...f.querySelectorAll("button")].find(b => b.textContent === "Post it").click(); });
  check(await until(d, () => /📌 Webs meetup in Paris · Paris · 30 km/.test(document.getElementById("pane-live").textContent)), "a local post for people around Paris");
  await d.screenshot({ path:SHOTS + "near-dash.png", fullPage:true });

  /* ---------------------------------------------------------------- Windows: the new tab page */
  const nt = await ctx.newPage(); watch(nt, errors, "newtab");
  await nt.goto("https://browser.example/newtab.html"); await wait(300);
  check(await until(nt, () => /Happening around Los Angeles/.test(document.getElementById("nearSec").textContent)), "the new tab page: happening around your town (from your internet address)");
  const top = await nt.evaluate(() => [...document.querySelectorAll("#nearSec .nr-row b")].map(b => b.textContent));
  check(top[0] === "Heat Advisory" && top.length === 3 && top.includes("Big Summer Festival"), "the three biggest things, a warning first: " + top.join(" | "));
  check(outside.some(u => /latlong=34\.1,-118\.2/.test(u)) && !outside.some(u => /34\.05/.test(u)), "the services only learn the area, rounded");
  await wait(1500); await nt.screenshot({ path:SHOTS + "near-newtab.png" });
  await nt.evaluate(() => document.querySelector("#nearSec .nr-more").click());
  check(await until(nt, () => document.querySelectorAll("#nearSec .nr-tabs button").length === 4 && /New metro line opens/.test(document.getElementById("nearSec").textContent)), "See all: everything, in tabs");
  await nt.evaluate(() => document.querySelector('#nearSec .nr-tabs [data-t="events"]').click());
  check(await nt.evaluate(() => [...document.querySelectorAll("#nearSec .nr-list .nr-row b")].map(b => b.textContent).join() === "Big Summer Festival,Lakers vs Celtics"), "the Events tab");
  // choose another city
  await nt.fill("#nearSec .nr-in", "Paris"); await nt.evaluate(() => document.querySelector("#nearSec .nr-go").click());
  await until(nt, () => !!document.querySelector("#nearSec .nr-hit"));
  await nt.evaluate(() => document.querySelector("#nearSec .nr-hit").click());
  check(await until(nt, () => /PSG vs Marseille/.test(document.getElementById("nearSec").textContent) && /Webs meetup in Paris/.test(document.getElementById("nearSec").textContent)), "a city you choose: its events, and the owner's post for there");
  check(await nt.evaluate(() => JSON.parse(localStorage.getItem("wsb.near")).name === "Paris"), "kept for next time");
  await nt.screenshot({ path:SHOTS + "near-newtab-all.png" });
  await nt.evaluate(() => document.querySelector("#nearSec .nr-auto").click());
  check(await until(nt, () => /Los Angeles/.test(document.getElementById("nearSec").textContent) && !/PSG/.test(document.getElementById("nearSec").textContent)), "back to automatic");

  /* ---------------------------------------------------------------- Windows: the menu */
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(400);
  await c.evaluate(() => { __host("viewport", 1280, 900); const m = document.createElement("div"); X3.menuRows(m); window.__m = /Happening near you…/.test(m.textContent); X3.near.nearPanel(); });
  check(await c.evaluate(() => window.__m), "Menu → Happening near you…");
  check(await until(c, () => /Around Los Angeles/.test(document.querySelector("#nearp .xhead").textContent) && document.querySelectorAll("#nearp .nr-row").length >= 4), "the panel lists it all");
  await c.evaluate(() => { __sent.length = 0; [...document.querySelectorAll("#nearp .nr-row")].find(a => /Lakers/.test(a.textContent)).click(); });
  check(await c.evaluate(() => __sent.some(m => m.startsWith("new-tab\u0001https://www.ticketmaster.com/lakers"))), "an event opens in a new tab");

  /* ---------------------------------------------------------------- the iPhone app */
  const a = await ctx.newPage(); watch(a, errors, "app");
  await a.setViewportSize({ width:390, height:844 });
  await a.goto("https://app.example/index.html"); await wait(1200);
  check(await until(a, () => !$("#nearSec").classList.contains("hide") && /Happening around Los Angeles/.test($("#nearSec").textContent)), "iPhone: a card on the start page");
  await a.screenshot({ path:SHOTS + "near-app.png" });
  await a.evaluate(() => NearApp.sheet());
  check(await until(a, () => $("#sheet").dataset.kind === "near" && /Lakers vs Celtics/.test($("#sheetBody").textContent)), "Menu → Happening near you");
  await a.screenshot({ path:SHOTS + "near-app-sheet.png" });
  // no key for Ticketmaster: it says so
  env.TICKETMASTER_KEY = "";
  await a.evaluate(() => { localStorage.removeItem("wsb.nearCache"); NearApp.sheet(); });
  check(await until(a, () => /once the Web AI server has a Ticketmaster key/.test($("#sheetBody").textContent) && /Heat Advisory/.test($("#sheetBody").textContent)), "without a Ticketmaster key: alerts and news still, and a note");

  const real = errors.filter(e => !/An unknown error occurred when fetching the script|Failed to load resource/.test(e));
  console.log(real.length ? "errors:\n  " + real.join("\n  ") : "errors: none");
  check(!real.length, "no page errors: " + real.join(" | "));
  console.log("checks passed:", ok, "failed:", bad);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
