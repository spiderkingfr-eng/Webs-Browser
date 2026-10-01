// ---------------------------------------------------------------- Tic-tac-toe: you are X; the computer plays O
(function () {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let bd, over, turn = "X", youFirst = true, lvl = get("tttLvl", "hard"), score = get("tttScore", { w:0, d:0, l:0 });
  const box = $("ttt");
  for (let i = 0; i < 9; i++) { const c = document.createElement("button"); c.dataset.i = i; c.setAttribute("aria-label", "Square " + (i + 1)); box.appendChild(c); }
  const winner = b => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { p:b[l[0]], l }; return b.every(Boolean) ? { p:"draw" } : null; };
  function minimax(b, me) {
    const w = winner(b);
    if (w) return { s:w.p === "O" ? 10 : w.p === "X" ? -10 : 0 };
    let best = { s:me ? -99 : 99, i:-1 };
    b.forEach((v, i) => {
      if (v) return;
      b[i] = me ? "O" : "X";
      const r = minimax(b, !me); r.s += me ? -0.1 : 0.1;
      b[i] = null;
      if (me ? r.s > best.s : r.s < best.s) best = { s:r.s, i };
    });
    return best;
  }
  function cpu() {
    const free = bd.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    let i;
    if (lvl === "hard") i = bd.every(v => !v) ? [0, 2, 4, 6, 8][Math.random() * 5 | 0] : minimax(bd.slice(), true).i;
    else {
      // easy: wins when it can, blocks half the time, otherwise anywhere
      const tryWin = p => free.find(f => { const b = bd.slice(); b[f] = p; const w = winner(b); return w && w.p === p; });
      i = tryWin("O"); if (i == null && Math.random() < .5) i = tryWin("X"); if (i == null) i = free[Math.random() * free.length | 0];
    }
    bd[i] = "O"; draw(); turn = "X";
    if (!check()) $("tttMsg").textContent = "Your turn.";
  }
  function check() {
    const w = winner(bd); if (!w) return false;
    over = true;
    if (w.l) w.l.forEach(i => box.children[i].classList.add("win"));
    if (w.p === "X") { score.w++; $("tttMsg").textContent = "You win! 🎉"; const b = bests(); b.tttWins = (b.tttWins || 0) + 1; put("games", b); showBest(); }
    else if (w.p === "O") { score.l++; $("tttMsg").textContent = lvl === "hard" ? "The computer wins. It never loses on Unbeatable." : "The computer wins this time."; }
    else { score.d++; $("tttMsg").textContent = "A draw."; }
    put("tttScore", score); scoreLine();
    return true;
  }
  const scoreLine = () => { $("tttScore").textContent = "You " + score.w + " · Draws " + score.d + " · Computer " + score.l; };
  function draw() { bd.forEach((v, i) => { const c = box.children[i]; if (c.textContent !== (v || "")) { c.textContent = v || ""; c.className = v ? v.toLowerCase() : ""; } }); }
  function fresh() {
    bd = Array(9).fill(null); over = false; [...box.children].forEach(c => { c.textContent = ""; c.className = ""; });
    $("tttMsg").textContent = youFirst ? "Your turn. You're X." : "The computer goes first.";
    turn = youFirst ? "X" : "O";
    if (!youFirst) setTimeout(cpu, 350);
    youFirst = !youFirst;   // take turns starting
  }
  box.onclick = e => {
    const c = e.target.closest("button"); if (!c || over || turn !== "X" || bd[+c.dataset.i]) return;
    bd[+c.dataset.i] = "X"; draw(); turn = "O";
    if (!check()) { $("tttMsg").textContent = "…"; setTimeout(cpu, 380); }
  };
  $("tttLvl").onclick = e => { const b = e.target.closest("button"); if (!b) return; lvl = b.dataset.v; put("tttLvl", lvl); [...$("tttLvl").children].forEach(x => x.classList.toggle("on", x === b)); youFirst = true; fresh(); };
  [...$("tttLvl").children].forEach(x => x.classList.toggle("on", x.dataset.v === lvl));
  $("tttNew").onclick = fresh;
  scoreLine(); fresh();
})();

// ---------------------------------------------------------------- Memory: find the eight pairs
(function () {
  const SETS = [["🍎", "🍌", "🍇", "🍓", "🍒", "🥝", "🍍", "🍉"], ["🐶", "🐱", "🦊", "🐼", "🐸", "🐵", "🦁", "🐯"], ["⚽", "🏀", "🏈", "🎾", "🏐", "🎱", "🏓", "🥏"], ["🚀", "🛸", "🌙", "⭐", "🪐", "🌍", "🌈", "🔥"]];
  let cards = [], open = [], moves = 0, found = 0, t0 = 0, timer = 0, lock = false;
  const box = $("mem");
  function fresh() {
    const set = SETS[Math.random() * SETS.length | 0];
    cards = set.concat(set);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cards[i], cards[j]] = [cards[j], cards[i]]; }
    open = []; moves = 0; found = 0; t0 = 0; lock = false; clearInterval(timer);
    box.innerHTML = cards.map((c, i) => '<button class="mc" data-i="' + i + '" aria-label="Card"><i></i><b>' + c + "</b></button>").join("");
    $("memMsg").textContent = "Flip two cards at a time to find the pairs.";
    stat();
  }
  const stat = () => { $("memStat").textContent = "Moves " + moves + " · " + fmtT(t0 ? Math.floor((Date.now() - t0) / 1000) : 0); };
  box.onclick = e => {
    const c = e.target.closest(".mc"); if (!c || lock || c.classList.contains("up") || c.classList.contains("ok")) return;
    if (!t0) { t0 = Date.now(); timer = setInterval(stat, 1000); }
    c.classList.add("up"); open.push(c);
    if (open.length < 2) return;
    moves++; stat();
    const [a, b] = open; open = [];
    if (cards[a.dataset.i] === cards[b.dataset.i]) {
      a.classList.add("ok"); b.classList.add("ok"); found++;
      if (found === 8) {
        clearInterval(timer);
        const bb = bests(), best = !bb.mem || moves < bb.mem;
        if (best) { bb.mem = moves; put("games", bb); showBest(); }
        $("memMsg").textContent = "All pairs in " + moves + " moves and " + fmtT(Math.floor((Date.now() - t0) / 1000)) + (best ? " - a new best! 🏆" : " 🎉");
      }
    } else { lock = true; setTimeout(() => { a.classList.remove("up"); b.classList.remove("up"); lock = false; }, 750); }
  };
  $("memNew").onclick = fresh;
  fresh();
})();

