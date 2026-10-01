/* Webs Browser for iPhone - the address bar's brain.
   Ported from the Windows browser's chrome.html: what you type becomes a URL or
   a search, and a lot of questions are answered right in the address bar
   (calculator, units, money, time zones, dates, weather, dictionary, crypto,
   dice, passwords, timers). Network answers use free, key-less services that
   allow web apps to call them. Depends on core.js (cfg, load, save, toast). */
"use strict";
const ENGINES = {
  ddg:   { name:"DuckDuckGo", url:"https://duckduckgo.com/?q=" },
  google:{ name:"Google",     url:"https://www.google.com/search?q=" },
  bing:  { name:"Bing",       url:"https://www.bing.com/search?q=" },
  brave: { name:"Brave",      url:"https://search.brave.com/search?q=" },
  start: { name:"Startpage",  url:"https://www.startpage.com/sp/search?q=" },
  wiki:  { name:"Wikipedia",  url:"https://en.wikipedia.org/w/index.php?search=" },
  ecosia:{ name:"Ecosia",     url:"https://www.ecosia.org/search?q=" }
};
const engine = () => ENGINES[cfg.search] || ENGINES.ddg;
// A leading bang jumps to one engine for that search only.
const BANGS = { "!g":"google", "!d":"ddg", "!b":"bing", "!w":"wiki", "!s":"start", "!br":"brave", "!e":"ecosia" };
const KEYWORDS = [
  { k:"yt", n:"YouTube", u:"https://www.youtube.com/results?search_query=%s" },
  { k:"w", n:"Wikipedia", u:"https://en.wikipedia.org/w/index.php?search=%s" },
  { k:"gh", n:"GitHub", u:"https://github.com/search?q=%s" },
  { k:"r", n:"Reddit", u:"https://www.reddit.com/search/?q=%s" },
  { k:"a", n:"Amazon", u:"https://www.amazon.com/s?k=%s" },
  { k:"maps", n:"Google Maps", u:"https://www.google.com/maps/search/%s" },
  { k:"img", n:"Google Images", u:"https://www.google.com/search?tbm=isch&q=%s" },
  { k:"tr", n:"Google Translate", u:"https://translate.google.com/?sl=auto&op=translate&text=%s" },
  { k:"imdb", n:"IMDb", u:"https://www.imdb.com/find/?q=%s" },
  { k:"mal", n:"MyAnimeList", u:"https://myanimelist.net/search/all?q=%s" }
];
const keywords = () => Array.isArray(cfg.keywords) ? cfg.keywords : KEYWORDS;

