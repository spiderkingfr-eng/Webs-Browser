/* Jarvis for Webs - which Claude model answers. "" = whatever your Web AI server is set to (the owner's dashboard);
   otherwise one of these, picked in Settings, the tray menu, or by saying "Jarvis, switch to Opus".
   (The server only lets your unlimited code pick - anyone else always gets the server's choice.) */
"use strict";

const MODELS = [
  { id: "", name: "Server's choice", note: "whatever your Web AI server is set to" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", note: "the smartest - the most expensive" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "very smart - less than half Fable's price" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "smart and quick - a fifth of Fable's price" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "the fastest and cheapest" }
];
const IDS = MODELS.map(m => m.id);

// "claude-opus-5-5" -> "Opus 5.5" (any model id, including a backup model that stepped in)
function short(id) {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(String(id || ""));
  if (!m) return "";
  return m[1][0].toUpperCase() + m[1].slice(1) + " " + m[2] + (m[3] ? "." + m[3] : "");
}
const nameOf = id => (MODELS.find(m => m.id === id) || {}).name || short(id) || "Server's choice";

// "switch to opus", "use the smartest model", "change the model to haiku please", "go back to default"
// -> the model's id ("" for the server's choice), or null if it isn't a request to switch
const WORDS = { fable: "claude-fable-5-1", opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5",
  smartest: "claude-fable-5-1", cheapest: "claude-haiku-5-5", fastest: "claude-haiku-5-5", default: "", normal: "", automatic: "", "server's choice": "" };
const SWITCH = new RegExp("^(?:please |ok |okay )?(?:switch(?: over| back)? to|change(?: the model)? to|set the model to|go(?: back)? to|use)\\s+(?:the )?(?:claude )?" +
  "(fable|opus|sonnet|haiku|smartest|cheapest|fastest|default|normal|automatic|server's choice)" +
  "(?: \\d+(?: \\d+)?| \\d+ point \\d+)?(?: model| one)?(?: please)?(?: from now on| now)?$");
function parseSwitch(text) {
  const t = String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
  const m = SWITCH.exec(t);
  return m ? WORDS[m[1]] : null;
}

module.exports = { MODELS, IDS, short, nameOf, parseSwitch };
