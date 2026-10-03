// The voice call with Web AI, with a pretend microphone (speech recognition) and speaker
// (speech synthesis), against the real server code with a pretend Claude.
const path = require("path");
const { chromium, setup, watch, SHOTS, ROOT } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const SERVER = "https://web-ai.test.workers.dev";

(async () => {
  const worker = (await import(path.join(ROOT, "..", "server", "web-ai", "worker.js"))).default;
  const kv = new Map(), asked = [];
  const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS:{ get:async k => kv.has(k) ? kv.get(k) : null, put:async (k, v) => { kv.set(k, v); }, delete:async k => { kv.delete(k); }, list:async () => ({ keys:[] }) } };
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); asked.push(body);
    const q = body.messages[body.messages.length - 1].content;
    const ev = [{ type:"content_block_delta", delta:{ type:"text_delta", text:"You asked: **" + q + "**. Here is the answer." } }, { type:"message_delta", delta:{ stop_reason:"end_turn" } }];
    return new Response(ev.map(e => "data: " + JSON.stringify(e) + "\n\n").join(""), { status:200 });
  };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:380, height:760 } });
  await setup(ctx);
  await ctx.route(SERVER + "/**", async r => {
    const q = r.request(), waits = [];
    const res = await worker.fetch(new Request(q.url(), { method:q.method(), headers:q.headers(), body:q.method() === "POST" ? q.postData() : undefined }), env, { waitUntil:p => waits.push(p) });
    const body = await res.text(); await Promise.all(waits);
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    r.fulfill({ status:res.status, headers, body });
  });
  // the pretend microphone hears whatever is queued in __hear ("" = silence); the pretend speaker records what it says
  await ctx.addInitScript(S => {
    localStorage.setItem("wsb.xaiConfig", JSON.stringify({ server:S }));
    if (!localStorage.getItem("wsb.xai")) localStorage.setItem("wsb.xai", JSON.stringify({ noPage:true }));     // no browser window here to read a page from
    window.__hear = []; window.__spoken = []; window.__recs = 0; window.__noMic = /nomic=1/.test(location.search);
    class FakeSR {
      start() {
        window.__recs++;
        const said = window.__hear.length ? window.__hear.shift() : null;
        setTimeout(() => {
          if (said === null) return;          // nothing queued: keeps listening until stopped
          if (said === "") { this.onerror && this.onerror({ error:"no-speech" }); this.onend && this.onend(); return; }
          const res = [[{ transcript:said }]]; res[0].isFinal = true;
          this.onresult && this.onresult({ results:res });
          this.onend && this.onend();
        }, 40);
      }
      abort() {} stop() {}
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = window.__noMic ? undefined : FakeSR;
    Object.defineProperty(window, "speechSynthesis", { configurable:true, value:{ speaking:false, getVoices:() => [], cancel() { window.__cancels = (window.__cancels || 0) + 1; },
      speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); } } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }, SERVER);

  const s = await ctx.newPage(); watch(s, errors, "side");
  await s.goto("https://browser.example/side.html?w=TEST#xai"); await s.waitForTimeout(700);
  check(await s.evaluate(() => !document.querySelector("#xai").classList.contains("setup")), "Web AI ready by itself (open server)");
  check(await s.isVisible(".xai-call"), "📞 button by the box");

  // a call: hears a question, answers out loud, listens again
  await s.evaluate(() => { __hear.push("what is the weather like", "thanks"); });
  await s.click(".xai-call"); await s.waitForTimeout(1500);
  check(asked.length >= 1 && asked[0].messages[asked[0].messages.length - 1].content === "what is the weather like", "what was said is asked: " + JSON.stringify(asked.map(a => a.messages.slice(-1)[0].content)));
  const spoken = await s.evaluate(() => __spoken.join(" "));
  check(/You asked: what is the weather like\. Here is the answer\./.test(spoken) && !/\*\*/.test(spoken), "the answer is spoken, without Markdown: " + spoken);
  check(asked.length === 2 && asked[1].messages.slice(-1)[0].content === "thanks", "then it listens again and asks the next one");
  check(await s.evaluate(() => XAI.call.state().call && !document.querySelector(".xai-callbar").classList.contains("hide")), "the call is still on, with its bar");
  await s.screenshot({ path:SHOTS + "webai-call.png" });
  await s.click(".xai-callbar .b"); await s.waitForTimeout(200);
  check(await s.evaluate(() => !XAI.call.state().call && document.querySelector(".xai-callbar").classList.contains("hide")), "hang up");
  const recsAfter = await s.evaluate(() => __recs); await s.waitForTimeout(600);
  check(await s.evaluate(() => __recs) === recsAfter, "no listening after hanging up");

  // 🔊 on an answer
  await s.evaluate(() => { __spoken.length = 0; });
  await s.evaluate(() => [...document.querySelectorAll(".xai-say")].pop().click()); await s.waitForTimeout(300);
  check(await s.evaluate(() => __spoken.length > 0 && /Here is the answer/.test(__spoken.join(" "))), "🔊 reads an answer out loud");

  // silence: three quiet tries end the call
  await s.evaluate(() => { __hear.push("", "", ""); });
  await s.click(".xai-call"); await s.waitForTimeout(1500);
  check(await s.evaluate(() => !XAI.call.state().call && /quiet/.test(document.querySelector(".xai-callbar .t").textContent)), "a quiet call ends by itself");

  // a PC without speech recognition: the call still works by typing (or Windows voice typing), answers spoken
  const p2 = await ctx.newPage(); watch(p2, errors, "nomic");
  await p2.goto("https://browser.example/side.html?w=TEST2&nomic=1#xai"); await p2.waitForTimeout(700);
  await p2.click(".xai-call"); await p2.waitForTimeout(200);
  check(/Windows \+ H/.test(await p2.textContent(".xai-callbar .t")), "no microphone: says to use Windows voice typing");
  await p2.evaluate(() => { __spoken.length = 0; });
  await p2.fill(".xai-in textarea", "typed in a call"); await p2.press(".xai-in textarea", "Enter"); await p2.waitForTimeout(900);
  check(await p2.evaluate(() => /typed in a call/.test(__spoken.join(" "))), "the typed question's answer is spoken");
  await p2.screenshot({ path:SHOTS + "webai-call-nomic.png" });

  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
