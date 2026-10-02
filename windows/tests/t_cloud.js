// Google account sync and updates, against a fake Google (sign-in, token, Drive)
// and a fake updates/latest.json. Two browser contexts play two computers.
const { chromium, setup, watch, SHOTS } = require("./harness");
let ok = 0, bad = 0; const errors = [];
const check = (c, w) => { if (c) ok++; else { bad++; console.log("  FAIL:", w); } };
const CLIENT = "123456789012-abcdef.apps.googleusercontent.com";
const UPDATER = "https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/WebsUpdate.exe";
const drive = { file:null, mod:0, writes:0, revoked:[], refreshBad:new Set(), tokenCalls:[] };

async function fakeGoogle(ctx) {
  await ctx.route(/^https:\/\/raw\.githubusercontent\.com\/spiderkingfr-eng\/Webs-Browser\/main\/updates\/latest\.json/, r =>
    r.fulfill({ status:200, contentType:"application/json", headers:{ "access-control-allow-origin":"*" },
      body:JSON.stringify({ version:"3.2.0", date:"2026-10-20", notes:["Faster tabs", "A new game"], updater:{ url:UPDATER }, google:{ clientId:CLIENT, clientSecret:"shh" } }) }));
  const cors = { "access-control-allow-origin":"https://browser.example", "access-control-allow-headers":"authorization,content-type", "access-control-allow-methods":"GET,POST,PATCH,DELETE" };
  const json = (r, o, status) => r.fulfill({ status:status || 200, contentType:"application/json", headers:cors, body:JSON.stringify(o) });
  await ctx.route(/^https:\/\/(oauth2|openidconnect|www)\.googleapis\.com\//, async r => {
    const q = r.request(), u = new URL(q.url()), m = q.method();
    if (m === "OPTIONS") return r.fulfill({ status:204, headers:cors });
    if (u.host === "oauth2.googleapis.com" && u.pathname === "/token") {
      const b = new URLSearchParams(q.postData() || ""); drive.tokenCalls.push(Object.fromEntries(b));
      if (b.get("client_id") !== CLIENT || b.get("client_secret") !== "shh") return json(r, { error:"invalid_client" }, 401);
      if (b.get("grant_type") === "authorization_code") {
        if (!/^CODE/.test(b.get("code")) || (b.get("code_verifier") || "").length < 43 || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(b.get("redirect_uri"))) return json(r, { error:"invalid_grant" }, 400);
        return json(r, { access_token:"AT-" + b.get("code"), refresh_token:"RT-" + b.get("code"), expires_in:3600 });
      }
      if (drive.refreshBad.has(b.get("refresh_token"))) return json(r, { error:"invalid_grant" }, 400);
      return json(r, { access_token:"AT-refreshed", expires_in:3600 });
    }
    if (u.pathname === "/revoke") { drive.revoked.push(new URLSearchParams(q.postData() || "").get("token")); return json(r, {}); }
    if (!/^Bearer AT-/.test(q.headers()["authorization"] || "")) return json(r, { error:{ message:"no token" } }, 401);
    if (u.host === "openidconnect.googleapis.com") return json(r, { email:"sam@example.com", name:"Sam Tester", picture:"" });
    if (u.pathname === "/drive/v3/files" && m === "GET") {
      if (u.searchParams.get("spaces") !== "appDataFolder") return json(r, { error:{ message:"wrong space" } }, 400);
      return json(r, { files:drive.file ? [{ id:"f1", modifiedTime:"2026-10-02T00:00:" + String(drive.mod).padStart(2, "0") + "Z" }] : [] });
    }
    if (u.pathname === "/drive/v3/files/f1" && m === "GET") return json(r, drive.file);
    if (u.pathname === "/drive/v3/files/f1" && m === "DELETE") { drive.file = null; return r.fulfill({ status:204, headers:cors }); }
    if (u.pathname === "/upload/drive/v3/files" && m === "POST") {
      const body = q.postData(), parts = body.split(/--webs[A-Za-z0-9_-]+/);
      const meta = JSON.parse(parts[1].split("\r\n\r\n")[1]), data = JSON.parse(parts[2].split("\r\n\r\n").slice(1).join("\r\n\r\n").trim());
      if (meta.parents[0] !== "appDataFolder" || meta.name !== "webs-browser-sync.json") return json(r, { error:{ message:"bad meta" } }, 400);
      drive.file = data; drive.mod++; drive.writes++;
      return json(r, { id:"f1", modifiedTime:"2026-10-02T00:00:" + String(drive.mod).padStart(2, "0") + "Z" });
    }
    if (u.pathname === "/upload/drive/v3/files/f1" && m === "PATCH") {
      drive.file = JSON.parse(q.postData()); drive.mod++; drive.writes++;
      return json(r, { id:"f1", modifiedTime:"2026-10-02T00:00:" + String(drive.mod).padStart(2, "0") + "Z" });
    }
    json(r, { error:{ message:"unexpected " + m + " " + u.pathname } }, 404);
  });
}
async function computer(browser, name, seed) {
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await setup(ctx); await fakeGoogle(ctx);
  if (seed) await ctx.addInitScript(s => { if (location.origin === "https://browser.example" && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", 1); for (const k in s) localStorage.setItem("wsb." + k, JSON.stringify(s[k])); } }, seed);
  const p = await ctx.newPage(); watch(p, errors, name);
  await p.goto("https://browser.example/chrome.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
  return { ctx, p };
}
const sent = (p, re) => p.evaluate(src => __sent.filter(m => new RegExp(src).test(m)), re.source);
async function signIn(p, code) {
  await p.evaluate(() => { __sent.length = 0; X3.signIn(); }); await p.waitForTimeout(150);
  const nt = (await sent(p, /^new-tab\u0001https:\/\/accounts\.google\.com/))[0] || "";
  const auth = new URL(nt.split("\u0001")[1]);
  await p.evaluate(u => { __host("tab-created", 7, 0, u, "", 1, 0); __host("tab-selected", 7); }, auth.href);
  const back = auth.searchParams.get("redirect_uri") + "?state=" + auth.searchParams.get("state") + "&code=" + code + "&scope=openid";
  await p.evaluate(b => __host("tab-url", 7, b, 0, 0), back);
  await p.waitForTimeout(700);
  return auth;
}

(async () => {
  const browser = await chromium.launch();
  /* ---------------- computer A */
  const A = await computer(browser, "A", { settings:{ theme:"dark", accent:"#3366ff", syncDir:"C:\\Sync", bg:"user/bg/a.jpg", xClock:true }, bookmarks:[{ u:"https://a.example/", t:"A site", ts:1 }],
    tiles:[{ u:"https://tile-a.example/", t:"Tile A" }] });
  const pa = A.p;
  // updates
  await pa.evaluate(() => X3.checkUpdate(true)); await pa.waitForTimeout(400);
  check(await pa.evaluate(() => !!document.querySelector(".xbox .xupd")), "update button in the tab strip");
  check(/3\.2\.0 is ready/.test(await pa.evaluate(() => (document.querySelector("#xupdp") || {}).textContent || "")), "update panel says 3.2.0 is ready");
  await pa.screenshot({ path:SHOTS + "cloud-update.png" });
  await pa.evaluate(() => { __sent.length = 0; [...document.querySelectorAll("#xupdp button")].find(b => b.textContent === "Update now").click(); });
  check((await sent(pa, /^dl-retry/))[0] === "dl-retry\u0001webs-update\u0001" + UPDATER, "Update now downloads the updater");
  await pa.evaluate(u => { __sent.length = 0;
    __host("download", "d1", "progress", "WebsUpdate.exe", "C:\\Users\\sam\\Downloads\\Programs\\WebsUpdate.exe", 5000, 20480, "", u, 1);
    __host("download", "d1", "done", "WebsUpdate.exe", "C:\\Users\\sam\\Downloads\\Programs\\WebsUpdate.exe", 20480, 20480, "", u, 0); }, UPDATER);
  check((await sent(pa, /^open-file/))[0] === "open-file\u0001C:\\Users\\sam\\Downloads\\Programs\\WebsUpdate.exe", "the downloaded updater is opened");
  check(!/Careful/.test(await pa.textContent("#toast").catch(() => "")), "no 'program from a site you haven't used' warning for the updater");
  // a download from anywhere else is not opened by itself
  await pa.evaluate(() => { __sent.length = 0; __host("download", "d2", "done", "WebsUpdate.exe", "C:\\x\\WebsUpdate.exe", 1, 1, "", "https://evil.example/WebsUpdate.exe", 0); });
  check(!(await sent(pa, /^open-file/)).length, "other downloads are not opened");
  check(await pa.evaluate(() => JSON.parse(localStorage.getItem("wsb.xgConfig")).clientId) === CLIENT, "Google client id arrives with the update information");

  // sign in
  const authA = await signIn(pa, "CODEA");
  check(authA.searchParams.get("code_challenge_method") === "S256" && /drive\.appdata/.test(authA.searchParams.get("scope")) && authA.searchParams.get("access_type") === "offline", "sign-in asks for offline drive.appdata with PKCE");
  check((await sent(pa, /^close-tab\u00017/)).length === 1, "the sign-in tab closes by itself");
  check(!(await pa.evaluate(() => JSON.parse(localStorage.getItem("wsb.closed") || "[]").some(c => /accounts\.google|127\.0\.0\.1/.test(c.u)))), "sign-in tab not kept in recently closed");
  check(drive.tokenCalls.some(c => c.grant_type === "authorization_code" && c.code === "CODEA" && c.code_verifier), "code traded with its verifier");
  check(await pa.evaluate(() => JSON.parse(localStorage.getItem("wsb.xgAuth")).email) === "sam@example.com", "signed in as sam");
  await pa.waitForTimeout(500);
  check(drive.file && drive.file.app === "Webs Browser cloud", "first sync uploads");
  const cs = drive.file && drive.file.layout.data.settings;
  check(cs && cs.accent === "#3366ff" && cs.xClock === true, "layout saved");
  check(cs && !("syncDir" in cs) && !("bg" in cs), "this computer's folders and files are not uploaded");
  check(drive.file && drive.file.lists.data.bookmarks.some(b => b.u === "https://a.example/"), "bookmarks uploaded");
  check(await pa.evaluate(() => !!document.querySelector(".xbox .xacc")), "account button in the tab strip");
  await pa.evaluate(() => X3.acctPanel()); await pa.waitForTimeout(250);
  check(/Sam Tester/.test(await pa.textContent("#xacct")), "account panel shows the name");
  await pa.screenshot({ path:SHOTS + "cloud-account.png" });
  await pa.evaluate(() => closeOver());

  /* ---------------- computer B: its own layout first, then signs in */
  const B = await computer(browser, "B", { settings:{ theme:"light", accent:"#00aa00", syncDir:"D:\\Mine", bg:"user/bg/b.jpg" }, bookmarks:[{ u:"https://b.example/", t:"B site", ts:2 }] });
  const pb = B.p;
  await pb.evaluate(() => X3.checkUpdate(true)); await pb.waitForTimeout(300); await pb.evaluate(() => closeOver());
  await signIn(pb, "CODEB");
  check(await pb.evaluate(() => overlay) === "xask1", "B is asked whether to use the saved layout");
  await pb.screenshot({ path:SHOTS + "cloud-ask.png" });
  await pb.evaluate(() => [...document.querySelectorAll("#xask1 button")].find(b => /Use my saved/.test(b.textContent)).click());
  await pb.waitForTimeout(600);
  const sb = await pb.evaluate(() => JSON.parse(localStorage.getItem("wsb.settings")));
  check(sb.accent === "#3366ff" && sb.theme === "dark" && sb.xClock === true, "B now has A's layout");
  check(sb.syncDir === "D:\\Mine" && sb.bg === "user/bg/b.jpg", "B keeps its own folders and files");
  check(await pb.evaluate(() => cfg.accent) === "#3366ff", "B's window uses it right away");
  check(await pb.evaluate(() => JSON.parse(localStorage.getItem("wsb.tiles") || "[]").some(t => t.t === "Tile A")), "new tab shortcuts came along");
  const bmB = await pb.evaluate(() => marks.map(m => m.u));
  check(bmB.includes("https://a.example/") && bmB.includes("https://b.example/"), "bookmarks added together on B");
  check(drive.file.lists.data.bookmarks.length === 2, "and saved back to the account");
  // A picks up B's bookmark
  await pa.evaluate(() => X3.syncG(true)); await pa.waitForTimeout(500);
  check(await pa.evaluate(() => marks.some(m => m.u === "https://b.example/")), "A gets B's bookmark");
  // B changes its accent; A follows
  await pb.evaluate(() => { cfg.accent = "#ff8800"; saveNow("settings"); X3.syncG(true); }); await pb.waitForTimeout(500);
  check(drive.file.layout.data.settings.accent === "#ff8800", "B's change saved");
  await pa.evaluate(() => X3.syncG(true)); await pa.waitForTimeout(500);
  check(await pa.evaluate(() => cfg.accent) === "#ff8800", "A follows B's change");
  check(await pa.evaluate(() => cfg.syncDir) === "C:\\Sync", "A keeps its own sync folder");
  // nothing changed: no upload
  const w0 = drive.writes;
  await pa.evaluate(() => X3.syncG(true)); await pa.waitForTimeout(400);
  check(drive.writes === w0, "nothing changed, nothing uploaded");
  // turning layout off on A: A's change stays local and the account keeps B's
  await pa.evaluate(() => { save("xgPrefs", { layout:false, lists:true, extras:true }); cfg.accent = "#123456"; saveNow("settings"); marks.push({ u:"https://c.example/", t:"C", ts:3 }); saveNow("bookmarks"); X3.syncG(true); });
  await pa.waitForTimeout(500);
  check(drive.file.layout.data.settings.accent === "#ff8800" && drive.file.lists.data.bookmarks.some(b => b.u === "https://c.example/"), "a part turned off is left alone in the account");

  /* ---------------- Settings page, through the browser window */
  const ps = await A.ctx.newPage(); watch(ps, errors, "settings");
  await ps.goto("https://browser.example/settings.html#account"); await ps.waitForTimeout(600);
  check(/sam@example\.com/.test(await ps.textContent("#xgNote")), "Settings shows the account");
  check(/synced with your Google account/.test(await ps.textContent(".sub")), "Settings subtitle mentions Google");
  check(/3\.2\.0 is ready/.test(await ps.textContent("#xuNote")) && await ps.isVisible("#xuGo"), "Settings shows the update");
  await ps.screenshot({ path:SHOTS + "cloud-settings.png" });
  const w1 = drive.writes;
  await pa.evaluate(() => { save("xgPrefs", { layout:true, lists:true, extras:true }); });
  await ps.click("#xgSync"); await pa.waitForTimeout(800);
  check(drive.writes > w1, "Sync now in Settings syncs");

  /* ---------------- pasted address from another browser */
  await pb.evaluate(() => { __sent.length = 0; localStorage.removeItem("wsb.xgAuth"); });
  await pb.evaluate(() => X3.signIn()); await pb.waitForTimeout(150);
  const nt = (await sent(pb, /^new-tab/))[0].split("\u0001")[1], au = new URL(nt);
  const pasted = au.searchParams.get("redirect_uri") + "?state=" + au.searchParams.get("state") + "&code=CODEPASTE";
  check(await pb.evaluate(u => X3.catchCode(0, u), pasted), "an address pasted from another browser finishes sign-in");
  await pb.waitForTimeout(600);
  check(drive.tokenCalls.some(c => c.code === "CODEPASTE"), "pasted code traded");
  check(!(await pb.evaluate(() => X3.catchCode(0, "http://127.0.0.1:1/?state=nope&code=x"))), "a stray address is ignored");

  /* ---------------- sign-in ended, then sign out */
  drive.refreshBad.add("RT-CODEA");
  await pa.evaluate(() => { localStorage.setItem("wsb.xgAuth", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("wsb.xgAuth")), {}))); });
  await pa.evaluate(() => X3.syncG(true)); await pa.waitForTimeout(300);
  // the access token from sign-in is still good, so force a refresh by waiting it out
  await pa.evaluate(() => { const a = JSON.parse(localStorage.getItem("wsb.xgAuth")); a.rt = "RT-CODEA"; localStorage.setItem("wsb.xgAuth", JSON.stringify(a)); });
  await A.p.reload(); await pa.waitForTimeout(400);
  await pa.evaluate(() => { __host("viewport", 1280, 800); __host("tab-created", 1, 0, "https://example.com/", "", 0, 0); __host("tab-selected", 1); });
  await pa.evaluate(() => X3.syncG(true)); await pa.waitForTimeout(500);
  check(await pa.evaluate(() => JSON.parse(localStorage.getItem("wsb.xgAuth")).expired === true), "an ended sign-in is noticed");
  check(await pa.evaluate(() => document.querySelector(".xbox .xacc.warn") !== null), "the account button shows it");
  await pb.evaluate(() => X3.acctPanel()); await pb.waitForTimeout(200);
  await pb.evaluate(() => [...document.querySelectorAll("#xacct button")].find(b => b.textContent === "Sign out").click()); await pb.waitForTimeout(400);
  check(drive.revoked.includes("RT-CODEPASTE") && await pb.evaluate(() => !localStorage.getItem("wsb.xgAuth")), "sign out revokes and forgets the token");
  check(await pb.evaluate(() => marks.length) >= 2, "sign out keeps everything on the computer");
  // a private window doesn't sign in
  console.log("\nchecks passed:", ok, "failed:", bad);
  console.log("errors:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
