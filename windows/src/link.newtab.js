/* Webs 3.10: pick up where you left off - what your phone has open, on the new tab page (the window keeps it
   in wsb.linkNow; ../../js/link.js). Customize → Show on this page → From your other devices. */
(function () {
"use strict";
if (PRIVATE) return;
SHOW.push(["linknow", "From your other devices"]);
const sec = document.createElement("section"); sec.id = "lkSec"; sec.className = "hide";
($("xpSec") || $("anSec") || $("f")).after(sec);
const esc2 = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
function paint() {
  let l = []; try { l = JSON.parse(localStorage.getItem("wsb.linkNow") || "[]") || []; } catch (e) {}
  l = l.filter(x => x && /^https?:\/\//i.test(x.u || "") && Date.now() - (+x.ts || 0) < 86400000);
  const show = l.length && !hidden("linknow");
  sec.classList.toggle("hide", !show);
  if (!show) return;
  const x = l[0];
  let host = ""; try { host = new URL(x.u).hostname.replace(/^www\./, ""); } catch (e) {}
  sec.innerHTML = '<a class="lkc" href="' + esc2(x.u) + '"><span class="lki">' + (x.app === "iphone" ? "📱" : "💻") + '</span><span class="lkt"><em>Continue from ' + esc2(x.from || "your phone") + "</em><b>" +
    esc2(x.t || host) + "</b><i>" + esc2(host) + '</i></span><span class="lkg">Open ›</span></a>';
}
const applyCustomL = applyCustom;
applyCustom = function () { applyCustomL(); try { paint(); } catch (e) { console.error(e); } };
addEventListener("storage", e => { if (e.key === "wsb.linkNow") paint(); });
const st = document.createElement("style");
st.textContent = "#lkSec{margin:16px auto 0;max-width:560px}.lkc{display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:16px;background:var(--card,rgba(255,255,255,.06));color:inherit;text-decoration:none;backdrop-filter:blur(14px)}" +
  ".lkc:hover{filter:brightness(1.12)}.lki{font-size:24px}.lkt{flex:1;min-width:0;display:flex;flex-direction:column}.lkt em{font-style:normal;font-size:12px;opacity:.7}.lkt b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".lkt i{font-style:normal;font-size:12px;opacity:.6}.lkg{font-weight:600;opacity:.8}";
document.head.appendChild(st);
paint();
})();
