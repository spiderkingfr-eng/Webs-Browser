/* ---------------------------------------------------------------- Webs 3.14: more page tools, by name (X_MORE[name](arg))
   x-type   { t, r? }   types t where the cursor is (dictation); with r, replaces the last r before the cursor with t
   x-duck   "0.25"|"off"  every video and sound on the page down to that share of its volume while the assistant talks, or back
   x-selinfo            the selected text, or the whole text of the box you're typing in: { sel, edit, all }
   x-pickimg            lets you click a picture on the page (Esc to cancel): { u } (its address, or a small copy) or { none }
   (anime, #055 #061 #063)
   x-spoil  { w:[words] } blurs what mentions them (titles, posts, captions, pictures' names), even what loads later; a click
                        shows one. { off:1 } or no words: all back. Replies { n } (how many are hidden)
   x-manga  { mode?, rtl? } reading mode for manga: just the pages, big, on black: one at a time ("page"), two side by side
                        like the book ("two"), right to left too, or one long strip ("strip"); the arrow keys turn, Esc leaves. Replies { n } or { none }
   x-romaji "on"|"off"|{ ans } the reading of Japanese under the pointer, in a little bubble: kana here; words with kanji
                        are asked of the window ({ a:"x-romaji-ask", t, q }), which answers with { ans:{ q, ro, en } } */
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


/* ---------------------------------------------------------------- #055 the spoiler shield */
var xSpoil = null;
function xRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
X_MORE['x-spoil'] = function (arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) {}
  var words = (o.w || []).map(function (w) { return String(w).trim(); }).filter(function (w) { return w.length >= 3; }).slice(0, 60);
  if (xSpoil) { xSpoil.mo.disconnect(); clearTimeout(xSpoil.t); D.removeEventListener('click', xSpoil.click, true); }
  [].forEach.call(D.querySelectorAll('[data-wsb-spoil]'), function (e) { e.removeAttribute('data-wsb-spoil'); });
  if (o.off || !words.length) { xSpoil = null; toolReply({ a: 'x-spoil', n: 0 }); return; }
  var re = new RegExp('(^|[^\\p{L}\\p{N}])(' + words.map(xRe).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'iu');
  if (!D.getElementById('wsb-spoil-css')) {
    var st = D.createElement('style'); st.id = 'wsb-spoil-css';
    st.textContent = '[data-wsb-spoil="1"]{filter:blur(8px)!important;cursor:pointer!important;user-select:none!important;transition:filter .2s!important}[data-wsb-spoil="1"]:hover{filter:blur(6px)!important}';
    (D.head || D.documentElement).appendChild(st);
  }
  var BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,a,article,blockquote,figcaption,td,dd,yt-formatted-string,#video-title,ytd-rich-item-renderer,[role="article"],[data-testid="tweet"]';
  var n = 0;
  function hide(e) { if (e && !e.hasAttribute('data-wsb-spoil') && e !== D.body && e !== D.documentElement) { e.setAttribute('data-wsb-spoil', '1'); n++; } }
  function scan(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    var w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (t) {
      var p = t.parentElement; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT)$/.test(p.nodeName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return re.test(t.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
    for (var t = w.nextNode(), k = 0; t && k < 400; t = w.nextNode(), k++) {
      var p = t.parentElement, b = p.closest(BLOCK);
      // a whole card on a feed (a video, a post) when it's small enough; otherwise just the line
      var card = b && b.closest('ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,[data-testid="tweet"],shreddit-post');
      hide(card || b || p);
    }
    [].forEach.call((root.querySelectorAll ? root : D).querySelectorAll('img[alt],img[title]'), function (im) { if (re.test((im.alt || '') + ' ' + (im.title || ''))) hide(im); });
  }
  var pend = [];
  var mo = new MutationObserver(function (ms) {
    ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (a) { if (a.nodeType === 1) pend.push(a); else if (a.nodeType === 3 && a.parentElement) pend.push(a.parentElement); }); });
    if (pend.length > 300) pend = [D.body];
    clearTimeout(xSpoil.t); xSpoil.t = setTimeout(function () { var l = pend; pend = []; l.forEach(function (r) { if (r.isConnected) scan(r); }); }, 250);
  });
  var click = function (e) { var h = e.target.closest && e.target.closest('[data-wsb-spoil="1"]'); if (h) { e.preventDefault(); e.stopPropagation(); h.setAttribute('data-wsb-spoil', '0'); } };
  xSpoil = { mo: mo, t: 0, click: click };
  D.addEventListener('click', click, true);
  scan(D.body || D.documentElement);
  mo.observe(D.documentElement, { childList: true, subtree: true });
  toolReply({ a: 'x-spoil', n: n });
};

