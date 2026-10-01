
// ---------------------------------------------------------------- Breakout: clear the wall, three lives
(function () {
  const cv = $("brk"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  const COLS = 10, ROWS = 6, BW = (W - 40) / COLS, BH = 22, TOP = 54;
  const HUES = ["#e8342a", "#f08a24", "#f2c53d", "#3fb971", "#3b8bf0", "#9a63f0"];
  let pad, balls, bricks, parts, score, lives, level, state = "ready", keys = {}, shake = 0, last = 0;
  function wall() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (level > 1 && (r + c + level) % 7 === 0) continue;     // later levels have gaps
      bricks.push({ x:20 + c * BW, y:TOP + r * (BH + 6), hp:level > 2 && r < 2 ? 2 : 1, col:HUES[r % HUES.length], hit:0 });
    }
  }
  function serve() { balls = [{ x:pad.x, y:H - 48, vx:0, vy:0, stuck:true }]; }
  function reset() { pad = { x:W / 2, w:110 }; score = 0; lives = 3; level = 1; parts = []; wall(); serve(); state = "ready"; hud(); }
  function launch() {
    if (state === "over" || state === "won") { reset(); return; }
    if (state === "paused") { state = "run"; return; }
    state = "run";
    balls.forEach(b => { if (b.stuck) { const sp = 6 + level * .6, a = -Math.PI / 2 + (Math.random() - .5) * .7; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.stuck = false; } });
  }
  const hud = () => { $("brkS").textContent = "Level " + level + " · Score " + score + " · " + "❤".repeat(Math.max(0, lives)); };
  function burst(x, y, col, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx:(Math.random() - .5) * 6, vy:(Math.random() - .7) * 5, life:1, col }); }
  function step(dt) {
    const sp = 9 * dt;
    if (keys.ArrowLeft || keys.a) pad.x -= sp; if (keys.ArrowRight || keys.d) pad.x += sp;
    pad.x = Math.max(pad.w / 2 + 6, Math.min(W - pad.w / 2 - 6, pad.x));
    for (const b of balls) {
      if (b.stuck) { b.x = pad.x; b.y = H - 48; continue; }
      const n = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 4);   // small sub-steps, so it never skips a brick
      for (let k = 0; k < n; k++) {
        b.x += b.vx * dt / n; b.y += b.vy * dt / n;
        if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx); } if (b.x > W - 8) { b.x = W - 8; b.vx = -Math.abs(b.vx); }
        if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y > H - 44 && b.y < H - 26 && Math.abs(b.x - pad.x) < pad.w / 2 + 7) {
          const off = (b.x - pad.x) / (pad.w / 2), s = Math.hypot(b.vx, b.vy) * 1.012, a = -Math.PI / 2 + off * 1.05;
          b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.y = H - 44; burst(b.x, H - 34, gcss("--fg"), 4);
        }
        for (const br of bricks) {
          if (br.hp <= 0 || b.x < br.x - 7 || b.x > br.x + BW - 4 + 7 || b.y < br.y - 7 || b.y > br.y + BH + 7) continue;
          const dx = Math.min(Math.abs(b.x - br.x), Math.abs(b.x - (br.x + BW - 4))), dy = Math.min(Math.abs(b.y - br.y), Math.abs(b.y - (br.y + BH)));
          if (dx < dy) b.vx = -b.vx; else b.vy = -b.vy;
          br.hp--; br.hit = 1; score += 10 * level; shake = 4;
          if (br.hp <= 0) { burst(br.x + BW / 2, br.y + BH / 2, br.col, 14); if (Math.random() < .12) balls.push({ x:b.x, y:b.y, vx:-b.vx, vy:b.vy, stuck:false }); }
          hud(); break;
        }
      }
    }
    const before = balls.length;
    balls = balls.filter(b => b.y < H + 10);
    if (before && !balls.length) {
      lives--; shake = 10; hud();
      if (lives <= 0) {
        state = "over";
        const bb = bests(); if (score > (bb.brk || 0)) { bb.brk = score; put("games", bb); showBest(); }
      } else { serve(); state = "ready"; }
    }
    if (!bricks.some(b => b.hp > 0)) {
      if (level >= 5) { state = "won"; const bb = bests(); if (score > (bb.brk || 0)) { bb.brk = score; put("games", bb); showBest(); } }
      else { level++; wall(); serve(); state = "ready"; pad.w = Math.max(70, 110 - level * 8); hud(); }
    }
  }
  function draw() {
    const bg = gcss("--bg2"), fg = gcss("--fg"), ac = gcss("--accent");
    g.save();
    if (shake > .2) { g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .85; }
    g.fillStyle = bg; g.fillRect(-10, -10, W + 20, H + 20);
    for (const br of bricks) {
      if (br.hp <= 0) continue;
      g.globalAlpha = br.hp > 1 ? 1 : .9; g.fillStyle = br.col;
      g.beginPath(); g.roundRect(br.x, br.y, BW - 4, BH, 6); g.fill();
      if (br.hp > 1) { g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.stroke(); }
      if (br.hit > 0) { g.fillStyle = "rgba(255,255,255," + br.hit * .6 + ")"; g.fill(); br.hit -= .1; }
    }
    g.globalAlpha = 1;
    for (const p of parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.col; g.fillRect(p.x - 2, p.y - 2, 4, 4); p.x += p.vx; p.y += p.vy; p.vy += .18; p.life -= .025; }
    parts = parts.filter(p => p.life > 0); g.globalAlpha = 1;
    g.fillStyle = fg; g.beginPath(); g.roundRect(pad.x - pad.w / 2, H - 34, pad.w, 12, 6); g.fill();
    g.fillStyle = ac; g.beginPath(); g.roundRect(pad.x - pad.w / 2 + 8, H - 31, pad.w - 16, 6, 3); g.fill();
    for (const b of balls) { g.fillStyle = fg; g.shadowColor = ac; g.shadowBlur = 14; g.beginPath(); g.arc(b.x, b.y, 7, 0, 7); g.fill(); g.shadowBlur = 0; }
    g.fillStyle = fg; g.textAlign = "center"; g.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    const msg = state === "ready" ? (level > 1 && score ? "Level " + level + " - click or Space to launch" : "Click or press Space to launch") :
      state === "paused" ? "Paused - P or click to go on" : state === "over" ? "Game over · " + score + " points - click to play again" : state === "won" ? "You cleared all 5 levels! " + score + " points" : "";
    if (msg) { g.globalAlpha = .9; g.fillText(msg, W / 2, H / 2 + 40); g.globalAlpha = 1; }
    g.restore();
  }
  function loop(now) {
    const dt = Math.min(2.5, (now - (last || now)) / 16.67); last = now;
    if (game === "brkG") { if (state === "run" || state === "ready") step(dt); draw(); }
    else if (state === "run") state = "paused";
    requestAnimationFrame(loop);
  }
  cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); pad.x = (e.clientX - r.left) / r.width * W; });
  cv.addEventListener("pointerdown", launch);
  addEventListener("keydown", e => {
    if (game !== "brkG") return;
    if (e.key === " ") { e.preventDefault(); launch(); }
    else if (e.key === "p" || e.key === "P") state = state === "run" ? "paused" : state === "paused" ? "run" : state;
    else if (/^Arrow(Left|Right)$/.test(e.key) || e.key === "a" || e.key === "d") { e.preventDefault(); keys[e.key] = true; }
  });
  addEventListener("keyup", e => { keys[e.key] = false; });
  reset(); requestAnimationFrame(loop);
})();
