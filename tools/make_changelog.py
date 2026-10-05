"""Writes changelog.html: the public list of what changed in each version of Webs, for Windows and the iPhone.

    python3 tools/make_changelog.py

It reads the apps' own "What's new" lists (windows/src/whatsnew.31.js and whatsnew.add.js, js/whatsnew.js), so
it never says anything the apps don't. windows/build.py and tools/publish_iphone.py run it. GitHub Pages serves it
at https://spiderkingfr-eng.github.io/Webs-Browser/changelog.html, and the Web AI server's /changelog goes there.
Needs Node.js (it reads the lists as JavaScript)."""
import html, json, os, re, subprocess

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding="utf-8").read()

def node(js):
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)

def windows():
    src = rd("windows/src/whatsnew.31.js") + rd("windows/src/whatsnew.add.js")
    groups = node("const F = {" + src + "}; console.log(JSON.stringify(Object.entries(F)))")
    out = {}
    for title, items in groups:
        m = re.match(r"(\d+\.\d+) · (.+)", title)
        if not m: continue
        out.setdefault(m.group(1), []).append((m.group(2), [(i[0], i[1]) for i in items]))
    return sorted(out.items(), key=lambda kv: tuple(map(int, kv[0].split("."))), reverse=True)

def iphone():
    src = rd("js/whatsnew.js")
    arr = src[src.index("const WHATS_NEW"):src.index("function openWhatsNew")]
    groups = node(arr + "; console.log(JSON.stringify(WHATS_NEW))")
    out = []
    for title, _icon, items in groups:
        m = re.match(r"New in (\d+\.\d+)(?:\.\d+)?:? ?(.*)", title)
        out.append((m.group(1) if m else "", m.group(2) if m else title, items))
    return out

E = lambda s: html.escape(str(s), quote=True)

def page():
    w, i = windows(), iphone()
    win = "".join('<section class="v"><h2>Windows %s</h2>%s</section>' % (E(v), "".join(
        '<h3>%s</h3><ul>%s</ul>' % (E(t), "".join("<li><b>%s</b> %s</li>" % (E(a), E(b)) for a, b in items)) for t, items in gs)) for v, gs in w)
    ios = "".join('<section class="v"><h2>%s</h2><ul>%s</ul></section>' % (E(("iPhone " + v + " · " + t) if v else t), "".join("<li>%s</li>" % E(x) for x in items)) for v, t, items in i)
    n = sum(len(items) for _, gs in w for _, items in gs) + sum(len(items) for _, _, items in i)
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Webs Browser changelog</title><meta name="description" content="What changed in each version of Webs Browser for Windows and iPhone.">
<!-- Made by tools/make_changelog.py from the apps' own What's new lists. Don't edit by hand. -->
<style>
:root{--bg:#f7f4ee;--card:#fff;--fg:#1d1a20;--dim:#6b6560;--line:#e2dcd2;--accent:#e8342a}
@media (prefers-color-scheme:dark){:root{--bg:#16131a;--card:#1e1a24;--fg:#f3eff1;--dim:#9a91a3;--line:#322c3c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:40px 16px 8px;text-align:center}header h1{margin:0 0 6px;font-size:30px}header p{margin:0;color:var(--dim)}
nav{display:flex;gap:8px;justify-content:center;margin:20px 0 6px;position:sticky;top:0;padding:10px;background:var(--bg);z-index:2}
nav button{font:inherit;font-weight:600;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:8px 18px;cursor:pointer}
nav button.on{background:var(--accent);border-color:var(--accent);color:#fff}
main{max-width:760px;margin:0 auto;padding:0 16px 60px}.hide{display:none}
.v{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:6px 20px 14px;margin:16px 0}
.v h2{font-size:20px;margin:14px 0 4px;color:var(--accent)}.v h3{font-size:15px;margin:14px 0 4px}
ul{margin:6px 0;padding-left:20px}li{margin:4px 0}li b{font-weight:600}
footer{text-align:center;color:var(--dim);font-size:13px;padding:0 16px 40px}a{color:var(--accent)}
</style></head><body>
<header><h1>🕸️ Webs Browser changelog</h1><p>%d changes, newest first. Every one is in the apps today.</p></header>
<nav><button class="on" data-t="win">💻 Windows</button><button data-t="ios">📱 iPhone</button></nav>
<main><div id="win">%s</div><div id="ios" class="hide">%s</div></main>
<footer><a href="./">Get Webs on your iPhone</a> · <a href="https://github.com/spiderkingfr-eng/Webs-Browser">Webs Browser on GitHub</a></footer>
<script>
var b = document.querySelectorAll("nav button");
function show(t) { b.forEach(function (x) { x.classList.toggle("on", x.dataset.t === t); }); document.getElementById("win").classList.toggle("hide", t !== "win"); document.getElementById("ios").classList.toggle("hide", t !== "ios"); }
b.forEach(function (x) { x.onclick = function () { show(x.dataset.t); history.replaceState(null, "", "#" + x.dataset.t); }; });
if (location.hash === "#ios" || /iPhone|iPad/.test(navigator.userAgent) && location.hash !== "#win") show("ios");
</script>
</body></html>
""" % (n, win, ios)

if __name__ == "__main__":
    open(os.path.join(root, "changelog.html"), "w", encoding="utf-8", newline="\n").write(page())
    print("changelog.html written")
