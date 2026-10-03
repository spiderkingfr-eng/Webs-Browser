"""Tells every copy of Webs Browser where the Web AI server is.

    python3 tools/set_webai_server.py https://web-ai.your-name.workers.dev [--code SHARED_CODE]

Writes the address into updates/latest.json (Windows) and updates/iphone.json
(iPhone). Commit, push and merge into main: browsers pick it up with their next
update check (Windows every few hours, iPhone when the app is opened), so people
don't set anything up. No new version is needed; publish.py and publish_iphone.py
keep it. See server/web-ai/README.md.

--code gives every copy a shared Web AI code to use when the server isn't open
(OPEN=true lets everyone ask without a code). It is public, like this file:
give it its own daily limit in WEB_AI_CODES (Everyone=code=60)."""
import json, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
code = ""
if "--code" in args:
    i = args.index("--code"); code = args[i + 1] if i + 1 < len(args) else ""; del args[i:i + 2]
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", code): sys.exit("The shared code needs 8 or more letters and numbers")
if len(args) != 1: sys.exit(__doc__)
url = args[0].strip().rstrip("/")
if not re.fullmatch(r"https://[^\s/?#]+\.[^\s/?#]+(/[^\s?#]*)?", url): sys.exit("The address should look like https://web-ai.your-name.workers.dev")
for name in ("latest.json", "iphone.json"):
    p = os.path.join(root, "updates", name)
    m = json.load(open(p, encoding="utf-8"))
    m["webai"] = { "server":url, **({ "code":code } if code else {}) }
    with open(p, "w", encoding="utf-8", newline="\n") as f: json.dump(m, f, indent=2, ensure_ascii=False); f.write("\n")
    print("updates/%s: Web AI server %s%s" % (name, url, " with a shared code" if code else ""))
