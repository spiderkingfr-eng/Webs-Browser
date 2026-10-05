/* The ledger (Windows 3.10, iPhone 2.9): one Durable Object that keeps the counts the owner looks at, so they
   cost none of the KV storage's 1,000 daily writes.
     POST /stats  { device, platform, version, uses:{ feature:n }, errors:[{ m, s, n }], ab:[{ id, v, seen, click }] }
                  once a day from each app with "Send anonymous counts" on: which features were used how often,
                  the errors the app ran into (the message and where, never a page's address), and what was seen
                  and clicked in an A/B test (an announcement with two versions)
     GET  /gallery                 the wallpapers people shared that the owner approved: [{ id, title, by, url }]
     GET  /gallery/img/<id>        one of them
     POST /gallery/send { device, title, by, img }   a wallpaper to share (a JPEG data: URL, 600 KB at most),
                  waiting for the owner; 3 a day per device
     POST /invite/new    { device }          -> { code, n }   this device's invite code, and how many joined with it
     POST /invite/claim  { device, code }    -> { ok }        a new device opened an invite: both get an achievement
   For the dashboard (worker.js admin -> ledgerAdmin): ledger.read, gallery.list / .ok / .no / .del. Days are kept 60 days. */
import { json, hash, cut, rnd } from "./worker.js";

const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const day = t => new Date(t || Date.now()).toISOString().slice(0, 10);
const KEEP_DAYS = 60, MAX_IMG = 600 * 1024, MAX_ERR = 300, MAX_USE = 300;
const name = s => /^[a-z0-9][a-z0-9._-]{0,47}$/i.test(String(s || "")) ? String(s).toLowerCase() : "";

