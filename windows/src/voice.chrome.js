/* ---------------------------------------------------------------- Webs 3.12: "Hey Webs" voice control
   With it on (the 🎙️ button in the toolbar, Alt+Shift+M, or Menu → Voice control…), Webs listens for its wake
   phrase ("Hey Webs", or one you choose) and then does what you say: over a hundred commands (COMMANDS below),
   plus your own phrases that run several of them. Answers can be spoken.
   Listening: the browser's speech recognition when it works here, or the offline engine (Vosk, in WebAssembly:
   a 40 MB download once, after which nothing you say leaves this PC). Only what follows the wake phrase is acted
   on; nothing is recorded or kept. Never in a private window; by default only while Webs is the window in front. */
(function () {
"use strict";
if (PRIVATE) return;
const VOSK_JS = "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js";
const VOSK_MODEL = "https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz";
const saveCfg = () => { saveNow("settings"); sendPrefs(); };
class Say extends Error {}
const say = m => { throw new Say(m); };

/* ---------------------------------------------------------------- numbers and times in words */
const NW = { zero:0, oh:0, a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100, half:0.5, couple:2, few:3 };
function num(s) {
  s = String(s || "").trim().replace(/-/g, " ");
  if (/^\d+(\.\d+)?$/.test(s)) return +s;
  let n = 0, any = false;
  for (const w of s.split(/\s+/)) { if (w === "and") continue; if (w === "hundred") { n = (n || 1) * 100; any = true; continue; } if (NW[w] == null) return NaN; n += NW[w]; any = true; }
  return any ? n : NaN;
}
const UNIT = { second:1, seconds:1, sec:1, secs:1, minute:60, minutes:60, min:60, mins:60, hour:3600, hours:3600 };
function secs(s) {           // "five minutes", "1 hour and 30 minutes", "90 seconds"
  let t = 0, ok = false;
  for (const m of String(s).matchAll(/([\w.\- ]+?)\s+(seconds?|secs?|minutes?|mins?|hours?)\b/g)) { const n = num(m[1].trim().replace(/^(and|for)\s+/, "")); if (isFinite(n)) { t += n * UNIT[m[2]]; ok = true; } }
  return ok ? Math.round(t) : NaN;
}
const wordsNum = s => String(s).replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](one|two|three|four|five|six|seven|eight|nine))?\b/g,
  (m, a, b) => String(NW[a] + (b ? NW[b] : 0))).replace(/(\d+) hundred(?: and)?(?: (\d+))?/g, (m, a, b) => String(+a * 100 + (b ? +b : 0)));
// "what is 12 times 7": plain sums only
function calc(s) {
  let e = wordsNum(s).replace(/\bmultiplied by\b|\btimes\b|\bx\b/g, "*").replace(/\bdivided by\b|\bover\b/g, "/").replace(/\bplus\b|\band\b/g, "+").replace(/\bminus\b|\btake away\b/g, "-")
    .replace(/\bto the power of\b/g, "^").replace(/\bsquared\b/g, "^2").replace(/\bcubed\b/g, "^3").replace(/\bpercent of\b/g, "/100*").replace(/,/g, "");
  if (!/\d/.test(e) || !/^[\d\s.+\-*/()^]+$/.test(e) || !/[+\-*/^]/.test(e)) return null;
  try { const v = Function('"use strict";return (' + e.replace(/\^/g, "**") + ")")(); return isFinite(v) ? Math.round(v * 1e6) / 1e6 : null; } catch (x) { return null; }
}

/* ---------------------------------------------------------------- what you can say */
const tab = () => T(active);
const web = () => { const t = tab(); if (!t || !isWeb(t.url)) say("Open a web page first"); return t; };
const tool = (name, arg) => send("page-tool", web().id, name, arg || "");
const media = () => tabs.find(x => x.audio && !x.muted) || web();
const idx = () => tabs.findIndex(x => x.id === active);
const searchUrl = q => engine().url + encodeURIComponent(q);
const askAI = q => { try { localStorage.setItem("wsb.xaiBarQ", JSON.stringify({ q, t:Date.now() })); } catch (e) {} openSide("xai", "bar"); return "Asking Web AI"; };
const site = s => { s = s.trim().replace(/ dot /g, ".").replace(/\s+/g, ""); return /\./.test(s) ? s : s + ".com"; };
const SITES = { youtube:"youtube.com", google:"google.com", gmail:"mail.google.com", netflix:"netflix.com", twitter:"x.com", x:"x.com", reddit:"reddit.com", wikipedia:"wikipedia.org",
  amazon:"amazon.com", facebook:"facebook.com", instagram:"instagram.com", tiktok:"tiktok.com", twitch:"twitch.tv", spotify:"open.spotify.com", github:"github.com", maps:"maps.google.com",
  "google maps":"maps.google.com", chatgpt:"chatgpt.com", claude:"claude.ai", discord:"discord.com", "google drive":"drive.google.com", outlook:"outlook.live.com", linkedin:"linkedin.com", ebay:"ebay.com", roblox:"roblox.com" };
const THEMES = { bleach:"bleach", "soul reaper":"bleach", "tokyo ghoul":"ghoul", ghoul:"ghoul", "demon slayer":"slayer", slayer:"slayer", "jujutsu kaisen":"jjk", jjk:"jjk", jujutsu:"jjk", naruto:"naruto", "hidden leaf":"naruto",
  "attack on titan":"aot", titan:"aot", "one piece":"onepiece", "death note":"deathnote", "persona":"p5", "persona 5":"p5", "phantom thief":"p5", halloween:"halloween", winter:"winter", "new year":"newyear", hearts:"hearts", valentine:"hearts" };
const AMBW = { rain:"rain", rainy:"rain", storm:"storm", thunder:"storm", thunderstorm:"storm", wave:"waves", waves:"waves", ocean:"waves", sea:"waves", wind:"wind", fire:"fire", fireplace:"fire", cafe:"cafe", coffee:"cafe",
  "coffee shop":"cafe", forest:"forest", birds:"forest", space:"space", "white noise":"white", "brown noise":"brown" };
const GAMES = { snake:"snake", "2048":"2048", sudoku:"sudoku", chess:"chess", solitaire:"solitaire", blocks:"blocks", tetris:"blocks", minesweeper:"mine", "tic tac toe":"ttt", memory:"mem", "web runner":"runner", runner:"runner",
  breakout:"brk", pong:"pong", "connect four":"online", "play a friend":"online", "daily word":"word", wordle:"word" };
const JOKES = ["Why did the web page go to therapy? It had too many issues with its cache.", "I told my browser a joke. It didn't get it, so I refreshed.", "Why was the computer cold? It left its Windows open.",
  "How do websites stay cool? They have lots of fans.", "Why don't tabs ever get lonely? There's always another one open.", "What's a spider's favourite browser? Webs, obviously."];

const C = [];
// add(id, group, example, patterns, fn): fn(match) returns what to say (or nothing for "Done")
const add = (id, g, ex, res, fn) => C.push({ id, g, ex, res:(Array.isArray(res) ? res : [res]), fn });
const R = s => new RegExp("^(?:" + s + ")$");

