
// ---------------------------------------------------------------- Reaction time: wait for green
(function () {
  const box = $("react"), TRIES = 5;
  let state = "idle", times = [], t0 = 0, wait = 0;
  const show = (cls, title, sub) => { box.className = cls; box.innerHTML = "<b></b><span></span>"; box.firstChild.textContent = title; box.lastChild.textContent = sub; };
  function arm() {
    state = "wait"; show("wait", "Wait for green…", "Try " + (times.length + 1) + " of " + TRIES);
    wait = setTimeout(() => { state = "go"; t0 = performance.now(); show("go", "Click!", ""); }, 1400 + Math.random() * 3000);
  }
  function press() {
    if (state === "idle" || state === "result" || state === "done") { if (state === "done") times = []; $("reactMsg").textContent = ""; arm(); return; }
    if (state === "wait") { clearTimeout(wait); state = "result"; show("early", "Too soon!", "Click to try that one again"); return; }
    if (state === "go") {
      const ms = Math.round(performance.now() - t0); times.push(ms);
      if (times.length < TRIES) { state = "result"; show("", ms + " ms", "Click for the next try"); }
      else {
        state = "done";
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length), b = bests(), best = !b.react || avg < b.react;
        if (best) { b.react = avg; put("games", b); showBest(); }
        show("", avg + " ms average", "Click to play again");
        $("reactMsg").textContent = times.join(" · ") + " ms" + (best ? " - a new best! 🏆" : "") + (avg < 220 ? " · Lightning fast ⚡" : avg < 300 ? " · Quick!" : "");
      }
    }
  }
  box.addEventListener("pointerdown", e => { if (e.button === 0) press(); });
  box.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) press(); } });
  document.querySelector('.tabs button[data-g="reactG"]').addEventListener("click", () => setTimeout(() => box.focus(), 50));
  document.querySelector(".tabs").addEventListener("click", () => { if (game !== "reactG" && state === "wait") { clearTimeout(wait); state = "idle"; show("", "Reaction time", "Click (or press Space) when the box turns green. " + TRIES + " tries."); } });
})();