export class Ledger {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(req) {
    let b = {}; try { b = await req.json(); } catch (e) {}
    const out = await this.run(String(b.op || ""), b);
    return new Response(JSON.stringify(out), { headers:{ "content-type":"application/json" } });
  }
  get s() { return this.ctx.storage; }
  async run(op, b) {
    const s = this.s, now = Date.now();
    if (op === "stats") {
      const k = "d:" + day(), d = await s.get(k) || { devices:0, plat:{}, ver:{}, uses:{}, errors:{} };
      const seenK = "seen:" + day() + ":" + b.dev;
      if (await s.get(seenK)) return { ok:true, again:true };          // once a day per device
      await s.put(seenK, 1);
      d.devices++; const p = b.platform === "iphone" ? "iphone" : "windows";
      d.plat[p] = (d.plat[p] || 0) + 1;
      if (/^\d+\.\d+\.\d+$/.test(b.version || "")) d.ver[p + " " + b.version] = (d.ver[p + " " + b.version] || 0) + 1;
      for (const [f, n] of Object.entries(b.uses && typeof b.uses === "object" ? b.uses : {}).slice(0, 200)) {
        const fk = name(f); if (!fk) continue;
        if (!d.uses[p]) d.uses[p] = {};
        if (d.uses[p][fk] == null && Object.keys(d.uses[p]).length >= MAX_USE) continue;
        d.uses[p][fk] = (d.uses[p][fk] || 0) + Math.max(0, Math.min(1000, Math.round(+n) || 0));
      }
      for (const e of (Array.isArray(b.errors) ? b.errors : []).slice(0, 20)) {
        const m = clean(e && e.m, 300); if (!m) continue;
        const src = clean(e.s, 120).replace(/https?:\/\/[^\s)]+/g, u => /browser\.example|github\.io/.test(u) ? u.replace(/^https?:\/\/[^/]+/, "") : "(a page)");
        const h = (await hash("err:" + p + m + src)).slice(0, 12);
        if (!d.errors[h] && Object.keys(d.errors).length >= MAX_ERR) continue;
        const x = d.errors[h] || (d.errors[h] = { m, s:src, app:p, ver:{}, n:0, devs:0, first:now });
        x.n += Math.max(1, Math.min(100, Math.round(+e.n) || 1)); x.devs++; x.last = now;
        if (/^\d+\.\d+\.\d+$/.test(b.version || "")) x.ver[b.version] = 1;
      }
      await s.put(k, d);
      for (const a of (Array.isArray(b.ab) ? b.ab : []).slice(0, 5)) {
        if (!/^[a-z0-9]{4,16}$/.test(String(a && a.id || "")) || !/^[AB]$/.test(a.v || "")) continue;
        const ak = "ab:" + a.id, r = await s.get(ak) || { A:{ seen:0, click:0 }, B:{ seen:0, click:0 }, first:now };
        r[a.v].seen += a.seen ? 1 : 0; r[a.v].click += a.click ? 1 : 0; r.last = now;
        await s.put(ak, r);
      }
      await this.trim();
      return { ok:true };
    }
    if (op === "read") {
      const days = [];
      for (let i = Math.min(+b.days || 14, KEEP_DAYS) - 1; i >= 0; i--) { const dd = day(now - i * 86400000); days.push(Object.assign({ day:dd }, await s.get("d:" + dd) || {})); }
      const ab = {}; for (const [k, v] of await s.list({ prefix:"ab:" })) ab[k.slice(3)] = v;
      const inv = await s.get("invites") || { codes:0, joined:0 };
      return { ok:true, days, ab, invites:inv };
    }
    // the gallery
    if (op === "gallery.send") {
      const dk = "gsent:" + day() + ":" + b.dev, n = await s.get(dk) || 0;
      if (n >= 3) return { error:"limit", message:"That's 3 wallpapers today. Thanks! Try again tomorrow." };
      const pend = await s.list({ prefix:"gp:" });
      if (pend.size >= 50) return { error:"busy", message:"Lots of wallpapers are waiting to be looked at. Try again in a few days." };
      const id = rnd(10), seq = (await s.get("gseq") || 0) + 1;
      await s.put("gseq", seq);
      await s.put("gp:" + id, { id, seq, title:clean(b.title, 60) || "Untitled", by:clean(b.by, 40) || "Someone", img:b.img, ts:now, app:b.platform === "iphone" ? "iphone" : "windows" });
      await s.put(dk, n + 1);
      return { ok:true, id };
    }
    if (op === "gallery.public") { const l = await s.get("gallery") || []; return { ok:true, items:l }; }
    if (op === "gallery.img") { const g = await s.get("gi:" + b.id); return g ? { ok:true, img:g } : { error:"not_found" }; }
    if (op === "gallery.list") {
      const pend = [...(await s.list({ prefix:"gp:" })).values()].sort((x, y) => x.seq - y.seq);
      return { ok:true, pending:pend, approved:await s.get("gallery") || [] };
    }
    if (op === "gallery.ok" || op === "gallery.no") {
      const g = await s.get("gp:" + b.id); if (!g) return { error:"not_found", message:"Already looked at." };
      await s.delete("gp:" + b.id);
      if (op === "gallery.ok") {
        await s.put("gi:" + g.id, g.img);
        const l = await s.get("gallery") || []; l.unshift({ id:g.id, title:clean(b.title, 60) || g.title, by:g.by, ts:now }); await s.put("gallery", l.slice(0, 100));
        for (const x of l.slice(100)) await s.delete("gi:" + x.id);
      }
      return { ok:true };
    }
    if (op === "gallery.del") { const l = (await s.get("gallery") || []).filter(x => x.id !== b.id); await s.put("gallery", l); await s.delete("gi:" + b.id); return { ok:true }; }
    // invites
    if (op === "invite.new") {
      let c = await s.get("idev:" + b.dev);
      if (!c) { c = rnd(8); await s.put("idev:" + b.dev, c); await s.put("inv:" + c, { d:b.dev, n:0, ts:now }); const t = await s.get("invites") || { codes:0, joined:0 }; t.codes++; await s.put("invites", t); }
      const r = await s.get("inv:" + c) || { n:0 };
      return { ok:true, code:c, n:r.n };
    }
    if (op === "invite.claim") {
      const r = await s.get("inv:" + b.code);
      if (!r) return { error:"code", message:"That invite isn't valid." };
      if (r.d === b.dev) return { error:"self", message:"That's your own invite." };
      if (await s.get("iclaim:" + b.dev)) return { ok:true, again:true };
      await s.put("iclaim:" + b.dev, b.code);
      r.n++; await s.put("inv:" + b.code, r);
      const t = await s.get("invites") || { codes:0, joined:0 }; t.joined++; await s.put("invites", t);
      return { ok:true };
    }
    return { error:"bad", message:"Unknown request." };
  }
  // forget days (and their once-a-day marks) older than KEEP_DAYS, now and then
  async trim() {
    const last = await this.s.get("trimmed"); if (last === day()) return;
    await this.s.put("trimmed", day());
    const cut2 = day(Date.now() - KEEP_DAYS * 86400000), cut1 = day(Date.now() - 2 * 86400000);
    for (const [k] of await this.s.list({ prefix:"d:" })) if (k.slice(2) < cut2) await this.s.delete(k);
    for (const pre of ["seen:", "gsent:"]) for (const [k] of await this.s.list({ prefix:pre })) if (k.split(":")[1] < cut1) await this.s.delete(k);
  }
}

