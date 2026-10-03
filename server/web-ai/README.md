# Web AI server

Web AI in Webs Browser (Windows 3.3 and iPhone 2.2) talks to this small server.
The server holds the Claude API key, so the key never ships inside the browser,
which anyone can download and take apart. The server also checks each person's
Web AI code, counts their questions per day, and passes Claude's answer back
word by word.

It runs on Cloudflare Workers. The free plan is plenty: 100,000 requests a day.
`worker.js` is a single file you paste into Cloudflare's editor. There's nothing
to install.

## What it costs

Cloudflare: nothing on the free plan.
Claude: each question uses credit from your Claude Console account. With the
standard model (Claude Sonnet 5.5) that's about 1 cent to summarize a page, and
less for a short question. Set a monthly spend limit in the Console
(the Billing page, under **Spend limits**) so the bill can never go over what you choose.

Three limits keep spending in check:

| Setting | Default | What it does |
|---|---|---|
| `DAILY_LIMIT` | 25 | Questions per person per day |
| `TOTAL_DAILY_LIMIT` | 150 | Questions for everyone together per day |
| Spend limit in the Claude Console | yours to choose | The hard ceiling on the bill |

Days reset at midnight UTC.

## Setting it up (about 10 minutes)

### 1. Put the worker on Cloudflare

Newer Cloudflare accounts can't edit Worker code in the dashboard, so a small
script does it from your computer:

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Install **Node.js** (the **LTS** version) from [nodejs.org](https://nodejs.org). Keep all the
   default options.
3. Put `worker.js`, `wrangler.jsonc` and `deploy.cmd` from this folder together in one folder,
   then double-click `deploy.cmd`.
   - The first time, a browser window asks you to log in to Cloudflare and **Allow** Wrangler.
   - If it asks whether to continue because the Worker was changed in the dashboard, type `y`.
4. When it says **Deployed**, it shows the worker's address, something like
   `https://web-ai.your-name.workers.dev`. Keep it for step 5.

Later versions of `worker.js` go up the same way: run `deploy.cmd` again. Your key, codes and
`LIMITS` stay as they are; check step 2 once afterwards.

### 2. Make the storage for the daily counts

1. Go to **Storage & Databases → KV** (it may be under **Workers & Pages → KV**) and choose **Create** (a namespace). Name it `web-ai-limits`.
2. Open your `web-ai` worker, then **Settings → Bindings → Add → KV namespace** (not D1 database).
   - Variable name: `LIMITS`
   - KV namespace: `web-ai-limits`
3. Click **Deploy** (or **Save**).

### 3. Add your Claude API key

1. In the Claude Console ([console.anthropic.com](https://console.anthropic.com)), go to **API keys → Create key**. Name it `Web AI` and copy it. It starts with `sk-ant-`.
2. Open your `web-ai` worker, then **Settings → Variables and Secrets → Add**.
   - Type: **Secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: the key
3. Click **Deploy**.

Paste the key only here. Don't email it, send it in a chat, or put it in this
repository. If it ever leaks, delete it in the Console and make a new one.

### 4. Add the Web AI codes

Everyone who may use Web AI gets their own code. Add one more secret the same way:

- Type: **Secret**
- Name: `WEB_AI_CODES`
- Value: one line per person, `Name=code`:

```
Me=k7m2qx9wfp3d
Sam=r4tz8nv2hc6y
Alex=w9pd3kx7mq2b
```

- Each code needs 8 or more letters and numbers. Make them random, not words.
- To give one person a different daily limit, add it at the end: `Me=k7m2qx9wfp3d=60`.
- The name is what Web AI greets them with.
- To remove someone, delete their line and click **Deploy**. Their code stops working right away.

### 5. Check it

Open the worker's address in a browser. It should say:

```
{"ok":true,"name":"Web AI","ready":true,"model":"claude-sonnet-5-5"}
```

If `ready` is `false`, one of steps 2 to 4 is missing. In Webs Browser, Web AI
explains which one when you click Connect.

### 6. Tell the browsers where it is

Send the worker's address to whoever looks after this repository (or run
`python3 tools/set_webai_server.py https://web-ai.your-name.workers.dev`
yourself), then merge into main. Every copy of Webs Browser, on Windows and on
iPhone, picks the address up with its next update check. People then only type
their code.

Until then, anyone can still type the address themselves: Web AI → ⚙ → Server address.

## Other settings (optional)

Add these the same way, as **Text** rather than Secret:

| Name | Example | What it does |
|---|---|---|
| `DAILY_LIMIT` | `25` | Questions per person per day |
| `TOTAL_DAILY_LIMIT` | `150` | Questions for everyone together per day |
| `MODEL` | `claude-haiku-4-5` | A cheaper, faster model (about half the price). Default `claude-sonnet-5-5` |

## Seeing what's happening

- **Claude Console → Usage** shows what each day cost.
- **Cloudflare → your worker → Logs** (turn logs on there if asked) shows each question: who asked (by name), and how many tokens it used. It never shows the question itself.

## What gets sent where

- **Windows:** the question, and the text of the page you have open while "Use this page" is on (up to about 16,000 characters). Private windows never send their page.
- **iPhone:** the question, and the page's address while "Use this page" is on. The app can't read pages itself, so Claude may open that address once, reading at most about 6,000 tokens. Private tabs never send their page.
- The server keeps no chats. It keeps only a number per person per day, for 3 days.
- Claude is made by Anthropic. Questions go to the Claude API under your Console account's terms.

## For developers

- `node test.mjs` tests the worker with a pretend Claude API and pretend storage.
- `windows/tests/t_webai.js` runs the browser's Web AI against this worker end to end.
- The browser sends `POST /chat` with `{ code, messages:[{ role, content }], web? }` and reads back one JSON object per line: `{ d }` for each piece of text, then `{ end, stop, left }`, or `{ error, message }`.
- The model, answer length, effort, system prompt and tools are fixed here. The browser can't change them.
