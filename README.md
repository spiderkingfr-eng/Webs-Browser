# Webs Browser

Webs Browser comes in two versions:

- **Windows**: the full browser, in `WebStudiosBrowser.zip` (open its `README.txt`). Version 3.1 can save your layout, settings and bookmarks to your Google account, and updates itself: when a new version is published in `updates/`, every copy shows an Update button. 3.0 added 150 features. `windows/` shows how it's built and how to publish an update. `WebStudiosBrowser (1).zip` is an older version.
- **iPhone and iPad**: a web app that you add to your Home Screen. It opens full screen with its own icon, like a normal app, and keeps working offline. It runs from the files in this repository (`index.html` and the others listed below).

## Put the iPhone app online

An iPhone installs a web app from a web address, so these files have to be hosted somewhere first. Any static host works. Here are two free options:

**GitHub Pages**
1. Free GitHub accounts only get Pages for **public** repositories, so make this one public first: *Settings → General → Danger Zone → Change visibility*. With GitHub Pro you can keep it private.
2. *Settings → Pages → Build and deployment → Source: Deploy from a branch*, then pick the branch with these files (`main` once this work is merged) and the `/ (root)` folder, and press *Save*.
3. After a minute or two the app is live at `https://spiderkingfr-eng.github.io/Webs-Browser/`.

**Netlify or Cloudflare Pages** (these can keep the repository private): create a site from this repository. There's no build command, and the publish folder is the repository root.

## Install it on your iPhone

1. Open the address in **Safari**.
2. Tap **Share** (the square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open **Webs** from your Home Screen.

The app also shows these steps when you first open it in Safari.

## Updates

The iPhone app updates itself from this repository. Once a new version is on `main`, every iPhone
with Webs on its Home Screen shows an **Update** button the next time Webs is opened (or comes back
from the background), with what's new in it; one tap switches to it. Settings → Check for updates
looks straight away.

To publish one: make the changes, run `python3 tools/publish_iphone.py "What changed" "Another change"`
(it raises the version by one, or give one first, like `2.2.0`), then commit, push and merge into
`main`. GitHub Pages takes a minute or two to serve it. The Windows browser has its own, separate
updates: see `windows/README.md`.

## Web AI

*Menu → Web AI* is a chat with Claude, made by Anthropic. It can summarize the page you're on,
pick out the key points, explain it simply, or answer anything else. It uses the same Web AI
server as the Windows browser (`server/web-ai/`, with setup steps in its README). That server
holds the API key and each person's Web AI code. On iPhone, Webs can't read the pages it shows,
so with *Use this page* on it sends the page's address, and Claude opens it (once, a limited
amount). Private tabs never send their page. The server's address comes with
`updates/iphone.json` (`python3 tools/set_webai_server.py <address>`), so people only type their
code.

## Notifications

