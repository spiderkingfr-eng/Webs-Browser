/* ---------------------------------------------------------------- Webs 3.1: Google account and updates
   The browser window does the work (it can see the sign-in tab); this page asks
   it through wsb.xgCmd and shows what it reports in wsb.xgStatus. */
(function () {
"use strict";
if (cfg.xUpdates === undefined) cfg.xUpdates = true;
bindSwitch("xUpdates", () => cfg, "xUpdates");
const ask = cmd => put("xgCmd", { cmd, t:Date.now() + Math.random() });
const ago = ts => { if (!ts) return "not yet"; const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + " min ago" : s < 86400 ? Math.floor(s / 3600) + " h ago" : new Date(ts).toLocaleString(); };
const newer = (a, b) => { const x = String(a || "").split(".").map(Number), y = String(b || "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const sub = document.querySelector(".sub"), subText = sub ? sub.textContent : "";
function paint() {
  const s = get("xgStatus", null) || {};
  const box = $("#xgBox"), on = !!s.signedIn;
  box.classList.toggle("on", on); box.classList.toggle("error", !!s.expired || !!s.err);
  document.querySelectorAll(".xgOnly").forEach(r => r.style.display = on || s.expired ? "" : "none");
  const pic = $("#xgPic");
  pic.innerHTML = "";
  if (s.pic) { const i = document.createElement("img"); i.alt = ""; i.referrerPolicy = "no-referrer"; i.src = s.pic; pic.appendChild(i); }
  else pic.textContent = on ? String(s.name || s.email || "G").charAt(0).toUpperCase() : "G";
  const go = $("#xgGo");
  if (s.private) { $("#xgTitle").textContent = "Google account"; $("#xgNote").textContent = "Open Settings from a normal window to sign in."; go.style.display = "none"; }
  else if (!s.configured) { $("#xgTitle").textContent = "Save your layout to Google"; $("#xgNote").textContent = "Not switched on in this copy yet: it needs a one-time setup by whoever publishes the browser, and then arrives with an update."; go.style.display = "none"; }
  else if (s.signingIn) { $("#xgTitle").textContent = "Finish signing in"; $("#xgNote").textContent = "In the Google tab that opened. It closes by itself when you're done."; go.style.display = ""; go.textContent = "Show"; go.onclick = () => ask("panel"); }
  else if (on || s.expired) {
    $("#xgTitle").textContent = s.name || s.email || "Google account";
    $("#xgNote").textContent = s.expired ? "Your sign-in has ended. Sign in again to keep syncing." : (s.email || "") + (s.busy ? " · syncing…" : " · synced " + ago(s.last)) + (s.err ? " · " + s.err : "");
    go.style.display = s.expired ? "" : "none"; go.textContent = "Sign in again"; go.onclick = () => ask("signin");
  } else { $("#xgTitle").textContent = "Save your layout to Google"; $("#xgNote").textContent = "Sign in once on each computer, and your layout, settings, bookmarks and notes follow you." + (s.err ? " (" + s.err + ")" : "");
    go.style.display = ""; go.textContent = "Sign in with Google"; go.onclick = () => { ask("signin"); flash("Opening Google sign-in…"); }; }
  const pr = s.prefs || { layout:true, lists:true, extras:true };
  [["xgLayout", "layout"], ["xgLists", "lists"], ["xgExtras", "extras"]].forEach(([id, k]) => $("#" + id).classList.toggle("on", pr[k] !== false));
  $("#xgLast").textContent = "Every few minutes while the browser is open · last " + ago(s.last);
  if (sub) sub.textContent = on ? "Stored on this computer, and synced with your Google account (" + (s.email || "signed in") + ")." : subText;
  // the browser window says what's on offer (3.7: a gradual rollout, or going back); older ones didn't
  const u = s.upd || {}, L = "avail" in s ? s.avail : u.latest && newer(u.latest.version, s.version) ? u.latest : null, avail = !!L;
  $("#xuVer").textContent = "Webs Browser " + (s.version || "");
  const A = s.auto, ready = avail && A && A.ready;
  $("#xuNote").textContent = (avail ? (L.back ? "Going back to version " : "Version ") + L.version + (ready ? " is installed: restart to use it" : L.back ? " for now, while a problem is fixed" : " is ready") + (L.notes && L.notes.length ? ": " + L.notes.slice(0, 3).join(" · ") : ".")
    : (u.err ? (u.err === "No update has been published yet" ? u.err : "Couldn't check: " + u.err) : u.checked ? "You have the newest version · checked " + ago(u.checked) : "Not checked yet")) +
    (A ? " Updates install by themselves in the background." : " Update once with the button and they install by themselves from then on.");
  $("#xuGo").style.display = avail ? "" : "none";
  $("#xuGo").textContent = ready ? "Restart to update" : L && L.back ? "Go back now" : "Update now";
}
[["xgLayout", "layout"], ["xgLists", "lists"], ["xgExtras", "extras"]].forEach(([id, k]) => {
  $("#" + id).onclick = () => { const pr = Object.assign({ layout:true, lists:true, extras:true }, get("xgPrefs", {}) || {}); pr[k] = !pr[k]; put("xgPrefs", pr);
    $("#" + id).classList.toggle("on", pr[k]); ask("status"); flash(); };
});
$("#xgSync").onclick = () => { ask("sync"); flash("Syncing…"); };
$("#xgOut").onclick = () => { if (confirm("Sign out of your Google account?\n\nEverything stays on this computer; it just stops syncing.")) ask("signout"); };
$("#xgDel").onclick = () => ask("delete");
$("#xuCheck").onclick = () => { ask("check"); flash("Checking…"); };
$("#xuGo").onclick = () => ask("update");
addEventListener("storage", e => { if (e.key === "wsb.xgStatus") paint(); });
paint(); ask("status");
setInterval(paint, 30000);
})();
