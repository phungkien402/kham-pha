# Bước 33: tự động thu thập tin mùa hoa (Kiên chốt 2026-10-28: quét 3 lần/tuần)

## Cách chạy
- Một **scheduled task của Claude** (chạy trên cloud, T2/T4/T6 sáng sớm giờ VN) tìm tin trên web (báo, trang du lịch, mạng xã hội công khai) về hoa đang/sắp nở ở Việt Nam, so với dữ liệu hiện có (`GET /api/du-lieu` + flowers.json/places.json qua trang web), rồi gửi **đề xuất** vào Worker.
- Worker chỉ LƯU đề xuất, KHÔNG tự đăng. Kiên duyệt ở /admin.

## Worker
- Migration mới `0004_de_xuat.sql`: bảng `suggestions`:
  `id TEXT PK, kind TEXT ('new_flower'|'new_place'|'season_update'|'news'), target_slug TEXT NULL, payload TEXT (JSON), sources TEXT (JSON mảng {url,title,published}), summary TEXT, confidence REAL, status ('pending'|'applied'|'dismissed'), created_at, reviewed_at, dedupe_key TEXT UNIQUE`.
- `POST /api/bot/de-xuat` — xác thực `Authorization: Bearer <BOT_TOKEN>` (secret `BOT_TOKEN`, so sánh thời gian hằng); thiếu/sai → 401; chưa đặt secret → 503. Body JSON `{suggestions:[...]}` tối đa 30 mục/lần, mỗi mục ≤ 20 KB. Kiểm tra: `kind` hợp lệ; `sources` ≥ 1 URL http(s); `payload` đúng shape theo kind (new_flower: giống form thêm loài; new_place: giống form địa điểm, maps_url theo luật cũ; season_update: `{slug, year, start?, peak?, end?, note}`; news: `{slug?, place?, text}`). `dedupe_key` (vd `kind:slug:year` hoặc URL nguồn chính) trùng → bỏ qua, không lỗi. Trả `{inserted, skipped, errors:[...]}`.
- `GET /api/bot/tom-tat` (cùng Bearer): trả slug + tên + mùa của mọi loài/điểm hiện có và dedupe_key 60 ngày gần nhất — để scheduled task biết cái gì đã có, tránh đề xuất trùng.
- Route `/api/bot/*` KHÔNG qua Cloudflare Access (đặt ngoài /api/admin), nhưng có Bearer. Giới hạn 10 request/giờ (đếm trong D1).
- Admin (Access): `GET /api/admin/de-xuat?status=`, `POST /api/admin/de-xuat/<id>/apply` (áp dụng: new_flower → tạo loài approved như admin thêm; new_place → tạo địa điểm approved; season_update → ghi đè/ thêm đợt cho loài trong flowers_extra, hoặc với loài gốc JSON thì lưu vào bảng `season_overrides` (slug, year, start, peak, end, note) và build gộp vào như dữ liệu thêm; news → chỉ đánh dấu đã xem), `POST /api/admin/de-xuat/<id>/dismiss`. Áp dụng xong gọi build như duyệt loài.
- `/api/du-lieu` trả thêm `seasonOverrides` để build hiển thị "Năm nay: nở sớm/muộn hơn thường lệ" trên trang loài (dòng nhỏ dưới trạng thái mùa, có link nguồn).

## /admin
- Tab mới **"Đề xuất tự động (n)"**: thẻ từng đề xuất: loại, tóm tắt, độ tin cậy, các link nguồn (mở tab mới), dữ liệu đề xuất (sửa được trước khi áp dụng, dùng lại FlowerForm/PlaceForm), nút **Áp dụng** / **Bỏ qua**. Lọc theo loại.

## Xong khi
Test: Bearer sai/thiếu → 401; chưa có secret → 503; body sai shape → lỗi từng mục, mục đúng vẫn vào; trùng dedupe_key → skipped; quá 30 mục → 400; apply từng kind tạo đúng dữ liệu và gọi build; dismiss không đổi dữ liệu; route bot không cần Access, route admin vẫn cần.
