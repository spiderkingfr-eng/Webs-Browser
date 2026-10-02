/* ---------------------------------------------------------------- Webs 3.0: sidebar tools
   Twelve small tools behind a "More" tab. Each pane is built the first time
   you open it; anything worth keeping is stored like the rest (wsb.x…). */
(function () {
"use strict";
const TOOLS = [
  ["xclocks", "🕒", "World clocks", "The time in any city"], ["xsketch", "✏️", "Sketchpad", "Draw, then copy the picture"],
  ["xpass", "🔑", "Passwords", "Strong passwords and passphrases"], ["xjson", "{ }", "JSON", "Format, check and shrink JSON"],
  ["xdiff", "↔️", "Compare text", "What changed between two texts"], ["xregex", ".*", "Regex tester", "Try a pattern on some text"],
  ["xmd", "Ⓜ️", "Markdown", "Write and see it formatted"], ["xcolors", "🎨", "Colors", "Palettes and contrast checks"],
  ["xbreathe", "🫧", "Breathe", "A minute of calm breathing"], ["xmetro", "🥁", "Metronome", "Keep the beat, tap the tempo"],
  ["xdecide", "🎡", "Decision wheel", "Spin to choose for you"], ["xtally", "🔢", "Tally counter", "Count anything"], ["xunit", "🏷️", "Price per unit", "Which pack is cheaper?"]
];
const IDS = ["xtools"].concat(TOOLS.map(t => t[0]));
const E = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const q = (root, s) => root.querySelector(s);
const flash = (b, txt) => { const o = b.textContent; b.textContent = txt; setTimeout(() => { b.textContent = o; }, 1100); };
const copy = (text, b) => { send("clip", text); if (b) flash(b, "Copied"); };
const rnd = n => { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; do crypto.getRandomValues(a); while (a[0] >= lim); return a[0] % n; };
const motionOff = () => document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;

const nav = document.querySelector("nav"), more = E("button", "", "More");
more.dataset.p = "xtools"; more.title = "More tools"; nav.appendChild(more);
more.onclick = () => open("xtools");
const built = {};
function pane(id, title) {
  const d = E("div", "pane"); d.id = id;
  if (id !== "xtools") { d.appendChild(E("div", "xh", '<button title="All tools">←</button><b></b>')); q(d, ".xh b").textContent = title; q(d, ".xh button").onclick = () => open("xtools"); }
  const b = E("div", "xb"); d.appendChild(b);
  document.body.insertBefore(d, document.querySelector("script"));
  return b;
}
function open(id) { show(id); history.replaceState(null, "", "#" + id); after(id); }
function after(id) {
  more.classList.toggle("on", IDS.indexOf(id) >= 0);
  if (!built[id]) { built[id] = true; const t = TOOLS.find(x => x[0] === id); BUILD[id](pane(id, t ? t[2] : "Tools")); show(id); more.classList.add("on"); }
  if (HOOK[id]) HOOK[id]();
}
const HOOK = {};
const BUILD = {};

BUILD.xtools = b => {
  b.appendChild(E("div", "xlab", "Tools"));
  const g = E("div", "xgrid"); b.appendChild(g);
  TOOLS.forEach(([id, ic, n, d], i) => {
    const c = E("button", "xcard", "<i></i><b></b><span></span>");
    q(c, "i").textContent = ic; q(c, "b").textContent = n; q(c, "span").textContent = d;
    c.style.animationDelay = i * 30 + "ms"; c.onclick = () => open(id); g.appendChild(c);
  });
};

/* world clocks */
BUILD.xclocks = b => {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let list = get("xClocks", null) || [here, "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"];
  let all = []; try { all = Intl.supportedValuesOf("timeZone"); } catch (e) { all = list; }
  const city = z => z.split("/").pop().replace(/_/g, " ");
  b.innerHTML = '<div id="xcList"></div><div class="xlab">Add a place</div><div class="xrow"><input class="xin" id="xcAdd" list="xcZones" placeholder="City or time zone, e.g. Paris or Asia/Dubai"><button class="b m" id="xcGo">Add</button></div><datalist id="xcZones"></datalist><div class="xmsg" id="xcMsg"></div>';
  q(b, "#xcZones").innerHTML = all.map(z => '<option value="' + esc(city(z)) + '">' + esc(z) + "</option>").join("");
  const offset = (z, d) => { const p = {}; new Intl.DateTimeFormat("en-US", { timeZone:z, hourCycle:"h23", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric" }).formatToParts(d).forEach(x => { p[x.type] = +x.value; });
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(d.getTime() / 60000) * 60000) / 60000; };
  const paint = () => {
    const box = q(b, "#xcList"), now = new Date(), mine = offset(here, now);
    box.innerHTML = "";
    list.forEach((z, i) => {
      let t; try { t = now.toLocaleTimeString([], { timeZone:z, hour:"numeric", minute:"2-digit" }); } catch (e) { return; }
      const off = offset(z, now), diff = (off - mine) / 60, h = +now.toLocaleString("en-US", { timeZone:z, hour:"numeric", hourCycle:"h23" });
      const dayA = now.toLocaleDateString("en-CA", { timeZone:here }), dayB = now.toLocaleDateString("en-CA", { timeZone:z });
      const r = E("div", "xclk", '<span class="dn"></span><span class="t"></span><div class="n"><b></b><span></span></div><button title="Remove">✕</button>');
      q(r, ".dn").textContent = h >= 6 && h < 18 ? "☀️" : "🌙"; q(r, ".t").textContent = t; q(r, "b").textContent = city(z) + (z === here ? " (here)" : "");
      q(r, ".n span").textContent = (dayB > dayA ? "Tomorrow" : dayB < dayA ? "Yesterday" : "Today") + " · UTC" + (off >= 0 ? "+" : "−") + Math.floor(Math.abs(off) / 60) + (Math.abs(off) % 60 ? ":" + String(Math.abs(off) % 60).padStart(2, "0") : "") +
        (z === here ? "" : " · " + (diff === 0 ? "same time" : Math.abs(diff) + " h " + (diff > 0 ? "ahead" : "behind")));
      q(r, "button").onclick = () => { list.splice(i, 1); put("xClocks", list); paint(); };
      box.appendChild(r);
    });
  };
  const add = () => {
    const v = q(b, "#xcAdd").value.trim().toLowerCase(); if (!v) return;
    const z = all.find(x => x.toLowerCase() === v) || all.find(x => city(x).toLowerCase() === v) || all.find(x => city(x).toLowerCase().startsWith(v)) || all.find(x => x.toLowerCase().includes(v.replace(/ /g, "_")));
    if (!z) { q(b, "#xcMsg").textContent = "No time zone matches “" + v + "”. Try the country's capital or a big city."; return; }
    if (list.indexOf(z) < 0) list.push(z); put("xClocks", list.slice(0, 20)); q(b, "#xcAdd").value = ""; q(b, "#xcMsg").textContent = ""; paint();
  };
  q(b, "#xcGo").onclick = add; q(b, "#xcAdd").onkeydown = e => { if (e.key === "Enter") add(); };
  paint(); setInterval(() => { if (!document.hidden && $("xclocks").classList.contains("on")) paint(); }, 10000);
  HOOK.xclocks = paint;
};

/* sketchpad */
BUILD.xsketch = b => {
  const COLS = ["#16131a", "#e8342a", "#f08a24", "#e8c42a", "#3fb971", "#3b8bf0", "#9a63f0", "#e85aa8"];
  b.innerHTML = '<div class="xrow" id="xsCols"></div><div class="xrow"><select class="xsel" id="xsSize" style="width:auto"><option value="2">Fine</option><option value="5" selected>Medium</option><option value="11">Thick</option><option value="24">Marker</option></select>' +
    '<button class="b" id="xsErase">Eraser</button><button class="b" id="xsUndo">Undo</button><button class="b" id="xsClear">Clear</button></div><canvas class="xpad" id="xsPad"></canvas>' +
    '<div class="xrow"><button class="b m" id="xsCopy" style="flex:1">Copy the picture</button></div><div class="xmsg">Your sketch is kept here until you clear it.</div>';
  const cv = q(b, "#xsPad"), g = cv.getContext("2d"), undo = [];
  let color = COLS[0], erase = false, last = null, drawing = false;
  COLS.forEach((c, i) => { const s = E("span", "xsw" + (i === 0 ? " on" : "")); s.style.background = c; s.onclick = () => { color = c; erase = false; q(b, "#xsErase").classList.remove("on"); b.querySelectorAll(".xsw").forEach(x => x.classList.toggle("on", x === s)); }; q(b, "#xsCols").appendChild(s); });
  const size = () => {
    const k = devicePixelRatio || 1, w = Math.max(160, cv.clientWidth), h = cv.clientHeight;
    if (cv.width === Math.round(w * k)) return;
    const keep = cv.width ? cv.toDataURL() : get("xSketch", "");
    cv.width = Math.round(w * k); cv.height = Math.round(h * k); g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    if (keep) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, w, w * im.height / im.width); im.src = keep; }
  };
  const store = () => { try { const d = cv.toDataURL("image/png"); if (d.length < 1500000) put("xSketch", d); } catch (e) {} };
  const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drawing = true; last = pt(e);
    undo.push(g.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 20) undo.shift();
    g.beginPath(); g.fillStyle = erase ? "#fff" : color; g.arc(last[0], last[1], (+q(b, "#xsSize").value * (erase ? 3 : 1)) / 2, 0, 7); g.fill(); };
  cv.onpointermove = e => { if (!drawing) return; const p = pt(e), w = +q(b, "#xsSize").value * (erase ? 3 : 1) * (e.pressure && e.pointerType === "pen" ? .5 + e.pressure : 1);
    g.strokeStyle = erase ? "#fff" : color; g.lineWidth = w; g.lineCap = g.lineJoin = "round";
    g.beginPath(); g.moveTo(last[0], last[1]); g.quadraticCurveTo(last[0], last[1], (last[0] + p[0]) / 2, (last[1] + p[1]) / 2); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
  cv.onpointerup = cv.onpointercancel = () => { if (drawing) { drawing = false; store(); } };
  q(b, "#xsErase").onclick = e => { erase = !erase; e.target.classList.toggle("on", erase); };
  q(b, "#xsUndo").onclick = () => { const s = undo.pop(); if (s) { g.putImageData(s, 0, 0); store(); } };
  q(b, "#xsClear").onclick = () => { undo.push(g.getImageData(0, 0, cv.width, cv.height)); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); put("xSketch", ""); };
  q(b, "#xsCopy").onclick = e => { const btn = e.target; cv.toBlob(bl => { try { navigator.clipboard.write([new ClipboardItem({ "image/png":bl })]).then(() => flash(btn, "Copied - paste it anywhere"), () => flash(btn, "Copying pictures isn't allowed here")); } catch (x) { flash(btn, "Copying pictures isn't allowed here"); } }); };
  HOOK.xsketch = () => requestAnimationFrame(size);
  addEventListener("resize", () => { if ($("xsketch").classList.contains("on")) size(); });
};

