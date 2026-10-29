# Đặc tả bước E — "Bạn nghĩ Việt Nam dài đến mức nào?" (dọc Bắc → Nam)
Ý tưởng của Kiên (29/10). Thay màn mở đầu (IntroModal) của /to-co-nao bằng trải nghiệm này. Bảng so sánh hiện có giữ nguyên, nằm bên dưới, là "chế độ so sánh với nước khác".

## Bố cục
- Đầu trang /to-co-nao là section `DocVietNam.svelte` cao ~100svh (khi không có `?h=` / `?hanh-trinh=`; nếu có thì cuộn thẳng xuống bảng).
- Trái/giữa: bản đồ Việt Nam (dùng hình `viet-nam` đã có trong dữ liệu default; chiếu bằng cùng hệ toạ độ km). Vẽ tuyến hành trình (polyline qua các điểm dưới đây, chiếu bằng cùng phép chiếu LAEA tâm Việt Nam như dữ liệu — dùng lại hàm chiếu trong scripts/size-data-lib.mjs hoặc tính sẵn toạ độ km bằng script và lưu vào `src/explore/to-co-nao/data/doc-vn.json`). Một chấm "người đi" trên tuyến; phần đã đi tô đậm.
- Câu hỏi lớn ban đầu: "Bạn nghĩ Việt Nam dài đến mức nào?" + gợi ý "Kéo thanh trượt để đi từ cực Bắc xuống cực Nam".
- Thanh trượt DỌC bên phải trên desktop (đỉnh = Lũng Cú, đáy = Mũi Cà Mau); trên mobile (≤640px) thanh trượt NGANG ở đáy màn hình. Hỗ trợ: kéo, bàn phím (↑↓/←→ bước nhỏ, PageUp/PageDown nhảy điểm dừng), cuộn chuột trên bản đồ, chạm. input type=range có aria-label, aria-valuetext ("Đã đi 812 km, đang ở Huế").
- Bảng thông tin (card) cạnh bản đồ, cập nhật theo vị trí:
  1. Số km đã đi (lớn, đếm mượt) — tính dọc tuyến bằng haversine (R = 6371 km), làm tròn đến 1 km.
  2. Đang ở tỉnh nào (tên tỉnh mới, 34 tỉnh) + danh sách tỉnh đã đi qua (chip nhỏ).
  3. Vùng khí hậu/địa hình hiện tại (badge + 1 câu).
  4. Địa danh nổi bật tại điểm dừng gần nhất (tên + 1 câu).
  5. So sánh khoảng cách khi vượt mốc (toast/dòng nổi bật).
- Cuối hành trình (≥ 99%): màn tổng kết "Bạn vừa đi khoảng X km đường chim bay dọc tuyến — và Việt Nam chỗ hẹp nhất chỉ khoảng 50 km." + 2 nút: "So sánh Việt Nam với nước khác ↓" (cuộn xuống bảng, đặt sẵn VN + Nhật) và "Đi lại từ đầu".
- Hiện thêm đường thẳng Lũng Cú–Mũi Cà Mau (đứt nét) ở màn tổng kết, kèm số km đường thẳng (tự tính).
- `prefers-reduced-motion`: bỏ đếm mượt và animation.
- Bỏ IntroModal.svelte và logic `tcn-intro-seen` (xoá file + test liên quan). Nút "Hành trình" (tour 10 chặng) vẫn giữ trên bảng.