const HOME = "webs:";
const isInternal = u => !u || u.indexOf(HOME) === 0 || u === "about:blank";
const isWeb = u => /^https?:/.test(u || "") && !isInternal(u);
function pretty(u) { return isInternal(u) ? "" : u; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
function rawHost(u) { try { return new URL(u).hostname; } catch (e) { return ""; } }
function listed(list, host) { return (list || []).some(d => host === d || host.endsWith("." + d)); }

/* Turns whatever was typed into either a URL or a search. */
function keywordFor(q) {
  const m = /^(\S+)\s+(.+)$/.exec(q);
  if (!m) return null;
  const k = keywords().find(x => x.k.toLowerCase() === m[1].toLowerCase());
  return k ? { k, rest:m[2] } : null;
}
function resolve(q) {
  q = String(q || "").trim();
  if (!q) return null;
  let eng = engine();
  const m = /^(![a-z]+)(\s+|$)/i.exec(q);
  if (m && BANGS[m[1].toLowerCase()]) { eng = ENGINES[BANGS[m[1].toLowerCase()]]; q = q.slice(m[0].length).trim(); if (!q) return null; }
  else {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) return q;
    if (/^(mailto|tel|sms|facetime|maps):/i.test(q)) return q;
    if (q === "localhost" || /^localhost[:/]/i.test(q)) return "http://" + q;
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]|$)/.test(q)) return "http://" + q;
    if (/^\[[0-9a-f:]+\](:\d+)?([/?#]|$)/i.test(q)) return "http://" + q;
    // A dotted token with no spaces is a hostname (a port is fine); anything else is a search.
    if (!/\s/.test(q) && /^[^\s/?#:]+\.[a-z][a-z0-9-]*\.?(:\d{1,5})?([/?#].*)?$/i.test(q)) return "https://" + q;
    const kw = keywordFor(q);
    if (kw) return kw.k.u.replace("%s", encodeURIComponent(kw.rest));
  }
  return eng.tpl ? eng.tpl.replace("%s", encodeURIComponent(q)) : eng.url + encodeURIComponent(q);   // tpl: your own engines with %s in the middle
}
const isSearchUrl = u => Object.keys(ENGINES).some(k => u.indexOf(ENGINES[k].url) === 0);

/* ---------------------------------------------------------------- calculator and units
   "2^10 / 3", "sqrt(2)*pi", "15% of"... answered right in the address bar. */
function calc(q) {
  let s = String(q).toLowerCase().replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/^=/, "");
  if (!/\d/.test(s) || /^[\d.]+$/.test(s) || !/^[\d.+\-*/^%()a-z,]+$/.test(s)) return null;
  if (!/[-+*/^%(]|sqrt|sin|cos|tan|log|ln|pi|abs/.test(s)) return null;
  let i = 0;
  const FN = { sqrt:Math.sqrt, sin:Math.sin, cos:Math.cos, tan:Math.tan, log:Math.log10, ln:Math.log,
               abs:Math.abs, round:Math.round, floor:Math.floor, ceil:Math.ceil, exp:Math.exp };
  function primary() {
    if (s[i] === "(") { i++; const v = expr(); if (s[i] !== ")") throw 0; i++; return post(v); }
    if (s[i] === "-") { i++; return -primary(); }
    if (s[i] === "+") { i++; return primary(); }
    const w = /^[a-z]+/.exec(s.slice(i));
    if (w) {
      i += w[0].length;
      if (w[0] === "pi") return post(Math.PI);
      if (w[0] === "e") return post(Math.E);
      if (!FN[w[0]]) throw 0;
      return post(FN[w[0]](primary()));
    }
    const n = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/.exec(s.slice(i));
    if (!n) throw 0;
    i += n[0].length;
    return post(parseFloat(n[0]));
  }
  function post(v) { if (s[i] === "%") { i++; return v / 100; } if (s[i] === "!") { i++; let f = 1; for (let k = 2; k <= v; k++) f *= k; return f; } return v; }
  function power() { const b = primary(); if (s[i] === "^") { i++; return Math.pow(b, power()); } return b; }
  function term() { let v = power(); while (s[i] === "*" || s[i] === "/") { const o = s[i++]; const r = power(); v = o === "*" ? v * r : v / r; } return v; }
  function expr() { let v = term(); while (s[i] === "+" || s[i] === "-") { const o = s[i++]; const r = term(); v = o === "+" ? v + r : v - r; } return v; }
  try { const v = expr(); return i === s.length && isFinite(v) ? +v.toPrecision(12) : null; } catch (e) { return null; }
}
const UNITS = [
  { mm:.001, cm:.01, m:1, meter:1, meters:1, km:1000, "in":.0254, inch:.0254, inches:.0254, ft:.3048, foot:.3048, feet:.3048,
    yd:.9144, yard:.9144, yards:.9144, mi:1609.344, mile:1609.344, miles:1609.344 },
  { mg:1e-6, g:.001, gram:.001, grams:.001, kg:1, kgs:1, oz:.028349523125, ounce:.028349523125, ounces:.028349523125,
    lb:.45359237, lbs:.45359237, pound:.45359237, pounds:.45359237, st:6.35029318, stone:6.35029318 },
  { ml:.001, l:1, liter:1, litre:1, liters:1, litres:1, floz:.0295735295625, cup:.2365882365, cups:.2365882365,
    pint:.473176473, pints:.473176473, quart:.946352946, gal:3.785411784, gallon:3.785411784, gallons:3.785411784 },
  { "km/h":1, kmh:1, kph:1, mph:1.609344, "m/s":3.6, knot:1.852, knots:1.852 },
  { b:1, kb:1e3, mb:1e6, gb:1e9, tb:1e12, kib:1024, mib:1048576, gib:1073741824, tib:1099511627776 },
  { s:1, sec:1, second:1, seconds:1, min:60, mins:60, minute:60, minutes:60, h:3600, hr:3600, hour:3600, hours:3600,
    day:86400, days:86400, week:604800, weeks:604800, year:31557600, years:31557600 }
];
function convert(q) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*([a-z°/]+)\s+(?:to|in|as)\s+([a-z°/]+)\s*$/i.exec(q);
  if (!m) return null;
  const v = +m[1], a = m[2].toLowerCase().replace("°", ""), b = m[3].toLowerCase().replace("°", "");
  const T = { c:"c", celsius:"c", f:"f", fahrenheit:"f", k:"k", kelvin:"k" };
  if (T[a] && T[b]) {
    const c = T[a] === "c" ? v : T[a] === "f" ? (v - 32) * 5 / 9 : v - 273.15;
    const r = T[b] === "c" ? c : T[b] === "f" ? c * 9 / 5 + 32 : c + 273.15;
    return +r.toPrecision(8) + " °" + T[b].toUpperCase();
  }
  for (const g of UNITS) if (g[a] && g[b]) return +(v * g[a] / g[b]).toPrecision(8) + " " + m[3];
  return null;
}

/* ---------------------------------------------------------------- instant answers
   More things the address bar answers as you type: money, time zones, dates,
   percentages, number bases, colors, definitions, dice, passwords and timers.
   Each returns rows shaped like the calculator's; the few that need the
   network (exchange rates, the dictionary) fill in when their answer arrives. */
const fmtN = (v, d) => (+v).toLocaleString(undefined, { maximumFractionDigits:d == null ? 2 : d });
const ans = (key, t, s, extra) => Object.assign({ u:"ans:" + key, t, s, i:"sparkle", big:1 }, extra || {});

// Places people type, mapped to time zones. Abbreviations follow the region's
// daylight saving (EST in July answers with New York's actual time).
const ZONES = {
  utc:"UTC", gmt:"UTC", z:"UTC", zulu:"UTC",
  est:"America/New_York", edt:"America/New_York", et:"America/New_York", eastern:"America/New_York",
  cst:"America/Chicago", cdt:"America/Chicago", ct:"America/Chicago", central:"America/Chicago",
  mst:"America/Denver", mdt:"America/Denver", mt:"America/Denver", mountain:"America/Denver",
  pst:"America/Los_Angeles", pdt:"America/Los_Angeles", pt:"America/Los_Angeles", pacific:"America/Los_Angeles",
  akst:"America/Anchorage", hst:"Pacific/Honolulu", ast:"America/Halifax",
  bst:"Europe/London", wet:"Europe/Lisbon", cet:"Europe/Paris", cest:"Europe/Paris", eet:"Europe/Athens", msk:"Europe/Moscow",
  ist:"Asia/Kolkata", pkt:"Asia/Karachi", sgt:"Asia/Singapore", hkt:"Asia/Hong_Kong", jst:"Asia/Tokyo", kst:"Asia/Seoul",
  aest:"Australia/Sydney", aedt:"Australia/Sydney", acst:"Australia/Adelaide", awst:"Australia/Perth", nzst:"Pacific/Auckland", nzdt:"Pacific/Auckland",
  "new york":"America/New_York", nyc:"America/New_York", boston:"America/New_York", miami:"America/New_York", atlanta:"America/New_York",
  washington:"America/New_York", philadelphia:"America/New_York", toronto:"America/Toronto", montreal:"America/Toronto", detroit:"America/Detroit",
  chicago:"America/Chicago", dallas:"America/Chicago", houston:"America/Chicago", austin:"America/Chicago", "san antonio":"America/Chicago",
  "new orleans":"America/Chicago", minneapolis:"America/Chicago", "mexico city":"America/Mexico_City", mexico:"America/Mexico_City",
  denver:"America/Denver", phoenix:"America/Phoenix", "salt lake city":"America/Denver", calgary:"America/Edmonton",
  "los angeles":"America/Los_Angeles", la:"America/Los_Angeles", "san francisco":"America/Los_Angeles", seattle:"America/Los_Angeles",
  "las vegas":"America/Los_Angeles", "san diego":"America/Los_Angeles", portland:"America/Los_Angeles", vancouver:"America/Vancouver",
  anchorage:"America/Anchorage", alaska:"America/Anchorage", honolulu:"Pacific/Honolulu", hawaii:"Pacific/Honolulu",
  "sao paulo":"America/Sao_Paulo", "são paulo":"America/Sao_Paulo", rio:"America/Sao_Paulo", brazil:"America/Sao_Paulo",
  "buenos aires":"America/Argentina/Buenos_Aires", argentina:"America/Argentina/Buenos_Aires", lima:"America/Lima", peru:"America/Lima",
  bogota:"America/Bogota", colombia:"America/Bogota", santiago:"America/Santiago", chile:"America/Santiago", caracas:"America/Caracas",
  london:"Europe/London", uk:"Europe/London", england:"Europe/London", dublin:"Europe/Dublin", ireland:"Europe/Dublin", lisbon:"Europe/Lisbon",
  portugal:"Europe/Lisbon", madrid:"Europe/Madrid", spain:"Europe/Madrid", barcelona:"Europe/Madrid", paris:"Europe/Paris", france:"Europe/Paris",
  berlin:"Europe/Berlin", germany:"Europe/Berlin", munich:"Europe/Berlin", amsterdam:"Europe/Amsterdam", netherlands:"Europe/Amsterdam",
  brussels:"Europe/Brussels", belgium:"Europe/Brussels", zurich:"Europe/Zurich", switzerland:"Europe/Zurich", rome:"Europe/Rome", italy:"Europe/Rome",
  milan:"Europe/Rome", vienna:"Europe/Vienna", austria:"Europe/Vienna", prague:"Europe/Prague", warsaw:"Europe/Warsaw", poland:"Europe/Warsaw",
  stockholm:"Europe/Stockholm", sweden:"Europe/Stockholm", oslo:"Europe/Oslo", norway:"Europe/Oslo", copenhagen:"Europe/Copenhagen",
  denmark:"Europe/Copenhagen", helsinki:"Europe/Helsinki", finland:"Europe/Helsinki", athens:"Europe/Athens", greece:"Europe/Athens",
  istanbul:"Europe/Istanbul", turkey:"Europe/Istanbul", kyiv:"Europe/Kyiv", kiev:"Europe/Kyiv", ukraine:"Europe/Kyiv", moscow:"Europe/Moscow",
  russia:"Europe/Moscow", cairo:"Africa/Cairo", egypt:"Africa/Cairo", lagos:"Africa/Lagos", nigeria:"Africa/Lagos", nairobi:"Africa/Nairobi",
  kenya:"Africa/Nairobi", johannesburg:"Africa/Johannesburg", "south africa":"Africa/Johannesburg", "cape town":"Africa/Johannesburg",
  casablanca:"Africa/Casablanca", morocco:"Africa/Casablanca", dubai:"Asia/Dubai", uae:"Asia/Dubai", "abu dhabi":"Asia/Dubai",
  riyadh:"Asia/Riyadh", "saudi arabia":"Asia/Riyadh", doha:"Asia/Qatar", qatar:"Asia/Qatar", tehran:"Asia/Tehran", iran:"Asia/Tehran",
  "tel aviv":"Asia/Jerusalem", jerusalem:"Asia/Jerusalem", israel:"Asia/Jerusalem", karachi:"Asia/Karachi", pakistan:"Asia/Karachi",
  delhi:"Asia/Kolkata", "new delhi":"Asia/Kolkata", mumbai:"Asia/Kolkata", bangalore:"Asia/Kolkata", india:"Asia/Kolkata",
  dhaka:"Asia/Dhaka", bangladesh:"Asia/Dhaka", kathmandu:"Asia/Kathmandu", nepal:"Asia/Kathmandu", bangkok:"Asia/Bangkok",
  thailand:"Asia/Bangkok", jakarta:"Asia/Jakarta", indonesia:"Asia/Jakarta", bali:"Asia/Makassar", singapore:"Asia/Singapore",
  "kuala lumpur":"Asia/Kuala_Lumpur", malaysia:"Asia/Kuala_Lumpur", manila:"Asia/Manila", philippines:"Asia/Manila",
  hanoi:"Asia/Bangkok", vietnam:"Asia/Ho_Chi_Minh", "ho chi minh":"Asia/Ho_Chi_Minh", "hong kong":"Asia/Hong_Kong",
  beijing:"Asia/Shanghai", shanghai:"Asia/Shanghai", china:"Asia/Shanghai", shenzhen:"Asia/Shanghai", taipei:"Asia/Taipei",
  taiwan:"Asia/Taipei", seoul:"Asia/Seoul", korea:"Asia/Seoul", "south korea":"Asia/Seoul", tokyo:"Asia/Tokyo", japan:"Asia/Tokyo",
  osaka:"Asia/Tokyo", sydney:"Australia/Sydney", melbourne:"Australia/Melbourne", australia:"Australia/Sydney",
  brisbane:"Australia/Brisbane", adelaide:"Australia/Adelaide", perth:"Australia/Perth", auckland:"Pacific/Auckland",
  "new zealand":"Pacific/Auckland", wellington:"Pacific/Auckland", reykjavik:"Atlantic/Reykjavik", iceland:"Atlantic/Reykjavik"
};
function zoneOf(place) {
  const k = String(place || "").toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
  if (ZONES[k]) return ZONES[k];
  if (/^(here|local|my time|me)$/.test(k)) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  return null;
}
const titleCase = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());
function zoneOffset(zone, date) {
  // minutes east of UTC for that zone at that instant
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone:zone, hourCycle:"h23", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit" }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
const gmtLabel = m => "GMT" + (m >= 0 ? "+" : "−") + Math.floor(Math.abs(m) / 60) + (Math.abs(m) % 60 ? ":" + String(Math.abs(m) % 60).padStart(2, "0") : "");
function timeIn(zone, date) {
  return date.toLocaleTimeString([], { timeZone:zone, hour:"numeric", minute:"2-digit" }) + ", " +
         date.toLocaleDateString([], { timeZone:zone, weekday:"long", month:"short", day:"numeric" });
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
function parseDay(s, now) {
  s = s.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const y0 = now.getFullYear();
  const next = (m, d) => { let x = new Date(y0, m, d); if (x < new Date(y0, now.getMonth(), now.getDate())) x = new Date(y0 + 1, m, d); return x; };
  const named = { "christmas":[11, 25], "christmas day":[11, 25], "christmas eve":[11, 24], "new year":[0, 1], "new years":[0, 1],
                  "new year's":[0, 1], "new years day":[0, 1], "new year's day":[0, 1], "halloween":[9, 31], "valentine's day":[1, 14],
                  "valentines day":[1, 14], "valentines":[1, 14], "new year's eve":[11, 31], "new years eve":[11, 31], "independence day":[6, 4] };
  if (named[s]) return next(...named[s]);
  if (s === "today") return new Date(y0, now.getMonth(), now.getDate());
  if (s === "tomorrow") return new Date(y0, now.getMonth(), now.getDate() + 1);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null; return y ? new Date(y, +m[1] - 1, +m[2]) : next(+m[1] - 1, +m[2]); }
  const mi = w => MONTHS.findIndex(x => x.startsWith(w) && w.length >= 3);
  m = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(s);
  if (m && mi(m[1]) >= 0) return m[3] ? new Date(+m[3], mi(m[1]), +m[2]) : next(mi(m[1]), +m[2]);
  m = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?: (\d{4}))?$/.exec(s);
  if (m && mi(m[2]) >= 0) return m[3] ? new Date(+m[3], mi(m[2]), +m[1]) : next(mi(m[2]), +m[1]);
  return null;
}
const dayMs = 86400000;
const longDate = d => d.toLocaleDateString([], { weekday:"long", year:"numeric", month:"long", day:"numeric" });

// Exchange rates: one free, key-less source (open.er-api.com), fetched at most every 12 hours.
const CUR = { "$":"USD", "us$":"USD", dollar:"USD", dollars:"USD", usd:"USD", "€":"EUR", euro:"EUR", euros:"EUR", "£":"GBP", pound:"GBP",
  pounds:"GBP", quid:"GBP", "¥":"JPY", yen:"JPY", "₹":"INR", rupee:"INR", rupees:"INR", "₩":"KRW", won:"KRW", "₽":"RUB", ruble:"RUB",
  rubles:"RUB", peso:"MXN", pesos:"MXN", real:"BRL", reais:"BRL", yuan:"CNY", rmb:"CNY", franc:"CHF", francs:"CHF", "c$":"CAD",
  "a$":"AUD", bitcoin:"BTC", btc:"BTC" };
let fxRates = load("fx", null), fxBusy = false;
function curCode(w) {
  const k = String(w || "").toLowerCase();
  if (CUR[k]) return CUR[k];
  return /^[a-z]{3}$/.test(k) && fxRates && fxRates.rates && fxRates.rates[k.toUpperCase()] ? k.toUpperCase() :
         /^[a-z]{3}$/.test(k) && !fxRates ? k.toUpperCase() : null;
}
function fxFetch() {
  if (fxBusy || PRIVATE && fxRates) return;
  if (fxRates && Date.now() - fxRates.ts < 12 * 3600000) return;
  fxBusy = true;
  fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json()).then(j => {
    if (j && j.rates && j.rates.EUR) { fxRates = { ts:Date.now(), rates:j.rates, day:j.time_last_update_utc || "" }; save("fx", fxRates); onAnswerReady(); }
  }).catch(() => {}).finally(() => { fxBusy = false; });
}
function currency(q) {
  const m = /^\s*([$€£¥₹₩₽]|us\$|c\$|a\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*([a-z$€£¥₹₩₽]{1,8})?\s+(?:to|in|into|as)\s+([a-z$€£¥₹₩₽]{1,8})\s*$/i.exec(q);
  if (!m) return null;
  const from = curCode(m[1] || m[3]), to = curCode(m[4]);
  if (!from || !to || from === to) return null;
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
  const n = +m[2].replace(/,/g, "");
  if (!fxRates || Date.now() - fxRates.ts > 12 * 3600000) fxFetch();
  if (!fxRates) return ans("fx", "Converting " + from + " to " + to + "…", "Getting today's exchange rates");
  const a = fxRates.rates[from], b = fxRates.rates[to];
  if (!a || !b) return null;
  const v = n / a * b;
  const txt = fmtN(n) + " " + from + " = " + fmtN(v, v < 1 ? 6 : 2) + " " + to;
  return ans("fx", txt, "Rate from open.er-api.com, " + new Date(fxRates.ts).toLocaleDateString() + " · Tap to copy", { copy:(+v.toFixed(v < 1 ? 6 : 2)).toString() });
}

// Definitions from the free dictionaryapi.dev.
const defCache = {};
function definition(q) {
  const m = /^(?:define|definition(?: of)?|meaning of|what does (.+) mean)\s*(.*)$/i.exec(q);
  if (!m) return null;
  const w = (m[1] || m[2] || "").trim().toLowerCase();
  if (!/^[a-z][a-z' -]{0,39}$/.test(w)) return null;
  const c = defCache[w];
  if (c === undefined) {
    defCache[w] = null;
    fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w)).then(r => r.ok ? r.json() : []).then(j => {
      const e = Array.isArray(j) && j[0], mean = e && e.meanings && e.meanings[0], d = mean && mean.definitions && mean.definitions[0];
      defCache[w] = d ? { pos:mean.partOfSpeech || "", def:d.definition, ph:e.phonetic || "" } : false;
      onAnswerReady(q);
    }).catch(() => { defCache[w] = false; });
    return ans("def", "Looking up “" + w + "”…", "Dictionary");
  }
  if (c === null) return ans("def", "Looking up “" + w + "”…", "Dictionary");
  if (c === false) return null;
  return ans("def", w + (c.pos ? " (" + c.pos + ")" : "") + ": " + c.def, (c.ph ? c.ph + " · " : "") + "Dictionary · Tap to copy", { copy:c.def, wrap:1 });
}

// Weather for a place, from Open-Meteo (no key, no account).
const wxCache = {};
let wxT = 0, coinT = 0;   // looked up once you stop typing, not for every letter
const WXT = { 0:"Clear", 1:"Mostly clear", 2:"Partly cloudy", 3:"Cloudy", 45:"Fog", 48:"Fog", 51:"Drizzle", 53:"Drizzle", 55:"Drizzle", 56:"Freezing drizzle", 57:"Freezing drizzle",
  61:"Light rain", 63:"Rain", 65:"Heavy rain", 66:"Freezing rain", 67:"Freezing rain", 71:"Light snow", 73:"Snow", 75:"Heavy snow", 77:"Snow grains",
  80:"Showers", 81:"Showers", 82:"Heavy showers", 85:"Snow showers", 86:"Snow showers", 95:"Thunderstorm", 96:"Thunderstorm", 99:"Thunderstorm" };
function weatherAns(q) {
  const m = /^(?:weather|forecast|temperature)(?:\s+(?:in|for|at))?\s+([a-z][a-z .,'-]{1,60})$/i.exec(q) || /^([a-z][a-z .,'-]{1,60}?)\s+(?:weather|forecast)$/i.exec(q);
  if (!m) return null;
  const place = m[1].trim().replace(/[.,]+$/, ""), unit = cfg.wxUnit === "c" || cfg.wxUnit === "f" ? cfg.wxUnit : /^en-US$/i.test(navigator.language) ? "f" : "c";
  const key = place.toLowerCase() + "|" + unit, c = wxCache[key];
  if (c === undefined || (c && Date.now() - c.ts > 15 * 60000)) {
    clearTimeout(wxT);
    wxT = setTimeout(async () => {
      if (wxCache[key] === null || (wxCache[key] && Date.now() - wxCache[key].ts < 15 * 60000)) return;
      wxCache[key] = wxCache[key] || null;
      try {
        const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(place))).json();
        const loc = g && g.results && g.results[0];
        if (!loc) throw new Error("no such place");
        const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.latitude + "&longitude=" + loc.longitude +
          "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto" +
          (unit === "f" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : ""))).json();
        wxCache[key] = { ts:Date.now(), name:[loc.name, loc.admin1, loc.country_code].filter(Boolean).join(", "), t:w.current.temperature_2m, code:w.current.weather_code,
          wind:w.current.wind_speed_10m, hum:w.current.relative_humidity_2m, hi:w.daily.temperature_2m_max[0], lo:w.daily.temperature_2m_min[0],
          rain:(w.daily.precipitation_probability_max || [])[0], unit };
      } catch (e) { if (!wxCache[key]) wxCache[key] = false; }
      onAnswerReady(q);
    }, 450);
  }
  if (!wxCache[key]) return wxCache[key] === false ? null : ans("wx", "Weather in " + place + "…", "Open-Meteo");
  const d = wxCache[key], U = "°" + d.unit.toUpperCase();
  return ans("wx", Math.round(d.t) + U + " · " + (WXT[d.code] || "") + " in " + d.name,
    "High " + Math.round(d.hi) + U + ", low " + Math.round(d.lo) + U + (d.rain != null ? " · " + d.rain + "% chance of rain" : "") + " · wind " + Math.round(d.wind) + (d.unit === "f" ? " mph" : " km/h") + " · humidity " + d.hum + "% · Open-Meteo",
    { copy:Math.round(d.t) + U + " " + (WXT[d.code] || "") + ", " + d.name, wrap:1 });
}
// Cryptocurrency prices from CoinGecko, kept for two minutes.
const COINS = { btc:"bitcoin", bitcoin:"bitcoin", eth:"ethereum", ethereum:"ethereum", sol:"solana", solana:"solana", doge:"dogecoin", dogecoin:"dogecoin",
  xrp:"ripple", ripple:"ripple", ada:"cardano", cardano:"cardano", ltc:"litecoin", litecoin:"litecoin", bnb:"binancecoin", dot:"polkadot", polkadot:"polkadot",
  matic:"matic-network", polygon:"matic-network", avax:"avalanche-2", avalanche:"avalanche-2", trx:"tron", tron:"tron", link:"chainlink", chainlink:"chainlink",
  shib:"shiba-inu", xlm:"stellar", stellar:"stellar", ton:"the-open-network", usdt:"tether", tether:"tether", usdc:"usd-coin" };
