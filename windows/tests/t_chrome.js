const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx);
  const p = await ctx.newPage(); watch(p, errors, "chrome");
  await p.goto("https://browser.example/chrome.html");
  await p.waitForTimeout(400);
  // the host reports the window size and creates three tabs
  await p.evaluate(() => {
    __host("viewport", 1280, 800);
    __host("tab-created", 1, 0, "https://example.com/a", "", 0, 0);
    __host("tab-title", 1, "Example A");
    __host("tab-created", 2, 1, "https://news.example.org/page/3?x=1", "", 0, 0);
    __host("tab-created", 3, 0, "https://example.com/b", "", 0, 0);
    __host("tab-selected", 3);
  });
  await p.waitForTimeout(200);
  check(await p.evaluate(() => tabs.length === 3 && active === 3), "three tabs");
  check(await p.evaluate(() => document.querySelector('.tab[data-id="2"]').classList.contains("xun")), "background tab has the unread dot");
  await p.evaluate(() => __host("tab-selected", 2)); await p.waitForTimeout(50);
  check(await p.evaluate(() => !document.querySelector('.tab[data-id="2"]').classList.contains("xun")), "dot goes once seen");
  // Alt+` goes back
  await p.evaluate(() => shortcut(192, false, false, true)); await p.waitForTimeout(20);
  check(await p.evaluate(() => __sent.some(m => m === "select-tab\u00013")), "Alt+` asks for the last tab");
  // answers
  const A = async q => p.evaluate(q => answers(q).map(a => a.t + " | " + (a.copy || "")), q);
  const cases = [["bmi 70kg 175cm", /BMI 22\.9/], ["loan 20000 at 5% for 5 years", /377\.42 a month/], ["1000 at 5% for 10 years", /1,647\.01/],
    ["9am to 5:30pm", /^8 h 30 min/], ["2024 in roman", /MMXXIV/], ["roman mcmxc", /^1990/], ["123 in words", /One hundred and twenty-three/],
    ["base64 encode hello", /aGVsbG8=/], ["base64: hello", /aGVsbG8=/], ["base64 decode aGVsbG8=", /^hello/], ["url encode a b&c", /a%20b%26c/], ["is 97 prime", /Yes, 97 is prime/],
    ["factors of 360", /2 × 2 × 2 × 3 × 3 × 5/], ["gcd 12 18", /= 6/], ["lcm 4, 6", /= 12/], ["average 3 5 10", /= 6/], ["stats 1 2 3 4", /median 2\.5/],
    ["pace 5km 25:00", /5:00 per km/], ["download 4 gb at 100 mbps", /5 min 20 s/], ["ratio 1920x1080", /^16:9/], ["16:9 1280", /1280 × 720/],
    ["ppi 27 2560x1440", /109 pixels/], [":fire", /🔥/], ["morse: sos", /\.\.\. --- \.\.\./], ["morse ... --- ...", /^SOS/], ["text to binary hi", /01101000 01101001/],
    ["char é", /U\+00E9/], ["upside down hello", /ollǝɥ/], ["shrug", /ツ/], ["count: two words", /2 words/], ["lorem 3 words", /Lorem ipsum dolor/],
    ["unix 1700000000", /2023/], ["is 2028 a leap year", /Yes, 2028/], ["year progress", /% /], ["pick from pizza, sushi", /pizza|sushi/], ["what week is it", /^Week \d+/],
    ["age 2000-01-01", /years/], ["qr: hello", /QR code for/], ["add todo buy milk", /Add to your to-do list: buy milk/], ["@hist", /History/]];
  for (const [q, re] of cases) { const r = await A(q); check(r.some(x => re.test(x)), "answer: " + q + " -> " + JSON.stringify(r)); }
  // searches that must stay searches
  for (const q of ["binary search tree", "qr code generator", "count dracula", "emoji movie", "flip a coin", "week", "leap year", "base64 encoder", "url encode online", "lenny kravitz", "morse code alphabet"]) {
    const r = await p.evaluate(q => X3.moreAnswers(q, q).filter(a => a.copy != null || a.act).map(a => a.t), q);
    check(!r.length, "no new answer hijacks the search: " + q + " " + JSON.stringify(r));
  }
  // async answers: synonyms and hashes
  await p.evaluate(() => { $("#url").focus(); $("#url").value = "synonyms for happy"; $("#url").dispatchEvent(new Event("input")); });
  await p.waitForTimeout(400);
  check(await p.evaluate(() => sugs.some(s => /glad, cheerful/.test(s.t))), "synonyms arrive");
  await p.evaluate(() => { $("#url").value = "sha256: abc"; $("#url").dispatchEvent(new Event("input")); });
  await p.waitForTimeout(300);
  check(await p.evaluate(() => sugs.some(s => /^ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad$/.test(s.t))), "sha-256 answer");
  await p.evaluate(() => { $("#url").blur(); closeOver(); });
  // bangs and engines
  check(await p.evaluate(() => resolve("!yt lofi") === "https://www.youtube.com/results?search_query=lofi"), "!yt bang");
  check(await p.evaluate(() => resolve("!gh webview2").indexOf("https://github.com/search?q=") === 0), "!gh bang");
  check(await p.evaluate(() => { cfg.search = "ecosia"; const r = resolve("trees"); cfg.search = "ddg"; return r; }) === "https://www.ecosia.org/search?q=trees", "Ecosia engine");
  check(await p.evaluate(() => { cfg.search = "custom"; cfg.xCustomUrl = "https://search.example/find?q=%s&lang=en"; applyLook(); const r = resolve("hello world"); cfg.search = "ddg"; cfg.xCustomUrl = ""; applyLook(); return r; }) === "https://search.example/find?q=hello%20world&lang=en", "your own engine");
  // tab menu, rename, lock
  await p.evaluate(() => tabMenu({ clientX:100, clientY:10 }, 2)); await p.waitForTimeout(100);
  const items = await p.evaluate(() => [...document.querySelectorAll("#ctx .mi span")].map(s => s.textContent));
  check(items.includes("Rename tab…") && items.includes("Lock tab (no accidental closing)") && items.includes("Close this tab in…") && items.some(x => /Close all tabs from news\.example\.org/.test(x)), "tab menu items: " + items.slice(0, 8).join(", "));
  await p.evaluate(() => closeOver());
  p.once("dialog", d => d.accept("My tab"));
  await p.evaluate(() => X3.renameTab(2)); await p.waitForTimeout(50);
  check(await p.evaluate(() => document.querySelector('.tab[data-id="2"] .ttl').textContent) === "My tab", "rename shows");
  await p.evaluate(() => { __host("tab-title", 2, "Server title"); }); await p.waitForTimeout(30);
  check(await p.evaluate(() => document.querySelector('.tab[data-id="2"] .ttl').textContent) === "My tab", "name survives a title change");
  await p.evaluate(() => X3.lockTab(2)); await p.waitForTimeout(30);
  await p.evaluate(() => { __sent.length = 0; closeTab(2); });
  check(await p.evaluate(() => !__sent.some(m => m.indexOf("close-tab") === 0) && /locked/.test($("#toast").textContent)), "locked tab doesn't close");
  // panels
  await p.evaluate(() => X3.toolsPanel()); await p.waitForTimeout(300);
  const n = await p.evaluate(() => document.querySelectorAll("#xtp .xtg button").length);
  check(n >= 45, "page tools panel has " + n + " tools");
  await p.screenshot({ path:SHOTS + "pc-tools.png" });
  await p.evaluate(() => { __sent.length = 0; [...document.querySelectorAll("#xtp .xtg button")].find(b => /Reading guide/.test(b.textContent)).click(); });
  check(await p.evaluate(() => __sent.some(m => m === "page-tool\u00012\u0001x-ruler\u0001")), "tool button runs the page tool");
  await p.evaluate(() => mainMenu()); await p.waitForTimeout(250);
  check(await p.evaluate(() => [...document.querySelectorAll("#menu .mi span")].some(s => s.textContent === "More page tools (new)…") && [...document.querySelectorAll("#menu .mi span")].some(s => /458 features/.test(s.textContent)) && [...document.querySelectorAll("#menu .mi span")].some(s => s.textContent === "Web AI") && [...document.querySelectorAll("#menu .mi span")].some(s => /Sign in with Google/.test(s.textContent)) && [...document.querySelectorAll("#menu .mi span")].some(s => /Check for updates/.test(s.textContent))), "main menu rows");
  await p.screenshot({ path:SHOTS + "pc-menu.png" });
  await p.evaluate(() => closeOver());
  check(await p.evaluate(() => commands().length) > 230, "palette commands: " + await p.evaluate(() => commands().length));
  // palette finds a new command
  await p.evaluate(() => palette("cmd")); await p.waitForTimeout(100);
  await p.keyboard.type("bionic"); await p.waitForTimeout(100);
  check(await p.evaluate(() => [...document.querySelectorAll("#pal .sug .st")].some(x => /Bionic/.test(x.textContent))), "palette finds Bionic reading");
  await p.keyboard.press("Escape");
  // looks
  await p.evaluate(() => { cfg.xClock = true; cfg.xTabNums = true; cfg.xGlow = true; cfg.xRainbow = true; cfg.xTabCount = true; applyLook(); renderTabs(); });
  await p.waitForTimeout(100);
  check(await p.evaluate(() => /\d/.test(document.querySelector(".xclock").textContent) && document.querySelectorAll(".tab .xnum").length === 3), "clock and tab numbers");
  await p.screenshot({ path:SHOTS + "pc-strip.png", clip:{ x:0, y:0, width:1280, height:90 } });
  // tool results: markdown save and text copy
  await p.evaluate(() => { __sent.length = 0; pageTool("x-md"); onToolResult(active, JSON.stringify({ a:"x-md", md:"# Hi", title:"A/B: page" })); });
  check(await p.evaluate(() => __sent.some(m => m.indexOf("save-text\u0001A B page.md\u0001# Hi") === 0)), "markdown saved");
  await p.evaluate(() => { __sent.length = 0; onToolResult(active, JSON.stringify({ a:"x-md", md:"# not asked" })); });
  check(await p.evaluate(() => !__sent.length), "unasked results ignored");
  await p.evaluate(() => { __sent.length = 0; onToolResult(active, JSON.stringify({ a:"x-key", k:"R" })); });
  check(await p.evaluate(() => __sent.some(m => m.indexOf("page-tool\u0001" + active + "\u0001x-ruler") === 0)), "page key relay");
  await p.evaluate(() => { __sent.length = 0; cfg.xProgress = true; cfg.xYtShorts = true; applyPage(T(active)); });
  check(await p.evaluate(() => __sent.some(m => /x-init.*progress/.test(m))), "x-init sent on page load");
  // sidebar tools
  await p.evaluate(() => { __sent.length = 0; openSide("xclocks"); });
  check(await p.evaluate(() => __sent.some(m => m === "side-open\u0001https://browser.example/side.html#xclocks") && document.querySelectorAll("#rail .btn").length > 6), "sidebar tool opens");
  // next page in a numbered address
  await p.evaluate(() => { select(2); __host("tab-selected", 2); __sent.length = 0; });
  await p.evaluate(() => [...document.querySelectorAll("x")].length);
  await p.evaluate(() => { const c = commands().find(c => c.t === "Next page number"); c.fn(); });
  check(await p.evaluate(() => __sent.some(m => m === "navigate\u00012\u0001https://news.example.org/page/4?x=1")), "next page number");
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
