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
  # use an English recogniser if one is installed (better than whatever the default happens to be)
  $ri = $null
  try { $ri = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.Name -like "en*" } | Select-Object -First 1 } catch {}
  if ($ri) { $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine $ri.Id }
  else { $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine }
  $rec.SetInputToDefaultAudioDevice()
  $rec.MaxAlternates = 3
} catch {
  [Console]::Out.WriteLine("ERR:Windows speech recognition isn't available on this PC.")
  exit 1
}
# how sure it has to be before it counts something as what you said (higher = fewer made-up words from noise)
$MinConf = 0.30
try { $rec.UpdateRecognizerSetting("CFGConfidenceRejectionThreshold", 30) } catch {}

if ($Mode -eq "wake") {
  # just spot the wake word and say so - the question is heard by Whisper instead (far more accurate)
  $choices = New-Object System.Speech.Recognition.Choices
  $added = 0
  foreach ($w in ($Wake -split ",")) { $t = $w.Trim(); if ($t) { $choices.Add($t); $added++ } }
  if ($added -eq 0) { $choices.Add("jarvis") }
  $wakeGb = New-Object System.Speech.Recognition.GrammarBuilder
  $wakeGb.Append($choices)
  $rec.LoadGrammar((New-Object System.Speech.Recognition.Grammar $wakeGb))
  $rec.InitialSilenceTimeout = [TimeSpan]::FromHours(24)
  $rec.BabbleTimeout = [TimeSpan]::FromHours(24)
  $rec.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(250)
  while ($true) {
    $w = $null
    try { $w = $rec.Recognize() } catch { Start-Sleep -Milliseconds 300; continue }
    if ($w) { [Console]::Out.WriteLine("WAKE") } else { Start-Sleep -Milliseconds 80 }
  }
}
elseif ($Mode -eq "continuous") {
  # Two stages, in one process (so there's no gap where it stops hearing you):
  #   A) wait for the wake word only - a grammar of just the name, so it fires fast and reliably.
  #   B) then open a fresh listening window: wait up to ~3.5s for you to start, and once you do, keep
  #      going until you've been quiet for ~1.5s. So "Jarvis" <pause> "how do I make a furnace" works.
  $choices = New-Object System.Speech.Recognition.Choices
  $added = 0
  foreach ($w in ($Wake -split ",")) { $t = $w.Trim(); if ($t) { $choices.Add($t); $added++ } }
  if ($added -eq 0) { $choices.Add("jarvis") }
  $wakeGb = New-Object System.Speech.Recognition.GrammarBuilder
  $wakeGb.Append($choices)
  $wakeGrammar = New-Object System.Speech.Recognition.Grammar $wakeGb
  $dictation = New-Object System.Speech.Recognition.DictationGrammar

  while ($true) {
    # --- A) listen for the wake word (wait as long as it takes) ---
    try { $rec.UnloadAllGrammars() } catch {}
    $rec.LoadGrammar($wakeGrammar)
    $rec.InitialSilenceTimeout = [TimeSpan]::FromHours(24)
    $rec.BabbleTimeout = [TimeSpan]::FromHours(24)
    $rec.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(250)
    $w = $null
    try { $w = $rec.Recognize() } catch { Start-Sleep -Milliseconds 300; continue }
    if (-not $w) { Start-Sleep -Milliseconds 80; continue }
    [Console]::Out.WriteLine("WAKE")

    # --- B) now capture the question, with a generous window ---
    try { $rec.UnloadAllGrammars() } catch {}
    $rec.LoadGrammar($dictation)
    $rec.InitialSilenceTimeout = [TimeSpan]::FromSeconds(3.5)   # at least ~3s to start speaking
    $rec.BabbleTimeout = [TimeSpan]::FromSeconds(3)
    $rec.EndSilenceTimeout = [TimeSpan]::FromSeconds(1.5)       # keep going until ~1.5s of quiet
    $q = $null
    try { $q = $rec.Recognize() } catch {}
    # only accept it if it heard you clearly enough - otherwise it's probably background noise, so ignore it
    if ($q -and $q.Text -and $q.Confidence -ge $MinConf) { [Console]::Out.WriteLine("TEXT:" + $q.Text) }
    else { [Console]::Out.WriteLine("NONE") }
  }
}
else {
  $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $rec.InitialSilenceTimeout = [TimeSpan]::FromSeconds(7)
  $rec.BabbleTimeout = [TimeSpan]::FromSeconds(4)
  $rec.EndSilenceTimeout = [TimeSpan]::FromSeconds(1)
  try {
    $result = $rec.Recognize()
    if ($result -and $result.Text -and $result.Confidence -ge 0.20) { [Console]::Out.WriteLine("TEXT:" + $result.Text) } else { [Console]::Out.WriteLine("TEXT:") }
  } catch {
    [Console]::Out.WriteLine("ERR:Couldn't listen just now.")
  }
  $rec.Dispose()
}
