/* ------------------------------------------------------------------ Webs 3.0: more page tools
   Each runs only when you ask for it from the browser (the menu, the command
   palette or a shortcut), except x-init, which sets up the extras you turned on
   in Settings (scroll progress, back to top, YouTube tidying) as a page loads.
   Panels live in a closed shadow root, so the page cannot read or restyle them. */
var X_CSS = ':host{all:initial}*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}' +
  '.p{position:fixed;top:14px;right:14px;width:400px;max-width:calc(100vw - 28px);max-height:calc(100vh - 28px);display:flex;flex-direction:column;background:rgba(24,21,28,.97);color:#f3eff1;' +
  'border:1px solid #3a3342;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-size:13px;line-height:1.45;animation:in .28s cubic-bezier(.2,.9,.3,1.2)}' +
  '@keyframes in{from{opacity:0;transform:translateY(-8px) scale(.97)}}' +
  '.h{display:flex;align-items:center;gap:8px;padding:12px 12px 10px 16px;border-bottom:1px solid #322c3c}.h b{flex:1;font-size:14px;font-weight:600}' +
  'button{font:inherit;color:inherit;background:#2c2634;border:0;border-radius:8px;padding:6px 10px;cursor:pointer}button:hover{background:#3a3342}button.m{background:#e8342a;color:#fff}' +
  '.x{width:30px;height:30px;padding:0;font-size:16px;background:none}.b{overflow:auto;padding:10px 12px 14px}' +
  'input,select{font:inherit;color:#f3eff1;background:#211c27;border:1px solid #3a3342;border-radius:8px;padding:6px 9px;outline:0}input:focus{border-color:#e8342a}' +
  '.row{display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid #2b2532}.row:last-child{border:0}.row .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.d{color:#9a91a3;font-size:12px}.bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}.bar input{flex:1;min-width:120px}' +
  '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.grid a{display:block;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#211c27 center/cover no-repeat;position:relative}' +
  '.grid a span{position:absolute;left:4px;bottom:4px;font-size:10px;background:rgba(0,0,0,.6);color:#fff;border-radius:5px;padding:1px 5px}' +
  '.sw{width:34px;height:34px;border-radius:9px;flex:none;border:1px solid rgba(255,255,255,.15);cursor:pointer}' +
  '.ok{color:#4ec98a}.warn{color:#e8a33a}.bad{color:#ff6b5f}label{display:flex;align-items:center;gap:8px;margin:6px 0}label span{width:92px;color:#9a91a3}label input[type=range]{flex:1;accent-color:#e8342a}';
