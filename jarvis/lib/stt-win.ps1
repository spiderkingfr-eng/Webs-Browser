# Jarvis for Webs - speech to text using Windows' own built-in recognition (System.Speech).
# No download, no account, no extra install - it uses the recognizer that ships with Windows.
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File stt-win.ps1 -Mode once|continuous
#   once:        listen for a single phrase, print it, exit.
#   continuous:  keep listening; print every phrase. Exit when this process is killed.
# Each recognised phrase is printed on its own line as:  TEXT:<the words>
# Problems are printed as:  ERR:<message>
param([string]$Mode = "once")

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

try {
  Add-Type -AssemblyName System.Speech
  $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $rec.SetInputToDefaultAudioDevice()
  $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
} catch {
  [Console]::Out.WriteLine("ERR:Windows speech recognition isn't available on this PC.")
  exit 1
}

if ($Mode -eq "continuous") {
  Register-ObjectEvent -InputObject $rec -EventName SpeechRecognized -Action {
    $t = $Event.SourceEventArgs.Result.Text
    if ($t) { [Console]::Out.WriteLine("TEXT:" + $t) }
  } | Out-Null
  $rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
  # stay alive until Jarvis stops us
  while ($true) { Start-Sleep -Milliseconds 400 }
}
else {
  $rec.InitialSilenceTimeout = [TimeSpan]::FromSeconds(7)
  $rec.BabbleTimeout = [TimeSpan]::FromSeconds(4)
  $rec.EndSilenceTimeout = [TimeSpan]::FromSeconds(1)
  try {
    $result = $rec.Recognize()
    if ($result -and $result.Text) { [Console]::Out.WriteLine("TEXT:" + $result.Text) } else { [Console]::Out.WriteLine("TEXT:") }
  } catch {
    [Console]::Out.WriteLine("ERR:Couldn't listen just now.")
  }
  $rec.Dispose()
}
