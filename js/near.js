/* Webs Browser - Happening near you (Windows 3.11, iPhone 2.10), shared by both apps: big things around you, from
   the Web AI server (GET /near, server/web-ai/near.js): concerts, sports, festivals and shows, severe weather,
   earthquakes, local news, and local posts from the people who make Webs; 3.14 / 2.11: anime and comic conventions.
   Where you are: by default your town, as the server sees your internet address (no question asked); or your exact
   position (rounded to about 10 km before it leaves the device); or a city you choose (wsb.near).
   Near.card(el, opt)   a card for a start page: the three biggest things, and "See all"
   Near.full(el, opt)   everything, in tabs, with the place to change it
   opt.open(url)        how a link opens in that app */
(function () {
"use strict";
if (window.Near) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
function server() {
  for (const s of [(get("xai", {}) || {}).server, (get("xaiConfig", {}) || {}).server, (get("push", {}) || {}).server]) {
    const a = String(s || "").trim().replace(/\/+$/, ""); if (/^https:\/\/\S+$/.test(a)) return a;
  }
  return "";
}
const prefs = () => Object.assign({ mode:"auto" }, get("near", {}) || {});
const r1 = n => Math.round(n * 10) / 10;
function setPlace(p) { put("near", p); put("nearCache", null); }

let busy = null;
async function load(force) {
  const p = prefs(), k = p.mode === "auto" ? "auto" : p.lat + "," + p.lon, c = get("nearCache", null);
  if (!force && c && c.k === k && Date.now() - c.at < 30 * 60000) return c.d;
  if (busy) return busy;
  const s = server(); if (!s) throw new Error("Open Web AI once first: Happening near you comes from its server.");
  const q = p.mode === "auto" ? "" : "?lat=" + r1(p.lat) + "&lon=" + r1(p.lon) + "&name=" + encodeURIComponent(p.name || "") + "&cc=" + encodeURIComponent(p.cc || "");
  busy = (async () => {
    let r; try { r = await fetch(s + "/near" + q); } catch (e) { throw new Error("Can't reach the server. Check your internet connection."); }
    const j = await r.json().catch(() => null);
    if (!j || (j.ok && !(j.place && typeof j.place === "object"))) throw new Error("Happening near you isn't available right now. (The Web AI server may need updating.)");
    if (!j.ok) throw Object.assign(new Error(j.message || "Couldn't tell where you are."), { where:j.error === "where" });
    put("nearCache", { k, at:Date.now(), d:j });
    return j;
  })();
  try { return await busy; } finally { busy = null; }
}
async function geo(q) {
  const s = server(); if (!s) return [];
  try { const r = await fetch(s + "/near/geo?q=" + encodeURIComponent(q)); const j = await r.json(); return j.places || []; } catch (e) { return []; }
}
function exact() {
  return new Promise((ok, bad) => {
    if (!navigator.geolocation) { bad(new Error("This device can't tell its position.")); return; }
    navigator.geolocation.getCurrentPosition(p => ok({ lat:r1(p.coords.latitude), lon:r1(p.coords.longitude) }), e => bad(new Error(e && e.code === 1 ? "Location isn't allowed for Webs." : "Couldn't get your position.")), { timeout:10000, maximumAge:600000 });
  });
}

/* ---------------------------------------------------------------- what to show */
const DAY = 86400000;
function when(date, time) {
  if (!date) return "";
  const d = new Date(date + "T00:00:00"), t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const n = Math.round((d - t0) / DAY), day = n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 && n < 7 ? d.toLocaleDateString([], { weekday:"long" }) : d.toLocaleDateString([], { month:"short", day:"numeric" });
  return day + (time ? " · " + time : "");
}
const EMO = { Music:"🎤", Sports:"🏟️", "Arts & Theatre":"🎭", Film:"🎬", Miscellaneous:"🎪", Family:"🎈" };
function items(d) {
  const out = [];
  (d.alerts || []).forEach(a => out.push({ g:"alerts", rank:a.level === 2 ? 0 : 2, e:a.kind === "warning" ? "⚠️" : "🌦️", t:a.title, s:a.text, warn:a.level === 2 }));
  (d.quakes || []).forEach(q => out.push({ g:"alerts", rank:q.mag >= 4.5 ? 1 : 5, e:"🌋", t:"Earthquake, magnitude " + q.mag, s:q.place + (q.km != null ? " · " + q.km + " km away" : ""), u:q.url }));
  (d.posts || []).forEach(p => out.push({ g:"events", rank:1, e:"📌", t:p.title, s:[when(p.date), p.text].filter(Boolean).join(" · "), u:p.link, owner:true }));
  (d.events || []).forEach((e, i) => out.push({ g:"events", rank:3 + i / 100, e:EMO[e.kind] || "🎫", t:e.name, s:[when(e.date, e.time), e.venue, e.km != null ? e.km + " km" : ""].filter(Boolean).join(" · "), u:e.url, img:e.img }));
  // anime and comic conventions, cosplay meets (3.14 / 2.11, #066): up to 4 months ahead and 300 km away
  (d.cons || []).forEach((c, i) => out.push({ g:"cons", rank:4 + i / 100, e:"🎌", t:c.name, s:[when(c.date), c.venue, c.city, c.km != null ? c.km + " km" : ""].filter(Boolean).join(" · "), u:c.url, img:c.img }));
  (d.news || []).forEach((n, i) => out.push({ g:"news", rank:6 + i / 100, e:"📰", t:n.title, s:n.src, u:n.url }));
  return out.sort((a, b) => a.rank - b.rank);
}
const row = (x, big) => '<a class="nr-row' + (x.warn ? " warn" : "") + (x.owner ? " own" : "") + '"' + (x.u ? ' href="' + esc(x.u) + '" data-u="' + esc(x.u) + '"' : "") + ">" +
  (big && x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy">' : '<span class="nr-e">' + x.e + "</span>") + '<span class="nr-t"><b>' + esc(x.t) + "</b>" + (x.s ? "<em>" + esc(x.s) + "</em>" : "") + "</span></a>";
function wire(el, opt) {
  el.querySelectorAll("[data-u]").forEach(a => { a.onclick = e => { if (opt && opt.open) { e.preventDefault(); opt.open(a.dataset.u); } }; });
}
const placeName = d => d && d.place ? (d.place.approx ? "around " : "") + d.place.name : "you";

async function card(el, opt) {
  opt = opt || {};
  el.innerHTML = '<div class="nr-card"><div class="nr-h"><b>📍 Happening near you</b></div><div class="nr-b"><p class="nr-dim">Looking…</p></div></div>';
  let d;
  try { d = await load(); } catch (e) {
    el.querySelector(".nr-b").innerHTML = '<p class="nr-dim"></p>' + (e.where ? '<button type="button" class="nr-btn nr-place">Choose your city</button>' : "");
    el.querySelector(".nr-dim").textContent = e.message; const b = el.querySelector(".nr-place"); if (b && opt.more) b.onclick = () => opt.more();
    return null;
  }
  const l = items(d), top = l.slice(0, 3);
  el.querySelector(".nr-h").innerHTML = "<b>📍 Happening " + (d.place.approx ? "around " : "in ") + esc(d.place.name) + "</b>" + (l.length > 3 ? '<button type="button" class="nr-more">See all ' + l.length + " ›</button>" : '<button type="button" class="nr-more">More ›</button>');
  el.querySelector(".nr-b").innerHTML = top.length ? top.map(x => row(x)).join("") : '<p class="nr-dim">Nothing big nearby right now.</p>';
  el.querySelector(".nr-more").onclick = () => opt.more && opt.more();
  wire(el, opt);
  return d;
}
async function full(el, opt) {
  opt = opt || {};
  el.innerHTML = '<div class="nr-full"><div class="nr-tabs"></div><div class="nr-list"><p class="nr-dim">Looking…</p></div><div class="nr-where"></div></div>';
  let tab = opt.tab || "all", d = null;
  const paintWhere = () => {
    const p = prefs(), w = el.querySelector(".nr-where");
    w.innerHTML = '<div class="nr-k">Where</div><p class="nr-dim">' + (p.mode === "auto" ? "Your town, from your internet address" + (d ? " (" + esc(d.place.name) + ")" : "") : p.mode === "exact" ? "Your position, to about 10 km" : esc(p.name)) + "</p>" +
      '<div class="nr-find"><input class="nr-in" placeholder="Choose a city" enterkeyhint="search"><button type="button" class="nr-btn nr-go">Find</button></div><div class="nr-hits"></div>' +
      '<div class="nr-acts"><button type="button" class="nr-btn nr-exact">📍 Use my exact location</button>' + (p.mode !== "auto" ? '<button type="button" class="nr-btn nr-auto">Back to my town (automatic)</button>' : "") + "</div>";
    const go = async () => {
      const hits = await geo(w.querySelector(".nr-in").value), h = w.querySelector(".nr-hits");
      h.innerHTML = hits.length ? hits.map((x, i) => '<button type="button" class="nr-hit" data-i="' + i + '">' + esc(x.name) + "</button>").join("") : '<p class="nr-dim">No place with that name.</p>';
      h.querySelectorAll("[data-i]").forEach(b => { b.onclick = () => { const x = hits[+b.dataset.i]; setPlace({ mode:"city", lat:x.lat, lon:x.lon, name:x.short, cc:x.cc }); full(el, opt); if (opt.changed) opt.changed(); }; });
    };
    w.querySelector(".nr-go").onclick = go; w.querySelector(".nr-in").onkeydown = e => { if (e.key === "Enter") go(); };
    w.querySelector(".nr-exact").onclick = async () => { try { const x = await exact(); setPlace({ mode:"exact", lat:x.lat, lon:x.lon, name:"", cc:"" }); full(el, opt); if (opt.changed) opt.changed(); } catch (e) { w.querySelector(".nr-hits").innerHTML = '<p class="nr-dim">' + esc(e.message) + "</p>"; } };
    const au = w.querySelector(".nr-auto"); if (au) au.onclick = () => { setPlace({ mode:"auto" }); full(el, opt); if (opt.changed) opt.changed(); };
  };
  paintWhere();
  try { d = await load(); } catch (e) { el.querySelector(".nr-list").innerHTML = '<p class="nr-dim"></p>'; el.querySelector(".nr-list p").textContent = e.message; return; }
  paintWhere();
  const l = items(d), T = [["all", "All"], ["events", "Events"]].concat(l.some(x => x.g === "cons") ? [["cons", "Anime cons"]] : [], [["alerts", "Alerts"], ["news", "News"]]);
  const paint = () => {
    el.querySelector(".nr-tabs").innerHTML = T.map(t => { const n = t[0] === "all" ? l.length : l.filter(x => x.g === t[0]).length; return '<button type="button" data-t="' + t[0] + '" class="' + (t[0] === tab ? "on" : "") + '">' + t[1] + (n ? " " + n : "") + "</button>"; }).join("");
    el.querySelectorAll(".nr-tabs [data-t]").forEach(b => { b.onclick = () => { tab = b.dataset.t; paint(); }; });
    const s = tab === "all" ? l : l.filter(x => x.g === tab);
    el.querySelector(".nr-list").innerHTML = (s.length ? s.map(x => row(x, true)).join("") : '<p class="nr-dim">' + (tab === "alerts" ? "No warnings or earthquakes nearby. 🌤️" : "Nothing here right now.") + "</p>") +
      (tab !== "alerts" && tab !== "news" && d.missing && d.missing.indexOf("events") >= 0 ? '<p class="nr-dim">Concerts and games show here once the Web AI server has a Ticketmaster key (its setup.cmd asks for one).</p>' : "");
    wire(el, opt);
  };
  paint();
  return d;
}
const CSS = `
.nr-card{border-radius:16px;padding:12px 14px;background:var(--bg2);border:1px solid var(--line)}
.nr-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}.nr-h b{flex:1;font-size:14.5px}.nr-more{border:0;background:none;color:var(--accent);font:600 13px system-ui,sans-serif;cursor:pointer;padding:2px 0}
.nr-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);color:var(--fg);text-decoration:none}.nr-card .nr-row:first-child{border-top:0}
.nr-row.warn b{color:#ef4444}.nr-row.own .nr-e{filter:drop-shadow(0 0 4px var(--accent))}
.nr-e{width:26px;text-align:center;font-size:19px;flex:none}.nr-row img{width:56px;height:40px;border-radius:8px;object-fit:cover;flex:none}
.nr-t{flex:1;min-width:0;display:flex;flex-direction:column}.nr-t b{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nr-t em{font-style:normal;font-size:12.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nr-full .nr-t b,.nr-full .nr-t em{white-space:normal}
.nr-dim{color:var(--dim);font-size:13px;margin:6px 0}.nr-tabs{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.nr-tabs button{border:1px solid var(--line);background:var(--bg2);color:var(--fg);border-radius:999px;padding:5px 12px;font:600 12.5px system-ui,sans-serif;cursor:pointer}.nr-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.nr-where{margin-top:14px;border-top:1px solid var(--line);padding-top:8px}.nr-k{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.nr-find{display:flex;gap:6px;margin:6px 0}.nr-in{flex:1;min-width:0;font:inherit;font-size:14px;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.nr-btn{border:1px solid var(--line);background:var(--bg2);color:var(--fg);border-radius:10px;padding:7px 12px;font:600 12.5px system-ui,sans-serif;cursor:pointer}.nr-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.nr-hit{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:var(--fg);font:inherit;font-size:14px;padding:8px 2px;cursor:pointer}
`;
window.Near = { load, card, full, items, prefs, setPlace, geo, exact, when, CSS };
})();
