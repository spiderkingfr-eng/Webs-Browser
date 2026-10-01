/* Webs Browser for iPhone - Tools: a calculator, unit converter, QR codes,
   passwords, a stopwatch, a focus timer, colors, text tools, a breathing
   exercise, a decision wheel and a bill splitter. All of them work offline. */
"use strict";

const TOOLS = [
  { id:"calc", name:"Calculator", desc:"With history and √, ^, %", icon:"keypad", c:"#ff9f0a" },
  { id:"units", name:"Unit converter", desc:"Length, weight, temperature…", icon:"ruler", c:"#30b0c7" },
  { id:"qr", name:"QR code maker", desc:"Text, links and Wi-Fi", icon:"qr", c:"#5e5ce6" },
  { id:"pass", name:"Password maker", desc:"Strong passwords and passphrases", icon:"key", c:"#34c759" },
  { id:"watch", name:"Stopwatch", desc:"With laps", icon:"timer", c:"#ff375f" },
  { id:"pomo", name:"Focus timer", desc:"25 minutes on, 5 off", icon:"target", c:"#e8342a" },
  { id:"color", name:"Colors", desc:"Pick a color, get palettes", icon:"palette", c:"#bf5af2" },
  { id:"text", name:"Text tools", desc:"Count, change case, clean up", icon:"type", c:"#64d2ff" },
  { id:"breathe", name:"Breathe", desc:"A minute to slow down", icon:"wind", c:"#32d74b" },
  { id:"wheel", name:"Decision wheel", desc:"Spin to decide", icon:"wheel", c:"#ffd60a" },
  { id:"bill", name:"Bill splitter", desc:"Tip and split", icon:"receipt", c:"#ff6b35" },
  { id:"clips", name:"Copy history", desc:"What you copied in Webs", icon:"paste", c:"#8e8e93" }
];
let toolStop = null;   // stops a tool's animation when you leave it
function openToolsHub() {
  if (toolStop) { toolStop(); toolStop = null; }
  openSheet("Tools", '<div class="tools">' + TOOLS.map(t => '<button type="button" class="tool" data-tool="' + t.id + '" style="--tc:' + t.c + '"><span class="ti">' + ico(t.icon) +
    "</span><b>" + esc(t.name) + "</b><span>" + esc(t.desc) + "</span></button>").join("") + "</div>", { kind:"tools", full:true });
  $("#sheetBody").onclick = e => { const b = e.target.closest("[data-tool]"); if (b) openTool(b.dataset.tool); };
}
function openTool(id, arg) {
  if (toolStop) { toolStop(); toolStop = null; }
  if (id === "clips") { ACTIONS.clips(); return; }
  const t = TOOLS.find(x => x.id === id); if (!t) return;
  openSheet(t.name, '<div class="tool-' + id + '"></div>', { kind:"tool", full:true, back:openToolsHub });
  $("#sheetBody").onclick = null;
  TOOL_UI[id]($("#sheetBody").firstElementChild, arg);
}
closeSheet = (orig => function () { if (toolStop) { toolStop(); toolStop = null; } orig.apply(this, arguments); })(closeSheet);