var xOpen = {};
function xPanel(id, title, bodyHtml, extraCss) {
  if (xOpen[id]) { xOpen[id].close(); return null; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;top:0;right:0';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>' + X_CSS + (extraCss || '') + '</style><div class="p"><div class="h"><b></b><button class="x" title="Close (Esc)">✕</button></div><div class="b">' + bodyHtml + '</div></div>';
  root.querySelector('.h b').textContent = title;
  var key = function (e) { if (e.key === 'Escape') close(); };
  var close = function () { host.remove(); W.removeEventListener('keydown', key, true); delete xOpen[id]; };
  root.querySelector('.x').onclick = close;
  W.addEventListener('keydown', key, true);
  var fe = D.fullscreenElement;
  (fe && fe.tagName !== 'IFRAME' ? fe : D.body || D.documentElement).appendChild(host);
  xOpen[id] = { close: close, root: root };
  return root;
}
function xCopy(text, done) {
  var ok = function () { badge(done || 'Copied'); };
  try { if (navigator.clipboard && W.isSecureContext) { navigator.clipboard.writeText(text).then(ok, fallback); return; } } catch (e) {}
  fallback();
  function fallback() {
    var ta = D.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    (D.body || D.documentElement).appendChild(ta); ta.select();
    try { D.execCommand('copy'); ok(); } catch (e) { badge('Could not copy here'); }
    ta.remove();
  }
}
function xEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function xAbs(u) { try { return new URL(u, L.href).href; } catch (e) { return ''; } }
function xMain() { return D.querySelector('article') || D.querySelector('main,[role="main"]') || D.body; }
function xVisible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

/* every picture on the page, biggest first */
function xGallery() {
  var seen = {}, list = [];
  var add = function (u, w, h) { u = xAbs(u); if (!u || seen[u] || !/^https?:|^data:image/.test(u)) return; seen[u] = 1; list.push({ u: u, w: w || 0, h: h || 0 }); };
  D.querySelectorAll('img').forEach(function (i) {
    var best = i.currentSrc || i.src;
    if (i.srcset) { var c = i.srcset.split(',').map(function (s) { var p = s.trim().split(/\s+/); return { u: p[0], w: parseFloat(p[1]) || 0 }; }).sort(function (a, b) { return b.w - a.w; })[0]; if (c && c.u) best = c.u; }
    add(best, i.naturalWidth, i.naturalHeight);
  });
  D.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(function (m) { add(m.content); });
  D.querySelectorAll('[style*="background"]').forEach(function (el) { var m = /url\(["']?([^"')]+)/.exec(el.style.backgroundImage || ''); if (m) add(m[1]); });
  list = list.filter(function (x) { return !x.w || x.w >= 40; }).sort(function (a, b) { return b.w * b.h - a.w * a.h; }).slice(0, 300);
  var root = xPanel('gallery', list.length + ' picture' + (list.length === 1 ? '' : 's') + ' on this page',
    '<div class="bar"><input placeholder="Only bigger than… (px wide)" type="number" min="0" step="50"><button class="all">Copy all links</button></div><div class="grid"></div>');
  if (!root) return;
  var grid = root.querySelector('.grid');
  var paint = function (min) {
    grid.innerHTML = '';
    list.filter(function (x) { return !min || x.w >= min; }).forEach(function (x) {
      var a = D.createElement('a'); a.href = x.u; a.target = '_blank'; a.rel = 'noopener'; a.title = x.u;
      a.style.backgroundImage = 'url("' + x.u.replace(/"/g, '%22') + '")';
      if (x.w) { var s = D.createElement('span'); s.textContent = x.w + '×' + x.h; a.appendChild(s); }
      grid.appendChild(a);
    });
    if (!grid.children.length) grid.innerHTML = '<div class="d" style="grid-column:1/-1">No pictures that size.</div>';
  };
  root.querySelector('input').oninput = function (e) { paint(+e.target.value || 0); };
  root.querySelector('.all').onclick = function () { xCopy(list.map(function (x) { return x.u; }).join('\n'), list.length + ' links copied'); };
  paint(0);
}

/* every link, with a filter */
function xLinks() {
  var seen = {}, list = [];
  D.querySelectorAll('a[href]').forEach(function (a) {
    var u = xAbs(a.getAttribute('href'));
    if (!/^https?:/.test(u) || seen[u]) return; seen[u] = 1;
    list.push({ u: u, t: String(a.textContent || a.title || '').replace(/\s+/g, ' ').trim().slice(0, 120) });
  });
  var root = xPanel('links', list.length + ' link' + (list.length === 1 ? '' : 's') + ' on this page',
    '<div class="bar"><input placeholder="Filter, e.g. .pdf or a word"><button class="out">Other sites only</button><button class="cp m">Copy</button></div><div class="l"></div>');
  if (!root) return;
  var box = root.querySelector('.l'), q = '', outOnly = false, shown = [];
  var paint = function () {
    shown = list.filter(function (x) { return (!q || (x.u + ' ' + x.t).toLowerCase().indexOf(q) >= 0) && (!outOnly || new URL(x.u).hostname !== L.hostname); });
    box.innerHTML = shown.slice(0, 600).map(function (x) { return '<div class="row"><div class="t"><a href="' + xEsc(x.u) + '" target="_blank" rel="noopener" style="color:#f3eff1;text-decoration:none">' + xEsc(x.t || x.u) + '</a><div class="d">' + xEsc(x.u) + '</div></div></div>'; }).join('') || '<div class="d">No links match.</div>';
  };
  root.querySelector('input').oninput = function (e) { q = e.target.value.trim().toLowerCase(); paint(); };
  root.querySelector('.out').onclick = function (e) { outOnly = !outOnly; e.target.classList.toggle('m', outOnly); paint(); };
  root.querySelector('.cp').onclick = function () { xCopy(shown.map(function (x) { return x.u; }).join('\n'), shown.length + ' links copied'); };
  paint();
}

/* email addresses and phone numbers */
function xContacts() {
  var text = String((D.body && D.body.innerText) || ''), em = {}, ph = {};
  (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).forEach(function (x) { em[x.toLowerCase()] = 1; });
  D.querySelectorAll('a[href^="mailto:"]').forEach(function (a) { var x = decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]); if (x) em[x.toLowerCase()] = 1; });
  (text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) || []).forEach(function (x) { if (x.replace(/\D/g, '').length >= 9) ph[x.trim()] = 1; });
  D.querySelectorAll('a[href^="tel:"]').forEach(function (a) { ph[decodeURIComponent(a.getAttribute('href').slice(4))] = 1; });
  var E = Object.keys(em), P2 = Object.keys(ph);
  var row = function (v) { return '<div class="row"><div class="t">' + xEsc(v) + '</div><button data-c="' + xEsc(v) + '">Copy</button></div>'; };
  var root = xPanel('contacts', 'Contact details on this page', (E.length ? '<div class="d">Email</div>' + E.map(row).join('') : '') +
    (P2.length ? '<div class="d" style="margin-top:10px">Phone</div>' + P2.map(row).join('') : '') + (E.length || P2.length ? '' : '<div class="d">No email addresses or phone numbers found.</div>'));
  if (!root) return;
  root.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-c]'); if (b) xCopy(b.getAttribute('data-c')); });
}

/* show what is typed in password boxes */
var xPwShown = [];
function xPasswords() {
  if (xPwShown.length) { xPwShown.forEach(function (i) { try { i.type = 'password'; } catch (e) {} }); xPwShown = []; badge('Passwords hidden again'); return; }
  D.querySelectorAll('input[type="password"]').forEach(function (i) { i.type = 'text'; xPwShown.push(i); });
  badge(xPwShown.length ? 'Showing ' + xPwShown.length + ' password box' + (xPwShown.length === 1 ? '' : 'es') + ' - run it again to hide' : 'No password boxes on this page');
}

/* a reading ruler: a band of light that follows the pointer */
var xRul = null;
function xRuler() {
  if (xRul) { xRul.remove(); W.removeEventListener('mousemove', xRul.mv, true); xRul = null; badge('Reading ruler off'); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483645;pointer-events:none';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>.t,.b{position:fixed;left:0;right:0;background:rgba(10,8,14,.55);transition:height .05s}.t{top:0}.b{bottom:0}.l{position:fixed;left:0;right:0;height:2px;background:rgba(232,52,42,.6)}</style><div class="t"></div><div class="l"></div><div class="b"></div>';
  var t = root.querySelector('.t'), b = root.querySelector('.b'), l = root.querySelector('.l'), band = 46;
  host.mv = function (e) { var y = e.clientY; t.style.height = Math.max(0, y - band / 2) + 'px'; b.style.height = Math.max(0, innerHeight - y - band / 2) + 'px'; l.style.top = (y + band / 2 - 2) + 'px'; };
  W.addEventListener('mousemove', host.mv, true);
  (D.body || D.documentElement).appendChild(host);
  host.mv({ clientY: innerHeight / 3 });
  xRul = host;
  badge('Reading ruler on - run it again to turn it off');
}

/* bionic reading: the first part of each word in bold */
var xBio = null;
function xBionic() {
  if (xBio) { xBio.forEach(function (p) { if (p.s.parentNode) p.s.parentNode.replaceChild(p.n, p.s); }); xBio = null; badge('Bionic reading off'); return; }
  xBio = [];
  var nodes = [], w = D.createTreeWalker(xMain(), NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
    var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|CODE|PRE|BUTTON|SELECT)$/.test(p.nodeName) || p.isContentEditable) return 2;
    return /[A-Za-zÀ-ɏ]{2,}/.test(n.nodeValue) ? 1 : 2; } });
  while (w.nextNode() && nodes.length < 6000) nodes.push(w.currentNode);
  nodes.forEach(function (n) {
    var s = D.createElement('span');
    s.innerHTML = xEsc(n.nodeValue).replace(/[A-Za-zÀ-ɏ']{2,}/g, function (wd) { var k = Math.ceil(wd.length * 0.45); return '<b style="font-weight:700">' + wd.slice(0, k) + '</b>' + wd.slice(k); });
    n.parentNode.replaceChild(s, n); xBio.push({ s: s, n: n });
  });
  badge('Bionic reading on - run it again to undo');
}

/* spotlight: everything but the paragraph under the pointer goes dark */
var xSpot = null;
function xSpotlight() {
  if (xSpot) { xSpot.off(); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483645;pointer-events:none';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>.s{position:fixed;border-radius:10px;box-shadow:0 0 0 200vmax rgba(8,6,12,.72);transition:all .18s cubic-bezier(.2,.8,.2,1)}</style><div class="s"></div>';
  var s = root.querySelector('.s'), last = null;
  var mv = function (e) {
    var el = D.elementFromPoint(e.clientX, e.clientY); if (!el || el === host) return;
    var blk = el.closest('p,li,h1,h2,h3,h4,blockquote,pre,figure,td,dd,article section') || el;
    if (blk === last) return; last = blk;
    var r = blk.getBoundingClientRect(); if (r.width > innerWidth * 0.98 && r.height > innerHeight * 0.9) return;
    s.style.cssText = 'left:' + (r.left - 8) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 16) + 'px;height:' + (r.height + 12) + 'px';
  };
  var key = function (e) { if (e.key === 'Escape') off(); };
  var off = function () { host.remove(); W.removeEventListener('mousemove', mv, true); W.removeEventListener('keydown', key, true); W.removeEventListener('scroll', rs, true); xSpot = null; };
  var rs = function () { last = null; };
  W.addEventListener('mousemove', mv, true); W.addEventListener('keydown', key, true); W.addEventListener('scroll', rs, true);
  (D.body || D.documentElement).appendChild(host);
  xSpot = { off: off };
  badge('Spotlight on - Esc to stop');
}

/* big text under the pointer, in a bubble */
var xBig = null;
function xBigText() {
  if (xBig) { xBig.off(); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;pointer-events:none;left:0;top:0';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>.q{position:fixed;max-width:min(720px,90vw);background:#fffdf6;color:#14110f;border-radius:12px;padding:12px 16px;font:500 26px/1.35 "Segoe UI",system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.4);display:none}</style><div class="q"></div>';
  var q = root.querySelector('.q'), last = null;
  var mv = function (e) {
    var el = D.elementFromPoint(e.clientX, e.clientY);
    var blk = el && el.closest && el.closest('p,li,h1,h2,h3,h4,a,button,td,th,label,span,dd,figcaption');
    var txt = blk ? String(blk.innerText || '').trim() : '';
    if (!txt || txt.length > 600) { q.style.display = 'none'; last = null; return; }
    if (blk !== last) { q.textContent = txt; last = blk; }
    q.style.display = 'block';
    var r = q.getBoundingClientRect(), x = Math.min(e.clientX + 16, innerWidth - r.width - 10), y = e.clientY + 22;
    if (y + r.height > innerHeight - 10) y = e.clientY - r.height - 16;
    q.style.left = Math.max(10, x) + 'px'; q.style.top = Math.max(10, y) + 'px';
  };
  var key = function (e) { if (e.key === 'Escape') off(); };
  var off = function () { host.remove(); W.removeEventListener('mousemove', mv, true); W.removeEventListener('keydown', key, true); xBig = null; };
  W.addEventListener('mousemove', mv, true); W.addEventListener('keydown', key, true);
  (D.body || D.documentElement).appendChild(host);
  xBig = { off: off };
  badge('Big text under the pointer - Esc to stop');
}

/* pictures grow when you hover them */
var xZoomOn = false, xZoomHost = null;
function xHoverZoom(force) {
  xZoomOn = force == null ? !xZoomOn : !!force;
  if (!xZoomOn) { if (xZoomHost) xZoomHost.remove(); xZoomHost = null; if (force == null) badge('Picture zoom off'); return; }
  if (xZoomHost) return;
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;pointer-events:none;left:0;top:0';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>img{position:fixed;max-width:min(70vw,900px);max-height:80vh;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.55);background:#111;display:none}</style><img>';
  var big = root.querySelector('img'), t0 = 0, cur = null;
  D.addEventListener('mouseover', function (e) {
    if (!xZoomOn) return;
    var i = e.target && e.target.tagName === 'IMG' ? e.target : null;
    clearTimeout(t0);
    if (!i) { big.style.display = 'none'; cur = null; return; }
    var r = i.getBoundingClientRect();
    if ((i.naturalWidth || 0) < r.width * 1.4 && (i.naturalHeight || 0) < r.height * 1.4) return;   // already shown at full size
    t0 = setTimeout(function () {
      cur = i; big.src = i.currentSrc || i.src; big.style.display = 'block';
      var left = r.right + 14 + 300 < innerWidth ? r.right + 14 : 10, top = 10;
      big.style.left = left + 'px'; big.style.top = top + 'px'; big.style.right = left === 10 ? 'auto' : 'auto';
    }, 350);
  }, true);
  D.addEventListener('mouseout', function (e) { if (e.target === cur) { clearTimeout(t0); big.style.display = 'none'; cur = null; } }, true);
  (D.body || D.documentElement).appendChild(host);
  xZoomHost = host;
  if (force == null) badge('Picture zoom on - hover a small picture to see it bigger');
}

/* find and replace in the page's text */
function xReplace(arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) {}
  var f = String(o.f || ''); if (!f) return;
  var flags = o.cs ? 'g' : 'gi', re;
  try { re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); } catch (e) { return; }
  var n = 0, w = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT, { acceptNode: function (x) { var p = x.parentNode; return p && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.nodeName) ? 2 : 1; } }), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(function (x) { var v = x.nodeValue, c = v.match(re); if (c) { n += c.length; x.nodeValue = v.replace(re, String(o.r == null ? '' : o.r)); } });
  badge(n ? 'Replaced ' + n + ' time' + (n === 1 ? '' : 's') + ' (reload the page to undo)' : 'No matches for “' + f + '”');
}

