/* ---------------------------------------------------------------- Webs 3.0
   150 more features, added on top of the code above without changing how it
   works: functions are wrapped (the original still runs), lists are extended,
   and new panels use the same openOver/listPanel/pickPanel helpers. What only
   a web page can do runs in shield.js (the x-… page tools). */
(function () {
"use strict";
const X3 = window.X3 = {};
Object.assign(P, {
  grid:"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  pic:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  wand:"M5 19L15 9M14 4v2M18 6l-1.5 1.5M20 10h-2M9 6l1 1M17 13l1 1",
  bolt:"M13 3L5 14h6l-1 7 8-11h-6z",
  battery:"M3 8h15v8H3zM20 11v2",
  palette:"M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.5 0-1-.8-1.4-.8-2.3 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4c0-4.7-4-8.6-9-8.6zM7.5 11h.01M10 7.5h.01M14 7.5h.01M16.5 11h.01",
  dice:"M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  archive:"M4 5h16v4H4zM5 9v10h14V9M10 13h4",
  mail:"M4 6h16v12H4zM4 7l8 6 8-6",
  lockx:"M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5zM12 14v3",
  hash:"M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"
});

/* ---------------------------------------------------------------- search engines and bangs */
const XENG = {
  ecosia:{ name:"Ecosia", url:"https://www.ecosia.org/search?q=" }, qwant:{ name:"Qwant", url:"https://www.qwant.com/?q=" },
  kagi:{ name:"Kagi", url:"https://kagi.com/search?q=" }, yahoo:{ name:"Yahoo", url:"https://search.yahoo.com/search?p=" },
  mojeek:{ name:"Mojeek", url:"https://www.mojeek.com/search?q=" }, yandex:{ name:"Yandex", url:"https://yandex.com/search/?text=" },
  // one-search places, reached with a bang
  yt:{ name:"YouTube", url:"https://www.youtube.com/results?search_query=" }, gh:{ name:"GitHub", url:"https://github.com/search?q=" },
  reddit:{ name:"Reddit", url:"https://www.reddit.com/search/?q=" }, amazon:{ name:"Amazon", url:"https://www.amazon.com/s?k=" },
  so:{ name:"Stack Overflow", url:"https://stackoverflow.com/search?q=" }, gmaps:{ name:"Google Maps", url:"https://www.google.com/maps/search/" },
  gimg:{ name:"Google Images", url:"https://www.google.com/search?tbm=isch&q=" }, gnews:{ name:"Google News", url:"https://news.google.com/search?q=" },
  wa:{ name:"Wolfram Alpha", url:"https://www.wolframalpha.com/input?i=" }, mdn:{ name:"MDN Web Docs", url:"https://developer.mozilla.org/en-US/search?q=" },
  npm:{ name:"npm", url:"https://www.npmjs.com/search?q=" }, imdb:{ name:"IMDb", url:"https://www.imdb.com/find/?q=" },
  xcom:{ name:"X", url:"https://x.com/search?q=" }, spotify:{ name:"Spotify", url:"https://open.spotify.com/search/" },
  tiktok:{ name:"TikTok", url:"https://www.tiktok.com/search?q=" }, pinterest:{ name:"Pinterest", url:"https://www.pinterest.com/search/pins/?q=" },
  ebay:{ name:"eBay", url:"https://www.ebay.com/sch/i.html?_nkw=" }, wayback:{ name:"Wayback Machine", url:"https://web.archive.org/web/*/" },
  scholar:{ name:"Google Scholar", url:"https://scholar.google.com/scholar?q=" }, gtr:{ name:"Google Translate", url:"https://translate.google.com/?sl=auto&op=translate&text=" },
  custom:{ name:"Your search engine", url:"https://duckduckgo.com/?q=" }
};
Object.keys(XENG).forEach(k => { if (!ENGINES[k]) ENGINES[k] = XENG[k]; });
Object.assign(BANGS, { "!eco":"ecosia", "!q":"qwant", "!k":"kagi", "!y":"yahoo", "!mj":"mojeek", "!ya":"yandex", "!my":"custom",
  "!yt":"yt", "!gh":"gh", "!r":"reddit", "!a":"amazon", "!so":"so", "!m":"gmaps", "!i":"gimg", "!n":"gnews", "!wa":"wa", "!mdn":"mdn",
  "!npm":"npm", "!imdb":"imdb", "!x":"xcom", "!sp":"spotify", "!tt":"tiktok", "!pin":"pinterest", "!eb":"ebay", "!wb":"wayback", "!sch":"scholar", "!tr":"gtr" });
X3.BANG_LIST = Object.keys(BANGS);
// Your own engine: any address with %s where the search goes.
let customTail = "";
function customEngine() {
  const u = String(cfg.xCustomUrl || "").trim();
  const ok = /^https?:\/\/[^\s]+%s/i.test(u);
  ENGINES.custom.name = ok ? (String(cfg.xCustomName || "").trim().slice(0, 40) || hostOf(u.replace("%s", "x")) || "Your search engine") : "Your search engine";
  ENGINES.custom.url = ok ? u.slice(0, u.indexOf("%s")) : "https://duckduckgo.com/?q=";
  customTail = ok ? u.slice(u.indexOf("%s") + 2) : "";
}
customEngine();
const resolve0 = resolve;
resolve = function (q) {
  const r = resolve0(q);
  if (r && customTail && r.indexOf(ENGINES.custom.url) === 0 && !r.endsWith(customTail)) return r + customTail;
  return r;
};

/* ---------------------------------------------------------------- more address bar answers */
const num = s => +String(s).replace(/,/g, "");
const money = v => (+v).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
const plural = (n, w) => fmtN(n, 0) + " " + w + (Math.round(n) === 1 ? "" : "s");
const asyncCache = {};
function later(key, make, q) {
  // an answer that needs the network or a promise: shown when it arrives
  if (asyncCache[key] === undefined) {
    asyncCache[key] = null;
    Promise.resolve().then(make).then(v => { asyncCache[key] = v || false; }, () => { asyncCache[key] = false; })
      .then(() => { if (overlay === "drop" && $("#url").value.trim() === q) suggest(); });
  }
  return asyncCache[key];
}
const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function toRoman(n) { let s = ""; ROMAN.forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } }); return s; }
function fromRoman(s) {
  s = s.toUpperCase(); let n = 0, i = 0;
  ROMAN.forEach(([v, r]) => { while (s.startsWith(r, i)) { n += v; i += r.length; } });
  return i === s.length && n > 0 && toRoman(n) === s ? n : null;
}
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const BIG = ["", " thousand", " million", " billion", " trillion", " quadrillion"];
function words999(n) {
  const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(ONES[h] + " hundred");
  if (r) out.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : ""));
  return out.join(" and ");
}
function inWords(n) {
  if (n === 0) return "zero";
  const neg = n < 0; n = Math.abs(n);
  const parts = []; let i = 0;
  while (n > 0 && i < BIG.length) { const c = n % 1000; if (c) parts.unshift(words999(c) + BIG[i]); n = Math.floor(n / 1000); i++; }
  return (neg ? "minus " : "") + parts.join(", ");
}
const b64e = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64d = s => new TextDecoder("utf-8", { fatal:true }).decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
const MORSE = { a:".-", b:"-...", c:"-.-.", d:"-..", e:".", f:"..-.", g:"--.", h:"....", i:"..", j:".---", k:"-.-", l:".-..", m:"--", n:"-.", o:"---", p:".--.", q:"--.-", r:".-.",
  s:"...", t:"-", u:"..-", v:"...-", w:".--", x:"-..-", y:"-.--", z:"--..", 0:"-----", 1:".----", 2:"..---", 3:"...--", 4:"....-", 5:".....", 6:"-....", 7:"--...", 8:"---..", 9:"----.",
  ".":".-.-.-", ",":"--..--", "?":"..--..", "!":"-.-.--", "'":".----.", "/":"-..-.", "(":"-.--.", ")":"-.--.-", "&":".-...", ":":"---...", "=":"-...-", "+":".-.-.", "-":"-....-", "@":".--.-." };
const MORSE_BACK = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const FLIP = { a:"ɐ", b:"q", c:"ɔ", d:"p", e:"ǝ", f:"ɟ", g:"ƃ", h:"ɥ", i:"ᴉ", j:"ɾ", k:"ʞ", l:"l", m:"ɯ", n:"u", o:"o", p:"d", q:"b", r:"ɹ", s:"s", t:"ʇ", u:"n", v:"ʌ", w:"ʍ", x:"x", y:"ʎ", z:"z",
  A:"∀", B:"ᗺ", C:"Ɔ", D:"ᗡ", E:"Ǝ", F:"Ⅎ", G:"⅁", H:"H", I:"I", J:"ſ", K:"ʞ", L:"˥", M:"W", N:"N", O:"O", P:"Ԁ", Q:"Ό", R:"ᴚ", S:"S", T:"⊥", U:"∩", V:"Λ", W:"M", X:"X", Y:"⅄", Z:"Z",
  1:"Ɩ", 2:"ᄅ", 3:"Ɛ", 4:"ㄣ", 5:"ϛ", 6:"9", 7:"ㄥ", 8:"8", 9:"6", 0:"0", ".":"˙", ",":"'", "'":",", "?":"¿", "!":"¡", "(":")", ")":"(", "[":"]", "]":"[", "{":"}", "}":"{", "<":">", ">":"<", "&":"⅋", "_":"‾" };
