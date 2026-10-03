/* Webs Browser - the Phantom calendar: a start page card in the style of Persona 5 (red, black and
   white, jagged shapes, cut-out letters). Today's date and weather, the time of day, this week with
   the days gone crossed off, and a deadline you set with the days left ("Take your time" without
   one). The pictures are drawn here (a mask, stars and a black cat); none of the game's own art is
   used, since it belongs to its makers.

   Shared by both apps: the iPhone start page (js/widgets.js) and the Windows new tab page (which
   windows/build.py builds with this file). Phantom.render(el, { animate }) draws it into el.
   Kept in localStorage: wsb.p5 = { label, date:"YYYY-MM-DD" }. It reads wsb.weather, which both
   apps keep the same way (Open-Meteo's weather code). */
(function () {
"use strict";
if (window.Phantom) return;
const KEY = "wsb.p5";
const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) {} };
const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const still = () => (typeof cfg !== "undefined" && cfg && cfg.motion === "off") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const md = d => (d.getMonth() + 1) + "/" + d.getDate();
const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// the time of day, the way the game's calendar names it (weekends have "Daytime")
function phase(d) {
  const hr = d.getHours(), weekday = d.getDay() > 0 && d.getDay() < 6;
  if (hr < 5) return "Late Night";
  if (hr < 8) return "Early Morning";
  if (hr >= 18) return "Evening";
  if (!weekday) return "Daytime";
  return hr < 12 ? "Morning" : hr < 13 ? "Lunchtime" : hr < 15 ? "Afternoon" : "After School";
}
// the weather both apps already fetched (a WMO code), if it's recent
function sky() {
  const w = read("wsb.weather");
  if (!w || typeof w.code !== "number" || !(Date.now() - (w.ts || 0) < 6 * 3600e3)) return null;
  const c = w.code, k = c <= 1 ? (w.day === 0 ? "moon" : "sun") : c <= 3 ? "cloud" : c <= 48 ? "fog" : c <= 67 || (c >= 80 && c <= 82) ? "rain" : c <= 77 || c === 85 || c === 86 ? "snow" : "storm";
  return { k, label:{ sun:"Sunny", moon:"Clear night", cloud:"Cloudy", fog:"Foggy", rain:"Rainy", snow:"Snowy", storm:"Stormy" }[k], t:typeof w.t === "number" ? Math.round(w.t) : null };
}

/* the pictures: drawn here, in the game's spirit */
const CLOUD = "M14 30a8 8 0 0 1 1-16 11 11 0 0 1 21-2 8 8 0 0 1 3 18z";
const WX = {
  sun:'<circle cx="24" cy="24" r="9"/><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" class="ln"/>',
  moon:'<path d="M30 6a18 18 0 1 0 12 26A14 14 0 0 1 30 6z"/>',
  cloud:'<path d="' + CLOUD + '" transform="translate(2 4)"/>',
  fog:'<path d="M6 16h30M10 24h32M6 32h28M14 40h24" class="ln"/>',
  rain:'<path d="' + CLOUD + '"/><path d="M14 36l-3 7M24 36l-3 7M34 36l-3 7" class="ln"/>',
  snow:'<path d="' + CLOUD + '"/><circle cx="13" cy="40" r="2.5"/><circle cx="24" cy="43" r="2.5"/><circle cx="35" cy="40" r="2.5"/>',
  storm:'<path d="' + CLOUD + '"/><path d="M26 30l-6 9h6l-4 8 10-11h-6l4-6z" class="bolt"/>'
};
const MASK = '<svg viewBox="0 0 120 52" class="p5mask" aria-hidden="true"><path fill-rule="evenodd" d="M2 4L24 10C34 8 46 12 54 18L60 22L66 18C74 12 86 8 96 10L118 4L112 24C110 38 98 46 84 44C74 43 68 38 62 35L60 34L58 35C52 38 46 43 36 44C22 46 10 38 8 24ZM24 24C28 18 40 18 46 25C40 30 30 30 24 24ZM74 25C80 18 92 18 96 24C90 30 80 30 74 25Z"/></svg>';
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L10 15.3 3.8 19l1.6-7.1L0 7.2l7.1-.6z"/></svg>';
const CAT = '<svg viewBox="0 0 80 62" class="p5cat" aria-hidden="true"><path class="hd" d="M8 62C5 42 9 28 14 21L10 2l19 13c8-3 15-3 23 0L71 2l-4 19c5 7 9 21 6 41z"/>' +
  '<ellipse class="e" cx="28" cy="35" rx="9" ry="10"/><ellipse class="e" cx="52" cy="35" rx="9" ry="10"/><circle class="p" cx="30" cy="37" r="4.5"/><circle class="p" cx="50" cy="37" r="4.5"/>' +
  '<path class="ns" d="M37 47l3 3 3-3z"/></svg>';