/* the fonts a page uses */
function xFonts() {
  var count = {}, sample = {};
  D.querySelectorAll('body *').forEach(function (el, i) {
    if (i > 6000 || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) return;
    var t = ''; for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) t += n.nodeValue;   // only its own text, so nothing counts twice
    t = t.replace(/\s+/g, ' ').trim(); if (!t) return;
    var cs = getComputedStyle(el), fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), k = fam + '|' + cs.fontWeight;
    count[k] = (count[k] || 0) + t.length; if (!sample[k]) sample[k] = { fam: fam, w: cs.fontWeight, s: t.slice(0, 40), full: cs.fontFamily };
  });
  var keys = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 20);
  var root = xPanel('fonts', 'Fonts on this page', keys.map(function (k) { var s = sample[k];
    return '<div class="row" style="display:block"><div style="font-family:' + xEsc(s.full) + ';font-weight:' + xEsc(s.w) + ';font-size:18px">' + xEsc(s.s) + '</div><div class="d">' + xEsc(s.fam) + ' · weight ' + xEsc(s.w) + ' · ' + (count[k] < 1000 ? count[k] : Math.round(count[k] / 100) / 10 + 'k') + ' characters</div></div>'; }).join('') || '<div class="d">No text found.</div>');
  if (root) root.querySelectorAll('.row').forEach(function (r, i) { r.style.cursor = 'pointer'; r.title = 'Copy the font name'; r.onclick = function () { xCopy(sample[keys[i]].fam); }; });
}

/* the colors a page uses */
function xColors() {
  var hex = function (c) { var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c); if (!m || (m[4] != null && +m[4] < 0.2)) return ''; return '#' + [m[1], m[2], m[3]].map(function (x) { return (+x).toString(16).padStart(2, '0'); }).join(''); };
  var count = {};
  D.querySelectorAll('body, body *').forEach(function (el, i) {
    if (i > 5000 || !xVisible(el)) return;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect(), area = Math.min(r.width * r.height, 200000);
    var bg = hex(cs.backgroundColor), fg = el.firstChild && el.firstChild.nodeType === 3 ? hex(cs.color) : '';
    if (bg) count[bg] = (count[bg] || 0) + area / 100;
    if (fg) count[fg] = (count[fg] || 0) + 400;
  });
  var list = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 24);
  var root = xPanel('colors', 'Colors on this page', '<div class="d" style="margin-bottom:8px">Click a color to copy it.</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">' +
    list.map(function (c) { return '<div class="row" data-c="' + c + '" style="cursor:pointer;border:0;background:#211c27;border-radius:9px;padding:6px"><div class="sw" style="background:' + c + '"></div><div class="t">' + c.toUpperCase() + '</div></div>'; }).join('') + '</div>' +
    '<div style="margin-top:10px"><button class="m cpall">Copy all as CSS</button></div>');
  if (!root) return;
  root.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-c]'); if (b) xCopy(b.getAttribute('data-c').toUpperCase(), b.getAttribute('data-c').toUpperCase() + ' copied'); });
  root.querySelector('.cpall').onclick = function () { xCopy(':root{\n' + list.map(function (c, i) { return '  --color-' + (i + 1) + ': ' + c + ';'; }).join('\n') + '\n}', 'Palette copied as CSS'); };
}

/* a quick accessibility check */
function xA11y() {
  var issues = [];
  var lum = function (c) { var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (!m) return null; return [m[1], m[2], m[3]].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce(function (a, v, i) { return a + v * [.2126, .7152, .0722][i]; }, 0); };
  var bgOf = function (el) { while (el && el.nodeType === 1) { var b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
  D.querySelectorAll('img').forEach(function (i) { if (!i.hasAttribute('alt') && xVisible(i) && i.width > 24) issues.push({ k: 'bad', t: 'Picture without alt text', el: i, d: (i.currentSrc || i.src || '').split('/').pop().slice(0, 50) }); });
  D.querySelectorAll('a[href]').forEach(function (a) { if (!String(a.textContent || '').trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])') && xVisible(a)) issues.push({ k: 'bad', t: 'Link with no text', el: a, d: a.getAttribute('href').slice(0, 50) }); });
  D.querySelectorAll('button').forEach(function (b) { if (!String(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.title && xVisible(b)) issues.push({ k: 'bad', t: 'Button with no label', el: b, d: '' }); });
  D.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(function (f) { if (!xVisible(f)) return; var id = f.id; if (!(id && D.querySelector('label[for="' + CSS.escape(id) + '"]')) && !f.closest('label') && !f.getAttribute('aria-label') && !f.getAttribute('placeholder')) issues.push({ k: 'warn', t: 'Form field without a label', el: f, d: f.name || '' }); });
  var lastH = 0;
  D.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) { var n = +h.tagName[1]; if (lastH && n > lastH + 1) issues.push({ k: 'warn', t: 'Heading level skipped (h' + lastH + ' to h' + n + ')', el: h, d: String(h.textContent).trim().slice(0, 40) }); lastH = n; });
  var low = 0;
  D.querySelectorAll('p,li,span,a,td,label').forEach(function (el, i) {
    if (i > 2500 || !el.firstChild || el.firstChild.nodeType !== 3 || !String(el.textContent).trim() || !xVisible(el)) return;
    var a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); if (a == null || b == null) return;
    var r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (r < 4.5 && low < 25) { low++; issues.push({ k: 'warn', t: 'Low contrast text (' + r.toFixed(1) + ':1)', el: el, d: String(el.textContent).trim().slice(0, 40) }); }
  });
  if (!D.documentElement.lang) issues.push({ k: 'warn', t: 'The page does not say its language', el: null, d: '' });
  var score = Math.max(0, 100 - issues.filter(function (x) { return x.k === 'bad'; }).length * 4 - issues.filter(function (x) { return x.k === 'warn'; }).length);
  var root = xPanel('a11y', 'Accessibility check: ' + score + '/100',
    (issues.length ? issues.slice(0, 150).map(function (x, i) { return '<div class="row" data-i="' + i + '" style="cursor:pointer"><span class="' + x.k + '">●</span><div class="t">' + xEsc(x.t) + '<div class="d">' + xEsc(x.d) + '</div></div></div>'; }).join('')
      : '<div class="ok">No problems found by these checks.</div>') + '<div class="d" style="margin-top:8px">Click a problem to see it on the page.</div>');
  if (!root) return;
  root.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-i]'); if (!r) return;
    var it = issues[+r.getAttribute('data-i')]; if (!it || !it.el) return;
    it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try { it.el.animate([{ outline: '3px solid #e8342a', outlineOffset: '3px' }, { outline: '3px solid transparent', outlineOffset: '3px' }], { duration: 1800 }); } catch (x) {}
  });
}