const stub = env => env.LEDGER.get(env.LEDGER.idFromName("ledger"));
export async function ledgerCall(env, o) {
  const r = await stub(env).fetch("https://ledger/run", { method:"POST", body:JSON.stringify(o) });
  return r.json();
}
const devOf = async device => { const d = String(device || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); return d.length >= 12 ? (await hash("device:" + d)).slice(0, 16) : ""; };

// the apps' requests
export async function ledgerApi(path, req, env, cors) {
  if (!env.LEDGER) return json({ error:"setup", message:"The ledger isn't set up on this server yet (run setup.cmd again)." }, 503, cors);
  const im = /^\/gallery\/img\/([a-z0-9]{10})$/.exec(path);
  if (req.method === "GET" && im) {
    const r = await ledgerCall(env, { op:"gallery.img", id:im[1] });
    const m = r.img && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(r.img);
    if (!m) return json({ error:"not_found", message:"No such picture." }, 404, cors);
    return new Response(Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)), { headers:{ "Access-Control-Allow-Origin":"*", "content-type":m[1], "cache-control":"public, max-age=31536000, immutable" } });
  }
  if (req.method === "GET" && path === "/gallery") {
    const r = await ledgerCall(env, { op:"gallery.public" }), base = new URL(req.url).origin;
    const res = json({ ok:true, items:(r.items || []).map(x => ({ id:x.id, title:x.title, by:x.by, url:base + "/gallery/img/" + x.id })) }, 200, cors);
    res.headers.set("cache-control", "public, max-age=300");
    return res;
  }
  let b = null; try { b = await req.json(); } catch (e) {}
  if (!b || typeof b !== "object") return json({ error:"bad", message:"The app sent something the server can't read." }, 400, cors);
  const dev = await devOf(b.device);
  if (!dev) return json({ error:"bad", message:"No device id." }, 400, cors);
  if (path === "/stats") return json(await ledgerCall(env, { op:"stats", dev, platform:b.platform, version:cut(b.version, 20), uses:b.uses, errors:b.errors, ab:b.ab }), 200, cors);
  if (path === "/gallery/send") {
    const img = String(b.img || "");
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > MAX_IMG * 4 / 3 + 30) return json({ error:"bad", message:"Send a JPEG picture under 600 KB." }, 400, cors);
    const r = await ledgerCall(env, { op:"gallery.send", dev, title:b.title, by:b.by, img, platform:b.platform });
    return json(r, r.ok ? 200 : 429, cors);
  }
  if (path === "/invite/new") return json(await ledgerCall(env, { op:"invite.new", dev }), 200, cors);
  if (path === "/invite/claim") {
    if (!/^[a-z0-9]{8}$/.test(String(b.code || ""))) return json({ error:"code", message:"That invite isn't valid." }, 400, cors);
    const r = await ledgerCall(env, { op:"invite.claim", dev, code:b.code });
    return json(r, r.ok ? 200 : 400, cors);
  }
  return json({ error:"not_found", message:"Nothing here." }, 404, cors);
}
// the dashboard's requests (worker.js admin, after the owner's code is checked)
export async function ledgerAdmin(op, body, env, h) {
  if (!/^(ledger\.read|gallery\.(list|ok|no|del))$/.test(op)) return null;
  if (!env.LEDGER) return json({ error:"setup", message:"The ledger isn't set up yet: run setup.cmd again to update the server." }, 503, h);
  const o = op === "ledger.read" ? { op:"read", days:body.days } : { op, id:String(body.id || ""), title:body.title };
  const r = await ledgerCall(env, o);
  return json(r, r.error ? 400 : 200, h);
}
