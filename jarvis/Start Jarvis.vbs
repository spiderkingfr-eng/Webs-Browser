' Jarvis for Webs - double-click this to start Jarvis (no black terminal window needed).
' The first time, it installs what Jarvis needs (npm install) - that window shows so you can see it working.
' To have Jarvis start by itself, tick Settings -> Start with Windows.
Option Explicit
Dim sh, fso, dir, r
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
If Not fso.FileExists(dir & "\node_modules\electron\dist\electron.exe") Then
  r = sh.Run("cmd /c echo Setting up Jarvis (first time only)... && npm install", 1, True)
  If r <> 0 Or Not fso.FileExists(dir & "\node_modules\electron\dist\electron.exe") Then
    MsgBox "Couldn't set Jarvis up. Is Node.js installed? (nodejs.org)", 16, "Jarvis"
    WScript.Quit 1
  End If
End If
sh.Run """" & dir & "\node_modules\electron\dist\electron.exe"" """ & dir & """", 0, False
