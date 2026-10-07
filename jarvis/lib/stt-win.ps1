# Jarvis for Webs - speech to text using Windows' own built-in recognition (System.Speech).
# No download, no account, no extra install - it uses the recognizer that ships with Windows.
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File stt-win.ps1 -Mode once|continuous -Wake "jarvis,hey jarvis"
#   once:        listen for a single phrase (plain dictation), print it, exit.  (for the hotkey - no wake word needed)
#   continuous:  listen for the wake word followed by a question, print the whole thing, keep going.  (the "Jarvis…" mode)
# Giving the recogniser the wake word up front (a grammar) makes it catch the name far more reliably than plain
# dictation would. Each phrase is printed as:  TEXT:<the words>   Problems as:  ERR:<message>
param([string]$Mode = "once", [string]$Wake = "jarvis")

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

try {
  Add-Type -AssemblyName System.Speech
  $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $rec.SetInputToDefaultAudioDevice()
} catch {
  [Console]::Out.WriteLine("ERR:Windows speech recognition isn't available on this PC.")
  exit 1
}
# be a little more forgiving about how clearly things are said
try { $rec.UpdateRecognizerSetting("CFGConfidenceRejectionThreshold", 20) } catch {}

if ($Mode -eq "continuous") {
  # grammar: (one of the wake words) + anything you then say
  $choices = New-Object System.Speech.Recognition.Choices
  $added = 0
  foreach ($w in ($Wake -split ",")) { $t = $w.Trim(); if ($t) { $choices.Add($t); $added++ } }
  if ($added -eq 0) { $choices.Add("jarvis") }
  $gb = New-Object System.Speech.Recognition.GrammarBuilder
  $gb.Append($choices)
  $gb.AppendDictation()
  try { $rec.LoadGrammar((New-Object System.Speech.Recognition.Grammar $gb)) }
  catch { $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar)) }

  Register-ObjectEvent -InputObject $rec -EventName SpeechRecognized -Action {
    $t = $Event.SourceEventArgs.Result.Text
    if ($t) { [Console]::Out.WriteLine("TEXT:" + $t) }
  } | Out-Null
  $rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
  while ($true) { Start-Sleep -Milliseconds 400 }
}
else {
  $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
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
