/* Web Studios Shield - the part that runs inside web pages.

   The shell registers this file with every tab so that it runs in every frame
   BEFORE the page's own scripts. Two placeholders are filled in at that point:

     CFG  feature switches (cosmetic hiding, YouTube, cookie banners, GPC)
     G    the generic hiding selectors from the enabled filter lists

   Everything site-specific arrives a moment later in a second, much smaller
   script (the "payload") that the shell builds for the host being loaded:
   selectors to hide on this site, procedural filters, scriptlets, and a token.
   The two meet through a Symbol-keyed function on window; see receive().

   Besides blocking, this file carries the page-side tools that must work even
   with Shield off: video controls and picture-in-picture, "continue watching",
   SponsorBlock, dark mode for every site, fingerprint protection and the
   VPN's WebRTC guard.

   The token is the only way a page can talk to the shell, and only this code
   holds it (inside this closure). It carries a handful of harmless messages:
   video progress, SponsorBlock lookups, a screenshot area. */
(function () {
'use strict';
var W = window, D = document, L = location;
var HOST = L.hostname || '';
if (HOST === 'browser.example') return;
// Kept before fingerprint protection or the page can replace them.
var DRAW0 = CanvasRenderingContext2D.prototype.drawImage;
var GID0 = CanvasRenderingContext2D.prototype.getImageData;
var TDU0 = HTMLCanvasElement.prototype.toDataURL;

var CFG = /*@CFG@*/{};
var G = /*@G@*/[];

var TOP = (function () { try { return W === W.top; } catch (e) { return false; } })();
function site(h) { var p = String(h).split('.'); return p.length > 2 ? p.slice(-2).join('.') : String(h); }
var SAME_SITE = TOP || (function () {
  try {
    var a = L.ancestorOrigins;
    if (!a || !a.length || !HOST) return true;
    return site(new URL(a[a.length - 1]).hostname) === site(HOST);
  } catch (e) { return true; }
})();

/* ------------------------------------------------------------------ shell channel
   postMessage is captured now, before any page script can replace it. */
var PM = null, TOKEN = '';
try { var wvo = W.chrome && W.chrome.webview; if (wvo && wvo.postMessage) PM = wvo.postMessage.bind(wvo); } catch (e) {}
function post(cmd, data) {
  if (!TOKEN || !PM) return;
  try { PM('wsb-page\u0001' + TOKEN + '\u0001' + cmd + '\u0001' + JSON.stringify(data || {})); } catch (e) {}
}

/* ------------------------------------------------------------------ privacy signal */
if (CFG.gpc) {
  try {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl',
      { configurable: true, enumerable: true, get: function () { return true; } });
  } catch (e) {}
}

/* ------------------------------------------------------------------ VPN: WebRTC guard
   WebRTC talks to the network over UDP, which cannot go through the VPN, and
   would show a site your real address. While the VPN is on it is switched off. */
if (CFG.vpn) {
  ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel'].forEach(function (n) {
    try { Object.defineProperty(W, n, { configurable: true, writable: true, value: undefined }); } catch (e) {}
  });
}

/* ------------------------------------------------------------------ fingerprint protection
   Sites combine small hardware details into an ID that survives clearing
   cookies. These answers are made common, and canvas reads get a faint noise
   that changes with every session, so no stable ID can be built from them. */
if (CFG.fp) {
  var def = function (o, k, v) { try { Object.defineProperty(o, k, { configurable: true, get: function () { return v; } }); } catch (e) {} };
  def(Navigator.prototype, 'hardwareConcurrency', 4);
  def(Navigator.prototype, 'deviceMemory', 8);
  try { Navigator.prototype.getBattery = undefined; } catch (e) {}
  var seed = (Math.random() * 4294967296) >>> 0;
  var noise = function (data) {
    var s = seed;
    for (var i = 0; i < data.length; i += 4 * 97) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i + (s & 3) % 3] ^= 1;
    }
  };
  try {
    var gid = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function () {
      var r = gid.apply(this, arguments);
      try { noise(r.data); } catch (e) {}
      return r;
    };
    var tdu = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      try {
        if (this.width * this.height <= 4000000) {
          var c = D.createElement('canvas'); c.width = this.width; c.height = this.height;
          var x = c.getContext('2d'); x.drawImage(this, 0, 0);
          var im = gid.call(x, 0, 0, c.width, c.height); noise(im.data); x.putImageData(im, 0, 0);
          return tdu.apply(c, arguments);
        }
      } catch (e) {}
      return tdu.apply(this, arguments);
    };
    [WebGLRenderingContext, W.WebGL2RenderingContext].forEach(function (G2) {
      if (!G2) return;
      var gp = G2.prototype.getParameter;
      G2.prototype.getParameter = function (p) {
        if (p === 37445) return 'Google Inc.';
        if (p === 37446) return 'ANGLE (Generic GPU)';
        return gp.apply(this, arguments);
      };
    });
  } catch (e) {}
}

// Remembers what was right-clicked, so "Block element..." can start from it.
D.addEventListener('contextmenu', function (e) {
  try { W[Symbol.for('wsb.ctx')] = e.target; } catch (x) {}
}, true);

/* ------------------------------------------------------------------ stylesheets
   Constructed stylesheets are used instead of <style> elements because a page's
   Content-Security-Policy cannot block them, and they never appear in the DOM. */
var sheets = [];
var HIDE = '{display:none!important}';
var MARK = 'wsb-' + Math.random().toString(36).slice(2, 8);

function sheetOf(rules) {
  var s = new CSSStyleSheet();
  for (var i = 0; i < rules.length; i++) {
    try { s.insertRule(rules[i], s.cssRules.length); } catch (e) {}
  }
  return s;
}
function hideRules(list) {
  // 100 selectors per rule keeps the rule count low. One bad selector voids its
  // whole rule, so a rule that fails is retried one selector at a time.
  var s = new CSSStyleSheet(), n = 0;
  for (var i = 0; i < list.length; i += 100) {
    var chunk = list.slice(i, i + 100);
    try { s.insertRule(chunk.join(',') + HIDE, s.cssRules.length); n += chunk.length; }
    catch (e) {
      for (var j = 0; j < chunk.length; j++) {
        try { s.insertRule(chunk[j] + HIDE, s.cssRules.length); n++; } catch (e2) {}
      }
    }
  }
  return s;
}
function adopt(s) { sheets.push(s); attach(); }
function attach() {
  try {
    var cur = Array.prototype.slice.call(D.adoptedStyleSheets || []);
    var add = sheets.filter(function (s) { return cur.indexOf(s) < 0; });
    if (add.length) D.adoptedStyleSheets = cur.concat(add);
  } catch (e) {}
}
// A page that assigns document.adoptedStyleSheets wholesale would drop ours.
D.addEventListener('DOMContentLoaded', attach);
W.addEventListener('load', attach);
adopt(sheetOf(['[' + MARK + ']' + HIDE]));

/* ------------------------------------------------------------------ helpers */
function toRe(s, flags) {
  var m = /^\/(.+)\/([dgimsuvy]*)$/.exec(s);
  if (m) { try { return new RegExp(m[1], m[2]); } catch (e) {} }
  return new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags || '');
}
// uBO needle: "" matches everything, "!x" negates, "/re/" is a regular expression.
function needle(s, exact) {
  s = s == null ? '' : String(s);
  if (s === '' || s === '*') return function () { return true; };
  var neg = false;
  if (s.charAt(0) === '!') { neg = true; s = s.slice(1); }
  var re = /^\/.+\/[dgimsuvy]*$/.test(s) ? toRe(s)
         : exact ? new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') : toRe(s);
  return function (t) { var r = re.test(String(t)); return neg ? !r : r; };
}
function fnText(f) {
  try { return typeof f === 'function' ? Function.prototype.toString.call(f) : String(f); }
  catch (e) { return ''; }
}
function onReady(fn) {
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}
function watch(fn, ms) {
  // Re-run fn as the page changes, at most once per animation frame.
  var queued = false;
  var mo = new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; try { fn(); } catch (e) {} });
  });
  onReady(function () {
    try { fn(); } catch (e) {}
    mo.observe(D.documentElement || D, { childList: true, subtree: true });
    if (ms) setTimeout(function () { mo.disconnect(); }, ms);
  });
  return mo;
}

/* Walks a dotted property chain ("a.b.c") from window and calls leaf(owner,
   prop) on the last link - even when the intermediate objects do not exist
   yet, by trapping their assignment. This is how uBlock's scriptlets reach
   globals that a page is about to create. */
function trap(chain, leaf) {
  chain = String(chain).replace(/^window\./, '');
  var go = function (owner, rest) {
    var i = rest.indexOf('.');
    if (i < 0) { leaf(owner, rest); return; }
    var prop = rest.slice(0, i), next = rest.slice(i + 1), v;
    try { v = owner[prop]; } catch (e) { return; }
    if (v !== null && (typeof v === 'object' || typeof v === 'function')) { go(v, next); return; }
    var d = Object.getOwnPropertyDescriptor(owner, prop);
    if (d && d.configurable === false) return;
    var cur = v;
    try {
      Object.defineProperty(owner, prop, {
        configurable: true, enumerable: true,
        get: function () { return cur; },
        set: function (a) {
          cur = a;
          if (a !== null && (typeof a === 'object' || typeof a === 'function')) go(a, next);
        }
      });
    } catch (e) {}
  };
  go(W, chain);
}

/* ------------------------------------------------------------------ scriptlets
   Faithful-enough re-implementations of the uBlock Origin scriptlets that the
   filter lists use most. Names and argument order match uBlock's, so rules from
   EasyList / uBlock filters work unchanged. */
var INVALID = {};
function constant(raw, trusted) {
  switch (raw) {
    case 'undefined': return undefined;
    case 'false': return false;
    case 'true': return true;
    case 'null': return null;
    case "''": case '""': case '': case 'emptyStr': return '';
    case '[]': case 'emptyArr': return [];
    case '{}': case 'emptyObj': return {};
    case 'noopFunc': return function () {};
    case 'trueFunc': return function () { return true; };
    case 'falseFunc': return function () { return false; };
    case 'throwFunc': return function () { throw new Error(''); };
    case 'noopCallbackFunc': return function () { return function () {}; };
    case 'NaN': return NaN;
    case 'Infinity': return Infinity;
    case 'yes': return 'yes';
    case 'no': return 'no';
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (trusted) {
    try { return JSON.parse(raw); } catch (e) {}
    return raw;
  }
  return INVALID;
}

var SL = {};

SL.set = function (chain, raw, as, trusted) {
  if (!chain) return;
  var v = constant(raw == null ? '' : String(raw), trusted);
  if (v === INVALID) return;
  if (as === 'asFunction') { var v1 = v; v = function () { return v1; }; }
  else if (as === 'asCallback') { var v2 = v; v = function () { return function () { return v2; }; }; }
  else if (as === 'asResolved') v = Promise.resolve(v);
  else if (as === 'asRejected') { v = Promise.reject(v); v.catch(function () {}); }
  trap(chain, function (owner, prop) {
    var d = Object.getOwnPropertyDescriptor(owner, prop);
    if (d && d.configurable === false) { try { owner[prop] = v; } catch (e) {} return; }
    try {
      Object.defineProperty(owner, prop, {
        configurable: true, enumerable: d ? d.enumerable : true,
        get: function () { return v; }, set: function () {}
      });
    } catch (e) {}
  });
};
SL['trusted-set'] = function (chain, raw, as) { SL.set(chain, raw, as, true); };

function thrower(tag) { return new ReferenceError(tag + Math.random().toString(36).slice(2)); }

SL.aopr = function (chain) {
  trap(chain, function (owner, prop) {
    try {
      Object.defineProperty(owner, prop, { configurable: true,
        get: function () { throw thrower('aopr'); }, set: function () {} });
    } catch (e) {}
  });
};
SL.aopw = function (chain) {
  trap(chain, function (owner, prop) {
    var v = owner[prop];
    try {
      Object.defineProperty(owner, prop, { configurable: true,
        get: function () { return v; }, set: function () { throw thrower('aopw'); } });
    } catch (e) {}
  });
};

// abort-current-script: throw when the property is touched by a script whose
// text (or src) matches the needle.
SL.acs = function (chain, pattern) {
  if (!chain) return;
  var test = pattern ? needle(pattern) : null;
  var me = D.currentScript;
  var check = function () {
    var s = D.currentScript;
    if (!(s instanceof HTMLScriptElement) || s === me) return;
    if (!test) throw thrower('acs');
    var text = s.src || s.textContent || '';
    if (test(text)) throw thrower('acs');
  };
  trap(chain, function (owner, prop) {
    var d = Object.getOwnPropertyDescriptor(owner, prop) || {};
    var val = owner[prop];
    try {
      Object.defineProperty(owner, prop, {
        configurable: true,
        get: function () { check(); return d.get ? d.get.call(this) : val; },
        set: function (a) { check(); if (d.set) d.set.call(this, a); else val = a; }
      });
    } catch (e) {}
  });
};

// abort-on-stack-trace: the same, but judged on the calling stack.
SL.aost = function (chain, pattern) {
  if (!chain) return;
  var test = needle(pattern || '');
  var check = function () {
    var st = new Error().stack || '';
    if (test(st.split('\n').slice(2).join('\n'))) throw thrower('aost');
  };
  trap(chain, function (owner, prop) {
    var d = Object.getOwnPropertyDescriptor(owner, prop) || {};
    var val = owner[prop];
    try {
      Object.defineProperty(owner, prop, {
        configurable: true,
        get: function () { check(); return d.get ? d.get.call(this) : val; },
        set: function (a) { check(); if (d.set) d.set.call(this, a); else val = a; }
      });
    } catch (e) {}
  });
};

// no-window-open-if: popups whose URL matches get a harmless stand-in window.
SL.nowoif = function (pattern) {
  var test = needle(pattern || '');
  var orig = W.open;
  W.open = new Proxy(orig, {
    apply: function (target, self, args) {
      var url = String(args[0] || '');
      if (!test(url)) return Reflect.apply(target, self, args);
      var fake = {
        closed: false, opener: W, name: '', frames: [], length: 0,
        close: function () { this.closed = true; }, focus: function () {}, blur: function () {},
        postMessage: function () {}, addEventListener: function () {}, removeEventListener: function () {},
        location: { href: url, assign: function () {}, replace: function () {}, reload: function () {} },
        document: D.implementation.createHTMLDocument('')
      };
      fake.window = fake.self = fake;
      return fake;
    }
  });
};

function timerDefuser(name, pattern, delay) {
  if ((pattern == null || pattern === '') && (delay == null || delay === '')) return;
  var test = needle(pattern || '');
  var d = delay == null || delay === '' ? null : String(delay), dneg = false;
  if (d && d.charAt(0) === '!') { dneg = true; d = d.slice(1); }
  var dn = d === null ? null : parseInt(d, 10);
  W[name] = new Proxy(W[name], {
    apply: function (target, self, args) {
      var hit = test(fnText(args[0]));
      if (dn !== null) { var same = Number(args[1]) === dn; hit = hit && (dneg ? !same : same); }
      if (hit) { args = Array.prototype.slice.call(args); args[0] = function () {}; }
      return Reflect.apply(target, self, args);
    }
  });
}
SL.nostif = function (p, d) { timerDefuser('setTimeout', p, d); };
SL.nosiif = function (p, d) { timerDefuser('setInterval', p, d); };

function timerBooster(name, pattern, delay, boost) {
  var test = needle(pattern || '');
  var dn = delay == null || delay === '' ? 1000 : delay === '*' ? -1 : parseInt(delay, 10);
  var b = boost == null || boost === '' ? 0.05 : parseFloat(boost);
  if (!(b >= 0.001 && b <= 50)) b = 0.05;
  W[name] = new Proxy(W[name], {
    apply: function (target, self, args) {
      if ((dn === -1 || Number(args[1]) === dn) && test(fnText(args[0]))) {
        args = Array.prototype.slice.call(args);
        args[1] = Number(args[1]) * b;
      }
      return Reflect.apply(target, self, args);
    }
  });
}
SL['nano-sib'] = function (p, d, b) { timerBooster('setInterval', p, d, b); };
SL['nano-stb'] = function (p, d, b) { timerBooster('setTimeout', p, d, b); };

SL.aeld = function (type, pattern) {
  if ((type == null || type === '') && (pattern == null || pattern === '')) return;
  var tt = needle(type || '', true), tp = needle(pattern || '');
  var proto = EventTarget.prototype;
  proto.addEventListener = new Proxy(proto.addEventListener, {
    apply: function (target, self, args) {
      var h = args[1], hs = '';
      if (typeof h === 'function') hs = fnText(h);
      else if (h && typeof h.handleEvent === 'function') hs = fnText(h.handleEvent);
      if (tt(String(args[0])) && tp(hs)) return;
      return Reflect.apply(target, self, args);
    }
  });
};

SL.noeval = function () { SL['noeval-if'](''); };
SL['noeval-if'] = function (pattern) {
  var test = needle(pattern || '');
  W.eval = new Proxy(W.eval, {
    apply: function (target, self, args) {
      if (test(String(args[0]))) return;
      return Reflect.apply(target, self, args);
    }
  });
};

SL['call-nothrow'] = function (chain) {
  trap(chain, function (owner, prop) {
    var f = owner[prop];
    if (typeof f !== 'function') return;
    owner[prop] = new Proxy(f, { apply: function (t, s, a) { try { return Reflect.apply(t, s, a); } catch (e) {} } });
  });
};

SL.nowebrtc = function () {
  var fake = function () {
    return { close: function () {}, createDataChannel: function () { return { close: function () {} }; },
      createOffer: function () { return Promise.reject(new Error('')); },
      setLocalDescription: function () { return Promise.resolve(); },
      setRemoteDescription: function () { return Promise.resolve(); },
      addEventListener: function () {}, removeEventListener: function () {}, addIceCandidate: function () {} };
  };
  ['RTCPeerConnection', 'webkitRTCPeerConnection'].forEach(function (n) {
    if (W[n]) try { W[n] = fake; } catch (e) {}
  });
};

var SAFE = /^(true|false|yes|y|no|n|ok|on|off|accept|accepted|reject|rejected|allow|allowed|deny|denied|dismiss|dismissed|necessary|required|approved|disapproved|hide|hidden|essential|nonessential|checked|unchecked|forbidden|forever|-?\d{1,6}|)$/i;
SL['set-cookie'] = function (name, value, path) {
  if (!name || !SAFE.test(value || '')) return;
  var cur = '; ' + D.cookie;
  if (cur.indexOf('; ' + encodeURIComponent(name) + '=' + value + ';') >= 0) return;
  try { D.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value || '') + '; path=' + (path === 'none' ? '' : (path || '/')); } catch (e) {}
};
function storageItem(which, key, value) {
  if (!key) return;
  var st; try { st = W[which]; } catch (e) { return; }
  if (!st) return;
  try {
    if (value === '$remove$') { st.removeItem(key); return; }
    if (value === 'emptyArr') value = '[]';
    else if (value === 'emptyObj') value = '{}';
    else if (value === 'undefined') { st.removeItem(key); return; }
    if (!SAFE.test(value || '') && value !== '[]' && value !== '{}' && value !== 'null') return;
    st.setItem(key, value || '');
  } catch (e) {}
}
SL['set-local-storage-item'] = function (k, v) { storageItem('localStorage', k, v); };
SL['set-session-storage-item'] = function (k, v) { storageItem('sessionStorage', k, v); };
SL['cookie-remover'] = function (pattern) {
  if (!pattern) return;
  var test = needle(pattern);
  var run = function () {
    D.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (!n || !test(n)) return;
      var h = L.hostname.split('.');
      for (var i = 0; i < h.length - 1; i++) {
        var dom = h.slice(i).join('.');
        D.cookie = n + '=; Max-Age=-1000; path=/; domain=' + dom;
        D.cookie = n + '=; Max-Age=-1000; path=/';
      }
    });
  };
  run(); W.addEventListener('beforeunload', run);
};

