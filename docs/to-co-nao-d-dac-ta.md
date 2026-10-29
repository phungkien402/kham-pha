# Đặc tả bước D — /to-co-nao: Màn mở đầu, Hành trình, Fun fact, Bạn có biết?
Chốt sau khi Claude (to-co-nao-d-y-tuong.md) và agy (to-co-nao-d-y-kien-agy.md) trao đổi.
Ghi chú: Đà Nẵng 11.609 km² là Đà Nẵng mới (gộp Quảng Nam), không phải do Hoàng Sa — nhưng vẫn bỏ chặng này cho gọn.

## D1. Màn mở đầu (không che kín)
- Điều kiện hiện: URL không có `?h=` và không có `?hanh-trinh=`, và localStorage `tcn-intro-seen` chưa có (mọi truy cập localStorage bọc try/catch; lỗi → coi như chưa thấy).
- Bảng phía sau render sẵn chặng 1 (sgp + tp-ho-chi-minh), lớp phủ mờ nhẹ (backdrop-filter blur 3px, nền bán trong suốt).
- Card giữa: tiêu đề lớn "Việt Nam thật ra to cỡ nào?", dòng phụ "Ví dụ: TP.HCM rộng gấp 9 lần Singapore. Còn nhiều điều bất ngờ hơn thế.", nút chính "Bắt đầu hành trình →" (10 chặng · ~2 phút), nút phụ "Tự khám phá".
- Bấm bất kỳ nút nào → set `tcn-intro-seen=1`. "Tự khám phá" → bảng mặc định như hiện tại (headline Lâm Đồng vs Bỉ).
- Phím Esc = Tự khám phá. Card có role="dialog", aria-labelledby, focus vào nút chính.

## D2. Chế độ Hành trình (kiểu The Size of Life)
File: `tourData.ts` (dữ liệu + hàm thuần), `TourCard.svelte` (UI), `viewportAnimation.ts` (tween).
Chặng (id trong meta.json; [nhỏ, lớn] theo thứ tự xuất hiện):
1. sgp → tp-ho-chi-minh
2. lux → ha-noi
3. kwt → nghe-an
4. bel → lam-dong
5. kor → viet-nam
6. fin → viet-nam   (điểm nhấn: "gần như bằng nhau tuyệt đối")
7. jpn → viet-nam
8. fra → viet-nam
9. chn → viet-nam
10. rus → viet-nam
Mỗi chặng có `cau` (1 câu twist viết tay, tiếng Việt, chỉ nói điều chắc chắn: diện tích/dài/rộng lấy từ meta, kiến thức phổ thông). Con số "GẤP n LẦN" và dòng diện tích luôn TỰ TÍNH từ meta, không viết tay.
Câu gợi ý (agy có thể chỉnh văn nhưng không thêm số liệu ngoài meta):
1 "Cả một quốc đảo giàu có đặt gọn trong một góc TP.HCM."
2 "Thủ đô Việt Nam rộng hơn cả một đại công quốc châu Âu."
3 "Nghệ An và Kuwait gần như cùng cỡ."
4 "Tỉnh lớn nhất Việt Nam gần bằng cả nước Bỉ."
5 "Nhiều người nghĩ Hàn Quốc rộng lớn — thật ra Việt Nam rộng gấp hơn 3 lần."
6 "Phần Lan và Việt Nam: chênh nhau chưa tới 50 km²."
7 "Nhật Bản rộng hơn một chút, và cũng trải dài như Việt Nam."
8 "Pháp — nước lớn nhất Tây Âu — gần gấp đôi Việt Nam."
9 "Trung Quốc chứa được khoảng 28 Việt Nam."
10 "Nước lớn nhất thế giới: khoảng 51 Việt Nam. Giờ đến lượt bạn."