/* a layout grid for checking alignment */
var xGridHost = null;
function xGrid() {
  if (xGridHost) { xGridHost.remove(); xGridHost = null; badge('Layout grid off'); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483645;pointer-events:none';
  var root = host.attachShadow({ mode: 'closed' });
  var cols = ''; for (var i = 0; i < 12; i++) cols += '<i></i>';
  root.innerHTML = '<style>.g{position:fixed;inset:0;margin:0 auto;max-width:1200px;padding:0 24px;display:grid;grid-template-columns:repeat(12,1fr);gap:24px}' +
    '.g i{background:rgba(232,52,42,.09);border-left:1px solid rgba(232,52,42,.35);border-right:1px solid rgba(232,52,42,.35)}' +
    '.base{position:fixed;inset:0;background:repeating-linear-gradient(to bottom,transparent 0 7px,rgba(59,139,240,.18) 7px 8px)}</style><div class="base"></div><div class="g">' + cols + '</div>';
  (D.body || D.documentElement).appendChild(host);
  xGridHost = host;
  badge('Layout grid on: 12 columns and an 8px baseline');
}

/* picture adjustments for the video you are watching */
function xVideo() {
  var vs = [].slice.call(D.querySelectorAll('video')).filter(xVisible).sort(function (a, b) { var r = a.getBoundingClientRect(), s = b.getBoundingClientRect(); return s.width * s.height - r.width * r.height; });
  return vs[0] || null;
}
var xVid = { b: 100, c: 100, s: 100, h: 0, rot: 0, fh: false, fv: false };
function xVideoApply(v) {
  v = v || xVideo(); if (!v) return;
  var f = 'brightness(' + xVid.b + '%) contrast(' + xVid.c + '%) saturate(' + xVid.s + '%) hue-rotate(' + xVid.h + 'deg)';
  v.style.setProperty('filter', f === 'brightness(100%) contrast(100%) saturate(100%) hue-rotate(0deg)' ? '' : f, 'important');
  var tr = (xVid.rot ? 'rotate(' + xVid.rot + 'deg) ' : '') + (xVid.rot % 180 ? 'scale(' + Math.min(v.clientHeight / (v.clientWidth || 1), 1).toFixed(3) + ') ' : '') + (xVid.fh ? 'scaleX(-1) ' : '') + (xVid.fv ? 'scaleY(-1)' : '');
  v.style.setProperty('transform', tr.trim(), 'important');
}
function xVideoPanel() {
  var v = xVideo(); if (!v) { badge('No video on this page'); return; }
  var sl = function (k, label, min, max) { return '<label><span>' + label + '</span><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" value="' + xVid[k] + '"><em data-v="' + k + '" style="width:44px;text-align:right;font-style:normal;color:#9a91a3">' + xVid[k] + '</em></label>'; };
  var root = xPanel('video', 'Picture adjustments', sl('b', 'Brightness', 30, 200) + sl('c', 'Contrast', 30, 200) + sl('s', 'Color', 0, 250) + sl('h', 'Hue', -180, 180) +
    '<div class="bar" style="margin-top:10px"><button data-a="rot">Rotate 90°</button><button data-a="fh">Mirror</button><button data-a="fv">Flip upside down</button></div>' +
    '<div class="bar"><button data-a="back">⏮ Previous frame</button><button data-a="next">Next frame ⏭</button></div>' +
    '<div class="bar"><button data-a="reset" class="m">Reset</button></div><div class="d">Frame by frame pauses the video. The changes last until the page reloads.</div>');
  if (!root) return;
  root.addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; xVid[k] = +e.target.value; root.querySelector('[data-v="' + k + '"]').textContent = xVid[k]; xVideoApply(v); });
  root.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
    if (a === 'rot') xVid.rot = (xVid.rot + 90) % 360; else if (a === 'fh') xVid.fh = !xVid.fh; else if (a === 'fv') xVid.fv = !xVid.fv;
    else if (a === 'next' || a === 'back') { xFrame(a === 'next' ? 1 : -1); return; }
    else if (a === 'reset') { xVid = { b: 100, c: 100, s: 100, h: 0, rot: 0, fh: false, fv: false }; root.querySelectorAll('[data-k]').forEach(function (i) { i.value = xVid[i.getAttribute('data-k')]; root.querySelector('[data-v="' + i.getAttribute('data-k') + '"]').textContent = i.value; }); }
    xVideoApply(v);
  });
}
function xFrame(dir) {
  var v = xVideo(); if (!v) { badge('No video on this page'); return; }
  v.pause();
  try { v.currentTime = Math.max(0, v.currentTime + dir / 30); } catch (e) {}
  badge((dir > 0 ? 'Next' : 'Previous') + ' frame · ' + v.currentTime.toFixed(2) + ' s', null, 900);
}

