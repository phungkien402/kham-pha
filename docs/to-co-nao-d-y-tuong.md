# To cỡ nào — bước D: khơi gợi tò mò (ý tưởng của Claude)

Kiên muốn trang /to-co-nao gợi tò mò hơn, thêm một chế độ kiểu "The Size of Life" (neal.fun):
bấm "Tiếp" → hình đang xem thu nhỏ lại, hình lớn hơn bước vào, kèm 1–2 câu kể chuyện.
Kiên chọn: hành trình XOAY QUANH VIỆT NAM; ưu tiên màn mở đầu gây tò mò, fun fact cho từng hình, gợi ý so sánh bất ngờ.
(Không làm câu đố đoán.)

## 1. Màn mở đầu (intro)
- Lần đầu vào /to-co-nao (không có `?h=` trong URL): phủ một màn mở đầu toàn khung bảng.
  - Câu hỏi lớn: "Việt Nam thật ra to cỡ nào?"
  - Dòng phụ: "Đặt Việt Nam cạnh thế giới — vài điều có thể khiến bạn bất ngờ."
  - Phía sau mờ mờ hình Việt Nam (đã có dữ liệu default).
  - 2 nút: **"Bắt đầu hành trình →"** (vào chế độ Hành trình) và "Tự khám phá" (đóng màn, vào bảng như hiện tại).
- Có `?h=` hoặc đã từng đóng (localStorage `tcn-intro-seen`, bọc try/catch) → không hiện.

## 2. Chế độ Hành trình (giống Size of Life)
- Một chuỗi ~12 chặng cố định, từ nhỏ đến lớn, mỗi chặng là một cặp: 1 hình Việt Nam (tỉnh / cả nước) + 1 hình thế giới.
- Mỗi chặng: bảng tự thu phóng mượt (animate viewport ~700 ms, ease) để hai hình vừa khung; hình chặng trước mờ dần (giữ hình lớn nhất của chặng trước làm "mốc" mờ 25% để thấy cảm giác phóng to).
- Thẻ kể chuyện (card) đè góc dưới: số chặng "3/12", tiêu đề so sánh (tự tính, ví dụ "Hà Nội ≈ 1,3 lần Luxembourg"), 1–2 câu kể chuyện viết tay, nút ← Trước / Tiếp →, "Thoát".
- Phím ← → và vuốt ngang trên mobile để chuyển chặng. Thanh tiến độ mảnh trên đầu.
- Chặng cuối: "Giờ đến lượt bạn" + nút "Tự so sánh" → thoát về bảng tự do với 2 hình chặng cuối.
- URL `?hanh-trinh=3` để chia sẻ chặng.

Danh sách chặng (diện tích từ dữ liệu của mình, km²):
1. Singapore (735) vs TP.HCM (6.734) — TP.HCM rộng gấp ~9 Singapore.
2. Luxembourg (2.586) vs Hà Nội (3.366).
3. Brunei (5.765) vs Huế (5.041).
4. Liban (10.012) vs Đà Nẵng mới (11.609).
5. Kuwait (17.330) vs Nghệ An (16.534).
6. Bỉ (30.632) vs Lâm Đồng (24.334) — tỉnh lớn nhất.
7. Hà Lan (37.134) / Thuỵ Sĩ (41.207) vs Lâm Đồng+... → thay: Đài Loan (35.998) vs Lâm Đồng.
8. Hàn Quốc (97.154) vs Việt Nam — VN ≈ 3,4 lần.
9. Phần Lan (330.493) vs Việt Nam (330.533) — gần như bằng nhau tuyệt đối. (điểm nhấn)
10. Nhật Bản (370.098) vs Việt Nam — dài gần bằng nhau.
11. Pháp (635.047) vs Việt Nam.
12. Trung Quốc (9,37 triệu) vs Việt Nam — ~28 lần.
13. Nga (16,9 triệu) vs Việt Nam — ~51 lần. Kết.

Câu kể chuyện: chỉ dùng sự thật chắc chắn (diện tích, chiều dài/rộng từ dữ liệu, kiến thức phổ thông). Không bịa số liệu dân số chi tiết.

## 3. Fun fact cho TỪNG hình (tự sinh, không bịa)
Khi thêm/chọn 1 hình, hiện bong bóng nhỏ 1 câu, sinh tự động từ dữ liệu:
- Tỉnh: "Lớn thứ k trong 34 tỉnh · bằng x% Việt Nam · dài y km".
- Nước: "Lớn thứ k thế giới · bằng n lần Việt Nam" (hoặc "Việt Nam bằng n lần nước này").
- Thêm: "Gần bằng <tỉnh VN có diện tích gần nhất>" cho nước nhỏ hơn VN.
Hàm thuần `funFact(entity, allMeta)` có test.

## 4. Gợi ý so sánh bất ngờ
- Hàm thuần `surprisingPairs(meta)`: với mỗi tỉnh VN, tìm nước có diện tích lệch ≤ 6% → cặp "Nghệ An ≈ Kuwait".
- Một dải "Bạn có biết?" xoay vòng mỗi 6 s trên bảng (hoặc dưới thanh so sánh), bấm vào → đặt cặp đó lên bảng.
- Nút "Ngẫu nhiên" hiện có ưu tiên lấy từ danh sách này.

## Ràng buộc
- Không thêm thư viện. Svelte 5 runes như code hiện tại. Tôn trọng prefers-reduced-motion (bỏ animate).
- Không vỡ URL `?h=` cũ, không vỡ test cũ (533). Lighthouse ≥ 90.
- Mobile 375px: card kể chuyện full-width đáy, không tràn ngang.