/* passwords and passphrases */
const WORDS = ("able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bird blow blue boat body bone book boot born boss both bowl bulk burn bush busy cake call calm came camp card care cart case cash cast cell chat chip city clay club coal coat code cold cook cool cope copy core corn cost crew crop dark data date dawn deal dear deep deer desk dial diet disk dock door dose down draw drop drum duck dust duty each earn east easy edge else even ever face fact fair fall farm fast fear feel fern film fine fire firm fish five flag flat flow folk food foot fork form fort four free frog fuel full fund gain game gate gear gift girl glad goal gold golf good gray grid grow gulf hair half hall hand hang hard harm head heat help herb hero high hill hint hold hole home hook hope horn host hour huge idea iron item jazz join joke jump jury keen keep kind king kite knee knot lake lamp land lane last late lawn lead leaf left lens life lift lime line lion list live load loan lock loft long loop lord luck lung made mail main make mall many maps mark mask mass meal meat menu mild milk mind mine mint mode moon more moss most move much nail name navy near neck nest news next nice nine none noon nose note oaks open oven pack page pair palm park part path peak pear pine pink plan play plot plum poem pole pond pool port pull pump pure quiz race rain rank rare reef rest rice ride ring rise road rock roof room root rope rose ruby rule safe sail salt sand seal seat seed ship shoe shop shot show side sign silk sing site size skin slow snow soap sock soft soil song soup star stay step stew stop suit sure swan tail tale tank tape task team tent test text tide tile time tiny tour town tree trip tube tune twin unit vast verb very vote wage wake walk wall warm wave wear west wide wild wind wing wire wise wolf wood wool word work yard year yoga zero zone").split(" ");
BUILD.xpass = b => {
  b.innerHTML = '<div class="xrow"><button class="b m" data-m="pw" style="flex:1">Password</button><button class="b" data-m="ph" style="flex:1">Passphrase</button></div>' +
    '<div class="xpw" id="xpOut"></div><div class="xmeter"><i id="xpBar"></i></div><div class="xmsg" id="xpInfo"></div>' +
    '<div class="xrow"><button class="b m" id="xpCopy" style="flex:1">Copy</button><button class="b" id="xpNew" style="flex:1">New one</button></div>' +
    '<div id="xpPw"><div class="xlab">Length <span id="xpLenV"></span></div><input type="range" class="xr" id="xpLen" min="6" max="64" value="20">' +
    '<label class="xck"><input type="checkbox" id="xpU" checked> Capital letters (A-Z)</label><label class="xck"><input type="checkbox" id="xpL" checked> Small letters (a-z)</label>' +
    '<label class="xck"><input type="checkbox" id="xpD" checked> Numbers (0-9)</label><label class="xck"><input type="checkbox" id="xpS" checked> Symbols (!@#$…)</label>' +
    '<label class="xck"><input type="checkbox" id="xpA" checked> Leave out look-alikes (I l 1 O 0)</label></div>' +
    '<div id="xpPh" style="display:none"><div class="xlab">Words <span id="xpWV"></span></div><input type="range" class="xr" id="xpW" min="4" max="12" value="7">' +
    '<div class="xrow"><span class="xmsg" style="margin:0">Between words</span><select class="xsel" id="xpSep" style="width:auto"><option value="-">-</option><option value=" ">space</option><option value=".">.</option><option value="_">_</option><option value="">nothing</option></select></div>' +
    '<label class="xck"><input type="checkbox" id="xpCap" checked> Capitalize words</label><label class="xck"><input type="checkbox" id="xpNum" checked> Add a number</label></div>' +
    '<div class="xmsg">Made on this computer with a secure random generator; nothing is saved or sent anywhere.</div>';
  let mode = "pw";
  const gen = () => {
    let out = "", bits = 0;
    if (mode === "pw") {
      const look = q(b, "#xpA").checked, strip = s => look ? s.replace(/[Il1O0o]/g, "") : s;
      const sets = [["#xpU", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], ["#xpL", "abcdefghijklmnopqrstuvwxyz"], ["#xpD", "0123456789"], ["#xpS", "!@#$%^&*-_=+?~"]].filter(s => q(b, s[0]).checked).map(s => strip(s[1]));
      if (!sets.length) { q(b, "#xpL").checked = true; return gen(); }
      const n = +q(b, "#xpLen").value, all = sets.join("");
      const chars = sets.map(s => s[rnd(s.length)]);
      while (chars.length < n) chars.push(all[rnd(all.length)]);
      for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
      out = chars.slice(0, n).join(""); bits = n * Math.log2(all.length);
      q(b, "#xpLenV").textContent = "· " + n;
    } else {
      const n = +q(b, "#xpW").value, w = [];
      for (let i = 0; i < n; i++) { let x = WORDS[rnd(WORDS.length)]; if (q(b, "#xpCap").checked) x = x[0].toUpperCase() + x.slice(1); w.push(x); }
      if (q(b, "#xpNum").checked) w[rnd(w.length)] += rnd(100);
      out = w.join(q(b, "#xpSep").value); bits = n * Math.log2(WORDS.length) + (q(b, "#xpNum").checked ? Math.log2(100) : 0);
      q(b, "#xpWV").textContent = "· " + n;
    }
    q(b, "#xpOut").textContent = out;
    const lv = bits < 45 ? ["Weak", "#e8342a", 25] : bits < 64 ? ["Fair", "#e8a33a", 50] : bits < 90 ? ["Strong", "#3fb971", 78] : ["Very strong", "#3fb971", 100];
    q(b, "#xpBar").style.cssText = "width:" + lv[2] + "%;background:" + lv[1];
    const yrs = Math.pow(2, bits - 1) / 1e11 / 31557600;
    q(b, "#xpInfo").textContent = lv[0] + " · " + Math.round(bits) + " bits · guessing it at 100 billion tries a second takes " + (yrs < 1 / 365 ? "under a day" : yrs < 1 ? Math.round(yrs * 365) + " days" : yrs < 1e6 ? Math.round(yrs).toLocaleString() + " years" : "longer than the universe has existed");
  };
  b.querySelectorAll("[data-m]").forEach(x => x.onclick = () => { mode = x.dataset.m; b.querySelectorAll("[data-m]").forEach(y => y.classList.toggle("m", y === x)); q(b, "#xpPw").style.display = mode === "pw" ? "" : "none"; q(b, "#xpPh").style.display = mode === "ph" ? "" : "none"; gen(); });
  b.querySelectorAll("input,select").forEach(i => i.addEventListener("input", gen));
  q(b, "#xpNew").onclick = gen; q(b, "#xpCopy").onclick = e => copy(q(b, "#xpOut").textContent, e.target);
  gen();
};