const KAO = { shrug:"¯\\_(ツ)_/¯", "table flip":"(╯°□°)╯︵ ┻━┻", tableflip:"(╯°□°)╯︵ ┻━┻", "flip table":"(╯°□°)╯︵ ┻━┻", unflip:"┬─┬ノ( º _ ºノ)", "put the table back":"┬─┬ノ( º _ ºノ)",
  "lenny face":"( ͡° ͜ʖ ͡°)", "disapproval face":"ಠ_ಠ", "look of disapproval":"ಠ_ಠ", "bear face":"ʕ•ᴥ•ʔ", "sparkle face":"✧*｡٩(ˊᗜˋ*)و✧*｡", "happy face":"(◕‿◕)", "cry face":"(╥﹏╥)",
  "hug face":"(づ｡◕‿‿◕｡)づ", "magic face":"(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "fight face":"(ง'̀-'́)ง", "deal with it face":"(•_•) ( •_•)>⌐■-■ (⌐■_■)", "kawaii face":"(✿◠‿◠)", "wave face":"( ﾟ▽ﾟ)/" };
const EMOJI = ("smile 😄,grin 😁,laugh 😂,joy 😂,rofl 🤣,wink 😉,blush 😊,love 😍,heart eyes 😍,kiss 😘,cool 😎,thinking 🤔,neutral 😐,eye roll 🙄,sad 😢,cry 😭,angry 😠,rage 😡," +
  "scream 😱,shock 😮,sleep 😴,sick 🤢,party 🥳,clown 🤡,skull 💀,ghost 👻,alien 👽,robot 🤖,poop 💩,thumbs up 👍,thumbs down 👎,clap 👏,wave 👋,pray 🙏,muscle 💪,ok 👌,peace ✌️,fingers crossed 🤞," +
  "point up ☝️,raised hands 🙌,eyes 👀,brain 🧠,heart ❤️,red heart ❤️,orange heart 🧡,yellow heart 💛,green heart 💚,blue heart 💙,purple heart 💜,black heart 🖤,white heart 🤍,broken heart 💔,sparkling heart 💖," +
  "fire 🔥,100 💯,star ⭐,sparkles ✨,boom 💥,zap ⚡,lightning ⚡,rainbow 🌈,sun ☀️,moon 🌙,cloud ☁️,rain 🌧️,snow ❄️,snowman ⛄,umbrella ☂️,earth 🌍,rocket 🚀,airplane ✈️,car 🚗,bike 🚲,train 🚆," +
  "house 🏠,tree 🌳,flower 🌸,rose 🌹,sunflower 🌻,leaf 🍃,cactus 🌵,dog 🐶,cat 🐱,mouse 🐭,fox 🦊,bear 🐻,panda 🐼,koala 🐨,tiger 🐯,lion 🦁,cow 🐮,pig 🐷,frog 🐸,monkey 🐵,chicken 🐔,penguin 🐧,bird 🐦," +
  "unicorn 🦄,bee 🐝,butterfly 🦋,snake 🐍,turtle 🐢,fish 🐟,dolphin 🐬,whale 🐳,octopus 🐙,shark 🦈,apple 🍎,banana 🍌,grapes 🍇,strawberry 🍓,cherry 🍒,peach 🍑,avocado 🥑,pizza 🍕,burger 🍔,fries 🍟," +
  "hot dog 🌭,taco 🌮,sushi 🍣,ramen 🍜,cake 🍰,birthday 🎂,cookie 🍪,donut 🍩,ice cream 🍦,coffee ☕,tea 🍵,beer 🍺,wine 🍷,cocktail 🍸,popcorn 🍿,soccer ⚽,football 🏈,basketball 🏀,tennis 🎾,trophy 🏆," +
  "medal 🏅,game 🎮,controller 🎮,dice 🎲,music 🎵,guitar 🎸,microphone 🎤,headphones 🎧,movie 🎬,camera 📷,phone 📱,laptop 💻,computer 💻,keyboard ⌨️,book 📚,books 📚,pencil ✏️,pen 🖊️,memo 📝,calendar 📅," +
  "clock ⏰,hourglass ⏳,money 💰,dollar 💵,gem 💎,gift 🎁,balloon 🎈,confetti 🎉,tada 🎉,christmas tree 🎄,pumpkin 🎃,check ✅,cross ❌,warning ⚠️,question ❓,exclamation ❗,lock 🔒,key 🔑,bell 🔔,light bulb 💡," +
  "bulb 💡,magnet 🧲,hammer 🔨,wrench 🔧,gear ⚙️,link 🔗,pin 📌,mail 📧,envelope ✉️,package 📦,crown 👑,ring 💍,flag 🚩,checkered flag 🏁,eyes up 👀,nerd 🤓,zany 🤪,hug 🤗,shush 🤫,salute 🫡,melting 🫠").split(",").map(x => { const i = x.lastIndexOf(" "); return [x.slice(0, i), x.slice(i + 1)]; });
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
function lorem(n, unit) {
  const sents = LOREM.match(/[^.]+\./g).map(x => x.trim()), words = LOREM.replace(/[.,]/g, "").toLowerCase().split(" ");
  if (unit[0] === "w") { const w = []; for (let i = 0; i < n; i++) w.push(words[i % words.length]); const s = w.join(" "); return s.charAt(0).toUpperCase() + s.slice(1) + "."; }
  if (unit[0] === "s") { const s = []; for (let i = 0; i < n; i++) s.push(sents[i % sents.length]); return s.join(" "); }
  const p = []; for (let i = 0; i < n; i++) p.push(LOREM); return p.join("\n\n");
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
function factors(n) { const f = []; let d = 2; while (n > 1 && d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d += d === 2 ? 1 : 2; } if (n > 1) f.push(n); return f; }
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
function parseClock(h, m, ap) {
  h = +h; m = +(m || 0); ap = (ap || "").toLowerCase();
  if (h > 23 || m > 59 || (ap && (h < 1 || h > 12))) return null;
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  return h * 60 + m;
}
function parseHeight(s) {
  let m = /^(\d+(?:\.\d+)?)\s*(cm|m)$/.exec(s); if (m) return m[2] === "m" ? +m[1] : m[1] / 100;
  m = /^(\d)\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|in|inches)?)?$/.exec(s); if (m) return (m[1] * 12 + +(m[2] || 0)) * .0254;
  m = /^(\d{2}(?:\.\d+)?)\s*(?:in|inches|")$/.exec(s); if (m) return m[1] * .0254;
  return null;
}
function parseWeight(s) {
  const m = /^(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|pounds?|st|stone)$/.exec(s); if (!m) return null;
  return /^kg/.test(m[2]) ? +m[1] : /^(st|stone)/.test(m[2]) ? m[1] * 6.35029318 : m[1] * .45359237;
}
const pickCache = {};
const QUICK = [["history", "History", () => open1("history.html")], ["downloads", "Downloads", () => open1("history.html#downloads")],
  ["bookmarks", "Bookmarks", () => open1("history.html#bookmarks")], ["settings", "Settings", () => open1("settings.html")], ["games", "Games", () => open1("games.html")],
  ["recap", "Your browsing recap", () => { stFlush(); open1("recap.html"); }], ["screen time", "Screen time", () => { stFlush(); open1("insights.html"); }],
  ["whatsnew", "What's new", () => open1("whatsnew.html")], ["collections", "Collections", () => open1("collections.html")], ["storage", "Stored data", () => open1("storage.html")],
  ["tasks", "Task manager", () => open1("taskmgr.html")], ["notes", "Notes (sidebar)", () => openSide("notes")], ["todo", "To-do list (sidebar)", () => openSide("todo")],
  ["timer", "Timer and stopwatch (sidebar)", () => openSide("timer")], ["calc", "Calculator (sidebar)", () => openSide("calc")], ["tools", "Sidebar tools", () => openSide("xtools")],
  ["shortcuts", "Keyboard shortcuts", () => keysPanel()], ["page tools", "More page tools", () => X3.toolsPanel()]];

function moreAnswers(s, q) {
  const out = [], push = r => { if (r) out.push(r); };
  const l = s.toLowerCase(), now = new Date();
  let m;
  // BMI
  if ((m = /^bmi\s+(.+?)\s+(?:and\s+)?(\d.+)$/.exec(l))) {
    let a = parseWeight(m[1]), b = parseHeight(m[2]);
    if (!a || !b) { a = parseWeight(m[2]); b = parseHeight(m[1]); }
    if (a && b && b > .5 && b < 2.6) {
      const v = a / (b * b), c = v < 18.5 ? "underweight" : v < 25 ? "a healthy weight" : v < 30 ? "overweight" : "obese";
      push(ans("bmi", "BMI " + v.toFixed(1), "Body mass index: " + c + " (18.5-24.9 is the healthy range) · Enter to copy", { copy:v.toFixed(1) }));
    }
  }
  // age
  if ((m = /^(?:age|how old (?:am i|is someone|is a person)?)\s*(?:born\s+(?:on\s+)?|if born\s+(?:on\s+)?)?(.+?)\??$/.exec(l)) && /\d/.test(m[1])) {
    let d = parseDay(m[1], now);
    if (!d && /^\d{4}$/.test(m[1])) d = new Date(+m[1], 0, 1);
    if (d && d < now && now.getFullYear() - d.getFullYear() < 150) {
      let y = now.getFullYear() - d.getFullYear(), mo = now.getMonth() - d.getMonth(), dd = now.getDate() - d.getDate();
      if (dd < 0) { mo--; dd += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (mo < 0) { y--; mo += 12; }
      let next = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(next.getFullYear() + 1);
      const left = Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / dayMs);
      push(ans("age", plural(y, "year") + ", " + plural(mo, "month") + ", " + plural(dd, "day"), "Age · " + (left === 0 ? "happy birthday today!" : "next birthday in " + plural(left, "day")) + " · " + fmtN(Math.floor((now - d) / dayMs), 0) + " days old · Enter to copy", { copy:String(y) }));
    }
  }
  // loans and mortgages
  if ((m = /^(?:loan|mortgage|payment)\s+\$?([\d,.]+)\s*(k)?\s+(?:at\s+)?([\d.]+)\s*%\s+(?:for\s+|over\s+)?(\d+(?:\.\d+)?)\s*(years?|yrs?|y|months?|mo)$/.exec(l))) {
    const P0 = num(m[1]) * (m[2] ? 1000 : 1), r = m[3] / 100 / 12, n = Math.round(/^mo/.test(m[5]) ? +m[4] : m[4] * 12);
    if (P0 > 0 && n > 0) {
      const pay = r ? P0 * r / (1 - Math.pow(1 + r, -n)) : P0 / n;
      push(ans("loan", money(pay) + " a month", plural(n, "payment") + " · total " + money(pay * n) + " · interest " + money(pay * n - P0) + " · Enter to copy", { copy:pay.toFixed(2) }));
    }
  }
  // savings that grow
  if ((m = /^(?:save|savings|invest|compound)?\s*\$?([\d,.]+)\s*(k)?\s+at\s+([\d.]+)\s*%\s+(?:for\s+|over\s+)?(\d+)\s*(?:years?|yrs?|y)(?:\s+(?:plus|\+|adding|and)\s+\$?([\d,.]+)\s*(?:a|per|\/|each)\s*month)?$/.exec(l))) {
    const P0 = num(m[1]) * (m[2] ? 1000 : 1), r = m[3] / 100 / 12, n = m[4] * 12, add = m[5] ? num(m[5]) : 0;
    const fv = P0 * Math.pow(1 + r, n) + (r ? add * (Math.pow(1 + r, n) - 1) / r : add * n), paid = P0 + add * n;
    if (isFinite(fv)) push(ans("save", "= " + money(fv), "After " + plural(+m[4], "year") + " at " + m[3] + "% (monthly compounding) · you put in " + money(paid) + ", interest " + money(fv - paid) + " · Enter to copy", { copy:fv.toFixed(2) }));
  }
  // time between two clock times
  if ((m = /^(?:(?:time|hours?)\s+)?(?:between\s+|from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|till|-|and)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(l)) &&
      (m[2] || m[3] || m[5] || m[6] || /^(time|hours?|between|from)\b/.test(l))) {
    let a = parseClock(m[1], m[2], m[3] || (m[6] && +m[1] <= +m[4] ? m[6] : "")), b = parseClock(m[4], m[5], m[6]);
    if (a != null && b != null) {
      let d = b - a; if (d <= 0) d += 1440;
      const txt = Math.floor(d / 60) + " h" + (d % 60 ? " " + d % 60 + " min" : "");
      push(ans("span", txt, "Time between them" + (b - a <= 0 ? " (past midnight)" : "") + " · " + fmtN(d / 60, 2) + " hours · Enter to copy", { copy:fmtN(d / 60, 2) }));
    }
  }
  // Roman numerals
  if ((m = /^(\d{1,4})\s+(?:in|to|as)\s+roman(?: numerals?)?$/.exec(l)) && +m[1] > 0 && +m[1] < 4000) { const r = toRoman(+m[1]); push(ans("roman", r, m[1] + " in Roman numerals · Enter to copy", { copy:r })); }
  if ((m = /^(?:roman\s+(?:numerals?\s+)?([mdclxvi]+)|([mdclxvi]+)\s+(?:in|to|as)\s+(?:a\s+)?(?:number|numbers|arabic|decimal))$/.exec(l))) { const n = fromRoman(m[1] || m[2]); if (n) push(ans("roman", String(n), (m[1] || m[2]).toUpperCase() + " is " + n + " · Enter to copy", { copy:String(n) })); }
  // numbers in words
  if ((m = /^(?:spell(?: out)?\s+)?(-?[\d,]{1,21})(?:\s+(?:in|to|as)\s+words)?$/.exec(l)) && (/words$/.test(l) || /^spell/.test(l))) {
    const n = num(m[1]); if (Number.isSafeInteger(n)) { const w = inWords(n); push(ans("words", w.charAt(0).toUpperCase() + w.slice(1), fmtN(n, 0) + " in words · Enter to copy", { copy:w, wrap:1 })); }
  }
  // Base64 and URL encoding
  if ((m = /^(?:base64|b64)(?:\s+(encode|decode)[:\s]|:)\s*([\s\S]+)$/i.exec(s))) {
    const dec = (m[1] || "").toLowerCase() === "decode";
    try { const v = dec ? b64d(m[2].trim()) : b64e(m[2]); push(ans("b64", v, (dec ? "Decoded from" : "Encoded as") + " Base64 · Enter to copy", { copy:v, wrap:1 })); } catch (e) { if (dec) push(ans("b64", "That is not valid Base64", "Base64")); }
  }
  if ((m = /^url\s*(encode|decode):?\s+([\s\S]+)$/i.exec(s)) && (m[1].toLowerCase() === "encode" ? /[^A-Za-z0-9_.~-]/.test(m[2]) : /%[0-9a-f]{2}|\+/i.test(m[2]))) {
    try { const v = m[1].toLowerCase() === "encode" ? encodeURIComponent(m[2]) : decodeURIComponent(m[2].replace(/\+/g, " ")); push(ans("urlenc", v, "URL " + m[1].toLowerCase() + "d · Enter to copy", { copy:v, wrap:1 })); } catch (e) {}
  }
  // hashes
  if ((m = /^(sha-?1|sha-?256|sha-?384|sha-?512)(?::|\s+of)\s*([\s\S]+)$/i.exec(s))) {
    const alg = "SHA-" + m[1].replace(/\D/g, ""), text = m[2], key = alg + "|" + text;
    const v = later(key, () => crypto.subtle.digest(alg, new TextEncoder().encode(text)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")), q);
    push(v ? ans("hash", v, alg + " of the text · Enter to copy", { copy:v, wrap:1 }) : ans("hash", "Working it out…", alg));
  }
  // pick one
  if ((m = /^(?:pick|choose|decide)(?::|\s+(?:one\s+)?(?:from|between|of|for me)\b:?)\s*(.+)$/i.exec(s))) {
    const items = m[1].split(/\s*,\s*|\s+or\s+/i).map(x => x.trim()).filter(Boolean);
    if (items.length >= 2) {
      const key = items.join("|");
      if (!pickCache[key]) pickCache[key] = items[randInt(0, items.length - 1)];
      push(ans("pick", pickCache[key], "Picked at random from " + items.length + " · Enter to copy", { copy:pickCache[key] }));
    }
  }
  // placeholder text
  if ((m = /^lorem(?: ipsum)?(?:\s+(\d{1,2}))?(?:\s+(words?|sentences?|paragraphs?))?$/.exec(l))) {
    const n = Math.max(1, +(m[1] || (m[2] ? 3 : 1))), u = m[2] || "paragraphs", v = lorem(n, u);
    push(ans("lorem", v.slice(0, 160) + (v.length > 160 ? "…" : ""), "Placeholder text: " + n + " " + u.replace(/s$/, "") + (n === 1 ? "" : "s") + " · Enter to copy", { copy:v, wrap:1 }));
  }
  // Unix timestamps
  if (/^(?:unix|epoch|timestamp)(?: time)?(?: now)?$/.test(l)) { const v = String(Math.floor(Date.now() / 1000)); push(ans("unix", v, "Unix time now (seconds since 1970) · Enter to copy", { copy:v })); }
  if ((m = /^(?:(?:unix|epoch|timestamp)\s+(\d{9,13})|(\d{9,13})\s+(?:unix|epoch|timestamp))$/.exec(l))) {
    const t = +(m[1] || m[2]), d = new Date(String(m[1] || m[2]).length > 11 ? t : t * 1000);
    push(ans("unix", d.toLocaleString([], { dateStyle:"full", timeStyle:"medium" }), "Your time · UTC " + d.toISOString().replace("T", " ").slice(0, 19) + " · Enter to copy", { copy:d.toISOString() }));
  }
  if ((m = /^(.+?)\s+(?:to|in|as)\s+(?:unix|epoch|timestamp)$/.exec(l))) { const d = parseDay(m[1], now) || (Date.parse(m[1]) ? new Date(m[1]) : null); if (d) { const v = String(Math.floor(d / 1000)); push(ans("unix", v, longDate(d) + " as Unix time · Enter to copy", { copy:v })); } }
  // week number, year progress, leap years
  if (/^(?:what week is (?:it|this)|which week is (?:it|this)|week (?:number|no\.?)(?: today| now)?|current week(?: number)?|what is the week number)\??$/.test(l)) { const w = isoWeek(now); push(ans("week", "Week " + w, "ISO week number of " + now.getFullYear() + " · Enter to copy", { copy:String(w) })); }
  if (/^(?:year progress|how much of the year(?: is (?:gone|over|left))?|year (?:left|over|gone)|progress of the year)\??$/.test(l)) {
    const y0 = new Date(now.getFullYear(), 0, 1), y1 = new Date(now.getFullYear() + 1, 0, 1), p = (now - y0) / (y1 - y0) * 100;
    const bar = "▓".repeat(Math.round(p / 5)) + "░".repeat(20 - Math.round(p / 5));
    push(ans("yearp", bar + " " + p.toFixed(1) + "%", now.getFullYear() + " is " + p.toFixed(1) + "% done · " + plural(Math.ceil((y1 - now) / dayMs), "day") + " left · Enter to copy", { copy:p.toFixed(1) + "%" }));
  }
  if ((m = /^(?:is (\d{1,4}) a leap year|leap year (\d{1,4})|next leap year|when is the next leap year)\??$/.exec(l))) {
    const leap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0), y = +(m[1] || m[2] || 0);
    if (y) push(ans("leap", leap(y) ? "Yes, " + y + " is a leap year" : "No, " + y + " is not a leap year", "It has " + (leap(y) ? 366 : 365) + " days"));
    else { let n = now.getFullYear(); if (!leap(n) || now > new Date(n, 1, 29)) { n++; while (!leap(n)) n++; } push(ans("leap", "Next leap year: " + n, "February 29, " + n, { copy:String(n) })); }
  }
  // primes, factors, gcd and lcm
  if ((m = /^is (\d{1,15}) (?:a )?prime(?: number)?\??$/.exec(l))) {
    const n = +m[1], f = factors(n);
    push(ans("prime", n < 2 ? "No, " + n + " is not prime" : f.length === 1 ? "Yes, " + fmtN(n, 0) + " is prime" : "No - " + fmtN(n, 0) + " = " + f.join(" × "), "Prime check"));
  }
  if ((m = /^(?:prime )?factors?(?: of)?\s+(\d{1,15})$/.exec(l)) && +m[1] > 1) { const f = factors(+m[1]); push(ans("prime", f.join(" × "), (f.length === 1 ? "Prime number" : "Prime factors of " + fmtN(+m[1], 0)) + " · Enter to copy", { copy:f.join(" × ") })); }
  if ((m = /^(gcd|gcf|hcf|lcm)\s*(?:of\s*)?\(?\s*(\d+(?:\s*(?:,|\s|and)\s*\d+)+)\s*\)?$/.exec(l))) {
    const ns = m[2].split(/\s*(?:,|\s|and)\s*/).filter(Boolean).map(Number);
    const g = ns.reduce(gcd), lc = ns.reduce((a, b) => a / gcd(a, b) * b);
    const isL = m[1] === "lcm", v = isL ? lc : g;
    if (isFinite(v)) push(ans("gcd", "= " + fmtN(v, 0), (isL ? "Least common multiple" : "Greatest common divisor") + " of " + ns.join(", ") + " · Enter to copy", { copy:String(v) }));
  }
  // sum, average, median of a list
  if ((m = /^(sum|total|average|avg|mean|median|min|max|range|stats|statistics)(?:\s+of)?\s+(-?[\d.,]+(?:[\s;]+-?[\d.,]+|,\s*-?[\d.]+)+)$/.exec(l))) {
    const ns = m[2].split(/[\s;]+|,\s+|,(?=-?\d)/).map(x => +x.replace(/,/g, "")).filter(x => !isNaN(x));
    if (ns.length >= 2) {
      const sum = ns.reduce((a, b) => a + b, 0), avg = sum / ns.length, so = ns.slice().sort((a, b) => a - b);
      const med = so.length % 2 ? so[so.length >> 1] : (so[so.length / 2 - 1] + so[so.length / 2]) / 2;
      const k = m[1], v = /^(sum|total)$/.test(k) ? sum : /^(average|avg|mean)$/.test(k) ? avg : k === "median" ? med : k === "min" ? so[0] : k === "max" ? so[so.length - 1] : k === "range" ? so[so.length - 1] - so[0] : null;
      const all = "sum " + fmtN(sum, 4) + " · average " + fmtN(avg, 4) + " · median " + fmtN(med, 4) + " · min " + fmtN(so[0], 4) + " · max " + fmtN(so[so.length - 1], 4) + " · " + ns.length + " numbers";
      push(v == null ? ans("stats", all, "Statistics", { copy:all, wrap:1 }) : ans("stats", "= " + fmtN(v, 6), all + " · Enter to copy", { copy:String(+v.toFixed(10)) }));
    }
  }
  // running pace
  if ((m = /^pace\s+([\d.]+)\s*(km|k|mi|miles?|m|meters?)\s+(?:in\s+)?(\d{1,3}(?::\d{2}){0,2})\s*(min|mins|minutes|h|hours?)?$/.exec(l))) {
    const dist = /^(mi|mile)/.test(m[2]) ? m[1] * 1.609344 : /^m/.test(m[2]) ? m[1] / 1000 : +m[1];
    const p = m[3].split(":").map(Number);
    let secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * (/^h/.test(m[4] || "") ? 3600 : 60);
    if (dist > 0 && secs > 0) {
      const f = x => Math.floor(x / 60) + ":" + String(Math.round(x % 60)).padStart(2, "0");
      push(ans("pace", f(secs / dist) + " per km", f(secs / dist * 1.609344) + " per mile · " + fmtN(dist / secs * 3600, 2) + " km/h · Enter to copy", { copy:f(secs / dist) }));
    }
  }
  // download time
  if ((m = /^(?:download(?: time)?|transfer(?: time)?|how long to download)\s+([\d.]+)\s*(kb|mb|gb|tb)\s+(?:at|@|on|with)\s+([\d.]+)\s*(kbps|mbps|gbps|kb\/s|mb\/s|gb\/s)$/.exec(l))) {
    const bytes = m[1] * { kb:1e3, mb:1e6, gb:1e9, tb:1e12 }[m[2]];
    const bps = m[3] * { kbps:1e3, mbps:1e6, gbps:1e9, "kb/s":8e3, "mb/s":8e6, "gb/s":8e9 }[m[4]];
    const sec = bytes * 8 / bps;
    if (isFinite(sec) && sec > 0) push(ans("dl", fmtDur(Math.max(1, Math.round(sec))), "To download " + m[1] + " " + m[2].toUpperCase() + " at " + m[3] + " " + m[4] + " (at full speed) · Enter to copy", { copy:fmtDur(Math.max(1, Math.round(sec))) }));
  }
  // aspect ratio and screens
  if ((m = /^(?:(?:aspect )?ratio\s+(?:of\s+)?(\d{2,5})\s*[x×*:]\s*(\d{2,5})|(\d{2,5})\s*[x×*]\s*(\d{2,5})\s+(?:aspect )?ratio)$/.exec(l))) {
    const w = +(m[1] || m[3]), h = +(m[2] || m[4]), g = gcd(w, h), r = w / g + ":" + h / g;
    push(ans("ratio", r, w + " × " + h + " · " + (w / h).toFixed(3) + " to 1 · Enter to copy", { copy:r }));
  }
  if ((m = /^(\d{1,3}):(\d{1,3})\s+(?:at\s+)?(\d{2,5})\s*(?:px\s*)?(wide|w|width|tall|h|height|high)?$/.exec(l))) {
    const a = +m[1], b = +m[2], v = +m[3], tall = /^(tall|h|height|high)$/.test(m[4] || "");
    const w = tall ? Math.round(v * a / b) : v, h = tall ? v : Math.round(v * b / a);
    push(ans("ratio", w + " × " + h, a + ":" + b + " at " + v + " px " + (tall ? "tall" : "wide") + " · Enter to copy", { copy:w + "x" + h }));
  }
  if ((m = /^ppi\s+(?:(\d{3,5})\s*[x×]\s*(\d{3,5})\s+([\d.]+)\s*(?:"|in|inch|inches)?|([\d.]+)\s*(?:"|in|inch|inches)?\s+(\d{3,5})\s*[x×]\s*(\d{3,5}))$/.exec(l))) {
    const w = +(m[1] || m[5]), h = +(m[2] || m[6]), d = +(m[3] || m[4]), ppi = Math.sqrt(w * w + h * h) / d;
    if (d > 0) push(ans("ppi", Math.round(ppi) + " pixels per inch", w + " × " + h + " on a " + d + "\" screen · dot size " + (25.4 / ppi).toFixed(3) + " mm · Enter to copy", { copy:String(Math.round(ppi)) }));
  }
  // emoji
  if ((m = /^(?:emoji:\s*|:)([a-z][a-z0-9 ]{1,24})$/.exec(l))) {
    const w = m[1].trim(), hits = EMOJI.filter(([n]) => n === w).concat(EMOJI.filter(([n]) => n !== w && (n.startsWith(w) || n.split(" ").some(x => x.startsWith(w)))));
    const seen = new Set();
    hits.filter(([, e]) => !seen.has(e) && seen.add(e)).slice(0, 5).forEach(([n, e]) => push(ans("emoji-" + n, e + "  " + n, "Emoji · Enter to copy", { copy:e })));
  }
  // Morse code and binary
  if ((m = /^(?:to morse(?: code)?:?|in morse(?: code)?:?|morse(?: code)?:|from morse(?: code)?:?)\s*(.+)$/i.exec(s)) || (m = /^morse(?: code)?\s+([.\-][.\-\s/]*)$/i.exec(s))) {
    const t = m[1].trim();
    if (/^[.\-\s/]+$/.test(t)) { const v = t.split(/\s*\/\s*|\s{2,}/).map(w => w.split(/\s+/).map(c => MORSE_BACK[c] || "").join("")).join(" ").toUpperCase(); if (v.trim()) push(ans("morse", v, "From Morse code · Enter to copy", { copy:v, wrap:1 })); }
    else { const v = t.toLowerCase().split(" ").map(w => [...w].map(c => MORSE[c] || "").filter(Boolean).join(" ")).filter(Boolean).join(" / "); if (v) push(ans("morse", v, "In Morse code · Enter to copy", { copy:v, wrap:1 })); }
  }
  if ((m = /^(?:text to binary:?|to binary:|binary:|binary to text:?|from binary:?)\s*(.+)$/i.exec(s)) && !/^\d+$/.test(m[1].trim())) {
    const t = m[1].trim();
    if (/^[01]{8}(\s+[01]{8})*$/.test(t)) { try { const v = new TextDecoder("utf-8", { fatal:true }).decode(Uint8Array.from(t.split(/\s+/), b => parseInt(b, 2))); push(ans("bin", v, "From binary · Enter to copy", { copy:v, wrap:1 })); } catch (e) {} }
    else { const v = [...new TextEncoder().encode(t)].map(b => b.toString(2).padStart(8, "0")).join(" "); push(ans("bin", v, "As binary (UTF-8) · Enter to copy", { copy:v, wrap:1 })); }
  }
  // what a character is
  if ((m = /^(?:unicode|char|character|codepoint)\s+(.+)$/i.exec(s))) {
    const t = m[1].trim();
    let ch = null;
    const u = /^(?:u\+|0x|&#x)?([0-9a-f]{2,6});?$/i.exec(t);
    if (u && /^(u\+|0x|&#x)/i.test(t)) { const cp = parseInt(u[1], 16); if (cp <= 0x10ffff) ch = String.fromCodePoint(cp); }
    else if ([...t].length === 1) ch = t;
    if (ch) {
      const cp = ch.codePointAt(0), hex = cp.toString(16).toUpperCase().padStart(4, "0"), utf8 = [...new TextEncoder().encode(ch)].map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
      push(ans("char", ch + "   U+" + hex, "Decimal " + cp + " · HTML &#" + cp + "; · UTF-8 " + utf8 + " · CSS \\" + hex + " · Enter to copy the character", { copy:ch }));
    }
  }
  // upside-down text and faces
  if ((m = /^(?:upside ?down(?: text)?:?|flip text:?)\s+(.+)$/i.exec(s))) { const v = [...m[1]].reverse().map(c => FLIP[c] || c).join(""); push(ans("flipt", v, "Upside-down text · Enter to copy", { copy:v })); }
  if (KAO[l]) push(ans("kao", KAO[l], "Enter to copy", { copy:KAO[l] }));
  // counting words and letters
  if ((m = /^(?:count:|word count:?|character count:?|letter count:?|count (?:the )?(?:words|characters|letters) in:?)\s*([\s\S]+)$/i.exec(s))) {
    const t = m[1], w = (t.match(/\S+/g) || []).length, c = [...t].length, c2 = [...t.replace(/\s/g, "")].length;
    push(ans("count", plural(w, "word") + " · " + plural(c, "character"), c2 + " without spaces · " + (t.match(/[.!?]+(\s|$)/g) || []).length + " sentence(s) · Enter to copy", { copy:String(w) }));
  }
  // QR code for any text, a to-do, quick pages
  if ((m = /^(?:qr(?: code)?:|qr(?: code)? for)\s*(.+)$/i.exec(s))) { const t = m[1].trim(); push(ans("qr", "QR code for “" + t.slice(0, 60) + "”", "Press Enter to show it", { act:() => setTimeout(() => qrPanel(t, "QR code"), 40) })); }
  if ((m = /^(?:add (?:a )?(?:to-?do|task)|to-?do:|task:)\s*(.+)$/i.exec(s))) {
    const t = m[1].trim().slice(0, 200);
    push(ans("todo", "Add to your to-do list: " + t, "Press Enter · it shows in the sidebar and on the new tab page", { act:() => {
      const list = load("todo", []); list.push({ id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t, done:false, ts:Date.now() });
      save("todo", list.slice(-50)); toast("Added to your to-do list", { label:"Show", fn:() => openSide("todo") }); } }));
  }
  if ((m = /^@([a-z' ]*)$/.exec(l))) {
    QUICK.filter(([k, n]) => !m[1] || k.startsWith(m[1]) || n.toLowerCase().startsWith(m[1])).slice(0, 6)
      .forEach(([k, n, fn]) => push(Object.assign(ans("at-" + k, n, "@" + k + " · Enter to open", { act:() => setTimeout(fn, 40) }), { i:"tab", big:0 })));
  }
  // synonyms and rhymes (datamuse.com, free and key-less)
  if ((m = /^(?:synonyms?|another word|other words?|similar words?)\s+(?:for|of|to)?\s*([a-z][a-z' -]{1,30})$/.exec(l)) || (m = /^([a-z][a-z' -]{1,30})\s+synonyms?$/.exec(l))) {
    const w = m[1].trim(), v = later("syn|" + w, () => fetch("https://api.datamuse.com/words?max=12&rel_syn=" + encodeURIComponent(w)).then(r => r.json())
      .then(a => a.length ? a : fetch("https://api.datamuse.com/words?max=12&ml=" + encodeURIComponent(w)).then(r => r.json())).then(a => a.map(x => x.word).slice(0, 12).join(", ")), q);
    push(v ? ans("syn", v, "Words like “" + w + "” · Enter to copy", { copy:v, wrap:1 }) : v === null ? ans("syn", "Looking for words like “" + w + "”…", "Synonyms") : null);
  }
  if ((m = /^(?:rhymes?|what rhymes|words that rhyme)\s+(?:with|for)\s+([a-z']{2,30})\??$/.exec(l)) || (m = /^rhyme\s+([a-z']{2,30})$/.exec(l))) {
    const w = m[1], v = later("rhy|" + w, () => fetch("https://api.datamuse.com/words?max=16&rel_rhy=" + encodeURIComponent(w)).then(r => r.json()).then(a => a.map(x => x.word).join(", ")), q);
    push(v ? ans("rhy", v, "Rhymes with “" + w + "” · Enter to copy", { copy:v, wrap:1 }) : v === null ? ans("rhy", "Finding rhymes for “" + w + "”…", "Rhymes") : null);
  }
  return out;
}
const answers0 = answers;
answers = function (q) {
  const out = answers0(q);
  try { moreAnswers(q.trim(), q).forEach(r => out.push(r)); } catch (e) {}
  return out;
};
X3.moreAnswers = moreAnswers;

/* ---------------------------------------------------------------- tabs */
const meta = new Map();            // tab id -> { name, lock, closeAt, timer }
const unseen = new Set();          // opened in the background, not looked at yet
let recent = [];                   // tabs you were on, most recent first
let names = PRIVATE ? {} : load("xTabNames", {});   // address -> your name for it, so it survives a restart
let locks = PRIVATE ? {} : load("xTabLocks", {});
const M = id => { let m = meta.get(id); if (!m) { m = {}; meta.set(id, m); } return m; };
const keyOf = u => String(u || "").split("#")[0];
function saveNames() { if (PRIVATE) return; const k = Object.keys(names); if (k.length > 300) k.slice(0, k.length - 300).forEach(x => delete names[x]); save("xTabNames", names); save("xTabLocks", locks); }
function renameTab(id) {
  const t = T(id); if (!t) return;
  const v = prompt("Name for this tab (empty: use the page's own title)", M(id).name || t.title || "");
  if (v == null) return;
  M(id).name = v.trim().slice(0, 60);
  if (isWeb(t.url)) { if (M(id).name) names[keyOf(t.url)] = M(id).name; else delete names[keyOf(t.url)]; saveNames(); }
  renderTabs();
}
function lockTab(id) {
  const t = T(id); if (!t) return;
  M(id).lock = !M(id).lock;
  if (isWeb(t.url)) { if (M(id).lock) locks[keyOf(t.url)] = 1; else delete locks[keyOf(t.url)]; saveNames(); }
  renderTabs();
  toast(M(id).lock ? "Tab locked: it won't close by accident" : "Tab unlocked");
}
function closeIn(id) {
  pickPanel("Close this tab in", [["5 minutes", 5], ["15 minutes", 15], ["30 minutes", 30], ["1 hour", 60], ["2 hours", 120], ["Don't close it", 0]], mins => {
    const m = M(id); clearTimeout(m.timer); m.closeAt = 0;
    if (mins) { m.closeAt = Date.now() + mins * 60000; m.timer = setTimeout(() => { m.closeAt = 0; m.lock = false; closeTab(id); }, mins * 60000); toast("This tab closes in " + fmtDur(mins * 60)); }
    renderTabs();
  });
}
const closeTab0 = closeTab;
closeTab = function (id) {
  const t = T(id), m = meta.get(id);
  if (t && m && m.lock) { toast("“" + (m.name || t.title || hostOf(t.url)) + "” is locked", { label:"Unlock and close", fn:() => { m.lock = false; delete locks[keyOf(t.url)]; saveNames(); closeTab(id); } }); return; }
  const was = t ? { u:t.url, t:m && m.name || t.title } : null;
  closeTab0(id);
  if (m) clearTimeout(m.timer);
  if (was && cfg.xUndo && isWeb(was.u) && !PRIVATE && tabs.length > 1) toast("Closed “" + (was.t || hostOf(was.u)).slice(0, 50) + "”", { label:"Undo", fn:reopenClosed });
};
function lastTab() {
  const id = recent.find(x => x !== active && T(x));
  if (id) select(id); else toast("No other tab to go back to");
}
function sortTabs(by) {
  const pin = tabs.filter(x => x.pinned), rest = tabs.filter(x => !x.pinned);
  if (by === "title") rest.sort((a, b) => (M(a.id).name || a.title || "~").localeCompare(M(b.id).name || b.title || "~"));
  else rest.sort((a, b) => (recent.indexOf(a.id) + 1 || 1e9) - (recent.indexOf(b.id) + 1 || 1e9) || (b.seen || 0) - (a.seen || 0));
  tabs = pin.concat(rest); renderTabs(); saveSession();
  toast(by === "title" ? "Tabs sorted by name" : "Most recently used tabs first");
}
function moveTo(id, end) {
  const i = tabs.findIndex(x => x.id === id); if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  if (end) tabs.push(t); else tabs.splice(t.pinned ? 0 : tabs.filter(x => x.pinned).length, 0, t);
  orderPinned(); renderTabs(); saveSession();
}
function closeSite(id) {
  const t = T(id), h = t && hostOf(t.url); if (!h) return;
  const list = tabs.filter(x => hostOf(x.url) === h && !x.pinned);
  list.forEach(x => closeTab(x.id));
  toast("Closed " + plural(list.length, "tab") + " from " + h);
}
function reloadAll() { let n = 0; tabs.forEach(x => { if (isWeb(x.url) && !x.sleep && !x.lazy) { send("reload", x.id, 0); n++; } }); toast("Reloading " + plural(n, "tab")); }
function muteAll(on) { tabs.forEach(x => { if (isWeb(x.url) && !!x.muted !== on) send("mute", x.id, on ? 1 : 0); }); toast(on ? "Every tab muted" : "Every tab can play sound again"); }
function tabsMarkdown() {
  const list = tabs.filter(x => isWeb(x.url));
  if (!list.length) { toast("No web pages open"); return; }
  send("clip", list.map(x => "- [" + (M(x.id).name || x.title || hostOf(x.url)).replace(/[\[\]]/g, "") + "](" + cleanUrl(x.url) + ")").join("\n"));
  toast(plural(list.length, "link") + " copied as a Markdown list");
}
function exportTabs() {
  const list = tabs.filter(x => isWeb(x.url));
  if (!list.length) { toast("No web pages open"); return; }
  const d = new Date(), stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const html = '<!doctype html>\n<meta charset="utf-8">\n<title>Tabs ' + stamp + '</title>\n<style>body{font:15px/1.6 "Segoe UI",sans-serif;max-width:760px;margin:40px auto;padding:0 20px}a{color:#c62a21}li{margin:4px 0}</style>\n<h1>Open tabs, ' + esc(d.toLocaleString()) + '</h1>\n<ol>\n' +
    list.map(x => '<li><a href="' + esc(x.url) + '">' + esc(M(x.id).name || x.title || x.url) + "</a></li>").join("\n") + "\n</ol>\n";
  send("save-text", "tabs-" + stamp + ".html", html);
}
function openList() {
  const p = el("div");
  p.style.cssText = "width:460px;padding:12px";
  p.innerHTML = '<div class="hd">Open a list of links</div><textarea spellcheck="false" placeholder="Paste addresses here: one per line, or any text with links in it" style="width:100%;height:170px;resize:vertical;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--fg);padding:10px;font:12.5px/1.5 Consolas,monospace;outline:0;user-select:text"></textarea>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><span style="flex:1;color:var(--dim);font-size:12px"></span><button class="btn2 main">Open them</button></div>';
  const ta = p.querySelector("textarea"), info = p.querySelector("span");
  const found = () => [...new Set((ta.value.match(/https?:\/\/[^\s"'<>]+/g) || []).map(u => u.replace(/[).,;]+$/, "")))].slice(0, 50);
  ta.oninput = () => { const n = found().length; info.textContent = n ? plural(n, "link") + " found" + (n === 50 ? " (at most 50)" : "") : ""; };
  p.querySelector("button").onclick = () => { const l = found(); if (!l.length) { info.textContent = "No links found"; return; } closeOver(); l.forEach((u, i) => newTab(u, i > 0, active, i > 2)); };
  const n = openOver("xlinks", p); n.style.right = "8px";
  setTimeout(() => ta.focus({ preventScroll:true }), 0);
}
function randomMark() {
  const l = marks.filter(m => /^https?:/.test(m.u));
  if (!l.length) { toast("No bookmarks yet"); return; }
  const m = l[randInt(0, l.length - 1)];
  newTab(m.u, false, active);
  toast("Surprise: " + (m.t || hostOf(m.u)));
}

const on0 = on;
on = function (p) {
  const c = p[0], before = active;
  on0(p);
  if (c === "tab-created") {
    const id = +p[1], t = T(id);
    if (p[2] === "1" && t && cfg.xUnread !== false) unseen.add(id);
    if (t && isWeb(t.url)) { const k = keyOf(t.url); if (names[k]) M(id).name = names[k]; if (locks[k]) M(id).lock = true; if (names[k] || locks[k]) renderTabs(); }
  } else if (c === "tab-selected") {
    const id = +p[1];
    if (before && before !== id) recent = [before].concat(recent.filter(x => x !== before && x !== id)).slice(0, 30);
    if (unseen.delete(id)) renderTabs();
  } else if (c === "tab-closed") {
    const id = +p[1]; unseen.delete(id); recent = recent.filter(x => x !== id);
    const m = meta.get(id); if (m) clearTimeout(m.timer); meta.delete(id);
  }
};

const renderTabs0 = renderTabs;
renderTabs = function () {
  renderTabs0();
  const nums = !!cfg.xTabNums, vis = [...document.querySelectorAll("#tabs .tab")];
  vis.forEach((d, i) => {
    const id = +d.dataset.id, m = meta.get(id), t = T(id);
    if (m && m.name) { const ttl = d.querySelector(".ttl"); if (ttl) ttl.textContent = m.name; }
    if (m && m.lock) { d.classList.add("xlock"); const x = d.querySelector(".x"); if (x) x.title = "Locked - right-click the tab to unlock"; }
    if (m && m.closeAt) { d.classList.add("xtimed"); d.title = "Closes at " + new Date(m.closeAt).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }); }
    if (unseen.has(id)) d.classList.add("xun");
    if (nums && (i < 8 || i === vis.length - 1)) { const b = el("i", "xnum"); b.textContent = i < 8 ? i + 1 : 9; d.appendChild(b); }
    if (t && t.loading && !t.lazy) d.classList.add("xload");
  });
  paintTabCount();
};
X3.renameTab = renameTab; X3.lockTab = lockTab;
X3.tabItems = function (items, id) {
  const t = T(id); if (!t) return;
  const m = M(id), h = hostOf(t.url), at = items.findIndex(x => x[0] === "Duplicate");
  const add = [
    ["Rename tab…", () => renameTab(id)],
    [m.lock ? "Unlock tab" : "Lock tab (no accidental closing)", () => lockTab(id)],
    [m.closeAt ? "Don't close this tab later" : "Close this tab in…", () => { if (m.closeAt) { clearTimeout(m.timer); m.closeAt = 0; renderTabs(); toast("It stays open"); } else closeIn(id); }],
    ["Move to the start", () => moveTo(id, false)], ["Move to the end", () => moveTo(id, true)]
  ];
  items.splice(at >= 0 ? at + 1 : 2, 0, ...add);
  const ci = items.findIndex(x => x[0] === "Close other tabs");
  if (h) items.splice(ci >= 0 ? ci : items.length - 1, 0, ["Close all tabs from " + h, () => closeSite(id)]);
};

/* ---------------------------------------------------------------- toolbar extras and looks */
const strip = $("#strip"), xbox = el("div", "xbox");
xbox.innerHTML = '<span class="xcnt" title="Open tabs - click to see them all"></span><span class="xbat" title="Battery"></span><span class="xclock" title="Click for alarms"></span>';
strip.insertBefore(xbox, $("#search"));
xbox.querySelector(".xclock").onclick = () => alarmPanel();
xbox.querySelector(".xcnt").onclick = () => tabOverview();
function paintTabCount() { const c = xbox.querySelector(".xcnt"); c.textContent = cfg.xTabCount ? tabs.length + (tabs.length === 1 ? " tab" : " tabs") : ""; c.classList.toggle("hide", !cfg.xTabCount); }
function paintClock() {
  const c = xbox.querySelector(".xclock");
  if (!cfg.xClock) { c.classList.add("hide"); return; }
  const d = new Date();
  c.classList.remove("hide");
  c.textContent = (cfg.xClockDate ? d.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" }) + "  " : "") + d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit", hour12:cfg.clock24 ? false : undefined });
}
setInterval(paintClock, 5000);
let bat = null;
if (navigator.getBattery) navigator.getBattery().then(b => { bat = b; b.onlevelchange = b.onchargingchange = paintBattery; paintBattery(); }).catch(() => {});
function paintBattery() {
  const c = xbox.querySelector(".xbat");
  // a desktop without a battery reports a full one that is charging and never runs down
  if (!cfg.xBattery || !bat || (bat.level === 1 && bat.charging && bat.chargingTime === 0 && bat.dischargingTime === Infinity)) { c.classList.add("hide"); return; }
  c.classList.remove("hide");
  const p = Math.round(bat.level * 100);
  c.innerHTML = '<i style="--p:' + p + '%"></i>' + p + "%" + (bat.charging ? " ⚡" : "");
  c.classList.toggle("low", p <= 20 && !bat.charging);
}
const UIFONTS = { bahn:'Bahnschrift,"Segoe UI",sans-serif', georgia:'Georgia,"Segoe UI",serif', cascadia:'"Cascadia Code","Cascadia Mono",Consolas,monospace', comic:'"Comic Sans MS","Segoe UI",sans-serif', verdana:'Verdana,"Segoe UI",sans-serif' };
let cycleT = 0;
function applyX() {
  const b = document.body.classList, r = document.documentElement;
  b.toggle("xsquare", cfg.xCorners === "square"); b.toggle("xround", cfg.xCorners === "round");
  b.toggle("xnarrow", cfg.xTabW === "narrow"); b.toggle("xwide", cfg.xTabW === "wide");
  b.toggle("xrainbow", !!cfg.xRainbow); b.toggle("xglow", !!cfg.xGlow); b.toggle("xhoverx", !!cfg.xHoverX);
  b.toggle("xbig", !!cfg.xBigTabs); b.toggle("xicons", !!cfg.xIconTabs);
  if (UIFONTS[cfg.xFont]) r.style.setProperty("--xfont", UIFONTS[cfg.xFont]); else r.style.removeProperty("--xfont");
  b.toggle("xfont", !!UIFONTS[cfg.xFont]);
  clearInterval(cycleT);
  if (cfg.xCycle && !PRIVATE && cfg.motion !== "off") {
    let h = 0;
    cycleT = setInterval(() => { h = (h + 1) % 360; r.style.setProperty("--accent", "hsl(" + h + ",72%,56%)"); r.style.setProperty("--soft", "hsla(" + h + ",72%,56%,.16)"); }, 120);
  }
  customEngine(); paintClock(); paintBattery(); paintTabCount();
}
const applyLook0 = applyLook;
applyLook = function () { applyLook0(); try { applyX(); } catch (e) {} };

/* ---------------------------------------------------------------- web extras */
const cur = () => { const t = T(active); return t && isWeb(t.url) ? t : null; };
const needWeb = fn => () => { const t = cur(); if (!t) { toast("Open a web page first"); return; } fn(t); };
function askPanel(title, fields, okLabel, fn, extra) {
  const p = el("div", "xask");
  p.appendChild(el("div", "hd", esc(title)));
  const ins = fields.map(([ph, v]) => { const i = el("input"); i.placeholder = ph; i.value = v || ""; i.spellcheck = false; p.appendChild(i); return i; });
  const r = el("div", "r"), lab = el("label"), b = el("button", "btn2 main");
  let flag = false;
  if (extra) { lab.innerHTML = '<input type="checkbox" style="width:auto;height:auto;margin:0">' + esc(extra); lab.querySelector("input").onchange = e => { flag = e.target.checked; }; }
  r.appendChild(lab); b.textContent = okLabel; r.appendChild(b); p.appendChild(r);
  const done = () => { const v = ins.map(i => i.value); if (!v[0].trim()) { ins[0].focus({ preventScroll:true }); return; } closeOver(); fn(v, flag); };
  b.onclick = done;
  ins.forEach(i => i.onkeydown = e => { if (e.key === "Enter") done(); if (e.key === "Escape") closeOver(); });
  const n = openOver("xask", p); n.style.right = "8px";
  setTimeout(() => ins[0].focus({ preventScroll:true }), 0);
}
const LANGS = [["English", "en"], ["Spanish", "es"], ["French", "fr"], ["German", "de"], ["Italian", "it"], ["Portuguese", "pt"], ["Dutch", "nl"], ["Polish", "pl"], ["Turkish", "tr"],
  ["Russian", "ru"], ["Ukrainian", "uk"], ["Arabic", "ar"], ["Hindi", "hi"], ["Japanese", "ja"], ["Korean", "ko"], ["Chinese (Simplified)", "zh-CN"], ["Vietnamese", "vi"], ["Indonesian", "id"], ["Tagalog", "tl"], ["Swedish", "sv"]];
const translateInto = needWeb(t => pickPanel("Translate this page into", LANGS, l => send("navigate", t.id, "https://translate.google.com/translate?sl=auto&tl=" + l + "&u=" + encodeURIComponent(t.url))));
const wayback = needWeb(t => newTab("https://web.archive.org/web/*/" + cleanUrl(t.url), false, t.id));
const archiveNow = needWeb(t => { newTab("https://web.archive.org/save/" + cleanUrl(t.url), false, t.id); toast("Saving a copy of the page at the Internet Archive"); });
const isDown = needWeb(t => newTab("https://downforeveryoneorjustme.com/" + encodeURIComponent(rawHost(t.url)), false, t.id));
const searchSite = needWeb(t => askPanel("Search only " + hostOf(t.url), [["What are you looking for?"]], "Search", v => go("site:" + hostOf(t.url) + " " + v[0].trim())));
const goUp = needWeb(t => {
  const u = new URL(t.url);
  if (u.search || u.hash) { u.search = ""; u.hash = ""; }
  else if (u.pathname.replace(/\/$/, "")) u.pathname = u.pathname.replace(/\/$/, "").replace(/\/[^/]*$/, "/");
  else { const parts = u.hostname.split("."); if (parts.length > 2 && !/^www$/.test(parts[0])) u.hostname = parts.slice(1).join("."); else { toast("Already at the top of this site"); return; } }
  send("navigate", t.id, u.href);
});
const siteHome = needWeb(t => send("navigate", t.id, new URL(t.url).origin + "/"));
function stepPage(dir) {
  return needWeb(t => {
    const u = t.url, re = /(\d+)(?!.*\d)/;
    const qm = /([?&](?:p|page|pg|start|offset|from|pagenum|paged)=)(\d+)/i.exec(u);
    let next = null;
    if (qm) { const v = Math.max(0, +qm[2] + dir * (/start|offset|from/i.test(qm[1]) ? 10 : 1)); next = u.replace(qm[0], qm[1] + v); }
    else { const path = u.split(/[?#]/)[0], m = re.exec(path); if (m) { const v = Math.max(0, +m[1] + dir); next = path.slice(0, m.index) + String(v).padStart(m[1].length, "0") + path.slice(m.index + m[1].length) + u.slice(path.length); } }
    if (!next || next === u) { toast("No page number in this address"); return; }
    send("navigate", t.id, next);
  });
}
const copyTitle = needWeb(t => { send("clip", t.title || hostOf(t.url)); toast("Title copied"); });
const emailPage = needWeb(t => send("navigate", t.id, "mailto:?subject=" + encodeURIComponent(t.title || hostOf(t.url)) + "&body=" + encodeURIComponent(cleanUrl(t.url))));
const SPEEDS = [["0.5×", .5], ["0.75×", .75], ["Normal", 1], ["1.25×", 1.25], ["1.5×", 1.5], ["1.75×", 1.75], ["2×", 2], ["2.5×", 2.5], ["3×", 3]];
const speedPanel = () => { const t = T(active); if (!t) return; pickPanel("Video speed", SPEEDS, v => send("media", t.id, "speed", String(v))); };
const replacePanel = needWeb(t => askPanel("Find and replace on this page", [["Find"], ["Replace with"]], "Replace all", (v, cs) => pageTool("x-replace", JSON.stringify({ f:v[0], r:v[1], cs:cs ? 1 : 0 }), t.id), "Match case"));
const marksPanel = needWeb(t => askPanel("Highlight words on this page", [["Up to 6 words, separated by commas"]], "Highlight", v => pageTool("x-marks", JSON.stringify(v[0].split(",").map(x => x.trim()).filter(Boolean)), t.id)));
const tool = (a, arg) => () => pageTool(a, arg);

/* ---------------------------------------------------------------- the new page tools, in one panel */
const TOOLS = [
  ["Read", [["Reading guide", "outline", tool("x-ruler"), "Alt+Shift+R"], ["Bionic reading", "edit", tool("x-bionic"), "Alt+Shift+B"], ["Spotlight", "focus", tool("x-spotlight"), "Alt+Shift+X"],
    ["Big text under the pointer", "plus", tool("x-bigtext")], ["Speed reader", "bolt", tool("x-speed"), "Alt+Shift+E"], ["Words and reading level", "count", tool("x-words")],
    ["Highlight words…", "edit", marksPanel], ["Calm page (stop animations)", "pause", tool("x-calm")], ["Open every folded section", "chev", tool("x-expand")], ["Text only (hide pictures)", "eye", tool("x-noimg")]]],
  ["Find on the page", [["All pictures", "pic", tool("x-gallery"), "Alt+Shift+G"], ["All links", "link", tool("x-links"), "Alt+Shift+U"], ["Emails and phone numbers", "mail", tool("x-contacts")],
    ["Find and replace…", "glass", replacePanel], ["Show passwords", "key", tool("x-passwords")], ["Picture zoom on hover", "pic", tool("x-hoverzoom"), "Alt+Shift+Z"]]],
  ["Save and copy", [["Save as Markdown", "save", tool("x-md")], ["Tables to a spreadsheet (CSV)", "grid", tool("x-csv")], ["Copy all the text", "copy", tool("x-text")], ["Save the text as a file", "note", tool("x-text", "save")],
    ["Copy the title", "copy", copyTitle], ["Email this page", "mail", emailPage]]],
  ["For designers", [["Fonts on this page", "edit", tool("x-fonts")], ["Colors on this page", "palette", tool("x-colors")], ["Accessibility check", "eye", tool("x-a11y")], ["Layout grid", "grid", tool("x-grid")]]],
  ["Video", [["Picture: brightness, color, rotate", "media", tool("x-video")], ["Previous frame", "rw", tool("x-frame", "-1"), "Alt+Shift+,"], ["Next frame", "ff", tool("x-frame", "1"), "Alt+Shift+."], ["Speed presets…", "media", speedPanel]]],
  ["Presenting", [["Show the keys I press", "keyboard", tool("x-keys")], ["Laser pointer", "target", tool("x-laser")]]],
  ["The web", [["Older versions (Wayback Machine)", "archive", wayback], ["Save a copy at the Internet Archive", "archive", archiveNow], ["Is this site down for everyone?", "warn", isDown],
    ["Search only this site…", "glass", searchSite], ["Go up a level", "up", goUp], ["Site home page", "home", siteHome], ["Next page number", "fwd", stepPage(1)], ["Previous page number", "back", stepPage(-1)],
    ["Translate into…", "translate", translateInto]]],
  ["Just for fun", [["Let it snow", "sparkle", tool("x-snow")], ["Confetti", "sparkle", tool("x-confetti")], ["Disco colors", "palette", tool("x-disco")], ["Flip the page", "rel", tool("x-flip")], ["Gravity", "dl", tool("x-gravity")]]]
];
X3.toolsPanel = function () {
  if (overlay === "xtp") { closeOver(); return; }
  const m = el("div", "scroll");
  let i = 0;
  TOOLS.forEach(([head, list]) => {
    m.appendChild(el("div", "hd", esc(head)));
    const g = el("div", "xtg");
    list.forEach(([label, icon, fn, key]) => {
      const b = el("button", "", ico(icon) + "<div><span>" + esc(label) + "</span>" + (key ? "<em>" + esc(key) + "</em>" : "") + "</div>");
      b.title = label + (key ? "  (" + key + ")" : "");
      b.style.animationDelay = Math.min(i++ * 12, 260) + "ms";
      b.onclick = () => { closeOver(); fn(); };
      g.appendChild(b);
    });
    m.appendChild(g);
  });
  openOver("xtp", m);
};
const XK = { B:tool("x-bionic"), E:tool("x-speed"), G:tool("x-gallery"), R:tool("x-ruler"), U:tool("x-links"), X:tool("x-spotlight"), Z:tool("x-hoverzoom"), "`":lastTab };
function xKey(k) { const fn = XK[k]; if (!fn) return; if (k !== "`" && !cur()) { toast("Open a web page first"); return; } fn(); }
const shortcut0 = shortcut;
shortcut = function (k, ctrl, shift, alt) {
  if (alt && !ctrl) {
    if (!shift && k === 192) { lastTab(); return; }
    if (shift && (k === 188 || k === 190)) { if (cur()) pageTool("x-frame", k === 190 ? "1" : "-1"); return; }
    if (shift && k >= 65 && k <= 90 && XK[String.fromCharCode(k)]) { xKey(String.fromCharCode(k)); return; }
  }
  return shortcut0(k, ctrl, shift, alt);
};
const keysPanel0 = keysPanel;
keysPanel = function () {
  keysPanel0();
  const cols = document.querySelector("#keysp .cols"); if (!cols) return;
  [["Back to the last tab", "Alt+`"], ["Reading guide", "Alt+Shift+R"], ["Bionic reading", "Alt+Shift+B"], ["Spotlight", "Alt+Shift+X"], ["Speed reader", "Alt+Shift+E"],
   ["All pictures / all links", "Alt+Shift+G / U"], ["Picture zoom on hover", "Alt+Shift+Z"], ["Video frame back / forward", "Alt+Shift+, / ."]].forEach(([a, b]) => {
    const r = el("div", "kr"); r.appendChild(el("span")).textContent = a; r.appendChild(el("span")).textContent = b; r.style.color = "var(--fg)"; cols.appendChild(r);
  });
};

/* answers from the page tools */
const onToolResult0 = onToolResult;
onToolResult = function (id, json) {
  let r = null; try { r = JSON.parse(json); } catch (e) {}
  if (r && r.a === "x-key") { if (id === active) xKey(String(r.k || "")); return; }   // a real key press on the page
  if (r && /^x-(md|csv|text)$/.test(r.a)) {
    const asked = toolAsked[id + ":" + r.a];
    if (!asked || Date.now() - asked > 15000) return;
    delete toolAsked[id + ":" + r.a];
    const t = T(id), base = String(r.title || (t && t.title) || "page").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "page";
    const cut = r.cut ? " (it was long, so it was cut short)" : "";
    if (r.a === "x-md") send("save-text", base + ".md", String(r.md || ""));
    else if (r.a === "x-csv") { if (!r.n) toast("No tables on this page"); else { send("save-text", base + ".csv", "﻿" + String(r.csv || "")); if (r.n > 1) toast(r.n + " tables, one after another in the file" + cut); } }
    else if (r.save) send("save-text", base + ".txt", String(r.t || "").replace(/\r?\n/g, "\r\n"));
    else { send("clip", String(r.t || "")); toast("Copied " + plural((String(r.t || "").match(/\S+/g) || []).length, "word") + cut); }
    if (cut && r.a !== "x-text") toast("Saved" + cut);
    return;
  }
  onToolResult0(id, json);
};
const applyPage0 = applyPage;
applyPage = function (t) {
  applyPage0(t);
  if (!t || !isWeb(t.url)) return;
  const o = {};
  if (cfg.xProgress) { o.progress = 1; o.accent = cfg.accent; }
  if (cfg.xTotop) o.totop = 1;
  if (cfg.xZoomAll) o.hoverzoom = 1;
  if (cfg.xYtShorts) o.ytShorts = 1;
  if (cfg.xYtRecs) o.ytRecs = 1;
  if (cfg.xPageKeys === false) o.keys = 0;
  if (Object.keys(o).length) send("page-tool", t.id, "x-init", JSON.stringify(o));
};

/* ---------------------------------------------------------------- sidebar tools */
const SIDE_X = ["xtools", "xclocks", "xsketch", "xpass", "xjson", "xdiff", "xregex", "xmd", "xcolors", "xbreathe", "xmetro", "xdecide", "xtally", "xunit"];
const openSide0 = openSide;
openSide = function (which, site) {
  if (SIDE_X.indexOf(which) < 0) return openSide0(which, site);
  if (!side.open) { const r = $("#rail"); r.classList.add("opening"); setTimeout(() => r.classList.remove("opening"), 500); }
  side.open = true; side.which = which;
  send("side-open", HOME + "side.html#" + which);
  renderRail(); paint(); relayout();
};
const renderRail0 = renderRail;
renderRail = function () {
  renderRail0();
  const r = $("#rail"), b = el("button", "btn" + (SIDE_X.indexOf(side.which) >= 0 ? " act" : ""), ico("grid"));
  b.title = "More tools: clocks, sketchpad, passwords, JSON, colors and more";
  b.onclick = () => openSide("xtools");
  r.insertBefore(b, r.children[5] || null);
};

/* ---------------------------------------------------------------- commands for the palette */
const commands0 = commands;
commands = function () {
  const t = T(active), web = !!(t && isWeb(t.url));
  const C = [];
  TOOLS.forEach(([head, list]) => list.forEach(([label, icon, fn, key]) => C.push([label + (head === "Just for fun" ? " (fun)" : head === "Video" ? " (video)" : ""), key || "", icon, fn])));
  C.push(["More page tools…", "", "grid", X3.toolsPanel], ["Back to the last tab", "Alt+`", "tab", lastTab],
    ["Rename this tab…", "", "edit", () => t && renameTab(t.id)], [t && meta.get(t.id) && meta.get(t.id).lock ? "Unlock this tab" : "Lock this tab", "", "lockx", () => t && lockTab(t.id)],
    ["Close this tab in…", "", "timer", () => t && closeIn(t.id)], ["Close all tabs from this site", "", "x", () => t && closeSite(t.id)],
    ["Reload every tab", "", "rel", reloadAll], ["Mute every tab", "", "mute", () => muteAll(true)], ["Unmute every tab", "", "snd", () => muteAll(false)],
    ["Sort tabs by name", "", "list", () => sortTabs("title")], ["Sort tabs by last used", "", "clock", () => sortTabs("recent")],
    ["Move this tab to the start", "", "back", () => t && moveTo(t.id, false)], ["Move this tab to the end", "", "fwd", () => t && moveTo(t.id, true)],
    ["Copy all tabs as a Markdown list", "", "copy", tabsMarkdown], ["Save open tabs to a file", "", "save", exportTabs], ["Open a list of links…", "", "link", openList],
    ["Surprise me: a random bookmark", "", "dice", randomMark], ["QR code for any text…", "", "qr", () => askPanel("QR code for any text", [["Text or link"]], "Make QR code", v => setTimeout(() => qrPanel(v[0].trim(), "QR code"), 40))],
    ["Sidebar tools", "", "grid", () => openSide("xtools")], ["World clocks (sidebar)", "", "clock", () => openSide("xclocks")], ["Sketchpad (sidebar)", "", "edit", () => openSide("xsketch")],
    ["Password generator (sidebar)", "", "key", () => openSide("xpass")], ["JSON formatter (sidebar)", "", "code", () => openSide("xjson")], ["Compare two texts (sidebar)", "", "split", () => openSide("xdiff")],
    ["Regex tester (sidebar)", "", "code", () => openSide("xregex")], ["Markdown preview (sidebar)", "", "note", () => openSide("xmd")], ["Color palettes (sidebar)", "", "palette", () => openSide("xcolors")],
    ["Breathing exercise (sidebar)", "", "focus", () => openSide("xbreathe")], ["Metronome (sidebar)", "", "media", () => openSide("xmetro")], ["Decision wheel (sidebar)", "", "dice", () => openSide("xdecide")],
    ["Tally counter (sidebar)", "", "count", () => openSide("xtally")], ["Price per unit (sidebar)", "", "count", () => openSide("xunit")],
    [cfg.xClock ? "Clock in the tab strip: turn off" : "Clock in the tab strip: turn on", "", "clock", () => { cfg.xClock = !cfg.xClock; saveNow("settings"); applyX(); }],
    [cfg.xUndo ? "Undo button after closing a tab: turn off" : "Undo button after closing a tab: turn on", "", "history", () => { cfg.xUndo = !cfg.xUndo; saveNow("settings"); toast(cfg.xUndo ? "Closing a tab now offers Undo" : "No more Undo after closing"); }],
    [cfg.xProgress ? "Reading progress bar: turn off" : "Reading progress bar on pages: turn on", "", "scroll", () => { cfg.xProgress = !cfg.xProgress; saveNow("settings"); toast(cfg.xProgress ? "Pages show a reading progress bar from their next load" : "Progress bar off from the next load"); tabs.forEach(applyPage); }],
    ["Look and feel (Webs 3.0 settings)", "", "gear", () => open1("settings.html#x3")]);
  return commands0().concat(C.map(([t0, k, i, fn]) => ({ t:t0, k, i, fn })));
};
X3.lastTab = lastTab; X3.openList = openList; X3.randomMark = randomMark;
applyX();
renderRail();
})();
