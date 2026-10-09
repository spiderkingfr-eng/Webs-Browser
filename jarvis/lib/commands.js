/* Jarvis for Webs - things it does right here on your PC, instantly and for free, without asking the server:
   timers and reminders, opening websites, the time and the date. parse(text) -> a command, or null for a normal
   question. Pure functions, so they can be tested. */
"use strict";

// lower case, no punctuation except what a web address needs; "please" and "for me" dropped
function clean(text) {
  return String(text || "").toLowerCase()
    .replace(/[^a-z0-9.'\s:-]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/[.:\s]+$/, "")
    .replace(/^(?:can you |could you |would you |will you |please |ok |okay |hey )+/, "")
    .replace(/(?: for me)?(?: please)?$/, "").trim();
}

const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, "twenty five": 25, thirty: 30, forty: 40, "forty five": 45, fifty: 50, sixty: 60, ninety: 90 };
const UNIT = { s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000, m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
  h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000 };
const NUMBER = "(\\d+(?:\\.\\d+)?|twenty five|forty five|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety)";
const UNITS = "(seconds?|secs?|minutes?|mins?|hours?|hrs?|s|m|h)";
const DURATION = "(half an hour|an hour and a half|" + NUMBER + " ?" + UNITS + "(?: and (?:a half|" + NUMBER + " ?" + UNITS + "))?)";

// "10 minutes", "an hour and a half", "2 hours and 15 minutes", "half an hour" -> milliseconds (or 0)
function duration(s) {
  s = clean(s);
  if (s === "half an hour") return 30 * 60000;
  if (s === "an hour and a half") return 90 * 60000;
  const re = new RegExp("^" + NUMBER + " ?" + UNITS + "(?: and (a half|" + NUMBER + " ?" + UNITS + "))?$");
  const m = re.exec(s);
  if (!m) return 0;
  const num = x => WORDS[x] != null ? WORDS[x] : parseFloat(x);
  let ms = num(m[1]) * UNIT[m[2]];
  if (m[3] === "a half") ms += UNIT[m[2]] / 2;
  else if (m[4]) ms += num(m[4]) * UNIT[m[5]];
  return ms > 0 && ms <= 24 * 3600000 ? Math.round(ms) : 0;
}

// 90000 -> "1 minute 30 seconds"
function say(ms) {
  ms = Math.max(0, Math.round(ms / 1000)) * 1000;
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  const part = (n, w) => n ? n + " " + w + (n === 1 ? "" : "s") : "";
  return [part(h, "hour"), part(m, "minute"), h ? "" : part(s, "second")].filter(Boolean).join(" ") || "0 seconds";
}

// sites you can open by name ("open YouTube"); any web address works too ("open minecraft.net")
const SITES = {
  youtube: "https://www.youtube.com", google: "https://www.google.com", gmail: "https://mail.google.com", discord: "https://discord.com/app",
  twitch: "https://www.twitch.tv", reddit: "https://www.reddit.com", github: "https://github.com", spotify: "https://open.spotify.com",
  netflix: "https://www.netflix.com", amazon: "https://www.amazon.com", wikipedia: "https://www.wikipedia.org", twitter: "https://x.com",
  x: "https://x.com", tiktok: "https://www.tiktok.com", instagram: "https://www.instagram.com", "minecraft wiki": "https://minecraft.wiki",
  crunchyroll: "https://www.crunchyroll.com", roblox: "https://www.roblox.com", steam: "https://store.steampowered.com", "google maps": "https://maps.google.com"
};

function parse(text) {
  const t = clean(text);
  if (!t) return null;
  let m;
  // timers
  if ((m = new RegExp("^(?:set |start |make )?(?:a |me a |up a )?timer (?:for |of )?" + DURATION + "$").exec(t)) ||
      (m = new RegExp("^(?:set |start )?(?:a )?" + DURATION + " timer$").exec(t))) {
    const ms = duration(m[1]); return ms ? { kind: "timer", ms } : null;
  }
  // reminders: "remind me in 10 minutes to take the pizza out" / "remind me to stretch in an hour"
  if ((m = new RegExp("^remind me (?:in|after) " + DURATION + " (?:to |that |about )?(.+)$").exec(t))) {
    const ms = duration(m[1]); return ms ? { kind: "remind", ms, text: m[m.length - 1] } : null;
  }
  if ((m = new RegExp("^remind me (?:to |that |about )(.+?) (?:in|after) " + DURATION + "$").exec(t))) {
    const ms = duration(m[2]); return ms ? { kind: "remind", ms, text: m[1] } : null;
  }
  if (/^(?:cancel|stop|clear|delete|remove|turn off) (?:the |my |all |all the |all my )?(?:timers?|reminders?|alarms?)(?: and reminders?)?$/.test(t)) return { kind: "cancel" };
  if (/^(?:what|which|any) (?:timers?|reminders?)(?: do i have| have i got| are (?:set|there|running|on))?$/.test(t) ||
      /^how (?:long|much time)(?: is| have i got| do i have)? left(?: on (?:the|my) timer)?$/.test(t)) return { kind: "list" };
  // the time and the date
  if (/^(?:what time is it|what's the time|what is the time|tell me the time)(?: now| right now)?$/.test(t)) return { kind: "time" };
  if (/^(?:what's|what is) (?:the date|today's date|the date today)$|^what day is it(?: today)?$|^what's today$/.test(t)) return { kind: "date" };
  // opening a website
  if ((m = /^(?:open|go to|launch|pull up|bring up|load|take me to) (?:up )?(?:the )?(.+?)(?: website| site| page| in my browser)?$/.exec(t))) {
    const name = m[1].trim();
    if (SITES[name]) return { kind: "open", name, url: SITES[name] };
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/.test(name)) return { kind: "open", name, url: "https://" + name };
  }
  return null;
}

// "remind me to call my mom" -> "call your mom" (said back to you)
const you = text => String(text || "").replace(/\bmyself\b/g, "yourself").replace(/\bmy\b/g, "your").replace(/\bmine\b/g, "yours")
  .replace(/\bi'm\b/g, "you're").replace(/\bme\b/g, "you").replace(/\bi\b/g, "you");

// "explain what I copied", "summarise my clipboard" - only then is the clipboard looked at (and sent with the question)
const wantsClipboard = text => /\b(?:clipboard|(?:i|i've|i have|i just) (?:just )?copied|what's copied|the copied)\b/i.test(String(text || ""));

module.exports = { parse, duration, say, clean, you, wantsClipboard, SITES };