/* JSON */
BUILD.xjson = b => {
  b.innerHTML = '<textarea class="xta" id="xjIn" style="min-height:220px" spellcheck="false" placeholder="Paste JSON here"></textarea>' +
    '<div class="xrow"><button class="b m" id="xjFmt">Format</button><button class="b" id="xjMin">Minify</button><button class="b" id="xjCopy">Copy</button><label class="xck" style="margin:0 0 0 auto"><input type="checkbox" id="xjSort"> Sort keys</label></div><div class="xmsg" id="xjMsg"></div>';
  const ta = q(b, "#xjIn"), msg = q(b, "#xjMsg");
  const sortK = v => Array.isArray(v) ? v.map(sortK) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortK(v[k]), o), {}) : v;
  const stat = v => { let keys = 0, depth = 0; const walk = (x, d) => { depth = Math.max(depth, d); if (x && typeof x === "object") Object.keys(x).forEach(k => { if (!Array.isArray(x)) keys++; walk(x[k], d + 1); }); }; walk(v, 0); return keys + " keys · " + depth + " levels deep"; };
  const parse = () => {
    try { const v = JSON.parse(ta.value); msg.className = "xmsg ok"; msg.textContent = "Valid JSON · " + stat(v); return { v }; }
    catch (e) {
      const m = /position (\d+)/.exec(e.message), pos = m ? +m[1] : -1;
      let where = ""; if (pos >= 0) { const before = ta.value.slice(0, pos).split("\n"); where = " (line " + before.length + ", column " + (before[before.length - 1].length + 1) + ")"; ta.focus(); ta.setSelectionRange(pos, pos + 1); }
      msg.className = "xmsg bad"; msg.textContent = (ta.value.trim() ? "Not valid JSON" + where + ": " + e.message.replace(/^JSON\.parse: /, "") : "Paste some JSON first"); return null;
    }
  };
  const out = sp => { const r = parse(); if (!r) return; const v = q(b, "#xjSort").checked ? sortK(r.v) : r.v; ta.value = JSON.stringify(v, null, sp); };
  q(b, "#xjFmt").onclick = () => out(2); q(b, "#xjMin").onclick = () => out(0);
  q(b, "#xjCopy").onclick = e => copy(ta.value, e.target);
  let t0 = 0; ta.oninput = () => { clearTimeout(t0); t0 = setTimeout(() => { if (ta.value.trim()) parse(); else msg.textContent = ""; }, 400); };
};

