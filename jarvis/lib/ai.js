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
  s += (hasImage ? "A screenshot of their screen (the monitor their mouse is on) is attached: it is exactly what they're looking at right now, so look at it and answer from it.\n" : "No screenshot is attached this time.\n");
  s += "</now>";
  return s;
}

// question: the words after the wake word. imageDataUrl: "data:image/jpeg;base64,..." or null.
function buildBody(opt) {
  opt = opt || {};
  const cfg = opt.cfg || {};
  const q = String(opt.question || "").trim().slice(0, 2000);
  const image = cfg.sendScreenshot && typeof opt.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(opt.imageDataUrl) ? opt.imageDataUrl : null;
  const text = context(cfg, opt.now, !!image) + "\n\n" + q;
  const body = {
    task: "jarvis",
    device: cfg.device || "",
    messages: [{ role: "user", content: text }]
  };
  if (cfg.code) body.code = cfg.code;
  if (cfg.callYou || cfg.style) body.prefs = (cfg.callYou ? "Call me " + cfg.callYou + ". " : "") + (STYLE_TEXT[cfg.style] || "");
  if (image) body.image = { data: image };
  return body;
}

// one NDJSON line from the stream -> { text } (a piece of the answer), { end, left } (done), or { error }
function parseLine(line) {
  line = String(line || "").trim();
  if (!line) return null;
  let j; try { j = JSON.parse(line); } catch (e) { return null; }
  if (j.error) return { error: j.message || j.error };
  if (j.end) return { end: true, left: j.unlimited ? null : typeof j.left === "number" ? j.left : null, unlimited: !!j.unlimited, stop: j.stop || "" };
  if (typeof j.d === "string") return { text: j.d };
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

module.exports = { buildBody, parseLine, streamReader, cleanForSpeech, cleanForShow, context, STYLE_TEXT };
