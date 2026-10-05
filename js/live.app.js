/* Webs Browser for iPhone - "live" (js/live.js) in the app: the cards at the top of the start page,
   the calling card, theme days, the owner's quote of the day, the wallpaper of the week, secret
   words and the code hunt in the address bar, special achievements, and which iPhones get a new
   version first (sw.js reads that from the "wsbmeta" cache before it installs one). */
"use strict";

(function () {
if (!window.Live) return;
// the server's address comes with updates (updates/iphone.json), the same way Web AI gets it
if (!Live.server()) fetch("updates/iphone.json?t=" + Date.now(), { cache:"no-store" }).then(r => r.ok ? r.json() : null).then(j => {
  const s = j && j.webai && String(j.webai.server || "").replace(/\/+$/, ""), code = j && j.webai && /^[A-Za-z0-9_-]{8,64}$/.test(j.webai.code || "") ? j.webai.code : "";
  if (s && /^https:\/\/[^\s/?#]+\.[^\s/?#]+$/i.test(s) && !Live.server()) { save("xaiConfig", code ? { server:s, code } : { server:s }); Live.refresh(true); }
}).catch(() => {});
// Customize → Show on the start page → From Webs
HIDE_KEYS.unshift(["live", "From Webs: news, polls and fun"]);
Live.init({ platform:"iphone", version:VERSION, isPrivate:() => PRIVATE, hidden:() => hidden("live"), toast, anime:() => { if (typeof SETACTIONS !== "undefined" && SETACTIONS.animeThemes) SETACTIONS.animeThemes(); },
  open:u => go({ u }, { newTab:true }), openReports:() => ACTIONS.support && ACTIONS.support(),
  onWall:() => { if (!(curTab() && curTab().u)) renderHome(); } });
const onHome = () => !(curTab() && curTab().u) && !$("#home").classList.contains("hide");

// the cards, right under the search box
$(".hero").insertAdjacentHTML("afterend", '<section id="liveSec" class="wsec"><div id="liveBox" class="lv-wrap lv-hide"></div></section>');
let fxAt = 0;
const paintCards = () => { Live.render($("#liveBox")); wshow("liveSec", !$("#liveBox").classList.contains("lv-hide")); };
HOME_HOOKS.push(() => {
  paintCards();
  if (!PRIVATE) {
    setTimeout(() => { if (onHome()) Live.callingCard(); }, 900);
    if (Date.now() - fxAt > 10 * 60000) { fxAt = Date.now(); setTimeout(() => { if (onHome()) Live.themeFx(); }, 1200); }
  }
  wallpaper();
});
Live.on(() => { if (onHome()) { paintCards(); Live.callingCard(); wallpaper(); } });

// the wallpaper of the week, for people who chose it (their own picture comes first)
function wallpaper() {
  if (PRIVATE || cfg.mbg || cfg.potd || !Live.wallOn()) return;
  const l = $("#bgl");
  l.style.backgroundImage = "url(" + JSON.stringify(Live.wallUrl()) + ")";
  l.style.setProperty("--dimv", (+cfg.bgDim || 20) / 100);
  document.body.classList.add("pic");
}

// the owner's quote of the day replaces the built-in one that day
const quoteBox0 = quoteBox;
quoteBox = function (step) {
  const q = !step && Live.quote();
  if (!q || PRIVATE || hidden("quote")) return quoteBox0(step);
  const box = $("#quoteBox");
  box.innerHTML = '<blockquote class="quote"><span class="qm">“</span><p></p><cite></cite><div class="qa2"><button type="button" class="wbtn" id="quoteNext">Another</button>' +
    '<button type="button" class="wbtn" id="quoteCopy">Copy</button></div></blockquote>';
  box.querySelector("p").textContent = q.text; box.querySelector("cite").textContent = q.by || "Webs";
  $("#quoteNext").onclick = () => quoteBox0(1);
  $("#quoteCopy").onclick = () => copyText("“" + q.text + "” - " + (q.by || "Webs"));
  wshow("quoteSec", true);
};

// secret words and the hunt's code: typed in the address bar instead of searched
let pass = false;
$("#omniForm").addEventListener("submit", async e => {
  if (pass) { pass = false; return; }
  const s = $("#q").value.trim(), D = Live.data();
  if (!s || s.length > 40 || /[./:]/.test(s) || !((D.secrets && D.secrets.length) || D.hunt)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const hit = await Live.secret(s);
  if (!hit) { pass = true; $("#omniForm").requestSubmit(); return; }
  $("#q").value = ""; closeOmni();
  toast(hit === "hunt" ? "🔍 You found the secret code!" : "🤫 You found a secret word!");
}, true);

// special achievements join the list
const achievements0 = achievements;
achievements = function () { return achievements0().concat(Live.achievements()); };
Live.on(() => { if ($("#sheet").dataset.kind === "ach" && !$("#sheet").classList.contains("hide")) openAch(); });

// which side of a gradual rollout this iPhone is on, for sw.js
try { caches.open("wsbmeta").then(c => c.put("meta", new Response(JSON.stringify({ b:Live.bucket(), server:Live.server(), at:Date.now() }), { headers:{ "content-type":"application/json" } }))).catch(() => {}); } catch (e) {}
})();
