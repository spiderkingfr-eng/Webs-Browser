/* Webs Browser for iPhone 2.9 - privacy (js/privacy.js):
   - Face ID (or Touch ID) for the passcode: a passkey made on this iPhone for Webs alone, which only opens with
     your face; the passcode keeps working. Nothing leaves the phone. (Settings → Passcode lock)
   - What sites see about you: your internet address and roughly where you are, your device, the fingerprint a
     site can build. (Menu → Privacy)
   - Is this shop real? A website whose address looks like a shop's trick (a brand in someone else's name, a
     cheap ending) is checked as it opens: how old it is, from the public registry. Sites open in frames the app
     can't read, so the page itself isn't looked at; Web AI can check it for you. */
"use strict";
(function () {
if (!window.Privacy) return;
const P = window.Privacy;

/* ---------------------------------------------------------------- Face ID for the passcode */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
async function faceAvail() {
  try { return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch (e) { return false; }
}
async function faceOn() {
  const L = load("mlock", null);
  if (!L) { toast("Set a passcode first"); return false; }
  if (!(await faceAvail())) { toast("Face ID isn't available for Webs on this iPhone"); return false; }
  try {
    const c = await navigator.credentials.create({ publicKey:{
      challenge:rand(32), rp:{ name:"Webs Browser", id:location.hostname }, user:{ id:rand(16), name:"Webs passcode", displayName:"Webs passcode" },
      pubKeyCredParams:[{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }], timeout:60000, attestation:"none",
      authenticatorSelection:{ authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged" } } });
    if (!c) throw new Error("none");
    L.fid = b64u(c.rawId);
    try { const pk = c.response && c.response.getPublicKey && c.response.getPublicKey(); const alg = c.response && c.response.getPublicKeyAlgorithm && c.response.getPublicKeyAlgorithm(); if (pk && alg === -7) L.fpk = b64u(pk); } catch (e) {}
    save("mlock", L); toast("Face ID on for Webs");
    return true;
  } catch (e) { toast(e && e.name === "NotAllowedError" ? "Face ID wasn't turned on" : "Couldn't turn on Face ID"); return false; }
}
function faceOff() { const L = load("mlock", null); if (L) { delete L.fid; delete L.fpk; save("mlock", L); } toast("Face ID off for Webs"); }
// an ECDSA signature as WebAuthn gives it (DER) in the form Web Crypto checks (r and s, 32 bytes each)
function derToRaw(der) {
  const d = new Uint8Array(der); let i = 2; if (d[1] & 0x80) i += d[1] & 0x7f;
  const part = () => { i++; const n = d[i++]; let v = d.slice(i, i + n); i += n; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = part(), s = part(), out = new Uint8Array(64); out.set(r); out.set(s, 32); return out;
}
async function faceCheck() {
  const L = load("mlock", null); if (!L || !L.fid) return false;
  const challenge = rand(32);
  const a = await navigator.credentials.get({ publicKey:{ challenge, rpId:location.hostname, timeout:60000, userVerification:"required", allowCredentials:[{ type:"public-key", id:unb64u(L.fid) }] } });
  if (!a || b64u(a.rawId) !== L.fid) return false;
  const ad = new Uint8Array(a.response.authenticatorData), cd = a.response.clientDataJSON;
  if (ad.length < 37 || !(ad[32] & 0x01) || !(ad[32] & 0x04)) return false;            // the person was there, and Face ID checked them
  let c = null; try { c = JSON.parse(new TextDecoder().decode(cd)); } catch (e) {}
  if (!c || c.type !== "webauthn.get" || c.challenge !== b64u(challenge)) return false;
  if (L.fpk && a.response.signature) {
    const key = await crypto.subtle.importKey("spki", unb64u(L.fpk), { name:"ECDSA", namedCurve:"P-256" }, false, ["verify"]);
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", cd)), data = new Uint8Array(ad.length + 32); data.set(ad); data.set(h, ad.length);
    if (!(await crypto.subtle.verify({ name:"ECDSA", hash:"SHA-256" }, key, derToRaw(a.response.signature), data))) return false;
  }
  return true;
}
let faceBusy = false;
async function faceUnlock(auto) {
  const box = $("#lock"); if (!box || faceBusy) return;
  faceBusy = true;
  let okk = false;
  try { okk = await faceCheck(); } catch (e) { okk = false; }
  faceBusy = false;
  if (!$("#lock")) return;
  if (okk) {
    lockFails = 0;
    box.classList.add("open"); document.documentElement.classList.remove("locked"); setTimeout(() => box.remove(), 420);
  } else if (!auto) $("#lkM").textContent = "Face ID didn't work. Use your passcode.";
}
function faceButton() {
  const L = load("mlock", null), box = $("#lock");
  if (!L || !L.fid || !box || box.querySelector(".lkface")) return;
  const gap = box.querySelector(".kp > span"); if (!gap) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "lkface"; b.title = "Face ID"; b.setAttribute("aria-label", "Unlock with Face ID");
  b.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 15.5c1.4 1.2 3.6 1.2 5 0"/></svg>';
  b.onclick = e => { e.stopPropagation(); faceUnlock(false); };
  gap.replaceWith(b);
}
const showLock0 = showLock;
showLock = function () { showLock0(); faceButton(); if ($("#lock") && (load("mlock", null) || {}).fid && document.visibilityState === "visible") faceUnlock(true); };
faceButton();      // the lock shown as the app opened, before this file
const pass0 = SETACTIONS.passcode;
SETACTIONS.passcode = async () => {
  const L = load("mlock", null);
  if (!L || !(await faceAvail())) { pass0(); return; }
  const pick0 = pick;
  pick = (title, opts, msg) => {
    pick = pick0;
    opts.splice(1, 0, L.fid ? { label:"Face ID: on ✓ (turn off)", fn:faceOff } : { label:"Use Face ID too", fn:faceOn });
    pick0(title, opts, msg);
  };
  try { pass0(); } finally { pick = pick0; }
};

/* ---------------------------------------------------------------- what sites see about you */
async function seen() {
  openSheet("What sites see about you", '<div class="card pvc"><div class="pvb"><p class="dim">Asking…</p></div></div>', { back:openPrivacy });
  const [pg, ip] = await Promise.all([P.local(), P.whoami()]);
  const b = $("#sheetBody .pvb"); if (!b) return;
  const list = P.seen({ page:pg, ip, fp:false, vpn:false });
  P.render(b, list, "Any website can read these without asking. A VPN hides your address; iPhone already keeps most of the rest the same on every iPhone, which makes you harder to pick out.");
}

/* ---------------------------------------------------------------- is this shop real? */
const checked = {};
async function checkHost(host, manual) {
  const h = String(host || "").replace(/^www\./, ""), d = P.regDomain(h);
  if (!d) return null;
  const hs = P.hostSigns(h);
  if (!manual && (hs.known || !hs.signs.length || checked[d] || (load("shopTrust", []) || []).indexOf(d) >= 0 || (cfg && cfg.xShop === false))) return null;
  checked[d] = 1;
  let age = null; try { age = await P.domainAge(h); } catch (e) {}
  const v = P.shopVerdict({}, age, h);
  if (v.level === "ok" && !manual) return v;
  const why = () => shopSheet(d, v);
  if (v.level === "warn") toast("⚠️ " + d + " might be fake: check it before you pay", { label:"Why?", fn:why });
  else if (v.level === "careful") toast("🧐 Be careful with " + d, { label:"Why?", fn:why });
  else if (manual) shopSheet(d, v);
  return v;
}
function shopSheet(d, v) {
  const li = a => a.map(x => "<li>" + esc(x) + "</li>").join("");
  openSheet("Is this shop real?", '<div class="card pvc"><p class="pvh">' + (v.level === "warn" ? "⚠️ " + esc(d) + " might be fake" : v.level === "careful" ? "🧐 Be careful with " + esc(d) : "✅ Nothing worrying about " + esc(d)) + "</p>" +
    (v.reasons.length ? '<ul class="pvul">' + li(v.reasons) + "</ul>" : "") + (v.good.length ? '<p class="dim">In its favour:</p><ul class="pvul">' + li(v.good) + "</ul>" : "") +
    '<p class="dim">Webs looks at the website\'s address and how old it is. If a deal looks too good to be true, it usually is.</p></div>' +
    '<div class="card"><button type="button" class="mrow" data-pv="ai"><span class="aie">✦</span><span>Ask Web AI to check the shop</span></button>' +
    '<button type="button" class="mrow" data-pv="trust"><span class="aie">👍</span><span>I trust this shop</span></button></div>', { back:openPrivacy });
  $("#sheetBody [data-pv=ai]").onclick = () => { closeSheet(); if (window.WebAI) WebAI.ask("Is the online shop " + d + " legitimate, or a scam? Check the website and what people say about it."); };
  $("#sheetBody [data-pv=trust]").onclick = () => { const l = load("shopTrust", []) || []; if (l.indexOf(d) < 0) l.push(d); save("shopTrust", l.slice(-200)); closeSheet(); toast("Webs won't warn about " + d + " again"); };
}
const goP = go;
go = function (input, opts) {
  const r = goP(input, opts);
  setTimeout(() => { const t = curTab(); if (t && t.u && !t.internal && /^https?:/.test(t.u)) { try { checkHost(new URL(t.u).hostname, false); } catch (e) {} } }, 600);
  return r;
};

/* ---------------------------------------------------------------- the menu */
async function openPrivacy() {
  const t = curTab(), web = t && t.u && !t.internal && /^https?:/.test(t.u), L = load("mlock", null);
  const r = (act, e, n, sub) => '<button type="button" class="mrow" data-pv="' + act + '"><span class="aie">' + e + "</span><span>" + n + "</span><em>" + esc(sub) + "</em></button>";
  const face = L && await faceAvail();
  openSheet("Privacy", '<div class="card">' + r("seen", "👀", "What sites see about you", "Address, device, fingerprint") +
    (web ? r("shop", "🛍️", "Is this shop real?", P.regDomain(new URL(t.u).hostname)) : "") +
    (face ? r("face", "🙂", L.fid ? "Face ID is on" : "Use Face ID to open Webs", L.fid ? "Tap to turn it off" : "With your passcode") : r("pass", "🔒", L ? "Passcode lock" : "Lock Webs with a passcode", "")) + "</div>");
  $("#sheetBody").querySelectorAll("[data-pv]").forEach(b => { b.onclick = () => ({
    seen, shop:() => checkHost(new URL(curTab().u).hostname, true), face:() => { closeSheet(); if ((load("mlock", null) || {}).fid) faceOff(); else faceOn(); },
    pass:() => { closeSheet(); SETACTIONS.passcode(); } })[b.dataset.pv](); });
}
ACTIONS.privacy = openPrivacy;
const openMenuP = openMenu;
openMenu = function () {
  openMenuP();
  const card = $("#sheetBody .card:last-of-type");
  if (card) card.insertAdjacentHTML("afterbegin", '<button type="button" class="mrow" data-act="privacy">' + ico("lock") + "<span>Privacy</span><em>What sites see, shop check</em></button>");
};
const mb = $("#menuBtn"); if (mb) mb.onclick = () => openMenu();
window.PrivacyApp = { seen, faceOn, faceOff, faceUnlock, faceCheck, checkHost, openPrivacy, derToRaw };

const st = document.createElement("style");
st.textContent = P.CSS + ".pvc{padding:6px 16px 14px}.pvc .pvg{color:var(--dim)}.pvc .pvr{border-color:var(--line)}.pvh{font-size:17px;font-weight:600;margin:10px 0 6px}.pvul{margin:6px 0 10px 20px;font-size:14.5px}" +
  ".lkface{color:var(--fg)!important;display:grid;place-items:center}";
document.head.appendChild(st);
})();
