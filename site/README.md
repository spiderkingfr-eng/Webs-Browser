# Webs Browser website

A one-page website about Webs Browser, with four tabs: **Home** (the highlights), **Sneak peeks**
(screenshots), **Features**, and **Download** (the Windows installer and zip, and how to add the
iPhone app). It needs no server, no build, and nothing to install: just `index.html` and the
`img` folder.

## Putting it online

Upload `index.html` and the `img` folder together, as they are, to any static web host. For example:

- **Netlify Drop**: open https://app.netlify.com/drop and drag this folder onto the page.
- **GitHub Pages**: this folder is already in the repository. Once it's in `main`, it's at
  https://spiderkingfr-eng.github.io/Webs-Browser/site/
- **Cloudflare Pages**, **Vercel**, or any web host's file manager work the same way.

Once it's up, change the `og:image` line near the top of `index.html` to the picture's full
address (for example `https://your-site.com/img/win-webai.jpg`), so links to the site show a
preview picture when they're posted.

## What updates by itself

- The **Download** buttons always point at the newest `WebsBrowserSetup.exe` and
  `WebStudiosBrowser.zip` in the repository, so publishing an update needs no change here.
- The version line and "What's new" on the Download tab are read from `updates/latest.json` and
  `updates/iphone.json` when the page opens.

## New screenshots

The pictures in `img` are real screens of the browser. To take them again after a change:

    cd windows && python3 build.py && cd .. && node site/make-shots.js
