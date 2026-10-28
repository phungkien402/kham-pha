# Bước 28–32: hoàn thiện Mùa Hoa Việt (Kiên giao 2026-10-28, tự làm không cần hỏi)

Quyết định Claude tự chốt (Kiên bận, nhờ tự làm):
- "Nhắc mùa hoa" làm bằng file lịch .ics (Google/Apple/Outlook đều mở được), KHÔNG dùng email/push — không cần dịch vụ gửi thư, không lưu email người dùng.
- Mọi thứ giữ phong cách hiện có (Be Vietnam Pro, nền kem, thẻ bo tròn, Postcard.svelte). Không thêm thư viện nặng. Lighthouse trang chính và trang loài vẫn ≥ 90.
- Mỗi bước commit riêng.

## 28. "Hôm nay đi đâu?"
- Trang chính, ngay dưới bánh xe/khối "Đang nở": khối nhỏ "Hôm nay đi đâu?" với nút "Dùng vị trí của tôi" (navigator.geolocation, chỉ khi bấm) và ô chọn tỉnh (34 tỉnh, provinces.ts) cho ai không muốn chia sẻ vị trí. Toạ độ tỉnh = tâm (centroid) tính lúc build từ src/explore/mua-hoa-viet/map/vietnam.json hoặc bảng toạ độ tỉnh lỵ — ghi rõ nguồn.
- Kết quả: tối đa 3 điểm ngắm GẦN NHẤT có ít nhất 1 loài đang nở/sắp tàn/đỉnh mùa HÔM NAY (dùng season.ts), mỗi dòng: tên điểm, tỉnh, loài (chấm màu), khoảng cách "~120 km" (haversine, làm tròn), nút "Mở Google Maps" nếu có maps_url, link sang trang loài. Không có điểm nào → câu thân thiện + Postcard "Ghim lên bản đồ".
- Vị trí KHÔNG gửi lên máy chủ, không lưu (có thể nhớ tỉnh đã chọn trong localStorage, bọc try/catch). Từ chối quyền vị trí → hiện ô chọn tỉnh, không báo lỗi đỏ.
- Hàm thuần tách riêng (nearestBlooming(places, flowers, lat, lng, date, n)) để test.

## 29. Nhắc mùa hoa (.ics)
- Trang loài: nút "Nhắc tôi mùa sau" cạnh khối trạng thái mùa. Bấm → tải file `<slug>.ics` gồm sự kiện cả ngày cho MỖI đợt nở của năm tới gần nhất chưa qua (nếu đợt năm nay đã hết thì năm sau): "Sắp tới mùa <tên hoa>" vào 7 ngày trước ngày bắt đầu, và "<tên hoa> vào đỉnh mùa" vào ngày đỉnh; mô tả có link trang loài; VALARM nhắc 1 ngày trước. Thêm RRULE:FREQ=YEARLY để năm nào cũng nhắc.
- File .ics tạo phía trình duyệt (Blob), chuẩn RFC 5545: CRLF, UID ổn định `<slug>-<đợt>-<loại>@kham-pha`, DTSTAMP, escape dấu phẩy/chấm phẩy, gập dòng > 75 octet, UTF-8.
- Trang chính: trong danh sách "Sắp nở tháng …" mỗi dòng có icon chuông nhỏ làm việc tương tự.
- Hàm thuần buildIcs(flower, today) để test.

## 30. Poster lịch hoa 12 tháng
- Trang chính, dưới bánh xe: nút "Tải lịch hoa cả năm". Mở hộp chọn: khổ Dọc điện thoại (1080×1920) / Ngang máy tính (1920×1080) / In A4 (2480×3508), chọn miền (Cả nước/Bắc/Trung/Nam).
- Poster: tiêu đề "Lịch mùa hoa Việt 2026–2027" (năm theo hôm nay), 12 cột/hàng tháng, mỗi loài một thanh màu theo đợt nở (giống bánh xe nhưng dạng dải), tên loài, chú thích nhỏ đỉnh mùa; chân trang tên web + URL. Vẽ bằng SVG rồi xuất PNG qua canvas (font Be Vietnam Pro đã nạp; chờ document.fonts.ready). Tải về `lich-hoa-<mien>-<kho>.png`.
- Không gọi máy chủ. Hàm thuần dựng dữ liệu poster (posterRows(flowers, region, year)) để test.

## 31. Ảnh theo năm
- Mục "Ảnh" trang loài: nếu ảnh thuộc ≥ 2 năm khác nhau (năm theo taken_on, thiếu thì created_at), hiện thanh chip "Tất cả · 2026 · 2025 …" lọc lưới ảnh và lightbox; dưới mỗi ảnh ghi "Chụp 17/10/2026" khi có taken_on. Chỉ 1 năm → không hiện thanh chip.
- Nếu có ảnh của ≥ 2 năm: thêm một dòng nhỏ "Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10" (ngày chụp sớm nhất mỗi năm) — gợi ý hoa nở sớm/muộn.
- Hàm thuần groupByYear(photos) để test.

## 32. Bản đồ "đang nở" theo ảnh trong tuần
- Worker: GET /api/anh/tuan → {"places": {"<place-slug>": n}, "flowers": {"<flower-slug>": n}} đếm ảnh approved có created_at (hoặc taken_on) trong 7 ngày gần nhất; Cache-Control: public, max-age=300.
- Bản đồ (trang chính và trang loài): chấm của điểm có n > 0 có vòng sáng nhấp nháy nhẹ (tắt khi prefers-reduced-motion) và nhãn nhỏ "n ảnh tuần này" trong hộp bấm chấm; danh sách điểm cạnh bản đồ hiện "📷 n" (dùng icon SVG, không emoji). Thẻ loài trang chính: nhãn "Mới có ảnh" nếu flowers[slug] > 0.
- Gọi API 1 lần mỗi trang (cache promise như fetchPublicPhotos). Lỗi → không hiện gì thêm.

## Xong khi (chung)
Test cho các hàm thuần + route mới; build sạch; không tràn ngang ở 375px; Lighthouse ≥ 90 trang chính và trang loài.