/* compare two texts, line by line */
BUILD.xdiff = b => {
  b.innerHTML = '<div class="xlab">Original</div><textarea class="xta" id="xdA" spellcheck="false"></textarea><div class="xlab">Changed</div><textarea class="xta" id="xdB" spellcheck="false"></textarea>' +
    '<div class="xrow"><label class="xck" style="margin:0"><input type="checkbox" id="xdTrim" checked> Ignore spaces at line ends</label><span class="xmsg" id="xdSum" style="margin:0 0 0 auto"></span></div><div class="xdiff" id="xdOut"></div>';
  const run = () => {
    const trim = q(b, "#xdTrim").checked, A = q(b, "#xdA").value.split("\n").slice(0, 3000), B = q(b, "#xdB").value.split("\n").slice(0, 3000);
    const k = s => trim ? s.replace(/\s+$/, "") : s, n = A.length, m = B.length;
    const L = Array.from({ length:n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = k(A[i]) === k(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const box = q(b, "#xdOut"); box.innerHTML = "";
    let i = 0, j = 0, add = 0, del = 0;
    const line = (cls, sign, t) => { const d = E("div", cls); d.textContent = sign + " " + t; box.appendChild(d); };
    while (i < n || j < m) {
      if (i < n && j < m && k(A[i]) === k(B[j])) { line("", " ", A[i]); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { line("a", "+", B[j++]); add++; }
      else { line("d", "−", A[i++]); del++; }
    }
    q(b, "#xdSum").textContent = add || del ? "+" + add + " added · −" + del + " removed" : q(b, "#xdA").value || q(b, "#xdB").value ? "The same" : "";
  };
  let t0 = 0; b.querySelectorAll("textarea,input").forEach(x => x.addEventListener("input", () => { clearTimeout(t0); t0 = setTimeout(run, 250); }));
};

/* regex tester */
BUILD.xregex = b => {
  b.innerHTML = '<div class="xrow"><input class="xin" id="xrP" placeholder="Pattern, e.g. (\\w+)@(\\w+)\\.com" spellcheck="false" style="font-family:Consolas,monospace"><input class="xin" id="xrF" value="gi" style="flex:0 0 54px;font-family:Consolas,monospace" title="Flags: g i m s u y"></div>' +
    '<textarea class="xta" id="xrT" spellcheck="false" placeholder="Text to test it on">Write to ana@example.com or bo@test.com before 5 May.</textarea>' +
    '<div class="xmsg" id="xrMsg"></div><div class="xre" id="xrOut"></div><div class="xlab">Replace with</div><input class="xin" id="xrR" placeholder="e.g. $1 at $2" spellcheck="false" style="font-family:Consolas,monospace"><div class="xre" id="xrRep" style="margin-top:6px"></div><div id="xrG"></div>';
  q(b, "#xrP").value = "(\\w+)@(\\w+)\\.com";
  const run = () => {
    const out = q(b, "#xrOut"), msg = q(b, "#xrMsg"), text = q(b, "#xrT").value.slice(0, 50000);
    let re; try { re = new RegExp(q(b, "#xrP").value, q(b, "#xrF").value.replace(/[^gimsuyd]/g, "")); } catch (e) { msg.className = "xmsg bad"; msg.textContent = e.message; out.textContent = text; q(b, "#xrRep").textContent = ""; return; }
    if (!q(b, "#xrP").value) { msg.textContent = ""; out.textContent = text; q(b, "#xrRep").textContent = ""; q(b, "#xrG").innerHTML = ""; return; }
    const g = re.global ? re : new RegExp(re.source, re.flags + "g"), list = []; let m, n = 0;
    out.innerHTML = ""; let last = 0;
    while ((m = g.exec(text)) && n < 1000) { list.push(m); n++; out.appendChild(document.createTextNode(text.slice(last, m.index))); const mk = E("mark"); mk.textContent = m[0]; out.appendChild(mk); last = m.index + m[0].length; if (!m[0].length) g.lastIndex++; if (!re.global) break; }
    out.appendChild(document.createTextNode(text.slice(last)));
    msg.className = "xmsg " + (n ? "ok" : ""); msg.textContent = n ? n + " match" + (n === 1 ? "" : "es") : "No matches";
    try { q(b, "#xrRep").textContent = text.replace(re, q(b, "#xrR").value); } catch (e) {}
    q(b, "#xrG").innerHTML = list.slice(0, 20).filter(x => x.length > 1).map((x, i) => '<div class="xmsg">' + (i + 1) + ": " + x.slice(1).map((v, k) => "<b>$" + (k + 1) + "</b> " + esc(v == null ? "-" : v)).join(" · ") + "</div>").join("");
  };
  b.querySelectorAll("input,textarea").forEach(x => x.addEventListener("input", run)); run();
};

/* Markdown */
function mdHtml(src) {
  const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>").replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const lines = String(src).replace(/\r/g, "").split("\n"), out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
    if (/^(\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[\s*_-]*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) { const q2 = []; while (i < lines.length && /^>\s?/.test(lines[i])) q2.push(lines[i++].replace(/^>\s?/, "")); out.push("<blockquote>" + inline(q2.join(" ")) + "</blockquote>"); continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const ol = /^\s*\d/.test(l), items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, "").replace(/^\[( |x)\]\s*/i, (x, c) => c.trim() ? "☑ " : "☐ "));
      out.push((ol ? "<ol>" : "<ul>") + items.map(x => "<li>" + inline(x) + "</li>").join("") + (ol ? "</ol>" : "</ul>")); continue;
    }
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push("<table><tr>" + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr>" + body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</table>"); continue;
    }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])) p.push(lines[i++]);
    out.push("<p>" + p.map(inline).join("<br>") + "</p>");
  }
  return out.join("\n");
}
BUILD.xmd = b => {
  b.innerHTML = '<textarea class="xta" id="xmIn" style="min-height:170px" spellcheck="true"></textarea><div class="xrow"><button class="b" id="xmCopy">Copy as HTML</button><button class="b" id="xmSave">Save as .md</button><button class="b" id="xmToNote">Copy the text</button></div><div class="xmdv" id="xmOut"></div>';
  const ta = q(b, "#xmIn");
  ta.value = get("xMd", "") || "# Hello\n\nWrite **Markdown** here and see it *formatted* below.\n\n- Lists\n- [x] Checklists\n- [Links](https://example.com)\n\n> Quotes, `code` and tables:\n\n| Name | Score |\n| --- | --- |\n| Ana | 12 |";
  const paint = () => { q(b, "#xmOut").innerHTML = mdHtml(ta.value); q(b, "#xmOut").querySelectorAll("a").forEach(a => a.onclick = e => { e.preventDefault(); send("open", a.href); }); };
  let t0 = 0; ta.oninput = () => { paint(); clearTimeout(t0); t0 = setTimeout(() => put("xMd", ta.value.slice(0, 100000)), 400); };
  q(b, "#xmCopy").onclick = e => copy(mdHtml(ta.value), e.target);
  q(b, "#xmToNote").onclick = e => copy(ta.value, e.target);
  q(b, "#xmSave").onclick = () => send("save-text", ((/^#\s+(.+)/m.exec(ta.value) || [])[1] || "notes").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) + ".md", ta.value);
  paint();
};

/* colors */
const hex2hsl = h => { const n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b2 = (n & 255) / 255, mx = Math.max(r, g, b2), mn = Math.min(r, g, b2), l = (mx + mn) / 2, d = mx - mn;
  let hh = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); hh = mx === r ? ((g - b2) / d) % 6 : mx === g ? (b2 - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return [hh, s * 100, l * 100]; };
const hsl2hex = (h, s, l) => { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return "#" + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, "0")).join(""); };
const lum = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); };
const contrast = (a, b2) => { const x = lum(a), y = lum(b2); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
BUILD.xcolors = b => {
  b.innerHTML = '<div class="xrow"><input type="color" id="xkC" value="#e8342a" style="width:44px;height:34px;border:0;background:none;padding:0;cursor:pointer"><input class="xin" id="xkH" value="#e8342a" spellcheck="false" style="font-family:Consolas,monospace"><button class="b" id="xkR">Surprise me</button></div>' +
    '<div id="xkP"></div><div class="xmsg">Click a color to copy it.</div><div class="xlab">Contrast check</div>' +
    '<div class="xrow"><input type="color" id="xkF" value="#ffffff" title="Text"><input type="color" id="xkB" value="#e8342a" title="Background"><div id="xkS" style="flex:1;border-radius:8px;padding:8px 10px;font-weight:600">Sample text Aa</div></div><div class="xmsg" id="xkM"></div>';
  const SCH = [["Shades", (h, s, l) => [-30, -15, 0, 15, 30].map(d => hsl2hex(h, s, l + d))], ["Matching", (h, s, l) => [0, 180, 0, 180, 0].map((d, i) => hsl2hex(h + d, s, l + [-20, -20, 0, 0, 22][i]))],
    ["Neighbors", (h, s, l) => [-40, -20, 0, 20, 40].map(d => hsl2hex(h + d, s, l))], ["Triad", (h, s, l) => [0, 120, 240, 0, 120].map((d, i) => hsl2hex(h + d, s, l + (i > 2 ? 18 : 0)))],
    ["Soft", (h, s) => [92, 84, 74, 62, 50].map(l2 => hsl2hex(h, s * .6, l2))]];
  const paint = hex => {
    const [h, s, l] = hex2hsl(hex); const box = q(b, "#xkP"); box.innerHTML = "";
    SCH.forEach(([n, f]) => { box.appendChild(E("div", "xlab", esc(n))); const row = E("div", "xpal"); f(h, s, l).forEach(c => { const d = E("div"); d.style.background = c; d.style.color = lum(c) > .35 ? "#111" : "#fff"; d.textContent = c.toUpperCase(); d.title = "Copy " + c.toUpperCase(); d.onclick = () => { send("clip", c.toUpperCase()); d.textContent = "Copied"; setTimeout(() => { d.textContent = c.toUpperCase(); }, 900); }; row.appendChild(d); }); box.appendChild(row); });
  };
  const set = hex => { q(b, "#xkC").value = hex; q(b, "#xkH").value = hex; paint(hex); };
  q(b, "#xkC").oninput = e => set(e.target.value);
  q(b, "#xkH").oninput = e => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { const hx = "#" + v.replace("#", "").toLowerCase(); q(b, "#xkC").value = hx; paint(hx); } };
  q(b, "#xkR").onclick = () => set(hsl2hex(rnd(360), 55 + rnd(35), 42 + rnd(18)));
  const cc = () => { const f = q(b, "#xkF").value, bg = q(b, "#xkB").value, r = contrast(f, bg); const s = q(b, "#xkS"); s.style.color = f; s.style.background = bg;
    q(b, "#xkM").innerHTML = "Contrast <b>" + r.toFixed(2) + ":1</b> · " + (r >= 7 ? '<span class="ok">AAA, great for any text</span>' : r >= 4.5 ? '<span class="ok">AA, fine for normal text</span>' : r >= 3 ? "only for large text (AA large)" : '<span class="bad" style="color:#ff7a6e">too low to read comfortably</span>'); };
  q(b, "#xkF").oninput = q(b, "#xkB").oninput = cc;
  set("#e8342a"); cc();
};

