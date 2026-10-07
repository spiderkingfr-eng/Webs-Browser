# Jarvis for Webs - a reliable Windows screenshot (System.Drawing.CopyFromScreen).
# This is the classic Windows way to grab the screen; it works where Electron's own capture sometimes comes back blank.
# It captures the monitor your mouse is on, shrinks it to -MaxWidth, and gives the picture as base64 JPEG.
#   one go:   prints the base64 to stdout and exits.
#   -Serve:   stays open (so a picture takes a moment, not a whole PowerShell start-up): each line read from stdin
#             takes one picture and prints  SHOT:<base64>  (or  ERR:<message>) on one line.
param([int]$MaxWidth = 1280, [int]$Quality = 70, [switch]$Serve)

try { [Console]::OutputEncoding = [System.Text.Encoding]::ASCII } catch {}

# See the screen at its real size. With display scaling (125%, 150%...) Windows otherwise shows PowerShell a shrunken
# "pretend" screen, and the capture would only catch the top-left part of what you actually see.
try {
  Add-Type -Namespace JarvisShot -Name Dpi -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
'@
  $aware = $false
  try { $aware = [JarvisShot.Dpi]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch {}   # per-monitor (Windows 10 1703+)
  if (-not $aware) { try { [void][JarvisShot.Dpi]::SetProcessDPIAware() } catch {} }       # older Windows
} catch {}

try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
} catch {
  if ($Serve) { [Console]::Out.WriteLine("ERR:System.Drawing isn't available") } else { [Console]::Error.WriteLine("shot failed: System.Drawing isn't available") }
  exit 1
}
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1

function Take-Shot {
  $pos = [System.Windows.Forms.Cursor]::Position
  $scr = [System.Windows.Forms.Screen]::FromPoint($pos)
  $b = $scr.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $g.Dispose()

  $scale = [Math]::Min(1.0, $MaxWidth / [Math]::Max($b.Width, $b.Height))
  $w = [int]($b.Width * $scale); $h = [int]($b.Height * $scale)
  if ($w -lt 1) { $w = 1 }; if ($h -lt 1) { $h = 1 }
  $out = New-Object System.Drawing.Bitmap $w, $h
  $g2 = [System.Drawing.Graphics]::FromImage($out)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($bmp, 0, 0, $w, $h)
  $g2.Dispose(); $bmp.Dispose()

  $eps = New-Object System.Drawing.Imaging.EncoderParameters 1
  $eps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
  $ms = New-Object System.IO.MemoryStream
  $out.Save($ms, $codec, $eps); $out.Dispose()
  $b64 = [Convert]::ToBase64String($ms.ToArray())
  $ms.Dispose()
  return $b64
}

if ($Serve) {
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }          # the app closed - stop too
    try { [Console]::Out.WriteLine("SHOT:" + (Take-Shot)) }
    catch { [Console]::Out.WriteLine("ERR:" + $_.Exception.Message) }
    [Console]::Out.Flush()
  }
}
else {
  try { [Console]::Out.Write((Take-Shot)) }
  catch { [Console]::Error.WriteLine("shot failed: " + $_.Exception.Message); exit 1 }
}
