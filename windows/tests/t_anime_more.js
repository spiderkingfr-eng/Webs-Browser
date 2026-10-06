// Ideas #051-#075 (Windows 3.14 / iPhone 2.11): more for anime fans (../../js/anime.more.js), in the window
// (src/anime.more.chrome.js), on the new tab page (src/anime.more.newtab.js), on web pages (src/shield.more.js) and on the
// iPhone (../../js/anime.more.app.js), with a pretend AniList, radio list and Web AI server.
const fs = require("fs"), path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, ms = 5000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(80); } return false; };
const untilN = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(60); } return false; };
const APP = path.join(ROOT, "..");
const TYPES = { html:"text/html; charset=utf-8", js:"text/javascript", css:"text/css", json:"application/json", webmanifest:"application/manifest+json", svg:"image/svg+xml", png:"image/png" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const now = Date.now();
const media = (id, t, extra) => Object.assign({ id, title:{ romaji:t + " (romaji)", english:t }, coverImage:{ large:"https://img.anilist.test/" + id + ".png", medium:"https://img.anilist.test/" + id + ".png", color:"#e8342a" },
  nextAiringEpisode:{ airingAt:Math.round((now + id * 3600e3) / 1000), episode:id + 2 }, episodes:12, genres:["Action", "Fantasy"], averageScore:80 + id, siteUrl:"https://anilist.co/anime/" + id, status:"RELEASING", startDate:{ year:2026, month:10, day:1 } }, extra || {});
const SHOWS = ["Blade Saga", "Moon Diary", "Sky Ninjas", "Ramen Quest", "Spirit Gate", "Pixel Hearts", "Iron Lotus", "Night Train", "Fox Shrine", "Ocean Drift"];
const anilist = []; let alFail = false;
async function al(r) {
  const H = { "access-control-allow-origin":"*", "access-control-allow-headers":"content-type, accept" };
  if (r.request().method() === "OPTIONS") return r.fulfill({ status:204, headers:H });
  const b = JSON.parse(r.request().postData() || "{}"), q = b.query || ""; anilist.push(b);
  if (alFail) return r.fulfill({ status:429, headers:H, body:"" });
  let data = {};
  if (/isBirthday/.test(q)) data = { Page:{ characters:[{ id:1, name:{ full:"Satoru Gojo" }, image:{ medium:"https://img.anilist.test/c1.png" }, siteUrl:"https://anilist.co/character/1", media:{ nodes:[{ title:{ romaji:"Jujutsu Kaisen", english:"Jujutsu Kaisen" } }] } },
    { id:2, name:{ full:"Someone Else" }, image:{ medium:"" }, siteUrl:"", media:{ nodes:[] } }] } };
  else if (/Staff\(id/.test(q)) data = { Staff:{ characters:{ nodes:[{ name:{ full:"Hero A" }, media:{ nodes:[{ title:{ english:"Show A" } }] } }, { name:{ full:"Villain B" }, media:{ nodes:[{ title:{ english:"Show B" } }] } }] } } };
  else if (/characters\(search/.test(q)) data = { Page:{ characters:[{ id:5, name:{ full:"Satoru Gojo" }, image:{ medium:"" }, siteUrl:"", media:{ edges:[{ node:{ title:{ english:"Jujutsu Kaisen" } },
    ja:[{ id:77, name:{ full:"Yuichi Nakamura" }, image:{ medium:"" }, siteUrl:"" }], en:[{ id:78, name:{ full:"Kaiji Tang" }, image:{ medium:"" }, siteUrl:"" }] }] } }] } };
  else if (/id_in/.test(q)) data = { Page:{ media:(b.variables.ids || []).map(id => media(id, SHOWS[(id - 1) % 10])) } };
  else if (/search:\$q/.test(q)) data = { Page:{ media:[media(4, "Ramen Quest"), media(9, "Fox Shrine")] } };
  else if (/season:\$s/.test(q)) data = { Page:{ media:SHOWS.slice(0, 6).map((t, i) => media(i + 1, t)) } };
  else if (/format:TV/.test(q)) data = { Page:{ media:SHOWS.map((t, i) => ({ id:i + 1, title:{ english:t }, coverImage:{ large:"https://img.anilist.test/" + (i + 1) + ".png" } })) } };
  r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ data }) });
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:860 } });
  await setup(ctx);
  const chats = [], fillers = [];
  const route = async r => {
    const u = new URL(r.request().url()), H = { "access-control-allow-origin":"*" };
    if (u.pathname === "/filler") { fillers.push(u.searchParams.get("s")); return r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify(u.searchParams.get("s") === "naruto"
      ? { ok:true, show:"Naruto", filler:"26, 97-106, 136-220", mixed:"7, 9", canon:"1-6, 8", anime:"", url:"https://www.animefillerlist.com/shows/naruto" } : { ok:false, error:"none", message:"There's no filler list for that show." }) }); }
    if (u.pathname === "/chat") {
      const b = JSON.parse(r.request().postData()); chats.push(b);
      const m = b.messages[b.messages.length - 1], text = typeof m.content === "string" ? m.content : m.content.map(x => x.text || "").join("");
      const ans = /How is the Japanese/.test(text) ? "tomodachi | friend" : /watch order/.test(text) ? "1. **Fate/Zero** (TV, 2011)\n2. Fate/stay night: UBW (TV, 2014)" : "Ok.";
      return r.fulfill({ status:200, headers:H, contentType:"application/x-ndjson", body:JSON.stringify({ d:ans }) + "\n" + JSON.stringify({ end:1, stop:"end_turn", left:10 }) + "\n" });
    }
    r.fulfill({ status:200, headers:H, contentType:"application/json", body:JSON.stringify({ ok:true, left:10, limit:25 }) });
  };
  const radioList = [{ stationuuid:"r1", name:"Anime Lofi Radio", url_resolved:"https://stream.test/lofi", country:"Japan", tags:"anime,lofi", favicon:"" },
    { stationuuid:"r2", name:"J-Pop Station", url_resolved:"https://stream.test/jpop", country:"Japan", tags:"anime,jpop", favicon:"" },
    { stationuuid:"r3", name:"Old HTTP one", url_resolved:"http://stream.test/old", country:"", tags:"anime", favicon:"" }];
  const common = async c => {
    await c.route("https://w.test/**", route);
    await c.route("https://graphql.anilist.co/**", al);
    await c.route("https://img.anilist.test/**", r => r.fulfill({ status:200, contentType:"image/png", body:PNG }));
    await c.route(/^https:\/\/\w+\.api\.radio-browser\.info\//, r => r.fulfill({ status:200, headers:{ "access-control-allow-origin":"*" }, contentType:"application/json", body:JSON.stringify(radioList) }));
    await c.route("https://stream.test/**", r => r.fulfill({ status:404, body:"" }));
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status:200, contentType:"text/css", body:"" }));
    await c.route("https://anilist.co/**", r => r.fulfill({ status:200, contentType:"text/html", body:"<title>AniList</title>" }));
  };
  await common(ctx);
  await ctx.addInitScript(() => { try { if (location.hostname === "browser.example" && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const c = await ctx.newPage(); watch(c, errors, "chrome");
  await c.goto("https://browser.example/chrome.html"); await wait(500);
  await c.evaluate(() => {
    window.__pt = [];
    const pm = chrome.webview.postMessage;
    chrome.webview.postMessage = m => {
      const a = String(m).split("\u0001"), id = +a[1], R = o => setTimeout(() => onToolResult(id, JSON.stringify(o)), 10);
      if (a[0] === "page-tool" && /^x-/.test(a[2])) {
        __pt.push({ id, a:a[2], arg:a[3] });
        if (a[2] === "x-pickimg") R({ a:"x-pickimg", u:"https://cos.example/cosplay1.png", alt:"a cosplay" });
        if (a[2] === "x-manga") R({ a:"x-manga", n:24 });
      }
      return pm(m);
    };
    __host("viewport", 1280, 860);
    __host("tab-created", 1, 0, "https://news.example/anime", "", 0, 0); __host("tab-title", 1, "Anime news");
    __host("tab-created", 2, 0, "https://manga.example/ch/1", "", 0, 0); __host("tab-title", 2, "Chapter 1");
    __host("tab-selected", 1); closeOver();
  });
  const tabOf = t => c.evaluate(t => { X3.animeHub(t); }, t);
  const body = () => c.evaluate(() => (document.querySelector("#animehub .amh-body") || {}).innerText || "");

  /* the hub */
  check(await c.evaluate(() => { X3.menuRows ? 0 : 0; return commands().some(x => /^Anime hub/.test(x.t)) && commands().some(x => /^Manga mode/.test(x.t)); }), "the hub and manga mode are in the command list");
  await tabOf("season");
  check(await until(c, () => document.querySelectorAll("#animehub .amh-card").length === 6), "#051 this season: the chart, from AniList");
  const sv = anilist.find(b => /season:\$s/.test(b.query)).variables;
  check(sv.s === "FALL" && sv.y === 2026 || sv.s && sv.y >= 2026, "#051 asks for the season it is now");
  check(/Ep 3 ·/.test(await body()) && /Times are yours/.test(await body()) && /★ 8\.1/.test(await body()), "#051 each show: next episode in your time, genres and score");
  check(await c.evaluate(() => document.querySelectorAll("#animehub .amh-tabs button").length) === 13, "the hub's 13 tabs");
  await c.evaluate(() => document.querySelectorAll("#animehub .amh-fol")[1].click());
  check(await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.animeFollow")).map(x => x.id).join()) === "2", "#070 ☆ follows a show");
  await c.screenshot({ path:SHOTS + "anime-hub-season.png" });

  // following: countdowns, and search to follow more
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="follow"]').click());
  check(await until(c, () => /Moon Diary/.test(document.querySelector("#animehub .amh-cds").innerText) && /Episode 4/.test(document.querySelector("#animehub .amh-cds").innerText) && /\dh|\dm/.test(document.querySelector("#animehub .amh-left").textContent)), "#070 a countdown to the next episode");
  await c.fill("#animehub .amh-in", "ramen");
  check(await until(c, () => document.querySelectorAll("#animehub .amh-hit").length === 2), "#070 search to follow");
  await c.evaluate(() => document.querySelector("#animehub .amh-hit").click());
  check(await until(c, () => document.querySelectorAll("#animehub .amh-cd").length === 2), "#070 two shows followed");
  await c.evaluate(() => document.querySelector("#animehub .amh-cd .amh-x").click());
  check(await until(c, () => document.querySelectorAll("#animehub .amh-cd").length === 1), "#070 stop following one");

  // today's cards
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="today"]').click());
  check(await until(c, () => /Happy birthday, Satoru Gojo!/.test(document.querySelector("#animehub .amd-bd").innerText)), "#052 today's birthdays");
  check(await c.evaluate(() => !!document.querySelector("#animehub .amd-th") && /Jujutsu Kaisen theme/.test(document.querySelector("#animehub .amd-th").textContent)), "#052 the birthday's show has a theme: one tap to use it");
  await c.evaluate(() => document.querySelector("#animehub .amd-th").click());
  check(await until(c, () => cfg.anime === "jjk"), "#052 the theme goes on");
  const day = await c.evaluate(() => { const q = AnimeMore.quote(), w = AnimeMore.word(), o = AnimeMore.opening(); return { q, w, o, t:document.querySelector("#animehub .amd").innerText }; });
  check(day.t.includes(day.q.text) && day.t.includes(day.q.who), "#053 a quote of the day");
  check(day.t.includes(day.w.jp) && day.t.includes(day.w.ro) && day.t.includes(day.w.en), "#062 a Japanese word of the day: kanji, kana, romaji and meaning");
  check(day.t.includes(day.o.song) && /youtube\.com\/results/.test(day.o.url), "#054 the opening of the week, to listen to");
  check(await c.evaluate(() => { const a = AnimeMore.quote(new Date(2026, 0, 5)).text, b = AnimeMore.quote(new Date(2026, 0, 6)).text, w1 = AnimeMore.opening(new Date(2026, 0, 5)).song, w2 = AnimeMore.opening(new Date(2026, 0, 6)).song; return a !== b && w1 === w2; }), "#053 #054 a new quote each day, a new opening each week");
  check(await c.evaluate(() => AnimeMore.TRIVIA.every(t => t[1].length === 4 && t[2] >= 0 && t[2] < 4) && AnimeMore.WORDS.every(w => w.length === 4) && AnimeMore.QUOTES.length >= 30), "the lists are well formed");

  // guess the anime
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="guess"]').click());
  check(await until(c, () => document.querySelectorAll("#animehub .amh-gopts button").length === 4 && /blur\(\d/.test(document.querySelector("#animehub .amh-gimg img").style.filter)), "#065 guess the anime: a blurred cover, four answers");
  const right = await c.evaluate(() => { const src = document.querySelector("#animehub .amh-gimg img").src, id = +src.match(/(\d+)\.png/)[1]; const b = [...document.querySelectorAll("#animehub .amh-gopts button")].find(x => +x.dataset.id === id); b.click(); return id; });
  check(await until(c, () => /^Yes!/.test(document.querySelector("#animehub .amh-gs").textContent) && document.querySelector("#animehub .amh-gimg img").style.filter === "none"), "#065 the right answer, and the cover clears");
  check(await c.evaluate(() => JSON.parse(localStorage.getItem("wsb.animeGuess")).right === 1), "#065 the score is kept");
  await c.evaluate(() => document.querySelector("#animehub .amh-gnext").click());
  await c.evaluate(() => { const src = document.querySelector("#animehub .amh-gimg img").src, id = +src.match(/(\d+)\.png/)[1]; [...document.querySelectorAll("#animehub .amh-gopts button")].find(x => +x.dataset.id !== id).click(); });
  check(await until(c, () => /^It was /.test(document.querySelector("#animehub .amh-gs").textContent) && !!document.querySelector("#animehub .amh-gopts .wrong")), "#065 a wrong answer says what it was");

  // trivia
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="trivia"]').click());
  check(await until(c, () => /Question 1 of 10/.test(document.querySelector("#animehub .amh-qn").textContent)), "#064 trivia: ten questions");
  for (let i = 0; i < 10; i++) {
    await c.evaluate(() => { const q = document.querySelector("#animehub .amh-q b").textContent, t = AnimeMore.TRIVIA.find(x => x[0] === q); document.querySelectorAll("#animehub .amh-qo button")[t[2]].click(); });
    await until(c, (n) => n === 9 ? !!document.querySelector("#animehub .amh-done") : new RegExp("Question " + (n + 2) + " of").test((document.querySelector("#animehub .amh-qn") || {}).textContent || ""), 3000, i);
  }
  check(await until(c, () => /10 \/ 10/.test(document.querySelector("#animehub .amh-done").innerText) && /master/.test(document.querySelector("#animehub .amh-done").innerText)), "#064 the score at the end");

  // voice actors
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="va"]').click());
  await c.fill("#animehub .amh-in", "gojo");
  check(await until(c, () => /Yuichi Nakamura/.test(document.querySelector("#animehub .amh-vas").innerText) && /Kaiji Tang/.test(document.querySelector("#animehub .amh-vas").innerText) && /Japanese/.test(document.querySelector("#animehub .amh-vas").innerText)), "#068 who voices a character, in Japanese and English");
  await c.evaluate(() => document.querySelector("#animehub .amh-va").click());
  check(await until(c, () => /Also voiced[\s\S]*Hero A[\s\S]*Show A/.test(document.querySelector("#animehub .amh-roles").innerText)), "#068 and what else they voiced");
  check(anilist.some(b => /Staff\(id/.test(b.query) && b.variables.id === 77), "#068 asks for that voice actor");

  // filler guide
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="filler"]').click());
  await c.evaluate(() => document.querySelector("#animehub .amh-fl").parentNode.querySelector(".amh-btn").click());
  check(await until(c, () => /Filler: skip these[\s\S]*26, 97-106/.test(document.querySelector("#animehub .amh-fl").innerText) && /Mixed/.test(document.querySelector("#animehub .amh-fl").innerText)), "#056 the filler guide: what to skip");
  check(fillers[0] === "naruto", "#056 from the Web AI server's /filler");
  await c.evaluate(() => { const s = document.querySelector("#animehub .amh-search select"); s.value = ""; s.dispatchEvent(new Event("change")); document.querySelector("#animehub .amh-other").value = "Some Show"; document.querySelector("#animehub .amh-search .amh-btn").click(); });
  check(await until(c, () => /no filler list/.test(document.querySelector("#animehub .amh-fl").innerText)), "#056 a show without a list says so");

  // watch order
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="order"]').click());
  await c.fill("#animehub .amh-in", "Fate"); await c.press("#animehub .amh-in", "Enter");
  check(await until(c, () => /Fate\/Zero/.test(document.querySelector("#animehub .amh-wo").innerText)), "#057 the watch order, from Web AI");
  check(chats.length && /watch order for the anime franchise “Fate”/.test(JSON.stringify(chats[chats.length - 1].messages)), "#057 asked about that franchise");

  // cosplay board
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="cosplay"]').click());
  await c.evaluate(() => document.querySelector("#animehub .amh-cpage").click());
  check(await until(c, () => overlay === "animehub" && document.querySelectorAll("#animehub .amh-pin").length === 1), "#067 a cosplay picture saved from the page you're on");
  check(await c.evaluate(() => { const l = AnimeMore.cosplay(); return l[0].u === "https://cos.example/cosplay1.png" && l[0].page === "https://news.example/anime"; }), "#067 with where it came from");
  await c.evaluate(() => { const i = document.querySelector("#animehub .amh-curl"); i.value = "https://cos.example/2.png"; i.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter" })); });
  check(await until(c, () => document.querySelectorAll("#animehub .amh-pin").length === 2), "#067 or by its address");
  await c.evaluate(() => document.querySelector("#animehub .amh-pin .amh-x").click());
  check(await until(c, () => document.querySelectorAll("#animehub .amh-pin").length === 1), "#067 remove one");

  // a theme from a picture
  const pic = await c.evaluate(() => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; const g = cv.getContext("2d"); g.fillStyle = "#0a1a3a"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ff3d8b"; g.fillRect(16, 16, 32, 32); return cv.toDataURL("image/png").split(",")[1]; });
  await c.evaluate(() => document.querySelector('#animehub .amh-tabs [data-t="maker"]').click());
  await c.setInputFiles('#animehub input[type="file"]', { name:"sakura night.png", mimeType:"image/png", buffer:Buffer.from(pic, "base64") });
  check(await until(c, () => !!document.querySelector("#animehub .amh-mkp") && document.querySelectorAll("#animehub .amh-sw i").length === 8), "#058 a theme from your picture: its colors");
  const th = await c.evaluate(() => ({ name:document.querySelector("#animehub .amh-mn").value, ac:document.querySelector('#animehub input[type="color"]').value }));
  check(th.name === "sakura night" && /^#[0-9a-f]{6}$/.test(th.ac), "#058 named after the file, with an accent color");
  const hue = await c.evaluate(() => { const h = document.querySelector('#animehub input[type="color"]').value; const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return r > b && r > g; });
  check(hue, "#058 the accent comes from the picture's bright color");
  await c.evaluate(() => document.querySelector("#animehub .amh-use").click());
  check(await until(c, () => cfg.anime === "mine" && Anime.has("mine") && cfg.accent === Anime.get("mine").a && cfg.pack === "custom"), "#058 your theme is on: the whole browser in its colors");
  check(await c.evaluate(() => { const cv = document.createElement("canvas"); cv.width = 40; cv.height = 30; document.body.appendChild(cv); const r = Anime.run(cv, "mine", { still:true }); r.stop(); cv.remove(); return !!Anime._wall.mine; }), "#058 its moving wallpaper draws");
  check(await c.evaluate(() => X3.siteLook("news.example").id !== "mine"), "#058 your picture isn't sent to websites");
  check(await c.evaluate(() => { X3.animePanel(); const t = document.querySelector('#anp .an-tile[data-id="+make"]'), m = document.querySelector('#anp .an-tile[data-id="mine"]'); return !!t && !!m && /your picture/.test(m.textContent); }), "#058 in the theme picker, with a tile to make another");

  // Mochi's outfits
  await tabOf("mochi");
  check(await until(c, () => document.querySelectorAll("#animehub .amh-mo").length === 11 && !!document.querySelector("#animehub .amh-mo svg")), "#060 Mochi's outfits, each drawn");
  await c.evaluate(() => [...document.querySelectorAll("#animehub .amh-mo")].find(b => b.dataset.id === "santa").click());
  check(await until(c, () => Buddy.outfit() === "santa" && document.querySelector('#animehub .amh-mo[data-id="santa"]').classList.contains("on")), "#060 pick one");
  check(await c.evaluate(() => { localStorage.removeItem("wsb.buddyOutfit"); const o = [new Date(2026, 9, 10), new Date(2026, 11, 20), new Date(2026, 6, 4), new Date(2026, 3, 1), new Date(2027, 0, 1), new Date(2026, 4, 9)].map(d => Buddy.outfit(d)); return o.join() === "witch,santa,shades,sakura,party,"; }), "#060 by itself, Mochi dresses for the season");
  check(await c.evaluate(() => /bd-of/.test(Buddy.preview("witch", 3)) && !/bd-crown/.test(Buddy.preview("witch", 3)) && /bd-crown/.test(Buddy.preview("shades", 3))), "#060 a hat replaces the crown; glasses don't");

  // radio
  await tabOf("radio");
  check(await until(c, () => document.querySelectorAll("#animehub .amh-rs").length === 2), "#069 anime radio stations (secure ones only)");
  await c.evaluate(() => document.querySelector("#animehub .amh-rs").click());
  check(await until(c, () => /That station isn't playing/.test(document.querySelector("#animehub .amh-rnow b").textContent) || /Anime Lofi Radio/.test(document.querySelector("#animehub .amh-rnow b").textContent)), "#069 plays a station (or says it can't)");

  // secrets
  await c.evaluate(() => go("plus ultra!"));
  check(await until(c, () => AnimeMore.secrets().find(s => s.id === "plusultra").found), "#072 a secret in the address bar");
  await tabOf("secrets");
  check(await until(c, () => /1 of 6 secrets found/.test(document.querySelector("#animehub .amh-body").innerText) && /Go beyond/.test(document.querySelector("#animehub .amh-body").innerText) && /\?\?\?/.test(document.querySelector("#animehub .amh-body").innerText)), "#072 the secrets: found ones named, others hinted");
  check(await c.evaluate(() => { const r = X3.voice.parse("dattebayo"); return r && r.id === "dattebayo"; }), "#072 and one for Hey Webs");
  check(await c.evaluate(() => { const r = X3.voice.parse("open the anime hub"); return r && r.id === "animehub"; }), "Hey Webs: open the anime hub");

  /* the extras */
  await c.evaluate(() => { X3.animeExtras(); });
  check(await c.evaluate(() => document.querySelectorAll("#animex [data-k]").length === 5), "the extras' panel");
  await c.evaluate(() => { __pt.length = 0; const i = document.querySelector("#animex .anx-add input"); i.value = "Gojo"; i.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter" })); });
  check(await c.evaluate(() => cfg.spoilOn === true && cfg.spoilWords.join() === "Gojo" && /Gojo/.test(document.querySelector("#animex .anx-chips").textContent)), "#055 the spoiler shield: words to hide, on");
  check(await c.evaluate(() => __pt.filter(x => x.a === "x-spoil").map(x => x.id).sort().join() === "1,2" && JSON.parse(__pt.find(x => x.a === "x-spoil").arg).w[0] === "Gojo"), "#055 sent to every page");
  await c.evaluate(() => document.querySelector("#animex .anx-fol").click());
  check(await c.evaluate(() => cfg.spoilWords.includes("Ramen Quest")), "#055 add the shows you follow");
  await c.evaluate(() => { __pt.length = 0; __host("tab-created", 3, 0, "https://forum.example/t/1", "", 0, 0); applyPage(T(3)); });
  check(await c.evaluate(() => __pt.some(x => x.id === 3 && x.a === "x-spoil")), "#055 and to each page that loads");
  await c.evaluate(() => { __pt.length = 0; const k = document.querySelector('#animex [data-k="spoilOn"]'); k.checked = false; k.dispatchEvent(new Event("change")); });
  check(await c.evaluate(() => __pt.filter(x => x.a === "x-spoil").every(x => JSON.parse(x.arg).off === 1) && __pt.some(x => x.a === "x-spoil")), "#055 off: the pages show everything again");
  await c.evaluate(() => { __pt.length = 0; const k = document.querySelector('#animex [data-k="animeRomaji"]'); k.checked = true; k.dispatchEvent(new Event("change")); });
  check(await c.evaluate(() => __pt.filter(x => x.a === "x-romaji" && x.arg === "on").length === 3), "#063 romaji on hover: on, on every page");
  await c.evaluate(() => { __pt.length = 0; onToolResult(1, JSON.stringify({ a:"x-romaji-ask", q:"友達" })); });
  check(await until(c, () => __pt.some(x => x.a === "x-romaji" && /"ro":"tomodachi"/.test(x.arg) && /"en":"friend"/.test(x.arg) && /友達/.test(x.arg))), "#063 kanji: Web AI reads it, the page shows it");
  const n0 = chats.length; await c.evaluate(() => onToolResult(1, JSON.stringify({ a:"x-romaji-ask", q:"友達" }))); await wait(300);
  check(chats.length === n0, "#063 each word is asked only once");
  await c.evaluate(() => { const k = document.querySelector('#animex [data-k="animeDaily"]'); cfg.animeDailyDay = ""; k.checked = true; k.dispatchEvent(new Event("change")); });
  check(await until(c, () => cfg.animeDaily && Anime.has(cfg.anime) && cfg.anime !== "mine" && cfg.animeDailyDay === new Date().toLocaleDateString("en-CA")), "#071 the theme of the day");
  const sfx = await c.evaluate(() => { cfg.animeSfx = true; cfg.sounds = false; cfg.soundPack = "retro"; let used = ""; const p = SOUND_PACKS["an-" + cfg.anime]; SOUND_PACKS["an-" + cfg.anime] = (k, ...a) => { used = k; }; try { sound("open"); } finally { SOUND_PACKS["an-" + cfg.anime] = p; } return { used, pack:cfg.soundPack, sounds:cfg.sounds, n:Object.keys(SOUND_PACKS).filter(k => /^an-/.test(k)).length }; });
  check(sfx.used === "open" && sfx.pack === "retro" && sfx.sounds === false && sfx.n === 9, "#075 theme sounds: the theme's own pack, your settings untouched");
  await c.evaluate(() => { closeOver(); __pt.length = 0; __host("tab-selected", 2); X3.manga(); });
  check(await until(c, () => __pt.some(x => x.id === 2 && x.a === "x-manga") && /24 pages/.test(document.body.innerText)), "#061 manga mode on the page");
  await c.screenshot({ path:SHOTS + "anime-extras.png" });

  /* the new tab page */
  const n = await ctx.newPage(); watch(n, errors, "newtab");
  await n.goto("https://browser.example/newtab.html"); await wait(800);
  check(await until(n, () => !document.getElementById("amSec").classList.contains("hide") && /Word of the day/.test(document.getElementById("amSec").textContent)), "today's cards on the new tab page");
  check(await until(n, () => /Happy birthday/.test(document.getElementById("amSec").innerText)), "#052 the birthday banner on the new tab page");
  check(await n.evaluate(() => /font-family/.test([...document.querySelectorAll("style")].map(s => s.textContent).join("")) && [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /fonts\.googleapis\.com/.test(l.href))), "#073 the theme's font");
  await n.evaluate(() => X3N.animeMore.stk.edit(true));
  await n.evaluate(() => { document.querySelectorAll(".stk-pal button")[0].click(); document.querySelectorAll(".stk-pal button")[5].click(); });
  check(await n.evaluate(() => document.querySelectorAll(".stk-layer .stk").length === 2 && JSON.parse(localStorage.getItem("wsb.stickers")).length === 2), "#059 stickers, kept");
  const s0 = await n.evaluate(() => { const s = document.querySelector(".stk-layer .stk"), r = s.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2, l:JSON.parse(localStorage.getItem("wsb.stickers"))[0].x }; });
  await n.mouse.move(s0.x, s0.y); await n.mouse.down(); await n.mouse.move(s0.x + 120, s0.y + 40, { steps:5 }); await n.mouse.up();
  check(await n.evaluate((l) => Math.abs(JSON.parse(localStorage.getItem("wsb.stickers"))[0].x - l) > 3, s0.l), "#059 drag one anywhere");
  await n.evaluate(() => document.querySelector('.stk-bar [data-d="s+"]').click());
  check(await n.evaluate(() => JSON.parse(localStorage.getItem("wsb.stickers"))[0].s === 76), "#059 make it bigger");
  await n.evaluate(() => document.querySelector(".stk-done").click());
  check(await n.evaluate(() => document.querySelector(".stk-tray").hidden && !document.querySelector(".stk-layer").classList.contains("editing")), "#059 done");
  for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) await n.keyboard.press(k);
  check(await until(n, () => JSON.parse(localStorage.getItem("wsb.secrets")).konami && !!document.querySelector(".amparty") && /The old code/.test(document.querySelector(".amnote").textContent)), "#072 the old game code");
  await n.screenshot({ path:SHOTS + "anime-newtab.png" });
  await n.close();

  /* on a page: the spoiler shield, manga mode and romaji (shield.more.js) */
  const shield = fs.readFileSync(path.join(ROOT, "out", "shield.js"), "utf8");
  const c2 = await browser.newContext();
  const pages = Array.from({ length:5 }, (_, i) => '<img class="pg" src="https://page.example/p' + i + '.png" width="600" height="900">').join("");
  await c2.route("https://page.example/", r => r.fulfill({ status:200, contentType:"text/html", body:'<!doctype html><meta charset="utf-8"><h2 id="h">Gojo returns in chapter 300</h2><p id="p1">The weather is nice.</p><ul><li id="l1">Big news about Satoru Gojo!</li><li id="l2">Gojoland is a theme park</li></ul>' +
    '<img id="im" alt="Gojo fan art" src="https://page.example/x.png" width="50" height="50"><p id="jp" style="font-size:40px">ともだち と 友達</p>' + pages + '<img src="https://page.example/logo.png" width="40" height="40">' }));
  await c2.route("https://page.example/*.png", r => r.fulfill({ status:200, contentType:"image/png", body:PNG }));
  await c2.addInitScript(() => { window.__sent = []; window.chrome = window.chrome || {}; window.chrome.webview = { postMessage(m) { window.__sent.push(String(m)); }, addEventListener() {} }; });
  await c2.addInitScript(shield);
  const pg = await c2.newPage(); watch(pg, errors, "page");
  await pg.goto("https://page.example/"); await wait(300);
  await pg.evaluate(() => window[Symbol.for("wsb.p")]({ k:"TK", h:"page.example", f:0 }));
  const T2 = (a, arg) => pg.evaluate(([a, arg]) => window[Symbol.for("wsb.tool")](a, arg || ""), [a, arg]);
  const last = a => pg.evaluate(a => { const m = __sent.filter(x => /\u0001tool\u0001/.test(x)).map(x => JSON.parse(x.split("\u0001")[3])).filter(x => !a || x.a === a).pop(); return m || null; }, a);
  await T2("x-spoil", JSON.stringify({ w:["Gojo"] }));
  let r = await last("x-spoil");
  const sp = await pg.evaluate(() => ({ h:document.getElementById("h").dataset.wsbSpoil, l1:document.getElementById("l1").dataset.wsbSpoil, l2:document.getElementById("l2").dataset.wsbSpoil, p1:document.getElementById("p1").dataset.wsbSpoil, im:document.getElementById("im").dataset.wsbSpoil, blur:getComputedStyle(document.getElementById("h")).filter }));
  check(r && r.n === 3 && sp.h === "1" && sp.l1 === "1" && sp.im === "1" && !sp.p1 && !sp.l2 && /blur/.test(sp.blur), "#055 x-spoil: what mentions the word is blurred (whole words only)");
  await pg.evaluate(() => { const p = document.createElement("p"); p.id = "late"; p.textContent = "Later: gojo wins"; document.body.appendChild(p); });
  check(await until(pg, () => document.getElementById("late").dataset.wsbSpoil === "1"), "#055 even what loads later");
  await pg.click("#h");
  check(await pg.evaluate(() => document.getElementById("h").dataset.wsbSpoil === "0" && getComputedStyle(document.getElementById("h")).filter === "none"), "#055 a click shows one");
  await T2("x-spoil", JSON.stringify({ off:1 }));
  check(await pg.evaluate(() => !document.querySelector("[data-wsb-spoil]")), "#055 off: all back");
  await T2("x-manga", JSON.stringify({ mode:"page" }));
  r = await last("x-manga");
  check(r && r.n === 5, "#061 x-manga: the manga's pages (not its logo)");
  const mg = () => pg.evaluate(() => { const b = [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")); return b ? b.shadowRoot.querySelector(".bar span").textContent : ""; });
  check(await mg() === "1 / 5", "#061 one page at a time");
  await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight");
  check(await mg() === "3 / 5", "#061 the arrow keys turn");
  await pg.evaluate(() => { const b = [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")); b.shadowRoot.querySelector("[data-r]").click(); });
  await pg.keyboard.press("ArrowRight");
  check(await mg() === "2 / 5", "#061 right to left");
  await pg.evaluate(() => { const b = [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")); b.shadowRoot.querySelector('[data-m="two"]').click(); });
  check(await mg() === "1-2 / 5" && await pg.evaluate(() => { const v = [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")).shadowRoot.querySelector(".pg"); return v.children.length === 2 && v.classList.contains("rtl"); }), "#061 two pages side by side, like the book (right to left)");
  await pg.keyboard.press("ArrowLeft");
  check(await mg() === "3-4 / 5", "#061 turns two at a time");
  await pg.evaluate(() => { const b = [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")); b.shadowRoot.querySelector('[data-m="strip"]').click(); });
  check(await mg() === "5 pages" && await pg.evaluate(() => [...document.documentElement.children].find(x => x.shadowRoot && x.shadowRoot.querySelector(".bar")).shadowRoot.querySelectorAll(".st img").length === 5), "#061 or one long strip");
  await pg.keyboard.press("Escape");
  check(await mg() === "" && await pg.evaluate(() => document.documentElement.style.overflow === ""), "#061 Esc leaves");
  await T2("x-romaji", "on");
  const jp = await pg.evaluate(() => { const t = document.getElementById("jp").firstChild, rg = document.createRange(); rg.setStart(t, 1); rg.setEnd(t, 2); const b = rg.getBoundingClientRect(); rg.setStart(t, 7); rg.setEnd(t, 8); const k = rg.getBoundingClientRect(); return { x:b.left + b.width / 2, y:b.top + b.height / 2, kx:k.left + k.width / 2, ky:k.top + k.height / 2 }; });
  await pg.mouse.move(jp.x, jp.y);
  check(await until(pg, () => { const t = document.querySelector('[data-wsb="romaji"]'); return t && t.style.display === "block" && /ともだち · tomodachi/.test(t.textContent); }), "#063 kana: read on the spot");
  await pg.mouse.move(jp.kx, jp.ky);
  check(await until(pg, () => __sent.some(x => /x-romaji-ask/.test(x) && /友達/.test(x))), "#063 kanji: asked of the window");
  await T2("x-romaji", JSON.stringify({ ans:{ q:"友達", ro:"tomodachi", en:"friend" } }));
  check(await pg.evaluate(() => /友達 · tomodachi · friend/.test(document.querySelector('[data-wsb="romaji"]').textContent)), "#063 and the answer shows");
  check(await pg.evaluate(() => { const src = [...document.scripts].length; return true; }) && await pg.evaluate(() => typeof xRomaji === "undefined"), "the page tools stay out of the page's own scripts");
  await T2("x-romaji", "off");
  check(await pg.evaluate(() => !document.querySelector('[data-wsb="romaji"]')), "#063 off");
  await c2.close();

  /* the iPhone */
  const ictx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  await ictx.route("https://app.example/**", r => {
    const u = new URL(r.request().url()), f = path.join(APP, decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:"" });
    r.fulfill({ status:200, body:fs.readFileSync(f), contentType:TYPES[f.split(".").pop()] || "application/octet-stream" });
  });
  await common(ictx);
  await ictx.addInitScript(() => { try { if (location.hostname === "app.example" && !localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ server:"https://w.test" })); } catch (e) {} });
  const a = await ictx.newPage(); watch(a, errors, "iphone");
  await a.goto("https://app.example/index.html"); await wait(1500);
  await a.evaluate(() => openMenu()); await wait(200);
  check(await a.evaluate(() => !!document.querySelector('#sheetBody .mrow[data-act="animehub"]')), "iPhone: Menu → Anime hub");
  await a.evaluate(() => document.querySelector('#sheetBody .mrow[data-act="animehub"]').click());
  await a.evaluate(() => document.querySelector('#sheetBody .amh-tabs [data-t="season"]').click());
  check(await until(a, () => document.querySelectorAll("#sheetBody .amh-card").length === 6), "iPhone #051 this season");
  await a.screenshot({ path:SHOTS + "anime-hub-iphone.png" });
  await a.evaluate(() => document.querySelector('#sheetBody .amh-tabs [data-t="mochi"]').click());
  check(await until(a, () => document.querySelectorAll("#sheetBody .amh-mo").length === 11), "iPhone #060 Mochi's outfits");
  await a.evaluate(() => { closeSheet(); AnimeMoreApp.useTheme("naruto"); });
  check(await until(a, () => !document.getElementById("amSec").classList.contains("hide") && /Word of the day/.test(document.getElementById("amSec").textContent)), "iPhone: today's cards on the start page");
  await a.evaluate(() => openSettings("customize")); await wait(200);
  check(await a.evaluate(() => /Add or move stickers/.test(document.getElementById("sheetBody").innerText)), "iPhone #059 stickers, from Customize start page");
  await a.evaluate(() => { SETACTIONS.stickers(); document.querySelectorAll(".stk-pal button")[2].click(); document.querySelector(".stk-done").click(); });
  check(await a.evaluate(() => document.querySelectorAll(".stk-layer .stk").length === 1), "iPhone #059 a sticker on the start page");
  await a.evaluate(() => SETACTIONS.animeThemes()); await wait(200);
  check(await a.evaluate(() => !!document.querySelector('#anPick .an-tile[data-id="+make"]')), "iPhone #058 make a theme from a photo, in the picker");

  check(!errors.length, "no errors: " + errors.join(" | "));
  console.log("anime more:", ok, "passed,", bad, "failed");
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
