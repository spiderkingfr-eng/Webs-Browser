
// ---------------------------------------------------------------- Aim trainer: 30 seconds of targets
(function () {
  const box = $("aim"), LEN = 30;
  let on = false, hits = 0, miss = 0, t0 = 0, timer = 0, spawnT = 0, live = [];
  function pop(x, y, text) { const p = document.createElement("div"); p.className = "pop"; p.textContent = text; p.style.left = x + "px"; p.style.top = y + "px"; box.appendChild(p); setTimeout(() => p.remove(), 650); }
  function spawn() {
    if (!on) return;
    const w = box.clientWidth, h = box.clientHeight, r = 32, el = document.createElement("i");
    const x = r + Math.random() * (w - 2 * r), y = r + Math.random() * (h - 2 * r), born = performance.now(), life = Math.max(900, 1800 - hits * 18);
    el.style.left = x + "px"; el.style.top = y + "px";
    const t = { el, x, y, born, life }; live.push(t); box.appendChild(el);
    (function shrink(now) {
      if (!el.isConnected) return;
      const k = 1 - (now - born) / life;
      if (k <= 0) { el.remove(); live = live.filter(o => o !== t); miss++; stat(); return; }
      el.style.width = el.style.height = (2 * r * Math.max(.15, k)) + "px";
      requestAnimationFrame(shrink);
    })(born);
    spawnT = setTimeout(spawn, Math.max(380, 760 - hits * 9));
  }
  const stat = () => { $("aimStat").textContent = "Hits " + hits + " · " + (on ? Math.max(0, Math.ceil(LEN - (Date.now() - t0) / 1000)) + " s" : LEN + " s") + (hits + miss ? " · " + Math.round(hits / (hits + miss) * 100) + "% accuracy" : ""); };
  function start() {
    stop(true); on = true; hits = 0; miss = 0; t0 = Date.now(); box.innerHTML = ""; $("aimMsg").textContent = ""; $("aimGo").textContent = "Restart";
    timer = setInterval(() => { stat(); if (Date.now() - t0 >= LEN * 1000) stop(); }, 200);
    spawn(); stat();
  }
  function stop(quiet) {
    if (!on) return;
    on = false; clearInterval(timer); clearTimeout(spawnT); live.forEach(t => t.el.remove()); live = [];
    if (quiet) return;
    const b = bests(), best = hits > (b.aim || 0);
    if (best) { b.aim = hits; put("games", b); showBest(); }
    box.innerHTML = '<div class="aimhint"></div>';
    box.firstChild.textContent = hits + " hits · " + (hits + miss ? Math.round(hits / (hits + miss) * 100) : 0) + "% accuracy" + (best && hits ? " - a new best! 🏆" : "");
    $("aimMsg").textContent = "Press Start for another round."; $("aimGo").textContent = "Start"; stat();
  }
  box.addEventListener("pointerdown", e => {
    if (!on) { if (e.button === 0) start(); return; }
    const r = box.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const t = live.find(o => Math.hypot(o.x - x, o.y - y) <= o.el.offsetWidth / 2 + 2);
    if (t) { t.el.remove(); live = live.filter(o => o !== t); hits++; pop(x, y, "+1"); }
    else { miss++; pop(x, y, "miss"); }
    stat();
  });
  $("aimGo").onclick = start;
  // leaving the game ends the round
  document.querySelector(".tabs").addEventListener("click", () => {
    if (!on || game === "aimG") return;
    stop(true); stat(); $("aimGo").textContent = "Start";
    box.innerHTML = '<div class="aimhint">Click the targets as fast as you can. They shrink!</div>';
  });
})();
