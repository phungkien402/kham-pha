# Phản biện thiết kế Bước D (/to-co-nao) — Góc nhìn Antigravity

## 1. UI/UX: Màn mở đầu & Chế độ Hành trình
- **Màn mở đầu (Intro)**: Không nên dùng popup modal đặc che kín bảng. Hãy để bảng render sẵn Chặng 1 (TP.HCM vs Singapore) mờ nhẹ phía sau (backdrop-blur 3px), đè card mở đầu bắt mắt: *"Việt Nam to cỡ nào? Bạn có biết TP.HCM rộng gấp 9 lần Singapore?"* với 2 lựa chọn: **"Bắt đầu hành trình (3 phút)"** và **"Tự khám phá"**.
- **Chuyển động (Motion)**: Giữ hình chặng trước làm mốc mờ 25% là ý tưởng rất tốt để cảm nhận độ phóng to. Chuyển chặng nên gồm 2 nhịp: (1) Hình mới trượt vào cạnh hình cũ -> (2) Viewport tự động nới rộng (zoom-out lerp mượt ~600ms) để thấy toàn cảnh so sánh.
- **Nhịp chữ & Bố cục card**:
  - Nhịp chữ 3 tầng: (1) Số so sánh giật mình font lớn (vd: **"GẤP 9 LẦN"**), (2) Tên & diện tích chuẩn xác, (3) 1 câu twist ngắn gọn.
  - Card bám đáy màn hình (bottom-sheet mỏng trên mobile ~120px, không che tâm bảng), tích hợp thanh tiến độ và nút bấm lớn vừa vặn ngón cái.
```text
+-------------------------------------------------------------+
| [===--------- 3/9]                              [Thoát ×]   |
|          (Hình cũ mờ 25%)          (Hình mới xuất hiện)     |
| +---------------------------------------------------------+ |
| | [←]  HÀ NỘI vs LUXEMBOURG                           [→] | |
| |      RỘNG GẤP 1,3 LẦN (3.366 km² vs 2.586 km²)          | |
| |      Thủ đô Việt Nam rộng hơn cả một đại công quốc châu Âu | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

## 2. Danh sách chặng: Chuẩn hoá 9 chặng vàng (bỏ lủng củng)
- **Đồng ý các cặp**: `sgp` vs `tp-ho-chi-minh` (gấp 9 lần), `lux` vs `ha-noi` (thủ đô vs đại công quốc), `kwt` vs `nghe-an` (lệch <5%), `bel` vs `lam-dong` (tỉnh lớn nhất), `fin` vs `viet-nam` (kèo song sinh cực phẩm 330.493 vs 330.533), `jpn` vs `viet-nam` (dài tương đương), `fra` vs `viet-nam` (~1,9 lần), `rus` vs `viet-nam` (~51 lần). Tất cả ID đều chuẩn xác trong `meta.json`.
- **Bỏ & Thay thế**:
  - **Bỏ Liban vs Đà Nẵng (`da-nang`, 11.609 km²)**: Số liệu Đà Nẵng gồm cả huyện đảo Hoàng Sa, diện tích đất liền chỉ ~1.285 km² nên người xem sẽ hoang mang, tranh cãi số liệu.
  - **Bỏ Brunei vs Huế**: Cố đô vs Brunei ít sức hút tâm lý, nên cắt bớt để dồn nhịp.
  - **Bỏ Chặng 7 (Đài Loan vs Lâm Đồng)**: Bị lặp lại Lâm Đồng (đã dùng ở chặng 4). Kiến trúc hiện tại cũng chưa hỗ trợ gộp nhiều tỉnh thành 1 cụm.
  - **Bổ sung bước đệm**: `kor` (Hàn Quốc, 97.154 km²) vs `viet-nam` (330.533 km²) — Cú hích tâm lý lớn vì đa số nghĩ Hàn Quốc rất lớn mạnh, thực tế VN rộng gấp 3,4 lần.
- **Chuỗi 9 chặng gợi xuất sắc**:
  1. `sgp` vs `tp-ho-chi-minh` | 2. `lux` vs `ha-noi` | 3. `kwt` vs `nghe-an` | 4. `bel` vs `lam-dong`
  5. `kor` vs `viet-nam` | 6. `fin` vs `viet-nam` | 7. `jpn` vs `viet-nam` | 8. `fra` vs `viet-nam` | 9. `rus` vs `viet-nam`.

## 3. Rủi ro kỹ thuật & Cách chia file
- **Animate Viewport**: CSS transition trên `<g class="board-camera">` dễ xung đột với kéo/thả/zoom của chuột & touch. Nên dùng hàm tween bằng JS (`requestAnimationFrame` + lerp/ease-out), tạm khoá kéo thả trong 600ms chuyển chặng; tắt tween nếu `prefers-reduced-motion`.
- **Tải chunk dữ liệu**: Dữ liệu nằm ở 3 chunk (`default`, `vn`, `nuoc-pho-bien`). Cần gọi prefetch toàn bộ 11 shape của tour ngay khi mở chế độ Hành trình để chuyển chặng tức thì, không bị nháy trắng.
- **Xung đột URL**: `$effect` hiện tại tự động ghi đè `?h=`. Cần cờ `isTour`: khi đang trong tour chỉ quản lý `?tour=N`, ngắt đồng bộ `?h=` đến khi người dùng ấn "Thoát / Tự khám phá".
- **Cách chia file**:
  - `tourData.ts`: Danh sách 9 chặng, story text, hàm preload.
  - `TourCard.svelte`: Thanh tiến độ, thẻ thông tin, nút Trước/Tiếp/Thoát.
  - `viewportAnimation.ts`: Hàm tween nội suy viewport mượt mà.

## 4. Điểm không đồng ý với Claude
1. **13 chặng quá dài**: Người dùng web dễ nản sau 6-7 bước. Rút còn 9 chặng tạo tiết tấu dồn dập, đắt giá hơn.
2. **Modal intro che kín bảng**: Gây cảm giác cồng kềnh như app doanh nghiệp, làm mất chất playful của neal.fun.
3. **Bong bóng Fun fact tự động gắn trên hình**: Sẽ làm che khuất nét vẽ SVG khi thao tác chồng hình. Fun fact chỉ nên nằm ở Footer hoặc popover khi click.
4. **Chặng Đà Nẵng và chặng 7**: Dễ gây tranh cãi số liệu (Hoàng Sa) và bị lặp lại hình ảnh Lâm Đồng.
