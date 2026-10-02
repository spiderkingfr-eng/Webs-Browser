# Installs Web Studios Browser for this Windows account.
#
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# Copies dist\WebStudiosBrowser.exe to %LOCALAPPDATA%\Programs\Webs Browser\,
# registers it with Windows as a browser (per user, no admin needed), adds
# "Webs Browser" to the Start menu so Windows search finds it, and opens the
# Settings page where you press "Set default". Run it again after a rebuild to
# update the installed copy. Your profile (history, bookmarks...) lives in
# %LOCALAPPDATA%\WebStudiosBrowser and is not touched.
#
# To undo: "%LOCALAPPDATA%\Programs\Webs Browser\WebStudiosBrowser.exe" --unregister

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# From the source folder the exe is in dist\; from the download zip it sits beside this script.
$src  = Join-Path $root "dist\WebStudiosBrowser.exe"
if (-not (Test-Path $src)) { $src = Join-Path $root "WebStudiosBrowser.exe" }
if (-not (Test-Path $src)) { throw "WebStudiosBrowser.exe is missing (build first, or unzip everything together)." }

$dir = Join-Path $env:LOCALAPPDATA "Programs\Webs Browser"
$exe = Join-Path $dir "WebStudiosBrowser.exe"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# Old copies set aside by earlier updates go once nothing runs from them.
Get-ChildItem $dir -Filter "WebStudiosBrowser.old-*.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { try { Remove-Item $_.FullName -Force -ErrorAction Stop } catch { } }

# A running copy cannot be overwritten, but it can be renamed: it keeps running
# from the new name, and the next start uses the update. Nothing is closed.
$running = Get-Process -Name WebStudiosBrowser -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
if ($running -and (Test-Path $exe)) {
    $aside = Join-Path $dir ("WebStudiosBrowser.old-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".exe")
    Rename-Item $exe $aside
    Write-Host "  Webs Browser is open - the update takes over the next time you start it."
}

Copy-Item $src $exe -Force
Write-Host "  installed  $exe"

$p = Start-Process -FilePath $exe -ArgumentList "--register" -PassThru -Wait
Write-Host "  registered with Windows as 'Webs Browser'"
Write-Host "  Start menu: Webs Browser (type 'Webs Browser' in Windows search)"

if ($args -notcontains "-quiet") {
    Start-Process "ms-settings:defaultapps?registeredAppUser=WebsBrowser"
    Write-Host "  Settings is open - press 'Set default' at the top to make it your default browser."
}
