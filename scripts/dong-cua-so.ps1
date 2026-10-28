# Đóng cửa sổ CLI do scripts\mo-cua-so-phai.ps1 mở lần gần nhất (cả tiến trình con: agy / claude / vitest).
$f = Join-Path $env:TEMP 'kham-pha-cli-window.pid'
if (-not (Test-Path $f)) { 'khong co cua so nao'; return }
$id = (Get-Content $f | Select-Object -First 1).Trim()
taskkill /T /F /PID $id 2>&1 | Out-Null
Remove-Item $f -ErrorAction SilentlyContinue
"da dong cua so PID $id"
