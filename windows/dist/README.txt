WEBS BROWSER
============

One file. No runtime to download, nothing beside it.
Double-click WebStudiosBrowser.exe and it runs. In the browser, Menu >
"What's new" lists every feature and where to find it, the newest first;
Ctrl+/ shows every keyboard shortcut.


NEW IN WEBS 3.1
---------------
  Google account  Menu > Sign in with Google. Your layout and settings, new
                  tab shortcuts, bookmarks, notes, to-dos, reading list and
                  more are kept in a hidden app folder in your Google Drive
                  that only Webs Browser can see, and come back on any
                  computer where you sign in. Settings > Google account picks
                  what syncs; "Delete saved data" removes it from Google.
  Updates         When a new version is out, an Update button appears in the
                  tab strip (and in Menu and Settings > Updates). One click
                  downloads a small updater that closes the browser, installs
                  the new version and opens it again with your tabs. Windows
                  may ask first: choose More info, then Run anyway.


NEW IN WEBS 3.0 (150 features)
------------------------------
  Address bar     32 new answers: BMI, exact age, loan payments, savings,
                  time between two times, Roman numerals, numbers in words,
                  Base64, URL encoding, SHA hashes, pick one, placeholder text,
                  Unix time, week number, leap years, primes, GCD and LCM,
                  list statistics, running pace, download time, aspect ratios,
                  screen PPI, emoji search, Morse code, binary, character info,
                  upside-down text, text faces, QR code for any text, add a
                  to-do, @ quick pages, synonyms and rhymes
  Search          Ecosia, Qwant, Kagi, Yahoo, Mojeek and Yandex; your own
                  engine (any address with %s); 27 new !bangs like !yt, !gh,
                  !r, !a, !m, !wa and !my
  Tabs            rename, lock, close-in-a-while, move to start or end, close a
                  whole site, back to the last tab (Alt+`), sort, reload or
                  mute everything, save tabs to a file, open a list of links,
                  unread dots, Undo after closing, tab numbers, a tab counter,
                  big, narrow, wide or icon-only tabs
  Looks           a clock, date and battery in the tab strip, corner styles,
                  interface fonts, rainbow loading bar, glowing active tab,
                  color-cycling accent
  Page tools      Menu > More page tools: reading guide, bionic reading,
                  spotlight, speed reader, reading level, highlight words,
                  calm page, all pictures, all links, emails and phones, find
                  and replace, show passwords, picture zoom, save as Markdown,
                  tables to CSV, fonts and colors of a page, accessibility
                  check, layout grid, video picture adjust, frame by frame,
                  key display, laser pointer, Wayback Machine, "is it down?",
                  search this site, translate into 20 languages, and for fun:
                  snow, confetti, disco, flip and gravity.
                  Alt+Shift+R, B, X, E, G, U and Z run the favorites.
  Web pages       reading progress bar, back to top button, hide YouTube
                  Shorts or recommendations (Settings > 3.0 extras)
  Sidebar         More: world clocks, sketchpad, passphrases, JSON, compare
                  text, regex tester, Markdown, colors, breathing, metronome,
                  decision wheel, tally counter, price per unit
  New tab         widgets for progress, today's focus, the moon, world clocks,
                  water and screen time, a bookmark to rediscover; live
                  wallpapers: code rain, warp speed, bubbles, lava lamp,
                  constellations, cherry blossoms
  Games           Tic-tac-toe, Memory, Minesweeper, Breakout, Pong, a typing
                  test, reaction time and an aim trainer (twelve in all)


INSTALL, AND MAKE IT YOUR DEFAULT BROWSER
-----------------------------------------
  powershell -ExecutionPolicy Bypass -File install.ps1

Copies the exe to %LOCALAPPDATA%\Programs\Webs Browser\, registers it with
Windows as a browser (for your account only, no admin needed), and adds
"Webs Browser" to the Start menu - type that in Windows search to open it.
Then it opens Settings on the right page: press "Set default" at the top.
Windows lets no program make itself the default; that one click is yours.
The same button is in the browser under Settings > Default browser.

To undo:  "%LOCALAPPDATA%\Programs\Webs Browser\WebStudiosBrowser.exe" --unregister

Updating: run install.ps1 again after a rebuild. If the browser is open it is
not closed - the running copy is renamed aside and the update takes over the
next time you start it.


VPN
---
The globe button in the toolbar (Alt+V). Two ways to connect:

  Free (Tor)      no account and no sign-up. The first time, the official Tor
                  client (about 22 MB) is downloaded from torproject.org and
                  checked against its published SHA-256 checksum. Traffic goes
                  through three volunteer relays: private, but slower than a
                  paid VPN. Pick one of 21 countries, or the fastest.
  My VPN provider the SOCKS5, HTTP or HTTPS proxy server your VPN service
                  gives you, with your login (Settings > VPN; NordVPN and PIA
                  servers are filled in for you). The password is encrypted
                  with your Windows account (DPAPI) and never shown again.

  Kill switch     if the VPN drops, pages stop loading instead of quietly
                  using your real address (on by default)
  Split tunneling every site except a list, or only the sites on a list; the
                  VPN panel turns it off for the site you are on in one click
  New identity    a fresh Tor route and address
  Leak guard      WebRTC is disabled while the VPN is on, so pages cannot
                  learn your real address through it; DNS goes through the
                  VPN too
  Status          the address and country sites see, time connected, data
  Auto-connect    Settings > VPN > Connect when the browser starts

How it works: every page's traffic goes to a small relay inside the browser
(127.0.0.1), which sends each connection directly, through Tor, or through
your provider, and cuts existing connections whenever the route changes.


WHAT IT IS
----------
A real Windows browser. Pages are rendered by the Microsoft Edge WebView2
engine that is already part of Windows, so sites behave exactly as they do in
Edge or Chrome and security fixes arrive with Windows Update. Everything
around the page - tabs, address bar, menus, find, reader, history, the ad
blocker - was built here from scratch.

Requires: Windows 10 or 11. (WebView2 ships with Windows 11 and current
Windows 10. If it is missing, the browser says so on launch.)


SHIELD - THE AD BLOCKER
-----------------------
  Filter lists    the same lists uBlock Origin uses - EasyList, EasyPrivacy,
                  uBlock filters, quick fixes, privacy, badware, unbreak,
                  Peter Lowe's, the URLhaus malware list and EasyList Cookie
                  (~210,000 rules). Downloaded from their publishers on first
                  run and refreshed every few days. A built-in list works
                  offline from the very first launch.
  Network         ad, tracker and malware requests never leave the machine.
                  A few scripts pages depend on (Google Analytics, ad tags,
                  the IMA video SDK) are swapped for harmless stand-ins so the
                  page keeps working.
  Hiding          empty ad boxes and "sponsored" blocks are hidden, including
                  uBlock's :has-text(), :upward(), :style() and :remove().
  Scriptlets      the uBlock scriptlets the lists rely on (set, aopr, acs,
                  nowoif, json-prune, json-prune-fetch-response, trusted-
                  replace-xhr-response...) - this is what beats anti-adblock
                  walls and strips ads out of YouTube's player. Anything that
                  still plays on YouTube is muted and skipped.
  Popups          windows a page opens on its own, and known ad popups even
                  when you clicked. The toast offers "Open" if you wanted it.
  Whole sites     links to ad servers or malware hosts show a warning page
                  instead ("Continue anyway" / "Always allow").
  Cookie pop-ups  "Reject all" is clicked for you where a banner offers it.
  Clean links     utm_, fbclid, gclid and friends are stripped before a page
                  loads.
  Privacy signal  Global Privacy Control is sent with every request.
  Per site        the shield button shows what was blocked on the page and
                  turns Shield off for that site.
  Block element   right-click > "Block element..." or the shield panel, then
                  click whatever is left. It is saved to My filters.
  Your rules      Settings > My filters takes uBlock / EasyList syntax.

  Score on adblock-tester.com: 100 / 100.


PRIVACY
-------
  Secure DNS      encrypted lookups through Cloudflare, Quad9, AdGuard,
                  Mullvad or Google (Settings > Privacy)
  Fingerprinting  hides canvas, graphics card, CPU, memory and battery details
  Site info       click the lock: certificate, cookies, permissions, and
                  per-site switches for Shield, JavaScript, mobile version,
                  dark mode and the VPN; clear or forget one site
  Also            block notification requests, clear cookies on exit,
                  auto-delete old history, stop autoplay, copy clean links


VIDEO
-----
  Alt+P pop out any video, Alt+K play/pause, Alt+J / Alt+L 10 s back/forward,
  Alt+S skip intro (+85 s), Alt+, / Alt+. speed (0.25x to 4x). The video button
  in the toolbar controls every tab that is playing (loop, fill the window,
  save a frame, mute). Long videos you did not finish appear under "Continue
  watching" on the new tab page, and offer to resume where you stopped.
  SponsorBlock skips sponsor reads on YouTube (only a short hash of the video
  id is sent).


WHAT ELSE IT DOES
-----------------
  Tabs            drag to reorder, middle-click to close, audio indicator and
                  mute, Ctrl+Shift+T to reopen, new tabs from a page open
                  beside it. Right-click a tab: pin, color, auto-refresh,
                  sleep now, move to a new window, close duplicates, sort by
                  site, bookmark all. Hover cards, wheel over the strip to
                  switch, Ctrl+Shift+PgUp/PgDn to move.
  Sessions        save a set of tabs and reopen it later; recently closed list
  Sidebar         Ctrl+Shift+E: notes (also per site), reading list, and any
                  site as a web panel (ChatGPT, WhatsApp...)
  Address bar     calculator (2^10/3), unit converter (5 miles to km),
                  suggestions, keywords (yt cats, w, gh, your own), paste and
                  go, copy as Markdown
  Page tools      area screenshot (Ctrl+Shift+S), translate, read aloud, view
                  source, strong password, Google Lens, always on top, open in
                  another browser
  Look            accent colors, compact toolbar, dark mode for every site,
                  new tab clock, shortcuts and background picture
  Extensions      Chrome Web Store extensions (Settings > Extensions)
  Backup          everything in one file; bookmarks as standard HTML
  Task manager    memory and CPU per tab; end the ones that hang
  Sleeping tabs   tabs you have not looked at for 30 minutes stop running
                  until you come back (Settings > Performance)
  Session         reopens your tabs; only the active one loads straight away
  Address bar     searches history, bookmarks and open tabs as you type; a
                  bare domain opens, anything else searches. !g !d !b !w !s
                  pick an engine for one search. Alt+Enter opens in a new tab.
  HTTPS first     http:// addresses are upgraded, with a fallback for sites
                  that have no HTTPS
  Split view      two tabs side by side; the toolbar follows the side you click
  Reader view     the article alone, three themes, adjustable type
  Find on page    Ctrl+F, "3 of 17", match case
  Private window  its own in-memory profile - nothing is written to disk.
                  Keeps your bookmarks and settings, saves no history.
  Downloads       own manager with pause, resume and cancel
  Library         history, bookmarks and downloads on one searchable page
  Save            full-page screenshot, save as PDF, save page as
  Import          bookmarks from Chrome, Edge or Brave (Settings > Import)
  Themes          dark and light; sites with a dark mode follow along
  One instance    opening the exe again (or a link from another program)
                  goes to the window that is already open
  Remembers       window size and position


KEYBOARD
--------
  Ctrl+T / Ctrl+W          new tab / close tab
  Ctrl+Shift+T             reopen the tab you just closed
  Ctrl+N / Ctrl+Shift+N    new window / new private window
  Ctrl+L, Alt+D, F6        focus the address bar
  Ctrl+Shift+A             search open tabs
  Ctrl+F / Ctrl+G          find on page / next match
  Ctrl+Tab, Ctrl+PgDn      next tab (Shift, or PgUp, for previous)
  Ctrl+1..8 / Ctrl+9       nth tab / last tab
  Ctrl+D                   bookmark this page
  Ctrl+Shift+B             bookmarks bar on and off
  Ctrl+H / Ctrl+J          history / downloads
  Ctrl+P                   print
  Ctrl + + / - / 0         zoom in, out, reset (numpad too)
  Alt+Left / Right / Home  back / forward / home
  F5, Ctrl+Shift+R         reload / reload without cache
  F11                      full screen on and off
  F12, Ctrl+Shift+I        developer tools
  Ctrl+Shift+E             sidebar
  Ctrl+Shift+S             screenshot an area
  Ctrl+Shift+PgUp / PgDn   move the tab left / right
  Alt+V                    VPN panel
  Alt+P / K / J / L / S    video: pop out / play-pause / -10 s / +10 s / skip intro
  Alt+, / Alt+.            video slower / faster
  Ctrl+/                   every shortcut
  Esc                     close the open panel, leave full screen, or stop
                           loading - and web pages still receive it


WHERE YOUR DATA LIVES
---------------------
  %LOCALAPPDATA%\WebStudiosBrowser\

  profile\   cookies, cache, site storage, saved passwords (WebView2's own)
  shield\    downloaded filter lists, and a copy of the Shield settings so
             blocking starts before the window has finished opening
  ui\        the browser's interface, unpacked from the exe on each update
             (ui\user\ holds your new tab background)
  bin\       WebView2Loader.dll, likewise
  tor\       the Tor client, once you have used the free VPN
  extensions\  extensions you added
  vpn.json   VPN settings; vpn.key the encrypted provider password

History, bookmarks, settings, the download list and your session are kept in
that profile as ordinary browser storage for the address "browser.example",
which is a reserved name that can never belong to a real site. What the
browser fetches by itself: filter lists; Tor, when you first use the free VPN;
search suggestions as you type (off in private windows, and can be turned off);
SponsorBlock segments for YouTube videos. Delete the folder and the browser is
factory-fresh.


BUILDING IT
-----------
  powershell -ExecutionPolicy Bypass -File build.ps1

That is the whole toolchain. It uses csc.exe from the .NET Framework that
Windows already has - no Node, no MSBuild, no SDK to install. The script
draws the icon, then compiles src\*.cs with every UI page, the page scripts,
the built-in filter list and the WebView2 assemblies embedded as resources.

  src\Program.cs         the shell: windows, tabs, events, downloads, keys
  src\Shield.cs          the content blocker: list parser, matching engine,
                         stand-in scripts, link cleaning, list updates
  src\Features.cs        video, site info, screenshots, source, extensions,
                         task manager, sidebar, file dialogs, suggestions
  src\Vpn.cs             the VPN relay, provider and DNS-over-HTTPS client
  src\Tor.cs             downloads, verifies and runs the Tor client
  src\Install.cs         registration with Windows as a browser
  src\Test.cs            the scripted test runner (below)
  ui\chrome.html         the entire browser interface
  ui\shield.js           runs inside web pages: hiding, scriptlets, YouTube,
                         cookie banners, video controls, dark mode,
                         fingerprint protection, SponsorBlock
  ui\picker.js           "Block element"
  ui\regionshot.js       "Screenshot an area"
  ui\shield-builtin.txt  the built-in filter list; edit and rebuild
  ui\newtab.html  history.html  settings.html  reader.html  blocked.html
  ui\side.html  taskmgr.html  source.html  crashed.html  whatsnew.html

Testing: run it with --data=<scratch folder> --test=<script> and it drives
itself through the script, writing results to <script>.log and screenshots
next to it. The --data folder keeps tests away from your real profile.
backup-before-fixes\ holds the previous version, source and exe.


THE ONE DESIGN DECISION WORTH KNOWING
-------------------------------------
The browser's interface is a web page running in its own WebView2 docked at
the top of the window, and it owns all the data. The C# shell owns windows,
events and the blocker, and stores no user data. Menus and dropdowns work by
asking the shell to grow that top pane to an exact pixel height - and to clip
it to the toolbar plus the open menu, so the page stays visible and clickable
around it.

Two catches follow from it. Nothing inside chrome.html may be sized in % or
vh: that page's viewport is the collapsed toolbar, so 100% is about 86px. And
every size it reports is in device pixels, measured with its own
devicePixelRatio - the Windows DPI the shell sees can disagree after a display
scaling change, which is what used to cut the toolbar and dropdowns short at
125%.
