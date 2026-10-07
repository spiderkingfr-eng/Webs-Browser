/* Jarvis for Webs - hearing the wake word.
   The speech model (vosk) keeps turning what the microphone hears into text. detect(transcript, name) looks for the
   wake word in it ("jarvis", or "hey jarvis", or the name you chose) and gives back the words that came after it -
   your actual question. So "jarvis how do i make a furnace" -> { hit:true, question:"how do i make a furnace" }. */
"use strict";

const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();

// a few ways the model might hear common names, so the wake word is forgiving
const ALSO = {
  jarvis: ["jarvis", "jervis", "jarvais", "jar vis", "javis", "service"],
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
    const re = new RegExp("(?:^|\\b)(?:hey |ok |okay |yo )?" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b[\\s,.:-]*", "i");
    const m = re.exec(t);
    if (m) {
      const q = t.slice(m.index + m[0].length).trim();
      return { hit: true, question: q, wake: w };
    }
  }
  return { hit: false, question: "" };
}

// a spoken question is "ready" once it has a few words and the person has paused (handled by vosk's final result)
function looksComplete(question) {
  const words = norm(question).split(" ").filter(Boolean);
  return words.length >= 2;
}

module.exports = { detect, variants, norm, looksComplete };
