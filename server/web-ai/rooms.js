/* Live rooms (Windows 3.10, iPhone 2.9): a Durable Object per room, which the apps reach with a WebSocket.
   GET /room?k=<room>&dev=<device>&name=<name>&app=<windows|iphone>   (Upgrade: websocket)
   Two kinds of room:
     l.<link>   your own linked devices (the link from /link/new and /link/join): the shared clipboard, the
                phone as a remote, "pick up where you left off" and sets of tabs sent between them. Kept.
     g.<CODE>   a game with a join code (6 letters and numbers): chess, Connect Four or tic-tac-toe with a
                friend. Forgotten two days after its last move.
   What goes through it (JSON, one object a message):
     server -> { t:"hi", you, peers:[{ id, dev, name, app }], store:{ key:value } }   as you join
               { t:"peers", peers }                                                    someone came or went
               { t:"set", k, v, from }   a value someone kept in the room (the clipboard, a game's moves…)
               { t:"msg", d, from }      something passed to the others (a remote's button press…)
     client -> { t:"set", k, v }  keeps v under k (at most 60 keys of 32 KB) and tells the others
               { t:"msg", d, to? }       to the others, or to one of them
               { t:"ping" }              -> { t:"pong" }
   A room holds at most 8 connections, and each may send 40 messages in 10 seconds. Nothing in a room is
   read by the server; the KV storage isn't touched after the link is checked, so it costs no daily writes. */
const MAX_PEOPLE = 8, MAX_KEYS = 60, MAX_VALUE = 32768, MAX_MSG = 65536, RATE = 40, GAME_DAYS = 2;
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export function roomKey(k) {
  k = String(k || "");
  if (/^l\.[a-z0-9]{24}$/.test(k)) return { kind:"link", k };
  if (/^g\.[A-Z2-9]{6}$/.test(k)) return { kind:"game", k };
  return null;
}

// the worker's side: checks the room, then hands the connection to its Durable Object
export async function roomApi(req, env, cors) {
  const u = new URL(req.url), r = roomKey(u.searchParams.get("k"));
  const no = (s, m) => new Response(JSON.stringify({ error:"room", message:m }), { status:s, headers:{ ...cors, "content-type":"application/json" } });
  if (!r) return no(400, "That isn't a room.");
  if (!env.ROOMS) return no(503, "Live rooms aren't set up on this server yet (run setup.cmd again).");
  if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return no(426, "This needs a WebSocket.");
  if (r.kind === "link" && !(await env.LIMITS.get("lk:" + r.k.slice(2)))) return no(404, "This device isn't linked any more. Link it again.");
  const stub = env.ROOMS.get(env.ROOMS.idFromName(r.k));
  return stub.fetch(req);
}

export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.rate = new Map(); }

  async fetch(req) {
    const u = new URL(req.url), r = roomKey(u.searchParams.get("k"));
    if (!r) return new Response("bad room", { status:400 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    const ok = await this.join(server, { room:r.k, kind:r.kind, dev:u.searchParams.get("dev"), name:u.searchParams.get("name"), app:u.searchParams.get("app") });
    if (!ok) { server.accept(); server.send(JSON.stringify({ t:"full" })); server.close(4001, "full"); }
    return new Response(null, { status:101, webSocket:client });
  }
  sockets() { return this.ctx.getWebSockets(); }
  info(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  peers() { return this.sockets().map(ws => this.info(ws)).filter(i => i.id).map(i => ({ id:i.id, dev:i.dev, name:i.name, app:i.app })); }
  others(ws, o, to) { const s = JSON.stringify(o); for (const w of this.sockets()) if (w !== ws && (!to || this.info(w).id === to)) { try { w.send(s); } catch (e) {} } }
  async store() { const m = await this.ctx.storage.list({ prefix:"s:" }), o = {}; for (const [k, v] of m) o[k.slice(2)] = v; return o; }

  async join(ws, q) {
    if (this.sockets().length >= MAX_PEOPLE) return false;
    const info = { id:Math.random().toString(36).slice(2, 10), room:q.room, kind:q.kind, dev:clean(q.dev, 40), name:clean(q.name, 40) || "A device", app:/^(windows|iphone|web)$/.test(q.app || "") ? q.app : "web" };
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment(info);
    await this.ctx.storage.put("room", { k:q.room, kind:q.kind });
    ws.send(JSON.stringify({ t:"hi", you:info.id, kind:q.kind, peers:this.peers(), store:await this.store() }));
    this.others(ws, { t:"peers", peers:this.peers() });
    if (q.kind === "game") await this.ctx.storage.setAlarm(Date.now() + GAME_DAYS * 86400000);
    return true;
  }

  async webSocketMessage(ws, raw) {
    const me = this.info(ws);
    if (typeof raw !== "string" || raw.length > MAX_MSG) { ws.close(1009, "too big"); return; }
    const now = Date.now(), r = this.rate.get(me.id) || { at:now, n:0 };
    if (now - r.at > 10000) { r.at = now; r.n = 0; }
    if (++r.n > RATE) { ws.close(1008, "too fast"); return; }
    this.rate.set(me.id, r);
    let m = null; try { m = JSON.parse(raw); } catch (e) {}
    if (!m || typeof m !== "object") return;
    if (m.t === "ping") { ws.send('{"t":"pong"}'); return; }
    if (m.t === "msg") { this.others(ws, { t:"msg", d:m.d, from:me.id }, typeof m.to === "string" ? m.to : ""); return; }
    if (m.t === "set") {
      const k = clean(m.k, 60);
      if (!k || !/^[\w.:-]+$/.test(k)) return;
      const v = m.v === undefined ? null : m.v, s = JSON.stringify(v);
      if (s.length > MAX_VALUE) { ws.send(JSON.stringify({ t:"error", message:"That's too big to keep." })); return; }
      if (v === null) await this.ctx.storage.delete("s:" + k);
      else {
        const have = await this.ctx.storage.list({ prefix:"s:" });
        if (!have.has("s:" + k) && have.size >= MAX_KEYS) { ws.send(JSON.stringify({ t:"error", message:"This room is full of things." })); return; }
        await this.ctx.storage.put("s:" + k, v);
      }
      this.others(ws, { t:"set", k, v, from:me.id });
      if (me.kind === "game") await this.ctx.storage.setAlarm(Date.now() + GAME_DAYS * 86400000);
    }
  }
  async webSocketClose(ws) { const me = this.info(ws); this.rate.delete(me.id); try { ws.close(1000, "bye"); } catch (e) {} this.others(ws, { t:"peers", peers:this.peers().filter(p => p.id !== me.id) }); }
  async webSocketError(ws) { await this.webSocketClose(ws); }
  async alarm() { const r = await this.ctx.storage.get("room"); if (r && r.kind === "game") await this.ctx.storage.deleteAll(); }
}
