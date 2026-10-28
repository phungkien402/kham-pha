# Chạy một bước theo quy trình: agy code (cửa sổ phải) -> đóng -> Claude Code test (cửa sổ phải) -> đóng.
# Dùng: powershell -File scripts\chay-buoc.ps1 -Buoc 28
param([Parameter(Mandatory)][int]$Buoc, [int]$PhutToiDa = 45)
Set-Location D:\Neal
$agyTask = ".agy-task-$Buoc.txt"; $ccTask = ".claude-test-$Buoc.md"
Remove-Item AGY_DONE.md, REVIEW.json -ErrorAction SilentlyContinue
function Cho($file, $phut) { $t = 0; while (-not (Test-Path $file) -and $t -lt $phut * 6) { Start-Sleep 10; $t++ }; Start-Sleep 3; return (Test-Path $file) }
& "$PSScriptRoot\mo-cua-so-phai.ps1" -TieuDe "Antigravity (agy) - buoc $Buoc" -Lenh "cd D:\Neal; agy --dangerously-skip-permissions --add-dir D:\Neal -i `"Lam theo file D:\Neal\$agyTask (doc file do truoc).`"" | Out-Null
$ok = Cho 'AGY_DONE.md' $PhutToiDa
& "$PSScriptRoot\dong-cua-so.ps1" | Out-Null
if (-not $ok) { "AGY_TIMEOUT"; return }
"AGY_OK"
& "$PSScriptRoot\mo-cua-so-phai.ps1" -TieuDe "Claude Code - test buoc $Buoc" -Lenh "`$env:CLAUDE_CONFIG_DIR=[Environment]::GetEnvironmentVariable('CLAUDE_CONFIG_DIR','User'); cd D:\Neal; claude `"Doc va lam theo file D:\Neal\$ccTask`" --allowedTools `"Read,Grep,Glob,Edit,Write,Bash(npx vitest:*)`"" | Out-Null
$ok = Cho 'REVIEW.json' 25
& "$PSScriptRoot\dong-cua-so.ps1" | Out-Null
if (-not $ok) { "CC_TIMEOUT"; return }
"CC_OK"
Get-Content REVIEW.json -Encoding utf8
