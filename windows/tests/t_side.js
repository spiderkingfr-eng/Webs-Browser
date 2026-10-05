const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:380, height:760 } });
  await setup(ctx);
  const p = await ctx.newPage(); watch(p, errors, "side");
  await p.goto("https://browser.example/side.html#xtools"); await p.waitForTimeout(500);
  check(await p.evaluate(() => document.querySelectorAll("#xtools .xcard").length === 14 && $("xtools").classList.contains("on")), "tool hub");
  await p.screenshot({ path:SHOTS + "side-hub.png" });
  const shots = ["xclocks", "xsketch", "xpass", "xjson", "xdiff", "xregex", "xmd", "xcolors", "xbreathe", "xmetro", "xdecide", "xtally", "xunit"];
  for (const id of shots) {
    await p.evaluate(id => { location.hash = id; }, id); await p.waitForTimeout(250);
    check(await p.evaluate(id => $(id) && $(id).classList.contains("on") && document.querySelectorAll(".pane.on").length === 1, id), "pane shows: " + id);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll: " + id);
  }
  // clocks
  await p.evaluate(() => { location.hash = "xclocks"; }); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.querySelectorAll("#xclocks .xclk").length >= 4), "clocks listed");
  await p.fill("#xcAdd", "paris"); await p.press("#xcAdd", "Enter"); await p.waitForTimeout(100);
  check(await p.evaluate(() => [...document.querySelectorAll("#xclocks .xclk b")].some(b => b.textContent === "Paris")), "added Paris");
  await p.screenshot({ path:SHOTS + "side-clocks.png" });
  // passwords
  await p.evaluate(() => { location.hash = "xpass"; }); await p.waitForTimeout(100);
  const pw = await p.evaluate(() => $("xpOut").textContent);
  check(pw.length === 20 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw) && !/[Il1O0o]/.test(pw), "password: " + pw);
  await p.click('#xpass [data-m="ph"]'); await p.waitForTimeout(50);
  check(/^([A-Z][a-z]+\d*-){6}[A-Z][a-z]+\d*$/.test(await p.evaluate(() => $("xpOut").textContent)), "passphrase: " + await p.evaluate(() => $("xpOut").textContent));
  await p.evaluate(() => { __sent.length = 0; $("xpCopy").click(); });
  check(await p.evaluate(() => __sent.some(m => m.indexOf("clip\u0001") === 0)), "copy password");
  await p.screenshot({ path:SHOTS + "side-pass.png" });
  // JSON
  await p.evaluate(() => { location.hash = "xjson"; }); await p.waitForTimeout(100);
  await p.fill("#xjIn", '{"b":1,"a":[1,2,{"c":true}]}'); await p.check("#xjSort"); await p.click("#xjFmt");
  check(await p.evaluate(() => $("xjIn").value.startsWith('{\n  "a": [') && /Valid JSON/.test($("xjMsg").textContent)), "json format+sort");
  await p.fill("#xjIn", '{"a":1,}'); await p.click("#xjFmt");
  check(await p.evaluate(() => /Not valid JSON/.test($("xjMsg").textContent)), "json error: " + await p.evaluate(() => $("xjMsg").textContent));
  // diff
  await p.evaluate(() => { location.hash = "xdiff"; }); await p.waitForTimeout(100);
  await p.fill("#xdA", "one\ntwo\nthree"); await p.fill("#xdB", "one\n2\nthree\nfour"); await p.waitForTimeout(350);
  check(await p.evaluate(() => /\+2 added · −1 removed/.test($("xdSum").textContent)), "diff summary: " + await p.evaluate(() => $("xdSum").textContent));
  // regex
  await p.evaluate(() => { location.hash = "xregex"; }); await p.waitForTimeout(100);
  check(await p.evaluate(() => document.querySelectorAll("#xrOut mark").length === 2 && /2 matches/.test($("xrMsg").textContent)), "regex matches");
  await p.fill("#xrR", "$1 at $2");
  check(await p.evaluate(() => /ana at example/.test($("xrRep").textContent)), "regex replace");
  // markdown
  await p.evaluate(() => { location.hash = "xmd"; }); await p.waitForTimeout(100);
  check(await p.evaluate(() => $("xmOut").querySelector("h1") && $("xmOut").querySelector("table") && $("xmOut").querySelector("blockquote")), "markdown renders");
  await p.fill("#xmIn", "<img src=x onerror=alert(1)> **b**");
  check(await p.evaluate(() => !$("xmOut").querySelector("img") && $("xmOut").querySelector("b")), "markdown escapes html");
  // colors
  await p.evaluate(() => { location.hash = "xcolors"; }); await p.waitForTimeout(100);
  check(await p.evaluate(() => document.querySelectorAll("#xkP .xpal div").length === 25 && /Contrast/.test($("xkM").textContent)), "palettes");
  await p.screenshot({ path:SHOTS + "side-colors.png" });
  // sketch
  await p.evaluate(() => { location.hash = "xsketch"; }); await p.waitForTimeout(200);
  const box = await p.evaluate(() => { const r = $("xsPad").getBoundingClientRect(); return [r.left, r.top]; });
  await p.mouse.move(box[0] + 30, box[1] + 30); await p.mouse.down(); await p.mouse.move(box[0] + 140, box[1] + 120, { steps:8 }); await p.mouse.up();
  check(await p.evaluate(() => (localStorage.getItem("wsb.xSketch") || "").length > 1000), "sketch saved");
  await p.screenshot({ path:SHOTS + "side-sketch.png" });
  // wheel
  await p.evaluate(() => { location.hash = "xdecide"; }); await p.waitForTimeout(100);
  await p.evaluate(() => { document.documentElement.dataset.motion = "off"; $("xwGo").click(); }); await p.waitForTimeout(150);
  const won = await p.evaluate(() => $("xwR").textContent);
  check(/🎉 (Pizza|Sushi|Tacos|Burgers|Pasta|Salad)/.test(won), "wheel picks: " + won);
  await p.screenshot({ path:SHOTS + "side-wheel.png" });
  // tally, unit price, breathe, metronome
  await p.evaluate(() => { location.hash = "xtally"; }); await p.waitForTimeout(100);
  await p.click('#xtally [data-d="1"]'); await p.click('#xtally [data-d="1"]');
  check(await p.evaluate(() => JSON.parse(localStorage.getItem("wsb.xTally"))[0].v === 2), "tally counts");
  await p.evaluate(() => { location.hash = "xunit"; }); await p.waitForTimeout(100);
  check(await p.evaluate(() => /Best: Big pack · 6\.99 per kg/.test($("xuOut").textContent)), "unit price: " + await p.evaluate(() => $("xuOut").textContent));
  await p.evaluate(() => { location.hash = "xbreathe"; }); await p.waitForTimeout(100);
  await p.click("#xbGo"); await p.waitForTimeout(1200);
  check(await p.evaluate(() => /Breathe in · \d/.test(document.querySelector("#xbreathe .l").textContent)), "breathing runs");
  await p.click("#xbGo");
  await p.evaluate(() => { location.hash = "xmetro"; }); await p.waitForTimeout(100);
  await p.click("#xmTap"); await p.waitForTimeout(500); await p.click("#xmTap");
  check(await p.evaluate(() => Math.abs(+$("xmB").textContent - 120) < 15), "tap tempo: " + await p.evaluate(() => $("xmB").textContent));
  // the old panes still work
  await p.evaluate(() => { location.hash = "todo"; }); await p.waitForTimeout(100);
  check(await p.evaluate(() => $("todo").classList.contains("on") && !document.querySelector('nav button[data-p="xtools"]').classList.contains("on")), "old panes still route");
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