// remove-node-text / replace-node-text. MutationObserver callbacks run before a
// parser-inserted inline script executes, so a matching script is emptied (or
// rewritten) before it ever runs.
function nodeText(nodeName, pattern, repl, replace) {
  if (!nodeName || !pattern) return;
  var nm = needle(nodeName.toLowerCase(), true), re = toRe(pattern, 'gms');
  if (!re.global) re = new RegExp(re.source, re.flags + 'g');
  var fix = function (n) {
    if (!n || !nm(n.nodeName.toLowerCase())) return;
    var t = n.textContent;
    re.lastIndex = 0;
    if (!re.test(t)) return;
    re.lastIndex = 0;
    n.textContent = replace ? t.replace(re, repl || '') : '';
  };
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var add = muts[i].addedNodes;
      for (var j = 0; j < add.length; j++) {
        var n = add[j];
        if (n.nodeType === 3 && n.parentNode) fix(n.parentNode);
        fix(n);
      }
    }
  });
  mo.observe(D, { childList: true, subtree: true });
  if (/^[a-z]+$/.test(nodeName)) onReady(function () {
    try { D.querySelectorAll(nodeName).forEach(fix); } catch (e) {}
  });
}
SL.rmnt = function (n, p) { nodeText(n, p, '', false); };
SL.rpnt = function (n, p, r) { nodeText(n, p, r, true); };

function attrSweep(list, selector, behavior, fn) {
  if (!list) return;
  var names = String(list).split(/\s*\|\s*/).filter(Boolean);
  var sel = selector || names.map(function (a) { return '[' + a + ']'; }).join(',');
  var run = function () {
    var els; try { els = D.querySelectorAll(sel); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) fn(els[i], names);
  };
  var b = String(behavior || '');
  if (b.indexOf('asap') >= 0) run();
  watch(run, b.indexOf('stay') >= 0 ? 0 : 15000);
}
SL.ra = function (attrs, selector, behavior) {
  attrSweep(attrs, selector, behavior, function (el, names) {
    names.forEach(function (a) { try { el.removeAttribute(a); } catch (e) {} });
  });
};
SL.rc = function (classes, selector, behavior) {
  attrSweep(classes, selector || String(classes).split(/\s*\|\s*/).map(function (c) { return '.' + c; }).join(','),
    behavior, function (el, names) { names.forEach(function (c) { el.classList.remove(c); }); });
};

SL.nobab = function () {
  var F = function () {};
  F.prototype.check = F.prototype.emitEvent = F.prototype.clearEvent = F.prototype.setOption = function () { return this; };
  F.prototype.onDetected = function () { return this; };
  F.prototype.onNotDetected = function (fn) { try { fn(); } catch (e) {} return this; };
  try { W.BlockAdBlock = F; W.blockAdBlock = new F(); } catch (e) {}
};
SL.nofab = function () {
  var F = function () {};
  F.prototype.check = F.prototype.emitEvent = F.prototype.clearEvent = F.prototype.setOption = function () { return this; };
  F.prototype.onDetected = function () { return this; };
  F.prototype.onNotDetected = function (fn) { try { fn(); } catch (e) {} return this; };
  try { W.FuckAdBlock = W.SniffAdBlock = F; W.fuckAdBlock = W.sniffAdBlock = new F(); } catch (e) {}
};
SL['popads-dummy'] = function () {
  try { delete W.PopAds; delete W.popns; } catch (e) {}
  try { Object.defineProperties(W, { PopAds: { value: {} }, popns: { value: {} } }); } catch (e) {}
};
SL['window.close-if'] = function (pattern) {
  if (needle(pattern || '')(L.href)) try { W.close(); } catch (e) {}
};

/* --- JSON pruning. Paths are dotted; "[]" and "*" match every element or key,
   and "[-]" removes the array element that contains the rest of the path. */
function walk(o, segs, i, remove) {
  if (o === null || typeof o !== 'object') return false;
  var s = segs[i], last = i === segs.length - 1, any = false, k;
  if (s === '[]' || s === '*') {
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      if (last) { if (remove) delete o[k]; any = true; }
      else if (walk(o[k], segs, i + 1, remove)) any = true;
    }
    return any;
  }
  if (s === '[-]') {
    if (!Array.isArray(o)) return false;
    for (k = o.length - 1; k >= 0; k--) {
      if (last || walk(o[k], segs, i + 1, false)) { if (remove) o.splice(k, 1); any = true; }
    }
    return any;
  }
  if (!Object.prototype.hasOwnProperty.call(o, s)) return false;
  if (last) { if (remove) delete o[s]; return true; }
  return walk(o[s], segs, i + 1, remove);
}
function pruner(prunePaths, needPaths) {
  var P = String(prunePaths || '').split(/\s+/).filter(Boolean).map(function (p) { return p.split('.'); });
  var N = String(needPaths || '').split(/\s+/).filter(Boolean).map(function (p) { return p.split('.'); });
  if (!P.length) return null;
  return function (obj) {
    if (obj === null || typeof obj !== 'object') return false;
    for (var i = 0; i < N.length; i++) if (!walk(obj, N[i], 0, false)) return false;
    var hit = false;
    for (var j = 0; j < P.length; j++) if (walk(obj, P[j], 0, true)) hit = true;
    return hit;
  };
}
// Extra scriptlet arguments come as name/value pairs: "propsToMatch, /player?/".
function extras(args, from) {
  var o = {};
  for (var i = from; i + 1 < args.length; i += 2) o[args[i]] = args[i + 1];
  return o;
}
// "url:/x/ method:POST" or a bare needle, which means url.
function propsMatcher(spec) {
  if (spec == null || spec === '') return function () { return true; };
  var tests = [];
  String(spec).split(/\s+(?=\w+:)/).forEach(function (part) {
    var m = /^(\w+):(.*)$/.exec(part);
    if (m && m[1] !== 'http' && m[1] !== 'https') tests.push([m[1], needle(m[2])]);
    else tests.push(['url', needle(part)]);
  });
  return function (d) {
    for (var i = 0; i < tests.length; i++) {
      var v = d[tests[i][0]];
      if (v === undefined || !tests[i][1](v)) return false;
    }
    return true;
  };
}

var jsonPruners = [];
function installJsonParse() {
  if (installJsonParse.done) return;
  installJsonParse.done = true;
  JSON.parse = new Proxy(JSON.parse, {
    apply: function (target, self, args) {
      var r = Reflect.apply(target, self, args);
      for (var i = 0; i < jsonPruners.length; i++) try { jsonPruners[i](r); } catch (e) {}
      return r;
    }
  });
  var RJ = Response.prototype.json;
  Response.prototype.json = new Proxy(RJ, {
    apply: function (target, self, args) {
      return Reflect.apply(target, self, args).then(function (r) {
        for (var i = 0; i < jsonPruners.length; i++) try { jsonPruners[i](r); } catch (e) {}
        return r;
      });
    }
  });
}
SL['json-prune'] = function (prune, need) {
  var p = pruner(prune, need);
  if (!p) return;
  jsonPruners.push(p);
  installJsonParse();
};

/* --- fetch and XHR hooks, shared by every scriptlet that edits or fakes a
   response. Rules: { match(details), block, body, edit(text) }. */
var fetchRules = [], xhrRules = [];
function details(url, method, body) {
  var u = String(url || '');
  try { u = new URL(u, L.href).href; } catch (e) {}
  return { url: u, method: String(method || 'GET').toUpperCase(), body: body == null ? '' : String(body) };
}
function fakeBody(kind) {
  if (kind === 'true') return 'true';
  if (kind === 'emptyObj' || kind === '{}') return '{}';
  if (kind === 'emptyArr' || kind === '[]') return '[]';
  return '';
}
function installFetch() {
  if (installFetch.done || typeof W.fetch !== 'function') return;
  installFetch.done = true;
  W.fetch = new Proxy(W.fetch, {
    apply: function (target, self, args) {
      var d;
      try {
        var a0 = args[0];
        if (a0 instanceof Request) d = details(a0.url, a0.method, '');
        else d = details(a0, args[1] && args[1].method, args[1] && args[1].body);
      } catch (e) { return Reflect.apply(target, self, args); }
      var rules = fetchRules.filter(function (r) { try { return r.match(d); } catch (e) { return false; } });
      if (!rules.length) return Reflect.apply(target, self, args);
      for (var i = 0; i < rules.length; i++) {
        if (rules[i].block) {
          var fr = new Response(fakeBody(rules[i].body), { status: 200, statusText: 'OK' });
          try { Object.defineProperty(fr, 'url', { value: d.url }); } catch (e) {}
          return Promise.resolve(fr);
        }
      }
      return Reflect.apply(target, self, args).then(function (resp) {
        return resp.clone().text().then(function (text) {
          var out = text;
          rules.forEach(function (r) { if (r.edit) try { out = r.edit(out); } catch (e) {} });
          if (out === text) return resp;
          var nr = new Response(out, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
          try {
            Object.defineProperties(nr, { url: { value: resp.url }, type: { value: resp.type },
              redirected: { value: resp.redirected } });
          } catch (e) {}
          return nr;
        }, function () { return resp; });
      });
    }
  });
}
function installXhr() {
  if (installXhr.done || typeof W.XMLHttpRequest !== 'function') return;
  installXhr.done = true;
  var X = W.XMLHttpRequest, info = new WeakMap();
  var NX = class extends X {
    open(method, url) {
      var d = details(url, method);
      info.set(this, { d: d, rules: xhrRules.filter(function (r) { try { return r.match(d); } catch (e) { return false; } }) });
      return super.open.apply(this, arguments);
    }
    send(body) {
      var i = info.get(this);
      if (i) {
        i.d.body = body == null ? '' : String(body);
        for (var k = 0; k < i.rules.length; k++) {
          if (!i.rules[k].block) continue;
          var self = this, text = fakeBody(i.rules[k].body);
          try {
            Object.defineProperties(this, {
              readyState: { value: 4 }, status: { value: 200 }, statusText: { value: 'OK' },
              responseURL: { value: i.d.url }, responseText: { value: text },
              response: { value: this.responseType === 'json' ? (text ? JSON.parse(text) : null) : text }
            });
          } catch (e) {}
          setTimeout(function () {
            ['readystatechange', 'load', 'loadend'].forEach(function (t) {
              try { self.dispatchEvent(new Event(t)); } catch (e) {}
            });
          }, 1);
          return;
        }
      }
      return super.send.apply(this, arguments);
    }
    get responseText() {
      var t = super.responseText, i = info.get(this);
      if (!i || this.readyState !== 4 || !i.rules.some(function (r) { return r.edit; })) return t;
      if (i.cache !== undefined && i.src === t) return i.cache;
      var out = t;
      i.rules.forEach(function (r) { if (r.edit) try { out = r.edit(out); } catch (e) {} });
      i.src = t; i.cache = out;
      return out;
    }
    get response() {
      var rt = this.responseType;
      if (rt !== '' && rt !== 'text' && rt !== 'json') return super.response;
      var i = info.get(this);
      if (!i || this.readyState !== 4 || !i.rules.some(function (r) { return r.edit; })) return super.response;
      if (rt === 'json') {
        var raw = super.response, text;
        try { text = JSON.stringify(raw); } catch (e) { return raw; }
        var out = text;
        i.rules.forEach(function (r) { if (r.edit) try { out = r.edit(out); } catch (e) {} });
        try { return out === text ? raw : JSON.parse(out); } catch (e) { return raw; }
      }
      return this.responseText;
    }
  };
  W.XMLHttpRequest = NX;
}
SL['no-fetch-if'] = function (props, body) {
  if (props == null || props === '') return;
  fetchRules.push({ match: propsMatcher(props), block: true, body: body });
  installFetch();
};
SL['no-xhr-if'] = function (props, body) {
  if (props == null || props === '') return;
  xhrRules.push({ match: propsMatcher(props), block: true, body: body });
  installXhr();
};
function pruneEdit(prune, need) {
  var p = pruner(prune, need);
  return function (text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return text; }
    return p && p(o) ? JSON.stringify(o) : text;
  };
}
SL['json-prune-fetch-response'] = function (prune, need) {
  var x = extras(arguments, 2);
  fetchRules.push({ match: propsMatcher(x.propsToMatch), edit: pruneEdit(prune, need) });
  installFetch();
};
SL['json-prune-xhr-response'] = function (prune, need) {
  var x = extras(arguments, 2);
  xhrRules.push({ match: propsMatcher(x.propsToMatch), edit: pruneEdit(prune, need) });
  installXhr();
};
function replaceEdit(pattern, repl) {
  if (!pattern) return null;
  var re = /^\/.+\/[dgimsuvy]*$/.test(pattern) ? toRe(pattern)
         : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return function (text) { return text.replace(re, repl == null ? '' : repl); };
}
SL['trusted-replace-fetch-response'] = function (pattern, repl, props) {
  var e = replaceEdit(pattern, repl);
  if (!e) return;
  fetchRules.push({ match: propsMatcher(props), edit: e });
  installFetch();
};
SL['trusted-replace-xhr-response'] = function (pattern, repl, props) {
  var e = replaceEdit(pattern, repl);
  if (!e) return;
  xhrRules.push({ match: propsMatcher(props), edit: e });
  installXhr();
};