const TOOL_UI = {
  /* ---------------------------------------------------------------- calculator */
  calc(box) {
    let ex = "";
    const keys = [["C", "fn"], ["(", "fn"], [")", "fn"], ["⌫", "fn"], ["√", "fn"], ["^", "fn"], ["π", "fn"], ["÷", "op"], ["7"], ["8"], ["9"], ["×", "op"], ["4"], ["5"], ["6"], ["−", "op"],
      ["1"], ["2"], ["3"], ["+", "op"], ["%", "fn"], ["0"], ["."], ["=", "eq"]];
    box.innerHTML = '<div class="cdisp"><div class="cex" id="cEx">0</div><div class="cres" id="cRes"></div></div><div class="kp">' +
      keys.map(([k, c]) => '<button type="button" class="' + (c || "") + '" data-k="' + k + '">' + k + "</button>").join("") + '</div><div class="chist" id="cHist"></div>';
    const norm = s => s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt(").replace(/π/g, "pi");
    const result = () => { if (!ex) return null; if (/^-?[\d.]+$/.test(ex)) return +ex; let s = norm(ex); const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length; s += ")".repeat(Math.max(0, open)); return calc(s); };
    const hist = () => { $("#cHist").innerHTML = load("calcs", []).slice(0, 6).map(c => '<button type="button" data-h="' + esc(c.q) + '"><span>' + esc(c.q) + "</span><b>= " + esc(c.r) + "</b></button>").join(""); };
    const show = () => { $("#cEx").textContent = ex || "0"; const r = result(); $("#cRes").textContent = r != null && ex && !/^-?[\d.]+$/.test(ex) ? "= " + fmtN(r, 10) : ""; };
    box.onclick = e => {
      const h = e.target.closest("[data-h]"); if (h) { ex = h.dataset.h.replace(/\*/g, "×").replace(/\//g, "÷"); show(); return; }
      const b = e.target.closest("[data-k]"); if (!b) return;
      const k = b.dataset.k;
      if (k === "C") ex = "";
      else if (k === "⌫") ex = ex.slice(0, -1);
      else if (k === "=") {
        const r = result();
        if (r == null) { $("#cEx").classList.remove("shake"); void $("#cEx").offsetWidth; $("#cEx").classList.add("shake"); return; }
        if (!/^-?[\d.]+$/.test(ex)) { saveCalc(norm(ex), fmtN(r, 10)); hist(); }
        ex = String(r); $("#cRes").textContent = ""; $("#cEx").textContent = fmtN(r, 10); $("#cEx").classList.add("pop"); setTimeout(() => $("#cEx") && $("#cEx").classList.remove("pop"), 300); return;
      } else ex += k;
      show();
    };
    hist(); show();
  },

  /* ---------------------------------------------------------------- unit converter */
  units(box) {
    const U = {
      Length:{ mm:[.001, "Millimeters"], cm:[.01, "Centimeters"], m:[1, "Meters"], km:[1000, "Kilometers"], in:[.0254, "Inches"], ft:[.3048, "Feet"], yd:[.9144, "Yards"], mi:[1609.344, "Miles"], nmi:[1852, "Nautical miles"] },
      Weight:{ mg:[1e-6, "Milligrams"], g:[.001, "Grams"], kg:[1, "Kilograms"], t:[1000, "Tonnes"], oz:[.028349523125, "Ounces"], lb:[.45359237, "Pounds"], st:[6.35029318, "Stones"] },
      Temperature:{ c:[0, "Celsius"], f:[0, "Fahrenheit"], k:[0, "Kelvin"] },
      Volume:{ ml:[.001, "Milliliters"], l:[1, "Liters"], tsp:[.00492892, "Teaspoons"], tbsp:[.0147868, "Tablespoons"], floz:[.0295735, "Fluid ounces"], cup:[.236588, "Cups"], pt:[.473176, "Pints"], qt:[.946353, "Quarts"], gal:[3.78541, "Gallons"] },
      Speed:{ kmh:[1, "km/h"], mph:[1.609344, "mph"], ms:[3.6, "m/s"], kn:[1.852, "Knots"] },
      Area:{ m2:[1, "Square meters"], km2:[1e6, "Square kilometers"], ft2:[.092903, "Square feet"], ac:[4046.86, "Acres"], ha:[1e4, "Hectares"], mi2:[2589988, "Square miles"] },
      Data:{ b:[1, "Bytes"], kb:[1e3, "Kilobytes"], mb:[1e6, "Megabytes"], gb:[1e9, "Gigabytes"], tb:[1e12, "Terabytes"], kib:[1024, "KiB"], mib:[1048576, "MiB"], gib:[1073741824, "GiB"] },
      Time:{ s:[1, "Seconds"], min:[60, "Minutes"], h:[3600, "Hours"], d:[86400, "Days"], wk:[604800, "Weeks"], yr:[31557600, "Years"] }
    };
    const st = load("unitTool", { cat:"Length", a:"cm", b:"in", v:"100" });
    const opts = (cat, cur) => Object.keys(U[cat]).map(k => '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(U[cat][k][1]) + "</option>").join("");
    const draw = () => {
      box.innerHTML = '<div class="chips wrapc" id="uCat">' + Object.keys(U).map(c => '<button type="button" data-c="' + c + '" class="' + (c === st.cat ? "on" : "") + '">' + c + "</button>").join("") + "</div>" +
        '<div class="ucard"><input id="uV" inputmode="decimal" value="' + esc(st.v) + '" aria-label="Value"><select id="uA">' + opts(st.cat, st.a) + '</select></div>' +
        '<button type="button" class="uswap" id="uSwap" aria-label="Swap">⇅</button><div class="ucard out"><output id="uOut"></output><select id="uB">' + opts(st.cat, st.b) + "</select></div>" +
        '<div class="card" id="uAll"></div>';
      const conv = (v, a, b) => {
        if (st.cat === "Temperature") { const c = a === "c" ? v : a === "f" ? (v - 32) * 5 / 9 : v - 273.15; return b === "c" ? c : b === "f" ? c * 9 / 5 + 32 : c + 273.15; }
        return v * U[st.cat][a][0] / U[st.cat][b][0];
      };
      const upd = () => {
        st.v = $("#uV").value; st.a = $("#uA").value; st.b = $("#uB").value; save("unitTool", st);
        const v = parseFloat(st.v.replace(",", "."));
        $("#uOut").textContent = isNaN(v) ? "" : fmtN(+conv(v, st.a, st.b).toPrecision(10), 8);
        $("#uAll").innerHTML = isNaN(v) ? "" : Object.keys(U[st.cat]).filter(k => k !== st.a).map(k => '<button type="button" class="srow btn" data-copy="' + +conv(v, st.a, k).toPrecision(10) + '"><span class="k">' + esc(U[st.cat][k][1]) +
          '</span><span class="v">' + fmtN(+conv(v, st.a, k).toPrecision(10), 8) + "</span></button>").join("");
      };
      $("#uV").oninput = upd; $("#uA").onchange = upd; $("#uB").onchange = upd;
      $("#uSwap").onclick = () => { [st.a, st.b] = [st.b, st.a]; draw(); };
      $("#uCat").onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; st.cat = b.dataset.c; const k = Object.keys(U[st.cat]); st.a = k[0]; st.b = k[1]; draw(); };
      $("#uAll").onclick = e => { const r = e.target.closest("[data-copy]"); if (r) copyText(r.dataset.copy); };
      upd();
    };
    draw();
  },

  /* ---------------------------------------------------------------- QR codes */
  qr(box, arg) {
    let mode = "text", counted = false;
    const t0 = curTab();
    box.innerHTML = '<div class="seg" id="qrMode"><button type="button" data-v="text" class="on">Text or link</button><button type="button" data-v="wifi">Wi-Fi</button></div>' +
      '<div id="qrIn"></div><div class="qrbox"><canvas id="qrC" width="600" height="600"></canvas></div><div class="acts" style="justify-content:center"><button type="button" class="btnx m" id="qrShare">' +
      ico("share") + 'Share or save</button><button type="button" class="btnx" id="qrCopy">' + ico("copy") + "Copy text</button></div>";
    const draw = () => {
      let text = "";
      if (mode === "text") text = $("#qrT").value;
      else { const ss = $("#qrS").value, pw = $("#qrP").value, sec = $("#qrE").value, e = s => s.replace(/([\\;,:"])/g, "\\$1"); if (ss) text = "WIFI:T:" + sec + ";S:" + e(ss) + ";" + (sec !== "nopass" ? "P:" + e(pw) + ";" : "") + ";"; }
      const c = $("#qrC"), g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 600);
      const q = text && qrMake(text);
      if (!q) { g.fillStyle = "#999"; g.font = "28px -apple-system, system-ui"; g.textAlign = "center"; g.fillText(text ? "Too long for a QR code" : "Type something above", 300, 310); c.dataset.text = ""; return; }
      const n = q.getModuleCount(), cell = Math.floor(600 / (n + 4)), off = Math.floor((600 - cell * n) / 2);
      g.fillStyle = "#000";
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
      c.dataset.text = text;
      if (!counted) { counted = true; stat("qr"); }
    };
    const inputs = () => {
      $("#qrIn").innerHTML = mode === "text" ? '<textarea id="qrT" class="field ta" placeholder="Text or a link" maxlength="1200"></textarea>' :
        '<input id="qrS" class="field" placeholder="Network name" autocapitalize="off" autocorrect="off"><input id="qrP" class="field" placeholder="Password" autocapitalize="off" autocorrect="off">' +
        '<select id="qrE" class="field"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">No password</option></select>';
      $$("#qrIn input, #qrIn textarea, #qrIn select").forEach(el => { el.oninput = draw; el.onchange = draw; });
      if (mode === "text") $("#qrT").value = arg != null ? arg : t0 && t0.u && !t0.internal ? t0.u : "";
      draw();
    };
    $("#qrMode").onclick = e => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.v; $$("#qrMode button").forEach(x => x.classList.toggle("on", x === b)); inputs(); };
    $("#qrShare").onclick = () => { const c = $("#qrC"); if (!c.dataset.text) return; c.toBlob(b => saveFile(b, "QR code.png", "QR code saved")); };
    $("#qrCopy").onclick = () => { const t = $("#qrC").dataset.text; if (t) copyText(t); };
    inputs();
  },

  /* ---------------------------------------------------------------- passwords */
  pass(box) {
    const st = load("passTool", { mode:"random", len:20, up:true, num:true, sym:true, sim:true, words:5 });
    const WORDS = "acorn amber anchor apple arrow atlas autumn badge bagel bamboo banjo beacon berry bison blaze bloom bolt bonus brave breeze brick bridge bronze bubble cactus camel candle canyon carbon cargo cedar chalk charm cherry cider citrus clover cobalt comet coral cosmic cotton crane crystal cup daisy delta denim desert dingo dolphin dragon drift eagle echo ember emerald falcon feather fern fiesta flame flint forest fossil frost galaxy garnet gecko ginger glacier globe granite gravel harbor hazel helium hero hollow honey horizon husky iceberg igloo indigo island ivory jade jasmine jelly jungle karma kayak kettle kiwi koala lagoon lantern laser lava lemon lily lizard lotus lunar magnet mango maple marble meadow meteor mint mocha moose mosaic nectar neon nimbus noodle nova oasis ocean olive onyx opal orbit orchid otter oyster panda papaya pebble pepper piano pilot pixel planet plasma plum polar poppy prism puffin pumpkin quartz quasar radar raven reef ripple river rocket ruby saffron salmon satin scarlet shadow sierra silver sketch socket solar sonic spark sphinx spruce squid stellar stone summit sunset tango thunder tiger timber topaz torch tulip tundra turbo twilight umber valley velvet violet vortex walnut willow wizard yeti zebra zenith zephyr".split(" ");
    const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
    const make = () => {
      if (st.mode === "words") {
        const w = Array.from({ length:st.words }, () => { const x = WORDS[rnd(WORDS.length)]; return st.up ? x[0].toUpperCase() + x.slice(1) : x; });
        if (st.num) w.push(String(rnd(90) + 10));
        return { pw:w.join(st.sym ? "-" : " "), bits:st.words * Math.log2(WORDS.length) + (st.num ? 6.5 : 0) };
      }
      let lo = "abcdefghijkmnopqrstuvwxyz", up = "ABCDEFGHJKLMNPQRSTUVWXYZ", nu = "23456789", sy = "!@#$%^&*-_=+?";
      if (!st.sim) { lo += "l"; up += "IO"; nu += "01"; }
      const sets = [lo].concat(st.up ? [up] : [], st.num ? [nu] : [], st.sym ? [sy] : []), all = sets.join("");
      const p = sets.map(s => s[rnd(s.length)]);
      while (p.length < st.len) p.push(all[rnd(all.length)]);
      for (let i = p.length - 1; i > 0; i--) { const j = rnd(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
      return { pw:p.join(""), bits:st.len * Math.log2(all.length) };
    };
    const draw = () => {
      save("passTool", st);
      const r = make(), lvl = r.bits < 50 ? 0 : r.bits < 70 ? 1 : r.bits < 100 ? 2 : 3;
      box.innerHTML = '<div class="seg" id="pMode"><button type="button" data-v="random" class="' + (st.mode !== "words" ? "on" : "") + '">Random</button><button type="button" data-v="words" class="' + (st.mode === "words" ? "on" : "") + '">Passphrase</button></div>' +
        '<div class="pout"><code id="pOut">' + esc(r.pw) + '</code><div class="pmeter l' + lvl + '"><i></i><i></i><i></i><i></i></div><span>' + ["Weak", "Fair", "Strong", "Very strong"][lvl] + " · " + Math.round(r.bits) + " bits</span></div>" +
        '<div class="acts" style="justify-content:center"><button type="button" class="btnx m" id="pCopy">' + ico("copy") + 'Copy</button><button type="button" class="btnx" id="pNew">' + ico("rel") + "New one</button></div>" +
        GROUP("", (st.mode === "words" ? ROW("Words: " + st.words, '<input type="range" id="pLen" min="3" max="10" value="' + st.words + '">') : ROW("Length: " + st.len, '<input type="range" id="pLen" min="8" max="64" value="' + st.len + '">')) +
          SW("up", st.mode === "words" ? "Capitalize words" : "Capital letters", "", st.up) + SW("num", st.mode === "words" ? "Add a number" : "Numbers", "", st.num) +
          SW("sym", st.mode === "words" ? "Join with dashes" : "Symbols", "", st.sym) + (st.mode !== "words" ? SW("sim", "Avoid look-alikes (l, 1, O, 0)", "", st.sim) : "")) +
        '<p class="note" style="margin:0 6px">Made on this iPhone with its secure random generator. Nothing is sent or kept.</p>';
      $("#pMode").onclick = e => { const b = e.target.closest("button"); if (b) { st.mode = b.dataset.v; draw(); } };
      $("#pLen").oninput = e => { if (st.mode === "words") st.words = +e.target.value; else st.len = +e.target.value; draw(); };
      $$(".tool-pass [data-k]").forEach(el => { el.onchange = () => { st[el.dataset.k] = el.checked; draw(); }; });
      $("#pCopy").onclick = () => copyText($("#pOut").textContent);
      $("#pNew").onclick = () => { draw(); $("#pOut").classList.add("pop"); };
    };
    draw();
  },

  /* ---------------------------------------------------------------- stopwatch (keeps running while you do other things) */
  watch(box) {
    const st = load("swatch", { start:0, acc:0, run:false, laps:[] });
    const now = () => st.acc + (st.run ? Date.now() - st.start : 0);
    const fmt = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), c = Math.floor(ms % 1000 / 10); return (m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0") + "." + String(c).padStart(2, "0"); };
    box.innerHTML = '<div class="swd" id="swD">00:00.00</div><div class="swb"><button type="button" class="round" id="swL">Lap</button><button type="button" class="round go" id="swS">Start</button></div><div class="card" id="swLaps"></div>';
    const laps = () => {
      const l = st.laps, d = l.map((x, i) => x - (l[i - 1] || 0)), mx = Math.max(...d), mn = Math.min(...d);
      $("#swLaps").innerHTML = l.map((x, i) => i).reverse().map(i => '<div class="srow"><span class="k">Lap ' + (i + 1) + '</span><span class="v ' + (l.length > 2 && d[i] === mn ? "best" : l.length > 2 && d[i] === mx ? "worst" : "") + '">' + fmt(d[i]) + "</span></div>").join("");
      $("#swLaps").classList.toggle("hide", !l.length);
    };
    const btns = () => { $("#swS").textContent = st.run ? "Stop" : now() ? "Resume" : "Start"; $("#swS").classList.toggle("stop", st.run); $("#swL").textContent = st.run || !now() ? "Lap" : "Reset"; save("swatch", st); };
    let raf = 0;
    const tickW = () => { const d = $("#swD"); if (!d) return; d.textContent = fmt(now()); raf = requestAnimationFrame(tickW); };
    $("#swS").onclick = () => { if (st.run) { st.acc = now(); st.run = false; } else { st.start = Date.now(); st.run = true; } btns(); };
    $("#swL").onclick = () => { if (st.run) { st.laps.push(now()); laps(); } else { st.acc = 0; st.laps = []; laps(); $("#swD").textContent = fmt(0); } btns(); };
    btns(); laps(); tickW();
    toolStop = () => cancelAnimationFrame(raf);
  },

  /* ---------------------------------------------------------------- focus timer (Pomodoro), on top of the address bar's timers */
  pomo(box) {
    const C = 2 * Math.PI * 88;
    box.innerHTML = '<div class="pring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" class="tr"/><circle cx="100" cy="100" r="88" class="pg" id="pgC" style="stroke-dasharray:' + C + '"/></svg>' +
      '<div class="pt"><b id="pgT">25:00</b><span id="pgL">Ready to focus</span></div></div><div class="acts" style="justify-content:center" id="pgB"></div>' +
      '<p class="note" style="text-align:center;margin-top:14px">25 minutes of focus, then a 5 minute break - a longer one after every fourth round. It rings while Webs is open, and keeps going if you leave this screen.</p>';
    const cur = () => load("timers", []).find(t => t.pomo);
    const draw = () => {
      const t = cur(), c = $("#pgC"); if (!c) return;
      if (t) {
        const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
        $("#pgT").textContent = fmtClock(left);
        $("#pgL").textContent = (t.label === "Focus" ? "Focus · round " + t.pomo : "Break") + " · ends " + new Date(t.end).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
        c.style.strokeDashoffset = C * (1 - left / t.secs);
        box.classList.toggle("brk", t.label !== "Focus");
      } else { $("#pgT").textContent = "25:00"; $("#pgL").textContent = "Ready to focus"; c.style.strokeDashoffset = C; box.classList.remove("brk"); }
      const want = t ? "run" : "idle";
      if ($("#pgB").dataset.s !== want) {
        $("#pgB").dataset.s = want;
        $("#pgB").innerHTML = t ? '<button type="button" class="btnx" id="pgSkip">' + ico("fwd") + 'Skip</button><button type="button" class="btnx" id="pgStop">' + ico("x") + "Stop</button>"
                                : '<button type="button" class="btnx m" id="pgGo">' + ico("target") + 'Start focusing</button><button type="button" class="btnx" id="pgBreak">☕ Take a break</button>';
      }
    };
    const start = (label, secs, n) => {
      try { ringCtx = ringCtx || new AudioContext(); ringCtx.resume(); } catch (e) {}
      const l = load("timers", []).filter(t => !t.pomo);
      l.push({ id:uid(), end:Date.now() + secs * 1000, secs, label, pomo:n || 1 }); save("timers", l); draw();
    };
    $("#pgB").onclick = e => {
      if (e.target.closest("#pgGo")) start("Focus", 25 * 60, 1);
      else if (e.target.closest("#pgBreak")) start("Break", 5 * 60, 1);
      else if (e.target.closest("#pgStop")) { save("timers", load("timers", []).filter(t => !t.pomo)); draw(); }
      else if (e.target.closest("#pgSkip")) { const l = load("timers", []), t = l.find(x => x.pomo); if (t) { t.end = Date.now(); save("timers", l); } }
    };
    draw();
    const iv = setInterval(draw, 500);
    toolStop = () => clearInterval(iv);
  },

  /* ---------------------------------------------------------------- colors */
  color(box) {
    let hex = (load("colorTool", "") || cfg.accent || "#e8342a").toLowerCase();
    const hsl = h => { const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      let H = 0, S = 0; if (mx !== mn) { const d = mx - mn; S = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); H = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; } return [H, S * 100, l * 100]; };
    const H = (h, s, l) => "#" + hslToHex(((h % 360) + 360) % 360, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l)));
    const draw = () => {
      save("colorTool", hex);
      const [h, s, l] = hsl(hex), r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      const lum = (.299 * r + .587 * g + .114 * b) / 255;
      const pal = { Complementary:[hex, H(h + 180, s, l)], Analogous:[H(h - 30, s, l), hex, H(h + 30, s, l)], Triadic:[hex, H(h + 120, s, l), H(h + 240, s, l)],
        Shades:[10, 25, 40, 55, 70, 85].map(x => H(h, s, x)) };
      box.innerHTML = '<label class="cbig" style="background:' + hex + ";color:" + (lum > .6 ? "#111" : "#fff") + '"><input type="color" id="colIn" value="' + hex + '"><b>' + hex.toUpperCase() + "</b><span>Tap to pick a color</span></label>" +
        '<div class="card">' + [["HEX", hex.toUpperCase()], ["RGB", "rgb(" + r + ", " + g + ", " + b + ")"], ["HSL", "hsl(" + Math.round(h) + ", " + Math.round(s) + "%, " + Math.round(l) + "%)"]]
          .map(([k, v]) => '<button type="button" class="srow btn" data-copy="' + v + '"><span class="k">' + k + '</span><span class="v">' + v + "</span>" + ico("copy") + "</button>").join("") + "</div>" +
        Object.keys(pal).map(k => '<div class="day">' + k + '</div><div class="pal">' + pal[k].map(c => '<button type="button" style="background:' + c + '" data-pick="' + c + '" aria-label="' + c + '"><span>' + c.toUpperCase() + "</span></button>").join("") + "</div>").join("") +
        '<div class="acts"><button type="button" class="btnx m" id="colAcc">' + ico("palette") + "Use as Webs' accent color</button></div>";
      $("#colIn").oninput = e => { hex = e.target.value.toLowerCase(); draw(); };
    };
    box.onclick = e => {
      const c = e.target.closest("[data-copy]"); if (c) { copyText(c.dataset.copy); return; }
      const p = e.target.closest("[data-pick]"); if (p) { if (p.dataset.pick === hex) copyText(hex.toUpperCase()); else { hex = p.dataset.pick; draw(); } return; }
      if (e.target.closest("#colAcc")) { setCfg("accent", hex); applyLook(); toast("Accent color changed"); checkAch(); }
    };
    draw();
  },

  /* ---------------------------------------------------------------- text tools */
  text(box) {
    box.innerHTML = '<textarea id="txIn" class="field ta big" placeholder="Paste or type text here"></textarea><div class="txs" id="txS"></div><div class="chips wrapc" id="txB">' +
      [["up", "UPPERCASE"], ["low", "lowercase"], ["title", "Title Case"], ["sent", "Sentence case"], ["trim", "Fix spaces"], ["join", "Join lines"], ["sort", "Sort lines"], ["uniq", "Remove duplicate lines"],
       ["rev", "Reverse"], ["copy", "Copy"], ["clear", "Clear"]].map(([k, l]) => '<button type="button" data-t="' + k + '">' + l + "</button>").join("") + "</div>";
    const ta = $("#txIn");
    ta.value = load("textTool", "");
    const stats = () => {
      const t = ta.value, w = (t.match(/\S+/g) || []).length;
      save("textTool", t.slice(0, 20000));
      $("#txS").innerHTML = [[w, "words"], [t.length, "characters"], [t.replace(/\s/g, "").length, "no spaces"], [t ? t.split("\n").length : 0, "lines"], [(t.match(/[.!?]+(\s|$)/g) || []).length, "sentences"],
        [Math.ceil(w / 230), "min read"]].map(([n, l]) => "<div><b>" + fmtN(n, 0) + "</b><span>" + l + "</span></div>").join("");
    };
    ta.oninput = stats;
    $("#txB").onclick = e => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      const t = ta.value, k = b.dataset.t, lines = t.split("\n");
      const v = k === "up" ? t.toUpperCase() : k === "low" ? t.toLowerCase() : k === "title" ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) :
        k === "sent" ? t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()) : k === "trim" ? lines.map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n") :
        k === "join" ? t.replace(/\s*\n+\s*/g, " ").trim() : k === "sort" ? lines.slice().sort((a, c) => a.localeCompare(c)).join("\n") : k === "uniq" ? [...new Set(lines)].join("\n") :
        k === "rev" ? [...t].reverse().join("") : k === "clear" ? "" : null;
      if (k === "copy") { copyText(t); return; }
      ta.value = v; stats(); ta.classList.remove("pop"); void ta.offsetWidth; ta.classList.add("pop");
    };
    stats();
  },

  /* ---------------------------------------------------------------- breathing */
  breathe(box) {
    const P = { calm:["Calm", [["Breathe in", 4], ["Breathe out", 6]]], box:["Box", [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]]], relax:["4-7-8", [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]]] };
    let kind = load("breathTool", "calm"), timer = 0, running = false, round = 0;
    box.innerHTML = '<div class="seg" id="brK">' + Object.keys(P).map(k => '<button type="button" data-v="' + k + '" class="' + (k === kind ? "on" : "") + '">' + P[k][0] + "</button>").join("") + "</div>" +
      '<div class="brw"><div class="brc" id="brC"></div><div class="brt"><b id="brT">Ready</b><span id="brN">Four rounds, about a minute</span></div></div>' +
      '<div class="acts" style="justify-content:center"><button type="button" class="btnx m" id="brGo">' + ico("wind") + "Start</button></div>";
    const c = $("#brC");
    const stop = (msg) => { clearTimeout(timer); running = false; c.style.transition = "transform .8s ease"; c.style.transform = "scale(.55)"; c.className = "brc"; $("#brT").textContent = msg || "Ready"; $("#brGo").innerHTML = ico("wind") + "Start"; };
    const step = (i) => {
      const seq = P[kind][1];
      if (i >= seq.length) { round++; if (round >= 4) { stop("Well done"); $("#brN").textContent = "Four rounds done. How do you feel?"; stat("breaths"); return; } i = 0; }
      const [label, secs] = seq[i];
      $("#brT").textContent = label; $("#brN").textContent = "Round " + (round + 1) + " of 4 · " + secs + " s";
      c.style.transition = "transform " + secs + "s cubic-bezier(.45,0,.55,1)";
      c.className = "brc " + (label === "Hold" ? "hold" : label === "Breathe in" ? "in" : "out");
      if (label !== "Hold") c.style.transform = label === "Breathe in" ? "scale(1)" : "scale(.55)";
      timer = setTimeout(() => step(i + 1), secs * 1000);
    };
    $("#brGo").onclick = () => { if (running) { stop(); return; } running = true; round = 0; $("#brGo").innerHTML = ico("x") + "Stop"; step(0); };
    $("#brK").onclick = e => { const b = e.target.closest("button"); if (!b) return; kind = b.dataset.v; save("breathTool", kind); $$("#brK button").forEach(x => x.classList.toggle("on", x === b)); stop(); };
    c.style.transform = "scale(.55)";
    toolStop = () => clearTimeout(timer);
  },

  /* ---------------------------------------------------------------- decision wheel */
  wheel(box) {
    let opts = load("wheel", ["Pizza", "Tacos", "Sushi", "Burgers", "Pasta", "Salad"]), angle = 0, spinning = false;
    box.innerHTML = '<div class="wheelw"><div class="wptr"></div><canvas id="whC" width="640" height="640"></canvas><div class="wres" id="whR"></div></div>' +
      '<div class="acts" style="justify-content:center"><button type="button" class="btnx m" id="whGo">' + ico("wheel") + "Spin</button></div>" +
      '<label class="lab">Choices, one per line</label><textarea id="whO" class="field ta" maxlength="1000"></textarea>';
    const cols = ["#e8342a", "#ff9f0a", "#ffd60a", "#34c759", "#30b0c7", "#5e5ce6", "#bf5af2", "#ff375f", "#64d2ff", "#ac8e68"];
    const draw = () => {
      const c = $("#whC"), g = c.getContext("2d"), n = Math.max(1, opts.length), R = 310;
      g.clearRect(0, 0, 640, 640);
      opts.forEach((o, i) => {
        const a0 = i / n * 2 * Math.PI - Math.PI / 2, a1 = (i + 1) / n * 2 * Math.PI - Math.PI / 2;
        g.beginPath(); g.moveTo(320, 320); g.arc(320, 320, R, a0, a1); g.closePath(); g.fillStyle = cols[i % cols.length]; g.fill();
        g.save(); g.translate(320, 320); g.rotate((a0 + a1) / 2); g.fillStyle = "#fff"; g.font = "600 " + (n > 8 ? 24 : 30) + "px -apple-system, system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle";
        g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 4; g.fillText(o.length > 16 ? o.slice(0, 15) + "…" : o, R - 24, 0); g.restore();
      });
      g.beginPath(); g.arc(320, 320, 34, 0, 7); g.fillStyle = "#fff"; g.fill();
    };
    $("#whO").value = opts.join("\n");
    $("#whO").oninput = e => { opts = e.target.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 20); if (!opts.length) opts = ["?"]; save("wheel", opts); draw(); };
    $("#whGo").onclick = () => {
      if (spinning || opts.length < 2) { if (opts.length < 2) toast("Add at least two choices"); return; }
      spinning = true; $("#whR").classList.remove("on");
      const a = new Uint32Array(1); crypto.getRandomValues(a);
      angle += 360 * 5 + a[0] % 360;
      const c = $("#whC"); c.style.transition = "transform 4.2s cubic-bezier(.12,.6,.1,1)"; c.style.transform = "rotate(" + angle + "deg)";
      setTimeout(() => {
        spinning = false;
        const n = opts.length, at = ((360 - angle % 360) % 360) / 360, won = opts[Math.floor(at * n) % n];
        $("#whR").textContent = won; $("#whR").classList.add("on");
        confetti($("#whR")); stat("spins");
      }, 4300);
    };
    draw();
  },

  /* ---------------------------------------------------------------- bill splitter */
  bill(box) {
    const st = load("billTool", { amt:"", tip:18, n:2, round:false });
    box.innerHTML = '<div class="ucard"><span class="cur">' + esc((0).toLocaleString(undefined, { style:"currency", currency:/^en-(GB)$/i.test(navigator.language) ? "GBP" : /^en-US$/i.test(navigator.language) ? "USD" : "EUR" }).replace(/[\d.,\s]/g, "")) +
      '</span><input id="bA" inputmode="decimal" placeholder="Bill amount" value="' + esc(st.amt) + '"></div>' +
      '<div class="srow col"><span class="k">Tip: <b id="bTv">' + st.tip + '%</b></span><input type="range" id="bT" min="0" max="30" value="' + st.tip + '"><div class="chips">' + [0, 10, 15, 18, 20, 25].map(t => '<button type="button" data-tp="' + t + '">' + t + "%</button>").join("") + "</div></div>" +
      '<div class="srow"><span class="k">People</span><div class="step"><button type="button" id="bM">−</button><b id="bN">' + st.n + '</b><button type="button" id="bP">+</button></div></div>' +
      SW("round", "Round each share up", "", st.round) + '<div class="bres" id="bR"></div>';
    const upd = () => {
      st.amt = $("#bA").value; save("billTool", st);
      $("#bTv").textContent = st.tip + "%"; $("#bN").textContent = st.n;
      $$(".tool-bill [data-tp]").forEach(b => b.classList.toggle("on", +b.dataset.tp === st.tip));
      const a = parseFloat(String(st.amt).replace(",", ".")) || 0, tip = a * st.tip / 100, tot = a + tip;
      let each = tot / st.n; if (st.round) each = Math.ceil(each);
      $("#bR").innerHTML = '<div><span>Tip</span><b>' + money(tip) + '</b></div><div><span>Total</span><b>' + money(st.round ? each * st.n : tot) + '</b></div><div class="big"><span>Each person pays</span><b>' + money(each) + "</b></div>";
    };
    $("#bA").oninput = upd;
    $("#bT").oninput = e => { st.tip = +e.target.value; upd(); };
    box.onclick = e => {
      const tp = e.target.closest("[data-tp]"); if (tp) { st.tip = +tp.dataset.tp; $("#bT").value = st.tip; upd(); return; }
      if (e.target.closest("#bM")) { st.n = Math.max(1, st.n - 1); upd(); } else if (e.target.closest("#bP")) { st.n = Math.min(50, st.n + 1); upd(); }
    };
    box.onchange = e => { if (e.target.dataset.k === "round") { st.round = e.target.checked; upd(); } };
    upd();
  }
};

ACTIONS.tools = openToolsHub;
