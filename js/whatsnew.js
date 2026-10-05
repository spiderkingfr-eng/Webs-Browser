/* Webs Browser for iPhone - what's new in 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1 and 2.0, listed in the app
   (Menu → What's new) and offered once after each update. */
"use strict";

const WHATS_NEW = [
  ["New in 2.9: your phone and your PC", "phone", [
    "Link Webs on this phone with Webs on your PC: type a 6-digit code (Menu → Phone and PC)",
    "A remote for the PC: play and pause, change tabs, scroll, zoom, or open a site on it",
    "A shared clipboard: send what you copied to the PC, and copy what it sends",
    "Pick up where you left off: what the PC has open, on a card on the start page",
    "Send your tabs to the PC, or share them in a link anyone can open",
    "Play a friend: chess, Connect Four and tic-tac-toe with someone on another phone or PC, with a join code (Games → Play a friend)"
  ]],
  ["New in 2.9: games and levels", "game", [
    "Sudoku, Solitaire, Chess against the phone, and Blocks (Games)",
    "XP and levels: games, daily visits and achievements earn XP and unlock frames for your card"
  ]],
  ["New in 2.9: anime extras", "sparkle", [
    "Event themes for Halloween, winter, New Year and Valentine's, when the people who make Webs turn them on",
    "Vote on the next theme, find the hidden spider in each wallpaper, and a sparkle trail when you touch the start page",
    "Themes by the clock, a screensaver after a while, and Mochi, a small companion",
    "A video or a GIF as your background"
  ]],
  ["New in 2.9: more from Web AI", "sparkle", [
    "Answers in the address bar as you type a question",
    "Study cards and a quiz from a page, compare pages, tidy your tabs and find a page you saw (Menu → More from Web AI)",
    "Your instructions: tell Web AI once how you like answers"
  ]],
  ["New in 2.9: getting things done", "check", [
    "Your morning sites on a card each morning, and reminders when you're back on a site",
    "A bookmark checkup, a weekly reading digest and voice commands (Menu → Get things done)",
    "Offline articles: save a page to read with no internet, and keep your reading list offline (Menu → Offline articles)",
    "Side by side on an iPad: two pages at once, with a divider to drag (Menu → Side by side)"
  ]],
  ["New in 2.9: privacy", "lock", [
    "Face ID (or Touch ID) for your passcode (Settings → Passcode lock)",
    "What sites see about you: your internet address, roughly where you are, your device and its fingerprint (Menu → Privacy)",
    "Is this shop real? A shop whose address looks like a trick is checked as it opens, with how old the website is"
  ]],
  ["New in 2.9: sharing", "gift", [
    "Invite a friend: your own link, and an achievement for both of you when they join",
    "A wallpaper gallery of backgrounds people shared, and sharing your own (Menu → Wallpaper gallery)"
  ]],
  ["New in 2.8: anime themes", "sparkle", [
    "Nine whole looks inspired by Bleach, Tokyo Ghoul, Demon Slayer, Jujutsu Kaisen, Naruto, Attack on Titan, One Piece, Death Note and Persona 5 (Settings → Appearance → Anime themes)",
    "All of Webs takes the theme's colors and accent",
    "A live wallpaper behind the start page: black butterflies under a crescent moon, red tendrils in the rain, falling wisteria, a sea voyage and more",
    "A card in each theme's style with the time and date (Customize start page → Anime theme card)",
    "Fan-made looks drawn by Webs, not official. No anime theme brings back the look you had",
    "2.8.1: everything moves, on a loop: the wallpaper, the card (butterflies, rain, petals, leaves, a little ship, feathers) and the picker's tiles, even with Reduce Motion on (just gentler; Animations: Off stops them)"
  ]],
  ["New in 2.7: From Webs", "sparkle", [
    "News, polls, today's trivia, a countdown, the pick of the week and a mystery box from the people who make Webs, right under the search box (Customize start page → From Webs turns it off)",
    "Phantom Thieves calling cards, and theme days with snow, hearts, leaves or fireworks",
    "The wallpaper of the week, if you want it, and the owner's quote of the day",
    "Secret words for the address bar, a secret code hunt, and limited-time achievements",
    "A weekly leaderboard for Snake and 2048 with a nickname you pick, community goals, and sometimes the owner's daily word",
    "Help & support: common questions, problem reports with their answers, and rating the help",
    "Sticker packs for the Phantom calendar",
    "New versions can reach some iPhones first, so a problem is caught before it reaches everyone",
    "Anonymous counts (the version, and the country from your internet address, never what you browse) about once an hour. Settings → Privacy and security → Send anonymous counts turns them off"
  ]],
  ["New in 2.6: Help & support", "lifebuoy", [
    "Help & support: stuck? Write to the people who make Webs and the answer comes back in the app, with a notification if those are on (Menu → Help & support)",
    "Let support adjust your settings: turn on the switch and support can change a few looks, browsing and start page settings for you, for 30 minutes at most",
    "Every change shows with Undo and is written in the chat, and a banner shows while support is connected. Tap End any time",
    "Support only sees what you write and the settings on the list. Never your history, bookmarks, tabs, notes, passwords or the pages you visit"
  ]],
  ["New in 2.5: the Phantom calendar", "sparkle", [
    "The Phantom calendar: a start page card in the style of a Persona 5 phone theme, with five days in a V over a city at sunset and today stabbed by a dagger (Settings → Customize start page)",
    "Set a deadline and the Q poll asks if you'll be ready, with the days left; without one it shows how much of today is left",
    "Add up to four of your own pictures (✎ → Your pictures). They stand on the card as stickers, a different one each day, and stay on this iPhone",
    "The time of day and the weather, the way the game's calendar shows them"
  ]],
  ["New in 2.4: notifications", "bell", [
    "Notifications from Webs, even when it's closed: new versions and news (Settings → Notifications)",
    "A daily word reminder at the time you pick", "Tap a notification to go straight to the update, the news or the puzzle",
    "Send yourself a test notification to see how they look", "Works when Webs is on your Home Screen, with iOS 16.4 or newer"
  ]],
  ["New in 2.3: talk with Web AI", "sparkle", [
    "Voice call with Web AI: tap 📞, ask out loud, and it answers out loud, then listens for your next question until you hang up",
    "🔊 under any answer reads it out loud", "If the phone can't listen, use the 🎤 on the keyboard: the answers are still spoken"
  ]],
  ["New in 2.2: Web AI", "sparkle", [
    "Web AI: an assistant that answers questions about the page you're on, or anything else (Menu → Web AI)", "One tap for a summary, the key points or a simple explanation of a page",
    "Answers appear word by word, with lists, tables and code you can copy", "Choose whether Web AI looks at the page you have open; private tabs never send theirs",
    "Runs on Claude, made by Anthropic, through the same Web AI as the Windows browser"
  ]],
  ["New in 2.1: updates", "ul", [
    "An Update button appears when a new version is ready; one tap installs it", "See what's new in an update before you install it",
    "Settings → Check for updates shows your version and looks for a new one", "Looks for updates when you open Webs and when you come back to it"
  ]],
  ["Looks and animations", "sparkle", [
    "An animated launch splash", "The start page glides in, section by section", "Ripples and springy presses on every tap", "Shortcuts tilt in 3D under your finger",
    "Sheets spring open over a blurred background", "Sheet contents cascade in", "The address bar zooms open and its results cascade in", "Tab cards fly in when you open your tabs",
    "Swiped-away tabs spin off the screen", "Toasts with a countdown bar", "A glowing, shimmering loading bar", "An animated glow around the search box",
    "A clock whose digits roll as they change", "Animated weather icons: the sun turns, clouds drift, rain falls", "Shimmering placeholders while things load",
    "Springy switches and segmented controls that slide to your choice", "A circular reveal when you change the theme", "Pull down on the start page to refresh it",
    "Confetti when you finish all your to-dos", "Your background picture moves gently as you scroll (parallax)",
    "8 live wallpapers: Gradient, Stars, Aurora, Rain, Snow, Embers, Fireflies and Waves", "Frosted-glass cards over pictures and wallpapers",
    "The toolbar's shadow appears as you scroll", "Floating icons on empty screens", "The reload button spins while a page loads",
    "Shortcuts lift when you press and hold them", "Swipe rows to the left to delete them", "The tab counter hops when it changes",
    "An offline banner (and a welcome back)", "A little shake when something isn't right"
  ]],
  ["Start page", "home", [
    "Clock styles: Classic, Big, Flip and Analog", "Today's focus: one main goal for the day", "Your daily streak", "Continue where you left off: your last tab, note and the word puzzle",
    "A countdown to your big day, with a progress ring", "A quote of the day", "A habit tracker with streaks", "A quick note right on the start page",
    "A month calendar", "World clocks for the cities you choose", "How far through the day, week, month and year you are", "Sunrise, sunset and hours of daylight",
    "Tonight's moon phase", "On this day, from Wikipedia", "Wikipedia's picture of the day as your background", "Greetings on holidays",
    "A birthday surprise", "Swipe through tips, plus 10 new ones", "Drag to reorder your shortcuts", "Emoji icons for shortcuts",
    "Tap the engine badge to switch search engines", "Search by voice", "Rearrange the whole start page", "Choose your seasonal effect, now with hearts and stars",
    "Save the quick note to Notes in one tap"
  ]],
  ["Address bar", "glass", [
    "Voice input", "Sites you visit complete as you type", "Add your own search engines", "Edit your keyword shortcuts", "43 new bangs: !yt, !gh, !r, !a, !wa, !so, !spot and more",
    "A list of every bang", "Your recent searches", "Calculator history", "BMI: “bmi 5'10 160lb”", "Age: “age 2004-05-14”",
    "Loan payments: “loan 25000 at 6% for 5 years”", "Compound interest: “1000 at 5% for 10 years”", "Word and character counts: “count …”",
    "Change case: upper, lower, title, sentence, snake, camel, kebab", "Base64 and URL encoding and decoding", "Roman numerals, both ways", "Unix timestamps",
    "SHA hashes", "Lorem ipsum", "An emoji finder: “emoji fire”", "Wikipedia summaries: “wiki octopus”", "Translation: “translate hello to spanish”",
    "Your IP address", "A 7-day forecast: “weekly weather paris”", "Save notes and to-dos straight away: “note: …”, “todo: …”", "Percent change: “from 80 to 100 %”",
    "Let Webs pick: “pick pizza, tacos or sushi”", "Days between two dates", "Numbers in words: “1234 in words”", "QR codes: “qr hello”"
  ]],
  ["Tabs and browsing", "tabs", [
    "Search your tabs", "Grid or list view for tabs", "Pin tabs so Close all keeps them", "Duplicate a tab", "Undo closing a tab", "Reopen closed tabs (and ⌘⇧T)",
    "Close other tabs", "Sort tabs by website", "Save your tabs as a group and open them later", "“5 min ago” on tab cards", "Tab cards tinted in each site's color",
    "Swipe the address bar to switch tabs", "Press and hold the tabs button for a quick menu", "Press and hold a tab for more", "Page info",
    "A rule for each site: inside Webs or in Safari", "A QR code for any page", "Full-screen pages", "Reader view for Wikipedia, with text size and sepia",
    "Keyboard shortcuts on iPad, and a list of them (press ?)"
  ]],
  ["Library and notes", "star", [
    "Bookmark folders", "Edit bookmarks and move them between folders", "Import bookmarks from Chrome, Safari, Edge or Firefox", "Export your bookmarks",
    "History by site", "Forget a site", "Reading list: unread and all, and mark as unread", "Undo for deleted bookmarks, to-dos, notes, habits and reading list items",
    "Checklist notes", "Pin and color your notes", "Search your notes", "Word counts in notes, and save one as a text file",
    "Tap a to-do to edit it", "Star important to-dos", "Press and hold a to-do to drag it", "Search everything in Webs (⌘K)",
    "Insights: your week in browsing, top sites and busiest hours", "22 achievements to unlock", "Copy history"
  ]],
  ["Tools", "tools", [
    "A Tools menu", "A calculator with history, √, ^ and π", "A unit converter for 8 kinds of units", "A QR code maker for text, links and Wi-Fi",
    "A password and passphrase maker with a strength meter", "A stopwatch with laps that keeps running", "A focus timer (Pomodoro)", "A color picker with palettes",
    "Text tools: count, change case, sort, clean up", "A breathing exercise", "A decision wheel", "A bill splitter with tips"
  ]],
  ["Games", "game", ["Tic-tac-toe against the phone", "Memory match", "Minesweeper", "A new games menu with your best scores"]],
  ["Settings and privacy", "gear", [
    "A passcode lock for Webs", "History that deletes itself after a day, a week or a month", "A storage manager", "Timer alerts: a notification, and the screen stays on",
    "The reading list count on the app icon", "7 color themes: Midnight, Forest, Ocean, Rose, Mono, Coffee and AMOLED black", "Any accent color you like",
    "Text size and font choice: System, Rounded, Serif or Mono", "A compact layout", "Choose the toolbar's middle button"
  ]]
];
function openWhatsNew() {
  let n = 0;
  const total = WHATS_NEW.reduce((a, g) => a + g[2].length, 0);
  openSheet("What's new", '<div class="wnhead"><svg class="mark"><use href="#logo"/></svg><b>Webs ' + VERSION.replace(/\.0$/, "") + "</b><span>" + total + " new things in 2.0 and 2.1</span></div>" +
    WHATS_NEW.map(([title, icon, list]) => '<div class="group"><h3>' + ico(icon) + esc(title) + " · " + list.length + '</h3><div class="card wnlist">' +
      list.map(x => '<div class="wn"><b>' + (++n) + "</b><span>" + esc(x) + "</span></div>").join("") + "</div></div>").join(""), { kind:"whatsnew", full:true });
  if (typeof confetti === "function") setTimeout(() => confetti($(".wnhead")), 250);
}
ACTIONS.whatsnew = openWhatsNew;
SETACTIONS.whatsnew = openWhatsNew;
document.addEventListener("DOMContentLoaded", () => {
  const seen = load("seenVer", "");
  if (seen === VERSION) return;
  const before = !!seen || localStorage.getItem("wsb.mtabs") !== null;   // used Webs before this version
  if (!before && !isStandalone() && isIOS) return;   // a first visit in Safari: the install steps come first
  save("seenVer", VERSION);
  const short = VERSION.replace(/\.0$/, "");
  // after an update (the version it had is remembered) it says so; a first start says hello
  const msg = !before ? "Welcome to Webs! See what it can do" : seen ? "\u{1F389} Updated to Webs " + short + "!" : "Webs " + short + " is here, with lots of new things";
  setTimeout(() => toast(msg, { label:before ? "What's new" : "See", fn:openWhatsNew }), 1400);
});
