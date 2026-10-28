# Đặc tả: "Việt Nam to cỡ nào?" (/to-co-nao)

Chốt 2026-10-29 bởi Claude sau khi đọc góp ý của Antigravity (AGY_Y_KIEN.md, chép vào docs/to-co-nao-y-kien-agy.md). Kiên ngủ, giao Claude + agy tự quyết.

## Quyết định
- URL `/to-co-nao`, tiêu đề "Việt Nam to cỡ nào?", đăng ký trong src/data/pages.json trạng thái `live` (Kiên muốn deploy), thẻ trang chủ + OG riêng.
- Nhận góp ý agy: CÓ xoay hình; KHÔNG tự hút tâm — thay bằng 2 nút "Chồng tâm" và "Đặt cạnh nhau"; câu so sánh chỉ giữa 2 hình (hình đang chọn và hình chọn trước đó; mặc định 2 hình đầu); vòng hào quang cho hình quá nhỏ; tự cân khung khi thêm hình; thước tỉ lệ thích ứng; xuất ảnh PNG 1200×630; chip "Kèo kinh điển"; kích thước bao (dài × rộng theo trục chính, km).
- KHÔNG làm: ảnh OG riêng cho từng kèo (một OG chung); Phú Quốc/Tokyo (không có trong dữ liệu đơn vị hành chính). Kèo: "Lâm Đồng vs Bỉ" (mặc định), "Việt Nam vs Nhật Bản", "TP.HCM vs Singapore", "Hà Nội vs Luxembourg", "Việt Nam vs Ý", "Nghệ An vs Slovenia". Câu so sánh và diện tích LUÔN tính từ dữ liệu, không viết cứng con số.
- Tối đa 6 hình. Zoom 0.03×–30× so với mức vừa khung.

## Dữ liệu — scripts/build-size-data.mjs (giữ trong repo, chạy tay, commit kết quả)
- Nguồn tỉnh: `raw-data/Provinces.geojson` (Free-GIS-Data nguyenduy1133 Post-2025, tải nếu chưa có như scripts/build-map.mjs; áp CÙNG bản sửa lỗi tên Đồng Tháp/Lạng Sơn theo vĩ độ của build-map.mjs — tái dùng hàm, không chép tay). Việt Nam cả nước = hợp 34 tỉnh (mapshaper -dissolve), giữ Hoàng Sa, Trường Sa.
- Nguồn nước: `raw-data/ne_50m_admin_0_countries.geojson` (Natural Earth 1:50m, đã tải). Tên: `NAME_VI` (có đủ 242), cho phép bảng sửa tay `src/explore/to-co-nao/ten-nuoc.ts` ghi đè (vd chuẩn hoá "Séc", "Hàn Quốc", "Triều Tiên", "Bờ Biển Ngà"). Bỏ entity diện tích < 5 km² trừ các quốc gia có chủ quyền (giữ Monaco, Vatican…). BỎ entity VNM của Natural Earth (dùng Việt Nam từ dữ liệu tỉnh).
- Chủ quyền: với CHN, TWN, PHL, MYS, BRN (và mọi entity khác ngoài VN) xoá mọi polygon có tâm khung trong lng 109–119, lat 6–18 và diện tích < 2.000 km². Script ASSERT sau khi xử lý: không entity nào ngoài Việt Nam/tỉnh VN có polygon nào nằm trong vùng đó với diện tích < 2.000 km²; in danh sách polygon đã xoá.
- Giản lược mapshaper (visvalingam, giữ hình dạng; mục tiêu ≤ 400 điểm/hình, nước lớn ≤ 900), rồi với MỖI entity: centroid (d3.geoCentroid), chiếu `d3.geoAzimuthalEqualArea().rotate([-lng,-lat]).scale(R).translate([0,0])` với R = 6371.0088 → đơn vị km, trục y hướng nam (y dương xuống như SVG). Xuất path SVG (d), toạ độ làm tròn 0.5 km cho hình > 5.000 km², 0.1 km cho hình nhỏ hơn. Diện tích = d3.geoArea × R² trên hình GỐC (trước giản lược), km² làm tròn số nguyên. bbox (km), kích thước bao theo trục chính (PCA trên các đỉnh: dài, rộng, góc).
- Xuất `src/explore/to-co-nao/data/`: `meta.json` [{id, name, enName, type:'tinh'|'nuoc'|'vn', area, bbox, len, wid, chunk, q (chuỗi tìm không dấu: tên VI + EN + tên cũ của tỉnh nếu có)}], `default.json` (Lâm Đồng, Bỉ, Việt Nam), `vn.json` (34 tỉnh), `nuoc-pho-bien.json` (~50 nước: ASEAN, Đông Á, G20, châu Âu lớn, các nước trong kèo), `nuoc-khac.json`. id: tỉnh = slug không dấu ("lam-dong"), Việt Nam = "viet-nam", nước = ISO A3 thường ("bel"). Ghi `sources.json` (nguồn, ngày tải, giấy phép: Natural Earth public domain; Free-GIS-Data ghi theo README nguồn).
- Mục tiêu dung lượng gzip: meta ≤ 25 KB, default ≤ 15 KB, vn ≤ 70 KB, mỗi chunk nước ≤ 120 KB.
- Hàm thuần tách ra `scripts/size-data-lib.mjs` (centroid, project, pca, scsFilter, slugify) để test.