// cut-out letters, like a calling card: each one its own scrap of paper (the same scraps every time)
const TILT = [-6, 4, -3, 7, -5, 2, -8, 5];
function ransom(text, big) {
  let n = 0;
  const letter = ch => { if (!/[A-Za-z0-9]/.test(ch)) return '<span class="p5r p5p" aria-hidden="true">' + h(ch) + "</span>";
    const i = n++, v = (i * 7 + ch.charCodeAt(0)) % 5;
    return '<span class="p5r v' + v + '" style="--t:' + TILT[(i + ch.charCodeAt(0)) % TILT.length] + "deg;--i:" + i + '" aria-hidden="true">' + h(ch) + "</span>"; };
  return '<span class="p5ran' + (big ? " " + big : "") + '" aria-label="' + h(text) + '">' +
    String(text).split(" ").map(w => '<span class="p5wd2">' + [...w].map(letter).join("") + "</span>").join('<span class="p5sp"></span>') + "</span>";
}

/* drawing it */
function render(el, o) {
  o = o || {};
  if (!el) return;
  injectCSS();
  el.classList.add("p5host");
  if (el.dataset.edit === "1" && o.tick) return;           // not while the deadline is being edited
  const now = new Date(), today = midnight(now), st = read(KEY) || {}, due = parse(st.date);
  const days = due ? Math.round((due - today) / 864e5) : null, label = String(st.label || "").trim().slice(0, 30), w = sky(), ph = phase(now);
  const anim = o.animate && !still();

  let dl;
  if (el.dataset.edit === "1") {
    dl = '<form class="p5form"><label><span>Deadline</span><input name="l" maxlength="30" placeholder="Exams, a trip, a birthday…" value="' + h(label) + '"></label>' +
      '<label><span>Date</span><input name="d" type="date" required value="' + h(due ? st.date : "") + '" min="' + ymd(today) + '"></label>' +
      '<div class="p5btns"><button type="submit" class="ok">Save</button>' + (due ? '<button type="button" class="clr">Remove</button>' : "") + '<button type="button" class="no">Cancel</button></div></form>';
  } else if (!due) {
    dl = '<div class="p5none">' + ransom("TAKE YOUR TIME", "mid") + '<button type="button" class="p5set">' + STAR + "Set a deadline</button></div>";
  } else if (days > 0) {
    dl = '<div class="p5lbl"><i>DEADLINE</i><span>' + h(label || "The big day") + "</span><em>" + md(due) + '</em><button type="button" class="p5pen" title="Change the deadline" aria-label="Change the deadline">✎</button></div>' +
      '<div class="p5left">' + ransom(String(days), "big") + '<b class="p5dleft">' + (days === 1 ? "DAY<br>LEFT" : "DAYS<br>LEFT") + "</b></div>";
  } else if (days === 0) {
    dl = '<div class="p5today"><div class="p5card">' + ransom("IT'S TODAY") + "</div><span>" + h(label || "The big day") + '</span><button type="button" class="p5pen" title="Change the deadline" aria-label="Change the deadline">✎</button></div>';
  } else {
    dl = '<div class="p5lbl"><i>DEADLINE PASSED</i><span>' + h(label || "The big day") + "</span><em>" + md(due) + '</em></div><button type="button" class="p5set">' + STAR + "Set the next one</button>";
  }

  // this week: the days gone are crossed off, today has the star, the deadline is red
  let week = "";
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i), isDue = due && ymd(d) === ymd(due);
    week += '<div class="p5d' + (i < 0 ? " past" : i === 0 ? " now" : "") + (isDue ? " due" : "") + '" style="--i:' + (i + 3) + '"><i>' + WD[d.getDay()] + "</i><b>" + d.getDate() + "</b>" + (i === 0 ? STAR : "") + "</div>";
  }
  const say = now.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" }) + ". " + ph + "." + (w ? " " + w.label + "." : "") +
    (due ? days > 0 ? " " + (label || "The big day") + " in " + days + (days === 1 ? " day." : " days.") : days === 0 ? " " + (label || "The big day") + " is today." : "" : " Take your time.");

  el.innerHTML = '<div class="p5' + (anim ? " anim" : "") + '" role="group" aria-label="' + h(say) + '"><div class="p5slash"></div>' +
    '<div class="p5top"><div class="p5date"><div class="p5burst"></div><b class="p5md">' + md(now) + '</b><span class="p5wd">' + WD[now.getDay()] + "</span></div>" +
    '<div class="p5side">' + (w ? '<div class="p5wx" title="' + h(w.label) + '"><svg viewBox="0 0 48 48" aria-hidden="true">' + WX[w.k] + "</svg>" + (w.t != null ? "<em>" + w.t + "°</em>" : "") + "</div>" : "") + MASK + "</div></div>" +
    '<div class="p5phase"><span>' + h(ph) + "</span></div>" +
    '<div class="p5dl">' + dl + "</div>" +
    '<div class="p5week">' + week + "</div>" + CAT + "</div>";

  const q = s => el.querySelector(s);
  const edit = on => { if (on) el.dataset.edit = "1"; else delete el.dataset.edit; render(el, {}); if (on) { const i = q(".p5form input[name=l]"); if (i) i.focus(); } };
  el.querySelectorAll(".p5set,.p5pen").forEach(b => { b.onclick = e => { e.stopPropagation(); edit(true); }; });
  const f = q(".p5form");
  if (f) {
    f.onclick = e => e.stopPropagation();
    f.onsubmit = e => {
      e.preventDefault();
      const d = f.elements.d.value;
      if (!parse(d)) { f.elements.d.focus(); return; }
      write(KEY, { label:f.elements.l.value.trim().slice(0, 30), date:d });
      delete el.dataset.edit; render(el, { animate:true });
    };
    q(".p5form .no").onclick = () => edit(false);
    const clr = q(".p5form .clr");
    if (clr) clr.onclick = () => { write(KEY, null); edit(false); };
    f.onkeydown = e => { if (e.key === "Escape") edit(false); };
  }
}

