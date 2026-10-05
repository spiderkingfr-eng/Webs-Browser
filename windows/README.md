# Webs Browser for Windows: how it's made

`../WebStudiosBrowser.zip` holds the finished browser and `../updates/` the copy every installed browser updates to. This folder holds what built them.

The browser's window, new tab page, Settings, sidebar, games and the script it runs inside web
pages (`shield.js`) are HTML and JavaScript files embedded in `WebStudiosBrowser.exe`. Webs 3.0
adds its 150 features to those files only, without changing a line of the program code, so the
exe could be updated without its C# source. Version 3.1 adds Google sign-in and updates the same way, plus a small separate updater.
Version 3.3 adds Web AI, which talks to a small server of its own (`../server/web-ai/`):

| Path | What it is |
| --- | --- |
| `orig/` | The files as they were in the 2.x exe |
| `src/` | The 3.0 additions, one or more files per page |
| `build.py` | Puts `src/` into `orig/` and writes the new pages to `out/`. Every insertion point must match exactly once, or it stops. |
| `repack.py` | Puts the files from `out/` back into an exe (`pip install pefile dnfile`) |
| `Check.cs` | Loads an exe with .NET or Mono and prints its embedded files and a hash of its code, to compare two builds |
| `tests/` | Browser tests (Playwright): the pages run with a fake Windows host, and the page tools run inside a test page |
| `VERSION` | The version being built; `build.py` writes it into the browser |
| `updater/WebsUpdate.cs` | The updater and setup (C#, .NET Framework 4, no other files needed) |
| `publish.py` | Makes a release: builds, repacks, compiles the updater and writes `../updates/` and `../WebStudiosBrowser.zip` |
| `google.py` | Switches on Google sign-in for every copy (see below) |
| `dist/` | `README.txt` and `install.ps1`, which go into the zip |

How the additions hook in: functions in the original pages are wrapped (the original still runs
first), lists such as search engines, bangs, commands and widgets are extended, and new panels use
the pages' own helpers. Tools that work on web pages are `x-…` actions in `shield.js`, reached
through the host's existing `page-tool` command, which passes any action name through.

## How updates reach people

`updater/WebsUpdate.cs` is a small program that installs the browser and keeps it current. It is
set up once: by `WebsBrowserSetup.exe` (the same program) on a new computer, or by the browser's
Update button on a copy from before 3.2, which downloads it this one last time. It then:

- copies itself to `%LOCALAPPDATA%\Programs\Webs Browser\` and starts with Windows
  (`HKCU\...\Run`, no admin), with no window;
- reads `updates/latest.json` from `main` every three hours, downloads the new exe with its own
  connection, checks its SHA-256, and puts it in place. With the browser closed that's all; while
  it's open, the running exe is renamed aside and the new one starts next time;
- tells the browser in `ui\user\webs-update.json` in the browser's data folder, which the browser
  reads as `https://browser.example/user/webs-update.json`;
- takes requests from the browser in its `inbox` folder. The browser writes them with the folder
  sync command (`sync-write`): "check" (get a new version ready now), "update" (install it, close
  the browser the way the X button does, so the tabs are saved, and open the new one), and
  "auto-on"/"auto-off" (the Settings switch). That's what the Update / Restart to update button does;
- replaces itself when `latest.json` names a newer updater;
- (2.1, with 3.7) asks the Web AI server (`webai.server` in `latest.json`, its `/live`) how the
  owner wants new versions handed out, from the dashboard's **Updates** tab. During a gradual
  rollout to some percent, a PC installs the new version by itself only when its number (0 to 99,
  from a random `device-id` in the install folder) is below it; the browser's Update button still
  installs it at once. When the owner chooses **go back**, every PC installs the version that
  `latest.json` names as `previous`, checked against its own SHA-256 the same way. If the server
  can't be reached, updates work as before.

Nothing goes through the browser's downloads, so Windows has no download to warn about, and the
installed exe isn't marked as coming from the internet, so it opens without asking. Only addresses
in this repository are accepted, and every exe must match its checksum. Anyone who can push to
`main` can publish an update, so keep that limited to you. `WebsUpdate.exe --uninstall` stops it.

## Publishing an update

1. Make the changes (in `src/`) and test them.
2. Raise the number in `VERSION`, for example to `3.2.0`.
3. `python3 publish.py "What changed" "Another change"` (the notes show in the update panel).
4. Commit everything, push, and merge into `main`. That's the release.

`publish.py` keeps the version before next to the new one in `updates/` and names it as
`previous` in `latest.json`, so the dashboard can put every PC back on it.

Copies from before 3.1 have no Update button, so people on 3.0 or older install once by hand
(`WebsBrowserSetup.exe`, or the zip).

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

## Web AI

Web AI (3.3) is a chat with Claude in the sidebar (`src/webai.side.js`, `src/webai.side.css`),
opened by the ✦ toolbar button, the menu, the command palette or Alt+Shift+A (`src/webai.js`).
It never holds an API key. It talks to the Web AI server in `../server/web-ai/`, a Cloudflare
Worker that keeps the key, checks each person's Web AI code, counts questions per day and streams
the answer back. That folder's README has the setup steps.

- **The page:** with "Use this page" on, the sidebar asks the browser window for the page through
  storage (`wsb.xaiAsk.<window>`). The window runs the `x-ai` page tool in `shield.js` (the text,
  the selection and the title) and hands the result back (`wsb.xaiPage.<window>`), where the
  sidebar removes it as soon as it has read it. Private windows answer "private" without reading
  the page. A page is sent once per chat; follow-up questions about it don't send it again.
- **Ready by itself:** the server's address (and a shared code) come with `updates/latest.json`
  (`"webai": {"server": …, "code": …}`, set with `python3 ../tools/set_webai_server.py <address> --code <code>`).
  When the server is open (`OPEN`), Web AI asks without a code and the server counts per device
  (`wsb.xaiDev`, a random id). Otherwise it uses the shared code. A personal code can still be
  entered in Web AI's settings.
- **Kept on the computer:** the code and the current chat (`wsb.xai`, `wsb.xaiChat`). Neither is
  synced to Google.
- **Answers** are shown as Markdown that is escaped first. Links only go to http(s) addresses and
  open only when clicked. Pictures are never loaded, so a page can't make Web AI send anything
  anywhere by itself.

## Help & support

Help & support (3.6) is a chat with whoever runs the Web AI server, in the sidebar
(`src/support.side.js`, `side.html#support`), opened from the menu or the command palette.
The browser window (`src/support.js`) asks the server for replies, one window at a time
(`wsb.supportLock`), every 4 seconds while the chat is on screen and every 30 otherwise.

- **Settings, only when allowed:** support can change settings only while the chat is open and
  "Let support adjust my settings" is on (30 minutes; the ✕ on the toolbar's 🛟 ends it). Only the
  switches and choices in `../js/support.settings.js` (shared with the iPhone app and the server),
  checked again here before anything is applied, each shown with Undo.
- **Never sent:** history, bookmarks, tabs, passwords, pages, or anything typed into a setting
  (home page, VPN server, download folder, your own search engine).
- **Kept on the computer:** the chat (`wsb.support`, not in backups or Google sync).
- **3.7:** help articles from the owner, problem reports with their answers, and 👍/👎 when a chat ends.

## From Webs

What the owner puts on the dashboard's Start page tab (3.7, `../js/live.js`, shared with the
iPhone app) shows on the new tab page under the search box (`src/live.newtab.js`; Customize →
From Webs turns it off), on the games page (the leaderboard, the community goal and the owner's
daily word), and in the browser window (`src/live.chrome.js`): secret words and the code hunt
typed in the address bar open a new tab page that plays their effect (`newtab.html#lvfx=`), since
web pages cover the window; special achievements join Menu → Achievements; and the Update button
follows the owner's rollout or going back (`src/cloud.js`). The window checks in about once an
hour with the version only (Settings → Webs 3.0 extras → Send anonymous counts turns it off).

## Anime themes

`../js/anime.js` (shared with the iPhone app) has the nine looks: colors, live wallpapers drawn on a
canvas, start-page cards and the picker. Picking one sets the "custom" color theme and the accent,
which every page already reads, so the whole browser changes at once; `src/anime.newtab.js` adds the
wallpaper and card to the new tab page (and the picker to its Background panel), `src/anime.chrome.js`
the band across the top of the window and Menu → Anime themes…, `src/anime.settings.js` the row in
Settings → Appearance. The previous look is kept in `settings.animePrev` and comes back with No anime theme.
Everything loops (3.8.1): wallpapers, the cards' particle layer, the picker's tiles (paused off screen) and the
band. Windows' animation effects off gives a gentler version; Animations: Off in Webs gives still frames.

### Behind websites (3.9)

Menu → Anime wallpaper on this site… (or the command palette) puts a theme's live wallpaper behind
the site you're on, with a look of its own for each site: which theme (or the browser's), behind the
page or faintly over it, how much shows through, see-through sidebars and bars, soft focus, a still
picture. Settings → Appearance turns it off, on for the sites you choose, or on for every site, and
lists the sites with a look of their own. Never in a private window.