const coinCache = {};
function cryptoAns(q) {
  const m = /^(?:price of\s+)?([a-z]+)\s*(?:price|to\s+(usd|eur|gbp|jpy|cad|aud|inr|brl|mxn|chf)|in\s+(usd|eur|gbp|jpy|cad|aud|inr|brl|mxn|chf))?$/i.exec(q);
  if (!m || !COINS[m[1].toLowerCase()] || !(/price/i.test(q) || m[2] || m[3])) return null;
  const id = COINS[m[1].toLowerCase()], cur = (m[2] || m[3] || (/^en-(GB)$/i.test(navigator.language) ? "gbp" : "usd")).toLowerCase(), key = id + "|" + cur, c = coinCache[key];
  if (c === undefined || (c && Date.now() - c.ts > 120000)) {
    clearTimeout(coinT);
    coinT = setTimeout(() => {
    if (coinCache[key] === null || (coinCache[key] && Date.now() - coinCache[key].ts < 120000)) return;
    coinCache[key] = coinCache[key] || null;
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + id + "&vs_currencies=" + cur + "&include_24hr_change=true").then(r => r.json()).then(j => {
      const v = j && j[id] && j[id][cur];
      coinCache[key] = v > 0 ? { ts:Date.now(), v, ch:j[id][cur + "_24h_change"] } : false;
      onAnswerReady(q);
    }).catch(() => { if (!coinCache[key]) coinCache[key] = false; });
    }, 350);
  }
  if (!coinCache[key]) return coinCache[key] === false ? null : ans("coin", "Looking up the " + id.replace(/-.*/, "") + " price…", "CoinGecko");
  const d = coinCache[key];
  const txt = new Intl.NumberFormat(undefined, { style:"currency", currency:cur.toUpperCase(), maximumFractionDigits:d.v < 1 ? 6 : 2 }).format(d.v);
  return ans("coin", "1 " + m[1].toUpperCase() + " = " + txt, (typeof d.ch === "number" ? (d.ch >= 0 ? "Up " : "Down ") + Math.abs(d.ch).toFixed(2) + "% in 24 hours · " : "") + "CoinGecko · Tap to copy", { copy:String(d.v) });
}

