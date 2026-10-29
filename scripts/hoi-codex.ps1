# Gọi ChatGPT (Codex CLI) trong cửa sổ bên phải, chế độ chỉ đọc + được ghi 1 file kết quả.
# Dùng: powershell -File scripts\hoi-codex.ps1 -FilePrompt .codex-task-X.txt -FileKetQua docs\abc.md [-PhutToiDa 20]
param([Parameter(Mandatory)][string]$FilePrompt, [Parameter(Mandatory)][string]$FileKetQua, [int]$PhutToiDa = 20)
Set-Location D:\Neal
Remove-Item $FileKetQua -ErrorAction SilentlyContinue
$codex = "$env:LOCALAPPDATA\OpenAI\Codex\bin\e78bad9887fa50cf\codex.exe"
& "$PSScriptRoot\mo-cua-so-phai.ps1" -TieuDe "ChatGPT (Codex)" -Lenh "cd D:\Neal; Get-Content $FilePrompt -Raw -Encoding utf8 | & '$codex' --search exec --sandbox workspace-write -C D:\Neal -" | Out-Null
$t = 0; while (-not (Test-Path $FileKetQua) -and $t -lt $PhutToiDa * 6) { Start-Sleep 10; $t++ }
Start-Sleep 5
& "$PSScriptRoot\dong-cua-so.ps1" | Out-Null
if (Test-Path $FileKetQua) { "CODEX_OK" } else { "CODEX_TIMEOUT" }
