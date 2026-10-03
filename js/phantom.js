/* Webs Browser - the Phantom calendar: a start page card in the style of a Persona 5 phone theme.
   A peach sky over a grey city, star-patterned ground, and five days in a V with today big in the
   middle, a dagger stabbed into it (Saturday in cyan, Sunday in red). An alarm clock shows the time
   of day the way the game names it, with the weather. A "Q" poll underneath shows the deadline you
   set (the days left), or the battery, or how much of today is left. Your own pictures (any you
   add) stand on the right as stickers; they stay on this device and nothing else is sent anywhere.
   The art here is drawn in SVG; none of the game's own pictures are used, since they belong to
   its makers.

   Shared by both apps: the iPhone start page (js/widgets.js) and the Windows new tab page (which
   windows/build.py builds with this file). Phantom.render(el, { animate }) draws it into el;
   { tick:true } redraws it quietly (and not while it's being edited).
   Kept in localStorage: wsb.p5 = { label, date:"YYYY-MM-DD", set }, wsb.p5pics = [data: URLs].
   It reads wsb.weather, which both apps keep the same way (Open-Meteo's weather code). */
(function () {
"use strict";
if (window.Phantom) return;
const KEY = "wsb.p5", PICS = "wsb.p5pics", MAX_PICS = 4;
const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const still = () => (typeof cfg !== "undefined" && cfg && cfg.motion === "off") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayNo = d => Math.floor(midnight(d).getTime() / 864e5);
const DAYNAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const pictures = () => (read(PICS) || []).filter(p => typeof p === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p)).slice(0, MAX_PICS);

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
// the battery, where the computer has one (a desktop says "always full and charging": that counts as none)
let bat = null, batAsked = false;
function battery(el) {
  if (batAsked || !navigator.getBattery) return;
  batAsked = true;
  navigator.getBattery().then(b => {
    const upd = () => { bat = b.charging && b.level >= 1 && !b.chargingTime ? null : { level:b.level, charging:b.charging }; };
    upd();
    b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd);
    if (el && el.isConnected) render(el, { tick:true });
  }).catch(() => {});
}

/* the pictures, drawn here */
const CLOUDP = "M14 30a8 8 0 0 1 1-16 11 11 0 0 1 21-2 8 8 0 0 1 3 18z";
const WX = {
  sun:'<circle cx="24" cy="24" r="9"/><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" class="ln"/>',
  moon:'<path d="M30 6a18 18 0 1 0 12 26A14 14 0 0 1 30 6z"/>',
  cloud:'<path d="' + CLOUDP + '" transform="translate(2 4)"/>',
  fog:'<path d="M6 16h30M10 24h32M6 32h28M14 40h24" class="ln"/>',
  rain:'<path d="' + CLOUDP + '"/><path d="M14 36l-3 7M24 36l-3 7M34 36l-3 7" class="ln"/>',
  snow:'<path d="' + CLOUDP + '"/><circle cx="13" cy="40" r="2.5"/><circle cx="24" cy="43" r="2.5"/><circle cx="35" cy="40" r="2.5"/>',
  storm:'<path d="' + CLOUDP + '"/><path d="M26 30l-6 9h6l-4 8 10-11h-6l4-6z" class="bolt"/>'
};
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L10 15.3 3.8 19l1.6-7.1L0 7.2l7.1-.6z"/></svg>';
const DAGGER = '<svg class="p5dag" viewBox="0 0 30 110" aria-hidden="true"><path d="M15 108L8 46h14z" fill="#eef0f3" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 102V50" stroke="#a9aeb6" stroke-width="2"/>' +
  '<rect x="2" y="40" width="26" height="7" rx="2" fill="#2a2a2e" stroke="#000" stroke-width="2"/><rect x="10" y="9" width="10" height="32" rx="3" fill="#3a3a40" stroke="#000" stroke-width="2"/>' +
  '<path d="M10 15h10M10 21h10M10 27h10M10 33h10" stroke="#fff" stroke-width="1.5"/><circle cx="15" cy="6" r="5" fill="#e5191c" stroke="#000" stroke-width="2"/></svg>';