/* a speed reader: one word at a time */
function xSpeedRead() {
  var sel = String(W.getSelection ? W.getSelection() : '').trim();
  var text = sel.length > 40 ? sel : String((xMain() && xMain().innerText) || '');
  var words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 20000);
  if (words.length < 5) { badge('Nothing to read on this page'); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>' + X_CSS + '.o{position:fixed;inset:0;background:rgba(10,8,14,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;color:#f3eff1;animation:in .25s}' +
    '.w{font:500 64px/1.1 Georgia,"Segoe UI",serif;min-height:80px;letter-spacing:.01em}.w b{color:#e8342a;font-weight:600}.c{display:flex;gap:8px;align-items:center}.c span{color:#9a91a3;min-width:120px;text-align:center}' +
    '.pr{width:min(520px,80vw);height:4px;border-radius:2px;background:#2c2634;overflow:hidden}.pr i{display:block;height:100%;background:#e8342a;width:0}</style>' +
    '<div class="o"><div class="w"></div><div class="pr"><i></i></div><div class="c"><button data-a="slow">−</button><span></span><button data-a="fast">+</button><button data-a="play" class="m">Pause</button><button data-a="back">⏪ 10 words</button><button data-a="close">Close</button></div><div class="d">Space to pause, arrows to change speed, Esc to close</div></div>';
  var wEl = root.querySelector('.w'), sp = root.querySelector('.c span'), pr = root.querySelector('.pr i'), pb = root.querySelector('[data-a="play"]');
  var i = 0, wpm = 300, on = true, t = 0;
  var show = function () {
    var w = words[i] || ''; var k = Math.max(0, Math.min(w.length - 1, Math.floor((w.length - 1) / 3)));
    wEl.innerHTML = xEsc(w.slice(0, k)) + '<b>' + xEsc(w.charAt(k)) + '</b>' + xEsc(w.slice(k + 1));
    sp.textContent = wpm + ' words a minute'; pr.style.width = (i / words.length * 100) + '%';
  };
  var step = function () {
    if (!on) return; show();
    var w = words[i] || '', pause = /[.!?]$/.test(w) ? 2.2 : /[,;:]$/.test(w) ? 1.5 : 1;
    i++; if (i >= words.length) { on = false; pb.textContent = 'Again'; return; }
    t = setTimeout(step, 60000 / wpm * pause);
  };
  var key = function (e) { e.stopPropagation(); if (e.key === 'Escape') close(); else if (e.key === ' ') { e.preventDefault(); toggle(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { wpm = Math.min(1000, wpm + 25); show(); } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { wpm = Math.max(100, wpm - 25); show(); } };
  var toggle = function () { if (i >= words.length) i = 0; on = !on; pb.textContent = on ? 'Pause' : 'Play'; clearTimeout(t); if (on) step(); };
  var close = function () { clearTimeout(t); host.remove(); W.removeEventListener('keydown', key, true); };
  root.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
    if (a === 'slow') wpm = Math.max(100, wpm - 25); else if (a === 'fast') wpm = Math.min(1000, wpm + 25);
    else if (a === 'play') toggle(); else if (a === 'back') { i = Math.max(0, i - 10); show(); } else if (a === 'close') close();
    show();
  });
  W.addEventListener('keydown', key, true);
  (D.body || D.documentElement).appendChild(host);
  step();
}

/* snow falling over the page */
var xSnowHost = null;
function xSnow() {
  if (xSnowHost) { xSnowHost.off(); return; }
  var cv = D.createElement('canvas');
  cv.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483644;pointer-events:none';
  var g = cv.getContext('2d'), raf = 0, P = [];
  for (var i = 0; i < 160; i++) P.push({ x: Math.random(), y: Math.random(), r: Math.random() * 2.4 + .6, s: Math.random() * .6 + .3, p: Math.random() * 6.28 });
  var draw = function (now) {
    var k = W.devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    if (cv.width !== w * k) { cv.width = w * k; cv.height = h * k; }
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = '#fff';
    P.forEach(function (p) { p.y += p.s / h * 2.2; if (p.y > 1.02) { p.y = -.02; p.x = Math.random(); } var x = p.x * w + Math.sin(now / 1200 + p.p) * 14;
      g.globalAlpha = .55 + p.r / 6; g.beginPath(); g.arc(x, p.y * h, p.r, 0, 7); g.fill(); });
    raf = requestAnimationFrame(draw);
  };
  (D.body || D.documentElement).appendChild(cv);
  raf = requestAnimationFrame(draw);
  xSnowHost = { off: function () { cancelAnimationFrame(raf); cv.remove(); xSnowHost = null; } };
  badge('Let it snow - run it again to stop');
}

/* gravity: the page falls down */
function xGravity() {
  var els = [].slice.call(D.querySelectorAll('body *')).filter(function (el) {
    if (el.children.length > 0 && !/^(IMG|svg|VIDEO|BUTTON|INPUT|A)$/.test(el.tagName)) return false;
    var r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.width < innerWidth * .9;
  }).slice(0, 350);
  if (!els.length) return;
  var st = els.map(function (el) { var r = el.getBoundingClientRect(); return { el: el, y: 0, vy: -Math.random() * 4, x: 0, vx: (Math.random() - .5) * 3, rot: 0, vr: (Math.random() - .5) * 6, bottom: r.bottom }; });
  var t0 = performance.now();
  var step = function (now) {
    st.forEach(function (s) {
      s.vy += .55; s.y += s.vy; s.x += s.vx; s.rot += s.vr;
      if (s.bottom + s.y > innerHeight) { s.y = innerHeight - s.bottom; s.vy *= -.45; s.vx *= .8; s.vr *= .7; }
      s.el.style.setProperty('transform', 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' + s.rot + 'deg)', 'important');
      s.el.style.setProperty('transition', 'none', 'important');
    });
    if (now - t0 < 6000) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  badge('Whoops. Reload the page to put it back together.');
}

/* text only: pictures and videos hidden */
var xNoImgSheet = null;
function xNoImages() {
  if (!xNoImgSheet) { xNoImgSheet = new CSSStyleSheet(); adopt(xNoImgSheet); xNoImgSheet.on = false; }
  xNoImgSheet.on = !xNoImgSheet.on;
  xNoImgSheet.replaceSync(xNoImgSheet.on ? 'img,picture,video,svg:not([width="0"]),canvas,iframe,[style*="background-image"]{visibility:hidden!important}*{background-image:none!important}' : '');
  badge(xNoImgSheet.on ? 'Text only: pictures and videos are hidden' : 'Pictures are back');
}

/* the page as Markdown */
function xToMd() {
  var root = xMain(), out = [];
  var inl = function (n) {
    var s = '';
    n.childNodes.forEach(function (c) {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1 || /^(SCRIPT|STYLE|NOSCRIPT|BUTTON|NAV|svg)$/i.test(c.tagName)) return;
      var t = inl(c);
      if (/^(B|STRONG)$/.test(c.tagName)) s += t.trim() ? '**' + t.trim() + '** ' : '';
      else if (/^(I|EM)$/.test(c.tagName)) s += t.trim() ? '*' + t.trim() + '* ' : '';
      else if (c.tagName === 'CODE') s += '`' + c.textContent + '`';
      else if (c.tagName === 'A' && c.getAttribute('href')) s += '[' + t.trim() + '](' + xAbs(c.getAttribute('href')) + ')';
      else if (c.tagName === 'IMG') s += c.src ? '![' + (c.alt || '') + '](' + c.src + ')' : '';
      else if (c.tagName === 'BR') s += '  \n';
      else s += t;
    });
    return s;
  };
  var walk = function (n) {
    n.childNodes.forEach(function (c) {
      if (c.nodeType !== 1 || /^(SCRIPT|STYLE|NOSCRIPT|NAV|FOOTER|ASIDE|FORM|BUTTON|svg|HEADER)$/i.test(c.tagName) || !xVisible(c)) return;
      var tg = c.tagName;
      if (/^H[1-6]$/.test(tg)) out.push('#'.repeat(+tg[1]) + ' ' + inl(c).trim());
      else if (tg === 'P') { var p = inl(c).trim(); if (p) out.push(p); }
      else if (tg === 'UL' || tg === 'OL') out.push([].slice.call(c.children).filter(function (li) { return li.tagName === 'LI'; }).map(function (li, i) { return (tg === 'OL' ? (i + 1) + '. ' : '- ') + inl(li).trim(); }).join('\n'));
      else if (tg === 'BLOCKQUOTE') out.push(inl(c).trim().split('\n').map(function (l) { return '> ' + l; }).join('\n'));
      else if (tg === 'PRE') out.push('```\n' + c.textContent.replace(/\n$/, '') + '\n```');
      else if (tg === 'IMG' && c.src) out.push('![' + (c.alt || '') + '](' + c.src + ')');
      else if (tg === 'TABLE') out.push(xTableMd(c));
      else walk(c);
    });
  };
  walk(root);
  return '# ' + (D.title || L.hostname) + '\n\n' + L.href + '\n\n' + out.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n');
}
function xTableRows(t) { return [].slice.call(t.rows).map(function (r) { return [].slice.call(r.cells).map(function (c) { return String(c.innerText || '').replace(/\s+/g, ' ').trim(); }); }).filter(function (r) { return r.some(Boolean); }); }
function xTableMd(t) { var rows = xTableRows(t); if (!rows.length) return ''; var n = Math.max.apply(null, rows.map(function (r) { return r.length; }));
  var line = function (r) { var c = r.slice(); while (c.length < n) c.push(''); return '| ' + c.map(function (x) { return x.replace(/\|/g, '\\|'); }).join(' | ') + ' |'; };
  return [line(rows[0]), '|' + new Array(n + 1).join(' --- |')].concat(rows.slice(1).map(line)).join('\n'); }
function xTablesCsv() {
  var ts = [].slice.call(D.querySelectorAll('table')).filter(function (t) { return t.rows.length > 1; });
  var q = function (v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return { n: ts.length, csv: ts.map(function (t) { return xTableRows(t).map(function (r) { return r.map(q).join(','); }).join('\r\n'); }).join('\r\n\r\n') };
}

/* extras set up as each page loads (Settings → Pages) */
var xInitDone = {};
function xInit(arg) {
  var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) {}
  if (!TOP) return;
  if (o.keys === 0) xKeysOn = false;
  if (o.progress && !xInitDone.progress) {
    xInitDone.progress = 1;
    var bar = D.createElement('wsb-badge');
    bar.style.cssText = 'all:initial;position:fixed;left:0;top:0;height:3px;width:0;z-index:2147483645;background:' + (/^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#e8342a') + ';pointer-events:none;transition:width .08s linear;box-shadow:0 0 8px rgba(232,52,42,.6)';
    var upd = function () { var h = D.documentElement.scrollHeight - innerHeight; bar.style.width = h > 200 ? Math.min(100, (W.scrollY || D.documentElement.scrollTop) / h * 100) + '%' : '0'; };
    W.addEventListener('scroll', upd, { passive: true }); W.addEventListener('resize', upd);
    (D.body || D.documentElement).appendChild(bar); upd();
  }
  if (o.totop && !xInitDone.totop) {
    xInitDone.totop = 1;
    var b = D.createElement('wsb-badge');
    b.style.cssText = 'all:initial;position:fixed;right:22px;bottom:22px;z-index:2147483645';
    var r = b.attachShadow({ mode: 'closed' });
    r.innerHTML = '<style>button{all:initial;width:42px;height:42px;border-radius:50%;background:rgba(24,21,28,.86);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35);opacity:0;transform:translateY(12px) scale(.9);transition:opacity .25s,transform .3s cubic-bezier(.34,1.56,.64,1);font:20px "Segoe UI",system-ui}' +
      'button.on{opacity:1;transform:none}button:hover{background:#e8342a}</style><button title="Back to top">↑</button>';
    var btn = r.querySelector('button');
    btn.onclick = function (e) { if (e.isTrusted) W.scrollTo({ top: 0, behavior: 'smooth' }); };
    W.addEventListener('scroll', function () { btn.classList.toggle('on', (W.scrollY || 0) > innerHeight * 1.5); }, { passive: true });
    (D.body || D.documentElement).appendChild(b);
  }
  if (o.hoverzoom) xHoverZoom(true);
  if (/(^|\.)youtube\.com$/.test(HOST) && (o.ytShorts || o.ytRecs) && !xInitDone.yt) {
    xInitDone.yt = 1;
    var css = '';
    if (o.ytShorts) css += 'ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts],ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),a[title="Shorts"],ytd-guide-entry-renderer:has(a[title="Shorts"]),ytd-mini-guide-entry-renderer[aria-label="Shorts"],ytd-video-renderer:has(a[href^="/shorts/"]),ytd-grid-video-renderer:has(a[href^="/shorts/"]),grid-shelf-view-model,yt-chip-cloud-chip-renderer:has([title="Shorts"]){display:none!important}';
    if (o.ytRecs) css += '#related,ytd-watch-next-secondary-results-renderer,.ytp-endscreen-content,.ytp-ce-element,ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer{display:none!important}ytd-browse[page-subtype="home"] ytd-rich-grid-renderer::before{content:"Home recommendations are hidden (Settings \\2192  Pages). Use search or your subscriptions.";display:block;padding:40px;color:#888;font:16px "Segoe UI",sans-serif}';
    var yt = new CSSStyleSheet(); try { yt.replaceSync(css); adopt(yt); } catch (e) {}
  }
}

function xTool(action, arg) {
  switch (action) {
    case 'x-gallery': xGallery(); return true;
    case 'x-links': xLinks(); return true;
    case 'x-contacts': xContacts(); return true;
    case 'x-passwords': xPasswords(); return true;
    case 'x-ruler': xRuler(); return true;
    case 'x-bionic': xBionic(); return true;
    case 'x-spotlight': xSpotlight(); return true;
    case 'x-bigtext': xBigText(); return true;
    case 'x-hoverzoom': xHoverZoom(); return true;
    case 'x-replace': xReplace(arg); return true;
    case 'x-fonts': xFonts(); return true;
    case 'x-colors': xColors(); return true;
    case 'x-a11y': xA11y(); return true;
    case 'x-grid': xGrid(); return true;
    case 'x-video': xVideoPanel(); return true;
    case 'x-frame': xFrame(+arg || 1); return true;
    case 'x-speed': xSpeedRead(); return true;
    case 'x-snow': xSnow(); return true;
    case 'x-gravity': xGravity(); return true;
    case 'x-noimg': xNoImages(); return true;
    case 'x-md': xReply({ a: 'x-md', md: xToMd(), title: D.title || L.hostname }, 'md'); return true;
    case 'x-csv': { var c = xTablesCsv(); xReply({ a: 'x-csv', csv: c.csv, n: c.n, title: D.title || L.hostname }, 'csv'); return true; }
    case 'x-text': xReply({ a: 'x-text', t: String((D.body && D.body.innerText) || ''), save: arg === 'save' ? 1 : 0, title: D.title || L.hostname }, 't'); return true;
    case 'x-ai': { var sl = ''; try { sl = String(W.getSelection() || ''); } catch (e) {} xReply({ a: 'x-ai', t: String((D.body && D.body.innerText) || '').slice(0, 60000), sel: sl.slice(0, 5000), title: D.title || L.hostname }, 't'); return true; }
    case 'x-words': xWords(); return true;
    case 'x-marks': xMarks(arg); return true;
    case 'x-calm': xCalm(); return true;
    case 'x-expand': xExpand(); return true;
    case 'x-confetti': xConfetti(); return true;
    case 'x-disco': xDisco(); return true;
    case 'x-flip': xFlip(); return true;
    case 'x-keys': xKeys(); return true;
    case 'x-laser': xLaser(); return true;
    case 'x-init': xInit(arg); return true;
    case 'x-yt': xYt(); return true;
    case 'x-fill': toolReply({ a:'x-fill', n:xFill(arg) }); return true;
    case 'x-scrollto': xScrollTo(arg); return true;
    case 'x-seek': { var sv = bestVideo(); if (sv) { sv.currentTime = Math.max(0, +arg || 0); if (sv.paused) sv.play().catch(function () {}); badge('→ ' + clock(sv.currentTime)); } return true; }
    case 'x-explain-on': xpOn = arg === '1'; if (!xpOn) xpClose(); return true;
    case 'x-explain-show': { var eo = null; try { eo = JSON.parse(arg); } catch (e) {} if (eo) xpShow(eo); return true; }
  }
  return false;
}

/* ------------------------------------------------------------------ Webs 3.10: your address in a form
   The browser window keeps it (encrypted) and hands it over only when you ask (Menu → Fill in my address,
   or Alt+Shift+F). Each box is matched by what the site says it's for (autocomplete), else its name, its
   label or its placeholder. Password and hidden boxes are never touched; what's already filled stays. */
var FILL_AC = { 'name':'name', 'given-name':'given', 'family-name':'family', 'email':'email', 'tel':'phone', 'tel-national':'phone', 'street-address':'street', 'address-line1':'street',
  'address-line2':'street2', 'address-level2':'city', 'postal-code':'postcode', 'address-level1':'state', 'country-name':'country', 'country':'country', 'organization':'company' };
var FILL_RE = [['email', /e-?mail/], ['phone', /phone|mobile|\btel\b|telephone/], ['given', /first.?name|given.?name|fname|forename/], ['family', /last.?name|surname|family.?name|lname/],
  ['postcode', /zip|postal|post.?code|postcode/], ['city', /\bcity\b|\btown\b|locality/], ['state', /\bstate\b|province|region|county/], ['country', /country/],
  ['street2', /address.?2|line.?2|apartment|\bapt\b|suite/], ['street', /address|street|addr|line.?1/], ['company', /company|organi[sz]ation/], ['name', /\bname\b|full.?name/]];
function xFill(arg) {
  var p = {}; try { p = JSON.parse(arg) || {}; } catch (e) {}
  var parts = String(p.name || '').trim().split(/\s+/);
  var v = { name:p.name, given:parts[0] || '', family:parts.length > 1 ? parts.slice(1).join(' ') : '', email:p.email, phone:p.phone, street:p.street, street2:p.street2, city:p.city,
    postcode:p.postcode, state:p.state, country:p.country, company:p.company };
  var n = 0;
  var setVal = function (el, val) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, val); else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles:true })); el.dispatchEvent(new Event('change', { bubbles:true }));
  };
  D.querySelectorAll('input,select,textarea').forEach(function (el) {
    var type = (el.type || '').toLowerCase();
    if (el.disabled || el.readOnly || /^(password|hidden|submit|button|checkbox|radio|file|image|reset|search|date|number|range|color)$/.test(type)) return;
    var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    var key = FILL_AC[String(el.getAttribute('autocomplete') || '').toLowerCase().replace(/^(shipping|billing)\s+/, '').trim()];
    if (!key) {
      var lab = (el.labels && el.labels[0] ? el.labels[0].textContent : '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '');
      lab = lab.toLowerCase(); if (/user|login|captcha|coupon|promo|search|card|cvv|code\b/.test(lab) && !/post.?code|zip/.test(lab)) return;
      if (type === 'email') key = 'email'; else if (type === 'tel') key = 'phone';
      else for (var i = 0; i < FILL_RE.length && !key; i++) if (FILL_RE[i][1].test(lab)) key = FILL_RE[i][0];
    }
    var val = key && v[key] ? String(v[key]) : '';
    if (!val) return;
    if (el.tagName === 'SELECT') {
      var lv = val.toLowerCase(), o = [].find.call(el.options, function (x) { return x.value.toLowerCase() === lv || x.text.trim().toLowerCase() === lv; }) ||
        [].find.call(el.options, function (x) { return lv.length > 2 && x.text.toLowerCase().indexOf(lv) === 0; });
      if (o && el.value !== o.value) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles:true })); n++; }
      return;
    }
    if (String(el.value || '').trim()) return;
    setVal(el, val); n++;
  });
  badge(n ? 'Filled ' + n + ' box' + (n === 1 ? '' : 'es') + ' with your details' : 'No boxes here for your address');
  return n;
}
/* scrolling by voice: the page, or the biggest box on it that scrolls (apps that scroll inside themselves) */
function xScrollTo(where) {
  var t = D.scrollingElement || D.documentElement;
  if (t.scrollHeight <= t.clientHeight + 4) {
    var e = D.elementFromPoint(W.innerWidth / 2, W.innerHeight / 2);
    while (e && e !== D.body) { var cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) { t = e; break; } e = e.parentElement; }
  }
  var h = (t === D.scrollingElement || t === D.documentElement ? W.innerHeight : t.clientHeight) * 0.8;
  var o = where === 'top' ? { top:0 } : where === 'bottom' ? { top:t.scrollHeight } : { top:(t.scrollTop || 0) + (where === 'up' ? -h : h) };
  o.behavior = 'smooth';
  if (t === D.scrollingElement || t === D.documentElement) W.scrollTo(o); else t.scrollTo(o);
}