function randomBits(n) { const a = new Uint32Array(n); crypto.getRandomValues(a); return a; }
function randInt(lo, hi) { return lo + randomBits(1)[0] % (hi - lo + 1); }
function strongPassword(n) {
  const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*-_=+?"];
  const all = sets.join(""), r = randomBits(n + 4);
  let p = sets.map((s, i) => s[r[i] % s.length]);
  for (let i = 4; i < n; i++) p.push(all[r[i] % all.length]);
  for (let i = p.length - 1; i > 0; i--) { const j = r[(i + 4) % r.length] % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return p.join("");
}
let randCache = { q:"", rows:null };
function randoms(q) {
  const s = q.toLowerCase().trim();
  // the same answer while you look at it; a new one when you type again
  if (randCache.q === s) return randCache.rows;
  let row = null;
  if (/^(uuid|guid)$/.test(s)) { const u = crypto.randomUUID(); row = ans("rnd", u, "Random UUID · Tap to copy", { copy:u }); }
  else if (/^(flip a coin|coin flip|flip coin|heads or tails)$/.test(s)) { const c = randInt(0, 1) ? "Heads" : "Tails"; row = ans("rnd", c, "Coin flip", { copy:c }); }
  else {
    let m = /^roll(?: a)?(?: (\d{1,2}))?(?: ?d(\d{1,4}))?(?: dice| die)?$/.exec(s);
    if (m && (m[1] || m[2] || /dic?e$/.test(s) || s === "roll")) {
      const n = Math.min(+(m[1] || 1), 50), sides = +(m[2] || 6);
      if (sides >= 2) {
        const r = Array.from({ length:n }, () => randInt(1, sides));
        const tot = r.reduce((a, b) => a + b, 0);
        row = ans("rnd", n > 1 ? r.join(" + ") + " = " + tot : String(tot), "Rolled " + n + "d" + sides, { copy:String(tot) });
      }
    }
    m = /^(?:random(?: number)?|pick a number)(?: (?:between )?(-?\d+)\s*(?:-|to|and)\s*(-?\d+))?$/.exec(s);
    if (!row && m) {
      const lo = m[1] != null ? Math.min(+m[1], +m[2]) : 1, hi = m[1] != null ? Math.max(+m[1], +m[2]) : 100;
      const v = randInt(lo, hi);
      row = ans("rnd", String(v), "Random number from " + lo + " to " + hi + " · Tap to copy", { copy:String(v) });
    }
    m = /^(?:password|generate password|strong password)(?: (\d{1,3}))?$/.exec(s);
    if (!row && m) {
      const pw = strongPassword(Math.max(8, Math.min(128, +(m[1] || 20))));
      row = ans("rnd", pw, "Strong password · Tap to copy", { copy:pw });
    }
  }
  randCache = { q:s, rows:row };
  return row;
}

/* Timers: "timer 10 min", "timer 1h 30m", "remind me in 20 minutes to stretch".
   They live in storage so the sidebar can show them, and ring in whichever
   window notices first. */
function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return [h ? h + " h" : "", m ? m + " min" : "", x ? x + " s" : ""].filter(Boolean).join(" ") || "0 s";
}
function parseDuration(s) {
  let total = 0, any = false;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/gi;
  let m, rest = s;
  while ((m = re.exec(s))) {
    any = true;
    const u = m[2].toLowerCase(), v = +m[1];
    total += u[0] === "h" ? v * 3600 : u[0] === "m" ? v * 60 : v;
    rest = rest.replace(m[0], "");
  }
  if (!any && /^\s*\d+(\.\d+)?\s*$/.test(s)) { total = +s * 60; any = true; rest = ""; }
  return any && total > 0 && total <= 7 * 86400 ? { secs:Math.round(total), rest:rest.trim() } : null;
}
function addTimer(secs, label) {
  const list = load("timers", []);
  list.push({ id:Date.now().toString(36) + Math.random().toString(36).slice(2, 6), end:Date.now() + secs * 1000, secs, label:label || "" });
  save("timers", list);
  toast("Timer set for " + fmtDur(secs) + (label ? " - " + label : ""));
}
function timerAnswer(q) {
  let m = /^(?:timer|set (?:a )?timer(?: for)?|countdown)\s+(.+)$/i.exec(q);
  let label = "";
  if (!m) { m = /^remind me in\s+(.+?)(?:\s+to\s+(.+))?$/i.exec(q); if (m) label = m[2] || ""; }
  if (!m) return null;
  const d = parseDuration(m[1]);
  if (!d) return null;
  label = label || d.rest.replace(/^(for|to)\s+/i, "");
  return ans("timer", "Start a " + fmtDur(d.secs) + " timer" + (label ? " - " + label : ""), "Tap to start. It rings while Webs Browser is open.",
    { act:() => addTimer(d.secs, label) });
}
let ringCtx = null;
function ring() {
  try {
    ringCtx = ringCtx || new AudioContext();
    [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach(t => {
      const o = ringCtx.createOscillator(), g = ringCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ringCtx.destination);
      const at = ringCtx.currentTime + t;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      o.start(at); o.stop(at + 0.32);
    });
  } catch (e) {}
}
setInterval(() => {
  const list = load("timers", []);
  if (!list.length) return;
  const now = Date.now(), due = list.filter(t => t.end <= now);
  if (!due.length) return;
  save("timers", list.filter(t => t.end > now));
  due.forEach(t => {
    ring();
    if (typeof timerDone === "function") timerDone(t);   // a notification, achievements (extras.js)
    if (t.pomo) {
      // Pomodoro: 25 minutes of focus, then a 5 minute break (15 after every fourth).
      const brk = t.label === "Focus", n = t.pomo;
      const secs = brk ? (n % 4 === 0 ? 15 : 5) * 60 : 25 * 60;
      const next = load("timers", []);
      next.push({ id:Date.now().toString(36) + "p", end:Date.now() + secs * 1000, secs, label:brk ? "Break" : "Focus", pomo:brk ? n : n + 1 });
      save("timers", next);
      toast(brk ? "Focus round " + n + " done - take a " + fmtDur(secs) + " break" : "Break over - focus round " + (n + 1));
    } else toast("⏰ " + (t.label ? t.label : "Timer done") + " (" + fmtDur(t.secs) + ")");
  });
}, 1000);

