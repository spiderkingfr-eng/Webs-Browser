
// ---------------------------------------------------------------- Pong: you on the left, first to 7
(function () {
  const cv = $("pong"), g = cv.getContext("2d"), W = cv.width, H = cv.height, PH = 80, PW = 12;
  const LV = { easy:[3.6, .55], med:[5.4, .8], hard:[7.6, .95] };    // computer speed, how well it reads the ball
  let lvl = get("pongLvl", "med"), you, cpu, ball, sc, state = "serve", keys = {}, trail = [], flash = 0, last = 0, mouseY = null;
  function reset() { you = H / 2; cpu = H / 2; sc = [0, 0]; state = "serve"; serve(1); paint(); }
  function serve(dir) { ball = { x:W / 2, y:H / 2, vx:0, vy:0, dir }; trail = []; }
  function go() {
    if (state === "over") { reset(); return; }
    if (state !== "serve") return;
    const a = (Math.random() - .5) * .9; ball.vx = Math.cos(a) * 6.2 * ball.dir; ball.vy = Math.sin(a) * 6.2; state = "run";
  }
  const paint = () => { $("pongS").textContent = "You " + sc[0] + " · Computer " + sc[1]; };
  function point(who) {
    sc[who]++; paint(); flash = 1;
    if (sc[who] >= 7) {
      state = "over";
      if (who === 0) { const b = bests(); b.pongWins = (b.pongWins || 0) + 1; put("games", b); showBest(); }
      $("pongB").textContent = who === 0 ? "You won " + sc[0] + "-" + sc[1] + "!" : "The computer won " + sc[1] + "-" + sc[0] + ".";
    } else { state = "serve"; serve(who === 0 ? -1 : 1); }
  }
  function hit(py, side) {
    const off = Math.max(-1, Math.min(1, (ball.y - py) / (PH / 2))), s = Math.min(15, Math.hypot(ball.vx, ball.vy) * 1.06), a = off * 1.0;
    ball.vx = Math.cos(a) * s * side; ball.vy = Math.sin(a) * s; flash = .5;
  }
  function step(dt) {
    if (mouseY != null) you += (mouseY - you) * Math.min(1, .35 * dt);
    if (keys.ArrowUp || keys.w) you -= 8 * dt; if (keys.ArrowDown || keys.s) you += 8 * dt;
    you = Math.max(PH / 2, Math.min(H - PH / 2, you));
    const [spd, read] = LV[lvl];
    // the computer follows where the ball will be, a bit off on the easier levels
    let target = H / 2;
    if (ball.vx > 0) { target = ball.y + ball.vy * ((W - 30 - ball.x) / Math.max(1, ball.vx)) * read; while (target < 0 || target > H) target = target < 0 ? -target : 2 * H - target; }
    cpu += Math.max(-spd * dt, Math.min(spd * dt, target - cpu)); cpu = Math.max(PH / 2, Math.min(H - PH / 2, cpu));
    if (state !== "run") { ball.y = H / 2; return; }
    const n = Math.ceil(Math.abs(ball.vx) * dt / 5);
    for (let k = 0; k < n; k++) {
      ball.x += ball.vx * dt / n; ball.y += ball.vy * dt / n;
      if (ball.y < 8) { ball.y = 8; ball.vy = Math.abs(ball.vy); } if (ball.y > H - 8) { ball.y = H - 8; ball.vy = -Math.abs(ball.vy); }
      if (ball.vx < 0 && ball.x < 30 + PW && ball.x > 18 && Math.abs(ball.y - you) < PH / 2 + 8) { ball.x = 30 + PW; hit(you, 1); }
      if (ball.vx > 0 && ball.x > W - 30 - PW && ball.x < W - 18 && Math.abs(ball.y - cpu) < PH / 2 + 8) { ball.x = W - 30 - PW; hit(cpu, -1); }
      if (ball.x < -10) { point(1); return; } if (ball.x > W + 10) { point(0); return; }
    }
    trail.push({ x:ball.x, y:ball.y }); if (trail.length > 12) trail.shift();
  }
  function draw() {
    const fg = gcss("--fg"), ac = gcss("--accent"), dim = gcss("--dim2");
    g.fillStyle = gcss("--bg2"); g.fillRect(0, 0, W, H);
    if (flash > 0) { g.fillStyle = "rgba(255,255,255," + flash * .06 + ")"; g.fillRect(0, 0, W, H); flash -= .05; }
    g.fillStyle = dim; for (let y = 10; y < H; y += 26) g.fillRect(W / 2 - 1.5, y, 3, 14);
    g.font = "700 64px 'Segoe UI', system-ui, sans-serif"; g.textAlign = "center"; g.globalAlpha = .25; g.fillStyle = fg;
    g.fillText(sc[0], W / 2 - 70, 80); g.fillText(sc[1], W / 2 + 70, 80); g.globalAlpha = 1;
    g.fillStyle = ac; g.beginPath(); g.roundRect(30, you - PH / 2, PW, PH, 6); g.fill();
    g.fillStyle = fg; g.beginPath(); g.roundRect(W - 30 - PW, cpu - PH / 2, PW, PH, 6); g.fill();
    trail.forEach((t, i) => { g.globalAlpha = i / trail.length * .35; g.fillStyle = ac; g.beginPath(); g.arc(t.x, t.y, 4 + i / 3, 0, 7); g.fill(); });
    g.globalAlpha = 1; g.fillStyle = fg; g.beginPath(); g.arc(ball.x, ball.y, 8, 0, 7); g.fill();
    g.font = "600 18px 'Segoe UI', system-ui, sans-serif";
    if (state === "serve") g.fillText(sc[0] + sc[1] ? "Click or press Space to serve" : "Click or press Space to start", W / 2, H - 30);
    if (state === "over") g.fillText((sc[0] > sc[1] ? "You win! " : "So close. ") + "Click to play again", W / 2, H / 2 + 60);
  }
  function loop(now) {
    const dt = Math.min(2.5, (now - (last || now)) / 16.67); last = now;
    if (game === "pongG") { step(dt); draw(); } else if (state === "run") { state = "serve"; serve(1); }
    requestAnimationFrame(loop);
  }
  cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); mouseY = (e.clientY - r.top) / r.height * H; });
  cv.addEventListener("pointerleave", () => { mouseY = null; });
  cv.addEventListener("pointerdown", go);
  addEventListener("keydown", e => {
    if (game !== "pongG") return;
    if (e.key === " ") { e.preventDefault(); go(); }
    else if (/^Arrow(Up|Down)$/.test(e.key) || e.key === "w" || e.key === "s") { e.preventDefault(); keys[e.key] = true; mouseY = null; }
  });
  addEventListener("keyup", e => { keys[e.key] = false; });
  $("pongLvl").onclick = e => { const b = e.target.closest("button"); if (!b) return; lvl = b.dataset.v; put("pongLvl", lvl); [...$("pongLvl").children].forEach(x => x.classList.toggle("on", x === b)); $("pongB").textContent = ""; reset(); };
  [...$("pongLvl").children].forEach(x => x.classList.toggle("on", x.dataset.v === lvl));
  reset(); requestAnimationFrame(loop);
})();