/* breathing */
BUILD.xbreathe = b => {
  const PAT = { box:["Box breathing", [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]]], relax:["4-7-8 to relax", [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]]],
    calm:["Calm (in 4, out 6)", [["Breathe in", 4], ["Breathe out", 6]]], energy:["Wake up (in 6, out 2)", [["Breathe in", 6], ["Breathe out", 2]]] };
  b.innerHTML = '<div class="xrow"><select class="xsel" id="xbP">' + Object.keys(PAT).map(k => '<option value="' + k + '">' + PAT[k][0] + "</option>").join("") + '</select><button class="b m" id="xbGo">Start</button></div>' +
    '<div class="xbr"><div class="c"></div><div class="l">Ready</div></div><div class="xmsg" id="xbN" style="text-align:center"></div>';
  const c = q(b, ".c"), lab = q(b, ".l");
  let on = false, t0 = 0, rounds = 0, step = 0;
  const stop = () => { on = false; clearTimeout(t0); c.style.transform = ""; lab.textContent = "Ready"; q(b, "#xbGo").textContent = "Start"; };
  const run = () => {
    if (!on) return;
    const seq = PAT[q(b, "#xbP").value][1], [name, secs] = seq[step % seq.length];
    c.style.transitionDuration = secs + "s";
    if (name === "Breathe in") c.style.transform = "scale(1.9)"; else if (name === "Breathe out") c.style.transform = "scale(1)";
    let left = secs; lab.textContent = name + " · " + left;
    const tick = () => { left--; if (!on) return; if (left > 0) { lab.textContent = name + " · " + left; t0 = setTimeout(tick, 1000); } else { step++; if (step % seq.length === 0) { rounds++; q(b, "#xbN").textContent = rounds + " round" + (rounds === 1 ? "" : "s") + " done"; } run(); } };
    t0 = setTimeout(tick, 1000);
  };
  q(b, "#xbGo").onclick = () => { if (on) { stop(); return; } on = true; step = 0; rounds = 0; q(b, "#xbN").textContent = ""; q(b, "#xbGo").textContent = "Stop"; run(); };
  q(b, "#xbP").onchange = () => { if (on) { stop(); } };
};

