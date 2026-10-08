/* Jarvis for Webs - talking to your Web AI server (the same server the browser uses).
   buildBody() makes the request for POST /chat with task "jarvis": your question, a little about you and the moment,
   and (if you allowed it) a screenshot so it can see your screen. The answer streams back as NDJSON lines, which
   parseLine() reads. cleanForSpeech() tidies the text before it's read aloud. Pure functions, so they can be tested. */
"use strict";

const STYLE_TEXT = {
  calm: "Calm, quick and capable, with a little dry wit.",
  short: "As short as possible - a sentence or two.",
  friendly: "Warm and friendly, a little playful.",
  detailed: "Thorough: explain the steps and the why."
};

// the <assistant> and <now> blocks the server's jarvis prompt expects, adapted for the desktop overlay
function context(cfg, now, hasImage) {
  const name = (cfg && cfg.name) || "Jarvis";
  const call = cfg && cfg.callYou ? cfg.callYou : "";
  const style = STYLE_TEXT[cfg && cfg.style] || STYLE_TEXT.calm;
  let s = "<assistant>\nYour name is " + name + ".\n";
  if (call) s += "Call the person " + call + ".\n";
  s += "Style: " + style + "\n</assistant>\n";
  s += "<now>\nThe time is " + (now || new Date()).toString() + ".\n";
  s += "This is the desktop overlay, not the browser: there are no tabs or browser commands here, so never use [[do: ...]] commands - just answer.\n";
  s += "If they ask for a link, give it as a full https address on its own line: it shows as a button they can click." + (cfg && cfg.webSearch ? " Search the web to find the real page rather than guessing the address." : " Only give addresses you're sure of.") + "\n";
  s += (hasImage ? "A screenshot of their screen (the monitor their mouse is on) is attached: it is exactly what they're looking at right now, so look at it and answer from it.\n" : "No screenshot is attached this time.\n");
  s += "</now>";
  return s;
}

// question: the words after the wake word. imageDataUrl: "data:image/jpeg;base64,..." or null.
// history: the conversation so far ([{ q, a }], from createMemory) so follow-up questions make sense.
function buildBody(opt) {
  opt = opt || {};
  const cfg = opt.cfg || {};
  const q = String(opt.question || "").trim().slice(0, 2000);
  const earlier = (opt.history || []).filter(h => h && h.q && h.a)
    .flatMap(h => [{ role: "user", content: String(h.q).slice(0, 2000) }, { role: "assistant", content: String(h.a).slice(0, 3000) }]);
  const image = cfg.sendScreenshot && typeof opt.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(opt.imageDataUrl) ? opt.imageDataUrl : null;
  const text = context(cfg, opt.now, !!image) + "\n\n" + q;
  const body = {
    task: "jarvis",
    device: cfg.device || "",
    messages: earlier.concat([{ role: "user", content: text }])     // the screenshot (if any) goes with this last one
  };
  if (cfg.code) body.code = cfg.code;
  if (cfg.webSearch) body.search = true;      // it may look things up (real links, anything current)
  if (cfg.model) body.model = cfg.model;       // the model you picked (the server honours it for your unlimited code)
  if (cfg.callYou || cfg.style) body.prefs = (cfg.callYou ? "Call me " + cfg.callYou + ". " : "") + (STYLE_TEXT[cfg.style] || "");
  if (image) body.image = { data: image };
  return body;
}

// one NDJSON line from the stream -> { text } (a piece of the answer), { end, left } (done), { status } (what it's
// doing first: "search" / "fetch"), or { error }
function parseLine(line) {
  line = String(line || "").trim();
  if (!line) return null;
  let j; try { j = JSON.parse(line); } catch (e) { return null; }
  if (j.error) return { error: j.message || j.error };
  if (j.end) return { end: true, left: j.unlimited ? null : typeof j.left === "number" ? j.left : null, unlimited: !!j.unlimited, stop: j.stop || "", model: j.model || "", chose: !!j.chose };
  if (typeof j.d === "string") return { text: j.d };
  if (typeof j.s === "string") return { status: j.s };
  return null;
}

// feed raw chunks as they arrive; returns the complete lines found so far and keeps the rest
function streamReader() {
  let buf = "";
  return {
    push(chunk) {
      buf += chunk;
      const out = [];
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const r = parseLine(line); if (r) out.push(r); }
      return out;
    },
    end() { const r = parseLine(buf); buf = ""; return r ? [r] : []; }
  };
}