*Settings → Notifications* (2.4) lets Webs send notifications even when it's closed: when a new
version is out, news from you (sent from the Web AI server's dashboard, `…workers.dev/admin`), and
a daily word reminder at the time each person picks. They come from the same Web AI server
(`server/web-ai/`, "Notifications on iPhones" in its README), so there's nothing else to set up
once it's deployed. iPhones only allow notifications for apps on the Home Screen, with iOS 16.4
or newer.

## Help & support

*Menu → Help & support* (iPhone 2.6, Windows 3.6) lets someone who's stuck write to you. You answer
from the Web AI server's dashboard (`…workers.dev/admin`, **Help & support**), and the reply shows
in the app (on iPhone also as a notification, if those are on). Only while a chat is open, and only
if they turn on **Let support adjust my settings** (30 minutes at most, ended any time), the
dashboard shows a small screen of their iPhone or PC where you can change a few switches and
choices: the list in `js/support.settings.js`. Nothing typed in, nothing that deletes anything.
Each change shows on their screen with Undo. You never see their history, bookmarks, tabs, notes,
passwords or the pages they visit.

## What it does

Version 2.0 adds 150 new things. They're all listed in the app under *Menu → What's new*.

- **Start page**: four clock styles (Classic, Big, Flip, Analog), the greeting and weather, today's focus, shortcuts (drag to reorder, emoji icons), "continue where you left off", "Jump back in", the reading list, to-do (star, edit, drag), and a countdown. Optional parts include a quote of the day, habits, a quick note, a calendar, world clocks, the year's progress, sunrise/sunset/moon, and Wikipedia's "On this day". Rearrange it all in *Customize*.
- **Looks**: 8 live wallpapers, Wikipedia's picture of the day or your own picture (with parallax), seasonal effects, 7 dark color themes, any accent color, text size, fonts and a compact layout. Springy animations throughout; turn them off in *Settings → Appearance*.
- **Smart address bar**: the instant answers from Windows (calculator, units, currencies, time zones, dates, weather, definitions, crypto, dice, passwords, timers) plus many more:
  - Health and money: BMI, age, loans, compound interest, percent change.
  - Text: word counts, change case, base64/URL encoding, roman numerals, Unix time, SHA hashes, lorem ipsum.
  - Lookups: emoji, Wikipedia summaries, translation, your IP, a 7-day forecast.
  - Quick actions: `note:` and `todo:` capture, "pick for me", days between dates, numbers in words, QR codes.
  - Search: voice input, completion of sites you visit, recent searches, calculator history, your own search engines and keywords, and 40+ more bangs (`!yt`, `!gh`, `!wa`…).
- **Tabs**:
  - Normal and private tabs.
  - Search, grid or list view, pin, duplicate, undo close, reopen closed, close others, sort by site.
  - Saved tab groups. Swipe the address bar to switch tabs.
  - Page info with a rule for each site (inside Webs or in Safari), a QR code for any page, full screen, and a reader view for Wikipedia.
- **Library**: bookmarks with folders and HTML import/export (Chrome, Safari, Edge, Firefox), history by time or by site, and the reading list. *Search everything*, Insights, 22 achievements, and a copy history.
- **Notes**: checklists, pins, colors, search, word counts, and saving a note as a text file.
- **Tools**: a calculator, a unit converter, a QR code maker (text, links, Wi-Fi), a password and passphrase maker, a stopwatch, a focus timer, colors and palettes, text tools, a breathing exercise, a decision wheel and a bill splitter.
- **Games**: Web Runner, Snake, 2048, Daily word, Tic-tac-toe, Memory and Minesweeper, all with touch controls and best scores.
- **Privacy**:
  - A passcode lock.
  - History that can delete itself after a set time.
  - A storage manager.
  - Clean links and HTTPS first: tracking parameters like `utm_`, `fbclid` and `gclid` are removed, and `http://` links are upgraded, before anything opens.
- **Alerts**: timer notifications and keeping the screen on (on iOS 16.4 or later, with Webs on the Home Screen), plus the reading list count on the app icon.
- **Backups**: these use the same file format as the Windows version, so bookmarks, history, notes, to-dos, habits and shortcuts can move either way. Make one in *Settings → Storage and backup*, send it with AirDrop, iCloud Drive or email, and restore it on the other device.
- **Keyboard shortcuts on iPad**: press `?` to see them.

### What's different on iPhone

On an iPhone, an app can only show a website inside itself when that website allows it. So:

- **YouTube and Vimeo videos, Wikipedia, maps, Spotify and the games** open inside Webs, with back, forward and reload.
- **Other sites open in Safari on top of Webs.** Tap *Done* there to come back to where you were.
- *Settings → Opening websites → Inside Webs when possible* tries to open every site inside the app. A site that refuses shows a blank page with an **Open in Safari** button.
- **Only on Windows**: Shield (the ad blocker), the VPN and Tor, extensions, the download manager and developer tools. iOS doesn't let web apps do these things.

## Files


| File | What it is |
| --- | --- |
| `index.html`, `app.css` | The app's page and layout |
| `fx.css` | Animations, live wallpapers, widgets, tools and everything new in 2.0 |
| `js/core.js` | Storage, settings, icons, toasts and drag-to-reorder |
| `js/answers.js` | The address bar's instant answers (taken from the Windows browser) |
| `js/answers2.js` | More answers, bangs, your own engines and keywords, voice input and completion |
| `js/app.js` | Tabs, the start page, the menu, settings, backups and the install prompt |
| `js/fx.js` | Motion: the splash, ripples, sheets, the theme reveal, pull to refresh, confetti and live wallpapers |
| `js/widgets.js` | The start page's widgets |
| `js/library.js` | Bookmarks, history, the reading list, notes, Search everything, Insights and Achievements |
| `js/tools.js` | The Tools |
| `js/extras.js` | The passcode lock, storage, alerts, page info, the reader view and keyboard shortcuts |
| `js/whatsnew.js` | The list of what's new |
| `js/webai.js` | Web AI (2.2) |
| `js/push.js` | Notifications (2.4); `sw.js` shows them |
| `js/support.js` | Help & support (2.6): the chat, and support's changes with Undo |
| `js/support.settings.js` | The only settings support may change, shared with Windows and the server |
| `js/qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT license), for QR codes |
| `games.html` | The offline games |
| `manifest.webmanifest`, `icons/` | What iOS and Android use to install the app and draw its icon |
| `sw.js` | Offline support, and how phones notice a new version (its `VERSION`) |
| `updates/iphone.json` | The newest iPhone version and its notes, shown before updating |
| `tools/publish_iphone.py` | Publishes an iPhone update (see Updates below) |
| `tools/set_webai_server.py` | Tells every copy, iPhone and Windows, where the Web AI server is |
| `server/web-ai/` | The Web AI server (a Cloudflare Worker) and how to set it up |

There's no build step. To try it on your computer, run `python3 -m http.server` in this folder and open http://localhost:8000.


