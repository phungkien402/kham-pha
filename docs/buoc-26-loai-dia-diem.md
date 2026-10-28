# Bước 26: thêm loài hoa, địa điểm, link Google Maps check-in

Kiên chốt 2026-10-28:
- Cả **khách** và **admin** đều thêm được **loài hoa mới** và **địa điểm ngắm mới**. Của khách → chờ Kiên duyệt; của admin → duyệt luôn.
- Form loài: **đầy đủ trường như loài hiện có nhưng chỉ vài trường bắt buộc**.
- Link check-in: **dán link Google Maps**. Có link chung cho mỗi địa điểm, và link riêng (tuỳ chọn) cho từng ảnh khách tải lên.
- Duyệt xong → **web tự build lại (1–2 phút)**, trang loài mới vẫn là trang tĩnh (SEO).

## Dữ liệu (D1, migration mới `0003_*.sql`, không sửa 0001/0002)

`flowers_extra`: `slug TEXT PK, status ('pending'|'approved'|'rejected'), source ('admin'|'public'), data TEXT (JSON cùng shape với một phần tử flowers.json), submitter TEXT, ip_hash TEXT, created_at, reviewed_at`.

`places_extra`: `slug TEXT PK, status, source, data TEXT (JSON cùng shape places.json + maps_url), submitter, ip_hash, created_at, reviewed_at`.

`photos`: thêm cột `maps_url TEXT NULL` (link Google Maps riêng của ảnh).

Bắt buộc với loài (khách và admin): tên tiếng Việt, ít nhất 1 đợt nở (tháng/ngày bắt đầu, kết thúc; ngày đỉnh tuỳ chọn → mặc định giữa đợt), ít nhất 1 vùng (bắc/trung/nam), ít nhất 1 địa điểm (chọn có sẵn hoặc tạo mới ngay trong form). Mọi trường khác của flowers.json (tên khoa học, tên khác, màu, tóm tắt, mô tả, cách nhận ra, mẹo chụp, khoảnh khắc trong ngày…) có trong form nhưng **không bắt buộc**; thiếu thì trang loài ẩn mục đó. Màu thiếu → chọn tự động từ bảng màu có sẵn (khác các loài hiện có). Slug sinh từ tên (bỏ dấu), trùng thì thêm số.

Bắt buộc với địa điểm: tên, tỉnh (chọn trong 34 tỉnh mới), vùng; **link Google Maps** (tuỳ chọn nhưng khuyến khích). Toạ độ: Worker cố lấy từ link (theo dõi redirect của `maps.app.goo.gl`/`goo.gl/maps`, đọc mẫu `@lat,lng`, `!3dlat!4dlng`, `q=lat,lng`, `ll=`); lấy được thì chấm lên bản đồ, không lấy được thì admin nhập tay lat/lng khi duyệt (hoặc để trống → không chấm, vẫn hiện trong danh sách). Chỉ chấp nhận link host `google.com/maps`, `maps.google.*`, `maps.app.goo.gl`, `goo.gl/maps`.

## Build kết hợp

- API công khai `GET /api/du-lieu` → `{flowers:[...approved data], places:[...approved data]}` (no-cache).
- Lúc build (`content.config.ts` loader), đọc `flowers.json`/`places.json` **+** gọi `${SITE_URL}/api/du-lieu` rồi gộp (slug trùng thì JSON gốc thắng). Nếu gọi API lỗi khi build trên Cloudflare → **build thất bại** (giữ bản đang chạy, không mất loài đã duyệt). Khi build local không có mạng / biến `SKIP_REMOTE_DATA=1` → chỉ dùng JSON (in cảnh báo).
- Kích hoạt build: Worker gọi Cloudflare API trigger Workers Builds bằng secret `CF_BUILD_TOKEN` + vars `CF_ACCOUNT_ID`, `CF_BUILD_TRIGGER_ID` (tra endpoint chính xác trong tài liệu Workers Builds; nếu Workers Builds có "deploy hook" URL thì dùng secret `CF_DEPLOY_HOOK` thay). Tự gọi sau mỗi lần duyệt loài/địa điểm, gom lại (debounce): không gọi quá 1 lần mỗi 2 phút (lưu thời điểm gọi cuối trong D1). Admin có nút "Build lại web ngay". Thiếu secret → không lỗi, admin hiện cảnh báo "Chưa cấu hình build tự động".

## Trang và form

- `/them-hoa` (khách, noindex): form loài như trên + Turnstile + giới hạn 5 lần/ngày/IP (dùng chung ip_hash). Thông báo "Cảm ơn! Loài hoa sẽ hiện sau khi được duyệt."
- `/them-dia-diem` (khách, noindex): form địa điểm + chọn loài nở ở đó + Turnstile.
- Trang chính Mùa Hoa Việt và trang loài: link nhỏ "Thêm loài hoa" / "Thêm điểm ngắm".
- `/gui-anh` và form admin đăng ảnh: thêm ô "Link Google Maps chỗ chụp (tuỳ chọn)".
- `/admin`: thêm tab **Loài hoa** và **Địa điểm**: danh sách chờ duyệt (n), xem/sửa mọi trường (form dùng chung với trang khách), Duyệt / Từ chối, và nút "Thêm loài" / "Thêm địa điểm" (admin → approved luôn). Sửa được cả loài/địa điểm đã duyệt từ D1 (không sửa loài gốc trong JSON).
- Hiển thị: mỗi điểm ngắm (danh sách và hộp bấm chấm trên bản đồ) có nút "Mở Google Maps" nếu có link; ảnh có maps_url thì lưới/ lightbox có nút "Chỗ chụp trên Google Maps". Link mở tab mới, `rel="noopener noreferrer"`.

## Xong khi
Test: form thiếu trường bắt buộc → 400; khách không Turnstile → 400; quá hạn mức → 429; loài pending không có trong /api/du-lieu, approved thì có; link Maps host lạ → 400; trích toạ độ đúng cho các mẫu link; build local với SKIP_REMOTE_DATA=1 vẫn ra đủ 13 loài cũ; build với dữ liệu giả từ API ra thêm trang loài mới.

## Việc Kiên phải làm
Tạo Cloudflare API token quyền "Workers Builds: Edit" (hoặc deploy hook) và đặt secret; tra `CF_BUILD_TRIGGER_ID` trong Settings → Builds của Worker.
