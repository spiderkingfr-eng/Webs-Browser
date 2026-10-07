/* Jarvis for Webs - the screenshot's size.
   fitSize shrinks the screen's width and height so the longest side is at most "max", keeping the shape, so the
   picture that's sent stays small (and under the server's 1.5 MB limit). Pure maths, so it can be tested; the actual
   grab and JPEG happen in main.js with Electron's nativeImage. tooBig() checks a data URL against a byte limit. */
"use strict";

function fitSize(w, h, max) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); max = Math.max(1, Math.round(max || 1280));
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scale: k };
}

// base64 is about 4 bytes per 3 bytes of data; the server limit is 2,000,000 base64 characters (~1.5 MB)
function base64Bytes(dataUrl) {
  const i = String(dataUrl || "").indexOf(",");
  return i < 0 ? 0 : (dataUrl.length - i - 1);
}
function tooBig(dataUrl, maxChars) {
  return base64Bytes(dataUrl) > (maxChars || 2000000);
}

module.exports = { fitSize, base64Bytes, tooBig };
