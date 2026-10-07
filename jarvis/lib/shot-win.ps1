# Jarvis for Webs - a reliable Windows screenshot (System.Drawing.CopyFromScreen).
# This is the classic Windows way to grab the screen; it works where Electron's own capture sometimes comes back blank.
# It captures the monitor your mouse is on, shrinks it to -MaxWidth, and prints the picture as base64 JPEG to stdout.
param([int]$MaxWidth = 1280, [int]$Quality = 70)
try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
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

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
  $eps = New-Object System.Drawing.Imaging.EncoderParameters 1
  $eps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
  $ms = New-Object System.IO.MemoryStream
  $out.Save($ms, $codec, $eps); $out.Dispose()
  [Console]::Out.Write([Convert]::ToBase64String($ms.ToArray()))
  $ms.Dispose()
} catch {
  [Console]::Error.WriteLine("shot failed: " + $_.Exception.Message)
  exit 1
}
