// Every example typed in the What's new list gives an answer.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  const p = await ctx.newPage(); watch(p, errors, "chrome");
  await p.goto("https://browser.example/chrome.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/a", "", 0, 0); __host("tab-selected", 1); });
  const A = q => p.evaluate(q => answers(q).map(a => a.t), q);
  const ex = ["bmi 70kg 175cm", "age 1990-05-14", "loan 250k at 4.5% for 30 years", "10000 at 5% for 10 years plus 200 a month", "9:15am to 5:40pm", "2026 in roman", "roman MMXXVI",
    "1234567 in words", "base64 encode: hello", "url decode a%20b", "sha256: your text", "pick: pizza, tacos, sushi", "lorem 3 paragraphs", "unix", "1700000000 unix", "week number",
    "year progress", "is 2028 a leap year", "next leap year", "is 97 prime", "factors of 360", "gcd 12 18", "lcm 4 6 10", "average 3, 7, 12", "pace 10 km in 52:30", "download 4 GB at 100 mbps",
    "1920x1080 ratio", "16:9 at 1440 wide", "ppi 2560x1440 27", ":fire", "emoji: heart", "morse: SOS", "binary: hi", "unicode é", "upside down hello", "shrug", "table flip",
    "qr: your text", "todo: buy milk", "@settings", "synonyms for happy", "rhymes with moon"];
  for (const q of ex) {
    let r = await A(q);
    if (!r.length || /Working|Looking|Finding/.test(r.join())) { await p.waitForTimeout(400); r = await A(q); }
    check(r.length > 0 && !/Working|Looking|Finding/.test(r.join()), q + " -> " + JSON.stringify(r).slice(0, 140));
  }
  const R = q => p.evaluate(q => resolve(q), q);
  for (const [q, re] of [["!yt cat videos", /youtube\.com\/results\?search_query=cat/], ["!m coffee near me", /google\.com\/maps\/search\/coffee/], ["!mdn flexbox", /developer\.mozilla\.org.*flexbox/], ["!k your search", /kagi\.com\/search\?q=your/]])
    check(re.test(await R(q)), q + " -> " + await R(q));
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
