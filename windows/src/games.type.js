
// ---------------------------------------------------------------- Typing test: words per minute
(function () {
  const WORDS = ("river paper window garden yellow simple bright happy number travel market purple orange winter summer pocket rocket " +
    "basket button candle circle dinner doctor engine family finger flower forest friend guitar hammer island jacket kitten ladder " +
    "letter little magnet mirror monkey morning muffin nature needle noodle object office parent pencil pepper person pillow planet " +
    "pretty rabbit record silver singer sister spider spring street sugar sunny table ticket tomato tunnel turtle velvet wallet water " +
    "wonder world answer before better bottle bridge castle cookie cotton desert dragon effort finish follow gentle golden ground " +
    "honest hungry invite jungle kettle lemon listen lucky meadow middle minute moment mother narrow nearly ocean orbit outside " +
    "pebble pirate puzzle quiet rather reason ribbon robot saddle second shadow shiny silent smooth socket stable stream sudden " +
    "tender thirty timber toast travel useful valley wander weekend whistle wizard wooden yogurt zebra apple beach chair cloud dance " +
    "earth flame grape horse light music night plant queen radio smile storm train voice whale young zone brave clock crisp dream " +
    "fresh giant heart juice knife laugh magic noble ocean pilot quick roast sharp tiger unity vivid wheat").split(" ");
  let words = [], pos = 0, typed = [], t0 = 0, timer = 0, len = get("typeLen", 30), done = false, chars = 0, wrongKeys = 0, keysHit = 0;
  const box = $("typeW"), inp = $("typeIn");
  function fresh() {
    words = []; for (let i = 0; i < 260; i++) { let w; do { w = WORDS[Math.random() * WORDS.length | 0]; } while (w === words[i - 1]); words.push(w); }
    pos = 0; typed = []; t0 = 0; done = false; chars = 0; wrongKeys = 0; keysHit = 0; clearInterval(timer);
    box.innerHTML = words.map((w, i) => "<span" + (i ? "" : ' class="cur"') + ">" + w + "</span>").join(" ");
    box.scrollTop = 0; inp.value = ""; inp.disabled = false;
    $("typeStat").textContent = "Start typing to begin · " + len + " s"; $("typeMsg").textContent = "";
  }
  const span = i => box.children[i];
  function tick() {
    const left = Math.max(0, len - (Date.now() - t0) / 1000), mins = Math.max(1 / 60, (Date.now() - t0) / 60000);
    $("typeStat").textContent = Math.ceil(left) + " s left · " + Math.round(chars / 5 / mins) + " wpm";
    if (left <= 0) finish();
  }
  function finish() {
    clearInterval(timer); done = true; inp.disabled = true;
    const wpm = Math.round(chars / 5 / (len / 60)), acc = keysHit ? Math.round((keysHit - wrongKeys) / keysHit * 100) : 100, right = typed.filter(Boolean).length;
    const b = bests(), best = wpm > (b.wpm || 0);
    if (best && wpm > 0) { b.wpm = wpm; put("games", b); showBest(); }
    $("typeStat").textContent = wpm + " wpm · " + acc + "% accuracy";
    $("typeMsg").textContent = right + " of " + typed.length + " words right" + (best && wpm > 0 ? " - a new best! 🏆" : "") + " · Esc or Restart for another go";
  }
  inp.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); fresh(); inp.focus(); return; }
    if (done || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1) keysHit++;
  });
  inp.addEventListener("input", () => {
    if (done) return;
    if (!t0 && inp.value.trim()) { t0 = Date.now(); timer = setInterval(tick, 200); }
    const v = inp.value;
    if (/\s$/.test(v)) {
      const w = v.trim(); inp.value = "";
      if (!w) return;
      const ok = w === words[pos]; typed.push(ok); if (ok) chars += w.length + 1;
      span(pos).className = ok ? "ok" : "bad"; pos++;
      const s = span(pos); if (!s) { finish(); return; }
      s.className = "cur";
      if (s.offsetTop - box.offsetTop > box.clientHeight / 2 + box.scrollTop - 10) {
        const lh = parseFloat(getComputedStyle(box).lineHeight), lineTop = s.offsetTop - box.offsetTop - (lh - s.offsetHeight) / 2;
        box.scrollTo({ top:lineTop - lh, behavior:"smooth" });   // keep the line before in view
      }
    } else {
      const ok = words[pos].startsWith(v);
      if (!ok && !span(pos).classList.contains("bad")) wrongKeys++;
      span(pos).className = "cur" + (ok ? "" : " bad");
    }
  });
  $("typeLen").onclick = e => { const b = e.target.closest("button"); if (!b) return; len = +b.dataset.v; put("typeLen", len); [...$("typeLen").children].forEach(x => x.classList.toggle("on", x === b)); fresh(); inp.focus(); };
  [...$("typeLen").children].forEach(x => x.classList.toggle("on", +x.dataset.v === len));
  $("typeNew").onclick = () => { fresh(); inp.focus(); };
  document.querySelector('.tabs button[data-g="typeG"]').addEventListener("click", () => setTimeout(() => inp.focus(), 50));
  fresh();
})();