/* metronome */
BUILD.xmetro = b => {
  b.innerHTML = '<div class="xbig" id="xmB">100</div><div class="xmsg" style="text-align:center;margin-top:-4px">beats per minute</div><input type="range" class="xr" id="xmR" min="30" max="240" value="100">' +
    '<div class="xrow"><button class="b" id="xmMinus">−5</button><button class="b m" id="xmGo" style="flex:1">Start</button><button class="b" id="xmPlus">+5</button></div>' +
    '<div class="xrow"><button class="b" id="xmTap" style="flex:1">Tap the tempo</button><select class="xsel" id="xmBar" style="width:auto"><option value="2">2 beats</option><option value="3">3 beats</option><option value="4" selected>4 beats</option><option value="6">6 beats</option></select></div><div class="xdots" id="xmD"></div>';
  let bpm = 100, on = false, ctx = null, next = 0, beat = 0, timer = 0, taps = [];
  const dots = () => { const n = +q(b, "#xmBar").value; q(b, "#xmD").innerHTML = Array.from({ length:n }, (_, i) => '<i class="' + (i === 0 ? "first" : "") + '"></i>').join(""); };
  const setB = v => { bpm = Math.max(30, Math.min(240, Math.round(v))); q(b, "#xmB").textContent = bpm; q(b, "#xmR").value = bpm; };
  const click = (t, accent) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = accent ? 1500 : 1000; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(accent ? .5 : .3, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .06); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .07); };
  const sched = () => {
    const n = +q(b, "#xmBar").value;
    while (next < ctx.currentTime + .12) {
      const i = beat % n, at = next; click(at, i === 0);
      setTimeout(() => { const ds = q(b, "#xmD").children; [...ds].forEach((d, k) => d.classList.toggle("on", k === i)); }, Math.max(0, (at - ctx.currentTime) * 1000));
      next += 60 / bpm; beat++;
    }
    timer = setTimeout(sched, 25);
  };
  q(b, "#xmGo").onclick = e => {
    on = !on; e.target.textContent = on ? "Stop" : "Start";
    if (on) { ctx = ctx || new AudioContext(); ctx.resume(); next = ctx.currentTime + .05; beat = 0; sched(); } else { clearTimeout(timer); [...q(b, "#xmD").children].forEach(d => d.classList.remove("on")); }
  };
  q(b, "#xmR").oninput = e => setB(+e.target.value);
  q(b, "#xmMinus").onclick = () => setB(bpm - 5); q(b, "#xmPlus").onclick = () => setB(bpm + 5);
  q(b, "#xmBar").onchange = dots;
  q(b, "#xmTap").onclick = () => { const t = performance.now(); taps = taps.filter(x => t - x < 3000).concat([t]); if (taps.length >= 2) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); setB(60000 / d); } };
  dots();
  HOOK.xmetro = () => {};
  addEventListener("hashchange", () => { if (on && location.hash !== "#xmetro") q(b, "#xmGo").click(); });
};