function answers(q) {
  const out = [];
  const push = r => { if (r) out.push(r); };
  const s = q.trim(), l = s.toLowerCase();
  const now = new Date();
  let m;

  // percentages
  if ((m = /^(-?\d+(?:\.\d+)?)\s*%\s*of\s*\$?(-?\d+(?:\.\d+)?)$/i.exec(s))) { const v = m[1] / 100 * m[2]; push(ans("pct", "= " + fmtN(v, 6), m[1] + "% of " + m[2] + " · Tap to copy", { copy:String(+v.toFixed(10)) })); }
  else if ((m = /^(\d+(?:\.\d+)?)\s*%\s*off\s*\$?(\d+(?:\.\d+)?)$/i.exec(s))) { const v = m[2] * (1 - m[1] / 100); push(ans("pct", "= " + fmtN(v), "Price after " + m[1] + "% off (you save " + fmtN(m[2] - v) + ") · Tap to copy", { copy:String(+v.toFixed(2)) })); }
  else if ((m = /^\$?(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*%$/.exec(s))) { const v = m[1] * (1 + (m[2] === "+" ? 1 : -1) * m[3] / 100); push(ans("pct", "= " + fmtN(v, 6), m[1] + " " + m[2] + " " + m[3] + "% · Tap to copy", { copy:String(+v.toFixed(10)) })); }
  else if ((m = /^(?:what (?:percent|%) (?:is|of) )?(-?\d+(?:\.\d+)?) (?:is what (?:percent|%) of|as a (?:percent|%) of|out of|of) (-?\d+(?:\.\d+)?)(?: as a (?:percent|%))?\??$/i.exec(s)) && /percent|%|out of/i.test(s)) {
    const v = m[1] / m[2] * 100; if (isFinite(v)) push(ans("pct", "= " + fmtN(v, 4) + "%", m[1] + " out of " + m[2] + " · Tap to copy", { copy:fmtN(v, 4) + "%" }));
  }
  // tip and splitting a bill
  if ((m = /^tip\s+(\d+(?:\.\d+)?)\s*%?\s*(?:on|of|for)?\s*\$?(\d+(?:\.\d+)?)(?:\s+(?:split|for|between|by)\s+(\d+)(?:\s*(?:people|ways|persons))?)?$/i.exec(s))) {
    const tip = m[2] * m[1] / 100, tot = +m[2] + tip, n = +(m[3] || 1);
    push(ans("tip", "Tip " + fmtN(tip) + " · total " + fmtN(tot) + (n > 1 ? " · " + fmtN(tot / n) + " each" : ""), m[1] + "% tip on " + m[2] + (n > 1 ? ", split " + n + " ways" : "") + " · Tap to copy the total", { copy:(n > 1 ? tot / n : tot).toFixed(2) }));
  } else if ((m = /^split\s+\$?(\d+(?:\.\d+)?)\s+(?:by|between|into|for|among)\s+(\d+)(?:\s*(?:people|ways|persons))?$/i.exec(s)) && +m[2] > 0) {
    const v = m[1] / m[2]; push(ans("tip", fmtN(v) + " each", m[1] + " split " + m[2] + " ways · Tap to copy", { copy:v.toFixed(2) }));
  }
  // number bases
  if ((m = /^(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)\s+(?:to|in|as)\s+(hex|hexadecimal|binary|bin|octal|oct|decimal|dec)$/i.exec(s))) {
    try {
      const n = BigInt(m[1].toLowerCase()), w = m[2].toLowerCase();
      const t = w[0] === "h" ? 16 : w.startsWith("bin") ? 2 : w.startsWith("oct") ? 8 : 10;
      const v = { 16:"0x", 2:"0b", 8:"0o", 10:"" }[t] + n.toString(t).toUpperCase();
      push(ans("base", "= " + v, "Tap to copy", { copy:v }));
    } catch (e) {}
  }
  // colors
  if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s))) {
    push(colorRow(m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1]));
  } else if ((m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(s)) && m.slice(1, 4).every(x => +x <= 255)) {
    push(colorRow(m.slice(1, 4).map(x => (+x).toString(16).padStart(2, "0")).join("")));
  } else if ((m = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(s))) {
    push(colorRow(hslToHex(+m[1], +m[2], +m[3])));
  }
  // world clock and time zone conversion
  if ((m = /^(?:what(?:'s| is) the )?(?:current )?time (?:in|at) (.+?)\??$/i.exec(s)) || (m = /^(.+?) time$/i.exec(s)) && zoneOf(m[1])) {
    const z = zoneOf(m[1]);
    if (z) push(ans("tz", timeIn(z, now), titleCase(m[1]) + " (" + gmtLabel(zoneOffset(z, now)) + ") · Tap to copy", { copy:now.toLocaleTimeString([], { timeZone:z, hour:"numeric", minute:"2-digit" }) }));
  }
  if ((m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+?)\s+(?:to|in)\s+(.+)$/i.exec(s))) {
    const za = zoneOf(m[4]), zb = zoneOf(m[5]);
    let h = +m[1]; const mi = +(m[2] || 0), ap = (m[3] || "").toLowerCase();
    if (za && zb && h <= 23 && mi <= 59 && (!ap || h <= 12)) {
      if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
      // wall-clock time today in zone A, as an instant
      const p = {}; new Intl.DateTimeFormat("en-US", { timeZone:za, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(now).forEach(x => { p[x.type] = x.value; });
      let guess = Date.UTC(+p.year, +p.month - 1, +p.day, h, mi);
      guess -= zoneOffset(za, new Date(guess)) * 60000;
      const at = new Date(guess);
      const txt = at.toLocaleTimeString([], { timeZone:zb, hour:"numeric", minute:"2-digit" });
      const dayA = at.toLocaleDateString("en-CA", { timeZone:za }), dayB = at.toLocaleDateString("en-CA", { timeZone:zb });
      push(ans("tzc", "= " + txt + (dayA !== dayB ? (dayB > dayA ? " (next day)" : " (previous day)") : ""),
        at.toLocaleTimeString([], { timeZone:za, hour:"numeric", minute:"2-digit" }) + " " + titleCase(m[4]) + " (" + gmtLabel(zoneOffset(za, at)) + ") in " + titleCase(m[5]) + " (" + gmtLabel(zoneOffset(zb, at)) + ") · Tap to copy", { copy:txt }));
    }
  }
  // dates
  if ((m = /^(?:how many )?(days|weeks|months) (?:until|till|til|to|before) (.+?)\??$/i.exec(s)) || (m = /^(days|weeks) since (.+?)\??$/i.exec(s))) {
    const d = parseDay(m[2], now);
    if (d) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((d - today) / dayMs), since = /since/i.test(s);
      const n = Math.abs(days), unit = m[1].toLowerCase();
      const v = unit === "weeks" ? fmtN(n / 7, 1) : unit === "months" ? fmtN(n / 30.44, 1) : fmtN(n, 0);
      push(ans("date", v + " " + unit + (since || days < 0 ? " ago" : ""), longDate(d) + " · Tap to copy", { copy:v }));
    }
  }
  if ((m = /^(\d+) (days?|weeks?|months?|years?) (from now|from today|later|ago|before today)$/i.exec(s))) {
    const n = +m[1], u = m[2].toLowerCase()[0], back = /ago|before/i.test(m[3]) ? -1 : 1;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (u === "d") d.setDate(d.getDate() + back * n); else if (u === "w") d.setDate(d.getDate() + back * 7 * n);
    else if (u === "m") d.setMonth(d.getMonth() + back * n); else d.setFullYear(d.getFullYear() + back * n);
    push(ans("date", longDate(d), s + " · Tap to copy", { copy:d.toLocaleDateString() }));
  }
  if ((m = /^what day (?:is|was|will be) (.+?)\??$/i.exec(s)) || (m = /^day of (.+)$/i.exec(s))) {
    const d = parseDay(m[1], now);
    if (d) push(ans("date", d.toLocaleDateString([], { weekday:"long" }), longDate(d), { copy:d.toLocaleDateString([], { weekday:"long" }) }));
  }
  push(currency(s));
  push(definition(s));
  push(weatherAns(s));
  push(cryptoAns(s));
  push(randoms(s));
  push(timerAnswer(s));
  return out;
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function colorRow(hex) {
  hex = hex.toLowerCase();
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), L = (mx + mn) / 2;
  let H = 0, S = 0;
  if (mx !== mn) {
    const d = mx - mn; S = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    H = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; H *= 60;
  }
  const sw = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="4" fill="#' + hex + '" stroke="rgba(128,128,128,.5)"/></svg>');
  return ans("color", "#" + hex + "  ·  rgb(" + r + ", " + g + ", " + b + ")  ·  hsl(" + Math.round(H) + ", " + Math.round(S * 100) + "%, " + Math.round(L * 100) + "%)",
    "Color · Tap to copy the hex code", { copy:"#" + hex, img:sw });
}

