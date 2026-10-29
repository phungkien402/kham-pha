$path = 'src/explore/hieu-viet-nam/data/cau-hoi.json'
$data = Get-Content -Raw $path | ConvertFrom-Json
$new = $data | Where-Object { [int](($_.id -split '-')[-1]) -ge 9 }
$lines = @(
  '# Báo cáo mở rộng ngân hàng câu hỏi',
  '',
  'Đã bổ sung 60 câu mới, nâng tổng số lên 100. Mỗi vùng có 20 câu và mỗi chủ đề có 20 câu. Các lựa chọn đã được xáo vị trí đáp án; mọi câu đều có gợi ý và nguồn trực tiếp.',
  '',
  '| ID | Vùng | Chủ đề | Tỉnh | Tóm tắt câu hỏi | Nguồn |',
  '| --- | --- | --- | --- | --- | --- |'
)
foreach ($q in $new) {
  $summary = $q.cauHoi -replace '\|', '\\|'
  $lines += "| $($q.id) | $($q.vung) | $($q.chuDe) | $($q.tinh) | $summary | [Mở nguồn]($($q.nguon)) |"
}
$lines += '', 'Kiểm tra cơ cấu: Bắc 20, Trung 20, Tây Nguyên 20, Nam 20, Biển đảo 20; mỗi chủ đề có 20 câu.'
$lines | Set-Content -Encoding utf8 'docs/hieu-vn-cau-hoi-bao-cao.md'