const CLOUD = c => '<svg class="p5cl ' + c + '" viewBox="0 0 100 50" aria-hidden="true"><path d="M12 46a10 10 0 0 1 2-19 14 14 0 0 1 24-12 16 16 0 0 1 28 2 12 12 0 0 1 20 9 10 10 0 0 1 2 20z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M24 38c8 3 18 3 26 0M58 40c6 2 13 2 18-1" fill="none" stroke="#c9c4c7" stroke-width="3" stroke-linecap="round"/></svg>';
const CLOCK = '<svg class="p5clk" viewBox="0 0 48 50" aria-hidden="true"><path d="M5 14a9 9 0 0 1 12-8zM43 14a9 9 0 0 0-12-8z" fill="#e5191c" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M14 42l-5 6M34 42l5 6" stroke="#000" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="28" r="16" fill="#fff" stroke="#000" stroke-width="3.5"/>' +
  '<path d="M24 18v10l7 5" stroke="#e5191c" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="28" r="2" fill="#000"/></svg>';
const CAT = '<svg viewBox="0 0 80 62" class="p5cat" aria-hidden="true"><path class="hd" d="M8 62C5 42 9 28 14 21L10 2l19 13c8-3 15-3 23 0L71 2l-4 19c5 7 9 21 6 41z"/>' +
  '<ellipse class="e" cx="28" cy="35" rx="9" ry="10"/><ellipse class="e" cx="52" cy="35" rx="9" ry="10"/><circle class="p" cx="30" cy="37" r="4.5"/><circle class="p" cx="50" cy="37" r="4.5"/>' +
  '<path class="ns" d="M37 47l3 3 3-3z"/></svg>';
// the city: two rows of buildings (the same every time), lit windows, and a radio tower
const CITY = (() => {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, f = n => n.toFixed(1);
  let far = "", near = "";
  for (let x = -10; x < 810;) {
    const w = 14 + rnd() * 26, ht = 55 + rnd() * 95;
    far += '<rect x="' + f(x) + '" y="' + f(160 - ht) + '" width="' + f(w) + '" height="' + f(ht) + '"/>';
    if (rnd() < .3) far += '<rect x="' + f(x + w / 2 - 1) + '" y="' + f(160 - ht - 12) + '" width="2" height="12"/>';
    x += w - 3;
  }
  for (let x = -10; x < 810;) {
    const w = 18 + rnd() * 32, ht = 28 + rnd() * 62;
    near += '<rect x="' + f(x) + '" y="' + f(160 - ht) + '" width="' + f(w) + '" height="' + f(ht) + '"/>';
    x += w + rnd() * 5;
  }
  const tower = '<g fill="#8b8285" stroke="#8b8285"><path d="M392 160L401 22L410 160z"/><path d="M401 22V4" stroke-width="2"/>' +
    '<path d="M395 120h12M397 85h8M399 55h4" stroke="#a89ea1" stroke-width="3"/></g>';
  return '<svg class="p5city" viewBox="0 0 800 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><pattern id="p5win" width="7" height="9" patternUnits="userSpaceOnUse">' +
    '<rect x="2" y="2" width="3" height="4" fill="#857c80"/></pattern></defs><g fill="#a99fa2">' + far + "</g>" + tower + '<g fill="#5b5458">' + near + '</g><g fill="url(#p5win)">' + near + "</g></svg>";
})();

