/* Webs Browser - privacy helpers shared by both apps (Windows 3.10, iPhone 2.9).
   Privacy.regDomain(host)        the name a site was registered as (shop.example.co.uk -> example.co.uk), a good guess
   Privacy.domainAge(host)        when that name was registered, from the public registry (RDAP), through the Web AI
                                  server (GET /domain, cached there a day) or the registry itself; kept here a week
   Privacy.hostSigns(host)        what the address alone says: a brand in a name that isn't the brand's, a cheap ending
   Privacy.shopVerdict(sig, age)  is this shop fake? sig is what the page showed (the x-shop page tool on Windows):
                                  { shop, deals, trust, payOk, payRisky, urgency, freeMail, https }; age from domainAge
                                  -> { level:"ok"|"careful"|"warn", score, reasons:[…] }
   Privacy.whoami()               what every site learns from your internet address (GET /whoami on the Web AI server)
   Privacy.seen(o)                the list "What sites see about you" shows, from what this device answers (o adds the
                                  internet address, and on Windows what the page itself saw) -> [{ g, k, v, tip, safe }]
   Privacy.render(el, list)       that list as HTML */
(function () {
"use strict";
if (window.Privacy) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const server = () => {
  for (const s of [(get("xai", {}) || {}).server, (get("xaiConfig", {}) || {}).server, (get("push", {}) || {}).server]) {
    const a = String(s || "").trim().replace(/\/+$/, ""); if (/^https:\/\/\S+$/.test(a)) return a;
  }
  return "";
};

/* ---------------------------------------------------------------- the registered name */
// endings where the name people register sits one level further down (example.co.uk)
const SECOND = /^(co|com|net|org|gov|edu|ac|or|ne|go|gob|nic|mil|sch|ltd|plc|biz|info|nom|me|in|gen|firm|web|ind|res)$/;
function regDomain(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!h || /^[\d.]+$/.test(h) || h.indexOf(".") < 0 || h.indexOf(":") >= 0) return "";
  const p = h.split(".");
  if (p.length > 2 && p[p.length - 1].length === 2 && SECOND.test(p[p.length - 2])) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}

/* ---------------------------------------------------------------- how old a website is */
function parseRdap(j) {
  if (!j || typeof j !== "object") return null;
  const ev = a => (Array.isArray(j.events) ? j.events : []).find(e => e && e.eventAction === a);
  const day = e => e && /^\d{4}-\d\d-\d\d/.test(String(e.eventDate || "")) ? String(e.eventDate).slice(0, 10) : "";
  let registrar = "";
  (Array.isArray(j.entities) ? j.entities : []).forEach(e => {
    if (registrar || !e || !Array.isArray(e.roles) || e.roles.indexOf("registrar") < 0) return;
    const v = Array.isArray(e.vcardArray) && Array.isArray(e.vcardArray[1]) ? e.vcardArray[1] : [];
    const fn = v.find(x => Array.isArray(x) && x[0] === "fn"); registrar = fn ? String(fn[3] || "").slice(0, 80) : "";
  });
  return { created:day(ev("registration")), expires:day(ev("expiration")), registrar };
}
const ageDays = created => created ? Math.max(0, Math.floor((Date.now() - Date.parse(created + "T00:00:00Z")) / 86400000)) : null;
async function domainAge(host, opt) {
  opt = opt || {};
  const d = regDomain(host); if (!d) return null;
  const cache = get("domAge", {}) || {}, c = cache[d];
  if (c && Date.now() - c.at < 7 * 86400000) return Object.assign({ d, days:ageDays(c.created) }, c);
  let r = null;
  const s = server();
  if (s) try {
    const res = await fetch(s + "/domain?d=" + encodeURIComponent(d), { cache:"no-store" });
    const j = res.ok ? await res.json() : null;
    if (j && j.ok) r = { created:j.created || "", expires:j.expires || "", registrar:j.registrar || "", none:!!j.none };
  } catch (e) {}
  if (!r) try {
    const text = opt.fetchText ? await opt.fetchText("https://rdap.org/domain/" + d) : await (await fetch("https://rdap.org/domain/" + d)).text();
    r = parseRdap(JSON.parse(text));
  } catch (e) {}
  if (!r) return null;
  r.at = Date.now();
  const keep = Object.entries(Object.assign(cache, { [d]:r })).sort((a, b) => b[1].at - a[1].at).slice(0, 300);
  put("domAge", Object.fromEntries(keep));
  return Object.assign({ d, days:ageDays(r.created) }, r);
}

/* ---------------------------------------------------------------- is this shop fake? */
// big shops everyone knows: never warned about
const KNOWN = /(^|\.)(amazon|ebay|walmart|target|bestbuy|etsy|aliexpress|alibaba|temu|shein|ikea|apple|nike|adidas|zalando|otto|asos|hm|zara|uniqlo|costco|homedepot|lowes|wayfair|newegg|argos|tesco|currys|johnlewis|boots|mediamarkt|saturn|fnac|cdiscount|bol|coolblue|allegro|rakuten|mercadolibre|flipkart|jd|taobao|tmall|samsung|microsoft|google|sony|nintendo|playstation|xbox|steampowered|lego|decathlon|lidl|aldi|carrefour|kohls|macys|nordstrom|sephora|ulta|chewy|wish|shopify|bandcamp|gumroad)\.[a-z.]+$/;
const BRANDS = ["nike", "adidas", "jordan", "yeezy", "rayban", "ray-ban", "oakley", "ugg", "pandora", "lego", "dyson", "northface", "thenorthface", "canadagoose", "moncler",
  "lululemon", "louisvuitton", "gucci", "prada", "rolex", "omega", "cartier", "chanel", "dior", "hermes", "balenciaga", "versace", "michaelkors", "coach", "katespade",
  "converse", "vans", "newbalance", "asics", "puma", "reebok", "skechers", "crocs", "birkenstock", "drmartens", "timberland", "stanley", "yeti", "hydroflask", "airpods",
  "iphone", "ipad", "macbook", "samsung", "galaxy", "playstation", "ps5", "xbox", "nintendo", "switch2", "gopro", "bose", "beats", "jbl", "sonos", "garmin", "fitbit",
  "patagonia", "arcteryx", "columbia", "levis", "tommy", "hilfiger", "calvinklein", "ralphlauren", "lacoste", "hugoboss", "swarovski", "tiffany", "longchamp", "lancome",
  "esteelauder", "clinique", "ikea", "kitchenaid", "lecreuset", "nespresso", "philips", "makita", "dewalt", "bosch", "milwaukee", "traeger", "weber", "shimano", "trek"];
const SHOPWORDS = /(outlet|sale|sales|discount|cheap|clearance|factory|deal|deals|official|store|shop|offer|offers|online|mall|promo|bargain|black-?friday)/;
const RISKY_END = /\.(shop|store|top|xyz|online|site|buzz|click|icu|vip|club|live|cyou|sbs|bond|cfd|monster|rest|quest|fun|lat|best|space|website|today|world|life|tokyo|cc|ws|su|mom|beauty|hair|skin|boutique|fashion|sale|deals|discount)$/;
function hostSigns(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, ""), d = regDomain(h), name = d.split(".")[0] || "", out = [];
  if (!d || KNOWN.test(d)) return { known:!!d && KNOWN.test(d), d, signs:out };
  const flat = name.replace(/-/g, "");
  const brand = BRANDS.find(b => flat.indexOf(b.replace(/-/g, "")) >= 0 && flat !== b.replace(/-/g, ""));
  if (brand && (SHOPWORDS.test(name) || /-/.test(name) || /\d/.test(name))) out.push({ k:"brand", w:2, t:"The address has “" + brand + "” in it, but it isn't " + brand + "'s own website" });
  if (RISKY_END.test(d)) out.push({ k:"end", w:1, t:"It ends in “." + d.split(".").pop() + "”, an ending many short-lived shops use" });
  if ((name.match(/-/g) || []).length >= 2 || /\d{3,}/.test(name)) out.push({ k:"name", w:1, t:"The name looks made up in a hurry (" + d + ")" });
  return { known:false, d, signs:out };
}
function shopVerdict(sig, age, host) {
  sig = sig || {};
  const hs = hostSigns(host || sig.host || "");
  const reasons = [], good = [];
  let score = 0;
  const add = (w, t) => { score += w; reasons.push(t); };
  if (hs.known) return { level:"ok", score:0, reasons:[], good:["A big shop everyone knows"], known:true };
  hs.signs.forEach(s => add(s.w, s.t));
  const days = age && age.days != null ? age.days : null;
  if (days != null) {
    if (days < 90) add(3, "The website was registered only " + (days < 2 ? "a day" : days + " days") + " ago" + (age.created ? " (" + age.created + ")" : ""));
    else if (days < 365) add(1, "The website is less than a year old (registered " + age.created + ")");
    else if (days > 5 * 365) { score -= 2; good.push("The website has been around since " + age.created.slice(0, 4)); }
    else good.push("The website is " + Math.floor(days / 365) + " year" + (days >= 730 ? "s" : "") + " old");
  }
  if (sig.deals >= 3) add(2, "Lots of huge discounts (" + sig.deals + " of 70% off or more)");
  else if (sig.deals >= 1) add(1, "Discounts of 70% off or more");
  const trust = Array.isArray(sig.trust) ? sig.trust : [];
  if (sig.shop && trust.length === 0) add(2, "No contact, returns or about pages linked");
  else if (sig.shop && trust.length === 1) add(1, "Hardly any contact, returns or about pages (only " + trust[0] + ")");
  else if (trust.length >= 3) good.push("Has " + trust.slice(0, 4).join(", ") + " pages");
  if (sig.payRisky && !sig.payOk) add(2, "Asks for payment by " + sig.payRisky + ", which you can't get back if something goes wrong");
  else if (sig.payOk) good.push("Mentions payment you can dispute (" + sig.payOk + ")");
  if (sig.urgency) add(1, "Pressure to buy now (“" + String(sig.urgency).slice(0, 50) + "”)");
  if (sig.freeMail) add(1, "Contact is a free email address (" + String(sig.freeMail).slice(0, 60) + ")");
  if (sig.https === false) add(1, "The connection isn't secure (no https)");
  const level = score >= 5 ? "warn" : score >= 3 ? "careful" : "ok";
  return { level, score, reasons, good, days };
}

