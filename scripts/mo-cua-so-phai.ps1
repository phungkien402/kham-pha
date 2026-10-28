# Mở một PowerShell chạy lệnh $Lenh, đặt cửa sổ đó ở nửa phải màn hình, đưa Claude desktop sang nửa trái.
param([Parameter(Mandatory)][string]$Lenh, [string]$TieuDe = 'CLI')
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int ht,bool r);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
"@
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$half = [int]($wa.Width / 2)
$full = "`$host.UI.RawUI.WindowTitle = '$TieuDe'; $Lenh"
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($full))
$p = Start-Process powershell -ArgumentList '-NoExit','-EncodedCommand',$enc -PassThru
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 50 -and $h -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 200
  # Windows Terminal có thể là host: tìm theo tiêu đề nếu process không có cửa sổ riêng
  $p.Refresh(); $h = $p.MainWindowHandle
  if ($h -eq [IntPtr]::Zero) { $w = Get-Process | Where-Object { $_.MainWindowTitle -eq $TieuDe } | Select-Object -First 1; if ($w) { $h = $w.MainWindowHandle } }
}
if ($h -ne [IntPtr]::Zero) { [W]::ShowWindow($h, 9) | Out-Null; [W]::MoveWindow($h, $wa.X + $half, $wa.Y, $wa.Width - $half, $wa.Height, $true) | Out-Null }
$c = Get-Process -Name 'Claude' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if ($c) { [W]::ShowWindow($c.MainWindowHandle, 9) | Out-Null; [W]::MoveWindow($c.MainWindowHandle, $wa.X, $wa.Y, $half, $wa.Height, $true) | Out-Null }
"cua so: $h ; claude: $($c.MainWindowHandle)"
