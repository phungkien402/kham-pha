# Bước E3 — làm "Việt Nam dài đến mức nào?" sinh động hơn
Phản hồi của Kiên (29/10 10:14, kèm ảnh chụp): bố cục nhạt, chưa sinh động. Yêu cầu: thông tin bên TRÁI, bản đồ bên PHẢI; kéo đến đâu bản đồ zoom theo đến đó; nhiều địa điểm hơn; nội dung khám phá chi tiết hơn; có ảnh (lấy từ mạng); animation hợp lý; tránh quá yên tĩnh.

## 1. Bố cục desktop (≥ 1024px)
- Lưới 2 cột: TRÁI ~42% = "câu chuyện", PHẢI ~58% = bản đồ (sticky, cao 100svh − header), thanh trượt dọc sát mép phải bản đồ (giữ như hiện tại).
- Cột trái từ trên xuống:
  1. Dòng km lớn đếm mượt + thanh tiến độ + "Đang ở: <tỉnh>" (tỉnh đổi thì chữ trượt/fade).
  2. THẺ ĐỊA DANH (lớn, là nhân vật chính): ảnh 16:9 bo góc (chuyển ảnh bằng crossfade + ken-burns nhẹ), tên địa danh, chip tỉnh, chip loại (Thiên nhiên / Lịch sử / Ẩm thực / Biển / Núi…), đoạn mô tả 2–3 câu, 1 dòng "Bạn có biết?" (sự thật thú vị), dòng ghi công ảnh nhỏ (tác giả · giấy phép · link Wikimedia).
  3. Badge vùng khí hậu (như hiện có) + mốc so sánh khoảng cách (toast trượt vào, có hiệu ứng nảy nhẹ).
  4. Chip "Đã qua" 1 dòng cuộn ngang, tự cuộn tới chip mới nhất.
- Mobile (< 1024px): giữ bố cục mobile hiện tại nhưng thẻ địa danh có ảnh; bản đồ trên, thẻ dưới; thanh trượt dính đáy; thêm padding-bottom cho nội dung bằng chiều cao thanh trượt để không bị che.

## 2. Bản đồ zoom theo vị trí
- viewBox SVG nội suy mượt (lerp mỗi frame) về cửa sổ quanh điểm hiện tại: rộng ~450 km khi đang đi giữa hành trình; lúc 0% và ≥ 99% thì zoom ra toàn Việt Nam. Chuyển zoom không giật (damping), reduced-motion → nhảy thẳng.
- Thu nhỏ "bản đồ mini" toàn quốc ở góc dưới bản đồ, có khung chữ nhật cho vùng đang xem và chấm vị trí.
- Khi zoom vào: hiện ranh giới các tỉnh (từ vn.json) mờ, tô nhẹ tỉnh đang ở; hiện tên tỉnh lân cận nhỏ.
- Tuyến: đoạn đã đi vẽ đậm có hiệu ứng "đang vẽ" (stroke-dashoffset), đoạn chưa đi đứt nét. Các điểm dừng: chấm nhỏ; điểm đang ở phóng to + vòng pulse; điểm đã qua đổi màu.
- "Người đi": icon nhỏ (xe máy hoặc chấm có mũi tên) chạy dọc tuyến, xoay theo hướng đoạn đường, nhún nhẹ khi di chuyển.
- Bấm vào một điểm dừng trên bản đồ → thanh trượt tween tới điểm đó.
- Nền bản đồ: biển có sóng/hoa văn rất nhẹ (pattern tĩnh, không nặng), màu nền chuyển theo vùng khí hậu.

## 3. Nút "▶ Tự đi"
- Cạnh thanh trượt: nút tự chạy hành trình (~60 s cho cả tuyến, dừng ~1,5 s tại mỗi địa danh). Bấm lại = tạm dừng. Người dùng kéo tay → dừng tự chạy. Reduced-motion: nhảy từng điểm, không trượt.

