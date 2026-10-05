// Tests reading a page for later (reader.js): node test-reader.mjs
import worker from "./worker.js";
import { extract } from "./reader.js";
import { Ledger } from "./ledger.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL:", what); } };
const store = new Map();
const ledger = new Ledger({ storage:{ get:async k => store.get(k), put:async (k, v) => { store.set(k, v); }, delete:async k => store.delete(k), list:async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix || ""))) } }, {});
const LEDGER = { idFromName:n => n, get:() => ({ fetch:(u, init) => ledger.fetch(new Request("https://ledger/run", init)) }) };
const env = { ANTHROPIC_API_KEY:"sk-ant-test", OPEN:"true", LIMITS:{ get:async () => null, put:async () => {}, delete:async () => {}, list:async () => ({ keys:[] }) }, LEDGER };
const PAGE = `<!doctype html><html><head><title>Fallback &amp; title</title><meta property="og:title" content="The Big Story"><meta property="og:site_name" content="Daily News">
<script>alert(1)</script><style>p{}</style></head><body><nav><a href="/">Home</a></nav><header>Top</header>
<article><h1>The Big Story</h1><p>First <b>bold</b> paragraph with <a href="/more?x=1">a link</a>.</p><img src="pics/a.jpg" alt="A"><script>evil()</script><form><input></form><p>Second.</p></article>
<footer>© 2026</footer><!-- a comment --></body></html>`;
let asked = [];
globalThis.fetch = async (u, init) => {
  u = String(u); asked.push(u);
  if (u.startsWith("https://news.example/")) return new Response(PAGE, { status:200, headers:{ "content-type":"text/html; charset=utf-8" } });
  if (u.startsWith("https://pdf.example/")) return new Response("%PDF", { status:200, headers:{ "content-type":"application/pdf" } });
  if (u.startsWith("https://gone.example/")) return new Response("no", { status:404, headers:{ "content-type":"text/html" } });
  return new Response("{}", { status:200 });
};
const call = async q => { const r = await worker.fetch(new Request("https://w.example/read?" + q, { headers:{ Origin:"https://spiderkingfr-eng.github.io" } }), env, { waitUntil(){} }); return { s:r.status, j:await r.json() }; };
const D = "device=abcdef1234567890";

const x = extract(PAGE, new URL("https://news.example/2026/story"));
ok(x.title === "The Big Story" && x.site === "Daily News", "the title and the site's name");
ok(/First <b>bold<\/b> paragraph/.test(x.html) && /Second\./.test(x.html) && !/alert|evil|<nav|<form|Home|© 2026|a comment/.test(x.html), "the article only, without scripts, menus, forms or the footer");
ok(/href="https:\/\/news\.example\/more\?x=1"/.test(x.html) && /src="https:\/\/news\.example\/2026\/pics\/a\.jpg"/.test(x.html), "links and pictures with full addresses");
ok(extract("<html><head><title>Only a title</title></head><body><p>Body text</p></body></html>", new URL("https://a.example/")).html.indexOf("Body text") >= 0, "no <article>: the body");
let r = await call("u=" + encodeURIComponent("https://news.example/2026/story") + "&" + D);
ok(r.s === 200 && r.j.ok && r.j.title === "The Big Story" && /Second/.test(r.j.html), "GET /read");
for (const bad of ["javascript:alert(1)", "http://localhost/", "http://192.168.1.1/", "ftp://x.example/", "https://user:pw@x.example/", "http://router.local/", "not a url"]) {
  r = await call("u=" + encodeURIComponent(bad) + "&" + D);
  ok(r.s === 400, "refuses " + bad);
}
ok((await call("u=" + encodeURIComponent("https://news.example/") )).s === 400, "needs a device id");
ok((await call("u=" + encodeURIComponent("https://pdf.example/a.pdf") + "&" + D)).s === 415, "not a web page");
ok((await call("u=" + encodeURIComponent("https://gone.example/") + "&" + D)).s === 502, "a page that's gone");
let last = 0;
for (let i = 0; i < 60; i++) last = (await call("u=" + encodeURIComponent("https://news.example/" + i) + "&device=limitdevice0000001")).s;
ok(last === 200 && (await call("u=" + encodeURIComponent("https://news.example/x") + "&device=limitdevice0000001")).s === 429, "60 pages a day per device");

console.log("reader: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
