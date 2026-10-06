/* Webs 3.14: the filler guide. GET /filler?s=<show> -> { ok, show, filler:"26, 97-106", mixed:"…", canon:"…", url }
   Which episodes of a long anime are filler, from animefillerlist.com (its show page, read here because a browser
   page may not read another site). Kept a week in the Worker's cache. */
const UA = "WebsBrowser/3.14 (+https://spiderkingfr-eng.github.io/Webs-Browser/)";
const slug = s => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
// the episode list after a label: "<div class=\\"filler\\"><span class=\\"Label\\">Filler Episodes:</span><span class=\\"Episodes\\"><a …>26</a>, <a …>97-106</a></span></div>"
function eps(html, cls) {
  const m = new RegExp('<div[^>]*class="(?:[^"]*\\s)?' + cls + '(?:\\s[^"]*)?"[^>]*>[\\s\\S]*?<span[^>]*class="Episodes"[^>]*>([\\s\\S]*?)</span>', "i").exec(html);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim().slice(0, 2000);
}
export async function fillerApi(req, env, cors, ctx, h) {
  const s = slug(new URL(req.url).searchParams.get("s"));
  if (!s) return h.json({ error:"bad", message:"Which show?" }, 400, cors);
  const url = "https://www.animefillerlist.com/shows/" + s;
  const cache = typeof caches !== "undefined" ? caches.default : null, key = new Request("https://web-ai.cache/filler/" + s);
  if (cache) { const hit = await cache.match(key); if (hit) { const j = await hit.json(); return h.json(j, 200, cors); } }
  let html = "";
  try { const r = await fetch(url, { headers:{ "user-agent":UA, accept:"text/html" }, cf:{ cacheTtl:86400 } }); if (r.status === 404) return h.json({ ok:false, error:"none", message:"That show isn't on the filler list. Try its full name, like “naruto shippuden”.", url }, 200, cors); html = r.ok ? await r.text() : ""; }
  catch (e) {}
  if (!html) return h.json({ ok:false, error:"down", message:"The filler list couldn't be reached. Try again later.", url }, 200, cors);
  const t = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const out = { ok:true, show:t ? t[1].replace(/<[^>]+>/g, "").replace(/\s*Filler List\s*$/i, "").trim().slice(0, 100) : s, filler:eps(html, "filler"), mixed:eps(html, "mixed_canon\\/filler"), canon:eps(html, "manga_canon"), anime:eps(html, "anime_canon"), url };
  if (!out.filler && !out.mixed && !out.canon) return h.json({ ok:false, error:"none", message:"No filler list for that show.", url }, 200, cors);
  if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers:{ "content-type":"application/json", "cache-control":"max-age=604800" } })));
  return h.json(out, 200, cors);
}
