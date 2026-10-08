// Jarvis for Webs - tests for the parts that don't need a screen, a microphone or Electron: node test/test.js
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const config = require("../lib/config"), wake = require("../lib/wake"), ai = require("../lib/ai"), shot = require("../lib/shot"), models = require("../lib/models");
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
  ok(c.webSearch === true && config.clean({ webSearch: 0 }).webSearch === false, "web search: on by default, can be turned off");
  ok(c.hearing === "accurate" && config.clean({ hearing: "fast" }).hearing === "fast" && config.clean({ hearing: "loud" }).hearing === "accurate", "hearing: accurate by default, fast if picked");
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
  // after Windows heard the name, Whisper heard the whole thing
  ok(wake.afterWake("Jarvis, how do I make a furnace?", "Jarvis") === "how do i make a furnace", "after the wake: the question after the name");
  ok(wake.afterWake("So anyway. Jarvis, what am I looking at?", "Jarvis") === "what am i looking at", "words before the name are dropped");
  ok(wake.afterWake("Jarvus how do I make a furnace", "Jarvis") === "how do i make a furnace", "Whisper spelling the name a bit off still works");
  ok(wake.afterWake("Jarvis's turn: what is this", "Jarvis") === "turn what is this", "\"Jarvis's\" is the name too");
  ok(wake.afterWake("What am I looking at?", "Jarvis") === "what am i looking at", "no name heard: the whole thing is the question");
  ok(wake.afterWake("Jarvis.", "Jarvis") === "", "just the name: no question yet");
  ok(wake.afterWake("Javascript tutorials please", "Jarvis") === "javascript tutorials please", "a word that only starts like the name isn't cut");
  ok(["stop", "Stop.", "shut up", "Be quiet!", "okay stop", "stop talking please", "That's enough"].every(wake.isStop), "\"Jarvis, stop\" (and friends) stops it talking");
  ok(!wake.isStop("stop the music in spotify") && !wake.isStop("how do i stop a creeper"), "but a question with \"stop\" in it is still a question");
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
  ok(b.search === undefined && ai.buildBody({ question: "hi", cfg: Object.assign({}, cfg, { webSearch: true }) }).search === true, "web search only when it's allowed");
  ok(/ask for a link[\s\S]*Search the web/.test(ai.buildBody({ question: "hi", cfg: Object.assign({}, cfg, { webSearch: true }) }).messages[0].content), "it's told how to give links");
  // links: shown to click, never read aloud
  let p = ai.linkParts("Here you go.\nhttps://minecraft.wiki/w/Furnace");
  ok(p.length === 2 && p[1].url === "https://minecraft.wiki/w/Furnace" && p[1].text === "minecraft.wiki/w/Furnace", "a bare address becomes a link");
  p = ai.linkParts("Try [the wiki](https://minecraft.wiki/w/Furnace) or https://www.youtube.com/watch?v=abc123.");
  ok(p[1].text === "the wiki" && p[3].url === "https://www.youtube.com/watch?v=abc123" && p[4].text === ".", "a labelled link, and a full stop isn't part of the address");
  ok(ai.linkParts("See https://en.wikipedia.org/wiki/Mercury_(planet) now")[1].url === "https://en.wikipedia.org/wiki/Mercury_(planet)", "brackets inside an address are kept");
  ok(!ai.linkParts("javascript:alert(1) and [x](javascript:alert(1))").some(x => x.url) && ai.linkParts("no links").length === 1, "only web links (never javascript:)");
  ok(ai.cleanForSpeech("Here's the page.\nhttps://minecraft.wiki/w/Furnace\n[The video](https://youtu.be/x)") === "Here's the page. The video", "addresses aren't read aloud");
  ok(ai.parseLine('{"end":1,"left":999,"unlimited":1}').unlimited === true && ai.parseLine('{"end":1,"left":999,"unlimited":1}').left === null && ai.parseLine('{"end":1,"left":4}').left === 4, "an unlimited code's answers say so");
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