var ALIAS = {
  'set-constant': 'set', 'trusted-set-constant': 'trusted-set',
  'abort-on-property-read': 'aopr', 'abort-on-property-write': 'aopw',
  'abort-current-script': 'acs', 'abort-current-inline-script': 'acs', 'acis': 'acs',
  'abort-on-stack-trace': 'aost',
  'no-window-open-if': 'nowoif', 'window.open-defuser': 'nowoif', 'prevent-window-open': 'nowoif',
  'no-setTimeout-if': 'nostif', 'setTimeout-defuser': 'nostif', 'prevent-setTimeout': 'nostif',
  'no-setInterval-if': 'nosiif', 'setInterval-defuser': 'nosiif', 'prevent-setInterval': 'nosiif',
  'nano-setInterval-booster': 'nano-sib', 'adjust-setInterval': 'nano-sib',
  'nano-setTimeout-booster': 'nano-stb', 'adjust-setTimeout': 'nano-stb',
  'addEventListener-defuser': 'aeld', 'prevent-addEventListener': 'aeld',
  'prevent-fetch': 'no-fetch-if', 'prevent-xhr': 'no-xhr-if',
  'noeval-silent': 'noeval', 'silent-noeval': 'noeval', 'prevent-eval-if': 'noeval-if',
  'remove-attr': 'ra', 'remove-class': 'rc',
  'remove-node-text': 'rmnt', 'replace-node-text': 'rpnt',
  'trusted-replace-node-text': 'rpnt', 'trusted-rpnt': 'rpnt',
  'bab-defuser': 'nobab', 'fuckadblock.js-3.2.0': 'nofab',
  'remove-cookie': 'cookie-remover', 'close-window': 'window.close-if',
  'prevent-refresh': 'noop', 'refresh-defuser': 'noop'
};
function runScriptlets(list) {
  for (var i = 0; i < list.length; i++) {
    var name = String(list[i][0]).replace(/\.js$/, '');
    name = ALIAS[name] || name;
    var fn = SL[name];
    if (typeof fn !== 'function') continue;
    try { fn.apply(null, list[i].slice(1)); } catch (e) {}
  }
}

/* ------------------------------------------------------------------ procedural filters
   uBlock's extended selectors: base:has-text(x):upward(2):remove() and friends.
   Parsed once, re-evaluated as the page changes. */
var PROC = ['has-text', 'contains', '-abp-contains', 'upward', 'nth-ancestor', 'xpath',
  'matches-css', 'matches-css-before', 'matches-css-after', 'min-text-length', 'watch-attr',
  'matches-path', 'remove', 'style', 'has', 'not', 'if', 'if-not', '-abp-has'];
function argEnd(s, i) {
  // i points just past "(" - find the matching ")" respecting quotes and escapes
  var depth = 1, q = '';
  for (; i < s.length; i++) {
    var c = s[i];
    if (c === '\\') { i++; continue; }
    if (q) { if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { if (--depth === 0) return i; }
  }
  return -1;
}
function hasProc(s) {
  return /:(has-text|contains|-abp-contains|upward|nth-ancestor|xpath|matches-css(-before|-after)?|min-text-length|watch-attr|matches-path|remove|style|if|if-not|-abp-has)\(/.test(s);
}
function parseProc(raw) {
  var s = String(raw).trim(), steps = [], css = '', i = 0, action = null;
  while (i < s.length) {
    var c = s[i];
    if (c === '[') {                       // attribute selector: copy verbatim
      var j = s.indexOf(']', i);
      if (j < 0) return null;
      css += s.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '"' || c === "'") { var k = s.indexOf(c, i + 1); if (k < 0) return null; css += s.slice(i, k + 1); i = k + 1; continue; }
    if (c === ':') {
      var m = /^:([-a-z]+)\(/.exec(s.slice(i));
      if (m && PROC.indexOf(m[1]) >= 0) {
        var end = argEnd(s, i + m[0].length);
        if (end < 0) return null;
        var name = m[1], arg = s.slice(i + m[0].length, end);
        if ((name === 'has' || name === 'not') && !hasProc(arg)) { css += s.slice(i, end + 1); i = end + 1; continue; }
        if (css.trim() || !steps.length) steps.push({ css: css.trim() });
        css = '';
        if (name === '-abp-has' || name === 'if') name = 'has';
        if (name === 'if-not') name = 'not';
        if (name === 'contains' || name === '-abp-contains') name = 'has-text';
        if (name === 'nth-ancestor') name = 'upward';
        if (name === 'remove') action = 'remove';
        else if (name === 'style') action = ['style', arg];
        else {
          if (name === 'has' || name === 'not') { arg = parseProc(arg); if (!arg) return null; }
          steps.push({ op: name, arg: arg });
        }
        i = end + 1;
        continue;
      }
    }
    css += c; i++;
  }
  if (css.trim()) steps.push({ css: css.trim() });
  return steps.length ? { steps: steps, action: action } : null;
}
function textTest(arg) {
  if (/^\/.*\/[a-z]*$/.test(arg)) { var re = toRe(arg); return function (t) { return re.test(t); }; }
  return function (t) { return t.indexOf(arg) >= 0; };
}
function runSteps(steps, ctx) {
  // ctx: element to search within (for :has), or null for the whole document
  var set = null;
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i], next = [];
    if (st.css !== undefined) {
      var sel = st.css;
      if (set === null) {
        var root = ctx || D;
        var q = ctx && /^[>+~]/.test(sel) ? ':scope ' + sel : sel;
        try { next = Array.prototype.slice.call(root.querySelectorAll(q)); } catch (e) { return []; }
      } else {
        for (var a = 0; a < set.length; a++) {
          try { next = next.concat(Array.prototype.slice.call(set[a].querySelectorAll(/^[>+~]/.test(sel) ? ':scope ' + sel : sel))); }
          catch (e) { return []; }
        }
      }
      set = next;
      continue;
    }
    if (set === null) set = ctx ? Array.prototype.slice.call(ctx.querySelectorAll('*')) : [D.documentElement];
    var arg = st.arg;
    switch (st.op) {
      case 'has-text':
        var tt = st.t || (st.t = textTest(arg));
        next = set.filter(function (e) { return tt(e.textContent || ''); });
        break;
      case 'min-text-length':
        var n = parseInt(arg, 10) || 0;
        next = set.filter(function (e) { return (e.textContent || '').length >= n; });
        break;
      case 'upward':
        next = [];
        set.forEach(function (e) {
          var up = null;
          if (/^\d+$/.test(arg)) { up = e; for (var k = parseInt(arg, 10); k > 0 && up; k--) up = up.parentElement; }
          else if (e.parentElement) { try { up = e.parentElement.closest(arg); } catch (x) { up = null; } }
          if (up && next.indexOf(up) < 0) next.push(up);
        });
        break;
      case 'xpath':
        next = [];
        (set.length ? set : [D]).forEach(function (e) {
          try {
            var r = D.evaluate(arg, e, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (var k = 0; k < r.snapshotLength; k++) { var nd = r.snapshotItem(k); if (nd.nodeType === 1 && next.indexOf(nd) < 0) next.push(nd); }
          } catch (x) {}
        });
        break;
      case 'matches-css': case 'matches-css-before': case 'matches-css-after':
        var pm = /^\s*([-a-z]+)\s*:\s*(.+?)\s*$/i.exec(arg);
        if (!pm) return [];
        var pv = /^\/.*\/[a-z]*$/.test(pm[2]) ? toRe(pm[2]) : null;
        var pseudo = st.op === 'matches-css' ? null : st.op === 'matches-css-before' ? '::before' : '::after';
        next = set.filter(function (e) {
          var v = getComputedStyle(e, pseudo).getPropertyValue(pm[1]);
          return pv ? pv.test(v) : v === pm[2];
        });
        break;
      case 'matches-path':
        var mp = textTest(arg);
        next = mp(L.pathname + L.search) ? set : [];
        break;
      case 'watch-attr':
        next = set;
        break;
      case 'has':
        next = set.filter(function (e) { return runSteps(arg.steps, e).length > 0; });
        break;
      case 'not':
        next = set.filter(function (e) { return runSteps(arg.steps, e).length === 0; });
        break;
      default:
        return [];
    }
    set = next;
    if (!set.length) return set;
  }
  return set || [];
}
function procedural(list) {
  var rules = [];
  list.forEach(function (raw) { var p = parseProc(raw); if (p) rules.push(p); });
  if (!rules.length) return;
  var styled = new WeakSet();
  watch(function () {
    rules.forEach(function (r) {
      var els = runSteps(r.steps, null);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el === D.documentElement || el === D.body) continue;
        if (r.action === 'remove') { el.remove(); continue; }
        if (r.action && r.action[0] === 'style') {
          if (styled.has(el)) continue;
          styled.add(el);
          r.action[1].split(';').forEach(function (d) {
            var m = /^\s*([-a-z]+)\s*:\s*(.+?)\s*(!important)?\s*$/i.exec(d);
            if (m) el.style.setProperty(m[1], m[2], 'important');
          });
          continue;
        }
        el.setAttribute(MARK, '');
      }
    });
  });
}

/* ------------------------------------------------------------------ YouTube
   The filter lists do the heavy lifting (they strip ad data out of the player's
   responses). This is the backstop for anything that still plays: mute it,
   jump to its end, press Skip, and take down the "ad blockers" dialog. */
function youtube() {
  if (!TOP) return;
  var ours = new WeakMap();
  var tick = function () {
    var p = D.querySelector('#movie_player, .html5-video-player');
    if (!p) return;
    var v = p.querySelector('video');
    var ad = p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting');
    var skip = D.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button');
    if (skip) try { skip.click(); } catch (e) {}
    if (ad && v) {
      if (!ours.has(v)) ours.set(v, { muted: v.muted, rate: v.playbackRate });
      v.muted = true;
      try { v.playbackRate = 16; } catch (e) {}
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.25) {
        try { v.currentTime = v.duration - 0.1; } catch (e) {}
      }
    } else if (v && ours.has(v)) {
      var was = ours.get(v);
      ours.delete(v);
      v.muted = was.muted;
      try { v.playbackRate = was.rate === 16 ? 1 : was.rate; } catch (e) {}
    }
    var close = D.querySelector('.ytp-ad-overlay-close-button');
    if (close) try { close.click(); } catch (e) {}
    var enf = D.querySelector('ytd-enforcement-message-view-model');
    if (enf) {
      var dlg = enf.closest('tp-yt-paper-dialog, ytd-popup-container');
      (dlg && dlg.tagName !== 'YTD-POPUP-CONTAINER' ? dlg : enf).remove();
      var bd = D.querySelector('tp-yt-iron-overlay-backdrop');
      if (bd) bd.remove();
      if (v && v.paused && !ad) v.play().catch(function () {});
    }
  };
  setInterval(tick, 300);
}

/* ------------------------------------------------------------------ cookie banners
   Clicks "Reject" on the consent tools that offer one, by their own button ids.
   Anything that cannot be refused is left to the cookie-notice filter list. */
function cookies() {
  var REJECT = [
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '#didomi-notice-disagree-button',
    '.didomi-continue-without-agreeing',
    '.cky-btn-reject',
    '.cmplz-btn.cmplz-deny',
    '.osano-cm-denyAll',
    '.iubenda-cs-reject-btn',
    '[data-tid="banner-decline"]',
    '.fc-cta-do-not-consent',
    'button[data-cookiefirst-action="reject"]',
    '#cookiescript_reject',
    '#cookie_action_close_header_reject',
    '#cn-refuse-cookie',
    '#tarteaucitronAllDenied2',
    '.klaro .cn-decline',
    '#ccc-notify-reject',
    '#axeptio_btn_dismiss',
    '.sp_choice_type_13',
    'form[action^="https://consent."] button[aria-label^="Reject"]'
  ];
  var done = false;
  var visible = function (el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); };
  var run = function () {
    if (done) return;
    for (var i = 0; i < REJECT.length; i++) {
      var b; try { b = D.querySelector(REJECT[i]); } catch (e) { continue; }
      if (b && visible(b)) { done = true; try { b.click(); } catch (e) {} return; }
    }
    var uc = D.querySelector('#usercentrics-root, #usercentrics-cmp-ui');
    if (uc && uc.shadowRoot) {
      var ub = uc.shadowRoot.querySelector('[data-testid="uc-deny-all-button"]');
      if (ub) { done = true; try { ub.click(); } catch (e) {} }
    }
  };
  watch(run, 20000);
}

/* ------------------------------------------------------------------ badge
   A small note drawn over the page in its own closed shadow root, so no page
   style can reach it: "1.5×", "Skipped sponsor", "Resume at 12:34". */
