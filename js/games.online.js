/* Webs Browser - play a friend (Windows 3.10, iPhone 2.9): chess, Connect Four or tic-tac-toe with someone
   on another device. One of you makes a game and gets a 6-letter code; the other types it (or opens the link).
   The game lives in a room on the Web AI server (js/link.js, server/web-ai/rooms.js) as its list of moves,
   so either of you can close the page and come back; it's forgotten two days after the last move.
   Whoever made the game moves first (white, red or X). Anyone else with the code can watch.
   Loaded after js/games.more.js (chess's rules come from GamesMore.chess). */
(function () {
"use strict";
const tabs = document.querySelector(".tabs");
if (!tabs || !window.Link || window.GamesOnline || /[?&]private=1/.test(location.search)) return;
const LK = window.Link, ios = !!tabs.querySelector(".ge");
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const KINDS = { chess:["♟️", "Chess"], c4:["🔴", "Connect Four"], ttt:["❌", "Tic-tac-toe"] };

/* ---------------------------------------------------------------- the rules */
const TTT = {
  lines:[[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]],
  board(mv) { const b = Array(9).fill(""); mv.forEach((m, i) => { b[m] = i % 2 ? "O" : "X"; }); return b; },
  legal(mv, m) { return Number.isInteger(m) && m >= 0 && m < 9 && mv.indexOf(m) < 0 && !TTT.result(mv); },
  result(mv) { const b = TTT.board(mv); for (const l of TTT.lines) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { win:b[l[0]] === "X" ? 0 : 1, line:l }; return mv.length >= 9 ? { draw:1 } : null; }
};
const C4 = {
  W:7, H:6,
  board(mv) { const b = Array(42).fill(""); mv.forEach((c, i) => { for (let r = C4.H - 1; r >= 0; r--) if (!b[r * 7 + c]) { b[r * 7 + c] = i % 2 ? "Y" : "R"; break; } }); return b; },
  legal(mv, c) { return Number.isInteger(c) && c >= 0 && c < 7 && mv.filter(x => x === c).length < 6 && !C4.result(mv); },
  result(mv) {
    const b = C4.board(mv), at = (r, c) => r >= 0 && r < 6 && c >= 0 && c < 7 ? b[r * 7 + c] : "";
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const p = at(r, c); if (!p) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) if ([1, 2, 3].every(k => at(r + dr * k, c + dc * k) === p)) return { win:p === "R" ? 0 : 1, line:[0, 1, 2, 3].map(k => (r + dr * k) * 7 + c + dc * k) }; }
    return mv.length >= 42 ? { draw:1 } : null;
  }
};
const CHR = {
  state(mv) { const CH = window.GamesMore && GamesMore.chess; if (!CH) return null; let s = CH.fromFen(CH.START); for (const m of mv) { const x = CH.legal(s).find(y => y.f === m[0] && y.t === m[1] && (y.promo || "").toLowerCase() === (m[2] || "")); if (!x) break; s = CH.make(s, x); } return s; },
  legal(mv, m) { const CH = GamesMore.chess, s = CHR.state(mv); return !!(s && Array.isArray(m) && CH.legal(s).some(y => y.f === m[0] && y.t === m[1] && (y.promo || "").toLowerCase() === (m[2] || "")) && !CHR.result(mv)); },
  result(mv) { const CH = GamesMore.chess, s = CHR.state(mv); if (!s) return null; const ms = CH.legal(s); if (!ms.length) return CH.inCheck(s, s.w) ? { win:s.w ? 1 : 0 } : { draw:1 }; if (CH.tooLittle(s.b) || s.hm >= 100) return { draw:1 }; return null; }
};
const RULES = { ttt:TTT, c4:C4, chess:CHR };