## 4. Nhiều địa điểm hơn (≈ 32 điểm dừng)
Thay bảng 15 điểm bằng danh sách dưới đây (thứ tự Bắc → Nam). Mỗi điểm: id, tên, tỉnh mới (34 tỉnh), lat, lng, loại, mô tả (2–3 câu), "Bạn có biết?" (1 câu), wikiTitle (tiêu đề Wikipedia tiếng Việt để lấy ảnh). Viết mô tả/fact ở mức kiến thức phổ thông chắc chắn; KHÔNG nêu số liệu nếu không chắc (đặc biệt dân số, năm tháng không chắc → bỏ). Toạ độ dưới đây là chuẩn, dùng đúng.

| # | Tên | Tỉnh mới | lat | lng | loại | wikiTitle |
|1|Cột cờ Lũng Cú|Tuyên Quang|23.364|105.316|Lịch sử|Cột cờ Lũng Cú|
|2|Đèo Mã Pì Lèng|Tuyên Quang|23.239|105.410|Núi|Mã Pì Lèng|
|3|Ruộng bậc thang Hoàng Su Phì|Tuyên Quang|22.700|104.680|Núi|Hoàng Su Phì|
|4|Sa Pa – Fansipan|Lào Cai|22.336|103.844|Núi|Phan Xi Păng|
|5|Hồ Thác Bà|Lào Cai|21.850|105.000|Thiên nhiên|Hồ Thác Bà|
|6|Đền Hùng|Phú Thọ|21.367|105.323|Lịch sử|Đền Hùng|
|7|Hồ Hoàn Kiếm|Hà Nội|21.028|105.852|Lịch sử|Hồ Hoàn Kiếm|
|8|Văn Miếu – Quốc Tử Giám|Hà Nội|21.029|105.836|Lịch sử|Văn Miếu – Quốc Tử Giám|
|9|Vịnh Hạ Long|Quảng Ninh|20.910|107.184|Biển|Vịnh Hạ Long|
|10|Tràng An|Ninh Bình|20.253|105.896|Thiên nhiên|Quần thể danh thắng Tràng An|
|11|Thành nhà Hồ|Thanh Hóa|20.077|105.605|Lịch sử|Thành nhà Hồ|
|12|Biển Sầm Sơn|Thanh Hóa|19.734|105.905|Biển|Sầm Sơn|
|13|Làng Sen (quê Bác)|Nghệ An|18.701|105.535|Lịch sử|Kim Liên, Nam Đàn|
|14|Biển Thiên Cầm|Hà Tĩnh|18.243|106.120|Biển|Thiên Cầm|
|15|Phong Nha – Kẻ Bàng|Quảng Trị|17.590|106.283|Thiên nhiên|Vườn quốc gia Phong Nha – Kẻ Bàng|
|16|Cầu Hiền Lương – sông Bến Hải|Quảng Trị|17.003|107.050|Lịch sử|Cầu Hiền Lương|
|17|Đại Nội Huế|Huế|16.469|107.578|Lịch sử|Hoàng thành Huế|
|18|Đèo Hải Vân|Đà Nẵng|16.193|108.130|Núi|Đèo Hải Vân|
|19|Cầu Rồng – sông Hàn|Đà Nẵng|16.061|108.227|Thành phố|Cầu Rồng|
|20|Phố cổ Hội An|Đà Nẵng|15.880|108.335|Lịch sử|Hội An|
|21|Thánh địa Mỹ Sơn|Đà Nẵng|15.764|108.124|Lịch sử|Thánh địa Mỹ Sơn|
|22|Đảo Lý Sơn|Quảng Ngãi|15.380|109.120|Biển|Lý Sơn|
|23|Eo Gió – Quy Nhơn|Gia Lai|13.880|109.290|Biển|Quy Nhơn|
|24|Gành Đá Đĩa|Đắk Lắk|13.355|109.296|Thiên nhiên|Gành Đá Đĩa|
|25|Vịnh Nha Trang|Khánh Hòa|12.238|109.196|Biển|Vịnh Nha Trang|
|26|Đà Lạt – hồ Xuân Hương|Lâm Đồng|11.941|108.441|Núi|Đà Lạt|
|27|Đồi cát Mũi Né|Lâm Đồng|10.933|108.287|Thiên nhiên|Mũi Né|
|28|Bến Nhà Rồng – TP.HCM|TP.HCM|10.768|106.707|Thành phố|Bến Nhà Rồng|
|29|Địa đạo Củ Chi|TP.HCM|11.142|106.462|Lịch sử|Địa đạo Củ Chi|
|30|Chợ nổi Cái Răng|Cần Thơ|10.003|105.746|Ẩm thực|Chợ nổi Cái Răng|
|31|Rừng tràm Trà Sư|An Giang|10.583|105.058|Thiên nhiên|Rừng tràm Trà Sư|
|32|Mũi Cà Mau|Cà Mau|8.600|104.720|Thiên nhiên|Mũi Cà Mau|

