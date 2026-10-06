/* Webs Browser for iPhone 2.11 - ad and tracker blocker for the app.
   What it does, honestly: the app's service worker (sw.js) drops requests to known ad, analytics and tracker
   domains made by Webs's own pages (favicons, link previews, cards), the app refuses to open a page whose address
   is a pure ad or tracker domain, and tracking bits in links (utm_, fbclid, gclid…) are already stripped before you
   go (js/app.js, tidy). What it does NOT do: websites you open load in Safari, and Webs can't reach inside another
   site to remove ads there - that needs the Windows version or Safari's own content blockers. Nothing is sent anywhere.
   Settings → Privacy, and Menu → Privacy, show how many it has blocked. */
"use strict";
(function () {
// a compact list of well-known ad, analytics and tracker domains (not a full filter list; the honest scope above)
const BLOCK = ["doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com", "googletagmanager.com", "googletagservices.com", "adservice.google.com",
  "2mdn.net", "scorecardresearch.com", "quantserve.com", "quantcount.com", "moatads.com", "adnxs.com", "adsrvr.org", "rubiconproject.com", "pubmatic.com", "criteo.com", "criteo.net",
  "taboola.com", "outbrain.com", "amazon-adsystem.com", "hotjar.com", "mixpanel.com", "segment.com", "segment.io", "branch.io", "appsflyer.com", "adjust.com", "kochava.com",
  "doubleverify.com", "serving-sys.com", "casalemedia.com", "openx.net", "smartadserver.com", "yieldmo.com", "teads.tv", "mgid.com", "zedo.com", "adform.net", "bidswitch.net",
  "33across.com", "sharethrough.com", "gumgum.com", "media.net", "revcontent.com", "chartbeat.com", "parse.ly", "mc.yandex.ru", "matomo.cloud", "onesignal.com", "crwdcntrl.net",
  "demdex.net", "everesttech.net", "bluekai.com", "agkn.com", "rlcdn.com", "adsymptotic.com", "tapad.com", "bounceexchange.com", "clarity.ms", "fullstory.com", "mouseflow.com"];
const set = new Set(BLOCK);
const on = () => cfg.adblock !== false;
function blocked(host) {
  host = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (set.has(host)) return true;
  for (let i = host.indexOf("."); i >= 0; i = host.indexOf(".", i + 1)) if (set.has(host.slice(i + 1))) return true;
  return false;
}
const count = () => +load("adBlocked", 0) || 0;
function bump(n) { if (!(n > 0)) return; save("adBlocked", count() + n); paintBadge(); }

// tell the service worker whether to block, and the list to use (it also has a built-in copy)
function tellSW() {
  try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "adblock", on: on(), list: BLOCK }); } catch (e) {}
}
// the service worker reports what it dropped
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "adblocked" && e.data.n > 0) bump(e.data.n); });
addEventListener("load", () => setTimeout(tellSW, 300));
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("controllerchange", () => setTimeout(tellSW, 200));

// don't open a page that is itself a pure ad/tracker domain (a redirect or a mistyped link)
const go0 = window.go;
window.go = function (input, opts) {
  if (on() && typeof input !== "string" && input && input.u && blocked(hostOf(input.u))) { bump(1); toast("🛡️ Blocked an ad/tracker link"); return; }
  if (on() && typeof input === "string") {
    const u = (typeof resolve === "function") ? resolve(input) : input;
    if (u && /^https?:/i.test(u) && blocked(hostOf(u)) && !(typeof searchOf === "function" && searchOf(u))) { bump(1); toast("🛡️ Blocked an ad/tracker link"); return; }
  }
  return go0.apply(this, arguments);
};
// don't even load a favicon from a blocked host
const iconURL0 = window.iconURL;
if (typeof iconURL0 === "function") window.iconURL = function (u) { return on() && blocked(hostOf(u)) ? "" : iconURL0.apply(this, arguments); };

function paintBadge() { const el = $("#pvAdCount"); if (el) el.textContent = count().toLocaleString(); }

/* settings: Privacy & search group (prepended), and a line in Menu → Privacy */
const settingsHTML0 = settingsHTML;
settingsHTML = function () {
  return GROUP("Privacy", SW("adblock", "Ad and tracker blocker", "Blocks ads and trackers in Webs's own pages; " + count().toLocaleString() + " blocked so far", on()),
    "On iPhone this covers Webs itself; sites you open load in Safari.") + settingsHTML0();
};
SETACTIONS["sw:adblock"] = v => { tellSW(); if (!v) toast("Ad and tracker blocker off"); };

// a line in Menu → Privacy (ACTIONS.privacy opens that sheet)
if (ACTIONS.privacy) { const privacy0 = ACTIONS.privacy; ACTIONS.privacy = async function () {
  await privacy0.apply(this, arguments);
  const card = $("#sheetBody .card");
  if (card) card.insertAdjacentHTML("beforeend", '<button type="button" class="mrow" id="pvAd"><span class="aie">🛡️</span><span>Ads &amp; trackers blocked</span><em><b id="pvAdCount">' + count().toLocaleString() + "</b> in Webs' own pages · tap for settings</em></button>");
  const b = $("#pvAd"); if (b) b.onclick = () => { closeSheet(); openSettings(); };
}; }

window.Adblock = { blocked, count, on, bump, list: () => BLOCK.slice(), tellSW };
})();
