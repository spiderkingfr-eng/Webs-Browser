/* Webs Browser for iPhone - more for the address bar: dozens of new bangs,
   your own search engines and keywords, recent searches, calculator history,
   inline completion, voice input, and new instant answers (BMI, age, loans,
   interest, text tools, encoders, roman numerals, timestamps, hashes, lorem
   ipsum, emoji, Wikipedia, translation, your IP, a week's forecast, quick
   notes and to-dos, percent change, picking for you, days between dates,
   numbers in words and QR codes). */
"use strict";

/* ---------------------------------------------------------------- bangs
   A bang searches one site, just this once: "!yt lofi", "!gh webs". They are
   kept apart from the search engines you can choose in Settings. */
const MORE_BANGS = [
  ["yt", "YouTube", "https://www.youtube.com/results?search_query="], ["ytm", "YouTube Music", "https://music.youtube.com/search?q="],
  ["gh", "GitHub", "https://github.com/search?q="], ["r", "Reddit", "https://www.reddit.com/search/?q="], ["a", "Amazon", "https://www.amazon.com/s?k="],
  ["m", "Google Maps", "https://www.google.com/maps/search/"], ["maps", "Google Maps", "https://www.google.com/maps/search/"],
  ["gi", "Google Images", "https://www.google.com/search?tbm=isch&q="], ["gn", "Google News", "https://news.google.com/search?q="],
  ["so", "Stack Overflow", "https://stackoverflow.com/search?q="], ["mdn", "MDN Web Docs", "https://developer.mozilla.org/en-US/search?q="],
  ["npm", "npm", "https://www.npmjs.com/search?q="], ["py", "PyPI", "https://pypi.org/search/?q="], ["x", "X", "https://x.com/search?q="],
  ["tw", "X", "https://x.com/search?q="], ["imdb", "IMDb", "https://www.imdb.com/find/?q="], ["wa", "Wolfram Alpha", "https://www.wolframalpha.com/input?i="],
  ["ud", "Urban Dictionary", "https://www.urbandictionary.com/define.php?term="], ["tr", "Google Translate", "https://translate.google.com/?sl=auto&op=translate&text="],
  ["ebay", "eBay", "https://www.ebay.com/sch/i.html?_nkw="], ["spot", "Spotify", "https://open.spotify.com/search/"], ["sc", "SoundCloud", "https://soundcloud.com/search?q="],
  ["tt", "TikTok", "https://www.tiktok.com/search?q="], ["pin", "Pinterest", "https://www.pinterest.com/search/pins/?q="], ["twitch", "Twitch", "https://www.twitch.tv/search?term="],
  ["steam", "Steam", "https://store.steampowered.com/search/?term="], ["itch", "itch.io", "https://itch.io/search?q="], ["genius", "Genius", "https://genius.com/search?q="],
  ["mal", "MyAnimeList", "https://myanimelist.net/search/all?q="], ["wt", "Wiktionary", "https://en.wiktionary.org/w/index.php?search="],
  ["dict", "Merriam-Webster", "https://www.merriam-webster.com/dictionary/"], ["th", "Thesaurus", "https://www.thesaurus.com/browse/"],
  ["hn", "Hacker News", "https://hn.algolia.com/?q="], ["q", "Quora", "https://www.quora.com/search?q="], ["yh", "Yahoo", "https://search.yahoo.com/search?p="],
  ["k", "Kagi", "https://kagi.com/search?q="], ["perp", "Perplexity", "https://www.perplexity.ai/search?q="], ["cg", "ChatGPT", "https://chatgpt.com/?q="],
  ["arch", "Wayback Machine", "https://web.archive.org/web/*/"], ["apple", "Apple", "https://www.apple.com/us/search/"], ["etsy", "Etsy", "https://www.etsy.com/search?q="],
  ["walmart", "Walmart", "https://www.walmart.com/search?q="], ["fandom", "Fandom", "https://community.fandom.com/wiki/Special:Search?query="]
];
MORE_BANGS.forEach(([k, name, url]) => {
  const id = "bang_" + k;
  if (!ENGINES[id]) ENGINES[id] = { name, url, bang:true };
  BANGS["!" + k] = id;
});
// The engines you can pick (bang-only sites stay out of the list).
const engineKeys = () => Object.keys(ENGINES).filter(k => !ENGINES[k].bang);

