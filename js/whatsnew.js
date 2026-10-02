/* Webs Browser for iPhone - what's new in 2.1 and 2.0, listed in the app
   (Menu → What's new) and offered once after each update. */
"use strict";

const WHATS_NEW = [
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