/* ---- tabs and windows */
add("newtab", "Tabs and windows", "new tab", R("(open )?(a )?new tab"), () => { newTab(null, false); return "New tab"; });
add("close", "Tabs and windows", "close this tab", R("close (this |the |current )?tab|close it"), () => { const t = tab(); if (!t) say("No tab to close"); closeTab(t.id); return "Closed"; });
add("closeothers", "Tabs and windows", "close other tabs", R("close (all )?(the )?other tabs"), () => { const n = tabs.filter(x => x.id !== active && !x.pinned); n.forEach(x => closeTab(x.id)); return "Closed " + n.length + " tab" + (n.length === 1 ? "" : "s"); });
add("reopen", "Tabs and windows", "reopen closed tab", R("(re ?open|bring back|undo close|restore)( the)?( last)?( closed)?( tab)?"), () => { reopenClosed(); return "Reopened"; });
add("nexttab", "Tabs and windows", "next tab", R("(next|right) tab|(go to |switch to )?the next tab"), () => { if (tabs.length) select(tabs[(idx() + 1) % tabs.length].id); });
add("prevtab", "Tabs and windows", "previous tab", R("(previous|left|last) tab|(go to |switch to )?the previous tab"), () => { if (tabs.length) select(tabs[(idx() - 1 + tabs.length) % tabs.length].id); });
add("firsttab", "Tabs and windows", "first tab", R("(go to |switch to )?(the )?first tab"), () => { if (tabs[0]) select(tabs[0].id); });
add("lasttab", "Tabs and windows", "last tab", R("(go to |switch to )?(the )?final tab|(go to |switch to )?the last tab on the right"), () => { if (tabs.length) select(tabs[tabs.length - 1].id); });
add("tabn", "Tabs and windows", "tab three", R("(go to |switch to )?tab (number )?(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"), m => { const n = num(m[3]); if (!isFinite(n)) return null; if (!(n >= 1 && tabs[n - 1])) say("There's no tab " + m[3]); select(tabs[n - 1].id); });
add("duplicate", "Tabs and windows", "duplicate this tab", R("duplicate (this |the )?tab|copy (this |the )?tab"), () => { newTab(web().url, false); return "Duplicated"; });
add("pin", "Tabs and windows", "pin this tab", R("(pin|unpin) (this |the )?tab"), m => { const t = tab(); if (!t) return; t.pinned = m[1] === "pin"; orderPinned(); renderTabs(); saveSession(); return t.pinned ? "Pinned" : "Unpinned"; });
add("mutetab", "Tabs and windows", "mute this tab", R("(mute|unmute) (this |the )?tab"), m => { const t = tab(); if (t) send("mute", t.id, m[1] === "mute" ? 1 : 0); return m[1] === "mute" ? "Muted" : "Unmuted"; });
add("muteall", "Tabs and windows", "mute all tabs", R("mute (all|every)( the)? tabs|silence( everything)?"), () => { tabs.forEach(x => { if (x.audio) send("mute", x.id, 1); }); return "Everything muted"; });
add("sleeptabs", "Tabs and windows", "put tabs to sleep", R("(put|send) (the )?(other )?tabs to sleep|sleep (the )?other tabs|free up memory"), () => { const n = tabs.filter(x => x.id !== active && !x.sleep && !x.audio); n.forEach(x => send("sleep-tab", x.id)); return n.length + " tabs asleep"; });
add("overview", "Tabs and windows", "show all tabs", R("(show|see) (all )?(my |the )?tabs|tab overview"), () => { tabOverview(); });
add("newwindow", "Tabs and windows", "new window", R("(open )?(a )?new window"), () => { send("new-window", 0); return "New window"; });
add("private", "Tabs and windows", "new private window", R("(open )?(a )?(new )?(private|incognito)( tab| window)?"), () => { send("new-window", 1); return "Private window"; });
add("splitview", "Tabs and windows", "split view", R("split (view|screen)|side by side"), () => { $("#splitb").click(); });