/* decision wheel */
BUILD.xdecide = b => {
  b.innerHTML = '<canvas class="xwheel" id="xwC" width="300" height="300"></canvas><div class="xbig" id="xwR" style="font-size:24px;font-weight:600;min-height:34px"></div>' +
    '<div class="xrow"><button class="b m" id="xwGo" style="flex:1">Spin</button></div><div class="xlab">Choices, one per line</div><textarea class="xta" id="xwL" style="min-height:120px;font-family:inherit"></textarea>';
  const ta = q(b, "#xwL"), cv = q(b, "#xwC"), g = cv.getContext("2d");
  ta.value = get("xWheel", "") || "Pizza\nSushi\nTacos\nBurgers\nPasta\nSalad";
  const COL = ["#e8342a", "#f08a24", "#e8c42a", "#3fb971", "#3b8bf0", "#9a63f0", "#e85aa8", "#16b3c9"];
  let ang = 0, spinning = false;
  const items = () => ta.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 24);
  const draw = () => {
    const L = items(), n = Math.max(1, L.length), R = 140, k = devicePixelRatio || 1;
    if (cv.width !== 300 * k) { cv.width = cv.height = 300 * k; cv.style.width = cv.style.height = "300px"; }
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 300, 300);
    L.forEach((t, i) => { const a0 = ang + i / n * Math.PI * 2, a1 = a0 + Math.PI * 2 / n;
      g.beginPath(); g.moveTo(150, 150); g.arc(150, 150, R, a0, a1); g.closePath(); g.fillStyle = COL[i % COL.length]; g.fill();
      g.save(); g.translate(150, 150); g.rotate((a0 + a1) / 2); g.fillStyle = "#fff"; g.font = "600 13px Segoe UI, sans-serif"; g.textAlign = "right"; g.fillText(t.length > 16 ? t.slice(0, 15) + "…" : t, R - 10, 4); g.restore(); });
    g.beginPath(); g.arc(150, 150, 16, 0, 7); g.fillStyle = "#fff"; g.fill();
    g.beginPath(); g.moveTo(142, 2); g.lineTo(158, 2); g.lineTo(150, 22); g.closePath(); g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--fg"); g.fill();
  };
  const pickAt = () => { const L = items(), n = L.length; const a = ((-Math.PI / 2 - ang) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2); return L[Math.floor(a / (Math.PI * 2 / n))]; };
  q(b, "#xwGo").onclick = () => {
    if (spinning || items().length < 2) { if (items().length < 2) q(b, "#xwR").textContent = "Add at least two choices"; return; }
    spinning = true; q(b, "#xwR").textContent = "";
    const start = ang, total = Math.PI * 2 * (5 + rnd(4)) + rnd(1000) / 1000 * Math.PI * 2, dur = motionOff() ? 1 : 4200, t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4); ang = start + total * e; draw(); if (p < 1) requestAnimationFrame(step); else { spinning = false; q(b, "#xwR").textContent = "🎉 " + pickAt(); } };
    requestAnimationFrame(step);
  };
  ta.oninput = () => { put("xWheel", ta.value.slice(0, 2000)); draw(); };
  draw();
};

