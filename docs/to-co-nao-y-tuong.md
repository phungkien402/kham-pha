# "Việt Nam to cỡ nào?" — bản ý tưởng của Claude (để Antigravity góp ý)

Kiên giao 2026-10-29 00:02: Claude + Antigravity cùng lên ý tưởng, thảo luận, lên kế hoạch, viết đặc tả, code, deploy. Kiên ngủ, sáng xem kết quả.

## Một câu
Kéo hình một tỉnh Việt Nam đặt chồng lên tỉnh khác hoặc lên một nước khác — cùng một tỉ lệ km thật — để thấy "Lâm Đồng mới to bằng Bỉ".

## Trải nghiệm (kiểu neal.fun: một màn, chơi ngay)
- Mở trang: một bàn kéo thả nền kem. Sẵn 2 hình: **Lâm Đồng** (sau sáp nhập) đặt cạnh **Bỉ**, chữ lớn: "Lâm Đồng ≈ 1,6 lần Bỉ" (số thật tính từ dữ liệu).
- Ô tìm "Thêm tỉnh hoặc nước…" (gõ không dấu cũng được) → thêm hình vào bàn, tối đa ~6 hình.
- Kéo bằng chuột/ngón tay; hình nào kéo gần hình khác thì "hút" tâm trùng nhau để so cho dễ (có thể tắt).
- Mỗi hình: màu riêng, tên + diện tích km², nút xoá. Thanh dưới: xếp hạng diện tích các hình đang có, câu so sánh tự sinh ("Hà Nội ≈ 0,11 lần Luxembourg… à không, 1,3 lần").
- Nút "Ngẫu nhiên" ghép một cặp bất ngờ (tỉnh VN × nước). Nút "Chia sẻ" → URL chứa danh sách hình + vị trí (vd `?h=lam-dong,BEL`), mở link là thấy đúng bàn đó; ảnh xem trước (og:image) mặc định.
- Thu phóng (cuộn / chụm 2 ngón) vì so Việt Nam với Nga thì cần thu nhỏ. Thước tỉ lệ "100 km" ở góc.
- Gợi ý có sẵn: "Việt Nam vs Nhật Bản", "Hà Nội vs Singapore", "TP.HCM vs Luxembourg", "Việt Nam vs Texas"? (Texas là bang — để sau).

## Toán / bản đồ
- Mỗi hình chiếu bằng phép chiếu **diện tích bằng nhau, đặt tâm tại chính hình đó** (Lambert azimuthal equal-area, rotate về centroid) rồi vẽ cùng một tỉ lệ px/km → kích thước so sánh đúng, hình gần như không méo; nước lớn (Nga, Canada) méo nhẹ nhưng diện tích vẫn đúng.
- Diện tích: d3.geoArea × R² (R = 6371,0088 km), hiển thị làm tròn 3 chữ số có nghĩa; ghi chú "diện tích tính từ ranh giới giản lược, sai lệch vài %".
- Tính trước lúc build: path SVG chuẩn hoá (đơn vị km, tâm 0,0) cho mọi hình → client chỉ dịch/zoom, không cần d3 trên trình duyệt.

## Dữ liệu
- 34 tỉnh: cùng nguồn Free-GIS-Data (nguyenduy1133) Post-2025 Provinces.geojson đang dùng cho bản đồ hoa (scripts/build-map.mjs đã tải/sửa lỗi Đồng Tháp). Việt Nam cả nước = gộp 34 tỉnh, CÓ Hoàng Sa, Trường Sa.
- Các nước: Natural Earth admin 0 (1:50m), giản lược mapshaper. Tên tiếng Việt cho ~200 nước (bảng tay hoặc dữ liệu `NAME_VI` của Natural Earth nếu có).
- **Chủ quyền**: bỏ khỏi hình Trung Quốc, Đài Loan, Philippines, Malaysia, Brunei mọi đảo nhỏ nằm trong vùng Hoàng Sa/Trường Sa (khung lng 109.5–118, lat 6–17.5, diện tích < 2.000 km²). Hoàng Sa, Trường Sa chỉ thuộc hình Việt Nam (và Đà Nẵng / Khánh Hoà nếu tỉnh chứa chúng trong nguồn). Ghi nguồn ranh giới dưới trang.
- Dung lượng mục tiêu: dữ liệu ≤ 400 KB gzip, tải lười (chỉ tải danh sách tên + 2 hình mặc định trước; hình khác tải khi chọn, theo từng nhóm hoặc từng file).

## Câu hỏi để Antigravity góp ý
1. Trải nghiệm có gì thừa/thiếu? Có nên cho xoay hình?
2. Tỉ lệ & thu phóng trên điện thoại 375px với hình lớn/nhỏ chênh nhau 10.000 lần (Nga vs Hà Nội)?
3. Cách chia file dữ liệu và kích thước?
4. Cấu trúc code: trang mới `src/pages/viet-nam-to-co-nao/` + `src/explore/to-co-nao/`, Svelte island một khối? Kéo thả bằng Pointer Events không thư viện?
5. Trợ năng: kéo thả cần phương án bàn phím (chọn hình, mũi tên để dịch).
