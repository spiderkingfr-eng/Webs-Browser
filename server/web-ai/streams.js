/* Webs 3.14: streamers you follow (ideas #092 stream schedules, #093 the live-now dot).
   GET /streams?u=name1,name2   (Twitch logins, at most 20)
     -> { ok, live:[{ u, name, title, game, viewers, since, img }], next:[{ u, name, title, game, at, end }], users:[{ u, name, img }] }
   From Twitch's own API (api.twitch.tv/helix), which needs the TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET secrets: a free
   app at dev.twitch.tv/console (setup.cmd asks). Who is live is kept 2 minutes, schedules an hour, in the Worker's cache.
   Without the keys: { ok:false, error:"nokey" }. Only the names you follow are sent, never who is asking. */
const NAME = /^[a-z0-9_]{3,25}$/;
let token = null, getting = null;     // { v, until }: one app token for everyone, renewed before it runs out
function appToken(env, force) {
  if (!force && token && token.until > Date.now() + 60000) return Promise.resolve(token.v);
  if (!getting) getting = newToken(env).finally(() => { getting = null; });       // (calls at the same time share one)
  return getting;
}
async function newToken(env) {
  const r = await fetch("https://id.twitch.tv/oauth2/token?client_id=" + encodeURIComponent(env.TWITCH_CLIENT_ID) + "&client_secret=" + encodeURIComponent(env.TWITCH_CLIENT_SECRET) + "&grant_type=client_credentials", { method:"POST" });
  const j = r.ok ? await r.json().catch(() => null) : null;
  if (!j || !j.access_token) throw new Error("token");
  token = { v:j.access_token, until:Date.now() + (+j.expires_in || 3600) * 1000 };
  return token.v;
}
async function helix(env, path) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch("https://api.twitch.tv/helix/" + path, { headers:{ "Client-Id":env.TWITCH_CLIENT_ID, Authorization:"Bearer " + await appToken(env, i > 0) } });
    if (r.status === 401 && i === 0) continue;         // the token ran out early: a new one, once
    if (r.status === 404) return { data:null };       // (no schedule)
    if (!r.ok) throw new Error("twitch " + r.status);
    return await r.json();
  }
  throw new Error("twitch auth");
}
const clean = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const img = (u, w, h) => /^https:\/\//.test(u || "") ? String(u).replace("{width}", w).replace("{height}", h) : "";
export async function streamsApi(req, env, cors, ctx, h) {
  const id = String(env.TWITCH_CLIENT_ID || "").trim(), secret = String(env.TWITCH_CLIENT_SECRET || "").trim();
  if (!id || !secret) return h.json({ ok:false, error:"nokey", message:"Streamers show here once the Web AI server has a Twitch key (its setup.cmd asks for one)." }, 200, cors);
  env = Object.assign({}, env, { TWITCH_CLIENT_ID:id, TWITCH_CLIENT_SECRET:secret });
  const names = [...new Set(String(new URL(req.url).searchParams.get("u") || "").toLowerCase().split(",").map(s => s.trim()).filter(s => NAME.test(s)))].sort().slice(0, 20);
  if (!names.length) return h.json({ error:"bad", message:"Which streamers?" }, 400, cors);
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null, key = new Request("https://web-ai.cache/streams/" + names.join(","));
  if (cache) { const hit = await cache.match(key); if (hit) return h.json(await hit.json(), 200, cors); }
  try {
    const q = k => names.map(n => k + "=" + n).join("&");
    const [u, s] = await Promise.all([helix(env, "users?" + q("login")), helix(env, "streams?first=20&" + q("user_login"))]);
    const users = (u.data || []).map(x => ({ id:x.id, u:x.login, name:clean(x.display_name, 40), img:img(x.profile_image_url, 70, 70) }));
    const live = (s.data || []).filter(x => x.type === "live").map(x => ({ u:x.user_login, name:clean(x.user_name, 40), title:clean(x.title, 140), game:clean(x.game_name, 60), viewers:+x.viewer_count || 0, since:x.started_at || "", img:img(x.thumbnail_url, 320, 180) }));
    // schedules: kept longer, one call per streamer
    const next = [];
    await Promise.all(users.map(async x => {
      const sk = new Request("https://web-ai.cache/sched/" + x.id);
      let segs = null;
      if (cache) { const hit = await cache.match(sk); if (hit) segs = await hit.json(); }
      if (!segs) {
        try { const r = await helix(env, "schedule?first=5&broadcaster_id=" + x.id); segs = ((r.data && r.data.segments) || []).filter(g => !g.canceled_until).map(g => ({ title:clean(g.title, 140), game:clean(g.category && g.category.name, 60), at:g.start_time || "", end:g.end_time || "" })); }
        catch (e) { segs = []; }
        if (cache) ctx.waitUntil(cache.put(sk, new Response(JSON.stringify(segs), { headers:{ "content-type":"application/json", "cache-control":"public, max-age=3600" } })));
      }
      segs.filter(g => g.at && Date.parse(g.at) > Date.now() - 3600e3 && Date.parse(g.at) < Date.now() + 8 * 864e5).forEach(g => next.push(Object.assign({ u:x.u, name:x.name }, g)));
    }));
    next.sort((a, b) => a.at < b.at ? -1 : 1);
    const out = { ok:true, live, next:next.slice(0, 40), users:users.map(x => ({ u:x.u, name:x.name, img:x.img })) };
    if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers:{ "content-type":"application/json", "cache-control":"public, max-age=120" } })));
    return h.json(out, 200, cors);
  } catch (e) {
    return h.json({ ok:false, error:"down", message:"Twitch couldn't be reached. Try again in a minute." }, 200, cors);
  }
}
export const _reset = () => { token = null; getting = null; };
