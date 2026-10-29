# Trang mới /cach-bien — "Bạn đang cách biển bao xa?"
Kiên chốt 29/10 16:50: chỉ làm trang về Việt Nam, dữ liệu phải THẬT. Trang đầu tiên trong loạt ý tưởng ChatGPT (docs/y-tuong-moi-chatgpt.md #5).

## Dữ liệu (thật, có giấy phép)
- Đường bờ biển: Natural Earth 1:10m **coastline** (public domain) — https://www.naturalearthdata.com/downloads/10m-physical-vectors/ ; tải về raw-data/ (gitignored), cắt theo khung Việt Nam + biển lân cận (lng 102–118, lat 6–24), giữ đất liền VN + các đảo VN (Phú Quốc, Côn Đảo, Lý Sơn, Cát Bà, Bạch Long Vĩ…, Hoàng Sa, Trường Sa). Đánh dấu đoạn bờ thuộc đất liền vs đảo.
- Ranh giới VN + 34 tỉnh: dùng dữ liệu đã có của to-co-nao (raw-data/Provinces.geojson, nguồn Free-GIS-Data).
- Script `scripts/build-cach-bien.mjs` xuất `src/explore/cach-bien/data/bo-bien.json` (toạ độ lng/lat đã rút gọn, sai số ≤ 200 m) + `tinh.json` (34 tỉnh: tên, tâm, khoảng cách tâm tỉnh → biển, điểm xa biển nhất trong tỉnh tính trên lưới 2 km).
- Tính khoảng cách: điểm → đoạn thẳng gần nhất trên mặt cầu (haversine, R = 6371,0088 km), làm tròn 1 km.

## Trải nghiệm
- Màn đầu: bản đồ Việt Nam lớn, câu hỏi "Bạn đang cách biển bao xa?" + 2 nút: "Dùng vị trí của tôi" (geolocation, chỉ tính trên máy, không gửi đi) và "Chọn trên bản đồ".
- Chạm/kéo một điểm trên bản đồ: vẽ đường thẳng tới điểm bờ biển gần nhất, số km lớn đếm mượt, hướng la bàn ("về phía Đông Nam"), tên tỉnh đang đứng. Kéo điểm thì cập nhật tức thì.
- Công tắc "Tính cả đảo / Chỉ bờ đất liền".
- Bảng xếp hạng nhỏ (tính sẵn, thật): tỉnh có điểm xa biển nhất, các tỉnh không giáp biển, nơi xa biển nhất cả nước (toạ độ + km). Chạm để nhảy tới.
- Câu so sánh vui có thật: so với chiều ngang hẹp nhất của Việt Nam (tính được từ dữ liệu, không ghi số bịa).
- Thẻ chia sẻ PNG 1200×630: bản đồ + đường kẻ + "Tôi cách biển … km".
- Không có địa điểm của người dùng lưu lên server.

## Kỹ thuật
- Astro + Svelte 5, SVG (chiếu như to-co-nao), không thư viện mới. Trang /cach-bien, pages.json, thẻ trang chủ, OG.
- Test: haversine, khoảng cách điểm–đoạn (so với giá trị tính tay), ví dụ thật: Hà Nội (Hồ Gươm) → biển khoảng 100 km ±15; Đà Lạt; một điểm trên bờ = 0–2 km; dữ liệu tinh.json đủ 34 tỉnh.
