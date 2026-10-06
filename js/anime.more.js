/* Webs Browser - more for anime fans (Windows 3.14, iPhone 2.11; ideas #051-#075), shared by both apps.
   Live facts come from AniList's public API (graphql.anilist.co: no account, no key); quotes, openings, words and
   trivia are lists kept here. Nothing about you leaves this device except the searches you type.
   AnimeMore.hub(el, app)       the Anime hub: this season, following, today, guess the anime, trivia, voice actors,
                                filler guide, watch order, cosplay board, secrets. app: { open(url), server() (the Web AI
                                server, for the filler guide), ai (Web AI is connected), addFromPage() (PC: pick a picture) }
   AnimeMore.daily(el, app)     today's cards: birthdays, a quote, a Japanese word, the opening of the week, countdowns
   AnimeMore.stickers(el, opt)  a sticker layer: drag them anywhere; opt.edit(on) to show the sticker tray
   AnimeMore.secret(id)         a secret found (#072); AnimeMore.secrets() -> [{ id, name, hint, found }]
   AnimeMore.makeTheme(file)    a theme from a picture (#058): { a, c, img } (the wallpaper itself is in js/anime.js, "mine") */
(function () {
"use strict";
if (window.AnimeMore) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const dayN = (d) => Math.floor(((d || new Date()) - new Date((d || new Date()).getFullYear(), 0, 0)) / 864e5);
const weekN = d => { d = d || new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
const title = m => m && m.title ? m.title.english || m.title.romaji || "" : "";

/* ---------------------------------------------------------------- AniList */
const AL_URL = "https://graphql.anilist.co", mem = new Map();
async function AL(query, variables, ttl) {
  const k = query + JSON.stringify(variables || {}), hit = mem.get(k);
  if (hit && Date.now() - hit.at < (ttl || 3600e3)) return hit.data;
  let r;
  try { r = await fetch(AL_URL, { method:"POST", headers:{ "content-type":"application/json", accept:"application/json" }, body:JSON.stringify({ query, variables:variables || {} }) }); }
  catch (e) { throw new Error("AniList couldn't be reached. Check your internet connection."); }
  if (r.status === 429) throw new Error("AniList is busy. Try again in a minute.");
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.data) throw new Error("AniList didn't answer. Try again later.");
  mem.set(k, { at:Date.now(), data:j.data });
  return j.data;
}
function season(d) {
  d = d || new Date(); const m = d.getMonth();
  return { s:m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL", y:d.getFullYear(), name:(m < 3 ? "Winter" : m < 6 ? "Spring" : m < 9 ? "Summer" : "Fall") + " " + d.getFullYear() };
}
const MEDIA = "id title{romaji english} coverImage{large medium color} nextAiringEpisode{airingAt episode} episodes genres averageScore siteUrl status startDate{year month day}";
async function chart(d) {
  const s = season(d);
  const r = await AL("query($s:MediaSeason,$y:Int){Page(perPage:40){media(season:$s,seasonYear:$y,type:ANIME,isAdult:false,sort:POPULARITY_DESC,format_in:[TV,TV_SHORT,ONA]){" + MEDIA + "}}}", { s:s.s, y:s.y });
  return { season:s.name, list:(r.Page && r.Page.media || []).map(m => ({ id:m.id, t:title(m), img:m.coverImage && (m.coverImage.large || m.coverImage.medium) || "", color:m.coverImage && m.coverImage.color || "",
    next:m.nextAiringEpisode ? { at:m.nextAiringEpisode.airingAt * 1000, ep:m.nextAiringEpisode.episode } : null, eps:m.episodes || 0, genres:(m.genres || []).slice(0, 3), score:m.averageScore || 0, url:m.siteUrl || "" })) };
}
const when = ms => { const d = new Date(ms), days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  return (days === 0 ? "Today" : days === 1 ? "Tomorrow" : days < 7 ? d.toLocaleDateString([], { weekday:"long" }) : d.toLocaleDateString([], { month:"short", day:"numeric" })) + " " + d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }); };
const left = ms => { const s = Math.max(0, Math.round((ms - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m"; };

/* ---------------------------------------------------------------- #070 following: countdowns to the next episode or season */
const follows = () => (get("animeFollow", []) || []).filter(x => x && x.id).slice(0, 30);
const isFollowed = id => follows().some(x => x.id === id);
function follow(m, on) { const l = follows().filter(x => x.id !== m.id); if (on) l.unshift({ id:m.id, t:m.t, img:m.img || "" }); put("animeFollow", l); }
async function countdowns() {
  const l = follows(); if (!l.length) return [];
  const r = await AL("query($ids:[Int]){Page(perPage:30){media(id_in:$ids){" + MEDIA + "}}}", { ids:l.map(x => x.id) }, 600e3);
  return (r.Page && r.Page.media || []).map(m => {
    const sd = m.startDate || {}, start = sd.year && sd.month && sd.day ? +new Date(sd.year, sd.month - 1, sd.day) : 0;
    return { id:m.id, t:title(m), img:m.coverImage && m.coverImage.medium || "", url:m.siteUrl || "", status:m.status,
      at:m.nextAiringEpisode ? m.nextAiringEpisode.airingAt * 1000 : m.status === "NOT_YET_RELEASED" && start > Date.now() ? start : 0, ep:m.nextAiringEpisode ? m.nextAiringEpisode.episode : 0, premiere:m.status === "NOT_YET_RELEASED" };
  }).sort((a, b) => (a.at || 9e15) - (b.at || 9e15));
}
async function search(q) {
  const r = await AL("query($q:String){Page(perPage:8){media(search:$q,type:ANIME,isAdult:false,sort:POPULARITY_DESC){" + MEDIA + "}}}", { q });
  return (r.Page && r.Page.media || []).map(m => ({ id:m.id, t:title(m), img:m.coverImage && m.coverImage.medium || "", status:m.status, url:m.siteUrl || "" }));
}

/* ---------------------------------------------------------------- #052 birthdays (and the theme that goes with the show) */
const THEME_OF = [[/bleach/i, "bleach"], [/tokyo ghoul/i, "ghoul"], [/kimetsu|demon slayer/i, "slayer"], [/jujutsu/i, "jjk"], [/naruto|boruto/i, "naruto"], [/shingeki|attack on titan/i, "aot"], [/one piece/i, "onepiece"], [/death note/i, "deathnote"], [/persona 5/i, "p5"]];
async function birthdays() {
  const r = await AL("query{Page(perPage:6){characters(isBirthday:true,sort:FAVOURITES_DESC){id name{full} image{medium} siteUrl media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}}}}}", {}, 6 * 3600e3);
  return (r.Page && r.Page.characters || []).map(c => { const show = c.media && c.media.nodes && c.media.nodes[0] ? title(c.media.nodes[0]) : ""; const th = THEME_OF.find(x => x[0].test(show));
    return { name:c.name && c.name.full || "", img:c.image && c.image.medium || "", url:c.siteUrl || "", show, theme:th ? th[1] : "" }; });
}

/* ---------------------------------------------------------------- #068 voice actors */
async function voiceActors(q) {
  const r = await AL("query($q:String){Page(perPage:4){characters(search:$q,sort:FAVOURITES_DESC){id name{full} image{medium} siteUrl media(perPage:1,sort:POPULARITY_DESC){edges{node{title{romaji english}} ja:voiceActors(language:JAPANESE){id name{full} image{medium} siteUrl} en:voiceActors(language:ENGLISH){id name{full} image{medium} siteUrl}}}}}}", { q });
  return (r.Page && r.Page.characters || []).map(c => { const e = c.media && c.media.edges && c.media.edges[0] || {}; const va = l => (l || []).slice(0, 1).map(v => ({ id:v.id, name:v.name && v.name.full || "", img:v.image && v.image.medium || "", url:v.siteUrl || "" }));
    return { name:c.name && c.name.full || "", img:c.image && c.image.medium || "", url:c.siteUrl || "", show:e.node ? title(e.node) : "", ja:va(e.ja), en:va(e.en) }; });
}
async function roles(id) {
  const r = await AL("query($id:Int){Staff(id:$id){characters(perPage:8,sort:FAVOURITES_DESC){nodes{name{full} media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}}}}}}", { id });
  return (r.Staff && r.Staff.characters && r.Staff.characters.nodes || []).map(c => ({ name:c.name && c.name.full || "", show:c.media && c.media.nodes && c.media.nodes[0] ? title(c.media.nodes[0]) : "" }));
}

/* ---------------------------------------------------------------- lists: quotes (#053), openings (#054), words (#062), trivia (#064) */
const QUOTES = [
  ["If you don't take risks, you can't create a future.", "Monkey D. Luffy", "One Piece"], ["A lesson without pain is meaningless.", "Edward Elric", "Fullmetal Alchemist: Brotherhood"],
  ["Set your heart ablaze.", "Kyojuro Rengoku", "Demon Slayer"], ["Throughout heaven and earth, I alone am the honored one.", "Satoru Gojo", "Jujutsu Kaisen"],
  ["If you win, you live. If you lose, you die. If you don't fight, you can't win!", "Eren Yeager", "Attack on Titan"], ["Hard work is worthless for those that don't believe in themselves.", "Naruto Uzumaki", "Naruto"],
  ["Whatever you lose, you'll find it again. But what you throw away you'll never get back.", "Kenshin Himura", "Rurouni Kenshin"], ["The world isn't perfect. But it's there for us, doing the best it can.", "Roy Mustang", "Fullmetal Alchemist"],
  ["Power comes in response to a need, not a desire.", "Goku", "Dragon Ball Z"], ["Fear is not evil. It tells you what your weakness is.", "Gildarts Clive", "Fairy Tail"],
  ["Being weak is nothing to be ashamed of. Staying weak is!", "Fuegoleon Vermillion", "Black Clover"], ["Plus Ultra!", "All Might", "My Hero Academia"],
  ["You should enjoy the little detours to the fullest. That's where you'll find the things more important than what you want.", "Ging Freecss", "Hunter x Hunter"],
  ["No matter how deep the night, it always turns to day, eventually.", "Brook", "One Piece"], ["You can die anytime, but living takes true courage.", "Kenshin Himura", "Rurouni Kenshin"],
  ["Whatever happens, happens.", "Spike Spiegel", "Cowboy Bebop"], ["Believe in the me that believes in you!", "Kamina", "Gurren Lagann"],
  ["Simplicity is the easiest path to true beauty.", "Seishuu Handa", "Barakamon"], ["If you don't like your destiny, don't accept it.", "Naruto Uzumaki", "Naruto"],
  ["The ticket to the future is always open.", "Vash the Stampede", "Trigun"], ["Giving up kills people.", "Alucard", "Hellsing"],
  ["It's more important to master the cards you're holding than to complain about the ones your opponent was dealt.", "Grimsley", "Pokémon"],
  ["People's lives don't end when they die. It ends when they lose faith.", "Itachi Uchiha", "Naruto Shippuden"], ["I'll take a potato chip… and eat it!", "Light Yagami", "Death Note"],
  ["The moment you think of giving up, think of the reason why you held on so long.", "Natsu Dragneel", "Fairy Tail"], ["Who the hell do you think I am?!", "Kamina", "Gurren Lagann"],
  ["Even if we forget the faces of our friends, we will never forget the bonds that were carved into our souls.", "Otose", "Gintama"], ["Those who stand at the top determine what's wrong and what's right!", "Donquixote Doflamingo", "One Piece"],
  ["If you can't find a reason to fight, then you shouldn't be fighting.", "Akame", "Akame ga Kill!"], ["We are all like fireworks: we climb, we shine and always go our separate ways and become further apart.", "Toshiro Hitsugaya", "Bleach"]
];
const OPENINGS = [
  ["Unravel", "TK from Ling Tosite Sigure", "Tokyo Ghoul"], ["Guren no Yumiya", "Linked Horizon", "Attack on Titan"], ["Gurenge", "LiSA", "Demon Slayer"], ["Kaikai Kitan", "Eve", "Jujutsu Kaisen"],
  ["Blue Bird", "Ikimono-gakari", "Naruto Shippuden"], ["We Are!", "Hiroshi Kitadani", "One Piece"], ["Again", "YUI", "Fullmetal Alchemist: Brotherhood"], ["The World", "Nightmare", "Death Note"],
  ["Tank!", "The Seatbelts", "Cowboy Bebop"], ["A Cruel Angel's Thesis", "Yoko Takahashi", "Neon Genesis Evangelion"], ["Peace Sign", "Kenshi Yonezu", "My Hero Academia"], ["Departure!", "Masatoshi Ono", "Hunter x Hunter"],
  ["Asterisk", "Orange Range", "Bleach"], ["Silhouette", "KANA-BOON", "Naruto Shippuden"], ["Cha-La Head-Cha-La", "Hironobu Kageyama", "Dragon Ball Z"], ["Colors", "FLOW", "Code Geass"],
  ["Crossing Field", "LiSA", "Sword Art Online"], ["Idol", "YOASOBI", "Oshi no Ko"], ["Mixed Nuts", "Official HIGE DANdism", "Spy x Family"], ["Kick Back", "Kenshi Yonezu", "Chainsaw Man"],
  ["Otonoke", "Creepy Nuts", "Dandadan"], ["Bling-Bang-Bang-Born", "Creepy Nuts", "Mashle"], ["Shinzou wo Sasageyo!", "Linked Horizon", "Attack on Titan"], ["Hacking to the Gate", "Kanako Itou", "Steins;Gate"],
  ["Haruka Kanata", "Asian Kung-Fu Generation", "Naruto"], ["Ao no Sumika", "Tatsuya Kitani", "Jujutsu Kaisen"], ["Specialz", "King Gnu", "Jujutsu Kaisen"], ["Zankyou Sanka", "Aimer", "Demon Slayer"],
  ["Bloody Stream", "Coda", "JoJo's Bizarre Adventure"], ["The Rumbling", "SiM", "Attack on Titan"], ["Ready Steady Go", "L'Arc~en~Ciel", "Fullmetal Alchemist"], ["Hikaru Nara", "Goose house", "Your Lie in April"],
  ["Sign", "FLOW", "Naruto Shippuden"], ["Inferno", "Mrs. GREEN APPLE", "Fire Force"], ["Great Days", "Karen Aoki & Daisuke Hasegawa", "JoJo's Bizarre Adventure"], ["Odd Future", "UVERworld", "My Hero Academia"]
];
const WORDS = [
  ["頑張って", "がんばって", "ganbatte", "Do your best! / Hang in there!"], ["ありがとう", "ありがとう", "arigatou", "Thank you"], ["大丈夫", "だいじょうぶ", "daijoubu", "It's okay; all right"],
  ["友達", "ともだち", "tomodachi", "Friend"], ["夢", "ゆめ", "yume", "Dream"], ["桜", "さくら", "sakura", "Cherry blossom"], ["猫", "ねこ", "neko", "Cat"], ["犬", "いぬ", "inu", "Dog"], ["空", "そら", "sora", "Sky"],
  ["海", "うみ", "umi", "Sea"], ["星", "ほし", "hoshi", "Star"], ["月", "つき", "tsuki", "Moon"], ["火", "ひ", "hi", "Fire"], ["水", "みず", "mizu", "Water"], ["心", "こころ", "kokoro", "Heart; mind"],
  ["力", "ちから", "chikara", "Power; strength"], ["仲間", "なかま", "nakama", "Comrades; friends you'd fight for"], ["先輩", "せんぱい", "senpai", "Someone senior to you at school or work"],
  ["先生", "せんせい", "sensei", "Teacher"], ["可愛い", "かわいい", "kawaii", "Cute"], ["美味しい", "おいしい", "oishii", "Delicious"], ["すごい", "すごい", "sugoi", "Amazing"],
  ["いただきます", "いただきます", "itadakimasu", "Said before eating: “I humbly receive”"], ["おはよう", "おはよう", "ohayou", "Good morning"], ["おやすみ", "おやすみ", "oyasumi", "Good night"],
  ["また明日", "またあした", "mata ashita", "See you tomorrow"], ["本当", "ほんとう", "hontou", "Really; true"], ["勇気", "ゆうき", "yuuki", "Courage"], ["約束", "やくそく", "yakusoku", "Promise"],
  ["運命", "うんめい", "unmei", "Fate; destiny"], ["侍", "さむらい", "samurai", "Samurai"], ["忍者", "にんじゃ", "ninja", "Ninja"], ["刀", "かたな", "katana", "Sword"], ["鬼", "おに", "oni", "Demon; ogre"],
  ["神", "かみ", "kami", "God; spirit"], ["魔法", "まほう", "mahou", "Magic"], ["勝つ", "かつ", "katsu", "To win"], ["諦めない", "あきらめない", "akiramenai", "I won't give up"],
  ["お腹すいた", "おなかすいた", "onaka suita", "I'm hungry"], ["よろしく", "よろしく", "yoroshiku", "Nice to meet you; please treat me well"], ["ごめんなさい", "ごめんなさい", "gomen nasai", "I'm sorry"],
  ["行ってきます", "いってきます", "ittekimasu", "I'm off (and I'll be back)"], ["ただいま", "ただいま", "tadaima", "I'm home"], ["おかえり", "おかえり", "okaeri", "Welcome home"],
  ["花火", "はなび", "hanabi", "Fireworks"], ["雨", "あめ", "ame", "Rain"], ["雪", "ゆき", "yuki", "Snow"], ["光", "ひかり", "hikari", "Light"], ["闇", "やみ", "yami", "Darkness"], ["未来", "みらい", "mirai", "Future"]
];
const TRIVIA = [
  ["What was the Straw Hat Pirates' first ship called?", ["Going Merry", "Thousand Sunny", "Red Force", "Moby Dick"], 0], ["What is the Nine-Tailed Fox's name in Naruto?", ["Shukaku", "Kurama", "Gyuki", "Matatabi"], 1],
  ["What letter does Death Note's great detective go by?", ["K", "N", "L", "M"], 2], ["Which wall falls first in Attack on Titan?", ["Wall Sina", "Wall Rose", "Wall Maria", "Wall Shiganshina"], 2],
  ["Which breathing style does Tanjiro learn first?", ["Flame", "Water", "Thunder", "Sun"], 1], ["Whose finger does Yuji Itadori swallow?", ["Satoru Gojo's", "Mahito's", "Ryomen Sukuna's", "Kenjaku's"], 2],
  ["What is All Might's Quirk called?", ["One For All", "All For One", "Explosion", "Half-Cold Half-Hot"], 0], ["What does Alphonse Elric lose in the failed transmutation?", ["His left arm", "His whole body", "His right leg", "His memories"], 1],
  ["How many Dragon Balls are there?", ["Five", "Six", "Seven", "Nine"], 2], ["What type of Pokémon is Pikachu?", ["Fire", "Electric", "Normal", "Psychic"], 1],
  ["Which studio made Spirited Away?", ["Studio Ghibli", "Madhouse", "MAPPA", "Kyoto Animation"], 0], ["What is Ichigo's Zanpakuto called?", ["Senbonzakura", "Hyorinmaru", "Zangetsu", "Benihime"], 2],
  ["Where does Kaneki work in Tokyo Ghoul?", ["A bookshop", "Anteiku café", "A ramen stand", "A library"], 1], ["What gives Luffy his stretchy body?", ["The Flame-Flame Fruit", "The Gum-Gum Fruit", "The Chop-Chop Fruit", "The Dark-Dark Fruit"], 1],
  ["Who is Gon looking for in Hunter x Hunter?", ["His mother", "His brother", "His father, Ging", "His teacher"], 2], ["What is Usagi's cat called in Sailor Moon?", ["Artemis", "Luna", "Diana", "Selene"], 1],
  ["What can Anya do in Spy x Family?", ["Fly", "Read minds", "Turn invisible", "See the future"], 1], ["What is Denji's devil dog called?", ["Pochita", "Power", "Meowy", "Kishibe"], 0],
  ["What is the ship called in Cowboy Bebop?", ["Swordfish", "Red Tail", "Bebop", "Hammerhead"], 2], ["What is Naruto's favourite food?", ["Sushi", "Dango", "Ramen", "Curry"], 2],
  ["What food does Ryuk love?", ["Apples", "Potato chips", "Cake", "Grapes"], 0], ["Who is called humanity's strongest soldier?", ["Erwin", "Levi", "Mikasa", "Hange"], 1],
  ["What does Nezuko carry in her mouth?", ["A flower", "A bamboo muzzle", "A sword", "A scroll"], 1], ["What does “shinigami” mean?", ["Ghost", "Death god", "Samurai", "Fox spirit"], 1],
  ["Which Evangelion unit does Shinji pilot?", ["Unit-00", "Unit-01", "Unit-02", "Unit-13"], 1], ["What are the fighting spirits in JoJo's Bizarre Adventure called?", ["Personas", "Stands", "Spirits", "Quirks"], 1],
  ["What is Kirito's real name?", ["Kazuto Kirigaya", "Tatsuya Shiba", "Shinji Ikari", "Taki Tachibana"], 0], ["What sport do they play in Haikyu!!?", ["Basketball", "Football", "Volleyball", "Tennis"], 2],
  ["What falls from the sky in Your Name?", ["Snow", "A comet", "A satellite", "Rain of fish"], 1], ["Which anime has the Survey Corps?", ["Attack on Titan", "Bleach", "Fire Force", "Black Clover"], 0],
  ["What is Goku's signature energy attack?", ["Rasengan", "Kamehameha", "Getsuga Tensho", "Spirit Gun"], 1], ["Which village is Naruto from?", ["The Hidden Sand", "The Hidden Mist", "The Hidden Leaf", "The Hidden Cloud"], 2],
  ["Who is the Straw Hats' swordsman?", ["Sanji", "Roronoa Zoro", "Usopp", "Franky"], 1], ["What kind of bus is in My Neighbor Totoro?", ["A Dogbus", "A Catbus", "A Frogbus", "A Ghostbus"], 1],
  ["What covers Gojo's eyes?", ["Sunglasses only", "A blindfold", "A mask", "Nothing"], 1], ["What is the first law of alchemy in Fullmetal Alchemist?", ["Equivalent Exchange", "Nothing is free", "Truth is one", "All is one"], 0],
  ["What is Ash's hometown?", ["Viridian City", "Pallet Town", "Cerulean City", "Lavender Town"], 1], ["What is the afterlife called in Bleach?", ["Hueco Mundo", "Soul Society", "The Shadow Realm", "Valhalla"], 1],
  ["Who is the Flame Hashira?", ["Giyu Tomioka", "Kyojuro Rengoku", "Shinobu Kocho", "Tengen Uzui"], 1], ["In Mob Psycho 100, what happens at 100%?", ["Mob falls asleep", "His power bursts out", "He forgets everything", "He turns into a cat"], 1]
];
const pickDay = (l, n) => l[((n % l.length) + l.length) % l.length];
const quote = d => { const q = pickDay(QUOTES, dayN(d) + 7 * (d || new Date()).getFullYear()); return { text:q[0], who:q[1], show:q[2] }; };
const word = d => { const w = pickDay(WORDS, dayN(d) * 3 + (d || new Date()).getFullYear()); return { jp:w[0], kana:w[1], ro:w[2], en:w[3] }; };
const opening = d => { const o = pickDay(OPENINGS, weekN(d) + (d || new Date()).getFullYear() * 53); return { song:o[0], artist:o[1], show:o[2], url:"https://www.youtube.com/results?search_query=" + encodeURIComponent(o[2] + " opening " + o[0]) }; };

/* ---------------------------------------------------------------- #065 guess the anime */
async function guessPool() {
  const page = 1 + Math.floor(Math.random() * 3);
  const r = await AL("query($p:Int){Page(page:$p,perPage:50){media(type:ANIME,isAdult:false,sort:POPULARITY_DESC,format:TV){id title{romaji english} coverImage{large}}}}", { p:page }, 24 * 3600e3);
  return (r.Page && r.Page.media || []).map(m => ({ id:m.id, t:title(m), img:m.coverImage && m.coverImage.large || "" })).filter(m => m.t && m.img);
}

/* ---------------------------------------------------------------- #067 the cosplay board */
const cosplay = () => (get("cosplay", []) || []).filter(x => x && x.u).slice(0, 60);
function cosAdd(u, page, t) { if (!u) return false; const l = cosplay().filter(x => x.u !== u); l.unshift({ u, page:page || "", t:String(t || "").slice(0, 80), ts:Date.now() }); put("cosplay", l.slice(0, 60)); return true; }
const cosDel = u => put("cosplay", cosplay().filter(x => x.u !== u));
// a photo of your own, small enough to keep (900 px)
const shrinkImg = (file, max, q) => new Promise((ok, bad) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { const k = Math.min(1, (max || 900) / Math.max(i.naturalWidth, i.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL("image/jpeg", q || 0.8)); }; i.onerror = () => bad(new Error("That picture couldn't be opened.")); i.src = u; });

/* ---------------------------------------------------------------- #072 secrets */
const SECRETS = [
  ["konami", "🎮", "The old code", "On the new tab page, an old game code (↑↑↓↓←→←→BA)"], ["mochi50", "🍡", "Mochi's best friend", "Poke Mochi a lot. A real lot."],
  ["plusultra", "💥", "Go beyond", "Type a famous hero's motto in the address bar"], ["spider10", "🕷️", "Spider spotter", "Find the hidden spider in the wallpaper ten times"],
  ["midnight", "🌙", "Witching hour", "Open the Anime hub at exactly midnight"], ["dattebayo", "🍥", "Believe it!", "Say a certain ninja's catchphrase to Hey Webs"]
];
const foundS = () => get("secrets", {}) || {};
function secret(id) {
  const f = foundS(); if (f[id] || !SECRETS.some(s => s[0] === id)) return false;
  f[id] = Date.now(); put("secrets", f);
  const s = SECRETS.find(x => x[0] === id);
  try { document.dispatchEvent(new CustomEvent("wsb-secret", { detail:{ id, name:s[2], e:s[1], n:Object.keys(f).length, of:SECRETS.length } })); } catch (e) {}
  if (window.XP && XP.add) XP.add(25, "Secret: " + s[2]);
  return true;
}
const secrets = () => { const f = foundS(); return SECRETS.map(s => ({ id:s[0], e:s[1], name:s[2], hint:s[3], found:!!f[s[0]] })); };
function spiderCheck() { try { const f = JSON.parse(localStorage.getItem("wsb.animeFound") || "{}") || {}; if (Object.values(f).reduce((n, l) => n + (l || []).length, 0) >= 10) secret("spider10"); } catch (e) {} }
function mochiCheck() { if ((+get("buddyPokes", 0) || 0) >= 50) secret("mochi50"); }

/* ---------------------------------------------------------------- #058 a theme from your picture */
function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h * 360, s, l]; }
const hex = (h, s, l) => { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join(""); };
function palette(img) {
  const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data, bins = {};
  let best = null, bestScore = -1, dark = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = hsl(d[i], d[i + 1], d[i + 2]), k = Math.round(h / 15) + ":" + Math.round(s * 4) + ":" + Math.round(l * 4);
    bins[k] = (bins[k] || 0) + 1;
    const sc = s * (1 - Math.abs(l - .55) * 1.6) * Math.sqrt(bins[k]);       // vivid, not too dark or pale, and common
    if (sc > bestScore) { bestScore = sc; best = [h, s, l]; }
    if (l < .45) { dark[0] += Math.cos(h * Math.PI / 180) * s; dark[1] += Math.sin(h * Math.PI / 180) * s; dark[2] += s; dark[3]++; }
  }
  const dh = (Math.atan2(dark[1], dark[0]) * 180 / Math.PI + 360) % 360, ds = dark[3] ? Math.min(.45, dark[2] / dark[3]) : .2;
  const ah = best ? best[0] : 0, as = best ? Math.max(.55, best[1]) : .7, al = best ? Math.min(.62, Math.max(.5, best[2])) : .55;
  return { a:hex(ah, as, al), c:[hex(dh, ds, .055), hex(dh, ds, .085), hex(dh, ds, .115), hex(dh, ds, .15), hex(dh, ds * .8, .19), hex(dh, .2, .95), hex(dh, .12, .68), hex(dh, .1, .5)] };
}
async function makeTheme(file, name) {
  const data = await shrinkImg(file, 1600, 0.82);
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That picture couldn't be opened.")); i.src = data; });
  return Object.assign(palette(img), { img:data, name:String(name || "My theme").slice(0, 30) });
}

/* ---------------------------------------------------------------- #069 anime radio (radio-browser.info: free, open, no account) */
const RB = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info", "https://fi1.api.radio-browser.info"];
async function stations() {
  for (const b of RB) {
    try {
      const r = await fetch(b + "/json/stations/search?tag=anime&order=clickcount&reverse=true&hidebroken=true&limit=60", { headers:{ accept:"application/json" } });
      if (!r.ok) continue;
      const l = await r.json();
      const seen = new Set();
      return l.filter(x => x && /^https:\/\//.test(x.url_resolved || "") && x.name && !seen.has(x.name.trim().toLowerCase()) && seen.add(x.name.trim().toLowerCase()))
        .slice(0, 24).map(x => ({ id:x.stationuuid, name:x.name.trim().slice(0, 60), url:x.url_resolved, where:x.country || "", tags:String(x.tags || "").split(",").filter(t => t && t !== "anime").slice(0, 3).join(" · "), icon:/^https:/.test(x.favicon || "") ? x.favicon : "" }));
    } catch (e) {}
  }
  throw new Error("The radio list couldn't be reached. Try again later.");
}
const radio = { a:null, now:null, vol:+get("radioVol", 0.6) || 0.6 };
function play(st) {
  if (!radio.a) { radio.a = new Audio(); radio.a.preload = "none"; }
  if (radio.now && st && radio.now.id === st.id && !radio.a.paused) { radio.a.pause(); radio.now = null; return false; }
  if (!st) { radio.a.pause(); radio.now = null; return false; }
  radio.now = st; radio.a.src = st.url; radio.a.volume = radio.vol;
  radio.a.play().catch(() => { radio.now = null; if (radio.onErr) radio.onErr(); });
  return true;
}

/* ---------------------------------------------------------------- the hub */
const TABS = [["season", "This season"], ["follow", "Following"], ["today", "Today"], ["guess", "Guess the anime"], ["trivia", "Trivia"], ["va", "Voice actors"], ["filler", "Filler guide"], ["order", "Watch order"], ["cosplay", "Cosplay board"], ["maker", "Make a theme"], ["mochi", "Mochi's outfits"], ["radio", "Radio"], ["secrets", "Secrets"]];
function hub(el, app) {
  app = app || {};
  let tab = get("animeHubTab", "season"); if (!TABS.some(t => t[0] === tab)) tab = "season";
  if (new Date().getHours() === 0 && new Date().getMinutes() === 0) secret("midnight");
  el.classList.add("amh");
  el.innerHTML = '<div class="amh-tabs hscroll" role="tablist">' + TABS.map(t => '<button type="button" role="tab" data-t="' + t[0] + '">' + esc(t[1]) + "</button>").join("") + '</div><div class="amh-body"></div>';
  const body = el.querySelector(".amh-body");
  const open = u => { if (u && app.open) app.open(u); };
  const busy = t => { body.innerHTML = '<div class="amh-w"><i></i><span></span></div>'; body.querySelector("span").textContent = t || "Loading…"; };
  const fail = e => { body.innerHTML = '<div class="amh-err"></div>'; body.firstChild.textContent = e && e.message || "Something went wrong."; };
  const show = async t => {
    tab = t; put("animeHubTab", t);
    el.querySelectorAll(".amh-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    const b = el.querySelector('.amh-tabs [data-t="' + t + '"]'); if (b && b.scrollIntoView) try { b.scrollIntoView({ block:"nearest", inline:"nearest" }); } catch (e) {}
    try { await (VIEWS[t] || VIEWS.season)(); } catch (e) { fail(e); }
  };
  el.querySelectorAll(".amh-tabs button").forEach(b => { b.onclick = () => show(b.dataset.t); });
  const card = (m, extra) => '<div class="amh-card" data-id="' + m.id + '"><button type="button" class="amh-cov" style="' + (m.color ? "background-color:" + esc(m.color) + ";" : "") + (m.img ? "background-image:url(&quot;" + esc(m.img) + "&quot;)" : "") + '" title="' + esc(m.t) + '"></button>' +
    '<div class="amh-ct"><b>' + esc(m.t) + "</b>" + (extra || "") + '</div><button type="button" class="amh-fol' + (isFollowed(m.id) ? " on" : "") + '" title="Follow: a countdown to its next episode">' + (isFollowed(m.id) ? "★" : "☆") + "</button></div>";
  const wire = list => {
    body.querySelectorAll(".amh-card").forEach(c => { const m = list.find(x => String(x.id) === c.dataset.id); if (!m) return;
      c.querySelector(".amh-cov").onclick = () => open(m.url);
      c.querySelector(".amh-fol").onclick = e => { const on = !isFollowed(m.id); follow(m, on); e.target.classList.toggle("on", on); e.target.textContent = on ? "★" : "☆"; }; });
  };
  const VIEWS = {
    // #051 this season, with air times in your time zone
    async season() {
      busy("This season's anime…");
      const r = await chart(); if (tab !== "season") return;
      body.innerHTML = '<div class="amh-h">' + esc(r.season) + ' · ' + r.list.length + ' shows <span>Times are yours: ' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone || "") + '</span></div><div class="amh-grid"></div><div class="amh-src">From AniList</div>';
      body.querySelector(".amh-grid").innerHTML = r.list.map(m => card(m, (m.next ? '<span class="amh-next">Ep ' + m.next.ep + " · " + esc(when(m.next.at)) + "</span>" : "") + '<span class="amh-g">' + esc(m.genres.join(" · ")) + (m.score ? " · ★ " + (m.score / 10).toFixed(1) : "") + "</span>")).join("");
      wire(r.list);
    },
    // #070 countdowns
    async follow() {
      busy();
      const l = await countdowns(); if (tab !== "follow") return;
      body.innerHTML = '<div class="amh-search"><input type="search" class="amh-in" placeholder="Follow a show: search by name"><div class="amh-res"></div></div><div class="amh-cds"></div>';
      const cds = body.querySelector(".amh-cds");
      cds.innerHTML = l.length ? l.map(m => '<div class="amh-cd"><div class="amh-ci" style="background-image:url(&quot;' + esc(m.img) + '&quot;)"></div><div><b>' + esc(m.t) + "</b><span>" +
        (m.at ? (m.premiere ? "Premieres " : "Episode " + m.ep + " ") + esc(when(m.at)) : m.status === "FINISHED" ? "Finished" : "No date yet") + "</span></div>" + (m.at ? '<em class="amh-left" data-at="' + m.at + '">' + left(m.at) + "</em>" : "") + '<button type="button" class="amh-x" data-id="' + m.id + '" title="Stop following">✕</button></div>').join("")
        : '<div class="amh-note">Follow shows (☆ on This season, or search above) to get a countdown to their next episode or new season.</div>';
      cds.querySelectorAll(".amh-x").forEach(b => { b.onclick = () => { follow({ id:+b.dataset.id }, false); VIEWS.follow(); }; });
      const inp = body.querySelector(".amh-in"), res = body.querySelector(".amh-res"); let t0 = 0;
      inp.oninput = () => { clearTimeout(t0); const q = inp.value.trim(); if (q.length < 2) { res.innerHTML = ""; return; } t0 = setTimeout(async () => {
        try { const l2 = await search(q); res.innerHTML = l2.map(m => '<button type="button" class="amh-hit" data-id="' + m.id + '"><i style="background-image:url(&quot;' + esc(m.img) + '&quot;)"></i>' + esc(m.t) + "</button>").join("");
          res.querySelectorAll(".amh-hit").forEach(b => { b.onclick = () => { const m = l2.find(x => String(x.id) === b.dataset.id); follow(m, true); VIEWS.follow(); }; }); } catch (e) { res.textContent = e.message; } }, 350); };
    },
    // #052 #053 #054 #062
    async today() { body.innerHTML = '<div class="amh-today"></div>'; await daily(body.querySelector(".amh-today"), app, { all:true }); },
    // #065
    async guess() {
      busy("Picking a show…");
      const pool = await guessPool(); if (tab !== "guess") return;
      const st = get("animeGuess", { right:0, played:0, streak:0 }) || {};
      const round = () => {
        const ans = pool[Math.floor(Math.random() * pool.length)], opts = [ans];
        while (opts.length < 4) { const x = pool[Math.floor(Math.random() * pool.length)]; if (!opts.some(o => o.id === x.id)) opts.push(x); }
        opts.sort(() => Math.random() - .5);
        let blur = 22, done = false;
        body.innerHTML = '<div class="amh-gq"><div class="amh-gimg"><img alt="" referrerpolicy="no-referrer"></div><div class="amh-gopts">' + opts.map(o => '<button type="button" data-id="' + o.id + '">' + esc(o.t) + "</button>").join("") +
          '</div><div class="amh-gs">' + (st.right || 0) + " right of " + (st.played || 0) + (st.streak > 1 ? " · streak " + st.streak + " 🔥" : "") + '</div><button type="button" class="amh-btn amh-gnext" hidden>Next ›</button></div>';
        const im = body.querySelector(".amh-gimg img"); im.src = ans.img; im.style.filter = "blur(" + blur + "px)";
        const clear = setInterval(() => { if (done || !im.isConnected) { clearInterval(clear); return; } blur = Math.max(4, blur - 1.5); im.style.filter = "blur(" + blur + "px)"; }, 700);
        body.querySelectorAll(".amh-gopts button").forEach(b => { b.onclick = () => {
          if (done) return; done = true; clearInterval(clear); im.style.filter = "none";
          const okk = +b.dataset.id === ans.id; st.played = (st.played || 0) + 1; if (okk) { st.right = (st.right || 0) + 1; st.streak = (st.streak || 0) + 1; } else st.streak = 0; put("animeGuess", st);
          if (okk && window.XP && XP.add) XP.add(Math.max(2, Math.round(blur / 2)), "Guess the anime");
          body.querySelectorAll(".amh-gopts button").forEach(x => x.classList.add(+x.dataset.id === ans.id ? "right" : x === b ? "wrong" : "dim"));
          body.querySelector(".amh-gs").textContent = (okk ? "Yes! " : "It was " + ans.t + ". ") + st.right + " right of " + st.played + (st.streak > 1 ? " · streak " + st.streak + " 🔥" : "");
          const nx = body.querySelector(".amh-gnext"); nx.hidden = false; nx.onclick = round;
        }; });
      };
      round();
    },
    // #064
    async trivia() {
      const order = TRIVIA.map((x, i) => i).sort(() => Math.random() - .5).slice(0, 10); let qi = 0, right = 0;
      const ask = () => {
        if (qi >= order.length) { body.innerHTML = '<div class="amh-done"><b>' + right + " / " + order.length + "</b><span>" + (right >= 9 ? "Anime master! 🏆" : right >= 6 ? "Nicely done." : "Time for a rewatch? 📺") + '</span><button type="button" class="amh-btn">Play again</button></div>'; body.querySelector("button").onclick = () => VIEWS.trivia(); if (window.XP && XP.add && right) XP.add(right * 2, "Anime trivia"); const best = get("triviaBest", 0); if (right > best) put("triviaBest", right); return; }
        const q = TRIVIA[order[qi]];
        body.innerHTML = '<div class="amh-q"><div class="amh-qn">Question ' + (qi + 1) + " of " + order.length + " · " + right + ' right</div><b>' + esc(q[0]) + '</b><div class="amh-qo">' + q[1].map((o, i) => '<button type="button" data-i="' + i + '">' + esc(o) + "</button>").join("") + "</div></div>";
        body.querySelectorAll(".amh-qo button").forEach(b => { b.onclick = () => {
          const i = +b.dataset.i; if (i === q[2]) right++;
          body.querySelectorAll(".amh-qo button").forEach(x => { x.disabled = true; x.classList.add(+x.dataset.i === q[2] ? "right" : x === b ? "wrong" : "dim"); });
          setTimeout(() => { qi++; ask(); }, 1100);
        }; });
      };
      ask();
    },
    // #068
    async va() {
      body.innerHTML = '<div class="amh-search"><input type="search" class="amh-in" placeholder="A character, e.g. Gojo, Luffy, Nezuko"></div><div class="amh-vas"><div class="amh-note">Who voices a character, in Japanese and English, and what else they\'ve voiced.</div></div>';
      const inp = body.querySelector(".amh-in"), out = body.querySelector(".amh-vas"); let t0 = 0;
      const person = (v, lang) => '<button type="button" class="amh-va" data-id="' + v.id + '"><i style="background-image:url(&quot;' + esc(v.img) + '&quot;)"></i><span><b>' + esc(v.name) + "</b><em>" + lang + '</em></span></button>';
      inp.oninput = () => { clearTimeout(t0); const q = inp.value.trim(); if (q.length < 2) return; t0 = setTimeout(async () => {
        out.innerHTML = '<div class="amh-w"><i></i><span>Looking…</span></div>';
        try {
          const l = await voiceActors(q); if (!out.isConnected) return;
          out.innerHTML = l.length ? l.map(c => '<div class="amh-ch"><div class="amh-ci" style="background-image:url(&quot;' + esc(c.img) + '&quot;)"></div><div class="amh-chb"><b>' + esc(c.name) + "</b><span>" + esc(c.show) + "</span>" +
            c.ja.map(v => person(v, "Japanese")).join("") + c.en.map(v => person(v, "English")).join("") + '<div class="amh-roles"></div></div></div>').join("") : '<div class="amh-note">No character by that name.</div>';
          out.querySelectorAll(".amh-va").forEach(b => { b.onclick = async () => { const box = b.parentNode.querySelector(".amh-roles"); box.textContent = "Loading…"; try { const rr = await roles(+b.dataset.id); box.innerHTML = "<b>Also voiced</b>" + rr.map(x => "<span>" + esc(x.name) + " <em>(" + esc(x.show) + ")</em></span>").join(""); } catch (e) { box.textContent = e.message; } }; });
        } catch (e) { out.textContent = e.message; } }, 400); };
    },
    // #056
    async filler() {
      const SHOWS = [["naruto", "Naruto"], ["naruto-shippuden", "Naruto Shippuden"], ["boruto-naruto-next-generations", "Boruto"], ["bleach", "Bleach"], ["one-piece", "One Piece"], ["fairy-tail", "Fairy Tail"],
        ["dragon-ball-z", "Dragon Ball Z"], ["black-clover", "Black Clover"], ["inuyasha", "Inuyasha"], ["gintama", "Gintama"], ["detective-conan", "Detective Conan"], ["my-hero-academia", "My Hero Academia"]];
      body.innerHTML = '<div class="amh-search"><select class="amh-in">' + SHOWS.map(s => '<option value="' + s[0] + '">' + esc(s[1]) + "</option>").join("") + '<option value="">Another show…</option></select><input class="amh-in amh-other" placeholder="The show\'s name" hidden><button type="button" class="amh-btn">Show the filler</button></div><div class="amh-fl"><div class="amh-note">Which episodes you can skip in long shows: filler (made for the anime only), mixed, and story episodes.</div></div>';
      const sel = body.querySelector("select"), other = body.querySelector(".amh-other"), out = body.querySelector(".amh-fl");
      sel.onchange = () => { other.hidden = !!sel.value; if (!sel.value) other.focus(); };
      body.querySelector(".amh-btn").onclick = async () => {
        const s = sel.value || other.value.trim(); if (!s) return;
        const base = app.server ? app.server() : ""; if (!base) { out.innerHTML = '<div class="amh-err">The filler guide uses your Web AI server. Open Web AI once to connect it.</div>'; return; }
        out.innerHTML = '<div class="amh-w"><i></i><span>Reading the filler list…</span></div>';
        try {
          const j = await (await fetch(base + "/filler?s=" + encodeURIComponent(s))).json();
          if (!j.ok) { out.innerHTML = '<div class="amh-err"></div>'; out.firstChild.textContent = j.message || "No list for that show."; return; }
          out.innerHTML = '<div class="amh-h">' + esc(j.show) + "</div>" + [["Filler: skip these", j.filler, "f"], ["Mixed: some story, some filler", j.mixed, "m"], ["Story (from the manga)", j.canon, "c"], ["Story (anime-only canon)", j.anime, "c"]]
            .filter(x => x[1]).map(x => '<div class="amh-fk ' + x[2] + '"><b>' + esc(x[0]) + "</b><p>" + esc(x[1]) + "</p></div>").join("") + '<div class="amh-src">From animefillerlist.com</div>';
        } catch (e) { out.innerHTML = '<div class="amh-err">The filler list couldn\'t be reached. Try again later.</div>'; }
      };
    },
    // #057
    async order() {
      body.innerHTML = '<div class="amh-search"><input class="amh-in" placeholder="A franchise, e.g. Fate, Monogatari, Gundam, Dragon Ball"><button type="button" class="amh-btn">Watch order</button></div><div class="amh-wo"><div class="amh-note">The best order to watch a franchise: series, films and specials, and which ones you can skip.</div></div>';
      const inp = body.querySelector(".amh-in"), out = body.querySelector(".amh-wo");
      const go = async () => {
        const q = inp.value.trim(); if (!q) return;
        if (!window.AI || !AI.ready()) { out.innerHTML = '<div class="amh-err">This uses Web AI. Open Web AI once to connect it.</div>'; return; }
        out.innerHTML = '<div class="amh-w"><i></i><span>Working out the order…</span></div>';
        try { const r = await AI.ask("", "Give the recommended watch order for the anime franchise “" + q + "” for a first-time viewer: a numbered list, each with its type (TV, film, OVA) and year, marking optional ones as (optional). Then one line on any alternative order. If you're not sure the franchise exists, say so.");
          out.innerHTML = '<div class="amh-ai">' + AI.md(r.text) + "</div>"; } catch (e) { out.innerHTML = '<div class="amh-err"></div>'; out.firstChild.textContent = e.message; }
      };
      body.querySelector(".amh-btn").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
    },
    // #067
    async cosplay() {
      const l = cosplay();
      body.innerHTML = '<div class="amh-cbar">' + (app.addFromPage ? '<button type="button" class="amh-btn amh-cpage">＋ From the page you\'re on</button>' : "") + '<label class="amh-btn amh-cfile"><input type="file" accept="image/*" hidden>＋ A photo</label><input class="amh-in amh-curl" placeholder="or paste a picture\'s address (https://…)"></div>' +
        '<div class="amh-board">' + (l.length ? l.map(x => '<figure class="amh-pin"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(x.u) + '"><button type="button" class="amh-x" title="Remove">✕</button>' + (x.page ? '<button type="button" class="amh-pg" title="Where it came from">↗</button>' : "") + "</figure>").join("") : '<div class="amh-note">Save cosplay pictures here for ideas: from pages you visit, your photos, or a link.</div>') + "</div>";
      body.querySelectorAll(".amh-pin").forEach((f, i) => { const x = l[i]; f.querySelector(".amh-x").onclick = () => { cosDel(x.u); VIEWS.cosplay(); }; const pg = f.querySelector(".amh-pg"); if (pg) pg.onclick = () => open(x.page); f.querySelector("img").onclick = () => open(/^https:/.test(x.u) ? x.u : x.page); });
      const cp = body.querySelector(".amh-cpage"); if (cp) cp.onclick = async () => { try { const r = await app.addFromPage(); if (r) { cosAdd(r.u, r.page, r.t); VIEWS.cosplay(); } } catch (e) {} };
      body.querySelector(".amh-cfile input").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { cosAdd(await shrinkImg(f, 900, .8), "", f.name); VIEWS.cosplay(); } catch (x) {} };
      const cu = body.querySelector(".amh-curl"); cu.onkeydown = e => { if (e.key === "Enter" && /^https:\/\/\S+$/.test(cu.value.trim())) { cosAdd(cu.value.trim(), "", ""); VIEWS.cosplay(); } };
    },
    // #058 a theme from your picture
    async maker() {
      const cur = get("animeMine", null);
      body.innerHTML = '<div class="amh-note">Pick a picture you like (a screenshot, fan art, a photo). Webs takes its colors for the whole browser, and the picture becomes a slowly moving wallpaper.</div>' +
        '<div class="amh-cbar"><label class="amh-btn"><input type="file" accept="image/*" hidden>Choose a picture…</label>' + (cur ? '<button type="button" class="amh-btn amh-ghost amh-mdel">Delete my theme</button>' : "") + '</div><div class="amh-mk"></div>';
      const out = body.querySelector(".amh-mk");
      const paint = th => {
        out.innerHTML = '<div class="amh-mkp" style="background-image:url(&quot;' + esc(th.img) + '&quot;)"><div class="amh-mkc" style="background:' + th.c[1] + ";color:" + th.c[5] + '"><b style="color:' + th.a + '">' + esc(th.name) + '</b><span style="color:' + th.c[6] + '">How your browser will look</span><i style="background:' + th.a + '"></i></div></div>' +
          '<div class="amh-sw">' + th.c.map(c => '<i style="background:' + c + '"></i>').join("") + '</div><div class="amh-cbar"><input class="amh-in amh-mn" maxlength="30"><label class="amh-mac">Accent <input type="color"></label><button type="button" class="amh-btn amh-use">Use this theme</button></div>';
        const n = out.querySelector(".amh-mn"), ac = out.querySelector('input[type="color"]'); n.value = th.name; ac.value = th.a;
        n.oninput = () => { th.name = n.value.trim() || "My theme"; out.querySelector(".amh-mkc b").textContent = th.name; };
        ac.oninput = () => { th.a = ac.value; out.querySelector(".amh-mkc b").style.color = th.a; out.querySelector(".amh-mkc i").style.background = th.a; };
        out.querySelector(".amh-use").onclick = () => {
          try { localStorage.setItem("wsb.animeMine", JSON.stringify({ name:th.name, a:th.a, c:th.c, img:th.img })); } catch (e) { out.querySelector(".amh-use").textContent = "That picture is too big to keep"; return; }
          if (window.Anime && Anime.mine) Anime.mine();
          if (app.useTheme) app.useTheme("mine");
          out.querySelector(".amh-use").textContent = "✓ It's on";
        };
      };
      if (cur && cur.img) paint(Object.assign({}, cur));
      body.querySelector('input[type="file"]').onchange = async e => { const f = e.target.files[0]; if (!f) return; out.innerHTML = '<div class="amh-w"><i></i><span>Taking its colors…</span></div>';
        try { paint(await makeTheme(f, (f.name || "").replace(/\.[^.]+$/, "").slice(0, 30) || "My theme")); } catch (x) { out.innerHTML = '<div class="amh-err"></div>'; out.firstChild.textContent = x.message; } };
      const del = body.querySelector(".amh-mdel"); if (del) del.onclick = () => { try { localStorage.removeItem("wsb.animeMine"); } catch (e) {} if (window.Anime && Anime.mine) Anime.mine(); if (app.useTheme && app.theme && app.theme() === "mine") app.useTheme(""); VIEWS.maker(); };
    },
    // #060 Mochi's outfits
    async mochi() {
      if (!window.Buddy || !Buddy.OUTFITS) { body.innerHTML = '<div class="amh-note">Mochi lives on the start page.</div>'; return; }
      const pick = Buddy.outfitPick(), mk = (id, name, e, wear) => '<button type="button" class="amh-mo' + (pick === id ? " on" : "") + '" data-id="' + id + '"><span class="amh-moa">' + Buddy.preview(wear, 0) + "</span><b>" + esc(e + " " + name) + "</b></button>";
      const m = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      body.innerHTML = '<div class="amh-note">Mochi dresses for the season by itself, or pick what it wears.</div><div class="amh-mos">' + mk("auto", "For the season", "🗓️", Buddy.outfit()) + mk("none", "Nothing", "✖️", "") +
        Buddy.OUTFITS.map(o => mk(o.id, o.name + (o.months.length ? " (" + o.months.map(x => m[x]).join(", ") + ")" : ""), o.e, o.id)).join("") + "</div>";
      body.querySelectorAll(".amh-mo").forEach(b => { b.onclick = () => { Buddy.setOutfit(b.dataset.id); VIEWS.mochi(); }; });
    },
    // #069
    async radio() {
      busy("Finding anime radio stations…");
      const l = await stations(); if (tab !== "radio") return;
      body.innerHTML = '<div class="amh-rnow"><b></b><label>🔉 <input type="range" min="0" max="1" step="0.05"></label><button type="button" class="amh-btn amh-ghost amh-rstop">■ Stop</button></div><div class="amh-rl">' +
        l.map(x => '<button type="button" class="amh-rs" data-id="' + esc(x.id) + '"><i' + (x.icon ? ' style="background-image:url(&quot;' + esc(x.icon) + '&quot;)"' : "") + '>📻</i><span><b>' + esc(x.name) + "</b><em>" + esc([x.where, x.tags].filter(Boolean).join(" · ")) + '</em></span><u>▶</u></button>').join("") + '</div><div class="amh-src">Stations from radio-browser.info. Keeps playing while you browse.</div>';
      const now = body.querySelector(".amh-rnow"), vol = now.querySelector("input");
      vol.value = radio.vol; vol.oninput = () => { radio.vol = +vol.value; put("radioVol", radio.vol); if (radio.a) radio.a.volume = radio.vol; };
      const paint = () => { now.querySelector("b").textContent = radio.now ? "▶ " + radio.now.name : "Pick a station"; now.querySelector(".amh-rstop").hidden = !radio.now;
        body.querySelectorAll(".amh-rs").forEach(b => { const p = radio.now && radio.now.id === b.dataset.id; b.classList.toggle("on", !!p); b.querySelector("u").textContent = p ? "❚❚" : "▶"; }); };
      body.querySelectorAll(".amh-rs").forEach(b => { b.onclick = () => { play(l.find(x => x.id === b.dataset.id)); paint(); }; });
      now.querySelector(".amh-rstop").onclick = () => { play(null); paint(); };
      radio.onErr = () => { if (body.isConnected) { paint(); now.querySelector("b").textContent = "That station isn't playing right now. Try another."; } };
      paint();
    },
    // #072
    async secrets() {
      spiderCheck(); mochiCheck();
      const l = secrets(), n = l.filter(s => s.found).length;
      body.innerHTML = '<div class="amh-h">' + n + " of " + l.length + ' secrets found</div><div class="amh-secs">' + l.map(s => '<div class="amh-sec' + (s.found ? " on" : "") + '"><i>' + (s.found ? s.e : "🔒") + "</i><div><b>" + esc(s.found ? s.name : "???") + "</b><span>" + esc(s.hint) + "</span></div></div>").join("") + "</div>";
    }
  };
  show(tab);
  return { show };
}

/* ---------------------------------------------------------------- today's cards (#052 #053 #054 #062 #070) */
async function daily(el, app, opt) {
  app = app || {}; opt = opt || {};
  const q = quote(), w = word(), o = opening();
  el.classList.add("amd");
  el.innerHTML = '<div class="amd-bd"></div><div class="amd-row">' +
    '<div class="amd-c amd-q"><i>“</i><p>' + esc(q.text) + "</p><span>" + esc(q.who) + " · " + esc(q.show) + "</span></div>" +
    '<div class="amd-c amd-w"><span class="amd-k">Word of the day</span><b lang="ja">' + esc(w.jp) + "</b><em lang=\"ja\">" + esc(w.kana !== w.jp ? w.kana + " · " : "") + esc(w.ro) + "</em><p>" + esc(w.en) + "</p></div>" +
    '<button type="button" class="amd-c amd-o"><span class="amd-k">Opening of the week</span><b>' + esc(o.song) + "</b><p>" + esc(o.artist) + " · " + esc(o.show) + "</p><em>▶ Listen</em></button>" +
    '</div><div class="amd-cds"></div>';
  el.querySelector(".amd-o").onclick = () => app.open && app.open(o.url);
  // birthdays and countdowns come from AniList: they fill in when they arrive
  birthdays().then(l => {
    const b = l[0], box = el.querySelector(".amd-bd"); if (!b || !box) return;
    box.innerHTML = '<div class="amd-b"><div class="amd-bi" style="background-image:url(&quot;' + esc(b.img) + '&quot;)"></div><div><b>🎂 Happy birthday, ' + esc(b.name) + "!</b><span>" + esc(b.show) + (l.length > 1 ? " · also " + l.slice(1, 3).map(x => esc(x.name)).join(", ") : "") + "</span></div>" +
      (b.theme && app.useTheme ? '<button type="button" class="amd-th">Use the ' + esc(b.show) + " theme today</button>" : "") + "</div>";
    const th = box.querySelector(".amd-th"); if (th) th.onclick = () => { app.useTheme(b.theme); th.textContent = "✓ Theme on"; th.disabled = true; };
    box.querySelector(".amd-bi").onclick = () => app.open && app.open(b.url);
  }).catch(() => {});
  if (follows().length) countdowns().then(l => {
    const box = el.querySelector(".amd-cds"); if (!box) return;
    const soon = l.filter(m => m.at && m.at - Date.now() < 14 * 864e5).slice(0, opt.all ? 8 : 4);
    box.innerHTML = soon.map(m => '<div class="amd-cd"><i style="background-image:url(&quot;' + esc(m.img) + '&quot;)"></i><div><b>' + esc(m.t) + "</b><span>" + (m.premiere ? "Premieres" : "Ep " + m.ep) + " · " + esc(when(m.at)) + '</span></div><em class="amh-left" data-at="' + m.at + '">' + left(m.at) + "</em></div>").join("");
  }).catch(() => {});
}
// the countdowns tick
setInterval(() => { document.querySelectorAll(".amh-left[data-at]").forEach(e => { e.textContent = left(+e.dataset.at); }); }, 30000);

/* ---------------------------------------------------------------- #059 stickers */
const STICKERS = ["🌸", "✨", "⭐", "🍙", "🍜", "🍡", "🎏", "⛩️", "🗡️", "🦊", "🐉", "🐱", "🌙", "🔥", "💥", "💫", "🎌", "🍥", "🧋", "🎮", "👾", "🌈", "☁️", "🪄", "💖", "🎀", "🍓", "🌊", "🗻", "🏯"];
function stickers(el, opt) {
  opt = opt || {};
  const key = opt.key || "stickers";
  const list = () => (get(key, []) || []).filter(s => s && s.e).slice(0, 40);
  const layer = document.createElement("div"); layer.className = "stk-layer"; el.appendChild(layer);
  let editing = false, cur = -1;      // cur: the sticker touched last (the tray's buttons change it)
  const paint = () => {
    layer.innerHTML = "";
    list().forEach((s, i) => {
      const d = document.createElement("div"); d.className = "stk"; d.textContent = s.e;
      d.style.left = s.x + "%"; d.style.top = s.y + "%"; d.style.fontSize = (s.s || 64) + "px"; d.style.transform = "translate(-50%,-50%) rotate(" + (s.r || 0) + "deg)";
      d.dataset.i = i; layer.appendChild(d);
      let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      d.addEventListener("pointerdown", e => { if (!editing) return; e.preventDefault(); cur = i; layer.querySelectorAll(".stk").forEach(x => x.classList.toggle("cur", x === d)); d.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = s.x; oy = s.y; moved = false; d.classList.add("drag"); });
      d.addEventListener("pointermove", e => { if (!d.classList.contains("drag")) return; const r = layer.getBoundingClientRect(); s.x = Math.max(0, Math.min(100, ox + (e.clientX - sx) / r.width * 100)); s.y = Math.max(0, Math.min(100, oy + (e.clientY - sy) / r.height * 100)); d.style.left = s.x + "%"; d.style.top = s.y + "%"; moved = true; });
      d.addEventListener("pointerup", () => { if (!d.classList.contains("drag")) return; d.classList.remove("drag"); const l = list(); l[i] = s; put(key, l); });
      d.addEventListener("wheel", e => { if (!editing) return; e.preventDefault(); s.s = Math.max(28, Math.min(180, (s.s || 64) - Math.sign(e.deltaY) * 6)); if (e.shiftKey) { s.r = ((s.r || 0) + Math.sign(e.deltaY) * 8) % 360; } d.style.fontSize = s.s + "px"; d.style.transform = "translate(-50%,-50%) rotate(" + (s.r || 0) + "deg)"; const l = list(); l[i] = s; put(key, l); }, { passive:false });
      d.addEventListener("dblclick", () => { if (!editing) return; const l = list(); l.splice(i, 1); put(key, l); paint(); });
    });
  };
  const tray = document.createElement("div"); tray.className = "stk-tray"; tray.hidden = true;
  tray.innerHTML = '<div class="stk-pal">' + STICKERS.map(e => '<button type="button">' + e + "</button>").join("") + '</div><div class="stk-help">Drag stickers anywhere, then change the one you touched last:</div>' +
    '<div class="stk-bar"><button type="button" data-d="s-">−</button><button type="button" data-d="s+">+</button><button type="button" data-d="r">↻</button><button type="button" data-d="x">🗑</button><button type="button" class="stk-done">Done</button></div>';
  el.appendChild(tray);
  tray.querySelectorAll(".stk-pal button").forEach(b => { b.onclick = () => { const l = list(); l.push({ e:b.textContent, x:30 + Math.random() * 40, y:30 + Math.random() * 40, s:64, r:Math.round(Math.random() * 30 - 15) }); put(key, l.slice(-40)); cur = Math.min(l.length, 40) - 1; paint(); }; });
  tray.querySelectorAll("[data-d]").forEach(b => { b.onclick = () => {
    const l = list(), s = l[cur]; if (!s) return;
    const d = b.dataset.d;
    if (d === "x") { l.splice(cur, 1); cur = -1; } else if (d === "r") s.r = ((s.r || 0) + 15) % 360; else s.s = Math.max(28, Math.min(180, (s.s || 64) + (d === "s+" ? 12 : -12)));
    put(key, l); paint(); if (cur >= 0) { const n = layer.querySelector('.stk[data-i="' + cur + '"]'); if (n) n.classList.add("cur"); }
  }; });
  tray.querySelector(".stk-done").onclick = () => api.edit(false);
  const api = { edit(on) { editing = !!on; tray.hidden = !editing; layer.classList.toggle("editing", editing); if (opt.onEdit) opt.onEdit(editing); }, paint, count:() => list().length, layer, tray };
  paint();
  return api;
}

const css = document.createElement("style");
css.textContent = `
.amh{display:flex;flex-direction:column;gap:10px;min-height:0}.amh-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.amh-tabs::-webkit-scrollbar{display:none}
.amh-tabs button{flex:none;font:inherit;font-size:13px;border:1px solid var(--line, rgba(127,127,127,.3));background:transparent;color:var(--dim);border-radius:999px;padding:5px 12px;cursor:pointer}
.amh-tabs button.on{color:#fff;background:var(--accent);border-color:var(--accent)}.amh-body{min-height:120px}
.amh-h{font-weight:700;font-size:15px;margin:2px 0 10px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.amh-h span{font-weight:400;font-size:12px;color:var(--dim)}
.amh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.amh-card{position:relative;display:flex;flex-direction:column;gap:6px;min-width:0}
.amh-cov{all:unset;cursor:pointer;aspect-ratio:3/4;border-radius:10px;background:#333 center/cover no-repeat;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.amh-ct{display:flex;flex-direction:column;gap:2px;min-width:0}.amh-ct b{font-size:13px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.amh-next{font-size:12px;color:var(--accent);font-weight:600}.amh-g{font-size:11.5px;color:var(--dim)}
.amh-fol{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:16px;cursor:pointer}.amh-fol.on{color:#ffd34d}
.amh-src{font-size:11px;color:var(--dim);margin-top:10px}.amh-note{color:var(--dim);font-size:13.5px;padding:8px 0}.amh-err{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#e8342a 14%,transparent);font-size:13.5px}
.amh-w{display:flex;align-items:center;gap:10px;padding:16px 2px;color:var(--dim)}.amh-w i{width:16px;height:16px;border-radius:50%;border:2px solid var(--line, rgba(127,127,127,.3));border-top-color:var(--accent);animation:amhSpin .8s linear infinite}@keyframes amhSpin{to{transform:rotate(1turn)}}
.amh-search,.amh-cbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.amh-in{flex:1;min-width:160px;font:inherit;font-size:14px;color:var(--fg);background:var(--bg3, rgba(127,127,127,.12));border:1px solid var(--line, rgba(127,127,127,.3));border-radius:10px;padding:8px 10px}
.amh-btn{font:inherit;font-weight:600;font-size:13.5px;border-radius:10px;padding:8px 14px;border:0;background:var(--accent);color:#fff;cursor:pointer}
.amh-res{display:flex;flex-direction:column;gap:4px;width:100%}.amh-hit{display:flex;align-items:center;gap:10px;font:inherit;font-size:13.5px;text-align:left;background:transparent;border:0;color:var(--fg);padding:4px;border-radius:8px;cursor:pointer}.amh-hit:hover{background:var(--bg3, rgba(127,127,127,.12))}
.amh-hit i,.amh-cd .amh-ci,.amd-cd i{flex:none;width:34px;height:46px;border-radius:6px;background:#333 center/cover}
.amh-cds{display:flex;flex-direction:column;gap:8px}.amh-cd{display:flex;align-items:center;gap:10px;padding:6px;border-radius:10px;background:var(--bg3, rgba(127,127,127,.1))}.amh-cd>div:nth-child(2){flex:1;min-width:0;display:flex;flex-direction:column}.amh-cd span{font-size:12.5px;color:var(--dim)}
.amh-left{font-style:normal;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;white-space:nowrap}.amh-x{border:0;background:none;color:var(--dim);cursor:pointer;font-size:14px}
.amh-gq{display:flex;flex-direction:column;align-items:center;gap:12px}.amh-gimg{width:min(240px,70%);aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:#222}.amh-gimg img{width:100%;height:100%;object-fit:cover;transition:filter .6s}
.amh-gopts,.amh-qo{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}.amh-gopts button,.amh-qo button{font:inherit;font-size:13.5px;padding:10px;border-radius:10px;border:1px solid var(--line, rgba(127,127,127,.3));background:var(--bg3, rgba(127,127,127,.1));color:var(--fg);cursor:pointer;text-align:center}
.amh-gopts .right,.amh-qo .right{background:#2f9e5b;color:#fff;border-color:#2f9e5b}.amh-gopts .wrong,.amh-qo .wrong{background:#d0433a;color:#fff;border-color:#d0433a}.amh-gopts .dim,.amh-qo .dim{opacity:.5}.amh-gs,.amh-qn{font-size:12.5px;color:var(--dim)}
.amh-q{display:flex;flex-direction:column;gap:12px}.amh-q b{font-size:15.5px}.amh-done{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px}.amh-done b{font-size:40px}
.amh-ch{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line, rgba(127,127,127,.2))}.amh-ch .amh-ci{flex:none;width:64px;height:88px;border-radius:8px;background:#333 center/cover}.amh-chb{display:flex;flex-direction:column;gap:6px;min-width:0}.amh-chb>span{font-size:12.5px;color:var(--dim)}
.amh-va{display:flex;align-items:center;gap:8px;font:inherit;background:transparent;border:0;color:var(--fg);text-align:left;cursor:pointer;padding:2px}.amh-va i{width:32px;height:32px;border-radius:50%;background:#333 center/cover;flex:none}.amh-va span{display:flex;flex-direction:column}.amh-va em{font-style:normal;font-size:11.5px;color:var(--dim)}
.amh-roles{font-size:12.5px;display:flex;flex-wrap:wrap;gap:4px 10px}.amh-roles b{width:100%}.amh-roles em{color:var(--dim);font-style:normal}
.amh-fk{padding:8px 10px;border-radius:10px;margin-bottom:8px;background:var(--bg3, rgba(127,127,127,.1))}.amh-fk.f{box-shadow:inset 3px 0 0 #d0433a}.amh-fk.m{box-shadow:inset 3px 0 0 #e8a33a}.amh-fk.c{box-shadow:inset 3px 0 0 #2f9e5b}.amh-fk p{margin:4px 0 0;font-size:13px;overflow-wrap:anywhere}
.amh-ai{font-size:14px;line-height:1.5}.amh-ai ol,.amh-ai ul{padding-left:20px}
.amh-board{columns:3 140px;column-gap:10px}.amh-pin{position:relative;margin:0 0 10px;break-inside:avoid;border-radius:10px;overflow:hidden}.amh-pin img{display:block;width:100%;cursor:pointer}.amh-pin .amh-x,.amh-pin .amh-pg{position:absolute;top:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff}.amh-pin .amh-x{right:6px}.amh-pin .amh-pg{right:36px;border:0;cursor:pointer}
.amh-ghost{background:transparent;color:var(--fg);box-shadow:inset 0 0 0 1px var(--line, rgba(127,127,127,.35))}
.amh-mkp{position:relative;height:200px;border-radius:14px;background:#222 center/cover;margin-bottom:10px;overflow:hidden}.amh-mkc{position:absolute;left:14px;bottom:14px;display:flex;flex-direction:column;gap:2px;padding:10px 14px 14px;border-radius:12px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.amh-mkc span{font-size:12px}.amh-mkc i{position:absolute;left:14px;right:14px;bottom:6px;height:3px;border-radius:2px}.amh-sw{display:flex;gap:4px;margin-bottom:10px}.amh-sw i{flex:1;height:18px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.3)}
.amh-mac{display:flex;align-items:center;gap:6px;font-size:13.5px}.amh-mac input{width:40px;height:32px;border:0;background:none;padding:0}
.amh-mos{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.amh-mo{display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit;font-size:12.5px;padding:10px 6px;border-radius:12px;border:2px solid transparent;background:var(--bg3, rgba(127,127,127,.1));color:var(--fg);cursor:pointer}
.amh-mo.on{border-color:var(--accent)}.amh-moa{width:64px;height:64px;--bd:var(--accent,#e8342a);--bd2:color-mix(in srgb,var(--accent,#e8342a) 55%,#000)}.amh-moa svg{width:100%;height:100%;overflow:visible}.amh-mo b{font-weight:600;text-align:center}
.amh-rnow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-radius:12px;background:var(--bg3, rgba(127,127,127,.1));margin-bottom:10px}.amh-rnow b{flex:1;min-width:140px}.amh-rnow label{display:flex;align-items:center;gap:4px}
.amh-rl{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}.amh-rs{display:flex;align-items:center;gap:10px;font:inherit;text-align:left;padding:6px 10px 6px 6px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--fg);cursor:pointer;min-width:0}
.amh-rs:hover{background:var(--bg3, rgba(127,127,127,.1))}.amh-rs.on{border-color:var(--accent)}.amh-rs i{flex:none;width:36px;height:36px;border-radius:8px;background:var(--bg3, #333) center/cover;display:grid;place-items:center;font-style:normal;font-size:16px;overflow:hidden;color:transparent}.amh-rs i:not([style]){color:inherit}
.amh-rs span{flex:1;min-width:0;display:flex;flex-direction:column}.amh-rs b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amh-rs em{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amh-rs u{text-decoration:none;color:var(--accent)}
.amh-secs{display:grid;gap:8px}.amh-sec{display:flex;gap:12px;align-items:center;padding:8px 10px;border-radius:10px;background:var(--bg3, rgba(127,127,127,.1));opacity:.7}.amh-sec.on{opacity:1;box-shadow:inset 0 0 0 1px var(--accent)}.amh-sec i{font-size:24px;font-style:normal}.amh-sec div{display:flex;flex-direction:column}.amh-sec span{font-size:12.5px;color:var(--dim)}
.amd{display:flex;flex-direction:column;gap:10px}.amd-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.amd-c{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--bg2, #222) 82%,transparent);backdrop-filter:blur(8px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 22%,transparent);color:var(--fg);min-width:0}
.amd-q i{font-style:normal;font-size:28px;line-height:.6;color:var(--accent)}.amd-q p{margin:0;font-size:14px;line-height:1.4}.amd-q span,.amd-w em,.amd-o p{font-size:12px;color:var(--dim);font-style:normal;margin:0}
.amd-k{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}.amd-w b{font-size:26px;font-weight:600}.amd-w p{margin:0;font-size:13px}.amd-o{cursor:pointer}.amd-o b{font-size:16px}.amd-o em{font-style:normal;font-size:12.5px;color:var(--accent);font-weight:600}
.amd-b{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 30%,transparent),transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent)}
.amd-bi{width:44px;height:44px;border-radius:50%;background:#333 center/cover;flex:none;cursor:pointer}.amd-b>div:nth-child(2){flex:1;min-width:0;display:flex;flex-direction:column}.amd-b span{font-size:12.5px;color:var(--dim)}
.amd-th{font:inherit;font-size:12.5px;font-weight:600;border:0;border-radius:999px;padding:6px 12px;background:var(--accent);color:#fff;cursor:pointer}
.amd-cds{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}.amd-cds:empty{display:none}.amd-cd{display:flex;align-items:center;gap:10px;padding:6px 10px 6px 6px;border-radius:12px;background:color-mix(in srgb,var(--bg2, #222) 82%,transparent)}.amd-cd>div{flex:1;min-width:0;display:flex;flex-direction:column}.amd-cd b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amd-cd span{font-size:12px;color:var(--dim)}
.stk-layer{position:fixed;inset:0;pointer-events:none;z-index:2}.stk{position:absolute;pointer-events:none;user-select:none;line-height:1;filter:drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 4px 8px rgba(0,0,0,.35))}
.stk-layer.editing{z-index:60}.stk-layer.editing .stk{pointer-events:auto;cursor:grab;outline:1px dashed rgba(255,255,255,.5);outline-offset:4px}.stk.drag{cursor:grabbing}
.stk-tray{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:61;width:min(560px,calc(100vw - 24px));background:var(--bg2, #222);color:var(--fg);border-radius:16px;padding:10px;box-shadow:0 10px 40px rgba(0,0,0,.4);display:grid;gap:8px}
.stk-tray[hidden]{display:none}.stk-pal{display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow:auto}.stk-pal button{font-size:26px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;cursor:pointer}.stk-pal button:hover{background:var(--bg3, rgba(127,127,127,.15))}
.stk-help{font-size:12px;color:var(--dim)}.stk-layer.editing .stk.cur{outline:2px solid var(--accent)}.stk-bar{display:flex;gap:6px;align-items:center}.stk-bar button{font:inherit;font-size:16px;min-width:40px;height:36px;border:0;border-radius:10px;background:var(--bg3, rgba(127,127,127,.15));color:var(--fg);cursor:pointer}
.stk-bar .stk-done{margin-left:auto;font-size:14px;}.stk-done{justify-self:end;font:inherit;font-weight:600;border:0;border-radius:10px;padding:7px 16px;background:var(--accent);color:#fff;cursor:pointer}`;
document.head.appendChild(css);

window.AnimeMore = { hub, daily, stickers, secret, secrets, spiderCheck, mochiCheck, makeTheme, palette, AL, chart, birthdays, countdowns, search, follow, follows, isFollowed, voiceActors, roles, guessPool,
  stations, play, radio:() => radio.now, quote, word, opening, season, QUOTES, OPENINGS, WORDS, TRIVIA, STICKERS, SECRETS, cosplay, cosAdd, cosDel, shrinkImg, when, left };
})();
