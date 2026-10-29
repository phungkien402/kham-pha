# Đặc tả bước E4 — chốt sau thảo luận 3 bên
Nguồn: to-co-nao-e4-de-bai.md, ý kiến ChatGPT (to-co-nao-e4-y-kien-chatgpt.md), ý kiến agy (to-co-nao-e4-y-kien-agy.md). Claude chốt như sau.

## Không làm (đã loại)
- KHÔNG quay về 63 tỉnh: Việt Nam đã sáp nhập còn 34 tỉnh từ 2025, giữ 34 tỉnh (agy nhầm).
- KHÔNG thước cao độ, không quy đổi "ly cà phê/bài hát" (dễ thành bịa số). KHÔNG nút "Hiện đáp án" (fact hiện sẵn). KHÔNG thời tiết real-time. KHÔNG thêm animation mới; bỏ confetti, giữ pulse + crossfade.
- Không dùng các fact chưa chắc chắn (ví dụ "vi tảo chỉ có ở hồ Gươm", "Sơn Đoòng −150 m").

## 1. Cấu trúc thẻ địa danh mới (cả 32 điểm viết lại)
Thứ tự hiển thị: **câu móc** (1 câu hỏi/khẳng định gây tò mò, chữ lớn) → ẢNH LỚN → tên + chip tỉnh/loại → **2 câu ngắn** "mắt thấy tai nghe" → **Bạn có biết?** (1 sự thật chắc chắn, hiện sẵn) → dòng mờ **"Chặng kế: …"** (1 câu gợi chặng tiếp theo, không lộ tên nếu được, ví dụ "…nơi hàng nghìn đảo đá mọc giữa biển").
- Trường dữ liệu: hook, moTa (≤ 2 câu), fact, changKe. Viết tiếng Việt tự nhiên, sống động, không sáo rỗng ("tráng lệ, kỳ vĩ, thiêng liêng" hạn chế). Chỉ dùng kiến thức phổ thông chắc chắn; con số chỉ khi rất chắc (vd Fansipan 3.143 m, Hạ Long được UNESCO công nhận).
- Mẫu tham khảo đã duyệt: Mã Pì Lèng, Phong Nha, Mũi Cà Mau trong ý kiến ChatGPT; Cái Răng ("cây bẹo") trong ý kiến agy. Hồ Gươm: dùng fact chắc chắn khác (ví dụ Tháp Rùa giữa hồ, cầu Thê Húc dẫn vào đền Ngọc Sơn, truyền thuyết trả gươm cho Rùa Thần).

## 2. Dự đoán ở đầu → đáp án ở cuối
- Trước khi kéo, dưới câu hỏi lớn: "Bạn đoán Lũng Cú → Mũi Cà Mau, đường chim bay, khoảng bao xa?" 3 nút 1.000 / 1.650 / 2.500 km (thứ tự xáo cố định: 2.500, 1.000, 1.650). Chọn hoặc bỏ qua đều kéo được ngay. Lưu lựa chọn (localStorage, try/catch).
- Màn tổng kết: "Bạn đoán X km — thực tế khoảng 1.643 km đường chim bay" (+ đúng/gần đúng/lệch). Và "Hành trình 32 điểm dừng của bạn dài khoảng N km" — luôn phân biệt km dọc hành trình với đường chim bay.
- Tổng kết thêm "Nếu đi liền một mạch" ƯỚC TÍNH theo km dọc hành trình: xe máy 40 km/h, tàu 60 km/h, máy bay 800 km/h (ghi rõ "ước tính, chưa tính nghỉ").

## 3. Tem hành trình
- Điểm đã qua thành "tem" (chấm sáng có viền) trên bản đồ và chip; khi chạm điểm mới: pulse ngắn + navigator.vibrate(10) trên mobile nếu có (bọc try). Không khoá điểm.

## 4. Chọn thẻ theo chặng, có trễ
- Thẻ hiển thị = điểm dừng gần nhất theo km NHƯNG chỉ đổi khi vượt quá 15% độ dài đoạn kể từ trung điểm (hysteresis) — không nhảy qua lại khi kéo chậm. Hàm thuần có test.
- "Đang ở <tỉnh>" phải khớp tỉnh của thẻ khi đang đứng tại điểm (sửa lỗi ảnh chụp: thẻ Eo Gió nhưng "Đang ở Quảng Ngãi").

## 5. Bố cục & ảnh (theo ChatGPT mục C)
- Desktop: hai cột cùng cao calc(100svh − header); chỉ cột trái cuộn; ảnh `block-size: clamp(22rem, 40svh, 34rem)`, flex-shrink:0, object-fit:cover, object-position theo từng ảnh (trường cropPosition). Hook nằm trên ảnh.
- Mobile: bản đồ 38svh, thẻ dưới; ảnh 16:9 full-width; thanh trượt fixed đáy với safe-area và padding-bottom bằng chiều cao thật của thanh; không cuộn lồng.

## 6. Định vị đúng (sửa lỗi Lý Sơn, Mỹ Sơn…)
- Một module/script duy nhất xuất path Việt Nam, ranh tỉnh, điểm dừng, tâm nhãn bằng CÙNG phép chiếu (cùng tâm, scale, translate). Không còn hai công thức.
- Test: mỗi điểm dừng nằm trong polygon tỉnh kỳ vọng (d3 geoContains trên dữ liệu tỉnh gốc, hoặc point-in-polygon trên toạ độ đã chiếu); Lý Sơn nằm ngoài polygon đất liền và cách bờ > 15 km; với đảo, nếu dữ liệu tỉnh có đảo thì phải chứa.
- Kiểm tra lại toạ độ 32 điểm (Mỹ Sơn 15.764,108.124 là đúng, nằm phía tây nam Hội An; Lý Sơn 15.38,109.12 nằm ngoài khơi Quảng Ngãi).

## 7. Ảnh đúng địa danh
- Manifest `scripts/doc-vn-anh-manifest.json`: {id, commonsFile (tên file Commons cụ thể, chọn tay đúng địa danh), cropPosition}. Script tải theo manifest (không còn lấy ảnh đầu trang Wikipedia). Ảnh Eo Gió phải là ảnh Eo Gió; ảnh Hồ Thác Bà là hồ; v.v.
- Script sinh `docs/doc-vn-anh-contact.jpg` (lưới 32 ảnh nhỏ có số + tên) để Claude duyệt bằng mắt.
- Webp ≤ 960 px rộng, ≤ 180 KB, giấy phép CC BY/CC BY-SA/CC0/PD, ghi công đầy đủ (tác giả thật, không phải chú thích).

## 8. Test
Cập nhật test: nội dung đủ 4 trường cho 32 điểm, không rỗng, moTa ≤ 2 câu; hysteresis; dự đoán + tổng kết; ước tính thời gian; point-in-polygon; manifest ảnh khớp file. Tất cả test cũ vẫn qua.
