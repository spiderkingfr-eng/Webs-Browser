"""Publishes a new version of the iPhone app.

    python3 tools/publish_iphone.py 2.2.0 "What changed" "Another change"
    (leave out the version to go up by one: 2.1.0 -> 2.1.1)

Then commit, push and merge into main. GitHub Pages serves the new files, and
every iPhone with Webs on its Home Screen shows an Update button the next time
the app is opened or comes back from the background; one tap switches to it.

This sets the version in js/app.js and sw.js (a new sw.js is what makes phones
notice) and writes updates/iphone.json, whose notes show in the update sheet
(its "webai" part, the Web AI server's address, is kept)."""
import datetime, glob, json, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding="utf-8").read()
def wr(p, s): open(os.path.join(root, p), "w", encoding="utf-8", newline="\n").write(s)

app, sw = rd("js/app.js"), rd("sw.js")
cur = re.search(r'const VERSION = "(\d+\.\d+\.\d+)";', app).group(1)
args = sys.argv[1:]
if args and re.fullmatch(r"\d+\.\d+\.\d+", args[0]): new = args.pop(0)
else: a, b, c = map(int, cur.split(".")); new = "%d.%d.%d" % (a, b, c + 1)
vt = lambda v: tuple(map(int, v.split(".")))
if vt(new) <= vt(cur): sys.exit("The new version (%s) must be higher than %s" % (new, cur))
notes = [n for n in args if n.strip()]
if not notes: sys.exit('Say what is new: python3 tools/publish_iphone.py "First change" "Second change"')

# every script the app loads must be in the offline list, or a phone can end up with a half-updated app
shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1)
missing = [p for p in sorted(glob.glob(os.path.join(root, "js", "*.js"))) if '"js/' + os.path.basename(p) + '"' not in shell]
if missing: sys.exit("Add these to SHELL in sw.js first: " + ", ".join("js/" + os.path.basename(p) for p in missing))

wr("js/app.js", app.replace('const VERSION = "%s";' % cur, 'const VERSION = "%s";' % new, 1))
wr("sw.js", re.sub(r'const VERSION = "webs-[\d.]+";', 'const VERSION = "webs-%s";' % new, sw, count=1))
os.makedirs(os.path.join(root, "updates"), exist_ok=True)
old = {}
try: old = json.loads(rd("updates/iphone.json"))
except (OSError, ValueError): pass
manifest = { "version":new, "date":datetime.date.today().isoformat(), "notes":notes }
if old.get("webai"): manifest["webai"] = old["webai"]      # the Web AI server's address (tools/set_webai_server.py)
wr("updates/iphone.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
try:
    import subprocess
    subprocess.run([sys.executable, os.path.join(root, "tools", "make_changelog.py")], check=True)
except Exception as e:
    print("changelog not written:", e)
print("iPhone app %s -> %s. Commit, push and merge into main; phones offer it when Webs is next opened." % (cur, new))