Hành vi:
- Vào tour: thay các hình trên bảng bằng 2 hình của chặng; hình [nhỏ] của chặng giữ lại hình "lớn" của chặng trước làm mốc mờ (opacity 0.25, không kéo được, không tính vào thanh so sánh). Prefetch mọi chunk cần cho tour ngay khi vào.
- Chuyển chặng 2 nhịp: hình mới xuất hiện (fade/scale-in 250 ms), rồi viewport tween ~600 ms (rAF, ease-in-out) để vừa các hình. Khoá kéo/zoom trong lúc tween. `prefers-reduced-motion` → nhảy thẳng.
- Card đáy (TourCard): thanh tiến độ "3/10", nút ← →, "Thoát ×". Nhịp chữ 3 tầng: (1) chữ lớn "GẤP 9 LẦN" / "GẦN NHƯ BẰNG NHAU" (|tỉ lệ−1| < 0,05) (2) "TP.HCM 6.734 km² · Singapore 735 km²" (3) câu twist. Định dạng số kiểu Việt (dấu chấm nghìn, phẩy thập phân, 1 chữ số).
- Phím ← → , vuốt ngang trên card (mobile) để chuyển; Esc = Thoát.
- Chặng 10: nút → đổi thành "Tự so sánh" → thoát tour, giữ 2 hình chặng 10 trên bảng ở chế độ tự do.
- Thoát: về chế độ tự do với hình chặng hiện tại. Nút "Hành trình" luôn có trên thanh công cụ (cạnh Ngẫu nhiên) để vào lại.
- URL: trong tour chỉ ghi `?hanh-trinh=N` (replaceState), không ghi `?h=`. Mở URL có `?hanh-trinh=N` (1..10, sai → 1) → vào thẳng chặng N, không hiện intro. Thoát → ghi lại `?h=` như cũ.
- Mobile 375px: card full-width ở đáy, cao ≤ 150px, không tràn ngang; desktop: card max-width 640px giữa đáy.

## D3. Fun fact (không gắn trên hình)
- Hàm thuần `funFact(e: EntityMeta, all: EntityMeta[]): string` trong `funFacts.ts`:
  - tỉnh: "Lớn thứ k/34 tỉnh · bằng x% diện tích Việt Nam · dài khoảng L km"
  - vn: "Lớn thứ k/<số nước, không tính vn và tỉnh> nếu xếp cùng các nước · dài khoảng L km"
  - nước: "Lớn thứ k thế giới · bằng n lần Việt Nam" (n ≥ 1) hoặc "Việt Nam bằng n lần nước này" (n < 1); nếu nước nhỏ hơn VN, thêm " · cỡ <tỉnh VN có diện tích gần nhất>".
  - Xếp hạng theo area giảm dần; bỏ 'ata' (Nam Cực) khỏi xếp hạng nước; số định dạng Việt.
- Hiện ở Footer/thanh so sánh: mỗi chip hình có thể mở popover (click/tap chip hoặc nút ⓘ) hiện funFact. Khi vừa thêm một hình bằng tìm kiếm, hiện toast nhỏ funFact của hình đó 4 s (aria-live="polite").

## D4. "Bạn có biết?" — so sánh bất ngờ
- Hàm thuần `surprisingPairs(all): {a: string, b: string, ratio: number}[]` trong `funFacts.ts`: với mỗi tỉnh, nước có |area/area_tỉnh − 1| ≤ 0,06 gần nhất (bỏ nước < 50 km² và 'ata'); sắp theo độ lệch tăng dần; mỗi tỉnh tối đa 1 cặp.
- Dải "Bạn có biết? Nghệ An ≈ Kuwait →" ở chế độ tự do (gần thanh so sánh), đổi cặp mỗi 6 s (dừng khi hover/focus, dừng nếu reduced-motion), bấm → đặt đúng cặp đó lên bảng (Chồng tâm).
- Nút "Ngẫu nhiên": 50% lấy từ surprisingPairs, 50% như cũ.

## Ràng buộc chung
- Svelte 5 runes, không thêm thư viện. Không vỡ `?h=` cũ và 533 test cũ. Lighthouse ≥ 90, không tràn ngang 375px.
- Tiếng Việt có dấu trong UI. Không bịa số liệu.
- Test mới (vitest) cho: funFact, surprisingPairs, tourData (10 chặng, id tồn tại trong meta, tỉ lệ tính đúng, chặng 6 ra "GẦN NHƯ BẰNG NHAU"), parse `?hanh-trinh`, tween (reduced-motion nhảy thẳng).
