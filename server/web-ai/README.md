# Web AI server

Web AI in Webs Browser (Windows 3.3 and iPhone 2.2 and later) talks to this small server.
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
The same server runs your dashboard (`/admin`): Help & support, notifications,
what's on everyone's start page, updates and settings (see **Your dashboard** below).

The server is this whole folder: `worker.js` (Web AI, notifications, support),
`owner.js` (the owner's settings and security), `live.js` (what's on everyone's
start page), `dash.js` and `icons.js` (the dashboard), `wrangler.jsonc` and `setup.cmd`.
Keep them together: `setup.cmd` puts all of them on Cloudflare at once.

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
3. Put every file from this folder together in one folder (`worker.js`, `owner.js`, `live.js`,
   `dash.js`, `icons.js`, `wrangler.jsonc`, `setup.cmd`), then double-click `setup.cmd`. It:
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

## Help & support

People write from *Menu → Help & support* in either app. Open your dashboard
(`https://…workers.dev/admin`, the code named `Me` or an `ADMIN_CODE`): **Help & support** lists
the chats. Click one to answer; a reply also reaches their iPhone as a notification when they have
those on.

Next to the chat is a small screen of their iPhone or PC with the settings support may change
(the list in `js/support.settings.js`, checked by this server and again by the app before anything
is applied). It's locked unless they turn on **Let support adjust my settings**, which lasts 30
minutes and which they can end any time. Changes reach their device within a few seconds and show
there with Undo. You never see their history, bookmarks, tabs, passwords or pages: the app sends
only the chat and the values of the settings on that list.

**Close this chat** when you're done; they can end it too. A chat and its settings are deleted
from the server 30 days after the last message. One internet connection can start 5 chats a day.

## Your dashboard

Open `https://…workers.dev/admin` on your computer or phone and sign in with the owner's code (the
code named `Me`, an `ADMIN_CODE`, or one you set on the dashboard). Tick **Remember this browser**
so you don't type it each time. On a phone, **Add to Home Screen** makes it an app, which can send
you alerts.

- **Overview:** questions today and what they cost, people using Webs right now, today and this
  week, their countries and versions, the last 14 days, and **Run the checks** (is the Claude key
  working, the storage, notifications, your websites).
- **Support:** the chats and problem reports (reply, mark fixed, block a device that misbehaves),
  saved replies, an away message, how long finished chats are kept, and the help articles people see.
- **Start page:** what everyone sees under the search box: an announcement (with emoji reactions),
  a calling card, a poll, a countdown, your pick of the week, Webs's birthday, quotes, trivia,
  mystery boxes and theme days by date, tomorrow's daily word, a community goal, a secret code hunt,
  secret words, limited-time achievements, the wallpaper of the week and sticker packs. Each part
  opens with a click and shows its results (votes, right answers, reactions, finds).
- **Notifications:** send to every iPhone, to your own phone first, or at a time you pick; and the
  history of what was sent.
- **Updates:** a new version can reach some people first (a gradual rollout: 10%, 50%, everyone),
  and every PC can go back to the version before while a problem is fixed. On iPhones (2.7 and
  later) a rollout can be paused; to undo an iPhone version, put the old files back on GitHub.
- **Settings:** Web AI (pause it, the model, answer length, daily limits, a spending cap per day),
  maintenance mode, the owner's code, Web AI codes, alerts on your phone (support messages, new
  sign-ins, websites going down, the spending cap), two-step login, blocked devices and codes,
  websites to watch, and **Download a backup**.
- **Log:** what was changed from the dashboard, and when.

**Two-step login:** turn it on in Settings once alerts reach your phone. A new browser then needs
your approval from a notification, or the recovery code shown when you turned it on (write it down).
Wrong codes send you an alert (the 3rd and the 10th of the day), and one internet connection gets 20 wrong tries a day.

**What it costs to run:** Cloudflare's free plan allows 1,000 storage writes a day. Each Web AI
question uses about 4; each device checks in about once an hour but is written at most every hour
or few (less often when there are many), and the numbers on the dashboard are worked out once an
hour. **Run the checks** shows today's estimate. Past about 200 questions a day, Cloudflare's $5
plan removes the limit.

## Seeing what's happening

- **Claude Console → Usage** shows what each day cost.
- **Cloudflare → your worker → Logs** (turn logs on there if asked) shows each question: who asked (by name), and how many tokens it used. It never shows the question itself.

## What gets sent where

- **Windows:** the question, and the text of the page you have open while "Use this page" is on (up to about 16,000 characters). Private windows never send their page.
- **Help & support:** what's written in the chat, the app's version, and the values of the settings support may change (`js/support.settings.js`). Kept until 30 days after the last message.
- **iPhone:** the question, and the page's address while "Use this page" is on. The app can't read pages itself, so Claude may open that address once, reading at most about 6,000 tokens. Private tabs never send their page.
- **Anonymous counts** (Windows 3.7 and iPhone 2.7, unless *Send anonymous counts* is off): about once an hour, the app's version, whether it's on Windows or iPhone, and the country Cloudflare sees. Each device is a random id the server keeps only as a hash, for 90 days after it was last seen. Never what anyone browses.
- **What people choose to send:** a vote, a trivia answer, a reaction, a found code, a nickname and best score for the weekly leaderboard, and a problem report (what they wrote, the version, the window size, recent errors). Problem reports are kept 90 days.
- The server keeps no Web AI chats. It keeps only a number per person per day, for 3 days.
- Claude is made by Anthropic. Questions go to the Claude API under your Console account's terms.

## For developers

- `node test.mjs` tests the worker with a pretend Claude API and pretend storage.
- `node test-support.mjs` tests Help & support: what's kept, who can read it, access, the list of settings and its time limit.
- `node test-owner.mjs` tests the dashboard's settings and security (two-step login, codes, alerts, the spending cap, blocking, backups); `node test-live.mjs` tests the start page parts, check-ins, votes, scores and the hourly numbers.
- `node test-push.mjs` tests notifications with a pretend Apple push service that decrypts each message with the phone's key and checks the signature.
- `windows/tests/t_webai.js` runs the browser's Web AI against this worker end to end.
- The browser sends `POST /chat` with `{ code, messages:[{ role, content }], web? }` and reads back one JSON object per line: `{ d }` for each piece of text, then `{ end, stop, left }`, or `{ error, message }`.
- The model, answer length, effort, system prompt and tools are fixed here. The browser can't change them.