- **Sent to the page:** when a page on such a site finishes loading, `src/anime.chrome.js` sends
  `src/anime.page.js` with `../js/anime.js` (the copy in the window, `<script id="wsb-anime-js">`)
  through the host's `userjs` page tool, the same way as your own userscripts, so it works on strict
  sites too. On that page, later changes send just the settings. `anime.js` runs inside a function
  there, so the page gets no `window.Anime` and none of its styles.
- **Behind the page:** a closed shadow root with the canvas and a veil, fixed behind everything
  (`z-index:-2147483647`, no pointer events). It looks over the page at 48 points, from the top of
  each stack down: big plain backgrounds (the page, the main column) get `data-wsb-anime="b"` and turn
  see-through; sidebars and bars across the page get `g0`, `g1`… (their own color, half see-through).
  Anything smaller with a background of its own stops the look at that point and keeps its look:
  messages, cards, menus, inputs, buttons, pictures, video. The veil is the site's own background
  color, so text stays readable; a light site gets about a third of the wallpaper, a dark one half.
  The site redrawing itself, scrolling or changing its colors (its dark mode) is followed.
- **Over the page:** the same canvas on top with `pointer-events:none`, faint (`screen` on dark
  sites, `multiply` on light ones), for sites whose backgrounds are pictures.