/* the poll under the days: the deadline, else the battery, else how much of today is left */
function poll(now, st, due, days, label) {
  const L = "<em>" + h(label) + "</em>";
  if (due && days > 0) {
    const set = +st.set || 0, total = set && due - set > 0 ? due - set : 0;
    const used = total ? Math.min(1, Math.max(.03, (now - set) / total)) : .05;
    return { q:"Will you be ready for " + L + "?", bar:used, num:days + (days === 1 ? " DAY" : " DAYS"),
      anon:days >= 14 ? "eh, you've got time" : days >= 4 ? "better get moving..." : "it's crunch time!!" };
  }
  if (due && days === 0) return { q:"Is today the day? " + L, bar:1, num:"TODAY!", anon:"go get 'em." };
  if (due) return { q:"So... how did " + L + " go?", bar:1, num:"DONE", anon:"set the next one? tap ✎" };
  if (bat) {
    const p = (Math.round(bat.level * 1000) / 10).toFixed(1), ok = bat.charging || bat.level >= .2;
    return { q:"Do you have enough <em>battery life</em>?", bar:bat.level, num:(ok ? "YES " : "NO ") + p + "%",
      anon:bat.charging ? "it's charging, relax" : bat.level >= .5 ? "eh, you're fine" : bat.level >= .2 ? "might wanna plug in soon" : "PLUG IT IN!!" };
  }
  const left = Math.max(0, 1 - (now - midnight(now)) / 864e5), hr = now.getHours();
  return { q:"How much of <em>today</em> is left?", bar:left, num:(left * 100).toFixed(1) + "%",
    anon:hr < 12 ? "the day's young. take your time" : hr < 18 ? "plenty left. take your time" : "almost over. take your time" };
}

/* drawing it */
function render(el, o) {
  o = o || {};
  if (!el) return;
  injectCSS();
  el.classList.add("p5host");
  battery(el);
  const editing = el.dataset.edit === "1";
  if (editing && o.tick) return;                            // not while the deadline or pictures are being edited
  const now = new Date(), today = midnight(now), st = read(KEY) || {}, due = parse(st.date);
  const days = due ? Math.round((due - today) / 864e5) : null, label = String(st.label || "").trim().slice(0, 30) || "the big day";
  const w = sky(), ph = phase(now), pics = pictures(), pq = poll(now, st, due, days, label);
  const pick = pics.length ? ((+el.dataset.pic || 0) + dayNo(now)) % pics.length : -1;     // a different one each day; a tap shows the next
  const anim = o.animate && !still();

  // five days in a V: two gone, today (with the dagger), two to come
  let row = "";
  for (let i = -2; i <= 2; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i), wd = d.getDay(), isDue = due && ymd(d) === ymd(due);
    row += '<div class="p5day s' + (i + 2) + (i === 0 ? " now" : i < 0 ? " past" : "") + '" style="--i:' + (i + 2) + '"><b>' + d.getDate() + '</b><i class="' +
      (wd === 0 ? "sun" : wd === 6 ? "sat" : "") + '">' + DAYNAMES[wd] + "</i>" + (isDue ? '<span class="p5due">' + STAR + "</span>" : "") + (i === 0 ? DAGGER : "") + "</div>";
  }
  const say = now.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" }) + ". " + ph + "." + (w ? " " + w.label + "." : "") +
    (due ? days > 0 ? " " + label + " in " + days + (days === 1 ? " day." : " days.") : days === 0 ? " " + label + " is today." : "" : " Take your time.");

  el.innerHTML = '<div class="p5' + (anim ? " anim" : "") + (still() ? "" : " move") + (pick >= 0 ? " haspic" : "") + '" role="group" aria-label="' + h(say) + '">' +
    '<div class="p5sky"></div>' + CITY + '<div class="p5ground"></div>' + CLOUD("c1") + CLOUD("c2") +
    '<div class="p5days" aria-hidden="true">' + row + "</div>" +
    '<div class="p5clock" aria-hidden="true">' + CLOCK + "<span>" + h(ph) + (w ? '<svg class="p5wx" viewBox="0 0 48 48">' + WX[w.k] + "</svg>" + (w.t != null ? w.t + "°" : "") : "") + "</span></div>" +
    (pick >= 0 ? '<button type="button" class="p5pic" title="Next picture" aria-label="Show the next picture"><img alt="" src="' + h(pics[pick]) + '"></button>' : CAT) +
    '<div class="p5qa" aria-hidden="true"><div class="p5qh"><b>Q</b><span>HOT TOPIC</span></div><div class="p5qq">' + pq.q + "</div>" +
    '<div class="p5qr"><div class="p5bar"><i style="--v:' + pq.bar.toFixed(3) + '"></i></div><b>' + h(pq.num) + "</b></div>" +
    '<div class="p5anon"><b>Anon:</b>' + h(pq.anon) + "</div></div>" +
    '<button type="button" class="p5pen" title="Deadline and pictures" aria-label="Set a deadline and add pictures">✎</button>' +
    (editing ? editor(el, st, due, pics) : "") + "</div>";
  wire(el);
}