/* ---------------------------------------------------------------- the tab */
const b = document.createElement("button"); b.dataset.g = "onlineG";
b.innerHTML = (ios ? '<span class="ge">🌐</span>' : "") + 'Play a friend <em id="b_onlineG"></em>';
tabs.appendChild(b);
const sec = document.createElement("section"); sec.className = "g gm"; sec.id = "onlineG";
const all = document.querySelectorAll("section.g"); (all.length ? all[all.length - 1] : tabs).after(sec);
b.addEventListener("click", () => { if (window.GamesMore) GamesMore.open("onlineG"); show(); });

let R = null, code = "", G = null, me = "", pick = -1;
const myDev = () => LK.dev();
const role = () => !G ? -1 : G.host === myDev() ? 0 : G.guest === myDev() ? 1 : -1;
const names = () => [G && G.names && G.names[G.host] || "Player 1", G && G.names && G.names[G.guest] || (G && G.guest ? "Player 2" : "waiting…")];
function lobby(msg) {
  if (R) { R.close(); R = null; }
  code = ""; G = null; put("gmOnline", null);
  sec.innerHTML = '<div class="go-box"><h3>Play a friend</h3><p class="go-dim">On another phone or computer with Webs. One of you makes a game; the other types its code.</p>' +
    '<div class="go-kinds">' + Object.keys(KINDS).map(k => '<button class="go-kind" data-k="' + k + '"><b>' + KINDS[k][0] + "</b>" + KINDS[k][1] + "</button>").join("") + "</div>" +
    '<div class="go-join"><input id="goCode" maxlength="6" placeholder="Code, e.g. K7M2QX" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="gm-act gm-main" id="goJoin">Join</button></div>' +
    '<p class="go-dim">Your name: <input id="goName" maxlength="20"></p><p class="go-err" id="goErr"></p></div>';
  $("goName").value = get("gmName", "") || LK.myName();
  $("goName").onchange = () => put("gmName", $("goName").value.trim().slice(0, 20));
  sec.querySelectorAll(".go-kind").forEach(x => { x.onclick = () => make(x.dataset.k); });
  $("goJoin").onclick = () => { const c = $("goCode").value.toUpperCase().replace(/[^A-Z2-9]/g, ""); if (c.length !== 6) { $("goErr").textContent = "A code has 6 letters and numbers."; return; } join(c); };
  $("goCode").onkeydown = e => { if (e.key === "Enter") $("goJoin").click(); };
  if (msg) $("goErr").textContent = msg;
  if (!LK.server()) $("goErr").textContent = "Open Web AI once first: games with a friend go through its server.";
}
const myName = () => (get("gmName", "") || LK.myName()).slice(0, 20);
function make(kind) { if (!LK.server()) return; join(LK.newCode(), { kind, mv:[], host:myDev(), guest:"", names:{ [myDev()]:myName() }, ts:Date.now(), n:1 }); }
function join(c, fresh) {
  if (R) R.close();
  code = c; G = null; put("gmOnline", { code:c });
  R = LK.room("g." + c, { app:ios ? "iphone" : "windows", name:myName() });
  R.on("open", () => {
    G = R.store.game || null;
    if (fresh && !G) { G = fresh; R.set("game", G); }
    if (!G) { R.close(); R = null; lobby("There's no game with the code " + c + ". Check it, or make one."); return; }
    if (role() < 0 && !G.guest && G.host !== myDev()) { G = Object.assign({}, G, { guest:myDev(), names:Object.assign({}, G.names, { [myDev()]:myName() }) }); R.set("game", G); }
    paint();
  });
  R.on("set", (k, v) => { if (k === "game" && v) { G = v; pick = -1; paint(); } });
  R.on("peers", () => paint());
  R.on("close", why => { if (why === "full") lobby("That game is full."); else paint(); });
  sec.innerHTML = '<div class="go-box"><p class="go-dim">Connecting…</p></div>';
}
function share() {
  const u = (ios ? LK.APP_URL + "games.html" : "") + "#join=" + code;
  const t = "Play " + KINDS[G.kind][1] + " with me in Webs! Code: " + code + (ios ? "\n" + u : "");
  if (navigator.share && ios) navigator.share({ text:t }).catch(() => {}); else navigator.clipboard.writeText(t).then(() => say("Copied - send it to your friend"), () => {});
}
function say(m) { const e = sec.querySelector(".go-msg"); if (e) e.textContent = m; }
function move(m) {
  if (!G || role() < 0) return;
  const rules = RULES[G.kind], turn = G.mv.length % 2;
  if (turn !== role() || !G.guest || !rules.legal(G.mv, m)) return;
  G = Object.assign({}, G, { mv:G.mv.concat([m]), ts:Date.now() });
  R.set("game", G); pick = -1; paint();
}
let scored = "";
function paint() {
  if (!G) return;
  const rules = RULES[G.kind], res = rules.result(G.mv), turn = G.mv.length % 2, n = names(), mine = role(), online = R && R.peers.length > 1;
  let msg;
  if (!G.guest) msg = "Waiting for your friend to join with the code";
  else if (res && res.draw) msg = "A draw!";
  else if (res) msg = (mine === res.win ? "🏆 You win!" : mine < 0 ? n[res.win] + " wins" : n[res.win] + " wins this one");
  else msg = mine === turn ? "Your move" : mine < 0 ? n[turn] + " to move (you're watching)" : n[turn] + " to move…";
  if (res && !res.draw && mine === res.win && scored !== code + G.n) { scored = code + G.n; try { if (window.XP) XP.game("online", true, 3); } catch (e) {} }
  const tag = i => '<span class="go-p' + (turn === i && !res ? " on" : "") + '"><i class="go-dot d' + i + '"></i>' + esc(n[i]) + (mine === i ? " (you)" : "") + "</span>";
  sec.innerHTML = '<div class="gm-bar"><b>' + KINDS[G.kind][0] + " " + KINDS[G.kind][1] + ' · <span class="go-code">' + code + '</span></b><span class="gm-btns"><button class="gm-act" id="goShare">Invite</button>' +
    (res ? '<button class="gm-act gm-main" id="goAgain">Play again</button>' : "") + '<button class="gm-act" id="goLeave">Leave</button></span></div>' +
    '<div class="go-players">' + tag(0) + '<span class="go-vs">vs</span>' + tag(1) + "</div>" + '<div class="go-board"></div><div class="gm-msg go-msg">' + esc(msg) + (G.guest && !online && !res ? " · your friend isn't here right now" : "") + "</div>";
  $("goShare").onclick = share;
  $("goLeave").onclick = () => lobby();
  if ($("goAgain")) $("goAgain").onclick = () => { G = { kind:G.kind, mv:[], host:G.guest || G.host, guest:G.guest ? G.host : "", names:G.names, ts:Date.now(), n:(G.n || 1) + 1 }; R.set("game", G); paint(); };   // the other one starts
  const box = sec.querySelector(".go-board");
  if (G.kind === "ttt") {
    const bd = TTT.board(G.mv); box.className = "go-board go-ttt";
    box.innerHTML = bd.map((x, i) => '<button data-m="' + i + '" class="' + (res && res.line && res.line.indexOf(i) >= 0 ? "win" : "") + '">' + (x === "X" ? "✕" : x === "O" ? "◯" : "") + "</button>").join("");
    box.onclick = e => { const t = e.target.closest("[data-m]"); if (t) move(+t.dataset.m); };
  } else if (G.kind === "c4") {
    const bd = C4.board(G.mv); box.className = "go-board go-c4";
    box.innerHTML = bd.map((x, i) => '<div data-c="' + (i % 7) + '" class="' + (x === "R" ? "r" : x === "Y" ? "y" : "") + (res && res.line && res.line.indexOf(i) >= 0 ? " win" : "") + '"></div>').join("");
    box.onclick = e => { const t = e.target.closest("[data-c]"); if (t) move(+t.dataset.c); };
  } else {
    const CH = GamesMore.chess, s = CHR.state(G.mv), flip = mine === 1, last = G.mv[G.mv.length - 1], GL = { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" };
    const ms = pick >= 0 ? CH.legal(s).filter(m => m.f === pick) : [];
    box.className = "go-board ch-board";
    let h = "";
    for (let n2 = 0; n2 < 64; n2++) { const i = flip ? 63 - n2 : n2, p = s.b[i];
      h += '<div data-i="' + i + '" class="sq ' + (((i >> 3) + (i & 7)) % 2 ? "dk" : "lt") + (i === pick ? " sel" : "") + (last && (i === last[0] || i === last[1]) ? " last" : "") + (ms.some(m => m.t === i) ? (p ? " cap" : " dot") : "") + '">' +
        (p ? '<span class="pc ' + (CH.isW(p) ? "w" : "b") + '">' + GL[p.toLowerCase()] + "︎</span>" : "") + "</div>"; }
    box.innerHTML = h;
    box.onclick = e => {
      const t = e.target.closest("[data-i]"); if (!t || res || mine !== turn) return;
      const i = +t.dataset.i, p = s.b[i];
      if (pick >= 0) { const m = CH.legal(s).filter(x => x.f === pick && x.t === i); if (m.length) { const q = m.find(x => !x.promo || x.promo.toLowerCase() === "q") || m[0]; move([q.f, q.t, q.promo ? q.promo.toLowerCase() : ""]); return; } }
      pick = p && CH.isW(p) === s.w && pick !== i ? i : -1; paint();
    };
  }
}
function show() {
  if (R) { paint(); return; }
  const h = /#join=([A-Za-z2-9]{6})/.exec(location.hash), saved = get("gmOnline", null);
  if (h) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} join(h[1].toUpperCase()); }
  else if (saved && saved.code) join(saved.code);
  else lobby();
}
if (/#join=/.test(location.hash)) setTimeout(() => b.click(), 50);
window.GamesOnline = { TTT, C4, CHR, join, lobby, move, state:() => ({ G, code, role:role() }), room:() => R };

const st = document.createElement("style");
st.textContent = `
.go-box{max-width:520px;margin:0 auto;text-align:center}.go-box h3{font-size:20px;margin:6px 0}.go-dim{color:var(--dim);font-size:13.5px;margin:6px 0 12px}
.go-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.go-kind{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 6px;border-radius:14px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font:600 13px system-ui,sans-serif;cursor:pointer}
.go-kind b{font-size:30px;line-height:1}.go-kind:hover{border-color:var(--accent)}
.go-join{display:flex;gap:8px;justify-content:center;margin:14px 0}.go-join input,.go-box p input{font:600 16px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);width:180px;text-transform:uppercase}
.go-box p input{letter-spacing:0;text-transform:none;font:inherit;width:160px}.go-err{color:#ef4444;min-height:18px;font-size:13px}
.go-code{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;color:var(--accent)}
.go-players{display:flex;justify-content:center;align-items:center;gap:10px;margin:0 0 12px;font-size:14px}.go-p{padding:4px 10px;border-radius:999px;background:var(--bg2);opacity:.7}.go-p.on{opacity:1;box-shadow:0 0 0 2px var(--accent)}
.go-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}.go-dot.d0{background:#ef4444}.go-dot.d1{background:#facc15}.go-vs{color:var(--dim);font-size:12px}
.go-ttt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(330px,90vw);margin:0 auto}.go-ttt button{aspect-ratio:1;border-radius:14px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font:700 48px/1 system-ui;cursor:pointer;touch-action:manipulation}
.go-ttt button.win{background:var(--accent);color:#fff}
.go-c4{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;width:min(440px,94vw);margin:0 auto;padding:10px;border-radius:16px;background:#1d4ed8}
.go-c4 div{aspect-ratio:1;border-radius:50%;background:var(--bg);cursor:pointer;box-shadow:inset 0 3px 6px rgba(0,0,0,.35)}.go-c4 .r{background:#ef4444}.go-c4 .y{background:#facc15}.go-c4 .win{outline:4px solid #fff;outline-offset:-4px}
.go-board.ch-board{margin:0 auto}
`;
document.head.appendChild(st);
})();