function badge(text, action, ms) {
  try {
    var host = D.createElement('wsb-badge');
    host.style.cssText = 'all:initial;position:fixed;left:18px;bottom:18px;z-index:2147483647';
    var root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>div{font:600 13px "Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(22,19,26,.92);' +
      'border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 13px;display:flex;gap:10px;align-items:center;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.4)}button{font:inherit;border:0;border-radius:7px;padding:5px 10px;cursor:pointer;' +
      'background:#e8342a;color:#fff}button.x{background:transparent;color:#aaa;padding:5px 6px}</style><div><span></span></div>';
    root.querySelector('span').textContent = text;
    var box = root.querySelector('div');
    if (action) {
      var b = D.createElement('button'); b.textContent = action.label;
      b.onclick = function (e) { e.stopPropagation(); action.fn(); host.remove(); };
      box.appendChild(b);
      var x = D.createElement('button'); x.className = 'x'; x.textContent = '✕';
      x.onclick = function (e) { e.stopPropagation(); host.remove(); };
      box.appendChild(x);
    }
    (D.fullscreenElement || D.body || D.documentElement).appendChild(host);
    setTimeout(function () { host.remove(); }, ms || 1400);
  } catch (e) {}
}
function clock(s) {
  s = Math.max(0, Math.floor(s));
  var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
}

/* ------------------------------------------------------------------ video controls
   window[Symbol.for('wsb.media')](action, arg) is what the toolbar's media
   buttons call (through the shell, in whichever frame holds the video). */
var SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
function allVideos(root, out) {
  out = out || [];
  try {
    root.querySelectorAll('video').forEach(function (v) { out.push(v); });
    root.querySelectorAll('*').forEach(function (e) { if (e.shadowRoot) allVideos(e.shadowRoot, out); });
  } catch (e) {}
  return out;
}
function bestVideo() {
  var best = null, score = -1;
  allVideos(D).forEach(function (v) {
    var r = v.getBoundingClientRect(), area = r.width * r.height;
    if (area < 1500 && v.readyState === 0) return;
    var s = area + (!v.paused && !v.ended ? 1e9 : 0) + (v.currentTime > 0 ? 1e8 : 0);
    if (s > score) { score = s; best = v; }
  });
  return best;
}
function vinfo(v) {
  if (!v) return { has: 0 };
  var r = v.getBoundingClientRect();
  return { has: 1, playing: !v.paused && !v.ended, t: v.currentTime, d: isFinite(v.duration) ? v.duration : 0,
    rate: v.playbackRate, muted: v.muted, loop: v.loop, area: Math.round(r.width * r.height),
    pip: D.pictureInPictureElement === v, fill: v.hasAttribute(FILL) };
}
var FILL = 'wsb-fill-' + Math.random().toString(36).slice(2, 7);
var fillSheet = null;
/* ---- louder than 100%, bass or voice, through Web Audio. Only for video
   whose sound the page may read (its own, or a blob: stream as streaming
   sites use); anything else would go silent, so it is refused. */
var AUD = typeof WeakMap === 'function' ? new WeakMap() : null;
function audioFor(v) {
  var a = AUD && AUD.get(v);
  if (a) return a;
  var u = v.currentSrc || v.src || '', ok = /^(blob:|data:)/.test(u) || !!v.crossOrigin;
  if (!ok) { try { ok = new URL(u, L.href).origin === L.origin; } catch (e) {} }
  if (!ok) return 'cross';
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return 'gesture';
  var C = W.AudioContext || W.webkitAudioContext;
  if (!C) return 'none';
  var ctx = new C(), src = ctx.createMediaElementSource(v);
  var low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180;
  var mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 2400; mid.Q.value = 0.9;
  var gain = ctx.createGain(), lim = ctx.createDynamicsCompressor();
  lim.threshold.value = 0; lim.knee.value = 0; lim.ratio.value = 1; lim.attack.value = 0.003; lim.release.value = 0.25;
  src.connect(low); low.connect(mid); mid.connect(gain); gain.connect(lim); lim.connect(ctx.destination);
  if (ctx.state === 'suspended') ctx.resume();
  a = { ctx: ctx, gain: gain, low: low, mid: mid, lim: lim, g: 1, eq: 'off' };
  AUD.set(v, a);
  return a;
}
function boost(v, o) {
  var a = audioFor(v);
  if (typeof a === 'string') return a;
  var g = Math.max(1, Math.min(4, +o.g || 1)), eq = o.eq === 'bass' || o.eq === 'voice' ? o.eq : 'off';
  a.g = g; a.eq = eq;
  a.gain.gain.value = g;
  a.lim.threshold.value = g > 1 ? -6 : 0; a.lim.ratio.value = g > 1 ? 12 : 1;      // keeps loud parts from crackling
  a.low.gain.value = eq === 'bass' ? 9 : eq === 'voice' ? -4 : 0;
  a.mid.gain.value = eq === 'voice' ? 7 : 0;
  badge((g > 1 ? 'Volume ' + Math.round(g * 100) + '%' : 'Normal volume') + (eq !== 'off' ? ' · ' + (eq === 'bass' ? 'Bass boost' : 'Voice boost') : ''));
  return '';
}
/* ---- theater: the video big in the middle, the rest of the page dimmed; and listen-only */
var THEATER = 'wsb-th-' + Math.random().toString(36).slice(2, 7), AO = 'wsb-ao-' + Math.random().toString(36).slice(2, 7), thSheet = null, thBack = null, aoS = null;
function theater(v) {
  if (!thSheet) {
    thSheet = new CSSStyleSheet();
    thSheet.replaceSync('[' + THEATER + ']{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(90vw,calc(86vh*16/9))!important;height:auto!important;' +
      'max-width:none!important;max-height:86vh!important;z-index:2147483646!important;background:#000!important;object-fit:contain!important;margin:0!important;border-radius:10px!important;box-shadow:0 30px 90px rgba(0,0,0,.7)!important}');
    adopt(thSheet);
  }
  if (v.hasAttribute(THEATER)) { v.removeAttribute(THEATER); if (thBack) { thBack.remove(); thBack = null; } return; }
  allVideos(D).forEach(function (o) { o.removeAttribute(THEATER); });
  v.setAttribute(THEATER, '');
  thBack = D.createElement('wsb-badge');
  thBack.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.88);animation:none';
  thBack.addEventListener('click', function (e) { if (e.isTrusted) theater(v); });
  (D.body || D.documentElement).appendChild(thBack);
  var esc = function (e) { if (e.key === 'Escape' && v.hasAttribute(THEATER)) { theater(v); W.removeEventListener('keydown', esc, true); } };
  W.addEventListener('keydown', esc, true);
  badge('Theater mode - Esc or a click outside the video to leave', null, 2500);
}
function aoSheet() { if (aoS) return; aoS = new CSSStyleSheet(); aoS.replaceSync('[' + AO + ']{opacity:0!important}'); adopt(aoS); }
/* ---- volume for the whole tab: every video and audio here, and the ones that start later */
var tabVol = -1, tabVolHooked = false;
function tabVolume(x) {
  tabVol = x;
  allVideos(D).concat([].slice.call(D.querySelectorAll('audio'))).forEach(function (m) { try { m.volume = x; } catch (e) {} });
  if (!tabVolHooked) { tabVolHooked = true; D.addEventListener('play', function (e) { if (tabVol >= 0 && e.target instanceof HTMLMediaElement) try { e.target.volume = tabVol; } catch (x) {} }, true); }
  badge('Tab volume ' + Math.round(x * 100) + '%');
}
/* ---- A-B loop: the first press marks the start, the second the end, the third stops it */
var AB = typeof WeakMap === 'function' ? new WeakMap() : null, abHooked = false;
function abLoop(v) {
  var s = AB.get(v);
  if (!abHooked) {
    abHooked = true;
    D.addEventListener('timeupdate', function (e) {
      var x = e.target, q = AB && x instanceof HTMLMediaElement && AB.get(x);
      if (q && q.b != null && (x.currentTime >= q.b || x.currentTime < q.a - 1)) x.currentTime = q.a;
    }, true);
  }
  if (!s) { AB.set(v, { a: v.currentTime, b: null }); badge('Loop starts at ' + clock(v.currentTime) + ' - press Alt+B again where it should end', null, 3000); }
  else if (s.b == null) {
    if (v.currentTime <= s.a + 0.5) { badge('Play a little further, then press Alt+B for the end'); return; }
    s.b = v.currentTime; v.currentTime = s.a; badge('Looping ' + clock(s.a) + ' - ' + clock(s.b), null, 2500);
  } else { AB.delete(v); badge('A-B loop off'); }
}
function media(action, arg) {
  var v = bestVideo(), from = null, err = '';
  try {
    switch (action) {
      case 'boost': { var bo = {}; try { bo = JSON.parse(arg) || {}; } catch (e) {} if (v) err = boost(v, bo); break; }
      case 'abloop': if (v && AB) abLoop(v); break;
      case 'tabvol': tabVolume(Math.max(0, Math.min(1, +arg))); break;
      case 'theater': if (v) theater(v); break;
      case 'audioonly': if (v) { if (v.hasAttribute(AO)) v.removeAttribute(AO); else { v.setAttribute(AO, ''); aoSheet(); } badge(v.hasAttribute(AO) ? 'Listening only - the picture is hidden' : 'Picture back'); } break;
      case 'info': break;
      case 'pip':
        if (D.pictureInPictureElement) { D.exitPictureInPicture(); break; }
        if (!v) return JSON.stringify({ has: 0 });
        v.disablePictureInPicture = false;
        v.requestPictureInPicture().catch(function () {});
        break;
      case 'toggle': if (v) { if (v.paused) v.play(); else v.pause(); } break;
      case 'play': if (v) v.play(); break;
      case 'pause': if (v) v.pause(); break;
      case 'speed':
        if (v) { v.playbackRate = Math.max(0.1, Math.min(16, +arg || 1)); badge(v.playbackRate + '×'); }
        break;
      case 'faster': case 'slower':
        if (v) {
          var i = SPEEDS.indexOf(v.playbackRate);
          if (i < 0) i = SPEEDS.indexOf(1);
          i = Math.max(0, Math.min(SPEEDS.length - 1, i + (action === 'faster' ? 1 : -1)));
          v.playbackRate = SPEEDS[i];
          badge(SPEEDS[i] + '×');
        }
        break;
      case 'seek':
        if (v) from = v.currentTime;
        if (v) { v.currentTime = Math.max(0, Math.min((v.duration || 1e9) - 0.5, v.currentTime + (+arg || 0))); badge((+arg > 0 ? '+' : '') + arg + ' s  →  ' + clock(v.currentTime)); }
        break;
      case 'mute': if (v) { v.muted = !v.muted; badge(v.muted ? 'Muted' : 'Sound on'); } break;
      case 'volup': case 'voldown':
        if (v) {
          v.muted = false;
          v.volume = Math.max(0, Math.min(1, Math.round((v.volume + (action === 'volup' ? 0.1 : -0.1)) * 10) / 10));
          badge('Volume ' + Math.round(v.volume * 100) + '%');
        }
        break;
      case 'loop': if (v) { v.loop = !v.loop; badge(v.loop ? 'Loop on' : 'Loop off'); } break;
      case 'full': if (v) { if (D.fullscreenElement) D.exitFullscreen(); else v.requestFullscreen().catch(function () {}); } break;
      case 'fill':
        // The video alone, filling the window, without going full screen.
        if (!v) break;
        if (!fillSheet) {
          fillSheet = new CSSStyleSheet();
          fillSheet.replaceSync('[' + FILL + ']{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;' +
            'max-width:none!important;max-height:none!important;z-index:2147483646!important;background:#000!important;object-fit:contain!important;margin:0!important;transform:none!important}');
          adopt(fillSheet);
        }
        if (v.hasAttribute(FILL)) v.removeAttribute(FILL);
        else { allVideos(D).forEach(function (o) { o.removeAttribute(FILL); }); v.setAttribute(FILL, ''); }
        break;
      case 'shot':
        if (!v) return JSON.stringify({ has: 0 });
        var c = D.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        var url;
        try { url = c.toDataURL('image/png'); } catch (e) { return JSON.stringify({ has: 1, error: 'protected' }); }
        return JSON.stringify({ has: 1, png: url });
    }
  } catch (e) {}
  var o = vinfo(v);
  if (from !== null) o.from = from;        // where a skip started, so the browser can learn intros
  if (err) o.err = err;
  if (v && AUD) { var au = AUD.get(v); if (au) { o.boost = au.g; o.eq = au.eq; } }
  if (v && AB) { var ab = AB.get(v); if (ab) o.ab = [ab.a, ab.b]; }
  if (tabVol >= 0) o.tv = tabVol;
  if (v) { o.theater = v.hasAttribute(THEATER) ? 1 : 0; o.ao = v.hasAttribute(AO) ? 1 : 0; }
  return JSON.stringify(o);
}
try { Object.defineProperty(W, Symbol.for('wsb.media'), { value: media, configurable: true }); } catch (e) {}


/* ------------------------------------------------------------------ page tools
   Run on request from the browser's menu (the shell calls this in the page's
   main frame). Answers go back as a "tool" message. */
var unlocked = false, autoScroll = null, outlineEls = [], warmSheet = null, lookSheet = null, userSheet = null;
function toolReply(o) { post('tool', o); }
/* ---- highlights: text you marked, found again by its text and how many
   times that text came before it on the page. */
var HL_ATTR = 'data-wsb-hl';
function textNodes(root) {
  var out = [], w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
    var p = n.parentNode && n.parentNode.nodeName;
    return p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT' || p === 'TEXTAREA' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  for (var n = w.nextNode(); n; n = w.nextNode()) out.push(n);
  return out;
}
function wrapRange(r, id, note) {
  var nodes = textNodes(r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer)
    .filter(function (n) { return r.intersectsNode(n); });
  nodes.forEach(function (n) {
    var s = n === r.startContainer ? r.startOffset : 0, e = n === r.endContainer ? r.endOffset : n.data.length;
    if (e <= s || !n.data.slice(s, e).trim()) return;
    var mid = n.splitText(s); mid.splitText(e - s);
    var m = D.createElement('mark');
    m.setAttribute(HL_ATTR, id);
    m.style.cssText = 'background:#ffe066;color:inherit;border-radius:2px;padding:0 1px;box-shadow:0 1px 0 #e6c94c' + (note ? ';border-bottom:2px dotted #b58900' : '');
    if (note) m.title = note;
    mid.parentNode.insertBefore(m, mid); m.appendChild(mid);
  });
}
function findNth(text, nth) {
  if (!D.body || !text) return null;
  var nodes = textNodes(D.body), flat = '', starts = [];
  nodes.forEach(function (n) { starts.push(flat.length); flat += n.data; });
  var at = -1;
  for (var k = 0; k <= nth; k++) { at = flat.indexOf(text, at + 1); if (at < 0) return null; }
  var end = at + text.length, r = D.createRange(), si = 0, ei = 0;
  for (var i = 0; i < nodes.length; i++) { if (starts[i] <= at) si = i; if (starts[i] < end) ei = i; }
  r.setStart(nodes[si], at - starts[si]); r.setEnd(nodes[ei], end - starts[ei]);
  return r;
}
function unwrapHl(id) {
  D.querySelectorAll('mark[' + HL_ATTR + ']').forEach(function (m) {
    if (id !== 'all' && m.getAttribute(HL_ATTR) !== id) return;
    var par = m.parentNode; while (m.firstChild) par.insertBefore(m.firstChild, m); par.removeChild(m); par.normalize();
  });
}

