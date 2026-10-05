/* Reading a page for later (iPhone 2.9's offline articles): the iPhone app can't read the sites it shows (they're in
   frames from other sites), so it asks here.
   GET /read?u=<address>&device=<id>  -> { ok, u, title, site, html }
   The page is fetched, and its main part (the <article>, or <main>, or the body) comes back with scripts, styles,
   menus, forms and the like taken out. The app cleans it again (only plain text tags are kept) and stores it on the
   phone. Nothing is kept here. 60 pages a day per device (counted by the ledger), web pages only, 3 MB at most. */
import { json } from "./worker.js";
import { ledgerCall } from "./ledger.js";

const MAX = 3 * 1024 * 1024, OUT = 400 * 1024, DAILY = 60;
const okUrl = u => {
  let x; try { x = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(x.protocol) || x.username || x.password) return null;
  const h = x.hostname.toLowerCase();
  if (!/\.[a-z]{2,}$/.test(h) || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/.test(h) || /^[\d.]+$/.test(h) || h.indexOf(":") >= 0) return null;
  return x;
};
const ent = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ");
export function extract(html, base) {
  const meta = (p) => { const m = new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]*content=["\']([^"\']*)', "i").exec(html) || new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + p + '["\']', "i").exec(html); return m ? ent(m[1]).trim() : ""; };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = (meta("og:title") || (t ? ent(t[1]).replace(/\s+/g, " ").trim() : "") || base.hostname).slice(0, 300);
  const site = (meta("og:site_name") || base.hostname.replace(/^www\./, "")).slice(0, 100);
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of ["script", "style", "noscript", "svg", "iframe", "form", "nav", "footer", "header", "aside", "template", "button", "select", "canvas", "video", "audio", "object"])
    s = s.replace(new RegExp("<" + tag + "\\b[\\s\\S]*?<\\/" + tag + ">", "gi"), "");
  const pick = re => { const m = re.exec(s); return m ? m[1] : ""; };
  let main = pick(/<article\b[^>]*>([\s\S]*)<\/article>/i) || pick(/<main\b[^>]*>([\s\S]*)<\/main>/i) || pick(/<div[^>]+(?:id|class)=["'][^"']*(?:article|post-content|entry-content|story|content-body)[^"']*["'][^>]*>([\s\S]*)<\/div>/i) || pick(/<body\b[^>]*>([\s\S]*)<\/body>/i) || s;
  // links and pictures with full addresses
  main = main.replace(/\s(href|src)=(["'])(.*?)\2/gi, (all, k, q, v) => { try { return " " + k + '="' + new URL(ent(v), base).href.replace(/"/g, "%22") + '"'; } catch (e) { return ""; } });
  if (main.length > OUT) main = main.slice(0, OUT);
  return { title, site, html:main };
}
export async function readApi(req, env, cors) {
  const q = new URL(req.url).searchParams, u = okUrl(q.get("u") || ""), device = String(q.get("device") || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!u) return json({ error:"bad", message:"Only web pages can be saved." }, 400, cors);
  if (device.length < 12) return json({ error:"bad", message:"No device id." }, 400, cors);
  if (env.LEDGER) {
    const r = await ledgerCall(env, { op:"read.count", dev:device.slice(0, 40), max:DAILY });
    if (!r.ok) return json({ error:"limit", message:"That's " + DAILY + " pages today. Try again tomorrow." }, 429, cors);
  }
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 10000);
  let res;
  try { res = await fetch(u.href, { headers:{ "user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 WebsReader", accept:"text/html,application/xhtml+xml" }, redirect:"follow", signal:ac.signal }); }
  catch (e) { clearTimeout(timer); return json({ error:"fetch", message:"That page couldn't be reached." }, 502, cors); }
  clearTimeout(timer);
  if (!res.ok) return json({ error:"fetch", message:"That page answered with an error (" + res.status + ")." }, 502, cors);
  if (!/html/i.test(res.headers.get("content-type") || "")) return json({ error:"type", message:"That isn't a web page that can be read later." }, 415, cors);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX) return json({ error:"big", message:"That page is too big to keep." }, 413, cors);
  const final = okUrl(res.url || u.href) || u;
  const out = extract(new TextDecoder().decode(buf), final);
  return json({ ok:true, u:final.href, ...out }, 200, cors);
}
