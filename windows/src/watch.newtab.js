/* Webs 3.14: watching on the new tab page (../../js/watch.js)
   #093 a red dot when a streamer you follow is live (a click opens the window's Watching → Streamers), and
   #100 the reaction recorder: this page opened as newtab.html#recorder (the window puts it next to the video) records
   your webcam and microphone, and saves the clip in your downloads. Nothing is sent anywhere. */
(function () {
"use strict";
if (!window.Watch) return;
const ch = typeof BroadcastChannel === "function" ? new BroadcastChannel("wsb-watch") : null;

/* ---------------------------------------------------------------- #093 the live-now dot */
const dot = document.createElement("button"); dot.type = "button"; dot.className = "wlive"; dot.hidden = true;
dot.onclick = () => { if (ch) ch.postMessage({ panel:"live" }); };
document.body.appendChild(dot);
if (!PRIVATE) Watch.liveDot(n => { dot.hidden = !n; dot.innerHTML = "<i></i>" + n + " live"; dot.title = n + " streamer" + (n === 1 ? "" : "s") + " you follow " + (n === 1 ? "is" : "are") + " live now"; });

/* ---------------------------------------------------------------- #100 the reaction recorder */
function recorder() {
  const box = document.createElement("div"); box.className = "wrec";
  box.innerHTML = '<div class="wrec-c"><h2>🎥 Record your reaction</h2><p>Your camera and microphone, recorded on this computer while you watch. The clip is saved in your downloads; nothing is uploaded.</p>' +
    '<div class="wrec-v"><video class="wrec-live" muted playsinline autoplay></video><video class="wrec-play" controls playsinline hidden></video><span class="wrec-t" hidden></span></div>' +
    '<div class="wrec-b"><button type="button" class="wrec-go">● Start recording</button><button type="button" class="wrec-save" hidden>Save the clip</button><button type="button" class="wrec-again" hidden>Record again</button></div><p class="wrec-msg"></p></div>';
  document.body.appendChild(box);
  document.title = "Reaction recorder";
  const live = box.querySelector(".wrec-live"), play = box.querySelector(".wrec-play"), go = box.querySelector(".wrec-go"), sv = box.querySelector(".wrec-save"), again = box.querySelector(".wrec-again"), msg = box.querySelector(".wrec-msg"), tm = box.querySelector(".wrec-t");
  let stream = null, rec = null, parts = [], blob = null, t0 = 0, iv = 0;
  const start = async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ ideal:1280 }, height:{ ideal:720 } }, audio:true }); live.srcObject = stream; msg.textContent = ""; }
    catch (e) { msg.textContent = "The camera couldn't start: allow it for Webs (and check no other app is using it)."; go.disabled = true; }
  };
  const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  go.onclick = () => {
    if (rec && rec.state === "recording") { rec.stop(); return; }
    if (!stream) return;
    parts = []; rec = new MediaRecorder(stream, type ? { mimeType:type } : undefined);
    rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    rec.onstop = () => {
      clearInterval(iv); tm.hidden = true;
      blob = new Blob(parts, { type:"video/webm" });
      play.src = URL.createObjectURL(blob); play.hidden = false; live.hidden = true;
      go.hidden = true; sv.hidden = false; again.hidden = false; go.textContent = "● Start recording"; go.classList.remove("on");
    };
    rec.start(1000); t0 = Date.now(); go.textContent = "■ Stop"; go.classList.add("on"); tm.hidden = false;
    iv = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); tm.textContent = "● " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 500);
  };
  sv.onclick = () => {
    if (!blob) return;
    const d = new Date(), p = n => String(n).padStart(2, "0"), a = document.createElement("a");
    a.href = play.src; a.download = "reaction " + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + "." + p(d.getMinutes()) + ".webm";
    document.body.appendChild(a); a.click(); a.remove(); msg.textContent = "Saved in your downloads.";
  };
  again.onclick = () => { blob = null; play.hidden = true; play.removeAttribute("src"); live.hidden = false; go.hidden = false; sv.hidden = true; again.hidden = true; msg.textContent = ""; };
  addEventListener("pagehide", () => { if (stream) stream.getTracks().forEach(t => t.stop()); });
  start();
  window.X3N = window.X3N || {}; X3N.recorder = { box, state:() => rec ? rec.state : "", blob:() => blob };
}
let recOn = false;
const recCheck = () => { if (location.hash === "#recorder" && !recOn) { recOn = true; recorder(); } };
addEventListener("hashchange", recCheck); recCheck();

const st = document.createElement("style");
st.textContent = ".wlive{position:fixed;left:16px;top:14px;z-index:30;display:flex;align-items:center;gap:6px;font:600 12.5px system-ui,sans-serif;color:var(--fg);background:var(--bg2);border:1px solid var(--line);border-radius:999px;padding:5px 11px 5px 9px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}" +
  ".wlive[hidden]{display:none}.wlive i{width:8px;height:8px;border-radius:50%;background:#e91916;box-shadow:0 0 0 0 rgba(233,25,22,.6);animation:wlP 1.6s infinite}@keyframes wlP{70%{box-shadow:0 0 0 7px rgba(233,25,22,0)}100%{box-shadow:0 0 0 0 rgba(233,25,22,0)}}" +
  ".wrec{position:fixed;inset:0;z-index:100;background:var(--bg);color:var(--fg);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}.wrec-c{width:min(640px,100%);display:flex;flex-direction:column;gap:10px}" +
  ".wrec h2{margin:0;font-size:20px}.wrec p{margin:0;color:var(--dim);font-size:13.5px}.wrec-v{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000}.wrec-v video{width:100%;height:100%;object-fit:cover}.wrec-live{transform:scaleX(-1)}" +
  ".wrec-t{position:absolute;left:12px;top:10px;color:#fff;background:rgba(200,20,20,.85);border-radius:8px;padding:3px 8px;font:600 13px system-ui,sans-serif;font-variant-numeric:tabular-nums}" +
  ".wrec-b{display:flex;gap:8px;flex-wrap:wrap}.wrec-b button{font:600 14px system-ui,sans-serif;border:0;border-radius:10px;padding:10px 16px;cursor:pointer;background:var(--bg3);color:var(--fg)}.wrec-go,.wrec-save{background:var(--accent)!important;color:#fff!important}.wrec-go.on{background:#c8141e!important}" +
  ":root[data-motion=\"off\"] .wlive i{animation:none}";
document.head.appendChild(st);
})();