/* picking the model */
(() => {
  ok(config.clean({}).model === "" && config.clean({ model: "claude-opus-5-5" }).model === "claude-opus-5-5" && config.clean({ model: "gpt-9" }).model === "", "model: the server's choice by default; only known models");
  const cfg = { device: "dev-0123456789abcdef", model: "claude-haiku-5-5" };
  ok(ai.buildBody({ question: "hi", cfg }).model === "claude-haiku-5-5" && !("model" in ai.buildBody({ question: "hi", cfg: { device: "d" } })), "the picked model is sent (and nothing when it's the server's choice)");
  const e = ai.parseLine('{"end":1,"left":999,"unlimited":1,"model":"claude-haiku-5-5","chose":1}');
  ok(e.model === "claude-haiku-5-5" && e.chose === true && ai.parseLine('{"end":1}').chose === false, "the answer says which model answered, and whether the pick was used");
  ok(models.short("claude-opus-5-5") === "Opus 5.5" && models.short("claude-fable-5-1") === "Fable 5.1" && models.short("claude-opus-4-8") === "Opus 4.8" && models.short("nope") === "", "short model names");
  const said = {
    "switch to opus": "claude-opus-5-5", "Switch to Claude Fable 5.1.": "claude-fable-5-1", "use the smartest model": "claude-fable-5-1",
    "change the model to haiku please": "claude-haiku-5-5", "use sonnet from now on": "claude-sonnet-5-5", "go back to default": "",
    "use the cheapest one": "claude-haiku-5-5"
  };
  ok(Object.keys(said).every(k => models.parseSwitch(k) === said[k]), "switching by voice: " + JSON.stringify(Object.keys(said).map(k => [k, models.parseSwitch(k)])));
  ok(["use opus to write a poem", "what is sonnet 18 about", "how do i make a furnace", "switch to dark mode"].every(k => models.parseSwitch(k) === null), "but a normal question is still a question");
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

/* listening: the last few seconds are kept, so "Jarvis, <question>" in one breath isn't lost */
async function listening() {
  const L = await import("../lib/listen.mjs");
  const STEP = 2048 / 48000 * 1000;      // one chunk from the microphone, in ms
  const tone = lv => { const n = 683, d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = lv * Math.SQRT2 * Math.sin(i / 3); return d; };
  // play a script of [ms, level] through a listener; `wakeAt` (ms) is when Windows says it heard the name
  function run(script, mode, wakeAt) {
    const l = L.createListener();
    let t = 0, out = null, started = false;
    for (const [ms, lv] of script) {
      for (let e = 0; e < ms && !out; e += STEP) {
        t += STEP;
        if (!started && t >= wakeAt) { l.start(mode, t); started = true; }
        const r = l.push(tone(lv), t);
        if (r) out = Object.assign(r, { at: t - wakeAt });
      }
    }
    return out;
  }
  const quiet = 0.002, voice = 0.12;
  // one breath: 2.5 s of "Jarvis how do I make a furnace", Windows only fires 0.5 s after you stop
  let r = run([[1000, quiet], [2500, voice], [6000, quiet]], "wake", 4000);
  ok(r && r.voiced && r.audio.length >= 16000 * 2.5, "one breath: the whole question (said before the wake fired) is kept");
  ok(r && r.at < 600, "one breath: and it answers straight away (no waiting)");
  // "Jarvis" ... pause ... "how do I make a furnace"
  r = run([[1000, quiet], [600, voice], [1500, quiet], [2000, voice], [5000, quiet]], "wake", 1900);
  ok(r && r.voiced && r.audio.length >= 16000 * 2.6, "name, pause, question: both are kept");
  ok(r && r.at > 1500 + 2000 && r.at < 1500 + 2000 + 1700, "and it stops ~1.2 s after you finish");
  // just "Jarvis", then nothing: waits ~3.5 s for you to start
  r = run([[1000, quiet], [600, voice], [8000, quiet]], "wake", 1900);
  ok(r && r.at >= 3400 && r.at < 4000, "just the name: waits about 3.5 s for the question");
  // the hotkey, then silence: gives up after ~4.5 s with nothing heard
  r = run([[9000, quiet]], "once", 500);
  ok(r && !r.voiced && r.at >= 4400 && r.at < 5000, "hotkey + silence: nothing heard, gives up");
  // a steady noisy room (a fan, game sound) is learned, and you're still heard over it
  r = run([[40000, 0.02], [2000, 0.15], [5000, 0.02]], "once", 40000);
  ok(r && r.voiced && r.at > 2000 && r.at < 2000 + 1800, "a noisy room: learned, and your voice is still picked out");
  ok(L.to16k(new Float32Array(4800), 48000).length === 1600, "48 kHz is mixed down to 16 kHz");
}

listening().catch(e => ok(false, "listening tests crashed: " + e)).then(() => {
  console.log("jarvis:", pass, "passed,", fail, "failed");
  process.exit(fail ? 1 : 0);
});