// ---------------------------------------------------------------- Minesweeper: the first click is always safe; right-click flags
(function () {
  const LV = { easy:[9, 10], med:[12, 22], hard:[16, 40] };
  let lvl = get("mineLvl", "easy"), N, M, mines, open, flag, dead, won, started, t0 = 0, timer = 0;
  const box = $("mine");
  const around = i => { const r = i / N | 0, c = i % N, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc); } return out; };
  const count = i => around(i).filter(j => mines[j]).length;
  function fresh() {
    [N, M] = LV[lvl]; mines = Array(N * N).fill(false); open = Array(N * N).fill(false); flag = Array(N * N).fill(false); dead = won = started = false; t0 = 0; clearInterval(timer);
    box.style.gridTemplateColumns = "repeat(" + N + ",1fr)";
    box.innerHTML = Array.from({ length:N * N }, (_, i) => '<button data-i="' + i + '"></button>').join("");
    $("mineMsg").textContent = "Click to dig, right-click to flag a mine. Click a number whose flags are all placed to dig around it.";
    stat();
  }
  const stat = () => { $("mineStat").textContent = "💣 " + (M - flag.filter(Boolean).length) + " · " + fmtT(t0 ? Math.floor((Date.now() - t0) / 1000) : 0); };
  function plant(safe) {
    const no = new Set([safe].concat(around(safe)));
    let n = 0; while (n < M) { const i = Math.random() * N * N | 0; if (!mines[i] && !no.has(i)) { mines[i] = true; n++; } }
    started = true; t0 = Date.now(); timer = setInterval(stat, 1000);
  }
  function dig(i) {
    if (open[i] || flag[i]) return;
    const stack = [i];
    while (stack.length) {
      const k = stack.pop(); if (open[k] || flag[k]) continue;
      open[k] = true;
      const b = box.children[k], n = count(k);
      b.classList.add("open"); if (n && !mines[k]) { b.textContent = n; b.classList.add("n" + n); }
      if (!n && !mines[k]) around(k).forEach(j => { if (!open[j]) stack.push(j); });
    }
  }
  function end(win) {
    clearInterval(timer);
    if (win) {
      won = true; const s = Math.floor((Date.now() - t0) / 1000), bb = bests(), key = lvl === "easy" ? "mine" : "mine_" + lvl, best = !bb[key] || s < bb[key];
      if (best) { bb[key] = s; put("games", bb); showBest(); }
      $("mineMsg").textContent = "Cleared in " + fmtT(s) + (best ? " - a new best! 🏆" : " 🎉");
      mines.forEach((m, i) => { if (m) box.children[i].textContent = "🚩"; });
    } else {
      dead = true; $("mineMsg").textContent = "Boom 💥 Click New game to try again.";
      mines.forEach((m, i) => { if (m) { box.children[i].textContent = "💣"; box.children[i].classList.add("open"); } });
    }
  }
  function act(i, asFlag) {
    if (dead || won) return;
    const b = box.children[i];
    if (asFlag) { if (open[i]) return; flag[i] = !flag[i]; b.textContent = flag[i] ? "🚩" : ""; stat(); return; }
    if (flag[i]) return;
    if (!started) plant(i);
    if (open[i]) {   // clicking a number with all its flags placed digs the rest around it
      const ar = around(i); if (ar.filter(j => flag[j]).length !== count(i)) return;
      for (const j of ar) { if (!flag[j] && !open[j] && mines[j]) { box.children[j].classList.add("boom"); end(false); return; } dig(j); }
    } else if (mines[i]) { b.classList.add("boom"); end(false); return; }
    else dig(i);
    if (open.filter(Boolean).length === N * N - M) end(true);
  }
  box.addEventListener("contextmenu", e => { e.preventDefault(); const b = e.target.closest("button"); if (b) act(+b.dataset.i, true); });
  box.onclick = e => { const b = e.target.closest("button"); if (b) act(+b.dataset.i, false); };
  $("mineLvl").onclick = e => { const b = e.target.closest("button"); if (!b) return; lvl = b.dataset.v; put("mineLvl", lvl); [...$("mineLvl").children].forEach(x => x.classList.toggle("on", x === b)); fresh(); };
  [...$("mineLvl").children].forEach(x => x.classList.toggle("on", x.dataset.v === lvl));
  $("mineNew").onclick = fresh;
  fresh();
})();
