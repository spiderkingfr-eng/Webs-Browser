"""Turns on "Sign in with Google" for every copy of the browser.

usage: python3 google.py <client id> <client secret>

Writes the Desktop app OAuth client you made in Google Cloud (see README.md)
into ../updates/latest.json. Commit, push and merge into main: browsers pick
it up the next time they check for updates (within a few hours, or at once
with Menu > Check for updates). No new exe is needed.

A Desktop app's client secret is not a real secret: Google's documentation
for installed apps says it can't be kept confidential, because every copy of
the app carries it. What protects your account is the sign-in itself."""
import json, os, re, sys
if len(sys.argv) != 3: sys.exit(__doc__)
cid, secret = sys.argv[1].strip(), sys.argv[2].strip()
if not re.fullmatch(r"[0-9]{5,}-[a-z0-9]+\.apps\.googleusercontent\.com", cid): sys.exit("That doesn't look like a client ID (it ends in .apps.googleusercontent.com)")
if not re.fullmatch(r"[A-Za-z0-9_-]{10,100}", secret): sys.exit("That doesn't look like a client secret")
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "updates", "latest.json")
m = json.load(open(p, encoding="utf-8"))
m["google"] = { "clientId":cid, "clientSecret":secret }
with open(p, "w", encoding="utf-8", newline="\n") as f: json.dump(m, f, indent=2, ensure_ascii=False); f.write("\n")
print("Google sign-in is on in", p, "- commit, push and merge into main.")