/* ------------------------------------------------------------------ Webs 3.10: a video's captions, for Web AI
   The YouTube player's own data (on the page, or the watch page fetched again, since YouTube changes videos
   without loading a page) names the caption tracks; the best one comes back as [m:ss] lines. Without
   captions, the title and the description. */
function xYt() {
  var vid = ''; try { vid = new URLSearchParams(L.search).get('v') || ''; } catch (e) {}
  var reply = function (o) { o.a = 'x-yt'; o.title = o.title || D.title; xReply(o, 't'); };
  var go = function (pr) {
    var det = pr && pr.videoDetails || {}, title = det.title || D.title, desc = String(det.shortDescription || '').slice(0, 6000);
    var tr = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer, list = tr && tr.captionTracks || [];
    var fallback = function () { reply({ t:'', desc:desc, title:title, none:1 }); };
    if (!list.length) return fallback();
    var pick = list.filter(function (c) { return /^en/.test(c.languageCode) && c.kind !== 'asr'; })[0] || list.filter(function (c) { return /^en/.test(c.languageCode); })[0] || list[0];
    fetch(pick.baseUrl + '&fmt=json3', { credentials:'include' }).then(function (r) { return r.json(); }).then(function (j) {
      var lines = (j.events || []).filter(function (e) { return e.segs; }).map(function (e) {
        return '[' + clock(Math.floor((e.tStartMs || 0) / 1000)) + '] ' + e.segs.map(function (x) { return x.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
      }).filter(function (l) { return l.length > 9; });
      if (!lines.length) return fallback();
      reply({ t:lines.join('\n'), title:title, lang:pick.languageCode || '' });
    }).catch(fallback);
  };
  var pr = W.ytInitialPlayerResponse;
  if (pr && pr.videoDetails && pr.videoDetails.videoId === vid) return go(pr);
  fetch(L.href, { credentials:'include' }).then(function (r) { return r.text(); }).then(function (h) {
    var m = /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|<\/script)/.exec(h);
    var p = null; try { p = m ? JSON.parse(m[1]) : null; } catch (e) {}
    go(p);
  }).catch(function () { go(null); });
}

/* ------------------------------------------------------------------ Webs 3.10: Explain, next to text you select
   Select a few words and a small ✦ Explain button shows beside them. Clicking it hands the selection and
   the paragraph around it to the browser window, which asks Web AI, and the answer shows in the same
   bubble. Nothing goes anywhere unless it's clicked. Off in Settings → Web pages. */
var xpOn = false, xpHost = null, xpRoot = null, xpSel = '', xpCtx = '';
function xpClose() { if (xpHost) { xpHost.remove(); xpHost = xpRoot = null; } }
function xpPlace(r) {
  var w = Math.min(360, W.innerWidth - 16), h = xpRoot.querySelector('.w').offsetHeight || 40, vh = W.innerHeight;
  xpHost.style.left = Math.max(8, Math.min(r.left, W.innerWidth - w - 8)) + 'px';
  xpHost.style.top = (r.bottom + 8 + h > vh ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
}
function xpBubble(r) {
  xpClose();
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;top:0';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>.w{font:13px/1.5 "Segoe UI",system-ui,sans-serif;color:#f3eff1;max-width:360px;animation:in .18s ease-out}@keyframes in{from{opacity:0;transform:translateY(-4px)}}' +
    '.go{all:initial;font:600 12.5px "Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#7f5cff,#e8342a);border-radius:999px;padding:5px 12px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)}' +
    '.go:hover{filter:brightness(1.1)}.go[hidden],.a[hidden]{display:none}.a{background:rgba(24,21,28,.97);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 13px;max-height:260px;overflow:auto;box-shadow:0 12px 34px rgba(0,0,0,.5);white-space:pre-wrap}' +
    '.a b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#b9a8ff;margin-bottom:4px}.a.err{color:#ffb4ab}.more{all:initial;display:block;margin-top:8px;font:12px "Segoe UI",system-ui;color:#b9a8ff;cursor:pointer}</style>' +
    '<div class="w"><button class="go" title="Explain this with Web AI">✦ Explain</button><div class="a" hidden></div></div>';
  (D.body || D.documentElement).appendChild(host);
  xpHost = host; xpRoot = root; xpPlace(r);
  var go = root.querySelector('.go');
  go.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
  go.onclick = function (e) {
    if (!e.isTrusted) return;
    go.hidden = true;
    xpShow({ t:'Thinking…', more:1 });
    toolReply({ a:'x-explain', sel:xpSel.slice(0, 1500), ctx:xpCtx.slice(0, 3000), title:String(D.title || '').slice(0, 200) });
  };
}
function xpShow(o) {
  if (!xpRoot) return;
  var a = xpRoot.querySelector('.a'), go = xpRoot.querySelector('.go');
  go.hidden = true; a.hidden = false; a.className = 'a' + (o.err ? ' err' : '');
  a.textContent = ''; var b = D.createElement('b'); b.textContent = '✦ Web AI'; a.appendChild(b);
  a.appendChild(D.createTextNode(String(o.err || o.t || '')));
  if (!o.more && !o.err) { var m = D.createElement('button'); m.className = 'more'; m.textContent = 'Ask more in Web AI ›'; m.onclick = function (e) { if (e.isTrusted) { toolReply({ a:'x-explain-more' }); xpClose(); } }; a.appendChild(m); }
}
W.addEventListener('mouseup', function (e) {
  if (!xpOn || !TOP || !e.isTrusted || e.button !== 0) return;
  if (xpHost && e.composedPath().indexOf(xpHost) >= 0) return;
  setTimeout(function () {
    var s = W.getSelection(), t = s && s.rangeCount ? String(s).replace(/\s+/g, ' ').trim() : '';
    var ae = D.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (!t || t.split(' ').length < 2 || t.length > 1500) return;
    var range = s.getRangeAt(0), r = range.getBoundingClientRect();
    if (!r.width && !r.height) return;
    var n = range.commonAncestorContainer; if (n && n.nodeType !== 1) n = n.parentNode;
    var blk = n && n.closest ? n.closest('p,li,td,dd,blockquote,section,article,main,div') : null;
    xpSel = t; xpCtx = String(blk && blk.innerText || '').replace(/\s+/g, ' ').trim();
    xpBubble(r);
  }, 10);
}, true);
W.addEventListener('mousedown', function (e) { if (xpHost && e.composedPath().indexOf(xpHost) < 0) xpClose(); }, true);
W.addEventListener('keydown', function (e) { if (xpHost && e.key === 'Escape') xpClose(); }, true);
W.addEventListener('scroll', function () { if (xpHost && xpRoot && xpRoot.querySelector('.a').hidden) xpClose(); }, true);

/* The shell drops a page's answer when it is longer than 200,000 characters,
   so long text is cut to fit (and says so). */
function xReply(o, key) {
  var full = String(o[key] || ''), cut = false;
  o[key] = full;
  while (JSON.stringify(o).length > 190000) { o[key] = o[key].slice(0, Math.floor(o[key].length * 0.8)); cut = true; }
  if (cut) o.cut = 1;
  toolReply(o);
}

/* the words a page uses most, and how hard it is to read */
function xSyll(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  var m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1;
}
var X_STOP = ('the,a,an,and,or,but,of,to,in,on,at,for,with,by,from,as,is,are,was,were,be,been,it,its,this,that,these,those,i,you,he,she,we,they,' +
  'my,your,his,her,our,their,me,him,us,them,not,no,so,if,then,than,there,here,what,which,who,when,where,how,all,any,can,will,just,do,does,did,' +
  'has,have,had,about,into,more,also,one,would,could,should,up,out,new,other,some,only,over,after,like,may,most,very,s,t,de,la,le,et,les,des,en,un,une,der,die,das,und').split(',');
function xWords() {
  var text = String((xMain() && xMain().innerText) || '');
  var words = text.match(/[A-Za-zÀ-ɏ']+/g) || [];
  if (words.length < 20) { badge('Not enough text on this page'); return; }
  var sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length), syl = 0, count = {};
  words.forEach(function (w) { syl += xSyll(w); var k = w.toLowerCase().replace(/^'+|'+$/g, ''); if (k.length > 2 && X_STOP.indexOf(k) < 0) count[k] = (count[k] || 0) + 1; });
  var ease = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length);
  var grade = Math.max(1, Math.round(0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59));
  var lvl = ease >= 80 ? ['Easy', 'ok'] : ease >= 60 ? ['Plain English', 'ok'] : ease >= 40 ? ['Fairly hard', 'warn'] : ['Hard', 'bad'];
  var top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 40), max = count[top[0]] || 1;
  var root = xPanel('words', 'Words and reading level',
    '<div class="row" style="display:block;border:0"><b class="' + lvl[1] + '" style="font-size:18px">' + lvl[0] + '</b>' +
    '<div class="d">Reading ease ' + Math.round(Math.max(0, Math.min(100, ease))) + '/100 · about grade ' + grade + ' · ' + words.length.toLocaleString() + ' words · ' +
    sentences.toLocaleString() + ' sentences · ' + (words.length / sentences).toFixed(1) + ' words per sentence</div></div>' +
    '<div class="d" style="margin:8px 0 4px">Most used words (click one to find it)</div>' +
    top.map(function (w) { return '<div class="row" data-w="' + xEsc(w) + '" style="cursor:pointer"><div class="t">' + xEsc(w) + '</div><div style="flex:1;height:6px;border-radius:3px;background:#2c2634;overflow:hidden"><i style="display:block;height:100%;width:' +
      Math.round(count[w] / max * 100) + '%;background:#e8342a"></i></div><div class="d" style="width:34px;text-align:right">' + count[w] + '</div></div>'; }).join(''));
  if (!root) return;
  root.addEventListener('click', function (e) { var r = e.target.closest && e.target.closest('[data-w]'); if (r) xMarks(JSON.stringify([r.getAttribute('data-w')])); });
}

/* highlight every place a word appears, in a color per word */
var X_HL = ['#ffe066', '#8ce99a', '#74c0fc', '#ffa8a8', '#d0bfff', '#ffc078'], xMarked = [];
function xMarks(arg) {
  xMarked.forEach(function (m) { if (m.parentNode) m.parentNode.replaceChild(D.createTextNode(m.textContent), m); });
  xMarked = [];
  var list = []; try { list = JSON.parse(arg) || []; } catch (e) { list = String(arg || '').split(','); }
  list = list.map(function (w) { return String(w).trim(); }).filter(Boolean).slice(0, 6);
  if (!list.length) { badge('Highlights cleared'); return; }
  var re = new RegExp('(' + list.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
  var nodes = [], w = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return !p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT)$/.test(p.nodeName) || p.isContentEditable ? 2 : 1; } });
  while (w.nextNode() && nodes.length < 20000) nodes.push(w.currentNode);
  var n = 0;
  nodes.forEach(function (t) {
    var v = t.nodeValue; re.lastIndex = 0; if (!re.test(v)) return; re.lastIndex = 0;
    var frag = D.createDocumentFragment(), last = 0, m;
    while ((m = re.exec(v))) {
      frag.appendChild(D.createTextNode(v.slice(last, m.index)));
      var mk = D.createElement('mark'), i = list.findIndex(function (x) { return x.toLowerCase() === m[0].toLowerCase(); });
      mk.textContent = m[0]; mk.style.cssText = 'background:' + X_HL[Math.max(0, i) % X_HL.length] + '!important;color:#111!important;border-radius:3px;padding:0 1px';
      frag.appendChild(mk); xMarked.push(mk); n++; last = m.index + m[0].length;
    }
    frag.appendChild(D.createTextNode(v.slice(last)));
    t.parentNode.replaceChild(frag, t);
  });
  if (xMarked[0]) xMarked[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  badge(n ? n + ' match' + (n === 1 ? '' : 'es') + ' highlighted' : 'Not found on this page', null, 2200);
}

