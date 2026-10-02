# Webs Browser for Windows: how it's made

`../WebStudiosBrowser.zip` holds the finished browser and `../updates/` the copy every installed browser updates to. This folder holds what built them.

The browser's window, new tab page, Settings, sidebar, games and the script it runs inside web
pages (`shield.js`) are HTML and JavaScript files embedded in `WebStudiosBrowser.exe`. Webs 3.0
adds its 150 features to those files only, without changing a line of the program code, so the
exe could be updated without its C# source. Version 3.1 adds Google sign-in and updates the same way, plus a small separate updater:

| Path | What it is |
| --- | --- |
| `orig/` | The files as they were in the 2.x exe |
| `src/` | The 3.0 additions, one or more files per page |
| `build.py` | Puts `src/` into `orig/` and writes the new pages to `out/`. Every insertion point must match exactly once, or it stops. |
| `repack.py` | Puts the files from `out/` back into an exe (`pip install pefile dnfile`) |
| `Check.cs` | Loads an exe with .NET or Mono and prints its embedded files and a hash of its code, to compare two builds |
| `tests/` | Browser tests (Playwright): the pages run with a fake Windows host, and the page tools run inside a test page |
| `VERSION` | The version being built; `build.py` writes it into the browser |
| `updater/WebsUpdate.cs` | The updater (C#, .NET Framework 4, no other files needed) |
| `publish.py` | Makes a release: builds, repacks, compiles the updater and writes `../updates/` and `../WebStudiosBrowser.zip` |
| `google.py` | Switches on Google sign-in for every copy (see below) |
| `dist/` | `README.txt` and `install.ps1`, which go into the zip |

How the additions hook in: functions in the original pages are wrapped (the original still runs
first), lists such as search engines, bangs, commands and widgets are extended, and new panels use
the pages' own helpers. Tools that work on web pages are `x-…` actions in `shield.js`, reached
through the host's existing `page-tool` command, which passes any action name through.

## Publishing an update

Every copy of the browser (3.1 and later) reads `updates/latest.json` from the `main` branch on
GitHub every few hours. When it names a newer version, an Update button appears in the tab strip.
Clicking it downloads `updates/WebsUpdate.exe` and opens it; the updater downloads the new exe,
checks its SHA-256 against `latest.json`, closes the browser the way the X button does (so the
tabs are saved), swaps the exe and opens it again. Nothing is installed without that click.

1. Make the changes (in `src/`) and test them.
2. Raise the number in `VERSION`, for example to `3.2.0`.
3. `python3 publish.py "What changed" "Another change"` (the notes show in the update panel).
4. Commit everything, push, and merge into `main`. That's the release.

Only addresses in this repository are accepted for the updater and the exe, and the exe must match
its checksum. Anyone who can push to `main` can publish an update, so keep that limited to you.
Copies from before 3.1 have no Update button, so people on 3.0 or older install 3.1 by hand once
(the zip, or just `WebsUpdate.exe`, which also does a first install).

## Turning on "Sign in with Google"

Google requires every app that signs people in to be registered, so this is a one-time setup in
a free Google Cloud project, about ten minutes. Nothing about it is tied to a computer.

1. Open https://console.cloud.google.com/ and create a project, for example "Webs Browser".
2. APIs & Services → Library → search "Google Drive API" → Enable.
3. Google Auth Platform (APIs & Services → OAuth consent screen) → Get started. App name
   "Webs Browser", your email as support and contact address, Audience: External.
4. Data access → Add or remove scopes → tick `.../auth/drive.appdata` (its own hidden app data),
   `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile` → Update → Save.
5. Audience → Publish app, so it is "In production". (While it is "Testing", only test users you
   list can sign in, and their sign-in ends after 7 days.) These scopes don't need Google's review.
6. Clients → Create client → Application type **Desktop app** → Create. Copy the client ID and
   the client secret.
7. `python3 google.py <client id> <client secret>`, then commit, push and merge into `main`.

Every browser picks it up at its next update check (or at once: Menu → Check for updates), with
no new exe. Sign-in opens Google in a tab; when you're done, Google sends the tab to
`http://127.0.0.1:<port>/` with a one-time code, which the browser reads from the tab's address
and trades for a refresh token (OAuth for installed apps, with PKCE). If Google won't sign in
inside Webs Browser, the account panel offers to sign in with Chrome or Edge and paste the address
it ends up on. Synced data is one JSON file in the app's hidden Drive folder.

## Making the exe by hand

```
python3 build.py
python3 repack.py ../updates/WebStudiosBrowser-<version>.exe out WebStudiosBrowser.exe
```

`repack.py` keeps everything else in the exe byte for byte: a round trip with no changed files
gives an identical exe. For 3.0, `Check` showed the same 133 types and 648 method bodies (same code
hash) before and after, and every embedded file read back by the .NET runtime matched `out/`.

## Testing

```
npm install playwright
python3 build.py
node tests/t_chrome.js     # also t_side, t_ntp, t_games, t_shield, t_misc, t_examples and t_cloud
```

282 checks pass (`t_cloud` fakes Google's sign-in, token and Drive endpoints and the update file). The exe itself was not run on Windows here: the tests run the same pages in
Chromium, the engine WebView2 uses.