function editor(el, st, due, pics) {
  const L = el.dataset.dl != null ? el.dataset.dl : st.label || "", D = el.dataset.dd != null ? el.dataset.dd : due ? st.date : "";
  return '<div class="p5form" role="group" aria-label="Deadline and pictures"><b class="p5ft">DEADLINE</b>' +
    '<label><span>Name</span><input name="l" maxlength="30" placeholder="Exams, a trip, a birthday…" value="' + h(L) + '"></label>' +
    '<label><span>Date</span><input name="d" type="date" value="' + h(D) + '"></label>' +
    '<b class="p5ft">YOUR PICTURES</b><div class="p5pics">' +
    pics.map((p, i) => '<span class="p5th"><img alt="" src="' + h(p) + '"><button type="button" data-del="' + i + '" aria-label="Remove this picture">✕</button></span>').join("") +
    (pics.length < MAX_PICS ? '<label class="p5add"><span>+ Add</span><input type="file" accept="image/*" aria-label="Add a picture"></label>' : "") + "</div>" +
    '<p class="p5note">They stay on this device. Pictures with a see-through background look best; tap one on the card to switch.</p><p class="p5err" role="alert"></p>' +
    '<div class="p5btns"><button type="button" class="ok">Save</button>' + (due ? '<button type="button" class="clr">Remove deadline</button>' : "") +
    '<button type="button" class="no">Close</button></div></div>';
}

function wire(el) {
  const q = s => el.querySelector(s);
  const field = n => q(".p5form input[name=" + n + "]");
  const draft = () => { el.dataset.dl = field("l").value; el.dataset.dd = field("d").value; };
  const close = () => { delete el.dataset.edit; delete el.dataset.dl; delete el.dataset.dd; render(el, {}); };
  q(".p5pen").onclick = e => {
    e.stopPropagation();
    if (el.dataset.edit === "1") { close(); return; }
    el.dataset.edit = "1"; render(el, {});
    const i = q(".p5form input[name=l]"); if (i) i.focus();
  };
  const pic = q(".p5pic");
  if (pic) pic.onclick = e => { e.stopPropagation(); el.dataset.pic = (+el.dataset.pic || 0) + 1; render(el, {}); };
  const f = q(".p5form");
  if (!f) return;
  const err = t => { q(".p5err").textContent = t; };
  f.onclick = e => e.stopPropagation();
  f.onkeydown = e => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Enter" && e.target.matches("input[name]")) { e.preventDefault(); save(); }
  };
  const save = () => {
    const d = field("d").value.trim(), l = field("l").value.trim().slice(0, 30);
    if (d && !parse(d)) { err("That date isn't right."); return; }
    const old = read(KEY) || {};
    write(KEY, d ? { label:l, date:d, set:old.date === d && old.set ? old.set : Date.now() } : null);
    delete el.dataset.edit; delete el.dataset.dl; delete el.dataset.dd;
    render(el, { animate:true });
  };
  q(".p5form .ok").onclick = save;
  q(".p5form .no").onclick = close;
  const clr = q(".p5form .clr");
  if (clr) clr.onclick = () => { write(KEY, null); el.dataset.dl = ""; el.dataset.dd = ""; render(el, {}); };
  el.querySelectorAll(".p5form [data-del]").forEach(b => b.onclick = () => {
    draft();
    const list = pictures(); list.splice(+b.dataset.del, 1); write(PICS, list.length ? list : null);
    render(el, {});
  });
  const add = q(".p5add input");
  if (add) add.onchange = async () => {
    const file = add.files && add.files[0];
    if (!file) return;
    draft();
    try {
      const url = await shrink(file), list = pictures();
      list.push(url);
      if (!write(PICS, list)) { err("There isn't room for another picture. Remove one, or pick a smaller one."); return; }
      const n = list.length;                                 // the card shows the new one
      el.dataset.pic = String((((n - 1 - dayNo(new Date())) % n) + n) % n);
      render(el, {});
    } catch (x) { err(x && x.message || "That picture couldn't be added."); }
  };
}