/* calm page: nothing moves */
var xCalmSheet = null;
function xCalm() {
  if (!xCalmSheet) { xCalmSheet = new CSSStyleSheet(); adopt(xCalmSheet); xCalmSheet.on = false; }
  xCalmSheet.on = !xCalmSheet.on;
  xCalmSheet.replaceSync(xCalmSheet.on ? '*,*::before,*::after{animation-play-state:paused!important;animation-delay:-1ms!important;animation-duration:1ms!important;animation-iteration-count:1!important;transition:none!important;scroll-behavior:auto!important}marquee{display:none!important}' : '');
  D.querySelectorAll('video[autoplay]').forEach(function (v) { if (xCalmSheet.on && !v.closest('[controls]') && v.muted) v.pause(); });
  badge(xCalmSheet.on ? 'Calm page: animations stopped' : 'Animations back on');
}

/* open every collapsed section */
function xExpand() {
  var n = 0;
  D.querySelectorAll('details:not([open])').forEach(function (d) { d.open = true; n++; });
  D.querySelectorAll('[aria-expanded="false"]').forEach(function (b) {
    var txt = String(b.textContent || '').toLowerCase();
    if (b.closest('nav,header,[role="menu"],[role="menubar"],[role="navigation"]')) return;
    if (/more|expand|show|read|answer|details|\+/.test(txt) && b.tagName !== 'A') { try { b.click(); n++; } catch (e) {} }
  });
  badge(n ? 'Opened ' + n + ' section' + (n === 1 ? '' : 's') : 'Nothing folded up on this page');
}