/* ---- going places */
add("back", "Going places", "go back", R("(go )?back|previous page"), () => send("back", web().id));
add("forward", "Going places", "go forward", R("(go )?forward|next page"), () => send("forward", web().id));
add("reload", "Going places", "reload", R("(reload|refresh)( the| this)?( page)?"), () => send("reload", web().id, 0));
add("hardreload", "Going places", "hard reload", R("hard (reload|refresh)"), () => send("reload", web().id, 1));
add("stoploading", "Going places", "stop loading", R("stop loading"), () => send("stop", web().id));
add("home", "Going places", "go home", R("(go )?home|(go to )?(the )?(start|home) page"), () => { $("#home").click(); });
add("youtube", "Going places", "search YouTube for cats", R("(search )?youtube (for )?(.+)|(play|find|watch) (.+) on youtube"), m => { newTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(m[3] || m[5]), false); return "Searching YouTube"; });
add("images", "Going places", "show me pictures of puppies", R("(show me )?(pictures|images|photos) of (.+)|search images for (.+)"), m => { newTab("https://duckduckgo.com/?ia=images&iax=images&q=" + encodeURIComponent(m[3] || m[4]), false); });
add("maps", "Going places", "directions to the airport", R("(directions|how do i get|navigate) to (.+)|(where is|map of|show me) (.+) on (the )?map"), m => { newTab("https://www.google.com/maps/search/" + encodeURIComponent(m[2] || m[4]), false); return "Opening the map"; });
add("wiki", "Going places", "Wikipedia cats", R("wikipedia (.+)|look up (.+) on wikipedia"), m => { newTab("https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(m[1] || m[2]), false); });
add("news", "Going places", "show me the news", R("(show me |what's in |open )?the news|news headlines"), () => { newTab("https://news.google.com/", false); });
add("weather", "Going places", "what's the weather", R("what'?s the weather( like)?( today| tomorrow)?|weather( forecast)?|is it going to rain"), () => { newTab(searchUrl("weather"), false); return "Here's the weather"; });
add("shopping", "Going places", "search Amazon for headphones", R("(search )?amazon (for )?(.+)|buy (.+) on amazon"), m => { newTab("https://www.amazon.com/s?k=" + encodeURIComponent(m[3] || m[4]), false); });
add("search", "Going places", "search for pizza near me", R("(search|google|look up)( the web)?( for)? (?!.* (?:on|in) (?:this|the) page$)(.+)"), m => { go(m[4]); return "Searching for " + m[4]; });

/* ---- on the page */
add("down", "On the page", "scroll down", R("(scroll|go|move) down|page down|down"), () => tool("x-scrollto", "down"));
add("up", "On the page", "scroll up", R("(scroll|go|move) up|page up|up"), () => tool("x-scrollto", "up"));
add("top", "On the page", "go to the top", R("(go |scroll )?(to )?the top( of the page)?|top of (the )?page"), () => tool("x-scrollto", "top"));
add("bottom", "On the page", "go to the bottom", R("(go |scroll )?(to )?the (bottom|end)( of the page)?|bottom of (the )?page"), () => tool("x-scrollto", "bottom"));
add("zoomin", "On the page", "zoom in", R("zoom in|(make it )?bigger|larger"), () => { zoom(1); });
add("zoomout", "On the page", "zoom out", R("zoom out|(make it )?smaller"), () => { zoom(-1); });
add("zoomreset", "On the page", "reset zoom", R("reset (the )?zoom|normal size|actual size"), () => { zoom(0); });
add("find", "On the page", "find recipes on this page", R("(find|search for|look for) (.+) (on|in) (this|the) page"), m => { send("find", web().id, m[2], 1, 0); return "Finding " + m[2]; });
add("findbar", "On the page", "find on page", R("find on (this |the )?page|open find"), () => { findBar(); });
add("read", "On the page", "read this page", R("read (this|the|it)( page)?( to me| aloud| out loud)?|read aloud|read it to me"), () => { send("read-aloud", web().id, navigator.language); return "Reading"; });
add("stopread", "On the page", "stop reading", R("stop reading|stop talking|be quiet|shut up|quiet"), () => { const t = tab(); if (t) send("read-aloud", t.id, "stop"); try { speechSynthesis.cancel(); } catch (e) {} return "Okay"; });
add("reader", "On the page", "reader mode", R("reader (view|mode)|(make it )?easy to read|clean (up )?(this )?page"), () => tool("cleanup"));
add("translate", "On the page", "translate this page", R("translate( this| the)?( page)?( to english)?"), () => { web(); translatePage(); return "Translating"; });
add("print", "On the page", "print this page", R("print( this| the)?( page)?"), () => send("print", web().id));
add("screenshot", "On the page", "take a screenshot", R("(take a )?screen ?shot( of (this|the) page)?|capture (this|the) page"), () => { send("capture", web().id); return "Screenshot"; });
add("screenshotarea", "On the page", "screenshot an area", R("screen ?shot (an |a )?(area|part|region)|snip"), () => send("shot-area", web().id));
add("copylink", "On the page", "copy the link", R("copy (the |this )?(link|address|url)"), () => { navigator.clipboard.writeText(web().url); return "Link copied"; });
add("fullscreen", "On the page", "full screen", R("(go )?full ?screen|(make it )?full screen|exit full ?screen|leave full ?screen"), () => send("fullscreen", "t"));
add("sitepanel", "On the page", "site info", R("(site|page) (info|information|settings)|is this site safe"), () => { web(); sitePanel(); });
add("darkpage", "On the page", "dark mode on this site", R("(make )?(this|the) (page|site) dark|dark mode (on|for) this (page|site)"), () => { const t = web(); listToggle("darkoff", hostOf(t.url), false); cfg.dark = true; saveCfg(); reloadActive(); return "Dark mode"; });
add("confetti", "On the page", "confetti", R("confetti|party( time| mode)?|celebrate"), () => tool("x-confetti"));
add("snow", "On the page", "make it snow", R("make it snow|snow"), () => tool("x-snow"));
add("gravity", "On the page", "gravity", R("gravity|make (it|everything) fall"), () => tool("x-gravity"));
add("disco", "On the page", "disco mode", R("disco( mode)?|dance party"), () => tool("x-disco"));

/* ---- video and sound */
add("pause", "Video and sound", "pause", R("pause|stop( the)?( video| music| song)?|hold on"), () => send("media", media().id, "pause", ""));
add("play", "Video and sound", "play", R("play|resume|continue|keep playing|unpause"), () => send("media", media().id, "play", ""));
add("skip", "Video and sound", "skip 30 seconds", R("(skip|go forward|fast forward|jump)( ahead| forward)?( by)? (.+)"), m => { const s = secs(m[4]) || num(m[4]) || NaN; if (!isFinite(s)) return null; send("media", media().id, "seek", String(s)); return "Skipped " + s + " seconds"; });
add("rewind", "Video and sound", "go back 10 seconds", R("(rewind|go back|back up|jump back)( by)? (.+)"), m => { const s = secs(m[3]) || num(m[3]); if (!isFinite(s)) return null; send("media", media().id, "seek", String(-s)); return "Back " + s + " seconds"; });
add("faster", "Video and sound", "play faster", R("(play |go )?faster|speed (it )?up"), () => send("media", media().id, "speed", "1.5"));
add("slower", "Video and sound", "play slower", R("(play |go )?slower|slow (it )?down"), () => send("media", media().id, "speed", "0.75"));
add("speed", "Video and sound", "speed two", R("(set )?(the )?speed( to)? ([\\w. ]+)|play at ([\\w. ]+) speed"), m => { const n = num((m[4] || m[5]).replace(/x$/, "").trim()); if (!(n >= 0.25 && n <= 4)) return null; send("media", media().id, "speed", String(n)); return "Speed " + n; });
add("normalspeed", "Video and sound", "normal speed", R("normal speed|regular speed"), () => send("media", media().id, "speed", "1"));
add("pip", "Video and sound", "picture in picture", R("picture in picture|pop (out|up) (the )?video|mini player"), () => send("media", media().id, "pip", ""));
add("theater", "Video and sound", "theater mode", R("theat(er|re) mode|cinema mode"), () => send("media", web().id, "theater", ""));
add("louder", "Video and sound", "louder", R("louder|volume up|turn it up"), () => send("media", media().id, "tabvol", "+20"));
add("quieter", "Video and sound", "quieter", R("quieter|softer|volume down|turn it down"), () => send("media", media().id, "tabvol", "-20"));
add("ambient", "Video and sound", "play rain sounds", R("play (some )?(" + Object.keys(AMBW).join("|") + ")( sounds| noise| ambience)?|(" + Object.keys(AMBW).join("|") + ") (sounds|noise|ambience)"), m => { const k = AMBW[(m[2] || m[4] || "").trim()]; if (!k) return null; cfg.ambient = k; MU.ambStarted = true; saveCfg(); ambUpdate(); return "Playing " + AMB_KINDS[k]; });
add("stopambient", "Video and sound", "stop the sounds", R("stop (the )?(ambient )?(sounds|noise|ambience|rain)"), () => { cfg.ambient = ""; saveCfg(); ambUpdate(); return "Sounds off"; });
add("sleeptimer", "Video and sound", "sleep timer", R("sleep timer|stop (the music|everything) (later|in a while)"), () => { sleepTimerPanel(); });

/* ---- saving and lists */
add("bookmark", "Saving and lists", "bookmark this", R("bookmark( this| it| this page)?|save (this|it|this page)|add (this )?to (my )?bookmarks"), () => { web(); $("#star").click(); return "Bookmarked"; });
add("readlater", "Saving and lists", "read this later", R("(read|save) (this|it) (for )?later|add (this |it )?to (my )?reading list"), () => { addToReading(web()); return "On your reading list"; });
add("bookmarks", "Saving and lists", "show my bookmarks", R("(show|open) (my )?bookmarks|bookmarks"), () => { open1("bookmarks.html"); });
add("history", "Saving and lists", "show my history", R("(show|open) (my )?history|history"), () => { open1("history.html"); });
add("downloads", "Saving and lists", "show downloads", R("(show|open) (my )?downloads|downloads"), () => { open1("downloads.html"); });
add("reading", "Saving and lists", "show my reading list", R("(show|open) (my )?reading list|reading list"), () => { openSide("reading"); });
add("note", "Saving and lists", "take a note buy milk", R("(take|make|write) a note( that| saying)? (.+)|note( that)? (.+)"), m => { const text = (m[3] || m[5]).trim(); const l = load("notes", []); l.unshift({ id:Date.now().toString(36), t:text, ts:Date.now() }); save("notes", l); return "Noted"; });
add("notes", "Saving and lists", "open my notes", R("(show|open) (my )?notes|notes"), () => { openSide("notes"); });
add("todo", "Saving and lists", "add call mom to my to do list", R("add (.+) to (my )?(to ?do|to do|task)( list)?|(new )?(to ?do|task) (.+)"), m => { const text = (m[1] || m[7]).trim(); const l = load("todo", []); l.unshift({ id:Date.now().toString(36), t:text, done:false, ts:Date.now() }); save("todo", l); return "Added to your to-do list"; });
add("remindsite", "Saving and lists", "remind me about this site", R("remind me (about this site|next time|when i'?m back here)"), () => { web(); X3.gtd.remindPanel(); });
add("clipboard", "Saving and lists", "clipboard history", R("clipboard( history)?|(show )?what i copied"), () => { clipsPanel(); });
add("collections", "Saving and lists", "open collections", R("(show|open) (my )?collections|collections"), () => { open1("collections.html"); });

/* ---- Web AI */
add("summarize", "Web AI", "summarize this page", R("summari[sz]e( this| the)?( page| article)?|sum (it|this) up|tl ?dr|what'?s this page about"), () => { web(); openSide("xai", "summarize"); return "Summarizing"; });
add("keymoments", "Web AI", "key moments", R("key moments|summari[sz]e (this|the) video|what happens in this video"), () => { web(); X3.ai.keyMoments(); });
add("study", "Web AI", "make flashcards", R("(make )?flash ?cards|quiz me|study (this|mode)( page)?"), () => { web(); X3.ai.studyPage(); });
add("tidy", "Web AI", "tidy my tabs", R("(tidy|organi[sz]e|clean up|group)( up)? (my )?tabs"), () => { X3.ai.tidyTabs(); });
add("compare", "Web AI", "compare my tabs", R("compare (my |these |the )?(tabs|products|pages)"), () => { X3.ai.compareTabs(); });
add("findagain", "Web AI", "find that page about volcanoes", R("find (that|the) page (about|with|on) (.+)|where was (that|the) page (about|with) (.+)"), () => { X3.ai.findAgain(); });
add("webai", "Web AI", "open Web AI", R("(open |show )?web ai|(open )?the (assistant|ai)"), () => { openSide("xai"); });
add("explain", "Web AI", "explain this page", R("explain (this|the) (page|article)|explain it( to me)?|what does this (page )?mean"), () => { web(); return askAI("Explain this page simply."); });
add("ask", "Web AI", "ask Web AI how far is the moon", R("(ask )?(web ai|ai)[, ]+(.+)|ask (.+)"), m => askAI(m[3] || m[4]));

/* ---- quick answers (spoken) */
add("time", "Quick answers", "what time is it", R("what time is it|what'?s the time|(tell me )?the time"), () => "It's " + new Date().toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }));
add("date", "Quick answers", "what's the date", R("what'?s (the )?date( today)?|what day is (it|today)|what'?s today"), () => "It's " + new Date().toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" }));
add("calc", "Quick answers", "what is 12 times 7", R("(what is|what's|calculate|how much is) ((?=.*(?:\\d|plus|minus|times|divided|multiplied|squared|cubed|percent|power)).+)"), m => { const v = calc(m[2]); return v == null ? null : m[2] + " is " + v; });
add("timer", "Quick answers", "set a timer for 10 minutes", R("(set )?(a )?timer (for )?(.+)|(.+) timer"), m => { const s = secs(m[4] || m[5]); if (!(s > 0)) return null; addTimer(s, "Voice timer"); return "Timer set for " + (s >= 60 ? Math.round(s / 60) + " minute" + (s >= 120 ? "s" : "") : s + " seconds"); });
add("timers", "Quick answers", "show my timers", R("(show )?(my )?(timers|alarms)|set an alarm"), () => { alarmPanel(); });
add("coin", "Quick answers", "flip a coin", R("flip a coin|heads or tails|toss a coin"), () => Math.random() < 0.5 ? "Heads!" : "Tails!");
add("dice", "Quick answers", "roll a die", R("roll (a |the )?(die|dice)"), () => "You rolled a " + (1 + Math.floor(Math.random() * 6)));
add("pick", "Quick answers", "pick a number between 1 and 100", R("pick a (random )?number( between ([\\w ]+?) and ([\\w ]+))?|random number"), m => { const a = m[3] ? num(m[3]) : 1, b = m[4] ? num(m[4]) : 10; if (!(isFinite(a) && isFinite(b))) return null; return String(Math.min(a, b) + Math.floor(Math.random() * (Math.abs(b - a) + 1))); });
add("joke", "Quick answers", "tell me a joke", R("tell me a joke|(say )?something funny|make me laugh"), () => JOKES[Math.floor(Math.random() * JOKES.length)]);
add("level", "Quick answers", "what level am I", R("what level am i|my level|how much xp( do i have)?"), () => { const i = window.XP && XP.info ? XP.info() : null; return i ? "You're level " + i.level + ", with " + i.xp + " XP" : null; });
add("battery", "Quick answers", "how much battery", R("(how much )?battery( left)?|battery level"), async () => { if (!navigator.getBattery) return "I can't see the battery here"; const b = await navigator.getBattery(); return Math.round(b.level * 100) + " percent" + (b.charging ? ", charging" : ""); });

/* ---- looks */
add("theme", "Looks and fun", "change the theme to Naruto", R("(change|switch|set) (the )?(anime )?theme to (.+)|(" + Object.keys(THEMES).join("|") + ") theme"), m => { const id = THEMES[(m[4] || m[5] || "").trim()]; if (!id || !X3.animeChoose) return null; X3.animeChoose(id, true); return "Theme changed"; });
add("notheme", "Looks and fun", "no anime theme", R("no (anime )?theme|turn off the (anime )?theme|normal look"), () => { if (X3.animeChoose) X3.animeChoose("", false); return "Theme off"; });
add("themes", "Looks and fun", "show anime themes", R("(show|open) (the )?(anime )?themes|anime themes"), () => { X3.animePanel(); });
add("dark", "Looks and fun", "dark mode", R("dark mode( on)?|(turn on|switch to) dark mode|go dark"), () => { cfg.theme = "dark"; saveCfg(); applyLook(); return "Dark mode"; });
add("light", "Looks and fun", "light mode", R("light mode( on)?|(turn on|switch to) light mode|dark mode off"), () => { cfg.theme = "light"; saveCfg(); applyLook(); return "Light mode"; });
add("screensaver", "Looks and fun", "start the screensaver", R("(start|show) (the )?screen ?saver|screen ?saver"), () => { if (X3.saver) X3.saver.show(); });
add("gallery", "Looks and fun", "wallpaper gallery", R("(open |show )?(the )?wallpaper gallery|new wallpaper"), () => { X3.stats.galleryPanel(); });
add("games", "Looks and fun", "open games", R("(open |show )?(the )?games|(let'?s )?play a game|let'?s play|i'?m bored"), () => { open1("games.html"); });
add("playgame", "Looks and fun", "play chess", R("play (a game of )?(" + Object.keys(GAMES).join("|") + ")|open (" + Object.keys(GAMES).join("|") + ")( game)?"), m => { const g = GAMES[(m[2] || m[3] || "").trim()]; if (!g) return null; open1("games.html#" + g); return "Let's play"; });
add("achievements", "Looks and fun", "show my achievements", R("(show )?(my )?achievements|trophies"), () => { achPanel(); });
add("levels", "Looks and fun", "show levels", R("(show |open )?(my )?(levels|xp)"), () => { if (X3.xpPanel) X3.xpPanel(); });

/* ---- Webs features */
add("focus", "Webs features", "focus for 25 minutes", R("(start )?focus( mode)?( for (.+))?|(i need to |help me )?focus"), m => { const s = m[4] ? secs(m[4]) : 25 * 60; if (!(s > 0)) return null; startFocus(Math.round(s / 60)); return "Focus mode for " + Math.round(s / 60) + " minutes"; });
add("stopfocus", "Webs features", "stop focus mode", R("stop focus( mode)?|end focus( mode)?|i'?m done focusing"), () => { startFocus(-1); return "Focus mode off"; });
add("near", "Webs features", "what's happening near me", R("what'?s happening( near me| nearby| around here)?|events near me|anything (fun|happening) (near me|nearby)|what'?s on (near me|nearby|tonight)"), () => { X3.near.nearPanel(); });
add("seen", "Webs features", "what do sites see about me", R("what (do|can) (sites|websites) see( about me)?|my privacy"), () => { X3.privacy.seenPanel(); });
add("privacytools", "Webs features", "privacy tools", R("privacy tools|(open )?privacy"), () => { X3.privacy.privacyPanel(); });
add("shopcheck", "Webs features", "is this shop real", R("is this (shop|store|site) (real|legit|safe|a scam)|check this (shop|store)"), () => { X3.privacy.shopCheck(web(), true); return "Checking"; });
add("vpn", "Webs features", "turn on the VPN", R("(turn (on|off) |open )?(the )?vpn( on| off)?|hide my (ip|address)"), () => { vpnPanel(); });
add("phonepc", "Webs features", "phone and PC", R("(open )?phone and pc|link my phone"), () => { X3.link.devicesPanel(); });
add("sendphone", "Webs features", "send this to my phone", R("send (this|it|this page|these tabs|my tabs) to my phone"), m => { X3.link.sharePanel(""); });
add("routine", "Webs features", "morning routine", R("(open |start )?(my )?morning (routine|sites)|good morning"), () => { X3.gtd.openRoutine(true); return "Good morning!"; });
add("fill", "Webs features", "fill in my address", R("fill (in )?(my )?address|fill (in )?(this|the) form"), () => { X3.gtd.fillAddress(); });
add("invite", "Webs features", "invite a friend", R("invite (a )?friend"), () => { X3.stats.invitePanel(); });
add("settings", "Webs features", "open settings", R("(open |show )?(the )?settings|preferences"), () => { open1("settings.html"); });
add("whatsnew", "Webs features", "what's new", R("what'?s new( in webs)?"), () => { open1("whatsnew.html"); });
add("sidebar", "Webs features", "toggle the sidebar", R("(open|close|show|hide|toggle) (the )?side ?bar"), () => { toggleSide(); });
add("help", "Webs features", "what can I say", R("what can i say|(voice )?commands|help( me)?|what can you do"), () => { voicePanel(true); return "Here's what you can say"; });

/* ---- voice control itself */
add("stoplisten", "Voice control", "stop listening", R("stop listening|go to sleep|turn off voice( control)?|mic off"), () => { setOn(false); return "Okay, I've stopped listening"; });
add("repeat", "Voice control", "say that again", R("say that again|repeat( that)?|what did you say"), () => lastSaid || "I haven't said anything yet");
add("thanks", "Voice control", "thank you", R("thanks?( you)?( webs)?|nice|good job|good (bot|browser)"), () => ["You're welcome!", "Any time!", "Happy to help!"][Math.floor(Math.random() * 3)]);
add("hello", "Voice control", "hello", R("hello|hi( there)?|hey"), () => "Hi! Say what you'd like, or “what can I say”.");
add("talkoff", "Voice control", "stop talking back", R("(stop|don'?t) (talking|answering) (back|out loud)|quiet mode"), () => { cfg.xVoiceTalk = false; saveCfg(); return "I'll stay quiet"; });
add("talkon", "Voice control", "talk back", R("talk back|answer out loud|speak to me"), () => { cfg.xVoiceTalk = true; saveCfg(); return "I'll answer out loud"; });
// last: a site's name
add("open", "Going places", "open YouTube", R("(open|go to|visit|launch|take me to) (.+)"), m => { let s = m[2].trim(); const nt = / in a new tab$/.test(s); s = s.replace(/ in a new tab$/, ""); const u = SITES[s] || site(s); if (nt) newTab(resolve(u), false); else go(u); return "Opening " + s; });

/* ---------------------------------------------------------------- understanding what was said */
const POLITE = /^(please|can you|could you|would you|will you|i want to|i'?d like to|let'?s|go ahead and|now|just|okay|ok|hey|um|uh)\s+/;
function norm(text) {
  let s = String(text || "").toLowerCase().replace(/[’`]/g, "'").replace(/(\d)\.(\d)/g, "$1\u0000$2").replace(/[.,!?;:"]+/g, " ").replace(/\u0000/g, ".").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4 && POLITE.test(s); i++) s = s.replace(POLITE, "");
  return s.replace(/\s+(please|for me|now|thanks|thank you)$/, "").trim();
}
// your own phrases: { say:"study time", do:"open khanacademy.org then focus for 25 minutes" }
const custom = () => (Array.isArray(cfg.xVoiceCustom) ? cfg.xVoiceCustom : []).filter(x => x && x.say && x.do);
function parse(text) {
  const s = norm(text);
  if (!s) return null;
  const mine = custom().find(x => norm(x.say) === s);
  if (mine) return { id:"custom", custom:mine, s };
  for (const c of C) for (const re of c.res) { const m = re.exec(s); if (m) return { id:c.id, c, m, s }; }
  return null;
}
let lastSaid = "";
async function run(text) {
  const p = parse(text), s = norm(text);
  if (!s) return "";
  if (p && p.custom) {
    const steps = p.custom.do.split(/\s*(?:,|;|\bthen\b|\band then\b)\s*/).filter(Boolean).slice(0, 8);
    for (const st of steps) { const q = parse(st); if (q && !q.custom) await exec(q); }
    return reply("Done: " + p.custom.say);
  }
  if (p) { const r = await exec(p); if (r !== null) return reply(r || "Done"); }
  // a question nothing else answered: Web AI
  if (/^(what|who|whom|whose|why|how|when|where|which|is|are|can|does|do|should|could|will|would|tell me|explain)\b/.test(s) && s.split(" ").length >= 3) return reply(askAI(s));
  return reply("Sorry, I didn't catch that. Say “what can I say” for the list.", true);
}
async function exec(p) {
  try {
    let r = p.c.fn(p.m);
    if (r && typeof r.then === "function") r = await r;
    if (r === null) return null;              // not really this command: let the others try
    bump(p.c.id);
    return typeof r === "string" ? r : "";
  } catch (e) {
    if (e instanceof Say) return e.message;
    console.error(e); return "That didn't work";
  }
}
// the next command that matches after one that declined (for "search for pizza on this page" and the like)
const execOrig = exec;
exec = async function (p) {
  const r = await execOrig(p);
  if (r !== null) return r;
  let after = false;
  for (const c of C) {
    if (c === p.c) { after = true; continue; }
    if (!after) continue;
    for (const re of c.res) { const m = re.exec(p.s); if (m) { const r2 = await execOrig({ c, m, s:p.s }); if (r2 !== null) return r2; } }
  }
  return null;
};
const bump = id => { const u = load("voiceUse", {}); u[id] = (u[id] || 0) + 1; save("voiceUse", u); if (window.Stats) Stats.use("v." + id); };
function reply(text, missed) {
  lastSaid = text;
  chip(missed ? "miss" : "done", text);
  if (cfg.xVoiceTalk !== false && text && window.speechSynthesis) {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, "")); u.rate = 1.05; L.talking = true; u.onend = u.onerror = () => { setTimeout(() => { L.talking = false; }, 400); }; speechSynthesis.speak(u); } catch (e) { L.talking = false; }
  }
  return text;
}

/* ---------------------------------------------------------------- listening */
const L = { on:false, engine:"", eng:null, awakeUntil:0, talking:false, err:"", heardAt:0 };
const wake = () => String(cfg.xVoiceWake || "hey webs").toLowerCase().replace(/[.,!?;:"’]+/g, " ").replace(/\s+/g, " ").trim() || "hey webs";
function wakeRe() {
  const w = wake().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/webs/g, "(?:webs|webb?s|web's|webz|web|wips|webbs)").replace(/^hey /, "(?:hey|hay|a|hi|okay|ok) ");
  return new RegExp("(?:^|\\s)" + w + "(?:\\s|$)(.*)$");
}
async function heard(text, final) {
  if (!L.on || L.talking || !text) return;
  const t = String(text).toLowerCase().replace(/[.,!?]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return;
  if (cfg.xVoiceNoWake) { if (final) { chip("heard", t); await run(t); } else chip("partial", t); return; }
  const m = wakeRe().exec(t);
  if (m) {
    const rest = m[1].trim();
    if (!rest) { if (final || Date.now() > L.awakeUntil) { L.awakeUntil = Date.now() + 8000; chip("awake"); ding(); } return; }
    if (final) { L.awakeUntil = 0; chip("heard", rest); await run(rest); } else chip("partial", rest);
    return;
  }
  if (Date.now() < L.awakeUntil) {
    if (final) { L.awakeUntil = 0; chip("heard", t); await run(t); } else chip("partial", t);
  }
}
function ding() {
  try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.05; o.connect(g); g.connect(c.destination); o.start(); o.frequency.setValueAtTime(1320, c.currentTime + 0.08); o.stop(c.currentTime + 0.16); setTimeout(() => c.close(), 400); } catch (e) {}
}
/* ---- which microphone (3.13): Windows' default, or one you pick (settings.xVoiceMic, its device id; xVoiceMicName to
   show it when it's unplugged). The browser's recognition can take a chosen mic where WebView2 lets it (start(track));
   otherwise the offline engine uses it. A chosen mic that isn't plugged in: the default, and Webs says so. */
const AUDIO = { echoCancellation:true, noiseSuppression:true, channelCount:1 };
async function openMic() {
  const id = cfg.xVoiceMic || "";
  if (id) {
    try { return await navigator.mediaDevices.getUserMedia({ video:false, audio:Object.assign({ deviceId:{ exact:id } }, AUDIO) }); }
    catch (e) {
      if (e && e.name === "NotAllowedError") throw e;
      toast("🎙️ " + (cfg.xVoiceMicName || "Your chosen microphone") + " isn't plugged in. Using Windows' default microphone.");
    }
  }
  return navigator.mediaDevices.getUserMedia({ video:false, audio:AUDIO });
}
async function mics() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
}
// the browser's own speech recognition, kept going
function webEngine() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  let r = null, stopped = false, fails = 0, okAt = 0, track = null, stream = null;
  const start = async () => {
    if (stopped) return;
    try { r = new SR(); } catch (e) { fail("none"); return; }
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || "en-US"; r.maxAlternatives = 1;
    r.onresult = e => { okAt = Date.now(); fails = 0; for (let i = e.resultIndex; i < e.results.length; i++) heard(e.results[i][0].transcript, e.results[i].isFinal); };
    r.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed") { stopped = true; fail("mic"); return; }
      if (++fails >= 3 && Date.now() - okAt > 60000) { stopped = true; fail("web"); }
    };
    r.onend = () => { if (!stopped) setTimeout(start, fails ? 1500 : 200); };
    if (cfg.xVoiceMic) {
      // a chosen microphone: handed to the recognition as an audio track, where WebView2 can do that
      try { if (!track || track.readyState === "ended") { stream = await openMic(); track = stream.getAudioTracks()[0]; } }
      catch (e) { stopped = true; fail(e && e.name === "NotAllowedError" ? "mic" : "web"); return; }
      if (stopped) return;
      try { r.start(track); return; }
      catch (e) { if (e instanceof TypeError || (e && e.name === "TypeError")) { stopped = true; if (stream) stream.getTracks().forEach(t => t.stop()); fail("choose"); return; } setTimeout(start, 1000); return; }
    }
    try { r.start(); } catch (e) { setTimeout(start, 1000); }
  };
  start();
  return { name:"web", stop() { stopped = true; try { r && r.abort(); } catch (e) {} try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) {} } };
}
// the offline engine: Vosk in WebAssembly, the small English model (downloaded once, then cached by the browser)
function loadScript(src) { return new Promise((ok, bad) => { if (window.Vosk) { ok(); return; } const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("The offline engine couldn't be downloaded.")); document.head.appendChild(s); }); }
async function offlineEngine() {
  chip("loading", "Getting the offline voice engine ready (40 MB, only the first time)…");
  await loadScript(VOSK_JS);
  const model = await Vosk.createModel(VOSK_MODEL);
  const stream = await openMic();
  const ctx = new AudioContext(), rec = new model.KaldiRecognizer(ctx.sampleRate);
  rec.on("result", m => { const t = m && m.result && m.result.text; if (t) heard(t, true); });
  rec.on("partialresult", m => { const t = m && m.result && m.result.partial; if (t) heard(t, false); });
  const src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(); mute.gain.value = 0;
  node.onaudioprocess = e => { if (!L.talking) { try { rec.acceptWaveform(e.inputBuffer); } catch (x) {} } };
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);
  chip("on");
  return { name:"offline", stop() { try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} try { ctx.close(); } catch (e) {} try { model.terminate(); } catch (e) {} } };
}
function fail(why) {
  if (L.eng) { try { L.eng.stop(); } catch (e) {} L.eng = null; }
  L.err = why;
  if (why === "mic") { chip("err", "The microphone isn't allowed for Webs. Allow it in Windows → Settings → Privacy → Microphone."); return; }
  if (cfg.xVoiceOffline) startOffline();
  else { chip("err", why === "choose" ? "Windows' speech recognition can only use the default microphone here. Click to use the offline engine with yours." : "Voice needs the offline engine here. Click to set it up."); if (overlay === "voicep") voicePanel(); }
}
async function startOffline() {
  try { L.eng = await offlineEngine(); L.engine = "offline"; L.err = ""; }
  catch (e) { L.eng = null; L.err = "offline"; chip("err", e && e.name === "NotAllowedError" ? "The microphone isn't allowed for Webs." : (e.message || "The offline engine didn't start.")); }
}
function start() {
  if (L.eng || !L.on) return;
  if (cfg.xVoiceFront !== false && document.hidden) return;
  if (cfg.xVoiceOffline || !(window.SpeechRecognition || window.webkitSpeechRecognition)) { if (cfg.xVoiceOffline) startOffline(); else fail("web"); return; }
  L.eng = webEngine(); L.engine = "web"; chip("on");
}
function stop() { if (L.eng) { try { L.eng.stop(); } catch (e) {} L.eng = null; } chip(L.on ? "paused" : "off"); }
function setOn(on) {
  L.on = !!on; cfg.xVoice = L.on; saveCfg();
  if (L.on) { L.err = ""; start(); toast("🎙️ Listening for “" + (cfg.xVoiceWake || "Hey Webs") + "”" + (cfg.xVoiceNoWake ? "" : ". Say it, then a command."), { label:"Commands", fn:() => voicePanel(true) }); }
  else { stop(); toast("🎙️ Voice control off"); }
  if (overlay === "voicep") voicePanel();
}
document.addEventListener("visibilitychange", () => { if (!L.on || cfg.xVoiceFront === false) return; if (document.hidden) stop(); else start(); });

/* ---------------------------------------------------------------- the 🎙️ button */
const btn = document.createElement("button");
btn.className = "btn vcb"; btn.id = "vcb"; btn.title = "Voice control  (Alt+Shift+M) - right-click to turn it on or off";
btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span class="vcl"></span>';
const anchor = $("#sideb"); if (anchor) anchor.before(btn);
btn.onclick = () => voicePanel();
btn.oncontextmenu = e => { e.preventDefault(); setOn(!L.on); };
let chipT = 0;
function chip(state, text) {
  btn.classList.toggle("on", L.on); btn.dataset.s = state || "";
  const l = btn.querySelector(".vcl");
  clearTimeout(chipT);
  l.textContent = state === "awake" ? "Listening…" : state === "partial" || state === "heard" ? "“" + String(text).slice(0, 40) + "”" : state === "done" || state === "miss" ? String(text || "").slice(0, 50) : state === "loading" ? "Getting ready…" : state === "err" ? "⚠" : "";
  if (state === "err" && text) toast("🎙️ " + text, { label:"Voice control", fn:() => voicePanel() });
  if (state === "done" || state === "miss") { if (text) toast("🎙️ " + text); chipT = setTimeout(() => chip(L.on ? "on" : "off"), 3500); }
  if (state === "awake") chipT = setTimeout(() => { if (Date.now() >= L.awakeUntil) chip(L.on ? "on" : "off"); }, 8200);
  if (overlay === "voicep") { const s = document.querySelector("#voicep .vc-live"); if (s) s.textContent = l.textContent || (L.on ? "🎙️ Listening for “" + (cfg.xVoiceWake || "Hey Webs") + "”" : "Off"); }
}

/* ---------------------------------------------------------------- the panel */
function voicePanel(list) {
  const p = el("div", "xpane gtp vcp");
  p.innerHTML = '<div class="xhead"><div class="xic">🎙️</div><div><b>Voice control</b><span></span></div></div><div class="gtb"></div>';
  p.querySelector(".xhead span").textContent = L.on ? (L.eng ? "Listening for “" + (cfg.xVoiceWake || "Hey Webs") + "”" + (L.engine === "offline" ? " (offline engine)" : "") : L.err ? "Not listening yet" : "Paused") : "Off";
  const n = openOver("voicep", p), rail = $("#rail"); n.style.right = (rail && rail.offsetWidth && getComputedStyle(rail).display !== "none" ? rail.offsetWidth + 8 : 8) + "px";
  const b = p.querySelector(".gtb"), sw = (k, label, sub, def) => '<label class="lksw"><span><b>' + label + "</b><em>" + sub + '</em></span><input type="checkbox" data-k="' + k + '"' + ((cfg[k] === undefined ? def : cfg[k]) ? " checked" : "") + "></label>";
  const groups = []; C.forEach(c => { if (groups.indexOf(c.g) < 0) groups.push(c.g); });
  b.innerHTML = '<div class="vc-live"></div>' +
    '<button class="btn2 main vc-on">' + (L.on ? "Stop listening" : "Start listening") + "</button>" +
    (L.err === "choose" ? '<div class="vc-warn">Windows\' speech recognition can only listen to the default microphone here. The offline engine can use the one you picked: a 40 MB download once (Vosk), and then nothing you say leaves this PC.<button class="btn2 vc-off">Use the offline engine</button></div>' : "") +
    (L.err === "web" || L.err === "offline" ? '<div class="vc-warn">Speech recognition doesn\'t work inside Windows here. The offline engine does: a 40 MB download once (Vosk), and then nothing you say ever leaves this PC.<button class="btn2 vc-off">Use the offline engine</button></div>' : "") +
    '<div class="gtk">Settings</div>' +
    '<label class="gtf"><span>Microphone</span><select class="xin vc-mic"><option value="">Windows\' default microphone</option></select></label>' +
    '<div class="vc-meter" title="How loud the microphone hears you"><i></i></div><div class="xsmall vc-micnote"></div>' +
    '<label class="gtf"><span>Wake phrase (say it first)</span><input class="xin vc-wake" maxlength="30" placeholder="Hey Webs"></label>' +
    sw("xVoiceTalk", "Answer out loud", "Webs says what it did, and answers questions", true) +
    sw("xVoiceFront", "Only while Webs is in front", "Stops listening when another window is in front", true) +
    sw("xVoiceNoWake", "Don't wait for the wake phrase", "Every sentence is a command (for a quiet room)", false) +
    sw("xVoiceOffline", "Use the offline engine", "Vosk, 40 MB once, private and works without internet", false) +
    '<div class="gtk">Try it (type what you\'d say)</div><div class="pvadd"><input class="xin vc-try" placeholder="open youtube"><button class="btn2 vc-go">Do it</button></div>' +
    '<div class="gtk">Your own commands</div><div class="vc-mine"></div><div class="vc-add"><input class="xin vc-say" placeholder="When I say… (study time)"><input class="xin vc-do" placeholder="Do… (open khanacademy.org then focus for 25 minutes)"><button class="btn2">Add</button></div>' +
    '<div class="gtk">What you can say (' + C.length + ' commands)</div><div class="vc-list">' + groups.map(g => "<details" + (list ? " open" : "") + "><summary>" + esc(g) + " · " + C.filter(c => c.g === g).length + "</summary><ul>" +
      C.filter(c => c.g === g).map(c => "<li>“" + esc(c.ex) + "”</li>").join("") + "</ul></details>").join("") + "</div>" +
    '<div class="xsmall">Nothing is recorded or kept: only the words after the wake phrase are acted on. Not in private windows.</div>';
  chip(btn.dataset.s);
  b.querySelector(".vc-on").onclick = () => setOn(!L.on);
  const off = b.querySelector(".vc-off"); if (off) off.onclick = () => { cfg.xVoiceOffline = true; saveCfg(); L.err = ""; if (L.on) { stop(); start(); } voicePanel(); };
  micPicker(b);
  const wk = b.querySelector(".vc-wake"); wk.value = cfg.xVoiceWake || ""; wk.onchange = () => { cfg.xVoiceWake = wk.value.trim().slice(0, 30); saveCfg(); };
  b.querySelectorAll("[data-k]").forEach(c => { c.onchange = () => { cfg[c.dataset.k] = c.checked; saveCfg(); if (c.dataset.k === "xVoiceOffline" && L.on) { stop(); L.err = ""; start(); } }; });
  const tr = b.querySelector(".vc-try"), goT = async () => { if (tr.value.trim()) { const r = await run(tr.value); tr.value = ""; const s = b.querySelector(".vc-live"); if (s) s.textContent = r; } };
  b.querySelector(".vc-go").onclick = goT; tr.onkeydown = e => { if (e.key === "Enter") goT(); };
  const mine = b.querySelector(".vc-mine"), paintMine = () => {
    const l = custom(); mine.innerHTML = l.length ? "" : '<div class="xsmall">None yet. Make one phrase do several things.</div>';
    l.forEach((x, i) => { const r = el("div", "vc-row"); r.innerHTML = "<b></b><span></span><button class=\"btn\">✕</button>"; r.querySelector("b").textContent = "“" + x.say + "”"; r.querySelector("span").textContent = "→ " + x.do;
      r.querySelector("button").onclick = () => { cfg.xVoiceCustom = custom().filter((y, j) => j !== i); saveCfg(); paintMine(); }; mine.appendChild(r); });
  };
  paintMine();
  b.querySelector(".vc-add button").onclick = () => {
    const s = b.querySelector(".vc-say").value.trim(), d = b.querySelector(".vc-do").value.trim();
    if (!s || !d) { toast("Say what to listen for, and what to do"); return; }
    const bad = d.split(/\s*(?:,|;|\bthen\b|\band then\b)\s*/).filter(Boolean).filter(x => !parse(x));
    if (bad.length) { toast("Webs doesn't know “" + bad[0] + "” yet. Try one from the list."); return; }
    cfg.xVoiceCustom = custom().concat([{ say:s.slice(0, 60), do:d.slice(0, 300) }]).slice(-30); saveCfg();
    b.querySelector(".vc-say").value = ""; b.querySelector(".vc-do").value = ""; paintMine();
  };
}

/* ---------------------------------------------------------------- the microphone picker, and a meter to see it's the right one */
let meter = null;
function stopMeter() { if (meter) { cancelAnimationFrame(meter.raf); try { meter.stream.getTracks().forEach(t => t.stop()); } catch (e) {} try { meter.ctx.close(); } catch (e) {} meter = null; } }
async function startMeter(b) {
  stopMeter();
  const bar = b.querySelector(".vc-meter i"); if (!bar) return;
  let stream; try { stream = await openMic(); } catch (e) { return; }
  if (!b.isConnected) { stream.getTracks().forEach(t => t.stop()); return; }
  const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  meter = { stream, ctx, raf:0 };
  const tick = () => {
    if (!b.isConnected || overlay !== "voicep") { stopMeter(); return; }
    an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
    bar.style.width = Math.min(100, peak / 128 * 220) + "%";
    meter.raf = requestAnimationFrame(tick);
  };
  tick();
}
async function micPicker(b) {
  const sel = b.querySelector(".vc-mic"), note = b.querySelector(".vc-micnote");
  const paint = async () => {
    let l = await mics();
    // names show once the microphone has been allowed: ask once, quietly
    if (l.length && !l.some(d => d.label)) { try { const s = await navigator.mediaDevices.getUserMedia({ audio:true }); s.getTracks().forEach(t => t.stop()); l = await mics(); } catch (e) {} }
    if (!sel.isConnected) return;
    const cur = cfg.xVoiceMic || "";
    sel.innerHTML = '<option value="">Windows\' default microphone</option>' + l.map((d, i) => '<option value="' + esc(d.deviceId) + '">' + esc(d.label || "Microphone " + (i + 1)) + "</option>").join("");
    if (cur && !l.some(d => d.deviceId === cur)) sel.insertAdjacentHTML("beforeend", '<option value="' + esc(cur) + '">' + esc(cfg.xVoiceMicName || "Your microphone") + " (not plugged in)</option>");
    sel.value = cur;
    note.textContent = l.length ? "Talk: the bar should move." : "No microphone found. Plug one in.";
  };
  await paint();
  sel.onchange = () => {
    cfg.xVoiceMic = sel.value; cfg.xVoiceMicName = sel.value ? sel.options[sel.selectedIndex].textContent.replace(/ \(not plugged in\)$/, "") : ""; saveCfg();
    toast("🎙️ " + (sel.value ? "Using " + cfg.xVoiceMicName : "Using Windows' default microphone"));
    if (L.on) { stop(); L.err = ""; start(); }
    startMeter(b);
  };
  startMeter(b);
  if (navigator.mediaDevices && !micPicker.watching) { micPicker.watching = true; navigator.mediaDevices.addEventListener("devicechange", () => { const p = document.querySelector("#voicep .gtb"); if (p) micPicker(p); }); }
}

/* ---------------------------------------------------------------- hooks */
const shortcutV = shortcut;
shortcut = function (k, ctrl, shift, alt) { if (alt && shift && !ctrl && k === 77) { setOn(!L.on); return; } return shortcutV(k, ctrl, shift, alt); };      // Alt+Shift+M
const onToolResultV = onToolResult;
onToolResult = function (id, json) { let r = null; try { r = JSON.parse(json); } catch (e) {} if (r && r.a === "x-key" && r.k === "M") { if (id === active) setOn(!L.on); return; } onToolResultV(id, json); };
const menuRowsV = X3.menuRows;
X3.menuRows = function (m) { if (menuRowsV) menuRowsV(m); m.appendChild(row("speech", "Voice control (“Hey Webs”)…" + (L.on ? " ●" : ""), "Alt+Shift+M", () => voicePanel())); };
const commandsV = commands;
commands = function () { return commandsV().concat([{ t:"Voice control: listen for “Hey Webs”", k:"Alt+Shift+M", i:"speech", fn:() => setOn(!L.on) }, { t:"Voice commands: what you can say", k:"", i:"speech", fn:() => voicePanel(true) }]); };
// Settings → Voice control changed it
const reloadSettingsV = reloadSettings;
reloadSettings = function () { reloadSettingsV.apply(this, arguments); if (!!cfg.xVoice !== L.on) { L.on = !!cfg.xVoice; if (L.on) start(); else stop(); } };
X3.voice = { mics, openMic, stopMeter, parse, run, hear:heard, setOn, voicePanel, norm, calc, secs, num, COMMANDS:C, state:() => L, wakeRe };
if (cfg.xVoice) setTimeout(() => { L.on = true; start(); chip(L.eng ? "on" : "paused"); }, 2500); else chip("off");

const st = document.createElement("style");
st.textContent = `
.vcb{position:relative;width:auto!important;min-width:30px;gap:4px;display:inline-flex;align-items:center}.vcb .vcl{font-size:11.5px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vcb.on .ic{color:#ef4444}.vcb[data-s="awake"]{background:color-mix(in srgb,#ef4444 18%,transparent);animation:vcPulse 1s infinite}.vcb[data-s="awake"] .ic,.vcb[data-s="partial"] .ic,.vcb[data-s="heard"] .ic{color:#ef4444}
.vcb[data-s="err"] .ic{color:#e8a33a}@keyframes vcPulse{50%{box-shadow:0 0 0 4px color-mix(in srgb,#ef4444 25%,transparent)}}
.vcp{width:min(420px,calc(100vw - 120px))}.vcp .gtb{max-height:70vh;overflow:auto}.vc-live{min-height:20px;font-size:13.5px;margin-bottom:8px;color:var(--dim)}.vc-warn{background:color-mix(in srgb,#e8a33a 15%,transparent);border-radius:10px;padding:10px;margin:10px 0;font-size:12.5px}
.vc-warn .btn2{margin-top:8px}.vc-mic{width:100%}.vc-meter{height:6px;border-radius:3px;background:var(--bg3);overflow:hidden;margin:4px 0 2px}.vc-meter i{display:block;height:100%;width:0;background:#4ec98a;transition:width .08s}.vc-add{display:grid;gap:6px;margin:6px 0}.vc-add .xin{margin:0}.vc-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.vc-row span{color:var(--dim);grid-column:1}.vc-row button{grid-row:1/3;grid-column:2}.vc-list details{border-bottom:1px solid var(--line);padding:6px 0}.vc-list summary{cursor:pointer;font-weight:600;font-size:13px}
.vc-list ul{margin:6px 0 4px 18px;font-size:12.5px;color:var(--dim);columns:2}
`;
document.head.appendChild(st);
})();
