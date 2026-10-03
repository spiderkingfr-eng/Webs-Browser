@echo off
rem Puts the Web AI server (worker.js) on Cloudflare. Needs Node.js (nodejs.org).
rem The first time, a browser window asks you to log in to Cloudflare and allow it.
cd /d "%~dp0"
where npx >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
echo Putting Web AI on Cloudflare...
call npx --yes wrangler@4 deploy
echo.
echo If it says "Deployed", you are done here. Next: add LIMITS and the two secrets in the Cloudflare dashboard.
pause
