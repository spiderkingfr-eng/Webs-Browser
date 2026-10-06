/* Webs Browser - Mochi, a little companion in the corner of the start page (iPhone 2.9, Windows 3.10). Drawn
   here by code. Its eyes follow you, it blinks, it bounces when you poke it and says something (about the
   time of day, your streak, your level, a game to try), it cheers when you get XP, it sleeps at night,
   and it grows with your level (js/xp.js): antennae at 5, wings at 10, a crown at 15, a glow at 20.
   Buddy.mount({ bottom, right, hidden }) / Buddy.unmount(); nothing it does leaves this device.
   3.14 / 2.11 (#060): outfits. By itself Mochi dresses for the season (a witch's hat in October, a Santa hat in
   December, a scarf when it's cold, sunglasses in summer, a flower in spring, a party hat for the new year), or
   you pick one: Buddy.OUTFITS, Buddy.outfit() (what it's wearing now), Buddy.setOutfit("auto" | "none" | id),
   Buddy.preview(id) (a picture of it, as SVG). wsb.buddyOutfit keeps the choice. */
(function () {
"use strict";
if (window.Buddy) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
let el = null, timers = [], said = 0, sleepy = false;
// [id, name, emoji, hat (instead of the crown), over the body, months it's worn by itself (1-12)]
const OUTFITS = [
  ["witch", "Witch's hat", "🎃", true, '<ellipse cx="50" cy="31" rx="30" ry="5" fill="#2b1d3a"/><path d="M35 31L54 1 67 31z" fill="#2b1d3a"/><path d="M38 26h28v4H37z" fill="#ff7a1a"/>', [10]],
  ["santa", "Santa hat", "🎅", true, '<path d="M30 33Q44 2 77 9Q70 21 70 33z" fill="#d6262b"/><rect x="26" y="28" width="48" height="9" rx="4.5" fill="#fff"/><circle cx="78" cy="10" r="5.5" fill="#fff"/>', [12]],
  ["scarf", "Cozy scarf", "🧣", false, '<path d="M21 73q29 13 58 0v9q-29 13-58 0z" fill="#3a7bd5"/><path d="M63 80l3 15h9l-3-16z" fill="#2f63ad"/><path d="M27 77q23 9 46 0" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity=".6"/>', [1, 2, 11]],
  ["sakura", "Cherry blossom", "🌸", false, '<g transform="translate(70 31)">' + [0, 72, 144, 216, 288].map(a => '<ellipse cx="0" cy="-6" rx="4.4" ry="6.5" fill="#ffc2d8" transform="rotate(' + a + ')"/>').join("") + '<circle r="2.6" fill="#ff7aa8"/></g>', [3, 4]],
  ["shades", "Sunglasses", "😎", false, '<rect x="28" y="47" width="19" height="12" rx="5" fill="#16121c"/><rect x="53" y="47" width="19" height="12" rx="5" fill="#16121c"/><path d="M47 51h6" stroke="#16121c" stroke-width="2.5"/><path d="M31 50l5-1" stroke="#fff" stroke-width="1.6" opacity=".5"/>', [6, 7, 8]],
  ["party", "Party hat", "🎉", true, '<path d="M40 31L52 3 63 31z" fill="#ffd34d"/><path d="M44 22l15-5M47 13l9-3" stroke="#ff5c93" stroke-width="2.4"/><circle cx="52" cy="3" r="3.5" fill="#ff5c93"/>', []],
  ["band", "Ninja headband", "🍥", false, '<path d="M17 41q33-11 66 0v8q-33-11-66 0z" fill="#2a2f45"/><rect x="40" y="35.5" width="20" height="10" rx="2" fill="#c3cad6"/><path d="M46 40.5h8" stroke="#6b7385" stroke-width="1.5"/><path d="M82 43l13 5-12 3z" fill="#2a2f45"/>', []],
  ["bow", "Big bow", "🎀", false, '<path d="M50 30l-14-8v16zM50 30l14-8v16z" fill="#ff5c93"/><circle cx="50" cy="30" r="4" fill="#e23d7a"/>', []],
  ["cat", "Cat ears", "🐱", true, '<path d="M24 38l4-22 14 12zM76 38l-4-22-14 12z" fill="var(--bd2,#8a1810)"/><path d="M28 32l2-10 7 6zM72 32l-2-10-7 6z" fill="#ff8fb0"/>', []]
];
const outfitPick = () => { const v = get("buddyOutfit", "auto"); return v === "none" || OUTFITS.some(o => o[0] === v) ? v : "auto"; };
function outfit(d) {
  const v = outfitPick(); if (v !== "auto") return v === "none" ? "" : v;
  d = d || new Date();
  if (d.getMonth() === 0 && d.getDate() <= 3) return "party";
  const o = OUTFITS.find(x => x[5].indexOf(d.getMonth() + 1) >= 0); return o ? o[0] : "";
}
const level = () => window.XP ? XP.info().level : 1;
const stage = () => { const L = level(); return L >= 20 ? 4 : L >= 15 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0; };
function svg(wear, st) {
  if (st == null) st = stage();
  const of = OUTFITS.find(o => o[0] === (wear == null ? outfit() : wear));
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="bdB" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/>' +
    '<stop offset=".35" stop-color="var(--bd,#e8342a)"/><stop offset="1" stop-color="var(--bd2,#8a1810)"/></radialGradient></defs>' +
    (st >= 4 ? '<circle class="bd-aura" cx="50" cy="56" r="44" fill="var(--bd,#e8342a)" opacity=".18"/>' : "") +
    (st >= 2 ? '<g class="bd-wings"><path d="M18 52C2 40 2 22 14 26c6 2 10 12 12 22z" fill="#fff" opacity=".85"/><path d="M82 52C98 40 98 22 86 26c-6 2-10 12-12 22z" fill="#fff" opacity=".85"/></g>' : "") +
    (st >= 1 ? '<g class="bd-ant" stroke="var(--bd2,#8a1810)" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M40 26C36 16 32 12 28 11"/><path d="M60 26C64 16 68 12 72 11"/>' +
      '<circle cx="28" cy="11" r="3.5" fill="var(--bd,#e8342a)" stroke="none"/><circle cx="72" cy="11" r="3.5" fill="var(--bd,#e8342a)" stroke="none"/></g>' : "") +
    '<ellipse cx="50" cy="92" rx="22" ry="4" fill="rgba(0,0,0,.25)" class="bd-sh"/>' +
    '<g class="bd-body"><ellipse cx="50" cy="58" rx="34" ry="31" fill="url(#bdB)"/>' +
    '<ellipse cx="38" cy="88" rx="7" ry="4" fill="var(--bd2,#8a1810)"/><ellipse cx="62" cy="88" rx="7" ry="4" fill="var(--bd2,#8a1810)"/>' +
    '<g class="bd-eyes"><g class="bd-eye"><ellipse cx="38" cy="54" rx="6.5" ry="8" fill="#fff"/><circle class="bd-p" cx="38" cy="55" r="3.6" fill="#1b1220"/><circle cx="36.6" cy="53" r="1.2" fill="#fff"/></g>' +
    '<g class="bd-eye"><ellipse cx="62" cy="54" rx="6.5" ry="8" fill="#fff"/><circle class="bd-p" cx="62" cy="55" r="3.6" fill="#1b1220"/><circle cx="60.6" cy="53" r="1.2" fill="#fff"/></g></g>' +
    '<path class="bd-zz" d="M37 55h8M55 55h8" stroke="#1b1220" stroke-width="2.5" stroke-linecap="round"/>' +
    '<ellipse cx="29" cy="66" rx="5" ry="3" fill="#ff8fb0" opacity=".55"/><ellipse cx="71" cy="66" rx="5" ry="3" fill="#ff8fb0" opacity=".55"/>' +
    '<path class="bd-m" d="M45 68q5 5 10 0" stroke="#1b1220" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + (of ? '<g class="bd-of">' + of[4] + "</g>" : "") + "</g>" +
    (st >= 3 && !(of && of[3]) ? '<path class="bd-crown" d="M36 30l4-12 6 8 4-10 4 10 6-8 4 12z" fill="#f5c242" stroke="#b8862b" stroke-width="1.2"/>' : "") + "</svg>";
}
function lines() {
  const h = new Date().getHours(), x = window.XP ? XP.info() : null, s = window.XP ? XP.read() : {}, out = [];
  out.push(h < 5 ? "It's so late… are you sleeping soon?" : h < 12 ? "Good morning! ☀️" : h < 18 ? "Good afternoon!" : "Good evening! 🌙");
  if (s.streak > 1) out.push("Day " + s.streak + " in a row! 🔥");
  if (x) out.push("You're level " + x.level + ". " + (x.need - x.into) + " XP to go!");
  const of = OUTFITS.find(o => o[0] === outfit());
  if (of) out.push({ witch:"Boo! 🎃 Do you like my hat?", santa:"Ho ho ho! 🎄", scarf:"Brr… good thing I have my scarf. 🧣", sakura:"The cherry blossoms are out! 🌸", shades:"Too cool. 😎", party:"Happy new year! 🎉",
    band:"Believe it! 🍥", bow:"Do you like my bow? 🎀", cat:"Nyaa~ 🐱" }[of[0]]);
  out.push("Have you tried Sudoku? 🔢", "A game of chess? ♟️", "Psst… a little spider hides in the anime wallpaper. 🕷", "Drink some water! 💧", "I like it here.", "Boop!", "Blocks is fun. Just one more game…",
    "Take a little break? Look at something far away for a moment. 👀", "You're doing great.");
  return out;
}
function say(text, ms) {
  if (!el) return;
  const b = el.querySelector(".bd-say");
  b.textContent = text; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("on"), ms || 3800);
  said = Date.now();
}
function hop(cls) { if (!el) return; el.classList.remove("hop", "cheer"); void el.offsetWidth; el.classList.add(cls || "hop"); }
function paint() {
  if (!el) return;
  el.querySelector(".bd-art").innerHTML = svg();
  el.dataset.stage = stage();
}
function look(e) {
  if (!el || sleepy) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = Math.atan2(e.clientY - cy, e.clientX - cx), d = Math.min(2.2, Math.hypot(e.clientX - cx, e.clientY - cy) / 60);
  el.querySelectorAll(".bd-p").forEach(p => { p.style.transform = "translate(" + (Math.cos(a) * d).toFixed(2) + "px," + (Math.sin(a) * d).toFixed(2) + "px)"; });
}
function mood() {
  if (!el) return;
  const h = new Date().getHours();
  sleepy = (h >= 23 || h < 6) && Date.now() - said > 20000;
  el.classList.toggle("sleep", sleepy);
}
function mount(opt) {
  opt = opt || {};
  unmount();
  if (opt.hidden || /[?&]private=1/.test(location.search)) return;
  el = document.createElement("div");
  el.className = "bd"; el.setAttribute("role", "button"); el.setAttribute("aria-label", "Mochi, your companion"); el.tabIndex = 0;
  el.style.setProperty("--bd-b", (opt.bottom || 18) + "px"); el.style.setProperty("--bd-r", (opt.right || 18) + "px");
  el.innerHTML = '<div class="bd-say" role="status"></div><div class="bd-art"></div><i class="bd-z">z</i><i class="bd-z z2">z</i>';
  (opt.parent || document.body).appendChild(el);
  paint();
  const poke = () => { sleepy = false; el.classList.remove("sleep"); hop(); const l = lines(); say(l[Math.floor(Math.random() * l.length)]); const n = get("buddyPokes", 0) + 1; put("buddyPokes", n); if (n === 25) say("We're friends now! 💖", 4500); if (n >= 50 && window.AnimeMore) AnimeMore.mochiCheck(); };
  el.addEventListener("click", poke);
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
  addEventListener("pointermove", look, { passive:true });
  const onXp = e => { paint(); hop("cheer"); const d = e.detail || {}; say(d.up ? "Level " + d.level + "! 🎉" : "Yay! ✨", 2600); };
  document.addEventListener("wsb-xp", onXp);
  const onStore = e => { if (e.key === "wsb.buddyOutfit") { paint(); hop(); } };      // a new outfit, picked somewhere else
  addEventListener("storage", onStore);
  el._off = () => { removeEventListener("pointermove", look); document.removeEventListener("wsb-xp", onXp); removeEventListener("storage", onStore); };
  // hello, now and then a word, and sleep at night
  const last = get("buddySeen", 0), away = last && Date.now() - last > 3 * 864e5;
  put("buddySeen", Date.now());
  timers.push(setTimeout(() => { say(away ? "I missed you! 💗" : lines()[0], 4200); hop(); }, 1400));
  timers.push(setInterval(() => { if (!document.hidden && !sleepy && Date.now() - said > 150000 && Math.random() < .5) { const l = lines(); say(l[Math.floor(Math.random() * l.length)]); } }, 60000));
  timers.push(setInterval(mood, 30000)); mood();
  timers.push(setInterval(() => { if (el && !sleepy) { el.classList.add("blink"); setTimeout(() => el && el.classList.remove("blink"), 160); } }, 3800));
}
function unmount() { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = []; if (el) { if (el._off) el._off(); el.remove(); } el = null; }

const st = document.createElement("style");
st.textContent = `
.bd{position:fixed;right:var(--bd-r);bottom:calc(var(--bd-b) + env(safe-area-inset-bottom,0px));width:64px;height:64px;z-index:50;cursor:pointer;--bd:var(--accent,#e8342a);--bd2:color-mix(in srgb,var(--accent,#e8342a) 55%,#000);-webkit-tap-highlight-color:transparent;outline:0}
.bd[data-stage="1"]{width:68px;height:68px}.bd[data-stage="2"],.bd[data-stage="3"]{width:74px;height:74px}.bd[data-stage="4"]{width:80px;height:80px}
.bd-art,.bd-art svg{width:100%;height:100%;display:block;overflow:visible}
.bd-body{transform-origin:50% 90%;animation:bdBob 2.6s ease-in-out infinite}
.bd.hop .bd-body{animation:bdHop .6s cubic-bezier(.3,1.6,.5,1)}.bd.cheer .bd-body{animation:bdCheer .9s cubic-bezier(.3,1.6,.5,1)}
.bd-wings path{transform-origin:50% 50%;animation:bdFlap 1.2s ease-in-out infinite}.bd-aura{animation:bdAura 3s ease-in-out infinite;transform-origin:50% 56%}
.bd-p{transition:transform .15s}.bd-zz{display:none}
.bd.blink .bd-eye{transform:scaleY(.1);transform-origin:50% 54px}
.bd.sleep .bd-eyes{display:none}.bd.sleep .bd-zz{display:block}.bd.sleep .bd-m{d:path("M46 69q4 2 8 0")}.bd.sleep .bd-body{animation:bdBreath 4s ease-in-out infinite}
.bd-z{position:absolute;right:2px;top:-4px;font:800 14px system-ui,sans-serif;color:var(--fg,#fff);opacity:0;font-style:normal;pointer-events:none}
.bd.sleep .bd-z{animation:bdZ 3s ease-in-out infinite}.bd.sleep .bd-z.z2{animation-delay:1.5s;right:-8px}
.bd-say{position:absolute;right:58px;bottom:56px;max-width:220px;width:max-content;padding:8px 12px;border-radius:14px 14px 4px 14px;background:var(--bg2,#1e1a24);color:var(--fg,#f3eff1);
  border:1px solid var(--line,#322c3c);font:600 12.5px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.3);opacity:0;transform:translateY(6px) scale(.95);transition:opacity .25s,transform .25s;pointer-events:none}
.bd-say.on{opacity:1;transform:none}
@keyframes bdBob{50%{transform:translateY(-3px) scaleY(1.02)}}@keyframes bdBreath{50%{transform:scaleY(.96)}}
@keyframes bdHop{30%{transform:translateY(-16px) scale(1.05,.95)}60%{transform:translateY(0) scale(1.08,.9)}}
@keyframes bdCheer{20%{transform:translateY(-18px) rotate(-8deg)}45%{transform:translateY(-6px) rotate(8deg)}70%{transform:translateY(-12px) rotate(-4deg)}}
@keyframes bdFlap{50%{transform:scaleY(.8)}}@keyframes bdAura{50%{opacity:.32;transform:scale(1.06)}}@keyframes bdZ{0%{opacity:0;transform:translate(0,4px)}30%{opacity:.8}100%{opacity:0;transform:translate(10px,-18px)}}
:root[data-motion="off"] .bd *{animation:none!important}
`;
document.head.appendChild(st);
window.Buddy = { mount, unmount, say, hop, on:() => !!el, OUTFITS:OUTFITS.map(o => ({ id:o[0], name:o[1], e:o[2], months:o[5].slice() })), outfit, outfitPick,
  setOutfit(v) { put("buddyOutfit", v === "none" || OUTFITS.some(o => o[0] === v) ? v : "auto"); paint(); hop(); },
  preview:(id, st) => svg(id || "", st == null ? 0 : st) };
})();
