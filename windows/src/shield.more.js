/* ---------------------------------------------------------------- Webs 3.14: more page tools, by name (X_MORE[name](arg))
   x-type   { t, r? }   types t where the cursor is (dictation); with r, replaces the last r before the cursor with t
   x-duck   "0.25"|"off"  every video and sound on the page down to that share of its volume while the assistant talks, or back */
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
    if (o.r) {
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
