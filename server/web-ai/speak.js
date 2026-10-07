/* Webs 3.13: the assistant's voice. POST /speak { code?, device?, text, voice? } -> audio/mpeg
   Turns one sentence or two of the assistant's answer into speech with ElevenLabs, using the server's own
   ELEVENLABS_KEY (a secret; the browser never sees it). The voice is "Adam", one of ElevenLabs' stock voices,
   unless the browser asks for another stock or designed voice by its id. Counted per person per day in
   characters (SPEAK_DAILY, 20,000 by default, about 25 minutes of talking) so a key can't be run dry - except for an
   unlimited code (the owner's own), which ElevenLabs' own plan still caps. */
export const ADAM = "pNInz6obpgDQGcFmaJgB";
const API = "https://api.elevenlabs.io/v1/text-to-speech/";
const MAX_TEXT = 600;

export function speakReady(env) { return !!String(env.ELEVENLABS_KEY || "").trim(); }

export async function speakApi(req, env, cors, ctx, h) {
  const out = (o, s) => h.json(o, s, cors);
  if (!speakReady(env)) return out({ error:"novoice", message:"The Web AI server has no voice key yet (ELEVENLABS_KEY): run setup.cmd and add one." }, 503);
  let body = null; try { body = await req.json(); } catch (e) {}
  if (!body || typeof body !== "object") return out({ error:"bad", message:"The browser sent something the server can't read." }, 400);
  const who = await h.person(env, body, req);
  if (!who) return out({ error:"code", message:"That Web AI code isn't right." }, 401);
  const oc = await h.ownerCfg(env);
  if (h.isBlocked(oc, who)) return out({ error:"blocked", message:"Web AI isn't available on this device." }, 403);
  if (oc.maint.on || oc.ai.paused) return out({ error:"paused", message:"Web AI is taking a break. Try again later." }, 503);
  const text = String(body.text == null ? "" : body.text).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return out({ error:"bad", message:"Nothing to say." }, 400);
  if (text.length > MAX_TEXT) return out({ error:"bad", message:"That's too much to say at once." }, 400);
  const voice = /^[A-Za-z0-9]{12,40}$/.test(String(body.voice || "")) ? String(body.voice) : ADAM;
  const daily = Math.max(0, parseInt(env.SPEAK_DAILY, 10) || 20000);
  const day = new Date().toISOString().slice(0, 10), key = "tts:" + day + ":" + who.id;
  const used = parseInt(await env.LIMITS.get(key), 10) || 0;
  if (!who.unlimited && used + text.length > daily) return out({ error:"limit", message:"The voice has talked enough for today. It's back tomorrow; until then Webs uses a Windows voice.", left:0 }, 429);
  let up;
  try {
    up = await fetch(API + voice + "?output_format=mp3_44100_64", { method:"POST",
      headers:{ "content-type":"application/json", "xi-api-key":String(env.ELEVENLABS_KEY).trim(), accept:"audio/mpeg" },
      body:JSON.stringify({ text, model_id:"eleven_flash_v2_5", voice_settings:{ stability:0.45, similarity_boost:0.8, style:0.15, use_speaker_boost:true } }) });
  } catch (e) { return out({ error:"voice", message:"Couldn't reach the voice service." }, 502); }
  if (!up.ok || !up.body) {
    const t = await up.text().catch(() => "");
    console.log("ElevenLabs error", up.status, t.slice(0, 300));
    const msg = up.status === 401 ? "The voice key (ELEVENLABS_KEY) isn't right." : up.status === 404 ? "That voice wasn't found." : up.status === 429 || /quota/i.test(t) ? "The voice service has used up its allowance." : "The voice service had a problem (" + up.status + ").";
    return out({ error:"voice", message:msg }, 502);
  }
  ctx.waitUntil(env.LIMITS.put(key, String(used + text.length), { expirationTtl:3 * 86400 }));
  return new Response(up.body, { headers:{ ...cors, "content-type":"audio/mpeg", "cache-control":"no-store", "x-voice-left":String(Math.max(0, daily - used - text.length)) } });
}
