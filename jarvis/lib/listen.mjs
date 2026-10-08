/* Jarvis for Webs - the listening logic (pure, so it can be tested): telling your voice from quiet, keeping the last
   few seconds, and deciding when you've finished asking.

   Why the last few seconds are kept: by the time Windows has recognised "Jarvis", you've often already said the rest
   ("Jarvis, how do I make a furnace" in one breath). If recording only started then, it would hear silence and say
   "I didn't catch that". So while listening is on, the hidden worker feeds the microphone through here, the last
   ~12 seconds stay in memory (never saved, never sent), and a capture starts from the beginning of what you were
   just saying - "Jarvis" and all. Whisper then hears the whole thing, and wake.js takes the question after the name. */

export const RATE = 16000;            // what Whisper wants: 16 kHz mono
const KEEP_MS = 12000;                // how much is kept from before the wake word
const GAP_MS = 700;                   // a pause longer than this starts a new "thing you said"
const END_MS = 1200;                  // you've finished once you've been quiet this long
const ONE_BREATH_MS = 1400;           // said more than this before Windows heard the name -> the question's already in
const WAIT_WAKE_MS = 3500;            // just the name so far: give you this long to start asking
const WAIT_ONCE_MS = 4500;            // the hotkey: this long to start talking
const MAX_MS = 15000;                 // never record longer than this after it starts
const MAX_SAMPLES = RATE * 28;        // Whisper hears up to 30 s at a time

// mix down to 16 kHz mono Float32, the simple way (averaging)
export function to16k(input, inRate) {
  const ratio = inRate / RATE, outLen = Math.max(1, Math.floor(input.length / ratio)), out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let s = 0, n = 0; for (let j = a; j < b; j++) { s += input[j]; n++; }
    out[i] = n ? s / n : 0;
  }
  return out;
}

export function level(d) {
  let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  return d.length ? Math.sqrt(s / d.length) : 0;
}

// when a capture is done (pure: the capture so far and the time now)
export function shouldStop(c, now) {
  const since = now - c.at, quiet = now - c.lastVoice;
  if (since > MAX_MS) return true;
  if (c.after) return quiet > END_MS;                                         // you kept talking: stop once you're done
  if (c.mode === "wake" && c.preVoiceMs > ONE_BREATH_MS) return quiet > 700;  // asked in one breath: go now
  return since > (c.mode === "wake" ? WAIT_WAKE_MS : WAIT_ONCE_MS);           // nothing yet: wait a few seconds
}

export function createListener() {
  let ring = [], noise = 0.005, speechStart = 0, lastVoice = -1e12, cap = null;

  function finish() {
    const c = cap; cap = null;
    let total = 0; for (const d of c.chunks) total += d.length;
    const n = Math.min(total, MAX_SAMPLES), audio = new Float32Array(n);
    // keep the END if it's too long (the question comes after the name)
    let skip = total - n, o = 0;
    for (const d of c.chunks) {
      if (skip >= d.length) { skip -= d.length; continue; }
      const part = skip ? d.subarray(skip) : d; skip = 0;
      audio.set(part, o); o += part.length;
    }
    return { mode: c.mode, audio, voiced: c.anyVoice };
  }

  return {
    // one chunk of 16 kHz audio that ended at `now` (ms). Returns a finished capture { mode, audio, voiced } or null.
    push(d, now) {
      const lv = level(d), ms = d.length / RATE * 1000;
      // voice = clearly louder than the room's usual noise (which it keeps learning, slowly)
      const voiced = lv > Math.max(0.01, noise * 3);
      // the room's noise: follow it down quickly, but creep up only slowly - so a steady fan or game sound is
      // learned within seconds, while a few seconds of you talking barely moves it
      if (lv < noise) noise = noise * 0.9 + lv * 0.1;
      else noise = Math.min(noise * 1.003, lv);
      noise = Math.min(0.08, Math.max(0.001, noise));
      if (voiced) { if (now - lastVoice > GAP_MS) speechStart = now - ms; lastVoice = now; }
      ring.push({ t: now, d, v: voiced });
      while (ring.length && now - ring[0].t > KEEP_MS) ring.shift();
      if (!cap) return null;
      cap.chunks.push(d);
      if (voiced) { cap.anyVoice = true; cap.lastVoice = now; if (now - cap.at > 150) cap.after = true; }
      return shouldStop(cap, now) ? finish() : null;
    },
    // start a capture. "wake": from the start of what you were just saying (it has the name in it). "once": from now.
    start(mode, now) {
      const recent = now - lastVoice < 1500;
      let from;
      if (mode === "wake") from = recent ? Math.max(now - KEEP_MS, speechStart - 300) : now - 2000;
      else from = now - 300;
      const pre = ring.filter(c => c.t > from);
      cap = {
        mode, at: now, chunks: pre.map(c => c.d), anyVoice: pre.some(c => c.v),
        lastVoice: mode === "wake" && recent ? lastVoice : now, after: false,
        preVoiceMs: mode === "wake" && recent ? lastVoice - speechStart : 0
      };
    },
    cancel() { cap = null; },
    // called every second or so: if the microphone stopped sending sound mid-question (unplugged, Windows switched
    // devices...), finish the capture anyway instead of waiting forever
    tick(now) { return cap && shouldStop(cap, now) ? finish() : null; },
    get capturing() { return !!cap; },
    // for the tests
    get noise() { return noise; }
  };
}