/* how it looks */
let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement("style");
  s.id = "p5css";
  s.textContent = `
.p5{--r:#e5191c;--k:#0b0b0d;--w:#fff;--fa:"Futura","Futura PT","Avenir Next Condensed","Arial Black","Helvetica Neue",Arial,sans-serif;--fb:Georgia,"Times New Roman",serif;
  position:relative;overflow:hidden;border-radius:16px;background:var(--k);color:var(--w);padding:14px 16px 14px;min-height:220px;font-family:var(--fa);isolation:isolate;
  box-shadow:0 10px 30px -12px rgba(0,0,0,.7);user-select:none;-webkit-user-select:none}
.p5::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.09) 1.1px,transparent 1.6px);background-size:7px 7px;z-index:-1}
.p5slash{position:absolute;right:-70px;top:-60px;width:190px;height:420px;background:var(--r);transform:rotate(28deg);z-index:-1}
.p5slash::after{content:"";position:absolute;left:-14px;top:0;bottom:0;width:6px;background:var(--w)}
.p5top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.p5date{position:relative;display:flex;align-items:flex-end;gap:6px;padding:6px 10px 4px 6px}
.p5burst{position:absolute;left:-14px;top:-12px;right:-22px;bottom:-14px;background:var(--r);transform:rotate(-8deg);z-index:-1;
  clip-path:polygon(0 18%,12% 0,22% 14%,40% 2%,52% 16%,70% 0,80% 15%,100% 6%,92% 32%,100% 52%,88% 64%,98% 92%,74% 82%,60% 100%,46% 84%,26% 98%,18% 80%,0 90%,8% 60%,0 40%)}
.p5md{font-size:52px;line-height:.9;font-weight:900;font-style:italic;letter-spacing:-.02em;transform:rotate(-6deg) skewX(-6deg);display:inline-block;
  text-shadow:3px 3px 0 var(--k),-1px -1px 0 var(--k),1px -1px 0 var(--k),-1px 1px 0 var(--k)}
.p5wd{background:var(--w);color:var(--k);font-weight:900;font-size:17px;padding:2px 7px;transform:rotate(-6deg) skewX(-10deg);margin-bottom:4px;box-shadow:3px 3px 0 var(--k)}
.p5side{display:flex;align-items:center;gap:6px;margin-top:2px}
.p5wx{position:relative;width:44px;height:44px;border-radius:50%;background:var(--w);color:var(--k);display:grid;place-items:center;transform:rotate(8deg);box-shadow:3px 3px 0 var(--k)}
.p5wx svg{width:30px;height:30px;fill:var(--k)}.p5wx .ln{fill:none;stroke:var(--k);stroke-width:4;stroke-linecap:round}.p5wx .bolt{fill:var(--r)}
.p5wx em{position:absolute;bottom:-8px;right:-10px;background:var(--k);color:var(--w);font-style:normal;font-weight:900;font-size:11px;padding:1px 4px;transform:rotate(-8deg)}
.p5mask{width:66px;height:30px;fill:var(--w);transform:rotate(-10deg);filter:drop-shadow(3px 3px 0 var(--k))}
.p5phase{margin:10px 0 0 -4px}
.p5phase span{display:inline-block;background:var(--w);color:var(--k);font-weight:900;font-style:italic;text-transform:uppercase;font-size:14px;letter-spacing:.06em;padding:3px 14px 3px 10px;
  transform:skewX(-14deg) rotate(-2deg);box-shadow:4px 4px 0 var(--r)}
.p5dl{margin-top:12px;min-height:58px}
.p5lbl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.p5lbl i{background:var(--r);color:var(--w);font-style:normal;font-weight:900;font-size:11px;letter-spacing:.08em;padding:2px 7px;transform:skewX(-12deg)}
.p5lbl span{font-family:var(--fb);font-style:italic;font-size:18px;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p5lbl em{color:var(--w);opacity:.7;font-style:normal;font-weight:800;font-size:13px}
.p5left{display:flex;align-items:center;gap:10px;margin-top:6px}
.p5dleft{font-weight:900;font-style:italic;font-size:14px;line-height:1;letter-spacing:.04em;color:var(--w);transform:rotate(-4deg)}
.p5ran{display:inline-flex;flex-wrap:wrap;align-items:center;gap:1px 0}
.p5r{display:inline-block;padding:0 .14em;margin:0 .03em;line-height:1.08;font-size:17px;transform:rotate(var(--t));box-shadow:2px 2px 0 rgba(0,0,0,.6)}
.p5ran.big .p5r{font-size:30px}.p5ran.mid .p5r{font-size:22px}
.p5wd2{display:inline-flex;white-space:nowrap}
.p5sp{display:inline-block;width:.45em}
.p5r.p5p{background:none;box-shadow:none;padding:0;margin:0 -.04em;color:var(--w);font-weight:900}
.p5r.v0{background:var(--w);color:var(--k);font-family:var(--fb);font-weight:700}
.p5r.v1{background:var(--r);color:var(--w);font-weight:900;font-style:italic}
.p5r.v2{background:var(--k);color:var(--w);font-weight:900;outline:2px solid var(--w);outline-offset:-2px}
.p5r.v3{background:var(--w);color:var(--r);font-family:"Courier New",Courier,monospace;font-weight:700}
.p5r.v4{background:#f2e9dc;color:var(--k);font-family:var(--fb);font-style:italic;font-weight:700}
.p5none{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.p5set,.p5pen,.p5btns button{font:inherit;cursor:pointer;border:0}
.p5set{display:inline-flex;align-items:center;gap:6px;background:var(--w);color:var(--k);font-weight:900;font-style:italic;font-size:13px;padding:6px 12px;transform:skewX(-10deg);box-shadow:3px 3px 0 var(--r)}
.p5set svg{width:14px;height:14px;fill:var(--r)}
.p5pen{background:transparent;color:var(--w);font-size:16px;padding:2px 6px;margin-left:auto;opacity:.85}
.p5today{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.p5card{background:var(--r);padding:8px 10px;transform:rotate(-4deg);box-shadow:4px 4px 0 var(--w)}
.p5today span{font-family:var(--fb);font-style:italic;font-size:20px}
.p5week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:12px;position:relative;z-index:1;max-width:calc(100% - 46px)}
.p5d{position:relative;background:#1d1c21;text-align:center;padding:4px 0 3px;clip-path:polygon(6% 0,100% 5%,94% 100%,0 95%)}
.p5d i{display:block;font-style:normal;font-size:9px;font-weight:900;letter-spacing:.06em;opacity:.75}
.p5d b{display:block;font-size:16px;font-weight:900;font-style:italic;line-height:1.1}
.p5d.past b,.p5d.past i{opacity:.45}
.p5d.past::after{content:"";position:absolute;inset:3px 6px;background:linear-gradient(45deg,transparent 44%,var(--r) 44%,var(--r) 56%,transparent 56%),linear-gradient(-45deg,transparent 44%,var(--r) 44%,var(--r) 56%,transparent 56%)}
.p5d.now{background:var(--w);color:var(--k);transform:scale(1.1) rotate(-3deg);clip-path:none;box-shadow:3px 3px 0 var(--r)}
.p5d.now svg{position:absolute;top:-7px;right:-6px;width:15px;height:15px;fill:var(--r)}
.p5d.due{background:var(--r)}
.p5d.due::before{content:"!";position:absolute;top:0;right:4px;font-weight:900;font-size:11px}
.p5cat{position:absolute;right:-2px;bottom:-4px;width:58px;height:46px;z-index:0}
.p5cat .hd{fill:var(--k);stroke:var(--w);stroke-width:2.5}.p5cat .e{fill:#ffd21f}.p5cat .p{fill:var(--k)}.p5cat .ns{fill:var(--r)}
.p5form{display:grid;gap:8px}
.p5form label{display:flex;align-items:center;gap:8px}
.p5form label span{width:66px;font-weight:900;font-style:italic;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.p5form input{flex:1;min-width:0;font:16px var(--fb);font-style:italic;background:var(--w);color:var(--k);border:0;padding:6px 8px;transform:skewX(-6deg);outline:none;box-shadow:3px 3px 0 var(--r)}
.p5form input[type=date]{font-style:normal;font-family:inherit;font-weight:700}
.p5btns{display:flex;gap:8px;margin-top:2px}
.p5btns button{font-weight:900;font-style:italic;font-size:13px;padding:6px 14px;transform:skewX(-10deg);background:#2a282f;color:var(--w)}
.p5btns .ok{background:var(--r)}
.p5 button:focus-visible{outline:2px solid #ffd21f;outline-offset:2px}
/* on a wide page (the Windows new tab): the week gets a column of its own */
.p5host{container:p5/inline-size}
@container p5 (min-width:600px){
  .p5{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);column-gap:26px;align-items:start;min-height:230px;padding:22px 26px 18px}
  .p5md{font-size:66px}.p5wd{font-size:20px}.p5phase span{font-size:16px}
  .p5ran.big .p5r{font-size:38px}.p5ran.mid .p5r{font-size:26px}.p5dleft{font-size:17px}.p5lbl span{font-size:21px}
  .p5wx{width:52px;height:52px}.p5wx svg{width:34px;height:34px}.p5mask{width:84px;height:38px}.p5cat{width:70px;height:56px}
  .p5top,.p5phase,.p5dl{grid-column:1}
  .p5week{grid-column:2;grid-row:1/span 3;align-self:center;max-width:none;margin:0 0 34px}
  .p5d b{font-size:20px}.p5d i{font-size:10px}
}
/* the arrival: the date slams in, the days gone are stamped out, the cat peeks up */
.p5.anim .p5burst{animation:p5burst .45s cubic-bezier(.2,1.6,.4,1) both}
.p5.anim .p5md{animation:p5slam .5s cubic-bezier(.2,1.4,.4,1) .08s both}
.p5.anim .p5wd{animation:p5in .3s ease-out .35s both}
.p5.anim .p5phase span{animation:p5slide .4s cubic-bezier(.2,1.2,.4,1) .3s both}
.p5.anim .p5r{animation:p5pop .32s cubic-bezier(.2,1.6,.4,1) both;animation-delay:calc(.45s + var(--i) * 45ms)}
.p5.anim .p5d.past::after{animation:p5stamp .28s ease-out both;animation-delay:calc(.55s + var(--i) * 90ms)}
.p5.anim .p5d.now{animation:p5now .45s cubic-bezier(.2,1.6,.4,1) .9s both}
.p5.anim .p5cat{animation:p5peek .6s cubic-bezier(.2,1.4,.4,1) 1.1s both}
.p5.anim .p5mask{animation:p5in .4s ease-out .5s both}
@keyframes p5burst{from{transform:scale(0) rotate(-60deg)}to{transform:rotate(-8deg)}}
@keyframes p5slam{0%{transform:scale(2.4) rotate(-24deg);opacity:0}100%{transform:rotate(-6deg) skewX(-6deg);opacity:1}}
@keyframes p5in{from{opacity:0;translate:0 -10px}to{opacity:1;translate:0 0}}
@keyframes p5slide{from{transform:translateX(-130%) skewX(-14deg) rotate(-2deg)}to{transform:skewX(-14deg) rotate(-2deg)}}
@keyframes p5pop{from{transform:scale(0) rotate(30deg);opacity:0}to{transform:rotate(var(--t));opacity:1}}
@keyframes p5stamp{from{transform:scale(2.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes p5now{from{transform:scale(.4) rotate(20deg);opacity:0}to{transform:scale(1.1) rotate(-3deg);opacity:1}}
@keyframes p5peek{from{transform:translateY(80%)}to{transform:translateY(0)}}
`;
  document.head.appendChild(s);
}

window.Phantom = { render, phase };
})();
