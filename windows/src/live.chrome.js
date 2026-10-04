/* ---------------------------------------------------------------- Webs 3.7: "From Webs" in the browser window (js/live.js)
   Checks in with the Web AI server about once an hour (the version, and the country Cloudflare
   sees; never what anyone browses; "Send anonymous counts" in Settings turns it off), unlocks the
   limited-time achievements, shows answers to problem reports, and takes secret words and the code
   hunt's code from the address bar: the effect plays on a new tab page (#lvfx=), since web pages
   cover this window. cloud.js asks Live which side of a gradual rollout this PC is on. */
(function () {
"use strict";
if (!window.Live) return;
Live.init({ platform:"windows", version:"@@WEBS_VERSION@@", isPrivate:() => PRIVATE, noFx:true, toast:(m, a) => toast(m, a),
  openReports:() => { if (window.X3 && X3.support) X3.support(); } });

// a secret word or the hunt's code, typed in the address bar
const go0 = go;
go = function (text) {
  const s = String(text || "").trim(), D = Live.data();
  if (PRIVATE || !s || s.length > 40 || /[./:]/.test(s) || !((D.secrets && D.secrets.length) || D.hunt)) return go0(text);
  Live.secret(s).then(hit => {
    if (!hit) return go0(text);
    const u = HOME + "newtab.html#lvfx=" + (hit === "hunt" ? "fireworks" : hit);
    if (active && isNtp(T(active))) send("navigate", active, u); else newTab(u, false);
    closeOver();
    toast(hit === "hunt" ? "🔍 You found the secret code!" : "🤫 You found a secret word!");
  }, () => go0(text));
};

// limited-time achievements, the community goal's and the hunt's join the list
const achPanel0 = achPanel;
achPanel = function () {
  const extra = Live.achievements();
  if (!extra.length) return achPanel0();
  const got = load("ach", {});
  const row = (on, icon, name, what) => { const r = el("div", "achv" + (on ? " got" : ""), "<b></b><span></span>"); r.querySelector("b").textContent = on ? icon : "🔒";
    r.querySelector("span").textContent = name; const e = el("em"); e.textContent = what; r.querySelector("span").appendChild(e); return r; };
  const rows = ACH.map(([id, icon, name, what]) => row(got[id], icon, name, what + (got[id] ? " · " + new Date(got[id]).toLocaleDateString() : "")))
    .concat(extra.map(a => row(a.got, a.e, a.name, a.desc + (a.got ? " · " + new Date(a.got).toLocaleDateString() : ""))));
  listPanel("achp", "Achievements - " + (Object.keys(got).length + extra.filter(a => a.got).length) + " of " + (ACH.length + extra.length), rows, "");
};
Live.on(() => Live.checkAch());
setTimeout(() => Live.checkAch(), 25000);
})();