// before reading aloud: drop any stray [[do: ...]] commands and basic markdown, collapse whitespace
function cleanForSpeech(text) {
  return String(text || "")
    .replace(/\[\[\s*do\s*:[^\]]*\]\]/gi, " ")
    .replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "$1")     // links are shown, not read out
    .replace(/<?https?:\/\/[^\s>]+>?/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*([^*]*)\*/g, "$1")
    .replace(/^#+\s*/gm, "").replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ").trim();
}

// what the bubble shows: same cleanup but keep line breaks
function cleanForShow(text) {
  return String(text || "").replace(/\[\[\s*do\s*:[^\]]*\]\]/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

// The conversation so far, so you can ask follow-ups ("and how do I make it faster?"). Kept in memory only (never
// saved), the last few exchanges, and forgotten after a quiet spell or when you start a new chat.
function createMemory(opt) {
  opt = opt || {};
  const maxTurns = opt.maxTurns || 6, maxAgeMs = opt.maxAgeMs || 15 * 60 * 1000;
  let turns = [], last = 0;
  const fresh = now => { if (turns.length && now - last > maxAgeMs) turns = []; };
  return {
    add(q, a, now) {
      now = now || Date.now(); fresh(now);
      q = String(q || "").trim(); a = String(a || "").trim();
      if (!q || !a) return;
      turns.push({ q, a }); last = now;
      if (turns.length > maxTurns) turns = turns.slice(-maxTurns);
    },
    list(now) { fresh(now || Date.now()); return turns.slice(); },
    size(now) { fresh(now || Date.now()); return turns.length; },
    clear() { turns = []; }
  };
}

// The voice starts as soon as the first sentence is written (the rest follows when the answer's done), so you hear it
// sooner. -> where the first whole sentence ends in the answer so far (after its space), or -1 if not yet.
function speakCut(text) {
  text = String(text || "");
  const re = /[.!?]["')\]]*\s+/g;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (end < 20) continue;                                       // too short to be worth it on its own ("Sure. ")
    const head = text.slice(0, end);
    if (/\[\[[^\]]*$/.test(head) || (head.match(/```/g) || []).length % 2) return -1;     // not inside a command or code
    return end;
  }
  return -1;
}

// What's read aloud, in pieces the server will take (it says at most 600 characters at once): whole sentences where
// possible, else at a space.
function speechPieces(text, max) {
  max = max || 550;
  const out = [];
  let rest = String(text || "").trim();
  while (rest.length > max) {
    const head = rest.slice(0, max);
    let cut = -1, m; const re = /[.!?]["')\]]*\s/g;
    while ((m = re.exec(head))) cut = m.index + m[0].length;
    if (cut < max / 3) cut = head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") + 1 : max;
    out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// The answer as pieces for the bubble: plain text, and links to click - [a label](https://...) or a bare address.
// -> [{ text }, { text:"minecraft.wiki/w/Furnace", url:"https://minecraft.wiki/w/Furnace" }, ...]
const LINK = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|<?(https?:\/\/[^\s<>"'\]]+)>?/g;
function linkLabel(url) {
  try {
    const u = new URL(url);
    const rest = (u.pathname === "/" ? "" : decodeURIComponent(u.pathname)) + (u.search || "");
    const s = u.hostname.replace(/^www\./, "") + rest;
    return s.length > 48 ? s.slice(0, 46) + "…" : s;
  } catch (e) { return url.slice(0, 48); }
}
function linkParts(text) {
  text = String(text || "");
  const out = [];
  let last = 0, m;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text))) {
    let url = m[2] || m[3], end = m.index + m[0].length, label = m[1] || "";
    if (!m[2]) {          // a bare address: leave trailing punctuation (and an unmatched bracket) out of it
      const trail = /[.,;:!?)]+$/.exec(url);
      if (trail && !(trail[0].startsWith(")") && url.includes("("))) { url = url.slice(0, -trail[0].length); end -= trail[0].length; }
    }
    let ok = false; try { ok = /^https?:$/.test(new URL(url).protocol); } catch (e) {}
    if (!ok) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: label || linkLabel(url), url });
    last = end;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

module.exports = { buildBody, parseLine, streamReader, cleanForSpeech, cleanForShow, linkParts, createMemory, speakCut, speechPieces, context, STYLE_TEXT };
