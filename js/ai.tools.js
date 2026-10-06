/* Webs Browser - Web AI tools (Windows 3.14, iPhone 2.11; ideas #026-#050), shared by both apps.
   Each tool says what it needs (the page, selected text, open tabs, a picture, a video's captions, or just a form),
   how to ask Web AI (js/ai.js AI.ask), and what to do with the answer (copy it, put it in the page, save it).
   AITools.mount(el, tool, app) builds a tool's form in el; app is the app's side:
     app.ctx(tool)        -> { page:{ title, url, text }, sel:{ text, all }, tabs:[{ title, url, text }], img:{ url | data }, caps:{ title, text }, web }
                             (throws an Error whose message is shown, like "Open a page first")
     app.copy(text), app.insert(text, sel)  (optional: puts the answer where the text was), app.save(name, text) (optional)
   Your own saved prompts (wsb.aiPrompts): [{ id, name, text, on:"page"|"sel"|"none" }]. */
(function () {
"use strict";
if (window.AITools || !window.AI) return;
const get = (k, d) => { try { const v = localStorage.getItem("wsb." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem("wsb." + k, JSON.stringify(v)); } catch (e) {} };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const P = (pg, max) => "<page>\nTitle: " + String(pg.title || "").slice(0, 300) + "\nAddress: " + String(pg.url || "").slice(0, 500) + (pg.text ? "\n\n" + String(pg.text).slice(0, max || 18000) : "") + "\n</page>";
const v1 = (v, k, d) => String(v[k] == null || v[k] === "" ? d || "" : v[k]).trim();

// fields: { k, label, ph, type:"text"|"area"|"select", opts:[[value, label]], sel:true (filled from the selected text), keep:true (remembered) }
const TOOLS = [
  /* writing */
  { id:"rewrite", n:26, g:"Write", icon:"✍️", name:"Rewrite text", sub:"Shorter, friendlier, more formal or fixed", needs:["sel"], insert:true,
    fields:[{ k:"text", label:"Text", type:"area", sel:true, ph:"Select text in a box on the page, or paste it here" },
      { k:"how", label:"Make it", type:"select", opts:[["shorter", "Shorter"], ["friendlier", "Friendlier"], ["more formal", "More formal"], ["correct in spelling, grammar and punctuation, changing nothing else", "Fixed spelling and grammar"], ["simpler", "Simpler"], ["more confident", "More confident"], ["custom", "Something else…"]] },
      { k:"custom", label:"How?", ph:"e.g. sound excited, use British spelling", show:v => v.how === "custom" }],
    prompt:v => ({ content:"Rewrite this text so it is " + (v.how === "custom" ? v1(v, "custom", "better") : v.how) + ". Keep its meaning and its language. Reply with only the rewritten text, no quotes or comments.\n\n" + v.text, plain:true }) },
  { id:"reply", n:27, g:"Write", icon:"↩️", name:"Draft a reply", sub:"To the email or message on this page", needs:["page"], insert:true, pc:true,
    fields:[{ k:"points", label:"What you want to say (optional)", type:"area", ph:"e.g. yes to Thursday, ask about parking" },
      { k:"tone", label:"Tone", type:"select", opts:[["friendly", "Friendly"], ["professional", "Professional"], ["short and polite", "Short"], ["warm", "Warm"]] }],
    prompt:(v, c) => ({ content:P(c.page, 12000) + "\n\nDraft my reply to the latest email or message on this page. Tone: " + v.tone + "." + (v.points ? " Make these points: " + v.points + "." : "") + " Reply with only the text of the reply, ready to send, no subject line.", plain:true }) },
  { id:"tone", n:40, g:"Write", icon:"🎭", name:"Tone check", sub:"How your message might come across", needs:["sel"],
    fields:[{ k:"text", label:"Your message", type:"area", sel:true, ph:"Select it on the page, or paste it here" }],
    prompt:v => ({ content:"Before I send this, tell me how it might come across to the reader: one line on the overall tone, anything that could be misread, then a gentler or clearer version if it would help.\n\n" + v.text }) },
  { id:"cover", n:34, g:"Write", icon:"📄", name:"Cover letter", sub:"From this job page and your details", needs:["page"], insert:true,
    fields:[{ k:"me", label:"About you (kept on this device)", type:"area", keep:true, ph:"Your name, experience, skills, what you're proud of" }, { k:"extra", label:"Anything else to mention (optional)" }],
    prompt:(v, c) => ({ content:P(c.page, 12000) + "\n\nAbout me:\n" + v1(v, "me", "(not given)") + (v.extra ? "\nAlso mention: " + v.extra : "") + "\n\nWrite a cover letter for the job on this page: about 250 words, specific to the job and to me, warm and confident, no clichés. If the page isn't a job listing, say so instead.", plain:true }) },
  { id:"formula", n:47, g:"Write", icon:"🧮", name:"Spreadsheet formula", sub:"Write one, or explain one", needs:[],
    fields:[{ k:"q", label:"What should it do, or paste a formula", type:"area", sel:true, ph:"e.g. add up column B when column A says Paid" }, { k:"app", label:"For", type:"select", opts:[["Excel", "Excel"], ["Google Sheets", "Google Sheets"], ["Numbers", "Numbers"]] }],
    prompt:v => ({ content:"For " + v.app + ": " + (/^\s*=/.test(v.q) ? "explain this formula step by step in plain words, and point out any mistake: " + v.q : "write a formula that does this, then explain it briefly and say where to put it: " + v.q) }) },
  { id:"code", n:46, g:"Write", icon:"💻", name:"Explain code", sub:"Selected code, line by line", needs:["sel", "page"], pc:true,
    fields:[{ k:"text", label:"Code", type:"area", sel:true, ph:"Select code on the page, or paste it" }],
    prompt:(v, c) => ({ content:"Explain this code line by line for someone learning: what each part does, then what the whole thing does, then anything risky or wrong.\n\n```\n" + (v.text || (c.page ? String(c.page.text).slice(0, 8000) : "")) + "\n```" }) },
  /* the page */
  { id:"comments", n:28, g:"This page", icon:"💬", name:"Comment section summary", sub:"The main opinions, in five lines", needs:["page"],
    prompt:(v, c) => ({ content:P(c.page, 24000) + "\n\nSummarise the comments on this page (for YouTube, the comments under the video): the main opinions in five short lines, with roughly how common each is, then the funniest or most useful comment. If there are no comments in the text, say so (on YouTube, scroll down to the comments first)." }) },
  { id:"reviews", n:29, g:"This page", icon:"⭐", name:"Review digest", sub:"Pros and cons from the reviews", needs:["page"],
    prompt:(v, c) => ({ content:P(c.page, 24000) + "\n\nFrom the reviews on this page: a one-line verdict, then Pros and Cons as two short lists, then any warning signs (fake-looking reviews, common faults). If there are no reviews in the text, say so." }) },
  { id:"recipe", n:30, g:"This page", icon:"🍳", name:"Recipe cleaner", sub:"Just the ingredients and steps", needs:["page"],
    prompt:(v, c) => ({ content:P(c.page, 24000) + "\n\nGive just the recipe: its name, servings and time, then ## Ingredients as a list, then ## Steps as a numbered list. Nothing else. If it isn't a recipe, say so." }) },
  { id:"terms", n:35, g:"This page", icon:"📜", name:"Terms and conditions", sub:"What you should know before agreeing", needs:["page"],
    prompt:(v, c) => ({ content:P(c.page, 26000) + "\n\nI'm about to agree to these terms. Tell me in plain words: ## Watch out for (anything unusual or unfair: auto-renewals, fees, data sharing, what you give up), ## The usual stuff (one line), ## How to cancel or opt out. Quote the exact wording for anything serious." }) },
  { id:"simplify", n:36, g:"This page", icon:"🧒", name:"Simplify this page", sub:"At the reading level you pick", needs:["page"],
    fields:[{ k:"level", label:"For", type:"select", opts:[["a 10-year-old", "A 10-year-old"], ["a teenager", "A teenager"], ["an adult who wants plain English", "Plain English"], ["someone learning English", "Someone learning English"]] }],
    prompt:(v, c) => ({ content:P(c.page, 22000) + "\n\nRewrite the main content of this page so " + v.level + " can understand it easily. Keep everything important, use short sentences and headings." }) },
  { id:"quiz5", n:37, g:"This page", icon:"❓", name:"Five-question quiz", sub:"Test what you just read", needs:["page"], out:"quiz",
    prompt:(v, c) => ({ content:P(c.page, 20000) + "\n\nWrite a five-question multiple-choice quiz on the main content of this page. Reply with only JSON in a ```json block like {\"quiz\":[{\"q\":\"…\",\"opts\":[\"a\",\"b\",\"c\",\"d\"],\"a\":0}]} (a is the index of the right option)." }) },
  { id:"lecture", n:33, g:"This page", icon:"🎓", name:"Notes from a lecture video", sub:"Notes and action points from the captions", needs:["caps"],
    prompt:(v, c) => ({ content:"<video>\nTitle: " + String(c.caps.title || "").slice(0, 300) + "\n" + String(c.caps.text || "").slice(0, 26000) + "\n</video>\n\nMake study notes from this video: ## Summary (three lines), ## Notes (organised by topic, with the time [m:ss] where each topic starts if the captions have times), ## Key terms, ## Action points or homework mentioned." }) },
  { id:"factcheck", n:39, g:"This page", icon:"🔍", name:"Fact check", sub:"How true is it, with sources", needs:["sel"], task:"factcheck", search:true,
    fields:[{ k:"claim", label:"The claim", type:"area", sel:true, ph:"Select it on the page, or type it" }],
    prompt:(v, c) => ({ content:"Claim to check: " + v.claim + (c.page && c.page.url ? "\n(Seen on: " + c.page.title + " " + c.page.url + ")" : "") }) },
  /* ask */
  { id:"tabs", n:31, g:"Ask", icon:"🗂️", name:"Ask across tabs", sub:"One question, all your open tabs", needs:["tabs"], pc:true,
    fields:[{ k:"q", label:"Your question", type:"area", ph:"e.g. which of these laptops has the best battery?" }],
    prompt:(v, c) => ({ content:c.tabs.map((t, i) => "<tab n=\"" + (i + 1) + "\">\nTitle: " + String(t.title || "").slice(0, 200) + "\nAddress: " + t.url + "\n" + String(t.text || "").slice(0, 4000) + "\n</tab>").join("\n") +
      "\n\nUsing these open tabs, answer: " + v.q + "\nSay which tab each fact comes from, like (tab 2)." }) },
  { id:"picture", n:32, g:"Ask", icon:"🖼️", name:"Describe a picture", sub:"Pick one on the page", needs:["img"],
    fields:[{ k:"q", label:"Ask about it (optional)", ph:"e.g. what breed is this dog?" }],
    prompt:v => ({ content:v.q ? v.q : "Describe this picture: what it shows, any text in it, and anything notable. Keep it short." }) },
  { id:"compare2", n:48, g:"Ask", icon:"⚖️", name:"Compare by name", sub:"Two things, side by side", needs:[], task:"compare2", search:true,
    fields:[{ k:"a", label:"This", ph:"e.g. iPhone 17" }, { k:"b", label:"With", ph:"e.g. Pixel 10" }, { k:"for", label:"For what? (optional)", ph:"e.g. photos and battery" }],
    prompt:v => ({ content:"Compare " + v.a + " with " + v.b + (v.for ? ", for " + v.for : "") + "." }) },
  /* plan and make */
  { id:"names", n:41, g:"Plan & make", icon:"🏷️", name:"Name ideas", sub:"For a pet, a project or a character", needs:[],
    fields:[{ k:"what", label:"Names for", ph:"e.g. a ginger kitten, a gaming channel, a fantasy villain" }, { k:"style", label:"Style (optional)", ph:"e.g. funny, Japanese, short" }],
    prompt:v => ({ content:"Suggest 12 names for " + v.what + (v.style ? ", in this style: " + v.style : "") + ". A list, each with a few words on why." }) },
  { id:"gifts", n:42, g:"Plan & make", icon:"🎁", name:"Gift ideas", sub:"From a few words and a budget", needs:[],
    fields:[{ k:"who", label:"Who it's for", ph:"e.g. my dad, 60, loves fishing and old films" }, { k:"budget", label:"Budget", ph:"e.g. $50" }, { k:"occasion", label:"Occasion (optional)", ph:"e.g. birthday" }],
    prompt:v => ({ content:"Gift ideas for " + v.who + (v.occasion ? " for " + v.occasion : "") + ", budget " + v1(v, "budget", "any") + ". Give 10 ideas as a list: each with a rough price and a Markdown link to search for it, like [search](https://www.google.com/search?tbm=shop&q=…). Mix safe and surprising picks." }) },
  { id:"trip", n:43, g:"Plan & make", icon:"🧳", name:"Trip planner", sub:"A day-by-day plan with links", needs:[],
    fields:[{ k:"city", label:"Where", ph:"e.g. Tokyo" }, { k:"days", label:"How many days", ph:"3" }, { k:"likes", label:"You like (optional)", ph:"e.g. food, anime shops, quiet parks" }],
    prompt:v => ({ content:"Plan " + v1(v, "days", "3") + " days in " + v.city + (v.likes ? " for someone who likes " + v.likes : "") + ". For each day: ## Day N with morning, afternoon and evening, each place as a Markdown link to Google Maps like [Name](https://www.google.com/maps/search/Name+" + encodeURIComponent(v.city || "") + "), with travel tips between them. End with three practical tips." }) },
  { id:"meals", n:44, g:"Plan & make", icon:"🥕", name:"Fridge meal planner", sub:"A week of meals from what you have", needs:[],
    fields:[{ k:"have", label:"What you have", type:"area", keep:true, ph:"e.g. eggs, rice, chicken, spinach, tomatoes, cheese" }, { k:"people", label:"For how many", ph:"2" }, { k:"diet", label:"Diet (optional)", ph:"e.g. vegetarian, no nuts" }],
    prompt:v => ({ content:"Plan 7 dinners for " + v1(v, "people", "2") + " people using mostly what I have: " + v.have + "." + (v.diet ? " Diet: " + v.diet + "." : "") + " A list by day, each with a one-line method. Then ## Shopping list for what's missing." }) },
  { id:"workout", n:45, g:"Plan & make", icon:"💪", name:"Workout planner", sub:"For your goal and your time", needs:[],
    fields:[{ k:"goal", label:"Goal", ph:"e.g. get stronger, run 5 km, more flexible" }, { k:"time", label:"Time (optional)", ph:"e.g. 30 minutes, 3 days a week" }, { k:"kit", label:"Equipment (optional)", ph:"e.g. none, dumbbells, a gym" }],
    prompt:v => ({ content:"Make a simple 4-week workout plan. Goal: " + v.goal + ". Time: " + v1(v, "time", "30 minutes, 3 days a week") + ". Equipment: " + v1(v, "kit", "none") + ". Week by week, with each session's exercises, sets and reps. Add a short warm-up and one safety note." }) }
];
const byId = id => TOOLS.find(t => t.id === id) || null;
const GROUPS = ["Write", "This page", "Ask", "Plan & make"];

/* ---------------------------------------------------------------- your own prompts */
const prompts = () => (get("aiPrompts", []) || []).filter(p => p && p.name && p.text).slice(0, 30);
const savePrompts = l => put("aiPrompts", l.slice(0, 30));
const promptTool = p => ({ id:"p:" + p.id, n:50, g:"Yours", icon:"⭐", name:p.name, sub:p.on === "page" ? "On this page" : p.on === "sel" ? "On the selected text" : "", needs:p.on === "page" ? ["page"] : p.on === "sel" ? ["sel"] : [],
  fields:p.on === "sel" ? [{ k:"text", label:"Text", type:"area", sel:true }] : p.on === "none" ? [{ k:"extra", label:"Anything to add (optional)" }] : [],
  prompt:(v, c) => ({ content:(p.on === "page" && c.page ? P(c.page, 20000) + "\n\n" : "") + p.text + (p.on === "sel" ? "\n\n" + v.text : "") + (v.extra ? "\n\n" + v.extra : "") }) });

/* ---------------------------------------------------------------- the form */
function mount(el, tool, app) {
  const keep = get("aiToolKeep", {}) || {};
  el.innerHTML = '<div class="ait-f"></div><div class="ait-go"><button type="button" class="ait-run">' + esc(tool.out === "quiz" ? "Make the quiz" : "Ask Web AI") + '</button><span class="ait-left"></span></div><div class="ait-out"></div><div class="ait-acts"></div>';
  const f = el.querySelector(".ait-f"), out = el.querySelector(".ait-out"), acts = el.querySelector(".ait-acts"), run = el.querySelector(".ait-run");
  const vals = () => { const v = {}; f.querySelectorAll("[data-k]").forEach(i => { v[i.dataset.k] = i.value.trim(); }); return v; };
  (tool.fields || []).forEach(fd => {
    const w = document.createElement("label"); w.className = "ait-l"; w.innerHTML = "<span></span>"; w.firstChild.textContent = fd.label;
    let i;
    if (fd.type === "select") { i = document.createElement("select"); i.innerHTML = fd.opts.map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + "</option>").join(""); }
    else if (fd.type === "area") { i = document.createElement("textarea"); i.rows = 3; }
    else { i = document.createElement("input"); i.type = "text"; }
    i.className = "ait-i"; i.dataset.k = fd.k; if (fd.ph) i.placeholder = fd.ph;
    if (fd.keep && keep[fd.k]) i.value = keep[fd.k];
    w.appendChild(i); f.appendChild(w);
    if (fd.show) { const upd = () => { w.hidden = !fd.show(vals()); }; f.addEventListener("change", upd); setTimeout(upd); }
  });
  const left = () => { const n = AI.left(); el.querySelector(".ait-left").textContent = n == null ? "" : n + " question" + (n === 1 ? "" : "s") + " left today"; };
  left();
  let sel = null, ctx = null, busy = false, answer = "";
  // what's selected on the page, ready in the form
  if ((tool.needs || []).includes("sel") && app.sel) app.sel().then(s => { sel = s; const fd = (tool.fields || []).find(x => x.sel); if (s && s.text && fd) { const i = f.querySelector('[data-k="' + fd.k + '"]'); if (i && !i.value) i.value = s.text; } }).catch(() => {});
  const busyOn = t => { out.innerHTML = '<div class="ait-w"><i></i><span></span></div>'; out.querySelector("span").textContent = t; };
  const failed = e => { out.innerHTML = '<div class="ait-err"></div>'; out.firstChild.textContent = e && e.message || "Web AI couldn't answer."; };
  run.onclick = async () => {
    if (busy) return;
    const v = vals();
    const need = (tool.fields || []).find(fd => fd.type !== "select" && !/optional/i.test(fd.label) && !fd.show && !fd.keep && !v[fd.k] && !fd.sel);
    const needSel = (tool.fields || []).find(fd => fd.sel && !v[fd.k] && !(tool.needs || []).includes("page"));
    if (need || needSel) { const fd = need || needSel; const i = f.querySelector('[data-k="' + fd.k + '"]'); if (i) i.focus(); out.innerHTML = '<div class="ait-err"></div>'; out.firstChild.textContent = "Fill in “" + fd.label.replace(/ \(.*\)$/, "") + "” first."; return; }
    (tool.fields || []).forEach(fd => { if (fd.keep) keep[fd.k] = v[fd.k]; }); put("aiToolKeep", keep);
    busy = true; run.disabled = true; acts.innerHTML = ""; answer = "";
    busyOn((tool.needs || []).some(n => n === "page" || n === "tabs" || n === "caps") ? "Reading…" : (tool.needs || []).includes("img") ? "Looking at the picture…" : "Thinking…");
    try {
      ctx = await app.ctx(tool);
      const q = tool.prompt(v, ctx || {});
      busyOn(tool.search ? "Searching and checking…" : "Thinking…");
      const r = await AI.ask(tool.task || "", q.content, { web:!!(ctx && ctx.web), search:!!tool.search, image:ctx && ctx.img ? ctx.img : undefined,
        onText:t => { if (tool.out !== "quiz") { answer = t; out.innerHTML = '<div class="ait-a">' + (q.plain ? esc(t).replace(/\n/g, "<br>") : AI.md(t)) + "</div>"; } } });
      answer = r.text;
      if (tool.out === "quiz") {
        const j = AI.json(answer); if (!j || !Array.isArray(j.quiz)) throw new Error("The quiz didn't come out right. Try again.");
        out.innerHTML = ""; const box = document.createElement("div"); out.appendChild(box); AI.study(box, { cards:[], quiz:j.quiz });
      } else {
        out.innerHTML = '<div class="ait-a">' + (q.plain ? esc(answer).replace(/\n/g, "<br>") : AI.md(answer)) + "</div>";
        const b = (t, fn, main) => { const x = document.createElement("button"); x.type = "button"; x.className = "ait-b" + (main ? " main" : ""); x.textContent = t; x.onclick = fn; acts.appendChild(x); };
        const plain = q.plain ? answer : AI.plain(answer) === answer ? answer : answer.replace(/^#+\s*/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1");
        if (tool.insert && app.insert) b(sel && sel.edit ? "Replace it on the page" : "Put it on the page", () => app.insert(plain, sel), true);
        b("Copy", () => { app.copy(plain); acts.querySelector(".ait-b:last-child").textContent = "Copied"; });
        if (app.save) b("Save as a file", () => app.save(tool.name + ".txt", plain));
      }
    } catch (e) { failed(e); }
    busy = false; run.disabled = false; left();
  };
  if (!(tool.fields || []).length && tool.autorun !== false) setTimeout(() => run.click());
  return { run:() => run.click(), answer:() => answer };
}

/* ---------------------------------------------------------------- your prompts, edited */
function promptsEditor(el, onChange) {
  const paint = () => {
    const l = prompts();
    el.innerHTML = '<div class="ait-pl"></div><div class="ait-add"><input class="ait-i" data-k="name" placeholder="Name (e.g. Explain like I\'m 10)" maxlength="40"><textarea class="ait-i" data-k="text" rows="2" placeholder="The prompt (e.g. Explain this simply, with an example)" maxlength="1500"></textarea>' +
      '<select class="ait-i" data-k="on"><option value="page">Use it on the page</option><option value="sel">Use it on selected text</option><option value="none">On its own</option></select><button type="button" class="ait-b main">Save the prompt</button></div>';
    const pl = el.querySelector(".ait-pl");
    l.forEach(p => { const r = document.createElement("div"); r.className = "ait-p"; r.innerHTML = "<b></b><em></em><button type=\"button\" class=\"ait-x\" title=\"Delete\">✕</button>"; r.querySelector("b").textContent = p.name; r.querySelector("em").textContent = p.text; r.querySelector("button").onclick = () => { savePrompts(prompts().filter(x => x.id !== p.id)); paint(); if (onChange) onChange(); }; pl.appendChild(r); });
    el.querySelector(".ait-add .ait-b").onclick = () => {
      const g = k => el.querySelector('.ait-add [data-k="' + k + '"]').value.trim();
      if (!g("name") || !g("text")) return;
      savePrompts(prompts().concat([{ id:Date.now().toString(36), name:g("name").slice(0, 40), text:g("text").slice(0, 1500), on:g("on") }])); paint(); if (onChange) onChange();
    };
  };
  paint();
}

const css = document.createElement("style");
css.textContent = `
.ait-f{display:grid;gap:8px}.ait-l{display:grid;gap:4px;font-size:12.5px;color:var(--dim)}.ait-l[hidden]{display:none}
.ait-i{font:inherit;font-size:14px;color:var(--fg);background:var(--bg3, rgba(127,127,127,.12));border:1px solid var(--line, rgba(127,127,127,.25));border-radius:10px;padding:8px 10px;width:100%;box-sizing:border-box}
textarea.ait-i{resize:vertical;min-height:60px}.ait-go{display:flex;align-items:center;gap:10px;margin:10px 0 4px;flex-wrap:wrap}.ait-left{font-size:12px;color:var(--dim)}
.ait-run,.ait-b{font-weight:600;font-size:13.5px;font-family:inherit;border-radius:10px;padding:8px 14px;border:1px solid var(--line, rgba(127,127,127,.3));background:var(--bg3, rgba(127,127,127,.12));color:var(--fg);cursor:pointer}
.ait-run,.ait-b.main{background:var(--accent);border-color:var(--accent);color:#fff}.ait-run:disabled{opacity:.5;cursor:default}
.ait-out{font-size:14px;line-height:1.55;margin-top:6px;overflow-wrap:anywhere}.ait-a h4{margin:12px 0 4px}.ait-a ul,.ait-a ol{padding-left:20px;margin:4px 0}.ait-a p{margin:6px 0}.ait-a a{color:var(--accent)}
.ait-a table{border-collapse:collapse;font-size:13px}.ait-a td,.ait-a th{border:1px solid var(--line, rgba(127,127,127,.3));padding:4px 6px;text-align:left;vertical-align:top}.ait-a .ai-tw{overflow-x:auto}
.ait-w{display:flex;align-items:center;gap:10px;padding:12px 2px;color:var(--dim)}.ait-w i{width:16px;height:16px;border-radius:50%;border:2px solid var(--line, rgba(127,127,127,.3));border-top-color:var(--accent);animation:aitSpin .8s linear infinite}@keyframes aitSpin{to{transform:rotate(1turn)}}
.ait-err{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#e8342a 14%,transparent)}.ait-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ait-p{position:relative;padding:8px 28px 8px 0;border-bottom:1px solid var(--line, rgba(127,127,127,.2))}.ait-p b{display:block;font-size:14px}.ait-p em{font-style:normal;font-size:12.5px;color:var(--dim);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ait-x{position:absolute;right:0;top:8px;border:0;background:none;color:var(--dim);cursor:pointer;font-size:14px}.ait-add{display:grid;gap:6px;margin-top:10px}
.ai-savecards{margin-top:10px;font-weight:600;font-size:13px;font-family:inherit;border-radius:10px;padding:8px 12px;border:1px solid var(--line, rgba(127,127,127,.3));background:transparent;color:var(--fg);cursor:pointer}`;
document.head.appendChild(css);

window.AITools = { TOOLS, GROUPS, byId, mount, prompts, savePrompts, promptTool, promptsEditor, P };
})();
