/* ---------------------------------------------------------------- Webs 3.14: more page tools, by name (X_MORE[name](arg))
   x-type   { t, r? }   types t where the cursor is (dictation); with r, replaces the last r before the cursor with t
   x-duck   "0.25"|"off"  every video and sound on the page down to that share of its volume while the assistant talks, or back
   x-selinfo            the selected text, or the whole text of the box you're typing in: { sel, edit, all }
   x-pickimg            lets you click a picture on the page (Esc to cancel): { u } (its address, or a small copy) or { none } */
var X_MORE = {};
function xDeepFocus() { var e = D.activeElement; while (e && e.shadowRoot && e.shadowRoot.activeElement) e = e.shadowRoot.activeElement; return e; }
function xEditable(e) {
  if (!e) return false;
  if (e.tagName === 'TEXTAREA') return !e.readOnly && !e.disabled;
  if (e.tagName === 'INPUT') return !e.readOnly && !e.disabled && /^(text|search|email|url|tel|)$/i.test(e.type || '');
  return !!e.isContentEditable;
}
X_MORE['x-type'] = function (arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) { o = { t: String(arg || '') }; }
  var t = String(o.t || ''), el = xDeepFocus();
  if (!xEditable(el)) { toolReply({ a: 'x-type', ok: 0, why: 'none' }); return; }
  try {
    try { el.focus({ preventScroll: true }); } catch (e) {}
    if (o.all) {
      // the whole box (it had no selection when its text was taken)
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.select();
      else { var ra = D.createRange(); ra.selectNodeContents(el); var sa = W.getSelection(); sa.removeAllRanges(); sa.addRange(ra); }
    } else if (o.r) {
      var r = String(o.r);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        var end = el.selectionEnd == null ? el.value.length : el.selectionEnd, i = el.value.lastIndexOf(r, Math.max(0, end - r.length));
        if (i < 0) i = el.value.lastIndexOf(r);
        if (i < 0) { toolReply({ a: 'x-type', ok: 0, why: 'gone' }); return; }
        el.setSelectionRange(i, i + r.length);
      } else if (!(W.find && W.find(r, false, true, false, false, false, false))) { toolReply({ a: 'x-type', ok: 0, why: 'gone' }); return; }
    }
    // insertText keeps the page's own undo and lets sites see the typing
    if (!D.execCommand('insertText', false, t)) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    toolReply({ a: 'x-type', ok: 1 });
  } catch (e) { toolReply({ a: 'x-type', ok: 0, why: 'error' }); }
};
var xDucked = null;
X_MORE['x-duck'] = function (arg) {
  var media = allVideos(D).concat([].slice.call(D.querySelectorAll('audio')));
  if (arg === 'off') { if (xDucked) media.forEach(function (m) { var v = xDucked.get(m); if (v != null) try { m.volume = v; } catch (e) {} }); xDucked = null; return; }
  var f = Math.max(0, Math.min(1, +arg || 0.25));
  if (!xDucked) xDucked = typeof WeakMap === 'function' ? new WeakMap() : null;
  if (!xDucked) return;
  media.forEach(function (m) { if (!xDucked.has(m)) { xDucked.set(m, m.volume); try { m.volume = m.volume * f; } catch (e) {} } });
};

X_MORE['x-selinfo'] = function () {
  var el = xDeepFocus(), sel = '', all = 0, edit = 0;
  if (xEditable(el)) {
    edit = 1;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { sel = el.value.substring(el.selectionStart || 0, el.selectionEnd || 0); if (!sel) { sel = el.value; all = 1; } }
    else { try { sel = String(W.getSelection() || ''); } catch (e) {} if (!sel || !el.contains(W.getSelection().anchorNode)) { sel = el.innerText || ''; all = 1; } }
  } else { try { sel = String(W.getSelection() || ''); } catch (e) {} }
  toolReply({ a: 'x-selinfo', sel: String(sel).slice(0, 12000), edit: edit, all: all });
};
var xPicking = null;
X_MORE['x-pickimg'] = function () {
  if (xPicking) xPicking.stop();
  var imgs = [].slice.call(D.images).filter(function (i) { var r = i.getBoundingClientRect(); return r.width >= 40 && r.height >= 40; });
  if (!imgs.length) { toolReply({ a: 'x-pickimg', none: 1, why: 'none' }); return; }
  var tip = D.createElement('wsb-badge');
  tip.style.cssText = 'all:initial;position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;background:rgba(20,16,22,.92);color:#fff;font:600 14px Segoe UI,system-ui,sans-serif;padding:9px 16px;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  tip.textContent = 'Click the picture for Web AI · Esc to cancel';
  (D.body || D.documentElement).appendChild(tip);
  var hl = null, hold = '';
  var over = function (e) { var i = e.target && e.target.closest ? e.target.closest('img') : null; if (hl && hl !== i) { hl.style.outline = hold; hl = null; } if (i && imgs.indexOf(i) >= 0 && hl !== i) { hl = i; hold = i.style.outline; i.style.outline = '4px solid #e8342a'; } };
  var done = function (o) { stop(); toolReply(o); };
  var click = function (e) {
    if (!e.isTrusted) return;
    var i = e.target && e.target.closest ? e.target.closest('img') : null;
    if (!i || imgs.indexOf(i) < 0) return;
    e.preventDefault(); e.stopPropagation();
    var u = i.currentSrc || i.src || '';
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(u)) { done({ a: 'x-pickimg', data: u.slice(0, 2000000), alt: i.alt || '' }); return; }
    if (/^https:\/\//.test(u)) { done({ a: 'x-pickimg', u: u, alt: i.alt || '' }); return; }
    // anything else (a blob, http): a small copy, if the page lets the picture be read
    try { var c = D.createElement('canvas'), k = Math.min(1, 1024 / Math.max(i.naturalWidth, i.naturalHeight)); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); done({ a: 'x-pickimg', data: c.toDataURL('image/jpeg', 0.85), alt: i.alt || '' }); }
    catch (x) { done({ a: 'x-pickimg', none: 1, why: 'locked' }); }
  };
  var key = function (e) { if (e.key === 'Escape') { e.preventDefault(); done({ a: 'x-pickimg', none: 1, why: 'cancel' }); } };
  function stop() { D.removeEventListener('mouseover', over, true); D.removeEventListener('click', click, true); D.removeEventListener('keydown', key, true); if (hl) hl.style.outline = hold; if (tip.parentNode) tip.parentNode.removeChild(tip); xPicking = null; }
  D.addEventListener('mouseover', over, true); D.addEventListener('click', click, true); D.addEventListener('keydown', key, true);
  xPicking = { stop: function () { stop(); } };
  setTimeout(function () { if (xPicking) done({ a: 'x-pickimg', none: 1, why: 'timeout' }); }, 60000);
};