/* ---------------------------------------------------------------- #061 manga mode */
var xManga = null;
X_MORE['x-manga'] = function (arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) { o = { mode: arg }; }
  if (xManga) { xManga.close(); if (o.mode === 'toggle') { toolReply({ a: 'x-manga', n: 0, off: 1 }); return; } }
  var src = function (im) { return im.currentSrc || im.src || im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || ''; };
  var pages = [].slice.call(D.querySelectorAll('img')).filter(function (im) {
    var r = im.getBoundingClientRect(), u = src(im);
    if (!u || /^data:image\/(gif|svg)/.test(u) || /logo|avatar|icon|banner|sprite/i.test(u + ' ' + im.className)) return false;
    return (im.naturalWidth >= 400 && im.naturalHeight >= 500) || (r.width >= 300 && r.height >= 400) || (!im.complete && (im.getAttribute('data-src') || im.getAttribute('data-lazy-src')));
  }).map(src).filter(function (u, i, a) { return a.indexOf(u) === i; });
  if (pages.length < 2) { toolReply({ a: 'x-manga', none: 1 }); return; }
  var mode = o.mode === 'strip' || o.mode === 'two' ? o.mode : 'page', rtl = !!o.rtl, i = 0, wide = 100;
  var step = function () { return mode === 'two' ? 2 : 1; };
  var box = D.createElement('div'), sh = box.attachShadow ? box.attachShadow({ mode: 'open' }) : box;
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0b0b0d';
  sh.innerHTML = '<style>:host{all:initial}*{box-sizing:border-box}.w{position:absolute;inset:0;overflow:auto;font:13px system-ui,sans-serif;color:#eee;scroll-behavior:smooth}' +
    '.bar{position:fixed;top:0;left:0;right:0;display:flex;gap:6px;align-items:center;padding:8px 12px;background:linear-gradient(#000c,#0000);z-index:2;opacity:.15;transition:opacity .2s}.bar:hover{opacity:1}' +
    '.bar button{font:inherit;color:#fff;background:#ffffff1f;border:0;border-radius:8px;padding:6px 10px;cursor:pointer}.bar button.on{background:#e8342a}.bar span{margin-left:auto;opacity:.7}' +
    '.st{display:flex;flex-direction:column;align-items:center;padding:44px 0 40px}.st img{display:block;max-width:100%;margin:0 auto}' +
    '.pg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:2px;padding:44px 8px 8px}.pg img{max-width:100%;max-height:100%;object-fit:contain;user-select:none;min-width:0}.pg.two img{max-width:50%}.pg.rtl{flex-direction:row-reverse}</style>' +
    '<div class="w"><div class="bar"><button data-m="page">One page</button><button data-m="two">Two pages</button><button data-m="strip">Long strip</button><button data-r>Right to left</button><button data-z="-">−</button><button data-z="+">+</button><span></span><button data-x>Close (Esc)</button></div><div class="v"></div></div>';
  var v = sh.querySelector('.v'), w = sh.querySelector('.w'), info = sh.querySelector('.bar span');
  function paint() {
    sh.querySelectorAll('[data-m]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === mode); });
    sh.querySelector('[data-r]').classList.toggle('on', rtl); sh.querySelector('[data-r]').style.display = mode === 'strip' ? 'none' : '';
    if (mode === 'strip') { v.className = 'st'; v.innerHTML = pages.map(function (u) { return '<img loading="lazy" referrerpolicy="no-referrer" style="width:' + wide + '%;max-width:' + (wide * 9) + 'px">'; }).join(''); [].forEach.call(v.querySelectorAll('img'), function (im, k) { im.src = pages[k]; }); info.textContent = pages.length + ' pages'; }
    else {
      // two pages side by side, like the printed book (in right-to-left, the first page is on the right)
      var two = mode === 'two' && pages[i + 1];
      v.className = 'pg' + (mode === 'two' ? ' two' : '') + (rtl ? ' rtl' : '');
      v.innerHTML = '<img referrerpolicy="no-referrer">' + (two ? '<img referrerpolicy="no-referrer">' : '');
      v.children[0].src = pages[i]; if (two) v.children[1].src = pages[i + 1];
      [].forEach.call(v.children, function (im) { im.style.maxHeight = wide + '%'; });
      info.textContent = (i + 1) + (two ? '-' + (i + 2) : '') + ' / ' + pages.length;
      for (var k = 1; k <= 2; k++) if (pages[i + step() + k - 1]) { var pre = new Image(); pre.src = pages[i + step() + k - 1]; }
    }
  }
  function turn(d) { if (mode === 'strip') { w.scrollBy(0, d * w.clientHeight * 0.85); return; } var n = Math.max(0, Math.min(pages.length - 1, i + d * step())); if (n !== i) { i = n; paint(); } }
  sh.querySelector('.bar').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-x')) close();
    else if (b.hasAttribute('data-r')) { rtl = !rtl; paint(); }
    else if (b.getAttribute('data-m')) { mode = b.getAttribute('data-m'); if (mode === 'two') i -= i % 2; paint(); }
    else if (b.getAttribute('data-z')) { wide = Math.max(40, Math.min(100, wide + (b.getAttribute('data-z') === '+' ? 10 : -10))); paint(); }
  });
  v.addEventListener('click', function (e) { if (mode === 'strip') return; var left = e.clientX < innerWidth / 2; turn((left ? -1 : 1) * (rtl ? -1 : 1)); });
  function key(e) {
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowRight') turn(rtl && mode !== 'strip' ? -1 : 1);
    else if (e.key === 'ArrowLeft') turn(rtl && mode !== 'strip' ? 1 : -1);
    else if (e.key === ' ' || e.key === 'PageDown' || e.key === 'ArrowDown' && mode !== 'strip') turn(1);
    else if (e.key === 'PageUp' || e.key === 'ArrowUp' && mode !== 'strip') turn(-1);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  var ov = D.documentElement.style.overflow;
  function close() { W.removeEventListener('keydown', key, true); box.remove(); D.documentElement.style.overflow = ov; xManga = null; }
  W.addEventListener('keydown', key, true);
  D.documentElement.appendChild(box); D.documentElement.style.overflow = 'hidden';
  xManga = { close: close };
  paint();
  toolReply({ a: 'x-manga', n: pages.length });
};

