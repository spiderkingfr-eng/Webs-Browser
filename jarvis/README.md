# Jarvis for Webs — a screen assistant for your PC

A small background app that sits in your system tray. Say your wake word (**"Jarvis…"**) or press a
hotkey, ask anything, and it answers in a little bubble at the bottom‑right of your screen — **seeing
what's on your screen** if you let it. So while you're playing Minecraft you can say *"Jarvis, how do I
make a furnace?"* and it answers, because it took one screenshot and looked.

It uses **your own Web AI server** (the same one the Webs browser uses) for the answer and for the
voice. Nothing about you is stored anywhere, and a screenshot is only ever sent **the moment you ask a
question** — never continuously.

---

## What you need

1. **Node.js** (18 or newer) — https://nodejs.org
2. **Your Web AI server address**: the `…workers.dev` address you set up for the browser. You paste it
   into Settings on first run. To **see your screen**, the server must be the updated one (unzip the newest
   `web-ai-server` zip and run `setup.cmd`). Older servers quietly drop the screenshot, so the answer comes
   back "blind". **Test the connection** in Settings tells you which you have ("can see your screen"). With an
   ElevenLabs key it also does the voice.

Hearing you (the wake word and spoken questions) uses **Windows' own built-in speech recognition** — no
download, no account, no extra install. The hotkey and the typed box also work on their own.

## Run it

```
cd jarvis
npm install
npm start
```

On first run the Settings window opens. Paste your server address, press **Test the connection**, pick a
name, and close it. The tray icon (bottom‑right of Windows) is where everything lives:

- **Ask Jarvis** (or press the hotkey, default **Alt+Shift+J**) — listen for one question and answer.
- **Type a question** — opens the bubble with a text box (always works).
- **Listen for "Jarvis"** — always‑on wake word (Windows speech).
- **Read answers aloud**: tick it off to just read the answers (no voice). The 🔊 button on the bubble does
  the same.
- **Show what I can see**: takes a screenshot now and opens it, so you can check exactly what it sees.
- **Settings…**, **Show the bubble**, **Quit**.

## The wake word / talking to it

Turning your speech into text is done **on your PC by Whisper** (an accurate speech model that runs locally in
the app). The model (~75 MB, or ~40 MB if you pick **Hearing: Fast** in Settings for a slower PC) is fetched once
from a public CDN the first time you use voice, then cached - so the first spoken question after installing takes
a moment while it downloads. Windows' own recognition is used only to spot the wake word "Jarvis" (it's reliable
at one known word); Whisper hears the actual question. Nothing about you leaves the PC. If Whisper can't load
(offline on first run), it falls back to Windows' own recognition, and typing always works.

You can say it all in one breath - *"Jarvis, how do I make a furnace?"* - or pause after the name. While it's
listening for the wake word, the app keeps the last few seconds of sound **in memory only** (never saved, never
sent), so a question you've already started when Windows recognises the name isn't lost.

- **Press the hotkey** (default **Alt+Shift+J**) and just speak your question.
- Or turn on the always-listening wake word: tray icon → tick **Listen for "Jarvis"** → then say
  *"Jarvis, how do I make a furnace?"* any time. A small **red ball** appears in the bottom-right corner so
  you can see it's listening; it glows amber while it's working on your question.

If Windows speech has never been used on your PC, Windows may ask to set it up the first time (Start →
Settings → Time & language → Speech). It's only Windows itself — not us. On non-Windows PCs there's no
built-in recogniser, so use the typed box.

The voice that reads answers aloud is **Adam**, through your server's `/speak` — it only works if your
server has an ElevenLabs key (the browser's `setup.cmd` asks for one).

## Making it stop talking

- Click **■ Stop** on the bubble (it shows while it's talking or still answering). It goes quiet mid-sentence
  and keeps the answer on screen for you to read.
- Or press the hotkey (**Alt+Shift+J**) while it's talking. Press it again to ask something new.
- Or just say its name: *"Jarvis"* makes it go quiet straight away and listen. *"Jarvis, stop"* (or "shut up",
  "be quiet") stops it; *"Jarvis, <a new question>"* asks that instead.
- To never hear the voice, click **🔊** on the bubble (it turns to 🔇) and answers are only written out. Click it
  again to hear them.

## Settings (tray → Settings…)

- **Its name** — also the wake word ("Jarvis", "Friday", whatever you like).
- **What it calls you** — sir, boss, your name… (optional).
- **Style** — calm, short, friendly or detailed.
- **Server address** and **code** — your Web AI server.
- **Listen for the wake word**, **Read answers aloud**, **Let it see my screen**, **Show the bubble**.
- **Hotkey**, **Microphone**, **Hearing** (accurate or fast), **Start with Windows**.

## "It says it can't see my screen"

1. Tray icon → **Show what I can see**. If a picture of your screen opens, the capture works.
2. Settings → **Test the connection**. If it says *"too old to see your screen"*, update the server (newest
   `web-ai-server` zip → `setup.cmd`). The bubble also shows an orange ⚠ line when this is the problem.
3. If the capture itself fails, the orange ⚠ line in the bubble says why.

## Honest notes

- **Your screen is sent only when you ask**, and only to *your* Web AI server. Turn off **"Let it see my
  screen"** to ask without a screenshot (it then answers from your words alone).
- **Some competitive games** with strict anti‑cheat dislike overlays or screen‑capture tools. For those,
  turn off **"Show the bubble"** (and the screenshot) — or just don't run it while playing them. For
  single‑player games like Minecraft it's a non‑issue.
- This app was written to be run with `npm start`. To make a one‑click installer (`npm run dist`,
  Windows `.exe`), run `electron-builder` on a Windows machine or CI — it can't be built on the Linux box
  this was developed on.

## Making a Windows installer

```
npm install
npm run dist
```

produces an installer under `dist/`.

## What's inside

| file | what it does |
|------|--------------|
| `main.js` | the app: tray, windows, hotkey, screenshot, talking to the server, Windows speech |
| `lib/stt-win.ps1` | hearing you, using Windows' own speech recognition |
| `preload.js` | the safe bridge between the windows and the app |
| `overlay.html/.js/.css` | the bubble at the bottom‑right |
| `settings.html/.js/.css` | the settings window |
| `worker.html/.js` | hidden: hearing you (Whisper) and playing the spoken answer |
| `lib/shot-win.ps1` | the screenshot (System.Drawing) |
| `dot.html/.css/.js` | the little red "I'm listening" ball |
| `lib/config.js` | your settings, in one JSON file on this PC |
| `lib/wake.js` | hearing the wake word and pulling out the question |
| `lib/listen.mjs` | telling your voice from quiet, keeping the last few seconds, knowing when you've finished |
| `lib/ai.js` | the request to `/chat` and reading the streamed answer |
| `lib/shot.js` | keeping the screenshot small |
| `test/test.js` | tests for the parts that don't need a screen or a mic (`npm test`) |
