@echo off
rem Puts the Web AI server on Cloudflare and gives it your Claude API key and the Web AI codes.
rem Needs Node.js (nodejs.org). Run it again any time to update the code or change the key or codes.
setlocal
cd /d "%~dp0"
rem Node.js may be installed but not yet on the PATH of windows that were open before; look where it installs.
where npx >nul 2>nul || if exist "%ProgramFiles%\nodejs\npx.cmd" set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
where npx >nul 2>nul || if exist "%LOCALAPPDATA%\Programs\nodejs\npx.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"
where npx >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org, install it, and run this again. & pause & exit /b 1)
echo.
echo === Step 1 of 3: putting Web AI on Cloudflare ===
echo The first time, a browser tab asks you to log in to Cloudflare. Click Allow, then come back to this window.
echo.
call npx --yes wrangler@4 deploy
if errorlevel 1 goto failed
echo.
echo Web AI is on Cloudflare. Its address is the https://...workers.dev line above.
echo.
choice /c YN /m "Add (or change) your Claude API key now"
if errorlevel 2 goto codes
echo.
echo === Step 2 of 3: your Claude API key ===
echo Paste the key (Ctrl+V or right-click), then press Enter. It stays hidden while you paste.
call npx --yes wrangler@4 secret put ANTHROPIC_API_KEY
if errorlevel 1 goto failed
:codes
echo.
choice /c YN /m "Add (or change) the Web AI codes now"
if errorlevel 2 goto done
echo.
echo === Step 3 of 3: the Web AI codes ===
echo Paste the line of codes, like Me=abcd1234efgh,Sam=wxyz9876mnop - then press Enter.
call npx --yes wrangler@4 secret put WEB_AI_CODES
if errorlevel 1 goto failed
:done
echo.
echo All done. Open the workers.dev address from step 1 in a browser: it should say "ready":true
pause
exit /b 0
:failed
echo.
echo That did not work. Send a screenshot of the text above (never the key itself).
pause
exit /b 1