/* ---------------------------------------------------------------- your own search engines (cfg.myEngines) */
function loadMyEngines() {
  Object.keys(ENGINES).forEach(k => { if (ENGINES[k].mine) delete ENGINES[k]; });
  (Array.isArray(cfg.myEngines) ? cfg.myEngines : []).forEach(e => {
    if (!e || !e.id || !/^https?:\/\/.+%s/.test(e.url || "")) return;
    const i = e.url.indexOf("%s");
    ENGINES[e.id] = { name:e.name, url:e.url.slice(0, i), tpl:e.url, mine:true };
  });
}
loadMyEngines();
function openEngines() {
  const list = Array.isArray(cfg.myEngines) ? cfg.myEngines : [];
  openSheet("Your search engines", (list.length ? '<div class="card">' + list.map(e => '<div class="srow"><span class="k">' + esc(e.name) + "<i>" + esc(e.url) + '</i></span><button type="button" class="hbtn plain" data-del="' +
    esc(e.id) + '">Remove</button></div>').join("") + "</div>" : '<div class="empty">' + ico("glass") + "Add any site's search: Webs puts what you type where %s is.</div>") +
    '<div class="acts"><button type="button" class="btnx m" id="engAdd">' + ico("plus") + 'Add a search engine</button></div><p class="note" style="margin:12px 6px">For example <b>https://www.bing.com/search?q=%s</b>. Search on the site once, copy the address from Safari and replace your search words with %s.</p>',
    { kind:"engines", full:true, back:() => openSettings() });
  $("#engAdd").onclick = () => ask({ title:"Add a search engine", fields:[{ k:"n", label:"Name", ph:"e.g. Kagi" }, { k:"u", label:"Address with %s", ph:"https://example.com/search?q=%s", type:"url" }], ok:"Add" }, v => {
    let u = v.u.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    if (!/%s/.test(u)) { toast("Put %s where the search words go"); return false; }
    try { new URL(u.replace("%s", "x")); } catch (e) { toast("That address doesn't look right"); return false; }
    const e = { id:"my_" + uid(), name:v.n.trim().slice(0, 30) || hostOf(u.replace("%s", "x")), url:u };
    setCfg("myEngines", list.concat([e])); loadMyEngines(); setCfg("search", e.id); openEngines(); toast(e.name + " is now your search engine");
  });
  $("#sheetBody").onclick = e => {
    const d = e.target.closest("[data-del]"); if (!d) return;
    setCfg("myEngines", list.filter(x => x.id !== d.dataset.del)); if (cfg.search === d.dataset.del) setCfg("search", "ddg");
    loadMyEngines(); openEngines();
  };
}
SETACTIONS.addEngine = openEngines;

