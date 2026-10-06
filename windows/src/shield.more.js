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
                        are asked of the window ({ a:"x-romaji-ask", t, q }), which answers with { ans:{ q, ro, en } }
   (watching, #076-#100)
   x-watch  { skip, auto, vol, bright, subs, glow, cinema, shorts, twitch }  what this page's videos do, again after each load:
                        skip: "Skip intro" over a video during a chapter called Intro/Opening (auto: by itself); vol: the
                        site's volume, and changes you make are told to the window ({ a:"x-watch-ev", ev:"vol", v });
                        bright 1-1.6; subs { size, bold, bg }; glow: the video's colors around it; cinema: everything
                        else dimmed; shorts: YouTube's Shorts hidden; twitch: a "chat over the video" button on Twitch
   x-chapters           the main video's chapters: { l:[{ t, end, title }], now }
   x-seekto  seconds    the main video to that point (and plays it)
   x-vtime              { t, d, title, u }: where the main video is
   x-caps               the subtitles the video has loaded (WebVTT text tracks): { text } as "[m:ss] line" lines, or { none }
   x-binge   n          "That's n episodes in a row": keep watching, or take a break (pauses)
   x-fade    seconds    every video and sound fades out over that time, then pauses (the sleep timer)
   x-loopat  { a, b }   the main video loops between those two times; "off" stops it */
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


/* ---------------------------------------------------------------- watching (#076-#100) */
function xClock(s) { s = Math.max(0, Math.round(+s || 0)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x; }
function xChapters(v) {
  var out = [], d = v && isFinite(v.duration) ? v.duration : 0;
  var toS = function (t) { var p = String(t).trim().split(':').map(Number); if (p.some(isNaN)) return -1; return p.reduce(function (a, b) { return a * 60 + b; }, 0); };
  // a site's own chapter track (WebVTT, kind "chapters")
  try { [].forEach.call(v.textTracks || [], function (tr) { if (tr.kind !== 'chapters') return; if (tr.mode === 'disabled') tr.mode = 'hidden'; [].forEach.call(tr.cues || [], function (c) { out.push({ t: c.startTime, end: c.endTime, title: String(c.text || '').trim().slice(0, 100) }); }); }); } catch (e) {}
  // YouTube's chapter list (under the video)
  if (!out.length) {
    var seen = {};
    [].forEach.call(D.querySelectorAll('ytd-macro-markers-list-item-renderer'), function (r) {
      var h = r.querySelector('h4'), tm = r.querySelector('#time'), t = tm ? toS(tm.textContent) : -1;
      if (!h || t < 0 || seen[t]) return; seen[t] = 1; out.push({ t: t, title: h.textContent.trim().slice(0, 100) });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    out.forEach(function (c, i) { c.end = out[i + 1] ? out[i + 1].t : d || c.t + 60; });
  }
  return out.filter(function (c) { return c.title && c.end > c.t; }).slice(0, 200);
}
var INTRO = /^(?:\d+[.:)]?\s*)?(?:intro(?:duction)?|opening(?: (?:song|theme|credits))?|op|theme song|cold open|title sequence|générique|vorspann)\b/i;
var xW = { cfg: {}, sheet: null, tick: 0, ours: 0, btn: null, skipped: {}, glow: null, hole: null, tw: null };
function xWatchCss() {
  var c = xW.cfg, css = '';
  if (c.bright > 1) css += 'video{filter:brightness(' + Math.min(1.6, c.bright) + ') contrast(' + (1 + (c.bright - 1) * 0.25).toFixed(2) + ')!important}';
  if (c.subs) {
    var z = Math.max(0.8, Math.min(2.5, +c.subs.size || 1)), bg = c.subs.bg ? 'rgba(0,0,0,.85)' : 'rgba(0,0,0,.5)', b = c.subs.bold ? 700 : 400;
    css += 'video::cue{font-size:' + Math.round(z * 100) + '%!important;font-weight:' + b + '!important;background:' + bg + '!important;color:#fff!important}' +
      '.ytp-caption-window-container{transform:scale(' + z + ');transform-origin:50% 92%}.ytp-caption-segment{font-weight:' + b + '!important;background:' + bg + '!important}' +
      '.player-timedtext-text-container{transform:scale(' + z + ');transform-origin:50% 100%}.player-timedtext-text-container span{font-weight:' + b + '!important;background:' + bg + '!important}';
  }
  if (c.shorts && /(^|\.)youtube\.com$/.test(HOST)) css += 'ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts],ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),grid-shelf-view-model:has(a[href^="/shorts/"]),ytd-guide-entry-renderer:has(a[title="Shorts"]),ytd-mini-guide-entry-renderer[aria-label="Shorts"],ytd-video-renderer:has(a[href^="/shorts/"]),ytd-grid-video-renderer:has(a[href^="/shorts/"]),yt-chip-cloud-chip-renderer:has([title="Shorts"]){display:none!important}';
  if (c.twitch && /(^|\.)twitch\.tv$/.test(HOST)) css += 'html[data-wsb-tw] .video-player__container,html[data-wsb-tw] .persistent-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483000!important;max-height:none!important}' +
    'html[data-wsb-tw] .channel-root__right-column,html[data-wsb-tw] .right-column{position:fixed!important;right:0!important;top:0!important;bottom:0!important;width:340px!important;z-index:2147483001!important;opacity:.82;background:rgba(14,14,16,.55)!important;transform:none!important;display:block!important}' +
    'html[data-wsb-tw] .channel-root__right-column *,html[data-wsb-tw] .right-column *{background-color:transparent!important}';
  if (!xW.sheet) { xW.sheet = D.createElement('style'); xW.sheet.setAttribute('data-wsb', 'watch'); }
  xW.sheet.textContent = css;
  if (css && !xW.sheet.isConnected) (D.head || D.documentElement).appendChild(xW.sheet);
}
function xSkipBtn(v, ch) {
  if (!xW.btn) {
    xW.btn = D.createElement('div'); xW.btn.setAttribute('data-wsb', 'skip');
    var sh = xW.btn.attachShadow ? xW.btn.attachShadow({ mode: 'open' }) : xW.btn;
    sh.innerHTML = '<style>button{all:initial;font:600 14px system-ui,sans-serif;color:#fff;background:rgba(20,20,24,.85);border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:9px 16px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)}button:hover{background:#e8342a;border-color:#e8342a}</style><button type="button">Skip intro ›</button>';
    sh.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); var c = xW.btn._ch, vv = xW.btn._v; if (c && vv) { vv.currentTime = c.end; xW.skipped[c.t] = 1; } xW.btn.remove(); });
    xW.btn.style.cssText = 'position:fixed;z-index:2147483646;display:block';
  }
  var r = v.getBoundingClientRect();
  xW.btn._ch = ch; xW.btn._v = v;
  xW.btn.style.left = Math.max(8, r.right - 150) + 'px'; xW.btn.style.top = Math.max(8, r.bottom - 90) + 'px';
  if (!xW.btn.isConnected) D.documentElement.appendChild(xW.btn);
}
function xWatchTick() {
  var c = xW.cfg, v = bestVideo();
  // skip intro, from the chapters
  if (c.skip && v && !v.paused && isFinite(v.duration)) {
    var ch = xChapters(v), now = v.currentTime, cur = null;
    for (var i = 0; i < ch.length; i++) if (now >= ch[i].t && now < ch[i].end - 1) { cur = ch[i]; break; }
    if (cur && INTRO.test(cur.title) && cur.end - cur.t <= 300 && !xW.skipped[cur.t]) {
      if (c.auto) { v.currentTime = cur.end; xW.skipped[cur.t] = 1; badge('Skipped the intro'); }
      else xSkipBtn(v, cur);
    } else if (xW.btn && xW.btn.isConnected) xW.btn.remove();
  } else if (xW.btn && xW.btn.isConnected) xW.btn.remove();
  // the glow and the dimmed page follow the video
  xGlow(c.glow && v && !v.paused ? v : null);
  xCinema(c.cinema && v && v.getBoundingClientRect().width > 200 ? v : null);
}
function xGlow(v) {
  if (!v) { if (xW.glow) { xW.glow.cv.remove(); xW.glow = null; } return; }
  if (!xW.glow) {
    var cv = D.createElement('canvas'); cv.setAttribute('data-wsb', 'glow'); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;opacity:.6';
    D.documentElement.appendChild(cv); xW.glow = { cv: cv, g: cv.getContext('2d') };
  }
  var cv2 = xW.glow.cv, g = xW.glow.g, r = v.getBoundingClientRect(), W2 = innerWidth, H2 = innerHeight;
  if (cv2.width !== Math.round(W2 / 4)) { cv2.width = Math.round(W2 / 4); cv2.height = Math.round(H2 / 4); }
  var k = 0.25, pad = 60;
  g.clearRect(0, 0, cv2.width, cv2.height);
  try {
    g.save(); g.filter = 'blur(14px) saturate(1.4)';
    g.drawImage(v, (r.left - pad) * k, (r.top - pad) * k, (r.width + pad * 2) * k, (r.height + pad * 2) * k);
    g.restore();
    g.clearRect(r.left * k, r.top * k, r.width * k, r.height * k);          // the video itself stays as it is
  } catch (e) {}
}
function xCinema(v) {
  if (!v) { if (xW.hole) { xW.hole.remove(); xW.hole = null; } return; }
  if (!xW.hole) { xW.hole = D.createElement('div'); xW.hole.setAttribute('data-wsb', 'cinema'); xW.hole.setAttribute('aria-hidden', 'true'); D.documentElement.appendChild(xW.hole); }
  var r = v.getBoundingClientRect();
  xW.hole.style.cssText = 'position:fixed;pointer-events:none;z-index:2147482999;border-radius:6px;transition:all .3s;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;box-shadow:0 0 0 200vmax rgba(0,0,0,.86)';
}
function xTwitchBtn(on) {
  var b = D.querySelector('[data-wsb="twchat"]');
  if (!on) { if (b) b.remove(); D.documentElement.removeAttribute('data-wsb-tw'); return; }
  if (b) return;
  b = D.createElement('button'); b.type = 'button'; b.setAttribute('data-wsb', 'twchat'); b.textContent = '⛶ Full screen with chat';
  b.style.cssText = 'all:initial;position:fixed;right:350px;bottom:16px;z-index:2147483002;font:600 13px system-ui,sans-serif;color:#fff;background:#9146ff;border-radius:8px;padding:8px 12px;cursor:pointer;opacity:.85';
  b.addEventListener('click', function () {
    var on2 = !D.documentElement.hasAttribute('data-wsb-tw');
    if (on2) { D.documentElement.setAttribute('data-wsb-tw', ''); b.textContent = '✕ Leave full screen'; try { D.documentElement.requestFullscreen().catch(function () {}); } catch (e) {} }
    else { D.documentElement.removeAttribute('data-wsb-tw'); b.textContent = '⛶ Full screen with chat'; if (D.fullscreenElement) D.exitFullscreen().catch(function () {}); }
  });
  D.addEventListener('fullscreenchange', function () { if (!D.fullscreenElement && D.documentElement.hasAttribute('data-wsb-tw')) { D.documentElement.removeAttribute('data-wsb-tw'); b.textContent = '⛶ Full screen with chat'; } });
  D.documentElement.appendChild(b);
}
var xVolHooked = false;
X_MORE['x-watch'] = function (arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) {}
  xW.cfg = o;
  xWatchCss();
  xTwitchBtn(!!o.twitch && /(^|\.)twitch\.tv$/.test(HOST) && TOP);
  // the site's volume: put on each video as it plays; your own changes are remembered by the window
  if (o.vol != null && o.vol >= 0) allVideos(D).concat([].slice.call(D.querySelectorAll('audio'))).forEach(function (m) { xW.ours = Date.now(); try { m.volume = Math.min(1, +o.vol); } catch (e) {} });
  if (!xVolHooked) {
    xVolHooked = true;
    D.addEventListener('play', function (e) { var m = e.target; if (xW.cfg.vol != null && xW.cfg.vol >= 0 && m instanceof HTMLMediaElement && !m._wsbVol) { m._wsbVol = 1; xW.ours = Date.now(); try { m.volume = Math.min(1, +xW.cfg.vol); } catch (x) {} } }, true);
    var vt = 0;
    D.addEventListener('volumechange', function (e) {
      var m = e.target; if (!(m instanceof HTMLMediaElement) || Date.now() - xW.ours < 400 || m.muted) return;
      clearTimeout(vt); vt = setTimeout(function () { toolReply({ a: 'x-watch-ev', ev: 'vol', v: Math.round(m.volume * 100) / 100 }); }, 600);
    }, true);
  }
  // listen only on this site (the picture hidden), and long audio (podcasts) offered back where you were
  if (o.ao) allVideos(D).forEach(function (v) { if (!v.hasAttribute(AO)) { v.setAttribute(AO, ''); aoSheet(); } });
  if (!xW.hooked2) {
    xW.hooked2 = true;
    D.addEventListener('play', function (e) { if (xW.cfg.ao && e.target instanceof HTMLVideoElement && !e.target.hasAttribute(AO)) { e.target.setAttribute(AO, ''); aoSheet(); } }, true);
    var lastA = 0, offered = false;
    D.addEventListener('timeupdate', function (e) {
      var a = e.target; if (!(a instanceof HTMLAudioElement) || !isFinite(a.duration) || a.duration < 300 || Date.now() - lastA < 10000) return;
      lastA = Date.now(); toolReply({ a: 'x-watch-ev', ev: 'apos', t: Math.round(a.currentTime), d: Math.round(a.duration) });
    }, true);
    D.addEventListener('playing', function (e) {
      var a = e.target, at = +xW.cfg.apos || 0;
      if (offered || !at || !(a instanceof HTMLAudioElement) || a.currentTime > 20 || !isFinite(a.duration) || at > a.duration - 30) return;
      offered = true; badge('You stopped at ' + clock(at), { label: 'Resume', fn: function () { a.currentTime = at; } }, 12000);
    }, true);
  }
  clearInterval(xW.tick);
  if (o.skip || o.glow || o.cinema) xW.tick = setInterval(xWatchTick, o.glow ? 120 : 500);
  else { xGlow(null); xCinema(null); if (xW.btn) xW.btn.remove(); }
};
X_MORE['x-chapters'] = function () {
  var v = bestVideo();
  toolReply({ a: 'x-chapters', l: v ? xChapters(v) : [], now: v ? v.currentTime : 0, has: v ? 1 : 0 });
};
X_MORE['x-seekto'] = function (arg) {
  var v = bestVideo(), t = Math.max(0, +arg || 0);
  if (!v) { toolReply({ a: 'x-seekto', ok: 0 }); return; }
  var go = function () { try { v.currentTime = Math.min(t, isFinite(v.duration) ? v.duration - 1 : t); v.play().catch(function () {}); } catch (e) {} badge('→ ' + xClock(t)); };
  if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  toolReply({ a: 'x-seekto', ok: 1 });
};
X_MORE['x-vtime'] = function () {
  var v = bestVideo();
  toolReply({ a: 'x-vtime', has: v ? 1 : 0, t: v ? Math.round(v.currentTime) : 0, d: v && isFinite(v.duration) ? Math.round(v.duration) : 0, title: D.title, u: L.href });
};
X_MORE['x-caps'] = function () {
  var v = bestVideo(), lines = [];
  try {
    [].forEach.call((v && v.textTracks) || [], function (tr) {
      if (lines.length || (tr.kind !== 'subtitles' && tr.kind !== 'captions')) return;
      var was = tr.mode; if (was === 'disabled') tr.mode = 'hidden';
      [].forEach.call(tr.cues || [], function (c) { var x = String(c.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); if (x) lines.push('[' + xClock(c.startTime) + '] ' + x); });
      if (was === 'disabled' && !lines.length) tr.mode = was;
    });
  } catch (e) {}
  toolReply(lines.length ? { a: 'x-caps', text: lines.join('\n').slice(0, 400000), title: D.title } : { a: 'x-caps', none: 1 });
};
X_MORE['x-binge'] = function (arg) {
  var n = +arg || 3, old = D.querySelector('[data-wsb="binge"]'); if (old) old.remove();
  var host = D.createElement('div'); host.setAttribute('data-wsb', 'binge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)';
  var sh = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  sh.innerHTML = '<style>.c{font:15px/1.45 system-ui,sans-serif;color:#fff;background:#1b1820;border-radius:16px;padding:22px 24px;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}b{display:block;font-size:20px;margin-bottom:6px}' +
    '.r{display:flex;gap:8px;justify-content:center;margin-top:16px}button{font:600 14px system-ui,sans-serif;border:0;border-radius:10px;padding:9px 14px;cursor:pointer}.k{background:#ffffff1f;color:#fff}.t{background:#e8342a;color:#fff}</style>' +
    '<div class="c"><b>🍿 That\'s ' + n + ' episodes in a row</b>Your eyes might like a break: stretch, have some water, look at something far away.<div class="r"><button class="k" type="button">Keep watching</button><button class="t" type="button">Take a break</button></div></div>';
  var vs = allVideos(D);
  sh.querySelector('.k').onclick = function () { host.remove(); toolReply({ a: 'x-binge', keep: 1 }); };
  sh.querySelector('.t').onclick = function () { vs.forEach(function (v) { try { v.pause(); } catch (e) {} }); host.remove(); toolReply({ a: 'x-binge', rest: 1 }); };
  D.documentElement.appendChild(host);
};
X_MORE['x-fade'] = function (arg) {
  var secs = Math.max(2, Math.min(300, +arg || 60)), media = allVideos(D).concat([].slice.call(D.querySelectorAll('audio'))).filter(function (m) { return !m.paused; });
  var start = media.map(function (m) { return m.volume; }), t0 = Date.now();
  var iv = setInterval(function () {
    var k = Math.max(0, 1 - (Date.now() - t0) / (secs * 1000));
    media.forEach(function (m, i) { xW.ours = Date.now(); try { m.volume = start[i] * k * k; } catch (e) {} });
    if (k <= 0) { clearInterval(iv); media.forEach(function (m, i) { try { m.pause(); m.volume = start[i]; } catch (e) {} }); }
  }, 250);
  toolReply({ a: 'x-fade', n: media.length });
};

var xLoop = null;
X_MORE['x-loopat'] = function (arg) {
  var v = bestVideo(), o = null; try { o = JSON.parse(arg); } catch (e) {}
  if (xLoop) { xLoop.v.removeEventListener('timeupdate', xLoop.f); xLoop = null; }
  if (!v || !o || !(o.b > o.a)) { if (arg === 'off') badge('Loop off'); toolReply({ a: 'x-loopat', ok: 0 }); return; }
  var f = function () { if (v.currentTime >= o.b || v.currentTime < o.a - 1) v.currentTime = o.a; };
  v.addEventListener('timeupdate', f); xLoop = { v: v, f: f };
  v.currentTime = o.a; v.play().catch(function () {});
  badge('Looping ' + xClock(o.a) + '–' + xClock(o.b));
  toolReply({ a: 'x-loopat', ok: 1 });
};