/* a little party */
function xConfetti() {
  var cv = D.createElement('canvas');
  cv.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;pointer-events:none';
  (D.body || D.documentElement).appendChild(cv);
  var g = cv.getContext('2d'), k = W.devicePixelRatio || 1, w = innerWidth, h = innerHeight; cv.width = w * k; cv.height = h * k; g.scale(k, k);
  var C = ['#e8342a', '#f5c542', '#3fb971', '#3b8bf0', '#9a63f0', '#e85aa8', '#ffffff'], P = [];
  for (var i = 0; i < 220; i++) { var a = -Math.PI / 2 + (Math.random() - .5) * 1.4, sp = 9 + Math.random() * 11, fromLeft = i % 2;
    P.push({ x: fromLeft ? w * .1 : w * .9, y: h * .95, vx: Math.cos(a) * sp * (fromLeft ? 1 : -1) * .55 + (fromLeft ? 3 : -3), vy: Math.sin(a) * sp, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, c: C[i % C.length], s: 5 + Math.random() * 6 }); }
  var t0 = performance.now();
  (function step(now) {
    g.clearRect(0, 0, w, h);
    P.forEach(function (p) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
    if (now - t0 < 4200) requestAnimationFrame(step); else cv.remove();
  })(t0);
}

/* disco: colors spin */
var xDiscoOn = null;
function xDisco() {
  if (xDiscoOn) { xDiscoOn.remove(); xDiscoOn = null; badge('Disco over'); return; }
  var s = D.createElement('style');
  s.textContent = '@keyframes wsbDisco{to{filter:hue-rotate(360deg) saturate(1.6)}}html{animation:wsbDisco 2.4s linear infinite!important}';
  (D.head || D.documentElement).appendChild(s); xDiscoOn = s;
  badge('Disco mode - run it again to stop');
}

/* the whole page upside down */
var xFlipped = false;
function xFlip() {
  xFlipped = !xFlipped;
  D.documentElement.style.setProperty('transition', 'transform .8s cubic-bezier(.6,-0.3,.3,1.3)', 'important');
  D.documentElement.style.setProperty('transform', xFlipped ? 'rotate(180deg)' : '', xFlipped ? 'important' : '');
  if (!xFlipped) D.documentElement.style.removeProperty('transform');
  badge(xFlipped ? 'Upside down! Run it again to flip back' : 'The right way up again');
}

/* keys you press, shown on screen (for recording a how-to) */
var xKeyHost = null;
function xKeys() {
  if (xKeyHost) { xKeyHost.off(); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;pointer-events:none';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>div{display:flex;gap:8px}b{font:600 22px "Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(20,17,24,.88);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 14px;box-shadow:0 8px 22px rgba(0,0,0,.4);animation:k .18s cubic-bezier(.3,1.5,.6,1)}@keyframes k{from{transform:scale(.6);opacity:0}}</style><div></div>';
  var box = root.querySelector('div');
  var key = function (e) {
    if (!e.isTrusted) return;
    var parts = []; if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey && e.key.length > 1) parts.push('Shift'); if (e.metaKey) parts.push('Win');
    var k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key.replace('Arrow', '');
    if (/^(Control|Alt|Shift|Meta)$/.test(e.key)) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && box.lastChild && box.lastChild.dataset.t && box.children.length) { box.lastChild.textContent += k === 'Space' ? ' ' : e.key; clearTimeout(box.lastChild.t); box.lastChild.t = setTimeout(rm(box.lastChild), 1800); return; }
    var b = D.createElement('b'); b.textContent = parts.concat([k]).join(' + '); if (e.key.length === 1 && !e.ctrlKey && !e.altKey) b.dataset.t = 1;
    box.appendChild(b); while (box.children.length > 4) box.firstChild.remove();
    b.t = setTimeout(rm(b), 1800);
  };
  var rm = function (b) { return function () { b.remove(); }; };
  var off = function () { host.remove(); W.removeEventListener('keydown', key, true); xKeyHost = null; badge('Key display off'); };
  W.addEventListener('keydown', key, true);
  (D.body || D.documentElement).appendChild(host);
  xKeyHost = { off: off };
  badge('Key display on - run it again to stop');
}

/* a laser pointer for showing a page to others */
var xLaserHost = null;
function xLaser() {
  if (xLaserHost) { xLaserHost.off(); return; }
  var cv = D.createElement('canvas');
  cv.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;pointer-events:none';
  (D.body || D.documentElement).appendChild(cv);
  var g = cv.getContext('2d'), trail = [], raf = 0;
  var mv = function (e) { trail.push({ x: e.clientX, y: e.clientY, t: performance.now() }); };
  var draw = function (now) {
    var k = W.devicePixelRatio || 1; if (cv.width !== innerWidth * k) { cv.width = innerWidth * k; cv.height = innerHeight * k; }
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
    trail = trail.filter(function (p) { return now - p.t < 450; });
    for (var i = 1; i < trail.length; i++) { var a = 1 - (now - trail[i].t) / 450; g.strokeStyle = 'rgba(255,40,40,' + a * .8 + ')'; g.lineWidth = 2 + a * 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(trail[i - 1].x, trail[i - 1].y); g.lineTo(trail[i].x, trail[i].y); g.stroke(); }
    var p = trail[trail.length - 1];
    if (p) { var rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16); rg.addColorStop(0, 'rgba(255,60,60,1)'); rg.addColorStop(.35, 'rgba(255,30,30,.7)'); rg.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p.x, p.y, 16, 0, 7); g.fill(); }
    raf = requestAnimationFrame(draw);
  };
  var key = function (e) { if (e.key === 'Escape') off(); };
  var off = function () { cancelAnimationFrame(raf); cv.remove(); W.removeEventListener('mousemove', mv, true); W.removeEventListener('keydown', key, true); xLaserHost = null; };
  W.addEventListener('mousemove', mv, true); W.addEventListener('keydown', key, true);
  raf = requestAnimationFrame(draw);
  xLaserHost = { off: off };
  badge('Laser pointer on - Esc to stop');
}

/* The shell only passes a fixed set of shortcuts on while a page has the
   keyboard, so the new ones are caught here, from real key presses only, and
   handed to the browser the same way mouse gestures are. */
var X_KEYS = 'ABEGRUXZ', xKeysOn = true;
W.addEventListener('keydown', function (e) {
  if (!xKeysOn || !e.isTrusted || !TOP || e.ctrlKey || e.metaKey || !e.altKey) return;
  var k = '';
  if (e.code === 'Backquote' && !e.shiftKey) k = '`';
  else if (e.shiftKey && /^Key[A-Z]$/.test(e.code) && X_KEYS.indexOf(e.code.slice(3)) >= 0) k = e.code.slice(3);
  if (!k) return;
  e.preventDefault(); e.stopImmediatePropagation();
  post('tool', { a: 'x-key', k: k });
}, true);