/* ---------------------------------------------------------------- keywords (cfg.keywords, the same list as on Windows) */
function openKeywords() {
  const list = keywords();
  openSheet("Keywords", '<p class="note" style="margin:0 6px 12px">Type a keyword, a space and your search: <b>yt lofi</b> searches YouTube.</p><div class="card">' +
    list.map((k, i) => '<div class="srow"><span class="kw">' + esc(k.k) + '</span><span class="k">' + esc(k.n) + "<i>" + esc(k.u) + '</i></span><button type="button" class="hbtn plain" data-kdel="' + i + '">Remove</button></div>').join("") +
    '</div><div class="acts"><button type="button" class="btnx m" id="kwAdd">' + ico("plus") + 'Add keyword</button><button type="button" class="btnx" id="kwReset">' + ico("undo") + "Reset</button></div>",
    { kind:"keywords", full:true, back:() => openSettings() });
  $("#kwAdd").onclick = () => ask({ title:"Add keyword", fields:[{ k:"k", label:"Keyword", ph:"e.g. pin" }, { k:"n", label:"Name", ph:"e.g. Pinterest" },
    { k:"u", label:"Address with %s", ph:"https://www.pinterest.com/search/pins/?q=%s", type:"url" }], ok:"Add" }, v => {
    const k = v.k.trim().toLowerCase(); let u = v.u.trim();
    if (!/^\S{1,12}$/.test(k)) { toast("A keyword is one short word"); return false; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    if (!/%s/.test(u)) { toast("Put %s where the search words go"); return false; }
    setCfg("keywords", keywords().filter(x => x.k !== k).concat([{ k, n:v.n.trim() || hostOf(u.replace("%s", "x")), u }])); openKeywords();
  });
  $("#kwReset").onclick = () => { setCfg("keywords", null); openKeywords(); toast("Keywords reset"); };
  $("#sheetBody").onclick = e => { const d = e.target.closest("[data-kdel]"); if (!d) return; const l = keywords().slice(); l.splice(+d.dataset.kdel, 1); setCfg("keywords", l); openKeywords(); };
}
SETACTIONS.keywords = openKeywords;
function openBangs() {
  const list = Object.keys(BANGS).map(b => [b, ENGINES[BANGS[b]] && ENGINES[BANGS[b]].name]).filter(x => x[1]).sort((a, b) => a[0].localeCompare(b[0]));
  openSheet("Bangs", '<p class="note" style="margin:0 6px 12px">Start a search with a bang to use that site just once: <b>!yt lofi</b>, <b>!gh webs</b>, <b>!wa 2^64</b>.</p><div class="card bangs">' +
    list.map(([b, n]) => '<button type="button" class="srow btn" data-bang="' + esc(b) + '"><span class="kw">' + esc(b) + '</span><span class="k">' + esc(n) + "</span></button>").join("") + "</div>",
    { kind:"bangs", full:true, back:$("#sheet").dataset.kind === "settings" ? () => openSettings() : null });
  $("#sheetBody").onclick = e => { const b = e.target.closest("[data-bang]"); if (b) { closeSheet(); setTimeout(() => openOmni(b.dataset.bang + " "), 220); } };
}
SETACTIONS.bangs = openBangs;

/* ---------------------------------------------------------------- recent searches and calculator history */
OMNI_EMPTY.push(() => {
  if (PRIVATE) return "";
  const seen = new Set(), qs = [];
  for (const h of load("history", [])) {
    const s = searchOf(h.u);
    if (!s || seen.has(s.q.toLowerCase())) continue;
    seen.add(s.q.toLowerCase()); qs.push(s.q);
    if (qs.length >= 8) break;
  }
  const calcs = load("calcs", []).slice(0, 5);
  return (qs.length ? '<div class="sec">Recent searches</div><div class="chips wrapc">' + qs.map(q => '<button type="button" data-rq="' + esc(q) + '">' + ico("history") + esc(q.slice(0, 40)) + "</button>").join("") + "</div>" : "") +
    (calcs.length ? '<div class="sec">Calculator history</div><div class="card">' + calcs.map(c => '<button type="button" class="row" data-calc="' + esc(c.q) + '"><span class="fav">' + ico("keypad") +
      '</span><span class="tx"><b>' + esc(c.r) + "</b><i>" + esc(c.q) + "</i></span></button>").join("") + "</div>" : "") +
    '<div class="chips"><button type="button" data-open="tools">' + ico("tools") + 'Tools</button><button type="button" data-open="clips">' + ico("paste") + 'Copy history</button><button type="button" data-open="bangsList">' + ico("sparkle") + "Bangs</button></div>";
});
$("#omniList").addEventListener("click", e => {
  const rq = e.target.closest("[data-rq]"), c = e.target.closest("[data-calc]");
  if (rq) go(rq.dataset.rq);
  else if (c) { $("#q").value = c.dataset.calc; $("#q").focus(); omniRender(); }
});
function saveCalc(q, r) {
  if (PRIVATE || !q || !r) return;
  const l = load("calcs", []).filter(x => x.q !== q);
  l.unshift({ q, r, ts:Date.now() });
  save("calcs", l.slice(0, 10));
}
runRow = (orig => function (r) {
  if (r && r.copy != null && /^= /.test(r.t || "")) saveCalc($("#q").value.trim(), r.t.slice(2));
  orig(r);
})(runRow);
$("#omniForm").addEventListener("submit", () => {
  const r = rows[0];
  if (r && r.big && r.copy != null && /^= /.test(r.t || "")) saveCalc($("#q").value.trim(), r.t.slice(2));
}, true);

/* ---------------------------------------------------------------- inline completion: "yo" becomes "youtube.com" as you type */
function knownHosts() {
  const n = new Map();
  const add = (u, w) => { const h = hostOf(u); if (h && !searchOf(u)) n.set(h, (n.get(h) || 0) + w); };
  load("history", []).slice(0, 1500).forEach(h => add(h.u, 1));
  load("bookmarks", []).forEach(b => add(b.u, 5));
  load("tiles", []).forEach(t => add(t.u, 8));
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
let hostsCache = null, hostsAt = 0;
$("#omniForm").addEventListener("input", e => {
  const q = $("#q");
  if (e.target !== q || e.inputType !== "insertText" || PRIVATE) return;
  const v = q.value;
  if (v.length < 2 || /\s|\//.test(v) || q.selectionStart !== v.length) return;
  if (!hostsCache || Date.now() - hostsAt > 30000) { hostsCache = knownHosts(); hostsAt = Date.now(); }
  const l = v.toLowerCase(), h = hostsCache.find(x => x.startsWith(l) && x !== l);
  if (!h) return;
  q.value = v + h.slice(v.length);
  try { q.setSelectionRange(v.length, h.length); } catch (x) {}
}, true);

/* ---------------------------------------------------------------- voice */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function voiceSearch(btn) {
  if (rec) { try { rec.stop(); } catch (e) {} return; }
  if (!SpeechRec) {
    openOmni("");
    toast("Tap the microphone on your keyboard to talk");
    return;
  }
  if ($("#omni").classList.contains("hide")) openOmni("");
  const q = $("#q");
  try {
    rec = new SpeechRec();
    rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
    $("#qMic").classList.add("on"); document.body.classList.add("listening");
    q.placeholder = "Listening…";
    rec.onresult = e => {
      let txt = "", fin = false;
      for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) fin = true; }
      q.value = txt.trim(); omniRender();
      if (fin && txt.trim()) setTimeout(() => { if ($("#q").value.trim() === txt.trim()) go(txt.trim()); }, 500);
    };
    rec.onerror = e => { if (e.error === "not-allowed") toast("Webs wasn't allowed to use the microphone"); };
    rec.onend = () => { rec = null; $("#qMic").classList.remove("on"); document.body.classList.remove("listening"); q.placeholder = "Search or enter website"; };
    rec.start();
  } catch (e) { rec = null; toast("Voice search isn't available right now"); }
}
(function micButtons() {
  const b = document.createElement("button");
  b.type = "button"; b.id = "qMic"; b.setAttribute("aria-label", "Search by voice"); b.innerHTML = ico("mic");
  $("#qClear").before(b);
  b.onclick = () => voiceSearch();
  $("#heroMic").innerHTML = ico("mic");
  $("#heroMic").onclick = () => voiceSearch();
})();

/* ---------------------------------------------------------------- new instant answers */
const num = s => { s = String(s).replace(/,/g, "").toLowerCase(); const k = /k$/.test(s) ? 1e3 : /m$/.test(s) ? 1e6 : 1; return parseFloat(s) * k; };
const money = v => (+v).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
const asyncCache = {};
// For answers that need the network: looked up once you pause, then shown.
function later(key, q, job, delay) {
  const c = asyncCache[key];
  if (c === undefined) {
    asyncCache[key] = null;
    setTimeout(() => {
      if ($("#q").value.trim() !== q && $("#omni").classList.contains("hide") === false) { delete asyncCache[key]; return; }
      Promise.resolve().then(job).then(v => { asyncCache[key] = v || false; onAnswerReady(q); }, () => { asyncCache[key] = false; onAnswerReady(q); });
    }, delay == null ? 400 : delay);
  }
  return asyncCache[key];
}

function bmi(s) {
  const m = /^bmi\s+(.+)$/i.exec(s); if (!m) return null;
  const t = m[1].toLowerCase().replace(/\s+/g, " ");
  let h = null, w = null, x;
  if ((x = /(\d+(?:\.\d+)?)\s*cm/.exec(t))) h = x[1] / 100;
  else if ((x = /(\d(?:\.\d+)?)\s*m\b/.exec(t))) h = +x[1];
  else if ((x = /(\d)\s*(?:'|ft|feet)\s*(\d{1,2})?\s*(?:"|in|inches)?/.exec(t))) h = (x[1] * 12 + +(x[2] || 0)) * .0254;
  else if ((x = /(\d{2})\s*(?:in|inches|")/.exec(t))) h = x[1] * .0254;
  if ((x = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)/.exec(t))) w = +x[1];
  else if ((x = /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)/.exec(t))) w = x[1] * .45359237;
  if (!h || !w || h < .5 || h > 2.6) return null;
  const v = w / (h * h), cat = v < 18.5 ? "underweight" : v < 25 ? "a healthy weight" : v < 30 ? "overweight" : "obese";
  return ans("bmi", "BMI " + v.toFixed(1), "That's " + cat + " on the standard scale (18.5–24.9 is healthy) · Tap to copy", { copy:v.toFixed(1) });
}
function age(s, now) {
  const m = /^(?:age|how old (?:am i|is someone)(?: born)?(?: on)?|born(?: on)?)\s+(.+?)\??$/i.exec(s); if (!m) return null;
  const d = parseDay(m[1].replace(/^on\s+/i, ""), now);
  if (!d || d > now || !/\d{4}|\/\d{2,4}$/.test(m[1])) return null;
  let y = now.getFullYear() - d.getFullYear(), mo = now.getMonth() - d.getMonth(), dd = now.getDate() - d.getDate();
  if (dd < 0) { mo--; dd += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (mo < 0) { y--; mo += 12; }
  let nb = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (nb < new Date(now.getFullYear(), now.getMonth(), now.getDate())) nb = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  const until = Math.round((nb - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  return ans("age", y + " years, " + mo + " months, " + dd + " days old", (until === 0 ? "🎂 Happy birthday! · " : "Next birthday in " + until + " days · ") + fmtN(Math.floor((now - d) / 864e5), 0) + " days so far · Tap to copy", { copy:String(y) });
}
function loan(s) {
  const m = /^(?:loan|mortgage|car loan|payment(?: on)?)\s+\$?([\d.,]+k?m?)\s+(?:at\s+)?([\d.]+)\s*%\s+(?:for\s+|over\s+)?(\d+)\s*(years?|yrs?|y|months?|mo)$/i.exec(s);
  if (!m) return null;
  const P = num(m[1]), r = m[2] / 100 / 12, n = /^m/i.test(m[4]) ? +m[3] : m[3] * 12;
  if (!(P > 0) || !(n > 0) || n > 1200) return null;
  const pay = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
  return ans("loan", money(pay) + " a month", n + " payments on " + money(P) + " at " + m[2] + "% · total interest " + money(pay * n - P) + " · Tap to copy", { copy:pay.toFixed(2) });
}
function interest(s) {
  const m = /^(?:invest(?:ing)?\s+|compound\s+(?:interest\s+)?(?:on\s+)?)?\$?([\d.,]+k?m?)\s+at\s+([\d.]+)\s*%\s+(?:for\s+)?(\d+)\s*(?:years?|yrs?)(\s+monthly)?$/i.exec(s);
  if (!m) return null;
  const P = num(m[1]), r = m[2] / 100, y = +m[3], k = m[4] ? 12 : 1;
  if (!(P > 0) || y > 200) return null;
  const v = P * Math.pow(1 + r / k, k * y);
  return ans("int", "= " + money(v), money(P) + " at " + m[2] + "% for " + y + " years, compounded " + (k === 12 ? "monthly" : "yearly") + " · grows by " + money(v - P) + " · Tap to copy", { copy:v.toFixed(2) });
}
function textTools(s) {
  let m = /^(?:count|wc|word count|character count|char count)[:\s]+([\s\S]+)$/i.exec(s);
  if (m) {
    const t = m[1], w = (t.match(/\S+/g) || []).length;
    return ans("wc", w + (w === 1 ? " word" : " words") + " · " + t.length + " characters", t.replace(/\s/g, "").length + " without spaces · about " + Math.max(1, Math.round(w / 230)) + " min to read", { copy:String(w) });
  }
  m = /^(upper(?:case)?|lower(?:case)?|title(?: case)?|sentence(?: case)?|snake(?:_| )?case|camel(?: )?case|kebab(?:-| )?case|reverse|slug(?:ify)?)[:\s]+([\s\S]+)$/i.exec(s);
  if (m) {
    const k = m[1].toLowerCase(), t = m[2], words = t.toLowerCase().match(/[a-z0-9]+/g) || [];
    const v = k.startsWith("upper") ? t.toUpperCase() : k.startsWith("lower") ? t.toLowerCase() : k.startsWith("title") ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) :
      k.startsWith("sentence") ? t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()) : k.startsWith("snake") ? words.join("_") :
      k.startsWith("camel") ? words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join("") : k.startsWith("reverse") ? [...t].reverse().join("") : words.join("-");
    return ans("case", v, "Tap to copy", { copy:v, wrap:1 });
  }
  m = /^(base64(?: encode)?|base64 decode|unbase64|b64|url ?encode|url ?decode)[:\s]+([\s\S]+)$/i.exec(s);
  if (m) {
    const k = m[1].toLowerCase(), t = m[2];
    try {
      let v;
      if (k === "base64 decode" || k === "unbase64") v = new TextDecoder().decode(Uint8Array.from(atob(t.trim()), c => c.charCodeAt(0)));
      else if (k.startsWith("base64") || k === "b64") v = btoa(String.fromCharCode(...new TextEncoder().encode(t)));
      else if (/decode/.test(k)) v = decodeURIComponent(t.replace(/\+/g, " "));
      else v = encodeURIComponent(t);
      return ans("enc", v, k.replace(/ ?(en|de)code/, " $1coded").replace(/^b64$/, "base64") + " · Tap to copy", { copy:v, wrap:1 });
    } catch (e) { return ans("enc", "That isn't valid " + (/url/.test(k) ? "URL encoding" : "base64"), "Check what you typed"); }
  }
  return null;
}
const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(s) {
  let m = /^(?:roman(?: numerals?)?\s+(\d{1,4})|(\d{1,4})\s+(?:in|to)\s+roman(?: numerals?)?)$/i.exec(s);
  if (m) {
    let n = +(m[1] || m[2]), out = "";
    if (n < 1 || n > 3999) return null;
    ROMAN.forEach(([v, r]) => { while (n >= v) { out += r; n -= v; } });
    return ans("roman", out, (m[1] || m[2]) + " in Roman numerals · Tap to copy", { copy:out });
  }
  m = /^(?:roman\s+([mdclxvi]+)|([mdclxvi]+)\s+(?:to|in)\s+(?:a )?(?:number|decimal|arabic))$/i.exec(s);
  if (m) {
    const r = (m[1] || m[2]).toUpperCase(); let n = 0, i = 0;
    ROMAN.forEach(([v, sym]) => { while (r.startsWith(sym, i)) { n += v; i += sym.length; } });
    if (i !== r.length) return null;
    return ans("roman", String(n), r + " as a number · Tap to copy", { copy:String(n) });
  }
  return null;
}
function unixTime(s, now) {
  if (/^(?:unix|epoch|timestamp)(?: time)?(?: now)?$|^(?:now|current time) (?:in|as) (?:unix|epoch|a timestamp)$/i.test(s)) {
    const v = Math.floor(now / 1000); return ans("unix", String(v), "Unix time now (seconds since 1970) · Tap to copy", { copy:String(v) });
  }
  const m = /^(?:unix|epoch|timestamp)\s+(\d{9,13})$/i.exec(s);
  if (m) {
    const ms = m[1].length > 11 ? +m[1] : m[1] * 1000, d = new Date(ms);
    return ans("unix", d.toLocaleString([], { dateStyle:"full", timeStyle:"medium" }), d.toISOString() + " · Tap to copy", { copy:d.toISOString(), wrap:1 });
  }
  return null;
}
function hashAns(s) {
  const m = /^(sha-?1|sha-?256|sha-?384|sha-?512)[:\s]+([\s\S]+)$/i.exec(s);
  if (!m || !(window.crypto && crypto.subtle)) return null;
  const alg = "SHA-" + m[1].replace(/\D/g, ""), key = "hash|" + alg + "|" + m[2];
  const v = later(key, s, async () => [...new Uint8Array(await crypto.subtle.digest(alg, new TextEncoder().encode(m[2])))].map(b => b.toString(16).padStart(2, "0")).join(""), 0);
  if (!v) return ans("hash", "Working out the " + alg + "…", "Hash");
  return ans("hash", v, alg + " of “" + m[2].slice(0, 40) + "” · Tap to copy", { copy:v, wrap:1 });
}
const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum".split(" ");
function lorem(s) {
  const m = /^lorem(?: ipsum)?(?:\s+(\d{1,3})\s*(words?|paragraphs?|sentences?)?)?$/i.exec(s);
  if (!m) return null;
  const n = Math.min(+(m[1] || 1), 50), unit = (m[2] || (m[1] ? "paragraphs" : "paragraph")).toLowerCase();
  const words = k => Array.from({ length:k }, (_, i) => LOREM[i % LOREM.length]).join(" ");
  const sentence = i => { const st = (i * 7) % LOREM.length, t = Array.from({ length:8 + i % 6 }, (_, j) => LOREM[(st + j) % LOREM.length]).join(" "); return t[0].toUpperCase() + t.slice(1) + "."; };
  let v;
  if (unit.startsWith("word")) { const w = words(n); v = w[0].toUpperCase() + w.slice(1) + "."; }
  else if (unit.startsWith("sent")) v = Array.from({ length:n }, (_, i) => sentence(i)).join(" ");
  else v = Array.from({ length:n }, (_, p) => Array.from({ length:5 }, (_, i) => sentence(i + p * 5)).join(" ")).join("\n\n");
  return ans("lorem", v.length > 160 ? v.slice(0, 160) + "…" : v, "Placeholder text: " + n + " " + unit.replace(/s?$/, n === 1 ? "" : "s") + " · Tap to copy", { copy:v, wrap:1 });
}
const EMOJI = ("😀 smile happy grin|😂 laugh lol crying tears joy|🤣 rofl rolling|😊 blush smile|😍 love heart eyes|🥰 love hearts adore|😘 kiss|😎 cool sunglasses|🤔 think hmm|🙄 eye roll|" +
  "😴 sleep tired zzz|😭 cry sob sad|😢 sad tear|😡 angry mad rage|🤯 mind blown|🥳 party celebrate|😇 angel innocent|🤗 hug|🤫 shh quiet|🤐 zip|😬 grimace awkward|😱 scream scared|" +
  "🥺 pleading please|😏 smirk|🙃 upside|😅 sweat nervous|🤤 drool|🤢 sick nausea|🤮 vomit|🤒 ill fever|😷 mask|🤠 cowboy|🤓 nerd|🧐 monocle|😈 devil|💀 skull dead|👻 ghost|" +
  "👽 alien|🤖 robot|💩 poop|🎃 pumpkin halloween|❤️ heart love red|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|💔 broken heart|" +
  "💯 hundred 100|🔥 fire lit hot|✨ sparkles|⭐ star|🌟 glowing star|⚡ lightning zap|💥 boom|💫 dizzy|🎉 tada party|🎊 confetti|🎁 gift present|🎂 cake birthday|🍰 cake|" +
  "👍 thumbs up yes like|👎 thumbs down no|👏 clap|🙌 raise hands|🙏 pray please thanks|💪 muscle strong flex|👋 wave hi bye|✌️ peace victory|🤞 fingers crossed luck|👌 ok|🤙 call|" +
  "👀 eyes look|🧠 brain|👑 crown king queen|💎 gem diamond|💰 money bag|💸 money flying|💵 dollar cash|🏆 trophy win|🥇 gold medal first|🎮 game controller gaming|🕹️ joystick|" +
  "🎧 headphones music|🎵 music note|🎤 mic sing|🎸 guitar|🥁 drum|🎬 movie film|📷 camera photo|📱 phone|💻 laptop computer|⌨️ keyboard|🖥️ desktop|📚 books study|✏️ pencil|📝 memo note|" +
  "📅 calendar|⏰ alarm clock|⌛ hourglass|💡 idea bulb|🔒 lock|🔑 key|🛒 cart shopping|✈️ plane travel|🚗 car|🚀 rocket launch|🏠 home house|🌍 earth world globe|🌙 moon night|" +
  "☀️ sun|🌈 rainbow|☁️ cloud|🌧️ rain|❄️ snow cold|⛄ snowman|🌊 wave ocean|🌸 blossom flower|🌹 rose|🌻 sunflower|🍀 clover luck|🌲 tree|🍕 pizza|🍔 burger|🍟 fries|🌮 taco|" +
  "🍣 sushi|🍜 ramen noodles|🍩 donut|🍪 cookie|🍫 chocolate|🍿 popcorn|☕ coffee|🍵 tea|🍺 beer|🍷 wine|🥂 cheers toast|🍎 apple|🍌 banana|🍓 strawberry|🥑 avocado|🐶 dog puppy|" +
  "🐱 cat kitty|🐭 mouse|🐰 bunny rabbit|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🦄 unicorn|🐝 bee|🦋 butterfly|🐢 turtle|" +
  "🐍 snake|🐙 octopus|🦈 shark|🐬 dolphin|🐳 whale|⚽ soccer football|🏀 basketball|🏈 football|⚾ baseball|🎾 tennis|🏐 volleyball|🎯 target dart bullseye|♟️ chess|🎲 dice|" +
  "✅ check done yes|❌ cross no wrong|⚠️ warning|❓ question|❗ exclamation|🆗 ok|🆕 new|🔔 bell|📌 pin|📎 paperclip|🔗 link|🗑️ trash|🧸 teddy|🎈 balloon|💍 ring|🫶 heart hands|" +
  "🤝 handshake deal|🫡 salute|🥶 cold freezing|🥵 hot sweating|😵 dizzy|🤡 clown|💤 sleep zzz|🏃 run|🧘 yoga meditate|🛌 bed|🎓 graduation grad|🏫 school|💼 work briefcase|📈 chart up stonks|📉 chart down").split("|")
  .map(x => { const i = x.indexOf(" "); return [x.slice(0, i), x.slice(i + 1).split(" ")]; });
function emojiAns(s) {
  const m = /^(?:emoji|emojis)\s+(.+)$/i.exec(s) || /^:([a-z]{2,20}):?$/i.exec(s);
  if (!m) return null;
  const w = m[1].toLowerCase().trim(), hits = EMOJI.filter(([, k]) => k.some(x => x.startsWith(w))).slice(0, 10);
  if (!hits.length) return null;
  const e = hits.map(h => h[0]).join(" ");
  return ans("emoji", e, "Emoji for “" + w + "” · Tap to copy " + (hits.length > 1 ? "them all" : "it"), { copy:hits.map(h => h[0]).join("") });
}
function wikiAns(s) {
  const m = /^(?:wiki|wikipedia|who (?:is|was|are|were)|tell me about)\s+(.{2,80}?)\??$/i.exec(s);
  if (!m) return null;
  const t = m[1].trim(), key = "wiki|" + t.toLowerCase();
  const v = later(key, s, async () => {
    const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t.replace(/ /g, "_")) + "?redirect=true");
    if (!r.ok) {
      const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=opensearch&format=json&formatversion=2&limit=1&origin=*&search=" + encodeURIComponent(t))).json();
      if (!j[1] || !j[1][0]) return false;
      const r2 = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(j[1][0].replace(/ /g, "_")));
      return r2.ok ? r2.json() : false;
    }
    return r.json();
  });
  if (v === null) return ans("wiki", "Looking up “" + t + "” on Wikipedia…", "Wikipedia");
  if (!v || v.type === "disambiguation" || !v.extract) return null;
  const u = v.content_urls && v.content_urls.desktop && v.content_urls.desktop.page;
  return ans("wiki", v.extract.length > 260 ? v.extract.slice(0, 257) + "…" : v.extract, v.title + " · Wikipedia · Tap to read", { img:v.thumbnail && v.thumbnail.source, wrap:1, act:u ? () => go({ u }) : null, copy:u ? null : v.extract });
}
const LANGS = { english:"en", spanish:"es", french:"fr", german:"de", italian:"it", portuguese:"pt", dutch:"nl", russian:"ru", japanese:"ja", chinese:"zh-CN", korean:"ko",
  arabic:"ar", hindi:"hi", turkish:"tr", polish:"pl", swedish:"sv", norwegian:"no", danish:"da", finnish:"fi", greek:"el", hebrew:"he", vietnamese:"vi", thai:"th",
  indonesian:"id", ukrainian:"uk", czech:"cs", romanian:"ro", hungarian:"hu", filipino:"tl", tagalog:"tl", malay:"ms", swahili:"sw", latin:"la", irish:"ga", welsh:"cy" };
function translateAns(s) {
  const m = /^(?:translate\s+)(.+?)(?:\s+from\s+([a-z]+))?\s+(?:to|into)\s+([a-z]+)$/i.exec(s) || /^(?:how do you say|how to say)\s+(.+?)\s+in\s+([a-z]+)\??$/i.exec(s);
  if (!m) return null;
  const text = m[1].replace(/^["“]|["”]$/g, ""), to = LANGS[(m[3] || m[2]).toLowerCase()], from = m[3] && m[2] ? LANGS[m[2].toLowerCase()] : null;
  if (!to || (m[3] && m[2] && !from)) return null;
  const pair = (from || (to === "en" ? "Autodetect" : "en")) + "|" + to, key = "tr|" + pair + "|" + text;
  const v = later(key, s, async () => {
    const j = await (await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + encodeURIComponent(pair))).json();
    const t = j && j.responseData && j.responseData.translatedText;
    return t && !/^(INVALID|PLEASE SELECT|MYMEMORY WARNING)/i.test(t) ? t : false;
  }, 500);
  if (v === null) return ans("tr", "Translating…", "MyMemory");
  if (!v) return null;
  const name = Object.keys(LANGS).find(k => LANGS[k] === to);
  return ans("tr", v, titleCase(name) + " · MyMemory translation · Tap to copy", { copy:v, wrap:1 });
}
function ipAns(s) {
  if (!/^(?:what(?:'s| is) )?my (?:public )?ip(?: address)?\??$|^ip address$|^whats my ip$/i.test(s)) return null;
  const v = later("ip", s, async () => (await (await fetch("https://api.ipify.org?format=json")).json()).ip, 0);
  if (v === null) return ans("ip", "Finding your IP address…", "ipify");
  if (!v) return null;
  return ans("ip", v, "Your public IP address, as websites see it · ipify · Tap to copy", { copy:v });
}
function weekAns(s) {
  const m = /^(?:(?:7|seven)[- ]day (?:weather|forecast)|weekly (?:weather|forecast)|(?:weather|forecast) (?:this )?week)(?:\s+(?:in|for|at))?\s+([a-z][a-z .,'-]{1,60})$/i.exec(s) ||
            /^([a-z][a-z .,'-]{1,60}?)\s+(?:weekly|7[- ]day|week) (?:weather|forecast)$/i.exec(s);
  if (!m) return null;
  const place = m[1].trim().replace(/[.,]+$/, ""), unit = wxUnit(), key = "week|" + place.toLowerCase() + "|" + unit;
  const v = later(key, s, async () => {
    const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" + encodeURIComponent(place))).json();
    const loc = g && g.results && g.results[0]; if (!loc) return false;
    const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.latitude + "&longitude=" + loc.longitude +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto" + (unit === "f" ? "&temperature_unit=fahrenheit" : ""))).json();
    return { name:[loc.name, loc.country_code].filter(Boolean).join(", "), d:w.daily };
  }, 450);
  if (v === null) return ans("week", "This week's weather in " + place + "…", "Open-Meteo");
  if (!v) return null;
  const E = { sun:"☀️", moon:"☀️", partly:"⛅", cloud:"☁️", rain:"🌧️", snow:"🌨️", storm:"⛈️", fog:"🌫️" };
  const days = v.d.time.map((t, i) => { const [y, mo, d] = t.split("-").map(Number); return new Date(y, mo - 1, d).toLocaleDateString([], { weekday:"short" }) + " " + E[wxKind(v.d.weather_code[i], 1)] + " " +
    Math.round(v.d.temperature_2m_max[i]) + "°/" + Math.round(v.d.temperature_2m_min[i]) + "°"; });
  return ans("week", days.join("  ·  "), v.name + " · 7 days · Open-Meteo", { wrap:1, copy:days.join(", ") });
}
function capture(s) {
  let m = /^(?:note|n)\s*:\s*([\s\S]+)$/i.exec(s);
  if (m) return ans("cap", "Save a note: " + m[1].slice(0, 80), "Tap to save it to Notes", { act:() => {
    const t = m[1].trim(), all = load("notes", []);
    all.push({ id:uid(), title:t.split("\n")[0].slice(0, 60), text:t, ts:Date.now(), site:"" }); save("notes", all);
    toast("Saved to Notes", { label:"Open", fn:() => ACTIONS.notes() });
  } });
  m = /^(?:todo|to-do|to do|task)\s*:\s*(.+)$/i.exec(s);
  if (m) return ans("cap", "Add to your to-do list: " + m[1].slice(0, 80), "Tap to add it", { act:() => {
    const l = load("todo", []); l.push({ id:uid(), t:m[1].trim().slice(0, 200), done:false, ts:Date.now() }); save("todo", l.slice(-50)); toast("Added to your to-do list");
  } });
  return null;
}
function pctChange(s) {
  const m = /^(?:percent(?:age)? change|% change)?\s*(?:from\s+)?\$?(-?[\d.,]+)\s+(?:to|->|→)\s+\$?(-?[\d.,]+)(?:\s*(?:%|percent(?:age)?)(?:\s*change)?)?$/i.exec(s);
  if (!m || !/percent|%|from/i.test(s)) return null;
  const a = num(m[1]), b = num(m[2]);
  if (!a || isNaN(b)) return null;
  const v = (b - a) / Math.abs(a) * 100;
  return ans("pctc", (v >= 0 ? "+" : "") + fmtN(v, 2) + "%", "Change from " + m[1] + " to " + m[2] + (v >= 0 ? " (an increase)" : " (a decrease)") + " · Tap to copy", { copy:fmtN(v, 2) + "%" });
}
let pickCache = { q:"", v:"" };
function pickAns(s) {
  const m = /^(?:pick|choose|decide)(?: one| between| from| for me)?:?\s+(.+)$/i.exec(s);
  if (!m) return null;
  const opts = m[1].split(/\s*(?:,|\bor\b|\/|\|)\s*/i).map(x => x.trim()).filter(Boolean);
  if (opts.length < 2) return null;
  if (pickCache.q !== s) pickCache = { q:s, v:opts[randInt(0, opts.length - 1)] };
  return ans("pick", "🎯 " + pickCache.v, "Picked at random from " + opts.length + " · type again for another pick", { copy:pickCache.v });
}
function daysBetween(s, now) {
  const m = /^(?:days|weeks) (?:between|from) (.+?) (?:and|to|until) (.+?)\??$/i.exec(s);
  if (!m) return null;
  const a = parseDay(m[1], now), b = parseDay(m[2], now);
  if (!a || !b) return null;
  const d = Math.round(Math.abs(b - a) / 864e5), wk = /^weeks/i.test(s);
  return ans("dbt", wk ? fmtN(d / 7, 1) + " weeks" : fmtN(d, 0) + " days", longDate(a) + " → " + longDate(b) + (wk ? "" : " · " + fmtN(d / 7, 1) + " weeks") + " · Tap to copy", { copy:String(wk ? +(d / 7).toFixed(1) : d), wrap:1 });
}
function inWords(n) {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const big = ["", " thousand", " million", " billion", " trillion"];
  const three = x => { const h = Math.floor(x / 100), r = x % 100; return [h ? ones[h] + " hundred" : "", r ? (r < 20 ? ones[r] : tens[Math.floor(r / 10)] + (r % 10 ? "-" + ones[r % 10] : "")) : ""].filter(Boolean).join(" "); };
  if (n === 0) return "zero";
  const parts = []; let i = 0;
  while (n > 0) { const c = n % 1000; if (c) parts.unshift(three(c) + big[i]); n = Math.floor(n / 1000); i++; }
  return parts.join(" ");
}
function wordsAns(s) {
  const m = /^(?:spell(?: out)?\s+([\d,]+)|([\d,]+)\s+in words)$/i.exec(s);
  if (!m) return null;
  const n = +(m[1] || m[2]).replace(/,/g, "");
  if (!Number.isSafeInteger(n) || n >= 1e15) return null;
  const v = inWords(n);
  return ans("words", v[0].toUpperCase() + v.slice(1), fmtN(n, 0) + " in words · Tap to copy", { copy:v, wrap:1 });
}
function qrAns(s) {
  const m = /^(?:qr|qr code|qrcode)[:\s]+([\s\S]{1,600})$/i.exec(s);
  if (!m || typeof qrcode !== "function") return null;
  const img = qrDataURL(m[1], 3);
  return img ? ans("qr", "QR code for “" + m[1].slice(0, 60) + "”", "Tap to open it bigger, save or share", { img, act:() => openTool("qr", m[1]) }) : null;
}
function bangsAns(s) { return /^!?(bangs|help bangs|!help)$/i.test(s) ? ans("bang", "See all " + Object.keys(BANGS).length + " bangs", "Shortcuts like !yt, !gh and !wa", { act:openBangs }) : null; }

answers = (orig => function (q) {
  const out = orig(q), s = q.trim(), now = new Date();
  [bmi(s), age(s, now), loan(s), interest(s), textTools(s), roman(s), unixTime(s, now), hashAns(s), lorem(s), emojiAns(s), wikiAns(s), translateAns(s), ipAns(s),
   weekAns(s), capture(s), pctChange(s), pickAns(s), daysBetween(s, now), wordsAns(s), qrAns(s), bangsAns(s)].forEach(r => { if (r) out.push(r); });
  return out;
})(answers);

// QR codes, drawn by the bundled qrcode-generator (MIT, Kazuhiko Arase).
function qrMake(text) {
  if (typeof qrcode !== "function") return null;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  for (const lvl of ["M", "L"]) { try { const q = qrcode(0, lvl); q.addData(String(text), "Byte"); q.make(); return q; } catch (e) {} }
  return null;
}
function qrDataURL(text, cell) {
  const q = qrMake(text);
  if (!q) return "";
  const n = q.getModuleCount(), m = 2, size = (n + m * 2) * cell;
  const c = Object.assign(document.createElement("canvas"), { width:size, height:size }), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  return c.toDataURL("image/png");
}

/* ---------------------------------------------------------------- the engine lists ignore bang-only sites */
ACTIONS.bangsList = openBangs;