## Client — src/explore/to-co-nao/
- `math.ts` (thuần, test được): toạ độ km ↔ màn hình (viewport {cx, cy, scale px/km}), bbox các hình đã đặt (xét xoay), fitView(shapes, w, h, padding 12%), ratio(a,b) và câu so sánh tiếng Việt ("Lâm Đồng ≈ 0,8 lần Bỉ"; ≥ 10 lần làm tròn số nguyên; < 0,1 → "Bỉ ≈ 12 lần Lâm Đồng" đảo chiều cho dễ đọc), định dạng số kiểu Việt (dấu chấm nghìn, dấu phẩy thập phân), scaleBar(scale) chọn nấc 1/2/5×10ⁿ km dài 60–120 px, encode/decode URL `?h=id:x:y:goc,…&z=…` (x,y km làm tròn, góc độ nguyên; id lạ bị bỏ qua), chọn kèo ngẫu nhiên (1 tỉnh × 1 nước, diện tích chênh ≤ 3 lần).
- `dataLoader.ts`: nạp meta + default ngay (import tĩnh cho default, fetch cho chunk), cache promise theo chunk, prefetch `vn.json` khi idle.
- Svelte (Svelte 5 runes như code hiện có): `ToCoNao.svelte` (island `client:load`, state chung), `Board.svelte` (SVG toàn khung, `touch-action:none`, pan bằng kéo nền, zoom bằng bánh xe/chụm 2 ngón quanh con trỏ, thước tỉ lệ, nút +/−/vừa khung), `Shape.svelte` (`<g transform>` dịch+xoay, fill màu nhạt 35% + viền đậm 1.5px non-scaling, hình đang chọn viền dày + đổ bóng; khi kéo đặt pointer-events:none cho hình khác; tay nắm xoay tròn phía trên hình khi chọn trên máy tính; chụm 2 ngón trên hình = xoay + không zoom bàn; hào quang khi kích thước trên màn < 12px), `SearchBox.svelte` (combobox ARIA, tìm không dấu, Enter thêm, hiện diện tích trong gợi ý), `Footer.svelte`/thanh dưới (câu so sánh lớn, danh sách hình: chấm màu, tên, km², dài×rộng, nút xoá; nút Chồng tâm, Đặt cạnh nhau, Ngẫu nhiên, Chia sẻ link, Tải ảnh).
- Bàn phím: Tab tới từng hình; mũi tên dịch 10 km (Shift 50 km, theo tỉ lệ hiển thị hợp lý), `[` `]` xoay 15°, Delete xoá, C chồng tâm với hình chọn trước. Vùng `aria-live` đọc câu so sánh khi đổi.
- Màu 6 hình: bảng 6 màu phân biệt cả về độ sáng (kiểm tương phản viền với nền kem ≥ 3:1).
- Xuất ảnh: vẽ SVG hiện tại (chỉ các hình, khung vừa) + tiêu đề câu so sánh + chân trang URL lên canvas 1200×630 nền kem, chờ document.fonts.ready, tải `to-co-nao.png`; trên điện thoại có Web Share API với file thì chia sẻ, không thì tải.
- URL: replaceState mỗi khi thả hình/đổi (debounce 300ms). Mở link có ?h= → dựng lại đúng bàn.
- Mobile 375px: bàn chiếm ~60vh, thanh dưới cuộn được; không tràn ngang. prefers-reduced-motion: tắt chuyển động cân khung.
- Trang `src/pages/to-co-nao/index.astro` dùng layout chung như mua-hoa-viet (ExploreLayout hoặc tương đương), meta mô tả, ghi nguồn ranh giới + Natural Earth dưới trang, câu lưu ý "Diện tích tính từ ranh giới giản lược, có thể lệch vài phần trăm so với số liệu chính thức."

## Chia bước
- A: build-size-data.mjs + size-data-lib.mjs + ten-nuoc.ts + math.ts + dataLoader.ts (agy viết; Claude chạy script tạo dữ liệu vì agy không chạy lệnh). Test: hàm thuần.
- B: Board/Shape/SearchBox/ToCoNao + trang Astro + pages.json (bàn chơi được: thêm, kéo, xoay, zoom, bàn phím).
- C: Thanh dưới (so sánh, danh sách, Chồng tâm/Đặt cạnh/Ngẫu nhiên/kèo), URL, xuất ảnh, thẻ + OG, hoàn thiện mobile & Lighthouse.
Mỗi bước: agy code → Claude Code test theo spec → Claude kiểm tra → commit; deploy sau bước C (B có thể deploy với status draft nếu cần thử).
