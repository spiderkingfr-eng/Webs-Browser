# Web AI server

Web AI in Webs Browser (Windows 3.3 and iPhone 2.2) talks to this small server.
The server holds the Claude API key, so the key never ships inside the browser,
which anyone can download and take apart. It counts the questions asked per day
and passes Claude's answer back word by word.

**Nobody needs to set anything up.** Web AI in the browser connects by itself.
With `OPEN` on (the default in `wrangler.jsonc`), nobody needs a code: the server
counts questions per device and per internet connection. Without `OPEN`, every
copy uses the shared code that comes with the update files
(`tools/set_webai_server.py --code`). Personal Web AI codes still work, for
someone who should get their own limit.

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
| `DAILY_LIMIT` | 25 | Questions per device (or per code) per day |
| `NETWORK_DAILY_LIMIT` | 100 | Questions per internet connection per day, without a code |
| `TOTAL_DAILY_LIMIT` | 150 | Questions for everyone together per day |
| Spend limit in the Claude Console | yours to choose | The hard ceiling on the bill |

The server's address is public, in this repository, so with `OPEN` on anyone
could ask, but only within these limits.

Days reset at midnight UTC.

## Setting it up (about 10 minutes)

### 1. Make your codes

Everyone who may use Web AI gets their own code. Write them as one line, `Name=code`,
separated by commas:

```
Me=k7m2qx9wfp3d,Sam=r4tz8nv2hc6y,Alex=w9pd3kx7mq2b
```

- Each code needs 8 or more letters and numbers. Make them random, not words.
- `Me=k7m2qx9wfp3d=60` gives that person 60 questions a day instead of the usual 25.
- The name is what Web AI greets them with.

### 2. Get a Claude API key

In the Claude Console ([console.anthropic.com](https://console.anthropic.com)), go to
**API keys → Create key**. Name it `Web AI` and copy it. It starts with `sk-ant-`. Paste it only
where setup.cmd asks for it. Don't email it, send it in a chat, or put it in this repository. If
it ever leaks, delete it in the Console and make a new one.

### 3. Run setup.cmd

Newer Cloudflare accounts can't edit Worker code in the dashboard, so `setup.cmd` does
everything from your computer:

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). If you
   already made a `web-ai` worker there by hand, delete it first: it → **Settings** → **Delete**
   at the bottom.
2. Install **Node.js** (the **LTS** version) from [nodejs.org](https://nodejs.org). Keep all the
   default options.
3. Put `worker.js`, `wrangler.jsonc` and `setup.cmd` from this folder together in one folder,
   then double-click `setup.cmd`. It:
   - puts the worker on Cloudflare and creates the storage for the daily counts (`LIMITS`). The
     first time, a browser tab asks you to log in to Cloudflare. Click **Allow**.
   - asks for your **Claude API key**. Paste it and press Enter. It's stored as a Cloudflare
     secret, hidden even from the dashboard.
   - asks for the **codes**. Paste the line from step 1 and press Enter.
4. The worker's address is in the output, like `https://web-ai.your-name.workers.dev`. It's also
   on the worker's page in the dashboard, under **Visit**.

Run `setup.cmd` again any time to update the code, or to change the key or the codes. It asks
before changing either. To remove someone, run it again and paste the codes without theirs.

### 4. Check it

Open the worker's address in a browser. It should say:

```
{"ok":true,"name":"Web AI","ready":true,"model":"claude-sonnet-5-5"}
```

If `ready` is `false`, the key or the codes are missing: run setup.cmd again and answer Y. In Webs Browser, Web AI
explains which one when you click Connect.

### 5. Tell the browsers where it is

Send the worker's address to whoever looks after this repository (or run
`python3 tools/set_webai_server.py https://web-ai.your-name.workers.dev`
yourself), then merge into main. Every copy of Webs Browser, on Windows and on
iPhone, picks the address up with its next update check. People then only type
their code.

Until then, anyone can still type the address themselves: Web AI → ⚙ → Server address.

## Other settings (optional)

Add these to `"vars"` in `wrangler.jsonc` (for example `"vars": { "DAILY_LIMIT": "25" }`), then run setup.cmd again:

| Name | Example | What it does |
|---|---|---|
| `OPEN` | `"true"` | No code needed (set in `wrangler.jsonc`) |
| `DAILY_LIMIT` | `25` | Questions per device (or per code) per day |
| `NETWORK_DAILY_LIMIT` | `100` | Questions per internet connection per day, without a code |
| `TOTAL_DAILY_LIMIT` | `150` | Questions for everyone together per day |
| `MODEL` | `claude-haiku-4-5` | A cheaper, faster model (about half the price). Default `claude-sonnet-5-5` |

## Notifications on iPhones

The same server sends the iPhone app's notifications (Settings → Notifications in the app). Nothing to
set up: it makes its own signing key the first time a phone asks, and Cloudflare runs it every
minute (the `"triggers"` line in `wrangler.jsonc`, which setup.cmd sends along).

- **New versions:** when `updates/iphone.json` gets a new version, every iPhone that wants it is told
  about 10 to 20 minutes later (so the update is really online by then). The first line of the
  notes is the message.
- **News:** open your dashboard (`https://…workers.dev/admin`), write a title and a message under
  **Notifications on iPhones**, and press Send. It needs the code named `Me` (or an `ADMIN_CODE`
  secret), never a code you've handed out.
- **Daily word reminder:** at the hour each person picked.

iPhones only get notifications from apps on the Home Screen, with iOS 16.4 or newer. The server
keeps each phone's notification address and choices (not who it belongs to), and forgets a phone
when it turns notifications off. Big sends go out 20 phones at a time, a batch a minute, so a free
Cloudflare account is fine.

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
- `node test-push.mjs` tests notifications with a pretend Apple push service that decrypts each message with the phone's key and checks the signature.
- `windows/tests/t_webai.js` runs the browser's Web AI against this worker end to end.
- The browser sends `POST /chat` with `{ code, messages:[{ role, content }], web? }` and reads back one JSON object per line: `{ d }` for each piece of text, then `{ end, stop, left }`, or `{ error, message }`.
- The model, answer length, effort, system prompt and tools are fixed here. The browser can't change them.