/* ---- mouse gestures: hold the right button and draw. */
var gestOn = false, gestPath = null, gestUsed = false;
/* ---- dictionary: the selected word, and a bubble with its meaning */
var dictOn = false, dictHost = null, dictAt = null;
function selWord() {
  var s = W.getSelection();
  if (!s || !s.rangeCount || s.isCollapsed) return null;
  var w = s.toString().trim();
  if (!/^[A-Za-z][A-Za-z'\-]{0,39}$/.test(w)) return null;
  var r = s.getRangeAt(0).getBoundingClientRect();
  dictAt = { x: r.left, y: r.bottom, top: r.top };
  return w;
}
function dictClose() { if (dictHost) { dictHost.remove(); dictHost = null; } }
function dictShow(o) {
  dictClose();
  if (!o || typeof o.w !== 'string') return;
  var at = dictAt || { x: 40, y: 40, top: 40 };
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;top:0';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>div.b{font:13px/1.45 "Segoe UI",system-ui,sans-serif;color:#eee;background:rgba(24,21,28,.97);border:1px solid rgba(255,255,255,.14);' +
    'border-radius:12px;padding:11px 13px;width:320px;max-height:260px;overflow:auto;box-shadow:0 12px 34px rgba(0,0,0,.5)}' +
    'b{font-size:15px}.ph{color:#aaa;margin-left:6px}.pos{color:#e8a0a0;font-style:italic;margin-top:6px}ol{margin:2px 0 0;padding-left:18px}' +
    '.ex{color:#aaa;font-style:italic}.no{color:#aaa}.src{color:#777;font-size:11px;margin-top:6px}</style><div class="b"></div>';
  var box = root.querySelector('div'), el = function (tag, cls, text) { var e = D.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  var head = el('div'); head.appendChild(el('b', '', o.w)); if (o.ph) head.appendChild(el('span', 'ph', String(o.ph))); box.appendChild(head);
  if (o.tr) {
    // a translation: the text in your language, and where it came from
    if (typeof o.t === 'string') { var tt = el('div', '', o.t); tt.style.cssText = 'margin-top:6px;font-size:14px;white-space:pre-wrap'; box.appendChild(tt); }
    if (o.src) box.appendChild(el('div', 'src', o.src));
    (D.body || D.documentElement).appendChild(host);
    var tw = 348, th = Math.min(290, box.offsetHeight + 4), tvw = W.innerWidth, tvh = W.innerHeight, tat = dictAt || { x: 40, y: 40, top: 40 };
    host.style.left = Math.max(8, Math.min(tat.x, tvw - tw - 8)) + 'px'; host.style.top = (tat.y + 8 + th > tvh ? Math.max(8, tat.top - th - 8) : tat.y + 8) + 'px';
    dictHost = host;
    return;
  }
  var ms = Array.isArray(o.m) ? o.m.slice(0, 4) : [];
  if (!ms.length) box.appendChild(el('div', 'no', o.loading ? 'Looking it up…' : 'No definition found.'));
  ms.forEach(function (m) {
    box.appendChild(el('div', 'pos', String(m.pos || '')));
    var ol = el('ol');
    (Array.isArray(m.d) ? m.d.slice(0, 3) : []).forEach(function (d) {
      var li = el('li', '', String(d.d || '')); if (d.ex) { li.appendChild(D.createElement('br')); li.appendChild(el('span', 'ex', '“' + d.ex + '”')); } ol.appendChild(li);
    });
    box.appendChild(ol);
  });
  if (!o.loading) box.appendChild(el('div', 'src', 'Dictionary: dictionaryapi.dev'));
  (D.body || D.documentElement).appendChild(host);
  var w = 348, h = Math.min(290, box.offsetHeight + 4), vw = W.innerWidth, vh = W.innerHeight;
  var x = Math.max(8, Math.min(at.x, vw - w - 8)), y = at.y + 8 + h > vh ? Math.max(8, at.top - h - 8) : at.y + 8;
  host.style.left = x + 'px'; host.style.top = y + 'px';
  dictHost = host;
}
W.addEventListener('mousedown', function (e) { if (dictHost && e.composedPath().indexOf(dictHost) < 0) dictClose(); }, true);
W.addEventListener('keydown', function (e) { if (dictHost && e.key === 'Escape') dictClose(); }, true);
W.addEventListener('scroll', function () { if (dictHost) dictClose(); }, true);
/* ---- peek: hold Shift over a link and it opens in the sidebar */
var peekOn = false, peekT = 0, peekA = null;
function peekCancel() { clearTimeout(peekT); peekA = null; }
W.addEventListener('mousemove', function (e) {
  if (!peekOn || !e.isTrusted || !e.shiftKey || !TOP) { if (peekA) peekCancel(); return; }
  var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (a === peekA) return;
  peekCancel();
  if (!a || !/^https?:/i.test(a.href) || a.href.split('#')[0] === L.href.split('#')[0]) return;
  peekA = a;
  peekT = setTimeout(function () { if (peekA === a) { post('tool', { a: 'peek', u: a.href.slice(0, 4000) }); peekA = null; } }, 650);
}, true);
W.addEventListener('keyup', function (e) { if (e.key === 'Shift') peekCancel(); }, true);
/* ---- link hints: every link and button gets letters; type them to click it */
var hintState = null;
function hintsOff() {
  if (!hintState) return;
  hintState.host.remove(); W.removeEventListener('keydown', hintState.key, true); W.removeEventListener('scroll', hintsOff, true);
  W.removeEventListener('mousedown', hintsOff, true);
  hintState = null;
}
function hints() {
  if (hintState) { hintsOff(); return; }
  var vw = W.innerWidth, vh = W.innerHeight, els = [];
  var all = D.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[onclick],[contenteditable=true],[tabindex]:not([tabindex="-1"])');
  for (var i = 0; i < all.length && els.length < 600; i++) {
    var el = all[i], r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw || el.disabled) continue;
    var cx = Math.min(Math.max(r.left + 2, 0), vw - 2), cy = Math.min(Math.max(r.top + Math.min(r.height / 2, 10), 0), vh - 2), top = D.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;   // covered by something else
    els.push([el, r]);
  }
  if (!els.length) { badge('No links or buttons here'); return; }
  var K = 'asdfghjklqwertyuiopzxcvbnm', two = els.length > K.length, labels = [];
  for (var j = 0; j < els.length; j++) labels.push(two ? K[Math.floor(j / K.length) % K.length] + K[j % K.length] : K[j]);
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>span{position:fixed;font:700 11px/1 Consolas,"Segoe UI",monospace;color:#1b1407;background:linear-gradient(#ffe38a,#f5c542);' +
    'border:1px solid #b88a12;border-radius:4px;padding:2px 4px;box-shadow:0 2px 6px rgba(0,0,0,.35);text-transform:uppercase;letter-spacing:.04em;' +
    'animation:pop .14s ease-out both}span.dim{opacity:.25}span b{color:#c0391b}@keyframes pop{from{transform:scale(.6);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){span{animation:none}}</style>';
  var spans = els.map(function (x, k) {
    var sp = D.createElement('span'); sp.textContent = labels[k];
    sp.style.left = Math.max(0, x[1].left - 4) + 'px'; sp.style.top = Math.max(0, x[1].top - 4) + 'px';
    root.appendChild(sp); return sp;
  });
  (D.body || D.documentElement).appendChild(host);
  var typed = '';
  var key = function (e) {
    if (!e.isTrusted) return;
    if (e.key === 'Escape') { hintsOff(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;
    if (e.key === 'Backspace') typed = typed.slice(0, -1);
    else if (e.key.length === 1 && K.indexOf(e.key.toLowerCase()) >= 0) typed += e.key.toLowerCase();
    else { hintsOff(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    var hit = -1, left = 0;
    labels.forEach(function (l, k) {
      var m = l.indexOf(typed) === 0;
      spans[k].className = m ? '' : 'dim';
      spans[k].innerHTML = ''; var b = D.createElement('b'); b.textContent = l.slice(0, typed.length); spans[k].appendChild(b); spans[k].appendChild(D.createTextNode(l.slice(typed.length)));
      if (m) { left++; if (l === typed) hit = k; }
    });
    if (hit >= 0) {
      var t = els[hit][0], newTab = e.shiftKey && t.tagName === 'A';
      hintsOff();
      if (newTab) W.open(t.href, '_blank', 'noopener');
      else if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) t.focus();
      else { try { t.focus({ preventScroll: true }); } catch (x) {} t.click(); }
    } else if (!left) hintsOff();
  };
  hintState = { host: host, key: key };
  W.addEventListener('keydown', key, true);
  W.addEventListener('scroll', hintsOff, true);
  W.addEventListener('mousedown', hintsOff, true);
}
W.addEventListener('dblclick', function (e) {
  if (!dictOn || !e.isTrusted || !TOP) return;
  var t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  setTimeout(function () { var w = selWord(); if (w) post('tool', { a: 'define', w: w }); }, 0);
}, true);
function gestDirs(pts) {
  var out = '', x0 = pts[0][0], y0 = pts[0][1];
  for (var i = 1; i < pts.length; i++) {
    var dx = pts[i][0] - x0, dy = pts[i][1] - y0;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) continue;
    var d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
    if (out[out.length - 1] !== d) out += d;
    x0 = pts[i][0]; y0 = pts[i][1];
  }
  return out;
}
var GEST = { L: 'Back', R: 'Forward', U: 'New tab', DR: 'Close tab', UD: 'Reload', LU: 'Reopen closed tab', D: 'Scroll to bottom', UL: 'Scroll to top' };
W.addEventListener('mousedown', function (e) { if (gestOn && e.isTrusted && e.button === 2) { gestPath = [[e.clientX, e.clientY]]; gestUsed = false; } }, true);
W.addEventListener('mousemove', function (e) { if (gestPath && e.isTrusted && (e.buttons & 2)) gestPath.push([e.clientX, e.clientY]); }, true);
W.addEventListener('mouseup', function (e) {
  if (!gestPath || e.button !== 2 || !e.isTrusted) return;
  var g = gestPath.length > 2 ? gestDirs(gestPath) : '';
  gestPath = null;
  if (!g || !GEST[g]) return;
  gestUsed = true;
  if (g === 'D') W.scrollTo({ top: (D.scrollingElement || D.documentElement).scrollHeight, behavior: 'smooth' });
  else if (g === 'UL') W.scrollTo({ top: 0, behavior: 'smooth' });
  else post('tool', { a: 'gesture', g: g });
  badge(GEST[g]);
}, true);
W.addEventListener('contextmenu', function (e) { if (gestUsed) { gestUsed = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);

/* ---- clipboard history: text copied on pages (never from password boxes). */
var clipOn = false;
D.addEventListener('copy', function (e) {
  if (!clipOn || !e.isTrusted || !TOP && !SAME_SITE) return;
  var a = D.activeElement, t = '';
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
    if (a.type === 'password' || /password|passcode|otp|cvv|card/i.test((a.name || '') + (a.id || '') + (a.autocomplete || ''))) return;
    try { t = a.value.slice(a.selectionStart, a.selectionEnd); } catch (x) {}
  } else t = String(W.getSelection ? W.getSelection() : '');
  t = t.trim();
  if (t) post('tool', { a: 'copied', t: t.slice(0, 5000) });
}, true);

/* ---- text snippets: type a keyword (like ;addr) and it becomes your text.
   Only the keywords are known to the page; the text comes when you type one. */
var snipKeys = [], snipAt = null;
function caretText(el) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { try { return el.value.slice(0, el.selectionStart); } catch (x) { return ''; } }
  var s = W.getSelection(); if (!s || !s.rangeCount || !s.isCollapsed) return '';
  var n = s.anchorNode; return n && n.nodeType === 3 ? n.data.slice(0, s.anchorOffset) : '';
}
D.addEventListener('input', function (e) {
  if (!snipKeys.length || !e.isTrusted) return;
  var el = e.target;
  if (!el || !(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|url|tel|)$/i.test(el.type)) || el.isContentEditable)) return;
  var before = caretText(el);
  for (var i = 0; i < snipKeys.length; i++) {
    var k = snipKeys[i];
    if (before.slice(-k.length) === k && (before.length === k.length || /\s/.test(before[before.length - k.length - 1]))) {
      snipAt = { el: el, k: k, t: Date.now() };
      post('tool', { a: 'snip', k: k });
      return;
    }
  }
}, true);
function snipInsert(k, v) {
  var s = snipAt;
  if (!s || s.k !== k || Date.now() - s.t > 5000) return;
  snipAt = null;
  var el = s.el;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    var end = el.selectionStart;
    if (el.value.slice(end - k.length, end) !== k) return;
    el.setRangeText(v, end - k.length, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    var sel = W.getSelection(), n = sel.anchorNode, o = sel.anchorOffset;
    if (!n || n.nodeType !== 3 || n.data.slice(o - k.length, o) !== k) return;
    var r = D.createRange(); r.setStart(n, o - k.length); r.setEnd(n, o);
    sel.removeAllRanges(); sel.addRange(r);
    D.execCommand('insertText', false, v);
  }
}

/* ---- looks: vision filters, big cursor, link highlighting, your own CSS. */
var FILTERS = {
  contrast: 'contrast(1.35) saturate(1.1)',
  gray: 'grayscale(1)',
  invert: 'invert(.92) hue-rotate(180deg)',
  deutan: 'url("#wsb-deutan")', protan: 'url("#wsb-protan")', tritan: 'url("#wsb-tritan")'
};
// Color-blind assist (daltonization): colors that are hard to tell apart are shifted to ones that are easier.
var CB = {
  deutan: '1 0 0 0 0  0.7 0.3 0 0 0  0.3 -0.3 1 0 0  0 0 0 1 0'.replace(/\s+/g, ' '),
  protan: '0.3 0.7 0 0 0  0 1 0 0 0  -0.3 0.3 1 0 0  0 0 0 1 0',
  tritan: '1 0 0.3 0 0  0 1 -0.3 0 0  0 0.3 0.7 0 0  0 0 0 1 0'
};
function looks(o) {
  o = o || {};
  if (!lookSheet) { lookSheet = new CSSStyleSheet(); adopt(lookSheet); }
  var css = '';
  var f = FILTERS[o.filter];
  if (CB[o.filter] && !D.getElementById('wsb-cb')) {
    var svg = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'wsb-cb'; svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = Object.keys(CB).map(function (k) { return '<filter id="wsb-' + k + '"><feColorMatrix type="matrix" values="' + CB[k] + '"/></filter>'; }).join('');
    (D.body || D.documentElement).appendChild(svg);
  }
  if (f) css += 'html{filter:' + f + '!important}';
  if (o.cursor) css += '*{cursor:url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M3 2l0 30 8-8 5 12 6-3-5-11 11 0z" fill="#000" stroke="#fff" stroke-width="2"/></svg>') + '") 3 2,auto!important}';
  if (o.links) css += 'a[href]{outline:2px solid #ffb300!important;outline-offset:1px!important;text-decoration:underline!important;border-radius:2px}';
  // Readable text: an easy font with more space, on text only (icon fonts keep theirs).
  if (o.font) css += 'p,li,dd,dt,td,th,blockquote,figcaption,h1,h2,h3,h4,h5,h6,label,article,section,main,a:not([class*=icon]):not([class*=Icon]){' +
    'font-family:"Segoe UI","Verdana","Tahoma",sans-serif!important;letter-spacing:.02em!important;word-spacing:.1em!important}' +
    'p,li,dd,blockquote,figcaption{line-height:1.7!important}';
  if (o.subs && typeof o.subs === 'object') {
    // bigger, clearer captions: the standard ones, and YouTube's and Netflix's own
    var px = { s: 18, m: 24, l: 32, xl: 42 }[o.subs.size] || 0, col = /^#[0-9a-f]{6}$/i.test(o.subs.color || '') ? o.subs.color : '', bg = Math.max(0, Math.min(1, +o.subs.bg || 0));
    var dec = (px ? 'font-size:' + px + 'px!important;' : '') + (col ? 'color:' + col + '!important;' : '') + (o.subs.bg != null ? 'background:rgba(0,0,0,' + bg + ')!important;' : '');
    if (dec) css += '::cue{' + dec + '}.ytp-caption-segment{' + dec + '}.player-timedtext-text-container span{' + dec + '}';
  }
  if (o.fsize) css += 'p,li,dd,dt,td,th,blockquote,figcaption,label{font-size:' + Math.max(80, Math.min(200, +o.fsize || 100)) + '%!important}';
  lookSheet.replaceSync(css);
  if (!userSheet) { userSheet = new CSSStyleSheet(); adopt(userSheet); }
  try { userSheet.replaceSync(o.css || ''); } catch (e) {}
}

function tool(action, arg) {
  switch (action) {
    case 'unlock': {
      // Copy, select, paste and right-click, back on sites that turn them off.
      if (!unlocked) {
        unlocked = true;
        try {
          var s = new CSSStyleSheet();
          s.replaceSync('*,*::before,*::after{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}');
          adopt(s);
        } catch (e) {}
        ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'].forEach(function (t) {
          W.addEventListener(t, function (e) { e.stopImmediatePropagation(); }, true);
        });
        [D, D.documentElement, D.body].forEach(function (n) {
          if (!n) return;
          ['oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'onselectstart', 'ondragstart', 'onmousedown'].forEach(function (k) {
            try { if (n[k]) n[k] = null; } catch (e) {}
          });
        });
      }
      if (arg !== 'quiet') badge('Copy, paste and right-click unlocked');
      toolReply({ a: 'unlock', ok: 1, quiet: arg === 'quiet' ? 1 : 0 });
      break;
    }
    case 'cleanup': {
      // Pop-ups, sign-up walls, cookie bars and sticky headers that cover the
      // page go; the page scrolls again.
      var vw = W.innerWidth, vh = W.innerHeight, n = 0;
      var all = D.body ? D.body.querySelectorAll('*') : [];
      for (var i = 0; i < all.length && i < 20000; i++) {
        var el = all[i];
        if (el.tagName.indexOf('WSB-') === 0) continue;      // the browser's own notices
        var cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        if (el.querySelector && el.querySelector('video')) continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || cs.display === 'none' || cs.visibility === 'hidden') continue;
        var big = r.width * r.height > vw * vh * 0.2, bar = r.width > vw * 0.6 && (r.top <= 2 || r.bottom >= vh - 2);
        if (!big && !bar && (+cs.zIndex || 0) < 1000) continue;
        el.style.setProperty('display', 'none', 'important');
        n++;
      }
      [D.documentElement, D.body].forEach(function (x) {
        if (!x) return;
        x.style.setProperty('overflow', 'auto', 'important');
        if (getComputedStyle(x).position === 'fixed') x.style.setProperty('position', 'static', 'important');
      });
      badge(n ? 'Removed ' + n + ' thing' + (n === 1 ? '' : 's') + ' covering the page' : 'Nothing covering this page');
      toolReply({ a: 'cleanup', n: n });
      break;
    }
    case 'edit': {
      var on = D.designMode !== 'on';
      D.designMode = on ? 'on' : 'off';
      badge(on ? 'Editing: click any text to change it' : 'Editing off');
      toolReply({ a: 'edit', on: on ? 1 : 0 });
      break;
    }
    case 'scroll': {
      // Hands-free reading. Alt+A starts and stops; the browser's panel or
      // the arrow keys change the speed while it runs.
      var box = function () {
        var se = D.scrollingElement || D.documentElement;
        if (se.scrollHeight > se.clientHeight + 10) return null;       // the window scrolls
        var best = null, bh = 0;
        D.querySelectorAll('*').forEach(function (e) {
          if (e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > bh) { best = e; bh = e.clientHeight; }
        });
        return best;
      };
      if (arg === 'faster' || arg === 'slower') {
        if (autoScroll) { autoScroll.speed = Math.max(10, Math.min(600, autoScroll.speed * (arg === 'faster' ? 1.4 : 1 / 1.4))); badge('Scroll speed ' + Math.round(autoScroll.speed) + ' px/s'); }
        break;
      }
      if (autoScroll) { autoScroll.stop(); badge('Auto-scroll off'); toolReply({ a: 'scroll', on: 0 }); break; }
      var target = box(), last = 0, carry = 0, raf = 0;
      var key = function (e) {
        if (e.key === 'Escape') autoScroll && autoScroll.stop();
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { tool('scroll', e.key === 'ArrowDown' ? 'faster' : 'slower'); e.preventDefault(); e.stopImmediatePropagation(); }
      };
      autoScroll = { speed: +arg > 0 ? +arg : 50, stop: function () { cancelAnimationFrame(raf); W.removeEventListener('keydown', key, true); autoScroll = null; } };
      var step = function (t) {
        if (!autoScroll) return;
        if (last) {
          carry += autoScroll.speed * Math.min(0.1, (t - last) / 1000);
          var px = Math.floor(carry); carry -= px;
          if (px) {
            if (target) target.scrollTop += px; else W.scrollBy(0, px);
            var se = target || D.scrollingElement || D.documentElement;
            if (se.scrollTop + se.clientHeight >= se.scrollHeight - 1) { autoScroll.stop(); badge('Reached the end'); toolReply({ a: 'scroll', on: 0 }); return; }
          }
        }
        last = t;
        raf = requestAnimationFrame(step);
      };
      W.addEventListener('keydown', key, true);
      raf = requestAnimationFrame(step);
      badge('Auto-scroll on - ↑ ↓ speed, Esc stops');
      toolReply({ a: 'scroll', on: 1 });
      break;
    }
    case 'findtext': {
      // For "Search all tabs": how often the words appear here, and where first.
      var q = String(arg || '').toLowerCase().trim().slice(0, 200), all = D.body ? String(D.body.innerText || '') : '', low = all.toLowerCase();
      var cnt = 0, first = -1, at2 = -1;
      if (q) while ((at2 = low.indexOf(q, at2 + 1)) >= 0 && cnt < 999) { if (first < 0) first = at2; cnt++; }
      toolReply({ a: 'findtext', q: q, n: cnt, snip: first < 0 ? '' : all.slice(Math.max(0, first - 60), first + q.length + 60).replace(/\s+/g, ' ') });
      break;
    }
    case 'stats': {
      var sel = String(W.getSelection ? W.getSelection() : '').trim();
      var root = D.querySelector('article') || D.querySelector('main') || D.body;
      var text = sel || (root ? root.innerText : '');
      var words = (text.match(/[^\s]+/g) || []).length;
      toolReply({ a: 'stats', sel: sel ? 1 : 0, words: words, chars: text.replace(/\s/g, '').length, mins: Math.max(1, Math.round(words / 230)) });
      break;
    }
    case 'outline': {
      outlineEls = [];
      var out = [];
      D.querySelectorAll('h1,h2,h3,h4').forEach(function (h) {
        if (out.length >= 150) return;
        var t = (h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim();
        var r = h.getBoundingClientRect();
        if (!t || (!r.width && !r.height)) return;
        outlineEls.push(h);
        out.push({ l: +h.tagName[1], t: t.slice(0, 120), i: outlineEls.length - 1 });
      });
      toolReply({ a: 'outline', items: out, title: D.title.slice(0, 120) });
      break;
    }
    case 'warm': {
      // Night light: a warm, dimmer page for reading late. 0 turns it off.
      var k = Math.max(0, Math.min(1, +arg || 0));
      if (!warmSheet) { warmSheet = new CSSStyleSheet(); adopt(warmSheet); }
      warmSheet.replaceSync(k ? 'html{filter:sepia(' + (0.25 + 0.45 * k).toFixed(2) + ') saturate(' + (1 - 0.15 * k).toFixed(2) + ') brightness(' + (1 - 0.18 * k).toFixed(2) + ')!important}' : '');
      break;
    }
    case 'init': {
      // Everything that applies to this site, sent by the browser when a page loads.
      var o = {}; try { o = JSON.parse(arg) || {}; } catch (e) {}
      if (o.unlock) tool('unlock', 'quiet');
      if (o.warm) tool('warm', String(o.warm));
      looks(o);
      gestOn = !!o.gest; clipOn = !!o.clip; dictOn = !!o.dict; peekOn = !!o.peek; rpOn = !!o.rpOn; draftsOn = !!o.drafts;
      clickFx = o.clickfx === 'ripple' || o.clickfx === 'sparkle' ? o.clickfx : '';
      if (o.draftsFor) offerDrafts(o.draftsFor);
      if (o.rp) offerReadPos(+o.rp);
      if (Array.isArray(o.sticky) && TOP) {
        sticky.list = o.sticky.filter(function (n) { return n && typeof n.id === 'string'; }).slice(0, 50).map(function (n) {
          return { id: String(n.id).replace(/[^\w]/g, '').slice(0, 20), x: +n.x || 0, y: +n.y || 0, t: String(n.t || ''), c: STICKY_COL[n.c] ? n.c : 'y' }; });
        sticky.list.forEach(function (n) { stickyDraw(n); });
      }
      snipKeys = Array.isArray(o.snip) ? o.snip.filter(function (k) { return typeof k === 'string' && k.length > 1; }) : [];
      (Array.isArray(o.hl) ? o.hl : []).forEach(function (h) {
        if (D.querySelector('mark[' + HL_ATTR + '="' + String(h.id).replace(/[^\w-]/g, '') + '"]')) return;
        var r = findNth(String(h.t || ''), +h.n || 0);
        if (r) wrapRange(r, String(h.id).replace(/[^\w-]/g, ''), h.note || '');
      });
      break;
    }
    case 'highlight': {
      var s = W.getSelection();
      if (!s || !s.rangeCount || s.isCollapsed) { toolReply({ a: 'highlight', err: 'nosel' }); break; }
      var r = s.getRangeAt(0), text = r.toString();
      if (!text.trim()) { toolReply({ a: 'highlight', err: 'nosel' }); break; }
      text = text.slice(0, 3000);
      var pre = D.createRange(); pre.setStart(D.body, 0); pre.setEnd(r.startContainer, r.startOffset);
      var before = pre.toString(), n = 0, at = -1;
      while ((at = before.indexOf(text, at + 1)) >= 0) n++;
      var id = 'h' + Date.now().toString(36);
      wrapRange(r, id, arg || '');
      s.removeAllRanges();
      toolReply({ a: 'highlight', id: id, t: text, n: n, note: arg || '', title: D.title.slice(0, 200) });
      break;
    }
    case 'unhighlight': unwrapHl(arg || 'all'); break;
    case 'clip': {
      var sel = String(W.getSelection ? W.getSelection() : '').trim();
      toolReply({ a: 'clip', t: sel.slice(0, 20000), title: D.title.slice(0, 200) });
      break;
    }
    case 'snip-insert': { var q = {}; try { q = JSON.parse(arg); } catch (e) {} if (q.k) snipInsert(String(q.k), String(q.v || '')); break; }
    case 'looks': { var lo = {}; try { lo = JSON.parse(arg) || {}; } catch (e) {} looks(lo); break; }
    case 'snapshot': {
      // For watched pages: the price, if the page shows one, and what the page says.
      var sn = { a: 'snapshot' }, pr = priceOf();
      if (pr) { sn.price = pr.v; sn.cur = pr.c; }
      var body = D.querySelector('main,[role="main"],article') || D.body;
      var txt = body ? String(body.innerText || '').replace(/[ \t\u00a0]+/g, ' ') : '';
      var lines = txt.split(/\n+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2; });
      var h = 0x811c9dc5, all = lines.join('\n');
      for (var hi = 0; hi < all.length; hi++) { h ^= all.charCodeAt(hi); h = Math.imul(h, 16777619) >>> 0; }
      sn.hash = h.toString(16) + ':' + all.length;
      var kept = [], size = 0;
      for (var li = 0; li < lines.length && size < 6000; li++) { var ln = lines[li].slice(0, 200); kept.push(ln); size += ln.length; }
      sn.lines = kept;
      sn.title = D.title.slice(0, 200);
      toolReply(sn);
      break;
    }
    case 'hints': hints(); break;
    case 'selraw': {
      var ae = D.activeElement, ed = ae && (ae.isContentEditable || /^(TEXTAREA|INPUT)$/.test(ae.tagName));
      var sx = ed && /^(TEXTAREA|INPUT)$/.test(ae.tagName) ? ae.value.slice(ae.selectionStart, ae.selectionEnd) : String(W.getSelection() || '');
      toolReply({ a: 'selraw', t: sx.slice(0, 50000), ed: ed && sx ? 1 : 0 });
      break;
    }
    case 'replacesel': {
      var ae2 = D.activeElement;
      if (ae2 && (ae2.isContentEditable || /^(TEXTAREA|INPUT)$/.test(ae2.tagName))) { ae2.focus(); D.execCommand('insertText', false, String(arg || '')); }
      break;
    }
    case 'summary': toolReply(summary()); break;
    case 'cite': toolReply(citation()); break;
    case 'pagetext': {
      var pr = D.querySelector('article,main,[role="main"]') || D.body;
      toolReply({ a: 'pagetext', t: pr ? String(pr.innerText || '').slice(0, 200000) : '', title: D.title.slice(0, 200) });
      break;
    }
    case 'printclean': {
      // Menus, banners, sidebars, ads and comments are left out of the printout only.
      var ps = new CSSStyleSheet();
      ps.replaceSync('@media print{header,nav,footer,aside,iframe,[role=banner],[role=navigation],[role=complementary],[role=contentinfo],' +
        '[id*=comment i],[class*=comment i],[class*=advert i],[id*=advert i],[class*=sidebar i],[class*=newsletter i],[class*=share i],[class*=social i],[class*=related i],[class*=cookie i]{display:none!important}' +
        'body{margin:0 auto!important;max-width:760px!important}img{max-width:100%!important}}');
      adopt(ps);
      W.addEventListener('afterprint', function () { ps.replaceSync(''); }, { once: true });
      setTimeout(function () { ps.replaceSync(''); }, 120000);
      toolReply({ a: 'printclean' });
      break;
    }
    case 'sticky-add': stickyPlace(); break;
    case 'draw': drawOn(); break;
    case 'eyedropper': eyedropper(); break;
    case 'ruler': ruler(); break;
    case 'searchform': toolReply({ a: 'searchform', u: searchTemplate(), n: (D.title || '').slice(0, 80) }); break;
    case 'feeds': {
      var fl = [];
      [].forEach.call(D.querySelectorAll('link[rel~=alternate][type*=rss],link[rel~=alternate][type*=atom],link[rel~=alternate][type*="feed+json"]'), function (x) {
        try { var fu = new URL(x.getAttribute('href'), L.href).href; if (/^https?:/.test(fu) && fl.length < 5) fl.push({ u: fu, t: (x.title || '').slice(0, 100) }); } catch (e) {}
      });
      toolReply({ a: 'feeds', f: fl, title: D.title.slice(0, 120) });
      break;
    }
    case 'seltext': {
      var st = W.getSelection(), stx = st && !st.isCollapsed ? String(st).trim().slice(0, 3000) : '';
      if (stx) { var sr = st.getRangeAt(0).getBoundingClientRect(); dictAt = { x: sr.left, y: sr.bottom, top: sr.top }; dictShow({ w: 'Translating…', loading: 1, tr: 1 }); }
      toolReply({ a: 'seltext', t: stx });
      break;
    }
    case 'selword': { var sw = selWord(); toolReply({ a: 'selword', w: sw || '' }); if (sw) dictShow({ w: sw, loading: 1 }); break; }
    case 'define-show': { var dq = null; try { dq = JSON.parse(arg); } catch (e) {} dictShow(dq); break; }
    case 'next-ep': {
      // The episode ended: press the page's Next episode button after a countdown.
      var n = nextEpisode();
      toolReply({ a: 'next-ep', ok: n ? 1 : 0 });
      if (n) countdown(n, Math.max(2, Math.min(15, +arg || 5)));
      break;
    }
    case 'perf': {
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
      var res = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
      var bytes = res.reduce(function (a, x) { return a + (x.transferSize || 0); }, nav ? nav.transferSize || 0 : 0);
      toolReply({ a: 'perf', ok: nav ? 1 : 0, load: nav ? Math.round(nav.loadEventEnd || nav.domComplete || 0) : 0, dom: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
        ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0, dns: nav ? Math.round(nav.domainLookupEnd - nav.domainLookupStart) : 0,
        n: res.length + 1, kb: Math.round(bytes / 1024) });
      break;
    }
    case 'goto': {
      var h = outlineEls[+arg];
      if (h) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { h.animate([{ background: 'rgba(232,52,42,.25)' }, { background: 'transparent' }], 1600); } catch (e) {} }
      break;
    }
  }
  return '';
}
/* ---- a product page's price: structured data first, then the usual places */
function priceNum(x) {
  var t = String(x == null ? '' : x).replace(/[^\d.,]/g, '');
  if (!t) return NaN;
  var c = t.lastIndexOf(','), d = t.lastIndexOf('.');
  if (c >= 0 && d >= 0) t = c > d ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (c >= 0) t = /,\d{1,2}$/.test(t) && t.split(',').length === 2 ? t.replace(',', '.') : t.replace(/,/g, '');
  else if (t.split('.').length > 2) t = t.replace(/\./g, '');
  return parseFloat(t);
}
function priceOf() {
  var found = null;
  var walk = function (o, offer, depth) {
    if (found || !o || typeof o !== 'object' || depth > 8) return;
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], offer, depth + 1); return; }
    var ty = [].concat(o['@type'] || []).join(' ');
    var isOffer = offer || /Offer/.test(ty);
    if (isOffer) {
      var v = priceNum(o.price != null ? o.price : o.lowPrice != null ? o.lowPrice : o.priceSpecification && o.priceSpecification.price);
      if (v > 0) { found = { v: v, c: String(o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency) || '').slice(0, 8) }; return; }
    }
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] && typeof o[k] === 'object') walk(o[k], k === 'offers', depth + 1);
  };
  var js = D.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < js.length && !found; i++) { try { walk(JSON.parse(js[i].textContent), false, 0); } catch (e) {} }
  if (found) return found;
  var meta = function (sel) { var m = D.querySelector(sel); return m ? (m.getAttribute('content') || m.textContent || '') : ''; };
  var v = priceNum(meta('meta[property="product:price:amount"],meta[property="og:price:amount"],[itemprop="price"]'));
  if (v > 0) return { v: v, c: meta('meta[property="product:price:currency"],meta[property="og:price:currency"],[itemprop="priceCurrency"]').slice(0, 8) };
  var sels = ['#corePrice_feature_div .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice',
    '[data-testid="customer-price"]', '[data-testid="price"]', '[data-test="product-price"]', '.product-price', '.price-current'];
  for (var j = 0; j < sels.length; j++) {
    var e = D.querySelector(sels[j]);
    var tx = e && (e.textContent || '').trim();
    if (tx && tx.length < 30 && /\d/.test(tx)) {
      v = priceNum(tx);
      if (v > 0) { var cm = /[$€£¥₹]|[A-Z]{3}/.exec(tx); return { v: v, c: cm ? cm[0] : '' }; }
    }
  }
  return null;
}
/* ---- click effects: a ripple or sparkles where you click */
var clickFx = '';
W.addEventListener('pointerdown', function (e) {
  if (!clickFx || !e.isTrusted || e.button !== 0) return;
  try {
    var host = D.createElement('wsb-badge');
    host.style.cssText = 'all:initial;position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:2147483647;pointer-events:none';
    var root = host.attachShadow({ mode: 'closed' });
    if (clickFx === 'sparkle') {
      var h = '<style>i{position:absolute;width:6px;height:6px;border-radius:50%;left:-3px;top:-3px;animation:f .55s ease-out forwards}@keyframes f{to{transform:translate(var(--x),var(--y)) scale(.2);opacity:0}}</style>';
      var cols = ['#ffd84d', '#ff6aa2', '#7ce0ff', '#9dff8a', '#e8342a'];
      for (var i = 0; i < 9; i++) { var a = i / 9 * 6.283, r = 18 + Math.random() * 14; h += '<i style="background:' + cols[i % 5] + ';--x:' + Math.round(Math.cos(a) * r) + 'px;--y:' + Math.round(Math.sin(a) * r) + 'px"></i>'; }
      root.innerHTML = h;
    } else root.innerHTML = '<style>b{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:2px solid rgba(232,52,42,.8);animation:r .45s ease-out forwards}@keyframes r{from{transform:scale(.2);opacity:1}to{transform:scale(1);opacity:0}}</style><b></b>';
    (D.body || D.documentElement).appendChild(host);
    setTimeout(function () { host.remove(); }, 650);
  } catch (x) {}
}, true);