- `settings.animeWeb` is `""`, `"pick"` or `"all"`; `settings.animeSites` holds each site's look.
  The iPhone app can't do this: iOS doesn't let a web app change other sites.

## 3.10: fifty more

Each part is a script in `src/` (the window) with what both apps share in `../js/`, put in by `build.py`:

| Part | Files | How it works |
| --- | --- | --- |
| Games and XP | `../js/games.more.js`, `../js/xp.js`, `src/xp.*.js` | Sudoku, Solitaire, Chess (all the rules, checked with perft) and Blocks on the games page; XP from games, visits and achievements |
| Anime extras | `../js/anime.js`, `src/anime.*.js`, `../js/buddy.js` | Event themes and a theme vote from the dashboard, a schedule, a screensaver, a trail, the hidden spider, Mochi |
| Web AI | `../js/ai.js`, `src/webai.more.js` | One question per job (`task` on `/chat`): address bar answers, key moments, tidy, compare, study, explain, find |
| Getting things done | `../js/gtd.js`, `src/gtd.chrome.js` | The routine, reminders, the checkup, the digest, voice; the address kept with a non-extractable AES key in IndexedDB; `x-fill` fills a form |
| Privacy | `../js/privacy.js`, `src/privacy.chrome.js` | `x-shop` reads a shop's signs and `x-shop-warn` shows the bar; `x-seen` lists what the page sees. Clean up: `site-clear` before the last tab closes (the host's "Cookies and data for … cleared" closes it). Containers are profiles named `Container …`: the address goes across with the folder sync command (`sync-write`) into the updater's folder, and the container's window reads it (`sync-read`) as it opens |
| Phone and PC, Play a friend | `../js/link.js`, `src/link.*.js`, `../js/games.online.js` | A WebSocket to the server's live rooms (`rooms.js`): your linked devices' room, or a game's |
| Voice control (3.12) | `src/voice.chrome.js` | “Hey Webs”: over a hundred commands (each a pattern and what it does), your own phrases, spoken answers. Listening is the browser's speech recognition, or Vosk (WebAssembly, from jsDelivr, with its small English model) when that doesn't work in WebView2 |
| Owner's tools | `../js/stats.js`, `src/stats.*.js` | Counts (panels as they open, page tools on their way to the host), errors, A/B, invites and the gallery, through the ledger (`ledger.js`) |

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
node tests/t_chrome.js     # also t_side, t_ntp, t_games, t_shield, t_misc, t_examples, t_cloud, t_updated, t_autoupdate, t_studio, t_webai, t_voice, t_support, t_live, t_anime, t_animesite, and (3.10) t_moregames, t_looks, t_ai, t_gtd, t_privacy, t_link, t_owner and t_ipad; `sh tests/t_updater.sh` tests the updater under Mono (23 checks, with a gradual rollout and going back)
```

470 checks pass (`t_cloud` fakes Google's sign-in, token and Drive endpoints and the update file; `t_webai` runs Web AI against the real server code with a pretend Claude; `t_support` runs Help & support against it and the owner's dashboard; `t_live` runs From Webs and the rollout against it; the server's own tests in `../server/web-ai/` add 315 checks). The exe itself was not run on Windows here: the tests run the same pages in
Chromium, the engine WebView2 uses.
