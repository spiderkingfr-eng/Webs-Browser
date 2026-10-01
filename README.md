# Webs Browser

Webs Browser comes in two versions:

- **Windows**: the full browser, in `WebStudiosBrowser (1).zip` (open its `README.txt`).
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

## What it does

- **Start page**: clock, greeting, weather, shortcuts (tap and hold one to edit it), "Jump back in", reading list, to-do, tip of the day, a seasonal effect, and your own background picture.
- **Smart address bar**: the same instant answers as on Windows, including a calculator, units, currencies, time zones, dates, weather, word definitions, crypto prices, dice and passwords. Typing something like `timer 10 min` starts a timer. Bangs (`!g`, `!w`, `!br`…) and keywords (`yt`, `w`, `gh`…) work too, and search suggestions appear as you type.
- **Tabs and private tabs**: private tabs keep no history.
- **Library**: bookmarks, history and the reading list.
- **Notes and games**: notes, plus the offline games (Web Runner, Snake, 2048, Daily word) with touch controls.
- **Clean links and HTTPS first**: tracking parameters like `utm_`, `fbclid` and `gclid` are removed, and `http://` links are upgraded, before anything opens.
- **Backups**: these use the same file format as the Windows version, so bookmarks, history, notes, to-dos and shortcuts can move either way. Make one in *Settings → Backup*, send it with AirDrop, iCloud Drive or email, and restore it on the other device.
- **Looks**: dark, light or automatic theme, accent colors, and the address bar at the bottom or the top. It's laid out for iPhone screens, with a one-row toolbar on iPad and larger screens.

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
| `js/core.js` | Storage, settings and icons |
| `js/answers.js` | The address bar's instant answers (taken from the Windows browser) |
| `js/app.js` | Tabs, the start page, the library, notes, settings, backups and the install prompt |
| `games.html` | The offline games (from the Windows browser, with touch controls added) |
| `manifest.webmanifest`, `icons/` | What iOS and Android use to install the app and draw its icon |
| `sw.js` | Offline support. Raise `VERSION` in this file when you publish changes, and the installed app will offer to update. |

There's no build step. To try it on your computer, run `python3 -m http.server` in this folder and open http://localhost:8000.
