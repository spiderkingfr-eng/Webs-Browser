/* Jarvis for Webs - hearing the wake word.
   detect(transcript, name) looks for the wake word in what was heard ("jarvis", or "hey jarvis", or the name you
   chose) and gives back the words that came after it - your actual question. So "jarvis how do i make a furnace" ->
   { hit:true, question:"how do i make a furnace" }. afterWake() is for when Windows has already heard the name and
   Whisper heard the whole thing: it also copes with Whisper spelling the name a bit differently ("Jarvus", "Jarvas"). */
"use strict";

const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();

// a few ways the model might hear common names, so the wake word is forgiving
const ALSO = {
  jarvis: ["jarvis", "jervis", "jarvais", "jar vis", "javis", "jarvus", "jarvas", "jarves"],     // (not "service": too common)
  friday: ["friday", "fry day"],
  computer: ["computer", "computor"],
  alexa: ["alexa", "alexis"],
  echo: ["echo"],
  cortana: ["cortana"]
};

function variants(name) {
  const n = norm(name) || "jarvis";
  const set = new Set([n]);
  (ALSO[n] || []).forEach(v => set.add(v));
  return [...set].sort((a, b) => b.length - a.length);     // try the longest first
}

// find the wake word anywhere near the start and return what follows as the question
function detect(transcript, name) {
  const t = norm(transcript);
  if (!t) return { hit: false, question: "" };
  for (const w of variants(name)) {
    // "hey jarvis ...", "ok jarvis ...", "jarvis ..."
    const re = new RegExp("(?:^|\\b)(?:hey |ok |okay |yo )?" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:'s)?\\b[\\s,.:-]*", "i");
    const m = re.exec(t);
    if (m) {
      const q = t.slice(m.index + m[0].length).trim();
      return { hit: true, question: q, wake: w };
    }
  }
  return { hit: false, question: "" };
}

// how many single-letter changes turn a into b
function distance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// Did Whisper (which hears far better than Windows' quick wake-word spotter) actually hear the name? Windows only
// gives the first hint - it sometimes fires on other words - so the name has to be in what Whisper heard too.
// -> { hit, question } (the question is what follows the name). A word close to the name counts ("Jarvus").
function heardName(transcript, name) {
  const d = detect(transcript, name);
  if (d.hit) return { hit: true, question: d.question };
  const words = norm(transcript).split(" ").filter(Boolean);
  const target = (norm(name) || "jarvis").replace(/\s+/g, "");
  const near = Math.max(1, Math.floor(target.length / 3));
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/'s$/, "");
    if (w.length >= 3 && distance(w, target) <= near) return { hit: true, question: words.slice(i + 1).join(" ") };
  }
  return { hit: false, question: "" };
}
// the question after the name (or everything, if the name wasn't heard)
function afterWake(transcript, name) {
  const h = heardName(transcript, name);
  return h.hit ? h.question : norm(transcript);
}

// "stop", "shut up", "be quiet"... - what you'd say to make it stop talking
const STOP = /^(?:ok |okay )?(?:stop|stop it|stop talking|shut up|be quiet|quiet|enough|that's enough|thats enough|hush|silence|cancel|never ?mind)(?: please)?$/;
const isStop = text => STOP.test(norm(text));

// a spoken question is "ready" once it has a few words and the person has paused (handled by vosk's final result)
function looksComplete(question) {
  const words = norm(question).split(" ").filter(Boolean);
  return words.length >= 2;
}

module.exports = { detect, heardName, afterWake, isStop, distance, variants, norm, looksComplete };
