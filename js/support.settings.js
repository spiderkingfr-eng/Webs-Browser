/* Webs Browser - the settings support may change, and nothing else (Help & support).
   Only while the person has contacted support AND turned on "Let support adjust my settings" (30
   minutes at most). Each entry is a switch or a choice from a fixed list: nothing that is typed
   in (no addresses, no custom search engine, no VPN server), nothing that deletes anything, and
   nothing that shows what someone has done (history, bookmarks, passwords, pages).
   The apps check every change against this list before applying it; the Web AI server
   (server/web-ai/worker.js, SUPPORT_SETTINGS) keeps the same list for the dashboard and checks it
   too (test-support.mjs makes sure the two never differ).
   Entry: { k, label, t:"bool"|"choice"|"action", s: where it's kept, o: [[value, label]], num }
   PC stores: s "settings" (wsb.settings), "shield" (wsb.shield), "vpn" (wsb.vpn).
   iPhone: cfg keys, and "show:<part>" for the start page's parts. */
(function () {
"use strict";
const B = (k, label, s) => ({ k, label, t:"bool", s:s || "settings" });
const C = (k, label, o, s, num) => ({ k, label, t:"choice", o, s:s || "settings", ...(num ? { num:true } : {}) });
const SUPPORT_SETTINGS = {
  windows:[
    ["Look", [
      C("theme", "Theme", [["dark", "Dark"], ["light", "Light"], ["auto", "Light by day, dark after sunset"]]),
      C("motion", "Animations", [["", "Full"], ["reduced", "Reduced"], ["off", "Off"]]),
      B("compact", "Compact toolbar"),
      C("defzoom", "Default zoom", [["0.8", "80%"], ["0.9", "90%"], ["1", "100%"], ["1.1", "110%"], ["1.25", "125%"], ["1.5", "150%"]], "settings", true),
      B("dark", "Dark mode for every site")
    ]],
    ["Browsing", [
      C("search", "Search engine", [["ddg", "DuckDuckGo"], ["google", "Google"], ["bing", "Bing"], ["brave", "Brave"], ["start", "Startpage"], ["wiki", "Wikipedia"],
        ["ecosia", "Ecosia"], ["qwant", "Qwant"], ["kagi", "Kagi"], ["yahoo", "Yahoo"], ["mojeek", "Mojeek"], ["yandex", "Yandex"]]),
      B("suggest", "Search suggestions"),
      B("https", "Always try HTTPS first"),
      C("sleep", "Sleeping tabs", [["0", "Never"], ["5", "After 5 minutes"], ["15", "After 15 minutes"], ["30", "After 30 minutes"], ["60", "After 1 hour"], ["120", "After 2 hours"]], "settings", true),
      B("restore", "Reopen my tabs when Webs starts"),
      B("askdl", "Ask where to save each download")
    ]],
    ["Privacy", [
      C("tracking", "Tracking prevention", [["off", "Off"], ["basic", "Basic"], ["balanced", "Balanced"], ["strict", "Strict"]]),
      B("fp", "Fingerprint protection"),
      B("clearexit", "Clear cookies and site data when Webs closes")
    ]],
    ["Shield (the ad blocker)", [
      B("on", "Shield", "shield"),
      B("popups", "Block pop-ups", "shield"),
      B("yt", "Skip YouTube ads", "shield"),
      B("cosmetic", "Hide empty ad spaces", "shield"),
      B("clean", "Remove tracking from links", "shield"),
      B("gpc", "Ask sites not to sell my data (GPC)", "shield")
    ]],
    ["VPN", [
      B("kill", "Kill switch (block the internet if the VPN drops)", "vpn"),
      { k:"vpnOff", label:"Disconnect the VPN", t:"action", s:"vpn" }
    ]]
  ],
  iphone:[
    ["Look", [
      C("theme", "Theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]),
      C("textSize", "Text size", [["", "Default"], ["l", "Large"], ["xl", "Larger"]]),
      C("font", "Font", [["", "System"], ["rounded", "Rounded"], ["serif", "Serif"], ["mono", "Mono"]]),
      B("compact", "Compact layout"),
      C("barPos", "Address bar", [["bottom", "Bottom"], ["top", "Top"]]),
      C("motion", "Animations", [["", "On"], ["off", "Off"]])
    ]],
    ["Browsing", [
      C("search", "Search engine", [["ddg", "DuckDuckGo"], ["google", "Google"], ["bing", "Bing"], ["brave", "Brave"], ["start", "Startpage"], ["wiki", "Wikipedia"], ["ecosia", "Ecosia"]]),
      B("suggest", "Search suggestions"),
      C("openMode", "Opening websites", [["smart", "Smart"], ["inside", "Inside Webs when possible"], ["outside", "Always in Safari"]]),
      B("https", "HTTPS first"),
      B("clean", "Clean links"),
      B("saveHistory", "Save history")
    ]],
    ["Start page", [
      B("show:clock", "Clock"), B("show:greet", "Greeting and date"), B("show:weather", "Weather"), B("show:focus", "Today's focus"),
      B("show:shortcuts", "Shortcuts"), B("show:todo", "To-do list"), B("show:quote", "Quote of the day"), B("show:cd", "Countdown"),
      B("show:cal", "Calendar"), B("show:wclock", "World clocks"), B("show:otd", "On this day"), B("show:tip", "Tip of the day"),
      B("show:fx", "Seasonal effects"), B("show:p5", "Phantom calendar"),
      B("clock24", "24-hour clock"),
      C("clockStyle", "Clock style", [["", "Classic"], ["big", "Big"], ["flip", "Flip"], ["analog", "Analog"]])
    ]]
  ]
};
// is this value allowed for this setting? Returns the value to store, or undefined.
function supportValue(platform, k, v) {
  for (const [, list] of SUPPORT_SETTINGS[platform] || []) for (const e of list) {
    if (e.k !== k) continue;
    if (e.t === "bool") return v === true || v === false ? v : undefined;
    if (e.t === "action") return v === true ? true : undefined;
    const hit = e.o.find(x => x[0] === String(v));
    return hit ? (e.num ? +hit[0] : hit[0]) : undefined;
  }
  return undefined;
}
const entry = (platform, k) => { for (const [, list] of SUPPORT_SETTINGS[platform] || []) for (const e of list) if (e.k === k) return e; return null; };
const api = { SUPPORT_SETTINGS, supportValue, entry };
if (typeof window !== "undefined") window.SupportSettings = api;
if (typeof module !== "undefined") module.exports = api;
})();
