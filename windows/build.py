"""Builds the new embedded pages: orig/ + src/ -> out/ (then repack.py puts them in the exe)."""
import os, re, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
O, S, OUT = (os.path.join(here, d) for d in ("orig", "src", "out"))
os.makedirs(OUT, exist_ok=True)
rd = lambda d, f: open(os.path.join(d, f), encoding="utf-8").read()
def once(s, old, new, what):
    n = s.count(old)
    if n != 1: sys.exit("build: %s: expected 1 match, found %d" % (what, n))
    return s.replace(old, new)
def write(name, s):
    open(os.path.join(OUT, name), "w", encoding="utf-8", newline="").write(s)

VERSION = rd(here, "VERSION").strip()

# shield.js: the new tools sit inside the same closure, before the tool entry point is published
sj = rd(O, "shield.js")
sj = once(sj, "try { Object.defineProperty(W, Symbol.for('wsb.tool')", rd(S, "shield.add.js") + "\n\ntry { Object.defineProperty(W, Symbol.for('wsb.tool')", "shield: tool export")
sj = once(sj, "function tool(action, arg) {\n  switch (action) {", "function tool(action, arg) {\n  if (xTool(action, arg)) return '';\n  switch (action) {", "shield: tool()")
write("shield.js", sj)

# chrome.html
ch = rd(O, "chrome.html")
ch = once(ch, "</style>\n", rd(S, "chrome.add.css") + rd(S, "cloud.css") + rd(S, "support.css") + "</style>\n", "chrome: css")
ch = once(ch, '  m.appendChild(row("tools", "Page tools…", "", toolsPanel));\n',
  '  m.appendChild(row("tools", "Page tools…", "", toolsPanel));\n  m.appendChild(row("grid", "More page tools (new)…", "", () => X3.toolsPanel()));\n', "chrome: menu row")
ch = once(ch, '  m.appendChild(row("sparkle", "What\'s new (287 features)", "", () => open1("whatsnew.html")));\n',
  '  m.appendChild(row("sparkle", "What\'s new (@@FEATURES@@ features)", "", () => open1("whatsnew.html")));\n  if (window.X3 && X3.menuRows) X3.menuRows(m);\n', "chrome: count and menu rows")
ch = once(ch, '  m.appendChild(row("code", "Your CSS for this site…", "", cssPanel));\n',
  '  m.appendChild(row("code", "Your CSS for this site…", "", cssPanel));\n  m.appendChild(row("grid", "40 more page tools…", "", () => X3.toolsPanel()));\n', "chrome: tools panel row")
ch = once(ch, "    [\"Close\", () => closeTab(id)]\n  ];\n  ctxMenu(e, items);", "    [\"Close\", () => closeTab(id)]\n  ];\n  if (window.X3) X3.tabItems(items, id);\n  ctxMenu(e, items);", "chrome: tab menu")
ch = once(ch, "relayout();\n</script>", "relayout();\n</script>\n<script>\n" + rd(S, "chrome.add.js") + "\n</script>\n<script>\n" + rd(S, "cloud.js").replace("@@WEBS_VERSION@@", VERSION) + "\n</script>\n<script>\n" + rd(S, "studio.js") + "\n</script>\n<script>\n" + rd(S, "webai.js") + "\n</script>\n<script>\n" + rd(S, "../../js/support.settings.js") + "\n</script>\n<script>\n" + rd(S, "support.js") + "\n</script>", "chrome: script")   # Help & support: the list is shared with the iPhone app and the server
chrome_html = ch   # written once the feature count is known

def page(name, css=None, js=None, edits=()):
    s = rd(O, name)
    for old, new, what in edits: s = once(s, old, new, name + ": " + what)
    if css: s = once(s, "</style>\n", "".join(rd(S, c) for c in ([css] if isinstance(css, str) else css)) + "</style>\n", name + ": css")
    for f in ([js] if isinstance(js, str) else js or []):
        i = s.rindex("</script>")
        s = s[:i + 9] + "\n<script>\n" + rd(S, f).replace("@@WEBS_VERSION@@", VERSION) + "\n</script>" + s[i + 9:]
    write(name, s)