Ghi chú tuyến: hành trình là đường đi qua các điểm theo thứ tự trên (có đoạn đi vòng như Sa Pa, Hạ Long, Củ Chi, Trà Sư là bình thường — tổng km sẽ lớn hơn; giữ cách gọi "km dọc hành trình", màn tổng kết nói rõ "đường thẳng Lũng Cú – Mũi Cà Mau khoảng X km" như cũ). Vùng khí hậu: xác định theo vĩ độ/điểm (Bắc: 1–9; Bắc Trung Bộ: 10–17; Hải Vân: 18; Nam Trung Bộ: 19–27; Nam Bộ: 28–32). Giữ đúng 4 mốc so sánh cũ 340/880/1.070/1.430 km, không thêm mốc.

## 5. Ảnh từ mạng (Wikimedia, có ghi công)
- Script `scripts/fetch-doc-vn-anh.mjs` chạy lúc dev (không chạy trong build Cloudflare): với mỗi wikiTitle gọi `https://vi.wikipedia.org/api/rest_v1/page/summary/<title>` lấy `originalimage`/`thumbnail`; nếu không có thử bản tiếng Anh. Lấy thông tin tác giả + giấy phép qua `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=960&titles=File:<tên>&format=json`. Chỉ nhận giấy phép CC BY / CC BY-SA / CC0 / Public domain.
- Tải ảnh về, chuyển webp 960px chiều rộng (sharp đã có? nếu chưa thì dùng ảnh thumb 960px của Commons, giữ jpg), lưu `public/doc-vn/<id>.webp|jpg`; ghi `src/explore/to-co-nao/data/doc-vn-anh.json`: {id: {src, w, h, tacGia, giayPhep, nguon}}. Commit ảnh vào repo (tổng ≤ 4 MB; ảnh nào > 180 KB thì nén thêm).
- Điểm không có ảnh hợp lệ → thẻ dùng hình minh hoạ gradient theo loại + icon (không vỡ layout).
- Ảnh: loading lazy, decoding async, có width/height; preload ảnh của điểm kế tiếp.
- Dòng ghi công bắt buộc hiện dưới ảnh.

## 6. Animation (sinh động nhưng không rối)
- Đổi địa danh: ảnh crossfade 400 ms + ken-burns chậm; tiêu đề trượt lên; chip loại pop.
- Km đếm mượt; vượt mốc: toast nảy + confetti nhỏ ở chặng cuối.
- Đổi vùng khí hậu: nền trang chuyển màu 600 ms; badge lật.
- Người đi nhún; điểm đang ở pulse.
- Toàn bộ tôn trọng prefers-reduced-motion.
- Hiệu năng: dùng transform/opacity; không re-render cả SVG mỗi frame (chỉ đổi viewBox + vị trí icon). Lighthouse ≥ 90.

## 7. Test
- Cập nhật test step-e/stepe.spec cho 32 điểm (thứ tự, toạ độ, tỉnh, vùng theo điểm), km tăng đơn điệu, positionAt 0/1, điểm cuối = Cà Mau, hàm tính cửa sổ zoom (0% và 100% = toàn quốc; giữa = ~450 km quanh điểm), tự đi (hàm thuần lập lịch dừng), doc-vn-anh.json: mọi ảnh có tacGia/giayPhep/nguon và giấy phép thuộc danh sách cho phép, file tồn tại.