/* ---- form saver: long text you type is kept, and offered back if the page is closed or crashes */
var draftsOn = false, draftT = 0, draftOffer = null;
function draftKey(el) {
  var tag = el.isContentEditable ? 'ce' : el.tagName.toLowerCase(), same = [].slice.call(D.querySelectorAll(tag === 'ce' ? '[contenteditable=""],[contenteditable=true]' : tag));
  return (tag + ':' + (el.name || el.id || '') + ':' + same.indexOf(el)).slice(0, 120);
}
function draftField(el) {
  if (!el || !el.tagName) return null;
  if (el.tagName === 'TEXTAREA') return el;
  if (el.isContentEditable) { var r = el; while (r.parentElement && r.parentElement.isContentEditable) r = r.parentElement; return r; }
  return null;
}
W.addEventListener('input', function (e) {
  if (!draftsOn || !e.isTrusted || !TOP) return;
  var el = draftField(e.target);
  if (!el || /card|cc-|cvc|password|secret|token/i.test((el.name || '') + (el.id || '') + (el.getAttribute('autocomplete') || ''))) return;
  clearTimeout(draftT);
  draftT = setTimeout(function () {
    var t = el.tagName === 'TEXTAREA' ? el.value : el.innerText;
    if ((t || '').trim().length >= 20) post('tool', { a: 'draft', k: draftKey(el), t: String(t).slice(0, 20000) });
  }, 1500);
}, true);
W.addEventListener('submit', function (e) { if (draftsOn && e.isTrusted && TOP) post('tool', { a: 'draft', clear: 1 }); }, true);
function offerDrafts(d) {
  if (!d || typeof d !== 'object') return;
  var go = function () {
    var found = [];
    [].forEach.call(D.querySelectorAll('textarea,[contenteditable=""],[contenteditable=true]'), function (el) {
      var f = draftField(el), k = f && draftKey(f);
      if (f && d[k] && found.indexOf(f) < 0 && !(f.tagName === 'TEXTAREA' ? f.value : f.innerText).trim()) found.push([f, d[k]]);
    });
    if (!found.length) return;
    badge('You were typing something here before', { label: 'Restore it', fn: function () {
      found.forEach(function (x) { var f = x[0], t = String(x[1]); if (f.tagName === 'TEXTAREA') f.value = t; else f.innerText = t; f.dispatchEvent(new Event('input', { bubbles: true })); });
    } }, 12000);
  };
  if (D.readyState === 'complete') setTimeout(go, 800); else W.addEventListener('load', function () { setTimeout(go, 800); });
}

