/* ---------------------------------------------------------------- Webs 3.0: eight more games */
const fmtT = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const gcss = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
(function () {
  const before = showBest;
  showBest = function () {
    before();
    const b = bests(), set = (id, v) => { if ($(id)) $(id).textContent = v ? "· " + v : ""; };
    set("bT", b.tttWins ? b.tttWins + " won" : "");
    set("bM", b.mem ? b.mem + " moves" : "");
    set("bX", b.mine ? fmtT(b.mine) : "");
    set("bB", b.brk || "");
    set("bP", b.pongWins ? b.pongWins + " won" : "");
    set("bY", b.wpm ? b.wpm + " wpm" : "");
    set("bRx", b.react ? b.react + " ms" : "");
    set("bA", b.aim || "");
  };
})();
// games.html#pong (and so on) opens that game
function openFromHash() {
  const h = location.hash.slice(1), want = { ttt:"tttG", memory:"memG", mines:"mineG", breakout:"brkG", pong:"pongG", typing:"typeG", reaction:"reactG", aim:"aimG" }[h] || h;
  const b = document.querySelector('.tabs button[data-g="' + want + '"]');
  if (b) b.click();
}
addEventListener("load", openFromHash);
addEventListener("hashchange", openFromHash);
