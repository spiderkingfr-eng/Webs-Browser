// Jarvis for Webs - tests for the parts that don't need a screen, a microphone or Electron: node test/test.js
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const config = require("../lib/config"), wake = require("../lib/wake"), ai = require("../lib/ai"), shot = require("../lib/shot");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) pass++; else { fail++; console.log("  FAIL:", w); } };

/* config */
(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-"));
  const c = config.load(dir);
  ok(c.name === "Jarvis" && c.style === "calm" && c.voice === true, "defaults");
  ok(/^dev-[0-9a-f]{16}$/.test(c.device), "a device id is made");
  ok(fs.existsSync(config.file(dir)), "config.json is written");
  const c2 = config.load(dir);
  ok(c2.device === c.device, "the device id is kept between runs");
  const saved = config.save(dir, { name: "  Friday  ", style: "nonsense", server: "https://x.dev/", callYou: "boss", maxWidth: 99999 });
  ok(saved.name === "Friday" && saved.style === "calm" && saved.server === "https://x.dev" && saved.callYou === "boss" && saved.maxWidth === 2560, "a saved config is cleaned");
  ok(config.wakeWord({ name: "Friday" }) === "friday", "the wake word is the name, lowercased");
  fs.rmSync(dir, { recursive: true, force: true });
})();

/* wake word */
(() => {
  let r = wake.detect("jarvis how do i make a furnace", "Jarvis");
  ok(r.hit && r.question === "how do i make a furnace", "jarvis + question");
  r = wake.detect("hey jarvis, what time is it", "Jarvis");
  ok(r.hit && r.question === "what time is it", "hey jarvis, with a comma");
  r = wake.detect("so i was thinking about lunch", "Jarvis");
  ok(!r.hit, "no wake word, no hit");
  r = wake.detect("FRIDAY turn on the lights", "Friday");
  ok(r.hit && r.question === "turn on the lights", "a custom name");
  r = wake.detect("jervis how do i craft a sword", "Jarvis");
  ok(r.hit && r.question === "how do i craft a sword", "a near-miss spelling still wakes it");
  ok(wake.looksComplete("how do i make a furnace") && !wake.looksComplete("hmm"), "a question needs a couple of words");
})();

/* ai request */
(() => {
  const cfg = { name: "Jarvis", callYou: "sir", style: "short", device: "dev-0123456789abcdef", code: "abc", sendScreenshot: true };
  const img = "data:image/jpeg;base64,AAAA";
  const b = ai.buildBody({ question: "how do i make a furnace", cfg, imageDataUrl: img, now: new Date("2026-10-07T12:00:00Z") });
  ok(b.task === "jarvis" && b.device === "dev-0123456789abcdef" && b.code === "abc", "task, device and code");
  ok(b.image && b.image.data === img, "the screenshot is attached");
  ok(/how do i make a furnace$/.test(b.messages[0].content), "the question is last");
  ok(/<assistant>[\s\S]*Jarvis[\s\S]*sir[\s\S]*<\/assistant>/.test(b.messages[0].content), "the <assistant> block has the name and what to call you");
  ok(/no tabs or browser commands/.test(b.messages[0].content), "it's told there's no browser here");
  const b2 = ai.buildBody({ question: "hi", cfg: Object.assign({}, cfg, { sendScreenshot: false }), imageDataUrl: img });
  ok(!b2.image, "no screenshot when that's off");
  ok(/screenshot of their screen[\s\S]*is attached/.test(b.messages[0].content), "it's told a screenshot is attached when one is");
  ok(/No screenshot is attached/.test(b2.messages[0].content), "and that none is when it's off");
  const b3 = ai.buildBody({ question: "what am i looking at", cfg, imageDataUrl: null });
  ok(!b3.image && /No screenshot is attached/.test(b3.messages[0].content), "a failed capture isn't described as attached");
  const long = ai.buildBody({ question: "x".repeat(5000), cfg });
  ok(long.messages[0].content.length < 3000, "a very long question is trimmed");
})();

/* streaming */
(() => {
  const r = ai.streamReader();
  let out = [];
  out = out.concat(r.push('{"d":"Put eight "}\n{"d":"cobble'));
  ok(out.length === 1 && out[0].text === "Put eight ", "a whole line is read, a part is kept");
  out = r.push('stone"}\n');
  ok(out.length === 1 && out[0].text === "cobblestone", "the rest of the line arrives");
  const done = r.push('{"end":1,"left":9,"stop":"end_turn"}\n');
  ok(done.length === 1 && done[0].end === true && done[0].left === 9, "the end line");
  ok(ai.parseLine('{"error":"limit","message":"no more today"}').error === "no more today", "an error line");
  ok(ai.parseLine("not json") === null, "junk is ignored");
})();

/* cleaning */
(() => {
  ok(ai.cleanForSpeech("Sure **thing**. [[do: open youtube]] Here `you` go.") === "Sure thing.  Here you go.".replace(/\s+/g, " "), "speech text drops markdown and [[do:]]");
  ok(ai.cleanForShow("Line one [[do: x]]\n\n\n\nLine two") === "Line one \n\nLine two", "shown text drops [[do:]] and extra blank lines");
})();

/* screenshot size */
(() => {
  let f = shot.fitSize(3840, 2160, 1280);
  ok(f.w === 1280 && f.h === 720, "4K shrinks to 1280 wide, same shape");
  f = shot.fitSize(1000, 800, 1280);
  ok(f.w === 1000 && f.h === 800, "a small screen is left alone");
  f = shot.fitSize(1080, 1920, 1280);
  ok(f.w === 720 && f.h === 1280, "a tall screen shrinks by height");
  ok(shot.tooBig("data:image/jpeg;base64," + "A".repeat(2000001)) && !shot.tooBig("data:image/jpeg;base64,AAAA"), "the size check");
})();

console.log("jarvis:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
