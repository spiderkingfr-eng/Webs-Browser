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
2. **Your Web AI server address** — the `…workers.dev` address you set up for the browser (it already
   does images and, with an ElevenLabs key, the voice). You paste it into Settings on first run.

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
- **Settings…**, **Show the bubble**, **Quit**.

## The wake word / talking to it

Turning your speech into text is done **on your PC by Windows itself** (its built-in speech recognition,
via `lib/stt-win.ps1`). There's nothing to download or install, and nothing about you leaves the PC.

- **Press the hotkey** (default **Alt+Shift+J**) and just speak your question.
- Or turn on the always-listening wake word: tray icon → tick **Listen for "Jarvis"** → then say
  *"Jarvis, how do I make a furnace?"* any time. A small **red ball** appears in the bottom-right corner so
  you can see it's listening; it glows amber while it's working on your question.

If Windows speech has never been used on your PC, Windows may ask to set it up the first time (Start →
Settings → Time & language → Speech). It's only Windows itself — not us. On non-Windows PCs there's no
built-in recogniser, so use the typed box.

The voice that reads answers aloud is **Adam**, through your server's `/speak` — it only works if your
server has an ElevenLabs key (the browser's `setup.cmd` asks for one).

## Settings (tray → Settings…)

- **Its name** — also the wake word ("Jarvis", "Friday", whatever you like).
- **What it calls you** — sir, boss, your name… (optional).
- **Style** — calm, short, friendly or detailed.
- **Server address** and **code** — your Web AI server.
- **Listen for the wake word**, **Read answers aloud**, **Let it see my screen**, **Show the bubble**.
- **Hotkey**, **Microphone**, **Start with Windows**.

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
| `worker.html/.js` | hidden: playing the spoken answer |
| `dot.html/.css/.js` | the little red "I'm listening" ball |
| `lib/config.js` | your settings, in one JSON file on this PC |
| `lib/wake.js` | hearing the wake word and pulling out the question |
| `lib/ai.js` | the request to `/chat` and reading the streamed answer |
| `lib/shot.js` | keeping the screenshot small |
| `test/test.js` | tests for the parts that don't need a screen or a mic (`npm test`) |