/* ---------------------------------------------------------------- #063 romaji on hover */
var xRo = null;
var KANA = { 'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','ゐ':'wi','ゑ':'we','を':'o','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ゔ':'vu','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゃ':'ya','ゅ':'yu','ょ':'yo','ゎ':'wa','ー':'-' };
function xRomaji(s) {
  // katakana to hiragana first (same sounds, 0x60 apart)
  s = String(s).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  var out = '', i = 0;
  while (i < s.length) {
    var c = s[i], nx = s[i + 1];
    if (c === 'っ' && nx && KANA[nx]) { out += KANA[nx][0] === 'c' ? 't' : KANA[nx][0]; i++; continue; }
    if (nx && /[ゃゅょ]/.test(nx) && KANA[c] && /i$/.test(KANA[c])) { var b = KANA[c].slice(0, -1); out += (/^(sh|ch|j)$/.test(b) ? b + KANA[nx].slice(1) : b + KANA[nx]); i += 2; continue; }
    if (c === 'ー') { var m = /[aeiou]$/.exec(out); out += m ? m[0] : ''; i++; continue; }
    if (c === 'ん' && nx && KANA[nx] && /^[aiueoy]/.test(KANA[nx])) { out += "n'"; i++; continue; }
    out += KANA[c] != null ? KANA[c] : c; i++;
  }
  return out;
}
X_MORE['x-romaji'] = function (arg) {
  var o = arg; try { o = JSON.parse(arg); } catch (e) {}
  if (o && o.ans) { if (xRo) { xRo.got[o.ans.q] = o.ans.ro + (o.ans.en ? ' · ' + o.ans.en : ''); if (xRo.q === o.ans.q) xRo.show(o.ans.q + ' · ' + xRo.got[o.ans.q], true); } return; }
  if (o === 'off') { if (xRo) xRo.off(); xRo = null; toolReply({ a: 'x-romaji', on: 0 }); return; }
  if (xRo) { toolReply({ a: 'x-romaji', on: 1 }); return; }
  var tip = D.createElement('div'); tip.setAttribute('data-wsb', 'romaji');
  tip.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;padding:5px 9px;border-radius:8px;background:#1b1820;color:#fff;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:320px;display:none';
  D.documentElement.appendChild(tip);
  var JP = /[぀-ヿ一-鿿々]/, KANJI = /[一-鿿々]/, last = '', tmr = 0, asked = {};
  function at(x, y) {
    var r = D.caretRangeFromPoint ? D.caretRangeFromPoint(x, y) : null; if (!r || r.startContainer.nodeType !== 3) return '';
    var t = r.startContainer.nodeValue, k = r.startOffset; if (!JP.test(t.charAt(k) || '') && !JP.test(t.charAt(k - 1) || '')) return '';
    var a = k, b = k; while (a > 0 && JP.test(t.charAt(a - 1)) && k - a < 12) a--; while (b < t.length && JP.test(t.charAt(b)) && b - k < 12) b++;
    return t.slice(a, b);
  }
  var api = {
    q: '', got: {},
    show: function (txt, fromAi) { tip.textContent = txt; tip.style.display = 'block'; if (fromAi) tip.style.background = '#2a1f3a'; },
    off: function () { D.removeEventListener('mousemove', mv, true); tip.remove(); }
  };
  function mv(e) {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      var s = at(e.clientX, e.clientY);
      if (!s) { tip.style.display = 'none'; last = ''; return; }
      tip.style.left = Math.min(innerWidth - 330, e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 18) + 'px';
      if (s === last) return; last = s; tip.style.background = '#1b1820';
      if (!KANJI.test(s)) { api.q = s; api.show(s + ' · ' + xRomaji(s)); return; }
      api.q = s; if (api.got[s]) { api.show(s + ' · ' + api.got[s], true); return; }
      api.show(s + ' · …');
      if (!asked[s]) { asked[s] = 1; toolReply({ a: 'x-romaji-ask', q: s, t: s }); }
    }, 180);
  }
  D.addEventListener('mousemove', mv, true);
  xRo = api;
  toolReply({ a: 'x-romaji', on: 1 });
};
