"""Tells every copy of Webs Browser where the Web AI server is.

    python3 tools/set_webai_server.py https://web-ai.your-name.workers.dev

Writes the address into updates/latest.json (Windows) and updates/iphone.json
(iPhone). Commit, push and merge into main: browsers pick it up with their next
update check (Windows every few hours, iPhone when the app is opened), so people
only type their Web AI code. No new version is needed; publish.py and
publish_iphone.py keep the address. See server/web-ai/README.md."""
import json, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) != 2: sys.exit(__doc__)
url = sys.argv[1].strip().rstrip("/")
if not re.fullmatch(r"https://[^\s/?#]+\.[^\s/?#]+(/[^\s?#]*)?", url): sys.exit("The address should look like https://web-ai.your-name.workers.dev")
for name in ("latest.json", "iphone.json"):
    p = os.path.join(root, "updates", name)
    m = json.load(open(p, encoding="utf-8"))
    m["webai"] = { "server":url }
    with open(p, "w", encoding="utf-8", newline="\n") as f: json.dump(m, f, indent=2, ensure_ascii=False); f.write("\n")
    print("updates/%s: Web AI server %s" % (name, url))