page("side.html", ["side.add.css", "webai.side.css", "support.side.css"], ["side.add.js", "webai.side.js", "webai.voice.js", "../../js/support.settings.js", "support.side.js"])
page("newtab.html", "newtab.add.css", ["../../js/phantom.js", "newtab.add.js"])     # the Phantom calendar is shared with the iPhone app
page("settings.html", None, ["settings.add.js", "settings.acct.js"], edits=[
  ('  <h2 id="vpn">VPN</h2>', rd(S, "settings.acct.html") + '  <h2 id="vpn">VPN</h2>', "account section"),
  ('<a href="#vpn">VPN</a>', '<a href="#account">Account</a><a href="#vpn">VPN</a>', "account link"),
  ('  <h2 id="access">Accessibility</h2>', rd(S, "settings.add.html") + '  <h2 id="access">Accessibility</h2>', "section"),
  ('<a href="#tools">Tools</a>', '<a href="#tools">Tools</a><a href="#x3">3.0 extras</a>', "jump link"),
  ('        <option value="wiki">Wikipedia</option>\n',
   '        <option value="wiki">Wikipedia</option>\n        <option value="ecosia">Ecosia</option>\n        <option value="qwant">Qwant</option>\n        <option value="kagi">Kagi</option>\n        <option value="yahoo">Yahoo</option>\n        <option value="mojeek">Mojeek</option>\n        <option value="yandex">Yandex</option>\n        <option value="custom">Your own engine (Webs 3.0 extras)</option>\n', "engines"),
])
print("built:", ", ".join(sorted(os.listdir(OUT))))

# games.html: eight more games (three ported from the iPhone version)
gm = rd(O, "games.html")
gm = once(gm, '<button data-g="word">Daily word <em id="bW"></em></button></div>',
  '<button data-g="word">Daily word <em id="bW"></em></button>'
  '<button data-g="tttG">Tic-tac-toe <em id="bT"></em></button><button data-g="memG">Memory <em id="bM"></em></button>'
  '<button data-g="mineG">Minesweeper <em id="bX"></em></button><button data-g="brkG">Breakout <em id="bB"></em></button>'
  '<button data-g="pongG">Pong <em id="bP"></em></button><button data-g="typeG">Typing test <em id="bY"></em></button>'
  '<button data-g="reactG">Reaction time <em id="bRx"></em></button><button data-g="aimG">Aim trainer <em id="bA"></em></button></div>', "games: tabs")
gm = once(gm, '<!-- Offline games: Web Runner, Snake and 2048.', '<!-- Offline games: Web Runner, Snake, 2048, Daily word, Tic-tac-toe, Memory, Minesweeper, Breakout, Pong, Typing test, Reaction time and Aim trainer.', "games: comment")
gm = once(gm, '<div class="sub">Small games that work without internet.', '<div class="sub">Twelve small games that work without internet.', "games: sub")
gm = once(gm, "</style>\n", rd(S, "games.add.css") + "</style>\n", "games: css")
gm = once(gm, "</main>", rd(S, "games.add.html") + "</main>", "games: sections")
js = "".join(rd(S, f) for f in ("games.head.js", "games.port.js", "games.brk.js", "games.pong.js", "games.type.js", "games.react.js", "games.aim.js"))
i = gm.rindex("</script>")
gm = gm[:i] + js + "showBest();\n" + gm[i:]
write("games.html", gm)
print("games built")

# whatsnew.html: the newest features first; the count on the page is worked out from the list
wn = rd(O, "whatsnew.html")
wn = once(wn, "const F = {\n", "const F = {\n" + rd(S, "whatsnew.31.js") + rd(S, "whatsnew.add.js"), "whatsnew: list")
wn = once(wn, "The groups marked New arrived in this update.", "The groups marked 3.6, 3.5, 3.4, 3.3, 3.2, 3.1 and 3.0 are the newest; the ones marked New came just before.", "whatsnew: sub")
write("whatsnew.html", wn)
body = wn[wn.index("const F = {"):wn.index("};\nlet n = 0;")]
features = len(re.findall(r'^\s*\["', body, re.M))     # one card per line that starts a [title, what, where] entry
write("chrome.html", chrome_html.replace("@@FEATURES@@", str(features)))
print("whatsnew built:", features, "features; version", VERSION)
