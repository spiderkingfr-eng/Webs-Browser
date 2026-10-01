# Webs Browser for Windows: how 3.0 was made

`../WebStudiosBrowser-3.0.zip` holds the finished browser. This folder holds what built it.

The browser's window, new tab page, Settings, sidebar, games and the script it runs inside web
pages (`shield.js`) are HTML and JavaScript files embedded in `WebStudiosBrowser.exe`. Webs 3.0
adds its 150 features to those files only, without changing a line of the program code, so the
exe could be updated without its C# source:

| Path | What it is |
| --- | --- |
| `orig/` | The files as they were in the 2.x exe |
| `src/` | The 3.0 additions, one or more files per page |
| `build.py` | Puts `src/` into `orig/` and writes the new pages to `out/`. Every insertion point must match exactly once, or it stops. |
| `repack.py` | Puts the files from `out/` back into an exe (`pip install pefile dnfile`) |
| `Check.cs` | Loads an exe with .NET or Mono and prints its embedded files and a hash of its code, to compare two builds |
| `tests/` | Browser tests (Playwright): the pages run with a fake Windows host, and the page tools run inside a test page |

How the additions hook in: functions in the original pages are wrapped (the original still runs
first), lists such as search engines, bangs, commands and widgets are extended, and new panels use
the pages' own helpers. Tools that work on web pages are `x-…` actions in `shield.js`, reached
through the host's existing `page-tool` command, which passes any action name through.

## Making the exe

```
python3 build.py
python3 repack.py WebStudiosBrowser-2.x.exe out WebStudiosBrowser.exe
```

`repack.py` keeps everything else in the exe byte for byte: a round trip with no changed files
gives an identical exe. For 3.0, `Check` showed the same 133 types and 648 method bodies (same code
hash) before and after, and every embedded file read back by the .NET runtime matched `out/`.

## Testing

```
npm install playwright
python3 build.py
node tests/t_chrome.js     # also t_side, t_ntp, t_games, t_shield, t_misc and t_examples
```

240 checks pass. The exe itself was not run on Windows here: the tests run the same pages in
Chromium, the engine WebView2 uses.
