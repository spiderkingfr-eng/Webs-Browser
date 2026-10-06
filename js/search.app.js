/* Webs Browser for iPhone 2.11 - search inside the app.
   With "Search inside Webs" on (Settings → Search), typing a search shows quick results on a page inside Webs instead
   of opening DuckDuckGo, Google or another engine. Results come straight from your device from free, key-less sources
   that let web apps call them (DuckDuckGo's instant-answer API and Wikipedia); nothing is proxied and nothing about
   you is sent to us. Tapping a result opens that site the normal way, over your normal connection - this only changes
   where results show, it is not a way around anything a network blocks. A button opens the full results in your engine.
   A bang (!g), a keyword (yt …) or a typed address still go straight there. */
"use strict";
(function () {
const enc = encodeURIComponent;
const esc2 = s => esc(s);
const inApp = () => !!cfg.inAppSearch;

async function ddg(q) {
  try {
    const r = await fetch("https://api.duckduckgo.com/?q=" + enc(q) + "&format=json&no_html=1&skip_disambig=1&t=webs", { headers: { accept: "application/json" } });
    const j = await r.json();
    const out = { abstract: null, results: [] };
    if (j.AbstractText && j.AbstractURL) out.abstract = { title: j.Heading || q, text: j.AbstractText, url: j.AbstractURL, src: j.AbstractSource || "" };
    const walk = list => (list || []).forEach(t => {
      if (t.Topics) walk(t.Topics);
      else if (t.FirstURL && t.Text) out.results.push({ title: t.Text.split(" - ")[0], text: t.Text, url: t.FirstURL });
    });
    walk(j.RelatedTopics);
    if (j.Results) walk(j.Results);
    return out;
  } catch (e) { return { abstract: null, results: [] }; }
}
async function wiki(q) {
  try {
    const r = await fetch("https://en.wikipedia.org/w/api.php?action=opensearch&search=" + enc(q) + "&limit=6&namespace=0&format=json&origin=*", { headers: { accept: "application/json" } });
    const j = await r.json();
    const [, titles, descs, urls] = j;
    return (titles || []).map((t, i) => ({ title: t, text: descs && descs[i] ? descs[i] : "Wikipedia", url: urls && urls[i] })).filter(x => x.url);
  } catch (e) { return []; }
}

function showResults(q, rawInput) {
  q = String(q || "").trim();
  if (!q) return;
  openSheet(q, '<div class="srch"><div class="srch-load">Searching…</div></div>', { full: true, kind: "search" });
  const box = () => $("#sheetBody .srch");
  const engName = (typeof engine === "function" ? engine().name : "your engine");
  const open = u => { closeSheet(); go(u, { noInApp: true }); };
  Promise.all([ddg(q), wiki(q)]).then(([d, w]) => {
    if (!box()) return;
    // dedupe by host+path, Wikipedia first, then DDG abstract, then DDG related
    const seen = new Set(), rows = [];
    const add = (r, tag) => { if (!r.url || !/^https?:\/\//.test(r.url)) return; const k = r.url.replace(/[#?].*$/, "").replace(/\/$/, ""); if (seen.has(k)) return; seen.add(k); rows.push(Object.assign({ tag }, r)); };
    w.forEach(r => add(r, "Wikipedia"));
    d.results.forEach(r => add(r, ""));
    let html = "";
    if (d.abstract) html += '<a class="srch-ab" data-u="' + esc2(d.abstract.url) + '"><b>' + esc2(d.abstract.title) + "</b><p>" + esc2(d.abstract.text) + "</p>" + (d.abstract.src ? "<span>" + esc2(d.abstract.src) + "</span>" : "") + "</a>";
    if (rows.length) html += '<div class="srch-list">' + rows.slice(0, 20).map(r => '<a class="srch-r" data-u="' + esc2(r.url) + '"><b>' + esc2(r.title) + (r.tag ? ' <i class="srch-tag">' + esc2(r.tag) + "</i>" : "") + "</b><span>" + esc2(hostOf(r.url)) + "</span>" + (r.text && r.text !== r.title ? "<em>" + esc2(r.text) + "</em>" : "") + "</a>").join("") + "</div>";
    if (!html) html = '<p class="srch-none">No quick results for “' + esc2(q) + '”. Open the full results below.</p>';
    html += '<button type="button" class="srch-full">Full results in ' + esc2(engName) + " ›</button>" +
      '<p class="srch-note">Quick results from DuckDuckGo and Wikipedia, on your device. Tapping one opens that site normally.</p>';
    box().innerHTML = html;
    box().querySelectorAll("[data-u]").forEach(a => { a.onclick = () => open(a.dataset.u); });
    box().querySelector(".srch-full").onclick = () => { closeSheet(); go(rawInput != null ? rawInput : q, { noInApp: true }); };
  });
}

// typing a search shows it inside Webs; URLs, bangs and keywords still go straight there
const go0 = window.go;
window.go = function (input, opts) {
  opts = opts || {};
  if (inApp() && !opts.noInApp && typeof input === "string") {
    const raw = input.trim();
    const bangOrKw = /^!/.test(raw) || (typeof keywordFor === "function" && keywordFor(raw));
    const u = typeof resolve === "function" ? resolve(raw) : null;
    const so = u && typeof searchOf === "function" ? searchOf(u) : null;
    if (so && !bangOrKw) { showResults(so.q, raw); return; }
  }
  return go0.apply(this, arguments);
};

const settingsHTML0 = settingsHTML;
settingsHTML = function () {
  return GROUP("Search inside the app", SW("inAppSearch", "Search inside Webs", "Show quick results here instead of opening a search engine", inApp()),
    "Tapping a result still opens that site normally. A bang (!g) or a keyword goes straight to that engine.") + settingsHTML0();
};

const st = document.createElement("style");
st.textContent = ".srch{display:flex;flex-direction:column;gap:10px}.srch-load,.srch-none{color:var(--dim);padding:10px 2px}" +
  ".srch-ab{display:block;padding:12px 14px;border-radius:14px;background:var(--bg2);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 22%,transparent)}.srch-ab b{font-size:16px}.srch-ab p{margin:4px 0 0;font-size:14px;line-height:1.45}.srch-ab span{display:block;margin-top:6px;font-size:12px;color:var(--dim)}" +
  ".srch-list{display:flex;flex-direction:column}.srch-r{display:block;padding:10px 6px;border-bottom:1px solid var(--line)}.srch-r b{font-size:15px;font-weight:600;color:var(--link,#3b8bf0)}.srch-tag{font-style:normal;font-size:11px;font-weight:600;color:var(--dim);border:1px solid var(--line);border-radius:6px;padding:0 5px;margin-left:4px}" +
  ".srch-r span{display:block;font-size:12px;color:var(--dim)}.srch-r em{display:block;font-size:13px;font-style:normal;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
  ".srch-full{font:inherit;font-weight:600;font-size:14.5px;border:0;border-radius:12px;padding:11px;background:var(--bg3);color:var(--fg)}.srch-note{font-size:12px;color:var(--dim);margin:0}";
document.head.appendChild(st);

window.SearchApp = { showResults, ddg, wiki, inApp };
})();