## Dữ liệu điểm dừng (toạ độ lat, lng — dùng đúng, KHÔNG bịa thêm số liệu)
| # | Điểm | Tỉnh (mới) | lat | lng | Địa danh / câu |
|1|Cột cờ Lũng Cú|Tuyên Quang|23.364|105.316|Điểm cực Bắc Việt Nam, trên cao nguyên đá Đồng Văn.|
|2|Hà Nội|Hà Nội|21.028|105.854|Thủ đô nghìn năm, giữa đồng bằng sông Hồng.|
|3|Tràng An|Ninh Bình|20.253|105.896|Quần thể danh thắng được UNESCO công nhận, núi đá vôi giữa đồng lúa.|
|4|Thanh Hoá|Thanh Hóa|19.807|105.776|Cửa ngõ Bắc Trung Bộ.|
|5|Vinh|Nghệ An|18.673|105.692|Thành phố bên sông Lam.|
|6|Phong Nha – Kẻ Bàng|Quảng Trị|17.590|106.283|Vùng hang động đá vôi nổi tiếng thế giới. Gần đây Việt Nam hẹp nhất, chỉ khoảng 50 km từ biển tới biên giới Lào.|
|7|Huế|Huế|16.463|107.590|Cố đô triều Nguyễn bên sông Hương.|
|8|Đèo Hải Vân|Đà Nẵng|16.193|108.130|Dãy Bạch Mã – Hải Vân là ranh giới khí hậu: phía Bắc có mùa đông lạnh, phía Nam ấm quanh năm.|
|9|Hội An|Đà Nẵng|15.880|108.335|Phố cổ được UNESCO công nhận.|
|10|Quy Nhơn|Gia Lai|13.782|109.219|Thành phố biển của Nam Trung Bộ.|
|11|Nha Trang|Khánh Hòa|12.238|109.196|Vịnh biển nổi tiếng.|
|12|Phan Thiết – Mũi Né|Lâm Đồng|10.933|108.102|Đồi cát đỏ, vùng khô hạn nhất Việt Nam nằm gần đây.|
|13|TP. Hồ Chí Minh|TP.HCM|10.776|106.700|Đô thị lớn nhất cả nước.|
|14|Cần Thơ|Cần Thơ|10.034|105.788|Trung tâm đồng bằng sông Cửu Long, chợ nổi.|
|15|Mũi Cà Mau|Cà Mau|8.600|104.720|Điểm cực Nam đất liền, rừng ngập mặn.|

Tỉnh đang ở: lấy theo điểm dừng gần nhất phía trước (đơn giản, không cần point-in-polygon); nếu dễ, dùng point-in-polygon với hình tỉnh trong vn.json thì tốt hơn và hiện cả tỉnh "đi ngang" giữa hai điểm.

## Vùng khí hậu/địa hình (theo đoạn)
- Điểm 1–2: "Miền núi phía Bắc → đồng bằng sông Hồng · khí hậu có mùa đông lạnh"
- Điểm 3–7: "Bắc Trung Bộ · dải đất hẹp kẹp giữa Trường Sơn và biển, hay có bão mùa thu"
- Điểm 8: "Ranh giới khí hậu Hải Vân"
- Điểm 9–12: "Duyên hải Nam Trung Bộ · nắng nhiều, bãi biển dài"
- Điểm 13–15: "Nam Bộ · nóng quanh năm, hai mùa mưa – khô; đồng bằng sông Cửu Long"
Mỗi vùng có màu badge riêng; nền trang chuyển nhẹ màu theo vùng (gradient mờ, contrast đủ AA).

## So sánh khoảng cách (hiện khi vượt mốc km đã đi, mỗi mốc 1 lần mỗi lượt)
Chỉ dùng đúng các mốc sau (khoảng cách đường chim bay, số tròn, luôn ghi "khoảng"):
  - 340 km: "khoảng bằng London → Paris"
  - 880 km: "khoảng bằng Paris → Berlin"
  - 1.070 km: "khoảng bằng Bắc Kinh → Thượng Hải"
  - 1.430 km: "khoảng bằng London → Rome"
  - Cuối: đường thẳng Lũng Cú–Mũi Cà Mau tự tính (≈ 1.650 km).
- Mốc so sánh là hằng số trong code kèm comment nguồn "khoảng cách đường chim bay, làm tròn".

## Kỹ thuật
- File: `DocVietNam.svelte`, `docVietNam.ts` (hàm thuần: haversine, cumulative distances, positionAt(t) → {km, lat, lng, segIndex}, nearestStop, regionAt, milestonesCrossed(prevKm, km)), `data/doc-vn.json` (stops + toạ độ km chiếu sẵn), script `scripts/build-doc-vn.mjs`.
- Svelte 5 runes, không thêm thư viện. Không vỡ `?h=`, `?hanh-trinh=` và test cũ. Lighthouse ≥ 90; không tràn ngang 375px; SVG nhẹ.
- Tiếng Việt có dấu; định dạng số kiểu Việt.
- Test vitest `step-e.test.ts`: haversine (Hà Nội–TP.HCM ≈ 1.140 km ±20), tổng tuyến tăng đơn điệu, positionAt(0)=Lũng Cú, positionAt(1)=Mũi Cà Mau, nearestStop, regionAt từng đoạn, milestonesCrossed không lặp và đúng thứ tự, đường thẳng Lũng Cú–Cà Mau trong 1.600–1.700 km.