/* ---------------------------------------------------------------- what sites see about you */
async function whoami() {
  const s = server(); if (!s) return null;
  try { const r = await fetch(s + "/whoami", { cache:"no-store" }); const j = r.ok ? await r.json() : null; return j && j.ok ? j : null; } catch (e) { return null; }
}
async function hash(s) {
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 6).map(x => x.toString(16).padStart(2, "0")).join(""); }
  catch (e) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
}
// what this device answers to any page's script (the iPhone app's own view; on Windows the page tool's)
async function local() {
  const n = navigator, o = {};
  o.ua = n.userAgent; o.lang = (n.languages || [n.language]).join(", "); o.platform = n.platform || "";
  o.tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || ""; o.tzOff = -new Date().getTimezoneOffset();
  o.screen = screen.width + " × " + screen.height; o.dpr = devicePixelRatio || 1; o.depth = screen.colorDepth;
  o.cores = n.hardwareConcurrency || 0; o.mem = n.deviceMemory || 0; o.touch = n.maxTouchPoints || 0;
  o.dnt = n.doNotTrack === "1" || window.doNotTrack === "1"; o.gpc = !!n.globalPrivacyControl; o.cookies = !!n.cookieEnabled;
  o.battery = typeof n.getBattery === "function";
  o.dark = !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  try {
    const c = document.createElement("canvas"); c.width = 220; c.height = 40; const g = c.getContext("2d");
    g.textBaseline = "top"; g.font = "16px Arial"; g.fillStyle = "#f60"; g.fillRect(100, 1, 60, 20); g.fillStyle = "#069"; g.fillText("Webs 🕸️ fingerprint", 2, 15);
    o.canvas = await hash(c.toDataURL());
  } catch (e) { o.canvas = ""; }
  try {
    const gl = document.createElement("canvas").getContext("webgl"), ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    o.gpu = gl ? String(gl.getParameter(ext ? 37446 : gl.RENDERER) || "") : "";
  } catch (e) { o.gpu = ""; }
  return o;
}
function seen(o) {
  o = o || {}; const p = o.page || {}, ip = o.ip || null, fp = !!o.fp, L = [];
  const row = (g, k, v, tip, safe) => { if (v !== "" && v != null) L.push({ g, k, v:String(v), tip:tip || "", safe:!!safe }); };
  if (ip) {
    row("Your internet address", "Address (IP)", ip.ip, o.vpn ? "Through the VPN: sites see the VPN's address." : "Every site gets this. A VPN hides it.", !!o.vpn);
    row("Your internet address", "Roughly where you are", [ip.city, ip.region, ip.country].filter(Boolean).join(", "), "Worked out from the address, usually to the town.", !!o.vpn);
    row("Your internet address", "Your internet company", ip.isp, "", !!o.vpn);
  } else row("Your internet address", "Address (IP)", o.ipWhy || "Couldn't check it (Web AI's server isn't connected)", "");
  row("Your device", "Browser", p.ua, "Sent with every page: the browser, its version and the system.");
  row("Your device", "Languages", p.lang, "");
  row("Your device", "Time zone", p.tz ? p.tz + " (UTC" + (p.tzOff >= 0 ? "+" : "−") + Math.abs(p.tzOff / 60) + ")" : "", "Gives away roughly where you are, even with a VPN.");
  row("Your device", "Screen", p.screen ? p.screen + (p.dpr && p.dpr !== 1 ? " at " + p.dpr + "×" : "") : "", "");
  row("Your device", "Processor cores", p.cores || "", fp ? "Fingerprint protection gives every site the same common number." : "", fp);
  row("Your device", "Memory", p.mem ? p.mem + " GB (rounded)" : "", fp ? "Made common by fingerprint protection." : "", fp);
  row("Your device", "Touch screen", p.touch ? "Yes (" + p.touch + " points)" : "No", "");
  row("Your device", "Dark mode", p.dark ? "On" : "Off", "");
  row("Your device", "Battery level", p.battery ? "Readable" : "Hidden", p.battery ? "Sites can read the charge, which helps track you for a few minutes." : "", !p.battery);
  row("Fingerprint", "Canvas drawing", p.canvas ? "ID " + p.canvas : "", fp ? "Changes every session with fingerprint protection, so it can't follow you." : "The same on every site: it can follow you even without cookies.", fp);
  row("Fingerprint", "Graphics card", p.gpu, fp ? "Fingerprint protection shows a generic one." : "Narrows down which computer you have.", fp);
  if (p.fonts != null) row("Fingerprint", "Fonts it can find", p.fonts + " of 30 tested", "Unusual fonts make you easier to pick out.");
  row("Privacy signals", "Do Not Track", p.dnt ? "On" : "Off", "Most sites ignore it.", p.dnt);
  row("Privacy signals", "Global Privacy Control", p.gpc ? "On" : "Off", "Legally binding in some places.", p.gpc);
  if (p.cookieN != null) row("This site", "Cookies it set", p.cookieN, "The ones its scripts can read.");
  if (p.storeN != null) row("This site", "Things it stored", p.storeN, "");
  if (p.thirdN != null) row("This site", "Other companies on the page", p.thirdN + (p.third && p.third.length ? ": " + p.third.slice(0, 6).join(", ") + (p.third.length > 6 ? "…" : "") : ""), "Each one sees that you're here.");
  if (p.perms) Object.keys(p.perms).forEach(k => row("This site", "Permission: " + k, p.perms[k] === "granted" ? "Allowed" : p.perms[k] === "denied" ? "Blocked" : "Asks first", "", p.perms[k] !== "granted"));
  return L;
}
function render(el, list, foot) {
  let g = "", h = "";
  list.forEach(r => {
    if (r.g !== g) { g = r.g; h += '<div class="pvg">' + esc(g) + "</div>"; }
    h += '<div class="pvr' + (r.safe ? " safe" : "") + '"><div class="pvk">' + esc(r.k) + (r.safe ? ' <i title="Protected">🛡️</i>' : "") + '</div><div class="pvv">' + esc(r.v) + "</div>" + (r.tip ? '<div class="pvt">' + esc(r.tip) + "</div>" : "") + "</div>";
  });
  el.innerHTML = h + (foot ? '<div class="pvfoot">' + foot + "</div>" : "");
}
const CSS = ".pvg{margin:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.6}.pvr{padding:7px 0;border-bottom:1px solid rgba(128,128,128,.18)}" +
  ".pvk{font-size:12px;opacity:.75}.pvv{font-size:13.5px;word-break:break-word}.pvt{font-size:11.5px;opacity:.6;margin-top:1px}.pvr.safe .pvv{color:#3fb971}.pvfoot{margin-top:12px;font-size:12px;opacity:.75}";
window.Privacy = { regDomain, domainAge, parseRdap, ageDays, hostSigns, shopVerdict, whoami, local, seen, render, CSS, esc, KNOWN };
})();