/* ---- reading position: long pages remember how far you read */
var rpOn = false, rpT = 0;
W.addEventListener('scroll', function (e) {
  if (!rpOn || !TOP || !e.isTrusted) return;
  clearTimeout(rpT);
  rpT = setTimeout(function () {
    var h = D.documentElement.scrollHeight - W.innerHeight;
    if (h > W.innerHeight * 2) post('tool', { a: 'readpos', p: Math.round(W.scrollY / h * 1000) / 1000 });
  }, 1500);
}, true);
function offerReadPos(p) {
  if (!(p > 0.05 && p < 0.97)) return;
  var go = function () {
    var h = D.documentElement.scrollHeight - W.innerHeight;
    if (h < W.innerHeight * 2 || W.scrollY > h * 0.05) return;           // short page, or already scrolled
    badge('You read ' + Math.round(p * 100) + '% of this last time', { label: 'Continue', fn: function () { W.scrollTo({ top: p * h, behavior: 'smooth' }); } }, 9000);
  };
  if (D.readyState === 'complete') setTimeout(go, 600); else W.addEventListener('load', function () { setTimeout(go, 600); });
}

/* ---- sticky notes, pinned to a spot on a page */
var sticky = { list: [], hosts: {}, placing: false };
var STICKY_COL = { y: '#fff3a3', p: '#ffd0e4', b: '#cfe6ff', g: '#d3f5d0' };
function stickySave() { post('tool', { a: 'sticky', notes: sticky.list.map(function (n) { return { id: n.id, x: Math.round(n.x), y: Math.round(n.y), t: n.t.slice(0, 2000), c: n.c }; }) }); }
function stickyDraw(n, focus) {
  var host = sticky.hosts[n.id];
  if (!host) {
    host = D.createElement('wsb-badge');
    var root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>.n{width:210px;border-radius:6px 6px 14px 6px;box-shadow:0 8px 22px rgba(0,0,0,.28);font:13px/1.4 "Segoe UI",system-ui,sans-serif;color:#2b2618;animation:in .25s cubic-bezier(.2,.8,.2,1)}' +
      '@keyframes in{from{transform:scale(.85) rotate(-3deg);opacity:0}}.h{display:flex;gap:4px;align-items:center;padding:4px 6px;cursor:move;border-bottom:1px solid rgba(0,0,0,.08)}' +
      '.h i{width:12px;height:12px;border-radius:50%;cursor:pointer;border:1px solid rgba(0,0,0,.2)}.h span{flex:1}.h b{cursor:pointer;opacity:.55;font-weight:600;padding:0 4px}.h b:hover{opacity:1}' +
      'textarea{display:block;width:100%;box-sizing:border-box;min-height:80px;border:0;background:none;resize:vertical;padding:7px 9px;font:inherit;color:inherit;outline:0}' +
      '@media (prefers-reduced-motion:reduce){.n{animation:none}}</style><div class="n"><div class="h"><i data-c="y"></i><i data-c="p"></i><i data-c="b"></i><i data-c="g"></i><span></span><b title="Delete">\u2715</b></div><textarea placeholder="Your note"></textarea></div>';
    var box = root.querySelector('.n'), ta = root.querySelector('textarea');
    [].forEach.call(root.querySelectorAll('i'), function (i) { i.style.background = STICKY_COL[i.dataset.c]; i.onclick = function (e) { if (!e.isTrusted) return; n.c = i.dataset.c; box.style.background = STICKY_COL[n.c]; stickySave(); }; });
    ta.addEventListener('input', function (e) { if (!e.isTrusted) return; n.t = ta.value; clearTimeout(n.st); n.st = setTimeout(stickySave, 500); });
    root.querySelector('b').onclick = function (e) { if (!e.isTrusted) return; host.remove(); delete sticky.hosts[n.id]; sticky.list = sticky.list.filter(function (x) { return x !== n; }); stickySave(); };
    root.querySelector('.h').addEventListener('pointerdown', function (e) {
      if (!e.isTrusted || e.target.tagName !== 'DIV' && e.target.tagName !== 'SPAN') return;
      var sx = e.pageX - n.x, sy = e.pageY - n.y;
      var mv = function (m) { n.x = m.pageX - sx; n.y = m.pageY - sy; host.style.left = n.x + 'px'; host.style.top = n.y + 'px'; };
      var up = function (u) { W.removeEventListener('pointermove', mv, true); W.removeEventListener('pointerup', up, true); if (u.isTrusted) stickySave(); };
      W.addEventListener('pointermove', mv, true); W.addEventListener('pointerup', up, true);
    });
    ta.value = n.t || '';
    box.style.background = STICKY_COL[n.c] || STICKY_COL.y;
    sticky.hosts[n.id] = host;
    (D.body || D.documentElement).appendChild(host);
    if (focus) setTimeout(function () { ta.focus(); }, 0);
  }
  host.style.cssText = 'all:initial;position:absolute;z-index:2147483646;left:' + n.x + 'px;top:' + n.y + 'px';
  return host;
}
function stickyPlace() {
  if (sticky.placing) return;
  sticky.placing = true;
  badge('Click where the note should go (Esc to cancel)', null, 5000);
  var done = function () { sticky.placing = false; W.removeEventListener('click', pick, true); W.removeEventListener('keydown', esc, true); };
  var pick = function (e) {
    if (!e.isTrusted) return;
    e.preventDefault(); e.stopImmediatePropagation(); done();
    var n = { id: 's' + Date.now().toString(36), x: e.pageX, y: e.pageY, t: '', c: 'y' };
    sticky.list.push(n);
    stickyDraw(n, true);
    stickySave();
  };
  var esc = function (e) { if (e.key === 'Escape') done(); };
  W.addEventListener('click', pick, true); W.addEventListener('keydown', esc, true);
}

/* ---- draw on the page: pen, highlighter and eraser, which scroll with the page */
var drawState = null;
function drawOn() {
  if (drawState) { drawOff(); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>canvas{position:fixed;inset:0;cursor:crosshair}.bar{position:fixed;top:12px;right:12px;display:flex;gap:4px;align-items:center;padding:6px;border-radius:12px;' +
    'background:rgba(24,21,28,.94);box-shadow:0 10px 30px rgba(0,0,0,.4);font:600 12px "Segoe UI",system-ui,sans-serif;animation:in .25s cubic-bezier(.2,.8,.2,1)}@keyframes in{from{transform:translateY(-12px);opacity:0}}' +
    'button{height:28px;min-width:28px;padding:0 8px;border:0;border-radius:7px;background:none;color:#ddd;cursor:pointer;font:inherit}button:hover{background:rgba(255,255,255,.1)}button.on{background:#e8342a;color:#fff}' +
    'i{display:block;width:16px;height:16px;border-radius:50%;border:2px solid transparent}button.c.on{background:rgba(255,255,255,.15)}</style>' +
    '<canvas></canvas><div class="bar"><button data-t="pen" class="on">Pen</button><button data-t="hl">Highlighter</button><button data-t="er">Eraser</button>' +
    '<button class="c on" data-c="#e8342a"><i style="background:#e8342a"></i></button><button class="c" data-c="#3b8bf0"><i style="background:#3b8bf0"></i></button><button class="c" data-c="#3fb971"><i style="background:#3fb971"></i></button><button class="c" data-c="#111111"><i style="background:#111"></i></button>' +
    '<button data-x="clear">Clear</button><button data-x="done">Done</button></div>';
  var cv = root.querySelector('canvas'), g = cv.getContext('2d');
  var st = { host: host, strokes: [], cur: null, tool: 'pen', color: '#e8342a' };
  var size = function () { var k = W.devicePixelRatio || 1; cv.width = W.innerWidth * k; cv.height = W.innerHeight * k; cv.style.width = W.innerWidth + 'px'; cv.style.height = W.innerHeight + 'px'; g.setTransform(k, 0, 0, k, 0, 0); render(); };
  var render = function () {
    g.clearRect(0, 0, W.innerWidth, W.innerHeight);
    st.strokes.concat(st.cur ? [st.cur] : []).forEach(function (s) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      if (s.t === 'er') { g.globalCompositeOperation = 'destination-out'; g.lineWidth = 26; }
      else if (s.t === 'hl') { g.globalAlpha = .35; g.lineWidth = 18; g.strokeStyle = s.c; }
      else { g.lineWidth = 3.5; g.strokeStyle = s.c; }
      g.beginPath();
      s.p.forEach(function (q, i) { var x = q[0] - W.scrollX, y = q[1] - W.scrollY; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke(); g.restore();
    });
  };
  cv.addEventListener('pointerdown', function (e) { if (!e.isTrusted) return; cv.setPointerCapture(e.pointerId); st.cur = { t: st.tool, c: st.color, p: [[e.clientX + W.scrollX, e.clientY + W.scrollY]] }; });
  cv.addEventListener('pointermove', function (e) { if (st.cur) { st.cur.p.push([e.clientX + W.scrollX, e.clientY + W.scrollY]); render(); } });
  cv.addEventListener('pointerup', function () { if (st.cur) { st.strokes.push(st.cur); st.cur = null; render(); } });
  cv.addEventListener('wheel', function (e) { W.scrollBy(e.deltaX, e.deltaY); }, { passive: true });
  [].forEach.call(root.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { st.tool = b.dataset.t; [].forEach.call(root.querySelectorAll('[data-t]'), function (x) { x.classList.toggle('on', x === b); }); }; });
  [].forEach.call(root.querySelectorAll('[data-c]'), function (b) { b.onclick = function () { st.color = b.dataset.c; [].forEach.call(root.querySelectorAll('[data-c]'), function (x) { x.classList.toggle('on', x === b); }); if (st.tool === 'er') root.querySelector('[data-t=pen]').click(); }; });
  root.querySelector('[data-x=clear]').onclick = function () { st.strokes = []; render(); };
  root.querySelector('[data-x=done]').onclick = drawOff;
  st.key = function (e) { if (e.key === 'Escape') drawOff(); if (e.ctrlKey && e.key.toLowerCase() === 'z' && e.isTrusted) { st.strokes.pop(); render(); e.preventDefault(); } };
  st.scroll = render; st.size = size;
  W.addEventListener('keydown', st.key, true); W.addEventListener('scroll', render, true); W.addEventListener('resize', size);
  (D.body || D.documentElement).appendChild(host);
  drawState = st; size();
  badge('Draw on the page. Esc or Done to finish, Ctrl+Z to undo', null, 3000);
}
function drawOff() {
  if (!drawState) return;
  W.removeEventListener('keydown', drawState.key, true); W.removeEventListener('scroll', drawState.scroll, true); W.removeEventListener('resize', drawState.size);
  drawState.host.remove(); drawState = null;
}

/* ---- color picker (the system eyedropper, started by your click) and a ruler */
function eyedropper() {
  if (!W.EyeDropper) { toolReply({ a: 'color', err: 'none' }); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>button{font:600 13px "Segoe UI",system-ui,sans-serif;border:0;border-radius:10px;padding:10px 16px;background:#e8342a;color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}</style><button>Click here, then click any color on the screen</button>';
  root.querySelector('button').onclick = function (e) {
    if (!e.isTrusted) return;
    host.remove();
    new W.EyeDropper().open().then(function (r) { post('tool', { a: 'color', c: String(r.sRGBHex || '').slice(0, 30) }); }).catch(function () {});
  };
  (D.body || D.documentElement).appendChild(host);
  setTimeout(function () { host.remove(); }, 15000);
}
var rulerState = null;
function ruler() {
  if (rulerState) { rulerState.off(); return; }
  var host = D.createElement('wsb-badge');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;cursor:crosshair';
  var root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = '<style>.r{position:fixed;border:1.5px dashed #e8342a;background:rgba(232,52,42,.08);pointer-events:none}.l{position:fixed;font:600 12px Consolas,monospace;color:#fff;background:#e8342a;border-radius:5px;padding:3px 7px;pointer-events:none;white-space:nowrap}' +
    '.tip{position:fixed;left:50%;top:14px;transform:translateX(-50%);font:600 12px "Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(24,21,28,.92);border-radius:9px;padding:8px 12px}</style>' +
    '<div class="tip">Drag to measure. Esc to finish.</div><div class="r" hidden></div><div class="l" hidden></div>';
  var r = root.querySelector('.r'), l = root.querySelector('.l'), a = null;
  host.addEventListener('pointerdown', function (e) { if (!e.isTrusted) return; a = [e.clientX, e.clientY]; host.setPointerCapture(e.pointerId); r.hidden = l.hidden = false; });
  host.addEventListener('pointermove', function (e) {
    if (!a) return;
    var x = Math.min(a[0], e.clientX), y = Math.min(a[1], e.clientY), w = Math.abs(e.clientX - a[0]), h = Math.abs(e.clientY - a[1]);
    r.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    l.textContent = Math.round(w) + ' \u00d7 ' + Math.round(h) + ' px  \u00b7  ' + Math.round(Math.hypot(w, h)) + ' px across';
    l.style.left = (e.clientX + 12) + 'px'; l.style.top = (e.clientY + 12) + 'px';
  });
  host.addEventListener('pointerup', function () { a = null; });
  var key = function (e) { if (e.key === 'Escape') off(); };
  var off = function () { host.remove(); W.removeEventListener('keydown', key, true); rulerState = null; };
  W.addEventListener('keydown', key, true);
  (D.body || D.documentElement).appendChild(host);
  rulerState = { off: off };
}

/* ---- a summary: the sentences that carry the most of the page's own words */
var STOP = ' a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they them his her our your their not no so than then there here what which who whom when where why how all any both each few more most other some such only own same too very can will just do does did has have had into over under again about after before up down out off also may might would could should said says one two new like get got ';
function summary() {
  var root = D.querySelector('article') || D.querySelector('main,[role="main"]') || D.body;
  var text = root ? String(root.innerText || '') : '';
  var sents = [];
  text.split(/\n+/).forEach(function (para) {
    if (para.split(/\s+/).length < 8) return;
    (para.match(/[^.!?]+[.!?]+["')\]]?/g) || [para]).forEach(function (x) { x = x.trim(); var n = x.split(/\s+/).length; if (n >= 7 && n <= 60) sents.push(x); });
  });
  var words = text.toLowerCase().match(/[a-z\u00c0-\u024f']{3,}/g) || [], freq = {};
  words.forEach(function (w) { if (STOP.indexOf(' ' + w + ' ') < 0) freq[w] = (freq[w] || 0) + 1; });
  var scored = sents.map(function (x, i) {
    var ws = x.toLowerCase().match(/[a-z\u00c0-\u024f']{3,}/g) || [], sc = 0;
    ws.forEach(function (w) { sc += freq[w] || 0; });
    return { i: i, x: x, s: sc / Math.sqrt(ws.length || 1) * (i < 3 ? 1.25 : 1) };
  });
  var n = Math.max(3, Math.min(7, Math.round(sents.length / 12)));
  var top = scored.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, n).sort(function (a, b) { return a.i - b.i; });
  return { a: 'summary', s: top.map(function (x) { return x.x.slice(0, 600); }), words: words.length, title: D.title.slice(0, 200) };
}
/* ---- citation facts: title, author, site, date, address */
function citation() {
  var m = function (sel, attr) { var e = D.querySelector(sel); return e ? String(e.getAttribute(attr || 'content') || '').trim() : ''; };
  var ld = {};
  [].forEach.call(D.querySelectorAll('script[type="application/ld+json"]'), function (x) {
    try { [].concat(JSON.parse(x.textContent)).forEach(function (o) { [].concat(o['@graph'] || o).forEach(function (g) {
      if (g && /Article|Posting|Report|WebPage/.test([].concat(g['@type'] || []).join(' '))) {
        if (!ld.author && g.author) ld.author = [].concat(g.author).map(function (a) { return typeof a === 'string' ? a : a && a.name; }).filter(Boolean).join(', ');
        if (!ld.date && (g.datePublished || g.dateCreated)) ld.date = g.datePublished || g.dateCreated;
        if (!ld.title && g.headline) ld.title = g.headline;
      } }); }); } catch (e) {}
  });
  var h1 = D.querySelector('h1');
  return { a: 'cite',
    title: (ld.title || m('meta[property="og:title"]') || (h1 && h1.textContent.trim()) || D.title).slice(0, 300),
    author: (ld.author || m('meta[name="author"]') || m('meta[property="article:author"]') || (D.querySelector('[rel=author]') ? D.querySelector('[rel=author]').textContent.trim() : '')).slice(0, 200),
    site: (m('meta[property="og:site_name"]') || HOST).slice(0, 120),
    date: (ld.date || m('meta[property="article:published_time"]') || m('meta[name="date"]') || m('time[datetime]', 'datetime')).slice(0, 40),
    url: (m('link[rel=canonical]', 'href') || L.href).slice(0, 2000) };
}
/* ---- the site's own search as an address bar keyword */
function searchTemplate() {
  var inp = D.querySelector('input[type=search],[role=search] input[type=text],input[name=q],input[name=query],input[name=search_query],input[name=search],input[name=s],input[name=k],input[name=keyword],input[name=term]');
  if (!inp) return '';
  var f = inp.form;
  try {
    if (f && (f.getAttribute('method') || 'get').toLowerCase() === 'get') {
      var u = new URL(f.getAttribute('action') || L.href, L.href);
      if (!/^https?:$/.test(u.protocol)) return '';
      u.search = '';
      var parts = [];
      [].forEach.call(f.elements, function (el) {
        if (!el.name || el.disabled || /^(submit|button|image|reset|file|password)$/i.test(el.type)) return;
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        parts.push(encodeURIComponent(el.name) + '=' + (el === inp ? '%s' : encodeURIComponent(el.value)));
      });
      if (parts.join('&').indexOf('%s') < 0) return '';
      return u.href.split('#')[0] + '?' + parts.join('&');
    }
    // no plain form: the address already holds what is in the search box
    var val = (inp.value || '').trim();
    if (!val) return '';
    var cur = new URL(L.href), hit = '';
    cur.searchParams.forEach(function (v, k) { if (!hit && v.trim() === val) hit = k; });
    if (!hit) return '';
    cur.searchParams.set(hit, '\u0001');
    return cur.href.replace(encodeURIComponent('\u0001'), '%s');
  } catch (e) { return ''; }
}

/* ---- next episode: a link or button that says so, on the page that played it */
function nextEpisode() {
  var here = L.href.split('#')[0], strong = null, weak = null;
  var els = D.querySelectorAll('a[href],button,[role="button"]');
  for (var i = 0; i < els.length && i < 5000; i++) {
    var e = els[i];
    if (!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) || e.disabled || e.getAttribute('aria-disabled') === 'true') continue;
    var t = ((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '') + ' ' + (e.getAttribute('title') || '')).replace(/\s+/g, ' ').trim().toLowerCase();
    if (t.length > 80) continue;
    if (e.tagName === 'A') {
      var h = ''; try { h = new URL(e.getAttribute('href'), L.href).href.split('#')[0]; } catch (x) { continue; }
      if (!/^https?:/.test(h) || h === here) continue;
    }
    var cls = typeof e.className === 'string' ? e.className + ' ' + (e.id || '') : '';
    if (/\bnext\s*(episode|ep\b|chapter|part|lesson|video)|\b(episode|ep)\s*suivant|siguiente\s*episodio|n[aä]chste\s*folge/.test(t) || /next[-_]?ep(isode)?\b|nextepisode/i.test(cls)) { strong = e; break; }
    if (!weak && e.tagName === 'A' && /^(next|next ?[›»>\u25b6\u23ed]|[›»\u23ed])$/.test(t)) weak = e;
  }
  return strong || weak;
}
function countdown(el, secs) {
  try {
    var host = D.createElement('wsb-badge');
    host.style.cssText = 'all:initial;position:fixed;right:22px;bottom:22px;z-index:2147483647';
    var root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>div{font:600 14px "Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(22,19,26,.94);' +
      'border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px 14px;display:flex;gap:10px;align-items:center;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.45)}button{font:inherit;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;background:#e8342a;color:#fff}' +
      'button.c{background:rgba(255,255,255,.12)}</style><div><span></span><button>Play now</button><button class="c">Cancel</button></div>';
    var span = root.querySelector('span'), left = secs, timer = 0;
    var paint = function () { span.textContent = 'Next episode in ' + left; };
    var go = function () { clearInterval(timer); host.remove(); try { el.click(); } catch (e) {} };
    root.querySelector('button').onclick = function (e) { e.stopPropagation(); go(); };
    root.querySelector('.c').onclick = function (e) { e.stopPropagation(); clearInterval(timer); host.remove(); };
    paint();
    var fe = D.fullscreenElement;
    (fe && fe.tagName !== 'IFRAME' ? fe : D.body || D.documentElement).appendChild(host);
    // Gone from the page (the site replaced it, or you moved on): no jump.
    timer = setInterval(function () { if (!host.isConnected) { clearInterval(timer); return; } left--; if (left <= 0) go(); else paint(); }, 1000);
  } catch (e) {}
}
try { Object.defineProperty(W, Symbol.for('wsb.tool'), { value: tool, configurable: false, writable: false }); } catch (e) {}

/* ------------------------------------------------------------------ continue watching
   Long videos (over three minutes, so never ads) report where they are every
   few seconds. The new tab page lists them; opening one again offers to jump
   back to that point. */
var RESUME = 0, resumeOffered = false;
/* The card's preview is a small frame of the video itself. Protected (DRM)
   video draws black and cross-origin video cannot be read; both give nothing,
   and the card uses the page's own preview picture instead (see posters). */
function frameOf(v) {
  try {
    if (!v.videoWidth || !v.videoHeight || v.readyState < 2) return '';
    var w = 320, h = Math.max(1, Math.round(w * v.videoHeight / v.videoWidth));
    if (h > 240) { h = 240; w = Math.max(1, Math.round(h * v.videoWidth / v.videoHeight)); }
    var c = D.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    DRAW0.call(x, v, 0, 0, w, h);
    var px = GID0.call(x, 0, 0, w, h).data, lit = 0, n = 0;
    for (var i = 0; i < px.length; i += 4 * 61) { n++; if (px[i] + px[i + 1] + px[i + 2] > 60) lit++; }
    if (lit < n * 0.02) return '';
    return TDU0.call(c, 'image/jpeg', 0.72);
  } catch (e) { return ''; }
}
function posters() {
  if (!TOP) return;
  var sent = '';
  var check = function () {
    if (D.hidden) return;
    try {
      if (!D.querySelector('video,iframe[allowfullscreen],iframe[allow*="fullscreen"]')) return;
      var m = D.querySelector('meta[property="og:image"],meta[name="og:image"],meta[name="twitter:image"],meta[property="twitter:image"]');
      var u = m && m.content ? new URL(m.content, L.href).href : '';
      if (!/^https:\/\//.test(u) || u.length > 2000 || u + L.href === sent) return;
      sent = u + L.href;
      post('poster', { u: u });
    } catch (e) {}
  };
  setTimeout(check, 3000);
  setInterval(check, 10000);
}
function trackVideos() {
  if (!CFG.cw) return;
  posters();
  var last = 0, lastShot = 0;
  var report = function (v, force) {
    if (!(v instanceof HTMLVideoElement) || !isFinite(v.duration) || v.duration < 180) return;
    var now = Date.now();
    if (!force && now - last < 8000) return;
    last = now;
    var m = { t: Math.round(v.currentTime), d: Math.round(v.duration) };
    if (force || now - lastShot > 20000) {
      var img = frameOf(v);
      if (img) { m.img = img; lastShot = now; }
    }
    post('watch', m);
  };
  D.addEventListener('timeupdate', function (e) { report(e.target, false); }, true);
  D.addEventListener('pause', function (e) { report(e.target, true); }, true);
  D.addEventListener('ended', function (e) { report(e.target, true); }, true);
  W.addEventListener('pagehide', function () { var v = bestVideo(); if (v) report(v, true); });
  D.addEventListener('playing', function (e) {
    var v = e.target;
    if (resumeOffered || !RESUME || !(v instanceof HTMLVideoElement) || !isFinite(v.duration) || v.duration < 180) return;
    if (v.currentTime > 20 || RESUME < 30 || RESUME > v.duration - 30) return;
    resumeOffered = true;
    var at = RESUME;
    badge('You stopped at ' + clock(at), { label: 'Resume', fn: function () { v.currentTime = at; } }, 12000);
  }, true);
}

/* ------------------------------------------------------------------ SponsorBlock
   Segments the SponsorBlock community has marked in YouTube videos (sponsor
   reads, self-promotion, "like and subscribe") are skipped automatically. The
   lookup goes through the shell, which only sends a hash prefix of the video
   id, so the service cannot tell which video is being watched. */
var SB = { id: '', segs: [] };
try {
  Object.defineProperty(W, Symbol.for('wsb.sb'), { configurable: true, value: function (id, segs) {
    if (id === SB.id && Array.isArray(segs)) SB.segs = segs;
  } });
} catch (e) {}
function sponsorBlock() {
  if (!CFG.sb || !TOP) return;
  var videoId = function () {
    var m = /[?&]v=([\w-]{11})/.exec(L.search) || /^\/shorts\/([\w-]{11})/.exec(L.pathname);
    return m ? m[1] : '';
  };
  setInterval(function () {
    var id = videoId();
    if (id && id !== SB.id) { SB.id = id; SB.segs = []; post('sb', { id: id }); }
  }, 1000);
  D.addEventListener('timeupdate', function (e) {
    var v = e.target;
    if (!(v instanceof HTMLVideoElement) || !SB.segs.length) return;
    var p = D.querySelector('#movie_player');
    if (p && p.classList.contains('ad-showing')) return;
    var t = v.currentTime;
    for (var i = 0; i < SB.segs.length; i++) {
      var s = SB.segs[i];
      if (t >= s[0] && t < s[1] - 0.4 && s[1] - s[0] > 1) {
        v.currentTime = s[1];
        badge('Skipped ' + (s[2] === 'selfpromo' ? 'self-promotion' : s[2] === 'interaction' ? 'a subscribe reminder' : 'a sponsor'));
        break;
      }
    }
  }, true);
}

/* ------------------------------------------------------------------ dark mode for every site
   Pages without a dark theme are inverted, and pictures and video are inverted
   back so they look right. A page that is already dark is left alone. */
function darkMode() {
  if (!CFG.dark || !SAME_SITE) return;
  var s = new CSSStyleSheet();
  s.replaceSync('html{filter:invert(.92) hue-rotate(180deg)!important;background-color:#fff!important}' +
    'img,video,picture,canvas,iframe,embed,object,svg image,[style*="background-image"],[role="img"]' +
    '{filter:invert(1) hue-rotate(180deg)!important}');
  adopt(s);
  onReady(function () {
    setTimeout(function () {
      var lum = function (el) {
        if (!el) return 1;
        var m = /rgba?\((\d+), *(\d+), *(\d+)(?:, *([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
        if (!m || (m[4] !== undefined && +m[4] < 0.1)) return -1;
        return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
      };
      var b = lum(D.body), h = lum(D.documentElement);
      var l = b >= 0 ? b : h >= 0 ? h : 1;
      if (l < 0.4) { s.replaceSync(''); }                  // already dark
    }, 50);
  });
}

/* ------------------------------------------------------------------ payload
   receive() is handed the site-specific payload by the shell's second script.
   A page could call it too, but all it can do is hide things on its own page. */
var genericDone = false, specificDone = false, modulesDone = false, toolsDone = false;
function receive(p) {
  if (!p || typeof p !== 'object') return;
  var f = p.f | 0;
  if (!toolsDone && p.k) {
    toolsDone = true;
    TOKEN = String(p.k);
    RESUME = +p.r || 0;
    trackVideos();
    if (!p.dk) darkMode();
    if (TOP && /(^|\.)(youtube\.com|youtubekids\.com)$/.test(HOST)) sponsorBlock();
  }
  if (!CFG.on || (f & 1)) return;                      // Shield off, or off for this site
  var mine = !!p.h && (HOST === p.h || (!HOST && SAME_SITE));
  if (mine && !specificDone) {
    specificDone = true;
    if (p.js && p.js.length) runScriptlets(p.js);
    if (!(f & 2) && !(f & 8)) {
      if (p.css && p.css.length) adopt(hideRules(p.css));
      if (p.st && p.st.length) adopt(sheetOf(p.st.map(function (x) { return x[0] + '{' + x[1] + '}'; })));
      if (p.pr && p.pr.length) procedural(p.pr);
    }
  }
  if (!genericDone && SAME_SITE && CFG.cos && !(f & 2) && !(f & 4) && G.length) {
    genericDone = true;
    var t0 = performance.now();
    var list = G;
    if (p.ux && p.ux.length) {
      var ux = new Set(p.ux);
      list = G.filter(function (s) { return !ux.has(s); });
    }
    adopt(hideRules(list));
    try { W[Symbol.for('wsb.ms')] = performance.now() - t0; } catch (e) {}
  }
  if (!modulesDone && TOP) {
    modulesDone = true;
    if (CFG.yt && /(^|\.)(youtube\.com|youtube-nocookie\.com|youtubekids\.com)$/.test(HOST)) youtube();
    if (CFG.ck) cookies();
  }
}
var K = Symbol.for('wsb.p'), Q = Symbol.for('wsb.q');
try { Object.defineProperty(W, K, { value: receive, configurable: true }); } catch (e) {}
if (W[Q]) { var early = W[Q]; try { delete W[Q]; } catch (e) {} receive(early); }
// If the site payload never arrives (it is registered while the page loads),
// generic hiding still applies once the document is ready.
onReady(function () { if (!genericDone) receive({ h: '', f: 0 }); });
})();
