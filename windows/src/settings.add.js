/* ---------------------------------------------------------------- Webs 3.0 settings */
(function () {
"use strict";
["xUnread", "xPageKeys", "liveCounts", "xExplain", "xAiBar", "xShop", "xVoiceTalk"].forEach(k => { if (cfg[k] === undefined) cfg[k] = true; });
bindSwitch("liveCounts", () => cfg, "liveCounts");      // Webs 3.7: js/live.js checks in only with this on
["xClock", "xClockDate", "xBattery", "xTabCount", "xTabNums", "xUnread", "xUndo", "xHoverX", "xBigTabs", "xIconTabs", "xRainbow", "xGlow", "xCycle",
 "xProgress", "xTotop", "xZoomAll", "xYtShorts", "xYtRecs", "xPageKeys", "xExplain", "xAiBar", "xShop", "xVoice", "xVoiceTalk", "xVoiceOffline"].forEach(k => bindSwitch(k, () => cfg, k));
["xTabW", "xCorners", "xFont", "xClean"].forEach(k => { const n = $("#" + k); n.value = cfg[k] || ""; n.onchange = () => { cfg[k] = n.value; commit(); }; });
const nm = $("#xCustomName"), url = $("#xCustomUrl");
nm.value = cfg.xCustomName || ""; url.value = cfg.xCustomUrl || "";
nm.onchange = () => { cfg.xCustomName = nm.value.trim().slice(0, 40); commit(); };
url.onchange = () => {
  const v = url.value.trim();
  if (v && !/^https?:\/\/[^\s]+%s/i.test(v)) { flash("The address needs to start with https:// and have %s where the search words go"); url.focus(); return; }
  cfg.xCustomUrl = v; if (!v && cfg.search === "custom") { cfg.search = "ddg"; $("#searchEngine").value = "ddg"; }
  commit();
};
$("#searchEngine").addEventListener("change", () => { if ($("#searchEngine").value === "custom" && !/%s/.test(cfg.xCustomUrl || "")) { flash("Add your engine's address under Webs 3.0 extras first"); location.hash = "x3"; } });
$("#xBangs").innerHTML = [["!yt", "YouTube"], ["!gh", "GitHub"], ["!r", "Reddit"], ["!a", "Amazon"], ["!so", "Stack Overflow"], ["!m", "Maps"], ["!i", "Images"], ["!n", "News"],
  ["!wa", "Wolfram Alpha"], ["!mdn", "MDN"], ["!npm", "npm"], ["!imdb", "IMDb"], ["!x", "X"], ["!sp", "Spotify"], ["!tt", "TikTok"], ["!pin", "Pinterest"], ["!eb", "eBay"],
  ["!wb", "Wayback Machine"], ["!sch", "Google Scholar"], ["!tr", "Translate"], ["!eco", "Ecosia"], ["!q", "Qwant"], ["!k", "Kagi"], ["!y", "Yahoo"], ["!mj", "Mojeek"], ["!ya", "Yandex"], ["!my", "your engine"]]
  .map(([b, n]) => "<code>" + b + "</code> " + n).join(", ") + ".";
})();
