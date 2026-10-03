"""Publishes a new version of Webs Browser for Windows.

    1. put the new version number in VERSION (for example 3.2.0)
    2. python3 publish.py "What's new, line one" "Line two" ...
    3. commit and push, then merge into main

Every copy of the browser reads updates/latest.json from main every few hours
and offers the update; the updater (updates/WebsUpdate.exe) checks the new exe
against the SHA-256 written here before installing it.

This builds the pages (build.py), puts them into the exe (repack.py), compiles
the updater when updater/WebsUpdate.cs changed (needs mcs or csc), and writes:
  ../updates/WebStudiosBrowser-<version>.exe   the browser (older ones removed)
  ../updates/WebsUpdate.exe                    the updater
  ../updates/latest.json                       what the browsers read
  ../WebsBrowserSetup.exe                      the setup for a new computer (the same updater)
  ../WebStudiosBrowser.zip                     for a first install by hand
The "google" part of latest.json (the sign-in client, see README.md) and the
"webai" part (the Web AI server's address, tools/set_webai_server.py) are kept."""
import datetime, glob, hashlib, json, os, re, shutil, subprocess, sys, zipfile

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
upd = os.path.join(root, "updates")
RAW = "https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/"
os.makedirs(upd, exist_ok=True)

version = open(os.path.join(here, "VERSION")).read().strip()
if not re.fullmatch(r"\d+\.\d+\.\d+", version): sys.exit("VERSION must look like 3.2.0")
again = "--again" in sys.argv
notes = [n for n in sys.argv[1:] if n.strip() and n != "--again"]
old = {}
try: old = json.load(open(os.path.join(upd, "latest.json"), encoding="utf-8"))
except (OSError, ValueError): pass
vt = lambda v: tuple(int(x) for x in v.split("."))
if old.get("version") and vt(version) <= vt(old["version"]) and not again:
    sys.exit("VERSION (%s) must be newer than the published %s (or pass --again to rebuild the same one)" % (version, old["version"]))
if not notes and again and version == old.get("version"): notes = old.get("notes", [])
if not notes: sys.exit('Say what is new: python3 publish.py "First change" "Second change"')

# 1. pages
subprocess.run([sys.executable, os.path.join(here, "build.py")], check=True)

# 2. the exe: any earlier build works as the base, since every changed page is replaced
bases = sorted(glob.glob(os.path.join(upd, "WebStudiosBrowser-*.exe")), key=os.path.getmtime)
base = bases[-1] if bases else None
if not base:
    for z in ("WebStudiosBrowser.zip", "WebStudiosBrowser-3.0.zip"):
        p = os.path.join(root, z)
        if os.path.exists(p):
            base = os.path.join(here, "out", "base.exe")
            with zipfile.ZipFile(p) as zf, open(base, "wb") as f: f.write(zf.read("WebStudiosBrowser.exe"))
            break
if not base: sys.exit("No earlier WebStudiosBrowser.exe to build on")
exe_name = "WebStudiosBrowser-%s.exe" % version
exe = os.path.join(upd, exe_name)
tmp = os.path.join(here, "out", exe_name)
subprocess.run([sys.executable, os.path.join(here, "repack.py"), base, os.path.join(here, "out"), tmp], check=True)
for b in glob.glob(os.path.join(upd, "WebStudiosBrowser-*.exe")): os.remove(b)
shutil.move(tmp, exe)

# 3. the updater, rebuilt when its source changed
src = os.path.join(here, "updater", "WebsUpdate.cs")
upx = os.path.join(upd, "WebsUpdate.exe")
if not os.path.exists(upx) or os.path.getmtime(src) > os.path.getmtime(upx):
    built = os.path.join(here, "out", "WebsUpdate.exe")
    for cmd in (["mcs", "-target:winexe", "-platform:anycpu", "-optimize+", "-r:System.Web.Extensions", "-r:System.Windows.Forms", "-r:System.Drawing", "-out:" + built, src],
                ["csc", "/nologo", "/target:winexe", "/platform:anycpu", "/optimize+", "/r:System.Web.Extensions.dll", "/out:" + built, src]):
        if shutil.which(cmd[0]): subprocess.run(cmd, check=True); break
    else: sys.exit("updater/WebsUpdate.cs changed, but there is no C# compiler (mcs or csc) to build it")
    shutil.copy(built, upx)

def info(path, name):
    data = open(path, "rb").read()
    return { "url":RAW + name, "sha256":hashlib.sha256(data).hexdigest(), "size":len(data) }

manifest = { "version":version, "date":datetime.date.today().isoformat(), "notes":notes,
             "exe":info(exe, exe_name), "updater":info(upx, "WebsUpdate.exe"),
             "google":old.get("google") or { "clientId":"", "clientSecret":"" } }
if old.get("webai"): manifest["webai"] = old["webai"]      # the Web AI server's address (tools/set_webai_server.py)
with open(os.path.join(upd, "latest.json"), "w", encoding="utf-8", newline="\n") as f: json.dump(manifest, f, indent=2, ensure_ascii=False); f.write("\n")

# 4. the setup for a new computer is the updater itself: it installs the browser and keeps it current
shutil.copy(upx, os.path.join(root, "WebsBrowserSetup.exe"))

# 5. the zip for installing by hand
z = os.path.join(root, "WebStudiosBrowser.zip")
with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    zf.write(exe, "WebStudiosBrowser.exe")
    zf.write(os.path.join(here, "dist", "README.txt"), "README.txt")
    zf.write(os.path.join(here, "dist", "install.ps1"), "install.ps1")
print("published %s: %s (%s bytes), sha256 %s" % (version, exe_name, manifest["exe"]["size"], manifest["exe"]["sha256"]))
print("commit updates/ and WebStudiosBrowser.zip, push, and merge into main: browsers offer it within a few hours")