// a picture becomes a small image kept on the device: PNG when it has a see-through background, otherwise JPEG
function shrink(file) {
  return new Promise((res, rej) => {
    if (file.type && !/^image\//.test(file.type)) { rej(new Error("That isn't a picture.")); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let out = "";
      for (const max of [420, 320, 240]) {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement("canvas"); c.width = w; c.height = hh;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, hh);
        let see = false;
        try { const d = g.getImageData(0, 0, w, hh).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { see = true; break; } } catch (e) {}
        out = see ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", .85);
        if (out.length < 360000) break;
      }
      if (!/^data:image\/(png|jpeg);base64,/.test(out)) { rej(new Error("That picture couldn't be read.")); return; }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That picture couldn't be opened.")); };
    img.src = url;
  });
}

/* how it looks. Sizes follow the card's width (cqw), so it scales from a phone to a wide new tab page. */
let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement("style");
  s.id = "p5css";
  // text with a black outline inside a white one, like a sticker (sizes in em, so it scales)
  const sticker = (a, b) => [[a, 0], [-a, 0], [0, a], [0, -a], [a * .75, a * .75], [-a * .75, -a * .75], [a * .75, -a * .75], [-a * .75, a * .75]].map(([x, y]) => x + "em " + y + "em 0 #000")
    .concat([[b, 0], [-b, 0], [0, b], [0, -b], [b * .72, b * .72], [-b * .72, -b * .72], [b * .72, -b * .72], [-b * .72, b * .72]].map(([x, y]) => x + "em " + y + "em 0 #fff")).join(",");
  const outline = n => "drop-shadow(" + n + " 0 0 #fff) drop-shadow(-" + n + " 0 0 #fff) drop-shadow(0 " + n + " 0 #fff) drop-shadow(0 -" + n + " 0 #fff)";
  s.textContent = `
.p5host{container:p5/inline-size}
.p5{--r:#e5191c;--cy:#1fd0dc;--fa:"Futura","Futura PT","Avenir Next Condensed","Arial Black","Helvetica Neue",Arial,sans-serif;--fb:Georgia,"Times New Roman",serif;
  position:relative;overflow:hidden;border-radius:16px;aspect-ratio:7/8;width:100%;background:#141114;color:#fff;font-family:var(--fa);isolation:isolate;
  box-shadow:0 10px 30px -12px rgba(0,0,0,.7);user-select:none;-webkit-user-select:none;font-size:16px}
.p5sky{position:absolute;inset:0 0 38% 0;background:linear-gradient(#f09f73,#f6c19c 55%,#fbdcc4)}
.p5city{position:absolute;left:0;top:14%;width:100%;height:48%}
.p5ground{position:absolute;left:-15%;right:-15%;top:59%;bottom:-12%;transform:rotate(-5deg);border-radius:50% 50% 0 0/22% 22% 0 0;box-shadow:0 -4px 0 #000;
  background:#141114 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'%3E%3Cg fill='none' stroke='%23423b40' stroke-width='3'%3E%3Cpath d='M24 4l5.6 12.8 13.9 1.2-10.6 9.2 3.2 13.6L24 33.6 11.9 40.8l3.2-13.6L4.5 18l13.9-1.2z'/%3E%3Cpath d='M66 46l4.2 9.6 10.4.9-7.9 6.9 2.4 10.2L66 68.2l-9.1 5.4 2.4-10.2-7.9-6.9 10.4-.9z' transform='rotate(20 66 60)'/%3E%3C/g%3E%3C/svg%3E") 0 0/22% auto}
.p5cl{position:absolute;width:22%;filter:drop-shadow(0 3px 0 rgba(0,0,0,.25))}
.p5cl.c1{left:21%;top:50%}.p5cl.c2{left:61%;top:45%;width:17%}
.p5days{position:absolute;inset:0}
.p5day{position:absolute;transform:translateX(-50%);text-align:center;line-height:.82;white-space:nowrap}
.p5day b{display:block;font-size:1em;font-weight:900;font-style:italic;letter-spacing:-.05em;color:#fff;text-shadow:${sticker(.035, .085)},.1em .13em 0 rgba(0,0,0,.45)}
.p5day i{display:block;width:max-content;margin:.12em auto 0;line-height:1;font-size:.3em;font-style:italic;font-weight:900;letter-spacing:.03em;color:#fff;transform:rotate(-8deg) skewX(-10deg);
  text-shadow:${sticker(.07, .17)}}
.p5day i.sun{color:var(--r)}.p5day i.sat{color:var(--cy)}
.p5day.past b{color:#e9e4e6}
.p5day.s0{left:11%;top:14%;font-size:28px;font-size:8cqw}
.p5day.s1{left:24%;top:27%;font-size:40px;font-size:11.5cqw}
.p5day.s2{left:49%;top:31%;font-size:74px;font-size:21cqw;z-index:2}
.p5day.s3{left:80%;top:27%;font-size:40px;font-size:11.5cqw}
.p5day.s4{left:88%;top:12%;font-size:28px;font-size:8cqw}
.p5day.now i{font-size:.27em;margin-top:.02em;transform:rotate(-7deg) skewX(-10deg) translateX(.15em)}
.p5dag{position:absolute;width:.38em;height:1.38em;right:-.3em;top:-.7em;transform:rotate(34deg);filter:${outline(".02em")} drop-shadow(.05em .05em 0 rgba(0,0,0,.4))}
.p5due{position:absolute;left:-.22em;top:-.2em;width:.42em;height:.42em}
.p5due svg{width:100%;height:100%;fill:var(--r);filter:${outline(".03em")}}
.p5clock{position:absolute;left:4%;top:56%;display:flex;align-items:center;gap:6px;gap:1.6cqw;z-index:1}
.p5clk{width:40px;width:11cqw;transform:rotate(-12deg);filter:${outline("2px")}}
.p5clock span{display:inline-flex;align-items:center;gap:.35em;background:#000;color:#fff;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.05em;
  font-size:12px;font-size:3.4cqw;padding:.3em .7em .3em .5em;transform:rotate(-4deg) skewX(-10deg);box-shadow:.2em .2em 0 var(--r)}
.p5wx{width:1.4em;height:1.4em;fill:#fff}.p5wx .ln{fill:none;stroke:#fff;stroke-width:4;stroke-linecap:round}.p5wx .bolt{fill:var(--r)}
.p5qa{position:absolute;left:4%;bottom:4%;width:63%;z-index:2;font-size:12px;font-size:3.5cqw}
.p5qh{display:flex;align-items:flex-end;gap:.3em;margin-bottom:-.35em;position:relative;z-index:1}
.p5qh b{font-size:3.3em;line-height:.8;font-weight:900;font-style:italic;color:var(--r);text-shadow:${sticker(.03, .075)}}
.p5qh span{background:#fff;color:#000;font-weight:900;font-style:italic;font-size:.8em;letter-spacing:.06em;padding:.15em .5em;transform:rotate(-6deg) skewX(-10deg);margin-bottom:.9em;box-shadow:.15em .15em 0 #000}
.p5qq{background:#000;border:2px solid #fff;padding:.45em .6em .35em;font-weight:800;line-height:1.2;transform:skewX(-4deg)}
.p5qq em{font-style:normal;color:var(--r)}
.p5qr{display:flex;align-items:center;gap:.5em;margin-top:.35em}
.p5bar{flex:1;height:.9em;border:2px solid #fff;background:#000;transform:skewX(-14deg);overflow:hidden}
.p5bar i{display:block;height:100%;background:var(--r);transform-origin:left;transform:scaleX(var(--v))}
.p5qr b{font-size:1.5em;font-weight:900;font-style:italic;color:var(--r);text-shadow:${sticker(.03, .07)};white-space:nowrap}
.p5anon{margin-top:.25em;font-weight:700;color:#fff;text-shadow:0 1px 0 #000}
.p5anon b{margin-right:.35em}
.p5cat{position:absolute;right:4%;bottom:0;width:20%;z-index:2}
.p5cat .hd{fill:#0b0b0d;stroke:#fff;stroke-width:2.5}.p5cat .e{fill:#ffd21f}.p5cat .p{fill:#0b0b0d}.p5cat .ns{fill:var(--r)}
.p5pic{position:absolute;right:1%;bottom:0;height:50%;max-width:34%;padding:0;margin:0;border:0;background:none;cursor:pointer;z-index:2;display:flex;align-items:flex-end;justify-content:flex-end}
.p5pic img{max-height:100%;max-width:100%;width:auto;height:auto;object-fit:contain;filter:${outline("3px")} drop-shadow(4px 4px 0 rgba(0,0,0,.45))}
.p5pen{position:absolute;right:2.5%;top:2.5%;width:30px;height:30px;width:8.5cqw;height:8.5cqw;min-width:26px;min-height:26px;max-width:40px;max-height:40px;border-radius:50%;
  background:#fff;color:#000;border:2px solid #000;font-size:15px;line-height:1;cursor:pointer;z-index:4;box-shadow:2px 2px 0 var(--r);display:grid;place-items:center;padding:0}
.p5 button:focus-visible{outline:3px solid #ffd21f;outline-offset:2px}
.p5form{position:absolute;inset:0;z-index:5;width:auto;height:auto;margin:0;background:rgba(12,10,12,.96);padding:16px;display:flex;flex-direction:column;gap:9px;overflow:auto;font-size:14px;animation:none;text-align:left}
.p5 button,.p5 input{margin:0;box-sizing:border-box;transition:none;animation:none;backdrop-filter:none;-webkit-backdrop-filter:none;letter-spacing:normal}
.p5ft{font-weight:900;font-style:italic;letter-spacing:.08em;font-size:12px;background:var(--r);align-self:flex-start;padding:2px 9px;transform:skewX(-12deg)}
.p5form label{display:flex;align-items:center;gap:8px}
.p5form label>span{width:52px;font-weight:900;font-style:italic;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.p5form input:not([type=file]){flex:1;min-width:0;height:auto;font:16px var(--fb);font-style:italic;background:#fff;color:#000;border:0;border-radius:0;padding:7px 9px;outline:none;box-shadow:3px 3px 0 var(--r)}
.p5form input:not([type=file]):focus{box-shadow:3px 3px 0 var(--r),0 0 0 2px #ffd21f}
.p5form input[type=date]{font-style:normal;font-family:inherit;font-weight:700}
.p5pics{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.p5th{position:relative;width:58px;height:58px;flex:none;background:#2a282f}
.p5th img{display:block;width:100%;height:100%;max-width:none;object-fit:contain}
.p5th button{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:2px solid #000;background:#fff;color:#000;font-size:11px;cursor:pointer;padding:0;line-height:1}
.p5form .p5add{position:relative;width:58px;height:58px;border:2px dashed #fff;justify-content:center;cursor:pointer;font-weight:900;font-style:italic}
.p5form .p5add span{width:auto}
.p5add input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.p5note{margin:0;color:#c9c2c6;font-size:12px}
.p5err{margin:0;color:#ff8a80;font-size:12.5px}
.p5btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
.p5btns button{font:inherit;font-weight:900;font-style:italic;font-size:13px;padding:7px 15px;transform:skewX(-10deg);background:#2a282f;color:#fff;border:0;cursor:pointer}
.p5btns .ok{background:var(--r)}
/* a wide new tab page: a long panorama */
@container p5 (min-width:600px){
  .p5{aspect-ratio:auto;height:300px;height:36cqw;max-height:330px}
  .p5sky{bottom:36%}.p5city{top:6%;height:58%}.p5ground{top:63%;transform:rotate(-2deg);border-radius:50% 50% 0 0/30% 30% 0 0;background-size:9% auto}
  .p5day.s0{left:7%;top:12%;font-size:4.4cqw}.p5day.s1{left:16%;top:22%;font-size:6.2cqw}.p5day.s2{left:30%;top:24%;font-size:10.5cqw}
  .p5day.s3{left:46.5%;top:19%;font-size:6cqw}.p5day.s4{left:54.5%;top:7%;font-size:4.2cqw}
  .p5cl.c1{left:16%;top:57%;width:10%}.p5cl.c2{left:39%;top:52%;width:8%}
  .p5clock{left:2.5%;top:68%;gap:.8cqw}.p5clk{width:5cqw}.p5clock span{font-size:1.5cqw}
  .p5qa{left:57%;bottom:auto;top:30%;width:26%;font-size:1.5cqw}
  .p5pic{height:92%;max-width:17%}.p5cat{width:9%;right:3%}
  .p5pen{width:3.6cqw;height:3.6cqw}
  .p5form{padding:18px 22px}
  .p5form label{max-width:460px}
}
/* the arrival: the days pop in, today slams down, the dagger stabs, the poll fills up */
.p5.anim .p5day{animation:p5pop .42s cubic-bezier(.2,1.6,.4,1) both;animation-delay:calc(.08s + var(--i) * 70ms)}
.p5.anim .p5day.now{animation:p5slam .5s cubic-bezier(.2,1.4,.4,1) .25s both}
.p5.anim .p5dag{animation:p5stab .32s cubic-bezier(.5,0,.8,.4) .75s both}
.p5.anim .p5cl{animation:p5fade .6s ease-out .3s both}
.p5.anim .p5clock{animation:p5in .4s ease-out .5s both}
.p5.anim .p5qa{animation:p5up .45s cubic-bezier(.2,1.2,.4,1) .55s both}
.p5.anim .p5bar i{animation:p5fill .9s cubic-bezier(.3,.8,.3,1) .9s both}
.p5.anim .p5pic,.p5.anim .p5cat{animation:p5up .6s cubic-bezier(.2,1.4,.4,1) .7s both}
.p5.move .p5cl.c1{animation:p5drift 9s ease-in-out 1s infinite alternate}
.p5.move .p5cl.c2{animation:p5drift 11s ease-in-out infinite alternate-reverse}
@keyframes p5pop{from{transform:translateX(-50%) scale(0) rotate(-25deg);opacity:0}to{transform:translateX(-50%);opacity:1}}
@keyframes p5slam{0%{transform:translateX(-50%) scale(2.3) rotate(-18deg);opacity:0}100%{transform:translateX(-50%);opacity:1}}
@keyframes p5stab{from{transform:translate(.6em,-.7em) rotate(34deg);opacity:0}to{transform:rotate(34deg);opacity:1}}
@keyframes p5fade{from{opacity:0}to{opacity:1}}
@keyframes p5in{from{opacity:0;translate:-12px 0}to{opacity:1;translate:0 0}}
@keyframes p5up{from{opacity:0;translate:0 30%}to{opacity:1;translate:0 0}}
@keyframes p5fill{from{transform:scaleX(0)}}
@keyframes p5drift{from{translate:-4% 0}to{translate:6% 0}}
`;
  document.head.appendChild(s);
}

window.Phantom = { render, phase };
})();