/* tally counters */
BUILD.xtally = b => {
  b.innerHTML = '<div id="xtL"></div><div class="xrow"><button class="b m" id="xtAdd" style="flex:1">Add a counter</button><button class="b" id="xtZero">All to zero</button></div><div class="xmsg">Tip: click a number to type it.</div>';
  let L = get("xTally", null) || [{ n:"Counter", v:0 }];
  const save2 = () => put("xTally", L);
  const paint = () => {
    const box = q(b, "#xtL"); box.innerHTML = "";
    L.forEach((c, i) => {
      const r = E("div", "xtal", '<input maxlength="40"><button data-d="-1">−</button><b></b><button data-d="1">+</button><button data-x title="Remove" style="font-size:13px">✕</button>');
      q(r, "input").value = c.n; q(r, "b").textContent = c.v;
      q(r, "input").oninput = e => { c.n = e.target.value; save2(); };
      r.querySelectorAll("[data-d]").forEach(x => x.onclick = () => { c.v += +x.dataset.d; q(r, "b").textContent = c.v; save2(); q(r, "b").animate([{ transform:"scale(1.25)" }, { transform:"none" }], { duration:160 }); });
      q(r, "[data-x]").onclick = () => { L.splice(i, 1); save2(); paint(); };
      q(r, "b").onclick = () => { const v = prompt("Set the count", c.v); if (v != null && isFinite(+v)) { c.v = Math.round(+v); save2(); paint(); } };
      box.appendChild(r);
    });
  };
  q(b, "#xtAdd").onclick = () => { L.push({ n:"Counter " + (L.length + 1), v:0 }); save2(); paint(); };
  q(b, "#xtZero").onclick = () => { L.forEach(c => { c.v = 0; }); save2(); paint(); };
  paint();
};

/* price per unit */
BUILD.xunit = b => {
  const U = { g:["w", 1], kg:["w", 1000], oz:["w", 28.3495], lb:["w", 453.592], ml:["v", 1], l:["v", 1000], "fl oz":["v", 29.5735], gal:["v", 3785.41], items:["n", 1] };
  b.innerHTML = '<table class="xup" style="width:100%;border-collapse:collapse"><tr class="xmsg"><td>Item</td><td>Price</td><td>Size</td><td></td><td></td></tr><tbody id="xuB"></tbody></table>' +
    '<div class="xrow"><button class="b" id="xuAdd">Add a row</button></div><div id="xuOut"></div>';
  const row = (n, p, a, u) => {
    const tr = E("tr", "", '<td><input class="xin" placeholder="Name"></td><td><input class="xin" type="number" min="0" step="0.01" placeholder="2.99"></td><td><input class="xin" type="number" min="0" step="any" placeholder="500"></td><td><select class="xsel">' + Object.keys(U).map(k => "<option>" + k + "</option>").join("") + '</select></td><td><button class="b" title="Remove" style="padding:0 8px">✕</button></td>');
    const ins = tr.querySelectorAll("input"); ins[0].value = n || ""; ins[1].value = p || ""; ins[2].value = a || ""; q(tr, "select").value = u || "g";
    q(tr, "button").onclick = () => { tr.remove(); calc(); };
    tr.querySelectorAll("input,select").forEach(x => x.addEventListener("input", calc));
    q(b, "#xuB").appendChild(tr);
  };
  const calc = () => {
    const rows = [...q(b, "#xuB").children].map((tr, i) => { const ins = tr.querySelectorAll("input"), u = U[q(tr, "select").value], price = +ins[1].value, amt = +ins[2].value;
      return { tr, name:ins[0].value.trim() || "Item " + (i + 1), kind:u[0], per:price > 0 && amt > 0 ? price / (amt * u[1]) : null }; });
    rows.forEach(r => r.tr.classList.remove("best"));
    const out = [], LBL = { w:["per kg", 1000], v:["per liter", 1000], n:["each", 1] };
    ["w", "v", "n"].forEach(k => { const L = rows.filter(r => r.kind === k && r.per != null).sort((a, c) => a.per - c.per); if (!L.length) return;
      if (L.length > 1) L[0].tr.classList.add("best");
      out.push(L.map((r, i) => '<div class="xmsg' + (i === 0 && L.length > 1 ? " ok" : "") + '">' + (i === 0 && L.length > 1 ? "Best: " : "") + esc(r.name) + " · " + (r.per * LBL[k][1]).toFixed(2) + " " + LBL[k][0] +
        (i > 0 ? " (" + Math.round((r.per / L[0].per - 1) * 100) + "% more)" : "") + "</div>").join("")); });
    q(b, "#xuOut").innerHTML = out.join('<div style="height:8px"></div>') || '<div class="xmsg">Fill in a price and a size for two or more items.</div>';
  };
  q(b, "#xuAdd").onclick = () => { row(); calc(); };
  row("Small pack", "2.49", "250", "g"); row("Big pack", "6.99", "1", "kg"); row(); calc();
};

function route2() { const h = decodeURIComponent(location.hash.slice(1)); if (IDS.indexOf(h) >= 0) { show(h); after(h); } else more.classList.remove("on"); }
addEventListener("hashchange", route2);
route2();
})();
